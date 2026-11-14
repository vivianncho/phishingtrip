import { createHmac, randomBytes } from "node:crypto";
import type { NumberMetadata, ProviderState } from "@workspace/api-zod";
import { boundedInt, CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS } from "./policy";
import { lookupCounters, type Counters, type CounterRule } from "./counters";

type Status = ProviderState["metadata"];
export type LookupResult = { status: Status; metadata: NumberMetadata | null };
export interface MetadataProvider {
  status(): Status | Promise<Status>;
  lookup(number: string): Promise<LookupResult>;
}
export interface LookupConfig {
  enabled: boolean;
  key?: string;
  secret?: string;
  timeoutMs: number;
  maxRequests: number;
  requestsPerMinute: number;
  maxSpendMicroUsd?: number;
  requestCostMicroUsd?: number;
}
export function lookupConfig(): LookupConfig {
  return {
    enabled: process.env.TWILIO_LOOKUP_ENABLED === "true",
    key: process.env.TWILIO_API_KEY,
    secret: process.env.TWILIO_API_SECRET,
    timeoutMs: boundedInt(process.env.TWILIO_TIMEOUT_MS, 2000, 5000),
    maxRequests: boundedInt(process.env.TWILIO_MAX_REQUESTS, 100, 10000),
    requestsPerMinute: boundedInt(process.env.TWILIO_REQUESTS_PER_MINUTE, 10, 100),
    maxSpendMicroUsd: boundedInt(process.env.TWILIO_MAX_SPEND_MICRO_USD, 0, 10000000),
    requestCostMicroUsd: boundedInt(process.env.TWILIO_REQUEST_COST_MICRO_USD, 1000, 1000000),
  };
}

export class TwilioBasic implements MetadataProvider {
  private cache = new Map<string, { result: LookupResult; expires: number }>();
  private pending = new Map<string, Promise<LookupResult>>();
  private salt = randomBytes(32);
  private cleanup: ReturnType<typeof setInterval>;
  constructor(private config: LookupConfig, private request: typeof fetch = fetch, private now = Date.now, private counters: Counters = lookupCounters) {
    if (!Number.isSafeInteger(config.requestCostMicroUsd ?? 1000) || (config.requestCostMicroUsd ?? 1000) < 1) {
      throw new Error("Basic request cost reservation must be positive");
    }
    // Purge expired values even when no further lookups arrive.
    this.cleanup = setInterval(() => this.purge(), 1000);
    this.cleanup.unref();
  }
  close() { clearInterval(this.cleanup); this.cache.clear(); }
  private purge() {
    for (const [key, entry] of this.cache) if (entry.expires <= this.now()) this.cache.delete(key);
  }
  private configurationStatus(): Status {
    if (!this.config.enabled) return "disabled";
    if (!this.config.key || !/^SK[0-9a-fA-F]{32}$/.test(this.config.key) || !this.config.secret?.trim()) return "not_configured";
    return "available";
  }
  private rules(): CounterRule[] {
    return [
      { key: "daily-requests", limit: this.config.maxRequests, amount: 1, windowMs: 86400000 },
      { key: "daily-spend", limit: this.config.maxSpendMicroUsd ?? 0, amount: this.config.requestCostMicroUsd ?? 1000, windowMs: 86400000 },
      { key: "minute-requests", limit: this.config.requestsPerMinute, amount: 1, windowMs: 60000 },
    ];
  }
  private async budget(reserve: boolean): Promise<Status> {
    try {
      const result = await this.counters.check(this.rules(), reserve);
      return result.allowed ? "available" : result.deniedKey === "minute-requests" ? "rate_limited" : "budget_exhausted";
    } catch { return "unavailable"; }
  }
  async status(): Promise<Status> {
    const configured = this.configurationStatus();
    return configured === "available" ? this.budget(false) : configured;
  }
  async lookup(number: string): Promise<LookupResult> {
    const configured = this.configurationStatus();
    if (configured !== "available") return { status: configured, metadata: null };
    this.purge();
    const key = createHmac("sha256", this.salt).update(number).digest("hex");
    const cached = this.cache.get(key);
    if (cached) return { ...cached.result, metadata: cached.result.metadata ? { ...cached.result.metadata, cached: true } : null };
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= CACHE_MAX_ENTRIES) return { status: "rate_limited", metadata: null };
    const promise = (async (): Promise<LookupResult> => {
      // Never send upstream before the durable atomic reservation commits.
      const status = await this.budget(true);
      return status === "available" ? this.perform(number) : { status, metadata: null };
    })().then((result) => {
      this.purge();
      if (this.cache.size >= CACHE_MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { result, expires: this.now() + (result.metadata ? CACHE_TTL_SECONDS : 30) * 1000 });
      return result;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
  private async perform(number: string): Promise<LookupResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, this.config.timeoutMs));
    try {
      // Fixed origin; E.164 path only. No Fields, packages, addons, redirects, or caller-supplied URLs.
      const response = await this.request(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(number)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${this.config.key}:${this.config.secret}`).toString("base64")}`, Accept: "application/json" },
        signal: controller.signal, redirect: "error",
      });
      if (!response.ok) {
        await response.body?.cancel();
        return { status: response.status === 429 ? "rate_limited" : "unavailable", metadata: null };
      }
      if (!response.headers.get("content-type")?.includes("application/json") || !response.body) return { status: "invalid_response", metadata: null };
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 16384) { await reader.cancel(); return { status: "invalid_response", metadata: null }; }
        chunks.push(part.value);
      }
      const raw = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      if (raw.phone_number !== number || typeof raw.valid !== "boolean" ||
          !(raw.country_code === null || typeof raw.country_code === "string" && /^[A-Z]{2}$/.test(raw.country_code)) ||
          !(raw.national_format === null || typeof raw.national_format === "string" && raw.national_format.length <= 64 && /^[+\d ().-]+$/.test(raw.national_format))) {
        return { status: "invalid_response", metadata: null };
      }
      const now = this.now();
      return { status: raw.country_code === null || raw.national_format === null ? "partial" : "success", metadata: {
        provider: "twilio_basic", valid: raw.valid, countryCode: raw.country_code as string | null,
        nationalFormat: raw.national_format as string | null, fetchedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + CACHE_TTL_SECONDS * 1000).toISOString(), cached: false,
      } };
    } catch (error) {
      return { status: controller.signal.aborted ? "timeout" : error instanceof SyntaxError ? "invalid_response" : "unavailable", metadata: null };
    } finally { clearTimeout(timer); }
  }
}

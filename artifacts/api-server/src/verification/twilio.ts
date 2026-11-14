import { createHmac, randomBytes } from "node:crypto";
import type { NumberMetadata, ProviderState } from "@workspace/api-zod";
import { boundedInt, CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS } from "./policy";

type Status = ProviderState["metadata"];
export type LookupResult = { status: Status; metadata: NumberMetadata | null };
export interface MetadataProvider {
  status(): Status;
  lookup(number: string): Promise<LookupResult>;
}
export interface LookupConfig {
  enabled: boolean;
  key?: string;
  secret?: string;
  timeoutMs: number;
  maxRequests: number;
  requestsPerMinute: number;
}
export function lookupConfig(): LookupConfig {
  return {
    enabled: process.env.TWILIO_LOOKUP_ENABLED === "true",
    key: process.env.TWILIO_API_KEY,
    secret: process.env.TWILIO_API_SECRET,
    timeoutMs: boundedInt(process.env.TWILIO_TIMEOUT_MS, 2000, 5000),
    maxRequests: boundedInt(process.env.TWILIO_MAX_REQUESTS, 100, 10000),
    requestsPerMinute: boundedInt(process.env.TWILIO_REQUESTS_PER_MINUTE, 10, 100),
  };
}

export class TwilioBasic implements MetadataProvider {
  private cache = new Map<string, { result: LookupResult; expires: number }>();
  private pending = new Map<string, Promise<LookupResult>>();
  private salt = randomBytes(32);
  private requests = 0;
  private windowStart = 0;
  private windowRequests = 0;
  private cleanup: ReturnType<typeof setInterval>;
  constructor(private config: LookupConfig, private request: typeof fetch = fetch, private now = Date.now) {
    // Purge expired values even when no further lookups arrive.
    this.cleanup = setInterval(() => this.purge(), 1000);
    this.cleanup.unref();
  }
  close() { clearInterval(this.cleanup); this.cache.clear(); }
  private purge() {
    for (const [key, entry] of this.cache) if (entry.expires <= this.now()) this.cache.delete(key);
  }
  status(): Status {
    if (!this.config.enabled) return "disabled";
    if (!this.config.key || !/^SK[0-9a-fA-F]{32}$/.test(this.config.key) || !this.config.secret?.trim()) return "not_configured";
    if (this.requests >= this.config.maxRequests) return "budget_exhausted";
    if (this.now() - this.windowStart < 60000 && this.windowRequests >= this.config.requestsPerMinute) return "rate_limited";
    return "available";
  }
  async lookup(number: string): Promise<LookupResult> {
    if (!this.config.enabled || !this.config.key || !this.config.secret || this.status() === "not_configured") return { status: this.status(), metadata: null };
    this.purge();
    const key = createHmac("sha256", this.salt).update(number).digest("hex");
    const cached = this.cache.get(key);
    if (cached) return { ...cached.result, metadata: cached.result.metadata ? { ...cached.result.metadata, cached: true } : null };
    const pending = this.pending.get(key);
    if (pending) return pending;
    const status = this.status();
    if (status !== "available") return { status, metadata: null };
    if (this.now() - this.windowStart >= 60000) { this.windowStart = this.now(); this.windowRequests = 0; }
    this.requests++;
    this.windowRequests++;
    const promise = this.perform(number).then((result) => {
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

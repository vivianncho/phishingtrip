import { z } from "zod";
import { SearchTravelPlacesResponse } from "@workspace/api-zod";
import { PostgresCounters, type Counters } from "./counters";
import { ApiFault } from "./policy";

// Fixed account-wide namespace: key rotations and replicas must not reset spend.
const counters = new PostgresCounters("google-places");
const upstream = z.object({
  places: z.array(z.object({
    id: z.string().min(1).max(512),
    displayName: z.object({ text: z.string().max(500) }),
    formattedAddress: z.string().max(1000).optional(),
    internationalPhoneNumber: z.string().max(64).optional(),
    websiteUri: z.string().max(2048).optional(),
    googleMapsUri: z.string().max(2048).optional(),
    attributions: z.array(z.object({
      provider: z.string().max(500), providerUri: z.string().max(2048).optional(),
    })).max(100).optional(),
  })).max(8).optional(),
}).strict();

function httpsUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : undefined;
  } catch { return undefined; }
}
async function accessMessage(response: Response): Promise<string> {
  let diagnostic = "";
  try {
    const failure = z.object({ error: z.object({
      message: z.string().optional(),
      details: z.array(z.object({ reason: z.string().optional() })).optional(),
    }) }).parse(await boundedJson(response));
    diagnostic = [failure.error.message, ...failure.error.details?.map(d => d.reason) ?? []].join(" ").toLowerCase();
  } catch { /* An unreadable error must still become fixed, non-sensitive copy. */ }
  if (/billing|payment/.test(diagnostic)) return "Google requires active billing for this key’s project.";
  if (/service_disabled|has not been used|is not enabled|api is disabled|enable it/.test(diagnostic)) return "Enable Places API (New) in this key’s Google Cloud project.";
  if (/referer|referrer/.test(diagnostic)) return "Google rejected a browser-restricted key. This integration needs a key permitted for server-side Places requests.";
  if (/ip.address|ip_address/.test(diagnostic)) return "Google rejected this server’s IP address. Review the key’s server restrictions.";
  if (/api_key_invalid|api_key_expired|api_key_not_found|api key not valid|invalid api key|key has expired/.test(diagnostic)) return "Google rejected the API key. Replace the server-side Places key through Secrets.";
  if (/api_key_service_blocked/.test(diagnostic)) return "This key’s API restrictions do not allow Places API (New).";
  return "Google Places is not available. The app owner needs to check the API key, Places API (New) access and billing.";
}
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024) throw new Error("Response too large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); }
}

export class PlacesSearch {
  constructor(
    private key = () => process.env.GOOGLE_PLACES_API_KEY,
    private limits: Counters = counters,
    private transport: typeof fetch = fetch,
  ) {}

  async search(query: string) {
    const key = this.key();
    if (!key) throw new ApiFault(503, "PLACES_NOT_CONFIGURED", "Google Places is not set up yet. You can still use the sourced directory.");
    let reservation;
    try {
      reservation = await this.limits.check([
        { key: "daily", limit: 10, amount: 1, windowMs: 86400000 },
      ], true);
    } catch {
      throw new ApiFault(503, "PLACES_UNAVAILABLE", "Google search is paused because its shared limit could not be checked. No search was sent.");
    }
    if (!reservation.allowed) {
      throw new ApiFault(429, "PLACES_DAILY_LIMIT", "Today’s 10 Google searches have been used across the app. Try after midnight UTC, or use the sourced directory.");
    }
    // Exactly one attempt. Failed attempts count; no retries, caching or imports.
    try {
      const response = await this.transport("https://places.googleapis.com/v1/places:searchText", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.attributions",
        },
        body: JSON.stringify({ textQuery: query, pageSize: 8 }),
      });
      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) {
          throw new ApiFault(503, "PLACES_ACCESS_ERROR", await accessMessage(response));
        }
        await response.body?.cancel().catch(() => {});
        throw new Error("Provider unavailable");
      }
      const data = upstream.parse(await boundedJson(response));
      return SearchTravelPlacesResponse.parse({
        checkedAt: new Date().toISOString(),
        items: (data.places ?? []).map(p => ({
          id: p.id, name: p.displayName.text, address: p.formattedAddress ?? "",
          phone: p.internationalPhoneNumber,
          website: httpsUrl(p.websiteUri), mapsUrl: httpsUrl(p.googleMapsUri),
          attributions: (p.attributions ?? []).map(a => ({ name: a.provider, uri: httpsUrl(a.providerUri) })),
        })),
      });
    } catch (error) {
      if (error instanceof ApiFault) throw error;
      // Never leak raw provider errors, the key, search text or phone numbers.
      throw new ApiFault(503, "PLACES_UNAVAILABLE", "Google search couldn’t finish. No conclusion was reached. Your attempt counted toward today’s limit.");
    }
  }
}

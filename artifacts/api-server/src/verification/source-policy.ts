import type { Evidence } from "@workspace/api-zod";
import { SOURCE_MAX_AGE_DAYS } from "./policy";

export const DAY_MS = 86400000;

export function officialProvenance(sourceUrl: string, website: string): boolean {
  try {
    const source = new URL(sourceUrl), official = new URL(website);
    return source.protocol === "https:" && official.protocol === "https:" &&
      source.origin === official.origin && !source.username && !source.password;
  } catch { return false; }
}

export function effectiveExpiry(reviewedAt: Date, expiresAt: Date): number {
  return Math.min(expiresAt.getTime(), reviewedAt.getTime() + SOURCE_MAX_AGE_DAYS * DAY_MS);
}

export function evidenceFreshness(e: Pick<Evidence, "reviewedAt" | "expiresAt">, now = Date.now()): Evidence["freshness"] {
  const reviewed = Date.parse(e.reviewedAt), expires = Date.parse(e.expiresAt);
  if (!Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed > now || expires <= reviewed) return "unknown";
  return now < effectiveExpiry(new Date(reviewed), new Date(expires)) ? "current" : "stale";
}

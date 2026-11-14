export const SOURCE_MAX_AGE_DAYS = 90;
export const CACHE_TTL_SECONDS = 300;
export const CACHE_MAX_ENTRIES = 200;
export const limitations = [
  "Caller ID can be spoofed. A directory match does not authenticate a caller.",
  "No result establishes that a number is safe or definitively fraudulent.",
  "Live reputation reports are unavailable; missing reports are not evidence of safety.",
  "The curated directory is small and may be incomplete or change after review.",
  "Basic metadata describes formatting and numbering-plan validity, not ownership, reachability, line type, or scam risk.",
];

export class ApiFault extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export function boundedInt(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) > max) throw new Error("Invalid numeric configuration");
  return Number(value);
}

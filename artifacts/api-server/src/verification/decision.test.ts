import test from "node:test";
import assert from "node:assert/strict";
import type { Evidence, OfficialContact } from "@workspace/api-zod";
import { decide } from "./decision";
import { normalize } from "./normalize";
import { evidenceFreshness } from "./directory";

const now = Date.parse("2026-11-14T21:00:00Z");
const number = "+18002211212";
export function fixtureContact(overrides: Partial<OfficialContact> = {}): OfficialContact {
  return { id: "fixture-contact", companyId: "fixture-air", number, region: "US", service: "Test only", freshness: "current", sources: [{
    id: "fixture-source", kind: "official_contact", companyId: "fixture-air", number, sourceName: "Fixture official site",
    sourceUrl: "https://fixture.example/contact", reviewedAt: "2026-11-14T20:00:00Z",
    expiresAt: "2027-02-12T20:00:00Z", assertion: "listed", freshness: "current",
  }], ...overrides };
}
test("international and explicit-country national normalization", () => {
  assert.equal(normalize("+1 (800) 221-1212").number, number);
  assert.equal(normalize("800-221-1212", "US").number, number);
  assert.equal(normalize("020 7946 0018", "GB").number, "+442079460018");
  assert.equal(normalize("+44 20 7946 0018", "US").number, "+442079460018");
  assert.throws(() => normalize("8002211212"), { code: "COUNTRY_REQUIRED" });
  assert.throws(() => normalize("8002211212", "ZZ"), { code: "INVALID_COUNTRY" });
  for (const input of ["123", "+999123456789", "+18002211212 ext 12", "call +18002211212", "https://x.example/+18002211212", "1-800-FLOWERS", "+18002211212;12"]) {
    assert.throws(() => normalize(input, "US"), { code: "INVALID_NUMBER" });
  }
});
test("exact match, claim scoping, no evidence, stale and missing provenance", () => {
  const c = fixtureContact();
  assert.equal(decide(number, undefined, [c], [], [], now).outcome, "official_match");
  assert.equal(decide(number, c.companyId, [c], [], [], now).reason, "EXACT_OFFICIAL_MATCH");
  assert.equal(decide(number, "different-air", [c], [], [], now).reason, "COMPANY_MISMATCH");
  assert.equal(decide(number, undefined, [], [], [], now).reason, "NO_EVIDENCE");
  assert.equal(decide(number, undefined, [fixtureContact({ sources: [] })], [], [], now).outcome, "not_verified");
  const stale = fixtureContact({ sources: c.sources.map((s) => ({ ...s, reviewedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-04-01T00:00:00Z", freshness: "stale" })) });
  assert.equal(decide(number, undefined, [stale], [stale], [], now).reason, "STALE_EVIDENCE");
  assert.deepEqual(decide(number, undefined, [stale], [stale], [], now).alternatives, []);
  assert.equal(evidenceFreshness({ reviewedAt: "2027-01-01T00:00:00Z", expiresAt: "2028-01-01T00:00:00Z" }, now), "unknown");
  assert.equal(evidenceFreshness({ reviewedAt: "2026-01-01T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" }, now), "stale");
  assert.equal(evidenceFreshness({ reviewedAt: "invalid", expiresAt: "invalid" }, now), "unknown");
});
test("unresolved disputes and conflicting company assignments block official match", () => {
  const c = fixtureContact();
  const disputed = fixtureContact({ sources: [...c.sources, { ...c.sources[0]!, id: "dispute", assertion: "disputed" }] });
  assert.equal(decide(number, undefined, [disputed], [], [], now).reason, "SOURCE_CONFLICT");
  assert.deepEqual(decide(number, undefined, [disputed], [c], [], now).alternatives, []);
  assert.equal(decide(number, c.companyId, [c, fixtureContact({ companyId: "other", sources: c.sources.map((s) => ({ ...s, companyId: "other" })) })], [], [], now).reason, "SOURCE_CONFLICT");
  assert.equal(decide(number, undefined, [fixtureContact({ sources: c.sources.map((s) => ({ ...s, freshness: "unknown" })) })], [], [], now).outcome, "not_verified");
  assert.equal(decide("+18004337300", undefined, [c], [], [], now).outcome, "not_verified");
});
test("Reports found requires attributable fixture evidence, never lack of reports", () => {
  const report: Evidence = { ...fixtureContact().sources[0]!, kind: "reputation_report", assertion: "report", companyId: null };
  const result = decide(number, undefined, [], [], [report], now);
  assert.equal(result.outcome, "reports_found");
  assert.equal(result.label, "Reports found");
  assert.equal(result.reason, "ATTRIBUTABLE_REPORTS");
  for (const invalid of [{ ...report, sourceUrl: "" }, { ...report, sourceName: "" }, { ...report, id: "" }, { ...report, number: "+18004337300" }, { ...report, expiresAt: "2026-01-01T00:00:00Z" }]) {
    assert.equal(decide(number, undefined, [], [], [invalid], now).outcome, "not_verified");
  }
  assert.equal(decide(number, undefined, [fixtureContact()], [], [report], now).reason, "SOURCE_CONFLICT");
});

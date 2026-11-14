import test from "node:test";
import assert from "node:assert/strict";
import { apiOrigin, phoneCandidate, checkBody, checkResult, apiRequest, companyPage } from "../src/core.js";
import { result, company } from "./fixtures.mjs";

test("backend origins require HTTPS, no credentials, no tokens or hidden paths", () => {
  assert.equal(apiOrigin("https://backend.example/"), "https://backend.example");
  for (const input of ["http://example.com", "https://user:pass@example.com", "https://backend.example/api", "https://backend.example?token=secret", "https://backend.example/#token", "file:///secret", "https://localhost"]) {
    assert.throws(() => apiOrigin(input));
  }
});
test("only one selected phone number is accepted; prose, tracking URLs and ambiguous countries stay local", () => {
  assert.equal(phoneCandidate("+1 (800) 221-1212"), "+1 (800) 221-1212");
  for (const candidate of ["Call +1 800 221 1212 now", "https://example.com/?phone=18002211212", "+1 800 221 1212 ext 5", "12", null, "<img src=x onerror=alert(1)>", "1".repeat(100)]) {
    assert.equal(phoneCandidate(candidate), null);
  }
  assert.throws(() => checkBody("800-221-1212", "", ""));
  assert.throws(() => checkBody("+18002211212", "USA", ""));
  assert.throws(() => checkBody("+18002211212", "", "Delta?url=secret"));
  assert.deepEqual(checkBody("800-221-1212", "us", "delta"), { phoneNumber: "800-221-1212", defaultCountry: "US", claimedCompanyId: "delta" });
  assert.deepEqual(checkBody("+18002211212", "", ""), { phoneNumber: "+18002211212" });
});
test("official matches require current exact-number evidence; stale, foreign, missing, or unsafe evidence is rejected", () => {
  const body = { phoneNumber: "+18002211212" }, good = result();
  assert.equal(checkResult(good, body).outcome, "official_match");
  for (const bad of [
    { ...good, evidence: [] },
    { ...good, normalizedNumber: "+18004337300" },
    { ...good, reason: "COMPANY_MISMATCH" },
    { ...good, label: "Safe" },
    { ...good, evidence: [{ ...good.evidence[0], freshness: "stale" }] },
    { ...good, evidence: [{ ...good.evidence[0], expiresAt: "2020-01-01T00:00:00Z" }] },
    { ...good, evidence: [{ ...good.evidence[0], sourceUrl: "javascript:alert(1)" }] },
    { ...good, providers: { ...good.providers, directory: "unavailable" } },
  ]) assert.throws(() => checkResult(bad, body));
  assert.throws(() => checkResult(result({ claimedCompanyId: "marriott" }), { ...body, claimedCompanyId: "marriott" }));
});
test("unverified numbers remain unknown and unsupported report claims are blocked", () => {
  const body = { phoneNumber: "+18002211212" };
  const unknown = result({ outcome: "not_verified", label: "Not verified", reason: "NO_EVIDENCE", evidence: [], alternatives: [] });
  assert.equal(checkResult(unknown, body).outcome, "not_verified");
  assert.throws(() => checkResult(result({ outcome: "reports_found", label: "Reports found", reason: "ATTRIBUTABLE_REPORTS" }), body));
});
test("all travel categories validate and website-only entries remain contact-free", () => {
  for (const category of ["airline", "hotel", "vacation_rental", "car_rental", "booking_service", "rail_transfer", "cruise", "tour"]) {
    const page = companyPage({ items: [company({ category })], total: 1, nextOffset: null });
    assert.deepEqual(page.items[0].contacts, []);
  }
  assert.throws(() => companyPage({ items: [company({ website: "javascript:alert(1)" })], total: 1, nextOffset: null }));
});
test("API transport uploads exactly the selected contract, omits credentials/referrers and refuses redirects", async () => {
  let sent;
  const body = checkBody("+18002211212", "", "delta");
  const value = await apiRequest("https://backend.example", "/checks", {
    body,
    fetcher: async (url, options) => { sent = { url, options }; return Response.json(result({ claimedCompanyId: "delta" })); },
  });
  assert.equal(value.outcome, "official_match");
  assert.equal(sent.url, "https://backend.example/api/checks");
  assert.deepEqual(JSON.parse(sent.options.body), { phoneNumber: "+18002211212", claimedCompanyId: "delta" });
  assert.equal(sent.options.credentials, "omit");
  assert.equal(sent.options.referrerPolicy, "no-referrer");
  assert.equal(sent.options.redirect, "error");
  assert.equal(sent.options.cache, "no-store");
  assert.equal(sent.options.headers.Authorization, undefined);
  await assert.rejects(apiRequest("https://backend.example", "/arbitrary?url=private"), /Unsupported/);
});
test("rate limits, login pages, malformed responses and timeouts fail explicitly", async () => {
  for (const [response, message] of [
    [new Response("", { status: 429 }), /Wait/],
    [new Response("", { status: 503 }), /unavailable/],
    [new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }), /did not return evidence/],
    [new Response("{", { headers: { "content-type": "application/json" } }), /could not be read/],
    [new Response("x".repeat(512001), { headers: { "content-type": "application/json" } }), /too large/],
  ]) await assert.rejects(apiRequest("https://backend.example", "/checks", { fetcher: async () => response }), message);
  await assert.rejects(apiRequest("https://backend.example", "/checks", {
    timeout: 2, fetcher: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")))),
  }), /too long/);
});

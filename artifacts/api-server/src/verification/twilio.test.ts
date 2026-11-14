import test from "node:test";
import assert from "node:assert/strict";
import { TwilioBasic, type LookupConfig } from "./twilio";

const number = "+18002211212";
const config: LookupConfig = { enabled: true, key: `SK${"1".repeat(32)}`, secret: "fixture-only", timeoutMs: 20, maxRequests: 1000, requestsPerMinute: 1000 };
const body = { phone_number: number, valid: true, country_code: "US", national_format: "(800) 221-1212", line_type_intelligence: { type: "voip" } };
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
test("disabled or unconfigured does not make any provider requests", async () => {
  const request = (async () => { throw new Error("must not call"); }) as typeof fetch;
  for (const [c, status] of [[{ ...config, enabled: false }, "disabled"], [{ ...config, key: undefined }, "not_configured"], [{ ...config, key: "invalid" }, "not_configured"]] as const) {
    const provider = new TwilioBasic(c, request);
    assert.equal((await provider.lookup(number)).status, status);
    provider.close();
  }
});
test("Basic uses fixed host, no premium fields, coalesces and expires bounded cache", async () => {
  let calls = 0, now = 1000000;
  const provider = new TwilioBasic(config, (async (url, init) => {
    calls++;
    assert.equal(String(url), "https://lookups.twilio.com/v2/PhoneNumbers/%2B18002211212");
    assert.equal(init?.redirect, "error");
    await new Promise((resolve) => setTimeout(resolve, 1));
    return json(body);
  }) as typeof fetch, () => now);
  const results = await Promise.all([provider.lookup(number), provider.lookup(number)]);
  assert.equal(calls, 1);
  assert.equal(results[0]!.status, "success");
  assert.equal((await provider.lookup(number)).metadata?.cached, true);
  assert.equal(JSON.stringify(results).includes("voip"), false);
  now += 300001;
  assert.equal((await provider.lookup(number)).metadata?.cached, false);
  assert.equal(calls, 2);
  provider.close();
});
test("provider error, timeout, malformed, mismatching and partial responses are visible", async () => {
  const cases: [typeof fetch, string][] = [
    [(async () => new Response("", { status: 429 })) as typeof fetch, "rate_limited"],
    [(async () => new Response("private upstream error", { status: 401 })) as typeof fetch, "unavailable"],
    [(async () => json({ ...body, phone_number: "+18004337300" })) as typeof fetch, "invalid_response"],
    [(async () => json({ ...body, valid: "true" })) as typeof fetch, "invalid_response"],
    [(async () => json({ ...body, national_format: "sensitive free text" })) as typeof fetch, "invalid_response"],
    [(async () => json({ ...body, country_code: null, national_format: null })) as typeof fetch, "partial"],
    [(async () => new Response("{broken", { headers: { "content-type": "application/json" } })) as typeof fetch, "invalid_response"],
    [(async () => json({ ...body, padding: "x".repeat(17000) })) as typeof fetch, "invalid_response"],
    [((_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("private timeout details"))); })) as typeof fetch, "timeout"],
    [(async () => { throw new Error("sensitive upstream content"); }) as typeof fetch, "unavailable"],
  ];
  for (const [request, status] of cases) {
    const provider = new TwilioBasic(config, request);
    assert.equal((await provider.lookup(number)).status, status);
    assert.equal(JSON.stringify(await provider.lookup(number)).includes("sensitive"), false);
    provider.close();
  }
});
test("request and process budget caps cannot be bypassed with concurrent distinct numbers", async () => {
  let calls = 0;
  const request = (async (url) => { calls++; return json({ ...body, phone_number: decodeURIComponent(String(url).split("/").at(-1)!) }); }) as typeof fetch;
  const provider = new TwilioBasic({ ...config, maxRequests: 2 }, request);
  await Promise.all(["+18002211212", "+18004337300", "+18008648331"].map((n) => provider.lookup(n)));
  assert.equal(calls, 2);
  assert.equal(provider.status(), "budget_exhausted");
  provider.close();
  let now = 1000000;
  const limited = new TwilioBasic({ ...config, requestsPerMinute: 1 }, request, () => now);
  await limited.lookup(number);
  assert.equal((await limited.lookup("+18004337300")).status, "rate_limited");
  now += 60001;
  assert.equal((await limited.lookup("+18004337300")).status, "success");
  limited.close();
});
test("cache evicts past 200 entries and cached failures expire after 30 seconds", async () => {
  let calls = 0, now = 1000000;
  const provider = new TwilioBasic(config, (async (url) => {
    calls++; return json({ ...body, phone_number: decodeURIComponent(String(url).split("/").at(-1)!) });
  }) as typeof fetch, () => now);
  for (let i = 0; i < 201; i++) await provider.lookup(`+1202555${String(i).padStart(4, "0")}`);
  await provider.lookup("+12025550000");
  assert.equal(calls, 202);
  provider.close();
  calls = 0;
  const failed = new TwilioBasic(config, (async () => { calls++; throw new Error("private"); }) as typeof fetch, () => now);
  await failed.lookup(number); await failed.lookup(number);
  assert.equal(calls, 1);
  now += 30001;
  await failed.lookup(number);
  assert.equal(calls, 2);
  failed.close();
});

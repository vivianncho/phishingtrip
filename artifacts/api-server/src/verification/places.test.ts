import test, { after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import pino from "pino";
import { closeDatabasePools } from "@workspace/db";
import { SearchTravelPlacesResponse } from "@workspace/api-zod";
import { PlacesSearch } from "./places";
import { placesRouter } from "../routes/places";
import { createApp } from "../app";
import { counterFixture } from "./counter-fixture";
import type { Counters } from "./counters";

after(async () => { await closeDatabasePools(); });
const listing = {
  id: "test-place", displayName: { text: "Example Hotel" }, formattedAddress: "Boston",
  internationalPhoneNumber: "+1 202-555-0199", websiteUri: "javascript:alert(1)",
  googleMapsUri: "https://maps.google.com/?cid=123",
  attributions: [{ provider: "Example provider", providerUri: "https://example.org/" }],
};
function app(provider: PlacesSearch) {
  return createApp({ router: placesRouter(provider), counters: counterFixture().store, logger: pino({ level: "silent" }) });
}
const ok = () => Promise.resolve(Response.json({ places: [listing] }));

test("phone and website fields use one masked POST; outputs remain unverified and ephemeral", async () => {
  let calls = 0;
  const provider = new PlacesSearch(() => "test-credential", counterFixture().store, async (url, init) => {
    calls++;
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.deepEqual(JSON.parse(init!.body as string), { textQuery: "hotel Boston", pageSize: 8 });
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-Goog-Api-Key"), "test-credential");
    assert.match(headers.get("X-Goog-FieldMask")!, /places.internationalPhoneNumber/);
    assert.ok(init?.signal);
    return ok();
  });
  const response = await request(app(provider)).post("/api/places/search").send({ query: " hotel Boston " }).expect(200);
  SearchTravelPlacesResponse.parse(response.body);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.body.items[0].phone, listing.internationalPhoneNumber);
  assert.equal(response.body.items[0].website, undefined);
  assert.equal(response.body.items[0].attributions[0].name, "Example provider");
  assert.equal(response.body.items[0].outcome, undefined);
  assert.equal(calls, 1);
});

test("parallel replicas and rotated credentials share exactly ten daily attempts", async () => {
  const store = counterFixture().store;
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return ok(); };
  const a = new PlacesSearch(() => "test-key-a", store, transport);
  const b = new PlacesSearch(() => "test-key-b", store, transport);
  const results = await Promise.allSettled(Array.from({ length: 22 }, (_, i) => (i % 2 ? a : b).search("hotel Boston")));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 10);
  assert.equal(calls, 10);
  for (const result of results) if (result.status === "rejected") assert.equal(result.reason.code, "PLACES_DAILY_LIMIT");
  const res = await request(app(a)).post("/api/places/search").send({ query: "hotel Boston" }).expect(429);
  assert.equal(res.body.code, "PLACES_DAILY_LIMIT");
  assert.ok(Number(res.headers["retry-after"]) > 0);
});

test("failed provider requests consume allowance and never leak errors or retry", async () => {
  let calls = 0;
  const provider = new PlacesSearch(() => "test-credential", counterFixture().store, async () => {
    calls++;
    return Response.json({ error: { message: "sensitive provider diagnostic" } }, { status: 403 });
  });
  for (let i = 0; i < 10; i++) {
    await assert.rejects(provider.search("hotel Boston"), (e: unknown) => {
      assert.equal((e as { code: string }).code, "PLACES_ACCESS_ERROR");
      assert.doesNotMatch(String(e), /sensitive|test-credential/);
      return true;
    });
  }
  await assert.rejects(provider.search("hotel Boston"), { code: "PLACES_DAILY_LIMIT" });
  assert.equal(calls, 10);
});

test("invalid inputs and missing keys cannot consume or bypass limits", async () => {
  let reservations = 0, calls = 0;
  const store: Counters = { check: async () => { reservations++; return { allowed: true, retryAfter: 0 }; } };
  const provider = new PlacesSearch(() => "test-credential", store, async () => { calls++; return ok(); });
  const server = app(provider);
  for (const body of [{}, { query: "   " }, { query: "x".repeat(121) }, { query: "hotel\nBoston" }, { query: "hotel", unexpected: true }]) {
    await request(server).post("/api/places/search").send(body).expect(400);
  }
  await request(server).post("/api/places/search").type("text").send("hotel Boston").expect(415);
  await assert.rejects(new PlacesSearch(() => undefined, store, ok).search("hotel Boston"), { code: "PLACES_NOT_CONFIGURED" });
  assert.equal(reservations, 0); assert.equal(calls, 0);
});

test("provider setup errors become fixed explanations without echoing diagnostics", async () => {
  for (const [diagnostic, expected] of [
    ["Billing has not been enabled. SECRET_DIAGNOSTIC", /requires active billing/],
    ["Places API has not been used in this project. SECRET_DIAGNOSTIC", /Enable Places API/],
    ["Requests from this HTTP referrer are blocked. SECRET_DIAGNOSTIC", /browser-restricted/],
    ["API key not valid. SECRET_DIAGNOSTIC", /rejected the API key/],
    ["API_KEY_SERVICE_BLOCKED SECRET_DIAGNOSTIC", /restrictions do not allow/],
  ] as const) {
    const provider = new PlacesSearch(() => "test-credential", counterFixture().store,
      async () => Response.json({ error: { message: diagnostic } }, { status: 403 }));
    await assert.rejects(provider.search("hotel Boston"), (e: unknown) => {
      assert.match(String(e), expected);
      assert.doesNotMatch(String(e), /SECRET_DIAGNOSTIC|test-credential/);
      return true;
    });
  }
});

test("shared counter failure blocks outbound calls; malformed responses are not empty successes", async () => {
  let calls = 0;
  const broken: Counters = { check: async () => { throw new Error("private SQL diagnostic"); } };
  await assert.rejects(new PlacesSearch(() => "test-credential", broken, async () => { calls++; return ok(); }).search("hotel Boston"), { code: "PLACES_UNAVAILABLE" });
  assert.equal(calls, 0);
  for (const transport of [
    async () => { throw new Error("test-credential network diagnostic"); },
    async () => Response.json({ error: "unexpected" }),
    async () => new Response("x".repeat(129 * 1024)),
    async () => Response.json({ places: [{ id: "broken" }] }),
  ]) {
    const provider = new PlacesSearch(() => "test-credential", counterFixture().store, transport);
    await assert.rejects(provider.search("hotel Boston"), { code: "PLACES_UNAVAILABLE" });
  }
  const empty = await new PlacesSearch(() => "test-credential", counterFixture().store, async () => Response.json({})).search("hotel Boston");
  assert.deepEqual(empty.items, []);
});

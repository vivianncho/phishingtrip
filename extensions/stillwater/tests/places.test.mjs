import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest, placeSearchBody, placesResult } from "../src/core.js";
import { showPlaces } from "../src/view.js";
import { documentMock, FakeNode } from "./fixtures.mjs";

test("Google searches are typed, bounded and separate from evidence checks", async () => {
  for (const input of ["", "ab", "x".repeat(121), "Hotel\nprivate"]) assert.throws(() => placeSearchBody(input));
  assert.deepEqual(placeSearchBody("  Hotel Cancun  "), { query: "Hotel Cancun" });
  await assert.rejects(apiRequest("https://service.example", "/places/search", { body: { query: "Hotel Cancun", pageText: "secret" } }), /Only selected/);
  const fetcher = async (_url, opts) => {
    assert.equal(opts.credentials, "omit"); assert.equal(opts.redirect, "error");
    assert.deepEqual(JSON.parse(opts.body), { query: "Hotel Cancun" });
    return new Response("", { status: 429 });
  };
  await assert.rejects(apiRequest("https://service.example", "/places/search", { body: { query: "Hotel Cancun" }, fetcher }), /10 requests daily/);
});

test("Google listings retain attribution and never become trusted HTML or green results", () => {
  const value = {
    checkedAt: new Date().toISOString(),
    items: [{ id: "place", name: "<script>unsafe()</script>", address: "City",
      phone: "+12025550146", website: "https://hotel.example",
      mapsUrl: "https://maps.google.com", attributions: [{ name: "Provider", uri: "https://provider.example" }] }],
  };
  assert.equal(placesResult(value), value);
  assert.throws(() => placesResult({ ...value, items: [{ ...value.items[0], website: "javascript:evil()" }] }));
  globalThis.document = documentMock();
  const root = new FakeNode();
  showPlaces(root, value);
  const all = n => [n, ...n.children.flatMap(all)];
  const nodes = all(root);
  assert.ok(nodes.some(n => n.textContent === "<script>unsafe()</script>"));
  assert.equal(nodes.some(n => n.tagName === "script" || n.href?.startsWith("tel:")), false);
  assert.ok(nodes.some(n => n.textContent === "Provider" && n.rel === "noopener noreferrer"));
  assert.ok(nodes.some(n => n.textContent.includes("never change Hook")));
});

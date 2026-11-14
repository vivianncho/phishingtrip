import test from "node:test";
import assert from "node:assert/strict";
import { documentMock, FakeNode, result, company } from "./fixtures.mjs";
import { showResult } from "../src/view.js";

test("popup requires consent, uploads no browsing text, clears stale verdicts and persists configuration only", async () => {
  const dom = documentMock(), requests = [], writes = [];
  globalThis.document = dom;
  globalThis.Option = class extends FakeNode { constructor(label, value) { super("option"); this.textContent = label; this.value = value; } };
  globalThis.location = { hash: "#number=%2B18002211212", pathname: "/popup.html" };
  globalThis.history = { replaceState() {} };
  globalThis.browser = {
    runtime: { id: "fixture" },
    permissions: { contains: async () => true, request: async () => true, remove: async () => true },
    storage: { local: { get: async () => ({ apiOrigin: "https://backend.example" }), set: async v => writes.push(v), remove: async () => {} } },
    tabs: { query: async () => [{ id: 1 }] },
    scripting: { executeScript: async () => [{ result: ["+18002211212", "surrounding private text"] }] },
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (options.method === "GET") return Response.json({ items: [company()], total: 1, nextOffset: null });
    return Response.json(result({ claimedCompanyId: JSON.parse(options.body).claimedCompanyId ?? null }));
  };
  await import("../src/popup.js?test");
  await new Promise(resolve => setImmediate(resolve));
  const $ = id => dom.getElementById(id);
  assert.equal(requests.length, 0, "no request on opening popup, including a prefilled number");
  assert.equal($("phone").value, "+18002211212");
  await $("check-form").fire("submit");
  assert.equal(requests.length, 0, "no request before explicit consent");
  assert.match($("error").textContent, /Confirm/);
  await $("scan").fire("click");
  assert.equal(requests.length, 0, "local discovery does not upload numbers");
  assert.equal($("candidates").children.length, 1, "prose returned by a hostile page is rejected");
  $("consent").checked = true;
  await $("check-form").fire("submit");
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].options.body), { phoneNumber: "+18002211212" });
  assert.equal($("result").className, "official_match");
  assert.equal($("hook").dataset.state, "official_match");
  assert.equal($("consent").checked, false, "each check requires fresh consent");
  $("phone").value = "+442079460018"; await $("phone").fire("input");
  assert.equal($("result").hidden, true, "editing the input removes the old official verdict");
  assert.equal($("consent").checked, false);
  await $("load-companies").fire("click");
  assert.equal(requests.length, 2);
  assert.equal($("company").children[1].value, "delta");
  $("api-origin").value = "https://new-backend.example";
  await $("setup-form").fire("submit");
  assert.deepEqual(writes, [{ apiOrigin: "https://new-backend.example" }]);
  assert.equal(writes.some(w => "phoneNumber" in w), false);

  globalThis.fetch = async () => new Response("", { status: 503 });
  $("phone").value = "+18002211212"; $("consent").checked = true;
  await $("check-form").fire("submit");
  assert.equal($("result").hidden, true);
  assert.equal($("hook").dataset.state, "not_verified");
  assert.match($("error").textContent, /unavailable/);
  assert.equal($("check").disabled, false, "failure permits retry");
});

test("evidence and alternatives render as text with source links, not HTML or dial links", () => {
  const dom = documentMock(); globalThis.document = dom;
  const root = new FakeNode();
  const good = result();
  const source = good.evidence[0];
  good.alternatives = [{
    id: "alt", companyId: "delta", number: "+18002211212", region: "US", service: "<script>steal()</script>",
    freshness: "current", sources: [source],
  }];
  good.travelGuidance = { nextSteps: ["Pause and check your original booking."] };
  showResult(root, good, company(), () => {});
  const all = node => [node, ...node.children.flatMap(all)];
  const nodes = all(root);
  assert.ok(nodes.some(n => n.textContent.includes("<script>steal()</script>")));
  assert.equal(nodes.some(n => n.tagName === "script"), false);
  assert.equal(nodes.some(n => n.href?.startsWith("tel:")), false);
  assert.ok(nodes.some(n => n.tagName === "a" && n.rel === "noopener noreferrer"));
  assert.ok(nodes.some(n => n.textContent === "Copy listed number"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { documentMock, FakeNode, result, company } from "./fixtures.mjs";
import { showResult } from "../src/view.js";

test("popup requires consent, uploads no browsing text, clears stale verdicts and persists configuration only", async () => {
  const dom = documentMock(), requests = [], writes = [], removals = [];
  let allowed = true, onRemoved;
  globalThis.document = dom;
  globalThis.Option = class extends FakeNode { constructor(label, value) { super("option"); this.textContent = label; this.value = value; } };
  globalThis.location = { hash: "#number=%2B18002211212", pathname: "/popup.html" };
  globalThis.history = { replaceState() {} };
  globalThis.browser = {
    runtime: { id: "fixture" },
    permissions: { contains: async () => allowed, request: async () => true, remove: async () => true,
      onRemoved: { addListener: listener => { onRemoved = listener; } } },
    storage: { local: { get: async () => ({ apiOrigin: "https://backend.example" }), set: async v => writes.push(v), remove: async key => removals.push(key) } },
    tabs: { query: async () => [{ id: 1 }] },
    scripting: { executeScript: async ({ files }) => [{ result: files[0] === "selection.js" ? "+18002211212" : ["+18002211212", "surrounding private text"] }] },
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
  await $("selection").fire("click");
  assert.equal($("phone").value, "+18002211212");
  assert.equal(requests.length, 0, "selection capture is not consent to send");
  $("consent").checked = true;
  await $("check-form").fire("submit");
  assert.equal(requests.length, 0, "even international numbers require an explicit country choice in the UI");
  $("country").value = "US";
  $("consent").checked = true;
  await $("check-form").fire("submit");
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].options.body), { phoneNumber: "+18002211212", defaultCountry: "US" });
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
  assert.equal($("hook").dataset.state, "error", "a failed check must not pretend an unverified result completed");
  assert.match($("error").textContent, /unavailable/);
  assert.equal($("check").disabled, false, "failure permits retry");

  let release;
  globalThis.fetch = async () => new Promise(resolve => { release = resolve; });
  $("consent").checked = true;
  const pending = $("check-form").fire("submit");
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await $("clear").fire("click");
  release(Response.json(result()));
  await pending;
  assert.equal($("phone").value, "");
  assert.equal($("result").hidden, true, "clearing an in-flight check prevents late evidence from returning");
  assert.equal($("consent").checked, false);

  $("phone").value = "+18002211212"; $("country").value = "US"; $("consent").checked = true;
  allowed = false;
  onRemoved();
  assert.equal($("consent").checked, false, "revocation invalidates consent");
  $("consent").checked = true;
  await $("check-form").fire("submit");
  assert.match($("error").textContent, /Allow access/);
  await $("disconnect").fire("click");
  assert.deepEqual(removals, ["apiOrigin"]);
  assert.equal($("phone").value, "");
  assert.match($("destination").textContent, /No evidence service/);
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

test("unverified evidence is emphasized without being mislabeled as a scam report", () => {
  globalThis.document = documentMock();
  const root = new FakeNode();
  showResult(root, result({ outcome: "not_verified", label: "Not verified",
    reason: "NO_EVIDENCE", evidence: [], freshness: "unknown" }), null, () => {});
  assert.equal(root.className, "not_verified");
  assert.ok(root.children.some(n => n.tagName === "strong" &&
    n.className === "unverified-warning" && n.textContent === "Pause before calling."));
  assert.ok(root.children.some(n => n.textContent.includes("not proof of a scam")));
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { documentMock, FakeNode, result } from "./fixtures.mjs";

test("consumer packages use the fixed service without API setup, stored overrides or automatic requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "phishing-trip-managed-"));
  try {
    await cp(new URL("../src/", import.meta.url), dir, { recursive: true });
    await writeFile(join(dir, "package.json"), '{"type":"module"}');
    await writeFile(join(dir, "settings.js"), 'export const DEFAULT_API_ORIGIN="https://public.example"; export const MANAGED_SERVICE=true;');
    const dom = documentMock(), requests = [];
    let allowed = true;
    globalThis.document = dom;
    globalThis.Option = class extends FakeNode {};
    globalThis.location = { hash: "", pathname: "/popup.html" };
    globalThis.history = { replaceState() {} };
    globalThis.browser = {
      runtime: { id: "fixture" },
      permissions: { contains: async () => allowed, onRemoved: { addListener() {} },
        request: async () => { throw new Error("Consumer setup must not request a custom service"); } },
      storage: { local: { get: async () => ({ apiOrigin: "https://old-developer-override.example" }) } },
    };
    globalThis.fetch = async (url, options) => { requests.push({ url, options }); return Response.json(result()); };
    await import(pathToFileURL(join(dir, "popup.js")));
    await new Promise(resolve => setImmediate(resolve));
    const $ = id => dom.getElementById(id);
    assert.equal(requests.length, 0);
    assert.equal($("setup-form").hidden, true);
    assert.equal($("disconnect").hidden, true);
    assert.equal($("settings-toggle").textContent, "Privacy");
    assert.match($("destination").textContent, /https:\/\/public.example/);
    $("phone").value = "+18002211212"; $("country").value = "US"; $("consent").checked = true;
    await $("check-form").fire("submit");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://public.example/api/checks");
    allowed = false; $("consent").checked = true;
    await $("check-form").fire("submit");
    assert.equal(requests.length, 1);
    assert.match($("error").textContent, /browser's extension settings/);
    assert.equal($("hook").dataset.state, "error");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

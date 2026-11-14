import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { packageArguments } from "../scripts/package-safari.mjs";
import { apiRequest, capabilities } from "../src/core.js";

test("selected-number capture never reads the page or sends a request", async () => {
  const script = await readFile(new URL("../src/selection.js", import.meta.url), "utf8");
  const capture = selection => vm.runInNewContext(script, {
    window: { getSelection: () => ({ toString: () => selection }) },
    get document() { throw new Error("Selection-only capture must not inspect the page"); },
    fetch() { throw new Error("No local capture may use network"); },
  });
  assert.equal(capture(" +44 20 7946 0018 "), "+44 20 7946 0018");
  for (const text of ["", "Call +44 20 7946 0018", "https://example.com/1234567", "+18002211212 ext 4", "1".repeat(65)]) {
    assert.equal(capture(text), null);
  }
});

test("native packaging creates a separate iOS Swift app and extension without overwriting or signing", () => {
  const args = packageArguments("/resources", "/destination", "com.company.Stillwater");
  assert.ok(args.includes("--ios-only"));
  assert.ok(args.includes("--swift"));
  assert.ok(args.includes("--copy-resources"));
  assert.ok(!args.includes("--force"));
  assert.equal(args[0], "safari-web-extension-packager");
  assert.throws(() => packageArguments("/resources", "/destination", "bad/id"));
});

test("transport refuses browsing extras even if passed by another controller", async () => {
  let calls = 0;
  for (const field of ["url", "pageText", "history", "selectedText"]) {
    await assert.rejects(apiRequest("https://backend.example", "/checks", {
      body: { phoneNumber: "+18002211212", [field]: "private" },
      fetcher: async () => { calls++; },
    }), /Only selected/);
  }
  assert.equal(calls, 0);
});

test("availability is fetched without a number and reports cannot silently become active", async () => {
  const value = { providers: { directory: "active", reputation: "unavailable", metadata: "disabled" },
    checkedAt: new Date().toISOString(), limitations: ["Not a safety guarantee."], reputationReportsAvailable: false };
  const response = await apiRequest("https://backend.example", "/capabilities", {
    fetcher: async (url, options) => {
      assert.equal(url, "https://backend.example/api/capabilities");
      assert.equal(options.method, "GET");
      assert.equal(options.body, undefined);
      assert.equal(options.credentials, "omit");
      return Response.json(value);
    },
  });
  assert.equal(capabilities(response).providers.reputation, "unavailable");
  assert.throws(() => capabilities({ ...value, reputationReportsAvailable: true }));
  assert.throws(() => capabilities({ ...value, checkedAt: "invented" }));
});

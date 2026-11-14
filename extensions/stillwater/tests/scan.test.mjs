import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../src/scan.js", import.meta.url), "utf8");
function scan(selection, texts, links = []) {
  let cursor = 0;
  return Array.from(vm.runInNewContext(script, {
    window: { getSelection: () => ({ toString: () => selection }) },
    document: {
      body: {}, documentElement: {},
      querySelectorAll: () => links.map(value => ({ getClientRects: () => [1], getAttribute: () => `tel:${value}` })),
      createTreeWalker: () => ({ nextNode: () => cursor < texts.length ? { textContent: texts[cursor++] } : null }),
    },
    getComputedStyle: () => ({ visibility: "visible" }),
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
  }));
}
test("discovery returns only bounded candidates, never surrounding AI answer or selected prose", () => {
  const candidates = scan("Secret booking reference text +1 800 221 1212",
    ["AI answer: You should call +1 (800) 221-1212 to change your trip. Private booking name Jane."],
    ["+18002211212", "%malformed", "+18002211212?private=context"]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0], "+18002211212");
  assert.ok(!candidates.join("").includes("Jane"));
  const many = scan("", Array.from({ length: 40 }, (_, i) => `+1 202 555 ${String(1000 + i).padStart(4, "0")}`));
  assert.equal(many.length, 20);
});
test("a selected complete number is preferred without a network call", () => {
  assert.deepEqual(scan("+44 20 7946 0018", ["Other contact: +1 800 221 1212"]), ["+44 20 7946 0018", "+1 800 221 1212"]);
});

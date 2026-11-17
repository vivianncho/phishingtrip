import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/inline.js", import.meta.url), "utf8");

function mount(initial = "") {
  const handlers = new Map();
  let selection = initial;
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.handlers = {}; }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parent = this; }
    attachShadow() { this.shadow = new Node("shadow"); return this.shadow; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); }
  }
  const documentElement = new Node("html");
  const document = {
    documentElement,
    getElementById: id => documentElement.children.find(n => n.id === id),
    createElement: tag => new Node(tag),
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: (name, fn) => { if (handlers.get(name) === fn) handlers.delete(name); },
  };
  const context = {
    document, Element: Node,
    window: { getSelection: () => ({ toString: () => selection }) },
    chrome: { runtime: { getURL: name => `chrome-extension://fixture/${name}` } },
    // Any accidental network request is a test failure.
    fetch: () => { throw new Error("Inline helper must not send network requests"); },
  };
  vm.runInNewContext(source, context);
  const root = documentElement.children[0];
  const shadow = root.shadow;
  const tools = shadow.children.find(n => n.className === "tools");
  return {
    root, shadow, tools, handlers,
    frame: () => shadow.children.find(n => n.tagName === "iframe"),
    select: value => { selection = value; handlers.get("selectionchange")?.(); },
    rerun: () => vm.runInNewContext(source, context),
  };
}

test("explicit activation opens one local right-hand panel without sending a number", () => {
  const app = mount();
  assert.match(app.root.style.cssText, /right:12px;top:12px;bottom:12px/);
  assert.equal(app.frame().src, "chrome-extension://fixture/popup.html#mode=inline&number=");
  assert.equal(app.frame().referrerPolicy, "no-referrer");
  const original = app.frame();
  app.rerun();
  assert.equal(app.frame(), original, "repeated activation does not create duplicate panels");
});

test("selection stays local and requires a trusted click before replacing the panel", () => {
  const app = mount();
  const original = app.frame();
  app.select("+1 (800) 221-1212");
  assert.equal(app.frame(), original, "selecting a number never automatically checks it");
  app.tools.children[0].handlers.click({ isTrusted: false });
  assert.equal(app.frame(), original, "page scripts cannot trigger a check");
  app.tools.children[0].handlers.click({ isTrusted: true });
  const params = new URL(app.frame().src).hash;
  assert.match(params, /mode=inline/);
  assert.equal(new URLSearchParams(params.slice(1)).get("number"), "+1 (800) 221-1212");
  assert.equal(app.frame().src.includes("search.example"), false, "no browsing URL is sent");
});

test("prose is rejected and closing removes the helper and all page listeners", () => {
  const app = mount("Booking secret: +1 800 221 1212");
  assert.equal(new URLSearchParams(new URL(app.frame().src).hash.slice(1)).get("number"), "");
  app.tools.children[1].handlers.click();
  assert.equal(app.handlers.size, 0);
  assert.equal(app.root.parent.children.length, 0);
});

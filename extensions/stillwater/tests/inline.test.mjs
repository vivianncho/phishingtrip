import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

const source = await readFile(new URL("../src/inline.js", import.meta.url), "utf8");

function mount(initial = "", width = 1440) {
  const handlers = new Map();
  const windowHandlers = new Map();
  let selection = initial;
  let rect = { left: 220, right: 390, top: 240, bottom: 265, width: 170 };
  const posts = [];
  class Node {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.style = {}; this.handlers = {}; this.dataset = {};
    }
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
    createElementNS: (_, tag) => new Node(tag),
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: (name, fn) => { if (handlers.get(name) === fn) handlers.delete(name); },
  };
  const context = {
    document, Element: Node,
    crypto: webcrypto, Uint8Array,
    window: {
      innerWidth: width, innerHeight: 900,
      getSelection: () => ({ toString: () => selection, rangeCount: 1,
        getRangeAt: () => ({ cloneRange: () => ({ getBoundingClientRect: () => rect }) }) }),
      addEventListener: (name, fn) => windowHandlers.set(name, fn),
      removeEventListener: name => windowHandlers.delete(name),
      requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    },
    chrome: { runtime: {
      getURL: name => `chrome-extension://fixture/${name}`,
      connect: ({ name }) => {
        const port = {
          name, onMessage: { addListener(fn) { port.message = fn; } },
          onDisconnect: { addListener(fn) { port.disconnected = fn; } },
          disconnect() { this.closed = true; this.disconnected?.(); },
          deliver(data) { this.message?.(data); },
        };
        posts.push(port); return port;
      },
    } },
    // Any accidental network request is a test failure.
    fetch: () => { throw new Error("Inline helper must not send network requests"); },
  };
  vm.runInNewContext(source, context);
  const root = documentElement.children[0];
  const shadow = root.shadow;
  const tools = shadow.children.find(n => n.className === "tools");
  return {
    root, shadow, tools, handlers, windowHandlers, posts,
    swimmer: shadow.children.find(n => n.className === "swimmer"),
    frame: () => shadow.children.find(n => n.tagName === "iframe"),
    select: value => { selection = value; handlers.get("selectionchange")?.(); },
    move: value => { rect = value; handlers.get("selectionchange")?.(); },
    rerun: () => vm.runInNewContext(source, context),
  };
}

test("explicit activation opens one local right-hand panel without sending a number", () => {
  const app = mount();
  assert.match(app.root.style.cssText, /right:12px;top:12px;bottom:12px/);
  const params = new URLSearchParams(new URL(app.frame().src).hash.slice(1));
  assert.equal(params.get("mode"), "inline"); assert.equal(params.get("number"), "");
  assert.match(params.get("channel"), /^[a-f0-9]{48}$/);
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
  app.tools.children[2].handlers.click();
  assert.equal(app.handlers.size, 0);
  assert.equal(app.root.parent.children.length, 0);
  assert.equal(app.windowHandlers.size, 0);
});

test("phone users can hide the panel to see Hook and reopen the same evidence without resetting it", () => {
  const app = mount("+1 (800) 221-1212", 402);
  const original = app.frame();
  assert.equal(app.swimmer.hidden, true, "full-width review panel has its own fish");
  app.tools.children[1].handlers.click();
  assert.equal(app.frame().hidden, true);
  assert.equal(app.swimmer.hidden, false);
  app.frame().handlers.load();
  app.posts[0].deliver({ type: "phishing-trip-state", state: "not_verified", number: "+1 (800) 221-1212" });
  assert.equal(app.swimmer.dataset.state, "not_verified");
  app.swimmer.handlers.click({ isTrusted: true });
  assert.equal(app.frame(), original, "opening evidence does not discard its result");
  assert.equal(app.frame().hidden, false);
  assert.equal(app.swimmer.hidden, true);
  const empty = mount("", 402);
  assert.equal(empty.frame().hidden, true, "initial mobile activation leaves the page selectable");
});

test("Hook swims beside the selected number and only a private current result port changes its lantern", () => {
  const app = mount("+1 (800) 221-1212");
  assert.equal(app.swimmer.hidden, false);
  assert.equal(app.swimmer.style.left, "400px");
  assert.equal(app.swimmer.dataset.state, "idle");
  app.frame().handlers.load();
  const first = app.posts[0];
  assert.match(first.name, /^phishing-trip-hook-[a-f0-9]{48}$/);
  const send = (state, number = "+1 (800) 221-1212") => first.deliver({ type: "phishing-trip-state", state, number });
  send("searching"); assert.equal(app.swimmer.dataset.state, "searching");
  send("official_match"); assert.equal(app.swimmer.dataset.state, "official_match");
  send("scam"); assert.equal(app.swimmer.dataset.state, "official_match", "unsupported verdicts are ignored");
  send("not_verified", "+1 202 555 0146"); assert.equal(app.swimmer.dataset.state, "idle", "other-number results never color this number");
  send("not_verified"); assert.equal(app.swimmer.dataset.state, "not_verified");
  assert.match(app.swimmer.children[1].textContent, /Unverified/);
  send("error"); assert.equal(app.swimmer.dataset.state, "error", "network failure is neutral");
  app.select("+1 202 555 0146");
  assert.equal(app.swimmer.dataset.state, "idle", "new selection clears old verdict");
  app.tools.children[0].handlers.click({ isTrusted: true });
  assert.equal(first.closed, true);
  send("official_match", "+1 202 555 0146");
  assert.equal(app.swimmer.dataset.state, "idle", "old frame cannot replay a result");
  app.move({ left: 20, right: 200, top: -100, bottom: -80, width: 180 });
  assert.equal(app.swimmer.hidden, true, "offscreen anchors hide the fish");
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.equal(app.windowHandlers.has("message"), false, "page-wide messages are never accepted as verdicts");
});

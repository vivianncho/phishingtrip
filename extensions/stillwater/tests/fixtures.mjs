export function result(overrides = {}) {
  const now = Date.now();
  return {
    normalizedNumber: "+18002211212", countryCode: "US", claimedCompanyId: null,
    outcome: "official_match", label: "Official match", reason: "EXACT_OFFICIAL_MATCH",
    explanation: "This exact number is listed in a current official source. Caller ID can be spoofed.",
    checkedAt: new Date(now).toISOString(), freshness: "current",
    evidence: [{
      id: "source", kind: "official_contact", companyId: "delta", number: "+18002211212",
      sourceUrl: "https://www.delta.com/us/en/need-help/overview", sourceName: "Delta official site",
      reviewedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 86400000).toISOString(),
      freshness: "current", assertion: "listed",
    }],
    alternatives: [], limitations: ["No result guarantees safety."],
    providers: { directory: "active", reputation: "unavailable", metadata: "disabled" }, metadata: null,
    ...overrides,
  };
}
export function company(overrides = {}) {
  return { id: "delta", name: "Delta Air Lines", category: "airline", website: "https://www.delta.com", contacts: [], ...overrides };
}
export class FakeNode {
  constructor(tag = "div") {
    this.tagName = tag; this.children = []; this.handlers = {}; this.value = ""; this.textContent = "";
    this.hidden = false; this.checked = false; this.disabled = false; this.dataset = {};
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  get childElementCount() { return this.children.length; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(event, listener) { (this.handlers[event] ||= []).push(listener); }
  focus() { this.focused = true; }
  async fire(event, extra = {}) {
    for (const handler of this.handlers[event] || []) await handler({ preventDefault() {}, ...extra });
  }
}
export function documentMock() {
  const nodes = new Map();
  return {
    nodes,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new FakeNode()); return nodes.get(id); },
    createElement: tag => new FakeNode(tag),
  };
}

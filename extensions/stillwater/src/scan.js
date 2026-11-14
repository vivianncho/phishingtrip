// Runs only after the traveler invokes the extension and clicks Scan.
// Never returns page text, URLs, titles, company guesses, or surrounding context.
(() => {
  const candidates = [];
  const seen = new Set();
  const add = value => {
    if (typeof value !== "string") return;
    const v = value.trim(), digits = v.replace(/\D/g, "");
    if (v.length > 64 || !/^\+?[\d ().-]+$/.test(v) || digits.length < 7 || digits.length > 15) return;
    if (!seen.has(digits) && candidates.length < 20) { seen.add(digits); candidates.push(v); }
  };
  // Prefer a deliberate selection, but only if it contains one phone number.
  add(window.getSelection()?.toString().slice(0, 65));
  for (const link of [...document.querySelectorAll('a[href^="tel:"]')].slice(0, 500)) {
    if (link.getClientRects().length && getComputedStyle(link).visibility !== "hidden") {
      const value = link.getAttribute("href").slice(4);
      try { add(decodeURIComponent(value)); } catch { /* Skip malformed links. */ }
    }
  }
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,textarea,input,select,button,[contenteditable],[aria-hidden="true"],[hidden],#stillwater-inline-root')) return NodeFilter.FILTER_REJECT;
      if (!parent.getClientRects().length || getComputedStyle(parent).visibility === "hidden") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node, count = 0, bytes = 0;
  while (candidates.length < 20 && count++ < 4000 && bytes < 200000 && (node = walker.nextNode())) {
    const value = node.textContent.slice(0, 20000);
    bytes += value.length;
    for (const match of value.matchAll(/\+?\d[\d ()\u002d.]{5,40}\d/g)) add(match[0]);
  }
  return candidates;
})();

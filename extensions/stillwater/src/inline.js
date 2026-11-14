// Opt-in, tab-scoped helper. No persistent content script or remote requests.
(() => {
  if (document.getElementById("stillwater-inline-root")) return;
  const api = globalThis.browser || globalThis.chrome;
  const root = document.createElement("div");
  root.id = "stillwater-inline-root";
  root.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;";
  const shadow = root.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}button{font:600 14px system-ui;min-height:48px;border:1px solid #d5f995;border-radius:24px;padding:10px 16px;background:#07313f;color:#d5f995;cursor:pointer}
    button:focus-visible{outline:3px solid #d5f995;outline-offset:3px}
    .tools{display:flex;gap:8px;justify-content:flex-end}.close{border-color:#85b8ad;color:#edf7ed}
    iframe{display:block;width:min(390px,calc(100vw - 24px));height:min(680px,calc(100dvh - 100px));border:1px solid #d5f995;border-radius:20px;margin-top:8px;background:#07313f;box-shadow:0 8px 40px #021f3088}
    p{font:13px system-ui;color:#edf7ed;background:#174854;padding:10px;border-radius:10px;max-width:290px}
  `;
  const tools = document.createElement("div"); tools.className = "tools";
  const check = document.createElement("button"); check.textContent = "Check selected number";
  const close = document.createElement("button"); close.textContent = "×"; close.className = "close"; close.ariaLabel = "Remove Phishing Trip from this page";
  const note = document.createElement("p");
  note.textContent = "Select one phone number in the search result or AI answer, then check it here. Nothing is uploaded yet.";
  note.setAttribute("role", "status");
  let selected = "", frame = null;
  const update = () => {
    const value = window.getSelection()?.toString().trim() || "";
    const digits = value.replace(/\D/g, "");
    selected = value.length <= 64 && /^\+?[\d ().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15 ? value : "";
    check.textContent = selected ? `Check ${selected}` : "Check selected number";
  };
  const open = value => {
    frame?.remove();
    frame = document.createElement("iframe");
    frame.title = "Phishing Trip selected-number check";
    frame.referrerPolicy = "no-referrer";
    frame.src = `${api.runtime.getURL("popup.html")}#number=${encodeURIComponent(value)}`;
    frame.setAttribute("allow", "clipboard-write");
    shadow.append(frame);
    note.textContent = "Review the selected number and country in Phishing Trip. Only the final Check button sends it.";
  };
  // Never follow the page's tel URL. The user opts in before this listener exists.
  const intercept = event => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target.closest('a[href^="tel:"]') : null;
    if (!target) return;
    let value; try { value = decodeURIComponent(target.getAttribute("href").slice(4)); } catch { return; }
    const digits = value.replace(/\D/g, "");
    if (value.length > 64 || !/^\+?[\d ().-]+$/.test(value) || digits.length < 7 || digits.length > 15) return;
    event.preventDefault(); event.stopImmediatePropagation();
    open(value);
  };
  check.addEventListener("pointerdown", event => event.preventDefault());
  check.addEventListener("click", event => {
    if (!event.isTrusted) return;
    if (selected) open(selected);
    else note.textContent = "First select just one full phone number. Or tap a phone link on this page.";
  });
  const destroy = () => {
    document.removeEventListener("selectionchange", update);
    document.removeEventListener("click", intercept, true);
    root.remove();
  };
  close.addEventListener("click", destroy);
  document.addEventListener("selectionchange", update);
  document.addEventListener("click", intercept, true);
  tools.append(check, close);
  shadow.append(style, tools, note); document.documentElement.append(root);
  return true;
})();

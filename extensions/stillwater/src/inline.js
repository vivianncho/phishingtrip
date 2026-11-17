// Opt-in, tab-scoped helper. No persistent content script or remote requests.
(() => {
  if (document.getElementById("stillwater-inline-root")) return;
  const api = globalThis.browser || globalThis.chrome;
  const root = document.createElement("div");
  root.id = "stillwater-inline-root";
  root.style.cssText = "position:fixed;right:12px;top:12px;bottom:12px;width:min(390px,calc(100vw - 24px));z-index:2147483647;pointer-events:none;";
  const shadow = root.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}[hidden]{display:none!important}button{font:600 14px system-ui;min-height:48px;border:1px solid #d5f995;border-radius:24px;padding:10px 16px;background:#07313f;color:#d5f995;cursor:pointer}
    .tools,iframe,.swimmer{pointer-events:auto}
    button:focus-visible{outline:3px solid #d5f995;outline-offset:3px}
    .tools{display:flex;gap:8px;justify-content:flex-end}.tools>button:first-child{flex:1}.close{border-color:#85b8ad;color:#edf7ed}
    iframe{display:block;width:100%;height:max(180px,calc(100dvh - 158px));border:1px solid #59877f;border-radius:20px;margin-top:8px;background:#07313f;box-shadow:0 8px 40px #021f3088}
    p{font:12px/1.4 system-ui;color:#edf7ed;background:#174854;padding:10px;border-radius:10px;margin:8px 0 0}
    .swimmer{position:fixed;left:16px;top:120px;width:132px;min-height:110px;padding:0;background:#082e3aee;border:1px solid #629e97;border-radius:30px;transition:left .65s ease,top .65s ease;box-shadow:0 6px 26px #021f3070}
    .swimmer:hover{border-color:#d5f995}.swimmer[hidden]{display:none}
    .art{display:block;position:relative;width:120px;height:100px;margin:auto;pointer-events:none;animation:hook-bob 3s ease-in-out infinite}
    .art img{position:absolute;display:block}.bulb{position:absolute;inset:0;width:100%;height:100%;display:none;filter:drop-shadow(0 0 18px var(--bulb))}
    .swimmer[data-state=official_match]{--bulb:#38c85b;--highlight:#b4edbf}
    .swimmer[data-state=not_verified],.swimmer[data-state=reports_found]{--bulb:#e53e46;--highlight:#ffb3b6}
    .swimmer[data-state=official_match] .bulb,.swimmer[data-state=not_verified] .bulb,.swimmer[data-state=reports_found] .bulb{display:block}
    .swimmer[data-state=not_verified] .fish-label,.swimmer[data-state=reports_found] .fish-label{color:#ff979c;font-weight:800}
    .swimmer[data-state=official_match] .fish-label{color:#b4edbf}
    .fish-label{display:block;padding:0 6px 10px;font:700 11px/1.35 system-ui;color:#edf7ed}
    :host([data-paused=true]) .art{animation-play-state:paused}
    @keyframes hook-bob{50%{transform:translateY(-4px) rotate(-2deg)}}
    @media(prefers-reduced-motion:reduce){.swimmer{transition:none}.art{animation:none}}
    @media(max-height:420px){iframe{height:calc(100dvh - 84px)}p{display:none}}
  `;
  const tools = document.createElement("div"); tools.className = "tools";
  const check = document.createElement("button"); check.textContent = "Check selected number";
  const close = document.createElement("button"); close.textContent = "×"; close.className = "close"; close.ariaLabel = "Remove Phishing Trip from this page";
  const collapse = document.createElement("button"); collapse.type = "button"; collapse.textContent = "Hide panel";
  const note = document.createElement("p");
  note.textContent = "Select one phone number in the search result or AI answer, then check it here. Nothing is uploaded yet.";
  note.setAttribute("role", "status");
  // All artwork is local and uses the approved original layer coordinates.
  const swimmer = document.createElement("button");
  swimmer.className = "swimmer"; swimmer.hidden = true; swimmer.type = "button";
  swimmer.dataset.state = "idle";
  const art = document.createElement("span"); art.className = "art";
  const layers = [
    ["fins", 174, 101, 269.636, 244.031],
    ["body", 77.245, 134.627, 275.822, 194.202],
    ["face", 87, 160.5, 91.403, 111.492],
    ["lantern", 40.904, 44.917, 160.632, 125.966],
  ];
  for (const [layer, x, y, width, height] of layers) {
    const img = document.createElement("img"); img.alt = "";
    img.src = api.runtime.getURL(`images/hook-figma-${layer}.svg`);
    img.draggable = false;
    img.style.cssText = `left:${x / 4.8}%;top:${y / 4}%;width:${width / 4.8}%;height:${height / 4}%;`;
    art.append(img);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "bulb"); svg.setAttribute("viewBox", "0 0 480 400"); svg.setAttribute("aria-hidden", "true");
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("transform", "translate(40.904 44.917)");
  for (const [d, fill] of [
    ["M30.0955 60.0774C35.0955 50.0774 49.0955 47.0774 61.0955 52.0774C75.0955 58.0774 80.0955 75.0774 73.0955 88.0774C67.0955 100.077 49.0955 105.077 36.0955 97.0774C23.0955 90.0774 22.0955 73.0774 30.0955 60.0774Z", "var(--bulb)"],
    ["M36.0955 65.0774C39.0955 60.0774 46.0955 57.0774 51.0955 60.0774C54.0955 62.0774 52.0955 65.0774 48.0955 67.0774C43.0955 69.0774 42.0955 75.0774 38.0955 75.0774C34.0955 75.0774 33.0955 70.0774 36.0955 65.0774Z", "var(--highlight)"],
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d); path.setAttribute("fill", fill); group.append(path);
  }
  svg.append(group); art.append(svg);
  const fishLabel = document.createElement("span"); fishLabel.className = "fish-label";
  swimmer.append(art, fishLabel);
  let selected = "", frame = null, anchor = null, anchorNumber = "", port = null, frameRevision = 0, raf = null, collapsed = false, activeNumber = "";
  const tone = state => {
    swimmer.dataset.state = state;
    const text = {
      idle: "Check this number", searching: "Checking…", official_match: "Official match · not a guarantee",
      not_verified: "Unverified · pause", reports_found: "Reports found · pause", error: "Check unavailable",
    }[state];
    fishLabel.textContent = text;
    swimmer.ariaLabel = `Hook: ${text}. Open the number check.`;
  };
  const position = () => {
    raf = null;
    if (!anchor) { swimmer.hidden = true; return; }
    let rect;
    try { rect = anchor.getBoundingClientRect(); } catch { swimmer.hidden = true; return; }
    if (!rect || !rect.width || rect.bottom < 0 || rect.top > window.innerHeight) { swimmer.hidden = true; return; }
    const width = window.innerWidth;
    const panelLeft = collapsed ? width - 12 : width - Math.min(390, width - 24) - 12;
    // On phones, Hide panel reveals the page and its anchored fish. The panel
    // keeps its sources intact and can be reopened by tapping the same Hook.
    if (panelLeft < 148) { swimmer.hidden = true; return; }
    const right = rect.right + 10;
    const left = right + 132 < panelLeft ? right : Math.max(8, Math.min(panelLeft - 140, rect.left - 140));
    const beside = left + 132 < rect.left || left > rect.right;
    const top = beside ? rect.top - 26 : rect.bottom + 10;
    swimmer.style.left = `${left}px`;
    swimmer.style.top = `${Math.max(70, Math.min(window.innerHeight - 145, top))}px`;
    swimmer.hidden = false;
  };
  const setCollapsed = value => {
    collapsed = value;
    if (frame) frame.hidden = value;
    note.hidden = value;
    collapse.textContent = value ? "Show panel" : "Hide panel";
    collapse.setAttribute("aria-expanded", String(!value));
    position();
  };
  const reposition = () => { if (raf === null) raf = window.requestAnimationFrame(position); };
  const bindAnchor = (node, number) => {
    anchor = node; anchorNumber = number; tone("idle"); position();
  };
  const update = () => {
    const value = window.getSelection()?.toString().trim() || "";
    const digits = value.replace(/\D/g, "");
    selected = value.length <= 64 && /^\+?[\d ().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15 ? value : "";
    check.textContent = selected ? `Check ${selected}` : "Check selected number";
    if (selected) {
      const selection = window.getSelection();
      if (selection.rangeCount) bindAnchor(selection.getRangeAt(0).cloneRange(), selected);
    } else if (value) { anchor = null; anchorNumber = ""; swimmer.hidden = true; }
  };
  const open = value => {
    activeNumber = value;
    const revision = ++frameRevision;
    port?.disconnect(); port = null;
    tone("idle");
    frame?.remove();
    frame = document.createElement("iframe");
    frame.title = "Phishing Trip selected-number check";
    frame.referrerPolicy = "no-referrer";
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, "0")).join("");
    frame.src = `${api.runtime.getURL("popup.html")}#mode=inline&number=${encodeURIComponent(value)}&channel=${token}`;
    // Browser-native messaging authenticates the sender as this extension.
    // A web page cannot create a result channel, even if it embeds popup.html
    // itself and chooses a fragment token. Never accept window messages.
    frame.addEventListener("load", () => {
      if (revision !== frameRevision) return;
      const channel = api.runtime.connect({ name: `phishing-trip-hook-${token}` }); port = channel;
      channel.onMessage.addListener(data => {
        if (revision !== frameRevision || !data || data.type !== "phishing-trip-state") return;
        const { state, number } = data;
        if (!["idle", "searching", "official_match", "not_verified", "reports_found", "error"].includes(state)) return;
        const same = typeof number === "string" && number.replace(/\D/g, "") === anchorNumber.replace(/\D/g, "");
        tone(same && anchorNumber ? state : "idle");
      });
      channel.onDisconnect.addListener(() => {
        if (revision === frameRevision) { port = null; tone("error"); }
      });
    });
    frame.setAttribute("allow", "clipboard-write");
    shadow.append(frame);
    note.textContent = "Review the selected number and country in Phishing Trip. Only the final Check button sends it.";
    setCollapsed(!value && window.innerWidth < 550);
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
    bindAnchor(target, value);
    open(value);
  };
  check.addEventListener("pointerdown", event => event.preventDefault());
  check.addEventListener("click", event => {
    if (!event.isTrusted) return;
    if (selected) open(selected);
    else note.textContent = "First select just one full phone number. Or tap a phone link on this page.";
  });
  swimmer.addEventListener("pointerdown", event => event.preventDefault());
  swimmer.addEventListener("click", event => {
    if (!event.isTrusted || !anchorNumber) return;
    if (frame && anchorNumber === activeNumber) setCollapsed(false);
    else { tone("idle"); open(anchorNumber); }
  });
  collapse.addEventListener("click", () => setCollapsed(!collapsed));
  const visibility = () => { root.dataset.paused = String(document.hidden); };
  const destroy = () => {
    frameRevision++; port?.disconnect();
    if (raf !== null) window.cancelAnimationFrame(raf);
    document.removeEventListener("selectionchange", update);
    document.removeEventListener("click", intercept, true);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("pagehide", destroy);
    root.remove();
  };
  close.addEventListener("click", destroy);
  document.addEventListener("selectionchange", update);
  document.addEventListener("click", intercept, true);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);
  window.addEventListener("pagehide", destroy, { once: true });
  tools.append(check, collapse, close);
  shadow.append(style, tools, note, swimmer); document.documentElement.append(root);
  // Activation is explicit for this document. Opening the local panel does not
  // grant consent to transmit the selected number or inspect the whole page.
  update();
  tone("idle"); visibility();
  open(selected);
  return true;
})();

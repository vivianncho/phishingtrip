import { safeHttps } from "./core.js";

// All untrusted API strings are inserted as text, never HTML.
function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = String(value);
  if (className) node.className = className;
  return node;
}
function link(label, url) {
  const node = element("a", label);
  node.href = safeHttps(url);
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  node.referrerPolicy = "no-referrer";
  return node;
}
function bullets(values) {
  const ul = element("ul");
  for (const value of values) ul.append(element("li", value));
  return ul;
}
export function showResult(root, result, selectedCompany, onCopy) {
  root.replaceChildren();
  root.hidden = false;
  root.className = result.outcome;
  root.append(element("p", "EVIDENCE, NOT A SAFETY GUARANTEE", "eyebrow"),
    element("h2", result.label), element("p", result.normalizedNumber, "number"),
    element("p", selectedCompany ? `Checked against ${selectedCompany.name}` : "No company selected. A listing match does not confirm the company you intended."),
    element("p", result.explanation),
    element("p", `Checked ${new Date(result.checkedAt).toLocaleString()}`, "muted"));
  const provider = result.providers;
  root.append(element("p", `Directory: ${provider.directory}. Reports: ${provider.reputation}. Number metadata: ${provider.metadata}.`, "muted"));

  const evidence = element("details");
  evidence.append(element("summary", "Why this result?"));
  if (!result.evidence.length) evidence.append(element("p", "No attributable evidence was returned. Unknown does not mean scam."));
  for (const source of result.evidence) {
    const entry = element("div");
    entry.append(link(source.sourceName, source.sourceUrl),
      element("p", `${source.number} · ${source.kind === "official_contact" ? "Official listing" : "Attributable report"} · ${source.assertion}`, "muted"),
      element("p", `Reviewed ${new Date(source.reviewedAt).toLocaleString()}. Expires ${new Date(source.expiresAt).toLocaleString()}. ${source.freshness}.`, "muted"));
    evidence.append(entry);
  }
  root.append(evidence);

  if (result.alternatives.length) {
    root.append(element("h3", "Another way to get help"));
    for (const contact of result.alternatives) {
      const entry = element("div");
      entry.append(element("p", `${contact.service} · ${contact.region}`), element("p", contact.number, "number"));
      const copy = element("button", "Copy listed number");
      copy.type = "button";
      copy.addEventListener("click", () => onCopy(contact.number));
      entry.append(copy);
      for (const source of contact.sources.filter(s => s.assertion === "listed" && s.freshness === "current")) {
        const sourceLine = element("p");
        sourceLine.append(link("Review the official source before calling", source.sourceUrl));
        entry.append(sourceLine);
      }
      root.append(entry);
    }
  }
  if (selectedCompany) {
    root.append(link("Open this company's official website", selectedCompany.website),
      element("p", "A central reservations number may not be a specific hotel's front desk.", "muted"));
  }
  if (result.travelGuidance && Array.isArray(result.travelGuidance.nextSteps)) {
    const guide = result.travelGuidance;
    root.append(element("h3", "One next step"), bullets(guide.nextSteps),
      element("p", "General travel advice only, not evidence about this number.", "muted"));
  }
  root.append(bullets(result.limitations));
  root.focus();
}

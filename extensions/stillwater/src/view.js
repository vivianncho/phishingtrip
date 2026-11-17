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
  if (result.outcome === "not_verified") {
    root.append(element("strong", "Pause before calling.", "unverified-warning"),
      element("p", "Red means pause—not proof of a scam. Use your booking confirmation or the company's official website."));
  }
  const provider = result.providers;
  root.append(element("p", `Directory: ${provider.directory}. Reports: ${provider.reputation}. Number metadata: ${provider.metadata}.`, "muted"));
  if (result.metadata) {
    root.append(element("p", `Number metadata fetched ${new Date(result.metadata.fetchedAt).toLocaleString()}; expires ${new Date(result.metadata.expiresAt).toLocaleString()}. Formatting/validity only, not ownership or scam evidence.`, "muted"));
  }

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
      entry.append(element("p", `Contact evidence: ${contact.freshness}. Confirm the region and service before using it.`, "muted"));
      for (const source of contact.sources) {
        const sourceLine = element("p");
        sourceLine.append(link("Review the official source before calling", source.sourceUrl),
          element("span", ` Reviewed ${new Date(source.reviewedAt).toLocaleString()}; expires ${new Date(source.expiresAt).toLocaleString()}. ${source.assertion}; ${source.freshness}.`));
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

export function showPlaces(root, result) {
  root.replaceChildren();
  const attribution = element("img");
  attribution.src = "images/google-maps-attribution.png";
  attribution.alt = "Google Maps"; attribution.width = 120;
  root.append(attribution, element("p", "Google Maps listings · not independently verified", "muted"));
  if (!result.items.length) root.append(element("p", "No listings found. Try the business's official website."));
  for (const place of result.items) {
    const entry = element("article");
    entry.append(element("h3", place.name), element("p", place.address));
    if (place.phone) entry.append(element("p", place.phone, "number"));
    if (place.website) entry.append(link("Review the listed website", place.website));
    if (place.mapsUrl) {
      const line = element("p"); line.append(link("View listing on Google Maps", place.mapsUrl)); entry.append(line);
    }
    for (const source of place.attributions) {
      const line = element("p", undefined, "muted");
      line.append(source.uri ? link(source.name, source.uri) : element("span", source.name)); entry.append(line);
    }
    root.append(entry);
  }
  root.append(element("p", "A listing may be outdated or wrong. Confirm the number on the company's own site or booking confirmation. Business searches never change Hook's evidence result.", "muted"));
}

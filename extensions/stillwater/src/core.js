export function apiOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Enter a complete HTTPS backend address."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Use an HTTPS origin only, without a path, password, query, or fragment.");
  }
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Use a published HTTPS backend, not a local address.");
  }
  return url.origin;
}

// Intentionally strict. A selection containing prose is not silently uploaded.
export function phoneCandidate(value) {
  if (typeof value !== "string") return null;
  const number = value.trim();
  if (number.length > 64 || !/^\+?[\d ().-]+$/.test(number)) return null;
  const digits = number.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? number : null;
}

export function checkBody(number, country, companyId) {
  const candidate = phoneCandidate(number);
  if (!candidate) throw new Error("Choose one complete phone number, without text or an extension.");
  const code = country.trim().toUpperCase();
  if (code && !/^[A-Z]{2}$/.test(code)) throw new Error("Enter a two-letter country code, such as US or GB.");
  if (!candidate.startsWith("+") && !code) throw new Error("Choose a country for a number without + and its country code.");
  if (companyId && !/^[a-z][a-z0-9-]{0,63}$/.test(companyId)) throw new Error("Choose a company from the directory.");
  return {
    phoneNumber: candidate,
    ...(code ? { defaultCountry: code } : {}),
    ...(companyId ? { claimedCompanyId: companyId } : {}),
  };
}

export function safeHttps(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

export function placeSearchBody(value) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Enter a business name and city using 3–120 characters. Do not include booking details.");
  }
  return { query: value.trim() };
}

export function placesResult(value) {
  if (!value || !Number.isFinite(Date.parse(value.checkedAt)) ||
      !list(value.items, p => p && text(p.id, 512) && text(p.name, 500) && text(p.address, 1000) &&
        (p.phone === undefined || text(p.phone, 64)) &&
        (p.website === undefined || !!safeHttps(p.website)) &&
        (p.mapsUrl === undefined || !!safeHttps(p.mapsUrl)) &&
        list(p.attributions, a => a && text(a.name, 500) && (a.uri === undefined || !!safeHttps(a.uri))), 8)) {
    throw new Error("The business listings could not be read. No number was verified.");
  }
  return value;
}

function text(v, max = 2000) { return typeof v === "string" && v.length <= max; }
function list(v, predicate, max = 100) { return Array.isArray(v) && v.length <= max && v.every(predicate); }
function evidence(e) {
  return e && text(e.id) && ["official_contact", "reputation_report"].includes(e.kind) &&
    (e.companyId === null || text(e.companyId)) && !!safeHttps(e.sourceUrl) && text(e.sourceName) &&
    text(e.number, 32) && Number.isFinite(Date.parse(e.reviewedAt)) && Number.isFinite(Date.parse(e.expiresAt)) &&
    ["current", "stale", "unknown"].includes(e.freshness) && ["listed", "disputed", "report"].includes(e.assertion);
}
function contact(c) {
  return c && text(c.id) && text(c.companyId) && text(c.number, 32) && /^\+[1-9]\d{6,14}$/.test(c.number) &&
    text(c.region) && text(c.service) && ["current", "stale", "unknown"].includes(c.freshness) && list(c.sources, evidence);
}
function metadata(m) {
  return m === null || (m && m.provider === "twilio_basic" && typeof m.valid === "boolean" &&
    (m.countryCode === null || text(m.countryCode, 2)) &&
    (m.nationalFormat === null || text(m.nationalFormat, 64)) &&
    Number.isFinite(Date.parse(m.fetchedAt)) && Number.isFinite(Date.parse(m.expiresAt)) &&
    Date.parse(m.expiresAt) > Date.parse(m.fetchedAt) && typeof m.cached === "boolean");
}

export const CATEGORIES = {
  airline: "Airlines", hotel: "Hotels", vacation_rental: "Vacation rentals",
  car_rental: "Car rentals", booking_service: "Booking services",
  rail_transfer: "Rail & transfers", cruise: "Cruises", tour: "Tours",
};

export function capabilities(value) {
  if (!value || !value.providers ||
      !["active", "unavailable"].includes(value.providers.directory) ||
      value.providers.reputation !== "unavailable" ||
      !["disabled", "not_configured", "available", "success", "timeout", "unavailable", "rate_limited", "budget_exhausted", "invalid_response", "partial"].includes(value.providers.metadata) ||
      !Number.isFinite(Date.parse(value.checkedAt)) ||
      !list(value.limitations, v => text(v)) || value.reputationReportsAvailable !== false) {
    throw new Error("Provider availability could not be confirmed. No number was verified.");
  }
  return value;
}

export function companyPage(value) {
  if (!value || !list(value.items, c => c && text(c.id, 64) && /^[a-z][a-z0-9-]{0,63}$/.test(c.id) &&
      text(c.name) && Object.hasOwn(CATEGORIES, c.category) && !!safeHttps(c.website) && list(c.contacts, contact), 50) ||
      !Number.isInteger(value.total) || value.total < 0 ||
      !(value.nextOffset === null || (Number.isInteger(value.nextOffset) && value.nextOffset >= 0))) {
    throw new Error("The directory response could not be read. No number was verified.");
  }
  return value;
}

export function checkResult(value, body) {
  const labels = { official_match: "Official match", reports_found: "Reports found", not_verified: "Not verified" };
  const reasons = ["EXACT_OFFICIAL_MATCH", "ATTRIBUTABLE_REPORTS", "SOURCE_CONFLICT", "STALE_EVIDENCE", "COMPANY_MISMATCH", "NO_EVIDENCE"];
  if (!value || !Object.hasOwn(labels, value.outcome) || value.label !== labels[value.outcome] ||
      !reasons.includes(value.reason) || !text(value.explanation) || !text(value.normalizedNumber, 32) ||
      !/^\+[1-9]\d{6,14}$/.test(value.normalizedNumber) ||
      !Number.isFinite(Date.parse(value.checkedAt)) ||
      value.claimedCompanyId !== (body.claimedCompanyId ?? null) ||
      !list(value.evidence, evidence) || !list(value.alternatives, contact) ||
      !metadata(value.metadata) ||
      !list(value.limitations, v => text(v)) ||
      !value.providers || !["active", "unavailable"].includes(value.providers.directory) ||
      !text(value.providers.reputation, 40) || !text(value.providers.metadata, 40)) {
    throw new Error("The check response could not be confirmed. No verdict is shown.");
  }
  // International input must never silently receive a verdict for another number.
  if (body.phoneNumber.startsWith("+") &&
      body.phoneNumber.replace(/\D/g, "") !== value.normalizedNumber.replace(/\D/g, "")) {
    throw new Error("The service returned a different number. No verdict is shown.");
  }
  if (value.outcome === "official_match" &&
      (value.reason !== "EXACT_OFFICIAL_MATCH" || value.providers.directory !== "active" ||
       !value.evidence.some(e => e.kind === "official_contact" && e.assertion === "listed" &&
         e.freshness === "current" && Date.parse(e.expiresAt) > Date.now() &&
         Date.parse(e.reviewedAt) <= Date.now() && e.number === value.normalizedNumber &&
         (!body.claimedCompanyId || e.companyId === body.claimedCompanyId)))) {
    throw new Error("No current official evidence supports this match. Check the company's own website.");
  }
  if (value.outcome === "reports_found" &&
      (value.reason !== "ATTRIBUTABLE_REPORTS" ||
       !value.evidence.some(e => e.kind === "reputation_report" && e.assertion === "report" &&
         e.freshness === "current" && Date.parse(e.expiresAt) > Date.now() &&
         e.number === value.normalizedNumber))) {
    throw new Error("No attributable report supports this result. No scam claim is shown.");
  }
  return value;
}

export async function apiRequest(origin, path, { body, fetcher = fetch, timeout = 12000 } = {}) {
  const base = apiOrigin(origin);
  if (!/^\/(?:checks|capabilities|places\/search|companies(?:\?[^#]*)?)$/.test(path)) throw new Error("Unsupported API operation.");
  if (body) {
    if (path === "/places/search" && Object.keys(body).every(key => key === "query")) {
      body = placeSearchBody(body.query);
    } else if (path === "/checks" && Object.keys(body).every(key => ["phoneNumber", "defaultCountry", "claimedCompanyId"].includes(key))) {
      body = checkBody(body.phoneNumber, body.defaultCountry ?? "", body.claimedCompanyId);
    } else {
      throw new Error("Only selected check fields can be sent.");
    }
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetcher(`${base}/api${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
      redirect: "error", signal: abort.signal,
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error(path === "/places/search" ? "Business search is limited right now. The shared Google allowance is 10 requests daily. Try the company's official website." : "A few too many checks. Wait a moment, then try again.");
      if (response.status === 400) throw new Error("Check the complete number and country, then try again.");
      if (response.status === 404) throw new Error("That company is no longer listed. Reload the directory.");
      throw new Error("The evidence service is unavailable. No number was verified.");
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("The backend did not return evidence. Check its public HTTPS address.");
    }
    // Bound the bytes read even if an upstream server ignores Content-Length.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The evidence response was empty.");
    let size = 0, raw = "";
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 512000) { await reader.cancel(); throw new Error("The evidence response was too large."); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    try { return JSON.parse(raw); } catch { throw new Error("The evidence response could not be read."); }
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The check took too long. No number was verified. Try again.");
    if (error instanceof TypeError) throw new Error("Could not reach the backend. Check its address, browser permission, and connection.");
    throw error;
  } finally { clearTimeout(timer); }
}

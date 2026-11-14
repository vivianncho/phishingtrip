import type { CheckResult, ContactService, Evidence, OfficialContact } from "@workspace/api-zod";
import { evidenceFreshness, contactFreshness } from "./directory";

// Pure decision function. Production never supplies reports: no licensed source is connected.
export function decide(number: string, claimedCompanyId: string | undefined, matches: OfficialContact[], alternatives: OfficialContact[], reports: Evidence[] = [], now = Date.now(), claimedService?: ContactService) {
  const refresh = (c: OfficialContact) => {
    const sources = c.sources.filter((e) => e.kind === "official_contact" && e.number === c.number && e.companyId === c.companyId)
      .map((e) => ({ ...e, freshness: e.freshness === "unknown" ? "unknown" as const : evidenceFreshness(e, now) }));
    return { ...c, sources, freshness: contactFreshness(sources) };
  };
  const contacts = matches.filter((c) => c.number === number).map(refresh);
  const evidence = contacts.flatMap((c) => c.sources);
  const relevant = contacts.filter((c) => !claimedCompanyId || c.companyId === claimedCompanyId);
  const scoped = relevant.filter((c) => !claimedService || c.serviceType === claimedService);
  const attributableReports = reports.filter((e) => e.kind === "reputation_report" && e.assertion === "report" &&
    e.number === number && e.id.trim() && e.sourceName.trim() && /^https:\/\/[^/]+/.test(e.sourceUrl) && evidenceFreshness(e, now) === "current");
  evidence.push(...attributableReports);
  const conflict = contacts.some((c) => c.sources.some((e) => e.assertion === "disputed")) ||
    new Set(contacts.filter((c) => c.freshness === "current").map((c) => c.companyId)).size > 1 ||
    (attributableReports.length > 0 && relevant.some((c) => c.freshness === "current"));
  let reason: CheckResult["reason"] = "NO_EVIDENCE";
  if (conflict) reason = "SOURCE_CONFLICT";
  else if (attributableReports.length) reason = "ATTRIBUTABLE_REPORTS";
  else if (scoped.some((c) => c.freshness === "current")) reason = "EXACT_OFFICIAL_MATCH";
  else if (claimedCompanyId && contacts.length && !relevant.length) reason = "COMPANY_MISMATCH";
  else if (claimedService && relevant.length && !scoped.length) reason = "SERVICE_MISMATCH";
  else if (scoped.some((c) => c.freshness === "stale")) reason = "STALE_EVIDENCE";
  const outcome: CheckResult["outcome"] = reason === "EXACT_OFFICIAL_MATCH" ? "official_match" : reason === "ATTRIBUTABLE_REPORTS" ? "reports_found" : "not_verified";
  const explanations: Record<CheckResult["reason"], string> = {
    EXACT_OFFICIAL_MATCH: "This exact number is listed in a current official source for the matched company. This does not authenticate an incoming caller.",
    ATTRIBUTABLE_REPORTS: "Attributable reports exist for this number. Reports are not a definitive fraud determination.",
    SOURCE_CONFLICT: "Sources conflict about this number. Review the evidence and use the company's own website before calling.",
    COMPANY_MISMATCH: "This number is listed for a different company or hotel property, not the listing you selected. Brand central reservations cannot verify an individual hotel's front desk. A mismatch is not proof of fraud.",
    SERVICE_MISMATCH: "This number is listed for a different service. A property main line or brand reservations number is not evidence of a direct front-desk line. Check the service label and the hotel's official website.",
    STALE_EVIDENCE: "A directory source matched, but its review has expired. Verify the contact on the company's own website.",
    NO_EVIDENCE: "There is not enough current evidence to verify this number. This is not a safety or fraud verdict.",
  };
  return { outcome, reason, label: outcome === "official_match" ? "Official match" as const : outcome === "reports_found" ? "Reports found" as const : "Not verified" as const,
    explanation: explanations[reason], evidence,
    freshness: evidence.some((e) => e.freshness === "current") ? "current" as const : evidence.some((e) => e.freshness === "stale") ? "stale" as const : "unknown" as const,
    alternatives: alternatives.map(refresh).filter((c) => (!claimedCompanyId || c.companyId === claimedCompanyId) && (!claimedService || c.serviceType === claimedService) && c.freshness === "current" &&
      !(conflict && c.number === number) && !c.sources.some((s) => s.assertion === "disputed")).slice(0, 10) };
}

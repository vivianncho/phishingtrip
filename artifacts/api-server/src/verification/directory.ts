import { db, companies, officialContacts, contactSources } from "@workspace/db";
import { asc, eq, ilike, and, sql } from "drizzle-orm";
import type { Company, OfficialContact, Evidence } from "@workspace/api-zod";
import { SOURCE_MAX_AGE_DAYS } from "./policy";

export interface Directory {
  list(search: string, category: string | undefined, limit: number, offset: number): Promise<{ items: Company[]; total: number }>;
  get(id: string): Promise<Company | null>;
  matching(number: string): Promise<OfficialContact[]>;
}

export function evidenceFreshness(e: Pick<Evidence, "reviewedAt" | "expiresAt">, now = Date.now()): Evidence["freshness"] {
  const reviewed = Date.parse(e.reviewedAt), expires = Date.parse(e.expiresAt);
  if (!Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed > now || expires <= reviewed) return "unknown";
  return now < Math.min(expires, reviewed + SOURCE_MAX_AGE_DAYS * 86400000) ? "current" : "stale";
}

export function contactFreshness(sources: Evidence[]): Evidence["freshness"] {
  if (sources.some((s) => s.assertion === "disputed")) return "unknown";
  if (sources.some((s) => s.freshness === "current" && s.assertion === "listed")) return "current";
  return sources.some((s) => s.freshness === "stale") ? "stale" : "unknown";
}

async function hydrate(rows: (typeof officialContacts.$inferSelect)[]): Promise<OfficialContact[]> {
  return Promise.all(rows.map(async (c) => {
    const raw = await db.select().from(contactSources).where(eq(contactSources.contactId, c.id)).orderBy(asc(contactSources.id));
    const sources: Evidence[] = raw.map((s) => {
      const e = { id: s.id, kind: "official_contact" as const, companyId: c.companyId,
        sourceUrl: s.sourceUrl, sourceName: s.sourceName, reviewedAt: s.reviewedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(), assertion: s.assertion, number: c.number };
      // A source must be a company's own HTTPS site, not an arbitrary attribution.
      return { ...e, freshness: evidenceFreshness(e) };
    });
    return { ...c, sources, freshness: contactFreshness(sources) };
  }));
}

export const directory: Directory = {
  async get(id) {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return null;
    const contacts = await hydrate(await db.select().from(officialContacts).where(eq(officialContacts.companyId, id)).orderBy(asc(officialContacts.id)));
    // Invalid provenance is visible but cannot support official matching.
    for (const c of contacts) {
      for (const e of c.sources) {
        try {
          const source = new URL(e.sourceUrl), official = new URL(company.website);
          if (source.protocol !== "https:" || source.hostname !== official.hostname) e.freshness = "unknown";
        } catch { e.freshness = "unknown"; }
      }
      c.freshness = contactFreshness(c.sources);
    }
    return { ...company, contacts };
  },
  async list(search, category, limit, offset) {
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    const where = and(search ? ilike(companies.name, `%${escaped}%`) : undefined,
      category ? eq(companies.category, "airline") : undefined);
    const rows = await db.select({ id: companies.id }).from(companies).where(where).orderBy(asc(companies.id)).limit(limit).offset(offset);
    const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(companies).where(where);
    const items = (await Promise.all(rows.map((r) => this.get(r.id)))).filter((c): c is Company => c !== null);
    return { items, total: count?.total ?? 0 };
  },
  async matching(number) {
    const rows = await db.select().from(officialContacts).where(eq(officialContacts.number, number));
    const ids = [...new Set(rows.map((r) => r.companyId))];
    const all = await Promise.all(ids.map((id) => this.get(id)));
    return all.flatMap((c) => c?.contacts.filter((contact) => contact.number === number) ?? []);
  },
};

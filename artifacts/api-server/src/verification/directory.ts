import { db, companies, officialContacts, contactSources, propertyAliases } from "@workspace/db";
import { asc, eq, ilike, and, or, sql, exists, isNull } from "drizzle-orm";
import type { Company, OfficialContact, Evidence } from "@workspace/api-zod";
import { evidenceFreshness, officialProvenance } from "./source-policy";
export { evidenceFreshness } from "./source-policy";

export interface Directory {
  list(search: string, category: string | undefined, limit: number, offset: number, filters?: DirectoryFilters): Promise<{ items: Company[]; total: number }>;
  get(id: string): Promise<Company | null>;
  matching(number: string): Promise<OfficialContact[]>;
}

export interface DirectoryFilters {
  listingType?: Company["listingType"];
  brandId?: string;
  city?: string;
  countryCode?: string;
}

export function contactFreshness(sources: Evidence[]): Evidence["freshness"] {
  if (sources.some((s) => s.assertion === "disputed")) return "unknown";
  if (sources.some((s) => s.freshness === "current" && s.assertion === "listed")) return "current";
  return sources.some((s) => s.freshness === "stale") ? "stale" : "unknown";
}

type Database = Pick<typeof db, "select">;
async function hydrate(rows: (typeof officialContacts.$inferSelect)[], database: Database): Promise<OfficialContact[]> {
  return Promise.all(rows.map(async (c) => {
    const raw = await database.select().from(contactSources).where(eq(contactSources.contactId, c.id)).orderBy(asc(contactSources.id));
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

export function createDirectory(database: Database = db): Directory {
return {
  async get(id) {
    const [company] = await database.select().from(companies).where(eq(companies.id, id));
    if (!company) return null;
    const contacts = await hydrate(await database.select().from(officialContacts).where(eq(officialContacts.companyId, id)).orderBy(asc(officialContacts.id)), database);
    // Invalid provenance is visible but cannot support official matching.
    for (const c of contacts) {
      for (const e of c.sources) {
        if (!officialProvenance(e.sourceUrl, company.website)) e.freshness = "unknown";
      }
      c.freshness = contactFreshness(c.sources);
    }
    const { propertyBrandType: _internalBrandType, ...identity } = company;
    return { ...identity, contacts };
  },
  async list(search, category, limit, offset, filters = {}) {
    const escape = (value: string) => value.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escape(search)}%`;
    // EXISTS preserves one result per exact property even when several aliases
    // match. City filters use only city aliases, never a hotel-name alias.
    const aliasMatch = (value: string, kind?: "city") => and(
      eq(companies.listingType, "property"),
      exists(database.select({ id: propertyAliases.id }).from(propertyAliases).where(and(
        eq(propertyAliases.companyId, companies.id),
        isNull(propertyAliases.retiredAt),
        kind ? eq(propertyAliases.kind, kind) : undefined,
        ilike(propertyAliases.value, value),
      ))),
    );
    const where = and(search ? or(...[companies.name, companies.city, companies.address, companies.propertyCode, companies.subdivision].map((column) => ilike(column, pattern)), aliasMatch(pattern)) : undefined,
      category ? eq(companies.category, category as Company["category"]) : undefined,
      filters.listingType ? eq(companies.listingType, filters.listingType) : undefined,
      filters.brandId ? eq(companies.brandId, filters.brandId) : undefined,
      filters.city ? or(ilike(companies.city, escape(filters.city)), aliasMatch(escape(filters.city), "city")) : undefined,
      filters.countryCode ? eq(companies.countryCode, filters.countryCode) : undefined);
    const rows = await database.select({ id: companies.id }).from(companies).where(where).orderBy(asc(companies.id)).limit(limit).offset(offset);
    const [count] = await database.select({ total: sql<number>`count(*)::int` }).from(companies).where(where);
    const items = (await Promise.all(rows.map((r) => this.get(r.id)))).filter((c): c is Company => c !== null);
    return { items, total: count?.total ?? 0 };
  },
  async matching(number) {
    const rows = await database.select().from(officialContacts).where(eq(officialContacts.number, number));
    const ids = [...new Set(rows.map((r) => r.companyId))];
    const all = await Promise.all(ids.map((id) => this.get(id)));
    return all.flatMap((c) => c?.contacts.filter((contact) => contact.number === number) ?? []);
  },
};
}
export const directory = createDirectory();

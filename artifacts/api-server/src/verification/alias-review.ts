import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, companies, propertyAliases, propertyAliasReviews } from "@workspace/db";
import type { CompanyRow, PropertyAliasRow } from "@workspace/db";
import { officialProvenance } from "./source-policy";

type Database = Pick<typeof db, "select" | "transaction">;
type Subject = { alias: PropertyAliasRow; company: CompanyRow };
export class AliasReviewError extends Error {}

export function exactPropertyAliasProvenance(sourceUrl: string, property: CompanyRow): boolean {
  if (property.listingType !== "property" || !property.propertyCode ||
      !officialProvenance(sourceUrl, property.website)) return false;
  // Deliberately limited to the directory's supported official hotel URL format.
  // Brand/home pages and another property's page cannot establish a spelling.
  return new URL(sourceUrl).pathname.toLowerCase()
    .includes(`/hotels/${property.propertyCode.toLowerCase()}-`);
}

export function aliasFingerprint({ alias, company }: Subject): string {
  return createHash("sha256").update(JSON.stringify([
    alias.id, alias.companyId, alias.kind, alias.value, alias.locale, alias.sourceUrl,
    alias.reviewedAt, alias.retiredAt, company.id, company.listingType,
    company.propertyCode, company.website, company.name, company.city,
  ])).digest("hex");
}

export async function listPropertyAliases(companyId?: string, database: Database = db) {
  const rows = await database.select({ alias: propertyAliases, company: companies })
    .from(propertyAliases).innerJoin(companies, eq(propertyAliases.companyId, companies.id))
    .where(companyId ? eq(companies.id, companyId) : undefined).orderBy(asc(propertyAliases.id));
  return rows.map((subject) => ({ ...subject,
    status: subject.alias.retiredAt ? "retired" : "active",
    expectedFingerprint: aliasFingerprint(subject) }));
}

const baseInput = {
  aliasId: z.string().trim().min(1).max(200),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  reviewer: z.string().trim().min(2).max(100),
  note: z.string().trim().min(10).max(2000),
  confirmedHumanReview: z.literal(true),
  sourceUrl: z.string().url().max(2000),
  reviewedAt: z.string().datetime({ offset: true }).transform((s) => new Date(s)),
};
export const aliasReviewInput = z.discriminatedUnion("action", [
  z.object({ ...baseInput, action: z.literal("review") }).strict(),
  z.object({ ...baseInput, action: z.literal("retire") }).strict(),
  z.object({ ...baseInput, action: z.literal("replace"), value: z.string().trim().min(1).max(500) }).strict(),
]);

export async function recordAliasReview(input: unknown, database: Database = db) {
  const review = aliasReviewInput.parse(input);
  return database.transaction(async (tx) => {
    const [subject] = await tx.select({ alias: propertyAliases, company: companies })
      .from(propertyAliases).innerJoin(companies, eq(propertyAliases.companyId, companies.id))
      .where(eq(propertyAliases.id, review.aliasId)).for("update");
    if (!subject) throw new AliasReviewError("Alias not found");
    const { alias, company } = subject;
    if (review.expectedFingerprint !== aliasFingerprint(subject)) {
      throw new AliasReviewError("Alias changed; reload alias-list before reviewing");
    }
    if (alias.retiredAt) throw new AliasReviewError("Retired aliases cannot be reviewed or reactivated");
    if (!exactPropertyAliasProvenance(review.sourceUrl, company)) {
      throw new AliasReviewError("Alias URL must be an official HTTPS page for this exact property");
    }
    const recordedAt = new Date();
    if (review.reviewedAt > recordedAt || review.reviewedAt <= alias.reviewedAt) {
      throw new AliasReviewError("Spelling review must be newer and not future-dated");
    }
    if (review.action === "replace" && review.value === alias.value) {
      throw new AliasReviewError("Replacement spelling must differ; use review to confirm a spelling");
    }
    let replacement: PropertyAliasRow | undefined;
    if (review.action === "replace") {
      [replacement] = await tx.insert(propertyAliases).values({
        id: randomUUID(), companyId: alias.companyId, kind: alias.kind, locale: alias.locale,
        value: review.value, sourceUrl: review.sourceUrl, reviewedAt: review.reviewedAt,
      }).returning();
    }
    // Preserve the retired spelling's original URL, locale and review timestamp.
    const [updated] = await tx.update(propertyAliases).set(review.action === "review" ? {
      sourceUrl: review.sourceUrl, reviewedAt: review.reviewedAt,
    } : { retiredAt: recordedAt }).where(eq(propertyAliases.id, alias.id)).returning();
    const auditId = randomUUID();
    await tx.insert(propertyAliasReviews).values({
      id: auditId, aliasId: alias.id, action: review.action, reviewer: review.reviewer,
      // Record the retirement decision's official provenance without overwriting the old spelling.
      note: review.note, sourceUrl: review.sourceUrl, reviewedAt: review.reviewedAt,
      recordedAt, before: alias, after: updated!,
      replacementId: replacement?.id,
    });
    return { auditId, alias: updated, replacement: replacement ?? null };
  });
}

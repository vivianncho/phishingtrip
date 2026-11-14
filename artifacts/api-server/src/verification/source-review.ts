import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { reviewDb as db, apiDb, companies, officialContacts, contactSources, contactSourceReviews } from "@workspace/db";
import type { ContactSourceRow } from "@workspace/db";
import { SOURCE_MAX_AGE_DAYS, SOURCE_REVIEW_WARNING_DAYS } from "./policy";
import { DAY_MS, effectiveExpiry, evidenceFreshness, officialProvenance } from "./source-policy";
import { normalize } from "./normalize";

type Database = Pick<typeof db, "transaction" | "select">;
export class SourceReviewError extends Error {}
export interface ReviewSubject {
  source: ContactSourceRow;
  contact: typeof officialContacts.$inferSelect;
  company: typeof companies.$inferSelect;
}

export function reviewFingerprint(subject: ReviewSubject): string {
  // Explicit shape keeps ordering stable across DB drivers.
  const { source: s, contact: c, company: co } = subject;
  return createHash("sha256").update(JSON.stringify([
    s.id, s.contactId, s.sourceUrl, s.sourceName, s.assertion, s.reviewedAt, s.expiresAt,
    c.id, c.companyId, c.number, c.region, c.service, co.id, co.name, co.website, co.category,
  ])).digest("hex");
}

export function reviewQueueItem(subject: ReviewSubject, now = Date.now(), days = SOURCE_REVIEW_WARNING_DAYS) {
  const { source: s, contact, company } = subject;
  const freshness = evidenceFreshness({ reviewedAt: s.reviewedAt.toISOString(), expiresAt: s.expiresAt.toISOString() }, now);
  const deadline = effectiveExpiry(s.reviewedAt, s.expiresAt);
  const reasons: string[] = [];
  if (!officialProvenance(s.sourceUrl, company.website)) reasons.push("invalid_provenance");
  if (freshness === "unknown") reasons.push("invalid_dates");
  if (s.assertion === "disputed") reasons.push("disputed");
  if (freshness === "stale") reasons.push("stale");
  if (freshness === "current" && deadline <= now + days * DAY_MS) reasons.push("expiring");
  return { ...subject, effectiveExpiresAt: new Date(deadline).toISOString(), freshness, reasons,
    expectedFingerprint: reviewFingerprint({ source: s, contact, company }) };
}

export async function listSourceReviews(days = SOURCE_REVIEW_WARNING_DAYS, now = Date.now(), database: Database = apiDb) {
  if (!Number.isInteger(days) || days < 0 || days > SOURCE_MAX_AGE_DAYS) throw new SourceReviewError("Days must be an integer from 0 to 90");
  const rows = await database.select({ source: contactSources, contact: officialContacts, company: companies })
    .from(contactSources).innerJoin(officialContacts, eq(contactSources.contactId, officialContacts.id))
    .innerJoin(companies, eq(officialContacts.companyId, companies.id));
  return rows.map((row) => reviewQueueItem(row, now, days)).filter((row) => row.reasons.length)
    .sort((a, b) => a.effectiveExpiresAt.localeCompare(b.effectiveExpiresAt) || a.source.id.localeCompare(b.source.id));
}

const instant = z.string().datetime({ offset: true }).transform((s) => new Date(s));
export const sourceReviewInput = z.object({
  sourceId: z.string().min(1).max(200),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  reviewer: z.string().trim().min(2).max(100),
  note: z.string().trim().min(10).max(2000),
  confirmedHumanReview: z.literal(true),
  number: z.string().min(1).max(30),
  region: z.string().min(1).max(200),
  service: z.string().min(1).max(500),
  sourceUrl: z.string().url().max(2000),
  assertion: z.enum(["listed", "disputed"]),
  reviewedAt: instant,
  expiresAt: instant,
}).strict();

export function validateSourceReview(subject: ReviewSubject, input: unknown, now = Date.now()) {
  const review = sourceReviewInput.parse(input);
  const { source, contact, company } = subject;
  if (review.sourceId !== source.id || review.expectedFingerprint !== reviewFingerprint(subject)) throw new SourceReviewError("Source changed; reload the queue before reviewing");
  if (normalize(review.number).number !== review.number || review.number !== contact.number ||
      review.region !== contact.region || review.service !== contact.service) throw new SourceReviewError("Review must confirm the exact stored number, region and service");
  if (!officialProvenance(review.sourceUrl, company.website)) throw new SourceReviewError("Review URL must be on the company's own HTTPS origin");
  if (review.reviewedAt.getTime() > now || review.reviewedAt <= source.reviewedAt ||
      review.expiresAt <= review.reviewedAt ||
      review.expiresAt.getTime() > review.reviewedAt.getTime() + SOURCE_MAX_AGE_DAYS * DAY_MS) {
    throw new SourceReviewError("Review must be newer, not future-dated, with expiry within 90 days after review");
  }
  return review;
}

export async function recordSourceReview(input: unknown, database: Database = db) {
  const parsed = sourceReviewInput.parse(input);
  return database.transaction(async (tx) => {
    // A fixed-search-path, owner-controlled function locks provenance without
    // giving reviewers UPDATE access to company/contact data.
    await tx.execute(sql`select public.lock_contact_review_subject(${parsed.sourceId})`);
    const [subject] = await tx.select({ source: contactSources, contact: officialContacts, company: companies })
      .from(contactSources).innerJoin(officialContacts, eq(contactSources.contactId, officialContacts.id))
      .innerJoin(companies, eq(officialContacts.companyId, companies.id))
      .where(eq(contactSources.id, parsed.sourceId));
    if (!subject) throw new SourceReviewError("Source not found");
    const recordedAt = new Date();
    const review = validateSourceReview(subject, input, recordedAt.getTime());
    const [updated] = await tx.update(contactSources).set({
      reviewedAt: review.reviewedAt, expiresAt: review.expiresAt,
      sourceUrl: review.sourceUrl, assertion: review.assertion,
    }).where(eq(contactSources.id, review.sourceId)).returning();
    const auditId = randomUUID();
    await tx.insert(contactSourceReviews).values({
      id: auditId, sourceId: review.sourceId, reviewer: review.reviewer, note: review.note, recordedAt,
      before: subject, after: { ...subject, source: updated },
    });
    return { auditId, source: updated };
  });
}

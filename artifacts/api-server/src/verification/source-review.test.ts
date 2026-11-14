import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool, companies, officialContacts, contactSources, contactSourceReviews } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DAY_MS, evidenceFreshness, officialProvenance } from "./source-policy";
import { listSourceReviews, recordSourceReview, reviewFingerprint, reviewQueueItem, validateSourceReview, type ReviewSubject } from "./source-review";
import { seedDirectory } from "./seed";
import { decide } from "./decision";
import type { OfficialContact } from "@workspace/api-zod";

after(async () => { await pool.end(); });
const now = Date.parse("2026-12-01T12:00:00Z");
function fixture(): ReviewSubject {
  return {
    company: { id: "review-fixture", name: "Fixture", website: "https://fixture.example", category: "airline" },
    contact: { id: "review-contact", companyId: "review-fixture", number: "+18002211212", region: "US", service: "Reservations" },
    source: { id: "review-source", contactId: "review-contact", sourceName: "Fixture official website",
      sourceUrl: "https://fixture.example/contact", assertion: "listed",
      reviewedAt: new Date(now - 91 * DAY_MS), expiresAt: new Date(now - DAY_MS) },
  };
}
function input(subject = fixture(), time = now) {
  return {
    sourceId: subject.source.id, expectedFingerprint: reviewFingerprint(subject),
    reviewer: "operator-fixture", note: "Manually confirmed the listed number and its scope.",
    confirmedHumanReview: true, number: subject.contact.number, region: subject.contact.region, service: subject.contact.service,
    sourceUrl: subject.source.sourceUrl, assertion: "listed",
    reviewedAt: new Date(time).toISOString(), expiresAt: new Date(time + 90 * DAY_MS).toISOString(),
  };
}
function verdict(subject: ReviewSubject, time: number) {
  const source = subject.source;
  const contact: OfficialContact = { ...subject.contact, freshness: "unknown", sources: [{
    ...source, reviewedAt: source.reviewedAt.toISOString(), expiresAt: source.expiresAt.toISOString(),
    kind: "official_contact", companyId: subject.company.id, number: subject.contact.number,
    freshness: officialProvenance(source.sourceUrl, subject.company.website)
      ? evidenceFreshness({ reviewedAt: source.reviewedAt.toISOString(), expiresAt: source.expiresAt.toISOString() }, time) : "unknown",
  }] };
  return decide(contact.number, subject.company.id, [contact], [], [], time);
}

test("expiry is strict at its boundary and capped at 90 days regardless of stored expiry", () => {
  const s = fixture();
  s.source.reviewedAt = new Date(now);
  s.source.expiresAt = new Date(now + 100 * DAY_MS);
  assert.equal(reviewQueueItem(s, now + 76 * DAY_MS - 1).reasons.length, 0);
  assert.deepEqual(reviewQueueItem(s, now + 76 * DAY_MS).reasons, ["expiring"]);
  assert.equal(verdict(s, now + 90 * DAY_MS - 1).outcome, "official_match");
  assert.equal(verdict(s, now + 90 * DAY_MS).reason, "STALE_EVIDENCE");
  assert.deepEqual(reviewQueueItem(s, now + 90 * DAY_MS).reasons, ["stale"]);
  s.source.expiresAt = new Date(now + DAY_MS);
  assert.equal(verdict(s, now + DAY_MS).reason, "STALE_EVIDENCE");
});

test("queue exposes invalid dates, bad provenance, disputes and shorter expiries without mutation", () => {
  const s = fixture();
  const original = JSON.stringify(s);
  assert.deepEqual(reviewQueueItem(s, now).reasons, ["stale"]);
  assert.equal(JSON.stringify(s), original);
  s.source.reviewedAt = new Date(now + DAY_MS);
  assert.ok(reviewQueueItem(s, now).reasons.includes("invalid_dates"));
  s.source.reviewedAt = new Date(now);
  s.source.expiresAt = new Date(now);
  assert.ok(reviewQueueItem(s, now).reasons.includes("invalid_dates"));
  s.source.expiresAt = new Date(now + DAY_MS);
  s.source.sourceUrl = "https://unrelated.example/contact";
  s.source.assertion = "disputed";
  assert.deepEqual(reviewQueueItem(s, now).reasons, ["invalid_provenance", "disputed", "expiring"]);
  for (const url of ["http://fixture.example", "https://fixture.example.evil.test", "https://user@fixture.example", "https://fixture.example:444", "bad-url"]) {
    assert.equal(officialProvenance(url, s.company.website), false);
  }
  assert.equal(officialProvenance("https://fixture.example/new-contact", s.company.website), true);
});

test("review validates human confirmation, exact contact, provenance, timestamps and concurrency", () => {
  const s = fixture(), valid = input(s);
  assert.equal(validateSourceReview(s, valid, now).assertion, "listed");
  for (const change of [
    { sourceId: "missing" }, { expectedFingerprint: "0".repeat(64) }, { confirmedHumanReview: false },
    { reviewer: " " }, { note: "short" }, { number: "+18004337300" }, { number: "8002211212" },
    { region: "GB" }, { service: "Front desk" }, { sourceUrl: "https://other.example" },
    { assertion: "report" }, { reviewedAt: new Date(now + 1).toISOString() },
    { reviewedAt: s.source.reviewedAt.toISOString() }, { reviewedAt: "yesterday" },
    { expiresAt: new Date(now).toISOString() }, { expiresAt: new Date(now + 90 * DAY_MS + 1).toISOString() },
    { fetchedAt: valid.reviewedAt },
  ]) assert.throws(() => validateSourceReview(s, { ...valid, ...change }, now), JSON.stringify(change));
  const moved = fixture();
  moved.company.website = "https://changed.example";
  assert.throws(() => validateSourceReview(moved, valid, now), /Source changed/);
  moved.company.website = s.company.website;
  moved.contact.region = "Canada";
  assert.throws(() => validateSourceReview(moved, valid, now), /Source changed/);
});

test("database review lifecycle is atomic, audited, replay-safe and preserves verdicts and other disputes", async () => {
  const rollback = new Error("rollback fixture");
  await assert.rejects(db.transaction(async (tx) => {
    const s = fixture();
    const prefix = `review-${randomUUID()}`;
    s.company.id = prefix;
    s.contact.id = `${prefix}-contact`; s.contact.companyId = prefix;
    s.source.id = `${prefix}-source`; s.source.contactId = s.contact.id;
    const time = Date.now() - 1000;
    s.source.reviewedAt = new Date(time - 91 * DAY_MS);
    s.source.expiresAt = new Date(time - DAY_MS);
    await tx.insert(companies).values(s.company);
    await tx.insert(officialContacts).values(s.contact);
    await tx.insert(contactSources).values(s.source);
    const queue = await listSourceReviews(14, time, tx);
    assert.ok(queue.some((row) => row.source.id === s.source.id && row.reasons.includes("stale")));
    const [unchanged] = await tx.select().from(contactSources).where(eq(contactSources.id, s.source.id));
    assert.deepEqual(unchanged, s.source);
    assert.equal(verdict(s, time).reason, "STALE_EVIDENCE");
    await assert.rejects(recordSourceReview({ ...input(s, time), sourceUrl: "https://unofficial.example" }, tx));
    assert.equal((await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, s.source.id))).length, 0);
    const valid = input(s, time);
    const result = await recordSourceReview(valid, tx);
    assert.equal(result.source!.reviewedAt.getTime(), time);
    const [audit] = await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, s.source.id));
    assert.equal(audit!.id, result.auditId);
    assert.equal(audit!.reviewer, valid.reviewer);
    assert.equal((audit!.before as ReviewSubject).source.assertion, "listed");
    assert.equal((audit!.after as ReviewSubject).source.reviewedAt, valid.reviewedAt);
    s.source = result.source!;
    assert.equal(verdict(s, time).outcome, "official_match");
    assert.equal((await listSourceReviews(14, time, tx)).some((row) => row.source.id === s.source.id), false);
    await assert.rejects(recordSourceReview(valid, tx), /Source changed/);
    assert.equal((await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, s.source.id))).length, 1);
    const dispute = await recordSourceReview({ ...input(s, time + 1), assertion: "disputed" }, tx);
    s.source = dispute.source!;
    assert.equal(verdict(s, time + 1).reason, "SOURCE_CONFLICT");
    assert.ok((await listSourceReviews(14, time + 1, tx)).find((row) => row.source.id === s.source.id)?.reasons.includes("disputed"));
    const resolution = await recordSourceReview(input(s, time + 2), tx);
    s.source = resolution.source!;
    assert.equal(verdict(s, time + 2).outcome, "official_match");
    const otherDispute = { ...s.source, id: `${prefix}-other-source`, assertion: "disputed" as const };
    await tx.insert(contactSources).values(otherDispute);
    const hydrated = verdict(s, time + 2).evidence[0]!;
    const contact: OfficialContact = { ...s.contact, freshness: "current", sources: [
      hydrated, { ...hydrated, id: otherDispute.id, assertion: "disputed" },
    ] };
    assert.equal(decide(s.contact.number, s.company.id, [contact], [], [], time + 2).reason, "SOURCE_CONFLICT");
    const [preservedDispute] = await tx.select().from(contactSources).where(eq(contactSources.id, otherDispute.id));
    assert.equal(preservedDispute!.assertion, "disputed");
    assert.equal(verdict(s, time + 2 + 90 * DAY_MS).reason, "STALE_EVIDENCE");
    await assert.rejects(recordSourceReview({ ...valid, sourceId: "nonexistent-review-fixture" }, tx), /Source not found/);
    assert.equal((await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, s.source.id))).length, 3);
    throw rollback;
  }), (error) => error === rollback);
});

test("seed reruns never renew review dates or erase explicit reviews and disputes", async () => {
  const rollback = new Error("rollback seed fixture");
  await assert.rejects(db.transaction(async (tx) => {
    await seedDirectory(tx);
    const id = "delta-reservations-2026-11-14";
    const [original] = await tx.select().from(contactSources).where(eq(contactSources.id, id));
    await seedDirectory(tx);
    assert.deepEqual((await tx.select().from(contactSources).where(eq(contactSources.id, id)))[0], original);
    const reviewedAt = new Date("2026-12-01T00:00:00Z");
    await tx.update(contactSources).set({ reviewedAt, expiresAt: new Date(reviewedAt.getTime() + DAY_MS), assertion: "disputed" }).where(eq(contactSources.id, id));
    await seedDirectory(tx);
    const [preserved] = await tx.select().from(contactSources).where(eq(contactSources.id, id));
    assert.equal(preserved!.reviewedAt.getTime(), reviewedAt.getTime());
    assert.equal(preserved!.expiresAt.getTime(), reviewedAt.getTime() + DAY_MS);
    assert.equal(preserved!.assertion, "disputed");
    throw rollback;
  }), (error) => error === rollback);
});

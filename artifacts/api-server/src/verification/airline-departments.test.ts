import test, { after } from "node:test";
import assert from "node:assert/strict";
import { asc, eq } from "drizzle-orm";
import { db, pool, companies, officialContacts, contactSources } from "@workspace/db";
import { airlineDepartmentSeed, airlineDepartmentReviewedAt } from "./airline-departments";
import { seedDirectory } from "./seed";
import { createDirectory } from "./directory";
import { decide } from "./decision";
import { reviewFingerprint, validateSourceReview } from "./source-review";

after(async () => { await pool.end(); });
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function rolledBack(run: (tx: Transaction) => Promise<void>) {
  const rollback = new Error("rollback airline fixtures");
  await assert.rejects(db.transaction(async tx => { await run(tx); throw rollback; }), error => error === rollback);
}

test("department imports preserve exact identity, published scope, provenance and fixed review dates", async () => {
  await rolledBack(async tx => {
    await seedDirectory(tx);
    const directory = createDirectory(tx);
    for (const entry of airlineDepartmentSeed) {
      const company = await directory.get(entry.companyId);
      assert.equal(company?.name, entry.companyName);
      const contact = company!.contacts.find(c => c.id === entry.id)!;
      assert.ok(contact);
      assert.equal(contact.number, entry.number);
      assert.equal(contact.service, entry.service);
      assert.equal(contact.region, entry.region);
      const source = contact.sources.find(s => s.id === `${entry.id}-2026-11-14`)!;
      assert.equal(source.sourceUrl, entry.sourceUrl);
      assert.equal(source.companyId, entry.companyId);
      assert.equal(source.number, entry.number);
      assert.equal(source.reviewedAt, airlineDepartmentReviewedAt.toISOString());
      assert.equal(Date.parse(source.expiresAt) - Date.parse(source.reviewedAt), 90 * 86400000);
      assert.ok(entry.evidence.includes(entry.number.slice(2, 5)), "review excerpt contains the published number");
      const decision = decide(entry.number, entry.companyId, [contact], []);
      assert.equal(decision.outcome, Date.now() < Date.parse(source.expiresAt) ? "official_match" : "not_verified");
    }
    // Do not mislabel AA reservations as baggage: its reviewed baggage page
    // offers a web form, not a dedicated U.S. baggage phone contact.
    assert.ok((await directory.get("american"))!.contacts.every(c => !/baggage/i.test(c.service)));
  });
});

test("reimports never renew expired evidence, remove disputes or rewrite operator reviews", async () => {
  await rolledBack(async tx => {
    await seedDirectory(tx);
    const [baggage, united] = airlineDepartmentSeed;
    const sourceId = `${baggage.id}-2026-11-14`;
    await tx.update(contactSources).set({
      assertion: "disputed", reviewedAt: new Date("2025-01-01Z"), expiresAt: new Date("2025-02-01Z"),
    }).where(eq(contactSources.id, sourceId));
    await tx.update(contactSources).set({
      reviewedAt: new Date("2025-01-01Z"), expiresAt: new Date("2025-02-01Z"),
    }).where(eq(contactSources.id, `${united.id}-2026-11-14`));
    const snapshot = async () => ({
      contacts: await tx.select().from(officialContacts).orderBy(asc(officialContacts.id)),
      sources: await tx.select().from(contactSources).orderBy(asc(contactSources.id)),
    });
    const before = await snapshot();
    await seedDirectory(tx);
    await seedDirectory(tx);
    assert.deepEqual(await snapshot(), before);
    const directory = createDirectory(tx);
    const disputed = (await directory.get("delta"))!.contacts.find(c => c.id === baggage.id)!;
    assert.equal(disputed.freshness, "unknown");
    assert.equal(decide(baggage.number, "delta", [disputed], [disputed]).reason, "SOURCE_CONFLICT");
    assert.equal(decide(baggage.number, "delta", [disputed], [disputed]).alternatives.length, 0);
    const stale = (await directory.get("united"))!.contacts.find(c => c.id === united.id)!;
    assert.equal(stale.freshness, "stale");
    assert.equal(decide(united.number, "united", [stale], [stale]).alternatives.length, 0);
  });
});

test("department imports reject conflicting contact definitions and company identities transactionally", async () => {
  await rolledBack(async tx => {
    await seedDirectory(tx);
    const entry = airlineDepartmentSeed[0];
    await tx.update(officialContacts).set({ service: "Reservations" }).where(eq(officialContacts.id, entry.id));
    const before = await tx.select().from(contactSources).orderBy(asc(contactSources.id));
    await assert.rejects(seedDirectory(tx), /Airline department contact conflict/);
    assert.deepEqual(await tx.select().from(contactSources).orderBy(asc(contactSources.id)), before);
    await tx.update(officialContacts).set({ service: entry.service }).where(eq(officialContacts.id, entry.id));
    await tx.update(companies).set({ name: "Different airline" }).where(eq(companies.id, entry.companyId));
    await assert.rejects(seedDirectory(tx), /Airline department company identity conflict/);
  });
});

test("department renewals require exact service and official provenance through the existing review workflow", async () => {
  await rolledBack(async tx => {
    await seedDirectory(tx);
    const entry = airlineDepartmentSeed[0];
    const [company] = await tx.select().from(companies).where(eq(companies.id, entry.companyId));
    const [contact] = await tx.select().from(officialContacts).where(eq(officialContacts.id, entry.id));
    const [source] = await tx.select().from(contactSources).where(eq(contactSources.id, `${entry.id}-2026-11-14`));
    const subject = { company: company!, contact: contact!, source: source! };
    const reviewedAt = new Date(airlineDepartmentReviewedAt.getTime() + 1000).toISOString();
    const review = {
      sourceId: source!.id, expectedFingerprint: reviewFingerprint(subject), reviewer: "Test reviewer",
      note: "Fixture confirms exact department and region", confirmedHumanReview: true,
      number: entry.number, region: entry.region, service: entry.service, sourceUrl: entry.sourceUrl,
      assertion: "listed", reviewedAt, expiresAt: new Date(Date.parse(reviewedAt) + 86400000).toISOString(),
    };
    assert.doesNotThrow(() => validateSourceReview(subject, review, Date.parse(reviewedAt)));
    assert.throws(() => validateSourceReview(subject, { ...review, service: "Reservations" }, Date.parse(reviewedAt)), /exact stored/);
    assert.throws(() => validateSourceReview(subject, { ...review, sourceUrl: "https://maps.google.com/place/delta" }, Date.parse(reviewedAt)), /own HTTPS origin/);
    await tx.update(contactSources).set({ sourceUrl: "https://maps.google.com/place/delta" }).where(eq(contactSources.id, source!.id));
    assert.equal((await createDirectory(tx).get("delta"))!.contacts.find(c => c.id === entry.id)!.freshness, "unknown");
  });
});

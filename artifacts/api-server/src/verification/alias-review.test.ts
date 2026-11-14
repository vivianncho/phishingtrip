import test, { after } from "node:test";
import assert from "node:assert/strict";
import { eq, asc } from "drizzle-orm";
import { db, pool, companies, propertyAliases, propertyAliasReviews,
  officialContacts, contactSources, contactSourceReviews } from "@workspace/db";
import { aliasFingerprint, listPropertyAliases, recordAliasReview } from "./alias-review";
import { createDirectory } from "./directory";
import { seedDirectory } from "./seed";

after(() => pool.end());
const rollback = new Error("rollback spelling maintenance test");
const aliasId = "nycmq-city-es";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function subject(tx: Tx, id = aliasId) {
  const [row] = await tx.select({ alias: propertyAliases, company: companies })
    .from(propertyAliases).innerJoin(companies, eq(propertyAliases.companyId, companies.id))
    .where(eq(propertyAliases.id, id));
  assert.ok(row);
  return row;
}
async function prepare(tx: Tx, id = aliasId) {
  // Fixed seed reviews can be later than the test machine's clock.
  await tx.update(propertyAliases).set({ reviewedAt: new Date("2020-01-01T00:00:00Z") })
    .where(eq(propertyAliases.id, id));
}
async function input(tx: Tx, action: "review" | "replace" | "retire", id = aliasId) {
  const row = await subject(tx, id);
  return {
    action, aliasId: id, expectedFingerprint: aliasFingerprint(row),
    reviewer: "Directory operator", note: "Read the exact official property spelling.",
    confirmedHumanReview: true, sourceUrl: row.alias.sourceUrl,
    reviewedAt: new Date().toISOString(),
  };
}
async function evidence(tx: Tx) {
  return {
    companies: await tx.select().from(companies).orderBy(asc(companies.id)),
    contacts: await tx.select().from(officialContacts).orderBy(asc(officialContacts.id)),
    sources: await tx.select().from(contactSources).orderBy(asc(contactSources.id)),
    history: await tx.select().from(contactSourceReviews).orderBy(asc(contactSourceReviews.id)),
  };
}

test("review, replace and retire preserve property identity and all telephone evidence across seed reruns", async () => {
  await assert.rejects(db.transaction(async (tx) => {
    await prepare(tx);
    const original = await subject(tx);
    const before = await evidence(tx);
    const directory = createDirectory(tx);
    const review = await input(tx, "review");
    // Leave room for the replacement review even on a fast machine.
    review.reviewedAt = new Date(Date.now() - 2000).toISOString();
    const refreshed = await recordAliasReview(review, tx);
    assert.equal(refreshed.alias!.locale, original.alias.locale);
    assert.equal(refreshed.alias!.sourceUrl, original.alias.sourceUrl);
    await assert.rejects(recordAliasReview(review, tx), /changed/);
    const replace = { ...await input(tx, "replace"), value: "Nueva denominación de prueba" };
    replace.reviewedAt = new Date(Date.now() - 1000).toISOString();
    const result = await recordAliasReview(replace, tx);
    assert.ok(result.alias!.retiredAt);
    assert.ok(result.replacement);
    assert.equal(result.alias!.value, original.alias.value);
    assert.equal(result.alias!.sourceUrl, original.alias.sourceUrl);
    assert.equal(result.replacement.locale, original.alias.locale);
    assert.equal(result.replacement.sourceUrl, replace.sourceUrl);
    assert.equal(result.replacement.companyId, original.company.id);
    assert.equal(result.replacement.kind, "city");
    assert.equal((await directory.list("Nueva York", undefined, 20, 0)).total, 0);
    assert.equal((await directory.list("", undefined, 20, 0, { city: "Nueva York" })).total, 0);
    assert.equal((await directory.list(replace.value, undefined, 20, 0)).items[0]!.id, original.company.id);
    assert.equal((await directory.list("", undefined, 20, 0, { city: replace.value })).total, 1);
    await seedDirectory(tx);
    assert.equal((await directory.list("Nueva York", undefined, 20, 0)).total, 0);
    await recordAliasReview(await input(tx, "retire", result.replacement.id), tx);
    assert.equal((await directory.list(replace.value, undefined, 20, 0)).total, 0);
    assert.equal((await directory.list("", undefined, 20, 0, { city: replace.value })).total, 0);
    await assert.rejects(recordAliasReview(await input(tx, "review"), tx), /Retired/);
    assert.deepEqual(await evidence(tx), before);
    const history = await tx.select().from(propertyAliasReviews)
      .where(eq(propertyAliasReviews.aliasId, aliasId));
    assert.equal(history.length, 2);
    assert.ok(history.some((r) => r.action === "replace" && r.replacementId === result.replacement!.id));
    const listed = await listPropertyAliases(original.company.id, tx);
    assert.ok(listed.some((r) => r.alias.id === aliasId && r.status === "retired"));
    throw rollback;
  }), (error) => error === rollback);
});

test("invalid provenance, stale edits and invalid review payloads never mutate aliases", async () => {
  await assert.rejects(db.transaction(async (tx) => {
    await prepare(tx);
    const valid = await input(tx, "review");
    const before = await subject(tx);
    const invalid = [
      { ...valid, sourceUrl: "https://www.marriott.com/" },
      { ...valid, sourceUrl: "https://www.marriott.com/ja/hotels/sfodt-san-francisco-marriott-marquis/overview/" },
      { ...valid, sourceUrl: valid.sourceUrl.replace("https:", "http:") },
      { ...valid, sourceUrl: valid.sourceUrl.replace("www.marriott.com", "evil.example") },
      { ...valid, expectedFingerprint: "0".repeat(64) },
      { ...valid, reviewedAt: before.alias.reviewedAt.toISOString() },
      { ...valid, reviewedAt: new Date(Date.now() + 60000).toISOString() },
      { ...valid, confirmedHumanReview: false },
      { ...valid, reviewer: " " }, { ...valid, note: "" },
      { ...valid, locale: "en" }, { ...valid, companyId: "marriott-sfodt" },
      { ...valid, action: "replace", value: before.alias.value },
      { ...valid, action: "replace", value: " " },
      { ...valid, aliasId: "missing-alias" },
    ];
    for (const payload of invalid) await assert.rejects(recordAliasReview(payload, tx));
    assert.deepEqual(await subject(tx), before);
    assert.deepEqual(await tx.select().from(propertyAliasReviews)
      .where(eq(propertyAliasReviews.aliasId, aliasId)), []);
    throw rollback;
  }), (error) => error === rollback);
});

test("name replacements stop matching the retired spelling and retain the exact ID", async () => {
  await assert.rejects(db.transaction(async (tx) => {
    const id = "nycmq-name-ja";
    await prepare(tx, id);
    const original = await subject(tx, id);
    const result = await recordAliasReview({ ...await input(tx, "replace", id), value: "改称テストホテル" }, tx);
    const directory = createDirectory(tx);
    assert.equal((await directory.list(original.alias.value, undefined, 20, 0)).total, 0);
    assert.equal((await directory.list(result.replacement!.value, undefined, 20, 0)).items[0]!.id, original.company.id);
    assert.equal((await directory.list("", undefined, 20, 0, { city: result.replacement!.value })).total, 0);
    throw rollback;
  }), (error) => error === rollback);
});

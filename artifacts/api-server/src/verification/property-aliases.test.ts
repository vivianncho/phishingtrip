import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Router } from "express";
import pino from "pino";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, propertyAliases, contactSources, companies } from "@workspace/db";
import { ListCompaniesResponse, CheckNumberResponse } from "@workspace/api-zod";
import { createApp } from "../app";
import { verificationRouter } from "../routes/verification";
import { directory } from "./directory";
import { propertyAliasSeed, seedDirectory } from "./seed";

const app = createApp({
  logger: pino({ level: "silent" }),
  router: Router().use(verificationRouter(directory, {
    status: () => "disabled",
    lookup: async () => ({ status: "disabled", metadata: null }),
  })),
});
after(async () => { await pool.end(); });

async function search(query: Record<string, string | number>) {
  const { body } = await request(app).get("/api/companies").query(query).expect(200);
  return ListCompaniesResponse.parse(body);
}
const ids = (page: Awaited<ReturnType<typeof search>>) => page.items.map((c) => c.id);

test("official local names and city spellings return the original exact properties", async () => {
  for (const [term, id] of [
    ["ニューヨーク・マリオット・マーキス", "marriott-nycmq"],
    ["サンフランシスコ・マリオット・マーキス", "marriott-sfodt"],
    ["ニューヨーク", "marriott-nycmq"],
    ["サンフランシスコ", "marriott-sfodt"],
    ["NUEVA YORK", "marriott-nycmq"],
  ]) {
    const page = await search({ search: term!, listingType: "property" });
    assert.deepEqual(ids(page), [id]);
    assert.equal(page.total, 1); // City and name aliases both match; no duplicates.
    assert.equal(page.items[0]!.contacts[0]!.companyId, id);
  }
  for (const [city, id] of [
    ["ニューヨーク", "marriott-nycmq"],
    ["nueva york", "marriott-nycmq"],
    ["サンフランシスコ", "marriott-sfodt"],
  ]) {
    assert.deepEqual(ids(await search({ city: city!, brandId: "marriott", countryCode: "US" })), [id]);
  }
});

test("ambiguous local names retain both identities and deterministic pagination", async () => {
  const query = { search: "マリオット・マーキス", listingType: "property" };
  const all = await search(query);
  assert.equal(all.total, 2);
  assert.deepEqual(ids(all), ["marriott-nycmq", "marriott-sfodt"]);
  const first = await search({ ...query, limit: 1 });
  const second = await search({ ...query, limit: 1, offset: 1 });
  assert.deepEqual([...ids(first), ...ids(second)], ids(all));
  assert.equal(first.total, 2);
  assert.equal(first.nextOffset, 1);
  assert.equal(second.total, 2);
  assert.equal(second.nextOffset, null);
  assert.deepEqual(ids(await search({ ...query, city: "サンフランシスコ" })), ["marriott-sfodt"]);
  assert.deepEqual(ids(await search({ ...query, city: "Nueva York" })), ["marriott-nycmq"]);
});

test("aliases obey literal matching, city scope and all existing filters", async () => {
  const queries: Record<string, string>[] = [
    { search: "マリオット・マーキス", category: "airline" },
    { search: "マリオット・マーキス", listingType: "brand" },
    { search: "マリオット・マーキス", brandId: "unknown-brand" },
    { search: "マリオット・マーキス", countryCode: "JP" },
    { city: "ニューヨーク・マリオット・マーキス" }, // Not a city alias.
    { city: "Nueva" }, // Exact city only, not a prefix.
    { city: "Nueva York", search: "サンフランシスコ" },
    { search: "Marriot Marqui" }, // No fuzzy expansion.
    ...["%", "_", "\\", "マリオット%", "マリオット_", "' OR 1=1 --"].map((search) => ({ search })),
    ...["%", "_", "\\"].map((city) => ({ city })),
  ];
  for (const query of queries) {
    const page = await search(query);
    assert.equal(page.total, 0, JSON.stringify(query));
    assert.deepEqual(page.items, []);
    assert.equal(page.nextOffset, null);
  }
});

test("alias discovery never verifies another property's number or accepts names as IDs", async () => {
  const found = await search({ search: "ニューヨーク・マリオット・マーキス" });
  const claimedCompanyId = found.items[0]!.id;
  for (const phoneNumber of ["+14158961600", "+18882362427"]) {
    const { body } = await request(app).post("/api/checks").send({ phoneNumber, claimedCompanyId }).expect(200);
    const check = CheckNumberResponse.parse(body);
    assert.equal(check.reason, "COMPANY_MISMATCH");
    assert.equal(check.outcome, "not_verified");
    assert.ok(check.alternatives.every((c) => c.companyId === claimedCompanyId));
  }
  await request(app).post("/api/checks").send({
    phoneNumber: "+12123981900", claimedCompanyId: "ニューヨーク・マリオット・マーキス",
  }).expect(400);
  await request(app).post("/api/checks").send({
    phoneNumber: "+12123981900", claimedCompanyId: "nycmq-name-ja",
  }).expect(404);
});

test("alias seeds retain reviewed source provenance and never renew telephone evidence", async () => {
  const rollback = new Error("rollback alias seed test");
  await assert.rejects(db.transaction(async (tx) => {
    const propertyIds = ["marriott-nycmq", "marriott-sfodt"];
    const originals = await tx.select().from(companies).where(inArray(companies.id, propertyIds));
    const sources = await tx.select().from(contactSources);
    await seedDirectory(tx);
    const originalAliases = await tx.select().from(propertyAliases);
    await seedDirectory(tx);
    assert.deepEqual(await tx.select().from(propertyAliases), originalAliases);
    assert.deepEqual(await tx.select().from(companies).where(inArray(companies.id, propertyIds)), originals);
    assert.deepEqual(await tx.select().from(contactSources), sources);
    for (const seed of propertyAliasSeed) {
      const stored = originalAliases.find((a) => a.id === seed.id)!;
      for (const [key, value] of Object.entries(seed)) {
        assert.equal(stored[key as keyof typeof stored], value);
      }
      assert.equal(stored.reviewedAt.toISOString(), "2026-11-14T21:03:04.000Z");
    }
    throw rollback;
  }), (error) => error === rollback);
});

test("seed conflicts cannot silently move an alias to a different property", async () => {
  const rollback = new Error("rollback alias conflict");
  await assert.rejects(db.transaction(async (tx) => {
    await tx.update(propertyAliases).set({ companyId: "marriott-sfodt" })
      .where(eq(propertyAliases.id, "nycmq-name-ja"));
    // Use a savepoint so the rejected seed rolls back independently.
    await assert.rejects(seedDirectory(tx), /Seed alias conflict/);
    throw rollback;
  }), (error) => error === rollback);
});

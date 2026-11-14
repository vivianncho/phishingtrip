import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool, companies, officialContacts, contactSources } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { assertPropertyIdentities, auditPropertyIdentities } from "./property-audit";
import { seedDirectory } from "./seed";
import { supportedCountryCodes } from "@workspace/db/countries";
import { directory } from "./directory";

after(async () => { await pool.end(); });

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function rolledBack(run: (tx: Transaction) => Promise<void>) {
  const rollback = new Error("rollback property fixtures");
  await assert.rejects(db.transaction(async (tx) => {
    await run(tx);
    throw rollback;
  }), (error) => error === rollback);
}

async function rejectsImport(tx: Transaction, statement: ReturnType<typeof sql>, code: string) {
  await assert.rejects(tx.transaction(async (savepoint) => {
    await savepoint.execute(statement);
  }), (error: unknown) => {
    const pgError = (error as { cause?: { code?: string }; code?: string });
    assert.equal(pgError.cause?.code ?? pgError.code, code);
    return true;
  });
}

test("direct SQL imports require complete hotel identities and a real hotel brand", async () => {
  await rolledBack(async (tx) => {
    const prefix = `identity-${randomUUID()}`;
    const brand = `${prefix}-brand`;
    await tx.insert(companies).values({
      id: brand, name: "Fixture brand", website: "https://fixture.example",
      category: "hotel", listingType: "brand",
    });
    // These imports bypass both Drizzle's insert types and seed validation.
    const valid = {
      category: "hotel", brand, code: "OFFICIAL", address: "1 Fixture Street", city: "Fixture City", country: "US",
    };
    const changes: Record<string, unknown>[] = [
      { category: "airline" }, { category: "unknown" },
      ...["brand", "code", "address", "city", "country"].flatMap((key) =>
        [null, "", " \t\n"].map((value) => ({ [key]: value }))),
      ...["ZZ", "UK", "USA", "us", " US", "US ", "United States", "U1", "ＵＳ", "AQ"].map((country) => ({ country })),
    ];
    for (const change of changes) {
      const v = { ...valid, ...change };
      await rejectsImport(tx, sql`
        INSERT INTO companies (id, name, website, category, listing_type, brand_id, property_code, address, city, country_code)
        VALUES (${`${prefix}-invalid`}, 'Fixture', 'https://fixture.example', ${v.category}, 'property',
          ${v.brand}, ${v.code}, ${v.address}, ${v.city}, ${v.country})
      `, "23514");
    }
    const property = `${prefix}-property`;
    await tx.insert(companies).values({
      id: property, name: "Fixture hotel", website: "https://fixture.example", category: "hotel",
      listingType: "property", brandId: brand, propertyCode: "OFFICIAL",
      address: "1 Fixture Street", city: "Fixture City", countryCode: "US",
    });
    const [saved] = await tx.select().from(companies).where(eq(companies.id, property));
    assert.equal(saved!.propertyBrandType, "brand");
    for (const parent of [property, `${prefix}-missing`]) {
      await rejectsImport(tx, sql`UPDATE companies SET brand_id = ${parent} WHERE id = ${property}`, "23503");
    }
    for (const [suffix, category, listingType] of [
      ["organization", "hotel", "organization"], ["other-property", "hotel", "property"], ["airline-brand", "airline", "brand"],
    ] as const) {
      const id = `${prefix}-${suffix}`;
      await tx.insert(companies).values({
        id, name: "Not a hotel brand", website: "https://fixture.example", category, listingType,
        ...(listingType === "property" ? {
          brandId: brand, propertyCode: "OTHER", address: "2 Fixture Street", city: "Fixture City", countryCode: "US",
        } : {}),
      });
      await rejectsImport(tx, sql`UPDATE companies SET brand_id = ${id} WHERE id = ${property}`, "23503");
    }
    await rejectsImport(tx, sql`UPDATE companies SET city = NULL WHERE id = ${property}`, "23514");
    await rejectsImport(tx, sql`UPDATE companies SET country_code = 'ZZ' WHERE id = ${property}`, "23514");
    await rejectsImport(tx, sql`UPDATE companies SET listing_type = 'unknown' WHERE id = ${property}`, "23514");
    await rejectsImport(tx, sql`DELETE FROM companies WHERE id = ${brand}`, "23503");
    await rejectsImport(tx, sql`UPDATE companies SET listing_type = 'organization' WHERE id = ${brand}`, "23503");
    await rejectsImport(tx, sql`UPDATE companies SET category = 'airline' WHERE id = ${brand}`, "23503");
    await rejectsImport(tx, sql`UPDATE companies SET id = ${`${brand}-renamed`} WHERE id = ${brand}`, "23503");
    await rejectsImport(tx, sql`UPDATE companies SET property_brand_type = NULL WHERE id = ${property}`, "428C9");
    assert.deepEqual(await auditPropertyIdentities(tx), []);
  });
});

test("non-property organizations keep optional locations across every travel category", async () => {
  await rolledBack(async (tx) => {
    for (const category of ["airline", "hotel", "vacation_rental", "car_rental", "booking_service", "rail_transfer", "cruise", "tour"] as const) {
      const id = `organization-${randomUUID()}`;
      await tx.insert(companies).values({ id, name: "Organization fixture", website: "https://fixture.example", category });
      const [saved] = await tx.select().from(companies).where(eq(companies.id, id));
      assert.equal(saved!.listingType, "organization");
      for (const key of ["brandId", "propertyCode", "address", "city", "countryCode", "propertyBrandType"] as const) {
        assert.equal(saved![key], null);
      }
    }
    assert.deepEqual(await auditPropertyIdentities(tx), []);
  });
});

test("direct imports reject duplicate property identities, including updates, only within the same brand", async () => {
  await rolledBack(async (tx) => {
    const prefix = `unique-${randomUUID()}`;
    const [brand, otherBrand] = [`${prefix}-brand`, `${prefix}-other-brand`];
    for (const id of [brand!, otherBrand!]) {
      await tx.insert(companies).values({
        id, name: "Fixture brand", website: "https://fixture.example", category: "hotel", listingType: "brand",
      });
    }
    const property = {
      name: "Fixture property", website: "https://fixture.example", category: "hotel" as const,
      listingType: "property" as const, brandId: brand!, propertyCode: " \tAb-01\r\n",
      address: "1 Fixture Street", city: "Fixture City", countryCode: "US",
    };
    const original = `${prefix}-original`;
    await tx.insert(companies).values({ ...property, id: original });
    for (const code of [property.propertyCode, "Ab-01", "ab-01", "\v\f AB-01 \t\r\n"]) {
      await rejectsImport(tx, sql`
        INSERT INTO companies (id, name, website, category, listing_type, brand_id, property_code, address, city, country_code)
        VALUES (${`${prefix}-duplicate`}, 'Different name and location', 'https://fixture.example',
          'hotel', 'property', ${brand}, ${code}, '99 Other Street', 'Other City', 'GB')
      `, "23505");
    }
    const other = `${prefix}-other`;
    await tx.insert(companies).values({ ...property, id: other, brandId: otherBrand! });
    await rejectsImport(tx, sql`UPDATE companies SET brand_id = ${brand} WHERE id = ${other}`, "23505");
    const distinct = `${prefix}-distinct`;
    await tx.insert(companies).values({ ...property, id: distinct, propertyCode: "OTHER" });
    await rejectsImport(tx, sql`UPDATE companies SET property_code = 'ab-01' WHERE id = ${distinct}`, "23505");
    // None of these differences is guessed away by identity normalization.
    for (const [i, code] of ["AB01", "AB-1", "AB-001", "AB -01", "ＡB-01", "ÅB-01", "åB-01", "\u00a0AB-01"].entries()) {
      await tx.insert(companies).values({ ...property, id: `${prefix}-distinct-${i}`, propertyCode: code });
    }
    // Non-properties do not reserve property codes, even when metadata exists.
    const organization = `${prefix}-organization`;
    await tx.insert(companies).values({ ...property, id: organization, listingType: "organization" });
    await rejectsImport(tx, sql`UPDATE companies SET listing_type = 'property' WHERE id = ${organization}`, "23505");
    const [saved] = await tx.select().from(companies).where(eq(companies.id, original));
    assert.equal(saved!.propertyCode, property.propertyCode, "published spelling is not rewritten");
    assert.deepEqual(await auditPropertyIdentities(tx), []);
  });
});

test("duplicate audit names every conflicting ID and blocks seeds without changing contact evidence", async () => {
  await rolledBack(async (tx) => {
    await tx.execute(sql`DROP INDEX companies_property_code_unique`);
    const prefix = `duplicate-audit-${randomUUID()}`;
    const brand = `${prefix}-brand`;
    const otherBrand = `${prefix}-other-brand`;
    await tx.insert(companies).values([brand, otherBrand].map((id) => ({
      id, name: "Fixture brand", website: "https://fixture.example", category: "hotel" as const, listingType: "brand" as const,
    })));
    const ids = [0, 1, 2].map((n) => `${prefix}-${n}`);
    for (const [i, code] of ["OFFICIAL", "official", "\v official \t"].entries()) {
      await tx.insert(companies).values({
        id: ids[i]!, name: "Duplicate fixture", website: "https://fixture.example", category: "hotel",
        listingType: "property", brandId: brand, propertyCode: code,
        address: "1 Fixture Street", city: "Fixture City", countryCode: "US",
      });
    }
    await tx.insert(companies).values({
      id: `${prefix}-different-brand`, name: "Separate property", website: "https://fixture.example", category: "hotel",
      listingType: "property", brandId: otherBrand, propertyCode: "OFFICIAL",
      address: "1 Fixture Street", city: "Fixture City", countryCode: "US",
    });
    for (const id of ids) {
      await tx.insert(officialContacts).values({
        id, companyId: id, number: "+12125550100", region: "US", service: "Fixture main telephone", serviceType: "property_main",
      });
      await tx.insert(contactSources).values({
        id, contactId: id, sourceUrl: "https://fixture.example/contact", sourceName: "Fixture",
        reviewedAt: new Date("2026-01-01Z"), expiresAt: new Date("2026-02-01Z"), assertion: "listed",
      });
    }
    const snapshot = async () => ({
      companies: await tx.select().from(companies).orderBy(asc(companies.id)),
      contacts: await tx.select().from(officialContacts).orderBy(asc(officialContacts.id)),
      sources: await tx.select().from(contactSources).orderBy(asc(contactSources.id)),
    });
    const before = await snapshot();
    assert.deepEqual(await auditPropertyIdentities(tx), ids.map((id) => ({
      id, issues: ["duplicate brand/property code"],
    })));
    await assert.rejects(assertPropertyIdentities(tx), (error: unknown) => {
      assert.ok(error instanceof Error);
      for (const id of ids) assert.ok(error.message.includes(id));
      return true;
    });
    await assert.rejects(seedDirectory(tx), /duplicate brand\/property code/);
    assert.deepEqual(await snapshot(), before);
  });
});

test("the pre-constraint audit reports bad imports without modifying or silently repairing rows", async () => {
  await rolledBack(async (tx) => {
    // Transactional DDL is rolled back with the fixtures; no constraints are
    // removed from the database outside this isolated transaction.
    await tx.execute(sql`ALTER TABLE companies DROP CONSTRAINT companies_property_identity_check`);
    await tx.execute(sql`ALTER TABLE companies DROP CONSTRAINT companies_property_country_check`);
    await tx.execute(sql`ALTER TABLE companies DROP CONSTRAINT companies_property_brand_fk`);
    const id = `bad-import-${randomUUID()}`;
    await tx.execute(sql`
      INSERT INTO companies (id, name, website, category, listing_type, brand_id, property_code, address, city, country_code)
      VALUES (${id}, 'Bad import', 'https://fixture.example', 'tour', 'property', 'missing-fixture-brand', '', NULL, E'\\t', ' ')
    `);
    const before = await tx.select().from(companies).where(eq(companies.id, id));
    const result = await auditPropertyIdentities(tx);
    assert.deepEqual(result, [{ id, issues: [
      "property must be a hotel", "missing official property code", "missing address",
      "missing city", "missing country", "missing or invalid hotel brand",
    ] }]);
    await assert.rejects(assertPropertyIdentities(tx), /Directory identity audit failed/);
    await assert.rejects(seedDirectory(tx), /Directory identity audit failed/);
    assert.deepEqual(await tx.select().from(companies).where(eq(companies.id, id)), before);
  });
});

test("all supported international country codes accept direct property imports unchanged", async () => {
  await rolledBack(async (tx) => {
    const brand = `international-${randomUUID()}`;
    await tx.insert(companies).values({
      id: brand, name: "International fixture", website: "https://fixture.example",
      category: "hotel", listingType: "brand",
    });
    await tx.insert(companies).values(supportedCountryCodes.map((countryCode) => ({
      id: `${brand}-${countryCode}`, name: "International hotel", website: "https://fixture.example",
      category: "hotel" as const, listingType: "property" as const, brandId: brand, propertyCode: countryCode,
      address: "1 Fixture Street", city: "Fixture City", countryCode,
    })));
    const rows = await tx.select({ countryCode: companies.countryCode }).from(companies)
      .where(eq(companies.brandId, brand));
    assert.deepEqual(rows.map((row) => row.countryCode).sort(), [...supportedCountryCodes]);
    assert.deepEqual(await auditPropertyIdentities(tx), []);
  });
});

test("audit reports unsupported imported countries without changing evidence or review dates", async () => {
  await rolledBack(async (tx) => {
    await tx.execute(sql`ALTER TABLE companies DROP CONSTRAINT companies_property_country_check`);
    const [property] = await tx.select().from(companies).where(eq(companies.listingType, "property")).limit(1);
    assert.ok(property, "seeded property required");
    const contacts = await tx.select().from(officialContacts).orderBy(asc(officialContacts.id));
    const sources = await tx.select().from(contactSources).orderBy(asc(contactSources.id));
    for (const country of ["ZZ", "UK", "USA", "us", " US ", "United States", "AQ"]) {
      await tx.execute(sql`UPDATE companies SET country_code = ${country} WHERE id = ${property.id}`);
      const before = await tx.select().from(companies).orderBy(asc(companies.id));
      assert.deepEqual(await auditPropertyIdentities(tx), [{ id: property.id, issues: ["unsupported country code"] }]);
      await assert.rejects(assertPropertyIdentities(tx), /unsupported country code/);
      await assert.rejects(seedDirectory(tx), /unsupported country code/);
      assert.deepEqual(await tx.select().from(companies).orderBy(asc(companies.id)), before);
    }
    assert.deepEqual(await tx.select().from(officialContacts).orderBy(asc(officialContacts.id)), contacts);
    assert.deepEqual(await tx.select().from(contactSources).orderBy(asc(contactSources.id)), sources);
  });
});

test("direct directory filters reject unsupported country codes before querying", async () => {
  for (const countryCode of ["ZZ", "UK", "USA", "us", " US ", ""]) {
    await assert.rejects(directory.list("", undefined, 20, 0, { countryCode }), { code: "INVALID_COUNTRY" });
  }
});

test("seeding and identity enforcement leave all existing phone evidence and review dates unchanged", async () => {
  await rolledBack(async (tx) => {
    await seedDirectory(tx);
    const contactsBefore = await tx.select().from(officialContacts).orderBy(asc(officialContacts.id));
    const sourcesBefore = await tx.select().from(contactSources).orderBy(asc(contactSources.id));
    const companiesBefore = await tx.select().from(companies).orderBy(asc(companies.id));
    await seedDirectory(tx);
    await seedDirectory(tx);
    assert.deepEqual(await tx.select().from(officialContacts).orderBy(asc(officialContacts.id)), contactsBefore);
    assert.deepEqual(await tx.select().from(contactSources).orderBy(asc(contactSources.id)), sourcesBefore);
    assert.deepEqual(await tx.select().from(companies).orderBy(asc(companies.id)), companiesBefore);
  });
});

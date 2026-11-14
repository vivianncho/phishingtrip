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

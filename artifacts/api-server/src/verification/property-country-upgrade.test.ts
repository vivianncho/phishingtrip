import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { companies, db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { assertPropertyIdentities, auditPropertyIdentities } from "./property-audit";

after(async () => { await pool.end(); });

test("legacy country upgrade fails atomically, then preserves records after explicit correction", async () => {
  const namespace = `country_upgrade_${randomUUID().replaceAll("-", "")}`;
  const schema = sql.identifier(namespace);
  const table = sql`${schema}.companies`;
  const constraintName = "companies_property_country_check";
  // Exercise the actual schema expression, not a test copy of the supported list.
  const countryCheck = getTableConfig(companies).checks.find((check) => check.name === constraintName);
  assert.ok(countryCheck);
  const rollback = new Error("discard isolated upgrade rehearsal");

  await assert.rejects(db.transaction(async (tx) => {
    await tx.execute(sql`CREATE SCHEMA ${schema}`);
    // LIKE copies structure/checks, never application data. All DDL and fixtures
    // live in this disposable namespace and are rolled back even on test failure.
    for (const name of ["companies", "official_contacts", "contact_sources", "contact_source_reviews"]) {
      await tx.execute(sql`CREATE TABLE ${schema}.${sql.identifier(name)}
        (LIKE public.${sql.identifier(name)} INCLUDING ALL)`);
    }
    await tx.execute(sql`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${sql.identifier(constraintName)}`);
    await tx.execute(sql`ALTER TABLE ${table} ADD CONSTRAINT ${sql.identifier(constraintName)}
      CHECK (listing_type <> 'property' OR coalesce(country_code ~ '[^[:space:]]', false))`);
    await tx.execute(sql`INSERT INTO ${table} (id, name, category, website, listing_type) VALUES
      ('brand', 'Fixture hotel brand', 'hotel', 'https://fixture.example', 'brand'),
      ('organization', 'Fixture airline', 'airline', 'https://fixture.example', 'organization')`);
    const invalidCountries = ["ZZ", "UK", "USA", "us", " US ", "United States", "AQ", "ＵＳ"];
    const countries = ["US", "GB", "PR", ...invalidCountries];
    for (const [index, country] of countries.entries()) {
      const id = `hotel-${index.toString().padStart(2, "0")}`;
      await tx.execute(sql`INSERT INTO ${table}
        (id, name, category, website, listing_type, brand_id, property_code, address, city, subdivision, country_code)
        VALUES (${id}, 'Imported hotel', 'hotel', 'https://fixture.example', 'property',
          'brand', ${id}, '1 Fixture Street', 'Fixture City', 'Fixture subdivision', ${country})`);
      await tx.execute(sql`INSERT INTO ${schema}.official_contacts
        (id, company_id, number, region, service, service_type)
        VALUES (${id}, ${id}, '+12025550123', 'International', 'Hotel telephone', 'property_main')`);
      await tx.execute(sql`INSERT INTO ${schema}.contact_sources
        (id, contact_id, source_url, source_name, reviewed_at, expires_at, assertion)
        VALUES (${id}, ${id}, 'https://fixture.example/contact', 'Official contact page',
          '2025-04-01T12:34:56.123Z', '2025-07-01T12:34:56.123Z', 'listed')`);
      await tx.execute(sql`INSERT INTO ${schema}.contact_source_reviews
        (id, source_id, reviewer, note, recorded_at, "before", "after")
        VALUES (${id}, ${id}, 'fixture-reviewer', 'Historical review',
          '2025-04-01T12:34:56.123Z', '{"assertion":"disputed"}', '{"assertion":"listed"}')`);
    }

    async function snapshot() {
      const result: Record<string, unknown[]> = {};
      for (const name of ["companies", "official_contacts", "contact_sources", "contact_source_reviews"]) {
        result[name] = (await tx.execute(sql`SELECT * FROM ${schema}.${sql.identifier(name)} ORDER BY id`)).rows;
      }
      return result;
    }
    async function constraints() {
      return (await tx.execute(sql`SELECT conname, pg_get_constraintdef(oid) AS definition, convalidated
        FROM pg_constraint WHERE conrelid = ${`${namespace}.companies`}::regclass ORDER BY conname`)).rows;
    }
    async function install() {
      // Mirrors schema-push's atomic statement batch; the savepoint lets the
      // rehearsal inspect the original schema after PostgreSQL rejects the DDL.
      await tx.transaction(async (upgrade) => {
        await upgrade.execute(sql`ALTER TABLE ${table} DROP CONSTRAINT ${sql.identifier(constraintName)}`);
        await upgrade.execute(sql`ALTER TABLE ${table} ADD CONSTRAINT ${sql.identifier(constraintName)}
          CHECK (${countryCheck!.value})`);
      });
    }
    const before = await snapshot();
    const legacyConstraints = await constraints();
    const expectedIssues = invalidCountries.map((_, index) => ({
      id: `hotel-${(index + 3).toString().padStart(2, "0")}`, issues: ["unsupported country code"],
    }));
    assert.deepEqual(await auditPropertyIdentities(tx, namespace), expectedIssues);
    await assert.rejects(assertPropertyIdentities(tx, namespace), /unsupported country code/);
    assert.deepEqual(await snapshot(), before, "audit must not repair identity or renew evidence");

    await assert.rejects(install(), (error: unknown) => {
      const cause = (error as { cause: { code: string; constraint: string } }).cause;
      assert.equal(cause.code, "23514");
      assert.equal(cause.constraint, constraintName);
      return true;
    });
    assert.deepEqual(await constraints(), legacyConstraints, "failed replacement restores the old check");
    assert.deepEqual(await snapshot(), before, "failed installation preserves every stored field");
    assert.deepEqual(await auditPropertyIdentities(tx, namespace), expectedIssues);

    // Explicit operator corrections, deliberately not inferred from phone data.
    for (const { id } of expectedIssues) {
      await tx.execute(sql`UPDATE ${table} SET country_code = 'GB' WHERE id = ${id}`);
    }
    const corrected = await snapshot();
    assert.deepEqual(corrected, {
      ...before,
      companies: before.companies!.map((row) => {
        const company = row as { id: string };
        return expectedIssues.some(({ id }) => id === company.id) ? { ...company, country_code: "GB" } : row;
      }),
    }, "only explicitly corrected country values may change");
    await assertPropertyIdentities(tx, namespace);
    await install();
    const installedConstraints = await constraints();
    assert.notDeepEqual(installedConstraints, legacyConstraints);
    assert.equal(installedConstraints.find((row) => row.conname === constraintName)?.convalidated, true);
    assert.deepEqual(await snapshot(), corrected, "successful upgrade preserves identities, contacts, evidence and dates");
    assert.deepEqual(await auditPropertyIdentities(tx, namespace), []);
    for (const country of [...invalidCountries, "", " \t", null]) {
      await assert.rejects(tx.transaction(async (attempt) => {
        await attempt.execute(sql`UPDATE ${table} SET country_code = ${country} WHERE id = 'hotel-00'`);
      }), (error: unknown) => {
        assert.equal((error as { cause: { code: string } }).cause.code, "23514");
        return true;
      });
    }
    assert.deepEqual(await snapshot(), corrected);
    throw rollback;
  }), (error) => error === rollback);
  assert.equal((await db.execute(sql`SELECT 1 FROM pg_namespace WHERE nspname = ${namespace}`)).rows.length, 0);
});

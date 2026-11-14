import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { supportedCountryCodes } from "./countries";
import { canonicalCodes, compareCountryCodes, countryCheckExpression, parseCountryConstraint } from "./country-constraints";

test("country differences are deterministic and identify removed codes", () => {
  assert.deepEqual(compareCountryCodes(["US", "GB", "CA"], ["GB", "AU", "US"]), {
    addedCodes: ["AU"], removedCodes: ["CA"],
  });
  assert.deepEqual(canonicalCodes(["US", "AU", "US"]), ["AU", "US"]);
});

test("recognizes only the expected PostgreSQL country constraint", () => {
  const definition = "CHECK (((listing_type <> 'property'::text) OR COALESCE((country_code = ANY (ARRAY['US'::text, 'GB'::text])), false)))";
  assert.deepEqual(parseCountryConstraint(definition), ["GB", "US"]);
  assert.equal(parseCountryConstraint(definition.replace("false", "true")), null);
  assert.equal(parseCountryConstraint(definition.replace("country_code", "city")), null);
  assert.equal(parseCountryConstraint("CHECK (true)"), null);
});

test("DDL rejects noncanonical or injectable codes and sorts valid values", () => {
  for (const codes of [[], ["us"], [" US"], ["US');--"]]) {
    assert.throws(() => countryCheckExpression(codes));
  }
  assert.equal(countryCheckExpression(["US", "GB"]), "listing_type <> 'property' OR coalesce(country_code IN ('GB', 'US'), false)");
});

test("recognizes PostgreSQL's actual deparsed constraint", { skip: !process.env.DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE country_rule_format_test (
      listing_type text, country_code text,
      CONSTRAINT country_rule_format_check CHECK (${countryCheckExpression(supportedCountryCodes)})
    ) ON COMMIT DROP`);
    const result = await client.query(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'pg_temp.country_rule_format_test'::regclass`);
    assert.deepEqual(parseCountryConstraint(result.rows[0].definition), [...supportedCountryCodes]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});

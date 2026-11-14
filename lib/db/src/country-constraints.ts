import type { PoolClient } from "pg";
import { supportedCountryCodes } from "./countries";

const constraint = "companies_property_country_check";

export function canonicalCodes(codes: readonly string[]): string[] {
  if (!codes.length || codes.some((code) => !/^[A-Z]{2}$/.test(code))) {
    throw new Error("Country metadata must contain canonical two-letter codes");
  }
  return [...new Set(codes)].sort();
}

export function countryCheckExpression(codes: readonly string[]): string {
  return `listing_type <> 'property' OR coalesce(country_code IN (${canonicalCodes(codes).map((code) => `'${code}'`).join(", ")}), false)`;
}

export function compareCountryCodes(installed: readonly string[], runtime: readonly string[]) {
  const oldCodes = canonicalCodes(installed);
  const newCodes = canonicalCodes(runtime);
  return {
    addedCodes: newCodes.filter((code) => !oldCodes.includes(code)),
    removedCodes: oldCodes.filter((code) => !newCodes.includes(code)),
  };
}

// Accept only PostgreSQL's deparsed form of our own CHECK, not an arbitrary
// expression that happens to contain country literals. Unknown rules fail closed.
export function parseCountryConstraint(definition: string): string[] | null {
  const match = /^CHECK \(\(\(listing_type <> 'property'::text\) OR COALESCE\(\(country_code = ANY \(ARRAY\[(.*)\]\)\), false\)\)\)$/.exec(definition);
  if (!match || !/^'[A-Z]{2}'::text(?:, '[A-Z]{2}'::text)*$/.test(match[1])) return null;
  return canonicalCodes([...match[1].matchAll(/'([A-Z]{2})'::text/g)].map((item) => item[1]));
}

export interface CountryConstraintReport {
  status: "aligned" | "drift";
  constraint: string;
  definition: string | null;
  recognized: boolean;
  validated: boolean;
  runtimeCodes: string[];
  installedCodes: string[] | null;
  addedCodes: string[];
  removedCodes: string[];
  blockedProperties: { id: string; countryCode: string | null }[];
}

export async function inspectCountryConstraint(
  client: PoolClient,
  codes: readonly string[] = supportedCountryCodes,
): Promise<CountryConstraintReport> {
  const runtimeCodes = canonicalCodes(codes);
  const result = await client.query<{ definition: string; validated: boolean }>(
    `SELECT pg_get_constraintdef(oid) AS definition, convalidated AS validated
       FROM pg_constraint
      WHERE conrelid = 'public.companies'::regclass AND conname = $1 AND contype = 'c'`,
    [constraint],
  );
  const row = result.rows[0];
  // NOT VALID is reported separately, but its expression can still be compared.
  const installedCodes = row ? parseCountryConstraint(row.definition.replace(/ NOT VALID$/, "")) : null;
  const diff = installedCodes ? compareCountryCodes(installedCodes, runtimeCodes) : { addedCodes: [], removedCodes: [] };
  const blocked = await client.query<{ id: string; countryCode: string | null }>(
    `SELECT id, country_code AS "countryCode" FROM public.companies
      WHERE listing_type = 'property'
        AND (country_code IS NULL OR NOT (country_code = ANY($1::text[])))
      ORDER BY id COLLATE "C"`,
    [runtimeCodes],
  );
  return {
    status: installedCodes && row.validated && !diff.addedCodes.length && !diff.removedCodes.length && !blocked.rows.length ? "aligned" : "drift",
    constraint,
    definition: row?.definition ?? null,
    recognized: installedCodes !== null,
    validated: row?.validated ?? false,
    runtimeCodes,
    installedCodes,
    ...diff,
    blockedProperties: blocked.rows,
  };
}

// Caller owns the transaction. Lock before inspection so no concurrent import
// can enter between the audit and constraint replacement.
export async function upgradeCountryConstraint(client: PoolClient) {
  await client.query("LOCK TABLE public.companies IN ACCESS EXCLUSIVE MODE");
  const before = await inspectCountryConstraint(client);
  if (!before.recognized || before.blockedProperties.length) {
    return { applied: false, before, after: before };
  }
  if (before.status === "aligned") return { applied: false, before, after: before };
  await client.query(`ALTER TABLE public.companies DROP CONSTRAINT ${constraint}`);
  await client.query(`ALTER TABLE public.companies ADD CONSTRAINT ${constraint} CHECK (${countryCheckExpression(supportedCountryCodes)})`);
  const after = await inspectCountryConstraint(client);
  if (after.status !== "aligned") throw new Error("Country constraint verification failed");
  return { applied: true, before, after };
}

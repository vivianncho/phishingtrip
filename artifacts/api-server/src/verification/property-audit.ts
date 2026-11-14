import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// Also works before the original property columns have been pushed. Missing
// columns use their schema defaults, never inferred locations or identities.
export async function auditPropertyIdentities(database: Pick<typeof db, "execute"> = db) {
  const columns = await database.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies'
  `);
  if (!columns.rows.length) return []; // A new, empty database has no imports to audit.
  const present = new Set(columns.rows.map((row) => row.column_name));
  if (!present.has("id")) throw new Error("Directory companies table is missing");
  const fields = ["id", "category", "listing_type", "brand_id", "property_code", "address", "city", "country_code"];
  const projection = sql.join(fields.map((field) => present.has(field) ? sql.identifier(field) :
    sql`${field === "listing_type" ? sql`'organization'::text` : sql`NULL::text`} AS ${sql.identifier(field)}`), sql`, `);
  const result = await database.execute<{ id: string; issues: string[] }>(sql`
    WITH identities AS (SELECT ${projection} FROM public.companies),
    audited AS (
      SELECT c.id, array_remove(ARRAY[
        CASE WHEN c.listing_type NOT IN ('organization', 'brand', 'property') OR c.listing_type IS NULL
          THEN 'invalid listing type' END,
        CASE WHEN c.listing_type = 'property' AND c.category IS DISTINCT FROM 'hotel'
          THEN 'property must be a hotel' END,
        CASE WHEN c.listing_type = 'property' AND NOT coalesce(c.property_code ~ '[^[:space:]]', false)
          THEN 'missing official property code' END,
        CASE WHEN c.listing_type = 'property' AND NOT coalesce(c.address ~ '[^[:space:]]', false)
          THEN 'missing address' END,
        CASE WHEN c.listing_type = 'property' AND NOT coalesce(c.city ~ '[^[:space:]]', false)
          THEN 'missing city' END,
        CASE WHEN c.listing_type = 'property' AND NOT coalesce(c.country_code ~ '[^[:space:]]', false)
          THEN 'missing country' END,
        CASE WHEN c.listing_type = 'property' AND NOT EXISTS (
          SELECT 1 FROM identities b WHERE b.id = c.brand_id
            AND b.listing_type = 'brand' AND b.category = 'hotel'
        ) THEN 'missing or invalid hotel brand' END
      ]::text[], NULL) AS issues FROM identities c
    )
    SELECT id, issues FROM audited WHERE cardinality(issues) > 0 ORDER BY id
  `);
  return result.rows;
}

export async function assertPropertyIdentities(database: Pick<typeof db, "execute"> = db) {
  const invalid = await auditPropertyIdentities(database);
  if (invalid.length) {
    throw new Error(`Directory identity audit failed: ${invalid.map((row) => `${row.id}: ${row.issues.join(", ")}`).join("; ")}`);
  }
}

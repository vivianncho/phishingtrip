import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Read-only verification, never automatic access provisioning or owner fallback.
export async function assertApiAccess(client) {
  const { rows } = await client.query(`
    WITH required(relation, privilege) AS (VALUES
      ('public.companies', 'SELECT'),
      ('public.official_contacts', 'SELECT'),
      ('public.contact_sources', 'SELECT'),
      ('public.property_aliases', 'SELECT'),
      ('public.usage_counters', 'SELECT'),
      ('public.usage_counters', 'INSERT'),
      ('public.usage_counters', 'UPDATE'),
      ('public.usage_counters', 'DELETE'),
      ('public.source_review_notifications', 'SELECT'),
      ('public.source_review_notifications', 'INSERT'),
      ('public.source_review_notifications', 'UPDATE')
    )
    SELECT current_user = 'phishing_api'
      AND bool_and(has_table_privilege(current_user, relation, privilege))
      AND NOT has_any_column_privilege(current_user, 'public.contact_source_reviews', 'SELECT,INSERT,UPDATE,REFERENCES')
      AND NOT has_table_privilege(current_user, 'public.contact_source_reviews', 'DELETE,TRUNCATE,TRIGGER')
      AS ready
    FROM required
  `);
  if (rows[0]?.ready !== true) throw new Error("API database access is not ready");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const client = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c role=phishing_api",
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
  });
  try {
    if (!process.env.DATABASE_URL) throw new Error("Missing database setup");
    await assertApiAccess(client);
    process.stdout.write("Restricted API database access verified.\n");
  } catch {
    process.stderr.write("API database access is not ready. Ask the trusted development database owner to review and run `pnpm --filter @workspace/db run access:configure`; for deployment, follow docs/contact-review-database-access.md. No permissions were changed by this check.\n");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

import { readFile } from "node:fs/promises";
import pg from "pg";

// Deliberate DBA action only; never invoked by dev/start/build/publish scripts.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (!process.env.DATABASE_URL) throw new Error("Missing database setup");
  await pool.query(await readFile(new URL("./contact-review-roles.sql", import.meta.url), "utf8"));
  process.stdout.write("Contact review access roles configured.\n");
} catch {
  // No connection strings, private notes, or database diagnostics in logs.
  process.stderr.write("Access setup failed; ask the database administrator to inspect the role configuration.\n");
  process.exitCode = 1;
} finally {
  await pool.end();
}

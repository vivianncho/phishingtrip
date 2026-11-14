import pg from "pg";
import { inspectCountryConstraint, upgradeCountryConstraint } from "./country-constraints";

async function main() {
  const mode = process.argv[2];
  if (!["check", "upgrade"].includes(mode) || process.argv.length !== 3) {
    throw new Error("Usage: country-constraints-cli.ts check|upgrade");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    try {
      await client.query(mode === "check" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '60s'");
      const result = mode === "check"
        ? await inspectCountryConstraint(client)
        : await upgradeCountryConstraint(client);
      await client.query("COMMIT");
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      const status = "after" in result ? result.after.status : result.status;
      if (status !== "aligned") process.exitCode = 2;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  // Do not print connection details, credentials, or arbitrary driver errors.
  process.stderr.write("Country constraint command failed; no changes committed. Check DATABASE_URL, permissions, command arguments, and database locks. See docs/country-metadata-upgrades.md.\n");
  process.exitCode = 1;
});

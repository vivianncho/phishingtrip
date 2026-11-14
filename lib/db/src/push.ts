import { pushSchema } from "drizzle-kit/api";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { db, pool } from "./index";
import * as schema from "./schema";
import { orderPropertyBrandStatements } from "./push-order";

// Development tooling only; never run from an application/deployment hook.
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Development schema push cannot run in production");
  // drizzle-kit expects the schema-less database type for introspection.
  const plan = await pushSchema(schema, drizzle(pool));
  if (plan.hasDataLoss && !process.argv.includes("--force")) {
    throw new Error("Schema push requires explicit approval of potential data loss");
  }
  // Apply atomically and propagate errors (the CLI can print an SQL failure
  // and still exit successfully). A failed FK/check must fail post-merge setup.
  await db.transaction(async (tx) => {
    for (const statement of orderPropertyBrandStatements(plan.statementsToExecute)) {
      await tx.execute(sql.raw(statement));
    }
  });
  process.stdout.write("Development database schema applied.\n");
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error && (
    error.message.startsWith("Development schema") || error.message.startsWith("Schema push requires")
  ) ? `${error.message}\n` : "Development schema push failed; no schema changes committed. Check schema and directory audit.\n");
  process.exitCode = 1;
}).finally(() => pool.end());

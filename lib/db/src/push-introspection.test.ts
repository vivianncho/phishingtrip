import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgSchema, primaryKey, text } from "drizzle-orm/pg-core";
import pg from "pg";

test("schema planning preserves bindings while inspecting composite primary keys", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const namespace = `push_test_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${namespace}"`);
    await client.query(`CREATE TABLE "${namespace}"."contacts" (
      "company_id" text NOT NULL, "number" text NOT NULL,
      CONSTRAINT "contacts_pk" PRIMARY KEY ("company_id", "number")
    )`);
    const testSchema = pgSchema(namespace);
    const contacts = testSchema.table("contacts", {
      companyId: text("company_id").notNull(),
      number: text("number").notNull(),
    }, (table) => [primaryKey({ name: "contacts_pk", columns: [table.companyId, table.number] })]);
    const plan = await pushSchema({ testSchema, contacts }, drizzle(client), [namespace]);
    assert.equal(plan.hasDataLoss, false);
    assert.deepEqual(plan.statementsToExecute, []);
  } finally {
    // The disposable schema never commits; no application records are changed.
    await client.query("ROLLBACK");
    await client.end();
  }
});

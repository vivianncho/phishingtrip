import { randomUUID } from "node:crypto";
import { after } from "node:test";
import { pool } from "@workspace/db";
import { PostgresCounters } from "./counters";

const namespaces: string[] = [];
export function counterFixture(now?: () => number) {
  const namespace = `test:${randomUUID()}`;
  namespaces.push(namespace);
  return { namespace, store: new PostgresCounters(namespace, pool, now) };
}
after(async () => {
  await pool.query("DELETE FROM usage_counters WHERE namespace = ANY($1::text[])", [namespaces]);
});

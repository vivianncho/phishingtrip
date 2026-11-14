// Separate-process counter client for the replica/restart regression test.
import { pool } from "@workspace/db";
import { PostgresCounters } from "./counters";

const namespace = process.argv[2];
if (!namespace?.startsWith("test:")) throw new Error("Test namespace required");
try {
  const store = new PostgresCounters(namespace);
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    store.check([{ key: "requests", amount: 1, limit: 7, windowMs: 86400000 }], true)));
  process.stdout.write(String(results.filter((r) => r.allowed).length));
} finally { await pool.end(); }

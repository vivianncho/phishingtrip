import { apiPool as pool } from "@workspace/db";

export type CounterRule = { key: string; limit: number; amount: number; windowMs: number };
export type CounterResult = { allowed: boolean; deniedKey?: string; retryAfter: number };
export interface Counters {
  check(rules: CounterRule[], reserve: boolean): Promise<CounterResult>;
}

/** Shared, fixed UTC windows. A transaction reserves every ceiling or none of them. */
export class PostgresCounters implements Counters {
  constructor(
    private namespace: string,
    private connection = pool,
    private clock?: () => number,
  ) {}

  async check(rules: CounterRule[], reserve: boolean): Promise<CounterResult> {
    for (const r of rules) {
      if (![r.limit, r.amount, r.windowMs].every(Number.isSafeInteger) ||
          r.limit < 0 || r.amount < 0 || r.windowMs < 1) throw new Error("Invalid counter rule");
    }
    const client = await this.connection.connect();
    try {
      await client.query("BEGIN");
      // Same lock across connections, processes and restarts; no application-clock race.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`stillwater:${this.namespace}`]);
      const instant = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const now = this.clock?.() ?? instant.rows[0]!.now.getTime();
      await client.query("DELETE FROM usage_counters WHERE namespace = $1 AND expires_at <= $2", [this.namespace, new Date(now)]);
      for (const r of rules) {
        const expires = new Date((Math.floor(now / r.windowMs) + 1) * r.windowMs);
        const found = await client.query<{ used: string }>(
          "SELECT used FROM usage_counters WHERE namespace = $1 AND key = $2",
          [this.namespace, r.key],
        );
        const used = Number(found.rows[0]?.used ?? 0);
        if (used + r.amount > r.limit) {
          await client.query("ROLLBACK");
          return { allowed: false, deniedKey: r.key, retryAfter: Math.max(1, Math.ceil((expires.getTime() - now) / 1000)) };
        }
        if (reserve) await client.query(
          `INSERT INTO usage_counters (namespace, key, used, expires_at) VALUES ($1, $2, $3, $4)
           ON CONFLICT (namespace, key) DO UPDATE SET used = EXCLUDED.used, expires_at = EXCLUDED.expires_at`,
          [this.namespace, r.key, used + r.amount, expires],
        );
      }
      await client.query("COMMIT");
      return { allowed: true, retryAfter: 0 };
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      // Never propagate SQL parameters, connection details or errors into request logs.
      throw new Error("Shared limits unavailable");
    } finally { client.release(); }
  }
}

export const apiCounters = new PostgresCounters("api");
// Intentionally one account-wide bucket, NOT scoped to a replica or rotatable API key.
export const lookupCounters = new PostgresCounters("twilio-basic");

// Physical deletion even during idle periods. Expiry is enforced synchronously above.
// No per-number cache or request data is stored in this table.
const cleanup = setInterval(() => {
  void pool.query("DELETE FROM usage_counters WHERE expires_at <= clock_timestamp()").catch(() => {});
}, 60000);
cleanup.unref();

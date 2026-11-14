import { bigint, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Operational aggregates only. Never put numbers, IPs or provider results here.
export const usageCounters = pgTable("usage_counters", {
  namespace: text("namespace").notNull(),
  key: text("key").notNull(),
  used: bigint("used", { mode: "number" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.namespace, t.key] }),
  index("usage_counters_expiry_idx").on(t.expiresAt),
]);
export const insertUsageCounterSchema = createInsertSchema(usageCounters);
export type UsageCounterRow = typeof usageCounters.$inferSelect;

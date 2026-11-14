import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { contactSources } from "./contact-sources";

// Append-only for operator roles (lib/db/security/contact-review-roles.sql).
// Owner administration bypasses ACLs; never use an owner login for operators/API.
// Not evidence consumed by verdicts.
export const contactSourceReviews = pgTable("contact_source_reviews", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => contactSources.id),
  reviewer: text("reviewer").notNull(),
  note: text("note").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  before: jsonb("before").notNull(),
  after: jsonb("after").notNull(),
}, (table) => [index("contact_source_reviews_source_idx").on(table.sourceId)]);
export const insertContactSourceReviewSchema = createInsertSchema(contactSourceReviews);
export type ContactSourceReviewRow = typeof contactSourceReviews.$inferSelect;

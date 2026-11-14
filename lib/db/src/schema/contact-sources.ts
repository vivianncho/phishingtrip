import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { officialContacts } from "./official-contacts";

export const contactSources = pgTable("contact_sources", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull().references(() => officialContacts.id),
  sourceUrl: text("source_url").notNull(),
  sourceName: text("source_name").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  assertion: text("assertion", { enum: ["listed", "disputed"] }).notNull(),
});
export const insertContactSourceSchema = createInsertSchema(contactSources);
export type ContactSourceRow = typeof contactSources.$inferSelect;

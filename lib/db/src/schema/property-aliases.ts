import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companies } from "./companies";

// Discovery metadata only: never telephone evidence or a replacement identity.
export const propertyAliases = pgTable("property_aliases", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  kind: text("kind", { enum: ["name", "city"] }).notNull(),
  value: text("value").notNull(),
  locale: text("locale").notNull(),
  sourceUrl: text("source_url").notNull(),
  // Records an explicit review of the spelling, not a contact review.
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
}, (table) => [index("property_aliases_company_id_idx").on(table.companyId)]);
export const insertPropertyAliasSchema = createInsertSchema(propertyAliases);
export type PropertyAliasRow = typeof propertyAliases.$inferSelect;

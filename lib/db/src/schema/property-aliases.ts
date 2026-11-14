import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  retiredAt: timestamp("retired_at", { withTimezone: true }),
}, (table) => [index("property_aliases_company_id_idx").on(table.companyId)]);
export const insertPropertyAliasSchema = createInsertSchema(propertyAliases);
export type PropertyAliasRow = typeof propertyAliases.$inferSelect;

// Separate spelling maintenance history; never contact evidence.
export const propertyAliasReviews = pgTable("property_alias_reviews", {
  id: text("id").primaryKey(),
  aliasId: text("alias_id").notNull().references(() => propertyAliases.id),
  action: text("action", { enum: ["review", "replace", "retire"] }).notNull(),
  reviewer: text("reviewer").notNull(),
  note: text("note").notNull(),
  sourceUrl: text("source_url").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  before: jsonb("before").$type<PropertyAliasRow>().notNull(),
  after: jsonb("after").$type<PropertyAliasRow>().notNull(),
  replacementId: text("replacement_id").references(() => propertyAliases.id),
}, (table) => [index("property_alias_reviews_alias_id_idx").on(table.aliasId)]);

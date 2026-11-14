import { pgTable, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companies } from "./companies";

export const officialContacts = pgTable("official_contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  number: text("number").notNull(),
  region: text("region").notNull(),
  service: text("service").notNull(),
  serviceType: text("service_type", { enum: ["general", "central_reservations", "property_main", "front_desk"] }).notNull().default("general"),
}, (t) => [index("official_contacts_number_idx").on(t.number)]);
export const insertOfficialContactSchema = createInsertSchema(officialContacts);
export type OfficialContactRow = typeof officialContacts.$inferSelect;

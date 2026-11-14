import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category", { enum: ["airline", "hotel", "vacation_rental", "car_rental", "booking_service", "rail_transfer", "cruise", "tour"] }).notNull(),
  website: text("website").notNull(),
});
export const insertCompanySchema = createInsertSchema(companies);
export type CompanyRow = typeof companies.$inferSelect;

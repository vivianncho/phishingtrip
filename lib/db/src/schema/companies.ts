import { sql, type SQLWrapper } from "drizzle-orm";
import { check, foreignKey, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { supportedCountryCodesSql } from "../countries";

// Identity comparison only: preserve the published code in storage. Fold ASCII
// case and trim ASCII whitespace at the edges; do not guess at punctuation,
// internal whitespace, leading zeroes, or Unicode equivalence.
export function normalizedPropertyCode(value: SQLWrapper) {
  return sql`translate(btrim(${value}, E' \\t\\n\\r\\f\\013'),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') COLLATE "C"`;
}

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category", { enum: ["airline", "hotel", "vacation_rental", "car_rental", "booking_service", "rail_transfer", "cruise", "tour"] }).notNull(),
  website: text("website").notNull(),
  listingType: text("listing_type", { enum: ["organization", "brand", "property"] }).notNull().default("organization"),
  brandId: text("brand_id"),
  propertyCode: text("property_code"),
  address: text("address"),
  city: text("city"),
  subdivision: text("subdivision"),
  countryCode: text("country_code"),
  // A composite FK checks the parent's role/category as well as its existence.
  // NULL for other organizations leaves their existing identities unrestricted.
  propertyBrandType: text("property_brand_type").generatedAlwaysAs(
    sql`CASE WHEN listing_type = 'property' THEN 'brand'::text ELSE NULL::text END`,
  ),
}, (t) => [
  check("companies_listing_type_check", sql`${t.listingType} IN ('organization', 'brand', 'property')`),
  check("companies_property_country_check", sql`${t.listingType} <> 'property' OR coalesce(${t.countryCode} IN (${supportedCountryCodesSql}), false)`),
  check("companies_property_identity_check", sql`${t.listingType} <> 'property' OR (
    ${t.category} = 'hotel'
    AND coalesce(${t.brandId} ~ '[^[:space:]]', false)
    AND coalesce(${t.propertyCode} ~ '[^[:space:]]', false)
    AND coalesce(${t.address} ~ '[^[:space:]]', false)
    AND coalesce(${t.city} ~ '[^[:space:]]', false)
    AND coalesce(${t.countryCode} ~ '[^[:space:]]', false)
  )`),
  uniqueIndex("companies_brand_identity_unique").on(t.id, t.listingType, t.category),
  uniqueIndex("companies_property_code_unique")
    .on(t.brandId, normalizedPropertyCode(t.propertyCode))
    .where(sql`${t.listingType} = 'property'`),
  foreignKey({
    name: "companies_property_brand_fk",
    columns: [t.brandId, t.propertyBrandType, t.category],
    foreignColumns: [t.id, t.listingType, t.category],
  }).onDelete("no action").onUpdate("no action"),
]);
export const insertCompanySchema = createInsertSchema(companies);
export type CompanyRow = typeof companies.$inferSelect;

import { db, pool, companies, officialContacts, contactSources, propertyAliases } from "@workspace/db";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { logger } from "../lib/logger";
import { SOURCE_MAX_AGE_DAYS } from "./policy";
import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { officialProvenance } from "./source-policy";
import type { TravelCategory, ContactService } from "@workspace/api-zod";
import { assertPropertyIdentities } from "./property-audit";
import { exactPropertyAliasProvenance } from "./alias-review";
import { seedAirlineDepartments } from "./airline-departments";

// Human-reviewed against the official sites at the recorded instant. Rerunning is NOT a new review.
export const reviewedAt = new Date("2026-11-14T20:34:24Z");
export const airlineSeed = [
  { id: "delta", name: "Delta Air Lines", website: "https://www.delta.com", number: "+18002211212",
    region: "United States", service: "General sales and reservations",
    sourceUrl: "https://www.delta.com/us/en/need-help/overview" },
  { id: "united", name: "United Airlines", website: "https://www.united.com", number: "+18008648331",
    region: "United States and Canada", service: "Reservations — English",
    sourceUrl: "https://www.united.com/en/us/fly/help/contact-reservations.html" },
  { id: "american", name: "American Airlines", website: "https://www.aa.com", number: "+18004337300",
    region: "United States and Canada", service: "Reservations and ticket changes — English",
    sourceUrl: "https://www.aa.com/i18n/customer-service/contact-american/reservations-and-ticket-changes.jsp" },
] as const;

// Source content inspected on 2026-11-14. This timestamp is fixed, not renewed by seeding.
const travelReviewedAt = new Date("2026-11-14T20:46:23Z");
const travelSeed = [
  { id: "marriott", name: "Marriott Reservations", category: "hotel", website: "https://help.marriott.com",
    number: "+18882362427", region: "United States and Canada", service: "Central reservations, not an individual hotel front desk",
    sourceUrl: "https://help.marriott.com/s/article/reservations-phone-number" },
  { id: "marriott-homes-villas", name: "Homes & Villas by Marriott Bonvoy", category: "vacation_rental", website: "https://help.marriott.com",
    number: "+18337642004", region: "United States and Canada", service: "Homes and Villas reservations",
    sourceUrl: "https://help.marriott.com/s/article/reservations-phone-number" },
  { id: "enterprise", name: "Enterprise Rent-A-Car", category: "car_rental", website: "https://www.enterprise.com",
    number: "+18552669289", region: "United States", service: "Car rental reservations",
    sourceUrl: "https://www.enterprise.com/en/help/contact.html" },
  { id: "amtrak", name: "Amtrak", category: "rail_transfer", website: "https://www.amtrak.com",
    number: "+18008727245", region: "United States", service: "Reservations and customer service",
    sourceUrl: "https://www.amtrak.com/contact-us/helpful-links-and-phone-numbers" },
  { id: "royal-caribbean", name: "Royal Caribbean", category: "cruise", website: "https://www.royalcaribbean.com",
    number: "+18665627625", region: "United States", service: "Individual reservations",
    sourceUrl: "https://www.royalcaribbean.com/resources/contact-us" },
] as const;

// Read from each property's official overview, including its address and Tel link.
// The sources say "Tel", not "front desk": do not upgrade these main lines.
const propertyReviewedAt = new Date("2026-11-14T20:49:15Z");
const propertySeed = [
  { id: "marriott-nycmq", name: "New York Marriott Marquis", category: "hotel", website: "https://www.marriott.com",
    number: "+12123981900", region: "New York, New York, United States",
    service: "Property main telephone — direct front-desk service not confirmed",
    sourceUrl: "https://www.marriott.com/en-us/hotels/nycmq-new-york-marriott-marquis/overview/",
    propertyCode: "NYCMQ", address: "1535 Broadway, New York, New York, USA, 10036",
    city: "New York", subdivision: "New York", countryCode: "US" },
  { id: "marriott-sfodt", name: "San Francisco Marriott Marquis", category: "hotel", website: "https://www.marriott.com",
    number: "+14158961600", region: "San Francisco, California, United States",
    service: "Property main telephone — direct front-desk service not confirmed",
    sourceUrl: "https://www.marriott.com/en-us/hotels/sfodt-san-francisco-marriott-marquis/overview/",
    propertyCode: "SFODT", address: "780 Mission Street, San Francisco, California, USA, 94103",
    city: "San Francisco", subdivision: "California", countryCode: "US" },
] as const;

// Spellings read from these localized official property pages on 2026-11-14.
// These do not add or renew any telephone evidence. Never generate aliases
// from fuzzy brand matches or guessed translations.
const aliasReviewedAt = new Date("2026-11-14T21:03:04Z");
export const propertyAliasSeed = [
  { id: "nycmq-name-ja", companyId: "marriott-nycmq", kind: "name", locale: "ja",
    value: "ニューヨーク・マリオット・マーキス",
    sourceUrl: "https://www.marriott.com/ja/hotels/nycmq-new-york-marriott-marquis/overview/" },
  { id: "nycmq-city-ja", companyId: "marriott-nycmq", kind: "city", locale: "ja",
    value: "ニューヨーク",
    sourceUrl: "https://www.marriott.com/ja/hotels/nycmq-new-york-marriott-marquis/overview/" },
  { id: "nycmq-city-es", companyId: "marriott-nycmq", kind: "city", locale: "es",
    value: "Nueva York",
    sourceUrl: "https://www.marriott.com/es/hotels/nycmq-new-york-marriott-marquis/overview/" },
  { id: "sfodt-name-ja", companyId: "marriott-sfodt", kind: "name", locale: "ja",
    value: "サンフランシスコ・マリオット・マーキス",
    sourceUrl: "https://www.marriott.com/ja/hotels/sfodt-san-francisco-marriott-marquis/overview/" },
  { id: "sfodt-city-ja", companyId: "marriott-sfodt", kind: "city", locale: "ja",
    value: "サンフランシスコ",
    sourceUrl: "https://www.marriott.com/ja/hotels/sfodt-san-francisco-marriott-marquis/overview/" },
] as const;

// No invented phone contacts: these companies direct users to their official help
// sites until a specific number and its regional/service scope can be reviewed.
const websiteOnlySeed = [
  { id: "booking", name: "Booking.com", category: "booking_service", website: "https://www.booking.com" },
  { id: "viator", name: "Viator", category: "tour", website: "https://www.viator.com/help" },
] as const;

export async function seedDirectory(database: Pick<typeof db, "transaction"> = db) {
  await database.transaction(async (tx) => {
    // Fail explicitly on imported identity problems; never repair them by
    // guessing a location, deleting evidence or renewing a source review.
    await assertPropertyIdentities(tx);
    for (const entry of [...airlineSeed.map(entry => ({ ...entry, category: "airline" as const, reviewedAt })), ...travelSeed.map(entry => ({ ...entry, reviewedAt: travelReviewedAt })), ...propertySeed.map(entry => ({ ...entry, reviewedAt: propertyReviewedAt }))]) {
      if (parsePhoneNumberFromString(entry.number)?.number !== entry.number ||
          !parsePhoneNumberFromString(entry.number)?.isValid() ||
          !officialProvenance(entry.sourceUrl, entry.website)) throw new Error("Invalid seed provenance");
      const property = propertySeed.find((p) => p.id === entry.id);
      const identity = property ? {
        listingType: "property" as const, brandId: "marriott", propertyCode: property.propertyCode,
        address: property.address, city: property.city, subdivision: property.subdivision, countryCode: property.countryCode,
      } : { listingType: entry.id === "marriott" ? "brand" as const : "organization" as const };
      await tx.insert(companies).values({ id: entry.id, name: entry.name, website: entry.website, category: entry.category satisfies TravelCategory, ...identity }).onConflictDoNothing();
      const [existingCompany] = await tx.select().from(companies).where(eq(companies.id, entry.id));
      if (existingCompany?.website !== entry.website || existingCompany.category !== entry.category) throw new Error("Seed company provenance conflict");
      // Classify the pre-existing central listing without changing its evidence dates.
      if (entry.id === "marriott" && existingCompany.listingType === "organization") {
        await tx.update(companies).set({ listingType: "brand" }).where(eq(companies.id, entry.id));
      } else if (Object.entries(identity).some(([key, value]) => existingCompany[key as keyof typeof existingCompany] !== value)) {
        throw new Error("Seed property identity conflict");
      }
      const serviceType: ContactService = property ? "property_main" : entry.id === "marriott" ? "central_reservations" : "general";
      const contactId = `${entry.id}-${property ? "main" : "reservations"}`;
      await tx.insert(officialContacts).values({ id: contactId, companyId: entry.id, number: entry.number, region: entry.region, service: entry.service, serviceType }).onConflictDoNothing();
      const [existingContact] = await tx.select().from(officialContacts).where(eq(officialContacts.id, contactId));
      if (existingContact?.number !== entry.number || existingContact.companyId !== entry.id ||
          existingContact.region !== entry.region || existingContact.service !== entry.service) throw new Error("Seed contact conflict");
      if (entry.id === "marriott" && existingContact.serviceType === "general") {
        await tx.update(officialContacts).set({ serviceType }).where(eq(officialContacts.id, contactId));
      } else if (existingContact.serviceType !== serviceType) throw new Error("Seed service scope conflict");
      await tx.insert(contactSources).values({
        id: `${contactId}-2026-11-14`, contactId, sourceUrl: entry.sourceUrl,
        sourceName: `${entry.name} official website`, assertion: "listed", reviewedAt: entry.reviewedAt,
        expiresAt: new Date(entry.reviewedAt.getTime() + SOURCE_MAX_AGE_DAYS * 86400000),
      }).onConflictDoNothing();
    }
    await seedAirlineDepartments(tx);
    for (const entry of websiteOnlySeed) {
      await tx.insert(companies).values(entry).onConflictDoNothing();
      const [existing] = await tx.select().from(companies).where(eq(companies.id, entry.id));
      if (existing?.website !== entry.website || existing.category !== entry.category) throw new Error("Seed company provenance conflict");
    }
    for (const entry of propertyAliasSeed) {
      const [property] = await tx.select().from(companies).where(eq(companies.id, entry.companyId));
      // Require provenance for this exact property, not just any brand page.
      if (!property || !exactPropertyAliasProvenance(entry.sourceUrl, property)) {
        throw new Error("Seed alias provenance conflict");
      }
      await tx.insert(propertyAliases).values({ ...entry, reviewedAt: aliasReviewedAt }).onConflictDoNothing();
      const [existing] = await tx.select().from(propertyAliases).where(eq(propertyAliases.id, entry.id));
      // Operator reviews own mutable provenance and retirement. Never resurrect
      // retired seed spellings or overwrite a newer spelling review.
      if (!existing || existing.companyId !== entry.companyId ||
          existing.kind !== entry.kind || existing.locale !== entry.locale) {
        throw new Error("Seed alias conflict");
      }
    }
    await assertPropertyIdentities(tx);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
seedDirectory().then(() => logger.info("Official travel directory seed applied"))
  .catch(() => { logger.error("Directory seed failed; verify database setup"); process.exitCode = 1; })
  .finally(() => pool.end());
}

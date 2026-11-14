import { db, pool, companies, officialContacts, contactSources } from "@workspace/db";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { logger } from "../lib/logger";
import { SOURCE_MAX_AGE_DAYS } from "./policy";
import { eq } from "drizzle-orm";
import type { TravelCategory } from "@workspace/api-zod";
import { pathToFileURL } from "node:url";
import { officialProvenance } from "./source-policy";

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

// No invented phone contacts: these companies direct users to their official help
// sites until a specific number and its regional/service scope can be reviewed.
const websiteOnlySeed = [
  { id: "booking", name: "Booking.com", category: "booking_service", website: "https://www.booking.com" },
  { id: "viator", name: "Viator", category: "tour", website: "https://www.viator.com/help" },
] as const;

export async function seedDirectory(database: Pick<typeof db, "transaction"> = db) {
  await database.transaction(async (tx) => {
    for (const entry of [...airlineSeed.map(entry => ({ ...entry, category: "airline" as const, reviewedAt })), ...travelSeed.map(entry => ({ ...entry, reviewedAt: travelReviewedAt }))]) {
      if (parsePhoneNumberFromString(entry.number)?.number !== entry.number ||
          !parsePhoneNumberFromString(entry.number)?.isValid() ||
          !officialProvenance(entry.sourceUrl, entry.website)) throw new Error("Invalid seed provenance");
      await tx.insert(companies).values({ id: entry.id, name: entry.name, website: entry.website, category: entry.category satisfies TravelCategory }).onConflictDoNothing();
      const [existingCompany] = await tx.select().from(companies).where(eq(companies.id, entry.id));
      if (existingCompany?.website !== entry.website || existingCompany.category !== entry.category) throw new Error("Seed company provenance conflict");
      const contactId = `${entry.id}-reservations`;
      await tx.insert(officialContacts).values({ id: contactId, companyId: entry.id, number: entry.number, region: entry.region, service: entry.service }).onConflictDoNothing();
      const [existingContact] = await tx.select().from(officialContacts).where(eq(officialContacts.id, contactId));
      if (existingContact?.number !== entry.number || existingContact.companyId !== entry.id ||
          existingContact.region !== entry.region || existingContact.service !== entry.service) throw new Error("Seed contact conflict");
      await tx.insert(contactSources).values({
        id: `${contactId}-2026-11-14`, contactId, sourceUrl: entry.sourceUrl,
        sourceName: `${entry.name} official website`, assertion: "listed", reviewedAt: entry.reviewedAt,
        expiresAt: new Date(entry.reviewedAt.getTime() + SOURCE_MAX_AGE_DAYS * 86400000),
      }).onConflictDoNothing();
    }
    for (const entry of websiteOnlySeed) {
      await tx.insert(companies).values(entry).onConflictDoNothing();
      const [existing] = await tx.select().from(companies).where(eq(companies.id, entry.id));
      if (existing?.website !== entry.website || existing.category !== entry.category) throw new Error("Seed company provenance conflict");
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
seedDirectory().then(() => logger.info("Official travel directory seed applied"))
  .catch(() => { logger.error("Directory seed failed; verify database setup"); process.exitCode = 1; })
  .finally(() => pool.end());
}

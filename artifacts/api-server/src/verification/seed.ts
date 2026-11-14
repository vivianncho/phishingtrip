import { db, pool, companies, officialContacts, contactSources } from "@workspace/db";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { logger } from "../lib/logger";
import { SOURCE_MAX_AGE_DAYS } from "./policy";
import { eq } from "drizzle-orm";

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

async function seed() {
  await db.transaction(async (tx) => {
    for (const entry of airlineSeed) {
      if (parsePhoneNumberFromString(entry.number)?.number !== entry.number ||
          !parsePhoneNumberFromString(entry.number)?.isValid() ||
          new URL(entry.sourceUrl).origin !== new URL(entry.website).origin) throw new Error("Invalid seed provenance");
      await tx.insert(companies).values({ id: entry.id, name: entry.name, website: entry.website, category: "airline" }).onConflictDoNothing();
      const [existingCompany] = await tx.select().from(companies).where(eq(companies.id, entry.id));
      if (existingCompany?.website !== entry.website) throw new Error("Seed company provenance conflict");
      const contactId = `${entry.id}-reservations`;
      await tx.insert(officialContacts).values({ id: contactId, companyId: entry.id, number: entry.number, region: entry.region, service: entry.service }).onConflictDoNothing();
      const [existingContact] = await tx.select().from(officialContacts).where(eq(officialContacts.id, contactId));
      if (existingContact?.number !== entry.number || existingContact.companyId !== entry.id ||
          existingContact.region !== entry.region || existingContact.service !== entry.service) throw new Error("Seed contact conflict");
      await tx.insert(contactSources).values({
        id: `${contactId}-2026-11-14`, contactId, sourceUrl: entry.sourceUrl,
        sourceName: `${entry.name} official website`, assertion: "listed", reviewedAt,
        expiresAt: new Date(reviewedAt.getTime() + SOURCE_MAX_AGE_DAYS * 86400000),
      }).onConflictDoNothing();
    }
  });
}
seed().then(() => logger.info("Official airline directory seed applied"))
  .catch(() => { logger.error("Directory seed failed; verify database setup"); process.exitCode = 1; })
  .finally(() => pool.end());

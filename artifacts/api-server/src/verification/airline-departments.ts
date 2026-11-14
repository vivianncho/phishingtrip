import { db, companies, officialContacts, contactSources } from "@workspace/db";
import { eq } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { SOURCE_MAX_AGE_DAYS } from "./policy";
import { officialProvenance } from "./source-policy";

// Individually inspected official pages, not search snippets or Google listings.
// Fixed source-review instant: importing again is NOT a new review.
export const airlineDepartmentReviewedAt = new Date("2026-11-14T22:54:28Z");
export const airlineDepartmentSeed = [
  {
    id: "delta-baggage-us", companyId: "delta", companyName: "Delta Air Lines",
    website: "https://www.delta.com", number: "+18003258224", region: "United States",
    service: "Baggage support — damaged, delayed or lost checked bags",
    sourceUrl: "https://www.delta.com/us/en/baggage/delayed-lost-damaged-baggage",
    evidence: 'When to Contact Us / Within the U.S. / Call us toll-free at 1-800-325-8224',
  },
  {
    id: "united-baggage-us-canada", companyId: "united", companyName: "United Airlines",
    website: "https://www.united.com", number: "+18003352247", region: "United States and Canada",
    service: "Baggage Recovery Center — English and Spanish",
    sourceUrl: "https://www.united.com/en/us/fly/help/contact-reservations.html",
    evidence: 'Baggage Recovery Center / 1-800-335-2247 / Toll-free if you are calling from the U.S. and Canada; Service is available in English and Spanish only',
  },
  {
    id: "united-ticket-changes-spanish", companyId: "united", companyName: "United Airlines",
    website: "https://www.united.com", number: "+18004265561", region: "United States and Canada",
    service: "Reservations and ticket changes — Spanish",
    sourceUrl: "https://www.united.com/en/us/fly/help/contact-reservations.html",
    evidence: 'Contact us for help with buying tickets or making changes to an existing trip. / These numbers should be used when calling from the U.S. and Canada. / Spanish | 1-800-426-5561',
  },
  {
    id: "american-ticket-changes-spanish", companyId: "american", companyName: "American Airlines",
    website: "https://www.aa.com", number: "+18006333711", region: "United States and Canada",
    service: "Reservations and ticket changes — Spanish",
    sourceUrl: "https://www.aa.com/i18n/customer-service/contact-american/reservations-and-ticket-changes.jsp",
    evidence: 'Reservations and ticket changes / Within the U.S. and Canada / Spanish | 800-633-3711',
  },
] as const;

// Called inside the main seed transaction, after the existing companies.
export async function seedAirlineDepartments(database: Pick<typeof db, "select" | "insert">) {
  for (const entry of airlineDepartmentSeed) {
    const parsed = parsePhoneNumberFromString(entry.number);
    if (!parsed?.isValid() || parsed.number !== entry.number ||
        !officialProvenance(entry.sourceUrl, entry.website)) throw new Error("Invalid airline department provenance");
    const [company] = await database.select().from(companies).where(eq(companies.id, entry.companyId));
    if (!company || company.name !== entry.companyName || company.website !== entry.website ||
        company.category !== "airline" || company.listingType !== "organization") {
      throw new Error("Airline department company identity conflict");
    }
    // serviceType describes property routing; the exact department/language
    // belongs in service, as confirmed by the existing source-review workflow.
    const contact = {
      id: entry.id, companyId: entry.companyId, number: entry.number,
      region: entry.region, service: entry.service, serviceType: "general" as const,
    };
    await database.insert(officialContacts).values(contact).onConflictDoNothing();
    const [existing] = await database.select().from(officialContacts).where(eq(officialContacts.id, entry.id));
    if (!existing || Object.entries(contact).some(([key, value]) => existing[key as keyof typeof existing] !== value)) {
      throw new Error("Airline department contact conflict");
    }
    const sourceId = `${entry.id}-2026-11-14`;
    await database.insert(contactSources).values({
      id: sourceId, contactId: entry.id, sourceUrl: entry.sourceUrl,
      sourceName: `${entry.companyName} official website`, assertion: "listed",
      reviewedAt: airlineDepartmentReviewedAt,
      expiresAt: new Date(airlineDepartmentReviewedAt.getTime() + SOURCE_MAX_AGE_DAYS * 86400000),
    }).onConflictDoNothing();
    const [source] = await database.select().from(contactSources).where(eq(contactSources.id, sourceId));
    if (!source || source.contactId !== entry.id) throw new Error("Airline department source identity conflict");
    // Operators own mutable source URLs, dates and disputes. Never overwrite
    // their review, resurrect stale evidence, or remove another source's dispute.
  }
}

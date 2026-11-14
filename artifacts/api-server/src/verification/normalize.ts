import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { ApiFault } from "./policy";

export function normalize(phoneNumber: string, defaultCountry?: string) {
  const input = phoneNumber.trim();
  if (defaultCountry && !isSupportedCountry(defaultCountry)) throw new ApiFault(400, "INVALID_COUNTRY", "Use a supported ISO two-letter country.");
  if (!/^\+?[\d ()\u002d.]+$/.test(input)) throw new ApiFault(400, "INVALID_NUMBER", "Enter only a complete phone number without extensions or text.");
  if (!input.startsWith("+") && !defaultCountry) throw new ApiFault(400, "COUNTRY_REQUIRED", "Select a default country or use a number beginning with + and its country code.");
  const parsed = parsePhoneNumberFromString(input, { defaultCountry: defaultCountry as CountryCode | undefined, extract: false });
  if (!parsed || parsed.ext || !parsed.isValid()) throw new ApiFault(400, "INVALID_NUMBER", "The number is not valid for the selected numbering plan.");
  return { number: parsed.number as string, countryCode: parsed.country ?? null };
}

import { getCountries, isSupportedCountry } from "libphonenumber-js/max";
import { sql } from "drizzle-orm";

// Use the same metadata as phone validation, including supported territories.
// Persist canonical codes only: do not trim, uppercase, or guess import values.
export const supportedCountryCodes = Object.freeze(getCountries().sort());
export { isSupportedCountry };
export const supportedCountryCodesSql = sql.join(
  supportedCountryCodes.map((code) => sql.raw(`'${code}'`)), sql`, `,
);

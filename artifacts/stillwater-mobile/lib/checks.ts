import { getCountries } from 'libphonenumber-js/min';
import type { CheckInput, CheckResult } from '@workspace/api-client-react';

export const INTERNATIONAL = 'international';
export const countryCodes = getCountries();

export function makeCheckInput(number: string, country: string, companyId?: string): CheckInput {
  const phoneNumber = number.trim();
  if (!country) throw new Error('Choose the number’s country or international format first.');
  if (country !== INTERNATIONAL && !countryCodes.includes(country as typeof countryCodes[number])) {
    throw new Error('Choose a supported country.');
  }
  if (phoneNumber.length < 3 || phoneNumber.length > 64 || !/^\+?[\d\s().-]+$/.test(phoneNumber)) {
    throw new Error('Enter one complete phone number, without a URL, words or an extension.');
  }
  if (country === INTERNATIONAL && !phoneNumber.startsWith('+')) {
    throw new Error('International format needs + and the country calling code.');
  }
  return {
    phoneNumber,
    ...(country === INTERNATIONAL ? {} : { defaultCountry: country }),
    ...(companyId ? { claimedCompanyId: companyId } : {}),
  };
}

export function fishCaption(result: CheckResult | null, pending: boolean): string {
  if (pending) return 'Hook is checking the available evidence…';
  if (!result) return 'One step at a time. Hook is here with you.';
  if (result.outcome === 'official_match') return 'A listed contact, not a guarantee. Take your time.';
  if (result.outcome === 'reports_found') return 'Pause before calling. There’s another way to get help.';
  return 'Not sure yet. Red means pause—not proof of a scam.';
}

export function problemText(error: unknown): string {
  const problem = error as { status?: number; data?: { code?: string }; headers?: Headers };
  if (problem.status === 429) {
    const seconds = Number(problem.headers?.get('Retry-After'));
    return seconds > 0 && seconds < 3600
      ? `Too many requests. Try again in ${Math.ceil(seconds)} seconds.`
      : 'Too many requests. Wait a minute, then tap to try again.';
  }
  switch (problem.data?.code) {
    case 'INVALID_NUMBER': return 'This is not a complete valid phone number. Check the digits and selected country.';
    case 'COUNTRY_REQUIRED': case 'INVALID_COUNTRY': return 'Choose the number’s country or use international format with +.';
    case 'COMPANY_NOT_FOUND': return 'That company is no longer listed. Choose another company or “Not sure”.';
    case 'DIRECTORY_UNAVAILABLE': return 'The directory is unavailable. No conclusion was reached. Try again later.';
    default: return 'We couldn’t reach the evidence service. No conclusion was reached. Check your connection and tap to retry.';
  }
}

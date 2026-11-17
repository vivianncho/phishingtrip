import type { CheckInput, OfficialContact } from '@workspace/api-client-react';

export function makeInput(number: string, country: string, companyId: string, service: string): CheckInput {
  const phoneNumber = number.trim();
  if (!country) throw new Error('Choose the number’s country or international format first.');
  if (phoneNumber.length < 3 || phoneNumber.length > 64 || !/^\+?[\d\s().-]+$/.test(phoneNumber)) throw new Error('Enter one complete number, without words, URLs or extensions.');
  if (country === 'international' && !phoneNumber.startsWith('+')) throw new Error('International format needs + and the country calling code.');
  return { phoneNumber, ...(country !== 'international' ? { defaultCountry: country } : {}), ...(companyId ? { claimedCompanyId: companyId } : {}), ...(service ? { claimedService: service as CheckInput['claimedService'] } : {}) };
}
export function samePhone(a: string, b: string) { return a.replace(/\D/g, '') === b.replace(/\D/g, ''); }
export function topic(problem: string) {
  if (/\bbag(?:gage|s)?\b|luggage/i.test(problem)) return { title: 'Baggage help', terms: /baggage|luggage|bags/i, advice: 'Use a published baggage contact or the airline’s baggage website. A reservations line is not confirmed baggage support.' };
  if (/flight|airline|fly|ticket/i.test(problem)) return { title: 'Flight or ticket help', terms: /(?:flight|ticket|trip)\s+changes?|rebooking/i, advice: 'Start with the airline or agency that issued your ticket. Ask about fare differences before agreeing.' };
  if (/hotel|room|check.?in|stay|accommodation/i.test(problem)) return { title: 'Hotel or booking help', terms: /reservation|property|front desk|hotel/i, advice: 'Confirm the exact hotel and city. A published property main number is not necessarily a direct front-desk line.' };
  if (/car|rental|vehicle/i.test(problem)) return { title: 'Rental help', terms: /reservation|rental|customer|general/i, advice: 'Confirm your pickup branch and booking company before changing a rental.' };
  return { title: 'Travel support', terms: /customer|general|reservation|support/i, advice: 'Start with the business on your booking confirmation. Ask whether the published department can handle your issue.' };
}
export function eligible(contacts: OfficialContact[], excluded: string) {
  return contacts.filter(c => c.freshness === 'current' && !c.sources.some(s => s.assertion === 'disputed') && !samePhone(c.number, excluded));
}
export function date(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Not available' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
export const asset = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;
export function safeUrl(value?: string) { try { const u = new URL(value || ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } }

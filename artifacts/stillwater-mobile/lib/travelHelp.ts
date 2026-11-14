import type { OfficialContact } from '@workspace/api-client-react';

export function travelHelpTopic(problem: string) {
  const text = problem.toLowerCase();
  if (/\bbag(?:gage|s)?\b|\bluggage\b/.test(text)) return {
    title: 'Baggage help', terms: /\bbaggage\b|\bluggage\b|\bbags?\b/i,
    advice: 'For lost or delayed bags, use a published baggage contact or the airline’s baggage website. A reservations line is not confirmed baggage support.',
  };
  if (/flight|airline|fly|ticket/.test(text)) return {
    title: 'Flight or ticket help', terms: /(?:flight|ticket|trip)\s+changes?|rebooking/i,
    advice: 'For a flight-time change, start with the airline or agency that issued your ticket. Ask about fare differences before agreeing.',
  };
  if (/hotel|room|check.?in|stay|accommodation/.test(text)) return {
    title: 'Hotel or booking help', terms: /reservation|property|front desk|hotel/i,
    advice: 'Confirm the exact hotel and city. A property’s main number is not necessarily a direct front-desk line.',
  };
  if (/car|rental|vehicle/.test(text)) return {
    title: 'Rental help', terms: /reservation|rental|customer|general/i,
    advice: 'Confirm the pickup branch and booking company before changing a rental.',
  };
  return {
    title: 'Travel support', terms: /customer|general|reservation|support/i,
    advice: 'Start with the business on your booking confirmation. Ask whether the published department can handle your issue.',
  };
}

export function samePhone(a: string, b: string) {
  return a.replace(/\D/g, '') === b.replace(/\D/g, '');
}

export function travelHelpContacts(contacts: OfficialContact[], problem: string, excludedNumber: string) {
  const topic = travelHelpTopic(problem);
  const eligible = contacts.filter(c => c.freshness === 'current' &&
    !c.sources.some(source => source.assertion === 'disputed') &&
    !samePhone(c.number, excludedNumber));
  return {
    matching: eligible.filter(c => topic.terms.test(c.service)),
    other: eligible.filter(c => !topic.terms.test(c.service)),
  };
}

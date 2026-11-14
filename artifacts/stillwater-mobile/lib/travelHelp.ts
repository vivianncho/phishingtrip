export function travelHelpTopic(problem: string) {
  const text = problem.toLowerCase();
  if (/\bbag(?:gage|s)?\b|\bluggage\b/.test(text)) return {
    title: 'Baggage help', terms: /baggage|luggage|lost/i,
    advice: 'For lost or delayed bags, ask the airline’s baggage team. General reservations may need to transfer you.',
  };
  if (/flight|airline|fly|ticket/.test(text)) return {
    title: 'Flight or ticket help', terms: /reservation|booking|sales|ticket|customer/i,
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

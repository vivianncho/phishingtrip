// Independent expected values: never derive these from the component's dataset,
// or a swapped number/verdict could change both the test and implementation.
export const scenarios = [
  { verdict: 'official', number: '+1 (202) 555-0142', label: 'Official match' },
  { verdict: 'suspicious', number: '+1 (202) 555-0187', label: 'Reports found' },
  { verdict: 'unverified', number: '+1 (202) 555-0116', label: 'Not verified' },
] as const;

export const contacts = [
  { id: 'aer', name: 'Aster Air', number: '+1 (202) 555-0142' },
  { id: 'hotel', name: 'The Cove Hotel', number: '+1 (202) 555-0168' },
  { id: 'rail', name: 'Northline Rail', number: '+1 (202) 555-0193' },
  { id: 'rental', name: 'Drift Car Rental', number: '+1 (202) 555-0124' },
  { id: 'stays', name: 'Nest Vacation Stays', number: '+1 (202) 555-0136' },
  { id: 'booking', name: 'Wayfarer Bookings', number: '+1 (202) 555-0151' },
  { id: 'cruise', name: 'Bluewake Cruises', number: '+1 (202) 555-0174' },
  { id: 'tours', name: 'Roam Local Tours', number: '+1 (202) 555-0182' },
] as const;

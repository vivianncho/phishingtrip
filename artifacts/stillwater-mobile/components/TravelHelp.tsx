import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listCompanies, type CompanyPage } from '@workspace/api-client-react';
import { Busy, Button, Contact, Copy, s, WebLink } from './Ocean';
import { CallOption } from './CallOption';
import { PlacesSearch } from './PlacesSearch';
import { useColors } from '@/hooks/useColors';
import { travelHelpContacts, travelHelpTopic } from '@/lib/travelHelp';

export function TravelHelp({ excludedNumber, initialCompany = '', onSelect }: {
  excludedNumber: string; initialCompany?: string; onSelect: (number: string, companyId: string) => void;
}) {
  const colors = useColors();
  const [problem, setProblem] = useState('');
  const [company, setCompany] = useState(initialCompany);
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<CompanyPage | null>(null);
  const [submitted, setSubmitted] = useState<{ company: string; location: string; problem: string } | null>(null);
  const [google, setGoogle] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const version = useRef(0), lock = useRef(false);
  const invalidate = useCallback(() => {
    version.current++; request.current?.abort(); lock.current = false;
    setResults(null); setSubmitted(null); setGoogle(false); setPending(false); setError('');
  }, []);
  const clear = useCallback(() => {
    invalidate(); setProblem(''); setCompany(''); setLocation('');
  }, [invalidate]);
  useFocusEffect(useCallback(() => () => clear(), [clear]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') clear(); });
    return () => subscription.remove();
  }, [clear]);
  async function find() {
    if (lock.current || !problem.trim() || company.trim().length < 2) return;
    invalidate(); lock.current = true;
    const current = version.current;
    const input = { company: company.trim(), location: location.trim(), problem: problem.trim() };
    const controller = new AbortController(); request.current = controller;
    setPending(true); setSubmitted(input);
    try {
      const data = await listCompanies({ search: input.company, city: input.location || undefined, limit: 20 },
        { signal: controller.signal, cache: 'no-store' });
      if (current === version.current) setResults(data);
    } catch {
      if (current === version.current) setError('Sourced contacts couldn’t load. Try again, or search Google listings below.');
    } finally {
      if (current === version.current) { setPending(false); lock.current = false; }
    }
  }
  const topic = travelHelpTopic(submitted?.problem ?? problem);
  const inputStyle = [s.input, { minHeight: 52 }];
  return <View testID="travel-help" style={[s.card, { gap: 12 }]}>
    <Copy style={s.h2}>Let’s find another way.</Copy>
    <Copy>What do you need help with?</Copy>
    <TextInput testID="travel-problem" accessibilityLabel="Your travel problem" style={[s.input, { minHeight: 88, textAlignVertical: 'top' }]}
      placeholder="e.g. I need to change my flight time" placeholderTextColor={colors.mutedForeground}
      value={problem} multiline maxLength={240} onChangeText={value => { invalidate(); setProblem(value); }} />
    <Copy style={s.small}>No booking codes, passwords or payment details. Your problem stays on this device and is not sent to Google.</Copy>
    <TextInput testID="help-company" accessibilityLabel="Airline, hotel or travel company" style={inputStyle} maxLength={80}
      placeholder="Airline, hotel or company name" placeholderTextColor={colors.mutedForeground}
      value={company} onChangeText={value => { invalidate(); setCompany(value); }} />
    <TextInput testID="help-city" accessibilityLabel="City for a hotel or local branch, optional" style={inputStyle} maxLength={35}
      placeholder="City for a hotel or branch (optional)" placeholderTextColor={colors.mutedForeground}
      value={location} onChangeText={value => { invalidate(); setLocation(value); }} />
    <Button title="Find contact options" testID="find-help" disabled={pending || !problem.trim() || company.trim().length < 2}
      onPress={() => { void find(); }} icon="search-outline" />
    {pending && <Busy text="Finding sourced contacts…" />}
    {submitted && !pending && <>
      <Copy style={s.eyebrow}>{topic.title}</Copy>
      <Copy>{topic.advice}</Copy>
      {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
      {results && <>
        <Copy style={s.small}>SOURCED OPTIONS · Confirm the company, dialing region, language and published service before calling.</Copy>
        {!results.items.length && <Copy>No sourced company matched. Try the exact name, remove the city for a brand-wide service, or use Google below.</Copy>}
        {results.items.map(business => {
          const { matching, other } = travelHelpContacts(business.contacts, submitted.problem, excludedNumber);
          const contacts = [...matching, ...other];
          return <View key={business.id} style={{ gap: 10 }}>
            <Copy style={s.h2}>{business.name}</Copy>
            {!!business.city && <Copy>{business.city} · {business.countryCode}</Copy>}
            <WebLink url={business.website} title={`${business.name} website`} />
            {!!contacts.length && !matching.length && <Copy>No current department match for this issue. Use the official website or ask another published contact where to get help.</Copy>}
            {!contacts.length && <Copy>No different current phone contact is available. Use the company’s website rather than the number you just checked.</Copy>}
            {contacts.slice(0, 3).map(contact => <View key={contact.id}>
              <Copy style={s.small}>{matching.includes(contact) ? 'Published service matches your issue' : 'Other published contact — help with this issue is not confirmed'}</Copy>
              <Contact contact={contact} onSelect={() => onSelect(contact.number, business.id)} />
              <CallOption number={contact.number} />
            </View>)}
          </View>;
        })}
        {results.nextOffset != null && <Copy style={s.small}>More matches exist. Narrow the company name or city to find the exact business.</Copy>}
      </>}
      {!google ? <Button title="Find more with Google Places" testID="help-google" secondary onPress={() => setGoogle(true)} /> :
        <PlacesSearch initialQuery={`${submitted.company} ${submitted.location}`.trim()} excludedNumber={excludedNumber}
          onUseNumber={number => onSelect(number, '')} allowCalls />}
    </>}
  </View>;
}

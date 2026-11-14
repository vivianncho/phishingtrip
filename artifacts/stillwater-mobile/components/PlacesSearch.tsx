import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { searchTravelPlaces, type PlaceSearchResult } from '@workspace/api-client-react';
import { Busy, Button, Copy, WebLink, s } from './Ocean';
import { useCompanion } from '@/context/Companion';
import { useColors } from '@/hooks/useColors';
import { CallOption } from './CallOption';
import { samePhone } from '@/lib/travelHelp';

function searchError(error: unknown): string {
  const problem = error as { status?: number; data?: { code?: string } };
  switch (problem?.data?.code) {
    case 'PLACES_DAILY_LIMIT': return 'Today’s 10 Google searches have been used across the app. Try after midnight UTC, or choose Sourced contacts.';
    case 'PLACES_NOT_CONFIGURED': case 'PLACES_ACCESS_ERROR': return 'Google search isn’t set up yet. You can still choose Sourced contacts.';
    case 'PLACES_UNAVAILABLE': return 'Google search couldn’t finish. The attempt may count toward today’s limit. No conclusion was reached.';
    case 'INVALID_INPUT': return 'Use a business name and city, or a full international number. Don’t include private booking details.';
  }
  if (problem?.status === 429) return 'Too many requests. Wait a moment before trying again.';
  return 'Google search couldn’t finish. Check your connection. This does not mean a number is fraudulent.';
}

/** Uses the generated imperative client, like Check, so blur/background can abort
 * requests and discard results rather than putting Google content in a cache. */
export function PlacesSearch({ initialQuery = '', excludedNumber, onUseNumber, allowCalls = false }: {
  initialQuery?: string; excludedNumber?: string; onUseNumber?: (number: string) => void; allowCalls?: boolean;
}) {
  const colors = useColors();
  const { setDraft } = useCompanion();
  const [query, setQuery] = useState(initialQuery);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PlaceSearchResult | null>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState('');
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const locked = useRef(false);
  const clear = useCallback(() => {
    version.current++;
    controller.current?.abort();
    locked.current = false;
    setPending(false); setResult(null); setError(''); setQuery(''); setSubmitted('');
  }, []);
  useFocusEffect(useCallback(() => () => clear(), [clear]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') clear(); });
    return () => subscription.remove();
  }, [clear]);
  async function search() {
    const text = query.trim();
    if (locked.current || text.length < 3) return;
    locked.current = true;
    const current = ++version.current;
    const request = new AbortController();
    controller.current = request;
    setResult(null); setError(''); setPending(true); setSubmitted(text);
    try {
      const data = await searchTravelPlaces({ query: text }, { signal: request.signal, cache: 'no-store' });
      if (version.current === current) setResult(data);
    } catch (e) {
      if (version.current === current) setError(searchError(e));
    } finally {
      if (version.current === current) { locked.current = false; setPending(false); }
    }
  }
  return <View style={[s.card, { gap: 12 }]}>
    <Copy style={s.h2}>Find a travel business.</Copy>
    <Copy style={s.muted}>Hotel, car rental, rail or tour? Try its name and city, or a full number with + country code.</Copy>
    <TextInput testID="places-query" accessibilityLabel="Google Places business name, city or international phone number"
      value={query} onChangeText={setQuery} editable={!pending} maxLength={120} autoCorrect={false}
      style={s.input} placeholder="Hotel name + city" placeholderTextColor={colors.mutedForeground}
      returnKeyType="search" onSubmitEditing={() => { void search(); }} />
    <Copy style={s.small}>Only tapping Search sends this text to Google. 10 searches daily across the app; failed attempts count. Listings are not scam checks.</Copy>
    <Button testID="search-places" title="Search Google Places" icon="search-outline"
      disabled={pending || query.trim().length < 3} onPress={() => { void search(); }} />
    {pending && <Busy text="Looking up listings…" />}
    {!!error && <Copy testID="places-error" accessibilityRole="alert">{error}</Copy>}
    {result && <View testID="places-results" style={{ gap: 12 }}>
      <Copy style={s.small}>Results for “{submitted}” · not independently verified</Copy>
      {!result.items.length && <Copy>No listing found. This is not evidence of fraud. Try your booking confirmation or the company’s own app.</Copy>}
      {result.items.filter(place => !excludedNumber || !place.phone || !samePhone(place.phone, excludedNumber)).map(place => <View key={place.id} style={[s.card, { gap: 8 }]}>
        <Copy style={s.h2}>{place.name}</Copy>
        {!!place.address && <Copy style={s.small}>{place.address}</Copy>}
        <Copy selectable>{place.phone ?? 'No phone listed'}</Copy>
        <Copy style={s.small}>Google listing, not a verified official contact. A hotel number may be a main line, not its front desk.</Copy>
        {place.website && <WebLink url={place.website} title="Listed website" />}
        {place.mapsUrl && <WebLink url={place.mapsUrl} title="View on Google Maps" />}
        {place.attributions.map((a, i) => a.uri
          ? <WebLink key={i} url={a.uri} title={a.name} />
          : <Copy key={i} style={s.small}>{a.name}</Copy>)}
        {place.phone && <Button testID={`check-place-${place.id}`} title="Use number in Check" secondary onPress={() => {
          if (onUseNumber) { onUseNumber(place.phone!); return; }
          setDraft({ number: place.phone!, country: '', companyId: '' });
          router.push('/');
        }} />}
        {allowCalls && place.phone && <CallOption number={place.phone} listed />}
      </View>)}
      {excludedNumber && result.items.length > 0 && result.items.every(place => !!place.phone && samePhone(place.phone, excludedNumber)) &&
        <Copy>No different number found. Use your booking confirmation or the company’s official website instead.</Copy>}
      <Copy style={s.small}>Google orders results by relevance, including your search terms, location and business prominence.</Copy>
    </View>}
    <View style={{ paddingTop: 10, paddingHorizontal: 10, paddingBottom: 5 }}>
      <Image source={require('../assets/images/google-maps-attribution.png')} accessibilityLabel="Google Maps"
        style={{ width: 98, height: 18 }} resizeMode="contain" />
    </View>
    <Button testID="places-privacy" title="Privacy & terms" secondary onPress={() => router.push('/help')} />
    <WebLink url="https://policies.google.com/privacy" title="Google Privacy Policy" />
    <WebLink url="https://maps.google.com/help/terms_maps/" title="Google Maps Terms" />
  </View>;
}

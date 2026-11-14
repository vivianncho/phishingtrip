import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { checkNumber, useGetCapabilities, useListCompanies, type CheckResult } from '@workspace/api-client-react';
import { useCompanion } from '@/context/Companion';
import { Hook } from '@/components/Hook';
import { Busy, Button, Contact, Copy, ErrorCard, Page, Providers, Source, dateText, s } from '@/components/Ocean';
import { INTERNATIONAL, makeCheckInput, problemText } from '@/lib/checks';
import { useColors } from '@/hooks/useColors';
import { TravelHelp } from '@/components/TravelHelp';

export default function CheckScreen() {
  const colors = useColors();
  const { draft, setDraft } = useCompanion();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const lock = useRef(false);
  const capabilities = useGetCapabilities({ query: { staleTime: 30_000 } });
  const companies = useListCompanies({ limit: 50 }, { query: { staleTime: 30_000 } });

  const clearResult = useCallback(() => {
    version.current += 1;
    controller.current?.abort();
    lock.current = false;
    setPending(false); setResult(null); setError(''); setEvidenceOpen(false);
  }, []);
  useFocusEffect(useCallback(() => () => clearResult(), [clearResult]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') clearResult(); });
    return () => subscription.remove();
  }, [clearResult]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !evidenceOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setEvidenceOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [evidenceOpen]);

  async function submit() {
    if (lock.current) return;
    let data;
    try { data = makeCheckInput(draft.number, draft.country, draft.companyId); }
    catch (cause) { setError((cause as Error).message); return; }
    clearResult();
    lock.current = true;
    setPending(true);
    const current = version.current;
    const request = new AbortController();
    controller.current = request;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; request.abort(); }, 15_000);
    void Haptics.selectionAsync().catch(() => {});
    try {
      // The generated imperative helper deliberately avoids retaining submitted
      // numbers/results in React Query's mutation cache. No local fetch layer.
      const response = await checkNumber(data, { signal: request.signal, cache: 'no-store' });
      if (current !== version.current) return;
      setResult(response);
      AccessibilityInfo.announceForAccessibility(`${response.label}. ${response.explanation}`);
    } catch (cause) {
      if (current !== version.current) return;
      setError(timedOut ? 'The check timed out. No conclusion was reached. Tap to try again.' : problemText(cause));
    } finally {
      clearTimeout(timeout);
      if (current === version.current) { setPending(false); lock.current = false; }
    }
  }
  const countryLabel = draft.country === INTERNATIONAL ? 'International format (+ country code)' : draft.country ? `Country: ${draft.country}` : 'Choose the number’s country';
  const selectedCompany = companies.data?.items.find(company => company.id === draft.companyId);
  function chooseAlternative(number: string, companyId: string) {
    clearResult();
    setDraft({ number, country: '', companyId });
  }
  return <Page tabs>
    <View style={{ gap: 10 }}>
      <Copy style={s.eyebrow}>A LITTLE CALM. A CLEARER CALL.</Copy>
      <Copy style={s.heading}>{pending ? 'One moment.\n' : result ? 'Good instincts.\n' : 'Before you call,\n'}<Copy style={[s.heading, s.accent]}>{pending ? 'Checking the waters.' : result ? 'Let’s take a look.' : 'check the waters.'}</Copy></Copy>
      {!result && !pending && <Copy style={s.muted}>Travel feels stressful enough. Check a number before you make the call.</Copy>}
    </View>
    <Hook result={result} pending={pending} />
    {!result && <View style={{ gap: 12 }}>
      <Copy style={s.small}>ONE NUMBER. YOUR CHOICE TO CHECK.</Copy>
      <TextInput testID="phone-number" accessibilityLabel="Phone number to check" style={s.input} value={draft.number}
        onChangeText={number => { clearResult(); setDraft(value => ({ ...value, number })); }}
        placeholder="+1 800 000 0000" placeholderTextColor={colors.mutedForeground}
        keyboardType="phone-pad" textContentType="none" autoComplete="off" autoCorrect={false} maxLength={64} editable={!pending} />
      <Button title={countryLabel} testID="choose-country" secondary icon="globe-outline" disabled={pending} onPress={() => router.push('/country')} />
      <Copy style={s.small}>Select the number’s country, not your current location. A leading + country code takes precedence.</Copy>
      <Copy style={s.small}>CLAIMED COMPANY · OPTIONAL</Copy>
      {companies.isPending ? <Busy text="Loading company choices…" /> : companies.isError ?
        <ErrorCard text="Company choices couldn’t load. You can still check without a company claim." retry={() => { void companies.refetch(); }} /> :
        <View style={s.wrap}>
          {[{ id: '', name: 'Not sure' }, ...(companies.data?.items ?? [])].map(company =>
            <Pressable key={company.id} testID={`claim-${company.id || 'none'}`} accessibilityRole="radio" accessibilityState={{ checked: draft.companyId === company.id, disabled: pending }} disabled={pending}
              onPress={() => { clearResult(); setDraft(value => ({ ...value, companyId: company.id })); }}
              style={[s.chip, draft.companyId === company.id && s.selected]}>
              <Copy style={{ fontSize: 12 }}>{company.name}</Copy>
            </Pressable>)}
        </View>}
      {!!draft.companyId && !selectedCompany && <Copy style={s.small}>Selected company: {draft.companyId}. You can change this above.</Copy>}
      {!!error && <ErrorCard text={error} />}
      {pending ? <Busy text="Checking the available evidence…" /> : <Button title={error ? 'Try this check again' : 'Check the number'} icon="shield-checkmark-outline" testID="check-number" onPress={submit} />}
      {pending && <Button title="Cancel check" secondary testID="cancel-check" onPress={clearResult} />}
      <Copy style={s.small}>Only this number, your selected country and optional company are sent when you tap. If enabled, Twilio Basic also receives the number for formatting metadata.</Copy>
    </View>}
    {result && <View style={{ gap: 14 }} accessibilityLiveRegion="polite">
      <View style={[s.card, { borderColor: result.outcome === 'official_match' ? colors.primary : colors.destructive }]}>
        <Copy style={s.eyebrow}>EVIDENCE RESULT · NOT A SAFETY VERDICT</Copy>
        <View style={s.row}><Ionicons name={result.outcome === 'official_match' ? 'shield-checkmark-outline' : 'warning-outline'} size={26} color={result.outcome === 'official_match' ? colors.primary : colors.destructive} /><Copy testID="result-label" accessibilityRole="header" style={[s.h2, { flexShrink: 1 }, result.outcome === 'not_verified' && { color: colors.destructive, fontFamily: 'DMSans_700Bold', fontWeight: '700' }]}>{result.label}</Copy></View>
        {result.outcome === 'not_verified' && <View style={{ gap: 6 }}>
          <Copy testID="unverified-warning" style={{ color: colors.destructive, fontFamily: 'DMSans_700Bold', fontWeight: '700', fontSize: 18, lineHeight: 25 }}>Pause before calling.</Copy>
          <Copy>This number is not verified. Check your booking confirmation or the company’s official website. This does not mean it is a scam.</Copy>
        </View>}
        <Copy style={s.h2} selectable>{result.normalizedNumber}</Copy>
        <Copy style={s.small}>{result.countryCode ?? 'Country unavailable'} · {result.claimedCompanyId ? `Claimed company: ${result.claimedCompanyId}` : 'No company claim'}</Copy>
        <Copy>{result.explanation}</Copy>
        <Copy style={s.small}>Checked {dateText(result.checkedAt)}{'\n'}Evidence freshness: {result.freshness} · {result.reason.replaceAll('_', ' ').toLowerCase()}</Copy>
        <Copy style={s.small}>Caller ID can be spoofed. A listed number does not authenticate an incoming caller.</Copy>
        <Button title="Why this result?" testID="open-evidence" secondary icon="reader-outline" onPress={() => setEvidenceOpen(true)} />
      </View>
      {result.outcome !== 'official_match' && <TravelHelp excludedNumber={result.normalizedNumber}
        initialCompany={selectedCompany?.name ?? ''} onSelect={chooseAlternative} />}
      <Providers providers={result.providers} checkedAt={result.checkedAt} />
      <Copy style={s.h2}>Your next step</Copy>
      {result.alternatives.length ? <><Copy style={s.muted}>Current contacts from official sources. Confirm the region and service before calling.</Copy>
        {result.alternatives.map(contact => <Contact key={contact.id} contact={contact} onSelect={() => chooseAlternative(contact.number, contact.companyId)} />)}</>
        : <View style={s.card}><Copy>No current official alternative is available for this check.</Copy><Copy style={s.small}>Use your booking confirmation or the company’s own app. Missing evidence is not proof of fraud.</Copy></View>}
      <Button title="Explore the official directory" testID="open-directory" secondary icon="book-outline" onPress={() => router.navigate('/(tabs)/directory')} />
      <Button title="Check another number" testID="check-another" onPress={() => { clearResult(); setDraft({ number: '', country: '', companyId: '' }); }} />
      <Modal visible={evidenceOpen} animationType="none" presentationStyle="pageSheet" onRequestClose={() => setEvidenceOpen(false)}>
        <View style={[s.page, { paddingTop: Platform.OS === 'web' ? 67 : 24 }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.content}>
            <Button title="Close evidence" testID="close-evidence" icon="close" secondary onPress={() => setEvidenceOpen(false)} />
            <Copy accessibilityRole="header" style={s.h2}>The evidence, clearly.</Copy>
            <Copy selectable>{result.normalizedNumber}</Copy><Copy style={result.outcome === 'not_verified' && { color: colors.destructive, fontFamily: 'DMSans_700Bold', fontWeight: '700' }}>{result.label}</Copy>
            <Copy style={s.small}>{result.claimedCompanyId ? `Claimed company: ${result.claimedCompanyId}` : 'No company claim selected'}</Copy>
            {!result.evidence.length && <Copy>No attributable evidence was found. This is not a safety or fraud verdict.</Copy>}
            {result.evidence.map(source => <Source key={source.id} source={source} />)}
            {result.limitations.map((limitation, index) => <Copy style={s.small} key={index}>{limitation}</Copy>)}
            {result.metadata && <View style={s.card}><Copy>Basic number metadata · not ownership evidence</Copy>
              <Copy style={s.small}>Numbering-plan valid: {result.metadata.valid ? 'yes' : 'no'}{'\n'}Country: {result.metadata.countryCode ?? 'unavailable'}{'\n'}Format: {result.metadata.nationalFormat ?? 'unavailable'}{'\n'}Fetched: {dateText(result.metadata.fetchedAt)}{'\n'}Expires: {dateText(result.metadata.expiresAt)}</Copy></View>}
          </ScrollView>
        </View>
      </Modal>
    </View>}
    {!result && <View style={{ gap: 12 }}>
      {capabilities.isPending ? <Busy text="Checking evidence availability…" /> : capabilities.isError ?
        <ErrorCard text="Provider availability couldn’t be loaded. Do not assume reports or metadata are available." retry={() => { void capabilities.refetch(); }} /> :
        capabilities.data && <Providers providers={capabilities.data.providers} checkedAt={capabilities.data.checkedAt} />}
      <View style={s.separator}><View style={s.row}><Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} /><Copy style={s.small}>No browsing access. No number history.</Copy></View>
        <Copy style={s.small}>This app cannot inspect Safari. Enter one number yourself; nothing runs in the background.</Copy></View>
    </View>}
  </Page>;
}

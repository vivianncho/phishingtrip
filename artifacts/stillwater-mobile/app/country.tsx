import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getCountryCallingCode } from 'libphonenumber-js/min';
import { useCompanion } from '@/context/Companion';
import { Button, Copy, Page, s } from '@/components/Ocean';
import { INTERNATIONAL } from '@/lib/checks';
import { useColors } from '@/hooks/useColors';

export default function CountryScreen() {
  const { setDraft } = useCompanion();
  const [search, setSearch] = useState('');
  const colors = useColors();
  const options = useMemo(() => {
    let names: Intl.DisplayNames | undefined;
    try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* ISO codes remain explicit. */ }
    return (['US', 'MX', 'CA'] as const).map(code => ({ code, label: names?.of(code) ?? code, calling: getCountryCallingCode(code) }));
  }, []);
  const filtered = options.filter(option => `${option.label} ${option.code} +${option.calling}`.toLowerCase().includes(search.toLowerCase()));
  function choose(country: string) { setDraft(value => ({ ...value, country })); router.back(); }
  return <Page title="Number’s country" back>
    <Copy style={s.muted}>Choose explicitly. We do not guess from your location, device or language.</Copy>
    <Button title="International format (+ country code)" testID="country-international" secondary onPress={() => choose(INTERNATIONAL)} />
    <TextInput testID="country-search" accessibilityLabel="Search countries" style={s.input} value={search} onChangeText={setSearch} placeholder="Search country or calling code" placeholderTextColor={colors.mutedForeground} autoCorrect={false} autoComplete="off" />
    {!filtered.length && <Copy>No matching countries. Try the two-letter country code.</Copy>}
    <View>{filtered.map(option => <Pressable key={option.code} testID={`country-${option.code}`} accessibilityRole="button" onPress={() => choose(option.code)} style={[s.spread, { minHeight: 54, borderBottomWidth: 1, borderColor: colors.border }]}>
      <Copy style={{ flex: 1 }}>{option.label}</Copy><Copy style={s.small}>{option.code} · +{option.calling}</Copy>
    </Pressable>)}</View>
  </Page>;
}

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useListCompanies } from '@workspace/api-client-react';
import { Busy, Button, Copy, ErrorCard, Page, s } from '@/components/Ocean';
import { problemText } from '@/lib/checks';
import { useColors } from '@/hooks/useColors';

export default function DirectoryScreen() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [offset, setOffset] = useState(0);
  const directory = useListCompanies({ search: submitted || undefined, limit: 20, offset }, { query: { staleTime: 30_000 } });
  function find() { setOffset(0); setSubmitted(search.trim()); }
  return <Page tabs>
    <Copy style={s.eyebrow}>LESS SEARCHING. MORE CERTAINTY.</Copy>
    <Copy style={s.heading}>A direct line.{'\n'}<Copy style={[s.heading, s.accent]}>From the source.</Copy></Copy>
    <Copy style={s.muted}>Sourced company contacts, with review dates you can see. A listing is not caller authentication.</Copy>
    <View style={{ gap: 10 }}>
      <TextInput testID="directory-search" accessibilityLabel="Search company names" style={s.input} placeholder="Search a company" placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} maxLength={80} onSubmitEditing={find} returnKeyType="search" autoCorrect={false} />
      <Button title="Search directory" testID="search-directory" secondary icon="search-outline" onPress={find} />
    </View>
    <Copy style={s.small}>CURRENT COVERAGE · AIRLINES{'\n'}Hotel, rental and other travel contacts are not yet curated. You can check their numbers, but limited coverage may mean “Not verified”.</Copy>
    {directory.isPending ? <Busy /> : directory.isError ? <ErrorCard text={problemText(directory.error)} retry={() => { void directory.refetch(); }} /> :
      <View style={{ gap: 12 }}>
        <Copy style={s.small}>{directory.data?.total ?? 0} companies · ordered by company ID</Copy>
        {!directory.data?.items.length && <View style={s.card}><Copy style={s.h2}>No listed company yet.</Copy><Copy style={s.muted}>Try another name or use your booking confirmation and the company’s own app. Absence is not proof of fraud.</Copy></View>}
        {directory.data?.items.map(company => <Pressable key={company.id} testID={`company-${company.id}`} accessibilityRole="button" accessibilityLabel={`View ${company.name} and sourced contacts`} onPress={() => router.push({ pathname: '/company/[id]', params: { id: company.id } })} style={({ pressed }) => [s.card, { opacity: pressed ? 0.7 : 1 }]}>
          <Copy style={s.h2}>{company.name}</Copy><Copy style={s.small}>Airline · {company.contacts.filter(contact => contact.freshness === 'current').length} current contacts</Copy><Copy style={s.accent}>View contacts & sources →</Copy>
        </Pressable>)}
        <View style={s.row}>
          {offset > 0 && <Button title="Previous" testID="directory-previous" secondary onPress={() => setOffset(Math.max(0, offset - 20))} />}
          {directory.data?.nextOffset != null && <Button title="Next" testID="directory-next" secondary onPress={() => setOffset(directory.data!.nextOffset!)} />}
        </View>
        <Button title="Refresh directory" testID="refresh-directory" secondary icon="refresh" onPress={() => { void directory.refetch(); }} />
      </View>}
  </Page>;
}

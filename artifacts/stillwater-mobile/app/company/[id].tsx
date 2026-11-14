import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useGetCompany } from '@workspace/api-client-react';
import { useCompanion } from '@/context/Companion';
import { Busy, Button, Contact, Copy, ErrorCard, Page, WebLink, s } from '@/components/Ocean';
import { problemText } from '@/lib/checks';

export default function CompanyScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const valid = /^[a-z][a-z0-9-]{0,63}$/.test(id);
  const company = useGetCompany(id, { query: { enabled: valid, staleTime: 0 } });
  const { setDraft, savedIds, toggleSaved, ready, storageError } = useCompanion();
  return <Page title="Official directory" back>
    {!valid ? <ErrorCard text="This company link is not valid. Go back to the directory." /> : company.isPending ? <Busy /> : company.isError ?
      <ErrorCard text={company.error.status === 404 ? 'This company is no longer listed. Use the company’s own app or your booking confirmation.' : problemText(company.error)} retry={() => { void company.refetch(); }} /> :
      company.data && <>
        <Copy style={s.eyebrow}>FROM THE COMPANY’S OWN WEBSITE</Copy>
        <Copy style={s.heading}>{company.data.name}</Copy>
        <WebLink url={company.data.website} title="Company website" />
        <Copy style={s.muted}>Always confirm region and service. Even an exact contact match cannot authenticate an incoming caller.</Copy>
        <Button title={savedIds.includes(id) ? 'Remove from My Trips' : 'Save company to My Trips'} testID="save-company" disabled={!ready} icon="bookmark-outline" secondary onPress={() => { void toggleSaved(id); }} />
        {!!storageError && <ErrorCard text={storageError} />}
        {!company.data.contacts.length && <Copy>No sourced contacts are currently listed. Use the company website instead.</Copy>}
        <View style={{ gap: 16 }}>{company.data.contacts.map(contact => <Contact key={contact.id} contact={contact} onSelect={() => {
          setDraft({ number: contact.number, country: '', companyId: id });
          router.navigate('/(tabs)');
        }} />)}</View>
        <Copy style={s.small}>“Use this number” fills the form only. You must select its country/format and tap Check. No call starts automatically.</Copy>
      </>}
  </Page>;
}

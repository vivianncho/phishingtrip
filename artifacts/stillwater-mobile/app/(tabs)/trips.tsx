import { View } from 'react-native';
import { router } from 'expo-router';
import { useGetCompany } from '@workspace/api-client-react';
import { useCompanion } from '@/context/Companion';
import { Busy, Button, Copy, ErrorCard, Page, s } from '@/components/Ocean';

function SavedCompany({ id }: { id: string }) {
  const { toggleSaved } = useCompanion();
  const company = useGetCompany(id, { query: { staleTime: 0 } });
  return <View style={s.card}>
    {company.isPending ? <Busy /> : company.isError ? <Copy style={s.muted}>This saved company couldn’t be loaded. It may no longer be listed.</Copy> :
      <><Copy style={s.h2}>{company.data?.name}</Copy><Copy style={s.small}>Contacts and source dates load fresh when opened.</Copy></>}
    <Button title={company.isError ? 'Retry company' : 'View current contacts'} testID={`saved-${id}`} secondary onPress={() => company.isError ? void company.refetch() : router.push({ pathname: '/company/[id]', params: { id } })} />
    <Button title="Remove company" testID={`remove-${id}`} secondary onPress={() => { void toggleSaved(id); }} />
  </View>;
}
export default function TripsScreen() {
  const { savedIds, ready, storageError } = useCompanion();
  return <Page tabs>
    <Copy style={s.eyebrow}>A LITTLE PREPARATION. A LITTLE CALM.</Copy>
    <Copy style={s.heading}>Your trip.{'\n'}<Copy style={[s.heading, s.accent]}>A place to turn.</Copy></Copy>
    <Copy style={s.muted}>Keep company shortcuts on this device. We save only company IDs, not numbers you check or their results.</Copy>
    {!!storageError && <ErrorCard text={storageError} />}
    {!ready ? <Busy text="Loading saved companies…" /> : savedIds.length ? savedIds.map(id => <SavedCompany key={id} id={id} />) :
      <View style={s.card}><Copy style={s.h2}>Prepare now. Worry less later.</Copy><Copy style={s.muted}>Save an official directory company before you go. Its contacts and sources are fetched again when you open it.</Copy></View>}
    <Button title="Find a company" testID="trips-directory" icon="add" onPress={() => router.navigate('/(tabs)/directory')} />
    <Copy style={s.small}>An internet connection is needed to see current evidence. This is not a check history or an offline safety list.</Copy>
  </Page>;
}

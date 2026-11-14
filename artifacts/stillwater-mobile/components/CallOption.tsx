import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Copy, s } from './Ocean';

export function CallOption({ number, listed = false }: { number: string; listed?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const digits = number.replace(/[ ().-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(digits)) return null;
  return <View style={{ gap: 8 }}>
    <Button title="Call this number" testID={`call-${digits}`} secondary icon="call-outline"
      onPress={() => { setFailed(false); setConfirming(true); }} />
    {confirming && <>
      <Copy>{listed ? 'This Google listing is not independently verified. Check its website and location first.' : 'Confirm this is the right company, region and service.'} Your phone app will open; carrier charges may apply.</Copy>
      <Button title={`Open phone app · ${number}`} testID={`confirm-call-${digits}`} onPress={() => {
        setConfirming(false);
        void Linking.openURL(`tel:${digits}`).catch(() => setFailed(true));
      }} />
      <Button title="Cancel" testID={`cancel-call-${digits}`} secondary onPress={() => setConfirming(false)} />
    </>}
    {failed && <Copy accessibilityRole="alert" style={s.error}>Couldn’t open the phone app. You can copy the displayed number.</Copy>}
  </View>;
}

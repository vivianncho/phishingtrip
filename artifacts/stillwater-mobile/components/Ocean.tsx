import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View, type TextProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Evidence, OfficialContact, ProviderState } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from './KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import palette from '@/constants/colors';
const c = palette.light;

export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 112, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 23, color: c.foreground },
  muted: { color: c.mutedForeground },
  small: { fontSize: 12, lineHeight: 19, color: c.mutedForeground },
  heading: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 34, lineHeight: 39, letterSpacing: -1.3, color: c.foreground },
  h2: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 23, lineHeight: 29, color: c.foreground },
  eyebrow: { fontFamily: 'DMSans_600SemiBold', color: c.primary, letterSpacing: 1.8, fontSize: 10, lineHeight: 18 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 18, gap: 12 },
  input: { backgroundColor: c.muted, borderWidth: 1, borderColor: c.input, borderRadius: 14, minHeight: 56, paddingHorizontal: 16, fontFamily: 'DMSans_400Regular', fontSize: 16, color: c.foreground },
  accent: { color: c.primary },
  error: { color: c.destructive },
  button: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontFamily: 'DMSans_700Bold', fontSize: 14, lineHeight: 21, color: c.primaryForeground },
  secondary: { backgroundColor: c.secondary, borderWidth: 1, borderColor: c.input },
  separator: { borderTopWidth: 1, borderColor: c.border, paddingTop: 14, gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 12, minHeight: 46, borderWidth: 1, borderColor: c.input, borderRadius: 12 },
  selected: { borderColor: c.primary, backgroundColor: c.accent },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
export function Copy({ style, ...props }: TextProps) { return <Text {...props} style={[s.text, style]} />; }
export function Button({ title, onPress, secondary, disabled, testID, icon }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; testID: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} testID={testID} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    {icon && <Ionicons name={icon} size={18} color={secondary ? colors.primary : colors.primaryForeground} />}
    <Text style={[s.buttonText, secondary && { color: colors.foreground }]}>{title}</Text>
  </Pressable>;
}
export function Page({ children, title, back, tabs = false }: { children: React.ReactNode; title?: string; back?: boolean; tabs?: boolean }) {
  const inset = useSafeAreaInsets();
  return <View style={s.page}><KeyboardAwareScrollViewCompat bottomOffset={70} keyboardDismissMode="on-drag"
    contentContainerStyle={[s.content, { paddingTop: (Platform.OS === 'web' ? 67 : inset.top) + 20, paddingBottom: tabs ? 112 : (Platform.OS === 'web' ? 34 : inset.bottom) + 24 }]}>
    <View style={s.spread}>
      <View style={s.row}>
        {back ? <Pressable testID="back" accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ padding: 10, marginLeft: -10 }}><Ionicons name="arrow-back" color={c.primary} size={24} /></Pressable>
          : <Ionicons name="fish-outline" size={29} color={c.primary} />}
        <View><Copy style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 23, letterSpacing: -1 }}>{title ?? 'stillwater'}</Copy>
          {!title && <Copy style={[s.small, { fontSize: 10, letterSpacing: 0.5 }]}>Sleep with the phishes.</Copy>}</View>
      </View>
      <Pressable testID="help" accessibilityRole="button" accessibilityLabel="Privacy and Safari information" onPress={() => router.push('/help')} style={{ padding: 12 }}><Ionicons name="help-circle-outline" size={24} color={c.mutedForeground} /></Pressable>
    </View>
    {children}
  </KeyboardAwareScrollViewCompat></View>;
}
export function Busy({ text = 'Loading sourced contacts…' }: { text?: string }) { return <View style={s.row}><ActivityIndicator color={c.primary} /><Copy style={s.muted}>{text}</Copy></View>; }
export function ErrorCard({ text, retry }: { text: string; retry?: () => void }) {
  return <View style={s.card} accessibilityLiveRegion="polite"><Ionicons name="alert-circle-outline" size={24} color={c.destructive} /><Copy style={s.error}>{text}</Copy>{retry && <Button title="Try again" testID="retry" onPress={retry} secondary />}</View>;
}
export function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
export function WebLink({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return <View><Pressable testID={`link-${title}`} accessibilityRole="link" accessibilityLabel={`${title}. Opens an external website.`} onPress={() => {
    if (!url.startsWith('https://')) { setFailed(true); return; }
    Linking.openURL(url).catch(() => setFailed(true));
  }} style={{ minHeight: 44, justifyContent: 'center' }}><Copy style={s.accent}>{title} ↗</Copy></Pressable>{failed && <Copy style={[s.small, s.error]}>Couldn’t open this website. Try the company’s own app instead.</Copy>}</View>;
}
export function Source({ source }: { source: Evidence }) {
  return <View style={s.separator}>
    <Copy>{source.sourceName}</Copy>
    <Copy style={s.small}>{source.kind === 'official_contact' ? 'Official contact source' : 'Attributable report'} · {source.assertion} · {source.freshness}</Copy>
    <Copy style={s.small}>Number in source: {source.number}{source.companyId ? ` · Company: ${source.companyId}` : ''}</Copy>
    <Copy style={s.small}>Reviewed: {dateText(source.reviewedAt)}{'\n'}Expires: {dateText(source.expiresAt)}</Copy>
    <WebLink url={source.sourceUrl} title="View source" />
  </View>;
}
export function Contact({ contact, onSelect }: { contact: OfficialContact; onSelect?: () => void }) {
  return <View style={s.card}>
    <Copy style={s.eyebrow}>{contact.freshness === 'current' ? 'CURRENT LISTED CONTACT' : 'NOT A CURRENT RECOMMENDATION'}</Copy>
    <Copy style={s.h2} selectable>{contact.number}</Copy>
    <Copy>{contact.service}</Copy><Copy style={s.small}>{contact.region} · {contact.freshness}</Copy>
    {contact.sources.map(source => <Source key={source.id} source={source} />)}
    {onSelect && contact.freshness === 'current' && <Button title="Use this number" testID={`select-${contact.id}`} onPress={onSelect} secondary icon="arrow-forward" />}
  </View>;
}
export function Providers({ providers, checkedAt }: { providers: ProviderState; checkedAt: string }) {
  return <View style={s.card}><Copy style={s.eyebrow}>EVIDENCE AVAILABILITY</Copy>
    <Copy style={s.small}>Directory · {providers.directory}{'\n'}Reputation reports · {providers.reputation}{'\n'}Number metadata · {providers.metadata.replaceAll('_', ' ')}</Copy>
    <Copy style={s.small}>As of {dateText(checkedAt)}. Availability is not a verdict about this number.</Copy>
  </View>;
}

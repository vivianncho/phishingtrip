import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import palette from '@/constants/colors';
import type { CheckResult } from '@workspace/api-client-react';
import { fishCaption } from '@/lib/checks';
import { s } from './Ocean';
const c = palette.light;

export function Hook({ result, pending }: { result: CheckResult | null; pending: boolean }) {
  const [reduced, setReduced] = useState(true);
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    motion.setValue(0);
    if (reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: pending ? 650 : 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: pending ? 650 : 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [motion, pending, reduced, result?.outcome]);
  const uncertain = result?.outcome === 'not_verified';
  const rest = result?.outcome === 'official_match';
  const reports = result?.outcome === 'reports_found';
  return <View style={styles.stage} accessible accessibilityLabel={`Hook the fish. ${fishCaption(result, pending)}`}>
    <View style={styles.ripple} /><View style={[styles.ripple, { width: 300, height: 120 }]} />
    <Animated.View style={{ transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [3, -7] }) }, { translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [reports ? -22 : pending ? -12 : 0, reports ? -15 : pending ? 12 : 4] }) }] }}>
      <Svg width={250} height={170} viewBox="0 0 300 210">
        <Defs><LinearGradient id="body" x1="0" y1="0" x2="0.6" y2="1"><Stop stopColor={c.fishLight} /><Stop offset=".48" stopColor={c.fishBody} /><Stop offset="1" stopColor={c.fishDark} /></LinearGradient></Defs>
        <Path d="M106 101C86 93 66 71 55 76c-7 4 7 26 8 32 1 9-9 25-4 30 8 8 31-11 48-12" fill={c.fishDark} stroke={c.fishBody} />
        <Path d="m63 87 34 23-35 17" stroke={c.fishLight} opacity=".4" fill="none" />
        <Path d="M125 70c4-21 23-34 30-30 7 4 4 17 10 28" fill={c.fishDark} />
        <Path d="M105 90c13-30 46-42 76-30 31 12 54 41 49 62-5 23-39 43-74 39-39-4-68-31-51-71Z" fill="url(#body)" />
        <Path d="M109 118c22 13 59 22 111 12-13 24-42 33-64 30-26-2-43-15-47-42Z" fill={c.fishLight} opacity=".3" />
        <Path d="M121 82c11-12 28-16 44-14M174 63c-2-26 18-37 31-22" stroke={c.fishLight} strokeWidth="2" fill="none" strokeLinecap="round" />
        <Circle cx="208" cy="44" r="16" fill={c.primary} opacity=".08" /><Circle cx="208" cy="44" r="6" fill={c.fishLight} />
        <Path d="M163 117c-4 7-7 26 2 31 9 5 20-12 22-24-10 0-17-3-24-7Z" fill={c.fishDark} stroke={c.fishLight} />
        <Path d="M151 92c-6 7-7 13-4 19m-7-22c-5 5-7 10-6 15" stroke={c.fishDark} strokeWidth="2" fill="none" />
        {rest ? <Path d="M188 98q9 8 18-2" stroke={c.background} strokeWidth="3" fill="none" /> :
          <G><Ellipse cx="196" cy="95" rx="10" ry={uncertain ? 13 : 12} fill={c.foreground} /><Ellipse cx="199" cy="96" rx="6.5" ry="8.5" fill={c.background} /><Circle cx="201" cy="92" r="2.6" fill={c.foreground} /></G>}
        <Path d={uncertain ? 'M218 115q5-4 10 0' : 'M218 113q5 5 10 1'} stroke={c.fishDark} strokeWidth="2" fill="none" />
        {pending && <Path d="M240 88q9 12 0 24m9-31q16 19 0 38" stroke={c.primary} strokeWidth="2" fill="none" />}
        {reports && <Path d="M270 10v70c0 22-27 23-27 4v-9l8 8" stroke={c.destructive} strokeWidth="3" fill="none" />}
      </Svg>
    </Animated.View>
    <Text style={[s.small, { textAlign: 'center', fontSize: 11 }]}>{fishCaption(result, pending)}</Text>
  </View>;
}
const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', minHeight: 192, marginVertical: -6 },
  ripple: { position: 'absolute', width: 245, height: 90, borderRadius: 180, borderWidth: 1, borderColor: c.accent, transform: [{ rotate: '-13deg' }] },
});

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, SvgXml, Text as SvgText } from 'react-native-svg';
import { HOOK_BODY, HOOK_FACE, HOOK_FINS, HOOK_LANTERN } from './hookArt';
import { nativeHookXml as hookXml } from './nativeHookXml';
import palette from '@/constants/colors';
import type { CheckResult } from '@workspace/api-client-react';
import { fishCaption } from '@/lib/checks';
import { s } from './Ocean';
const c = palette.light;
const W = 228, H = 190;
const FINS = hookXml([HOOK_FINS]);
const BODY = hookXml([HOOK_BODY, HOOK_FACE]);
const LANTERN = hookXml([HOOK_LANTERN]);

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
    <View style={styles.water}>
    <View style={styles.ripple} /><View style={[styles.ripple, { width: '94%', height: 120 }]} />
    <Animated.View style={{ transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [3, -7] }) }, { translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [reports ? -22 : pending ? -12 : 0, reports ? -15 : pending ? 12 : 4] }) }] }}>
      <View style={{ width: W, height: H }}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', pending ? '5deg' : '3deg'] }) }] }]}>
          <SvgXml xml={FINS} width={W} height={H} />
        </Animated.View>
        <SvgXml xml={BODY} width={W} height={H} style={StyleSheet.absoluteFill} />
        <Svg width={W} height={H} viewBox="0 0 480 400" style={StyleSheet.absoluteFill}>
          {rest && <G><Ellipse cx="143" cy="209" rx="32" ry="34" fill={c.card} /><Path d="M122 209q21 17 42-2" stroke={c.fishLight} strokeWidth="3.5" strokeLinecap="round" fill="none" /></G>}
          {uncertain && <Path d="M128 168q15-8 30 2" stroke={c.fishLight} strokeWidth="3" strokeLinecap="round" fill="none" />}
          <Circle cx="70" cy="112" r="26" fill={reports ? c.warning : c.primary} opacity={reports ? 0.22 : 0.12} />
          <Circle cx="70" cy="112" r="15" fill={reports ? c.warning : c.primary} opacity={reports ? 0.2 : 0.1} />
        </Svg>
        <SvgXml xml={LANTERN} width={W} height={H} style={StyleSheet.absoluteFill} />
        <Svg width={W} height={H} viewBox="0 0 480 400" style={StyleSheet.absoluteFill}>
          {pending && <G stroke={c.primary} strokeWidth="2" strokeLinecap="round" fill="none"><Path d="M61 186q-14 24 0 48m-15-62q-23 37 0 76" /></G>}
          {reports && <Path d="M62 6v65c0 24-29 26-29 7v-9l9 9" stroke={c.destructive} strokeWidth="3" strokeLinecap="round" fill="none" />}
          {rest && <G fill={c.primary}><SvgText x="193" y="111" fontSize="17" fontWeight="500">z</SvgText><SvgText x="218" y="87" fontSize="23" fontWeight="500">z</SvgText></G>}
        </Svg>
      </View>
    </Animated.View>
    </View>
    <Text style={[s.small, { textAlign: 'center', fontSize: 11 }]}>{fishCaption(result, pending)}</Text>
  </View>;
}
const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', marginVertical: -6, gap: 8 },
  water: { width: '100%', maxWidth: 320, height: H, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: '78%', height: 90, borderRadius: 180, borderWidth: 1, borderColor: c.fishGlow, transform: [{ rotate: '-13deg' }] },
});

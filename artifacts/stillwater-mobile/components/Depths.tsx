import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { depth } from '@/constants/colors';

/** Decorative underwater backdrop driven by the Page scroll offset. Purely visual, non-interactive, hidden from accessibility. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (active) setReduced(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}

const BUBBLES = [
  { x: 0.08, y: 0.9, r: 5, rate: 0.35 }, { x: 0.86, y: 0.7, r: 8, rate: 0.55 }, { x: 0.22, y: 1.4, r: 3, rate: 0.25 },
  { x: 0.7, y: 1.25, r: 4, rate: 0.45 }, { x: 0.93, y: 1.7, r: 6, rate: 0.6 }, { x: 0.04, y: 2.0, r: 7, rate: 0.5 },
  { x: 0.55, y: 2.3, r: 3, rate: 0.3 }, { x: 0.35, y: 2.7, r: 5, rate: 0.4 },
];

export function Depths({ scrollY }: { scrollY: Animated.Value }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    drift.setValue(0);
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [drift, reduced]);

  const a = useMemo(() => {
    const clamp = 'clamp' as const;
    const fade = (i: number[], o: number[]) => scrollY.interpolate({ inputRange: i, outputRange: o, extrapolate: clamp });
    return {
      surface: fade([0, 520], [1, 0]),
      deep: fade([260, 1100], [0, 1]),
      abyss: fade([900, 1900], [0, 0.85]),
      rays: fade([0, 700], [1, 0]),
      // The waterline rises out of view as you sink; reduced motion keeps colour change only.
      waterline: reduced ? fade([0, 200], [0, -60]) : fade([0, 400], [0, -260]),
      raysShift: reduced ? fade([0, 1], [0, 0]) : fade([0, 700], [0, -140]),
      gauge: fade([0, 1900], [0, 1]),
    };
  }, [scrollY, reduced]);

  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={[depth.mid, depth.deep]} style={StyleSheet.absoluteFill} />
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.surface }]}>
      <LinearGradient colors={[depth.sky, depth.surface, depth.shallow, depth.mid]} locations={[0, 0.18, 0.55, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.deep }]}>
      <LinearGradient colors={[depth.mid, depth.deep, depth.abyss]} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.abyss, backgroundColor: depth.abyss }]} />
    {/* sunlight shafts from the surface */}
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.rays, transform: [{ translateY: a.raysShift }] }]}>
      {[0.12, 0.42, 0.7].map((x, i) => <LinearGradient key={i} colors={[depth.ray, depth.rayClear]}
        style={{ position: 'absolute', top: -80, left: width * x, width: 46 + i * 18, height: height * 0.85, transform: [{ rotate: `${14 - i * 6}deg` }] }} />)}
    </Animated.View>
    {/* waterline */}
    <Animated.View style={{ position: 'absolute', top: 0, left: -40, right: -40, height: 120, transform: [{ translateY: a.waterline }] }}>
      <View style={[styles.wave, { top: 70, borderColor: depth.foam }]} />
      <View style={[styles.wave, { top: 88, left: 60, borderColor: depth.bubble, opacity: 0.7 }]} />
    </Animated.View>
    {BUBBLES.map((b, i) => <Bubble key={i} b={b} scrollY={scrollY} drift={drift} width={width} height={height} reduced={reduced} />)}
    <View style={[styles.gauge, { backgroundColor: depth.gauge, top: height * 0.2, height: height * 0.5 }]}>
      <Animated.View style={[styles.marker, { backgroundColor: depth.bubbleRim, transform: [{ translateY: a.gauge.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.5 - 8] }) }] }]} />
    </View>
  </View>;
}

function Bubble({ b, scrollY, drift, width, height, reduced }: { b: typeof BUBBLES[number]; scrollY: Animated.Value; drift: Animated.Value; width: number; height: number; reduced: boolean }) {
  const span = height * 3;
  const y = scrollY.interpolate({ inputRange: [0, span], outputRange: [b.y * height, b.y * height - span * b.rate], extrapolate: 'clamp' });
  const visible = scrollY.interpolate({ inputRange: [0, 220, 500], outputRange: [0.25, 0.8, 1], extrapolate: 'clamp' });
  const rise = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -40 - b.r * 6] });
  const sway = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.r, 0] });
  return <Animated.View style={{ position: 'absolute', left: b.x * width, top: 0, opacity: visible, transform: reduced ? [{ translateY: y }] : [{ translateY: y }, { translateY: rise }, { translateX: sway }] }}>
    <View style={{ width: b.r * 2, height: b.r * 2, borderRadius: b.r, backgroundColor: depth.bubble, borderWidth: 1, borderColor: depth.bubbleRim }} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  wave: { position: 'absolute', left: 0, right: 0, height: 60, borderRadius: 400, borderBottomWidth: 1.5, borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0 },
  gauge: { position: 'absolute', right: 6, width: 2, borderRadius: 1, opacity: 0.6 },
  marker: { width: 6, height: 8, borderRadius: 3, marginLeft: -2 },
});

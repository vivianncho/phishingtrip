// Stillwater's existing deep-ocean palette, shared with the accepted mockup.
const ocean = {
  text: '#f1f5f9', tint: '#3ef0d8',
  background: '#0a1628', foreground: '#f1f5f9',
  card: '#12233d', cardForeground: '#f1f5f9',
  primary: '#3ef0d8', primaryForeground: '#092b30',
  secondary: '#192e46', secondaryForeground: '#f1f5f9',
  muted: '#14253b', mutedForeground: '#97abc3',
  accent: '#12373d', accentForeground: '#a2ffeb',
  destructive: '#ff9598', destructiveForeground: '#0a1628',
  border: '#273a50', input: '#344760',
  warning: '#f4c77f', overlay: '#00000099',
  fishLight: '#a2ffeb', fishBody: '#52dbc8', fishDark: '#158b99',
};
// Scroll-linked descent layers, derived from the ocean palette (surface -> abyss).
export const depth = {
  sky: '#1d4a66', surface: '#16405c', shallow: '#0f2c47', mid: ocean.background, deep: '#060f1d', abyss: '#030914',
  ray: '#3ef0d822', rayClear: '#3ef0d800', foam: '#a2ffeb55', bubble: '#a2ffeb40', bubbleRim: '#a2ffeb66', gauge: '#273a50',
};
export default { light: ocean, dark: ocean, radius: 14 };

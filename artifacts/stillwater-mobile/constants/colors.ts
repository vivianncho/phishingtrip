// Stillwater's existing deep-ocean palette, shared with the accepted mockup.
// Approved Stillwater reference palette (mockup-sandbox Stillwater.css, .sw-figma-ocean).
const ocean = {
  text: '#edf7ed', tint: '#d5f995',
  background: '#07313f', foreground: '#edf7ed',
  card: '#174854', cardForeground: '#edf7ed',
  primary: '#d5f995', primaryForeground: '#193e36',
  secondary: '#123f49', secondaryForeground: '#edf7ed',
  muted: '#0d3844', mutedForeground: '#b1cfd0',
  accent: '#1f4f4a', accentForeground: '#d5f995',
  destructive: '#ff858b', destructiveForeground: '#07313f',
  border: '#37626b', input: '#4b7a7a',
  warning: '#ffc98d', overlay: '#00000099',
  fishLight: '#9dded0', fishBody: '#227079', fishDark: '#123f49', fishGlow: '#dbf6b533',
};
// Scroll-linked descent layers: filtered surface light -> deep teal -> abyss.
export const depth = {
  sky: '#105e66', surface: '#0b4a56', shallow: '#07313f', mid: '#07313f', deep: '#041e30', abyss: '#031928',
  ray: '#b5f9cc1c', rayClear: '#b5f9cc00', foam: '#b4f3c540', bubble: '#d5f9be30', bubbleRim: '#d5f9be59', gauge: '#37626b',
};
export default { light: ocean, dark: ocean, radius: 14 };

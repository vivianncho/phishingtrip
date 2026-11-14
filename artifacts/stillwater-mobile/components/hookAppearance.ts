import { HOOK_BODY, HOOK_FACE, HOOK_FINS, HOOK_LANTERN } from './hookArt';
import { nativeHookXml as hookXml } from './nativeHookXml';
import palette from '../constants/colors';

const c = palette.light;

// Recolor at render time, never edit the generated, source-matched artwork.
// Retain each paint's lightness so the approved shading and outlines stay visible.
function tint(xml: string, color: string): string {
  const target = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const targetLightness = (Math.max(...target) + Math.min(...target)) / 2;
  return xml.replace(/\b(fill|stroke)="#([0-9a-f]{6})"/gi, (_, attribute: string, hex: string) => {
    const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const lightness = (Math.max(...channels) + Math.min(...channels)) / 2;
    const painted = target.map(channel => lightness <= targetLightness
      ? channel * lightness / targetLightness
      : channel + (1 - channel) * (lightness - targetLightness) / (1 - targetLightness));
    return `${attribute}="#${painted.map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}"`;
  });
}

function appearance(color?: string) {
  const paint = (xml: string) => color ? tint(xml, color) : xml;
  return {
    fins: hookXml([paint(HOOK_FINS)]),
    // Keep the eye and facial details legible instead of tinting the cream whites.
    body: hookXml([paint(HOOK_BODY), HOOK_FACE]),
    lantern: hookXml([paint(HOOK_LANTERN)]),
    glow: color ?? c.primary,
    eyeMask: color ? tint(`<path fill="${c.card}"/>`, color).match(/fill="([^"]+)"/)![1] : c.card,
  };
}

const neutral = appearance();
const reported = appearance(c.fishReported);
const matched = appearance(c.fishMatched);

export function hookAppearance(outcome?: string, pending = false) {
  if (pending) return neutral;
  if (outcome === 'reports_found') return reported;
  if (outcome === 'official_match') return matched;
  return neutral;
}

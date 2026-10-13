import { asObject, isObject, type Json } from '../render/text-style.ts';
import type { ActiveWord, Motion } from './caption-style-body.ts';

/**
 * Raw data for the built-in caption presets (caption style model design §7): 31 social / business / retro paints (the `look` units of the prototype `BC_VS`),
 * the classic and Shorts looks (the old kernel's `classic_look` / `shorts_look`), 9 Studio designs (native style document fields), and the current word and motion of each of the 43 presets (the values of the prototype `BC_CS.presets()`). The colour literals are content colours painted into the video frame.
 */

/** One look in prototype units: `lh` is a percentage, `spacing` is in 1/100 em, `corners` / `pad` are percentages of the font size, `outlineW` is the number where `fz × outlineW / 160`
 *  gives the outline width, `shDist` / `shBlur` are percentages of the font size, and `shColor` includes alpha. */
export interface DesignLook {
  font: string;
  weight: number;
  bold: boolean;
  italic: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  lh: number;
  spacing: number;
  upper: '' | 'upper' | 'lower' | 'title';
  bg: string;
  opacity: number;
  corners: number;
  pad: number;
  plate: 'line' | 'block';
  outline: boolean;
  outlineColor: string;
  outlineW: number;
  shadow: boolean;
  shDist: number;
  shAngle: number;
  shBlur: number;
  shColor: string;
}

export type PresetCategory = 'basic' | 'social' | 'business' | 'retro' | 'motion' | 'kinetic';

/** The few defaults that every card needs beyond its paint (old `base_style`). */
const BASE: Json = {
  fontStyle: 'normal',
  underline: false,
  textAlign: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  textTransform: 'none',
  background: false,
  backgroundColor: '#000000CC',
  backgroundStyle: 'wrap',
  backgroundPadding: 10,
  borderRadius: 15,
};

const round = (value: number) => Math.round(value * 1e4) / 1e4;

function opaque(color: string): string {
  const value = color.trim();
  return value.startsWith('#') && value.length >= 7 ? value.slice(0, 7) : value;
}

function alphaOf(color: string): number {
  return color.startsWith('#') && color.length === 9 ? round(parseInt(color.slice(7, 9), 16) / 255) : 1;
}

function withOpacity(color: string, percent: number): string {
  const alpha = Math.round((Math.min(100, Math.max(0, percent)) * 255) / 100);
  return `${opaque(color)}${alpha.toString(16).padStart(2, '0').toUpperCase()}`;
}

/** Font names: two commercial fonts are swapped for the prototype's stand-ins; weight suffixes (`Poppins SemiBold`) are removed, and the weight comes from `fontWeight`. */
export function fontFamilyOf(font: string): string {
  if (font === 'Komika Axis') return 'Bangers';
  if (font === 'The Bold Font') return 'Poppins';
  const space = font.indexOf(' ');
  if (space < 0) return font;
  const suffix = font.slice(space + 1);
  return ['Medium', 'SemiBold', 'Semibold', 'Extrabold', 'Black'].includes(suffix) ? font.slice(0, space) : font;
}

/** A paint filled out to be complete: both the shadow and glow slots get values (only one is enabled), and the old outline boolean matches `textOutline.on`. */
export function completePaint(style: Json): Json {
  const outline = asObject(style.textOutline);
  return {
    ...BASE,
    ...style,
    outline: outline.on === true,
    dropShadow: isObject(style.dropShadow) ? style.dropShadow : { on: false },
    glow: isObject(style.glow) ? style.glow : { on: false },
  };
}

/**
 * Prototype look → paint in the style document (converted as in the old kernel): letter spacing ×0.3 (1/100 em → logical pixels of a 30-point font), outline ×1.25 (centred stroke width), corner radius 30×corners/55, padding 30×1.4×pad/80 (vertical is horizontal ÷1.4), shadow distance and blur ÷100. A shadow with distance 0 is a glow
 * (intensity taken from the shadow colour's alpha, radius = blur ÷0.9).
 */
export function lookStyle(look: DesignLook): Json {
  const shadow =
    look.shadow && look.shDist === 0
      ? { glow: { on: true, color: opaque(look.shColor), intensity: round(alphaOf(look.shColor) * 100), range: round(look.shBlur / 0.9) } }
      : {
          dropShadow: {
            on: look.shadow,
            distance: round(look.shDist / 100),
            rotation: look.shAngle,
            blur: round(look.shBlur / 100),
            color: opaque(look.shColor),
            opacity: alphaOf(look.shColor),
          },
        };
  return completePaint({
    fontFamily: fontFamilyOf(look.font),
    fontWeight: Math.min(900, Math.max(100, Math.round(look.weight))),
    bold: look.bold,
    italic: look.italic,
    fontColor: look.color,
    textAlign: look.align,
    lineHeight: round(look.lh / 100),
    letterSpacing: round(look.spacing * 0.3),
    textTransform: look.upper === 'upper' ? 'uppercase' : look.upper === 'lower' ? 'lowercase' : look.upper === 'title' ? 'title' : 'none',
    background: look.opacity > 0,
    backgroundColor: withOpacity(look.bg, look.opacity),
    backgroundStyle: look.plate === 'block' ? 'block' : 'wrap',
    backgroundPadding: round((30 * 1.4 * look.pad) / 80),
    borderRadius: round((30 * look.corners) / 55),
    textOutline: { on: look.outline, color: look.outlineColor, width: round(look.outlineW * 1.25) },
    ...shadow,
  });
}

/** Classic: the seed paint for new projects (old `classic_look`, with font size 34 removed — font size is placement). */
export const CLASSIC_PAINT: Json = completePaint({
  fontFamily: 'system',
  fontWeight: 700,
  bold: true,
  italic: false,
  fontColor: '#FFFFFF',
  backgroundColor: '#000000B3',
  textOutline: { on: true, color: '#000000', width: 14 },
  dropShadow: { on: true, blur: 0.12, distance: 0.08, rotation: 45, color: '#000000', opacity: 0.9 },
});

/** Shorts: on top of Classic, changes font weight, line height, outline and shadow (old `shorts_look`). */
export const SHORTS_PAINT: Json = {
  ...CLASSIC_PAINT,
  fontWeight: 800,
  lineHeight: 1.1,
  textOutline: { on: true, color: '#000000', width: 17.5 },
  dropShadow: { on: true, blur: 0.1, distance: 0.06, rotation: 90, color: '#000000', opacity: 0.9 },
};

/** 31 paints (in the order of `BC_VS.PRESETS`; the names are proper nouns and are not in the copy catalogue). */
export const LOOKS: readonly { id: string; name: string; category: PresetCategory; look: DesignLook }[] = [
  { id: 'prettymarketer', name: 'Pretty Little Marketer', category: 'social', look: { font: 'Montserrat', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 125, spacing: 0, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#2b292a', outlineW: 5, shadow: true, shDist: 12, shAngle: 46, shBlur: 38, shColor: '#2b292aff' } },
  { id: 'ali', name: 'Ali', category: 'social', look: { font: 'Poppins SemiBold', weight: 600, bold: false, italic: false, color: '#000000', align: 'center', lh: 200, spacing: 1, upper: '', bg: '#FAFBFF', opacity: 100, corners: 30, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'slay', name: 'Slay', category: 'social', look: { font: 'Komika Axis', weight: 400, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 125, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 27, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'kitty', name: 'Kitty', category: 'social', look: { font: 'Squada One', weight: 400, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 95, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 21, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'hustle', name: 'Hustle', category: 'social', look: { font: 'The Bold Font', weight: 900, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 115, spacing: 1, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 22, shadow: true, shDist: 14, shAngle: 48, shBlur: 0, shColor: '#000000' } },
  { id: 'grape', name: 'Grape', category: 'social', look: { font: 'The Bold Font', weight: 900, bold: false, italic: false, color: '#262323', align: 'center', lh: 105, spacing: -2, upper: 'upper', bg: '#FFFFFF', opacity: 100, corners: 30, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'karl', name: 'Karl', category: 'social', look: { font: 'Poppins SemiBold', weight: 600, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 115, spacing: 0, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 11, shadow: true, shDist: 1, shAngle: 180, shBlur: 25, shColor: '#000000ff' } },
  { id: 'sprout', name: 'Sprout', category: 'social', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 115, spacing: 0, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 11, shadow: true, shDist: 13, shAngle: 180, shBlur: 25, shColor: '#000000' } },
  { id: 'flex', name: 'Flex', category: 'social', look: { font: 'The Bold Font', weight: 900, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 125, spacing: 2, upper: 'lower', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 21, shadow: true, shDist: 19, shAngle: 41, shBlur: 0, shColor: '#000000' } },
  { id: 'snugle', name: 'Snugle', category: 'social', look: { font: 'The Bold Font', weight: 900, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 180, spacing: 1, upper: 'upper', bg: '#000000', opacity: 40, corners: 30, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'mint', name: 'Mint', category: 'social', look: { font: 'Anton', weight: 400, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 105, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 5, shadow: true, shDist: 15, shAngle: 50, shBlur: 12, shColor: '#000000' } },
  { id: 'rizz', name: 'Rizz', category: 'social', look: { font: 'Poppins Extrabold', weight: 800, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 120, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 10, shadow: true, shDist: 23, shAngle: 46, shBlur: 11, shColor: '#000000B3' } },
  { id: 'lime', name: 'Lime', category: 'social', look: { font: 'The Bold Font', weight: 900, bold: false, italic: false, color: '#232323', align: 'center', lh: 105, spacing: -2, upper: 'upper', bg: '#B6FF60', opacity: 100, corners: 30, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'phantom', name: 'Phantom', category: 'social', look: { font: 'Poppins Extrabold', weight: 800, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 125, spacing: -2, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 11, shadow: true, shDist: 1, shAngle: 180, shBlur: 15, shColor: '#0000004D' } },
  { id: 'bulb', name: 'Bulb', category: 'social', look: { font: 'Poppins Extrabold', weight: 800, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 90, spacing: -6, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 2, shadow: true, shDist: 1, shAngle: 180, shBlur: 100, shColor: '#ffffff' } },
  { id: 'vegas', name: 'Vegas', category: 'social', look: { font: 'Poppins Extrabold', weight: 800, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 125, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#ff98e9', outlineW: 3, shadow: true, shDist: 1, shAngle: 180, shBlur: 99, shColor: '#FF25CE' } },
  { id: 'boba', name: 'Boba', category: 'social', look: { font: 'Rubik Black', weight: 900, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 95, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 29, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'matcha', name: 'Matcha', category: 'social', look: { font: 'Bangers', weight: 400, bold: false, italic: false, color: '#b6ff60', align: 'center', lh: 105, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 16, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'shadeplay', name: 'Shadeplay', category: 'business', look: { font: 'Poppins Medium', weight: 500, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 200, spacing: 0, upper: '', bg: '#000000', opacity: 50, corners: 0, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: true, shDist: 1, shAngle: 180, shBlur: 62, shColor: '#00000066' } },
  { id: 'simple', name: 'Simple', category: 'business', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 120, spacing: 2, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 11, shadow: true, shDist: 5, shAngle: 90, shBlur: 10, shColor: '#000000ff' } },
  { id: 'casper', name: 'Casper', category: 'business', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 125, spacing: 0, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 6, shadow: true, shDist: 12, shAngle: 46, shBlur: 17, shColor: '#000000cc' } },
  { id: 'corpo', name: 'Corpo', category: 'business', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 120, spacing: 2, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 11, shadow: true, shDist: 1, shAngle: 180, shBlur: 60, shColor: '#000000b3' } },
  { id: 'boo', name: 'Boo', category: 'business', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 190, spacing: 1, upper: '', bg: '#000000', opacity: 40, corners: 0, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'beans', name: 'Beans', category: 'business', look: { font: 'Poppins Extrabold', weight: 800, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 120, spacing: -2, upper: 'upper', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 10, shadow: true, shDist: 5, shAngle: 180, shBlur: 81, shColor: '#000000' } },
  { id: 'plain', name: 'Plain', category: 'business', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 105, spacing: 1, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 11, shadow: true, shDist: 1, shAngle: 181, shBlur: 48, shColor: '#000000' } },
  { id: 'capri', name: 'Capri', category: 'retro', look: { font: 'Montserrat Semibold', weight: 600, bold: false, italic: true, color: '#FFFC86', align: 'center', lh: 105, spacing: 1, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 8, shadow: true, shDist: 11, shAngle: 60, shBlur: 4, shColor: '#000000' } },
  { id: 'lowkey', name: 'Lowkey', category: 'retro', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#ffffff', align: 'center', lh: 140, spacing: 0, upper: '', bg: '#000000', opacity: 100, corners: 0, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: true, shDist: 1, shAngle: 180, shBlur: 62, shColor: '#000000cc' } },
  { id: 'vinta', name: 'Vinta', category: 'retro', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#FDFA14', align: 'center', lh: 140, spacing: 1, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 10, shadow: true, shDist: 10, shAngle: 128, shBlur: 0, shColor: '#000000' } },
  { id: 'slant', name: 'Slant', category: 'retro', look: { font: 'Poppins', weight: 400, bold: false, italic: true, color: '#ffffff', align: 'center', lh: 105, spacing: 1, upper: '', bg: '#000000', opacity: 100, corners: 0, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'diego', name: 'Diego', category: 'retro', look: { font: 'Poppins', weight: 400, bold: true, italic: false, color: '#FDFA14', align: 'center', lh: 140, spacing: 1, upper: '', bg: '#000000', opacity: 100, corners: 30, pad: 20, plate: 'line', outline: false, outlineColor: '#000000', outlineW: 0, shadow: false, shDist: 12, shAngle: 90, shBlur: 24, shColor: '#000000cc' } },
  { id: 'yeet', name: 'Yeet', category: 'retro', look: { font: 'Shrikhand', weight: 400, bold: false, italic: false, color: '#ffffff', align: 'center', lh: 120, spacing: -2, upper: '', bg: '#000000', opacity: 0, corners: 0, pad: 20, plate: 'line', outline: true, outlineColor: '#000000', outlineW: 3, shadow: true, shDist: 14, shAngle: 180, shBlur: 60, shColor: '#000000ff' } },
];

/**
 * The nine Studio designs of `BC_SD` (paints from `nativeStyle`). `fontSize` / `fontSizeBasis` (font size is placement) and the duplicate `align` were removed;
 * `Poppins Black` is collapsed to `Poppins` plus weight 900 via `fontFamilyOf`. The current word and motion are in `PRESET_TABLE`, and the per-word backing block is in `wordBox`.
 */
export const STUDIO_DESIGNS: readonly { id: string; style: Json; wordBox?: { color: string; padding: [number, number]; radius: number } }[] = [
  { id: 'studio-focus', style: { fontFamily: 'Anton', fontWeight: 400, bold: false, italic: false, fontColor: '#FFFFFF', lineHeight: 0.95, letterSpacing: 0.66, textTransform: 'uppercase', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: true, color: '#000000', width: 32.8767 }, dropShadow: { on: true, color: '#000000', blur: 0, distance: 0.1912, rotation: 40.156, opacity: 0.88 } } },
  { id: 'studio-word-tiles', wordBox: { color: '#121213D6', padding: [0.2, 0.1], radius: 0.12 }, style: { fontFamily: 'Inter', fontWeight: 500, bold: false, italic: false, fontColor: '#FFFDF7', lineHeight: 1.12, letterSpacing: -0.36, textTransform: 'none', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: false, color: '#000000', width: 0 }, dropShadow: { on: false, color: '#000000', blur: 0, distance: 0, rotation: 0, opacity: 1 } } },
  { id: 'studio-word-drop', style: { fontFamily: 'Poppins', fontWeight: 900, bold: false, italic: false, fontColor: '#232323', lineHeight: 1.04, letterSpacing: -0.54, textTransform: 'none', textAlign: 'center', background: true, backgroundColor: '#C7FF5A', backgroundStyle: 'wrap', backgroundPadding: 7.7586, backgroundPaddingY: 7.7586, borderRadius: 13.1661, textOutline: { on: false, color: '#000000', width: 0 }, dropShadow: { on: false, color: '#000000', blur: 0, distance: 0, rotation: 0, opacity: 1 } } },
  { id: 'studio-paper-typewriter', style: { fontFamily: 'Roboto Mono', fontWeight: 500, bold: false, italic: false, fontColor: '#241F1A', lineHeight: 1.16, letterSpacing: 0, textTransform: 'none', textAlign: 'left', background: true, backgroundColor: '#F4EBDD', backgroundStyle: 'wrap', backgroundPadding: 10.7143, backgroundPaddingY: 10.7143, borderRadius: 10.3896, textOutline: { on: false, color: '#000000', width: 0 }, dropShadow: { on: false, color: '#000000', blur: 0, distance: 0, rotation: 0, opacity: 1 } } },
  { id: 'studio-line-swipe', style: { fontFamily: 'Poppins', fontWeight: 900, bold: false, italic: false, fontColor: '#FFF8F2', lineHeight: 1, letterSpacing: -0.54, textTransform: 'none', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: true, color: '#000000', width: 13.7931 }, dropShadow: { on: true, color: '#FF6B5B', blur: 0, distance: 0.22, rotation: 33.2749, opacity: 1 } } },
  { id: 'studio-soft-focus', style: { fontFamily: 'Inter', fontWeight: 500, bold: false, italic: false, fontColor: '#FFFDF7', lineHeight: 1.1, letterSpacing: 0.15, textTransform: 'none', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: false, color: '#000000', width: 0 }, dropShadow: { on: true, color: '#000000', blur: 0.1667, distance: 0.0833, rotation: 90, opacity: 0.46 } } },
  { id: 'studio-rise-settle', style: { fontFamily: 'Playfair Display', fontWeight: 400, bold: false, italic: true, fontColor: '#F5E6CF', lineHeight: 1.12, letterSpacing: -0.36, textTransform: 'none', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: false, color: '#000000', width: 0 }, dropShadow: { on: true, color: '#301E16', blur: 0.1379, distance: 0.1384, rotation: 48.3665, opacity: 0.55 } } },
  { id: 'studio-kinetic-wave', style: { fontFamily: 'Oswald', fontWeight: 700, bold: false, italic: false, fontColor: '#FFFFFF', lineHeight: 0.98, letterSpacing: -0.75, textTransform: 'none', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: true, color: '#FFE547', width: 15.1515 }, dropShadow: { on: true, color: '#32DDE7', blur: 0, distance: 0.1625, rotation: 34.0193, opacity: 1 } } },
  { id: 'studio-ktv', style: { fontFamily: 'Poppins', fontWeight: 900, bold: false, italic: false, fontColor: '#FFF6D8', lineHeight: 1.18, letterSpacing: 0, textTransform: 'none', textAlign: 'center', background: false, backgroundColor: '#00000000', backgroundStyle: 'wrap', backgroundPadding: 0, backgroundPaddingY: 0, borderRadius: 0, textOutline: { on: true, color: '#3A1A08', width: 20 }, dropShadow: { on: true, color: '#000000', blur: 0.08, distance: 0.1, rotation: 60, opacity: 0.7 } } },
];

/** Entrance when spoken only writes the preset name (the rest is filled from the `MOTION_PRESETS` defaults); triggers on appearance are kept as they are. */
export type PresetMotion = Partial<Record<keyof Motion, { preset: string } & Partial<NonNullable<Motion['in']>>>>;

/**
 * The display order, categories, current word and motion of the 43 presets (prototype `presets()`: basic → the 31 in original order (`simple` moved into basic) → 9 Studio → 倒鸭子 (upside-down duck)).
 * Default values (`spoken: 'keep'`, `unspoken: 'keep'`, transition 0.16 s, fade 0.5) are omitted.
 */
export const PRESET_TABLE: readonly { id: string; category: PresetCategory; activeWord: Partial<ActiveWord>; motion?: PresetMotion }[] = [
  { id: 'classic', category: 'basic', activeWord: { mode: 'color', color: '#18E1D6' } },
  { id: 'shorts', category: 'basic', activeWord: { mode: 'lift', lift: 0.22, color: '#FFE14D' } },
  { id: 'simple', category: 'basic', activeWord: { mode: 'color', color: '#FFFFFF', scale: 1.06} },
  { id: 'prettymarketer', category: 'social', activeWord: { mode: 'color', color: '#FFCDD0' } },
  { id: 'ali', category: 'social', activeWord: { mode: 'none', unspoken: 'dim' } },
  { id: 'slay', category: 'social', activeWord: { mode: 'color', color: '#6474FF' } },
  { id: 'kitty', category: 'social', activeWord: { mode: 'color', color: '#FF3ED4' } },
  { id: 'hustle', category: 'social', activeWord: { mode: 'color', color: '#80FFC9' } },
  { id: 'grape', category: 'social', activeWord: { mode: 'color', color: '#6147FF' } },
  { id: 'karl', category: 'social', activeWord: { mode: 'color', color: '#FFE14D'}, motion: {in: {preset: 'float-in-bottom'}} },
  { id: 'sprout', category: 'social', activeWord: { mode: 'color', color: '#B6FF60' } },
  { id: 'flex', category: 'social', activeWord: { mode: 'color', color: '#FFE14D'}, motion: {in: {preset: 'float-in-bottom'}} },
  { id: 'snugle', category: 'social', activeWord: { mode: 'color', color: '#FF9DE9' } },
  { id: 'mint', category: 'social', activeWord: { mode: 'color', color: '#80FFC9' } },
  { id: 'rizz', category: 'social', activeWord: { mode: 'color', color: '#FDFA14' } },
  { id: 'lime', category: 'social', activeWord: { mode: 'color', color: '#80FFC9'}, motion: {in: {preset: 'drop-in'}} },
  { id: 'phantom', category: 'social', activeWord: { mode: 'box', box: {color: '#6147FF', radius: 0.5, padding: [0.2, 0.08]}, color: '#FFFFFF' } },
  { id: 'bulb', category: 'social', activeWord: { mode: 'none', unspoken: 'hidden' } },
  { id: 'vegas', category: 'social', activeWord: { mode: 'color', color: '#6147FF'}, motion: {in: {preset: 'flip'}} },
  { id: 'boba', category: 'social', activeWord: { mode: 'color', color: '#FDFA14'}, motion: {in: {preset: 'drop-in'}} },
  { id: 'matcha', category: 'social', activeWord: { mode: 'none', unspoken: 'dim' } },
  { id: 'shadeplay', category: 'business', activeWord: { mode: 'none' } },
  { id: 'casper', category: 'business', activeWord: { mode: 'none' } },
  { id: 'corpo', category: 'business', activeWord: { mode: 'none' } },
  { id: 'boo', category: 'business', activeWord: { mode: 'color', color: '#FFE14D'}, motion: {in: {preset: 'drop-in'}} },
  { id: 'beans', category: 'business', activeWord: { mode: 'none', unspoken: 'dim' } },
  { id: 'plain', category: 'business', activeWord: { mode: 'color', color: '#FFE14D'}, motion: {in: {preset: 'drop-in'}} },
  { id: 'capri', category: 'retro', activeWord: { mode: 'none' } },
  { id: 'lowkey', category: 'retro', activeWord: { mode: 'none' } },
  { id: 'vinta', category: 'retro', activeWord: { mode: 'color', color: '#18E1D6'}, motion: {in: {preset: 'float-in-bottom'}} },
  { id: 'slant', category: 'retro', activeWord: { mode: 'color', color: '#FFE14D'}, motion: {in: {preset: 'drop-in'}} },
  { id: 'diego', category: 'retro', activeWord: { mode: 'none', spoken: 'dim', unspoken: 'dim' } },
  { id: 'yeet', category: 'retro', activeWord: { mode: 'color', color: '#FFE14D'}, motion: {in: {preset: 'float-in-bottom'}} },
  { id: 'studio-focus', category: 'social', activeWord: { mode: 'color', durationSeconds: 0.2, color: '#FC75E9', scale: 1.18} },
  { id: 'studio-word-tiles', category: 'social', activeWord: { mode: 'box', durationSeconds: 0.14, color: '#191919', scale: 1.04, box: {color: '#FFD84D', radius: 0.12, padding: [0.2, 0.1]}} },
  { id: 'studio-word-drop', category: 'motion', activeWord: { mode: 'color', color: '#6147FF'}, motion: {in: {preset: 'cascade', unit: 'word', durationSeconds: 0.22, staggerSeconds: 0.04, intensity: 0.85, easing: 'easeOutQuad'}} },
  { id: 'studio-paper-typewriter', category: 'motion', activeWord: { mode: 'none', unspoken: 'hidden'}, motion: {in: {preset: 'typewriter', unit: 'grapheme', durationSeconds: 0.03333333333333333, staggerSeconds: 0.04, intensity: 1, easing: 'linear'}} },
  { id: 'studio-line-swipe', category: 'motion', activeWord: { mode: 'color', color: '#FF6B5B'}, motion: {in: {preset: 'slide-mask', unit: 'line', durationSeconds: 0.36, staggerSeconds: 0.08, intensity: 0.92, easing: 'easeOutQuad'}} },
  { id: 'studio-soft-focus', category: 'motion', activeWord: { mode: 'color', color: '#FFD84D'}, motion: {in: {preset: 'blur-in', unit: 'cue', durationSeconds: 0.38, staggerSeconds: 0, intensity: 0.55, easing: 'easeOutQuad'}} },
  { id: 'studio-rise-settle', category: 'motion', activeWord: { mode: 'color', color: '#FFD84D'}, motion: {in: {preset: 'rise', unit: 'cue', durationSeconds: 0.36, staggerSeconds: 0, intensity: 0.5, easing: 'easeOutQuad'}, out: {preset: 'fade-down', unit: 'cue', durationSeconds: 0.22, staggerSeconds: 0, intensity: 0.35, easing: 'easeInQuad'}} },
  { id: 'studio-kinetic-wave', category: 'motion', activeWord: { mode: 'color', color: '#FFE547'}, motion: {in: {preset: 'wave-in', unit: 'grapheme', durationSeconds: 0.32, staggerSeconds: 0.025, intensity: 0.62, easing: 'easeOutQuad'}, loop: {preset: 'wave', unit: 'grapheme', durationSeconds: 0.96, staggerSeconds: 0.03, intensity: 0.32, easing: 'linear'}} },
  { id: 'studio-ktv', category: 'motion', activeWord: { mode: 'sweep', color: '#FF6A1A', sweep: {unit: 'grapheme', guide: true, nextLine: true}} },
  { id: 'daoyazi', category: 'kinetic', activeWord: { mode: 'color', color: '#FF9B42' } },
];

import { engineRanges } from '@cuccut/editor-wasm';
import type { Rate, ShapeProps } from '@cuccut/protocol';
import { STUDIO_STYLE, asObject, parseColor, type Json } from '../render/text-style.ts';
import { CLASSIC, CLASSIC_WORD_ANIMATION } from './caption-presets.ts';

/** Conversions between values on the property page and the stored fields: speed, volume, aspect ratio and color, and how a wholesale-replaced style object is patched. */

// ---- Speed ----

/** The speed range shown in the UI (the engine accepts 0.1–10). */
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Playback speed → reduced rate: first round to two decimal places (1.5 → 3/2, 0.25 → 1/4, 0.33 → 33/100). */
export function rateFromSpeed(speed: number): Rate {
  const num = Math.round(speed * 100);
  const g = gcd(num, 100);
  return { num: num / g, den: 100 / g };
}

export function speedOf(rate: Rate): number {
  return rate.num / rate.den;
}

// ---- Volume ----

/** Lower bound of the dB reading: anything lower shows −∞. */
export const GAIN_MIN_DB = -96;
/** The engine's maximum volume (linear multiplier; the range accepted by `editor-wasm`). WASM is read only when this is used, not when the module loads. */
const volumeMax = (): number => engineRanges().volume[1];

/** Volume (linear multiplier) → percentage (1 = 100%), rounded. */
export function percentFromVolume(volume: number): number {
  return Math.round(Math.min(volumeMax(), Math.max(0, volume)) * 100);
}

/** Volume percentage → linear multiplier, clamped between 0 and the engine's maximum. */
export function volumeFromPercent(percent: number): number {
  if (!(percent > 0)) return 0;
  return Math.min(volumeMax(), percent / 100);
}

/** The dB reading at the end of the row (volume is converted with `volumeToDb` before being passed in). */
export function formatDb(db: number): string {
  if (db <= GAIN_MIN_DB) return '−∞ dB';
  const rounded = Math.round(db * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)} dB`;
}

// ---- Aspect ratio ----

export const ASPECTS = [
  { key: '16:9', w: 16, h: 9 },
  { key: '9:16', w: 9, h: 16 },
  { key: '1:1', w: 1, h: 1 },
  { key: '4:3', w: 4, h: 3 },
] as const;
export type AspectKey = (typeof ASPECTS)[number]['key'];

/** Changes the aspect ratio: the short side stays the same, and the long side is scaled proportionally and rounded to an even number (the encoder needs even dimensions). */
export function aspectCanvas(canvas: { width: number; height: number }, key: AspectKey): { width: number; height: number } {
  const aspect = ASPECTS.find((a) => a.key === key)!;
  return ratioCanvas(canvas, aspect.w, aspect.h);
}

/** Changes to any `w:h` (the aspect ratio table in the stage toolbar, custom ratios): same as `aspectCanvas`, the short side stays and the long side is rounded to even. */
export function ratioCanvas(canvas: { width: number; height: number }, w: number, h: number): { width: number; height: number } {
  const short = Math.min(canvas.width, canvas.height);
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  return w >= h ? { width: even((short * w) / h), height: short } : { width: short, height: even((short * h) / w) };
}

/** Which aspect ratio the canvas has; returns null if it matches none. */
export function aspectOf(canvas: { width: number; height: number }): AspectKey | null {
  const ratio = canvas.width / canvas.height;
  return ASPECTS.find((a) => Math.abs(a.w / a.h - ratio) < 0.01)?.key ?? null;
}

// ---- Color ----

/** Splits a color into `#RRGGBB` and opacity (0–1); uses `fallback` if it cannot be parsed. */
export function colorParts(value: unknown, fallback: string): { hex: string; alpha: number } {
  const rgba = parseColor(value) ?? parseColor(fallback) ?? { r: 0, g: 0, b: 0, a: 1 };
  const byte = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return { hex: `#${byte(rgba.r)}${byte(rgba.g)}${byte(rgba.b)}`.toUpperCase(), alpha: rgba.a };
}

/** When opaque, writes six digits; otherwise writes eight digits `#RRGGBBAA`. */
export function colorString(hex: string, alpha: number): string {
  const base = hex.slice(0, 7).toUpperCase();
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return a >= 255 ? base : `${base}${a.toString(16).padStart(2, '0').toUpperCase()}`;
}

/** Replaces the opacity of a color; the hue stays the same. */
export function withAlpha(value: unknown, alpha: number, fallback: string): string {
  return colorString(colorParts(value, fallback).hex, alpha);
}

// ---- Objects replaced as a whole ----

/** Text style patch: `style` is replaced as a whole, and the patch is layered on top of the original object. */
export function patchTextStyle(style: unknown, patch: Json): Json {
  return { ...asObject(style), ...patch };
}

/** Shape patch: same as above; with no kind given, it is treated as a rectangle. */
export function patchShape(shape: ShapeProps | undefined, patch: Json): ShapeProps {
  return { shape: 'rect', ...shape, ...patch } as ShapeProps;
}

/** Fields nested one level deep (`dropShadow.on`, `glow.color`, …): only the keys given at this level are replaced. */
export function nested(style: unknown, group: string, patch: Json): Json {
  return { [group]: { ...asObject(asObject(style)[group]), ...patch } };
}

/** Whether a text style can be edited on the property page: the element model's text style has no schema; objects carrying another schema are read-only. */
export function editableTextStyle(style: unknown): boolean {
  return asObject(style).schema === undefined;
}

// ---- Caption style document ----

/**
 * Default preset (video format spec §5.6 “Default preset”): captions without a style document are drawn with this one (the preview and the export engine use the same one, `video_model::caption_style::default_studio_style`), and newly created caption styles are also seeded with it. The finish is “Classic”, and `punct: true` turns commas and periods into spaces. The one used in the flow lives in `packages/jobs/src/pipelines/caption-layer.ts`; change all three together.
 */
export const DEFAULT_CAPTION_STYLE: Json = { schema: STUDIO_STYLE, style: { ...CLASSIC, wordAnimation: CLASSIC_WORD_ANIMATION, punct: true } };

/** The root object of a Studio caption style; other schemas return null (the property page is read-only). */
export function captionStyleRoot(body: unknown): Json | null {
  const doc = asObject(body);
  return doc.schema === STUDIO_STYLE ? asObject(doc.style) : null;
}

/** Caption style patch: other fields in the body are kept as-is, and the patch is layered onto the root `style` object. */
export function patchCaptionStyle(body: unknown, patch: Json): Json {
  const doc = asObject(body);
  return { ...doc, schema: STUDIO_STYLE, style: { ...asObject(doc.style), ...patch } };
}

// ---- Time ----

/** Seconds → decimal string (up to three decimal places, trailing zeros removed), for fields such as fades that are committed in seconds. */
export function decimalSeconds(seconds: number): string {
  return String(Math.round(Math.max(0, seconds) * 1000) / 1000);
}

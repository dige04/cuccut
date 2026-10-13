import type { AssetRecord, Id, Sequence } from '@cuccut/protocol';
import { ratioCanvas } from './property-values.ts';
import { primaryMedia } from './stage-media.ts';

/**
 * Rules for the stage bottom bar (`StageBar` in the prototype stage.jsx; the bar that floats up when an element is selected on the canvas is a different one, see stage-toolbar.ts): the aspect-ratio table and which preset is current, custom aspect ratios, and the platform safe zones for portrait. Does not touch React.
 */

export interface StageRatio {
  key: string;
  w: number;
  h: number;
}

/** Aspect-ratio table (`ratios` in the prototype's data.js; “Original” is handled separately): the short side stays fixed and the long side is derived, the same way the inspector's aspect ratio works (`ratioCanvas`). */
export const STAGE_RATIOS: readonly StageRatio[] = [
  { key: '16:9', w: 16, h: 9 },
  { key: '9:16', w: 9, h: 16 },
  { key: '1:1', w: 1, h: 1 },
  { key: '4:3', w: 4, h: 3 },
  { key: '3:4', w: 3, h: 4 },
  { key: '2:1', w: 2, h: 1 },
  { key: '2.35:1', w: 2.35, h: 1 },
  { key: '1.85:1', w: 1.85, h: 1 },
];
export const ORIGINAL_RATIO = 'original';

/** Maximum canvas side length the engine accepts (`MAX_CANVAS_SIDE` in crates/video-engine). */
export const CANVAS_SIDE_MAX = 16_384;

type Size = { width: number; height: number };

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** “Original”: the display size of the first video in the main media; null when there is no video (audio only, image, or empty), and the menu entry is greyed out. */
export function sourceSize(sequence: Sequence, assets: Record<Id, AssetRecord>): Size | null {
  for (const media of primaryMedia(sequence)) {
    if (media.kind !== 'video') continue;
    const video = assets[media.ref.id]?.revisions[media.ref.revision]?.video;
    if (video && video.displayWidth > 0 && video.displayHeight > 0) return { width: video.displayWidth, height: video.displayHeight };
  }
  return null;
}

/** Which preset the canvas currently matches: entries in the table take priority (showing the ratio on the button is more useful than showing “Original”); if none match, check whether it matches the original ratio; if neither, null (custom). */
export function stageRatioOf(canvas: Size, original: Size | null): string | null {
  const ratio = canvas.width / canvas.height;
  const named = STAGE_RATIOS.find((r) => near(r.w / r.h, ratio));
  if (named) return named.key;
  return original && near(original.width / original.height, ratio) ? ORIGINAL_RATIO : null;
}

/** Button label: entries in the table use their preset label; anything else is reduced to the simplest integer ratio, and if reducing does not make the numbers much smaller (e.g. 1778:1000), it is written as `1.78:1`. */
export function ratioText(canvas: Size): string {
  const named = STAGE_RATIOS.find((r) => near(r.w / r.h, canvas.width / canvas.height));
  if (named) return named.key;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(Math.round(canvas.width), Math.round(canvas.height)) || 1;
  const w = Math.round(canvas.width) / d;
  const h = Math.round(canvas.height) / d;
  if (w <= 32 && h <= 32) return `${w}:${h}`;
  const r = canvas.width / canvas.height;
  return r >= 1 ? `${trim(r)}:1` : `1:${trim(1 / r)}`;
}

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** The canvas to switch to when a preset is picked; null for “Original” when there is no video. */
export function stageRatioCanvas(canvas: Size, key: string, original: Size | null): Size | null {
  if (key === ORIGINAL_RATIO) return original ? ratioCanvas(canvas, original.width, original.height) : null;
  const ratio = STAGE_RATIOS.find((r) => r.key === key);
  return ratio ? ratioCanvas(canvas, ratio.w, ratio.h) : null;
}

export type CustomRatio = { ok: true; canvas: Size } | { ok: false; reason: 'invalid' | 'tooLong' };

/** Custom aspect ratio (the two numbers in the prototype's “Custom…” dialog): both must be positive; the long side derived from the unchanged short side must not exceed the engine limit. */
export function customRatio(canvas: Size, w: number, h: number): CustomRatio {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { ok: false, reason: 'invalid' };
  const next = ratioCanvas(canvas, w, h);
  return next.width > CANVAS_SIDE_MAX || next.height > CANVAS_SIDE_MAX ? { ok: false, reason: 'tooLong' } : { ok: true, canvas: next };
}

/** Portrait: platform safe zones only apply to this case (`isPortrait` in the prototype's model-shorts.js). */
export function isPortrait(canvas: Size): boolean {
  return canvas.height > canvas.width;
}

// ---- Platform safe zones (`SAFE` / `zones` / `safeBox` in the prototype's model-shorts.js) ----

/** Areas covered by the platform UI on portrait screens, as a percentage of the frame. The prototype is the only source of these numbers; change both sides together. */
export const SAFE_AREA = { top: 8, right: 18, bottom: 24, side: 6 } as const;

export type SafeZoneKey = 'top' | 'right' | 'bottom';
export interface SafeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Three covered areas: the top status bar, the right-hand button column, and the bottom caption and comments. The right column sits between the top and bottom areas and does not overlap them. */
export function safeZones(): Array<SafeRect & { key: SafeZoneKey }> {
  const { top, right, bottom } = SAFE_AREA;
  return [
    { key: 'top', x: 0, y: 0, w: 100, h: top },
    { key: 'right', x: 100 - right, y: top, w: right, h: 100 - top - bottom },
    { key: 'bottom', x: 0, y: 100 - bottom, w: 100, h: bottom },
  ];
}

/** Dashed box: the area that is not covered, safe for text and people. */
export function safeBox(): SafeRect {
  const { top, right, bottom, side } = SAFE_AREA;
  return { x: side, y: top, w: 100 - side - right, h: 100 - top - bottom };
}


import type { Id, Sequence } from '@cuccut/protocol';
import { itemFrames, trackRows } from './editor.ts';

/**
 * Timeline zoom (prototype model-timeline.js zoom section and data.js `zoomMenu`). Pixels per second is the real value; the percentage is only the display.
 * Horizontal geometry: x = PAD + t × pxPerSecond, where x is in the lane viewport’s coordinates (excluding the track header column); `lane` is the width of the lane viewport.
 * Lower zoom limit = min(ZOOM_MIN, the value that fits the whole video across the lane). Short videos still stop at ZOOM_MIN; long videos can always zoom out far enough to fit the whole video in view (this can be below 1%).
 */

export const ZOOM_MIN = 4;
export const ZOOM_MAX = 400;
/** = 100%。 */
export const ZOOM_DEFAULT = 40;
/** Multiplier for one zoom-in or zoom-out step. */
export const ZOOM_STEP = 1.5;
/** “Zoom to playhead” = 200%. */
export const ZOOM_PLAYHEAD = ZOOM_DEFAULT * 2;
/** Inner padding on the left and right of the lane (same value as in timeline.tsx). */
export const ZOOM_PAD = 12;

export type ZoomAction = 'in' | 'out' | '100' | 'fit' | 'fitClip' | 'playhead' | 'fitSelection';

/** Menu order and shortcuts (written for macOS; other platforms swap in Ctrl+ / Alt+ via key-labels). */
export const ZOOM_MENU: readonly { id: ZoomAction; keys: string }[] = [
  { id: 'in', keys: '⌘=' },
  { id: 'out', keys: '⌘−' },
  { id: '100', keys: '⌘0' },
  { id: 'fit', keys: '⌥⌘1' },
  { id: 'fitClip', keys: '⌥⌘2' },
  { id: 'playhead', keys: '⌥⌘3' },
  { id: 'fitSelection', keys: '⌥⌘4' },
];

/** Pixels per second that makes `seconds` exactly fill the lane (leaving PAD on each side). */
export function fitPxPerSecond(seconds: number, lane: number): number {
  return seconds > 0 ? (lane - ZOOM_PAD * 2) / seconds : ZOOM_DEFAULT;
}

/** The lower limit for zooming out. Falls back to ZOOM_MIN when there is no duration, or the lane has not been measured yet (≤ 2×PAD). */
export function zoomFloor(duration: number, lane: number): number {
  if (!(duration > 0) || !(lane > ZOOM_PAD * 2)) return ZOOM_MIN;
  return Math.min(ZOOM_MIN, fitPxPerSecond(duration, lane));
}

/** Clamped to [min(ZOOM_MIN, floor), ZOOM_MAX]. When `floor` is greater than ZOOM_MIN, the lower limit is not raised. */
export function clampZoom(pxPerSecond: number, floor: number): number {
  const min = Math.min(ZOOM_MIN, floor > 0 ? floor : ZOOM_MIN);
  return Math.min(ZOOM_MAX, Math.max(min, pxPerSecond));
}

/**
 * Percentage label, where 100% = ZOOM_DEFAULT. Values ≥10 round to an integer (“22%”); 1–10 keep one decimal place and drop a trailing .0 (“4.4%”, “5%”); <1 use two significant digits and drop trailing zeros (“0.42%”, “0.05%”). When rounding carries across a tier (9.96 → “10%”), it is not written as “10.0%”, and an effective zoom never shows “0%”.
 */
export function zoomLabel(pxPerSecond: number): string {
  const pct = (pxPerSecond / ZOOM_DEFAULT) * 100;
  if (!(pct > 0) || !Number.isFinite(pct)) return '—';
  if (pct >= 10) return `${Math.round(pct)}%`;
  const text = pct >= 1 ? pct.toFixed(1) : pct.toPrecision(2);
  return `${text.includes('.') ? text.replace(/\.?0+$/, '') : text}%`;
}

/** The view before and after a zoom: times are in seconds, `scroll` is the lane’s horizontal scroll offset. */
export interface ZoomView {
  pxPerSecond: number;
  scroll: number;
  lane: number;
  duration: number;
  playhead: number;
}

/** The scroll offset that puts the moment `seconds` at position `x` in the lane viewport (not less than 0; the right end is bounded naturally by the content width). */
export function anchoredScroll(seconds: number, x: number, pxPerSecond: number): number {
  return Math.max(0, ZOOM_PAD + seconds * pxPerSecond - x);
}

/** The anchor for an anchored zoom: if the playhead is inside the viewport, keep it at its original screen x; otherwise keep the moment at the viewport’s center fixed. */
export function zoomAnchor(view: ZoomView): { seconds: number; x: number } {
  const lane = Math.max(0, view.lane);
  const x = ZOOM_PAD + view.playhead * view.pxPerSecond - view.scroll;
  if (x >= 0 && x <= lane) return { seconds: view.playhead, x };
  return { seconds: (view.scroll + lane / 2 - ZOOM_PAD) / view.pxPerSecond, x: lane / 2 };
}

/**
 * Zoom action → new pixels per second and scroll offset. Returns null when no result can be obtained (fit clip or fit selection with nothing selected).
 * in / out / 100: anchored zoom; fit: whole video in view, back to 0; playhead: zoom to 200% and center the playhead; fitClip / fitSelection: make the range fill the viewport and center it (if the limit prevents filling it, still center it).
 */
export function zoomPlan(action: ZoomAction, view: ZoomView, span?: { start: number; end: number } | null): ZoomView | null {
  const floor = zoomFloor(view.duration, view.lane);
  const at = (pxPerSecond: number, scroll: number): ZoomView => ({ ...view, pxPerSecond, scroll });
  const keep = (next: number) => {
    const pxPerSecond = clampZoom(next, floor);
    const anchor = zoomAnchor(view);
    return at(pxPerSecond, anchoredScroll(anchor.seconds, anchor.x, pxPerSecond));
  };
  const centerOn = (seconds: number, pxPerSecond: number) =>
    at(pxPerSecond, anchoredScroll(seconds, Math.max(0, view.lane) / 2, pxPerSecond));
  switch (action) {
    case 'in':
      return keep(view.pxPerSecond * ZOOM_STEP);
    case 'out':
      return keep(view.pxPerSecond / ZOOM_STEP);
    case '100':
      return keep(ZOOM_DEFAULT);
    case 'fit':
      return at(clampZoom(fitPxPerSecond(view.duration, view.lane), floor), 0);
    case 'playhead':
      return centerOn(view.playhead, clampZoom(ZOOM_PLAYHEAD, floor));
    case 'fitClip':
    case 'fitSelection': {
      if (!span) return null;
      const length = Math.max(0.1, span.end - span.start);
      return centerOn(span.start + length / 2, clampZoom(fitPxPerSecond(length, view.lane), floor));
    }
  }
}

/** A range (seconds). */
export interface Span {
  start: number;
  end: number;
}

function spanOf(sequence: Sequence, ids: readonly Id[]): Span | null {
  const perSecond = sequence.fps.num / sequence.fps.den;
  let span: Span | null = null;
  for (const item of sequence.items) {
    if (!ids.includes(item.id)) continue;
    const { start, end } = itemFrames(item, sequence.fps);
    span = span
      ? { start: Math.min(span.start, start / perSecond), end: Math.max(span.end, end / perSecond) }
      : { start: start / perSecond, end: end / perSecond };
  }
  return span;
}

/**
 * The range for “fit current clip”: the clip under the playhead. If a selected clip covers the playhead, use it; otherwise take the video clip under the playhead on the topmost video track. Returns null if there is neither.
 */
export function clipSpanAt(sequence: Sequence, selection: readonly Id[], playhead: number): Span | null {
  const frame = (playhead * sequence.fps.num) / sequence.fps.den;
  const covers = (id: Id) => {
    const item = sequence.items.find((candidate) => candidate.id === id);
    if (!item) return false;
    const { start, end } = itemFrames(item, sequence.fps);
    return start <= frame + 1e-6 && end > frame + 1e-6;
  };
  const selected = selection.find(covers);
  if (selected) return spanOf(sequence, [selected]);
  for (const { track } of trackRows(sequence)) {
    if (track.kind !== 'visual') continue;
    const hit = sequence.items.find((item) => item.trackId === track.id && item.type === 'video' && covers(item.id));
    if (hit) return spanOf(sequence, [hit.id]);
  }
  return null;
}

/** The range for “fit selection”: the union of the selected items; returns null if nothing is selected. */
export function selectionSpan(sequence: Sequence, selection: readonly Id[]): Span | null {
  return selection.length ? spanOf(sequence, selection) : null;
}

const ALT_DIGITS: Record<string, ZoomAction> = { '1': 'fit', '2': 'fitClip', '3': 'playhead', '4': 'fitSelection' };

/**
 * Which zoom action a keyboard event maps to (one-to-one with the shortcuts in ZOOM_MENU). Returns null for a key that is not a zoom key. `mod` is ⌘ on macOS, Ctrl elsewhere.
 * While ⌥ is held on macOS, `key` is a special character, so digit keys always use `code`.
 */
export function zoomKey(event: { key: string; code: string; altKey: boolean; shiftKey: boolean }, mod: boolean): ZoomAction | null {
  if (!mod) return null;
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
  if (event.altKey) {
    if (event.shiftKey || !digit) return null;
    return ALT_DIGITS[digit] ?? null;
  }
  const { key, code } = event;
  if (code === 'Equal' || code === 'NumpadAdd' || key === '=' || key === '+') return 'in';
  if (code === 'Minus' || code === 'NumpadSubtract' || key === '-' || key === '−') return 'out';
  if (!event.shiftKey && (digit === '0' || key === '0')) return '100';
  return null;
}

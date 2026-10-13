import {
  sequenceDurationFrames,
  type EditOperation,
  type FrameSpan,
  type Id,
  type Sequence,
  type SequenceItem,
  type Place,
  type SequenceItemInput,
} from '@cuccut/protocol';
import { trackFree } from './editor-ops.ts';
import { round1 } from './geometry-panel.ts';

/**
 * Shared part of the right panel's “click a cell = create at the playhead” (elements and text pages): which time span it lands in, which tracks, which box on screen,
 * and the one-transaction operation. Follows the earlier version's rules (ccut-editor-core `TimingDefault::at_playhead_in`, `default_place`).
 */

/** Minimum length of a new element in seconds (earlier version `MIN_ELEMENT_DURATION`). */
const MIN_SECONDS = 0.1;
/** Length in seconds of an element that follows the whole piece to its end when the piece is still empty (earlier version `OPEN_ENDED_SPAN`). */
const OPEN_SECONDS = 10;

const perSecond = (sequence: Sequence) => sequence.fps.num / sequence.fps.den;
const minFrames = (sequence: Sequence) => Math.max(1, Math.round(MIN_SECONDS * perSecond(sequence)));

/**
 * `seconds` seconds starting at `startFrame`. The start is the playhead and does not move earlier: when the piece has length, the end is cut at the piece's end but at least 0.1 s is kept;
 * when the piece is still empty, the whole span is placed.
 */
export function spanAtPlayhead(sequence: Sequence, startFrame: number, seconds: number): FrameSpan {
  const start = Math.max(0, Math.round(startFrame));
  const least = minFrames(sequence);
  const wanted = Math.max(least, Math.round(seconds * perSecond(sequence)));
  const end = sequenceDurationFrames(sequence);
  return { fromFrame: start, durationFrames: end > 0 ? Math.max(least, Math.min(wanted, end - start)) : wanted };
}

/** Elements that follow the whole piece (progress bar, waveform): from start to end; when the piece is still empty, 10 s from the playhead. */
export function wholeFilmSpan(sequence: Sequence, startFrame: number): FrameSpan {
  const end = sequenceDurationFrames(sequence);
  return end > 0 ? { fromFrame: 0, durationFrames: end } : spanAtPlayhead(sequence, startFrame, OPEN_SECONDS);
}

/** Which track to put it on: an existing one, or the one `addTrack` creates in the same transaction (`ref`). */
export type TrackSlot = { trackId: Id } | { trackRef: string };

/**
 * Find tracks for `count` new visual layers (bottom-up): only use the tracks above the topmost visual track that has content in this span. New things must sit above the picture to be seen.
 * Locked or hidden tracks are skipped; if there aren't enough, new ones are created at the top.
 */
export function visualSlots(
  sequence: Sequence,
  span: FrameSpan,
  count: number,
  name?: string,
): { slots: TrackSlot[]; operations: EditOperation[] } {
  const start = span.fromFrame;
  const end = start + span.durationFrames;
  const visual = sequence.tracks.filter((track) => track.kind === 'visual').sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const busy = visual.filter((track) => !trackFree(sequence, track.id, start, end));
  const floor = busy.length ? Math.max(...busy.map((track) => track.order)) : Number.NEGATIVE_INFINITY;
  const slots: TrackSlot[] = visual
    .filter((track) => track.order > floor && !track.locked && track.visible)
    .slice(0, count)
    .map((track) => ({ trackId: track.id }));
  const operations: EditOperation[] = [];
  for (let index = slots.length; index < count; index += 1) {
    const ref = `new-track-${index}`;
    operations.push({ type: 'addTrack', sequenceId: sequence.id, kind: 'visual', ref, ...(name ? { name } : {}) });
    slots.push({ trackRef: ref });
  }
  return { slots, operations };
}

/** Position of a new layer: center `x` / `y` are percentages of the frame width and height, `w` is a percentage of the frame width, and `rot` is the angle in degrees. */
export interface NewPlace {
  x: number;
  y: number;
  w?: number;
  rot?: number;
}

/** `place` of a new layer: one decimal place; the center is always written (each kind has a different default center), `w` is written if given, and the angle is not written when not rotated. */
export function placeBox(place: NewPlace): Place {
  const out: Place = { x: round1(place.x), y: round1(place.y) };
  if (place.w !== undefined) out.w = round1(place.w);
  const rot = round1(place.rot ?? 0);
  if (rot !== 0) out.rot = rot;
  return out;
}

type Visual = Extract<SequenceItem, { type: 'text' | 'shape' | 'sticker' | 'visualizer' | 'progress' | 'confetti' | 'composition' }>;
type Fields<Item> = Item extends Visual
  ? Omit<Item, 'id' | 'lineage' | 'trackId' | 'span' | 'enabled' | 'locked' | 'paintOrder' | 'followPolicy'>
  : never;

/** A newly created picture layer: the clip's own fields, plus it appears a few frames later than the group (staggered for text preset members). */
export type VisualLayer = Fields<Visual> & { delayFrames?: number };

/**
 * Transaction creating several picture layers: missing tracks are created first, then everything is inserted at once. The group occupies `span`; each layer appears `delayFrames` after the start of `span`
 * and lasts until the group ends (at least 0.1 s kept). Array order is the stacking order, with lower layers first.
 */
export function insertVisual(sequence: Sequence, span: FrameSpan, layers: readonly VisualLayer[], trackName?: string): EditOperation[] {
  const { slots, operations } = visualSlots(sequence, span, layers.length, trackName);
  const end = span.fromFrame + span.durationFrames;
  const latest = Math.max(span.fromFrame, end - minFrames(sequence));
  const items = layers.map(({ delayFrames = 0, ...fields }, index) => {
    const from = Math.min(latest, span.fromFrame + Math.max(0, Math.round(delayFrames)));
    return { ...fields, ...slots[index]!, span: { fromFrame: from, durationFrames: end - from } } as SequenceItemInput;
  });
  return [...operations, { type: 'insertItems', sequenceId: sequence.id, items }];
}

/** Clips created in the receipt (excluding tracks and documents), in insertion order. */
export function createdItemIds(createdIds: readonly Id[], sequence: Sequence): Id[] {
  const items = new Set(sequence.items.map((item) => item.id));
  return createdIds.filter((id) => items.has(id));
}

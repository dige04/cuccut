import {
  defineMessages,
  isVisualItem,
  onLocaleChange,
  sequenceDurationFrames,
  type EditOperation,
  type Id,
  type MediaTime,
  type Sequence,
  type SequenceItem,
  type SequenceItemInput,
  type Track,
  type Place,
  type VisualItem,
} from '@cuccut/protocol';
import { itemFrames, trackAccepts } from './editor.ts';
import { posable, poseOf } from './stage-pose.ts';
import { zhHans } from './item-clipboard.zh-Hans.ts';
import { zhHant } from './item-clipboard.zh-Hant.ts';
import { ja } from './item-clipboard.ja.ts';
import { ko } from './item-clipboard.ko.ts';
import { es } from './item-clipboard.es.ts';
import { fr } from './item-clipboard.fr.ts';
import { de } from './item-clipboard.de.ts';
import { nl } from './item-clipboard.nl.ts';
import { ptBR } from './item-clipboard.pt-BR.ts';
import { it } from './item-clipboard.it.ts';
import { ru } from './item-clipboard.ru.ts';
import { pl } from './item-clipboard.pl.ts';
import { tr } from './item-clipboard.tr.ts';
import { vi } from './item-clipboard.vi.ts';

/** Copy for copy names (the English is the source of keys and types; translations are in `item-clipboard.zh-Hans.ts`). */
const en = {
  copySuffix: ' · Copy',
};
export type ItemClipboardMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Copy, paste and duplicate for the timeline (prototype editor-keys.jsx's spawn, and model-select.js's pasteSpan / pasteOffset).
 *
 * The clipboard holds snapshots of the segments as they were at the moment of copying; paste turns them into one `insertItems` change (if a track is missing, `addTrack` is added in the same change).
 * Engine-managed fields (id, lineage, enabled, locked, stacking order, follow) and link groups are not carried over: a copy is a brand-new, enabled segment.
 */

/** Each paste offsets the copy on screen by a further 2% of the frame size (prototype PASTE_STEP). */
export const PASTE_STEP = 2;
/** Limits on the copy's center (frame percentages, prototype LIMITS): the offset cannot push it out of the frame. */
export const PASTE_LIMITS = { x: [3, 97], y: [4, 96] } as const;
/** The suffix for copy names; copying a copy does not stack it into “· copy · copy”. */
export let COPY_SUFFIX: string = M.copySuffix;
onLocaleChange(() => {
  COPY_SUFFIX = M.copySuffix;
});

/** The time of the segment (frames): audio can fall between frames, everything else is on frames. */
interface Frames {
  start: number;
  end: number;
}

/**
 * Which time span the copy lands in (prototype pasteSpan): if the playhead is within the source segment's time span (both ends count), paste in place;
 * if it is outside, move it to the playhead, keeping its length, with the start clamped to [0, total length − length]. Returns the new start (frames); returns it unchanged when pasting in place.
 */
export function pasteStart(range: Frames, playheadFrame: number, durationFrames: number): number {
  if (playheadFrame >= range.start - 1e-6 && playheadFrame <= range.end + 1e-6) return range.start;
  const length = range.end - range.start;
  const latest = Math.max(0, Math.floor(durationFrames - length + 1e-6));
  return Math.min(Math.max(0, playheadFrame), latest);
}

const roundTo = (value: number, k: number) => {
  const r = (Math.sign(value) * Math.round(Math.abs(value) * k)) / k;
  return r === 0 ? 0 : r;
};

/** Offset along one axis: values already outside the limits (mostly-off-screen videos) stay put, so they are not pulled back into the frame. */
function shiftAxis(center: number, step: number, [lo, hi]: readonly [number, number]): number {
  if (center < lo - 1e-6 || center > hi + 1e-6) return center;
  return roundTo(Math.min(hi, Math.max(lo, center + step)), 10);
}

/**
 * The copy's `place` (prototype pasteOffset): the frame center is offset to the lower right by `PASTE_STEP × generation` percent of the frame, clamped to the limits;
 * size and angle are unchanged. Items that fill the whole canvas (where the frame ignores position) are left entirely unchanged.
 */
export function pastePlace(item: VisualItem, canvas: { width: number; height: number }, generation: number): Place {
  const { width: W, height: H } = canvas;
  const step = PASTE_STEP * generation;
  if (W <= 0 || H <= 0 || step === 0 || !posable(item, canvas)) return item.place;
  const pose = poseOf(item, canvas);
  const cx = (pose.cx / W) * 100;
  const cy = (pose.cy / H) * 100;
  const nx = shiftAxis(cx, step, PASTE_LIMITS.x);
  const ny = shiftAxis(cy, step, PASTE_LIMITS.y);
  return { ...item.place, ...(nx !== cx ? { x: nx } : {}), ...(ny !== cy ? { y: ny } : {}) };
}

/** The copy's name: strips any existing “· copy” and then adds it once. */
export function copyName(name: string): string {
  return `${name.endsWith(COPY_SUFFIX) ? name.slice(0, -COPY_SUFFIX.length) : name}${COPY_SUFFIX}`;
}

/** Which track to place it on: an existing one, or one created in the same change (`ref`). */
type Slot = { trackId: Id } | { trackRef: string };

export interface PastePlan {
  operations: EditOperation[];
  /** How many items were pasted. */
  count: number;
}

export interface PasteOptions {
  /** Which frame the playhead is on. */
  playheadFrame: number;
  /** Which paste this is in the session (duplicates included), which determines how far the copies are staggered on screen. */
  generation: number;
  /** The name shown for a segment that has no name of its own (material name, generator name, …); the copy appends “· copy” to it. */
  labelOf(item: SequenceItem): string;
}

const ZERO = (timescale: number): MediaTime => ({ ticks: '0', timescale });

/**
 * Pastes the clipboard segments back into the sequence: one change, with the whole batch as a single undo record (prototype spawn).
 *
 * The time follows `pasteStart`, calculated for each item separately. Track: if the source track is empty at the landing spot (counting items already placed in this batch), not locked, and the type matches, the item goes back on its original track;
 * otherwise it goes on the first empty track of the same type above it (copies stacked on top of the original are visible); if neither works, a new track is created at the very top.
 * Text with no name of its own is not given one: the timeline keeps showing the body as before, and it changes along with the body when edited.
 */
export function pasteOperations(sequence: Sequence, entries: readonly SequenceItem[], options: PasteOptions): PastePlan {
  if (!entries.length) return { operations: [], count: 0 };
  const fps = sequence.fps;
  const duration = sequenceDurationFrames(sequence);
  const tracks = [...sequence.tracks].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const byId = new Map(tracks.map((track) => [track.id, track]));
  // Items already placed in this batch (tracked by track or ref): later copies must not stack on top of them.
  const placed = new Map<string, Frames[]>();
  const created: { ref: string; kind: Track['kind'] }[] = [];
  const operations: EditOperation[] = [];
  const items: SequenceItemInput[] = [];

  const free = (key: string, trackId: Id | null, range: Frames) => {
    const clash = (other: Frames) => other.end > range.start + 1e-6 && other.start < range.end - 1e-6;
    if ((placed.get(key) ?? []).some(clash)) return false;
    if (!trackId) return true;
    return sequence.items.every((item) => item.trackId !== trackId || !clash(itemFrames(item, fps)));
  };

  for (const entry of entries) {
    const source = itemFrames(entry, fps);
    const start = pasteStart(source, options.playheadFrame, duration);
    const range = { start, end: start + (source.end - source.start) };
    const usable = (track: Track | undefined): track is Track => !!track && !track.locked && trackAccepts(track, entry);
    const home = byId.get(entry.trackId);
    let slot: Slot | null = null;
    if (usable(home) && free(home.id, home.id, range)) slot = { trackId: home.id };
    if (!slot) {
      const floor = home?.order ?? Number.NEGATIVE_INFINITY;
      const above = tracks.find((track) => track.order > floor && track.visible && usable(track) && free(track.id, track.id, range));
      if (above) slot = { trackId: above.id };
    }
    if (!slot) {
      const kind: Track['kind'] = entry.type === 'audio' ? 'audio' : entry.type === 'caption' ? 'subtitle' : 'visual';
      const fresh = created.find((track) => track.kind === kind && free(track.ref, null, range));
      if (fresh) slot = { trackRef: fresh.ref };
      else {
        const ref = `paste-track-${created.length}`;
        created.push({ ref, kind });
        operations.push({ type: 'addTrack', sequenceId: sequence.id, kind, ref });
        slot = { trackRef: ref };
      }
    }
    const key = 'trackId' in slot ? slot.trackId : slot.trackRef;
    placed.set(key, [...(placed.get(key) ?? []), range]);
    items.push(pasteInput(entry, slot, start, source.start, sequence, options));
  }
  operations.push({ type: 'insertItems', sequenceId: sequence.id, items });
  return { operations, count: items.length };
}

/** Fields of one copy: engine-managed fields and link groups are removed, and time, track, name and on-screen position are replaced. */
function pasteInput(entry: SequenceItem, slot: Slot, start: number, sourceStart: number, sequence: Sequence, options: PasteOptions): SequenceItemInput {
  const { id: _id, lineage: _lineage, trackId: _track, enabled: _enabled, locked: _locked, paintOrder: _order, followPolicy: _follow, linkGroupId: _link, ...rest } =
    entry;
  const fields: Record<string, unknown> = { ...rest, ...slot };
  if (entry.name || entry.type !== 'text') fields.name = copyName(entry.name || options.labelOf(entry));
  if (isVisualItem(entry)) fields.place = pastePlace(entry, sequence.canvas, options.generation);
  if (entry.type === 'audio') {
    // Pasting in place keeps the sub-frame offset; when moved to the playhead, it lands on a frame.
    if (start !== sourceStart) {
      fields.fromFrame = Math.round(start);
      fields.subframeOffset = ZERO(entry.subframeOffset.timescale);
    }
  } else {
    fields.span = { fromFrame: Math.round(start), durationFrames: entry.span.durationFrames };
  }
  return fields as unknown as SequenceItemInput;
}

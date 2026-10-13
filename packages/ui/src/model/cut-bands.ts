import type { AssetRecord, EditOperation, Id, Rate, Sequence, SequenceItem } from '@cuccut/protocol';
import { itemFrames } from './editor.ts';
import { joinWords, type SpeechWord } from './speech-cues.ts';
import {
  assetDuration,
  cutSeams,
  cutsWithin,
  decimalSeconds,
  restoreOperations,
  type CutSeam,
  type RestorePlan,
  type RestoreRefusal,
  type TrackedCut,
} from './transcript-cut.ts';

/**
 * Cut bands on the timeline (prototype timeline-cutbands.jsx; `dragEdge` / `dragSlotEdge` / `retime` in model-cut.js).
 *
 * - Bands are derived from the timeline (`cutSeams`): the video and its linked audio each have a seam at the same place, and these combine into one band running across the tracks. Restoring and changing a range finds the cuts covering that seam
 *   from the media's cut set (video format spec §6.7); a seam not made by a cut is refused as is.
 * - The timeline is the finished cut: removed content takes no time. The coordinates used when dragging the two edges are the sequence frames after restoring this one, with the cut at 0: the removed span is at
 *   `[0, frames)`, the instance on the left is before it, and the instance on the right is after it.
 * - Changing a range = one transaction: `restoreCut` puts back the cut at this point, then `addCuts` cuts the new media range; undo steps back one; dragging to zero width = restore only.
 * - Snapping to word boundaries by default: the left edge snaps to the start of a word and the right edge to the end of a word, keeping a `WORD_PAD` margin and aligned to frames, and never crossing an adjacent word (so no half-word is cut);
 *   holding Alt drops freely, aligned only to frames. Both edges are clamped within the adjacent instances: at least one frame is left for the neighbour, and if the neighbour's other end is also a cut, the whole thing can be removed (the two cuts merge into one).
 */

const EPS = 1e-6;

/** Margin kept before and after a word when snapping (media seconds; same as the kernel `ccut-timeline::words::DEFAULT_WORD_PAD`). */
export const WORD_PAD = 0.05;

export interface CutBand {
  key: string;
  assetId: Id;
  /** The left and right instances representing the cut (video first, then the earliest in track order): restoring extends from the left instance, and the linked instance follows. */
  leftId: Id;
  rightId: Id;
  /** Which tracks have a cut at this point (in track order). */
  trackIds: Id[];
  /** Position of the cut on the sequence (frames; audio may be fractional). */
  frame: number;
  /** The removed media range (seconds, media clock): from the left instance's out point to the right instance's in point. */
  from: number;
  to: number;
  /** Media seconds / sequence seconds. */
  rate: number;
  /** Removed length (sequence frames; rounded so it matches the number of frames put back on restore). */
  frames: number;
  /** The earliest the left edge and the latest the right edge can be dragged to (frames after restoring, relative to the cut). */
  lo: number;
  hi: number;
}

function linearRate(item: SequenceItem): number {
  if ((item.type === 'video' || item.type === 'audio') && item.timeMap.kind === 'linear') {
    const rate = item.timeMap.rate.num / item.timeMap.rate.den;
    if (rate > 0) return rate;
  }
  return 1;
}

/** Cut band on the timeline: cuts on the same media at the same position (rounded to frames) are merged into one, sorted by position. */
export function cutBands(sequence: Sequence): CutBand[] {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const seams = cutSeams(sequence);
  const items = new Map(sequence.items.map((item) => [item.id, item]));
  const order = new Map(sequence.tracks.map((track) => [track.id, track.order]));
  // Instances that are themselves cuts at the start or end: dragging to the edge can remove the whole thing, merging the two cuts into one.
  const startsAtSeam = new Set(seams.map((seam) => seam.rightId));
  const endsAtSeam = new Set(seams.map((seam) => seam.leftId));
  const groups = new Map<string, CutSeam[]>();
  for (const seam of seams) {
    const key = `${seam.assetId}@${Math.round(seam.frame)}`;
    const list = groups.get(key);
    if (list) list.push(seam);
    else groups.set(key, [seam]);
  }
  const rank = (seam: CutSeam) => (items.get(seam.leftId)?.type === 'video' ? 0 : 1) * 1e6 + (order.get(seam.trackId) ?? 0);
  const bands: CutBand[] = [];
  for (const [key, list] of groups) {
    const rep = list.reduce((best, seam) => (rank(seam) < rank(best) ? seam : best));
    const left = items.get(rep.leftId);
    const right = items.get(rep.rightId);
    if (!left || !right) continue;
    const rate = linearRate(left);
    const frames = Math.round((rep.gap / rate) * perSecond);
    const leftLength = rep.frame - itemFrames(left, sequence.fps).start;
    const range = itemFrames(right, sequence.fps);
    const rightLength = range.end - range.start;
    const lo = -Math.floor(leftLength + EPS) + (startsAtSeam.has(left.id) ? 0 : 1);
    const hi = frames + Math.floor(rightLength + EPS) - (endsAtSeam.has(right.id) ? 0 : 1);
    bands.push({
      key,
      assetId: rep.assetId,
      leftId: rep.leftId,
      rightId: rep.rightId,
      trackIds: [...new Set(list.map((seam) => seam.trackId))].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
      frame: rep.frame,
      from: rep.to - rep.gap,
      to: rep.to,
      rate,
      frames,
      lo: Math.min(0, lo),
      hi: Math.max(frames, hi),
    });
  }
  return bands.sort((a, b) => a.frame - b.frame);
}

/** The text being cut: the words with at least half falling within `[from, to)` (media seconds), joined in order; the joining rule is the same as in the transcript. */
export function cutText(words: readonly SpeechWord[], from: number, to: number): string {
  const inside = words
    .filter((word) => Math.min(word.end, to) - Math.max(word.start, from) >= (word.end - word.start) / 2 - EPS)
    .sort((a, b) => a.start - b.start);
  return joinWords(
    inside.map((word) => word.text),
    words.some((word) => /^\s/.test(word.text)),
  );
}

// ---- Dragging the two edges ----

/** Drag coordinates of words mapped to this point (frames after restoring, relative to the cut), sorted by start time. */
export interface WordMark {
  t0: number;
  t1: number;
  word: SpeechWord;
}

/** Media seconds → drag coordinate at this point: left of the cut uses the left instance, right of it uses the right instance, and the removed span is spread proportionally across `[0, frames]`. */
function bandFrame(band: CutBand, seconds: number, perSecond: number): number {
  if (seconds <= band.from) return ((seconds - band.from) / band.rate) * perSecond;
  if (seconds >= band.to) return band.frames + ((seconds - band.to) / band.rate) * perSecond;
  return ((seconds - band.from) / (band.to - band.from)) * band.frames;
}

/** The words in this transcript that can be snapped to (only the stretch reachable from the two edges is kept, plus one extra word on each side as the adjacent word). */
export function bandWordMarks(band: CutBand, words: readonly SpeechWord[], fps: Rate): WordMark[] {
  const perSecond = fps.num / fps.den;
  const marks = words
    .map((word) => ({ t0: bandFrame(band, word.start, perSecond), t1: bandFrame(band, word.end, perSecond), word }))
    .sort((a, b) => a.t0 - b.t0);
  const first = marks.findIndex((mark) => mark.t1 >= band.lo);
  if (first < 0) return [];
  let last = marks.length - 1;
  while (last > first && marks[last]!.t0 > band.hi) last--;
  return marks.slice(Math.max(0, first - 1), Math.min(marks.length, last + 2));
}

/** Start point for “cut from word i”: does not go past the end of the previous word, keeps `pad` frames, rounds outward (earlier) to a frame first, and if that lands back inside the previous word, rounds inward instead (kernel `word_span_start`). */
function spanStart(marks: readonly WordMark[], i: number, pad: number): number {
  const prevEnd = i > 0 ? marks[i - 1]!.t1 : -Infinity;
  const raw = Math.max(prevEnd, marks[i]!.t0 - pad);
  const out = Math.floor(raw + EPS);
  return out < prevEnd - EPS ? Math.ceil(raw - EPS) : out;
}

/** End point for “cut up to word i” (the mirror of `spanStart`, kernel `word_span_end`). */
function spanEnd(marks: readonly WordMark[], i: number, pad: number): number {
  const nextStart = i + 1 < marks.length ? marks[i + 1]!.t0 : Infinity;
  const raw = Math.min(nextStart, marks[i]!.t1 + pad);
  const out = Math.ceil(raw - EPS);
  return out > nextStart + EPS ? Math.floor(raw + EPS) : out;
}

/** Finds the word boundary nearest to `target` within `[lo, hi]`: binary search to locate it, then walks outward on both sides until it goes out of bounds. */
function snapEdge(
  marks: readonly WordMark[],
  edge: 'start' | 'end',
  target: number,
  lo: number,
  hi: number,
  pad: number,
): { at: number; word: SpeechWord } | null {
  const candidate = (i: number) => (edge === 'start' ? spanStart(marks, i, pad) : spanEnd(marks, i, pad));
  const key = (mark: WordMark) => (edge === 'start' ? mark.t0 : mark.t1);
  let a = 0;
  let b = marks.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (key(marks[mid]!) < target) a = mid + 1;
    else b = mid;
  }
  const found: { at: number; word: SpeechWord }[] = [];
  for (let i = a; i < marks.length; i++) {
    const at = candidate(i);
    if (at > hi + EPS) break;
    if (at >= lo - EPS) {
      found.push({ at, word: marks[i]!.word });
      if (at >= target) break;
    }
  }
  for (let i = a - 1; i >= 0; i--) {
    const at = candidate(i);
    if (at < lo - EPS) break;
    if (at <= hi + EPS) {
      found.push({ at, word: marks[i]!.word });
      if (at <= target) break;
    }
  }
  // On a tie, takes the one found first (the one after the target), same as the prototype.
  const best = found.reduce<{ at: number; word: SpeechWord } | null>(
    (pick, next) => (!pick || Math.abs(next.at - target) < Math.abs(pick.at - target) ? next : pick),
    null,
  );
  return best ? { at: Math.min(hi, Math.max(lo, best.at)), word: best.word } : null;
}

/** The new range while dragging (frames after restoring, relative to the cut). `start === end` means it was dragged to zero width: releasing restores it. */
export interface BandDrag {
  edge: 'start' | 'end';
  start: number;
  end: number;
  /** The word snapped to; absent when dropped freely, when there is no word, or when it sits at a limit. */
  word: SpeechWord | null;
  changed: boolean;
}

/**
 * Drags one edge of a cut: `delta` is how many frames (sequence frames) the pointer has moved from where it was pressed. Only the dragged edge moves; the left edge is clamped to `[lo, end]` and the right edge to
 * `[start, hi]`, and anything past the bounds sticks to the limit. Snaps to word boundaries by default, and drops freely when `free` (Alt held); both are aligned to frames. Unchanged if it did not move (a single click does not let the old edge get snapped away).
 */
export function dragBandEdge(band: CutBand, marks: readonly WordMark[], edge: 'start' | 'end', delta: number, free: boolean, fps: Rate): BandDrag {
  if (!Number.isFinite(delta) || delta === 0) return { edge, start: 0, end: band.frames, word: null, changed: false };
  const lo = edge === 'start' ? band.lo : 0;
  const hi = edge === 'start' ? band.frames : band.hi;
  const target = (edge === 'start' ? 0 : band.frames) + delta;
  let at: number;
  let word: SpeechWord | null = null;
  if (target <= lo) at = lo;
  else if (target >= hi) at = hi;
  else {
    const pad = (WORD_PAD / band.rate) * (fps.num / fps.den);
    const snapped = free ? null : snapEdge(marks, edge, target, lo, hi, pad);
    if (snapped) ({ at, word } = snapped);
    else at = Math.min(hi, Math.max(lo, Math.round(target)));
  }
  const start = edge === 'start' ? at : 0;
  const end = edge === 'start' ? band.frames : at;
  return { edge, start, end, word, changed: start !== 0 || end !== band.frames };
}

// ---- One transaction ----

/** A point on the band (frames after restoring, relative to the cut) → media seconds: the inverse of `bandFrame`. */
function bandSource(band: CutBand, at: number, perSecond: number): number {
  if (at <= 0) return band.from + (at / perSecond) * band.rate;
  if (at >= band.frames) return band.to + ((at - band.frames) / perSecond) * band.rate;
  return band.from + (at / band.frames) * (band.to - band.from);
}

/** Seam tolerance in the media: half a frame (media seconds). A cut lands on the instance at the nearest frame, and the edges on either side of the seam differ from the cut's edges by no more than this. */
const seamTolerance = (band: CutBand, perSecond: number) => (band.rate / perSecond) * 0.5 + EPS;

/** Restores this point: puts back the cut covering the seam (`restoreCut`). Refused as is when no cut covers it. */
export function bandRestore(sequence: Sequence, band: CutBand, cuts: readonly TrackedCut[]): RestorePlan {
  const perSecond = sequence.fps.num / sequence.fps.den;
  return restoreOperations(sequence, band.assetId, cuts, [{ from: band.from, to: band.to }], seamTolerance(band, perSecond));
}

export type RetimePlan =
  | {
      ok: true;
      /** First half: restore this point. */
      restore: Extract<RestorePlan, { ok: true }>;
      operations: EditOperation[];
      /** New cut length (frames); 0 means restore only. */
      frames: number;
    }
  | { ok: false; reason: RestoreRefusal };

/**
 * Changes the range of a cut at one point → one transaction: puts back the cut at this point (`restoreCut`), then `addCuts` cuts the media range that corresponds to `[start, end)` (frames relative to the cut).
 * The seam here must be exactly what the cuts removed (the union of the cuts must match both sides of the seam within half a frame); otherwise the drag coordinates would not line up, so it is refused as is (`partial`).
 * Returns null (nothing written) when the range is unchanged.
 */
export function retimeOperations(
  sequence: Sequence,
  assets: Record<Id, AssetRecord>,
  band: CutBand,
  cuts: readonly TrackedCut[],
  range: { start: number; end: number },
): RetimePlan | null {
  if (range.start === 0 && range.end === band.frames) return null;
  const perSecond = sequence.fps.num / sequence.fps.den;
  const restore = bandRestore(sequence, band, cuts);
  if (!restore.ok) return restore;
  const tolerance = seamTolerance(band, perSecond);
  const found = cutsWithin(cuts, [{ from: band.from, to: band.to }], tolerance);
  const covered =
    Math.min(...found.map((c) => c.from)) <= band.from + tolerance && Math.max(...found.map((c) => c.to)) >= band.to - tolerance;
  if (!covered) return { ok: false, reason: 'partial' };
  const start = Math.min(range.start, range.end);
  const end = range.end;
  if (end - start < 1) return { ok: true, restore, operations: restore.operations, frames: 0 };
  const duration = assetDuration(assets, band.assetId);
  const from = Math.max(0, bandSource(band, start, perSecond));
  const to = duration === undefined ? bandSource(band, end, perSecond) : Math.min(duration, bandSource(band, end, perSecond));
  return {
    ok: true,
    restore,
    frames: end - start,
    operations: [
      ...restore.operations,
      { type: 'addCuts', sequenceId: sequence.id, assetId: band.assetId, cuts: [{ from: decimalSeconds(from), to: decimalSeconds(to) }] },
    ],
  };
}

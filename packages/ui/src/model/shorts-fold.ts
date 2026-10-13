import type { EditOperation, Id, Sequence } from '@cuccut/protocol';
import { sentenceEnd } from './speech-cues.ts';
import { itemFrames } from './editor.ts';
import { paragraphText } from './transcript-text.ts';
import {
  assetRate,
  cutsWithin,
  decimalSeconds,
  mediaSpans,
  type MediaSpan,
  type RestorePlan,
  type SourceRange,
  type TrackedCut,
  type TranscriptParagraph,
  type TranscriptWord,
} from './transcript-cut.ts';

/**
 * Words outside the clip in a child video's script (product design §5.10; prototype model-shorts-cut.js `foldRows` / `reclaimSpan`): the child video copies the parent's whole script, and the parts outside the clip were cut away by cut points, so they are struck through in the script. At each end of the clip, `FOLD_NEAR` sentences stay struck through; clicking one restores the branch from that sentence to the clip edge. Further away, they collapse into one cut-seam line “前面 / 后面 X 已剪掉 · 展开”（before / after: X cut away · expand), and one expansion reveals the `FOLD_STEP` sentences nearest the clip. Cut seams are not restored as a whole: restoring the whole seam would turn the branch back into the entire original, so you click the sentence you want back. Only the two ends are handled; cut points the user made in the middle of the clip are drawn as ordinary cut points. The unit is sentences (split by sentence-ending punctuation and paragraphs), not paragraphs: a split paragraph draws only the sentences that are shown.
 */

export const FOLD_NEAR = 3;
export const FOLD_STEP = 10;

/** One sentence: its index range `[from, to)` in `words` (script order), and its start and end on the source clock. */
interface Unit {
  from: number;
  to: number;
  start: number;
  end: number;
}

export type FoldSide = 'before' | 'after';

/** One cut seam: how many sentences are still hidden (`count`), how long it is (source seconds), how many sentences have already been spread out, and how many the next batch spreads. */
export interface ShortsFold {
  side: FoldSide;
  /** The total number of sentences hidden on this side of the clip (not counting the `FOLD_NEAR` sentences always shown at each end). */
  total: number;
  /** The number of sentences still hidden. */
  count: number;
  /** The length of the hidden stretch on the source clock (seconds); when all of it is spread out, the length of the whole stretch. */
  seconds: number;
  /** The number of sentences already spread out (expanded). */
  shown: number;
  /** How many sentences the next batch spreads. */
  next: number;
}

export interface FoldPlan {
  /** Words hidden and not drawn (`TranscriptWord.index`). */
  hidden: ReadonlySet<number>;
  before: ShortsFold | null;
  after: ShortsFold | null;
  /** The positions in `words` of the first and last words still on the timeline. */
  firstKept: number;
  lastKept: number;
  /** The sentence containing each word outside the clip (word position in `words` → sentence). */
  units: Unit[];
  unitOf: Int32Array;
}

/** Splits words into sentences: breaks at paragraph boundaries and at sentence-ending punctuation. */
function sentenceUnits(paragraphs: readonly TranscriptParagraph[], position: ReadonlyMap<number, number>): Unit[] {
  const units: Unit[] = [];
  for (const paragraph of paragraphs) {
    let from = -1;
    for (const word of paragraph.words) {
      const at = position.get(word.index) ?? -1;
      if (at < 0) continue;
      if (from < 0) from = at;
      if (sentenceEnd(word.text.trim())) {
        units.push({ from, to: at + 1, start: 0, end: 0 });
        from = -1;
      }
    }
    const last = paragraph.words.at(-1);
    const lastAt = last ? (position.get(last.index) ?? -1) : -1;
    if (from >= 0 && lastAt >= from) units.push({ from, to: lastAt + 1, start: 0, end: 0 });
  }
  return units;
}

/**
 * Folding outside the clip: `shown` is the number of sentences already spread out on both sides. Returns null when no words are left on the timeline (the whole branch is cut away); then nothing folds, and it is drawn as an ordinary cut.
 * `words` are the script's words (source order, the same set as in `paragraphs`).
 */
export function foldOutside(
  words: readonly TranscriptWord[],
  paragraphs: readonly TranscriptParagraph[],
  shown: { before: number; after: number },
  options: { near?: number; step?: number } = {},
): FoldPlan | null {
  const near = options.near ?? FOLD_NEAR;
  const step = options.step ?? FOLD_STEP;
  let firstKept = -1;
  let lastKept = -1;
  words.forEach((w, i) => {
    if (w.state === 'cut') return;
    if (firstKept < 0) firstKept = i;
    lastKept = i;
  });
  if (firstKept < 0) return null;
  const position = new Map(words.map((w, i) => [w.index, i]));
  const units = sentenceUnits(paragraphs, position);
  for (const unit of units) {
    unit.start = words[unit.from]!.start;
    unit.end = words[unit.to - 1]!.end;
  }
  const unitOf = new Int32Array(words.length).fill(-1);
  units.forEach((unit, n) => {
    for (let i = unit.from; i < unit.to; i++) unitOf[i] = n;
  });
  // Sentences at both ends outside the clip: whole sentences that come before the first kept word / after the last one.
  const head = units.filter((u) => u.to <= firstKept);
  const tail = units.filter((u) => u.from > lastKept);
  const hidden = new Set<number>();
  const side = (run: Unit[], which: FoldSide): ShortsFold | null => {
    // The sentences nearest the clip come first: the part before it is counted backwards.
    const near2far = which === 'before' ? [...run].reverse() : run;
    const far = near2far.slice(near);
    if (!far.length) return null;
    const open = Math.max(0, Math.min(shown[which], far.length));
    const rest = far.slice(open);
    for (const unit of rest) for (let i = unit.from; i < unit.to; i++) hidden.add(words[i]!.index);
    const span = rest.length ? rest : far;
    const lo = Math.min(...span.map((u) => u.start));
    const hi = Math.max(...span.map((u) => u.end));
    return { side: which, total: far.length, count: rest.length, seconds: Math.max(0, hi - lo), shown: open, next: Math.min(step, rest.length) };
  };
  const before = side(head, 'before');
  const after = side(tail, 'after');
  return { hidden, before, after, firstKept, lastKept, units, unitOf };
}

/**
 * The opening sentence of this branch (the “opening” shown on the result-page card of a short video, used when no `hook` is given at derivation): the kept words, from the sentence containing the first word still on the timeline, starting at that word. null when the whole branch has been cut away.
 */
export function openingSentence(words: readonly TranscriptWord[], paragraphs: readonly TranscriptParagraph[]): string | null {
  const plan = foldOutside(words, paragraphs, { before: 0, after: 0 });
  if (!plan) return null;
  const n = plan.unitOf[plan.firstKept] ?? -1;
  const unit = n >= 0 ? plan.units[n] : undefined;
  const text = paragraphText(words.slice(plan.firstKept, unit ? unit.to : plan.firstKept + 1)).text;
  return text || null;
}

/** Paragraphs after removing collapsed words: fully collapsed paragraphs are dropped; split paragraphs keep only the words shown (the paragraph start becomes the first shown word). Returned as-is when no words are collapsed. */
export function visibleParagraphs(paragraphs: readonly TranscriptParagraph[], hidden: ReadonlySet<number>): readonly TranscriptParagraph[] {
  if (!hidden.size) return paragraphs;
  const out: TranscriptParagraph[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.words.some((w) => hidden.has(w.index))) {
      out.push(paragraph);
      continue;
    }
    const words = paragraph.words.filter((w) => !hidden.has(w.index));
    if (!words.length) continue;
    out.push({ ...paragraph, key: words[0]!.id, words });
  }
  return out;
}

/** The source range to restore, and which side of the clip it is on. */
export interface ReclaimRange extends SourceRange {
  side: FoldSide;
}

/**
 * A struck-through word outside the clip was clicked: the source range to restore is, before the clip, `[that sentence's start, first kept word's start)`, and after it, `[last kept word's end, that sentence's end)`.
 * On the clip's side, the restore ultimately follows the cut's edge (`reclaimOperations`), so the clip stays connected and no hole is left. null when the word is not outside either end of the clip (a cut the user made in the middle of the clip).
 * `position` is the word's position in `words`.
 */
export function reclaimRange(words: readonly TranscriptWord[], plan: FoldPlan, position: number): ReclaimRange | null {
  const word = words[position];
  if (!word || word.state !== 'cut') return null;
  const unit = plan.units[plan.unitOf[position] ?? -1];
  if (position < plan.firstKept) {
    const from = unit ? unit.start : word.start;
    const to = words[plan.firstKept]!.start;
    return to > from ? { from, to, side: 'before' } : null;
  }
  if (position > plan.lastKept) {
    const from = words[plan.lastKept]!.end;
    const to = unit ? unit.end : word.end;
    return to > from ? { from, to, side: 'after' } : null;
  }
  return null;
}

/** Remainders shorter than this are not cut back again (sub-frame leftovers). */
const MIN_LEFT = 0.01;
const EPS = 1e-6;

/**
 * Cut points whose instances continue on the clip's side (the same judgement as the engine's `insertions`: the source time and the cut boundary differ by no more than one frame). After the clip, the source end meets the cut's start; before it, the source start meets the cut's end. Cut points where the other side of the same track also has a continuing instance (a cut in the middle of the clip) do not count.
 */
function edgeSpans(sequence: Sequence, assetId: Id, cut: TrackedCut, side: FoldSide): MediaSpan[] {
  const frame = sequence.fps.den / sequence.fps.num;
  const near = (a: number, b: number, rate: number) => Math.abs(a - b) <= frame * rate + EPS;
  const spans = mediaSpans(sequence, assetId);
  const joined = (left: MediaSpan, right: MediaSpan) =>
    left.item.trackId === right.item.trackId &&
    Math.abs(right.start - left.end) <= EPS &&
    near(left.sourceOut, cut.from, left.rate) &&
    near(right.sourceIn, cut.to, right.rate);
  return side === 'after'
    ? spans.filter((s) => near(s.sourceOut, cut.from, s.rate) && !spans.some((r) => joined(s, r)))
    : spans.filter((s) => near(s.sourceIn, cut.to, s.rate) && !spans.some((l) => joined(l, s)));
}

/**
 * After restoration, captions follow to join up (`addCuts` shortens captions that cross a cut when cutting; this is its mirror): caption instances projected through the seam instance, whose edge lies exactly on the seam, are extended across the restored span. The engine, when inserting back, only extends instances that cross the insertion point; those whose edges land exactly on the clip's start or end are pushed (before) or left alone (after), so `trimItem` is added.
 * When no caption instance on a caption track touches the seam, the caption instance on that track nearest the seam that is projected through this instance is extended instead; those that cross the seam are left to the engine.
 * Returns the edges and frames each caption instance should trim. On the after side, the instance is pulled to the clip's end after restoration and before the far end is cut back; right after the far end is cut back, the engine shrinks it together with the clip (`follow_removal` pulls the end back to the cut's start). On the before side, the clip's start does not move after cutting back, so the caption start is pulled back to the clip's start.
 */
function captionTrims(
  sequence: Sequence,
  seam: MediaSpan,
  side: FoldSide,
  frames: number,
): Array<{ itemId: Id; edge: 'start' | 'end'; frame: number }> {
  const at = side === 'after' ? seam.end : seam.start;
  const byTrack = new Map<Id, Array<{ id: Id; start: number; end: number }>>();
  for (const item of sequence.items) {
    if (item.type !== 'caption' || !(item.scopeItemIds ?? []).includes(seam.item.id)) continue;
    const { start, end } = itemFrames(item, sequence.fps);
    const list = byTrack.get(item.trackId) ?? [];
    list.push({ id: item.id, start, end });
    byTrack.set(item.trackId, list);
  }
  const out: Array<{ itemId: Id; edge: 'start' | 'end'; frame: number }> = [];
  const edge = side === 'after' ? 'end' : 'start';
  const target = side === 'after' ? Math.round(at) + frames : Math.round(at);
  for (const captions of byTrack.values()) {
    const touching = captions.filter((c) => Math.abs((side === 'after' ? c.end : c.start) - at) < 0.5);
    if (touching.length) {
      for (const c of touching) out.push({ itemId: c.id, edge, frame: target });
      continue;
    }
    if (captions.some((c) => c.start < at - EPS && c.end > at + EPS)) continue;
    const nearest =
      side === 'after'
        ? captions.filter((c) => c.end <= at).sort((a, b) => b.end - a.end)[0]
        : captions.filter((c) => c.start >= at).sort((a, b) => a.start - b.start)[0];
    if (nearest) out.push({ itemId: nearest.id, edge, frame: target });
  }
  return out;
}

/**
 * Restore the source range `range` → one transaction: the cut points covering it are restored entirely (`restoreCut`), and the far ends of cut points that extend beyond `range` are cut back with `addCuts` (the same as dragging a cut band to change its range, model/cut-bands.ts `retimeOperations`; the engine runs the steps in order, and the later step reads the cut set the earlier step wrote).
 * On the clip's end, nothing is cut back: from the clip edge all the way to the far end of `range`, the pauses in between and the half-words split by cuts come back together, and the restored span joins the original instance, which stays one instance. Captions are extended along (`captionTrims`).
 * If no cut point covers it, it is rejected outright (`untracked`). `seconds` is how many seconds are restored (sequence time).
 */
export function reclaimOperations(
  sequence: Sequence,
  assetId: Id,
  cuts: readonly TrackedCut[],
  range: SourceRange & { side?: FoldSide },
): RestorePlan {
  const found = cutsWithin(cuts, [range]);
  if (!found.length) return { ok: false, reason: 'untracked' };
  const rate = assetRate(sequence, assetId);
  const perSecond = sequence.fps.num / sequence.fps.den;
  const operations: EditOperation[] = found.map((cut) => ({ type: 'restoreCut', sequenceId: sequence.id, assetId, cutId: cut.id }));
  const again: Array<{ from: string; to: string }> = [];
  const tails: EditOperation[] = [];
  const heads: EditOperation[] = [];
  let seconds = 0;
  for (const cut of found) {
    // On the side where the clip meets a cut, do not leave a stretch of cut between the clip edge and `range`.
    const from = range.side === 'after' ? Math.min(range.from, cut.from) : range.from;
    const to = range.side === 'before' ? Math.max(range.to, cut.to) : range.to;
    if (from - cut.from >= MIN_LEFT) again.push({ from: decimalSeconds(cut.from), to: decimalSeconds(from) });
    if (cut.to - to >= MIN_LEFT) again.push({ from: decimalSeconds(to), to: decimalSeconds(cut.to) });
    seconds += Math.max(0, Math.min(cut.to, to) - Math.max(cut.from, from)) / rate;
    if (!range.side) continue;
    for (const seam of edgeSpans(sequence, assetId, cut, range.side)) {
      // Frames the engine restores at the seam (`insertions`: when only one side applies, the source range divided by the rate, rounded down).
      const frames = Math.floor(((range.side === 'after' ? cut.to - seam.sourceOut : seam.sourceIn - cut.from) / seam.rate) * perSecond + EPS);
      if (frames <= 0) continue;
      for (const trim of captionTrims(sequence, seam, range.side, frames)) {
        if ([...tails, ...heads].some((op) => op.type === 'trimItem' && op.itemId === trim.itemId && op.edge === trim.edge)) continue;
        (range.side === 'after' ? tails : heads).push({
          type: 'trimItem',
          sequenceId: sequence.id,
          itemId: trim.itemId,
          edge: trim.edge,
          at: { unit: 'frames', value: trim.frame },
          alignment: 'exact-frame',
        });
      }
    }
  }
  // After side: captions are first pulled to the end after restoration, then pulled back to the clip's end as the far end is cut back; before side: after cutting back, the clip's start does not move, so the caption start is pulled back.
  operations.push(...tails);
  if (again.length) operations.push({ type: 'addCuts', sequenceId: sequence.id, assetId, cuts: again });
  operations.push(...heads);
  return { ok: true, operations, cutIds: found.map((cut) => cut.id), seconds };
}

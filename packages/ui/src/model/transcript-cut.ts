import {
  type AudioItem,
  type CutSetBody,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type Sequence,
  type SequenceItem,
  type VideoItem,
  type AssetRecord,
  itemRangeSeconds,
  mediaTimeToSeconds,
  TRANSCRIPT_PARAGRAPH,
} from '@cuccut/protocol';
import { itemFrames } from './editor.ts';
import {
  CUE_PARAMS,
  joinWords,
  projectSpeech,
  projectableItems,
  sentenceEnd,
  splitUntimed,
  SPEECH_CAPTION_EXTENSION,
  type PlacedWord,
  type SpeechWord,
} from './speech-cues.ts';

/**
 * Transcript: spoken-word transcript laid out by paragraph and word, plus the manual part of text-driven editing (product design §5.7, S03; acceptance AT-08, AT-09).
 *
 * - The transcript lists words in the order of the transcription document (clip order), one entry per word. Whether a word was cut is derived from the timeline (a word that `projectSpeech` cannot map onto the sequence has been cut),
 *   and no separate cut list is stored. When the same clip is used twice on the timeline, one word has two placements: locating jumps to the first, and cutting cuts both.
 * - 「剪辑音画」 (Cut audio and video): the selected words are turned into intervals on the clip clock and compiled into one `addCuts` (video format spec §6.7). The engine records the cuts in the clip's cut set,
 *   ripple-deletes on the track where the instance playing this clip sits, and other instances move according to their own `followPolicy` (§3.16).
 * - 「恢复」 (Restore) is a new transaction, not an undo: it finds the cut covering the selected words (or the seam on the timeline) and compiles `restoreCut`, putting the whole cut back.
 *   Anything not cut by a cut (trimmed by dragging a clip edge, or cut before the cut set existed) is rejected as is.
 * - 「改原文」 (Edit source text): changes the transcript text by word ID (written back to the speech document, creating a new version) without touching the timeline. Deleting only marks the word `hidden`, and every reader skips hidden words.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const EPS = 1e-6;

// ---- Words in the transcript ----

/** A word's state on the timeline: fully present, partly left (a cut falls in the middle of the word), or fully cut. */
export type WordState = 'kept' | 'partial' | 'cut';

export interface TranscriptWord extends SpeechWord {
  /** Order in the transcript (clip order). */
  index: number;
  /** Its placements on the sequence (seconds, in order). */
  placements: PlacedWord[];
  state: WordState;
  /** Whether to put a space before the previous word (the joining rule is the same as `joinWords`). */
  spaced: boolean;
}

/**
 * How much of a word must fall within an instance for it to count as 「全在」 (fully present): cuts are rounded to frames, so being a little off at the word edge does not count as cut. Conversely, what is left on the timeline below `1 - KEPT_SHARE`
 * (a sliver left after cut rounding) counts as fully cut, and that sliver is no longer treated as a placement.
 */
const KEPT_SHARE = 0.9;

/**
 * The transcribed words of a clip (on the clip clock), paired with their placements and states on the sequence. Words are sorted by start time (a stable sort, so words that start at the same time in the transcript keep their original order).
 */
export function transcriptWords(sequence: Sequence, assetId: Id, source: readonly SpeechWord[]): TranscriptWord[] {
  const words = source
    .map((word, n) => ({ word, n }))
    .sort((a, b) => a.word.start - b.word.start || a.n - b.n)
    .map(({ word }) => word);
  const placed = projectSpeech(sequence, assetId, words);
  const rates = new Map<Id, number>();
  for (const item of sequence.items) {
    const map = linear(item);
    if (map) rates.set(item.id, map.rate);
  }
  const byWord = new Map<string, PlacedWord[]>();
  for (const place of placed) {
    const list = byWord.get(place.id);
    if (list) list.push(place);
    else byWord.set(place.id, [place]);
  }
  const leading = words.some((word) => /^\s/.test(word.text));
  return words.map((word, index) => {
    const found = byWord.get(word.id) ?? [];
    // How much of this word each instance covers (clip seconds); take the largest.
    const covered = new Map<Id, number>();
    for (const place of found) {
      covered.set(
        place.scopeItemId,
        (covered.get(place.scopeItemId) ?? 0) + (place.end - place.start) * (rates.get(place.scopeItemId) ?? 1),
      );
    }
    const best = Math.max(0, ...covered.values());
    const length = word.end - word.start;
    const sliver = best <= length * (1 - KEPT_SHARE) + EPS;
    const placements = sliver ? [] : found;
    const state: WordState = sliver ? 'cut' : best >= length * KEPT_SHARE - EPS ? 'kept' : 'partial';
    const prev = words[index - 1];
    const spaced = prev
      ? joinWords([prev.text, word.text], leading).length > joinWords([prev.text], leading).length + joinWords([word.text], leading).length
      : false;
    return { ...word, index, placements, state, spaced };
  });
}

export interface TranscriptParagraph {
  /** First word ID. */
  key: string;
  speaker?: string;
  words: TranscriptWord[];
}

/** Paragraph splitting: breaks at a marked paragraph start, a change of speaker, or a pause of two seconds or more; also breaks at a sentence end once it is long enough (or at a somewhat longer pause that is not too short). Transcript export uses the same rules (`TRANSCRIPT_PARAGRAPH`). */
export const PARAGRAPH = TRANSCRIPT_PARAGRAPH;

/** Groups into paragraphs (transcriptions mostly do not store sentences, `sentences: null`, so it splits by speaker, pauses and end-of-sentence punctuation). Width is estimated by character count and need not be exact. */
export function transcriptParagraphs(words: readonly TranscriptWord[]): TranscriptParagraph[] {
  const paragraphs: TranscriptParagraph[] = [];
  let current: TranscriptWord[] = [];
  let width = 0;
  const flush = () => {
    if (!current.length) return;
    const first = current[0]!;
    paragraphs.push({ key: first.id, ...(first.speaker !== undefined ? { speaker: first.speaker } : {}), words: current });
    current = [];
    width = 0;
  };
  for (const word of words) {
    const prev = current.at(-1);
    if (prev) {
      const gap = word.start - prev.end;
      const ended = sentenceEnd(prev.text.trim());
      if (
        word.paragraphStart ||
        (prev.speaker ?? null) !== (word.speaker ?? null) ||
        gap >= PARAGRAPH.pauseSec ||
        (ended && (width >= PARAGRAPH.maxWidth || (gap >= PARAGRAPH.sentencePauseSec && width >= PARAGRAPH.minWidth)))
      ) {
        flush();
      }
    }
    current.push(word);
    width += [...word.text.trim()].length + (word.spaced ? 1 : 0);
  }
  flush();
  return paragraphs;
}

/** Index of placements sorted by sequence time, used by the playhead to find words. */
export interface PlacementIndex {
  starts: number[];
  ends: number[];
  words: number[];
}

export function placementIndex(words: readonly TranscriptWord[]): PlacementIndex {
  const all = words.flatMap((word) => word.placements.map((place) => ({ start: place.start, end: place.end, index: word.index })));
  all.sort((a, b) => a.start - b.start || a.index - b.index);
  return { starts: all.map((p) => p.start), ends: all.map((p) => p.end), words: all.map((p) => p.index) };
}

/** Which word the playhead is on (word index); none when it is in a pause between words. */
export function wordAt(index: PlacementIndex, seconds: number): number | null {
  let lo = 0;
  let hi = index.starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index.starts[mid]! <= seconds + EPS) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  return seconds < index.ends[found]! - EPS ? index.words[found]! : null;
}

// ---- Playback follow: words already read ----

/**
 * The end (in seconds) of the earliest placement of the word on the sequence; cut words (with no placement) have none. The playhead passing it counts as 「已读」 (read). This is order in sequence time,
 * not clip order: when the same clip is used twice, having played through the first placement counts as read.
 */
export function playedEnd(word: TranscriptWord): number | undefined {
  if (!word.placements.length) return undefined;
  let start = Infinity;
  let end = Infinity;
  for (const place of word.placements) {
    if (place.start < start) {
      start = place.start;
      end = place.end;
    }
  }
  return end;
}

/** Each word's `playedEnd`, sorted ascending, used to find the read cursor. */
export function playedIndex(words: readonly TranscriptWord[]): number[] {
  return words
    .flatMap((word) => {
      const end = playedEnd(word);
      return end === undefined ? [] : [end];
    })
    .sort((a, b) => a - b);
}

/**
 * Read cursor: the largest `playedEnd` that is not later than the playhead (`-Infinity` when no word has been fully read). Words with `playedEnd <= cursor` have been read,
 * which is equivalent to `playedEnd <= playhead`. The cursor changes only when the playhead crosses a word's end, and stays the same while the playhead moves within a word or within a pause, so subscribing to it does not re-render every frame.
 * Tolerance is the same as `wordAt`: being a sliver short of a word's end still counts as played, so one placement can never be both the current word and already read.
 */
export function playedUntil(ends: readonly number[], seconds: number): number {
  let lo = 0;
  let hi = ends.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid]! <= seconds + EPS) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? -Infinity : ends[found]!;
}

/** The minimum and maximum `playedEnd` of the words in a paragraph; null when the whole paragraph is cut (no placements). */
export function paragraphPlayedSpan(words: readonly TranscriptWord[]): [number, number] | null {
  let first = Infinity;
  let last = -Infinity;
  for (const word of words) {
    const end = playedEnd(word);
    if (end === undefined) continue;
    first = Math.min(first, end);
    last = Math.max(last, end);
  }
  return first === Infinity ? null : [first, last];
}

/**
 * The read threshold for a paragraph (`span` is in `paragraphPlayedSpan`): `Infinity` when the whole paragraph has been read, `-Infinity` when no word has been read (both are constants, so the paragraph card
 * does not need to re-render with the cursor), and only a paragraph read halfway uses the cursor itself. Words with `playedEnd <= threshold` have been read. A fully cut paragraph is always `-Infinity`.
 */
export function paragraphPlayed(span: readonly [number, number] | null, until: number): number {
  if (!span || until < span[0]) return -Infinity;
  return until >= span[1] ? Infinity : until;
}

/**
 * The `scrollTop` that centers an element vertically in the scroll container: `elTop` / `elHeight` are its position and height in the container's content coordinates.
 * Clamped to `[0, scrollHeight - clientHeight]`; 0 when the content is shorter than the viewport.
 */
export function centerScrollTop(scrollHeight: number, clientHeight: number, elTop: number, elHeight: number): number {
  const max = Math.max(0, scrollHeight - clientHeight);
  const want = elTop + elHeight / 2 - clientHeight / 2;
  return Math.max(0, Math.min(max, Math.round(want)));
}

// ---- Declared tracks ----

/**
 * The tracks that cutting and restoring must declare (in track order): the tracks where the instances using this clip sit, the tracks where instances linked to them (same `linkGroupId`) sit,
 * and the subtitle track where the subtitles that the effect instances point to sit. Other tracks (background music, supplementary footage, etc.) are left alone.
 */
export function cutTrackIds(sequence: Sequence, assetId: Id): Id[] {
  const instances = projectableItems(sequence, assetId);
  const ids = new Set(instances.map((item) => item.id));
  const groups = new Set(instances.flatMap((item) => (item.linkGroupId ? [item.linkGroupId] : [])));
  const tracks = new Set<Id>();
  for (const item of sequence.items) {
    if (
      ids.has(item.id) ||
      (item.linkGroupId !== undefined && groups.has(item.linkGroupId)) ||
      (item.type === 'caption' && (item.scopeItemIds ?? []).some((id) => ids.has(id)))
    ) {
      tracks.add(item.trackId);
    }
  }
  return sequence.tracks
    .filter((track) => tracks.has(track.id))
    .sort((a, b) => a.order - b.order)
    .map((track) => track.id);
}

// ---- Cut ----

/** A segment on the clip clock (seconds, left-closed and right-open). */
export interface SourceRange {
  from: number;
  to: number;
}

export type CutPlan =
  | {
      ok: true;
      operations: EditOperation[];
      /** The clip intervals cut (seconds), in order. */
      ranges: SourceRange[];
      /** How many frames will be removed from the sequence (estimate: the sum after placements are quantized to frames). */
      frames: number;
      words: number;
    }
  /** `nothing`: the selected words are all already off the timeline; `too-short`: every segment is less than one frame. */
  | { ok: false; reason: 'nothing' | 'too-short' };

/** Seconds written as decimal seconds for `addCuts`: kept to microseconds, trailing zeros removed; not written in exponent form, and negatives treated as 0. */
export function decimalSeconds(value: number): string {
  return Math.max(0, value)
    .toFixed(6)
    .replace(/\.?0+$/, '');
}

/** Duration of the clip's current version (seconds); absent when unknown. A cut cannot extend beyond it. */
export function assetDuration(assets: Record<Id, AssetRecord>, assetId: Id): number | undefined {
  const asset = assets[assetId];
  const duration = asset?.revisions[asset.currentRevision]?.duration;
  return duration ? mediaTimeToSeconds(duration) : undefined;
}

/**
 * Selected words → one `addCuts`. The selected words that are still on the timeline are joined into runs (an unselected word that is already cut in between does not break a run, while an unselected word that is kept does break it),
 * and each run cuts from the start of its first word to the end of its last word in the clip (pauses between words are cut too). A run shorter than one frame after placements are quantized is not cut.
 * When the same clip is used several times on the timeline, the engine cuts at every placement. `selected` holds word indexes.
 */
export function cutOperations(
  sequence: Sequence,
  assets: Record<Id, AssetRecord>,
  assetId: Id,
  words: readonly TranscriptWord[],
  selected: ReadonlySet<number>,
): CutPlan {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const runs: Array<{ range: SourceRange; places: Map<Id, { start: number; end: number }> }> = [];
  let run: (typeof runs)[number] | null = null;
  let count = 0;
  for (const word of words) {
    if (!selected.has(word.index)) {
      if (word.placements.length) run = null;
      continue;
    }
    if (!word.placements.length) continue;
    count++;
    if (!run) {
      run = { range: { from: word.start, to: word.end }, places: new Map() };
      runs.push(run);
    }
    run.range.from = Math.min(run.range.from, word.start);
    run.range.to = Math.max(run.range.to, word.end);
    for (const place of word.placements) {
      const span = run.places.get(place.scopeItemId);
      if (span) {
        span.start = Math.min(span.start, place.start);
        span.end = Math.max(span.end, place.end);
      } else run.places.set(place.scopeItemId, { start: place.start, end: place.end });
    }
  }
  if (!runs.length) return { ok: false, reason: 'nothing' };
  const duration = assetDuration(assets, assetId);
  const ranges: SourceRange[] = [];
  const removed: Array<{ from: number; to: number }> = [];
  for (const { range, places } of runs) {
    const quantized = [...places.values()]
      .map((span) => ({ from: Math.max(0, Math.round(span.start * perSecond - EPS)), to: Math.round(span.end * perSecond - EPS) }))
      .filter((r) => r.to - r.from >= 1);
    if (!quantized.length) continue;
    removed.push(...quantized);
    ranges.push({ from: Math.max(0, range.from), to: duration === undefined ? range.to : Math.min(range.to, duration) });
  }
  if (!ranges.length) return { ok: false, reason: 'too-short' };
  removed.sort((a, b) => a.from - b.from);
  let frames = 0;
  let reach = -Infinity;
  for (const r of removed) {
    const from = Math.max(r.from, reach);
    if (r.to > from) frames += r.to - from;
    reach = Math.max(reach, r.to);
  }
  const operation: EditOperation = {
    type: 'addCuts',
    sequenceId: sequence.id,
    assetId,
    cuts: ranges.map((r) => ({ from: decimalSeconds(r.from), to: decimalSeconds(r.to) })),
  };
  return { ok: true, operations: [operation], ranges, frames, words: count };
}

// ---- Restore ----

type MediaItem = VideoItem | AudioItem;

export interface MediaSpan {
  item: MediaItem;
  /** An interval on the sequence (frames; audio may have fractions). */
  start: number;
  end: number;
  /** Clip clock (seconds). */
  sourceIn: number;
  sourceOut: number;
  rate: number;
}

function linear(item: SequenceItem): { sourceIn: number; rate: number } | null {
  if (item.type !== 'video' && item.type !== 'audio' && item.type !== 'composition') return null;
  if (item.timeMap.kind !== 'linear') return null;
  const rate = item.timeMap.rate.num / item.timeMap.rate.den;
  return rate > 0 ? { sourceIn: mediaTimeToSeconds(item.timeMap.sourceIn), rate } : null;
}

/** The video and audio instances on the timeline that use this clip (linear mapping). */
export function mediaSpans(sequence: Sequence, assetId?: Id): MediaSpan[] {
  const out: MediaSpan[] = [];
  for (const item of sequence.items) {
    if (item.type !== 'video' && item.type !== 'audio') continue;
    if (assetId !== undefined && item.assetRef.id !== assetId) continue;
    const map = linear(item);
    if (!map) continue;
    const { start, end } = itemFrames(item, sequence.fps);
    const seconds = itemRangeSeconds(item, sequence.fps);
    out.push({
      item,
      start,
      end,
      sourceIn: map.sourceIn,
      sourceOut: map.sourceIn + (seconds.end - seconds.start) * map.rate,
      rate: map.rate,
    });
  }
  return out;
}

/** One cut in the cut set (clip seconds). */
export interface TrackedCut {
  id: Id;
  from: number;
  to: number;
  ref?: Id;
}

/** The clip's cut-set document (at most one; same engine, and when there are several, the one with the smallest ID is used). */
export function cutSetRecord(documents: Record<Id, DocumentRecord>, assetId: Id): DocumentRecord | undefined {
  let found: DocumentRecord | undefined;
  for (const record of Object.values(documents)) {
    if (record.kind !== 'cut-set' || record.sourceAssetId !== assetId) continue;
    if (!found || record.id < found.id) found = record;
  }
  return found;
}

/** Body of a cut set → cuts (clip seconds, in order). Returns null when it is not `cuccut.cut-set/1`. */
export function readCutSet(body: unknown): TrackedCut[] | null {
  if (!isObject(body) || body.schema !== 'cuccut.cut-set/1' || !Array.isArray(body.cuts)) return null;
  const { timescale, cuts } = body as unknown as CutSetBody;
  if (!(timescale > 0)) return null;
  return cuts
    .map((cut) => ({
      id: cut.id,
      from: Number(cut.t0) / timescale,
      to: Number(cut.t1) / timescale,
      ...(cut.ref !== undefined ? { ref: cut.ref } : {}),
    }))
    .filter((cut) => Number.isFinite(cut.from) && Number.isFinite(cut.to))
    .sort((a, b) => a.from - b.from);
}

/** A cut outside the cut set: `untracked`, meaning no cut covers the content to be restored (trimmed by dragging a clip edge, or cut before the cut set existed). */
export type RestoreRefusal = 'untracked' | 'partial';

export type RestorePlan =
  | {
      ok: true;
      operations: EditOperation[];
      /** A cut being put back. */
      cutIds: Id[];
      /** How many seconds are put back (sequence time, converted by the clip's speed). */
      seconds: number;
    }
  | { ok: false; reason: RestoreRefusal };

/** The clip's speed on the timeline (clip seconds / sequence seconds): taken from the first instance that uses it; 1 when there is none. */
export function assetRate(sequence: Sequence, assetId: Id): number {
  return mediaSpans(sequence, assetId)[0]?.rate ?? 1;
}

/** Cuts that intersect these clip intervals (tolerance `tolerance` seconds). */
export function cutsWithin(cuts: readonly TrackedCut[], ranges: readonly SourceRange[], tolerance = EPS): TrackedCut[] {
  return cuts.filter((cut) => ranges.some((range) => cut.from < range.to - tolerance && cut.to > range.from + tolerance));
}

/**
 * Cuts covering these clip intervals → `restoreCut` entries in one transaction (one per cut, the whole cut put back). When no cut covers them, it is rejected as is (`untracked`).
 */
export function restoreOperations(
  sequence: Sequence,
  assetId: Id,
  cuts: readonly TrackedCut[],
  ranges: readonly SourceRange[],
  tolerance = EPS,
): RestorePlan {
  const found = cutsWithin(cuts, ranges, tolerance);
  if (!found.length) return { ok: false, reason: 'untracked' };
  const rate = assetRate(sequence, assetId);
  return {
    ok: true,
    operations: found.map((cut) => ({ type: 'restoreCut', sequenceId: sequence.id, assetId, cutId: cut.id })),
    cutIds: found.map((cut) => cut.id),
    seconds: found.reduce((sum, cut) => sum + (cut.to - cut.from) / rate, 0),
  };
}

/** Selected transcript words that are not fully on the timeline → clip intervals to restore (one per word). */
export function restoreRanges(words: readonly TranscriptWord[], selected: ReadonlySet<number>): SourceRange[] {
  return words.filter((w) => selected.has(w.index) && w.state !== 'kept').map((w) => ({ from: w.start, to: w.end }));
}

// ---- Cuts on the timeline ----

/** Between two instances on the same track that are back to back, use the same clip, and have a gap in the middle of the clip: a place that was cut. */
export interface CutSeam {
  key: string;
  trackId: Id;
  assetId: Id;
  leftId: Id;
  rightId: Id;
  /** The cut's position on the sequence (frames; audio may have fractions). */
  frame: number;
  /** How much clip was cut (seconds, clip clock). */
  gap: number;
  /** The clip time to reveal on restore (the right instance's in-point). */
  to: number;
}

/** A cut on the timeline: two adjacent instances on the same track that are back to back (within one millionth of a frame), of the same kind, the same clip, the same speed, with at least one frame of the clip skipped. */
export function cutSeams(sequence: Sequence): CutSeam[] {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const byTrack = new Map<Id, MediaSpan[]>();
  for (const span of mediaSpans(sequence)) {
    const list = byTrack.get(span.item.trackId);
    if (list) list.push(span);
    else byTrack.set(span.item.trackId, [span]);
  }
  const seams: CutSeam[] = [];
  for (const [trackId, spans] of byTrack) {
    spans.sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) {
      const left = spans[i - 1]!;
      const right = spans[i]!;
      if (left.item.type !== right.item.type || left.item.assetRef.id !== right.item.assetRef.id) continue;
      if (Math.abs(right.start - left.end) > EPS || Math.abs(right.rate - left.rate) > EPS) continue;
      const gap = right.sourceIn - left.sourceOut;
      if (Math.round((gap / left.rate) * perSecond) < 1) continue;
      seams.push({
        key: `${left.item.id}|${right.item.id}`,
        trackId,
        assetId: left.item.assetRef.id,
        leftId: left.item.id,
        rightId: right.item.id,
        frame: left.end,
        gap,
        to: right.sourceIn,
      });
    }
  }
  return seams;
}

// ---- Edit source text ----

/** A piece of an untimed segment that was split (`w-000007~3`) → the ID of the word it originally was in the transcript. */
export function rawWordId(id: string): string {
  return id.replace(/~\d+$/, '');
}

const pieceNumber = (id: string): number => Number(/~(\d+)$/.exec(id)?.[1] ?? '1');

/** Judged the same way as `readSpeechWords`: a whole segment with no word timing, or a word with whitespace inside its text, is split into several pieces when read. */
function untimed(word: Json): boolean {
  const value = typeof word.text === 'string' ? word.text : '';
  return word.timingQuality === 'missing' || /\S\s+\S/.test(value.trim());
}

/** The positions in the original text of the pieces split from an untimed segment (character indexes, left-closed and right-open). When it cannot be split, there is only one piece, covering the whole segment (surrounding whitespace removed). */
function pieceSpans(value: string): Array<[number, number]> {
  const pieces = splitUntimed(value, 0, 1, CUE_PARAMS.maxChars);
  const spans: Array<[number, number]> = [];
  let cursor = 0;
  for (const piece of pieces) {
    const needle = piece.text.trim();
    const at = value.indexOf(needle, cursor);
    if (at < 0) return [[value.length - value.trimStart().length, value.trimEnd().length]];
    spans.push([at, at + needle.length]);
    cursor = at + needle.length;
  }
  return spans;
}

/** Replaces `[from, to)` in `value` with `text`; when replaced with empty, it also consumes whitespace on one side, so two spaces are not left behind. */
function splice(value: string, [from, to]: [number, number], text: string): string {
  if (text) return value.slice(0, from) + text + value.slice(to);
  let a = from;
  let b = to;
  if (a > 0 && /\s/.test(value[a - 1]!)) a--;
  else if (b < value.length && /\s/.test(value[b]!)) b++;
  return value.slice(0, a) + value.slice(b);
}

function speechWords(body: unknown): { body: Json; words: Json[]; index: Map<string, number> } | null {
  if (!isObject(body) || body.schema !== 'cuccut.speech/1' || !Array.isArray(body.words)) return null;
  const words = body.words.map((word) => (isObject(word) ? { ...word } : word)) as Json[];
  const index = new Map<string, number>();
  words.forEach((word, i) => {
    if (isObject(word) && typeof word.id === 'string') index.set(word.id, i);
  });
  return { body, words, index };
}

/**
 * Changes the text of one word (`id` is the word ID in the transcript; it can be one piece of a split word). A timed word keeps its original leading whitespace; for a split piece, only that piece's span in the original text is replaced.
 * Changing it to empty is the same as deleting it (see `hideWords`). Returns null when it is not the transcript body, the word is not found, or nothing changed.
 */
export function editWordText(body: unknown, id: string, text: string): Json | null {
  const next = text.trim();
  if (!next) return hideWords(body, [id]);
  const doc = speechWords(body);
  const at = doc?.index.get(rawWordId(id));
  if (!doc || at === undefined) return null;
  const word = doc.words[at]!;
  const old = typeof word.text === 'string' ? word.text : '';
  let value: string;
  if (untimed(word)) {
    const span = pieceSpans(old)[pieceNumber(id) - 1];
    if (!span) return null;
    value = splice(old, span, next);
  } else {
    value = (/^\s*/.exec(old)?.[0] ?? '') + next;
  }
  if (value === old) return null;
  doc.words[at] = { ...word, text: value };
  return { ...doc.body, words: doc.words };
}

/**
 * Deletes the text of some words (timeline untouched): timed words are marked `hidden: true`; for split untimed segments, only the selected pieces are deleted, and the segment is marked hidden only when all of it is deleted.
 * Returns null when it is not the transcript body or nothing changed.
 */
export function hideWords(body: unknown, ids: readonly string[]): Json | null {
  const doc = speechWords(body);
  if (!doc) return null;
  const byRaw = new Map<string, Set<number>>();
  for (const id of ids) {
    const raw = rawWordId(id);
    const set = byRaw.get(raw) ?? new Set<number>();
    set.add(pieceNumber(id));
    byRaw.set(raw, set);
  }
  let changed = false;
  for (const [raw, pieces] of byRaw) {
    const at = doc.index.get(raw);
    if (at === undefined) continue;
    const word = doc.words[at]!;
    if (word.hidden === true) continue;
    const old = typeof word.text === 'string' ? word.text : '';
    const spans = untimed(word) ? pieceSpans(old) : [];
    if (spans.length > 1 && [...pieces].some((n) => n <= spans.length) && spans.some((_, n) => !pieces.has(n + 1))) {
      let value = old;
      for (let n = spans.length; n >= 1; n--) if (pieces.has(n)) value = splice(value, spans[n - 1]!, '');
      doc.words[at] = { ...word, text: value };
    } else {
      doc.words[at] = { ...word, hidden: true };
    }
    changed = true;
  }
  return changed ? { ...doc.body, words: doc.words } : null;
}

/**
 * Subtitles generated from this transcript where the transcript version used at generation is not the current one (only those used by subtitle instances on the timeline are considered): after the source text is edited they are stale,
 * and they are not regenerated automatically.
 */
export function staleCaptions(sequence: Sequence, documents: Record<Id, DocumentRecord>, speech: DocumentRecord): DocumentRecord[] {
  const used = new Set(sequence.items.flatMap((item) => (item.type === 'caption' ? [item.documentId] : [])));
  return [...used].flatMap((id) => {
    const record = documents[id];
    const source = record?.extensions?.[SPEECH_CAPTION_EXTENSION];
    if (!record || record.kind !== 'caption' || !isObject(source) || source.speechDocumentId !== speech.id) return [];
    return source.speechRevision === speech.currentRevision ? [] : [record];
  });
}

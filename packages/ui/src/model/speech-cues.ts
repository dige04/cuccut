import {
  EXPORT_MAX_CUE_SECONDS,
  itemRangeSeconds,
  mediaTimeToSeconds,
  type EditOperation,
  type Id,
  type Sequence,
  type SequenceItem,
} from '@cuccut/protocol';
import { CAPTION_SCHEMA } from './cue-edit.ts';
import { trackFree } from './editor-ops.ts';

/**
 * Transcript (`cuccut.speech/1`) → subtitles (`cuccut.caption/1`): on the material clock, the word list is greedily cut into subtitle cues, which are projected onto the sequence through effect instances.
 *
 * Source (modified):
 * - The greedy cutting ladder is ported from the old `cuccut-app/core/crates/ccut-flow-core/src/cue.rs` (`derive_cues` and `auto_break`, spec §18.5), together with `sentence_end` / `clause_end_char` and the abbreviation table in the same directory's `atomize.rs`. Only the greedy derivation is ported;
 *   the DP layout in `layout.rs` and the manual break / nobreak pins are not ported (the new format has no such tables).
 * - Display width, word joining, and sentence membership are changed to match `packages/runtime-core/src/exports/text-export.ts`
 *   (`displayWidth` / `joinWords` / `segmentsOf`), so that generated subtitles and exported subtitles are not cut differently.
 *   Line width is the display width of the joined text (full-width characters count as 2), no longer cue.rs's per-word accumulation;
 *   the remote's sentence-splitting conditions (segment start; sentence changed when sentences are stored; pause over 1 second or sentence-end punctuation when no sentences are stored) are always enforced as breaks here,
 *   so a subtitle cue's boundaries are a superset of the export's sentence boundaries, and a cue never spans two sentences. Sentences are also split when the remote's effect instance changes: subtitles are cut on the material clock, and when a cut point falls in the middle of a cue, each side shows the trimmed part of that cue.
 *   Word joining has one difference: Korean words still get spaces between them (text-export.ts counts Hangul as full-width, so words would stick together).
 * - The rule for projecting words from the material clock to the sequence clock (`projectSpeech`, used for transcript positioning and “is it on the timeline”) follows the `asset-items` projection in `crates/render-graph/src/text_plan.rs`:
 *   instances that use this asset are sorted by start, each occupies only the ranges not taken by others, and mapping is `itemStart + (src − sourceIn) / rate`, clipped to the range;
 *   instances whose freeze or speed is not positive are skipped.
 * - Segments with no word times (`timingQuality: 'missing'`: the whole segment is written as one word, see speech-document.ts in packages/jobs; or in old documents, words with whitespace in the middle of their text) are first split at whitespace, sentence ends, and clause punctuation, and overly wide pieces are cut by width; times are linearly interpolated within the segment by display width, so that a whole block of tens of seconds does not become one cue.
 *
 * Architecture deviation:
 * - This should live in `crates/speech-doc` (Rust, shared with export); for now it sits in the UI's model layer, and the result is written with one transaction.
 *
 * The written caption document is on the material clock (`clock: 'source-asset'`). The caption instance's `scopeItemIds` are the instances on the timeline that use this asset: when the media clip is later moved, trimmed, split, or deleted, the subtitles follow it (the engine adds the right half to the effect instance on split, and removes it on delete).
 */

type Json = Record<string, unknown>;

/** cue.rs's canonical default parameters (§18.5); widths are counted in display width. */
export const CUE_PARAMS = {
  maxChars: 42,
  pauseSec: 0.6,
  /** The shortest line width at which a clause punctuation mark (comma class) may break the line. */
  minClauseChars: 12,
  minPauseChars: 20,
  /** The shortest line width at which a dash may break the line; lower than the comma threshold. */
  minDashChars: 6,
  overflowSlack: 8,
} as const;

export type CueParams = { [K in keyof typeof CUE_PARAMS]: number };

/** The pause (seconds) that splits sentences in the remote export: for a transcript with no stored sentences, a pause between words longer than this splits the sentence. */
const PAUSE_SECONDS = 1;

// ---- Character rules (same as text-export.ts, except for the spacing of Hangul) ----

const SENTENCE_END = /[.!?\u{3002}\u{ff01}\u{ff1f}\u{2026}]["'\u{201d}\u{2019}\u{ff09})\]]*$/u;
const NO_SPACE_BEFORE =
  /^[,.!?;:%)\]}'\u{2019}\u{201d}\u{2026}\u{ff0c}\u{3002}\u{ff01}\u{ff1f}\u{ff1b}\u{ff1a}\u{3001}\u{ff09}\u{300d}\u{300f}\u{3011}\u{300b}]/u;
const WIDE =
  /[\u{1100}-\u{115f}\u{2e80}-\u{303e}\u{3041}-\u{33ff}\u{3400}-\u{4dbf}\u{4e00}-\u{9fff}\u{a000}-\u{a4cf}\u{ac00}-\u{d7a3}\u{f900}-\u{faff}\u{fe30}-\u{fe4f}\u{ff00}-\u{ff60}\u{ffe0}-\u{ffe6}\u{20000}-\u{3fffd}]/u;
/** Hangul: full-width in display, but words are separated by spaces. */
const HANGUL = /[\u{1100}-\u{11ff}\u{3130}-\u{318f}\u{a960}-\u{a97f}\u{ac00}-\u{d7a3}\u{d7b0}-\u{d7ff}]/u;

/** Display width: full-width characters count as 2. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}

/** Whether two words need a space between them: needed between Western and Hangul words; not needed next to Chinese characters, kana, or full-width symbols. */
const spaced = (char: string) => !WIDE.test(char) || HANGUL.test(char);

/** Joins words into text: words that already carry a leading space (a habit of some recognizers) are kept as they are; otherwise a space is added between Western and Hangul words, and none is added before Chinese characters, kana, or punctuation. */
export function joinWords(tokens: readonly string[], leadingSpaces: boolean): string {
  if (leadingSpaces) return tokens.join('').replace(/\s+/g, ' ').trim();
  let out = '';
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    if (!out) {
      out = token;
      continue;
    }
    const prev = [...out].at(-1)!;
    const next = [...token][0]!;
    const space = spaced(prev) && spaced(next) && !NO_SPACE_BEFORE.test(token);
    out += space ? ` ${token}` : token;
  }
  return out;
}

// ---- Punctuation (cue.rs / atomize.rs) ----

// i18n-ignore-start: punctuation for sentence breaking (following cue.rs / atomize.rs); this is language processing, not display copy
const CLOSERS = new Set(['”', '"', '’', "'", '」', '』', '）', ')', ']', '》']);
const TERMINAL = new Set(['。', '．', '.', '？', '?', '！', '!', '…']);
const CLAUSE_END = new Set([',', ';', ':', '—', '–', '，', '；', '：', '、']);
// i18n-ignore-end
/** Table of lowercase stem abbreviations: the period in `Dr.` does not end a sentence. */
const SENTENCE_ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'sr', 'jr', 'rev', 'hon', 'fr', 'gen', 'gov', 'sen',
  'rep', 'col', 'lt', 'sgt', 'capt', 'vs', 'etc', 'inc', 'ltd', 'corp', 'dept', 'vol', 'fig',
]);

/** Sentence end (atomize.rs `sentence_end`): skips at most one closing quote or bracket, then checks for a terminal punctuation mark; a `.` does not count when its stem contains another `.` or the stem is an abbreviation. */
export function sentenceEnd(token: string): boolean {
  const chars = [...token];
  let index = chars.length;
  if (index > 0 && CLOSERS.has(chars[index - 1]!)) index--;
  if (index === 0) return false;
  const last = chars[index - 1]!;
  if (!TERMINAL.has(last)) return false;
  if (last === '.') {
    const stem = chars.slice(0, index - 1).join('');
    if (stem.includes('.')) return false; // 2.14 / a.com / U.S.
    const bare = stem.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase();
    if (SENTENCE_ABBREV.has(bare)) return false;
  }
  return true;
}

/** Clause punctuation (atomize.rs `clause_end_char`): skips at most one closing quote or bracket, then the trailing punctuation mark; returns null when there is none. */
export function clauseEndChar(token: string): string | null {
  const chars = [...token];
  let index = chars.length;
  if (index > 0 && CLOSERS.has(chars[index - 1]!)) index--;
  if (index === 0) return null;
  const last = chars[index - 1]!;
  return CLAUSE_END.has(last) ? last : null;
}

// ---- Reading the transcript ----

/** One word in the transcript (material clock, seconds). */
export interface SpeechWord {
  id: string;
  start: number;
  end: number;
  /** Kept as is (not trimmed): some recognizers use a leading space to mean the whitespace between words. */
  text: string;
  /** Speaker ID. */
  speaker?: string;
  sentenceId?: string;
  /** This sentence is marked as a segment start, and this is the first member of the sentence. */
  paragraphStart: boolean;
}

export interface SpeechWords {
  words: SpeechWord[];
  /** Speaker ID → display name. */
  speakers: Map<string, string>;
}

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * Reads the words of `cuccut.speech/1` (following `speech_entries` in text_plan.rs): skips hidden, blank, and non-positive-duration words;
 * sentences are recognized in both the `wordIds` and the `first` / `last` forms; when `sentences` is null there are no sentences. Returns null when it is not transcript content.
 * A segment with no word times is split by `splitUntimed`.
 */
export function readSpeechWords(body: unknown, params: CueParams = CUE_PARAMS): SpeechWords | null {
  if (!isObject(body) || body.schema !== 'cuccut.speech/1' || !Array.isArray(body.words)) return null;
  const scale = finite(body.timescale) || 1_000_000;
  const raw = body.words.filter(isObject);
  const index = new Map<string, number>();
  raw.forEach((word, i) => {
    const id = text(word.id);
    if (id !== undefined) index.set(id, i);
  });
  const sentenceOf: Array<{ id: string; paragraph: boolean } | undefined> = [];
  for (const sentence of Array.isArray(body.sentences) ? body.sentences.filter(isObject) : []) {
    const id = text(sentence.id);
    if (id === undefined) continue;
    const paragraph = sentence.paragraphStart === true;
    let members: number[] = [];
    if (Array.isArray(sentence.wordIds)) {
      members = sentence.wordIds.flatMap((wordId) => {
        const at = typeof wordId === 'string' ? index.get(wordId) : undefined;
        return at === undefined ? [] : [at];
      });
    } else {
      const first = index.get(text(sentence.first) ?? '');
      const last = index.get(text(sentence.last) ?? '');
      if (first !== undefined && last !== undefined && first <= last) members = Array.from({ length: last - first + 1 }, (_, n) => first + n);
    }
    members.forEach((at, n) => (sentenceOf[at] = { id, paragraph: paragraph && n === 0 }));
  }
  const words: SpeechWord[] = [];
  const leading = raw.some((word) => /^\s/.test(text(word.text) ?? ''));
  // When there is no word before a zero-duration word, its text is kept and attached to the front of the next word.
  let carried = '';
  raw.forEach((word, i) => {
    if (word.hidden === true) return;
    const value = text(word.text) ?? '';
    if (!value.trim()) return;
    const start = finite(word.start);
    let end = finite(word.end);
    if (start === null || end === null) return;
    if (end <= start) {
      // Zero-duration words (where the transcript's word times collapsed to a point) are not dropped: if there is a gap after them, they take a small piece of it; if not, their text is merged into the adjacent word.
      end = slotAfter(raw, i, start, scale);
      if (end === null) {
        const previous = words.at(-1);
        if (previous) previous.text = joinWords([previous.text, value], leading);
        else carried = carried ? joinWords([carried, value], leading) : value;
        return;
      }
    }
    const speaker = text(word.speaker);
    const sentence = sentenceOf[i];
    const id = text(word.id) ?? '';
    const untimed = word.timingQuality === 'missing' || /\S\s+\S/.test(value.trim());
    const pieces = untimed ? splitUntimed(value, start / scale, end / scale, params.maxChars) : [{ text: value, start: start / scale, end: end / scale }];
    pieces.forEach((piece, n) =>
      words.push({
        id: n === 0 ? id : `${id}~${n + 1}`,
        start: piece.start,
        end: piece.end,
        text: n === 0 && carried ? joinWords([carried, piece.text], leading) : piece.text,
        ...(speaker !== undefined ? { speaker } : {}),
        ...(sentence ? { sentenceId: sentence.id } : {}),
        paragraphStart: n === 0 && (sentence?.paragraph ?? false),
      }),
    );
    carried = '';
  });
  if (carried && words.length) words[words.length - 1]!.text = joinWords([words[words.length - 1]!.text, carried], leading);
  const speakers = new Map<string, string>();
  for (const speaker of Array.isArray(body.speakers) ? body.speakers.filter(isObject) : []) {
    const id = text(speaker.id);
    if (id !== undefined) speakers.set(id, text(speaker.name)?.trim() || id);
  }
  return { words, speakers };
}

/** The nominal duration (seconds) taken by a zero-duration word: one time cell of the aligner. */
const NOMINAL_WORD_SECONDS = 0.08;

/**
 * A zero-duration word takes a small piece of the gap after it (in ticks): up to the start of the next word that has a time (hidden words count too, since their time still exists), at most one nominal duration;
 * when no word follows, a nominal duration is added directly; the next word starts right here (no gap), so it returns null.
 */
function slotAfter(raw: readonly Json[], index: number, start: number, scale: number): number | null {
  for (let n = index + 1; n < raw.length; n++) {
    const next = finite(raw[n]!.start);
    if (next === null) continue;
    return next > start ? Math.min(next, start + NOMINAL_WORD_SECONDS * scale) : null;
  }
  return start + NOMINAL_WORD_SECONDS * scale;
}

const BREAK_AFTER = new Set([...TERMINAL, ...CLAUSE_END]);

/**
 * A segment with no word times is split into several pieces: break at whitespace, at sentence ends, and after clause punctuation (together with the closing quote or bracket that follows); pieces wider than `maxChars` are cut again by width;
 * times are split linearly across [start, end] in proportion to each piece's display width. When it cannot be split, it stays as one piece.
 */
export function splitUntimed(value: string, start: number, end: number, maxChars: number): Array<{ text: string; start: number; end: number }> {
  const chunks: string[] = [];
  let current = '';
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };
  const chars = [...value];
  chars.forEach((char, i) => {
    if (/\s/.test(char)) return push();
    current += char;
    // Punctuation directly followed by a character (Chinese and Japanese do not use spaces): break only when next to a full-width character; `2.14`, `3:30`, and `1,000` do not break.
    const next = chars[i + 1];
    if (next === undefined || /\s/.test(next) || CLOSERS.has(next)) return;
    if (!BREAK_AFTER.has(char) && !CLOSERS.has(char)) return;
    if ((WIDE.test(char) || WIDE.test(next)) && sentenceOrClause(current)) push();
  });
  push();
  const pieces = chunks.flatMap((chunk) => chopWide(chunk, maxChars));
  if (pieces.length <= 1) return [{ text: value, start, end }];
  const widths = pieces.map((piece) => Math.max(1, displayWidth(piece)));
  const total = widths.reduce((sum, width) => sum + width, 0);
  let at = 0;
  return pieces.map((piece, n) => {
    const from = start + ((end - start) * at) / total;
    at += widths[n]!;
    return { text: piece, start: from, end: n === pieces.length - 1 ? end : start + ((end - start) * at) / total };
  });
}

/** This piece ends at a sentence end or a clause punctuation mark (`Dr.`, `2.14`-type cases do not count). */
function sentenceOrClause(chunk: string): boolean {
  return sentenceEnd(chunk) || clauseEndChar(chunk) !== null;
}

/** A piece wider than `maxChars` is cut by display width into roughly equal pieces. */
function chopWide(chunk: string, maxChars: number): string[] {
  const width = displayWidth(chunk);
  if (width <= maxChars) return [chunk];
  const parts = Math.ceil(width / maxChars);
  const target = width / parts;
  const out: string[] = [];
  let current = '';
  let used = 0;
  for (const char of chunk) {
    const w = displayWidth(char);
    if (current && used + w > target * (out.length + 1) + 1e-9 && out.length < parts - 1) {
      out.push(current);
      current = '';
    }
    current += char;
    used += w;
  }
  if (current) out.push(current);
  return out;
}

// ---- Projecting onto the sequence ----

/** One word projected onto the sequence (seconds). The same word appearing twice through two instances has two different `key`s. */
export interface PlacedWord extends SpeechWord {
  key: string;
  scopeItemId: Id;
}

/** The asset an instance uses: video and audio material, or a composition's pre-rendered stand-in (a code package when there is none). Same as `source_asset` in text_plan.rs. */
function sourceAsset(item: SequenceItem): Id | undefined {
  if (item.type === 'video' || item.type === 'audio') return item.assetRef.id;
  if (item.type === 'composition') return (item.prerender ?? (item.source.kind === 'bundle' ? item.source.assetRef : undefined))?.id;
  return undefined;
}

function linearMap(item: SequenceItem): { sourceIn: number; rate: number } | null {
  if (item.type !== 'video' && item.type !== 'audio' && item.type !== 'composition') return null;
  if (item.timeMap.kind !== 'linear') return null;
  const rate = item.timeMap.rate.num / item.timeMap.rate.den;
  if (!(rate > 0)) return null;
  return { sourceIn: mediaTimeToSeconds(item.timeMap.sourceIn), rate };
}

/** What remains of `interval` after subtracting the intervals in `taken`, in order. Subtracts pair by pair; used only when an endpoint is NaN (see `TakenIntervals`). */
function subtractPairwise(interval: [number, number], taken: ReadonlyArray<[number, number]>): Array<[number, number]> {
  let parts = [interval];
  for (const [a, b] of taken) {
    const next: Array<[number, number]> = [];
    for (const [x, y] of parts) {
      if (b <= x || a >= y) {
        next.push([x, y]);
        continue;
      }
      if (a > x) next.push([x, a]);
      if (b < y) next.push([b, y]);
    }
    parts = next;
  }
  return parts;
}

/**
 * The intervals already taken by earlier instances. With thousands of instances, subtracting pair by pair is quadratic (half the time of entering the transcript tab), so here they are recorded as a union sorted by start, with no two touching (the end of one segment
 * is strictly less than the start of the next), and both subtraction and union use binary search. The pieces produced are the same as pair-by-pair subtraction: the segments of `[start, end]` minus these open intervals that have non-zero length, in order,
 * with endpoints taken from the same numbers (comparisons all use strict `<` and `>`, so equal numbers keep the one that came in first, and ±0 too). When an endpoint is NaN (`itemRangeSeconds` is derived by dividing a ticks string by the frame rate, so bad data can produce NaN, and `end <= start` does not catch it),
 * every comparison is false and the union does not hold, so from then on it falls back to pair-by-pair subtraction; `raw` keeps all the intervals. The export is there only so tests can compare it against pair-by-pair subtraction (also when candidates are not sorted by start).
 */
export class TakenIntervals {
  readonly #merged: Array<[number, number]> = [];
  readonly #raw: Array<[number, number]> = [];
  #poisoned = false;

  subtract(start: number, end: number): Array<[number, number]> {
    if (this.#poisoned || Number.isNaN(start) || Number.isNaN(end)) return subtractPairwise([start, end], this.#raw);
    const merged = this.#merged;
    const parts: Array<[number, number]> = [];
    let cur = start;
    for (let i = partition(merged, ([, b]) => b <= start); i < merged.length && merged[i]![0] < end; i++) {
      const [a, b] = merged[i]!;
      if (a > cur) parts.push([cur, a]);
      if (b > cur) cur = b;
    }
    if (cur < end) parts.push([cur, end]);
    return parts;
  }

  add(start: number, end: number): void {
    this.#raw.push([start, end]);
    if (this.#poisoned) return;
    if (Number.isNaN(start) || Number.isNaN(end)) {
      this.#poisoned = true;
      return;
    }
    const merged = this.#merged;
    // Those that overlap or touch it are [first, last).
    const first = partition(merged, ([, b]) => b < start);
    const last = partition(merged, ([a]) => a <= end);
    let lo = start;
    let hi = end;
    if (first < last) {
      const [a] = merged[first]!;
      const [, b] = merged[last - 1]!;
      if (last - first === 1 && a <= start && b >= end) return;
      if (a <= lo) lo = a;
      if (b >= hi) hi = b;
    }
    merged.splice(first, last - first, [lo, hi]);
  }
}

/**
 * The indices of the words sorted by start time, and the longest word length: thousands of instances × tens of thousands of words, projected pair by pair, take hundreds of milliseconds (when entering translation or transcript), so each instance tries only the words whose
 * start time may fall in its window (see `wordsAround`). A word whose time is not a number (NaN) always compares false; with the original pair-by-pair approach it was tried one by one, and here every instance still tries it.
 */
interface WordOrder {
  order: number[];
  longest: number;
  loose: number[];
}

function orderWords(words: readonly SpeechWord[]): WordOrder {
  const order: number[] = [];
  const loose: number[] = [];
  let longest = 0;
  words.forEach((word, index) => {
    if (Number.isNaN(word.start) || Number.isNaN(word.end)) {
      loose.push(index);
      return;
    }
    order.push(index);
    const length = word.end - word.start;
    if (!(length <= longest)) longest = length;
  });
  order.sort((x, y) => words[x]!.start - words[y]!.start);
  return { order, longest, loose };
}

/** Candidates near `[lo, hi)` on the source clock (indices in their original order): these are only candidates, widened a little so rounding does not miss any; projection and clipping still check each one exactly. */
function wordsAround({ order, longest, loose }: WordOrder, words: readonly SpeechWord[], lo: number, hi: number): number[] {
  const slack = 1e-6 * (1 + Math.abs(lo) + Math.abs(hi));
  const first = partition(order, (index) => words[index]!.start < lo - longest - slack);
  const last = partition(order, (index) => words[index]!.start <= hi + slack);
  const found = order.slice(first, Math.max(first, last));
  if (loose.length) found.push(...loose);
  return found.sort((x, y) => x - y);
}

/** The first position where `before` is false (`before` is true and then false along the array). */
function partition<T>(list: readonly T[], before: (entry: T) => boolean): number {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (before(list[middle]!)) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The instances on the timeline that can project this asset (disabled ones included, same as the export). */
export function projectableItems(sequence: Sequence, assetId: Id): SequenceItem[] {
  return sequence.items.filter((item) => sourceAsset(item) === assetId && linearMap(item) !== null);
}

/**
 * Projects the words on the material clock onto the sequence (`asset-items` in text_plan.rs). Words out of range are dropped; words that cross a clip boundary are clipped to the range;
 * the result is sorted by start time, then by `key`.
 */
export function projectSpeech(sequence: Sequence, assetId: Id, words: readonly SpeechWord[]): PlacedWord[] {
  const fps = sequence.fps;
  const candidates = sequence.items
    .filter((item) => sourceAsset(item) === assetId)
    .map((item) => ({ item, bounds: itemRangeSeconds(item, fps) }))
    .sort((a, b) => a.bounds.start - b.bounds.start || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  const taken = new TakenIntervals();
  const placed: PlacedWord[] = [];
  const ordered = orderWords(words);
  for (const { item, bounds } of candidates) {
    const map = linearMap(item);
    if (!map) continue;
    if (bounds.end <= bounds.start) continue;
    const windows = taken.subtract(bounds.start, bounds.end);
    taken.add(bounds.start, bounds.end);
    if (windows.length === 0) continue;
    const toSequence = (source: number) => bounds.start + (source - map.sourceIn) / map.rate;
    const toSource = (time: number) => map.sourceIn + (time - bounds.start) * map.rate;
    const lo = toSource(Math.min(...windows.map((w) => w[0])));
    const hi = toSource(Math.max(...windows.map((w) => w[1])));
    for (const index of wordsAround(ordered, words, lo, hi)) {
      const word = words[index]!;
      const a = toSequence(word.start);
      const b = toSequence(word.end);
      let piece = 0;
      for (const [from, to] of windows) {
        const start = Math.max(a, from);
        const end = Math.min(b, to);
        if (end <= start) continue;
        piece++;
        const base = `${item.id}:${word.id}`;
        placed.push({ ...word, key: piece === 1 ? base : `${base}#${piece}`, scopeItemId: item.id, start, end });
      }
    }
  }
  return placed.sort((x, y) => x.start - y.start || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}

// ---- Cutting cues ----

export interface DerivedCue {
  /** `q-` + the first word's ID (cue.rs). */
  id: string;
  start: number;
  end: number;
  text: string;
  /** The speaker ID of the first word. */
  speaker?: string;
  wordIds: string[];
}

/** The remote export always splits sentences between these two words (`segmentsOf`), and cue.rs always breaks when the speaker changes: both are enforced as breaks here. */
function mustBreak(last: SpeechWord, next: SpeechWord, first: SpeechWord): boolean {
  if (next.paragraphStart) return true;
  if ((last.speaker ?? null) !== (next.speaker ?? null)) return true;
  const known = last.sentenceId !== undefined || next.sentenceId !== undefined;
  if (known ? last.sentenceId !== next.sentenceId : next.start - last.end > PAUSE_SECONDS || SENTENCE_END.test(last.text.trim())) return true;
  // The remote cuesOf's tooLong: a cue is at most 7 seconds.
  return next.end - first.start > EXPORT_MAX_CUE_SECONDS;
}

/** The `auto_break` ladder of cue.rs: sentence end > clause punctuation (a dash has a lower threshold) > long pause > overflow (when the next word ends on punctuation and does not exceed the margin, it is extended and included). */
function autoBreak(word: SpeechWord, next: SpeechWord, lineWidth: number, projected: number, params: CueParams): boolean {
  const token = word.text.trim();
  if (sentenceEnd(token)) return true;
  const punct = clauseEndChar(token);
  if (punct !== null && lineWidth >= (punct === '—' || punct === '–' ? params.minDashChars : params.minClauseChars)) return true;
  if (next.start - word.end >= params.pauseSec && lineWidth >= params.minPauseChars) return true;
  if (projected > params.maxChars) {
    const nextToken = next.text.trim();
    const imminent = clauseEndChar(nextToken) !== null || sentenceEnd(nextToken);
    return !(imminent && projected <= params.maxChars + params.overflowSlack);
  }
  return false;
}

/**
 * Cuts subtitle cues from the words on the material clock (the greedy scan of cue.rs `derive_cues`); the words are sorted by start time. `leading` is determined once for the whole word list,
 * consistent with the remote.
 */
export function deriveCues(source: readonly SpeechWord[], params: CueParams = CUE_PARAMS): DerivedCue[] {
  const words = [...source].sort((a, b) => a.start - b.start);
  const leading = words.some((word) => /^\s/.test(word.text));
  const cues: DerivedCue[] = [];
  let current: SpeechWord[] = [];
  const flush = () => {
    if (!current.length) return;
    const first = current[0]!;
    cues.push({
      id: `q-${first.id}`,
      start: first.start,
      end: Math.max(...current.map((word) => word.end)),
      text: joinWords(
        current.map((word) => word.text),
        leading,
      ),
      ...(first.speaker !== undefined ? { speaker: first.speaker } : {}),
      wordIds: current.map((word) => word.id),
    });
    current = [];
  };
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    current.push(word);
    const next = words[i + 1];
    if (!next) break;
    if (mustBreak(word, next, current[0]!)) {
      flush();
      continue;
    }
    const tokens = current.map((w) => w.text);
    const lineWidth = displayWidth(joinWords(tokens, leading));
    const projected = displayWidth(joinWords([...tokens, next.text], leading));
    if (autoBreak(word, next, lineWidth, projected, params)) flush();
  }
  flush();
  return cues;
}

// ---- Writing the caption document ----

/**
 * Subtitle cue → `cuccut.caption/1` body: the material clock, on a millisecond scale; each cue uses `words` (first word to last word) to point at words in the transcript. After rounding, it is fixed up per `quantize` in text-export.ts: the end is not earlier than the start, the cue is not pushed into the next one,
 * and if rounding makes two of them collide, the next cue's start is pushed to this cue's end. `speaker` (the display name) is written only when there are two or more speakers.
 */
export function speechCaptionBody(cues: readonly DerivedCue[], speakers: ReadonlyMap<string, string>): Json {
  const many = new Set(cues.map((cue) => cue.speaker ?? '')).size > 1;
  const ticks = cues.map((cue) => ({ a: Math.round(cue.start * 1000), b: Math.round(cue.end * 1000) }));
  ticks.forEach((cue, i) => {
    const next = ticks[i + 1];
    if (next && cue.b > next.a) cue.b = next.a;
    if (cue.b <= cue.a) cue.b = cue.a + 1;
    if (next && next.a < cue.b) next.a = cue.b;
  });
  return {
    schema: CAPTION_SCHEMA,
    clock: 'source-asset',
    timescale: 1000,
    cues: cues.map((cue, i) => {
      const { a, b } = ticks[i]!;
      return {
        id: cue.id,
        start: a,
        end: b,
        text: cue.text,
        ...(many && cue.speaker !== undefined ? { speaker: speakers.get(cue.speaker) ?? cue.speaker } : {}),
        ...(cue.wordIds.length ? { words: { first: cue.wordIds[0]!, last: cue.wordIds[cue.wordIds.length - 1]! } } : {}),
      };
    }),
  };
}

/**
 * Where the subtitle instance goes on the material clock: the effect instances are the instances on the timeline that use this asset (sorted by start), and the range covers them. When there is no such instance on the timeline
 * (the caller checks first, so this should not happen), no effect instance is written, and the range covers the first cue to the last cue.
 */
export function captionPlacement(
  sequence: Sequence,
  assetId: Id,
  body: Json,
): { span: { fromFrame: number; durationFrames: number }; scopeItemIds: Id[] } {
  const cues = Array.isArray(body.cues) ? (body.cues as Array<{ start: number; end: number }>) : [];
  const scale = finite(body.timescale) || 1000;
  const perSecond = sequence.fps.num / sequence.fps.den;
  const scope = projectableItems(sequence, assetId)
    .map((item) => {
      const range = itemRangeSeconds(item, sequence.fps);
      return { item, frames: { start: Math.floor(range.start * perSecond + 1e-6), end: Math.ceil(range.end * perSecond - 1e-6) } };
    })
    .sort((a, b) => a.frames.start - b.frames.start || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  if (scope.length) {
    const fromFrame = Math.min(...scope.map((s) => s.frames.start));
    return {
      span: { fromFrame, durationFrames: Math.max(1, Math.max(...scope.map((s) => s.frames.end)) - fromFrame) },
      scopeItemIds: scope.map((s) => s.item.id),
    };
  }
  const first = Math.min(...cues.map((cue) => cue.start)) / scale;
  const last = Math.max(...cues.map((cue) => cue.end)) / scale;
  const fromFrame = cues.length ? Math.max(0, Math.floor(first * perSecond + 1e-6)) : 0;
  const endFrame = cues.length ? Math.ceil(last * perSecond - 1e-6) : 1;
  return { span: { fromFrame, durationFrames: Math.max(1, endFrame - fromFrame) }, scopeItemIds: [] };
}

export const SPEECH_CAPTION_EXTENSION = 'cuccut.speechCues';
const DOCUMENT_REF = 'speech-caption';
const NEW_TRACK = 'new-subtitle-track';

export interface SpeechCaptionSource {
  /** The name of the document and of the subtitle instance. */
  name: string;
  language?: string;
  speechDocumentId: Id;
  speechRevision: string;
  assetId: Id;
  /** The name of a newly created subtitle track. */
  trackName: string;
}

/**
 * The transaction that generates subtitles: writes the caption document (material clock, recording the asset and which version of which transcript it came from) and places one caption instance; the effect instance and range are in
 * `captionPlacement`. Track selection is the same as `importCaptionOperations`: if a caption track has an empty, unlocked spot, it is placed there; otherwise a new track is created.
 */
export function speechCaptionOperations(sequence: Sequence, body: Json, source: SpeechCaptionSource): EditOperation[] {
  const cues = Array.isArray(body.cues) ? body.cues : [];
  const { span, scopeItemIds } = captionPlacement(sequence, source.assetId, body);
  const free = sequence.tracks
    .filter((track) => track.kind === 'subtitle' && !track.locked)
    .sort((a, b) => a.order - b.order)
    .find((track) => trackFree(sequence, track.id, span.fromFrame, span.fromFrame + span.durationFrames));
  const operations: EditOperation[] = [];
  if (!free) operations.push({ type: 'addTrack', sequenceId: sequence.id, kind: 'subtitle', ref: NEW_TRACK, name: source.trackName });
  operations.push({
    type: 'putDocument',
    ref: DOCUMENT_REF,
    kind: 'caption',
    name: source.name,
    ...(source.language ? { language: source.language } : {}),
    sourceAsset: { assetId: source.assetId },
    sourceDocument: { documentId: source.speechDocumentId },
    body,
    summary: { cueCount: cues.length },
    extensions: {
      [SPEECH_CAPTION_EXTENSION]: {
        speechDocumentId: source.speechDocumentId,
        speechRevision: source.speechRevision,
        assetId: source.assetId,
      },
    },
  });
  operations.push({
    type: 'insertItems',
    sequenceId: sequence.id,
    items: [
      {
        type: 'caption',
        name: source.name,
        span,
        documentRef: DOCUMENT_REF,
        ...(scopeItemIds.length ? { scopeItemIds } : {}),
        ...(free ? { trackId: free.id } : { trackRef: NEW_TRACK }),
      },
    ],
  });
  return operations;
}

// ---- Sentence count ----

const TERMINATOR_RUN = /[.!?\u{3002}\u{ff0e}\u{ff01}\u{ff1f}\u{2026}]+["'\u{201d}\u{2019}\u{300d}\u{300f}\u{ff09})\]\u{300b}]?/gu;
const CONTENT = /[\p{L}\p{N}]/u;

/**
 * The “sentences” count in the subtitle panel stats. The rule: in list order, the cue texts are joined together, and a run of terminal punctuation (。！？.!?…, optionally followed by a closing quote or bracket) that ends a piece of content counts as one sentence;
 * one immediately followed by a Western letter or digit (`2.14`, `a.com`) does not count; a sentence ending in `.` is further excluded by cue.rs's `sentence_end` for abbreviations and dotted stems (`Dr.`, `e.g.`, `U.S.`). A trailing segment that is not terminated also counts as a sentence. Cues with no letters or digits (pure punctuation, whitespace) are not counted.
 */
export function countSentences(texts: readonly string[]): number {
  let count = 0;
  let open = false;
  for (const value of texts) {
    let from = 0;
    for (const match of value.matchAll(TERMINATOR_RUN)) {
      const at = match.index;
      const end = at + match[0].length;
      const after = value[end];
      if (after !== undefined && /[A-Za-z0-9]/.test(after)) continue;
      const terminal = [...match[0]].filter((char) => TERMINAL.has(char)).at(-1);
      if (terminal === '.') {
        const tokenStart = Math.max(value.lastIndexOf(' ', at - 1) + 1, 0);
        if (!sentenceEnd(value.slice(tokenStart, end))) continue;
      }
      if (open || CONTENT.test(value.slice(from, at))) count++;
      open = false;
      from = end;
    }
    if (CONTENT.test(value.slice(from))) open = true;
  }
  return open ? count + 1 : count;
}

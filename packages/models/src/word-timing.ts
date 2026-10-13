import type { Segment } from './worker-contract.ts';

/**
 * Interpolation and monotonic correction of word timings, using the same rules as the Rust side (`crates/model-runtime/src/speech/word_timing.rs`, `text_prep.rs`,
 * `fix_word_times` in `asr_result.rs`) (architecture design §6.6, steps 5 and 6). When an online Provider gives only segment-level timings, this is used to insert
 * the words into the segment by character length and mark them `estimated`.
 *
 * Word splitting: for languages that use spaces, text is split on whitespace, and Han characters in between each become a word; for languages without spaces, such as Japanese, Korean and Thai, `Intl.Segmenter` is used (the Rust side uses ICU4X;
 * the two dictionaries are not completely identical, so word boundaries may differ slightly, but the timing rules are the same). Each word keeps its `surface` as-is (including trailing punctuation) and a `cleaned` form that keeps only
 * letters, digits, combining marks, and apostrophes. The weight is the number of characters in `cleaned` (at least 1).
 */

export interface WordPair {
  surface: string;
  cleaned: string;
}

export interface EstimatedWord {
  text: string;
  start: number;
  end: number;
}

const DICTIONARY_LANGUAGES = [
  'ja',
  'ko',
  'th',
  'lo',
  'km',
  'my',
  'bo',
  'japanese',
  'korean',
  'thai',
  'lao',
  'khmer',
  'burmese',
  'myanmar',
  'tibetan',
];

/** Characters kept: apostrophes, Unicode letters (L*), digits (Nd, Nl, No), and combining marks (M*). */
const KEPT = /[\p{L}\p{N}\p{M}']/u;
const KEPT_GLOBAL = /[\p{L}\p{N}\p{M}']/gu;

function isKept(char: string): boolean {
  return KEPT.test(char);
}

export function cleanToken(token: string): string {
  return (token.match(KEPT_GLOBAL) ?? []).join('');
}

/** Kana, Hangul, Thai, Lao, Khmer, Burmese, Tibetan. */
function needsDictionarySegmentation(char: string): boolean {
  const c = char.codePointAt(0)!;
  return (
    (c >= 0x3040 && c <= 0x30ff) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0x1100 && c <= 0x11ff) ||
    (c >= 0x0e00 && c <= 0x0eff) ||
    (c >= 0x1780 && c <= 0x17ff) ||
    (c >= 0x1000 && c <= 0x109f) ||
    (c >= 0x0f00 && c <= 0x0fff)
  );
}

export function isHanIdeograph(char: string): boolean {
  const c = char.codePointAt(0)!;
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x20000 && c <= 0x2a6df) ||
    (c >= 0x2a700 && c <= 0x2b73f) ||
    (c >= 0x2b740 && c <= 0x2b81f) ||
    (c >= 0x2b820 && c <= 0x2ceaf) ||
    (c >= 0xf900 && c <= 0xfaff)
  );
}

/** Text → words. `language` is a language code or language name; when absent, whether to use dictionary segmentation is decided from the characters themselves. */
export function splitIntoWordPairs(text: string, language?: string | null): WordPair[] {
  let native: boolean;
  if (language) {
    const lower = language.toLowerCase();
    native = DICTIONARY_LANGUAGES.some((candidate) => lower === candidate || lower.includes(candidate));
  } else {
    native = [...text].some(needsDictionarySegmentation);
  }
  return native ? nativeTokenizePairs(text) : tokenizeSpaceLanguagePairs(text);
}

function nativeTokenizePairs(text: string): WordPair[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  const ranges: Array<{ start: number; end: number }> = [];
  for (const part of segmenter.segment(text)) {
    if (cleanToken(part.segment) !== '') ranges.push({ start: part.index, end: part.index + part.segment.length });
  }
  const pairs: WordPair[] = [];
  ranges.forEach((range, index) => {
    const cleaned = cleanToken(text.slice(range.start, range.end));
    if (!cleaned) return;
    let surface = text.slice(range.start, range.end);
    const nextStart = ranges[index + 1]?.start ?? text.length;
    for (const char of text.slice(range.end, nextStart)) {
      if (/\s/u.test(char) || isKept(char)) break;
      surface += char;
    }
    pairs.push({ surface, cleaned });
  });
  return pairs;
}

export function tokenizeSpaceLanguagePairs(text: string): WordPair[] {
  const pairs: WordPair[] = [];
  for (const segment of text.split(/\s+/u).filter(Boolean)) {
    const before = pairs.length;
    appendSpaceSegment(segment, pairs);
    // The whole segment is punctuation: attach it to the previous word.
    if (pairs.length === before && pairs.length > 0) pairs[pairs.length - 1]!.surface += segment;
  }
  return pairs;
}

function appendSpaceSegment(segment: string, pairs: WordPair[]): void {
  const chars = [...segment];
  if (!chars.some(isHanIdeograph)) {
    const cleaned = cleanToken(segment);
    if (cleaned) pairs.push({ surface: segment, cleaned });
    return;
  }
  const pairStart = pairs.length;
  const buffer = { value: '' };
  for (const char of chars) {
    if (isHanIdeograph(char)) {
      flushNonHan(buffer, pairs, pairStart, true);
      const surface = buffer.value ? buffer.value + char : char;
      buffer.value = '';
      pairs.push({ surface, cleaned: char });
    } else {
      buffer.value += char;
    }
  }
  flushNonHan(buffer, pairs, pairStart, false);
}

function flushNonHan(buffer: { value: string }, pairs: WordPair[], pairStart: number, beforeHan: boolean): void {
  if (!buffer.value) return;
  const cleaned = cleanToken(buffer.value);
  if (!cleaned) {
    if (pairs.length > pairStart) {
      pairs[pairs.length - 1]!.surface += buffer.value;
      buffer.value = '';
    } else if (!beforeHan) {
      buffer.value = '';
    }
    // Before a Han character, with no word yet in this segment: keep it as a prefix for the next Han character.
    return;
  }
  pairs.push({ surface: buffer.value, cleaned });
  buffer.value = '';
}

/**
 * Inserts the words of a segment of text into `[start, end]` (seconds), by character length. The last word ends at the end of the segment; when no words can be split out, the whole text counts as one word; empty text has no words.
 */
export function estimateWords(text: string, language: string | null | undefined, start: number, end: number): EstimatedWord[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const segmentEnd = Math.max(end, start);
  const pairs = splitIntoWordPairs(trimmed, language);
  if (pairs.length === 0) return [{ text: trimmed, start, end: segmentEnd }];
  const weights = pairs.map((pair) => Math.max(1, [...pair.cleaned].length));
  const total = weights.reduce((a, b) => a + b, 0);
  const words: EstimatedWord[] = [];
  let consumed = 0;
  let cursor = start;
  pairs.forEach((pair, index) => {
    consumed += weights[index]!;
    const wordEnd = index + 1 === pairs.length ? segmentEnd : Math.min(start + ((segmentEnd - start) * consumed) / total, segmentEnd);
    words.push({ text: pair.surface, start: cursor, end: wordEnd });
    cursor = wordEnd;
  });
  return words;
}

/** Seconds → integer ticks (rounded; negative and non-finite values count as 0). */
export function secondsToTicks(seconds: number, timescale: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * timescale);
}

/**
 * Monotonic correction of word timings: words lie within the segment, start and end are not inverted, and each word does not end before the previous word ends. Corrected words keep their original `timingQuality`;
 * `missing` words are pinned to the segment start. Returns whether any timed word was changed (if so, the caller adds a `timing-adjusted` warning).
 */
export function fixWordTimes(segment: Segment): boolean {
  const { start, end } = segment;
  let adjusted = false;
  let previousEnd = start;
  for (const word of segment.words) {
    if (word.timingQuality === 'missing') {
      word.start = start;
      word.end = start;
      continue;
    }
    const fixedStart = clamp(word.start, previousEnd, end);
    const fixedEnd = clamp(word.end, fixedStart, end);
    if (fixedStart !== word.start || fixedEnd !== word.end) {
      adjusted = true;
      word.start = fixedStart;
      word.end = fixedEnd;
    }
    previousEnd = word.end;
  }
  return adjusted;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

import { EXPORT_MAX_CUE_SECONDS, type Id } from '@cuccut/protocol';

/**
 * Transcript (`cuccut.speech/1`) → caption cues (the body of `cuccut.caption/1`): on the source clock, the word list is greedily split into caption cues. Translation caption cues are cut by the Speech Worker, and here they are only written as a caption document (`workerCaptionBody`). Used by the fixed flow that builds the caption layer (`caption-layer.ts`).
 *
 * Source (modified): copied from the editor's `packages/ui/src/model/speech-cues.ts` (`readSpeechWords`, `splitUntimed`, `deriveCues`,
 * `speechCaptionBody`). The cutting method, rounding and caption cue IDs are the same, so the caption layer the flow builds is the same kind of thing as one built by “generate captions” in the editor.
 * The IDs of translation caption cues are the same as the editor's “put on picture” (`q-<unit ID>`; the later cues of the same unit follow `~n`), so that when one translated sentence is later edited in the editor, its cues can be found.
 * The greedy stepping algorithm for cutting cues is itself ported from the legacy `ccut-flow-core` `cue.rs` / `atomize.rs` (spec §18.5); details are in the notes for the UI copy.
 *
 * Caption cues for translations the agent wrote itself (without a Worker's caption cues) are cut by sentence-level alignment: `translationCues`, copied from the editor's `translation-cues.ts`.
 *
 * Architecture deviation: this logic should exist only once (in `crates/speech-doc`, shared with export). The editor's copy is in the UI model layer, and jobs cannot depend on the UI
 * (and the UI cannot depend on jobs, which only run in Node), so for now each keeps its own copy. When the cutting method changes, change both together (architecture design §14 “the caption layer of the transcription tool”).
 */

type Json = Record<string, unknown>;

export const CAPTION_SCHEMA = 'cuccut.caption/1';

/** cue.rs's canonical default parameters (§18.5); widths are counted in display width. */
export const CUE_PARAMS = {
  maxChars: 42,
  pauseSec: 0.6,
  /** The shortest line width for breaking at clause punctuation (comma class). */
  minClauseChars: 12,
  minPauseChars: 20,
  /** The shortest line width for breaking at dashes; lower than the comma tier. */
  minDashChars: 6,
  overflowSlack: 8,
} as const;

export type CueParams = { [K in keyof typeof CUE_PARAMS]: number };

/** The sentence-splitting pause (seconds) for remote export: for a transcript without stored sentences, a sentence is split when the pause between words exceeds this. */
const PAUSE_SECONDS = 1;

// ---- Character rules ----

const SENTENCE_END = /[.!?\u{3002}\u{ff01}\u{ff1f}\u{2026}]["'\u{201d}\u{2019}\u{ff09})\]]*$/u;
const NO_SPACE_BEFORE =
  /^[,.!?;:%)\]}'\u{2019}\u{201d}\u{2026}\u{ff0c}\u{3002}\u{ff01}\u{ff1f}\u{ff1b}\u{ff1a}\u{3001}\u{ff09}\u{300d}\u{300f}\u{3011}\u{300b}]/u;
const WIDE =
  /[\u{1100}-\u{115f}\u{2e80}-\u{303e}\u{3041}-\u{33ff}\u{3400}-\u{4dbf}\u{4e00}-\u{9fff}\u{a000}-\u{a4cf}\u{ac00}-\u{d7a3}\u{f900}-\u{faff}\u{fe30}-\u{fe4f}\u{ff00}-\u{ff60}\u{ffe0}-\u{ffe6}\u{20000}-\u{3fffd}]/u;
/** Hangul: displayed as full-width, but words in Korean are separated by spaces. */
const HANGUL = /[\u{1100}-\u{11ff}\u{3130}-\u{318f}\u{a960}-\u{a97f}\u{ac00}-\u{d7a3}\u{d7b0}-\u{d7ff}]/u;

/** Display width: full-width characters count as 2. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}

/** Whether a space goes between two words: required between Western and Korean words; not when adjacent to Han characters, kana or full-width symbols. */
const spaced = (char: string) => !WIDE.test(char) || HANGUL.test(char);

/** Joins words into text: a word that carries its own leading space is kept as is; otherwise a space goes between Western and Korean words, and none goes before Han characters, kana and punctuation. */
function joinCueWords(tokens: readonly string[], leadingSpaces: boolean): string {
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

// ---- Punctuation ----

// i18n-ignore-start: set of Chinese and English punctuation used for sentence breaking
const CLOSERS = new Set(['”', '"', '’', "'", '」', '』', '）', ')', ']', '》']);
const TERMINAL = new Set(['。', '．', '.', '？', '?', '！', '!', '…']);
const CLAUSE_END = new Set([',', ';', ':', '—', '–', '，', '；', '：', '、']);
// i18n-ignore-end
/** Table of lowercase stem abbreviations: the period in `Dr.` is not a sentence end. */
// prettier-ignore
const SENTENCE_ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'sr', 'jr', 'rev', 'hon', 'fr', 'gen', 'gov', 'sen',
  'rep', 'col', 'lt', 'sgt', 'capt', 'vs', 'etc', 'inc', 'ltd', 'corp', 'dept', 'vol', 'fig',
]);

/** Sentence end: skips at most one closing quote or bracket, after which a terminal punctuation mark counts; for `.`, it does not count when the stem contains another `.` or the stem is an abbreviation. */
function sentenceEnd(token: string): boolean {
  const chars = [...token];
  let index = chars.length;
  if (index > 0 && CLOSERS.has(chars[index - 1]!)) index--;
  if (index === 0) return false;
  const last = chars[index - 1]!;
  if (!TERMINAL.has(last)) return false;
  if (last === '.') {
    const stem = chars.slice(0, index - 1).join('');
    if (stem.includes('.')) return false;
    const bare = stem.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase();
    if (SENTENCE_ABBREV.has(bare)) return false;
  }
  return true;
}

/** Clause punctuation: skips at most one trailing punctuation mark after a closing quote or bracket; returns null if there is none. */
function clauseEndChar(token: string): string | null {
  const chars = [...token];
  let index = chars.length;
  if (index > 0 && CLOSERS.has(chars[index - 1]!)) index--;
  if (index === 0) return null;
  const last = chars[index - 1]!;
  return CLAUSE_END.has(last) ? last : null;
}

// ---- Reading the transcript ----

/** One word in the transcript (source clock, seconds). */
export interface CueWord {
  id: string;
  start: number;
  end: number;
  /** Kept as is (not trimmed): some recognizers use a leading space to express the whitespace between words. */
  text: string;
  speaker?: string;
  sentenceId?: string;
  /** This sentence is marked as a paragraph start, and this is the first member of the sentence. */
  paragraphStart: boolean;
}

export interface CueWords {
  words: CueWord[];
  /** Speaker ID → display name. */
  speakers: Map<string, string>;
}

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * Reads the words of `cuccut.speech/1`: skips hidden, blank and non-positive-duration words. Sentences are recognized in two forms: `wordIds`, and `first` / `last`.
 * Returns null when it is not a transcript body. A whole segment without word timings is split by `splitUntimed`.
 */
export function readSpeechWords(body: unknown, params: CueParams = CUE_PARAMS): CueWords | null {
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
      if (first !== undefined && last !== undefined && first <= last)
        members = Array.from({ length: last - first + 1 }, (_, n) => first + n);
    }
    members.forEach((at, n) => (sentenceOf[at] = { id, paragraph: paragraph && n === 0 }));
  }
  const words: CueWord[] = [];
  const leading = raw.some((word) => /^\s/.test(text(word.text) ?? ''));
  // When there is no word yet before a zero-duration word, its text is kept and attached to the front of the next word.
  let carried = '';
  raw.forEach((word, i) => {
    if (word.hidden === true) return;
    const value = text(word.text) ?? '';
    if (!value.trim()) return;
    const start = finite(word.start);
    let end = finite(word.end);
    if (start === null || end === null) return;
    if (end <= start) {
      // Zero-duration words (word timings in the transcript collapsed to a point) are not dropped: if there is a gap after them, they take a small slice of it; if not, their text is merged into the adjacent word.
      end = slotAfter(raw, i, start, scale);
      if (end === null) {
        const previous = words.at(-1);
        if (previous) previous.text = joinCueWords([previous.text, value], leading);
        else carried = carried ? joinCueWords([carried, value], leading) : value;
        return;
      }
    }
    const speaker = text(word.speaker);
    const sentence = sentenceOf[i];
    const id = text(word.id) ?? '';
    const untimed = word.timingQuality === 'missing' || /\S\s+\S/.test(value.trim());
    const pieces = untimed
      ? splitUntimed(value, start / scale, end / scale, params.maxChars)
      : [{ text: value, start: start / scale, end: end / scale }];
    pieces.forEach((piece, n) =>
      words.push({
        id: n === 0 ? id : `${id}~${n + 1}`,
        start: piece.start,
        end: piece.end,
        text: n === 0 && carried ? joinCueWords([carried, piece.text], leading) : piece.text,
        ...(speaker !== undefined ? { speaker } : {}),
        ...(sentence ? { sentenceId: sentence.id } : {}),
        paragraphStart: n === 0 && (sentence?.paragraph ?? false),
      }),
    );
    carried = '';
  });
  if (carried && words.length) words[words.length - 1]!.text = joinCueWords([words[words.length - 1]!.text, carried], leading);
  const speakers = new Map<string, string>();
  for (const speaker of Array.isArray(body.speakers) ? body.speakers.filter(isObject) : []) {
    const id = text(speaker.id);
    if (id !== undefined) speakers.set(id, text(speaker.name)?.trim() || id);
  }
  return { words, speakers };
}

/** The nominal duration (seconds) a zero-duration word occupies: one time cell of the aligner. */
const NOMINAL_WORD_SECONDS = 0.08;

/**
 * A zero-duration word takes a small slice (in ticks) of the gap after it: up to the start of the next word with a time (hidden words count too, since their time is still there), and at most one nominal duration.
 * When there is no word after it, one nominal duration is added directly. When the next word starts right here (no gap), it returns null.
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
 * A segment without word timings is split into several blocks: it breaks at whitespace, at sentence ends and after clause punctuation; a block wider than `maxChars` is further cut by width. Time is divided linearly
 * across [start, end] by each block's display width. If it cannot be split, it stays one block.
 */
export function splitUntimed(
  value: string,
  start: number,
  end: number,
  maxChars: number,
): Array<{ text: string; start: number; end: number }> {
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
    // Punctuation immediately followed by a character (Chinese and Japanese do not use spaces): break only when next to a full-width character; `2.14`, `3:30` and `1,000` do not break.
    const next = chars[i + 1];
    if (next === undefined || /\s/.test(next) || CLOSERS.has(next)) return;
    if (!BREAK_AFTER.has(char) && !CLOSERS.has(char)) return;
    if ((WIDE.test(char) || WIDE.test(next)) && (sentenceEnd(current) || clauseEndChar(current) !== null)) push();
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

/** A block wider than `maxChars` is cut by display width into several segments of roughly equal width. */
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

// ---- Cutting cues ----

export interface DerivedCue {
  /** `q-` + the first word's ID. */
  id: string;
  start: number;
  end: number;
  text: string;
  /** The speaker ID of the first word. */
  speaker?: string;
  /** The words of this cue (ordered by start time), written as the caption sentence's `words`. */
  wordIds: string[];
}

/** A break is always made at a paragraph start, at a speaker change, at a sentence change (when sentences are not stored: a pause over 1 second, or sentence-final punctuation), and when a cue exceeds 7 seconds. */
function mustBreak(last: CueWord, next: CueWord, first: CueWord): boolean {
  if (next.paragraphStart) return true;
  if ((last.speaker ?? null) !== (next.speaker ?? null)) return true;
  const known = last.sentenceId !== undefined || next.sentenceId !== undefined;
  if (known ? last.sentenceId !== next.sentenceId : next.start - last.end > PAUSE_SECONDS || SENTENCE_END.test(last.text.trim()))
    return true;
  return next.end - first.start > EXPORT_MAX_CUE_SECONDS;
}

/** The line-break ladder: sentence end > clause punctuation (the dash threshold is lower) > long pause > overflow (when the next word ends on punctuation and fits within the margin, it is extended to include that word). */
function autoBreak(word: CueWord, next: CueWord, lineWidth: number, projected: number, params: CueParams): boolean {
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

/** Cuts caption cues by the words on the source clock (greedy scan); words are ordered by start time. */
export function deriveCues(source: readonly CueWord[], params: CueParams = CUE_PARAMS): DerivedCue[] {
  const words = [...source].sort((a, b) => a.start - b.start);
  const leading = words.some((word) => /^\s/.test(word.text));
  const cues: DerivedCue[] = [];
  let current: CueWord[] = [];
  const flush = () => {
    if (!current.length) return;
    const first = current[0]!;
    cues.push({
      id: `q-${first.id}`,
      start: first.start,
      end: Math.max(...current.map((word) => word.end)),
      text: joinCueWords(
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
    const lineWidth = displayWidth(joinCueWords(tokens, leading));
    const projected = displayWidth(joinCueWords([...tokens, next.text], leading));
    if (autoBreak(word, next, lineWidth, projected, params)) flush();
  }
  flush();
  return cues;
}

// ---- Translation cue cutting ----

/** The parameters used when cutting captions for a translation unit (`cuccut.translation/2`, video format spec §5.3). */
export interface CueTranslationUnit {
  id: Id;
  naturalText: string;
  displayRewrite?: { text: string } | undefined;
  alignment: { sourceWordIds: readonly Id[] } | null;
  status: string;
}

/** `w12~3` (a block split out of a segment without word timings) → `w12`. */
const baseWordId = (id: string) => id.replace(/~\d+$/, '');

/**
 * Translation unit → caption cues (source clock, seconds): the time of a translated sentence takes the times of the source sentence's member words (`alignment.sourceWordIds`), which are split by `splitUntimed`
 * at whitespace and punctuation, with time interpolated by display width. Then `deriveCues` greedily cuts cues (each no more than 7 seconds, and never crossing the source sentence). Display width follows
 * `displayWidth`: Han characters, kana, Hangul and full-width symbols count as 2, other text counts as 1. Chinese and Japanese break at punctuation; Korean and Western text breaks at spaces; text with neither (such as Thai) is cut by width. Units marked stale, units with no translation, and units where none of the source sentence's words can be found produce no captions. The caption cue ID is `q-<unit ID>`,
 * and the later cues cut from the same sentence follow `~n`.
 *
 * Source (modified): copied from the editor's `packages/ui/src/model/translation-cues.ts` (`translationCues`). The cutting method, time and IDs are the same,
 * so a translation caption layer the agent builds can still find its cues via `retextCaption` when one translated sentence is later edited in the editor. The reason for the two copies is in the file header under
 * “Architecture deviation”; when the cutting method changes, change both together. `caption-layer.test.ts` checks that both match, using the editor copy's samples.
 */
export function translationCues(speech: CueWords, units: readonly CueTranslationUnit[], params: CueParams = CUE_PARAMS): DerivedCue[] {
  const byBase = new Map<string, CueWord[]>();
  for (const word of speech.words) {
    const base = baseWordId(word.id);
    byBase.set(base, [...(byBase.get(base) ?? []), word]);
  }
  const pseudo: CueWord[] = [];
  for (const unit of units) {
    const value = (unit.displayRewrite?.text || unit.naturalText || '').trim();
    if (unit.status === 'stale' || !value) continue;
    const words = (unit.alignment?.sourceWordIds ?? []).flatMap((id) => byBase.get(id) ?? []);
    if (!words.length) continue;
    const start = Math.min(...words.map((w) => w.start));
    const end = Math.max(...words.map((w) => w.end));
    const speaker = words.find((w) => w.start === start)!.speaker;
    splitUntimed(value, start, end, params.maxChars).forEach((piece, n) => {
      pseudo.push({
        id: n === 0 ? unit.id : `${unit.id}~${n + 1}`,
        start: piece.start,
        end: piece.end,
        text: piece.text.trim(),
        ...(speaker !== undefined ? { speaker } : {}),
        // A translated sentence stands alone: it is not joined into one cue with the adjacent translated sentences.
        sentenceId: unit.id,
        paragraphStart: false,
      });
    });
  }
  return deriveCues(pseudo, params);
}

// ---- Writing as a caption document ----

/**
 * Caption cues → `cuccut.caption/1` body: source clock, millisecond ticks. After rounding, it fixes things: the end is not earlier than the start, and a cue is not pushed into the next one. When rounding makes two cues collide, the next cue's start is pushed to this cue's end.
 * `speaker` is written only when two or more speakers appear (it writes the display name).
 */
export function captionBody(cues: readonly DerivedCue[], speakers: ReadonlyMap<string, string>): Json {
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
        ...wordRange(cue.wordIds),
      };
    }),
  };
}

/** Which words in the transcript a caption sentence points to (video format spec §3.8): from the first word to the last word. Rendering uses it to fetch words for per-word animation and emphasis. */
function wordRange(wordIds: readonly string[]): { words?: { first: string; last: string } } {
  return wordIds.length ? { words: { first: wordIds[0]!, last: wordIds[wordIds.length - 1]! } } : {};
}

/**
 * Translation caption cues cut by the Speech Worker → `cuccut.caption/1` body: source clock, the transcript's ticks (integer ticks are written as they are, not converted via seconds). Caption cue IDs are
 * `q-<unit ID>`; the later cues of the same unit follow `~2`, `~3`…; `speaker` is written only when two or more speakers appear (it writes the display name).
 */
export function workerCaptionBody(
  cues: { timescale: number; cues: ReadonlyArray<{ unitId: Id | null; sentenceId: Id; text: string; start: number; end: number }> },
  sentenceSpeakers: ReadonlyMap<string, string>,
  speakers: ReadonlyMap<string, string>,
): Json {
  const seen = new Map<string, number>();
  const rows = cues.cues
    .filter((cue) => cue.text.trim() !== '' && cue.end > cue.start)
    .map((cue) => {
      const base = `q-${cue.unitId ?? cue.sentenceId}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const speaker = sentenceSpeakers.get(cue.sentenceId);
      return { id: n === 1 ? base : `${base}~${n}`, start: cue.start, end: cue.end, text: cue.text.trim(), speaker };
    });
  const many = new Set(rows.map((row) => row.speaker ?? '')).size > 1;
  return {
    schema: CAPTION_SCHEMA,
    clock: 'source-asset',
    timescale: cues.timescale,
    cues: rows.map(({ speaker, ...row }) => ({
      ...row,
      ...(many && speaker !== undefined ? { speaker: speakers.get(speaker) ?? speaker } : {}),
    })),
  };
}

// ---- Caption cues for replacing only one translated sentence ----

/** Whether a caption cue belongs to this translated sentence: after `q-<unit ID>` comes either the end or `~` (so `t-s-w1` does not swallow `t-s-w10`). */
export function cueOfUnit(cueId: string, unitId: Id): boolean {
  const base = `q-${unitId}`;
  if (!cueId.startsWith(base)) return false;
  const rest = cueId.slice(base.length);
  return rest === '' || rest[0] === '~';
}

/** One cue swapped into the caption body: times in seconds (source clock); `speaker` is the speaker ID in the transcript. */
export interface RetextCue {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface BodyCue {
  id?: unknown;
  start: number;
  end: number;
  text?: unknown;
  speaker?: unknown;
}

/**
 * The caption body after one translated sentence is replaced: this sentence's original cues are removed, and `fresh` is put back in their place (if there were no originals, it is inserted by time; if `fresh` is empty, the sentence is just removed).
 * Overlaps are then fixed using `captionBody`'s rounding rules. Other cues are left untouched, including hand-edited text. New cues get a speaker only if the originals had one (it writes the display name).
 *
 * Source (modified): copied from the editor's `packages/ui/src/model/translation-cues.ts` (`retextCaption`), with the same behavior. It is used by in-place retranslation (`translate.ts`) and by syncing the caption layer after the agent writes a translation. When the rules change, change both together.
 */
export function retextCaption(body: Json, unitId: Id, fresh: readonly RetextCue[], speakers: ReadonlyMap<string, string>): Json {
  const scale = typeof body.timescale === 'number' && body.timescale > 0 ? body.timescale : 1000;
  const cues = (Array.isArray(body.cues) ? body.cues : []) as BodyCue[];
  const mine = (cue: BodyCue) => typeof cue.id === 'string' && cueOfUnit(cue.id, unitId);
  const firstOld = cues.findIndex(mine);
  const kept = cues.filter((cue) => !mine(cue));
  const withSpeaker = cues.some((cue) => typeof cue.speaker === 'string');
  const made: BodyCue[] = fresh.map((cue) => ({
    id: cue.id,
    start: Math.round(cue.start * scale),
    end: Math.round(cue.end * scale),
    text: cue.text,
    ...(withSpeaker && cue.speaker !== undefined ? { speaker: speakers.get(cue.speaker) ?? cue.speaker } : {}),
  }));
  let at: number;
  if (firstOld >= 0) at = cues.slice(0, firstOld).filter((cue) => !mine(cue)).length;
  else {
    const from = made[0]?.start ?? 0;
    at = kept.findIndex((cue) => cue.start > from);
    if (at < 0) at = kept.length;
  }
  const merged = [...kept.slice(0, at), ...made, ...kept.slice(at)].map((cue) => ({ ...cue }));
  merged.forEach((cue, i) => {
    const next = merged[i + 1];
    if (next && cue.end > next.start) cue.end = next.start;
    if (cue.end <= cue.start) cue.end = cue.start + 1;
    if (next && next.start < cue.end) next.start = cue.end;
  });
  return { ...body, cues: merged };
}

/**
 * The cues of one unit, cut by the Speech Worker → the input to `retextCaption` (seconds; the IDs use the same numbering as `workerCaptionBody`:
 * `q-<unit ID>`, with later cues following `~2`, `~3`…).
 */
export function workerUnitCues(
  cues: { timescale: number; cues: ReadonlyArray<{ unitId: Id | null; sentenceId: Id; text: string; start: number; end: number }> },
  unitId: Id,
  sentenceSpeakers: ReadonlyMap<string, string>,
): RetextCue[] {
  const base = `q-${unitId}`;
  return cues.cues
    .filter((cue) => cue.unitId === unitId && cue.text.trim() !== '' && cue.end > cue.start)
    .map((cue, i) => {
      const speaker = sentenceSpeakers.get(cue.sentenceId);
      return {
        id: i === 0 ? base : `${base}~${i + 1}`,
        start: cue.start / cues.timescale,
        end: cue.end / cues.timescale,
        text: cue.text.trim(),
        ...(speaker !== undefined ? { speaker } : {}),
      };
    });
}

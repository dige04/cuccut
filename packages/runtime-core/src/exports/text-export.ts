import {
  EXPORT_MAX_CHARS_PER_LINE,
  EXPORT_MAX_CUE_SECONDS,
  EXPORT_MAX_LINES_PER_CUE,
  refOf,
  TRANSCRIPT_PARAGRAPH,
  transcriptMarkdownText as markdownText,
  transcriptOneLine as oneLine,
  transcriptStamp,
  type JobWarning,
  type Localized,
  type SubtitleExportFormat,
  type TranscriptExportFormat,
} from '@cuccut/protocol';
import { sourceSentences } from '@cuccut/jobs';
import { JobsSpeechDocument } from '@cuccut/protocol/messages/jobs/speech-document.ts';
import { RcExport } from '@cuccut/protocol/messages/runtime-core';
import type { PlannedDocument, TextEntry, TextPlan } from './export-plan.ts';
import { assStyleMapping } from './ass-style.ts';

/**
 * Writing subtitles and scripts (architecture design §9.13): the engine's projection of entries onto the timeline (`TextPlan`, with cut words already removed) is assembled into sentences, split into caption cues, and written as SRT, VTT, ASS, JSON, Markdown, or plain text. After writing, the file is parsed back in the same format, and it passes only if the entry count and times match.
 *
 * - Times are seconds relative to the start of the export range (files start at 0), all from the engine's projection. Here we only round and repair overlaps.
 * - Words whose timing is not trustworthy (interpolated, missing) are not written with per-word times (acceptance AT-05). For documents with only sentence-level timing, JSON has no `words`.
 * - Bilingual merge: translations are matched to sentences (or caption cues) by ID. A sentence that is only partly kept after cutting is not matched to a translation (format spec §5.7), and a warning is recorded. Another timed document is matched to the main document's sentences by time overlap. Translations come in two body formats (format spec §5.3): `cuccut.translation/2` (units matched by `sourceSentenceId`, members are `alignment.sourceWordIds`; for a unit whose `alignment` is null, the member is the sentence derived from the transcript's words by the caption and translation-core rules, the same sentence used at translation time; when the transcript has no stored sentences, sentences are also split by members), and the legacy `cuccut.translation/1` imported from old projects (the unit's `id` is the sentence ID, and members are taken from the transcript's sentences).
 */

export type TextFormat = SubtitleExportFormat | TranscriptExportFormat;

export interface TextExportInput {
  kind: 'subtitles' | 'transcript';
  format: TextFormat;
  primary: { document: PlannedDocument; plan: TextPlan };
  secondary: { document: PlannedDocument; plan: TextPlan | null } | null;
  /** The style document of the first caption instance in the main document (used for ASS). */
  style: unknown;
  canvas: { width: number; height: number };
  meta: { videoId: string; videoName: string; videoRevision: string; sequenceId: string; sequenceRevision: string };
  /** Time range (seconds): the duration of the export range. With `skipCut: false`, it is the span of the original (`sourcePlan`). */
  rangeDuration: number;
  maxCharsPerLine?: number;
  /** Scripts (Markdown, plain text) write the start time of each paragraph at its end (`[mm:ss]`, or `[hh:mm:ss]` past one hour). */
  timestamps?: boolean;
  /** Scripts write speaker names: on every paragraph (when the paragraph has a speaker). Default true. */
  speakers?: boolean;
  /** Chapter subheadings of the script (on the same time base as the entries, sorted by start). null or omitted means none are written. */
  chapters?: TextChapter[] | null;
  /** Front matter for a Markdown script. null or omitted means none is written. Plain text and JSON never write it. */
  frontMatter?: FrontMatter | null;
}

/** A chapter (a marker with `kind: 'chapter'` on the sequence): its title and start time. */
export interface TextChapter {
  title: string;
  start: number;
}

/**
 * Front matter (YAML) fields, written in this order. Missing ones (null, empty strings) are omitted entirely. Speakers and chapters are derived from the body and appended after.
 * Same fields and format as `frontmatter()` in the design draft model-transcript.js and v2's `--frontmatter`.
 */
export interface FrontMatter {
  title: string | null;
  description: string | null;
  source: string | null;
  author: string | null;
  published: string | null;
  platform: string | null;
  duration: string | null;
  language: string | null;
  translation: string | null;
}

export interface TextExportOutput {
  content: string;
  /** The number of items written: captions are cues, JSON is sentences, and Markdown and plain text are paragraphs. */
  entries: number;
  /** End time of the last item (seconds). */
  durationSec: number;
  /** Latin word count and Han character count in the main document body (excluding titles, speakers, timecodes, and translations). The UI uses them to show length. */
  words: number;
  cjkCharacters: number;
  /** The number of blocks of chapter subheadings in a plain-text script. Subtracted when validating the paragraph count, since subheadings and body text are both text blocks and the format can't tell them apart. */
  headings: number;
  warnings: JobWarning[];
  /** The range used for validation (seconds): that is, `TextExportInput.rangeDuration`. */
  rangeSec: number;
}

export interface TextWord {
  id: string;
  text: string;
  start: number;
  end: number;
  timed: boolean;
}

/** One sentence (or one caption cue): the unit for splitting captions and writing scripts and JSON. */
export interface TextSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker: string | null;
  translation: string | null;
  /** For matching translations: the transcript's sentence ID, or a caption document's cue ID. null for a transcript without sentence segmentation. */
  sentenceId: string | null;
  paragraphStart: boolean;
  /** The transcript's words. null for a caption document. */
  words: TextWord[] | null;
}

interface Cue {
  start: number;
  end: number;
  lines: string[];
  secondary: string[];
}

/** A pause between sentences longer than this splits them (used for transcripts without sentence segmentation). */
const PAUSE_SECONDS = 1;
const SENTENCE_END = /[.!?。！？…]["'”’）)\]]*$/u;
const NO_SPACE_BEFORE = /^[,.!?;:%)\]}'’”…，。！？；：、）」』】》]/u;
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3fffd}]/u;

/** Display width: full-width characters count as 2. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}

/** Joins words into text. Words that carry their own leading space (a habit of some recognizers) are joined as-is. Otherwise a space is added between Western words, and none is added before full-width characters or punctuation. */
export function joinWords(tokens: string[], leadingSpaces: boolean): string {
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
    const space = !WIDE.test(prev) && !WIDE.test(next) && !NO_SPACE_BEFORE.test(token);
    out += space ? ` ${token}` : token;
  }
  return out;
}

/** Line wrapping: keeps the existing line breaks. Over-wide lines break at spaces (Western text) or by width (full-width text, where punctuation may not start a line). */
export function wrapLines(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const trimmed = paragraph.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    let rest = trimmed;
    while (displayWidth(rest) > maxWidth) {
      const chars = [...rest];
      let width = 0;
      let cut = 0;
      let lastSpace = -1;
      for (let i = 0; i < chars.length; i++) {
        const w = WIDE.test(chars[i]!) ? 2 : 1;
        if (width + w > maxWidth) break;
        width += w;
        cut = i + 1;
        if (chars[i] === ' ') lastSpace = i;
      }
      if (lastSpace > 0 && !WIDE.test(chars[cut] ?? '')) cut = lastSpace;
      // Punctuation may not start a line: keep it on the previous line.
      while (cut < chars.length && NO_SPACE_BEFORE.test(chars[cut]!)) cut++;
      if (cut <= 0) cut = 1;
      lines.push(chars.slice(0, cut).join('').trim());
      rest = chars.slice(cut).join('').trim();
    }
    if (rest) lines.push(rest);
  }
  return lines;
}

// ---- Sentences ----

interface SpeechBody {
  speakers?: Array<{ id: string; name?: string }>;
  words?: Array<{ id: string; start?: number; end?: number; hidden?: boolean; text?: string }>;
  sentences?: Array<{ id: string; first?: string; last?: string; wordIds?: string[] }> | null;
}

interface TranslationBody {
  schema?: string;
  units?: Array<{
    id: string;
    // cuccut.translation/1 (imported from old projects)
    text?: string;
    display?: string;
    // cuccut.translation/2（§5.3）
    sourceSentenceId?: string;
    sourceFingerprint?: string;
    naturalText?: string;
    displayRewrite?: { text?: string };
    alignment?: { sourceWordIds?: string[] } | null;
    status?: string;
  }>;
}

/** Translations read: sentence ID → translation. `/2` also carries each sentence's word members (excluding hidden words). */
interface Translation {
  texts: Map<string, string>;
  members: Map<string, Set<string>> | null;
  /** The number of units marked stale (`status: 'stale'`) and therefore not used. */
  stale: number;
}

const TRANSLATION_V2 = 'cuccut.translation/2';

/** The sentences the transcript yields under the caption and translation-core rules: sentence ID → fingerprint and (visible) words. */
type DerivedSentences = Map<string, { fingerprint: string; wordIds: string[] }>;

/**
 * A `/2` unit whose `alignment` is null (a translation the agent wrote itself, allowed by §5.3) did not record its members. The sentence is re-derived from the main document's (transcript's) words with the same rules used at translation time (`sourceSentences`, via editor-wasm), and that sentence's words are taken. Computed once, only when needed. If the sentence WASM is not built, it still throws (`EditorWasmUnavailable`), so the export fails rather than silently losing translations.
 */
function sentenceDeriver(primary: PlannedDocument): () => DerivedSentences | null {
  let derived: DerivedSentences | null | undefined;
  return () => {
    if (derived !== undefined) return derived;
    const read = sourceSentences(primary.body);
    derived =
      'problem' in read ? null : new Map(read.sentences.map((s) => [s.id, { fingerprint: s.fingerprint, wordIds: [...s.wordIds] }]));
    return derived;
  };
}

/**
 * Reads translations. `derive` gives the transcript's sentences as they are now. For a unit whose `alignment` is null, its members are taken from them. When the fingerprint differs from the one recorded on the unit (the source sentence was changed), it is not used and is marked stale.
 */
function translationOf(body: TranslationBody | null, derive: (() => DerivedSentences | null) | null): Translation {
  const units = Array.isArray(body?.units) ? body.units : [];
  if (body?.schema !== TRANSLATION_V2) {
    return { texts: new Map(units.map((u) => [u.id, (u.display ?? u.text ?? '').trim()])), members: null, stale: 0 };
  }
  const texts = new Map<string, string>();
  const members = new Map<string, Set<string>>();
  let stale = 0;
  for (const unit of units) {
    if (typeof unit.sourceSentenceId !== 'string') continue;
    if (unit.status === 'stale') {
      stale++;
      continue;
    }
    const ids = unit.alignment?.sourceWordIds;
    if (Array.isArray(ids)) members.set(unit.sourceSentenceId, new Set(ids));
    else if (unit.alignment === null && derive) {
      const sentence = derive()?.get(unit.sourceSentenceId);
      if (sentence && unit.sourceFingerprint && unit.sourceFingerprint !== sentence.fingerprint) {
        stale++;
        continue;
      }
      if (sentence) members.set(unit.sourceSentenceId, new Set(sentence.wordIds));
    }
    texts.set(unit.sourceSentenceId, (unit.displayRewrite?.text?.trim() || unit.naturalText || '').trim());
  }
  return { texts, members, stale };
}

/** When the transcript has no stored sentences, tags entries with sentence IDs from the `/2` translation's word members (the translation was done by those sentences). */
function withTranslationSentences(
  entries: TextEntry[],
  secondary: TextExportInput['secondary'],
  translation: Translation | null,
): TextEntry[] {
  if (!secondary || secondary.plan !== null || !translation || entries.some((e) => e.sentenceId !== undefined)) return entries;
  const members = translation.members;
  if (!members || members.size === 0) return entries;
  const sentenceOf = new Map<string, string>();
  for (const [sentenceId, ids] of members) for (const id of ids) sentenceOf.set(id, sentenceId);
  return entries.map((e) => {
    const sentenceId = sentenceOf.get(e.id);
    return sentenceId === undefined ? e : { ...e, sentenceId };
  });
}

/** Each sentence's words (not hidden) in the transcript body. */
function sentenceMembers(body: SpeechBody | null): Map<string, Set<string>> {
  const members = new Map<string, Set<string>>();
  if (!body?.sentences || !Array.isArray(body.words)) return members;
  const hidden = new Set(body.words.filter((w) => w.hidden).map((w) => w.id));
  const order = new Map(body.words.map((w, i) => [w.id, i]));
  for (const sentence of body.sentences) {
    let ids: string[] = [];
    if (Array.isArray(sentence.wordIds)) ids = sentence.wordIds;
    else if (sentence.first !== undefined && sentence.last !== undefined) {
      const a = order.get(sentence.first);
      const b = order.get(sentence.last);
      if (a !== undefined && b !== undefined) ids = body.words.slice(a, b + 1).map((w) => w.id);
    }
    members.set(sentence.id, new Set(ids.filter((id) => !hidden.has(id))));
  }
  return members;
}

/**
 * Words in the transcript body that can't fit on a caption anyway: duration not positive (`end <= start`, where the transcript gives the word a collapsed time at one point), or with no text. Planning (`text_plan.rs`) doesn't emit these words, but they are not cut. When matching a whole-sentence translation, they are not counted as missing members. Hidden words are not in this set: hiding is the user's edit.
 */
function unplaceableWords(body: SpeechBody | null): Set<string> {
  const ids = new Set<string>();
  for (const word of body?.words ?? []) {
    if (word.hidden) continue;
    const timeless = typeof word.start === 'number' && typeof word.end === 'number' && word.end <= word.start;
    if (timeless || (typeof word.text === 'string' && word.text.trim() === '')) ids.add(word.id);
  }
  return ids;
}

/** A speaker's display name. If it has none, the transcript's default name is used (“Speaker N”). */
function speakerNames(primary: PlannedDocument): Map<string, string> {
  const body = (primary.body ?? null) as SpeechBody | null;
  return new Map((body?.speakers ?? []).map((s, i) => [s.id, s.name?.trim() || JobsSpeechDocument.speakerName({ n: i + 1 }).text]));
}

/** The main document's entries assembled into sentences (for a caption document, one cue is one sentence). */
export function segmentsOf(input: Pick<TextExportInput, 'primary' | 'secondary'>, warnings: JobWarning[]): TextSegment[] {
  const { plan, document } = input.primary;
  const names = speakerNames(document);
  const speakerOf = (id: string | undefined) => (id === undefined ? null : (names.get(id) ?? id));
  // Translations (a separate document without timing) are read once: the same members are used for sentence splitting and for matching translations.
  const translation =
    input.secondary && input.secondary.plan === null
      ? translationOf(input.secondary.document.body as TranslationBody | null, plan.unit === 'speech' ? sentenceDeriver(document) : null)
      : null;
  let segments: TextSegment[];
  if (plan.unit === 'caption') {
    segments = plan.entries.map((e) => ({
      id: e.key,
      start: e.start,
      end: e.end,
      text: e.text.trim(),
      speaker: speakerOf(e.speaker),
      translation: null,
      sentenceId: e.id,
      paragraphStart: e.paragraphStart === true,
      words: null,
    }));
  } else {
    const entries = withTranslationSentences(plan.entries, input.secondary, translation);
    const leading = entries.some((e) => /^\s/.test(e.text));
    const runs: TextEntry[][] = [];
    let run: TextEntry[] = [];
    for (const entry of entries) {
      const last = run.at(-1);
      // When sentences are known, split by sentence (pauses and speakers within a sentence are decided by the sentence-splitting rules, so they are not split again here). When not known, split by pauses, speakers, and sentence-final punctuation.
      const known = last !== undefined && (last.sentenceId !== undefined || entry.sentenceId !== undefined);
      const split =
        last !== undefined &&
        (last.scopeItemId !== entry.scopeItemId ||
          entry.paragraphStart === true ||
          (known
            ? last.sentenceId !== entry.sentenceId
            : last.speaker !== entry.speaker || entry.start - last.end > PAUSE_SECONDS || SENTENCE_END.test(last.text.trim())));
      if (split) {
        runs.push(run);
        run = [];
      }
      run.push(entry);
    }
    if (run.length > 0) runs.push(run);
    segments = runs.map((words, i) => ({
      id: words[0]!.sentenceId !== undefined ? `${words[0]!.scopeItemId ?? ''}:${words[0]!.sentenceId}` : `run-${i + 1}`,
      start: words[0]!.start,
      end: Math.max(...words.map((w) => w.end)),
      text: joinWords(
        words.map((w) => w.text),
        leading,
      ),
      speaker: speakerOf(words[0]!.speaker),
      translation: null,
      sentenceId: words[0]!.sentenceId ?? null,
      paragraphStart: words[0]!.paragraphStart === true || i === 0 || words[0]!.speaker !== runs[i - 1]!.at(-1)!.speaker,
      words: words.map((w) => ({ id: w.id, text: w.text.trim(), start: w.start, end: w.end, timed: w.wordTiming })),
    }));
  }
  attachSecondary(input, segments, warnings, translation);
  return segments;
}

function attachSecondary(
  input: Pick<TextExportInput, 'primary' | 'secondary'>,
  segments: TextSegment[],
  warnings: JobWarning[],
  translation: Translation | null,
): void {
  const secondary = input.secondary;
  if (!secondary) return;
  if (secondary.plan === null) {
    if (!translation) return;
    const body = input.primary.document.body as SpeechBody | null;
    const members = input.primary.plan.unit !== 'speech' ? null : (translation.members ?? sentenceMembers(body));
    const unplaceable = members ? unplaceableWords(body) : new Set<string>();
    let partial = 0;
    for (const segment of segments) {
      const unitId = segment.sentenceId;
      if (unitId === null) continue;
      const text = translation.texts.get(unitId);
      if (!text) continue;
      if (members) {
        // A sentence that is only partly kept after cutting is not matched to its whole-sentence translation (format spec §5.7). Words that can't fit on a caption (zero duration, no text) are not counted as cut, and neither side counts them.
        const expected = new Set([...(members.get(unitId) ?? [])].filter((id) => !unplaceable.has(id)));
        const present = new Set((segment.words ?? []).map((w) => w.id).filter((id) => !unplaceable.has(id)));
        if (!members.has(unitId) || expected.size !== present.size || [...expected].some((id) => !present.has(id))) {
          partial++;
          continue;
        }
      }
      segment.translation = text;
    }
    if (partial > 0) warn(warnings, 'TRANSLATION_SKIPPED_PARTIAL_SENTENCE', RcExport.translationPartialSkipped({ count: partial }));
    if (translation.stale > 0)
      warn(warnings, 'TRANSLATION_SKIPPED_STALE', RcExport.translationStale({ count: translation.stale }));
    return;
  }
  // Another document with timing: each entry is assigned to the sentence containing its midpoint.
  const other = segmentsOf({ primary: { document: secondary.document, plan: secondary.plan }, secondary: null }, warnings);
  const buckets = new Map<TextSegment, string[]>();
  let unmatched = 0;
  for (const item of other) {
    const mid = (item.start + item.end) / 2;
    const owner = segments.find((s) => mid >= s.start && mid < s.end);
    if (!owner) {
      unmatched++;
      continue;
    }
    buckets.set(owner, [...(buckets.get(owner) ?? []), item.text]);
  }
  for (const [segment, texts] of buckets) segment.translation = texts.join(' ');
  if (unmatched > 0) warn(warnings, 'BILINGUAL_UNMATCHED', RcExport.bilingualUnmatched({ count: unmatched }));
}

// ---- Caption cues ----

function cuesOf(segments: TextSegment[], maxWidth: number, warnings: JobWarning[]): Cue[] {
  const cues: Cue[] = [];
  const capacity = maxWidth * EXPORT_MAX_LINES_PER_CUE;
  let estimatedSplits = 0;
  for (const segment of segments) {
    const secondary = segment.translation ? wrapLines(segment.translation, maxWidth) : [];
    // A caption document has no word timing, and bilingual sentences must be aligned with translations: neither is split, so each whole sentence is one cue.
    const fits = displayWidth(segment.text) <= capacity && segment.end - segment.start <= EXPORT_MAX_CUE_SECONDS;
    if (!segment.words || segment.translation !== null || fits) {
      cues.push({ start: segment.start, end: segment.end, lines: wrapLines(segment.text, maxWidth), secondary });
      continue;
    }
    const before = cues.length;
    const leading = segment.words.some((w) => /^\s/.test(w.text));
    let group: TextWord[] = [];
    const flush = () => {
      if (group.length === 0) return;
      const text = joinWords(
        group.map((w) => w.text),
        leading,
      );
      cues.push({ start: group[0]!.start, end: Math.max(...group.map((w) => w.end)), lines: wrapLines(text, maxWidth), secondary: [] });
      group = [];
    };
    for (const word of segment.words) {
      const candidate = joinWords([...group.map((w) => w.text), word.text], leading);
      const tooWide = group.length > 0 && displayWidth(candidate) > capacity;
      const tooLong = group.length > 0 && word.end - group[0]!.start > EXPORT_MAX_CUE_SECONDS;
      if (tooWide || tooLong) {
        // Try to break at punctuation: fall back to after the last word in the group that ends with punctuation.
        const punct = group.findLastIndex((w, i) => i > 0 && /[,，、;；:：.。!！?？]$/u.test(w.text));
        if (punct > 0 && punct < group.length - 1) {
          const carry = group.slice(punct + 1);
          group = group.slice(0, punct + 1);
          flush();
          group = carry;
        } else flush();
      }
      group.push(word);
    }
    flush();
    if (cues.length - before > 1 && segment.words.some((w) => !w.timed)) estimatedSplits++;
  }
  if (estimatedSplits > 0) {
    warn(warnings, 'CUE_SPLIT_AT_ESTIMATED_TIMES', RcExport.cueSplitEstimated({ count: estimatedSplits }));
  }
  return cues;
}

/** Rounds times to the format's time unit (milliseconds or centiseconds), then repairs them: the end is not earlier than the start, and the cue does not overlap the next one. */
function quantize(cues: Cue[], unitsPerSecond: number): Array<Cue & { a: number; b: number }> {
  const sorted = [...cues].sort((x, y) => x.start - y.start || x.end - y.end);
  const out = sorted.map((cue) => ({ ...cue, a: Math.round(cue.start * unitsPerSecond), b: Math.round(cue.end * unitsPerSecond) }));
  for (let i = 0; i < out.length; i++) {
    const cue = out[i]!;
    const next = out[i + 1];
    if (next && cue.b > next.a) cue.b = next.a;
    if (cue.b <= cue.a) cue.b = cue.a + 1;
    if (next && next.a < cue.b) next.a = cue.b;
  }
  return out;
}

function clock(units: number, unitsPerSecond: number, separator: string, hourDigits = 2): string {
  const fracDigits = unitsPerSecond === 1000 ? 3 : 2;
  const totalSeconds = Math.floor(units / unitsPerSecond);
  const frac = units - totalSeconds * unitsPerSecond;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(hourDigits, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(frac).padStart(fracDigits, '0')}`;
}

/** SRT text: a blank line ends the cue, and `-->` would be read as a timing line. */
function srtText(line: string): string {
  return line.replace(/-->/g, '→').trim();
}

function vttText(line: string): string {
  return line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

/** Records a task warning. The text is in the current language, with a reference attached. */
function warn(warnings: JobWarning[], code: string, detail: Localized): void {
  warnings.push({ code, detail: detail.text, detailRef: refOf(detail) });
}

function assText(line: string): string {
  // i18n-ignore: full-width substitute characters used for ASS escaping
  return line.replace(/\\/g, '＼').replace(/\{/g, '｛').replace(/\}/g, '｝').trim();
}

function writeSrt(cues: Cue[]): { content: string; entries: number; end: number } {
  const timed = quantize(cues, 1000).filter((c) => c.lines.length > 0);
  const blocks = timed.map(
    (c, i) => `${i + 1}\n${clock(c.a, 1000, ',')} --> ${clock(c.b, 1000, ',')}\n${[...c.lines, ...c.secondary].map(srtText).join('\n')}\n`,
  );
  return { content: blocks.join('\n'), entries: timed.length, end: (timed.at(-1)?.b ?? 0) / 1000 };
}

function writeVtt(cues: Cue[]): { content: string; entries: number; end: number } {
  const timed = quantize(cues, 1000).filter((c) => c.lines.length > 0);
  const blocks = timed.map(
    (c) => `${clock(c.a, 1000, '.')} --> ${clock(c.b, 1000, '.')}\n${[...c.lines, ...c.secondary].map(vttText).join('\n')}\n`,
  );
  return { content: ['WEBVTT\n', ...blocks].join('\n'), entries: timed.length, end: (timed.at(-1)?.b ?? 0) / 1000 };
}

function writeAss(cues: Cue[], input: TextExportInput, warnings: JobWarning[]): { content: string; entries: number; end: number } {
  const timed = quantize(cues, 100).filter((c) => c.lines.length > 0);
  const mapping = assStyleMapping(input.style, input.canvas);
  if (mapping.unmapped.length > 0) {
    const styles = mapping.unmapped.join(RcExport.listSeparator().text);
    warn(warnings, 'ASS_STYLE_UNMAPPED', RcExport.assStyleUnmapped({ styles }));
  }
  const events = timed.map((c) => {
    const source = c.lines.map(assText).join('\\N');
    const translation = c.secondary.length > 0 ? `{\\rTranslation}${c.secondary.map(assText).join('\\N')}` : null;
    const text =
      translation === null ? source : mapping.translationFirst ? `${translation}\\N{\\rDefault}${source}` : `${source}\\N${translation}`;
    return `Dialogue: 0,${clock(c.a, 100, '.', 1)},${clock(c.b, 100, '.', 1)},Default,,0,0,0,,${text}`;
  });
  const content = [
    '[Script Info]',
    `Title: ${assText(input.meta.videoName)}`,
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${input.canvas.width}`,
    `PlayResY: ${input.canvas.height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    mapping.styles.default,
    mapping.styles.translation,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
  return { content, entries: timed.length, end: (timed.at(-1)?.b ?? 0) / 100 };
}

function writeJson(input: TextExportInput, segments: TextSegment[]): { content: string; entries: number; end: number } {
  const { primary, secondary, meta } = input;
  let timed = 0;
  let untimed = 0;
  const out = segments.map((s) => {
    const allTimed = s.words !== null && s.words.length > 0 && s.words.every((w) => w.timed);
    if (s.words !== null) {
      if (allTimed) timed++;
      else untimed++;
    }
    return {
      id: s.id,
      start: round3(s.start),
      end: round3(s.end),
      text: s.text,
      ...(s.speaker && input.speakers !== false ? { speaker: s.speaker } : {}),
      ...(s.translation ? { translation: s.translation } : {}),
      ...(s.paragraphStart ? { paragraphStart: true } : {}),
      // Per-word times are written only when every word's time is trustworthy (acceptance AT-05).
      ...(allTimed ? { words: s.words!.map((w) => ({ id: w.id, text: w.text, start: round3(w.start), end: round3(w.end) })) } : {}),
    };
  });
  const body = {
    schema: 'cuccut.export.text/1',
    video: { id: meta.videoId, name: meta.videoName, revision: meta.videoRevision },
    sequence: { id: meta.sequenceId, revision: meta.sequenceRevision },
    document: {
      id: primary.document.documentId,
      kind: primary.document.kind,
      language: primary.document.language,
      revision: primary.document.revision,
    },
    ...(secondary
      ? {
          translation: {
            id: secondary.document.documentId,
            kind: secondary.document.kind,
            language: secondary.document.language,
            revision: secondary.document.revision,
          },
        }
      : {}),
    /** Times are seconds relative to the start of the export range. */
    duration: round3(input.rangeDuration),
    wordTiming: timed > 0 && untimed === 0 ? 'word' : timed > 0 ? 'partial' : 'none',
    segments: out,
  };
  return { content: `${JSON.stringify(body, null, 2)}\n`, entries: out.length, end: Math.max(0, ...out.map((s) => s.end)) };
}

interface Paragraph {
  start: number;
  speaker: string | null;
  text: string;
  translation: string | null;
}

/**
 * Splits sentences into paragraphs using the same rules as the editor's script panel (`TRANSCRIPT_PARAGRAPH`): break where a paragraph start is marked, where the speaker changes, or where the pause is long enough. Also break at a sentence end when the paragraph is already long enough (or the pause is somewhat long and the paragraph isn't too short). Transcripts usually don't store paragraphs, so when split only by paragraph starts and speakers, a monologue becomes one whole paragraph.
 * When writing chapter subheadings, a break is also made at the start of each chapter (`breaks`), so a subheading never falls in the middle of a paragraph.
 */
function paragraphsOf(segments: TextSegment[], breaks: readonly number[] = []): Paragraph[] {
  const paragraphs: Array<{ start: number; speaker: string | null; parts: TextSegment[]; width: number }> = [];
  for (const segment of segments) {
    const last = paragraphs.at(-1);
    const prev = last?.parts.at(-1);
    const gap = prev ? segment.start - prev.end : 0;
    const ended = prev ? SENTENCE_END.test(prev.text) : false;
    const chapter = prev ? breaks.some((at) => prev.start < at && segment.start >= at) : false;
    if (
      !last ||
      segment.paragraphStart ||
      chapter ||
      segment.speaker !== last.speaker ||
      gap >= TRANSCRIPT_PARAGRAPH.pauseSec ||
      (ended &&
        (last.width >= TRANSCRIPT_PARAGRAPH.maxWidth ||
          (gap >= TRANSCRIPT_PARAGRAPH.sentencePauseSec && last.width >= TRANSCRIPT_PARAGRAPH.minWidth)))
    ) {
      paragraphs.push({ start: segment.start, speaker: segment.speaker, parts: [segment], width: [...segment.text].length });
    } else {
      last.parts.push(segment);
      last.width += 1 + [...segment.text].length;
    }
  }
  return paragraphs.map((p) => ({
    start: p.start,
    speaker: p.speaker,
    text: joinSentences(p.parts.map((s) => s.text)),
    translation: p.parts.some((s) => s.translation) ? joinSentences(p.parts.map((s) => s.translation ?? '').filter(Boolean)) : null,
  }));
}

function joinSentences(texts: string[]): string {
  return joinWords(texts, false);
}

/** One value of the front matter: folded onto one line, then written as a double-quoted JSON string (a valid YAML scalar). */
function yamlQuote(value: string): string {
  return JSON.stringify(oneLine(value));
}

const FRONT_MATTER_KEYS = [
  'title',
  'description',
  'source',
  'author',
  'published',
  'platform',
  'duration',
  'language',
  'translation',
] as const;

/** Front matter: one line per field between `---` lines, missing fields omitted. It is followed by the speakers that appear in the body and the chapter table (`[mm:ss] chapter name`). */
function frontMatterBlock(meta: FrontMatter, speakers: string[], chapters: TextChapter[]): string {
  const lines = ['---'];
  for (const key of FRONT_MATTER_KEYS) {
    const value = meta[key]?.trim();
    if (value) lines.push(`${key}: ${yamlQuote(value)}`);
  }
  if (speakers.length > 0) lines.push('speakers:', ...speakers.map((name) => `  - ${yamlQuote(name)}`));
  if (chapters.length > 0) lines.push('chapters:', ...chapters.map((c) => `  - ${yamlQuote(`[${transcriptStamp(c.start)}] ${c.title}`)}`));
  lines.push('---');
  return lines.join('\n');
}

/** A paragraph of the script. If this paragraph starts a new chapter, that chapter is included (its subheading is written before the paragraph). */
interface TranscriptBlock {
  chapter: TextChapter | null;
  paragraph: Paragraph;
}

/** Assigns chapters to paragraphs: each chapter's subheading goes before the first paragraph that starts at (or after) its start. Chapters with no paragraphs are not written. */
function transcriptBlocks(input: TextExportInput, segments: TextSegment[]): TranscriptBlock[] {
  const chapters = input.chapters ?? [];
  const paragraphs = paragraphsOf(
    segments,
    chapters.map((c) => c.start),
  );
  let current = -1;
  return paragraphs.map((paragraph) => {
    const index = chapters.findLastIndex((c) => c.start <= paragraph.start + 1e-6);
    const chapter = index >= 0 && index !== current ? chapters[index]! : null;
    if (index >= 0) current = index;
    return { chapter, paragraph };
  });
}

/** The speakers listed at the top: when speakers are on, those that appear in the body, in order of first appearance. */
function speakersOf(input: TextExportInput, blocks: TranscriptBlock[]): string[] {
  if (input.speakers === false) return [];
  return [...new Set(blocks.map((b) => b.paragraph.speaker).filter((s): s is string => s !== null))];
}

function writeMarkdown(input: TextExportInput, segments: TextSegment[]): { content: string; entries: number; end: number } {
  const blocks = transcriptBlocks(input, segments);
  const labels = input.speakers !== false;
  const out: string[] = [];
  if (input.frontMatter) out.push(frontMatterBlock(input.frontMatter, speakersOf(input, blocks), input.chapters ?? []));
  out.push(`# ${markdownText(input.meta.videoName)}`);
  for (const { chapter, paragraph: p } of blocks) {
    if (chapter) out.push(`## ${markdownText(oneLine(chapter.title))}${input.timestamps ? ` · ${transcriptStamp(chapter.start)}` : ''}`);
    const speaker = labels && p.speaker ? `**${markdownText(p.speaker)}:** ` : '';
    out.push(`${speaker}${markdownText(p.text)}${input.timestamps ? ` [${transcriptStamp(p.start)}]` : ''}`);
    if (p.translation) out.push(`> ${markdownText(p.translation)}`);
  }
  return { content: `${out.join('\n\n')}\n`, entries: blocks.length, end: Math.max(0, ...segments.map((s) => s.end)) };
}

function writeText(input: TextExportInput, segments: TextSegment[]): { content: string; entries: number; end: number; headings: number } {
  const blocks = transcriptBlocks(input, segments);
  const labels = input.speakers !== false;
  const out: string[] = [];
  let headings = 0;
  for (const { chapter, paragraph: p } of blocks) {
    if (chapter) {
      out.push(`— ${oneLine(chapter.title)} —`);
      headings++;
    }
    const speaker = labels && p.speaker ? `${p.speaker}: ` : '';
    const head = `${speaker}${p.text}${input.timestamps ? ` [${transcriptStamp(p.start)}]` : ''}`;
    out.push(p.translation ? `${head}\n${p.translation}` : head);
  }
  return { content: `${out.join('\n\n')}\n`, entries: blocks.length, end: Math.max(0, ...segments.map((s) => s.end)), headings };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Writes out one caption or script file. */
export function renderText(input: TextExportInput): TextExportOutput {
  const warnings: JobWarning[] = [];
  const maxWidth = input.maxCharsPerLine ?? EXPORT_MAX_CHARS_PER_LINE;
  const segments = segmentsOf(input, warnings).filter((s) => s.text.length > 0);
  let written: { content: string; entries: number; end: number; headings?: number };
  switch (input.format) {
    case 'srt':
      written = writeSrt(cuesOf(segments, maxWidth, warnings));
      break;
    case 'vtt':
      written = writeVtt(cuesOf(segments, maxWidth, warnings));
      break;
    case 'ass':
      written = writeAss(cuesOf(segments, maxWidth, warnings), input, warnings);
      break;
    case 'json':
      written = writeJson(input, segments);
      break;
    case 'md':
      written = writeMarkdown(input, segments);
      break;
    case 'txt':
      written = writeText(input, segments);
      break;
  }
  const text = segments.map((s) => s.text).join(' ');
  return {
    content: written.content,
    entries: written.entries,
    durationSec: written.end,
    words: (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length,
    cjkCharacters: (text.match(/[一-鿿]/g) ?? []).length,
    headings: written.headings ?? 0,
    warnings,
    rangeSec: input.rangeDuration,
  };
}

// ---- Validation: parse back by format ----

export interface TextCheck {
  ok: boolean;
  problems: string[];
  entries: number;
  durationSec: number;
}

const SRT_TIME = /^(\d{2,}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2,}):(\d{2}):(\d{2}),(\d{3})$/;
const VTT_TIME = /^(\d{2,}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2,}):(\d{2}):(\d{2})\.(\d{3})$/;
const ASS_TIME = /^Dialogue: \d+,(\d+):(\d{2}):(\d{2})\.(\d{2}),(\d+):(\d{2}):(\d{2})\.(\d{2}),/;

function seconds(m: RegExpExecArray, offset: number, fraction: number): number {
  return Number(m[offset]) * 3600 + Number(m[offset + 1]) * 60 + Number(m[offset + 2]) + Number(m[offset + 3]) / fraction;
}

/** Parses the written file and checks the entry count, monotonic times, end later than start, and nothing beyond the range. */
export function checkText(
  format: TextFormat,
  content: string,
  expected: { entries: number; durationSec: number; /** The number of blocks of chapter subheadings in plain text (`TextExportOutput.headings`). */ headings?: number },
): TextCheck {
  const problems: string[] = [];
  const times: Array<[number, number]> = [];
  let entries = 0;
  if (format === 'srt' || format === 'vtt') {
    const lines = content.split('\n');
    if (format === 'vtt' && lines[0] !== 'WEBVTT') problems.push(RcExport.vttMissingHeader().text);
    const pattern = format === 'srt' ? SRT_TIME : VTT_TIME;
    const blocks = content.split(/\n\n+/).filter((b) => b.trim() && b.trim() !== 'WEBVTT');
    for (const block of blocks) {
      const rows = block.split('\n').filter(Boolean);
      const timeRow = format === 'srt' ? rows[1] : rows[0];
      if (format === 'srt' && !/^\d+$/.test(rows[0] ?? '')) problems.push(RcExport.cueMissingIndex({ n: entries + 1 }).text);
      const m = pattern.exec(timeRow ?? '');
      if (!m) {
        problems.push(RcExport.cueTimeLineUnparsable({ n: entries + 1 }).text);
        continue;
      }
      if (rows.length < (format === 'srt' ? 3 : 2)) problems.push(RcExport.cueNoText({ n: entries + 1 }).text);
      times.push([seconds(m, 1, 1000), seconds(m, 5, 1000)]);
      entries++;
    }
  } else if (format === 'ass') {
    if (!content.startsWith('[Script Info]') || !content.includes('[Events]')) problems.push(RcExport.assMissingSections().text);
    for (const line of content.split('\n')) {
      if (!line.startsWith('Dialogue:')) continue;
      const m = ASS_TIME.exec(line);
      if (!m) {
        problems.push(RcExport.cueTimeUnparsable({ n: entries + 1 }).text);
        continue;
      }
      times.push([seconds(m, 1, 100), seconds(m, 5, 100)]);
      entries++;
    }
  } else if (format === 'json') {
    try {
      const parsed = JSON.parse(content) as {
        segments?: Array<{ start: number; end: number; words?: Array<{ start: number; end: number }> }>;
      };
      for (const s of parsed.segments ?? []) {
        times.push([s.start, s.end]);
        for (const w of s.words ?? [])
          if (!(w.end >= w.start && w.start >= s.start - 0.001 && w.end <= s.end + 0.001)) problems.push(RcExport.wordTimeOutsideSentence().text);
        entries++;
      }
    } catch {
      problems.push(RcExport.invalidJson().text);
    }
  } else {
    // Blocks other than paragraphs: front matter, headings, chapter subheadings, and translations (Markdown: `#` and `>` in the body are escaped, so they are recognized by their start).
    // Plain-text chapter subheadings are subtracted by the number of blocks written, since body text can look exactly like a subheading (“— aside —”).
    const blocks = content.split(/\n\n+/).filter((b) => b.trim());
    entries =
      format === 'md'
        ? blocks.filter((b) => !b.startsWith('---\n') && !b.startsWith('# ') && !b.startsWith('## ') && !b.startsWith('> ')).length
        : blocks.length - (expected.headings ?? 0);
  }
  for (let i = 0; i < times.length; i++) {
    const [a, b] = times[i]!;
    if (!(b > a)) problems.push(RcExport.cueEndNotAfterStart({ n: i + 1 }).text);
    if (i > 0 && format !== 'json' && a < times[i - 1]![1] - 1e-9) problems.push(RcExport.cueOverlapsPrevious({ n: i + 1 }).text);
  }
  const durationSec = Math.max(0, ...times.map(([, b]) => b));
  if (durationSec > expected.durationSec + 0.001)
    problems.push(RcExport.lastCueBeyondRange({ end: durationSec, range: expected.durationSec }).text);
  if (entries !== expected.entries) problems.push(RcExport.entryCountMismatch({ parsed: entries, written: expected.entries }).text);
  if (entries === 0) problems.push(RcExport.noContent().text);
  return { ok: problems.length === 0, problems, entries, durationSec };
}

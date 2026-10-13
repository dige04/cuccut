import { defineMessages, transcriptMarkdownText, transcriptOneLine, transcriptStamp } from '@cuccut/protocol';
import type { TextRange } from './text-find.ts';
import { editWordText, rawWordId, type TranscriptWord } from './transcript-cut.ts';
import { readTranslation, speechSentences, unitText } from './translation-doc.ts';
import { zhHans } from './transcript-text.zh-Hans.ts';
import { zhHant } from './transcript-text.zh-Hant.ts';
import { ja } from './transcript-text.ja.ts';
import { ko } from './transcript-text.ko.ts';
import { es } from './transcript-text.es.ts';
import { fr } from './transcript-text.fr.ts';
import { de } from './transcript-text.de.ts';
import { nl } from './transcript-text.nl.ts';
import { ptBR } from './transcript-text.pt-BR.ts';
import { it } from './transcript-text.it.ts';
import { ru } from './transcript-text.ru.ts';
import { pl } from './transcript-text.pl.ts';
import { tr } from './transcript-text.tr.ts';
import { vi } from './transcript-text.vi.ts';

/**
 * Plain text of the transcript: copy, find-and-replace and the translation view all take it from here (design draft model-transcript.js `paraText` / `copyText` / `copyReceipt`,
 * panels.jsx `TranscriptPanel` find).
 *
 * - A paragraph's text is assembled as shown on screen: each word is trimmed of leading and trailing whitespace, and a `spaced` word gets a space in front. Words that are fully cut are not counted (same rule as export and the edited state).
 * Replacement lands on the words of the transcript body (`editWordText`, timeline untouched): when the match lies within one word, only that word changes; when it spans several words, the replacement text is split on whitespace, and if the number of pieces equals the number of original words they map one to one, otherwise the whole text goes to the first word and the rest are hidden. When the match covers the space between words, the words on both sides count too.
 * Translations map to paragraphs by sentence: a sentence belongs to the paragraph containing its first word, and the translations of the sentences in a paragraph are joined in order.
 */

/** Copy receipt (translations are in `transcript-text.<lang>.ts`). */
const en = {
  receipt: (paragraphs: number, amount: string) => `${paragraphs} ${paragraphs === 1 ? 'paragraph' : 'paragraphs'} · ${amount}`,
  characters: (n: number) => `${n} ${n === 1 ? 'character' : 'characters'}`,
  words: (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`,
};
export type TranscriptTextMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

type Json = Record<string, unknown>;

/** Timecode for copy and quotes: the same format as the exported transcript (`mm:ss`, rounded down; `hh:mm:ss` for an hour or more). */
export const timeStamp = transcriptStamp;

// ---- Paragraph text ----

/** Position of a word in the paragraph text (start inclusive, end exclusive). */
export interface WordSpan extends TextRange {
  id: string;
  index: number;
}

export interface ParagraphText {
  text: string;
  words: WordSpan[];
}

type TextWord = Pick<TranscriptWord, 'id' | 'index' | 'text' | 'spaced' | 'state'>;

/** Text of a paragraph, or of a run of selected words. With `withCut`, cut words are included (selection copy copies what is selected). */
export function paragraphText(words: readonly TextWord[], withCut = false): ParagraphText {
  let text = '';
  const spans: WordSpan[] = [];
  for (const word of words) {
    if (!withCut && word.state === 'cut') continue;
    const value = word.text.trim();
    if (!value) continue;
    if (spans.length && word.spaced) text += ' ';
    spans.push({ id: word.id, index: word.index, start: text.length, end: text.length + value.length });
    text += value;
  }
  return { text, words: spans };
}

/** How a find match lands on a word: the segments inside the word (offsets relative to the word), and whether the space before it is marked too (0 = not marked, 1 = marked, 2 = the current match). */
export interface WordHighlight {
  ranges: Array<{ start: number; end: number; current: boolean }>;
  gap: 0 | 1 | 2;
}

/** A paragraph's matches (ranges on `para.text`) spread onto words, keyed by word index (`TranscriptWord.index`). */
export function wordHighlights(para: ParagraphText, marks: readonly (TextRange & { current?: boolean })[]): Map<number, WordHighlight> {
  const out = new Map<number, WordHighlight>();
  const of = (index: number) => {
    let found = out.get(index);
    if (!found) out.set(index, (found = { ranges: [], gap: 0 }));
    return found;
  };
  for (const mark of marks) {
    let prevEnd: number | null = null;
    for (const word of para.words) {
      if (prevEnd !== null && word.start > prevEnd && mark.start < word.start && mark.end > prevEnd) {
        const found = of(word.index);
        found.gap = mark.current ? 2 : found.gap === 2 ? 2 : 1;
      }
      const start = Math.max(mark.start, word.start);
      const end = Math.min(mark.end, word.end);
      if (start < end) of(word.index).ranges.push({ start: start - word.start, end: end - word.start, current: !!mark.current });
      prevEnd = word.end;
    }
  }
  return out;
}

// ---- Replace ----

/** Words touched by one match (indices into `para.words`, ascending): the words whose characters overlap, plus the words on either side of a word-gap space covered by the match. */
function touched(para: ParagraphText, range: TextRange): number[] {
  const hit = new Set<number>();
  para.words.forEach((word, k) => {
    if (word.start < range.end && word.end > range.start) hit.add(k);
    const prev = para.words[k - 1];
    if (prev && prev.end < word.start && range.start <= prev.end && range.end >= word.start) {
      hit.add(k - 1);
      hit.add(k);
    }
  });
  return [...hit].sort((a, b) => a - b);
}

/**
 * Applies several replacements within one paragraph (matches come from `findRanges(para.text, …)` and do not overlap), rewriting the corresponding words in the transcript body. Returns the new body and how many places were actually changed;
 * null when nothing changed. Replacement text is inserted literally.
 */
export function replaceInParagraph(
  body: unknown,
  para: ParagraphText,
  ranges: readonly TextRange[],
  replacement: string,
): { body: Json; changed: number } | null {
  // Touched words are grouped into blocks: several matches on the same word, or consecutive ones, merge into one block that is changed together.
  const clusters: Array<{ from: number; to: number; ranges: TextRange[] }> = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const words = touched(para, range);
    if (!words.length) continue;
    const from = words[0]!;
    const to = words.at(-1)!;
    const last = clusters.at(-1);
    if (last && from <= last.to) {
      last.to = Math.max(last.to, to);
      last.ranges.push(range);
    } else clusters.push({ from, to, ranges: [range] });
  }
  const next = new Map<number, string>();
  let changed = 0;
  for (const cluster of clusters) {
    const first = para.words[cluster.from]!;
    const end = para.words[cluster.to]!.end;
    const before = para.text.slice(first.start, end);
    let after = before;
    for (const range of [...cluster.ranges].sort((a, b) => b.start - a.start)) {
      const start = Math.max(range.start, first.start) - first.start;
      const stop = Math.min(range.end, end) - first.start;
      if (after.slice(start, stop) !== replacement) changed++;
      after = after.slice(0, start) + replacement + after.slice(stop);
    }
    const count = cluster.to - cluster.from + 1;
    const tokens = after.trim() ? after.trim().split(/\s+/) : [];
    if (count === 1) next.set(cluster.from, after);
    else if (before.split(/\s+/).length === count && tokens.length === count) tokens.forEach((token, n) => next.set(cluster.from + n, token));
    else for (let k = cluster.from; k <= cluster.to; k++) next.set(k, k === cluster.from ? after : '');
  }
  let doc: Json | null = null;
  for (const k of [...next.keys()].sort((a, b) => b - a)) {
    const word = para.words[k]!;
    if (next.get(k) === para.text.slice(word.start, word.end)) continue;
    doc = editWordText(doc ?? body, word.id, next.get(k)!) ?? doc;
  }
  return doc && changed ? { body: doc, changed } : null;
}

// ---- Copy ----

/** Language views of the transcript: source, translation only, or bilingual side by side (source on one line, translation on the next). */
export type TranscriptView = 'source' | 'translation' | 'both';

export interface CopyParagraph {
  /** Start time of the paragraph on the sequence (seconds). */
  start: number;
  speaker: string | null;
  text: string;
  translation: string;
}

/** A paragraph's text in one view; bilingual gives two lines, not merged into one sentence. */
export function viewText(para: Pick<CopyParagraph, 'text' | 'translation'>, view: TranscriptView): string {
  if (view === 'translation') return para.translation;
  if (view === 'both') return [para.text, para.translation].filter(Boolean).join('\n');
  return para.text;
}

/** Text only (“Copy text only” and selection copy): paragraphs separated by a blank line, without speaker or time. */
export function copyText(paras: readonly CopyParagraph[], options: { view: TranscriptView }): string {
  return paras.map((para) => viewText(para, options.view)).join('\n\n');
}

/** A section of the transcript: the chapter (null before the first chapter, or when no chapters are written) and the paragraphs that belong to it. */
export interface CopySection {
  chapter: { title: string; start: number } | null;
  paras: readonly CopyParagraph[];
}

export interface TranscriptWriteOptions {
  format: 'md' | 'txt';
  view: TranscriptView;
  speakers: boolean;
  timestamps: boolean;
  /** The top-level Markdown heading at the start (the video name); not written for excerpts (this paragraph, this chapter). */
  title?: string | null;
}

/**
 * Lays out sections of paragraphs in the same form as the exported transcript (command and protocol spec §4.4; line-by-line counterpart of `writeMarkdown` / `writeText` in the Runtime's text-export.ts):
 * copying this paragraph or this chapter, and the full text in translation-only view. The Runtime cannot lay these out (range exports count time from the range start, and Markdown always carries a heading;
 * the main document does not include translations). Other full-text copies go through `exports.renderText`, byte-identical to the exported file.
 *
 * - Markdown: chapter `## Name` (with ` · mm:ss` when timestamps are shown), paragraph `**Speaker:** text [mm:ss]`, bilingual translation as its own block `> translation`; markup characters escaped.
 * - Plain text: chapter `— Name —`, paragraph `Speaker: text [mm:ss]`, bilingual translation on the line right after.
 * - In translation-only view the translation is written as body text; paragraphs with an empty body are not written, and chapters with no paragraphs are not written. One blank line between blocks, no trailing newline.
 */
export function writeTranscript(sections: readonly CopySection[], options: TranscriptWriteOptions): string {
  const md = options.format === 'md';
  const stamp = (seconds: number) => (options.timestamps ? transcriptStamp(seconds) : null);
  const out: string[] = [];
  if (md && options.title) out.push(`# ${transcriptMarkdownText(options.title)}`);
  for (const section of sections) {
    const paras = section.paras.filter((p) => (options.view === 'translation' ? p.translation : p.text).trim());
    if (!paras.length) continue;
    const chapter = section.chapter;
    if (chapter) {
      const at = stamp(chapter.start);
      out.push(md ? `## ${transcriptMarkdownText(transcriptOneLine(chapter.title))}${at ? ` · ${at}` : ''}` : `— ${transcriptOneLine(chapter.title)} —`);
    }
    for (const p of paras) {
      const text = options.view === 'translation' ? p.translation : p.text;
      const translation = options.view === 'both' ? p.translation : '';
      const at = stamp(p.start);
      const end = at ? ` [${at}]` : '';
      const speaker = options.speakers ? p.speaker : null;
      if (md) {
        out.push(`${speaker ? `**${transcriptMarkdownText(speaker)}:** ` : ''}${transcriptMarkdownText(text)}${end}`);
        if (translation) out.push(`> ${transcriptMarkdownText(translation)}`);
      } else {
        const head = `${speaker ? `${speaker}: ` : ''}${text}${end}`;
        out.push(translation ? `${head}\n${translation}` : head);
      }
    }
  }
  return out.join('\n\n');
}

/** Groups paragraphs into sections by chapter: a paragraph belongs to the last chapter that has already started when it starts (same rule as export). `chapters` is sorted by start. */
export function chapterSections(paras: readonly CopyParagraph[], chapters: readonly { title: string; start: number }[]): CopySection[] {
  const out: { chapter: CopySection['chapter']; paras: CopyParagraph[] }[] = [];
  let current = -1;
  for (const para of paras) {
    const index = chapters.findLastIndex((c) => c.start <= para.start + 1e-6);
    const heading = index >= 0 && index !== current;
    if (index >= 0) current = index;
    const last = out.at(-1);
    if (last && !heading) last.paras.push(para);
    else out.push({ chapter: heading ? chapters[index]! : null, paras: [para] });
  }
  return out;
}

/** Copy receipt: paragraph count plus length. Chinese is counted by character, Latin-script text by word (the “amount” of the two languages is not the same kind of thing); whichever count is larger decides the unit used. */
export function copyReceipt(paras: readonly Pick<CopyParagraph, 'text' | 'translation'>[], view: TranscriptView): string {
  const text = paras.map((para) => viewText(para, view)).join('');
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  const words = (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length;
  return lengthReceipt(paras.length, cjk, words);
}

/** “N 段 · M 字” (N paragraphs · M characters): reports characters when Han characters outnumber Latin words, otherwise words (the export panel's length uses the character and word counts computed by the Runtime). */
export function lengthReceipt(paragraphs: number, cjkCharacters: number, words: number): string {
  return M.receipt(paragraphs, cjkCharacters >= words ? M.characters(cjkCharacters) : M.words(words));
}

// ---- Translation ----

const CJK_END = /[　-〿぀-ヿ㐀-鿿＀-￯]$/u;

/**
 * Each paragraph's translation (one to one with `paragraphs`; a paragraph with no translation is an empty string). Sentences come from the transcript body (when sentences are not stored, they are derived from pauses and sentence-ending punctuation,
 * the same way as at translation time), and a sentence belongs to the paragraph containing its first word still in the transcript. null when the body cannot be recognised.
 */
export function paragraphTranslations(
  speechBody: unknown,
  translationBody: unknown,
  paragraphs: readonly { words: readonly { id: string }[] }[],
): string[] | null {
  const sentences = speechSentences(speechBody);
  const translation = readTranslation(translationBody);
  if (!sentences || !translation) return null;
  const owner = new Map<string, number>();
  paragraphs.forEach((para, n) => {
    for (const word of para.words) if (!owner.has(rawWordId(word.id))) owner.set(rawWordId(word.id), n);
  });
  const units = new Map(translation.units.map((unit) => [unit.sourceSentenceId, unit]));
  const out = paragraphs.map(() => '');
  for (const sentence of sentences) {
    const unit = units.get(sentence.id);
    const text = unit ? unitText(unit) : '';
    if (!text) continue;
    const at = sentence.wordIds.map((id) => owner.get(id)).find((n) => n !== undefined);
    if (at === undefined) continue;
    const prev = out[at]!;
    out[at] = !prev ? text : CJK_END.test(prev) ? prev + text : `${prev} ${text}`;
  }
  return out;
}

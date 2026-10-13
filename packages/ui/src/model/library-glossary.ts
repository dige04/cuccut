import { defineMessages, live, type GlossaryContent, type TranscriptionGlossary, type TranslationGlossary } from '@cuccut/protocol';
import { languageName } from './caption-tracks.ts';
import { zhHans } from './library-glossary.zh-Hans.ts';
import { zhHant } from './library-glossary.zh-Hant.ts';
import { ja } from './library-glossary.ja.ts';
import { ko } from './library-glossary.ko.ts';
import { es } from './library-glossary.es.ts';
import { fr } from './library-glossary.fr.ts';
import { de } from './library-glossary.de.ts';
import { nl } from './library-glossary.nl.ts';
import { ptBR } from './library-glossary.pt-BR.ts';
import { it } from './library-glossary.it.ts';
import { ru } from './library-glossary.ru.ts';
import { pl } from './library-glossary.pl.ts';
import { tr } from './library-glossary.tr.ts';
import { vi } from './library-glossary.vi.ts';

const chars = (n: number) => (n === 1 ? '1 character' : `${n} characters`);
const terms = (n: number) => (n === 1 ? '1 term' : `${n} terms`);

/** Copy for the glossary model (English is the source for keys and types; translations are in `library-glossary.zh-Hans.ts`). */
const en = {
  kinds: {
    transcription: { label: 'Transcription glossary', a: 'Correct spelling', b: 'Often misheard as' },
    translation: { label: 'Translation glossary', a: 'Source', b: 'Translation' },
  } as Record<'transcription' | 'translation', { label: string; a: string; b: string }>,
  anyLanguage: 'Any language',
  spoken: (language: string) => `${language} speech`,
  newTranscription: 'New transcription glossary',
  fieldCanonical: 'Correct spelling',
  fieldSource: 'Source',
  fieldTarget: 'Translation',
  fieldEmpty: (label: string) => `${label} can’t be empty`,
  fieldTooLong: (label: string, max: number) => `${label} can’t be longer than ${chars(max)}`,
  fieldNewline: (label: string) => `${label} can’t contain line breaks`,
  duplicate: (term: string) => `“${term}” is already in the glossary`,
  misheardSame: 'A misheard spelling can’t be the same as the correct spelling',
  misheardTooMany: (max: number) => `Up to ${max} misheard spellings`,
  misheardTooLong: (max: number) => `Each spelling can’t be longer than ${chars(max)}`,
  noteTooLong: (max: number) => `The note can’t be longer than ${chars(max)}`,
  nameEmpty: 'The glossary name can’t be empty',
  nameTooLong: (max: number) => `The glossary name can’t be longer than ${chars(max)}`,
  skipPunctuation: 'Only punctuation',
  skipTooLong: (max: number) => `Longer than ${chars(max)}`,
  skipMerged: 'Same term as an earlier line; merged',
  skipNoTarget: 'No translation',
  skipKeptFirst: 'Same term as an earlier line; kept the first one',
  allExist: 'These terms are already in the glossary',
  added: (n: number) => `Added ${terms(n)}`,
  merged: (n: number) => `${terms(n)} already in the glossary`,
  overflow: (n: number, limit: number) => `${terms(n)} not added: a glossary can hold up to ${limit} terms`,
  fileName: 'Glossary',
  /** The separator between several misheard forms in one cell (`splitMisheard` recognizes these). Do not use a list format with “和 / and” (“and”), so that no extra word is read back. */
  misheardSeparator: ', ',
};
export type LibraryGlossaryMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure model for Settings › Glossary (product design §15.10, design draft designs/cuccut/app/model-glossary.js). The library has two tables, each doing one job:
 * the transcription glossary is “canonical spelling ← often misheard as”; the translation glossary is “source → translation”, with a language direction.
 * The write rules follow the Runtime (`normalizeGlossary` in `@cuccut/runtime-storage`): leading and trailing whitespace is trimmed, it cannot be empty, it cannot contain line breaks,
 * one entry is at most 200 characters, one table is at most 5000 entries, one entry has at most 50 misheard forms, and the same canonical spelling (source) may appear only once.
 * These are blocked in the interface first, so the user is not rejected at save time after filling everything in.
 */

export type GlossaryKind = GlossaryContent['kind'];
export type TranscriptionTerm = TranscriptionGlossary['terms'][number];
export type TranslationTerm = TranslationGlossary['terms'][number];

export const GLOSSARY_LIMITS = { name: 200, term: 200, terms: 5000, misheard: 50, note: 1000 } as const;

/** The names of the two kinds of tables and of their two columns (model-glossary.js `KINDS`). */
export const GLOSSARY_KINDS: Record<GlossaryKind, { label: string; a: string; b: string }> = live(() => M.kinds);

/**
 * Merge key: lowercase, whitespace removed, ASCII punctuation removed (same rule as the design draft `normKey`). `KV cache` / `kv-cache` / `KV Cache`
 * are the same word, so when adding to a table they merge into one entry instead of three.
 */
export function normKey(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[!-/:-@[-`{-~]+/g, '');
}

const sameTerm = (a: string, b: string) => normKey(a) !== '' && normKey(a) === normKey(b);

/** The several misheard forms in one cell: commas, enumeration commas and semicolons all count as separators; empty and duplicate ones are dropped. */
export function splitMisheard(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,，、;；]/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function joinMisheard(list: readonly string[]): string {
  return list.join(M.misheardSeparator);
}

// ---- Language ----

/** The commonly used languages in the language dropdown (the same list as the language table of “AI tools”); languages already used in a table but not in this list are added separately. */
export const COMMON_LANGUAGES: readonly string[] = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar'];

/** The canonical BCP 47 form; null when invalid (the Runtime checks with the same `Intl.getCanonicalLocales`). */
export function canonicalLanguage(tag: string): string | null {
  const text = tag.trim();
  if (!text) return null;
  try {
    return Intl.getCanonicalLocales(text)[0] ?? null;
  } catch {
    return null;
  }
}

/** The name of the language (how the language calls itself); “Any language” when unrestricted. */
export function languageLabel(tag: string | null): string {
  return tag ? languageName(tag) : M.anyLanguage;
}

/** Languages listed in the dropdown: the commonly used ones, plus the current value if it is not among them. */
export function languageOptions(current: readonly (string | null)[]): string[] {
  const out = [...COMMON_LANGUAGES];
  for (const tag of current) if (tag && !out.includes(tag)) out.push(tag);
  return out;
}

/** The direction shown beside the table name: `English → 中文`, `中文 口播` (Chinese voiceover), `任意语言` (any language). */
export function pairLabel(content: GlossaryContent): string {
  if (content.kind === 'translation') return `${languageLabel(content.sourceLanguage)} → ${languageLabel(content.targetLanguage)}`;
  return content.language ? M.spoken(languageLabel(content.language)) : M.anyLanguage;
}

// ---- New ----

export function newTranscriptionGlossary(name: string = M.newTranscription): TranscriptionGlossary {
  return { name, kind: 'transcription', language: null, defaultEnabled: true, terms: [] };
}

/** When creating a translation table, the direction is set first: the direction is the identity of this table (design draft `NewTrans`); the name defaults to the direction. */
export function newTranslationGlossary(sourceLanguage: string | null, targetLanguage: string): TranslationGlossary {
  return {
    name: `${languageLabel(sourceLanguage)} → ${languageLabel(targetLanguage)}`,
    kind: 'translation',
    sourceLanguage,
    targetLanguage,
    defaultEnabled: true,
    terms: [],
  };
}

/** The source and target languages are the same (compared by primary language subtag): such a translation table is meaningless. */
export function sameLanguage(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase().split(/[-_]/)[0] === b.toLowerCase().split(/[-_]/)[0];
}

// ---- Validation ----

function textProblems(value: string, label: string, max: number): string[] {
  const text = value.trim();
  if (!text) return [M.fieldEmpty(label)];
  const out: string[] = [];
  if ([...text].length > max) out.push(M.fieldTooLong(label, max));
  if (/[\r\n]/.test(text)) out.push(M.fieldNewline(label));
  return out;
}

/**
 * Problems with one transcription term (an empty array = can save). `others` are the other entries in the table: the same word (by merge key) cannot appear twice.
 * The misheard forms may be left empty — the term only needs to make the recognition model recognize this spelling.
 */
export function transcriptionTermProblems(term: TranscriptionTerm, others: readonly TranscriptionTerm[]): string[] {
  const out = textProblems(term.canonical, M.fieldCanonical, GLOSSARY_LIMITS.term);
  const canonical = term.canonical.trim();
  const twin = canonical ? others.find((t) => sameTerm(t.canonical, canonical)) : undefined;
  if (twin) out.push(M.duplicate(twin.canonical));
  const misheard = term.misheard.map((m) => m.trim()).filter(Boolean);
  if (misheard.some((m) => sameTerm(m, canonical))) out.push(M.misheardSame);
  if (misheard.length > GLOSSARY_LIMITS.misheard) out.push(M.misheardTooMany(GLOSSARY_LIMITS.misheard));
  if (misheard.some((m) => [...m].length > GLOSSARY_LIMITS.term)) out.push(M.misheardTooLong(GLOSSARY_LIMITS.term));
  return out;
}

/** Problems with one translation term: the source and the translation are both required (an entry without a translation constrains nothing); the note may be empty. */
export function translationTermProblems(term: TranslationTerm, others: readonly TranslationTerm[]): string[] {
  const out = [...textProblems(term.source, M.fieldSource, GLOSSARY_LIMITS.term), ...textProblems(term.target, M.fieldTarget, GLOSSARY_LIMITS.term)];
  const source = term.source.trim();
  const twin = source ? others.find((t) => sameTerm(t.source, source)) : undefined;
  if (twin) out.push(M.duplicate(twin.source));
  if ([...(term.note ?? '').trim()].length > GLOSSARY_LIMITS.note) out.push(M.noteTooLong(GLOSSARY_LIMITS.note));
  return out;
}

/** Problems with the table name. */
export function glossaryNameProblem(name: string): string | null {
  const text = name.trim();
  if (!text) return M.nameEmpty;
  if ([...text].length > GLOSSARY_LIMITS.name) return M.nameTooLong(GLOSSARY_LIMITS.name);
  return null;
}

/** Organizes the entry into the form to hand to `library.put`: trims leading and trailing whitespace, dedupes misheard forms and drops those equal to the canonical spelling, and writes an empty note as null. */
export function tidyTranscriptionTerm(term: TranscriptionTerm): TranscriptionTerm {
  const canonical = term.canonical.trim();
  const misheard = [...new Set(term.misheard.map((m) => m.trim()).filter(Boolean))].filter((m) => m !== canonical);
  return { canonical, misheard };
}

export function tidyTranslationTerm(term: TranslationTerm): TranslationTerm {
  const note = (term.note ?? '').trim();
  return { source: term.source.trim(), target: term.target.trim(), note: note || null };
}

// ---- Paste a batch at once ----

export interface SkippedLine {
  line: string;
  why: string;
}

interface Columns {
  b?: number;
  note?: number;
}

/**
 * Splits a pasted batch of lines into cells (design draft `parseLines`). One entry per line: `=`, `=>`, `->`, `→` and Tab all count as separators;
 * Markdown tables and Tab-separated text copied from spreadsheet software use the same parser, and a Markdown table takes its columns from the header row. Titles, front matter and separator lines are skipped.
 */
function rowsOf(text: string, kind: GlossaryKind): { line: string; cells: string[]; cols: Columns | null }[] {
  const rows: { line: string; cells: string[]; cols: Columns | null }[] = [];
  let header: Columns | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || /^-{3,}$/.test(line)) continue;
    if (/^[A-Za-z]+\s*:\s/.test(line) && !/[=→\t|]/.test(line)) continue;
    if (line.startsWith('|')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/(?<!\\)\|$/, '')
        .split(/(?<!\\)\|/)
        .map((cell) => cell.replace(/\\\|/g, '|').replace(/\\\\/g, '\\').trim());
      if (cells.every((cell) => /^:?-+:?$/.test(cell) || cell === '')) continue;
      if (/^(source|term|原文|规范写法)$/i.test(cells[0] ?? '')) {
        header = {};
        cells.forEach((cell, index) => {
          const key = cell.toLowerCase();
          if (/^(misheard|variants|常听错成|常见误识|target|译文|译名)$/.test(key)) header!.b = index;
          else if (/^(note|备注)$/.test(key)) header!.note = index;
        });
        continue;
      }
      rows.push({ line, cells, cols: header });
      continue;
    }
    header = null;
    const parts = line.split(/\s*(?:=>|->|→|=|\t)\s*/);
    const cells = parts.length > 1 ? parts : kind === 'translation' ? line.split(/\s*[,，]\s*/) : [line];
    rows.push({ line, cells, cols: null });
  }
  return rows;
}

function termTooLong(...values: string[]): boolean {
  return values.some((value) => [...value].length > GLOSSARY_LIMITS.term);
}

/** Transcription table: `KV cache = 开维缓存、KV 换成` (the misheard forms are 开维缓存 and KV 换成); writing only the canonical spelling is also fine. Words repeated in the same batch are merged into one entry, with their misheard forms combined. */
export function parseTranscriptionLines(text: string): { terms: TranscriptionTerm[]; skipped: SkippedLine[] } {
  const terms: TranscriptionTerm[] = [];
  const skipped: SkippedLine[] = [];
  const seen = new Map<string, TranscriptionTerm>();
  for (const { line, cells, cols } of rowsOf(text, 'transcription')) {
    const canonical = (cells[0] ?? '').trim();
    const key = normKey(canonical);
    if (!key) {
      skipped.push({ line, why: M.skipPunctuation });
      continue;
    }
    const misheard = splitMisheard(cells[cols?.b ?? 1] ?? '').filter((m) => !sameTerm(m, canonical));
    if (termTooLong(canonical, ...misheard)) {
      skipped.push({ line, why: M.skipTooLong(GLOSSARY_LIMITS.term) });
      continue;
    }
    const prev = seen.get(key);
    if (prev) {
      prev.misheard = [...new Set([...prev.misheard, ...misheard])].slice(0, GLOSSARY_LIMITS.misheard);
      skipped.push({ line, why: M.skipMerged });
      continue;
    }
    const term = { canonical, misheard: misheard.slice(0, GLOSSARY_LIMITS.misheard) };
    seen.set(key, term);
    terms.push(term);
  }
  return { terms, skipped };
}

/** Translation table: `commit = 突破确认` (the translation is 突破确认), and the third cell is the note. Lines with no translation are sent back with the reason explained, not silently dropped. */
export function parseTranslationLines(text: string): { terms: TranslationTerm[]; skipped: SkippedLine[] } {
  const terms: TranslationTerm[] = [];
  const skipped: SkippedLine[] = [];
  const seen = new Set<string>();
  for (const { line, cells, cols } of rowsOf(text, 'translation')) {
    const source = (cells[0] ?? '').trim();
    const key = normKey(source);
    if (!key) {
      skipped.push({ line, why: M.skipPunctuation });
      continue;
    }
    const target = (cells[cols?.b ?? 1] ?? '').trim();
    if (!target) {
      skipped.push({ line, why: M.skipNoTarget });
      continue;
    }
    if (termTooLong(source, target)) {
      skipped.push({ line, why: M.skipTooLong(GLOSSARY_LIMITS.term) });
      continue;
    }
    if (seen.has(key)) {
      skipped.push({ line, why: M.skipKeptFirst });
      continue;
    }
    seen.add(key);
    const note = (cells[cols?.note ?? 2] ?? '').trim().slice(0, GLOSSARY_LIMITS.note);
    terms.push({ source, target, note: note || null });
  }
  return { terms, skipped };
}

// ---- Add terms ----

export interface AddResult<T> {
  terms: T[];
  added: number;
  merged: number;
  /** Number of entries not added because they would exceed the limit of one table. */
  overflow: number;
}

/** Merges a new batch of words into the transcription table: existing words (by merge key) are not added again; only new misheard forms are merged in. */
export function addTranscriptionTerms(terms: readonly TranscriptionTerm[], incoming: readonly TranscriptionTerm[]): AddResult<TranscriptionTerm> {
  const out = terms.map((t) => ({ ...t, misheard: [...t.misheard] }));
  let added = 0;
  let merged = 0;
  let overflow = 0;
  for (const term of incoming) {
    const at = out.findIndex((t) => sameTerm(t.canonical, term.canonical));
    if (at >= 0) {
      const existing = out[at]!;
      existing.misheard = [...new Set([...existing.misheard, ...term.misheard])]
        .filter((m) => m !== existing.canonical)
        .slice(0, GLOSSARY_LIMITS.misheard);
      merged += 1;
    } else if (out.length >= GLOSSARY_LIMITS.terms) {
      overflow += 1;
    } else {
      out.push(tidyTranscriptionTerm(term));
      added += 1;
    }
  }
  return { terms: out, added, merged, overflow };
}

/** Merges a new batch of words into the translation table: existing words keep their original translations (to change a translation, edit that entry). */
export function addTranslationTerms(terms: readonly TranslationTerm[], incoming: readonly TranslationTerm[]): AddResult<TranslationTerm> {
  const out = terms.map((t) => ({ ...t }));
  let added = 0;
  let merged = 0;
  let overflow = 0;
  for (const term of incoming) {
    if (out.some((t) => sameTerm(t.source, term.source))) merged += 1;
    else if (out.length >= GLOSSARY_LIMITS.terms) overflow += 1;
    else {
      out.push(tidyTranslationTerm(term));
      added += 1;
    }
  }
  return { terms: out, added, merged, overflow };
}

/** The receipt after adding words. */
export function addedText(result: Pick<AddResult<unknown>, 'added' | 'merged' | 'overflow'>): string {
  if (!result.added && !result.overflow) return M.allExist;
  const parts = [M.added(result.added)];
  if (result.merged) parts.push(M.merged(result.merged));
  if (result.overflow) parts.push(M.overflow(result.overflow, GLOSSARY_LIMITS.terms));
  return parts.join(' · ');
}

// ---- Search and reverse ----

/** Searches the canonical spelling and misheard forms (transcription table), or the source, translation and note (translation table); returns the positions in the table of the matching entries. */
export function searchTerms(content: GlossaryContent, query: string): number[] {
  const key = normKey(query);
  const all = content.terms.map((_, index) => index);
  if (!key) return all;
  const hit = (value: string | null) => normKey(value).includes(key);
  if (content.kind === 'transcription') {
    return all.filter((i) => hit(content.terms[i]!.canonical) || content.terms[i]!.misheard.some(hit));
  }
  return all.filter((i) => hit(content.terms[i]!.source) || hit(content.terms[i]!.target) || hit(content.terms[i]!.note));
}

/**
 * Generates the reverse-direction translation table (design draft `reversePack`): the source and translation are swapped; where translations are identical, only the first is kept.
 * If the source language of the original table is unrestricted, it cannot be generated — the target language of the reversed table must be known. A new table is not enabled for new videos by default.
 */
export function reverseTranslation(content: TranslationGlossary): TranslationGlossary | null {
  if (!content.sourceLanguage) return null;
  const seen = new Set<string>();
  const terms: TranslationTerm[] = [];
  for (const term of content.terms) {
    const key = normKey(term.target);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push({ source: term.target, target: term.source, note: term.note });
  }
  return {
    name: `${languageLabel(content.targetLanguage)} → ${languageLabel(content.sourceLanguage)}`,
    kind: 'translation',
    sourceLanguage: content.targetLanguage,
    targetLanguage: content.sourceLanguage,
    defaultEnabled: false,
    terms,
  };
}

/** The file name suggested on export: the table name with characters not allowed in file names removed. */
export function exportFileName(name: string): string {
  const safe = name.replace(/[/\\:*?"<>|\u0000-\u001f]+/g, ' ').trim();
  return `${safe || M.fileName}.md`;
}

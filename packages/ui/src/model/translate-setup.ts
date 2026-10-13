import { defineMessages, MAX_SELECTED_GLOSSARIES, type DocumentRecord, type GlossaryEntry, type Id, type TranslateParams, type TranslationGlossary } from '@cuccut/protocol';
import { languageName } from './caption-tracks.ts';
import { langName } from './tools-models.ts';
import { zhHans } from './translate-setup.zh-Hans.ts';
import { zhHant } from './translate-setup.zh-Hant.ts';
import { ja } from './translate-setup.ja.ts';
import { ko } from './translate-setup.ko.ts';
import { es } from './translate-setup.es.ts';
import { fr } from './translate-setup.fr.ts';
import { de } from './translate-setup.de.ts';
import { nl } from './translate-setup.nl.ts';
import { ptBR } from './translate-setup.pt-BR.ts';
import { it } from './translate-setup.it.ts';
import { ru } from './translate-setup.ru.ts';
import { pl } from './translate-setup.pl.ts';
import { tr } from './translate-setup.tr.ts';
import { vi } from './translate-setup.vi.ts';

/** Reasons a target language cannot be chosen, and the glossary row notes (translations are in `translate-setup.<lang>.ts`). */
const en = {
  sameAsSource: 'Same language as the original',
  alreadyTranslated: 'Already has a translation in this language',
  glossaryGone: 'No longer in the glossary library · not used this time',
  reading: 'Reading…',
  unreadable: 'Couldn’t be read · not used this time',
  anyLanguage: 'Any language',
  /** Glossaries whose direction does not match: `source` / `target` are already display names. */
  wrongDirection: (source: string, target: string) => `Direction is ${source} → ${target} · not used this time`,
};
export type TranslateSetupMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure logic for the translation setup page (prototype panel-aitools-flows.jsx `TranslateFlow`): which languages it can translate into, which of the glossaries enabled for the video
 * match the direction, and the parameters handed to `pipelines.start`.
 */

/** Common target languages. Chinese is split into Simplified and Traditional (`zh-Hans` / `zh-Hant`); others by primary language. */
export const TARGET_LANGUAGES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'it', 'vi', 'th', 'id', 'ar'] as const;

const primary = (tag: string) => tag.split('-')[0]!.toLowerCase();

/** Writing system of a Chinese tag: Traditional (Hant, Taiwan / Hong Kong / Macau) or Simplified. */
function chineseScript(tag: string): 'Hant' | 'Hans' {
  return /-(hant|tw|hk|mo)(-|$)/i.test(tag) ? 'Hant' : 'Hans';
}

/** Whether two language tags refer to the same language (Chinese is further split into Simplified and Traditional). */
export function sameLanguage(a: string, b: string): boolean {
  if (primary(a) !== primary(b)) return false;
  return primary(a) !== 'zh' || chineseScript(a) === chineseScript(b);
}

export interface TargetOption {
  tag: string;
  /** The language's own name for itself (English, 日本語). */
  label: string;
  /** Chinese name. */
  description: string;
  /** Reasons it cannot be chosen: the same language as the source, or this transcript already has a translation in that language (one track per language). */
  disabled: string | null;
}

/** Languages that already have a translation: the translation documents derived from this transcript. */
export function existingTranslations(documents: Record<Id, DocumentRecord>, speechDocumentId: Id): DocumentRecord[] {
  return Object.values(documents).filter((d) => d.kind === 'translation' && d.sourceDocumentId === speechDocumentId);
}

export function targetOptions(sourceLanguage: string | null, existing: readonly DocumentRecord[]): TargetOption[] {
  return TARGET_LANGUAGES.map((tag) => {
    const same = sourceLanguage !== null && sameLanguage(sourceLanguage, tag);
    const done = existing.some((d) => d.language && sameLanguage(d.language, tag));
    return {
      tag,
      label: languageName(tag),
      description: langName(tag),
      disabled: same ? M.sameAsSource : done ? M.alreadyTranslated : null,
    };
  });
}

/** Default target language: English when the source is Chinese, otherwise Simplified Chinese; when neither can be chosen, the first one that can. */
export function defaultTarget(options: readonly TargetOption[], sourceLanguage: string | null): string | null {
  const preferred = sourceLanguage && primary(sourceLanguage) === 'zh' ? 'en' : 'zh-Hans';
  return (options.find((o) => o.tag === preferred && !o.disabled) ?? options.find((o) => !o.disabled))?.tag ?? null;
}

/**
 * Whether the language tags on a glossary match (copied from jobs' `languageMatches`, which the Runtime uses to reject glossaries with mismatched languages): equal, or one is a prefix of the other
 * on a subtag boundary (`en` matches `en-US`; `zh-CN` does not match `zh-Hans`).
 */
export function languageMatches(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`);
}

/** Whether a glossary's direction matches: the target language matches; the source language is unrestricted, or matches the source text (when the source language is unknown, only the target is checked). */
export function glossaryFits(glossary: Pick<TranslationGlossary, 'sourceLanguage' | 'targetLanguage'>, source: string | null, target: string): boolean {
  if (!languageMatches(glossary.targetLanguage, target)) return false;
  return glossary.sourceLanguage === null || source === null || languageMatches(glossary.sourceLanguage, source);
}

/**
 * Glossary entries that appear in the source text (case-insensitive); for the same source term only the first entry is taken. The settings page uses this to say “how many entries hit this piece”; what is actually handed to the model is picked again by the Runtime
 * from each batch's source text.
 */
export function glossaryHits(terms: TranslationGlossary['terms'], text: string): GlossaryEntry[] {
  const haystack = text.toLocaleLowerCase();
  const seen = new Set<string>();
  const out: GlossaryEntry[] = [];
  for (const term of terms) {
    const source = term.source.trim();
    const target = term.target.trim();
    if (!source || !target || seen.has(source) || !haystack.includes(source.toLocaleLowerCase())) continue;
    seen.add(source);
    out.push({ source, target, ...(term.note ? { note: term.note } : {}) });
  }
  return out;
}

/** A translation glossary in the library: `undefined` while its content is still being read, null when it cannot be read (deleted, or an error). */
export interface GlossaryCandidate {
  id: Id;
  name: string;
  content: TranslationGlossary | null | undefined;
}

export interface GlossaryRow {
  id: Id;
  name: string;
  /** Enabled for the video (`glossaries.translate` in `library-selection`). */
  enabled: boolean;
  /** Usable for this translation: enabled, readable, and the direction matches. */
  used: boolean;
  /** Entry count and the number of hits in this piece; null when the content could not be read. */
  terms: number | null;
  hits: number | null;
  /** Why it cannot be ticked, or is ticked but not used (direction mismatch, not in the library, still being read); null when it can be ticked normally. */
  note: string | null;
}

/**
 * Rows of the “Glossary” section of the settings page: every translation glossary in the library whose direction matches is listed (ticked = enabled for the video); glossaries enabled for the video that cannot be used this time
 * (direction mismatch, no longer in the library) are also listed, ticked, with the reason stated. The Runtime likewise skips them when it merges the glossaries enabled for the video.
 * Enabled ones come first, in the order they were enabled (earlier ones take priority); the rest follow the library order.
 */
export function glossaryRows(
  candidates: readonly GlossaryCandidate[],
  enabled: readonly Id[],
  source: string | null,
  target: string,
  text: string,
): GlossaryRow[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const row = (id: Id, on: boolean): GlossaryRow | null => {
    const candidate = byId.get(id);
    if (!candidate) return on ? { id, name: id, enabled: true, used: false, terms: null, hits: null, note: M.glossaryGone } : null;
    const { content, name } = candidate;
    if (content === undefined) return { id, name, enabled: on, used: false, terms: null, hits: null, note: M.reading };
    if (content === null) return on ? { id, name, enabled: true, used: false, terms: null, hits: null, note: M.unreadable } : null;
    const fits = glossaryFits(content, source, target);
    if (!fits && !on) return null;
    return {
      id,
      name,
      enabled: on,
      used: on && fits,
      terms: content.terms.length,
      hits: glossaryHits(content.terms, text).length,
      note: fits ? null : M.wrongDirection(content.sourceLanguage ? langName(content.sourceLanguage) : M.anyLanguage, langName(content.targetLanguage)),
    };
  };
  const on = enabled.map((id) => row(id, true)).filter((r): r is GlossaryRow => r !== null);
  const rest = candidates
    .filter((c) => !enabled.includes(c.id))
    .map((c) => row(c.id, false))
    .filter((r): r is GlossaryRow => r !== null);
  return [...on, ...rest];
}

/** Ticks or unticks one glossary: a newly ticked one goes to the end (earlier ones take priority), and an unticked one is removed; unchanged when over the limit (returns null). */
export function toggleGlossary(enabled: readonly Id[], id: Id, on: boolean): Id[] | null {
  if (on) {
    if (enabled.includes(id)) return null;
    if (enabled.length >= MAX_SELECTED_GLOSSARIES) return null;
    return [...enabled, id];
  }
  return enabled.includes(id) ? enabled.filter((x) => x !== id) : null;
}

export interface TranslateSetup {
  videoId: Id;
  speechDocumentId: Id;
  targetLanguage: string;
  /** Style hint; not passed when empty. */
  style: string;
  /** The selected text model; when null, the text-generation default is used. */
  model: { providerId: string; modelId: string } | null;
}

/**
 * `params` for `pipelines.start`: only keys the pipeline recognises (`parseTranslateParams` rejects extra keys). Glossaries are not passed here: the ones enabled for the video are used
 * (`library.getVideoSelection`), and the Runtime reads them itself at start and freezes the version.
 */
export function translateParams(setup: TranslateSetup): TranslateParams {
  const style = setup.style.trim().slice(0, 500);
  return {
    videoId: setup.videoId,
    documentId: setup.speechDocumentId,
    targetLanguage: setup.targetLanguage,
    ...(style ? { style } : {}),
    ...(setup.model ? { provider: setup.model.providerId, model: setup.model.modelId } : {}),
  };
}

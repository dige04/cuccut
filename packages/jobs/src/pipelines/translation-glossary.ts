import {
  RpcError,
  type FrozenLibraryEntry,
  type GlossaryEntry,
  type Id,
  type JobSubmitter,
  type TranslateGlossaryUse,
  type TranslationGlossary,
} from '@cuccut/protocol';
import type { LibraryStore } from '@cuccut/runtime-storage/library';
import { JobsTranslationGlossary as J } from '@cuccut/protocol/messages/jobs/translation-glossary.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';

/**
 * Glossary for translation (architecture design §7.9; `glossaryRef` in video format spec §5.3):
 *
 * - Sources, in order: terms passed in the call (`glossary`), library glossaries passed in the call (`glossaries`), and the translation glossary enabled in the video. For the same source spelling, only the first one that appears is kept. At startup, the versions of library entries are frozen and their contents are written to artifacts before the first step; the library is not read after that.
 * - The prompt has a size limit. When there are no more than `ALL_TERMS` entries after deduplication (and they fit), all of them are included. Otherwise each batch carries only those whose source spelling appears in that batch (or its preceding context), truncated in the order above to `MAX_TERMS` entries and `MAX_CHARS` characters.
 * - The translation document's `glossaryRef` records the entries used, their versions and digests, and the terms that appear in the source (`terms`). If the glossary changes later, dubbing uses this to decide which sentences in the translation are stale when it checks them (`glossary-changed`).
 */

/** When there are no more than this many entries after deduplication, every batch carries all terms. */
export const ALL_TERMS = 30;
/** Each batch carries at most this many terms. */
export const MAX_TERMS = 60;
/** Maximum total characters of terms per batch (counted by the lines in the prompt). */
export const MAX_CHARS = 4000;
/** `glossaryRef.terms` records at most this many entries; when exceeded, `termsTruncated: true`. */
export const MAX_RECORDED_TERMS = 2000;
/** One translation uses at most this many library glossaries (the call-given ones and the video-enabled ones are each capped at this number). */
export const MAX_LIBRARY_GLOSSARIES = 20;

export type GlossaryLibrary = Pick<LibraryStore, 'get'>;

/** One frozen library glossary. */
export interface FrozenGlossary extends FrozenLibraryEntry {
  name: string;
  origin: 'explicit' | 'video';
}

/** Glossary resolved at startup: the frozen entries, and those enabled in the video but not used this time. */
export interface ResolvedGlossaries {
  entries: FrozenGlossary[];
  skipped: TranslateGlossaryUse['skipped'];
}

/** Glossary contents written to artifacts (the translation step reads only this). */
export interface GlossarySnapshot {
  inline: GlossaryEntry[];
  entries: Array<FrozenGlossary & { terms: TranslationGlossary['terms'] }>;
}

/** A term that goes into the prompt. `entryId` is the library glossary, and null for terms passed directly in the call. */
export interface PromptTerm {
  source: string;
  target: string;
  note?: string;
  entryId: Id | null;
}

/** `glossaryRef` in the translation document (video format spec §5.3). */
export interface GlossaryRef {
  entries: Array<{ library: 'glossaries'; id: Id; version: number; contentHash: string; name: string }>;
  inline: { contentHash: string; count: number } | null;
  /** Terms that appeared in the source (as of translation): which glossary, the source spelling and the translation. */
  terms: Array<{ entryId: Id | null; source: string; target: string }>;
  /** True when more than `MAX_RECORDED_TERMS` terms appeared and not all were recorded. */
  termsTruncated?: true;
}

/**
 * Whether BCP 47 tags match: they are identical, or one is a prefix of the other at a subtag boundary (`en` matches `en-US`; `zh-Hans` does not match `zh-Hant`).
 */
export function languageMatches(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`);
}

/**
 * Resolves the glossary at startup. A glossary passed in the call (`explicit`) is rejected if it is missing, is not a translation glossary, or has the wrong language. A glossary enabled in the video (`video`) is skipped and recorded if it was deleted or has the wrong language. A client of the external service cannot use a library glossary passed in the call, and the video-enabled one is not used either.
 */
export function resolveGlossaries(input: {
  library: GlossaryLibrary | undefined;
  explicit: Array<{ id: Id; version?: number }>;
  enabled: Id[];
  targetLanguage: string;
  sourceLanguage: string | null;
  submitter: JobSubmitter | undefined;
}): ResolvedGlossaries {
  const { library, explicit, targetLanguage, sourceLanguage } = input;
  const service = input.submitter?.kind === 'service';
  if (explicit.length > 0) {
    if (service) {
      throw new RpcError('invalid-request', J.serviceClient(), { code: 'LIBRARY_ENTRY_NOT_APPLICABLE', reason: 'service-client' });
    }
    if (!library) throw new RpcError('invalid-request', J.noLibrary());
  }
  const entries: FrozenGlossary[] = [];
  const skipped: ResolvedGlossaries['skipped'] = [];
  const seen = new Set<Id>();
  const languageOk = (g: TranslationGlossary) =>
    languageMatches(g.targetLanguage, targetLanguage) &&
    (g.sourceLanguage === null || sourceLanguage === null || languageMatches(g.sourceLanguage, sourceLanguage));
  for (const ref of explicit) {
    if (seen.has(ref.id)) throw new RpcError('invalid-request', J.duplicate({ id: ref.id }));
    seen.add(ref.id);
    const entry = library!.get({ library: 'glossaries', id: ref.id, ...(ref.version !== undefined ? { version: ref.version } : {}) });
    const content = entry.content;
    if (content.kind !== 'translation') {
      throw new RpcError('invalid-request', J.transcriptionGlossary({ name: content.name }), {
        code: 'LIBRARY_ENTRY_NOT_APPLICABLE',
        library: 'glossaries',
        id: entry.id,
      });
    }
    if (!languageOk(content)) {
      throw new RpcError(
        'invalid-request',
        content.sourceLanguage === null
          ? J.languageMismatchAnySource({ name: content.name, target: content.targetLanguage })
          : J.languageMismatch({ name: content.name, source: content.sourceLanguage, target: content.targetLanguage }),
        {
          code: 'LIBRARY_ENTRY_NOT_APPLICABLE',
          library: 'glossaries',
          id: entry.id,
          targetLanguage: content.targetLanguage,
          sourceLanguage: content.sourceLanguage,
        },
      );
    }
    entries.push({
      library: 'glossaries',
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      name: content.name,
      origin: 'explicit',
    });
  }
  if (!service && library) {
    for (const id of input.enabled) {
      if (seen.has(id)) continue;
      seen.add(id);
      let content: TranslationGlossary;
      let frozen: FrozenLibraryEntry;
      try {
        const entry = library.get({ library: 'glossaries', id });
        if (entry.content.kind !== 'translation') continue;
        content = entry.content;
        frozen = { library: 'glossaries', id: entry.id, version: entry.version, contentHash: entry.contentHash };
      } catch {
        skipped.push({ id, reason: 'removed' });
        continue;
      }
      if (!languageOk(content)) {
        skipped.push({ id, reason: 'language' });
        continue;
      }
      entries.push({ ...frozen, name: content.name, origin: 'video' });
    }
  }
  return { entries, skipped };
}

/** Reads the contents of the frozen version (at startup, when the version is already fixed). */
export function glossarySnapshot(
  library: GlossaryLibrary | undefined,
  inline: GlossaryEntry[],
  entries: FrozenGlossary[],
): GlossarySnapshot {
  return {
    inline,
    entries: entries.map((e) => {
      const entry = library!.get({ library: 'glossaries', id: e.id, version: e.version });
      return { ...e, terms: entry.content.kind === 'translation' ? entry.content.terms : [] };
    }),
  };
}

/** Deduplicates all terms in priority order (passed in the call, library glossaries passed in the call, video-enabled). For the same source spelling (case-insensitive), only the first is kept. */
export function promptTerms(snapshot: GlossarySnapshot): PromptTerm[] {
  const out: PromptTerm[] = [];
  const seen = new Set<string>();
  const add = (term: { source: string; target: string; note?: string | null }, entryId: Id | null) => {
    const source = term.source.trim();
    const key = source.toLowerCase();
    if (source === '' || seen.has(key)) return;
    seen.add(key);
    out.push({ source, target: term.target.trim(), ...(term.note ? { note: term.note } : {}), entryId });
  };
  for (const t of snapshot.inline) add(t, null);
  for (const origin of ['explicit', 'video'] as const) {
    for (const entry of snapshot.entries) if (entry.origin === origin) for (const t of entry.terms) add(t, entry.id);
  }
  return out;
}

/**
 * Whether a source spelling appears in the text. Case-insensitive. A spelling made only of Latin letters, digits and common connectors must fall on word boundaries (`AI` does not match `said`). Others (such as Chinese) match as substrings.
 */
export function termOccurs(source: string, text: string): boolean {
  const needle = source.trim();
  if (needle === '') return false;
  if (/^[\p{Script=Latin}\d][\p{Script=Latin}\d .'’&+-]*$/u.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{Script=Latin}\\d])${escaped}(?![\\p{Script=Latin}\\d])`, 'iu').test(text);
  }
  return text.toLowerCase().includes(needle.toLowerCase());
}

const lineLength = (t: PromptTerm) => [...`- ${t.source} → ${t.target}${t.note ? ` (${t.note})` : ''}`].length + 1;

/**
 * Which terms this batch carries. When there are few (within `ALL_TERMS` and they fit), all are carried. Otherwise only those that appear in `text` (this batch and the preceding context) are carried, truncated in priority order to `MAX_TERMS` entries and `MAX_CHARS` characters. `capped` is the number of relevant terms that could not fit.
 */
export function selectTerms(terms: PromptTerm[], text: string): { terms: PromptTerm[]; capped: number } {
  const total = terms.reduce((n, t) => n + lineLength(t), 0);
  if (terms.length <= ALL_TERMS && total <= MAX_CHARS) return { terms, capped: 0 };
  const relevant = terms.filter((t) => termOccurs(t.source, text));
  const picked: PromptTerm[] = [];
  let chars = 0;
  for (const term of relevant) {
    const length = lineLength(term);
    if (picked.length >= MAX_TERMS || chars + length > MAX_CHARS) break;
    picked.push(term);
    chars += length;
  }
  return { terms: picked, capped: relevant.length - picked.length };
}

/** The translation document's `glossaryRef`. null when there is no glossary. `terms` are the terms whose source spelling appears in the source (not affected by the prompt limit). */
export function glossaryRefOf(snapshot: GlossarySnapshot, sourceText: string): GlossaryRef | null {
  if (snapshot.inline.length === 0 && snapshot.entries.length === 0) return null;
  const terms: GlossaryRef['terms'] = [];
  let truncated = false;
  for (const term of promptTerms(snapshot)) {
    if (!termOccurs(term.source, sourceText)) continue;
    if (terms.length >= MAX_RECORDED_TERMS) {
      truncated = true;
      break;
    }
    terms.push({ entryId: term.entryId, source: term.source, target: term.target });
  }
  return {
    entries: snapshot.entries.map((e) => ({
      library: 'glossaries',
      id: e.id,
      version: e.version,
      contentHash: e.contentHash,
      name: e.name,
    })),
    inline:
      snapshot.inline.length > 0
        ? { contentHash: `sha256:${sha256Hex(canonicalJson(snapshot.inline))}`, count: snapshot.inline.length }
        : null,
    terms,
    ...(truncated ? { termsTruncated: true as const } : {}),
  };
}

/** Reads `glossaryRef` from a translation body. null when the shape is not recognized (treated as no glossary). */
export function readGlossaryRef(value: unknown): GlossaryRef | null {
  const ref = value as Partial<GlossaryRef> | null;
  if (!ref || typeof ref !== 'object' || !Array.isArray(ref.entries) || !Array.isArray(ref.terms)) return null;
  return ref as GlossaryRef;
}

/** Validates the shape of `glossaryRef` (when assembling the translation). Returns an empty array when there are no problems. */
export function glossaryRefProblems(value: unknown): string[] {
  if (value === undefined) return [];
  const ref = readGlossaryRef(value);
  if (!ref) return [J.refMalformed().text];
  const problems: string[] = [];
  for (const e of ref.entries) {
    if (e?.library !== 'glossaries' || typeof e.id !== 'string' || !Number.isInteger(e.version) || typeof e.contentHash !== 'string') {
      problems.push(J.refIncompleteEntry().text);
      break;
    }
  }
  for (const t of ref.terms) {
    if (typeof t?.source !== 'string' || typeof t.target !== 'string' || (t.entryId !== null && typeof t.entryId !== 'string')) {
      problems.push(J.refIncompleteTerm().text);
      break;
    }
  }
  return problems;
}

/**
 * Whether this sentence's translation is stale after the glossary changed. When the content digest of a glossary in `glossaryRef` has changed (or the glossary was deleted), the terms appearing in this source sentence are worked out in the same order and with the same deduplication as at translation time, using their current translations (a deleted glossary has no terms now; terms passed directly in the call have no "now" and are taken as at translation time). These are compared with the terms recorded at translation time. Any difference (a translation changed, a term was removed, or a newly added term appears in this sentence) makes it stale. When `termsTruncated` is set, the recorded terms are incomplete, so if a glossary changed and any term appears in this sentence, it counts as stale.
 */
export function glossaryChanged(
  ref: GlossaryRef,
  sentenceText: string,
  current: (id: Id) => { contentHash: string; terms: TranslationGlossary['terms'] } | null,
): boolean {
  const now = new Map(ref.entries.map((e) => [e.id, current(e.id)]));
  if (ref.entries.every((e) => now.get(e.id)?.contentHash === e.contentHash)) return false;
  const then = new Map<string, string>();
  for (const t of ref.terms) if (termOccurs(t.source, sentenceText)) then.set(t.source.trim().toLowerCase(), t.target.trim());
  const later = new Map<string, string>();
  const add = (source: string, target: string) => {
    const key = source.trim().toLowerCase();
    if (key !== '' && !later.has(key) && termOccurs(source, sentenceText)) later.set(key, target.trim());
  };
  for (const t of ref.terms) if (t.entryId === null) add(t.source, t.target);
  for (const e of ref.entries) for (const t of now.get(e.id)?.terms ?? []) add(t.source, t.target);
  if (ref.termsTruncated) return then.size > 0 || later.size > 0;
  if (then.size !== later.size) return true;
  for (const [source, target] of then) if (later.get(source) !== target) return true;
  return false;
}

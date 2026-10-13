import type { Id } from '@cuccut/protocol';
import { EditorWasmUnavailable, TRANSLATION_SCHEMA, sha256Hex, sourceSentences, type SourceSentence } from '@cuccut/jobs';

/**
 * Converts translations from old project imports, `cuccut.translation/1`, to `cuccut.translation/2` (video format spec §5.3). The `/1` units record translations by the old project's sentence IDs (`{ id, text, display?, source?, alignment? }`). The old fingerprints and alignment blocks cannot be converted, so only the translated sentence itself is taken here and re-attached to the current sentences of the transcript (the subtitle and translation-core rules, via editor-wasm, the same ones used by the translation flow and by `translationBasis` in `documents_read`). The alignment is written at sentence level (`correspondence: 'sentence'`), the same way as the downgrade in “carry-over when the source document changes version”.
 *
 * - Words of an old sentence: the stored sentence with the same ID in the transcript body (`first`/`last` or `wordIds`); if there is none, the unit's `source.first`/`source.last`; if there is still none, the sentence with the same ID in the rules. A unit with none of these cannot be converted.
 * - Pairing is by words: an old and a new sentence are candidates only if they share at least half the words of the shorter of the two. The pair sharing the most words is paired first, and one old sentence pairs with only one new sentence (the same greedy approach as carry-over pairing by time overlap; here the transcript is the same and word IDs do not change, so words are compared directly).
 * - Identical words: `draft` (the translation is used as is); paired but with different words: the translation is kept for human reference, `status: 'stale'`. Unpaired old sentences are not carried over, and new sentences with no old translation get no unit. `display` (the rewrite used for subtitle display) is not carried over: the old project did not record the fingerprint of the natural translation that the rewrite was based on, so carrying it would be stale anyway.
 *
 * Derived sub-videos (`videos.derive`) use it to copy the parent video's old translations into the sub-video, so that it can build translation subtitle layers. Elsewhere, it is used whenever old translations need upgrading.
 */

export interface LegacyTranslationUpgrade {
  body: {
    schema: typeof TRANSLATION_SCHEMA;
    language: string;
    sourceBasis: { speechRef: { id: Id; revision: string }; sequenceId: Id; scopeLineage: Id[]; editViewHash: string };
    units: Record<string, unknown>[];
  };
  /** A unit whose words match exactly; used as is. */
  kept: number;
  /** A unit that was paired but whose sentence words changed; marked stale. */
  stale: number;
  /** An old unit with no matching sentence; not carried over. */
  dropped: number;
}

export const LEGACY_TRANSLATION_SCHEMA = 'cuccut.translation/1';

type Json = Record<string, unknown>;

export function isLegacyTranslation(body: unknown): boolean {
  const b = body as Json | null;
  return !!b && typeof b === 'object' && b.schema === LEGACY_TRANSLATION_SCHEMA && Array.isArray(b.units);
}

/**
 * Converts one `/1` translation. `speech` is the transcript body it was translated from; `language` is the translation's language (the document's recorded `language`); `basis` is the transcript version and sequence of the new body's `sourceBasis`. Returns null when conversion is impossible (not `/1`, no language, the transcript yields no sentences, editor-wasm is not built, or not a single unit can be attached).
 */
export function upgradeLegacyTranslation(
  body: unknown,
  speech: unknown,
  language: string | null | undefined,
  basis: { speechRef: { id: Id; revision: string }; sequenceId: Id },
): LegacyTranslationUpgrade | null {
  if (!isLegacyTranslation(body) || !language) return null;
  let read: ReturnType<typeof sourceSentences>;
  try {
    read = sourceSentences(speech);
  } catch (error) {
    if (error instanceof EditorWasmUnavailable) return null;
    throw error;
  }
  if ('problem' in read) return null;
  const sentences = read.sentences;
  const words = speechWordIds(speech);
  const position = new Map(words.map((id, i) => [id, i]));
  const stored = storedSentences(speech, words, position);
  const ruleById = new Map(sentences.map((s) => [s.id, s]));

  const legacy: { text: string; words: Set<string> }[] = [];
  let dropped = 0;
  for (const raw of (body as { units: unknown[] }).units) {
    const unit = raw as Json | null;
    const text = typeof unit?.text === 'string' ? unit.text.trim() : '';
    const id = typeof unit?.id === 'string' ? unit.id : '';
    const ids = text ? (stored.get(id) ?? sourceRange(unit?.source, words, position) ?? ruleById.get(id)?.wordIds ?? null) : null;
    if (!ids?.length) {
      dropped++;
      continue;
    }
    legacy.push({ text, words: new Set(ids) });
  }

  // Greedy pairing by shared words: one old sentence pairs with only one new sentence.
  const candidates: { i: number; j: number; shared: number }[] = [];
  const sentenceOf = new Map<string, number>();
  sentences.forEach((s, j) => s.wordIds.forEach((w) => sentenceOf.set(w, j)));
  legacy.forEach((old, i) => {
    const shared = new Map<number, number>();
    for (const w of old.words) {
      const j = sentenceOf.get(w);
      if (j !== undefined) shared.set(j, (shared.get(j) ?? 0) + 1);
    }
    for (const [j, n] of shared) {
      if (n * 2 >= Math.min(old.words.size, sentences[j]!.wordIds.length)) candidates.push({ i, j, shared: n });
    }
  });
  candidates.sort((x, y) => y.shared - x.shared || x.i - y.i || x.j - y.j);
  const pairs = new Map<number, number>();
  const usedOld = new Set<number>();
  for (const c of candidates) {
    if (usedOld.has(c.i) || pairs.has(c.j)) continue;
    usedOld.add(c.i);
    pairs.set(c.j, c.i);
  }
  dropped += legacy.length - usedOld.size;

  let kept = 0;
  let stale = 0;
  const units: Json[] = [];
  sentences.forEach((sentence: SourceSentence, j) => {
    const i = pairs.get(j);
    if (i === undefined) return;
    const old = legacy[i]!;
    const same = sameSentence(old.words, position, sentence);
    if (same) kept++;
    else stale++;
    units.push({
      id: `t-${sentence.id}`,
      sourceSentenceId: sentence.id,
      sourceFingerprint: sentence.fingerprint,
      naturalText: old.text,
      alignment: {
        basis: 'natural',
        correspondence: 'sentence',
        blocks: [],
        sourceWordIds: [...sentence.wordIds],
        textHash: `sha256:${sha256Hex(old.text)}`,
      },
      status: same ? 'draft' : 'stale',
    });
  });
  if (!units.length) return null;
  return {
    body: {
      schema: TRANSLATION_SCHEMA,
      language,
      sourceBasis: { speechRef: basis.speechRef, sequenceId: basis.sequenceId, scopeLineage: [], editViewHash: read.editViewHash },
      units,
    },
    kept,
    stale,
    dropped,
  };
}

/** The transcript's word IDs, in word order. */
function speechWordIds(speech: unknown): string[] {
  const list = (speech as { words?: unknown } | null)?.words;
  return Array.isArray(list) ? list.map((w) => String((w as { id?: unknown })?.id ?? '')) : [];
}

/** Sentences stored in the body: ID → words (`first`/`last` are a closed range in word order, or `wordIds` is given directly). */
function storedSentences(speech: unknown, words: string[], position: ReadonlyMap<string, number>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const list = (speech as { sentences?: unknown } | null)?.sentences;
  if (!Array.isArray(list)) return out;
  for (const raw of list) {
    const s = raw as Json | null;
    if (!s || typeof s.id !== 'string') continue;
    const ids = Array.isArray(s.wordIds) ? s.wordIds.map(String) : sourceRange(s, words, position);
    if (ids?.length) out.set(s.id, ids);
  }
  return out;
}

/** `{ first, last }` → that span in word order; null if not found. */
function sourceRange(value: unknown, words: string[], position: ReadonlyMap<string, number>): string[] | null {
  const r = value as { first?: unknown; last?: unknown } | null;
  if (!r || typeof r.first !== 'string') return null;
  const a = position.get(r.first) ?? -1;
  const b = typeof r.last === 'string' ? (position.get(r.last) ?? -1) : a;
  return a >= 0 && b >= a ? words.slice(a, b + 1) : null;
}

/** The old sentence is the same sentence as this one: every word of this sentence is in the old sentence, and the old sentence has no words outside the span from this sentence's first word to its last (hidden words in between do not count as a difference). */
function sameSentence(old: Set<string>, position: ReadonlyMap<string, number>, sentence: SourceSentence): boolean {
  if (!sentence.wordIds.every((w) => old.has(w))) return false;
  const first = position.get(sentence.wordIds[0]!) ?? -1;
  const last = position.get(sentence.wordIds[sentence.wordIds.length - 1]!) ?? -1;
  return [...old].every((id) => {
    const index = position.get(id) ?? -1;
    return index >= first && index <= last;
  });
}

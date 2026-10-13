import { EditorWasmError, EditorWasmUnavailable, speechSentences as deriveSentences } from '@cuccut/editor-wasm';
import type { Id } from '@cuccut/protocol';

/**
 * Reading and editing of the translation document (video format spec §5.3, `cuccut.translation/2`) on the UI side: the source sentences, each sentence's content fingerprint,
 * sentence-by-sentence pairing of source and translation, which sentence is stale, and editing one translation in place.
 *
 * There is one rule set for source sentences and fingerprints: the derivation in the captions and translation core (`speech-doc`), called through `@cuccut/editor-wasm` as the same WASM,
 * the same code the translation pipeline uses when freezing the source, the Speech Worker uses when writing the translation, and dubbing uses when judging staleness (§5.2: a pause of at least 1.8 seconds, a speaker change,
 * and sentence-ending punctuation split; semicolons do not; `sentences` stored in the body are not used; the fingerprint has the form `<word count>:<first word ID>:<last word ID>:<FNV-1a>`).
 */

export const TRANSLATION_SCHEMA = 'cuccut.translation/2';
export const SPEECH_SCHEMA = 'cuccut.speech/1';

// ---- Source sentences ----

export interface SourceSentence {
  /** `s-<first word ID>`. */
  id: Id;
  /** Visible words in the sentence, in word order. */
  wordIds: Id[];
  text: string;
  /** The core's content fingerprint; compared with the translation unit's `sourceFingerprint`, a difference means the source sentence has changed. */
  fingerprint: string;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The sentences of the transcript body together with their fingerprints (synchronous: the WASM is instantiated synchronously on the first call). null when the body is not a valid `cuccut.speech/1`, or when the WASM has not been built;
 * the UI then treats it as unreadable source and does not guess sentences.
 */
export function speechSentences(body: unknown): SourceSentence[] | null {
  if (!isObject(body) || body.schema !== SPEECH_SCHEMA) return null;
  try {
    return deriveSentences(body).sentences.map((s) => ({ id: s.id, wordIds: s.wordIds, text: s.text, fingerprint: s.fingerprint }));
  } catch (error) {
    if (error instanceof EditorWasmError || error instanceof EditorWasmUnavailable) return null;
    throw error;
  }
}

/** SHA-256 (hex) of UTF-8 text. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Digest of the translation text (`alignment.textHash`, §5.3), unrelated to the sentence fingerprint. */
export async function textHash(text: string): Promise<string> {
  return `sha256:${await sha256Hex(text)}`;
}

// ---- Translation ----

export interface TranslationUnit {
  id: Id;
  sourceSentenceId: Id;
  sourceFingerprint: string;
  naturalText: string;
  displayRewrite?: { text: string; reason: string; reviewed: boolean };
  alignment: {
    basis: 'natural' | 'display-rewrite';
    correspondence: 'block' | 'sentence';
    blocks: unknown[];
    sourceWordIds: Id[];
    textHash: string;
  } | null;
  status: 'draft' | 'reviewed' | 'stale';
}

export interface TranslationBody {
  schema: typeof TRANSLATION_SCHEMA;
  language: string;
  sourceBasis: { speechRef: { id: Id; revision: string }; sequenceId: Id; scopeLineage: Id[]; editViewHash: string };
  glossaryRef?: unknown;
  units: TranslationUnit[];
}

/** Reads the translation body of `/2`; other formats (`/1` from older projects) return null, and the UI only reads them without editing. */
export function readTranslation(body: unknown): TranslationBody | null {
  if (!isObject(body) || body.schema !== TRANSLATION_SCHEMA || !Array.isArray(body.units)) return null;
  const units = body.units.filter(
    (u): u is TranslationUnit =>
      isObject(u) && typeof u.id === 'string' && typeof u.sourceSentenceId === 'string' && typeof u.naturalText === 'string',
  );
  return units.length === body.units.length ? (body as unknown as TranslationBody) : null;
}

/** The translation used for the picture and export: the caption display rewrite is used when present (same way as the bilingual merge in §5.3). */
export function unitText(unit: Pick<TranslationUnit, 'naturalText' | 'displayRewrite'>): string {
  return (unit.displayRewrite?.text || unit.naturalText).trim();
}

/**
 * State of one translated sentence (in the order that jobs' dub.ts uses to judge staleness):
 * - `marked-stale`: the document marks it `status: 'stale'`;
 * - `sentence-gone`: the source sentence is no longer in the transcript;
 * - `source-changed`: the source sentence's content fingerprint differs from the one at translation time (text changed, words added or removed);
 * - `empty`: no translation;
 * - `untranslated`: the source sentence has no corresponding translation unit yet (a sentence that appeared after translating).
 */
export type UnitState = 'ok' | 'marked-stale' | 'sentence-gone' | 'source-changed' | 'empty' | 'untranslated';

export function unitState(unit: TranslationUnit | null, sentence: SourceSentence | null): UnitState {
  if (!unit) return 'untranslated';
  if (unit.status === 'stale') return 'marked-stale';
  if (!sentence) return 'sentence-gone';
  if (sentence.fingerprint !== unit.sourceFingerprint) return 'source-changed';
  if (unitText(unit) === '') return 'empty';
  return 'ok';
}

/** Stale: marked stale, or the source sentence has changed. */
export const isStale = (state: UnitState) => state === 'marked-stale' || state === 'source-changed';

export interface PairRow {
  key: string;
  sentence: SourceSentence | null;
  unit: TranslationUnit | null;
  state: UnitState;
}

/**
 * Source and translation paired sentence by sentence: in the transcript's sentence order; translation units whose source sentence is gone are placed after the unit that preceded them in the translation;
 * sentences that appeared after translating and have no translation yet are also listed (state `untranslated`).
 */
export function pairRows(sentences: readonly SourceSentence[], translation: TranslationBody): PairRow[] {
  const bySentence = new Map<Id, TranslationUnit>();
  for (const unit of translation.units) if (!bySentence.has(unit.sourceSentenceId)) bySentence.set(unit.sourceSentenceId, unit);
  const known = new Set(sentences.map((s) => s.id));
  // A unit whose source sentence is gone hangs after the sentence of the previous unit that still exists; one missing from the very start hangs on ''.
  const orphans = new Map<string, TranslationUnit[]>();
  let anchor = '';
  for (const unit of translation.units) {
    if (known.has(unit.sourceSentenceId) && bySentence.get(unit.sourceSentenceId) === unit) {
      anchor = unit.sourceSentenceId;
      continue;
    }
    orphans.set(anchor, [...(orphans.get(anchor) ?? []), unit]);
  }
  const gone = (anchorId: string): PairRow[] =>
    (orphans.get(anchorId) ?? []).map((unit) => {
      // One sentence matched by two units (duplicate units): the later one also counts as its source still existing; it is just no longer paired.
      const sentence = sentences.find((s) => s.id === unit.sourceSentenceId) ?? null;
      return { key: unit.id, sentence, unit, state: unitState(unit, sentence) };
    });
  const rows: PairRow[] = [...gone('')];
  for (const sentence of sentences) {
    const unit = bySentence.get(sentence.id) ?? null;
    rows.push({ key: unit?.id ?? `s:${sentence.id}`, sentence, unit, state: unitState(unit, sentence) });
    rows.push(...gone(sentence.id));
  }
  return rows;
}

export interface PairStats {
  /** Rows that have a source sentence. */
  sentences: number;
  /** Sentences without a translation yet (no unit, or the translation is empty). */
  untranslated: number;
  /** Stale translations. */
  stale: number;
  /** Translations whose source sentence is no longer there. */
  gone: number;
}

export function pairStats(rows: readonly PairRow[]): PairStats {
  return {
    sentences: rows.filter((r) => r.sentence && r.state !== 'sentence-gone').length,
    untranslated: rows.filter((r) => r.state === 'untranslated' || r.state === 'empty').length,
    stale: rows.filter((r) => isStale(r.state)).length,
    gone: rows.filter((r) => r.state === 'sentence-gone').length,
  };
}

// ---- Edit one sentence ----

/** Rows that can be edited in place: the source sentence still exists. Units whose source sentence is gone are read-only (an edit would have nowhere to go). */
export const editableRow = (row: PairRow) => row.sentence !== null && row.state !== 'sentence-gone';

/**
 * Edits one translation in place, returning the new body and the changed unit; null when the text is unchanged or this row cannot be edited.
 *
 * - A unit with a caption display rewrite edits the rewrite (`naturalText` is untouched; §5.3: a rewrite must not overwrite the natural translation); otherwise `naturalText` is edited and `textHash` is updated.
 * - An edited unit is marked `reviewed`. If the source sentence changed or was marked stale, the user edits against the current source, and the unit's fingerprint and word members are replaced with those of the current sentence.
 * - A sentence without a translation gets a new unit, inserted after the unit of the nearest preceding sentence that already has a translation.
 */
export async function editUnit(
  body: TranslationBody,
  sentences: readonly SourceSentence[],
  row: PairRow,
  text: string,
): Promise<{ body: TranslationBody; unit: TranslationUnit } | null> {
  if (!editableRow(row)) return null;
  const sentence = row.sentence!;
  const value = text.trim();
  const current = row.unit;
  if (current) {
    if (value === unitText(current)) return null;
    const rebind = row.state === 'source-changed' || row.state === 'marked-stale';
    const alignment = current.alignment ? { ...current.alignment, ...(rebind ? { sourceWordIds: [...sentence.wordIds] } : {}) } : null;
    let next: TranslationUnit;
    if (current.displayRewrite) {
      next = { ...current, displayRewrite: { ...current.displayRewrite, text: value, reviewed: true }, alignment };
    } else {
      next = { ...current, naturalText: value, alignment: alignment ? { ...alignment, textHash: await textHash(value) } : null };
    }
    next = { ...next, status: 'reviewed', ...(rebind ? { sourceFingerprint: sentence.fingerprint } : {}) };
    return { body: { ...body, units: body.units.map((u) => (u === current ? next : u)) }, unit: next };
  }
  if (value === '') return null;
  const ids = new Set(body.units.map((u) => u.id));
  let id = `t-${sentence.id}`;
  for (let n = 2; ids.has(id); n++) id = `t-${sentence.id}-${n}`;
  const unit: TranslationUnit = {
    id,
    sourceSentenceId: sentence.id,
    sourceFingerprint: sentence.fingerprint,
    naturalText: value,
    alignment: {
      basis: 'natural',
      correspondence: 'sentence',
      blocks: [],
      sourceWordIds: [...sentence.wordIds],
      textHash: await textHash(value),
    },
    status: 'reviewed',
  };
  // Inserted after the unit of the nearest preceding sentence that already has a translation; placed at the very front when there is none before it.
  const order = sentences.findIndex((s) => s.id === sentence.id);
  let at = 0;
  for (let i = order - 1; i >= 0; i--) {
    const found = body.units.findIndex((u) => u.sourceSentenceId === sentences[i]!.id);
    if (found >= 0) {
      at = found + 1;
      break;
    }
  }
  const units = [...body.units.slice(0, at), unit, ...body.units.slice(at)];
  return { body: { ...body, units }, unit };
}

/**
 * Marks a translation stale or clears the stale mark (product design §5.10 “Sentence-by-sentence and stale translations”): “stale” and “to be translated” are the same mark (`status: 'stale'`), and both refreshing stale
 * translations and handing off to an agent will retranslate it. Only the unit's status is changed; returns the new body and the changed unit; null when it is already in that state or this row has no unit.
 *
 * Clearing the mark means accepting this sentence's current translation: it is recorded as `reviewed`. If the source sentence changed (different fingerprint), the same `editUnit` gets the fingerprint and word members of the current sentence;
 * otherwise the mark would be cleared but the sentence would still be stale (`rebound` is true, and this sentence's cues in the captions must be re-cut against the new words).
 */
export function markUnit(
  body: TranslationBody,
  row: PairRow,
  on: boolean,
): { body: TranslationBody; unit: TranslationUnit; rebound: boolean } | null {
  const current = row.unit;
  if (!current || !editableRow(row)) return null;
  const sentence = row.sentence!;
  let next: TranslationUnit;
  let rebound = false;
  if (on) {
    if (current.status === 'stale') return null;
    next = { ...current, status: 'stale' };
  } else {
    if (!isStale(row.state)) return null;
    rebound = current.sourceFingerprint !== sentence.fingerprint;
    next = rebound
      ? {
          ...current,
          status: 'reviewed',
          sourceFingerprint: sentence.fingerprint,
          alignment: current.alignment ? { ...current.alignment, sourceWordIds: [...sentence.wordIds] } : null,
        }
      : { ...current, status: 'reviewed' };
  }
  return { body: { ...body, units: body.units.map((u) => (u === current ? next : u)) }, unit: next, rebound };
}

/** Sentences to retranslate (the scope of a batch retranslation, same as the Runtime's in-place refresh when no sentences are named): stale ones and ones without a translation yet. */
export const needsTranslation = (row: PairRow) => isStale(row.state) || row.state === 'untranslated' || row.state === 'empty';

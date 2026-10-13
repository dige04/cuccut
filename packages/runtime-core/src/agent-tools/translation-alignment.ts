import type { DocumentRecord, Id } from '@cuccut/protocol';
import { EditorWasmUnavailable, sha256Hex, sourceSentences } from '@cuccut/jobs';

/**
 * Sentence-level alignment the Runtime fills in when an agent writes a translation (video format spec §5.3;
 * `documents_read` in architecture design §3.5).
 *
 * An agent translating on its own writes units per sentence and does no block-level alignment; with `alignment` null,
 * export has to re-derive members per sentence and `captions_create` cannot cut timing. When `putDocument` in
 * `edits_apply` writes `cuccut.translation/2`, this finds each unit's `sourceSentenceId` in the transcript it was
 * translated from (the same rules as `translationBasis` in `documents_read`, via editor-wasm) and fills null with a
 * sentence-level alignment `{basis:'natural', correspondence:'sentence', blocks:[], sourceWordIds:<that sentence's words>, textHash}`;
 * an alignment that is written but lacks `sourceWordIds` or `textHash` is completed the same way, and the `textHash` of a
 * sentence-level alignment without blocks is recomputed from the translation.
 *
 * Only units that check out are filled: the sentence is found in the transcript and the unit's `sourceFingerprint` equals
 * that sentence's (or is not written). Stale units, sentences not found and mismatched fingerprints are left alone; when
 * the transcript cannot be read or the sentence WASM is not built, only the missing `textHash` of a written alignment
 * object is filled, and everything else goes to the engine as is. `textHash` is `"sha256:"` plus the hex UTF-8 SHA-256 of
 * the translation (`naturalText`), the same check the translation pipeline uses.
 */

/** Reads a transcript body: that revision when one is given. Throws when it cannot be read. */
export type SpeechBodyReader = (documentId: Id, revision?: string) => Promise<unknown>;

type Json = Record<string, unknown>;

const TRANSLATION_V2 = 'cuccut.translation/2';

/**
 * Fills alignments for translation `putDocument`s in `operations` (already normalized, before going to the engine);
 * returns how many units were filled. Changes are written to a new `body` object (replacing `op.body`); the caller's body
 * is not mutated.
 */
export async function fillTranslationAlignments(
  operations: Record<string, unknown>[],
  documents: Readonly<Record<Id, DocumentRecord>>,
  readSpeech: SpeechBodyReader,
): Promise<number> {
  let filled = 0;
  for (const op of operations) {
    if (op.type !== 'putDocument' || op.kind !== 'translation') continue;
    const body = op.body as Json | null | undefined;
    if (!body || typeof body !== 'object' || body.schema !== TRANSLATION_V2 || !Array.isArray(body.units)) continue;
    const speechRef = (body.sourceBasis as { speechRef?: { id?: unknown; revision?: unknown } } | undefined)?.speechRef;
    const speechId =
      stringOf((op.sourceDocument as { documentId?: unknown } | undefined)?.documentId) ??
      stringOf(speechRef?.id) ??
      (typeof op.documentId === 'string' ? (documents[op.documentId]?.sourceDocumentId ?? null) : null);
    // When sentences cannot be read, fill only the sentence-independent `textHash` (where an alignment object is written without it).
    const sentences = (speechId ? await sentencesOf(readSpeech, speechId, stringOf(speechRef?.revision) ?? undefined) : null) ?? new Map();
    let changed = 0;
    const units = (body.units as unknown[]).map((raw) => {
      const next = filledUnit(raw, sentences);
      if (next !== raw) changed++;
      return next;
    });
    if (changed) {
      op.body = { ...body, units };
      filled += changed;
    }
  }
  return filled;
}

type Sentences = Map<string, { fingerprint: string; wordIds: string[] }>;

/** That transcript revision's sentences; null when it cannot be read (first the recorded revision, then the current one), the body is invalid, or the WASM is missing. */
async function sentencesOf(readSpeech: SpeechBodyReader, speechId: Id, revision: string | undefined): Promise<Sentences | null> {
  let body: unknown;
  try {
    body = await readSpeech(speechId, revision);
  } catch {
    if (revision === undefined) return null;
    try {
      body = await readSpeech(speechId);
    } catch {
      return null;
    }
  }
  let read: ReturnType<typeof sourceSentences>;
  try {
    read = sourceSentences(body);
  } catch (error) {
    if (error instanceof EditorWasmUnavailable) return null;
    throw error;
  }
  if ('problem' in read) return null;
  return new Map(read.sentences.map((s) => [s.id, { fingerprint: s.fingerprint, wordIds: [...s.wordIds] }]));
}

/** The filled unit; returns the same object unchanged when nothing needs or can be filled. */
function filledUnit(raw: unknown, sentences: Sentences): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const unit = raw as Json;
  if (unit.status === 'stale' || typeof unit.naturalText !== 'string' || unit.naturalText.trim() === '') return raw;
  const textHash = `sha256:${sha256Hex(unit.naturalText)}`;
  const sentence = typeof unit.sourceSentenceId === 'string' ? sentences.get(unit.sourceSentenceId) : undefined;
  const matches =
    sentence !== undefined &&
    (typeof unit.sourceFingerprint !== 'string' || unit.sourceFingerprint === '' || unit.sourceFingerprint === sentence.fingerprint);
  const alignment = unit.alignment;
  if (alignment === null || alignment === undefined) {
    if (!matches) return raw;
    return {
      ...unit,
      alignment: { basis: 'natural', correspondence: 'sentence', blocks: [], sourceWordIds: sentence.wordIds, textHash },
    };
  }
  if (typeof alignment !== 'object' || Array.isArray(alignment)) return raw;
  const a = alignment as Json;
  const next: Json = { ...a };
  if (!Array.isArray(a.sourceWordIds) && matches) next.sourceWordIds = sentence.wordIds;
  // A sentence-level alignment with no blocks and no split only tracks the whole sentence: when the translation changes, textHash is recomputed from it. Block-level ones are left alone (block correspondence needs realigning).
  const sentenceLevel = a.correspondence === 'sentence' && Array.isArray(a.blocks) && a.blocks.length === 0 && a.split === undefined;
  if (typeof a.textHash !== 'string' || (sentenceLevel && a.textHash !== textHash)) next.textHash = textHash;
  const changed = next.sourceWordIds !== a.sourceWordIds || next.textHash !== a.textHash;
  return changed ? { ...unit, alignment: next } : raw;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

import { refOf, type Id, type Localized, type MessageRef } from '@cuccut/protocol';
import { JobsTranslationDocument as J } from '@cuccut/protocol/messages/jobs/translation-document.ts';
import { EditorWasmError, SENTENCE_DERIVATION, speechSentences, type SourceSentence } from '@cuccut/editor-wasm';
import { sha256Hex } from '../input-hash.ts';
import { joinList, withCause } from '../job-text.ts';
import { glossaryRefProblems, type GlossaryRef } from './translation-glossary.ts';

/**
 * Source and translation documents for the translation pipeline (video format spec §5.2, §5.3).
 *
 * Source: `cuccut.speech/1` sentences and content fingerprints follow one set of rules, `derive_sentences` in the subtitle and translation core (`speech-doc`), called through `@cuccut/editor-wasm` into the same Rust code (the UI and the Speech Worker use it too). Rules: sentences end at terminal punctuation (a semicolon does not end a sentence), a pause of at least 1.8 seconds, a speaker change, at most 80 words within a sentence, and breaks at segment and chapter boundaries. Hidden words are excluded from sentences. A `sentences` stored in the body is not used. Sentence IDs are `s-<first word ID>`. The fingerprint is `<word count>:<first word ID>:<last word ID>:<FNV-1a in base 36>`. `editViewHash` is a digest of the rule name `speech-doc/sentences` and every sentence's ID and fingerprint.
 *
 * Translation: `cuccut.translation/2`, with fields strictly as `TranslationDocumentVersion` in §5.3. `id` and `revision` are recorded by the document record and are not repeated in the body. When the whole transcript is translated at once, `sourceBasis.scopeLineage` is empty (the scope is the whole document).
 */

export { SENTENCE_DERIVATION, type SourceSentence };
export const TRANSLATION_SCHEMA = 'cuccut.translation/2';

/** Frozen source: which document and version, on which sequence, and how its sentences were split. Published as an artifact; later steps read only this. */
export interface FrozenSource {
  derivation: string;
  speechRef: { id: Id; revision: string };
  sequenceId: Id;
  language: string | null;
  editViewHash: string;
  /** The transcript body's `timescale`. Sentence `start` / `end` are measured in it. */
  timescale: number;
  sentences: SourceSentence[];
}

/**
 * Reads the sentences of a `speech` body. Returns problems when the body is not `cuccut.speech/1`, a word is missing its source time, or a speaker is invalid.
 * Throws `EditorWasmUnavailable` when the sentence and fingerprint WASM has not been built (run `npm run build:wasm` first).
 */
export function sourceSentences(
  body: unknown,
): { sentences: SourceSentence[]; derivation: string; editViewHash: string; timescale: number } | { problem: string; problemRef: MessageRef } {
  const speech = body as { schema?: unknown; words?: unknown } | null;
  if (!speech || typeof speech !== 'object' || speech.schema !== 'cuccut.speech/1' || !Array.isArray(speech.words)) {
    return problemOf(J.notSpeech());
  }
  try {
    const read = speechSentences(body);
    return { sentences: read.sentences, derivation: read.derivation, editViewHash: read.editViewHash, timescale: read.timescale };
  } catch (error) {
    if (error instanceof EditorWasmError) return problemOf(withCause(J.unreadable(), error));
    throw error;
  }
}

/** Explanation for a source that cannot be read: the text and its reference (`asLocalized(problem, problemRef)` can throw it along with the reference). */
function problemOf(text: Localized): { problem: string; problemRef: MessageRef } {
  return { problem: text.text, problemRef: refOf(text) };
}

/** Joins several lines of text into one sentence (used when a subtitle-file cue is sent to the model). Existing whitespace is kept as is; a space is inserted between two Latin letters or digits with no whitespace between them; no spaces are added for Chinese. */
export function joinWords(texts: string[]): string {
  let out = '';
  for (const text of texts) {
    if (
      out !== '' &&
      !/\s$/.test(out) &&
      !/^\s/.test(text) &&
      /[\p{Script=Latin}\d,.!?;:'"%)]$/u.test(out) &&
      /^[\p{Script=Latin}\d(]/u.test(text)
    ) {
      out += ' ';
    }
    out += text;
  }
  return out.replace(/\s+/g, ' ').trim();
}

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
  glossaryRef?: GlossaryRef;
  units: TranslationUnit[];
}

/**
 * Validates the translation body against §5.3 and checks that it corresponds sentence by sentence with the frozen source: each unit's sentence ID and fingerprint belong to that sentence, `sourceBasis` points to the same sequence, and `editViewHash` is the same (the translation's sentences are derived with the same rules here). Returns an empty array when there are no problems.
 */
export function translationProblems(body: unknown, source: FrozenSource): string[] {
  return documentProblems(body, source.speechRef, source);
}

/**
 * Validates only the shape of the translation body against §5.3 and the source version it points to, without checking sentences. Used when sentences are derived by rules elsewhere (the Speech Worker uses the subtitle and translation core's sentence rules, architecture design §7.9). When `only` is given, the per-unit check covers only those sentences (for an in-place refresh, the other units are carried back unchanged from the base).
 */
export function translationShapeProblems(body: unknown, speechRef: { id: Id; revision: string }, only?: ReadonlySet<Id>): string[] {
  return documentProblems(body, speechRef, null, only);
}

function documentProblems(
  body: unknown,
  speechRef: { id: Id; revision: string },
  source: FrozenSource | null,
  only?: ReadonlySet<Id>,
): string[] {
  const problems: string[] = [];
  const t = body as Partial<TranslationBody> | null;
  if (!t || typeof t !== 'object') return [J.notObject().text];
  if (t.schema !== TRANSLATION_SCHEMA) problems.push(J.schemaShouldBe({ schema: TRANSLATION_SCHEMA }).text);
  if (typeof t.language !== 'string' || t.language === '') problems.push(J.missingLanguage().text);
  const basis = t.sourceBasis;
  if (
    !basis ||
    basis.speechRef?.id !== speechRef.id ||
    basis.speechRef?.revision !== speechRef.revision ||
    typeof basis.sequenceId !== 'string' ||
    !Array.isArray(basis.scopeLineage) ||
    typeof basis.editViewHash !== 'string'
  ) {
    problems.push(J.basisMismatch().text);
  }
  if (source && basis && (basis.sequenceId !== source.sequenceId || basis.editViewHash !== source.editViewHash)) {
    problems.push(J.basisDerivationMismatch().text);
  }
  problems.push(...glossaryRefProblems(t.glossaryRef));
  if (!Array.isArray(t.units)) return [...problems, J.missingUnits().text];
  if (source && t.units.length !== source.sentences.length) {
    problems.push(J.unitCountMismatch({ units: t.units.length, sentences: source.sentences.length }).text);
  }
  const ids = new Set<string>();
  t.units.forEach((unit, i) => {
    if (ids.has(unit.id)) problems.push(J.unitDuplicate({ id: unit.id }).text);
    ids.add(unit.id);
    if (only && !only.has(unit.sourceSentenceId)) return;
    if (source) {
      const sentence = source.sentences[i];
      if (!sentence || unit.sourceSentenceId !== sentence.id || unit.sourceFingerprint !== sentence.fingerprint) {
        problems.push(J.unitSentenceMismatch({ n: i + 1 }).text);
      }
    } else if (
      typeof unit.sourceSentenceId !== 'string' ||
      unit.sourceSentenceId === '' ||
      typeof unit.sourceFingerprint !== 'string' ||
      unit.sourceFingerprint === ''
    ) {
      problems.push(J.unitMissingSource({ n: i + 1 }).text);
    }
    if (typeof unit.naturalText !== 'string' || unit.naturalText.trim() === '') problems.push(J.unitNoText({ id: unit.id }).text);
    if (!['draft', 'reviewed', 'stale'].includes(unit.status)) problems.push(J.unitBadStatus({ id: unit.id }).text);
    const a = unit.alignment;
    if (a !== null) {
      if (!a || !['natural', 'display-rewrite'].includes(a.basis) || !['block', 'sentence'].includes(a.correspondence)) {
        problems.push(J.unitBadAlignment({ id: unit.id }).text);
      } else if (!Array.isArray(a.blocks) || !Array.isArray(a.sourceWordIds) || typeof a.textHash !== 'string') {
        problems.push(J.unitAlignmentFields({ id: unit.id }).text);
      } else if (a.textHash !== `sha256:${sha256Hex(unit.naturalText)}`) {
        problems.push(J.unitHashMismatch({ id: unit.id }).text);
      }
    }
    const extra = Object.keys(unit).filter(
      (k) => !['id', 'sourceSentenceId', 'sourceFingerprint', 'naturalText', 'displayRewrite', 'alignment', 'status'].includes(k),
    );
    if (extra.length > 0) problems.push(J.unitExtraFields({ id: unit.id, fields: joinList(extra) }).text);
  });
  const extra = Object.keys(t).filter((k) => !['schema', 'language', 'sourceBasis', 'glossaryRef', 'units'].includes(k));
  if (extra.length > 0) problems.push(J.bodyExtraFields({ fields: joinList(extra) }).text);
  return problems;
}

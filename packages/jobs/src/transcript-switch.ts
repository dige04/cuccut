import type {
  DocumentRecord,
  EditOperation,
  Id,
  TranscriptCarryDub,
  TranscriptCarryTranslation,
  TranscriptReplace,
  TranscriptSwitchImpact,
} from '@cuccut/protocol';
import { EditorWasmError, speechSentences, type SourceSentence, type SpeechSentences } from '@cuccut/editor-wasm';
import { JobsTranscribe } from '@cuccut/protocol/messages/jobs/transcribe.ts';
import { sha256Hex } from './input-hash.ts';
import { ApplyRejected, StaleInput } from './job-application.ts';
import { withCause } from './job-text.ts';
import { captionBody, deriveCues, readSpeechWords, translationCues, type CueTranslationUnit } from './pipelines/caption-cues.ts';
import { SPEECH_CAPTION_EXTENSION, TRANSLATION_CAPTION_EXTENSION } from './pipelines/caption-layer.ts';
import { DUB_EXTENSION } from './pipelines/dub.ts';
import { TRANSLATION_SCHEMA, type TranslationBody, type TranslationUnit } from './pipelines/translation-document.ts';

/**
 * Switching the transcript (architecture design §6.6; `destination: 'replace'` in the transcription flow): when the transcription Job applies its result, one transaction writes a new revision of the existing `speech` document and carries over the content that depends on it. This only computes the operations and does not commit; Application validates the revision, commits, and records the receipt as usual.
 *
 * - Manual-edit gate: before applying, re-read the current transcript. If its full-text fingerprint (same method as `stages.asr`) is no longer the one from commit time, reject it (`TRANSCRIPT_EDITED`). The `acceptEdited` passed at commit only covers the fingerprint at that moment.
 * - Translations (video format spec §5.3, "carry-over when the source transcript gets a new revision"): old and new sentences are paired greedily by overlap on the media clock. Pairs whose normalized source text is identical keep their translation and status, and their alignment is downgraded to sentence level. Changed sentences, and new sentences left unpaired, are marked stale. Old sentences left unpaired are not carried over. Each language writes a new revision of the same document.
 * - Subtitles: subtitle documents derived from this transcript and from the carried-over translations are re-cut against the new transcript (same cutting method as the flow uses when creating the subtitle track). Other fields and styles in the body are left alone.
 * - The body's `userBreaks` and `paragraphBreaks` (§5.5) are re-anchored by time. If the midpoint of an old word's source time interval falls within a new word, and the two words have identical normalized text, the entry moves to that new word. Otherwise the entry stays as-is (it points at a nonexistent word, so it has no effect) and is counted as `orphaned`. `layoutProfileId` is carried over unchanged.
 * - The dubbing plan (§7.2) is carried over with the translation. Units whose source is unchanged get new IDs and new sentences, with audio and other fields kept. Units whose source changed are marked stale and lose their dialogue.
 *
 * Version numbers: later operations in the same transaction must reference the new revision numbers of the transcript and translations (`speechRef.revision`, `translationRef.revision`), but revision numbers are assigned by the engine. Here they are predicted as the largest numeric revision in the document record + 1 (the engine's rule). Revisions that were undone impose a separate floor that is not visible in the record, so in that case the prediction can come out low.
 */

export const TRANSCRIPT_SWITCH_EXTENSION = 'cuccut.transcriptSwitch';

/** Video capability to read when switching transcripts. */
export interface SwitchVideos {
  state?(videoId: Id): { revision: string; documents: Record<Id, DocumentRecord> } | null;
  document?(videoId: Id, documentId: Id, revision?: string): Promise<{ revision: string; body: unknown }>;
}

type PutDocument = Extract<EditOperation, { type: 'putDocument' }>;

interface Word {
  id: string;
  start: number;
  end: number;
  text: string;
  timingQuality?: string;
}

interface SpeechBody {
  schema: string;
  timescale?: number;
  words: Word[];
  userBreaks?: Record<string, 'break' | 'no-break'>;
  paragraphBreaks?: string[];
  layoutProfileId?: string;
  stages?: Record<string, unknown>;
  [key: string]: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Full-text fingerprint of the transcript body (the core `fingerprint`, including hidden words). Throws `EditorWasmError` when the WASM build is missing or the body cannot be read. */
export function contentFingerprint(body: unknown): string {
  return speechSentences(body).contentFingerprint;
}

/** The `stages.asr` recorded on the body; null when absent (for example, a transcript written earlier by this Runtime, which is treated as unedited). */
export function asrStage(body: unknown): string | null {
  const stages = isObject(body) ? body.stages : undefined;
  const asr = isObject(stages) ? stages.asr : undefined;
  return typeof asr === 'string' && asr !== '' ? asr : null;
}

/** Normalized text (§5.3): strips punctuation and whitespace, applies NFKC, then case folding (uppercase, then lowercase, approximating Unicode full case folding). */
export function normalizeText(text: string): string {
  const strip = (s: string) => s.replace(/[\p{P}\s]/gu, '');
  // NFKC can turn full-width or compatibility characters into punctuation or whitespace forms, so strip again after it runs.
  return strip(strip(text).normalize('NFKC').toUpperCase().toLowerCase());
}

/** The next revision number of a document (the engine's rule: largest numeric revision in the record + 1; the floor left by undone revisions is not visible). */
export function nextRevision(record: DocumentRecord): string {
  const numbers = Object.keys(record.revisions)
    .map((r) => Number(r))
    .filter((n) => Number.isInteger(n));
  return String(Math.max(0, ...numbers) + 1);
}

/**
 * Pairs old and new sentences (§5.3) by media clock (seconds, each in its own `timescale`). Sentences that overlap are candidates. An overlap shorter than half the duration of the shorter of the two sentences does not count. Among all candidates, the pair with the longest overlap is paired first, and paired sentences take no further part. Returns new-sentence index → old-sentence index. For equal overlaps, order follows old sentences first, then new sentences.
 */
export function pairSentences(
  previous: readonly Pick<SourceSentence, 'start' | 'end'>[],
  previousScale: number,
  next: readonly Pick<SourceSentence, 'start' | 'end'>[],
  nextScale: number,
): Map<number, number> {
  const a = previous.map((s) => ({ start: s.start / previousScale, end: s.end / previousScale }));
  const b = next.map((s) => ({ start: s.start / nextScale, end: s.end / nextScale }));
  const order = b.map((_, j) => j).sort((x, y) => b[x]!.start - b[y]!.start || x - y);
  const candidates: { i: number; j: number; overlap: number }[] = [];
  a.forEach((old, i) => {
    for (const j of order) {
      const cur = b[j]!;
      if (cur.start >= old.end) break;
      const overlap = Math.min(old.end, cur.end) - Math.max(old.start, cur.start);
      if (overlap <= 0) continue;
      const shorter = Math.min(old.end - old.start, cur.end - cur.start);
      if (overlap >= shorter / 2) candidates.push({ i, j, overlap });
    }
  });
  candidates.sort((x, y) => y.overlap - x.overlap || x.i - y.i || x.j - y.j);
  const usedOld = new Set<number>();
  const pairs = new Map<number, number>();
  for (const c of candidates) {
    if (usedOld.has(c.i) || pairs.has(c.j)) continue;
    usedOld.add(c.i);
    pairs.set(c.j, c.i);
  }
  return pairs;
}

/** Which new unit an old unit maps to: the new sentence, and whether its source text is unchanged. */
export interface UnitMove {
  unitId: Id;
  sentence: SourceSentence;
  same: boolean;
}

/**
 * Carries over the translation for one language (§5.3). `speechRevision` is the new transcript's revision number; `editViewHash` is recomputed from the new sentences. Returns the new body, the counts, and the mapping from old units to new units (used by the dubbing plan).
 */
export function carryTranslation(
  body: TranslationBody,
  previous: readonly SourceSentence[],
  next: SpeechSentences,
  pairs: ReadonlyMap<number, number>,
  speechRef: { id: Id; revision: string },
): { body: TranslationBody; counts: Omit<TranscriptCarryTranslation, 'language' | 'documentId'>; moves: Map<Id, UnitMove> } {
  const unitBySentence = new Map<Id, TranslationUnit>();
  for (const unit of body.units) if (!unitBySentence.has(unit.sourceSentenceId)) unitBySentence.set(unit.sourceSentenceId, unit);
  const counts = { kept: 0, keptReviewed: 0, stale: 0, unmatched: 0 };
  const moves = new Map<Id, UnitMove>();
  const alignment = (sentence: SourceSentence, basis: 'natural' | 'display-rewrite', text: string): TranslationUnit['alignment'] => ({
    basis,
    correspondence: 'sentence',
    blocks: [],
    sourceWordIds: [...sentence.wordIds],
    textHash: `sha256:${sha256Hex(text)}`,
  });
  const units = next.sentences.map((sentence, j): TranslationUnit => {
    const id = `t-${sentence.id}`;
    const i = pairs.get(j);
    const old = i === undefined ? undefined : unitBySentence.get(previous[i]!.id);
    if (!old) {
      counts.unmatched++;
      counts.stale++;
      return {
        id,
        sourceSentenceId: sentence.id,
        sourceFingerprint: sentence.fingerprint,
        naturalText: '',
        alignment: alignment(sentence, 'natural', ''),
        status: 'stale',
      };
    }
    const same = normalizeText(previous[i!]!.text) === normalizeText(sentence.text);
    moves.set(old.id, { unitId: id, sentence, same });
    // Fields in a unit that are not recognized are carried over as-is. IDs, source sentence, alignment and status are replaced according to the rules.
    const { displayRewrite, alignment: oldAlignment, ...rest } = old;
    if (same) {
      const status = old.status;
      if (status === 'stale') counts.stale++;
      else {
        counts.kept++;
        if (status === 'reviewed') counts.keptReviewed++;
      }
      return {
        ...rest,
        id,
        sourceSentenceId: sentence.id,
        sourceFingerprint: sentence.fingerprint,
        ...(displayRewrite ? { displayRewrite } : {}),
        alignment: alignment(sentence, oldAlignment?.basis ?? 'natural', old.naturalText),
        status,
      };
    }
    counts.stale++;
    return {
      ...rest,
      id,
      sourceSentenceId: sentence.id,
      sourceFingerprint: sentence.fingerprint,
      alignment: alignment(sentence, 'natural', old.naturalText),
      status: 'stale',
    };
  });
  return {
    body: { ...body, sourceBasis: { ...body.sourceBasis, speechRef, editViewHash: next.editViewHash }, units },
    counts,
    moves,
  };
}

/**
 * `userBreaks` and `paragraphBreaks` are re-anchored by time (§5.5). Entries that cannot be re-anchored are kept as-is (all new words have new IDs, so they have no effect).
 * An old word with no source time (`timingQuality: 'missing'`) cannot be anchored. Entries in the old body that already point at nonexistent words are kept as-is and not counted.
 */
export function reanchorBreaks(
  previous: SpeechBody,
  next: SpeechBody,
): { userBreaks?: SpeechBody['userBreaks']; paragraphBreaks?: string[]; reanchored: number; orphaned: number } {
  const oldScale = previous.timescale || 1_000_000;
  const newScale = next.timescale || 1_000_000;
  const oldWords = new Map(previous.words.map((w) => [w.id, w]));
  const newWords = [...next.words].sort((x, y) => x.start - y.start);
  let reanchored = 0;
  let orphaned = 0;
  const move = (wordId: string): string => {
    const old = oldWords.get(wordId);
    if (!old) return wordId;
    const target = old.timingQuality === 'missing' ? undefined : matchWord(old, oldScale, newWords, newScale);
    if (target) {
      reanchored++;
      return target;
    }
    orphaned++;
    return wordId;
  };
  const out: { userBreaks?: SpeechBody['userBreaks']; paragraphBreaks?: string[] } = {};
  if (isObject(previous.userBreaks) && Object.keys(previous.userBreaks).length) {
    const breaks: Record<string, 'break' | 'no-break'> = {};
    for (const [wordId, value] of Object.entries(previous.userBreaks)) {
      const key = move(wordId);
      // Two old words anchor to the same new word: the one that comes first is kept.
      if (!(key in breaks)) breaks[key] = value;
    }
    out.userBreaks = breaks;
  }
  if (Array.isArray(previous.paragraphBreaks) && previous.paragraphBreaks.length) {
    out.paragraphBreaks = [...new Set(previous.paragraphBreaks.map(move))];
  }
  return { ...out, reanchored, orphaned };
}

function matchWord(old: Word, oldScale: number, words: readonly Word[], scale: number): string | undefined {
  const mid = (old.start + old.end) / 2 / oldScale;
  const text = normalizeText(old.text);
  for (const word of words) {
    const start = word.start / scale;
    if (start > mid) break;
    if (mid < word.end / scale && word.timingQuality !== 'missing' && normalizeText(word.text) === text) return word.id;
  }
  return undefined;
}

/** The dubbing plan is carried over with the translation (§7.2). Returns the new body and the counts; units that were not paired are not carried over. */
export function carryDubPlan(
  body: Record<string, unknown>,
  moves: ReadonlyMap<Id, UnitMove>,
  refs: { translation: { id: Id; revision: string }; speech: { id: Id; revision: string } },
): { body: Record<string, unknown>; kept: number; stale: number } {
  let kept = 0;
  let stale = 0;
  const units = (Array.isArray(body.units) ? body.units : []).flatMap((raw): Record<string, unknown>[] => {
    if (!isObject(raw)) return [];
    const extensions = isObject(raw.extensions) ? raw.extensions : {};
    const dub = isObject(extensions[DUB_EXTENSION]) ? (extensions[DUB_EXTENSION] as Record<string, unknown>) : {};
    const unitId =
      typeof dub.translationUnitId === 'string' ? dub.translationUnitId : typeof raw.id === 'string' ? raw.id.replace(/^d-/, '') : '';
    const move = moves.get(unitId);
    if (!move) return [];
    const anchor = isObject(raw.targetAnchor) ? raw.targetAnchor : { kind: 'sentence', edge: 'start' };
    const moved = {
      ...raw,
      id: `d-${move.unitId}`,
      sourceSentenceIds: [move.sentence.id],
      sourceFingerprint: move.sentence.fingerprint,
      targetAnchor: { ...anchor, speechRef: refs.speech, sentenceId: move.sentence.id },
    };
    if (move.same) {
      if (raw.status === 'stale') stale++;
      else kept++;
      return [{ ...moved, extensions: { ...extensions, [DUB_EXTENSION]: { ...dub, translationUnitId: move.unitId } } }];
    }
    stale++;
    const { actualSamples: _samples, sampleRate: _rate, ...rest } = moved as Record<string, unknown>;
    return [
      {
        ...rest,
        script: null,
        status: 'stale',
        extensions: { ...extensions, [DUB_EXTENSION]: { translationUnitId: move.unitId, staleReason: 'source-changed' } },
      },
    ];
  });
  return { body: { ...body, translationRef: refs.translation, units }, kept, stale };
}

/**
 * All operations of the transaction that switches transcripts. `speech` is the new transcription's `putDocument` (the result of `speechDocumentOperation`, whose word IDs already differ from the old transcript).
 * The first operation returned writes it as a new revision of the existing document; the carry-overs follow. Throws `ApplyRejected` (`TRANSCRIPT_EDITED`) when the gate fails, and `StaleInput` when the transcript is missing or cannot be read.
 */
export async function planTranscriptSwitch(
  videos: SwitchVideos,
  input: { videoId: Id; replace: TranscriptReplace; speech: PutDocument; jobId: Id },
): Promise<{ operations: EditOperation[]; impact: TranscriptSwitchImpact }> {
  const { videoId, replace } = input;
  const state = videos.state?.(videoId);
  if (!state || !videos.document) throw new StaleInput(JobsTranscribe.replaceDocumentGone());
  const read = videos.document.bind(videos);
  const record = state.documents[replace.documentId];
  if (!record || record.kind !== 'speech') throw new StaleInput(JobsTranscribe.replaceDocumentGone());
  const current = await read(videoId, record.id);
  let previousSentences: SpeechSentences;
  try {
    previousSentences = speechSentences(current.body);
  } catch (error) {
    if (error instanceof EditorWasmError) throw new StaleInput(withCause(JobsTranscribe.transcriptUnreadable(), error));
    throw error;
  }
  if (previousSentences.contentFingerprint !== replace.fingerprint) {
    throw new ApplyRejected('TRANSCRIPT_EDITED', JobsTranscribe.transcriptEditedSinceSubmit(), {
      documentId: record.id,
      fingerprint: previousSentences.contentFingerprint,
      expected: replace.fingerprint,
    });
  }
  const previous = current.body as SpeechBody;
  const speechRef = { id: record.id, revision: nextRevision(record) };

  // New body: re-anchored line breaks and paragraphs, the layout profile, and `stages.asr` (the full-text fingerprint of the new words; other stages such as alignment are not carried over).
  const fresh = input.speech.body as SpeechBody;
  const breaks = reanchorBreaks(previous, fresh);
  const body: SpeechBody = {
    ...fresh,
    ...(breaks.userBreaks ? { userBreaks: breaks.userBreaks } : {}),
    ...(breaks.paragraphBreaks ? { paragraphBreaks: breaks.paragraphBreaks } : {}),
    ...(typeof previous.layoutProfileId === 'string' && previous.layoutProfileId ? { layoutProfileId: previous.layoutProfileId } : {}),
  };
  const nextSentences = speechSentences(body);
  body.stages = { ...(isObject(fresh.stages) ? fresh.stages : {}), asr: nextSentences.contentFingerprint };
  const pairs = pairSentences(previousSentences.sentences, previousSentences.timescale, nextSentences.sentences, nextSentences.timescale);

  const operations: EditOperation[] = [];
  const translations: TranscriptCarryTranslation[] = [];
  const dubs: TranscriptCarryDub[] = [];
  /** Carried-over translations: document → new revision number, and where the new and old units went. */
  const carried = new Map<Id, { revision: string; units: TranslationUnit[]; moves: Map<Id, UnitMove> }>();
  const documents = Object.values(state.documents).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (replace.translations === 'carry') {
    for (const doc of documents) {
      if (doc.kind !== 'translation' || doc.sourceDocumentId !== record.id) continue;
      const content = await read(videoId, doc.id);
      const translation = content.body as TranslationBody;
      // Old-project `/1` translations are paired by sentence ID, and their format cannot be converted to the alignment in `/2`. They are not carried over and stay on the old revision.
      if (!isObject(translation) || translation.schema !== TRANSLATION_SCHEMA || !Array.isArray(translation.units)) continue;
      const result = carryTranslation(translation, previousSentences.sentences, nextSentences, pairs, speechRef);
      const revision = nextRevision(doc);
      carried.set(doc.id, { revision, units: result.body.units, moves: result.moves });
      const summary = doc.revisions[doc.currentRevision]?.summary;
      operations.push({
        type: 'putDocument',
        documentId: doc.id,
        kind: doc.kind,
        body: result.body,
        ...(isObject(summary)
          ? { summary: { ...summary, ...('unitCount' in summary ? { unitCount: result.body.units.length } : {}) } }
          : {}),
      });
      translations.push({ language: translation.language ?? doc.language ?? '', documentId: doc.id, ...result.counts });
    }
  }

  // Subtitles: those derived from this transcript and from the carried-over translations are re-cut against the new body.
  const words = readSpeechWords(body);
  for (const doc of documents) {
    if (doc.kind !== 'caption' || !doc.sourceDocumentId || !words) continue;
    const fromSpeech = doc.sourceDocumentId === record.id;
    const translation = carried.get(doc.sourceDocumentId);
    if (!fromSpeech && !translation) continue;
    const content = await read(videoId, doc.id);
    if (!isObject(content.body)) continue;
    const cues = fromSpeech ? deriveCues(words.words) : translationCues(words, translation!.units.map(cueUnit));
    const extensions: Record<string, unknown> = {};
    const own = doc.extensions ?? {};
    if (isObject(own[SPEECH_CAPTION_EXTENSION])) {
      extensions[SPEECH_CAPTION_EXTENSION] = { ...own[SPEECH_CAPTION_EXTENSION], speechRevision: speechRef.revision };
    }
    if (translation && isObject(own[TRANSLATION_CAPTION_EXTENSION])) {
      extensions[TRANSLATION_CAPTION_EXTENSION] = {
        ...own[TRANSLATION_CAPTION_EXTENSION],
        translationRevision: translation.revision,
        speechRevision: speechRef.revision,
      };
    }
    const summary = doc.revisions[doc.currentRevision]?.summary;
    operations.push({
      type: 'putDocument',
      documentId: doc.id,
      kind: doc.kind,
      body: { ...content.body, ...(captionBody(cues, words.speakers) as Record<string, unknown>) },
      summary: { ...(isObject(summary) ? summary : {}), cueCount: cues.length },
      ...(Object.keys(extensions).length ? { extensions } : {}),
    });
  }

  // Dubbing plan: carried over together with the carried-over translation.
  for (const doc of documents) {
    if (doc.kind !== 'dubbing-plan' || !doc.sourceDocumentId) continue;
    const translation = carried.get(doc.sourceDocumentId);
    if (!translation) continue;
    const content = await read(videoId, doc.id);
    if (!isObject(content.body)) continue;
    const result = carryDubPlan(content.body, translation.moves, {
      translation: { id: doc.sourceDocumentId, revision: translation.revision },
      speech: speechRef,
    });
    const summary = doc.revisions[doc.currentRevision]?.summary;
    operations.push({
      type: 'putDocument',
      documentId: doc.id,
      kind: doc.kind,
      body: result.body,
      ...(isObject(summary) ? { summary: { ...summary, stale: result.stale } } : {}),
    });
    const language = typeof content.body.language === 'string' ? content.body.language : (doc.language ?? '');
    dubs.push({ language, documentId: doc.id, kept: result.kept, stale: result.stale });
  }

  const impact: TranscriptSwitchImpact = {
    translations,
    captionPins: { reanchored: breaks.reanchored, orphaned: breaks.orphaned },
    dubs,
  };
  // The transcript name keeps the user's name. The impact of the switch and the previous revision are recorded in the extension (written in the same transaction as this revision; the flow's summary reads it).
  const { name: _name, ...speech } = input.speech;
  operations.unshift({
    ...speech,
    documentId: record.id,
    body,
    extensions: {
      ...speech.extensions,
      [TRANSCRIPT_SWITCH_EXTENSION]: { jobId: input.jobId, previousRevision: replace.revision, revision: speechRef.revision, impact },
    },
  });
  return { operations, impact };
}

function cueUnit(unit: TranslationUnit): CueTranslationUnit {
  return {
    id: unit.id,
    naturalText: unit.naturalText,
    ...(unit.displayRewrite ? { displayRewrite: { text: unit.displayRewrite.text } } : {}),
    alignment: unit.alignment ? { sourceWordIds: unit.alignment.sourceWordIds } : null,
    status: unit.status,
  };
}

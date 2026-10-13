import path from 'node:path';
import { DUB_EXTENSION, EditorWasmUnavailable, sourceSentences } from '@cuccut/jobs';
import {
  framesToSeconds,
  itemAssetRefs,
  localizeText,
  mediaTimeToSeconds,
  posterFrame,
  sequenceDurationFrames,
  type Id,
  type MessageRef,
  type SpaceSearchDocumentKind,
  type VideoDubGroupFact,
  type VideoSnapshot,
  type VideoTranscriptFact,
  type VideoTranslationFact,
} from '@cuccut/protocol';
import type { PlannedDocument, TextEntry, TextPlan } from '../exports/export-plan.ts';
import { segmentsOf } from '../exports/text-export.ts';

/**
 * Turns the result of the engine's `videos.readContent` (snapshots and text documents) into a video in the content index (architecture design §5.11):
 * searchable segments, and the facts the derived state of the Space catalog needs (which materials are used on the timeline, which files linked materials point to). A pure function; does not touch the disk.
 *
 * - Transcripts and subtitles prefer the projection on the root sequence (same sentence splitting as export, `segmentsOf`), with sequence time. When the material for a document is not on the timeline (projection empty or errored), it falls back to the source time in the body text.
 * - Translations have no time of their own: they borrow the time of the transcript sentence they belong to. `cuccut.translation/2` matches by `sourceSentenceId`; when that sentence is not found (transcripts do not store sentences),
 *   it matches by aligned words (`alignment.sourceWordIds`) or by the first word in the sentence ID (`s-<word ID>`); `/1` matches by unit ID. Units marked stale are not collected.
 * - Chapters take the `kind: 'chapter'` markers on the root sequence, with their title and description.
 */

export interface ReadContentDocument extends Partial<PlannedDocument> {
  documentId: Id;
  kind: string;
  plan?: TextPlan | null;
  planError?: { code: string; message: string };
  /** The engine's English default explanation used when the body cannot be read, and its message reference. */
  error?: string;
  errorRef?: MessageRef;
}

export interface ReadContentResult {
  videoId: Id;
  name: string;
  revision: string;
  snapshot: VideoSnapshot;
  documents: ReadContentDocument[];
}

export interface ContentSegment {
  kind: SpaceSearchDocumentKind;
  documentId: Id | null;
  language: string | null;
  clock: 'sequence' | 'source';
  start: number;
  end: number;
  text: string;
  speaker: string | null;
}

/** Video facts used as candidate inputs for the Space catalog and tools. */
export interface VideoFacts {
  /** Materials referenced by instances on any sequence. */
  timelineAssetIds: Id[];
  /** Files that linked materials (any version) point to: absolute paths (relative paths are resolved against the video directory). */
  linkedFiles: { assetId: Id; name: string; path: string }[];
  /** Transcript: language, whether it has per-word timing, and whether it is on the timeline (candidate inputs for §7.9). */
  transcripts: VideoTranscriptFact[];
  /** Translation: target language, the transcript it was translated from, and the number of stale units. */
  translations: VideoTranslationFact[];
  /** Dubbing group: language, and the corresponding translation and transcript. */
  dubGroups: VideoDubGroupFact[];
  /**
   * The frame picked for the cover (`posterFrame`, used for Space thumbnails): material version, source time (seconds), the content digest that media analysis needs, media type and duration.
   * null when there is no visible video clip on the root sequence. Caches before format version 3 have no such item (`undefined`); it is re-read.
   */
  poster?: VideoPosterFact | null;
  /**
   * Duration of the root sequence (seconds, same `sequenceDurationFrames` as the agent tool's video summary) and canvas size: the `media` of a Space video entry.
   * null when the snapshot is incomplete. Caches before format version 4 have no such item (`undefined`); it is re-read.
   */
  timeline?: VideoTimelineFact | null;
  /**
   * Derivation source (child videos created by `videos.derive`, architecture design §3.5 “derived child videos”): taken from the summary of the current version of the `derivation` document; null if not derived.
   * Caches before storage format version 2 have no such item.
   */
  origin?: VideoOriginFact | null;
}

export interface VideoOriginFact {
  parentVideoId: Id;
  parentRevision: string;
  /** Idempotency key: a derivation with the same parent video version, the same range and the same settings recognizes this child video. */
  key: string;
  range: { start: number; end: number };
}

export interface VideoTimelineFact {
  durationSec: number;
  width: number;
  height: number;
}

export interface VideoPosterFact {
  assetId: Id;
  revision: string;
  at: number;
  contentHash: string;
  mediaType: string;
  durationSec: number | null;
}

export interface ExtractedContent {
  segments: ContentSegment[];
  facts: VideoFacts;
  /** Documents that could not be read: ID and reason. */
  problems: { documentId: Id; detail: string }[];
}

interface SpeechWord {
  id: string;
  text?: string;
  start?: number;
  end?: number;
  speaker?: string;
  hidden?: boolean;
}

interface SpeechBody {
  timescale?: number;
  words?: SpeechWord[];
  sentences?: Array<{ id: string; first?: string; last?: string; wordIds?: string[] }> | null;
}

interface CaptionBody {
  timescale?: number;
  cues?: Array<{ id: string; start?: number; end?: number; text?: string; speaker?: string }>;
}

interface TranslationBody {
  schema?: string;
  units?: Array<{
    id: string;
    // cuccut.translation/1
    text?: string;
    display?: string;
    // cuccut.translation/2
    sourceSentenceId?: string;
    naturalText?: string;
    displayRewrite?: { text?: string } | null;
    alignment?: { sourceWordIds?: string[] } | null;
    status?: string;
  }>;
}

type TimeSpan = { clock: 'sequence' | 'source'; start: number; end: number };

export function extractContent(result: ReadContentResult, videoDir: string): ExtractedContent {
  const segments: ContentSegment[] = [];
  const problems: { documentId: Id; detail: string }[] = [];
  /** For each transcript: sentence ID → time, used for translations. */
  const sentenceTimes = new Map<Id, Map<string, TimeSpan>>();
  /** For each transcript: word ID → time (the aligned words for translations). */
  const wordTimes = new Map<Id, Map<string, TimeSpan>>();
  const translations: ReadContentDocument[] = [];

  for (const doc of result.documents) {
    if (doc.error !== undefined) {
      problems.push({ documentId: doc.documentId, detail: localizeText(doc.error, doc.errorRef) });
      continue;
    }
    if (doc.schema === 'cuccut.translation/1' || doc.schema === 'cuccut.translation/2') {
      translations.push(doc);
      continue;
    }
    if (doc.schema !== 'cuccut.speech/1' && doc.schema !== 'cuccut.caption/1') continue;
    const kind: SpaceSearchDocumentKind = doc.schema === 'cuccut.speech/1' ? 'speech' : 'caption';
    const document = plannedOf(doc);
    let clock: 'sequence' | 'source' = 'sequence';
    let plan = doc.plan && doc.plan.entries.length > 0 ? doc.plan : null;
    if (!plan) {
      clock = 'source';
      plan = kind === 'speech' ? sourcePlanOfSpeech(doc) : sourcePlanOfCaption(doc);
    }
    if (!plan) continue;
    let pieces;
    try {
      pieces = segmentsOf({ primary: { document, plan }, secondary: null }, []);
    } catch (error) {
      problems.push({ documentId: doc.documentId, detail: String(error) });
      continue;
    }
    const times = new Map<string, TimeSpan>();
    for (const piece of pieces) {
      const text = piece.text.trim();
      if (piece.sentenceId !== null && !times.has(piece.sentenceId))
        times.set(piece.sentenceId, { clock, start: piece.start, end: piece.end });
      if (!text) continue;
      segments.push({
        kind,
        documentId: doc.documentId,
        language: doc.language ?? null,
        clock,
        start: round(piece.start),
        end: round(piece.end),
        text,
        speaker: piece.speaker,
      });
    }
    if (kind === 'speech') {
      sentenceTimes.set(doc.documentId, times);
      const words = new Map<string, TimeSpan>();
      for (const entry of plan.entries)
        if (entry.id && !words.has(entry.id)) words.set(entry.id, { clock, start: entry.start, end: entry.end });
      wordTimes.set(doc.documentId, words);
    }
  }

  for (const doc of translations) {
    const times = doc.sourceDocumentId ? sentenceTimes.get(doc.sourceDocumentId) : undefined;
    const words = doc.sourceDocumentId ? wordTimes.get(doc.sourceDocumentId) : undefined;
    const v2 = doc.schema === 'cuccut.translation/2';
    for (const unit of (doc.body as TranslationBody | null)?.units ?? []) {
      if (v2 && (unit.status === 'stale' || typeof unit.sourceSentenceId !== 'string')) continue;
      const text = (v2 ? unit.displayRewrite?.text?.trim() || unit.naturalText || '' : (unit.display ?? unit.text ?? '')).trim();
      if (!text) continue;
      const time = (v2 ? unitTime(unit.sourceSentenceId!, unit.alignment?.sourceWordIds, times, words) : times?.get(unit.id)) ?? {
        clock: 'source' as const,
        start: 0,
        end: 0,
      };
      segments.push({
        kind: 'translation',
        documentId: doc.documentId,
        language: doc.language ?? null,
        clock: time.clock,
        start: round(time.start),
        end: round(time.end),
        text,
        speaker: null,
      });
    }
  }

  const root = result.snapshot.sequences[result.snapshot.rootSequenceId];
  if (root) {
    const fps = root.fps.num / root.fps.den;
    for (const marker of root.markers ?? []) {
      if (marker.kind !== 'chapter') continue;
      const text = [marker.label, marker.summary].filter((s) => s && s.trim()).join('\n');
      if (!text) continue;
      const start = fps > 0 ? marker.frame / fps : 0;
      const end = fps > 0 && marker.durationFrames ? (marker.frame + marker.durationFrames) / fps : start;
      segments.push({
        kind: 'chapter',
        documentId: null,
        language: null,
        clock: 'sequence',
        start: round(start),
        end: round(end),
        text,
        speaker: null,
      });
    }
  }

  return {
    segments,
    facts: {
      ...factsOf(result.snapshot, videoDir),
      ...documentFacts(result),
      poster: posterOf(result.snapshot),
      timeline: timelineOf(result.snapshot),
      origin: originOf(result.snapshot),
    },
    problems,
  };
}

interface FactWord {
  id?: unknown;
  text?: unknown;
  hidden?: unknown;
  timingQuality?: unknown;
}

interface FactTranslationUnit {
  id?: unknown;
  sourceSentenceId?: unknown;
  sourceFingerprint?: unknown;
  naturalText?: unknown;
  text?: unknown;
  display?: unknown;
  status?: unknown;
}

/**
 * Facts about transcripts, translations and dubbing groups (candidate inputs for §5.11 and §7.9). They read what `videos.readContent` has already provided: the body of text documents and the projection on the root sequence,
 * and the document headers and instances in the snapshot. They do not read the video separately.
 *
 * - Per-word timing: there are visible words, and no word has a `timingQuality` of `estimated` or `missing`;
 * - On the timeline: the projection on the root sequence has content;
 * - Stale units of a translation are counted by the dubbing rules (marked stale, source sentence no longer exists, fingerprint mismatch, empty translation). If the glossary has changed, the user library would have to be read, which is not judged here;
 *   `/1` translations have no fingerprint, so only units marked stale and empty are counted; when the source is not in the video, all units count as stale;
 * - Dubbing groups: the `dubbing-plan` document (`groupId` in the summary, the translation it was translated from) together with dubbing instances carrying the `cuccut.dub` extension.
 */
function documentFacts(result: ReadContentResult): Pick<VideoFacts, 'transcripts' | 'translations' | 'dubGroups'> {
  const records = result.snapshot.documents ?? {};
  const speechBodies = new Map<Id, unknown>();
  const transcripts: VideoTranscriptFact[] = [];
  const translations: VideoTranslationFact[] = [];
  for (const doc of result.documents) {
    if (doc.error !== undefined) continue;
    if (doc.schema === 'cuccut.speech/1') {
      // The `schema` in the body may be omitted: the document header already says it is a transcript.
      speechBodies.set(doc.documentId, doc.body && typeof doc.body === 'object' ? { schema: doc.schema, ...doc.body } : doc.body);
      const words = ((doc.body as { words?: FactWord[] } | null)?.words ?? []).filter(
        (w) => w && w.hidden !== true && typeof w.text === 'string' && w.text !== '',
      );
      transcripts.push({
        documentId: doc.documentId,
        name: doc.name ?? records[doc.documentId]?.name ?? '',
        language: doc.language ?? null,
        wordTiming: words.length > 0 && words.every((w) => w.timingQuality !== 'estimated' && w.timingQuality !== 'missing'),
        onTimeline: !!doc.plan && doc.plan.entries.length > 0,
      });
    }
  }
  for (const doc of result.documents) {
    if (doc.error !== undefined) continue;
    if (doc.schema !== 'cuccut.translation/1' && doc.schema !== 'cuccut.translation/2') continue;
    const body = doc.body as { units?: FactTranslationUnit[]; sourceBasis?: { speechRef?: { id?: unknown } } } | null;
    const units = Array.isArray(body?.units) ? body.units : [];
    const basis = body?.sourceBasis?.speechRef?.id;
    const sourceDocumentId = doc.sourceDocumentId ?? (typeof basis === 'string' ? basis : null);
    translations.push({
      documentId: doc.documentId,
      name: doc.name ?? records[doc.documentId]?.name ?? '',
      language: doc.language ?? null,
      sourceDocumentId,
      units: units.length,
      staleUnits: staleUnits(doc.schema === 'cuccut.translation/2', units, sourceDocumentId, speechBodies),
    });
  }

  // Dubbing groups: first from the dubbing plan, then add groups that only have instances; the instance count is per group.
  const groups = new Map<string, VideoDubGroupFact>();
  const translationSource = new Map(translations.map((t) => [t.documentId, t.sourceDocumentId]));
  for (const record of Object.values(records)) {
    if (record.kind !== 'dubbing-plan') continue;
    const summary = record.revisions?.[record.currentRevision]?.summary as { groupId?: unknown } | undefined;
    const groupId = typeof summary?.groupId === 'string' ? summary.groupId : null;
    if (!groupId) continue;
    const translationId = record.sourceDocumentId ?? null;
    groups.set(groupId, {
      groupId,
      language: record.language ?? null,
      planDocumentId: record.id,
      translationId,
      transcriptId: translationId ? (translationSource.get(translationId) ?? records[translationId]?.sourceDocumentId ?? null) : null,
      items: 0,
    });
  }
  for (const sequence of Object.values(result.snapshot.sequences)) {
    for (const item of sequence.items) {
      const extension = (item as { extensions?: Record<string, unknown> }).extensions?.[DUB_EXTENSION] as
        { groupId?: unknown; language?: unknown; stem?: unknown } | undefined;
      if (typeof extension?.groupId !== 'string' || extension.stem !== undefined) continue;
      const group = groups.get(extension.groupId) ?? {
        groupId: extension.groupId,
        language: typeof extension.language === 'string' ? extension.language : null,
        planDocumentId: null,
        translationId: null,
        transcriptId: null,
        items: 0,
      };
      group.items++;
      groups.set(extension.groupId, group);
    }
  }
  return { transcripts, translations, dubGroups: [...groups.values()] };
}

function staleUnits(v2: boolean, units: FactTranslationUnit[], sourceDocumentId: Id | null, speechBodies: Map<Id, unknown>): number {
  if (!v2) {
    return units.filter((u) => u.status === 'stale' || String(u.display ?? u.text ?? '').trim() === '').length;
  }
  const body = sourceDocumentId ? speechBodies.get(sourceDocumentId) : undefined;
  if (body === undefined) return units.length;
  const sentences = currentFingerprints(body);
  let stale = 0;
  for (const unit of units) {
    const text = typeof unit.naturalText === 'string' ? unit.naturalText.trim() : '';
    if (unit.status === 'stale' || typeof unit.sourceSentenceId !== 'string' || text === '') stale++;
    else if (sentences && sentences.get(unit.sourceSentenceId) !== unit.sourceFingerprint) stale++;
  }
  return stale;
}

/**
 * Fingerprint of the transcript's current sentences (the subtitle and translation core rules, via editor-wasm); null when the body cannot be read. Also null when the WASM is not built: staleness is then judged only from each unit's own state and text,
 * so the whole content index does not fail.
 */
function currentFingerprints(body: unknown): Map<string, string> | null {
  try {
    const source = sourceSentences(body);
    return 'sentences' in source ? new Map(source.sentences.map((s) => [s.id, s.fingerprint])) : null;
  } catch (error) {
    if (error instanceof EditorWasmUnavailable) return null;
    throw error;
  }
}

/** Time of a `/2` translation unit: that sentence's time; when the transcript does not store sentences, the range of the aligned words, or the first word in the sentence ID. */
function unitTime(
  sentenceId: string,
  wordIds: string[] | undefined,
  sentences: Map<string, TimeSpan> | undefined,
  words: Map<string, TimeSpan> | undefined,
): TimeSpan | undefined {
  const sentence = sentences?.get(sentenceId);
  if (sentence) return sentence;
  if (!words) return undefined;
  const spans = (wordIds ?? []).map((id) => words.get(id)).filter((t): t is TimeSpan => t !== undefined);
  if (spans.length > 0) {
    return { clock: spans[0]!.clock, start: Math.min(...spans.map((t) => t.start)), end: Math.max(...spans.map((t) => t.end)) };
  }
  return sentenceId.startsWith('s-') ? words.get(sentenceId.slice(2)) : undefined;
}

export function factsOf(snapshot: VideoSnapshot, videoDir: string): Pick<VideoFacts, 'timelineAssetIds' | 'linkedFiles'> {
  const used = new Set<Id>();
  for (const sequence of Object.values(snapshot.sequences)) {
    for (const item of sequence.items) for (const ref of itemAssetRefs(item)) used.add(ref.id);
  }
  const linkedFiles: VideoFacts['linkedFiles'] = [];
  for (const asset of Object.values(snapshot.assets)) {
    const seen = new Set<string>();
    for (const revision of Object.values(asset.revisions)) {
      if (revision.storage.mode !== 'linked') continue;
      const file = path.resolve(videoDir, revision.storage.locator.path);
      if (seen.has(file)) continue;
      seen.add(file);
      linkedFiles.push({ assetId: asset.id, name: asset.name, path: file });
    }
  }
  return { timelineAssetIds: [...used].sort(), linkedFiles };
}

/** Material version and time of the cover frame (no path: the file is looked up in the video directory when the thumbnail is drawn). */
export function posterOf(snapshot: VideoSnapshot): VideoPosterFact | null {
  // When the snapshot is incomplete (old reads that carry only the fields content needs, or test doubles), there is no cover; the other facts are unaffected.
  const root = snapshot.sequences?.[snapshot.rootSequenceId];
  if (!root?.tracks || !root.items || !snapshot.assets) return null;
  const frame = posterFrame(snapshot);
  const record = frame ? snapshot.assets[frame.asset.id]?.revisions[frame.asset.revision] : undefined;
  if (!frame || !record) return null;
  return {
    assetId: frame.asset.id,
    revision: frame.asset.revision,
    at: frame.at,
    contentHash: record.contentHash,
    mediaType: record.mediaType,
    durationSec: record.duration ? mediaTimeToSeconds(record.duration) : null,
  };
}

/** Derivation source: the summary of the current version of the `derivation` document (`cuccut.derivation/1`); null when absent or the shape is wrong. */
export function originOf(snapshot: VideoSnapshot): VideoOriginFact | null {
  const records = Object.values(snapshot.documents ?? {})
    .filter((d) => d.kind === 'derivation')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const record of records) {
    const summary = record.revisions?.[record.currentRevision]?.summary as
      | { schema?: unknown; parentVideoId?: unknown; parentRevision?: unknown; key?: unknown; range?: { start?: unknown; end?: unknown } }
      | undefined;
    if (!summary || summary.schema !== 'cuccut.derivation/1') continue;
    const { parentVideoId, parentRevision, key, range } = summary;
    if (typeof parentVideoId !== 'string' || typeof parentRevision !== 'string' || typeof key !== 'string') continue;
    if (typeof range?.start !== 'number' || typeof range.end !== 'number') continue;
    return { parentVideoId, parentRevision, key, range: { start: range.start, end: range.end } };
  }
  return null;
}

/** Duration and canvas size of the root sequence. */
export function timelineOf(snapshot: VideoSnapshot): VideoTimelineFact | null {
  // Absent when the snapshot is incomplete (same as `posterOf`): the duration cannot be computed when an instance lacks `span`.
  const root = snapshot.sequences?.[snapshot.rootSequenceId];
  if (!root?.tracks || !Array.isArray(root.items) || !root.canvas || !(root.fps?.num > 0) || !(root.fps.den > 0)) return null;
  const { width, height } = root.canvas;
  if (!(width > 0) || !(height > 0)) return null;
  const durationSec = framesToSeconds(sequenceDurationFrames(root), root.fps);
  if (!Number.isFinite(durationSec)) return null;
  return { durationSec: round(durationSec), width, height };
}

function plannedOf(doc: ReadContentDocument): PlannedDocument {
  return {
    documentId: doc.documentId,
    kind: doc.kind,
    name: doc.name ?? '',
    language: doc.language ?? null,
    revision: doc.revision ?? '0',
    sourceAssetId: doc.sourceAssetId ?? null,
    sourceDocumentId: doc.sourceDocumentId ?? null,
    schema: doc.schema ?? '',
    body: doc.body ?? null,
  };
}

/** When the projection cannot be produced: the words in the transcript body are arranged by source time into a “plan”, and the sentence IDs come from the sentence splitting of the body. */
function sourcePlanOfSpeech(doc: ReadContentDocument): TextPlan | null {
  const body = doc.body as SpeechBody | null;
  if (!body || !Array.isArray(body.words)) return null;
  const scale = body.timescale && body.timescale > 0 ? body.timescale : 1000;
  const sentenceOf = new Map<string, string>();
  const order = new Map(body.words.map((w, i) => [w.id, i]));
  for (const sentence of body.sentences ?? []) {
    let ids: string[] = [];
    if (Array.isArray(sentence.wordIds)) ids = sentence.wordIds;
    else if (sentence.first !== undefined && sentence.last !== undefined) {
      const a = order.get(sentence.first);
      const b = order.get(sentence.last);
      if (a !== undefined && b !== undefined) ids = body.words.slice(a, b + 1).map((w) => w.id);
    }
    for (const id of ids) sentenceOf.set(id, sentence.id);
  }
  const entries: TextEntry[] = [];
  for (const word of body.words) {
    if (word.hidden || !word.text) continue;
    const start = (word.start ?? 0) / scale;
    const sentenceId = sentenceOf.get(word.id);
    entries.push({
      key: word.id,
      id: word.id,
      start,
      end: Math.max(start, (word.end ?? word.start ?? 0) / scale),
      text: word.text,
      ...(word.speaker !== undefined ? { speaker: word.speaker } : {}),
      ...(sentenceId !== undefined ? { sentenceId } : {}),
      wordTiming: false,
    });
  }
  entries.sort((a, b) => a.start - b.start);
  return pseudoPlan(doc, 'speech', entries);
}

function sourcePlanOfCaption(doc: ReadContentDocument): TextPlan | null {
  const body = doc.body as CaptionBody | null;
  if (!body || !Array.isArray(body.cues)) return null;
  const scale = body.timescale && body.timescale > 0 ? body.timescale : 1000;
  const entries: TextEntry[] = body.cues
    .filter((cue) => cue.text)
    .map((cue) => ({
      key: cue.id,
      id: cue.id,
      start: (cue.start ?? 0) / scale,
      end: (cue.end ?? cue.start ?? 0) / scale,
      text: cue.text!,
      ...(cue.speaker !== undefined ? { speaker: cue.speaker } : {}),
      wordTiming: false,
    }));
  entries.sort((a, b) => a.start - b.start);
  return pseudoPlan(doc, 'caption', entries);
}

function pseudoPlan(doc: ReadContentDocument, unit: 'speech' | 'caption', entries: TextEntry[]): TextPlan {
  return {
    sequenceId: '',
    documentId: doc.documentId,
    unit,
    clock: 'source',
    scope: { basis: 'source', captionItemIds: [], scopeItemIds: [] },
    range: { startSeconds: 0, endSeconds: entries.at(-1)?.end ?? 0, durationSeconds: entries.at(-1)?.end ?? 0 },
    entries,
    sourceCount: entries.length,
    omittedCount: 0,
  };
}

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

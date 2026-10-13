import type { DocumentRecord, Id, JobLiveSegment, JobProgress, JobRecord, Sequence } from '@cuccut/protocol';
import { deriveCues, projectableItems, projectSpeech, readSpeechWords, type SpeechWord } from './speech-cues.ts';
import { jobLive } from './task-list.ts';

/*
 * The live script during transcription (prototype round 220, model-transcript.js `liveSlice` / `liveTrackSlice`; architecture design §6.6 “live script”).
 *
 * Live paragraphs are a projection of the task event stream, not project content: they are read-only, not in the undo stack, and have no cue ID. The three states follow the prototype:
 *   · settled: paragraphs already received — drawn as usual;
 *   · inflight: when the prototype's `at` falls in the middle of a cue, only a prefix is shown. Real data has no half-text, so there is no prefix; only a cursor is attached at the end of the last paragraph;
 *   · pending: `at` through the end of the material, not yet transcribed — the timeline draws a “transcribing” pending band.
 * `at` = max(end of the last paragraph, seconds converted from progress): for `seconds` progress, `done` is already seconds; `segments` (clips cut by VAD) are converted only as a lower bound, as
 * `done / total × duration`. Services that do not return results as a stream (online, nodes, whole-clip models) have no paragraphs before the end either: only the pending band and the skeleton are shown, and no fake data is made.
 */

const EMPTY: readonly JobLiveSegment[] = Object.freeze([]);

/** How many seconds of the material have been transcribed (the material's own clock). When `done` (transcription finished, flow still building the caption layer), it is the end of the material. */
export function liveAt(segments: readonly JobLiveSegment[], progress: JobProgress | null, duration: number | null, done = false): number {
  const limit = duration != null && duration > 0 ? duration : Infinity;
  if (done) return limit === Infinity ? Math.max(0, lastEnd(segments)) : limit;
  let reached = lastEnd(segments);
  if (progress?.unit === 'seconds') reached = Math.max(reached, progress.done);
  else if (progress?.unit === 'segments' && progress.total && limit !== Infinity)
    reached = Math.max(reached, (progress.done / progress.total) * limit);
  return Math.max(0, Math.min(limit, reached));
}

function lastEnd(segments: readonly JobLiveSegment[]): number {
  let end = 0;
  for (const s of segments) if (Number.isFinite(s.end) && s.end > end) end = s.end;
  return end;
}

/** The part of the material not yet transcribed (material clock); null when fully transcribed. When the duration is unknown it extends to infinity, and the instance ranges on the timeline clip it. */
export function livePending(at: number, duration: number | null, done = false): { start: number; end: number } | null {
  if (done) return null;
  const end = duration != null && duration > 0 ? duration : Infinity;
  return at < end ? { start: at, end } : null;
}

// ---- Which transcription belongs to which material ----

/** An in-progress transcription of a material in the video. */
export interface LiveTranscription {
  assetId: Id;
  /** The transcribe Job that runs recognition: live paragraphs are recorded by its `jobId`, and the progress shown is its progress. */
  step: JobRecord;
  /** The fixed flow that submitted it (transcription, import from a link); transcriptions submitted directly do not have one. */
  parent: JobRecord | null;
  /** Whether the transcription is still running (queued, executing, auto re-run). false means the transcription has finished and the flow is still moving on (building the caption layer). */
  running: boolean;
}

/**
 * The in-progress transcription of each material in this video (one per material; the latest if it was retried). The transcription flow and import from a link both hand recognition to a `transcribe`
 * Job (its `submitter` points back to the flow's parent task), so it starts from the transcribe Job, and recognizes those submitted from the editor, by agents, and from the command line too.
 * A transcription that has finished while its parent task is still running (caption layer not yet built) also counts, so there is no gap between the recognition result and the caption track.
 */
export function liveTranscriptions(jobs: readonly JobRecord[], videoId: Id | null): LiveTranscription[] {
  if (!videoId) return [];
  const byAsset = new Map<Id, LiveTranscription>();
  for (const step of jobs) {
    if (step.kind !== 'transcribe' || step.videoId !== videoId || !step.assetId) continue;
    const parent = step.submitter.kind === 'pipeline' ? (jobs.find((j) => j.jobId === step.submitter.id) ?? null) : null;
    const running = jobLive(step);
    if (!running && !(step.state === 'completed' && parent && jobLive(parent))) continue;
    const seen = byAsset.get(step.assetId);
    if (!seen || step.createdAt >= seen.step.createdAt) byAsset.set(step.assetId, { assetId: step.assetId, step, parent, running });
  }
  return [...byAsset.values()];
}

/** Whether the timeline has captions for this material (the caption instance documents are converted from this material). */
export function assetCaptioned(sequence: Sequence, documents: Record<Id, DocumentRecord>, assetId: Id): boolean {
  return sequence.items.some((item) => {
    if (item.type !== 'caption') return false;
    const record = documents[item.documentId];
    return record?.kind === 'caption' && record.sourceAssetId === assetId;
  });
}

/** The material already had a transcript before this transcription started (it is a re-transcription). */
export function transcribedBefore(documents: Record<Id, DocumentRecord>, assetId: Id, since: string): boolean {
  return Object.values(documents).some(
    (record) =>
      record.kind === 'speech' &&
      record.sourceAssetId === assetId &&
      Object.values(record.revisions).some((revision) => revision.createdAt < since),
  );
}

/**
 * Whether the timeline should draw the temporary transcription line (v2 rule: drawn only for the first transcription). During the first transcription there is no caption track yet — the flow creates it in its last step — so this line
 * does not belong to any track; it takes the caption row's place. After the transcription finishes, the recognition result is first written as a transcript document and the caption track is created later, so the line keeps drawing in between,
 * until the caption track appears or the flow ends (flows that do not build a caption layer, such as import from a link, which does not build one by default, collapse the line when they end). When the transcription has finished but there are no paragraphs at all, no empty line is drawn.
 */
export function liveRowShown(facts: { running: boolean; segments: number; captioned: boolean; transcribedBefore: boolean }): boolean {
  if (facts.captioned || facts.transcribedBefore) return false;
  return facts.running || facts.segments > 0;
}

/**
 * Whether the script panel switches to the read-only live state (prototype panels.jsx: it switches while a transcription is running, and likewise for a re-transcription). After the transcription finishes, it waits for the transcript document to land in the video before switching back,
 * so “no script yet” does not flash in between.
 */
export function liveTranscriptShown(facts: { running: boolean; segments: number; documentLanded: boolean }): boolean {
  if (facts.running) return true;
  return facts.segments > 0 && !facts.documentLanded;
}

// ---- Retained paragraphs ----

/**
 * When a transcription Job ends, the client drops its live paragraphs (`applyJobsEvent`), but the flow is still building the caption layer: during that time the temporary line and the script must keep drawing.
 * Here the paragraphs that were just dropped, whose Job has completed while the parent task is still running, are retained; when the parent task ends (or the Job is no longer in the list), they are released. Returns the original object when nothing changed.
 */
export function holdSegments(
  previous: Readonly<Record<Id, readonly JobLiveSegment[]>>,
  next: Readonly<Record<Id, readonly JobLiveSegment[]>>,
  held: Readonly<Record<Id, readonly JobLiveSegment[]>>,
  jobs: readonly JobRecord[],
): Record<Id, readonly JobLiveSegment[]> {
  const byId = new Map(jobs.map((job) => [job.jobId, job]));
  const keep = (jobId: Id) => {
    const job = byId.get(jobId);
    if (!job || job.state !== 'completed' || job.submitter.kind !== 'pipeline') return false;
    const parent = byId.get(job.submitter.id);
    return !!parent && jobLive(parent);
  };
  let out: Record<Id, readonly JobLiveSegment[]> | null = null;
  for (const jobId of Object.keys(held)) {
    if (keep(jobId)) continue;
    out ??= { ...held };
    delete out[jobId];
  }
  for (const [jobId, segments] of Object.entries(previous)) {
    if (next[jobId] || !segments.length || !keep(jobId)) continue;
    out ??= { ...held };
    out[jobId] = segments;
  }
  return out ?? (held as Record<Id, readonly JobLiveSegment[]>);
}

// ---- Projection onto the timeline ----

/** One piece of a paragraph projected onto the sequence (seconds). A paragraph that crosses a clip boundary is cut into several pieces, each with a different `key`; `index` is its position among all the paragraphs. */
export interface PlacedSegment {
  key: string;
  index: number;
  start: number;
  end: number;
  text: string;
}

const placedCache = new WeakMap<readonly JobLiveSegment[], WeakMap<Sequence, Map<Id, readonly PlacedSegment[]>>>();

/**
 * Where live paragraphs sit on the sequence: the same projection as generated captions (`projectSpeech`: material clock → the instances on the timeline that use this material), so trimmed and shifted instances still land in the right place.
 * Cached by the paragraph array (the same array means the same paragraphs) and the sequence version.
 */
export function placeSegments(sequence: Sequence, assetId: Id, segments: readonly JobLiveSegment[]): readonly PlacedSegment[] {
  if (!segments.length) return EMPTY as readonly never[];
  let bySequence = placedCache.get(segments);
  if (!bySequence) placedCache.set(segments, (bySequence = new WeakMap()));
  let byAsset = bySequence.get(sequence);
  if (!byAsset) bySequence.set(sequence, (byAsset = new Map()));
  let placed = byAsset.get(assetId);
  if (!placed) {
    const words: SpeechWord[] = segments.map((s, index) => ({
      id: String(index),
      start: s.start,
      end: s.end,
      text: s.text,
      paragraphStart: false,
    }));
    placed = projectSpeech(sequence, assetId, words).map((w) => ({
      key: w.key,
      index: Number(w.id),
      start: w.start,
      end: w.end,
      text: w.text,
    }));
    byAsset.set(assetId, placed);
  }
  return placed;
}

/** The pieces of the pending band on the sequence (when the material is cut into several segments on the timeline, one piece per segment). */
export function placePending(
  sequence: Sequence,
  assetId: Id,
  pending: { start: number; end: number } | null,
): Array<{ start: number; end: number }> {
  if (!pending) return [];
  const end = Number.isFinite(pending.end) ? pending.end : Number.MAX_SAFE_INTEGER;
  return projectSpeech(sequence, assetId, [{ id: 'pending', start: pending.start, end, text: '', paragraphStart: false }]).map((w) => ({
    start: w.start,
    end: w.end,
  }));
}

// ---- Read-only script rows ----

/** One row of the read-only script: the material and its latest transcript. */
export interface TranscriptRowSource {
  assetId: Id;
  speech: DocumentRecord;
}

/**
 * The read-only “script” row on the timeline (prototype model-timeline.js `rows` `transcript`; product design §5.7): a video that has been transcribed but has no caption track at all
 * (captions were not built during transcription, e.g. import from a link does not build them by default; or every caption track was deleted). The script still sits in the caption row's place, so you can see where speech happens.
 * One row per transcribed material used on the timeline (its latest transcript), in order of first appearance on the timeline; materials already showing the temporary transcription line are not drawn twice.
 * It is not a track: it has no toggle, is not exported, and cannot be selected.
 */
export function transcriptRows(
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  liveAssets: ReadonlySet<Id>,
): TranscriptRowSource[] {
  if (sequence.tracks.some((track) => track.kind === 'subtitle')) return [];
  const created = (record: DocumentRecord) => record.revisions[record.currentRevision]?.createdAt ?? '';
  const latest = new Map<Id, DocumentRecord>();
  for (const record of Object.values(documents)) {
    if (record.kind !== 'speech' || !record.sourceAssetId || liveAssets.has(record.sourceAssetId)) continue;
    const seen = latest.get(record.sourceAssetId);
    if (!seen || created(record) >= created(seen)) latest.set(record.sourceAssetId, record);
  }
  return [...latest]
    .map(([assetId, speech]) => ({ assetId, speech, first: Math.min(...projectableItems(sequence, assetId).map(startFrame)) }))
    .filter(({ first }) => Number.isFinite(first))
    .sort((a, b) => a.first - b.first || (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0))
    .map(({ assetId, speech }) => ({ assetId, speech }));
}

const startFrame = (item: Sequence['items'][number]) => ('span' in item ? item.span.fromFrame : item.fromFrame);

/**
 * The sentence blocks in a script row: the transcript body (`cuccut.speech/1`) is split into sentences with the same segmentation as captions (`deriveCues`), and projected onto the sequence through the instances that use this material;
 * cut-away parts do not appear, and a sentence that crosses a clip boundary is cut into pieces. There are no blocks when the body has not been fetched or is not a transcript.
 */
export function placeTranscript(sequence: Sequence, assetId: Id, body: unknown): readonly PlacedSegment[] {
  const speech = readSpeechWords(body);
  if (!speech?.words.length) return EMPTY as readonly never[];
  const cues = deriveCues(speech.words);
  const words: SpeechWord[] = cues.map((cue) => ({ id: cue.id, start: cue.start, end: cue.end, text: cue.text, paragraphStart: false }));
  const index = new Map(cues.map((cue, n) => [cue.id, n]));
  return projectSpeech(sequence, assetId, words).map((w) => ({ key: w.key, index: index.get(w.id) ?? 0, start: w.start, end: w.end, text: w.text }));
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '@cuccut/runtime-storage';
import type { Id, JobRecord, JobState, JobSubmitter, PipelineCreateScope, Sequence, TranscribeRequest } from '@cuccut/protocol';
import type { VideoPlace } from '../application-ledger.ts';
import { JobsVideoCreate } from '@cuccut/protocol/messages/jobs/video-create.ts';
import { asLocalized } from '../job-text.ts';
import { PipelineStepError, type PipelineStepContext } from './pipeline.ts';
import type { PipelineVideos } from './translate.ts';
import type { PipelineTargets, VideoLease } from './video-target.ts';

/**
 * Steps shared by the video tools (architecture design §7.9): creating a video, importing a file as a linked media item (a new video or an empty timeline video gets the item on its main track in the same transaction), and submitting a transcription and waiting for it.
 * Both link import (`link-import.ts`) and transcription (`transcribe.ts`) use this one.
 *
 * Retries after an interruption do not repeat work. A pipeline's output is recorded when its step completes, so the "work done, not yet recorded" window is recognized by the separate methods below:
 * - Creating a video: first reserve a directory in the project (or the session's source directory) (`PipelineTargets.reserve`; once reserved, other creations skip it), write the location into this run's staging (`create-intent.json`, kept on failure or interruption), then create the video there. On retry, read the location back: if a video is already there, adopt it; if the directory is empty, create the video in it.
 * - Import: the transaction's `commandId` is fixed (`<parent job>:import`). Query the engine for a receipt by it first; if already committed, use the media from the receipt directly.
 * - Transcription: first look in the Job Ledger for the transcription job this run submitted (`submitter` is this parent job, with the same video and media). If it has completed, use it directly; if it is still running, keep waiting; do not submit a second one (otherwise a retry would produce an extra transcript).
 */

/** Intent for creating a video: the reserved location. */
const CREATE_INTENT = 'create-intent.json';

/** Video capabilities the import needs: when a receipt lookup is available, it is tried first (retries after a restart). */
export type MediaVideos = PipelineVideos & {
  /** Looks up the receipt of an already committed transaction by `commandId`. null when there is none. */
  receipt?(videoId: Id, commandId: Id): Promise<{ refs: Record<string, Id> } | null>;
  /** Root sequence (checked for emptiness with `place: 'if-empty'`). null when not open. */
  rootSequence?(videoId: Id): Sequence | null;
};

/** Creates a video (`target.create`): reserves a location, records the intent, creates the video (or adopts an existing one), and hands it to the pipeline to hold. */
export async function createHeldVideo(
  targets: Pick<PipelineTargets, 'reserve' | 'create'>,
  context: Pick<PipelineStepContext<unknown>, 'staging' | 'parentJobId' | 'hold'>,
  request: PipelineCreateScope & { name: string },
): Promise<VideoLease> {
  const file = path.join(context.staging, CREATE_INTENT);
  let intent = await readJson<{ place?: VideoPlace }>(file);
  if (!intent?.place) {
    const place = await targets.reserve(request);
    try {
      await writeJsonAtomic(file, { place });
    } catch (error) {
      // If the intent was not recorded, do not leave the reserved empty directory behind.
      await fs.rmdir(path.join(String(place.root), String(place.file))).catch(() => {});
      throw error;
    }
    intent = { place };
  }
  const lease = await targets.create({ ...request, commandId: `${context.parentJobId}:create`, place: intent.place });
  context.hold(lease);
  return lease;
}

export interface MediaImport {
  videoId: Id;
  /** Absolute path of the file: imported as a linked media item (the file stays where it is). */
  file: string;
  name: string;
  provenance: { origin: string; source?: unknown };
  /**
   * In the same transaction, puts the media on the main track (the first track of its kind), starting at 0 and covering the whole media (used for new videos). With `'if-empty'`, it is placed only when the root sequence has no clips yet (for importing into an existing empty video, for example when an external service calls `videos_create` first and then downloads into it).
   */
  place: boolean | 'if-empty';
  /** The transaction's label (written into the video's history): the `.text` of the catalog string. */
  label: string;
}

/** Imports a file as a linked media item (optionally putting it on the timeline in the same transaction) and returns the media ID. */
export async function importMedia(
  videos: MediaVideos,
  context: Pick<PipelineStepContext<unknown>, 'parentJobId' | 'run'>,
  request: MediaImport,
): Promise<{ assetId: Id }> {
  const commandId = `${context.parentJobId}:import`;
  const { videoId } = request;
  // The last run committed the transaction, but the output was not recorded before the interruption. Adopt that transaction by its command.
  const previous = await videos.receipt?.(videoId, commandId);
  if (previous?.refs.link) return { assetId: previous.refs.link };
  const state = videos.state(videoId);
  if (!state) throw new PipelineStepError('VIDEO_NOT_OPEN', JobsVideoCreate.videoClosed(), {});
  const place = request.place === 'if-empty' ? videos.rootSequence?.(videoId)?.items.length === 0 : request.place;
  const { refs } = await videos.apply(videoId, {
    commandId,
    expectedRevision: state.revision,
    label: request.label,
    run: context.run,
    operations: [
      { type: 'importAsset', path: request.file, name: request.name, ref: 'link', storage: 'linked', provenance: request.provenance },
      ...(place
        ? [
            {
              type: 'addItem' as const,
              sequenceId: state.rootSequenceId,
              asset: { ref: 'link' },
              at: { unit: 'frames' as const, value: 0 },
              alignment: 'floor-frame' as const,
            },
          ]
        : []),
    ],
  });
  const assetId = refs?.link;
  if (!assetId) throw new PipelineStepError('INTERNAL', JobsVideoCreate.noAsset(), {});
  return { assetId };
}

/** Transcription within the pipeline: checks configuration before submitting, submits, waits, and cancels (reuses the submission from `models.transcribe`). */
export interface PipelineTranscriber {
  /** Selects the Provider and model (throws `CAPABILITY_NOT_CONFIGURED` when none is configured). */
  check(target?: { provider?: string; model?: string }): Promise<{ providerId: string; modelId: string }>;
  submit(request: TranscribeRequest, submitter: JobSubmitter): Promise<{ jobId: Id }>;
  /** Transcription with no video (transcribing a file). `language` is the asserted language (BCP 47). */
  submitFile?(
    request: { file: string; provider?: string; model?: string; language?: string; hint?: string },
    submitter: JobSubmitter,
  ): Promise<{ jobId: Id }>;
  settled(jobId: Id): Promise<JobState>;
  cancel(jobId: Id): Promise<unknown>;
  inspect(jobId: Id): JobRecord;
  /** Job in the Job Ledger (used on retry to find the transcription this run submitted). When there is none, it is submitted again every time. */
  list?(): JobRecord[];
}

/**
 * Submits a transcription and waits for it to complete (the Job itself applies the speech document to the video, §7.3). Returns the Job and the document it wrote. On retry, first adopts the transcription this run submitted, whether it has completed or is still running.
 */
export async function transcribeInVideo(
  jobs: PipelineTranscriber,
  context: Pick<PipelineStepContext<unknown>, 'parentJobId' | 'attempt' | 'signal' | 'progress'>,
  request: Omit<TranscribeRequest, 'commandId'>,
  /** Whether a completed transcription can still be used (for example, not when the document it wrote has been deleted). When not given, all are usable. A transcription still running is always waited for. */
  usable: (job: JobRecord) => boolean = () => true,
): Promise<{ jobId: Id; documentId: Id | null; artifactId: string | null; transactionId: Id | null }> {
  const { parentJobId, signal } = context;
  context.progress(null, 'transcribing');
  const earlier = (jobs.list?.() ?? [])
    .filter(
      (job) =>
        job.kind === 'transcribe' &&
        job.submitter.kind === 'pipeline' &&
        job.submitter.id === parentJobId &&
        job.videoId === request.videoId &&
        job.assetId === request.assetId &&
        ((job.state === 'completed' && usable(job)) || job.state === 'queued' || job.state === 'running'),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0];
  // Each execution runs one command. The same command gets back the Job that failed last time.
  const commandId = context.attempt > 1 ? `${parentJobId}:transcribe:${context.attempt}` : `${parentJobId}:transcribe`;
  const { jobId } = earlier
    ? { jobId: earlier.jobId }
    : await jobs.submit({ ...request, commandId }, { kind: 'pipeline', id: parentJobId });
  const onAbort = () => void jobs.cancel(jobId).catch(() => {});
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const state = await jobs.settled(jobId);
    signal.throwIfAborted();
    if (state !== 'completed') {
      const error = jobs.inspect(jobId).error;
      throw new PipelineStepError(
        error?.code ?? 'TRANSCRIBE_FAILED',
        error ? asLocalized(error.message, error.messageRef) : JobsVideoCreate.notCompleted({ state }),
        { jobId },
      );
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
  const record = jobs.inspect(jobId);
  const result = record.result;
  // The transaction that wrote the document (the last one whose apply was committed).
  const applied = record.applications?.filter((app) => app.state === 'committed').at(-1);
  return {
    jobId,
    documentId: result?.documentId ?? null,
    artifactId: result?.artifactId ?? null,
    transactionId: applied?.receipt?.transactionId ?? null,
  };
}

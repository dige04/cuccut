import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { silentLogger } from '@cuccut/harness';
import { RpcError, type GenerateTextRequest, type Id, type JobRecord, type JobState, type JobSubmitter } from '@cuccut/protocol';
import { PublishingService, type PublishingActor, type PublishingActorKind } from '../publishing-service.ts';
import type { PublishingVideoFacts, PublishingVideos } from '../publishing-videos.ts';

/** Fakes for publishing tests: a job table, an artifact library on disk, videos and a clock. The store is a real `PublishingStore`. */

export const T0 = '2026-10-13T10:00:00.000Z';

export function actor(kind: PublishingActorKind, name = `${kind} caller`): PublishingActor {
  return { kind, name, submitter: { kind: 'connection', id: `conn-${kind}` } };
}

export const HUMAN = actor('human', 'Owner');
export const WEB = actor('web', 'Browser');
export const AGENT = actor('agent', 'Claude Code');
export const CLI = actor('cli', 'Command line');

export function jobRecord(overrides: Partial<JobRecord> & Pick<JobRecord, 'jobId' | 'kind'>): JobRecord {
  return {
    state: 'running',
    phase: 'encoding',
    progress: null,
    videoId: null,
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:0',
    providerId: 'local',
    modelId: 'none',
    bundleId: null,
    inputHash: 'sha256:0',
    submitter: { kind: 'connection', id: 'c' },
    attempt: 1,
    createdAt: T0,
    updatedAt: T0,
    startedAt: T0,
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    ...overrides,
  } as JobRecord;
}

export class FakeJobs {
  readonly jobs = new Map<Id, JobRecord>();
  readonly files = new Map<string, string>();
  readonly texts = new Map<string, string>();
  readonly textRequests: Array<{ request: GenerateTextRequest; submitter: JobSubmitter; jobId: Id }> = [];
  readonly exportRequests: Array<{ videoId: Id; sequenceId: Id | undefined; submitter: JobSubmitter; jobId: Id }> = [];
  readonly #listeners = new Set<(job: JobRecord) => void>();
  #next = 0;

  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  inspect = (jobId: Id): JobRecord => {
    const job = this.jobs.get(jobId);
    if (!job) throw new RpcError('not-found', 'no job', { code: 'JOB_NOT_FOUND' });
    return job;
  };

  onChange = (listener: (job: JobRecord) => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  get listeners(): number {
    return this.#listeners.size;
  }

  artifacts = {
    locate: async (artifactId: string): Promise<string | null> => this.files.get(artifactId) ?? null,
    read: async (artifactId: string): Promise<Buffer | null> => {
      const text = this.texts.get(artifactId);
      return text === undefined ? null : Buffer.from(text, 'utf8');
    },
  };

  submitGenerateText = async (request: GenerateTextRequest, submitter: JobSubmitter): Promise<{ jobId: Id }> => {
    const jobId = `job_text_${++this.#next}`;
    this.jobs.set(jobId, jobRecord({ jobId, kind: 'generateText', submitter }));
    this.textRequests.push({ request, submitter, jobId });
    return { jobId };
  };

  /** Finishes a text job with this answer. */
  answer(jobId: Id, text: string): void {
    const artifactId = `sha256:${createHash('sha256').update(text).digest('hex')}`;
    this.texts.set(artifactId, text);
    this.set(jobId, { state: 'completed', endedAt: T0, result: { documentId: null, artifactId } });
  }

  /** The export job surface (`ExportService`). */
  exports = {
    create: async (request: { videoId: Id; settings: { kind: 'video'; format: 'mp4'; sequenceId?: Id } }, submitter: JobSubmitter): Promise<{ jobId: Id }> => {
      const jobId = `job_export_${++this.#next}`;
      this.exportRequests.push({ videoId: request.videoId, sequenceId: request.settings.sequenceId, submitter, jobId });
      this.jobs.set(
        jobId,
        jobRecord({
          jobId,
          kind: 'export',
          videoId: request.videoId,
          submitter,
          export: {
            settings: request.settings,
            snapshotArtifactId: 'sha256:snap',
            videoRevision: 'rev_current',
            sequenceId: request.settings.sequenceId ?? 'seq_1',
            destination: { dir: this.root, files: ['out.mp4'], overwrite: false },
          },
        }),
      );
      return { jobId };
    },
    get: (jobId: Id): JobRecord => this.inspect(jobId),
    list: (videoId?: Id): JobRecord[] => [...this.jobs.values()].filter((job) => job.kind === 'export' && (!videoId || job.videoId === videoId)),
  };

  /** Writes an MP4-like file into the artifact library and returns its artifact ID. */
  async artifact(content: string): Promise<{ artifactId: string; sha256: string; file: string }> {
    const sha256 = createHash('sha256').update(content).digest('hex');
    const dir = path.join(this.root, 'artifacts');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, sha256);
    await fs.writeFile(file, content);
    const artifactId = `sha256:${sha256}`;
    this.files.set(artifactId, file);
    return { artifactId, sha256, file };
  }

  /** A finished whole-video MP4 export of `videoId` whose output is `content`. */
  async finishedExport(
    content: string,
    options: { videoId?: Id; sequenceId?: Id; videoRevision?: string; jobId?: Id; width?: number; height?: number; durationSec?: number; range?: boolean } = {},
  ): Promise<{ jobId: Id; sha256: string; file: string }> {
    const { artifactId, sha256, file } = await this.artifact(content);
    const jobId = options.jobId ?? `job_export_${++this.#next}`;
    this.jobs.set(
      jobId,
      jobRecord({
        jobId,
        kind: 'export',
        state: 'completed',
        videoId: options.videoId ?? 'video_1',
        endedAt: T0,
        export: {
          settings: { kind: 'video', format: 'mp4', ...(options.range ? { range: { start: 0, end: 1 } } : {}) } as never,
          snapshotArtifactId: 'sha256:snap',
          videoRevision: options.videoRevision ?? 'rev_current',
          sequenceId: options.sequenceId ?? 'seq_1',
          destination: { dir: this.root, files: ['out.mp4'], overwrite: false },
        },
        result: { documentId: null, artifactId, outputs: [videoOutput(artifactId, content.length, options)] },
      }),
    );
    return { jobId, sha256, file };
  }

  /** Finishes a running export job with this output (or ends it in another state). */
  async finishExport(jobId: Id, content: string | null, state: JobState = 'completed'): Promise<void> {
    if (content === null) {
      this.set(jobId, { state, endedAt: T0 });
      return;
    }
    const { artifactId } = await this.artifact(content);
    this.set(jobId, { state, endedAt: T0, result: { documentId: null, artifactId, outputs: [videoOutput(artifactId, content.length, {})] } });
  }

  set(jobId: Id, patch: Partial<JobRecord>): void {
    const job = { ...this.inspect(jobId), ...patch };
    this.jobs.set(jobId, job);
    for (const listener of this.#listeners) listener(job);
  }
}

function videoOutput(artifactId: string, bytes: number, options: { width?: number; height?: number; durationSec?: number }) {
  return {
    artifactId,
    mediaType: 'video/mp4',
    byteLength: bytes,
    assetId: null,
    media: { kind: 'video' as const, durationSec: options.durationSec ?? 30, width: options.width ?? 1080, height: options.height ?? 1920, videoCodec: 'h264', audioCodec: 'aac', fps: '30/1' },
  };
}

export class FakeVideos implements PublishingVideos {
  readonly videos = new Map<Id, PublishingVideoFacts & { transcript?: string | null }>();
  opened = 0;
  released = 0;

  add(facts: Partial<PublishingVideoFacts> & { videoId: Id; transcript?: string | null }): void {
    this.videos.set(facts.videoId, { name: 'Launch clip', projectId: 'proj_1', rootSequenceId: 'seq_1', sequenceIds: ['seq_1'], revision: 'rev_current', ...facts });
  }

  async facts(videoId: Id): Promise<PublishingVideoFacts | null> {
    const v = this.videos.get(videoId);
    return v ? { videoId, name: v.name, projectId: v.projectId, rootSequenceId: v.rootSequenceId, sequenceIds: [...v.sequenceIds], revision: v.revision } : null;
  }

  available(videoId: Id): boolean {
    return this.videos.has(videoId);
  }

  revision(videoId: Id): string | null {
    return this.videos.get(videoId)?.revision ?? null;
  }

  async open(videoId: Id): Promise<() => Promise<void>> {
    if (!this.videos.has(videoId)) throw new RpcError('not-found', 'no video', { code: 'VIDEO_NOT_FOUND' });
    this.opened++;
    return async () => {
      this.released++;
    };
  }

  async transcript(videoId: Id, maxChars: number): Promise<string | null> {
    const text = this.videos.get(videoId)?.transcript ?? null;
    return text ? [...text].slice(0, maxChars).join('') : null;
  }
}

export class Clock {
  at: number;

  constructor(at = Date.parse(T0)) {
    this.at = at;
  }
  now = (): Date => new Date(this.at);
  advance(ms: number): void {
    this.at += ms;
  }
}

export interface PublishingFixture {
  service: PublishingService;
  jobs: FakeJobs;
  videos: FakeVideos;
  clock: Clock;
  dir: string;
  file: string;
}

/** A publishing service over a store in `root`, with UTC settings, one "By hand" connection and accounts on YouTube and Instagram. */
export async function publishingFixture(root: string, options: { accounts?: boolean } = {}): Promise<PublishingFixture> {
  const jobs = new FakeJobs(root);
  const videos = new FakeVideos();
  videos.add({ videoId: 'video_1' });
  const clock = new Clock();
  const dir = path.join(root, 'publishing');
  const file = path.join(root, 'publishing.json');
  const service = await PublishingService.open({ file, dir, jobs, exports: jobs.exports, videos, log: silentLogger, now: clock.now, dueIntervalMs: 60_000 });
  await service.saveSettings({ ...service.store.settings(), timezone: 'UTC' }, HUMAN);
  if (options.accounts !== false) {
    await service.saveConnection({ id: 'conn_1', provider: 'manual', name: 'By hand' }, HUMAN);
    await service.saveAccount({ id: 'acc_yt', connectionId: 'conn_1', network: 'youtube', name: 'Main channel', remoteId: '@main' }, HUMAN);
    await service.saveAccount({ id: 'acc_ig', connectionId: 'conn_1', network: 'instagram', name: 'Insta', remoteId: '@insta' }, HUMAN);
  }
  return { service, jobs, videos, clock, dir, file };
}

/** The `details.code` of an RpcError (or the error code), for assertions that do not depend on the locale. */
export async function codeOf(promise: Promise<unknown> | (() => unknown)): Promise<string | undefined> {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (error) {
    if (!(error instanceof RpcError)) throw error;
    return ((error.details as { code?: string } | undefined)?.code ?? error.code) as string;
  }
  throw new Error('expected an error');
}

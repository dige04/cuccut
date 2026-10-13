import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type Id, type JobRecord, type PipelineCreateTarget } from '@cuccut/protocol';
import type { VideoPlace } from '../application-ledger.ts';
import type { JobManager } from '../job-manager.ts';
import { testJobManager } from '../testing/pipeline-jobs.ts';
import { PipelineStepError, type PipelineDefinition } from './pipeline.ts';
import { PipelineRunner } from './pipeline-runner.ts';
import { readVideoTarget, targetStep, type PipelineTargets, type VideoLease } from './video-target.ts';

/**
 * Targets for video tools (architecture design §7.9): the shape of `target` and its conflict with `videoId`. `PipelineRunner` resolves `entryId` on submit, opens the video under a lease, records it as the first step, and releases it at the end. A lock conflict creates no job. A video-creation step is not redone on retry.
 */

describe('readVideoTarget', () => {
  const both = { create: { media: false } } as const;

  const rejects = (raw: Record<string, unknown>, support: Parameters<typeof readVideoTarget>[1] = both): RpcError => {
    try {
      readVideoTarget(raw, support);
    } catch (error) {
      return error as RpcError;
    }
    throw new Error('应当拒绝');
  };

  it('reads the three target kinds and the top-level videoId', () => {
    expect(readVideoTarget({}, both)).toBeNull();
    expect(readVideoTarget({ videoId: 'v1' }, both)).toEqual({ videoId: 'v1' });
    expect(readVideoTarget({ target: { videoId: 'v1' } }, both)).toEqual({ videoId: 'v1' });
    expect(readVideoTarget({ videoId: 'v1', target: { videoId: 'v1' } }, both)).toEqual({ videoId: 'v1' });
    expect(readVideoTarget({ target: { entryId: 'e1' } }, both)).toEqual({ entryId: 'e1' });
    expect(readVideoTarget({ target: { create: { projectId: 'p1', name: ' 新视频 ' } } }, both)).toEqual({
      create: { projectId: 'p1', name: '新视频' },
    });
    // Created in the session's source directory (a session that does not belong to a project).
    expect(readVideoTarget({ target: { create: { conversationId: 'c1' } } }, both)).toEqual({ create: { conversationId: 'c1' } });
  });

  it('rejects a malformed shape, a conflict with videoId, and unaccepted fields', () => {
    expect(rejects({ target: { videoId: 'v1', entryId: 'e1' } })).toMatchObject({ code: 'invalid-request' });
    expect(rejects({ target: 'v1' })).toMatchObject({ code: 'invalid-request' });
    expect(rejects({ target: { path: '/x' } })).toMatchObject({ code: 'invalid-request' });
    expect(rejects({ target: { entryId: '' } })).toMatchObject({ code: 'invalid-request' });
    // The top-level videoId and target refer to different videos.
    expect(rejects({ videoId: 'v1', target: { videoId: 'v2' } })).toMatchObject({
      code: 'invalid-request',
      message: expect.stringContaining('target'),
    });
    expect(rejects({ videoId: 'v1', target: { create: { projectId: 'p1' } } })).toMatchObject({ code: 'invalid-request' });
    // Creation: exactly one of projectId and conversationId is given. This pipeline does not accept media.
    expect(rejects({ target: { create: {} } })).toMatchObject({ code: 'invalid-request' });
    expect(rejects({ target: { create: { projectId: 'p1', conversationId: 'c1' } } })).toMatchObject({ code: 'invalid-request' });
    expect(rejects({ target: { create: { conversationId: '' } } })).toMatchObject({ code: 'invalid-request' });
    expect(rejects({ target: { create: { projectId: 'p1', media: '/a.mp4' } } })).toMatchObject({
      code: 'invalid-request',
      message: expect.stringContaining('media'),
    });
    // Pipelines that do not accept creation (translation, dubbing).
    expect(rejects({ target: { create: { projectId: 'p1' } } }, { create: false })).toMatchObject({
      code: 'invalid-request',
      details: { code: 'PIPELINE_TARGET_UNSUPPORTED' },
    });
  });

  it('pipelines that accept media may supply it', () => {
    expect(readVideoTarget({ target: { create: { projectId: 'p1', media: '/a.mp4' } } }, { create: { media: true } })).toEqual({
      create: { projectId: 'p1', media: '/a.mp4' },
    });
  });
});

interface TargetParams {
  videoId?: Id;
  create?: PipelineCreateTarget;
}

/** Fake Runtime target: a location's `file` is the video id. A locked location throws `VIDEO_LOCKED`. Records the leases currently held. */
class FakeTargets implements PipelineTargets {
  entries = new Map<Id, VideoPlace | 'trashed' | 'not-video'>();
  locked = new Set<string>();
  held = new Map<Id, number>();
  created: Array<{ projectId: Id; name: string; commandId: Id }> = [];

  async entry(entryId: Id): Promise<VideoPlace> {
    const place = this.entries.get(entryId);
    if (place === 'trashed') throw new RpcError('conflict', '在回收站里', { code: 'SPACE_ENTRY_TRASHED' });
    if (place === 'not-video') throw new RpcError('invalid-request', '不是视频', { code: 'SPACE_ENTRY_NOT_VIDEO' });
    if (!place) throw new RpcError('not-found', '没有这个条目');
    return place;
  }

  async lease(place: VideoPlace): Promise<VideoLease> {
    const file = place.file as string;
    if (this.locked.has(file)) throw new RpcError('conflict', '被别的进程打开着', { code: 'VIDEO_LOCKED' });
    return this.#lease(file, place);
  }

  async reserve(request: { projectId: Id; name: string }): Promise<VideoPlace> {
    return { root: '/projects', file: request.name, scope: { projectId: request.projectId } };
  }

  async create(request: { projectId: Id; name: string; commandId: Id }): Promise<VideoLease> {
    this.created.push(request);
    const videoId = `video_new_${this.created.length}`;
    return this.#lease(videoId, { root: '/projects', file: videoId, scope: { projectId: request.projectId } });
  }

  leases(): number {
    return [...this.held.values()].reduce((a, b) => a + b, 0);
  }

  #lease(videoId: Id, place: VideoPlace): VideoLease {
    this.held.set(videoId, (this.held.get(videoId) ?? 0) + 1);
    let held = true;
    return {
      videoId,
      place,
      release: () => {
        if (!held) return;
        held = false;
        this.held.set(videoId, this.held.get(videoId)! - 1);
      },
    };
  }
}

describe('PipelineRunner video target', () => {
  let dir: string;
  let jobs: JobManager;
  let runner: PipelineRunner;
  let targets: FakeTargets;
  /** Video leases of the JobManager (`leaseVideo` for parent jobs and steps). */
  let retained: Map<Id, number>;
  let failWork: boolean;
  let seen: Array<Id | undefined>;

  function pipeline(): PipelineDefinition<TargetParams> {
    return {
      name: 'target-fake',
      label: '假流程',
      description: '测试用',
      paramsSchema: { type: 'object' },
      target: { create: { media: false } },
      parse(raw) {
        const target = raw.target as { create?: PipelineCreateTarget } | undefined;
        return {
          ...(typeof raw.videoId === 'string' ? { videoId: raw.videoId } : {}),
          ...(target?.create ? { create: target.create } : {}),
        };
      },
      async prepare(params) {
        return {
          params,
          providerId: 'test',
          modelId: 'test',
          videoId: params.videoId ?? null,
          contentHash: `sha256:${'0'.repeat(64)}`,
        };
      },
      steps: [
        targetStep(),
        {
          name: 'create',
          label: '新建视频',
          holdsVideo: true,
          when: (params) => Boolean(params.create),
          run: async ({ params, parentJobId, hold }) => {
            const lease = await targets.create({
              projectId: params.create!.projectId!,
              name: params.create!.name ?? '标题',
              commandId: `${parentJobId}:create`,
            });
            hold(lease);
            return { output: { videoId: lease.videoId, place: lease.place } };
          },
        },
        {
          name: 'work',
          label: '处理',
          run: async ({ params, outputs }) => {
            seen.push(params.videoId ?? (outputs.create?.videoId as Id | undefined));
            if (failWork) throw new PipelineStepError('FAKE_FAILED', '失败了');
            return { output: {} };
          },
        },
      ],
      async complete() {
        return { summary: {}, result: { documentId: null, artifactId: `sha256:${'1'.repeat(64)}` } };
      },
    };
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pipeline-targets-'));
    targets = new FakeTargets();
    retained = new Map();
    failWork = false;
    seen = [];
    jobs = testJobManager(dir, {
      retain: (videoId) => void retained.set(videoId, (retained.get(videoId) ?? 0) + 1),
      release: (videoId) => void retained.set(videoId, retained.get(videoId)! - 1),
    });
    await jobs.open();
    runner = new PipelineRunner({ jobs, stagingDir: path.join(dir, 'staging'), definitions: [pipeline()], targets });
    await runner.open();
  });

  afterEach(async () => {
    await runner.idle();
    await jobs.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const start = (params: Record<string, unknown>) =>
    runner.start({ pipeline: 'target-fake', params }, { kind: 'connection', id: 'conn_1' });

  async function finished(jobId: string): Promise<JobRecord> {
    await jobs.settled(jobId);
    await runner.idle();
    return jobs.inspect(jobId);
  }

  const parents = () => jobs.list().filter((r) => r.kind === 'pipeline');
  const retainedNow = () => [...retained.values()].reduce((a, b) => a + b, 0);
  const place1 = { root: '/space', file: 'video_1', scope: { projectId: 'p1' } };

  it('entryId: resolved at submit and opened under a lease, recorded as the first completed step; released when the pipeline finishes', async () => {
    targets.entries.set('entry_1', place1);
    const { jobId } = await start({ target: { entryId: 'entry_1' } });
    const done = await finished(jobId);
    expect(done).toMatchObject({ state: 'completed', videoId: 'video_1' });
    expect(seen).toEqual(['video_1']);
    expect(done.pipeline!.steps.map((s) => [s.name, s.status])).toEqual([
      ['target', 'completed'],
      ['create', 'skipped'],
      ['work', 'completed'],
    ]);
    expect(done.pipeline!.steps[0]!.output).toEqual({ entryId: 'entry_1', videoId: 'video_1', place: place1 });
    expect(jobs.inspect(done.pipeline!.steps[0]!.jobId!)).toMatchObject({ kind: 'pipeline-step', state: 'completed' });
    expect(targets.leases()).toBe(0);
    expect(retainedNow()).toBe(0);
  });

  it('a { videoId } target equal to the top-level videoId: the resolve-target step is skipped', async () => {
    const { jobId } = await start({ target: { videoId: 'video_9' } });
    const done = await finished(jobId);
    expect(done).toMatchObject({ state: 'completed', videoId: 'video_9' });
    expect(done.pipeline!.steps[0]!.status).toBe('skipped');
    expect(seen).toEqual(['video_9']);
  });

  it('rejects and releases the lease when the video resolved from entryId differs from the top-level videoId', async () => {
    targets.entries.set('entry_1', place1);
    await expect(start({ videoId: 'video_2', target: { entryId: 'entry_1' } })).rejects.toMatchObject({ code: 'invalid-request' });
    await expect(start({ videoId: 'video_2', target: { videoId: 'video_1' } })).rejects.toMatchObject({ code: 'invalid-request' });
    expect(targets.leases()).toBe(0);
    expect(parents()).toEqual([]);
  });

  it('locked by another process: rejected with VIDEO_LOCKED without creating a task; trash, not-a-video and missing entries each have their own error', async () => {
    targets.entries.set('entry_1', place1);
    targets.locked.add('video_1');
    await expect(start({ target: { entryId: 'entry_1' } })).rejects.toMatchObject({
      code: 'conflict',
      details: { code: 'VIDEO_LOCKED' },
    });
    targets.entries.set('entry_t', 'trashed');
    await expect(start({ target: { entryId: 'entry_t' } })).rejects.toMatchObject({ details: { code: 'SPACE_ENTRY_TRASHED' } });
    targets.entries.set('entry_d', 'not-video');
    await expect(start({ target: { entryId: 'entry_d' } })).rejects.toMatchObject({ details: { code: 'SPACE_ENTRY_NOT_VIDEO' } });
    await expect(start({ target: { entryId: 'entry_missing' } })).rejects.toMatchObject({ code: 'not-found' });
    expect(parents()).toEqual([]);
    expect(targets.leases()).toBe(0);
    expect(retainedNow()).toBe(0);
  });

  it('releases the lease on failure; retry re-acquires it from the recorded position', async () => {
    targets.entries.set('entry_1', place1);
    failWork = true;
    const { jobId } = await start({ target: { entryId: 'entry_1' } });
    expect(await finished(jobId)).toMatchObject({ state: 'failed', pipeline: { stoppedAt: 'work' } });
    expect(targets.leases()).toBe(0);
    expect(retainedNow()).toBe(0);

    failWork = false;
    await runner.retry(jobId);
    const done = await finished(jobId);
    expect(done).toMatchObject({ state: 'completed', attempt: 2, videoId: 'video_1' });
    expect(done.pipeline!.steps[0]!.status).toBe('completed');
    expect(seen).toEqual(['video_1', 'video_1']);
    expect(targets.leases()).toBe(0);
    expect(retainedNow()).toBe(0);
  });

  it('target locked by another process at retry: retry is rejected without keeping a lease, and the pipeline can still be retried', async () => {
    targets.entries.set('entry_1', place1);
    failWork = true;
    const { jobId } = await start({ target: { entryId: 'entry_1' } });
    await finished(jobId);
    targets.locked.add('video_1');
    await expect(runner.retry(jobId)).rejects.toMatchObject({ details: { code: 'VIDEO_LOCKED' } });
    expect(targets.leases()).toBe(0);
    expect(jobs.inspect(jobId).state).toBe('failed');

    targets.locked.clear();
    failWork = false;
    await runner.retry(jobId);
    expect(await finished(jobId)).toMatchObject({ state: 'completed' });
  });

  it('a step after creating the video fails: the video is kept and retry does not create it again', async () => {
    failWork = true;
    const { jobId } = await start({ target: { create: { projectId: 'p1', name: '新的' } } });
    const failed = await finished(jobId);
    expect(failed).toMatchObject({ state: 'failed', videoId: 'video_new_1', pipeline: { stoppedAt: 'work' } });
    expect(failed.pipeline!.steps.map((s) => s.status)).toEqual(['skipped', 'completed', 'failed']);
    expect(targets.created).toEqual([{ projectId: 'p1', name: '新的', commandId: `${jobId}:create` }]);
    expect(targets.leases()).toBe(0);
    expect(retainedNow()).toBe(0);

    failWork = false;
    await runner.retry(jobId);
    const done = await finished(jobId);
    expect(done).toMatchObject({ state: 'completed', videoId: 'video_new_1' });
    expect(targets.created).toHaveLength(1);
    expect(seen).toEqual(['video_new_1', 'video_new_1']);
    expect(targets.leases()).toBe(0);
    expect(retainedNow()).toBe(0);
  });

  it('entryId is rejected without a Runtime target; a pipeline that accepts targets must have targetStep() as its first step', async () => {
    const plain = new PipelineRunner({ jobs, stagingDir: path.join(dir, 'staging2'), definitions: [pipeline()] });
    await expect(
      plain.start({ pipeline: 'target-fake', params: { target: { entryId: 'e' } } }, { kind: 'connection', id: 'c' }),
    ).rejects.toMatchObject({ details: { code: 'PIPELINE_TARGET_UNSUPPORTED' } });
    expect(
      () =>
        new PipelineRunner({
          jobs,
          stagingDir: path.join(dir, 'staging3'),
          definitions: [{ ...pipeline(), steps: pipeline().steps.slice(1) }],
        }),
    ).toThrow(/targetStep/);
  });
});

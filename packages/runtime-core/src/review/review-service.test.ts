import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import {
  REVIEW_PLAN_KIND,
  RpcError,
  newId,
  type EditOperation,
  type Id,
  type JobRecord,
  type Project,
  type ReviewResult,
  type ReviewTopicEvent,
} from '@cuccut/protocol';
import { ReviewCriteriaStore, resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import type { TrustedPrincipal } from '../gateway.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { ReviewService } from './review-service.ts';

/**
 * The review service against a real Runtime and video engine: per-video decisions are one `review-plan` document
 * written as an edit (and undone like one), the result file is written outside the edit history and rewritten after a
 * decision, the export tier is read from a finished export, and answers are held to their evidence. Skipped without
 * engine-host (`npm run build:engine`, or `CUCCUT_ENGINE_HOST`).
 */

const engine = resolveEngineHostCommand();
if (!engine) console.warn('Skipping the review service tests: engine-host is not built (npm run build:engine)');

const user: TrustedPrincipal = { connectionId: 'review-test', kind: 'desktop', name: 'test' };
const agent: TrustedPrincipal = { connectionId: 'review-agent', kind: 'agent', name: 'claude' };

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

describe.skipIf(!engine)('review service (real engine)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;
  let store: ReviewCriteriaStore;
  let jobs: JobRecord[];
  let gate: boolean;
  let review: ReviewService;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-')));
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'desktop', name: 'test', version: '0' }, reconnect: false });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: 'Review' }));
    store = new ReviewCriteriaStore(path.join(dir, 'store', 'review-criteria.json'));
    await store.load();
    jobs = [];
    gate = true;
    review = new ReviewService({ videos: runtime.videos, jobs: { list: () => jobs }, store, settings: () => ({ gate }), log: runtime.log });
  });

  afterEach(async () => {
    await review?.flush();
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const snapshot = (videoId: Id) => runtime.videos.mirror(videoId)!.video;

  async function edit(videoId: Id, operations: EditOperation[]) {
    return client.request('edits.apply', { videoId, commandId: newId('cmd'), expectedRevision: snapshot(videoId).revision, operations });
  }

  /** A video with one unfilled placeholder box (0–2 s) and a text line (0.5–2 s) on a visual track. */
  async function placeholderVideo(): Promise<Id> {
    const { ref } = await client.request('videos.create', { projectId: project.id, name: 'Draft' });
    const sequenceId = snapshot(ref.videoId).rootSequenceId;
    await edit(ref.videoId, [
      { type: 'addTrack', sequenceId, kind: 'visual', ref: 'v' },
      {
        type: 'insertItems',
        sequenceId,
        items: [
          { type: 'placeholder', trackRef: 'v', span: { fromFrame: 0, durationFrames: 60 }, place: {}, placeholder: { variant: 'media' } },
          { type: 'text', trackRef: 'v', span: { fromFrame: 60, durationFrames: 30 }, place: { x: 50, w: 60 }, text: 'Watch this' },
        ] as never,
      },
    ]);
    return ref.videoId;
  }

  const resultFile = (videoId: Id) => path.join(project.path, '.cuccut-out', 'reviews', `${videoId}.json`);
  const readFile = async (videoId: Id) => JSON.parse(await fs.readFile(resultFile(videoId), 'utf8')) as ReviewResult;
  const planDocuments = (videoId: Id) => Object.values(snapshot(videoId).documents).filter((d) => d.kind === REVIEW_PLAN_KIND);

  it('checks the project tier without writing anything, and the gate follows the settings', async () => {
    const videoId = await placeholderVideo();
    const before = snapshot(videoId).revision;
    const { blocks, result } = await review.check(videoId);
    expect(blocks).toEqual({
      videoId,
      sequenceId: snapshot(videoId).rootSequenceId,
      findings: [{ id: 'placeholders', metric: 'items.placeholders', value: 1, limit: { max: 0 }, fix: expect.any(String) }],
    });
    expect(result.verdict).toBe('failed');
    expect(result.criteriaSource).toBe('builtin');
    expect(snapshot(videoId).revision).toBe(before);
    await expect(fs.stat(resultFile(videoId))).rejects.toThrow();
    expect(await review.get(videoId)).toBeNull();

    expect(await review.gate(videoId, { kind: 'video', format: 'mp4' })).not.toBeNull();
    expect(await review.gate(videoId, { kind: 'video', format: 'mp4', purpose: 'preview' })).toBeNull();
    expect(await review.gate(videoId, { kind: 'subtitles', format: 'srt' })).toBeNull();
    gate = false;
    expect(await review.gate(videoId, { kind: 'video', format: 'mp4' })).toBeNull();
  });

  it('writes one review-plan document per waiver, rewrites the result at the new revision, and undo takes it back', async () => {
    const videoId = await placeholderVideo();
    const events: ReviewTopicEvent[] = [];
    review.topic.log.subscribe(undefined, (e) => events.push(e.event));

    const first = await review.run(videoId);
    expect(first.verdict).toBe('failed');
    expect((await readFile(videoId)).revision).toBe(snapshot(videoId).revision);

    const reason = await rejection(review.waive(videoId, 'placeholders', '   ', user));
    expect(reason.details).toMatchObject({ code: 'REVIEW_REASON_REQUIRED' });
    const unknown = await rejection(review.waive(videoId, 'nothing-like-it', 'because', user));
    expect(unknown.details).toMatchObject({ code: 'REVIEW_UNKNOWN_FINDING', id: 'nothing-like-it' });
    expect(planDocuments(videoId)).toHaveLength(0);

    const waived = await review.waive(videoId, 'placeholders', 'the box is the design', user);
    expect(planDocuments(videoId)).toHaveLength(1);
    expect(waived.plan.waivers).toEqual([{ id: 'placeholders', reason: 'the box is the design', by: 'user', at: expect.any(String) }]);
    expect(waived.receipt.videoRevision).toBe(snapshot(videoId).revision);
    expect(waived.result.revision).toBe(snapshot(videoId).revision);
    expect(waived.result.verdict).toBe('passed');
    expect(waived.result.checks.find((c) => c.id === 'placeholders')).toMatchObject({ ok: false, waived: { reason: 'the box is the design', by: 'user' } });
    expect((await readFile(videoId)).revision).toBe(waived.receipt.videoRevision);
    expect((await review.check(videoId)).blocks).toBeNull();
    expect(await review.gate(videoId, { kind: 'video', format: 'mp4' })).toBeNull();

    // A second decision rewrites the same document rather than adding one.
    await review.setSeverity(videoId, 'text-edge', 'critical', undefined, user);
    expect(planDocuments(videoId)).toHaveLength(1);
    const lowered = await rejection(review.setSeverity(videoId, 'placeholders', 'nitpick', undefined, user));
    expect(lowered.details).toMatchObject({ code: 'REVIEW_REASON_REQUIRED' });
    const low = await review.setSeverity(videoId, 'placeholders', 'suggestion', 'a rough cut for review', user);
    expect(low.result.checks.find((c) => c.id === 'placeholders')!.lowered).toEqual({ from: 'critical', reason: 'a rough cut for review' });

    // Undo the last two decisions, then the waiver: the plan document goes with the first one.
    await runtime.videos.undo({ videoId, commandId: newId('cmd'), target: 'undo' }, user);
    await runtime.videos.undo({ videoId, commandId: newId('cmd'), target: 'undo' }, user);
    await runtime.videos.undo({ videoId, commandId: newId('cmd'), target: 'undo' }, user);
    expect(planDocuments(videoId)).toHaveLength(0);
    expect((await review.check(videoId)).blocks?.findings.map((f) => f.id)).toEqual(['placeholders']);

    const unwaived = await review.waive(videoId, 'placeholders', 'again', agent);
    expect(unwaived.plan.waivers[0]!.by).toBe('agent');
    const back = await review.unwaive(videoId, 'placeholders', user);
    expect(back.plan.waivers).toEqual([]);
    expect(back.result.verdict).toBe('failed');

    expect(events.filter((e) => e.type === 'result').length).toBeGreaterThanOrEqual(5);
    expect(review.topic.summary(videoId)).toMatchObject({ verdict: 'failed', open: 1, stale: false });
  });

  it('reads the export tier from a finished export, and a decision does not make it look stale', async () => {
    const videoId = await placeholderVideo();
    await store.set({
      schema: 'cuccut.review-criteria/1',
      checks: [
        { id: 'short', metric: 'export.durationSec', max: 2, severity: 'suggestion', fix: 'Trim it.' },
        { id: 'loud', metric: 'export.loudnessLufs', min: -18, max: -14, severity: 'suggestion', fix: 'Normalise it.' },
      ],
      rubric: [],
    });
    const notYet = await review.run(videoId);
    expect(notYet.skipped).toEqual(expect.arrayContaining([{ id: 'short', reason: 'not-exported', detail: 'export.durationSec' }]));
    expect(notYet.stages).toEqual(['project']);

    const sequenceId = snapshot(videoId).rootSequenceId;
    jobs = [
      {
        jobId: 'job_export',
        kind: 'export',
        state: 'completed',
        videoId,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        endedAt: '2026-01-01T00:00:10Z',
        export: {
          settings: { kind: 'video', format: 'mp4' },
          snapshotArtifactId: 'sha256:x',
          videoRevision: snapshot(videoId).revision,
          sequenceId,
          destination: { dir: project.path, files: ['Draft.mp4'], overwrite: false },
        },
        result: {
          documentId: null,
          artifactId: 'sha256:y',
          outputs: [
            {
              artifactId: 'sha256:y',
              mediaType: 'video/mp4',
              byteLength: 10,
              assetId: null,
              media: { kind: 'video', durationSec: 3, width: 1080, height: 1920, videoCodec: 'h264', audioCodec: null },
            },
          ],
        },
      } as unknown as JobRecord,
    ];
    const read = await review.run(videoId);
    expect(read.stages).toEqual(['project', 'export']);
    expect(read.measured.export).toEqual({ bag: { 'export.durationSec': 3, 'export.width': 1080, 'export.height': 1920 }, jobId: 'job_export', revision: read.revision });
    expect(read.checks.find((c) => c.id === 'short')).toMatchObject({ ok: false, value: 3 });
    expect(read.skipped).toEqual(expect.arrayContaining([{ id: 'loud', reason: 'unreadable', detail: 'export.loudnessLufs' }]));

    const waived = await review.waive(videoId, 'short', 'two seconds was a guess', user);
    expect(waived.result.measured.export!.revision).toBe(waived.result.revision);
    expect(waived.result.measured.export!.revision).not.toBe(read.revision);
    expect((await review.run(videoId)).measured.export!.revision).toBe(waived.result.revision);
    expect(review.topic.summary(videoId)!.stale).toBe(false);

    // A real edit after the export does make it stale.
    await edit(videoId, [{ type: 'renameVideo', name: 'Draft 2' }]);
    const after = await review.run(videoId);
    expect(after.measured.export!.revision).not.toBe(after.revision);
    expect(review.topic.summary(videoId)!.stale).toBe(true);
  });

  it('holds answers to their evidence and keeps them across runs', async () => {
    const videoId = await placeholderVideo();
    await store.set({
      schema: 'cuccut.review-criteria/1',
      checks: [],
      rubric: [
        { id: 'opens', ask: 'Does it open on the point?', evidence: 'timestamp', severity: 'critical', fix: 'Start later.' },
        { id: 'title', ask: 'Is the title on screen?', evidence: 'field', severity: 'suggestion', fix: 'Add a title.' },
        { id: 'frame', ask: 'Is the end frame clean?', evidence: 'frame', severity: 'suggestion', fix: 'Clean it.' },
      ],
    });
    const asked = await review.run(videoId);
    expect(asked.skipped.filter((s) => s.reason === 'not-asked').map((s) => s.id)).toEqual(['opens', 'title', 'frame']);

    const unknown = await rejection(review.recordAnswers(videoId, [{ id: 'ghost', verdict: 'holds', evidence: '1s' }], agent));
    expect(unknown.details).toMatchObject({ code: 'REVIEW_UNKNOWN_FINDING' });
    const shape = await rejection(review.recordAnswers(videoId, [{ id: 'opens', verdict: 'perhaps' }], agent));
    expect(shape.details).toMatchObject({ code: 'REVIEW_ANSWERS_INVALID' });

    const frames = path.join(project.path, '.cuccut-out', 'frames', videoId);
    await fs.mkdir(frames, { recursive: true });
    await fs.writeFile(path.join(frames, 'frame-2.0.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
    const textId = snapshot(videoId).sequences[snapshot(videoId).rootSequenceId]!.items.find((i) => i.type === 'text')!.id;
    const answered = await review.recordAnswers(
      videoId,
      [
        { id: 'opens', verdict: 'holds', evidence: '45s', note: 'later on' },
        { id: 'title', verdict: 'holds', evidence: textId },
        { id: 'frame', verdict: 'holds', evidence: `.cuccut-out/frames/${videoId}/frame-2.0.jpg` },
      ],
      agent,
    );
    expect(answered.stages).toContain('rubric');
    expect(answered.rubric.map((r) => [r.id, r.verdict])).toEqual([
      ['opens', 'cannot-tell'],
      ['title', 'holds'],
      ['frame', 'holds'],
    ]);
    expect(answered.answers).toMatchObject({ by: 'agent', revision: answered.revision });
    expect(answered.verdict).toBe('failed');

    const again = await review.run(videoId);
    expect(again.rubric.map((r) => r.verdict)).toEqual(['cannot-tell', 'holds', 'holds']);
    expect((await review.get(videoId))!.answers!.items).toHaveLength(3);
  });

  it('refuses a broken standard by code and keeps lint warnings beside a saved one', async () => {
    const invalid = await rejection(review.setCriteria({ checks: [{ id: 'Bad Id', metric: 'video.durationSec' }] }));
    expect(invalid.details).toMatchObject({ code: 'REVIEW_CRITERIA_INVALID' });
    const duplicate = await rejection(
      review.setCriteria({
        checks: [
          { id: 'a', metric: 'video.durationSec', max: 60 },
          { id: 'a', metric: 'video.shots', max: 9 },
        ],
      }),
    );
    expect(duplicate.details).toMatchObject({ code: 'REVIEW_CRITERIA_INVALID', issues: [{ code: 'duplicate-id', id: 'a' }] });

    const saved = await review.setCriteria({ checks: [{ id: 'vibes', metric: 'video.vibes', max: 3 }] }, 0);
    expect(saved.revision).toBe(1);
    expect(saved.warnings.map((w) => w.code)).toEqual(['unknown-metric']);
    const conflict = await rejection(review.setCriteria({ checks: [] }, 0));
    expect(conflict.details).toMatchObject({ code: 'REVIEW_CRITERIA_CONFLICT', revision: 1 });
    const criteria = await review.criteria();
    expect(criteria.source).toBe('user');
    expect(criteria.checks.map((c) => c.id)).toEqual(['placeholders', 'blank', 'text-edge', 'vibes']);
    expect(review.catalogue().length).toBe(19);
  });
});

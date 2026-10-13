import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId, type EditOperation, type ExportSettings, type Id, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';

/**
 * The review gate in `exports.create` (docs/cuccut/m2-review-gate.md §4.3): a deliverable finished video with an open
 * critical finding is refused with `REVIEW_BLOCKED` before any snapshot or job exists; a preview, a waived finding, the
 * gate switched off, and other export kinds are not stopped. Needs engine-host and ffmpeg; skipped if missing, like
 * `exports.test.ts`.
 */

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!engine || !ffmpeg) console.warn('Skipping the review gate tests: no engine-host or ffmpeg');

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

const finished: ExportSettings = { kind: 'video', format: 'mp4' };

describe.skipIf(!engine || !ffmpeg)('review gate in exports.create (real engine)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-gate-')));
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
    ({ project } = await client.request('projects.create', { name: 'Gate' }));
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const snapshot = (videoId: Id) => runtime.videos.mirror(videoId)!.video;

  async function edit(videoId: Id, operations: EditOperation[]) {
    return client.request('edits.apply', { videoId, commandId: newId('cmd'), expectedRevision: snapshot(videoId).revision, operations });
  }

  /** A video whose only picture is an unfilled placeholder box: the built-in critical check fails on it. */
  async function placeholderVideo(): Promise<Id> {
    const { ref } = await client.request('videos.create', { projectId: project.id, name: 'Draft' });
    const sequenceId = snapshot(ref.videoId).rootSequenceId;
    await edit(ref.videoId, [
      { type: 'addTrack', sequenceId, kind: 'visual', ref: 'v' },
      {
        type: 'insertItems',
        sequenceId,
        items: [{ type: 'placeholder', trackRef: 'v', span: { fromFrame: 0, durationFrames: 30 }, place: {}, placeholder: { variant: 'media' } }] as never,
      },
    ]);
    return ref.videoId;
  }

  /**
   * Whatever happens after the gate (a job, or a later preflight or render refusal), the gate itself did not refuse.
   * Returns the job id when one was created.
   */
  async function notGated(videoId: Id, settings: ExportSettings): Promise<Id | null> {
    try {
      return (await client.request('exports.create', { videoId, settings })).jobId;
    } catch (error) {
      expect(error).toBeInstanceOf(RpcError);
      expect((error as RpcError).details).not.toMatchObject({ code: 'REVIEW_BLOCKED' });
      return null;
    }
  }

  it('refuses a deliverable finished video with an open critical finding, and creates nothing', async () => {
    const videoId = await placeholderVideo();
    const before = runtime.models.jobs.list().length;
    const refused = await rejection(client.request('exports.create', { videoId, settings: finished }));
    expect(refused.code).toBe('conflict');
    expect(refused.details).toMatchObject({
      code: 'REVIEW_BLOCKED',
      videoId,
      sequenceId: snapshot(videoId).rootSequenceId,
      findings: [{ id: 'placeholders', metric: 'items.placeholders', value: 1, limit: { max: 0 }, fix: expect.any(String) }],
      remedy: expect.any(String),
    });
    expect(runtime.models.jobs.list()).toHaveLength(before);
    expect(await client.request('exports.list', { videoId })).toEqual({ jobs: [] });
    // Nothing was written either: the gate only measures.
    await expect(fs.stat(path.join(project.path, '.cuccut-out', 'reviews', `${videoId}.json`))).rejects.toThrow();
  });

  it('never stops a preview, or an export that is not the finished video', async () => {
    const videoId = await placeholderVideo();
    await notGated(videoId, { ...finished, purpose: 'preview' });
    // No transcript to export: the subtitles preflight answers, not the gate.
    const subtitles = await rejection(client.request('exports.create', { videoId, settings: { kind: 'subtitles', format: 'srt' } }));
    expect(subtitles.details).toMatchObject({ code: 'EXPORT_SOURCE_NOT_FOUND' });
    expect(await notGated(videoId, { kind: 'portable', format: 'cuccut' })).toEqual(expect.any(String));
  });

  it('lets a finding the user let stand through, and holds it again once the waiver is undone', async () => {
    const videoId = await placeholderVideo();
    await client.request('review.waive', { videoId, id: 'placeholders', reason: 'The client fills the box' });
    await notGated(videoId, finished);
    await client.request('review.unwaive', { videoId, id: 'placeholders' });
    const refused = await rejection(client.request('exports.create', { videoId, settings: finished }));
    expect(refused.details).toMatchObject({ code: 'REVIEW_BLOCKED' });
  });

  it('does not stop anything with review.gate off, and a lowered severity no longer blocks', async () => {
    const videoId = await placeholderVideo();
    await client.request('settings.set', { values: { 'review.gate': false } });
    await notGated(videoId, finished);
    await client.request('settings.set', { values: { 'review.gate': null } });
    expect((await rejection(client.request('exports.create', { videoId, settings: finished }))).details).toMatchObject({ code: 'REVIEW_BLOCKED' });

    await client.request('review.severity', { videoId, id: 'placeholders', severity: 'suggestion', reason: 'Rough cut for the team' });
    await notGated(videoId, finished);
  });
});

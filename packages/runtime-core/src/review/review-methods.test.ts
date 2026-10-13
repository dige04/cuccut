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
  type Project,
  type ReviewTopicEvent,
  type ReviewTopicSnapshot,
} from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { until } from '../agent-tools/testing/fake-agent.ts';

/**
 * `review.*` and the `review` topic through the gateway (docs/cuccut/m2-review-gate.md §4.5): the Runtime builds one
 * ReviewService, the handlers reach it with the connection's principal, decisions are edits on the undo stack, the
 * standard is stored in the Runtime Home, and the topic carries the standard and the summaries. Skipped without
 * engine-host (`npm run build:engine`, or `CUCCUT_ENGINE_HOST`).
 */

const engine = resolveEngineHostCommand();
if (!engine) console.warn('Skipping the review method tests: engine-host is not built (npm run build:engine)');

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

describe.skipIf(!engine)('review methods (real engine)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let project: Project;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-methods-')));
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

  /** A video with one unfilled placeholder box on a visual track. */
  async function placeholderVideo(): Promise<Id> {
    const { ref } = await client.request('videos.create', { projectId: project.id, name: 'Draft' });
    const sequenceId = snapshot(ref.videoId).rootSequenceId;
    await edit(ref.videoId, [
      { type: 'addTrack', sequenceId, kind: 'visual', ref: 'v' },
      {
        type: 'insertItems',
        sequenceId,
        items: [{ type: 'placeholder', trackRef: 'v', span: { fromFrame: 0, durationFrames: 60 }, place: {}, placeholder: { variant: 'media' } }] as never,
      },
    ]);
    return ref.videoId;
  }

  it('reads the catalogue and the standard, and stores a new standard in the Runtime Home', async () => {
    const { metrics } = await client.request('review.catalogue', {});
    expect(metrics).toHaveLength(19);
    expect(metrics.map((m) => m.name)).toContain('items.placeholders');

    const builtin = await client.request('review.criteria.get', {});
    expect(builtin).toMatchObject({ source: 'builtin', revision: 0, rubric: [], warnings: [] });
    expect(builtin.checks.map((c) => c.id)).toEqual(['placeholders', 'blank', 'text-edge']);

    const invalid = await rejection(
      client.request('review.criteria.set', {
        standard: { checks: [{ id: 'a', metric: 'video.durationSec', max: 60 }, { id: 'a', metric: 'video.shots', max: 9 }] } as never,
      }),
    );
    expect(invalid.code).toBe('invalid-request');
    expect(invalid.details).toMatchObject({ code: 'REVIEW_CRITERIA_INVALID', issues: [{ code: 'duplicate-id', id: 'a' }] });

    const saved = await client.request('review.criteria.set', {
      standard: { schema: 'cuccut.review-criteria/1', checks: [{ id: 'short', metric: 'video.durationSec', max: 60, severity: 'critical', fix: 'Cut it.' }], rubric: [] },
      expectedRevision: 0,
    });
    expect(saved).toMatchObject({ revision: 1, warnings: [] });
    const conflict = await rejection(client.request('review.criteria.set', { standard: { checks: [], rubric: [] } as never, expectedRevision: 0 }));
    expect(conflict.code).toBe('conflict');
    expect(conflict.details).toMatchObject({ code: 'REVIEW_CRITERIA_CONFLICT', revision: 1 });

    const stored = JSON.parse(await fs.readFile(path.join(dir, 'store', 'review-criteria.json'), 'utf8'));
    expect(stored).toMatchObject({ schemaVersion: 1, revision: 1, standard: { checks: [{ id: 'short' }] } });
    expect((await client.request('review.criteria.get', {})).source).toBe('user');
  });

  it('checks without writing, runs and reads back the result, and the topic carries the standard and the summaries', async () => {
    const videoId = await placeholderVideo();
    let mirror: ReviewTopicSnapshot | null = null;
    const events: ReviewTopicEvent[] = [];
    client.subscribeReview({
      snapshot: (s) => {
        mirror = s;
      },
      event: (e) => {
        events.push(e);
      },
    });
    const initial = await until(() => mirror);
    expect(initial).toEqual({ criteria: { standard: { schema: 'cuccut.review-criteria/1', checks: [], rubric: [] }, revision: 0 }, results: {} });

    const before = snapshot(videoId).revision;
    const checked = await client.request('review.check', { videoId });
    expect(checked.blocks?.findings.map((f) => f.id)).toEqual(['placeholders']);
    expect(snapshot(videoId).revision).toBe(before);
    expect(await client.request('review.get', { videoId })).toEqual({ result: null });

    const { result } = await client.request('review.run', { videoId });
    expect(result).toMatchObject({ videoId, verdict: 'failed', revision: before });
    expect((await client.request('review.get', { videoId })).result).toEqual(result);
    await until(() => events.some((e) => e.type === 'result' && e.videoId === videoId));
    expect(events.find((e) => e.type === 'result')).toEqual({
      type: 'result',
      videoId,
      summary: { verdict: 'failed', revision: before, at: result.at, open: 1, stale: false },
    });

    await client.request('review.criteria.set', { standard: { checks: [], rubric: [] } as never });
    await until(() => events.some((e) => e.type === 'criteria'));

    const missing = await rejection(client.request('review.check', { videoId: 'vid_nope' }));
    expect(missing.details).toMatchObject({ code: 'VIDEO_NOT_OPEN' });
  });

  it('decides through edits: waive, severity and unwaive are on the undo stack, and the result follows', async () => {
    const videoId = await placeholderVideo();
    await client.request('review.run', { videoId });

    const noReason = await rejection(client.request('review.waive', { videoId, id: 'placeholders', reason: '  ' }));
    expect(noReason.details).toMatchObject({ code: 'REVIEW_REASON_REQUIRED' });
    const unknown = await rejection(client.request('review.waive', { videoId, id: 'ghost', reason: 'why not' }));
    expect(unknown.details).toMatchObject({ code: 'REVIEW_UNKNOWN_FINDING' });

    const waived = await client.request('review.waive', { videoId, id: 'placeholders', reason: 'The client fills it' });
    expect(waived.plan.waivers).toEqual([{ id: 'placeholders', reason: 'The client fills it', by: 'user', at: expect.any(String) }]);
    expect(waived.result).toMatchObject({ verdict: 'passed', revision: waived.receipt.videoRevision });
    expect((await client.request('review.check', { videoId })).blocks).toBeNull();
    expect(Object.values(snapshot(videoId).documents).filter((d) => d.kind === REVIEW_PLAN_KIND)).toHaveLength(1);
    // The decision is an ordinary edit: it carries the review label and the undo stack holds it.
    const undoState = await client.request('edits.undoState', { videoId });
    expect(undoState.undo).toMatchObject({ transactionId: waived.receipt.transactionId, labelRef: { key: 'rcReview.waiveLabel' } });

    const lowering = await rejection(client.request('review.severity', { videoId, id: 'placeholders', severity: 'nitpick' }));
    expect(lowering.details).toMatchObject({ code: 'REVIEW_REASON_REQUIRED' });
    const lowered = await client.request('review.severity', { videoId, id: 'placeholders', severity: 'suggestion', reason: 'Rough cut' });
    expect(lowered.plan.severities).toEqual({ placeholders: 'suggestion' });
    expect(lowered.result.checks.find((c) => c.id === 'placeholders')!.lowered).toEqual({ from: 'critical', reason: 'Rough cut' });
    const restored = await client.request('review.severity', { videoId, id: 'placeholders', severity: null });
    expect(restored.plan.severities).toEqual({});

    const back = await client.request('review.unwaive', { videoId, id: 'placeholders' });
    expect(back.plan.waivers).toEqual([]);
    expect(back.result.verdict).toBe('failed');

    // Undoing the last decision lets the finding stand again.
    const undone = await client.request('edits.undo', { videoId, commandId: newId('cmd'), target: 'undo' });
    await until(() => snapshot(videoId).revision === undone.receipt.videoRevision);
    expect((await client.request('review.check', { videoId })).blocks).toBeNull();
  });
});

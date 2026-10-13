import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REVIEW_PLAN_KIND, RpcError, type JobRecord, type ReviewPlan } from '@cuccut/protocol';
import { silentLogger } from '@cuccut/harness';
import { ReviewCriteriaStore } from '@cuccut/runtime-storage';
import type { TrustedPrincipal } from '../gateway.ts';
import { ReviewService } from './review-service.ts';
import { FAKE_VIDEO_ID, FakeVideos } from './testing/fake-videos.ts';

/**
 * The review service without an engine: a fake video (one placeholder box) whose edits only write documents. Covers the
 * decisions (`#decide`: waive, unwaive, severity), the answers' id check and the export gate's conditions; the real-engine
 * suite (`review-service.test.ts`) covers the same paths end to end when engine-host is built.
 */

const user: TrustedPrincipal = { connectionId: 'review-unit', kind: 'desktop', name: 'test' };
const agent: TrustedPrincipal = { connectionId: 'review-unit-agent', kind: 'agent', name: 'claude' };

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

const codeOf = (error: RpcError) => (error.details as { code?: string }).code;

describe('review service (engine-free)', () => {
  let dir: string;
  let videos: FakeVideos;
  let store: ReviewCriteriaStore;
  let jobs: JobRecord[];
  let gate: boolean;
  let review: ReviewService;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-unit-')));
    videos = new FakeVideos(dir);
    store = new ReviewCriteriaStore(path.join(dir, 'store', 'review-criteria.json'));
    await store.load();
    jobs = [];
    gate = true;
    review = new ReviewService({ videos: videos as never, jobs: { list: () => jobs }, store, settings: () => ({ gate }), log: silentLogger });
  });

  afterEach(async () => {
    await review.flush();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const plan = (): ReviewPlan => {
    const document = Object.values(videos.snapshot.documents).find((d) => d.kind === REVIEW_PLAN_KIND);
    return videos.bodies.get(document!.id) as ReviewPlan;
  };

  it('stops a deliverable export only when the gate is on, for a finished video that is not a preview', async () => {
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4' })).toMatchObject({ findings: [{ id: 'placeholders' }] });
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4', purpose: 'deliverable' })).not.toBeNull();
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4', purpose: 'preview' })).toBeNull();
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'subtitles', format: 'srt' })).toBeNull();
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'audio', format: 'wav' })).toBeNull();
    gate = false;
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4' })).toBeNull();
    // Checking writes nothing.
    expect(videos.applied).toHaveLength(0);
  });

  it('waives with one putDocument, records who decided from the principal, and unwaives', async () => {
    const decided = await review.waive(FAKE_VIDEO_ID, 'placeholders', '  The client fills it.  ', agent);
    expect(videos.applied).toHaveLength(1);
    const [edit] = videos.applied;
    expect(edit!.params.operations).toEqual([expect.objectContaining({ type: 'putDocument', kind: REVIEW_PLAN_KIND })]);
    expect(edit!.params.labelRef?.key).toBe('rcReview.waiveLabel');
    // The review service is the decisions document's one writer: it marks its own writes.
    expect(edit!.provenance).toMatchObject({ reviewPlan: true });
    expect(decided.plan.waivers).toEqual([{ id: 'placeholders', reason: 'The client fills it.', by: 'agent', at: expect.any(String) }]);
    expect(plan().waivers).toHaveLength(1);
    expect(decided.result.revision).toBe(videos.snapshot.revision);
    expect(decided.result.checks.find((c) => c.id === 'placeholders')?.waived).toMatchObject({ reason: 'The client fills it.' });
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4' })).toBeNull();

    const byUser = await review.waive(FAKE_VIDEO_ID, 'placeholders', 'Delivered as a template.', user);
    expect(byUser.plan.waivers).toEqual([expect.objectContaining({ by: 'user', reason: 'Delivered as a template.' })]);
    // The second edit replaces the same document rather than adding another.
    expect(videos.applied[1]!.params.operations[0]).toMatchObject({ documentId: expect.any(String) });
    expect(Object.values(videos.snapshot.documents).filter((d) => d.kind === REVIEW_PLAN_KIND)).toHaveLength(1);

    const held = await review.unwaive(FAKE_VIDEO_ID, 'placeholders', user);
    expect(held.plan.waivers).toEqual([]);
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4' })).not.toBeNull();
  });

  it('refuses a waiver without a reason or with one that is too long, and an id the standard does not have', async () => {
    expect(codeOf(await rejection(review.waive(FAKE_VIDEO_ID, 'placeholders', '   ', user)))).toBe('REVIEW_REASON_REQUIRED');
    expect(codeOf(await rejection(review.waive(FAKE_VIDEO_ID, 'placeholders', 'x'.repeat(501), user)))).toBe('REVIEW_REASON_REQUIRED');
    expect(codeOf(await rejection(review.waive(FAKE_VIDEO_ID, 'nope', 'Because.', user)))).toBe('REVIEW_UNKNOWN_FINDING');
    expect(videos.applied).toHaveLength(0);
  });

  it('needs a reason to lower a severity, none to raise it, and null gives back the standard', async () => {
    expect(codeOf(await rejection(review.setSeverity(FAKE_VIDEO_ID, 'placeholders', 'suggestion', undefined, user)))).toBe('REVIEW_REASON_REQUIRED');
    expect(videos.applied).toHaveLength(0);

    const lowered = await review.setSeverity(FAKE_VIDEO_ID, 'placeholders', 'suggestion', 'A draft for the team.', user);
    expect(lowered.plan.severities).toEqual({ placeholders: 'suggestion' });
    expect(lowered.plan.reasons).toEqual({ placeholders: 'A draft for the team.' });
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4' })).toBeNull();

    const raised = await review.setSeverity(FAKE_VIDEO_ID, 'blank', 'critical', undefined, user);
    expect(raised.plan.severities).toEqual({ placeholders: 'suggestion', blank: 'critical' });
    expect(raised.plan.reasons).toEqual({ placeholders: 'A draft for the team.' });

    const restored = await review.setSeverity(FAKE_VIDEO_ID, 'placeholders', null, undefined, user);
    expect(restored.plan.severities).toEqual({ blank: 'critical' });
    expect(restored.plan.reasons).toEqual({});
    expect(await review.gate(FAKE_VIDEO_ID, { kind: 'video', format: 'mp4' })).not.toBeNull();
  });

  it('records answers only to the questions of the standard', async () => {
    await store.set({
      schema: 'cuccut.review-criteria/1',
      checks: [],
      rubric: [{ id: 'hook', ask: 'Does the promise land in the first two seconds?', evidence: 'timestamp', severity: 'suggestion', fix: 'Open on the promise.' }],
    });
    const unknown = await rejection(review.recordAnswers(FAKE_VIDEO_ID, [{ id: 'nope', verdict: 'holds', evidence: '1s' }], agent));
    expect(codeOf(unknown)).toBe('REVIEW_UNKNOWN_FINDING');
    expect(codeOf(await rejection(review.recordAnswers(FAKE_VIDEO_ID, [{ id: 'hook' }], agent)))).toBe('REVIEW_ANSWERS_INVALID');

    const result = await review.recordAnswers(FAKE_VIDEO_ID, [{ id: 'hook', verdict: 'holds', evidence: '1.5s' }], agent);
    expect(result.answers).toMatchObject({ by: 'agent', revision: videos.snapshot.revision, items: [{ id: 'hook', verdict: 'holds' }] });
    expect(result.rubric).toEqual([expect.objectContaining({ id: 'hook', verdict: 'holds', ok: true })]);
    expect(videos.applied).toHaveLength(0);
  });
});

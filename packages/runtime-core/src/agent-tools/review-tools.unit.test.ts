import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REVIEW_PLAN_KIND, type HistoryEntry, type UndoState } from '@cuccut/protocol';
import { RcReview } from '@cuccut/protocol/messages/runtime-core';
import { silentLogger } from '@cuccut/harness';
import { ReviewCriteriaStore } from '@cuccut/runtime-storage';
import { ReviewService } from '../review/review-service.ts';
import { FAKE_VIDEO_ID, FakeVideos } from '../review/testing/fake-videos.ts';
import { ReviewTools } from './review-tools.ts';
import { ToolError } from './tool-catalog.ts';
import type { ToolConfirmation, ToolPrincipal, ToolScope } from './tool-scope.ts';
import { VideoTools } from './video-tools.ts';

/**
 * The review tools' confirmations without an engine: a fake scope records what the user would be asked, over the real
 * review service on a fake video. Loosening the gate asks at `high`; a call that cannot succeed is refused before asking;
 * the prompt names severities in words; and the decisions document cannot be written or loosened through the generic
 * video tools (`documents_put`, `edits_apply`, `edits_undo`).
 */

const agent = { connectionId: 'review-tools-unit', kind: 'agent', name: 'claude' } as unknown as ToolPrincipal;

class FakeScope {
  readonly asked: ToolConfirmation[] = [];
  readonly #videos: FakeVideos;
  constructor(videos: FakeVideos) {
    this.#videos = videos;
  }
  authorize(principal: ToolPrincipal) {
    return { principal, submitter: { kind: 'agent' } };
  }
  async confirm(_access: unknown, request: ToolConfirmation) {
    this.asked.push(request);
    return { mode: 'default', risk: request.risk ?? 'edit', decidedBy: 'user' } as const;
  }
  async open() {
    return { ref: this.#videos.ref(FAKE_VIDEO_ID)!, snapshot: this.#videos.mirror(FAKE_VIDEO_ID)! };
  }
  importBase() {
    return { cwd: '/', confine: null };
  }
  commandId(_access: unknown, given: string | undefined) {
    return given ?? 'cmd_fake';
  }
  recordChange() {}
  protections() {
    return [];
  }
}

async function toolError(promise: Promise<unknown>): Promise<ToolError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('review tools (engine-free)', () => {
  let dir: string;
  let videos: FakeVideos;
  let scope: FakeScope;
  let review: ReviewService;
  let tools: ReviewTools;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-tools-unit-')));
    videos = new FakeVideos(dir);
    scope = new FakeScope(videos);
    const store = new ReviewCriteriaStore(path.join(dir, 'store', 'review-criteria.json'));
    await store.load();
    review = new ReviewService({ videos: videos as never, jobs: { list: () => [] }, store, settings: () => ({ gate: true }), log: silentLogger });
    tools = new ReviewTools({ review, scope: scope as unknown as ToolScope });
  });

  afterEach(async () => {
    await review.flush();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('asks at high risk to let a finding stand, and refuses a reason it cannot keep before asking', async () => {
    const long = await toolError(tools.dispatch('review_waive', { video: 'Draft', id: 'placeholders', reason: 'x'.repeat(600) }, agent));
    expect(long.code).toBe('REVIEW_REASON_REQUIRED');
    expect(long.extra).toMatchObject({ limit: 500 });
    const empty = await toolError(tools.dispatch('review_waive', { video: 'Draft', id: 'placeholders', reason: '  ' }, agent));
    expect(empty.code).toBe('REVIEW_REASON_REQUIRED');
    expect(scope.asked).toHaveLength(0);
    expect(videos.applied).toHaveLength(0);

    const done = (await tools.dispatch('review_waive', { video: 'Draft', id: 'placeholders', reason: 'The client fills it.' }, agent)) as { plan: { waivers: unknown[] } };
    expect(scope.asked).toEqual([expect.objectContaining({ tool: 'review_waive', risk: 'high' })]);
    expect(done.plan.waivers).toEqual([expect.objectContaining({ id: 'placeholders', by: 'agent' })]);

    await tools.dispatch('review_unwaive', { video: 'Draft', id: 'placeholders' }, agent);
    expect(scope.asked[1]).toMatchObject({ tool: 'review_unwaive' });
    expect(scope.asked[1]!.risk).toBeUndefined();
  });

  it('asks at high risk to lower a severity, names severities in words, and raising is an ordinary edit', async () => {
    const long = await toolError(
      tools.dispatch('review_severity', { video: 'Draft', id: 'placeholders', severity: 'nitpick', reason: 'y'.repeat(501) }, agent),
    );
    expect(long.code).toBe('REVIEW_REASON_REQUIRED');
    const missing = await toolError(tools.dispatch('review_severity', { video: 'Draft', id: 'placeholders', severity: 'nitpick' }, agent));
    expect(missing.code).toBe('REVIEW_REASON_REQUIRED');
    expect(scope.asked).toHaveLength(0);

    await tools.dispatch('review_severity', { video: 'Draft', id: 'placeholders', severity: 'suggestion', reason: 'A team draft.' }, agent);
    expect(scope.asked[0]).toMatchObject({ tool: 'review_severity', risk: 'high' });
    const params = scope.asked[0]!.summaryRef?.params as Record<string, { key?: string }>;
    expect(params.from?.key).toBe('rcReview.severityCritical');
    expect(params.to?.key).toBe('rcReview.severitySuggestion');
    expect(scope.asked[0]!.summary).toContain(RcReview.severitySuggestion().text);

    await tools.dispatch('review_severity', { video: 'Draft', id: 'blank', severity: 'critical' }, agent);
    expect(scope.asked[1]).toMatchObject({ tool: 'review_severity', risk: 'edit' });
  });
});

describe('the decisions document through the generic video tools', () => {
  let dir: string;
  let videos: FakeVideos & { undoState?: () => Promise<UndoState>; history?: () => Promise<{ entries: HistoryEntry[] }>; undo?: () => Promise<never> };
  let scope: FakeScope;
  let tools: VideoTools;
  let planId: string;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-plan-guard-')));
    videos = new FakeVideos(dir);
    scope = new FakeScope(videos);
    tools = new VideoTools({ videos: videos as never, scope: scope as unknown as ToolScope } as never);
    const store = new ReviewCriteriaStore(path.join(dir, 'store', 'review-criteria.json'));
    await store.load();
    const review = new ReviewService({ videos: videos as never, jobs: { list: () => [] }, store, settings: () => ({ gate: true }), log: silentLogger });
    await review.waive(FAKE_VIDEO_ID, 'placeholders', 'Held for the client.', { connectionId: 'ui', kind: 'desktop', name: 'ui' });
    await review.flush();
    planId = Object.values(videos.snapshot.documents).find((d) => d.kind === REVIEW_PLAN_KIND)!.id;
    videos.applied.length = 0;
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const forged = { schema: 'cuccut.review-plan/1', severities: { placeholders: 'nitpick' }, reasons: { placeholders: 'x' }, waivers: [{ id: 'blank', reason: 'x', by: 'user', at: '2026-01-01T00:00:00Z' }] };

  it('refuses documents_put of a review-plan body, as a new document or over the existing one', async () => {
    const created = await toolError(tools.dispatch('documents_put', { video: 'Draft', kind: REVIEW_PLAN_KIND, body: forged }, agent));
    expect(created.code).toBe('REVIEW_PLAN_PROTECTED');
    expect(scope.asked).toHaveLength(0);
    const replaced = await toolError(tools.dispatch('documents_put', { video: 'Draft', document: planId, body: forged }, agent));
    expect(replaced.code).toBe('REVIEW_PLAN_PROTECTED');
    expect(videos.applied).toHaveLength(0);
  });

  it('refuses edits_apply with a putDocument of the decisions document', async () => {
    const expectedRevision = videos.snapshot.revision;
    const byKind = await toolError(
      tools.dispatch('edits_apply', { video: 'Draft', expectedRevision, label: 'x', operations: [{ type: 'putDocument', kind: REVIEW_PLAN_KIND, body: forged }] }, agent),
    );
    expect(byKind.code).toBe('REVIEW_PLAN_PROTECTED');
    expect(scope.asked).toHaveLength(0);
    const byId = await toolError(
      tools.dispatch('edits_apply', { video: 'Draft', expectedRevision, label: 'x', operations: [{ type: 'putDocument', documentId: planId, kind: 'speech', body: forged }] }, agent),
    );
    expect(byId.code).toBe('REVIEW_PLAN_PROTECTED');
    expect(videos.applied).toHaveLength(0);
  });

  it('asks at high risk to undo a decision when that would bring a waiver back', async () => {
    const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
      transactionId: 'tx',
      commandId: 'cmd',
      label: 'x',
      actor: { kind: 'user', id: 'user_local' },
      videoRevision: 'r',
      committedAt: '2026-01-01T00:00:00Z',
      undoDepth: 0,
      undoAvailable: true,
      ...over,
    });
    const entries = [
      entry({ transactionId: 'tx_unwaive', labelRef: { key: 'rcReview.unwaiveLabel', params: { id: 'placeholders' } } }),
      entry({ transactionId: 'tx_waive', labelRef: { key: 'rcReview.waiveLabel', params: { id: 'placeholders' } } }),
      entry({ transactionId: 'tx_waive_undone', undoOf: 'tx_waive', undoDepth: 1 }),
      entry({ transactionId: 'tx_trim', label: 'Trim' }),
    ];
    videos.history = async () => ({ entries });
    videos.undoState = async () => ({ undo: { transactionId: 'tx_unwaive', label: 'x', labelRef: { key: 'rcReview.unwaiveLabel' } } });
    videos.undo = async () => {
      throw new Error('stop after asking');
    };
    const undo = (transactionId?: string) =>
      tools.dispatch('edits_undo', { video: 'Draft', ...(transactionId ? { transactionId } : {}) }, agent).catch(() => undefined);

    await undo('tx_unwaive');
    await undo('tx_waive_undone');
    await undo();
    await undo('tx_waive');
    await undo('tx_trim');
    expect(scope.asked.map((a) => a.risk)).toEqual(['high', 'high', 'high', undefined, undefined]);
  });
});

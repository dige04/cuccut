import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { REVIEW_PLAN_KIND, newId, type AgentMode, type EditOperation, type Id, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, tool, until, type Loose, type ToolSession } from './testing/fake-agent.ts';

/**
 * The review tools end to end (docs/cuccut/m2-review-gate.md §5): a fake agent calls them through the real MCP endpoint.
 * Checking is allowed in plan mode; letting a finding stand or lowering it asks the user in every mode but full access and
 * never offers "Always allow"; the export tool hands the agent `REVIEW_BLOCKED` with a next step; an answer whose evidence
 * does not check out is recorded as cannot-tell. Needs engine-host; skipped if missing.
 */

const engine = resolveEngineHostCommand();
if (!engine) console.warn('Skipping the review tool tests: engine-host is not built (npm run build:engine)');

describe.skipIf(!engine)('review tools (real engine)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let driver: ToolDriver;
  let project: Project;
  let conversationId: Id;
  let videoId: Id;
  let videoPath: string;

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-tools-')));
    driver = new ToolDriver();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'desktop', name: 'test', version: '0' }, reconnect: false });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: 'Review tools' }));
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
    const opened = await client.request('videos.create', { projectId: project.id, name: 'Draft' });
    videoId = opened.ref.videoId;
    videoPath = opened.ref.relPath;
    const sequenceId = opened.snapshot.video.rootSequenceId;
    const operations: EditOperation[] = [
      { type: 'addTrack', sequenceId, kind: 'visual', ref: 'v' },
      {
        type: 'insertItems',
        sequenceId,
        items: [{ type: 'placeholder', trackRef: 'v', span: { fromFrame: 0, durationFrames: 60 }, place: {}, placeholder: { variant: 'media' } }] as never,
      },
    ];
    await client.request('edits.apply', { videoId, commandId: newId('cmd'), expectedRevision: opened.snapshot.video.revision, operations });
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function send(mode?: AgentMode): Promise<ToolSession> {
    await client.request('conversations.send', { conversationId, text: 'Check it', commandId: newId('cmd'), ...(mode ? { autonomy: mode } : {}) });
    const session = await until(() => driver.sessions.find((s) => s.turnId));
    await until(() => runtime.harness.agentRun(conversationId).taskId);
    return session;
  }

  async function finish(session: ToolSession) {
    session.finish();
    await until(() => runtime.harness.agentRun(conversationId).taskId === null);
  }

  const planDocuments = () => Object.values(runtime.videos.mirror(videoId)!.video.documents).filter((d) => d.kind === REVIEW_PLAN_KIND);

  it('reads the standard and checks the video in plan mode, and refuses to let a finding stand there', async () => {
    const session = await send('plan');
    const criteria = await tool(session, 'review_criteria', { video: videoPath, catalogue: true });
    expect(criteria.isError).toBe(false);
    expect(criteria.body).toMatchObject({ source: 'builtin', videoId, plan: { waivers: [] } });
    expect(criteria.body.checks.find((c: Loose) => c.id === 'placeholders')).toMatchObject({ severity: 'critical', builtin: true });
    expect(criteria.body.catalogue).toHaveLength(19);

    const run = await tool(session, 'review_run', { video: videoPath });
    expect(run.isError).toBe(false);
    expect(run.body).toMatchObject({ videoId, verdict: 'failed', open: [{ id: 'placeholders', metric: 'items.placeholders', value: 1, limit: { max: 0 } }] });
    expect(run.body.next).toContain('review_waive');
    await expect(fs.stat(path.join(project.path, '.cuccut-out', 'reviews', `${videoId}.json`))).resolves.toBeTruthy();

    const waive = await tool(session, 'review_waive', { video: videoPath, id: 'placeholders', reason: 'The client fills it' });
    expect(waive.body.error.code).toBe('PLAN_ONLY');
    expect(planDocuments()).toHaveLength(0);
  });

  it('hands the export refusal to the agent, and letting a finding stand asks the user even in auto mode, with no "Always allow"', async () => {
    const session = await send('auto');
    const refused = await tool(session, 'export', { video: videoPath, kind: 'video', format: 'mp4' });
    expect(refused.isError).toBe(true);
    expect(refused.body.error).toMatchObject({
      code: 'REVIEW_BLOCKED',
      findings: [{ id: 'placeholders', metric: 'items.placeholders', value: 1, limit: { max: 0 } }],
      next: expect.stringContaining('review_waive'),
    });
    expect(await client.request('exports.list', { videoId })).toEqual({ jobs: [] });

    const missing = await tool(session, 'review_waive', { video: videoPath, id: 'placeholders', reason: ' ' });
    expect(missing.body.error).toMatchObject({ code: 'REVIEW_REASON_REQUIRED', next: expect.any(String) });
    const unknown = await tool(session, 'review_waive', { video: videoPath, id: 'ghost', reason: 'why' });
    expect(unknown.body.error.code).toBe('REVIEW_UNKNOWN_FINDING');
    expect(runtime.harness.approvals.pending()).toHaveLength(0);

    const waiving = tool(session, 'review_waive', { video: videoPath, id: 'placeholders', reason: 'The client fills it' });
    const pending = await until(() => runtime.harness.approvals.pending()[0]);
    expect(pending).toMatchObject({ action: { name: 'review_waive' }, risk: 'high', basis: { kind: 'mode', mode: 'auto' } });
    const { items } = await client.request('conversations.get', { conversationId });
    const card = items.find((item) => item.kind === 'approval' && item.approvalId === pending.approvalId) as Loose;
    expect(card.request.rule ?? null).toBeNull();
    await client.request('approvals.respond', { approvalId: pending.approvalId, decision: 'allow' });
    const waived = await waiving;
    expect(waived.isError).toBe(false);
    expect(waived.body).toMatchObject({
      videoId,
      id: 'placeholders',
      plan: { waivers: [{ id: 'placeholders', reason: 'The client fills it', by: 'agent' }] },
      verdict: 'passed',
      approval: { risk: 'high', decidedBy: 'user' },
    });
    expect(planDocuments()).toHaveLength(1);

    // The waiver is an edit the session can take back like any other.
    const undo = await tool(session, 'edits_undo', { video: videoPath });
    expect(undo.isError).toBe(false);
    await until(() => planDocuments().length === 0);
  });

  it('raises a severity as an ordinary edit, and lowering one asks the user', async () => {
    const session = await send('auto');
    const raised = await tool(session, 'review_severity', { video: videoPath, id: 'blank', severity: 'critical' });
    expect(raised.isError).toBe(false);
    expect(raised.body).toMatchObject({ plan: { severities: { blank: 'critical' } }, approval: { risk: 'edit', decidedBy: 'auto' } });

    const noReason = await tool(session, 'review_severity', { video: videoPath, id: 'placeholders', severity: 'nitpick' });
    expect(noReason.body.error.code).toBe('REVIEW_REASON_REQUIRED');

    const lowering = tool(session, 'review_severity', { video: videoPath, id: 'placeholders', severity: 'suggestion', reason: 'A rough cut' });
    const pending = await until(() => runtime.harness.approvals.pending()[0]);
    expect(pending).toMatchObject({ action: { name: 'review_severity' }, risk: 'high' });
    await client.request('approvals.respond', { approvalId: pending.approvalId, decision: 'deny' });
    expect((await lowering).body.error).toMatchObject({ code: 'APPROVAL_DENIED', risk: 'high' });
    expect((await client.request('review.check', { videoId })).blocks).not.toBeNull();
  });

  it('lets a finding stand without asking in full access', async () => {
    const session = await send('fullAccess');
    const waived = await tool(session, 'review_waive', { video: videoPath, id: 'placeholders', reason: 'The client fills it' });
    expect(waived.isError).toBe(false);
    expect(waived.body.approval).toMatchObject({ risk: 'high', decidedBy: 'auto' });
    const back = await tool(session, 'review_unwaive', { video: videoPath, id: 'placeholders' });
    expect(back.body).toMatchObject({ plan: { waivers: [] }, verdict: 'failed' });
    await finish(session);
  });

  it('records answers, and an answer whose evidence does not check out is cannot-tell', async () => {
    await runtime.review.setCriteria({
      checks: [],
      rubric: [
        { id: 'opens', ask: 'Does it open on the point?', evidence: 'timestamp', severity: 'suggestion', fix: 'Start later.' },
        { id: 'said', ask: 'Is the offer said?', evidence: 'quote', severity: 'suggestion', fix: 'Say it.' },
      ],
    });
    const session = await send('plan');
    const run = await tool(session, 'review_run', { video: videoPath });
    expect(run.body.next).toContain('review_answer');
    const answered = await tool(session, 'review_answer', {
      video: videoPath,
      answers: [
        { id: 'opens', verdict: 'holds', evidence: '00:01' },
        { id: 'said', verdict: 'holds', evidence: 'nobody said this' },
      ],
    });
    expect(answered.isError).toBe(false);
    expect(answered.body.rubric.map((r: Loose) => [r.id, r.verdict])).toEqual([
      ['opens', 'holds'],
      ['said', 'cannot-tell'],
    ]);
    expect(answered.body.rubric[1].note).toEqual(expect.any(String));
    expect(answered.body.next).toContain('cannot-tell');

    const bad = await tool(session, 'review_answer', { video: videoPath, answers: [{ id: 'ghost', verdict: 'holds', evidence: '1s' }] });
    expect(bad.body.error.code).toBe('REVIEW_UNKNOWN_FINDING');
  });

  it('replaces the standard only when the user is asked every time, and refuses a broken one by code', async () => {
    const session = await send('auto');
    const broken = tool(session, 'review_criteria_set', {
      standard: { checks: [{ id: 'a', metric: 'video.durationSec', max: 60 }, { id: 'a', metric: 'video.shots', max: 9 }], rubric: [] },
    });
    const first = await until(() => runtime.harness.approvals.pending()[0]);
    expect(first).toMatchObject({ action: { name: 'review_criteria_set' }, risk: 'high' });
    await client.request('approvals.respond', { approvalId: first.approvalId, decision: 'allow' });
    expect((await broken).body.error).toMatchObject({ code: 'REVIEW_CRITERIA_INVALID', issues: [{ code: 'duplicate-id' }], next: expect.any(String) });

    const saving = tool(session, 'review_criteria_set', {
      standard: { checks: [{ id: 'short', metric: 'video.durationSec', max: 60, severity: 'critical', fix: 'Cut it.' }], rubric: [] },
    });
    const second = await until(() => runtime.harness.approvals.pending()[0]);
    await client.request('approvals.respond', { approvalId: second.approvalId, decision: 'allow' });
    expect((await saving).body).toMatchObject({ revision: 1, checks: 1, questions: 0 });
    expect((await client.request('review.criteria.get', {})).source).toBe('user');
  });
});

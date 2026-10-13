import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentMode } from '@cuccut/protocol';
import { silentLogger, type AgentEvent, type AgentSession, type CreateSessionOptions } from '@cuccut/harness';
import { createFakeOpenCode, type FakeOpenCode, type FakeOpenCodeScenario } from '../testing/fake-opencode.ts';
import { OpenCodeDriver } from './opencode-driver.ts';

/**
 * OpenCode session against a fake serve: one turn's messages and reasoning, tool steps (file changes with diffs), approvals (allow, deny, allow for this session),
 * access mode and model, interrupt, unexpected process exit, resume, MCP and developer instructions. The fake serve reads its scenario at startup, so after changing the scenario, start a new session.
 */

async function until<T>(read: () => T | undefined | null | false, timeoutMs = 8_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

type Completed = Extract<AgentEvent, { type: 'turn.completed' }>;
type Approval = Extract<AgentEvent, { type: 'approval.requested' }>;
type ItemEvent = Extract<AgentEvent, { type: 'item.completed' }>;

const PATCH = 'Index: notes.txt\n===\n--- notes.txt\n+++ notes.txt\n@@ -1,1 +1,1 @@\n-beta\n+BETA\n';
const EDIT_TOOL = {
  name: 'edit',
  input: { path: '', oldString: 'beta', newString: 'BETA' },
  permission: { action: 'edit', resources: ['notes.txt'], metadata: { files: [{ file: 'notes.txt', patch: PATCH, status: 'modified' }] } },
  output: 'Edited notes.txt (1 replacement)',
  metadata: { files: [{ file: 'notes.txt', patch: PATCH, status: 'modified' }] },
};

describe('OpenCodeSession (fake opencode serve)', () => {
  let dir: string;
  let cwd: string;
  let fake: FakeOpenCode;
  let driver: OpenCodeDriver;
  const open: AgentSession[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-opencode-session-'));
    cwd = path.join(dir, 'project');
    await fs.mkdir(cwd);
    fake = await createFakeOpenCode(path.join(dir, 'fake'));
    driver = new OpenCodeDriver(silentLogger, { locate: fake.locate, timeoutMs: 10_000 });
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function start(scenario: Partial<FakeOpenCodeScenario> = {}, extra: Partial<CreateSessionOptions> = {}) {
    fake.scenario(scenario);
    const session = await driver.createSession({ cwd, accessMode: 'ask', model: null, effort: null, resume: null, ...extra });
    open.push(session);
    const events: AgentEvent[] = [];
    session.subscribe((event) => events.push(event));
    const completed = (turnId: string) =>
      until(() => events.find((e): e is Completed => e.type === 'turn.completed' && e.turnId === turnId));
    const approval = (n = 1) => until(() => events.filter((e): e is Approval => e.type === 'approval.requested')[n - 1]);
    return { session, events, completed, approval };
  }

  const settings = (accessMode: AgentMode = 'ask', model: string | null = null, effort: string | null = null) => ({
    accessMode,
    model,
    effort,
  });

  it('a turn: reasoning and reply arrive as deltas; the turn completes after execution succeeds', async () => {
    const { session, events, completed } = await start({ turn: { reasoning: 'thinking', reply: 'hello there', end: 'succeeded' } });
    const { turnId } = await session.startTurn({ text: 'hi' }, settings());
    const done = await completed(turnId);
    expect(done.outcome).toBe('completed');
    const deltas = events.filter((e) => e.type === 'item.delta' && e.channel === 'text').map((e) => (e as { delta: string }).delta);
    expect(deltas.join('')).toBe('hello there');
    const items = events.filter((e): e is ItemEvent => e.type === 'item.completed').map((e) => e.item);
    expect(items).toEqual([
      expect.objectContaining({ kind: 'reasoning', text: 'thinking' }),
      expect.objectContaining({ kind: 'agent-message', text: 'hello there' }),
    ]);
    // The session is created on the working directory, uses the build agent, and access mode is written as permission rules.
    const create = fake.requests('POST', '/api/session')[0]!.body!;
    expect(create.location).toEqual({ directory: cwd });
    expect(create.agent).toBe('build');
    expect(create.permissions).toContainEqual({ action: 'shell', resource: '*', effect: 'ask' });
    expect(fake.requests('POST', '/api/session/:id/prompt')[0]!.body).toEqual({ text: 'hi' });
    expect(session.describePersistence()).toEqual({ driverId: 'opencode', data: { sessionId: expect.stringMatching(/^ses_/) } });
  });

  it('execution failure: turn failed, with the OpenCode error', async () => {
    const { session, completed } = await start({ turn: { end: 'failed', error: 'rate limited' } });
    const { turnId } = await session.startTurn({ text: 'hi' }, settings());
    const done = await completed(turnId);
    expect(done.outcome).toBe('failed');
    expect(done.error).toBe('rate limited');
  });

  it('file change needs approval: completes after allowing; the step output is the unified diff', async () => {
    const { session, events, completed, approval } = await start({
      turn: { tool: { ...EDIT_TOOL, input: { ...EDIT_TOOL.input, path: path.join(cwd, 'notes.txt') } }, reply: 'ok' },
    });
    const { turnId } = await session.startTurn({ text: 'edit' }, settings());
    const asked = await approval();
    expect(asked.request).toEqual({ kind: 'file-change', reason: null, files: ['notes.txt'], rule: null });
    expect(asked.escalation).toBeUndefined();
    await session.respondToApproval(asked.approvalId, { decision: 'accept' });
    expect((await completed(turnId)).outcome).toBe('completed');
    const replies = fake.log().filter((e) => e.kind === 'request' && e.path?.endsWith('/reply'));
    expect(replies.map((e) => e.body)).toEqual([{ decision: 'once' }]);
    const tool = events.filter((e): e is ItemEvent => e.type === 'item.completed').find((e) => e.item.kind === 'tool-call')!.item;
    expect(tool).toMatchObject({ kind: 'tool-call', tool: 'file-change', title: 'notes.txt', status: 'completed', output: PATCH });
  });

  it('rejection: that step is declined, OpenCode ends execution with interrupted(shutdown), the turn is recorded as completed and a notice is shown', async () => {
    const { session, events, completed, approval } = await start({
      turn: { tool: { name: 'shell', input: { command: 'rm -rf build' }, permission: { action: 'shell', resources: ['rm -rf build'] } } },
    });
    const { turnId } = await session.startTurn({ text: 'clean' }, settings());
    const asked = await approval();
    expect(asked.request).toMatchObject({ kind: 'command', command: 'rm -rf build', cwd, rule: 'rm' });
    await session.respondToApproval(asked.approvalId, { decision: 'decline' });
    const done = await completed(turnId);
    expect(done.outcome).toBe('completed');
    const tool = events.filter((e): e is ItemEvent => e.type === 'item.completed').find((e) => e.item.kind === 'tool-call')!.item;
    expect(tool).toMatchObject({ status: 'declined', title: 'rm -rf build' });
    expect(events.some((e) => e.type === 'session.warning' && e.message.includes('工具被拒绝'))).toBe(true);
    const replies = fake.log().filter((e) => e.kind === 'request' && e.path?.endsWith('/reply'));
    expect(replies.map((e) => e.body)).toEqual([{ decision: 'reject' }]);
  });

  it('allow for this session: later requests of the same kind are approved directly, never replying with the native always', async () => {
    const shell = { name: 'shell', input: { command: 'npm test' }, permission: { action: 'shell', resources: ['npm test'] } };
    const { session, events, completed, approval } = await start({ turn: { tool: shell, reply: 'ok' } });
    const first = await session.startTurn({ text: 'test' }, settings());
    await session.respondToApproval((await approval()).approvalId, { decision: 'accept-for-session' });
    await completed(first.turnId);
    const second = await session.startTurn({ text: 'again' }, settings());
    expect((await completed(second.turnId)).outcome).toBe('completed');
    expect(events.filter((e) => e.type === 'approval.requested')).toHaveLength(1);
    const replies = fake.log().filter((e) => e.kind === 'request' && e.path?.endsWith('/reply'));
    expect(replies.map((e) => e.body)).toEqual([{ decision: 'once' }, { decision: 'once' }]);
  });

  it('interrupt: pending approvals are dismissed and rejected, the turn is interrupted', async () => {
    const { session, events, completed, approval } = await start({
      turn: { tool: { name: 'shell', input: { command: 'sleep 100' }, permission: { action: 'shell', resources: ['sleep 100'] } } },
    });
    const { turnId } = await session.startTurn({ text: 'wait' }, settings());
    const asked = await approval();
    expect(await session.interrupt(turnId)).toEqual({ status: 'requested' });
    expect((await completed(turnId)).outcome).toBe('interrupted');
    expect(events).toContainEqual({ type: 'approval.resolved', approvalId: asked.approvalId });
    expect(await session.interrupt(turnId)).toEqual({ status: 'not-running' });
  });

  it('interrupts a turn that keeps running', async () => {
    const { session, completed } = await start({ turn: { reply: 'partial', end: 'hang' } });
    const { turnId } = await session.startTurn({ text: 'go' }, settings());
    await until(() => fake.requests('POST', '/api/session/:id/prompt').length > 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await session.interrupt(turnId)).toEqual({ status: 'requested' });
    expect((await completed(turnId)).outcome).toBe('interrupted');
    expect(fake.requests('POST', '/api/session/:id/interrupt')).toHaveLength(1);
  });

  it('serve exits unexpectedly: session.exited with the reason, no longer reports turn results', async () => {
    const { session, events } = await start({ turn: { crash: true } });
    await session.startTurn({ text: 'boom' }, settings());
    const exited = await until(() => events.find((e) => e.type === 'session.exited'));
    expect(exited).toMatchObject({ type: 'session.exited', error: expect.stringContaining('3') });
    expect(events.some((e) => e.type === 'turn.completed')).toBe(false);
  });

  it('access mode changed: session permission rules are changed before the next turn; model and effort use provider/model and variant', async () => {
    const { session, completed } = await start();
    const first = await session.startTurn({ text: 'a' }, settings('ask'));
    await completed(first.turnId);
    expect(fake.requests('PATCH', '/api/session/:id')).toHaveLength(0);
    const second = await session.startTurn({ text: 'b' }, settings('plan', 'opencode/fledge-alpha-free', 'high'));
    await completed(second.turnId);
    const patch = fake.requests('PATCH', '/api/session/:id');
    expect(patch).toHaveLength(1);
    expect(patch[0]!.body!.permissions).toContainEqual({ action: 'edit', resource: '*', effect: 'deny' });
    expect(fake.requests('POST', '/api/session/:id/model')[0]!.body).toEqual({
      model: { providerID: 'opencode', id: 'fledge-alpha-free', variant: 'high' },
    });
  });

  it('wrong model format: the turn cannot be started', async () => {
    const { session } = await start();
    await expect(session.startTurn({ text: 'a' }, settings('ask', 'no-slash'))).rejects.toMatchObject({
      agentCode: 'AGENT_MODEL_UNAVAILABLE',
    });
  });

  it('interjection: an in-progress turn uses delivery steer', async () => {
    const { session, completed } = await start({ turn: { end: 'hang' } });
    const { turnId } = await session.startTurn({ text: 'go' }, settings());
    expect(await session.steer!(turnId, { text: 'also this' })).toBe('accepted');
    expect(fake.requests('POST', '/api/session/:id/prompt')[1]!.body).toEqual({ text: 'also this', delivery: 'steer' });
    expect(await session.steer!('turn_other', { text: 'x' })).toBe('unavailable');
    await session.interrupt(turnId);
    await completed(turnId);
  });

  it('resume: reattaches the native session by id (also works with a different serve process), creates a new one with a notice if resume fails', async () => {
    const first = await start();
    const handle = first.session.describePersistence();
    await first.session.close();
    const resumed = await start({}, { resume: handle });
    expect(resumed.session.describePersistence()).toEqual(handle);
    expect(fake.requests('POST', '/api/session')).toHaveLength(1);

    const fresh = await start({}, { resume: { driverId: 'opencode' as never, data: { sessionId: 'ses_gone' } } });
    expect(fresh.session.describePersistence()).not.toEqual(handle);
    await until(() => fresh.events.find((e) => e.type === 'session.warning' && e.message.includes('无法恢复')));
  });

  it('MCP servers are registered with serve (execution timeout 24 hours), a notice is shown when they cannot connect', async () => {
    const mcpServers = { cuccut: { url: 'http://127.0.0.1:1/mcp', headers: { authorization: 'Bearer t' } } };
    await start({}, { mcpServers });
    const put = fake.requests('PUT', '/api/experimental/mcp/cuccut')[0]!;
    expect(put.location).toBe(cwd);
    expect(put.body).toEqual({
      config: {
        type: 'remote',
        url: 'http://127.0.0.1:1/mcp',
        headers: { authorization: 'Bearer t' },
        oauth: false,
        timeout: { execution: 86_400_000 },
      },
    });
    const failing = await start({ mcp: 'failed' }, { mcpServers });
    await until(() => failing.events.find((e) => e.type === 'session.warning' && e.message.includes('MCP')));
  });

  it('developer instructions are written into the session\'s instructions entry; when the API is missing they are prepended to the first turn', async () => {
    await start({}, { developerInstructions: 'Be brief.' });
    expect(fake.log().find((e) => e.path?.endsWith('/instructions/entries/cuccut'))?.body).toEqual({ value: 'Be brief.' });

    const fallback = await start({ instructions: 'missing' }, { developerInstructions: 'Be brief.' });
    const { turnId } = await fallback.session.startTurn({ text: 'hi' }, settings());
    await fallback.completed(turnId);
    const prompts = fake.requests('POST', '/api/session/:id/prompt');
    expect(prompts.at(-1)!.body!.text).toBe('<system-instructions>\nBe brief.\n</system-instructions>\n\nhi');
  });

  it('restricted one-off calls are not supported', async () => {
    await expect(start({}, { confinement: 'cwd-write-only' })).rejects.toThrow('不支持受限的一次性调用');
  });

  it('closing the session ends serve', async () => {
    const { session } = await start();
    await session.close();
    await until(() => fake.log().some((e) => e.kind === 'exit'));
  });
});

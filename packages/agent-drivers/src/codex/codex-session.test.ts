import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentMode } from '@cuccut/protocol';
import { silentLogger, type AgentEvent, type AgentSession } from '@cuccut/harness';
import { createFakeCodex, type FakeCodex, type FakeCodexScenario } from '../testing/fake-codex.ts';
import { CodexDriver } from './codex-driver.ts';

/**
 * Codex session tests against a fake codex: the approval policy and reviewer actually sent for each access mode, image input, steering (turn/steer), and error codes.
 * The fake codex reads its scenario at process start, so a new session must be opened after the scenario changes.
 */

async function until<T>(read: () => T | undefined | null | false, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('CodexSession (fake codex)', () => {
  let dir: string;
  let cwd: string;
  let fake: FakeCodex;
  let driver: CodexDriver;
  const open: AgentSession[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-codex-session-'));
    cwd = path.join(dir, 'project');
    await fs.mkdir(cwd);
    fake = await createFakeCodex(path.join(dir, 'fake'));
    driver = new CodexDriver(silentLogger, { locate: fake.locate });
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function start(scenario: Partial<FakeCodexScenario> = {}, accessMode: AgentMode = 'ask') {
    fake.scenario(scenario);
    const session = await driver.createSession({ cwd, accessMode, model: null, effort: null, resume: null });
    open.push(session);
    const events: AgentEvent[] = [];
    session.subscribe((event) => events.push(event));
    const completed = (turnId: string) =>
      until(() => events.find((e): e is Extract<AgentEvent, { type: 'turn.completed' }> => e.type === 'turn.completed' && e.turnId === turnId));
    return { session, events, completed };
  }

  const lastParams = (method: string) => fake.requests(method).at(-1)!.params;

  it('access mode → approvalPolicy, approver (always user) and sandbox for thread/start and turn/start', async () => {
    const expected: Array<[AgentMode, string, string]> = [
      ['plan', 'untrusted', 'read-only'],
      ['ask', 'untrusted', 'workspace-write'],
      ['autoAcceptEdits', 'untrusted', 'workspace-write'],
      ['auto', 'on-request', 'workspace-write'],
      ['fullAccess', 'never', 'workspace-write'],
    ];
    for (const [mode, approvalPolicy, sandbox] of expected) {
      const { session, completed } = await start({}, mode);
      expect(lastParams('thread/start'), mode).toEqual({
        cwd,
        approvalPolicy,
        approvalsReviewer: 'user',
        sandbox,
        developerInstructions: null,
      });
      const { turnId } = await session.startTurn({ text: 'hi' }, { accessMode: mode, model: 'fake-sol', effort: 'high' });
      // Same as the sandbox and thread: this turn does not carry a separate sandboxPolicy.
      expect(lastParams('turn/start'), mode).toEqual({
        threadId: 'thr_fake',
        input: [{ type: 'text', text: 'hi', text_elements: [] }],
        approvalPolicy,
        approvalsReviewer: 'user',
        model: 'fake-sol',
        effort: 'high',
      });
      await completed(turnId);
    }
  });

  it('switching access mode within the same session applies the new one on the next turn; sandboxPolicy is sent only when entering or leaving \'plan first\' mode', async () => {
    const { session, completed } = await start({}, 'auto');
    for (const [text, accessMode] of [
      ['a', 'auto'],
      ['b', 'plan'],
      ['c', 'plan'],
      ['d', 'ask'],
    ] as const) {
      await completed((await session.startTurn({ text }, { accessMode, model: null, effort: null })).turnId);
    }
    const turns = fake.requests('turn/start').map((r) => [r.params.approvalPolicy, r.params.sandboxPolicy]);
    expect(turns).toEqual([
      ['on-request', undefined],
      ['untrusted', { type: 'readOnly', networkAccess: false }],
      ['untrusted', undefined],
      [
        'untrusted',
        { type: 'workspaceWrite', writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false },
      ],
    ]);
  });

  it('images are given as localImage paths, text first; no empty text is sent when there are only images', async () => {
    const { session, completed } = await start();
    expect(session.capabilities).toMatchObject({ images: true, steer: true });
    const images = [
      { path: '/work/a.png', mimeType: 'image/png' },
      { path: '/work/b.jpg', mimeType: 'image/jpeg' },
    ];
    await completed((await session.startTurn({ text: '看看这两张', images }, { accessMode: 'ask', model: null, effort: null })).turnId);
    expect(lastParams('turn/start').input).toEqual([
      { type: 'text', text: '看看这两张', text_elements: [] },
      { type: 'localImage', path: '/work/a.png' },
      { type: 'localImage', path: '/work/b.jpg' },
    ]);
    await completed((await session.startTurn({ text: '', images: [images[0]!] }, { accessMode: 'ask', model: null, effort: null })).turnId);
    expect(lastParams('turn/start').input).toEqual([{ type: 'localImage', path: '/work/a.png' }]);
  });

  it('interjection: a running turn is accepted (with expectedTurnId); other turns and already-finished turns are unavailable, no request is sent', async () => {
    const { session, events, completed } = await start({ turn: { status: 'hang' } });
    const { turnId } = await session.startTurn({ text: '开始' }, { accessMode: 'ask', model: null, effort: null });
    await until(() => events.some((e) => e.type === 'turn.started' && e.turnId === turnId));
    const image = { path: '/work/c.png', mimeType: 'image/png' };
    expect(await session.steer!(turnId, { text: '顺便看这张', images: [image] })).toBe('accepted');
    expect(fake.requests('turn/steer').map((r) => r.params)).toEqual([
      {
        threadId: 'thr_fake',
        input: [
          { type: 'text', text: '顺便看这张', text_elements: [] },
          { type: 'localImage', path: '/work/c.png' },
        ],
        expectedTurnId: turnId,
      },
    ]);
    expect(await session.steer!('turn_other', { text: 'x' })).toBe('unavailable');
    await session.interrupt(turnId);
    expect(await completed(turnId)).toMatchObject({ outcome: 'interrupted' });
    expect(await session.steer!(turnId, { text: '晚了' })).toBe('unavailable');
    expect(fake.requests('turn/steer')).toHaveLength(1);
  });

  it('interjection: an explicit rejection by Codex (no active turn, method not supported) is unavailable; an ambiguous delivery failure throws', async () => {
    for (const steer of ['no-active-turn', 'unsupported'] as const) {
      const { session, events } = await start({ turn: { status: 'hang' }, steer });
      const { turnId } = await session.startTurn({ text: '开始' }, { accessMode: 'ask', model: null, effort: null });
      await until(() => events.some((e) => e.type === 'turn.started'));
      expect(await session.steer!(turnId, { text: 'x' }), steer).toBe('unavailable');
    }
    const { session, events } = await start({ turn: { status: 'hang' }, steer: 'error' });
    const { turnId } = await session.startTurn({ text: '开始' }, { accessMode: 'ask', model: null, effort: null });
    await until(() => events.some((e) => e.type === 'turn.started'));
    await expect(session.steer!(turnId, { text: 'x' })).rejects.toThrow(/internal error/);
    expect(fake.requests('turn/steer')).toHaveLength(3);
  });

  it('errors: retryable ones emit session.error without ending the turn; non-retryable ones are reported once, with turn.completed, with an error code', async () => {
    const { session, events, completed } = await start({
      turn: {
        status: 'failed',
        errors: [
          { message: 'Reconnecting... 1/5', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: null } }, willRetry: true },
          { message: "You've hit your usage limit.", codexErrorInfo: 'usageLimitExceeded', willRetry: false },
        ],
        error: "You've hit your usage limit.",
        errorInfo: 'usageLimitExceeded',
      },
    });
    const { turnId } = await session.startTurn({ text: 'hi' }, { accessMode: 'ask', model: null, effort: null });
    expect(await completed(turnId)).toMatchObject({ outcome: 'failed', error: "You've hit your usage limit.", errorCode: 'AGENT_RATE_LIMITED' });
    expect(events.filter((e) => e.type === 'session.error')).toEqual([
      { type: 'session.error', turnId, message: 'Reconnecting... 1/5', willRetry: true, code: null },
    ]);
  });

  it('error codes: a 429 during retry carries the code and the turn still completes; turn failures are classified by structured reason and raw text', async () => {
    const retrying = await start({
      turn: {
        status: 'completed',
        errors: [{ message: 'exceeded retry limit', codexErrorInfo: { responseTooManyFailedAttempts: { httpStatusCode: 429 } }, willRetry: true }],
      },
    });
    const first = await retrying.session.startTurn({ text: 'hi' }, { accessMode: 'ask', model: null, effort: null });
    expect(await retrying.completed(first.turnId)).toMatchObject({ outcome: 'completed', errorCode: null });
    expect(retrying.events.find((e) => e.type === 'session.error')).toMatchObject({ willRetry: true, code: 'AGENT_RATE_LIMITED' });

    const cases: Array<[FakeCodexScenario['turn'], string | null]> = [
      [{ status: 'failed', error: 'unexpected status 401 Unauthorized: token revoked', errorInfo: 'other' }, 'AGENT_AUTH_REQUIRED'],
      [{ status: 'failed', error: 'Your access token could not be refreshed.', errorInfo: 'unauthorized' }, 'AGENT_AUTH_REQUIRED'],
      [{ status: 'failed', error: 'unexpected status 404 Not Found: Model not found gpt-x', errorInfo: 'other' }, 'AGENT_MODEL_UNAVAILABLE'],
      [{ status: 'failed', error: "The 'gpt-9' model requires a newer version of Codex." }, 'AGENT_MODEL_UNAVAILABLE'],
      [{ status: 'failed', error: 'Codex ran out of room in the model context window.', errorInfo: 'contextWindowExceeded' }, null],
    ];
    for (const [turn, code] of cases) {
      const { session, completed } = await start({ turn });
      const { turnId } = await session.startTurn({ text: 'hi' }, { accessMode: 'ask', model: null, effort: null });
      expect(await completed(turnId), turn.error).toMatchObject({ outcome: 'failed', error: turn.error, errorCode: code });
    }
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger, type AgentEvent } from '@cuccut/harness';
import { createFakeCodex, fakeModel, type FakeCodex } from '../testing/fake-codex.ts';
import { describeCodexAccount } from './codex-binary.ts';
import { CodexDriver } from './codex-driver.ts';
import { CODEX_TOOL_TIMEOUT_SEC, codexPolicy } from './codex-session.ts';

/**
 * The Codex Driver runs against a fake codex (`testing/fake-codex.ts`): the several probe states, the model catalog and the model in the config, and the arguments actually sent in `thread/start` by a restricted one-off session (§6.9).
 * It never starts the real codex on this machine. For the session's own behavior, see `codex-session.test.ts`.
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

describe('CodexDriver (fake codex)', () => {
  let dir: string;
  let fake: FakeCodex;
  let driver: CodexDriver;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-codex-driver-'));
    fake = await createFakeCodex(path.join(dir, 'fake'));
    driver = new CodexDriver(silentLogger, { locate: fake.locate });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('probe: not installed, signed out, available', async () => {
    fake.scenario({ installed: false });
    expect(await driver.probe()).toMatchObject({ state: 'not-installed', status: 'unavailable', unavailableReason: 'not-installed', version: null });
    fake.scenario({ installed: true, loggedIn: false });
    expect(await driver.probe()).toMatchObject({ state: 'signed-out', status: 'unavailable', unavailableReason: 'not-connected', version: '0.160.0' });
    fake.scenario({ loggedIn: true });
    expect(await driver.probe()).toMatchObject({ state: 'ready', status: 'available', unavailableReason: null, version: '0.160.0', minVersion: '0.158.0' });
  });

  it('probe: account description takes the login method, not the raw login status text (which may contain masked keys)', async () => {
    expect(await driver.probe()).toMatchObject({ state: 'ready', account: 'ChatGPT 账号' });
    expect(describeCodexAccount('Logged in using an API key - sk-proj-***ABCD')).toBe('OpenAI API 密钥');
    expect(describeCodexAccount('Logged in using Amazon Bedrock API key')).toBe('Amazon Bedrock');
    expect(describeCodexAccount('Logged in using personal access token')).toBe('访问令牌');
    expect(describeCodexAccount('Logged in using workload identity')).toBe('工作负载身份');
    expect(describeCodexAccount('')).toBe('Codex 账号');
  });

  it('probe: model table comes from model/list on a temporary app-server (paginated), hidden models are not listed; the process is closed after use and does not count as a session', async () => {
    const probe = await driver.probe();
    expect(probe.capabilities).toEqual({ steer: true, approvals: true, resume: true, images: true });
    expect(probe.models).toEqual([
      {
        id: 'fake-sol',
        label: 'FAKE-SOL',
        description: 'Balanced workhorse.',
        tier: 'balanced',
        isDefault: true,
        efforts: [
          { id: 'low', label: 'low' },
          { id: 'medium', label: 'medium' },
          { id: 'high', label: 'high' },
        ],
        defaultEffort: 'medium',
      },
      expect.objectContaining({ id: 'fake-luna', tier: 'fast', isDefault: false }),
    ]);
    // No config.toml.
    expect(probe).toMatchObject({ configModel: null, configModelKnown: null });
    const lists = fake.requests('model/list');
    expect(lists.map((r) => r.params)).toEqual([{ includeHidden: true }, { includeHidden: true, cursor: '2' }]);
    const init = fake.requests('initialize')[0]!.params;
    expect(init.capabilities).toBeNull();
    await until(() => fake.log().some((e) => e.kind === 'catalog-exit'));
    expect(fake.log().filter((e) => e.kind === 'catalog-start')).toHaveLength(1);
    expect(fake.log().some((e) => e.kind === 'start')).toBe(false);
  });

  it('probe: models are listed even when signed out; app-server is not started when the version is too old', async () => {
    fake.scenario({ loggedIn: false });
    const signedOut = await driver.probe();
    expect(signedOut).toMatchObject({ state: 'signed-out' });
    expect(signedOut.models.map((m) => m.id)).toEqual(['fake-sol', 'fake-luna']);
    fake.scenario({ version: '0.120.0' });
    const outdated = await driver.probe();
    expect(outdated).toMatchObject({ state: 'outdated', models: [], configModelKnown: null });
    expect(fake.log().filter((e) => e.kind === 'catalog-start')).toHaveLength(1);
  });

  it('probe: model table is cached, concurrent probes share one request', async () => {
    await Promise.all([driver.probe(), driver.probe()]);
    await driver.probe();
    expect(fake.log().filter((e) => e.kind === 'catalog-start')).toHaveLength(1);
  });

  it('probe: top-level model in config.toml, and whether it is in the catalog (hidden models count as known)', async () => {
    const config = path.join(fake.codexHome, 'config.toml');
    await fs.writeFile(config, 'model = "fake-hidden"\nmodel_reasoning_effort = "high"\n');
    expect(await driver.probe()).toMatchObject({ configModel: 'fake-hidden', configModelKnown: true });
    await fs.writeFile(config, '# 新客户端写的\nmodel = "gpt-from-the-future"\n');
    expect(await driver.probe()).toMatchObject({ configModel: 'gpt-from-the-future', configModelKnown: false });
    // Entries in the profile table do not count.
    await fs.writeFile(config, '[profiles.fast]\nmodel = "fake-luna"\n');
    expect(await driver.probe()).toMatchObject({ configModel: null, configModelKnown: null });
  });

  it('probe: when model/list fails the model table is empty and the probe proceeds as usual; configModelKnown is null when it cannot be determined', async () => {
    fake.scenario({ models: 'error' });
    await fs.writeFile(path.join(fake.codexHome, 'config.toml'), 'model = "fake-sol"\n');
    expect(await driver.probe()).toMatchObject({ state: 'ready', models: [], configModel: 'fake-sol', configModelKnown: null });
    // Failures are also cached for a while, so that every probe does not start a process.
    await driver.probe();
    expect(fake.log().filter((e) => e.kind === 'catalog-start')).toHaveLength(1);
  });

  it('probe: configModelKnown is null when model/list returns an empty table', async () => {
    fake.scenario({ models: [] });
    await fs.writeFile(path.join(fake.codexHome, 'config.toml'), 'model = "fake-sol"\n');
    expect(await driver.probe()).toMatchObject({ state: 'ready', models: [], configModel: 'fake-sol', configModelKnown: null });
  });

  it('probe: gives up on model/list after the time limit when it does not respond, and shuts down the temporary process', async () => {
    fake.scenario({ models: 'hang' });
    const slow = new CodexDriver(silentLogger, { locate: fake.locate, modelListTimeoutMs: 300 });
    const started = Date.now();
    expect(await slow.probe()).toMatchObject({ state: 'ready', models: [] });
    expect(Date.now() - started).toBeLessThan(4_000);
    // The limit covers the whole process, start-up included: a slow start gives up before `model/list` is sent, and
    // the fake then records a plain `exit`. Either way the temporary process has to be closed.
    await until(() => fake.log().some((e) => e.kind === 'catalog-exit' || e.kind === 'exit'));
  });

  it('probe: lists only visible models; for an unknown model, says so without guessing where it belongs', async () => {
    fake.scenario({ models: [fakeModel('gpt-5.5', { description: 'Older model.' }), fakeModel('codex-auto-review', { hidden: true })] });
    const probe = await driver.probe();
    expect(probe.models).toEqual([expect.objectContaining({ id: 'gpt-5.5', tier: null, description: 'Older model.' })]);
  });

  it('restricted session: working directory, never asks for approval, writes only to the working directory (not temp dirs, no network), no MCP servers; the process exits on close', async () => {
    const cwd = path.join(dir, 'staging');
    await fs.mkdir(cwd);
    const session = await driver.createSession({
      cwd,
      accessMode: 'fullAccess',
      model: null,
      effort: null,
      resume: null,
      developerInstructions: 'make one image',
      confinement: 'cwd-write-only',
    });
    const [start] = fake.requests('thread/start');
    expect(start!.params).toEqual({
      cwd,
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
      developerInstructions: 'make one image',
      config: {
        sandbox_workspace_write: { writable_roots: [], network_access: false, exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
      },
    });
    expect(fake.log().find((e) => e.kind === 'start')!.cwd).toBe(await fs.realpath(cwd));
    await session.close();
    await until(() => fake.log().some((e) => e.kind === 'exit'));
  });

  it('normal session is unaffected: policy follows the access mode, with MCP servers and the relaxed tool timeout, and no sandbox details', async () => {
    const cwd = path.join(dir, 'project');
    await fs.mkdir(cwd);
    const session = await driver.createSession({
      cwd,
      accessMode: 'ask',
      model: null,
      effort: null,
      resume: null,
      mcpServers: { cuccut: { url: 'http://127.0.0.1:1/mcp', headers: { authorization: 'Bearer test-token' } } },
    });
    const [start] = fake.requests('thread/start');
    expect(start!.params).toMatchObject({ cwd, approvalPolicy: 'untrusted', approvalsReviewer: 'user', sandbox: 'workspace-write' });
    const config = start!.params.config as Record<string, unknown>;
    expect(Object.keys(config)).toEqual(['mcp_servers']);
    // Tool calls may be waiting for user approval: do not use Codex's default 60-second limit.
    expect(config.mcp_servers).toMatchObject({ cuccut: { default_tools_approval_mode: 'approve', tool_timeout_sec: CODEX_TOOL_TIMEOUT_SEC } });
    expect(CODEX_TOOL_TIMEOUT_SEC).toBe(86400);
    await session.close();
  });

  it('access mode → Codex approval policy and sandbox (the stricter one wins), old values are replaced with new ones first', () => {
    expect(codexPolicy('plan')).toEqual({ approvalPolicy: 'untrusted', approvalsReviewer: 'user', sandbox: 'read-only' });
    expect(codexPolicy('ask')).toEqual({ approvalPolicy: 'untrusted', approvalsReviewer: 'user', sandbox: 'workspace-write' });
    expect(codexPolicy('autoAcceptEdits')).toEqual({ approvalPolicy: 'untrusted', approvalsReviewer: 'user', sandbox: 'workspace-write' });
    expect(codexPolicy('auto')).toEqual({ approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write' });
    expect(codexPolicy('fullAccess')).toEqual({ approvalPolicy: 'never', approvalsReviewer: 'user', sandbox: 'workspace-write' });
    expect(codexPolicy('controlled')).toEqual(codexPolicy('ask'));
    expect(codexPolicy('authorized')).toEqual(codexPolicy('fullAccess'));
  });

  it('under auto, Codex only asks about actions that go outside the sandbox: approval requests carry escalation; under ask they do not', async () => {
    const cwd = path.join(dir, 'project');
    await fs.mkdir(cwd);
    fake.scenario({ turn: { askApproval: true, reply: 'done' } });
    for (const [accessMode, escalation] of [
      ['auto', true],
      ['ask', undefined],
    ] as const) {
      const session = await driver.createSession({ cwd, accessMode, model: null, effort: null, resume: null });
      const events: AgentEvent[] = [];
      session.subscribe((event) => events.push(event));
      await session.startTurn({ text: 'go' }, { accessMode, model: null, effort: null });
      const asked = await until(() => events.find((e) => e.type === 'approval.requested'));
      expect(asked.type === 'approval.requested' && asked.escalation).toBe(escalation);
      if (asked.type === 'approval.requested') await session.respondToApproval(asked.approvalId, { decision: 'decline' });
      await until(() => events.find((e) => e.type === 'turn.completed'));
      await session.close();
    }
  });
});

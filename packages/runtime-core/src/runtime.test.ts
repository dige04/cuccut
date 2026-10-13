import { execFile } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import type { AgentDriver, AgentEvent, AgentSession, ApprovalResponse, CreateSessionOptions, TurnSettings } from '@cuccut/harness';
import { Harness } from '@cuccut/harness';
import { applySettingsEvent, applySpaceEvent, applyTasksEvent } from '@cuccut/client';
import { JobManager } from '@cuccut/jobs';
import { NodeInitiator, NodeService } from '@cuccut/nodes';
import {
  RpcError,
  SETTING_DEFAULTS,
  newId,
  type AgentsEvent,
  type AgentsView,
  type ConversationSnapshot,
  type DriverProbe,
  type Id,
  type SettingsEvent,
  type SettingsSnapshot,
  type SpaceSnapshot,
  type TasksSnapshot,
} from '@cuccut/protocol';
import { ConversationStore, readDiscovery, resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { Gateway } from './gateway.ts';
import { MediaAnalysis } from './media-analysis.ts';
import { VideoService } from './videos/video-service.ts';
import { PublishingService } from './publishing/publishing-service.ts';
import { fakeProbe } from './agent-tools/testing/fake-agent.ts';
import { startRuntime, type RunningRuntime, type StartRuntimeOptions } from './runtime.ts';
import { SpaceCatalog } from './space-catalog.ts';
import { ServiceManager } from './services/service-manager.ts';

/**
 * End to end: a real Runtime, gateway and client, with the Driver replaced by a scripted fake.
 * The user's message decides how the fake agent behaves: `hello` streams a reply and then ends; `approve` first asks for one approval before ending.
 */

const capabilities: DriverProbe['capabilities'] = { steer: false, approvals: true, resume: false, images: false };

class FakeSession implements AgentSession {
  readonly id = newId('fake');
  readonly capabilities = capabilities;
  readonly calls: string[] = [];
  /** The access mode carried by each turn (`TurnSettings.accessMode`): the mode takes effect per turn, without reopening the native session. */
  readonly turnModes: TurnSettings['accessMode'][] = [];
  readonly #listeners = new Set<(event: AgentEvent) => void>();
  #turn = 0;

  startTurn(input: { text: string }, settings: TurnSettings): Promise<{ turnId: string }> {
    const turnId = `turn-${++this.#turn}`;
    this.calls.push(`startTurn:${input.text}`);
    this.turnModes.push(settings.accessMode);
    setTimeout(() => this.#script(turnId, input.text), 5);
    return Promise.resolve({ turnId });
  }

  async interrupt(turnId: string) {
    this.calls.push(`interrupt:${turnId}`);
    setTimeout(() => this.#emit({ type: 'turn.completed', turnId, outcome: 'interrupted', error: null }), 5);
    return { status: 'requested' as const };
  }

  async respondToApproval(approvalId: Id, response: ApprovalResponse) {
    this.calls.push(`approval:${approvalId}:${response.decision}`);
    if (response.decision === 'accept') {
      setTimeout(() => this.#emit({ type: 'turn.completed', turnId: `turn-${this.#turn}`, outcome: 'completed', error: null }), 5);
    }
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  describePersistence() {
    return null;
  }

  async close() {}

  #emit(event: AgentEvent) {
    for (const listener of this.#listeners) listener(event);
  }

  #script(turnId: string, text: string) {
    this.#emit({ type: 'turn.started', turnId });
    if (text === 'hello') {
      this.#emit({ type: 'item.started', turnId, item: { kind: 'agent-message', id: 'm1', text: '' } });
      this.#emit({ type: 'item.delta', turnId, itemId: 'm1', channel: 'text', delta: '你' });
      this.#emit({ type: 'item.delta', turnId, itemId: 'm1', channel: 'text', delta: '好' });
      this.#emit({ type: 'item.completed', turnId, item: { kind: 'agent-message', id: 'm1', text: '你好' } });
      this.#emit({ type: 'turn.completed', turnId, outcome: 'completed', error: null });
    } else if (DRIVER_REQUESTS[text]) {
      const { request, escalation } = DRIVER_REQUESTS[text];
      this.#emit({ type: 'approval.requested', turnId, approvalId: 'ap1', request, ...(escalation ? { escalation } : {}) });
    }
  }
}

/** Approval requests the fake agent emits, per message: commands, file changes inside and outside the working directory, and commands that escape the sandbox (Codex's on-request). */
const DRIVER_REQUESTS: Record<string, { request: Extract<AgentEvent, { type: 'approval.requested' }>['request']; escalation?: true }> = {
  approve: { request: { kind: 'command', command: 'touch notes.txt', cwd: null, reason: null, rule: 'touch' } },
  'approve-file': { request: { kind: 'file-change', files: ['notes.txt'], reason: null } },
  'approve-outside': { request: { kind: 'file-change', files: [path.join(os.tmpdir(), 'cuccut-elsewhere', 'x.txt')], reason: null } },
  'approve-escalation': {
    request: { kind: 'command', command: 'curl https://example.com', cwd: null, reason: '需要联网' },
    escalation: true,
  },
};

class FakeDriver implements AgentDriver {
  readonly id = 'codex' as const;
  readonly sessions: FakeSession[] = [];
  readonly created: CreateSessionOptions[] = [];

  async probe(): Promise<DriverProbe> {
    return fakeProbe(capabilities);
  }

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    this.created.push(options);
    const session = new FakeSession();
    this.sessions.push(session);
    return session;
  }
}

async function until<T>(read: () => T | undefined | false, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Runtime (fake driver)', () => {
  let dir: string;
  let runtime: RunningRuntime;
  let driver: FakeDriver;
  let client: CucCutClient;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    driver = new FakeDriver();
    runtime = await startRuntime({ home: resolveRuntimeHome({ CUCCUT_HOME: dir }), drivers: () => [driver], watchSpace: false });
    client = await connect();
  });

  async function connect(): Promise<CucCutClient> {
    const { endpoint, token } = runtime.discovery;
    const next = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'cli', name: 'test', version: '0' },
      reconnect: false,
    });
    await next.connect();
    return next;
  }

  async function rejection(promise: Promise<unknown>): Promise<RpcError> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof RpcError) return error;
      throw error;
    }
    throw new Error('应该被拒绝');
  }

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** A session mirror kept up through a subscription, matching what the UI receives. */
  function mirror(conversationId: Id) {
    let current: ConversationSnapshot | null = null;
    const updates: string[] = [];
    client.subscribeConversation(conversationId, {
      snapshot: (snapshot) => {
        current = snapshot;
      },
      event: (event) => {
        updates.push(event.type);
        if (!current) return;
        if (event.type === 'item.upsert') {
          const index = current.items.findIndex((i) => i.id === event.item.id);
          current = { ...current, items: index < 0 ? [...current.items, event.item] : current.items.with(index, event.item) };
        } else if (event.type === 'conversation.updated') {
          current = { ...current, conversation: event.conversation };
        }
      },
    });
    return { get: () => current, updates, ready: until(() => current !== null) };
  }

  it('send message: streamed reply, task completes, title taken from the first sentence', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const view = mirror(conversation.id);
    await view.ready;
    const { taskId } = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'hello',
      commandId: newId('cmd'),
    });

    const done = await until(() => {
      const snapshot = view.get();
      const task = snapshot?.items.find((i) => i.id === taskId);
      return snapshot && task?.kind === 'task' && task.status === 'completed' ? snapshot : undefined;
    });
    expect(view.updates).toContain('item.append');
    const reply = runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'agent-message');
    expect(reply).toMatchObject({ text: '你好', streaming: false });
    expect(done.conversation).toMatchObject({ title: 'hello', activity: 'idle', activeTaskId: null });
  });

  it('publishing: the topic and methods are served, and the command line is not the owner', async () => {
    expect(await client.request('subscribe', { topic: 'publishing' })).toMatchObject({
      mode: 'snapshot',
      snapshot: { publications: [], connections: [], accounts: [], degraded: null },
    });
    expect(await client.request('publishing.calendar', { from: '2026-10-01', to: '2026-10-31' })).toEqual({ publications: [], total: 0, nextOffset: null });
    const refused = await rejection(client.request('publishing.connections.save', { provider: 'manual', name: 'By hand' }));
    expect(refused).toMatchObject({ code: 'forbidden', details: { code: 'OWNER_REQUIRED' } });
    const missing = await rejection(client.request('publishing.prepare', { videoIds: ['vid_none'] }));
    expect(missing).toMatchObject({ code: 'not-found', details: { code: 'VIDEO_NOT_FOUND' } });
    expect(runtime.publishing.store.publications()).toEqual([]);
  });

  it('resending the same commandId does not start another task', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const commandId = newId('cmd');
    const first = await client.request('conversations.send', { conversationId: conversation.id, text: 'hello', commandId });
    const second = await client.request('conversations.send', { conversationId: conversation.id, text: 'hello', commandId });
    expect(second.taskId).toBe(first.taskId);
    // The native session is created asynchronously after send returns (it first reads the open skill), so wait for it to appear before counting.
    const session = await until(() => driver.sessions[0]?.calls.some((c) => c.startsWith('startTurn')) && driver.sessions[0]);
    expect(session.calls.filter((c) => c.startsWith('startTurn'))).toHaveLength(1);
  });

  it('creation templates: lists built-in and user-directory templates, gets body, attached files fetched via media channel', async () => {
    const own = path.join(dir, 'templates', 'my-scene');
    await fs.mkdir(path.join(own, 'assets'), { recursive: true });
    const { manifest } = (await client.request('templates.get', { id: 'launch-film' })).template;
    await fs.writeFile(
      path.join(own, 'template.json'),
      JSON.stringify({
        ...manifest,
        id: 'my-scene',
        source: 'community',
        cover: { file: 'cover.png', tone: 'blue' },
        preview: { beats: manifest.preview.beats },
        verification: undefined,
        assets: [{ path: 'assets/x.svg', type: 'svg', note: '片尾标志' }],
      }),
    );
    await fs.writeFile(path.join(own, 'prompt.md'), '你要做一条自己的视频。\n');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J1sAAAAASUVORK5CYII=', 'base64');
    await fs.writeFile(path.join(own, 'cover.png'), png);
    await fs.writeFile(path.join(own, 'assets', 'x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await fs.mkdir(path.join(dir, 'templates', 'broken'));
    await fs.writeFile(path.join(dir, 'templates', 'broken', 'template.json'), '{}');

    const { templates, diagnostics } = await client.request('templates.list', {});
    expect(templates.filter((t) => t.origin === 'builtin').length).toBeGreaterThanOrEqual(24);
    expect(templates.find((t) => t.manifest.id === 'my-scene')).toMatchObject({
      origin: 'user',
      files: { cover: true, preview: false, assets: 1 },
    });
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'unsupported-schema', origin: 'user', dir: 'broken' })]);

    expect((await client.request('templates.get', { id: 'my-scene' })).prompt).toBe('你要做一条自己的视频。\n');
    const cover = await client.request('templates.openHandle', { id: 'my-scene', path: 'cover.png' });
    expect(cover).toMatchObject({ mimeType: 'image/png', contentKind: 'image', size: png.length, fileName: 'cover.png' });
    expect(Buffer.from(await (await fetch(cover.url)).arrayBuffer())).toEqual(png);
    const svg = await client.request('templates.openHandle', { id: 'my-scene', path: 'assets/x.svg' });
    expect(await (await fetch(svg.url)).text()).toContain('<svg');
    const unregistered = await rejection(client.request('templates.openHandle', { id: 'my-scene', path: 'prompt.md' }));
    expect(unregistered).toMatchObject({ code: 'not-found', details: { code: 'TEMPLATE_FILE_NOT_FOUND' } });
    expect((await rejection(client.request('templates.get', { id: 'broken' }))).details).toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
    expect((await rejection(client.request('templates.openHandle', { id: 'my-scene', path: '../x' }))).code).toBe('invalid-request');
  });

  it('send with scene template: agent receives brief guidance and body, session shows user\'s original words plus template marker', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const { prompt } = await client.request('templates.get', { id: 'launch-film' });
    await client.request('conversations.send', {
      conversationId: conversation.id,
      text: '给我的新耳机做一条发布片',
      commandId: newId('cmd'),
      template: { id: 'launch-film', version: '0.0.1' },
    });
    const turn = await until(() => driver.sessions[0]?.calls.find((c) => c.startsWith('startTurn:')));
    expect(turn.startsWith('startTurn:给我的新耳机做一条发布片\n\n<cuccut-template id="launch-film" version="1.1.0">')).toBe(true);
    expect(turn).toContain('First agree on the brief with the user');
    expect(turn).toContain(prompt.trim());
    const message = runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'user-message');
    expect(message).toMatchObject({
      text: '给我的新耳机做一条发布片',
      template: { id: 'launch-film', version: '1.1.0', title: '新品发布片', kind: 'scene', origin: 'builtin' },
    });

    const other = await client.request('conversations.create', {});
    const example = await rejection(
      client.request('conversations.send', {
        conversationId: other.conversation.id,
        text: '做一条',
        commandId: newId('cmd'),
        template: { id: 'ai-news-take' },
      }),
    );
    expect(example).toMatchObject({ code: 'invalid-request', details: { code: 'TEMPLATE_NOT_SCENE' } });
  });

  it('approval: after allow, the turn continues and completes', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const { taskId } = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'approve',
      commandId: newId('cmd'),
      autonomy: 'plan',
    });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'awaiting-approval');

    const result = await client.request('agents.respondToApproval', {
      conversationId: conversation.id,
      approvalId: 'ap1',
      decision: 'accept',
    });
    expect(result.status).toBe('accepted');
    await until(() => {
      const task = runtime.harness.getConversation(conversation.id).items.find((i) => i.id === taskId);
      return task?.kind === 'task' && task.status === 'completed';
    });
    expect(runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'approval')).toMatchObject({ status: 'accepted' });
  });

  it('stop barrier: cancel pending approvals first, then interrupt the turn; later approvals no longer pass', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const { taskId } = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'approve',
      commandId: newId('cmd'),
      accessMode: 'ask',
    });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'awaiting-approval');

    await client.request('tasks.stop', { taskId });
    const late = await client.request('agents.respondToApproval', {
      conversationId: conversation.id,
      approvalId: 'ap1',
      decision: 'accept',
    });
    expect(late.status).toBe('already-resolved');

    await until(() => {
      const task = runtime.harness.getConversation(conversation.id).items.find((i) => i.id === taskId);
      return task?.kind === 'task' && task.status === 'stopped';
    });
    const session = driver.sessions[0]!;
    expect(session.calls).toEqual(['startTurn:approve', 'approval:ap1:cancel', 'interrupt:turn-1']);
    expect(runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'approval')).toMatchObject({
      status: 'cancelled',
    });
    expect(runtime.harness.getConversation(conversation.id).conversation).toMatchObject({ activity: 'idle', activeTaskId: null });
  });

  it('driver approvals follow the same decision table: auto-allow, auto-deny or hand to user; pending ones go into the unified list and task topic', async () => {
    let tasks: TasksSnapshot | null = null;
    client.subscribeTasks({
      snapshot: (snapshot) => {
        tasks = snapshot;
      },
      event: (event) => {
        if (tasks) tasks = applyTasksEvent(tasks, event);
      },
    });
    await until(() => tasks !== null);
    const cases = [
      ['plan', 'approve', 'pending', 'command'],
      ['plan', 'approve-file', 'declined', 'edit'],
      ['ask', 'approve-file', 'pending', 'edit'],
      ['autoAcceptEdits', 'approve-file', 'accepted', 'edit'],
      ['autoAcceptEdits', 'approve-outside', 'pending', 'high'],
      ['autoAcceptEdits', 'approve', 'pending', 'command'],
      ['auto', 'approve', 'accepted', 'command'],
      ['auto', 'approve-escalation', 'pending', 'high'],
      ['fullAccess', 'approve-escalation', 'accepted', 'high'],
      ['fullAccess', 'approve-outside', 'accepted', 'high'],
    ] as const;
    for (const [mode, text, status, risk] of cases) {
      const label = `${mode} ${text}`;
      const { conversation } = await client.request('conversations.create', {});
      const { taskId } = await client.request('conversations.send', {
        conversationId: conversation.id,
        text,
        commandId: newId('cmd'),
        accessMode: mode,
      });
      const item = await until(() => runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'approval'));
      expect(item, label).toMatchObject({ status, risk, mode, ...(status === 'pending' ? {} : { decidedBy: 'auto' }) });
      const session = driver.sessions.at(-1)!;
      if (status === 'pending') {
        const pending = runtime.harness.approvals.pending();
        expect(pending, label).toHaveLength(1);
        expect(pending[0], label).toMatchObject({
          subject: { kind: 'conversation', conversationId: conversation.id, taskId },
          risk,
          basis: { kind: 'mode', mode },
          expiresAt: null,
        });
        await until(() => tasks?.approvals?.length === 1);
        expect(runtime.harness.getConversation(conversation.id).conversation.activity, label).toBe('awaiting-approval');
        await client.request('tasks.stop', { taskId });
        expect(session.calls, label).toContain('approval:ap1:cancel');
        expect(runtime.harness.approvals.pending(), label).toEqual([]);
        await until(() => tasks?.approvals?.length === 0);
      } else {
        expect(session.calls, label).toContain(`approval:ap1:${status === 'accepted' ? 'accept' : 'decline'}`);
        expect(runtime.harness.approvals.pending(), label).toEqual([]);
        if (status === 'declined') await client.request('tasks.stop', { taskId });
      }
      await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'idle');
    }
  });

  it('two ways to handle session approval: accept-for-session via agents.respondToApproval ends that item in the unified list just like approvals.respond', async () => {
    const { conversation } = await client.request('conversations.create', {});
    await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'approve',
      commandId: newId('cmd'),
      accessMode: 'ask',
    });
    const [pending] = await until(() => runtime.harness.approvals.pending().length === 1 && runtime.harness.approvals.pending());
    expect((await client.request('approvals.list', {})).approvals).toEqual([pending]);
    expect(await client.request('approvals.respond', { approvalId: pending!.approvalId, decision: 'allow' })).toEqual({
      status: 'allowed',
    });
    expect(await client.request('approvals.respond', { approvalId: pending!.approvalId, decision: 'deny' })).toEqual({
      status: 'already-resolved',
    });
    expect(
      await client.request('agents.respondToApproval', { conversationId: conversation.id, approvalId: 'ap1', decision: 'decline' }),
    ).toEqual({
      status: 'already-resolved',
    });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'idle');
    expect(driver.sessions.at(-1)!.calls).toEqual(['startTurn:approve', 'approval:ap1:accept']);
    expect(runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'approval')).toMatchObject({
      status: 'accepted',
      decidedBy: 'user',
    });

    const { conversation: second } = await client.request('conversations.create', {});
    await client.request('conversations.send', { conversationId: second.id, text: 'approve', commandId: newId('cmd'), accessMode: 'ask' });
    await until(() => runtime.harness.approvals.pending().length === 1);
    expect(
      await client.request('agents.respondToApproval', { conversationId: second.id, approvalId: 'ap1', decision: 'accept-for-session' }),
    ).toEqual({ status: 'accepted' });
    expect(runtime.harness.approvals.pending()).toEqual([]);
    await until(() => driver.sessions.at(-1)!.calls.includes('approval:ap1:accept-for-session'));
  });

  it('access mode follows settings; \'always allow\': rules kept by CucCut, native side only allows at session level, later the same rule auto-answers; default Agent stored in settings', async () => {
    const { conversation } = await client.request('conversations.create', {});
    // A session that has not been switched follows the setting agent.defaultAccessMode (default auto).
    expect(conversation).toMatchObject({ driverId: 'codex', model: null, effort: null, accessMode: null });
    const { conversation: switched } = await client.request('conversations.update', { conversationId: conversation.id, accessMode: 'ask' });
    expect(switched.accessMode).toBe('ask');

    const { taskId } = await client.request('conversations.send', { conversationId: conversation.id, text: 'approve', commandId: newId('cmd') });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'awaiting-approval');
    await client.request('agents.respondToApproval', { conversationId: conversation.id, approvalId: 'ap1', decision: 'accept-always' });
    expect(driver.sessions[0]!.calls).toContain('approval:ap1:accept-for-session');
    expect(runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'approval')).toMatchObject({
      status: 'accepted',
      decidedBy: 'user',
      decision: 'accept-always',
    });
    // The fake agent ends a turn only after `accept`; after a session-level allow, it wraps up on stop.
    await client.request('tasks.stop', { taskId });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'idle');

    const view = await client.request('agents.list', {});
    expect(view.preferences).toMatchObject({ rules: ['touch'] });
    expect(view.drivers).toEqual([expect.objectContaining({ id: 'codex', state: 'ready', enabled: true, isDefault: true })]);

    // Same rule in another session: the “ask” tier also auto-approves, and the timeline records it as by rule.
    const { conversation: other } = await client.request('conversations.create', {});
    await client.request('conversations.send', { conversationId: other.id, text: 'approve', commandId: newId('cmd'), accessMode: 'ask' });
    const ruled = await until(() => runtime.harness.getConversation(other.id).items.find((i) => i.kind === 'approval'));
    expect(ruled).toMatchObject({ status: 'accepted', decidedBy: 'rule' });
    expect(driver.sessions.at(-1)!.calls).toContain('approval:ap1:accept');
    await until(() => runtime.harness.getConversation(other.id).conversation.activity === 'idle');
    expect((await client.request('agents.removeRule', { rule: 'touch' })).preferences.rules).toEqual([]);

    // Default Agent: agents.setDefault writes the setting agent.defaultDriver.
    await client.request('agents.setDefault', { driverId: 'codex' });
    expect((await client.request('settings.get', {})).settings['agent.defaultDriver']).toBe('codex');

    // A native session cannot continue across Agents: a session that has had tasks cannot be switched.
    const error = await rejection(client.request('conversations.update', { conversationId: conversation.id, driverId: 'claude' }));
    expect(error.code).toBe('conflict');
    // Once disabled, it is no longer a valid default.
    const disabled = await client.request('agents.configure', { driverId: 'codex', enabled: false });
    expect(disabled.drivers[0]).toMatchObject({ state: 'disabled', status: 'unavailable', enabled: false });
  });
  it('agents topic: snapshot is the view of agents.list; changes in preference, re-detection, and default Agent push the full view each time', async () => {
    const listed = await client.request('agents.list', {});
    let view: AgentsView | null = null;
    const seen: AgentsEvent[] = [];
    const stop = client.subscribeAgents({
      snapshot: (snapshot) => (view = snapshot),
      event: (event) => {
        seen.push(event);
        view = event.view;
      },
    });
    try {
      const snapshot = await until(() => view ?? undefined);
      expect(snapshot.checking).toEqual([]);
      expect(snapshot.drivers.map((d) => d.id)).toEqual(listed.drivers.map((d) => d.id));
      expect(snapshot.drivers[0]).toMatchObject({ id: 'codex', state: 'ready' });

      await client.request('agents.updatePreferences', { modelAutoUpdate: false });
      await until(() => view?.preferences.modelAutoUpdate === false);

      const count = seen.length;
      const detected = await client.request('agents.detect', { driverId: 'codex' });
      await until(() => seen.length > count);
      expect(view!.drivers[0]!.checkedAt).toBe(detected.drivers[0]!.checkedAt);

      await client.request('agents.configure', { driverId: 'codex', enabled: false });
      await until(() => view?.drivers[0]?.state === 'disabled');
      await client.request('agents.configure', { driverId: 'codex', enabled: true });
      const before = seen.length;
      await client.request('agents.setDefault', { driverId: 'codex' });
      await until(() => seen.length > before);
      expect(seen.every((event) => event.type === 'agents.updated')).toBe(true);
    } finally {
      stop();
    }
  });

  it('disconnect does not cancel the turn: reconnecting on another connection can still see and continue the task', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const { taskId } = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'approve',
      commandId: newId('cmd'),
      autonomy: 'plan',
    });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'awaiting-approval');
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));

    client = await connect();
    const view = mirror(conversation.id);
    await view.ready;
    expect(view.get()!.conversation).toMatchObject({ activity: 'awaiting-approval', activeTaskId: taskId });
    await client.request('agents.respondToApproval', { conversationId: conversation.id, approvalId: 'ap1', decision: 'accept' });
    await until(() => {
      const task = view.get()?.items.find((i) => i.id === taskId);
      return task?.kind === 'task' && task.status === 'completed';
    });
  });

  it('task topic: snapshot and increments; after completion the session is marked unread, markRead clears it', async () => {
    let tasks: TasksSnapshot | null = null;
    client.subscribeTasks({
      snapshot: (snapshot) => {
        tasks = snapshot;
      },
      event: (event) => {
        if (tasks) tasks = applyTasksEvent(tasks, event);
      },
    });
    await until(() => tasks !== null);
    const { conversation } = await client.request('conversations.create', {});
    const { taskId } = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'hello',
      commandId: newId('cmd'),
    });
    const done = await until(() => tasks?.tasks.find((t) => t.taskId === taskId && t.status === 'completed'));
    expect(done).toMatchObject({ conversationId: conversation.id, goal: 'hello', conversationTitle: 'hello', error: null });
    expect(runtime.harness.getConversation(conversation.id).conversation.unread).toBe(true);

    const before = runtime.harness.getConversation(conversation.id).conversation.updatedAt;
    const read = await client.request('conversations.markRead', { conversationId: conversation.id });
    expect(read.conversation).toMatchObject({ unread: false, updatedAt: before });

    // After a session is deleted, its tasks disappear from the task center.
    await client.request('conversations.delete', { conversationId: conversation.id });
    await until(() => tasks?.tasks.length === 0);
  });

  it('project: created under the project directory, duplicate names get a number; pin and archive do not change last activity', async () => {
    const first = await client.request('projects.create', { name: '短片' });
    const second = await client.request('projects.create', { name: '短片' });
    const unnamed = await client.request('projects.create', {});
    expect(first.project.path).toBe(await fs.realpath(path.join(dir, 'projects', '短片')));
    expect(path.basename(second.project.path)).toBe('短片 2');
    expect(path.basename(unnamed.project.path)).toBe('未命名项目');
    expect(first.project).toMatchObject({ name: '短片', pinned: false, archived: false });

    const pinned = await client.request('projects.update', { projectId: first.project.id, pinned: true, name: '短片 A' });
    expect(pinned.project).toMatchObject({ pinned: true, name: '短片 A', lastActiveAt: first.project.lastActiveAt });

    const { conversation } = await client.request('conversations.create', { projectId: first.project.id });
    const updated = await client.request('conversations.update', { conversationId: conversation.id, title: '  第一版  ', pinned: true });
    expect(updated.conversation).toMatchObject({ title: '第一版', pinned: true, updatedAt: conversation.updatedAt });

    const bad = await rejection(client.request('projects.create', { name: 3 as unknown as string }));
    expect(bad.code).toBe('invalid-request');
    const missing = await rejection(client.request('projects.update', { projectId: 'proj_nope', pinned: true }));
    expect(missing.code).toBe('not-found');
  });

  it('Library: lists media files in the project, marked editable, media URLs support Range', async () => {
    const project = path.join(dir, 'work');
    await fs.mkdir(path.join(project, 'clips'), { recursive: true });
    await fs.mkdir(path.join(project, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(project, 'clips', 'a.mp4'), Buffer.from('0123456789'));
    await fs.writeFile(path.join(project, 'notes.md'), '# 笔记');
    await fs.writeFile(path.join(project, 'index.ts'), 'code');
    await fs.writeFile(path.join(project, 'node_modules', 'x.png'), 'x');

    let space: SpaceSnapshot | null = null;
    client.subscribeSpace({
      snapshot: (snapshot) => {
        space = snapshot;
      },
      event: (event) => {
        if (space) space = applySpaceEvent(space, event);
      },
    });
    await runtime.space.ready;
    const { project: opened } = await client.request('projects.open', { path: project });
    const entries = await until(() => (space && space.entries.length === 2 ? space.entries : undefined));
    expect(entries.map((e) => `${e.kind}:${e.relPath}`).sort()).toEqual(['document:notes.md', 'video-file:clips/a.mp4']);
    const video = entries.find((e) => e.kind === 'video-file')!;
    expect(video).toMatchObject({ fileName: 'a.mp4', size: 10, source: { projectId: opened.id, conversationId: null } });

    const { entry } = await client.request('space.update', { entryId: video.id, favorite: true, displayName: '开场' });
    expect(entry).toMatchObject({ name: '开场', user: { favorite: true, displayName: '开场', trashedAt: null } });
    await until(() => space?.entries.find((e) => e.id === video.id)?.user.favorite);
    const trashed = await client.request('space.update', { entryId: video.id, trashed: true });
    expect(trashed.entry.user.trashedAt).not.toBeNull();
    // The trash only writes a marker; the file is still there.
    await fs.access(path.join(project, 'clips', 'a.mp4'));

    // The marker survives a rescan.
    await client.request('space.rescan', {});
    expect(space!.entries.find((e) => e.id === video.id)).toMatchObject({ name: '开场', user: { favorite: true } });

    const handle = await client.request('media.resolve', { entryId: video.id });
    // The fixture is ten ASCII bytes. Directory classification still goes by extension, so the viewer must judge by content.
    expect(handle).toMatchObject({ mimeType: 'text/plain; charset=utf-8', contentKind: 'text', size: 10, fileName: 'a.mp4' });
    expect(handle.url).not.toContain(project);
    expect(await client.request('media.playback', { url: handle.url })).toMatchObject({ status: 'ready', media: handle });
    expect((await rejection(client.request('media.playback', { url: handle.url, path: project } as never))).code).toBe('invalid-request');
    expect((await rejection(client.request('media.playback', { url: 'http://other.invalid/media/forged/x' }))).code).toBe('not-found');
    const partial = await fetch(handle.url, { headers: { Range: 'bytes=2-5' } });
    expect(partial.status).toBe(206);
    expect(partial.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await partial.text()).toBe('2345');
    const tail = await fetch(handle.url, { headers: { Range: 'bytes=-3' } });
    expect(await tail.text()).toBe('789');
    const beyond = await fetch(handle.url, { headers: { Range: 'bytes=20-' } });
    expect(beyond.status).toBe(416);
    const head = await fetch(handle.url, { method: 'HEAD' });
    expect(head.headers.get('content-length')).toBe('10');
    expect(head.headers.get('accept-ranges')).toBe('bytes');
    const forged = await fetch(handle.url.replace(/\/media\/[^/]+/, '/media/not-a-handle'));
    expect(forged.status).toBe(404);

    // Deleting the file removes the entry.
    await fs.rm(path.join(project, 'notes.md'));
    await client.request('space.rescan', {});
    expect(space!.entries.map((e) => e.relPath)).toEqual(['clips/a.mp4']);
  });

  it('Library: does not list project marker directories; after project directory moves, follows to new location, user markers kept', async () => {
    const project = path.join(dir, 'before');
    await fs.mkdir(project, { recursive: true });
    await fs.writeFile(path.join(project, 'a.mp4'), 'x');
    await runtime.space.ready;
    const { project: opened } = await client.request('projects.open', { path: project });
    await fs.access(path.join(project, '.ccut', 'project.json'));
    await client.request('space.rescan', {});
    const entries = () => runtime.space.snapshot().entries.filter((e) => e.source.projectId === opened.id);
    expect(entries().map((e) => e.relPath)).toEqual(['a.mp4']);
    const [entry] = entries();
    await client.request('space.update', { entryId: entry!.id, favorite: true });

    const after = path.join(dir, 'after');
    await fs.rename(project, after);
    const { project: moved } = await client.request('projects.open', { path: after });
    expect(moved.id).toBe(opened.id);
    await client.request('space.rescan', {});
    expect(entries()).toMatchObject([{ id: entry!.id, relPath: 'a.mp4', user: { favorite: true } }]);
    expect(runtime.space.locate(entry!.id).root).toBe(moved.path);
  });

  it('continue session from Library item: choose session, carry only identifier and metadata, cleared after the next message; sessions that can\'t see the item and items in trash are rejected', async () => {
    const project = path.join(dir, 'continue');
    await fs.mkdir(project, { recursive: true });
    const secret = '这段文件内容不该进提示词';
    await fs.writeFile(path.join(project, 'notes.md'), secret);
    await runtime.space.ready;
    const { project: opened } = await client.request('projects.open', { path: project });
    await client.request('space.rescan', {});
    const entry = runtime.space.snapshot().entries.find((e) => e.relPath === 'notes.md')!;

    // An entry that belongs to a project: a session is created in that project. A retry with the same commandId gets the same session, and the reference is not duplicated.
    const commandId = newId('cmd');
    const first = await client.request('space.continueInConversation', { entryId: entry.id, commandId });
    expect(first).toMatchObject({
      created: true,
      conversation: { projectId: opened.id, cwd: opened.path },
      reference: { entryId: entry.id, kind: 'document', name: 'notes.md', projectId: opened.id, relPath: 'notes.md', origin: null },
    });
    expect(first.conversation.pendingReferences).toEqual([first.reference]);
    const again = await client.request('space.continueInConversation', { entryId: entry.id, commandId });
    expect(again).toMatchObject({ created: false, conversation: { id: first.conversation.id } });
    expect(again.conversation.pendingReferences).toHaveLength(1);
    // Only attaches the reference; does not start a task.
    expect(driver.created).toEqual([]);
    expect(runtime.harness.getConversation(first.conversation.id).items).toEqual([]);

    // Specified session: it must be able to see the entry. A session outside the project cannot see the project's entries.
    const { conversation: loose } = await client.request('conversations.create', {});
    const mismatch = await rejection(client.request('space.continueInConversation', { entryId: entry.id, conversationId: loose.id }));
    expect(mismatch.details).toMatchObject({ code: 'SPACE_CONVERSATION_MISMATCH' });
    const { conversation: sibling } = await client.request('conversations.create', { projectId: opened.id });
    const into = await client.request('space.continueInConversation', { entryId: entry.id, conversationId: sibling.id });
    expect(into).toMatchObject({ created: false, conversation: { id: sibling.id, pendingReferences: [{ entryId: entry.id }] } });
    // The user removed the reference in the input box.
    const cleared = await client.request('conversations.update', { conversationId: sibling.id, pendingReferences: null });
    expect(cleared.conversation.pendingReferences).toBeUndefined();

    // Send: the reference is appended to the text sent to the agent, recorded on the user message, and then cleared. The file content is not in it.
    await client.request('conversations.send', {
      conversationId: first.conversation.id,
      text: '接着整理这份笔记',
      commandId: newId('cmd'),
    });
    const session = await until(() => driver.sessions[0]);
    const prompt = await until(() => session.calls.find((c) => c.startsWith('startTurn:')));
    expect(prompt).toContain('接着整理这份笔记');
    expect(prompt).toContain('<cuccut-space-references>');
    expect(prompt).toContain(`entryId: ${entry.id}`);
    expect(prompt).not.toContain(secret);
    const after = runtime.harness.getConversation(first.conversation.id);
    expect(after.conversation.pendingReferences).toBeUndefined();
    expect(after.items.find((i) => i.kind === 'user-message')).toMatchObject({
      text: '接着整理这份笔记',
      references: [{ entryId: entry.id }],
    });

    // An entry in the trash cannot be continued.
    await client.request('space.trash', { entryId: entry.id });
    const trashed = await rejection(client.request('space.continueInConversation', { entryId: entry.id }));
    expect(trashed.details).toMatchObject({ code: 'SPACE_ENTRY_TRASHED' });
  });

  it('media handle detects unknown formats by content, no extension and disguised extension, HTTP type matches metadata', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const examples = [
      { name: 'README', data: Buffer.from('中文 English\n'), kind: 'text', mime: 'text/plain; charset=utf-8' },
      { name: '说明.abc', data: Buffer.from('notes\n'), kind: 'text', mime: 'text/plain; charset=utf-8' },
      { name: 'model.bin', data: Buffer.from([0, 1, 2, 3]), kind: 'binary', mime: 'application/octet-stream' },
      { name: 'fake.txt', data: Buffer.from('%PDF-1.7\nfixture'), kind: 'pdf', mime: 'application/pdf' },
    ];
    for (const item of examples) {
      await fs.writeFile(path.join(conversation.cwd, item.name), item.data);
      const handle = await client.request('media.resolve', { conversationId: conversation.id, path: item.name });
      expect(handle).toMatchObject({ contentKind: item.kind, mimeType: item.mime, size: item.data.length });
      const response = await fetch(handle.url);
      expect(response.headers.get('content-type')).toBe(item.mime);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(item.data);
      const download = await fetch(`${handle.url}?download=1`);
      expect(download.headers.get('content-disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent(item.name)}`);
      expect(Buffer.from(await download.arrayBuffer())).toEqual(item.data);
    }
    expect((await rejection(client.request('media.resolve', { conversationId: conversation.id, path: 'missing.abc' }))).code).toBe('not-found');
  });

  it('media URL is only given for files inside the session\'s working directory', async () => {
    const outside = path.join(dir, 'secret.txt');
    await fs.writeFile(outside, 'secret');
    const { conversation } = await client.request('conversations.create', {});
    await fs.writeFile(path.join(conversation.cwd, 'ok.txt'), 'ok');
    await fs.symlink(outside, path.join(conversation.cwd, 'link.txt'));

    const ok = await client.request('media.resolve', { conversationId: conversation.id, path: 'ok.txt' });
    expect(await (await fetch(ok.url)).text()).toBe('ok');
    expect((await rejection(client.request('media.resolve', { conversationId: conversation.id, path: '../../secret.txt' }))).code).toBe(
      'forbidden',
    );
    expect((await rejection(client.request('media.resolve', { conversationId: conversation.id, path: outside }))).code).toBe('forbidden');
    expect((await rejection(client.request('media.resolve', { conversationId: conversation.id, path: 'link.txt' }))).code).toBe(
      'forbidden',
    );
    expect((await rejection(client.request('media.resolve', { conversationId: conversation.id, path: 'nope.txt' }))).code).toBe(
      'not-found',
    );
    const mixed = await rejection(
      client.request('media.resolve', { entryId: 'sp_x', conversationId: conversation.id, path: 'ok.txt' } as never),
    );
    expect(mixed.code).toBe('invalid-request');
  });

  it('slides (slides.open): a deck in the session working directory gives the editor URL on the gateway; no escaping, does not follow symbolic links out; when the editor isn\'t built, the address is still given and the page returns 503', async () => {
    client.close();
    await runtime.close();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      slidesEditorDist: null,
    });
    client = await connect();
    const { conversation } = await client.request('conversations.create', {});
    const metadata = JSON.stringify({ v: 4, title: ' Q3 ', order: ['a', 'b'] });
    await fs.mkdir(path.join(conversation.cwd, 'deck', 'slides'), { recursive: true });
    await fs.writeFile(path.join(conversation.cwd, 'deck', 'deck.json'), metadata);
    const outside = path.join(dir, 'outside-deck');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'deck.json'), metadata);
    await fs.symlink(outside, path.join(conversation.cwd, 'link'));
    await fs.mkdir(path.join(conversation.cwd, 'node_modules', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(conversation.cwd, 'node_modules', 'pkg', 'deck.json'), metadata);
    await fs.mkdir(path.join(conversation.cwd, 'empty'));

    const opened = await client.request('slides.open', { conversationId: conversation.id, path: 'deck' });
    expect(opened).toMatchObject({ deck: { title: 'Q3', slideCount: 2 }, editorAvailable: false });
    const gateway = runtime.discovery.endpoint.replace('ws:', 'http:');
    expect(opened.url).toMatch(new RegExp(`^${gateway}/slides/[A-Za-z0-9_-]{32}/$`));
    expect((await client.request('slides.open', { conversationId: conversation.id, path: './deck/' })).url).toBe(opened.url);
    expect((await fetch(opened.url)).status).toBe(503);
    expect(Object.keys(((await (await fetch(`${opened.url}_files.json`)).json()) as { files: object }).files)).toEqual(['project/deck.json']);

    // In Space, a deck directory is a slide entry; opening it from the entry gives the same address.
    await runtime.space.ready;
    await client.request('space.rescan', {});
    const entries = runtime.space.snapshot().entries.filter((e) => e.source.conversationId === conversation.id);
    expect(entries).toEqual([expect.objectContaining({ kind: 'slides', relPath: 'deck', name: 'Q3', deck: { slideCount: 2 } })]);
    expect((await client.request('slides.open', { entryId: entries[0]!.id })).url).toBe(opened.url);

    const cases: [string, string][] = [
      ['../outside-deck', 'invalid-request'],
      [outside, 'invalid-request'],
      ['link', 'invalid-request'],
      ['node_modules/pkg', 'invalid-request'],
      ['deck/deck.json', 'invalid-request'],
      ['empty', 'invalid-request'],
      ['missing', 'not-found'],
    ];
    for (const [target, code] of cases) {
      expect((await rejection(client.request('slides.open', { conversationId: conversation.id, path: target }))).code, target).toBe(code);
    }
    expect((await rejection(client.request('slides.open', { conversationId: conversation.id, path: 'empty' }))).details).toEqual({
      code: 'SLIDES_NOT_A_DECK',
    });
  });

  it('design (design.open): a design in the session working directory gives the editor URL on the gateway; validation same as slides.open; when the editor isn\'t built, still gives URL, page 503', async () => {
    client.close();
    await runtime.close();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      slidesEditorDist: null,
      designEditorDist: null,
    });
    client = await connect();
    const { conversation } = await client.request('conversations.create', {});
    const metadata = JSON.stringify({ v: 3, title: ' Spring Poster ', boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 } }, order: ['Main.dc.html'] });
    const poster = path.join(conversation.cwd, 'poster');
    await fs.mkdir(path.join(poster, 'screens'), { recursive: true });
    await fs.writeFile(path.join(poster, 'canvas.json'), metadata);
    await fs.writeFile(path.join(poster, 'Main.dc.html'), '<x-dc></x-dc>');
    await fs.writeFile(path.join(poster, 'screens', 'Cart.dc.html'), '<x-dc></x-dc>');
    const outside = path.join(dir, 'outside-canvas');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'canvas.json'), metadata);
    await fs.symlink(outside, path.join(conversation.cwd, 'link'));
    await fs.mkdir(path.join(conversation.cwd, 'old'));
    await fs.writeFile(path.join(conversation.cwd, 'old', 'canvas.json'), JSON.stringify({ v: 2, boards: {} }));

    const opened = await client.request('design.open', { conversationId: conversation.id, path: 'poster' });
    expect(opened).toMatchObject({ canvas: { title: 'Spring Poster', boardCount: 1 }, editorAvailable: false });
    const gateway = runtime.discovery.endpoint.replace('ws:', 'http:');
    expect(opened.url).toMatch(new RegExp(`^${gateway}/design/[A-Za-z0-9_-]{32}/$`));
    expect((await client.request('design.open', { conversationId: conversation.id, path: './poster/' })).url).toBe(opened.url);
    const page = await fetch(opened.url);
    expect(page.status).toBe(503);
    expect(await page.text()).toBe('Design editor is not built');
    const listing = (await (await fetch(`${opened.url}_files.json`)).json()) as { files: object };
    expect(Object.keys(listing.files).sort()).toEqual(['project/Main.dc.html', 'project/canvas.json', 'project/screens/Cart.dc.html']);
    // A grant is valid only for the kind that issued it.
    expect((await fetch(opened.url.replace('/design/', '/slides/'))).status).toBe(404);

    // In Space, a design canvas directory is a design entry; opening it from the entry gives the same address. The artboards inside are not separate entries.
    await runtime.space.ready;
    await client.request('space.rescan', {});
    const entries = runtime.space.snapshot().entries.filter((e) => e.source.conversationId === conversation.id && e.relPath.startsWith('poster'));
    expect(entries).toEqual([expect.objectContaining({ kind: 'design', relPath: 'poster', name: 'Spring Poster', canvas: { boardCount: 1 } })]);
    expect((await client.request('design.open', { entryId: entries[0]!.id })).url).toBe(opened.url);
    const files = await client.request('projects.files.list', { conversationId: conversation.id });
    expect(files.entries.find((e) => e.path === 'poster')).toMatchObject({ isDir: true, kind: 'design' });
    expect(files.entries.some((e) => e.path.startsWith('poster/'))).toBe(false);

    const cases: [string, string][] = [
      ['../outside-canvas', 'invalid-request'],
      [outside, 'invalid-request'],
      ['link', 'invalid-request'],
      ['poster/canvas.json', 'invalid-request'],
      ['old', 'invalid-request'],
      ['missing', 'not-found'],
    ];
    for (const [target, code] of cases) {
      expect((await rejection(client.request('design.open', { conversationId: conversation.id, path: target }))).code, target).toBe(code);
    }
    expect((await rejection(client.request('design.open', { conversationId: conversation.id, path: 'old' }))).details).toEqual({
      code: 'DESIGN_NOT_A_CANVAS',
    });
  });

  it('design system (designSystem.open): a design system in the session working directory gives the editor URL on the gateway; validation same as design.open; when the editor isn\'t built, still gives URL, page 503', async () => {
    client.close();
    await runtime.close();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      slidesEditorDist: null,
      designEditorDist: null,
      designSystemEditorDist: null,
    });
    client = await connect();
    const { conversation } = await client.request('conversations.create', {});
    const index = JSON.stringify({ v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-10-11T00:00:00Z' }, title: ' Acme ', namespace: 'Acme' });
    const brand = path.join(conversation.cwd, 'brand');
    await fs.mkdir(path.join(brand, 'assets', 'Logos'), { recursive: true });
    await fs.mkdir(path.join(brand, '_blobs'), { recursive: true });
    await fs.writeFile(path.join(brand, 'design-system.json'), index);
    await fs.writeFile(path.join(brand, 'README.md'), '# Acme');
    await fs.writeFile(path.join(brand, 'assets', 'Logos', 'mark.svg'), '<svg/>');
    await fs.writeFile(path.join(brand, '_blobs', `${'ab'.repeat(16)}.png`), 'png');
    const outside = path.join(dir, 'outside-system');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'design-system.json'), index);
    await fs.symlink(outside, path.join(conversation.cwd, 'link'));
    await fs.mkdir(path.join(conversation.cwd, 'old'));
    await fs.writeFile(path.join(conversation.cwd, 'old', 'design-system.json'), JSON.stringify({ v: 2, content: { files: {} } }));

    const opened = await client.request('designSystem.open', { conversationId: conversation.id, path: 'brand' });
    expect(opened).toEqual({ url: expect.any(String), system: { title: 'Acme', namespace: 'Acme' }, editorAvailable: false });
    const gateway = runtime.discovery.endpoint.replace('ws:', 'http:');
    expect(opened.url).toMatch(new RegExp(`^${gateway}/design-system/[A-Za-z0-9_-]{32}/$`));
    expect((await client.request('designSystem.open', { conversationId: conversation.id, path: './brand/' })).url).toBe(opened.url);
    const page = await fetch(opened.url);
    expect(page.status).toBe(503);
    expect(await page.text()).toBe('Design system editor is not built');
    const listing = (await (await fetch(`${opened.url}_files.json`)).json()) as { files: object };
    expect(Object.keys(listing.files).sort()).toEqual(['project/README.md', 'project/assets/Logos/mark.svg', 'project/design-system.json']);
    expect((await fetch(`${opened.url}_blob/${'ab'.repeat(16)}`)).status).toBe(200);
    // A grant is valid only for the kind that issued it.
    expect((await fetch(opened.url.replace('/design-system/', '/design/'))).status).toBe(404);
    expect((await fetch(opened.url.replace('/design-system/', '/slides/'))).status).toBe(404);

    // In Space, a design system directory is a design system entry (its name is the title); opening it from the entry gives the same address. The files inside are not separate entries.
    await runtime.space.ready;
    await client.request('space.rescan', {});
    const entries = runtime.space.snapshot().entries.filter((e) => e.source.conversationId === conversation.id && e.relPath.startsWith('brand'));
    expect(entries).toEqual([expect.objectContaining({ kind: 'design-system', relPath: 'brand', name: 'Acme' })]);
    expect((await client.request('designSystem.open', { entryId: entries[0]!.id })).url).toBe(opened.url);
    const files = await client.request('projects.files.list', { conversationId: conversation.id });
    expect(files.entries.find((e) => e.path === 'brand')).toMatchObject({ isDir: true, kind: 'design-system' });
    expect(files.entries.some((e) => e.path.startsWith('brand/'))).toBe(false);

    const cases: [string, string][] = [
      ['../outside-system', 'invalid-request'],
      [outside, 'invalid-request'],
      ['link', 'invalid-request'],
      ['brand/design-system.json', 'invalid-request'],
      ['old', 'invalid-request'],
      ['missing', 'not-found'],
    ];
    for (const [target, code] of cases) {
      expect((await rejection(client.request('designSystem.open', { conversationId: conversation.id, path: target }))).code, target).toBe(code);
    }
    expect((await rejection(client.request('designSystem.open', { conversationId: conversation.id, path: 'old' }))).details).toEqual({
      code: 'DESIGN_SYSTEM_NOT_A_SYSTEM',
    });
  });

  it('local file ({ localPath }): only sent to desktop client, rooted at the file\'s own directory, only regular files', async () => {
    const downloads = path.join(dir, 'Downie');
    await fs.mkdir(path.join(downloads, 'folder'), { recursive: true });
    const article = path.join(downloads, 'talk.blog.zh-CN.md');
    await fs.writeFile(article, '# 标题\n');
    await fs.writeFile(path.join(dir, 'secret.txt'), 'secret');
    await fs.symlink(path.join(dir, 'secret.txt'), path.join(downloads, 'link.md'));
    const { endpoint, token } = runtime.discovery;
    const desktop = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'desktop', name: 'test', version: '0' }, reconnect: false });
    await desktop.connect();
    try {
      const handle = await desktop.request('media.resolve', { localPath: article });
      expect(handle).toMatchObject({ fileName: 'talk.blog.zh-CN.md', contentKind: 'text', size: Buffer.byteLength('# 标题\n') });
      expect(await (await fetch(handle.url)).text()).toBe('# 标题\n');
      // A directory, a nonexistent path, or a relative path is not issued. A symlink pointing into another directory is rejected by its real path.
      expect((await rejection(desktop.request('media.resolve', { localPath: path.join(downloads, 'folder') }))).code).toBe('not-found');
      expect((await rejection(desktop.request('media.resolve', { localPath: path.join(downloads, 'nope.md') }))).code).toBe('not-found');
      expect((await rejection(desktop.request('media.resolve', { localPath: 'talk.blog.zh-CN.md' }))).code).toBe('not-found');
      expect((await rejection(desktop.request('media.resolve', { localPath: path.join(downloads, 'link.md') }))).code).toBe('forbidden');
      // Cannot be mixed with other locations.
      expect((await rejection(desktop.request('media.resolve', { localPath: article, entryId: 'sp_x' } as never))).code).toBe('invalid-request');
    } finally {
      desktop.close();
    }
    // Not the desktop client (CLI): rejected under the original access scope.
    expect((await rejection(client.request('media.resolve', { localPath: article }))).code).toBe('forbidden');
  });

  it('subtitles: lists subtitle files in the same directory as the video, same-named first; location can be a path in the project', async () => {
    const project = path.join(dir, 'film');
    await fs.mkdir(path.join(project, 'clips'), { recursive: true });
    for (const name of ['talk.mp4', 'talk.en.vtt', 'talk.srt', 'talk.zh.vtt', 'other.ass', 'notes.txt', '.hidden.srt', 'talkshow.srt']) {
      await fs.writeFile(path.join(project, 'clips', name), name);
    }
    const { project: opened } = await client.request('projects.open', { path: project });

    const { tracks } = await client.request('media.subtitles', { projectId: opened.id, path: 'clips/talk.mp4' });
    expect(tracks.map((t) => [t.fileName, t.matched, t.tag])).toEqual([
      ['talk.srt', true, null],
      ['talk.en.vtt', true, 'en'],
      ['talk.zh.vtt', true, 'zh'],
      ['other.ass', false, null],
      ['talkshow.srt', false, null],
    ]);
    expect(tracks[2]!.target).toEqual({ projectId: opened.id, path: 'clips/talk.zh.vtt' });
    const handle = await client.request('media.resolve', tracks[2]!.target);
    expect(await (await fetch(handle.url)).text()).toBe('talk.zh.vtt');

    // From a Space entry: the subtitle's location falls on the entry's project.
    let space: SpaceSnapshot | null = null;
    client.subscribeSpace({
      snapshot: (snapshot) => {
        space = snapshot;
      },
      event: (event) => {
        if (space) space = applySpaceEvent(space, event);
      },
    });
    await client.request('space.rescan', {});
    const video = await until(() => space?.entries.find((e) => e.relPath === 'clips/talk.mp4'));
    const viaEntry = await client.request('media.subtitles', { entryId: video.id });
    expect(viaEntry.tracks[0]!.target).toEqual({ projectId: opened.id, path: 'clips/talk.srt' });

    const { conversation } = await client.request('conversations.create', { projectId: opened.id });
    const viaConversation = await client.request('media.subtitles', { conversationId: conversation.id, path: 'clips/talk.mp4' });
    expect(viaConversation.tracks[0]!.target).toEqual({ conversationId: conversation.id, path: 'clips/talk.srt' });

    await fs.writeFile(path.join(dir, 'outside.mp4'), 'x');
    expect((await rejection(client.request('media.subtitles', { projectId: opened.id, path: '../outside.mp4' }))).code).toBe('forbidden');
    expect((await rejection(client.request('media.subtitles', { projectId: 'proj_nope', path: 'clips/talk.mp4' }))).code).toBe('not-found');
  });

  it('preferences: defaults, whole-batch validation, null restores default; theme gives snapshot first then sends changes', async () => {
    let mirror: SettingsSnapshot | null = null;
    const events: SettingsEvent[] = [];
    client.subscribeSettings({
      snapshot: (snapshot) => {
        mirror = snapshot;
      },
      event: (event) => {
        events.push(event);
        if (mirror) mirror = applySettingsEvent(mirror, event);
      },
    });
    const initial = await until(() => mirror);
    expect(initial).toEqual({ settings: SETTING_DEFAULTS, defaults: SETTING_DEFAULTS });

    const all = await client.request('settings.get', {});
    expect(all.settings).toEqual(SETTING_DEFAULTS);
    const some = await client.request('settings.get', { keys: ['offline.strict'] });
    expect(some).toEqual({ settings: { 'offline.strict': false }, defaults: { 'offline.strict': false } });
    expect((await rejection(client.request('settings.get', { keys: ['nope' as 'offline.strict'] }))).code).toBe('invalid-request');

    // One bad value makes the whole batch take no effect, and nothing is written to disk.
    const settingsFile = path.join(dir, 'store', 'settings.json');
    const bad = await rejection(
      client.request('settings.set', { values: { 'offline.strict': true, 'agent.defaultAccessMode': 'nope' as 'plan' } }),
    );
    expect(bad.code).toBe('invalid-request');
    const unknown = await rejection(client.request('settings.set', { values: { 'openai.apiKey': 'sk-test' } as never }));
    expect(unknown.code).toBe('invalid-request');
    expect(fsSync.existsSync(settingsFile)).toBe(false);

    const updated = await client.request('settings.set', {
      values: { 'offline.strict': true, 'captions.maxLineLength': { cjk: 18, other: 40 } },
    });
    expect(updated.settings).toMatchObject({ 'offline.strict': true, 'captions.maxLineLength': { cjk: 18, other: 40 } });
    expect(updated.defaults).toEqual(SETTING_DEFAULTS);
    await until(() => events.length === 1);
    expect(events[0]).toEqual({
      type: 'settings.updated',
      changed: { 'offline.strict': true, 'captions.maxLineLength': { cjk: 18, other: 40 } },
    });

    // A change with no effect emits no event; null restores the default.
    await client.request('settings.set', { values: { 'offline.strict': true } });
    const reset = await client.request('settings.set', { values: { 'offline.strict': null } });
    expect(reset.settings['offline.strict']).toBe(false);
    await until(() => events.length === 2);
    expect(events[1]).toEqual({ type: 'settings.updated', changed: { 'offline.strict': false } });
    expect(mirror).toEqual(reset);
  });

  it('preferences: kept across restarts', async () => {
    await client.request('settings.set', { values: { 'updates.autoCheck': false, 'downloads.directory': '/tmp/cuccut-downloads' } });
    client.close();
    await runtime.close();
    runtime = await startRuntime({ home: resolveRuntimeHome({ CUCCUT_HOME: dir }), drivers: () => [driver], watchSpace: false });
    client = await connect();
    const { settings } = await client.request('settings.get', { keys: ['updates.autoCheck', 'downloads.directory', 'offline.strict'] });
    expect(settings).toEqual({ 'updates.autoCheck': false, 'downloads.directory': '/tmp/cuccut-downloads', 'offline.strict': false });
  });

  it('session record with an old access mode: after restart, the session\'s mode and task card mode replaced with the new value', async () => {
    const { conversation } = await client.request('conversations.create', {});
    const { taskId } = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'hello',
      commandId: newId('cmd'),
    });
    await until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'idle');
    client.close();
    await runtime.close();

    // Records written by an old version: the session carries the old value, and so does the task card.
    const conversationsDir = resolveRuntimeHome({ CUCCUT_HOME: dir }).conversationsDir;
    const store = new ConversationStore(conversationsDir);
    await store.load();
    const record = JSON.parse(JSON.stringify(store.get(conversation.id)));
    record.conversation.accessMode = 'authorized';
    for (const item of record.items) if (item.kind === 'task') item.autonomy = { mode: 'controlled', source: 'request' };
    await fs.rm(path.join(conversationsDir, `${conversation.id}.jsonl`));
    await fs.writeFile(path.join(conversationsDir, `${conversation.id}.json`), JSON.stringify(record));

    runtime = await startRuntime({ home: resolveRuntimeHome({ CUCCUT_HOME: dir }), drivers: () => [driver], watchSpace: false });
    client = await connect();
    const loaded = await client.request('conversations.get', { conversationId: conversation.id });
    expect(loaded.conversation.accessMode).toBe('fullAccess');
    expect(loaded.items.find((i) => i.id === taskId)).toMatchObject({ autonomy: { mode: 'ask', source: 'request' } });
    expect(runtime.harness.conversationMode(conversation.id)).toBe('fullAccess');
  });

  it('new session reads default driver: creation rejected if the set engine is not registered', async () => {
    await client.request('settings.set', { values: { 'agent.defaultDriver': 'claude' } });
    expect((await rejection(client.request('conversations.create', {}))).code).toBe('driver-unavailable');
    expect(runtime.harness.directorySnapshot().conversations).toHaveLength(0);

    await client.request('settings.set', { values: { 'agent.defaultDriver': 'codex' } });
    const { conversation } = await client.request('conversations.create', {});
    expect(conversation.driverId).toBe('codex');
  });

  it('driver without integration tests (D08): selectable, but sending is rejected, no native session opened', async () => {
    client.close();
    await runtime.close();
    const created: CreateSessionOptions[] = [];
    const gemini: AgentDriver = {
      id: 'gemini',
      verified: false,
      probe: async () => ({ ...fakeProbe(capabilities), id: 'gemini', name: 'Gemini CLI', verified: false }),
      createSession: async (options) => {
        created.push(options);
        return new FakeSession();
      },
    };
    runtime = await startRuntime({ home: resolveRuntimeHome({ CUCCUT_HOME: dir }), drivers: () => [driver, gemini], watchSpace: false });
    client = await connect();
    await client.request('settings.set', { values: { 'agent.defaultDriver': 'gemini' } });
    const { conversation } = await client.request('conversations.create', {});
    expect(conversation.driverId).toBe('gemini');
    const error = await rejection(
      client.request('conversations.send', { conversationId: conversation.id, text: 'hello', commandId: newId('cmd') }),
    );
    expect(error.code).toBe('driver-unavailable');
    expect(error.message).toContain('Gemini CLI');
    expect(created).toEqual([]);
  });

  it('new task reads default access mode and records the source; an explicitly given mode on send takes precedence and switches the session\'s mode', async () => {
    const { conversation } = await client.request('conversations.create', {});
    expect(conversation.accessMode).toBeNull();
    const taskOf = (taskId: Id) => runtime.harness.getConversation(conversation.id).items.find((i) => i.id === taskId);
    const idle = () => until(() => runtime.harness.getConversation(conversation.id).conversation.activity === 'idle');

    const first = await client.request('conversations.send', { conversationId: conversation.id, text: 'hello', commandId: newId('cmd') });
    expect(taskOf(first.taskId)).toMatchObject({ autonomy: { mode: 'auto', source: 'default' } });
    await idle();

    // The old value `authorized` is stored as fullAccess. The session was never switched, so it follows the setting. Commands are auto-approved, and the turn completes as usual.
    await client.request('settings.set', { values: { 'agent.defaultAccessMode': 'authorized' } });
    const second = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'approve',
      commandId: newId('cmd'),
    });
    expect(taskOf(second.taskId)).toMatchObject({ autonomy: { mode: 'fullAccess', source: 'setting' } });
    expect(runtime.harness.agentRun(conversation.id)).toMatchObject({ mode: 'fullAccess', autonomy: 'fullAccess' });
    await until(() => driver.sessions.at(-1)?.turnModes.at(-1) === 'fullAccess');
    await idle();
    expect(runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'approval')).toMatchObject({
      status: 'accepted',
      decidedBy: 'auto',
      mode: 'fullAccess',
      risk: 'command',
    });

    // A mode given when sending (here the old field `autonomy`): the session switches to plan and a hint is recorded. Afterwards, when no mode is given, the session's mode is used.
    const third = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'hello',
      commandId: newId('cmd'),
      autonomy: 'plan',
    });
    expect(taskOf(third.taskId)).toMatchObject({ autonomy: { mode: 'plan', source: 'request' } });
    expect(runtime.harness.getConversation(conversation.id).conversation.accessMode).toBe('plan');
    expect(runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'notice')).toMatchObject({
      modeChange: { from: 'fullAccess', to: 'plan' },
    });
    await idle();

    const fourth = await client.request('conversations.send', { conversationId: conversation.id, text: 'hello', commandId: newId('cmd') });
    expect(taskOf(fourth.taskId)).toMatchObject({ autonomy: { mode: 'plan', source: 'conversation' } });
    await idle();

    // The old value `controlled` means ask.
    const fifth = await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'hello',
      commandId: newId('cmd'),
      autonomy: 'controlled',
    });
    expect(taskOf(fifth.taskId)).toMatchObject({ autonomy: { mode: 'ask', source: 'request' } });
    await idle();

    // conversations.update with null: back to following the setting.
    const { conversation: back } = await client.request('conversations.update', { conversationId: conversation.id, accessMode: null });
    expect(back.accessMode).toBeNull();
    expect(runtime.harness.conversationMode(conversation.id)).toBe('fullAccess');
  });
});

describe('Runtime startup failure', () => {
  let dir: string;
  let home: RuntimeHome;
  let blocker: net.Server | null = null;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const server = blocker;
    blocker = null;
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** Occupies a loopback port and returns the port number. */
  async function occupyPort(): Promise<number> {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    blocker = server;
    return (server.address() as net.AddressInfo).port;
  }

  function boot(options: Partial<StartRuntimeOptions> = {}): Promise<RunningRuntime> {
    return startRuntime({
      home,
      drivers: () => [new FakeDriver()],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
      initiator: { discoverer: null },
      ...options,
      nodes: { host: '127.0.0.1', advertiser: null, ...options.nodes },
    });
  }

  /** If it has not settled within the deadline, it counts as a failure. Before the fix, startup hung forever when the gateway port was taken. */
  async function startupError(promise: Promise<RunningRuntime>, ms = 3_000): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`启动在 ${ms} 毫秒内没有落定`)), ms);
    });
    let started: RunningRuntime;
    try {
      started = await Promise.race([promise, timeout]);
    } catch (error) {
      return error;
    } finally {
      clearTimeout(timer);
    }
    await started.close();
    throw new Error('启动应该失败');
  }

  it('gateway port in use: startup fails with original error, does not write discovery file, releases instance lock; starting again on another port works', async () => {
    const taken = await occupyPort();
    const error = await startupError(boot({ host: '127.0.0.1', port: taken }));
    expect(error).toMatchObject({ code: 'EADDRINUSE' });
    expect((error as Error).message).toContain(String(taken));
    expect(await readDiscovery(home)).toBeNull();
    expect(await fs.readFile(path.join(home.logsDir, 'runtime.log'), 'utf8')).toContain('Runtime failed to start');

    const runtime = await boot({ host: '127.0.0.1', port: 0 });
    try {
      expect((await readDiscovery(home))?.instanceId).toBe(runtime.info.instanceId);
    } finally {
      await runtime.close();
    }
  });

  /** Records the order in which each service's stop method is called (the original method still runs). */
  function recordStops(): string[] {
    const calls: string[] = [];
    const track = (name: string, proto: object, method: string) => {
      const original = (proto as Record<string, (...args: unknown[]) => unknown>)[method]!;
      vi.spyOn(proto as Record<string, (...args: unknown[]) => unknown>, method).mockImplementation(function (this: unknown, ...args) {
        calls.push(name);
        return original.apply(this, args);
      });
    };
    track('services', ServiceManager.prototype, 'close');
    track('nodes', NodeService.prototype, 'close');
    track('publishing', PublishingService.prototype, 'close');
    track('jobs', JobManager.prototype, 'shutdown');
    track('initiator', NodeInitiator.prototype, 'close');
    track('space', SpaceCatalog.prototype, 'close');
    track('analysis', MediaAnalysis.prototype, 'close');
    track('videos', VideoService.prototype, 'shutdown');
    track('harness', Harness.prototype, 'shutdown');
    track('gateway', Gateway.prototype, 'close');
    return calls;
  }

  /** Records the directory watches Space opened (they do not block process exit and are not visible in `getActiveResourcesInfo`), and returns those not yet closed. */
  function trackWatchers(): { opened: () => number; open: Set<fsSync.FSWatcher> } {
    const open = new Set<fsSync.FSWatcher>();
    let opened = 0;
    const original = fsSync.watch;
    vi.spyOn(fsSync, 'watch').mockImplementation(((...args: Parameters<typeof fsSync.watch>) => {
      const watcher = original(...args);
      opened++;
      open.add(watcher);
      const close = watcher.close.bind(watcher);
      watcher.close = () => {
        open.delete(watcher);
        close();
      };
      return watcher;
    }) as typeof fsSync.watch);
    return { opened: () => opened, open };
  }

  /** This process's child processes (the engine, Model Worker, and so on). */
  async function childProcesses(): Promise<string[]> {
    try {
      const { stdout } = await promisify(execFile)('pgrep', ['-P', String(process.pid)]);
      return stdout.split('\n').filter(Boolean);
    } catch (error) {
      // pgrep exits with code 1 when it finds nothing.
      if ((error as { code?: number }).code === 1) return [];
      throw error;
    }
  }

  async function portFree(port: number): Promise<boolean> {
    const probe = net.createServer();
    return new Promise((resolve) => {
      probe.once('error', () => resolve(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
    });
  }

  async function freePort(): Promise<number> {
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise((resolve) => probe.close(resolve));
    return port;
  }

  /** Prepares a Runtime Home with sharing on (the node service listens on `sharePort`) and one project directory. */
  async function prepareHome(): Promise<{ sharePort: number }> {
    const sharePort = await freePort();
    const runtime = await boot();
    await runtime.harness.createProject({ name: '短片' });
    await runtime.nodes.start({ port: sharePort });
    expect(runtime.nodes.port).toBe(sharePort);
    await runtime.close();
    return { sharePort };
  }

  const STARTED_STOPS = ['services', 'nodes', 'publishing', 'jobs', 'initiator', 'space', 'analysis', 'videos', 'harness', 'gateway'];

  it('normal stop order: external services, node service, publishing, tasks, initiator, Library, media analysis, video engine, Harness, gateway', async () => {
    await prepareHome();
    const runtime = await boot({ watchSpace: true });
    const calls = recordStops();
    await runtime.close();
    expect(calls).toEqual(STARTED_STOPS);
  });

  it('last startup step fails (gateway port taken): services already started are all stopped in stop order, original error thrown', async () => {
    const { sharePort } = await prepareHome();
    const taken = await occupyPort();
    const watchers = trackWatchers();
    const calls = recordStops();

    const error = await startupError(boot({ host: '127.0.0.1', port: taken, watchSpace: true }));
    expect(error).toMatchObject({ code: 'EADDRINUSE' });
    expect(calls).toEqual(STARTED_STOPS);
    // Space did open directory watches, and all of them were closed after the failure.
    expect(watchers.opened()).toBeGreaterThan(0);
    expect(watchers.open.size).toBe(0);
    expect(await portFree(sharePort)).toBe(true);
    expect(await childProcesses()).toEqual([]);
    expect(await readDiscovery(home)).toBeNull();

    vi.restoreAllMocks();
    const runtime = await boot({ watchSpace: true });
    try {
      expect(runtime.nodes.port).toBe(sharePort);
    } finally {
      await runtime.close();
    }
  });

  it('startup fails midway (Library marker file unreadable): services already started are stopped, not-yet-started ones untouched', async () => {
    const { sharePort } = await prepareHome();
    // It cannot be read at the filesystem level (here, a same-named directory): it is not treated as a bad file to rename, so startup fails.
    await fs.mkdir(home.spaceFile, { recursive: true });
    const calls = recordStops();

    const error = await startupError(boot({ watchSpace: true }));
    expect(error).toMatchObject({ code: 'EISDIR' });
    expect(calls).toEqual(['services', 'nodes', 'publishing', 'jobs', 'initiator', 'analysis', 'videos', 'harness']);
    expect(await portFree(sharePort)).toBe(true);
    expect(await childProcesses()).toEqual([]);
    expect(await readDiscovery(home)).toBeNull();

    vi.restoreAllMocks();
    await fs.rm(home.spaceFile, { recursive: true });
    const runtime = await boot();
    await runtime.close();
  });

  it('Library marker file not JSON: renamed and kept, startup continues normally', async () => {
    await prepareHome();
    await fs.writeFile(home.spaceFile, '{ 损坏');
    const runtime = await boot();
    await runtime.close();
    const names = await fs.readdir(path.dirname(home.spaceFile));
    expect(names.some((n) => n.startsWith(`${path.basename(home.spaceFile)}.corrupt-`))).toBe(true);
  });

  it('a stop step errors: later steps still run, the thrown error is still the original startup failure', async () => {
    const { sharePort } = await prepareHome();
    const taken = await occupyPort();
    const shutdown = Harness.prototype.shutdown;
    const calls = recordStops();
    vi.spyOn(Harness.prototype, 'shutdown').mockImplementation(async function (this: Harness) {
      calls.push('harness');
      await shutdown.call(this);
      throw new Error('Harness 停不下来');
    });

    const error = await startupError(boot({ host: '127.0.0.1', port: taken }));
    expect(error).toMatchObject({ code: 'EADDRINUSE' });
    expect(calls).toEqual(STARTED_STOPS);
    expect(await portFree(sharePort)).toBe(true);
    expect(await fs.readFile(path.join(home.logsDir, 'runtime.log'), 'utf8')).toContain('Stopping the Harness failed');

    vi.restoreAllMocks();
    const runtime = await boot();
    await runtime.close();
  });
});

describe('Runtime launched by CLI (§2.2)', () => {
  let dir: string;
  let home: RuntimeHome;
  let runtime: RunningRuntime | null = null;
  const clients: CucCutClient[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    home = resolveRuntimeHome({ CUCCUT_HOME: dir });
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    await runtime?.close();
    runtime = null;
    await fs.rm(dir, { recursive: true, force: true });
  });

  function boot(options: Partial<StartRuntimeOptions>): Promise<RunningRuntime> {
    return startRuntime({
      home,
      drivers: () => [new FakeDriver()],
      watchSpace: false,
      engineHost: null,
      modelWorker: null,
      initiator: { discoverer: null },
      nodes: { host: '127.0.0.1', advertiser: null },
      launchedBy: 'cli',
      ...options,
    });
  }

  async function connect(kind: 'cli' | 'desktop'): Promise<CucCutClient> {
    const { endpoint, token } = runtime!.discovery;
    const client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind, name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    clients.push(client);
    return client;
  }

  /** Waits until the disconnect has settled on the server side (the connection count changed) before continuing. */
  async function connectionsSettle(client: CucCutClient, done: (c: { desktop: number; cli: number }) => boolean): Promise<void> {
    const deadline = Date.now() + 3000;
    while (!done((await client.request('runtime.status', {})).connections)) {
      if (Date.now() > deadline) throw new Error('等待超时');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  it('runtime.stop: RUNTIME_IN_USE when CLI or desktop is connected besides the caller; stops only when it is just self', async () => {
    const requestStop = vi.fn();
    runtime = await boot({ requestStop });
    const caller = await connect('cli');
    const other = await connect('cli');

    const busy = await caller.request('runtime.stop', {}).catch((error: unknown) => error);
    expect(busy).toBeInstanceOf(RpcError);
    expect((busy as RpcError).details).toMatchObject({ code: 'RUNTIME_IN_USE', cli: 1, desktop: 0, activeJobs: 0 });

    other.close();
    await connectionsSettle(caller, (c) => c.cli === 1);
    const desktop = await connect('desktop');
    const withDesktop = await caller.request('runtime.stop', {}).catch((error: unknown) => error);
    expect((withDesktop as RpcError).details).toMatchObject({ code: 'RUNTIME_IN_USE', desktop: 1, cli: 0 });

    desktop.close();
    await connectionsSettle(caller, (c) => c.desktop === 0);
    await expect(caller.request('runtime.stop', {})).resolves.toEqual({ stopping: true });
    await until(() => requestStop.mock.calls.length === 1);
  });

  it('idle exit: delete discovery file first, then hand to the entry point to stop', async () => {
    let now = Date.parse('2026-10-06T00:00:00Z');
    let discoveryAtIdle: unknown = 'not-called';
    const onIdle = vi.fn(() => {
      discoveryAtIdle = fsSync.existsSync(home.discoveryFile);
    });
    runtime = await boot({ idleExit: { onIdle, checkMs: 10, now: () => now } });
    expect(fsSync.existsSync(home.discoveryFile)).toBe(true);
    now += 11 * 60_000;
    await until(() => onIdle.mock.calls.length === 1);
    expect(discoveryAtIdle).toBe(false);
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentMode } from '@cuccut/protocol';
import { silentLogger, type AgentEvent, type AgentItem, type AgentSession, type CreateSessionOptions } from '@cuccut/harness';
import { createFakePi, type FakePi, type FakePiScenario, type FakePiTool } from '../testing/fake-pi.ts';
import { PiDriver } from './pi-driver.ts';
import { piAccessWarning } from './pi-session.ts';

/**
 * Pi session against a fake pi: one turn's event mapping (text, thinking, tools), injection of developer instructions and MCP, model and effort, images, steer, interrupt, unexpected process exit, and resume. The fake pi reads its scenario when the process starts, so after changing the scenario, start a new session.
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
type ToolItem = Extract<AgentItem, { kind: 'tool-call' }>;

const TOOLS: FakePiTool[] = [
  {
    name: 'write',
    args: { path: 'hello.txt', content: 'one\ntwo\n' },
    result: { content: [{ type: 'text', text: 'Successfully wrote to hello.txt' }] },
  },
  {
    name: 'edit',
    args: { path: 'hello.txt', edits: [{ oldText: 'two', newText: 'three' }] },
    result: {
      content: [{ type: 'text', text: 'Successfully replaced 1 block(s) in hello.txt.' }],
      details: {
        diff: ' 1 one\n-2 two\n+2 three',
        patch: '--- hello.txt\n+++ hello.txt\n@@ -1,2 +1,2 @@\n one\n-two\n+three\n',
        firstChangedLine: 2,
      },
    },
  },
  {
    name: 'bash',
    args: { command: 'cat hello.txt; exit 3' },
    partial: 'one\n',
    result: {
      content: [{ type: 'text', text: 'one\nthree\n\n\nCommand exited with code 3' }],
      structuredContent: { output: 'one\nthree\n', truncated: false, exit_code: 3, wall_time_seconds: 0 },
      isError: true,
    },
    isError: true,
  },
  {
    name: 'read',
    args: { path: 'hello.txt' },
    result: { content: [{ type: 'text', text: 'one\nthree\n' }], structuredContent: 'one\nthree\n' },
  },
  {
    name: 'mcp__cuccut__project_read',
    args: { projectId: 'p1' },
    result: { content: [{ type: 'text', text: '{"ok":true}' }] },
  },
];

describe('PiSession (fake pi)', () => {
  let dir: string;
  let cwd: string;
  let fake: FakePi;
  let driver: PiDriver;
  const open: AgentSession[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pi-session-'));
    cwd = path.join(dir, 'project');
    await fs.mkdir(cwd);
    fake = await createFakePi(path.join(dir, 'fake'));
    driver = new PiDriver(silentLogger, { locate: fake.locate });
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function start(scenario: Partial<FakePiScenario> = {}, extra: Partial<CreateSessionOptions> = {}) {
    fake.scenario(scenario);
    const session = await driver.createSession({ cwd, accessMode: 'fullAccess', model: null, effort: null, resume: null, ...extra });
    open.push(session);
    const events: AgentEvent[] = [];
    session.subscribe((event) => events.push(event));
    const completed = (turnId: string) =>
      until(() => events.find((e): e is Completed => e.type === 'turn.completed' && e.turnId === turnId));
    const warnings = () => events.flatMap((e) => (e.type === 'session.warning' ? [e.message] : []));
    const items = () => events.flatMap((e) => (e.type === 'item.completed' ? [e.item] : []));
    return { session, events, completed, warnings, items };
  }

  const settings = (accessMode: AgentMode = 'fullAccess', model: string | null = null, effort: string | null = null) => ({
    accessMode,
    model,
    effort,
  });

  it('a turn: multiple model calls are merged into one turn; text and thinking arrive as deltas; tools map to commands, file changes (unified diff) and MCP', async () => {
    const { session, events, completed, items } = await start({ turn: { tools: TOOLS, thinking: 'hmm…', reply: 'All done.' } });
    expect(session.capabilities).toEqual({ steer: true, approvals: false, resume: true, images: true });
    const { turnId } = await session.startTurn({ text: 'do it' }, settings());
    const done = await completed(turnId);
    expect(done).toMatchObject({ outcome: 'completed', error: null, errorCode: null });
    expect(events.filter((e) => e.type === 'turn.started')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'turn.completed')).toHaveLength(1);
    expect(fake.commands('prompt')[0]).toMatchObject({ message: 'do it' });

    const tools = items().filter((i): i is ToolItem => i.kind === 'tool-call');
    expect(tools.map((t) => [t.tool, t.title, t.status, t.exitCode])).toEqual([
      ['file-change', 'hello.txt', 'completed', null],
      ['file-change', 'hello.txt', 'completed', null],
      ['command', 'cat hello.txt; exit 3', 'failed', 3],
      ['other', 'read hello.txt', 'completed', null],
      ['mcp', 'cuccut.project_read', 'completed', null],
    ]);
    expect(tools[0]!.detail).toBe('write hello.txt');
    expect(tools[0]!.output).toBe('+++ b/hello.txt\n@@ -0,0 +1,2 @@\n+one\n+two');
    expect(tools[1]!.output).toBe('--- hello.txt\n+++ hello.txt\n@@ -1,2 +1,2 @@\n one\n-two\n+three');
    expect(tools[2]!.output).toBe('one\nthree\n');
    expect(tools[3]!.output).toBe('one\nthree\n');
    expect(tools[4]!.detail).toBe('{"projectId":"p1"}');
    expect(tools.every((t) => typeof t.durationMs === 'number')).toBe(true);
    // bash partial output arrives in increments.
    expect(events.some((e) => e.type === 'item.delta' && e.channel === 'output' && e.delta === 'one\n')).toBe(true);

    const texts = items().filter((i) => i.kind === 'agent-message' || i.kind === 'reasoning');
    expect(texts.map((i) => [i.kind, 'text' in i ? i.text : null])).toEqual([
      ['reasoning', 'hmm…'],
      ['agent-message', 'All done.'],
    ]);
    const message = texts[1]!;
    const deltas = events.flatMap((e) => (e.type === 'item.delta' && e.itemId === message.id ? [e.delta] : []));
    expect(deltas.join('')).toBe('All done.');
    expect(events.find((e) => e.type === 'item.started' && e.item.id === message.id)).toBeTruthy();

    // Resume handle: pi's session file.
    const handle = session.describePersistence();
    expect(handle).toMatchObject({ driverId: 'pi', data: { sessionFile: expect.stringContaining(fake.sessionsDir) } });
  });

  it('developer instructions and CucCut\'s MCP server: written to temporary files passed to --append-system-prompt and --extension, deleted after the session closes', async () => {
    const { session, warnings } = await start(
      {},
      {
        developerInstructions: 'Use ccut.',
        mcpServers: {
          cuccut: { url: 'http://127.0.0.1:9/mcp', headers: { Authorization: 'Bearer t' } },
          'bad name': { url: 'http://127.0.0.1:9/x', headers: {} },
        },
      },
    );
    const startEntry = fake.log().find((e) => e.kind === 'start' && e.args?.[0] === '--mode')!;
    expect(startEntry.cwd).toBe(await fs.realpath(cwd));
    expect(startEntry.instructions).toBe('Use ccut.');
    expect(startEntry.extension).toContain('registerMcpServer');
    const config = JSON.parse(/const servers = (.*);/.exec(startEntry.extension!)![1]!);
    expect(config).toEqual({
      cuccut: { url: 'http://127.0.0.1:9/mcp', headers: { Authorization: 'Bearer t' }, exposure: 'direct', timeout: 86_400 },
    });
    await until(() => warnings().some((w) => w.includes('bad name')));
    const extensionFile = startEntry.args![startEntry.args!.indexOf('--extension') + 1]!;
    expect((await fs.stat(extensionFile)).mode & 0o777).toBe(0o600);
    await session.close();
    await expect(fs.stat(extensionFile)).rejects.toThrow();
  });

  it('not full access: runs as usual, but notes once that pi will not ask first', async () => {
    const { session, completed, warnings } = await start({}, { accessMode: 'ask' });
    await until(() => warnings().length > 0);
    expect(warnings()).toEqual(['Pi 没有逐次询问的通道，CucCut 只能让它在「完全访问」模式下运行：执行命令和修改文件之前不会先问你。']);
    expect(String(piAccessWarning())).toBe(warnings()[0]);
    const { turnId } = await session.startTurn({ text: 'hi' }, settings('ask'));
    expect((await completed(turnId)).outcome).toBe('completed');
    expect(warnings()).toHaveLength(1);
  });

  it('model and reasoning effort per turn: set_model / set_thinking_level are sent only when changed', async () => {
    const { session, completed } = await start();
    let { turnId } = await session.startTurn({ text: 'a' }, settings('fullAccess', 'anthropic/claude-sonnet-5', 'high'));
    await completed(turnId);
    expect(fake.commands('set_model')).toEqual([]);
    expect(fake.commands('set_thinking_level')).toMatchObject([{ level: 'high' }]);
    ({ turnId } = await session.startTurn({ text: 'b' }, settings('fullAccess', 'openai/gpt-mini', 'high')));
    await completed(turnId);
    expect(fake.commands('set_model')).toMatchObject([{ provider: 'openai', modelId: 'gpt-mini' }]);
    expect(fake.commands('set_thinking_level')).toHaveLength(1);
    await expect(session.startTurn({ text: 'c' }, settings('fullAccess', 'nope/missing'))).rejects.toMatchObject({
      agentCode: 'AGENT_MODEL_UNAVAILABLE',
    });
  });

  it('images: when the model accepts images, base64 is sent with the prompt; otherwise the local path is attached', async () => {
    const image = path.join(dir, 'a.png');
    await fs.writeFile(image, Buffer.from([1, 2, 3]));
    const { session, completed } = await start();
    let { turnId } = await session.startTurn({ text: 'look', images: [{ path: image, mimeType: 'image/png' }] }, settings());
    await completed(turnId);
    expect(fake.commands('prompt')[0]).toMatchObject({ message: 'look', images: [{ type: 'image', data: 'AQID', mimeType: 'image/png' }] });
    ({ turnId } = await session.startTurn(
      { text: 'look', images: [{ path: image, mimeType: 'image/png' }] },
      settings('fullAccess', 'openai/gpt-mini'),
    ));
    await completed(turnId);
    const second = fake.commands('prompt')[1]!;
    expect(second.images).toBeUndefined();
    expect(second.message).toBe(`look\n\n[图片：${image}]`);
  });

  it('steer: sends steer while a turn is in progress; reports unavailable when an older version replies Unknown command; interrupt: clears the queue, aborts, the turn is recorded as interrupted', async () => {
    const { session, completed, items } = await start({ turn: { hang: true } });
    const { turnId } = await session.startTurn({ text: 'go' }, settings());
    await until(() => fake.commands('prompt').length && items().some((i) => i.kind === 'agent-message'));
    expect(await session.steer!(turnId, { text: 'also this' })).toBe('accepted');
    expect(fake.commands('steer')).toMatchObject([{ message: 'also this' }]);
    expect(await session.steer!('other', { text: 'x' })).toBe('unavailable');

    expect(await session.interrupt(turnId)).toEqual({ status: 'requested' });
    const done = await completed(turnId);
    expect(done.outcome).toBe('interrupted');
    expect(fake.commands('clear_queue')).toHaveLength(1);
    expect(fake.commands('abort')).toHaveLength(1);
    expect(items().find((i): i is ToolItem => i.kind === 'tool-call')).toMatchObject({
      tool: 'command',
      title: 'sleep 100',
      status: 'failed',
    });
    expect(await session.interrupt(turnId)).toEqual({ status: 'not-running' });

    const old = await start({ steer: false, turn: { hang: true } });
    const second = await old.session.startTurn({ text: 'go' }, settings());
    await until(() => old.items().some((i) => i.kind === 'agent-message'));
    expect(await old.session.steer!(second.turnId, { text: 'x' })).toBe('unavailable');
    expect(await old.session.interrupt(second.turnId)).toEqual({ status: 'requested' });
    expect((await old.completed(second.turnId)).outcome).toBe('interrupted');
  });

  it('process exits unexpectedly during a turn: open entries are closed, session.exited is sent (with stderr), turn.completed is no longer reported', async () => {
    const { session, events } = await start({ turn: { exitMidTurn: true } });
    await session.startTurn({ text: 'go' }, settings());
    const exited = await until(() => events.find((e) => e.type === 'session.exited'));
    expect(exited).toMatchObject({ type: 'session.exited', error: expect.stringContaining('code 3') });
    expect((exited as { error: string }).error).toContain('fake pi crashed');
    expect(events.some((e) => e.type === 'turn.completed')).toBe(false);
    expect(events.some((e) => e.type === 'item.completed' && e.item.kind === 'agent-message')).toBe(true);
    await expect(session.startTurn({ text: 'again' }, settings())).rejects.toThrow('已关闭');
  });

  it('failure: prompt rejected (no API key) records AGENT_AUTH_REQUIRED; a model call error takes errorMessage', async () => {
    const a = await start({ turn: { promptError: 'No API key found for anthropic. Use /login or set an API key environment variable.' } });
    const first = await a.session.startTurn({ text: 'x' }, settings());
    expect(await a.completed(first.turnId)).toMatchObject({ outcome: 'failed', errorCode: 'AGENT_AUTH_REQUIRED' });

    const b = await start({ turn: { error: '529 overloaded' } });
    const second = await b.session.startTurn({ text: 'x' }, settings());
    expect(await b.completed(second.turnId)).toMatchObject({ outcome: 'failed', error: '529 overloaded', errorCode: null });
  });

  it('older versions without agent_settled: the turn ends if nothing happens after agent_end', async () => {
    const { session, completed } = await start({ settled: false });
    const { turnId } = await session.startTurn({ text: 'x' }, settings());
    expect((await completed(turnId)).outcome).toBe('completed');
  });

  it('extension asks (confirm): answers cancelled immediately, notifies once', async () => {
    const { session, completed, warnings } = await start({ turn: { ask: true, reply: 'ok' } });
    const { turnId } = await session.startTurn({ text: 'x' }, settings());
    await completed(turnId);
    expect(fake.commands('extension_ui_response')).toMatchObject([{ cancelled: true }]);
    expect(warnings().some((w) => w.includes('Allow?'))).toBe(true);
  });

  it('resume: continues with --session if the session file exists; otherwise creates a new one and reports that honestly', async () => {
    const first = await start();
    const { turnId } = await first.session.startTurn({ text: 'x' }, settings());
    await first.completed(turnId);
    const handle = first.session.describePersistence()!;
    await first.session.close();

    const resumed = await start({}, { resume: handle });
    const sessionFile = (handle.data as { sessionFile: string }).sessionFile;
    expect(
      fake
        .log()
        .filter((e) => e.kind === 'start')
        .at(-1)!.args,
    ).toContain(sessionFile);
    expect(resumed.session.describePersistence()).toEqual(handle);
    expect(resumed.warnings()).toEqual([]);

    const lost = await start({}, { resume: { driverId: handle.driverId, data: { sessionFile: path.join(dir, 'gone.jsonl') } } });
    await until(() => lost.warnings().length > 0);
    expect(lost.warnings()[0]).toContain('无法恢复 Pi 原生会话');
    expect(
      fake
        .log()
        .filter((e) => e.kind === 'start')
        .at(-1)!.args,
    ).not.toContain('--session');
  });

  it('restricted one-off calls: not supported', async () => {
    await expect(
      driver.createSession({ cwd, accessMode: 'fullAccess', model: null, effort: null, resume: null, confinement: 'cwd-write-only' }),
    ).rejects.toThrow('不支持受限');
  });
});

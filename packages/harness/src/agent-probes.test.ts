import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  driverAvailability,
  newId,
  nowIso,
  type AgentsEvent,
  type DriverId,
  type DriverProbe,
  type SequencedEvent,
} from '@cuccut/protocol';
import {
  AgentPrefsStore,
  AgentProbeStore,
  ConversationStore,
  ProjectStore,
  resolveRuntimeHome,
  type RuntimeHome,
} from '@cuccut/runtime-storage';
import { DriverRegistry } from './agent-manager.ts';
import type { AgentDriver, AgentSession, DriverDescription, ProbeOptions } from './driver.ts';
import { Harness } from './harness.ts';
import { silentLogger } from './logger.ts';

/** Caching of agent probes, background refresh, the `agents` topic, and in-runtime correction (architecture design §3.11). Drivers are all fakes; files are in a temp directory. */

interface Gate {
  promise: Promise<void>;
  open: () => void;
}

function gate(): Gate {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

class FakeDriver implements AgentDriver {
  readonly id: DriverId;
  readonly verified: boolean;
  readonly slowProbe: boolean;
  readonly calls: ProbeOptions[] = [];
  /** If given, waits for it to open before returning: simulates a slow probe. */
  hold: Gate | null = null;
  fail: string | null = null;
  state: DriverProbe['state'] = 'ready';
  version = '1.0.0';
  /** Error thrown by createSession (with agentCode). */
  sessionError: (Error & { agentCode?: string }) | null = null;
  /** If given, used as the probe time: simulates a result that was probed long ago. */
  checkedAt: string | null = null;

  constructor(id: DriverId, verified = true, slowProbe = false) {
    this.id = id;
    this.verified = verified;
    this.slowProbe = slowProbe;
  }

  describe(): DriverDescription {
    return {
      id: this.id,
      name: `Fake ${this.id}`,
      command: this.id,
      minVersion: '1.0.0',
      plan: '订阅',
      loginCommand: `${this.id} login`,
      install: [],
      verified: this.verified,
      tested: this.verified,
      capabilities: { steer: false, approvals: true, resume: false, images: true },
    };
  }

  async probe(options: ProbeOptions = {}): Promise<DriverProbe> {
    this.calls.push(options);
    const hold = this.hold;
    if (hold) await hold.promise;
    if (this.fail) throw new Error(this.fail);
    return {
      ...this.describe(),
      state: this.state,
      ...driverAvailability(this.state),
      version: this.version,
      latestVersion: null,
      detail: null,
      executable: options.executable ?? `/usr/local/bin/${this.id}`,
      realExecutable: null,
      account: null,
      models: [{ id: 'm1', label: 'M1', description: null, tier: null, isDefault: true, efforts: [], defaultEffort: null }],
      configModel: null,
      configModelKnown: null,
      checkedAt: this.checkedAt ?? nowIso(),
    };
  }

  async createSession(): Promise<AgentSession> {
    if (this.sessionError) throw this.sessionError;
    throw new Error('这个测试不开会话');
  }
}

let dir: string;
let home: RuntimeHome;
let harness: Harness | null;
let events: AgentsEvent[];

async function open(drivers: FakeDriver[]): Promise<Harness> {
  const registry = new DriverRegistry();
  for (const driver of drivers) registry.register(driver);
  const opened = await Harness.open({
    home,
    conversations: new ConversationStore(home.conversationsDir),
    projects: new ProjectStore(home.projectsFile),
    drivers: registry,
    log: silentLogger,
  });
  events = [];
  opened.subscribe('agents', undefined, (event) => events.push((event as SequencedEvent<AgentsEvent>).event));
  harness = opened;
  return opened;
}

async function seed(drivers: Record<string, Record<string, unknown>>): Promise<void> {
  await fs.mkdir(path.dirname(home.agentProbesFile), { recursive: true });
  await fs.writeFile(home.agentProbesFile, JSON.stringify({ schemaVersion: 1, drivers }));
}

function stored(state: string, version: string, executableOverride: string | null = null): Record<string, unknown> {
  return {
    state,
    version,
    executable: '/old/bin',
    realExecutable: null,
    account: null,
    models: [],
    configModel: null,
    configModelKnown: null,
    latestVersion: null,
    detail: null,
    checkedAt: '2026-10-01T00:00:00.000Z',
    executableOverride,
  };
}

async function until<T>(read: () => T | null | undefined | false, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('等待超时');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const lastView = () => events.at(-1)?.view ?? null;

beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-agent-probes-')));
  home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  harness = null;
});

afterEach(async () => {
  await harness?.shutdown();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('agent probe cache', () => {
  it('starts from the disk cache: agents.list returns the last result immediately without waiting for background probing; after probing, pushes the new result and writes it back to the file', async () => {
    await seed({ codex: stored('signed-out', '0.9.0') });
    const codex = new FakeDriver('codex');
    codex.hold = gate();
    const h = await open([codex]);

    const view = await h.agents();
    expect(view.checking).toEqual([]);
    expect(view.drivers).toHaveLength(1);
    // Machine facts come from the cache, constants come from describe(), and status is derived from state.
    expect(view.drivers[0]).toMatchObject({
      id: 'codex',
      state: 'signed-out',
      version: '0.9.0',
      name: 'Fake codex',
      status: 'unavailable',
      verified: true,
    });
    expect(codex.calls).toHaveLength(1);

    codex.hold.open();
    await until(() => lastView()?.drivers[0]?.state === 'ready');
    expect(lastView()!.drivers[0]).toMatchObject({ version: '1.0.0', status: 'available' });

    await h.shutdown();
    harness = null;
    const file = JSON.parse(await fs.readFile(home.agentProbesFile, 'utf8'));
    expect(file.drivers.codex).toMatchObject({ state: 'ready', version: '1.0.0', executableOverride: null });
    // Only machine facts are stored, not Driver constants.
    expect(file.drivers.codex.name).toBeUndefined();
    expect(file.drivers.codex.install).toBeUndefined();
    expect(file.drivers.codex.capabilities).toBeUndefined();
  });

  it('without a cache: fast probes are awaited, and probes that launch an agent process (slowProbe) are listed as checking; a slow probe does not block fast ones, and each pushes its own result when done', async () => {
    const codex = new FakeDriver('codex');
    const gemini = new FakeDriver('gemini', true, true);
    gemini.hold = gate();
    const h = await open([codex, gemini]);

    const view = await h.agents();
    expect(view.drivers.map((d) => d.id)).toEqual(['codex']);
    expect(view.checking).toEqual(['gemini']);
    await until(() => lastView()?.drivers.some((d) => d.id === 'codex'));
    expect(lastView()!.checking).toEqual(['gemini']);
    // Concurrent refreshes for the same Driver share one probe: the startup refresh and agents.list probed only once.
    expect(gemini.calls).toHaveLength(1);

    gemini.hold.open();
    await until(() => lastView()?.checking.length === 0);
    expect(lastView()!.drivers.map((d) => d.id)).toEqual(['codex', 'gemini']);
    expect(h.agentsSnapshot().drivers.find((d) => d.id === 'gemini')).toMatchObject({ verified: true, state: 'ready' });
  });

  it('a probe error in one Driver is recorded as error without affecting the others', async () => {
    const claude = new FakeDriver('claude');
    claude.fail = '炸了';
    const codex = new FakeDriver('codex');
    const h = await open([claude, codex]);

    const view = await h.agents();
    expect(view.checking).toEqual([]);
    expect(view.drivers.find((d) => d.id === 'claude')).toMatchObject({ state: 'error', status: 'unavailable', name: 'Fake claude' });
    expect(view.drivers.find((d) => d.id === 'claude')!.detail).toContain('炸了');
    expect(view.drivers.find((d) => d.id === 'codex')).toMatchObject({ state: 'ready' });
  });

  it('detect forces a probe and waits for it to finish (it can probe just one), pushing before returning', async () => {
    const claude = new FakeDriver('claude');
    const codex = new FakeDriver('codex');
    const h = await open([claude, codex]);
    await h.agents();
    expect(claude.calls).toHaveLength(1);

    codex.version = '2.0.0';
    codex.hold = gate();
    const detecting = h.agents({ fresh: true, driverId: 'codex' });
    let settled = false;
    void detecting.then(() => (settled = true));
    await until(() => codex.calls.length === 2);
    expect(settled).toBe(false);
    expect(codex.calls[1]).toMatchObject({ force: true });
    const before = events.length;
    codex.hold.open();
    const view = await detecting;
    expect(view.drivers.find((d) => d.id === 'codex')!.version).toBe('2.0.0');
    expect(events.length).toBeGreaterThan(before);
    expect(lastView()!.drivers.find((d) => d.id === 'codex')!.version).toBe('2.0.0');
    // Only codex was probed.
    expect(claude.calls).toHaveLength(1);

    await h.agents({ fresh: true });
    expect(claude.calls).toHaveLength(2);
    expect(codex.calls).toHaveLength(3);
  });

  it('a forced probe replaces an in-progress normal probe: the old result is discarded when it returns', async () => {
    const codex = new FakeDriver('codex');
    codex.hold = gate();
    codex.version = '1.0.0';
    const h = await open([codex]);
    const first = codex.hold;
    await until(() => codex.calls.length === 1);

    codex.hold = null;
    codex.version = '3.0.0';
    await h.agents({ fresh: true });
    expect(h.agentsSnapshot().drivers[0]!.version).toBe('3.0.0');
    codex.version = '1.0.0';
    first.open();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(h.agentsSnapshot().drivers[0]!.version).toBe('3.0.0');
  });

  it('changing the executable: drops the old result, re-probes only this one, using the new executable', async () => {
    const claude = new FakeDriver('claude');
    const codex = new FakeDriver('codex');
    const h = await open([claude, codex]);
    await h.agents();
    expect([claude.calls.length, codex.calls.length]).toEqual([1, 1]);

    const view = await h.configureAgent({ driverId: 'codex', executable: '/opt/codex' });
    expect(view.drivers.find((d) => d.id === 'codex')).toMatchObject({ executable: '/opt/codex', executableOverride: '/opt/codex' });
    expect(codex.calls).toHaveLength(2);
    expect(codex.calls[1]).toMatchObject({ executable: '/opt/codex' });
    expect(claude.calls).toHaveLength(1);
  });

  it('an entry in the cache is dropped when its executable does not match the preference', async () => {
    const prefs = new AgentPrefsStore(home.agentPrefsFile);
    await prefs.load();
    await prefs.update((p) => {
      p.drivers.codex = { enabled: true, defaultModel: null, defaultEffort: null, executable: '/new/codex' };
    });
    await seed({ codex: stored('ready', '0.5.0', '/old/codex'), claude: stored('ready', '0.6.0') });
    const codex = new FakeDriver('codex');
    codex.hold = gate();
    const claude = new FakeDriver('claude');
    claude.hold = gate();
    const h = await open([codex, claude]);

    const snapshot = h.agentsSnapshot();
    expect(snapshot.drivers.map((d) => d.id)).toEqual(['claude']);
    expect(snapshot.checking).toEqual(['codex']);
    codex.hold.open();
    claude.hold.open();
  });

  it('a corrupt cache file is treated as no cache', async () => {
    await fs.mkdir(path.dirname(home.agentProbesFile), { recursive: true });
    await fs.writeFile(home.agentProbesFile, '{ 这不是 JSON');
    const codex = new FakeDriver('codex');
    codex.hold = gate();
    const h = await open([codex]);
    expect(h.agentsSnapshot()).toMatchObject({ drivers: [], checking: ['codex'] });
    codex.hold.open();
    expect((await h.agents()).drivers[0]).toMatchObject({ state: 'ready' });
    await h.shutdown();
    harness = null;
    expect(await new AgentProbeStore(home.agentProbesFile).load()).toHaveProperty('codex');
  });

  it('a preference change pushes a new view', async () => {
    const h = await open([new FakeDriver('codex')]);
    await h.agents();
    const before = events.length;
    await h.updateAgentPreferences({ modelAutoUpdate: false });
    expect(events.length).toBe(before + 1);
    expect(lastView()!.preferences.modelAutoUpdate).toBe(false);
    await h.configureAgent({ driverId: 'codex', enabled: false });
    expect(lastView()!.drivers[0]).toMatchObject({ enabled: false, state: 'disabled' });
  });

  it('cheap correction: Drivers the cache marks unavailable and not probed for over 60 seconds are probed again in the background on agents.list and session creation; slowProbe ones are not probed', async () => {
    const codex = new FakeDriver('codex');
    codex.state = 'signed-out';
    codex.checkedAt = '2026-10-01T00:00:00.000Z';
    const gemini = new FakeDriver('gemini', true, true);
    gemini.state = 'signed-out';
    gemini.checkedAt = '2026-10-01T00:00:00.000Z';
    const h = await open([codex, gemini]);
    await until(() => lastView()?.drivers.length === 2);
    expect(codex.calls).toHaveLength(1);

    await h.createConversation({ driverId: 'codex' });
    await until(() => codex.calls.length === 2);
    expect(codex.calls[1]).not.toMatchObject({ force: true });
    await h.agents();
    await until(() => codex.calls.length === 3);
    expect(gemini.calls).toHaveLength(1);
  });

  it('a session fails with AGENT_AUTH_REQUIRED: the Driver is force-probed again in the background and the result is pushed', async () => {
    const codex = new FakeDriver('codex');
    const claude = new FakeDriver('claude');
    const h = await open([codex, claude]);
    await h.agents();
    expect(h.agentsSnapshot().drivers.find((d) => d.id === 'codex')!.state).toBe('ready');

    codex.sessionError = Object.assign(new Error('需要登录'), { agentCode: 'AGENT_AUTH_REQUIRED' });
    codex.state = 'signed-out';
    const conversation = await h.createConversation({ driverId: 'codex' });
    await h.send({ conversationId: conversation.id, text: '你好', commandId: newId('cmd') });

    await until(() => lastView()?.drivers.find((d) => d.id === 'codex')?.state === 'signed-out');
    expect(codex.calls.at(-1)).toMatchObject({ force: true });
    expect(codex.calls).toHaveLength(2);
    expect(claude.calls).toHaveLength(1);
    const task = h.getConversation(conversation.id).items.find((item) => item.kind === 'task');
    expect(task).toMatchObject({ status: 'failed', errorCode: 'AGENT_AUTH_REQUIRED' });
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AGENT_DEFAULT_MODEL,
  defaultSettingsSnapshot,
  driverAvailability,
  nowIso,
  type DriverId,
  type DriverModel,
  type DriverProbe,
  type SettingKey,
  type SettingValues,
} from '@cuccut/protocol';
import { ConversationStore, ProjectStore, resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { DriverRegistry } from './agent-manager.ts';
import type { AgentDriver, AgentSession, DriverDescription } from './driver.ts';
import { Harness } from './harness.ts';
import { silentLogger } from './logger.ts';

/**
 * Default model for a new session (architecture design §3.11, user decision of 2026-09-29): if never set, use the recommended model: Claude Code's Sonnet, Codex's `-sol`, rather than falling to the most expensive model per CLI configuration; only when "Agent default model" is explicitly chosen is no model passed. Drivers are fakes; the model table follows the order of the two CLIs.
 */

const model = (id: string, patch: Partial<DriverModel> = {}): DriverModel => ({
  id,
  label: id,
  description: null,
  tier: null,
  isDefault: false,
  efforts: [],
  defaultEffort: null,
  ...patch,
});

/** Claude Code's table: the CLI's default is Opus, with Fable ahead of Sonnet. */
const CLAUDE_MODELS = [
  model('opus', { tier: 'max', isDefault: true }),
  model('claude-fable-5-1[1m]', { tier: 'max' }),
  model('sonnet', { tier: 'balanced' }),
  model('haiku', { tier: 'fast' }),
];
/** Codex's table: the newer `-sol` comes first, with the default marked on the strongest tier. */
const CODEX_MODELS = [
  model('gpt-6-astra', { tier: 'max', isDefault: true }),
  model('gpt-6-sol', { tier: 'balanced' }),
  model('gpt-5.6-sol', { tier: 'balanced' }),
];

class ModelsDriver implements AgentDriver {
  readonly id: DriverId;
  readonly verified = true;
  models: DriverModel[];

  constructor(id: DriverId, models: DriverModel[]) {
    this.id = id;
    this.models = models;
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
      verified: true,
      tested: true,
      capabilities: { steer: false, approvals: true, resume: false, images: true },
    };
  }

  async probe(): Promise<DriverProbe> {
    return {
      ...this.describe(),
      state: 'ready',
      ...driverAvailability('ready'),
      version: '1.0.0',
      latestVersion: null,
      detail: null,
      executable: `/usr/local/bin/${this.id}`,
      realExecutable: null,
      account: null,
      models: this.models,
      configModel: null,
      configModelKnown: null,
      checkedAt: nowIso(),
    };
  }

  async createSession(): Promise<AgentSession> {
    throw new Error('这个测试不开会话');
  }
}

let dir: string;
let home: RuntimeHome;
let harness: Harness | null;
let settings: Partial<SettingValues>;

async function open(drivers: ModelsDriver[]): Promise<Harness> {
  const registry = new DriverRegistry();
  for (const driver of drivers) registry.register(driver);
  harness = await Harness.open({
    home,
    conversations: new ConversationStore(home.conversationsDir),
    projects: new ProjectStore(home.projectsFile),
    drivers: registry,
    log: silentLogger,
    settings: {
      snapshot: <K extends SettingKey>(keys: readonly K[]) => {
        const frozen = defaultSettingsSnapshot(keys);
        for (const key of keys) if (key in settings) (frozen.values as Record<string, unknown>)[key] = settings[key];
        return frozen;
      },
    },
  });
  // Get the probe into the cache first: session creation reads the model table from the cache.
  await harness.agents();
  return harness;
}

const claude = () => new ModelsDriver('claude', CLAUDE_MODELS);
const codex = () => new ModelsDriver('codex', CODEX_MODELS);
const defaultOf = (h: Harness, id: DriverId) => h.agentsSnapshot().drivers.find((d) => d.id === id)!.defaultModel;

beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-default-model-')));
  home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  harness = null;
  settings = {};
});

afterEach(async () => {
  await harness?.shutdown();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('default model for new sessions', () => {
  it('unset: Claude Code uses Sonnet, Codex uses the first -sol, and the default shown in the UI is that', async () => {
    const h = await open([claude(), codex()]);
    expect(defaultOf(h, 'claude')).toBe('sonnet');
    expect(defaultOf(h, 'codex')).toBe('gpt-6-sol');
    expect((await h.createConversation({ driverId: 'claude' })).model).toBe('sonnet');
    expect((await h.createConversation({})).model).toBe('gpt-6-sol');
  });

  it('other providers: the first balanced, then the Agent\'s marked default, then the first; when the model table is empty no model is passed', async () => {
    const pi = new ModelsDriver('pi', [model('a'), model('b', { tier: 'balanced' }), model('c', { isDefault: true })]);
    const kimi = new ModelsDriver('kimi', [model('k1'), model('k2', { isDefault: true })]);
    const grok = new ModelsDriver('grok', [model('g1'), model('g2')]);
    const gemini = new ModelsDriver('gemini', []);
    const h = await open([pi, kimi, grok, gemini]);
    expect(defaultOf(h, 'pi')).toBe('b');
    expect(defaultOf(h, 'kimi')).toBe('k2');
    expect(defaultOf(h, 'grok')).toBe('g1');
    expect(defaultOf(h, 'gemini')).toBeNull();
    expect((await h.createConversation({ driverId: 'gemini' })).model).toBeNull();
  });

  it('session draft explicitly chose \'Agent default model\' (model: null): no model is passed', async () => {
    const h = await open([claude()]);
    expect((await h.createConversation({ driverId: 'claude', model: null })).model).toBeNull();
  });

  it('choosing \'Agent default model\' in settings saves AGENT_DEFAULT_MODEL: the view shows null, and new sessions pass no model; choosing a specific model as usual works', async () => {
    const h = await open([claude()]);
    const view = await h.configureAgent({ driverId: 'claude', defaultModel: null });
    expect(view.preferences.drivers.claude?.defaultModel).toBe(AGENT_DEFAULT_MODEL);
    expect(view.drivers[0]!.defaultModel).toBeNull();
    expect((await h.createConversation({ driverId: 'claude' })).model).toBeNull();
    // Only effort changed: still the Agent default model.
    await h.configureAgent({ driverId: 'claude', defaultEffort: null });
    expect(defaultOf(h, 'claude')).toBeNull();

    await h.configureAgent({ driverId: 'claude', defaultModel: 'opus' });
    expect(defaultOf(h, 'claude')).toBe('opus');
    expect((await h.createConversation({ driverId: 'claude' })).model).toBe('opus');
  });

  it('an old null in the preference file is treated as unset; a model that was set but has disappeared from the model table: the view shows it as-is, and new sessions use the recommended model', async () => {
    await fs.mkdir(path.dirname(home.agentPrefsFile), { recursive: true });
    await fs.writeFile(
      home.agentPrefsFile,
      JSON.stringify({
        schemaVersion: 1,
        drivers: {
          codex: { enabled: true, defaultModel: null, defaultEffort: null, executable: null },
          claude: { enabled: true, defaultModel: 'claude-gone', defaultEffort: null, executable: null },
        },
      }),
    );
    const h = await open([claude(), codex()]);
    expect(defaultOf(h, 'codex')).toBe('gpt-6-sol');
    expect(defaultOf(h, 'claude')).toBe('claude-gone');
    expect((await h.createConversation({ driverId: 'claude' })).model).toBe('sonnet');
  });

  it('the agent.defaultModel preference is used only for the default Agent when it has no setting of its own; AGENT_DEFAULT_MODEL means no model is passed', async () => {
    settings['agent.defaultModel'] = 'gpt-5.6-sol';
    const h = await open([claude(), codex()]);
    expect(defaultOf(h, 'codex')).toBe('gpt-5.6-sol');
    expect((await h.createConversation({})).model).toBe('gpt-5.6-sol');
    expect(defaultOf(h, 'claude')).toBe('sonnet');

    settings['agent.defaultModel'] = AGENT_DEFAULT_MODEL;
    expect(defaultOf(h, 'codex')).toBeNull();
    expect((await h.createConversation({})).model).toBeNull();
  });

  it('switching Agent on an unused session: uses the new Agent\'s default model (the recommended model when unset)', async () => {
    const h = await open([claude(), codex()]);
    const conversation = await h.createConversation({ driverId: 'claude' });
    expect(conversation.model).toBe('sonnet');
    expect((await h.updateConversation({ conversationId: conversation.id, driverId: 'codex' })).model).toBe('gpt-6-sol');
  });
});

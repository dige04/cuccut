import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { createFakePi, type FakePi } from '../testing/fake-pi.ts';
import { parsePiVersion } from './pi-binary.ts';
import { derivePiModels, parseModelReference, piThinkingLevels } from './pi-models.ts';
import { PiDriver, PI_MIN_VERSION } from './pi-driver.ts';

/** Pi Driver probe against a fake pi: installation, version, login state (judged by the available model table), the model table, and its cache. */
describe('PiDriver.probe (fake pi)', () => {
  let dir: string;
  let fake: FakePi;
  let driver: PiDriver;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pi-driver-'));
    fake = await createFakePi(path.join(dir, 'fake'));
    driver = new PiDriver(silentLogger, { locate: fake.locate, probeTimeoutMs: 10_000 });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('models available: ready, model table is provider/id, default model and reasoning levels come from get_state and thinkingLevelMap', async () => {
    const probe = await driver.probe();
    expect(probe).toMatchObject({
      id: 'pi',
      name: 'Pi',
      command: 'pi',
      state: 'ready',
      version: '1.0.4',
      minVersion: PI_MIN_VERSION,
      verified: true,
      plan: 'Pi 里的模型账号',
      loginCommand: 'pi',
      capabilities: { steer: true, approvals: false, resume: true, images: true },
      detail: null,
    });
    expect(driver.verified).toBe(true);
    expect(driver.tested).toBe(false);
    expect(driver.describe().verified).toBe(true);
    expect(probe.install).toEqual([
      {
        kind: 'npm',
        label: 'npm',
        needs: 'Node.js',
        command: 'npm install -g @earendil-works/pi-coding-agent',
        upgrade: 'npm install -g @earendil-works/pi-coding-agent@latest',
      },
    ]);
    expect(probe.models).toEqual([
      {
        id: 'anthropic/claude-sonnet-5',
        label: 'Claude Sonnet 5',
        description: 'anthropic/claude-sonnet-5',
        tier: null,
        isDefault: true,
        efforts: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'].map((id) => ({ id, label: id })),
        defaultEffort: 'medium',
      },
      {
        id: 'openai/gpt-mini',
        label: 'GPT Mini',
        description: 'openai/gpt-mini',
        tier: null,
        isDefault: false,
        efforts: [],
        defaultEffort: null,
      },
    ]);
    // Probe process: RPC mode, writes no session file, runs in the home directory, does not check for new versions.
    const start = fake.log().find((e) => e.kind === 'start')!;
    expect(start.args).toEqual(['--mode', 'rpc', '--no-session']);
    expect(start.cwd).toBe(await fs.realpath(os.homedir()));
    expect(start.env).toEqual({ PI_SKIP_VERSION_CHECK: '1' });
    expect(fake.commands('prompt')).toEqual([]);
  });

  it('no models available: signed-out, prompts for /login or an API key', async () => {
    fake.scenario({ models: [], current: null });
    const probe = await driver.probe();
    expect(probe.state).toBe('signed-out');
    expect(probe.detail).toContain('/login');
    expect(probe.models).toEqual([]);
  });

  it('model table is cached for 10 minutes, concurrent probes share one request; force starts the process again', async () => {
    await Promise.all([driver.probe(), driver.probe()]);
    await driver.probe();
    expect(fake.commands('get_available_models')).toHaveLength(1);
    await driver.probe({ force: true });
    expect(fake.commands('get_available_models')).toHaveLength(2);
  });

  it('not installed: not-installed; too old: outdated; fails to start: error with stderr', async () => {
    fake.scenario({ installed: false });
    expect((await driver.probe()).state).toBe('not-installed');
    fake.scenario({ installed: true, version: '0.62.0' });
    const outdated = await driver.probe();
    expect(outdated.state).toBe('outdated');
    expect(outdated.detail).toContain(PI_MIN_VERSION);
    fake.scenario({ version: '1.0.5', crashOnStart: true });
    const broken = await driver.probe();
    expect(broken.state).toBe('error');
    expect(broken.detail).toContain('fake pi failed to start');
  });

  it('manually specified executable does not exist: not-installed', async () => {
    const probe = await driver.probe({ executable: path.join(dir, 'nope', 'pi') });
    expect(probe.state).toBe('not-installed');
    expect(probe.detail).toContain('不存在');
  });
});

describe('parsing pi models and version', () => {
  it('--version output', () => {
    expect(parsePiVersion('1.0.4\n')).toBe('1.0.4');
    expect(parsePiVersion('pi v0.84.4')).toBe('0.84.4');
    expect(parsePiVersion('nothing')).toBeNull();
  });

  it('provider/id and provider:id', () => {
    expect(parseModelReference('anthropic/claude-sonnet-5')).toEqual({ provider: 'anthropic', id: 'claude-sonnet-5' });
    expect(parseModelReference('openrouter/meta/llama')).toEqual({ provider: 'openrouter', id: 'meta/llama' });
    expect(parseModelReference('ollama:qwen3')).toEqual({ provider: 'ollama', id: 'qwen3' });
    expect(parseModelReference('gpt-5')).toEqual({ provider: null, id: 'gpt-5' });
  });

  it('reasoning levels: null means unsupported, xhigh / max must be in the mapping; when default medium is unsupported, move up first', () => {
    const base = { id: 'm', provider: 'p', reasoning: true };
    expect(piThinkingLevels({ ...base })).toEqual({ efforts: ['off', 'minimal', 'low', 'medium', 'high'], defaultEffort: 'medium' });
    expect(piThinkingLevels({ ...base, thinkingLevelMap: { medium: null, low: null, max: 'max' } })).toEqual({
      efforts: ['off', 'minimal', 'high', 'max'],
      defaultEffort: 'high',
    });
    expect(piThinkingLevels({ ...base, thinkingLevelMap: { medium: null, high: null } })).toEqual({
      efforts: ['off', 'minimal', 'low'],
      defaultEffort: 'low',
    });
    expect(piThinkingLevels({ ...base, reasoning: false })).toEqual({ efforts: [], defaultEffort: null });
  });

  it('no default when get_state\'s model is unknown (no model configured)', () => {
    const models = derivePiModels([{ id: 'a', provider: 'p' }], { provider: 'unknown', id: 'unknown' });
    expect(models[0]!.isDefault).toBe(false);
  });
});

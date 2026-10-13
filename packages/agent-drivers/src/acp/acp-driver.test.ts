import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { createFakeAcp, type FakeAcp } from '../testing/fake-acp.ts';
import { parseAcpVersion, acpPathVariable } from './acp-binary.ts';
import { AcpDriver, acpDrivers } from './acp-driver.ts';
import { ACP_PRESETS } from './acp-presets.ts';

describe('AcpDriver.probe (fake ACP agent)', () => {
  let dir: string;
  let fake: FakeAcp;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-acp-driver-'));
    fake = await createFakeAcp(path.join(dir, 'fake'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const sessionsStarted = () => fake.log().filter((e) => e.kind === 'start').length;

  it('installed and signed in: ready, with version, model table (legacy models), capabilities; the shared implementation is verified and a session can be opened', async () => {
    const driver = new AcpDriver('gemini', silentLogger, { locate: fake.locate });
    const probe = await driver.probe();
    expect(probe).toMatchObject({
      id: 'gemini',
      name: 'Gemini CLI',
      command: 'gemini',
      state: 'ready',
      status: 'available',
      version: '0.46.0',
      verified: true,
      loginCommand: 'gemini',
      capabilities: { steer: false, approvals: true, resume: true, images: true },
    });
    expect(probe.models).toEqual([
      { id: 'fake-pro', label: 'Fake Pro', description: null, tier: null, isDefault: true, efforts: [], defaultEffort: null },
      { id: 'fake-flash', label: 'Fake Flash', description: 'Fast', tier: null, isDefault: false, efforts: [], defaultEffort: null },
    ]);
    // The probe process does not open a browser; it is closed when done (session/close), and no prompt is sent.
    expect(fake.log().find((e) => e.kind === 'start')?.env).toEqual({ NO_BROWSER: '1', NO_OPEN_BROWSER: '1' });
    expect(fake.requests('session/close')).toHaveLength(1);
    expect(fake.requests('session/prompt')).toEqual([]);
  });

  it('model table cache: no process started within 10 minutes for the same version', async () => {
    const driver = new AcpDriver('gemini', silentLogger, { locate: fake.locate });
    await driver.probe();
    await driver.probe();
    expect(sessionsStarted()).toBe(1);
  });

  it('model table comes from config options categorized as model (including groups)', async () => {
    fake.scenario({ models: 'config' });
    const probe = await new AcpDriver('kimi', silentLogger, { locate: fake.locate }).probe();
    expect(probe.models.map((m) => [m.id, m.isDefault])).toEqual([
      ['fake-pro', true],
      ['fake-flash', false],
    ]);
  });

  it('Cursor\'s model table uses cursor/list_available_models; when unavailable, falls back to the one in the session', async () => {
    fake.scenario({ cursorModels: true, version: '2026.04.01' });
    const probe = await new AcpDriver('cursor', silentLogger, { locate: fake.locate }).probe();
    expect(probe.models.map((m) => m.id)).toEqual(['auto', 'cursor-fast']);
    expect(fake.requests('cursor/list_available_models')).toHaveLength(1);

    fake.scenario({ cursorModels: false, version: '2026.04.02' });
    const fallback = await new AcpDriver('cursor', silentLogger, { locate: fake.locate }).probe();
    expect(fallback.models.map((m) => m.id)).toEqual(['fake-pro', 'fake-flash']);
  });

  it('not signed in (session/new returns -32000): signed-out, gives the sign-in command', async () => {
    fake.scenario({ loggedIn: false });
    const probe = await new AcpDriver('gemini', silentLogger, { locate: fake.locate }).probe();
    expect(probe.state).toBe('signed-out');
    expect(probe.unavailableReason).toBe('not-connected');
    expect(probe.detail).toContain('gemini');
    // Both the Google account and API key login methods are covered.
    expect(probe.detail).toContain('Google');
    expect(probe.detail).toContain('~/.gemini/.env');
    expect(probe.detail).toContain('API key is missing');
  });

  it.skipIf(process.platform === 'win32')('when probing ends, processes spawned by a temporary process end too (like rg run by cursor-agent on startup)', async () => {
    fake.scenario({ loggedIn: false, cursorModels: true, version: '2026.04.17', helper: true });
    const helpers = () => fake.log().flatMap((e) => (e.kind === 'start' && e.helper ? [e.helper] : []));
    try {
      const probe = await new AcpDriver('cursor', silentLogger, { locate: fake.locate }).probe();
      expect(probe.state).toBe('signed-out');
      expect(helpers()).toHaveLength(1);
      expect(() => process.kill(helpers()[0]!, 0)).toThrow();
    } finally {
      // Even when an assertion fails, the test does not leave its own processes behind.
      for (const pid of helpers()) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already ended
        }
      }
    }
  });

  it('not installed: not-installed, says how to install; too old: outdated', async () => {
    fake.scenario({ installed: false });
    const missing = await new AcpDriver('kimi', silentLogger, { locate: fake.locate }).probe();
    expect(missing.state).toBe('not-installed');
    expect(missing.install).toEqual([]);
    expect(missing.detail).toContain('https://github.com/MoonshotAI/kimi-code');

    fake.scenario({ installed: true, version: '0.40.0' });
    const old = await new AcpDriver('gemini', silentLogger, { locate: fake.locate }).probe();
    expect(old.state).toBe('outdated');
    expect(sessionsStarted()).toBe(0);
  });

  it('ACP mode fails to start: error, original text written into detail', async () => {
    const broken = path.join(dir, 'broken');
    await fs.writeFile(broken, '#!/bin/sh\necho "unknown flag" >&2\nexit 3\n', { mode: 0o755 });
    const probe = await new AcpDriver('grok', silentLogger, {
      locate: async () => ({ command: broken, version: '9.9.9', env: { PATH: process.env.PATH } }),
    }).probe();
    expect(probe.state).toBe('error');
    expect(probe.detail).toContain('unknown flag');
  });
});

describe('ACP presets', () => {
  it('built-in presets: launch arguments, install method, override variables', () => {
    expect(acpDrivers(silentLogger).map((d) => d.id)).toEqual(['copilot', 'gemini', 'cursor', 'grok', 'kimi']);
    expect(Object.values(ACP_PRESETS).map((p) => [p.id, p.command, p.args.join(' ')])).toEqual([
      ['copilot', 'copilot', '--acp'],
      ['gemini', 'gemini', '--acp'],
      ['cursor', 'cursor-agent', 'acp'],
      ['grok', 'grok', 'agent stdio'],
      ['kimi', 'kimi', 'acp'],
    ]);
    expect(ACP_PRESETS.gemini.install!.map((i) => i.command)).toEqual(['brew install gemini-cli', 'npm install -g @google/gemini-cli']);
    expect(ACP_PRESETS.cursor.install!.map((i) => i.kind)).toEqual(['script']);
    expect(ACP_PRESETS.copilot.install!.map((i) => [i.command, i.upgrade])).toEqual([
      ['npm install -g @github/copilot', 'npm install -g @github/copilot@latest'],
    ]);
    expect(ACP_PRESETS.copilot.permissionOption).toEqual({ configId: 'allow_all', on: 'on', off: 'off' });
    // #autopilot is broader than full access, so it is not among the candidates.
    expect(
      Object.values(ACP_PRESETS.copilot.modes)
        .flat()
        .some((id) => id.endsWith('#autopilot')),
    ).toBe(false);
    expect(acpPathVariable(ACP_PRESETS.cursor)).toBe('CUCCUT_CURSOR_PATH');
    // Do not add a native mode broader than CucCut's modes: ask has only default.
    expect(ACP_PRESETS.gemini.modes.ask).toEqual(['default']);
    // The shared implementation is verified: sessions can be opened in all cases; none of the vendors has yet been tested on CucCut with its own agent.
    expect(acpDrivers(silentLogger).map((d) => [d.id, d.verified, d.slowProbe, d.preset.tested])).toEqual([
      ['copilot', true, true, false],
      ['gemini', true, true, false],
      ['cursor', true, true, false],
      ['grok', true, true, false],
      ['kimi', true, true, false],
    ]);
    expect(new AcpDriver('kimi', silentLogger, { verified: false }).describe().verified).toBe(false);
    expect(new AcpDriver({ ...ACP_PRESETS.grok, verified: false }, silentLogger).verified).toBe(false);
  });

  it('version number takes the first one in the output', () => {
    expect(parseAcpVersion('0.46.0\n')).toBe('0.46.0');
    expect(parseAcpVersion('2026.03.30-a1b2c3')).toBe('2026.03.30');
    expect(parseAcpVersion('kimi, version 0.11.0')).toBe('0.11.0');
    expect(parseAcpVersion('nothing')).toBeNull();
  });
});

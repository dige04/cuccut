import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentPrefsStore, defaultAgentPreferences } from './agent-prefs.ts';

describe('agent preferences', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-agent-prefs-'));
    file = path.join(dir, 'store', 'agent-prefs.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('defaults when there is no file', async () => {
    expect(await new AgentPrefsStore(file).load()).toEqual(defaultAgentPreferences());
  });

  it('changes are written to disk and read back the same', async () => {
    const store = new AgentPrefsStore(file);
    await store.load();
    await store.update((p) => {
      p.drivers.claude = { enabled: true, defaultModel: 'opus', defaultEffort: 'high', executable: null };
      p.rules.push('ccut cleanup', 'ccut cleanup', 'npm');
    });
    const again = await new AgentPrefsStore(file).load();
    expect(again).toMatchObject({ rules: ['ccut cleanup', 'npm'] });
    expect(again.drivers.claude).toEqual({ enabled: true, defaultModel: 'opus', defaultEffort: 'high', executable: null });
    expect(store.driver('codex')).toEqual({ enabled: true, defaultModel: null, defaultEffort: null, executable: null });
  });

  it('broken or unknown fields are treated as defaults', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({
        schemaVersion: 1,
        defaultDriverId: 'gemini',
        lastAccessMode: 'controlled',
        policy: { read: false, ccutro: 'yes' },
        drivers: { codex: { enabled: false, defaultModel: '' }, 'Not Valid': { enabled: true }, kimi: { enabled: false, defaultModel: 'kimi-k3' } },
        rules: ['ok', 3, ''],
      }),
    );
    const prefs = await new AgentPrefsStore(file).load();
    expect(prefs).not.toHaveProperty('defaultDriverId');
    expect(prefs).not.toHaveProperty('lastAccessMode');
    expect(prefs.policy).toEqual({ read: false, ccutro: true, loop: true });
    // An Agent connected via ACP (kimi) is still read back as usual; entries with a malformed id are dropped.
    expect(prefs.drivers).toEqual({
      codex: { enabled: false, defaultModel: null, defaultEffort: null, executable: null },
      kimi: { enabled: false, defaultModel: 'kimi-k3', defaultEffort: null, executable: null },
    });
    expect(prefs.rules).toEqual(['ok']);
  });

  it('unreadable JSON does not block startup', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{ not json');
    expect(await new AgentPrefsStore(file).load()).toEqual(defaultAgentPreferences());
  });
});

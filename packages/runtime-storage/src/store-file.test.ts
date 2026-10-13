import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPrefsStore } from './agent-prefs.ts';
import { AgentProbeStore } from './agent-probes.ts';
import { AgentProviderStore } from './agent-providers.ts';
import { GrantStore } from './grant-store.ts';
import { ProjectStore } from './project-store.ts';
import { SettingsStore } from './settings-store.ts';
import { SkillPrefsStore } from './skill-prefs.ts';
import { SpaceArtifactStore } from './space-artifacts.ts';
import { SpaceMarkStore } from './space-marks.ts';
import { JsonStoreFile, readJsonOrQuarantine, type StoreLog } from './store-file.ts';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-store-file-'));
  file = path.join(dir, 'store.json');
});

afterEach(async () => {
  await fs.chmod(dir, 0o700).catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
});

function spyLog() {
  return { info: vi.fn<StoreLog['info']>(), warn: vi.fn<StoreLog['warn']>() };
}

const corruptNames = async () => (await fs.readdir(dir)).filter((n) => n.startsWith(`${path.basename(file)}.corrupt-`));

describe('readJsonOrQuarantine', () => {
  const recognize = (raw: Record<string, unknown>) => (Array.isArray(raw.items) ? raw.items : null);

  it('missing when file absent', async () => {
    expect(await readJsonOrQuarantine(file, { recognize })).toEqual({ status: 'missing', value: null });
  });

  it('empty file (or only whitespace) treated as absent, logs warn, not renamed', async () => {
    await fs.writeFile(file, '  \n');
    const log = spyLog();
    expect(await readJsonOrQuarantine(file, { recognize, log })).toEqual({ status: 'empty', value: null });
    expect(log.warn).toHaveBeenCalledOnce();
    expect(await fs.readdir(dir)).toEqual([path.basename(file)]);
  });

  it.each([
    ['不是 JSON', '{ not json'],
    ['顶层是数组', '[1, 2]'],
    ['顶层是数字', '42'],
    ['形状认不出', JSON.stringify({ schemaVersion: 1, items: 'nope' })],
  ])('%s: renamed and kept, logs warn', async (_label, text) => {
    await fs.writeFile(file, text);
    const log = spyLog();
    const read = await readJsonOrQuarantine(file, { recognize, log });
    expect(read.status).toBe('quarantined');
    const names = await corruptNames();
    expect(names).toHaveLength(1);
    expect(await fs.readFile(path.join(dir, names[0]!), 'utf8')).toBe(text);
    expect(await fs.stat(file).catch(() => null)).toBeNull();
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('version higher than known: not renamed, logs warn, treated as empty (version check before shape check)', async () => {
    const text = JSON.stringify({ schemaVersion: 2, entries: {} });
    await fs.writeFile(file, text);
    const log = spyLog();
    expect(await readJsonOrQuarantine(file, { recognize, log })).toEqual({ status: 'newer-version', value: null, version: 2 });
    expect(await fs.readFile(file, 'utf8')).toBe(text);
    expect(await corruptNames()).toEqual([]);
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('file without a version field (early files) still passed to recognize as usual', async () => {
    await fs.writeFile(file, JSON.stringify({ items: [1] }));
    expect(await readJsonOrQuarantine(file, { recognize })).toEqual({ status: 'ok', value: [1] });
  });

  it('quarantine: false: unrecognized file not renamed', async () => {
    await fs.writeFile(file, '{ not json');
    expect(await readJsonOrQuarantine(file, { recognize, quarantine: false })).toEqual({ status: 'unrecognized', value: null });
    expect(await fs.readFile(file, 'utf8')).toBe('{ not json');
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('throws when the file system cannot read, not treated as a bad file', async () => {
    await fs.writeFile(file, '{}');
    await fs.chmod(file, 0o000);
    await expect(readJsonOrQuarantine(file, { recognize })).rejects.toMatchObject({ code: 'EACCES' });
    await fs.chmod(file, 0o600);
    expect(await corruptNames()).toEqual([]);
  });
});

describe('JsonStoreFile', () => {
  it('after reading a newer-version file, it is no longer written', async () => {
    const text = JSON.stringify({ schemaVersion: 9 });
    await fs.writeFile(file, text);
    const log = spyLog();
    const store = new JsonStoreFile(file, log);
    await store.read({ recognize: (raw) => raw });
    expect(store.readOnly).toBe(true);
    await store.write({ schemaVersion: 1 });
    await store.write({ schemaVersion: 1 });
    expect(await fs.readFile(file, 'utf8')).toBe(text);
    // One entry read, plus one entry that was skipped on write (counted once).
    expect(log.warn).toHaveBeenCalledTimes(2);
  });
});

/** A class of Store that can start empty: a corrupt file is renamed and kept. A version that is too high is neither renamed nor overwritten. An empty file is treated as missing. */
interface Case {
  name: string;
  /** Opens and reads the store. Returns a digest of the Store's current content (equal to `empty` when empty). */
  load: (file: string, log: StoreLog) => Promise<{ summary: unknown; write: () => Promise<unknown> }>;
  empty: unknown;
  versionKey?: string;
}

const cases: Case[] = [
  {
    name: 'ProjectStore',
    empty: [],
    load: async (f, log) => {
      const store = new ProjectStore(f, { log });
      const summary = await store.load();
      return {
        summary,
        write: () =>
          store.put({ id: 'p1', name: 'P', path: '/tmp/p', createdAt: 't', lastOpenedAt: 't', pinned: false, archived: false } as never),
      };
    },
  },
  {
    name: 'SpaceMarkStore',
    empty: null,
    load: async (f, log) => {
      const store = new SpaceMarkStore(f, { log });
      await store.load();
      return { summary: store.get('x').favorite ? 'marked' : null, write: () => store.put('x', { favorite: true, displayName: null, trashedAt: null }) };
    },
  },
  {
    name: 'SpaceArtifactStore',
    empty: [],
    load: async (f, log) => {
      const store = new SpaceArtifactStore(f, { log });
      await store.load();
      return { summary: store.list(), write: () => store.put([{ jobId: 'job-1' } as never]) };
    },
  },
  {
    name: 'SettingsStore',
    empty: false,
    load: async (f, log) => {
      const store = new SettingsStore(f, { log });
      await store.load();
      return { summary: store.get('offline.strict'), write: () => store.set({ 'offline.strict': true }) };
    },
  },
  {
    name: 'AgentPrefsStore',
    empty: [],
    load: async (f, log) => {
      const store = new AgentPrefsStore(f, { log });
      const prefs = await store.load();
      return { summary: prefs.rules, write: () => store.update((p) => void p.rules.push('r')) };
    },
  },
  {
    name: 'AgentProviderStore',
    empty: [],
    load: async (f, log) => {
      const store = new AgentProviderStore(f, { log });
      const list = await store.load();
      return { summary: list, write: () => store.add({ id: 'mine', name: 'Mine', command: ['mine'], addedAt: new Date(0).toISOString() } as never) };
    },
  },
  {
    name: 'AgentProbeStore',
    empty: {},
    load: async (f, log) => {
      const store = new AgentProbeStore(f, { log });
      return { summary: await store.load(), write: () => store.save({}) };
    },
  },
  {
    name: 'SkillPrefsStore',
    empty: {},
    load: async (f, log) => {
      const store = new SkillPrefsStore(f, { log });
      const prefs = await store.load();
      return { summary: prefs.enabled, write: () => store.set('my-skill', false, true) };
    },
  },
];

describe.each(cases)('$name', ({ load, empty }) => {
  it('bad file renamed and kept, logs warn, starts empty; later writes create a new file', async () => {
    await fs.writeFile(file, '{ not json');
    const log = spyLog();
    const { summary, write } = await load(file, log);
    expect(summary).toEqual(empty);
    expect(log.warn).toHaveBeenCalled();
    const names = await corruptNames();
    expect(names).toHaveLength(1);
    expect(await fs.readFile(path.join(dir, names[0]!), 'utf8')).toBe('{ not json');
    await write();
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toMatchObject({ schemaVersion: 1 });
  });

  it('unrecognized top-level structure likewise renamed and kept', async () => {
    await fs.writeFile(file, '[]');
    const { summary } = await load(file, spyLog());
    expect(summary).toEqual(empty);
    expect(await corruptNames()).toHaveLength(1);
  });

  it('version higher than known: treated as empty, not renamed, later writes do not overwrite it', async () => {
    const text = JSON.stringify({ schemaVersion: 99, future: true });
    await fs.writeFile(file, text);
    const log = spyLog();
    const { summary, write } = await load(file, log);
    expect(summary).toEqual(empty);
    await write();
    expect(await fs.readFile(file, 'utf8')).toBe(text);
    expect(await corruptNames()).toEqual([]);
    expect(log.warn).toHaveBeenCalled();
  });

  it('empty file treated as absent, not renamed', async () => {
    await fs.writeFile(file, '');
    const { summary } = await load(file, spyLog());
    expect(summary).toEqual(empty);
    expect(await corruptNames()).toEqual([]);
  });
});

describe('GrantStore (grant ledger must not be silently lost)', () => {
  it('bad file: open fails, file left as is, not renamed', async () => {
    await fs.writeFile(file, '{ not json');
    await expect(GrantStore.open(file)).rejects.toThrow(/Malformed grants file/);
    expect(await fs.readFile(file, 'utf8')).toBe('{ not json');
    expect(await corruptNames()).toEqual([]);
  });

  it('unrecognized top-level structure: open fails', async () => {
    await fs.writeFile(file, JSON.stringify({ schemaVersion: 1, grants: {} }));
    await expect(GrantStore.open(file)).rejects.toThrow(/Malformed grants file/);
  });

  it('written by a newer version: open fails, not rewritten', async () => {
    const text = JSON.stringify({ schemaVersion: 2, ledger: [] });
    await fs.writeFile(file, text);
    await expect(GrantStore.open(file)).rejects.toThrow(/newer version/);
    expect(await fs.readFile(file, 'utf8')).toBe(text);
  });

  it('empty file treated as absent', async () => {
    await fs.writeFile(file, '');
    const store = await GrantStore.open(file);
    expect(store.list({ includeEnded: true })).toEqual([]);
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PUBLISHING_HISTORY_LIMIT, RpcError, type Publication, type PublishingHistoryEntry } from '@cuccut/protocol';
import { publicationSchema } from '@cuccut/protocol/schemas';
import { migratePublishingFile, PublishingStore, type PublishingCommit } from './publishing-store.ts';

const T0 = '2026-10-13T10:00:00.000Z';

function publication(id: string, overrides: Partial<Publication> = {}): Publication {
  return publicationSchema.parse({
    id,
    videoId: 'video_1',
    sequenceId: 'seq_1',
    label: `Clip ${id}`,
    timezone: 'UTC',
    revision: 0,
    createdAt: T0,
    updatedAt: T0,
    destinations: [{ id: `${id}_d`, accountId: 'acc_1', format: 'youtube-short' }],
    ...overrides,
  });
}

function historyEntry(n: number): PublishingHistoryEntry {
  return {
    publicationId: 'p',
    destinationId: `d${n}`,
    replacedAt: T0,
    payload: {
      exportId: 'sha256:x',
      accountId: 'acc_1',
      connectionId: 'conn_1',
      remoteAccountId: '@me',
      network: 'youtube',
      format: 'youtube-short',
      title: '',
      caption: '',
      hashtags: [],
      options: {
        useProviderDefaults: false,
        privacy: 'public',
        madeForKids: false,
        synthetic: false,
        branded: false,
        ownBrand: false,
        comments: true,
        duet: false,
        stitch: false,
        tags: [],
      },
      scheduledAt: null,
      timezone: 'UTC',
    },
  };
}

function rpcCode(error: unknown): string | undefined {
  expect(error).toBeInstanceOf(RpcError);
  return ((error as RpcError).details as { code?: string } | undefined)?.code;
}

describe('PublishingStore', () => {
  let dir: string;
  let file: string;
  let now: Date;
  const opened: PublishingStore[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-'));
    file = path.join(dir, 'store', 'publishing.json');
    now = new Date('2026-10-13T12:00:00Z');
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((store) => store.flush()));
    await fs.chmod(path.join(dir, 'store'), 0o755).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  });

  const open = async () => {
    const store = await PublishingStore.open(file, { now: () => now, defaultTimezone: () => 'Asia/Ho_Chi_Minh' });
    opened.push(store);
    return store;
  };

  const writeFile = async (content: string) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };

  describe('reading', () => {
    it('a missing file starts from defaults and is written, 0600, with the first change', async () => {
      const store = await open();
      expect(store.state).toBe('ok');
      expect(store.problem).toBeNull();
      expect(store.settings()).toMatchObject({ timezone: 'Asia/Ho_Chi_Minh', minGapMinutes: 60, leadMinutes: 30, archivedRetentionDays: 90, revision: 0 });
      expect(store.publications()).toEqual([]);
      await expect(fs.access(file)).rejects.toThrow();
      await store.transact((tx) => tx.insertPublication(publication('a')));
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      expect(raw.schemaVersion).toBe(1);
      expect(raw.settings.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(raw.publications).toHaveLength(1);
      if (process.platform !== 'win32') expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    });

    it('an empty file is treated as missing', async () => {
      await writeFile('  \n');
      const store = await open();
      expect(store.state).toBe('ok');
      expect(store.publications()).toEqual([]);
    });

    it('an unrecognized file is left in place, and the store is unavailable', async () => {
      for (const content of ['{not json', '[]', JSON.stringify({ schemaVersion: 1, settings: 'nope' }), JSON.stringify({ hello: 1 })]) {
        await writeFile(content);
        const store = await open();
        expect(store.state).toBe('unavailable');
        expect(store.problem).toEqual({ key: 'runtimeStoragePublishing.unreadable' });
        expect(store.publications()).toEqual([]);
        await store.transact(() => undefined).then(
          () => expect.unreachable(),
          (error) => expect(rpcCode(error)).toBe('PUBLISHING_UNAVAILABLE'),
        );
        expect(await fs.readFile(file, 'utf8')).toBe(content);
        expect((await fs.readdir(path.dirname(file))).filter((name) => name !== 'publishing.json')).toEqual([]);
      }
    });

    it('a file from a newer version is shown read-only and never written', async () => {
      const content = JSON.stringify({ schemaVersion: 2, settings: { timezone: 'UTC', futureField: true }, publications: [publication('a')] });
      await writeFile(content);
      const store = await open();
      expect(store.state).toBe('read-only');
      expect(store.problem).toEqual({ key: 'runtimeStoragePublishing.newerVersion' });
      expect(store.publications().map((p) => p.id)).toEqual(['a']);
      const error = await store.change('a', 0, (p) => void (p.label = 'x')).catch((e: unknown) => e);
      expect(rpcCode(error)).toBe('PUBLISHING_UNAVAILABLE');
      expect((error as RpcError).code).toBe('unsupported');
      await store.flush();
      expect(await fs.readFile(file, 'utf8')).toBe(content);
    });

    it('migrates a version 1 fixture, filling defaults', async () => {
      const fixture = {
        schemaVersion: 1,
        settings: { timezone: 'Europe/Berlin', revision: 4 },
        connections: [{ id: 'conn_1', provider: 'manual', name: 'By hand', configured: true }],
        accounts: [{ id: 'acc_1', connectionId: 'conn_1', remoteId: '@me', network: 'tiktok', name: 'Me' }],
        publications: [{ id: 'a', videoId: 'v', sequenceId: 's', label: 'A', timezone: 'UTC', revision: 2, createdAt: T0, updatedAt: T0 }],
      };
      const migrated = migratePublishingFile(fixture);
      expect(migrated).not.toBeNull();
      expect(migrated!.settings).toMatchObject({ timezone: 'Europe/Berlin', revision: 4, slots: [] });
      expect(migrated!.accounts[0]).toMatchObject({ disabled: false, needsReconnect: false, equivalentTo: null });
      expect(migrated!.publications[0]).toMatchObject({ destinations: [], archived: false, copy: { title: '', description: '', hashtags: [] } });
      expect(migrated!.history).toEqual([]);
      expect(migratePublishingFile({ ...fixture, schemaVersion: 0 })).toBeNull();
      await writeFile(JSON.stringify(fixture));
      const store = await open();
      expect(store.state).toBe('ok');
      expect(store.publication('a')?.revision).toBe(2);
    });
  });

  describe('changes', () => {
    it('a change bumps the revision and updatedAt; a stale revision is refused with the saved record', async () => {
      const store = await open();
      await store.transact((tx) => tx.insertPublication(publication('a')));
      const saved = await store.change('a', 0, (p) => void (p.label = 'Renamed'));
      expect(saved).toMatchObject({ label: 'Renamed', revision: 1, updatedAt: now.toISOString() });
      const error = await store.change('a', 0, (p) => void (p.label = 'Lost')).catch((e: unknown) => e);
      expect((error as RpcError).code).toBe('conflict');
      expect(rpcCode(error)).toBe('PUBLICATION_CONFLICT');
      expect(((error as RpcError).details as { current: Publication }).current).toMatchObject({ label: 'Renamed', revision: 1 });
      expect(store.publication('a')?.label).toBe('Renamed');
      const missing = await store.change('nope', 0, () => {}).catch((e: unknown) => e);
      expect((missing as RpcError).code).toBe('not-found');
      expect(rpcCode(missing)).toBe('PUBLICATION_NOT_FOUND');
    });

    it('settings have their own revision', async () => {
      const store = await open();
      const saved = await store.change('settings', 0, (s) => void (s.slots = [{ weekday: 1, time: '18:00' }]));
      expect(saved).toMatchObject({ revision: 1, slots: [{ weekday: 1, time: '18:00' }] });
      const error = await store.change('settings', 0, (s) => void (s.writing = 'x')).catch((e: unknown) => e);
      expect(rpcCode(error)).toBe('SETTINGS_CONFLICT');
      expect(((error as RpcError).details as { current: { revision: number } }).current.revision).toBe(1);
    });

    it('a transaction that throws, or would save an invalid record, changes nothing', async () => {
      const store = await open();
      await store.transact((tx) => tx.insertPublication(publication('a')));
      await expect(
        store.transact((tx) => {
          tx.publication('a').label = 'Half';
          tx.accounts().push({ id: 'acc', connectionId: 'c', remoteId: '@x', network: 'youtube', name: 'X', disabled: false, needsReconnect: false, equivalentTo: null });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      const invalid = await store
        .change('a', 0, (p) => {
          p.label = 'Fine';
          p.scheduledAt = 'next tuesday';
        })
        .catch((e: unknown) => e);
      expect(rpcCode(invalid)).toBe('RECORD_INVALID');
      expect(store.publication('a')).toMatchObject({ label: 'Clip a', revision: 0, scheduledAt: null });
      expect(store.accounts()).toEqual([]);
      await expect(store.transact((tx) => tx.insertPublication(publication('a')))).rejects.toBeInstanceOf(RpcError);
      await expect(store.transact(async () => {})).rejects.toThrow(TypeError);
    });

    it('reads are copies', async () => {
      const store = await open();
      await store.transact((tx) => tx.insertPublication(publication('a')));
      store.publications()[0]!.label = 'changed outside';
      store.publication('a')!.destinations.length = 0;
      expect(store.publication('a')).toMatchObject({ label: 'Clip a', destinations: [{ id: 'a_d' }] });
      expect(store.read((doc) => doc.publications.length)).toBe(1);
    });

    it('serialized writes keep every concurrent change', async () => {
      const store = await open();
      await store.transact((tx) => {
        for (let n = 0; n < 20; n++) tx.insertPublication(publication(`p${n}`));
      });
      const changes = Array.from({ length: 20 }, (_, n) => store.change(`p${n}`, 0, (p) => void (p.label = `Changed ${n}`)));
      changes.push(store.change('p0', 0, (p) => void (p.label = 'Stale')).catch(() => store.publication('p0')!));
      const settings = store.change('settings', 0, (s) => void (s.leadMinutes = 45));
      await Promise.all([...changes, settings]);
      const reopened = await PublishingStore.open(file);
      expect(reopened.publications().map((p) => p.label)).toEqual(Array.from({ length: 20 }, (_, n) => `Changed ${n}`));
      expect(reopened.publications().every((p) => p.revision === 1)).toBe(true);
      expect(reopened.settings().leadMinutes).toBe(45);
    });

    it('lists, history, imports and deletion; commits are reported', async () => {
      const store = await open();
      const commits: PublishingCommit[] = [];
      store.onCommit((commit) => commits.push(commit));
      await store.transact((tx) => {
        tx.insertPublication(publication('a'));
        tx.insertPublication(publication('b'));
        tx.connections().push({ id: 'conn_1', provider: 'manual', name: 'By hand', baseUrl: '', configured: true, checkedAt: null, error: null, errorRef: null });
        tx.addImport({ id: 'imp_1', at: T0, added: ['a'], backup: 'backups/x.json' });
      });
      expect(commits[0]).toMatchObject({ removed: [], settings: null, connections: true, accounts: false, exports: false });
      expect(commits[0]!.publications.map((p) => p.id)).toEqual(['a', 'b']);
      await store.transact((tx) => {
        for (let n = 0; n < PUBLISHING_HISTORY_LIMIT + 5; n++) tx.addHistory({ ...historyEntry(n), publicationId: n % 2 ? 'a' : 'b' });
      });
      const history = store.history();
      expect(history).toHaveLength(PUBLISHING_HISTORY_LIMIT);
      expect(history[0]!.destinationId).toBe('d5');
      await store.transact((tx) => tx.deletePublication('b'));
      expect(commits.at(-1)).toMatchObject({ removed: ['b'], publications: [] });
      expect(store.publications().map((p) => p.id)).toEqual(['a']);
      expect(store.history().every((h) => h.publicationId === 'a')).toBe(true);
      expect(store.imports()).toHaveLength(1);
      expect(store.connections()).toHaveLength(1);
      // A transaction that touches nothing writes nothing and reports nothing.
      const count = commits.length;
      await store.transact(() => 'nothing');
      expect(commits).toHaveLength(count);
      const reopened = await PublishingStore.open(file);
      expect(reopened.snapshot()).toEqual(store.snapshot());
    });

    it('a failed write keeps the change in memory, rejects, and is written again later', async () => {
      if (process.platform === 'win32') return;
      const store = await open();
      await store.transact((tx) => tx.insertPublication(publication('a')));
      await fs.chmod(path.dirname(file), 0o500);
      const error = await store.change('a', 0, (p) => void (p.label = 'Kept')).catch((e: unknown) => e);
      expect(rpcCode(error)).toBe('PUBLISHING_WRITE_FAILED');
      expect(store.publication('a')).toMatchObject({ label: 'Kept', revision: 1 });
      await fs.chmod(path.dirname(file), 0o755);
      await store.flush();
      const reopened = await PublishingStore.open(file);
      expect(reopened.publication('a')).toMatchObject({ label: 'Kept', revision: 1 });
    });
  });
});

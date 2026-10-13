import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CredentialStoreError, FileCredentialStore, type CredentialStore } from '@cuccut/runtime-storage';
import { CLIENT_ID_PATTERN, NodeStore } from './node-store.ts';

/** Stand-in for the credential store: keeps values in memory, and can make `set` fail for some keys. */
class MemoryCredentials implements CredentialStore {
  readonly kind = 'keychain' as const;
  readonly items = new Map<string, string>();
  failSet: (key: string) => boolean = () => false;
  failAll = false;
  async get(key: string) {
    if (this.failAll) throw new CredentialStoreError('denied', '钥匙串拒绝访问');
    return this.items.get(key) ?? null;
  }
  async set(key: string, secret: string) {
    if (this.failAll || this.failSet(key)) throw new CredentialStoreError('denied', '钥匙串拒绝访问');
    this.items.set(key, secret);
  }
  async delete(key: string) {
    if (this.failAll) throw new CredentialStoreError('unavailable', '钥匙串被锁');
    this.items.delete(key);
  }
  async has(key: string) {
    return this.items.has(key);
  }
}

describe('NodeStore', () => {
  let dir: string;
  let file: string;
  let credentials: FileCredentialStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-node-store-'));
    file = path.join(dir, 'store', 'nodes.json');
    credentials = new FileCredentialStore(path.join(dir, 'store', 'model-credentials.json'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const node = (nodeId: string, name: string, extra: object = {}) => ({
    nodeId,
    name,
    host: '10.0.0.2',
    port: 47610,
    token: `tok-${nodeId}`,
    ...extra,
  });
  const mode = async () => (await fs.stat(file)).mode & 0o777;

  it('first open generates a clientId and writes it to disk as 0600; reopening leaves it unchanged', async () => {
    const store = await NodeStore.open(file, credentials);
    expect(store.clientId).toMatch(CLIENT_ID_PATTERN);
    expect(await mode()).toBe(0o600);
    const reopened = await NodeStore.open(file, credentials);
    expect(reopened.clientId).toBe(store.clientId);
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ formatVersion: 1, clientId: store.clientId, nodes: [] });
  });

  it('corrupt file or invalid clientId: regenerates', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{ not json');
    const store = await NodeStore.open(file, credentials);
    expect(store.clientId).toMatch(CLIENT_ID_PATTERN);
    await fs.writeFile(file, JSON.stringify({ formatVersion: 1, clientId: 'has.dot', nodes: [] }));
    expect((await NodeStore.open(file, credentials)).clientId).not.toBe('has.dot');
  });

  it('corrupt file: renames it to keep it first, then generates a new clientId', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{ not json');
    const store = await NodeStore.open(file, credentials);
    const names = await fs.readdir(path.dirname(file));
    const kept = names.find((n) => n.startsWith('nodes.json.corrupt-'));
    expect(kept).toBeDefined();
    expect(await fs.readFile(path.join(path.dirname(file), kept!), 'utf8')).toBe('{ not json');
    expect(JSON.parse(await fs.readFile(file, 'utf8')).clientId).toBe(store.clientId);
  });

  it('file written by a newer version: neither renamed nor overwritten; this time uses a clientId that exists only in memory', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const text = JSON.stringify({ formatVersion: 2, clientId: 'c_future', peers: [] });
    await fs.writeFile(file, text);
    const store = await NodeStore.open(file, credentials);
    expect(store.clientId).toMatch(CLIENT_ID_PATTERN);
    expect(await fs.readFile(file, 'utf8')).toBe(text);
    expect((await fs.readdir(path.dirname(file))).some((n) => n.includes('.corrupt-'))).toBe(false);
  });

  it('writes: atomic (no temp files left), 0600 (even if the original file\'s permissions were loosened); token only in the credential store', async () => {
    const store = await NodeStore.open(file, credentials);
    await fs.chmod(file, 0o644);
    await store.upsert(node('node_a', 'Studio'));
    expect(await mode()).toBe(0o600);
    expect((await fs.readdir(path.dirname(file))).sort()).toEqual(['model-credentials.json', 'nodes.json']);
    const saved = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(saved.nodes).toEqual([
      {
        nodeId: 'node_a',
        alias: 'Studio',
        name: 'Studio',
        host: '10.0.0.2',
        port: 47610,
        pairedAt: expect.any(String),
      },
    ]);
    expect(await fs.readFile(file, 'utf8')).not.toContain('tok-node_a');
    expect(await credentials.get('node:node_a')).toBe('tok-node_a');
    expect(await store.token('node_a')).toBe('tok-node_a');
    expect(store.get('node_a')).not.toHaveProperty('token');
    // Concurrent writes are serialized, so the final state is complete.
    await Promise.all(['b', 'c', 'd', 'e'].map((x) => store.upsert(node(`node_${x}`, `N${x}`))));
    const reopened = await NodeStore.open(file, credentials);
    expect(reopened.list().map((n) => n.nodeId)).toEqual(['node_a', 'node_b', 'node_c', 'node_d', 'node_e']);
  });

  it('alias is unique: defaults to the name, adds a number on conflict; cannot equal another node\'s nodeId; a specified alias that conflicts yields conflict', async () => {
    const store = await NodeStore.open(file, credentials);
    expect((await store.upsert(node('node_a', 'Studio'))).alias).toBe('Studio');
    expect((await store.upsert(node('node_b', 'Studio'))).alias).toBe('Studio-2');
    expect((await store.upsert(node('node_c', ' Studio '))).alias).toBe('Studio-3');
    expect((await store.upsert(node('node_d', 'node_a'))).alias).toBe('node_a-2');
    await expect(store.upsert(node('node_e', 'X', { alias: 'Studio' }))).rejects.toMatchObject({ code: 'conflict' });
    await expect(store.upsert(node('node_e', 'X', { alias: 'node_b' }))).rejects.toMatchObject({ code: 'conflict' });
    await expect(store.upsert(node('node_e', 'X', { alias: '' }))).rejects.toMatchObject({ code: 'invalid-request' });
    expect((await store.upsert(node('node_e', 'X', { alias: 'edit-bay' }))).alias).toBe('edit-bay');
    expect(store.resolve('edit-bay')?.nodeId).toBe('node_e');
    expect(store.resolve('node_b')?.nodeId).toBe('node_b');
    expect(store.resolve('Studio-2')?.nodeId).toBe('node_b');
    expect(store.resolve('nope')).toBeNull();
  });

  it('same nodeId paired again: replaces the record and token, keeps the alias (unless a new one is given)', async () => {
    const store = await NodeStore.open(file, credentials);
    await store.upsert(node('node_a', 'Studio', { alias: 'mine' }));
    const replaced = await store.upsert(node('node_a', 'Studio Renamed', { host: '10.0.0.9', token: 'tok-new' }));
    expect(replaced).toMatchObject({ alias: 'mine', name: 'Studio Renamed', host: '10.0.0.9' });
    expect(await store.token('node_a')).toBe('tok-new');
    expect(store.list()).toHaveLength(1);
    // One's own alias is not a conflict.
    expect((await store.upsert(node('node_a', 'Studio', { alias: 'mine' }))).alias).toBe('mine');
    expect((await store.upsert(node('node_a', 'Studio', { alias: 'other' }))).alias).toBe('other');
  });

  it('delete: removes only this one node; returns false when it does not exist', async () => {
    const store = await NodeStore.open(file, credentials);
    await store.upsert(node('node_a', 'A'));
    await store.upsert(node('node_b', 'B'));
    expect(await store.remove('node_a')).toBe(true);
    expect(await store.remove('node_a')).toBe(false);
    expect((await NodeStore.open(file, credentials)).list().map((n) => n.nodeId)).toEqual(['node_b']);
    expect(await credentials.has('node:node_a')).toBe(false);
    expect(await credentials.get('node:node_b')).toBe('tok-node_b');
  });

  const legacyFile = async (nodes: Array<{ nodeId: string; token: string }>) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({
        formatVersion: 1,
        clientId: 'c_legacy',
        nodes: nodes.map(({ nodeId, token }) => ({ nodeId, alias: nodeId, name: nodeId, host: '10.0.0.2', port: 1, token, pairedAt: 'x' })),
      }),
    );
  };

  it('token in an old file: migrated into the credential store on open, no token left in the file', async () => {
    await legacyFile([
      { nodeId: 'node_a', token: 'c_legacy.secret-a' },
      { nodeId: 'node_b', token: 'c_legacy.secret-b' },
    ]);
    const store = await NodeStore.open(file, credentials);
    expect(store.clientId).toBe('c_legacy');
    expect(store.list().map((n) => n.nodeId)).toEqual(['node_a', 'node_b']);
    expect(await store.token('node_b')).toBe('c_legacy.secret-b');
    expect(await fs.readFile(file, 'utf8')).not.toContain('secret');
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    // Open it again: it works as usual, with no duplicate migration.
    expect(await (await NodeStore.open(file, credentials)).token('node_a')).toBe('c_legacy.secret-a');
  });

  it('partial migration failure: successfully migrated ones are removed, failed ones stay in the file but are not used; log contains no token', async () => {
    await legacyFile([
      { nodeId: 'node_a', token: 'c_legacy.secret-a' },
      { nodeId: 'node_b', token: 'c_legacy.secret-b' },
    ]);
    const memory = new MemoryCredentials();
    memory.failSet = (key) => key === 'node:node_b';
    const lines: string[] = [];
    const log = {
      info: (m: string, f?: object) => lines.push(m + JSON.stringify(f)),
      warn: (m: string, f?: object) => lines.push(m + JSON.stringify(f)),
      error() {},
    };
    const store = await NodeStore.open(file, memory, log);
    expect(memory.items.get('node:node_a')).toBe('c_legacy.secret-a');
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { nodes: Array<{ nodeId: string; token?: string }> };
    expect(saved.nodes.map((n) => [n.nodeId, n.token ?? null])).toEqual([
      ['node_a', null],
      ['node_b', 'c_legacy.secret-b'],
    ]);
    // A token that has not been migrated does not fall back to the file: if it is not in the credential store, it is simply absent.
    expect(store.credentialProblem('node_b')).toContain('拒绝');
    expect(await store.token('node_b')).toBeNull();
    expect(lines.join('\n')).toContain('node_b');
    expect(lines.join('\n')).not.toContain('secret');
    // Retry on the next start; after a successful retry, the file no longer contains the token.
    memory.failSet = () => false;
    const again = await NodeStore.open(file, memory);
    expect(await again.token('node_b')).toBe('c_legacy.secret-b');
    expect(await fs.readFile(file, 'utf8')).not.toContain('secret');
  });

  it('credential store unavailable: pairing and deletion are rejected with CREDENTIAL_UNAVAILABLE, record unchanged; reading the token reports the reason', async () => {
    const memory = new MemoryCredentials();
    const store = await NodeStore.open(file, memory);
    await store.upsert(node('node_a', 'A'));
    memory.failAll = true;
    const pairing = await store.upsert(node('node_b', 'B', { token: 'tok-secret-b' })).catch((e: unknown) => e);
    expect(pairing).toMatchObject({ code: 'conflict', details: { code: 'CREDENTIAL_UNAVAILABLE', reason: 'denied', nodeId: 'node_b' } });
    expect(JSON.stringify(pairing)).not.toContain('tok-secret-b');
    expect((pairing as Error).message).not.toContain('tok-secret-b');
    expect(store.list().map((n) => n.nodeId)).toEqual(['node_a']);
    await expect(store.remove('node_a')).rejects.toMatchObject({ details: { code: 'CREDENTIAL_UNAVAILABLE', reason: 'unavailable' } });
    expect(store.list().map((n) => n.nodeId)).toEqual(['node_a']);
    await expect(store.token('node_a')).rejects.toBeInstanceOf(CredentialStoreError);
    expect(store.credentialProblem('node_a')).toContain('钥匙串拒绝访问');
  });
});

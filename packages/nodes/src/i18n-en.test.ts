import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError, setLocale } from '@cuccut/protocol';
import { NodesServer } from '@cuccut/protocol/messages/nodes';
import { FileCredentialStore } from '@cuccut/runtime-storage';
import { NodeStore } from './client/node-store.ts';

/** When the UI language is English, the node-side error messages shown to people are in English; the initiator's RPC errors carry a message reference. */
describe('nodes English copy', () => {
  let dir: string;

  beforeEach(async () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-nodes-en-'));
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('alias conflict: English error includes the reference', async () => {
    const credentials = new FileCredentialStore(path.join(dir, 'model-credentials.json'));
    const store = await NodeStore.open(path.join(dir, 'nodes.json'), credentials);
    const base = { name: 'Studio', host: '127.0.0.1', port: 7000, token: `${store.clientId}.secret` };
    await store.upsert({ ...base, nodeId: 'node_a', alias: 'Studio' } as never);
    const error = await store.upsert({ ...base, nodeId: 'node_b', alias: 'Studio' } as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).message).toBe('Another node already uses this alias: Studio');
    expect((error as RpcError).messageRef?.key).toBe('nodesClient.aliasTaken');
  });

  it('explanation the node service returns to the peer is in the local language', () => {
    expect(NodesServer.portInUse({ port: 7000 }).text).toBe('Port 7000 is already in use');
    expect(NodesServer.capabilityNotShareable({ capability: 'x', shareable: 'transcribe' }).text).not.toMatch(/[一-龥]/);
  });
});

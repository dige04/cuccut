import { beforeEach, describe, expect, it } from 'vitest';
import type { PairedNode, ShareStatus } from '@cuccut/protocol';
import { RuntimeSession } from '../../runtime/session.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useShare } from '../../state/share-store.ts';
import {
  flipShare,
  pairNode,
  refreshNodes,
  refreshShare,
  renewPairingCode,
  revokeShareClient,
  setShareCapability,
  unpairNode,
} from './share-commands.ts';

const status = (patch: Partial<ShareStatus> = {}): ShareStatus => ({
  enabled: false,
  listening: false,
  error: null,
  nodeId: 'node_self',
  name: 'Studio',
  port: 47610,
  addresses: [],
  allowAnySource: false,
  capabilities: { transcribe: { enabled: true } },
  pairing: null,
  clients: [],
  jobs: { running: 0, queued: 0 },
  ...patch,
});

const node = (nodeId: string): PairedNode => ({
  nodeId,
  alias: nodeId,
  name: nodeId,
  host: '192.168.1.31',
  port: 47610,
  pairedAt: '2026-10-01T00:00:00Z',
  health: null,
  problem: 'unreachable',
});

type Handler = (params: unknown) => unknown;

/** Only swaps the session of `client.request`: it records the methods and parameters sent, and answers by method name (the answer can be a Promise that waits to be released). */
function fakeSession(handlers: Record<string, Handler>) {
  const calls: Array<[string, unknown]> = [];
  const session = Object.create(RuntimeSession.prototype) as RuntimeSession;
  Object.defineProperty(session, 'client', {
    value: {
      request: async (method: string, params: unknown) => {
        calls.push([method, params]);
        const handler = handlers[method];
        if (!handler) throw new Error(`没有准备 ${method}`);
        return handler(params);
      },
    },
  });
  return { session, calls };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  useShare.setState({ status: null, phase: null, nodes: null });
  useConnection.setState({ state: { status: 'connected', connectionId: 'c1' } as never });
});

describe('commands for sharing this Mac', () => {
  it('start sharing: those one or two seconds are "starting", the whole result is written back', async () => {
    const gate = deferred<ShareStatus>();
    const { session, calls } = fakeSession({ 'nodes.share.start': () => gate.promise });
    const running = flipShare(session, true);
    expect(useShare.getState().phase).toBe('starting');
    expect(await flipShare(session, true)).toBeNull();
    gate.resolve(status({ enabled: true, listening: true, pairing: { code: '481924', expiresAt: '2026-10-03T10:10:00Z' } }));
    await running;
    expect(useShare.getState().phase).toBeNull();
    expect(useShare.getState().status?.listening).toBe(true);
    expect(calls).toEqual([['nodes.share.start', {}]]);
  });

  it('when stopping sharing fails, clear "stopping" and throw the error', async () => {
    useShare.setState({ status: status({ enabled: true, listening: true }) });
    const { session } = fakeSession({
      'nodes.share.stop': () => {
        throw new Error('Runtime 正在停止');
      },
    });
    await expect(flipShare(session, false)).rejects.toThrow('Runtime 正在停止');
    expect(useShare.getState().phase).toBeNull();
    expect(useShare.getState().status?.enabled).toBe(true);
  });

  it('a polling result arriving after a change does not overwrite the change', async () => {
    const poll = deferred<ShareStatus>();
    const { session } = fakeSession({
      'nodes.share.status': () => poll.promise,
      'nodes.share.setCapability': () => status({ capabilities: { transcribe: { enabled: false } } }),
    });
    const reading = refreshShare(session);
    await setShareCapability(session, 'transcribe', false);
    poll.resolve(status());
    expect(await reading).toBeNull();
    expect(useShare.getState().status?.capabilities.transcribe?.enabled).toBe(false);
  });

  it('not read when not connected to Runtime; a failed read does not change the mirror', async () => {
    const { session, calls } = fakeSession({
      'nodes.share.status': () => {
        throw new Error('断了');
      },
    });
    useConnection.setState({ state: { status: 'disconnected', reason: 'x', retryInMs: null } });
    expect(await refreshShare(session)).toBeNull();
    expect(calls).toEqual([]);
    useConnection.setState({ state: { status: 'connected', connectionId: 'c1' } as never });
    useShare.setState({ status: status({ enabled: true }) });
    expect(await refreshShare(session)).toBeNull();
    expect(useShare.getState().status?.enabled).toBe(true);
  });

  it('regenerate pairing code, revoke and toggle capability all carry the right parameters and write back', async () => {
    const { session, calls } = fakeSession({
      'nodes.share.pairingCode': () => status({ enabled: true, pairing: { code: '111222', expiresAt: '2026-10-03T10:10:00Z' } }),
      'nodes.share.revoke': () => status({ enabled: true, clients: [] }),
      'nodes.share.setCapability': (p) => status({ capabilities: { transcribe: { enabled: (p as { enabled: boolean }).enabled } } }),
    });
    await renewPairingCode(session);
    expect(useShare.getState().status?.pairing).toEqual({ code: '111222', expiresAt: '2026-10-03T10:10:00Z' });
    await revokeShareClient(session, 'client_a');
    await setShareCapability(session, 'transcribe', true);
    expect(calls).toEqual([
      ['nodes.share.pairingCode', {}],
      ['nodes.share.revoke', { clientId: 'client_a' }],
      ['nodes.share.setCapability', { capability: 'transcribe', enabled: true }],
    ]);
  });
});

describe('commands for using other computers', () => {
  it('read paired nodes; after pairing, add to the list, the same node replaces the original entry', async () => {
    const { session, calls } = fakeSession({
      'nodes.list': () => ({ nodes: [node('node_a')] }),
      'nodes.pair': () => ({ node: { ...node('node_a'), problem: null } }),
    });
    await refreshNodes(session);
    expect(useShare.getState().nodes?.map((n) => n.nodeId)).toEqual(['node_a']);
    await pairNode(session, { host: '192.168.1.31', port: 47610, code: '481924' });
    expect(useShare.getState().nodes).toHaveLength(1);
    expect(useShare.getState().nodes?.[0]?.problem).toBeNull();
    expect(calls[1]).toEqual(['nodes.pair', { host: '192.168.1.31', port: 47610, code: '481924' }]);
  });

  it('unpairing removes only that one machine', async () => {
    useShare.setState({ nodes: [node('node_a'), node('node_b')] });
    const { session, calls } = fakeSession({ 'nodes.remove': () => ({}) });
    await unpairNode(session, 'node_a');
    expect(useShare.getState().nodes?.map((n) => n.nodeId)).toEqual(['node_b']);
    expect(calls).toEqual([['nodes.remove', { nodeId: 'node_a' }]]);
  });

  it('pairing failure is rethrown as is, list unchanged', async () => {
    useShare.setState({ nodes: [] });
    const { session } = fakeSession({
      'nodes.pair': () => {
        throw new Error('配对码不对');
      },
    });
    await expect(pairNode(session, { host: 'h', port: 1, code: '000000' })).rejects.toThrow('配对码不对');
    expect(useShare.getState().nodes).toEqual([]);
  });
});

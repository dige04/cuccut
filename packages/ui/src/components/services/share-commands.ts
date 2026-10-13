import type { PairedNode, ShareStatus } from '@cuccut/protocol';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useShare } from '../../state/share-store.ts';

/**
 * Remote compute commands (`nodes.share.*` and `nodes.*`). Each change returns the complete `ShareStatus`; once received, it is written back whole to the mirror,
 * and the UI does not change shared state locally. Failures are thrown to the caller as they are, to be shown as a hint.
 *
 * Polling and changes interleave: a status read sent before a change may return after it and overwrite the change's result with the old value. So each time a change writes back,
 * the generation counter is incremented. When a poll returns and the generation has changed, that result is discarded.
 */
let generation = 0;

function write(status: ShareStatus): ShareStatus {
  generation += 1;
  useShare.getState().setStatus(status);
  return status;
}

/** Reads the shared state once into the mirror. If not connected or the read fails, it does not change (no disturbance; the next poll reads it). */
export async function refreshShare(session: RuntimeSession): Promise<ShareStatus | null> {
  if (useConnection.getState().state.status !== 'connected') return null;
  const before = generation;
  try {
    const status = await session.shareStatus();
    if (before !== generation || useShare.getState().phase) return null;
    useShare.getState().setStatus(status);
    return status;
  } catch {
    return null;
  }
}

/** Starts or stops sharing: for those one or two seconds it shows “In progress…”, and the result is written back whole. Pressing again during a start or stop does not send a duplicate. */
export async function flipShare(session: RuntimeSession, on: boolean): Promise<ShareStatus | null> {
  const store = useShare.getState();
  if (store.phase) return null;
  store.setPhase(on ? 'starting' : 'stopping');
  try {
    return write(await (on ? session.startShare() : session.stopShare()));
  } finally {
    useShare.getState().setPhase(null);
  }
}

export async function renewPairingCode(session: RuntimeSession): Promise<ShareStatus> {
  return write(await session.renewPairingCode());
}

export async function revokeShareClient(session: RuntimeSession, clientId: string): Promise<ShareStatus> {
  return write(await session.revokeShareClient(clientId));
}

export async function setShareCapability(session: RuntimeSession, capability: string, enabled: boolean): Promise<ShareStatus> {
  return write(await session.setShareCapability(capability, enabled));
}

// ---- Use other computers ----

let nodesGeneration = 0;

/** Reads the paired nodes once (each with a live probe of 2 seconds). On failure, no change. */
export async function refreshNodes(session: RuntimeSession): Promise<PairedNode[] | null> {
  if (useConnection.getState().state.status !== 'connected') return null;
  const before = nodesGeneration;
  try {
    const nodes = await session.listNodes();
    if (before !== nodesGeneration) return null;
    useShare.getState().setNodes(nodes);
    return nodes;
  } catch {
    return null;
  }
}

/** After successful pairing, puts that node into the list (pairing the same nodeId again replaces the existing entry). */
export async function pairNode(
  session: RuntimeSession,
  params: { host: string; port: number; code: string },
): Promise<PairedNode> {
  const node = await session.pairNode(params);
  nodesGeneration += 1;
  const current = useShare.getState().nodes ?? [];
  useShare.getState().setNodes([...current.filter((n) => n.nodeId !== node.nodeId), node]);
  return node;
}

/** Unpairing: only deletes this machine's record and token. */
export async function unpairNode(session: RuntimeSession, nodeId: string): Promise<void> {
  await session.removeNode(nodeId);
  nodesGeneration += 1;
  const current = useShare.getState().nodes ?? [];
  useShare.getState().setNodes(current.filter((n) => n.nodeId !== nodeId));
}

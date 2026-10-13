import os from 'node:os';
import type { CredentialStore } from '@cuccut/runtime-storage';
import {
  REMOTE_NODE_ERROR,
  RpcError,
  type DiscoveredNode,
  type Localized,
  type NodeHealth,
  type PairedNode,
  type RemoteNodeLostReason,
  type RemoteNodeRejectReason,
} from '@cuccut/protocol';
import { silentNodeLog, type NodeLogger } from '../node-logger.ts';
import { noDiscoverer, type Discoverer } from './discovery.ts';
import { NodeClient, NodeConnectionError, NodeResponseError, rejectReason, versionCompatible } from './node-http.ts';
import { NodeStore, type PairedNodeRecord } from './node-store.ts';
import { RemoteNodeProvider, type RemoteTiming } from './remote-provider.ts';
import { NodesClient as NC } from '@cuccut/protocol/messages/nodes';

/**
 * Initiator (architecture design §6.7; node protocol spec §9–§12): storage for paired nodes, the remote node Provider, and the implementation of
 * `nodes.discover`, `nodes.pair`, `nodes.list` and `nodes.remove` on the local gateway. The Runtime only wires these up.
 *
 * Gateway errors: pairing failures use `REMOTE_NODE_REJECTED` / `REMOTE_NODE_LOST`, as remote tasks do, in `RpcError.details.code`,
 * and `details.reason` gives the cause (`RpcError.code` is `conflict`, the same approach as `MODEL_UNAVAILABLE`).
 */

export interface NodeInitiatorOptions {
  /** `<home>/store/nodes.json`。 */
  file: string;
  /** Token storage (`node:<nodeId>`, architecture design §6.8). */
  credentials: CredentialStore;
  log?: NodeLogger;
  discoverer?: Discoverer;
  timing?: Partial<RemoteTiming>;
  /** Client name told to the node at pairing; defaults to the hostname. */
  clientName?: string;
  /** Probe deadline per node for `nodes.list` (spec: 2 seconds). */
  probeTimeoutMs?: number;
  /** Deadline for each `nodes.pair` request. */
  pairTimeoutMs?: number;
}

const DEFAULT_DISCOVER_MS = 2_000;
const MAX_DISCOVER_MS = 10_000;
const DEFAULT_PROBE_MS = 2_000;
const DEFAULT_PAIR_MS = 10_000;
/** `nodes.list` checks whether the token is still valid by reading a nonexistent task: 401 means revoked, 404 means valid (the node has no new endpoint). */
const PROBE_JOB_ID = 'job_probe';

export class NodeInitiator {
  readonly store: NodeStore;
  readonly provider: RemoteNodeProvider;
  readonly #log: NodeLogger;
  readonly #discoverer: Discoverer;
  readonly #clientName: string;
  readonly #probeTimeoutMs: number;
  readonly #pairTimeoutMs: number;

  private constructor(store: NodeStore, options: NodeInitiatorOptions) {
    this.store = store;
    this.#log = options.log ?? silentNodeLog;
    this.#discoverer = options.discoverer ?? noDiscoverer;
    this.#clientName = (options.clientName ?? os.hostname()).trim().slice(0, 100) || 'CucCut';
    this.#probeTimeoutMs = options.probeTimeoutMs ?? DEFAULT_PROBE_MS;
    this.#pairTimeoutMs = options.pairTimeoutMs ?? DEFAULT_PAIR_MS;
    this.provider = new RemoteNodeProvider({ nodes: store, log: this.#log, ...(options.timing ? { timing: options.timing } : {}) });
  }

  static async open(options: NodeInitiatorOptions): Promise<NodeInitiator> {
    return new NodeInitiator(await NodeStore.open(options.file, options.credentials, options.log), options);
  }

  get clientId(): string {
    return this.store.clientId;
  }

  /** `nodeId` or alias → `nodeId`; null when there is no such node (JobManager rejects with `not-found` on this basis). */
  resolve(ref: string): string | null {
    return this.store.resolve(ref)?.nodeId ?? null;
  }

  /** Browse nodes on the LAN; `excludeNodeId` is this machine's own node. */
  async discover(timeoutMs: number = DEFAULT_DISCOVER_MS, excludeNodeId: string | null = null): Promise<DiscoveredNode[]> {
    const bounded = Math.min(Math.max(timeoutMs, 1), MAX_DISCOVER_MS);
    const nodes = await this.#discoverer.discover(bounded).catch((error: unknown) => {
      this.#log.warn('Node discovery failed', { error: String(error) });
      return [] as DiscoveredNode[];
    });
    return nodes.filter((node) => !excludeNodeId || node.nodeId !== excludeNodeId);
  }

  /** Pairing (spec §4, §10): check health first (reachability and version), then exchange the pairing code for a token. Pairing the same node again replaces the existing record. */
  async pair(params: { host: string; port: number; code: string; alias?: string }): Promise<PairedNode> {
    const client = new NodeClient(params.host.trim(), params.port);
    let health: NodeHealth;
    try {
      health = await client.health({ timeoutMs: this.#pairTimeoutMs });
    } catch (error) {
      throw pairFailure(error, client);
    }
    if (!health || typeof health.nodeId !== 'string' || !versionCompatible(health)) {
      throw rejectedRpc('version', NC.labelVersionIncompatible({ label: client.label }));
    }
    // The alias is checked before the pairing code is used up.
    if (params.alias !== undefined) this.store.checkAlias(params.alias.trim(), health.nodeId);
    let response: { nodeId?: unknown; name?: unknown; token?: unknown };
    try {
      response = await client.pair(
        { code: params.code.trim(), clientId: this.store.clientId, clientName: this.#clientName },
        { timeoutMs: this.#pairTimeoutMs },
      );
    } catch (error) {
      throw pairFailure(error, client);
    }
    const { nodeId, name, token } = response ?? {};
    if (
      typeof nodeId !== 'string' ||
      !nodeId ||
      typeof name !== 'string' ||
      typeof token !== 'string' ||
      !token.startsWith(`${this.store.clientId}.`)
    ) {
      throw new RpcError('internal', NC.badPairResponse({ label: client.label }));
    }
    const record = await this.store.upsert({
      nodeId,
      name,
      host: client.host,
      port: client.port,
      token,
      ...(params.alias !== undefined ? { alias: params.alias } : {}),
    });
    this.#log.info('Paired with node', { node: nodeId, host: client.label });
    return paired(record, nodeId === health.nodeId ? health : null, null);
  }

  /** Paired nodes, each with one live probe (in parallel, 2 seconds each). */
  async list(): Promise<PairedNode[]> {
    return Promise.all(this.store.list().map((record) => this.#probe(record)));
  }

  /** Probe one paired node (at most 2 seconds); null when there is no such node. */
  async probe(nodeId: string): Promise<PairedNode | null> {
    const record = this.store.get(nodeId);
    return record ? this.#probe(record) : null;
  }

  /** Deletes only this machine's record and token; the pairing on the node side is revoked by the node's user. */
  async remove(nodeId: string): Promise<void> {
    if (!(await this.store.remove(nodeId))) throw new RpcError('not-found', NC.pairedNodeNotFound({ id: nodeId }));
    this.#log.info('Removed node', { node: nodeId });
  }

  async close(): Promise<void> {
    await this.provider.close();
    await this.store.flush();
  }

  async #probe(record: PairedNodeRecord): Promise<PairedNode> {
    const client = new NodeClient(record.host, record.port);
    const deadline = Date.now() + this.#probeTimeoutMs;
    let health: NodeHealth;
    try {
      health = await client.health({ timeoutMs: this.#probeTimeoutMs });
    } catch {
      // Cannot connect, timeout, and a source address rejected (403) all count as unreachable.
      return paired(record, null, 'unreachable');
    }
    if (!health || typeof health !== 'object' || !versionCompatible(health)) return paired(record, health ?? null, 'version');
    if (health.nodeId !== record.nodeId) return paired(record, health, 'unpaired');
    // If the token cannot be read locally (missing, or the credential store is unavailable), this also counts as no longer paired: the pairing is unusable on this machine. The cause is reported by `store.credentialProblem()`.
    const token = await this.store.token(record.nodeId).catch(() => null);
    if (!token) return paired(record, health, 'unpaired');
    try {
      await client.getJob(token, PROBE_JOB_ID, { timeoutMs: Math.max(deadline - Date.now(), 1) });
      return paired(record, health, null);
    } catch (error) {
      if (error instanceof NodeResponseError) {
        if (error.status === 401) return paired(record, health, 'unpaired');
        if (error.status === 426) return paired(record, health, 'version');
        return paired(record, health, null);
      }
      return paired(record, health, 'unreachable');
    }
  }
}

function paired(record: PairedNodeRecord, health: NodeHealth | null, problem: PairedNode['problem']): PairedNode {
  return {
    nodeId: record.nodeId,
    alias: record.alias,
    name: record.name,
    host: record.host,
    port: record.port,
    pairedAt: record.pairedAt,
    health,
    problem,
  };
}

function pairFailure(error: unknown, client: NodeClient): RpcError {
  if (error instanceof NodeConnectionError) return lostRpc('unreachable', NC.labelUnreachable({ label: client.label }));
  if (error instanceof NodeResponseError) {
    const reason = rejectReason(error);
    if (reason) return rejectedRpc(reason, error.message);
    return new RpcError('conflict', NC.pairRejected({ label: client.label, message: error.message }), {
      code: REMOTE_NODE_ERROR.REJECTED,
      status: error.status,
    });
  }
  return error instanceof RpcError ? error : new RpcError('internal', NC.pairFailed({ label: client.label }));
}

function rejectedRpc(reason: RemoteNodeRejectReason, message: string | Localized): RpcError {
  return new RpcError('conflict', message, { code: REMOTE_NODE_ERROR.REJECTED, reason });
}

function lostRpc(reason: RemoteNodeLostReason, message: string | Localized): RpcError {
  return new RpcError('conflict', message, { code: REMOTE_NODE_ERROR.LOST, reason });
}

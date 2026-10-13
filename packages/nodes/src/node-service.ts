import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import {
  NODE_DEFAULT_PORT,
  NODE_ERROR,
  NODE_HEALTH_SCHEMA,
  NODE_MIN_PROTOCOL_VERSION,
  NODE_PROTOCOL_VERSION,
  NODE_SHAREABLE_CAPABILITIES,
  RUNTIME_VERSION,
  RpcError,
  newId,
  type NodeHealth,
  type NodePairResponse,
  type ShareStartParams,
  type ShareStatus,
} from '@cuccut/protocol';
import { defaultAdvertiser, type Advertiser } from './advertiser.ts';
import { NodeHttpError, NodeJobs, type NodeJobRunner, type NodeLimits, type NodeModels } from './node-jobs.ts';
import { silentNodeLog, type NodeLogger } from './node-logger.ts';
import { createNodeRequestHandler } from './node-server.ts';
import { Pairing, systemClock, type Clock, type PairingLimits } from './pairing.ts';
import { ShareStore, loadShareFile, type ShareFile } from './share-store.ts';
import { NodesServer as NS } from '@cuccut/protocol/messages/nodes';

/**
 * Node service (architecture design §6.7, §12.7; node protocol spec): shares this computer's model capabilities.
 *
 * The user turns it on and off through the local gateway's `nodes.share.*`. While on, it listens on one port on all IPv4 interfaces (loopback in tests), separate from the local gateway.
 * The switch, `nodeId`, name, port, per-capability switches and paired clients are persisted in `node-share.json`. When `enabled` is true, the Runtime starts listening at launch;
 * no pairing code is generated automatically. If the port is occupied, the Runtime still starts, `ShareStatus.listening` is false, and `error` explains why.
 *
 * Per-capability switches (spec §11): the first time sharing is turned on, all capabilities that support sharing at that moment are turned on; capabilities added later default to off. Switches take effect immediately:
 * the health endpoint reports honestly; once a capability is turned off, new tasks are rejected with `403 CAPABILITY_DISABLED`, while tasks already accepted run to completion.
 *
 * Remote tasks are handed to `NodeJobs`, which drives the Runtime's single JobManager.
 */

export interface NodeServiceOptions {
  /** `<home>/store/node-share.json` */
  shareFile: string;
  /** `<home>/staging/node-jobs` */
  jobsDir: string;
  runner: NodeJobRunner;
  models: NodeModels;
  log?: NodeLogger;
  /** Address to listen on (default `0.0.0.0`; tests use `127.0.0.1`). */
  host?: string;
  /** mDNS registration; the default depends on the platform (macOS uses `dns-sd`). null means no registration. */
  advertiser?: Advertiser | null;
  clock?: Clock;
  limits?: Partial<NodeLimits>;
  pairing?: Partial<PairingLimits>;
  freeBytes?: (dir: string) => Promise<number>;
  /** Model capabilities that support sharing (default `NODE_SHAREABLE_CAPABILITIES`; tests use it to simulate a capability added in the future). */
  shareableCapabilities?: readonly string[];
  /** Heartbeat interval for the event stream (default 15 seconds). */
  heartbeatMs?: number;
  /** Default name (default: the hostname). */
  hostname?: () => string;
  /** The machine's local addresses that `ShareStatus.addresses` lists when listening on all interfaces (default: the machine's non-loopback IPv4 addresses). */
  addresses?: () => string[];
}

export class NodeService {
  readonly jobs: NodeJobs;
  readonly #options: NodeServiceOptions;
  readonly #log: NodeLogger;
  readonly #store: ShareStore;
  readonly #advertiser: Advertiser | null;
  readonly #host: string;
  readonly #shareable: readonly string[];
  #share: ShareFile;
  #pairing: Pairing;
  #server: http.Server | null = null;
  #boundPort: number | null = null;
  /** The address actually bound (`server.address()`); null when not listening. */
  #boundAddress: string | null = null;
  #error: string | null = null;
  /** If `node-share.json` cannot be read or recognized, sharing stays off, cannot be changed, and that file is not written. */
  readonly #unreadable: string | null;
  /** Switch operations are serialized. */
  #chain: Promise<unknown> = Promise.resolve();
  #closed = false;

  private constructor(options: NodeServiceOptions, share: ShareFile, unreadable: string | null) {
    this.#options = options;
    this.#log = options.log ?? silentNodeLog;
    this.#store = new ShareStore(options.shareFile);
    this.#advertiser = options.advertiser === undefined ? defaultAdvertiser(process.platform, this.#log) : options.advertiser;
    this.#host = options.host ?? '0.0.0.0';
    this.#shareable = options.shareableCapabilities ?? NODE_SHAREABLE_CAPABILITIES;
    this.#share = share;
    this.#unreadable = unreadable;
    this.#pairing = this.#newPairing(share);
    this.jobs = new NodeJobs({
      dir: options.jobsDir,
      runner: options.runner,
      models: options.models,
      capabilityEnabled: (capability) => this.#capabilityEnabled(capability),
      log: this.#log,
      ...(options.limits ? { limits: options.limits } : {}),
      ...(options.freeBytes ? { freeBytes: options.freeBytes } : {}),
    });
  }

  /**
   * Read the persistent state and clear the remote task directories left over from last time. If the switch is on, start listening (no pairing code is generated).
   * If `node-share.json` cannot be read or recognized, Runtime startup does not fail: sharing is treated as off, and operations that change sharing are rejected with `conflict`.
   * `ShareStatus.error` explains why. The file is left as it is, and takes effect after it is repaired or removed and the app restarts.
   */
  static async open(options: NodeServiceOptions): Promise<NodeService> {
    const log = options.log ?? silentNodeLog;
    const loaded = await loadShareFile(options.shareFile, log);
    const unreadable = loaded && 'unreadable' in loaded ? loaded.unreadable : null;
    if (unreadable) log.error('Share file is unreadable; sharing is off and cannot be changed until it is fixed or removed', { reason: unreadable });
    const share = (loaded && !('unreadable' in loaded) ? loaded : null) ?? {
      formatVersion: 1,
      enabled: false,
      nodeId: null,
      name: null,
      port: NODE_DEFAULT_PORT,
      allowAnySource: false,
      capabilities: null,
      clients: [],
    };
    const service = new NodeService(options, share, unreadable);
    await service.jobs.sweep();
    if (share.enabled) await service.#listen();
    return service;
  }

  // ---- Local gateway nodes.share.* (spec §10) ----

  start(params: ShareStartParams = {}): Promise<ShareStatus> {
    return this.#serial(async () => {
      if (this.#closed) throw new RpcError('busy', NS.runtimeStopping());
      this.#assertWritable();
      const share = this.#share;
      const portChanged = params.port !== undefined && params.port !== share.port;
      const nameChanged = params.name !== undefined && params.name !== share.name;
      share.nodeId ??= newId('node');
      share.capabilities ??= this.#initialCapabilities();
      if (params.port !== undefined) share.port = params.port;
      if (params.name !== undefined) share.name = params.name;
      if (params.allowAnySource !== undefined) share.allowAnySource = params.allowAnySource;
      share.enabled = true;
      await this.#save();
      if (this.#server && portChanged) await this.#unlisten();
      if (!this.#server) await this.#listen();
      else if (nameChanged) this.#advertise();
      this.#pairing.newCode();
      this.#log.info('Sharing turned on', { listening: this.#server !== null, port: this.#boundPort ?? share.port });
      return this.status();
    });
  }

  stop(): Promise<ShareStatus> {
    return this.#serial(async () => {
      this.#assertWritable();
      this.#share.enabled = false;
      await this.#save();
      await this.#shutdown();
      this.#log.info('Sharing turned off');
      return this.status();
    });
  }

  status(): ShareStatus {
    const share = this.#share;
    return {
      enabled: share.enabled,
      listening: this.#server !== null,
      error: this.#unreadable !== null ? NS.shareFileUnreadable({ reason: this.#unreadable }).text : share.enabled && !this.#server ? this.#error : null,
      nodeId: share.nodeId,
      name: this.#name(),
      port: this.#boundPort ?? share.port,
      addresses: shareAddresses(this.#boundAddress, this.#options.addresses ?? lanAddresses),
      allowAnySource: share.allowAnySource,
      capabilities: Object.fromEntries(this.#shareable.map((c) => [c, { enabled: this.#capabilityEnabled(c) }])),
      pairing: share.enabled ? this.#pairing.state() : null,
      clients: this.#pairing.clients().map(({ clientId, name, pairedAt, lastSeenAt }) => ({ clientId, name, pairedAt, lastSeenAt })),
      jobs: this.jobs.counts(),
    };
  }

  pairingCode(): ShareStatus {
    if (!this.#share.enabled) throw new RpcError('conflict', NS.sharingOff());
    this.#pairing.newCode();
    return this.status();
  }

  revoke(clientId: string): Promise<ShareStatus> {
    return this.#serial(async () => {
      this.#assertWritable();
      if (!this.#pairing.revoke(clientId)) throw new RpcError('not-found', NS.clientNotFound());
      this.#share.clients = this.#pairing.clients();
      await this.#save();
      await this.jobs.removeClient(clientId);
      this.#log.info('Revoked client', { clientId });
      return this.status();
    });
  }

  /**
   * Turn sharing of one capability on or off (spec §10, §11). The change is persisted and takes effect immediately: the health endpoint reports the new state at once. Turning it off only stops new tasks;
   * tasks already accepted (including those still waiting for upload) run to completion. It can be set even while sharing is off, and is carried over when sharing is enabled.
   */
  setCapability(capability: string, enabled: boolean): Promise<ShareStatus> {
    return this.#serial(async () => {
      this.#assertWritable();
      if (!this.#shareable.includes(capability)) {
        throw new RpcError('invalid-request', NS.capabilityNotShareable({ capability, shareable: this.#shareable.join(NS.listSeparator().text) }), {
          capability,
          shareable: [...this.#shareable],
        });
      }
      const capabilities = (this.#share.capabilities ??= this.#initialCapabilities());
      capabilities[capability] = { enabled };
      await this.#save();
      this.#log.info(enabled ? 'Capability sharing turned on' : 'Capability sharing turned off', { capability });
      return this.status();
    });
  }

  /** The port actually being listened on (for tests and diagnostics). */
  get port(): number | null {
    return this.#boundPort;
  }

  /** Runtime stop: cancel and delete remote tasks, then close the listener and the mDNS registration. The switches are left as they are and restored on the next start. */
  close(): Promise<void> {
    return this.#serial(async () => {
      if (this.#closed) return;
      this.#closed = true;
      await this.#shutdown();
      this.jobs.detach();
      this.#share.clients = this.#pairing.clients();
      await this.#save().catch(() => {});
    });
  }

  // ---- Node protocol ----

  async health(): Promise<NodeHealth> {
    const bundles = (await this.#options.models.list()).filter((b) => b.capability === 'transcribe');
    let running = 0;
    let queued = 0;
    for (const job of this.#options.runner.list()) {
      if (job.state === 'running') running++;
      else if (job.state === 'queued') queued++;
    }
    return {
      schema: NODE_HEALTH_SCHEMA,
      nodeId: this.#share.nodeId ?? '',
      name: this.#name(),
      nodeProtocolVersion: NODE_PROTOCOL_VERSION,
      minNodeProtocolVersion: NODE_MIN_PROTOCOL_VERSION,
      runtimeVersion: RUNTIME_VERSION,
      platform: { os: process.platform, arch: process.arch },
      capabilities: {
        transcribe: {
          enabled: this.#capabilityEnabled('transcribe'),
          bundles: bundles.map(({ bundleId, backend, device, state }) => ({ bundleId, backend, device, state })),
          running,
          queued,
        },
      },
    };
  }

  async pair(code: string, clientId: string, clientName: string): Promise<NodePairResponse> {
    const outcome = this.#pairing.pair(code, clientId, clientName);
    if (!outcome.ok) {
      this.#log.warn('Pairing failed', { reason: outcome.code });
      if (outcome.code === 'PAIRING_LOCKED') {
        throw new NodeHttpError(NODE_ERROR.PAIRING_LOCKED, NS.pairingLocked().text, { retryAfterMs: outcome.retryAfterMs });
      }
      throw new NodeHttpError(NODE_ERROR.PAIRING_CODE_INVALID, NS.pairingCodeInvalid().text);
    }
    // The same clientId paired again: the old token is no longer valid; its earlier tasks are unaffected.
    this.#share.clients = this.#pairing.clients();
    await this.#save();
    this.#log.info('Client paired', { clientId });
    return { nodeId: this.#share.nodeId!, name: this.#name(), token: outcome.token };
  }

  // ---- Internal ----

  /** If sharing has never been turned on, reports the defaults in effect at enable time (all on). Afterwards the persisted table governs; capabilities missing from the table count as off. */
  #capabilityEnabled(capability: string): boolean {
    if (!this.#shareable.includes(capability)) return false;
    const capabilities = this.#share.capabilities;
    return capabilities === null ? true : capabilities[capability]?.enabled === true;
  }

  /** The first time sharing is turned on (or the first switch is set): all capabilities that support sharing at that moment are turned on. */
  #initialCapabilities(): Record<string, { enabled: boolean }> {
    return Object.fromEntries(this.#shareable.map((c) => [c, { enabled: true }]));
  }

  #name(): string {
    return this.#share.name ?? (this.#options.hostname ?? defaultHostname)();
  }

  #newPairing(share: ShareFile): Pairing {
    return new Pairing(share.clients, {
      ...(this.#options.clock ? { clock: this.#options.clock } : { clock: systemClock }),
      ...(this.#options.pairing ? { limits: this.#options.pairing } : {}),
    });
  }

  async #listen(): Promise<void> {
    const share = this.#share;
    share.nodeId ??= newId('node');
    const handler = createNodeRequestHandler({
      jobs: this.jobs,
      health: () => this.health(),
      pair: (code, clientId, clientName) => this.pair(code, clientId, clientName),
      authenticate: (token) => this.#pairing.verify(token)?.clientId ?? null,
      allowAnySource: () => this.#share.allowAnySource,
      log: this.#log,
      ...(this.#options.heartbeatMs !== undefined ? { heartbeatMs: this.#options.heartbeatMs } : {}),
    });
    const server = http.createServer(handler);
    // Large file uploads are governed by the task's upload deadline, not Node's default 300-second limit for the whole request.
    server.requestTimeout = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen({ port: share.port, host: this.#host }, () => {
          server.off('error', reject);
          resolve();
        });
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      this.#error = code === 'EADDRINUSE' ? NS.portInUse({ port: share.port }).text : NS.cannotListen({ code: code ?? String(error) }).text;
      this.#log.warn('Node service cannot listen', { port: share.port, code });
      return;
    }
    server.on('error', (error) => this.#log.error('Node service error', { error: String(error) }));
    this.#server = server;
    const bound = server.address() as AddressInfo;
    this.#boundPort = bound.port;
    this.#boundAddress = bound.address;
    this.#error = null;
    this.#log.info('Node service listening', { port: this.#boundPort });
    this.#advertise();
  }

  #advertise(): void {
    if (!this.#advertiser || !this.#server || this.#boundPort === null) return;
    this.#advertiser.start({ name: this.#name(), port: this.#boundPort, nodeId: this.#share.nodeId!, version: NODE_PROTOCOL_VERSION });
  }

  async #unlisten(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    this.#boundPort = null;
    this.#boundAddress = null;
    await this.#advertiser?.stop().catch(() => {});
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // The event stream and uploads are long-lived connections: disconnect them together.
      server.closeAllConnections();
    });
  }

  /** Shared by turning sharing off and stopping the Runtime: first cancel and delete the remote tasks (the event stream receives the terminal state), then close the listener and the registration. */
  async #shutdown(): Promise<void> {
    await this.jobs.closeAll();
    await this.#unlisten();
    this.#pairing.clearCode();
    this.#error = null;
  }

  #save(): Promise<void> {
    if (this.#unreadable !== null) return Promise.resolve();
    return this.#store.save(this.#share);
  }

  #assertWritable(): void {
    if (this.#unreadable !== null) throw new RpcError('conflict', NS.shareFileUnreadable({ reason: this.#unreadable }));
  }

  #serial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.#chain.then(task, task);
    this.#chain = next.catch(() => {});
    return next;
  }
}

function defaultHostname(): string {
  return os.hostname().replace(/\.local\.?$/, '') || 'CucCut';
}

/**
 * Addresses at which the node service can currently be reached. Empty when not listening. When bound to all interfaces (`0.0.0.0`, `::`), these are the machine's LAN addresses.
 * When bound to a specific address (including the loopback address), only that one address is listed, and other interfaces cannot reach it.
 */
export function shareAddresses(boundAddress: string | null, interfaces: () => string[]): string[] {
  if (boundAddress === null) return [];
  if (boundAddress === '0.0.0.0' || boundAddress === '::') return interfaces();
  return [boundAddress];
}

/** The machine's non-loopback IPv4 addresses that others can connect to. */
export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal) found.push(info.address);
    }
  }
  return found;
}

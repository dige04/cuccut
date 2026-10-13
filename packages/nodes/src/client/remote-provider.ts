import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ProviderFailure,
  type AsrWarning,
  type TranscribeAttempt,
  type TranscribeProvider,
  type TranscribeRun,
  type TranscribeSink,
  type TranscribeJobPhase,
} from '@cuccut/models';
import {
  NODE_ERROR,
  type NodeHealth,
  type NodeJob,
  type NodeJobRequest,
  type RemoteNodeLostReason,
  type RemoteNodeRejectReason,
} from '@cuccut/protocol';
import { isNodeJobTerminal } from '../node-jobs.ts';
import { silentNodeLog, type NodeLogger } from '../node-logger.ts';
import {
  NodeClient,
  NodeConnectionError,
  NodeRequestAborted,
  NodeResponseError,
  readEventStream,
  rejectReason,
  versionCompatible,
} from './node-http.ts';
import type { PairedNodeRecord } from './node-store.ts';
import { NodesClient as NC } from '@cuccut/protocol/messages/nodes';

/**
 * Remote node Provider (architecture design §6.7; node protocol spec §9): hands one transcription attempt to a paired node. One instance serves all paired nodes;
 * the target node is given by `TranscribeRun.node` (if absent, `node:<nodeId>` from `providerId`).
 *
 * One attempt: pre-check `GET /v1/health` (reachable, version, `nodeId`, capability switches, model pack status) → `POST /v1/jobs` (`clientJobId` is
 * `<jobId>:<attempt number>`) → `PUT input` streams the media's original file → follow the event stream, passing stages, progress, warnings and language to the sink →
 * on `completed`, download the result into this attempt's staging directory and verify the sha256 and length → `DELETE` (best effort) → hand back to JobManager,
 * which validates, publishes and applies it just as it does a local result.
 *
 * If the event stream drops (including when there is no data for `heartbeatTimeoutMs`), reconnect with `since=<last seq>`, backing off from 0.5 to 5 seconds. If reconnection keeps failing for
 * `lostAfterMs`, the failure is `REMOTE_NODE_LOST` (`stream-lost`). If the node reports the task as `interrupted`, the task no longer exists at reconnect time
 * (404: the node restarted and cleared it), or the task ends as `cancelled` although we did not cancel it (the node closed sharing or stopped), the cause is `node-restarted`.
 *
 * Cancel: `POST cancel` waits for the node's confirmation (the node waits at most 15 seconds, this side 20 seconds), then `DELETE`. If the node is unreachable, the attempt still settles as
 * `cancelled`, with the warning `remote-cancel-unconfirmed`.
 *
 * The token appears only in the `Authorization` header of requests: logs, error messages and details never include it.
 */

export interface RemoteTiming {
  /** Deadline for ordinary JSON requests (health, create, read). */
  requestTimeoutMs: number;
  /** Connection idle deadline for uploads and downloads. */
  transferIdleMs: number;
  /** How long consecutive failures must last after task creation before it counts as lost (spec: 60 seconds). */
  lostAfterMs: number;
  /** How long the event stream may go without any data before it counts as disconnected (a heartbeat arrives every 15 seconds; default 45 seconds). */
  heartbeatTimeoutMs: number;
  backoffMinMs: number;
  backoffMaxMs: number;
  /** Deadline for waiting for the node's confirmation on cancel (the node itself waits at most 15 seconds). */
  cancelTimeoutMs: number;
  /** Deadline for `DELETE` after finishing (best effort). */
  deleteTimeoutMs: number;
}

export const DEFAULT_REMOTE_TIMING: RemoteTiming = {
  requestTimeoutMs: 15_000,
  transferIdleMs: 60_000,
  lostAfterMs: 60_000,
  heartbeatTimeoutMs: 45_000,
  backoffMinMs: 500,
  backoffMaxMs: 5_000,
  cancelTimeoutMs: 20_000,
  deleteTimeoutMs: 5_000,
};

/** Lookup for paired nodes: NodeStore satisfies it structurally. */
export interface PairedNodes {
  get(nodeId: string): PairedNodeRecord | null;
  /** The token is fetched only when a request is made; throws when the credential store is unavailable. */
  token(nodeId: string): Promise<string | null>;
  credentialProblem(nodeId: string): string | null;
}

export interface RemoteNodeProviderOptions {
  nodes: PairedNodes;
  log?: NodeLogger;
  timing?: Partial<RemoteTiming>;
}

const WORKER_PHASES = new Set<string>(['decoding', 'vad', 'transcribing', 'aligning', 'diarizing', 'finalizing']);
const RESULT_FILE = 'result.json';

/** A node task known within one attempt. */
interface Attempt {
  client: NodeClient;
  token: string;
  nodeId: string;
  /** Task ID on the node (only available after creation). */
  remoteJobId: string | null;
}

export class RemoteNodeProvider implements TranscribeProvider {
  readonly id = 'node';
  readonly timing: RemoteTiming;
  readonly #nodes: PairedNodes;
  readonly #log: NodeLogger;
  readonly #inflight = new Set<AbortController>();

  constructor(options: RemoteNodeProviderOptions) {
    this.#nodes = options.nodes;
    this.#log = options.log ?? silentNodeLog;
    this.timing = { ...DEFAULT_REMOTE_TIMING, ...options.timing };
  }

  async transcribe(run: TranscribeRun, sink: TranscribeSink, signal: AbortSignal): Promise<TranscribeAttempt> {
    if (signal.aborted) return { outcome: 'cancelled', workerVersion: null };
    const nodeId = run.node ?? (run.providerId?.startsWith('node:') ? run.providerId.slice('node:'.length) : undefined);
    if (!nodeId) throw new ProviderFailure('unavailable', NC.noNodeSpecified().text);
    const node = this.#nodes.get(nodeId);
    if (!node) throw rejected('unpaired', nodeId, NC.nodeNotPaired().text);
    let token: string | null;
    try {
      token = await this.#nodes.token(nodeId);
    } catch {
      // No fallback to another store: report it honestly and fail the task. The reason contains no token.
      const reason = this.#nodes.credentialProblem(nodeId) ?? NC.tokenUnreadableDefault().text;
      throw new ProviderFailure('unavailable', NC.nodeTokenUnavailable({ alias: node.alias, reason }).text, { node: nodeId });
    }
    if (!token) throw rejected('unpaired', nodeId, NC.noToken().text);
    const attempt: Attempt = { client: new NodeClient(node.host, node.port), token, nodeId, remoteJobId: null };
    // This attempt's own abort: the caller cancelled, or the Provider was closed.
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    this.#inflight.add(controller);
    try {
      return await this.#run(run, sink, attempt, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return this.#cancel(attempt, run.jobId);
      if (attempt.remoteJobId && error instanceof ProviderFailure && error.kind === 'remote-failed') await this.#forget(attempt);
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.#inflight.delete(controller);
    }
  }

  async close(): Promise<void> {
    // JobManager already aborts in-flight tasks when it stops; this is only a safeguard.
    for (const controller of this.#inflight) controller.abort();
  }

  // ---- One attempt ----

  async #run(run: TranscribeRun, sink: TranscribeSink, attempt: Attempt, signal: AbortSignal): Promise<TranscribeAttempt> {
    const { client, token, nodeId } = attempt;
    const t = this.timing;
    const stat = await fs.stat(run.input.file).catch(() => null);
    if (!stat?.isFile()) throw new ProviderFailure('input-unreadable', NC.mediaUnreadable().text);
    if (!run.mediaType) throw new ProviderFailure('unavailable', NC.mediaTypeMissing().text);

    // 1. Pre-check
    let health: NodeHealth;
    try {
      health = await client.health({ timeoutMs: t.requestTimeoutMs, signal });
    } catch (error) {
      throw this.#mapBeforeJob(error, nodeId, client);
    }
    const bundleId = run.bundleId ?? run.modelId;
    if (!bundleId) throw new ProviderFailure('unavailable', NC.noBundle().text);
    this.#precheck(health, nodeId, bundleId);

    // 2. Create
    const request: NodeJobRequest = {
      clientJobId: `${run.jobId}:${run.runGeneration}`,
      kind: 'transcribe',
      bundleId,
      input: {
        contentHash: run.input.contentHash,
        byteLength: stat.size,
        mediaType: run.mediaType,
        track: run.input.track,
        range: run.input.range ? { start: run.input.range.start, end: run.input.range.end } : null,
      },
      options: {
        language: run.options.language,
        diarize: run.options.diarize,
        ...(run.options.hint ? { hint: run.options.hint } : {}),
        timescale: run.options.timescale,
      },
    };
    let created: NodeJob;
    try {
      created = await client.createJob(token, request, { timeoutMs: t.requestTimeoutMs, signal });
    } catch (error) {
      throw this.#mapBeforeJob(error, nodeId, client);
    }
    attempt.remoteJobId = created.jobId;
    this.#log.info('Remote job created', { jobId: run.jobId, node: nodeId, remoteJobId: created.jobId });

    // 3. Upload (the media's original file, streamed)
    if (created.state === 'awaiting-input') await this.#upload(attempt, run.input.file, stat.size, signal);

    // 4. Follow the event stream to a terminal state
    const final = await this.#follow(attempt, sink, signal);
    if (final.state === 'failed') {
      const error = final.error ?? { code: 'INTERNAL', message: NC.remoteTaskFailed().text };
      throw new ProviderFailure('remote-failed', error.message, {
        code: error.code,
        node: nodeId,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
    }
    if (final.state === 'interrupted' || final.state === 'cancelled') {
      throw lost('node-restarted', nodeId, final.state === 'cancelled' ? NC.cancelledBySharingOff().text : NC.nodeRestarted().text);
    }
    if (!final.output) throw new ProviderFailure('protocol', NC.completedWithoutOutput().text, { node: nodeId });

    // 5. Fetch the result and verify it
    const dest = path.join(run.staging, RESULT_FILE);
    const fetched = await this.#retrying(attempt, signal, () =>
      client.download(token, attempt.remoteJobId!, dest, { idleMs: t.transferIdleMs, signal }),
    );
    if (fetched.sha256 !== final.output.sha256 || fetched.byteLength !== final.output.byteLength) {
      throw new ProviderFailure('protocol', NC.resultMismatch().text, { node: nodeId });
    }
    await this.#forget(attempt);
    this.#log.info('Remote job completed', { jobId: run.jobId, node: nodeId, remoteJobId: attempt.remoteJobId, attempt: final.attempt });
    return {
      outcome: 'completed',
      output: { path: RESULT_FILE, sha256: fetched.sha256, byteLength: fetched.byteLength },
      workerVersion: await workerVersionOf(dest),
      // If a worker crashed on the node and the task was retried, the result is written back with the node's attempt number.
      runGeneration: final.attempt,
    };
  }

  /** Pre-check: version, identity, capability switches, model pack (spec §9). */
  #precheck(health: NodeHealth, nodeId: string, bundleId: string): void {
    if (!health || typeof health !== 'object' || !health.capabilities?.transcribe) {
      throw lost('unreachable', nodeId, NC.badHealth().text);
    }
    if (!versionCompatible(health)) {
      throw rejected('version', nodeId, NC.versionIncompatible().text, {
        nodeProtocolVersion: health.nodeProtocolVersion,
        minNodeProtocolVersion: health.minNodeProtocolVersion,
      });
    }
    // The node at this address is no longer the one we paired with: the token means nothing to it.
    if (health.nodeId !== nodeId) throw rejected('unpaired', nodeId, NC.otherNodeAtAddress().text);
    const transcribe = health.capabilities.transcribe;
    if (!transcribe.enabled) throw this.#capabilityDisabled(nodeId);
    const bundle = transcribe.bundles.find((b) => b.bundleId === bundleId);
    if (!bundle || bundle.state === 'not-installed' || bundle.state === 'error') {
      throw rejected('model-not-ready', nodeId, NC.bundleNotReady().text, { bundleId, state: bundle?.state ?? 'unknown' });
    }
  }

  /** The node has closed sharing of transcription (`REMOTE_NODE_REJECTED` / `capability-disabled`): the message names which node and how to fix it. */
  #capabilityDisabled(nodeId: string): ProviderFailure {
    const name = this.#nodes.get(nodeId)?.alias ?? nodeId;
    return rejected(
      'capability-disabled',
      nodeId,
      NC.capabilityDisabled({ name }).text,
      { capability: 'transcribe' },
    );
  }

  /** Failures before task creation: if the node cannot be reached, it is `unreachable`; the node's rejections are classified by error code. */
  #mapBeforeJob(error: unknown, nodeId: string, client: NodeClient): unknown {
    if (error instanceof NodeRequestAborted) return error;
    if (error instanceof NodeConnectionError) return lost('unreachable', nodeId, NC.labelUnreachable({ label: client.label }).text, { cause: error.code });
    if (error instanceof NodeResponseError) return this.#mapResponse(error, nodeId);
    return error;
  }

  #mapResponse(error: NodeResponseError, nodeId: string): ProviderFailure {
    const reason = rejectReason(error);
    // The switch was turned off on the node after the pre-check (403 on create): give the same remedy in the message as the pre-check does.
    if (reason === 'capability-disabled') return this.#capabilityDisabled(nodeId);
    if (reason) {
      return rejected(reason, nodeId, error.message, {
        ...(error.code === NODE_ERROR.PROTOCOL_VERSION_UNSUPPORTED && error.details ? { required: error.details.required } : {}),
        ...(error.code === NODE_ERROR.MODEL_NOT_READY && error.details ? { state: error.details.state } : {}),
      });
    }
    if (error.code === NODE_ERROR.JOB_NOT_FOUND || error.code === NODE_ERROR.RESULT_EXPIRED) {
      return lost('node-restarted', nodeId, NC.taskGone().text);
    }
    // Rejections outside the table above (e.g. 400 INVALID_REQUEST, 409 IDEMPOTENCY_CONFLICT): the node's error code as is.
    return new ProviderFailure('remote-failed', error.message, { code: error.code, node: nodeId, details: { status: error.status } });
  }

  /** Upload. If the connection drops, check the task state: if it is still waiting for upload, re-upload; if it has already received the data, continue. (The node receives the whole body according to `Content-Length`; there is no resume.) */
  async #upload(attempt: Attempt, file: string, byteLength: number, signal: AbortSignal): Promise<void> {
    const { client, token } = attempt;
    const jobId = attempt.remoteJobId!;
    await this.#retrying(attempt, signal, async () => {
      const current = await client.getJob(token, jobId, { timeoutMs: this.timing.requestTimeoutMs, signal });
      if (current.state !== 'awaiting-input') return;
      try {
        await client.upload(token, jobId, file, byteLength, { idleMs: this.timing.transferIdleMs, signal });
      } catch (error) {
        // On a digest mismatch the task has already failed on the node; if the state is unexpected (e.g. the node just cancelled it), either way leave it to the event stream to report the terminal state.
        const settled =
          error instanceof NodeResponseError && (error.code === NODE_ERROR.INPUT_HASH_MISMATCH || error.code === NODE_ERROR.INVALID_STATE);
        if (!settled) throw error;
      }
    });
  }

  /**
   * Follow the event stream to a terminal state. On a drop (including heartbeat timeout), reconnect with `since`. Receiving any line (heartbeats count) resets the consecutive-failure timer.
   * Sequence numbers (`seq`) already seen are not processed again (so progress is not forwarded twice after a reconnect).
   */
  async #follow(attempt: Attempt, sink: TranscribeSink, signal: AbortSignal): Promise<NodeJob> {
    const { client, token, nodeId } = attempt;
    const jobId = attempt.remoteJobId!;
    let since = 0;
    let phase: string | null = null;
    let failingSince: number | null = null;
    let backoff = this.timing.backoffMinMs;
    for (;;) {
      try {
        const response = await client.events(token, jobId, since, { timeoutMs: this.timing.requestTimeoutMs, signal });
        for await (const event of readEventStream(response, this.timing.heartbeatTimeoutMs)) {
          failingSince = null;
          backoff = this.timing.backoffMinMs;
          if (event.type === 'heartbeat') continue;
          if (!Number.isInteger(event.seq) || event.seq <= since) continue;
          since = event.seq;
          if (event.type === 'warning') sink.warning(event.warning as AsrWarning);
          else if (event.type === 'language') sink.language(event.tag, event.confidence);
          else if (event.type === 'job') {
            const job = event.job;
            if (isNodeJobTerminal(job.state)) return job;
            if (job.phase === 'loading') sink.loading();
            else if (WORKER_PHASES.has(job.phase)) {
              const workerPhase = job.phase as TranscribeJobPhase;
              if (workerPhase !== phase) sink.phase(workerPhase);
              if (job.progress) sink.progress({ phase: workerPhase, ...job.progress });
            }
            phase = job.phase;
          }
        }
        // The stream ended without a terminal state: treat it as a disconnect.
        throw new NodeConnectionError('NETWORK', NC.streamEndedEarly().text);
      } catch (error) {
        if (signal.aborted || error instanceof NodeRequestAborted) throw new NodeRequestAborted();
        if (error instanceof NodeResponseError) throw this.#mapResponse(error, nodeId);
        if (!(error instanceof NodeConnectionError)) throw error;
        failingSince ??= Date.now();
        if (Date.now() - failingSince >= this.timing.lostAfterMs) {
          throw lost(
            'stream-lost',
            nodeId,
            NC.reconnectFailed({ label: client.label, seconds: Math.round(this.timing.lostAfterMs / 1000) }).text,
          );
        }
        this.#log.warn('Remote job event stream dropped; reconnecting', { node: nodeId, remoteJobId: jobId, since });
        await sleep(backoff, signal);
        backoff = Math.min(backoff * 2, this.timing.backoffMaxMs);
      }
    }
  }

  /** Requests made after task creation: connection problems are retried with the same backoff and lost deadline; node rejections are classified immediately. */
  async #retrying<T>(attempt: Attempt, signal: AbortSignal, task: () => Promise<T>): Promise<T> {
    let failingSince: number | null = null;
    let backoff = this.timing.backoffMinMs;
    for (;;) {
      try {
        return await task();
      } catch (error) {
        if (signal.aborted || error instanceof NodeRequestAborted) throw new NodeRequestAborted();
        if (error instanceof NodeResponseError) throw this.#mapResponse(error, attempt.nodeId);
        if (!(error instanceof NodeConnectionError)) throw error;
        failingSince ??= Date.now();
        if (Date.now() - failingSince >= this.timing.lostAfterMs) {
          throw lost(
            'stream-lost',
            attempt.nodeId,
            NC.retryFailed({ label: attempt.client.label, seconds: Math.round(this.timing.lostAfterMs / 1000) }).text,
          );
        }
        await sleep(backoff, signal);
        backoff = Math.min(backoff * 2, this.timing.backoffMaxMs);
      }
    }
  }

  /** Cancel (spec §9): send `cancel`, wait for confirmation, then `DELETE`. If the node is unreachable, still settle as `cancelled`, with a warning. */
  async #cancel(attempt: Attempt, jobId: string): Promise<TranscribeAttempt> {
    const remoteJobId = attempt.remoteJobId;
    if (!remoteJobId) return { outcome: 'cancelled', workerVersion: null };
    const { client, token, nodeId } = attempt;
    let confirmed = false;
    try {
      const job = await client.cancelJob(token, remoteJobId, { timeoutMs: this.timing.cancelTimeoutMs });
      confirmed = isNodeJobTerminal(job.state);
    } catch (error) {
      if (error instanceof NodeResponseError && error.code === NODE_ERROR.JOB_NOT_FOUND) confirmed = true;
    }
    try {
      await client.deleteJob(token, remoteJobId, { timeoutMs: this.timing.cancelTimeoutMs });
      confirmed = true;
    } catch (error) {
      if (error instanceof NodeResponseError && error.code === NODE_ERROR.JOB_NOT_FOUND) confirmed = true;
    }
    this.#log.info(confirmed ? 'Remote job cancelled' : 'Remote job cancellation was not confirmed by the node', { jobId, node: nodeId, remoteJobId });
    return confirmed
      ? { outcome: 'cancelled', workerVersion: null }
      : { outcome: 'cancelled', workerVersion: null, warnings: [{ code: 'remote-cancel-unconfirmed' }] };
  }

  /** After finishing, ask the node to delete the task (best effort: a failure is only logged; the node cleans up on its own after the retention period). */
  async #forget(attempt: Attempt): Promise<void> {
    const remoteJobId = attempt.remoteJobId;
    if (!remoteJobId) return;
    try {
      await attempt.client.deleteJob(attempt.token, remoteJobId, { timeoutMs: this.timing.deleteTimeoutMs });
    } catch (error) {
      if (error instanceof NodeResponseError && error.code === NODE_ERROR.JOB_NOT_FOUND) return;
      this.#log.warn('Could not delete the job on the node', { node: attempt.nodeId, remoteJobId });
    }
  }
}

function rejected(reason: RemoteNodeRejectReason, node: string, message: string, extra: Record<string, unknown> = {}): ProviderFailure {
  return new ProviderFailure('node-rejected', message, { reason, node, ...extra });
}

function lost(reason: RemoteNodeLostReason, node: string, message: string, extra: Record<string, unknown> = {}): ProviderFailure {
  return new ProviderFailure('node-lost', message, { reason, node, ...extra });
}

/** Worker version in the result (when it cannot be read, a placeholder is used; JobManager's validation points out any problem with the result itself). */
async function workerVersionOf(file: string): Promise<string> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as { provenance?: { workerVersion?: unknown } };
    const version = parsed.provenance?.workerVersion;
    return typeof version === 'string' && version ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new NodeRequestAborted());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new NodeRequestAborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

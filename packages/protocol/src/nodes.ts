/**
 * LAN node (architecture design §6.7; node protocol spec): one machine shares its local model capabilities with other machines on the LAN.
 *
 * This file has two parts:
 * - The HTTP contract of the node service (`/v1/...`): health, pairing, tasks, events and errors. This is the wire format between two Runtimes, separate from the local gateway RPC.
 * - The parameters and results of the `nodes` methods on the local gateway (spec §10), registered in `RpcMethods`.
 */

/** Node protocol version (spec §1). */
export const NODE_PROTOCOL_VERSION = 1;
/** The lowest protocol version a node accepts; requests below it are rejected with `426 PROTOCOL_VERSION_UNSUPPORTED`. */
export const NODE_MIN_PROTOCOL_VERSION = 1;
/** Request header for the version gate (spec §2). */
export const NODE_PROTOCOL_HEADER = 'X-CucCut-Node-Protocol';
/** Default port of the node service. */
export const NODE_DEFAULT_PORT = 47610;
/** mDNS service type (spec §12). */
export const NODE_SERVICE_TYPE = '_cuccut-node._tcp';
export const NODE_HEALTH_SCHEMA = 'cuccut.node-health/v1';
/**
 * Model capabilities a node can share (spec §10, §11): `nodes.share.setCapability` accepts only these, and `ShareStatus.capabilities` has one entry for each.
 * Capabilities added later default to off for nodes that have already turned sharing on; the owner turns them on.
 */
export const NODE_SHAREABLE_CAPABILITIES = ['transcribe'] as const;
export type NodeShareableCapability = (typeof NODE_SHAREABLE_CAPABILITIES)[number];

// ---- §3 Health ----

export interface NodeHealth {
  schema: typeof NODE_HEALTH_SCHEMA;
  /** Generated the first time the node turns sharing on; unchanged afterwards. */
  nodeId: string;
  /** Human-readable name; defaults to the hostname. */
  name: string;
  nodeProtocolVersion: number;
  minNodeProtocolVersion: number;
  runtimeVersion: string;
  platform: { os: string; arch: string };
  capabilities: {
    transcribe: {
      enabled: boolean;
      /** `state`, same as `models.list`. */
      bundles: Array<{ bundleId: string; backend: string; device: string; state: string }>;
      /** Number of tasks running (including local tasks). */
      running: number;
      queued: number;
    };
  };
}

// ---- §4 Pairing ----

export interface NodePairRequest {
  code: string;
  /** Random identifier kept persistently in the initiating side's Runtime Home; does not contain `.`. */
  clientId: string;
  clientName: string;
}

export interface NodePairResponse {
  nodeId: string;
  name: string;
  /** `<clientId>.<secret>`, where `secret` is 32 random bytes encoded as base64url. */
  token: string;
}

// ---- §5 Tasks ----

/** Same shape as `TranscribeOptions` in Model Worker protocol spec §2.5; passed to the Worker unchanged. */
export interface NodeTranscribeOptions {
  language: { mode: 'assert'; tag: string } | { mode: 'prefer'; tag: string | null };
  diarize: boolean;
  /** Terms and context, ≤ 1200 characters. */
  hint?: string;
  /** Tick unit of the output, default 1_000_000. */
  timescale: number;
}

export interface NodeJobRequest {
  /** Idempotency key: the initiator's jobId plus the attempt number. */
  clientJobId: string;
  kind: 'transcribe';
  bundleId: string;
  input: {
    /** `sha256:<hex>`, the content digest of the media file. */
    contentHash: string;
    byteLength: number;
    mediaType: string;
    track: number;
    /** Tick (`options.timescale`), same as the Model Worker protocol. */
    range: { start: number; end: number } | null;
  };
  options: NodeTranscribeOptions;
}

export type NodeJobState = 'awaiting-input' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface NodeJob {
  jobId: string;
  clientJobId: string;
  state: NodeJobState;
  /** Same phase as the `jobs` topic; `awaiting-input` while waiting for an upload. */
  phase: string;
  progress: { done: number; total: number | null; unit: 'seconds' | 'segments' } | null;
  attempt: number;
  error: { code: string; message: string; details?: unknown } | null;
  /** Given when completed; sha256 is lowercase hex. */
  output: { sha256: string; byteLength: number } | null;
  lastSeq: number;
}

// ---- §6 Event stream ----

export type NodeJobEvent =
  | { seq: number; type: 'job'; job: NodeJob }
  | { seq: number; type: 'warning'; warning: { code: string; segmentId?: string; detail?: string } }
  | { seq: number; type: 'language'; tag: string; confidence: number | null }
  | { type: 'heartbeat' };

// ---- §8 Errors ----

export const NODE_ERROR = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SOURCE_NOT_ALLOWED: 'SOURCE_NOT_ALLOWED',
  PAIRING_CODE_INVALID: 'PAIRING_CODE_INVALID',
  CAPABILITY_DISABLED: 'CAPABILITY_DISABLED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  MODEL_NOT_READY: 'MODEL_NOT_READY',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_STATE: 'INVALID_STATE',
  RESULT_EXPIRED: 'RESULT_EXPIRED',
  INPUT_TOO_LARGE: 'INPUT_TOO_LARGE',
  INPUT_HASH_MISMATCH: 'INPUT_HASH_MISMATCH',
  PROTOCOL_VERSION_UNSUPPORTED: 'PROTOCOL_VERSION_UNSUPPORTED',
  PAIRING_LOCKED: 'PAIRING_LOCKED',
  QUEUE_FULL: 'QUEUE_FULL',
  DISK_LOW: 'DISK_LOW',
} as const;

export type NodeErrorCode = (typeof NODE_ERROR)[keyof typeof NODE_ERROR];

/** HTTP status for each error code (spec §8). */
export const NODE_ERROR_STATUS: Record<NodeErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  SOURCE_NOT_ALLOWED: 403,
  PAIRING_CODE_INVALID: 403,
  CAPABILITY_DISABLED: 403,
  JOB_NOT_FOUND: 404,
  MODEL_NOT_READY: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_STATE: 409,
  RESULT_EXPIRED: 410,
  INPUT_TOO_LARGE: 413,
  INPUT_HASH_MISMATCH: 422,
  PROTOCOL_VERSION_UNSUPPORTED: 426,
  PAIRING_LOCKED: 429,
  QUEUE_FULL: 429,
  DISK_LOW: 507,
};

/** The two node-specific error codes for when the task itself fails (`NodeJob.error`); the rest reuse the model error codes. */
export const NODE_JOB_ERROR = {
  INPUT_HASH_MISMATCH: 'INPUT_HASH_MISMATCH',
  INPUT_EXPIRED: 'INPUT_EXPIRED',
} as const;

/** Body of a non-2xx response. */
export interface NodeErrorBody {
  error: { code: NodeErrorCode; message: string; details?: Record<string, unknown> };
}

// ---- §10 nodes methods on the local gateway ----

export interface ShareStatus {
  /** The user's switch; persistent. */
  enabled: boolean;
  /** Whether the node service is listening right now. */
  listening: boolean;
  /** Why it is on but not listening (e.g. the port is in use). */
  error: string | null;
  nodeId: string | null;
  name: string;
  /** The port actually bound while listening; otherwise the configured port. */
  port: number;
  /** Addresses reachable right now: when listening on all interfaces, the machine's non-loopback IPv4 addresses; when bound to one specific address, only that one; empty when not listening. */
  addresses: string[];
  allowAnySource: boolean;
  /** One entry for each shareable model capability (`NODE_SHAREABLE_CAPABILITIES`); persistent. A disabled capability rejects new tasks with `403 CAPABILITY_DISABLED`. */
  capabilities: Record<string, { enabled: boolean }>;
  pairing: { code: string; expiresAt: string } | { lockedUntil: string } | null;
  clients: Array<{ clientId: string; name: string; pairedAt: string; lastSeenAt: string | null }>;
  /** Remote tasks on this node. */
  jobs: { running: number; queued: number };
}

export interface ShareStartParams {
  port?: number;
  name?: string;
  allowAnySource?: boolean;
}

export interface DiscoveredNode {
  name: string;
  host: string;
  port: number;
  nodeId: string | null;
}

export interface PairedNode {
  nodeId: string;
  /** Unique on this machine; defaults to the node's name, with a sequence number added on conflict. */
  alias: string;
  name: string;
  host: string;
  port: number;
  pairedAt: string;
  /** null when it cannot be probed. */
  health: NodeHealth | null;
  /**
   * `unreachable`: cannot connect, timed out, or the source address was rejected; `version`: protocol version incompatible; `unpaired`: the token was revoked, this machine cannot read its token (credential store unavailable), or another node is already at this address (different `nodeId`).
   */
  problem: 'unreachable' | 'version' | 'unpaired' | null;
}

// ---- §9 Task errors on the initiating side ----

/** Error codes on the initiating side (command and protocol spec §11.3): a task's `error.code`, or `RpcError.details.code` when `nodes.pair` fails. */
export const REMOTE_NODE_ERROR = {
  LOST: 'REMOTE_NODE_LOST',
  REJECTED: 'REMOTE_NODE_REJECTED',
} as const;

/** `details.reason` of `REMOTE_NODE_REJECTED`: the first eight are used for task pre-checks and requests; `nodes.pair` uses the last two, `version` and `source-not-allowed`. */
export type RemoteNodeRejectReason =
  | 'unpaired'
  | 'version'
  | 'capability-disabled'
  | 'model-not-ready'
  | 'queue-full'
  | 'disk-low'
  | 'source-not-allowed'
  | 'input-too-large'
  | 'pairing-code-invalid'
  | 'pairing-locked';

/** `details.reason` of `REMOTE_NODE_LOST`. */
export type RemoteNodeLostReason = 'unreachable' | 'stream-lost' | 'node-restarted';

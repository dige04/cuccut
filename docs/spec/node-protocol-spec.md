# Node Protocol Specification

The HTTP contract between two machines when one machine shares its local model capabilities with other machines on the LAN, plus the `nodes` method on the local gateway that manages this. For the mechanism, trust model and trade-offs, see [Architecture design](../architecture/architecture-design.md) §6.7 and §12.7; for the output contract, see [Model Worker protocol specification](model-worker-protocol-spec.md) §7.

**Contents**

1. [Roles and scope](#1-roles-and-scope)
2. [Transport and request gates](#2-transport-and-request-gates)
3. [Health](#3-health)
4. [Pairing and tokens](#4-pairing-and-tokens)
5. [Jobs](#5-jobs)
6. [Event stream](#6-event-stream)
7. [Results and cleanup](#7-results-and-cleanup)
8. [Errors](#8-errors)
9. [Initiator behaviour](#9-initiator-behaviour)
10. [The `nodes` method on the local gateway](#10-local-gateway-nodes-methods)
11. [Persistent state](#11-persistent-state)
12. [Discovery](#12-discovery)
13. [Items pending review](#13-open-review-items)

---

## 1. Roles and scope

- **Node**: a Runtime with sharing turned on. It runs the “node service”, accepts capability jobs, and executes them with its own Model Worker.
- **Initiator**: a Runtime on another machine. Its remote node Provider hands one transcription attempt to the node, then retrieves the result and validates, publishes and writes it into the video itself.

The node receives only media bytes and parameters; it knows nothing about videos, assets or sessions. This version has only one job kind, `transcribe`. `nodeProtocolVersion` is `1`.

## 2. Transport and request gates

HTTP/1.1, JSON in UTF-8. All paths begin with `/v1`. The node service listens on one port on all IPv4 interfaces (default `47610`), separate from the local gateway.

Each request passes three gates in order. If a request fails one gate, the later gates are not evaluated.

1. **Source gate**: looks only at the socket's peer address and never reads any forwarding header. By default it allows loopback, private ranges (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, `fe80::/10`) and unique-local (`fc00::/7`); `::ffff:a.b.c.d` is judged by the IPv4 address it contains. When `allowAnySource` is on, this gate is skipped. Failure: `403 SOURCE_NOT_ALLOWED`.
2. **Version gate**: request header `X-CucCut-Node-Protocol: <integer>`. If it is missing or below the node's minimum version: `426 PROTOCOL_VERSION_UNSUPPORTED`, with `details.required` giving the minimum version. `GET /v1/health` does not pass this gate.
3. **Token gate**: `Authorization: Bearer <token>`. If invalid or revoked: `401 UNAUTHORIZED`. `GET /v1/health` and `POST /v1/pair` do not pass this gate.

Request body limits: JSON 64 KiB; for media, see §5.2.

## 3. Health

`GET /v1/health` → `200`:

```ts
interface NodeHealth {
  schema: 'cuccut.node-health/v1';
  nodeId: string;                     // Generated the first time sharing is turned on; unchanged afterwards
  name: string;                       // Human-readable name, defaults to the hostname
  nodeProtocolVersion: number;
  minNodeProtocolVersion: number;
  runtimeVersion: string;
  platform: { os: string; arch: string };
  capabilities: {
    transcribe: {
      enabled: boolean;
      bundles: Array<{ bundleId: string; backend: string; device: string; state: string }>;   // state same as models.list
      running: number;                // Number of jobs executing (including local jobs)
      queued: number;
    };
  };
}
```

Health reports no local information beyond the models: no paths, user names, paired clients or job contents.

## 4. Pairing and tokens

A pairing code is a 6-digit decimal number, valid for 10 minutes and single-use. After it is used or expires, the node's user generates a new one. If wrong attempts from any source total 5, pairing is locked for 10 minutes and the current pairing code is voided.

`POST /v1/pair`, request `{ code: string; clientId: string; clientName: string }`. `clientId` is a random identifier persisted in the initiator's Runtime Home; pairing again with the same `clientId` replaces its earlier token.

Response `200`: `{ nodeId: string; name: string; token: string }`.

- The token has the form `<clientId>.<secret>`, where `secret` is 32 random bytes encoded as base64url.
- The node stores only a salt and `sha256(salt ‖ secret)` per client, and compares them in constant time.
- Wrong or expired pairing code: `403 PAIRING_CODE_INVALID`. While locked: `429 PAIRING_LOCKED`, with `details.retryAfterMs`. When no pairing code is available, this also returns `PAIRING_CODE_INVALID`.

## 5. Jobs

### 5.1 Create

`POST /v1/jobs`:

```ts
interface NodeJobRequest {
  clientJobId: string;                // Idempotency key: the initiator's jobId plus the attempt number
  kind: 'transcribe';
  bundleId: string;
  input: {
    contentHash: string;              // 'sha256:<hex>', the content digest of the media file
    byteLength: number;
    mediaType: string;
    track: number;
    range: { start: number; end: number } | null;   // ticks, same as Model Worker protocol
  };
  options: TranscribeOptions;         // The options from Model Worker protocol §5, passed to the Worker unchanged
}
```

Response `201`: `NodeJob` (below). If the same client creates again with the same `clientJobId`, it gets `200` and the existing job, and no new job is created. If `clientJobId` is the same but the request content differs: `409 IDEMPOTENCY_CONFLICT`.

Admission checks run in this order:

- Capability switch: `403 CAPABILITY_DISABLED`, with `details.capability`.
- The model bundle is installed and usable on the node: `409 MODEL_NOT_READY`, with `details.state`.
- The client has no more than 9 unfinished jobs (1 running plus 8 queued): `429 QUEUE_FULL`.
- `byteLength` does not exceed 16 GiB: `413 INPUT_TOO_LARGE`.
- Free space on the disk holding staging is at least `byteLength` plus 2 GiB: `507 DISK_LOW`.

```ts
interface NodeJob {
  jobId: string;
  clientJobId: string;
  state: 'awaiting-input' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  phase: string;                      // Same as the phase in the jobs topic
  progress: { done: number; total: number | null; unit: 'seconds' | 'segments' } | null;
  attempt: number;
  error: { code: string; message: string; details?: unknown } | null;
  output: { sha256: string; byteLength: number } | null;    // Given when completed; sha256 is lowercase hex
  lastSeq: number;
}
```

### 5.2 Upload media

`PUT /v1/jobs/{jobId}/input`, `Content-Type: application/octet-stream`. `Content-Length` must equal `byteLength`. The node streams the request body into the job's staging directory and computes sha256 at the same time.

- Digest and length both match: `204`, and the job enters `queued`.
- Mismatch: `422 INPUT_HASH_MISMATCH`. The job fails with the same error, and the media is deleted immediately.
- No `Content-Length`, or `Transfer-Encoding` is used: `400 INVALID_REQUEST`. The job stays in `awaiting-input`.
- Job not in `awaiting-input`: `409 INVALID_STATE`.
- Upload not completed within 10 minutes of creation: the job fails with `INPUT_EXPIRED`.

Remote jobs on the node share the same model-bundle queue as local jobs. They run in the order they enter `queued`, and one model bundle runs only one job at a time. As a result, one client has at most one job running on a given model bundle at a time; the others wait in the queue.

### 5.3 Read and cancel

- `GET /v1/jobs/{jobId}` → `200 NodeJob`.
- `POST /v1/jobs/{jobId}/cancel` → `200 NodeJob`. Idempotent: a finished job is returned as is. A running job stops at the next segment boundary (Model Worker protocol §5). The response is returned only after the job has ended, waiting at most 15 seconds; on timeout it returns the current state, and the initiator keeps following the event stream.
- `DELETE /v1/jobs/{jobId}` → `204`. The initiator confirms it has retrieved the result or no longer needs it. Unfinished jobs are cancelled first, then the node deletes their media, results and records.

A client can see only its own jobs. Another client's job always returns `404 JOB_NOT_FOUND`.

## 6. Event stream

`GET /v1/jobs/{jobId}/events?since=<seq>` → `200`, `Content-Type: application/x-ndjson`. One event per line. If `since` is omitted, the stream starts from the beginning; if given, only events with a `seq` greater than it are sent. The node keeps all events for each job until the job is deleted.

```ts
type NodeJobEvent =
  | { seq: number; type: 'job'; job: NodeJob }            // State, phase or progress change, with the full NodeJob
  | { seq: number; type: 'warning'; warning: { code: string; segmentId?: string; detail?: string } }
  | { seq: number; type: 'language'; tag: string; confidence: number | null }
  | { type: 'heartbeat' };                                // One every 15 seconds; has no seq
```

The `job` event after the job ends is the last one, and the node then closes the response. When a Worker on the node crashes and is retried automatically, no intermediate `interrupted` appears in the events: the next `job` event is `running` with `attempt` increased by one. The event stream does not carry transcript text; segment content exists only in the result file.

## 7. Results and cleanup

`GET /v1/jobs/{jobId}/result` → `200`. The response body is the raw bytes of the `cuccut.asr-result/v1` file, with `ETag: "sha256:<hex>"`, and it supports a single-segment `Range`. If the job is not complete: `409 INVALID_STATE`. If the result has been deleted: `410 RESULT_EXPIRED`.

Cleanup rules on the node:

| Trigger | What is deleted |
| --- | --- |
| Job ends | Uploaded media and the staging directory |
| Initiator sends `DELETE`, or 10 minutes after the job ends | Result file, events and job record |
| Client revoked | All of its jobs: unfinished ones are cancelled, then as above |
| Sharing turned off, or Runtime stopped | All remote jobs: unfinished ones are cancelled; results and media are deleted |
| Runtime starts | Remote job directories left over from the last run |

The node does not put remote job results into the artifact library and does not write them into any video. Logs and the job ledger contain no transcript text. Remote jobs are visible in the node's `jobs` topic, with `submitter` set to `{ kind: 'node', id: <clientId> }`; `videoId`, `assetId`, `assetRevision` and `result` are null. After a node restart, any unfinished job is marked `interrupted`.

## 8. Errors

Non-2xx response body: `{ error: { code: string; message: string; details?: object } }`.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Request body or parameters are invalid; unknown paths (404) and unsupported methods (405) also use this code |
| 401 | `UNAUTHORIZED` | Token invalid or revoked |
| 403 | `SOURCE_NOT_ALLOWED` | Source address is outside the allowed range |
| 403 | `PAIRING_CODE_INVALID` | Pairing code wrong, expired or nonexistent |
| 403 | `CAPABILITY_DISABLED` | The node has not opened this capability |
| 404 | `JOB_NOT_FOUND` | Job does not exist or does not belong to this client |
| 409 | `MODEL_NOT_READY` | Model bundle is unavailable on the node |
| 409 | `IDEMPOTENCY_CONFLICT` | Same idempotency key, but different content |
| 409 | `INVALID_STATE` | The current state does not allow this operation |
| 410 | `RESULT_EXPIRED` | Result has been deleted |
| 413 | `INPUT_TOO_LARGE` | Media exceeds the limit |
| 422 | `INPUT_HASH_MISMATCH` | Uploaded content does not match the declared digest or length |
| 426 | `PROTOCOL_VERSION_UNSUPPORTED` | Protocol version too low |
| 429 | `PAIRING_LOCKED` | Pairing is locked |
| 429 | `QUEUE_FULL` | This client's job count has reached the limit |
| 507 | `DISK_LOW` | Node disk space is insufficient |

A job's own failure (`NodeJob.error`) reuses the model-class error codes from the Command and protocol specification §11.3, plus `INPUT_HASH_MISMATCH` and `INPUT_EXPIRED`.

## 9. Initiator behaviour

**Routing**. When the `node` parameter of `models.transcribe` gives a node's `nodeId` or alias, the job is handed to the remote node Provider, with `providerId` `node:<nodeId>`. When it is not given, the job runs locally. There is no automatic selection and no automatic failover. When a remote node is used, the local model catalogue is not checked.

**One attempt**. Pre-check (`GET /v1/health`: reachable, version, that `nodeId` is still the one paired, capability switch, model bundle state) → create (`clientJobId` is `<jobId>:<attempt number>`, `mediaType` taken from the asset record) → upload the original media file → follow the event stream, passing phase, progress, warnings and language to the `jobs` topic → retrieve the result and check sha256 and length → `DELETE` (best effort). The result is handed to JobManager, which validates, publishes and applies it the same way as a local result (Architecture design §7.3). The result's `provenance.runGeneration` is the attempt number on the node (2 if the node retried after a Worker crash), and it is checked against the `NodeJob.attempt` reported by the node. If the retrieved result does not match `NodeJob.output`, it is handled as an output that violates the contract (`MODEL_OUTPUT_INVALID`).

If the upload connection drops, first `GET` the job. If it is still `awaiting-input`, upload again; if the node has already received it, continue. If the event stream drops (including 45 seconds with no data at all; heartbeats count as data), reconnect with `since=<last seq>`, with backoff starting at 0.5 seconds and capped at 5 seconds. Any `seq` already seen is not processed again, so progress is never repeated or moved backwards. Other requests after creation (upload, read, retrieve result) that hit connection problems retry with the same backoff and deadline. An initiator submits one job to a given node at a time (one queue per node). Remote jobs do not take a slot in the local model bundle's queue.

**Failure normalization**. Neither category is retried automatically:

| Case | Job error | `details.reason` |
| --- | --- | --- |
| Pre-check or request rejected by the node | `REMOTE_NODE_REJECTED` | `unpaired` (401; or the `nodeId` in health differs from the one paired, meaning another node now answers at this address; or the node is no longer in the local paired list), `version`, `capability-disabled`, `model-not-ready`, `queue-full`, `disk-low`, `source-not-allowed`, `input-too-large` |
| Cannot connect during pre-check or creation | `REMOTE_NODE_LOST` | `unreachable` |
| Connection drops after creation; reconnecting with `since` or retrying still fails after 60 seconds | `REMOTE_NODE_LOST` | `stream-lost` |
| Node reports the job `interrupted`; on reconnect the job no longer exists (`404 JOB_NOT_FOUND`, because the node cleared it on restart); or the job ends as `cancelled` although the initiator did not cancel it (sharing turned off, client revoked, or Runtime stopped) | `REMOTE_NODE_LOST` | `node-restarted` |
| Job fails on the node; or the request is rejected with an error code other than those above (for example `400 INVALID_REQUEST`) | The node's error code and message, passed through unchanged | `details` is the node's details plus `node` (the node's `nodeId`) |

All `REMOTE_NODE_*` `details` carry `node`. `capability-disabled` also carries `capability`, and its message explains how to turn the capability on. Both categories end at the first attempt: the job's `attempt` stays at 1. The local crash retry applies only to the local Worker.

A Worker crash on the node is retried once by the node itself, per Architecture design §6.5. The initiator sees the same remote job with `attempt` increased by one.

**Cancellation**. The initiator sends `cancel` and waits for the node to confirm (the initiator waits at most 20 seconds), then sends `DELETE`. Any of these counts as confirmation: `cancel` returns a terminal state, `DELETE` succeeds, or the job no longer exists (404). Once the node confirms, the job is `cancelled`. If the node is unreachable, the local job still ends as `cancelled`, with a warning `remote-cancel-unconfirmed`. The local side stops waiting, but does not claim that the node has stopped.

**Token**. The initiator's token appears only in the `Authorization` header. It does not go into logs, job records, events or error details.

## 10. Local gateway `nodes` methods

These methods go through the local gateway (loopback plus gateway token). The node service has no management endpoints.

| Method | Parameters | Result |
| --- | --- | --- |
| `nodes.share.start` | `{ port?: number; name?: string; allowAnySource?: boolean }` | `ShareStatus`; also generates a pairing code |
| `nodes.share.stop` | `{}` | `ShareStatus` |
| `nodes.share.status` | `{}` | `ShareStatus` |
| `nodes.share.pairingCode` | `{}` | `ShareStatus`; invalidates the old pairing code and generates a new one, and clears the pairing lock |
| `nodes.share.revoke` | `{ clientId: string }` | `ShareStatus` |
| `nodes.share.setCapability` | `{ capability: string; enabled: boolean }` | `ShareStatus`; `capability` must be a model capability the node supports for sharing, otherwise `invalid-request` |
| `nodes.discover` | `{ timeoutMs?: number }` | `{ nodes: DiscoveredNode[] }` |
| `nodes.pair` | `{ host: string; port: number; code: string; alias?: string }` | `{ node: PairedNode }` |
| `nodes.list` | `{}` | `{ nodes: PairedNode[] }`; each node carries a live health probe (2-second timeout) |
| `nodes.remove` | `{ nodeId: string }` | `{}`; deletes only the local record and token |

```ts
interface ShareStatus {
  enabled: boolean;                   // the user's switch, persistent
  listening: boolean;                 // whether the node service is listening right now
  error: string | null;               // why it is on but not listening (e.g. port in use)
  nodeId: string | null;
  name: string;
  port: number;
  addresses: string[];                // addresses reachable right now: when listening on all interfaces, the machine's non-loopback IPv4 addresses; when bound to a specific address, only that one; empty when not listening
  allowAnySource: boolean;
  capabilities: Record<string, { enabled: boolean }>;   // one entry per shareable model capability; persistent
  pairing: { code: string; expiresAt: string } | { lockedUntil: string } | null;
  clients: Array<{ clientId: string; name: string; pairedAt: string; lastSeenAt: string | null }>;
  jobs: { running: number; queued: number };
}

interface DiscoveredNode { name: string; host: string; port: number; nodeId: string | null }

interface PairedNode {
  nodeId: string;
  alias: string;                      // unique on this machine; defaults to the node's name, with a sequence number added on conflict
  name: string;
  host: string;
  port: number;
  pairedAt: string;
  health: NodeHealth | null;          // null when the probe gets no answer
  problem: 'unreachable' | 'version' | 'unpaired' | null;
}
```

A failed `nodes.pair` uses the protocol error `REMOTE_NODE_REJECTED` (`details.reason` is `pairing-code-invalid`, `pairing-locked`, `version`, or `source-not-allowed`) or `REMOTE_NODE_LOST` (`details.reason` is `unreachable`). The gateway's `RpcError.code` is `conflict`; these two codes go in `details.code`. Pairing first reads `/v1/health` (if the node cannot be reached or the version is incompatible, the pairing code is not spent), checks that the requested alias is available, then calls `POST /v1/pair`. `clientName` is the initiator's hostname. Pairing the same `nodeId` again replaces the existing record and token. The alias is kept unless a new one is given this time.

The probe in `nodes.list` first does `GET /v1/health`. If the node cannot be reached, times out, or refuses the source address (403), the result is `unreachable`. An incompatible version gives `version`. A `nodeId` that differs from the one at pairing gives `unpaired`. Then it reads a job that does not exist, with the token (`GET /v1/jobs/job_probe`): 401 means `unpaired` (token revoked), and 404 means the token is valid. No new endpoint was added to the node for this. Both steps share a 2-second deadline.

`nodes.discover`'s `timeoutMs` defaults to 2000 with a maximum of 10000, and returns when it expires. Results exclude this machine's own node. `nodes.remove` accepts only a `nodeId` for `nodeId`; the CLI first uses `nodes.list` to turn an alias into a `nodeId`.

## 11. Persistent state

| File | Contents | Permissions |
| --- | --- | --- |
| `<home>/store/node-share.json` | Node side: the switch, `nodeId`, name, port, `allowAnySource`, per-capability switches, paired clients (salt and hash, no plaintext token) | 0600 |
| `<home>/store/nodes.json` | Initiator side: `{ formatVersion: 1, clientId, nodes: [{ nodeId, alias, name, host, port, pairedAt }] }`. `clientId` is generated on first open (`c_` plus 16 random bytes in base64url) and never changes after that. Writes go to a temp file, then a rename | 0600 |
| Credential store, entry `node:<nodeId>` | Initiator side: this node's token (architecture design §6.8). The dev build keeps it in `<home>/store/model-credentials.json`; the release build uses the system keychain | Follows the backend |
| `<home>/staging/node-jobs/<jobId>/` | Node side: media and results of remote jobs | Deleted with the job |

**Tokens.** `nodes.json` holds no tokens. Tokens that earlier versions wrote into the node record as `token` are migrated one by one into the credential store on open. Records that migrate successfully lose the field. Records that cannot be migrated keep it until the next open, but it is not used, and that node is treated as "token unreadable." When the token is unreadable, probing reports `unpaired` and transcription reports `not-paired`, with the reason in the message. `nodes.pair` and `nodes.remove` reject with `conflict` (`details.code: CREDENTIAL_UNAVAILABLE`) when the credential store is unavailable. Pairing writes the token before the record; removal deletes the token before the record.

**Per-capability switches.** The node owner can switch each shareable model capability separately (`nodes.share.setCapability`). The state is saved in `node-share.json` and restored on restart. When sharing is turned on for the first time, every capability the node already supports is on by default. Capabilities added later default to off, and the owner turns them on. When sharing has never been turned on, `ShareStatus.capabilities` reports the defaults that will apply when it is turned on. A switch can be set beforehand and is carried over when sharing is turned on. A `node-share.json` written before per-capability switches existed has no capability switch entries, and it is read as usual. A node that had sharing on is treated as having all the capabilities that existed then on (only `transcribe`). A node that had not turned sharing on is treated as newly turned on. Switches take effect immediately. The health endpoint reports the new state right away. After a capability is switched off, new jobs are rejected with `403 CAPABILITY_DISABLED`. Jobs already accepted run to completion. Switches apply only to model capabilities. There are no non-model tasks such as "download" or "export."

The sharing switch is restored when the Runtime restarts. When `enabled` is true, the node starts listening at launch, and it does not generate a pairing code automatically. Pairing codes and the pairing lock exist only in memory.

## 12. Discovery

While the node service is listening, it registers `_cuccut-node._tcp` on mDNS. The instance name is the node's name. The TXT record holds `id=<nodeId>` and `v=<nodeProtocolVersion>`. TXT is for display only and is not a basis for trust. At pairing, the `nodeId` from `/v1/health` and from the pairing result is authoritative.

On macOS, the system's `dns-sd` is used. On other platforms this version neither registers nor browses. `nodes.discover` returns an empty list, and users pair by entering an address and port. Browsing runs `dns-sd -B _cuccut-node._tcp local`. Each instance is resolved with `dns-sd -L` to get the host, port and TXT record, then `dns-sd -G v4` gets the host's IPv4 addresses (private-network addresses first, loopback and link-local last). `dns-sd` does not end on its own. When the deadline arrives, all child processes are ended, and instances already resolved are still returned.

## 13. Open review items

| Item | What needs deciding | The current document's assumption |
| --- | --- | --- |
| What to upload | Whether to upload the raw source file, or have the initiator extract the audio track first | Raw file: the same input, bit for bit, as local transcription. Large videos are slower over the LAN |
| Token storage | Where the initiator's token is kept | Decided: it shares the credential store with API keys (key `node:<nodeId>`). The release build uses OS secure storage; the dev build uses a 0600 file (architecture design §6.8, §11) |
| Plaintext transport | Whether to accept it | Decided: accepted. The threat model is the same as a LAN printer (architecture design §6.7) |
| Shared-path input | A node-readable shared path in place of upload | Not doing |
| Discovery on other platforms | mDNS on Windows and Linux | Not doing. Enter the address manually |
| Remote download and remote export | Whether to make "download video" and "export video" node jobs | Not doing. Nodes share only model capabilities. Download would need the node to reach the internet actively, and export would need the video's frozen inputs sent to the node. Both are beyond the current boundary |
| IPv6 listening | Whether the node service also listens on IPv6 | IPv4 only. The source gate can already judge IPv6 addresses |

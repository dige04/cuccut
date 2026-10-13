import type { Id } from './domain.ts';
import type { MessageRef } from './message-ref.ts';
import type { OnlineCapability } from './models.ts';
import type { WebServiceAccess } from './web.ts';

/**
 * External services (architecture design §4.8, §12.8): the entry points the Runtime opens to other programs and devices, managed uniformly by ServiceManager.
 *
 * - Each service has the same set of states. The default is `off`, and the user turns it on explicitly. Configuration is persisted in `store/services.json` and restored on startup.
 * - Status and pending service approvals are delivered over the `services` topic (command and protocol spec §10.4).
 * - The state of the node service (`node`) is a projection of `nodes.share.*`: its toggle, port and pairing still use that dedicated set of methods.
 */

export const SERVICE_IDS = ['mcp', 'model-api', 'web', 'node'] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export type ServiceState = 'off' | 'starting' | 'on' | 'stopping' | 'error';

/** Operation level: `read` is query only; `ask` writes, tasks and generation are confirmed by the user each time; `auto` runs directly. Tools below the required level do not appear in the catalog. */
export const SERVICE_LEVELS = ['read', 'ask', 'auto'] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

/** Access policy (§4.8): scope (all videos, or a list of videoIds) and operation level. */
export interface ServicePolicy {
  videos: 'all' | { ids: Id[] };
  level: ServiceLevel;
}

/** Default policy for a new service: all videos, confirmed each time. */
export const DEFAULT_SERVICE_POLICY: ServicePolicy = { videos: 'all', level: 'ask' };

/** Default port for the MCP service (loopback). If the port is taken, the service enters `error` and does not switch ports. */
export const MCP_DEFAULT_PORT = 47620;
/**
 * Interface version of the MCP service: tool names and parameters are an external contract; breaking changes bump this version (`serverInfo.version` and `cuccut.interfaceVersion`).
 * `2`: the exposed list is now derived from the tool catalog's `surfaces`; `exports_create` → `export`, `link_import_start` → `download`,
 * `models_synthesize_speech` → `speak`, `models_generate_image` → `image`, `skill_read` → `skills_read`, and `videos_create` adds `project`.
 */
export const MCP_INTERFACE_VERSION = '2';

/**
 * Effect of a tool catalog entry (architecture design §3.5): `query` is read-only; `mutation` changes state (it goes on the undo stack or writes files); `job` returns a `jobId` immediately and the result comes later;
 * `destructive` cannot be undone or moves things out of the editor (requires explicit user consent).
 */
export const TOOL_EFFECTS = ['query', 'mutation', 'job', 'destructive'] as const;
export type ToolEffect = (typeof TOOL_EFFECTS)[number];

/** Which surfaces a tool catalog entry appears on: `agent` (the tool bridge for agents in a session), `mcp` (the external MCP service), `cli` (the cuccut CLI). */
export const TOOL_SURFACES = ['agent', 'mcp', 'cli'] as const;
export type ToolSurface = (typeof TOOL_SURFACES)[number];

/** A tool exposed by the MCP service: its name, title and effect (`query` tools are exposed at every level; the others only under `ask` and `auto`). */
export interface McpServiceTool {
  name: string;
  title: string;
  effect: ToolEffect;
}

/**
 * Tools exposed by the MCP service (§4.8): derived by the Runtime's tool catalog from entries whose `surfaces` include `mcp`. This is the protocol constant for the same list,
 * used by the UI to list tools; runtime-core tests assert that the two match. Renaming a tool or changing its parameters requires bumping `MCP_INTERFACE_VERSION`.
 */
export const MCP_SERVICE_TOOL_NAMES: readonly McpServiceTool[] = [
  { name: 'videos_list', title: 'List videos', effect: 'query' },
  { name: 'videos_create', title: 'Create video', effect: 'mutation' },
  { name: 'videos_inspect', title: 'Inspect video', effect: 'query' },
  { name: 'documents_read', title: 'Read document', effect: 'query' },
  { name: 'edits_apply', title: 'Edit video', effect: 'mutation' },
  { name: 'edits_undo', title: 'Undo edit', effect: 'mutation' },
  { name: 'videos_derive', title: 'Derive child video', effect: 'mutation' },
  { name: 'captions_create', title: 'Create caption layer', effect: 'mutation' },
  { name: 'videos_frames', title: 'Grab video frames', effect: 'mutation' },
  { name: 'videos_shots', title: 'Find shot changes', effect: 'query' },
  { name: 'videos_history', title: 'View edit history', effect: 'query' },
  { name: 'documents_put', title: 'Write document', effect: 'mutation' },
  { name: 'assets_import', title: 'Import asset', effect: 'mutation' },
  { name: 'compositions_import', title: 'Import code graphic', effect: 'mutation' },
  { name: 'compositions_preview', title: 'Preview code graphic', effect: 'mutation' },
  { name: 'assets_prune', title: 'Remove unused assets', effect: 'mutation' },
  { name: 'chapters_adopt', title: 'Adopt source chapters', effect: 'mutation' },
  { name: 'edits_ops', title: 'List edit operations', effect: 'query' },
  { name: 'models_capabilities', title: 'View model capabilities', effect: 'query' },
  { name: 'models_list', title: 'List local model bundles', effect: 'query' },
  { name: 'transcribe', title: 'Transcribe', effect: 'job' },
  { name: 'translate', title: 'Translate', effect: 'job' },
  { name: 'dub', title: 'Translate and dub', effect: 'job' },
  { name: 'speak', title: 'Synthesize speech', effect: 'job' },
  { name: 'image', title: 'Generate image', effect: 'job' },
  { name: 'music', title: 'Generate music', effect: 'job' },
  { name: 'jobs_inspect', title: 'Inspect job', effect: 'query' },
  { name: 'jobs_wait', title: 'Wait for job', effect: 'query' },
  { name: 'jobs_list', title: 'List jobs', effect: 'query' },
  { name: 'jobs_cancel', title: 'Cancel job', effect: 'mutation' },
  { name: 'jobs_retry', title: 'Rerun failed pipeline', effect: 'job' },
  { name: 'export', title: 'Export', effect: 'job' },
  { name: 'space_list', title: 'List Space entries', effect: 'query' },
  { name: 'space_search', title: 'Search transcripts across videos', effect: 'query' },
  { name: 'projects_list', title: 'List projects', effect: 'query' },
  { name: 'skills_list', title: 'List skills', effect: 'query' },
  { name: 'skills_read', title: 'Read a skill', effect: 'query' },
  { name: 'library_list', title: 'List the user library', effect: 'query' },
  { name: 'library_show', title: 'Show a user library entry', effect: 'query' },
  { name: 'download', title: 'Download from link', effect: 'job' },
];
/** Default port (loopback) of the model API service, next to the MCP service. */
export const MODEL_API_DEFAULT_PORT = 47621;
/**
 * Interface version of the model API service: the paths and the request and response fields are an external contract; breaking changes bump this version (in each response's
 * `X-CucCut-Interface-Version` header and in `GET /v1/cuccut/info`).
 */
export const MODEL_API_INTERFACE_VERSION = '1';
/** Default cap on in-flight generation requests per client for the model API service: over the limit returns 429. */
export const MODEL_API_DEFAULT_MAX_CONCURRENT = 4;
export const MODEL_API_MAX_CONCURRENT_LIMIT = 64;
/** Upload limit accepted by the model API service (the multipart body for transcription): over the limit returns 413. */
export const MODEL_API_MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
/** JSON body limit accepted by the model API service: over the limit returns 413. */
export const MODEL_API_MAX_JSON_BYTES = 8 * 1024 * 1024;

/**
 * Route switches of the model API service (architecture design §4.8): by default it only routes to this machine (`local`). Forwarding external requests to online providers, LAN nodes or agent providers must each be turned on explicitly.
 * A model category that is not enabled does not appear in `/v1/models`, and access by name returns 404.
 */
export interface ModelApiRouting {
  online: boolean;
  nodes: boolean;
  agent: boolean;
}

/**
 * One entry in the alias table: a model name used by external programs → a provider and model under one capability. When `modelId` is null, the provider's default model is used
 * (when the user's default points to it, the user's default is used). Aliases are globally unique and contain no `/` (`<providerId>/<modelId>` is the canonical form).
 */
export interface ModelApiAlias {
  alias: string;
  capability: OnlineCapability;
  providerId: string;
  modelId: string | null;
}

/** The model API service's own config and limits (`ServiceStatus.modelApi`). */
export interface ModelApiStatus {
  routing: ModelApiRouting;
  aliases: ModelApiAlias[];
  /** Cap on in-flight generation requests per client. */
  maxConcurrentPerClient: number;
  maxUploadBytes: number;
  maxJsonBytes: number;
  interfaceVersion: string;
}

/** Timeout for service approvals: on timeout it is treated as a rejection. Shorter than the common MCP client request timeout (60 s), so callers receive a clear rejection. */
export const SERVICE_APPROVAL_TIMEOUT_MS = 50_000;

/** An issued client: metadata only. The plaintext token is returned once, at creation; the Runtime stores only a hash. */
export interface ServiceClient {
  clientId: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Audit record of one external request (§12.8): caller, tool, target and result; no parameter bodies or media content. */
export interface ServiceRequestRecord {
  at: string;
  clientId: string;
  clientName: string;
  tool: string;
  /** Target video (videoId); null if there is none. */
  videoId: Id | null;
  /** `ok`, or the error code on rejection or failure. */
  outcome: string;
}

export interface ServiceStatus {
  serviceId: ServiceId;
  label: string;
  /** Whether this version provides the service. When false, the status is always `off`, and `services.start` rejects with `SERVICE_NOT_AVAILABLE`. */
  available: boolean;
  state: ServiceState;
  /** The reason when `error` (e.g. the port is in use). */
  error: string | null;
  errorRef?: MessageRef;
  /** Starts with the Runtime. For the node service, whether sharing is on. */
  autostart: boolean;
  /** Configured port; when on, the port actually listening. */
  port: number | null;
  /** Address when on (the MCP service is `http://127.0.0.1:<port>/mcp`), otherwise null. */
  endpoint: string | null;
  /** Access policy; the node service has none (null). */
  policy: ServicePolicy | null;
  /** Issued clients; for the node service, the paired clients are in `nodes.share.status`. */
  clients: ServiceClient[];
  /** Recent external requests, newest first, at most 20. */
  recentRequests: ServiceRequestRecord[];
  /** Routes, aliases and limits of the model API service; other services have none. */
  modelApi?: ModelApiStatus;
  /** Web service only: read-only, with a method allowlist (it has no access policy, so `policy` is null; browser sessions are listed in `clients`). */
  web?: WebServiceAccess;
}

/** One pending service approval (writes, tasks and generation at the `ask` level). */
export interface ServiceApproval {
  approvalId: Id;
  serviceId: ServiceId;
  clientId: string;
  clientName: string;
  tool: string;
  /** Target video; null if there is none. */
  video: { videoId: Id; name: string } | null;
  /** Parameter summary: one human-readable line, without long text or media content. */
  summary: string;
  createdAt: string;
  expiresAt: string;
}

export type ServiceApprovalDecision = 'allow' | 'deny';
/** `timeout`: no one handled it before the deadline, so it is rejected; `cancelled`: the service stopped or the caller disconnected. */
export type ServiceApprovalOutcome = 'allowed' | 'denied' | 'timeout' | 'cancelled';

export interface ServicesSnapshot {
  services: ServiceStatus[];
  /** Pending service approvals, oldest first. */
  approvals: ServiceApproval[];
}

export type ServicesEvent =
  | { type: 'service.updated'; service: ServiceStatus }
  | { type: 'approval.requested'; approval: ServiceApproval }
  | { type: 'approval.resolved'; approvalId: Id; outcome: ServiceApprovalOutcome };

/** The changeable items of `services.configure`; omitted items stay as they are. */
export interface ServiceConfigureParams {
  serviceId: ServiceId;
  autostart?: boolean;
  /** 0 means the system picks a free port (for tests and diagnostics). */
  port?: number;
  level?: ServiceLevel;
  videos?: 'all' | { ids: Id[] };
  /** Only for the model API service: the given switches replace the current ones; omitted ones stay unchanged. Other services reject with `invalid-request`. */
  routing?: Partial<ModelApiRouting>;
  /** Only for the model API service: cap on in-flight generation requests per client. */
  maxConcurrentPerClient?: number;
  /** Accepted only by the Web service: read-only. */
  readOnly?: boolean;
  /** Accepted only by the Web service: a method allowlist (method name or `<namespace>.*`), which can only be narrowed within the default set; null restores the default set. */
  methods?: string[] | null;
}

/** Result of `services.mcp.connectionInfo`: can be pasted directly into the MCP config of another app; no plaintext token. */
export interface McpConnectionInfo {
  url: string;
  /** Shape of the request header; `<token>` is replaced with the token obtained when the client was created. */
  headers: { Authorization: string };
  /** Config snippets for common MCP clients (JSON text). */
  snippet: string;
  interfaceVersion: string;
  /** Hint for when the service is not on; null when it is on. */
  notice: string | null;
}

/**
 * Result of `services.modelApi.connectionInfo`: how an OpenAI-shaped client connects (base URL and headers), with no plaintext token.
 */
export interface ModelApiConnectionInfo {
  /** `http://127.0.0.1:<port>/v1`: the `baseURL` for the OpenAI SDK. */
  baseUrl: string;
  headers: { Authorization: string };
  /** Snippet for a common usage (environment variables): the token uses a placeholder. */
  snippet: string;
  interfaceVersion: string;
  /** Hint for when the service is not on; null when it is on. */
  notice: string | null;
}

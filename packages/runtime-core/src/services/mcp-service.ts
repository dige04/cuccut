import { createServer, type IncomingMessage, type Server } from 'node:http';
import {
  MCP_INTERFACE_VERSION,
  RUNTIME_VERSION,
  RpcError,
  newId,
  nowIso,
  type Id,
  type McpConnectionInfo,
  type ServiceClient,
  type ServiceConfigureParams,
  type ServiceRequestRecord,
} from '@cuccut/protocol';
import { RcServices } from '@cuccut/protocol/messages/runtime-core';
import type { Harness, Logger } from '@cuccut/harness';
import type { ModelJobs } from '../models/model-jobs.ts';
import type { VideoService } from '../videos/video-service.ts';
import { McpEndpoint } from '../agent-tools/mcp-endpoint.ts';
import { ToolCatalog, type ToolResult, type ToolSet } from '../agent-tools/tool-catalog.ts';
import type { ServicePrincipal, ToolPrincipal, ToolScope } from '../agent-tools/tool-scope.ts';
import type { ServiceApprovals } from './service-approvals.ts';
import type { ServiceConfigStore } from './service-config-store.ts';
import type { ManagedService, ServiceReport } from './service-manager.ts';
import { ServiceScope } from './service-scope.ts';
import { LOOPBACK_HOST as HOST, RecentRequests, ServiceClients, closeLoopback, listenLoopback } from './service-clients.ts';
import { describeServiceTool, serviceToolExposed } from './mcp-tools.ts';

/**
 * MCP service (architecture design §4.8, §12.8): a stateless MCP Streamable HTTP endpoint for agents in other apps.
 * It shares the MCP endpoint code and tool implementations with the tool bridge; the only difference is the principal (service principal and access policy).
 *
 * - Listens only on the loopback address, port configurable (default `MCP_DEFAULT_PORT`); if the port is taken, it enters `error` and does not switch ports;
 * - Auth: one token per client (`Authorization: Bearer <token>`), only the hash is stored; missing, wrong or revoked tokens get 401;
 * - Requests carrying `Origin` are rejected (web pages cannot call it), and requests whose `Host` is not a loopback address are rejected (DNS rebinding);
 * - One principal per request (a new `connectionId`): when the request ends, release the videos it opened; on disconnect, cancel pending approvals;
 * - Every tool call is audited: caller, tool, target video and result; argument bodies and media content are not recorded, and tokens are not recorded.
 */

export interface McpServiceDeps {
  store: ServiceConfigStore;
  harness: Harness;
  videos: VideoService;
  models: ModelJobs;
  approvals: ServiceApprovals;
  log: Logger;
  /** The client or the recent requests changed: send one `service.updated`. */
  onChange: () => void;
  /**
   * The full tool-catalog tool group, built for the service's scope (same factory as the session's catalog). Which ones are exposed externally is decided by the catalog entries' `surfaces` and access level
   * (`serviceToolExposed`); nothing is filtered here.
   */
  toolSets: (scope: ToolScope) => ToolSet[];
}

export class McpService implements ManagedService {
  readonly id = 'mcp' as const;
  get label(): string {
    return RcServices.mcpServiceLabel().text;
  }
  readonly available = true;
  readonly #deps: McpServiceDeps;
  readonly #log: Logger;
  readonly #endpoint: McpEndpoint;
  readonly #controllers = new WeakMap<ToolPrincipal, AbortController>();
  readonly #clients: ServiceClients;
  readonly #recent = new RecentRequests();
  #server: Server | null = null;
  #port: number | null = null;

  constructor(deps: McpServiceDeps) {
    this.#deps = deps;
    this.#log = deps.log.child('mcp-service');
    this.#clients = new ServiceClients({ store: deps.store, serviceId: 'mcp', label: 'MCP', log: this.#log, onChange: deps.onChange });
    const scope = new ServiceScope({
      harness: deps.harness,
      videos: deps.videos,
      jobs: deps.models.jobs,
      approvals: deps.approvals,
      policy: () => deps.store.get('mcp').policy,
      allowVideo: (_serviceId, videoId) => this.#allowVideo(videoId),
    });
    const tools = new ToolCatalog(deps.toolSets(scope), deps.log, {
      surface: 'mcp',
      expose: (_name, info) => serviceToolExposed(info, deps.store.get('mcp').policy.level),
      describe: describeServiceTool,
    });
    this.#endpoint = new McpEndpoint({
      authenticate: (request) => this.#authenticate(request),
      tools,
      log: deps.log,
      loopbackHostOnly: true,
      serverInfo: {
        version: MCP_INTERFACE_VERSION,
        meta: { 'cuccut.interfaceVersion': MCP_INTERFACE_VERSION, 'cuccut.runtimeVersion': RUNTIME_VERSION },
      },
      onToolCall: (name, principal, result) => this.#audit(name, principal, result),
    });
  }

  async start(): Promise<void> {
    if (this.#server) return;
    const port = this.#deps.store.get('mcp').port;
    const server = createServer((request, response) => {
      const principal = this.#endpoint.accept(request, response);
      if (principal === false) {
        response.writeHead(404).end();
        return;
      }
      if (principal === null) {
        this.#log.info('External request refused',{ status: response.statusCode });
        return;
      }
      // Request ends (or the connection drops): cancel pending approvals, and release the videos this request opened (closed after a grace period, if no one else is using them).
      response.once('close', () => {
        this.#controllers.get(principal)?.abort();
        this.#deps.videos.connectionClosed(principal.connectionId);
      });
    });
    const actual = await listenLoopback(server, port);
    server.on('error', (error) => this.#log.warn('MCP service error',{ error: String(error) }));
    this.#server = server;
    this.#port = actual;
    this.#log.info('MCP service listening',{ port: this.#port });
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    this.#port = null;
    // Immediately disconnect existing connections (§12.8); the tasks it submitted are kept, and the user decides.
    if (server) await closeLoopback(server);
    await this.#deps.store.flush('mcp').catch(() => {});
  }

  status(): ServiceReport {
    const config = this.#deps.store.get('mcp');
    const port = this.#port ?? config.port;
    return {
      autostart: config.autostart,
      port,
      endpoint: this.#server ? `http://${HOST}:${port}/mcp` : null,
      policy: config.policy,
      clients: this.#clients.list(),
      recentRequests: this.#recent.list(),
    };
  }

  async applyConfig(params: ServiceConfigureParams): Promise<boolean> {
    if (params.routing !== undefined || params.maxConcurrentPerClient !== undefined) {
      throw new RpcError('invalid-request', RcServices.routingOnlyForModelApi());
    }
    const before = this.#deps.store.get('mcp');
    const policy = {
      level: params.level ?? before.policy.level,
      videos:
        params.videos === undefined
          ? before.policy.videos
          : params.videos === 'all'
            ? ('all' as const)
            : { ids: [...new Set(params.videos.ids)] },
    };
    await this.#deps.store.update('mcp', {
      ...(params.autostart !== undefined ? { autostart: params.autostart } : {}),
      ...(params.port !== undefined ? { port: params.port } : {}),
      policy,
    });
    return params.port !== undefined && params.port !== before.port;
  }

  // ---- Client ----

  createClient(name: string): Promise<{ client: ServiceClient; token: string }> {
    return this.#clients.create(name);
  }

  listClients(): ServiceClient[] {
    return this.#clients.list();
  }

  revokeClient(clientId: string): Promise<ServiceClient[]> {
    return this.#clients.revoke(clientId);
  }

  /** Config that can be pasted directly into other apps: the address and header shape, with the token as a placeholder (plaintext is given only once, when the client is created). */
  connectionInfo(clientId?: string): McpConnectionInfo {
    const client = this.#clients.find(clientId);
    const { port, endpoint } = this.status();
    const url = endpoint ?? `http://${HOST}:${port}/mcp`;
    const placeholder = (client ? RcServices.tokenPlaceholder({ client: client.name }) : RcServices.tokenPlaceholderGeneric()).text;
    const headers = { Authorization: `Bearer ${placeholder}` };
    return {
      url,
      headers,
      snippet: JSON.stringify({ mcpServers: { cuccut: { type: 'http', url, headers } } }, null, 2),
      interfaceVersion: MCP_INTERFACE_VERSION,
      notice: this.#server ? null : RcServices.mcpNotRunning().text,
    };
  }

  /** Videos the service creates (`videos_create`) are added to its video list: when the access policy is a list, they become visible only after this; when the policy is all videos, nothing needs to change. */
  async #allowVideo(videoId: Id): Promise<void> {
    if (await this.#deps.store.allowVideo('mcp', videoId)) this.#deps.onChange();
  }

  // ---- Requests ----

  #authenticate(request: IncomingMessage): ServicePrincipal | null {
    const client = this.#clients.authenticate(request);
    if (!client) return null;
    const controller = new AbortController();
    const principal: ServicePrincipal = {
      connectionId: newId('svc'),
      kind: 'service',
      name: 'mcp',
      serviceId: 'mcp',
      clientId: client.clientId,
      clientName: client.name,
      signal: controller.signal,
      audit: { videoId: null },
    };
    this.#controllers.set(principal, controller);
    return principal;
  }

  #audit(tool: string, principal: ToolPrincipal, result: ToolResult): void {
    if (principal.kind !== 'service') return;
    const outcome = result.isError ? errorCodeOf(result) : 'ok';
    const record: ServiceRequestRecord = {
      at: nowIso(),
      clientId: principal.clientId,
      clientName: principal.clientName,
      tool,
      videoId: principal.audit.videoId,
      outcome,
    };
    this.#recent.add(record);
    this.#log.info('External request',{ serviceId: 'mcp', clientId: principal.clientId, tool, videoId: record.videoId, outcome });
    this.#deps.onChange();
  }
}

function errorCodeOf(result: ToolResult): string {
  try {
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { error?: { code?: unknown } };
    return typeof parsed.error?.code === 'string' ? parsed.error.code : 'ERROR';
  } catch {
    return 'ERROR';
  }
}

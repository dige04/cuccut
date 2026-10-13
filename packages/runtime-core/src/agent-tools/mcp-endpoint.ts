import type { IncomingMessage, ServerResponse } from 'node:http';
import { RUNTIME_VERSION } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import type { AgentGrants } from './grants.ts';
import type { ToolCatalog, ToolResult } from './tool-catalog.ts';
import type { ToolPrincipal } from './tool-scope.ts';

/**
 * MCP endpoint (architecture design §3.5, §4.8): a stateless MCP Streamable HTTP endpoint that only replies with
 * `application/json`, opens no SSE and issues no session id. The tool bridge and the external MCP service share it; they
 * differ only in the authenticated principal and the tool catalog:
 *
 * - the tool bridge is mounted on the local gateway: native agents (Codex) connect via `config.mcp_servers` and
 *   authenticate with the session token;
 * - the MCP service has its own loopback listener: agents in other apps authenticate with the token issued to their
 *   client, and only a loopback `Host` is accepted (against DNS rebinding).
 *
 * - Only `/mcp` is recognized; any request carrying `Origin` is rejected: web pages in a browser cannot call it.
 * - The token only says who the caller is; whether an action is allowed is decided by the tool on each call.
 */

export interface McpEndpointOptions {
  /** Tool bridge: session tokens. Mutually exclusive with `authenticate`. */
  grants?: AgentGrants;
  /** Request -> principal; null when the token is missing, unknown or revoked (replies 401). */
  authenticate?: (request: IncomingMessage) => ToolPrincipal | null;
  tools: ToolCatalog;
  log: Logger;
  /** Accept only requests whose `Host` is a loopback address. */
  loopbackHostOnly?: boolean;
  /** Server info returned to the client by `initialize`; defaults to the Runtime version. */
  serverInfo?: { version: string; meta?: Record<string, unknown> };
  /** After each tool call (audit). */
  onToolCall?: (name: string, principal: ToolPrincipal, result: ToolResult) => void;
}

const PATH = '/mcp';
const MAX_BODY_BYTES = 1024 * 1024;
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

class JsonRpcFailure extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export class McpEndpoint {
  readonly #options: McpEndpointOptions;
  readonly #authenticate: (request: IncomingMessage) => ToolPrincipal | null;
  readonly #tools: ToolCatalog;
  readonly #log: Logger;

  constructor(options: McpEndpointOptions) {
    this.#options = options;
    const grants = options.grants;
    this.#authenticate = options.authenticate ?? ((request) => grants?.resolve(request.headers.authorization) ?? null);
    this.#tools = options.tools;
    this.#log = options.log.child('mcp');
  }

  /** Returns false when the path is not `/mcp`, leaving it to the next handler. Returns this request's principal when authentication passes. */
  handle(request: IncomingMessage, response: ServerResponse): boolean {
    return this.accept(request, response) !== false;
  }

  /** Like `handle`, but hands the authenticated principal to the caller (the external service uses it to release resources when the request ends): false when not `/mcp`, null when rejected. */
  accept(request: IncomingMessage, response: ServerResponse): ToolPrincipal | null | false {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== PATH) return false;
    if (this.#options.loopbackHostOnly && !loopbackHost(request.headers.host)) {
      response.writeHead(403).end();
      return null;
    }
    if (request.headers.origin !== undefined) {
      response.writeHead(403).end();
      return null;
    }
    const principal = this.#authenticate(request);
    if (!principal) {
      response.writeHead(401, { 'WWW-Authenticate': 'Bearer' }).end();
      return null;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return principal;
    }
    void this.#post(request, response, principal).catch((error) => {
      this.#log.warn('MCP request failed', { error: String(error) });
      if (!response.headersSent) response.writeHead(500).end();
    });
    return principal;
  }

  async #post(request: IncomingMessage, response: ServerResponse, principal: ToolPrincipal): Promise<void> {
    const body = await readBody(request);
    if (body === null) {
      response.writeHead(413).end();
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(body);
    } catch {
      reply(response, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON parse error' } });
      return;
    }
    if (Array.isArray(message)) {
      reply(response, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch requests are not supported' } });
      return;
    }
    if (!isRequest(message)) {
      // Notifications and responses to server requests: just accept them.
      response.writeHead(202).end();
      return;
    }
    try {
      const result = await this.#dispatch(message, principal);
      reply(response, { jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      const failure = error instanceof JsonRpcFailure ? error : new JsonRpcFailure(-32603, 'Internal error');
      if (!(error instanceof JsonRpcFailure)) this.#log.error('MCP method failed', { method: message.method, error: String(error) });
      reply(response, { jsonrpc: '2.0', id: message.id, error: { code: failure.code, message: failure.message } });
    }
  }

  async #dispatch(message: JsonRpcRequest, principal: ToolPrincipal): Promise<unknown> {
    const params = message.params ?? {};
    switch (message.method) {
      case 'initialize': {
        const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
        const info = this.#options.serverInfo;
        return {
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'cuccut', title: 'CucCut', version: info?.version ?? RUNTIME_VERSION },
          ...(info?.meta ? { _meta: info.meta } : {}),
        };
      }
      case 'ping':
        return {};
      case 'tools/list':
        // MCP tool shape: a catalog entry's `effect`, `examples`, `surfaces` and `positional` are for the CLI and help, not for tools/list.
        return {
          tools: this.#tools.list().map(({ name, title, description, inputSchema, annotations }) => ({
            name,
            title,
            description,
            inputSchema,
            ...(annotations ? { annotations } : {}),
          })),
        };
      case 'tools/call': {
        if (typeof params.name !== 'string') throw new JsonRpcFailure(-32602, 'Missing tool name');
        const result = await this.#tools.call(params.name, params.arguments, principal);
        this.#options.onToolCall?.(params.name, principal, result);
        return result;
      }
      default:
        throw new JsonRpcFailure(-32601, `Unsupported method: ${message.method}`);
    }
  }
}

/** `Host` is a loopback address (optionally with a port). Requests without `Host` are not accepted. */
export function loopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const match = /^(\[::1\]|127\.0\.0\.1|localhost)(:\d{1,5})?$/i.exec(host.trim());
  return match !== null;
}

function isRequest(message: unknown): message is JsonRpcRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return typeof m.method === 'string' && (typeof m.id === 'string' || typeof m.id === 'number');
}

function reply(response: ServerResponse, payload: unknown): void {
  const text = JSON.stringify(payload);
  response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) }).end(text);
}

/** Reads the whole request body; returns null when it exceeds the limit. */
async function readBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

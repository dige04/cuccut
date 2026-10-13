import { createReadStream } from 'node:fs';
import type http from 'node:http';
import {
  NODE_ERROR,
  NODE_MIN_PROTOCOL_VERSION,
  NODE_PROTOCOL_HEADER,
  type NodeErrorBody,
  type NodeHealth,
  type NodeJobEvent,
  type NodePairResponse,
} from '@cuccut/protocol';
import { nodePairRequestSchema } from '@cuccut/protocol/schemas';
import { NodeHttpError, type NodeJobs } from './node-jobs.ts';
import { silentNodeLog, type NodeLogger } from './node-logger.ts';
import { sourceAllowed } from './source-gate.ts';
import { NodesServer as NS } from '@cuccut/protocol/messages/nodes';

/**
 * HTTP endpoints of the node service (node protocol spec §2–§7). Each request passes three gates in order; if one fails, the later ones are not checked:
 *
 * 1. Source gate: looks only at `socket.remoteAddress` (skipped when `allowAnySource`);
 * 2. Version gate: `X-CucCut-Node-Protocol`; `GET /v1/health` does not pass this gate;
 * 3. Token gate: `Authorization: Bearer <token>`; `GET /v1/health` and `POST /v1/pair` do not pass this gate.
 *
 * There are no management endpoints here: pairing codes, revocation and switches go only through the local gateway. Unknown paths return `404 INVALID_REQUEST`, and unsupported methods on known paths return
 * `405 INVALID_REQUEST` (the spec's error table has no dedicated code).
 */

export interface NodeApiDeps {
  jobs: NodeJobs;
  health(): Promise<NodeHealth>;
  /** Pairing: returns the token on success; throws `NodeHttpError` on failure. */
  pair(code: string, clientId: string, clientName: string): Promise<NodePairResponse>;
  /** Token → clientId; returns null if the token is invalid. */
  authenticate(token: string): string | null;
  allowAnySource(): boolean;
  log?: NodeLogger;
  /** Heartbeat interval for the event stream (default 15 seconds). */
  heartbeatMs?: number;
}

const JSON_LIMIT = 64 * 1024;
const JOB_PATH = /^\/v1\/jobs\/([A-Za-z0-9_-]{1,200})(\/input|\/events|\/result|\/cancel)?$/;

type Route =
  | { kind: 'health' }
  | { kind: 'pair' }
  | { kind: 'create' }
  | { kind: 'job'; jobId: string; action: 'get' | 'delete' | 'input' | 'events' | 'result' | 'cancel' }
  | { kind: 'method-not-allowed' }
  | { kind: 'unknown' };

export function createNodeRequestHandler(deps: NodeApiDeps): (request: http.IncomingMessage, response: http.ServerResponse) => void {
  const log = deps.log ?? silentNodeLog;
  const heartbeatMs = deps.heartbeatMs ?? 15_000;

  const handle = async (request: http.IncomingMessage, response: http.ServerResponse, url: URL): Promise<void> => {
    // 1. Source gate
    if (!sourceAllowed(request.socket.remoteAddress, deps.allowAnySource())) {
      throw new NodeHttpError(NODE_ERROR.SOURCE_NOT_ALLOWED, NS.sourceNotAllowed().text);
    }
    const route = routeOf(request.method ?? 'GET', url.pathname);
    // 2. Version gate
    if (route.kind !== 'health') {
      const raw = request.headers[NODE_PROTOCOL_HEADER.toLowerCase()];
      const version = typeof raw === 'string' && /^\d{1,9}$/.test(raw.trim()) ? Number(raw.trim()) : null;
      if (version === null || version < NODE_MIN_PROTOCOL_VERSION) {
        throw new NodeHttpError(NODE_ERROR.PROTOCOL_VERSION_UNSUPPORTED, NS.protocolTooOld().text, { required: NODE_MIN_PROTOCOL_VERSION });
      }
    }
    if (route.kind === 'health') return sendJson(response, 200, await deps.health());
    if (route.kind === 'pair') {
      const body = nodePairRequestSchema.safeParse(await readJson(request));
      if (!body.success) throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.pairRequestInvalid().text);
      return sendJson(response, 200, await deps.pair(body.data.code, body.data.clientId, body.data.clientName));
    }
    // 3. Token gate
    const auth = request.headers.authorization;
    const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
    const clientId = token ? deps.authenticate(token) : null;
    if (!clientId) throw new NodeHttpError(NODE_ERROR.UNAUTHORIZED, NS.tokenInvalid().text);

    switch (route.kind) {
      case 'unknown':
        return sendError(response, new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.noEndpoint().text), 404);
      case 'method-not-allowed':
        return sendError(response, new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.methodNotAllowed().text), 405);
      case 'create': {
        const { created, job } = await deps.jobs.create(clientId, await readJson(request));
        return sendJson(response, created ? 201 : 200, job);
      }
      case 'job':
        break;
    }
    const { jobId, action } = route;
    switch (action) {
      case 'get':
        return sendJson(response, 200, deps.jobs.get(clientId, jobId));
      case 'cancel':
        return sendJson(response, 200, await deps.jobs.cancel(clientId, jobId));
      case 'delete':
        await deps.jobs.remove(clientId, jobId);
        response.writeHead(204).end();
        return;
      case 'input': {
        const header = request.headers['content-length'];
        if (typeof header !== 'string' || !/^\d+$/.test(header) || request.headers['transfer-encoding']) {
          // The request body was not read: close the connection after responding.
          response.setHeader('Connection', 'close');
          throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.contentLengthRequired().text);
        }
        try {
          await deps.jobs.upload(clientId, jobId, Number(header), request);
        } catch (error) {
          if (!request.complete) response.setHeader('Connection', 'close');
          throw error;
        }
        response.writeHead(204).end();
        return;
      }
      case 'events':
        return streamEvents(request, response, deps.jobs, clientId, jobId, url, heartbeatMs);
      case 'result':
        return sendResult(request, response, deps.jobs.result(clientId, jobId));
    }
  };

  return (request, response) => {
    let url: URL;
    try {
      url = new URL(request.url ?? '/', 'http://node.invalid');
    } catch {
      sendError(response, new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.badUrl().text));
      return;
    }
    handle(request, response, url).catch((error: unknown) => {
      if (error instanceof NodeHttpError) {
        sendError(response, error);
        return;
      }
      if (request.destroyed || response.destroyed) return;
      log.error('Node request handling error', { path: url.pathname, error: String(error) });
      sendError(response, new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.requestFailed().text), 500);
    });
  };
}

function routeOf(method: string, pathname: string): Route {
  if (pathname === '/v1/health') return method === 'GET' ? { kind: 'health' } : { kind: 'method-not-allowed' };
  if (pathname === '/v1/pair') return method === 'POST' ? { kind: 'pair' } : { kind: 'method-not-allowed' };
  if (pathname === '/v1/jobs') return method === 'POST' ? { kind: 'create' } : { kind: 'method-not-allowed' };
  const match = JOB_PATH.exec(pathname);
  if (!match) return { kind: 'unknown' };
  const jobId = match[1]!;
  const sub = match[2];
  const allowed: Record<string, [string, Extract<Route, { kind: 'job' }>['action']][]> = {
    '': [
      ['GET', 'get'],
      ['DELETE', 'delete'],
    ],
    '/input': [['PUT', 'input']],
    '/events': [['GET', 'events']],
    '/result': [['GET', 'result']],
    '/cancel': [['POST', 'cancel']],
  };
  const found = allowed[sub ?? '']!.find(([m]) => m === method);
  return found ? { kind: 'job', jobId, action: found[1] } : { kind: 'method-not-allowed' };
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers['content-length'] ?? NaN);
  if (Number.isFinite(declared) && declared > JSON_LIMIT) {
    throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.bodyTooLarge().text);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > JSON_LIMIT) throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.bodyTooLarge().text);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.bodyNotJson().text);
  }
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
  });
  response.end(bytes);
}

function sendError(response: http.ServerResponse, error: NodeHttpError, status?: number): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const body: NodeErrorBody = {
    error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) },
  };
  const code = status ?? error.status;
  // If the request body has not been fully read, do not keep the connection open (e.g. when a request is rejected before upload).
  if (!response.req.complete) response.setHeader('Connection', 'close');
  if (error.code === NODE_ERROR.PAIRING_LOCKED && typeof error.details?.retryAfterMs === 'number') {
    response.setHeader('Retry-After', String(Math.ceil(error.details.retryAfterMs / 1000)));
  }
  sendJson(response, code, body);
}

function streamEvents(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  jobs: NodeJobs,
  clientId: string,
  jobId: string,
  url: URL,
  heartbeatMs: number,
): void {
  const raw = url.searchParams.get('since');
  if (raw !== null && !/^\d{1,15}$/.test(raw)) throw new NodeHttpError(NODE_ERROR.INVALID_REQUEST, NS.sinceInvalid().text);
  const since = raw === null ? 0 : Number(raw);
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let ended = false;
  const write = (event: NodeJobEvent) => {
    if (!ended) response.write(`${JSON.stringify(event)}\n`);
  };
  const end = () => {
    if (ended) return;
    ended = true;
    if (heartbeat) clearInterval(heartbeat);
    subscription.close();
    response.end();
  };
  const subscription = jobs.subscribe(clientId, jobId, since, (event) => (event ? write(event) : end()));
  response.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  response.flushHeaders();
  for (const event of subscription.backlog) write(event);
  if (subscription.done) return end();
  heartbeat = setInterval(() => write({ type: 'heartbeat' }), heartbeatMs);
  heartbeat.unref?.();
  request.on('close', end);
  response.on('close', end);
}

function sendResult(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  result: { file: string; sha256: string; byteLength: number },
): void {
  const size = result.byteLength;
  const headers = {
    'Content-Type': 'application/json',
    ETag: `"sha256:${result.sha256}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  const range = parseRange(request.headers.range, size);
  if (range === 'unsatisfiable') {
    response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end();
    return;
  }
  const start = range ? range.start : 0;
  const end = range ? range.end : size - 1;
  const length = size === 0 ? 0 : end - start + 1;
  response.writeHead(range ? 206 : 200, {
    ...headers,
    'Content-Length': length,
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
  });
  if (length === 0) {
    response.end();
    return;
  }
  const stream = createReadStream(result.file, { start, end });
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

/** A single `Range: bytes=a-b` (including `a-` and `-n`); multi-range or unrecognized forms are treated as no Range. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, from, to] = match;
  if (from === '' && to === '') return null;
  if (from === '') {
    const suffix = Number(to);
    if (suffix === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(from);
  if (start >= size) return 'unsatisfiable';
  const end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
  if (end < start) return 'unsatisfiable';
  return { start, end };
}

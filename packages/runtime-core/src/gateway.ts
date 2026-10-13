import crypto from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  PROTOCOL_VERSION,
  RpcError,
  newId,
  type ClientKind,
  type RpcMethod,
  type RuntimeInfo,
  type ServerFrame,
  type Topic,
} from '@cuccut/protocol';
import { RcGateway } from '@cuccut/protocol/messages/runtime-core';
import { helloFrameSchema, methodParamSchemas, requestFrameSchema } from '@cuccut/protocol/schemas';
import type { Logger } from '@cuccut/harness';
import type { RpcHandlers } from './handlers.ts';

/**
 * Identity of an authenticated connection (architecture design §4.2). Constructed by the Runtime; public requests cannot declare it themselves. `service` is constructed only by the external service (§4.8) for external requests that pass authentication. `web` is constructed only by the Web service for browser connections authenticated by session (the operator is the user themselves). The gateway's hello does not accept these two kinds, so external requests cannot impersonate UI connections.
 * `local` is constructed only by `catalog.call` for CLI and desktop connections making catalogue calls (`LocalPrincipal`, §3.5), inheriting the connection that made the call; writes count as the user's own.
 */
export interface TrustedPrincipal {
  connectionId: string;
  kind: ClientKind | 'service' | 'web' | 'local';
  name: string;
  /** `web`: the browser session ID (used to disconnect when the session is revoked). */
  sessionId?: string;
}

/** Identity given by outer authentication at upgrade time (the Web service's session cookie): when present, hello no longer compares tokens. */
export interface GatewayIdentity {
  kind: 'web';
  name: string;
  sessionId: string;
}

export interface GatewayOptions {
  token: string;
  runtime: RuntimeInfo;
  handlers: RpcHandlers;
  log: Logger;
  /** Extra allowed Origin (the dev server). No Origin, `null`, and `file://` are always allowed. */
  allowedOrigins?: readonly string[];
  /** HTTP requests on the same port (the media channel). Returns false if not recognized, which responds with a 404. */
  http?: (request: IncomingMessage, response: ServerResponse) => boolean;
  /** Authenticated connection closed (releases things it opened, such as videos). */
  onDisconnect?: (principal: TrustedPrincipal) => void;
  /** Handshake succeeded (the Web service counts connections per session). */
  onConnect?: (principal: TrustedPrincipal) => void;
  /** Every request after the handshake (including `subscribe`), before dispatch (the Runtime uses this to tell whether the connection is in use). */
  onRequest?: (principal: TrustedPrincipal, method: RpcMethod) => void;
  /**
   * Allowlist of methods and topics (Web service): checked synchronously before dispatch. `subscribe` also goes through here (by `params.topic`).
   * Returns an error to reject; it is returned to the caller unchanged.
   */
  authorize?: (method: RpcMethod, params: unknown, principal: TrustedPrincipal) => RpcError | null;
}

/** The gateway's origin rules; the media channel's CORS also uses them. */
export function originAllowed(origin: string | undefined, allowedOrigins: readonly string[] = []): boolean {
  if (origin === undefined || origin === 'null' || origin === 'file://') return true;
  return allowedOrigins.includes(origin);
}

const HELLO_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 30_000;
/** If the send buffer exceeds this amount, disconnect, so the client reconnects and resumes by sequence number or fetches a snapshot, instead of piling up in memory without limit. */
const MAX_BUFFERED_BYTES = 16 * 1024 * 1024;
const MAX_FRAME_BYTES = 4 * 1024 * 1024;

/**
 * Local gateway (architecture design §4). Listens only on the loopback address. On the same port, WebSocket carries the protocol, and the first frame must be a hello with a token.
 * Plain HTTP serves only the media channel (§4.5).
 */
export class Gateway {
  readonly #options: GatewayOptions;
  readonly #log: Logger;
  readonly #connections = new Set<Connection>();
  #server: WebSocketServer | null = null;
  #http: Server | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #closed = false;

  constructor(options: GatewayOptions) {
    this.#options = options;
    this.#log = options.log.child('gateway');
  }

  async listen(host = '127.0.0.1', port = 0): Promise<string> {
    const http = createServer((request, response) => {
      if (!this.#options.http?.(request, response)) response.writeHead(404).end();
    });
    // Listen first, then attach the WebSocketServer: it forwards the http server's error to itself. If listening fails (port in use), nothing is there to handle the error, the process gets an unhandled error, and this Promise never settles. On failure, the error is thrown as is, and no handles are left behind.
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(port, host, () => {
        http.off('error', reject);
        resolve();
      });
    });
    this.#http = http;
    this.#start(new WebSocketServer({ server: http, maxPayload: MAX_FRAME_BYTES }));
    const address = http.address() as AddressInfo;
    const endpoint = `ws://${host}:${address.port}`;
    this.#log.info('Gateway listening', { endpoint });
    return endpoint;
  }

  /**
   * WebSocket upgrade on another HTTP server (Web service): the caller has already checked origin and authentication, and `identity` is the identity obtained from authentication.
   * This gateway does not listen on its own.
   */
  upgrade(request: IncomingMessage, socket: Duplex, head: Buffer, identity: GatewayIdentity): void {
    if (this.#closed) {
      socket.destroy();
      return;
    }
    const server = this.#server ?? this.#start(new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES }));
    server.handleUpgrade(request, socket, head, (ws) => this.#accept(ws, request, identity));
  }

  /** Disconnects the matching authenticated connections (revokes browser sessions). */
  disconnectWhere(predicate: (principal: TrustedPrincipal) => boolean, reason: string): number {
    let count = 0;
    for (const connection of this.#connections) {
      const principal = connection.principal;
      if (principal && predicate(principal)) {
        connection.close(1008, reason);
        count++;
      }
    }
    return count;
  }

  #start(server: WebSocketServer): WebSocketServer {
    this.#server = server;
    server.on('error', (error) => this.#log.error('Gateway error', { error: String(error) }));
    server.on('connection', (socket, request) => this.#accept(socket, request));
    this.#heartbeat = setInterval(() => {
      for (const connection of this.#connections) connection.heartbeat();
    }, HEARTBEAT_MS);
    return server;
  }

  async close(): Promise<void> {
    this.#closed = true;
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    for (const connection of this.#connections) connection.close(1001, 'runtime stopping');
    const server = this.#server;
    this.#server = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    const http = this.#http;
    this.#http = null;
    if (http) {
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  }

  #accept(socket: WebSocket, request: IncomingMessage, identity?: GatewayIdentity): void {
    const origin = request.headers.origin;
    // An upgrade already authenticated by the outer layer (Web service) was checked by that layer against its own origin rules.
    if (!identity && !this.#originAllowed(origin)) {
      this.#log.warn('Refused origin', { origin });
      socket.close(1008, 'origin not allowed');
      return;
    }
    const connection = new Connection(socket, this.#options, this.#log, identity ?? null);
    this.#connections.add(connection);
    socket.once('close', () => {
      this.#connections.delete(connection);
      connection.dispose();
    });
  }

  #originAllowed(origin: string | undefined): boolean {
    return originAllowed(origin, this.#options.allowedOrigins);
  }
}

class Connection {
  readonly #socket: WebSocket;
  readonly #options: GatewayOptions;
  readonly #log: Logger;
  readonly #subscriptions = new Map<Topic, () => void>();
  readonly #helloTimer: ReturnType<typeof setTimeout>;
  readonly #identity: GatewayIdentity | null;
  #principal: TrustedPrincipal | null = null;
  #alive = true;

  constructor(socket: WebSocket, options: GatewayOptions, log: Logger, identity: GatewayIdentity | null) {
    this.#socket = socket;
    this.#options = options;
    this.#log = log;
    this.#identity = identity;
    this.#helloTimer = setTimeout(() => this.#fatal(new RpcError('unauthenticated', RcGateway.helloTimeout())), HELLO_TIMEOUT_MS);
    socket.on('pong', () => {
      this.#alive = true;
    });
    socket.on('message', (data, isBinary) => {
      if (isBinary) return this.#fatal(new RpcError('invalid-request', RcGateway.textFramesOnly()));
      this.#onMessage(data.toString());
    });
  }

  get principal(): TrustedPrincipal | null {
    return this.#principal;
  }

  heartbeat(): void {
    if (!this.#alive) {
      this.#socket.terminate();
      return;
    }
    this.#alive = false;
    this.#socket.ping();
  }

  close(code: number, reason: string): void {
    this.#socket.close(code, reason);
  }

  dispose(): void {
    clearTimeout(this.#helloTimer);
    for (const unsubscribe of this.#subscriptions.values()) unsubscribe();
    this.#subscriptions.clear();
    if (this.#principal) {
      this.#log.info('Connection closed', { connectionId: this.#principal.connectionId });
      this.#options.onDisconnect?.(this.#principal);
    }
  }

  #onMessage(text: string): void {
    let frame: unknown;
    try {
      frame = JSON.parse(text);
    } catch {
      return this.#fatal(new RpcError('invalid-request', RcGateway.frameNotJson()));
    }
    if (!this.#principal) return this.#hello(frame);

    const parsed = requestFrameSchema.safeParse(frame);
    if (!parsed.success) return this.#fatal(new RpcError('invalid-request', RcGateway.frameUnrecognized()));
    const { id, method, params } = parsed.data;
    if (!Object.hasOwn(methodParamSchemas, method)) {
      return this.#respondError(id, new RpcError('unknown-method', RcGateway.unknownMethod({ method })));
    }
    const schema = methodParamSchemas[method as RpcMethod];
    const checked = schema.safeParse(params ?? {});
    if (!checked.success) {
      return this.#respondError(id, new RpcError('invalid-request', RcGateway.invalidParams(), checked.error.issues));
    }
    this.#dispatch(id, method as RpcMethod, checked.data);
  }

  #hello(frame: unknown): void {
    const parsed = helloFrameSchema.safeParse(frame);
    if (!parsed.success) return this.#fatal(new RpcError('unauthenticated', RcGateway.helloRequired()));
    const hello = parsed.data;
    // A connection already authenticated at upgrade time (browser session) is not checked against a token: the page gets no token, and the identity comes from the session.
    if (!this.#identity && !tokenMatches(hello.token, this.#options.token)) {
      return this.#fatal(new RpcError('unauthenticated', RcGateway.invalidToken()));
    }
    if (hello.protocolVersion !== PROTOCOL_VERSION) {
      return this.#fatal(
        new RpcError('protocol-mismatch', RcGateway.protocolMismatch({ client: hello.protocolVersion, runtime: PROTOCOL_VERSION }), {
          runtime: PROTOCOL_VERSION,
        }),
      );
    }
    clearTimeout(this.#helloTimer);
    const identity = this.#identity;
    this.#principal = identity
      ? { connectionId: newId('conn'), kind: identity.kind, name: identity.name, sessionId: identity.sessionId }
      : { connectionId: newId('conn'), kind: hello.client.kind, name: hello.client.name };
    this.#log.info('Connection ready', { ...this.#principal, version: hello.client.version });
    this.#options.onConnect?.(this.#principal);
    this.#send({ type: 'welcome', runtime: this.#options.runtime, connectionId: this.#principal.connectionId });
  }

  #dispatch(id: string, method: RpcMethod, params: unknown): void {
    const denied = this.#options.authorize?.(method, params, this.#principal!);
    if (denied) return this.#respondError(id, denied);
    this.#options.onRequest?.(this.#principal!, method);
    // Subscription must complete synchronously: register the listener, compute the snapshot or replay, and write the response in the same block, so that later events are guaranteed to come after the response.
    if (method === 'subscribe') {
      try {
        const { topic, afterSeq } = params as { topic: Topic; afterSeq?: string };
        this.#subscriptions.get(topic)?.();
        const subscription = this.#options.handlers.subscribe(topic, afterSeq, (event) => {
          this.#send({ type: 'event', topic, seq: event.seq, event: event.event });
        });
        this.#subscriptions.set(topic, subscription.unsubscribe);
        this.#send({ type: 'response', id, ok: true, result: subscription.result });
      } catch (error) {
        this.#respondError(id, error);
      }
      return;
    }
    if (method === 'unsubscribe') {
      const { topic } = params as { topic: Topic };
      this.#subscriptions.get(topic)?.();
      this.#subscriptions.delete(topic);
      this.#send({ type: 'response', id, ok: true, result: { ok: true } });
      return;
    }

    const handler = this.#options.handlers.methods[method] as (params: unknown, principal: TrustedPrincipal) => unknown;
    Promise.resolve()
      .then(() => handler(params, this.#principal!))
      .then(
        (result) => this.#send({ type: 'response', id, ok: true, result }),
        (error) => this.#respondError(id, error),
      );
  }

  #respondError(id: string, error: unknown): void {
    const rpc = error instanceof RpcError ? error : new RpcError('internal', RcGateway.internalError());
    if (!(error instanceof RpcError)) this.#log.error('Request handling failed', { error: String(error) });
    this.#send({ type: 'response', id, ok: false, error: rpc.toPayload() });
  }

  #fatal(error: RpcError): void {
    this.#log.warn('Connection refused', { code: error.code, message: error.message });
    this.#send({ type: 'fatal', error: error.toPayload() });
    this.#socket.close(1008, error.code);
  }

  #send(frame: ServerFrame): void {
    if (this.#socket.readyState !== this.#socket.OPEN) return;
    if (this.#socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.#log.warn('Client reading too slowly; disconnecting', { connectionId: this.#principal?.connectionId });
      this.#socket.terminate();
      return;
    }
    this.#socket.send(JSON.stringify(frame));
  }
}

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

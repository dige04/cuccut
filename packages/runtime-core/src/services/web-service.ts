import crypto from 'node:crypto';
import fs from 'node:fs';
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import {
  RpcError,
  WEB_DEFAULT_METHODS,
  methodMatches,
  nowIso,
  type RpcMethod,
  type RuntimeInfo,
  type ServiceConfigureParams,
  type ServiceRequestRecord,
  type WebAccessLink,
  type WebServiceAccess,
  type WebSession,
} from '@cuccut/protocol';
import { RcWeb } from '@cuccut/protocol/messages/runtime-core';
import type { Harness, Logger } from '@cuccut/harness';
import type { SlidesServer } from '@cuccut/slides';
import { Gateway, type TrustedPrincipal } from '../gateway.ts';
import type { RpcHandlers } from '../handlers.ts';
import { MediaRegistry } from '../media.ts';
import type { VideoService } from '../videos/video-service.ts';
import type { ServiceConfigStore } from './service-config-store.ts';
import { listenError } from './service-clients.ts';
import type { ManagedService, ServiceReport } from './service-manager.ts';
import { webAuthorize, webHandlers } from './web-handlers.ts';
import { WebSessions, type WebSessionsOptions } from './web-sessions.ts';
import { resolveWebDist, sendLoginPage, sendLoginScript, sendStatic, setSecurityHeaders } from './web-static.ts';

/**
 * Web service (architecture design §4.8, §12.8): the client in a local browser. One loopback port serves three things:
 *
 * - Static files of the web client (build output; without a build, the service enters `error`, which does not affect the Runtime);
 * - The gateway entry `/ws`: the same protocol and handlers as the desktop UI, but the connection is authenticated by session cookie at upgrade time, and methods and topics are filtered by the allowlist.
 *   The body is `{ kind: 'web', sessionId }`, and the writing operator is the user themselves (`user_local`).
 * - Media channel `/media/…`: this service's own handle table (same-origin relative addresses). Fetching content still requires the session cookie. The desktop gateway's port and token are not exposed.
 * - Slide editor `/slides/<grant>/…` and assets `/_blob/<id>` (docs/design/slides §6.2): they share one SlidesServer with the gateway and require the session cookie.
 *   Under read-only configuration, publishing and uploading are rejected (`not_writer`). They can only be embedded in this service's own pages (`frame-ancestors 'self'`).
 * - Design draft editor `/design/<grant>/…` (docs/design/canvas §6.2) and design system editor `/design-system/<grant>/…` (§10.4): the web client puts them on another loopback hostname, where there is no session cookie, so they accept only the grant. The allowlist must include `design.open` / `designSystem.open`. Under read-only configuration, publishing and uploading are rejected.
 *   A `/_blob/<id>` without a session is looked up only in the kinds allowed by the allowlist (design drafts and design systems).
 *
 * Login: `createAccessLink` issues a one-time code, placed in the link's fragment (or pasted by the user into the login page's input box). The login page's script uses it to `POST /_auth/session` and exchange it for an HttpOnly, SameSite=Strict session cookie. A cookie was chosen over an in-page memory token: `<video>` and `<img>` cannot carry request headers.
 * Only a cookie lets media requests and WebSockets authenticate with the same session and fail together on revocation, and the token does not go into URLs. HttpOnly keeps page scripts from reading it.
 * Cookies on loopback addresses are not isolated by port (other local services on other ports also receive them), so the name includes the port. WebSocket and login additionally require the Origin to be its own.
 *
 * Origin checks: `Host` must be `127.0.0.1:<port>` or `localhost:<port>` (DNS rebinding). Requests with `Origin` accept only these two origins,
 * and WebSocket and login must send it. When the browser provides `Sec-Fetch-Site`, requests that need a session accept only `same-origin` and `none`.
 */

const HOST = '127.0.0.1';
const RECENT_LIMIT = 20;
const MAX_AUTH_BODY = 1024;

export interface WebServiceDeps {
  store: ServiceConfigStore;
  harness: Harness;
  videos: VideoService;
  log: Logger;
  /** The session or the recent requests changed: sends one `service.updated`. */
  onChange: () => void;
  /** The build-output directory. When not given, it is found via `resolveWebDist()`. null means none (the service enters `error` when started). */
  dist?: string | null;
  sessions?: WebSessionsOptions;
}

export class WebService implements ManagedService {
  readonly id = 'web' as const;
  get label(): string {
    return RcWeb.serviceLabel().text;
  }
  readonly available = true;
  /** The media handle used by the browser: a same-origin relative address, fetchable only on this service's port and with a session. */
  readonly media: MediaRegistry;
  readonly #deps: WebServiceDeps;
  readonly #log: Logger;
  readonly #sessions: WebSessions;
  readonly #uploads = new Map<string, { sessionId: string; url: string; expires: number }>();
  #binding: { handlers: RpcHandlers; runtime: RuntimeInfo } | null = null;
  #slides: SlidesServer | null = null;
  #server: Server | null = null;
  #gateway: Gateway | null = null;
  #port: number | null = null;
  #dist: string | null = null;
  #recent: ServiceRequestRecord[] = [];

  constructor(deps: WebServiceDeps) {
    this.#deps = deps;
    this.#log = deps.log.child('web-service');
    this.#sessions = new WebSessions(deps.sessions);
    this.media = new MediaRegistry({ log: deps.log, originAllowed: (origin) => origin !== undefined && this.#origins().includes(origin) });
  }

  /** Handed to the gateway's handler after the Runtime assembles the gateway (built with this service's media handle table). The service cannot be started before this. */
  bind(binding: { handlers: RpcHandlers; runtime: RuntimeInfo; slides?: SlidesServer }): void {
    this.#slides = binding.slides ?? null;
    this.#binding = {
      runtime: binding.runtime,
      handlers: webHandlers(binding.handlers, {
        harness: this.#deps.harness,
        videos: this.#deps.videos,
        record: (method, principal, videoId, outcome) => this.#audit(method, principal, videoId, outcome),
        access: () => this.#access(),
        uploadUrl: (sessionId, url) => {
          for (const [key, item] of this.#uploads) if (item.expires < Date.now()) this.#uploads.delete(key);
          const key = crypto.randomBytes(32).toString('base64url');
          this.#uploads.set(key, { sessionId, url, expires: Date.now() + 10 * 60_000 });
          return `/attachments/${key}`;
        },
      }),
    };
  }

  async start(): Promise<void> {
    if (this.#server) return;
    if (!this.#binding) throw new Error(RcWeb.runtimeNotReady().text);
    const dist = this.#deps.dist !== undefined ? this.#deps.dist : resolveWebDist();
    if (!dist || !fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error(RcWeb.clientNotBuilt().text);
    }
    const port = this.#deps.store.get('web').port;
    const gateway = new Gateway({
      // The browser connection was authenticated at upgrade time. This token is never issued; it only ensures that a connection without a session fails hello in any case.
      token: crypto.randomBytes(32).toString('base64url'),
      runtime: this.#binding.runtime,
      handlers: this.#binding.handlers,
      log: this.#deps.log,
      authorize: (method, params, principal) => this.#authorize(method, params, principal),
      onConnect: (principal) => {
        if (principal.sessionId) this.#sessions.connected(principal.sessionId, 1);
      },
      onDisconnect: (principal) => {
        if (principal.sessionId) this.#sessions.connected(principal.sessionId, -1);
        this.#deps.videos.connectionClosed(principal.connectionId);
      },
    });
    const server = createServer((request, response) => this.#request(request, response));
    server.on('upgrade', (request, socket, head) => this.#upgrade(request, socket, head));
    await new Promise<void>((resolve, reject) => {
      server.once('error', (error: NodeJS.ErrnoException) => {
        reject(listenError(port, error));
      });
      server.listen(port, HOST, () => resolve());
    });
    server.on('error', (error) => this.#log.warn('Web service error', { error: String(error) }));
    this.#server = server;
    this.#gateway = gateway;
    this.#dist = dist;
    this.#port = (server.address() as AddressInfo).port;
    this.#log.info('Web service listening', { port: this.#port });
  }

  async stop(): Promise<void> {
    const server = this.#server;
    const gateway = this.#gateway;
    this.#server = null;
    this.#gateway = null;
    this.#port = null;
    // Sessions and codes are invalidated with the service (§12.8: the token is regenerated on each service start).
    this.#sessions.clear();
    await gateway?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  status(): ServiceReport {
    const config = this.#deps.store.get('web');
    const port = this.#port ?? config.port;
    return {
      autostart: config.autostart,
      port,
      endpoint: this.#server ? `http://${HOST}:${port}/` : null,
      policy: null,
      clients: this.#sessions
        .list()
        .map((s) => ({ clientId: s.sessionId, name: RcWeb.browserSession().text, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt })),
      recentRequests: this.#recent.map((r) => ({ ...r })),
      web: this.#access(),
    };
  }

  async applyConfig(params: ServiceConfigureParams): Promise<boolean> {
    if (params.level !== undefined || params.videos !== undefined) {
      throw new RpcError('invalid-request', RcWeb.noLevelOrScope());
    }
    if (params.methods) {
      const wider = params.methods.filter((p) => !withinDefault(p));
      if (wider.length > 0) {
        throw new RpcError('invalid-request', RcWeb.allowlistTooWide({ methods: wider.join(RcWeb.listSeparator().text) }), {
          methods: wider,
        });
      }
    }
    const before = this.#deps.store.get('web');
    const access = this.#access();
    const next: WebServiceAccess = {
      readOnly: params.readOnly ?? access.readOnly,
      methods: params.methods === undefined ? access.methods : params.methods === null ? null : [...new Set(params.methods)],
    };
    await this.#deps.store.update('web', {
      ...(params.autostart !== undefined ? { autostart: params.autostart } : {}),
      ...(params.port !== undefined ? { port: params.port } : {}),
      web: next,
    });
    // The capability set changed: existing browser connections are dropped so they re-subscribe under the new allowlist, since subscribed topics may no longer be allowed.
    if (JSON.stringify(next) !== JSON.stringify(access)) this.#gateway?.disconnectWhere(() => true, 'access changed');
    return params.port !== undefined && params.port !== before.port;
  }

  // ---- Access links and sessions ----

  /** `href` is the link's path and query (the result of `webVideoHref`, starting with `/`). When not given, it is the root path. The code is only in the fragment. */
  createAccessLink(href = '/'): WebAccessLink {
    if (!this.#server || this.#port === null) {
      throw new RpcError('conflict', RcWeb.notRunning(), {
        code: 'SERVICE_NOT_RUNNING',
        serviceId: 'web',
      });
    }
    if (!href.startsWith('/') || href.includes('#')) throw new RpcError('invalid-request', RcWeb.invalidAccessPath());
    const { code, expiresAt } = this.#sessions.issueCode();
    this.#log.info('Issued access link', { expiresAt });
    return { url: `http://${HOST}:${this.#port}${href}#code=${code}`, expiresAt };
  }

  listSessions(): WebSession[] {
    return this.#sessions.list();
  }

  revokeSession(sessionId: string): WebSession[] {
    if (!this.#sessions.revoke(sessionId)) throw new RpcError('not-found', RcWeb.sessionNotFound());
    this.#gateway?.disconnectWhere((p) => p.sessionId === sessionId, 'session revoked');
    this.#log.info('Revoked browser session', { sessionId });
    this.#deps.onChange();
    return this.listSessions();
  }

  // ---- Requests ----

  #access(): WebServiceAccess {
    return this.#deps.store.get('web').web ?? { readOnly: false, methods: null };
  }

  #origins(): string[] {
    return this.#port === null ? [] : [`http://127.0.0.1:${this.#port}`, `http://localhost:${this.#port}`];
  }

  #hostAllowed(host: string | undefined): boolean {
    return this.#port !== null && (host === `127.0.0.1:${this.#port}` || host === `localhost:${this.#port}`);
  }

  /** The session carried by the request (cookie). Null when absent or invalid. */
  #session(request: IncomingMessage): string | null {
    const token = readCookie(request.headers.cookie, cookieName(this.#port));
    return token ? this.#sessions.verify(token) : null;
  }

  #authorize(method: RpcMethod, params: unknown, principal: TrustedPrincipal): RpcError | null {
    if (!principal.sessionId || !this.#sessions.alive(principal.sessionId)) {
      // Answer this request first (saying the session has expired), then disconnect.
      setImmediate(() => this.#gateway?.disconnectWhere((p) => p.connectionId === principal.connectionId, 'session expired'));
      return new RpcError('unauthenticated', RcWeb.sessionExpired());
    }
    return webAuthorize(method, params, this.#access());
  }

  #upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    socket.on('error', () => socket.destroy());
    const refuse = (status: number, text: string) => {
      socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    };
    const gateway = this.#gateway;
    if (!gateway) return refuse(503, 'Service Unavailable');
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname !== '/ws') return refuse(404, 'Not Found');
    // WebSocket is not restricted by the same-origin policy: the origin must be present and must be its own.
    const origin = request.headers.origin;
    if (!this.#hostAllowed(request.headers.host) || origin === undefined || !this.#origins().includes(origin)) {
      this.#log.warn('Refused WebSocket origin', { origin });
      return refuse(403, 'Forbidden');
    }
    const sessionId = this.#session(request);
    if (!sessionId) return refuse(401, 'Unauthorized');
    gateway.upgrade(request, socket, head, { kind: 'web', name: 'web', sessionId });
  }

  #request(request: IncomingMessage, response: ServerResponse): void {
    setSecurityHeaders(response);
    const deny = (status: number, text: string) => response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text);
    if (!this.#hostAllowed(request.headers.host)) return void deny(403, RcWeb.loopbackOnly().text);
    const origin = request.headers.origin;
    if (origin !== undefined && !this.#origins().includes(origin)) return void deny(403, RcWeb.originRejected().text);
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');

    if (pathname === '/_auth/session') return void this.#login(request, response).catch(() => deny(500, RcWeb.loginFailed().text));
    if (pathname.startsWith('/attachments/')) {
      const session = this.#session(request),
        item = this.#uploads.get(pathname.slice('/attachments/'.length));
      if (
        !origin ||
        !session ||
        !item ||
        item.sessionId !== session ||
        item.expires < Date.now() ||
        webAuthorize('attachments.prepare', {}, this.#access())
      )
        return void deny(403, RcWeb.originRejected().text);
      if (request.method !== 'PUT') return void deny(405, 'Method Not Allowed');
      this.#uploads.delete(pathname.slice('/attachments/'.length));
      const target = new URL(item.url);
      if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname))
        return void deny(403, RcWeb.originRejected().text);
      const upstream = httpRequest(
        target,
        {
          method: 'PUT',
          headers: {
            'Content-Type': request.headers['content-type'] ?? 'application/octet-stream',
            ...(request.headers['content-length'] ? { 'Content-Length': request.headers['content-length'] } : {}),
          },
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, { 'Cache-Control': 'no-store' });
          result.on('error', () => response.destroy());
          result.pipe(response);
        },
      );
      upstream.on('error', () => {
        if (!response.headersSent) deny(502, RcWeb.readFailed().text);
        else response.destroy();
      });
      request.on('aborted', () => upstream.destroy());
      request.pipe(upstream);
      return;
    }
    if (pathname.startsWith('/design/')) return this.#designRequest(request, response, 'design');
    if (pathname.startsWith('/design-system/')) return this.#designRequest(request, response, 'design-system');
    if (pathname.startsWith('/slides/') || pathname.startsWith('/_blob/')) return this.#slidesRequest(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return void response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    }
    if (pathname === '/_auth/login.js') return sendLoginScript(request, response);

    // Content that needs a session is not served to requests initiated by other sites (including other local ports).
    const site = request.headers['sec-fetch-site'];
    const sameOrigin = site === undefined || site === 'same-origin' || site === 'none';
    const session = sameOrigin ? this.#session(request) : null;
    // In-UI links (`/home?video=…`-style, without an extension) are treated like the root path. Not logged in gives the login page, and logged in gives the client page, which maps the path and query to the UI.
    const page = pathname === '/' || pathname === '/index.html' || isAppRoute(pathname);
    if (page) {
      if (!session) return sendLoginPage(request, response);
    } else if (!session) {
      return void deny(sameOrigin ? 401 : 403, RcWeb.loginRequired().text);
    }
    if (pathname.startsWith('/media/')) {
      if (!this.media.handle(request, response)) deny(404, RcWeb.fileNotFound().text);
      return;
    }
    void sendStatic(this.#dist!, page ? '/' : pathname, this.#port!, request, response).catch(() => {
      if (!response.headersSent) deny(500, RcWeb.readFailed().text);
      else response.destroy();
    });
  }

  /**
   * Routes for the slide editor: they require a session (the cookie carried by same-origin requests), and `slides.open` must be in the allowlist. Publishing and uploading are rejected under read-only configuration.
   * This group of routes sets its own CSP and allows embedding only from this service's own pages, replacing the `X-Frame-Options: DENY` carried by every response.
   */
  #slidesRequest(request: IncomingMessage, response: ServerResponse): void {
    const deny = (status: number, text: string) => response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text);
    const site = request.headers['sec-fetch-site'];
    const sameOrigin = site === undefined || site === 'same-origin' || site === 'none';
    const session = sameOrigin ? this.#session(request) : null;
    // A root-level asset request without a session comes from a design draft or design system editor on another hostname (docs/design/canvas §6.2, §10.4). It is looked up only in those two.
    if (sameOrigin && !session && request.url?.startsWith('/_blob/')) return this.#designRequest(request, response, null);
    if (!sameOrigin || !session) return void deny(sameOrigin ? 401 : 403, RcWeb.loginRequired().text);
    const access = this.#access();
    const verdict = webAuthorize('slides.open', {}, access);
    if (verdict || !this.#slides) return void deny(403, verdict?.message ?? RcWeb.fileNotFound().text);
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Content-Security-Policy');
    if (!this.#slides.handle(request, response, { canEdit: !access.readOnly, frameAncestors: "'self'" })) deny(404, RcWeb.fileNotFound().text);
  }

  /**
   * Routes for the design draft and design system editors (docs/design/canvas §6.2, §10.4). The web client rewrites the relative addresses given by `design.open` / `designSystem.open`
   * to another loopback hostname of this service, where there is no session cookie (the canvas and preview scripts cannot authenticate even when connecting to `/ws`). So these routes accept only the grant and do not require a session.
   * The corresponding method must be in the allowlist. Requests must be same-origin. Only the one navigation loaded into an iframe or new window may come from another hostname (then `Sec-Fetch-Site` is
   * cross-site). Write requests additionally require `Origin` and `Host` to match (checked by SlidesServer). `kind` null means root-level `/_blob/<id>`: it is looked up only in the design drafts and design systems that are allowed.
   * Embedding allows only the service's two loopback origins. The design system editor also embeds the same-origin `artifact-type/run.html`, so both layers must be in the list.
   */
  #designRequest(request: IncomingMessage, response: ServerResponse, kind: 'design' | 'design-system' | null): void {
    const deny = (status: number, text: string) => response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text);
    const site = request.headers['sec-fetch-site'];
    const sameOrigin = site === undefined || site === 'same-origin' || site === 'none';
    const dest = request.headers['sec-fetch-dest'];
    const navigation =
      request.headers['sec-fetch-mode'] === 'navigate' && (dest === 'iframe' || dest === 'frame' || dest === 'document') && (request.method ?? 'GET') === 'GET';
    if (!sameOrigin && !(navigation && kind !== null && request.url?.startsWith(`/${kind}/`))) return void deny(403, RcWeb.originRejected().text);
    const access = this.#access();
    const designVerdict = kind === 'design-system' ? null : webAuthorize('design.open', {}, access);
    const systemVerdict = kind === 'design' ? null : webAuthorize('designSystem.open', {}, access);
    // Root-level assets: rejected only when both kinds reject. Otherwise, looked up only in the allowed kinds.
    const verdict = kind === 'design' ? designVerdict : kind === 'design-system' ? systemVerdict : designVerdict && systemVerdict;
    if (verdict || !this.#slides) return void deny(403, verdict?.message ?? RcWeb.fileNotFound().text);
    const blobScope = kind ?? (designVerdict ? 'design-system' : systemVerdict ? 'design' : 'isolated');
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Content-Security-Policy');
    const handled = this.#slides.handle(request, response, {
      canEdit: !access.readOnly,
      frameAncestors: this.#origins().join(' '),
      blobScope,
    });
    if (!handled) deny(404, RcWeb.fileNotFound().text);
  }

  /** `POST /_auth/session { code }`: exchanges the code for a session cookie. The origin must be present and must be its own. */
  async #login(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return void response.writeHead(405, { Allow: 'POST' }).end();
    const origin = request.headers.origin;
    if (origin === undefined || !this.#origins().includes(origin)) return void response.writeHead(403).end();
    if (!(request.headers['content-type'] ?? '').startsWith('application/json')) return void response.writeHead(415).end();
    const body = await readBody(request, MAX_AUTH_BODY);
    let code: unknown;
    try {
      code = body === null ? undefined : (JSON.parse(body) as { code?: unknown }).code;
    } catch {
      code = undefined;
    }
    const issued = typeof code === 'string' ? this.#sessions.exchange(code, request.headers['user-agent']) : null;
    if (!issued) {
      this.#log.info('Access code exchange failed');
      response.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'ACCESS_CODE_INVALID' }));
      return;
    }
    this.#log.info('Browser session established', { sessionId: issued.sessionId });
    this.#deps.onChange();
    response
      .writeHead(204, {
        'Set-Cookie': `${cookieName(this.#port)}=${issued.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${issued.maxAgeSec}`,
      })
      .end();
  }

  #audit(method: RpcMethod, principal: TrustedPrincipal, videoId: string | null, outcome: string): void {
    const record: ServiceRequestRecord = {
      at: nowIso(),
      clientId: principal.sessionId ?? principal.connectionId,
      clientName: RcWeb.browserSession().text,
      tool: method,
      videoId,
      outcome,
    };
    this.#recent = [record, ...this.#recent].slice(0, RECENT_LIMIT);
    this.#log.info('External request', { serviceId: 'web', clientId: record.clientId, tool: method, videoId, outcome });
    this.#deps.onChange();
  }
}

/**
 * The client's in-UI links (`/home`, `/c/<session>`, `/space/<category>`-style, from `hrefFor` in `packages/ui`): the last segment has no extension,
 * and they are not under the media, login or build-output paths. They have no corresponding file, so they are always served the client page (`index.html`).
 */
function isAppRoute(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || ['media', '_auth', 'assets', 'ws'].includes(parts[0]!)) return false;
  return parts.every((part) => !part.startsWith('.')) && !parts[parts.length - 1]!.includes('.');
}

/** The cookie name includes the port. Cookies on loopback addresses are not isolated by port, so sessions on different ports (different Runtime Homes) do not overwrite each other. */
function cookieName(port: number | null): string {
  return `cuccut_web_${port ?? 0}`;
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Whether a configured allowlist entry is within the default set: a method name must be covered by the default set, and `x.*` must fall within some `y.*` of the default set. */
function withinDefault(pattern: string): boolean {
  if (!pattern.endsWith('.*')) return WEB_DEFAULT_METHODS.some((p) => methodMatches(p, pattern));
  return WEB_DEFAULT_METHODS.some((p) => p.endsWith('.*') && pattern.startsWith(p.slice(0, -1)));
}

function readBody(request: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        resolve(null);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

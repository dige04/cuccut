/**
 * HTTP routes for the slides, design canvas and design system editors (docs/design/slides §6.2, docs/design/canvas §6.2, §10.4). The Runtime gateway and the web service each mount one, sharing the same SlidesServer, so the same deck has only one DeckStore (publishes are serialized) and one directory watcher.
 *
 * The editor is distinguished by kind (`EditorKind`): the routes under `/slides/<grant>/`, `/design/<grant>/` and `/design-system/<grant>/` correspond one to one. Only the editor build output, file layout, CSP and the message shown when not built differ. There is one grant table; a grant is only valid for the kind that issued it.
 *
 *   /slides/<grant>/                       editor page (build output of apps/slides-editor, without node/)
 *   /slides/<grant>/_files.json            manifest
 *   /slides/<grant>/project/<path>          deck files
 *   /slides/<grant>/__deck/publish         POST publish
 *   /slides/<grant>/__deck/assets          POST upload assets
 *   /slides/<grant>/__deck/events          SSE: external changes
 *   /slides/<grant>/__deck/session         whether this open session can edit
 *   /slides/<grant>/_blob/<id>, /_blob/<id> assets; root-level ones are looked up in all open directories (the id is a content hash), narrowed by `blobScope`
 *   /design/<grant>/…                      same as above, design canvas editor (build output of apps/design-editor)
 *   /design-system/<grant>/…               same as above, design system editor (build output of apps/design-system-editor);
 *                                          also `artifact-type/run.html` (component preview iframe, same origin); the session separately gives the local user name
 *
 * The grant is an unguessable credential, kept only in memory; after a Runtime restart the UI reopens it.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { contentTypeOf, DeckStore, watchExternalEdits, type DeckLayout } from './deck-store.ts';
import { DECK_ROUTES, type DeckChangeEvent, type GenericPublishError, type WireEntry } from './file-protocol.ts';

/** Permissions and response headers for this request (the gateway and the web service differ). */
export interface DeckRouteOptions {
  /** Whether publishing and uploading are allowed; false in the web service's read-only mode. */
  canEdit: boolean;
  /** Source list for the CSP frame-ancestors; not restricted when not given (gateway: the grant itself is the credential; the desktop UI is a file:// page). */
  frameAncestors?: string;
  /**
   * Which open directories the root-level `/_blob/<id>` is looked up in: `all` (default) searches all open directories, `design` only design canvases, `design-system` only design systems, and `isolated` design canvases and design systems. These two editors use a different loopback hostname on the Web and carry no session (docs/design/canvas §6.2, §10.4), so a root-level asset request cannot tell which editor it came from; when both are open, both are searched. When the Web's method allowlist opens only one of them, only that one is searched.
   * `/<kind>/<grant>/_blob/<id>` is not affected.
   */
  blobScope?: 'all' | 'design' | 'design-system' | 'isolated';
}

/** The editor kind, also the first segment of the route. */
export type EditorKind = 'slides' | 'design' | 'design-system';

/** Config for the design canvas and design system editors (both have the same shape). */
export interface DesignEditorOptions {
  /** Editor build output directory; when this returns null the page shows an unavailable message. */
  editorDist: () => string | null;
  /** File layout (`CANVAS_LAYOUT` from `@cuccut/design`, `DESIGN_SYSTEM_LAYOUT` from `@cuccut/design-system`). */
  layout: DeckLayout;
}

export interface DesignSystemEditorOptions extends DesignEditorOptions {
  /**
   * `userName` for `__deck/session` (the editor's `user.name()`, recorded in `lastChange.by`, docs/design/canvas §10.3).
   * Omitted when it returns undefined or an empty string. When not given, the local user name is used (`os.userInfo().username`).
   */
  userName?: () => string | undefined;
}

export interface SlidesServerOptions {
  /** Editor build output directory; when this returns null the page shows an unavailable message. It is asked on every request, so no restart is needed after a build. */
  editorDist: () => string | null;
  /** Design canvas editor (docs/design/canvas §6.2). When not given, design canvases cannot be opened and `/design/…` always returns 404. */
  design?: DesignEditorOptions;
  /** Design system editor (docs/design/canvas §10.4). When not given, design systems cannot be opened and `/design-system/…` always returns 404. */
  designSystem?: DesignSystemEditorOptions;
  onError?: (message: string, error: unknown) => void;
  /** Records one entry in the runtime log (e.g. a design canvas's file count exceeds the manifest limit). */
  onWarn?: (message: string) => void;
  /** Upper limit on deck and design canvases open at the same time; when exceeded, the earliest opened one with no editor connected is dropped. */
  maxDecks?: number;
}

interface OpenDeck {
  grant: string;
  kind: EditorKind;
  dir: string;
  store: DeckStore;
  clients: Set<ServerResponse>;
  stopWatch: (() => void) | null;
}

interface KindConfig {
  editorDist: () => string | null;
  layout: DeckLayout | undefined;
  /** The 503 message for index.html when there is no build output. */
  notBuilt: string;
  csp: (inlineScriptHashes: readonly string[], frameAncestors?: string) => string;
  /** The English term the runtime log uses for this kind of directory. */
  noun: string;
  /** Other fields carried by `__deck/session`. */
  session?: () => Record<string, unknown>;
}

/** Upper limit for the publish request body: the whole batch of files after base64. */
const MAX_PUBLISH_BYTES = 64 * 1024 * 1024;
/** Upper limit for assets (videos also go through here). */
const MAX_ASSET_BYTES = 256 * 1024 * 1024;
const SSE_KEEPALIVE_MS = 25_000;
const GRANT_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const BLOB_PATH = /^_blob\/([0-9a-f]{32})$/;

/**
 * Assets and deck files are served as "data": they are not executed as pages (e.g. an SVG opened directly). The design system preview loads `project/*` via `<script src>`, `<link>`, `<img>` and `@font-face`, and that still works: the CSP in the response headers only constrains the documents served with it (and Workers), not sub-resources. Sub-resources need the correct Content-Type (with nosniff); see the MIME table in deck-store.ts. So no file type is exempted.
 */
const DATA_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** CSP for the editor page: the runtime must run scripts, load Google Fonts, display assets and data:/blob: images, and transcode video with a blob: Worker. */
export function editorCsp(inlineScriptHashes: readonly string[], frameAncestors?: string): string {
  return pageCsp(`script-src 'self' ${inlineScriptHashes.map(h => `'${h}'`).join(' ')}`.trim(), frameAncestors);
}

/**
 * CSP for the design canvas editor (docs/design/canvas §6.2): the canvas must run inline scripts, compile with Babel (eval), and load the canvas runtime from blob:, so `script-src` is `'self' 'unsafe-inline' 'unsafe-eval' blob:`, with no hashes (when hashes are present, browsers ignore `'unsafe-inline'`). The rest is the same as for slides.
 */
export function designEditorCsp(frameAncestors?: string): string {
  return pageCsp("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:", frameAncestors);
}

/**
 * CSP for the design system editor (docs/design/canvas §10.4), also used for `artifact-type/run.html`: the component preview runs the component bundle and the scripts in `preview.html`, same as the design canvas editor (`'self' 'unsafe-inline' 'unsafe-eval' blob:`), and does not allow CDNs (React UMD is served with the page). Google Fonts as before: stylesheets and fonts; the font catalog must `fetch` its css2 (connect-src).
 */
export function designSystemEditorCsp(frameAncestors?: string): string {
  return pageCsp("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:", frameAncestors);
}

/** Local user name (the design system editor's `user.name()`); undefined when it cannot be obtained. */
export function localUserName(): string | undefined {
  try {
    const name = os.userInfo().username.trim();
    return name === '' ? undefined : name;
  } catch {
    return undefined;
  }
}

function pageCsp(scriptSrc: string, frameAncestors?: string): string {
  const fonts = 'https://fonts.googleapis.com https://fonts.gstatic.com';
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' ${fonts}`,
    "frame-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    ...(frameAncestors ? [`frame-ancestors ${frameAncestors}`] : []),
  ].join('; ');
}

/** sha256 of the inline `<script>` in index.html (for CSP). */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(match[1] ?? '')) continue;
    hashes.push('sha256-' + createHash('sha256').update(match[2]!, 'utf8').digest('base64'));
  }
  return hashes;
}

const STATIC_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(text);
}

function publishError(response: ServerResponse, status: number, code: GenericPublishError['code'], message: string): void {
  sendJson(response, status, { code, message } satisfies GenericPublishError);
}

class TooLarge extends Error {}

function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new TooLarge());
      request.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new TooLarge());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

/** POST accepts only same-origin requests (the editor page's own fetch) or requests without an Origin, so other web pages cannot write even if they know the grant. */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  const host = request.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isWireEntry(value: unknown): value is WireEntry {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  if (entry.delete === true) return entry.ifMatch === undefined || typeof entry.ifMatch === 'string';
  // ifMatch for a write may be null: it requires the file not to exist yet (PublishWrite in file-protocol.ts).
  if (entry.ifMatch !== undefined && entry.ifMatch !== null && typeof entry.ifMatch !== 'string') return false;
  return typeof entry.base64 === 'string' && typeof entry.contentType === 'string';
}

export class SlidesServer {
  readonly #kinds: Record<EditorKind, KindConfig>;
  readonly #onError: (message: string, error: unknown) => void;
  readonly #onWarn: (message: string) => void;
  readonly #maxDecks: number;
  readonly #byGrant = new Map<string, OpenDeck>();
  /** `<kind>\\0<real path>` → open directory: the same directory opened in both editors has a separate grant for each. */
  readonly #byDir = new Map<string, OpenDeck>();
  /** `<kind>\\0<relative path>` → page in the editor build output. */
  readonly #pageCache = new Map<string, { file: string; mtimeMs: number; html: string; hashes: string[] }>();

  constructor(options: SlidesServerOptions) {
    const userName = options.designSystem?.userName ?? localUserName;
    this.#kinds = {
      slides: { editorDist: options.editorDist, layout: undefined, notBuilt: 'Slides editor is not built', csp: editorCsp, noun: 'deck' },
      design: {
        editorDist: options.design?.editorDist ?? (() => null),
        layout: options.design?.layout,
        notBuilt: 'Design editor is not built',
        csp: (_hashes, frameAncestors) => designEditorCsp(frameAncestors),
        noun: 'design',
      },
      'design-system': {
        editorDist: options.designSystem?.editorDist ?? (() => null),
        layout: options.designSystem?.layout,
        notBuilt: 'Design system editor is not built',
        csp: (_hashes, frameAncestors) => designSystemEditorCsp(frameAncestors),
        noun: 'design system',
        session: () => {
          const name = userName();
          return name ? { userName: name } : {};
        },
      },
    };
    this.#onError = options.onError ?? (() => {});
    this.#onWarn = options.onWarn ?? (() => {});
    this.#maxDecks = options.maxDecks ?? 64;
  }

  /** Whether this kind's editor build output exists (when it does not, the UI shows an unavailable message). */
  editorAvailable(kind: EditorKind = 'slides'): boolean {
    return this.#kinds[kind].editorDist() !== null;
  }

  /**
   * Issues a grant for a directory; the same directory (real path) opened with the same kind reuses the same grant. Returns the grant. The caller first checks that the directory is a deck, a design canvas or a design system.
   * Throws when the editor for this kind is not configured (design canvas, design system).
   */
  async open(dirPath: string, kind: EditorKind = 'slides'): Promise<string> {
    if (kind !== 'slides' && this.#kinds[kind].layout === undefined) throw new Error(`${this.#kinds[kind].noun} editor is not configured`);
    const dir = await realpath(dirPath);
    const key = `${kind}\0${dir}`;
    const existing = this.#byDir.get(key);
    if (existing) return existing.grant;
    this.#prune();
    const deck: OpenDeck = {
      grant: randomBytes(24).toString('base64url'),
      kind,
      dir,
      store: this.#createStore(dir, kind),
      clients: new Set(),
      stopWatch: null,
    };
    this.#byGrant.set(deck.grant, deck);
    this.#byDir.set(key, deck);
    return deck.grant;
  }

  /** Storage for open directories (slides_check, design_import_asset, etc. also use it, so they do not interleave with editor publishes). */
  storeOf(dirPath: string, kind: EditorKind = 'slides'): DeckStore | null {
    for (const deck of this.#byDir.values()) {
      if (deck.kind === kind && (deck.dir === dirPath || deck.store.root === dirPath)) return deck.store;
    }
    return null;
  }

  /** A directory not opened before gets a storage created with this kind's layout (no grant is registered). */
  createStore(dirPath: string, kind: EditorKind = 'slides'): DeckStore {
    return this.#createStore(dirPath, kind);
  }

  #createStore(dir: string, kind: EditorKind): DeckStore {
    if (kind === 'slides') return new DeckStore(dir);
    const config = this.#kinds[kind];
    const layout = config.layout;
    if (layout === undefined) throw new Error(`${config.noun} editor is not configured`);
    const noun = config.noun.charAt(0).toUpperCase() + config.noun.slice(1);
    return new DeckStore(dir, layout, {
      onTruncated: limit => this.#onWarn(`${noun} folder has more than ${limit} files; the editor only lists the first ${limit}: ${dir}`),
    });
  }

  /** Closes all event streams and directory watchers. */
  close(): void {
    for (const deck of this.#byGrant.values()) this.#release(deck);
    this.#byGrant.clear();
    this.#byDir.clear();
  }

  /** Handles `/slides/…`, `/design/…`, `/design-system/…` and `/_blob/…`; returns false for any other prefix. */
  handle(request: IncomingMessage, response: ServerResponse, options: DeckRouteOptions): boolean {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = url.pathname;
    const root = BLOB_PATH.exec(pathname.slice(1));
    if (root) {
      const scope = options.blobScope ?? 'all';
      const inScope = (kind: EditorKind) =>
        scope === 'all' || scope === kind || (scope === 'isolated' && (kind === 'design' || kind === 'design-system'));
      const decks = [...this.#byGrant.values()].filter(d => inScope(d.kind));
      void this.#guard(response, () => this.#serveBlob(request, response, root[1]!, decks));
      return true;
    }
    const match = /^\/(slides|design-system|design)\/([^/]+)(\/.*)?$/.exec(pathname);
    if (!match) return false;
    const kind = match[1] as EditorKind;
    const found = GRANT_PATTERN.test(match[2]!) ? this.#byGrant.get(match[2]!) : undefined;
    // A grant is only valid for the kind that issued it
    const deck = found?.kind === kind ? found : undefined;
    if (!deck) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return true;
    }
    if (match[3] === undefined) {
      // The runtime fetches `_files.json` and `project/…` with relative URLs, so the page URL must end with /
      response.writeHead(308, { Location: `/${kind}/${deck.grant}/${url.search}`, 'Cache-Control': 'no-store' }).end();
      return true;
    }
    let rest: string;
    try {
      rest = decodeURIComponent(match[3].slice(1));
    } catch {
      response.writeHead(400).end();
      return true;
    }
    void this.#guard(response, () => this.#route(deck, rest, request, response, options));
    return true;
  }

  async #guard(response: ServerResponse, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof TooLarge) {
        if (!response.headersSent) publishError(response, 413, 'too_large', 'request body is too large');
        return;
      }
      this.#onError('Editor request failed', error);
      if (!response.headersSent) publishError(response, 500, 'upstream_error', 'internal error');
      else response.destroy();
    }
  }

  async #route(deck: OpenDeck, rest: string, request: IncomingMessage, response: ServerResponse, options: DeckRouteOptions): Promise<void> {
    const method = request.method ?? 'GET';
    if (rest === DECK_ROUTES.publish || rest === DECK_ROUTES.assets) {
      if (method !== 'POST') {
        response.writeHead(405, { Allow: 'POST' }).end();
        return;
      }
      if (!sameOrigin(request)) {
        request.resume();
        publishError(response, 403, 'not_writer', 'cross-origin request');
        return;
      }
      if (!options.canEdit) {
        request.resume();
        publishError(response, 403, 'not_writer', 'this session is read-only');
        return;
      }
      if (rest === DECK_ROUTES.publish) await this.#publish(deck, request, response);
      else await this.#upload(deck, request, response);
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    if (rest === DECK_ROUTES.listing) {
      sendJson(response, 200, await deck.store.listing());
      return;
    }
    if (rest === DECK_ROUTES.session) {
      sendJson(response, 200, { canEdit: options.canEdit, ...this.#kinds[deck.kind].session?.() });
      return;
    }
    if (rest === DECK_ROUTES.events) {
      this.#events(deck, request, response);
      return;
    }
    if (rest.startsWith('project/')) {
      const bytes = await deck.store.readProjectFile(rest);
      if (bytes === null) {
        response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': contentTypeOf(rest),
        'Content-Length': bytes.byteLength,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': DATA_CSP,
      });
      response.end(method === 'HEAD' ? undefined : bytes);
      return;
    }
    const blob = BLOB_PATH.exec(rest);
    if (blob) {
      await this.#serveBlob(request, response, blob[1]!, [deck]);
      return;
    }
    await this.#serveEditor(deck.kind, rest, request, response, options);
  }

  async #publish(deck: OpenDeck, request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) {
      publishError(response, 415, 'invalid_content', 'expected application/json');
      return;
    }
    const raw = await readBody(request, MAX_PUBLISH_BYTES);
    let files: Record<string, WireEntry>;
    try {
      const body = JSON.parse(raw.toString('utf8')) as { files?: unknown };
      if (typeof body?.files !== 'object' || body.files === null || Array.isArray(body.files)) throw new Error('files');
      if (!Object.values(body.files).every(isWireEntry)) throw new Error('entry');
      files = body.files as Record<string, WireEntry>;
    } catch {
      publishError(response, 400, 'invalid_content', 'malformed publish request');
      return;
    }
    const outcome = await deck.store.publish(files);
    sendJson(response, outcome.status, outcome.body);
  }

  async #upload(deck: OpenDeck, request: IncomingMessage, response: ServerResponse): Promise<void> {
    const contentType = request.headers['content-type'] ?? 'application/octet-stream';
    const limit = Math.min(MAX_ASSET_BYTES, deck.store.layout.maxBlobBytes?.(contentType) ?? MAX_ASSET_BYTES);
    const bytes = await readBody(request, limit);
    if (bytes.length === 0) {
      publishError(response, 400, 'invalid_content', 'empty upload');
      return;
    }
    sendJson(response, 200, await deck.store.putBlob(bytes, contentType));
  }

  #events(deck: OpenDeck, request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write(': connected\n\n');
    deck.clients.add(response);
    deck.stopWatch ??= watchExternalEdits(
      deck.store,
      event => this.#broadcast(deck, event),
      error => this.#onError(`Watching a ${this.#kinds[deck.kind].noun} failed`, error),
    );
    const keepAlive = setInterval(() => response.write(': ping\n\n'), SSE_KEEPALIVE_MS);
    keepAlive.unref?.();
    const done = () => {
      clearInterval(keepAlive);
      deck.clients.delete(response);
      if (deck.clients.size === 0) {
        deck.stopWatch?.();
        deck.stopWatch = null;
      }
    };
    request.on('close', done);
    response.on('close', done);
  }

  #broadcast(deck: OpenDeck, event: DeckChangeEvent): void {
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of deck.clients) client.write(frame);
  }

  async #serveBlob(request: IncomingMessage, response: ServerResponse, id: string, decks: readonly OpenDeck[]): Promise<void> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    for (const candidate of decks) {
      const found = await candidate.store.blobFile(id);
      if (found === null) continue;
      const info = await stat(found.file).catch(() => null);
      if (!info?.isFile()) continue;
      response.writeHead(200, {
        'Content-Type': found.contentType,
        'Content-Length': info.size,
        // Content-addressed: the same id always has the same content
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': DATA_CSP,
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const stream = createReadStream(found.file);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
      return;
    }
    response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
  }

  async #serveEditor(kind: EditorKind, rest: string, request: IncomingMessage, response: ServerResponse, options: DeckRouteOptions): Promise<void> {
    const config = this.#kinds[kind];
    const dist = config.editorDist();
    const parts = rest === '' ? ['index.html'] : rest.split('/');
    // node/ in the build directory is the compiler for the Runtime and is not exposed externally
    const invalid = parts.some(p => p === '' || p === '.' || p === '..' || p.startsWith('.') || p.includes('\\')) || parts[0] === 'node';
    if (dist === null || invalid) {
      if (dist === null && parts[0] === 'index.html') {
        response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end(config.notBuilt);
        return;
      }
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    const realDist = await realpath(dist).catch(() => null);
    const file = realDist === null ? null : path.join(realDist, ...parts);
    const real = file === null ? null : await realpath(file).catch(() => null);
    const info = real === null ? null : await lstat(real).catch(() => null);
    if (file === null || real !== file || !info?.isFile()) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    const type = STATIC_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    // index.html and the other pages (the design system's `artifact-type/run.html`, the component preview iframe, which runs scripts) all carry this kind's CSP
    if (path.extname(file).toLowerCase() === '.html') {
      const page = await this.#page(kind, rest === '' ? 'index.html' : rest, file, info.mtimeMs);
      const body = Buffer.from(page.html);
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': config.csp(page.hashes, options.frameAncestors),
      });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      // Vite output filenames include a content hash
      'Cache-Control': parts[0] === 'assets' ? 'private, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = createReadStream(file);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  }

  /** A page in the editor build output (cached by kind and relative path); slide pages compute the hash of their inline script separately. */
  async #page(kind: EditorKind, rel: string, file: string, mtimeMs: number): Promise<{ html: string; hashes: string[] }> {
    const key = `${kind}\0${rel}`;
    const cached = this.#pageCache.get(key);
    if (cached && cached.file === file && cached.mtimeMs === mtimeMs) return cached;
    const html = await readFile(file, 'utf8');
    const next = { file, mtimeMs, html, hashes: kind === 'slides' ? inlineScriptHashes(html) : [] };
    this.#pageCache.set(key, next);
    return next;
  }

  #release(deck: OpenDeck): void {
    deck.stopWatch?.();
    deck.stopWatch = null;
    for (const client of deck.clients) client.end();
    deck.clients.clear();
  }

  #prune(): void {
    while (this.#byGrant.size >= this.#maxDecks) {
      const idle = [...this.#byGrant.values()].find(d => d.clients.size === 0) ?? this.#byGrant.values().next().value;
      if (!idle) return;
      this.#release(idle);
      this.#byGrant.delete(idle.grant);
      this.#byDir.delete(`${idle.kind}\0${idle.dir}`);
    }
  }
}

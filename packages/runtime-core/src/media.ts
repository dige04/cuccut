import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { RpcError, type MediaHandle, type MediaPlayback } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import { inspectFileContent } from './file-content.ts';
import type { PlaybackPreparation } from './media-analysis.ts';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';

/**
 * Media channel (architecture design §4.5, §5.6): the `<video>` and `<img>` in the UI cannot send a token header, so the Runtime issues an unguessable restricted handle for each file, and the handle itself is the credential.
 *
 * - Only files inside the source directory can be served: both sides are resolved to real paths and then prefix-checked, so symlinks cannot escape.
 * - Handles expire; each use extends the expiry, so a long video does not stop working halfway through.
 * - Supports HTTP Range (206/416) and HEAD, so players can seek.
 * - Paths are not written to logs.
 */

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  srt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  ass: 'text/plain; charset=utf-8',
  ssa: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  lottie: 'application/zip',
  pdf: 'application/pdf',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff2: 'font/woff2',
};

export function mimeTypeOf(fileName: string): string {
  return MIME_BY_EXT[path.extname(fileName).slice(1).toLowerCase()] ?? 'application/octet-stream';
}

/** Parses a single `Range: bytes=…` segment. Returns null if it is absent or unreadable (the whole file is served); returns 'unsatisfiable' if out of bounds. */
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

/** Resolves the real path of `target` and checks that it is inside `root` and is a regular file. */
export async function resolveInside(root: string, target: string): Promise<{ realPath: string; size: number }> {
  let rootReal: string;
  let realPath: string;
  try {
    rootReal = await fsp.realpath(root);
    realPath = await fsp.realpath(path.resolve(root, target));
  } catch {
    throw new RpcError('not-found', RcRuntime.fileNotFound());
  }
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  if (!realPath.startsWith(prefix)) throw new RpcError('forbidden', RcRuntime.onlyWorkingFolderFiles());
  const stat = await fsp.stat(realPath).catch(() => null);
  if (!stat?.isFile()) throw new RpcError('not-found', RcRuntime.notAFile());
  return { realPath, size: stat.size };
}

const SUBTITLE_EXTS = new Set(['srt', 'vtt', 'ass', 'ssa']);
const MAX_SUBTITLES = 50;

/** Strips the last extension: `a.zh.srt` → `a.zh`. */
function stem(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * Subtitle files in the same directory as `target`. `relPath` is relative to `root` and uses `/` separators, so it can be passed straight back to get a media URL.
 * Files named like the video come first: an exact match (`a.srt`) first, a tagged one (`a.zh.srt`) next, and the rest by file name.
 */
export async function findSubtitles(
  root: string,
  target: string,
): Promise<{ relPath: string; fileName: string; matched: boolean; tag: string | null }[]> {
  const { realPath } = await resolveInside(root, target);
  const rootReal = await fsp.realpath(root);
  const dir = path.dirname(realPath);
  const relDir = path.relative(rootReal, dir).split(path.sep).filter(Boolean).join('/');
  const base = stem(path.basename(realPath)).toLowerCase();
  const names = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  return names
    .filter(
      (d) =>
        (d.isFile() || d.isSymbolicLink()) && !d.name.startsWith('.') && SUBTITLE_EXTS.has(path.extname(d.name).slice(1).toLowerCase()),
    )
    .map((d) => {
      const name = stem(d.name);
      const lower = name.toLowerCase();
      const matched = lower === base || lower.startsWith(`${base}.`);
      return {
        relPath: relDir ? `${relDir}/${d.name}` : d.name,
        fileName: d.name,
        matched,
        tag: matched && name.length > base.length ? name.slice(base.length + 1) : null,
      };
    })
    .sort((a, b) => rank(a) - rank(b) || a.fileName.localeCompare(b.fileName))
    .slice(0, MAX_SUBTITLES);
}

function rank(track: { matched: boolean; tag: string | null }): number {
  return !track.matched ? 2 : track.tag === null ? 0 : 1;
}

interface Grant {
  handle: MediaHandle;
  realPath: string;
  fileName: string;
  mimeType: string;
  expiresAt: number;
}

export interface MediaRegistryOptions {
  log: Logger;
  ttlMs?: number;
  /** Same origin rules as the gateway, used for CORS (the UI reads subtitles and documents with fetch). */
  originAllowed: (origin: string | undefined) => boolean;
  maxGrants?: number;
}

export class MediaRegistry {
  readonly #log: Logger;
  readonly #ttlMs: number;
  readonly #maxGrants: number;
  readonly #originAllowed: (origin: string | undefined) => boolean;
  readonly #grants = new Map<string, Grant>();
  #baseUrl = '';

  constructor(options: MediaRegistryOptions) {
    this.#log = options.log.child('media');
    this.#ttlMs = options.ttlMs ?? 60 * 60 * 1000;
    this.#maxGrants = options.maxGrants ?? 4096;
    this.#originAllowed = options.originAllowed;
  }

  setBaseUrl(url: string): void {
    this.#baseUrl = url;
  }

  async issue(root: string, target: string): Promise<MediaHandle> {
    const { realPath, size } = await resolveInside(root, target);
    this.#prune();
    const id = crypto.randomBytes(24).toString('base64url');
    const fileName = path.basename(realPath);
    const content = await inspectFileContent(realPath, size);
    const expiresAt = Date.now() + this.#ttlMs;
    const handle: MediaHandle = {
      url: `${this.#baseUrl}/media/${id}/${encodeURIComponent(fileName)}`,
      mimeType: content.mimeType,
      contentKind: content.contentKind,
      ...(content.textEncoding ? { textEncoding: content.textEncoding } : {}),
      size,
      fileName,
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.#grants.set(id, { handle, realPath, fileName, mimeType: content.mimeType, expiresAt });
    return handle;
  }

  /**
   * Playback URL (architecture design §4.5): only accepts issued handles; the cached path does not go through the control channel. The original handle is given when the file is not WebM, or when `prepare` says the client can play the original file directly.
   */
  async playback(url: string, prepare: (file: string) => Promise<PlaybackPreparation>): Promise<MediaPlayback> {
    const base = new URL(this.#baseUrl || '/', 'http://localhost');
    let parsed: URL;
    try { parsed = new URL(url, base); } catch { throw new RpcError('not-found', RcRuntime.fileNotFound()); }
    const id = /^\/media\/([A-Za-z0-9_-]+)(?:\/[^/]*)?$/.exec(parsed.pathname)?.[1];
    const grant = parsed.origin === base.origin && id ? this.#grants.get(id) : undefined;
    if (!grant || grant.expiresAt <= Date.now()) throw new RpcError('not-found', RcRuntime.fileNotFound());
    const realPath = await fsp.realpath(grant.realPath).catch(() => null);
    if (realPath !== grant.realPath || !(await fsp.stat(realPath).catch(() => null))?.isFile()) {
      throw new RpcError('not-found', RcRuntime.fileNotFound());
    }
    grant.expiresAt = Date.now() + this.#ttlMs;
    if (!['video/webm', 'audio/webm'].includes(grant.mimeType)) return { status: 'ready', media: grant.handle };
    const result = await prepare(realPath);
    if (result.status === 'original') return { status: 'ready', media: grant.handle };
    if (result.status === 'pending') return result;
    const media = await this.issue(result.root, result.file);
    return { status: 'ready', media: { ...media, fileName: grant.handle.fileName } };
  }

  /** Handles `/media/<handle>/<file name>`. Returns false for any other prefix. */
  handle(request: IncomingMessage, response: ServerResponse): boolean {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const match = /^\/media\/([A-Za-z0-9_-]+)(?:\/[^/]*)?$/.exec(url.pathname);
    if (!match) return false;
    const origin = request.headers.origin;
    if (origin !== undefined && this.#originAllowed(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Allow-Headers': 'Range' }).end();
      return true;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return true;
    }
    void this.#serve(match[1]!, request, response, url.searchParams.get('download') === '1').catch((error) => {
      this.#log.warn('Media request failed', { error: (error as Error).name });
      if (!response.headersSent) response.writeHead(500).end();
      else response.destroy();
    });
    return true;
  }

  async #serve(id: string, request: IncomingMessage, response: ServerResponse, download: boolean): Promise<void> {
    const grant = this.#grants.get(id);
    if (!grant || grant.expiresAt <= Date.now()) {
      if (grant) this.#grants.delete(id);
      response.writeHead(404).end();
      return;
    }
    // A segment of the path may have been replaced with a symlink after the handle was issued: resolve the real path again, and refuse if it no longer matches.
    const realPath = await fsp.realpath(grant.realPath).catch(() => null);
    const stat = realPath === grant.realPath ? await fsp.stat(realPath).catch(() => null) : null;
    if (!stat?.isFile()) {
      response.writeHead(404).end();
      return;
    }
    grant.expiresAt = Date.now() + this.#ttlMs;

    const size = stat.size;
    const headers: Record<string, string | number> = {
      'Content-Type': grant.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-cache',
      'Last-Modified': stat.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
      // Do not run file contents as a page (for example, when an SVG is opened directly).
      'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      ...(download ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(grant.fileName).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())}` } : {}),
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
    if (request.method === 'HEAD' || length === 0) {
      response.end();
      return;
    }
    const stream = fs.createReadStream(grant.realPath, { start, end });
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  }

  #prune(): void {
    const now = Date.now();
    for (const [id, grant] of this.#grants) if (grant.expiresAt <= now) this.#grants.delete(id);
    // When the limit is exceeded, drop the earliest issued ones.
    while (this.#grants.size >= this.#maxGrants) {
      const oldest = this.#grants.keys().next().value;
      if (oldest === undefined) break;
      this.#grants.delete(oldest);
    }
  }
}

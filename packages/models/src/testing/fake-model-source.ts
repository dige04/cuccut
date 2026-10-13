import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import path from 'node:path';
import type { BundleDefinition } from '../bundle-registry.ts';
import { MANIFEST_FILE } from '../model-catalog.ts';
import type { RepoManifestSpec } from '../repo-manifests.ts';

/**
 * Fake model source for tests: listens only on a temporary port on the loopback address and serves in-memory files using the download path rule
 * (`<base>/<owner>/<repo>/resolve/<revision>/<file path>`). Supports HEAD, `Range: bytes=n-` and `bytes=n-m`.
 * Faults can be injected per file: reply with a status code, disconnect after sending some bytes, hang after sending some bytes, replace the content with bad bytes, or ignore Range.
 * Tests never connect to a real model repository and never download a real model.
 */

export interface FakeFault {
  /** Reply with this status code (no content). */
  status?: number;
  /** Disconnect after sending this many bytes from the start of this reply. */
  breakAfter?: number;
  /** Stop sending after this many bytes, until the client disconnects. */
  stallAfter?: number;
  /** Replace the content with bad bytes of the same length. */
  corrupt?: boolean;
  /** Ignore Range; always reply 200 with the full content. */
  ignoreRange?: boolean;
}

export interface FakeSourceRequest {
  method: string;
  /** The decoded file path within the repo; the request path when it does not match the path rule. */
  file: string;
  repo: string | null;
  revision: string | null;
  range: string | null;
  headers: http.IncomingHttpHeaders;
}

export interface FakeModelSource {
  /** `http://127.0.0.1:<port>` (plus `prefix`). */
  endpoint: string;
  requests: FakeSourceRequest[];
  /** Put one file. */
  put(repo: string, revision: string, file: string, content: Buffer | string): void;
  /** Queue a fault for one file (a path of the same name in any repo), for `times` requests. */
  fault(file: string, fault: FakeFault, times?: number): void;
  /** Size of each chunk and the pause between chunks (default 64 KiB, irregular). */
  throttle(chunkBytes: number, delayMs: number): void;
  /** How many times a file has been GET. */
  gets(file: string): number;
  close(): Promise<void>;
}

export async function startFakeModelSource(options: { prefix?: string } = {}): Promise<FakeModelSource> {
  const prefix = options.prefix ?? '';
  const files = new Map<string, Buffer>();
  const faults = new Map<string, FakeFault[]>();
  let chunkBytes = 64 * 1024;
  let delayMs = 0;
  const sockets = new Set<Socket>();
  const requests: FakeSourceRequest[] = [];

  const server = http.createServer((req, res) => {
    void serve(req, res).catch(() => {
      res.destroy();
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  async function serve(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const parsed = parsePath(url.pathname, prefix);
    const range = typeof req.headers.range === 'string' ? req.headers.range : null;
    requests.push({
      method: req.method ?? 'GET',
      file: parsed?.file ?? url.pathname,
      repo: parsed?.repo ?? null,
      revision: parsed?.revision ?? null,
      range,
      headers: req.headers,
    });
    const content = parsed ? files.get(key(parsed.repo, parsed.revision, parsed.file)) : undefined;
    if (!parsed || !content) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-length': String(content.length), 'x-linked-size': String(content.length), 'accept-ranges': 'bytes' });
      res.end();
      return;
    }
    const fault = faults.get(parsed.file)?.shift() ?? {};
    if (fault.status) {
      res.writeHead(fault.status);
      res.end();
      return;
    }
    const body = fault.corrupt ? Buffer.from(content.map((b) => b ^ 0xff)) : content;
    const match = range && !fault.ignoreRange ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    let start = 0;
    let stop = body.length;
    if (match) {
      start = Number(match[1]);
      if (match[2]) stop = Math.min(body.length, Number(match[2]) + 1);
      if (start >= stop) {
        res.writeHead(416, { 'content-range': `bytes */${body.length}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'content-length': String(stop - start),
        'content-range': `bytes ${start}-${stop - 1}/${body.length}`,
        'accept-ranges': 'bytes',
      });
    } else {
      res.writeHead(200, { 'content-length': String(body.length), 'accept-ranges': 'bytes' });
    }
    const slice = body.subarray(start, stop);
    let sent = 0;
    while (sent < slice.length) {
      if (fault.breakAfter !== undefined && sent >= fault.breakAfter) {
        // Let the bytes already written reach the client, then disconnect.
        res.flushHeaders();
        await new Promise((resolve) => setTimeout(resolve, 20));
        req.socket.destroy();
        return;
      }
      if (fault.stallAfter !== undefined && sent >= fault.stallAfter) return;
      let end = Math.min(slice.length, sent + chunkBytes);
      if (fault.breakAfter !== undefined) end = Math.min(end, fault.breakAfter);
      if (fault.stallAfter !== undefined) end = Math.min(end, fault.stallAfter);
      const ok = res.write(slice.subarray(sent, end));
      sent = end;
      if (!ok) await new Promise<void>((resolve) => res.once('drain', resolve));
      if (res.destroyed) return;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    res.end();
  }

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}${prefix}`,
    requests,
    put(repo, revision, file, content) {
      files.set(key(repo, revision, file), Buffer.isBuffer(content) ? content : Buffer.from(content));
    },
    fault(file, fault, times = 1) {
      const queue = faults.get(file) ?? [];
      for (let i = 0; i < times; i++) queue.push({ ...fault });
      faults.set(file, queue);
    },
    throttle(bytes, ms) {
      chunkBytes = bytes;
      delayMs = ms;
    },
    gets(file) {
      return requests.filter((r) => r.method === 'GET' && r.file === file).length;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function key(repo: string, revision: string, file: string): string {
  return `${repo}@${revision}:${file}`;
}

function parsePath(pathname: string, prefix: string): { repo: string; revision: string; file: string } | null {
  if (!pathname.startsWith(`${prefix}/`)) return null;
  const segments = pathname
    .slice(prefix.length + 1)
    .split('/')
    .map((s) => decodeURIComponent(s));
  if (segments.length < 5 || segments[2] !== 'resolve') return null;
  return { repo: `${segments[0]}/${segments[1]}`, revision: segments[3]!, file: segments.slice(4).join('/') };
}

/** A synthetic repo: file contents and the sha256 computed from them (the real hash of the test content, not a made-up one). */
export interface SyntheticRepo {
  repo: string;
  revision: string;
  files: Record<string, Buffer>;
}

export function sha256Of(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** The built-in manifest of the synthetic repo. With `sizes: false`, sizes are null (as in a real manifest, they must be fetched with HEAD). */
export function syntheticManifest(repo: SyntheticRepo, options: { sizes?: boolean; estimatedBytes?: number } = {}): RepoManifestSpec {
  const sizes = options.sizes ?? true;
  const files = Object.entries(repo.files).map(([path, content]) => ({
    path,
    size: sizes ? content.length : null,
    sha256: sha256Of(content),
  }));
  return {
    repo: repo.repo,
    revision: repo.revision,
    files,
    estimatedBytes: options.estimatedBytes ?? files.reduce((sum, f) => sum + (f.size ?? 0), 0),
    provenance: '测试合成',
  };
}

/** Put the synthetic repo into the fake source. */
export function serveRepo(source: FakeModelSource, repo: SyntheticRepo): void {
  for (const [file, content] of Object.entries(repo.files)) source.put(repo.repo, repo.revision, file, content);
}

/** Deterministic pseudo-random bytes (the “weights” for tests). */
export function syntheticBytes(length: number, seed: number): Buffer {
  const out = Buffer.alloc(length);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

/** Two synthetic model packages that share a VAD component (for reference-counting tests). */
export function sharedVadBundles(asrA: SyntheticRepo, asrB: SyntheticRepo, vad: SyntheticRepo): BundleDefinition[] {
  const vadSource = { family: 'silero-vad' as const, repo: vad.repo, revision: vad.revision };
  return [
    {
      bundleId: 'test-a@mlx',
      capability: 'transcribe',
      backend: 'mlx',
      device: 'metal',
      label: 'Test A',
      components: { asr: { family: 'qwen3-asr', repo: asrA.repo, revision: asrA.revision }, vad: vadSource },
    },
    {
      bundleId: 'test-b@mlx',
      capability: 'transcribe',
      backend: 'mlx',
      device: 'metal',
      label: 'Test B',
      components: { asr: { family: 'qwen3-asr', repo: asrB.repo, revision: asrB.revision }, vad: vadSource },
    },
  ];
}

/** Install the synthetic repo directly into a model directory: its files plus `.ccut-manifest.json` (for tests of moving and recognizing model directories). */
export async function writeSyntheticRepo(root: string, repo: SyntheticRepo): Promise<void> {
  const dir = path.join(root, ...repo.repo.split('/'));
  await fs.mkdir(dir, { recursive: true });
  for (const [file, content] of Object.entries(repo.files)) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), content);
  }
  const files = Object.entries(repo.files).map(([file, content]) => ({ path: file, size: content.length, sha256: sha256Of(content) }));
  await fs.writeFile(path.join(dir, MANIFEST_FILE), JSON.stringify({ format_version: 1, repo: repo.repo, revision: repo.revision, files }));
}

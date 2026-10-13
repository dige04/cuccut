import fs from 'node:fs/promises';
import path from 'node:path';
import { MANIFEST_FILE, sha256File, type CcutManifest } from './model-catalog.ts';
import { modelFileUrl, repoEndpoint } from './download-source.ts';
import { STAGING_DIR, removeEmptyParents, stagingDirOf } from './model-staging.ts';
import { live, type MessageRef } from '@cuccut/protocol';
import { ModelsModelDownloader as M } from '@cuccut/protocol/messages/models/model-downloader.ts';
import { modelTextRef, type ModelText } from './model-text.ts';

/**
 * Downloader for model files (architecture design §6.3): downloads the files in the manifest one by one into the staging area, checks each file's size and sha256, and publishes the whole repository atomically once all of it is present.
 *
 * Staging area: `<models-root>/.ccut-staging/<owner>/<repo>@<revision>/`, on the same volume as the model directory (publishing is a rename).
 * - A file not yet finished is `<path>.part`; a file whose sha256 has been checked is renamed to `<path>`. Files in the staging area that are already verified are not downloaded again.
 * - Resume: when `.part` already has n bytes, send `Range: bytes=n-`. A 206 whose `Content-Range` starts at n continues writing. A 200 means the source does not support resume: discard that response (its content may not be complete) and request again from the start without a Range; the same applies to a 5xx when the existing partial is no larger than `RESTART_BELOW`
 *   (ModelScope's small files return 200 for `bytes=n-` but send only part of the content, or return 502). If the sha256 of a resumed file does not match, delete it and download again from the start;
 *   if a file downloaded from the start still does not match, that is a verification failure.
 * - Connection failure, 5xx, 429 and a connection dropped mid-read are retried with bounded backoff (each time resuming from the bytes already written; the count restarts when there was progress before the drop); 404, 401 and 403 are not retried.
 * - Cancellation (signal abort) stops immediately; `.part` stays in the staging area and resumes next time.
 * - Publish: write `.ccut-manifest.json` into the staging directory, move the old repository directory (if any) aside by renaming it, rename the staging directory to the repository directory, then delete the old directory.
 *
 * Each error code comes with a remedy note: `MODEL_DOWNLOAD_NO_SPACE` (not enough disk space), `MODEL_DOWNLOAD_NETWORK` (network, retries exhausted),
 * `MODEL_DOWNLOAD_INTEGRITY` (size or sha256 mismatch), `MODEL_DOWNLOAD_SOURCE` (the source does not have this file or denies access), `MODEL_MANIFEST_INCOMPLETE` (the built-in manifest lacks a trusted hash).
 */

export type DownloadErrorCode =
  'MODEL_DOWNLOAD_NO_SPACE' | 'MODEL_DOWNLOAD_NETWORK' | 'MODEL_DOWNLOAD_INTEGRITY' | 'MODEL_DOWNLOAD_SOURCE' | 'MODEL_MANIFEST_INCOMPLETE';

// Built fresh in the current language on every read (`DownloadError.remedy` is taken at construction).
export const DOWNLOAD_REMEDIES: Readonly<Record<DownloadErrorCode, string>> = live(() => ({
  MODEL_DOWNLOAD_NO_SPACE: M.remedyNoSpace().text,
  MODEL_DOWNLOAD_NETWORK: M.remedyNetwork().text,
  MODEL_DOWNLOAD_INTEGRITY: M.remedyIntegrity().text,
  MODEL_DOWNLOAD_SOURCE: M.remedySource().text,
  MODEL_MANIFEST_INCOMPLETE: M.remedyManifestIncomplete().text,
}));

export class DownloadError extends Error {
  readonly code: DownloadErrorCode;
  readonly remedy: string;
  readonly details: Record<string, unknown>;

  /** Message reference taken when constructed with directory text. */
  readonly messageRef: MessageRef | undefined;

  constructor(code: DownloadErrorCode, message: ModelText, details: Record<string, unknown> = {}) {
    super(String(message));
    this.messageRef = modelTextRef(message);
    this.name = 'DownloadError';
    this.code = code;
    this.remedy = DOWNLOAD_REMEDIES[code];
    this.details = details;
  }
}

/** A file to download. When `size` is unknown, verify by sha256 only. */
export interface DownloadFile {
  path: string;
  size: number | null;
  sha256: string;
}

export interface DownloaderOptions {
  /** Root of the model directory. */
  root: string;
  /** Base URL of the download source (see `download-source.ts`). */
  endpoint: string;
  fetch?: typeof fetch;
  /** Number of retries for network errors (not counting the first attempt); default 4. */
  retries?: number;
  /** How long to wait before the n-th retry, in milliseconds; default 1, 2, 4, 8 seconds, capped. */
  backoffMs?: (attempt: number) => number;
  /** How long without data before the connection counts as dropped, in milliseconds; default 60 seconds. */
  stallMs?: number;
}

class Retryable extends Error {
  readonly reason: string;
  readonly status: number | null;
  constructor(reason: string, status: number | null = null) {
    super(reason);
    this.reason = reason;
    this.status = status;
  }
}

/** Content is wrong (extra bytes): handled the same as a sha256 mismatch. */
class Oversize extends Error {}

/** When a resume request returns 5xx and the existing partial is no larger than this many bytes, download from the start (re-downloading costs less than being stuck on a source that cannot resume). */
const RESTART_BELOW = 64 * 1024 * 1024;

export class ModelDownloader {
  readonly #root: string;
  readonly #endpoint: string;
  readonly #fetch: typeof fetch;
  readonly #retries: number;
  readonly #backoff: (attempt: number) => number;
  readonly #stallMs: number;

  constructor(options: DownloaderOptions) {
    this.#root = options.root;
    this.#endpoint = options.endpoint;
    this.#fetch = options.fetch ?? fetch;
    this.#retries = options.retries ?? 4;
    this.#backoff = options.backoffMs ?? ((attempt) => Math.min(8_000, 1_000 * 2 ** (attempt - 1)));
    this.#stallMs = options.stallMs ?? 60_000;
  }

  get endpoint(): string {
    return this.#endpoint;
  }

  /**
   * Download these files of one repository version into the staging directory (files already verified are skipped). `onBytes` receives the increment written; when a file is rewritten from the start, it is negative
   * (subtracting the discarded bytes). `sourceRepo` is the repository at the download source, given only when it differs from the `repo` location in the model directory (the `sourceRepo` of the repository manifest).
   */
  async download(
    repo: string,
    revision: string,
    files: readonly DownloadFile[],
    signal: AbortSignal,
    onBytes: (delta: number) => void = () => {},
    sourceRepo: string = repo,
  ): Promise<void> {
    const stage = stagingDirOf(this.#root, repo, revision);
    await fs.mkdir(stage, { recursive: true });
    for (const file of files) {
      signal.throwIfAborted();
      await this.#downloadFile(stage, modelFileUrl(this.#endpoint, sourceRepo, revision, file.path), file, signal, onBytes);
    }
  }

  /**
   * Download one file to `stage` by address (this does not go through the model repository's address rules; used for the archive of a release-page component, see `release-component.ts`): resume, retry, and the size and sha256 checks are the same as `download`. Verified files stay at `<stage>/<file.path>`; on mismatch they are deleted (`MODEL_DOWNLOAD_INTEGRITY`).
   */
  async downloadUrl(
    stage: string,
    url: string,
    file: DownloadFile,
    signal: AbortSignal,
    onBytes: (delta: number) => void = () => {},
  ): Promise<void> {
    await fs.mkdir(stage, { recursive: true });
    signal.throwIfAborted();
    await this.#downloadFile(stage, url, file, signal, onBytes);
  }

  /** Repair: hard-link (or copy, if linking fails) the verified good files from the repository directory into the staging directory; they are swapped in at publish time together with the newly downloaded ones. */
  async reuse(repo: string, revision: string, repoDir: string, files: readonly string[]): Promise<void> {
    const stage = stagingDirOf(this.#root, repo, revision);
    for (const file of files) {
      const target = path.join(stage, file);
      if (await exists(target)) continue;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rm(`${target}.part`, { force: true });
      await fs.link(path.join(repoDir, file), target).catch(() => fs.copyFile(path.join(repoDir, file), target));
    }
  }

  /**
   * Publish: write a manifest from the files in the staging directory, and atomically swap it into `<root>/<owner>/<repo>/`. `files` is every file the manifest should list (including reused ones), all of which should already be in the staging directory.
   * The manifest's `source` records the base URL actually used to download this repository (`sourceRepo` as in `download`).
   */
  async publish(
    repo: string,
    revision: string,
    files: ReadonlyArray<{ path: string; sha256: string }>,
    sourceRepo: string = repo,
  ): Promise<CcutManifest> {
    const stage = stagingDirOf(this.#root, repo, revision);
    const entries: CcutManifest['files'] = [];
    for (const file of files) {
      const stat = await fs.stat(path.join(stage, file.path));
      entries.push({ path: file.path, size: stat.size, sha256: file.sha256, source_verified: true });
    }
    const manifest: CcutManifest = { format_version: 1, repo, revision, source: repoEndpoint(this.#endpoint, sourceRepo), files: entries };
    await fs.writeFile(path.join(stage, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    const target = path.join(this.#root, ...repo.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    const aside = `${stage}.old-${process.pid}-${Date.now()}`;
    const hadOld = await exists(target);
    if (hadOld) await fs.rename(target, aside);
    try {
      await fs.rename(stage, target);
    } catch (error) {
      if (hadOld) await fs.rename(aside, target).catch(() => {});
      throw error;
    }
    if (hadOld) await fs.rm(aside, { recursive: true, force: true });
    await removeEmptyParents(path.dirname(stage), path.join(this.#root, STAGING_DIR));
    return manifest;
  }

  async #downloadFile(
    stage: string,
    url: string,
    file: DownloadFile,
    signal: AbortSignal,
    onBytes: (delta: number) => void,
  ): Promise<void> {
    const final = path.join(stage, file.path);
    if (await exists(final)) return;
    const part = `${final}.part`;
    await fs.mkdir(path.dirname(final), { recursive: true });
    let failures = 0;
    let resumed = false;
    let cleanRetried = false;
    for (;;) {
      signal.throwIfAborted();
      let offset = await sizeOf(part);
      if (file.size !== null && offset > file.size) {
        await truncate(part, onBytes, offset);
        offset = 0;
      }
      if (offset > 0) resumed = true;
      let bad = false;
      if (file.size === null || offset < file.size) {
        try {
          await this.#fetchInto(part, url, offset, file, signal, onBytes);
        } catch (error) {
          if (signal.aborted) throw signal.reason ?? error;
          if (error instanceof Oversize) bad = true;
          else if (error instanceof Retryable) {
            // When progress is made before a drop, restart the count: a slow but unstable connection keeps resuming as long as it keeps moving forward.
            failures = (await sizeOf(part)) > offset ? 1 : failures + 1;
            if (failures > this.#retries) {
              throw new DownloadError('MODEL_DOWNLOAD_NETWORK', M.downloadFailed({ file: file.path, reason: error.reason }), {
                file: file.path,
                reason: error.reason,
                ...(error.status !== null ? { status: error.status } : {}),
                attempts: failures,
              });
            }
            await sleep(this.#backoff(failures), signal);
            continue;
          } else throw error;
        }
      }
      if (!bad) {
        const actual = await sizeOf(part);
        bad = (file.size !== null && actual !== file.size) || (await sha256File(part)) !== file.sha256;
      }
      if (!bad) {
        await fs.rename(part, final);
        return;
      }
      await truncate(part, onBytes, await sizeOf(part));
      // The resumed file does not match: the old `.part` may be bad, so download again from the start.
      if (resumed && !cleanRetried) {
        cleanRetried = true;
        resumed = false;
        continue;
      }
      throw new DownloadError('MODEL_DOWNLOAD_INTEGRITY', M.integrityMismatch({ file: file.path }), {
        file: file.path,
        expectedSha256: file.sha256,
        ...(file.size !== null ? { expectedSize: file.size } : {}),
      });
    }
  }

  async #fetchInto(
    part: string,
    url: string,
    offset: number,
    file: DownloadFile,
    signal: AbortSignal,
    onBytes: (delta: number) => void,
  ): Promise<void> {
    const attempt = new AbortController();
    const onAbort = () => attempt.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        attempt.abort(new Error('stalled'));
      }, this.#stallMs);
    };
    const request = async (from: number): Promise<Response> => {
      try {
        return await this.#fetch(url, {
          headers: from > 0 ? { Range: `bytes=${from}-` } : {},
          signal: attempt.signal,
          redirect: 'follow',
        });
      } catch {
        if (signal.aborted) throw signal.reason;
        throw new Retryable(stalled ? 'stalled' : 'connect');
      }
    };
    try {
      arm();
      let response = await request(offset);
      if (offset > 0 && (response.status === 200 || (response.status >= 500 && offset <= RESTART_BELOW))) {
        // The source did not return the range requested with Range: discard the existing partial and request from the start.
        await response.body?.cancel().catch(() => {});
        await truncate(part, onBytes, offset);
        offset = 0;
        response = await request(0);
      }
      const status = response.status;
      let start = 0;
      if (status === 206) {
        const range = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(response.headers.get('content-range') ?? '');
        if (!range || Number(range[1]) !== offset) {
          await response.body?.cancel().catch(() => {});
          await truncate(part, onBytes, offset);
          throw new Retryable('range-mismatch', status);
        }
        start = offset;
      } else if (status === 200) {
        // Write from the start (resume requests that got 200 had their Range dropped and were re-requested above).
      } else if (status === 416) {
        await response.body?.cancel().catch(() => {});
        // Fully received (when the size is unknown, sha256 decides); otherwise start over.
        if (file.size === null || offset === file.size) return;
        await truncate(part, onBytes, offset);
        throw new Retryable('range-not-satisfiable', status);
      } else {
        await response.body?.cancel().catch(() => {});
        if (status === 429 || status >= 500) throw new Retryable(`HTTP ${status}`, status);
        throw new DownloadError('MODEL_DOWNLOAD_SOURCE', M.sourceHttp({ file: file.path, status }), { file: file.path, status });
      }
      const length = Number(response.headers.get('content-length') ?? NaN);
      const expected = Number.isFinite(length) ? start + length : null;
      if (file.size !== null && expected !== null && expected > file.size) {
        await response.body?.cancel().catch(() => {});
        throw new Oversize();
      }
      const handle = await fs.open(part, start > 0 ? 'a' : 'w');
      let written = start;
      try {
        if (!response.body) throw new Retryable('empty-body', status);
        try {
          for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
            arm();
            if (file.size !== null && written + chunk.byteLength > file.size) throw new Oversize();
            try {
              await handle.write(chunk);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
                throw new DownloadError('MODEL_DOWNLOAD_NO_SPACE', M.diskFull(), { file: file.path });
              }
              throw error;
            }
            written += chunk.byteLength;
            onBytes(chunk.byteLength);
          }
        } catch (error) {
          if (error instanceof Oversize || error instanceof DownloadError) throw error;
          if (signal.aborted) throw signal.reason;
          throw new Retryable(stalled ? 'stalled' : 'stream-broken', status);
        }
      } finally {
        await handle.close();
      }
      if (expected !== null && written < expected) throw new Retryable('truncated', status);
    } finally {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }
}

/** Default free space: `statfs` on the nearest existing parent directory; null if it cannot be determined. */
export async function diskFreeBytes(dir: string): Promise<number | null> {
  let current = path.resolve(dir);
  for (;;) {
    try {
      const stats = await fs.statfs(current);
      return Number(stats.bavail) * Number(stats.bsize);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

async function truncate(part: string, onBytes: (delta: number) => void, bytes: number): Promise<void> {
  await fs.rm(part, { force: true });
  if (bytes > 0) onBytes(-bytes);
}

async function sizeOf(file: string): Promise<number> {
  const stat = await fs.stat(file).catch(() => null);
  return stat?.isFile() ? stat.size : 0;
}

async function exists(file: string): Promise<boolean> {
  return (await fs.stat(file).catch(() => null)) !== null;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { refOf, type Localized, type MessageRef } from '@cuccut/protocol';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';

/**
 * Single-file download for a managed tool (architecture design §12.9): written to `<file>.part`, and handed over only after the size and sha256 are checked.
 *
 * - Resume: when `.part` already has n bytes, send `Range: bytes=n-`. A 206 whose `Content-Range` starts at n continues writing; a 200 means the source does not support resume, so write from the start.
 * - Connection failures, 5xx, 429, and reads cut off midway retry with bounded backoff. 404, 401, and 403 are not retried.
 * - If a resumed file does not match, delete it and download again from the start. If the download from the start still does not match, it is a verification failure (the bad file is deleted).
 * - Cancel (signal abort) stops at once and leaves `.part` in place, so the next run resumes.
 */

export type ToolDownloadErrorCode = 'TOOL_DOWNLOAD_NO_SPACE' | 'TOOL_DOWNLOAD_NETWORK' | 'TOOL_DOWNLOAD_INTEGRITY' | 'TOOL_DOWNLOAD_SOURCE';

/** The remedy text for each error code (in the current language). */
export function toolDownloadRemedy(code: ToolDownloadErrorCode): Localized {
  switch (code) {
    case 'TOOL_DOWNLOAD_NO_SPACE':
      return RcExternalTools.remedyNoSpace();
    case 'TOOL_DOWNLOAD_NETWORK':
      return RcExternalTools.remedyNetwork();
    case 'TOOL_DOWNLOAD_INTEGRITY':
      return RcExternalTools.remedyIntegrity();
    case 'TOOL_DOWNLOAD_SOURCE':
      return RcExternalTools.remedySource();
  }
}

/** The remedy text for each error code: generated at read time in the current language. */
export const TOOL_DOWNLOAD_REMEDIES: Readonly<Record<ToolDownloadErrorCode, string>> = {
  get TOOL_DOWNLOAD_NO_SPACE() {
    return toolDownloadRemedy('TOOL_DOWNLOAD_NO_SPACE').text;
  },
  get TOOL_DOWNLOAD_NETWORK() {
    return toolDownloadRemedy('TOOL_DOWNLOAD_NETWORK').text;
  },
  get TOOL_DOWNLOAD_INTEGRITY() {
    return toolDownloadRemedy('TOOL_DOWNLOAD_INTEGRITY').text;
  },
  get TOOL_DOWNLOAD_SOURCE() {
    return toolDownloadRemedy('TOOL_DOWNLOAD_SOURCE').text;
  },
};

export class ToolDownloadError extends Error {
  readonly code: ToolDownloadErrorCode;
  readonly remedy: string;
  readonly remedyRef: MessageRef;
  readonly messageRef: MessageRef | undefined;
  readonly details: Record<string, unknown>;

  constructor(code: ToolDownloadErrorCode, message: string | Localized, details: Record<string, unknown> = {}) {
    super(String(message));
    this.name = 'ToolDownloadError';
    this.code = code;
    const remedy = toolDownloadRemedy(code);
    this.remedy = remedy.text;
    this.remedyRef = refOf(remedy);
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
    this.details = details;
  }
}

export interface ToolDownloadOptions {
  fetch?: typeof fetch;
  /** Gives up after this many consecutive failures (default 3). */
  retries?: number;
  backoffMs?: (attempt: number) => number;
  /** How long without receiving bytes counts as a stall (default 60 seconds). */
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

/** Downloads `url` into `part`; the file stays in `part` after verification (the caller publishes it by renaming). `onBytes` receives the byte count so far. */
export async function downloadToolFile(
  url: string,
  part: string,
  expected: { size: number | null; sha256: string; fileName: string },
  run: { signal: AbortSignal; onBytes: (received: number) => void },
  options: ToolDownloadOptions = {},
): Promise<void> {
  const fetchImpl = options.fetch ?? fetch;
  const retries = options.retries ?? 3;
  const backoff = options.backoffMs ?? ((attempt: number) => Math.min(8_000, 1_000 * 2 ** (attempt - 1)));
  const stallMs = options.stallMs ?? 60_000;
  const { signal } = run;
  let failures = 0;
  let resumed = false;
  let cleanRetried = false;
  for (;;) {
    signal.throwIfAborted();
    let offset = await sizeOf(part);
    if (expected.size !== null && offset > expected.size) {
      await fs.rm(part, { force: true });
      offset = 0;
    }
    if (offset > 0) resumed = true;
    run.onBytes(offset);
    if (expected.size === null || offset < expected.size) {
      try {
        await fetchInto(fetchImpl, url, part, offset, expected, run, stallMs);
      } catch (error) {
        if (signal.aborted) throw signal.reason ?? error;
        if (!(error instanceof Retryable)) throw error;
        failures = (await sizeOf(part)) > offset ? 1 : failures + 1;
        if (failures > retries) {
          throw new ToolDownloadError('TOOL_DOWNLOAD_NETWORK', RcExternalTools.downloadFailed({ file: expected.fileName, reason: error.reason }), {
            file: expected.fileName,
            reason: error.reason,
            ...(error.status !== null ? { status: error.status } : {}),
            attempts: failures,
          });
        }
        await sleep(backoff(failures), signal);
        continue;
      }
    }
    const size = await sizeOf(part);
    if ((expected.size === null || size === expected.size) && (await sha256File(part)) === expected.sha256) return;
    await fs.rm(part, { force: true });
    if (resumed && !cleanRetried) {
      cleanRetried = true;
      resumed = false;
      continue;
    }
    throw new ToolDownloadError('TOOL_DOWNLOAD_INTEGRITY', RcExternalTools.integrityMismatch({ file: expected.fileName }), {
      file: expected.fileName,
      expectedSha256: expected.sha256,
      ...(expected.size !== null ? { expectedSize: expected.size } : {}),
    });
  }
}

async function fetchInto(
  fetchImpl: typeof fetch,
  url: string,
  part: string,
  offset: number,
  expected: { size: number | null; fileName: string },
  run: { signal: AbortSignal; onBytes: (received: number) => void },
  stallMs: number,
): Promise<void> {
  const { signal } = run;
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
    }, stallMs);
  };
  try {
    arm();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: offset > 0 ? { Range: `bytes=${offset}-` } : {},
        signal: attempt.signal,
        redirect: 'follow',
      });
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new Retryable(stalled ? 'stalled' : 'connect');
    }
    const status = response.status;
    let start = 0;
    if (status === 206) {
      const range = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(response.headers.get('content-range') ?? '');
      if (!range || Number(range[1]) !== offset) {
        await response.body?.cancel().catch(() => {});
        await fs.rm(part, { force: true });
        throw new Retryable('range-mismatch', status);
      }
      start = offset;
    } else if (status === 416) {
      await response.body?.cancel().catch(() => {});
      if (expected.size === null || offset === expected.size) return;
      await fs.rm(part, { force: true });
      throw new Retryable('range-not-satisfiable', status);
    } else if (status !== 200) {
      await response.body?.cancel().catch(() => {});
      if (status === 429 || status >= 500) throw new Retryable(`HTTP ${status}`, status);
      throw new ToolDownloadError('TOOL_DOWNLOAD_SOURCE', RcExternalTools.sourceHttpStatus({ file: expected.fileName, status }), {
        file: expected.fileName,
        status,
      });
    }
    const handle = await fs.open(part, start > 0 ? 'a' : 'w');
    let written = start;
    try {
      if (!response.body) throw new Retryable('empty-body', status);
      try {
        for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
          arm();
          if (expected.size !== null && written + chunk.byteLength > expected.size) {
            throw new ToolDownloadError('TOOL_DOWNLOAD_INTEGRITY', RcExternalTools.largerThanManifest({ file: expected.fileName }), {
              file: expected.fileName,
              expectedSize: expected.size,
            });
          }
          try {
            await handle.write(chunk);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
              throw new ToolDownloadError('TOOL_DOWNLOAD_NO_SPACE', RcExternalTools.diskFull(), { file: expected.fileName });
            }
            throw error;
          }
          written += chunk.byteLength;
          run.onBytes(written);
        }
      } catch (error) {
        if (error instanceof ToolDownloadError) throw error;
        if (signal.aborted) throw signal.reason;
        throw new Retryable(stalled ? 'stalled' : 'stream-broken', status);
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    // Larger than the manifest: delete the bad file so it is not left for resume.
    if (error instanceof ToolDownloadError && error.code === 'TOOL_DOWNLOAD_INTEGRITY') await fs.rm(part, { force: true });
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function sizeOf(file: string): Promise<number> {
  const stat = await fs.stat(file).catch(() => null);
  return stat?.isFile() ? stat.size : 0;
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

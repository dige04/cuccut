import type { MediaPeaks, MediaThumbnail, VersionRef } from '@cuccut/protocol';
import { decodePeaks, peakScale } from '../model/clip-media.ts';

/** Decoded waveform peaks. `scale` is the magnification used for display (see `peakScale`). */
export interface Peaks {
  binsPerSecond: number;
  peaks: Uint8Array;
  scale: number;
}

export type PeaksState = { state: 'loading' } | { state: 'ready'; value: Peaks } | { state: 'no-audio' } | { state: 'failed' };

export interface MediaAnalysisRequests {
  peaks(asset: VersionRef): Promise<MediaPeaks>;
  thumbnail(asset: VersionRef, at: number): Promise<MediaThumbnail>;
}

export interface MediaAnalysisCacheOptions {
  now?: () => number;
  /** Deferred execution (polling peaks, coalescing notifications). */
  schedule?: (run: () => void, ms: number) => void;
  /** Thumbnail requests in flight at the same time. */
  concurrency?: number;
  /** Maximum number of thumbnails remembered (data URLs, a few KB each). */
  maxThumbnails?: number;
  /** At most this many thumbnails may be queued; beyond that the earliest-queued are dropped (they are queued again next time they are drawn, if still visible). */
  maxQueue?: number;
}

type PeaksEntry =
  | { state: 'loading' }
  | { state: 'ready'; value: Peaks }
  | { state: 'no-audio' }
  | { state: 'failed'; at: number; failures: number; retrying: boolean };

type ThumbnailEntry =
  | { state: 'queued'; asset: VersionRef; assetKey: string; at: number }
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  | { state: 'failed'; at: number };

/** After a failed peaks fetch, wait this long before fetching again; the delay doubles on each failure, up to one minute (same as `AssetCache`). */
const RETRY_MS = 3000;
const RETRY_MAX_MS = 60_000;
/** After a thumbnail fails, wait this long before requesting it again. */
const THUMBNAIL_RETRY_MS = 15_000;
/** If an asset has not yielded a single thumbnail and fails this many times in a row, stop requesting thumbnails for it (for example, when there is no decoder). */
const THUMBNAIL_DEAD_AFTER = 4;
/** Coalesced notification: when a batch of thumbnails arrives, redraw only once. */
const NOTIFY_MS = 30;

/**
 * Cache of media analysis results (the timeline's waveforms and filmstrips). The Runtime computes the results (`media.peaks`, `media.thumbnail`);
 * the content of an asset version never changes, so it is remembered under “asset@version” and cleared when the video changes.
 *
 * - `peaks` / `thumbnail` are called during rendering: if there is no result, fetch it; when it arrives, notify subscribers to redraw.
 * - While peaks are still being computed, the Runtime replies `pending`, and the caller asks again after the interval it gives.
 * - Thumbnails needed first are fetched first (the cells that just scrolled into view), with only a few requests sent at once; the number of remembered thumbnails is capped, and the least recently used are dropped first.
 */
export class MediaAnalysisCache {
  readonly #requests: MediaAnalysisRequests;
  readonly #now: () => number;
  readonly #schedule: (run: () => void, ms: number) => void;
  readonly #concurrency: number;
  readonly #maxThumbnails: number;
  readonly #maxQueue: number;
  readonly #peaks = new Map<string, PeaksEntry>();
  readonly #thumbnails = new Map<string, ThumbnailEntry>();
  readonly #health = new Map<string, { ok: number; failures: number }>();
  readonly #queue: string[] = [];
  readonly #listeners = new Set<() => void>();
  #running = 0;
  #generation = 0;
  #version = 0;
  #notifying = false;

  constructor(requests: MediaAnalysisRequests, options: MediaAnalysisCacheOptions = {}) {
    this.#requests = requests;
    this.#now = options.now ?? (() => performance.now());
    this.#schedule = options.schedule ?? ((run, ms) => void setTimeout(run, ms));
    this.#concurrency = options.concurrency ?? 3;
    this.#maxThumbnails = options.maxThumbnails ?? 1500;
    this.#maxQueue = options.maxQueue ?? 200;
  }

  /** The waveform peaks of an asset. */
  peaks(asset: VersionRef): PeaksState {
    const key = assetKeyOf(asset);
    const entry = this.#peaks.get(key);
    if (!entry) this.#loadPeaks(key, asset, 0);
    else if (entry.state === 'failed' && !entry.retrying && this.#now() - entry.at >= backoff(entry.failures)) {
      entry.retrying = true;
      this.#loadPeaks(key, asset, entry.failures);
    }
    const current = this.#peaks.get(key)!;
    if (current.state === 'ready') return { state: 'ready', value: current.value };
    if (current.state === 'failed') return { state: 'failed' };
    return current.state === 'no-audio' ? { state: 'no-audio' } : { state: 'loading' };
  }

  /** Thumbnail address of the asset at source time `at` (seconds); returns null and fetches if there is none yet. */
  thumbnail(asset: VersionRef, at: number): string | null {
    const assetKey = assetKeyOf(asset);
    const health = this.#health.get(assetKey);
    if (health && health.ok === 0 && health.failures >= THUMBNAIL_DEAD_AFTER) return null;
    const key = `${assetKey}#${Math.round(at * 1000)}`;
    const entry = this.#thumbnails.get(key);
    if (entry?.state === 'ready') {
      // Move recently used items to the end; when over the limit, drop from the front.
      this.#thumbnails.delete(key);
      this.#thumbnails.set(key, entry);
      return entry.url;
    }
    if (entry && (entry.state !== 'failed' || this.#now() - entry.at < THUMBNAIL_RETRY_MS)) return null;
    this.#thumbnails.set(key, { state: 'queued', asset, assetKey, at });
    this.#queue.push(key);
    while (this.#queue.length > this.#maxQueue) {
      const dropped = this.#queue.shift()!;
      if (this.#thumbnails.get(dropped)?.state === 'queued') this.#thumbnails.delete(dropped);
    }
    // Send a batch queued during rendering only after the whole batch has been queued.
    queueMicrotask(() => this.#pump());
    return null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Incremented on each notification (for `useSyncExternalStore`). */
  version = (): number => this.#version;

  /** Video changed: drop everything; in-flight requests are ignored when they return. */
  clear(): void {
    this.#generation++;
    this.#peaks.clear();
    this.#thumbnails.clear();
    this.#health.clear();
    this.#queue.length = 0;
  }

  #loadPeaks(key: string, asset: VersionRef, failures: number): void {
    const generation = this.#generation;
    if (!this.#peaks.has(key)) this.#peaks.set(key, { state: 'loading' });
    this.#requests.peaks(asset).then(
      (result) => {
        if (generation !== this.#generation) return;
        if (result.status === 'pending') {
          const delay = Math.min(5000, Math.max(250, result.retryAfterMs));
          this.#schedule(() => {
            if (generation === this.#generation) this.#loadPeaks(key, asset, failures);
          }, delay);
          return;
        }
        if (result.status === 'no-audio') this.#peaks.set(key, { state: 'no-audio' });
        else {
          const peaks = decodePeaks(result.peaks);
          this.#peaks.set(key, { state: 'ready', value: { binsPerSecond: result.binsPerSecond, peaks, scale: peakScale(peaks) } });
        }
        this.#notify();
      },
      () => {
        if (generation !== this.#generation) return;
        this.#peaks.set(key, { state: 'failed', at: this.#now(), failures: failures + 1, retrying: false });
        this.#notify();
      },
    );
  }

  #pump(): void {
    while (this.#running < this.#concurrency && this.#queue.length) {
      const key = this.#queue.pop()!;
      const entry = this.#thumbnails.get(key);
      if (entry?.state !== 'queued') continue;
      const { asset, assetKey, at } = entry;
      const generation = this.#generation;
      this.#thumbnails.set(key, { state: 'loading' });
      this.#running++;
      this.#requests
        .thumbnail(asset, at)
        .then(
          (result) => {
            if (generation !== this.#generation) return;
            this.#thumbnails.set(key, { state: 'ready', url: `data:${result.mimeType};base64,${result.data}` });
            this.#healthOf(assetKey).ok++;
            this.#evict();
          },
          () => {
            if (generation !== this.#generation) return;
            this.#thumbnails.set(key, { state: 'failed', at: this.#now() });
            this.#healthOf(assetKey).failures++;
          },
        )
        .finally(() => {
          this.#running--;
          this.#notify();
          this.#pump();
        });
    }
  }

  #healthOf(assetKey: string): { ok: number; failures: number } {
    let health = this.#health.get(assetKey);
    if (!health) this.#health.set(assetKey, (health = { ok: 0, failures: 0 }));
    return health;
  }

  #evict(): void {
    if (this.#thumbnails.size <= this.#maxThumbnails) return;
    for (const [key, entry] of this.#thumbnails) {
      if (this.#thumbnails.size <= this.#maxThumbnails) break;
      if (entry.state === 'ready' || entry.state === 'failed') this.#thumbnails.delete(key);
    }
  }

  #notify(): void {
    if (this.#notifying) return;
    this.#notifying = true;
    this.#schedule(() => {
      this.#notifying = false;
      this.#version++;
      for (const listener of this.#listeners) listener();
    }, NOTIFY_MS);
  }
}

function assetKeyOf(asset: VersionRef): string {
  return `${asset.id}@${asset.revision}`;
}

function backoff(failures: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.max(0, failures - 1));
}

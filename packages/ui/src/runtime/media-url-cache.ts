import type { Id, MediaHandle, VersionRef } from '@cuccut/protocol';

type Entry = { state: 'pending'; promise: Promise<MediaHandle>; generation: number; controller: AbortController } | { state: 'ready'; handle: MediaHandle };

/** If a handle expires within this much time, treat it as already expired and request a new one (same margin as for handles of images already sent). */
const FRESH_MARGIN_MS = 60_000;

export interface MediaUrlCacheOptions {
  now?: () => number;
}

/** Fetch an address: on each poll while the Runtime prepares a compatible copy, `onProgress` reports how far encoding has got (0–1; null when not yet known). */
export type ResolveMedia = (videoId: Id, asset: VersionRef, signal: AbortSignal, onProgress: (progress: number | null) => void) => Promise<MediaHandle>;

/** An asset whose compatible copy is being prepared (the conversion step of “preview loading and stalls” in product design §5.1). */
export interface MediaPreparation {
  assetId: Id;
  revision: string;
  /** How far encoding has got (0–1); null while the Runtime does not know yet. */
  progress: number | null;
}

/** Cache key: “video:asset@version”. */
export function mediaUrlKey(videoId: Id, asset: VersionRef): string {
  return `${videoId}:${asset.id}@${asset.revision}`;
}

/**
 * Media addresses (`media.resolve` handles) for the current video's assets, remembered under “video:asset@version” and shared by the preview, the asset panel and the asset preview.
 * On the timeline, thousands of voice-over clips are often the same asset: elements mounted at the same moment send only one request (what is remembered is the in-flight request, not just the result).
 *
 * - Failures are not remembered: a failed in-flight request is deleted, everyone waiting on it gets the same error, and the next request sends again.
 * - A handle that expires within one minute is no longer used; a new one is requested.
 * - When an address cannot be played, `invalidate` deletes it only if the remembered address is still that one (the first to report the error deletes it and requests again; the rest follow the new request).
 * - `clear` runs when the video is closed or the Runtime reconnects (old handles become invalid with the Runtime); in-flight requests are ignored when they return.
 * - While an in-flight request waits for the Runtime to prepare a compatible copy, its progress (`progress`, `preparing`) is recorded, and subscribers are notified when it changes; the record is deleted when the request finishes or is dropped.
 *   A dropped request keeps polling, but the progress it reports is ignored.
 */
export class MediaUrlCache {
  readonly #resolve: ResolveMedia;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();
  /** Assets whose compatible copies are being prepared (keyed the same as `#entries`), in the order preparation started. */
  readonly #preparing = new Map<string, MediaPreparation & { videoId: Id }>();
  readonly #listeners = new Set<() => void>();
  #generation = 0;

  constructor(resolve: ResolveMedia, options: MediaUrlCacheOptions = {}) {
    this.#resolve = resolve;
    this.#now = options.now ?? (() => Date.now());
  }

  /** Addresses already fetched that are not close to expiring (read synchronously during rendering); null if none. */
  peek(videoId: Id, asset: VersionRef): string | null {
    const entry = this.#entries.get(mediaUrlKey(videoId, asset));
    return entry?.state === 'ready' && this.#fresh(entry.handle) ? entry.handle.url : null;
  }

  /** How far the compatible copy of this asset has been encoded (0–1; null while the Runtime does not know yet); undefined if it is not being prepared. */
  progress(videoId: Id, asset: VersionRef): number | null | undefined {
    return this.#preparing.get(mediaUrlKey(videoId, asset))?.progress;
  }

  /** Assets of this video whose compatible copies are being prepared, in the order preparation started. */
  preparing(videoId: Id): MediaPreparation[] {
    return [...this.#preparing.values()]
      .filter((p) => p.videoId === videoId)
      .map(({ assetId, revision, progress }) => ({ assetId, revision, progress }));
  }

  /** Notifies when preparation progress changes (started, advanced, finished, dropped); returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Address: return a fresh one directly; if a request is in flight, wait for it; otherwise send one. */
  async get(videoId: Id, asset: VersionRef): Promise<string> {
    const key = mediaUrlKey(videoId, asset);
    const entry = this.#entries.get(key);
    if (entry?.state === 'ready' && this.#fresh(entry.handle)) return entry.handle.url;
    if (entry?.state === 'pending') return (await entry.promise).url;
    return (await this.#load(key, videoId, asset)).url;
  }

  /** A media element cannot play `failedUrl`: delete it only if it is still the remembered address; do nothing if a new address has already replaced it or a new request is in progress. */
  invalidate(videoId: Id, asset: VersionRef, failedUrl: string): void {
    const key = mediaUrlKey(videoId, asset);
    const entry = this.#entries.get(key);
    if (entry?.state === 'ready' && entry.handle.url === failedUrl) this.#entries.delete(key);
  }

  /**
   * The “retry” when a preview is stuck: drop all addresses remembered for this video (fetched and in-flight); the next request is sent anew, and in-flight responses are ignored when they return.
   * Media elements already mounted keep using the address they have, unaffected.
   */
  forgetVideo(videoId: Id): void {
    const prefix = `${videoId}:`;
    for (const key of [...this.#entries.keys()]) if (key.startsWith(prefix)) this.#entries.delete(key);
    let dropped = false;
    for (const key of [...this.#preparing.keys()]) if (key.startsWith(prefix)) dropped = this.#preparing.delete(key) || dropped;
    if (dropped) this.#emit();
  }

  /** Video closed or Runtime reconnected: drop everything; in-flight requests are ignored when they return. */
  clear(): void {
    this.#generation++;
    for (const entry of this.#entries.values()) if (entry.state === 'pending') entry.controller.abort();
    this.#entries.clear();
    if (this.#preparing.size > 0) {
      this.#preparing.clear();
      this.#emit();
    }
  }

  #load(key: string, videoId: Id, asset: VersionRef): Promise<MediaHandle> {
    const controller = new AbortController();
    let entry: Entry | null = null;
    // Accept progress only from the one request still remembered; a dropped request keeps polling.
    const onProgress = (progress: number | null) => {
      if (!entry || this.#entries.get(key) !== entry) return;
      const known = this.#preparing.get(key);
      if (known && known.progress === progress) return;
      this.#preparing.set(key, { videoId, assetId: asset.id, revision: asset.revision, progress });
      this.#emit();
    };
    const promise = this.#resolve(videoId, asset, controller.signal, onProgress);
    const current: Entry = { state: 'pending', promise, generation: this.#generation, controller };
    entry = current;
    this.#entries.set(key, current);
    const settle = () => {
      if (this.#entries.get(key) === current && this.#preparing.delete(key)) this.#emit();
    };
    promise.then(
      (handle) => {
        settle();
        if (current.generation === this.#generation && this.#entries.get(key) === current) this.#entries.set(key, { state: 'ready', handle });
      },
      () => {
        settle();
        if (this.#entries.get(key) === current) this.#entries.delete(key);
      },
    );
    return promise;
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }

  #fresh(handle: MediaHandle): boolean {
    return Date.parse(handle.expiresAt) - this.#now() > FRESH_MARGIN_MS;
  }
}

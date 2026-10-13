import type { VersionRef } from '@cuccut/protocol';
import { RT } from './runtime-copy.ts';

/** How asset bytes become usable things (Lottie animations, spectrums, …); `release` is called when the cache drops it. */
interface Decoder<T> {
  readonly name: string;
  decode(response: Response): Promise<T>;
  release?(value: T): void;
}

type Entry =
  | { state: 'loading' }
  | { state: 'ready'; value: unknown; release: () => void }
  | { state: 'failed'; message: string; at: number; failures: number; retrying: boolean };

export type AssetState<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed'; message: string };

/** After a failed fetch, wait this long before fetching again. The delay doubles on each failure, up to one minute (the Runtime fails for a while when it restarts). */
const RETRY_MS = 3000;
const RETRY_MAX_MS = 60_000;

export interface AssetCacheOptions {
  fetch?: (url: string) => Promise<Response>;
  now?: () => number;
}

/**
 * Cache of asset contents: the bytes of one asset version never change, so the decoded result is remembered under “decoder:asset@version” and shared across all previews.
 * The media address is requested fresh before each fetch (handles expire); when a fetch completes, subscribers are notified to redraw.
 */
export class AssetCache {
  readonly #resolve: (asset: VersionRef) => Promise<string>;
  readonly #fetch: (url: string) => Promise<Response>;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();
  readonly #listeners = new Set<() => void>();
  #generation = 0;

  constructor(resolve: (asset: VersionRef) => Promise<string>, options: AssetCacheOptions = {}) {
    this.#resolve = resolve;
    this.#fetch = options.fetch ?? ((url) => fetch(url));
    this.#now = options.now ?? (() => performance.now());
  }

  /** The decoded content; if there is none yet, fetch it (callable during React rendering and frame drawing). While retrying after a failure it still reports failure, so it does not flicker between the two states. */
  get<T>(asset: VersionRef, decoder: Decoder<T>): AssetState<T> {
    const k = `${decoder.name}:${asset.id}@${asset.revision}`;
    const entry = this.#entries.get(k);
    if (!entry) this.#load(k, asset, decoder, 0);
    else if (entry.state === 'failed' && !entry.retrying && this.#now() - entry.at >= backoff(entry.failures)) {
      entry.retrying = true;
      this.#load(k, asset, decoder, entry.failures);
    }
    const current = this.#entries.get(k)!;
    if (current.state === 'ready') return { state: 'ready', value: current.value as T };
    if (current.state === 'failed') return { state: 'failed', message: current.message };
    return { state: 'loading' };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Video changed: release all decoded content; in-flight requests are ignored when they return. */
  clear(): void {
    this.#generation++;
    for (const entry of this.#entries.values()) if (entry.state === 'ready') entry.release();
    this.#entries.clear();
  }

  /** Forget in-flight requests (the “retry” when a preview is stuck): the next request is sent anew, and in-flight responses are ignored when they return; decoded content is kept. */
  forgetPending(): void {
    for (const [k, entry] of [...this.#entries]) {
      if (entry.state === 'loading' || (entry.state === 'failed' && entry.retrying)) this.#entries.delete(k);
    }
  }

  #load<T>(k: string, asset: VersionRef, decoder: Decoder<T>, failures: number): void {
    const generation = this.#generation;
    if (!this.#entries.has(k)) this.#entries.set(k, { state: 'loading' });
    // This in-flight request: once it is forgotten by `forgetPending` (or replaced by a new one), its response is ignored when it returns.
    const pending = this.#entries.get(k);
    this.#resolve(asset)
      .then((url) => this.#fetch(url))
      .then((response) => {
        if (!response.ok) throw new Error(RT.mediaStatus(response.status));
        return decoder.decode(response);
      })
      .then(
        (value) => {
          const release = () => decoder.release?.(value);
          if (generation !== this.#generation || this.#entries.get(k) !== pending) release();
          else this.#settle(k, { state: 'ready', value, release });
        },
        (error: unknown) => {
          if (generation !== this.#generation || this.#entries.get(k) !== pending) return;
          const message = error instanceof Error ? error.message : String(error);
          this.#settle(k, { state: 'failed', message, at: this.#now(), failures: failures + 1, retrying: false });
        },
      );
  }

  #settle(k: string, entry: Entry): void {
    this.#entries.set(k, entry);
    for (const listener of this.#listeners) listener();
  }
}

function backoff(failures: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.max(0, failures - 1));
}

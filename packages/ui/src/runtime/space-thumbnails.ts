import { RpcError, type Id, type SpaceEntryKind, type SpaceThumbnail } from '@cuccut/protocol';
import { NO_THUMBNAIL, toThumbnail, type Thumbnail } from '../model/space-thumbnail.ts';

export interface SpaceThumbnailCacheOptions {
  now?: () => number;
  /** Deferred execution (failure retries, video re-checks, coalesced notifications). */
  schedule?: (run: () => void, ms: number) => void;
  /** Requests in flight at the same time. */
  concurrency?: number;
  /** Maximum number of entry thumbnails remembered (data URLs, a few tens of KB each). */
  maxEntries?: number;
  /** At most this many queued: beyond that, the earliest-queued are dropped (if still visible, they are queued again when the version changes or they are mounted again). */
  maxQueue?: number;
}

interface Slot {
  kind: SpaceEntryKind;
  /** The version wanted now (`thumbnailVersion`). */
  version: string;
  /** The most recently received thumbnail; when the version changes and the new one has not arrived yet, the old one is drawn first, so the placeholder does not flash back. */
  value: Thumbnail | null;
  phase: 'idle' | 'queued' | 'loading' | 'done' | 'failed';
  failures: number;
  /** How many times the video has been re-checked after answering `none`. */
  rechecks: number;
  /** How many cards or rows are mounted; when 0, queued requests are no longer sent. */
  interest: number;
}

/** After one failure, request again immediately (most often a timeout: the Runtime still finishes computing and caches the result, so a second request hits the cache); after that, wait this long, doubling each time. */
const RETRY_MS = 15_000;
/** After this many consecutive failures, stop requesting until the entry changes. */
const DEAD_AFTER = 4;
/** While a video's content index has not caught up, the Runtime answers `none`, and even after it catches up there may still be no `entry.upsert`: re-check after a while, up to this many times. */
const VIDEO_RECHECK_MS = 20_000;
const VIDEO_RECHECKS = 2;
/** Coalesced notification: when a batch of thumbnails arrives, redraw only once. */
const NOTIFY_MS = 30;

/**
 * Cache of Space entry thumbnails (`space.thumbnail`; the grid cards and the name column of the list). Remembered per entry; re-fetched when the entry's version changes.
 *
 * - `retain` when a card or row is mounted, and release it when unmounted; only fetch for mounted ones (the list is virtualized, so mounted roughly means visible). Those still queued after scrolling away are no longer sent.
 * - Those queued later are fetched first (the rows just scrolled into view), with only a few requests sent at once and a cap on the queue length; there is a cap on remembered entries, and the least recently used are dropped first.
 * - `not-found` and `forbidden` are treated as no thumbnail and not retried; other failures are requested again immediately once, then back off, and give up if several attempts fail.
 */
export class SpaceThumbnailCache {
  readonly #request: (entryId: Id) => Promise<SpaceThumbnail>;
  readonly #schedule: (run: () => void, ms: number) => void;
  readonly #concurrency: number;
  readonly #maxEntries: number;
  readonly #maxQueue: number;
  readonly #slots = new Map<Id, Slot>();
  readonly #queue: Id[] = [];
  readonly #listeners = new Set<() => void>();
  #running = 0;
  #generation = 0;
  #version = 0;
  #notifying = false;

  constructor(request: (entryId: Id) => Promise<SpaceThumbnail>, options: SpaceThumbnailCacheOptions = {}) {
    this.#request = request;
    this.#schedule = options.schedule ?? ((run, ms) => void setTimeout(run, ms));
    this.#concurrency = options.concurrency ?? 4;
    this.#maxEntries = options.maxEntries ?? 300;
    this.#maxQueue = options.maxQueue ?? 120;
  }

  /** The thumbnail the entry can draw right now (possibly the previous version); null if none yet. Sends no request; the same result returns the same object. */
  peek(entryId: Id): Thumbnail | null {
    return this.#slots.get(entryId)?.value ?? null;
  }

  /** When a card or row is mounted: request the thumbnail for this version. Returns the release function. */
  retain(entryId: Id, kind: SpaceEntryKind, version: string): () => void {
    let slot = this.#slots.get(entryId);
    if (slot) {
      // Move recently used items to the end; when over the limit, drop from the front.
      this.#slots.delete(entryId);
      this.#slots.set(entryId, slot);
    } else {
      slot = {
        kind,
        version,
        value: null,
        phase: 'idle',
        failures: 0,
        rechecks: 0,
        interest: 0,
      };
      this.#slots.set(entryId, slot);
    }
    slot.interest++;
    if (slot.version !== version) {
      slot.kind = kind;
      slot.version = version;
      slot.failures = 0;
      slot.rechecks = 0;
      if (slot.phase !== 'loading' && slot.phase !== 'queued') slot.phase = 'idle';
    }
    if (slot.phase === 'idle') this.#enqueue(entryId, slot);
    else if (slot.phase === 'queued') this.#prioritise(entryId);
    this.#evict();
    const held = slot;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      held.interest = Math.max(0, held.interest - 1);
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Incremented on each notification (for `useSyncExternalStore`). */
  version = (): number => this.#version;

  /**
   * Reconnected to the Runtime: failures during the disconnect do not count (the requests were rejected before they were sent), and those given up on are requested again.
   * Already-received thumbnails are still drawn and not fetched again; those still mounted are queued right away, and those not mounted wait until they are mounted again.
   */
  revive(): void {
    for (const [entryId, slot] of this.#slots) {
      if (slot.phase !== 'failed') continue;
      slot.failures = 0;
      this.#requeue(entryId, slot);
    }
  }

  /** Session disconnected: drop everything; in-flight requests are ignored when they return. */
  clear(): void {
    this.#generation++;
    this.#slots.clear();
    this.#queue.length = 0;
  }

  #enqueue(entryId: Id, slot: Slot): void {
    slot.phase = 'queued';
    this.#queue.push(entryId);
    while (this.#queue.length > this.#maxQueue) {
      const dropped = this.#slots.get(this.#queue.shift()!);
      if (dropped?.phase === 'queued') dropped.phase = 'idle';
    }
    // A batch mounted in one render is queued in full before sending; those mounted later are fetched first.
    queueMicrotask(() => this.#pump());
  }

  #prioritise(entryId: Id): void {
    const at = this.#queue.lastIndexOf(entryId);
    if (at >= 0) this.#queue.splice(at, 1);
    this.#queue.push(entryId);
  }

  #pump(): void {
    while (this.#running < this.#concurrency && this.#queue.length) {
      const entryId = this.#queue.pop()!;
      const slot = this.#slots.get(entryId);
      if (slot?.phase !== 'queued') continue;
      if (slot.interest === 0) {
        // Already scrolled away: do not send; queue again when mounted again.
        slot.phase = 'idle';
        continue;
      }
      this.#load(entryId, slot);
    }
  }

  #load(entryId: Id, slot: Slot): void {
    const generation = this.#generation;
    const version = slot.version;
    slot.phase = 'loading';
    this.#running++;
    this.#request(entryId)
      .then(
        (result) => {
          if (generation !== this.#generation) return;
          slot.value = toThumbnail(result);
          if (slot.version !== version) return this.#requeue(entryId, slot);
          slot.phase = 'done';
          slot.failures = 0;
          if (slot.value.kind === 'none' && slot.kind === 'video' && slot.rechecks < VIDEO_RECHECKS) {
            slot.rechecks++;
            this.#later(entryId, slot, version, VIDEO_RECHECK_MS);
          }
        },
        (error: unknown) => {
          if (generation !== this.#generation) return;
          if (slot.version !== version) return this.#requeue(entryId, slot);
          if (error instanceof RpcError && (error.code === 'not-found' || error.code === 'forbidden')) {
            slot.value = NO_THUMBNAIL;
            slot.phase = 'done';
            return;
          }
          slot.failures++;
          slot.phase = 'failed';
          if (slot.failures === 1) this.#requeue(entryId, slot);
          else if (slot.failures < DEAD_AFTER) this.#later(entryId, slot, version, RETRY_MS * 2 ** (slot.failures - 2));
        },
      )
      .finally(() => {
        this.#running--;
        if (generation === this.#generation) this.#notify();
        this.#evict();
        this.#pump();
      });
  }

  /** The version changed in flight, or a request is made again right after a failure: if still mounted, queue again; if not, wait until it is mounted again. */
  #requeue(entryId: Id, slot: Slot): void {
    if (slot.interest > 0) this.#enqueue(entryId, slot);
    else slot.phase = 'idle';
  }

  /** Request again after a while (backoff and video re-checks): queued only if, when the time comes, the entry has not changed and is still in the cache. */
  #later(entryId: Id, slot: Slot, version: string, ms: number): void {
    const generation = this.#generation;
    this.#schedule(() => {
      if (generation !== this.#generation || this.#slots.get(entryId) !== slot || slot.version !== version) return;
      if (slot.phase !== 'done' && slot.phase !== 'failed') return;
      this.#requeue(entryId, slot);
    }, ms);
  }

  #evict(): void {
    if (this.#slots.size <= this.#maxEntries) return;
    for (const [entryId, slot] of this.#slots) {
      if (this.#slots.size <= this.#maxEntries) break;
      if (slot.interest === 0 && slot.phase !== 'loading' && slot.phase !== 'queued') this.#slots.delete(entryId);
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

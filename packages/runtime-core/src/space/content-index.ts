import fs from 'node:fs/promises';
import path from 'node:path';
import type { Id, SpaceSearchHit } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import { extractContent, type ReadContentResult } from './content-extract.ts';
import { searchSegments, type SearchableVideo, type SearchQuery } from './content-search.ts';
import { ContentStore, type StoredVideo } from './content-store.ts';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

/**
 * Cross-video content index (architecture design §5.11). A derived cache: one SQLite database (`<cache>/content-index/index.db`, see `content-store.ts`),
 * which records the video version at indexing time, the searchable segments (FTS5), and video facts (the derived state for the Space catalog; the transcripts, translations and dubbing groups that tool candidate inputs need, §7.9). A video's record and facts are kept in memory at the same time (for synchronous queries); segments live only in the database. Deleting the database file allows a rebuild; when the database's format version does not match, the database is deleted and everything is queued for re-reading.
 *
 * - Video directories come from the Space catalog's scan (`sync`); unopened videos are included too. Reads go through VideoService's read-only queries (the engine's `videos.inspect` and `videos.readContent`), not by reading `video.db` directly; they neither open the video nor take the write lock.
 * - Incremental: when a directory's modification time changes, the version is first checked with `peek`; if the version has not changed, only the new modification time is recorded. For open videos, `touched` triggers when a new version is committed.
 * - Only one video is read at a time, so that startup does not saturate the engine all at once.
 * - Videos that cannot be read (engine unavailable, old engine without `videos.readContent`, corrupt database) are recorded as failed and retried on the next change or rebuild. During search they count as “not yet indexed”, and results are marked incomplete.
 */

export interface ContentReader {
  readContent(dir: string): Promise<ReadContentResult>;
  peek(dir: string): Promise<{ videoId: Id; name: string; revision: string }>;
}

/**
 * Index record for one video (without segments; segments live only in the database): `dir` is the real path of the video directory, and `mtimeMs` is the directory's modification time at indexing time
 * (`video.db` and the WAL).
 */
export type IndexedVideo = StoredVideo;

export interface ContentIndexOptions {
  /** Cache directory: `<home>/cache/content-index`. */
  dir: string;
  reader: ContentReader | null;
  log: Logger;
}

export class ContentIndex {
  readonly #dir: string;
  readonly #reader: ContentReader | null;
  readonly #log: Logger;
  readonly #listeners = new Set<() => void>();
  /** Real path → index. */
  readonly #videos = new Map<string, IndexedVideo>();
  /** Video directories the Space catalog knows about right now: real path → modification time. */
  #wanted = new Map<string, number>();
  /** Path given by the scan → real path. */
  #aliases = new Map<string, string>();
  /** Rebuilding: the record is still there, but it must be re-read. */
  readonly #stale = new Set<string>();
  readonly #pending = new Set<string>();
  readonly #failed = new Map<string, string>();
  #current: string | null = null;
  /** Waiting for a particular video to finish reading (`ensure`). */
  readonly #waiters = new Map<string, Set<() => void>>();
  #worker: Promise<void> | null = null;
  #closed = false;
  /** The database: opened on first use; null if it cannot be opened (the index then stays in memory only, and search has no segments). */
  #store: ContentStore | null | undefined;

  constructor(options: ContentIndexOptions) {
    this.#dir = options.dir;
    this.#reader = options.reader;
    this.#log = options.log.child('content-index');
  }

  /** Notifies when a video's index completes or is removed (the Space catalog recomputes its derived state on this). Returns an unsubscribe function. */
  listen(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #changed(): void {
    for (const listener of this.#listeners) listener();
  }

  /**
   * Reads back the index left by the last run. If the database is corrupt or its format version does not match, the database is deleted and rebuilt (all videos count as unindexed and are queued on `sync`).
   * The older cache with one JSON file per video (`<digest>.json`) is simply deleted, not migrated.
   */
  async load(): Promise<void> {
    const names = await fs.readdir(this.#dir).catch(() => [] as string[]);
    for (const name of names) {
      if (name.endsWith('.json') || name.endsWith('.tmp')) await fs.rm(path.join(this.#dir, name), { force: true }).catch(() => {});
    }
    const store = this.#open();
    if (!store) return;
    try {
      for (const video of store.videos()) this.#videos.set(video.dir, video);
    } catch (error) {
      this.#log.warn("Couldn't read the content index", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  #open(): ContentStore | null {
    if (this.#store !== undefined) return this.#store;
    try {
      this.#store = new ContentStore(this.#dir);
    } catch (error) {
      this.#store = null;
      this.#log.warn("Couldn't open the content index", { error: error instanceof Error ? error.message : String(error) });
    }
    return this.#store;
  }

  /**
   * Searches these videos (in the order the caller arranged) (`content-search.ts`). Videos behind the current version still use the older segments in the database.
   * When the database cannot be opened, a read fails, or it is already closed, there are no hits (logged).
   */
  search(videos: readonly SearchableVideo[], query: SearchQuery): { hits: SpaceSearchHit[]; truncated: boolean } {
    const store = this.#closed ? null : this.#open();
    if (!store) return { hits: [], truncated: false };
    try {
      return searchSegments(store, videos, query);
    } catch (error) {
      this.#log.warn("Couldn't search the content index", { error: error instanceof Error ? error.message : String(error) });
      return { hits: [], truncated: false };
    }
  }

  /**
   * All video directories in the source directory at this moment (absolute paths and modification times from the scan). Indexes for directories not in there are deleted; new and changed ones are queued.
   */
  async sync(locations: readonly { dir: string; mtimeMs: number }[]): Promise<void> {
    // Compute the new table first and then swap it in as a whole: while real paths are being resolved, queries still see the old one.
    const wanted = new Map<string, number>();
    const aliases = new Map<string, string>();
    for (const location of locations) {
      const real = await fs.realpath(location.dir).catch(() => null);
      if (!real) continue;
      aliases.set(location.dir, real);
      wanted.set(real, location.mtimeMs);
    }
    this.#aliases = aliases;
    this.#wanted = wanted;
    const gone = [...this.#videos.keys()].filter((dir) => !wanted.has(dir));
    for (const dir of gone) {
      this.#videos.delete(dir);
      this.#stale.delete(dir);
      this.#failed.delete(dir);
    }
    const removed = gone.length > 0;
    if (removed && !this.#closed) {
      try {
        this.#open()?.remove(gone);
      } catch (error) {
        this.#log.warn("Couldn't remove videos from the content index", { error: error instanceof Error ? error.message : String(error) });
      }
    }
    for (const dir of [...this.#failed.keys()]) if (!wanted.has(dir)) this.#failed.delete(dir);
    for (const [dir, mtime] of wanted) {
      const indexed = this.#videos.get(dir);
      if (!indexed || indexed.mtimeMs !== mtime || this.#stale.has(dir)) this.#enqueue(dir);
    }
    if (removed) this.#changed();
  }

  /** An open video committed a new version (change notification from VideoService). */
  touched(given: string, revision: string): void {
    const dir = this.#aliases.get(given) ?? given;
    const indexed = this.#videos.get(dir);
    if (indexed && indexed.revision === revision) return;
    if (!this.#wanted.has(dir)) return;
    this.#enqueue(dir);
  }

  /**
   * Full rebuild: queues all videos for re-reading (without the version-comparison shortcut). When each video finishes reading, its record and segments are replaced in one transaction. Until re-reading finishes, the old records
   * can still be queried, but all count as pending indexing, and search results are marked incomplete. The Space catalog's derived state does not flicker because of it. Returns the number of videos to rebuild.
   */
  async rebuild(): Promise<number> {
    for (const dir of this.#videos.keys()) this.#stale.add(dir);
    this.#failed.clear();
    for (const dir of this.#wanted.keys()) this.#enqueue(dir);
    return this.#wanted.size;
  }

  /** The index of a video directory (path given by the scan or real path); null if there is none yet. It may be from an older version (changes are still queued). */
  at(dir: string): IndexedVideo | null {
    return this.#videos.get(this.#aliases.get(dir) ?? dir) ?? null;
  }

  /**
   * The index of this video directory, waiting for it to finish reading if necessary: when there is no index yet (or only old records awaiting rebuild), it is moved to the head of the queue and read first, then returned. Used for Space thumbnails:
   * when a card appears, only this one video is waited for, not the whole queue. If it is not in the Space directory, has failed reading before, times out, or the index is closed, it returns what it has (possibly null).
   */
  async ensure(given: string, timeoutMs = 15_000): Promise<IndexedVideo | null> {
    const dir = this.#aliases.get(given) ?? given;
    const indexed = this.#videos.get(dir) ?? null;
    if (indexed && !this.#stale.has(dir)) return indexed;
    if (this.#closed || !this.#wanted.has(dir) || this.#failed.has(dir)) return indexed;
    if (this.#current !== dir) {
      const rest = [...this.#pending].filter((other) => other !== dir);
      this.#pending.clear();
      this.#pending.add(dir);
      for (const other of rest) this.#pending.add(other);
      this.#worker ??= this.#drain().finally(() => (this.#worker = null));
    }
    await new Promise<void>((resolve) => {
      const waiters = this.#waiters.get(dir) ?? new Set();
      this.#waiters.set(dir, waiters);
      const done = () => {
        clearTimeout(timer);
        waiters.delete(done);
        if (waiters.size === 0 && this.#waiters.get(dir) === waiters) this.#waiters.delete(dir);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      waiters.add(done);
    });
    return this.#videos.get(dir) ?? null;
  }

  /** Count of these video directories that do not yet have a current index (queued, being read, read failed, never indexed). When not given, counts all of them. */
  pendingCount(dirs?: readonly string[]): number {
    const list = dirs ? dirs.map((dir) => this.#aliases.get(dir) ?? dir) : [...this.#wanted.keys()];
    let pending = 0;
    for (const dir of list) {
      if (this.#pending.has(dir) || this.#stale.has(dir) || this.#current === dir || this.#failed.has(dir) || !this.#videos.has(dir))
        pending++;
    }
    return pending;
  }

  /** Whether this video directory's index is current (read, not queued, no failure, not an old record awaiting rebuild). */
  current(dir: string): boolean {
    return this.pendingCount([dir]) === 0;
  }

  /** Videos that failed to read, with reasons (for diagnostics). */
  failures(): { dir: string; reason: string }[] {
    return [...this.#failed].map(([dir, reason]) => ({ dir, reason }));
  }

  /** Empties the queue (for tests). */
  async idle(): Promise<void> {
    while (this.#worker) await this.#worker;
  }

  get busy(): boolean {
    return this.#worker !== null;
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#pending.clear();
    for (const dir of [...this.#waiters.keys()]) this.#wake(dir);
    await this.#worker?.catch(() => {});
    this.#store?.close();
    this.#store = null;
  }

  #enqueue(dir: string): void {
    if (this.#closed) return;
    this.#pending.add(dir);
    this.#worker ??= this.#drain().finally(() => (this.#worker = null));
  }

  async #drain(): Promise<void> {
    while (!this.#closed && this.#pending.size > 0) {
      const dir = this.#pending.values().next().value!;
      this.#pending.delete(dir);
      this.#current = dir;
      try {
        if (await this.#refresh(dir)) this.#changed();
      } finally {
        this.#current = null;
        this.#wake(dir);
      }
    }
  }

  #wake(dir: string): void {
    for (const done of [...(this.#waiters.get(dir) ?? [])]) done();
  }

  /** Reads one video; returns whether its index changed. */
  async #refresh(dir: string): Promise<boolean> {
    const mtimeMs = this.#wanted.get(dir);
    if (mtimeMs === undefined) return false;
    if (!this.#reader) {
      this.#failed.set(dir, RcSpace.engineUnavailable().text);
      return false;
    }
    const store = this.#open();
    try {
      const indexed = this.#stale.has(dir) ? undefined : this.#videos.get(dir);
      if (indexed) {
        const peeked = await this.#reader.peek(dir);
        if (peeked.videoId === indexed.videoId && peeked.revision === indexed.revision) {
          const updated = { ...indexed, mtimeMs, name: peeked.name };
          if (this.#closed || !this.#wanted.has(dir)) return false;
          store?.touch(dir, mtimeMs, peeked.name);
          this.#videos.set(dir, updated);
          this.#failed.delete(dir);
          return updated.name !== indexed.name;
        }
      }
      const content = await this.#reader.readContent(dir);
      const extracted = extractContent(content, dir);
      const record: IndexedVideo = {
        dir,
        videoId: content.videoId,
        name: content.name,
        revision: content.revision,
        mtimeMs,
        indexedAt: new Date().toISOString(),
        facts: extracted.facts,
        problems: extracted.problems,
      };
      if (this.#closed) return false;
      // The video has already been removed from the directory (a `sync` ran during the read): do not write back.
      if (!this.#wanted.has(dir)) return false;
      store?.replace(record, extracted.segments);
      this.#videos.set(dir, record);
      this.#stale.delete(dir);
      this.#failed.delete(dir);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#failed.set(dir, reason);
      this.#log.warn("Couldn't read the video's content", { dir, error: reason });
      return false;
    }
  }
}

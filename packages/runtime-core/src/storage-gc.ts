import { isTerminal, type ArtifactStore, type ArtifactSweepResult } from '@cuccut/jobs';
import { trimCache, type CacheTrimResult } from '@cuccut/runtime-storage';
import type { Id, JobRecord } from '@cuccut/protocol';

/** Timer between the two cleanups: the cache size is checked once an hour. If the artifact store's last round was skipped because a job was in progress, the same timer runs it later. */
export const STORAGE_GC_INTERVAL_MS = 60 * 60 * 1000;
/** After the ledger eviction task, wait a moment before cleaning the artifact store, so that consecutively finishing jobs are merged into one round. */
const PRUNE_DEBOUNCE_MS = 30 * 1000;

export interface StorageGcOptions {
  jobs: {
    readonly artifacts: ArtifactStore;
    referencedArtifactIds(): Set<string>;
    onPruned(listener: (evicted: ReadonlySet<Id>) => void): () => void;
    list(): JobRecord[];
  };
  /** Space's artifact records, and references kept only for sweeping (artifacts still referenced after Job Ledger pruning, including those in files kept after a failed read). */
  spaceArtifacts: { referencedArtifactIds(): Promise<Set<string>>; sweepSince(): number };
  /** Carried out once both the artifact records and the Job Ledger are read, and Space has filled in the records from the ledger. */
  ready: Promise<unknown>;
  /** If the artifact records cannot be read at all and it starts from empty, the reason is given. References are incomplete, so the artifact store is not cleaned. */
  artifactSweepBlocked?: string | null;
  cacheDir: string;
  /** Cache size cap (bytes), taken from the settings at the time of each cleanup. */
  cacheMaxBytes: () => number;
  log: { info(message: string, fields?: Record<string, unknown>): void; warn(message: string, fields?: Record<string, unknown>): void };
  intervalMs?: number;
  pruneDebounceMs?: number;
}

/**
 * Two background cleanups of the Runtime Home (architecture design §5.1, §7.3):
 *
 * - **Artifact store**: `artifacts/<sha256>.<ext>` files that are not referenced by any job in the Ledger (any state, including frozen specs and publish intent) and not referenced by Space's artifact records (including references kept only for sweeping, and files kept after a failed read), whose modification time is over 1 hour and which are not earlier than the sweep start point (when reference retention began), are deleted, as are leftover `.tmp` files. A round runs after startup (when `ready` resolves), and then after each Ledger eviction of jobs.
 *   It is skipped while jobs are queued or running: a workflow keeps the artifacts it has just written only in the staging directory and in memory until a step completes, and these are not in the reference set. After a skip, the next eviction or the hourly timer runs it.
 * - **Cache**: when `cache/` exceeds its cap, the oldest files by modification time are deleted, down to 90% of the cap (`trimCache`). A round runs after startup, then once an hour.
 *
 * Everything runs in the background. Failures are only logged as warnings; results are logged as info.
 */
export class StorageGc {
  readonly #options: StorageGcOptions;
  #closed = false;
  #timer: NodeJS.Timeout | null = null;
  #debounce: NodeJS.Timeout | null = null;
  #unsubscribe: (() => void) | null = null;
  #artifactRun: Promise<ArtifactSweepResult | null> | null = null;
  #artifactPending = false;
  #cacheRun: Promise<CacheTrimResult | null> | null = null;
  #blockedLogged = false;
  #cacheChecked = false;

  constructor(options: StorageGcOptions) {
    this.#options = options;
  }

  start(): void {
    this.#unsubscribe = this.#options.jobs.onPruned(() => this.#schedulePruneSweep());
    this.#timer = setInterval(() => {
      void this.trimCache();
      if (this.#artifactPending) void this.sweepArtifacts();
    }, this.#options.intervalMs ?? STORAGE_GC_INTERVAL_MS);
    this.#timer.unref?.();
    void this.#options.ready.then(
      () => {
        if (this.#closed) return;
        void this.sweepArtifacts();
        void this.trimCache();
      },
      (error: unknown) => this.#options.log.warn('Storage cleanup did not start', { error: String(error) }),
    );
  }

  /** Stops the timers. A round in progress runs to completion. */
  async close(): Promise<void> {
    this.#closed = true;
    if (this.#timer) clearInterval(this.#timer);
    if (this.#debounce) clearTimeout(this.#debounce);
    this.#unsubscribe?.();
    await Promise.allSettled([this.#artifactRun, this.#cacheRun].filter(Boolean));
  }

  /** Cleans one round of the artifact store. If one is running, returns that round. If it is skipped (a job is in progress, the references are incomplete, or it has already been closed), resolves to `null`. Does not throw. */
  sweepArtifacts(): Promise<ArtifactSweepResult | null> {
    if (this.#artifactRun) {
      this.#artifactPending = true;
      return this.#artifactRun;
    }
    const run = this.#sweepArtifacts().finally(() => {
      if (this.#artifactRun === run) this.#artifactRun = null;
    });
    this.#artifactRun = run;
    return run;
  }

  /** Checks the cache size for one round. Does not throw. */
  trimCache(): Promise<CacheTrimResult | null> {
    if (this.#cacheRun) return this.#cacheRun;
    const run = this.#trimCache().finally(() => {
      if (this.#cacheRun === run) this.#cacheRun = null;
    });
    this.#cacheRun = run;
    return run;
  }

  #schedulePruneSweep(): void {
    if (this.#closed || this.#debounce) return;
    this.#debounce = setTimeout(() => {
      this.#debounce = null;
      void this.sweepArtifacts();
    }, this.#options.pruneDebounceMs ?? PRUNE_DEBOUNCE_MS);
    this.#debounce.unref?.();
  }

  async #sweepArtifacts(): Promise<ArtifactSweepResult | null> {
    const { log } = this.#options;
    if (this.#closed) return null;
    if (this.#options.artifactSweepBlocked) {
      if (!this.#blockedLogged) {
        this.#blockedLogged = true;
        log.warn('Skipped artifact cleanup: the output references are incomplete', { reason: this.#options.artifactSweepBlocked });
      }
      return null;
    }
    try {
      const active = this.#options.jobs.list().filter((job) => !isTerminal(job.state)).length;
      if (active > 0) {
        this.#artifactPending = true;
        log.info('Deferred artifact cleanup while tasks are running', { active });
        return null;
      }
      this.#artifactPending = false;
      const referenced = this.#options.jobs.referencedArtifactIds();
      for (const id of await this.#options.spaceArtifacts.referencedArtifactIds()) referenced.add(id);
      const result = await this.#options.jobs.artifacts.sweep(referenced, { notBefore: this.#options.spaceArtifacts.sweepSince() });
      if (result) log.info('Artifact cleanup finished', { ...result, referenced: referenced.size });
      return result;
    } catch (error) {
      log.warn('Artifact cleanup failed', { error: String(error) });
      return null;
    }
  }

  async #trimCache(): Promise<CacheTrimResult | null> {
    const { log } = this.#options;
    if (this.#closed) return null;
    try {
      const maxBytes = this.#options.cacheMaxBytes();
      const result = await trimCache(this.#options.cacheDir, { maxBytes });
      // Once an hour: when nothing was deleted, it logs only once, in the first round.
      if (result.removed > 0 || result.failed > 0 || !this.#cacheChecked) log.info('Cache size check finished', { ...result, maxBytes });
      this.#cacheChecked = true;
      if (result.protectedBytes > maxBytes) log.warn('Cache files that are never removed exceed the cache limit', { protectedBytes: result.protectedBytes, maxBytes });
      return result;
    } catch (error) {
      log.warn('Cache cleanup failed', { error: String(error) });
      return null;
    }
  }
}

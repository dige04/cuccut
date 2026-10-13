import fs from 'node:fs/promises';
import {
  PUBLISHING_HISTORY_LIMIT,
  PUBLISHING_SCHEMA_VERSION,
  RpcError,
  isValidTimezone,
  refOf,
  type Id,
  type Localized,
  type MessageRef,
  type PinnedExport,
  type Publication,
  type PublishingAccount,
  type PublishingConnection,
  type PublishingFileV1,
  type PublishingHistoryEntry,
  type PublishingImportRecord,
  type PublishingSettings,
} from '@cuccut/protocol';
import {
  pinnedExportSchema,
  publicationSchema,
  publishingAccountSchema,
  publishingConnectionSchema,
  publishingFileSchema,
  publishingSettingsSchema,
} from '@cuccut/protocol/schemas';
import { RuntimeStoragePublishing as SP } from '@cuccut/protocol/messages/runtime-storage';
import { writeJsonAtomic } from './json-file.ts';
import { isPlainObject, readJsonOrQuarantine, type StoreLog } from './store-file.ts';

/**
 * The publishing store (`docs/cuccut/m2-publishing.md` §3.3): one JSON document at `<runtime-home>/store/publishing.json` (0600) holding the publishing
 * settings, connections, accounts, publications (archived ones included), pinned export records, replaced payloads and import records.
 *
 * - The whole document is in memory. Every mutation is a synchronous transaction: the revision check and the change happen in one event-loop turn, so
 *   two calls never interleave; then the document is written atomically (temp file, fsync, rename, fsync directory), writes run one at a time, and the
 *   call resolves after its write is on disk. If the write fails, the change stays in memory, the call rejects (`PUBLISHING_WRITE_FAILED`), and the next
 *   change or `flush` writes again.
 * - Optimistic concurrency: a write names the revision it read. A publication that changed in between refuses the write with
 *   `RpcError('conflict')`, `details.code` `PUBLICATION_CONFLICT` (settings: `SETTINGS_CONFLICT`) and `details.current` (the saved record).
 * - Records are parsed with the protocol schemas on read and before each commit, so a commit never leaves an invalid record behind.
 * - One Runtime per home (`runtime.lock`), so no cross-process leases; the data is small (hundreds to a few thousand publications).
 * - Reading follows `store-file.ts` with `quarantine: false`: a file that is not recognized is left in place and the store starts `unavailable` (empty,
 *   writes refused, `problem` says why); a file written by a newer version is shown if it can be read, and the store is `read-only`.
 */

export type PublishingStoreState = 'ok' | 'read-only' | 'unavailable';

export interface PublishingStoreOptions {
  now?: () => Date;
  /** The timezone new settings start with (default: the system zone, else UTC). It is written with the first change. */
  defaultTimezone?: () => string;
  log?: StoreLog;
}

/** What a commit wrote. Listeners use it to publish topic events. */
export interface PublishingCommit {
  /** Publications inserted or changed (as saved). */
  publications: Publication[];
  /** IDs of publications deleted. */
  removed: Id[];
  /** The saved settings, when they changed. */
  settings: PublishingSettings | null;
  connections: boolean;
  accounts: boolean;
  exports: boolean;
}

/**
 * Migrates a stored document to the current schema. Each schema version bump adds one pure step (`vN → vN+1`) here, covered by fixture tests. Returns
 * null when the document is not a publishing store this version recognizes.
 */
export function migratePublishingFile(raw: Record<string, unknown>): PublishingFileV1 | null {
  if (raw.schemaVersion !== 1) return null;
  const parsed = publishingFileSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function systemTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimezone(zone) ? zone : 'UTC';
  } catch {
    return 'UTC';
  }
}

function emptyDocument(timezone: string): PublishingFileV1 {
  return {
    schemaVersion: PUBLISHING_SCHEMA_VERSION,
    settings: publishingSettingsSchema.parse({ timezone }),
    connections: [],
    accounts: [],
    publications: [],
    exports: [],
    history: [],
    imports: [],
  };
}

function conflict(message: Localized, code: string, current: unknown): RpcError {
  return new RpcError('conflict', message, { code, current });
}

function notFound(): RpcError {
  return new RpcError('not-found', SP.notFound(), { code: 'PUBLICATION_NOT_FOUND' });
}

/**
 * One transaction. Records obtained through it are drafts: change them in place. A publication or the settings obtained through it count as written:
 * on commit their revision goes up by one and `updatedAt` is set. Lists (`connections`, `accounts`, `exports`) are copied on first access and replace
 * the stored lists on commit.
 */
export class PublishingTransaction {
  readonly #doc: PublishingFileV1;
  readonly now: Date;
  /** Publications changed in this transaction, by ID. */
  readonly drafts = new Map<Id, Publication>();
  readonly inserted: Publication[] = [];
  readonly removed = new Set<Id>();
  settingsDraft: PublishingSettings | null = null;
  connectionsDraft: PublishingConnection[] | null = null;
  accountsDraft: PublishingAccount[] | null = null;
  exportsDraft: PinnedExport[] | null = null;
  readonly historyAdded: PublishingHistoryEntry[] = [];
  readonly importsAdded: PublishingImportRecord[] = [];

  constructor(doc: PublishingFileV1, now: Date) {
    this.#doc = doc;
    this.now = now;
  }

  /** A publication to change. With `expectedRevision`, a publication saved at another revision refuses the transaction (`PUBLICATION_CONFLICT`). */
  publication(id: Id, expectedRevision?: number): Publication {
    const draft = this.drafts.get(id) ?? this.inserted.find((p) => p.id === id);
    if (draft) return draft;
    if (this.removed.has(id)) throw notFound();
    const saved = this.#doc.publications.find((p) => p.id === id);
    if (!saved) throw notFound();
    if (expectedRevision !== undefined && saved.revision !== expectedRevision) throw conflict(SP.conflict(), 'PUBLICATION_CONFLICT', structuredClone(saved));
    const copy = structuredClone(saved);
    this.drafts.set(id, copy);
    return copy;
  }

  /** Adds a new publication (saved as given: its revision is not bumped). */
  insertPublication(publication: Publication): Publication {
    if (this.#doc.publications.some((p) => p.id === publication.id) || this.inserted.some((p) => p.id === publication.id)) {
      throw new RpcError('conflict', SP.invalidRecord(), { code: 'PUBLICATION_EXISTS' });
    }
    const copy = structuredClone(publication);
    this.inserted.push(copy);
    return copy;
  }

  /** Deletes a publication for good (retention cleanup). Archiving is a change, not a deletion. */
  deletePublication(id: Id): void {
    const inserted = this.inserted.findIndex((p) => p.id === id);
    if (inserted >= 0) {
      this.inserted.splice(inserted, 1);
      return;
    }
    if (!this.#doc.publications.some((p) => p.id === id)) throw notFound();
    this.drafts.delete(id);
    this.removed.add(id);
  }

  /** The settings to change. With `expectedRevision`, settings saved at another revision refuse the transaction (`SETTINGS_CONFLICT`). */
  settings(expectedRevision?: number): PublishingSettings {
    if (this.settingsDraft) return this.settingsDraft;
    if (expectedRevision !== undefined && this.#doc.settings.revision !== expectedRevision) {
      throw conflict(SP.settingsConflict(), 'SETTINGS_CONFLICT', structuredClone(this.#doc.settings));
    }
    this.settingsDraft = structuredClone(this.#doc.settings);
    return this.settingsDraft;
  }

  connections(): PublishingConnection[] {
    this.connectionsDraft ??= structuredClone(this.#doc.connections);
    return this.connectionsDraft;
  }

  accounts(): PublishingAccount[] {
    this.accountsDraft ??= structuredClone(this.#doc.accounts);
    return this.accountsDraft;
  }

  exports(): PinnedExport[] {
    this.exportsDraft ??= structuredClone(this.#doc.exports);
    return this.exportsDraft;
  }

  /** Keeps a replaced payload (newest last; the oldest are dropped beyond `PUBLISHING_HISTORY_LIMIT`). */
  addHistory(entry: PublishingHistoryEntry): void {
    this.historyAdded.push(structuredClone(entry));
  }

  addImport(record: PublishingImportRecord): void {
    this.importsAdded.push(structuredClone(record));
  }
}

export class PublishingStore {
  readonly file: string;
  readonly #now: () => Date;
  #doc: PublishingFileV1;
  #state: PublishingStoreState = 'ok';
  #problem: Localized | null = null;
  readonly #listeners = new Set<(commit: PublishingCommit) => void>();
  #writing: Promise<void> = Promise.resolve();
  #queued: Promise<unknown> | null = null;
  #unsaved = false;

  private constructor(file: string, options: PublishingStoreOptions) {
    this.file = file;
    this.#now = options.now ?? (() => new Date());
    this.#doc = emptyDocument(options.defaultTimezone?.() ?? systemTimezone());
  }

  /** Reads the store. Never throws for content problems (see the module comment); filesystem errors other than a missing file are rethrown. */
  static async open(file: string, options: PublishingStoreOptions = {}): Promise<PublishingStore> {
    const store = new PublishingStore(file, options);
    const read = await readJsonOrQuarantine(file, {
      log: options.log,
      quarantine: false,
      version: { key: 'schemaVersion', known: PUBLISHING_SCHEMA_VERSION },
      recognize: migratePublishingFile,
    });
    switch (read.status) {
      case 'ok':
        store.#doc = read.value;
        break;
      case 'unrecognized':
        store.#state = 'unavailable';
        store.#problem = SP.unreadable();
        break;
      case 'newer-version': {
        store.#state = 'read-only';
        store.#problem = SP.newerVersion();
        // Show what this version can read of it; never write it.
        const view = await readNewerVersion(file);
        if (view) store.#doc = view;
        break;
      }
      case 'missing':
      case 'empty':
      case 'quarantined':
        break;
    }
    if (store.#state === 'ok' && !isValidTimezone(store.#doc.settings.timezone)) {
      options.log?.warn('Publishing timezone is not known to this runtime', { timezone: store.#doc.settings.timezone });
    }
    return store;
  }

  get state(): PublishingStoreState {
    return this.#state;
  }

  /** Why the store is read-only or unavailable, or null. */
  get problem(): MessageRef | null {
    return this.#problem ? refOf(this.#problem) : null;
  }

  // ---- Reads (copies, safe to change) ----

  settings(): PublishingSettings {
    return structuredClone(this.#doc.settings);
  }

  connections(): PublishingConnection[] {
    return structuredClone(this.#doc.connections);
  }

  accounts(): PublishingAccount[] {
    return structuredClone(this.#doc.accounts);
  }

  publications(): Publication[] {
    return structuredClone(this.#doc.publications);
  }

  publication(id: Id): Publication | null {
    const p = this.#doc.publications.find((item) => item.id === id);
    return p ? structuredClone(p) : null;
  }

  exports(): PinnedExport[] {
    return structuredClone(this.#doc.exports);
  }

  pinnedExport(id: Id): PinnedExport | null {
    const e = this.#doc.exports.find((item) => item.id === id);
    return e ? structuredClone(e) : null;
  }

  history(publicationId?: Id): PublishingHistoryEntry[] {
    return structuredClone(publicationId ? this.#doc.history.filter((h) => h.publicationId === publicationId) : this.#doc.history);
  }

  imports(): PublishingImportRecord[] {
    return structuredClone(this.#doc.imports);
  }

  /** The whole document (a copy), for backups and calendar export. */
  snapshot(): PublishingFileV1 {
    return structuredClone(this.#doc);
  }

  /**
   * Reads without copying, for hot paths (occupancy, listings). `fn` must not change the document or keep references to it after returning.
   */
  read<T>(fn: (doc: Readonly<PublishingFileV1>) => T): T {
    return fn(this.#doc);
  }

  // ---- Writes ----

  onCommit(listener: (commit: PublishingCommit) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Runs `fn` as one transaction and resolves with its result once the change is on disk. `fn` must be synchronous; if it throws, nothing changes.
   */
  async transact<T>(fn: (tx: PublishingTransaction) => T): Promise<T> {
    return (await this.#run(fn)).result;
  }

  /** Changes one publication at the revision the caller read; resolves with the saved publication. */
  change(publicationId: Id, expectedRevision: number, fn: (draft: Publication, tx: PublishingTransaction) => void): Promise<Publication>;
  /** Changes the settings at the revision the caller read; resolves with the saved settings. */
  change(target: 'settings', expectedRevision: number, fn: (draft: PublishingSettings, tx: PublishingTransaction) => void): Promise<PublishingSettings>;
  async change(
    target: Id,
    expectedRevision: number,
    fn: ((draft: Publication, tx: PublishingTransaction) => void) | ((draft: PublishingSettings, tx: PublishingTransaction) => void),
  ): Promise<Publication | PublishingSettings> {
    if (target === 'settings') {
      const { commit } = await this.#run((tx) => (fn as (draft: PublishingSettings, tx: PublishingTransaction) => void)(tx.settings(expectedRevision), tx));
      return commit!.settings!;
    }
    const { commit } = await this.#run((tx) => (fn as (draft: Publication, tx: PublishingTransaction) => void)(tx.publication(target, expectedRevision), tx));
    const saved = commit?.publications.find((p) => p.id === target);
    if (!saved) throw notFound();
    return saved;
  }

  /** Waits for pending writes; if the last write failed, writes again once. */
  async flush(): Promise<void> {
    await this.#writing;
    if (this.#unsaved) await this.#schedule();
  }

  // ---- Internal ----

  async #run<T>(fn: (tx: PublishingTransaction) => T): Promise<{ result: T; commit: PublishingCommit | null }> {
    if (this.#state !== 'ok') {
      throw new RpcError(this.#state === 'read-only' ? 'unsupported' : 'internal', this.#problem ?? SP.unreadable(), { code: 'PUBLISHING_UNAVAILABLE' });
    }
    const tx = new PublishingTransaction(this.#doc, this.#now());
    const result = fn(tx);
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      throw new TypeError('PublishingStore.transact needs a synchronous function');
    }
    const commit = this.#commit(tx);
    if (!commit) return { result, commit };
    const error = await this.#schedule();
    if (error) throw new RpcError('internal', SP.writeFailed(), { code: 'PUBLISHING_WRITE_FAILED', reason: String(error) });
    return { result, commit };
  }

  /** Validates and applies a transaction to the in-memory document. Returns null when it changed nothing. */
  #commit(tx: PublishingTransaction): PublishingCommit | null {
    const at = tx.now.toISOString();
    const parse = <T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) throw new RpcError('invalid-request', SP.invalidRecord(), { code: 'RECORD_INVALID' });
      return parsed.data;
    };
    const changed: Publication[] = [];
    for (const draft of tx.drafts.values()) {
      draft.revision += 1;
      draft.updatedAt = at;
      changed.push(parse(publicationSchema, draft));
    }
    const inserted = tx.inserted.map((p) => parse(publicationSchema, p));
    let settings: PublishingSettings | null = null;
    if (tx.settingsDraft) {
      tx.settingsDraft.revision += 1;
      settings = parse(publishingSettingsSchema, tx.settingsDraft);
    }
    const connections = tx.connectionsDraft?.map((c) => parse(publishingConnectionSchema, c)) ?? null;
    const accounts = tx.accountsDraft?.map((a) => parse(publishingAccountSchema, a)) ?? null;
    const exports = tx.exportsDraft?.map((e) => parse(pinnedExportSchema, e)) ?? null;
    if (!changed.length && !inserted.length && !tx.removed.size && !settings && !connections && !accounts && !exports && !tx.historyAdded.length && !tx.importsAdded.length) {
      return null;
    }

    // Everything is valid: apply in one step.
    const doc = this.#doc;
    const byId = new Map(changed.map((p) => [p.id, p]));
    doc.publications = doc.publications.filter((p) => !tx.removed.has(p.id)).map((p) => byId.get(p.id) ?? p);
    doc.publications.push(...inserted);
    if (settings) doc.settings = settings;
    if (connections) doc.connections = connections;
    if (accounts) doc.accounts = accounts;
    if (exports) doc.exports = exports;
    if (tx.historyAdded.length) {
      doc.history.push(...tx.historyAdded);
      if (doc.history.length > PUBLISHING_HISTORY_LIMIT) doc.history.splice(0, doc.history.length - PUBLISHING_HISTORY_LIMIT);
    }
    if (tx.removed.size) doc.history = doc.history.filter((h) => !tx.removed.has(h.publicationId));
    doc.imports.push(...tx.importsAdded);

    const commit: PublishingCommit = {
      publications: [...changed, ...inserted].map((p) => structuredClone(p)),
      removed: [...tx.removed],
      settings: settings ? structuredClone(settings) : null,
      connections: connections !== null,
      accounts: accounts !== null,
      exports: exports !== null,
    };
    for (const listener of this.#listeners) {
      try {
        listener(commit);
      } catch {
        // A listener's failure does not undo the commit.
      }
    }
    return commit;
  }

  /** Queues a disk write (merged into one already queued). Resolves to the write's error, or null on success. */
  #schedule(): Promise<unknown> {
    if (this.#queued) return this.#queued;
    const write = this.#writing.then(async () => {
      this.#queued = null;
      try {
        await writeJsonAtomic(this.file, this.#doc, { mode: 0o600, durable: true });
        this.#unsaved = false;
        return null;
      } catch (error) {
        this.#unsaved = true;
        return error;
      }
    });
    this.#queued = write;
    this.#writing = write.then(() => {});
    return write;
  }
}

/** Best-effort view of a file written by a newer version: its records as this version reads them, or null. */
async function readNewerVersion(file: string): Promise<PublishingFileV1 | null> {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!isPlainObject(raw)) return null;
    const parsed = publishingFileSchema.safeParse({ ...raw, schemaVersion: 1 });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

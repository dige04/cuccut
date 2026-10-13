import fs from 'node:fs/promises';
import {
  JsonlCorruptError,
  appendJsonl,
  compactJsonl,
  quarantineFile,
  readJson,
  readJsonl,
} from '@cuccut/runtime-storage';
import { silentLog, type JobsLogger } from './jobs-logger.ts';

/**
 * JSONL journal that records one entry per line (shared by the task and application ledgers; architecture design §7.3).
 *
 * The first line of the file is `{"op":"header","formatVersion":2}`. After that, each line is one operation: `{"op":"put", ...record}` writes or replaces a record, and `{"op":"remove","<key name>":"<key>"}` deletes one. On read, the operations are replayed in order. Every append is fsync'd (crash-safe ordering depends on it).
 *
 * The journal remembers each record as last enqueued on the write chain (as serialized lines) and only appends the ones that changed. When the number of lines exceeds `ratio` times the live record count (and is at least `minLines`), or the byte size exceeds `maxBytes` (and is more than twice the live records' size), the live records are compacted in full into a new file. Appends and compaction run on the same serial write chain. Compaction uses the live records as of the moment it is written, so appends queued after it are idempotent when replayed. After a write failure, the next write compacts the whole file.
 *
 * Reading: a truncated trailing partial line (from a crash) and unrecognized lines are skipped and logged; the next full-compaction write clears them. If the whole file is unrecognizable, it is renamed to keep `.corrupt-<time>` and starts empty. When `.jsonl` is absent but an old whole-file JSON (`legacy`) exists, it is imported; after `.jsonl` is written, the old file is renamed to `.migrated`.
 */

export const JOURNAL_HEADER = { op: 'header', formatVersion: 2 } as const;

export interface JournalCompaction {
  /** Compact when the line count exceeds this multiple of the live record count. */
  ratio: number;
  /** Do not compact by multiple below this line count (no need to rewrite often when there are few records). */
  minLines: number;
  /** Compact when the file exceeds this many bytes (and is more than twice the live records' size). */
  maxBytes: number;
}

export const DEFAULT_COMPACTION: JournalCompaction = { ratio: 4, minLines: 256, maxBytes: 8 * 1024 * 1024 };

/** Constructor options for the two journals. */
export interface LedgerOptions {
  log?: JobsLogger | undefined;
  /** Compaction thresholds (for tests). */
  compaction?: Partial<JournalCompaction> | undefined;
}

export interface RecordJournalOptions {
  file: string;
  /** Field names of the key in delete lines (`jobId`, `applicationId`). */
  keyField: string;
  /** The key of a record; null if it is not a valid record. */
  key(value: unknown): string | null;
  /** When writing an existing record, move it to the end (application ledger: oldest first); otherwise leave it in place (task ledger: creation order). */
  moveOnPut: boolean;
  /** Legacy format: a whole-file JSON; `records` is taken from it as the record array; null if unrecognized. */
  legacy?: { file: string; records(data: unknown): unknown[] | null } | undefined;
  /** Asked once before each step on the write chain; when false, that step is not written (fault injection simulating a crash). */
  writable?: (() => boolean) | undefined;
  compaction?: Partial<JournalCompaction> | undefined;
  log?: JobsLogger | undefined;
}

export class RecordJournal {
  readonly file: string;
  readonly #options: RecordJournalOptions;
  readonly #compaction: JournalCompaction;
  readonly #log: JobsLogger;
  /** Key → most recent put line enqueued on the write chain, in record order. */
  #live = new Map<string, string>();
  #chain: Promise<void> = Promise.resolve();
  #lines = 0;
  #bytes = 0;
  /** The next write compacts the whole file (after reading a partial line, a write failure, or just recovering from a bad file). */
  #compactNext = false;

  constructor(options: RecordJournalOptions) {
    this.file = options.file;
    this.#options = options;
    this.#compaction = { ...DEFAULT_COMPACTION, ...options.compaction };
    this.#log = options.log ?? silentLog;
  }

  /** Reads all live records (in replayed order) and remembers them as the baseline for later comparison. */
  async load(): Promise<unknown[]> {
    await this.#chain;
    this.#live = new Map();
    this.#lines = 0;
    this.#bytes = 0;
    this.#compactNext = false;
    let data: Awaited<ReturnType<typeof readJsonl>>;
    try {
      data = await readJsonl(this.file);
    } catch (error) {
      if (!(error instanceof JsonlCorruptError)) throw error;
      return this.#quarantine();
    }
    if (data === null) return this.#migrate();
    if (data.header === null) {
      // Only a partial line (crashed while writing the header): the next write rewrites the whole file instead of appending after the partial line.
      if (data.truncatedTail) this.#compactNext = true;
      return [];
    }
    if (!isHeader(data.header)) return this.#quarantine();
    const records = new Map<string, Record<string, unknown>>();
    let skipped = data.skipped;
    for (const row of data.rows) {
      if (!isObject(row)) {
        skipped++;
        continue;
      }
      if (row.op === 'put') {
        const key = this.#options.key(row);
        if (key === null) {
          skipped++;
          continue;
        }
        const { op: _op, ...record } = row;
        if (this.#options.moveOnPut) records.delete(key);
        records.set(key, record);
      } else if (row.op === 'remove' && typeof row[this.#options.keyField] === 'string') {
        records.delete(row[this.#options.keyField] as string);
      } else {
        skipped++;
      }
    }
    for (const [key, record] of records) this.#live.set(key, putLine(record));
    this.#lines = data.lines;
    this.#bytes = data.bytes;
    if (data.truncatedTail || skipped > 0) {
      this.#compactNext = true;
      this.#log.warn('Skipped unreadable ledger lines', { file: this.file, skipped, truncatedTail: data.truncatedTail });
    }
    return [...records.values()];
  }

  /** Replaces the contents with this complete snapshot: only appends changed records and deleted keys. Writes nothing when nothing changed, and returns the writes queued before. */
  replace(records: Iterable<readonly [string, unknown]>): Promise<void> {
    const next = new Map<string, string>();
    const rows: string[] = [];
    for (const [key, record] of records) {
      const line = putLine(record);
      next.set(key, line);
      if (this.#live.get(key) !== line) rows.push(line);
    }
    for (const key of this.#live.keys()) if (!next.has(key)) rows.push(this.#removeLine(key));
    this.#live = next;
    return this.#enqueue(rows);
  }

  /** Writes one record. */
  put(key: string, record: unknown): Promise<void> {
    const line = putLine(record);
    if (this.#options.moveOnPut) this.#live.delete(key);
    this.#live.set(key, line);
    return this.#enqueue([line]);
  }

  /** Deletes these keys (keys that are not present are ignored). */
  remove(keys: Iterable<string>): Promise<void> {
    const rows: string[] = [];
    for (const key of keys) if (this.#live.delete(key)) rows.push(this.#removeLine(key));
    return this.#enqueue(rows);
  }

  /** Waits for all queued writes to complete. */
  flush(): Promise<void> {
    return this.#chain;
  }

  #enqueue(rows: string[]): Promise<void> {
    if (rows.length === 0) return this.#chain;
    const next = this.#chain.then(() => this.#step(rows));
    this.#chain = next.catch(() => {});
    return next;
  }

  async #step(rows: string[]): Promise<void> {
    if (this.#options.writable && !this.#options.writable()) return;
    try {
      if (this.#shouldCompact(rows)) await this.#compact();
      else {
        this.#bytes += await appendJsonl(this.file, rows, { header: JOURNAL_HEADER });
        this.#lines += rows.length;
      }
    } catch (error) {
      this.#compactNext = true;
      throw error;
    }
  }

  #shouldCompact(rows: string[]): boolean {
    if (this.#compactNext) return true;
    const { ratio, minLines, maxBytes } = this.#compaction;
    const lines = this.#lines + rows.length;
    if (lines > Math.max(ratio * this.#live.size, minLines)) return true;
    let bytes = this.#bytes;
    for (const row of rows) bytes += row.length + 1;
    if (bytes <= maxBytes) return false;
    let live = 0;
    for (const line of this.#live.values()) live += line.length + 1;
    return bytes > 2 * live;
  }

  async #compact(): Promise<void> {
    const rows = [...this.#live.values()];
    this.#bytes = await compactJsonl(this.file, rows, { header: JOURNAL_HEADER });
    this.#lines = rows.length;
    this.#compactNext = false;
  }

  async #quarantine(): Promise<unknown[]> {
    const quarantined = await quarantineFile(this.file);
    this.#log.warn('Unrecognized ledger file, starting empty', { file: this.file, quarantined });
    return [];
  }

  /** `.jsonl` absent: if an old whole-file JSON exists, import it; write `.jsonl` first, then rename the old file to `.migrated`. */
  async #migrate(): Promise<unknown[]> {
    const legacy = this.#options.legacy;
    if (!legacy) return [];
    let data: unknown;
    try {
      data = await readJson(legacy.file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== undefined) throw error;
      const quarantined = await quarantineFile(legacy.file);
      this.#log.warn('Unrecognized legacy ledger file, starting empty', { file: legacy.file, quarantined });
      return [];
    }
    if (data === null) return [];
    const list = legacy.records(data);
    if (list === null) {
      const quarantined = await quarantineFile(legacy.file);
      this.#log.warn('Unrecognized legacy ledger file, starting empty', { file: legacy.file, quarantined });
      return [];
    }
    const records: unknown[] = [];
    for (const record of list) {
      const key = this.#options.key(record);
      if (key === null) continue;
      if (this.#options.moveOnPut) this.#live.delete(key);
      this.#live.set(key, putLine(record));
    }
    for (const line of this.#live.values()) {
      const { op: _op, ...record } = JSON.parse(line) as Record<string, unknown>;
      records.push(record);
    }
    await this.#compact();
    await fs.rename(legacy.file, `${legacy.file}.migrated`);
    this.#log.info('Migrated ledger to JSONL', { from: legacy.file, to: this.file, records: records.length });
    return records;
  }

  #removeLine(key: string): string {
    return JSON.stringify({ op: 'remove', [this.#options.keyField]: key });
  }
}

function putLine(record: unknown): string {
  return JSON.stringify({ op: 'put', ...(record as object) });
}

function isHeader(value: unknown): boolean {
  return isObject(value) && value.op === 'header' && value.formatVersion === 2;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

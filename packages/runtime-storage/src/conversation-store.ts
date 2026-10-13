import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckResult, Conversation, DriverId, Id, Seq, TaskContract, TimelineItem } from '@cuccut/protocol';
import { readJson } from './json-file.ts';
import { JsonlCorruptError, appendJsonl, compactJsonl, quarantineFile, readJsonl } from './jsonl-file.ts';

/**
 * The persisted form of a conversation (Runtime Store, architecture design §3.10).
 *
 * `agent.persistence` is the native resume handle given by the Driver (for example Codex's threadId).
 * The Runtime stores it but does not interpret it.
 */
export interface ConversationRecord {
  schemaVersion: 1;
  conversation: Conversation;
  items: TimelineItem[];
  seq: Seq;
  agent: { driverId: DriverId; persistence: unknown };
  /**
   * The task contract (architecture design §3.2), per task: all revisions (old ones first, append-only) and the results of acceptance checks. Records written early in 0.x do not have one;
   * when read, a default contract is filled in for their tasks, without bumping the record version.
   */
  tasks?: Record<Id, TaskContractLog>;
}

/** A task's contract revisions and check results. */
export interface TaskContractLog {
  revisions: TaskContract[];
  checkResults: CheckResult[];
}

/** The header line (first line) of a conversation log. */
export const CONVERSATION_LOG_HEADER = { op: 'header', formatVersion: 2 } as const;

/**
 * Lines of the conversation log `<id>.jsonl` (after the header). The first line is always `snapshot` (the complete record, the baseline after compaction). Later lines are replayed in order:
 * an `item` replaces the matching entry in place by `item.id`, or is appended to the end; `meta` replaces the fields given; `tasks` replaces the whole set by taskId.
 */
export type ConversationLogLine =
  | ({ op: 'snapshot' } & ConversationRecord)
  | { op: 'item'; item: TimelineItem }
  | {
      op: 'meta';
      conversation?: Conversation;
      seq?: Seq;
      agent?: ConversationRecord['agent'];
      tasks?: Record<Id, TaskContractLog>;
    };

export interface ConversationStoreLog {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

export interface ConversationStoreOptions {
  log?: ConversationStoreLog;
}

const SAVE_DELAY_MS = 150;
/** Compacts when the line count exceeds `live entries × multiplier + margin`. */
const COMPACT_LINE_FACTOR = 4;
const COMPACT_LINE_SLACK = 64;
/** Compacts when the byte count exceeds `live record bytes × multiplier + margin` (a streaming reply writes the whole item every time, so bytes grow faster than lines). */
const COMPACT_BYTE_FACTOR = 4;
const COMPACT_BYTE_SLACK = 256 * 1024;

/** The state as last written to disk: a JSON string per item, used to write only the changed lines. */
interface Persisted {
  conversation: string;
  seq: string;
  agent: string;
  items: Map<Id, string>;
  /** The order of items as written to disk. A new item can only be appended at the end. */
  order: Id[];
  tasks: Map<Id, string>;
  /** The file's current count of non-empty lines and bytes. */
  lines: number;
  bytes: number;
}

/**
 * Memory first, written to disk after changes. Each conversation has one append-only JSONL log. When the 150ms coalescing window expires, only the changed entries and metadata are appended.
 * When the log grows past a threshold, the complete record is written as a single snapshot line that atomically replaces the file (compaction). Appends and compaction share the same conversation's serial write chain.
 * On stop, `flush()` waits for all pending writes to complete (architecture design §2.4, the step “persist tasks…”).
 */
export class ConversationStore {
  readonly #dir: string;
  readonly #log: ConversationStoreLog | undefined;
  readonly #records = new Map<Id, ConversationRecord>();
  readonly #persisted = new Map<Id, Persisted>();
  readonly #timers = new Map<Id, ReturnType<typeof setTimeout>>();
  readonly #writes = new Map<Id, Promise<void>>();

  constructor(dir: string, options: ConversationStoreOptions = {}) {
    this.#dir = dir;
    this.#log = options.log;
  }

  async load(): Promise<ConversationRecord[]> {
    await fs.mkdir(this.#dir, { recursive: true });
    const names = new Set(await fs.readdir(this.#dir));
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      try {
        await this.#loadLog(path.join(this.#dir, name));
      } catch (error) {
        this.#log?.warn('Conversation log could not be read; skipped', { file: name, reason: reasonOf(error) });
      }
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -'.json'.length);
      if (names.has(`${id}.jsonl`)) {
        this.#log?.warn('Legacy conversation file ignored: a conversation log with the same name exists', { file: name });
        continue;
      }
      try {
        await this.#migrate(path.join(this.#dir, name));
      } catch (error) {
        this.#log?.warn('Legacy conversation file could not be migrated; left in place', { file: name, reason: reasonOf(error) });
      }
    }
    return [...this.#records.values()];
  }

  list(): ConversationRecord[] {
    return [...this.#records.values()];
  }

  get(id: Id): ConversationRecord | undefined {
    return this.#records.get(id);
  }

  put(record: ConversationRecord): void {
    this.#records.set(record.conversation.id, record);
    this.markDirty(record.conversation.id);
  }

  markDirty(id: Id): void {
    if (this.#timers.has(id)) return;
    this.#timers.set(
      id,
      setTimeout(() => {
        this.#timers.delete(id);
        void this.#save(id);
      }, SAVE_DELAY_MS),
    );
  }

  async delete(id: Id): Promise<void> {
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer);
    this.#timers.delete(id);
    this.#records.delete(id);
    await this.#writes.get(id)?.catch(() => {});
    this.#persisted.delete(id);
    await fs.rm(this.#file(id), { force: true });
    await fs.rm(path.join(this.#dir, `${id}.json`), { force: true });
  }

  async flush(): Promise<void> {
    for (const [id, timer] of this.#timers) {
      clearTimeout(timer);
      this.#timers.delete(id);
      void this.#save(id);
    }
    await Promise.all(this.#writes.values());
  }

  #file(id: Id): string {
    return path.join(this.#dir, `${id}.jsonl`);
  }

  async #loadLog(file: string): Promise<void> {
    const name = path.basename(file);
    const quarantine = async (): Promise<void> => {
      const target = await quarantineFile(file);
      this.#log?.warn('Unrecognized conversation log renamed and skipped', { file: name, renamedTo: path.basename(target) });
    };
    let read: Awaited<ReturnType<typeof readJsonl>>;
    try {
      read = await readJsonl(file);
    } catch (error) {
      if (error instanceof JsonlCorruptError) return quarantine();
      throw error;
    }
    if (!read) return;
    const header = read.header as { op?: unknown; formatVersion?: unknown } | null;
    if (header?.op !== 'header') return quarantine();
    if (header.formatVersion !== CONVERSATION_LOG_HEADER.formatVersion) {
      this.#log?.warn('Conversation log has an unknown format version; skipped', { file: name, formatVersion: header.formatVersion });
      return;
    }
    const [first, ...rest] = read.rows;
    if (!isSnapshot(first)) return quarantine();
    const { op: _op, ...record } = first;
    if (record.schemaVersion !== 1) {
      this.#log?.warn('Conversation log has an unknown schema version; skipped', { file: name, schemaVersion: record.schemaVersion });
      return;
    }
    // A partial line at the end: skipped, and no on-disk copy is recorded. The next save writes the whole snapshot to replace the file, so the partial line does not remain as a bad line in the middle.
    if (read.truncatedTail) this.#log?.warn('Conversation log ends with a partial line; skipped it', { file: name });
    if (read.skipped > 0) this.#log?.warn('Conversation log has unreadable lines; skipped them', { file: name, count: read.skipped });
    const index = new Map(record.items.map((item, i) => [item.id, i]));
    for (const line of rest as ConversationLogLine[]) {
      if (line?.op === 'item' && line.item?.id) {
        const at = index.get(line.item.id);
        if (at === undefined) {
          index.set(line.item.id, record.items.length);
          record.items.push(line.item);
        } else record.items[at] = line.item;
      } else if (line?.op === 'meta') {
        if (line.conversation) record.conversation = line.conversation;
        if (line.seq !== undefined) record.seq = line.seq;
        if (line.agent) record.agent = line.agent;
        if (line.tasks) record.tasks = { ...record.tasks, ...line.tasks };
      } else if (line?.op === 'snapshot') {
        this.#log?.warn('Conversation log has a snapshot after the first line; ignored it', { file: name });
      }
    }
    const id = record.conversation.id;
    this.#records.set(id, record);
    if (!read.truncatedTail) this.#persisted.set(id, { ...persistedOf(record), lines: read.lines, bytes: read.bytes });
  }

  /** The old format `<id>.json` (the whole record): written as a snapshot line in `<id>.jsonl`, then the old file is renamed to `.json.migrated`. */
  async #migrate(file: string): Promise<void> {
    const name = path.basename(file);
    const record = await readJson<ConversationRecord>(file);
    if (!record) return;
    if (record.schemaVersion !== 1) {
      this.#log?.warn('Legacy conversation file has an unknown schema version; left in place', {
        file: name,
        schemaVersion: (record as { schemaVersion?: unknown }).schemaVersion,
      });
      return;
    }
    const id = record.conversation.id;
    const bytes = await writeSnapshot(this.#file(id), record);
    await fs.rename(file, `${file}.migrated`);
    this.#records.set(id, record);
    this.#persisted.set(id, { ...persistedOf(record), lines: 1, bytes });
    this.#log?.info('Migrated legacy conversation file to a conversation log', { file: name });
  }

  #save(id: Id): Promise<void> {
    const previous = this.#writes.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => this.#write(id));
    this.#writes.set(id, next);
    const settle = (): void => {
      if (this.#writes.get(id) === next) this.#writes.delete(id);
    };
    next.then(settle, (error: unknown) => {
      settle();
      this.#log?.warn('Conversation log write failed', { conversationId: id, reason: reasonOf(error) });
    });
    return next;
  }

  async #write(id: Id): Promise<void> {
    const record = this.#records.get(id);
    if (!record) return;
    const now = persistedOf(record);
    const before = this.#persisted.get(id);
    const lines = before ? diff(before, now, record) : null;
    if (lines && lines.length === 0) return;
    const liveBytes = liveSize(now);
    const live = now.items.size + now.tasks.size;
    if (lines && before) {
      const addedBytes = lines.reduce((sum, line) => sum + Buffer.byteLength(JSON.stringify(line)) + 1, 0);
      const totalLines = before.lines + lines.length;
      const totalBytes = before.bytes + addedBytes;
      const tooLong = totalLines > live * COMPACT_LINE_FACTOR + COMPACT_LINE_SLACK;
      const tooBig = totalBytes > liveBytes * COMPACT_BYTE_FACTOR + COMPACT_BYTE_SLACK;
      if (!tooLong && !tooBig) {
        const written = await appendJsonl(
          this.#file(id),
          lines.map((line) => JSON.stringify(line)),
          { header: CONVERSATION_LOG_HEADER, durable: false },
        );
        this.#persisted.set(id, { ...now, lines: totalLines, bytes: before.bytes + written });
        return;
      }
    }
    // New conversation, changed order (a deletion or an insertion), or a log that is too long: the whole record is written as one snapshot line, replacing the file atomically.
    const bytes = await writeSnapshot(this.#file(id), record);
    this.#persisted.set(id, { ...now, lines: 1, bytes });
  }
}

function isSnapshot(value: unknown): value is { op: 'snapshot' } & ConversationRecord {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<ConversationLogLine & ConversationRecord>;
  return line.op === 'snapshot' && !!line.conversation && typeof line.conversation.id === 'string' && Array.isArray(line.items);
}

function persistedOf(record: ConversationRecord): Omit<Persisted, 'lines' | 'bytes'> {
  const items = new Map<Id, string>();
  for (const item of record.items) items.set(item.id, JSON.stringify(item));
  const tasks = new Map<Id, string>();
  for (const [taskId, log] of Object.entries(record.tasks ?? {})) tasks.set(taskId, JSON.stringify(log));
  return {
    conversation: JSON.stringify(record.conversation),
    seq: JSON.stringify(record.seq),
    agent: JSON.stringify(record.agent),
    items,
    order: record.items.map((item) => item.id),
    tasks,
  };
}

/**
 * The lines to append since the last disk write. Returns null when the state cannot be reproduced by appending and replaying (an item was deleted or reordered, a task was deleted,
 * or the record has duplicate item ids). In that case a snapshot must be written.
 */
function diff(before: Persisted, now: Omit<Persisted, 'lines' | 'bytes'>, record: ConversationRecord): ConversationLogLine[] | null {
  if (now.order.length < before.order.length || now.items.size !== now.order.length) return null;
  for (let i = 0; i < before.order.length; i++) if (now.order[i] !== before.order[i]) return null;
  for (const taskId of before.tasks.keys()) if (!now.tasks.has(taskId)) return null;

  const lines: ConversationLogLine[] = [];
  const meta: Extract<ConversationLogLine, { op: 'meta' }> = { op: 'meta' };
  if (now.conversation !== before.conversation) meta.conversation = record.conversation;
  if (now.seq !== before.seq) meta.seq = record.seq;
  if (now.agent !== before.agent) meta.agent = record.agent;
  for (const [taskId, text] of now.tasks) {
    if (before.tasks.get(taskId) === text) continue;
    (meta.tasks ??= {})[taskId] = record.tasks![taskId]!;
  }
  for (const item of record.items) {
    if (before.items.get(item.id) !== now.items.get(item.id)) lines.push({ op: 'item', item });
  }
  if (Object.keys(meta).length > 1) lines.push(meta);
  return lines;
}

function liveSize(now: Omit<Persisted, 'lines' | 'bytes'>): number {
  let bytes = Buffer.byteLength(now.conversation) + Buffer.byteLength(now.seq) + Buffer.byteLength(now.agent);
  for (const text of now.items.values()) bytes += Buffer.byteLength(text);
  for (const text of now.tasks.values()) bytes += Buffer.byteLength(text);
  return bytes;
}

/** Writes a snapshot line as the file's header, replacing the file atomically (no fsync: a conversation does not need to survive power loss). */
function writeSnapshot(file: string, record: ConversationRecord): Promise<number> {
  return compactJsonl(file, [JSON.stringify({ op: 'snapshot', ...record })], { header: CONVERSATION_LOG_HEADER, durable: false });
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

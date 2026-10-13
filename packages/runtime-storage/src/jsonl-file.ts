import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncDir } from './json-file.ts';

/**
 * Append-only JSONL file: one JSON value per line, and the first line is the header. For ledgers that account per entry and change only a few entries at a time (the task and app ledgers, architecture design §7.3). Appending a few lines fsyncs, with no whole-file rewrite; when there are too many lines, the caller compacts the file into a new one as a whole.
 *
 * - `appendJsonl`: append lines and fsync the file; if the file is new (or empty), write the header first and fsync the directory.
 * - `readJsonl`: read the lines. A truncated trailing line (crash) and lines that cannot be recognized are skipped and counted. If the first line cannot be recognized, the whole file is treated as corrupt.
 * - `compactJsonl`: write the header and all lines to a temporary file, fsync it, rename it over the original, then fsync the directory.
 *
 * None of the three queues. The caller must put appends and compaction on the same file on the same serial write chain. On macOS, Node's fsync is not `F_FULLFSYNC`.
 *
 * `durable: false` (default true): appends and compaction do not fsync the file or the directory. For data that does not need to survive a power loss (session records, §3.10).
 */

export interface JsonlWriteOptions {
  header: unknown;
  mode?: number;
  /** Default true: fsync the file, and when creating or renaming, also fsync the directory. When false, do neither. */
  durable?: boolean;
}

export interface JsonlReadResult {
  /** First line (the header); null for an empty file. */
  header: unknown;
  /** Lines after the header that can be parsed, in file order. */
  rows: unknown[];
  /** Number of skipped lines (not counting the trailing torn line). */
  skipped: number;
  /** The last line has no trailing newline (a crash cut the write short): skipped if it cannot be parsed, kept if it can. */
  truncatedTail: boolean;
  /** Number of lines after the header (including skipped and torn lines), so the caller can decide when to compact. */
  lines: number;
  bytes: number;
}

export class JsonlCorruptError extends Error {
  readonly file: string;

  constructor(file: string) {
    super(`Unrecognized JSONL file: ${file}`);
    this.name = 'JsonlCorruptError';
    this.file = file;
  }
}

/** `null` if the file does not exist. Throws `JsonlCorruptError` if the first line (the header) is not JSON. */
export async function readJsonl(file: string): Promise<JsonlReadResult | null> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const bytes = Buffer.byteLength(text);
  if (text.length === 0) return { header: null, rows: [], skipped: 0, truncatedTail: false, lines: 0, bytes };
  const truncatedTail = !text.endsWith('\n');
  const parts = text.split('\n');
  if (!truncatedTail) parts.pop();
  // The whole file is only a partial line: it crashed during the first append (the header and first line are written together), or the read landed in the middle of that write. Treat it as an empty file.
  if (truncatedTail && parts.length === 1) return { header: null, rows: [], skipped: 0, truncatedTail, lines: 0, bytes };
  let header: unknown;
  try {
    header = JSON.parse(parts[0]!);
  } catch {
    throw new JsonlCorruptError(file);
  }
  const rows: unknown[] = [];
  let skipped = 0;
  for (let i = 1; i < parts.length; i++) {
    const line = parts[i]!;
    const tail = truncatedTail && i === parts.length - 1;
    try {
      if (line.trim() === '') throw new Error('empty line');
      rows.push(JSON.parse(line));
    } catch {
      if (!tail) skipped++;
    }
  }
  return { header, rows, skipped, truncatedTail, lines: parts.length - 1, bytes };
}

/**
 * Append several lines (already serialized, without newlines) and fsync. If the file is missing or empty, write `header` first and fsync the directory (so the new file reaches the disk).
 * If the file does not end with a newline (the previous write was cut short), add one first so the new lines do not join the torn line. Returns the number of bytes written.
 */
export async function appendJsonl(file: string, rows: readonly string[], options: JsonlWriteOptions): Promise<number> {
  const durable = options.durable ?? true;
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  // `a+`: writes always go to the end, and the last byte can still be read.
  const handle = await fs.open(file, 'a+', options.mode ?? 0o644);
  let created = false;
  let written: number;
  try {
    const { size } = await handle.stat();
    let text = '';
    if (size === 0) {
      created = true;
      text = `${JSON.stringify(options.header)}\n`;
    } else {
      const last = Buffer.alloc(1);
      await handle.read(last, 0, 1, size - 1);
      if (last[0] !== 0x0a) text = '\n';
    }
    for (const row of rows) text += `${row}\n`;
    written = Buffer.byteLength(text);
    await handle.writeFile(text);
    if (durable) await handle.sync();
  } finally {
    await handle.close().catch(() => {});
  }
  if (created && durable) await syncDir(dir);
  return written;
}

/** Atomically replace the file with the header plus these lines: write the temporary file, fsync it, rename it, then fsync the directory. Returns the byte size of the new file. */
export async function compactJsonl(file: string, rows: readonly string[], options: JsonlWriteOptions): Promise<number> {
  const durable = options.durable ?? true;
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  let text = `${JSON.stringify(options.header)}\n`;
  for (const row of rows) text += `${row}\n`;
  const handle = await fs.open(tmp, 'w', options.mode ?? 0o644);
  try {
    await handle.writeFile(text);
    if (durable) await handle.sync();
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
  await handle.close();
  await fs.rename(tmp, file).catch(async (error: unknown) => {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  });
  if (durable) await syncDir(dir);
  return Buffer.byteLength(text);
}

/** An unrecognizable file is kept by renaming it (`<file>.corrupt-<time>`), not silently overwritten. Returns the renamed path. */
export async function quarantineFile(file: string): Promise<string> {
  const to = `${file}.corrupt-${Date.now()}`;
  await fs.rename(file, to).catch(() => {});
  return to;
}

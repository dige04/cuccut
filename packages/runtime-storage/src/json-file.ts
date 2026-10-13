import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Atomic write: write a temporary file in the same directory first, then rename it, so a crash never leaves a half-written JSON.
 *
 * `durable`: fsync the temporary file before the rename, then fsync the containing directory after the rename. Once the write resolves, both the content and the rename have been handed to the disk, so after a power loss the file reads back as this write or an earlier complete version, never an older one. Used for the authorization ledger (architecture design §7.8; the task and app ledgers were changed to append-only JSONL, see `jsonl-file.ts`). It adds two fsyncs per write. On macOS, Node's fsync is not `F_FULLFSYNC`, so it does not guarantee that the disk's own write cache is flushed.
 */
export async function writeJsonAtomic(file: string, value: unknown, options: { mode?: number; durable?: boolean } = {}): Promise<void> {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!options.durable) {
    await fs.writeFile(tmp, text, { mode: options.mode ?? 0o644 });
    await fs.rename(tmp, file);
    return;
  }
  const handle = await fs.open(tmp, 'w', options.mode ?? 0o644);
  try {
    await handle.writeFile(text);
    await handle.sync();
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
  await syncDir(dir);
}

/** fsync a directory (so the rename inside it reaches the disk). Skipped on platforms that cannot open or sync directories (Windows). */
export async function syncDir(dir: string): Promise<void> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(dir, 'r');
  } catch (error) {
    if (UNSUPPORTED.has((error as NodeJS.ErrnoException).code ?? '')) return;
    throw error;
  }
  try {
    await handle.sync();
  } catch (error) {
    if (!UNSUPPORTED.has((error as NodeJS.ErrnoException).code ?? '')) throw error;
  } finally {
    await handle.close().catch(() => {});
  }
}

const UNSUPPORTED = new Set(['EISDIR', 'EPERM', 'EINVAL', 'EACCES', 'ENOTSUP']);

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

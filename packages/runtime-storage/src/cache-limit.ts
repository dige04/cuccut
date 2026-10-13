import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * The total size limit for `<runtime-home>/cache/` (architecture design §5.1, “derived cache”). Everything in the cache can be deleted and rebuilt, but nothing cleans it up,
 * so media analysis (waveforms, thumbnails, frames) and playback transcodes keep growing. When over the limit, files are deleted from oldest to newest by modification time, down to `targetRatio` of the limit (default 90%).
 *
 * Not deleted:
 * - `content-index/`: the SQLite database for cross-video search (`index.db` with `-wal` and `-shm`). Deleting it while open would corrupt the database; it cleans up its own leftover temporary files at startup (§5.11).
 * - `cuccut-composition-host/`: the scripts of the code-picture host. A live host process is using them, and they are small.
 * - Temporary files (names containing `.tmp`) modified within the grace period (1 hour): transcodes and analysis results being written.
 *
 * These files still count toward the total size (the limit covers the whole directory); they are just not candidates for deletion. Subdirectories that have become empty (modified longer ago than the grace period) are deleted too.
 */

/** Top-level subdirectories under `cache/` that do not take part in eviction. */
export const CACHE_PROTECTED_DIRS: readonly string[] = ['content-index', 'cuccut-composition-host'];

const TEMPORARY_GRACE_MS = 60 * 60 * 1000;

export interface CacheTrimOptions {
  /** The limit, in bytes. */
  maxBytes: number;
  /** When over the limit, the fraction (0–1) to reduce to. Default 0.9. */
  targetRatio?: number;
  /** Names of top-level subdirectories that do not take part in eviction. Default `CACHE_PROTECTED_DIRS`. */
  protectedDirs?: readonly string[];
  now?: number;
}

export interface CacheTrimResult {
  /** Total size before cleanup (including protected files). */
  totalBytes: number;
  /** Size of the protected files. */
  protectedBytes: number;
  removed: number;
  removedBytes: number;
  /** Number of files that could not be deleted (in use, or no permission). */
  failed: number;
  /** Total size after cleanup. */
  remainingBytes: number;
}

interface CacheFile {
  file: string;
  size: number;
  mtimeMs: number;
}

/** Reduces `dir` to within the limit. Does nothing if the directory does not exist. */
export async function trimCache(dir: string, options: CacheTrimOptions): Promise<CacheTrimResult> {
  const now = options.now ?? Date.now();
  const protectedDirs = new Set(options.protectedDirs ?? CACHE_PROTECTED_DIRS);
  const candidates: CacheFile[] = [];
  const dirs: { dir: string; mtimeMs: number }[] = [];
  let totalBytes = 0;
  let protectedBytes = 0;

  const walk = async (current: string, isProtected: boolean): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const nested = isProtected || (current === dir && protectedDirs.has(entry.name));
        await walk(file, nested);
        if (!nested) {
          const stat = await fs.lstat(file).catch(() => null);
          if (stat) dirs.push({ dir: file, mtimeMs: stat.mtimeMs });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.lstat(file).catch(() => null);
      if (!stat?.isFile()) continue;
      totalBytes += stat.size;
      const inFlight = entry.name.includes('.tmp') && stat.mtimeMs > now - TEMPORARY_GRACE_MS;
      if (isProtected || inFlight) protectedBytes += stat.size;
      else candidates.push({ file, size: stat.size, mtimeMs: stat.mtimeMs });
    }
  };
  await walk(dir, false);

  const result: CacheTrimResult = { totalBytes, protectedBytes, removed: 0, removedBytes: 0, failed: 0, remainingBytes: totalBytes };
  if (totalBytes <= options.maxBytes) return result;

  const target = Math.floor(options.maxBytes * (options.targetRatio ?? 0.9));
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  let remaining = totalBytes;
  for (const candidate of candidates) {
    if (remaining <= target) break;
    try {
      await fs.unlink(candidate.file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') result.failed++;
      continue;
    }
    remaining -= candidate.size;
    result.removed++;
    result.removedBytes += candidate.size;
  }
  result.remainingBytes = remaining;

  // Subdirectories that became empty (deepest first). A newly created one is kept, since the writer may be about to put files in it.
  if (result.removed > 0) {
    for (const entry of dirs.sort((a, b) => b.dir.length - a.dir.length)) {
      if (entry.mtimeMs > now - TEMPORARY_GRACE_MS) continue;
      await fs.rmdir(entry.dir).catch(() => {});
    }
  }
  return result;
}

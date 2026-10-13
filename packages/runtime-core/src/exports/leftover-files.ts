import fs from 'node:fs/promises';
import path from 'node:path';
import type { JobRecord } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import { activeImportStaging, isImportStagingName } from '../videos/package-import.ts';
import { isHiddenTempOf } from './export-publish.ts';

/**
 * Startup cleanup of leftovers from a previous forced kill (architecture design §5.8):
 *
 * - Hidden export temp files: only looks at the target directories and output file names recorded by export jobs in the ledger that are still present and have finished, and deletes only regular files whose names are `.<output file name>.<8 hex digits>.tmp`. The (directory, file name) pairs used by queued or running exports are not touched. Temp files left by exports already pruned from the ledger cannot be found, so they are not deleted.
 * - Staging directories for opening portable packages: only looks at the first level of the source directory (the project directory, or the working directory of a session with no project) for directories named `.cuccut-import-<8 hex digits>`, skipping the ones used by in-progress opens in this process.
 *
 * Both kinds are deleted only if their modification time is earlier than `minAgeMs` (default 1 hour), so exports and opens that just started (including those in other processes) are not deleted. The kind is determined with `lstat`. Symbolic links are never touched, and no other directories are searched beneath them. User files whose names don't match are not deleted. Failures are only logged and do not affect startup.
 */

export const LEFTOVER_MIN_AGE_MS = 60 * 60 * 1000;

export interface LeftoverSweepOptions {
  /** Jobs in the ledger. */
  jobs: () => readonly JobRecord[];
  /** Source directory. */
  sourceRoots: () => readonly string[];
  log: Logger;
  minAgeMs?: number;
  now?: () => number;
}

export interface LeftoverSweepResult {
  removed: string[];
}

const ACTIVE = new Set(['queued', 'running']);

export async function sweepLeftovers(options: LeftoverSweepOptions): Promise<LeftoverSweepResult> {
  const cutoff = (options.now?.() ?? Date.now()) - (options.minAgeMs ?? LEFTOVER_MIN_AGE_MS);
  const log = options.log.child('leftovers');
  const removed: string[] = [];
  const old = (stat: { mtimeMs: number }) => stat.mtimeMs < cutoff;

  // Exports: target directory → output file names of finished exports; file names used by in-progress exports are excluded.
  const finished = new Map<string, Set<string>>();
  const busy = new Map<string, Set<string>>();
  for (const job of options.jobs()) {
    const destination = job.export?.destination;
    if (!destination) continue;
    const into = ACTIVE.has(job.state) ? busy : finished;
    const names = into.get(destination.dir) ?? new Set<string>();
    for (const file of destination.files) names.add(file);
    into.set(destination.dir, names);
  }
  for (const [dir, names] of finished) {
    const inUse = busy.get(dir) ?? new Set<string>();
    const candidates = [...names].filter((name) => !inUse.has(name));
    if (candidates.length === 0) continue;
    for (const name of await readNames(dir)) {
      if (!candidates.some((fileName) => isHiddenTempOf(name, fileName))) continue;
      const file = path.join(dir, name);
      const stat = await fs.lstat(file).catch(() => null);
      if (!stat?.isFile() || !old(stat)) continue;
      if (
        await fs.rm(file).then(
          () => true,
          (error) => (log.warn('Failed to remove leftover export temp file', { file, error: String(error) }), false),
        )
      )
        removed.push(file);
    }
  }

  // Opening portable packages: staging directories at the first level of the source directory.
  const active = activeImportStaging();
  const roots = new Set<string>();
  for (const root of options.sourceRoots()) roots.add(await fs.realpath(root).catch(() => root));
  for (const root of roots) {
    for (const name of await readNames(root)) {
      if (!isImportStagingName(name)) continue;
      const dir = path.join(root, name);
      if (active.has(dir)) continue;
      const stat = await fs.lstat(dir).catch(() => null);
      if (!stat?.isDirectory() || !old(stat)) continue;
      if (
        await fs.rm(dir, { recursive: true }).then(
          () => true,
          (error) => (log.warn('Failed to remove leftover package import staging folder', { dir, error: String(error) }), false),
        )
      )
        removed.push(dir);
    }
  }

  if (removed.length > 0) log.info('Removed leftover temp files and staging folders', { count: removed.length });
  return { removed };
}

async function readNames(dir: string): Promise<string[]> {
  return fs.readdir(dir).catch(() => []);
}

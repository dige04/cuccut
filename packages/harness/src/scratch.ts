import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Moves items between the working directory of a session that does not belong to a project (`RuntimeHome.scratchDir/<session>/`) and the project directory (architecture design §3.10).
 * Filesystem work only: checks whether a video is in it, gets the video's name, moves the entries into the project directory. Session and project records are managed by the Harness.
 */

/** Marker of a video directory (video format spec §1); directories from before the rename contain only `movie.db`. */
const VIDEO_DB_FILES = ['video.db', 'movie.db'];
/** Maximum depth to descend when looking for a video (same as Space's scan). */
const MAX_DEPTH = 6;

/** Whether the directory itself is a video. */
export async function isVideoDirectory(dir: string): Promise<boolean> {
  for (const name of VIDEO_DB_FILES) {
    const stat = await fs.stat(path.join(dir, name)).catch(() => null);
    if (stat?.isFile()) return true;
  }
  return false;
}

/** Whether the directory contains a video, including in subdirectories (hidden directories and symbolic links are skipped). False when the directory does not exist. */
export async function containsVideo(dir: string, depth = 0): Promise<boolean> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (await isVideoDirectory(full)) return true;
    if (depth < MAX_DEPTH && (await containsVideo(full, depth + 1))) return true;
  }
  return false;
}

/**
 * The name of the earliest-created video in the directory (same rules as `containsVideo`), i.e. the video directory name, for projects named after a video. null when there is no video.
 * Ordered by the creation time of the video library file (modification time if that is unavailable), ties broken by name.
 */
export async function firstVideoName(dir: string): Promise<string | null> {
  const found: { name: string; at: number }[] = [];
  const walk = async (current: string, depth: number): Promise<void> => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      const at = await videoCreatedAt(full);
      if (at !== null) found.push({ name: entry.name, at });
      else if (depth < MAX_DEPTH) await walk(full, depth + 1);
    }
  };
  await walk(dir, 0);
  found.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  return found[0]?.name ?? null;
}

async function videoCreatedAt(dir: string): Promise<number | null> {
  for (const name of VIDEO_DB_FILES) {
    const stat = await fs.stat(path.join(dir, name)).catch(() => null);
    if (stat?.isFile()) return stat.birthtimeMs || stat.mtimeMs;
  }
  return null;
}

/** Whether `child` is inside `parent` (not counting `parent` itself). */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Moves a file or directory under `destDir`. If the name is taken, a number is added (`name 2`, `name 3`…, extension kept). On the same volume this is a rename;
 * across volumes (`EXDEV`) it copies and then deletes the original. Returns the name in the target.
 */
export async function moveInto(source: string, destDir: string, name = path.basename(source)): Promise<string> {
  const ext = path.extname(name);
  const stem = ext && ext !== name ? name.slice(0, -ext.length) : name;
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? name : `${stem} ${n}${ext}`;
    const target = path.join(destDir, candidate);
    // `rename` replaces an empty directory or an existing file, so first confirm the target does not exist.
    if (await fs.lstat(target).then(() => true, () => false)) continue;
    try {
      await fs.rename(source, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
      await fs.rm(source, { recursive: true, force: true });
    }
    return candidate;
  }
  throw new Error(`Too many entries named ${name}`);
}

/**
 * Moves the entries in `from` as they are into `to` (excluding names in `skip`, hidden entries when `skipHidden`, and the directories in `busy` along with the directories that contain them). Relative paths stay the same (duplicates get a number).
 * Does nothing when `from` does not exist. Returns the moved entries: original name → name in the target.
 */
export async function moveEntries(
  from: string,
  to: string,
  options: { skip?: ReadonlySet<string>; skipHidden?: boolean; busy?: readonly string[] } = {},
): Promise<Map<string, string>> {
  const moved = new Map<string, string>();
  let names: string[];
  try {
    names = await fs.readdir(from);
  } catch {
    return moved;
  }
  const busy = (options.busy ?? []).map((p) => path.resolve(p));
  for (const name of names) {
    if (options.skip?.has(name) || (options.skipHidden && name.startsWith('.'))) continue;
    const full = path.join(from, name);
    if (busy.some((b) => b === full || isInside(full, b))) continue;
    moved.set(name, await moveInto(full, to, name));
  }
  return moved;
}

/** Deletes an empty directory. Does nothing if it is not empty or does not exist. */
export async function removeIfEmpty(dir: string): Promise<boolean> {
  try {
    await fs.rmdir(dir);
    return true;
  } catch {
    return false;
  }
}

/** Whether the project directory recorded at binding can still be used: it exists, is a directory, and is either empty or already a project (has `.ccut`, meaning a previous move stopped halfway). */
export async function reusableProjectDir(dir: string): Promise<boolean> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return false;
  }
  return names.length === 0 || names.includes('.ccut');
}

import { randomUUID } from 'node:crypto';
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolError } from './tool-catalog.ts';

/**
 * Writing for `artifacts_save` (architecture design §3.5): copies one artifact into a file in the session's working
 * directory. Only that one file is written:
 *
 * - the target must resolve inside the working directory (judged by real path; a directory reached through a symlink
 *   counts as outside);
 * - a target that is itself a symlink is rejected, never written through; an existing file is replaced only with
 *   `overwrite` (write a temp file, then rename; links are not followed);
 * - never writes into a video directory (one containing `video.db`) or `.ccut`: only the engine and the Runtime write there.
 */
export async function saveArtifactCopy(params: SaveParams): Promise<{ relPath: string; overwritten: boolean }> {
  return (await prepareArtifactSave(params)).commit();
}

interface SaveParams {
  source: string;
  root: string;
  target: string;
  overwrite: boolean;
}

/** A checked write plan: the target (relative to the working directory) and whether it already exists (overwrite); nothing is written until `commit` after confirmation. */
export interface ArtifactSavePlan {
  relPath: string;
  exists: boolean;
  commit(): Promise<{ relPath: string; overwritten: boolean }>;
}

/**
 * Check first, write later (§3.12): an invalid path is rejected here, before any approval is created; whether it
 * overwrites is known before confirmation (overwriting is `high`).
 * This step creates no directory and writes no file; `commit` checks the real paths again, and symlinks or files that
 * appear after the check are rejected too.
 */
export async function prepareArtifactSave(params: SaveParams): Promise<ArtifactSavePlan> {
  const rootReal = await fs.realpath(params.root);
  const extension = path.extname(params.source).slice(1).toLowerCase();
  const target = withExtension(params.target, extension);
  const resolved = path.resolve(rootReal, target);
  const name = path.basename(resolved);
  if (!name || resolved === rootReal) throw new ToolError('INVALID_PATH', 'path must be a file path');

  // The deepest existing ancestor directory is judged by its real path; the levels that do not exist yet are created here.
  const tail: string[] = [];
  let existing = path.dirname(resolved);
  for (;;) {
    const stat = await fs.lstat(existing).catch(() => null);
    if (stat) {
      if (!stat.isDirectory() && !stat.isSymbolicLink()) throw new ToolError('INVALID_PATH', `${path.basename(existing)} is not a directory`);
      break;
    }
    tail.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  const existingReal = await fs.realpath(existing).catch(() => null);
  if (!existingReal || !inside(existingReal, rootReal)) throw outside();
  await refuseVideoDirectory(rootReal, existingReal, [...tail, name]);

  // When every ancestor exists, check the target itself; if some level is missing, the target does not exist either.
  const planned = path.join(existingReal, ...tail, name);
  const found = tail.length === 0 ? await checkTarget(planned, rootReal, params.overwrite) : null;
  return {
    relPath: path.relative(rootReal, planned),
    exists: found !== null,
    // If what was confirmed is "create", a same-named file that appears later is not overwritten: overwriting needs its own `high` confirmation.
    commit: () => write({ ...params, overwrite: params.overwrite && found !== null }, rootReal, existingReal, tail, name),
  };
}

/** When the target already exists: rejects a symlink, a non-file, or a missing `overwrite`. Returns its stats; null when it does not exist. */
async function checkTarget(file: string, rootReal: string, overwrite: boolean): Promise<Stats | null> {
  const current = await fs.lstat(file).catch(() => null);
  if (current?.isSymbolicLink()) throw new ToolError('PATH_IS_SYMLINK', 'The target is a symlink: use a different file name');
  if (current && !current.isFile()) throw new ToolError('INVALID_PATH', 'The target already exists and is not a file');
  if (current && !overwrite) {
    throw new ToolError('PATH_EXISTS', 'The target file already exists: use a different file name; to really replace it, pass overwrite: true', {
      path: path.relative(rootReal, file),
    });
  }
  return current;
}

async function write(
  params: SaveParams,
  rootReal: string,
  existingReal: string,
  tail: string[],
  name: string,
): Promise<{ relPath: string; overwritten: boolean }> {
  const dir = path.join(existingReal, ...tail);
  await fs.mkdir(dir, { recursive: true });
  const dirReal = await fs.realpath(dir);
  if (!inside(dirReal, rootReal)) throw outside();
  const file = path.join(dirReal, name);
  const current = await checkTarget(file, rootReal, params.overwrite);

  const bytes = await fs.readFile(params.source);
  if (!current) {
    // 'wx': fails if it already exists (including a symlink appearing meanwhile); never overwrites or follows.
    try {
      await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o644 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new ToolError('PATH_EXISTS', 'The target file already exists: use a different file name; to really replace it, pass overwrite: true');
      }
      throw error;
    }
  } else {
    const tmp = path.join(dirReal, `.${name}.${randomUUID()}.tmp`);
    await fs.writeFile(tmp, bytes, { flag: 'wx', mode: 0o644 });
    await fs.rename(tmp, file).catch(async (error: unknown) => {
      await fs.rm(tmp, { force: true });
      throw error;
    });
  }
  return { relPath: path.relative(rootReal, file), overwritten: Boolean(current) };
}

/** Appends the artifact's extension when none is given; rejects a different extension (jpg and jpeg count as the same). */
function withExtension(target: string, extension: string): string {
  const given = path.extname(target).slice(1).toLowerCase();
  if (!given) return `${target}.${extension}`;
  const same = given === extension || (given === 'jpeg' && extension === 'jpg');
  if (!same) throw new ToolError('EXTENSION_MISMATCH', `This artifact is a .${extension} file; the extension in path must match (or be omitted)`, { extension });
  return target;
}

/** Rejects a target inside a video directory or `.ccut`: no level between the working directory and the target may be one. */
export async function refuseVideoDirectory(rootReal: string, existingReal: string, rest: string[]): Promise<void> {
  const relative = path.relative(rootReal, existingReal);
  const segments = [...(relative ? relative.split(path.sep) : []), ...rest];
  if (segments.includes('.ccut') || ['video.db', 'video.lock'].includes(rest[rest.length - 1]!)) throw insideVideo();
  let dir = existingReal;
  for (;;) {
    if (
      await fs.stat(path.join(dir, 'video.db')).then(
        () => true,
        () => false,
      )
    )
      throw insideVideo();
    if (dir === rootReal) return;
    dir = path.dirname(dir);
  }
}

export function inside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export function outside(): ToolError {
  return new ToolError('PATH_OUTSIDE_WORKSPACE', 'You can only write inside this session\'s working directory (a relative path, no .., not through a symlink pointing elsewhere)');
}

function insideVideo(): ToolError {
  return new ToolError(
    'PATH_INSIDE_VIDEO',
    'Cannot write into a video directory (one containing video.db) or .ccut: choose another location in the working directory; to put it into a video, use importAsset in edits_apply',
  );
}

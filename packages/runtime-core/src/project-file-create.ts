import fsp from 'node:fs/promises';
import path from 'node:path';
import { RpcError, type FileTarget, type Id, type ProjectFileEntry } from '@cuccut/protocol';
import { RcExport, RcRuntime, RcSpace, RcWeb } from '@cuccut/protocol/messages/runtime-core';
import { classifyFile, isIgnoredName } from './space-catalog.ts';

/**
 * `projects.files.create` (architecture design §11.2; product design §3.3, the “new web page” on the new-tab start page): creates a file exclusively in the project directory (or in the working directory of a session without a project). Same root directory and same out-of-bounds and ignore rules as `projects.files.list`:
 *
 * - `dir` is relative to the root directory, and defaults to the root. After resolving symlinks it must still be inside the root, and it cannot land in a hidden directory, a dependency directory, or a video directory (one that contains `video.db`).
 * - `name` keeps only the last segment. It rejects empty names, `.`, `..`, names starting with `.`, and dependency directory names; control characters are rejected too.
 * - Created with `wx` (exclusive), so it never overwrites an existing file: on a name clash it tries `name 2.ext`, `name 3.ext`, and so on.
 */

/** Whom the new file belongs to: when in a project, it is located by the project (the same tab as the project files tab and what Space opens); otherwise by the session. */
export type ProjectFileScope = { projectId: Id } | { conversationId: Id };

export interface ProjectFileCreateParams {
  name: string;
  content: string;
  dir?: string;
}

/** Maximum number to try when incrementing a duplicate name. */
const MAX_ATTEMPTS = 1000;

function isInside(rootReal: string, target: string): boolean {
  if (target === rootReal) return true;
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  return target.startsWith(prefix);
}

/** A directory containing `video.db` (called `movie.db` before the rename) is a video: the files inside belong to the video. */
async function isVideoDir(dir: string): Promise<boolean> {
  for (const name of ['video.db', 'movie.db']) {
    const stat = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (stat?.isFile()) return true;
  }
  return false;
}

/** Resolves `dir`: returns the logical relative path (`/`-separated) and the real path. Error codes match `projects.files.list`. */
async function resolveDir(root: string, rootReal: string, dir: string | undefined): Promise<{ rel: string; real: string }> {
  const raw = dir ?? '';
  if (raw.includes('\0')) throw new RpcError('invalid-request', RcRuntime.folderPathInvalid());
  if (path.isAbsolute(raw)) throw new RpcError('invalid-request', RcRuntime.folderPathMustBeRelative());
  const relNative = path.relative(root, path.resolve(root, raw));
  if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) {
    throw new RpcError('invalid-request', RcRuntime.folderOutsideProject());
  }
  const parts = relNative.split(path.sep).filter(Boolean);
  if (parts.some(isIgnoredName)) throw new RpcError('invalid-request', RcSpace.hiddenDirFile());
  let real: string;
  try {
    real = await fsp.realpath(path.join(root, relNative));
  } catch {
    throw new RpcError('not-found', RcRuntime.folderNotFound());
  }
  if (!isInside(rootReal, real)) throw new RpcError('invalid-request', RcRuntime.folderOutsideProject());
  const stat = await fsp.stat(real).catch(() => null);
  if (!stat) throw new RpcError('not-found', RcRuntime.folderNotFound());
  if (!stat.isDirectory()) throw new RpcError('invalid-request', RcRuntime.notAFolder());
  // The target directory itself and each of its ancestors (below the root) must not be a video directory.
  for (let i = parts.length; i > 0; i--) {
    if (await isVideoDir(path.join(root, ...parts.slice(0, i)))) throw new RpcError('invalid-request', RcSpace.videoDirFile());
  }
  if (path.relative(rootReal, real) && (await isVideoDir(real))) throw new RpcError('invalid-request', RcSpace.videoDirFile());
  return { rel: parts.join('/'), real };
}

/** The file name keeps only the last segment; invalid ones are rejected. */
function fileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new RpcError('invalid-request', RcWeb.fileNameInvalid());
  const base = path.basename(name.replaceAll('\\', '/').trim());
  if (!base) throw new RpcError('invalid-request', RcWeb.fileNameLength({ max: 255 }));
  // `.`, `..` and other names starting with a dot all count as hidden.
  if (isIgnoredName(base)) throw new RpcError('invalid-request', RcSpace.hiddenDirFile());
  return base;
}

/** The nth candidate name: 1 is the original name; after that, `name n.ext` (the extension is what follows the last dot; a leading dot does not count). */
export function numberedName(name: string, n: number): string {
  if (n <= 1) return name;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} ${n}${name.slice(dot)}` : `${name} ${n}`;
}

/** Implementation of `projects.files.create`. `root` is the registered root directory (the project directory or the session's working directory); `scope` decides how the returned location is written. */
export async function createProjectFile(
  root: string,
  scope: ProjectFileScope,
  params: ProjectFileCreateParams,
): Promise<{ target: FileTarget; entry: ProjectFileEntry }> {
  let rootReal: string;
  try {
    rootReal = await fsp.realpath(root);
  } catch {
    throw new RpcError('not-found', RcRuntime.projectFolderNotFound());
  }
  const base = fileName(params.name);
  const dir = await resolveDir(root, rootReal, params.dir);
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const name = numberedName(base, n);
    const full = path.join(dir.real, name);
    try {
      await fsp.writeFile(full, params.content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
      // No permission, read-only volume, and similar errors are passed to the gateway as they are (`internal`, with the reason in the log).
      throw error;
    }
    const stat = await fsp.stat(full);
    const rel = dir.rel ? `${dir.rel}/${name}` : name;
    return {
      target: 'projectId' in scope ? { projectId: scope.projectId, path: rel } : { conversationId: scope.conversationId, path: rel },
      entry: { path: rel, name, isDir: false, size: stat.size, modifiedAt: new Date(stat.mtimeMs).toISOString(), kind: classifyFile(name) },
    };
  }
  throw new RpcError('conflict', RcExport.destinationFileExists({ fileName: base }));
}

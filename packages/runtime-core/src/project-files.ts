import type { Dirent, Stats } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_PROJECT_FILES_LIMIT,
  RpcError,
  type ProjectFileEntry,
  type ProjectFilesList,
  type SpaceEntryKind,
} from '@cuccut/protocol';
import { DECK_FILE, readDeckSummary } from '@cuccut/slides';
import { CANVAS_FILE, readCanvasInfo } from '@cuccut/design';
import { DESIGN_SYSTEM_FILE, readDesignSystemInfo } from '@cuccut/design-system';
import { classifyFile, isIgnoredName } from './space-catalog.ts';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';

/**
 * Project file browsing (architecture design §11.2): read-only, limited to the directory of the project the session belongs to (or the working directory of a session without a project).
 *
 * - `dir` and every entry must be inside the root directory. If `dir` goes out of bounds after resolving symlinks, it is rejected (`invalid-request`). Symlinks that point out of the root, and dangling links, are not listed.
 * - Hidden files and dependency directories are skipped, using the same ignore table as Space: `.git`, `.cuccut`, `node_modules`, and so on.
 * - When searching, it does not enter symlinked directories (to avoid loops), and does not enter video directories (containing `video.db`), slide directories (containing `deck.json`), design canvas directories (containing `canvas.json`), or design system directories (containing `design-system.json`). Each of those counts as one entry as a whole.
 * - The returned `path` is built from the directory's logical path (not inferred from the real path), so it can be passed as-is to `{ conversationId, path }`.
 */

export interface ProjectFilesLimits {
  /** Without a `limit`, the maximum number of entries a one-level listing returns. */
  listLimit: number;
  /** Without a `limit`, the maximum number of results a search returns. */
  searchLimit: number;
  /** The maximum depth a search goes into subdirectories; `dir` itself is 0. */
  maxDepth: number;
  /** The maximum number of directory entries a search examines, so a very large directory cannot be searched forever. */
  maxVisited: number;
  /** The maximum number of candidates a search keeps (before sorting). */
  maxCandidates: number;
}

export const DEFAULT_PROJECT_FILES_LIMITS: ProjectFilesLimits = {
  listLimit: 500,
  searchLimit: 200,
  maxDepth: 12,
  maxVisited: 50_000,
  maxCandidates: 2000,
};

export interface ProjectFilesParams {
  dir?: string;
  query?: string;
  limit?: number;
}

/** A candidate: first settle its name, type and sort info; only the entries to be returned get their size and time fetched at the end. */
interface Candidate {
  path: string;
  name: string;
  /** The real path used to fetch size and time (symlinks resolved). */
  full: string;
  isDir: boolean;
  kind: SpaceEntryKind | null;
  /** States already fetched (symlinks, and the `video.db` of video directories). */
  stat: Stats | null;
  depth: number;
  rank: number;
}

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

function compareNames(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

function isInside(rootReal: string, target: string): boolean {
  if (target === rootReal) return true;
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  return target.startsWith(prefix);
}

function joinRel(rel: string, name: string): string {
  return rel ? `${rel}/${name}` : name;
}

/** A directory containing `video.db` (called `movie.db` before the rename) is a video; returns the state of the database file. */
async function videoDb(dir: string): Promise<Stats | null> {
  for (const name of ['video.db', 'movie.db']) {
    const stat = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (stat?.isFile()) return stat;
  }
  return null;
}

/** The state of `deck.json` for a slide directory (one containing a valid `deck.json`, docs/design/slides §7.3); null if it is not one. */
async function deckFile(dir: string): Promise<Stats | null> {
  if (!(await readDeckSummary(dir))) return null;
  return fsp.stat(path.join(dir, DECK_FILE)).catch(() => null);
}

/** Design canvas directory (docs/design/canvas §2.1): returns the state of a valid canvas.json if there is one, otherwise null. */
async function canvasFile(dir: string): Promise<Stats | null> {
  if (!(await readCanvasInfo(dir))) return null;
  return fsp.stat(path.join(dir, CANVAS_FILE)).catch(() => null);
}

/** Design system directory (docs/design/canvas §10.1): returns the state of a valid design-system.json if there is one, otherwise null. */
async function designSystemFile(dir: string): Promise<Stats | null> {
  if (!(await readDesignSystemInfo(dir))) return null;
  return fsp.stat(path.join(dir, DESIGN_SYSTEM_FILE)).catch(() => null);
}

/**
 * Looks at one directory entry. A symlink is resolved to its real path; if it is out of bounds or dangling, returns null. Entries that are neither regular files nor directories also return null.
 * Ordinary entries are not realpath'd, because their parent directory is already confirmed to be inside the root.
 */
async function inspect(
  rootReal: string,
  dirReal: string,
  dirent: Dirent,
): Promise<{ full: string; isDir: boolean; isLink: boolean; stat: Stats | null } | null> {
  const full = path.join(dirReal, dirent.name);
  if (dirent.isSymbolicLink()) {
    const real = await fsp.realpath(full).catch(() => null);
    if (!real || !isInside(rootReal, real)) return null;
    const stat = await fsp.stat(real).catch(() => null);
    if (!stat || !(stat.isFile() || stat.isDirectory())) return null;
    return { full: real, isDir: stat.isDirectory(), isLink: true, stat };
  }
  if (dirent.isDirectory()) return { full, isDir: true, isLink: false, stat: null };
  if (dirent.isFile()) return { full, isDir: false, isLink: false, stat: null };
  return null;
}

/** Ranking of a name match: exact match 0, prefix match 1, contains 2; no match -1. */
function matchRank(name: string, query: string): number {
  const lower = name.toLowerCase();
  if (lower === query) return 0;
  if (lower.startsWith(query)) return 1;
  return lower.includes(query) ? 2 : -1;
}

/** Resolves `dir`: returns the logical relative path (`/`-separated) and the real path. */
async function resolveDir(root: string, rootReal: string, dir: string | undefined): Promise<{ rel: string; real: string }> {
  const raw = dir ?? '';
  if (raw.includes('\0')) throw new RpcError('invalid-request', RcRuntime.folderPathInvalid());
  if (path.isAbsolute(raw)) throw new RpcError('invalid-request', RcRuntime.folderPathMustBeRelative());
  const relNative = path.relative(root, path.resolve(root, raw));
  if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) {
    throw new RpcError('invalid-request', RcRuntime.folderOutsideProject());
  }
  const rel = relNative.split(path.sep).filter(Boolean).join('/');
  if (rel && rel.split('/').some(isIgnoredName)) throw new RpcError('invalid-request', RcRuntime.folderNotBrowsable());
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
  return { rel, real };
}

async function readDir(dir: string): Promise<Dirent[] | null> {
  try {
    return await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** Fetches size and time for the candidates to return. Any that fail to fetch (deleted in the meantime) are dropped. */
async function toEntries(candidates: Candidate[]): Promise<ProjectFileEntry[]> {
  const entries = await Promise.all(
    candidates.map(async (c): Promise<ProjectFileEntry | null> => {
      const stat = c.stat ?? (await fsp.stat(c.full).catch(() => null));
      if (!stat) return null;
      return {
        path: c.path,
        name: c.name,
        isDir: c.isDir,
        size: c.isDir ? null : stat.size,
        modifiedAt: new Date(stat.mtimeMs).toISOString(),
        kind: c.kind,
      };
    }),
  );
  return entries.filter((e): e is ProjectFileEntry => e !== null);
}

async function candidateOf(
  rootReal: string,
  dirReal: string,
  rel: string,
  dirent: Dirent,
  depth: number,
  rank: number,
): Promise<(Candidate & { isLink: boolean }) | null> {
  const found = await inspect(rootReal, dirReal, dirent);
  if (!found) return null;
  let kind: SpaceEntryKind | null = null;
  let stat = found.stat;
  if (found.isDir) {
    const db = await videoDb(found.full);
    const deck = db ? null : await deckFile(found.full);
    const canvas = db || deck ? null : await canvasFile(found.full);
    const system = db || deck || canvas ? null : await designSystemFile(found.full);
    if (db) {
      kind = 'video';
      stat = db;
    } else if (deck) {
      kind = 'slides';
      stat = deck;
    } else if (canvas) {
      kind = 'design';
      stat = canvas;
    } else if (system) {
      kind = 'design-system';
      stat = system;
    }
  } else kind = classifyFile(dirent.name);
  return {
    path: joinRel(rel, dirent.name),
    name: dirent.name,
    full: found.full,
    isDir: found.isDir,
    isLink: found.isLink,
    kind,
    stat,
    depth,
    rank,
  };
}

async function listOne(rootReal: string, dir: { rel: string; real: string }, limit: number): Promise<{ entries: ProjectFileEntry[]; truncated: boolean }> {
  const dirents = await readDir(dir.real);
  if (!dirents) throw new RpcError('forbidden', RcRuntime.folderUnreadable());
  const candidates: Candidate[] = [];
  for (const dirent of dirents) {
    if (isIgnoredName(dirent.name)) continue;
    const candidate = await candidateOf(rootReal, dir.real, dir.rel, dirent, 0, 0);
    if (candidate) candidates.push(candidate);
  }
  candidates.sort((a, b) => Number(b.isDir) - Number(a.isDir) || compareNames(a.name, b.name));
  return { entries: await toEntries(candidates.slice(0, limit)), truncated: candidates.length > limit };
}

async function search(
  rootReal: string,
  start: { rel: string; real: string },
  query: string,
  limit: number,
  limits: ProjectFilesLimits,
): Promise<{ entries: ProjectFileEntry[]; truncated: boolean }> {
  const candidates: Candidate[] = [];
  const queue: { rel: string; real: string; depth: number }[] = [{ ...start, depth: 0 }];
  let visited = 0;
  let truncated = false;
  walk: while (queue.length > 0) {
    const { rel, real, depth } = queue.shift()!;
    const dirents = await readDir(real);
    if (!dirents) {
      if (depth === 0) throw new RpcError('forbidden', RcRuntime.folderUnreadable());
      continue;
    }
    dirents.sort((a, b) => compareNames(a.name, b.name));
    for (const dirent of dirents) {
      if (++visited > limits.maxVisited) {
        truncated = true;
        break walk;
      }
      if (isIgnoredName(dirent.name)) continue;
      const rank = matchRank(dirent.name, query);
      // A non-matching file need not be looked at again; a directory still has to be searched inside.
      if (rank < 0 && !dirent.isDirectory()) continue;
      const candidate = await candidateOf(rootReal, real, rel, dirent, depth, rank);
      if (!candidate) continue;
      if (rank >= 0) {
        if (candidates.length >= limits.maxCandidates) {
          truncated = true;
          break walk;
        }
        candidates.push(candidate);
      }
      if (candidate.isDir && !candidate.isLink && candidate.kind !== 'video' && candidate.kind !== 'slides' && candidate.kind !== 'design' && candidate.kind !== 'design-system' && depth < limits.maxDepth) {
        queue.push({ rel: candidate.path, real: candidate.full, depth: depth + 1 });
      }
    }
  }
  candidates.sort((a, b) => a.rank - b.rank || a.depth - b.depth || compareNames(a.path, b.path));
  return {
    entries: await toEntries(candidates.slice(0, limit)),
    truncated: truncated || candidates.length > limit,
  };
}

/**
 * Implementation of `projects.files.list`. `root` is the registered root directory (the project directory or the session's working directory), returned as-is.
 */
export async function listProjectFiles(
  root: string,
  params: ProjectFilesParams,
  limits: ProjectFilesLimits = DEFAULT_PROJECT_FILES_LIMITS,
): Promise<ProjectFilesList> {
  let rootReal: string;
  try {
    rootReal = await fsp.realpath(root);
  } catch {
    throw new RpcError('not-found', RcRuntime.projectFolderNotFound());
  }
  const dir = await resolveDir(root, rootReal, params.dir);
  const query = (params.query ?? '').trim().toLowerCase();
  const cap = (fallback: number) => Math.max(1, Math.min(params.limit ?? fallback, MAX_PROJECT_FILES_LIMIT));
  const result = query
    ? await search(rootReal, dir, query, cap(limits.searchLimit), limits)
    : await listOne(rootReal, dir, cap(limits.listLimit));
  return { root, ...result };
}

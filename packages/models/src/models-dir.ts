import crypto from 'node:crypto';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { ModelsDirRepo } from '@cuccut/protocol';
import { requiredSources, type BundleDefinition } from './bundle-registry.ts';
import { INSTALL_RECORD_FILE, readInstallRecord, updateInstallRecord } from './install-record.ts';
import { readManifest } from './model-catalog.ts';

/**
 * Disk operations of the model directory (architecture design §6.3): recognise the models in a folder, check whether they are usable, and move models from one directory to another.
 * "Switching over" (changing the setting, changing the root of the model directory) is not done here; the Runtime's model directory service does it after the move succeeds.
 *
 * A move only touches what CucCut recognises: under `<owner>/<repo>/`, a valid `.ccut-manifest.json` and the repositories and revisions used by a registered model package, plus the install record `.ccut-installs.json` (merged into the target's record). Other files (put there by other programs, or unfinished downloads in the staging area) stay where they are.
 *
 * - Same volume: rename each repository over; rollback is renaming it back.
 * - Across volumes: first copy into `.ccut-moving/` in the target, check each file against the manifest's size and sha256, and rename into place once all are present; rollback deletes the copies.
 *   Files in the original directory are deleted only after the Runtime has switched over (`removeSources`).
 * - Before starting, write a log `.ccut-move.json` in the original directory: if the Runtime crashes midway through a move, the next startup rolls back using it (`recoverMove`).
 */

/** Staging directory for cross-volume copies (inside the target directory). */
export const MOVING_DIR = '.ccut-moving';
/** Move log (in the original directory). */
export const MOVE_JOURNAL_FILE = '.ccut-move.json';

export interface ModelsDirScan {
  repos: ModelsDirRepo[];
  /** Model packages whose repositories and revisions are all in this folder (recognised by the manifest, without checking file sizes one by one). */
  bundleIds: string[];
  /** Sum of the sizes of the registered repositories. */
  bytes: number;
}

/** Models recognisable in a folder: `<owner>/<repo>/.ccut-manifest.json`. Read-only. Empty when the folder is absent. */
export async function scanModelsDir(root: string, bundles: readonly BundleDefinition[]): Promise<ModelsDirScan> {
  // The release-page component (audio.cpp engine) is not in the model directory (it lives in the Runtime Home's tools directory), so it is not recognised, not moved, and not counted when deciding whether a model package is in this folder.
  const known = new Set<string>();
  for (const def of bundles) {
    for (const source of Object.values(def.components)) if (source && !source.release) known.add(`${source.repo}@${source.revision}`);
  }
  const repos: ModelsDirRepo[] = [];
  for (const owner of await listDirs(root)) {
    for (const name of await listDirs(path.join(root, owner))) {
      const manifest = await readManifest(path.join(root, owner, name));
      if (!manifest) continue;
      const repo = `${owner}/${name}`;
      // If the repository name written in the manifest disagrees with the directory it sits in, the directory wins (manifests written by the old downloader are placed this way too).
      repos.push({
        repo,
        revision: manifest.revision,
        bytes: manifest.files.reduce((n, f) => n + f.size, 0),
        known: known.has(`${repo}@${manifest.revision}`),
      });
    }
  }
  repos.sort((a, b) => a.repo.localeCompare(b.repo));
  const have = new Set(repos.map((r) => `${r.repo}@${r.revision}`));
  const bundleIds = bundles
    .filter((def) => {
      const sources = requiredSources(def).filter((s) => !s.release);
      return sources.length > 0 && sources.every((s) => have.has(`${s.repo}@${s.revision}`));
    })
    .map((def) => def.bundleId);
  return { repos, bundleIds, bytes: repos.filter((r) => r.known).reduce((n, r) => n + r.bytes, 0) };
}

/** Whether the folder exists (and is a folder), and whether it is writable. */
export async function dirAccess(dir: string): Promise<{ exists: boolean; writable: boolean }> {
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) return { exists: false, writable: false };
  const writable = await fs.access(dir, constants.W_OK).then(
    () => true,
    () => false,
  );
  return { exists: true, writable };
}

/** Whether two existing paths are on the same volume (whether they can be moved by renaming). */
export async function sameVolume(a: string, b: string): Promise<boolean> {
  const [sa, sb] = await Promise.all([fs.stat(a).catch(() => null), fs.stat(b).catch(() => null)]);
  return sa !== null && sb !== null && sa.dev === sb.dev;
}

/** `a` and `b` are the same directory, or one is inside the other. */
export function nestedDirs(a: string, b: string): 'same' | 'nested' | null {
  const ra = path.resolve(a);
  const rb = path.resolve(b);
  if (ra === rb) return 'same';
  const inside = (outer: string, inner: string) => {
    const rel = path.relative(outer, inner);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  return inside(ra, rb) || inside(rb, ra) ? 'nested' : null;
}

export interface MoveRepo {
  repo: string;
  revision: string;
  bytes: number;
}

/**
 * Repositories to move over: the repositories registered in the original directory, minus those the target already has at the same revision (not moved again; the copy in the original directory is deleted together after the switch-over). A same-named repository of a different revision in the target, or one with no manifest, cannot be moved over: it stays where it is (`blocked`).
 */
export async function planMove(
  from: string,
  to: string,
  bundles: readonly BundleDefinition[],
): Promise<{ move: MoveRepo[]; present: MoveRepo[]; blocked: MoveRepo[]; bytes: number }> {
  const source = await scanModelsDir(from, bundles);
  const move: MoveRepo[] = [];
  const present: MoveRepo[] = [];
  const blocked: MoveRepo[] = [];
  for (const repo of source.repos.filter((r) => r.known)) {
    const item = { repo: repo.repo, revision: repo.revision, bytes: repo.bytes };
    const there = path.join(to, ...repo.repo.split('/'));
    if (!(await fs.stat(there).catch(() => null))) move.push(item);
    else if ((await readManifest(there))?.revision === repo.revision) present.push(item);
    else blocked.push(item);
  }
  return { move, present, blocked, bytes: move.reduce((n, r) => n + r.bytes, 0) };
}

export interface MoveProgress {
  phase: 'moving' | 'validating' | 'publishing';
  done: number;
  total: number;
}

export interface MoveOptions {
  from: string;
  to: string;
  repos: readonly MoveRepo[];
  sameVolume: boolean;
  signal: AbortSignal;
  onProgress?: (progress: MoveProgress) => void;
  /** For tests: called once before each repository is put in place (injects mid-way failures). */
  beforePlace?: (repo: string) => Promise<void> | void;
}

interface MoveJournal {
  format_version: 1;
  to: string;
  sameVolume: boolean;
  repos: string[];
}

/**
 * Moves a repository from `from` to `to`, and merges the install record across. On success the repositories are all in `to` (for cross-volume moves, the originals remain in the original directory until `removeSources` deletes them after the switch-over), and the log remains (`clearMoveJournal` after the switch-over). On failure or cancellation, it rolls back: nothing moved is left in `to`, the original directory is as it was, and the original error is thrown.
 */
export async function moveModels(options: MoveOptions): Promise<void> {
  const { from, to, repos, signal } = options;
  const total = repos.reduce((n, r) => n + r.bytes, 0);
  const journalFile = path.join(from, MOVE_JOURNAL_FILE);
  const journal: MoveJournal = { format_version: 1, to, sameVolume: options.sameVolume, repos: repos.map((r) => r.repo) };
  await fs.writeFile(journalFile, `${JSON.stringify(journal, null, 2)}\n`);
  const placed: string[] = [];
  const staging = path.join(to, MOVING_DIR);
  try {
    if (options.sameVolume) {
      let done = 0;
      options.onProgress?.({ phase: 'moving', done, total });
      for (const repo of repos) {
        signal.throwIfAborted();
        await options.beforePlace?.(repo.repo);
        const target = repoDir(to, repo.repo);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.rename(repoDir(from, repo.repo), target);
        placed.push(repo.repo);
        done += repo.bytes;
        options.onProgress?.({ phase: 'moving', done, total });
      }
    } else {
      await fs.rm(staging, { recursive: true, force: true });
      let done = 0;
      options.onProgress?.({ phase: 'moving', done, total });
      for (const repo of repos) {
        await copyTree(repoDir(from, repo.repo), repoDir(staging, repo.repo), signal, (n) => {
          done += n;
          options.onProgress?.({ phase: 'moving', done: Math.min(done, total), total });
        });
      }
      let checked = 0;
      options.onProgress?.({ phase: 'validating', done: 0, total });
      for (const repo of repos) {
        await verifyRepo(repoDir(staging, repo.repo), repo, signal, (n) => {
          checked += n;
          options.onProgress?.({ phase: 'validating', done: Math.min(checked, total), total });
        });
      }
      options.onProgress?.({ phase: 'publishing', done: total, total });
      for (const repo of repos) {
        signal.throwIfAborted();
        await options.beforePlace?.(repo.repo);
        const target = repoDir(to, repo.repo);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.rename(repoDir(staging, repo.repo), target);
        placed.push(repo.repo);
      }
      await fs.rm(staging, { recursive: true, force: true });
    }
    await mergeInstallRecord(from, to);
  } catch (error) {
    await undoMove(from, to, placed, options.sameVolume);
    await fs.rm(journalFile, { force: true });
    throw error;
  }
  // The log is kept until the caller has switched over (`clearMoveJournal`): a crash before that is still rolled back on the next startup.
}

/** After the switch-over, deletes the move log in the original directory. */
export async function clearMoveJournal(from: string): Promise<void> {
  await fs.rm(path.join(from, MOVE_JOURNAL_FILE), { force: true }).catch(() => {});
}

/** After the switch-over, deletes the repositories and install records that were moved away from the original directory (or were already in the target). Deletions that fail are returned, not thrown. */
export async function removeSources(from: string, repos: readonly string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const repo of repos) {
    const dir = repoDir(from, repo);
    try {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rmdir(path.dirname(dir)).catch(() => {});
    } catch {
      failed.push(repo);
    }
  }
  await fs.rm(path.join(from, INSTALL_RECORD_FILE), { force: true }).catch(() => {});
  return failed;
}

/**
 * On Runtime startup: if the last move did not finish (the log is still in the original directory), roll it back. Same volume: rename back the repositories already renamed over; across volumes: delete the staging directory in the target (the files in the original directory were never touched). Returns how many repositories were rolled back; null when there is no log.
 */
export async function recoverMove(from: string): Promise<{ restored: string[] } | null> {
  const journalFile = path.join(from, MOVE_JOURNAL_FILE);
  let journal: MoveJournal;
  try {
    journal = JSON.parse(await fs.readFile(journalFile, 'utf8')) as MoveJournal;
  } catch {
    return null;
  }
  const restored: string[] = [];
  if (journal && typeof journal.to === 'string' && Array.isArray(journal.repos)) {
    if (journal.sameVolume) {
      for (const repo of journal.repos) {
        if (typeof repo !== 'string') continue;
        const back = repoDir(from, repo);
        const there = repoDir(journal.to, repo);
        if ((await fs.stat(back).catch(() => null)) || !(await fs.stat(there).catch(() => null))) continue;
        await fs.mkdir(path.dirname(back), { recursive: true });
        await fs.rename(there, back).then(
          () => restored.push(repo),
          () => {},
        );
      }
    }
    await fs.rm(path.join(journal.to, MOVING_DIR), { recursive: true, force: true }).catch(() => {});
  }
  await fs.rm(journalFile, { force: true });
  return { restored };
}

/**
 * Withdraws repositories already put in `to`: on the same volume, renames them back to `from`; across volumes, deletes them (the copy in the original directory is always still there). Done automatically when a move fails midway; done by the caller when the switch-over fails after the move has finished (writing the setting failed).
 */
export async function undoMove(from: string, to: string, placed: readonly string[], same: boolean): Promise<void> {
  for (const repo of [...placed].reverse()) {
    const there = repoDir(to, repo);
    if (same) {
      const back = repoDir(from, repo);
      await fs.mkdir(path.dirname(back), { recursive: true }).catch(() => {});
      await fs.rename(there, back).catch(() => {});
    } else {
      await fs.rm(there, { recursive: true, force: true }).catch(() => {});
    }
    await fs.rmdir(path.dirname(there)).catch(() => {});
  }
  await fs.rm(path.join(to, MOVING_DIR), { recursive: true, force: true }).catch(() => {});
}

/** Merges install records into the target: for model packages present on both sides, the original directory's entry is kept (that is the one being moved). */
async function mergeInstallRecord(from: string, to: string): Promise<void> {
  const source = await readInstallRecord(from);
  if (Object.keys(source.bundles).length === 0) return;
  await updateInstallRecord(to, (record) => {
    Object.assign(record.bundles, source.bundles);
  });
}

function repoDir(root: string, repo: string): string {
  return path.join(root, ...repo.split('/'));
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
}

/** Recursively copies a directory (regular files and subdirectories; symbolic links are copied as the files they point to). */
async function copyTree(src: string, dst: string, signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  signal.throwIfAborted();
  await fs.mkdir(dst, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    const stat = await fs.stat(from);
    if (stat.isDirectory()) await copyTree(from, to, signal, onBytes);
    else if (stat.isFile()) {
      const counter = new Transform({
        transform(chunk: Buffer, _enc, done) {
          onBytes(chunk.length);
          done(null, chunk);
        },
      });
      await pipeline(createReadStream(from), counter, createWriteStream(to), { signal });
    }
  }
}

/** A copied repository: the manifest is present, and each file listed in it matches in size and sha256. */
async function verifyRepo(dir: string, repo: MoveRepo, signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  const manifest = await readManifest(dir);
  if (!manifest || manifest.revision !== repo.revision) throw new Error(`Manifest of ${repo.repo} is wrong after copying`);
  for (const file of manifest.files) {
    signal.throwIfAborted();
    const full = path.join(dir, file.path);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile() || stat.size !== file.size) throw new Error(`Size of ${file.path} in ${repo.repo} doesn't match after copying`);
    const hash = crypto.createHash('sha256');
    for await (const chunk of createReadStream(full, { signal })) {
      hash.update(chunk as Buffer);
      onBytes((chunk as Buffer).length);
    }
    if (hash.digest('hex') !== file.sha256) throw new Error(`Checksum of ${file.path} in ${repo.repo} doesn't match after copying`);
  }
}

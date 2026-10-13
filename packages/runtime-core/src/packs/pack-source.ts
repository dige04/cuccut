import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PACK_DOWNLOAD_TIMEOUT_MS,
  PACK_LIMITS,
  PACK_MANIFEST_FILE,
  RpcError,
  packFileRole,
  packMissingFiles,
  packPathProblem,
  type Localized,
  type PackFileRole,
  type PackManifest,
  type PackSource,
} from '@cuccut/protocol';
import { parsePackManifest, type PackManifestProblem } from '@cuccut/protocol/schemas';
import { RcPacks } from '@cuccut/protocol/messages/runtime-core';
import { fetchGithubTree, parseGithubUrl, type GithubFetchOptions, type GithubRef, type GithubTreeRules } from '../skills/skill-github.ts';

/**
 * Reads a pack from where it is into a staging folder (pack spec §4): a local folder, a GitHub address, or an `https://` base address that serves `pack.json` with its
 * `files` index. Every source ends in the same check of the staged folder (`checkStagedPack`), so what a preview shows and what install writes is exactly what is staged.
 *
 * - Local: the folder is walked first (no symbolic links or special files, dot entries skipped, file and byte limits), `pack.json` is parsed, then the files are copied
 *   with `COPYFILE_EXCL`.
 * - GitHub: `fetchGithubTree` with the pack's limits; the tree is checked before anything is downloaded.
 * - `https://`: `pack.json` first, then each `files[]` entry, refused before download when the manifest does not name it, and checked for size and sha256 after.
 * - Strict offline mode refuses GitHub and `https://` before any network access (`OFFLINE_STRICT`). The whole read has a time limit (`PACK_DOWNLOAD_TIMEOUT_MS`).
 *
 * Nothing read is executed. The caller owns the staging folder (it must exist and be empty) and deletes it on failure.
 */

export type PackSourceRef = { kind: 'local'; path: string } | { kind: 'github'; github: GithubRef } | { kind: 'url'; url: string };

export interface PackSourceOptions {
  offlineStrict: () => boolean;
  /** GitHub reads: fetch and base addresses (tests point them at a fake). */
  github?: GithubFetchOptions;
  /** `https://` reads. */
  fetch?: typeof fetch;
  /** Time limit for one whole network read (default 2 minutes). */
  timeoutMs?: number;
  /** CucCut's packs folder: a local source may not overlap it. */
  packsDir?: string;
  /** For `~/…` sources (default: the user's home folder). */
  userHome?: string;
}

/** One staged file and what the manifest says it is. */
export interface StagedPackFile {
  path: string;
  size: number;
  role: PackFileRole;
}

export interface StagedPack {
  dir: string;
  manifest: PackManifest;
  /** sha256 (hex) of the `pack.json` bytes. */
  manifestHash: string;
  source: PackSource;
  /** Sorted by path; dot files are not part of a pack. */
  files: StagedPackFile[];
  bytes: number;
}

const REQUEST_TIMEOUT_MS = 30_000;
const GITHUB_HOST = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;
const GITHUB_SHORTHAND = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/tree\/\S+)?\/?$/;

/** Packs read from GitHub: `pack.json` in the root, the pack limits, `PACK_*` codes. */
export const PACK_GITHUB_RULES: GithubTreeRules = {
  limits: { files: PACK_LIMITS.files, totalBytes: PACK_LIMITS.totalBytes, path: PACK_LIMITS.path },
  requiredFile: PACK_MANIFEST_FILE,
  codes: {
    invalid: 'PACK_INVALID',
    tooLarge: 'PACK_TOO_LARGE',
    network: 'PACK_NETWORK',
    notFound: 'PACK_SOURCE_NOT_FOUND',
    rateLimited: 'PACK_NETWORK',
  },
  messages: {
    notImportable: (issue) => RcPacks.githubNotPack({ issue }),
    folderTooLarge: (p) => RcPacks.githubTooLarge(p),
    treeTruncated: (p) => RcPacks.githubTruncated(p),
    downloadTooLarge: (p) => RcPacks.githubDownloadTooLarge(p),
  },
};

function urlInvalid(issue: Localized, input: string): RpcError {
  return new RpcError('invalid-request', RcPacks.urlInvalid({ issue }), { code: 'PACK_URL_INVALID', source: input, issues: [issue.text] });
}

/**
 * Classifies a source as typed by a person: an absolute path (or `~/…`) is a folder; a `github.com` address or `owner/repo[/tree/<ref>/<path>]` is GitHub; any other
 * `https://` address is a base address (a trailing `pack.json` is dropped). Relative paths are refused: the CLI resolves them before calling.
 */
export function parsePackSource(input: string, userHome: string = os.homedir()): PackSourceRef {
  const raw = input.trim();
  if (!raw) throw urlInvalid(RcPacks.sourceEmpty(), input);
  if (raw === '~' || raw.startsWith('~/')) return { kind: 'local', path: path.join(userHome, raw.slice(1)) };
  if (path.isAbsolute(raw)) return { kind: 'local', path: path.resolve(raw) };
  if (GITHUB_HOST.test(raw)) return { kind: 'github', github: parseGithubUrl(raw, 'PACK_URL_INVALID') };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw urlInvalid(RcPacks.urlBadForm(), input);
    }
    if (url.protocol !== 'https:') throw urlInvalid(RcPacks.urlNotHttps(), input);
    if (url.username || url.password) throw urlInvalid(RcPacks.urlCredentials(), input);
    if (url.search) throw urlInvalid(RcPacks.urlBadForm(), input);
    url.hash = '';
    let base = url.pathname;
    if (base.endsWith(`/${PACK_MANIFEST_FILE}`)) base = base.slice(0, -PACK_MANIFEST_FILE.length);
    if (!base.endsWith('/')) base += '/';
    url.pathname = base;
    return { kind: 'url', url: url.toString() };
  }
  if (GITHUB_SHORTHAND.test(raw)) return { kind: 'github', github: parseGithubUrl(raw, 'PACK_URL_INVALID') };
  throw urlInvalid(RcPacks.sourceRelative(), input);
}

/** A source as one line (a folder path or an address), for errors and labels. */
export function packSourceLabel(source: PackSourceRef | PackSource): string {
  if (source.kind === 'local') return source.path;
  if (source.kind === 'url') return source.url;
  return 'github' in source ? source.github.url : source.url;
}

/** Reads a source into `staging` (an existing, empty folder) and checks it. */
export async function readPackSource(input: string | PackSourceRef, staging: string, options: PackSourceOptions): Promise<StagedPack> {
  const ref = typeof input === 'string' ? parsePackSource(input, options.userHome) : input;
  const label = packSourceLabel(ref);
  if (ref.kind === 'local') {
    await copyLocalPack(ref.path, staging, options);
    return checkStagedPack(staging, { kind: 'local', path: ref.path });
  }
  if (options.offlineStrict()) throw new RpcError('conflict', RcPacks.offlineStrict(), { code: 'OFFLINE_STRICT', source: label });
  const signal = AbortSignal.timeout(options.timeoutMs ?? PACK_DOWNLOAD_TIMEOUT_MS);
  if (ref.kind === 'github') {
    let fetched: { ref: string; commit: string };
    try {
      fetched = await fetchGithubTree(ref.github, staging, PACK_GITHUB_RULES, { ...options.github, signal });
    } catch (error) {
      throw withSource(error, label);
    }
    const { owner, repo, path: sub, url } = ref.github;
    return checkStagedPack(staging, { kind: 'github', url, owner, repo, ref: fetched.ref, commit: fetched.commit, path: sub });
  }
  await downloadUrlPack(ref.url, staging, options.fetch ?? fetch, signal);
  return checkStagedPack(staging, { kind: 'url', url: ref.url }, { requireIndex: true });
}

/**
 * Checks a staged pack folder: the walk limits, `pack.json` (`parsePackManifest`), every file named by the manifest and everything it names present, and the `files`
 * index when there is one (or required). The installer runs it again on a preview's folder before writing anything.
 */
export async function checkStagedPack(dir: string, source: PackSource, options: { requireIndex?: boolean } = {}): Promise<StagedPack> {
  const label = packSourceLabel(source);
  const listing = await walkPack(dir, label);
  const manifestFile = listing.find((f) => f.path === PACK_MANIFEST_FILE);
  if (!manifestFile) throw new RpcError('not-found', RcPacks.noManifest({ source: label }), { code: 'PACK_SOURCE_NOT_FOUND', source: label });
  const bytes = await fsp.readFile(path.join(dir, PACK_MANIFEST_FILE));
  const manifest = parseManifestBytes(bytes, label);

  const issues: Localized[] = [];
  const files: StagedPackFile[] = [];
  for (const file of listing) {
    const role = packFileRole(manifest, file.path);
    if (role === null) issues.push(RcPacks.fileUnnamed({ path: file.path }));
    else files.push({ ...file, role });
  }
  for (const missing of packMissingFiles(manifest, new Set(listing.map((f) => f.path)))) {
    issues.push(missing.endsWith('/') ? RcPacks.itemDirMissing({ path: missing.slice(0, -1) }) : RcPacks.fileMissing({ path: missing }));
  }
  if (!manifest.files && options.requireIndex) issues.push(RcPacks.filesIndexRequired());
  if (manifest.files) {
    const staged = new Map(listing.map((f) => [f.path, f]));
    const listed = new Set<string>();
    for (const entry of manifest.files) {
      listed.add(entry.path);
      if (entry.path === PACK_MANIFEST_FILE) continue;
      const file = staged.get(entry.path);
      if (!file) issues.push(RcPacks.fileMissing({ path: entry.path }));
      else if (file.size !== entry.size || (await sha256File(path.join(dir, ...entry.path.split('/')))) !== entry.sha256) {
        issues.push(RcPacks.fileMismatch({ path: entry.path }));
      }
    }
    for (const file of files) {
      if (file.role !== 'manifest' && file.role !== 'doc' && !listed.has(file.path)) issues.push(RcPacks.fileUnlisted({ path: file.path }));
    }
  }
  if (issues.length) throw invalid(issues, label);
  return {
    dir,
    manifest,
    manifestHash: createHash('sha256').update(bytes).digest('hex'),
    source,
    files,
    bytes: listing.reduce((sum, f) => sum + f.size, 0),
  };
}

// ---- Local folders ----

async function copyLocalPack(sourceDir: string, staging: string, options: PackSourceOptions): Promise<void> {
  const label = sourceDir;
  let real: string;
  try {
    real = await fsp.realpath(sourceDir);
    if (!(await fsp.stat(real)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new RpcError('not-found', RcPacks.sourceNotFound({ source: sourceDir }), {
      code: 'PACK_SOURCE_NOT_FOUND',
      source: label,
      issues: [RcPacks.folderNotFound({ path: sourceDir }).text],
    });
  }
  const guarded = [staging, ...(options.packsDir ? [options.packsDir] : [])];
  for (const dir of guarded) {
    const realDir = await fsp.realpath(dir).catch(() => path.resolve(dir));
    if (within(real, realDir) || within(realDir, real)) throw invalid([RcPacks.folderOverlapsPacks()], label);
  }
  const listing = await walkPack(real, label);
  if (!listing.some((f) => f.path === PACK_MANIFEST_FILE)) {
    throw new RpcError('not-found', RcPacks.noManifest({ source: label }), { code: 'PACK_SOURCE_NOT_FOUND', source: label });
  }
  // Parse first, so a foreign or broken manifest is refused before anything is copied.
  parseManifestBytes(await fsp.readFile(path.join(real, PACK_MANIFEST_FILE)), label);
  for (const file of listing) {
    const dest = path.join(staging, ...file.path.split('/'));
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(path.join(real, ...file.path.split('/')), dest, fsp.constants.COPYFILE_EXCL);
  }
}

/** Every file under `root` (dot entries skipped), with the pack limits; symbolic links and special files refuse the pack. */
async function walkPack(root: string, label: string): Promise<{ path: string; size: number }[]> {
  const files: { path: string; size: number }[] = [];
  let bytes = 0;
  const walk = async (abs: string, rel: string): Promise<void> => {
    let entries;
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true });
    } catch (error) {
      throw invalid([RcPacks.cannotRead({ path: rel || '.', code: (error as NodeJS.ErrnoException).code ?? 'error' })], label);
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (relPath.length > PACK_LIMITS.path) throw invalid([RcPacks.pathTooLong({ path: relPath.slice(0, 80) })], label);
      if (entry.isSymbolicLink()) throw invalid([RcPacks.noSymlinks({ path: relPath })], label);
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), relPath);
      else if (entry.isFile()) {
        const size = (await fsp.lstat(path.join(abs, entry.name))).size;
        files.push({ path: relPath, size });
        bytes += size;
        if (files.length > PACK_LIMITS.files || bytes > PACK_LIMITS.totalBytes) throw tooLarge(files.length, bytes, label);
      } else {
        throw invalid([RcPacks.notRegularFile({ path: relPath })], label);
      }
    }
  };
  await walk(root, '');
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// ---- https:// ----

async function downloadUrlPack(base: string, staging: string, fetchFn: typeof fetch, signal: AbortSignal): Promise<void> {
  const manifestBytes = await download(fetchFn, new URL(PACK_MANIFEST_FILE, base).toString(), PACK_LIMITS.manifestBytes, signal, base, true);
  const manifest = parseManifestBytes(manifestBytes, base);
  await fsp.writeFile(path.join(staging, PACK_MANIFEST_FILE), manifestBytes, { flag: 'wx' });
  if (!manifest.files) throw invalid([RcPacks.filesIndexRequired()], base);
  // Everything is checked against the index before the first file is fetched.
  const issues: Localized[] = [];
  const wanted = manifest.files.filter((f) => f.path !== PACK_MANIFEST_FILE);
  for (const entry of wanted) {
    const problem = packPathProblem(entry.path);
    if (problem) issues.push(RcPacks.manifestIssue({ path: entry.path, message: problem }));
    else if (packFileRole(manifest, entry.path) === null) issues.push(RcPacks.fileUnnamed({ path: entry.path }));
  }
  if (issues.length) throw invalid(issues, base);
  const bytes = wanted.reduce((sum, f) => sum + f.size, 0);
  if (wanted.length + 1 > PACK_LIMITS.files || bytes > PACK_LIMITS.totalBytes) throw tooLarge(wanted.length + 1, bytes, base);
  for (const entry of wanted) {
    const url = new URL(entry.path.split('/').map(encodeURIComponent).join('/'), base).toString();
    let data: Uint8Array;
    try {
      data = await download(fetchFn, url, entry.size, signal, base, false);
    } catch (error) {
      if (error instanceof RpcError && (error.details as { tooLarge?: boolean } | undefined)?.tooLarge) throw invalid([RcPacks.fileMismatch({ path: entry.path })], base);
      if (error instanceof RpcError && (error.details as { code?: string } | undefined)?.code === 'PACK_SOURCE_NOT_FOUND') {
        throw invalid([RcPacks.fileMissing({ path: entry.path })], base);
      }
      throw error;
    }
    const dest = path.join(staging, ...entry.path.split('/'));
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, data, { flag: 'wx' });
  }
}

/** One GET with a per-request timeout under the whole read's signal, a byte cap, and redirects accepted only to `https://`. */
async function download(fetchFn: typeof fetch, url: string, maxBytes: number, whole: AbortSignal, source: string, isManifest: boolean): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = AbortSignal.any([whole, timeout]);
  const network = (issue: Localized) => new RpcError('conflict', RcPacks.network({ issue }), { code: 'PACK_NETWORK', source, url, issues: [issue.text] });
  let response: Response;
  try {
    response = await fetchFn(url, { headers: { 'User-Agent': 'CucCut' }, signal, redirect: 'follow' });
  } catch {
    throw network(signal.aborted ? RcPacks.httpTimeout({ url }) : RcPacks.httpUnreachable({ url }));
  }
  if (response.redirected && response.url && !response.url.startsWith('https://')) {
    await response.body?.cancel().catch(() => {});
    throw network(RcPacks.httpRedirectedAway({ url }));
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    if (response.status === 404 || response.status === 410) {
      const issue = isManifest ? RcPacks.noManifest({ source }) : RcPacks.httpNotFound({ url });
      throw new RpcError('not-found', RcPacks.sourceNotFound({ source }), { code: 'PACK_SOURCE_NOT_FOUND', source, url, issues: [issue.text] });
    }
    throw network(RcPacks.httpStatus({ url, status: response.status }));
  }
  const tooBig = () =>
    isManifest
      ? invalid([RcPacks.manifestTooLarge({ limit: maxBytes })], source)
      : new RpcError('invalid-request', RcPacks.httpTooLarge({ url, limit: maxBytes }), { code: 'PACK_INVALID', source, url, tooLarge: true });
  const declared = Number(response.headers.get('content-length'));
  if (response.headers.has('content-length') && Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw tooBig();
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    if (response.body) {
      for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
        received += chunk.byteLength;
        if (received > maxBytes) throw tooBig();
        chunks.push(chunk);
      }
    }
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw network(signal.aborted ? RcPacks.httpTimeout({ url }) : RcPacks.httpConnectionLost({ url }));
  }
  return Buffer.concat(chunks);
}

// ---- Shared ----

/** `pack.json` bytes → manifest, or the refusal with its own code. */
function parseManifestBytes(bytes: Uint8Array, label: string): PackManifest {
  if (bytes.byteLength > PACK_LIMITS.manifestBytes) throw invalid([RcPacks.manifestTooLarge({ limit: PACK_LIMITS.manifestBytes })], label);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalid([RcPacks.manifestNotUtf8()], label);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw invalid([RcPacks.manifestNotJson()], label);
  }
  const parsed = parsePackManifest(raw);
  if (parsed.ok) return parsed.manifest;
  throw manifestRefusal(parsed.code, parsed.issues, label);
}

function manifestRefusal(code: PackManifestProblem, issues: string[], source: string): RpcError {
  const issue = issues[0] ?? '';
  const message =
    code === 'PACK_FOREIGN_FORMAT'
      ? RcPacks.foreignFormat({ issue })
      : code === 'PACK_UNSUPPORTED_SCHEMA'
        ? RcPacks.unsupportedSchema({ issue })
        : code === 'PACK_UNSUPPORTED_FIELD'
          ? RcPacks.unsupportedField({ issue })
          : code === 'PACK_ID_RESERVED'
            ? RcPacks.idReserved({ issue })
            : RcPacks.invalid({ issue });
  return new RpcError('invalid-request', message, { code, source, issues });
}

function invalid(issues: Localized[], source: string): RpcError {
  return new RpcError('invalid-request', RcPacks.invalid({ issue: issues[0]! }), { code: 'PACK_INVALID', source, issues: issues.map((i) => i.text) });
}

function tooLarge(files: number, bytes: number, source: string): RpcError {
  return new RpcError('invalid-request', RcPacks.tooLarge({ files, bytes, maxFiles: PACK_LIMITS.files, maxBytes: PACK_LIMITS.totalBytes }), {
    code: 'PACK_TOO_LARGE',
    source,
    files,
    bytes,
    limit: { files: PACK_LIMITS.files, bytes: PACK_LIMITS.totalBytes },
  });
}

/** Errors from a GitHub read carry the source, so the UI and the CLI can say where. */
function withSource(error: unknown, source: string): unknown {
  if (!(error instanceof RpcError)) return error;
  return new RpcError(error.code, error.message, { ...((error.details ?? {}) as object), source }, error.messageRef);
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function within(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

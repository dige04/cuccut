import { createHash } from 'node:crypto';
import { createReadStream, constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PACKAGE_FORMAT,
  PACKAGE_MANIFEST_FILE,
  PACKAGE_VERSION,
  refOf,
  RpcError,
  type Id,
  type JobWarning,
  type Localized,
  type MessageRef,
  type PackageEntry,
  type PackageFile,
  type PackageManifest,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { RcCommon, RcExport, RcPackage } from '@cuccut/protocol/messages/runtime-core';
import { TarWriter, ustarProblem } from './package-archive.ts';

/**
 * Freezing, preflight, and writing of portable packages (architecture design §5.8, video format spec §8).
 *
 * - **Freeze**: in one request, the engine provides the snapshot, the original text of each document version, and the location of each asset version (`exports.package`). Document versions and blobs collected into the video no longer change. Linked assets are verified against their registered digest while being written into the package, and if one has changed the export fails rather than writing different bytes into the package.
 * - **Contents**: the snapshot (all assets converted to collected into the video, `managed`), all document versions, and the bytes of all asset versions. Excludes keys, authorization, the task ledger, sessions, and the user library. Voice reference recordings are included only when they are already assets in the video.
 * - **Local paths**: the locations of linked assets in the snapshot are replaced. In other fields, strings containing a local root directory (home directory, video directory, source directory, the directory containing assets, and the directory of the original file recorded by the source) are replaced with a placeholder and a warning is logged. Document text cannot be changed (its digest is computed over the original), so if it contains such a path, preflight rejects it item by item.
 */

/** A document version as frozen by the engine. */
export interface FrozenDocument {
  documentId: Id;
  revision: string;
  contentHash: string;
  byteLength: number;
  packagePath: string;
  text: string;
}

/** An asset version as frozen by the engine. Carries `missing` when it cannot be read. */
export interface FrozenAsset {
  assetId: Id;
  revision: string;
  name: string;
  mediaType: string;
  contentHash: string;
  byteLength: number;
  storage: 'managed' | 'linked';
  packagePath: string;
  path?: string;
  files?: Array<{ rel: string; path: string }>;
  missing?: { reason: string; message: string };
}

export interface PackageFreeze {
  videoDir: string;
  snapshot: VideoSnapshot;
  documents: FrozenDocument[];
  assets: FrozenAsset[];
}

/** An asset version to be written into the package: one file, or the individual files of a directory (a code package). */
interface PlannedAsset {
  asset: FrozenAsset;
  files: Array<{ packagePath: string; source: string; size: number }>;
  tree: boolean;
}

export interface PortablePlan {
  snapshotText: string;
  documents: FrozenDocument[];
  assets: PlannedAsset[];
  entries: PackageEntry[];
  /** The sum of the byte counts of the files in the package (excluding tar headers and the manifest). */
  bytes: number;
  warnings: JobWarning[];
  manifestBase: Omit<PackageManifest, 'files' | 'entries' | 'createdAt'>;
}

/** One problem found by preflight. */
interface Problem {
  assetId?: Id;
  documentId?: Id;
  revision: string;
  name?: string;
  reason: string;
  path?: string;
}

/** Margin reserved by the space preflight for tar headers, the manifest, and filesystem overhead. */
const SPACE_MARGIN = 64 * 1024 * 1024;

/**
 * Local root directories: the home directory, the video directory, the source directory, the directory where linked assets are located, and the directory of the original file recorded by the source (for a video created from local media, `source.path`; it does not change when the asset is later collected into the video or relinked elsewhere), including their real paths. Overly short ones (such as `/`) don't count.
 */
export async function localRoots(freeze: PackageFreeze, extra: string[]): Promise<string[]> {
  const candidates = new Set<string>([os.homedir(), freeze.videoDir, path.dirname(freeze.videoDir), ...extra]);
  for (const asset of freeze.assets) {
    if (asset.storage === 'linked' && asset.path) candidates.add(path.dirname(asset.path));
  }
  for (const asset of Object.values(freeze.snapshot.assets)) {
    for (const version of Object.values(asset.revisions)) {
      const source = version.provenance?.source;
      const from = source && typeof source === 'object' ? (source as { path?: unknown }).path : undefined;
      if (typeof from === 'string' && path.isAbsolute(from)) candidates.add(path.dirname(from));
    }
  }
  for (const dir of [...candidates]) {
    const real = await fs.realpath(dir).catch(() => null);
    if (real) candidates.add(real);
  }
  return [...candidates].filter((root) => path.isAbsolute(root) && root.split(/[\\/]/).filter(Boolean).length >= 2);
}

function containsRoot(text: string, roots: string[]): boolean {
  return roots.some((root) => text.includes(root));
}

/**
 * Replaces strings containing a local root directory in the value with the placeholder (`placeholder`, the text written into the package, in the language current at export time). Returns how many replacements were made and where they were.
 */
function scrub(value: unknown, roots: string[], placeholder: string, where: string, hits: string[]): unknown {
  if (typeof value === 'string') {
    if (!containsRoot(value, roots)) return value;
    hits.push(where);
    return placeholder;
  }
  if (Array.isArray(value)) return value.map((v, i) => scrub(v, roots, placeholder, `${where}[${i}]`, hits));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, roots, placeholder, `${where}.${k}`, hits)]));
  }
  return value;
}

/** Records a task warning. The text is in the current language, with a reference attached. */
function warn(warnings: JobWarning[], code: string, detail: Localized): void {
  warnings.push({ code, detail: detail.text, detailRef: refOf(detail) });
}

function sha256Text(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

async function readable(file: string, expectDir: boolean): Promise<{ ok: true; size: number } | { ok: false; reason: string }> {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) return { ok: false, reason: 'missing' };
  if (expectDir ? !stat.isDirectory() : !stat.isFile()) return { ok: false, reason: 'missing' };
  try {
    await fs.access(file, fsConstants.R_OK);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  return { ok: true, size: stat.size };
}

/**
 * Runs preflight and assembles what is to be written. Assets that cannot be read (missing, unreadable, or with a length different from the one registered) are rejected item by item by default (`ASSET_MISSING`, `details.items`). With `skip`, they are not collected into the package, and the manifest and snapshot honestly mark them as missing. Document text that contains a local path is rejected item by item (`EXPORT_PACKAGE_LOCAL_PATH`). Anything tar cannot hold (paths that are too long, single files of 8 GiB or more) is rejected item by item (`EXPORT_PACKAGE_UNSUPPORTED`).
 */
export async function planPortable(freeze: PackageFreeze, roots: string[], missingAssets: 'fail' | 'skip'): Promise<PortablePlan> {
  const problems: Problem[] = [];
  const planned: PlannedAsset[] = [];
  const missing = new Map<string, string>();
  for (const asset of freeze.assets) {
    const key = `${asset.assetId}@${asset.revision}`;
    const problem = (reason: string): void => {
      problems.push({
        assetId: asset.assetId,
        revision: asset.revision,
        name: asset.name,
        reason,
        ...(asset.path ? { path: asset.path } : {}),
      });
      missing.set(key, reason);
    };
    if (asset.missing || !asset.path) {
      problem(asset.missing?.reason ?? 'missing');
      continue;
    }
    const tree = Array.isArray(asset.files);
    const check = await readable(asset.path, tree);
    if (!check.ok) {
      problem(check.reason);
      continue;
    }
    if (!tree) {
      if (check.size !== asset.byteLength) {
        problem('changed');
        continue;
      }
      planned.push({ asset, tree, files: [{ packagePath: asset.packagePath, source: asset.path, size: asset.byteLength }] });
      continue;
    }
    const files: PlannedAsset['files'] = [];
    let failed: string | null = null;
    for (const f of asset.files!) {
      const one = await readable(f.path, false);
      if (!one.ok) {
        failed = one.reason;
        break;
      }
      files.push({ packagePath: `${asset.packagePath}/${f.rel}`, source: f.path, size: one.size });
    }
    if (failed) problem(failed);
    else if (files.reduce((sum, f) => sum + f.size, 0) !== asset.byteLength) problem('changed');
    else planned.push({ asset, tree, files });
  }
  if (problems.length > 0 && missingAssets === 'fail') {
    throw new RpcError('conflict', RcPackage.assetsUnreadable({ count: problems.length }), {
      code: 'ASSET_MISSING',
      items: problems,
      recovery: RcPackage.assetsUnreadableRecovery().text,
    });
  }

  // Document text: collected as the original, the digest must match. Those containing a local path are rejected.
  const localPath: Problem[] = [];
  for (const doc of freeze.documents) {
    if (sha256Text(doc.text) !== doc.contentHash) {
      throw new RpcError('internal', RcPackage.documentDigestMismatch({ documentId: doc.documentId, revision: doc.revision }), {
        code: 'EXPORT_SOURCE_UNSUPPORTED',
        documentId: doc.documentId,
        revision: doc.revision,
      });
    }
    if (containsRoot(doc.text, roots)) localPath.push({ documentId: doc.documentId, revision: doc.revision, reason: 'local-path' });
  }
  if (localPath.length > 0) {
    throw new RpcError('invalid-request', RcPackage.documentsContainLocalPaths(), {
      code: 'EXPORT_PACKAGE_LOCAL_PATH',
      items: localPath,
    });
  }

  // Snapshot: assets are converted to collected into the video. Those that can't be read become linked assets with only a file name (recovered after opening the package with relinkAsset).
  const snapshot = structuredClone(freeze.snapshot);
  const entries: PackageEntry[] = [];
  for (const [assetId, asset] of Object.entries(snapshot.assets)) {
    for (const [revision, version] of Object.entries(asset.revisions)) {
      const reason = missing.get(`${assetId}@${revision}`);
      const frozen = freeze.assets.find((a) => a.assetId === assetId && a.revision === revision);
      if (reason === undefined && frozen) {
        version.storage = { mode: 'managed' };
        entries.push({
          ref: { id: assetId, revision },
          kind: 'asset',
          path: frozen.packagePath,
          contentHash: version.contentHash,
          byteLength: version.byteLength,
          inclusion: 'included',
        });
      } else {
        const original = version.provenance.importedFrom?.originalName ?? asset.name;
        version.storage = { mode: 'linked', locator: { path: path.basename(original) || asset.name }, frozen: false };
        entries.push({
          ref: { id: assetId, revision },
          kind: 'asset',
          contentHash: version.contentHash,
          byteLength: version.byteLength,
          inclusion: 'missing',
          note: RcPackage.missingNote({ reason: reason ?? 'missing' }).text,
        });
      }
    }
  }
  const hits: string[] = [];
  const placeholder = RcPackage.localPathPlaceholder().text;
  const cleaned = scrub(snapshot, roots, placeholder, 'snapshot', hits) as VideoSnapshot;
  const warnings: JobWarning[] = [];
  if (hits.length > 0) {
    const places = hits.slice(0, 5).join(RcExport.listSeparator().text);
    warn(warnings, 'PACKAGE_LOCAL_PATH_REMOVED', RcPackage.localPathsRemoved({ count: hits.length, places, more: hits.length > 5 }));
  }
  for (const [key, reason] of missing) {
    warn(warnings, 'PACKAGE_ASSET_MISSING', RcPackage.assetNotPackaged({ key, reason }));
  }
  for (const doc of freeze.documents) {
    entries.push({
      ref: { id: doc.documentId, revision: doc.revision },
      kind: 'document',
      path: doc.packagePath,
      contentHash: doc.contentHash,
      byteLength: doc.byteLength,
      inclusion: 'included',
    });
  }
  const snapshotText = `${JSON.stringify(cleaned)}\n`;

  const unsupported: Array<{ path: string; reason: string }> = [];
  const allFiles = [
    { packagePath: 'video.snapshot.json', size: Buffer.byteLength(snapshotText) },
    ...freeze.documents.map((d) => ({ packagePath: d.packagePath, size: d.byteLength })),
    ...planned.flatMap((a) => a.files),
  ];
  for (const f of allFiles) {
    const reason = ustarProblem(f.packagePath, f.size);
    if (reason) unsupported.push({ path: f.packagePath, reason });
  }
  if (unsupported.length > 0) {
    throw new RpcError('invalid-request', RcPackage.filesNotArchivable(), { code: 'EXPORT_PACKAGE_UNSUPPORTED', items: unsupported });
  }
  return {
    snapshotText,
    documents: freeze.documents,
    assets: planned,
    entries,
    bytes: allFiles.reduce((sum, f) => sum + f.size, 0),
    warnings,
    manifestBase: {
      format: PACKAGE_FORMAT,
      packageVersion: PACKAGE_VERSION,
      videoSchemaVersion: freeze.snapshot.schemaVersion,
      timeContractVersion: freeze.snapshot.timeContractVersion,
      videoId: freeze.snapshot.id,
      videoName: freeze.snapshot.name,
      videoRevision: freeze.snapshot.revision,
    },
  };
}

/** Preflight: the target volume can hold this package. */
export async function checkSpace(
  dir: string,
  bytes: number,
  statfs: (dir: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }> = fs.statfs,
): Promise<void> {
  const stat = await statfs(dir).catch(() => null);
  if (!stat) return;
  const available = Number(stat.bavail) * Number(stat.bsize);
  const required = bytes + SPACE_MARGIN;
  if (available < required) {
    throw new RpcError('conflict', RcPackage.insufficientSpace({ required: formatBytes(required), available: formatBytes(available) }), {
      code: 'EXPORT_INSUFFICIENT_SPACE',
      dir,
      required,
      available,
    });
  }
}

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.ceil(n / 1024 ** 2)} MB`;
}

/** Found while writing the package that an asset differs from when it was frozen (a linked file was changed, or a blob collected into the video is corrupt). */
export class PackageAssetChanged extends Error {
  readonly assetId: Id;
  readonly revision: string;
  readonly messageRef: MessageRef | undefined;
  constructor(assetId: Id, revision: string, message: string | Localized) {
    super(String(message));
    this.assetId = assetId;
    this.revision = revision;
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }
}

/**
 * Writes the assembled contents to `target` (a new file; fails if it already exists): the snapshot, document versions, assets, and finally the manifest. The digest of each file is computed while it is written. If an asset's digest differs from the registered one, throws `PackageAssetChanged`. Returns the manifest.
 */
export async function writePortable(
  plan: PortablePlan,
  target: string,
  createdAt: string,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
): Promise<PackageManifest> {
  const writer = await TarWriter.create(target, Math.floor(Date.parse(createdAt) / 1000));
  const files: PackageFile[] = [];
  let done = 0;
  const step = (bytes: number) => {
    done += bytes;
    progress(done, plan.bytes);
  };
  try {
    const record = (packagePath: string, result: { byteLength: number; sha256: string }) =>
      files.push({ path: packagePath, byteLength: result.byteLength, sha256: result.sha256 });
    const snapshot = Buffer.from(plan.snapshotText, 'utf8');
    record('video.snapshot.json', await writer.addBuffer('video.snapshot.json', snapshot));
    step(snapshot.length);
    for (const doc of plan.documents) {
      if (signal.aborted) throw new Error(RcCommon.cancelled().text);
      const text = Buffer.from(doc.text, 'utf8');
      record(doc.packagePath, await writer.addBuffer(doc.packagePath, text));
      step(text.length);
    }
    for (const item of plan.assets) {
      const lines: string[] = [];
      for (const f of item.files) {
        if (signal.aborted) throw new Error(RcCommon.cancelled().text);
        const result = await writer.addStream(f.packagePath, f.size, createReadStream(f.source), signal).catch((error: unknown) => {
          if (signal.aborted) throw error;
          throw new PackageAssetChanged(item.asset.assetId, item.asset.revision, RcPackage.assetReadIncomplete({ name: item.asset.name }));
        });
        record(f.packagePath, result);
        lines.push(
          `${result.sha256.slice('sha256:'.length)} ${result.byteLength} ${f.packagePath.slice(item.asset.packagePath.length + 1)}\n`,
        );
        step(f.size);
      }
      // A single file's digest is the version's content digest. A directory's digest is the digest of the whole set of lines, one per file, of the form "digest length relative-path" (video format spec §4.3).
      const digest = item.tree ? sha256Text(lines.join('')) : files.at(-1)!.sha256;
      if (digest !== item.asset.contentHash) {
        throw new PackageAssetChanged(
          item.asset.assetId,
          item.asset.revision,
          RcPackage.assetContentChanged({ name: item.asset.name, linked: item.asset.storage === 'linked' }),
        );
      }
    }
    const manifest: PackageManifest = { ...plan.manifestBase, createdAt, entries: plan.entries, files };
    await writer.addBuffer(PACKAGE_MANIFEST_FILE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
    await writer.finish();
    return manifest;
  } catch (error) {
    await writer.abort();
    throw error;
  }
}

/** The sha256 of the whole file (the export result's `artifactId`: the package is written outside the artifact library). */
export async function sha256OfFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return `sha256:${hash.digest('hex')}`;
}

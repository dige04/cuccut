import fs from 'node:fs/promises';
import path from 'node:path';
import type { ModelInstallPlan, ModelSelfTestResult } from '@cuccut/protocol';
import { ModelsModelCatalog as MC } from '@cuccut/protocol/messages/models/model-catalog.ts';
import { ModelsModelDownloader as MD } from '@cuccut/protocol/messages/models/model-downloader.ts';
import { ModelsModelInstaller as M } from '@cuccut/protocol/messages/models/model-installer.ts';
import { requiredSources, type BundleComponentSource, type BundleDefinition, type ComponentReleaseAsset } from './bundle-registry.ts';
import { readInstallRecord, updateInstallRecord } from './install-record.ts';
import { MANIFEST_FILE, readManifest, sha256File, type CcutManifest, type ModelCatalog } from './model-catalog.ts';
import { DownloadError, ModelDownloader, diskFreeBytes, type DownloadFile } from './model-downloader.ts';
import { isModelScopeEndpoint, modelFileUrl, repoEndpoint } from './download-source.ts';
import { discardStaging, removeEmptyParents, stagingDirOf } from './model-staging.ts';
import {
  UNPACK_DIR,
  discardReleaseStaging,
  releaseSource,
  releaseStagedBytes,
  releaseStagingDir,
  releaseUrl,
} from './release-component.ts';
import { REPO_MANIFESTS, repoManifestFor, type RepoManifestSpec } from './repo-manifests.ts';
import { extractToolArchive } from './tool-archive.ts';

/**
 * Installation, repair and removal of model packages (architecture design §6.3).
 *
 * - Plan (`plan`): check component by component whether everything is on disk. Complete components are left alone (a shared component is installed only once); for missing components only the missing files are downloaded: files in the repository directory whose manifest and hashes match are reused, files already verified in the staging area are not downloaded, and unfinished ones resume. Repair (`repair`) reads each file's sha256 and re-downloads only the bad and missing ones. It is refused when the built-in manifest lacks a trusted hash (`MODEL_MANIFEST_INCOMPLETE`). For files of unknown size, send HEAD to the download source to get the size (each at most a few seconds, in parallel); if that fails, the total bytes are reported as unknown and the confirmation uses an estimate.
 * - Install (`install`): check available space first, then download, verify and publish each component one by one; a component counts as "installed" only after it is published. If a failure happens midway, the components already published are kept, the model package is reported as `incomplete`, and next time only the missing ones are filled in. On completion the model package is recorded in the install record.
 * - Remove (`remove`): deletes only the components no other model package holds. A holder is a model package that uses the same repository and version and is either in the install record or has all its files.
 *   A repository directory holding a different version is not deleted (it does not belong to this model package).
 * - Release-page component (`release`, audio.cpp engine): downloads the archive for the host platform (addresses in `release-component.ts`; no HEAD is sent, the registered size is used), checks size and sha256, and unpacks in-process into the staging area (only regular files at the archive root; `archive.skip` is ignored). If there is no executable or it cannot be unpacked, the staging area is deleted and `MODEL_DOWNLOAD_INTEGRITY` is raised. After the manifest is written, the component is renamed atomically to `<toolsDir>/<name>/<version>/`, then `probeExecutable` confirms it runs (on failure the component directory is deleted, again `MODEL_DOWNLOAD_INTEGRITY`). Components satisfied by `engineOverride` are left untouched; on repair, if there is a manifest the sha256 is checked against it, and installs without a manifest (from an older version) have the archive downloaded again. The component directory is reclaimed when the last holder is removed.
 */

export interface ModelInstallerOptions {
  catalog: ModelCatalog;
  /** Base URL of the download source; read once per plan. */
  endpoint: () => string;
  fetch?: typeof fetch;
  /** Free space on the disk that holds the model directory (injected for tests). Defaults to `statfs`. */
  freeBytes?: (dir: string) => Promise<number | null>;
  /** Replace the built-in repository manifest (for tests). */
  manifests?: readonly RepoManifestSpec[];
  /** Use HEAD to get unknown file sizes during planning (default: yes). */
  probeSizes?: boolean;
  /** Deadline for each HEAD, in milliseconds; default 5 seconds. */
  headTimeoutMs?: number;
  retries?: number;
  backoffMs?: (attempt: number) => number;
  stallMs?: number;
  /**
   * Download mirror for release-page components (set `tools.downloadEndpoint` or `CUCCUT_TOOLS_ENDPOINT`): when given, the address is `<base>/<name>/<version>/<filename>`;
   * otherwise it is the registered official address. As a function, it is read once per plan.
   */
  toolsEndpoint?: string | null | (() => string | null);
  /**
   * After a release-page component is published, confirm that its executable runs (the Runtime probes with `--version`); if it throws, delete the just-published component directory, and the install fails with
   * `MODEL_DOWNLOAD_INTEGRITY`. If not given, no probe is run.
   */
  probeExecutable?: (executable: string) => Promise<void>;
}

/** A component in the plan (internal shape, followed when installing). */
export interface PlannedComponent {
  component: string;
  source: BundleComponentSource;
  action: 'keep' | 'download';
  /** File to download. */
  fetch: DownloadFile[];
  /** Good files reused from the repository directory (during repair and fill-in). */
  reuse: string[];
  /** All files the manifest must list at publish time. */
  files: Array<{ path: string; sha256: string }>;
  /** Bytes already received in the staging area. */
  staged: number;
  /** Bytes still to download; null when there are files of unknown size. */
  bytes: number | null;
  estimatedBytes: number;
  /** Release-page component: the archive and download address for this host (`fetch` has only this archive). */
  release?: { asset: ComponentReleaseAsset; url: string };
}

export interface InstallPlanDetail {
  plan: ModelInstallPlan;
  components: PlannedComponent[];
  endpoint: string;
  /** Download mirror for the release-page component; null when there is none (official address). */
  toolsEndpoint: string | null;
  repair: boolean;
  /** Total bytes for progress (including bytes already received in the staging area); null if unknown. */
  totalBytes: number | null;
}

export interface InstallProgress {
  phase: 'downloading' | 'publishing';
  receivedBytes: number;
  totalBytes: number | null;
}

export interface InstallOutcome {
  /** The repository manifest for this publish. */
  published: CcutManifest[];
  /** Bytes actually received this time (excluding those present before resume). */
  downloadedBytes: number;
}

export class ModelInstaller {
  readonly #catalog: ModelCatalog;
  readonly #options: ModelInstallerOptions;
  readonly #manifests: readonly RepoManifestSpec[];
  readonly #freeBytes: (dir: string) => Promise<number | null>;
  readonly #fetch: typeof fetch;

  constructor(options: ModelInstallerOptions) {
    this.#catalog = options.catalog;
    this.#options = options;
    this.#manifests = options.manifests ?? REPO_MANIFESTS;
    this.#freeBytes = options.freeBytes ?? diskFreeBytes;
    this.#fetch = options.fetch ?? fetch;
  }

  get root(): string {
    return this.#catalog.root;
  }

  async plan(bundleId: string, options: { repair?: boolean } = {}): Promise<InstallPlanDetail> {
    const def = this.#definition(bundleId);
    const repair = options.repair ?? false;
    const endpoint = this.#options.endpoint();
    const toolsOption = this.#options.toolsEndpoint;
    const toolsEndpoint = (typeof toolsOption === 'function' ? toolsOption() : toolsOption) || null;
    const components: PlannedComponent[] = [];
    for (const [component, source] of componentsOf(def)) {
      components.push(
        source.release
          ? await this.#planRelease(component, source, repair, toolsEndpoint)
          : await this.#planComponent(component, source, repair, endpoint),
      );
    }
    const downloading = components.filter((c) => c.action === 'download');
    const downloadBytes = downloading.some((c) => c.bytes === null) ? null : downloading.reduce((sum, c) => sum + (c.bytes ?? 0), 0);
    const estimatedBytes = downloading.reduce((sum, c) => sum + (c.bytes ?? c.estimatedBytes), 0);
    const resumedBytes = downloading.reduce((sum, c) => sum + c.staged, 0);
    const plan: ModelInstallPlan = {
      bundleId,
      components: components.map((c) => ({
        component: c.component,
        repo: c.source.repo,
        revision: c.source.revision,
        ...(c.source.release ? { origin: 'github-release' as const } : {}),
        action: c.action,
        files: c.fetch.map((f) => f.path),
        bytes: c.action === 'keep' ? 0 : c.bytes,
      })),
      downloadBytes,
      estimatedBytes,
      confirmBytes: downloadBytes ?? estimatedBytes,
      resumedBytes,
      availableBytes: await this.#freeBytes(this.root),
      source: this.#sourceOf(endpoint, toolsEndpoint, downloading),
      upToDate: downloading.length === 0,
    };
    return { plan, components, endpoint, toolsEndpoint, repair, totalBytes: downloadBytes === null ? null : downloadBytes + resumedBytes };
  }

  /** Download, verify and publish according to the plan. On signal abort, stop (the staging area is kept and resumed next time) and throw the abort reason. */
  async install(
    detail: InstallPlanDetail,
    options: { signal: AbortSignal; onProgress?: (progress: InstallProgress) => void },
  ): Promise<InstallOutcome> {
    const { signal } = options;
    const onProgress = options.onProgress ?? (() => {});
    const downloading = detail.components.filter((c) => c.action === 'download');
    const required = downloading.reduce((sum, c) => sum + (c.bytes ?? c.estimatedBytes), 0);
    const available = await this.#freeBytes(this.root);
    if (available !== null && available < required) {
      throw new DownloadError('MODEL_DOWNLOAD_NO_SPACE', M.noSpace(), {
        requiredBytes: required,
        availableBytes: available,
      });
    }
    const downloader = new ModelDownloader({
      root: this.root,
      endpoint: detail.endpoint,
      fetch: this.#fetch,
      ...(this.#options.retries !== undefined ? { retries: this.#options.retries } : {}),
      ...(this.#options.backoffMs ? { backoffMs: this.#options.backoffMs } : {}),
      ...(this.#options.stallMs !== undefined ? { stallMs: this.#options.stallMs } : {}),
    });
    let received = detail.plan.resumedBytes;
    let downloaded = 0;
    const report = (phase: InstallProgress['phase']) =>
      onProgress({ phase, receivedBytes: Math.max(0, received), totalBytes: detail.totalBytes });
    report('downloading');
    const published: CcutManifest[] = [];
    for (const component of downloading) {
      if (component.release) {
        const onBytes = (delta: number) => {
          received += delta;
          if (delta > 0) downloaded += delta;
          report('downloading');
        };
        published.push(await this.#installRelease(downloader, component, signal, onBytes, () => report('publishing')));
        this.#catalog.changed(detail.plan.bundleId);
        continue;
      }
      const { repo, revision } = component.source;
      if (component.reuse.length > 0) await downloader.reuse(repo, revision, this.#catalog.repoDir(repo), component.reuse);
      const sourceRepo = this.#sourceRepo(component.source);
      await downloader.download(
        repo,
        revision,
        component.fetch,
        signal,
        (delta) => {
          received += delta;
          if (delta > 0) downloaded += delta;
          report('downloading');
        },
        sourceRepo,
      );
      signal.throwIfAborted();
      report('publishing');
      published.push(await downloader.publish(repo, revision, component.files, sourceRepo));
      this.#catalog.changed(detail.plan.bundleId);
    }
    await updateInstallRecord(this.root, (record) => {
      record.bundles[detail.plan.bundleId] = { installedAt: new Date().toISOString() };
    });
    return { published, downloadedBytes: downloaded };
  }

  /** Delete the components unique to one model package, keeping those still used by other model packages. The caller first confirms that no task is using them. */
  async remove(bundleId: string): Promise<{ removed: string[]; kept: Array<{ repo: string; usedBy: string[] }> }> {
    const def = this.#definition(bundleId);
    const record = await readInstallRecord(this.root);
    const removed: string[] = [];
    const kept: Array<{ repo: string; usedBy: string[] }> = [];
    for (const [, source] of componentsOf(def)) {
      const holders = await this.#holders(bundleId, source, record.bundles);
      if (holders.length > 0) {
        kept.push({ repo: source.repo, usedBy: holders });
        continue;
      }
      await this.#discardStaging(source);
      const dir = this.#catalog.componentDir(source);
      const manifest = await readManifest(dir);
      if (manifest && manifest.revision !== source.revision) {
        kept.push({ repo: source.repo, usedBy: [] });
        continue;
      }
      if (!(await fs.stat(dir).catch(() => null))) continue;
      await fs.rm(dir, { recursive: true, force: true });
      await removeEmptyParents(path.dirname(dir), path.dirname(dir));
      removed.push(source.repo);
    }
    await updateInstallRecord(this.root, (r) => {
      delete r.bundles[bundleId];
    });
    for (const other of [bundleId, ...this.#sharers(def)]) this.#catalog.changed(other);
    return { removed, kept };
  }

  /** Delete the parts that a model package's missing components left in the staging area (`discard` of `models.cancelInstall`). Anything another model package is sharing is not deleted. */
  async discard(bundleId: string, busy: (source: BundleComponentSource) => boolean = () => false): Promise<void> {
    const def = this.#definition(bundleId);
    for (const [, source] of componentsOf(def)) {
      if (!busy(source)) await this.#discardStaging(source);
    }
    this.#catalog.changed(bundleId);
  }

  /** Record the self-test result (`selfTest` of the model package status). */
  async recordSelfTest(bundleId: string, result: ModelSelfTestResult): Promise<void> {
    await updateInstallRecord(this.root, (record) => {
      record.bundles[bundleId] = { ...(record.bundles[bundleId] ?? { installedAt: result.at }), selfTest: result };
    });
    this.#catalog.changed(bundleId);
  }

  async #discardStaging(source: BundleComponentSource): Promise<void> {
    if (source.release) await discardReleaseStaging(this.#catalog.toolsDir, source.release);
    else await discardStaging(this.root, source.repo, source.revision);
  }

  /**
   * Plan for a release-page component: a component satisfied by `engineOverride` or already installed is left alone; on repair, if there is a manifest, the sha256 is checked against it, good ones are left alone, and installs without a manifest (from an older version) are downloaded again.
   * Only this host's archive is downloaded, with the registered size (no HEAD is sent); parts already in the staging area resume. Refused when this platform has no archive.
   */
  async #planRelease(component: string, source: BundleComponentSource, repair: boolean, toolsEndpoint: string | null): Promise<PlannedComponent> {
    const release = source.release!;
    const keep = (): PlannedComponent => ({
      component,
      source,
      action: 'keep',
      fetch: [],
      reuse: [],
      files: [],
      staged: 0,
      bytes: 0,
      estimatedBytes: 0,
    });
    if (this.#catalog.engineOverridden(source)) return keep();
    const asset = this.#catalog.releaseAsset(source);
    if (!asset) {
      const platform = this.#catalog.platformKey;
      throw new DownloadError('MODEL_DOWNLOAD_SOURCE', MC.engineNoBuild({ platform }), { repo: source.repo, platform });
    }
    if (!repair && (await this.#catalog.componentInstalled(source))) return keep();
    if (repair) {
      const dir = this.#catalog.componentDir(source);
      const manifest = await readManifest(dir);
      if (manifest && manifest.revision === source.revision && (await intact(dir, manifest))) return keep();
    }
    const staged = await releaseStagedBytes(this.#catalog.toolsDir, release, asset);
    const bytes = Math.max(0, asset.size - staged);
    return {
      component,
      source,
      action: 'download',
      fetch: [{ path: asset.fileName, size: asset.size, sha256: asset.sha256 }],
      reuse: [],
      files: [],
      staged,
      bytes,
      estimatedBytes: bytes,
      release: { asset, url: releaseUrl(release, asset, toolsEndpoint) },
    };
  }

  /**
   * Download, verify, unpack and publish one release-page component, returning the manifest written into the component directory. If unpacking fails, there is no executable, or the probe fails, no half-directory is left;
   * it fails with `MODEL_DOWNLOAD_INTEGRITY`. On abort, the archive stays in the staging area and resumes next time.
   */
  async #installRelease(
    downloader: ModelDownloader,
    component: PlannedComponent,
    signal: AbortSignal,
    onBytes: (delta: number) => void,
    publishing: () => void,
  ): Promise<CcutManifest> {
    const { source } = component;
    const release = source.release!;
    const { asset, url } = component.release!;
    const toolsDir = this.#catalog.toolsDir;
    const stage = releaseStagingDir(toolsDir, release);
    await downloader.downloadUrl(stage, url, component.fetch[0]!, signal, onBytes);
    signal.throwIfAborted();
    publishing();
    const unpacked = path.join(stage, UNPACK_DIR);
    await fs.rm(unpacked, { recursive: true, force: true });
    await fs.mkdir(unpacked, { recursive: true });
    let names: string[];
    try {
      names = await extractToolArchive(path.join(stage, asset.fileName), asset.archive, unpacked, signal);
      if (!names.includes(asset.executable)) {
        throw new DownloadError('MODEL_DOWNLOAD_INTEGRITY', MD.executableMissing({ file: asset.fileName, executable: asset.executable }), {
          file: asset.fileName,
          executable: asset.executable,
        });
      }
    } catch (error) {
      if (signal.aborted) {
        await fs.rm(unpacked, { recursive: true, force: true });
        throw signal.reason ?? error;
      }
      await discardReleaseStaging(toolsDir, release);
      if (error instanceof DownloadError) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
        throw new DownloadError('MODEL_DOWNLOAD_NO_SPACE', MD.diskFull(), { file: asset.fileName });
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new DownloadError('MODEL_DOWNLOAD_INTEGRITY', MD.archiveUnpackable({ file: asset.fileName, reason }), {
        file: asset.fileName,
        reason,
      });
    }
    const files: CcutManifest['files'] = [];
    for (const name of [...names].sort()) {
      const full = path.join(unpacked, name);
      files.push({ path: name, size: (await fs.stat(full)).size, sha256: await sha256File(full) });
    }
    const manifest: CcutManifest = { format_version: 1, repo: source.repo, revision: source.revision, source: url, files };
    await fs.writeFile(path.join(unpacked, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    // Swap in atomically: move the old component directory (the one from an older install, or the one from before repair) aside first, and delete it once the new one is in place.
    const target = this.#catalog.componentDir(source);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const aside = `${target}.old-${process.pid}-${Date.now()}`;
    const hadOld = (await fs.stat(target).catch(() => null)) !== null;
    if (hadOld) await fs.rename(target, aside);
    try {
      await fs.rename(unpacked, target);
    } catch (error) {
      if (hadOld) await fs.rename(aside, target).catch(() => {});
      throw error;
    }
    if (hadOld) await fs.rm(aside, { recursive: true, force: true });
    await discardReleaseStaging(toolsDir, release);
    if (this.#options.probeExecutable) {
      try {
        await this.#options.probeExecutable(path.join(target, asset.executable));
      } catch (error) {
        await fs.rm(target, { recursive: true, force: true });
        await removeEmptyParents(path.dirname(target), path.dirname(target));
        const reason = error instanceof Error ? error.message : String(error);
        throw new DownloadError('MODEL_DOWNLOAD_INTEGRITY', MD.engineProbeFailed({ executable: asset.executable, reason }), {
          file: asset.fileName,
          executable: asset.executable,
          reason,
        });
      }
    }
    return manifest;
  }

  async #planComponent(component: string, source: BundleComponentSource, repair: boolean, endpoint: string): Promise<PlannedComponent> {
    const keep = (): PlannedComponent => ({
      component,
      source,
      action: 'keep',
      fetch: [],
      reuse: [],
      files: [],
      staged: 0,
      bytes: 0,
      estimatedBytes: 0,
    });
    if (!repair && (await this.#catalog.componentInstalled(source))) return keep();
    const spec = repoManifestFor(source.repo, source.revision, this.#manifests);
    if (!spec) {
      throw new DownloadError('MODEL_MANIFEST_INCOMPLETE', M.noManifest({ repo: source.repo, revision: source.revision.slice(0, 7) }), {
        repo: source.repo,
      });
    }
    const unhashed = spec.files.filter((f) => !f.sha256 || !/^[0-9a-f]{64}$/.test(f.sha256)).map((f) => f.path);
    if (unhashed.length > 0) {
      throw new DownloadError('MODEL_MANIFEST_INCOMPLETE', M.untrustedManifest({ repo: source.repo }), {
        repo: source.repo,
        files: unhashed,
      });
    }
    const dir = this.#catalog.repoDir(source.repo);
    const onDisk = await readManifest(dir);
    const listed = new Map(onDisk && onDisk.revision === source.revision ? onDisk.files.map((f) => [f.path, f]) : []);
    const reuse: string[] = [];
    const fetchFiles: DownloadFile[] = [];
    for (const file of spec.files) {
      const full = path.join(dir, file.path);
      const stat = await fs.stat(full).catch(() => null);
      let good = false;
      if (stat?.isFile() && (file.size === null || stat.size === file.size)) {
        if (repair) good = (await sha256File(full)) === file.sha256;
        else {
          const entry = listed.get(file.path);
          good = entry !== undefined && entry.sha256 === file.sha256 && entry.size === stat.size;
        }
      }
      if (good) reuse.push(file.path);
      else fetchFiles.push({ path: file.path, size: file.size, sha256: file.sha256! });
    }
    const files = spec.files.map((f) => ({ path: f.path, sha256: f.sha256! }));
    const manifestOk =
      onDisk !== null &&
      onDisk.revision === source.revision &&
      onDisk.files.length === spec.files.length &&
      spec.files.every((f) => listed.get(f.path)?.sha256 === f.sha256);
    if (repair && fetchFiles.length === 0 && manifestOk) return keep();

    // Parts already received in the staging area: fully verified files are not downloaded again; `.part` files resume.
    const stage = stagingDirOf(this.root, source.repo, source.revision);
    let staged = 0;
    const pending: Array<{ file: DownloadFile; part: number }> = [];
    for (const file of fetchFiles) {
      const done = await fs.stat(path.join(stage, file.path)).catch(() => null);
      if (done?.isFile()) {
        staged += done.size;
        continue;
      }
      const part = (await fs.stat(path.join(stage, `${file.path}.part`)).catch(() => null))?.size ?? 0;
      staged += part;
      pending.push({ file, part });
    }
    const unknown = pending.filter((p) => p.file.size === null).map((p) => p.file);
    const probed = new Map<string, number | null>();
    if (unknown.length > 0) {
      const sizes = await this.#probeSizes(endpoint, this.#sourceRepo(source), source.revision, unknown);
      unknown.forEach((file, i) => probed.set(file.path, sizes[i] ?? null));
    }
    const remaining = pending.map(({ file, part }) => {
      const size = file.size ?? probed.get(file.path) ?? null;
      return size === null ? null : Math.max(0, size - part);
    });
    const bytes = remaining.some((r) => r === null) ? null : remaining.reduce<number>((sum, r) => sum + (r ?? 0), 0);
    const estimatedBytes = bytes ?? Math.max(0, spec.estimatedBytes - staged);
    return { component, source, action: 'download', fetch: fetchFiles, reuse, files, staged, bytes, estimatedBytes };
  }

  /** Repository at the download source: the manifest's `sourceRepo`; if not written, the registered `repo`. */
  #sourceRepo(source: BundleComponentSource): string {
    return repoManifestFor(source.repo, source.revision, this.#manifests)?.sourceRepo ?? source.repo;
  }

  /**
   * Source in the plan: the base URLs actually used by the components to be downloaded this time. When there are several, the configured base URL comes first and they are joined with “ + ”; when nothing needs downloading, it is the configured base URL.
   * The base URL for release-page components is the tool download mirror; without a mirror it is the upstream release page.
   */
  #sourceOf(endpoint: string, toolsEndpoint: string | null, downloading: readonly PlannedComponent[]): string {
    const bases = new Set(
      downloading.map((c) =>
        c.source.release ? releaseSource(c.source.release, toolsEndpoint) : repoEndpoint(endpoint, this.#sourceRepo(c.source)),
      ),
    );
    if (bases.size === 0) return endpoint;
    return [...bases].sort((a, b) => Number(b === endpoint) - Number(a === endpoint)).join(' + ');
  }

  /**
   * Ask the download source for a file's size: HEAD first (following redirects; for LFS files prefer `x-linked-size`); if HEAD gives no size, send a GET for just the first byte instead,
   * reading the total length from `Content-Range` (if the source ignores Range and returns 200 with the whole file, read `Content-Length`). ModelScope's HEAD never gives a size, so a GET is sent directly.
   * null if it cannot be obtained.
   */
  async #probeSizes(endpoint: string, repo: string, revision: string, files: DownloadFile[]): Promise<Array<number | null>> {
    if (this.#options.probeSizes === false) return files.map(() => null);
    const timeout = this.#options.headTimeoutMs ?? 5_000;
    const headless = isModelScopeEndpoint(repoEndpoint(endpoint, repo));
    return Promise.all(
      files.map(async (file) => {
        const url = modelFileUrl(endpoint, repo, revision, file.path);
        try {
          if (!headless) {
            const head = await this.#fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(timeout) });
            if (!head.ok) return null;
            const size = sizeOf(head.headers.get('x-linked-size') ?? head.headers.get('content-length'));
            if (size !== null) return size;
          }
          const ranged = await this.#fetch(url, {
            headers: { Range: 'bytes=0-0' },
            redirect: 'follow',
            signal: AbortSignal.timeout(timeout),
          });
          await ranged.body?.cancel().catch(() => {});
          if (!ranged.ok) return null;
          // ModelScope's small files return 200 yet carry `Content-Range` (`Content-Length` is 1): when present, it takes precedence.
          const range = /^bytes \d+-\d+\/(\d+)$/.exec(ranged.headers.get('content-range') ?? '');
          if (range) return sizeOf(range[1]);
          return ranged.status === 200 ? sizeOf(ranged.headers.get('content-length')) : null;
        } catch {
          return null;
        }
      }),
    );
  }

  /** Holders of this component other than `bundleId`: model packages that use the same repository and version and are either in the install record or have all their files. */
  async #holders(bundleId: string, source: BundleComponentSource, record: Record<string, unknown>): Promise<string[]> {
    const holders: string[] = [];
    for (const other of this.#catalog.definitions()) {
      if (other.bundleId === bundleId) continue;
      if (!componentsOf(other).some(([, s]) => s.repo === source.repo && s.revision === source.revision)) continue;
      if (Object.hasOwn(record, other.bundleId)) {
        holders.push(other.bundleId);
        continue;
      }
      let complete = true;
      for (const s of requiredSources(other)) {
        if (!(await this.#catalog.componentInstalled(s))) {
          complete = false;
          break;
        }
      }
      if (complete) holders.push(other.bundleId);
    }
    return holders;
  }

  #sharers(def: BundleDefinition): string[] {
    const repos = new Set(componentsOf(def).map(([, s]) => `${s.repo}@${s.revision}`));
    return this.#catalog
      .definitions()
      .filter((b) => b.bundleId !== def.bundleId && componentsOf(b).some(([, s]) => repos.has(`${s.repo}@${s.revision}`)))
      .map((b) => b.bundleId);
  }

  #definition(bundleId: string): BundleDefinition {
    const def = this.#catalog.definition(bundleId);
    if (!def) throw new Error(M.noBundle({ bundleId }).text);
    return def;
  }
}

/** All files listed in the manifest are present, sizes match, and sha256 matches (when repairing a release-page component). */
async function intact(dir: string, manifest: CcutManifest): Promise<boolean> {
  for (const file of manifest.files) {
    const full = path.join(dir, file.path);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile() || stat.size !== file.size || (await sha256File(full)) !== file.sha256) return false;
  }
  return true;
}

function sizeOf(value: string | null | undefined): number | null {
  const size = Number(value ?? NaN);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

function componentsOf(def: BundleDefinition): Array<[string, BundleComponentSource]> {
  return Object.entries(def.components) as Array<[string, BundleComponentSource]>;
}

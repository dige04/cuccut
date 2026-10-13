import crypto from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  ModelBackend,
  ModelBundleReason,
  ModelBundleState,
  ModelBundleStatus,
  ModelComponentStatus,
  ModelInstallProgress,
} from '@cuccut/protocol';
import { ModelsModelCatalog as M } from '@cuccut/protocol/messages/models/model-catalog.ts';
import {
  backendSupported,
  candleResidentBytes,
  defaultTranscribeBundle,
  platformBundles,
  requiredSources,
  type BundleComponentSource,
  type BundleDefinition,
  type ComponentReleaseAsset,
} from './bundle-registry.ts';
import { readInstallRecord } from './install-record.ts';
import { stagedBytes } from './model-staging.ts';
import { modelDetail, type ModelText } from './model-text.ts';
import { hostPlatformKey, releaseAsset, releaseDir, releaseStagedBytes } from './release-component.ts';
import { REPO_MANIFESTS, repoManifestFor, weightBytes, type RepoManifestSpec } from './repo-manifests.ts';
import type { BundleComponent, ModelBundle, ModelFiles } from './worker-contract.ts';

/**
 * Local model catalog (architecture design §6.3; Model Worker protocol spec §4).
 *
 * Layout: `<models-root>/<owner>/<repo>/`. Each repo directory carries `.ccut-manifest.json` (compatible with the older CucCut's downloader).
 * `installed` only requires that the manifest exists, that `revision` matches the registration, and that every listed file exists with a matching size. sha256 verification is a separate `verify()`, with results cached in memory, so the state query does not re-read hundreds of MB each time.
 *
 * The Worker's runtime state (`loading` / `ready` / `busy` / `unloading`) is reported by the Worker pool via `setRuntimeState`. Load failures and repeated crashes are recorded via `block`, and `enable` clears them. Progress of installation and repair is reported by the install task via `setInstallState` (`downloading`).
 *
 * State is computed per component. When some components are installed and others are missing, the state is `not-installed` / `incomplete`, and `components` lists each component. When a partial unfinished download is kept in staging, `install.state: 'paused'`. Changes to these states are notified via `onChange` (the `models` topic's `bundle.updated`).
 *
 * Components from a GitHub release page (`release`, the audio.cpp engine for music model packs) are platform-specific: the archive is selected by `platformKey`, and installed in `<toolsDir>/<name>/<version>/` (also with a manifest). When this host has no archive for it and there is no `engineOverride`, the model pack is `error` / `unsupported`. When `engineOverride` (`CUCCUT_AUDIOCPP_CLI`) points to an existing file, it counts as installed (`bytes` is null), and the install plan does not touch it. An engine installed by the older version as a managed external tool (the component directory has an executable and no manifest) also counts as installed; verification does not check it, and repair re-downloads the archive.
 */

export const MANIFEST_FILE = '.ccut-manifest.json';
/** After loading, a separation model pack's weights are several times the file size: stored in 16-bit, computed in 32-bit (HTDemucs-FT measured 673 MB against 336 MB). */
const SEPARATE_LOADED_WEIGHT_FACTOR = 2;

export interface CcutManifest {
  format_version: 1;
  repo: string;
  revision: string;
  source?: string;
  files: Array<{ path: string; size: number; sha256: string; source_verified?: boolean }>;
}

export interface ModelCatalogOptions {
  /** Root of the model catalog. See `resolveModelsRoot`. */
  root: string;
  /** Replace the built-in model pack registry (for tests): register as-is, without platform filtering. When not given, use the built-in registry filtered by `platformBundles`. */
  bundles?: readonly BundleDefinition[];
  platform?: NodeJS.Platform;
  arch?: string;
  /** Whether a Model Worker executable exists. When it does not, installed model packs show as `error` / `worker-missing`. */
  workerAvailable?: () => boolean;
  /**
   * Runtime Home's `tools/`: release-page components (the audio.cpp engine) are installed at `<toolsDir>/<name>/<version>/`. When not given, it is `<root>/.ccut-tools` (for tests; the Runtime always provides it).
   */
  toolsDir?: string;
  /**
   * Developer override for the engine (the Runtime passes `CUCCUT_AUDIOCPP_CLI`): when it points to an existing file, the release-page component counts as installed. No download, and platform unsupported is not reported.
   */
  engineOverride?: string | null;
  /** Platform key used to pick the archive for release-page components (for tests). When not given, it is `<platform>-<arch>`. */
  platformKey?: string;
  /** Upper limit on CPU threads passed to the Worker. Default is available cores minus two, at least 1 and at most 8. */
  threads?: number;
  /** Replace the built-in repo manifest (for tests): a paused installation reports its total bytes from it. */
  manifests?: readonly RepoManifestSpec[];
}

export type RuntimeBundleState = 'loading' | 'ready' | 'busy' | 'unloading';

/** Roughly how many bytes stay resident after the Model Worker loads a recognition model pack (for text-to-image model packs it is the peak, see `imagePeak`), and which pool it counts toward (architecture design §6.5, §7.7). */
export interface WorkerFootprint {
  /**
   * Approximate resident bytes: MLX and Core ML use storage bytes; candle converts by bit width (`candleResidentBytes`); GGML is the storage bytes of Whisper weights (whisper.cpp loads them as quantized) plus candle's VAD and aligner.
   */
  bytes: number;
  /**
   * `gpuMemory`: weights are on the GPU (Metal's unified memory, or CUDA or Vulkan VRAM). `memory`: candle or GGML runs on CPU, and the weights are in process memory.
   */
  pool: 'gpuMemory' | 'memory';
}

export interface VerifyResult {
  ok: boolean;
  problems: Array<{ repo: string; path: string; problem: 'missing' | 'size-mismatch' | 'hash-mismatch' }>;
  verifiedAt: string;
}

interface DiskCheck {
  ok: boolean;
  /** A release-page component satisfied by `engineOverride` (it has no file of its own; `bytes` is reported as null). */
  overridden?: boolean;
  reason?: ModelBundleReason;
  detail?: ModelText;
  /** Sum of sizes in the manifest when complete. */
  bytes?: number;
}

/**
 * Root of the model catalog (architecture design §6.3): the environment variable `CUCCUT_MODELS_DIR` takes priority, then the `models.dir` setting (`setting`), and if neither is set, `<runtime-home>/models`.
 */
export function resolveModelsRoot(runtimeHomeRoot: string, env: NodeJS.ProcessEnv = process.env, setting: string | null = null): string {
  return resolveModelsDir(runtimeHomeRoot, env, setting).path;
}

/** Same as `resolveModelsRoot`, also stating the source: `env`, `setting`, or `default`. */
export function resolveModelsDir(
  runtimeHomeRoot: string,
  env: NodeJS.ProcessEnv = process.env,
  setting: string | null = null,
): { path: string; source: 'env' | 'setting' | 'default'; defaultPath: string } {
  const defaultPath = path.join(runtimeHomeRoot, 'models');
  if (env.CUCCUT_MODELS_DIR) return { path: path.resolve(env.CUCCUT_MODELS_DIR), source: 'env', defaultPath };
  if (setting && path.resolve(setting) !== defaultPath) return { path: path.resolve(setting), source: 'setting', defaultPath };
  return { path: defaultPath, source: 'default', defaultPath };
}

/** Read a repo directory's manifest; returns null if missing or malformed. */
export async function readManifest(repoDir: string): Promise<CcutManifest | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(path.join(repoDir, MANIFEST_FILE), 'utf8'));
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (m.format_version !== 1 || typeof m.repo !== 'string' || typeof m.revision !== 'string' || !Array.isArray(m.files)) return null;
  for (const file of m.files as unknown[]) {
    if (typeof file !== 'object' || file === null) return null;
    const f = file as Record<string, unknown>;
    if (typeof f.path !== 'string' || !safeRelative(f.path)) return null;
    if (!Number.isSafeInteger(f.size) || (f.size as number) < 0) return null;
    if (typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) return null;
  }
  return raw as CcutManifest;
}

export class ModelCatalog {
  #root: string;
  /** The model directory is being moved: all model packs report `error` / `relocating`, no tasks can be submitted, and no files are handed out. */
  #relocating = false;
  readonly #bundles: Map<string, BundleDefinition>;
  readonly #platform: NodeJS.Platform;
  readonly #arch: string;
  readonly #workerAvailable: () => boolean;
  readonly #toolsDir: string | null;
  readonly #engineOverride: string | null;
  readonly #platformKey: string;
  readonly #threads: number;
  readonly #runtime = new Map<string, RuntimeBundleState>();
  readonly #blocked = new Map<string, { state: 'not-installed' | 'error'; reason: ModelBundleReason; detail?: ModelText }>();
  readonly #verified = new Map<string, VerifyResult>();
  readonly #install = new Map<string, ModelInstallProgress>();
  readonly #listeners = new Set<(bundleId: string) => void>();
  readonly #manifests: readonly RepoManifestSpec[];
  /** Devices reported by the Worker handshake (per backend, preferred first): candle model packs report and use `cuda` or `cpu` based on this; GGML's `cuda` / `vulkan` or `cpu`. */
  readonly #workerDevices = new Map<ModelBackend, string>();

  constructor(options: ModelCatalogOptions) {
    this.#root = options.root;
    this.#platform = options.platform ?? process.platform;
    this.#arch = options.arch ?? process.arch;
    this.#bundles = new Map((options.bundles ?? platformBundles(this.#platform, this.#arch)).map((b) => [b.bundleId, b]));
    this.#workerAvailable = options.workerAvailable ?? (() => true);
    this.#toolsDir = options.toolsDir ?? null;
    this.#engineOverride = options.engineOverride || null;
    this.#platformKey = options.platformKey ?? hostPlatformKey(this.#platform, this.#arch);
    this.#threads = options.threads ?? Math.max(1, Math.min(8, os.availableParallelism() - 2));
    this.#manifests = options.manifests ?? REPO_MANIFESTS;
  }

  /** Root of the model catalog. After `setRoot`, reads go to the new directory (installs, staging, and the install record all follow it). */
  get root(): string {
    return this.#root;
  }

  /** Storage for release-page components (the audio.cpp engine): Runtime Home's `tools/`. It does not move with the model directory. */
  get toolsDir(): string {
    return this.#toolsDir ?? path.join(this.#root, '.ccut-tools');
  }

  /** Platform key used to fetch release-page component archives (`darwin-arm64`, `win32-x64`, …). */
  get platformKey(): string {
    return this.#platformKey;
  }

  /** Developer override for the engine (`CUCCUT_AUDIOCPP_CLI`); null when not given. */
  get engineOverride(): string | null {
    return this.#engineOverride;
  }

  /** The release-page component's archive for this host; null if this is not a release-page component or this platform has no archive. */
  releaseAsset(source: Pick<BundleComponentSource, 'release'>): ComponentReleaseAsset | null {
    return source.release ? releaseAsset(source.release, this.#platformKey) : null;
  }

  /** Component directory: a model repo is `<root>/<owner>/<repo>/`, a release-page component is `<toolsDir>/<name>/<version>/`. */
  componentDir(source: Pick<BundleComponentSource, 'repo' | 'release'>): string {
    return source.release ? releaseDir(this.toolsDir, source.release) : this.repoDir(source.repo);
  }

  /** The release-page component is currently satisfied by `engineOverride`: an override is given and it is an existing file. */
  engineOverridden(source: Pick<BundleComponentSource, 'release'>): boolean {
    return source.release !== undefined && this.#engineOverride !== null && isFile(this.#engineOverride);
  }

  /**
   * The engine executable (absolute path) for a model pack, for the Runtime to locate the engine (Model Worker protocol spec §4.4). When `engineOverride` is given, only it is used (null if the file does not exist). Otherwise it is the executable inside the installed release-page component (`<toolsDir>/<name>/<version>/<executable>`; also counts when installed by the older version without a manifest).
   * Null when the model pack has no release-page component, when this platform has no archive, or when it is not yet installed. Only checks whether the file exists; does not execute it.
   */
  engineExecutable(bundleId: string): string | null {
    const def = this.#bundles.get(bundleId);
    const source = def ? componentsOf(def).find(([, s]) => s.release)?.[1] : undefined;
    if (!source?.release) return null;
    if (this.#engineOverride !== null) return isFile(this.#engineOverride) ? this.#engineOverride : null;
    const asset = releaseAsset(source.release, this.#platformKey);
    if (!asset) return null;
    const exe = path.join(this.componentDir(source), asset.executable);
    return isFile(exe) ? exe : null;
  }

  /**
   * Change the model directory (`models.setDir`, architecture design §6.3). The caller first confirms that no task is using it and all Workers have been unloaded. After the change, each model pack is recomputed from the files in the new directory: verification results, disable records, and runtime states are cleared, and listeners are notified one by one (the `models` topic's `bundle.updated`).
   */
  setRoot(root: string): void {
    this.#root = root;
    this.#verified.clear();
    this.#blocked.clear();
    this.#runtime.clear();
    for (const bundleId of this.#bundles.keys()) this.changed(bundleId);
  }

  /** The model directory is being moved (called once at start and once at end): model packs are unavailable during this time. */
  setRelocating(relocating: boolean): void {
    if (this.#relocating === relocating) return;
    this.#relocating = relocating;
    for (const bundleId of this.#bundles.keys()) this.changed(bundleId);
  }

  get relocating(): boolean {
    return this.#relocating;
  }

  /** All registered model packs. */
  definitions(): BundleDefinition[] {
    return [...this.#bundles.values()];
  }

  /** A model pack's state may have changed (runtime state, install progress, files, self-test). Listeners read `status` themselves. */
  onChange(listener: (bundleId: string) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Notify listeners that files or records changed (the caller reports this after install, delete, or self-test). */
  changed(bundleId: string): void {
    for (const listener of this.#listeners) {
      try {
        listener(bundleId);
      } catch {
        // A listener's own errors do not affect state.
      }
    }
  }

  /** The install task reports progress; null means no install is in progress (back to file-based state). */
  setInstallState(bundleId: string, progress: ModelInstallProgress | null): void {
    if (progress) this.#install.set(bundleId, { ...progress });
    else this.#install.delete(bundleId);
    this.changed(bundleId);
  }

  installState(bundleId: string): ModelInstallProgress | null {
    return this.#install.get(bundleId) ?? null;
  }

  /**
   * Whether a component (repo and version) is complete on disk: manifest, version, and every file present with matching size. Release-page components are checked separately for `engineOverride` and for executables installed by the older version (see the class description).
   */
  async componentInstalled(source: Pick<BundleComponentSource, 'repo' | 'revision' | 'release'>): Promise<boolean> {
    return (await this.#checkComponent(source)).ok;
  }

  definition(bundleId: string): BundleDefinition | null {
    return this.#bundles.get(bundleId) ?? null;
  }

  /**
   * Components handed to the Worker: the required components, plus the optional components installed at this moment. For recognition model packs, when the speaker-diarization (“说话人区分”) model pack (`diarization`) is installed, its components are included too (`segmentation` and `speaker`, architecture design §6.6).
   */
  async #workerComponents(def: BundleDefinition): Promise<Array<[BundleComponent, BundleComponentSource]>> {
    const out: Array<[BundleComponent, BundleComponentSource]> = [];
    for (const [name, source] of componentsOf(def)) {
      // Release-page components (the audio.cpp engine) are not handed to the Worker: the executor that runs them finds the executable itself (`engineExecutable`).
      if (source.release) continue;
      if (source.optional && !(await this.#checkComponent(source)).ok) continue;
      out.push([name, source]);
    }
    const pack = def.diarization ? this.#bundles.get(def.diarization) : undefined;
    if (pack && (await this.#packInstalled(pack))) {
      for (const [name, source] of componentsOf(pack)) if (!out.some(([n]) => n === name)) out.push([name, source]);
    }
    return out;
  }

  /** All required components of a model pack are installed (a speaker-diarization (“说话人区分”) pack that is not fully installed does not count). */
  async #packInstalled(def: BundleDefinition): Promise<boolean> {
    for (const [, source] of componentsOf(def)) if (!source.optional && !(await this.#checkComponent(source)).ok) return false;
    return true;
  }

  /**
   * Whether this recognition model pack can currently tell speakers apart: `native` means it distinguishes them itself (MOSS); `pack` means the speaker-diarization model pack it uses is installed; otherwise `none` (architecture design §6.6). `none` when it is not a recognition model pack.
   */
  async speakers(bundleId: string): Promise<'native' | 'pack' | 'none'> {
    const def = this.#bundles.get(bundleId);
    if (!def || def.capability !== 'transcribe') return 'none';
    if (def.components.asr?.family === 'moss-transcribe-diarize') return 'native';
    const pack = def.diarization ? this.#bundles.get(def.diarization) : undefined;
    return pack && (await this.#packInstalled(pack)) ? 'pack' : 'none';
  }

  /** Recognition model packs that use this speaker-diarization model pack. After it is installed or deleted, the idle Workers for these model packs must reload to add or remove its components. */
  diarizationUsers(packId: string): string[] {
    return [...this.#bundles.values()].filter((b) => b.diarization === packId).map((b) => b.bundleId);
  }

  /**
   * Bytes of weights the Model Worker loads for recognition, separation, and speaker-diarization model packs (used to estimate memory needs): required components, plus optional components installed at this moment (uninstalled ones are not loaded by the Worker and are not counted), plus the components of the installed speaker-diarization pack, summed from the built-in manifest. Separation weights are stored as 16-bit and upcast to 32-bit on load, so they count as twice the file size (HTDemucs-FT measured 673 MB resident against a 336 MB file). Null for unknown model packs, synthesis model packs (fixed requirement, pending measurement), or when components lack a manifest.
   */
  async workerWeightBytes(bundleId: string): Promise<number | null> {
    const def = this.#bundles.get(bundleId);
    if (!def || (def.capability !== 'transcribe' && def.capability !== 'separate' && def.capability !== 'diarize')) return null;
    const sources = (await this.#workerComponents(def)).map(([, source]) => source);
    const bytes = weightBytes(sources, this.#manifests);
    return bytes !== null && def.capability === 'separate' ? bytes * SEPARATE_LOADED_WEIGHT_FACTOR : bytes;
  }

  /**
   * Approximate resident bytes after the Model Worker loads recognition, separation, and speaker-diarization model packs, and which pool they count toward (same components as `workerWeightBytes`). MLX and Core ML use storage bytes (separation counts double, see `workerWeightBytes`), counted in GPU memory. candle converts by device: `cuda` counts in GPU memory, `cpu` counts in memory. candle separation upcasts to f32 on both devices (same as v2), also counted at twice the file size. GGML's Whisper weights use storage bytes. The VAD and aligner under candle CPU are converted as `cpu`, and the total counts in GPU memory when the device is not `cpu` (`cuda` or `vulkan`), and in memory when it is `cpu` (architecture design §6.5). Synthesis counts only candle model packs (also converted by device). MLX synthesis model packs use a fixed requirement, null. Null when the size is unknown.
   */
  async workerFootprint(bundleId: string): Promise<WorkerFootprint | null> {
    const def = this.#bundles.get(bundleId);
    const synthesizeOnCandle = def?.capability === 'synthesize' && def.backend === 'candle';
    const local = def?.capability === 'transcribe' || def?.capability === 'separate' || def?.capability === 'diarize';
    if (!def || (!local && !synthesizeOnCandle)) return null;
    const sources = (await this.#workerComponents(def)).map(([, source]) => source);
    if (def.backend === 'ggml') {
      const [asr, rest] = [sources.filter((s) => s.family === 'whisper-ggml'), sources.filter((s) => s.family !== 'whisper-ggml')];
      const whisper = weightBytes(asr, this.#manifests);
      const candle = this.#candleBytes('cpu', rest);
      if (whisper === null || candle === null) return null;
      return { bytes: whisper + candle, pool: this.#device(def) !== 'cpu' ? 'gpuMemory' : 'memory' };
    }
    if (def.backend !== 'candle') {
      const bytes = weightBytes(sources, this.#manifests);
      if (bytes === null) return null;
      return { bytes: def.capability === 'separate' ? bytes * SEPARATE_LOADED_WEIGHT_FACTOR : bytes, pool: 'gpuMemory' };
    }
    const device = this.#device(def);
    const pool = device === 'cuda' ? 'gpuMemory' : 'memory';
    if (def.capability === 'separate') {
      const bytes = weightBytes(sources, this.#manifests);
      return bytes === null ? null : { bytes: bytes * SEPARATE_LOADED_WEIGHT_FACTOR, pool };
    }
    const bytes = this.#candleBytes(device, sources);
    return bytes === null ? null : { bytes, pool };
  }

  /** Approximate resident bytes of these components on candle's `device` (`candleResidentBytes`); null when components lack a manifest. */
  #candleBytes(device: string, sources: readonly BundleComponentSource[]): number | null {
    const components: Parameters<typeof candleResidentBytes>[1][number][] = [];
    for (const source of sources) {
      const bytes = weightBytes([source], this.#manifests);
      if (bytes === null) return null;
      components.push({
        bytes,
        ...(source.weightBits ? { weightBits: source.weightBits } : {}),
        ...(source.parameters ? { parameters: source.parameters } : {}),
      });
    }
    return candleResidentBytes(device, components);
  }

  /**
   * Model Worker peak for text-to-image model packs, and which pool it counts toward (architecture design §6.5). Uses the registered measured peak for the model pack (`image.peakBytes`; when the device reported by the Worker is in `image.devicePeakBytes`, that value is used). MLX and candle CUDA count toward GPU memory; candle CPU counts toward memory. Null when it is not a text-to-image model pack.
   */
  imagePeak(bundleId: string): WorkerFootprint | null {
    const def = this.#bundles.get(bundleId);
    if (!def?.image) return null;
    const device = this.#device(def);
    const bytes = def.image.devicePeakBytes?.[device] ?? def.image.peakBytes;
    return { bytes, pool: def.backend === 'candle' && device !== 'cuda' ? 'memory' : 'gpuMemory' };
  }

  /**
   * Engine process peak for music generation model packs, and which pool it counts toward (architecture design §6.5). Uses the registered estimated peak for the model pack (`music.peakBytes`). On Apple Silicon, unified memory counts toward GPU memory (same as MLX). On other platforms the engine's build (CUDA, Vulkan, or CPU) is not known, so it conservatively counts toward memory. Null when it is not a music model pack.
   */
  musicPeak(bundleId: string): WorkerFootprint | null {
    const def = this.#bundles.get(bundleId);
    if (!def?.music) return null;
    const unified = this.#platform === 'darwin' && this.#arch === 'arm64';
    return { bytes: def.music.peakBytes, pool: unified ? 'gpuMemory' : 'memory' };
  }

  /** The default transcription model pack on this machine (MLX on Apple Silicon, candle on other platforms). */
  defaultTranscribeBundle(): string {
    return defaultTranscribeBundle(this.#platform, this.#arch);
  }

  /**
   * The Worker handshake reported a backend's device (preferred first; passes null when the backend is unavailable). The state of candle and GGML model packs, and the device handed to the Worker, follow it: candle uses `cuda` when CUDA is available; GGML uses `cuda` or `vulkan` when a GPU is available (the CUDA install is `cuda`, the Vulkan install is `vulkan`), otherwise the registered `cpu`. MLX and Core ML devices are registered and are unaffected.
   */
  setWorkerDevice(backend: ModelBackend, device: string | null): void {
    if (!followsWorkerDevice(backend)) return;
    const before = this.#workerDevices.get(backend) ?? null;
    if (device === before) return;
    if (device) this.#workerDevices.set(backend, device);
    else this.#workerDevices.delete(backend);
    for (const def of this.#bundles.values()) if (def.backend === backend) this.changed(def.bundleId);
  }

  #device(def: BundleDefinition): string {
    return (followsWorkerDevice(def.backend) ? this.#workerDevices.get(def.backend) : undefined) ?? def.device;
  }

  async list(): Promise<ModelBundleStatus[]> {
    return Promise.all([...this.#bundles.keys()].map((bundleId) => this.status(bundleId) as Promise<ModelBundleStatus>));
  }

  /** A model pack's current state; returns null for unknown model packs. */
  async status(bundleId: string): Promise<ModelBundleStatus | null> {
    const def = this.#bundles.get(bundleId);
    if (!def) return null;
    const base = {
      bundleId,
      capability: def.capability,
      backend: def.backend,
      device: this.#device(def),
      ...(def.label ? { label: def.label } : {}),
      ...(def.license ? { license: def.license } : {}),
      estimatedBytes: weightBytes(requiredSources(def), this.#manifests, this.#platformKey),
    };
    const checks = await Promise.all(
      componentsOf(def).map(async ([name, source]) => ({ name, source, check: await this.#checkComponent(source) })),
    );
    const components: ModelComponentStatus[] = checks.map(({ name, source, check }) => ({
      component: name,
      repo: source.repo,
      revision: source.revision,
      ...(source.release ? { origin: 'github-release' as const } : {}),
      state: check.ok ? 'installed' : 'missing',
      bytes: check.ok && !check.overridden ? (check.bytes ?? 0) : null,
      estimatedBytes: weightBytes([source], this.#manifests, this.#platformKey),
      sharedWith: this.#sharers(bundleId, source),
      ...(source.optional ? { optional: true } : {}),
      ...(source.license ? { license: source.license } : {}),
    }));
    // A missing optional component does not affect whether the pack is installed. A paused installation still counts the part already in staging.
    const missingAny = checks.filter((c) => !c.check.ok);
    const required = checks.filter((c) => !c.source.optional);
    const missing = required.filter((c) => !c.check.ok);
    const install = this.#install.get(bundleId) ?? (missingAny.length > 0 ? await this.#paused(missingAny.map((c) => c.source)) : null);
    const selfTest = (await readInstallRecord(this.root)).bundles[bundleId]?.selfTest;
    const make = (state: ModelBundleState, reason?: ModelBundleReason, detail?: ModelText): ModelBundleStatus => ({
      ...base,
      state,
      ...(reason ? { reason } : {}),
      ...(detail ? modelDetail(detail) : {}),
      components,
      ...(install ? { install: { ...install } } : {}),
      ...(selfTest ? { selfTest } : {}),
    });
    if (!backendSupported(def.backend, this.#platform, this.#arch)) {
      return make('error', 'unsupported', M.backendUnsupported({ backend: def.backend, platform: this.#platform, arch: this.#arch }));
    }
    // The release-page component (audio.cpp engine) has no archive on this platform, and there is no `engineOverride`.
    const noBuild = checks.find((c) => c.check.reason === 'unsupported');
    if (noBuild) return make('error', 'unsupported', noBuild.check.detail);
    if (this.#relocating) return make('error', 'relocating', M.relocating());
    if (this.#install.has(bundleId)) return make('downloading');
    if (missing.length > 0 && missing.length < required.length) {
      // The component list is first joined into a string (parameters do not accept arrays): each component's reason keeps only the text in the current language.
      const names = missing
        .map((c) => M.missingComponent({ name: c.name, detail: c.check.detail ?? c.source.repo }).text)
        .join(M.listSeparator().text);
      return make('not-installed', 'incomplete', M.incomplete({ names }));
    }
    if (missing.length > 0) return make('not-installed', missing[0]!.check.reason, missing[0]!.check.detail);
    const verified = this.#verified.get(bundleId);
    if (verified && !verified.ok) return make('not-installed', 'hash-mismatch', describeProblems(verified));
    const blocked = this.#blocked.get(bundleId);
    if (blocked) return make(blocked.state, blocked.reason, blocked.detail);
    // Music model packs (`audio-cpp`) do not go through the Model Worker. The engine is their component, and when it is missing the state is the `incomplete` above.
    if (def.backend !== 'audio-cpp' && !this.#workerAvailable()) return make('error', 'worker-missing', M.workerMissing());
    const runtime = this.#runtime.get(bundleId);
    return make(runtime ?? 'installed');
  }

  /**
   * The model pack description the Worker hands to `model.load` (protocol spec §4). Throws when files are incomplete. `device` is the device this Worker reported in its handshake (candle's `cuda` or `cpu`, GGML's `cuda` / `vulkan` or `cpu`). When not given, use the one recorded by `setWorkerDevice`, and if none, the registered one.
   */
  async bundleFor(bundleId: string, options: { memoryBudgetBytes?: number | null; device?: string } = {}): Promise<ModelBundle> {
    const def = this.#bundles.get(bundleId);
    if (!def) throw new Error(M.noBundle({ bundleId }).text);
    if (this.#relocating) throw new Error(M.moving().text);
    const components: ModelBundle['components'] = {};
    // Optional components that are not installed are not handed to the Worker. Components of an installed speaker-diarization model pack are handed over too.
    for (const [name, source] of await this.#workerComponents(def)) {
      const dir = this.repoDir(source.repo);
      const manifest = await readManifest(dir);
      if (!manifest || manifest.revision !== source.revision) throw new Error(M.notInstalled({ repo: source.repo }).text);
      const files: ModelFiles['files'] = manifest.files.map((f) => ({ path: f.path, sha256: f.sha256, byteLength: f.size }));
      components[name] = source.subdir
        ? scopedFiles(source.family, source.revision, dir, files, source.subdir)
        : { family: source.family, revision: source.revision, dir, files };
    }
    return {
      bundleId,
      backend: def.backend,
      device: options.device ?? this.#device(def),
      components,
      threads: this.#threads,
      memoryBudgetBytes: options.memoryBudgetBytes ?? null,
    };
  }

  /** Compute sha256 for each file and compare with the manifest. Results are cached in memory; `status` reports `hash-mismatch` based on them. */
  async verify(bundleId: string): Promise<VerifyResult> {
    const def = this.#bundles.get(bundleId);
    if (!def) throw new Error(M.noBundle({ bundleId }).text);
    const problems: VerifyResult['problems'] = [];
    for (const [, source] of componentsOf(def)) {
      // Release-page components satisfied by `engineOverride` have no files of their own.
      if (this.engineOverridden(source)) continue;
      const dir = this.componentDir(source);
      const manifest = await readManifest(dir);
      // Uninstalled optional components do not count as a problem.
      if (source.optional && manifest?.revision !== source.revision) continue;
      // An engine installed by the older version (has an executable, no manifest) has no digest to check against: it passes. Repair re-downloads the archive.
      if (!manifest && (await this.#legacyRelease(source))) continue;
      if (!manifest) {
        problems.push({ repo: source.repo, path: MANIFEST_FILE, problem: 'missing' });
        continue;
      }
      for (const file of manifest.files) {
        const full = path.join(dir, file.path);
        const stat = await fs.stat(full).catch(() => null);
        if (!stat?.isFile()) problems.push({ repo: source.repo, path: file.path, problem: 'missing' });
        else if (stat.size !== file.size) problems.push({ repo: source.repo, path: file.path, problem: 'size-mismatch' });
        else if ((await sha256File(full)) !== file.sha256) problems.push({ repo: source.repo, path: file.path, problem: 'hash-mismatch' });
      }
    }
    const result: VerifyResult = { ok: problems.length === 0, problems, verifiedAt: new Date().toISOString() };
    this.#verified.set(bundleId, result);
    return result;
  }

  repoDir(repo: string): string {
    return path.join(this.root, ...repo.split('/'));
  }

  /** The Worker pool reports runtime state; null means no Worker holds it (back to `installed`). */
  setRuntimeState(bundleId: string, state: RuntimeBundleState | null): void {
    const before = this.#runtime.get(bundleId) ?? null;
    if (state) this.#runtime.set(bundleId, state);
    else this.#runtime.delete(bundleId);
    if (before !== state) this.changed(bundleId);
  }

  /** Load failure or repeated crashes: no longer auto-started until `enable`. */
  block(bundleId: string, state: 'not-installed' | 'error', reason: ModelBundleReason, detail?: ModelText): void {
    this.#blocked.set(bundleId, { state, reason, ...(detail ? { detail } : {}) });
    this.#runtime.delete(bundleId);
    this.changed(bundleId);
  }

  blocked(bundleId: string): boolean {
    return this.#blocked.has(bundleId);
  }

  /** Re-enabled by the user: clears the records of load failure, disabling, and verification. */
  enable(bundleId: string): void {
    this.#blocked.delete(bundleId);
    this.#verified.delete(bundleId);
    this.changed(bundleId);
  }

  /** Release-page component installed by the older version (as a managed external tool): the component directory has this platform's executable and no manifest. */
  async #legacyRelease(source: Pick<BundleComponentSource, 'repo' | 'release'>): Promise<boolean> {
    const asset = this.releaseAsset(source);
    if (!asset) return false;
    const stat = await fs.stat(path.join(this.componentDir(source), asset.executable)).catch(() => null);
    return stat?.isFile() ?? false;
  }

  async #checkComponent(source: Pick<BundleComponentSource, 'repo' | 'revision' | 'release'>): Promise<DiskCheck> {
    if (source.release) {
      if (this.engineOverridden(source)) return { ok: true, overridden: true };
      if (!this.releaseAsset(source)) return { ok: false, reason: 'unsupported', detail: M.engineNoBuild({ platform: this.#platformKey }) };
    }
    const dir = this.componentDir(source);
    const manifest = await readManifest(dir);
    if (!manifest && source.release) {
      if (await this.#legacyRelease(source)) return { ok: true, bytes: await rootFileBytes(dir) };
      return { ok: false, reason: 'missing-file', detail: M.engineNotInstalled({ version: source.release.version }) };
    }
    if (!manifest) return { ok: false, reason: 'missing-manifest', detail: M.noManifest({ repo: source.repo }) };
    if (manifest.revision !== source.revision) {
      return { ok: false, reason: 'missing-manifest', detail: M.wrongRevision({ repo: source.repo, revision: source.revision.slice(0, 7) }) };
    }
    let bytes = 0;
    for (const file of manifest.files) {
      const stat = await fs.stat(path.join(dir, file.path)).catch(() => null);
      if (!stat?.isFile()) return { ok: false, reason: 'missing-file', detail: M.missingFile({ repo: source.repo, file: file.path }) };
      if (stat.size !== file.size) return { ok: false, reason: 'size-mismatch', detail: M.sizeMismatch({ repo: source.repo, file: file.path }) };
      bytes += file.size;
    }
    return { ok: true, bytes };
  }

  /** Other model packs that use this same component (same repo and version). */
  #sharers(bundleId: string, source: BundleComponentSource): string[] {
    return [...this.#bundles.values()]
      .filter((b) => b.bundleId !== bundleId && componentsOf(b).some(([, s]) => s.repo === source.repo && s.revision === source.revision))
      .map((b) => b.bundleId);
  }

  /** Partial part of a missing component left in staging: sometimes reported as a paused installation. Total bytes are given only when the built-in manifest provides all sizes. */
  async #paused(sources: BundleComponentSource[]): Promise<ModelInstallProgress | null> {
    let received = 0;
    let total: number | null = 0;
    for (const source of sources) {
      if (source.release) {
        const asset = this.releaseAsset(source);
        if (asset) received += await releaseStagedBytes(this.toolsDir, source.release, asset);
        total = total === null || !asset ? null : total + asset.size;
        continue;
      }
      received += await stagedBytes(this.root, source.repo, source.revision);
      const spec = repoManifestFor(source.repo, source.revision, this.#manifests);
      const sizes = spec?.files.map((f) => f.size) ?? [null];
      total = total === null || sizes.some((size) => size === null) ? null : total + sizes.reduce<number>((a, b) => a + (b ?? 0), 0);
    }
    if (received === 0) return null;
    return { jobId: null, state: 'paused', receivedBytes: received, totalBytes: total };
  }
}

/** Whether the state allows submitting tasks. */
export function bundleUsable(status: ModelBundleStatus): boolean {
  return status.state !== 'not-installed' && status.state !== 'error' && status.state !== 'downloading';
}

/** Backend devices reported by the Worker handshake: candle (`cuda` / `cpu`) and GGML (`cuda` / `vulkan` / `cpu`). */
function followsWorkerDevice(backend: ModelBackend): boolean {
  return backend === 'candle' || backend === 'ggml';
}

function componentsOf(def: BundleDefinition): Array<[BundleComponent, BundleComponentSource]> {
  return Object.entries(def.components) as Array<[BundleComponent, BundleComponentSource]>;
}

/** Component is in a repo subdirectory (`BundleComponentSource.subdir`): the directory is the subdirectory, carrying only the files under it, with paths relative to it. */
function scopedFiles(
  family: ModelFiles['family'],
  revision: string,
  repoDir: string,
  files: ModelFiles['files'],
  subdir: string,
): ModelFiles {
  const prefix = `${subdir}/`;
  const scoped = files.filter((f) => f.path.startsWith(prefix)).map((f) => ({ ...f, path: f.path.slice(prefix.length) }));
  if (scoped.length === 0) throw new Error(M.noFilesInSubdir({ subdir }).text);
  return { family, revision, dir: path.join(repoDir, ...subdir.split('/')), files: scoped };
}

function safeRelative(file: string): boolean {
  if (file === '' || path.isAbsolute(file) || file.includes('\\')) return false;
  return file.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function describeProblems(result: VerifyResult): string {
  return result.problems
    .slice(0, 3)
    .map((p) => `${p.repo}/${p.path}: ${p.problem}`)
    .join('; ');
}

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/** Sum of sizes of regular files directly under the directory root (engine directory installed by the older version, which has no manifest). */
async function rootFileBytes(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isFile()) total += (await fs.stat(path.join(dir, entry.name)).catch(() => null))?.size ?? 0;
  }
  return total;
}

export async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

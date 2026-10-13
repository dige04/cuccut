import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs, { type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import type { AppUpdateFailure, AppUpdateInfo, AppUpdateNotice, AppUpdatePrefs, AppUpdateSnapshot, AppUpdateState } from '@cuccut/ui';
import {
  FIRST_CHECK_DELAY_S,
  QUIT_INSTALL_DEADLINE_MS,
  TICK_S,
  bucketFromId,
  checkPending,
  fileName,
  fileUrlPath,
  followup,
  isFileUrl,
  isInstallationId,
  isNewer,
  mayAutoCheck,
  parseManifest,
  percent,
  progressDue,
  reduce,
  rolloutAdmits,
  rolloutFraction,
  shouldAutoCheck,
  stateInfo,
  systemRequirementUnmet,
  type CheckReport,
  type FeedTarget,
  type Origin,
  type Rollout,
  type UpdateEvent,
} from './app-update-rules.ts';

/*
 * Main-process service for app auto-update (architecture design §2.6): fetches the manifest, streams the download while computing SHA-256 as it goes, verifies, caches and cleans up,
 * runs the metronome, and dispatches installation. The criteria are in app-update-rules.ts; platform swapping is in app-update-install.ts; Electron wiring is in
 * app-update-ipc.ts. Electron is not imported here: the outside world (network, clock, timers, Finder, quit) is injected as dependencies, and unit tests use temporary directories,
 * file:// manifests and a fake network.
 *
 * After a download, it first passes the verification stage (platform verification and staging; on macOS this is where the bundle is unpacked and its signature verified). Only after it passes does it count as “已下载” (downloaded). While “已下载” (downloaded), automatic checks still run,
 * and a newer build discards the old download. It never restarts the user on its own: “重启并更新” (restart and update) starts only after the UI has passed the stop barrier and `install` has been called. Once the swap program has started,
 * the app quits normally (`before-quit` stops the Runtime, following the normal stop in §2.4). When the user quits the app themselves, after the Runtime has stopped,
 * `installOnQuit` hands the staged new package to the swap program, and it is not reopened after the swap.
 */

/** A byte stream (a read stream from a local file, or a network response body). */
export type ByteSource = AsyncIterable<Uint8Array>;

export type DownloadResult =
  | { ok: true; path: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; failure: AppUpdateFailure; detail: string };

const CANCELLED: DownloadResult = { ok: false, cancelled: true };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface DownloadOptions {
  signal: AbortSignal;
  /** 0–100; the caller throttles it itself. */
  onProgress(pct: number): void;
  /** Opens the byte stream of an https installer (local files do not go through this). */
  openRemote(url: string, signal: AbortSignal): Promise<ByteSource>;
}

/**
 * Streams the download to `dir/<file name>.part`, computing SHA-256 while writing. The file is renamed to its final name only when both size and digest match. Exceeding the manifest size aborts immediately,
 * and it aborts as soon as `signal` stops. Any failure deletes the `.part`; on success, other installer packages in the cache directory are removed.
 */
export async function downloadTo(info: AppUpdateInfo, dir: string, options: DownloadOptions): Promise<DownloadResult> {
  const name = fileName(info);
  const destination = path.join(dir, name);
  const part = path.join(dir, `${name}.part`);
  const failed = (failure: AppUpdateFailure, detail: string): DownloadResult => ({ ok: false, cancelled: false, failure, detail });
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    return failed('download', errorText(error));
  }
  const open: { handle: FileHandle | null } = { handle: null };
  const result = await (async (): Promise<DownloadResult> => {
    let source: ByteSource;
    try {
      const local = isFileUrl(info.url) ? fileUrlPath(info.url) : null;
      source = local !== null ? createReadStream(local) : await options.openRemote(info.url, options.signal);
      open.handle = await fs.open(part, 'w');
    } catch (error) {
      return options.signal.aborted ? CANCELLED : failed('download', errorText(error));
    }
    const hash = createHash('sha256');
    let received = 0;
    options.onProgress(0);
    try {
      for await (const chunk of source) {
        if (options.signal.aborted) return CANCELLED;
        received += chunk.byteLength;
        if (received > info.size) return failed('verify', `larger than the manifest size ${info.size}`);
        hash.update(chunk);
        await open.handle.write(chunk);
        options.onProgress(percent(received, info.size));
      }
    } catch (error) {
      return options.signal.aborted ? CANCELLED : failed('download', errorText(error));
    }
    if (options.signal.aborted) return CANCELLED;
    try {
      await open.handle.sync();
      await open.handle.close();
      open.handle = null;
    } catch (error) {
      return failed('download', errorText(error));
    }
    if (received !== info.size) return failed('verify', `size ${received} != ${info.size}`);
    const actual = hash.digest('hex');
    if (actual !== info.sha256) return failed('verify', `sha256 ${actual} != ${info.sha256}`);
    try {
      await fs.rm(destination, { force: true });
      await fs.rename(part, destination);
    } catch (error) {
      return failed('download', errorText(error));
    }
    return { ok: true, path: destination };
  })();
  await open.handle?.close().catch(() => undefined);
  if (result.ok) await prune(dir, destination);
  else await fs.rm(part, { force: true }).catch(() => undefined);
  return result;
}

/**
 * After the new package is downloaded, removes other installer packages, leftover `.part` files and extracted packages (`unpack-*`; old versions often ran to hundreds of MB) from the cache directory. The new package's own extraction directory
 * is recreated later, in the verification stage.
 */
async function prune(dir: string, keep: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name.startsWith('unpack-')) await fs.rm(file, { recursive: true, force: true }).catch(() => undefined);
    if (!entry.isFile() || file === keep) continue;
    if (/\.(zip|dmg|exe|part)$/i.test(entry.name)) await fs.rm(file, { force: true }).catch(() => undefined);
  }
}

/**
 * Removes installer packages and `.part` files in the cache directory that are older than `before` (milliseconds). After the Windows installer finishes and reopens the app, it leaves itself in the cache directory
 * (the macOS swap script deletes its files right after the swap). Only files older than this launch are deleted, so a new release downloaded after this launch is not removed. Files that cannot be deleted (the installer has not exited yet) are kept.
 */
export async function discardStaleDownloads(dir: string, before: number): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(zip|dmg|exe|part)$/i.test(entry.name)) continue;
    const file = path.join(dir, entry.name);
    const stat = await fs.stat(file).catch(() => null);
    if (stat && stat.mtimeMs < before) await fs.rm(file, { force: true }).catch(() => undefined);
  }
}

/** The file exists, and both its size and digest match the manifest. */
export async function verifyFile(file: string, info: Pick<AppUpdateInfo, 'size' | 'sha256'>): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size !== info.size) return false;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
    return hash.digest('hex') === info.sha256;
  } catch {
    return false;
  }
}

/** The file for the same build in the cache directory that is downloaded and still intact (its digest is recomputed). */
export async function cachedDownload(info: AppUpdateInfo, dir: string): Promise<string | null> {
  const file = path.join(dir, fileName(info));
  return (await verifyFile(file, info)) ? file : null;
}

/**
 * This machine's position in the staged rollout ([0, 1)): takes the install identifier from `file`. If there is none or it cannot be read, a new one is generated and written back if possible. If it cannot be written, it is still used,
 * but the position will change on the next launch.
 */
export async function installationBucket(file: string): Promise<number> {
  const stored = await fs.readFile(file, 'utf8').then(
    (text) => text.trim(),
    () => '',
  );
  if (isInstallationId(stored)) return bucketFromId(stored);
  const id = randomUUID();
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${id}\n`);
  } catch {
    // Use the one generated this time.
  }
  return bucketFromId(id);
}

// ---- Service ----

/** Result of a platform swap: the swap program has started (the app should quit), this machine cannot swap by itself (manual route), or it failed. */
export type InstallOutcome = { type: 'launched' } | { type: 'fallback' } | { type: 'failed'; failure: AppUpdateFailure; detail: string };

/** The staged new package: the verified `.app` unpacked on macOS, and the directory containing it (`unpack-<build>` in the cache directory). */
export interface StagedApp {
  app: string;
  dir: string;
}

/** Verification and staging after download, before “已下载” (downloaded): staged, not staged (Windows, or a machine that cannot swap by itself), or failed. */
export type Prepared =
  | { type: 'staged'; staged: StagedApp }
  | { type: 'none' }
  | { type: 'failed'; failure: AppUpdateFailure; detail: string };

export interface AppUpdateDeps {
  /** Why updates are not checked; null when enabled (the result of `availability`). */
  unsupported: 'dev' | 'appStore' | null;
  target: FeedTarget | null;
  /** This build's variant (Windows cpu / cuda / vulkan, written at packaging). If the manifest states a `variant`, it must match this. null means the standard build. */
  variant: string | null;
  /** Which manifest to read. `allowFileUrl` is true only when the update source has been overridden by the environment variable to a local file. */
  feed: { url: string; allowFileUrl: boolean } | null;
  current: { version: string; build: number };
  /** This machine's OS version (compared on macOS only). */
  systemVersion: string | null;
  macos: boolean;
  cacheDir: string | null;
  /** Fetches the body of an https manifest (local files do not go through this). */
  fetchText(url: string): Promise<string>;
  openRemote(url: string, signal: AbortSignal): Promise<ByteSource>;
  /** Whether this machine can swap the package without manual action by the user. */
  canAutoInstall(): Promise<boolean>;
  /** Verification and staging after the download (or after finding it in the cache) and the digest check (on macOS, unpacks and verifies the signature). Ends when `signal` stops. */
  prepare(info: AppUpdateInfo, archive: string, signal: AbortSignal): Promise<Prepared>;
  /**
   * Platform swap. `staged` is the staged new package (when absent: Windows proceeds as usual; on macOS, “重启并更新” (restart and update) unpacks and verifies from the start, while install-on-quit does not install).
   * `relaunch` says whether to reopen the app after the swap (install-on-quit does not reopen).
   */
  installPackage(info: AppUpdateInfo, archive: string, options: { staged: StagedApp | null; relaunch: boolean }): Promise<InstallOutcome>;
  /** Reveals the file in Finder / Explorer. */
  reveal(file: string): void;
  openDownloadPage(): void;
  /** Quits the app normally (stops the Runtime in `before-quit`). */
  quit(): void;
  /** This machine's position in the staged rollout ([0, 1), fixed per install). Read only when the manifest is staged, and only for automatic checks. */
  rolloutBucket(): Promise<number>;
  /** Now (milliseconds). */
  now(): number;
  /** Timer; returns a cancel function. */
  schedule(run: () => void, ms: number): () => void;
  log(message: string): void;
}

export interface AppUpdateService {
  snapshot(): AppUpdateSnapshot;
  /** Starts the metronome: the first tick 15 seconds after launch, then one every 30 minutes. */
  start(): void;
  dispose(): void;
  /** Update preferences (held by the Runtime). No automatic checks run until they are received. When automatic checks are turned on and a tick is due, the missed tick runs immediately. */
  configure(prefs: AppUpdatePrefs): void;
  check(origin: Origin): Promise<void>;
  download(): void;
  cancel(): void;
  /** “重启并更新” (restart and update): reopens the app after the swap. */
  install(): Promise<void>;
  /**
   * Install on quit: called after the app has quit normally and the Runtime has stopped. Only when “已下载” (downloaded) (including a silent check in flight) and this machine can swap by itself does it hand the staged new package to the swap program,
   * without reopening after the swap. In any other case it does nothing. It is time-limited and never throws.
   */
  installOnQuit(): Promise<void>;
  openDownloadPage(): void;
  onState(listener: (snapshot: AppUpdateSnapshot) => void): () => void;
  onNotice(listener: (notice: AppUpdateNotice) => void): () => void;
}

export function createAppUpdateService(deps: AppUpdateDeps): AppUpdateService {
  let state: AppUpdateState = deps.unsupported ? { k: 'unsupported', why: deps.unsupported } : { k: 'idle' };
  let lastCheckAt: number | null = null;
  let prefs: AppUpdatePrefs | null = null;
  /** The first tick, 15 seconds after launch, is due. */
  let firstTickDue = false;
  /** The first tick has been used (an automatic check actually ran). */
  let firstTickUsed = false;
  /** A check is in flight. A silent check does not enter `checking`, so it cannot be seen from the state; this flag prevents duplicates. */
  let checkInFlight = false;
  /** The download in flight (including the verification stage). The generation is incremented on cancel or when a new download round starts, so a late result that no longer matches is dropped. */
  let generation = 0;
  let active: { generation: number; controller: AbortController; origin: Origin } | null = null;
  /** Result of the verification stage for the version in “已下载” (downloaded): which build, which file, and the staged new package (null if no staging is needed). */
  let prepared: { build: number; path: string; staged: StagedApp | null } | null = null;
  /** Only one verification stage runs at a time. After a cancel, the stopped run finishes first, and only then does the next one start unpacking (both use the same `unpack-<build>`). */
  let stagingLock: Promise<void> = Promise.resolve();
  /** Install on quit happens only once. */
  let quitInstallStarted = false;
  /** Builds that have already triggered the “已下载” (downloaded) reminder in this run (each build is reminded only once). */
  let toastedBuild: number | null = null;
  let stopTimer: (() => void) | null = null;
  let disposed = false;
  let bucket: Promise<number> | null = null;
  const stateListeners = new Set<(snapshot: AppUpdateSnapshot) => void>();
  const noticeListeners = new Set<(notice: AppUpdateNotice) => void>();

  const nowS = () => Math.floor(deps.now() / 1000);
  const current = (): AppUpdateState => state;
  const snapshot = (): AppUpdateSnapshot => ({ state, lastCheckAt, current: deps.current });
  const emit = () => {
    const current = snapshot();
    for (const listener of stateListeners) listener(current);
  };
  /** Transitions the state; if it changed, pushes a copy. Returns whether it changed. */
  const dispatch = (event: UpdateEvent): boolean => {
    const next = reduce(state, event);
    if (next === state) return false;
    state = next;
    emit();
    return true;
  };
  const notify = (notice: AppUpdateNotice) => {
    for (const listener of noticeListeners) listener(notice);
  };
  const notifyReady = (info: AppUpdateInfo) => {
    if (toastedBuild === info.build) return;
    toastedBuild = info.build;
    notify({ kind: 'ready', info });
  };

  /** The staged new package for the version in “已下载” (downloaded). */
  const preparedFor = (info: AppUpdateInfo, archive: string) =>
    prepared?.build === info.build && prepared.path === archive ? prepared : null;

  /** Discards a downloaded package: deletes the installer and the extracted directory. (The discarded version was superseded by a new build, withdrawn, or failed verification or installation.) */
  async function discardDownload(archive: string, build: number): Promise<void> {
    const staged = prepared?.build === build ? prepared.staged : null;
    if (prepared?.build === build) prepared = null;
    await fs.rm(archive, { force: true }).catch(() => undefined);
    if (staged) await fs.rm(staged.dir, { recursive: true, force: true }).catch(() => undefined);
  }

  /**
   * Staged rollout (applies to automatic checks only): a manual check, a manifest that is not staged, or a pre-check state that already carries the same build (found or downloaded by a manual check) is always offered,
   * so an update the user already has is not taken back. Otherwise the release is offered only if this machine's position falls within the released portion.
   */
  async function admitted(origin: Origin, info: AppUpdateInfo, rollout: Rollout | null, prior: AppUpdateInfo | null): Promise<boolean> {
    if (origin === 'manual' || !rollout || prior?.build === info.build) return true;
    const fraction = rolloutFraction(rollout, deps.now());
    if (fraction >= 1) return true;
    bucket ??= deps.rolloutBucket().catch(() => Math.random());
    const mine = await bucket;
    if (rolloutAdmits(fraction, mine)) return true;
    // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
    deps.log(`分批推送：build ${info.build} 暂不推给本机（已放开 ${(fraction * 100).toFixed(1)}%，本机位置 ${(mine * 100).toFixed(1)}%）`);
    return false;
  }

  async function runCheck(origin: Origin, prior: AppUpdateState): Promise<CheckReport> {
    if (!deps.target || !deps.feed) throw new Error('no update feed for this platform');
    const { url, allowFileUrl } = deps.feed;
    const local = isFileUrl(url) ? fileUrlPath(url) : null;
    const text = local !== null ? await fs.readFile(local, 'utf8') : await deps.fetchText(url);
    const parsed = parseManifest(text, deps.target, allowFileUrl, deps.variant);
    if (!parsed.ok) throw new Error(`${parsed.error}: ${parsed.detail}`);
    const { info, rollout } = parsed;
    const nothing: CheckReport = { info: null, heldBack: false, cached: null, canAutoInstall: false, systemUnmet: null };
    if (!isNewer(info, deps.current.build)) return nothing;
    if (!(await admitted(origin, info, rollout, stateInfo(prior)))) return { ...nothing, heldBack: true };
    // The downloaded version is this one, so the result can only be to stay downloaded. There is no need to recompute the digest of a file of hundreds of MB every 6 hours.
    const kept = prior.k === 'ready' && prior.info.build === info.build;
    return {
      info,
      heldBack: false,
      systemUnmet: systemRequirementUnmet(info, deps.systemVersion, deps.macos),
      cached: deps.cacheDir && !kept ? await cachedDownload(info, deps.cacheDir) : null,
      canAutoInstall: await deps.canAutoInstall(),
    };
  }

  async function check(origin: Origin): Promise<void> {
    if (disposed || state.k === 'unsupported' || checkInFlight) return;
    if (origin === 'auto' && !mayAutoCheck(state)) return;
    // When an automatic check moves from “出错（带着版本）” (error, with version) to “正在检查” (checking), the version is lost, so record it first for the staged-rollout comparison.
    const prior = state;
    dispatch({ type: 'check', auto: origin === 'auto' });
    if (!checkPending(state)) return;
    checkInFlight = true;
    let report: CheckReport | null = null;
    try {
      report = await runCheck(origin, prior);
    } catch (error) {
      // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
      deps.log(`检查更新失败（${origin}）：${errorText(error)}`);
    }
    checkInFlight = false;
    lastCheckAt = nowS();
    if (disposed) return;
    if (!checkPending(state)) {
      // During the silent check the user has already started a download or clicked restart, etc. The result is discarded, and only the check time is recorded.
      emit();
      return;
    }
    const before = state;
    const info = report?.info ?? null;
    const changed = !report
      ? dispatch({ type: 'fail', failure: 'check' })
      : !info
        ? dispatch({ type: 'none', heldBack: report.heldBack })
        : dispatch({ type: 'found', info, systemUnmet: report.systemUnmet, cached: report.cached });
    if (!changed) emit();
    if (report && info) {
      const next = followup(origin, prefs?.autoDownload ?? false, report, state);
      if (next === 'verify' && report.cached) startDownload(origin, report.cached);
      else if (next === 'download') startDownload('auto');
      else if (next === 'toastAvailable') notify({ kind: 'available', info });
    }
    // The downloaded version has been superseded by a new build or withdrawn: delete it. Its file and extracted directory have different names from the new version's, so the download or verification just started is not touched.
    const now = current();
    if (before.k === 'ready' && (now.k !== 'ready' || now.path !== before.path)) await discardDownload(before.path, before.info.build);
    // Already up to date: the packages in the cache are no longer needed (for example, the installer left behind after an install-on-quit on Windows: it is reopened without `--updated` and is not cleared at startup).
    else if (report && !info && !report.heldBack && now.k === 'upToDate' && deps.cacheDir) await prune(deps.cacheDir, '');
  }

  /**
   * Download and verify: download (skipped if `cached` is given; the state is already in the verification stage) → verification stage (pct 100, platform verification and staging) → downloaded.
   * Cancelling during the verification stage ends the running command and discards the downloaded package and the extracted directory.
   */
  function startDownload(origin: Origin, cached: string | null = null): void {
    if (cached === null) dispatch({ type: 'download' });
    if (state.k !== 'downloading') return;
    const info = state.info;
    const mine = ++generation;
    const controller = new AbortController();
    active = { generation: mine, controller, origin };
    void (async () => {
      let last: { pct: number; at: number } | null = null;
      const result: DownloadResult =
        cached !== null
          ? { ok: true, path: cached }
          : deps.cacheDir
            ? await downloadTo(info, deps.cacheDir, {
                signal: controller.signal,
                openRemote: deps.openRemote,
                onProgress: (pct) => {
                  if (mine !== generation) return;
                  const at = deps.now();
                  if (!progressDue(last?.pct ?? null, pct, last ? at - last.at : Number.POSITIVE_INFINITY)) return;
                  last = { pct, at };
                  dispatch({ type: 'progress', pct });
                },
              })
            : { ok: false, cancelled: false, failure: 'download', detail: 'no cache directory' };
      // Cancelled, or a new round has already started: a late result no longer touches the state.
      if (disposed || mine !== generation) return;
      if (!result.ok) {
        active = null;
        if (!result.cancelled) {
          // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
          deps.log(`下载更新失败（${result.failure}）：${result.detail}`);
          dispatch({ type: 'fail', failure: result.failure });
        }
        return;
      }
      dispatch({ type: 'progress', pct: 100 });
      const run = stagingLock.then(() => verifyAndStage(origin, info, result.path, mine, controller.signal));
      stagingLock = run.catch(() => undefined);
      await run;
    })();
  }

  /** Verification stage (runs under `stagingLock`): on staging, enters “已下载” (downloaded); on failure, discards the installer and reports it; on cancel, wraps up. */
  async function verifyAndStage(origin: Origin, info: AppUpdateInfo, archive: string, mine: number, signal: AbortSignal): Promise<void> {
    let outcome: Prepared;
    try {
      outcome = signal.aborted ? { type: 'none' } : await deps.prepare(info, archive, signal);
    } catch (error) {
      outcome = { type: 'failed', failure: 'verify', detail: errorText(error) };
    }
    // Quitting in progress: do not delete. The next launch finds it in the cache and verifies it again.
    if (disposed) return;
    if (mine !== generation) {
      // Cancelled during the verification stage: discard the extracted directory. If a new download round has started, the installer is overwritten by it, so it is not deleted.
      if (outcome.type === 'staged') await fs.rm(outcome.staged.dir, { recursive: true, force: true }).catch(() => undefined);
      if (!active) await fs.rm(archive, { force: true }).catch(() => undefined);
      return;
    }
    active = null;
    if (outcome.type === 'failed') {
      // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
      deps.log(`校验更新失败（${outcome.failure}）：${outcome.detail}`);
      await fs.rm(archive, { force: true }).catch(() => undefined);
      dispatch({ type: 'fail', failure: outcome.failure });
      return;
    }
    prepared = { build: info.build, path: archive, staged: outcome.type === 'staged' ? outcome.staged : null };
    dispatch({ type: 'downloaded', path: archive });
    if (origin === 'auto') notifyReady(info);
  }

  function cancel(): void {
    if (state.k !== 'downloading') return;
    generation++;
    active?.controller.abort();
    active = null;
    dispatch({ type: 'cancel' });
  }

  async function install(): Promise<void> {
    if (disposed || state.k !== 'ready') return;
    const { info, path: archive } = state;
    const staged = preparedFor(info, archive)?.staged ?? null;
    dispatch({ type: 'install' });
    let outcome: InstallOutcome;
    try {
      // A staged new package has already been verified, so only a cheap check is made. One that is not staged (Windows, or a machine that cannot swap by itself) has its installer digest re-verified.
      if (staged || (await verifyFile(archive, info))) {
        outcome = await deps.installPackage(info, archive, { staged, relaunch: true });
      } else {
        outcome = { type: 'failed', failure: 'verify', detail: `${archive} no longer matches the manifest` };
      }
    } catch (error) {
      outcome = { type: 'failed', failure: 'install', detail: errorText(error) };
    }
    // Same rule as at download time: a package that fails verification is deleted (the error text says “已经删掉” (already deleted)).
    if (outcome.type === 'failed' && outcome.failure === 'verify') await discardDownload(archive, info.build);
    // The state may have been changed elsewhere during installation (TS cannot see that dispatch changed it, so it is read through `current()`).
    if (disposed || current().k !== 'installing') return;
    if (outcome.type === 'launched') {
      // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
      deps.log('换包程序已起，应用退出');
      deps.quit();
    } else if (outcome.type === 'fallback') {
      deps.reveal(archive);
      deps.openDownloadPage();
      dispatch({ type: 'fail', failure: 'manual' });
    } else {
      // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
      deps.log(`安装更新失败（${outcome.failure}）：${outcome.detail}`);
      dispatch({ type: 'fail', failure: outcome.failure });
    }
  }

  async function installOnQuit(): Promise<void> {
    // “重启并更新” (restart and update) is already installing when quitting, so it is not installed again here.
    if (disposed || quitInstallStarted || state.k !== 'ready') return;
    quitInstallStarted = true;
    const { info, path: archive } = state;
    const ready = preparedFor(info, archive);
    if (!ready) return;
    const attempt = (async () => {
      if (!(await deps.canAutoInstall())) return;
      // For one that is not staged (the Windows installer), only check that the file still exists and its size matches. The digest is not recomputed during quit.
      if (!ready.staged && !(await sizeMatches(archive, info.size))) {
        // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
        deps.log(`退出时没有安装更新：${archive} 不在了或大小不对`);
        return;
      }
      const outcome = await deps.installPackage(info, archive, { staged: ready.staged, relaunch: false });
      if (outcome.type === 'launched') {
        dispatch({ type: 'install' });
        // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
        deps.log(`退出时安装 ${info.version}（build ${info.build}），装完不重新打开`);
      } else {
        // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
        deps.log(`退出时没有安装更新：${outcome.type === 'failed' ? `${outcome.failure} ${outcome.detail}` : '这台机器不能自己换包'}`);
      }
    // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
    })().catch((error: unknown) => deps.log(`退出时安装更新出错：${errorText(error)}`));
    await new Promise<void>((resolve) => {
      const stop = deps.schedule(() => {
        // i18n-ignore: diagnostic log, printed only to the main process's terminal, not shown in the UI
        deps.log(`退出时安装更新超过 ${QUIT_INSTALL_DEADLINE_MS} ms，照常退出`);
        resolve();
      }, QUIT_INSTALL_DEADLINE_MS);
      void attempt.then(() => {
        stop();
        resolve();
      });
    });
  }

  /** A tick. If preferences have not arrived or automatic checks are off, the first tick is not used up; it is made up when they are turned on. */
  function autoTick(): void {
    if (disposed || !prefs?.autoCheck) return;
    const first = !firstTickUsed;
    firstTickUsed = true;
    if (shouldAutoCheck(first, lastCheckAt, nowS())) void check('auto');
  }

  function tick(): void {
    stopTimer = deps.schedule(tick, TICK_S * 1000);
    autoTick();
  }

  return {
    snapshot,
    start() {
      if (state.k === 'unsupported' || stopTimer || disposed) return;
      stopTimer = deps.schedule(() => {
        firstTickDue = true;
        tick();
      }, FIRST_CHECK_DELAY_S * 1000);
    },
    dispose() {
      disposed = true;
      stopTimer?.();
      stopTimer = null;
      active?.controller.abort();
      active = null;
      stateListeners.clear();
      noticeListeners.clear();
    },
    configure(next) {
      const wasOn = prefs?.autoCheck === true;
      prefs = { autoCheck: next.autoCheck, autoDownload: next.autoDownload };
      if (firstTickDue && next.autoCheck && !wasOn) autoTick();
    },
    check,
    download() {
      if (disposed) return;
      if ((state.k === 'available' && !state.systemUnmet) || (state.k === 'error' && state.info)) startDownload('manual');
    },
    cancel,
    install,
    installOnQuit,
    openDownloadPage: () => deps.openDownloadPage(),
    onState(listener) {
      stateListeners.add(listener);
      return () => void stateListeners.delete(listener);
    },
    onNotice(listener) {
      noticeListeners.add(listener);
      return () => void noticeListeners.delete(listener);
    },
  };
}

/** The file still exists and its size matches the manifest (the cheap check for install-on-quit). */
async function sizeMatches(file: string, size: number): Promise<boolean> {
  const stat = await fs.stat(file).catch(() => null);
  return !!stat?.isFile() && stat.size === size;
}

import { execFile, execFileSync, spawn } from 'node:child_process';
import { constants as fsConstants, closeSync, openSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserWindow, app, ipcMain, shell } from 'electron';
import {
  createPendingLaunch,
  installMac,
  installWindows,
  macCanAutoInstall,
  nsisInstalledCopy,
  prepareMac,
  type Exec,
} from './app-update-install.ts';
import {
  APPCAST_ENV,
  DOWNLOAD_PAGE,
  appBundleFromExecutable,
  availability,
  cacheDirectory,
  exeInAppBundle,
  feedTarget,
  feedUrl,
  isFileUrl,
} from './app-update-rules.ts';
import {
  createAppUpdateService,
  discardStaleDownloads,
  installationBucket,
  type AppUpdateService,
  type ByteSource,
} from './app-update-service.ts';

/*
 * Electron wiring for app auto-update (architecture design §2.6): detects the environment this run is in, hands the real network / command / Finder / quit to the service,
 * and exposes it to the preload script over IPC (`window.cuccut.updates`). Status and reminders are pushed to all windows.
 *
 * Development builds (not packaged) always get “development builds do not check for updates”, unless `CUCCUT_UPDATE_APPCAST` is set; even when it is set, a development build never swaps the bundle automatically
 * (the one running is Electron.app in node_modules), and at install time it only shows the installer in Finder and opens the download page.
 */

/** Timeout for the check (fetching the manifest). */
const CHECK_TIMEOUT_MS = 20_000;
/** How long without receiving bytes during download counts as a dropped connection. No total time limit is set: the installer is hundreds of MB, and even a slow network should be allowed to finish. */
const STALL_TIMEOUT_MS = 60_000;
/** Maximum size of the manifest, in bytes. */
const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;
/** The install identifier in the user data directory, which determines this machine's position in staged rollouts. */
const INSTALLATION_ID_FILE = 'update-installation-id';
/** How long after the Windows installer reopens the app with `--updated` to wait before clearing the installer from the cache directory (by then the installer has long since exited). */
const INSTALLER_CLEANUP_DELAY_MS = 60_000;

const exec: Exec = (file, args, signal) =>
  new Promise((resolve) => {
    execFile(file, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...(signal ? { signal } : {}) }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });

/**
 * The build number and variant written into the app's package.json at packaging time (`tools/package-desktop.mjs`): `cuccutBuild` is 0 when absent (not a release build, so updates are not checked; see `availability`); `cuccutVariant` is null when absent (standard edition).
 */
function readPackagedInfo(): { build: number; variant: string | null } {
  try {
    const pkg = JSON.parse(readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')) as {
      cuccutBuild?: unknown;
      cuccutVariant?: unknown;
    };
    const build = typeof pkg.cuccutBuild === 'number' && Number.isInteger(pkg.cuccutBuild) && pkg.cuccutBuild > 0 ? pkg.cuccutBuild : 0;
    const variant = typeof pkg.cuccutVariant === 'string' && /^[a-z0-9]+$/.test(pkg.cuccutVariant) ? pkg.cuccutVariant : null;
    return { build, variant };
  } catch {
    return { build: 0, variant: null };
  }
}

let packagedInfoCache: { build: number; variant: string | null } | null = null;

function packagedInfo(): { build: number; variant: string | null } {
  packagedInfoCache ??= readPackagedInfo();
  return packagedInfoCache;
}

function currentBuild(): number {
  return packagedInfo().build;
}

/** The running bundle's `CFBundleIdentifier` (read only on packaged macOS apps, once at startup). */
function bundleIdentifier(bundle: string | null): string | null {
  if (!bundle) return null;
  try {
    const plist = path.join(bundle, 'Contents', 'Info.plist');
    return execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], { encoding: 'utf8', timeout: 5000 }).trim() || null;
  } catch {
    return null;
  }
}

function userAgent(): string {
  return `CucCut/${app.getVersion()} (build ${currentBuild()})`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': userAgent() },
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MANIFEST_MAX_BYTES) throw new Error('manifest is too large');
  return text;
}

/** Network response body → byte stream; the stall timer is reset each time a chunk arrives. */
async function* readBody(body: ReadableStream<Uint8Array>, onChunk: () => void): ByteSource {
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      onChunk();
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function openRemote(url: string, signal: AbortSignal): Promise<ByteSource> {
  const stall = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => stall.abort(new Error('download stalled')), STALL_TIMEOUT_MS);
  };
  arm();
  const response = await fetch(url, { headers: { 'User-Agent': userAgent() }, signal: AbortSignal.any([signal, stall.signal]) });
  if (!response.ok || !response.body) {
    clearTimeout(timer);
    throw new Error(`HTTP ${response.status}`);
  }
  const body = response.body;
  return (async function* () {
    try {
      yield* readBody(body, arm);
    } finally {
      clearTimeout(timer);
    }
  })();
}

async function writable(dir: string): Promise<boolean> {
  try {
    await fs.access(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Launches the swap script detached from the app process (it keeps running after the app quits); output is written to the log. */
function launchScript(script: string, log: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fd = openSync(log, 'w');
    const child = spawn('/usr/bin/nohup', ['/bin/bash', script], { detached: true, stdio: ['ignore', fd, fd] });
    child.once('error', (error) => {
      closeSync(fd);
      reject(error);
    });
    child.once('spawn', () => {
      closeSync(fd);
      child.unref();
      resolve();
    });
  });
}

/** Launches the installer detached from the app process (it keeps running after the app quits). The process is created synchronously in `spawn`; an error that prevents it from starting can only be logged, since the app is already quitting. */
function spawnDetached(file: string, args: readonly string[]): void {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true });
  // i18n-ignore: diagnostic log, printed only to the main process's terminal, not to the UI
  child.once('error', (error) => console.error(`[cuccut] 应用更新：起安装器失败：${error.message}`));
  child.unref();
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

/** Windows installed edition: installed by NSIS (its uninstaller is next to the exe). The zip edition does not have one. */
function windowsInstalledCopy(): Promise<boolean> {
  return nsisInstalledCopy(process.execPath, isFile);
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function installAppUpdates(): AppUpdateService {
  const override = process.env[APPCAST_ENV]?.trim() || null;
  const platform = process.platform;
  const macos = platform === 'darwin';
  const target = feedTarget(platform, process.arch);
  const packaged = app.isPackaged;
  // A development build runs the Electron.app from node_modules, so it is not treated as a bundle to be swapped.
  const runningBundle = macos && packaged ? appBundleFromExecutable(process.execPath) : null;
  const unsupported = availability({
    appStore: Boolean((process as { mas?: boolean }).mas),
    build: currentBuild(),
    feedOverride: override !== null,
    hasFeedTarget: target !== null,
    packaged,
    windows: platform === 'win32',
    bundleId: macos && packaged && !override && target ? bundleIdentifier(runningBundle) : null,
    exeInAppBundle: exeInAppBundle(process.execPath),
  });
  const cacheDir = cacheDirectory(platform, os.homedir(), process.env);
  const { variant } = packagedInfo();
  const mac = { exec, runningBundle, writable, cacheDir, pid: process.pid, launchScript };
  // i18n-ignore: diagnostic log, printed only to the main process's terminal, not to the UI
  const log = (message: string) => console.log(`[cuccut] 应用更新：${message}`);
  // The Windows installer is launched only after the app finishes its normal quit (`before-quit` stops the Runtime, and “restart and update” or install on quit records it): `will-quit` comes after that.
  const installerOnQuit = createPendingLaunch(spawnDetached, log);
  app.on('will-quit', () => {
    // i18n-ignore: diagnostic log, printed only to the main process's terminal, not to the UI
    if (installerOnQuit.fire()) log('安装器已起');
  });
  // After the installer finishes and reopens the app with `--updated`, the installer left in the cache directory is cleared after a while (only files from before this launch are cleared).
  if (platform === 'win32' && packaged && cacheDir && process.argv.includes('--updated')) {
    const started = Date.now();
    setTimeout(() => void discardStaleDownloads(cacheDir, started), INSTALLER_CLEANUP_DELAY_MS).unref();
  }

  const service = createAppUpdateService({
    unsupported,
    target,
    variant,
    feed: override
      ? { url: override, allowFileUrl: isFileUrl(override) }
      : target
        ? { url: feedUrl(target, variant), allowFileUrl: false }
        : null,
    current: { version: app.getVersion(), build: currentBuild() },
    systemVersion: macos ? process.getSystemVersion() : null,
    macos,
    cacheDir,
    fetchText,
    openRemote,
    canAutoInstall: async () => {
      if (!packaged) return false;
      if (macos) return macCanAutoInstall(mac);
      return platform === 'win32' && (await windowsInstalledCopy());
    },
    // On macOS the download is extracted and its signature verified as soon as it finishes (the Windows installer only checks the digest, which is already done during download); development builds never swap the bundle automatically, and never stage it either.
    prepare: async (info, archive, signal) => (packaged && macos ? prepareMac(info, archive, mac, signal) : { type: 'none' }),
    installPackage: async (info, archive, { staged, relaunch }) => {
      if (!packaged) return { type: 'fallback' };
      if (macos) return installMac(info, archive, mac, { staged, relaunch });
      if (platform === 'win32') {
        return installWindows(archive, { installedCopy: await windowsInstalledCopy(), launchOnQuit: installerOnQuit.arm }, relaunch);
      }
      return { type: 'fallback' };
    },
    reveal: (file) => shell.showItemInFolder(file),
    openDownloadPage: () => void shell.openExternal(DOWNLOAD_PAGE),
    quit: () => app.quit(),
    rolloutBucket: () => installationBucket(path.join(app.getPath('userData'), INSTALLATION_ID_FILE)),
    now: () => Date.now(),
    schedule: (run, ms) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
    log,
  });

  service.onState((snapshot) => broadcast('cuccut:updates-state', snapshot));
  service.onNotice((notice) => broadcast('cuccut:updates-notice', notice));
  ipcMain.handle('cuccut:updates-get', () => service.snapshot());
  ipcMain.handle('cuccut:updates-check', () => service.check('manual'));
  ipcMain.handle('cuccut:updates-download', () => service.download());
  ipcMain.handle('cuccut:updates-cancel', () => service.cancel());
  ipcMain.handle('cuccut:updates-install', () => service.install());
  ipcMain.handle('cuccut:updates-open-download-page', () => service.openDownloadPage());
  ipcMain.on('cuccut:updates-configure', (_event, raw: unknown) => {
    const prefs = (raw ?? {}) as { autoCheck?: unknown; autoDownload?: unknown };
    if (typeof prefs.autoCheck !== 'boolean' || typeof prefs.autoDownload !== 'boolean') return;
    service.configure({ autoCheck: prefs.autoCheck, autoDownload: prefs.autoDownload });
  });
  service.start();
  return service;
}

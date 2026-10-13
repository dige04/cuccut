import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppUpdateFailure, AppUpdateInfo } from '@cuccut/ui';
import { BUNDLE_ID, NSIS_UNINSTALLER, installerScript, mountPath, teamIdentifier } from './app-update-rules.ts';
import type { InstallOutcome, Prepared, StagedApp } from './app-update-service.ts';

/*
 * Platform swap (architecture design §2.6). On macOS it has two steps. After downloading (or finding the download in the cache), first `prepareMac`: it extracts the ZIP (or copies it out of the DMG) into `unpack-<build>` in the cache directory, and checks the new bundle's identifier, version, signature, Team ID and notarization. Only if these pass is it counted as “downloaded”. At install time
 * (“restart and update”, or install on quit), `installMac` only checks that the staged new bundle is still there and that its identity and version have not changed, then writes the swap script and launches it detached from the app.
 * On Windows, the NSIS installer is started silently when the app exits. On this machine the swap cannot be done automatically (the build is not an official package, the directory containing `.app` is not writable, the running app has no Team ID, or it is the Windows zip version). In those cases nothing is staged, and at install time `fallback` is returned: the service shows the installer in Finder and opens the download page.
 * External commands run through the injected `exec`; unit tests supply fake output; the generated script is never run here.
 */

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs an external command; ends it if `signal` stops (when verification is cancelled). */
export type Exec = (file: string, args: string[], signal?: AbortSignal) => Promise<ExecResult>;

const FALLBACK: InstallOutcome = { type: 'fallback' };
const failed = (failure: AppUpdateFailure, detail: string): InstallOutcome => ({ type: 'failed', failure, detail });
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Runs a command; throws (including stderr) if the exit code is not 0; also throws if `signal` stops. */
async function run(exec: Exec, file: string, args: string[], signal?: AbortSignal): Promise<string> {
  const result = await exec(file, args, signal);
  if (signal?.aborted) throw new Error('cancelled');
  if (result.code !== 0) throw new Error(`${file} exited ${result.code}: ${result.stderr.trim()}`);
  return result.stdout;
}

/** Reads the Team ID from `codesign -dv --verbose=2` (on stderr; this command also returns non-zero for unsigned bundles, so the exit code is not checked). */
export async function macTeamId(exec: Exec, bundle: string, signal?: AbortSignal): Promise<string | null> {
  const result = await exec('/usr/bin/codesign', ['-dv', '--verbose=2', bundle], signal);
  return teamIdentifier(result.stderr);
}

export interface MacInstallDeps {
  exec: Exec;
  /** The running `.app`; null if it is not an official package or is not inside a bundle. */
  runningBundle: string | null;
  writable(dir: string): Promise<boolean>;
  cacheDir: string | null;
  pid: number;
  /** Launches the swap script detached from the app process; output is written to the log. */
  launchScript(script: string, log: string): Promise<void>;
}

/** Whether macOS can swap the bundle without the user doing it manually: it runs from an official `.app`, the `.app`'s parent directory is writable, and the running app has a Team ID. */
export async function macCanAutoInstall(deps: Pick<MacInstallDeps, 'exec' | 'runningBundle' | 'writable'>): Promise<boolean> {
  if (!deps.runningBundle) return false;
  if (!(await deps.writable(path.dirname(deps.runningBundle)))) return false;
  return (await macTeamId(deps.exec, deps.runningBundle)) !== null;
}

async function firstApp(dir: string): Promise<string | null> {
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((name) => name.toLowerCase().endsWith('.app')).sort();
  return names[0] ? path.join(dir, names[0]) : null;
}

type StageResult = { ok: true; staged: StagedApp } | { ok: false; detail: string };

/**
 * Extracts into `unpack-<build>` in the cache directory: a ZIP is extracted with ditto; a DMG is mounted read-only, the `.app` inside is copied out with ditto, and then it is unmounted (so a volume is not left mounted while the user is working). Returns the first `.app` extracted. On failure, this directory is deleted.
 */
async function stage(exec: Exec, info: AppUpdateInfo, archive: string, cacheDir: string, signal?: AbortSignal): Promise<StageResult> {
  if (info.format !== 'zip' && info.format !== 'dmg') return { ok: false, detail: `${info.format} is not a macOS artifact` };
  const dir = path.join(cacheDir, `unpack-${info.build}`);
  const fail = async (detail: string): Promise<StageResult> => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    return { ok: false, detail };
  };
  try {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    return fail(errorText(error));
  }
  if (info.format === 'zip') {
    try {
      await run(exec, '/usr/bin/ditto', ['-x', '-k', archive, dir], signal);
    } catch (error) {
      return fail(errorText(error));
    }
  } else {
    let output: string;
    try {
      output = await run(exec, '/usr/bin/hdiutil', ['attach', '-nobrowse', '-noverify', '-readonly', archive], signal);
    } catch (error) {
      return fail(errorText(error));
    }
    const mount = mountPath(output);
    if (!mount) return fail('no mount point in hdiutil output');
    const inside = await firstApp(mount);
    let problem = inside ? null : 'no .app in the dmg';
    if (inside) {
      try {
        await run(exec, '/usr/bin/ditto', [inside, path.join(dir, path.basename(inside))], signal);
      } catch (error) {
        problem = errorText(error);
      }
    }
    await exec('/usr/bin/hdiutil', ['detach', mount, '-quiet']).catch(() => undefined);
    if (problem) return fail(problem);
  }
  const app = await firstApp(dir);
  if (!app) return fail(`no .app in the ${info.format}`);
  return { ok: true, staged: { app, dir } };
}

async function plistValue(exec: Exec, app: string, key: string, signal?: AbortSignal): Promise<string> {
  const plist = path.join(app, 'Contents', 'Info.plist');
  return (await run(exec, '/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], signal)).trim();
}

/** Checks that the new bundle's identifier, version and build match the manifest; returns the reason when they do not. */
async function identityProblem(exec: Exec, app: string, info: AppUpdateInfo, signal?: AbortSignal): Promise<string | null> {
  let identifier: string;
  let version: string;
  let build: string;
  try {
    identifier = await plistValue(exec, app, 'CFBundleIdentifier', signal);
    version = await plistValue(exec, app, 'CFBundleShortVersionString', signal);
    build = await plistValue(exec, app, 'CFBundleVersion', signal);
  } catch (error) {
    return errorText(error);
  }
  if (identifier !== BUNDLE_ID || version !== info.version || Number(build) !== info.build) {
    return `bundle ${identifier} ${version} (${build}) does not match the manifest`;
  }
  return null;
}

/** The new bundle's identity, version, build, signature, Team ID and notarization. Returns null when it passes. */
async function validate(exec: Exec, app: string, info: AppUpdateInfo, team: string, signal?: AbortSignal): Promise<Prepared | null> {
  const identity = await identityProblem(exec, app, info, signal);
  if (identity) return { type: 'failed', failure: 'verify', detail: identity };
  try {
    await run(exec, '/usr/bin/codesign', ['--verify', '--deep', '--strict', app], signal);
  } catch (error) {
    return { type: 'failed', failure: 'signature', detail: errorText(error) };
  }
  const newTeam = await macTeamId(exec, app, signal);
  if (newTeam !== team) return { type: 'failed', failure: 'signature', detail: `team ${newTeam ?? 'none'} != running team ${team}` };
  try {
    await run(exec, '/usr/sbin/spctl', ['--assess', '--type', 'execute', app], signal);
  } catch (error) {
    return { type: 'failed', failure: 'signature', detail: errorText(error) };
  }
  return null;
}

/**
 * macOS verification and staging (after download, before entering “downloaded”): when this machine can swap the bundle itself, it extracts the installer and verifies the new bundle; if it passes, it returns the staged `.app` and the directory it is in. When the machine cannot swap by itself, it returns `none` (install is then manual). On failure, the extracted directory is deleted. If `signal` stops, running commands are ended.
 */
export async function prepareMac(info: AppUpdateInfo, archive: string, deps: MacInstallDeps, signal?: AbortSignal): Promise<Prepared> {
  const target = deps.runningBundle;
  if (!target || !(await deps.writable(path.dirname(target)))) return { type: 'none' };
  // A running app without a Team ID (ad-hoc or unsigned) has no signer to pin to, so it is not installed automatically.
  const team = await macTeamId(deps.exec, target, signal);
  if (!team) return { type: 'none' };
  if (!deps.cacheDir) return { type: 'failed', failure: 'install', detail: 'no cache directory' };
  const staging = await stage(deps.exec, info, archive, deps.cacheDir, signal);
  if (!staging.ok) return { type: 'failed', failure: 'verify', detail: staging.detail };
  const { staged } = staging;
  const problem = await validate(deps.exec, staged.app, info, team, signal);
  if (problem) {
    await fs.rm(staged.dir, { recursive: true, force: true }).catch(() => undefined);
    return problem;
  }
  return { type: 'staged', staged };
}

/** The staged new bundle is still there and its identity and version have not changed (a cheap check at install time; the signature is not verified again). */
async function stagedIntact(exec: Exec, staged: StagedApp, info: AppUpdateInfo): Promise<boolean> {
  const stat = await fs.stat(path.join(staged.app, 'Contents', 'Info.plist')).catch(() => null);
  if (!stat?.isFile()) return false;
  return (await identityProblem(exec, staged.app, info)) === null;
}

export interface InstallOptions {
  /** The new bundle staged by `prepareMac`. When it is missing (for example, the staged copy was deleted), “restart and update” extracts and verifies it from scratch, and install on quit does not install. */
  staged: StagedApp | null;
  /** Whether to reopen the app after the swap: “restart and update” reopens it; install on quit does not. */
  relaunch: boolean;
}

/**
 * macOS swap: after the staged new bundle has been checked (or extracted and verified from scratch for “restart and update”), the swap script is written and launched; the app then quits normally, and the script waits for the process to exit before swapping. Install on quit uses only the staged new bundle: if it is missing or fails the check, it returns failure and the app quits as usual, without extracting and verifying on the way out.
 */
export async function installMac(
  info: AppUpdateInfo,
  archive: string,
  deps: MacInstallDeps,
  options: InstallOptions,
): Promise<InstallOutcome> {
  const target = deps.runningBundle;
  if (!target) return FALLBACK;
  if (!(await deps.writable(path.dirname(target)))) return FALLBACK;
  if (!deps.cacheDir) return failed('install', 'no cache directory');
  let staged = options.staged && (await stagedIntact(deps.exec, options.staged, info)) ? options.staged : null;
  if (!staged) {
    if (!options.relaunch) return failed('install', 'the update is not staged');
    const prepared = await prepareMac(info, archive, deps);
    if (prepared.type === 'none') return FALLBACK;
    if (prepared.type === 'failed') return prepared;
    staged = prepared.staged;
  }
  const script = path.join(deps.cacheDir, `install-${deps.pid}.sh`);
  const built = installerScript({
    pid: deps.pid,
    newApp: staged.app,
    target,
    mount: null,
    archive,
    unpacked: staged.dir,
    script,
    relaunch: options.relaunch,
  });
  if (!built.ok) return failed('install', built.error);
  try {
    const part = path.join(deps.cacheDir, `.install-${deps.pid}.part`);
    await fs.writeFile(part, built.script, { mode: 0o700 });
    await fs.rename(part, script);
    await deps.launchScript(script, path.join(deps.cacheDir, 'install.log'));
  } catch (error) {
    return failed('install', errorText(error));
  }
  return { type: 'launched' };
}

/**
 * Arguments for electron-builder's NSIS installer: `/S` for silent; `--updated` makes it handle the run as an update (it keeps the shortcuts, and waits a little for the app to quit on its own before
 * ending the processes still running in the install directory); `--force-run` reopens the app with `--updated` after installing (“restart and update”).
 */
export const NSIS_UPDATE_ARGS: readonly string[] = ['/S', '--updated', '--force-run'];

/** Install on quit: same as above, but the app is not reopened after installing (the user is quitting). */
export const NSIS_QUIT_ARGS: readonly string[] = ['/S', '--updated'];

/**
 * The copy installed by NSIS: the installer leaves `Uninstall CucCut.exe` next to the exe. A copy extracted from zip does not have it, so it is not installed automatically.
 * It checks only files, not the registry (`HKCU\Software\<GUID>`'s InstallLocation): reading the registry would mean parsing reg.exe's output, which cannot be tested here.
 */
export async function nsisInstalledCopy(executable: string, isFile: (file: string) => Promise<boolean>): Promise<boolean> {
  return isFile(path.win32.join(path.win32.dirname(executable), NSIS_UNINSTALLER));
}

export interface WindowsInstallDeps {
  /** The copy installed by NSIS (`nsisInstalledCopy`); the zip version is not, so it is not installed automatically. */
  installedCopy: boolean;
  /** Records the installer to launch when the app exits (`createPendingLaunch`). */
  launchOnQuit(file: string, args: readonly string[]): void;
}

/**
 * Windows: the installer is not launched here; instead it is recorded, and launched at `will-quit`, after the app has finished its normal quit (where `before-quit` stops the Runtime over IPC).
 * An installer run with `--updated` waits only about 1.3 seconds for the app before ending all processes still running in the install directory (the Runtime is also `CucCut.exe`, and the Worker is in
 * `resources\bin`). Launching it earlier would cut off the Runtime's shutdown. After “restart and update” returns `launched`, the service makes the app quit, and it reopens after installing;
 * for install on quit (`relaunch` is false), the app is already quitting, so it is not reopened after installing.
 */
export async function installWindows(archive: string, deps: WindowsInstallDeps, relaunch = true): Promise<InstallOutcome> {
  if (!deps.installedCopy) return FALLBACK;
  deps.launchOnQuit(archive, relaunch ? NSIS_UPDATE_ARGS : NSIS_QUIT_ARGS);
  return { type: 'launched' };
}

export interface PendingLaunch {
  /** Records it (replacing any previously recorded one). */
  arm(file: string, args: readonly string[]): void;
  /** Launches the recorded one, only once; does nothing if none was recorded. Returns whether it was launched. */
  fire(): boolean;
}

/** Installer launched only when the app exits: `installWindows` records it, and `fire` runs it in `will-quit`. If `spawn` fails, it is only logged, and the app quits as usual. */
export function createPendingLaunch(spawn: (file: string, args: readonly string[]) => void, log: (message: string) => void): PendingLaunch {
  let pending: { file: string; args: readonly string[] } | null = null;
  return {
    arm(file, args) {
      pending = { file, args: [...args] };
    },
    fire() {
      if (!pending) return false;
      const { file, args } = pending;
      pending = null;
      try {
        spawn(file, args);
        return true;
      } catch (error) {
        // i18n-ignore: diagnostic log, printed only to the main process's terminal, not to the UI
        log(`起安装器失败：${errorText(error)}`);
        return false;
      }
    },
  };
}

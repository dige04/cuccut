import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUpdateInfo } from '@cuccut/ui';
import {
  NSIS_QUIT_ARGS,
  NSIS_UPDATE_ARGS,
  createPendingLaunch,
  installMac,
  installWindows,
  macCanAutoInstall,
  nsisInstalledCopy,
  prepareMac,
  type Exec,
  type ExecResult,
  type MacInstallDeps,
} from './app-update-install.ts';
import type { StagedApp } from './app-update-service.ts';

/*
 * The swap test uses only a fake exec: ditto creates a CucCut.app containing only Info.plist in a temporary directory, and plutil / codesign / spctl / hdiutil return preset output.
 * The generated script is only checked to see whether it was written, and is never run.
 */

const TEAM = 'ABCDE12345';

let root: string;
let cacheDir: string;
const running = '/Applications/CucCut.app';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-install-'));
  cacheDir = path.join(root, 'cache');
  await fs.mkdir(cacheDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const info = (format: AppUpdateInfo['format'] = 'zip'): AppUpdateInfo => ({
  version: '2.3.0',
  build: 57,
  date: '2026-10-01',
  minimumSystemVersion: null,
  notes: '',
  notesLocalized: {},
  format,
  url: 'https://example.invalid/CucCut.zip',
  size: 1,
  sha256: 'a'.repeat(64),
});

interface FakeOptions {
  plist?: Record<string, string>;
  newTeam?: string | null;
  runningTeam?: string | null;
  verifyFails?: boolean;
  spctlFails?: boolean;
  mount?: string;
}

/** Fake external command; records every call. When ditto extracts (`-x`) or copies, it creates a CucCut.app containing only Info.plist at the target. */
function fakeExec(options: FakeOptions = {}): { exec: Exec; calls: string[][] } {
  const plist = { CFBundleIdentifier: 'com.cuccut.app', CFBundleShortVersionString: '2.3.0', CFBundleVersion: '57', ...options.plist };
  const calls: string[][] = [];
  const ok = (stdout = '', stderr = ''): ExecResult => ({ code: 0, stdout, stderr });
  const exec: Exec = async (file, args) => {
    calls.push([file, ...args]);
    const name = path.basename(file);
    if (name === 'ditto') {
      const app = args[0] === '-x' ? path.join(args[3] ?? '', 'CucCut.app') : (args[1] ?? '');
      await fs.mkdir(path.join(app, 'Contents'), { recursive: true });
      await fs.writeFile(path.join(app, 'Contents', 'Info.plist'), '');
      return ok();
    }
    if (name === 'plutil') return ok(`${plist[(args[1] ?? '') as keyof typeof plist] ?? ''}\n`);
    if (name === 'codesign' && args[0] === '-dv') {
      const team =
        args[2] === running ? (options.runningTeam === undefined ? TEAM : options.runningTeam) : options.newTeam === undefined ? TEAM : options.newTeam;
      return { code: 0, stdout: '', stderr: `Executable=${args[2]}\nTeamIdentifier=${team ?? 'not set'}\n` };
    }
    if (name === 'codesign') return options.verifyFails ? { code: 1, stdout: '', stderr: 'invalid signature' } : ok();
    if (name === 'spctl') return options.spctlFails ? { code: 3, stdout: '', stderr: 'rejected' } : ok();
    if (name === 'hdiutil' && args[0] === 'attach') return ok(`/dev/disk4\tGUID_partition_scheme\t\n/dev/disk4s1\tApple_HFS\t${options.mount ?? ''}\n`);
    if (name === 'hdiutil') return ok();
    return { code: 127, stdout: '', stderr: `unexpected ${file}` };
  };
  return { exec, calls };
}

function macDeps(exec: Exec, overrides: Partial<MacInstallDeps> = {}): MacInstallDeps {
  return {
    exec,
    runningBundle: running,
    writable: async () => true,
    cacheDir,
    pid: 4242,
    launchScript: vi.fn(async () => {}),
    ...overrides,
  };
}

const archive = () => path.join(cacheDir, 'CucCut.zip');
const unpacked = () => path.join(cacheDir, 'unpack-57');
const stagedApp = (): StagedApp => ({ app: path.join(unpacked(), 'CucCut.app'), dir: unpacked() });
const commandsOf = (calls: string[][]) => calls.map((c) => [path.basename(c[0] ?? ''), c[1]].join(' '));

describe('macOS verification and placement', () => {
  it('whether the package can be swapped automatically: release build, directory writable, has Team ID', async () => {
    expect(await macCanAutoInstall(macDeps(fakeExec().exec))).toBe(true);
    expect(await macCanAutoInstall(macDeps(fakeExec().exec, { runningBundle: null }))).toBe(false);
    expect(await macCanAutoInstall(macDeps(fakeExec().exec, { writable: async () => false }))).toBe(false);
    expect(await macCanAutoInstall(macDeps(fakeExec({ runningTeam: null }).exec))).toBe(false);
  });

  it('ZIP: extracts to unpack-<build>, places it after verifying identity / signature / Team ID / notarization; this step writes no script', async () => {
    const { exec, calls } = fakeExec();
    const deps = macDeps(exec);
    expect(await prepareMac(info(), archive(), deps)).toEqual({ type: 'staged', staged: stagedApp() });
    expect(commandsOf(calls)).toEqual(expect.arrayContaining(['ditto -x', 'codesign --verify', 'spctl --assess']));
    expect(await fs.readdir(cacheDir)).toEqual(['unpack-57']);
    expect(deps.launchScript).not.toHaveBeenCalled();
  });

  it('identity or version mismatch: reports verification failure, removes the extracted directory', async () => {
    const deps = macDeps(fakeExec({ plist: { CFBundleVersion: '56' } }).exec);
    expect(await prepareMac(info(), archive(), deps)).toMatchObject({ type: 'failed', failure: 'verify' });
    expect(await fs.readdir(cacheDir)).toEqual([]);
  });

  it('an old CucCut Bundle ID cannot replace the new app, even with the same version and signature', async () => {
    const deps = macDeps(fakeExec({ plist: { CFBundleIdentifier: 'com.jimliu.cuccut' } }).exec);
    expect(await prepareMac(info(), archive(), deps)).toMatchObject({ type: 'failed', failure: 'verify' });
    expect(await fs.readdir(cacheDir)).toEqual([]);
  });

  it('signature, Team ID or notarization fails: reports a signing problem, removes the extracted directory', async () => {
    for (const options of [{ verifyFails: true }, { newTeam: 'ZZZZZ99999' }, { newTeam: null }, { spctlFails: true }] satisfies FakeOptions[]) {
      const outcome = await prepareMac(info(), archive(), macDeps(fakeExec(options).exec));
      expect(outcome, JSON.stringify(options)).toMatchObject({ type: 'failed', failure: 'signature' });
      expect(await fs.readdir(cacheDir)).toEqual([]);
    }
  });

  it('DMG: mounted read-only; unmounted when the .app cannot be found after mounting; a mount failure reports verification failure', async () => {
    // The mount point is recognized as `/Volumes/…` from hdiutil's output, which cannot be created in the test, so only the “no .app inside” path is taken.
    const mount = '/Volumes/CucCut update test that does not exist';
    const empty = fakeExec({ mount });
    const dmg = path.join(cacheDir, 'CucCut.dmg');
    expect(await prepareMac(info('dmg'), dmg, macDeps(empty.exec))).toMatchObject({ type: 'failed', failure: 'verify' });
    expect(empty.calls[1]).toEqual(['/usr/bin/hdiutil', 'attach', '-nobrowse', '-noverify', '-readonly', dmg]);
    expect(empty.calls).toContainEqual(['/usr/bin/hdiutil', 'detach', mount, '-quiet']);
    expect(await fs.readdir(cacheDir)).toEqual([]);

    const unmounted = fakeExec({ mount: 'nowhere' });
    expect(await prepareMac(info('dmg'), dmg, macDeps(unmounted.exec))).toMatchObject({ type: 'failed', failure: 'verify' });
  });

  it('a Windows installer is not installed on macOS', async () => {
    const outcome = await prepareMac(info('exe'), path.join(cacheDir, 'CucCut.exe'), macDeps(fakeExec().exec));
    expect(outcome).toMatchObject({ type: 'failed', failure: 'verify' });
  });

  it('not placed when this machine cannot swap the package itself', async () => {
    expect(await prepareMac(info(), archive(), macDeps(fakeExec().exec, { runningBundle: null }))).toEqual({ type: 'none' });
    expect(await prepareMac(info(), archive(), macDeps(fakeExec().exec, { writable: async () => false }))).toEqual({ type: 'none' });
    expect(await prepareMac(info(), archive(), macDeps(fakeExec({ runningTeam: null }).exec))).toEqual({ type: 'none' });
  });

  it('once stopped, does not continue, removes the extracted directory', async () => {
    const controller = new AbortController();
    const { exec, calls } = fakeExec();
    const stopping: Exec = async (file, args, signal) => {
      const result = await exec(file, args, signal);
      if (path.basename(file) === 'ditto') controller.abort();
      return result;
    };
    expect(await prepareMac(info(), archive(), macDeps(stopping), controller.signal)).toMatchObject({ type: 'failed', failure: 'verify' });
    expect(commandsOf(calls)).not.toContain('codesign --verify');
    expect(await fs.readdir(cacheDir)).toEqual([]);
  });
});

describe('macOS package swap', () => {
  async function staged(): Promise<StagedApp> {
    const outcome = await prepareMac(info(), archive(), macDeps(fakeExec().exec));
    if (outcome.type !== 'staged') throw new Error('not staged');
    return outcome.staged;
  }

  it('placed new package: only checks identity and version, writes the script and starts it, does not extract or verify the signature again', async () => {
    const ready = await staged();
    const { exec, calls } = fakeExec();
    const deps = macDeps(exec);
    expect(await installMac(info(), archive(), deps, { staged: ready, relaunch: true })).toEqual({ type: 'launched' });
    const script = path.join(cacheDir, 'install-4242.sh');
    expect(deps.launchScript).toHaveBeenCalledWith(script, path.join(cacheDir, 'install.log'));
    const body = await fs.readFile(script, 'utf8');
    expect(body).toContain(`NEW_APP='${path.join(cacheDir, 'unpack-57', 'CucCut.app')}'`);
    expect(body).toContain(`UNPACKED='${unpacked()}'`);
    expect(body).toContain("TARGET='/Applications/CucCut.app'");
    expect(body).toContain('/usr/bin/open "$TARGET"');
    expect((await fs.stat(script)).mode & 0o777).toBe(0o700);
    expect(commandsOf(calls).every((c) => c.startsWith('plutil'))).toBe(true);
  });

  it('install on quit: uses the placed new package, does not open the app after the swap', async () => {
    const ready = await staged();
    const deps = macDeps(fakeExec().exec);
    expect(await installMac(info(), archive(), deps, { staged: ready, relaunch: false })).toEqual({ type: 'launched' });
    expect(await fs.readFile(path.join(cacheDir, 'install-4242.sh'), 'utf8')).not.toContain('/usr/bin/open');
  });

  it('placed new package is gone: on restart, extracts and verifies from the start; does not install on quit', async () => {
    const ready = await staged();
    await fs.rm(unpacked(), { recursive: true });
    const quit = macDeps(fakeExec().exec);
    expect(await installMac(info(), archive(), quit, { staged: ready, relaunch: false })).toMatchObject({
      type: 'failed',
      failure: 'install',
    });
    expect(await installMac(info(), archive(), quit, { staged: null, relaunch: false })).toMatchObject({
      type: 'failed',
      failure: 'install',
    });
    expect(quit.launchScript).not.toHaveBeenCalled();

    const { exec, calls } = fakeExec();
    const restart = macDeps(exec);
    expect(await installMac(info(), archive(), restart, { staged: ready, relaunch: true })).toEqual({ type: 'launched' });
    expect(commandsOf(calls)).toEqual(expect.arrayContaining(['ditto -x', 'codesign --verify', 'spctl --assess']));
  });

  it('placed new package was replaced (version mismatch): on restart, verifies from the start, reports if it fails', async () => {
    const ready = await staged();
    const deps = macDeps(fakeExec({ plist: { CFBundleVersion: '56' } }).exec);
    expect(await installMac(info(), archive(), deps, { staged: ready, relaunch: true })).toMatchObject({
      type: 'failed',
      failure: 'verify',
    });
    expect(deps.launchScript).not.toHaveBeenCalled();
  });

  it('manual route when this machine cannot swap the package itself', async () => {
    const options = { staged: null, relaunch: true };
    expect(await installMac(info(), archive(), macDeps(fakeExec().exec, { runningBundle: null }), options)).toEqual({ type: 'fallback' });
    expect(await installMac(info(), archive(), macDeps(fakeExec().exec, { writable: async () => false }), options)).toEqual({
      type: 'fallback',
    });
    expect(await installMac(info(), archive(), macDeps(fakeExec({ runningTeam: null }).exec), options)).toEqual({ type: 'fallback' });
  });

  it('failing to start the script counts as an install failure', async () => {
    const deps = macDeps(fakeExec().exec, {
      launchScript: async () => {
        throw new Error('spawn failed');
      },
    });
    expect(await installMac(info(), archive(), deps, { staged: await staged(), relaunch: true })).toMatchObject({
      type: 'failed',
      failure: 'install',
    });
  });
});

describe('Windows package swap', () => {
  const exe = 'C:\\Users\\me\\AppData\\Local\\Programs\\cuccut\\CucCut.exe';

  it('an installed build has an NSIS uninstaller next to the exe', async () => {
    const seen: string[] = [];
    const present = async (file: string) => {
      seen.push(file);
      return true;
    };
    expect(await nsisInstalledCopy(exe, present)).toBe(true);
    expect(seen).toEqual(['C:\\Users\\me\\AppData\\Local\\Programs\\cuccut\\Uninstall CucCut.exe']);
    expect(await nsisInstalledCopy(exe, async () => false)).toBe(false);
    // Inno's uninstaller does not count.
    expect(await nsisInstalledCopy(exe, async (file) => file.endsWith('unins000.exe'))).toBe(false);
  });

  it('installed build records the installer and starts it when the app quits; install on quit does not reopen after installing; zip build takes the manual route', async () => {
    const launchOnQuit = vi.fn();
    expect(await installWindows('C:\\cache\\CucCut-setup.exe', { installedCopy: true, launchOnQuit })).toEqual({ type: 'launched' });
    expect(launchOnQuit).toHaveBeenCalledWith('C:\\cache\\CucCut-setup.exe', ['/S', '--updated', '--force-run']);
    expect(NSIS_UPDATE_ARGS).toEqual(['/S', '--updated', '--force-run']);
    launchOnQuit.mockClear();
    expect(await installWindows('C:\\cache\\CucCut-setup.exe', { installedCopy: true, launchOnQuit }, false)).toEqual({ type: 'launched' });
    expect(launchOnQuit).toHaveBeenCalledWith('C:\\cache\\CucCut-setup.exe', ['/S', '--updated']);
    expect(NSIS_QUIT_ARGS).toEqual(['/S', '--updated']);
    launchOnQuit.mockClear();
    expect(await installWindows('C:\\cache\\CucCut-setup.exe', { installedCopy: false, launchOnQuit })).toEqual({ type: 'fallback' });
    expect(launchOnQuit).not.toHaveBeenCalled();
  });

  it('on quit, starts only the last recorded one, and only once', () => {
    const spawned: [string, readonly string[]][] = [];
    const pending = createPendingLaunch(
      (file, args) => void spawned.push([file, args]),
      () => {},
    );
    expect(pending.fire()).toBe(false);
    pending.arm('C:\\cache\\old-setup.exe', NSIS_UPDATE_ARGS);
    pending.arm('C:\\cache\\new-setup.exe', NSIS_UPDATE_ARGS);
    expect(spawned).toEqual([]);
    expect(pending.fire()).toBe(true);
    expect(pending.fire()).toBe(false);
    expect(spawned).toEqual([['C:\\cache\\new-setup.exe', ['/S', '--updated', '--force-run']]]);
  });

  it('if it fails to start, only logs it, does not throw', () => {
    const logs: string[] = [];
    const pending = createPendingLaunch(
      () => {
        throw new Error('ENOENT');
      },
      (message) => logs.push(message),
    );
    pending.arm('C:\\cache\\setup.exe', NSIS_UPDATE_ARGS);
    expect(pending.fire()).toBe(false);
    expect(logs).toEqual(['Failed to start installer: ENOENT']);
  });
});

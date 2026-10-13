import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExternalToolUpdateMethod, ExternalToolUpdatePlan } from '@cuccut/protocol';
import { envValue, findOnPath, isExecutableFile } from './tool-probe.ts';
import { refOf, type Localized } from '@cuccut/protocol';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';

/**
 * Updates an external tool installed on the system by its original install method (architecture design §12.9). During probing, it works out how the tool was installed from the executable's real location (following symbolic links), and produces the command to run.
 * It looks only at local files. It makes no network calls and runs no program.
 *
 * - Homebrew: the real location is under `<prefix>/Cellar/<formula>/<version>/`. It runs `brew upgrade` with the `bin/brew` of the same prefix.
 *   A development version built from source (its version directory starts with `HEAD`) adds `--fetch-HEAD`; otherwise Homebrew does not fetch new commits.
 * - pipx: the real location is under `pipx/venvs/<package>/`. It runs `pipx upgrade`.
 * - pip: the entry script (the interpreter in its shebang, and the module it imports). It runs `-m pip install -U` with the same interpreter. When the script is in the user directory (`~/Library/Python/<version>/bin`, `~/.local/bin`), it adds `--user`.
 *   On Windows the entry is the `.exe` launcher in the Scripts directory (distlib): a launcher program, then a `#!<interpreter>` line, then a zip containing `__main__.py`.
 *   The interpreter is read from that line. If the interpreter is in pipx's venv, it is handled as pipx. When the script is not beside the interpreter (`%APPDATA%\Python\…\Scripts`, the Microsoft Store Python), it adds `--user`.
 * - Windows package managers (their entries are copied `.exe` shims or symbolic links pointing elsewhere, so they must be recognized before standalone programs are):
 *   - winget: the real location is under `WinGet\Packages\<package ID>_<source>\` (the symbolic links in `WinGet\Links` point there). It uses the winget on PATH (or in WindowsApps) to upgrade just this package non-interactively, and queries only the winget source (the msstore source's agreement prompt would make the command fail).
 *   - Scoop: `<Scoop directory>\shims\<app>.exe` (with a same-named `.shim` beside it), or under `<Scoop directory>\apps\<app>\<version>\`. Scoop itself is a PowerShell script. As its own `scoop.cmd` does, it runs `scoop.ps1 update <app>` with System32's powershell.exe.
 *     A global install (under ProgramData, or in the directory `SCOOP_GLOBAL` points to) needs admin rights, so it gives only `scoop update <app> --global`.
 *   - Chocolatey: `<Chocolatey directory>\bin\<package>.exe` or under `lib\<package>\`. It is installed in ProgramData and always needs admin rights, so it gives only `choco upgrade <package>`.
 * - Official standalone programs: an executable binary (Mach-O, ELF, PE) or a Python zipapp. It runs the update argument the program has built in (`yt-dlp -U`).
 * - Anything else (a self-written wrapper script, an unrecognized file, a tool installed by uv, whose environment has no pip) cannot be judged. It returns null, and the UI lists common approaches.
 *
 * When the current user cannot write to the location being rewritten, it does not run anything on the user's behalf and does not escalate privileges. A standalone program gets a command with `sudo` (on Windows, a note to use an administrator identity). Anything else gets only the original command, with an explanation of why.
 * On Windows, `fs.access` does not look at access control lists, so the check goes by location: anything under Program Files, ProgramData, or the Windows directory counts as needing admin rights.
 *
 * The command shown to people (`command`) follows the Runtime host's platform: on Windows it is quoted by PowerShell rules; on other systems, by POSIX shell rules.
 */

/** How the update works in the manifest: a Homebrew formula, a pipx or pip package, the module imported by an entry script, the update argument a standalone program has built in, and the name in a Windows package manager. */
export interface ToolUpdateRecipe {
  formula: string;
  pipxPackage: string;
  /** The requirement for `pip install -U` (with extras). */
  pipRequirement: string;
  /** The module name in `from <module> import …` in an entry script; used to recognize scripts installed by pip. */
  module: string;
  selfUpdateArgs: readonly string[];
  /** The winget package ID (`WinGet\Packages\<ID>_<source>\`). */
  wingetId: string;
  /** The Scoop app name (`apps\<app>\`, `shims\<app>.exe`). */
  scoopApp: string;
  /** The Chocolatey package name (`lib\<package>\`, `bin\<package>.exe`). */
  chocolateyPackage: string;
}

/** The exit code winget gives when there is no upgradable version (APPINSTALLER_CLI_ERROR_UPDATE_NOT_APPLICABLE). */
export const WINGET_UPDATE_NOT_APPLICABLE = 0x8a15002b;

/**
 * Whether an update command counts as a success: exit code 0 does. winget exiting with 0x8A15002B, meaning there is no upgradable version, also counts (the version is unchanged, which means it is already the latest).
 * Windows exit codes are 32-bit unsigned, but Node may report them as negative, so compare them as unsigned before comparing.
 */
export function updateSucceeded(method: ExternalToolUpdateMethod, exitCode: number | null): boolean {
  if (exitCode === 0) return true;
  return method === 'winget' && exitCode !== null && exitCode >>> 0 === WINGET_UPDATE_NOT_APPLICABLE;
}

/** An exit code for display: negative values, or values above 0xFFFF (Windows HRESULT, NTSTATUS, and similar), are written as 8-digit hex. */
export function exitCodeText(code: number): string {
  return code < 0 || code > 0xffff ? `0x${(code >>> 0).toString(16).toUpperCase().padStart(8, '0')}` : String(code);
}

const HEAD_BYTES = 4096;
/** pip's launcher is only a little over 100 KB. A larger `.exe` (a standalone program built with PyInstaller) is not read in full. */
const LAUNCHER_MAX_BYTES = 2 * 1024 * 1024;
const SAFE_POSIX = /^[A-Za-z0-9_@%+=:,./~-]+$/;
/** Arguments that need no quotes in PowerShell: no spaces, quotes, `$`, `` ` ``, `@`, `;`, `,`, `&`, `|`, parentheses or brackets, `#`, `%`, `<>`, and so on. */
const SAFE_POWERSHELL = /^[A-Za-z0-9_+=:./\\-]+$/;

/**
 * Turns an argument array into one line for people that can be pasted into a terminal.
 *
 * - POSIX: single quotes; a single quote inside is written as `'\''`.
 * - Windows (PowerShell): single quotes; a single quote inside (including curly quotes, which PowerShell also treats as single quotes) is written twice. When the first word is quoted, the call operator `& ` is added in front; otherwise PowerShell only prints it as a string.
 */
export function commandLine(argv: readonly string[], platform: NodeJS.Platform = process.platform): string {
  if (platform !== 'win32') return argv.map((a) => (a !== '' && SAFE_POSIX.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ');
  const words = argv.map((a) => (a !== '' && SAFE_POWERSHELL.test(a) ? a : `'${a.replace(/['\u2018\u2019\u201a\u201b]/g, '$&$&')}'`));
  if (words.length && words[0] !== argv[0]) words[0] = `& ${words[0]}`;
  return words.join(' ');
}

/**
 * `file` is the copy in use right now (it may be a symbolic link), and `label` is the tool's name for display. `env` is used only on Windows, to find locations that need admin rights, such as Program Files (it defaults to the current process's environment).
 */
export async function toolUpdatePlan(
  file: string,
  label: string,
  recipe: ToolUpdateRecipe,
  searchPath: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ExternalToolUpdatePlan | null> {
  const real = await fs.realpath(file).catch(() => null);
  if (!real) return null;
  const posix = real.split(path.sep).join('/');
  const plan = (method: ExternalToolUpdateMethod, argv: string[]): ExternalToolUpdatePlan => ({
    method,
    argv,
    command: commandLine(argv, platform),
    runnable: true,
    reason: null,
  });
  const manual = (method: ExternalToolUpdateMethod, argv: string[], reason: Localized): ExternalToolUpdatePlan => ({
    method,
    argv,
    command: commandLine(argv, platform),
    runnable: false,
    reason: reason.text,
    reasonRef: refOf(reason),
  });
  const pipx = async () => {
    const found = await findOnPath('pipx', searchPath, platform);
    if (found) return plan('pipx', [found, 'upgrade', recipe.pipxPackage]);
    return manual('pipx', ['pipx', 'upgrade', recipe.pipxPackage], RcExternalTools.pipxMissing({ label }));
  };
  const adminOnly = async (dir: string, ...targets: string[]) =>
    (platform === 'win32' && windowsAdminDir(dir, env)) || !(await writable(dir, ...targets));

  const cellar = new RegExp(`^(.*)/Cellar/${escape(recipe.formula)}/([^/]+)/`).exec(posix);
  if (cellar) {
    const brew = path.join(cellar[1] || '/', 'bin', 'brew');
    const head = cellar[2]!.startsWith('HEAD') ? ['--fetch-HEAD'] : [];
    if (await isExecutableFile(brew)) return plan('homebrew', [brew, 'upgrade', ...head, recipe.formula]);
    return manual('homebrew', ['brew', 'upgrade', ...head, recipe.formula], RcExternalTools.brewMissing({ label, brew }));
  }

  if (posix.includes(`/pipx/venvs/${recipe.pipxPackage}/`)) return await pipx();

  if (posix.includes('/uv/tools/')) return null;

  if (platform === 'win32') {
    const winget = new RegExp(`/winget/packages/${escape(recipe.wingetId)}_[^/]+/`, 'i').test(posix);
    if (winget) {
      const args = ['upgrade', '--id', recipe.wingetId, '--exact', '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'];
      const found = await findWindowsProgram('winget', searchPath, env);
      if (windowsAdminDir(path.dirname(real), env)) {
        return manual('winget', [found ?? 'winget', ...args], RcExternalTools.wingetMachineWide({ label, dir: path.dirname(real) }));
      }
      if (found) return plan('winget', [found, ...args]);
      return manual('winget', ['winget', ...args], RcExternalTools.wingetMissing({ label }));
    }
    const scoop = await scoopRoot(real, posix, recipe.scoopApp);
    if (scoop) {
      const global = windowsAdminDir(scoop, env) || sameDirOrNull(scoop, envValue(env, 'SCOOP_GLOBAL'));
      if (global) {
        return manual('scoop', ['scoop', 'update', recipe.scoopApp, '--global'], RcExternalTools.scoopGlobal({ label, dir: scoop }));
      }
      const script = path.join(scoop, 'apps', 'scoop', 'current', 'bin', 'scoop.ps1');
      if (!(await exists(script))) return manual('scoop', ['scoop', 'update', recipe.scoopApp], RcExternalTools.scoopMissing({ label, script }));
      return plan('scoop', [windowsPowerShell(env), '-NoProfile', '-ExecutionPolicy', 'Unrestricted', '-File', script, 'update', recipe.scoopApp]);
    }
    if (chocolatey(posix, recipe.chocolateyPackage, env)) {
      return manual('chocolatey', ['choco', 'upgrade', recipe.chocolateyPackage], RcExternalTools.chocolateyAdmin());
    }
  }

  const head = await readHead(real);
  if (!head) return null;
  const text = head.toString('latin1');
  const binary = isNativeExecutable(head);
  const zipapp = text.startsWith('#!') && text.includes('PK\x03\x04');

  if (!binary && !zipapp && text.startsWith('#!') && importsModule(text, recipe.module)) {
    if (platform === 'win32') return null;
    const user = /\/Library\/Python\/[^/]+\/bin$|\/\.local\/bin$/.test(path.posix.dirname(posix));
    const tail = ['-m', 'pip', 'install', '-U', ...(user ? ['--user'] : []), recipe.pipRequirement];
    const python = await scriptInterpreter(text, searchPath, platform);
    if (!python) return manual('pip', ['python3', ...tail], RcExternalTools.pythonScriptMissing());
    if (await adminOnly(path.dirname(real))) {
      return manual('pip', [python, ...tail], RcExternalTools.pipAdmin({ label, dir: path.dirname(real) }));
    }
    return plan('pip', [python, ...tail]);
  }

  if (binary && platform === 'win32') {
    const launcher = await pipLauncher(real, recipe.module);
    if (launcher === 'uv') return null;
    if (launcher) {
      const interpreter = launcher.replace(/\\/g, '/');
      if (interpreter.includes(`/pipx/venvs/${recipe.pipxPackage}/`)) return await pipx();
      if (interpreter.includes('/uv/tools/')) return null;
      const scripts = path.dirname(real);
      const user = !sameDir(scripts, path.win32.dirname(launcher)) && !sameDir(scripts, path.win32.join(path.win32.dirname(launcher), 'Scripts'));
      const tail = ['-m', 'pip', 'install', '-U', ...(user ? ['--user'] : []), recipe.pipRequirement];
      if (!(await exists(launcher))) return manual('pip', ['py', ...tail], RcExternalTools.pythonLauncherMissing());
      if (await adminOnly(scripts)) {
        return manual('pip', [launcher, ...tail], RcExternalTools.pipAdminWin({ label, dir: scripts }));
      }
      return plan('pip', [launcher, ...tail]);
    }
    // An .exe in an unrecognized Scripts directory (another launcher) does not get -U.
    if (/[\\/]scripts[\\/][^\\/]+$/i.test(real)) return null;
  }

  if (binary || zipapp) {
    const argv = [file, ...recipe.selfUpdateArgs];
    if (!(await adminOnly(path.dirname(real), real))) return plan('standalone', argv);
    if (platform === 'win32') return manual('standalone', argv, RcExternalTools.standaloneAdminWin({ label, dir: path.dirname(real) }));
    const reason = RcExternalTools.standaloneAdmin({ label, dir: path.dirname(real) }).text;
    return { method: 'standalone', argv, command: `sudo ${commandLine(argv, platform)}`, runnable: false, reason };
  }
  return null;
}

/**
 * On Windows, pip's entry program (the distlib launcher): after the launcher program comes a `#!<interpreter>` line, followed right after by a zip (`__main__.py` is stored uncompressed).
 * When it is a launcher that imports `module`, it returns the interpreter path from that line (wrapped in double quotes when it has spaces; the quotes are removed). For uv's launcher (which ends with `UVSC`), it returns 'uv'.
 * Otherwise null.
 */
async function pipLauncher(file: string, module: string): Promise<string | 'uv' | null> {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile() || stat.size > LAUNCHER_MAX_BYTES) return null;
  const data = await fs.readFile(file).catch(() => null);
  if (!data) return null;
  if (data.subarray(-4).toString('latin1') === 'UVSC') return 'uv';
  const zip = Buffer.from('PK\x03\x04', 'latin1');
  for (let at = data.indexOf(zip); at > 0; at = data.indexOf(zip, at + 1)) {
    if (data[at - 1] !== 0x0a) continue;
    const start = data.lastIndexOf('#!', at - 1);
    if (start < 0 || at - start > 1024 || data.subarray(start, at - 1).includes(0x0a)) continue;
    const line = data.subarray(start + 2, at).toString('utf8').trim();
    const quoted = /^"([^"]+)"/.exec(line);
    const interpreter = quoted ? quoted[1]! : line.split(/\s+/, 1)[0]!;
    if (!interpreter || !importsModule(data.subarray(at).toString('latin1'), module)) return null;
    return interpreter;
  }
  return null;
}

/**
 * A Scoop directory (the user's `~\scoop`, the directory `SCOOP` points to, or the global one). The entry is `<dir>\shims\<app>.exe` with `<app>.shim` beside it, or the real location is under `<dir>\apps\<app>\<version>\` and `<dir>\shims` exists. Otherwise null.
 */
async function scoopRoot(real: string, posix: string, app: string): Promise<string | null> {
  const name = escape(app);
  const shim = new RegExp(`^(.*)/shims/${name}\\.exe$`, 'i').exec(posix);
  if (shim && (await exists(`${real.slice(0, -'.exe'.length)}.shim`))) return real.slice(0, shim[1]!.length);
  const installed = new RegExp(`^(.*)/apps/${name}/[^/]+/`, 'i').exec(posix);
  if (installed && (await isDirectory(path.join(real.slice(0, installed[1]!.length), 'shims')))) return real.slice(0, installed[1]!.length);
  return null;
}

/** Installed by Chocolatey: under `<Chocolatey directory>\bin\<package>.exe` or `lib\<package>\`. The directory is the one `ChocolateyInstall` points to, or one named chocolatey. */
function chocolatey(posix: string, pkg: string, env: NodeJS.ProcessEnv): boolean {
  const name = escape(pkg);
  const under = (root: string) => new RegExp(`^${escape(root)}/(?:bin/${name}\\.exe$|lib/${name}/)`, 'i').test(posix);
  const configured = envValue(env, 'ChocolateyInstall');
  return (configured ? under(configured.replace(/\\/g, '/').replace(/\/+$/, '')) : false) || new RegExp(`/chocolatey/(?:bin/${name}\\.exe$|lib/${name}/)`, 'i').test(posix);
}

/** On Windows, a program on PATH (`<name>.exe`), then `%LOCALAPPDATA%\Microsoft\WindowsApps`. winget is an app execution alias there, and following it with `stat` fails, so only whether it exists is checked. */
async function findWindowsProgram(name: string, searchPath: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  const local = envValue(env, 'LOCALAPPDATA');
  const dirs = searchPath.split(path.delimiter).concat(local ? [path.join(local, 'Microsoft', 'WindowsApps')] : []);
  for (const dir of dirs) {
    if (!dir || (!path.isAbsolute(dir) && !path.win32.isAbsolute(dir))) continue;
    const file = path.join(dir, `${name}.exe`);
    if (await exists(file)) return file;
  }
  return null;
}

/** Windows PowerShell in System32. It is not looked up on PATH, so a same-named program cannot take its place. It ships with the system, so it is always there. */
function windowsPowerShell(env: NodeJS.ProcessEnv): string {
  const root = envValue(env, 'SystemRoot') || envValue(env, 'windir') || 'C:\\Windows';
  return path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

/** On Windows, the locations that need admin rights to rewrite: Program Files (including x86), ProgramData, and the Windows directory. */
function windowsAdminDir(dir: string, env: NodeJS.ProcessEnv): boolean {
  const roots = ['ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'ProgramData', 'SystemRoot']
    .map((name) => envValue(env, name))
    .concat(['C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData', 'C:\\Windows'])
    .filter((root): root is string => !!root)
    .map(normalizeDir);
  const target = normalizeDir(dir);
  return roots.some((root) => target === root || target.startsWith(`${root}/`));
}

/** Compares Windows paths case-insensitively; `\` and `/` are the same, and trailing separators are ignored. */
function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function sameDir(a: string, b: string): boolean {
  return normalizeDir(a) === normalizeDir(b);
}

function sameDirOrNull(a: string, b: string | undefined): boolean {
  return !!b && sameDir(a, b);
}

async function isDirectory(dir: string): Promise<boolean> {
  return (await fs.stat(dir).catch(() => null))?.isDirectory() ?? false;
}

/**
 * Whether the interpreter exists. Microsoft Store's Python is an app execution alias in WindowsApps, and following it with `stat` may fail, so check whether the alias itself exists.
 */
async function exists(file: string): Promise<boolean> {
  if (!path.isAbsolute(file) && !path.win32.isAbsolute(file)) return false;
  return (await fs.lstat(file).catch(() => null)) !== null;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readHead(file: string): Promise<Buffer | null> {
  const handle = await fs.open(file, 'r').catch(() => null);
  if (!handle) return null;
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Mach-O (including universal binaries), ELF, PE. */
function isNativeExecutable(head: Buffer): boolean {
  if (head.length < 4) return false;
  const magic = head.readUInt32BE(0);
  return (
    [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0x7f454c46].includes(magic) ||
    (head[0] === 0x4d && head[1] === 0x5a)
  );
}

function importsModule(text: string, module: string): boolean {
  return new RegExp(`^\\s*(?:from\\s+${escape(module)}(?:\\.|\\s)|import\\s+${escape(module)}\\b)`, 'm').test(text);
}

/**
 * The interpreter of an entry script: `#!/absolute/path/python`, `#!/usr/bin/env python3` (looked up on PATH), or the `#!/bin/sh` followed by `'''exec' "<interpreter>" "$0" "$@"` that pip writes for long paths. Null when the interpreter cannot be run.
 */
async function scriptInterpreter(text: string, searchPath: string, platform: NodeJS.Platform): Promise<string | null> {
  const first = text.slice(2).split('\n', 1)[0]!.trim();
  const words = first.split(/\s+/);
  let interpreter: string | null = words[0] ?? null;
  if (interpreter && path.posix.basename(interpreter) === 'sh') {
    const exec = /^'''exec' (?:"([^"]+)"|(\S+)) "\$0" "\$@"/m.exec(text);
    interpreter = exec ? (exec[1] ?? exec[2]!) : null;
  } else if (interpreter && path.posix.basename(interpreter) === 'env') {
    const name = words.slice(1).find((w) => !w.startsWith('-'));
    interpreter = name ? await findOnPath(name, searchPath, platform) : null;
  }
  if (!interpreter || !path.isAbsolute(interpreter)) return null;
  return (await isExecutableFile(interpreter)) ? interpreter : null;
}

async function writable(...targets: string[]): Promise<boolean> {
  for (const target of targets) {
    const ok = await fs.access(target, constants.W_OK).then(
      () => true,
      () => false,
    );
    if (!ok) return false;
  }
  return true;
}

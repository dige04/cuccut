import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CucCutClient } from '@cuccut/client';
import {
  MCP_INTERFACE_VERSION,
  RUNTIME_VERSION,
  isLanguagePreference,
  processLanguageTags,
  resolveLanguage,
  setLocale,
  type CatalogListResult,
  type RuntimeDiscovery,
  type RuntimeInfo,
} from '@cuccut/protocol';
import { M } from '../cli-copy.ts';
import { CliError } from '../envelope.ts';

/**
 * The CLI's connection to the Runtime (Agent-facing design §5.6; architecture design §2.2). It finds the running Runtime through the discovery file in `CUCCUT_HOME`. If none is found, it starts one by default in the background (detached from the terminal, output written to `<CUCCUT_HOME>/logs/cli-runtime.log`) and waits for it to write the discovery file before connecting. It starts with `--launched-by cli --idle-exit`: `runtime stop` only stops such instances, and one that has been idle for `runtime.idleExitMinutes` exits by itself.
 *
 * The version gate after connecting: if the interface version from `catalog.list` differs from the CLI's `MCP_INTERFACE_VERSION`, it is rejected with exit code 3 rather than interpreted with the old parameters.
 */

/** Upper bound for one request: tool calls (fetching frames, reading large documents) may take long; tasks that wait go through the `jobs` topic and do not hold the request. */
const REQUEST_TIMEOUT_MS = 30 * 60_000;
/** Upper bound for waiting for the discovery file after starting the Runtime. */
const START_TIMEOUT_MS = 60_000;
const POLL_MS = 100;

export function runtimeHome(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.CUCCUT_HOME || path.join(os.homedir(), '.cuccut'));
}

export function discoveryFile(home: string): string {
  return path.join(home, 'runtime.json');
}

/** Instance lock (`@cuccut/runtime-storage`): a live Runtime holds it and releases it only after it has stopped. */
export function lockFile(home: string): string {
  return path.join(home, 'runtime.lock');
}

/** Whether the instance lock's holder is still alive (false when the lock file is missing or unreadable). */
export function lockHolderAlive(home: string): boolean {
  try {
    const { pid } = JSON.parse(fs.readFileSync(lockFile(home), 'utf8')) as { pid?: unknown };
    return typeof pid === 'number' && isProcessAlive(pid);
  } catch {
    return false;
  }
}

export function startLogFile(home: string): string {
  return path.join(home, 'logs', 'cli-runtime.log');
}

export function readDiscovery(home: string): RuntimeDiscovery | null {
  try {
    return JSON.parse(fs.readFileSync(discoveryFile(home), 'utf8')) as RuntimeDiscovery;
  } catch {
    return null;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Discovery information for the running Runtime; null when there is no discovery file or the process is already gone. */
export function findRuntime(home: string): RuntimeDiscovery | null {
  const discovery = readDiscovery(home);
  return discovery && isProcessAlive(discovery.pid) ? discovery : null;
}

/** How to start the Runtime. */
export interface LaunchSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
  source: 'env' | 'packaged' | 'repo';
}

/**
 * Finds the Runtime entry in this order: `CUCCUT_RUNTIME_ENTRY` (`.ts` / `.js` are run with the current Node, otherwise it is treated as an executable) → the installed CucCut app (its bundled Runtime is run in Node mode, with resource locations as in the desktop's `packagedResourceEnv`) → `apps/runtime/src/main.ts` in the repository.
 */
export function resolveRuntimeLaunch(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  from: string = path.dirname(fileURLToPath(import.meta.url)),
): LaunchSpec | null {
  const explicit = env.CUCCUT_RUNTIME_ENTRY;
  if (explicit) {
    const entry = path.resolve(explicit);
    return /\.(ts|mts|js|mjs|cjs)$/.test(entry)
      ? { command: process.execPath, args: [entry], env: {}, source: 'env' }
      : { command: entry, args: [], env: {}, source: 'env' };
  }
  for (const app of packagedApps(env, platform)) {
    if (fs.existsSync(app.executable) && fs.existsSync(path.join(app.resources, 'app.asar'))) {
      return {
        command: app.executable,
        args: [path.join(app.resources, 'app.asar', 'out', 'main', 'runtime.js'), '--credential-store', 'keychain'],
        env: { ELECTRON_RUN_AS_NODE: '1', ...packagedResourceEnv(app.resources, platform) },
        source: 'packaged',
      };
    }
  }
  const root = repoRoot(from);
  const entry = root && path.join(root, 'apps', 'runtime', 'src', 'main.ts');
  if (entry && fs.existsSync(entry)) return { command: process.execPath, args: [entry], env: {}, source: 'repo' };
  return null;
}

/** Where an installed CucCut app may be (per-user NSIS install on Windows, Applications on macOS). */
export function packagedApps(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): { executable: string; resources: string }[] {
  if (platform === 'win32') {
    const roots = [
      env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Programs', 'CucCut'),
      env.ProgramFiles && path.win32.join(env.ProgramFiles, 'CucCut'),
    ];
    return roots
      .filter((root): root is string => Boolean(root))
      .map((root) => ({ executable: path.win32.join(root, 'CucCut.exe'), resources: path.win32.join(root, 'resources') }));
  }
  if (platform === 'darwin') {
    return ['/Applications', path.posix.join(os.homedir().replaceAll('\\', '/'), 'Applications')].map((dir) => ({
      executable: path.posix.join(dir, 'CucCut.app', 'Contents', 'MacOS', 'CucCut'),
      resources: path.posix.join(dir, 'CucCut.app', 'Contents', 'Resources'),
    }));
  }
  return [];
}

/**
 * What the packaged Runtime reads by path: the same as `packagedResourceEnv` in the desktop's `apps/desktop/src/main/packaged-resources.ts` (the CLI does not depend on the desktop package; `connection.test.ts` checks that the two match).
 */
export function packagedResourceEnv(resources: string, platform: NodeJS.Platform = process.platform): Record<string, string> {
  return {
    CUCCUT_BIN_DIR: path.join(resources, 'bin'),
    CUCCUT_TEMPLATES_DIR: path.join(resources, 'templates'),
    CUCCUT_SKILLS_DIR: path.join(resources, 'skills', 'cuccut', 'built-in-skills'),
    CUCCUT_AGENT_SKILLS_DIR: path.join(resources, 'skills'),
    CUCCUT_MODEL_ASSETS_DIR: path.join(resources, 'model-assets'),
    CUCCUT_WEB_DIST: path.join(resources, 'web'),
    CUCCUT_SLIDES_EDITOR_DIST: path.join(resources, 'slides-editor'),
    CUCCUT_DESIGN_EDITOR_DIST: path.join(resources, 'design-editor'),
    CUCCUT_DESIGN_SYSTEM_EDITOR_DIST: path.join(resources, 'design-system-editor'),
    ...(platform === 'darwin' ? { PMETAL_METALLIB_PATH: path.join(resources, 'bin', 'mlx.metallib') } : {}),
  };
}

/**
 * The root directory of the manuals (it contains `cuccut/`), used by `cuccut skill path`, which does not connect to the Runtime. It uses the same order as the Runtime's `resolveBuiltinAgentSkillsDir`: `CUCCUT_AGENT_SKILLS_DIR` → the installed CucCut app's `<resources>/skills` → `skills/` at the repository root.
 * Null when none of them exists.
 */
export function resolveAgentSkillsDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  from: string = path.dirname(fileURLToPath(import.meta.url)),
): string | null {
  if (env.CUCCUT_AGENT_SKILLS_DIR) return env.CUCCUT_AGENT_SKILLS_DIR;
  for (const app of packagedApps(env, platform)) {
    const dir = packagedResourceEnv(app.resources).CUCCUT_AGENT_SKILLS_DIR!;
    if (fs.existsSync(dir)) return dir;
  }
  const root = repoRoot(from);
  const dir = root && path.join(root, 'skills');
  return dir && fs.existsSync(dir) ? dir : null;
}

/** Searches upward for the repository root (the `package.json` whose name is `cuccut`). */
function repoRoot(from: string): string | null {
  for (let dir = from; ; dir = path.dirname(dir)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: unknown };
      if (pkg.name === 'cuccut') return dir;
    } catch {
      // Keep going up.
    }
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * Starts the Runtime in the background and waits for it to write the discovery file. If another process starts it first (the child exits with code 3: the instance lock is held), it uses that one, and `started` is false.
 *
 * If the lock is held but no discovery file ever appears, that instance is exiting because it is idle (it deletes the discovery file before stopping, architecture design §2.2): wait for it to release the lock and start once more, retrying only once.
 */
export async function launchRuntime(
  home: string,
  spec: LaunchSpec,
  timeoutMs = START_TIMEOUT_MS,
): Promise<{ discovery: RuntimeDiscovery; started: boolean }> {
  const log = startLogFile(home);
  const deadline = Date.now() + timeoutMs;
  let respawned = false;
  for (;;) {
    const child = spawnRuntime(home, spec, log);
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (child.error) throw new CliError('RUNTIME_START_FAILED', M.runtimeStartFailed(child.error.message, log), { log });
      const discovery = findRuntime(home);
      if (discovery && (discovery.pid === child.pid || child.exitCode === 3)) return { discovery, started: discovery.pid === child.pid };
      if (child.exitCode !== undefined && child.exitCode !== 3) {
        throw new CliError('RUNTIME_START_FAILED', M.runtimeStartFailed(M.exitedWith(child.exitCode), log), { log, tail: tail(log) });
      }
      if (Date.now() >= deadline) {
        throw new CliError('RUNTIME_START_FAILED', M.runtimeStartTimeout(Math.round(timeoutMs / 1000), log), { log, tail: tail(log) });
      }
      if (child.exitCode === 3 && !respawned && !lockHolderAlive(home)) {
        respawned = true;
        break;
      }
    }
  }
}

interface SpawnedRuntime {
  pid: number | undefined;
  /** The exit code on exit; undefined while still running. */
  exitCode: number | null | undefined;
  error: Error | null;
}

function spawnRuntime(home: string, spec: LaunchSpec, log: string): SpawnedRuntime {
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const fd = fs.openSync(log, 'a');
  let child;
  try {
    child = spawn(spec.command, [...spec.args, '--quiet', '--launched-by', 'cli', '--idle-exit'], {
      detached: true,
      stdio: ['ignore', fd, fd],
      env: { ...process.env, ...spec.env, CUCCUT_HOME: home },
      windowsHide: true,
    });
  } finally {
    fs.closeSync(fd);
  }
  const state: SpawnedRuntime = { pid: child.pid, exitCode: undefined, error: null };
  child.once('error', (error) => (state.error = error));
  child.once('exit', (code) => (state.exitCode = code));
  child.unref();
  return state;
}

function tail(file: string, lines = 20): string[] {
  try {
    return fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines);
  } catch {
    return [];
  }
}

export interface EnsureOptions {
  /** Start the Runtime when none is found (turned off by `--no-start`). */
  start: boolean;
  env?: NodeJS.ProcessEnv;
}

/** Find or start the Runtime. */
export async function ensureRuntime(home: string, options: EnsureOptions): Promise<{ discovery: RuntimeDiscovery; started: boolean }> {
  const running = findRuntime(home);
  if (running) return { discovery: running, started: false };
  if (!options.start) throw new CliError('RUNTIME_UNAVAILABLE', M.runtimeNotRunning(home), { home, next: 'cuccut runtime ensure' });
  const spec = resolveRuntimeLaunch(options.env);
  if (!spec) throw new CliError('RUNTIME_UNAVAILABLE', M.runtimeNoEntry, { home });
  return launchRuntime(home, spec);
}

/** Connects to a known Runtime (a one-time connection; no reconnecting). */
export async function openClient(
  discovery: RuntimeDiscovery,
  options: { readLanguage?: boolean } = {},
): Promise<{ client: CucCutClient; info: RuntimeInfo }> {
  const client = new CucCutClient({
    resolve: async () => ({ endpoint: discovery.endpoint, token: discovery.token }),
    client: { kind: 'cli', name: 'cuccut', version: RUNTIME_VERSION },
    reconnect: false,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
  });
  try {
    const info = await client.connect();
    if (options.readLanguage !== false) await applyRuntimeLanguage(client);
    return { client, info };
  } catch (error) {
    const state = client.state;
    client.close();
    if (state.status === 'incompatible') throw new CliError('PROTOCOL_MISMATCH', M.protocolMismatch(state.reason));
    throw new CliError('RUNTIME_UNAVAILABLE', M.runtimeConnectFailed(error instanceof Error ? error.message : String(error)), {
      endpoint: discovery.endpoint,
    });
  }
}

/**
 * After connecting, the output language is set from the Runtime's `ui.language` (when it is `system`, the system language of this process is still used). If it cannot be read (an old Runtime, insufficient permission, an unrecognized value), the system language from startup is kept and no error is raised. CUCCUT_LOCALE still takes precedence.
 */
async function applyRuntimeLanguage(client: CucCutClient): Promise<void> {
  try {
    const view = await client.request('settings.get', { keys: ['ui.language'] });
    const preference = view.settings['ui.language'] ?? view.defaults['ui.language'];
    if (isLanguagePreference(preference)) setLocale(resolveLanguage(preference, processLanguageTags()));
  } catch {
    // Ignored: keep the system language.
  }
}

export interface Session {
  client: CucCutClient;
  info: RuntimeInfo;
  /** Whether this run started it automatically. */
  started: boolean;
  /** The directory of the connected Runtime (commands are executed against it). */
  catalog: CatalogListResult;
}

/**
 * Finds or starts the Runtime, connects, fetches the directory and passes the version gate. If the connection fails and that Runtime is then gone (the process exited, or its discovery file was removed: an idle exit collided with this connection), it finds or starts one more time, retrying only once.
 */
export async function connectRuntime(options: { home: string; start: boolean }): Promise<Session> {
  const first = await ensureRuntime(options.home, { start: options.start });
  try {
    return await openSession(first);
  } catch (error) {
    if (!(error instanceof CliError) || error.code !== 'RUNTIME_UNAVAILABLE' || !withdrawn(options.home, first.discovery)) throw error;
    return openSession(await ensureRuntime(options.home, { start: options.start }));
  }
}

async function openSession({ discovery, started }: { discovery: RuntimeDiscovery; started: boolean }): Promise<Session> {
  const { client, info } = await openClient(discovery);
  try {
    let catalog: CatalogListResult;
    try {
      catalog = await client.request('catalog.list', {});
    } catch (error) {
      if (client.state.status === 'connected') throw error;
      throw new CliError('RUNTIME_UNAVAILABLE', M.runtimeLost(error instanceof Error ? error.message : String(error)));
    }
    checkInterfaceVersion(catalog.interfaceVersion);
    return { client, info, started, catalog };
  } catch (error) {
    client.close();
    throw error;
  }
}

/** This Runtime is gone, or is exiting (the discovery file no longer points to it). */
export function withdrawn(home: string, discovery: RuntimeDiscovery): boolean {
  return !isProcessAlive(discovery.pid) || readDiscovery(home)?.instanceId !== discovery.instanceId;
}

/** Interface version gate (§5.6): states which side needs updating. */
export function checkInterfaceVersion(runtimeVersion: string, cliVersion: string = MCP_INTERFACE_VERSION): void {
  if (runtimeVersion === cliVersion) return;
  const update = Number(runtimeVersion) > Number(cliVersion) ? 'cli' : 'runtime';
  throw new CliError('INTERFACE_VERSION_MISMATCH', M.interfaceMismatch(cliVersion, runtimeVersion, update), {
    cli: cliVersion,
    runtime: runtimeVersion,
    update,
  });
}

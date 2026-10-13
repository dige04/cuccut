import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { CodeBundleError, CompositionHost, resolveElectronBinary } from '@cuccut/code-runtime';
import { editorSemantics, locateEditorWasm } from '@cuccut/editor-wasm';
import { resolveSpeechWorkerCommand } from '@cuccut/jobs';
import { WORKER_CONTRACT_VERSION, resolveModelAssetsDir } from '@cuccut/models';
import { resolveCredentialHelperCommand } from './credentials.ts';
import { resolveExportWorkerCommand } from './exports/video-export.ts';
import { resolveModelWorkerCommand } from './models/model-worker.ts';
import { resolveWebDist } from './services/web-static.ts';
import { resolveBuiltinAgentSkillsDir } from './skills/agent-skill-renderer.ts';
import { resolveBuiltinSkillsDir } from './skills/skill-catalog.ts';
import { resolveBuiltinTemplatesDir } from './templates/template-catalog.ts';
import { resolveEngineHostCommand } from './videos/engine-host.ts';

/**
 * Self-check of the Runtime (`runtime --self-check [--probe]`): without starting the Runtime, it uses the same resolution functions the Runtime uses to find things, and reports where the native programs shipped with the app (Worker, credential helper), the built-in templates and skills, the model data, the Web client and `editor.wasm` resolve to, and whether they exist. When `probe` is given, it also launches each native program once and goes through its handshake, proving it can start on this machine (a missing DLL or a wrong architecture shows up here); the Electron off-screen host of the code package is also launched once, waited on until `ready`, then closed (`probeCompositionHost`). In a packaged app, this goes through the `--composition-host` branch of the main process entry.
 *
 * Mainly for packaged builds: the desktop app's check script (`apps/desktop/tools/check-packaged-app.mjs`) runs the app's executable in Node mode on the `runtime.js` packed into the asar, with the same environment variables the main process gives when it starts the Runtime. It does not touch the Runtime Home and makes no network calls.
 */

export interface SelfCheckProbe {
  ok: boolean;
  detail: string;
  reply?: unknown;
}

export interface SelfCheckReport {
  platform: NodeJS.Platform;
  arch: string;
  binaries: Record<string, string | null>;
  dirs: Record<string, string | null>;
  editorWasm: string | null;
  probes: Record<string, SelfCheckProbe>;
  /** The items that are wrong; empty means pass. */
  problems: string[];
}

const PROBE_TIMEOUT_MS = 20_000;

interface ProbeSpec {
  args: string[];
  /** The one-line request written to it; null means write nothing, and only close stdin and check the exit code. */
  request: unknown;
  /** Whether a reply counts as success. */
  accept?: (reply: unknown) => boolean;
  /** The expected exit code when no request is written. */
  exitCode?: number;
}

function probe(command: string, spec: ProbeSpec): Promise<SelfCheckProbe> {
  return new Promise((resolve) => {
    let settled = false;
    let stderr = '';
    const child = spawn(command, spec.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const finish = (result: SelfCheckProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, detail: `timed out (${PROBE_TIMEOUT_MS} ms): ${stderr.trim()}` }), PROBE_TIMEOUT_MS);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-2000);
    });
    child.once('error', (error) => finish({ ok: false, detail: `failed to start: ${error.message}` }));
    // Use close (after all stdio is closed) rather than exit: for a program that quits after answering one line, the reply must be read first. On Windows, a missing DLL gives 0xC0000135 (-1073741515).
    child.once('close', (code, signal) => {
      if (spec.request === null && code === spec.exitCode) finish({ ok: true, detail: `exit code ${code}` });
      else finish({ ok: false, detail: `exited (${signal ?? `exit code ${code}`}): ${stderr.trim()}` });
    });
    child.stdin.on('error', () => {});
    if (spec.request === null) {
      child.stdin.end();
      return;
    }
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let reply: unknown;
      try {
        reply = JSON.parse(line);
      } catch {
        return;
      }
      const ok = spec.accept ? spec.accept(reply) : true;
      finish({ ok, detail: ok ? 'ok' : 'unexpected reply', reply });
    });
    child.stdin.write(`${JSON.stringify(spec.request)}\n`);
  });
}

/**
 * Off-screen host: launched the same way the Runtime does (`resolveElectronBinary`, the default timeout of `CompositionHost.start`), and closed once `ready` arrives.
 * The host script and its Electron data directory are written to the system temp directory (no `cacheDir` given), and do not touch the Runtime Home.
 */
export async function probeCompositionHost(env: NodeJS.ProcessEnv = process.env): Promise<SelfCheckProbe> {
  if (!resolveElectronBinary(env)) return { ok: false, detail: 'Electron was not found; set CUCCUT_ELECTRON to the Electron executable' };
  const started = Date.now();
  let host: CompositionHost;
  try {
    host = await CompositionHost.start({ env });
  } catch (error) {
    if (!(error instanceof CodeBundleError)) return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    const { stderr } = (error.details ?? {}) as { stderr?: unknown };
    const tail = typeof stderr === 'string' && stderr.trim() ? `: ${stderr.trim().slice(-1500)}` : '';
    return { ok: false, detail: `${error.code}: ${error.message}${tail}` };
  }
  const readyMs = Date.now() - started;
  await host.close();
  return { ok: true, detail: `ready in ${readyMs} ms` };
}

/** A reply from the JSON-line Worker: has `result` and no `error`. */
function hasResult(reply: unknown): boolean {
  return typeof reply === 'object' && reply !== null && 'result' in reply && !('error' in reply && (reply as { error?: unknown }).error);
}

export async function runtimeSelfCheck(options: { probe?: boolean; env?: NodeJS.ProcessEnv } = {}): Promise<SelfCheckReport> {
  const env = options.env ?? process.env;
  const engineHost = resolveEngineHostCommand(env);
  const binaries: Record<string, string | null> = {
    'engine-host': engineHost,
    'export-worker': resolveExportWorkerCommand(engineHost, env),
    'model-worker': resolveModelWorkerCommand(env)?.command ?? null,
    'speech-worker': resolveSpeechWorkerCommand(engineHost, env),
    'credential-helper': resolveCredentialHelperCommand(env)?.command ?? null,
    // The Electron used by the code package's off-screen host: in a packaged app, it is the app's own executable.
    electron: resolveElectronBinary(env),
  };
  const dirs: Record<string, string | null> = {
    templates: resolveBuiltinTemplatesDir(env),
    skills: resolveBuiltinSkillsDir(env),
    agentSkills: resolveBuiltinAgentSkillsDir(env),
    modelAssets: resolveModelAssetsDir(env),
    web: resolveWebDist(env),
  };
  const editorWasm = locateEditorWasm();

  const problems: string[] = [];
  for (const [name, file] of Object.entries(binaries)) {
    if (!file || !isFile(file)) problems.push(`${name}: did not resolve to an existing file (${file ?? 'null'})`);
  }
  for (const [name, dir] of Object.entries(dirs)) {
    if (!dir || !isDirectory(dir)) problems.push(`${name}: did not resolve to an existing directory (${dir ?? 'null'})`);
  }
  if (dirs.web && !isFile(path.join(dirs.web, 'index.html'))) problems.push(`web: no index.html in the directory (${dirs.web})`);
  try {
    editorSemantics();
  } catch (error) {
    problems.push(`editor.wasm: failed to load (${editorWasm ?? 'null'}): ${error instanceof Error ? error.message : String(error)}`);
  }

  const probes: Record<string, SelfCheckProbe> = {};
  if (options.probe) {
    const specs: Record<string, ProbeSpec> = {
      'engine-host': { args: [], request: { id: 1, method: 'host.hello', params: {} }, accept: hasResult },
      'model-worker': {
        args: ['--parent-pid', String(process.pid)],
        request: { id: 1, method: 'worker.hello', params: { contractVersion: WORKER_CONTRACT_VERSION } },
        accept: hasResult,
      },
      'speech-worker': { args: [], request: { id: 1, method: 'hello', params: {} }, accept: hasResult },
      // The Render Worker takes one command at a time and has no handshake: with no arguments it prints usage and exits with 2, which is enough to prove it can start.
      'export-worker': { args: [], request: null, exitCode: 2 },
      // The credential helper answers one line and exits. Answering unsupported outside macOS also counts as able to start: credential unavailability is reported honestly by the Runtime (architecture design §6.8).
      'credential-helper': {
        args: [],
        request: { op: 'has', key: 'cuccut.self-check' },
        accept: (reply) => typeof reply === 'object' && reply !== null && typeof (reply as { ok?: unknown }).ok === 'boolean',
      },
    };
    for (const [name, spec] of Object.entries(specs)) {
      const file = binaries[name];
      if (!file) continue;
      const result = await probe(file, spec);
      probes[name] = result;
      if (!result.ok) problems.push(`${name}: does not start (${result.detail})`);
    }
    const host = await probeCompositionHost(env);
    probes['composition-host'] = host;
    if (!host.ok) problems.push(`composition-host: does not start (${host.detail})`);
  }

  return { platform: process.platform, arch: process.arch, binaries, dirs, editorWasm, probes, problems };
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

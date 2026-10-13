import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AcpInstall } from '../acp/acp-binary.ts';

/**
 * Fake ACP agent for tests: an executable that answers `--version`, and when given other arguments speaks ACP on stdio (JSON-RPC over JSON lines).
 * It does not touch the network or the machine's real agents. Every message received is recorded in `log.jsonl`, and the tests use it to check session parameters (working directory, MCP services, mode, model, input) and the replies to approvals.
 *
 * Usage: `createFakeAcp(dir)` gives `locate`, which is passed to `new AcpDriver('gemini', log, { locate })`. `scenario()` changes the next run's behaviour (read once when each process starts).
 */

/** What the agent does in one turn. */
export interface FakeAcpTurn {
  /** Thinking sent first. */
  thought?: string;
  /** Plan entries. */
  plan?: string[];
  /** One tool call. */
  tool?: {
    kind: string;
    title: string;
    rawInput?: unknown;
    locations?: string[];
    output?: string;
    /** The `diff` content block carried by `tool_call` (claude-code-acp sends it this way: completed updates no longer carry content). */
    diffs?: Array<{ path: string; oldText: string | null; newText: string }>;
  };
  /** Asks several times before tool execution (consecutive calls of the same kind of tool, used to test “allow for this session”). 0 means never ask. */
  ask?: number;
  /** Text reply (sent in two parts). */
  reply?: string;
  /** Never ends until `session/cancel` is received. */
  hang?: boolean;
  /** `session/prompt` returns this error. */
  error?: { code: number; message: string };
}

export interface FakeAcpScenario {
  /** false: `locate` returns null (not installed). */
  installed: boolean;
  version: string;
  /** false: `session/new` and `session/load` return -32000 (login required). */
  loggedIn: boolean;
  loadSession: boolean;
  /** `sessionCapabilities.resume`。 */
  resume: boolean;
  /** `session/load` returns an error. */
  loadFails: boolean;
  mcpHttp: boolean;
  image: boolean;
  /** Session mode. null omits `modes`. `config`: use a config option classified as mode instead. */
  modes: string[] | null;
  modesVia: 'modes' | 'config';
  /** Gives a Copilot-style “allow all” config option (`allow_all`, on / off, initially off). */
  allowAll: boolean;
  /** Source of the model table: the legacy `models`, a config option classified as model, or none. */
  models: 'legacy' | 'config' | 'none';
  /** Answers `cursor/list_available_models`. */
  cursorModels: boolean;
  /**
   * At startup, spawns a long-running child process that ignores SIGTERM (like the `rg` cursor-agent runs at startup to index @ files), and does not manage it when it exits itself.
   * The process id is recorded in the `helper` field of the `start` log.
   */
  helper: boolean;
  /** On receiving `initialize`, does not reply and exits directly with exit code 1. */
  exitOnInitialize: boolean;
  turn: FakeAcpTurn;
}

export interface FakeAcpLogEntry {
  t: number;
  pid: number;
  kind: 'start' | 'in' | 'exit';
  cwd?: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  /** The child process spawned in the `helper` scenario. */
  helper?: number;
  msg?: { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: unknown };
}

export interface FakeAcp {
  dir: string;
  locate: () => Promise<AcpInstall | null>;
  scenario(patch: Partial<FakeAcpScenario>): void;
  log(): FakeAcpLogEntry[];
  /** Parameters of a request or notification received for a given method, in arrival order. */
  requests(method: string): Array<{ pid: number; params: Record<string, unknown> }>;
  /** CucCut's replies to approval requests (`outcome`), in arrival order. */
  permissionAnswers(): Array<{ outcome: string; optionId?: string }>;
}

const DEFAULT_SCENARIO: FakeAcpScenario = {
  installed: true,
  version: '0.46.0',
  loggedIn: true,
  loadSession: true,
  resume: false,
  loadFails: false,
  mcpHttp: true,
  image: true,
  modes: ['default', 'autoEdit', 'yolo', 'plan'],
  modesVia: 'modes',
  allowAll: false,
  models: 'legacy',
  cursorModels: false,
  helper: false,
  exitOnInitialize: false,
  turn: { reply: 'done' },
};

const ENTRY = fileURLToPath(new URL('./fake-acp-agent.ts', import.meta.url));

export async function createFakeAcp(dir: string, scenario: Partial<FakeAcpScenario> = {}): Promise<FakeAcp> {
  await fs.mkdir(dir, { recursive: true });
  const command = path.join(dir, 'fake-acp');
  // The fake agent is .ts: Node before 22.18 needs type stripping explicitly turned on. The environment has been restricted, so NODE_OPTIONS cannot be relied on.
  await fs.writeFile(command, `#!/bin/sh\nexec "${process.execPath}" --experimental-strip-types --no-warnings "${ENTRY}" "$@"\n`, {
    mode: 0o755,
  });
  const scenarioFile = path.join(dir, 'scenario.json');
  const logFile = path.join(dir, 'log.jsonl');
  let current: FakeAcpScenario = { ...DEFAULT_SCENARIO, ...scenario };
  const write = () => writeFileSync(scenarioFile, JSON.stringify(current));
  write();
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', FAKE_ACP_DIR: dir };

  const log = (): FakeAcpLogEntry[] => {
    let text = '';
    try {
      text = readFileSync(logFile, 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FakeAcpLogEntry);
  };

  return {
    dir,
    locate: async () => (current.installed ? { command, version: current.version, env } : null),
    scenario(patch) {
      current = { ...current, ...patch };
      write();
    },
    log,
    requests(method) {
      return log()
        .filter((e) => e.kind === 'in' && e.msg?.method === method)
        .map((e) => ({ pid: e.pid, params: (e.msg!.params ?? {}) as Record<string, unknown> }));
    },
    permissionAnswers() {
      return log()
        .filter((e) => e.kind === 'in' && !e.msg?.method && (e.msg?.result as { outcome?: unknown } | undefined)?.outcome)
        .map((e) => (e.msg!.result as { outcome: { outcome: string; optionId?: string } }).outcome);
    },
  };
}

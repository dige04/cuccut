import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CodexInstall } from '../codex/codex-binary.ts';
import type { CodexErrorInfo, CodexModel } from '../codex/codex-protocol.ts';

/**
 * Fake codex for tests: one executable that answers `--version`, `login status` and `app-server` (JSON lines over stdio, same shape as `codex-protocol.ts`). It makes no network calls, does not read `~/.codex` (`CODEX_HOME` points to `<dir>/codex-home`), and does not touch the machine's real codex.
 * Every message received is recorded in `log.jsonl`, and tests use it to check a session's parameters (working directory, sandbox, whether MCP servers are present, input) and shutdown.
 *
 * Fetching the model table also starts an app-server. That kind of process (whose first request after initialization is `model/list`) is recorded as `catalog-start` / `catalog-exit` and does not count as a session. Session processes are still recorded as `start` / `exit` (`t` is the process start time).
 *
 * Usage: `createFakeCodex(dir)` gives `locate`, which is passed to `new CodexDriver(log, { locate })`. `scenario()` changes the behavior of the next run.
 */

/** How a turn ends. */
export interface FakeCodexTurn {
  /** How long to wait after the turn starts before writing files and ending (milliseconds). */
  delayMs?: number;
  /** Files to write into the session's working directory: relative path → base64 content. */
  files?: Record<string, string>;
  /** The agent's text reply. */
  reply?: string;
  /** `hang`: never ends until `turn/interrupt` is received. */
  status?: 'completed' | 'failed' | 'hang';
  /** The error description when `failed`. */
  error?: string;
  /** The structured reason in the error when `failed` (`codexErrorInfo`). */
  errorInfo?: CodexErrorInfo;
  /** During the turn, first sends a command approval request (an out-of-bounds network command), and records CucCut's reply. */
  askApproval?: boolean;
  /** `error` notifications sent during the turn (before it ends). */
  errors?: Array<{ message: string; codexErrorInfo?: CodexErrorInfo | null; willRetry: boolean }>;
}

export interface FakeCodexScenario {
  /** false: `locate` returns null (not installed). */
  installed: boolean;
  version: string;
  loggedIn: boolean;
  turn: FakeCodexTurn;
  /** The model table for `model/list` (2 per page, with cursor pagination). `error`: replies -32603. `hang`: never replies. */
  models: CodexModel[] | 'error' | 'hang';
  /**
   * `turn/steer`: `accept` accepts when there is an active turn (when there is none, replies -32600 `no active turn to steer`, same as the real codex);
   * `no-active-turn` always rejects that way; `unsupported` replies -32601; `error` replies -32603 (it is unclear whether the message was delivered).
   */
  steer: 'accept' | 'no-active-turn' | 'unsupported' | 'error';
}

export interface FakeCodexLogEntry {
  t: number;
  pid: number;
  kind: 'login-status' | 'start' | 'in' | 'exit' | 'catalog-start' | 'catalog-exit';
  cwd?: string;
  msg?: { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: unknown };
}

export interface FakeCodex {
  dir: string;
  /** The `CODEX_HOME` given to the fake codex (an empty directory at first); tests write `config.toml` here. */
  codexHome: string;
  locate: () => Promise<CodexInstall | null>;
  scenario(patch: Partial<FakeCodexScenario>): void;
  log(): FakeCodexLogEntry[];
  /** The request parameters of a given method, in arrival order. */
  requests(method: string): Array<{ pid: number; t: number; params: Record<string, unknown> }>;
}

const DEFAULT_SCENARIO: FakeCodexScenario = {
  installed: true,
  version: '0.160.0',
  loggedIn: true,
  turn: { status: 'completed', reply: 'done' },
  models: [
    fakeModel('fake-sol', { isDefault: true, description: 'Balanced workhorse.' }),
    fakeModel('fake-luna', { description: 'Fast and light.' }),
    fakeModel('fake-hidden', { hidden: true }),
  ],
  steer: 'accept',
};

/** A model in `model/list`. Fields that are not given take common values. */
export function fakeModel(id: string, patch: Partial<CodexModel> = {}): CodexModel {
  return {
    id,
    model: id,
    displayName: id.toUpperCase(),
    description: '',
    hidden: false,
    isDefault: false,
    supportedReasoningEfforts: [
      { reasoningEffort: 'low', description: 'Fast' },
      { reasoningEffort: 'medium', description: 'Balanced' },
      { reasoningEffort: 'high', description: 'Deep' },
    ],
    defaultReasoningEffort: 'medium',
    ...patch,
  };
}

const ENTRY = fileURLToPath(new URL('./fake-codex-app-server.ts', import.meta.url));

export async function createFakeCodex(dir: string, scenario: Partial<FakeCodexScenario> = {}): Promise<FakeCodex> {
  await fs.mkdir(dir, { recursive: true });
  const command = path.join(dir, 'codex');
  // The fake codex is a .ts file: Node versions before 22.18 need type stripping turned on explicitly (it is on by default after that, so this flag is harmless). The environment is narrowed, so NODE_OPTIONS cannot be used.
  await fs.writeFile(command, `#!/bin/sh\nexec "${process.execPath}" --experimental-strip-types --no-warnings "${ENTRY}" "$@"\n`, { mode: 0o755 });
  const scenarioFile = path.join(dir, 'scenario.json');
  const logFile = path.join(dir, 'log.jsonl');
  let current: FakeCodexScenario = { ...DEFAULT_SCENARIO, ...scenario };
  const write = () => writeFileSync(scenarioFile, JSON.stringify(current));
  write();
  const codexHome = path.join(dir, 'codex-home');
  await fs.mkdir(codexHome, { recursive: true });
  // Only give the fake codex the environment it needs: PATH (finding node does not rely on it, but the shell does), its own directory, and CODEX_HOME (the Driver reads config.toml from it, and ~/.codex is not touched).
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', FAKE_CODEX_DIR: dir, CODEX_HOME: codexHome };

  const log = (): FakeCodexLogEntry[] => {
    let text = '';
    try {
      text = readFileSync(logFile, 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FakeCodexLogEntry);
  };

  return {
    dir,
    codexHome,
    locate: async () => (current.installed ? { command, version: current.version, env } : null),
    scenario(patch) {
      current = { ...current, ...patch };
      write();
    },
    log,
    requests(method) {
      return log()
        .filter((e) => e.kind === 'in' && e.msg?.method === method && e.msg.id !== undefined)
        .map((e) => ({ pid: e.pid, t: e.t, params: (e.msg!.params ?? {}) as Record<string, unknown> }));
    },
  };
}

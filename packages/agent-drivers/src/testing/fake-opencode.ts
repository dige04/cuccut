import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OpenCodeInstall } from '../opencode/opencode-binary.ts';
import type { OpenCodeModel, OpenCodeProvider } from '../opencode/opencode-models.ts';

/**
 * Fake opencode for tests: one executable that answers `--version` and `serve` (shaped like OpenCode 2.x's v2 HTTP API, see
 * fake-opencode-server.ts). It makes no network calls and does not touch the machine's real opencode. Every request received is recorded in `log.jsonl`.
 *
 * Usage: `createFakeOpenCode(dir)` gives `locate`, which is passed to `new OpenCodeDriver(log, { locate })`. `scenario()` changes the behavior of processes started afterwards (serve reads the scenario at startup).
 */

export interface FakeOpenCodeTool {
  name: string;
  input: Record<string, unknown>;
  /** Before execution, first asks for permission (`permission.asked`) and waits for CucCut's reply. */
  permission?: { action: string; resources: string[]; metadata?: Record<string, unknown> };
  output?: string;
  metadata?: Record<string, unknown>;
}

/** How a turn goes. */
export interface FakeOpenCodeTurn {
  delayMs?: number;
  reasoning?: string;
  tool?: FakeOpenCodeTool;
  reply?: string;
  /** `hang`: never ends until an interrupt is received. */
  end?: 'succeeded' | 'failed' | 'hang';
  error?: string;
  /** The process exits right after execution starts (unexpected exit). */
  crash?: boolean;
}

export interface FakeOpenCodeScenario {
  installed: boolean;
  /** The output of `--version`: 2.x is `opencode v2.0.24`, 1.x is `1.18.34`. */
  versionOutput: string;
  models: OpenCodeModel[];
  defaultModel: string | null;
  providers: OpenCodeProvider[];
  /** Cold start: the first few `/api/plugin` calls return an empty table. */
  coldPluginCalls: number;
  catalog: 'ok' | 'error';
  /** The final state of the registered MCP servers. */
  mcp: 'connected' | 'failed';
  /** Whether the session's instructions entry interface exists. */
  instructions: 'ok' | 'missing';
  turn: FakeOpenCodeTurn;
}

export interface FakeOpenCodeLogEntry {
  t: number;
  pid: number;
  kind: 'start' | 'exit' | 'request' | 'crash';
  cwd?: string;
  method?: string;
  path?: string;
  location?: string | null;
  body?: Record<string, unknown>;
}

export interface FakeOpenCode {
  dir: string;
  command: string;
  locate: () => Promise<OpenCodeInstall | null>;
  scenario(patch: Partial<FakeOpenCodeScenario>): void;
  log(): FakeOpenCodeLogEntry[];
  /** Requests for a given method and path (the session id in the path is written as `:id`), in arrival order. */
  requests(method: string, route: string): FakeOpenCodeLogEntry[];
}

const DEFAULT_SCENARIO: FakeOpenCodeScenario = {
  installed: true,
  versionOutput: 'opencode v2.0.24',
  models: [
    {
      id: 'big-pickle',
      providerID: 'opencode',
      name: 'Big Pickle',
      enabled: true,
      status: 'active',
      capabilities: { input: ['text'] },
      variants: [],
    },
    {
      id: 'fledge-alpha-free',
      providerID: 'opencode',
      name: 'Fledge Alpha Free',
      enabled: true,
      status: 'active',
      capabilities: { input: ['text', 'image'] },
      variants: [{ id: 'low' }, { id: 'high' }, { id: 'max' }],
    },
    { id: 'off', providerID: 'opencode', name: 'Disabled', enabled: false, status: 'active' },
  ],
  defaultModel: 'opencode/fledge-alpha-free',
  providers: [{ id: 'opencode', name: 'OpenCode Zen', activation: 'enabled' }],
  coldPluginCalls: 1,
  catalog: 'ok',
  mcp: 'connected',
  instructions: 'ok',
  turn: { reply: 'done', end: 'succeeded' },
};

const ENTRY = fileURLToPath(new URL('./fake-opencode-server.ts', import.meta.url));

export async function createFakeOpenCode(dir: string, scenario: Partial<FakeOpenCodeScenario> = {}): Promise<FakeOpenCode> {
  await fs.mkdir(dir, { recursive: true });
  const command = path.join(dir, 'opencode');
  // The fake opencode is a .ts file: Node versions before 22.18 need type stripping turned on explicitly (it is on by default after that, so this flag is harmless).
  await fs.writeFile(command, `#!/bin/sh\nexec "${process.execPath}" --experimental-strip-types --no-warnings "${ENTRY}" "$@"\n`, {
    mode: 0o755,
  });
  const scenarioFile = path.join(dir, 'scenario.json');
  const logFile = path.join(dir, 'log.jsonl');
  let current: FakeOpenCodeScenario = { ...DEFAULT_SCENARIO, ...scenario };
  const write = () => writeFileSync(scenarioFile, JSON.stringify(current));
  write();
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', FAKE_OPENCODE_DIR: dir };
  const versionOf = (output: string) => /(\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null;

  const log = (): FakeOpenCodeLogEntry[] => {
    let text = '';
    try {
      text = readFileSync(logFile, 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FakeOpenCodeLogEntry);
  };

  return {
    dir,
    command,
    locate: async () => (current.installed ? { command, version: versionOf(current.versionOutput), env } : null),
    scenario(patch) {
      current = { ...current, ...patch };
      write();
    },
    log,
    requests(method, route) {
      return log().filter(
        (e) =>
          e.kind === 'request' &&
          e.method === method &&
          e.path
            ?.split('/')
            .map((p) => (p.startsWith('ses_') ? ':id' : p))
            .join('/') === route,
      );
    },
  };
}

import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PiInstall } from '../pi/pi-binary.ts';
import type { PiModel } from '../pi/pi-models.ts';

/**
 * Fake `pi --mode rpc` for tests: one executable that answers `--version`. When given `--mode rpc`, it speaks pi's JSON-line protocol over stdio (commands carry an `id`, replies are `type: 'response'`, events have no `id`). The event shapes follow pi 1.0.4's real output: within one prompt, each model call has a pair of turn_start / turn_end, agent_end is followed by agent_settled, edit results carry `details.patch`, and bash results carry `structuredContent`.
 * It makes no network calls and does not touch the machine's real pi. Every command received is recorded in `log.jsonl`.
 *
 * Usage: `createFakePi(dir)` gives `locate`, which is passed to `new PiDriver(log, { locate })`. `scenario()` changes the behavior of the next run (read once when each process starts).
 */

export interface FakePiTool {
  name: string;
  args: Record<string, unknown>;
  /** The `result` of tool_execution_end. */
  result: unknown;
  isError?: boolean;
  /** First sends one tool_execution_update, with partialResult set to this text. */
  partial?: string;
}

/** What pi does in one prompt. */
export interface FakePiTurn {
  thinking?: string;
  /** Each tool gets its own model call (a pair of turn_start / turn_end). */
  tools?: FakePiTool[];
  /** The final text reply (sent in two incremental chunks). */
  reply?: string;
  /** After a bash starts, it never ends until an abort is received. */
  hang?: boolean;
  /** The last assistant message ends with stopReason 'error', with this errorMessage. */
  error?: string;
  /** The prompt directly replies success: false. */
  promptError?: string;
  /** After emitting agent_start and a piece of text, the process exits with code 3. */
  exitMidTurn?: boolean;
  /** First an extension question (confirm) arrives, to see how CucCut answers. */
  ask?: boolean;
}

export interface FakePiScenario {
  installed: boolean;
  version: string;
  /** The result of get_available_models. Empty means there are no usable credentials. */
  models: PiModel[];
  /** The current model in get_state. When null, it gives `{ provider: 'unknown', id: 'unknown' }`, which pi uses when no model is configured. */
  current: { provider: string; id: string } | null;
  /** false: steer and clear_queue reply "Unknown command" (old version). */
  steer: boolean;
  /** false: does not emit agent_settled (old version). */
  settled: boolean;
  /** Exits before get_state (startup failure). */
  crashOnStart: boolean;
  turn: FakePiTurn;
}

export interface FakePiLogEntry {
  t: number;
  pid: number;
  kind: 'start' | 'in' | 'exit';
  cwd?: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  /** The content of the `--extension` file at the time (CucCut deletes it after the process ends). */
  extension?: string;
  instructions?: string;
  msg?: Record<string, unknown>;
}

export interface FakePi {
  dir: string;
  locate: () => Promise<PiInstall | null>;
  scenario(patch: Partial<FakePiScenario>): void;
  log(): FakePiLogEntry[];
  /** One kind of command received, in arrival order. */
  commands(type: string): Array<Record<string, unknown>>;
  /** Session files are kept here (the fake `~/.pi/agent/sessions`). */
  sessionsDir: string;
}

export const FAKE_PI_MODELS: PiModel[] = [
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    reasoning: true,
    input: ['text', 'image'],
    thinkingLevelMap: { xhigh: 'xhigh' },
  },
  { id: 'gpt-mini', name: 'GPT Mini', provider: 'openai', reasoning: false, input: ['text'] },
];

const DEFAULT_SCENARIO: FakePiScenario = {
  installed: true,
  version: '1.0.4',
  models: FAKE_PI_MODELS,
  current: { provider: 'anthropic', id: 'claude-sonnet-5' },
  steer: true,
  settled: true,
  crashOnStart: false,
  turn: { reply: 'done' },
};

const ENTRY = fileURLToPath(new URL('./fake-pi-rpc.ts', import.meta.url));

export async function createFakePi(dir: string, scenario: Partial<FakePiScenario> = {}): Promise<FakePi> {
  await fs.mkdir(dir, { recursive: true });
  const sessionsDir = path.join(dir, 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });
  const command = path.join(dir, 'pi');
  // The fake pi is a .ts file: Node versions before 22.18 need type stripping turned on explicitly. The environment is narrowed, so NODE_OPTIONS cannot be used.
  await fs.writeFile(command, `#!/bin/sh\nexec "${process.execPath}" --experimental-strip-types --no-warnings "${ENTRY}" "$@"\n`, {
    mode: 0o755,
  });
  const scenarioFile = path.join(dir, 'scenario.json');
  const logFile = path.join(dir, 'log.jsonl');
  let current: FakePiScenario = { ...DEFAULT_SCENARIO, ...scenario };
  const write = () => writeFileSync(scenarioFile, JSON.stringify(current));
  write();
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', FAKE_PI_DIR: dir };

  const log = (): FakePiLogEntry[] => {
    let text = '';
    try {
      text = readFileSync(logFile, 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FakePiLogEntry);
  };

  return {
    dir,
    sessionsDir,
    locate: async () => (current.installed ? { command, version: current.version, env } : null),
    scenario(patch) {
      current = { ...current, ...patch };
      write();
    },
    log,
    commands(type) {
      return log()
        .filter((e) => e.kind === 'in' && e.msg?.type === type)
        .map((e) => e.msg!);
    },
  };
}

import { agentEnv } from '@cuccut/agent-drivers';
import { TopicLog, type Logger, type TopicSubscription } from '@cuccut/harness';
import { openSystemTerminal, runShellCommand, type ShellCommandRun, type SystemTerminalResult } from '@cuccut/process-host';
import {
  AGENT_SETUP_OUTPUT_LINES,
  RpcError,
  newId,
  nowIso,
  type AgentSetupAction,
  type AgentSetupEvent,
  type AgentSetupRun,
  type AgentSetupSnapshot,
  type AgentsView,
  type DriverId,
  type DriverInfo,
  type DriverInstallOption,
  type Id,
  type RpcParams,
  type RpcResult,
  type Seq,
  type SequencedEvent,
} from '@cuccut/protocol';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';

/**
 * Install, upgrade and login actions for Agents (architecture design §12.9, “Install actions”):
 *
 * - **Commands come only from the probe results.** The client says only which Agent, what to do, and which method. The Runtime finds `install[].command` / `upgrade` / `loginCommand` in the current `agents.list`, and returns `invalid-request` if it finds nothing. The Renderer is only semi-trusted.
 * - **In-app runs** (`agents.runSetup`) accept only commands such as brew and npm. `script`-kind commands (downloading a script from the network and handing it to the shell) are rejected; they can only be copied, or run by the user in the system terminal. stdin is closed and there is no controlling terminal, so anything that asks for a password fails directly, and the UI tells the user to run it in a terminal. CucCut does not elevate privileges. The UI handles per-run user confirmation (the confirmation shows the full command).
 * - **Output** merges stdout and stderr and is delivered line by line over the `agent-setup` topic (in batches of about 100 milliseconds). Only the last `AGENT_SETUP_OUTPUT_LINES` lines are kept. When the run ends, the whole output is written to the log, together with the command, exit code and duration.
 * - **After the run, re-probe** (the same as `agents.detect { driverId }`: force a probe of this Agent), then send the terminal state. The probe result is pushed over the `agents` topic, so when the UI receives the terminal state and reads `agents.list`, it gets the new result.
 * - **System terminal** (`agents.openTerminal`): login, `script`-kind installs, and anything that needs administrator privileges are handed to the user's own terminal.
 *
 * Not made into a Job: JobRecord has no output lines, its required fields are semantics computed by the model, and it would be persisted in the ledger and appear in `jobs.list` and the agent's task tools.
 * Run records are kept in memory only, and the last `keepRuns` runs are kept.
 *
 * Permissions: in 0.1 the gateway's principal is used only for logging (see handlers.ts), and it is not restricted by connection type here either. The defences are: commands come only from probe results, `script`-kind commands do not run in the app, and stdin is closed.
 */

/** A command that downloads a script from the network and hands it to the shell. It is not run in the app, even if the probe result labels it as another category. */
const PIPES_TO_SHELL = /\|\s*(ba|z)?sh\b/;

export interface AgentSetupOptions {
  /** The current Agent list (`Harness.agents`). When `fresh`, forces a re-probe (if `driverId` is given, only that one is probed). */
  agents: (options?: { fresh?: boolean; driverId?: DriverId }) => Promise<AgentsView>;
  log: Logger;
  /** Environment for in-app runs (default `agentEnv()`: the login shell's environment, with the host Claude Code session's variables removed). */
  env?: () => Promise<NodeJS.ProcessEnv>;
  /** Opens the system terminal (default `openSystemTerminal`). Tests inject a fake, so no terminal actually opens. */
  openTerminal?: (command: string) => Promise<SystemTerminalResult>;
  /** How many run records to keep in memory (default 20). Runs still in progress are not counted and are never dropped. */
  keepRuns?: number;
  /** How long output is accumulated before a batch is sent (default 100 milliseconds). */
  flushMs?: number;
}

interface Entry {
  run: AgentSetupRun;
  process: ShellCommandRun | null;
  pending: string[];
  flushTimer: NodeJS.Timeout | null;
  /** Resolves only after the process ends, the re-probe finishes, and the terminal state is sent. */
  done: Promise<void>;
  cancelRequested: boolean;
}

export class AgentSetup {
  readonly topic: TopicLog<AgentSetupSnapshot, AgentSetupEvent>;
  readonly #agents: AgentSetupOptions['agents'];
  readonly #log: Logger;
  readonly #env: () => Promise<NodeJS.ProcessEnv>;
  readonly #openTerminal: (command: string) => Promise<SystemTerminalResult>;
  readonly #keepRuns: number;
  readonly #flushMs: number;
  /** Insertion order is start order; snapshots reverse it so the newest comes first. */
  readonly #runs = new Map<Id, Entry>();
  readonly #byCommand = new Map<Id, Promise<{ run: AgentSetupRun }>>();
  #closing = false;

  constructor(options: AgentSetupOptions) {
    this.#agents = options.agents;
    this.#log = options.log.child('agent-setup');
    this.#env = options.env ?? agentEnv;
    this.#openTerminal = options.openTerminal ?? ((command) => openSystemTerminal(command));
    this.#keepRuns = options.keepRuns ?? 20;
    this.#flushMs = options.flushMs ?? 100;
    this.topic = new TopicLog(() => ({ runs: [...this.#runs.values()].reverse().map((entry) => copyRun(entry.run)) }), '0');
  }

  subscribe(afterSeq: Seq | undefined, listener: (event: SequencedEvent<AgentSetupEvent>) => void): TopicSubscription<AgentSetupSnapshot, AgentSetupEvent> {
    return this.topic.subscribe(afterSeq, listener);
  }

  /** `agents.runSetup`. The same `commandId` returns the same run (its current state). */
  run(params: RpcParams<'agents.runSetup'>): Promise<RpcResult<'agents.runSetup'>> {
    const known = this.#byCommand.get(params.commandId);
    if (known) return known.then(({ run }) => ({ run: copyRun(this.#runs.get(run.runId)?.run ?? run) }));
    const started = this.#start(params);
    this.#byCommand.set(params.commandId, started);
    // A rejected request does not take this commandId, so it can be retried with changed parameters.
    started.catch(() => this.#byCommand.delete(params.commandId));
    return started;
  }

  /** `agents.cancelSetup`. Parts already done are not rolled back. */
  cancel(runId: Id): RpcResult<'agents.cancelSetup'> {
    const entry = this.#runs.get(runId);
    if (!entry) throw new RpcError('not-found', RcRuntime.noSuchRun({ runId }));
    if (entry.run.state !== 'running' || !entry.process) return { status: 'not-running' };
    entry.cancelRequested = true;
    entry.process.cancel();
    return { status: 'requested' };
  }

  /** `agents.openTerminal`。 */
  async openTerminal(params: RpcParams<'agents.openTerminal'>): Promise<RpcResult<'agents.openTerminal'>> {
    const driver = await this.#driver(params.driverId);
    let command: string;
    if (params.action === 'login') {
      if (!driver.loginCommand) throw new RpcError('invalid-request', RcRuntime.noLoginCommand({ agent: driver.name }));
      command = driver.loginCommand;
    } else {
      if (!params.kind) throw new RpcError('invalid-request', RcRuntime.installKindRequired());
      command = commandOf(driver, params.action, params.kind);
    }
    const result = await this.#openTerminal(command).catch((error: unknown) => ({ status: 'unsupported' as const, detail: String(error) }));
    if (result.status === 'opened') this.#log.info('Opened the command in the system terminal', { driverId: driver.id, action: params.action, kind: params.kind ?? null, command });
    else this.#log.warn('Could not open the system terminal', { driverId: driver.id, action: params.action, command, detail: result.detail });
    return { status: result.status, command };
  }

  /** Runtime stop: ends the commands still running and waits for them to wrap up (no re-probe). */
  async shutdown(): Promise<void> {
    this.#closing = true;
    const running = [...this.#runs.values()].filter((entry) => entry.run.state === 'running');
    for (const entry of running) {
      entry.cancelRequested = true;
      entry.process?.cancel();
    }
    await Promise.race([Promise.all(running.map((entry) => entry.done)), new Promise((resolve) => setTimeout(resolve, 5000).unref?.())]);
  }

  async #driver(driverId: DriverId): Promise<DriverInfo> {
    const view = await this.#agents();
    const driver = view.drivers.find((candidate) => candidate.id === driverId);
    if (!driver) throw new RpcError('driver-unavailable', RcRuntime.driverNotRegistered({ driverId }));
    return driver;
  }

  async #start(params: RpcParams<'agents.runSetup'>): Promise<{ run: AgentSetupRun }> {
    if (this.#closing) throw new RpcError('busy', RcRuntime.runtimeStopping());
    const driver = await this.#driver(params.driverId);
    const command = commandOf(driver, params.action, params.kind);
    if (params.kind === 'script' || PIPES_TO_SHELL.test(command)) {
      throw new RpcError('invalid-request', RcRuntime.scriptNotRun());
    }
    const env = await this.#env();
    // The check and the registration are in the same synchronous section, so two concurrent requests cannot both pass.
    if (this.#closing) throw new RpcError('busy', RcRuntime.runtimeStopping());
    for (const entry of this.#runs.values()) {
      if (entry.run.driverId === driver.id && entry.run.state === 'running') {
        throw new RpcError('busy', RcRuntime.commandAlreadyRunning({ agent: driver.name }), { runId: entry.run.runId });
      }
    }

    const run: AgentSetupRun = {
      runId: newId('setup'),
      driverId: driver.id,
      action: params.action,
      kind: params.kind,
      command,
      state: 'running',
      exitCode: null,
      output: [],
      droppedLines: 0,
      startedAt: nowIso(),
      endedAt: null,
      error: null,
    };
    const startedAt = Date.now();
    let resolveDone!: () => void;
    const entry: Entry = { run, process: null, pending: [], flushTimer: null, done: new Promise((resolve) => (resolveDone = resolve)), cancelRequested: false };
    this.#runs.set(run.runId, entry);
    this.#prune();
    this.topic.publish({ type: 'setup.updated', run: copyRun(run) });
    this.#log.info('Running the agent setup command', { runId: run.runId, driverId: run.driverId, action: run.action, kind: run.kind, command });

    entry.process = runShellCommand({ command, env, onLines: (lines) => this.#queue(entry, lines) });
    void entry.process.exited.then(async (exit) => {
      this.#flush(entry);
      // The re-probe comes before the terminal state: when the UI receives the terminal state and reads `agents.list`, the result is new. The Runtime does not probe when it is stopping.
      if (!this.#closing) {
        await this.#agents({ fresh: true, driverId: run.driverId }).catch((error: unknown) => this.#log.warn('Re-detecting agents after the run failed', { runId: run.runId, error: String(error) }));
      }
      run.exitCode = exit.code;
      run.error = exit.error;
      run.state = entry.cancelRequested || exit.cancelled ? 'cancelled' : exit.error === null && exit.code === 0 ? 'completed' : 'failed';
      run.endedAt = nowIso();
      entry.process = null;
      this.topic.publish({ type: 'setup.updated', run: copyRun(run) });
      const fields = {
        runId: run.runId,
        driverId: run.driverId,
        action: run.action,
        command,
        state: run.state,
        exitCode: exit.code,
        signal: exit.signal,
        durationMs: Date.now() - startedAt,
        error: exit.error,
        droppedLines: run.droppedLines,
        output: run.output.join('\n'),
      };
      if (run.state === 'completed') this.#log.info('Agent setup command finished', fields);
      else this.#log.warn('Agent setup command did not succeed', fields);
      this.#prune();
      resolveDone();
    });
    return { run: copyRun(run) };
  }

  #queue(entry: Entry, lines: string[]): void {
    entry.pending.push(...lines);
    // Accumulated output is capped too, so a flood of output does not pile up in memory.
    if (entry.pending.length > AGENT_SETUP_OUTPUT_LINES) {
      const dropped = entry.pending.length - AGENT_SETUP_OUTPUT_LINES;
      entry.pending.splice(0, dropped);
      entry.run.droppedLines += dropped;
    }
    entry.flushTimer ??= setTimeout(() => this.#flush(entry), this.#flushMs);
  }

  /** Merges the accumulated lines into the record and sends them. This is in the same synchronous section, so the snapshot and later events share one watermark. */
  #flush(entry: Entry): void {
    if (entry.flushTimer) clearTimeout(entry.flushTimer);
    entry.flushTimer = null;
    if (!entry.pending.length) return;
    const lines = entry.pending;
    entry.pending = [];
    const output = entry.run.output;
    output.push(...lines);
    if (output.length > AGENT_SETUP_OUTPUT_LINES) {
      const dropped = output.length - AGENT_SETUP_OUTPUT_LINES;
      output.splice(0, dropped);
      entry.run.droppedLines += dropped;
    }
    this.topic.publish({ type: 'setup.output', runId: entry.run.runId, lines });
  }

  /** Keeps only the last `keepRuns` finished records. */
  #prune(): void {
    const finished = [...this.#runs.values()].filter((entry) => entry.run.state !== 'running');
    const excess = this.#runs.size - this.#keepRuns;
    for (const entry of finished.slice(0, Math.max(0, excess))) this.#runs.delete(entry.run.runId);
  }
}

/** The install or upgrade command for this Agent and method in the probe result. If there is none, `invalid-request`. */
function commandOf(driver: DriverInfo, action: AgentSetupAction, kind: DriverInstallOption['kind']): string {
  const option = driver.install.find((candidate) => candidate.kind === kind);
  if (!option) throw new RpcError('invalid-request', RcRuntime.noInstallKind({ agent: driver.name, kind }));
  const command = action === 'install' ? option.command : option.upgrade;
  if (!command.trim() || /[\r\n\0]/.test(command)) throw new RpcError('invalid-request', RcRuntime.commandNotRunnable({ agent: driver.name }));
  return command;
}

function copyRun(run: AgentSetupRun): AgentSetupRun {
  return { ...run, output: [...run.output] };
}

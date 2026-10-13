import { RpcError } from '@cuccut/protocol';
import { M } from '../cli-copy.ts';
import { CliError, EXIT, type ExitCode, type Output } from '../envelope.ts';
import { ensureRuntime, findRuntime, isProcessAlive, openClient } from './connection.ts';

/**
 * `cuccut runtime ensure|status|stop` (Agent-facing design §5.6; architecture design §2.2).
 *
 * - `ensure`: finds the running one (`reused`) or starts one (`started`).
 * - `status`: process, port, version, who started it, connection counts (excluding this command itself), tasks and external services, idle exit; `running: false` when it is not running.
 * - `stop`: stops only the one the CLI started; while the desktop app, another CLI or unfinished tasks are still using it, the Runtime refuses with `RUNTIME_IN_USE` (exit code 1).
 */
export async function runtimeCommand(output: Output, home: string, args: readonly string[], noStart: boolean): Promise<ExitCode> {
  const [action, ...extra] = args;
  if (extra.length > 0 || !['ensure', 'status', 'stop'].includes(action ?? '')) {
    throw new CliError('INVALID_ARGUMENTS', M.runtimeUsage);
  }
  if (action === 'ensure') {
    const { discovery, started } = await ensureRuntime(home, { start: !noStart });
    const { client, info } = await openClient(discovery);
    client.close();
    if (started) output.runtimeStarted = true;
    return output.success({
      status: started ? 'started' : 'reused',
      pid: info.pid,
      endpoint: discovery.endpoint,
      version: info.runtimeVersion,
      launchedBy: info.launchedBy,
      home: info.home,
    });
  }

  const discovery = findRuntime(home);
  if (!discovery) {
    return action === 'stop'
      ? output.success({ stopped: false, running: false, home })
      : output.success({ running: false, home }, 'cuccut runtime ensure');
  }
  // The status query returns only structured fields and does not read the language preference, so that settings.get does not reset the idle timer.
  const { client, info } = await openClient(discovery, { readLanguage: action !== 'status' });
  try {
    if (action === 'status') {
      const state = await client.request('runtime.status', {});
      const port = Number(new URL(discovery.endpoint).port);
      return output.success({
        running: true,
        pid: info.pid,
        endpoint: discovery.endpoint,
        port,
        version: info.runtimeVersion,
        home: info.home,
        startedAt: info.startedAt,
        launchedBy: info.launchedBy,
        desktopConnected: state.connections.desktop > 0,
        // This command is itself a CLI connection, and is not counted.
        connections: { ...state.connections, cli: Math.max(0, state.connections.cli - 1) },
        activeJobs: state.activeJobs,
        runningServices: state.runningServices,
        idleExit: state.idleExit,
      });
    }
    try {
      await client.request('runtime.stop', {});
    } catch (error) {
      if (error instanceof RpcError) {
        const details = (typeof error.details === 'object' && error.details !== null ? error.details : {}) as Record<string, unknown>;
        const code = typeof details.code === 'string' ? details.code : 'RUNTIME_STOP_REFUSED';
        return output.failure({ ...details, code, message: error.message }, EXIT.failed);
      }
      throw error;
    }
    client.close();
    const gone = await waitForExit(info.pid, 20_000);
    return output.success({ stopped: gone, pid: info.pid });
  } finally {
    client.close();
  }
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !isProcessAlive(pid);
}

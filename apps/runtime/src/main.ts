import { parseArgs } from 'node:util';
import { RuntimeAlreadyRunningError, runtimeSelfCheck, startRuntime } from '@cuccut/runtime-core';

/**
 * The credential backend that can be injected at build time (`file` | `keychain`, architecture design §6.8). When nothing is injected it is `file`;
 * the desktop release build specifies it with the hidden parameter `--credential-store keychain`. This is not a user setting.
 */
declare const __CUCCUT_CREDENTIAL_STORE__: string | undefined;
const BUILT_CREDENTIAL_STORE = typeof __CUCCUT_CREDENTIAL_STORE__ === 'string' ? __CUCCUT_CREDENTIAL_STORE__ : 'file';

function credentialStoreKind(value: string): 'file' | 'keychain' {
  if (value === 'file' || value === 'keychain') return value;
  throw new Error(`Unknown credential store: ${value}`);
}

/**
 * The Runtime process entry point. The desktop app starts it with Electron's bundled Node (ELECTRON_RUN_AS_NODE);
 * in development it can also be run directly with `npm run runtime`.
 *
 * Once ready, it writes one line `{"type":"ready",...}` to stdout. The token does not go through stdout; the client reads it from the discovery file.
 *
 * `--launched-by cli --idle-exit`: passed when the CLI launches it automatically (architecture design §2.2). `--launched-by` is recorded in the discovery file (`cuccut runtime stop` only stops the ones the CLI launched);
 * `--idle-exit` makes the Runtime exit by itself once there have been no connections, no tasks, and no open external services for the configured `runtime.idleExitMinutes`. The desktop app does not pass these.
 *
 * `--self-check [--probe]` does not start the Runtime: it reports where the native programs and data shipped with the app resolve to (`runtimeSelfCheck`), writes one line of JSON,
 * and exits with code 1 if there is a problem. The packaged-app check (`apps/desktop/tools/check-packaged-app.mjs`) uses it.
 */
async function main(): Promise<void> {
  // stdout carries only the ready message. If the end reading it (the desktop main process) is gone, the message cannot be delivered, so a write failure (EPIPE) must not become an uncaught exception. Echoes on stderr are handled by the logger itself (`createFileLogger`).
  process.stdout.on('error', () => {});
  const { values } = parseArgs({
    options: {
      host: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: '0' },
      'allow-origin': { type: 'string', multiple: true },
      quiet: { type: 'boolean', default: false },
      'credential-store': { type: 'string', default: BUILT_CREDENTIAL_STORE },
      'self-check': { type: 'boolean', default: false },
      probe: { type: 'boolean', default: false },
      'launched-by': { type: 'string' },
      'idle-exit': { type: 'boolean', default: false },
    },
  });
  const launchedBy = values['launched-by'];
  if (launchedBy !== undefined && launchedBy !== 'cli') throw new Error(`Unknown --launched-by: ${launchedBy}`);

  if (values['self-check']) {
    const report = await runtimeSelfCheck({ probe: values.probe });
    // Do not call exit directly: output already written to the pipe must be sent out first.
    process.exitCode = report.problems.length > 0 ? 1 : 0;
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }

  const allowedOrigins = [
    ...(values['allow-origin'] ?? []),
    ...(process.env.CUCCUT_ALLOWED_ORIGINS?.split(',').filter(Boolean) ?? []),
  ];

  let runtime: Awaited<ReturnType<typeof startRuntime>>;
  // Idle exit can only trigger after the Runtime has started, because by then `stop` has been defined.
  let onIdle = () => {};
  let onStopRequest = () => {};
  try {
    runtime = await startRuntime({
      host: values.host,
      port: Number(values.port),
      allowedOrigins,
      echoLogs: !values.quiet,
      credentials: credentialStoreKind(values['credential-store']),
      launchedBy: launchedBy ?? null,
      idleExit: values['idle-exit'] ? { onIdle: () => onIdle() } : null,
      requestStop: () => onStopRequest(),
    });
  } catch (error) {
    if (error instanceof RuntimeAlreadyRunningError) {
      process.stdout.write(`${JSON.stringify({ type: 'already-running', pid: error.pid, endpoint: error.discovery?.endpoint ?? null })}\n`);
      process.exit(3);
    }
    throw error;
  }

  const { info, discovery } = runtime;
  process.stdout.write(
    `${JSON.stringify({ type: 'ready', instanceId: info.instanceId, endpoint: discovery.endpoint, home: info.home, pid: info.pid })}\n`,
  );

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    runtime.log.info('Received stop signal', { signal });
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    void runtime.close().then(() => process.exit(0));
  };
  onIdle = () => stop('idle');
  onStopRequest = () => stop('runtime.stop');
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  // The terminal was closed (when running directly in a terminal): shut down as usual. If this were not handled, the default action would be an immediate exit, with no time to shut down in stop order or delete the discovery file.
  process.on('SIGHUP', () => stop('SIGHUP'));
  // When the parent process starts it with an IPC channel (the desktop app), the parent asks the Runtime to stop by sending `{ type: 'stop' }` over the channel: on Windows SIGTERM is the same as killing the process outright and cannot be handled.
  // A closed channel (the parent exited or crashed) does not stop it: the Runtime stays running, and the next start finds it again through the discovery file (architecture design §2.2).
  process.on('message', (message) => {
    if ((message as { type?: unknown } | null)?.type === 'stop') stop('ipc');
  });
  process.on('uncaughtException', (error) => {
    runtime.log.error('Uncaught exception', { error: error.stack ?? String(error) });
  });
  process.on('unhandledRejection', (reason) => {
    runtime.log.error('Unhandled promise rejection', { error: String(reason) });
  });
}

main().catch((error) => {
  process.stderr.write(`Runtime failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});

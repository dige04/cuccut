import fs from 'node:fs';
import path from 'node:path';
import type { Writable } from 'node:stream';
import type { Logger } from '@cuccut/harness';

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface FileLoggerOptions {
  file: string;
  /** Also writes to stderr (for development). If that cannot be written (EIO when the terminal has closed, EPIPE when the pipe is broken), echo stops and only the file is written. */
  echo?: boolean;
  /** Where echoed output is written. Defaults to `process.stderr`. Tests inject their own. */
  echoStream?: Writable;
  level?: Level;
}

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface ClosableLogger extends Logger {
  close(): Promise<void>;
}

/** One JSON object per line, written under `logs/` in the Runtime Home (architecture design §12.6). */
export function createFileLogger(options: FileLoggerOptions): ClosableLogger {
  fs.mkdirSync(path.dirname(options.file), { recursive: true });
  const stream = fs.createWriteStream(options.file, { flags: 'a', mode: 0o600 });
  const min = ORDER[options.level ?? 'info'];

  const line = (level: Level, scope: string, message: string, fields?: Record<string, unknown>) =>
    `${JSON.stringify({ t: new Date().toISOString(), level, scope, message, ...fields })}\n`;

  // Echo write failures are reported asynchronously: the callback runs first, then 'error' is emitted on the stream. An unhandled 'error' becomes an uncaught exception, which the Runtime entry records in the log. The log echoes again, fails again, and that becomes an endless loop that fills the disk. So the error is caught here, and on the first failure echo stops (this stream is not written to again).
  const echoStream = options.echo ? (options.echoStream ?? process.stderr) : null;
  let echoing = echoStream !== null;
  const stopEcho = (error: unknown) => {
    if (!echoing) return;
    echoing = false;
    const code = (error as NodeJS.ErrnoException | null)?.code ?? String(error);
    stream.write(line('warn', 'runtime', 'Log echo stopped: stderr is not writable', { code }));
  };
  echoStream?.on('error', stopEcho);

  const write = (scope: string, level: Level, message: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < min) return;
    stream.write(line(level, scope, message, fields));
    if (!echoing) return;
    try {
      echoStream!.write(`[${level}] ${scope}: ${message}${fields ? ` ${JSON.stringify(fields)}` : ''}\n`, (error) => {
        if (error) stopEcho(error);
      });
    } catch (error) {
      stopEcho(error);
    }
  };

  const make = (scope: string): Logger => ({
    debug: (m, f) => write(scope, 'debug', m, f),
    info: (m, f) => write(scope, 'info', m, f),
    warn: (m, f) => write(scope, 'warn', m, f),
    error: (m, f) => write(scope, 'error', m, f),
    child: (sub) => make(`${scope}.${sub}`),
  });

  return {
    ...make('runtime'),
    close: () =>
      new Promise((resolve) => {
        echoing = false;
        echoStream?.off('error', stopEcho);
        stream.end(resolve);
      }),
  };
}

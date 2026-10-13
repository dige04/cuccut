import path from 'node:path';
import readline from 'node:readline/promises';
import type { ParseArgsOptionsConfig, parseArgs } from 'node:util';
import type { CucCutClient } from '@cuccut/client';
import type { CatalogToolError, JobRecord } from '@cuccut/protocol';
import { ProgressReporter } from '../catalog/progress.ts';
import { M as CLI } from '../cli-copy.ts';
import { CliError, EXIT, exitCodeForJob, type ExitCode, type Output } from '../envelope.ts';
import { waitForJob, watchJobs } from '../job-wait.ts';

/**
 * Common parts of the admin bucket (Agent-surface design §7): one file per noun (`admin/<noun>.ts`), each declaring its flags and usage, sharing the context here,
 * the §5.1 envelope and the §5.2 exit codes. Hand-written formats (`*-output.ts`) are used only for people to read. `--json` (the default when stdout is not a TTY) writes the raw result of the protocol method.
 */

/** Flags that every noun accepts. */
export const COMMON_OPTIONS = {
  json: { type: 'boolean' },
  'no-json': { type: 'boolean' },
  'no-start': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const satisfies ParseArgsOptionsConfig;

export type AdminValues<O extends ParseArgsOptionsConfig> = ReturnType<
  typeof parseArgs<{ options: O & typeof COMMON_OPTIONS; allowPositionals: true; strict: true }>
>['values'];

export interface AdminNoun<O extends ParseArgsOptionsConfig = ParseArgsOptionsConfig> {
  name: string;
  /** Nouns named the same as a directory (`models`, `jobs`, `space`, `library`, `skills`) accept only these subcommands; the rest go to derived commands. */
  verbs?: readonly string[];
  partial?: true;
  /** Subcommands that do not connect to the Runtime (`skill path`): `ctx.client` is not available. */
  offline?: readonly string[];
  /** The body of `cuccut <noun> --help` and `cuccut help <noun>`. */
  usage: string;
  options: O;
  run(ctx: AdminRun<AdminValues<O>>): Promise<ExitCode>;
}

/** Declares a noun (keeps the literal type of its flags). */
export function defineNoun<const O extends ParseArgsOptionsConfig>(noun: AdminNoun<O>): AdminNoun<O> {
  return noun;
}

export interface FollowOptions {
  /** On completion: writes the result and returns the exit code. */
  complete: (job: JobRecord) => Promise<ExitCode> | ExitCode;
  /** On failure, cancellation or interruption: adds an explanation (written to stderr), then writes the failure envelope. */
  stopped?: (job: JobRecord) => void;
  /** Only accepts records from after the Nth attempt. */
  minAttempt?: number;
  onUpdate?: (job: JobRecord) => void;
}

export class AdminRun<V> {
  readonly #client: CucCutClient | null;
  readonly output: Output;
  readonly cwd: string;
  /** Runtime Home（`CUCCUT_HOME`）。 */
  readonly home: string;
  readonly env: NodeJS.ProcessEnv;
  /** Positional arguments after the noun. */
  readonly args: string[];
  readonly values: V;
  readonly usage: string;

  constructor(init: {
    client: CucCutClient | null;
    output: Output;
    cwd: string;
    home?: string;
    env?: NodeJS.ProcessEnv;
    args: string[];
    values: V;
    usage: string;
  }) {
    this.#client = init.client;
    this.output = init.output;
    this.cwd = init.cwd;
    this.home = init.home ?? '';
    this.env = init.env ?? process.env;
    this.args = init.args;
    this.values = init.values;
    this.usage = init.usage;
  }

  /** The connection to the Runtime. Not present in subcommands the noun declares as `offline`. */
  get client(): CucCutClient {
    if (!this.#client) throw new Error(CLI.noRuntimeClient);
    return this.#client;
  }

  /** On success: with `--json`, the envelope of the raw result. For people to read, prints these lines. */
  done(result: unknown, lines: readonly string[], next?: string | null): ExitCode {
    return this.output.report(result, lines, next);
  }

  /** No error was thrown, but this command did not get done (the approval was already handled, the service did not start, etc.): failure envelope. */
  fail(error: CatalogToolError, exitCode?: ExitCode): ExitCode {
    return this.output.failure(error, exitCode);
  }

  /** Progress notes for people, written to stderr (does not touch stdout's JSON). */
  log(line: string): void {
    this.output.stderr.write(`${line}\n`);
  }

  /** Usage error (exit code 4). */
  usageError(message: string = this.usage): CliError {
    return new CliError('INVALID_ARGUMENTS', message);
  }

  /** Runs an argument parse. Plain errors thrown by the parse functions in `*-output.ts` are all usage errors. */
  parse<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof CliError) throw error;
      throw this.usageError(error instanceof Error ? error.message : String(error));
    }
  }

  /** Relative paths are resolved against the working directory. */
  resolve(file: string): string {
    return path.resolve(this.cwd, file);
  }

  /**
   * Actions that need the user's consent (downloads, running update commands): `--yes` consents directly. In a terminal it asks once. When not in a terminal and `--yes` is not given, it refuses with
   * `CONFIRMATION_REQUIRED` (exit code 4). It never consents by default.
   */
  async confirm(question: string, yes: boolean | undefined, refusal: string): Promise<boolean> {
    if (yes) return true;
    if (!process.stdin.isTTY) throw new CliError('CONFIRMATION_REQUIRED', refusal);
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = (await rl.question(question)).trim().toLowerCase();
      return answer === 'y' || answer === 'yes';
    } finally {
      rl.close();
    }
  }

  /** Submits a task and follows it to its final state. Progress is written to stderr, completion is handed to `complete`, and failure is written as a failure envelope (the exit code follows the task's error code). */
  async follow(submit: () => Promise<{ jobId: string }>, options: FollowOptions): Promise<ExitCode> {
    const watcher = watchJobs(this.client);
    let jobId: string;
    try {
      ({ jobId } = await submit());
    } catch (error) {
      watcher.close();
      throw error;
    }
    const progress = new ProgressReporter('text', this.output.stderr);
    const outcome = await waitForJob(this.client, jobId, watcher, {
      progress,
      ...(options.minAttempt !== undefined ? { minAttempt: options.minAttempt } : {}),
      ...(options.onUpdate ? { onUpdate: options.onUpdate } : {}),
    });
    const job = outcome.job!;
    if (job.state === 'completed') return options.complete(job);
    options.stopped?.(job);
    const code = job.error?.code ?? (job.state === 'cancelled' ? 'JOB_CANCELLED' : 'JOB_FAILED');
    return this.output.failure(
      {
        code,
        message: job.error?.message ?? job.state,
        jobId: job.jobId,
        state: job.state,
        ...(job.error?.details !== undefined && job.error.details !== null ? { details: job.error.details } : {}),
      },
      exitCodeForJob(code),
    );
  }
}

/** Reads all of standard input. */
export async function readStdin(prompt: string | null): Promise<string> {
  if (process.stdin.isTTY && prompt) process.stderr.write(`${prompt}\n`);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString('utf8');
}

export { EXIT };

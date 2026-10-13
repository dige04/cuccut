import fs from 'node:fs';
import path from 'node:path';
import { localizeText, type CatalogToolError, type JobRecord, type ModelInstallResult } from '@cuccut/protocol';
import { formatBytes } from '../admin/models-output.ts';
import { M } from '../cli-copy.ts';
import { CliError, EXIT, exitCodeForJob, isRecord, type ExitCode, type Output } from '../envelope.ts';
import type { Session } from '../runtime/connection.ts';
import { summaryOf, type CatalogCommand } from './command-tree.ts';
import { kebab, projectDirectory, type GlobalFlags } from './flags.ts';
import { ProgressReporter } from './progress.ts';
import { waitForJob, watchJobs, type JobWatcher } from '../job-wait.ts';

/**
 * Runs one derived command (agent-surface design §5): `catalog.call` → envelope.
 *
 * - `destructive` without `--yes`: not called; explains what would happen, exit code 4 (§3.3; there is no interactive confirmation, confirmation is the host's job).
 * - `models install` without `--yes`: reports the size first and does not download (§4.3), also exit code 4; if it is already installed or downloading, the tool is called as usual (it will not download again).
 * - `job`: by default waits until a terminal state (subscribes to the `jobs` topic, does not poll `jobs_wait`); the result is the submission result plus `job` (the record from `jobs_inspect`) and `outputs`; `--no-wait` returns `jobId` directly; when `--timeout` is reached, gives `jobId` and the latest progress, exit code 1, and the task continues; Ctrl-C cancels the task.
 *   `jobs retry` only recognizes records after this rerun (the result's `attempt`).
 * - `jobs wait`: does not call `jobs_wait` (which returns after waiting a while); takes the same path as the default wait, with the exit code according to the terminal state.
 * - If the result exceeds `--max-bytes` (default 64 KiB) or `--result-file` is given: the full result is written to a file, and stdout gets only the coverage, the path and `truncated: true` (§5.5).
 */
export interface RunContext {
  session: Session;
  command: CatalogCommand;
  args: Record<string, unknown>;
  globals: GlobalFlags;
  /** Working directory (realpath). */
  cwd: string;
  output: Output;
  now?: () => Date;
}

export async function runTool(ctx: RunContext): Promise<ExitCode> {
  const { command, args, globals, output, cwd } = ctx;
  const { tool } = command;
  if (tool.effect === 'destructive' && !globals.yes) {
    return output.failure({
      code: 'CONFIRMATION_REQUIRED',
      message: M.confirmationRequired(command.display, summaryOf(tool.description)),
      tool: tool.name,
      args,
      next: M.confirmationNext(command.display),
    });
  }
  if (tool.name === 'models_install' && !globals.yes) {
    const refused = await installGate(ctx);
    if (refused !== null) return refused;
  }
  if (tool.name === 'jobs_wait') return waitCommand(ctx);

  let project: string | null = null;
  if (globals.project !== undefined) {
    project = projectDirectory(globals.project, cwd);
    const hasField = isRecord(tool.inputSchema.properties) && 'project' in tool.inputSchema.properties;
    if (!project && !hasField) throw new CliError('INVALID_ARGUMENTS', M.projectNotDirectory(globals.project));
  }

  // Subscribe first, then submit: no change after submission is missed.
  const watcher = tool.effect === 'job' && (globals.wait ?? true) ? watchJobs(ctx.session.client) : null;
  let call;
  try {
    call = await request(ctx, () =>
      ctx.session.client.request('catalog.call', { name: tool.name, args, cwd, ...(project ? { project } : {}) }),
    );
  } catch (error) {
    watcher?.close();
    throw error;
  }
  if (!call.ok) {
    watcher?.close();
    return output.failure(call.error);
  }
  const result = isRecord(call.result) ? call.result : null;
  const jobId = result && typeof result.jobId === 'string' ? result.jobId : null;
  if (watcher && result && jobId) {
    // A rerun (`jobs retry`) reuses the same jobId: the terminal state of the previous run does not count.
    const minAttempt = typeof result.attempt === 'number' ? result.attempt : undefined;
    return waitAndReport(ctx, result, jobId, watcher, { minAttempt });
  }
  watcher?.close();
  return finish(ctx, call.result);
}

/**
 * Confirmation for `models install` (§4.3): without `--yes`, only the install plan is fetched (the gateway's `models.install` without `confirmBytes` does not download); it reports the package name,
 * size and source, and exits with code 4. It returns null when the model is already installed or this model package is downloading: the tool is called as usual, and it will not download again.
 */
async function installGate(ctx: RunContext): Promise<ExitCode | null> {
  const bundleId = typeof ctx.args.bundleId === 'string' ? ctx.args.bundleId : defaultTranscribeBundle();
  const planned: ModelInstallResult = await request(ctx, () => ctx.session.client.request('models.install', { bundleId }));
  const { plan } = planned;
  if (planned.jobId || plan.upToDate) return null;
  const size = formatBytes(plan.confirmBytes) + (plan.downloadBytes === null ? M.sizeEstimated : '');
  return ctx.output.failure({
    code: 'CONFIRMATION_REQUIRED',
    message: M.installConfirmationRequired(plan.bundleId, size, plan.source),
    tool: 'models_install',
    bundleId: plan.bundleId,
    size,
    downloadBytes: plan.downloadBytes,
    estimatedBytes: plan.estimatedBytes,
    resumedBytes: plan.resumedBytes,
    source: plan.source,
    components: plan.components
      .filter((c) => c.action === 'download')
      .map((c) => ({ component: c.component, repo: c.repo, bytes: c.bytes })),
    next: `cuccut models install --bundle-id ${plan.bundleId} --yes`,
  });
}

/**
 * The default transcription model package on this machine: same as `defaultTranscribeBundle` in `@cuccut/models` (`models_install` installs it when no `bundleId` is given).
 * The CLI does not depend on that package; `run.test.ts` checks that the two match. The CLI and the Runtime it connects to are on the same machine.
 */
export function defaultTranscribeBundle(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  return platform === 'darwin' && arch === 'arm64' ? 'moss-transcribe-diarize@mlx-8bit' : 'moss-transcribe-diarize@candle';
}

/**
 * `jobs wait <jobId>` (§5.4): first checks visibility via `jobs_inspect` (error codes are the same as MCP), then takes the same path as the default wait: subscribes to the `jobs`
 * topic and waits for a terminal state; when `--timeout` (or the tool's `--timeout-sec`) is reached, it reports `WAIT_TIMEOUT`; the exit code follows the terminal state; Ctrl-C cancels the task.
 */
async function waitCommand(ctx: RunContext): Promise<ExitCode> {
  const { client } = ctx.session;
  const jobId = String(ctx.args.jobId);
  const timeout = typeof ctx.args.timeoutSec === 'number' ? ctx.args.timeoutSec : ctx.globals.timeout;
  const watcher = watchJobs(client);
  let initial: JobRecord;
  try {
    const check = await request(ctx, () => client.request('catalog.call', { name: 'jobs_inspect', args: { jobId }, cwd: ctx.cwd }));
    if (!check.ok) {
      watcher.close();
      return ctx.output.failure(check.error);
    }
    initial = await request(ctx, () => client.request('jobs.inspect', { jobId }));
  } catch (error) {
    watcher.close();
    throw error;
  }
  return waitAndReport({ ...ctx, globals: { ...ctx.globals, timeout } }, { jobId }, jobId, watcher, { initial });
}

/** Envelope for a successful write; large results go to disk. */
function finish(ctx: RunContext, result: unknown, next?: string | null): ExitCode {
  const spilled = spill(ctx, result);
  const hint = next === undefined ? (isRecord(result) && typeof result.next === 'string' ? result.next : null) : next;
  return ctx.output.success(spilled, hint);
}

/** Large results go to disk (§5.5): returns the result to write to stdout (as is, or the coverage and how to read the rest). */
export function spill(ctx: Pick<RunContext, 'globals' | 'cwd' | 'command' | 'now'>, result: unknown): unknown {
  const text = JSON.stringify(result);
  const bytes = Buffer.byteLength(text ?? '');
  const target = ctx.globals.resultFile;
  if (target === undefined && bytes <= ctx.globals.maxBytes) return result;
  const stamp = (ctx.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const file =
    target !== undefined ? path.resolve(ctx.cwd, target) : path.join(ctx.cwd, '.cuccut-out', `${ctx.command.tool.name}-${stamp}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  const paging = pagingFlags(ctx.command);
  return {
    truncated: true,
    path: file,
    bytes,
    coverage: coverageOf(result),
    summary: summarize(result),
    continueWith: {
      file,
      // The limit above which the whole result is written directly to stdout (rounded up to KiB).
      maxBytes: Math.ceil(bytes / 1024) * 1024,
      ...(paging.length ? { paging } : {}),
    },
    note: target !== undefined ? M.resultFileWritten : M.spilledNote(ctx.globals.maxBytes),
  };
}

/** Coverage: the top-level keys of the full result and how many items each array has (`items` when the result itself is an array). */
function coverageOf(result: unknown): Record<string, unknown> {
  if (Array.isArray(result)) return { items: result.length };
  if (!isRecord(result)) return typeof result === 'string' ? { chars: result.length } : {};
  const arrays: Record<string, number> = {};
  for (const [key, value] of Object.entries(result)) if (Array.isArray(value)) arrays[key] = value.length;
  return { keys: Object.keys(result).filter((key) => key !== 'next'), ...(Object.keys(arrays).length ? { arrays } : {}) };
}

/** Summary: short top-level scalars are copied as-is (id, version, `nextCursor`); arrays give counts, objects give keys, long text gives character counts. */
function summarize(result: unknown): unknown {
  if (Array.isArray(result)) return { items: result.length };
  if (!isRecord(result)) return typeof result === 'string' ? { chars: result.length } : result;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (key === 'next') continue;
    if (value === null || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') out[key] = value.length <= 200 ? value : { chars: value.length };
    else if (Array.isArray(value)) out[key] = { items: value.length };
    else if (isRecord(value)) out[key] = { keys: Object.keys(value).slice(0, 20) };
  }
  return out;
}

/** Arguments of this command that can narrow the result (pagination, count, time range): when written to disk, suggest using them to read in batches. */
const PAGING_FIELDS = /^(limit|offset|cursor|page|range|fromSeconds|toSeconds)$/;

function pagingFlags(command: CatalogCommand): string[] {
  const properties = isRecord(command.tool.inputSchema.properties) ? command.tool.inputSchema.properties : {};
  return Object.keys(properties)
    .filter((field) => PAGING_FIELDS.test(field))
    .map((field) => `--${kebab(field)}`);
}

/** When a request fails, distinguishes whether the Runtime is down (exit code 3) or something else. */
async function request<T>(ctx: RunContext, send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (error) {
    if (ctx.session.client.state.status !== 'connected') {
      throw new CliError('RUNTIME_UNAVAILABLE', M.runtimeLost(error instanceof Error ? error.message : String(error)));
    }
    throw error;
  }
}

/** Waits for a task to reach a terminal state (§5.4); when `--timeout` is reached, gives `jobId` and the latest progress, exit code 1, and the task continues. */
async function waitAndReport(
  ctx: RunContext,
  submitted: Record<string, unknown>,
  jobId: string,
  watcher: JobWatcher,
  options: { minAttempt?: number | undefined; initial?: JobRecord } = {},
): Promise<ExitCode> {
  const progress = new ProgressReporter(ctx.globals.progress, ctx.output.stderr);
  const outcome = await waitForJob(ctx.session.client, jobId, watcher, {
    progress,
    timeoutSec: ctx.globals.timeout,
    ...(options.minAttempt !== undefined ? { minAttempt: options.minAttempt } : {}),
    ...(options.initial ? { initial: options.initial } : {}),
  });
  if (outcome.kind === 'finished') {
    return outcome.job.state === 'completed' ? completed(ctx, submitted, outcome.job) : stopped(ctx, outcome.job);
  }
  const job = outcome.job;
  return ctx.output.failure(
    {
      code: 'WAIT_TIMEOUT',
      message: M.waitTimeout(ctx.globals.timeout!, jobId),
      jobId,
      ...(job ? { state: job.state, stage: job.phase, progress: job.progress } : {}),
      next: `cuccut jobs wait ${jobId}`,
    },
    EXIT.failed,
  );
}

/** The record from `jobs_inspect` (agent-surface form: output, next step); null if it cannot be fetched. */
async function inspect(ctx: RunContext, jobId: string): Promise<Record<string, unknown> | null> {
  try {
    const call = await ctx.session.client.request('catalog.call', { name: 'jobs_inspect', args: { jobId }, cwd: ctx.cwd });
    return call.ok && isRecord(call.result) ? call.result : null;
  } catch {
    return null;
  }
}

async function completed(ctx: RunContext, submitted: Record<string, unknown>, job: JobRecord): Promise<ExitCode> {
  const record = (await inspect(ctx, job.jobId)) ?? { ...job };
  const { next: _submittedNext, ...rest } = submitted;
  const outputs = record.outputs ?? job.result?.outputs;
  const { next: recordNext, ...recordRest } = record;
  // The state in the submission receipt is that of the moment of submission (queued / running); after waiting for a terminal state it is replaced with the terminal state, so it matches job.state.
  const result = {
    ...rest,
    ...('state' in rest ? { state: job.state } : {}),
    job: recordRest,
    ...(outputs !== undefined ? { outputs } : {}),
  };
  return finish(ctx, result, typeof recordNext === 'string' ? recordNext : null);
}

/** Ends in failure, cancellation, interruption or pending reconciliation: exit code according to the task's error code (only 1 or 2 are possible). */
async function stopped(ctx: RunContext, job: JobRecord): Promise<ExitCode> {
  const record = await inspect(ctx, job.jobId);
  const code = job.error?.code ?? FALLBACK_CODE[job.state] ?? 'JOB_FAILED';
  const { next: recordNext, ...recordRest } = record ?? {};
  const error: CatalogToolError = {
    code,
    message: job.error ? localizeText(job.error.message, job.error.messageRef) : M.jobEnded(job.state),
    jobId: job.jobId,
    state: job.state,
    ...(job.error?.details !== undefined && job.error.details !== null ? { details: job.error.details } : {}),
    ...(record ? { job: recordRest } : {}),
    ...(typeof recordNext === 'string' ? { next: recordNext } : {}),
  };
  return ctx.output.failure(error, exitCodeForJob(code));
}

/** Code used when the task ends without an error code. */
const FALLBACK_CODE: Partial<Record<JobRecord['state'], string>> = {
  cancelled: 'JOB_CANCELLED',
  'needs-reconciliation': 'JOB_NEEDS_RECONCILIATION',
  interrupted: 'JOB_INTERRUPTED',
};

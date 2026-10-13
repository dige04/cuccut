import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentDriver } from '@cuccut/harness';
import {
  ProviderFailure,
  type GenerationAttempt,
  type GenerationOutputFile,
  type GenerationProvider,
  type GenerationRun,
  type GenerationSink,
} from '@cuccut/models';
import type { ProviderUnavailableReason } from '@cuccut/protocol';
import { IMAGE_MEDIA } from '../adapter.ts';
import { runConfinedTurn } from './confined-turn.ts';
import type { CallReporter } from '../usage-reporter.ts';
import { ProvidersAgent as PA } from '@cuccut/protocol/messages/providers';

/** Pre-execution recheck: enabled, Driver available, version sufficient. */
export type AgentReadiness =
  | {
      ok: true;
      driver: AgentDriver;
      version: string;
      /** Executable file the user specified manually. null means the Driver finds it itself. */
      executable?: string | null;
    }
  | { ok: false; reason: ProviderUnavailableReason; message: string };

export interface AgentImageGeneratorOptions {
  providerId: string;
  label: string;
  /** Checked again at execution time: anything disabled, signed out or uninstalled while queued does not open a session. */
  ready: () => Promise<AgentReadiness>;
  /** Developer instructions handed to the native session: the task, the output file name and the prohibitions. */
  instructions: string;
  /** The turn's input. The prompt is passed in verbatim. */
  turnText: (prompt: string) => string;
  /** The agreed output file name (relative to the working directory). */
  outputName: string;
  /** Deadline for one turn (milliseconds). On timeout, the turn is interrupted, the session is closed, and the task fails. */
  turnTimeoutMs: number;
  /** The report at the end of the call, after the session has started (usage ledger, §6.10; no account, so the cost is unknown). */
  report?: CallReporter;
}

/** Excerpt of the reply included in the error description. It is not output; it only helps the user understand why there is no image. */
const REPLY_EXCERPT = 300;
/** When looking for images in the working directory, the maximum number of levels to descend. */
const MAX_DEPTH = 3;
const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif)$/i;

/**
 * The agent as the executor of an image provider (architecture design §6.9). One `generate` is a dedicated native session:
 *
 * - It does not belong to any user session, and has no video context or history. It is not given MCP services (there are no CucCut tools). The working directory is this Job's staging, and access is confined to writing only to this directory (`confinement: 'cwd-write-only'`). Session approval requests are always rejected, since there is no one to approve them.
 * - Only one turn is sent. The developer instructions describe the task, and the input is the prompt. The session is closed when the turn ends (completed, failed, timed out, or cancelled).
 * - The output is the image files the session writes into staging. If there is an agreed file name, that file is taken; otherwise the only file is taken. If there are several, all of them are handed over and JobManager's count check rejects them. Only regular files are accepted (symbolic links are not followed). The declared media type is the requested format. The file header, decoding and dimensions are validated by JobManager.
 * - The agent's text reply is not output. Without an image, the call fails (`PROVIDER_REJECTED`, `details.reason: 'no-image'`), and only an excerpt of the reply goes into the error details. No retries, and no switching providers.
 */
export class AgentImageGenerator implements GenerationProvider {
  readonly id: string;
  readonly #options: AgentImageGeneratorOptions;
  readonly #inflight = new Map<AbortController, Promise<unknown>>();

  constructor(options: AgentImageGeneratorOptions) {
    this.#options = options;
    this.id = options.providerId;
  }

  async generate(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) controller.abort();
    // Only a real call once the generation stage is entered (the session is about to open). Earlier check failures and cancellations do not record usage.
    let startedAt: number | null = null;
    const tracked: GenerationSink = {
      generating: () => {
        startedAt ??= Date.now();
        sink.generating();
      },
      progress: (done, total, unit) => sink.progress(done, total, unit),
      ...(sink.warning ? { warning: (warning) => sink.warning!(warning) } : {}),
    };
    const report = (outputs: number, error?: unknown) => {
      if (startedAt === null || !this.#options.report || controller.signal.aborted) return;
      this.#options.report({
        capability: 'generateImage',
        modelId: run.modelId,
        source: 'job',
        ref: { jobId: run.jobId },
        accountId: null,
        startedAt,
        units: outputs > 0 ? { images: outputs } : {},
        ...(error !== undefined ? { error } : {}),
      });
    };
    const running = this.#run(run, tracked, controller.signal);
    this.#inflight.set(controller, running);
    try {
      const attempt = await running;
      if (attempt.outcome === 'completed') report(attempt.outputs.length);
      return attempt;
    } catch (error) {
      report(0, error);
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.#inflight.delete(controller);
    }
  }

  /** Normal stop: interrupt the in-flight turn, close the session, and wait for them to wrap up. */
  async close(): Promise<void> {
    const running = [...this.#inflight.entries()];
    for (const [controller] of running) controller.abort();
    await Promise.allSettled(running.map(([, promise]) => promise));
  }

  async #run(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt> {
    const { label, providerId } = this.#options;
    const parameters = run.parameters;
    if (parameters.capability !== 'generateImage') {
      throw new ProviderFailure('unavailable', PA.imagesOnly({ label }).text, { providerId });
    }
    // The parameters were checked at submission against the model description (size, seed, count and format are not accepted). Check again here, rather than silently dropping them.
    if (parameters.count !== 1 || parameters.size !== null || parameters.seed !== null || parameters.format !== 'png') {
      throw new ProviderFailure('rejected', PA.onePngOnly({ label }).text, { code: 'PROVIDER_REJECTED', providerId });
    }
    if (signal.aborted) return { outcome: 'cancelled' };

    const ready = await this.#options.ready();
    if (!ready.ok) throw new ProviderFailure('unavailable', PA.unavailable({ label, message: ready.message }).text, { providerId, reason: ready.reason });
    if (signal.aborted) return { outcome: 'cancelled' };

    sink.generating();
    const outcome = await runConfinedTurn({
      driver: ready.driver,
      executable: ready.executable ?? null,
      cwd: run.staging,
      instructions: this.#options.instructions,
      text: this.#options.turnText(parameters.prompt),
      timeoutMs: this.#options.turnTimeoutMs,
      signal,
    });
    if (!outcome.started) {
      if (signal.aborted) return { outcome: 'cancelled' };
      throw new ProviderFailure('unavailable-remote', PA.sessionNotStarted({ label, error: messageOf(outcome.error) }).text, { providerId });
    }
    const { result, replies, declined } = outcome;

    const facts = { providerId, ...(declined > 0 ? { declinedApprovals: declined } : {}) };
    switch (result.kind) {
      case 'cancelled':
        return { outcome: 'cancelled' };
      case 'timeout':
        throw new ProviderFailure(
          'unavailable-remote',
          PA.timedOut({ label, minutes: Math.round(this.#options.turnTimeoutMs / 60_000) }).text,
          { ...facts, reason: 'timeout' },
        );
      case 'exited':
        throw new ProviderFailure('unavailable-remote', PA.exited({ label, message: result.message }).text, { ...facts, reason: 'exited' });
      case 'failed':
      case 'interrupted':
        throw new ProviderFailure('rejected', PA.notCompleted({ label, reason: result.kind === 'failed' ? result.message : PA.turnInterrupted() }).text, {
          code: 'PROVIDER_REJECTED',
          ...facts,
          reason: result.kind === 'failed' ? 'turn-failed' : 'turn-interrupted',
        });
      case 'completed':
        break;
    }

    const images = await collectImages(run.staging);
    if (images.length === 0) {
      const reply = excerpt(replies.join('\n'));
      throw new ProviderFailure('rejected', (reply ? PA.noImageReply({ label, reply }) : PA.noImage({ label })).text, {
        code: 'PROVIDER_REJECTED',
        ...facts,
        reason: 'no-image',
        ...(reply ? { reply } : {}),
      });
    }
    const chosen = images.includes(this.#options.outputName) ? [this.#options.outputName] : images;
    const outputs: GenerationOutputFile[] = [];
    for (const relative of chosen) outputs.push(await describeOutput(run.staging, relative, IMAGE_MEDIA.png.mediaType));
    sink.progress(outputs.length, parameters.count);
    return { outcome: 'completed', outputs, workerVersion: `${providerId} ${ready.version}` };
  }
}

/** Image candidates in staging: regular files (symbolic links not followed) whose extension or file header is an image. Hidden files do not count. Sorted by path. */
async function collectImages(root: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) await walk(file, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (IMAGE_EXTENSION.test(entry.name) || (await looksLikeImage(file))) found.push(path.relative(root, file));
    }
  };
  await walk(root, 0);
  return found.sort();
}

async function looksLikeImage(file: string): Promise<boolean> {
  const handle = await fs.open(file, 'r').catch(() => null);
  if (!handle) return false;
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    const b = head.subarray(0, bytesRead);
    return (
      (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
      (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') ||
      (b.length >= 4 && b.toString('latin1', 0, 4) === 'GIF8')
    );
  } finally {
    await handle.close();
  }
}

async function describeOutput(staging: string, relative: string, mediaType: string): Promise<GenerationOutputFile> {
  const bytes = await fs.readFile(path.join(staging, relative));
  return { path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, mediaType };
}

function excerpt(text: string): string {
  const chars = [...text.trim()];
  return chars.length > REPLY_EXCERPT ? `${chars.slice(0, REPLY_EXCERPT).join('')}…` : chars.join('');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

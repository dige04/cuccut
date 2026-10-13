import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RpcError, type Id, type JobCallCounts, type TextModelInfo } from '@cuccut/protocol';
import { TextCallCancelled, TextGenerationError, type TextGenerateRequest, type TextGenerator } from '@cuccut/models';
import {
  JsonLineWorker,
  WorkerRequestError,
  executableName,
  findBundledBinary,
  type WorkerCommand,
  type WorkerEvent,
} from '@cuccut/process-host';
import { JobsSpeechWorker } from '@cuccut/protocol/messages/jobs/speech-worker.ts';
import { CallCounter, PipelineStepError, type ProgressReporter } from './pipeline.ts';
import { translationShapeProblems, type TranslationBody } from './translation-document.ts';
import type { GlossaryRef } from './translation-glossary.ts';

/**
 * The Runtime side of the Speech Worker (architecture design §7.9, §13.1; protocol in the command protocol spec §4.5): the subtitle and translation core
 * (`speech-doc`) runs in this separate process, one process per step, shut down when done.
 *
 * - The frozen input is written to `input.json` in staging, and the outputs (the `cuccut.translation/2` body, the subtitle cues in the target language, the report) are also written to staging;
 *   the Worker does not touch the network and does not write to the video directory;
 * - Each model call from the Worker comes back as an `llm.request` event. Here it is sent through the flow's existing `generateText` (`text.generate`: provider selection,
 *   authorization and task budget, ledger, and stop barrier all live there), and text or classified failures are returned as `llm.reply`. Keys stay only in the provider's auth header
 *   and never enter the Worker's environment, events or requests;
 * - Failure classification: output that does not meet the contract (including truncated output) is `malformed`, and the core resends it itself; cancellation is `cancelled`; everything else (authorization, budget, stop barrier,
 *   provider refusal, or still unavailable after bounded HTTP-layer retries, §6.4) is `terminal`: the core stops, completed pages stay in the checkpoint, and this step fails with the original
 *   error object (details such as `pendingGrants` are not lost);
 * - On abort (cancel, Runtime stop), `cancel` is sent, in-flight calls are aborted via `signal`, and the process is then shut down.
 */

export const SPEECH_WORKER_PROTOCOL = 'speech-worker/1';
export const SPEECH_TRANSLATE_INPUT_SCHEMA = 'cuccut.speech-worker.translate/1';
export const SPEECH_WORKER_CUES_SCHEMA = 'cuccut.speech-worker.cues/1';

const INPUT_FILE = 'input.json';
const CLOSE_GRACE_MS = 2_000;
const HELLO_TIMEOUT_MS = 10_000;
const MESSAGE_LIMIT = 300;

/**
 * Where the Speech Worker is found: the `CUCCUT_SPEECH_WORKER` environment variable; a `speech-worker` next to the engine host (the output of the same cargo build, or, once packaged, in the same
 * `<resources>/bin`); the native program directory shipped with the app; or the cargo output directory found by walking up from this module (built by `npm run build:engine` during development). null when not found.
 */
export function resolveSpeechWorkerCommand(engineHost: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CUCCUT_SPEECH_WORKER) return env.CUCCUT_SPEECH_WORKER;
  if (engineHost && path.isAbsolute(engineHost)) {
    const sibling = path.join(path.dirname(engineHost), executableName('speech-worker'));
    if (existsSync(sibling)) return sibling;
  }
  return findBundledBinary('speech-worker', path.dirname(fileURLToPath(import.meta.url)), env);
}

/** Frozen input for `translate` (`cuccut.speech-worker.translate/1`; `schema` is filled in here). */
export interface SpeechTranslateInput {
  media: {
    assetId: Id | null;
    path?: string;
    contentHash: string;
    duration: { ticks: string; timescale: number };
    sampleRate?: number;
  };
  sourceLanguage: string | null;
  speechRef: { id: Id; revision: string };
  sequenceId: Id;
  /** Body of `cuccut.speech/1`. */
  speech: unknown;
  targetLanguage: string;
  glossary: Array<{ source: string; target: string; note?: string }>;
  glossaryRef: GlossaryRef | null;
  params?: { instructions?: string; backoffScale?: number };
  /**
   * In-place refresh: the existing translation in this language is the base, and only the sentences in `sentences` are re-translated; other units are written back unchanged (command protocol spec §4.5). Both fields are given together or both are omitted;
   * in that case `glossaryRef` is inherited from the base, and no translation brief is generated.
   */
  translation?: TranslationBody;
  sentences?: Id[];
}

/** Translation body written by the Worker (`cuccut.translation/2`; units carry the core's alignment blocks and display rewrites). */
export type SpeechWorkerTranslation = Omit<TranslationBody, 'units'> & {
  units: Array<{ id: Id; sourceSentenceId: Id; sourceFingerprint: string; naturalText: string } & Record<string, unknown>>;
};

/** One subtitle cue in the target language: times are integer ticks under `timescale` (the clock of the source transcript). */
export interface SpeechWorkerCue {
  unitId: Id | null;
  sentenceId: Id;
  text: string;
  start: number;
  end: number;
  /** The cues whose alignment was unavailable, spread out by sentence duration. */
  fallback: boolean;
}

export interface SpeechWorkerCues {
  schema: typeof SPEECH_WORKER_CUES_SCHEMA;
  language: string;
  timescale: number;
  cues: SpeechWorkerCue[];
}

/** The kinds of Worker events a caller may want to see (progress is delivered separately via `progress`). */
export type SpeechWorkerNotice =
  | { event: 'checkpoint'; phase: string; pages: number; translatedSentences: number }
  | { event: 'resumed'; phase: string; translatedSentences: number; totalSentences: number };

export interface SpeechTranslateOptions {
  /** An executable, or a command with arguments and environment. When only a path is given, the child process gets only the `PATH`, `TMPDIR` and locale environment variables. */
  command: string | WorkerCommand;
  /** The staging directory dedicated to this step: inputs, checkpoints and outputs all live here. It is kept after a failure or interruption, and a retry resumes from the checkpoint. */
  staging: string;
  input: SpeechTranslateInput;
  text: Pick<TextGenerator, 'generate'>;
  provider: string;
  model: string;
  /** The frozen model's limits: the output cap is clamped to them, and temperature is omitted when the model does not accept it. */
  modelInfo: Pick<TextModelInfo, 'maxOutputTokens' | 'acceptsTemperature'>;
  signal: AbortSignal;
  progress?: ProgressReporter;
  onNotice?: (notice: SpeechWorkerNotice) => void;
}

export interface SpeechTranslateResult {
  translation: SpeechWorkerTranslation;
  cues: SpeechWorkerCues;
  /** The Worker's report (brief, paging, alignment, call counts, ...), unchanged. */
  report: Record<string, unknown>;
  /** Calls made in this run (on resume, excludes those from the earlier run). */
  calls: JobCallCounts;
  /** Model version reported by the first successful call; null if none was reported. */
  modelVersion: string | null;
}

interface LlmRequestParams {
  requestId: number;
  kind: string;
  attempt: number;
  system: string;
  user: string;
  temperature: number | null;
  maxOutputTokens: number | null;
}

type ErrorClass = 'retryable' | 'malformed' | 'terminal' | 'cancelled';

type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown };

function progressOf(params: unknown): { stage: string; done: number; total: number | null } {
  const p = (params ?? {}) as { stage?: unknown; done?: unknown; total?: unknown };
  return {
    stage: typeof p.stage === 'string' ? p.stage : '',
    done: typeof p.done === 'number' ? p.done : 0,
    total: typeof p.total === 'number' ? p.total : null,
  };
}

/** Runs one translation in the Speech Worker. Fails with `WORKER_OUTPUT_INVALID` when the output does not meet the contract. */
export async function runSpeechTranslate(options: SpeechTranslateOptions): Promise<SpeechTranslateResult> {
  const { staging, input, signal } = options;
  signal.throwIfAborted();
  await fs.mkdir(staging, { recursive: true });
  const inputPath = path.join(staging, INPUT_FILE);
  await fs.writeFile(inputPath, JSON.stringify({ schema: SPEECH_TRANSLATE_INPUT_SCHEMA, ...input }));

  const command: WorkerCommand = typeof options.command === 'string' ? { command: options.command, env: workerEnv() } : options.command;
  const worker = await JsonLineWorker.start(command);
  const counter = new CallCounter();
  const report = (done: number, total: number | null) =>
    options.progress?.({ done, total, unit: 'units', calls: counter.snapshot() }, 'generating');
  const onAbort = () => void worker.request('cancel', {}).catch(() => {});
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const hello = await worker.request<{ protocol?: unknown; methods?: unknown }>('hello', {}, { timeoutMs: HELLO_TIMEOUT_MS });
    if (hello?.protocol !== SPEECH_WORKER_PROTOCOL || !Array.isArray(hello.methods) || !hello.methods.includes('translate')) {
      throw new PipelineStepError('WORKER_INCOMPATIBLE', JobsSpeechWorker.incompatible({ protocol: SPEECH_WORKER_PROTOCOL }), {
        protocol: hello?.protocol ?? null,
      });
    }

    const events: WorkerEvent[] = [];
    let wake: (() => void) | null = null;
    worker.onEvent((event) => {
      events.push(event);
      wake?.();
    });
    const state: { outcome: Outcome | null } = { outcome: null };
    void worker.request('translate', { input: inputPath, staging }).then(
      (value) => {
        state.outcome = { ok: true, value };
        wake?.();
      },
      (error: unknown) => {
        state.outcome = { ok: false, error };
        wake?.();
      },
    );

    // The original error from the first terminal failure: once the Worker stops, this step fails with it.
    let terminal: unknown = null;
    let modelVersion: string | null = null;
    let done = 0;
    let total: number | null = null;
    report(done, total);
    for (;;) {
      while (events.length > 0) {
        const event = events.shift()!;
        if (event.event === 'llm.request') {
          const params = event.params as LlmRequestParams;
          counter.calls++;
          if (params.attempt > 0) counter.retries++;
          report(done, total);
          const reply = await answer(options, params, signal);
          if ('text' in reply) modelVersion ??= reply.modelVersion;
          if ('error' in reply) {
            counter.failures++;
            if (reply.error.class === 'terminal' || reply.error.class === 'cancelled') terminal ??= reply.cause;
          }
          const wire =
            'error' in reply ? { requestId: reply.requestId, error: reply.error } : { requestId: reply.requestId, text: reply.text };
          void worker.request('llm.reply', wire).catch(() => {});
        } else if (event.event === 'progress') {
          const progress = progressOf(event.params);
          if (progress.stage === 'translate') {
            done = progress.done;
            total = progress.total;
            report(done, total);
          }
        } else if (event.event === 'checkpoint' || event.event === 'resumed') {
          options.onNotice?.({ event: event.event, ...(event.params as object) } as SpeechWorkerNotice);
        }
      }
      if (state.outcome !== null) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
        if (events.length > 0 || state.outcome !== null) resolve();
      });
      wake = null;
    }

    const settled = state.outcome;
    if (!settled.ok) {
      signal.throwIfAborted();
      const error = settled.error;
      if (terminal !== null && error instanceof WorkerRequestError) throw terminal;
      if (error instanceof WorkerRequestError) {
        const details = error.body.details;
        throw new PipelineStepError(
          error.code,
          error.body.message,
          typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : undefined,
        );
      }
      throw new PipelineStepError('WORKER_FAILED', JobsSpeechWorker.exited(), { exit: worker.alive ? null : await worker.exited });
    }
    const outputs = await readOutputs(staging, settled.value);
    // On in-place refresh, only the named sentences are checked: other units and their cues are carried back from the base unchanged, and the caller only takes the named sentences.
    const only = input.sentences ? new Set(input.sentences) : undefined;
    const problems = [
      ...translationShapeProblems(outputs.translation, input.speechRef, only),
      ...((outputs.translation as { language?: unknown }).language === input.targetLanguage ? [] : [JobsSpeechWorker.translationLanguage().text]),
      ...cueProblems(onlyCues(outputs.cues, only), input),
    ];
    if (problems.length > 0) {
      throw new PipelineStepError('WORKER_OUTPUT_INVALID', JobsSpeechWorker.outputInvalid(), { problems: problems.slice(0, 20) });
    }
    report(total ?? done, total);
    return {
      translation: outputs.translation as SpeechWorkerTranslation,
      cues: outputs.cues as SpeechWorkerCues,
      report: outputs.report,
      calls: counter.snapshot(),
      modelVersion,
    };
  } finally {
    signal.removeEventListener('abort', onAbort);
    await worker.close(CLOSE_GRACE_MS);
  }
}

type Reply =
  | { requestId: number; text: string; modelVersion: string | null }
  | { requestId: number; error: { code: string; message: string; class: ErrorClass }; cause: unknown };

/** Makes one call through `generateText`, returning either text or a classified failure. */
async function answer(options: SpeechTranslateOptions, params: LlmRequestParams, signal: AbortSignal): Promise<Reply> {
  const { requestId } = params;
  const request: TextGenerateRequest = {
    messages: [
      ...(params.system.trim() !== '' ? [{ role: 'system' as const, content: params.system }] : []),
      { role: 'user' as const, content: params.user },
    ],
    provider: options.provider,
    model: options.model,
    ...(params.maxOutputTokens !== null ? { maxOutputTokens: Math.min(params.maxOutputTokens, options.modelInfo.maxOutputTokens) } : {}),
    ...(params.temperature !== null && options.modelInfo.acceptsTemperature ? { temperature: params.temperature } : {}),
  };
  try {
    const result = await options.text.generate(request, { signal });
    if (result.finishReason === 'length') {
      const cause = new TextGenerationError('MODEL_OUTPUT_INVALID', JobsSpeechWorker.outputTruncated().text);
      return { requestId, error: { code: cause.code, message: cause.message, class: 'malformed' }, cause };
    }
    return { requestId, text: result.text, modelVersion: result.modelVersion };
  } catch (error) {
    const errorClass = classify(error, signal);
    return {
      requestId,
      error: { code: codeOf(error, errorClass), message: messageOf(error), class: errorClass },
      cause: error,
    };
  }
}

function classify(error: unknown, signal: AbortSignal): ErrorClass {
  if (signal.aborted || error instanceof TextCallCancelled || (error instanceof Error && error.name === 'AbortError')) return 'cancelled';
  if (error instanceof TextGenerationError && error.code === 'MODEL_OUTPUT_INVALID') return 'malformed';
  // Authorization, budget and stop-barrier errors (RpcError), provider refusal or still unavailable after bounded HTTP-layer retries (TextGenerationError), and other unexpected errors.
  return 'terminal';
}

function codeOf(error: unknown, errorClass: ErrorClass): string {
  if (errorClass === 'cancelled') return 'CANCELLED';
  // Authorization and budget rejections are `forbidden` / `conflict`; the specific cause (`GRANT_REQUIRED`, `BUDGET_EXCEEDED`, ...) is in `details.code`.
  if (error instanceof RpcError) {
    const detail = (error.details as { code?: unknown } | null | undefined)?.code;
    return typeof detail === 'string' ? detail : error.code;
  }
  if (error instanceof TextGenerationError || error instanceof PipelineStepError) return String(error.code);
  return 'INTERNAL';
}

function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > MESSAGE_LIMIT ? `${message.slice(0, MESSAGE_LIMIT)}…` : message;
}

/** The child process environment: carries no keys or tokens from the Runtime process. */
function workerEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'RUST_BACKTRACE']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

async function readOutputs(
  staging: string,
  result: unknown,
): Promise<{ translation: unknown; cues: unknown; report: Record<string, unknown> }> {
  const files = result as { translation?: unknown; cues?: unknown; report?: unknown } | null;
  const read = async (name: unknown, field: string): Promise<unknown> => {
    if (typeof name !== 'string' || name === '' || path.basename(name) !== name) {
      throw new PipelineStepError('WORKER_OUTPUT_INVALID', JobsSpeechWorker.resultMissing({ field }));
    }
    try {
      return JSON.parse(await fs.readFile(path.join(staging, name), 'utf8'));
    } catch (error) {
      throw new PipelineStepError('WORKER_OUTPUT_INVALID', JobsSpeechWorker.unreadableFile({ name }), { reason: messageOf(error) });
    }
  };
  const translation = await read(files?.translation, 'translation');
  const cues = await read(files?.cues, 'cues');
  const report = await read(files?.report, 'report');
  return { translation, cues, report: typeof report === 'object' && report !== null ? (report as Record<string, unknown>) : {} };
}

/** Keeps only the cues for the named sentences (used when checking an in-place refresh); unchanged when nothing is named or the shape is wrong. */
function onlyCues(value: unknown, only: ReadonlySet<Id> | undefined): unknown {
  const doc = value as { cues?: unknown } | null;
  if (!only || !doc || typeof doc !== 'object' || !Array.isArray(doc.cues)) return value;
  return { ...doc, cues: doc.cues.filter((cue) => typeof cue === 'object' && cue !== null && only.has((cue as { sentenceId?: Id }).sentenceId ?? '')) };
}

/** Cue shape and timing: integer ticks, start before end, ordered by time without overlap, and not beyond the media duration. The problem text is generated in the current language. */
export function cueProblems(value: unknown, input: Pick<SpeechTranslateInput, 'targetLanguage' | 'speech' | 'media'>): string[] {
  const J = JobsSpeechWorker;
  const problems: string[] = [];
  const doc = value as Partial<SpeechWorkerCues> | null;
  if (!doc || typeof doc !== 'object') return [J.cuesNotObject().text];
  if (doc.schema !== SPEECH_WORKER_CUES_SCHEMA) problems.push(J.cuesSchema({ schema: SPEECH_WORKER_CUES_SCHEMA }).text);
  if (doc.language !== input.targetLanguage) problems.push(J.cuesLanguage().text);
  const speechTimescale = (input.speech as { timescale?: unknown } | null)?.timescale;
  if (!Number.isSafeInteger(doc.timescale) || doc.timescale! <= 0 || doc.timescale !== speechTimescale) {
    problems.push(J.cuesTimescale().text);
  }
  if (!Array.isArray(doc.cues)) return [...problems, J.cuesMissing().text];
  const timescale = typeof doc.timescale === 'number' && doc.timescale > 0 ? doc.timescale : 1;
  const durationSec = Number(input.media.duration.ticks) / input.media.duration.timescale;
  let previousEnd = 0;
  doc.cues.forEach((cue, i) => {
    const n = i + 1;
    if (!cue || typeof cue !== 'object') {
      problems.push(J.cueNotObject({ n }).text);
      return;
    }
    if (typeof cue.text !== 'string' || cue.text.trim() === '') problems.push(J.cueNoText({ n }).text);
    if (typeof cue.sentenceId !== 'string' || (cue.unitId !== null && typeof cue.unitId !== 'string'))
      problems.push(J.cueNoSentence({ n }).text);
    if (typeof cue.fallback !== 'boolean') problems.push(J.cueFallback({ n }).text);
    if (!Number.isSafeInteger(cue.start) || !Number.isSafeInteger(cue.end)) {
      problems.push(J.cueTicks({ n }).text);
      return;
    }
    if (cue.start < 0 || cue.end <= cue.start) problems.push(J.cueRange({ n }).text);
    if (cue.start < previousEnd) problems.push(J.cueOverlap({ n }).text);
    if (Number.isFinite(durationSec) && cue.end / timescale > durationSec + 1 / timescale) problems.push(J.cueBeyond({ n }).text);
    previousEnd = Math.max(previousEnd, cue.end);
  });
  return problems;
}

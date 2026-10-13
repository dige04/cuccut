import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  TEXT_EFFORTS,
  type GenerateTextRequest,
  type MessageRef,
  type GenerationParameters,
  type TextCapabilityParameters,
  type TextEffort,
  type TextFinishReason,
  type TextModelInfo,
  type TextUsage,
  type UsageRecord,
  type UsageSource,
} from '@cuccut/protocol';
import { compileJsonSchema, JsonSchemaError } from '@cuccut/protocol/json-schema';
import { ModelsTextGeneration as M } from '@cuccut/protocol/messages/models/text-generation.ts';
import { codePointLength } from './generation-options.ts';
import type { GenerationAttempt, GenerationProvider, GenerationRun, GenerationSink } from './generation-provider.ts';
import type { ModelChoice } from './model-selection.ts';
import { ProviderFailure } from './transcribe-provider.ts';
import { modelTextRef, type ModelText } from './model-text.ts';

/**
 * `generateText` (architecture design §6.1, §6.4): one call to a text model. Two entry points share one execution path:
 *
 * - **Task**: `models.generateText` submits a Job, executed by `TextJobGenerator`; the full text is written to staging, and JobManager validates it and publishes it as an artifact;
 * - **In-process**: flows (translation, polishing, chapter splitting...) get the result directly through `TextGenerator.generate()`, without creating a Job.
 *
 * Both go through the same `TextRunner`: a concurrency cap per Provider (capability parameter `concurrency`, default 4, shared by tasks and in-process calls), call counting, and the result check in `finishText` (structured output is validated against the schema; `length` does not count as a complete success).
 * Connection failures, timeouts, 5xx, and 429 with `Retry-After` are retried with bounded backoff by the HTTP layer of the online Provider (§6.4); there is no retry here, and no switch of Provider or model. Output that fails the schema is not retried (§6.2).
 */

export type TextParameters = Extract<GenerationParameters, { capability: 'generateText' }>;

/** One call, frozen at submission time. */
export interface TextRun {
  providerId: string;
  modelId: string;
  parameters: TextParameters;
  /** Source for the usage ledger (§6.10): a task is `job`; in-process calls default to `inline`. */
  source?: UsageSource;
  ref?: UsageRecord['ref'];
}

/** One response read by the adapter: the text as-is, the finish reason, and usage. Checks happen in `finishText`. */
export interface TextReply {
  text: string;
  finishReason: TextFinishReason;
  usage: TextUsage | null;
  /** Model version reported by the provider; null if none. */
  modelVersion: string | null;
  /** Adapter version. */
  workerVersion: string;
}

/** Callback during execution (for counting). */
export interface TextCallHooks {
  /** Called once for each backoff retry in the HTTP layer. */
  retry(): void;
}

/** The text executor for one Provider: sends one request with the frozen parameters. Throws `ProviderFailure` on failure; throws as soon as possible when `signal` aborts. */
export interface TextProvider {
  readonly id: string;
  generateText(run: TextRun, signal: AbortSignal, hooks: TextCallHooks): Promise<TextReply>;
}

/** The result of one call (the in-process entry gets it directly; a task publishes the full text as an artifact, and the summary goes into `result.text`). */
export interface TextResult {
  providerId: string;
  modelId: string;
  /** The full model output. For structured output, this is JSON text. */
  text: string;
  /** Structured output: the validated value. */
  json?: unknown;
  /** `length` only appears for plain text: truncated structured output always fails. */
  finishReason: 'stop' | 'length';
  usage: TextUsage | null;
  modelVersion: string | null;
  effort: { requested: TextEffort | null; applied: TextEffort | null };
  notes: string[];
  workerVersion: string;
}

// ---- At submission: check and freeze parameters ----

/** The closest tier; on a tie, the higher one. Null when `supported` is empty. */
export function nearestEffort(requested: TextEffort, supported: readonly TextEffort[]): TextEffort | null {
  if (supported.includes(requested)) return requested;
  const rank = (e: TextEffort) => TEXT_EFFORTS.indexOf(e);
  let best: TextEffort | null = null;
  for (const candidate of supported) {
    if (best === null) {
      best = candidate;
      continue;
    }
    const d = Math.abs(rank(candidate) - rank(requested));
    const bestD = Math.abs(rank(best) - rank(requested));
    if (d < bestD || (d === bestD && rank(candidate) > rank(best))) best = candidate;
  }
  return best;
}

/**
 * Whether the request is compatible with the model's features; when compatible, gives the frozen parameters (§6.2). Incompatible requests always fail with `invalid-request`, and `details` carries the model's limits:
 * an output limit above the model's, a `temperature` / `seed` / structured output the model does not accept, or a JSON Schema that does not compile.
 * Reasoning effort is never rejected: when not given, the capability parameter's default is used; when the model has no such tier, it is swapped for the closest tier; when it cannot be adjusted, it is ignored (all noted in the result).
 */
export function textParameters(
  choice: ModelChoice<'generateText'>,
  request: GenerateTextRequest,
  defaults: TextCapabilityParameters,
): TextParameters {
  const model: TextModelInfo = choice.model;
  const where = { providerId: choice.providerId, modelId: choice.modelId };
  const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
  if (!messages.some((m) => m.role !== 'system' && m.content.trim().length > 0)) {
    throw new RpcError('invalid-request', M.noMessage());
  }
  if (messages.some((m) => !['system', 'user', 'assistant'].includes(m.role))) {
    throw new RpcError('invalid-request', M.badRole());
  }
  // Rough check: input whose character-count estimate clearly exceeds the context is rejected at submission (one token is at least one character). The exact check is done by the provider (`INPUT_TOO_LONG`).
  const chars = messages.reduce((sum, m) => sum + codePointLength(m.content), 0);
  if (chars > model.contextTokens * 8) {
    throw new RpcError('invalid-request', M.inputTooLong({ chars, modelId: choice.modelId, contextTokens: model.contextTokens }), {
      ...where,
      code: 'INPUT_TOO_LONG',
      contextTokens: model.contextTokens,
    });
  }

  const maxOutputTokens = request.maxOutputTokens ?? model.maxOutputTokens;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > model.maxOutputTokens) {
    throw new RpcError('invalid-request', M.maxOutput({ modelId: choice.modelId, max: model.maxOutputTokens }), {
      ...where,
      maxOutputTokens: model.maxOutputTokens,
    });
  }

  let temperature: number | null = null;
  if (request.temperature !== undefined) {
    if (!model.acceptsTemperature) throw new RpcError('invalid-request', M.noTemperature({ modelId: choice.modelId }), where);
    if (!(request.temperature >= 0 && request.temperature <= 2))
      throw new RpcError('invalid-request', M.temperatureRange(), where);
    temperature = request.temperature;
  }

  let seed: number | null = null;
  if (request.seed !== undefined) {
    if (!model.acceptsSeed) throw new RpcError('invalid-request', M.noSeed({ modelId: choice.modelId }), where);
    seed = request.seed;
  }

  const format = request.responseFormat ?? { type: 'text' as const };
  let responseFormat: TextParameters['responseFormat'];
  if (format.type === 'json') {
    if (!model.structuredOutput) throw new RpcError('invalid-request', M.noStructured({ modelId: choice.modelId }), where);
    try {
      compileJsonSchema(format.schema);
    } catch (error) {
      if (error instanceof JsonSchemaError) throw new RpcError('invalid-request', error.message, where);
      throw error;
    }
    responseFormat = { type: 'json', schema: structuredClone(format.schema), ...(format.name ? { name: format.name } : {}) };
  } else {
    responseFormat = { type: 'text' };
  }

  const requestedEffort = request.effort ?? defaults.effort;
  const effort = requestedEffort === null ? null : nearestEffort(requestedEffort, model.efforts);
  return { capability: 'generateText', messages, responseFormat, maxOutputTokens, temperature, requestedEffort, effort, seed };
}

/** Note for when reasoning effort is swapped to another tier or ignored. */
export function effortNotes(parameters: TextParameters, modelId: string): string[] {
  const { requestedEffort, effort } = parameters;
  if (requestedEffort === null || requestedEffort === effort) return [];
  if (effort === null) return [M.effortIgnored({ modelId, requested: requestedEffort }).text];
  return [M.effortChanged({ modelId, requested: requestedEffort, applied: effort }).text];
}

// ---- Response: check ----

/**
 * Checks one response (the output contract of §6.4):
 * - `content-filter` → `PROVIDER_REJECTED` (`reason: 'content-filter'`);
 * - structured output: truncated (`length`), not JSON, or not matching the schema → `MODEL_OUTPUT_INVALID` (`reason`: `length`, `schema`);
 * - plain text: empty output → `MODEL_OUTPUT_INVALID` (`reason: 'empty'`); `length` is still returned, and the caller treats it as an incomplete result.
 */
export function finishText(run: TextRun, reply: TextReply, label: string): TextResult {
  const { parameters } = run;
  if (reply.finishReason === 'content-filter') {
    throw new ProviderFailure('rejected', M.contentFiltered({ provider: label }), {
      code: 'PROVIDER_REJECTED',
      reason: 'content-filter',
      finishReason: 'content-filter',
    });
  }
  const base = {
    providerId: run.providerId,
    modelId: run.modelId,
    finishReason: reply.finishReason,
    usage: reply.usage,
    modelVersion: reply.modelVersion,
    effort: { requested: parameters.requestedEffort, applied: parameters.effort },
    notes: effortNotes(parameters, run.modelId),
    workerVersion: reply.workerVersion,
  };
  if (parameters.responseFormat.type === 'json') {
    if (reply.finishReason === 'length') {
      throw invalidOutput('length', M.truncatedJson({ provider: label, max: parameters.maxOutputTokens }), [
        M.truncatedProblem({ max: parameters.maxOutputTokens }).text,
      ]);
    }
    let value: unknown;
    try {
      value = JSON.parse(reply.text);
    } catch {
      throw invalidOutput('schema', M.notJson({ provider: label }), [M.notJsonProblem().text]);
    }
    const problems = compileJsonSchema(parameters.responseFormat.schema).validate(value);
    if (problems.length > 0) throw invalidOutput('schema', M.schemaMismatch({ provider: label }), problems);
    return { ...base, finishReason: 'stop', text: reply.text, json: value };
  }
  if (reply.text.trim().length === 0) {
    const truncated = reply.finishReason === 'length';
    throw invalidOutput(
      truncated ? 'length' : 'empty',
      truncated ? M.limitBeforeText({ provider: label }) : M.emptyOutput({ provider: label }),
      [truncated ? M.limitBeforeTextProblem({ max: parameters.maxOutputTokens }).text : M.emptyProblem().text],
    );
  }
  return { ...base, finishReason: reply.finishReason, text: reply.text };
}

function invalidOutput(reason: 'length' | 'schema' | 'empty', message: ModelText, problems: string[]): ProviderFailure {
  return new ProviderFailure('protocol', message, { reason, problems });
}

// ---- Shared execution: concurrency cap and counting ----

export interface TextCallStats {
  /** Calls made (each `generate`, or each execution of a task, counts once). */
  calls: number;
  /** Number of backoff retries in the HTTP layer. */
  retries: number;
  /** Calls that ended in failure (cancellations not included). */
  failures: number;
}

export interface TextRunnerOptions {
  /** Number of calls one Provider runs at the same time; read each time a call is queued (config changes take effect immediately). */
  concurrency(providerId: string): number;
  /** Human-readable Provider name. */
  label?(providerId: string): string;
}

/** The call was cancelled (`signal` aborted). */
export class TextCallCancelled extends Error {
  constructor() {
    super('Call cancelled');
    this.name = 'TextCallCancelled';
  }
}

interface Gate {
  active: number;
  waiting: Array<() => void>;
}

export class TextRunner {
  readonly #options: TextRunnerOptions;
  readonly #gates = new Map<string, Gate>();
  readonly #stats = new Map<string, TextCallStats>();

  constructor(options: TextRunnerOptions) {
    this.#options = options;
  }

  /** Executes once with the frozen parameters: waits for a concurrency slot on this Provider, sends the request, and checks the response. Throws `ProviderFailure` on failure and `TextCallCancelled` on cancellation. */
  async run(provider: TextProvider, run: TextRun, signal: AbortSignal): Promise<TextResult> {
    if (signal.aborted) throw new TextCallCancelled();
    await this.#acquire(run.providerId, signal);
    const stats = this.#statsOf(run.providerId);
    stats.calls++;
    try {
      const reply = await provider.generateText(run, signal, { retry: () => stats.retries++ });
      if (signal.aborted) throw new TextCallCancelled();
      return finishText(run, reply, this.#options.label?.(run.providerId) ?? run.providerId);
    } catch (error) {
      if (signal.aborted || error instanceof TextCallCancelled) throw new TextCallCancelled();
      stats.failures++;
      throw error;
    } finally {
      this.#release(run.providerId);
    }
  }

  /** Per-Provider counts (a copy). */
  stats(): Record<string, TextCallStats> {
    return Object.fromEntries([...this.#stats].map(([id, s]) => [id, { ...s }]));
  }

  /** Number of calls in progress right now (for tests and diagnostics). */
  active(providerId: string): number {
    return this.#gates.get(providerId)?.active ?? 0;
  }

  #statsOf(providerId: string): TextCallStats {
    let stats = this.#stats.get(providerId);
    if (!stats) {
      stats = { calls: 0, retries: 0, failures: 0 };
      this.#stats.set(providerId, stats);
    }
    return stats;
  }

  #gate(providerId: string): Gate {
    let gate = this.#gates.get(providerId);
    if (!gate) {
      gate = { active: 0, waiting: [] };
      this.#gates.set(providerId, gate);
    }
    return gate;
  }

  #limit(providerId: string): number {
    return Math.max(1, Math.floor(this.#options.concurrency(providerId)));
  }

  #acquire(providerId: string, signal: AbortSignal): Promise<void> {
    const gate = this.#gate(providerId);
    if (gate.active < this.#limit(providerId) && gate.waiting.length === 0) {
      gate.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal.removeEventListener('abort', onAbort);
        gate.active++;
        resolve();
      };
      const onAbort = () => {
        const index = gate.waiting.indexOf(grant);
        if (index >= 0) gate.waiting.splice(index, 1);
        reject(new TextCallCancelled());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      gate.waiting.push(grant);
    });
  }

  #release(providerId: string): void {
    const gate = this.#gate(providerId);
    gate.active--;
    while (gate.waiting.length > 0 && gate.active < this.#limit(providerId)) gate.waiting.shift()!();
  }
}

// ---- Executor for the task entry point ----

/** One execution of a task: calls through `TextRunner`, writes the full text to staging (`output-1.txt` or `output-1.json`), and hands it to JobManager to validate and publish. */
export class TextJobGenerator implements GenerationProvider {
  readonly id: string;
  readonly #runner: TextRunner;
  readonly #provider: TextProvider;
  readonly #inflight = new Set<AbortController>();

  constructor(runner: TextRunner, provider: TextProvider) {
    this.#runner = runner;
    this.#provider = provider;
    this.id = provider.id;
  }

  async generate(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt> {
    const parameters = run.parameters;
    if (parameters.capability !== 'generateText') {
      throw new ProviderFailure('unavailable', `The text runner can't run ${parameters.capability}`, { providerId: this.id });
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) controller.abort();
    this.#inflight.add(controller);
    try {
      sink.generating();
      const result = await this.#runner.run(
        this.#provider,
        { providerId: run.providerId, modelId: run.modelId, parameters, source: 'job', ref: { jobId: run.jobId } },
        controller.signal,
      );
      const json = parameters.responseFormat.type === 'json';
      const bytes = Buffer.from(json ? `${JSON.stringify(result.json, null, 2)}\n` : result.text, 'utf8');
      const name = `output-1.${json ? 'json' : 'txt'}`;
      await fs.writeFile(path.join(run.staging, name), bytes);
      sink.progress(1, 1);
      return {
        outcome: 'completed',
        outputs: [
          {
            path: name,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            byteLength: bytes.length,
            mediaType: json ? 'application/json' : 'text/plain',
          },
        ],
        workerVersion: result.workerVersion,
        ...(result.usage ? { usage: result.usage } : {}),
        text: result,
      };
    } catch (error) {
      if (error instanceof TextCallCancelled || controller.signal.aborted) return { outcome: 'cancelled' };
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.#inflight.delete(controller);
    }
  }

  async close(): Promise<void> {
    for (const controller of this.#inflight) controller.abort();
  }
}

// ---- In-process entry point ----

/** Errors from in-process calls: the same closed set of error codes as tasks (command and protocol spec §11.3), plus `CANCELLED`. */
export type TextErrorCode =
  | 'PROVIDER_AUTH_FAILED'
  | 'PROVIDER_QUOTA_EXCEEDED'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INPUT_TOO_LONG'
  | 'MODEL_OUTPUT_INVALID'
  | 'MODEL_LOAD_FAILED'
  | 'CANCELLED';

export class TextGenerationError extends Error {
  readonly code: TextErrorCode;
  readonly details: Record<string, unknown>;

  /** Message reference, used when constructed from catalog text. */
  readonly messageRef: MessageRef | undefined;

  constructor(code: TextErrorCode, message: ModelText, details: Record<string, unknown> = {}) {
    super(String(message));
    this.messageRef = modelTextRef(message);
    this.name = 'TextGenerationError';
    this.code = code;
    this.details = details;
  }
}

const REJECTION_CODES = new Set(['PROVIDER_AUTH_FAILED', 'PROVIDER_QUOTA_EXCEEDED', 'PROVIDER_REJECTED', 'INPUT_TOO_LONG']);

/** `ProviderFailure` → a closed error code (the same error codes JobManager gives tasks). */
export function textErrorOf(failure: ProviderFailure, providerId: string): TextGenerationError {
  const { code, ...rest } = failure.details;
  switch (failure.kind) {
    case 'rejected':
      return new TextGenerationError(
        (typeof code === 'string' && REJECTION_CODES.has(code) ? code : 'PROVIDER_REJECTED') as TextErrorCode,
        failure.message,
        { ...rest, providerId },
      );
    case 'unavailable-remote':
      return new TextGenerationError('PROVIDER_UNAVAILABLE', failure.message, { ...rest, providerId });
    case 'protocol':
      return new TextGenerationError('MODEL_OUTPUT_INVALID', failure.message, { ...failure.details, providerId });
    default:
      return new TextGenerationError('MODEL_LOAD_FAILED', failure.message, { ...failure.details, providerId });
  }
}

/** In-process request: the same parameters as `models.generateText`, without `commandId`. */
export type TextGenerateRequest = Omit<GenerateTextRequest, 'commandId'>;

/**
 * In-process text generation entry point: selection (§6.2, same as for tasks) → freeze parameters → execute through the shared `TextRunner`.
 * Selection and parameter errors throw `RpcError` in the same form as at submission (`CAPABILITY_NOT_CONFIGURED`, `invalid-request`, `not-found`);
 * execution errors throw `TextGenerationError`.
 */
export interface TextGenerator {
  /** `source` and `ref` are written to the usage ledger (§6.10): default `inline`; calls started directly by an agent tool use `agent-tool`. */
  generate(
    request: TextGenerateRequest,
    options?: { signal?: AbortSignal; source?: 'inline' | 'agent-tool'; ref?: UsageRecord['ref'] },
  ): Promise<TextResult>;
  /** Per-Provider counts of calls, retries, and failures (tasks and in-process calls combined). */
  stats(): Record<string, TextCallStats>;
}

/** Selects the Provider and model for one call, and hands back the executor and the parameter defaults (`ModelServices.selectText` implements it). */
export interface TextSelection extends ModelChoice<'generateText'> {
  text: TextProvider;
  defaults: TextCapabilityParameters;
}

export function createTextGenerator(options: {
  select(target: { provider?: string; model?: string }): Promise<TextSelection>;
  runner: TextRunner;
}): TextGenerator {
  return {
    async generate(request, { signal, source, ref } = {}) {
      const selection = await options.select({
        ...(request.provider !== undefined ? { provider: request.provider } : {}),
        ...(request.model !== undefined ? { model: request.model } : {}),
      });
      const parameters = textParameters(selection, request, selection.defaults);
      try {
        return await options.runner.run(
          selection.text,
          {
            providerId: selection.providerId,
            modelId: selection.modelId,
            parameters,
            source: source ?? 'inline',
            ...(ref ? { ref } : {}),
          },
          signal ?? new AbortController().signal,
        );
      } catch (error) {
        if (error instanceof TextCallCancelled)
          throw new TextGenerationError('CANCELLED', M.cancelled(), { providerId: selection.providerId });
        if (error instanceof ProviderFailure) throw textErrorOf(error, selection.providerId);
        throw error;
      }
    },
    stats: () => options.runner.stats(),
  };
}

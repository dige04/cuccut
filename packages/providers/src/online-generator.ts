import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ProviderFailure,
  codePointLength,
  type GenerationAttempt,
  type GenerationOutputFile,
  type GenerationProvider,
  type GenerationRun,
  type GenerationSink,
} from '@cuccut/models';
import type { UsageUnits } from '@cuccut/protocol';
import { IMAGE_MEDIA, SPEECH_MEDIA, type AdapterConfig, type AdapterHttp, type ImageAdapter, type SpeechAdapter } from './adapter.ts';
import { ProviderAborted, redact } from './http/provider-fetch.ts';
import type { CallReporter } from './usage-reporter.ts';
import { ProvidersConfig as PC, ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export interface OnlineGeneratorOptions {
  providerId: string;
  label: () => string;
  speech: SpeechAdapter | null;
  image: ImageAdapter | null;
  /** Configuration at execution time (including the key retrieved from the credential store); null if not enabled or if there is no key; throws `ProviderFailure` if the credential store is unavailable. */
  config: () => Promise<AdapterConfig | null>;
  http?: AdapterHttp;
  /** Report at the end of a call (usage ledger and account status, §6.10). */
  report?: CallReporter;
}

/**
 * Generation executor for online providers (architecture design §6.4, §6.6): re-reads the configuration at execution time, sends one request with the frozen model and parameters,
 * and writes the response to `output-<n>.<ext>` in staging and computes its digest. It does not retry with a different model and does not truncate text; validation and publishing happen in JobManager.
 */
export class OnlineGenerator implements GenerationProvider {
  readonly id: string;
  readonly #options: OnlineGeneratorOptions;
  readonly #inflight = new Set<AbortController>();

  constructor(options: OnlineGeneratorOptions) {
    this.#options = options;
    this.id = options.providerId;
  }

  async generate(run: GenerationRun, sink: GenerationSink, signal: AbortSignal): Promise<GenerationAttempt> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) controller.abort();
    this.#inflight.add(controller);
    // The key used for this attempt: on error, it is used to strip the key from the error text, rather than fetching it again in the error handling.
    let secret: string | null = null;
    // Recorded when the request is sent (the usage ledger only records calls that actually sent a request).
    const call: { sent: { accountId: string | null; startedAt: number } | null } = { sent: null };
    const report = (units: UsageUnits, error?: unknown) => {
      if (!call.sent || !this.#options.report) return;
      this.#options.report({
        capability: run.parameters.capability,
        modelId: run.modelId,
        source: 'job',
        ref: { jobId: run.jobId },
        accountId: call.sent.accountId,
        startedAt: call.sent.startedAt,
        units,
        ...(error !== undefined ? { error } : {}),
      });
    };
    try {
      const config = await this.#options.config();
      if (!config) throw new ProviderFailure('unavailable', PC.notEnabledOrNoKey({ label: this.#options.label() }).text, { providerId: this.id });
      secret = config.credential;
      const attempt = await this.#run(run, sink, controller.signal, config, call);
      if (attempt.outcome === 'completed') report(unitsOf(run, attempt.outputs.length));
      return attempt;
    } catch (error) {
      if (controller.signal.aborted || error instanceof ProviderAborted) return { outcome: 'cancelled' };
      if (error instanceof ProviderFailure) {
        report({}, error);
        throw error;
      }
      // Unexpected error: the text may come from the provider's response, so strip the key before reporting.
      const message = error instanceof Error ? error.message : String(error);
      const failure = new ProviderFailure('protocol', redact(PC.generateFailed({ label: this.#options.label(), message }).text, secret ? [secret] : []));
      report({}, failure);
      throw failure;
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.#inflight.delete(controller);
    }
  }

  async #run(
    run: GenerationRun,
    sink: GenerationSink,
    signal: AbortSignal,
    config: AdapterConfig,
    call: { sent: { accountId: string | null; startedAt: number } | null },
  ): Promise<GenerationAttempt> {
    const send = () => (call.sent = { accountId: config.accountId ?? null, startedAt: Date.now() });
    const label = this.#options.label();
    const http = this.#options.http ?? {};
    const parameters = run.parameters;

    if (parameters.capability === 'synthesizeSpeech') {
      const adapter = this.#options.speech;
      const model = adapter?.models(config).find((m) => m.modelId === run.modelId);
      if (!adapter || !model)
        throw new ProviderFailure('unavailable', PC.noSpeechModel({ label, model: run.modelId }).text, { providerId: this.id });
      sink.generating();
      send();
      const output = await adapter.synthesize({ config, model, parameters, signal, http });
      const media = SPEECH_MEDIA[parameters.format];
      const file = await writeOutput(run.staging, 0, media.extension, media.mediaType, output.bytes);
      sink.progress(1, 1);
      return {
        outcome: 'completed',
        outputs: [file],
        workerVersion: adapter.version,
        ...(output.usage !== undefined ? { usage: output.usage } : {}),
      };
    }

    // Text generation goes through `OnlineTextProvider` (via `TextRunner`) and is not dispatched here.
    if (parameters.capability === 'generateText') {
      throw new ProviderFailure('unavailable', PC.noTextGeneration({ label }).text, { providerId: this.id });
    }
    // Music generation is available only from local providers (`OnlineCapability` does not include it), and is not dispatched here.
    if (parameters.capability === 'generateMusic') {
      throw new ProviderFailure('unavailable', PC.noTextGeneration({ label }).text, { providerId: this.id });
    }

    const adapter = this.#options.image;
    const model = adapter?.models(config).find((m) => m.modelId === run.modelId);
    if (!adapter || !model) throw new ProviderFailure('unavailable', PC.noImageModel({ label, model: run.modelId }).text, { providerId: this.id });
    sink.generating();
    send();
    const output = await adapter.generate({
      config,
      model,
      parameters,
      signal,
      http,
      progress: (done) => sink.progress(done, parameters.count),
    });
    if (output.images.length !== parameters.count) {
      throw new ProviderFailure('protocol', PH.imageCount({ label, got: output.images.length, want: parameters.count }).text);
    }
    const media = IMAGE_MEDIA[parameters.format];
    const outputs: GenerationOutputFile[] = [];
    for (const [index, bytes] of output.images.entries()) {
      outputs.push(await writeOutput(run.staging, index, media.extension, media.mediaType, bytes));
    }
    return {
      outcome: 'completed',
      outputs,
      workerVersion: adapter.version,
      ...(output.usage !== undefined ? { usage: output.usage } : {}),
    };
  }

  async close(): Promise<void> {
    for (const controller of this.#inflight) controller.abort();
  }
}

/** Usage (§6.10): speech synthesis is counted in characters (by Unicode code point), image generation in images. */
function unitsOf(run: GenerationRun, outputs: number): UsageUnits {
  const parameters = run.parameters;
  if (parameters.capability === 'synthesizeSpeech') return { chars: codePointLength(parameters.text) };
  if (parameters.capability === 'generateImage') return { images: outputs };
  return {};
}

async function writeOutput(
  staging: string,
  index: number,
  extension: string,
  mediaType: string,
  bytes: Buffer,
): Promise<GenerationOutputFile> {
  if (bytes.length === 0) throw new ProviderFailure('protocol', PH.emptyOutput().text);
  const name = `output-${index + 1}.${extension}`;
  await fs.writeFile(path.join(staging, name), bytes);
  return { path: name, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, mediaType };
}

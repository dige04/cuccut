import { ProviderFailure, type TextCallHooks, type TextProvider, type TextReply, type TextRun } from '@cuccut/models';
import type { AdapterConfig, AdapterHttp, TextAdapter } from './adapter.ts';
import { ProviderAborted, redact } from './http/provider-fetch.ts';
import type { CallReporter } from './usage-reporter.ts';
import { ProvidersConfig as PC } from '@cuccut/protocol/messages/providers';

export interface OnlineTextProviderOptions {
  providerId: string;
  label: () => string;
  adapter: TextAdapter;
  /** Configuration at execution time (including the key retrieved from the credential store); null if not enabled or if there is no key; throws `ProviderFailure` if the credential store is unavailable. */
  config: () => Promise<AdapterConfig | null>;
  http?: AdapterHttp;
  /** Report at the end of a call (usage ledger and account status, §6.10). */
  report?: CallReporter;
}

/**
 * Text executor for online providers (architecture design §6.4): re-reads the configuration at execution time, sends one request with the frozen model and parameters (the HTTP layer does its own bounded retries),
 * and reads the response into a `TextReply`. Concurrency limits, counting and result checks are in `TextRunner`, shared by tasks and in-process calls.
 */
export class OnlineTextProvider implements TextProvider {
  readonly id: string;
  readonly #options: OnlineTextProviderOptions;

  constructor(options: OnlineTextProviderOptions) {
    this.#options = options;
    this.id = options.providerId;
  }

  async generateText(run: TextRun, signal: AbortSignal, hooks: TextCallHooks): Promise<TextReply> {
    const label = this.#options.label();
    let secret: string | null = null;
    // Recorded when the request is sent (the usage ledger only records calls that actually sent a request).
    let sent: { accountId: string | null; startedAt: number } | null = null;
    const report = (outcome: { reply?: TextReply; error?: unknown }) => {
      if (!sent || !this.#options.report) return;
      const usage = outcome.reply?.usage;
      this.#options.report({
        capability: 'generateText',
        modelId: run.modelId,
        source: run.source ?? 'inline',
        ...(run.ref ? { ref: run.ref } : {}),
        accountId: sent.accountId,
        startedAt: sent.startedAt,
        units: {
          ...(typeof usage?.inputTokens === 'number' ? { inputTokens: usage.inputTokens } : {}),
          ...(typeof usage?.outputTokens === 'number' ? { outputTokens: usage.outputTokens } : {}),
          ...(typeof usage?.cachedTokens === 'number' ? { cachedTokens: usage.cachedTokens } : {}),
        },
        ...(outcome.error !== undefined ? { error: outcome.error } : {}),
      });
    };
    try {
      const config = await this.#options.config();
      if (!config) throw new ProviderFailure('unavailable', PC.notEnabledOrNoKey({ label }).text, { providerId: this.id });
      secret = config.credential;
      const adapter = this.#options.adapter;
      const model = adapter.models(config).find((m) => m.modelId === run.modelId);
      if (!model) throw new ProviderFailure('unavailable', PC.noTextModel({ label, model: run.modelId }).text, { providerId: this.id });
      sent = { accountId: config.accountId ?? null, startedAt: Date.now() };
      const reply = await adapter.generate({
        config,
        model,
        parameters: run.parameters,
        signal,
        http: this.#options.http ?? {},
        onRetry: () => hooks.retry(),
      });
      report({ reply });
      return reply;
    } catch (error) {
      if (error instanceof ProviderAborted) throw error;
      if (error instanceof ProviderFailure) {
        if (!signal.aborted) report({ error });
        throw error;
      }
      if (signal.aborted) throw new ProviderAborted();
      // Unexpected error: the text may come from the provider's response, so strip the key before reporting.
      const message = error instanceof Error ? error.message : String(error);
      const failure = new ProviderFailure('protocol', redact(PC.textFailed({ label, message }).text, secret ? [secret] : []));
      report({ error: failure });
      throw failure;
    }
  }
}

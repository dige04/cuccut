// OpenAI-compatible text providers from the catalog (`generateText`, architecture design §6.4): the same Chat Completions endpoint as `custom:<name>`
// (`POST {base}/chat/completions`, Bearer, output limit as `max_tokens`), differing only in base URL and built-in model table (`vendor-catalog.ts`).
// Structured output follows each provider's style: providers that support JSON Schema get `json_schema`; those that support only JSON mode get `json_object`, with the schema written into the system
// message. Output is validated against the schema locally in all cases. Reasoning effort and `seed` are sent only when the model table declares support for them (none currently do).
import type { TextReply } from '@cuccut/models';
import type { TextModelInfo } from '@cuccut/protocol';
import type { AdapterConfig, AdapterHttp, ModelLister, ProviderListing, TextAdapter, TextRequest } from '../adapter.ts';
import { chatCompletions } from '../openai/chat-completions.ts';
import { openAiListModels } from '../openai/openai-text.ts';

export interface VendorTextOptions {
  label: string;
  models: readonly TextModelInfo[];
  jsonMode: 'json_schema' | 'json_object';
}

export class VendorTextAdapter implements TextAdapter, ModelLister {
  readonly version = 'cuccut-providers/openai-compatible-text@1';
  readonly #options: VendorTextOptions;

  constructor(options: VendorTextOptions) {
    this.#options = options;
  }

  models(_config: AdapterConfig): TextModelInfo[] {
    return structuredClone([...this.#options.models]);
  }

  generate(request: TextRequest): Promise<TextReply> {
    return chatCompletions(request, {
      label: this.#options.label,
      version: this.version,
      maxTokensField: 'max_tokens',
      jsonMode: this.#options.jsonMode,
    });
  }

  listModels(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<ProviderListing> {
    return openAiListModels(config, signal, http, this.#options.label);
  }

  /** Verifies the key by listing models (`GET {base}/models`). */
  async validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void> {
    await this.listModels(config, signal, http);
  }
}

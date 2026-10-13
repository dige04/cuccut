// Text models for OpenAI-compatible endpoints (`generateText`, architecture design §6.4): users declare models with `capability` `generateText`, and the request shape matches
// OpenAI's Chat Completions (see openai/chat-completions.ts), with the output limit given as `max_tokens`. All of this is assumed, not confirmed for each implementation: endpoints accept
// `response_format: { type: 'json_schema' }` (endpoints that do not accept it ignore or reject it; output is still validated against the schema locally); `reasoning_effort` is sent only when `efforts` is declared.
// Limits that are not declared use conservative values: a 32768-token context and 4096-token single output.
import type { TextReply } from '@cuccut/models';
import type { DeclaredModel, TextModelInfo } from '@cuccut/protocol';
import type { AdapterConfig, AdapterHttp, ModelLister, ProviderListing, TextAdapter, TextRequest } from '../adapter.ts';
import { chatCompletions } from '../openai/chat-completions.ts';
import { openAiListModels } from '../openai/openai-text.ts';
import { declaredOf } from './compatible-adapter.ts';

export class CompatibleTextAdapter implements TextAdapter, ModelLister {
  readonly version = 'cuccut-providers/openai-compatible-text@1';
  readonly #label: () => string;

  constructor(label: () => string) {
    this.#label = label;
  }

  models(config: AdapterConfig): TextModelInfo[] {
    return declaredOf(config, 'generateText').map((m, i) => declaredTextInfo(m, i === 0));
  }

  generate(request: TextRequest): Promise<TextReply> {
    return chatCompletions(request, { label: this.#label(), version: this.version, maxTokensField: 'max_tokens' });
  }

  listModels(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<ProviderListing> {
    return openAiListModels(config, signal, http, this.#label());
  }
}

export function declaredTextInfo(model: DeclaredModel, isDefault: boolean): TextModelInfo {
  const efforts = [...(model.efforts ?? [])];
  return {
    modelId: model.modelId,
    label: model.label ?? model.modelId,
    ...(isDefault ? { default: true } : {}),
    declared: true,
    contextTokens: model.contextTokens ?? 32_768,
    maxOutputTokens: model.maxOutputTokens ?? 4096,
    efforts,
    // When reasoning effort is declared, the endpoint's default level is not known.
    defaultEffort: null,
    structuredOutput: model.structuredOutput ?? true,
    acceptsTemperature: true,
    acceptsSeed: false,
    cost: 'unknown',
  };
}

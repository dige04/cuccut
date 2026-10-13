// OpenAI text models (`generateText`, architecture design §6.4). Docs read on 2026-10-03:
//   https://platform.openai.com/docs/models
//   https://platform.openai.com/docs/models/gpt-6-astra
//   https://platform.openai.com/docs/models/gpt-6.1-sol
//   https://platform.openai.com/docs/models/gpt-6-luna
//   https://platform.openai.com/docs/guides/reasoning
// Confirmed by the docs: three flagship text models, gpt-6-astra (strongest), gpt-6.1-sol (balanced), gpt-6-luna (efficient); context 1,050,000 tokens and up to 128,000 output tokens per request; `reasoning_effort` takes none / minimal / low / medium / high / xhigh / max, default medium; astra does not accept none, and sol accepts neither none nor minimal. Our four levels (minimal to high) are declared accordingly.
// Not confirmed: whether these reasoning models accept `temperature` and `seed` (older reasoning models accept only the default temperature), so they are declared as not accepting them; cost is `unknown`. The default model is the balanced gpt-6.1-sol.
import { ProviderFailure, type TextReply } from '@cuccut/models';
import type { TextModelInfo } from '@cuccut/protocol';
import type { AdapterConfig, AdapterHttp, ModelLister, ProviderListing, TextAdapter, TextRequest } from '../adapter.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { chatCompletions } from './chat-completions.ts';
import { authOf, httpOptions } from './openai-transcription.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

const LABEL = 'OpenAI';

function model(modelId: string, label: string, efforts: TextModelInfo['efforts'], extra: Partial<TextModelInfo> = {}): TextModelInfo {
  return {
    modelId,
    label,
    contextTokens: 1_050_000,
    maxOutputTokens: 128_000,
    efforts,
    defaultEffort: 'medium',
    structuredOutput: true,
    acceptsTemperature: false,
    acceptsSeed: false,
    cost: 'unknown',
    ...extra,
  };
}

const MODELS: TextModelInfo[] = [
  model('gpt-6.1-sol', 'GPT-6.1 Sol', ['low', 'medium', 'high'], { default: true }),
  model('gpt-6-astra', 'GPT-6 Astra', ['minimal', 'low', 'medium', 'high']),
  model('gpt-6-luna', 'GPT-6 Luna', ['minimal', 'low', 'medium', 'high']),
];

export class OpenAiTextAdapter implements TextAdapter, ModelLister {
  readonly version = 'cuccut-providers/openai-text@1';

  models(_config: AdapterConfig): TextModelInfo[] {
    return structuredClone(MODELS);
  }

  generate(request: TextRequest): Promise<TextReply> {
    return chatCompletions(request, { label: LABEL, version: this.version, maxTokensField: 'max_completion_tokens' });
  }

  listModels(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<ProviderListing> {
    return openAiListModels(config, signal, http, LABEL);
  }
}

/** `GET {base}/models`: `data[].id`. Same for OpenAI and compatible endpoints. */
export async function openAiListModels(
  config: AdapterConfig,
  signal: AbortSignal,
  http: AdapterHttp,
  label: string,
): Promise<ProviderListing> {
  const response = await providerFetch(httpOptions(label, config, { ...http, attempts: 1 }), {
    method: 'GET',
    url: `${config.baseUrl}/models`,
    auth: authOf(config),
    timeoutMs: http.timeoutMs ?? 15_000,
    signal,
  });
  const value = response.json<{ data?: unknown }>();
  if (!value || !Array.isArray(value.data)) throw new ProviderFailure('protocol', PH.listShape({ label, shape: '{ data: [...] }' }).text);
  const models = value.data.flatMap((m) =>
    typeof m === 'object' && m !== null && typeof (m as { id?: unknown }).id === 'string' ? [(m as { id: string }).id] : [],
  );
  return { models: [...new Set(models)].sort() };
}

// Anthropic text model (`generateText`, architecture design §6.4): native Messages adapter. Documents read on 2026-09-25:
//   https://platform.claude.com/docs/en/api/messages
//   https://platform.claude.com/docs/en/about-claude/models/overview
//   https://platform.claude.com/docs/en/about-claude/pricing
// Confirmed by the docs: `POST {base}/v1/messages` (JSON; `x-api-key` and `anthropic-version: 2023-06-01` request headers). The system message goes in the top-level `system`. `max_tokens` must be given. Structured output is `output_config.format: { type: 'json_schema', schema }`, and reasoning effort is `output_config.effort` (low / medium / high). In the response's `content[]`, `text` blocks are the body and `thinking` blocks are skipped. `stop_reason` is end_turn / stop_sequence / max_tokens / refusal. `usage.input_tokens` excludes cache hits, and `cache_read_input_tokens` is separate. The error body is `{ error: { type, message } }`. `GET {base}/v1/models` returns `data[].id`.
// Models: claude-opus-5-5 and claude-sonnet-5-5 have a 1M context and at most 128K output per call, do not accept sampling parameters (temperature etc.), and their default reasoning efforts are medium and high respectively. claude-haiku-4-5 has a 200K context and 64K output, cannot adjust reasoning effort, and accepts temperature. There is no `seed`.
// Trade-offs: requests are not streamed, and single output is declared at 64K (longer output without streaming easily exceeds the request deadline). Extended thinking is not turned on. The default model is the balanced claude-sonnet-5-5. Model IDs have no date suffix.
import { ProviderFailure, type TextReply } from '@cuccut/models';
import type { TextFinishReason, TextModelInfo } from '@cuccut/protocol';
import { textTimeoutMs, type AdapterConfig, type AdapterHttp, type ModelLister, type ProviderListing, type TextAdapter, type TextRequest } from '../adapter.ts';
import { providerFetch, type RejectionCode } from '../http/provider-fetch.ts';
import { httpOptions } from '../openai/openai-transcription.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com';
const LABEL = 'Anthropic';
const API_VERSION = '2023-06-01';

function model(modelId: string, label: string, extra: Partial<TextModelInfo>): TextModelInfo {
  return {
    modelId,
    label,
    contextTokens: 1_000_000,
    maxOutputTokens: 64_000,
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'high',
    structuredOutput: true,
    acceptsTemperature: false,
    acceptsSeed: false,
    cost: 'unknown',
    ...extra,
  };
}

const MODELS: TextModelInfo[] = [
  model('claude-sonnet-5-5', 'Claude Sonnet 5.5', { default: true }),
  model('claude-opus-5-5', 'Claude Opus 5.5', { defaultEffort: 'medium' }),
  model('claude-haiku-4-5', 'Claude Haiku 4.5', { contextTokens: 200_000, efforts: [], defaultEffort: null, acceptsTemperature: true }),
];

export class AnthropicTextAdapter implements TextAdapter, ModelLister {
  readonly version = 'cuccut-providers/anthropic-text@1';

  models(_config: AdapterConfig): TextModelInfo[] {
    return structuredClone(MODELS);
  }

  async generate(request: TextRequest): Promise<TextReply> {
    const { config } = request;
    const body = JSON.stringify(anthropicBody(request.model.modelId, request.parameters));
    const response = await providerFetch(httpOptions(LABEL, config, request.http), {
      method: 'POST',
      url: `${config.baseUrl}/v1/messages`,
      headers: { 'content-type': 'application/json', 'anthropic-version': API_VERSION },
      auth: authOf(config),
      body: () => body,
      timeoutMs: textTimeoutMs(request.http),
      signal: request.signal,
      classify: classifyAnthropic,
      onRetry: request.onRetry,
    });
    return parseAnthropicMessage(response.json(), this.version);
  }

  /** `GET {base}/v1/models`: `data[].id`. Also used to verify the key. */
  async listModels(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<ProviderListing> {
    const response = await providerFetch(httpOptions(LABEL, config, { ...http, attempts: 1 }), {
      method: 'GET',
      url: `${config.baseUrl}/v1/models?limit=1000`,
      headers: { 'anthropic-version': API_VERSION },
      auth: authOf(config),
      timeoutMs: http.timeoutMs ?? 15_000,
      signal,
      classify: classifyAnthropic,
    });
    const value = response.json<{ data?: unknown }>();
    if (!value || !Array.isArray(value.data)) throw new ProviderFailure('protocol', PH.listShape({ label: LABEL, shape: '{ data: [...] }' }).text);
    const models = value.data.flatMap((m) => (isObject(m) && typeof m.id === 'string' ? [m.id] : []));
    return { models: [...new Set(models)].sort() };
  }

  async validateCredential(config: AdapterConfig, signal: AbortSignal, http: AdapterHttp): Promise<void> {
    await this.listModels(config, signal, http);
  }
}

function authOf(config: AdapterConfig): { header: string; value: string } | null {
  return config.credential ? { header: 'x-api-key', value: config.credential } : null;
}

export function anthropicBody(modelId: string, parameters: TextRequest['parameters']): Record<string, unknown> {
  const system = parameters.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const format = parameters.responseFormat;
  const outputConfig = {
    ...(parameters.effort !== null ? { effort: parameters.effort === 'minimal' ? 'low' : parameters.effort } : {}),
    ...(format.type === 'json' ? { format: { type: 'json_schema', schema: format.schema } } : {}),
  };
  return {
    model: modelId,
    max_tokens: parameters.maxOutputTokens,
    ...(system ? { system } : {}),
    messages: parameters.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
    ...(parameters.temperature !== null ? { temperature: parameters.temperature } : {}),
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
  };
}

export function parseAnthropicMessage(value: unknown, version: string): TextReply {
  if (!isObject(value)) throw new ProviderFailure('protocol', PH.notObject({ label: LABEL }).text);
  if (!Array.isArray(value.content)) throw new ProviderFailure('protocol', PH.missingField({ label: LABEL, field: 'content' }).text);
  const text = value.content
    .filter((block): block is Record<string, unknown> => isObject(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
  const usage = isObject(value.usage) ? usageOf(value.usage) : null;
  return {
    text,
    finishReason: finishOf(value.stop_reason),
    usage,
    modelVersion: typeof value.model === 'string' && value.model ? value.model : null,
    workerVersion: version,
  };
}

/** Input becomes “total including cache”: `input_tokens` excludes cache reads and writes. */
function usageOf(usage: Record<string, unknown>): NonNullable<TextReply['usage']> {
  const input = countOf(usage.input_tokens);
  const cacheRead = countOf(usage.cache_read_input_tokens) ?? 0;
  const cacheWrite = countOf(usage.cache_creation_input_tokens) ?? 0;
  return {
    inputTokens: input === null ? null : input + cacheRead + cacheWrite,
    outputTokens: countOf(usage.output_tokens),
    ...(cacheRead > 0 ? { cachedTokens: cacheRead } : {}),
  };
}

function finishOf(value: unknown): TextFinishReason {
  if (value === 'end_turn' || value === 'stop_sequence' || value === null || value === undefined) return 'stop';
  if (value === 'max_tokens' || value === 'model_context_window_exceeded') return 'length';
  if (value === 'refusal') return 'content-filter';
  throw new ProviderFailure('protocol', PH.unexpectedFinish({ label: LABEL, reason: String(value).slice(0, 40) }).text);
}

/** Error body `{ error: { type, message } }`: prompt too long → `INPUT_TOO_LONG`; insufficient balance → quota exhausted; model not found → `model-not-found`. */
export function classifyAnthropic(status: number, body: string): { code: RejectionCode; reason?: string } | null {
  let type: string | null = null;
  let message = '';
  try {
    const parsed = JSON.parse(body) as { error?: { type?: unknown; message?: unknown } };
    type = typeof parsed.error?.type === 'string' ? parsed.error.type : null;
    message = typeof parsed.error?.message === 'string' ? parsed.error.message : '';
  } catch {
    // Not JSON: classify by status code.
  }
  if (type === 'authentication_error' || type === 'permission_error') return { code: 'PROVIDER_AUTH_FAILED' };
  if (/credit balance|billing/i.test(message)) return { code: 'PROVIDER_QUOTA_EXCEEDED', reason: 'insufficient-quota' };
  if (/prompt is too long|context window|too many tokens/i.test(message)) return { code: 'INPUT_TOO_LONG', reason: 'context-length' };
  if (type === 'not_found_error' && /model/i.test(message)) return { code: 'PROVIDER_REJECTED', reason: 'model-not-found' };
  if (type === 'rate_limit_error' || status === 429) return { code: 'PROVIDER_QUOTA_EXCEEDED', reason: 'rate-limited' };
  return null;
}

function countOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

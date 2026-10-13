// OpenAI Chat Completions (`generateText`, architecture design §6.4): the request and response shape shared by OpenAI and OpenAI-compatible endpoints.
// Docs read on 2026-10-03:
//   https://platform.openai.com/docs/api-reference/chat/create
//   https://platform.openai.com/docs/guides/structured-outputs
//   https://platform.openai.com/docs/guides/reasoning
//   https://platform.openai.com/docs/guides/error-codes
// Confirmed by the docs: `POST {base}/chat/completions` (JSON, Bearer); `messages[{ role, content }]`; `max_completion_tokens` (reasoning models no longer accept `max_tokens`); `reasoning_effort`; `response_format: { type: 'json_schema', json_schema: { name, schema,
// strict } }`; `seed`; `choices[0].message.content` / `.refusal`, `finish_reason` (`stop`, `length`, `content_filter`, ...);
// `usage.prompt_tokens` / `completion_tokens`; `model` is a dated snapshot name; context too long is 400 `context_length_exceeded`, model not found is 404 `model_not_found`, quota exhausted is 429 `insufficient_quota`.
// Trade-off: Chat Completions rather than Responses, because almost every compatible endpoint implements only this one, so both share one code path. `strict` is sent as false: strict mode accepts only a subset of schemas (all fields required, no extra fields), and an arbitrary schema would be rejected at run time. Whether or not a provider enforces it strictly, the output is validated locally against the schema. Compatible endpoints use `max_tokens` (self-hosted servers generally accept only that).
import { ProviderFailure, type TextParameters, type TextReply } from '@cuccut/models';
import type { TextFinishReason } from '@cuccut/protocol';
import { textTimeoutMs, type TextRequest } from '../adapter.ts';
import { providerFetch, type RejectionCode } from '../http/provider-fetch.ts';
import { authOf, httpOptions } from './openai-transcription.ts';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

export interface ChatCompletionsStyle {
  label: string;
  version: string;
  /** Field name for the output limit. */
  maxTokensField: 'max_completion_tokens' | 'max_tokens';
  /**
   * Structured output styles: `json_schema` (default) sends the schema; `json_object` is for providers that support only JSON mode. It asks for a JSON object and puts the schema into a system message. Output from both styles is validated locally against the schema.
   */
  jsonMode?: 'json_schema' | 'json_object';
}

export function chatCompletionsBody(modelId: string, parameters: TextParameters, style: ChatCompletionsStyle): Record<string, unknown> {
  const format = parameters.responseFormat;
  const jsonObject = format.type === 'json' && style.jsonMode === 'json_object';
  const messages = parameters.messages.map((m) => ({ role: m.role, content: m.content }));
  if (jsonObject) {
    messages.unshift({
      role: 'system',
      content: `Reply with a single JSON object that conforms to this JSON Schema:\n${JSON.stringify(format.schema)}`,
    });
  }
  return {
    model: modelId,
    messages,
    [style.maxTokensField]: parameters.maxOutputTokens,
    ...(parameters.effort !== null ? { reasoning_effort: parameters.effort } : {}),
    ...(parameters.temperature !== null ? { temperature: parameters.temperature } : {}),
    ...(parameters.seed !== null ? { seed: parameters.seed } : {}),
    ...(jsonObject ? { response_format: { type: 'json_object' } } : {}),
    ...(format.type === 'json' && !jsonObject
      ? { response_format: { type: 'json_schema', json_schema: { name: format.name ?? 'output', schema: format.schema, strict: false } } }
      : {}),
  };
}

export async function chatCompletions(request: TextRequest, style: ChatCompletionsStyle): Promise<TextReply> {
  const { config } = request;
  const body = JSON.stringify(chatCompletionsBody(request.model.modelId, request.parameters, style));
  const response = await providerFetch(httpOptions(style.label, config, request.http), {
    method: 'POST',
    url: `${config.baseUrl}/chat/completions`,
    headers: { 'content-type': 'application/json' },
    auth: authOf(config),
    body: () => body,
    timeoutMs: textTimeoutMs(request.http),
    signal: request.signal,
    classify: classifyChatCompletions,
    onRetry: request.onRetry,
  });
  return parseChatCompletion(response.json(), style);
}

export function parseChatCompletion(value: unknown, style: Pick<ChatCompletionsStyle, 'label' | 'version'>): TextReply {
  if (!isObject(value)) throw new ProviderFailure('protocol', PH.notObject({ label: style.label }).text);
  const choice = Array.isArray(value.choices) ? value.choices.find(isObject) : undefined;
  if (!choice) throw new ProviderFailure('protocol', PH.missingField({ label: style.label, field: 'choices' }).text);
  const message = isObject(choice.message) ? choice.message : {};
  // Model refused to answer during structured output (`refusal`): handled as content filtering.
  const refused = typeof message.refusal === 'string' && message.refusal.trim().length > 0;
  const text = typeof message.content === 'string' ? message.content : '';
  const finishReason: TextFinishReason = refused ? 'content-filter' : finishOf(choice.finish_reason, style.label);
  const usage = isObject(value.usage) ? usageOf(value.usage) : null;
  return {
    text,
    finishReason,
    usage,
    modelVersion: typeof value.model === 'string' && value.model ? value.model : null,
    workerVersion: style.version,
  };
}

/** `prompt_tokens` already includes cache hits; the hit count is in `prompt_tokens_details.cached_tokens`, and some providers use `prompt_cache_hit_tokens`. */
function usageOf(usage: Record<string, unknown>): NonNullable<TextReply['usage']> {
  const details = isObject(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
  const cached = countOf(details.cached_tokens) ?? countOf(usage.prompt_cache_hit_tokens);
  return {
    inputTokens: countOf(usage.prompt_tokens),
    outputTokens: countOf(usage.completion_tokens),
    ...(cached !== null && cached > 0 ? { cachedTokens: cached } : {}),
  };
}

function finishOf(value: unknown, label: string): TextFinishReason {
  // Some compatible endpoints do not send `finish_reason`: treat it as a normal stop.
  if (value === 'stop' || value === null || value === undefined) return 'stop';
  if (value === 'length') return 'length';
  if (value === 'content_filter') return 'content-filter';
  throw new ProviderFailure('protocol', PH.unexpectedFinish({ label, reason: String(value).slice(0, 40) }).text);
}

/** Context too long → `INPUT_TOO_LONG`; model not found → `PROVIDER_REJECTED` (`model-not-found`); input blocked by content filter → `content-filter`. */
export function classifyChatCompletions(status: number, body: string): { code: RejectionCode; reason?: string } | null {
  const code = errorCode(body);
  if (code === 'context_length_exceeded' || (status === 400 && /maximum context length|context length|too many tokens/i.test(body))) {
    return { code: 'INPUT_TOO_LONG', reason: 'context-length' };
  }
  if (code === 'model_not_found' || (status === 404 && /model/i.test(body)))
    return { code: 'PROVIDER_REJECTED', reason: 'model-not-found' };
  if (code === 'content_filter' || code === 'content_policy_violation') return { code: 'PROVIDER_REJECTED', reason: 'content-filter' };
  if (code === 'insufficient_quota') return { code: 'PROVIDER_QUOTA_EXCEEDED', reason: 'insufficient-quota' };
  if (status === 429) return { code: 'PROVIDER_QUOTA_EXCEEDED', reason: 'rate-limited' };
  return null;
}

function errorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: unknown; type?: unknown } };
    const code = parsed.error?.code ?? parsed.error?.type;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

function countOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

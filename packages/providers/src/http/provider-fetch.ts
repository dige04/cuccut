import { ProviderFailure } from '@cuccut/models';
import type { Localized } from '@cuccut/protocol';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

/**
 * HTTP requests for online providers (architecture design §6.4): the global `fetch`, plus these rules.
 *
 * - **Keys** are sent only in the header named by `auth`, and only to the origin of the original request (scheme + host + port). Error messages, `details` and thrown text
 *   all have keys removed first (both literal occurrences and strings shaped like `sk-…`, `sk_…`, `AIza…`), and are then truncated.
 * - **Response bodies** are read fully into memory, up to 64 MB (binary responses such as speech and images too, counted in bytes).
 * - **Redirects** are handled manually (`redirect: 'manual'`), at most 3: same-origin redirects keep the key as usual; cross-origin GET redirects drop the key before following; cross-origin POST redirects are not followed, because that would send material to an address the user did not configure, and fail directly with `PROVIDER_REJECTED`; cross-origin DELETE is not followed either.
 * - **Retries**: connection failures, timeouts and 5xx are retried with backoff, 3 attempts in total; if still failing, it is `unavailable-remote` (`PROVIDER_UNAVAILABLE`, with `details.reason` of `unreachable`, `timeout` or `server-error`). When a response carries `Retry-After`, wait for that (at most 30 seconds) instead of the backoff.
 *   4xx is not retried: 401/403 is `PROVIDER_AUTH_FAILED`; 429 is `PROVIDER_QUOTA_EXCEEDED` (both rate limiting and quota exhaustion are 429). Only a 429 with a `Retry-After` of no more than 30 seconds (rate limiting) waits that long and then retries within the same 3 attempts; one without it, or with a longer one (quota exhaustion), fails immediately, and `details.retryAfterSec` records the number of seconds the provider gave. Other 4xx are `PROVIDER_REJECTED`. Adapters can rewrite the classification in `classify` (for example, Google's 400 `API_KEY_INVALID` is an authentication failure, and context too long is `INPUT_TOO_LONG`) and supply `details.reason`.
 *   `onRetry` is called before each retry (for counting).
 * - **Cancellation**: when `signal` aborts, the in-flight request is aborted immediately (the connection closes with it), and `ProviderAborted` is thrown.
 */

export class ProviderAborted extends Error {
  constructor() {
    super(PH.aborted().text);
    this.name = 'ProviderAborted';
  }
}

export interface ProviderHttpOptions {
  /** Human-readable provider name, used in error messages. */
  label: string;
  /** Keys to strip from error messages. */
  secrets: readonly string[];
  /** How long to wait before retrying after the nth failure (milliseconds); default 500·2^(n-1) plus jitter. Injected by tests. */
  backoffMs?: (attempt: number) => number;
  /** Total number of attempts (default 3). */
  attempts?: number;
}

export interface ProviderRequest {
  method: 'GET' | 'POST' | 'DELETE';
  url: string;
  /** Request headers without the key. */
  headers?: Record<string, string>;
  /** Request headers including the key: sent only to the origin of the original request. */
  auth?: { header: string; value: string } | null;
  /** Rebuilt on every attempt (retries and redirects both need a fresh request body). */
  body?: () => BodyInit | Promise<BodyInit>;
  /** Time limit for a single attempt. */
  timeoutMs: number;
  signal: AbortSignal;
  /** Lets an adapter rewrite the 4xx classification (may include `details.reason`); return null to use the default classification. */
  classify?: (status: number, body: string) => RejectionCode | { code: RejectionCode; reason?: string } | null;
  /** Called once before each backoff retry. */
  onRetry?: () => void;
}

export type RejectionCode = 'PROVIDER_AUTH_FAILED' | 'PROVIDER_QUOTA_EXCEEDED' | 'PROVIDER_REJECTED' | 'INPUT_TOO_LONG';

/** Maximum time to wait per `Retry-After` (seconds); a 429 that asks for longer is treated as quota exhaustion and is not retried. */
export const MAX_RETRY_AFTER_SEC = 30;

class AttemptTimeout extends Error {}

export interface ProviderResponse {
  status: number;
  /** Raw bytes of the response body (used for binary responses such as speech). */
  bytes: Buffer;
  /** The `content-type` response header; null if absent. */
  contentType: string | null;
  /** Response body decoded as UTF-8 text. */
  readonly text: string;
  json<T = unknown>(): T;
}

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const MESSAGE_LIMIT = 300;

export async function providerFetch(options: ProviderHttpOptions, request: ProviderRequest): Promise<ProviderResponse> {
  const attempts = options.attempts ?? 3;
  const backoff = options.backoffMs ?? defaultBackoff;
  let last: { status: number | null; message: string; reason: 'unreachable' | 'timeout' | 'server-error' } = {
    status: null,
    message: '',
    reason: 'unreachable',
  };
  const retry = async (attempt: number, delayMs: number) => {
    if (attempt >= attempts) return;
    request.onRetry?.();
    await sleep(delayMs, request.signal);
  };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (request.signal.aborted) throw new ProviderAborted();
    let response: Response;
    let body: Buffer;
    try {
      response = await send(options, request);
      body = await readBody(response);
    } catch (error) {
      if (error instanceof ProviderAborted || error instanceof ProviderFailure) throw error;
      if (request.signal.aborted) throw new ProviderAborted();
      last = {
        status: null,
        message: redact(errorText(error), options.secrets),
        reason: error instanceof AttemptTimeout ? 'timeout' : 'unreachable',
      };
      await retry(attempt, backoff(attempt));
      continue;
    }
    const status = response.status;
    if (status >= 200 && status < 300) return wrap(status, body, response.headers.get('content-type'), options);
    const text = body.toString('utf8');
    const retryAfter = retryAfterSeconds(response.headers.get('retry-after'));
    if (status >= 500) {
      last = { status, message: providerMessage(text, options.secrets), reason: 'server-error' };
      await retry(attempt, retryAfter !== null ? Math.min(retryAfter, MAX_RETRY_AFTER_SEC) * 1000 : backoff(attempt));
      continue;
    }
    const classified = request.classify?.(status, text) ?? defaultClassify(status);
    const { code, reason } = typeof classified === 'string' ? { code: classified, reason: undefined } : classified;
    // Rate limit: with a Retry-After that is not too long, wait it out and retry within the same attempt budget.
    if (
      code === 'PROVIDER_QUOTA_EXCEEDED' &&
      reason !== 'insufficient-quota' &&
      retryAfter !== null &&
      retryAfter <= MAX_RETRY_AFTER_SEC &&
      attempt < attempts
    ) {
      await retry(attempt, retryAfter * 1000);
      continue;
    }
    const message = providerMessage(text, options.secrets);
    throw new ProviderFailure('rejected', described(PH.rejected({ label: options.label, status }), message), {
      code,
      status,
      ...(reason ? { reason } : {}),
      ...(status === 429 && retryAfter !== null ? { retryAfterSec: retryAfter } : {}),
    });
  }
  const what = last.status === null ? PH.unreachable({ label: options.label }) : PH.httpStatus({ label: options.label, status: last.status });
  throw new ProviderFailure(
    'unavailable-remote',
    described(attempts > 1 ? PH.failedAfterAttempts({ what, attempts }) : what, last.message),
    {
      code: 'PROVIDER_UNAVAILABLE',
      reason: last.reason,
      attempts,
      ...(last.status !== null ? { status: last.status } : {}),
    },
  );
}

/** `Retry-After`: seconds or an HTTP date; null if it cannot be parsed. */
export function retryAfterSeconds(value: string | null, now: number = Date.now()): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/** One attempt: follows redirects manually. */
async function send(options: ProviderHttpOptions, request: ProviderRequest): Promise<Response> {
  const origin = new URL(request.url).origin;
  let url = request.url;
  let method = request.method;
  for (let hop = 0; ; hop++) {
    const sameOrigin = new URL(url).origin === origin;
    const headers: Record<string, string> = { ...request.headers };
    if (request.auth && sameOrigin) headers[request.auth.header] = request.auth.value;
    const timeout = AbortSignal.timeout(request.timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout]);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        redirect: 'manual',
        signal,
        ...(method === 'POST' && request.body ? { body: await request.body() } : {}),
      });
    } catch (error) {
      if (request.signal.aborted) throw new ProviderAborted();
      if (timeout.aborted) throw new AttemptTimeout(PH.noResponse({ label: options.label, seconds: Math.round(request.timeoutMs / 1000) }).text);
      throw error;
    }
    if (response.status < 300 || response.status >= 400 || !response.headers.has('location')) return response;
    await response.body?.cancel().catch(() => {});
    if (hop >= MAX_REDIRECTS) throw failure(options, PH.tooManyRedirects({ label: options.label }).text);
    let next: URL;
    try {
      next = new URL(response.headers.get('location')!, url);
    } catch {
      throw failure(options, PH.badRedirect({ label: options.label }).text);
    }
    if (next.protocol !== 'https:' && next.protocol !== 'http:') throw failure(options, PH.redirectProtocol({ label: options.label }).text);
    if (method !== 'GET' && next.origin !== origin) {
      throw failure(options, PH.redirectOrigin({ label: options.label }).text);
    }
    // 301/302/303 switch to GET by convention; 307/308 keep the method and request body.
    if (method === 'POST' && (response.status === 301 || response.status === 302 || response.status === 303)) method = 'GET';
    url = next.toString();
  }
}

/** A short explanation, followed by the original text when there is one. */
function described(text: Localized, message: string | null | undefined): string {
  return (message ? PH.withMessage({ text, message }) : text).text;
}

function failure(options: ProviderHttpOptions, message: string): ProviderFailure {
  return new ProviderFailure('rejected', redact(message, options.secrets), { code: 'PROVIDER_REJECTED' });
}

function defaultClassify(status: number): RejectionCode {
  if (status === 401 || status === 403) return 'PROVIDER_AUTH_FAILED';
  if (status === 429) return 'PROVIDER_QUOTA_EXCEEDED';
  return 'PROVIDER_REJECTED';
}

async function readBody(response: Response): Promise<Buffer> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new ProviderFailure('protocol', PH.responseTooLarge().text);
  }
  if (!response.body) return Buffer.alloc(0);
  // Count while reading: even without content-length (chunked transfer), do not exceed the limit.
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_BODY_BYTES) {
      await response.body.cancel().catch(() => {});
      throw new ProviderFailure('protocol', PH.responseTooLarge().text);
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, total);
}

function wrap(status: number, bytes: Buffer, contentType: string | null, options: ProviderHttpOptions): ProviderResponse {
  let text: string | null = null;
  return {
    status,
    bytes,
    contentType,
    get text() {
      text ??= bytes.toString('utf8');
      return text;
    },
    json<T>(): T {
      try {
        return JSON.parse(this.text) as T;
      } catch {
        throw new ProviderFailure('protocol', PH.invalidJson({ label: options.label }).text);
      }
    },
  };
}

/** The human-readable message from a provider's error body (OpenAI and Google both use `{ error: { message } }`), with keys removed and truncated. */
function providerMessage(text: string, secrets: readonly string[]): string {
  let message = text;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } | string; message?: unknown };
    const candidate = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? parsed.message);
    if (typeof candidate === 'string') message = candidate;
  } catch {
    // Not JSON: use the raw text.
  }
  return redact(message.replace(/\s+/g, ' ').trim(), secrets);
}

/** Remove keys: both literal occurrences and common key shapes; then truncate to 300 characters. */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) if (secret) out = out.split(secret).join('[REDACTED]');
  out = out.replace(/\bsk[-_][A-Za-z0-9_-]{8,}/g, '[REDACTED]').replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]');
  return out.length > MESSAGE_LIMIT ? `${out.slice(0, MESSAGE_LIMIT)}…` : out;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: { code?: unknown } }).cause;
    return typeof cause?.code === 'string' ? PH.errorCode({ message: error.message, code: cause.code }).text : error.message;
  }
  return String(error);
}

function defaultBackoff(attempt: number): number {
  return 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new ProviderAborted());
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ProviderAborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

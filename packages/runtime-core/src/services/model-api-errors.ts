import { RpcError, refOf, type JobError, type Localized, type MessageRef } from '@cuccut/protocol';
import { RcModelApi } from '@cuccut/protocol/messages/runtime-core';

/**
 * Errors of the model API service (architecture design §4.8): OpenAI's error body `{ error: { message, type, code } }` and the HTTP status. `code` is
 * CucCut's closed set of error codes (the model API service section of the command and protocol spec §11.3); `type` takes OpenAI's wording for the status.
 * Carries only an error code and one sentence of explanation: no `details` (they may contain cause strings and paths, §12.8). The explanation is text in the language current at the time it is emitted; the error body has no reference field, so the reference stays only on `messageRef`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;
  readonly messageRef: MessageRef | undefined;

  constructor(status: number, code: string, message: string | Localized, headers: Record<string, string> = {}) {
    super(String(message));
    this.status = status;
    this.code = code;
    this.headers = headers;
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }

  get type(): string {
    return errorType(this.status);
  }

  body(): { error: { message: string; type: string; code: string; param: null } } {
    return { error: { message: this.message, type: this.type, code: this.code, param: null } };
  }
}

export function errorType(status: number): string {
  switch (status) {
    case 401:
      return 'authentication_error';
    case 403:
      return 'permission_error';
    case 404:
      return 'not_found_error';
    case 429:
      return 'rate_limit_error';
    case 503:
      return 'service_unavailable_error';
    default:
      return status >= 500 ? 'server_error' : 'invalid_request_error';
  }
}

/** `RpcError` at submission (selection, argument check) → HTTP. */
export function fromRpcError(error: RpcError): ApiError {
  const details = (error.details ?? {}) as { code?: unknown };
  const code = typeof details.code === 'string' ? details.code : null;
  switch (error.code) {
    case 'invalid-request':
      return new ApiError(400, 'INVALID_REQUEST', error.message);
    case 'not-found':
      return new ApiError(404, 'MODEL_NOT_FOUND', error.message);
    case 'busy':
      return new ApiError(503, 'RUNTIME_BUSY', error.message);
    // Authorization for sending data out (§12.5): no authorization, or a revoked one, is 403; budget used up or an amount that cannot be computed is 409.
    case 'forbidden':
      if (code === 'GRANT_REQUIRED' || code === 'GRANT_REVOKED') return new ApiError(403, code, error.message);
      return new ApiError(403, 'FORBIDDEN', error.message);
    case 'conflict':
      if (code === 'CAPABILITY_NOT_CONFIGURED' || code === 'MODEL_UNAVAILABLE') return new ApiError(503, code, error.message);
      return new ApiError(409, code ?? 'CONFLICT', error.message);
    default:
      return new ApiError(500, 'INTERNAL', RcModelApi.internalError());
  }
}

/** Job failure (the Job's error code) → HTTP. On rate limiting, the provider's `Retry-After` is passed on to the caller. */
export function fromJobError(error: JobError | null): ApiError {
  if (!error) return new ApiError(500, 'INTERNAL', RcModelApi.jobNotCompleted());
  const details = (error.details ?? {}) as { retryAfterSec?: unknown };
  switch (error.code) {
    case 'PROVIDER_QUOTA_EXCEEDED': {
      const retry = typeof details.retryAfterSec === 'number' && details.retryAfterSec >= 0 ? Math.ceil(details.retryAfterSec) : null;
      return new ApiError(429, error.code, error.message, retry !== null ? { 'Retry-After': String(retry) } : {});
    }
    case 'PROVIDER_REJECTED':
    case 'INPUT_TOO_LONG':
    case 'ASSET_MISSING':
      return new ApiError(400, error.code, error.message);
    case 'MODEL_OUTPUT_INVALID':
    case 'PROVIDER_AUTH_FAILED':
    case 'PROVIDER_UNAVAILABLE':
    case 'REMOTE_NODE_REJECTED':
    case 'REMOTE_NODE_LOST':
      return new ApiError(502, error.code, error.message);
    case 'JOB_INTERRUPTED':
      return new ApiError(503, error.code, error.message);
    // Authorization revoked before the start; budget insufficient at automatic retry (§12.5, §7.8).
    case 'GRANT_REVOKED':
    case 'GRANT_REQUIRED':
      return new ApiError(403, error.code, error.message);
    case 'BUDGET_EXCEEDED':
    case 'BUDGET_UNVERIFIABLE':
    case 'TASK_BUDGET_EXCEEDED':
    case 'TASK_BUDGET_UNVERIFIABLE':
      return new ApiError(409, error.code, error.message);
    default:
      return new ApiError(500, /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code) ? error.code : 'INTERNAL', error.message);
  }
}

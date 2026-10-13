import type { AgentErrorCode } from '@cuccut/protocol';
import type { CodexErrorInfo, CodexTurnError } from './codex-protocol.ts';

/**
 * Codex turn error → `AgentErrorCode` (architecture design §3.11). It checks the structured `codexErrorInfo` first, and falls back to keyword matching on the raw text when that cannot tell.
 *
 * Structured fields (checked against the 0.159.0 schema and codex source `protocol/src/error.rs`'s `to_codex_protocol_error`):
 * - `unauthorized` (refresh token failed) → must log in again.
 * - `usageLimitExceeded` (usage, quota, plan does not include it), `rateLimitExceeded` → rate-limited or quota exhausted.
 * - Variants with an HTTP status: 401 → must log in again, 429 → rate-limited.
 * - `serverOverloaded` (“Selected model is at capacity. Please try a different model.”) → model temporarily unavailable; switching models lets you continue.
 * - `other`, `badRequest`, `internalServerError`, connection errors without a status, or simply no structured field: check the raw text.
 *   Upstream “model not found” (HTTP 404 `Model not found ...`) and old CLIs not recognizing new models both land here.
 * - Everything else (context too long, budget, sandbox, content policy…) is not in these groups, gives null, and the UI only shows the raw text.
 */
export function classifyCodexError(error: Pick<CodexTurnError, 'message' | 'codexErrorInfo' | 'additionalDetails'>): AgentErrorCode | null {
  const info = error.codexErrorInfo ?? null;
  const structured = classifyInfo(info);
  if (structured !== undefined) return structured;
  return classifyCodexErrorText([error.message, error.additionalDetails ?? ''].join('\n'));
}

/** undefined = the structured field cannot tell; leave it to the raw text. */
function classifyInfo(info: CodexErrorInfo | null): AgentErrorCode | null | undefined {
  if (info === null) return undefined;
  if (typeof info === 'string') {
    switch (info) {
      case 'unauthorized':
        return 'AGENT_AUTH_REQUIRED';
      case 'usageLimitExceeded':
      case 'rateLimitExceeded':
        return 'AGENT_RATE_LIMITED';
      case 'serverOverloaded':
        return 'AGENT_MODEL_UNAVAILABLE';
      case 'other':
      case 'badRequest':
      case 'internalServerError':
        return undefined;
      default:
        return null;
    }
  }
  if ('activeTurnNotSteerable' in info) return null;
  const status = Object.values(info)[0]?.httpStatusCode ?? null;
  if (status === 401) return 'AGENT_AUTH_REQUIRED';
  if (status === 429) return 'AGENT_RATE_LIMITED';
  return undefined;
}

/**
 * Word list for the raw-text fallback. The account group matches `AUTH_NEEDLES` in the design draft `designs/cuccut/app/model-agent-setup.js`
 * (the same table as the kernel's `agent_setup::auth_failure`): only phrases that clearly point to the account are accepted; the `auth` stem, denied and forbidden are not.
 * The model group includes the design draft's `MODEL_GATE_NEEDLES` (old CLI does not recognize the new model in the config).
 */
const MODEL_NEEDLES = [
  'requires a newer version of codex',
  'is not supported when using codex',
  'model not found',
  'model_not_found',
  'unknown model',
  'model does not exist',
];
const AUTH_NEEDLES = [
  'oauth',
  'authenticate',
  'authentication',
  'unauthorized',
  'not logged in',
  'not signed in',
  'log in',
  'login',
  'sign in',
  'signed out',
  'session expired',
  'token expired',
  'expired token',
  'invalid token',
  'credential',
  'api key',
  'apikey',
];
const RATE_NEEDLES = ['rate limit', 'rate_limit', 'ratelimit', 'usage limit', 'too many requests', 'quota', 'insufficient_quota'];

/** Classification based only on the raw text. The model group is checked first, so that in 「不支持用 ChatGPT 账号使用这个模型」 (“This model is not supported with a ChatGPT account”) the “account” is not read as a login problem. */
export function classifyCodexErrorText(text: string): AgentErrorCode | null {
  const t = text.toLowerCase();
  if (MODEL_NEEDLES.some((n) => t.includes(n))) return 'AGENT_MODEL_UNAVAILABLE';
  if (AUTH_NEEDLES.some((n) => t.includes(n)) || /\b401\b/.test(t)) return 'AGENT_AUTH_REQUIRED';
  if (RATE_NEEDLES.some((n) => t.includes(n)) || /\b429\b/.test(t)) return 'AGENT_RATE_LIMITED';
  return null;
}

import { describe, expect, it } from 'vitest';
import { classifyCodexError, classifyCodexErrorText } from './codex-error.ts';
import type { CodexErrorInfo } from './codex-protocol.ts';

const err = (message: string, codexErrorInfo: CodexErrorInfo | null = null, additionalDetails: string | null = null) => ({
  message,
  codexErrorInfo,
  additionalDetails,
});

describe('classifyCodexError', () => {
  it('structured fields take precedence', () => {
    expect(classifyCodexError(err('Your access token could not be refreshed.', 'unauthorized'))).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexError(err("You've hit your usage limit.", 'usageLimitExceeded'))).toBe('AGENT_RATE_LIMITED');
    expect(classifyCodexError(err('Rate limit reached', 'rateLimitExceeded'))).toBe('AGENT_RATE_LIMITED');
    expect(classifyCodexError(err('Selected model is at capacity. Please try a different model.', 'serverOverloaded'))).toBe(
      'AGENT_MODEL_UNAVAILABLE',
    );
    expect(classifyCodexError(err('stream error', { responseStreamDisconnected: { httpStatusCode: 401 } }))).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexError(err('stream error', { httpConnectionFailed: { httpStatusCode: 429 } }))).toBe('AGENT_RATE_LIMITED');
  });

  it('other explicit structured reasons do not fall into these categories, even if the raw text contains keywords', () => {
    expect(classifyCodexError(err('context window exceeded; please log in again', 'contextWindowExceeded'))).toBeNull();
    expect(classifyCodexError(err('sandbox denied', 'sandboxError'))).toBeNull();
    expect(classifyCodexError(err('cannot steer', { activeTurnNotSteerable: { turnKind: 'review' } }))).toBeNull();
  });

  it('other, badRequest, connection errors without a status, and no structured field: look at the raw text', () => {
    expect(classifyCodexError(err('unexpected status 404 Not Found: Model not found gpt-x', 'other'))).toBe('AGENT_MODEL_UNAVAILABLE');
    expect(classifyCodexError(err('unexpected status 401 Unauthorized', 'other'))).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexError(err('bad request', 'badRequest', 'invalid api key provided'))).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexError(err('stream failed', { responseStreamConnectionFailed: { httpStatusCode: null } }))).toBeNull();
    expect(classifyCodexError(err('Too Many Requests'))).toBe('AGENT_RATE_LIMITED');
    expect(classifyCodexError(err('something broke'))).toBeNull();
  });
});

describe('classifyCodexErrorText', () => {
  it('model category takes precedence over account category', () => {
    expect(classifyCodexErrorText("The 'gpt-9' model is not supported when using Codex with a ChatGPT account.")).toBe(
      'AGENT_MODEL_UNAVAILABLE',
    );
    expect(classifyCodexErrorText('This model requires a newer version of Codex.')).toBe('AGENT_MODEL_UNAVAILABLE');
    expect(classifyCodexErrorText('unknown model: foo')).toBe('AGENT_MODEL_UNAVAILABLE');
  });

  it('account category follows the design\'s word list; auth roots, denied and forbidden are not included', () => {
    expect(classifyCodexErrorText('Not logged in. Run codex login.')).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexErrorText('session expired')).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexErrorText('HTTP 401')).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyCodexErrorText('permission denied: author.txt')).toBeNull();
    expect(classifyCodexErrorText('403 Forbidden')).toBeNull();
    // 401 only matches a standalone number.
    expect(classifyCodexErrorText('wrote 14012 bytes')).toBeNull();
  });

  it('rate-limit category', () => {
    expect(classifyCodexErrorText('usage limit reached for image_gen')).toBe('AGENT_RATE_LIMITED');
    expect(classifyCodexErrorText('insufficient_quota')).toBe('AGENT_RATE_LIMITED');
    expect(classifyCodexErrorText('status 429')).toBe('AGENT_RATE_LIMITED');
  });
});

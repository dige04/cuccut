import { ProviderFailure } from '@cuccut/models';
import type {
  ModelServiceCapability,
  ProviderAccountStatus,
  UsageRecord,
  UsageRecordCost,
  UsageSource,
  UsageUnits,
} from '@cuccut/protocol';
import { ProvidersHttp as PH } from '@cuccut/protocol/messages/providers';

/**
 * Report at the end of an online call (architecture design §6.8, §6.10). The executor hands the call's outcome (success or failure) to the source at the call's end. The source writes one usage record and updates the state of the account that was used, according to the result. Only calls that actually sent a request to the provider are reported. Calls that were not enabled, or had no key and so were never sent, and cancelled calls, are not reported.
 */
export interface CallReport {
  capability: ModelServiceCapability;
  modelId: string;
  source: UsageSource;
  ref?: UsageRecord['ref'];
  /** The account used (fixed when the key was taken at execution); null when there is no account. */
  accountId: string | null;
  /** `Date.now()` at call start. */
  startedAt: number;
  units: UsageUnits;
  /** Amount reported by the provider; omitted when absent (recorded as `unknown`). */
  cost?: UsageRecordCost;
  /** Reason for failure; omitted on success. */
  error?: unknown;
}

export type CallReporter = (report: CallReport) => void;

/**
 * Account state that corresponds to the call result (§6.8). Success is `ok`; authentication failure is `invalid-key`; quota exhaustion is `quota-exhausted`; other 429s are `rate-limited` (`until` is derived from `Retry-After`). Other failures are unrelated to the key and return null: only the last-used time is updated, and the state is not changed.
 */
export function accountStatusOf(error: unknown, at: string): ProviderAccountStatus | null {
  if (error === undefined) return { state: 'ok', at };
  if (!(error instanceof ProviderFailure)) return null;
  const code = error.details.code;
  const detail = error.message.slice(0, 200);
  if (code === 'PROVIDER_AUTH_FAILED') return { state: 'invalid-key', at, detail };
  if (code === 'PROVIDER_QUOTA_EXCEEDED') {
    if (error.details.reason === 'insufficient-quota') return { state: 'quota-exhausted', at, detail };
    const retryAfter = error.details.retryAfterSec;
    const until = typeof retryAfter === 'number' && retryAfter > 0 ? new Date(Date.parse(at) + retryAfter * 1000).toISOString() : null;
    return { state: 'rate-limited', at, ...(until ? { until } : {}), detail };
  }
  return null;
}

/** Failure reason written to the ledger: an error code and a one-line description (the `ProviderFailure` text has already had the key removed). */
export function usageErrorOf(error: unknown): string {
  if (error instanceof ProviderFailure) {
    const code = typeof error.details.code === 'string' ? error.details.code : error.kind;
    return `${code}: ${error.message}`.slice(0, 300);
  }
  return `PROVIDER_UNAVAILABLE: ${PH.requestIncomplete().text}`;
}

import type { Money } from './grants.ts';
import type { ModelServiceCapability } from './models.ts';

/**
 * Usage ledger (architecture design §6.10): each real call that an online Provider finishes appends one line to `<home>/store/usage.jsonl` (mode 0600).
 * The ledger records facts only: usage and the amount the provider reports. Estimates at list price are computed at read time (`models.usage`) and are not written to the ledger.
 * Local and node computations are not recorded.
 */

/** Usage of one call. `cachedTokens` is part of `inputTokens`. */
export interface UsageUnits {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  audioSeconds?: number;
  chars?: number;
  images?: number;
}

/** Where the call came from: a task, in-process (such as translation inside a flow), an agent's tool, or a connectivity test. */
export type UsageSource = 'job' | 'inline' | 'agent-tool' | 'verify';

/** Amount: written as `reported` only when the provider reports it in the response; otherwise `unknown`. */
export type UsageRecordCost = { kind: 'reported'; amount: string; currency: 'USD' | 'CNY' } | { kind: 'unknown' };

export interface UsageRecord {
  /** ISO 8601。 */
  at: string;
  providerId: string;
  /** Which account was used. Null for agent Providers, custom endpoints without a key, and verification of accounts not yet saved. */
  accountId: string | null;
  /** Only verification keys (`source: 'verify'`) are null. */
  capability: ModelServiceCapability | null;
  /** Only verification keys (`source: 'verify'`) are null. */
  modelId: string | null;
  source: UsageSource;
  ref?: { jobId?: string; taskId?: string; conversationId?: string };
  units: UsageUnits;
  cost: UsageRecordCost;
  durationMs: number;
  status: 'ok' | 'error';
  /** Reason for the failure (without the key). */
  error?: string;
}

export const USAGE_PERIODS = ['today', '7d', '30d', 'all'] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

/**
 * Where a row's amount comes from (§6.10):
 * - `reported`: every amount that can be computed is provider-reported;
 * - `estimated`: every amount is estimated from the price table (`model-prices`);
 * - `mixed`: both;
 * - `unknown`: neither.
 */
export type UsageCostKind = 'reported' | 'estimated' | 'mixed' | 'unknown';

export interface UsageRow {
  key: string;
  label: string;
  providerId?: string;
  calls: number;
  failed: number;
  units: UsageUnits;
  /** Totals of reported and estimated amounts, one entry per currency (no conversion). Empty when no amount can be computed. */
  cost: Money[];
  costKind: UsageCostKind;
}

/**
 * Result of `models.usage` (architecture design §6.10). Amounts are split into 'provider-reported', 'estimated at list price' and 'unknown'; they are not merged into one number. Different currencies
 * are totaled separately, without conversion (`Money[]` has one entry per currency; empty when there are none).
 */
export interface UsageReport {
  /** With `all`, `from` is the time of the earliest record (same as `to` when there are no records). */
  period: { from: string; to: string };
  totals: {
    calls: number;
    failed: number;
    units: UsageUnits;
    cost: { estimated: Money[]; reported: Money[]; unknownCalls: number };
  };
  /** By local date (`YYYY-MM-DD`). */
  byDay: Array<{ day: string; calls: number; units: UsageUnits; byCapability: Partial<Record<ModelServiceCapability, number>> }>;
  byProvider: UsageRow[];
  byCapability: UsageRow[];
  byModel: UsageRow[];
  byAccount: UsageRow[];
}

export interface UsageRequest {
  period: UsagePeriod;
  providerId?: string;
}

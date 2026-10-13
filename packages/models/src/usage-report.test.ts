import { describe, expect, it } from 'vitest';
import type { UsageRecord } from '@cuccut/protocol';
import type { ModelUnitPrice } from './model-prices.ts';
import { buildUsageReport, periodStart } from './usage-report.ts';

// Local time 2026-10-06 12:00 (reports are split by the local machine's date).
const NOW = new Date(2026, 9, 6, 12, 0, 0);
const at = (daysAgo: number, hour = 10) => new Date(2026, 9, 6 - daysAgo, hour, 0, 0).toISOString();

const PRICES: Record<string, ModelUnitPrice> = {
  'anthropic/claude-sonnet-5-5': { currency: 'USD', inputPerMTok: '2', outputPerMTok: '10', cachedPerMTok: '0.2' },
  'openai/whisper-1': { currency: 'USD', audioPerMinute: '0.006' },
  'qwen/qwen3.8-max': { currency: 'CNY', inputPerMTok: '2.4', outputPerMTok: '9.6' },
};
const price = (providerId: string, modelId: string) => PRICES[`${providerId}/${modelId}`] ?? null;

function rec(overrides: Partial<UsageRecord>): UsageRecord {
  return {
    at: at(0),
    providerId: 'anthropic',
    accountId: 'main',
    capability: 'generateText',
    modelId: 'claude-sonnet-5-5',
    source: 'job',
    units: {},
    cost: { kind: 'unknown' },
    durationMs: 100,
    status: 'ok',
    ...overrides,
  };
}

const RECORDS: UsageRecord[] = [
  // Estimate: (1,000,000 − 200,000) × 2 + 200,000 × 0.2 + 100,000 × 10 = 1.6 + 0.04 + 1.0 = 2.64 USD
  rec({ units: { inputTokens: 1_000_000, cachedTokens: 200_000, outputTokens: 100_000 } }),
  // The reported amount takes precedence over the estimate.
  rec({ units: { inputTokens: 10, outputTokens: 10 }, cost: { kind: 'reported', amount: '0.5', currency: 'USD' }, accountId: 'b2' }),
  // Usage incomplete: unknown.
  rec({ units: { inputTokens: 10 }, status: 'error', error: 'PROVIDER_REJECTED: x' }),
  // Transcription: 90 s × 0.006 / 60 = 0.009 USD; two days ago.
  rec({ at: at(2), providerId: 'openai', capability: 'transcribe', modelId: 'whisper-1', units: { audioSeconds: 90 } }),
  // Other currencies are totaled separately: 1,000,000 × 2.4 / 1e6 = 2.4 CNY; ten days ago.
  rec({ at: at(10), providerId: 'qwen', modelId: 'qwen3.8-max', accountId: 'gone', units: { inputTokens: 1_000_000, outputTokens: 0 } }),
  // Not in the price table: unknown. The agent Provider has no account.
  rec({ at: at(1), providerId: 'agent:codex', accountId: null, capability: 'generateImage', modelId: 'codex-image', units: { images: 1 } }),
  // Verification: no cost is counted, and it is not counted as unknown.
  rec({ source: 'verify', capability: null, modelId: null, accountId: null }),
  // Outside the time range: 40 days ago.
  rec({ at: at(40), units: { inputTokens: 1, outputTokens: 1 } }),
];

describe('buildUsageReport', () => {
  it('time ranges by local date: today starts at midnight, 7d / 30d include today, all starts from the earliest entry', () => {
    expect(periodStart('today', NOW)).toEqual(new Date(2026, 9, 6));
    expect(periodStart('7d', NOW)).toEqual(new Date(2026, 8, 30));
    expect(periodStart('30d', NOW)).toEqual(new Date(2026, 8, 7));
    expect(periodStart('all', NOW)).toBeNull();
    const all = buildUsageReport(RECORDS, { period: 'all', now: NOW, price });
    expect(all.period).toEqual({ from: at(40), to: NOW.toISOString() });
    expect(all.totals.calls).toBe(8);
    expect(buildUsageReport([], { period: 'all', now: NOW }).period).toEqual({ from: NOW.toISOString(), to: NOW.toISOString() });
  });

  it('30 days: totals, three kinds of amounts kept separate, currencies not converted, unknown counts', () => {
    const report = buildUsageReport(RECORDS, { period: '30d', now: NOW, price });
    expect(report.totals).toEqual({
      calls: 7,
      failed: 1,
      units: { inputTokens: 2_000_020, cachedTokens: 200_000, outputTokens: 100_010, audioSeconds: 90, images: 1 },
      cost: {
        estimated: [
          { amount: '2.40', currency: 'CNY' },
          { amount: '2.649', currency: 'USD' },
        ],
        reported: [{ amount: '0.50', currency: 'USD' }],
        unknownCalls: 2,
      },
    });
    expect(report.byDay).toHaveLength(30);
    expect(report.byDay.at(-1)).toEqual({
      day: '2026-10-06',
      calls: 4,
      units: { inputTokens: 1_000_020, cachedTokens: 200_000, outputTokens: 100_010 },
      byCapability: { generateText: 3 },
    });
  });

  it('grouping: provider, capability, model, account; amount source of each row', () => {
    const report = buildUsageReport(RECORDS, {
      period: '7d',
      now: NOW,
      price,
      providerLabel: (id) => ({ anthropic: 'Anthropic', openai: 'OpenAI' })[id] ?? id,
      accountLabel: (_providerId, accountId) => (accountId === 'main' ? 'sk-…1234' : null),
    });
    const anthropic = report.byProvider.find((r) => r.key === 'anthropic')!;
    expect(anthropic).toMatchObject({
      label: 'Anthropic',
      calls: 4,
      failed: 1,
      cost: [{ amount: '3.14', currency: 'USD' }],
      costKind: 'mixed',
    });
    expect(report.byProvider.find((r) => r.key === 'openai')).toMatchObject({
      costKind: 'estimated',
      cost: [{ amount: '0.009', currency: 'USD' }],
    });
    expect(report.byProvider.find((r) => r.key === 'agent:codex')).toMatchObject({ costKind: 'unknown', cost: [] });
    // Verification with no capability and no model: not included in these two groups.
    expect(report.byCapability.map((r) => [r.key, r.calls])).toEqual([
      ['generateText', 3],
      ['generateImage', 1],
      ['transcribe', 1],
    ]);
    expect(report.byModel.find((r) => r.key === 'anthropic/claude-sonnet-5-5')).toMatchObject({ label: 'claude-sonnet-5-5', calls: 3 });
    const accounts = Object.fromEntries(report.byAccount.map((r) => [r.key, r.label]));
    expect(accounts).toMatchObject({
      'anthropic/main': 'sk-…1234',
      'anthropic/b2': 'b2',
      'agent:codex/': 'agent:codex（无账号）',
    });
  });

  it('only one provider; today only includes today', () => {
    const report = buildUsageReport(RECORDS, { period: '30d', providerId: 'qwen', now: NOW, price });
    expect(report.totals).toMatchObject({
      calls: 1,
      cost: { estimated: [{ amount: '2.40', currency: 'CNY' }], reported: [], unknownCalls: 0 },
    });
    expect(buildUsageReport(RECORDS, { period: 'today', now: NOW, price }).totals.calls).toBe(4);
  });
});

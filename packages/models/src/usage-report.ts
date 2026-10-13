import {
  microsToMoney,
  moneyToMicros,
  type Money,
  type ModelServiceCapability,
  type UsageCostKind,
  type UsagePeriod,
  type UsageRecord,
  type UsageReport,
  type UsageRow,
  type UsageUnits,
} from '@cuccut/protocol';
import { ModelsUsageReport as M } from '@cuccut/protocol/messages/models/usage-report.ts';
import { CAPABILITY_LABELS } from './model-selection.ts';
import { modelPrice, type ModelUnitPrice } from './model-prices.ts';

/**
 * Summary for `models.usage` (architecture design §6.10), a pure function: read ledger records → `UsageReport`.
 *
 * - Time ranges follow the local date of the machine running the Runtime: `today` starts at midnight today; `7d` / `30d` are the last 7 / 30 days including today; `all` is unbounded
 *   (`from` is the time of the earliest record; the same as `to` when there are no records).
 * - Amounts: a record that has a provider-reported amount uses it. Otherwise, if the price table (`model-prices.ts`) has this model's unit price and the required usage is complete, it is estimated.
 *   Otherwise it is unknown and counted in `unknownCalls`. Verification keys (`source: 'verify'`) are not charged and are not counted as unknown. Different currencies are totaled separately, without conversion.
 * - Amounts are accumulated as integers in millionths (bigint), and only converted back to a decimal string at the end.
 */

export interface UsageReportOptions {
  period: UsagePeriod;
  providerId?: string;
  now?: Date;
  /** Price table (replaceable in tests); defaults to `model-prices.ts`. */
  price?: (providerId: string, modelId: string) => ModelUnitPrice | null;
  /** The Provider's display name; uses `providerId` when not given. */
  providerLabel?: (providerId: string) => string;
  /** The account's display name (the name, or a masked form when there is none); null when the account has been deleted, and it is then listed by `accountId`. */
  accountLabel?: (providerId: string, accountId: string) => string | null;
}

type Micros = Map<string, bigint>;

interface Acc {
  key: string;
  label: string;
  providerId?: string;
  calls: number;
  failed: number;
  units: UsageUnits;
  reported: Micros;
  estimated: Micros;
}

const UNIT_KEYS = ['inputTokens', 'outputTokens', 'cachedTokens', 'audioSeconds', 'chars', 'images'] as const;

export function buildUsageReport(records: readonly UsageRecord[], options: UsageReportOptions): UsageReport {
  const now = options.now ?? new Date();
  const price = options.price ?? modelPrice;
  const providerLabel = options.providerLabel ?? ((id: string) => id);
  const from = periodStart(options.period, now);
  const selected = records.filter((r) => {
    const at = Date.parse(r.at);
    return (from === null || at >= from.getTime()) && at <= now.getTime() && (!options.providerId || r.providerId === options.providerId);
  });

  const totals = newAcc('total', '');
  let unknownCalls = 0;
  const byProvider = new Map<string, Acc>();
  const byCapability = new Map<string, Acc>();
  const byModel = new Map<string, Acc>();
  const byAccount = new Map<string, Acc>();
  const byDay = new Map<string, { day: string; calls: number; units: UsageUnits; byCapability: Partial<Record<ModelServiceCapability, number>> }>();
  if (from !== null) for (let d = new Date(from); d.getTime() <= now.getTime(); d = nextDay(d)) byDay.set(localDay(d), emptyDay(localDay(d)));

  for (const record of selected) {
    const cost = costOf(record, price);
    if (cost === 'unknown') unknownCalls++;
    const targets = [totals, rowOf(byProvider, record.providerId, () => ({ label: providerLabel(record.providerId) }))];
    if (record.capability) targets.push(rowOf(byCapability, record.capability, () => ({ label: CAPABILITY_LABELS[record.capability!] })));
    if (record.modelId) {
      targets.push(
        rowOf(byModel, `${record.providerId}/${record.modelId}`, () => ({ label: record.modelId!, providerId: record.providerId })),
      );
    }
    const accountKey = `${record.providerId}/${record.accountId ?? ''}`;
    targets.push(
      rowOf(byAccount, accountKey, () => ({
        label:
          record.accountId === null
            ? M.noAccount({ provider: providerLabel(record.providerId) }).text
            : (options.accountLabel?.(record.providerId, record.accountId) ?? record.accountId),
        providerId: record.providerId,
      })),
    );
    for (const acc of targets) add(acc, record, cost);

    const dayKey = localDay(new Date(record.at));
    const day = byDay.get(dayKey) ?? emptyDay(dayKey);
    byDay.set(dayKey, day);
    day.calls++;
    addUnits(day.units, record.units);
    if (record.capability) day.byCapability[record.capability] = (day.byCapability[record.capability] ?? 0) + 1;
  }

  const earliest = selected.reduce<number | null>((min, r) => {
    const at = Date.parse(r.at);
    return min === null || at < min ? at : min;
  }, null);
  return {
    period: { from: (from ?? (earliest === null ? now : new Date(earliest))).toISOString(), to: now.toISOString() },
    totals: {
      calls: totals.calls,
      failed: totals.failed,
      units: totals.units,
      cost: { estimated: moneyList(totals.estimated), reported: moneyList(totals.reported), unknownCalls },
    },
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byProvider: rows(byProvider),
    byCapability: rows(byCapability),
    byModel: rows(byModel),
    byAccount: rows(byAccount),
  };
}

/** Start of the time range (local midnight); null for `all`. */
export function periodStart(period: UsagePeriod, now: Date): Date | null {
  if (period === 'all') return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = period === 'today' ? 0 : period === '7d' ? 6 : 29;
  start.setDate(start.getDate() - back);
  return start;
}

type RecordCost = { kind: 'reported' | 'estimated'; currency: string; micros: bigint } | 'unknown' | 'none';

/** A record's amount: reported, estimated, unknown, or not counted (verification). */
export function costOf(record: UsageRecord, price: (providerId: string, modelId: string) => ModelUnitPrice | null): RecordCost {
  if (record.cost.kind === 'reported') {
    return { kind: 'reported', currency: record.cost.currency, micros: moneyToMicros(record.cost.amount) };
  }
  if (record.source === 'verify') return 'none';
  if (!record.capability || !record.modelId) return 'unknown';
  const unit = price(record.providerId, record.modelId);
  if (!unit) return 'unknown';
  const micros = estimateMicros(record.capability, record.units, unit);
  return micros === null ? 'unknown' : { kind: 'estimated', currency: unit.currency, micros };
}

/** Estimate from the unit price (in millionths); null if either the required usage or the unit price is missing. */
function estimateMicros(capability: ModelServiceCapability, units: UsageUnits, unit: ModelUnitPrice): bigint | null {
  const p = (value: string | undefined) => (value === undefined ? null : moneyToMicros(value));
  switch (capability) {
    case 'generateText': {
      const input = p(unit.inputPerMTok);
      const output = p(unit.outputPerMTok);
      if (input === null || output === null || units.inputTokens === undefined || units.outputTokens === undefined) return null;
      const cached = Math.min(units.cachedTokens ?? 0, units.inputTokens);
      const cachedPrice = p(unit.cachedPerMTok) ?? input;
      const total =
        BigInt(Math.round(units.inputTokens - cached)) * input +
        BigInt(Math.round(cached)) * cachedPrice +
        BigInt(Math.round(units.outputTokens)) * output;
      return divRound(total, 1_000_000n);
    }
    case 'transcribe': {
      const perMinute = p(unit.audioPerMinute);
      if (perMinute === null || units.audioSeconds === undefined) return null;
      // Compute in milliseconds, to avoid floating-point seconds.
      return divRound(BigInt(Math.round(units.audioSeconds * 1000)) * perMinute, 60_000n);
    }
    case 'synthesizeSpeech': {
      const per1k = p(unit.per1kChars);
      if (per1k === null || units.chars === undefined) return null;
      return divRound(BigInt(Math.round(units.chars)) * per1k, 1000n);
    }
    case 'generateImage': {
      const perImage = p(unit.perImage);
      if (perImage === null || units.images === undefined) return null;
      return BigInt(Math.round(units.images)) * perImage;
    }
    default:
      return null;
  }
}

function divRound(value: bigint, by: bigint): bigint {
  return (value + by / 2n) / by;
}

function newAcc(key: string, label: string, providerId?: string): Acc {
  return { key, label, ...(providerId ? { providerId } : {}), calls: 0, failed: 0, units: {}, reported: new Map(), estimated: new Map() };
}

function rowOf(map: Map<string, Acc>, key: string, init: () => { label: string; providerId?: string }): Acc {
  let acc = map.get(key);
  if (!acc) {
    const { label, providerId } = init();
    acc = newAcc(key, label, providerId);
    map.set(key, acc);
  }
  return acc;
}

function add(acc: Acc, record: UsageRecord, cost: RecordCost): void {
  acc.calls++;
  if (record.status === 'error') acc.failed++;
  addUnits(acc.units, record.units);
  if (typeof cost === 'object') {
    const bucket = cost.kind === 'reported' ? acc.reported : acc.estimated;
    bucket.set(cost.currency, (bucket.get(cost.currency) ?? 0n) + cost.micros);
  }
}

function addUnits(into: UsageUnits, units: UsageUnits): void {
  for (const key of UNIT_KEYS) {
    const n = units[key];
    if (n !== undefined) into[key] = roundUnit((into[key] ?? 0) + n);
  }
}

/** Floating-point error from summing seconds is rounded to milliseconds. */
function roundUnit(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function moneyList(micros: Micros): Money[] {
  return [...micros]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => ({ amount: microsToMoney(value), currency }));
}

function rows(map: Map<string, Acc>): UsageRow[] {
  return [...map.values()]
    .map((acc) => {
      const merged: Micros = new Map(acc.reported);
      for (const [currency, value] of acc.estimated) merged.set(currency, (merged.get(currency) ?? 0n) + value);
      const costKind: UsageCostKind =
        acc.reported.size > 0 && acc.estimated.size > 0
          ? 'mixed'
          : acc.reported.size > 0
            ? 'reported'
            : acc.estimated.size > 0
              ? 'estimated'
              : 'unknown';
      return {
        key: acc.key,
        label: acc.label,
        ...(acc.providerId ? { providerId: acc.providerId } : {}),
        calls: acc.calls,
        failed: acc.failed,
        units: acc.units,
        cost: moneyList(merged),
        costKind,
      };
    })
    .sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));
}

function emptyDay(day: string): UsageReport['byDay'][number] {
  return { day, calls: 0, units: {}, byCapability: {} };
}

function nextDay(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return next;
}

function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}


import fs from 'node:fs/promises';
import path from 'node:path';
import { MODEL_SERVICE_CAPABILITIES, type UsageRecord, type UsageRecordCost, type UsageUnits } from '@cuccut/protocol';

/**
 * Usage ledger (architecture design §6.10): `<home>/store/usage.jsonl`, append-only, mode 0600, one `UsageRecord` per line.
 *
 * - Writes are serialized (one line at a time, `appendFile`). When a write fails, it is reported to `warn` and does not affect that call's result;
 * - When reading, bad lines are skipped (half-written lines, unrecognized fields) and the number of skipped lines is reported. A missing file is the only case treated as “no records”;
 *   other read errors are still thrown and are not treated as an empty ledger.
 */

export interface UsageLedgerOptions {
  /** Report for a failed write or a bad line read (contains no secrets: the records themselves contain none). */
  warn?: (message: string, data?: Record<string, unknown>) => void;
}

const SOURCES = new Set(['job', 'inline', 'agent-tool', 'verify']);
const UNIT_KEYS = ['inputTokens', 'outputTokens', 'cachedTokens', 'audioSeconds', 'chars', 'images'] as const;

export class UsageLedger {
  readonly file: string;
  readonly #options: UsageLedgerOptions;
  #chain: Promise<void> = Promise.resolve();
  #prepared = false;

  constructor(file: string, options: UsageLedgerOptions = {}) {
    this.file = file;
    this.#options = options;
  }

  /** Appends one record (queued after earlier writes). On failure, reports to `warn` and resolves; does not throw. */
  append(record: UsageRecord): Promise<void> {
    const line = `${JSON.stringify(record)}\n`;
    const next = this.#chain.then(async () => {
      if (!this.#prepared) await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.appendFile(this.file, line, { encoding: 'utf8', mode: 0o600 });
      if (!this.#prepared) {
        // The umask may have loosened the new file's permissions: tighten them once after the first write.
        await fs.chmod(this.file, 0o600);
        this.#prepared = true;
      }
    });
    this.#chain = next.catch((error: unknown) => {
      this.#options.warn?.("Couldn't write to the usage ledger", { error: error instanceof Error ? error.message : String(error) });
    });
    return this.#chain;
  }

  /** Reads all records (in file order). Bad lines are skipped and reported; empty when the file does not exist; other read errors are thrown. */
  async read(): Promise<UsageRecord[]> {
    await this.#chain;
    let text: string;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const records: UsageRecord[] = [];
    let skipped = 0;
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        skipped++;
        continue;
      }
      const record = parseUsageRecord(parsed);
      if (record) records.push(record);
      else skipped++;
    }
    if (skipped > 0) this.#options.warn?.('Skipped unrecognized lines in the usage ledger', { skipped });
    return records;
  }

  /** Waits for queued writes (used in tests and on stop). */
  flush(): Promise<void> {
    return this.#chain;
  }
}

/** Shape check for one record line; null when not recognized. */
export function parseUsageRecord(value: unknown): UsageRecord | null {
  if (!isObject(value)) return null;
  const { at, providerId, accountId, capability, modelId, source, units, cost, durationMs, status } = value;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof providerId !== 'string' || providerId === '') return null;
  if (accountId !== null && typeof accountId !== 'string') return null;
  if (typeof source !== 'string' || !SOURCES.has(source)) return null;
  const verify = source === 'verify';
  if (!(capability === null && verify) && !(MODEL_SERVICE_CAPABILITIES as readonly unknown[]).includes(capability)) return null;
  if (!(modelId === null && verify) && typeof modelId !== 'string') return null;
  if (status !== 'ok' && status !== 'error') return null;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return null;
  if (!isObject(units)) return null;
  const parsedUnits: UsageUnits = {};
  for (const key of UNIT_KEYS) {
    const n = units[key];
    if (n === undefined) continue;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
    parsedUnits[key] = n;
  }
  const parsedCost = parseCost(cost);
  if (!parsedCost) return null;
  const record: UsageRecord = {
    at,
    providerId,
    accountId: accountId as string | null,
    capability: capability as UsageRecord['capability'],
    modelId: modelId as string | null,
    source: source as UsageRecord['source'],
    units: parsedUnits,
    cost: parsedCost,
    durationMs,
    status,
  };
  if (isObject(value.ref)) {
    const ref: NonNullable<UsageRecord['ref']> = {};
    for (const key of ['jobId', 'taskId', 'conversationId'] as const) if (typeof value.ref[key] === 'string') ref[key] = value.ref[key];
    record.ref = ref;
  }
  if (typeof value.error === 'string') record.error = value.error;
  return record;
}

function parseCost(value: unknown): UsageRecordCost | null {
  if (!isObject(value)) return null;
  if (value.kind === 'unknown') return { kind: 'unknown' };
  if (value.kind !== 'reported') return null;
  if (typeof value.amount !== 'string' || !/^\d{1,12}(\.\d{1,6})?$/.test(value.amount)) return null;
  if (value.currency !== 'USD' && value.currency !== 'CNY') return null;
  return { kind: 'reported', amount: value.amount, currency: value.currency };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

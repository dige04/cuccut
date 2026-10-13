import { RpcError, type Localized } from '@cuccut/protocol';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import { joinList } from '../job-text.ts';

/** Validates pipeline parameters: when they are not valid, always `invalid-request`, saying which parameter. */
export class ParamReader {
  readonly #raw: Record<string, unknown>;
  readonly #known: Set<string>;

  constructor(raw: Record<string, unknown>, known: string[]) {
    this.#raw = raw;
    this.#known = new Set(known);
    for (const key of Object.keys(raw)) {
      if (!this.#known.has(key)) throw new RpcError('invalid-request', JobsParams.unknownParam({ key }));
    }
  }

  has(key: string): boolean {
    return this.#raw[key] !== undefined;
  }

  string(key: string, options: { max?: number; optional: true }): string | undefined;
  string(key: string, options?: { max?: number; optional?: false }): string;
  string(key: string, options: { max?: number; optional?: boolean } = {}): string | undefined {
    const value = this.#raw[key];
    if (value === undefined && options.optional) return undefined;
    if (typeof value !== 'string' || value.trim() === '') throw invalid(key, JobsParams.mustBeNonEmptyString());
    if (options.max !== undefined && value.length > options.max) throw invalid(key, JobsParams.atMostChars({ max: options.max }));
    return value;
  }

  int(key: string, min: number, max: number): number | undefined {
    const value = this.#raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw invalid(key, JobsParams.mustBeIntegerBetween({ min, max }));
    }
    return value;
  }

  oneOf<T extends string>(key: string, values: readonly T[]): T | undefined {
    const value = this.#raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !values.includes(value as T)) throw invalid(key, JobsParams.mustBeOneOf({ values: joinList(values) }));
    return value as T;
  }

  array(key: string, options: { min?: number; max: number; optional?: boolean }): unknown[] | undefined {
    const value = this.#raw[key];
    if (value === undefined && options.optional) return undefined;
    if (!Array.isArray(value)) throw invalid(key, JobsParams.mustBeArray());
    if (value.length < (options.min ?? 0)) throw invalid(key, JobsParams.atLeastItems({ min: options.min ?? 0 }));
    if (value.length > options.max) throw invalid(key, JobsParams.atMostItems({ max: options.max }));
    return value;
  }
}

/**
 * Parameter `key` is invalid: “parameter key problem”. `problem` takes a catalog entry (a predicate such as `JobsParams.mustBeBoolean()`: the Chinese starts with 「应为…」, the English is `must be …`). The reference travels with the error. When an older caller passes a string, it is concatenated as it is. For a whole sentence that cannot be expressed as “parameter key problem”, call `new RpcError('invalid-request', J.x({ ... }))` directly.
 */
export function invalid(key: string, problem: string | Localized): RpcError {
  return new RpcError('invalid-request', JobsParams.invalidParam({ key, problem }));
}

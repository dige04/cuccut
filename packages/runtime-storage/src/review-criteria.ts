import { emptyReviewStandard, type ReviewStandard } from '@cuccut/protocol';
import { salvageReviewStandard } from '@cuccut/protocol/schemas';
import { JsonStoreFile, isPlainObject, type StoreOptions } from './store-file.ts';

/** What the store holds: the user's review standard and a counter that moves on every write. */
export interface ReviewCriteriaState {
  standard: ReviewStandard;
  revision: number;
}

interface ReviewCriteriaFile extends ReviewCriteriaState {
  schemaVersion: 1;
}

/** `set` with an `expectedRevision` that is no longer current. */
export class ReviewCriteriaConflictError extends Error {
  readonly current: number;

  constructor(current: number) {
    super(`review criteria revision is ${current}`);
    this.name = 'ReviewCriteriaConflictError';
    this.current = current;
  }
}

/**
 * The user's review standard (`store/review-criteria.json`, docs/cuccut/m2-review-gate.md §3.3). A missing file means
 * built-ins only. The read is tolerant: a check or question that no longer parses is dropped and the rest kept; a file
 * that is not JSON is renamed and the store starts empty; a file written by a newer version is left alone and never
 * rewritten (`store-file.ts`). Writes are serialised. Validation and lint of a new standard are the caller's.
 */
export class ReviewCriteriaStore {
  readonly #file: JsonStoreFile;
  #state: ReviewCriteriaState = { standard: emptyReviewStandard(), revision: 0 };
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<ReviewCriteriaState> {
    const { value } = await this.#file.read({
      recognize: (raw) => (isPlainObject(raw.standard) || raw.standard === undefined ? raw : null),
      tolerateReadErrors: true,
    });
    this.#state = value
      ? { standard: salvageReviewStandard(value.standard), revision: revisionOf(value.revision) }
      : { standard: emptyReviewStandard(), revision: 0 };
    return this.get();
  }

  get(): ReviewCriteriaState {
    return structuredClone(this.#state);
  }

  /** Replaces the standard. With `expectedRevision`, refuses (`ReviewCriteriaConflictError`) when someone else wrote first. */
  async set(standard: ReviewStandard, expectedRevision?: number): Promise<ReviewCriteriaState> {
    if (expectedRevision !== undefined && expectedRevision !== this.#state.revision) {
      throw new ReviewCriteriaConflictError(this.#state.revision);
    }
    this.#state = { standard: structuredClone(standard), revision: this.#state.revision + 1 };
    const snapshot: ReviewCriteriaFile = { schemaVersion: 1, ...this.#state };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    await this.#saving;
    return this.get();
  }

  flush(): Promise<void> {
    return this.#saving.catch(() => {});
  }
}

function revisionOf(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

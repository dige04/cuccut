import fs from 'node:fs/promises';
import path from 'node:path';
import { TopicLog } from '@cuccut/harness';
import {
  REVIEW_RESULTS_DIR,
  REVIEW_RESULT_SCHEMA,
  type Id,
  type ReviewResult,
  type ReviewStandard,
  type ReviewSummary,
  type ReviewTopicEvent,
  type ReviewTopicSnapshot,
} from '@cuccut/protocol';
import { writeJsonAtomic } from '@cuccut/runtime-storage';

/**
 * Where review results live and how they move (docs/cuccut/m2-review-gate.md §3.3): one file per video at
 * `<sourceRoot>/.cuccut-out/reviews/<videoId>.json`, outside the edit history so checking never creates a revision,
 * in a dot folder Space does not scan. Each write replaces the file through a temp file and a rename. A half-written
 * file, or one of a schema this build does not know, reads as "not checked".
 */

/** Video ids are generated (`vid_…`); anything that could leave the folder is refused rather than written. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function reviewResultFile(sourceRoot: string, videoId: Id): string {
  if (!SAFE_ID.test(videoId)) throw new Error(`unsafe video id for a review file: ${videoId}`);
  return path.join(sourceRoot, ...REVIEW_RESULTS_DIR.split('/'), `${videoId}.json`);
}

export async function readReviewResult(file: string): Promise<ReviewResult | null> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const value = JSON.parse(text) as Partial<ReviewResult> | null;
    if (!value || typeof value !== 'object' || value.schema !== REVIEW_RESULT_SCHEMA) return null;
    if (typeof value.videoId !== 'string' || typeof value.revision !== 'string' || !Array.isArray(value.checks) || !Array.isArray(value.rubric)) return null;
    if (!value.measured || typeof value.measured !== 'object') return null;
    return value as ReviewResult;
  } catch {
    return null;
  }
}

export async function writeReviewResult(file: string, result: ReviewResult): Promise<void> {
  await writeJsonAtomic(file, result);
}

/**
 * The `review` topic: the user's standard and one summary per reviewed video. The snapshot holds the summaries written
 * since start plus those read through `review.get`; events say when either changes.
 */
export class ReviewTopic {
  readonly log: TopicLog<ReviewTopicSnapshot, ReviewTopicEvent>;
  readonly #summaries = new Map<Id, ReviewSummary>();
  readonly #criteria: () => { standard: ReviewStandard; revision: number };

  constructor(criteria: () => { standard: ReviewStandard; revision: number }) {
    this.#criteria = criteria;
    this.log = new TopicLog<ReviewTopicSnapshot, ReviewTopicEvent>(
      () => ({ criteria: this.#criteria(), results: Object.fromEntries(this.#summaries) }),
      '0',
    );
  }

  criteriaChanged(): void {
    const { standard, revision } = this.#criteria();
    this.log.publish({ type: 'criteria', standard, revision });
  }

  /** A result was written: remember it and tell subscribers. */
  resultWritten(videoId: Id, summary: ReviewSummary): void {
    this.#summaries.set(videoId, summary);
    this.log.publish({ type: 'result', videoId, summary });
  }

  /** A result was read (`review.get`): it joins the snapshot, and subscribers hear only when it differs from what they have. */
  resultRead(videoId: Id, summary: ReviewSummary): void {
    const known = this.#summaries.get(videoId);
    if (known && known.revision === summary.revision && known.at === summary.at) return;
    this.resultWritten(videoId, summary);
  }

  summary(videoId: Id): ReviewSummary | undefined {
    return this.#summaries.get(videoId);
  }
}

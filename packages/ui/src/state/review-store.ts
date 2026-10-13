import { create } from 'zustand';
import {
  reviewSummaryOf,
  type Id,
  type ReviewResult,
  type ReviewStandard,
  type ReviewSummary,
  type ReviewTopicEvent,
  type ReviewTopicSnapshot,
} from '@cuccut/protocol';
import { answeredSince } from '../model/review-rubric.ts';

/**
 * The review gate's mirror (`review` topic, docs/cuccut/m2-review-gate.md §4.5, §6): the user's standard and one summary
 * per reviewed video, kept by the session's subscription; the full result of a video is loaded on demand (the review
 * dialog) and refreshed when the topic says a newer one was written. Business state stays in the Runtime: the UI never
 * computes a verdict itself.
 */

/** What a video's review is doing right now: running, or a decision on one finding. */
export type ReviewBusy = 'run' | 'ask' | `waive:${string}` | `unwaive:${string}` | `severity:${string}`;

/** The questions were handed to an agent in this conversation at `since`; cleared when answers given since arrive. */
export interface ReviewAsking {
  conversationId: Id;
  since: string;
}

export interface ReviewStore {
  /** The user's standard and its revision; null until the topic's snapshot arrives. */
  criteria: { standard: ReviewStandard; revision: number } | null;
  results: Record<Id, ReviewSummary>;
  /** Full results loaded on demand: null = loaded, never checked. A video absent here was not asked for. */
  full: Record<Id, ReviewResult | null>;
  busy: Record<Id, ReviewBusy>;
  asking: Record<Id, ReviewAsking>;
  replace(snapshot: ReviewTopicSnapshot): void;
  apply(event: ReviewTopicEvent): void;
  setFull(videoId: Id, result: ReviewResult | null): void;
  setBusy(videoId: Id, busy: ReviewBusy | null): void;
  setAsking(videoId: Id, asking: ReviewAsking | null): void;
}

const without = <T>(record: Record<Id, T>, key: Id): Record<Id, T> => {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
};

export const useReview = create<ReviewStore>()((set) => ({
  criteria: null,
  results: {},
  full: {},
  busy: {},
  asking: {},
  replace: (snapshot) => set((s) => ({ criteria: snapshot.criteria, results: { ...s.results, ...snapshot.results } })),
  apply: (event) =>
    set((s) =>
      event.type === 'criteria'
        ? { criteria: { standard: event.standard, revision: event.revision } }
        : { results: { ...s.results, [event.videoId]: event.summary } },
    ),
  setFull: (videoId, result) =>
    set((s) => {
      const asking = s.asking[videoId];
      return {
        full: { ...s.full, [videoId]: result },
        ...(result ? { results: { ...s.results, [videoId]: reviewSummaryOf(result) } } : {}),
        ...(asking && result && answeredSince(result.answers, asking.since) ? { asking: without(s.asking, videoId) } : {}),
      };
    }),
  setBusy: (videoId, busy) => set((s) => ({ busy: busy ? { ...s.busy, [videoId]: busy } : without(s.busy, videoId) })),
  setAsking: (videoId, asking) => set((s) => ({ asking: asking ? { ...s.asking, [videoId]: asking } : without(s.asking, videoId) })),
}));

/**
 * Whether a `result` event should reload a video's full result: only for a video whose result was asked for, and only
 * when the summary says something newer than what is held.
 */
export function wantsFull(state: Pick<ReviewStore, 'full'>, videoId: Id, summary: ReviewSummary): boolean {
  if (!(videoId in state.full)) return false;
  const held = state.full[videoId];
  return !held || held.at !== summary.at || held.revision !== summary.revision;
}

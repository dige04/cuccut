import { beforeEach, describe, expect, it } from 'vitest';
import { emptyReviewStandard, type ReviewResult, type ReviewSummary } from '@cuccut/protocol';
import { useReview, wantsFull } from './review-store.ts';

const summary = (over: Partial<ReviewSummary> = {}): ReviewSummary => ({ verdict: 'passed', revision: '3', at: '2026-10-13T10:00:00Z', open: 0, stale: false, ...over });

const result = (over: Partial<ReviewResult> = {}): ReviewResult => ({
  schema: 'cuccut.review-result/1',
  videoId: 'vid_1',
  sequenceId: 'seq_1',
  videoName: 'Clip',
  at: '2026-10-13T10:00:00Z',
  revision: '3',
  criteriaSource: 'builtin',
  stages: ['project'],
  verdict: 'failed',
  checks: [{ id: 'placeholders', metric: 'items.placeholders', severity: 'critical', value: 1, limit: { max: 0 }, ok: false, fix: '' }],
  rubric: [],
  skipped: [],
  measured: { project: {} },
  ...over,
});

beforeEach(() => {
  useReview.setState({ criteria: null, results: {}, full: {}, busy: {}, asking: {} });
});

describe('review store', () => {
  it('mirrors the topic: snapshot, then criteria and result events', () => {
    const store = useReview.getState();
    store.replace({ criteria: { standard: emptyReviewStandard(), revision: 0 }, results: { vid_1: summary() } });
    expect(useReview.getState().criteria?.revision).toBe(0);
    store.apply({ type: 'criteria', standard: emptyReviewStandard(), revision: 2 });
    store.apply({ type: 'result', videoId: 'vid_2', summary: summary({ verdict: 'failed', open: 1 }) });
    expect(useReview.getState().criteria?.revision).toBe(2);
    expect(Object.keys(useReview.getState().results)).toEqual(['vid_1', 'vid_2']);
  });

  it('holds a full result with its summary, and reloads only what was asked for and is newer', () => {
    const state = useReview.getState();
    expect(wantsFull(state, 'vid_1', summary())).toBe(false);
    state.setFull('vid_1', null);
    expect(wantsFull(useReview.getState(), 'vid_1', summary())).toBe(true);
    state.setFull('vid_1', result());
    expect(useReview.getState().results.vid_1).toMatchObject({ verdict: 'failed', open: 1 });
    expect(wantsFull(useReview.getState(), 'vid_1', summary({ at: '2026-10-13T10:00:00Z', revision: '3' }))).toBe(false);
    expect(wantsFull(useReview.getState(), 'vid_1', summary({ at: '2026-10-13T11:00:00Z', revision: '4' }))).toBe(true);
  });

  it('clears asking once answers given since then arrive', () => {
    const state = useReview.getState();
    state.setAsking('vid_1', { conversationId: 'c_1', since: '2026-10-13T10:00:00Z' });
    state.setFull('vid_1', result({ answers: { revision: '3', at: '2026-10-13T09:00:00Z', by: 'agent', items: [] } }));
    expect(useReview.getState().asking.vid_1).toBeDefined();
    state.setFull('vid_1', result({ answers: { revision: '3', at: '2026-10-13T10:05:00Z', by: 'agent', items: [] } }));
    expect(useReview.getState().asking.vid_1).toBeUndefined();
  });

  it('tracks what a video’s review is busy with', () => {
    const state = useReview.getState();
    state.setBusy('vid_1', 'waive:blank');
    expect(useReview.getState().busy.vid_1).toBe('waive:blank');
    state.setBusy('vid_1', null);
    expect(useReview.getState().busy).toEqual({});
  });
});

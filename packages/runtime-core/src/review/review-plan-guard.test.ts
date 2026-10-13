import { describe, expect, it } from 'vitest';
import { REVIEW_PLAN_KIND } from '@cuccut/protocol';
import { writesReviewPlan } from './review-plan-guard.ts';

describe('the decisions document guard', () => {
  const documents = { plan: { kind: REVIEW_PLAN_KIND }, speech: { kind: 'speech' } };

  it('finds a putDocument of the review-plan kind or aimed at the existing plan', () => {
    expect(writesReviewPlan([{ type: 'putDocument', kind: REVIEW_PLAN_KIND, body: {} }], {})).toBe(true);
    expect(writesReviewPlan([{ type: 'addTrack' }, { type: 'putDocument', documentId: 'plan', kind: 'speech', body: {} }], documents)).toBe(true);
    expect(writesReviewPlan([{ type: 'putDocument', documentId: 'speech', kind: 'speech', body: {} }], documents)).toBe(false);
    expect(writesReviewPlan([{ type: 'putDocument', kind: 'translation', body: {} }], documents)).toBe(false);
  });
});

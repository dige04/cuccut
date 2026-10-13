import { describe, expect, it } from 'vitest';
import {
  REVIEW_BUILTIN_CHECKS,
  REVIEW_ID_PATTERN,
  REVIEW_LIMITS,
  REVIEW_METRICS,
  REVIEW_PLAN_SCHEMA,
  REVIEW_RESULT_SCHEMA,
  emptyReviewPlan,
  reviewAspectOf,
  reviewLimitOf,
  reviewMetric,
  reviewStaleness,
  reviewSummaryOf,
  type ReviewResult,
} from './review.ts';
import {
  reviewAnswersSchema,
  reviewCheckSchema,
  reviewPlanSchema,
  reviewQuestionSchema,
  reviewStandardSchema,
  salvageReviewPlan,
  salvageReviewStandard,
} from './review-schemas.ts';

describe('review catalogue', () => {
  it('names every metric once, each with a stage, a kind and a description', () => {
    const names = REVIEW_METRICS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const metric of REVIEW_METRICS) {
      expect(['project', 'export']).toContain(metric.stage);
      expect(['number', 'boolean']).toContain(metric.kind);
      expect(metric.what.length).toBeGreaterThan(0);
      expect(metric.name.startsWith('export.')).toBe(metric.stage === 'export');
    }
    expect(REVIEW_METRICS.filter((m) => m.stage === 'project')).toHaveLength(14);
    expect(REVIEW_METRICS.filter((m) => m.stage === 'export')).toHaveLength(5);
    expect(reviewMetric('items.placeholders')?.kind).toBe('number');
    expect(reviewMetric('vibes.goodness')).toBeUndefined();
  });

  it('ships built-in checks that are valid checks on known metrics, and only the placeholder one blocks', () => {
    for (const check of REVIEW_BUILTIN_CHECKS) {
      expect(reviewCheckSchema.safeParse(check).success).toBe(true);
      const metric = reviewMetric(check.metric);
      expect(metric?.stage).toBe('project');
      expect(metric?.kind === 'boolean' ? check.is !== undefined : check.min !== undefined || check.max !== undefined).toBe(true);
      expect(check.fix.length).toBeLessThanOrEqual(REVIEW_LIMITS.fix);
    }
    expect(REVIEW_BUILTIN_CHECKS.filter((c) => c.severity === 'critical').map((c) => c.id)).toEqual(['placeholders']);
  });

  it('phrases limits as structure and reads aspects with a tolerance', () => {
    expect(reviewLimitOf({ max: 0 })).toEqual({ max: 0 });
    expect(reviewLimitOf({ min: 3, max: 60 })).toEqual({ min: 3, max: 60 });
    expect(reviewLimitOf({ is: false })).toEqual({ is: false });
    expect(reviewAspectOf({ width: 1080, height: 1920 })).toBe('9:16');
    expect(reviewAspectOf({ width: 1920, height: 1080 })).toBe('16:9');
    expect(reviewAspectOf({ width: 1000, height: 1010 })).toBe('1:1');
    expect(reviewAspectOf({ width: 1080, height: 1350 })).toBe('1080:1350');
  });
});

describe('review schemas', () => {
  it('fills defaults and refuses what is not a check', () => {
    const parsed = reviewStandardSchema.parse({ checks: [{ id: 'long', metric: 'video.durationSec', max: 60 }] });
    expect(parsed.schema).toBe('cuccut.review-criteria/1');
    expect(parsed.checks[0]).toMatchObject({ severity: 'suggestion', fix: '' });
    expect(parsed.rubric).toEqual([]);
    expect(reviewCheckSchema.safeParse({ id: 'Bad Id', metric: 'video.durationSec' }).success).toBe(false);
    expect(reviewCheckSchema.safeParse({ id: 'x', metric: 'video.durationSec', max: Infinity }).success).toBe(false);
    expect(reviewCheckSchema.safeParse({ id: 'x', metric: 'video.durationSec', tags: ['a'] }).success).toBe(false);
    expect(reviewCheckSchema.safeParse({ id: 'x', metric: 'video.durationSec', aspect: '4:3' }).success).toBe(false);
    expect(reviewQuestionSchema.parse({ id: 'opens', ask: 'Does it open well?' })).toMatchObject({ evidence: 'timestamp', severity: 'suggestion' });
    expect(reviewQuestionSchema.safeParse({ id: 'opens', ask: '   ' }).success).toBe(false);
  });

  it('leaves length and count limits to lint, under a hard cap', () => {
    const many = Array.from({ length: REVIEW_LIMITS.checks + 1 }, (_, i) => ({ id: `c${i}`, metric: 'video.durationSec', max: i }));
    expect(reviewStandardSchema.safeParse({ checks: many }).success).toBe(true);
    expect(reviewCheckSchema.safeParse({ id: 'x', metric: 'video.durationSec', fix: 'a'.repeat(REVIEW_LIMITS.fix + 1) }).success).toBe(true);
    expect(reviewCheckSchema.safeParse({ id: 'x', metric: 'video.durationSec', fix: 'a'.repeat(20_000) }).success).toBe(false);
    expect(REVIEW_ID_PATTERN.test('a'.repeat(48))).toBe(true);
    expect(REVIEW_ID_PATTERN.test('a'.repeat(49))).toBe(false);
  });

  it('validates the plan and the answers', () => {
    expect(reviewPlanSchema.safeParse(emptyReviewPlan()).success).toBe(true);
    expect(
      reviewPlanSchema.safeParse({ ...emptyReviewPlan(), waivers: [{ id: 'long', reason: '', by: 'user', at: '2026-01-01T00:00:00Z' }] }).success,
    ).toBe(false);
    expect(reviewAnswersSchema.parse([{ id: 'opens', verdict: 'holds' }])[0]).toEqual({ id: 'opens', verdict: 'holds', evidence: '' });
    expect(reviewAnswersSchema.safeParse([]).success).toBe(false);
    expect(reviewAnswersSchema.safeParse([{ id: 'opens', verdict: 'maybe' }]).success).toBe(false);
  });

  it('salvages what parses from a standard or a plan on disk', () => {
    const standard = salvageReviewStandard({
      checks: [{ id: 'ok', metric: 'video.durationSec', max: 60 }, { id: 'Bad', metric: 'x' }, 'nonsense'],
      rubric: [{ id: 'q', ask: 'Is it clear?', evidence: 'quote' }, { id: 'q2' }],
    });
    expect(standard.checks.map((c) => c.id)).toEqual(['ok']);
    expect(standard.rubric.map((q) => q.id)).toEqual(['q']);
    expect(salvageReviewStandard(null)).toEqual({ schema: 'cuccut.review-criteria/1', checks: [], rubric: [] });

    const plan = salvageReviewPlan({
      schema: REVIEW_PLAN_SCHEMA,
      severities: { long: 'nitpick', bad: 'huge', 'Bad Id': 'critical' },
      reasons: { long: 'two-parter', other: 5 },
      waivers: [
        { id: 'a', reason: 'first', by: 'user', at: 't1' },
        { id: 'a', reason: 'second', by: 'agent', at: 't2' },
        { id: 'b', reason: '', by: 'user', at: 't3' },
      ],
    });
    expect(plan.severities).toEqual({ long: 'nitpick' });
    expect(plan.reasons).toEqual({ long: 'two-parter' });
    expect(plan.waivers).toEqual([{ id: 'a', reason: 'second', by: 'agent', at: 't2' }]);
    expect(salvageReviewPlan({ schema: 'something/2', severities: { a: 'critical' } })).toEqual(emptyReviewPlan());
  });
});

describe('review summaries', () => {
  const result = (over: Partial<ReviewResult> = {}): ReviewResult => ({
    schema: REVIEW_RESULT_SCHEMA,
    videoId: 'v',
    sequenceId: 's',
    videoName: 'V',
    at: '2026-01-01T00:00:00Z',
    revision: 'r2',
    criteriaSource: 'builtin',
    stages: ['project'],
    verdict: 'failed',
    checks: [
      { id: 'a', metric: 'items.placeholders', severity: 'critical', value: 1, limit: { max: 0 }, ok: false, fix: '' },
      { id: 'b', metric: 'text.offCanvas', severity: 'suggestion', value: true, limit: { is: false }, ok: false, fix: '', waived: { reason: 'r', by: 'user' } },
      { id: 'c', metric: 'video.longestBlankSec', severity: 'suggestion', value: 0, limit: { max: 0.5 }, ok: true, fix: '' },
    ],
    rubric: [],
    skipped: [],
    measured: { project: {} },
    ...over,
  });

  it('counts open findings and says which tiers are older', () => {
    expect(reviewSummaryOf(result())).toEqual({ verdict: 'failed', revision: 'r2', at: '2026-01-01T00:00:00Z', open: 1, stale: false });
    const withExport = result({ measured: { project: {}, export: { bag: {}, jobId: 'j', revision: 'r1' } } });
    expect(reviewSummaryOf(withExport).stale).toBe(true);
    expect(reviewStaleness(withExport, 'r3')).toEqual({ project: true, export: true, answers: false });
    expect(reviewStaleness(result(), 'r2')).toEqual({ project: false, export: false, answers: false });
  });
});

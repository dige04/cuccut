import { describe, expect, it } from 'vitest';
import { REVIEW_BUILTIN_CHECKS, emptyReviewPlan, type ReviewCheck, type ReviewPlan, type ReviewQuestion } from '@cuccut/protocol';
import { RcReview } from '@cuccut/protocol/messages/runtime-core';
import { activeCriteria, blocking, builtinChecks, evaluateChecks, evaluateRubric, severityOf, stackPlans, verdictOf } from './review-evaluate.ts';

/** Ported from agentcut's `review/__tests__/review.test.ts`: the arithmetic of a review, with no engine, render or agent. */

const plan = (over: Partial<ReviewPlan> = {}): ReviewPlan => ({ ...emptyReviewPlan(), ...over });
const check = (over: Partial<ReviewCheck> & Pick<ReviewCheck, 'id' | 'metric'>): ReviewCheck => ({ severity: 'suggestion', fix: '', ...over });
const question = (over: Partial<ReviewQuestion> & Pick<ReviewQuestion, 'id' | 'ask'>): ReviewQuestion => ({
  evidence: 'timestamp',
  severity: 'suggestion',
  fix: '',
  ...over,
});
const anyEvidence = () => true as const;
const waiver = (id: string, reason: string) => ({ id, reason, by: 'user' as const, at: '2026-01-01T00:00:00Z' });

describe('evaluating checks', () => {
  it('skips a check against a metric nobody took, with a reason, and does not fail it', () => {
    const checks = [
      check({ id: 'long', metric: 'video.durationSec', max: 60, severity: 'critical', fix: 'Trim it.' }),
      check({ id: 'loud', metric: 'export.loudnessLufs', max: -14 }),
      check({ id: 'invented', metric: 'vibes.goodness', max: 3 }),
      check({ id: 'square-only', metric: 'video.durationSec', max: 5, aspect: '1:1' }),
      check({ id: 'hook-words', metric: 'hook.words', max: 12 }),
    ];
    const { checks: results, skipped } = evaluateChecks(checks, { 'video.durationSec': 68 }, { plan: plan(), aspect: '9:16', stages: ['project'] });
    expect(results.map((r) => [r.id, r.ok])).toEqual([['long', false]]);
    expect(results[0]!.limit).toEqual({ max: 60 });
    expect(skipped).toEqual([
      { id: 'loud', reason: 'not-exported', detail: 'export.loudnessLufs' },
      { id: 'invented', reason: 'unknown-metric', detail: 'vibes.goodness' },
      { id: 'square-only', reason: 'aspect', detail: '9:16' },
      { id: 'hook-words', reason: 'unreadable', detail: 'hook.words' },
    ]);
    expect(verdictOf(results, [])).toBe('failed');
  });

  it('holds booleans to `is` and numbers to their range', () => {
    const checks = [
      check({ id: 'edge', metric: 'text.offCanvas', is: false }),
      check({ id: 'captions', metric: 'captions.on', is: true }),
      check({ id: 'pace', metric: 'video.cutsPerMin', min: 3, max: 30 }),
    ];
    const bag = { 'text.offCanvas': true, 'captions.on': true, 'video.cutsPerMin': 2 };
    const { checks: results } = evaluateChecks(checks, bag, { plan: plan(), aspect: '16:9', stages: ['project'] });
    expect(results.map((r) => [r.id, r.ok])).toEqual([
      ['edge', false],
      ['captions', true],
      ['pace', false],
    ]);
    expect(verdictOf(results, [])).toBe('passed-with-findings');
  });

  it('keeps a waived finding and its reason, and stops it deciding the verdict or blocking', () => {
    const checks = [check({ id: 'long', metric: 'video.durationSec', max: 60, severity: 'critical', fix: 'Trim it.' })];
    const waived = plan({ waivers: [waiver('long', 'it is a two-parter')] });
    const { checks: results } = evaluateChecks(checks, { 'video.durationSec': 68 }, { plan: waived, aspect: '9:16', stages: ['project'] });
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.waived).toEqual({ reason: 'it is a two-parter', by: 'user' });
    expect(verdictOf(results, [])).toBe('passed');
    expect(blocking(results)).toEqual([]);
  });

  it('stacks levels with the more local one winning, and carries the reason for a lowered severity', () => {
    const checks = [check({ id: 'rate', metric: 'captions.wordsPerSec', max: 4, severity: 'nitpick' })];
    const stacked = stackPlans(plan({ severities: { rate: 'suggestion' } }), plan({ severities: { rate: 'critical' }, waivers: [waiver('other', 'x')] }));
    const { checks: results } = evaluateChecks(checks, { 'captions.wordsPerSec': 6 }, { plan: stacked, aspect: '9:16', stages: ['project'] });
    expect(results[0]!.severity).toBe('critical');
    expect(results[0]!.lowered).toBeUndefined();
    expect(verdictOf(results, [])).toBe('failed');
    expect(blocking(results).map((c) => c.id)).toEqual(['rate']);

    const lowered = severityOf({ id: 'p', severity: 'critical' }, plan({ severities: { p: 'nitpick' }, reasons: { p: 'a draft' } }));
    expect(lowered).toEqual({ severity: 'nitpick', lowered: { from: 'critical', reason: 'a draft' } });
    const { checks: lowResults } = evaluateChecks(
      [check({ id: 'p', metric: 'items.placeholders', max: 0, severity: 'critical' })],
      { 'items.placeholders': 2 },
      { plan: plan({ severities: { p: 'suggestion' }, reasons: { p: 'a draft' } }), aspect: '9:16', stages: ['project'] },
    );
    expect(lowResults[0]!.lowered).toEqual({ from: 'critical', reason: 'a draft' });
    expect(blocking(lowResults)).toEqual([]);
  });

  it('says not-reviewed when nothing was decided', () => {
    expect(verdictOf([], [])).toBe('not-reviewed');
  });
});

describe('evaluating answers', () => {
  it('treats a missing answer and a "holds" with nothing to look at as cannot-tell', () => {
    const questions = [
      question({ id: 'opens', ask: 'Does it open on the comment?', severity: 'critical', fix: 'Extend the head.' }),
      question({ id: 'voice', ask: 'Does the hook sound like the reference?' }),
      question({ id: 'never-asked', ask: 'Is the sponsor read whole?' }),
      question({ id: 'sponsor', ask: 'Is the sponsor named?', evidence: 'quote' }),
    ];
    const answered = evaluateRubric(
      questions,
      [
        { id: 'opens', verdict: 'holds', evidence: '', note: 'looks right' },
        { id: 'voice', verdict: 'holds', evidence: '0.4s', note: 'a claim, not a summary' },
        { id: 'sponsor', verdict: 'holds', evidence: 'brought to you by nobody' },
      ],
      plan(),
      (q, evidence) => (q.evidence === 'quote' && evidence.includes('nobody') ? 'not in the transcript' : true),
    );
    expect(answered[0]).toMatchObject({ verdict: 'cannot-tell', ok: false, evidenceKind: 'timestamp' });
    expect(answered[0]!.note).toBe(`${RcReview.evidenceMissing().text} looks right`);
    expect(answered[1]).toMatchObject({ verdict: 'holds', ok: true, evidence: '0.4s' });
    expect(answered[2]).toMatchObject({ verdict: 'cannot-tell', note: RcReview.notReached().text });
    expect(answered[3]).toMatchObject({ verdict: 'cannot-tell', note: 'not in the transcript' });
    expect(verdictOf([], answered)).toBe('failed');
  });

  it('keeps "fails" as given, waives it with a reason, and never blocks an export on a question', () => {
    const questions = [question({ id: 'opens', ask: 'Does it open on the point?', severity: 'critical', fix: 'Start later.' })];
    const [result] = evaluateRubric(questions, [{ id: 'opens', verdict: 'fails', evidence: '' }], plan({ waivers: [waiver('opens', 'intro is wanted')] }), anyEvidence);
    expect(result).toMatchObject({ verdict: 'fails', ok: false, waived: { reason: 'intro is wanted', by: 'user' } });
    expect(verdictOf([], [result!])).toBe('passed');
  });
});

describe('the active standard', () => {
  it('uses the built-ins when the user has none, and words their fix in the current language', () => {
    const criteria = activeCriteria(builtinChecks(), { schema: 'cuccut.review-criteria/1', checks: [], rubric: [] });
    expect(criteria.source).toBe('builtin');
    expect(criteria.reason).toBe(RcReview.reasonBuiltin().text);
    expect(criteria.builtinIds).toEqual(REVIEW_BUILTIN_CHECKS.map((c) => c.id));
    expect(criteria.checks.find((c) => c.id === 'placeholders')!.fix).toBe(RcReview.builtinFixPlaceholders().text);
  });

  it('replaces a built-in for the metric the user names and keeps the rest', () => {
    const user = {
      schema: 'cuccut.review-criteria/1' as const,
      checks: [check({ id: 'my-placeholders', metric: 'items.placeholders', max: 2, severity: 'suggestion' }), check({ id: 'blank', metric: 'video.durationSec', max: 60 })],
      rubric: [question({ id: 'opens', ask: 'Does it open well?' })],
    };
    const criteria = activeCriteria(builtinChecks(), user);
    expect(criteria.source).toBe('user');
    expect(criteria.reason).toBe(RcReview.reasonUser().text);
    expect(criteria.builtinIds).toEqual(['text-edge']);
    expect(criteria.checks.map((c) => c.id)).toEqual(['text-edge', 'my-placeholders', 'blank']);
    expect(criteria.rubric.map((q) => q.id)).toEqual(['opens']);
  });
});

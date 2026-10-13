import { describe, expect, it } from 'vitest';
import { REVIEW_BUILTIN_CHECKS, REVIEW_LIMITS, type ReviewStandard } from '@cuccut/protocol';
import { lintStandard } from './review-lint.ts';

const standard = (over: Partial<ReviewStandard>): ReviewStandard => ({ schema: 'cuccut.review-criteria/1', checks: [], rubric: [], ...over });

describe('lint of a standard', () => {
  it('says what is wrong before it is saved, by code', () => {
    const issues = lintStandard(
      standard({
        checks: [
          { id: 'ghost', metric: 'video.vibes', max: 3, severity: 'suggestion', fix: '' },
          { id: 'shapeless', metric: 'video.durationSec', severity: 'suggestion', fix: '' },
          { id: 'wrong-kind', metric: 'captions.on', max: 1, severity: 'suggestion', fix: '' },
          { id: 'wrong-kind-2', metric: 'video.shots', is: true, severity: 'suggestion', fix: '' },
          { id: 'impossible', metric: 'video.durationSec', min: 90, max: 60, severity: 'suggestion', fix: '' },
          { id: 'unhelpful', metric: 'video.durationSec', max: 60, severity: 'critical', fix: '  ' },
        ],
        rubric: [{ id: 'unhelpful', ask: 'Is it good?', evidence: 'timestamp', severity: 'critical', fix: '' }],
      }),
    );
    const codes = issues.map((i) => `${i.level}:${i.code}:${i.id ?? ''}`);
    expect(codes).toEqual([
      'warning:unknown-metric:ghost',
      'warning:no-limit:shapeless',
      'warning:limit-kind:wrong-kind',
      'warning:limit-kind:wrong-kind-2',
      'warning:min-over-max:impossible',
      'warning:critical-no-fix:unhelpful',
      'error:duplicate-id:unhelpful',
      'warning:critical-no-fix:unhelpful',
    ]);
    expect(issues[0]!.suggestions).toEqual(['video.durationSec', 'video.shortSidePx', 'video.shots']);
  });

  it('refuses text over the limits and too many items', () => {
    const issues = lintStandard(
      standard({
        checks: Array.from({ length: REVIEW_LIMITS.checks + 1 }, (_, i) => ({
          id: `c${i}`,
          metric: 'video.durationSec',
          max: 60,
          severity: 'suggestion' as const,
          fix: i === 0 ? 'x'.repeat(REVIEW_LIMITS.fix + 1) : '',
        })),
        rubric: [{ id: 'q', ask: 'y'.repeat(REVIEW_LIMITS.ask + 1), evidence: 'quote', severity: 'nitpick', fix: '' }],
      }),
    );
    const errors = issues.filter((i) => i.level === 'error');
    expect(errors).toEqual([
      { code: 'too-many', level: 'error', field: 'checks', limit: REVIEW_LIMITS.checks },
      { code: 'too-long', level: 'error', id: 'c0', field: 'fix', limit: REVIEW_LIMITS.fix },
      { code: 'too-long', level: 'error', id: 'q', field: 'ask', limit: REVIEW_LIMITS.ask },
    ]);
  });

  it('has nothing to say about the built-ins', () => {
    expect(lintStandard(standard({ checks: [...REVIEW_BUILTIN_CHECKS] }))).toEqual([]);
  });
});

import { REVIEW_LIMITS, REVIEW_METRICS, reviewMetric, type ReviewLintIssue, type ReviewStandard } from '@cuccut/protocol';

/**
 * What is wrong with a standard, said before it is saved (docs/cuccut/m2-review-gate.md §4.1), ported from agentcut's
 * `review/lib/lint.ts`. A check nobody can take, or a critical finding with nothing to do about it, looks like a
 * standard and enforces nothing.
 *
 * Errors refuse the standard: two items with one id (a waiver could not say which it answers), text over the limits,
 * too many items. Everything else is a warning returned beside the saved standard. The UI words the codes.
 */
export function lintStandard(standard: ReviewStandard): ReviewLintIssue[] {
  const issues: ReviewLintIssue[] = [];
  if (standard.checks.length > REVIEW_LIMITS.checks) {
    issues.push({ code: 'too-many', level: 'error', field: 'checks', limit: REVIEW_LIMITS.checks });
  }
  if (standard.rubric.length > REVIEW_LIMITS.questions) {
    issues.push({ code: 'too-many', level: 'error', field: 'questions', limit: REVIEW_LIMITS.questions });
  }
  const seen = new Set<string>();
  const duplicate = (id: string) => {
    if (seen.has(id)) issues.push({ code: 'duplicate-id', level: 'error', id });
    seen.add(id);
  };
  const tooLong = (id: string, field: 'ask' | 'fix', text: string, limit: number) => {
    if (text.length > limit) issues.push({ code: 'too-long', level: 'error', id, field, limit });
  };

  for (const check of standard.checks) {
    duplicate(check.id);
    tooLong(check.id, 'fix', check.fix, REVIEW_LIMITS.fix);
    if (check.severity === 'critical' && !check.fix.trim()) issues.push({ code: 'critical-no-fix', level: 'warning', id: check.id });
    const known = reviewMetric(check.metric);
    if (!known) {
      issues.push({ code: 'unknown-metric', level: 'warning', id: check.id, metric: check.metric, suggestions: nearMetrics(check.metric) });
      continue;
    }
    if (check.min === undefined && check.max === undefined && check.is === undefined) {
      issues.push({ code: 'no-limit', level: 'warning', id: check.id });
    }
    if ((known.kind === 'boolean' && (check.min !== undefined || check.max !== undefined)) || (known.kind === 'number' && check.is !== undefined)) {
      issues.push({ code: 'limit-kind', level: 'warning', id: check.id, metric: check.metric });
    }
    if (check.min !== undefined && check.max !== undefined && check.min > check.max) {
      issues.push({ code: 'min-over-max', level: 'warning', id: check.id });
    }
  }
  for (const question of standard.rubric) {
    duplicate(question.id);
    tooLong(question.id, 'ask', question.ask, REVIEW_LIMITS.ask);
    tooLong(question.id, 'fix', question.fix, REVIEW_LIMITS.fix);
    if (question.severity === 'critical' && !question.fix.trim()) issues.push({ code: 'critical-no-fix', level: 'warning', id: question.id });
  }
  return issues;
}

/** Up to three catalogue names that look like the one asked for: same family first, then the same last word. */
function nearMetrics(name: string): string[] {
  const [family, ...rest] = name.toLowerCase().split('.');
  const last = rest.at(-1) ?? family;
  const names = REVIEW_METRICS.map((m) => m.name);
  const sameFamily = names.filter((n) => n.split('.')[0]!.toLowerCase() === family);
  const sameLast = names.filter((n) => !sameFamily.includes(n) && n.split('.').at(-1)!.toLowerCase().includes(last ?? ''));
  return [...sameFamily, ...(last ? sameLast : [])].slice(0, 3);
}

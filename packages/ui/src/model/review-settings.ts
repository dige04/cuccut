import {
  REVIEW_ASPECTS,
  REVIEW_ID_PATTERN,
  REVIEW_LIMITS,
  REVIEW_LINT_CODES,
  reviewMetric,
  type ReviewAspect,
  type ReviewCheck,
  type ReviewCriteriaView,
  type ReviewEvidence,
  type ReviewLimit,
  type ReviewLintIssue,
  type ReviewQuestion,
  type ReviewSeverity,
  type ReviewStandard,
} from '@cuccut/protocol';
import { REVIEW_COPY } from '../components/review/review-copy.ts';
import { metricLabel } from '../components/review/review-metrics-copy.ts';
import { REVIEW_SETTINGS_COPY as T } from '../components/settings/review-settings-copy.ts';
import { defaultCheckId, formatReviewValue, parseLimit, shortName } from './review.ts';

/**
 * Settings › Review in the UI's words and moves (docs/cuccut/m2-review-gate.md §2.3): the rows of the user's standard
 * (their own checks, then the built-ins nothing replaced), what lint says about it, and the edits the page makes. Pure:
 * every edit returns the next standard, which the page hands to `review.criteria.set` whole, so the Runtime's zod and
 * lint stay the only judges of what a standard may hold.
 */

/** One row of the checks list: the user's own, or a built-in that applies because the user has none for its metric. */
export interface CheckRow {
  check: ReviewCheck;
  builtin: boolean;
}

/** The checks the page lists: the user's own in their order, then the built-ins still in force. */
export function checkRows(view: Pick<ReviewCriteriaView, 'checks' | 'builtinIds' | 'standard'>): CheckRow[] {
  const builtin = new Set(view.builtinIds);
  return [
    ...view.standard.checks.map((check) => ({ check, builtin: false })),
    ...view.checks.filter((check) => builtin.has(check.id)).map((check) => ({ check, builtin: true })),
  ];
}

/** The limit in symbols, as Settings lists it: "≥ 3 s, ≤ 60 s", or "yes"/"no" for a yes-or-no. */
export function limitSymbols(metric: string, limit: ReviewLimit): string {
  if (limit.is !== undefined) return limit.is ? REVIEW_COPY.limit.yes : REVIEW_COPY.limit.no;
  const parts: string[] = [];
  if (limit.min !== undefined) parts.push(`≥ ${formatReviewValue(metric, limit.min)}`);
  if (limit.max !== undefined) parts.push(`≤ ${formatReviewValue(metric, limit.max)}`);
  return parts.join(', ');
}

/** A check as one line: "Length ≥ 3 s, ≤ 60 s · 9:16", "Text past the edge: no". */
export function checkLine(check: ReviewCheck): string {
  const label = metricLabel(check.metric);
  const limit = limitSymbols(check.metric, check);
  return check.is !== undefined ? T.checkIs(label, limit, check.aspect ?? null) : T.checkLine(label, limit, check.aspect ?? null);
}

/** What a question is worth and what its answer points at: "Critical · A quote". */
export function questionMeta(question: Pick<ReviewQuestion, 'severity' | 'evidence'>): string {
  return T.questionMeta(REVIEW_COPY.severity[question.severity], T.evidence[question.evidence]);
}

/** A question as its row's controls and the removal toast name it: the question cut to a short line, never its id. */
export function questionName(question: Pick<ReviewQuestion, 'ask'>): string {
  return shortName(question.ask);
}

/** The side list's line for Settings › Review: the user's counts, "Built-in" when they have nothing, null before the topic arrives. */
export function standardStatus(standard: ReviewStandard | null | undefined): string | null {
  if (!standard) return null;
  if (!standard.checks.length && !standard.rubric.length) return T.statusBuiltin;
  return T.status(standard.checks.length, standard.rubric.length);
}

/** One lint issue in words. The Runtime sends a code and the facts; the sentence is the UI's. */
export function lintText(issue: ReviewLintIssue): string {
  const id = issue.id ?? '';
  switch (issue.code) {
    case 'unknown-metric':
      return T.lint.unknownMetric(id, issue.metric ?? '', (issue.suggestions ?? []).join(', '));
    case 'no-limit':
      return T.lint.noLimit(id);
    case 'limit-kind':
      return T.lint.limitKind(id, issue.metric ? metricLabel(issue.metric) : '');
    case 'min-over-max':
      return T.lint.minOverMax(id);
    case 'critical-no-fix':
      return T.lint.criticalNoFix(id);
    case 'duplicate-id':
      return T.lint.duplicateId(id);
    case 'too-long':
      return T.lint.tooLong(id, issue.limit ?? 0);
    case 'too-many':
      return T.lint.tooMany(issue.limit ?? 0);
  }
}

const isLintIssue = (value: unknown): value is ReviewLintIssue =>
  !!value && typeof value === 'object' && (REVIEW_LINT_CODES as readonly string[]).includes((value as { code?: unknown }).code as string);

/** Why a save was refused: lint's errors in words when the Runtime sent them (`REVIEW_CRITERIA_INVALID`), else its message. */
export function criteriaErrorText(error: unknown): string {
  const details = (error as { details?: unknown } | null)?.details;
  const issues = details && typeof details === 'object' ? (details as { issues?: unknown }).issues : undefined;
  const lint = Array.isArray(issues) ? issues.filter(isLintIssue) : [];
  if (lint.length) return lint.map(lintText).join(' ');
  return error instanceof Error ? error.message : String(error);
}

/** The ids in use across checks and questions (a new one must not take one of them). */
export function takenIds(standard: ReviewStandard, builtinIds: readonly string[] = []): string[] {
  return [...standard.checks.map((c) => c.id), ...standard.rubric.map((q) => q.id), ...builtinIds];
}

/**
 * A new question's id: the first words of the question, lowercased and dashed (accents dropped), suffixed when taken;
 * "question" when nothing Latin is left (a question written in Chinese, say).
 */
export function defaultQuestionId(ask: string, taken: Iterable<string>): string {
  const slug = ask
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 4)
    .join('-')
    .slice(0, 44);
  return defaultCheckId(slug || 'question', taken);
}

/** What the add-a-check form holds. `limit` is typed for a number; `is` picked for a yes-or-no. */
export interface CheckDraft {
  metric: string;
  limit: string;
  is: boolean;
  aspect: ReviewAspect | 'any';
  severity: ReviewSeverity;
  fix: string;
}

export function emptyCheckDraft(): CheckDraft {
  return { metric: '', limit: '', is: false, aspect: 'any', severity: 'suggestion', fix: '' };
}

/** Why the draft cannot be added yet, in words (a disabled control says why); null when it can. */
export function checkDraftProblem(draft: CheckDraft): string | null {
  const metric = reviewMetric(draft.metric);
  if (!metric) return T.needMetric;
  if (metric.kind === 'number' && !parseLimit(draft.limit)) return draft.limit.trim() ? T.limitInvalid : T.needLimit;
  const fix = draft.fix.trim();
  if (draft.severity === 'critical' && !fix) return T.fixRequired;
  if (fix.length > REVIEW_LIMITS.fix) return T.tooLong(REVIEW_LIMITS.fix);
  return null;
}

/** The check a valid draft makes, with an id no other check or question uses. Null when the draft has a problem. */
export function checkFromDraft(draft: CheckDraft, taken: Iterable<string>): ReviewCheck | null {
  if (checkDraftProblem(draft)) return null;
  const metric = reviewMetric(draft.metric)!;
  const limit: ReviewLimit = metric.kind === 'boolean' ? { is: draft.is } : parseLimit(draft.limit)!;
  return {
    id: defaultCheckId(draft.metric, taken),
    metric: draft.metric,
    ...limit,
    severity: draft.severity,
    fix: draft.fix.trim(),
    ...(draft.aspect !== 'any' ? { aspect: draft.aspect } : {}),
  };
}

/** What the add-a-question form holds. */
export interface QuestionDraft {
  ask: string;
  evidence: ReviewEvidence;
  severity: ReviewSeverity;
  fix: string;
}

export function emptyQuestionDraft(): QuestionDraft {
  return { ask: '', evidence: 'timestamp', severity: 'suggestion', fix: '' };
}

export function questionDraftProblem(draft: QuestionDraft): string | null {
  const ask = draft.ask.trim();
  if (!ask) return T.needQuestion;
  if (ask.length > REVIEW_LIMITS.ask) return T.tooLong(REVIEW_LIMITS.ask);
  const fix = draft.fix.trim();
  if (draft.severity === 'critical' && !fix) return T.fixRequired;
  if (fix.length > REVIEW_LIMITS.fix) return T.tooLong(REVIEW_LIMITS.fix);
  return null;
}

export function questionFromDraft(draft: QuestionDraft, taken: Iterable<string>): ReviewQuestion | null {
  if (questionDraftProblem(draft)) return null;
  const ask = draft.ask.trim();
  return { id: defaultQuestionId(ask, taken), ask, evidence: draft.evidence, severity: draft.severity, fix: draft.fix.trim() };
}

/** The standard with one more check (or question) at the end, or back at `index` (Undo after a removal). */
export function withCheck(standard: ReviewStandard, check: ReviewCheck, index = standard.checks.length): ReviewStandard {
  const checks = standard.checks.filter((c) => c.id !== check.id);
  checks.splice(Math.min(Math.max(0, index), checks.length), 0, check);
  return { ...standard, checks };
}

export function withoutCheck(standard: ReviewStandard, id: string): ReviewStandard {
  return { ...standard, checks: standard.checks.filter((c) => c.id !== id) };
}

export function withQuestion(standard: ReviewStandard, question: ReviewQuestion, index = standard.rubric.length): ReviewStandard {
  const rubric = standard.rubric.filter((q) => q.id !== question.id);
  rubric.splice(Math.min(Math.max(0, index), rubric.length), 0, question);
  return { ...standard, rubric };
}

export function withoutQuestion(standard: ReviewStandard, id: string): ReviewStandard {
  return { ...standard, rubric: standard.rubric.filter((q) => q.id !== id) };
}

/**
 * A built-in given another severity: it becomes the user's own check on the same metric, with the same id, limit and
 * fix, so it replaces the built-in (built-ins apply only to metrics the user has no check for).
 */
export function withBuiltinSeverity(standard: ReviewStandard, builtin: ReviewCheck, severity: ReviewSeverity): ReviewStandard {
  return withCheck(standard, { ...builtin, severity });
}

/** A user check given another severity, in place. */
export function withCheckSeverity(standard: ReviewStandard, id: string, severity: ReviewSeverity): ReviewStandard {
  return { ...standard, checks: standard.checks.map((c) => (c.id === id ? { ...c, severity } : c)) };
}

export function withQuestionSeverity(standard: ReviewStandard, id: string, severity: ReviewSeverity): ReviewStandard {
  return { ...standard, rubric: standard.rubric.map((q) => (q.id === id ? { ...q, severity } : q)) };
}

/** The canvas shapes a check can be narrowed to, "any" first. */
export const ASPECT_CHOICES: readonly (ReviewAspect | 'any')[] = ['any', ...REVIEW_ASPECTS];

/** Whether an id is one the Runtime accepts (a generated id always is; kept for the test). */
export const validReviewId = (id: string): boolean => REVIEW_ID_PATTERN.test(id);

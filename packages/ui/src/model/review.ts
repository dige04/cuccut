import {
  REVIEW_SEVERITIES,
  reviewMetric,
  reviewStaleness,
  type ReviewCheckResult,
  type ReviewLimit,
  type ReviewLoweredMark,
  type ReviewResult,
  type ReviewSeverity,
  type ReviewSkipped,
  type ReviewSummary,
  type ReviewWaivedMark,
  type RubricResult,
} from '@cuccut/protocol';
import { REVIEW_COPY as C } from '../components/review/review-copy.ts';
import { metricLabel } from '../components/review/review-metrics-copy.ts';

/**
 * The review gate in the UI's words (docs/cuccut/m2-review-gate.md §2, §6): what a result says, grouped the way the
 * review dialog shows it, the limit a person types, the badge a short gets. Pure: the dialog, the export note, the
 * export rejection and Settings › Review all read through here, so they phrase a finding the same way.
 */

/** One finding as the dialog shows it: a measured check or an answered question, in the reader's language. */
export interface ReviewFinding {
  id: string;
  kind: 'check' | 'question';
  /** What a person calls it in a short line (a toast): the metric's label, or the question cut to a few words. */
  name: string;
  severity: ReviewSeverity;
  /** What was found ("Placeholder boxes is 2", or the question). */
  said: string;
  /** What it was held to ("asks for at most 0"), or what the answer said. */
  detail: string;
  fix: string;
  ok: boolean;
  waived?: ReviewWaivedMark;
  lowered?: ReviewLoweredMark;
}

export interface ReviewSkipLine {
  id: string;
  why: string;
}

export interface ReviewGroups {
  /** Failing and not let stand: what blocks (when critical) and what is worth reading. */
  open: ReviewFinding[];
  /** Failing, and let stand with a reason. */
  waived: ReviewFinding[];
  /** What the video holds to. */
  holds: ReviewFinding[];
  skipped: ReviewSkipLine[];
}

const RANK: Record<ReviewSeverity, number> = { nitpick: 0, suggestion: 1, critical: 2 };

/** A number as a person reads it: whole numbers as they are, others to two decimals at most. */
export function formatReviewNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

/** A measured value with the metric's unit: "12.5 s", "1080 px", "yes". */
export function formatReviewValue(metric: string, value: number | boolean): string {
  if (typeof value === 'boolean') return value ? C.limit.yes : C.limit.no;
  const unit = reviewMetric(metric)?.unit;
  return unit ? `${formatReviewNumber(value)} ${unit}` : formatReviewNumber(value);
}

/** A limit in words: "at most 0", "at least 3 s", "3 s to 60 s", "no". */
export function limitText(limit: ReviewLimit, metric?: string): string {
  if (limit.is !== undefined) return limit.is ? C.limit.yes : C.limit.no;
  const value = (n: number) => (metric ? formatReviewValue(metric, n) : formatReviewNumber(n));
  if (limit.min !== undefined && limit.max !== undefined) return C.limit.between(value(limit.min), value(limit.max));
  if (limit.min !== undefined) return C.limit.atLeast(value(limit.min));
  if (limit.max !== undefined) return C.limit.atMost(value(limit.max));
  return C.limit.any;
}

/** What a measured check says: "Placeholder boxes is 2" over "asks for at most 0". */
export function findingLine(check: Pick<ReviewCheckResult, 'metric' | 'value' | 'limit'>): { said: string; detail: string } {
  return {
    said: C.said(metricLabel(check.metric), formatReviewValue(check.metric, check.value)),
    detail: C.asksFor(limitText(check.limit, check.metric)),
  };
}

/** What an answered question says: the question over the answer (or why it could not be told). */
export function rubricLine(r: Pick<RubricResult, 'ask' | 'verdict' | 'note' | 'evidence'>): { said: string; detail: string } {
  if (r.verdict === 'cannot-tell') return { said: r.ask, detail: C.couldNotTell(r.note) };
  const verdict = r.verdict === 'holds' ? C.rubricVerdict.holds : C.rubricVerdict.fails;
  return { said: r.ask, detail: C.answered(verdict, r.note, r.evidence) };
}

/** Why a check or question was not decided on this video. */
export function skipText(s: ReviewSkipped): string {
  switch (s.reason) {
    case 'aspect':
      return C.skip.aspect(s.detail ?? '');
    case 'unknown-metric':
      return C.skip.unknownMetric(s.detail ?? s.id);
    case 'not-exported':
      return C.skip.notExported;
    case 'unreadable':
      return C.skip.unreadable(s.detail ? metricLabel(s.detail) : s.id);
    case 'not-asked':
      return C.skip.notAsked;
  }
}

/** A question cut to fit one short line: whole words up to about 48 characters, then an ellipsis. */
export function shortName(text: string, max = 48): string {
  const s = text.trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?]+$/, '')}…`;
}

function checkFinding(c: ReviewCheckResult): ReviewFinding {
  return {
    id: c.id,
    kind: 'check',
    name: metricLabel(c.metric),
    severity: c.severity,
    ...findingLine(c),
    fix: c.fix,
    ok: c.ok,
    ...(c.waived ? { waived: c.waived } : {}),
    ...(c.lowered ? { lowered: c.lowered } : {}),
  };
}

function rubricFinding(r: RubricResult): ReviewFinding {
  return {
    id: r.id,
    kind: 'question',
    name: shortName(r.ask) || r.id,
    severity: r.severity,
    ...rubricLine(r),
    fix: r.fix,
    ok: r.ok,
    ...(r.waived ? { waived: r.waived } : {}),
    ...(r.lowered ? { lowered: r.lowered } : {}),
  };
}

/** Most severe first; ties keep the result's order. */
function bySeverity(a: ReviewFinding, b: ReviewFinding): number {
  return RANK[b.severity] - RANK[a.severity];
}

/** The result as the dialog shows it: open, let stand, holds, not read. A waived finding stays a finding, with its reason. */
export function groupFindings(result: Pick<ReviewResult, 'checks' | 'rubric' | 'skipped'>): ReviewGroups {
  const all = [...result.checks.map(checkFinding), ...result.rubric.map(rubricFinding)];
  return {
    open: all.filter((f) => !f.ok && !f.waived).sort(bySeverity),
    waived: all.filter((f) => !f.ok && f.waived).sort(bySeverity),
    holds: all.filter((f) => f.ok),
    skipped: result.skipped.map((s) => ({ id: s.id, why: skipText(s) })),
  };
}

/**
 * The limit a person types for a number (Settings › Review): "≤ 60" (or "<= 60"), "≥ 3" (or ">= 3"), "3–60" (or "3-60",
 * "3..60"). Negative numbers work ("-16–-14"). A bare number is refused, as is a range whose low end is above its high
 * end: neither says which side is wrong. Null when it cannot be read.
 */
export function parseLimit(text: string): ReviewLimit | null {
  const s = text.trim().replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!s) return null;
  const num = '(-?\\d+(?:\\.\\d+)?)';
  const at = (re: string) => new RegExp(`^${re}$`).exec(s);
  const max = at(`(?:≤|<=|=<|<) ?${num}`);
  if (max) return { max: Number(max[1]) };
  const min = at(`(?:≥|>=|=>|>) ?${num}`);
  if (min) return { min: Number(min[1]) };
  const range = at(`${num} ?(?:–|—|-|\\.\\.|~) ?${num}`);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    return lo <= hi ? { min: lo, max: hi } : null;
  }
  return null;
}

/** The limit written back the way `parseLimit` reads it ("≤ 60", "≥ 3", "3–60"); a yes-or-no as "yes"/"no". */
export function limitInput(limit: ReviewLimit): string {
  if (limit.is !== undefined) return limit.is ? C.limit.yes : C.limit.no;
  if (limit.min !== undefined && limit.max !== undefined) return `${formatReviewNumber(limit.min)}–${formatReviewNumber(limit.max)}`;
  if (limit.min !== undefined) return `≥ ${formatReviewNumber(limit.min)}`;
  if (limit.max !== undefined) return `≤ ${formatReviewNumber(limit.max)}`;
  return '';
}

/** A new check's id: the metric with its dots turned into dashes, suffixed (-2, -3, …) when the id is taken. */
export function defaultCheckId(metric: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    metric
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 44) || 'check';
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!used.has(id)) return id;
  }
}

export type ReviewBadge = 'passed' | 'findings' | 'failed' | 'notReviewed';

/** The badge a video gets from its summary: no summary (never checked) reads as not checked. */
export function badgeOf(summary: Pick<ReviewSummary, 'verdict'> | null | undefined): ReviewBadge {
  switch (summary?.verdict) {
    case 'passed':
      return 'passed';
    case 'passed-with-findings':
      return 'findings';
    case 'failed':
      return 'failed';
    default:
      return 'notReviewed';
  }
}

export interface ReviewStale {
  /** The video changed after the project tier was measured. */
  project: boolean;
  /** The export tier was read from an export of an older version. */
  export: boolean;
  /** The answers were given about an older version. */
  answers: boolean;
  any: boolean;
}

/** Which tiers of a result are older than the live video (`revision`); with no live revision, nothing reads as stale. */
export function isStale(result: ReviewResult, revision: string | null | undefined): ReviewStale {
  if (!revision) return { project: false, export: false, answers: false, any: false };
  const s = reviewStaleness(result, revision);
  return { ...s, any: s.project || s.export || s.answers };
}

/**
 * What picking `next` for a finding means on this video (§2.1): nothing, giving it back the standard's severity
 * (`restore`, sent as `null`), raising it (saved at once) or lowering it below the standard (asks for a reason first).
 */
export type SeverityChange =
  | { kind: 'none' }
  | { kind: 'restore' }
  | { kind: 'raise'; severity: ReviewSeverity }
  | { kind: 'lower'; severity: ReviewSeverity };

export function severityChange(standard: ReviewSeverity, current: ReviewSeverity, next: ReviewSeverity): SeverityChange {
  if (next === current) return { kind: 'none' };
  if (next === standard) return { kind: 'restore' };
  return RANK[next] > RANK[standard] ? { kind: 'raise', severity: next } : { kind: 'lower', severity: next };
}

/** Severities from most to least serious, for pickers. */
export const SEVERITY_ORDER: readonly ReviewSeverity[] = REVIEW_SEVERITIES;

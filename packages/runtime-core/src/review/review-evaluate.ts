import {
  REVIEW_BUILTIN_CHECKS,
  emptyReviewPlan,
  reviewLimitOf,
  reviewMetric,
  type ReviewCheckResult,
  type MetricBag,
  type ReviewCheck,
  type ReviewCriteria,
  type ReviewLoweredMark,
  type ReviewPlan,
  type ReviewQuestion,
  type ReviewSeverity,
  type ReviewSkipped,
  type ReviewStandard,
  type ReviewVerdict,
  type ReviewWaivedMark,
  type RubricAnswer,
  type RubricResult,
} from '@cuccut/protocol';
import { RcReview } from '@cuccut/protocol/messages/runtime-core';

/**
 * Holding a video to its standard (docs/cuccut/m2-review-gate.md §4.1), ported from agentcut's `review/lib/evaluate.ts`.
 * Pure, so what a review says can be tested without an engine, a render or an agent.
 *
 * The rules that matter are here rather than in the caller. A check whose metric was not measured is skipped with a
 * reason, never failed. A waiver leaves the finding where it is and records why it was allowed. A severity is a field:
 * nothing is inferred from the wording of a message. Lowering one carries its reason into the result.
 */

const RANK: Record<ReviewSeverity, number> = { nitpick: 0, suggestion: 1, critical: 2 };

/** The built-in checks, with their fix sentence in the current language. */
export function builtinChecks(): ReviewCheck[] {
  const fix: Record<string, () => string> = {
    placeholders: () => RcReview.builtinFixPlaceholders().text,
    blank: () => RcReview.builtinFixBlank().text,
    'text-edge': () => RcReview.builtinFixTextEdge().text,
  };
  return REVIEW_BUILTIN_CHECKS.map((check) => ({ ...check, fix: fix[check.id]?.() ?? check.fix }));
}

/**
 * The standard active for a video: the user's checks and questions, plus every built-in check whose metric (or id) the
 * user does not name. A user check on a metric replaces the built-in one for it and leaves the rest alone.
 */
export function activeCriteria(builtin: readonly ReviewCheck[], user: ReviewStandard, plan: ReviewPlan = emptyReviewPlan()): ReviewCriteria {
  const metrics = new Set(user.checks.map((c) => c.metric));
  const ids = new Set([...user.checks.map((c) => c.id), ...user.rubric.map((q) => q.id)]);
  const kept = builtin.filter((c) => !metrics.has(c.metric) && !ids.has(c.id));
  const source = user.checks.length || user.rubric.length ? 'user' : 'builtin';
  return {
    source,
    reason: (source === 'user' ? RcReview.reasonUser() : RcReview.reasonBuiltin()).text,
    checks: [...kept, ...user.checks],
    rubric: [...user.rubric],
    plan,
    builtinIds: kept.map((c) => c.id),
  };
}

/** More local wins, and what is not named locally is inherited whole. Levels: video now; a pack layer can slot in later. */
export function stackPlans(...levels: ReviewPlan[]): ReviewPlan {
  return levels.reduce<ReviewPlan>(
    (all, level) => ({
      schema: all.schema,
      severities: { ...all.severities, ...level.severities },
      reasons: { ...all.reasons, ...level.reasons },
      waivers: [...all.waivers.filter((w) => !level.waivers.some((o) => o.id === w.id)), ...level.waivers],
    }),
    emptyReviewPlan(),
  );
}

/** The severity a plan holds an item to, and, when the plan lowered it, from what and why. */
export function severityOf(item: { id: string; severity: ReviewSeverity }, plan: ReviewPlan): { severity: ReviewSeverity; lowered?: ReviewLoweredMark } {
  const asked = plan.severities[item.id];
  if (!asked || asked === item.severity) return { severity: item.severity };
  if (RANK[asked] > RANK[item.severity]) return { severity: asked };
  return { severity: asked, lowered: { from: item.severity, reason: plan.reasons[item.id] ?? '' } };
}

/** A check applies to a video when nothing narrows it, or when its aspect is the video's. */
export function applies(check: Pick<ReviewCheck, 'aspect'>, video: { aspect: string }): boolean {
  return !check.aspect || check.aspect === video.aspect;
}

function waiverOf(plan: ReviewPlan, id: string): ReviewWaivedMark | undefined {
  const waiver = plan.waivers.find((w) => w.id === id);
  return waiver ? { reason: waiver.reason, by: waiver.by } : undefined;
}

export function holds(check: Pick<ReviewCheck, 'min' | 'max' | 'is'>, value: number | boolean): boolean {
  if (typeof value === 'boolean') return check.is === undefined ? true : value === check.is;
  if (check.min !== undefined && value < check.min) return false;
  if (check.max !== undefined && value > check.max) return false;
  return true;
}

export interface Evaluation {
  checks: ReviewCheckResult[];
  skipped: ReviewSkipped[];
}

/**
 * Every check that applies, against what was measured. `stages` says which tiers were taken, so a check on an export
 * metric when no export was read is skipped as `not-exported` rather than as `unreadable`.
 */
export function evaluateChecks(
  checks: readonly ReviewCheck[],
  bag: MetricBag,
  o: { plan: ReviewPlan; aspect: string; stages: ReadonlyArray<'project' | 'export'> },
): Evaluation {
  const results: ReviewCheckResult[] = [];
  const skipped: ReviewSkipped[] = [];
  for (const check of checks) {
    if (!applies(check, o)) {
      skipped.push({ id: check.id, reason: 'aspect', detail: o.aspect });
      continue;
    }
    const known = reviewMetric(check.metric);
    if (!known) {
      skipped.push({ id: check.id, reason: 'unknown-metric', detail: check.metric });
      continue;
    }
    if (!o.stages.includes(known.stage)) {
      skipped.push({ id: check.id, reason: known.stage === 'export' ? 'not-exported' : 'unreadable', detail: check.metric });
      continue;
    }
    const value = bag[check.metric];
    if (value === undefined) {
      skipped.push({ id: check.id, reason: 'unreadable', detail: check.metric });
      continue;
    }
    const { severity, lowered } = severityOf(check, o.plan);
    const ok = holds(check, value);
    const waived = ok ? undefined : waiverOf(o.plan, check.id);
    results.push({
      id: check.id,
      metric: check.metric,
      severity,
      value,
      limit: reviewLimitOf(check),
      ok,
      fix: check.fix,
      ...(waived ? { waived } : {}),
      ...(lowered ? { lowered } : {}),
    });
  }
  return { checks: results, skipped };
}

/** Whether a `holds` answer's evidence can be checked: true, or the note saying why not. */
export type EvidenceCheck = (question: ReviewQuestion, evidence: string) => true | string;

/**
 * The judged tier, once an agent has answered. A missing answer, and a `holds` whose evidence is empty or not of the
 * declared kind, are `cannot-tell` with a note. `cannot-tell` is never ok.
 */
export function evaluateRubric(
  questions: readonly ReviewQuestion[],
  answers: readonly RubricAnswer[],
  plan: ReviewPlan,
  evidenceOk: EvidenceCheck,
): RubricResult[] {
  const byId = new Map(answers.map((a) => [a.id, a]));
  return questions.map((question) => {
    const { severity, lowered } = severityOf(question, plan);
    const answer = byId.get(question.id);
    const evidence = answer?.evidence.trim() ?? '';
    let verdict = answer?.verdict ?? 'cannot-tell';
    let note = answer?.note?.trim() ?? '';
    if (!answer) note = RcReview.notReached().text;
    else if (answer.verdict === 'holds') {
      const valid = evidence ? evidenceOk(question, evidence) : RcReview.evidenceMissing().text;
      if (valid !== true) {
        verdict = 'cannot-tell';
        note = [valid, note].filter(Boolean).join(' ');
      }
    }
    const ok = verdict === 'holds';
    const waived = ok ? undefined : waiverOf(plan, question.id);
    return {
      id: question.id,
      ask: question.ask,
      severity,
      fix: question.fix,
      evidenceKind: question.evidence,
      verdict,
      evidence,
      note,
      ok,
      ...(waived ? { waived } : {}),
      ...(lowered ? { lowered } : {}),
    };
  });
}

/**
 * What the whole thing comes to. A waived finding does not decide the verdict (that is what waiving one is for), and
 * nothing below `critical` can fail a video.
 */
export function verdictOf(checks: readonly ReviewCheckResult[], rubric: readonly RubricResult[]): ReviewVerdict {
  const findings = [...checks, ...rubric].filter((r) => !r.ok && !r.waived);
  if (!findings.length) return checks.length || rubric.length ? 'passed' : 'not-reviewed';
  return findings.some((f) => f.severity === 'critical') ? 'failed' : 'passed-with-findings';
}

/** The findings that stop an export, in the order of the standard. Questions never block (§9, open question 2). */
export function blocking(checks: readonly ReviewCheckResult[]): ReviewCheckResult[] {
  return checks.filter((c) => !c.ok && !c.waived && c.severity === 'critical');
}

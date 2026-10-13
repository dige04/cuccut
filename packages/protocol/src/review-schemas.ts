import { z } from 'zod';
import {
  REVIEW_ASPECTS,
  REVIEW_CRITERIA_SCHEMA,
  REVIEW_EVIDENCE_KINDS,
  REVIEW_ID_PATTERN,
  REVIEW_LIMITS,
  REVIEW_PLAN_SCHEMA,
  REVIEW_SEVERITIES,
  emptyReviewPlan,
  emptyReviewStandard,
  type ReviewCheck,
  type ReviewPlan,
  type ReviewQuestion,
  type ReviewStandard,
} from './review.ts';

/**
 * Inbound validation for the review gate (`review.ts`): the user's standard, the per-video plan and an agent's
 * answers. Structure is enforced here; the limits on length and count are only a generous hard cap, so that lint can
 * report them by code (`too-long`, `too-many`) rather than as a bare schema failure.
 */

/** Hard caps: far above `REVIEW_LIMITS`, only to keep a hostile input bounded. */
const HARD_TEXT = 10_000;
const HARD_COUNT = 1_000;

const reviewId = z.string().regex(REVIEW_ID_PATTERN);
const severity = z.enum(REVIEW_SEVERITIES);
const finite = z.number().refine(Number.isFinite);

export const reviewCheckSchema = z
  .object({
    id: reviewId,
    metric: z.string().min(1).max(200),
    min: finite.optional(),
    max: finite.optional(),
    is: z.boolean().optional(),
    severity: severity.default('suggestion'),
    fix: z.string().max(HARD_TEXT).default(''),
    aspect: z.enum(REVIEW_ASPECTS).optional(),
  })
  .strict();

export const reviewQuestionSchema = z
  .object({
    id: reviewId,
    ask: z.string().trim().min(1).max(HARD_TEXT),
    evidence: z.enum(REVIEW_EVIDENCE_KINDS).default('timestamp'),
    severity: severity.default('suggestion'),
    fix: z.string().max(HARD_TEXT).default(''),
  })
  .strict();

export const reviewStandardSchema = z
  .object({
    schema: z.literal(REVIEW_CRITERIA_SCHEMA).default(REVIEW_CRITERIA_SCHEMA),
    checks: z.array(reviewCheckSchema).max(HARD_COUNT).default([]),
    rubric: z.array(reviewQuestionSchema).max(HARD_COUNT).default([]),
  })
  .strict();

const waiverSchema = z
  .object({
    id: reviewId,
    reason: z.string().trim().min(1).max(HARD_TEXT),
    by: z.enum(['user', 'agent']),
    at: z.string().min(1).max(64),
  })
  .strict();

export const reviewPlanSchema = z
  .object({
    schema: z.literal(REVIEW_PLAN_SCHEMA),
    severities: z.record(reviewId, severity),
    reasons: z.record(reviewId, z.string().max(HARD_TEXT)),
    waivers: z.array(waiverSchema).max(HARD_COUNT),
  })
  .strict();

export const rubricAnswerSchema = z
  .object({
    id: z.string().min(1).max(200),
    verdict: z.enum(['holds', 'fails', 'cannot-tell']),
    evidence: z.string().max(2000).default(''),
    note: z.string().max(2000).optional(),
  })
  .strict();

/** The `answers` of `review_answer`: at most one per question (a repeated id keeps the last). */
export const reviewAnswersSchema = z.array(rubricAnswerSchema).min(1).max(REVIEW_LIMITS.questions * 2);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A standard read from disk: what parses is kept item by item, and what does not is dropped, so one broken check does
 * not cost the user the rest of their standard.
 */
export function salvageReviewStandard(raw: unknown): ReviewStandard {
  if (!isRecord(raw)) return emptyReviewStandard();
  const checks: ReviewCheck[] = [];
  const rubric: ReviewQuestion[] = [];
  for (const item of Array.isArray(raw.checks) ? raw.checks.slice(0, HARD_COUNT) : []) {
    const parsed = reviewCheckSchema.safeParse(item);
    if (parsed.success) checks.push(stripUndefined(parsed.data) as ReviewCheck);
  }
  for (const item of Array.isArray(raw.rubric) ? raw.rubric.slice(0, HARD_COUNT) : []) {
    const parsed = reviewQuestionSchema.safeParse(item);
    if (parsed.success) rubric.push(parsed.data);
  }
  return { schema: REVIEW_CRITERIA_SCHEMA, checks, rubric };
}

/**
 * The body of a `review-plan` document, read tolerantly: a body that is not one (another schema, hand-edited) gives the
 * entries that still parse, and a missing body gives the empty plan.
 */
export function salvageReviewPlan(raw: unknown): ReviewPlan {
  const plan = emptyReviewPlan();
  if (!isRecord(raw) || (raw.schema !== undefined && raw.schema !== REVIEW_PLAN_SCHEMA)) return plan;
  if (isRecord(raw.severities)) {
    for (const [id, value] of Object.entries(raw.severities)) {
      if (REVIEW_ID_PATTERN.test(id) && severity.safeParse(value).success) plan.severities[id] = value as ReviewPlan['severities'][string];
    }
  }
  if (isRecord(raw.reasons)) {
    for (const [id, value] of Object.entries(raw.reasons)) {
      if (REVIEW_ID_PATTERN.test(id) && typeof value === 'string' && value.length <= HARD_TEXT) plan.reasons[id] = value;
    }
  }
  if (Array.isArray(raw.waivers)) {
    const seen = new Set<string>();
    for (const item of raw.waivers.slice(0, HARD_COUNT).reverse()) {
      const parsed = waiverSchema.safeParse(item);
      if (!parsed.success || seen.has(parsed.data.id)) continue;
      seen.add(parsed.data.id);
      plan.waivers.unshift(parsed.data);
    }
  }
  return plan;
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

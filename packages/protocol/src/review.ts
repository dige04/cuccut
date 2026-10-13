import type { Id } from './domain.ts';
import type { TransactionReceipt } from './video.ts';

/**
 * Review gate before delivery (docs/cuccut/m2-review-gate.md). A person, or the agent, states what a finished video
 * must be true of. CucCut measures it, says what was found and what to do, and refuses a deliverable export while a
 * critical finding is open.
 *
 * - A **check** names one metric from the closed catalogue below (`REVIEW_METRICS`, owned by the host) and the limit it
 *   is held to, so a standard can neither take a measurement nor lie about one.
 * - A **question** is answered by an agent with evidence of a declared kind. An answer with nothing to point at is
 *   recorded as "cannot tell".
 * - Per-video decisions (waivers, severity changes) live in a `review-plan` document inside the video, so they are
 *   revisioned and undoable like any edit.
 *
 * This file holds the types, limits and constants. Inbound validation is in `review-schemas.ts`.
 */

export const REVIEW_SEVERITIES = ['critical', 'suggestion', 'nitpick'] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

/** What a question's answer has to point at. Prose alone is not an answer. */
export const REVIEW_EVIDENCE_KINDS = ['timestamp', 'frame', 'field', 'quote'] as const;
export type ReviewEvidence = (typeof REVIEW_EVIDENCE_KINDS)[number];

/** The only condition a check can carry: the shape of the canvas. */
export const REVIEW_ASPECTS = ['9:16', '1:1', '16:9'] as const;
export type ReviewAspect = (typeof REVIEW_ASPECTS)[number];

/** Check and question ids: lowercase letters, digits and dashes, starting with a letter or digit, at most 48 characters. */
export const REVIEW_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;

/** Limits. Text lengths are in UTF-16 code units. */
export const REVIEW_LIMITS = {
  checks: 64,
  questions: 32,
  ask: 280,
  fix: 200,
  reason: 500,
} as const;

export const REVIEW_CRITERIA_SCHEMA = 'cuccut.review-criteria/1';
export const REVIEW_PLAN_SCHEMA = 'cuccut.review-plan/1';
export const REVIEW_RESULT_SCHEMA = 'cuccut.review-result/1';
/** Kind of the per-video decisions document (at most one per video). */
export const REVIEW_PLAN_KIND = 'review-plan';
/** Where review results are kept, relative to the video's source root: outside the edit history, in a dot folder Space does not scan. */
export const REVIEW_RESULTS_DIR = '.cuccut-out/reviews';
/** Where `videos_frames` writes frames, relative to the source root: `frame` evidence must point inside it. */
export const REVIEW_FRAMES_DIR = '.cuccut-out/frames';

/** One measured criterion. `min`/`max` limit a number, `is` a yes-or-no. `aspect` narrows it to one canvas shape. */
export interface ReviewCheck {
  id: string;
  metric: string;
  min?: number;
  max?: number;
  is?: boolean;
  severity: ReviewSeverity;
  /** One sentence saying what to do about it. Required in practice at `critical` (lint warns). */
  fix: string;
  aspect?: ReviewAspect;
}

/** One judged criterion: a question, the kind of evidence its answer must carry, and what to do about it. */
export interface ReviewQuestion {
  id: string;
  ask: string;
  evidence: ReviewEvidence;
  severity: ReviewSeverity;
  fix: string;
}

/** The user's standard (`~/.cuccut/store/review-criteria.json`). */
export interface ReviewStandard {
  schema: typeof REVIEW_CRITERIA_SCHEMA;
  checks: ReviewCheck[];
  rubric: ReviewQuestion[];
}

export type ReviewMetricStage = 'project' | 'export';

/** A metric of the closed catalogue. `what` is the agent-facing description (English); the UI has its own copy per name. */
export interface ReviewMetric {
  name: string;
  stage: ReviewMetricStage;
  kind: 'number' | 'boolean';
  unit?: string;
  what: string;
}

export interface ReviewWaiver {
  id: string;
  reason: string;
  by: 'user' | 'agent';
  at: string;
}

/** Body of the per-video `review-plan` document. */
export interface ReviewPlan {
  schema: typeof REVIEW_PLAN_SCHEMA;
  /** Check or question id → the severity it has on this video instead of the standard's. */
  severities: Record<string, ReviewSeverity>;
  /** Why a severity was lowered, keyed the same way. Required to lower one. */
  reasons: Record<string, string>;
  waivers: ReviewWaiver[];
}

/** The standard active for one video: built-ins not replaced by the user, the user's checks and questions, and the video's plan. */
export interface ReviewCriteria {
  source: 'builtin' | 'user';
  /** Why this standard (in the current language). */
  reason: string;
  checks: ReviewCheck[];
  rubric: ReviewQuestion[];
  plan: ReviewPlan;
  /** Ids of the checks in `checks` that are built-in. */
  builtinIds: string[];
}

/** The limit a check holds a value to, structured so that both the UI and the Runtime phrase it in their own language. */
export interface ReviewLimit {
  min?: number;
  max?: number;
  is?: boolean;
}

/** Everything measured about one video, by metric name. A metric that could not be read is absent; it never counts as 0. */
export type MetricBag = Record<string, number | boolean>;

export interface ReviewWaivedMark {
  reason: string;
  by: 'user' | 'agent';
}

/** A severity this video lowered, and why. */
export interface ReviewLoweredMark {
  from: ReviewSeverity;
  reason: string;
}

export interface ReviewCheckResult {
  id: string;
  metric: string;
  severity: ReviewSeverity;
  value: number | boolean;
  limit: ReviewLimit;
  ok: boolean;
  fix: string;
  /** Set when a waiver answers it: the finding stands, and so does the reason. */
  waived?: ReviewWaivedMark;
  lowered?: ReviewLoweredMark;
}

export type RubricVerdict = 'holds' | 'fails' | 'cannot-tell';

/** An agent's answer to one question. */
export interface RubricAnswer {
  id: string;
  verdict: RubricVerdict;
  /** Where to look: a timestamp, a frame file, an id in the video, a quote. */
  evidence: string;
  note?: string;
}

export interface RubricResult {
  id: string;
  ask: string;
  severity: ReviewSeverity;
  fix: string;
  evidenceKind: ReviewEvidence;
  verdict: RubricVerdict;
  evidence: string;
  note: string;
  ok: boolean;
  waived?: ReviewWaivedMark;
  lowered?: ReviewLoweredMark;
}

export type ReviewVerdict = 'passed' | 'passed-with-findings' | 'failed' | 'not-reviewed';

/** Why a check or question was not decided on this video. The UI holds the copy. */
export const REVIEW_SKIP_REASONS = ['aspect', 'unknown-metric', 'not-exported', 'unreadable', 'not-asked'] as const;
export type ReviewSkipReason = (typeof REVIEW_SKIP_REASONS)[number];

export interface ReviewSkipped {
  id: string;
  reason: ReviewSkipReason;
  /** The video's aspect (`aspect`), or the metric name (`unknown-metric`, `unreadable`). */
  detail?: string;
}

export type ReviewStage = 'project' | 'export' | 'rubric';

/**
 * One review of one video (`<sourceRoot>/.cuccut-out/reviews/<videoId>.json`). `revision` is the video revision the
 * project tier was measured at. The export tier and the answers each carry the revision they hold for: an edit made
 * after them makes them stale, a decision (waiver, severity) does not.
 */
export interface ReviewResult {
  schema: typeof REVIEW_RESULT_SCHEMA;
  videoId: Id;
  sequenceId: Id;
  videoName: string;
  at: string;
  revision: string;
  criteriaSource: 'builtin' | 'user';
  stages: ReviewStage[];
  verdict: ReviewVerdict;
  checks: ReviewCheckResult[];
  rubric: RubricResult[];
  skipped: ReviewSkipped[];
  measured: { project: MetricBag; export?: { bag: MetricBag; jobId: Id; revision: string } };
  answers?: { revision: string; at: string; by: 'agent' | 'user'; items: RubricAnswer[] };
}

export interface ReviewBlockFinding {
  id: string;
  metric: string;
  value: number | boolean;
  limit: ReviewLimit;
  fix: string;
}

/** What stops a deliverable export: the open critical findings of the project tier. */
export interface ReviewBlock {
  videoId: Id;
  sequenceId: Id;
  findings: ReviewBlockFinding[];
}

/** One line per reviewed video in the `review` topic. `open` counts unwaived findings; `stale` says a tier is older than the result. */
export interface ReviewSummary {
  verdict: ReviewVerdict;
  revision: string;
  at: string;
  open: number;
  stale: boolean;
}

/** Snapshot of the `review` topic: the user's standard, and the summaries written since start or read through `review.get`. */
export interface ReviewTopicSnapshot {
  criteria: { standard: ReviewStandard; revision: number };
  results: Record<Id, ReviewSummary>;
}

export type ReviewTopicEvent =
  | { type: 'criteria'; standard: ReviewStandard; revision: number }
  | { type: 'result'; videoId: Id; summary: ReviewSummary };

/** What lint says about a standard. Errors refuse it (`REVIEW_CRITERIA_INVALID`); warnings are returned with it. The UI maps codes to copy. */
export const REVIEW_LINT_CODES = [
  'unknown-metric',
  'no-limit',
  'limit-kind',
  'min-over-max',
  'critical-no-fix',
  'duplicate-id',
  'too-long',
  'too-many',
] as const;
export type ReviewLintCode = (typeof REVIEW_LINT_CODES)[number];

export interface ReviewLintIssue {
  code: ReviewLintCode;
  level: 'error' | 'warning';
  /** The check or question concerned; absent for `too-many`. */
  id?: string;
  /** `unknown-metric`, `limit-kind`: the metric named. */
  metric?: string;
  /** `unknown-metric`: up to three names from the catalogue that look close. */
  suggestions?: string[];
  /** `too-long`: the field (`ask`, `fix`, `reason`); `too-many`: `checks` or `questions`. */
  field?: string;
  /** `too-long`, `too-many`: the limit. */
  limit?: number;
}

/** Error codes in `RpcError.details.code`. `REVIEW_BLOCKED` carries `findings` (`ReviewBlockFinding[]`); `REVIEW_CRITERIA_INVALID` carries `issues`. */
export const REVIEW_ERROR_CODES = [
  'REVIEW_BLOCKED',
  'REVIEW_REASON_REQUIRED',
  'REVIEW_UNKNOWN_FINDING',
  'REVIEW_CRITERIA_INVALID',
  'REVIEW_CRITERIA_CONFLICT',
  'REVIEW_ANSWERS_INVALID',
] as const;
export type ReviewErrorCode = (typeof REVIEW_ERROR_CODES)[number];

/** `review.criteria.get`: the standard active for a video (or for any video), with the user's own standard, its revision and what lint says about it. */
export interface ReviewCriteriaView extends ReviewCriteria {
  standard: ReviewStandard;
  revision: number;
  warnings: ReviewLintIssue[];
}

/** `review.criteria.set`: the saved standard and lint's warnings (errors refuse it). */
export interface ReviewCriteriaSetResult {
  standard: ReviewStandard;
  revision: number;
  warnings: ReviewLintIssue[];
}

/** `review.check`: the project tier, measured and not written. `blocks` is null when nothing critical is open. */
export interface ReviewCheckOutcome {
  blocks: ReviewBlock | null;
  result: ReviewResult;
}

/** `review.waive`, `review.unwaive`, `review.severity`: the plan as written, the edit's receipt, and the result rewritten at the new revision. */
export interface ReviewDecisionResult {
  plan: ReviewPlan;
  receipt: TransactionReceipt;
  result: ReviewResult;
}

/** Read off the project itself, before anything is rendered. */
const PROJECT_METRICS: ReviewMetric[] = [
  { name: 'video.durationSec', stage: 'project', kind: 'number', unit: 's', what: 'How long the finished video runs.' },
  { name: 'video.shortSidePx', stage: 'project', kind: 'number', unit: 'px', what: 'The short side of the canvas.' },
  { name: 'video.shots', stage: 'project', kind: 'number', what: 'Video and image clips on the main track.' },
  { name: 'video.cutsPerMin', stage: 'project', kind: 'number', what: 'Joints between clips on the main track, per minute.' },
  { name: 'video.longestShotSec', stage: 'project', kind: 'number', unit: 's', what: 'The longest clip on the main track.' },
  { name: 'video.longestBlankSec', stage: 'project', kind: 'number', unit: 's', what: 'The longest stretch with no visible picture at all.' },
  { name: 'captions.on', stage: 'project', kind: 'boolean', what: 'The video draws captions at all.' },
  { name: 'captions.wordsPerSec', stage: 'project', kind: 'number', what: 'Caption words drawn per second of video.' },
  { name: 'hook.present', stage: 'project', kind: 'boolean', what: 'There is a hook line: the derivation hook, or text starting in the first 2 seconds.' },
  { name: 'hook.words', stage: 'project', kind: 'number', what: 'How many words the hook is.' },
  { name: 'text.offCanvas', stage: 'project', kind: 'boolean', what: 'A text box runs past the left or right edge of the canvas.' },
  { name: 'items.placeholders', stage: 'project', kind: 'number', what: 'Placeholder boxes still waiting for media.' },
  { name: 'transitions.count', stage: 'project', kind: 'number', what: 'Transitions in the sequence.' },
  { name: 'layers.max', stage: 'project', kind: 'number', what: 'Visual tracks in use beyond the first; 0 is a single track.' },
];

/** Read from the last finished-video export. */
const EXPORT_METRICS: ReviewMetric[] = [
  { name: 'export.durationSec', stage: 'export', kind: 'number', unit: 's', what: 'How long the exported file runs.' },
  { name: 'export.width', stage: 'export', kind: 'number', unit: 'px', what: 'Width of the exported picture.' },
  { name: 'export.height', stage: 'export', kind: 'number', unit: 'px', what: 'Height of the exported picture.' },
  { name: 'export.loudnessLufs', stage: 'export', kind: 'number', unit: 'LUFS', what: 'Integrated loudness after normalisation; absent when the export was not normalised.' },
  { name: 'export.truePeakDb', stage: 'export', kind: 'number', unit: 'dBTP', what: 'True peak after normalisation; absent when the export was not normalised.' },
];

/** The metric catalogue: everything a standard may hold a video to, and nothing else. */
export const REVIEW_METRICS: readonly ReviewMetric[] = [...PROJECT_METRICS, ...EXPORT_METRICS];

const METRICS_BY_NAME = new Map(REVIEW_METRICS.map((m) => [m.name, m]));

export function reviewMetric(name: string): ReviewMetric | undefined {
  return METRICS_BY_NAME.get(name);
}

/**
 * The checks a video is held to when the user has none for the metric. Only the placeholder check blocks by default:
 * it delivers a visibly unfinished frame. `fix` here is the English source; the Runtime words it in the current
 * language (`rcReview.builtinFix*`).
 */
export const REVIEW_BUILTIN_CHECKS: readonly ReviewCheck[] = [
  { id: 'placeholders', metric: 'items.placeholders', max: 0, severity: 'critical', fix: 'Fill or remove the placeholder boxes before delivering.' },
  { id: 'blank', metric: 'video.longestBlankSec', max: 0.5, severity: 'suggestion', fix: 'Cover or close the gap where nothing is on screen.' },
  { id: 'text-edge', metric: 'text.offCanvas', is: false, severity: 'suggestion', fix: 'Move or narrow the text so it stays inside the frame.' },
];

export function emptyReviewStandard(): ReviewStandard {
  return { schema: REVIEW_CRITERIA_SCHEMA, checks: [], rubric: [] };
}

export function emptyReviewPlan(): ReviewPlan {
  return { schema: REVIEW_PLAN_SCHEMA, severities: {}, reasons: {}, waivers: [] };
}

/** The limit a check holds its value to. */
export function reviewLimitOf(check: Pick<ReviewCheck, 'min' | 'max' | 'is'>): ReviewLimit {
  return {
    ...(check.min !== undefined ? { min: check.min } : {}),
    ...(check.max !== undefined ? { max: check.max } : {}),
    ...(check.is !== undefined ? { is: check.is } : {}),
  };
}

/** The canvas shape a check's `aspect` compares with: one of the three within ±0.02, else `W:H`, which matches no condition. */
export function reviewAspectOf(canvas: { width: number; height: number }): string {
  const ratio = canvas.width / Math.max(1, canvas.height);
  if (Math.abs(ratio - 9 / 16) <= 0.02) return '9:16';
  if (Math.abs(ratio - 1) <= 0.02) return '1:1';
  if (Math.abs(ratio - 16 / 9) <= 0.02) return '16:9';
  return `${canvas.width}:${canvas.height}`;
}

/** Which tiers of a result are older than `revision` (the live video's, or the result's own). */
export function reviewStaleness(result: ReviewResult, revision: string): { project: boolean; export: boolean; answers: boolean } {
  return {
    project: result.revision !== revision,
    export: !!result.measured.export && result.measured.export.revision !== revision,
    answers: !!result.answers && result.answers.revision !== revision,
  };
}

/** The open (unwaived, failing) findings of a result. */
export function reviewOpenFindings(result: Pick<ReviewResult, 'checks' | 'rubric'>): Array<ReviewCheckResult | RubricResult> {
  return [...result.checks, ...result.rubric].filter((r) => !r.ok && !r.waived);
}

/** The topic line for a result. `stale` compares the tiers with the result's own revision. */
export function reviewSummaryOf(result: ReviewResult): ReviewSummary {
  const stale = reviewStaleness(result, result.revision);
  return {
    verdict: result.verdict,
    revision: result.revision,
    at: result.at,
    open: reviewOpenFindings(result).length,
    stale: stale.export || stale.answers,
  };
}

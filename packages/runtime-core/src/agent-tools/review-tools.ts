import { z } from 'zod';
import {
  REVIEW_ASPECTS,
  REVIEW_EVIDENCE_KINDS,
  REVIEW_LIMITS,
  REVIEW_SEVERITIES,
  RpcError,
  reviewStaleness,
  type Id,
  type ReviewCheckResult,
  type ReviewDecisionResult,
  type ReviewResult,
  type ReviewSeverity,
  type RubricResult,
  type VideoChange,
  type VideoOpenResult,
} from '@cuccut/protocol';
import { RcAgentTools, RcReview } from '@cuccut/protocol/messages/runtime-core';
import type { ReviewService } from '../review/review-service.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolApprovalNote, type ToolPrincipal, type ToolScope } from './tool-scope.ts';
import { digestReceipt } from './video-digest.ts';
import { videoArg } from './video-tools.ts';

/**
 * Review gate tools (docs/cuccut/m2-review-gate.md §5): the agent reads the standard a video is held to, checks the
 * video against it, answers the standard's questions with evidence, and, only when the user asks, lets a finding stand
 * or changes what it is worth. Every call goes through the same `ReviewService` as the `review.*` methods and the export
 * gate, so the UI, the CLI and the agent behave the same.
 *
 * - Reading and checking (`review_criteria`, `review_run`, `review_answer`) are on all three surfaces and usable in plan
 *   mode: checking writes only the result file under `.cuccut-out/reviews/`, never a revision.
 * - Loosening (`review_waive`, lowering with `review_severity`, `review_criteria_set`) is the user's call: `high`, so it
 *   asks in every mode except full access and never offers "Always allow". These are not on the MCP surface, so an
 *   external service cannot loosen the gate. Waivers and severities are ordinary, undoable edits of the video.
 */

export interface ReviewToolsDeps {
  review: ReviewService;
  scope: ToolScope;
}

const SEVERITY_LIST = 'critical, suggestion or nitpick';
const findingIdArg = z.string().min(1).max(200).describe('The id of a check or question, as review_run or review_criteria give it');
const reasonArg = z
  .string()
  .max(REVIEW_LIMITS.reason * 4)
  .describe(`The user's reason, in one sentence (at most ${REVIEW_LIMITS.reason} characters); kept beside the finding`);
const sequenceArg = z.string().min(1).max(200).optional().describe('Optional. Sequence ID; defaults to the main sequence');

const checkArg = z.strictObject({
  id: z.string().describe('Lowercase letters, digits and dashes, at most 48 characters, unique in the standard'),
  metric: z.string().min(1).max(200).describe('A metric name from the catalogue (review_criteria with catalogue: true)'),
  min: z.number().optional().describe('Optional. The least a number metric may be'),
  max: z.number().optional().describe('Optional. The most a number metric may be'),
  is: z.boolean().optional().describe('Optional. What a yes-or-no metric must be'),
  severity: z.enum(REVIEW_SEVERITIES).optional().describe(`${SEVERITY_LIST}; critical stops a deliverable export. Default suggestion`),
  fix: z.string().max(REVIEW_LIMITS.fix * 4).optional().describe('One sentence saying what to do about it; needed for critical'),
  aspect: z.enum(REVIEW_ASPECTS).optional().describe('Optional. Only for this canvas shape: 9:16, 1:1 or 16:9'),
});

const questionArg = z.strictObject({
  id: z.string().describe('Lowercase letters, digits and dashes, at most 48 characters, unique in the standard'),
  ask: z.string().min(1).max(REVIEW_LIMITS.ask * 4).describe('The question, answerable by looking at the video'),
  evidence: z.enum(REVIEW_EVIDENCE_KINDS).optional().describe('What an answer must point at: timestamp, frame, field or quote. Default timestamp'),
  severity: z.enum(REVIEW_SEVERITIES).optional().describe(`${SEVERITY_LIST}. Default suggestion`),
  fix: z.string().max(REVIEW_LIMITS.fix * 4).optional().describe('One sentence saying what to do when it fails'),
});

const schemas = {
  review_criteria: z.strictObject({
    video: videoArg.optional().describe('Optional. Video: a path or videoId from videos_list; gives the standard for that video with its decisions (plan)'),
    catalogue: z.boolean().optional().describe('Optional. Also list the metric catalogue a check can name'),
  }),
  review_run: z.strictObject({
    video: videoArg,
    sequenceId: sequenceArg,
  }),
  review_answer: z.strictObject({
    video: videoArg,
    answers: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(200).describe('The question id'),
          verdict: z.enum(['holds', 'fails', 'cannot-tell']).describe('holds, fails or cannot-tell'),
          evidence: z.string().max(2000).describe('What to look at, of the kind the question declares: a time (12.5s, 01:02), a frame file from videos_frames, an id in the video, or a quote'),
          note: z.string().max(2000).optional().describe('Optional. One sentence on what you saw'),
        }),
      )
      .min(1)
      .max(REVIEW_LIMITS.questions * 2)
      .describe('One answer per question of the standard (verdict holds, fails or cannot-tell); a question left out is recorded as cannot-tell'),
  }),
  review_waive: z.strictObject({
    video: videoArg,
    id: findingIdArg,
    reason: reasonArg,
  }),
  review_unwaive: z.strictObject({
    video: videoArg,
    id: findingIdArg,
  }),
  review_severity: z.strictObject({
    video: videoArg,
    id: findingIdArg,
    severity: z
      .enum(REVIEW_SEVERITIES)
      .nullable()
      .describe(`What it is worth on this video: ${SEVERITY_LIST}; null gives it back the standard's severity`),
    reason: reasonArg.optional().describe(`Required to lower it below the standard's severity: the user's reason (at most ${REVIEW_LIMITS.reason} characters)`),
  }),
  review_criteria_set: z.strictObject({
    standard: z
      .strictObject({
        schema: z.literal('cuccut.review-criteria/1').optional(),
        checks: z.array(checkArg).max(REVIEW_LIMITS.checks * 2),
        rubric: z.array(questionArg).max(REVIEW_LIMITS.questions * 2),
      })
      .describe('The whole standard, replacing the current one: checks (metric + limit + severity + fix) and rubric (questions an agent answers with evidence)'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  review_criteria: {
    title: 'Read the review standard',
    description: [
      'Reads the standard a finished video is held to: its checks and its questions.',
      "The user's own checks replace the built-in check on the same metric; source says whether it is the user's standard or the built-ins only. With video, plan gives that video's decisions (findings let stand with a reason, severities changed on this video).",
      'A check names one metric from a closed catalogue and the limit it is held to; catalogue: true lists the metrics (stage project is read from the project, stage export from the last finished-video export).',
      'Read-only.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'The standard for a video', args: { video: 'demo' } },
      { title: 'With the metric catalogue', args: { catalogue: true } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  review_run: {
    title: 'Check the video',
    description: [
      "Checks a video against the user's review standard and records the result.",
      'Measures the project (placeholders, blank stretches, captions, text at the edge, length, …) and, when the sequence has a finished-video export, that export (duration, size, loudness); answers already given to the questions are re-evaluated.',
      'verdict is passed, passed-with-findings or failed. open lists the findings still to answer for: a critical one stops a deliverable export (REVIEW_BLOCKED). waived lists findings the user let stand, with the reason. skipped says what could not be decided and why. stale says when the export or the answers are older than the video.',
      'Writes only the result under .cuccut-out/reviews/; the video is not changed. Run it before a deliverable export.',
    ].join('\n'),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: 'Check a video', args: { video: 'demo' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  review_answer: {
    title: 'Answer the review questions',
    description: [
      "Records answers to the standard's questions, each with evidence.",
      'Each answer points at evidence of the kind the question declares.',
      'Look first (videos_frames, documents_read, a purpose: preview export), then answer every question: holds, fails or cannot-tell, with evidence to point at: timestamp (12.5s, 01:02 or 00:01:02, inside the video), frame (a file videos_frames wrote under .cuccut-out/frames/), field (an id in the video: item, track, document or marker) or quote (words found in a transcript or caption document).',
      'holds with evidence that is empty or not of the declared kind is recorded as cannot-tell with a note; cannot-tell never counts as holding. The result comes back with the rubric as recorded.',
      'Writes only the result under .cuccut-out/reviews/; the video is not changed.',
    ].join('\n'),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [
      {
        title: 'Answer one question',
        args: { video: 'demo', answers: [{ id: 'hook-lands', verdict: 'holds', evidence: '00:02', note: 'The promise is spoken over the first cut.' }] },
      },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'video',
  },
  review_waive: {
    title: 'Let a finding stand',
    description: [
      'Lets one finding stand on this video, with the reason the user gave.',
      "Only when the user asked for it: CucCut asks the user every time. The finding stays in the result with the reason beside it, and no longer stops an export. It is an ordinary edit of the video (undo it with edits_undo, or review_unwaive).",
    ].join('\n'),
    effect: 'mutation',
    examples: [{ title: 'Let the placeholder check stand', args: { video: 'demo', id: 'placeholders', reason: 'The box is filled by the client after delivery.' } }],
    surfaces: ['agent', 'cli'],
    positional: 'video',
  },
  review_unwaive: {
    title: 'Hold a finding again',
    description: [
      'Holds a finding that was let stand to the standard again.',
      'It is an ordinary edit of the video (undo it with edits_undo).',
    ].join('\n'),
    effect: 'mutation',
    examples: [{ title: 'Hold the placeholder check again', args: { video: 'demo', id: 'placeholders' } }],
    surfaces: ['agent', 'cli'],
    positional: 'video',
  },
  review_severity: {
    title: 'Change what a finding is worth',
    description: [
      'Changes what one check or question is worth on this video.',
      "Raising it needs nothing. Lowering it below the standard's severity is the user's call: it needs their reason and CucCut asks the user every time. null gives it back the standard's severity. It is an ordinary edit of the video (undo it with edits_undo). Never lower a severity to get past an export refusal.",
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Make the blank check critical', args: { video: 'demo', id: 'blank', severity: 'critical' } },
      { title: 'Back to the standard', args: { video: 'demo', id: 'blank', severity: null } },
    ],
    surfaces: ['agent', 'cli'],
    positional: 'video',
  },
  review_criteria_set: {
    title: 'Replace the review standard',
    description: [
      "Replaces the user's review standard with a new one.",
      "Only when the user asked for it: it is the user's standard, and CucCut asks the user every time. Read it first with review_criteria (catalogue: true), change it, and send the whole standard back. Problems that refuse it come back as REVIEW_CRITERIA_INVALID with issues by code; warnings come back with the saved standard.",
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Hold shorts to a minute',
        args: {
          standard: {
            checks: [{ id: 'short', metric: 'video.durationSec', max: 60, severity: 'critical', fix: 'Cut it to a minute or less.', aspect: '9:16' }],
            rubric: [],
          },
        },
      },
    ],
    surfaces: ['agent', 'cli'],
  },
};

const RANK: Record<ReviewSeverity, number> = { nitpick: 0, suggestion: 1, critical: 2 };

export class ReviewTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: ReviewToolsDeps;

  constructor(deps: ReviewToolsDeps) {
    this.#deps = deps;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    try {
      switch (name as ToolName) {
        case 'review_criteria':
          return await this.#criteria(args as Args<'review_criteria'>, principal);
        case 'review_run':
          return await this.#run(args as Args<'review_run'>, principal);
        case 'review_answer':
          return await this.#answer(args as Args<'review_answer'>, principal);
        case 'review_waive':
          return await this.#waive(args as Args<'review_waive'>, principal);
        case 'review_unwaive':
          return await this.#unwaive(args as Args<'review_unwaive'>, principal);
        case 'review_severity':
          return await this.#severity(args as Args<'review_severity'>, principal);
        case 'review_criteria_set':
          return await this.#setCriteria(args as Args<'review_criteria_set'>, principal);
        default:
          throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
      }
    } catch (error) {
      throw reviewToolError(error);
    }
  }

  async #criteria(args: Args<'review_criteria'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, false);
    const videoId = args.video !== undefined ? (await scope.open(args.video, access)).ref.videoId : undefined;
    const view = await review.criteria(videoId);
    const builtin = new Set(view.builtinIds);
    return {
      source: view.source,
      reason: view.reason,
      checks: view.checks.map((check) => (builtin.has(check.id) ? { ...check, builtin: true } : check)),
      rubric: view.rubric,
      ...(videoId !== undefined ? { videoId, plan: view.plan } : {}),
      revision: view.revision,
      ...(view.warnings.length ? { warnings: view.warnings } : {}),
      ...(args.catalogue ? { catalogue: review.catalogue() } : {}),
      next: 'Check a video against it with review_run. The standard is the user\'s: change it (review_criteria_set) only when they ask.',
    };
  }

  async #run(args: Args<'review_run'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, false);
    const opened = await scope.open(args.video, access);
    const result = await review.run(opened.ref.videoId, args.sequenceId !== undefined ? { sequenceId: args.sequenceId } : {});
    return digestResult(result);
  }

  async #answer(args: Args<'review_answer'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, false);
    const opened = await scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    // The answers belong with the sequence the video was last checked on (the main sequence when it was never checked).
    const stored = await review.get(videoId);
    const sequenceId = stored && opened.snapshot.video.sequences[stored.sequenceId] ? stored.sequenceId : undefined;
    const answers = args.answers.map((a) => ({ id: a.id, verdict: a.verdict, evidence: a.evidence, ...(a.note !== undefined ? { note: a.note } : {}) }));
    const result = await review.recordAnswers(videoId, answers, principal, sequenceId);
    const digest = digestResult(result);
    return {
      videoId,
      verdict: result.verdict,
      rubric: result.rubric.map(digestRubric),
      open: digest.open,
      next:
        result.rubric.some((r) => r.verdict === 'cannot-tell')
          ? 'Answers recorded. cannot-tell never holds: where the note says the evidence did not check out, look again and answer with evidence of the declared kind.'
          : 'Answers recorded. Tell the user what holds and what fails, with the evidence.',
    };
  }

  async #waive(args: Args<'review_waive'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const opened = await scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    // Refused before asking the user: a call that cannot succeed is not put to them.
    if (!args.reason.trim()) throw new RpcError('invalid-request', RcReview.reasonRequired(), { code: 'REVIEW_REASON_REQUIRED' });
    await this.#item(videoId, args.id);
    const approval = await scope.confirm(access, {
      tool: 'review_waive',
      video: args.video,
      ...confirmSummary(RcAgentTools.reviewWaive({ id: args.id, reason: args.reason.trim() })),
      risk: 'high',
    });
    const decided = await review.waive(videoId, args.id, args.reason, principal, { provenance: provenanceOf(scope, access, videoId) });
    return this.#decided(access, opened, args.id, decided, approval);
  }

  async #unwaive(args: Args<'review_unwaive'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const opened = await scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    await this.#item(videoId, args.id);
    const approval = await scope.confirm(access, {
      tool: 'review_unwaive',
      video: args.video,
      ...confirmSummary(RcReview.unwaiveLabel({ id: args.id })),
    });
    const decided = await review.unwaive(videoId, args.id, principal, { provenance: provenanceOf(scope, access, videoId) });
    return this.#decided(access, opened, args.id, decided, approval);
  }

  async #severity(args: Args<'review_severity'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const opened = await scope.open(args.video, access);
    const videoId = opened.ref.videoId;
    const { item, plan } = await this.#item(videoId, args.id);
    const current = plan.severities[args.id] ?? item.severity;
    const target = args.severity ?? item.severity;
    const lowering = RANK[target] < RANK[current];
    if (args.severity !== null && RANK[args.severity] < RANK[item.severity] && !args.reason?.trim()) {
      throw new RpcError('invalid-request', RcReview.reasonRequired(), { code: 'REVIEW_REASON_REQUIRED' });
    }
    const approval = await scope.confirm(access, {
      tool: 'review_severity',
      video: args.video,
      ...confirmSummary(RcAgentTools.reviewSeverity({ id: args.id, from: current, to: target })),
      // Lowering what a finding is worth loosens the user's standard: asked every time. Raising it is an ordinary edit.
      risk: lowering ? 'high' : 'edit',
    });
    const decided = await review.setSeverity(videoId, args.id, args.severity, args.reason, principal, {
      provenance: provenanceOf(scope, access, videoId),
    });
    return this.#decided(access, opened, args.id, decided, approval);
  }

  async #setCriteria(args: Args<'review_criteria_set'>, principal: ToolPrincipal) {
    const { review, scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const approval = await scope.confirm(access, { tool: 'review_criteria_set', ...confirmSummary(RcAgentTools.reviewCriteriaSet()), risk: 'high' });
    const saved = await review.setCriteria(args.standard);
    return {
      revision: saved.revision,
      checks: saved.standard.checks.length,
      questions: saved.standard.rubric.length,
      ...(saved.warnings.length ? { warnings: saved.warnings } : {}),
      ...approvalField(approval),
      next: saved.warnings.length
        ? 'Saved. warnings lists what may not work as meant (by code): tell the user, and fix it if they want.'
        : 'Saved. Videos are held to it from the next check (review_run) and the next deliverable export.',
    };
  }

  /** The check or question `id` names in the video's standard, and the video's plan; `REVIEW_UNKNOWN_FINDING` when there is none. */
  async #item(videoId: Id, id: string) {
    const view = await this.#deps.review.criteria(videoId);
    const item = [...view.checks, ...view.rubric].find((entry) => entry.id === id);
    if (!item) throw new RpcError('not-found', RcReview.unknownFinding({ id }), { code: 'REVIEW_UNKNOWN_FINDING', id });
    return { item, plan: view.plan };
  }

  /** The decision's digest; in a session the edit also posts a change card, like any other edit. */
  #decided(access: ToolAccess, opened: VideoOpenResult, id: string, decided: ReviewDecisionResult, approval: ToolApprovalNote | void) {
    const video = opened.snapshot.video;
    const fps = video.sequences[video.rootSequenceId]!.fps;
    const digest = digestReceipt(decided.receipt, fps, false);
    const { ref } = opened;
    const change: VideoChange = {
      videoId: ref.videoId,
      videoName: ref.name,
      target: ref.source.projectId
        ? { projectId: ref.source.projectId, path: ref.relPath }
        : { conversationId: ref.source.conversationId ?? '', path: ref.relPath },
      transactionId: decided.receipt.transactionId,
      label: decided.receipt.label,
      ...(decided.receipt.labelRef ? { labelRef: decided.receipt.labelRef } : {}),
      previousRevision: decided.receipt.previousRevision,
      videoRevision: decided.receipt.videoRevision,
      createdIds: decided.receipt.createdIds,
      updatedIds: decided.receipt.updatedIds,
      deletedIds: decided.receipt.deletedIds,
      durationSeconds: digest.durationSeconds,
      undoOf: decided.receipt.undoOf ?? null,
    };
    this.#deps.scope.recordChange(access, change);
    const summary = digestResult(decided.result);
    return {
      videoId: ref.videoId,
      id,
      plan: decided.plan,
      transactionId: digest.transactionId,
      label: digest.label,
      revision: digest.revision,
      verdict: decided.result.verdict,
      open: summary.open,
      ...approvalField(approval),
      next: 'Recorded as an edit of the video: edits_undo takes it back.',
    };
  }
}

/** The tool's view of a result: what is open, what was let stand, what holds, what was not decided, and what is stale. */
function digestResult(result: ReviewResult) {
  const all = [...result.checks.map(digestCheck), ...result.rubric.map(digestRubric)];
  const failing = [...result.checks, ...result.rubric].map((r, i) => ({ r, d: all[i]! })).filter(({ r }) => !r.ok);
  const open = failing.filter(({ r }) => !r.waived).map(({ d }) => d);
  const waived = failing.filter(({ r }) => r.waived).map(({ d }) => d);
  const holds = [...result.checks, ...result.rubric].filter((r) => r.ok).map((r) => r.id);
  const stale = reviewStaleness(result, result.revision);
  const notes: string[] = [];
  if (!result.stages.includes('export') && result.skipped.some((s) => s.reason === 'not-exported')) {
    notes.push('Export checks were skipped: this sequence has no finished-video export yet.');
  }
  if (stale.export) notes.push('The export checks read an export of an older revision: export again and rerun to refresh them.');
  if (stale.answers) notes.push('The answers were given for an older revision: look again and answer with review_answer to refresh them.');
  const notAsked = result.skipped.filter((s) => s.reason === 'not-asked').length;
  const blocking = open.filter((f) => f.severity === 'critical' && 'metric' in f);
  return {
    videoId: result.videoId,
    sequenceId: result.sequenceId,
    revision: result.revision,
    criteriaSource: result.criteriaSource,
    verdict: result.verdict,
    stages: result.stages,
    open,
    ...(waived.length ? { waived } : {}),
    holds,
    ...(result.skipped.length ? { skipped: result.skipped } : {}),
    ...(notes.length ? { stale: notes } : {}),
    next: [
      blocking.length
        ? 'Critical findings stop a deliverable export: fix each one (fix says how) and run again. Let one stand (review_waive) only when the user asks, with their reason.'
        : open.length
          ? 'Tell the user about the open findings and what fix says; they do not stop an export.'
          : 'Nothing is open.',
      ...(notAsked ? ['The standard also has questions: look at the video, then answer them with review_answer, each with evidence of the declared kind.'] : []),
    ].join(' '),
  };
}

function digestCheck(check: ReviewCheckResult) {
  return {
    id: check.id,
    metric: check.metric,
    severity: check.severity,
    value: check.value,
    limit: check.limit,
    fix: check.fix,
    ...(check.waived ? { waived: check.waived } : {}),
    ...(check.lowered ? { lowered: check.lowered } : {}),
  };
}

function digestRubric(question: RubricResult) {
  return {
    id: question.id,
    ask: question.ask,
    severity: question.severity,
    evidenceKind: question.evidenceKind,
    verdict: question.verdict,
    evidence: question.evidence,
    ...(question.note ? { note: question.note } : {}),
    fix: question.fix,
    ...(question.waived ? { waived: question.waived } : {}),
    ...(question.lowered ? { lowered: question.lowered } : {}),
  };
}

/** Session calls carry the task in progress and the protections of its contract (§3.2), like every other edit. */
function provenanceOf(scope: ToolScope, access: ToolAccess, videoId: Id) {
  const taskId = (access as { taskId?: unknown }).taskId;
  return { ...(typeof taskId === 'string' ? { taskId } : {}), protections: scope.protections?.(access, videoId) ?? [] };
}

const REVIEW_NEXT: Record<string, string> = {
  REVIEW_REASON_REQUIRED: "Give the user's reason in reason (one sentence, at most 500 characters). Let a finding stand or lower it only when the user asked.",
  REVIEW_UNKNOWN_FINDING: 'Use an id that review_run (open, waived, holds) or review_criteria lists for this video.',
  REVIEW_CRITERIA_INVALID: 'issues lists what refuses it (lint codes, or schema paths): correct the standard and send it again. Metric names come from review_criteria with catalogue: true.',
  REVIEW_CRITERIA_CONFLICT: 'The standard changed meanwhile: read it again with review_criteria and redo the change on top of it.',
  REVIEW_ANSWERS_INVALID: 'Send one entry per question: id, verdict (holds, fails or cannot-tell) and evidence.',
  SEQUENCE_NOT_FOUND: 'Use a sequenceId from videos_inspect, or omit it for the main sequence.',
};

/** Refusals from the review service: the error code is in `details.code`; passed to the agent as is, with a next step attached. */
function reviewToolError(error: unknown): unknown {
  if (!(error instanceof RpcError)) return error;
  const details = error.details;
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return error;
  const { code, ...rest } = details as { code?: unknown } & Record<string, unknown>;
  if (typeof code !== 'string') return error;
  return new ToolError(code, error.message, { ...rest, ...(REVIEW_NEXT[code] ? { next: REVIEW_NEXT[code] } : {}) });
}

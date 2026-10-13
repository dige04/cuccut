import fs from 'node:fs/promises';
import path from 'node:path';
import {
  REVIEW_LIMITS,
  REVIEW_METRICS,
  REVIEW_PLAN_KIND,
  REVIEW_RESULT_SCHEMA,
  RpcError,
  framesToSeconds,
  newId,
  nowIso,
  refOf,
  reviewAspectOf,
  reviewSummaryOf,
  sequenceDurationFrames,
  type ExportSettings,
  type Id,
  type JobRecord,
  type Localized,
  type MetricBag,
  type ReviewBlock,
  type ReviewCheckOutcome,
  type ReviewCriteria,
  type ReviewCriteriaSetResult,
  type ReviewCriteriaView,
  type ReviewDecisionResult,
  type ReviewMetric,
  type ReviewPlan,
  type ReviewQuestion,
  type ReviewResult,
  type ReviewSeverity,
  type ReviewSkipped,
  type ReviewStage,
  type RubricAnswer,
  type RubricResult,
  type VideoRef,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { reviewAnswersSchema, reviewStandardSchema, salvageReviewPlan } from '@cuccut/protocol/schemas';
import { RcCommon, RcExport, RcReview } from '@cuccut/protocol/messages/runtime-core';
import type { Logger } from '@cuccut/harness';
import { ReviewCriteriaConflictError, type ReviewCriteriaStore } from '@cuccut/runtime-storage';
import type { TrustedPrincipal } from '../gateway.ts';
import { sourceRoot } from '../exports/export-publish.ts';
import { actorOf, type VideoService } from '../videos/video-service.ts';
import { activeCriteria, blocking, builtinChecks, evaluateChecks, evaluateRubric, verdictOf } from './review-evaluate.ts';
import { checkEvidence, documentText, frameCandidates, snapshotIds, type EvidenceContext } from './review-evidence.ts';
import { lintStandard } from './review-lint.ts';
import { exportMetrics, latestVideoExport, metricDocumentIds, projectMetrics } from './review-metrics.ts';
import { ReviewTopic, readReviewResult, reviewResultFile, writeReviewResult } from './review-results.ts';

/**
 * The review gate's service (docs/cuccut/m2-review-gate.md §4.2). The `review.*` handlers, the agent tools and the
 * export gate all call it, so the UI, the agent and the CLI hold a video to the same standard the same way.
 *
 * - The standard is the user's (`ReviewCriteriaStore`) over the built-ins; per-video decisions are a `review-plan`
 *   document written through `videos.apply`, so they are revisioned, on the undo stack and in the portable package.
 * - The result is a file beside the project (`review-results.ts`), never a revision. After a decision the result is
 *   rewritten at the new revision, and tiers that were current stay current: a decision does not stale a reading.
 */

type VideoAccess = Pick<VideoService, 'ref' | 'mirror' | 'document' | 'apply'>;
type ApplyProvenance = Parameters<VideoService['apply']>[2];

export interface ReviewServiceOptions {
  videos: VideoAccess;
  jobs: { list(videoId?: Id): JobRecord[] };
  store: ReviewCriteriaStore;
  /** `review.gate`: off means exports are never stopped (reviews still run). */
  settings: () => { gate: boolean };
  log: Logger;
}

export interface ReviewDecisionOptions {
  expectedRevision?: string;
  commandId?: Id;
  /** The calling task's id and protections, for an agent's write (`videos.apply`). */
  provenance?: ApplyProvenance;
}

interface Opened {
  ref: VideoRef;
  snapshot: VideoSnapshot;
  sequenceId: Id;
  root: string;
}

/** How long to wait for the video mirror to catch up with a write this service just made. */
const MIRROR_WAIT_MS = 2000;

export class ReviewService {
  readonly topic: ReviewTopic;
  readonly #videos: VideoAccess;
  readonly #jobs: ReviewServiceOptions['jobs'];
  readonly #store: ReviewCriteriaStore;
  readonly #settings: ReviewServiceOptions['settings'];
  readonly #log: Logger;
  /** Result writes per video, in order: a slow `run` cannot land after the decision that followed it. */
  readonly #writes = new Map<Id, Promise<unknown>>();

  constructor(options: ReviewServiceOptions) {
    this.#videos = options.videos;
    this.#jobs = options.jobs;
    this.#store = options.store;
    this.#settings = options.settings;
    this.#log = options.log;
    this.topic = new ReviewTopic(() => this.#store.get());
  }

  catalogue(): readonly ReviewMetric[] {
    return REVIEW_METRICS;
  }

  /** The standard active for a video (with its plan), or for any video when none is given. */
  async criteria(videoId?: Id): Promise<ReviewCriteriaView> {
    const plan = videoId ? await this.#plan(this.#open(videoId)) : undefined;
    const { standard, revision } = this.#store.get();
    return { ...activeCriteria(builtinChecks(), standard, plan), standard, revision, warnings: lintStandard(standard) };
  }

  /** Replaces the user's standard. Structure and lint errors refuse it; lint warnings come back with it. */
  async setCriteria(input: unknown, expectedRevision?: number): Promise<ReviewCriteriaSetResult> {
    const parsed = reviewStandardSchema.safeParse(input);
    if (!parsed.success) {
      throw new RpcError('invalid-request', RcReview.criteriaInvalid(), {
        code: 'REVIEW_CRITERIA_INVALID',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    const standard = { ...parsed.data, checks: parsed.data.checks.map(withoutUndefined) };
    const issues = lintStandard(standard);
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length) throw new RpcError('invalid-request', RcReview.criteriaInvalid(), { code: 'REVIEW_CRITERIA_INVALID', issues: errors });
    let saved;
    try {
      saved = await this.#store.set(standard, expectedRevision);
    } catch (error) {
      if (error instanceof ReviewCriteriaConflictError) {
        throw new RpcError('conflict', RcReview.criteriaConflict(), { code: 'REVIEW_CRITERIA_CONFLICT', revision: error.current });
      }
      throw error;
    }
    this.topic.criteriaChanged();
    return { standard: saved.standard, revision: saved.revision, warnings: issues };
  }

  /** The project tier only, nothing written: what the export gate and the export note read. */
  async check(videoId: Id, sequenceId?: Id): Promise<ReviewCheckOutcome> {
    const opened = this.#open(videoId, sequenceId);
    const result = await this.#evaluate(opened, { exportTier: false, answers: null });
    return { blocks: blockOf(result), result };
  }

  /**
   * The export gate (§4.3): null when `review.gate` is off, for anything but a finished video, and for a preview;
   * otherwise the open critical findings of the project tier, or null when there are none.
   */
  async gate(videoId: Id, settings: ExportSettings): Promise<ReviewBlock | null> {
    if (!this.#settings().gate || settings.kind !== 'video' || settings.purpose === 'preview') return null;
    return (await this.check(videoId, settings.sequenceId)).blocks;
  }

  /**
   * Holds the video to its standard and writes the result: the project tier, the export tier when a finished export
   * of the sequence exists, and the existing answers re-evaluated against the current plan.
   */
  async run(videoId: Id, options: { sequenceId?: Id; export?: boolean } = {}): Promise<ReviewResult> {
    const opened = this.#open(videoId, options.sequenceId);
    return this.#write(videoId, async () => {
      const previous = await this.#previous(opened);
      const result = await this.#evaluate(opened, { exportTier: options.export !== false, previous });
      return result;
    });
  }

  /** The stored result, or null when the video has not been checked (or the file cannot be read). */
  async get(videoId: Id): Promise<ReviewResult | null> {
    const ref = this.#videos.ref(videoId);
    if (!ref) throw videoNotOpen();
    const result = await readReviewResult(reviewResultFile(sourceRoot(ref), videoId));
    if (result) this.topic.resultRead(videoId, reviewSummaryOf(result));
    return result;
  }

  /** Lets a finding stand with a reason. The finding stays in the result, with the reason beside it. */
  async waive(videoId: Id, id: string, reason: string, principal: TrustedPrincipal, options: ReviewDecisionOptions = {}): Promise<ReviewDecisionResult> {
    const text = requireReason(reason);
    const by = actorOf(principal).kind === 'agent' ? 'agent' : 'user';
    return this.#decide(videoId, id, principal, options, RcReview.waiveLabel({ id }), (plan) => ({
      ...plan,
      waivers: [...plan.waivers.filter((w) => w.id !== id), { id, reason: text, by, at: nowIso() }],
    }));
  }

  /** Holds a finding to the standard again. */
  async unwaive(videoId: Id, id: string, principal: TrustedPrincipal, options: ReviewDecisionOptions = {}): Promise<ReviewDecisionResult> {
    return this.#decide(videoId, id, principal, options, RcReview.unwaiveLabel({ id }), (plan) => ({
      ...plan,
      waivers: plan.waivers.filter((w) => w.id !== id),
    }));
  }

  /**
   * Changes what a finding is worth on this video. Raising needs nothing; lowering below the standard's severity needs
   * a reason, which travels into the result. `null` gives it back the standard's severity.
   */
  async setSeverity(
    videoId: Id,
    id: string,
    severity: ReviewSeverity | null,
    reason: string | undefined,
    principal: TrustedPrincipal,
    options: ReviewDecisionOptions = {},
  ): Promise<ReviewDecisionResult> {
    return this.#decide(videoId, id, principal, options, RcReview.severityLabel({ id }), (plan, item) => {
      const severities = { ...plan.severities };
      const reasons = { ...plan.reasons };
      if (severity === null || severity === item.severity) {
        delete severities[id];
        delete reasons[id];
      } else {
        severities[id] = severity;
        if (RANK[severity] < RANK[item.severity]) reasons[id] = requireReason(reason);
        else delete reasons[id];
      }
      return { ...plan, severities, reasons };
    });
  }

  /**
   * Records an agent's (or a person's) answers to the questions, checked against the current questions and their
   * evidence kinds, and rewrites the result with them.
   */
  async recordAnswers(videoId: Id, input: unknown, principal: TrustedPrincipal, sequenceId?: Id): Promise<ReviewResult> {
    const parsed = reviewAnswersSchema.safeParse(input);
    if (!parsed.success) {
      throw new RpcError('invalid-request', RcReview.answersInvalid(), {
        code: 'REVIEW_ANSWERS_INVALID',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    const opened = this.#open(videoId, sequenceId);
    const plan = await this.#plan(opened);
    const criteria = this.#criteriaFor(plan);
    const known = new Set(criteria.rubric.map((q) => q.id));
    const items = new Map<string, RubricAnswer>();
    for (const answer of parsed.data) {
      if (!known.has(answer.id)) throw unknownFinding(answer.id);
      items.set(answer.id, { id: answer.id, verdict: answer.verdict, evidence: answer.evidence, ...(answer.note ? { note: answer.note } : {}) });
    }
    const answers: NonNullable<ReviewResult['answers']> = {
      revision: opened.snapshot.revision,
      at: nowIso(),
      by: actorOf(principal).kind === 'agent' ? 'agent' : 'user',
      items: [...items.values()],
    };
    return this.#write(videoId, async () => {
      const previous = await this.#previous(opened);
      return this.#evaluate(opened, { exportTier: true, previous, answers });
    });
  }

  /** Waits for pending result writes (for stopping). */
  async flush(): Promise<void> {
    await Promise.allSettled([...this.#writes.values()]);
    await this.#store.flush();
  }

  // ---- internals ----

  #open(videoId: Id, sequenceId?: Id): Opened {
    const ref = this.#videos.ref(videoId);
    const snapshot = this.#videos.mirror(videoId)?.video;
    if (!ref || !snapshot) throw videoNotOpen();
    const chosen = sequenceId ?? snapshot.rootSequenceId;
    if (!snapshot.sequences[chosen]) {
      throw new RpcError('not-found', RcExport.sequenceNotFound({ sequenceId: chosen }), { code: 'SEQUENCE_NOT_FOUND' });
    }
    return { ref, snapshot, sequenceId: chosen, root: sourceRoot(ref) };
  }

  async #body(videoId: Id, documentId: Id): Promise<unknown> {
    try {
      return (await this.#videos.document(videoId, documentId)).body;
    } catch (error) {
      this.#log.warn('Reading a document for the review failed', { videoId, documentId, error: String(error) });
      return undefined;
    }
  }

  async #plan(opened: Opened): Promise<ReviewPlan> {
    const id = planDocumentId(opened.snapshot);
    return salvageReviewPlan(id ? await this.#body(opened.ref.videoId, id) : undefined);
  }

  #criteriaFor(plan: ReviewPlan): ReviewCriteria {
    return activeCriteria(builtinChecks(), this.#store.get().standard, plan);
  }

  async #previous(opened: Opened): Promise<ReviewResult | null> {
    const previous = await readReviewResult(reviewResultFile(opened.root, opened.ref.videoId));
    return previous && previous.sequenceId === opened.sequenceId ? previous : null;
  }

  /**
   * One review of one sequence. `previous` carries the export reading's revision (same job) and the answers;
   * `answers` replaces the answers (null: none, the gate's check).
   */
  async #evaluate(
    opened: Opened,
    o: { exportTier: boolean; previous?: ReviewResult | null; answers?: ReviewResult['answers'] | null },
  ): Promise<ReviewResult> {
    const { snapshot, sequenceId, ref } = opened;
    const videoId = ref.videoId;
    const sequence = snapshot.sequences[sequenceId]!;
    const plan = await this.#plan(opened);
    const criteria = this.#criteriaFor(plan);

    const bodies = new Map<Id, unknown>();
    for (const id of metricDocumentIds(snapshot, sequenceId)) {
      const body = await this.#body(videoId, id);
      if (body !== undefined) bodies.set(id, body);
    }
    const project = projectMetrics(snapshot, sequenceId, bodies);
    const stages: ReviewStage[] = ['project'];
    let exported: ReviewResult['measured']['export'];
    if (o.exportTier) {
      const job = latestVideoExport(this.#jobs.list(videoId), videoId, sequenceId);
      if (job?.export) {
        const carried = o.previous?.measured.export?.jobId === job.jobId ? o.previous.measured.export.revision : job.export.videoRevision;
        exported = { bag: exportMetrics(job), jobId: job.jobId, revision: carried };
        stages.push('export');
      }
    }
    const bag: MetricBag = { ...project, ...(exported?.bag ?? {}) };
    const { checks, skipped } = evaluateChecks(criteria.checks, bag, {
      plan,
      aspect: reviewAspectOf(sequence.canvas),
      stages: stages.filter((s): s is 'project' | 'export' => s !== 'rubric'),
    });

    const answers = o.answers === undefined ? o.previous?.answers : (o.answers ?? undefined);
    let rubric: RubricResult[] = [];
    const notAsked: ReviewSkipped[] = [];
    if (answers && criteria.rubric.length) {
      const context = await this.#evidenceContext(opened, criteria.rubric, answers.items);
      rubric = evaluateRubric(criteria.rubric, answers.items, plan, (question, evidence) => checkEvidence(question.evidence, evidence, context));
      stages.push('rubric');
    } else {
      for (const question of criteria.rubric) notAsked.push({ id: question.id, reason: 'not-asked' });
    }

    return {
      schema: REVIEW_RESULT_SCHEMA,
      videoId,
      sequenceId,
      videoName: snapshot.name,
      at: nowIso(),
      revision: snapshot.revision,
      criteriaSource: criteria.source,
      stages,
      verdict: verdictOf(checks, rubric),
      checks,
      rubric,
      skipped: [...skipped, ...notAsked],
      measured: { project, ...(exported ? { export: exported } : {}) },
      ...(answers ? { answers } : {}),
    };
  }

  async #evidenceContext(opened: Opened, questions: readonly ReviewQuestion[], answers: readonly RubricAnswer[]): Promise<EvidenceContext & { sourceRoot: string }> {
    const { snapshot, sequenceId, ref, root } = opened;
    const sequence = snapshot.sequences[sequenceId]!;
    const kinds = new Set(questions.filter((q) => answers.some((a) => a.id === q.id && a.verdict === 'holds')).map((q) => q.evidence));
    const texts: string[] = [];
    if (kinds.has('quote')) {
      for (const document of Object.values(snapshot.documents)) {
        if (document.kind !== 'speech' && document.kind !== 'caption') continue;
        const text = documentText(await this.#body(ref.videoId, document.id));
        if (text) texts.push(text);
      }
    }
    const frames = new Set<string>();
    for (const frame of frameCandidates(questions, answers, root)) {
      const stat = await fs.stat(path.join(root, ...frame.split('/'))).catch(() => null);
      if (stat?.isFile()) frames.add(frame);
    }
    return {
      sourceRoot: root,
      durationSec: framesToSeconds(sequenceDurationFrames(sequence), sequence.fps),
      ids: snapshotIds(snapshot),
      texts,
      frames,
    };
  }

  /** Serialises result writes per video, writes the file and publishes the summary. */
  async #write(videoId: Id, compute: () => Promise<ReviewResult>): Promise<ReviewResult> {
    const before = this.#writes.get(videoId) ?? Promise.resolve();
    const next = before
      .catch(() => {})
      .then(async () => {
        const result = await compute();
        const ref = this.#videos.ref(videoId);
        if (!ref) throw videoNotOpen();
        await writeReviewResult(reviewResultFile(sourceRoot(ref), videoId), result);
        this.topic.resultWritten(videoId, reviewSummaryOf(result));
        return result;
      });
    this.#writes.set(videoId, next);
    try {
      return await next;
    } finally {
      if (this.#writes.get(videoId) === next) this.#writes.delete(videoId);
    }
  }

  /**
   * A decision on the plan: checks the id against the standard, writes the plan document in one edit, then rewrites the
   * result at the new revision. A tier that was current before the edit is carried to the new revision, since the
   * edit changed only the decisions.
   */
  async #decide(
    videoId: Id,
    id: string,
    principal: TrustedPrincipal,
    options: ReviewDecisionOptions,
    label: Localized,
    change: (plan: ReviewPlan, item: { severity: ReviewSeverity }) => ReviewPlan,
  ): Promise<ReviewDecisionResult> {
    const ref = this.#videos.ref(videoId);
    if (!ref) throw videoNotOpen();
    const stored = await readReviewResult(reviewResultFile(sourceRoot(ref), videoId));
    const snapshot = this.#videos.mirror(videoId)?.video;
    const sequenceId = stored && snapshot?.sequences[stored.sequenceId] ? stored.sequenceId : undefined;
    const opened = this.#open(videoId, sequenceId);
    const current = await this.#plan(opened);
    const criteria = this.#criteriaFor(current);
    const item = [...criteria.checks, ...criteria.rubric].find((entry) => entry.id === id);
    if (!item) throw unknownFinding(id);
    const plan = change(current, item);
    const documentId = planDocumentId(opened.snapshot);
    const { receipt } = await this.#videos.apply(
      {
        videoId,
        commandId: options.commandId ?? newId('cmd'),
        expectedRevision: options.expectedRevision ?? opened.snapshot.revision,
        operations: [
          {
            type: 'putDocument',
            ...(documentId ? { documentId } : {}),
            kind: REVIEW_PLAN_KIND,
            name: RcReview.documentName().text,
            body: plan,
          },
        ],
        label: label.text,
        labelRef: refOf(label),
      },
      principal,
      options.provenance,
    );
    const before = receipt.previousRevision;
    const after = await this.#reopen(videoId, receipt.videoRevision, opened.sequenceId);
    const result = await this.#write(videoId, async () => {
      const previous = await this.#previous(after);
      const carried = previous ? carryForward(previous, before, after.snapshot.revision) : null;
      return this.#evaluate(after, { exportTier: true, previous: carried });
    });
    return { plan, receipt, result };
  }

  /** The video once the mirror has caught up with `revision` (the write this service just made). */
  async #reopen(videoId: Id, revision: string, sequenceId: Id): Promise<Opened> {
    const deadline = Date.now() + MIRROR_WAIT_MS;
    while (this.#videos.mirror(videoId)?.video.revision !== revision && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return this.#open(videoId, sequenceId);
  }
}

const RANK: Record<ReviewSeverity, number> = { nitpick: 0, suggestion: 1, critical: 2 };

function planDocumentId(snapshot: VideoSnapshot): Id | null {
  return Object.values(snapshot.documents).find((d) => d.kind === REVIEW_PLAN_KIND)?.id ?? null;
}

function blockOf(result: ReviewResult): ReviewBlock | null {
  const findings = blocking(result.checks).map((c) => ({ id: c.id, metric: c.metric, value: c.value, limit: c.limit, fix: c.fix }));
  return findings.length ? { videoId: result.videoId, sequenceId: result.sequenceId, findings } : null;
}

/** Tiers that held for `before` hold for `after` too, when the only change between them was a decision. */
function carryForward(previous: ReviewResult, before: string, after: string): ReviewResult {
  const exported = previous.measured.export;
  return {
    ...previous,
    measured: {
      ...previous.measured,
      ...(exported ? { export: { ...exported, revision: exported.revision === before ? after : exported.revision } } : {}),
    },
    ...(previous.answers ? { answers: { ...previous.answers, revision: previous.answers.revision === before ? after : previous.answers.revision } } : {}),
  };
}

function requireReason(reason: string | undefined): string {
  const text = reason?.trim() ?? '';
  if (!text) throw new RpcError('invalid-request', RcReview.reasonRequired(), { code: 'REVIEW_REASON_REQUIRED' });
  if (text.length > REVIEW_LIMITS.reason) {
    throw new RpcError('invalid-request', RcReview.reasonTooLong({ limit: REVIEW_LIMITS.reason }), { code: 'REVIEW_REASON_REQUIRED', limit: REVIEW_LIMITS.reason });
  }
  return text;
}

function unknownFinding(id: string): RpcError {
  return new RpcError('not-found', RcReview.unknownFinding({ id }), { code: 'REVIEW_UNKNOWN_FINDING', id });
}

function videoNotOpen(): RpcError {
  return new RpcError('not-found', RcCommon.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

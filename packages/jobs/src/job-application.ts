import {
  RpcError,
  newId,
  nowIso,
  type ApplicationRecord,
  type ApplicationState,
  type EditOperation,
  type Id,
  type JobError,
} from '@cuccut/protocol';
import { JobsApplication as J } from '@cuccut/protocol/messages/jobs/job-application.ts';
import type { ApplicationLedger, StoredApplication, VideoPlace } from './application-ledger.ts';
import { errorText, jobError, LocalizedError, type JobText } from './job-text.ts';

/**
 * Applies a task's result to the video (architecture design §7.3):
 *
 * ```text
 * create Application (pending, recorded) → read the current video, check target and inputs
 *   → record commandId and baseVideoRevision (validating, recorded) → submit an idempotent transaction → record the receipt (committed, recorded)
 * ```
 *
 * - Each submission uses a new `commandId` (`cmd_<applicationId>_<n>`). The engine treats the same command with a different payload as an idempotency conflict, so after re-validation an old command is never reused. Before anything is reused, the receipt for the old command is looked up first; if found, the change was already committed, so it is backfilled and not written again.
 * - Stop barrier (§7.4): one last check before submitting that the task has not been asked to stop. If it has, the result is `cancelled` and the artifact is kept as a candidate.
 *   The submission carries this execution (`run`). When stopping, the Runtime first invalidates this generation on the engine. A submission that gets past the check but reaches the engine afterwards is rejected by the engine (`TASK_STOPPED`) and likewise recorded as `cancelled` (`details.barrier: 'engine'`), without a receipt lookup, since a rejected submission never opened a transaction.
 * - Task protection (§3.2): writes under an agent task carry the task contract's protection scope for this video. If one is touched, the engine rejects the whole transaction (`TASK_PROTECTED`).
 *   It is recorded as `rejected` with error code `TASK_PROTECTED`, with no receipt lookup and no retry. The artifact is kept as a candidate, and the user can decide with `jobs.reconcile apply`.
 * - If the video was changed between read and write (`conflict`), it is re-read and submitted again with a new command, at most `APPLY_ATTEMPTS` times.
 * - Other submission errors (engine restart, connection dropped…): it is not known whether the transaction landed, so the receipt is looked up by this attempt's command first. Found means committed; not found means `rejected`.
 */

export const APPLY_ATTEMPTS = 3;

/** The target or input no longer holds. Do not guess at an adjacent object; the artifact is kept as a candidate. Constructed with the directory text (`Localized`), and the reference is recorded with the task error. */
export class StaleInput extends LocalizedError {}

/**
 * The check before applying rejected this write with a definite error code (for example, the transcript was edited again when switching to it, `TRANSCRIPT_EDITED`). It is recorded as `rejected`, not submitted and not retried, and the task's error code is that code.
 */
export class ApplyRejected extends LocalizedError {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: JobText, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Fault injection points (for tests): simulate a process crash at these moments. */
export type JobFaultPoint =
  /** The artifact is already written to the artifact store (publish intent recorded), but neither the result nor the application has been recorded. */
  | 'artifact-stored'
  /** The artifact is published, and the application has not been created yet. */
  | 'artifact-published'
  /** The application is already recorded as `validating` (with `commandId`), and the transaction has not been submitted yet. */
  | 'application-recorded'
  /** The Node-side stop check has passed, and the transaction is about to be handed to the engine. */
  | 'application-submitting'
  /** The transaction is committed, but the receipt has not been recorded yet. */
  | 'application-committed';

/** Returning `'crash'` simulates a crash at this moment: nothing further is persisted and the task is abandoned, as if the process were gone. */
export type JobFaults = (point: JobFaultPoint, context: { jobId: Id; applicationId?: Id }) => 'crash' | void;

/** Simulated crash: on receiving it, the JobManager freezes the ledger and abandons the task. */
export class SimulatedCrash extends Error {
  readonly point: JobFaultPoint;

  constructor(point: JobFaultPoint) {
    super(`Simulated crash: ${point}`);
    this.point = point;
  }
}

/** The execution that the task's and pipeline's writes belong to (§7.4): `runGeneration` is a decimal integer string, incremented on each retry generation. */
export interface ApplicationRun {
  runId: Id;
  runGeneration: string;
}

/** Video capabilities that applying needs (part of `JobVideos`). */
export interface ApplicationVideos {
  apply(
    videoId: Id,
    request: { commandId: Id; expectedRevision: string; operations: EditOperation[]; label: string; run?: ApplicationRun },
  ): Promise<{ refs?: Record<string, Id>; transactionId?: Id; videoRevision?: string }>;
  receipt?(videoId: Id, commandId: Id): Promise<AppliedReceipt | null>;
}

/** The receipt the engine returns for a `commandId`. */
export interface AppliedReceipt {
  transactionId: Id;
  videoRevision: string;
  refs?: Record<string, Id>;
}

/** What one application writes: validation (returns the current video revision; throws `StaleInput` if it no longer holds) and the operation. */
export interface ApplicationTarget {
  label: string;
  check(): string;
  operations(): Promise<EditOperation[]>;
}

export class ApplicationRunner {
  readonly #ledger: ApplicationLedger;
  readonly #videos: ApplicationVideos;
  readonly #faults: JobFaults | undefined;

  constructor(options: { ledger: ApplicationLedger; videos: ApplicationVideos; faults?: JobFaults }) {
    this.#ledger = options.ledger;
    this.#videos = options.videos;
    this.#faults = options.faults;
  }

  /** Creates one application and records it (`pending`). */
  async create(input: {
    jobId: Id;
    videoId: Id;
    artifactIds: string[];
    targetRefs: string[];
    place: VideoPlace | null;
  }): Promise<StoredApplication> {
    const now = nowIso();
    const item: StoredApplication = {
      record: {
        applicationId: newId('app'),
        jobId: input.jobId,
        artifactIds: input.artifactIds,
        videoId: input.videoId,
        targetRefs: input.targetRefs,
        baseVideoRevision: null,
        commandId: null,
        state: 'pending',
        receipt: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      },
      place: input.place,
      submissions: 0,
    };
    await this.#ledger.put(item);
    return item;
  }

  /**
   * Validates and submits until `committed`, `stale-input`, `rejected` or `cancelled`. Returns the application as it ends.
   * `run` is this execution (the engine-side stop barrier). A re-run that the user decides on (`jobs.reconcile apply`) does not pass it.
   */
  async run(item: StoredApplication, target: ApplicationTarget, stopped: () => boolean, run?: ApplicationRun): Promise<ApplicationRecord> {
    const app = item.record;
    for (let attempt = 1; ; attempt++) {
      if (stopped()) return this.#end(item, 'cancelled', cancelledError());
      let revision: string;
      let operations: EditOperation[];
      try {
        revision = target.check();
        operations = await target.operations();
      } catch (error) {
        if (error instanceof StaleInput) return this.#end(item, 'stale-input', jobError('STALE_JOB_INPUT', errorText(error)));
        if (error instanceof ApplyRejected) return this.#end(item, 'rejected', jobError(error.code, errorText(error), error.details));
        throw error;
      }
      item.submissions++;
      app.commandId = `cmd_${app.applicationId}_${item.submissions}`;
      app.baseVideoRevision = revision;
      app.state = 'validating';
      await this.#ledger.put(item);
      this.#fault('application-recorded', app);
      // Stop barrier: the last check before submitting.
      if (stopped()) return this.#end(item, 'cancelled', cancelledError());
      this.#fault('application-submitting', app);
      let receipt: AppliedReceipt & { recovered?: true };
      try {
        const result = await this.#videos.apply(app.videoId, {
          commandId: app.commandId,
          expectedRevision: revision,
          operations,
          label: target.label,
          ...(run ? { run } : {}),
        });
        receipt = { transactionId: result.transactionId ?? '', videoRevision: result.videoRevision ?? '', refs: result.refs ?? {} };
      } catch (error) {
        // The engine-side stop barrier rejected this submission. No transaction was opened, so there is no need to look up the receipt.
        if (taskStopped(error)) return this.#end(item, 'cancelled', { ...cancelledError(), details: { barrier: 'engine' } });
        // It touched the task's protection scope. Likewise no transaction was opened; retrying with a new command will not help either, so it is left to the user.
        if (taskProtected(error)) return this.#end(item, 'rejected', protectedError(error));
        // The video changed between read and write: re-read it and submit with a new command.
        if (error instanceof RpcError && error.code === 'conflict' && attempt < APPLY_ATTEMPTS) continue;
        const found = await this.lookup(item).catch(() => null);
        if (found) {
          receipt = found;
        } else {
          return this.#end(
            item,
            'rejected',
            jobError(error instanceof RpcError ? 'APPLY_FAILED' : 'INTERNAL', J.applyFailed(), {
              cause: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
      this.#fault('application-committed', app);
      return this.commit(item, receipt);
    }
  }

  /** Looks up the receipt from the engine by this application's most recent `commandId`. null if it was never submitted or the receipt is not found. Throws if the query itself fails. */
  async lookup(item: StoredApplication): Promise<(AppliedReceipt & { recovered: true }) | null> {
    const { commandId, videoId } = item.record;
    if (!commandId || !this.#videos.receipt) return null;
    const found = await this.#videos.receipt(videoId, commandId);
    return found ? { ...found, recovered: true } : null;
  }

  /** Records the receipt (`committed`). */
  async commit(item: StoredApplication, receipt: AppliedReceipt & { recovered?: true }): Promise<ApplicationRecord> {
    const app = item.record;
    app.state = 'committed';
    app.error = null;
    app.receipt = {
      transactionId: receipt.transactionId || null,
      videoRevision: receipt.videoRevision || null,
      refs: receipt.refs ?? {},
      ...(receipt.recovered ? { recovered: true as const } : {}),
    };
    await this.#ledger.put(item);
    return structuredClone(app);
  }

  /** Ends in the not-submitted state. */
  async end(item: StoredApplication, state: Exclude<ApplicationState, 'pending' | 'validating' | 'committed'>, error: JobError) {
    return this.#end(item, state, error);
  }

  async #end(item: StoredApplication, state: ApplicationState, error: JobError): Promise<ApplicationRecord> {
    item.record.state = state;
    item.record.error = error;
    await this.#ledger.put(item);
    return structuredClone(item.record);
  }

  #fault(point: JobFaultPoint, app: ApplicationRecord): void {
    if (this.#faults?.(point, { jobId: app.jobId, applicationId: app.applicationId }) === 'crash') throw new SimulatedCrash(point);
  }
}

/** The engine's stop barrier rejected the submission (`TASK_STOPPED`, command and protocol spec §11.3). */
export function taskStopped(error: unknown): boolean {
  return error instanceof RpcError && (error.details as { code?: unknown } | undefined)?.code === 'TASK_STOPPED';
}

/** The engine's task protection rejected the submission (`TASK_PROTECTED`, command and protocol spec §11.2). */
export function taskProtected(error: unknown): error is RpcError {
  return error instanceof RpcError && (error.details as { code?: unknown } | undefined)?.code === 'TASK_PROTECTED';
}

/** Rejection reason in the application record: the protection that was touched (`protectionId`, `target`, `entityIds`). */
function protectedError(error: RpcError): JobError {
  const body = error.details as { details?: { protections?: unknown } } | undefined;
  return jobError('TASK_PROTECTED', J.taskProtected(), { protections: body?.details?.protections ?? [] });
}

export function cancelledError(): JobError {
  return jobError('APPLICATION_CANCELLED', J.applicationCancelled());
}

/** Applications that have not ended yet (`pending`, `validating`). */
export function applicationOpen(state: ApplicationState): boolean {
  return state === 'pending' || state === 'validating';
}

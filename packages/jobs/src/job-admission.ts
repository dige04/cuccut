import type {
  GrantDataKind,
  Id,
  JobError,
  JobGrantUse,
  JobState,
  JobSubmitter,
  ModelInfoBase,
  ModelServiceCapability,
  Money,
  ProviderKind,
} from '@cuccut/protocol';

/**
 * Admission of outbound calls (architecture design §12.5, §7.8). The JobManager calls it before creating the record, before starting execution, before automatic retries, and at the end. Judging authorization and reserving budget is the responsibility of the implementation (the Runtime's authorization service). The JobManager only calls it at these moments and records the result on the task record's `grant`.
 *
 * - `admit` is synchronous: the check and the reservation complete in the same event-loop turn, immediately followed by creating the record, so concurrent submissions cannot together cross the limit.
 * - Local (`local`) and node (`node`) calls do not go through here: local does not leave the machine, and a node is a device the user has paired.
 */

/** The caller's description of this call: which grant to use (for approval, one issued for this call), and which data goes out (inferred from the capability when not given). */
export interface JobGrantHint {
  grantId?: Id;
  dataKinds?: GrantDataKind[];
}

export interface JobAdmissionRequest {
  jobId: Id;
  capability: ModelServiceCapability;
  providerId: string;
  providerKind: ProviderKind;
  /** Display name of the Provider (used in error messages). */
  label: string;
  /** The chosen model (when it has a price, the amount can be estimated). */
  model: ModelInfoBase;
  modelId: string;
  videoId: Id | null;
  submitter: JobSubmitter;
  hint?: JobGrantHint;
  /** Input quantities for estimating the amount: number of images, number of characters of synthesized text. */
  quantity: { count?: number; chars?: number };
}

export interface JobAdmission {
  /** Judges and reserves (synchronous). Returns null when no authorization is needed. Throws `RpcError` when there is no grant or the quota is insufficient (`GRANT_REQUIRED`, `BUDGET_EXCEEDED`…). */
  admit(request: JobAdmissionRequest): JobGrantUse | null;
  /**
   * Before execution starts (the data is about to be handed out): if the grant is still valid, marks the reservation as started and resolves to null **after the write is persisted** (§7.8: after a restart, a call that was already sent must not be treated as not started and released). If it has been revoked, has expired or was narrowed, resolves to a task error (`GRANT_REVOKED`). If the write cannot reach disk, resolves to `INTERNAL`.
   */
  start(use: JobGrantUse): Promise<JobError | null>;
  /** This reservation has been marked as started. On restart: if a queued task had already started, the request may have gone out, so it must not be re-queued. */
  begun?(use: JobGrantUse): boolean;
  /** Automatic retry: settles the previous attempt and reserves again. When the quota is insufficient, returns a task error (`BUDGET_EXCEEDED`). */
  retry(use: JobGrantUse, call: { providerId: string; videoId: Id | null; submitter: JobSubmitter }): JobGrantUse | JobError;
  /** Settles when the task ends. */
  settle(use: JobGrantUse, outcome: { state: JobState; reported?: Money | null }): JobGrantUse;
}

export function isJobError(value: JobGrantUse | JobError): value is JobError {
  return 'code' in value;
}

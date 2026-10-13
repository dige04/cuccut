import {
  RpcError,
  decideApproval,
  decideServiceApproval,
  newId,
  type ApprovalAction,
  type ApprovalGrantChoice,
  type ApprovalBasis,
  type ApprovalOutcome,
  type ApprovalSubject,
  type ApprovalVerdict,
  type GrantRequestItem,
  type Id,
  type PendingApproval,
  type PendingApprovalDecision,
  type RiskLevel,
} from '@cuccut/protocol';
import { HarnessAgents as HA } from '@cuccut/protocol/messages/harness';

/**
 * The outcome of an approval. `forSession`: the user chose "don't ask again for this kind of action in this task" (used only for session approvals).
 * `grant`: the user's choice when allowing an approval that requires outbound-send authorization: just this once, or also issue an ongoing grant (§12.5); if no choice was made, it is treated as just this once.
 */
export interface ApprovalResolution {
  outcome: ApprovalOutcome;
  forSession: boolean;
  grant?: ApprovalGrantChoice;
}

export interface ApprovalRequestInput {
  subject: ApprovalSubject;
  action: ApprovalAction;
  risk: RiskLevel;
  basis: ApprovalBasis;
  /** Time limit (milliseconds); on expiry it ends per `timeout` (callers treat it as a denial); null means no timeout (session approvals). */
  timeoutMs: number | null;
  /** On abort (external request disconnected), treated as cancelled. */
  signal?: AbortSignal;
  /** Reuses the caller's approval id (the Driver's, or the service approval's); if already taken or not given, another is generated. */
  approvalId?: Id;
  /** Called synchronously at the end, before `respond` returns: callers update the session entry and answer the Driver here. */
  onSettled?: (resolution: ApprovalResolution) => void;
  /** This action needs to send data outside and is not yet covered by an authorization (§12.5): on allow, the authorization choice may be included. */
  grants?: GrantRequestItem[];
}

export type ApprovalServiceEvent =
  { type: 'requested'; approval: PendingApproval } | { type: 'resolved'; approval: PendingApproval; outcome: ApprovalOutcome };

interface Entry {
  approval: PendingApproval;
  settle: (resolution: ApprovalResolution) => void;
}

/**
 * ApprovalService (architecture design §3.12, §4.8): approvals shared by in-session actions and requests from external services.
 *
 * - `decide`: looks up access mode (or service level) × risk level, yielding auto, ask, or deny;
 * - `request`: creates a pending approval and waits: the user allows or denies, it times out (only service approvals have a time limit), or it is cancelled (stop, interrupt, disconnect);
 * - pending approvals are listed in one place (`pending`); their appearance and ending are notified via `subscribe` (the Harness forwards them to the `tasks` topic).
 *
 * This only handles pending approvals and their outcomes; session entries, Driver answers, and service topics are handled by their respective callers in `onSettled` and notifications.
 */
export class ApprovalService {
  readonly #pending = new Map<Id, Entry>();
  readonly #listeners = new Set<(event: ApprovalServiceEvent) => void>();

  /** Lookup: sessions by mode, external services by level. */
  decide(basis: ApprovalBasis, risk: RiskLevel): ApprovalVerdict {
    return basis.kind === 'mode' ? decideApproval(basis.mode, risk) : decideServiceApproval(basis.level, risk);
  }

  /** Creates a pending approval. `resolution` settles when the user acts, on timeout, or on cancellation; it never rejects. */
  request(input: ApprovalRequestInput): { approvalId: Id; resolution: Promise<ApprovalResolution> } {
    const approvalId = input.approvalId && !this.#pending.has(input.approvalId) ? input.approvalId : newId('apv');
    const now = Date.now();
    const approval: PendingApproval = {
      approvalId,
      subject: structuredClone(input.subject),
      action: structuredClone(input.action),
      risk: input.risk,
      basis: structuredClone(input.basis),
      createdAt: new Date(now).toISOString(),
      expiresAt: input.timeoutMs === null ? null : new Date(now + input.timeoutMs).toISOString(),
      ...(input.grants?.length ? { grants: structuredClone(input.grants) } : {}),
    };
    if (input.signal?.aborted) {
      const resolution: ApprovalResolution = { outcome: 'cancelled', forSession: false };
      input.onSettled?.(resolution);
      return { approvalId, resolution: Promise.resolve(resolution) };
    }
    const resolution = new Promise<ApprovalResolution>((resolve) => {
      const timer = input.timeoutMs === null ? null : setTimeout(() => settle({ outcome: 'timeout', forSession: false }), input.timeoutMs);
      timer?.unref?.();
      const onAbort = () => settle({ outcome: 'cancelled', forSession: false });
      const settle = (result: ApprovalResolution) => {
        if (this.#pending.get(approvalId)?.approval !== approval) return;
        this.#pending.delete(approvalId);
        if (timer) clearTimeout(timer);
        input.signal?.removeEventListener('abort', onAbort);
        try {
          input.onSettled?.(result);
        } finally {
          this.#emit({ type: 'resolved', approval: structuredClone(approval), outcome: result.outcome });
          resolve(result);
        }
      };
      this.#pending.set(approvalId, { approval, settle });
      input.signal?.addEventListener('abort', onAbort, { once: true });
    });
    this.#emit({ type: 'requested', approval: structuredClone(approval) });
    return { approvalId, resolution };
  }

  /**
   * The user's decision. Those already handled, timed out, cancelled, or nonexistent all return `already-resolved`.
   * `grant` is only for approvals that require outbound-send authorization (if omitted when required, `invalid-request`); such approvals cannot be "don't ask again in this task": every outbound send must be covered by an authorization (§12.5).
   */
  respond(
    approvalId: Id,
    decision: PendingApprovalDecision,
    options: { forSession?: boolean; grant?: ApprovalGrantChoice } = {},
  ): { status: 'allowed' | 'denied' | 'already-resolved' } {
    const entry = this.#pending.get(approvalId);
    if (!entry) return { status: 'already-resolved' };
    const outbound = (entry.approval.grants?.length ?? 0) > 0;
    if (options.grant && !outbound) throw new RpcError('invalid-request', HA.approvalNoGrant());
    const outcome = decision === 'allow' ? 'allowed' : 'denied';
    entry.settle({
      outcome,
      forSession: outcome === 'allowed' && options.forSession === true && !outbound,
      ...(outcome === 'allowed' && outbound ? { grant: options.grant ?? { persist: false } } : {}),
    });
    return { status: outcome };
  }

  /** Cancels one (stop, interrupt, or the Driver withdraws it itself). False if not pending. */
  cancel(approvalId: Id): boolean {
    const entry = this.#pending.get(approvalId);
    if (!entry) return false;
    entry.settle({ outcome: 'cancelled', forSession: false });
    return true;
  }

  /** Cancels all matching ones (session task ends, service stops); returns the count cancelled. */
  cancelWhere(predicate: (approval: PendingApproval) => boolean): number {
    let count = 0;
    for (const entry of [...this.#pending.values()]) {
      if (!predicate(entry.approval)) continue;
      entry.settle({ outcome: 'cancelled', forSession: false });
      count++;
    }
    return count;
  }

  /** Pending approvals, oldest first. */
  pending(): PendingApproval[] {
    return [...this.#pending.values()].map((entry) => structuredClone(entry.approval));
  }

  get(approvalId: Id): PendingApproval | null {
    const entry = this.#pending.get(approvalId);
    return entry ? structuredClone(entry.approval) : null;
  }

  subscribe(listener: (event: ApprovalServiceEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(event: ApprovalServiceEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch {
        // An error from a subscriber does not affect the approval itself.
      }
    }
  }
}

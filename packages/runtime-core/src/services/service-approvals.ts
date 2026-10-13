import {
  newId,
  type GrantRequestItem,
  type Id,
  type RiskLevel,
  type ServiceApproval,
  type ServiceApprovalDecision,
  type ServiceApprovalOutcome,
  type ServiceId,
  type ServiceLevel,
} from '@cuccut/protocol';
import { ApprovalService, type ApprovalResolution } from '@cuccut/harness';

/**
 * Service approval (architecture design §4.8): at the `ask` level, writes, jobs and generations requested externally are each allowed or rejected by the user in CucCut before they run.
 * With no session to attach to, pending approvals are delivered via the `services` topic (`approval.requested` / `approval.resolved`), and handled with `services.respondToApproval`.
 *
 * - Has a time limit; on timeout it is treated as rejection (`timeout`);
 * - Cancelled when the external request disconnects or the service stops (`cancelled`); the caller is never executed afterwards.
 *
 * The approval itself is created and ended by the unified ApprovalService (§3.12): the same entry also appears in the pending list under the `tasks` topic.
 * Handling it with `approvals.respond` or with `services.respondToApproval` is the same thing. This file only maintains the shape the services topic needs.
 */

export interface ServiceApprovalsOptions {
  timeoutMs: number;
  /** An approval appears or ends: sent to the `services` topic. */
  onRequested: (approval: ServiceApproval) => void;
  onResolved: (approvalId: Id, outcome: ServiceApprovalOutcome) => void;
  /** The unified approval (the Harness's one). If not given, uses its own (for tests and standalone use). */
  approvals?: ApprovalService;
}

/** The basis for the approval: the action's risk and the service's current level. If not given, uses `command` and `ask`. */
export interface ServiceApprovalBasis {
  risk?: RiskLevel;
  level?: ServiceLevel;
  /** Data this request sends out that is not yet covered by an authorization (§12.5): listed in the approval; when allowed, it carries back the authorization choice. */
  grants?: GrantRequestItem[];
}

export class ServiceApprovals {
  readonly #options: ServiceApprovalsOptions;
  readonly #unified: ApprovalService;
  readonly #pending = new Map<Id, ServiceApproval>();

  constructor(options: ServiceApprovalsOptions) {
    this.#options = options;
    this.#unified = options.approvals ?? new ApprovalService();
  }

  /** Pending approvals, oldest first. */
  pending(): ServiceApproval[] {
    return [...this.#pending.values()].map((approval) => structuredClone(approval));
  }

  /** Starts an approval and waits for the user to handle it, time it out, or cancel it. If `signal` aborts (the external request disconnected), it is handled as a cancellation. */
  request(
    input: Omit<ServiceApproval, 'approvalId' | 'createdAt' | 'expiresAt'>,
    signal: AbortSignal | undefined,
    basis: ServiceApprovalBasis = {},
  ): Promise<ServiceApprovalOutcome> {
    return this.resolve(input, signal, basis).then((r) => r.outcome);
  }

  /** Same as `request`, but the outcome includes the user's choice of outbound authorization (`grant`). */
  resolve(
    input: Omit<ServiceApproval, 'approvalId' | 'createdAt' | 'expiresAt'>,
    signal: AbortSignal | undefined,
    basis: ServiceApprovalBasis = {},
  ): Promise<ApprovalResolution> {
    if (signal?.aborted) return Promise.resolve({ outcome: 'cancelled', forSession: false });
    const { approvalId, resolution } = this.#unified.request({
      approvalId: newId('sap'),
      subject: { kind: 'service', serviceId: input.serviceId, clientId: input.clientId, clientName: input.clientName },
      action: { kind: 'tool', name: input.tool, targets: input.video ? [input.video.name] : [], summary: input.summary },
      risk: basis.risk ?? 'command',
      basis: { kind: 'service', level: basis.level ?? 'ask' },
      timeoutMs: this.#options.timeoutMs,
      ...(signal ? { signal } : {}),
      ...(basis.grants?.length ? { grants: basis.grants } : {}),
      onSettled: ({ outcome }) => {
        if (!this.#pending.delete(approvalId)) return;
        this.#options.onResolved(approvalId, outcome);
      },
    });
    const unified = this.#unified.get(approvalId);
    const now = new Date().toISOString();
    const approval: ServiceApproval = {
      ...input,
      approvalId,
      createdAt: unified?.createdAt ?? now,
      expiresAt: unified?.expiresAt ?? now,
    };
    this.#pending.set(approvalId, approval);
    this.#options.onRequested(structuredClone(approval));
    return resolution;
  }

  /** The user's decision. Approvals already handled, timed out, or cancelled (and those that are not service approvals) return `already-resolved`. */
  respond(approvalId: Id, decision: ServiceApprovalDecision): { status: 'allowed' | 'denied' | 'already-resolved' } {
    if (!this.#pending.has(approvalId)) return { status: 'already-resolved' };
    return this.#unified.respond(approvalId, decision);
  }

  /** The service stops: all its pending approvals are cancelled. */
  cancelService(serviceId: ServiceId): void {
    this.#unified.cancelWhere((a) => a.subject.kind === 'service' && a.subject.serviceId === serviceId && this.#pending.has(a.approvalId));
  }
}

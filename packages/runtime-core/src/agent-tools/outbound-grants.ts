import type { ProviderKind, RiskLevel } from '@cuccut/protocol';
import type { OutboundPlan } from '../grants/grant-service.ts';

/**
 * Outbound data grants and the risk level of model tools (architecture design §3.12, §12.5): the risk depends on who
 * receives the data and whether a grant covers this outbound use. The decision itself is in `GrantService.plan`
 * (matching grants by data kind, recipient, scope, purpose and budget); this only turns the result into a risk level.
 */

export interface OutboundGrant {
  /** null when it cannot be resolved (no default, unknown Provider): submission will be rejected. */
  kind: ProviderKind | null;
  /** The user enabled it (always true for local models and paired nodes). A disabled one is rejected at submission, and the data never leaves this machine. */
  enabled: boolean;
  /** Stays on this machine, or an existing grant covers this outbound use. */
  granted: boolean;
}

/** Turns a `GrantService.plan` result into a grant state: `none` is local, a node, or a disabled or unresolvable Provider. */
export function outboundGrantOf(plan: OutboundPlan): OutboundGrant {
  switch (plan.status) {
    case 'none': {
      const ownDevice = plan.kind === 'local' || plan.kind === 'node';
      return { kind: plan.kind, enabled: ownDevice, granted: ownDevice };
    }
    case 'covered':
      return { kind: plan.kind, enabled: true, granted: true };
    case 'approval':
      return { kind: plan.kind, enabled: true, granted: false };
  }
}

/**
 * Risk level of model tools (§3.12): local models are `edit` (the result is a candidate asset or artifact, the timeline is
 * not changed, and it can be deleted); sending to a paired node, or outbound use covered by a grant, is `command`;
 * outbound use without a covering grant is `high` (the approval carries the data to be granted). An unresolvable or
 * disabled Provider counts as `command`: submission will be rejected (with a remedy), no data goes out, so there is no
 * need to escalate the approval for it.
 */
export function modelCallRisk(grant: OutboundGrant): RiskLevel {
  if (grant.kind === null || !grant.enabled) return 'command';
  if (grant.kind === 'local') return 'edit';
  return grant.granted ? 'command' : 'high';
}

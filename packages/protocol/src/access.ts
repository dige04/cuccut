import type { Autonomy, Id } from './domain.ts';
import type { GrantRequestItem } from './grants.ts';
import type { ServiceId, ServiceLevel } from './services.ts';
import { live } from './i18n.ts';
import type { Localized } from './message-ref.ts';
import { ProtocolLabels } from './messages/protocol/protocol-labels.ts';

/**
 * Access modes and unified approval (architecture design §3.12, §4.8).
 *
 * - The four access modes decide whether actions in a session need confirmation one by one; `plan` (propose a plan first) is a separate mode that does not perform write operations.
 * - Each action carries a risk level; looking up access mode (or the public service level) × risk level gives "auto", "ask", or "deny".
 * - Old values are still accepted: `controlled` → `ask`, `authorized` → `fullAccess`, `plan` is unchanged (`normalizeAgentMode`).
 */

/** The four access modes, from strictest to most permissive. */
export const ACCESS_MODES = ['ask', 'autoAcceptEdits', 'auto', 'fullAccess'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** The session's mode: the four access modes, plus the separate "propose a plan first" mode. */
export const AGENT_MODES = ['plan', ...ACCESS_MODES] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

/** Old values still accepted (the autonomous mode of 0.1). */
export const LEGACY_AGENT_MODES = ['controlled', 'authorized'] as const;

/** Default mode for new sessions (the default value of `agent.defaultAccessMode`). */
export const DEFAULT_AGENT_MODE: AgentMode = 'auto';

/**
 * Human-readable name (session switch hints, CLI), with a message reference: when it is embedded in a Runtime sentence, pass it as an argument so the UI can regenerate it in its own language.
 */
export function agentModeLabel(mode: AgentMode): Localized {
  switch (mode) {
    case 'plan':
      return ProtocolLabels.modePlan();
    case 'ask':
      return ProtocolLabels.modeAsk();
    case 'autoAcceptEdits':
      return ProtocolLabels.modeAutoAcceptEdits();
    case 'auto':
      return ProtocolLabels.modeAuto();
    case 'fullAccess':
      return ProtocolLabels.modeFullAccess();
  }
}

/** The text of the human-readable name in the current language (read in the current language at read time). */
export const AGENT_MODE_LABELS: Readonly<Record<AgentMode, string>> = live(
  () => Object.fromEntries(AGENT_MODES.map((mode) => [mode, agentModeLabel(mode).text])) as Record<AgentMode, string>,
);

/** Maps an old value to a new one; a new value is returned unchanged. */
export function normalizeAgentMode(mode: AgentMode | Autonomy): AgentMode {
  if (mode === 'controlled') return 'ask';
  if (mode === 'authorized') return 'fullAccess';
  return mode;
}

export function isAgentMode(value: unknown): value is AgentMode | Autonomy {
  return typeof value === 'string' && ([...AGENT_MODES, ...LEGACY_AGENT_MODES] as readonly string[]).includes(value);
}

/**
 * Risk level of an action (closed enum, §3.12):
 * - `read`: query;
 * - `edit`: reversible changes to files and videos;
 * - `command`: running commands and other general actions (cancelling a job, generating through an authorized Provider);
 * - `high`: writing outside the project directory, deleting videos or projects, irreversible overwrites, and sending data out or paid calls that need new authorization.
 */
export const RISK_LEVELS = ['read', 'edit', 'command', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Result of the lookup: run automatically, create a pending approval, or deny outright (write operations under `plan`). */
export type ApprovalVerdict = 'allow' | 'ask' | 'deny';

/**
 * Decision table (§3.12). `read` is automatic in every mode.
 *
 * | Mode | edit | command | high |
 * | --- | --- | --- | --- |
 * | plan | deny | ask | deny |
 * | ask | ask | ask | ask |
 * | autoAcceptEdits | auto | ask | ask |
 * | auto | auto | auto | ask |
 * | fullAccess | auto | auto | auto |
 *
 * `command` under `plan` comes only from the Driver: it asks before running a command in a read-only sandbox, and that still goes to the user as before; CucCut's own write tools are denied directly under `plan`.
 */
export function decideApproval(mode: AgentMode, risk: RiskLevel): ApprovalVerdict {
  if (risk === 'read') return 'allow';
  switch (mode) {
    case 'plan':
      return risk === 'command' ? 'ask' : 'deny';
    case 'ask':
      return 'ask';
    case 'autoAcceptEdits':
      return risk === 'edit' ? 'allow' : 'ask';
    case 'auto':
      return risk === 'high' ? 'ask' : 'allow';
    case 'fullAccess':
      return 'allow';
  }
}

/**
 * Public service levels use the same table (§4.8): `ask` is the same as access mode `ask`, confirming each action; `auto` runs directly (the same as `fullAccess`; sending data out is still gated by whether the Provider is enabled); `read` has only queries, and write tools are not in its directory, so they are denied again here.
 */
export function decideServiceApproval(level: ServiceLevel, risk: RiskLevel): ApprovalVerdict {
  if (risk === 'read') return 'allow';
  if (level === 'read') return 'deny';
  return level === 'auto' ? 'allow' : 'ask';
}

/** The principal of an approval: the session (agent) or the public service's client. */
export type ApprovalSubject =
  | { kind: 'conversation'; conversationId: Id; conversationTitle: string; projectId: Id | null; taskId: Id }
  | { kind: 'service'; serviceId: ServiceId; clientId: string; clientName: string };

/**
 * The action to confirm. `kind`: a CucCut tool call, or a command or file change reported by the Driver; `name` is the tool name (for commands and file changes it is the kind itself);
 * `targets` are the targets (videos, files, or commands), and `summary` is a one-sentence summary of the arguments for people to read.
 */
export interface ApprovalAction {
  kind: 'tool' | 'command' | 'file-change';
  name: string;
  targets: string[];
  summary: string;
}

/** Basis: the session's mode at that time, or the service's level at that time. */
export type ApprovalBasis = { kind: 'mode'; mode: AgentMode } | { kind: 'service'; level: ServiceLevel };

/** A pending approval (the unified list, the `tasks` topic and `approvals.list`). Session approvals have no time limit, so `expiresAt` is null. */
export interface PendingApproval {
  approvalId: Id;
  subject: ApprovalSubject;
  action: ApprovalAction;
  risk: RiskLevel;
  basis: ApprovalBasis;
  createdAt: string;
  expiresAt: string | null;
  /**
   * This action sends out data that is not yet covered by an authorization (architecture design §12.5). When present, allowing may carry a `grant` (`approvals.respond`): either this time only, or also issue an ongoing authorization. Several authorizations needed by one task are merged into the same approval.
   */
  grants?: GrantRequestItem[];
}

/** The outcome of an approval: allowed, denied, timed out (service approvals only), or cancelled (stop, interrupt, disconnect). */
export type ApprovalOutcome = 'allowed' | 'denied' | 'timeout' | 'cancelled';

/** The decision for the unified entry point `approvals.respond`. */
export type PendingApprovalDecision = 'allow' | 'deny';

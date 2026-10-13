import {
  AGENT_MODE_LABELS,
  live,
  type AgentMode,
  type ApprovalRequest,
  type PendingApproval,
  type PendingApprovalDecision,
  type RiskLevel,
} from '@cuccut/protocol';
import { M } from './approvals-copy.ts';

/**
 * Command-line spellings of access modes, and the arguments and output of `cuccut approvals` (Architecture design §3.12). Split out of main.ts so it can be tested on its own.
 */

/** The `--mode` spelling (lowercase, hyphenated) → the value in the protocol. */
const MODE_FLAGS: Readonly<Record<string, AgentMode>> = {
  ask: 'ask',
  'auto-accept-edits': 'autoAcceptEdits',
  auto: 'auto',
  'full-access': 'fullAccess',
  plan: 'plan',
};

/** `--mode` → the access mode to send. undefined when not given (the session's mode is used). */
export function parseModeOption(mode: string | undefined): AgentMode | undefined {
  if (mode === undefined) return undefined;
  const flag = MODE_FLAGS[mode];
  if (!flag) throw new Error(M.unknownMode(mode, Object.keys(MODE_FLAGS)));
  return flag;
}

/** An access mode as shown to people: its name and command-line spelling. */
export function formatMode(mode: AgentMode): string {
  const flag = Object.keys(MODE_FLAGS).find((key) => MODE_FLAGS[key] === mode) ?? mode;
  return M.mode(AGENT_MODE_LABELS[mode], flag);
}

export type ApprovalsCommand = { kind: 'list' } | { kind: 'respond'; approvalId: string; decision: PendingApprovalDecision };

export function parseApprovalsArgs(args: string[]): ApprovalsCommand {
  const [action, approvalId, ...extra] = args;
  if (action === undefined || action === 'list') {
    if (approvalId !== undefined) throw new Error(M.usage);
    return { kind: 'list' };
  }
  if ((action === 'allow' || action === 'deny') && approvalId && extra.length === 0) {
    return { kind: 'respond', approvalId, decision: action };
  }
  throw new Error(M.usage);
}

const RISK_LABELS: Readonly<Record<RiskLevel, string>> = live(() => M.riskLabels);

/** A pending approval, one per line: approval number, who it is from, action and risk, basis, and the time limit for serving the approval. */
export function formatApprovals(approvals: PendingApproval[], now: number = Date.now()): string[] {
  if (approvals.length === 0) return [M.none];
  return approvals.map((a) => {
    const who =
      a.subject.kind === 'conversation'
        ? M.fromSession(a.subject.conversationTitle || a.subject.conversationId)
        : M.fromService(a.subject.serviceId, a.subject.clientName);
    const basis = a.basis.kind === 'mode' ? M.basisMode(formatMode(a.basis.mode)) : M.basisLevel(String(a.basis.level));
    return M.approvalLine({
      id: a.approvalId,
      who,
      action: a.action.name,
      targets: a.action.targets,
      risk: RISK_LABELS[a.risk],
      summary: a.action.summary,
      basis,
      secondsLeft: a.expiresAt === null ? null : Math.max(0, Math.ceil((Date.parse(a.expiresAt) - now) / 1000)),
    });
  });
}

/** What an approval in a session asks you to do (the prompt in `cuccut chat`). */
export function describeApprovalRequest(request: ApprovalRequest): string {
  switch (request.kind) {
    case 'command':
      return M.runCommand(request.command);
    case 'file-change':
      return M.changeFiles(request.files);
    case 'tool':
      return M.callTool(request.tool, request.files);
  }
}

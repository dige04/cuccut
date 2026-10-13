import {
  AGENT_MODE_LABELS,
  live,
  type CheckResult,
  type Money,
  type ProtectionRef,
  type TaskBudgetPolicy,
  type TaskContract,
  type TaskContractView,
} from '@cuccut/protocol';
import { M } from './tasks-copy.ts';

/**
 * Arguments and output of `cuccut tasks`: viewing a task contract (architecture design §3.2). The CLI only reads contracts; changes go through the UI or `tasks.updateContract`.
 * Split out of main.ts so it can be tested on its own.
 */

export type TasksCommand =
  { kind: 'contract'; taskId: string; revision?: number } | { kind: 'history'; taskId: string } | { kind: 'list'; conversationId: string };

export function parseTasksArgs(
  args: string[],
  options: { revision?: string | undefined; conversation?: string | undefined },
): TasksCommand {
  const [action, taskId, ...extra] = args;
  if (extra.length > 0) throw new Error(M.usage);
  switch (action) {
    case 'contract': {
      if (!taskId) throw new Error(M.usage);
      if (options.revision === undefined) return { kind: 'contract', taskId };
      const revision = Number(options.revision);
      if (!Number.isInteger(revision) || revision < 1) throw new Error(M.revisionPositive);
      return { kind: 'contract', taskId, revision };
    }
    case 'history':
      if (!taskId) throw new Error(M.usage);
      return { kind: 'history', taskId };
    case 'list':
      if (taskId !== undefined || !options.conversation) throw new Error(M.usage);
      return { kind: 'list', conversationId: options.conversation };
    default:
      throw new Error(M.usage);
  }
}

const CHANGE_BY: Readonly<Record<TaskContract['change']['by'], string>> = live(() => M.changeBy);
const CHANGE_REASON: Readonly<Record<TaskContract['change']['reason'], string>> = live(() => M.changeReason);
const OUTCOME_LABELS: Readonly<Record<CheckResult['outcome'], string>> = live(() => M.outcomeLabels);

function money(value: Money): string {
  return `${value.amount} ${value.currency}`;
}

function changeLabel(contract: TaskContract): string {
  return M.change(CHANGE_BY[contract.change.by], CHANGE_REASON[contract.change.reason], contract.change.fields, contract.change.at);
}

export function protectionLabel(p: ProtectionRef): string {
  const t = p.target;
  const what =
    t.kind === 'video'
      ? M.wholeVideo
      : t.kind === 'entity'
        ? M.entity(t.entityId)
        : t.kind === 'property'
          ? M.entityProperties(t.entityId, t.propertyPaths)
          : M.frames(t.sequenceId, t.span.fromFrame, t.span.fromFrame + t.span.durationFrames, t.trackIds ?? []);
  return M.protection(p.protectionId, p.videoId, what, p.note || null);
}

export function budgetLabel(policy: TaskBudgetPolicy | null): string {
  if (!policy) return M.noBudget;
  const u = policy.usage;
  const calls = M.calls(u.calls, u.reservedCalls, policy.maxCalls);
  const spent = u.spent.length > 0 ? u.spent.map(money).join(' + ') : null;
  const reserved = u.reserved.length > 0 ? u.reserved.map(money).join(' + ') : null;
  return M.budget(calls, spent, reserved, policy.cap ? money(policy.cap) : null, u.unknownCostCalls);
}

/** All fields of one contract, plus the budget usage and (when given) the results of acceptance checks. */
export function formatContract(view: TaskContractView, results: CheckResult[] = []): string[] {
  const c = view.contract;
  const latest = c.revision === view.latestRevision ? M.latest : M.latestIs(view.latestRevision);
  const scope = c.scope;
  const lines = [
    M.contractHead(c.taskId, c.revision, latest, changeLabel(c)),
    M.goal(c.goal),
    M.sessionVideo(c.conversationId, c.videoId ?? null, c.baseVideoRevision || null),
    M.scope({
      videoId: scope.videoId || null,
      sequenceId: scope.sequenceId || null,
      itemIds: scope.itemIds,
      range: scope.timeRange ? { from: scope.timeRange.fromSeconds, to: scope.timeRange.toSeconds } : null,
    }),
    M.access(AGENT_MODE_LABELS[c.autonomy], c.permissionScopeRef),
    M.budgetLine(budgetLabel(view.budget)),
  ];
  if (c.supersedes) lines.push(M.supersedes(c.supersedes.taskId, c.supersedes.previousWork === 'stop'));
  lines.push(M.constraints(c.constraints.length === 0));
  for (const k of c.constraints) lines.push(`  ${k.constraintId}  [${k.kind}] ${k.text}`);
  lines.push(M.protectedRefs(c.protectedRefs.length === 0));
  for (const p of c.protectedRefs) lines.push(`  ${protectionLabel(p)}`);
  lines.push(M.deliverables(c.deliverables.map((d) => M.deliverable(d.kind, d.requiredStage, d.language || null))));
  lines.push(M.checks(c.acceptanceChecks.length === 0));
  for (const check of c.acceptanceChecks) {
    const last = results.filter((r) => r.checkId === check.checkId).at(-1);
    const outcome = last ? M.outcome(OUTCOME_LABELS[last.outcome], last.recordedBy === 'agent', last.note || null) : M.notRecorded;
    lines.push(M.checkLine(check.checkId, check.kind, Boolean(check.required), check.description, outcome));
  }
  return lines;
}

/** Revision history, one revision per line (oldest first). */
export function formatContractHistory(contracts: TaskContract[]): string[] {
  if (contracts.length === 0) return [M.noContracts];
  return contracts.map((c) => M.historyLine(c.revision, changeLabel(c), AGENT_MODE_LABELS[c.autonomy]));
}

/** The latest contract for each task in the session, one task per line (newest first). */
export function formatContractList(contracts: TaskContract[]): string[] {
  if (contracts.length === 0) return [M.noTasks];
  return contracts.map((c) => M.listLine(c.taskId, c.revision, AGENT_MODE_LABELS[c.autonomy], c.goal.replace(/\s+/g, ' ').slice(0, 60)));
}

import {
  AGENT_READONLY_CONTRACT_FIELDS,
  RpcError,
  defaultContextSelection,
  newId,
  type AgentMode,
  type CheckDefinition,
  type Conversation,
  type ConstraintRef,
  type ContextSelection,
  type ContractChange,
  type EditorContext,
  type Id,
  type ProtectionRef,
  type TaskBudgetLimits,
  type TaskBudgetPolicy,
  type TaskContract,
  type TaskContractInput,
  type TaskContractPatch,
  type TaskDeliverable,
} from '@cuccut/protocol';
import { HarnessAgents as HA } from '@cuccut/protocol/messages/harness';

/**
 * Creation and revision of task contracts (architecture design §3.2). Pure functions: storage and events are the Harness's responsibility.
 *
 * - Default contract: the goal is the user's message, the scope comes from the editor context, and when a video is open the deliverable is “changes written into the video”; no constraints, protections or checks;
 * - Revisions are append-only: the fields given are replaced as a whole, `revision` goes up by one, and `change` records who changed which fields;
 * - Source of protections: newly added ones record the revision at which they were added; carried-over ones (same `protectionId`) keep their original source.
 */

/** Task budget ledger (the Runtime's authorization service). The Harness does not know its implementation, and reads and writes it only when creating and modifying contracts. */
export interface TaskBudgetPort {
  taskBudget(taskId: Id): TaskBudgetPolicy | null;
  setTaskBudget(taskId: Id, limits: TaskBudgetLimits): TaskBudgetPolicy;
}

export const NO_TASK_BUDGET: TaskBudgetLimits = { maxCalls: null, cap: null };

export function buildContract(input: {
  taskId: Id;
  conversation: Conversation;
  goal: string;
  context: EditorContext | undefined;
  autonomy: AgentMode;
  contract: TaskContractInput | undefined;
  budgetPolicyRef: Id | null;
  supersedes: TaskContract['supersedes'];
  by: ContractChange['by'];
  at: string;
}): TaskContract {
  const given = input.contract ?? {};
  const scope: ContextSelection = { ...defaultContextSelection(input.context), ...given.scope };
  const videoId = input.context?.videoId ?? scope.videoId ?? null;
  const deliverables: TaskDeliverable[] = given.deliverables ?? (videoId ? [{ kind: 'video-change', requiredStage: 'committed' }] : []);
  return {
    taskId: input.taskId,
    revision: 1,
    conversationId: input.conversation.id,
    videoId,
    baseVideoRevision: input.context?.revision ?? scope.videoRevision ?? null,
    goal: input.goal,
    scope,
    constraints: constraintsOf(given.constraints),
    protectedRefs: protectionsOf(given.protectedRefs, [], 1, input.at),
    deliverables,
    autonomy: input.autonomy,
    permissionScopeRef: input.conversation.projectId ?? input.conversation.id,
    budgetPolicyRef: input.budgetPolicyRef,
    acceptanceChecks: checksOf(given.acceptanceChecks),
    supersedes: input.supersedes,
    change: { by: input.by, reason: input.supersedes ? 'goal' : 'created', fields: [], at: input.at },
  };
}

/** Rejects when the agent changes a field it may not change (`CONTRACT_FIELD_READONLY`). */
export function assertAgentPatch(patch: TaskContractPatch): void {
  const fields = Object.keys(patch).filter((key) => (AGENT_READONLY_CONTRACT_FIELDS as readonly string[]).includes(key));
  if (fields.length > 0) {
    throw new RpcError('forbidden', HA.contractFieldsReadonly({ fields: fields.join(HA.listSeparator().text) }), {
      code: 'CONTRACT_FIELD_READONLY',
      fields,
    });
  }
}

/** Derives the next revision from the previous revision and the change. */
export function reviseContract(
  previous: TaskContract,
  patch: TaskContractPatch,
  change: { by: ContractChange['by']; reason: ContractChange['reason']; at: string; budgetPolicyRef?: Id | null },
): TaskContract {
  const revision = previous.revision + 1;
  const fields = (Object.keys(patch) as Array<keyof TaskContractPatch>).filter((key) => patch[key] !== undefined);
  const next: TaskContract = {
    ...structuredClone(previous),
    revision,
    change: { by: change.by, reason: change.reason, fields, at: change.at },
  };
  if (patch.scope !== undefined) next.scope = { ...previous.scope, ...patch.scope };
  if (patch.constraints !== undefined) next.constraints = constraintsOf(patch.constraints);
  if (patch.protectedRefs !== undefined)
    next.protectedRefs = protectionsOf(patch.protectedRefs, previous.protectedRefs, revision, change.at);
  if (patch.deliverables !== undefined) next.deliverables = structuredClone(patch.deliverables);
  if (patch.autonomy !== undefined) next.autonomy = patch.autonomy;
  if (patch.acceptanceChecks !== undefined) next.acceptanceChecks = checksOf(patch.acceptanceChecks);
  if (change.budgetPolicyRef !== undefined) next.budgetPolicyRef = change.budgetPolicyRef;
  return next;
}

/** Contract input for a new task derived from the old contract when the goal changes: scope, constraints, protections, deliverable and checks are copied as they are; the budget limit is copied too (usage starts from zero). */
export function carriedInput(previous: TaskContract, budget: TaskBudgetPolicy | null): TaskContractInput {
  return {
    scope: structuredClone(previous.scope),
    constraints: structuredClone(previous.constraints),
    protectedRefs: previous.protectedRefs.map((p) => ({
      protectionId: p.protectionId,
      videoId: p.videoId,
      target: structuredClone(p.target),
      ...(p.note !== undefined ? { note: p.note } : {}),
    })),
    deliverables: structuredClone(previous.deliverables),
    acceptanceChecks: structuredClone(previous.acceptanceChecks),
    ...(budget ? { budget: { maxCalls: budget.maxCalls, cap: budget.cap } } : {}),
  };
}

/** The protection handed to the engine: only this video's. */
export function engineProtections(contract: TaskContract | null, videoId: Id): Array<Pick<ProtectionRef, 'protectionId' | 'target'>> {
  if (!contract) return [];
  return contract.protectedRefs
    .filter((p) => p.videoId === videoId)
    .map((p) => ({ protectionId: p.protectionId, target: structuredClone(p.target) }));
}

function constraintsOf(input: TaskContractInput['constraints']): ConstraintRef[] {
  return (input ?? []).map((c) => ({ constraintId: c.constraintId ?? newId('cons'), kind: c.kind, text: c.text.trim() }));
}

function checksOf(input: TaskContractInput['acceptanceChecks']): CheckDefinition[] {
  return (input ?? []).map((c) => ({
    checkId: c.checkId ?? newId('check'),
    kind: c.kind,
    description: c.description.trim(),
    required: c.required,
  }));
}

function protectionsOf(
  input: TaskContractInput['protectedRefs'],
  previous: ProtectionRef[],
  revision: number,
  at: string,
): ProtectionRef[] {
  return (input ?? []).map((p) => {
    const kept = p.protectionId ? previous.find((q) => q.protectionId === p.protectionId) : undefined;
    return {
      protectionId: p.protectionId ?? newId('prot'),
      videoId: p.videoId,
      target: structuredClone(p.target),
      origin: kept ? kept.origin : { by: 'user', revision, at },
      ...(p.note !== undefined ? { note: p.note } : {}),
    };
  });
}

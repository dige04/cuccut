import type { AgentMode } from './access.ts';
import type { EditorContext, Id } from './domain.ts';
import type { Money } from './grants.ts';

/**
 * Task contract (architecture design §3.2, product design §6): a task's goal, scope, constraints, “do not change” items, deliverables, access mode, permission scope, budget and acceptance checks.
 *
 * - The contract is established together with the task (Run). For anything not explicitly given when a message is sent, the Runtime establishes a default contract from the editor context and the session's mode. It is visible to the user through the session's `item.upsert` (the `contract` on the task item) and the `tasks` topic (`contractRevision`).
 * - Each change produces a new `revision` (starting from 1). Old revisions are kept and can be queried (`tasks.getContract` gives `revision`).
 * - Steps not yet started adopt the new constraints. A Job whose inputs are already frozen does not change its content while executing.
 * - `autonomy` is just the session's access mode (§3.12), not a second system. Changing the contract's `autonomy` is the same as switching the session's mode, and switching the session's mode also records a new revision on the contract of the in-progress task.
 */

export type TaskDeliverableKind = 'preview' | 'video-change' | 'video-file' | 'subtitle' | 'audio' | 'package';
export type TaskDeliverableStage = 'candidate-ready' | 'committed' | 'published';

export interface TaskDeliverable {
  kind: TaskDeliverableKind;
  /** The delivery stage at which the task counts as complete: candidate ready, written into the video, or published to the project directory. */
  requiredStage: TaskDeliverableStage;
  /** BCP 47 language tag (subtitles, dubbing). */
  language?: string;
  /** Aspect ratio variant. */
  variantId?: Id;
}

/**
 * Context scope of the task (first version): the objects the agent's “this” and “here” refer to. By default derived from the editor context at send time.
 * Time ranges are in output time (seconds). When absent, it is the whole video.
 */
export interface ContextSelection {
  videoId: Id | null;
  /** The video version the user was looking at when issuing the task. */
  videoRevision: string | null;
  /** The sequence the scope is in. The root sequence when not given. */
  sequenceId: Id | null;
  /** The selected timeline instance. */
  itemIds: Id[];
  /** A range on output time (seconds). */
  timeRange: { fromSeconds: number; toSeconds: number } | null;
}

export type ConstraintKind = 'content' | 'style' | 'duration' | 'format' | 'language' | 'other';

/** One content constraint (in the first version it is natural language, handed to the agent; QualityService does not judge against it automatically). */
export interface ConstraintRef {
  constraintId: Id;
  kind: ConstraintKind;
  text: string;
}

/**
 * Protection that applies only to this task (the target shape from the video format spec §3.10, with the attributes also listed separately). The agent's submissions and reverts within the task carry it. VideoEngine checks it on commit, and touching it rejects the whole operation with `TASK_PROTECTED`. User and manual edits are not restricted.
 *
 * - `video`: any change to the whole video;
 * - `entity`: the entity itself (create, modify, delete), not including its sub-entities;
 * - `property`: several properties of an entity, given as dot-separated paths (`text`, `style.fontSize`, `place.x`). Deleting the entity counts as touching it;
 * - `interval`: a frame range on the sequence. Timeline instances that intersect it before or after the change (audio uses exact start and end times). `trackIds` restricts it to tracks.
 */
export type ProtectionTarget =
  | { kind: 'video' }
  | { kind: 'entity'; entityId: Id }
  | { kind: 'property'; entityId: Id; propertyPaths: string[] }
  | { kind: 'interval'; sequenceId: Id; span: { fromFrame: number; durationFrames: number }; trackIds?: Id[] };

export interface ProtectionRef {
  protectionId: Id;
  videoId: Id;
  target: ProtectionTarget;
  /** Authorization source: the contract revision in which the user added it. Its effective scope is this task (all later revisions of the contract, until it is removed). */
  origin: { by: 'user'; revision: number; at: string };
  note?: string;
}

/**
 * One acceptance check. `review` results are recorded after the user or agent judges them. `quality` is left for QualityService to run automatically (not executed in the first version; only defined and recorded, see architecture design §14).
 */
export interface CheckDefinition {
  checkId: Id;
  kind: 'review' | 'quality';
  description: string;
  /** Required: until it is recorded as passed, the task does not count as meeting acceptance. */
  required: boolean;
}

export type CheckOutcome = 'passed' | 'failed' | 'skipped';

/** One check result. Kept in the order recorded; the latest one is the current result. */
export interface CheckResult {
  resultId: Id;
  checkId: Id;
  /** The contract revision at the time of recording. */
  contractRevision: number;
  outcome: CheckOutcome;
  note: string | null;
  recordedBy: 'user' | 'agent';
  recordedAt: string;
}

/** Who produced this contract revision, and why. */
export interface ContractChange {
  by: 'user' | 'agent' | 'runtime';
  /** `created`: established; `updated`: fields modified; `mode`: access mode switched; `goal`: derived from the old task after the goal was changed. */
  reason: 'created' | 'updated' | 'mode' | 'goal';
  /** Which fields this revision changed. */
  fields: Array<keyof TaskContractPatch | 'goal'>;
  at: string;
}

export interface TaskContract {
  taskId: Id;
  /** Contract revision number, starting from 1 and increasing by one on each change. */
  revision: number;
  conversationId: Id;
  videoId: Id | null;
  baseVideoRevision: string | null;
  goal: string;
  scope: ContextSelection;
  constraints: ConstraintRef[];
  protectedRefs: ProtectionRef[];
  deliverables: TaskDeliverable[];
  /** The session's current access mode (§3.12). */
  autonomy: AgentMode;
  /** Permission scope: the project the session is bound to (`projectId`). For a session not belonging to a project, the session itself (`conversationId`). Follows the session's binding and is not changed through contract edits. */
  permissionScopeRef: Id;
  /** Task budget policy (`TaskBudgetPolicy.policyId`); null when there is no Runtime budget ledger. */
  budgetPolicyRef: Id | null;
  acceptanceChecks: CheckDefinition[];
  /** When the goal changes: how the old task this task replaces, and the old work, are handled. */
  supersedes: { taskId: Id; previousWork: 'stop' | 'keep' } | null;
  change: ContractChange;
}

/**
 * Task budget (architecture design §7.8): the caps on count and amount, totaled across providers, for all outbound calls in a task (Jobs submitted by the agent, fixed pipelines started in the task, and their sub-steps). Each call must also pass this budget after being admitted through the Grant. `null` means no cap is set for this item.
 */
export interface TaskBudgetLimits {
  maxCalls: number | null;
  cap: Money | null;
}

export interface TaskBudgetPolicy extends TaskBudgetLimits {
  policyId: Id;
  taskId: Id;
  usage: TaskBudgetUsage;
  createdAt: string;
  updatedAt: string;
}

/** Task budget usage: settled amounts listed by currency; calls with unknown amounts count only toward the count. */
export interface TaskBudgetUsage {
  calls: number;
  reservedCalls: number;
  /** Settled amounts, one item per currency. */
  spent: Money[];
  /** Amount reserved (when there is a cap, in the cap's currency). */
  reserved: Money[];
  unknownCostCalls: number;
}

/** Contract given when the task is created (all optional; defaults apply to anything not given). */
export interface TaskContractInput {
  scope?: Partial<ContextSelection>;
  constraints?: Array<Omit<ConstraintRef, 'constraintId'> & { constraintId?: Id }>;
  protectedRefs?: ProtectionInput[];
  deliverables?: TaskDeliverable[];
  budget?: TaskBudgetLimits;
  acceptanceChecks?: Array<Omit<CheckDefinition, 'checkId'> & { checkId?: Id }>;
}

export interface ProtectionInput {
  protectionId?: Id;
  videoId: Id;
  target: ProtectionTarget;
  note?: string;
}

/**
 * Contract change: the fields given replace the whole field. `autonomy` is the same as switching the session's access mode. The agent may only change `scope`, `constraints`, `deliverables` and `acceptanceChecks`. `autonomy`, `budget` and `protectedRefs` are changed only by the user (`CONTRACT_FIELD_READONLY`). The permission scope is not changed through the contract.
 */
export interface TaskContractPatch {
  scope?: Partial<ContextSelection>;
  constraints?: TaskContractInput['constraints'];
  protectedRefs?: ProtectionInput[];
  deliverables?: TaskDeliverable[];
  autonomy?: AgentMode;
  budget?: TaskBudgetLimits;
  acceptanceChecks?: TaskContractInput['acceptanceChecks'];
}

/** Contract fields the agent cannot modify. */
export const AGENT_READONLY_CONTRACT_FIELDS = ['autonomy', 'budget', 'protectedRefs', 'permissionScopeRef', 'budgetPolicyRef'] as const;

/** The contract and its budget usage (the result of `tasks.getContract`). */
export interface TaskContractView {
  contract: TaskContract;
  /** Latest revision number (differs from `contract.revision` when an old revision is queried). */
  latestRevision: number;
  budget: TaskBudgetPolicy | null;
}

/** Default scope derived from the editor context. */
export function defaultContextSelection(context: EditorContext | undefined): ContextSelection {
  return {
    videoId: context?.videoId ?? null,
    videoRevision: context?.revision ?? null,
    sequenceId: null,
    itemIds: context ? [...context.selection] : [],
    timeRange: null,
  };
}

/** Error codes for task contracts (command and protocol spec §11.3). */
export const TASK_CONTRACT_ERROR_CODES = [
  'TASK_PROTECTED',
  'TASK_BUDGET_EXCEEDED',
  'TASK_BUDGET_UNVERIFIABLE',
  'CONTRACT_REVISION_CONFLICT',
  'CONTRACT_FIELD_READONLY',
  'TASK_NOT_RUNNING',
] as const;
export type TaskContractErrorCode = (typeof TASK_CONTRACT_ERROR_CODES)[number];

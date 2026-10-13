import { z } from 'zod';
import { RpcError, newId, type Id, type TaskContractPatch } from '@cuccut/protocol';
import { taskContractPatchSchema } from '@cuccut/protocol/schemas';
import type { Harness } from '@cuccut/harness';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import type { ToolAccess, ToolPrincipal, ToolScope } from './tool-scope.ts';

/**
 * The agent reads and writes its own task contract (architecture design §3.2): only for agents in a session (`surfaces`
 * is only `agent`); external services and the CLI have no task.
 *
 * - `tasks_contract`: reads the current task's contract, budget usage and acceptance-check results;
 * - `tasks_update_contract`: refines scope, constraints, deliverables and acceptance checks. Access mode, permission
 *   scope, budget and protected scope are decided by the user only; a call that includes them is rejected as a whole
 *   (`CONTRACT_FIELD_READONLY`); the revision is recorded as made by the agent and is visible to the user;
 * - `tasks_record_check`: records the result of one acceptance check.
 */

export interface TaskToolsDeps {
  harness: Harness;
  scope: ToolScope;
}

const schemas = {
  tasks_contract: z.strictObject({
    revision: z.number().int().min(1).optional().describe('Optional. Contract revision number; defaults to the latest revision'),
  }),
  tasks_update_contract: z.strictObject({
    expectedRevision: z.number().int().min(1).describe('The contract revision you read (contract.revision from tasks_contract)'),
    patch: taskContractPatchSchema.describe('Fields to replace: scope, constraints, deliverables, acceptanceChecks; each given field is replaced as a whole'),
  }),
  tasks_record_check: z.strictObject({
    checkId: z.string().min(1).max(200).describe('A checkId from the contract\'s acceptanceChecks'),
    outcome: z.enum(['passed', 'failed', 'skipped']).describe('Outcome: passed, failed or skipped'),
    note: z.string().max(2000).optional().describe('Optional. Evidence or explanation, shown to the user'),
  }),
};

const DEFINITIONS: Record<keyof typeof schemas, ToolInfo> = {
  tasks_contract: {
    title: 'Read the task contract',
    description: [
      'Reads the current task\'s contract.',
      'It includes the goal, scope, constraints, content the user protects (protectedRefs; do not modify them), deliverables, access mode, budget and usage, acceptance checks and their recorded results.',
      'Read it once before you start making changes; after the user changes the contract (the revision number changes), follow the new constraints.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Read the current contract', args: {} }],
    surfaces: ['agent'],
  },
  tasks_update_contract: {
    title: 'Refine the task contract',
    description: [
      'Writes your understanding of the task into the contract.',
      'Writable fields are scope, constraints, deliverables and acceptanceChecks. Each given field is replaced as a whole and creates a new revision.',
      'Access mode, permission scope, budget and protected scope are decided by the user only: do not try to change them; when needed, ask the user to change them in CucCut. If expectedRevision is not the latest, the call is rejected with CONTRACT_REVISION_CONFLICT; read the contract again, then retry.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Add an acceptance check',
        args: {
          expectedRevision: 1,
          patch: { acceptanceChecks: [{ kind: 'review', description: 'Bilingual captions checked sentence by sentence against the source', required: true }] },
        },
      },
    ],
    surfaces: ['agent'],
  },
  tasks_record_check: {
    title: 'Record an acceptance-check result',
    description:
      'Records the result of one acceptance check, with its evidence. The result is passed, failed or skipped. Record it after verifying against the contract\'s acceptance check; the result is marked as recorded by the agent and is visible to the user.',
    effect: 'mutation',
    examples: [{ title: 'Record a pass', args: { checkId: 'check_1', outcome: 'passed', note: 'Timing checked sentence by sentence' } }],
    surfaces: ['agent'],
  },
};

type ContractArgs = z.infer<(typeof schemas)['tasks_contract']>;
type UpdateArgs = z.infer<(typeof schemas)['tasks_update_contract']>;
type CheckArgs = z.infer<(typeof schemas)['tasks_record_check']>;

export class TaskTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #harness: Harness;
  readonly #scope: ToolScope;

  constructor(deps: TaskToolsDeps) {
    this.#harness = deps.harness;
    this.#scope = deps.scope;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    try {
      switch (name) {
        case 'tasks_contract':
          return this.#contract(args as ContractArgs, principal);
        case 'tasks_update_contract':
          return this.#update(args as UpdateArgs, principal);
        case 'tasks_record_check':
          return this.#record(args as CheckArgs, principal);
        default:
          throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
      }
    } catch (error) {
      throw contractError(error);
    }
  }

  #contract(args: ContractArgs, principal: ToolPrincipal) {
    const taskId = this.#task(this.#scope.authorize(principal, false));
    const view = this.#harness.getContract(taskId, args.revision);
    const { results } = this.#harness.listChecks(taskId);
    return { ...view, checkResults: results };
  }

  #update(args: UpdateArgs, principal: ToolPrincipal) {
    const taskId = this.#task(this.#scope.authorize(principal, false));
    const { contract } = this.#harness.updateContract(
      { taskId, expectedRevision: args.expectedRevision, commandId: newId('cmd'), patch: args.patch as TaskContractPatch },
      'agent',
    );
    return { contract, next: 'Contract updated: follow the new revision in the next steps.' };
  }

  #record(args: CheckArgs, principal: ToolPrincipal) {
    const taskId = this.#task(this.#scope.authorize(principal, false));
    const { result } = this.#harness.recordCheck(
      { taskId, checkId: args.checkId, outcome: args.outcome, ...(args.note !== undefined ? { note: args.note } : {}) },
      'agent',
    );
    return { result };
  }

  #task(access: ToolAccess): Id {
    if (access.submitter.kind !== 'agent' || !access.submitter.taskId) throw new ToolError('UNKNOWN_TOOL', 'This tool is only for agents in a session');
    return access.submitter.taskId;
  }
}

/** Contract rejections reach the agent with their own error codes (`CONTRACT_FIELD_READONLY`, `CONTRACT_REVISION_CONFLICT`, `TASK_NOT_RUNNING`). */
function contractError(error: unknown): unknown {
  if (!(error instanceof RpcError)) return error;
  const details = error.details as Record<string, unknown> | undefined;
  if (details && typeof details.code === 'string') {
    const { code, ...rest } = details;
    return new ToolError(code, error.message, rest);
  }
  return error;
}

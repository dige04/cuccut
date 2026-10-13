import {
  RpcError,
  isGrantErrorCode,
  refOf,
  type Grant,
  type GrantDataKind,
  type GrantErrorCode,
  type GrantRequestItem,
  type Id,
  type JobError,
  type Localized,
  type MessageRef,
  type Money,
  type TaskBudgetPolicy,
} from '@cuccut/protocol';
import type { GrantEvaluation, TaskBudgetRefusal } from '@cuccut/runtime-storage';
import { RcGrants } from '@cuccut/protocol/messages/runtime-core';
import { localizedOf } from '../localized.ts';

/**
 * Authorization and budget errors (architecture design §12.5, §7.8; command and protocol spec §11.3). `RpcError.details.code` is a fixed error code, and `remedy` says how the user can fix it. Agents, the CLI, and the model interface service decide the next step by `code`.
 *
 * - `GRANT_REQUIRED` (forbidden): no grant covers this outbound data transfer;
 * - `GRANT_REVOKED` (forbidden): the grant covering it has been revoked, has expired, or has been narrowed;
 * - `BUDGET_EXCEEDED` (conflict): the grant covering it has run out of quota (count or amount);
 * - `BUDGET_UNVERIFIABLE` (conflict): the grant has an amount cap, but this model cannot estimate amounts, so the cap cannot be guaranteed.
 * - `TASK_BUDGET_EXCEEDED` (conflict): the grant is sufficient, but this task's budget (total count or amount across providers) has run out;
 * - `TASK_BUDGET_UNVERIFIABLE` (conflict): the task budget has an amount cap, but this call's amount cannot be estimated in the same currency, or the used amount includes calls in another currency or with unknown amounts, so the cap cannot be guaranteed.
 */

export interface GrantErrorContext {
  recipient: string;
  /** The provider's display name. */
  label: string;
  dataKinds: readonly GrantDataKind[];
  videoId: Id | null;
}

export interface GrantErrorDetails {
  code: GrantErrorCode;
  recipient: string;
  dataKinds: GrantDataKind[];
  videoId: Id | null;
  grantId?: Id;
  measure?: 'calls' | 'amount';
  usage?: Grant['usage'];
  maxCalls?: number | null;
  budgetCap?: Money | null;
  /** Task budget error: the task and its budget (limit and usage). */
  taskId?: Id;
  taskBudget?: TaskBudgetPolicy;
  /** `hint` is text in the language it was emitted in; `hintRef` is its message reference (the UI regenerates it in its own language). */
  remedy: { action: 'create-grant' | 'raise-budget' | 'approve-once'; hint: string; hintRef?: MessageRef; commands: string[] };
}

/** Description of the data kinds (in the current language; with several items, they are joined the way the language normally joins them). */
export function kindsText(kinds: readonly GrantDataKind[]): string {
  return RcGrants.dataKinds({ kinds: kinds.join(',') }).text;
}

/** Remedy text: the text and its reference go into `remedy` together. */
function hint(message: Localized): { hint: string; hintRef: MessageRef } {
  return { hint: message.text, hintRef: refOf(message) };
}

/** The command that issues a grant; the placeholder for `--purpose` is written in the current language. `extra` is inserted before `--purpose`. */
function createCommand(ctx: GrantErrorContext, extra = ''): string {
  return `cuccut grants create --recipient ${ctx.recipient} --data ${ctx.dataKinds.join(',')}${ctx.videoId ? ` --video ${ctx.videoId}` : ''}${extra} --purpose "${RcGrants.placeholderPurpose().text}"`;
}

/** Evaluation failed → the error on submission. */
export function grantRpcError(evaluation: Exclude<GrantEvaluation, { status: 'covered' }>, ctx: GrantErrorContext): RpcError {
  const base = { recipient: ctx.recipient, dataKinds: [...ctx.dataKinds], videoId: ctx.videoId };
  const kinds = ctx.dataKinds.join(',');
  switch (evaluation.status) {
    case 'none':
      if (evaluation.revoked) {
        const grant = evaluation.revoked;
        return new RpcError('forbidden', RcGrants.grantLapsed({ kinds, label: ctx.label, expired: grant.state === 'expired' }), {
          code: 'GRANT_REVOKED',
          ...base,
          grantId: grant.grantId,
          remedy: {
            action: 'create-grant',
            ...hint(RcGrants.hintRevoked()),
            commands: [createCommand(ctx)],
          },
        } satisfies GrantErrorDetails);
      }
      return new RpcError('forbidden', RcGrants.grantRequired({ kinds, label: ctx.label }), {
        code: 'GRANT_REQUIRED',
        ...base,
        remedy: {
          action: 'create-grant',
          ...hint(RcGrants.hintRequired()),
          commands: [createCommand(ctx)],
        },
      } satisfies GrantErrorDetails);
    case 'exhausted': {
      const grant = evaluation.grant;
      const message =
        evaluation.measure === 'calls'
          ? RcGrants.grantCallsUsedUp({ used: grant.usage.calls + grant.usage.reservedCalls, max: grant.maxCalls })
          : RcGrants.grantAmountUsedUp();
      return new RpcError('conflict', message, {
        code: 'BUDGET_EXCEEDED',
        ...base,
        grantId: grant.grantId,
        measure: evaluation.measure,
        usage: grant.usage,
        maxCalls: grant.maxCalls,
        budgetCap: grant.budgetCap,
        remedy: {
          action: 'raise-budget',
          ...hint(RcGrants.hintExhausted()),
          commands: [
            evaluation.measure === 'calls'
              ? `cuccut grants update ${grant.grantId} --max-calls ${RcGrants.placeholderMaxCalls().text}`
              : `cuccut grants update ${grant.grantId} --budget ${RcGrants.placeholderBudget().text} --currency ${grant.budgetCap?.currency ?? 'USD'}`,
          ],
        },
      } satisfies GrantErrorDetails);
    }
    case 'unverifiable': {
      const grant = evaluation.grant;
      return new RpcError('conflict', RcGrants.budgetUnverifiable({ label: ctx.label }), {
        code: 'BUDGET_UNVERIFIABLE',
        ...base,
        grantId: grant.grantId,
        budgetCap: grant.budgetCap,
        remedy: {
          action: 'approve-once',
          ...hint(RcGrants.hintUnverifiable()),
          commands: [createCommand(ctx, ` --max-calls ${RcGrants.placeholderCalls().text}`)],
        },
      } satisfies GrantErrorDetails);
    }
  }
}

/** Task budget check failed → the error on submission (§7.8): no Job is created. */
export function taskBudgetRpcError(refusal: TaskBudgetRefusal, ctx: GrantErrorContext): RpcError {
  const { policy } = refusal;
  const base = { recipient: ctx.recipient, dataKinds: [...ctx.dataKinds], videoId: ctx.videoId, taskId: policy.taskId, taskBudget: policy };
  const view = `cuccut tasks contract ${policy.taskId}`;
  if (refusal.status === 'exhausted') {
    const message =
      refusal.measure === 'calls'
        ? RcGrants.taskCallsUsedUp({ used: policy.usage.calls + policy.usage.reservedCalls, max: policy.maxCalls })
        : RcGrants.taskAmountUsedUp({ amount: String(policy.cap?.amount), currency: String(policy.cap?.currency) });
    return new RpcError('conflict', message, {
      code: 'TASK_BUDGET_EXCEEDED',
      ...base,
      measure: refusal.measure,
      remedy: {
        action: 'raise-budget',
        ...hint(RcGrants.hintTaskExhausted()),
        commands: [view],
      },
    } satisfies GrantErrorDetails);
  }
  return new RpcError('conflict', RcGrants.taskBudgetUnverifiable({ currency: String(policy.cap?.currency) }), {
    code: 'TASK_BUDGET_UNVERIFIABLE',
    ...base,
    remedy: {
      action: 'raise-budget',
      ...hint(RcGrants.hintTaskUnverifiable()),
      commands: [view],
    },
  } satisfies GrantErrorDetails);
}

/** Rejections that the user can resolve by issuing one grant, and the matching `GrantRequestItem.reason`. Task budgets (`TASK_BUDGET_*`) are not included. */
const APPROVABLE: Readonly<Partial<Record<GrantErrorCode, GrantRequestItem['reason']>>> = {
  GRANT_REQUIRED: 'none',
  GRANT_REVOKED: 'revoked',
  BUDGET_UNVERIFIABLE: 'unverifiable',
  BUDGET_EXCEEDED: 'exhausted',
};

/** When a rejection can be resolved by the user granting permission, the `reason` of the pending item; null when it cannot (task budgets, other errors). */
export function approvableReason(error: unknown): GrantRequestItem['reason'] | null {
  if (!(error instanceof RpcError) || !isGrantErrorDetails(error.details)) return null;
  return APPROVABLE[error.details.code] ?? null;
}

/**
 * On-the-spot grant in the tool page (§7.9): a present user receives rejections that carry, in `details.pendingGrants` (`PendingGrantsDetails`), all the outbound transfers this call needs approved. The other fields (`code`, and the commands in `remedy`) are unchanged. Rejections that cannot be resolved by a grant are returned as is. This only lists the pending items and grants nothing.
 */
export function withPendingGrants(error: unknown, items: readonly GrantRequestItem[]): unknown {
  if (approvableReason(error) === null || items.length === 0) return error;
  const rpc = error as RpcError;
  return new RpcError(rpc.code, rpc.message, { ...(rpc.details as GrantErrorDetails), pendingGrants: [...items] }, rpc.messageRef);
}

/**
 * Before a flow starts, the rejections for each kind of outbound transfer are combined into one (a single rejection explains everything that must be done): the first item's error code, description, and remedy. `remedy.commands` holds the commands for all the items (deduplicated, in order of appearance).
 */
export function combinedGrantError(errors: readonly RpcError[]): RpcError {
  const first = errors[0]!;
  if (errors.length === 1) return first;
  const details = first.details as GrantErrorDetails;
  const commands: string[] = [];
  for (const error of errors) {
    for (const command of (error.details as GrantErrorDetails).remedy?.commands ?? [])
      if (!commands.includes(command)) commands.push(command);
  }
  const others = errors.length - 1;
  return new RpcError(first.code, RcGrants.combined({ message: localizedOf(first), others }), {
    ...details,
    remedy: { ...details.remedy, commands },
  } satisfies GrantErrorDetails);
}

/** Found before execution starts that the grant has been revoked, expired, or narrowed: the task fails with it, and the reservation is released. */
export function grantRevokedJobError(grant: Grant | null): JobError {
  const message = grant ? RcGrants.grantLapsedBeforeStart({ state: grant.state }) : RcGrants.grantInvalidBeforeStart();
  return {
    code: 'GRANT_REVOKED',
    message: message.text,
    messageRef: refOf(message),
    ...(grant ? { details: { grantId: grant.grantId, generation: grant.generation, state: grant.state } } : {}),
  };
}

/** Not enough quota on automatic retry (retries also consume budget). */
export function retryBudgetJobError(error: RpcError): JobError {
  const details = error.details as GrantErrorDetails;
  const message = RcGrants.retrySkipped({ reason: localizedOf(error) });
  return { code: details.code, message: message.text, messageRef: refOf(message), details: { ...details } };
}

export function isGrantErrorDetails(value: unknown): value is GrantErrorDetails {
  if (typeof value !== 'object' || value === null) return false;
  const code = (value as { code?: unknown }).code;
  return isGrantErrorCode(code);
}

/** The next step for an agent or external client that gets a grant error: relay it to the user; do not switch providers to get around it. */
export const GRANT_NEXT: Readonly<Record<GrantErrorCode, string>> = {
  GRANT_REQUIRED:
    'Handing this data to this provider needs the user\'s grant: relay remedy.hint to the user and ask them to grant it in CucCut (or approve this one call in the session), then try again. Do not switch providers, use a local tool or find another way around it.',
  GRANT_REVOKED: 'The user revoked this grant (or it expired): do not retry; tell the user, and try again once they grant it again. Do not switch providers to get around it.',
  BUDGET_EXCEEDED: 'This grant\'s budget is used up: do not retry; relay remedy to the user, who decides whether to raise the limit. Do not switch providers to get around the budget.',
  BUDGET_UNVERIFIABLE: 'The cost of this model cannot be estimated, so a grant with a spending limit cannot guarantee staying under it: ask the user to approve each call (amount unknown) or to use a per-call grant instead.',
  TASK_BUDGET_EXCEEDED:
    'This task\'s budget is used up (summed across providers): do not retry, and do not switch providers to get around it; relay remedy to the user, who decides whether to raise the budget in the task contract.',
  TASK_BUDGET_UNVERIFIABLE:
    'The task budget has a spending limit, and this call\'s cost cannot be estimated in the same currency: do not switch providers to get around it; tell the user, who decides whether to remove the spending limit or use a model with a unit price.',
};

/** Under the external service's `auto` level, outbound transfers with no covering grant (§4.8): `auto` skips per-call confirmation, not outbound grants. */
export function grantRequiredDetails(items: readonly GrantRequestItem[]): { message: Localized; details: GrantErrorDetails } {
  const first = items[0]!;
  const ctx: GrantErrorContext = { recipient: first.recipient, label: first.recipient, dataKinds: first.dataKinds, videoId: first.videoId };
  return {
    message: RcGrants.grantRequired({ kinds: first.dataKinds.join(','), label: first.recipient }),
    details: {
      code: 'GRANT_REQUIRED',
      recipient: first.recipient,
      dataKinds: [...first.dataKinds],
      videoId: first.videoId,
      remedy: {
        action: 'create-grant',
        ...hint(RcGrants.hintServiceAuto()),
        commands: [createCommand(ctx)],
      },
    },
  };
}

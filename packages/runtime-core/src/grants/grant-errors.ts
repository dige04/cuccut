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
 * 授权与预算的错误（架构设计 §12.5、§7.8；命令与协议规范 §11.3）。`RpcError.details.code` 是确定的错误码，
 * `remedy` 说用户怎么补救；智能体、CLI 与模型接口服务都按 `code` 决定下一步。
 *
 * - `GRANT_REQUIRED`（forbidden）：没有授权覆盖这次外发；
 * - `GRANT_REVOKED`（forbidden）：覆盖它的授权已撤销、到期或被收紧；
 * - `BUDGET_EXCEEDED`（conflict）：覆盖它的授权额度（次数或金额）不够了；
 * - `BUDGET_UNVERIFIABLE`（conflict）：授权有金额上限，但这个模型估不出金额，无法保证上限。
 * - `TASK_BUDGET_EXCEEDED`（conflict）：授权够，但这个任务的预算（跨 Provider 合计的次数或金额）不够了；
 * - `TASK_BUDGET_UNVERIFIABLE`（conflict）：任务预算有金额上限，但这次调用估不出同币种的金额，或已用里有别的币种、
 *   金额未知的调用，无法保证上限。
 */

export interface GrantErrorContext {
  recipient: string;
  /** Provider 的显示名。 */
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
  /** 任务预算的错误：任务与它的预算（上限与用量）。 */
  taskId?: Id;
  taskBudget?: TaskBudgetPolicy;
  /** `hint` 是发出时的语言的文字，`hintRef` 是它的消息引用（界面按自己的语言重新生成）。 */
  remedy: { action: 'create-grant' | 'raise-budget' | 'approve-once'; hint: string; hintRef?: MessageRef; commands: string[] };
}

/** 数据种类的说法（按当前语言，多项时按语言的习惯连起来）。 */
export function kindsText(kinds: readonly GrantDataKind[]): string {
  return RcGrants.dataKinds({ kinds: kinds.join(',') }).text;
}

/** 补救说明：文字与引用一起放进 `remedy`。 */
function hint(message: Localized): { hint: string; hintRef: MessageRef } {
  return { hint: message.text, hintRef: refOf(message) };
}

/** 发放授权的命令；`--purpose` 的占位按当前语言写。`extra` 插在 `--purpose` 之前。 */
function createCommand(ctx: GrantErrorContext, extra = ''): string {
  return `cuccut grants create --recipient ${ctx.recipient} --data ${ctx.dataKinds.join(',')}${ctx.videoId ? ` --video ${ctx.videoId}` : ''}${extra} --purpose "${RcGrants.placeholderPurpose().text}"`;
}

/** 评估不通过 → 提交时的错误。 */
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

/** 任务预算不通过 → 提交时的错误（§7.8）：不创建 Job。 */
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

/** 能由用户发放一条授权解决的拒绝，与对应的 `GrantRequestItem.reason`。任务预算（`TASK_BUDGET_*`）不在其中。 */
const APPROVABLE: Readonly<Partial<Record<GrantErrorCode, GrantRequestItem['reason']>>> = {
  GRANT_REQUIRED: 'none',
  GRANT_REVOKED: 'revoked',
  BUDGET_UNVERIFIABLE: 'unverifiable',
  BUDGET_EXCEEDED: 'exhausted',
};

/** 拒绝能由用户发放授权解决时，待批准的项的 `reason`；不能（任务预算、别的错误）时 null。 */
export function approvableReason(error: unknown): GrantRequestItem['reason'] | null {
  if (!(error instanceof RpcError) || !isGrantErrorDetails(error.details)) return null;
  return APPROVABLE[error.details.code] ?? null;
}

/**
 * 工具页的当场授权（§7.9）：在场的用户收到的拒绝在 `details.pendingGrants` 带上这次要批准的全部外发
 * （`PendingGrantsDetails`），其余字段（`code`、`remedy` 的命令）照旧。不能由授权解决的拒绝原样返回。只给出待批准的项，不发放。
 */
export function withPendingGrants(error: unknown, items: readonly GrantRequestItem[]): unknown {
  if (approvableReason(error) === null || items.length === 0) return error;
  const rpc = error as RpcError;
  return new RpcError(rpc.code, rpc.message, { ...(rpc.details as GrantErrorDetails), pendingGrants: [...items] }, rpc.messageRef);
}

/**
 * 流程启动前几种外发各自的拒绝合成一个（一次拒绝说清楚要做的全部）：第一项的错误码、说明与补救方式，`remedy.commands`
 * 是全部几项的命令（去重，按出现的顺序）。
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

/** 开始执行前发现授权已撤销、到期或被收紧：任务以它失败，预留释放。 */
export function grantRevokedJobError(grant: Grant | null): JobError {
  const message = grant ? RcGrants.grantLapsedBeforeStart({ state: grant.state }) : RcGrants.grantInvalidBeforeStart();
  return {
    code: 'GRANT_REVOKED',
    message: message.text,
    messageRef: refOf(message),
    ...(grant ? { details: { grantId: grant.grantId, generation: grant.generation, state: grant.state } } : {}),
  };
}

/** 自动重试时额度不够（重试也消耗预算）。 */
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

/** 对外服务 `auto` 等级下没有授权覆盖的外发（§4.8）：`auto` 免的是逐次确认，不是外发授权。 */
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

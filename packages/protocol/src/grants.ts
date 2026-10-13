import type { Id } from './domain.ts';
import type { ModelCost, ModelPrice, ModelServiceCapability } from './models.ts';
import { live } from './i18n.ts';
import type { Localized, MessageRef } from './message-ref.ts';
import { ProtocolLabels } from './messages/protocol/protocol-labels.ts';
import { ProtocolValidation } from './messages/protocol/protocol-validation.ts';

/**
 * Grants for outbound data (Grant) and the budget ledger (architecture design §12.5, §7.8).
 *
 * - A grant binds a data kind, a recipient (Provider), a scope (all videos or one video), a purpose, a budget mode and cap, and an expiry time. It can belong to a single task only.
 *   Approving a thumbnail does not approve the original video: every kind of data a call sends out must be in the grant's `dataKinds`.
 * - Revoking or tightening (narrowing the data kinds, scope or caps, moving expiry earlier) increments `generation`: calls admitted under the old generation that are still queued are rejected when they start
 *   (`GRANT_REVOKED`). Data already sent out or already charged cannot be erased by a local revocation; `usage` records it as it happened.
 * - Budgets are measured two ways: by call count (`maxCalls`) and by amount (`budgetCap`, which can only be estimated when the model description includes a price). Each call reserves atomically at submission and
 *   is settled when it ends (§7.8).
 * - Local models (`local`) and paired LAN nodes (`node:*`) need no grant: the former sends nothing out, and the latter are the user's own devices, so pairing is the authorization.
 */

/** Kinds of data sent out. `context` is the agent conversation context (sent to the model service that runs the agent). In this version it is kept only on the model and is not wired to the Driver. */
export const GRANT_DATA_KINDS = ['transcript', 'frames', 'audio', 'video', 'document', 'context'] as const;
export type GrantDataKind = (typeof GRANT_DATA_KINDS)[number];

/** Human-readable name of a data kind, with a message reference (passed as a parameter when embedded in a Runtime sentence). */
export function grantDataKindLabel(kind: GrantDataKind): Localized {
  switch (kind) {
    case 'transcript':
      return ProtocolLabels.dataTranscript();
    case 'frames':
      return ProtocolLabels.dataFrames();
    case 'audio':
      return ProtocolLabels.dataAudio();
    case 'video':
      return ProtocolLabels.dataVideo();
    case 'document':
      return ProtocolLabels.dataDocument();
    case 'context':
      return ProtocolLabels.dataContext();
  }
}

/** Current-language text of the human-readable name of a data kind (read in the current language at read time). */
export const GRANT_DATA_KIND_LABELS: Readonly<Record<GrantDataKind, string>> = live(
  () => Object.fromEntries(GRANT_DATA_KINDS.map((kind) => [kind, grantDataKindLabel(kind).text])) as Record<GrantDataKind, string>,
);

/**
 * The data a capability's calls send out by default: transcription hands the material's audio to the Provider; speech synthesis, image generation and text generation hand over text (the text to synthesize, prompts, messages).
 * A caller that knows more specifically may supply another kind (for example, a flow that sends a script for translation uses `transcript`).
 */
export const CAPABILITY_DATA_KINDS: Readonly<Record<ModelServiceCapability, readonly GrantDataKind[]>> = {
  transcribe: ['audio'],
  synthesizeSpeech: ['document'],
  generateImage: ['document'],
  generateText: ['document'],
  // Separated on the local machine only, never sent out; audio is listed only for type completeness.
  separateAudio: ['audio'],
  // Generated on the local machine only, never sent out; documents (style and lyrics) are listed only for type completeness.
  generateMusic: ['document'],
};

/**
 * The data kinds covered by the default grant when a Provider is enabled (migration rules, §6.8): the kinds this capability's calls send out by default, plus those CucCut's own flows send through it
 * (text generation is also used to translate scripts, §7.9). Data was sent out this way before enabling, so migration neither tightens nor loosens it.
 */
export const PROVIDER_ENABLE_DATA_KINDS: Readonly<Record<ModelServiceCapability, readonly GrantDataKind[]>> = {
  transcribe: ['audio'],
  synthesizeSpeech: ['document'],
  generateImage: ['document'],
  generateText: ['document', 'transcript'],
  separateAudio: ['audio'],
  generateMusic: ['document'],
};

/**
 * Budget modes:
 * - `estimate-cap`: has an amount cap; each call's upper bound is estimated from the model description's price and reserved. If the model has no price (or the currency differs, or the pricing unit's upper bound cannot be
 *   estimated at submission), the cap cannot be guaranteed and the call is rejected with `BUDGET_UNVERIFIABLE`;
 * - `per-call-unknown-cost`: the amount is unknown, so only the number of calls is counted (`maxCalls`, which may be unlimited); no amount cap;
 * - `free-local`: computed locally, no grant needed (reserved for the description; `grants.create` does not accept it).
 */
export const GRANT_BUDGET_MODES = ['estimate-cap', 'per-call-unknown-cost', 'free-local'] as const;
export type GrantBudgetMode = (typeof GRANT_BUDGET_MODES)[number];

/** Amount: a decimal string (at most 6 decimal places) and an ISO 4217 currency. No floating-point numbers. */
export interface Money {
  amount: string;
  currency: string;
}

/** Scope: when `videoId` is null, it covers all videos (and calls that belong to no video); when a video is given, it covers only calls whose input or target is that video. */
export interface GrantScope {
  videoId: Id | null;
}

/** Where the grant comes from: issued by the user in Settings or the CLI, issued together with an approval, or issued by default when a Provider is enabled (migration rule, §6.8). */
export type GrantOrigin = 'user' | 'approval' | 'provider-enable';

/** The grant's current status (computed on read): active, expired, revoked, or exhausted (only `once` and grants with `maxCalls` can be exhausted). */
export type GrantState = 'active' | 'expired' | 'revoked' | 'exhausted';

/**
 * Usage. `calls` is the number of calls already settled and counted (including conservative deductions); `reservedCalls` is the number reserved. Amounts are in the grant's currency: `amount` is what has been counted
 * (as reported by the service, or estimated when the report is missing); `reservedAmount` is what is reserved. Both are null when there is no amount cap.
 * `unknownCostCalls` are calls that were counted but whose amount is unknown.
 */
export interface GrantUsage {
  calls: number;
  reservedCalls: number;
  amount: string | null;
  reservedAmount: string | null;
  unknownCostCalls: number;
}

export interface Grant {
  grantId: Id;
  dataKinds: GrantDataKind[];
  /** Recipient: a Provider (`openai`, `google`, `elevenlabs`, `custom:<name>`, `agent:codex`). */
  recipient: string;
  scope: GrantScope;
  /** Purpose: one sentence for people to read (the task, the use). */
  purpose: string;
  /** Text reference for `purpose` when the Runtime writes it (for example, the default grant when a Provider is enabled). The UI regenerates it in the current language; a purpose the user supplied has none. */
  purposeRef?: MessageRef;
  budgetMode: GrantBudgetMode;
  /** Amount cap (only for `estimate-cap`). */
  budgetCap: Money | null;
  /** Call-count cap; null means unlimited. A `once` grant has 1. */
  maxCalls: number | null;
  expiresAt: string | null;
  /** Grant generation: incremented on revocation or tightening; calls admitted under the old generation that have not yet started are rejected. */
  generation: number;
  /** Grant that belongs only to this task (one execution in a session); null means not limited to a task. */
  taskId: Id | null;
  /** “Just this once”: covers only the one call bound at approval time, and is not matched by other calls. */
  once: boolean;
  origin: GrantOrigin;
  /** Issued at approval time: that approval. */
  approvalId: Id | null;
  state: GrantState;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  usage: GrantUsage;
}

/** The grant and budget in a task record: which grant (and which generation) was used, what was reserved, and what it settled to. */
export interface JobGrantUse {
  grantId: Id;
  generation: number;
  /** This reservation in the ledger. */
  reservationId: Id;
  budgetMode: GrantBudgetMode;
  /** Data kinds this call sends out. */
  dataKinds: GrantDataKind[];
  /** Reserved at submission: one call, plus the estimated upper bound of the amount (when there is an amount cap). */
  reserved: { calls: number; amount: Money | null };
  /** Settlement (when the task ends); null while it is still in progress. */
  settled: JobGrantSettlement | null;
  /** Settlements of the attempts before an automatic retry: retries also consume budget (§7.8). */
  retries?: JobGrantSettlement[];
}

/**
 * Basis of settlement (§7.8):
 * - `reported`: the service reported the cost; counted as reported;
 * - `estimate`: completed, but the service reported no cost; counted at the reserved estimate (when there is an amount cap);
 * - `unknown`: completed, amount unknown (`per-call-unknown-cost`); only the count is counted;
 * - `conservative`: execution had started (data may already have been handed over, and may already have been charged), but it failed, was cancelled or was interrupted, and the service reported nothing: count one call and deduct the reserved estimate;
 * - `released`: ended before execution started (cancelled while queued, revoked before start, or stopped); the whole reservation is released and nothing is counted.
 */
export type JobGrantSettlementBasis = 'reported' | 'estimate' | 'unknown' | 'conservative' | 'released';

export interface JobGrantSettlement {
  calls: number;
  amount: Money | null;
  basis: JobGrantSettlementBasis;
  at: string;
}

/** One outbound data transfer that needs user authorization (listed in the approval, `PendingApproval.grants`). */
export interface GrantRequestItem {
  capability: ModelServiceCapability;
  dataKinds: GrantDataKind[];
  recipient: string;
  /** The video the outbound data comes from (or whose result is to be put into); null if none. */
  videoId: Id | null;
  purpose: string;
  /** Text reference for `purpose` when the Runtime writes it (tool page, flow, model tool purpose). The UI regenerates it in the current language; a purpose given by the agent has none. */
  purposeRef?: MessageRef;
  /**
   * Why authorization is needed: `none` means no grant covers it; `revoked` means the grant that covers it has been revoked or has expired; `unverifiable` means a grant with an amount cap covers it, but the model has no price,
   * so the cap cannot be guaranteed (it can only be approved this once, amount unknown); `exhausted` means the grant that covers it has used up its quota (appears only in the tool page's pending items, see `PendingGrantsDetails`).
   */
  reason: 'none' | 'revoked' | 'unverifiable' | 'exhausted';
  /** The model's cost status and this call's estimate (when there is a price). */
  cost: ModelCost;
  estimate: Money | null;
  /** Call-count cap requested in a merged approval (`grants_request`); null means unlimited. */
  maxCalls: number | null;
}

/**
 * The choice when allowing an approval that carries an outbound grant (`grant` in `approvals.respond`):
 * - `{ persist: false }` (default): this time only, amount unknown;
 * - `{ persist: true, … }`: also issues a persistent grant. The scope defaults to this call's video (`scope: 'all'` means all videos). When `budgetCap` is given it is `estimate-cap`, otherwise `per-call-unknown-cost`.
 */
export type ApprovalGrantChoice =
  | { persist: false }
  | { persist: true; scope?: 'video' | 'all'; maxCalls?: number | null; budgetCap?: Money | null; expiresAt?: string | null };

export interface GrantCreateParams {
  dataKinds: GrantDataKind[];
  recipient: string;
  /** When not given, it means all videos. */
  scope?: GrantScope;
  purpose: string;
  budgetMode: Exclude<GrantBudgetMode, 'free-local'>;
  budgetCap?: Money | null;
  maxCalls?: number | null;
  expiresAt?: string | null;
  taskId?: Id | null;
}

/**
 * On-the-spot grants on the tool page (architecture design §7.9, §12.5): when a user who is present (a connection from the desktop UI) starts a fixed flow or submits a task directly, and a grant or quota is missing or insufficient,
 * the rejection's `details` (`GRANT_REQUIRED`, `GRANT_REVOKED`, `BUDGET_EXCEEDED`, `BUDGET_UNVERIFIABLE`) carry `pendingGrants`: every outbound transfer this launch needs the user to approve (a flow's several outbound transfers appear in one rejection).
 * The client asks the user to confirm, then calls `grants.create` for each item (`grantCreateParamsFor`), and resubmits with the same `commandId`. The Runtime does not issue grants automatically and does not loosen any grant. Rejections to the CLI, agents and external services do not carry it
 * (`remedy.commands` still gives the commands to run). Task budgets (`TASK_BUDGET_*`) do not go into pending items.
 */
export interface PendingGrantsDetails {
  pendingGrants: GrantRequestItem[];
}

/**
 * The `grants.create` parameters for one pending outbound item: the scope is that item's video (all videos when there is no video), the amount is counted as unknown per call, and the call-count cap is as in the item.
 * The user can change it before issuing (for example, set an amount cap).
 */
export function grantCreateParamsFor(item: GrantRequestItem): GrantCreateParams {
  return {
    dataKinds: [...item.dataKinds],
    recipient: item.recipient,
    scope: { videoId: item.videoId },
    purpose: item.purpose,
    budgetMode: 'per-call-unknown-cost',
    maxCalls: item.maxCalls,
  };
}

/** `grants.update`: fields given replace the old values; fields not given stay the same. When tightening (narrowing, lowering, moving earlier), `generation` is incremented. */
export interface GrantUpdateParams {
  grantId: Id;
  dataKinds?: GrantDataKind[];
  scope?: GrantScope;
  purpose?: string;
  budgetCap?: Money | null;
  maxCalls?: number | null;
  expiresAt?: string | null;
}

/** Usage of a grant and the tasks that used it (those still kept in task records). */
export interface GrantUsageReport {
  grant: Grant;
  jobs: Array<{ jobId: Id; state: string; reserved: JobGrantUse['reserved']; settled: JobGrantSettlement | null }>;
}

/** Result of a revocation: new calls are forbidden after it. Parts already sent out or charged are listed as they are and cannot be erased. */
export interface GrantRevokeResult {
  grant: Grant;
  /** Calls and amounts already counted (data already handed over, and possible costs). */
  alreadySent: { calls: number; amount: Money | null; unknownCostCalls: number };
  /** Tasks executing at revocation: their data has already been handed over, so they finish as usual and are settled; queued ones are rejected when they start. */
  runningJobs: Id[];
  note: string;
  /** Message reference for `note` (message-ref.ts). */
  noteRef?: MessageRef;
}

export interface GrantsSnapshot {
  grants: Grant[];
}

export type GrantsEvent = { type: 'grant.upsert'; grant: Grant } | { type: 'grant.removed'; grantId: Id };

/** Error codes for grants and budgets (carried in `RpcError.details.code`). */
/** Error codes for grants and budgets. `TASK_BUDGET_*` belong to the task budget (§7.8) and are checked alongside the grant budget. */
export const GRANT_ERROR_CODES = [
  'GRANT_REQUIRED',
  'GRANT_REVOKED',
  'BUDGET_EXCEEDED',
  'BUDGET_UNVERIFIABLE',
  'TASK_BUDGET_EXCEEDED',
  'TASK_BUDGET_UNVERIFIABLE',
] as const;
export type GrantErrorCode = (typeof GRANT_ERROR_CODES)[number];

export function isGrantErrorCode(value: unknown): value is GrantErrorCode {
  return typeof value === 'string' && (GRANT_ERROR_CODES as readonly string[]).includes(value);
}

// ---- Amount ----

/** The smallest unit of an amount: one millionth. */
export const MONEY_SCALE = 1_000_000n;
const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function isMoneyAmount(value: string): boolean {
  return AMOUNT_PATTERN.test(value);
}

export function isCurrency(value: string): boolean {
  return CURRENCY_PATTERN.test(value);
}

/** Decimal string → integer in millionths. Throws if invalid. */
export function moneyToMicros(amount: string): bigint {
  if (!AMOUNT_PATTERN.test(amount)) throw new Error(String(ProtocolValidation.amountInvalidValue({ amount })));
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole!) * MONEY_SCALE + BigInt(fraction.padEnd(6, '0'));
}

/** Integer in millionths → decimal string (extra trailing zeros removed, at least two decimal places). */
export function microsToMoney(micros: bigint): string {
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;
  const whole = abs / MONEY_SCALE;
  let fraction = (abs % MONEY_SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  if (fraction.length < 2) fraction = fraction.padEnd(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Estimates the upper bound of one call's amount from the model description's price. Estimates only for pricing units whose upper bound can be fixed at submission: per request (`request`), per image (`image`, multiplied by the image count),
 * and per thousand characters (`1k-chars`, rounded up by the code point count of the synthesized text). Null when there is no price, or the unit does not apply (for example transcription by minute, or text by token).
 */
export function estimateCallCost(price: ModelPrice | undefined, input: { count?: number; chars?: number }): Money | null {
  if (!price || !isMoneyAmount(price.amount) || !isCurrency(price.currency)) return null;
  const unit = moneyToMicros(price.amount);
  switch (price.unit) {
    case 'request':
      return { amount: microsToMoney(unit), currency: price.currency };
    case 'image':
      return input.count === undefined ? null : { amount: microsToMoney(unit * BigInt(input.count)), currency: price.currency };
    case '1k-chars':
      return input.chars === undefined
        ? null
        : { amount: microsToMoney(unit * BigInt(Math.ceil(input.chars / 1000))), currency: price.currency };
  }
}

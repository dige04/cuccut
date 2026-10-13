import {
  GRANT_DATA_KIND_LABELS,
  GRANT_DATA_KINDS,
  isCurrency,
  isMoneyAmount,
  live,
  localizeText,
  type ApprovalGrantChoice,
  type Grant,
  type GrantCreateParams,
  type GrantDataKind,
  type GrantRevokeResult,
  type GrantUpdateParams,
  type GrantUsageReport,
  type Money,
  type PendingApproval,
} from '@cuccut/protocol';
import { M } from './grants-copy.ts';

/**
 * Arguments and output of `cuccut grants`, and the grant choice of `cuccut approvals allow --persist` (Architecture design §12.5, §7.8).
 * Split out of main.ts so it can be tested on its own.
 */

/** Command-line options related to grants (the ones among main.ts's global options). */
export interface GrantOptions {
  recipient?: string | undefined;
  data?: string | undefined;
  video?: string | undefined;
  purpose?: string | undefined;
  maxCalls?: string | undefined;
  budget?: string | undefined;
  currency?: string | undefined;
  expires?: string | undefined;
  scope?: string | undefined;
  persist?: boolean | undefined;
  includeEnded?: boolean | undefined;
}

export type GrantsCommand =
  | { kind: 'list'; params: { recipient?: string; videoId?: string; includeEnded?: boolean } }
  | { kind: 'create'; params: GrantCreateParams }
  | { kind: 'update'; params: GrantUpdateParams }
  | { kind: 'revoke'; grantId: string }
  | { kind: 'usage'; grantId: string };

export function parseGrantsArgs(args: string[], options: GrantOptions): GrantsCommand {
  const [action, id, ...extra] = args;
  if (extra.length > 0) throw new Error(M.usage);
  switch (action) {
    case undefined:
    case 'list':
      if (id !== undefined) throw new Error(M.usage);
      return {
        kind: 'list',
        params: {
          ...(options.recipient ? { recipient: options.recipient } : {}),
          ...(options.video ? { videoId: options.video } : {}),
          ...(options.includeEnded ? { includeEnded: true } : {}),
        },
      };
    case 'create': {
      if (id !== undefined) throw new Error(M.usage);
      if (!options.recipient) throw new Error(M.missingRecipient);
      if (!options.data) throw new Error(M.missingData(GRANT_DATA_KINDS));
      if (!options.purpose) throw new Error(M.missingPurpose);
      const budgetCap = parseBudget(options.budget, options.currency);
      const maxCalls = parseMaxCalls(options.maxCalls);
      const expiresAt = parseExpires(options.expires);
      return {
        kind: 'create',
        params: {
          recipient: options.recipient,
          dataKinds: parseDataKinds(options.data),
          purpose: options.purpose,
          scope: { videoId: options.video && options.video !== 'all' ? options.video : null },
          budgetMode: budgetCap ? 'estimate-cap' : 'per-call-unknown-cost',
          ...(budgetCap ? { budgetCap } : {}),
          ...(maxCalls !== undefined ? { maxCalls } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        },
      };
    }
    case 'update': {
      if (!id) throw new Error(M.usage);
      if (options.recipient) throw new Error(M.recipientFixed);
      const params: GrantUpdateParams = { grantId: id };
      if (options.data) params.dataKinds = parseDataKinds(options.data);
      if (options.video) params.scope = { videoId: options.video === 'all' ? null : options.video };
      if (options.purpose) params.purpose = options.purpose;
      const maxCalls = parseMaxCalls(options.maxCalls);
      if (maxCalls !== undefined) params.maxCalls = maxCalls;
      if (options.budget !== undefined)
        params.budgetCap = options.budget === 'none' ? null : parseBudget(options.budget, options.currency)!;
      const expiresAt = parseExpires(options.expires);
      if (expiresAt !== undefined) params.expiresAt = expiresAt;
      if (Object.keys(params).length === 1)
        throw new Error(M.nothingToUpdate);
      return { kind: 'update', params };
    }
    case 'revoke':
    case 'usage':
      if (!id) throw new Error(M.usage);
      return { kind: action, grantId: id };
    default:
      throw new Error(M.usage);
  }
}

/**
 * The grant choice for `cuccut approvals allow <id>`. Without `--persist`, none is attached (this time only). When given, an ongoing grant is issued as well,
 * and `--scope video|all`, `--max-calls`, `--budget` + `--currency`, and `--expires` are its scope and limits.
 */
export function parseApprovalGrantChoice(options: GrantOptions): ApprovalGrantChoice | undefined {
  const extras = [options.scope, options.maxCalls, options.budget, options.currency, options.expires].some((v) => v !== undefined);
  if (!options.persist) {
    if (extras) throw new Error(M.persistOnly);
    return undefined;
  }
  if (options.scope !== undefined && options.scope !== 'video' && options.scope !== 'all') throw new Error(M.scopeChoices);
  const budgetCap = parseBudget(options.budget, options.currency);
  const maxCalls = parseMaxCalls(options.maxCalls);
  const expiresAt = parseExpires(options.expires);
  return {
    persist: true,
    ...(options.scope ? { scope: options.scope as 'video' | 'all' } : {}),
    ...(maxCalls !== undefined ? { maxCalls } : {}),
    ...(budgetCap ? { budgetCap } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
}

function parseDataKinds(value: string): GrantDataKind[] {
  const kinds = value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const unknown = kinds.filter((k) => !(GRANT_DATA_KINDS as readonly string[]).includes(k));
  if (kinds.length === 0 || unknown.length > 0) {
    throw new Error(M.unknownKinds(unknown.join(M.listSep) || value, GRANT_DATA_KINDS));
  }
  return [...new Set(kinds)] as GrantDataKind[];
}

/** `--max-calls <n|none>`: none means unlimited. */
function parseMaxCalls(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === 'none') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) throw new Error(M.maxCallsRange);
  return n;
}

/** `--budget <amount>` + `--currency <currency>`: a decimal string, not a floating-point number. */
function parseBudget(budget: string | undefined, currency: string | undefined): Money | undefined {
  if (budget === undefined) {
    if (currency !== undefined) throw new Error(M.currencyNeedsBudget);
    return undefined;
  }
  if (!isMoneyAmount(budget)) throw new Error(M.budgetFormat);
  const code = (currency ?? '').toUpperCase();
  if (!isCurrency(code)) throw new Error(M.budgetNeedsCurrency);
  return { amount: budget, currency: code };
}

/** `--expires <ISO time|none>`. */
function parseExpires(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === 'none') return null;
  const t = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(t))
    throw new Error(M.expiresFormat);
  return new Date(t).toISOString();
}

const STATE_LABELS: Readonly<Record<Grant['state'], string>> = live(() => M.stateLabels);
const ORIGIN_LABELS: Readonly<Record<Grant['origin'], string>> = live(() => M.originLabels);

export function kindsLabel(kinds: readonly GrantDataKind[]): string {
  return kinds.map((k) => GRANT_DATA_KIND_LABELS[k]).join(M.listSep);
}

function money(value: Money | null): string {
  return value ? `${value.amount} ${value.currency}` : '—';
}

/** Usage of one grant: count (including reservations) and amount (when there is a limit). */
export function usageLabel(grant: Grant): string {
  const { usage } = grant;
  const calls = M.calls(usage.calls, usage.reservedCalls, grant.maxCalls);
  if (!grant.budgetCap) return `${calls}${usage.unknownCostCalls ? M.unknownCostCalls(usage.unknownCostCalls) : ''}`;
  const reserved = usage.reservedAmount && usage.reservedAmount !== '0' ? usage.reservedAmount : null;
  return M.callsAndAmount(calls, usage.amount ?? '0', reserved, grant.budgetCap.amount, grant.budgetCap.currency);
}

/** Grants, one per line: id, status, recipient, data, scope, budget and usage, source. */
export function formatGrants(grants: Grant[]): string[] {
  if (grants.length === 0) return [M.noGrants];
  return grants.map((g) =>
    M.grantLine({
      id: g.grantId,
      state: STATE_LABELS[g.state],
      recipient: g.recipient,
      kinds: kindsLabel(g.dataKinds),
      scope: g.scope.videoId ? M.scopeVideo(g.scope.videoId) : M.scopeAll,
      taskId: g.taskId || null,
      once: Boolean(g.once),
      usage: usageLabel(g),
      expiresAt: g.expiresAt || null,
      origin: ORIGIN_LABELS[g.origin],
      purpose: localizeText(g.purpose, g.purposeRef),
    }),
  );
}

/** Result of revoking: after revocation, no new calls are made. Data already handed over and costs already counted are listed as they are. */
export function formatRevoke(result: GrantRevokeResult): string[] {
  const { alreadySent } = result;
  return [
    M.revoked(result.grant.grantId, result.grant.recipient, kindsLabel(result.grant.dataKinds)),
    M.alreadySent(alreadySent.calls, alreadySent.amount ? money(alreadySent.amount) : null, alreadySent.unknownCostCalls),
    ...(result.runningJobs.length > 0 ? [M.runningJobs(result.runningJobs)] : []),
    localizeText(result.note, result.noteRef),
  ];
}

/** Usage report: the grant itself, plus the tasks that used it (reservations and settlements). */
export function formatUsage(report: GrantUsageReport): string[] {
  const lines = formatGrants([report.grant]);
  if (report.jobs.length === 0) return [...lines, M.noJobs];
  for (const job of report.jobs) {
    const settled = job.settled ? M.settled(job.settled.calls, money(job.settled.amount), job.settled.basis) : M.unsettled;
    lines.push(M.jobLine(job.jobId, job.state, job.reserved.calls, money(job.reserved.amount), settled));
  }
  return lines;
}

/** Data-egress grant in an approval (the extra line on each approval in the `cuccut approvals` list). */
export function formatApprovalGrants(approval: PendingApproval): string[] {
  return (approval.grants ?? []).map((item) =>
    M.approvalGrant({
      recipient: item.recipient,
      kinds: kindsLabel(item.dataKinds),
      videoId: item.videoId || null,
      purpose: localizeText(item.purpose, item.purposeRef),
      estimate: item.estimate ? money(item.estimate) : null,
      maxCalls: item.maxCalls,
      reason: item.reason === 'revoked' || item.reason === 'unverifiable' ? item.reason : null,
    }),
  );
}

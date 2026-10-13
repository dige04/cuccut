import { defineMessages, GRANT_DATA_KIND_LABELS, live, type Grant, type GrantRevokeResult, type GrantState, type Money } from '@cuccut/protocol';
import { zhHans } from './data-grants.zh-Hans.ts';
import { zhHant } from './data-grants.zh-Hant.ts';
import { ja } from './data-grants.ja.ts';
import { ko } from './data-grants.ko.ts';
import { es } from './data-grants.es.ts';
import { fr } from './data-grants.fr.ts';
import { de } from './data-grants.de.ts';
import { nl } from './data-grants.nl.ts';
import { ptBR } from './data-grants.pt-BR.ts';
import { it } from './data-grants.it.ts';
import { ru } from './data-grants.ru.ts';
import { pl } from './data-grants.pl.ts';
import { tr } from './data-grants.tr.ts';
import { vi } from './data-grants.vi.ts';

const times = (n: number) => (n === 1 ? '1 call' : `${n} calls`);

/** Copy for data export grants (the English is the source of keys and types; the translations live in `data-grants.zh-Hans.ts`). */
const en = {
  state: { active: 'Active', expired: 'Expired', revoked: 'Revoked', exhausted: 'Limit reached' } as Record<GrantState, string>,
  kindList: (kinds: readonly string[]) => kinds.join(', '),
  noKinds: 'No data types',
  origin: {
    'provider-enable': 'Granted by default when the provider was turned on',
    approval: 'Granted on approval',
    user: 'Granted manually',
  } as Record<Grant['origin'], string>,
  oneVideoNamed: (name: string) => `Only the video “${name}”`,
  oneVideo: 'Only one video',
  allVideos: 'All videos',
  oneTask: 'Only one task',
  budgetCap: (amount: string) => `Spending limit ${amount}`,
  budgetUnknown: 'Cost unknown, counted by calls only',
  once: 'This time only',
  unlimited: 'Unlimited calls',
  maxCalls: (n: number) => `Up to ${times(n)}`,
  revokedOn: (day: string) => `Revoked ${day}`,
  expiredOn: (day: string) => `Expired ${day}`,
  expiresOn: (day: string) => `Expires ${day}`,
  neverUsed: 'Not used yet',
  usedWithAmount: (calls: number, amount: string) => `Used ${times(calls)} (${amount})`,
  used: (calls: number) => `Used ${times(calls)}`,
  reservedWithAmount: (calls: number, amount: string) => `${times(calls)} in progress (${amount} reserved)`,
  reserved: (calls: number) => `${times(calls)} in progress`,
  unknownCost: (calls: number) => `${times(calls)} with unknown cost`,
  usageSeparator: ', ',
  revokeConfirm: (running: number, sent: number) =>
    [
      'After you revoke it, new calls and queued calls that use this grant will be refused.',
      running ? `The ${times(running)} already running will finish normally.` : '',
      sent ? `Data already sent in ${times(sent)}, and any costs incurred, can’t be taken back.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  revoked: 'Revoked',
  sentBefore: (calls: number, amount: string | null, unknownCostCalls: number) =>
    `Previously sent ${times(calls)}${amount ? ` (${amount}${unknownCostCalls ? `, plus ${times(unknownCostCalls)} with unknown cost` : ''})` : ''}`,
  runningJobs: (n: number) => (n === 1 ? '1 running task will finish normally' : `${n} running tasks will finish normally`),
};
export type DataGrantsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The “数据外发授权” (data export grants) in Settings → Privacy (architecture design §12.5): reads each grant in the `grants` topic and states who it went to, which data, what scope,
 * the budget and usage; after revocation, the data and costs already handed over are stated as they are and cannot be erased. The design draft has no such section, so the styling follows the settings page's groups and rows.
 */

const STATE_LABEL: Record<GrantState, string> = live(() => M.state);

export function grantStateLabel(state: GrantState): string {
  return STATE_LABEL[state];
}

/** Active ones first; within the same group, newly issued ones first. When `includeEnded` is false, only active ones are listed. */
export function listedGrants(grants: readonly Grant[], includeEnded: boolean): Grant[] {
  return grants
    .filter((g) => includeEnded || g.state === 'active')
    .sort((a, b) => Number(b.state === 'active') - Number(a.state === 'active') || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Number of ended grants (expired, revoked, used up): the count next to “显示已结束的” (show ended). */
export function endedCount(grants: readonly Grant[]): number {
  return grants.filter((g) => g.state !== 'active').length;
}

/** Recipient's name: the provider's name in the model view; when absent, `custom:name` uses the name, `agent:codex` is written as Codex, and anything else is written as its ID. */
export function recipientName(recipient: string, labels: ReadonlyMap<string, string>): string {
  const known = labels.get(recipient);
  if (known) return known;
  if (recipient.startsWith('custom:')) return recipient.slice('custom:'.length) || recipient;
  if (recipient.startsWith('agent:')) {
    const name = recipient.slice('agent:'.length);
    return name ? name[0]!.toUpperCase() + name.slice(1) : recipient;
  }
  return recipient;
}

/** "OpenAI · Transcripts and translations, text and prompts". */
export function grantTitle(grant: Pick<Grant, 'recipient' | 'dataKinds'>, labels: ReadonlyMap<string, string>): string {
  const kinds = M.kindList(grant.dataKinds.map((k) => GRANT_DATA_KIND_LABELS[k]));
  return `${recipientName(grant.recipient, labels)} · ${kinds || M.noKinds}`;
}

const money = (m: Money) => `${m.amount} ${m.currency}`;

const ORIGIN_LABEL: Record<Grant['origin'], string> = live(() => M.origin);

/** Dates are written to the day (local time zone): “2026-10-05”. */
function day(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Description line: scope, budget, count, usage, source and expiry, joined in that order with “·”.
 * `videoName` is the name of the video in the scope (null when it cannot be found in Space; then “一个视频” (a video) is written).
 */
export function grantFacts(grant: Grant, videoName: string | null): string {
  const facts: string[] = [];
  facts.push(grant.scope.videoId ? (videoName ? M.oneVideoNamed(videoName) : M.oneVideo) : M.allVideos);
  if (grant.taskId) facts.push(M.oneTask);
  if (grant.budgetMode === 'estimate-cap' && grant.budgetCap) facts.push(M.budgetCap(money(grant.budgetCap)));
  else facts.push(M.budgetUnknown);
  facts.push(grant.once ? M.once : grant.maxCalls === null ? M.unlimited : M.maxCalls(grant.maxCalls));
  facts.push(usageLine(grant));
  facts.push(ORIGIN_LABEL[grant.origin]);
  if (grant.state === 'revoked' && grant.revokedAt) facts.push(M.revokedOn(day(grant.revokedAt)));
  else if (grant.expiresAt) facts.push(grant.state === 'expired' ? M.expiredOn(day(grant.expiresAt)) : M.expiresOn(day(grant.expiresAt)));
  return facts.join(' · ');
}

/** Usage: “已用 3 次（0.42 USD）” (used 3 times, 0.42 USD) or “还没用过” (not used yet); reserved amounts and amounts of unknown value are written the same way. */
export function usageLine(grant: Pick<Grant, 'usage' | 'budgetCap'>): string {
  const u = grant.usage;
  const currency = grant.budgetCap?.currency ?? '';
  const parts: string[] = [];
  if (!u.calls && !u.reservedCalls) return M.neverUsed;
  if (u.calls) parts.push(u.amount !== null && currency ? M.usedWithAmount(u.calls, `${u.amount} ${currency}`) : M.used(u.calls));
  if (u.reservedCalls)
    parts.push(u.reservedAmount !== null && currency ? M.reservedWithAmount(u.reservedCalls, `${u.reservedAmount} ${currency}`) : M.reserved(u.reservedCalls));
  if (u.unknownCostCalls) parts.push(M.unknownCost(u.unknownCostCalls));
  return parts.join(M.usageSeparator);
}

/** Confirmation before revoking: what revoking can stop and what it cannot. */
export function revokeConfirmText(grant: Pick<Grant, 'usage'>): string {
  return M.revokeConfirm(grant.usage.reservedCalls, grant.usage.calls);
}

/** A line shown after revoking: the part already handed over and the tasks still running, as reported by the Runtime. */
export function revokeResultLine(result: GrantRevokeResult): string {
  const { calls, amount, unknownCostCalls } = result.alreadySent;
  const parts = [M.revoked];
  if (calls) parts.push(M.sentBefore(calls, amount ? money(amount) : null, unknownCostCalls));
  if (result.runningJobs.length) parts.push(M.runningJobs(result.runningJobs.length));
  return parts.join(' · ');
}

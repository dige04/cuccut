import {
  composeCaption,
  FORMAT_NETWORK,
  formatRef,
  intendedTime,
  localizeText,
  PUBLISHING_FORMATS,
  resolveCopy,
  type Id,
  type Publication,
  type PublicationCopy,
  type PublicationDestination,
  type PublicationDetail,
  type PublicationIssue,
  type PublishingAccount,
  type PublishingFormat,
  type PublishingNetwork,
  type PublishingReconcileParams,
  type ReconcileState,
} from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { publicationLocked, type PublicationDraft } from './publication-form.ts';

/**
 * What the publication dialog's sections show and allow (design `docs/cuccut/m2-publishing.md` §2.4): the video column's export controls, the time
 * card, the text proposal, and the Delivery tab's posting kit and "Record a result checked in the app". Pure, so every rule that disables a control
 * also names the reason (a disabled control says why).
 */

/** Where each network's own upload page is (the by-hand posting kit opens it). Data, not copy. */
export const UPLOAD_URLS: Readonly<Record<PublishingNetwork, string>> = {
  youtube: 'https://www.youtube.com/upload',
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/upload',
};

/** Formats a destination on this network can use. */
export function formatsOf(network: PublishingNetwork): PublishingFormat[] {
  return PUBLISHING_FORMATS.filter((format) => FORMAT_NETWORK[format] === network);
}

/** An instant as the reader reads it, in `timezone` (falls back to UTC when the zone is not valid). */
export function formatInstant(at: string, timezone: string, locale?: string): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(new Date(at));
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(at));
  }
}

/** A validation issue in the reader's language. */
export function issueText(issue: PublicationIssue): string {
  return formatRef(issue.message, issue.code);
}

/** The pinned export file under the Runtime home (`publishing/exports/<sha256>.mp4`), for Reveal export. */
export function pinnedExportPath(home: string, sha256: string): string {
  const sep = home.includes('\\') && !home.includes('/') ? '\\' : '/';
  const root = home.endsWith(sep) ? home.slice(0, -1) : home;
  return [root, 'publishing', 'exports', `${sha256}.mp4`].join(sep);
}

// ---- Video column ----

export interface ExportControls {
  /** "Render and pin export", or "Render and replace export" once one is pinned. */
  renderLabel: string;
  /** Why "Render and pin" and "Pin a finished export" are unavailable, or null. */
  pinBlock: string | null;
  /** A render-and-pin export is running. */
  rendering: boolean;
  /** Why the last render-and-pin did not pin anything. */
  renderError: string | null;
  /** "Approve export" is offered (an export is pinned and not approved yet). */
  approveVisible: boolean;
  approveBlock: string | null;
}

export interface ControlContext {
  busy: boolean;
  dirty: boolean;
  /** Publishing is read-only (the store could not be read or is from a newer version). */
  readOnly: boolean;
}

function commonBlock(ctx: ControlContext): string | null {
  if (ctx.busy) return PC.form.busy;
  if (ctx.readOnly) return PC.form.readOnly;
  if (ctx.dirty) return PC.form.needsSave;
  return null;
}

export function exportControls(p: PublicationDetail, ctx: ControlContext): ExportControls {
  const rendering = !!p.pinJob && !p.pinJob.error;
  const locked = publicationLocked(p);
  const pinBlock =
    (ctx.busy ? PC.form.busy : null) ??
    (ctx.readOnly ? PC.form.readOnly : null) ??
    (!p.videoAvailable ? PC.form.videoUnavailable : null) ??
    (locked ? PC.form.locked : null) ??
    (ctx.dirty ? PC.form.needsSave : null) ??
    (rendering ? PC.form.rendering : null);
  return {
    renderLabel: p.exportId ? PC.form.renderReplace : PC.form.renderPin,
    pinBlock,
    rendering,
    renderError: p.pinJob?.error ? localizeText(p.pinJob.error, p.pinJob.errorRef) : null,
    approveVisible: !!p.exportId && !p.approved,
    approveBlock: !p.exportId ? PC.form.approveNeedsExport : (commonBlock(ctx) ?? (locked ? PC.form.locked : null)),
  };
}

// ---- Text ----

/** The proposal was written for an older version than the saved one (storing it is one change, so the version right after it is still current). */
export function proposalStale(p: Pick<Publication, 'proposal' | 'revision'>): boolean {
  return !!p.proposal && p.revision > p.proposal.revision + 1;
}

export type ProposalPart = 'title' | 'description' | 'hashtags' | 'all';

/** The shared text after using one part of the proposal (or all of it). */
export function withProposal(copy: PublicationCopy, proposal: PublicationCopy, part: ProposalPart): PublicationCopy {
  if (part === 'all') return { ...proposal, hashtags: [...proposal.hashtags] };
  return part === 'hashtags' ? { ...copy, hashtags: [...proposal.hashtags] } : { ...copy, [part]: proposal[part] };
}

/** Why "Propose text" (and using a proposal) is unavailable, or null. */
export function proposeBlock(ctx: ControlContext & { locked: boolean }): string | null {
  return commonBlock(ctx) ?? (ctx.locked ? PC.form.locked : null);
}

// ---- Time card ----

export interface AccountTime {
  accountId: Id;
  name: string;
  /** The destination's own time, or null when it uses the default time. */
  own: string | null;
}

/** "Account times": each destination's own time (shown only when at least one destination has one). */
export function accountTimes(draft: PublicationDraft, accounts: readonly PublishingAccount[]): AccountTime[] {
  if (!draft.destinations.some((d) => d.scheduledAt)) return [];
  return draft.destinations.map((d) => ({
    accountId: d.accountId,
    name: accounts.find((a) => a.id === d.accountId)?.name ?? d.accountId,
    own: d.scheduledAt,
  }));
}

/** Why "Reserve next free slot" is unavailable, or null. */
export function reserveBlock(ctx: ControlContext & { locked: boolean; slots: number }): string | null {
  return commonBlock(ctx) ?? (ctx.locked ? PC.form.locked : null) ?? (ctx.slots === 0 ? PC.form.reserveNeedsSlots : null);
}

// ---- Delivery ----

/** A by-hand destination waiting for the owner can be taken back to unsent. */
export function canWithdraw(d: Pick<PublicationDestination, 'state'>, byHand: boolean): boolean {
  return byHand && d.state === 'queued';
}

/** A destination whose real outcome the owner can record (it was handed over and is not settled as published or cancelled). */
export function recordable(d: Pick<PublicationDestination, 'state'>): boolean {
  return d.state !== 'not_sent' && d.state !== 'published' && d.state !== 'cancelled';
}

/** What the owner pastes in the network's app: the frozen payload's text, or the text the destination would send. */
export function handoverText(p: Pick<Publication, 'copy'>, d: PublicationDestination): { title: string; caption: string } {
  if (d.payload) return { title: d.payload.title, caption: d.payload.caption };
  const copy = resolveCopy(p.copy, d);
  return { title: copy.title, caption: composeCaption(copy) };
}

/** The time a destination goes out (confirmed by the app, its own, or the default). */
export function destinationTime(p: Pick<Publication, 'scheduledAt'>, d: PublicationDestination): string | null {
  return d.confirmedAt ?? intendedTime(p, d);
}

export interface RecordDraft {
  state: ReconcileState;
  at: string | null;
  url: string;
  note: string;
}

export const EMPTY_RECORD: RecordDraft = { state: 'published', at: null, url: '', note: '' };

/** The shortest "What you verified" note the Runtime accepts. */
export const RECORD_NOTE_MIN = 10;

function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Why "Record verified result" is unavailable, or null. */
export function recordBlock(draft: RecordDraft, ctx: { owner: boolean; busy: boolean; readOnly: boolean; dirty?: boolean }): string | null {
  if (!ctx.owner) return PC.settings.ownerOnly;
  if (ctx.busy) return PC.form.busy;
  if (ctx.readOnly) return PC.form.readOnly;
  if (ctx.dirty) return PC.form.needsSave;
  if (draft.state === 'scheduled' && !draft.at) return PC.handover.needsTime;
  if (draft.url.trim() && !isWebLink(draft.url.trim())) return PC.handover.badLink;
  if (draft.note.trim().length < RECORD_NOTE_MIN) return PC.handover.verifiedHint;
  return null;
}

export function recordParams(p: Pick<Publication, 'id' | 'revision'>, destinationId: Id, draft: RecordDraft): PublishingReconcileParams {
  return {
    publicationId: p.id,
    revision: p.revision,
    destinationId,
    state: draft.state,
    remoteUrl: draft.url.trim() || null,
    at: draft.at,
    note: draft.note.trim(),
  };
}

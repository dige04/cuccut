import { create } from 'zustand';
import {
  calendarInstant,
  RpcError,
  type CalendarArchive,
  type CalendarImportPreview,
  type CalendarPlacement,
  type DestinationInput,
  type Id,
  type MediaHandle,
  type PinnableExport,
  type Publication,
  type PublicationCopy,
  type PublicationDetail,
  type PublicationIssue,
  type PublicationPatch,
  type PublicationRow,
  type PublishingAccount,
  type PublishingBatchItemResult,
  type PublishingCalendarParams,
  type PublishingCalendarResult,
  type PublishingCleanupResult,
  type PublishingConnection,
  type PublishingNetwork,
  type PublishingPinSource,
  type PublishingPrepareParams,
  type PublishingProvider,
  type PublishingReconcileParams,
  type PublishingSettings,
  type PublishingSlotsParams,
  type PublishingSlotsResult,
} from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { usePublishing } from '../state/publishing-store.ts';
import type { RuntimeSession } from './session.ts';

/**
 * Publishing commands (`publishing.*`, design `docs/cuccut/m2-publishing.md` §4.3, §6.1): thin wrappers over the Runtime methods, shared by the
 * calendar, the publication dialog, the batch dialog and Settings → Publishing. The agent tools call the same service, so the human UI and the agents
 * keep parity.
 *
 * - Every write returns the saved publication, so the caller keeps its revision; the calendar mirror is updated from it at once (the topic event that
 *   follows carries the same revision and changes nothing).
 * - Single flight per publication: a second identical call while one runs gets the running promise; a different write on the same publication is
 *   refused with `PUBLICATION_BUSY` (it would carry a stale revision).
 * - Failures surface as {@link PublishingCommandError}: the Runtime's message in the reader's language, its `details.code`, the saved publication
 *   on a revision conflict (`current`) and validation issues (`issues`).
 */

type Session = Pick<RuntimeSession, 'client'>;

export class PublishingCommandError extends Error {
  /** `details.code` of the Runtime error (`PUBLICATION_CONFLICT`, `PUBLICATION_INVALID`, …), else the RPC error code. */
  readonly code: string;
  /** The saved publication when the write named a stale revision (`PUBLICATION_CONFLICT`). */
  readonly current: Publication | null;
  readonly issues: PublicationIssue[];
  readonly details: unknown;

  constructor(code: string, message: string, extra: { current?: Publication | null; issues?: PublicationIssue[]; details?: unknown } = {}) {
    super(message);
    this.name = 'PublishingCommandError';
    this.code = code;
    this.current = extra.current ?? null;
    this.issues = extra.issues ?? [];
    this.details = extra.details;
  }

  get conflict(): boolean {
    return this.code === 'PUBLICATION_CONFLICT';
  }
}

/** Turns a Runtime failure into a {@link PublishingCommandError}; anything else keeps its message. */
export function publishingError(error: unknown): PublishingCommandError {
  if (error instanceof PublishingCommandError) return error;
  if (error instanceof RpcError) {
    const details = (error.details ?? {}) as { code?: unknown; current?: unknown; issues?: unknown };
    return new PublishingCommandError(typeof details.code === 'string' ? details.code : error.code, error.message, {
      current: details.current && typeof details.current === 'object' ? (details.current as Publication) : null,
      issues: Array.isArray(details.issues) ? (details.issues as PublicationIssue[]) : [],
      details: error.details,
    });
  }
  return new PublishingCommandError('UNKNOWN', error instanceof Error ? error.message : String(error));
}

/** Publications with a write in progress (`publicationId` → method), so controls can say why they wait. */
export const usePublishingBusy = create<{ busy: Record<Id, string> }>()(() => ({ busy: {} }));

const running = new Map<string, { method: string; key: string; promise: Promise<unknown> }>();

function setBusy(id: Id, method: string | null): void {
  usePublishingBusy.setState((s) => {
    const busy = { ...s.busy };
    if (method) busy[id] = method;
    else delete busy[id];
    return { busy };
  });
}

/** Runs one write per publication at a time (see the module comment). `key` tells identical calls apart from different ones. */
function single<T>(id: Id, method: string, key: string, run: () => Promise<T>): Promise<T> {
  const current = running.get(id);
  if (current) {
    if (current.method === method && current.key === key) return current.promise as Promise<T>;
    return Promise.reject(new PublishingCommandError('PUBLICATION_BUSY', PC.form.busy));
  }
  const promise = (async () => {
    try {
      return await run();
    } catch (error) {
      throw publishingError(error);
    } finally {
      running.delete(id);
      setBusy(id, null);
    }
  })();
  running.set(id, { method, key, promise });
  setBusy(id, method);
  return promise;
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw publishingError(error);
  }
}

/** The calendar row of a saved publication (as the Runtime's `row()` builds it). */
export function rowOf(p: PublicationDetail): PublicationRow {
  return {
    id: p.id,
    videoId: p.videoId,
    projectId: p.projectId,
    label: p.label,
    status: p.status,
    archived: p.archived,
    revision: p.revision,
    scheduledAt: p.scheduledAt,
    timezone: p.timezone,
    priority: p.priority,
    expiresAt: p.expiresAt,
    destinations: p.destinations.map((d) => ({
      id: d.id,
      accountId: d.accountId,
      format: d.format,
      state: d.state,
      scheduledAt: d.scheduledAt,
      at: calendarInstant(p, d),
    })),
  };
}

/** Writes a saved publication into the calendar mirror (stale revisions are ignored by the store). */
function mirror(p: PublicationDetail): PublicationDetail {
  const store = usePublishing.getState();
  if (store.ready) store.apply({ type: 'publication.upserted', row: rowOf(p) });
  return p;
}

const keyOf = (value: unknown) => JSON.stringify(value);

// ---- Reads ----

export function getPublication(session: Session, publicationId: Id): Promise<PublicationDetail> {
  return call(() => session.client.request('publishing.get', { publicationId }));
}

export function publishingCalendar(session: Session, params: PublishingCalendarParams): Promise<PublishingCalendarResult> {
  return call(() => session.client.request('publishing.calendar', params));
}

export function publicationReadiness(session: Session, publicationId: Id): Promise<PublicationIssue[]> {
  return call(async () => (await session.client.request('publishing.validate', { publicationId })).issues);
}

/** Finished MP4 exports of a video that can be pinned, newest first. */
export function pinnableExports(session: Session, videoId: Id): Promise<PinnableExport[]> {
  return call(async () => (await session.client.request('publishing.exports', { videoId })).exports);
}

/** A short-lived read handle of the pinned export (player, Reveal export). */
export function openPinnedExport(session: Session, publicationId: Id): Promise<MediaHandle> {
  return call(() => session.client.request('publishing.openHandle', { publicationId }));
}

// ---- Publications ----

/** Prepares one publication per video, or returns each video's latest one that is not archived (unless `repeat`). */
export function preparePublications(session: Session, params: PublishingPrepareParams): Promise<PublicationDetail[]> {
  const key = keyOf(params);
  return single(`prepare:${[...params.videoIds].sort().join(',')}`, 'prepare', key, async () => {
    const { publications } = await session.client.request('publishing.prepare', params);
    return publications.map(mirror);
  });
}

export function updatePublication(
  session: Session,
  publicationId: Id,
  revision: number,
  patch: PublicationPatch,
  destinations?: DestinationInput[],
): Promise<PublicationDetail> {
  const params = { publicationId, revision, patch, ...(destinations ? { destinations } : {}) };
  return single(publicationId, 'update', keyOf(params), async () => mirror(await session.client.request('publishing.update', params)));
}

/** Moves destinations on the calendar (atomic). `at: null` falls back to the default time. */
export function reschedulePublication(session: Session, publicationId: Id, revision: number, placements: CalendarPlacement[]): Promise<PublicationDetail> {
  const params = { publicationId, revision, placements };
  return single(publicationId, 'reschedule', keyOf(params), async () => mirror(await session.client.request('publishing.reschedule', params)));
}

/** Plans free weekly slots; with `reserve` writes them (each publication's default time). */
export function publishingSlots(session: Session, params: PublishingSlotsParams): Promise<PublishingSlotsResult> {
  const run = async () => {
    const result = await session.client.request('publishing.slots', params);
    result.publications.forEach(mirror);
    return result;
  };
  if (!params.reserve) return call(run);
  return single(`slots:${[...params.publicationIds].sort().join(',')}`, 'slots', keyOf(params), run);
}

/** Pins a finished export (`{ jobId }`) or renders one and pins it when it finishes (`{ render: true }`, returns the export's `jobId`). */
export function pinExport(
  session: Session,
  publicationId: Id,
  revision: number,
  source: PublishingPinSource,
): Promise<{ publication: PublicationDetail; jobId?: Id }> {
  const params = { publicationId, revision, source };
  return single(publicationId, 'pin', keyOf(params), async () => {
    const result = await session.client.request('publishing.pin', params);
    mirror(result.publication);
    return result;
  });
}

function revisionCall(
  method: 'publishing.approve' | 'publishing.authorize' | 'publishing.archive' | 'publishing.unarchive',
  session: Session,
  publicationId: Id,
  revision: number,
): Promise<PublicationDetail> {
  const params = { publicationId, revision };
  return single(publicationId, method, keyOf(params), async () => mirror(await session.client.request(method, params)));
}

/** Approves the pinned export. */
export function approveExport(session: Session, publicationId: Id, revision: number): Promise<PublicationDetail> {
  return revisionCall('publishing.approve', session, publicationId, revision);
}

/** The owner approves this exact revision for an agent to send (desktop app only). */
export function authorizeAgentDelivery(session: Session, publicationId: Id, revision: number): Promise<PublicationDetail> {
  return revisionCall('publishing.authorize', session, publicationId, revision);
}

export function archivePublication(session: Session, publicationId: Id, revision: number): Promise<PublicationDetail> {
  return revisionCall('publishing.archive', session, publicationId, revision);
}

/** Undo of Archive. */
export function unarchivePublication(session: Session, publicationId: Id, revision: number): Promise<PublicationDetail> {
  return revisionCall('publishing.unarchive', session, publicationId, revision);
}

/** Sends every unsent destination (by hand: it waits for the owner). Called only after the review checkbox. */
export function sendPublication(session: Session, publicationId: Id, revision: number): Promise<PublicationDetail> {
  const params = { publicationId, revision, confirmed: true as const };
  return single(publicationId, 'send', keyOf(params), async () => mirror(await session.client.request('publishing.send', params)));
}

/** Sends or authorizes several publications; each item succeeds or fails on its own. */
export function batchPublications(
  session: Session,
  action: 'authorize' | 'send',
  items: { publicationId: Id; revision: number }[],
): Promise<PublishingBatchItemResult[]> {
  const params = { action, items, confirmed: true as const };
  return single(`batch:${items.map((i) => i.publicationId).sort().join(',')}`, `batch.${action}`, keyOf(params), async () => {
    const { results } = await session.client.request('publishing.batch', params);
    for (const result of results) if (result.publication) mirror(result.publication);
    return results;
  });
}

function destinationCall(
  method: 'publishing.withdraw' | 'publishing.cancel',
  session: Session,
  publicationId: Id,
  revision: number,
  destinationId: Id,
): Promise<PublicationDetail> {
  const params = { publicationId, revision, destinationId };
  return single(publicationId, method, keyOf(params), async () => mirror(await session.client.request(method, params)));
}

/** Takes a destination waiting for the owner back to unsent. */
export function withdrawDestination(session: Session, publicationId: Id, revision: number, destinationId: Id): Promise<PublicationDetail> {
  return destinationCall('publishing.withdraw', session, publicationId, revision, destinationId);
}

export function cancelDestination(session: Session, publicationId: Id, revision: number, destinationId: Id): Promise<PublicationDetail> {
  return destinationCall('publishing.cancel', session, publicationId, revision, destinationId);
}

/** Records what the owner checked in the network's app (desktop app only). */
export function recordResult(session: Session, params: PublishingReconcileParams): Promise<PublicationDetail> {
  return single(params.publicationId, 'reconcile', keyOf(params), async () => mirror(await session.client.request('publishing.reconcile', params)));
}

/** Asks the text model for a proposal; it is stored on the publication when the job finishes (`proposal`). */
export function proposeCopy(session: Session, publicationId: Id, instruction?: string): Promise<{ jobId: Id }> {
  const params = { publicationId, ...(instruction ? { instruction } : {}) };
  return single(publicationId, 'copy.propose', keyOf(params), () => session.client.request('publishing.copy.propose', params));
}

/** Applies text (usually from the proposal) and clears the proposal. */
export function applyCopy(session: Session, publicationId: Id, revision: number, copy: PublicationCopy): Promise<PublicationDetail> {
  const params = { publicationId, revision, copy };
  return single(publicationId, 'copy.apply', keyOf(params), async () => mirror(await session.client.request('publishing.copy.apply', params)));
}

// ---- Settings, connections and accounts (owner) ----

export function savePublishingSettings(session: Session, settings: PublishingSettings): Promise<PublishingSettings> {
  return single('settings', 'settings.save', keyOf(settings), async () => {
    const saved = await session.client.request('publishing.settings.save', { settings });
    const store = usePublishing.getState();
    if (store.ready) store.apply({ type: 'settings.updated', settings: saved });
    return saved;
  });
}

export function saveConnection(session: Session, params: { id?: Id; provider: PublishingProvider; name: string }): Promise<PublishingConnection> {
  return call(async () => (await session.client.request('publishing.connections.save', params)).connection);
}

/** Removes a connection and its accounts; the result carries them for Undo ({@link restoreConnection}). */
export function removeConnection(session: Session, connectionId: Id): Promise<{ connection: PublishingConnection; accounts: PublishingAccount[] }> {
  return call(() => session.client.request('publishing.connections.remove', { connectionId }));
}

/** Undo of {@link removeConnection}: saves the connection and its accounts again under their IDs. */
export function restoreConnection(session: Session, removed: { connection: PublishingConnection; accounts: PublishingAccount[] }): Promise<void> {
  return call(async () => {
    const { connection, accounts } = removed;
    await session.client.request('publishing.connections.save', { id: connection.id, provider: connection.provider, name: connection.name });
    for (const account of accounts) {
      await session.client.request('publishing.accounts.save', accountParams(account));
    }
    for (const account of accounts) {
      if (account.equivalentTo) await session.client.request('publishing.accounts.link', { accountId: account.id, equivalentTo: account.equivalentTo });
    }
  });
}

function accountParams(account: PublishingAccount) {
  return {
    id: account.id,
    connectionId: account.connectionId,
    network: account.network,
    name: account.name,
    remoteId: account.remoteId,
    disabled: account.disabled,
  };
}

export function saveAccount(
  session: Session,
  params: { id?: Id; connectionId: Id; network: PublishingNetwork; name: string; remoteId: string; disabled?: boolean },
): Promise<PublishingAccount> {
  return call(async () => (await session.client.request('publishing.accounts.save', params)).account);
}

/** Removes an account; the result is the removed account for Undo ({@link restoreAccount}). */
export function removeAccount(session: Session, accountId: Id): Promise<PublishingAccount> {
  return call(async () => (await session.client.request('publishing.accounts.remove', { accountId })).account);
}

/** Undo of {@link removeAccount}. */
export function restoreAccount(session: Session, account: PublishingAccount): Promise<PublishingAccount> {
  return call(async () => {
    const saved = (await session.client.request('publishing.accounts.save', accountParams(account))).account;
    if (!account.equivalentTo) return saved;
    return (await session.client.request('publishing.accounts.link', { accountId: account.id, equivalentTo: account.equivalentTo })).account;
  });
}

/** Links an account to the canonical account of the same real identity (`null`: independent). */
export function linkAccount(session: Session, accountId: Id, equivalentTo: Id | null): Promise<PublishingAccount> {
  return call(async () => (await session.client.request('publishing.accounts.link', { accountId, equivalentTo })).account);
}

/** Deletes archived publications past retention and unused pinned export files (desktop app only). */
export function cleanupPublishing(session: Session): Promise<PublishingCleanupResult> {
  return single('cleanup', 'cleanup', '', () => session.client.request('publishing.cleanup', {}));
}

// ---- Calendar transfer ----

export function exportCalendar(session: Session): Promise<{ archive: CalendarArchive; fileName: string }> {
  return call(() => session.client.request('publishing.transfer.export', {}));
}

export function previewCalendarImport(session: Session, archive: unknown): Promise<CalendarImportPreview> {
  return call(() => session.client.request('publishing.transfer.preview', { archive }));
}

export function applyCalendarImport(session: Session, archive: unknown): Promise<{ added: Id[]; preview: CalendarImportPreview }> {
  return single('transfer', 'transfer.apply', '', () => session.client.request('publishing.transfer.apply', { archive }));
}

/** Test hook: forgets running calls. */
export function resetPublishingCommands(): void {
  running.clear();
  usePublishingBusy.setState({ busy: {} });
}

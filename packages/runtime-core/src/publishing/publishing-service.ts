import { createHash } from 'node:crypto';
import { TopicLog, type Logger } from '@cuccut/harness';
import {
  PUBLISHING_CALENDAR_MAX_DAYS,
  PUBLISHING_CALENDAR_MAX_LIMIT,
  PUBLISHING_SNAPSHOT_ARCHIVED_DAYS,
  SLOT_PLAN_MAX_DAYS,
  SUPPORTED_PUBLISHING_PROVIDERS,
  RpcError,
  UNSETTLED_DELIVERY_STATES,
  calendarInstant,
  civilDaySpan,
  composeCaption,
  dayInZone,
  defaultPublishingFormat,
  findReservationConflict,
  intendedTime,
  isCivilDate,
  isEditableDelivery,
  isValidTimezone,
  newId,
  planSlots,
  publicationApproved,
  publicationAuthorized,
  publicationOccupancy,
  publicationStatus,
  publishingAccountIdentity,
  resolveCopy,
  todayInZone,
  unsettledDeliveryIssues,
  validatePublication,
  refOf,
  type CalendarPlacement,
  type MessageRef,
  type DeliveryState,
  type DestinationInput,
  type Id,
  type JobSubmitter,
  type Localized,
  type PinnableExport,
  type PinnedExport,
  type Publication,
  type PublicationDestination,
  type PublicationDetail,
  type PublicationIssue,
  type PublicationRow,
  type PublishingAccount,
  type PublishingBatchItemResult,
  type PublishingCalendarParams,
  type PublishingCalendarResult,
  type PublishingCleanupResult,
  type PublishingConnection,
  type PublishingEvent,
  type PublishingNetwork,
  type PublishingPinSource,
  type PublishingPrepareParams,
  type PublishingProvider,
  type PublishingReconcileParams,
  type PublishingSettings,
  type PublishingSlotsParams,
  type PublishingSlotsResult,
  type PublishingSnapshot,
  type PublishingUpdateParams,
  type ResolvedPayload,
  type JobRecord,
} from '@cuccut/protocol';
import { PublishingIssues as PI } from '@cuccut/protocol/messages/protocol';
import { RcPublishing as RP } from '@cuccut/protocol/messages/runtime-core';
import { RuntimeStoragePublishing as SP } from '@cuccut/protocol/messages/runtime-storage';
import { publicationDestinationSchema, publicationSchema, publishingAccountSchema, publishingConnectionSchema } from '@cuccut/protocol/schemas';
import { PublishingStore, type PublishingCommit, type PublishingTransaction } from '@cuccut/runtime-storage';
import { JobWatch, type PublishingJobSource } from './job-watch.ts';
import { PublishingCopy, type PublishingTextJobs } from './publishing-copy.ts';
import { PublishingExports, type PublishingArtifacts, type PublishingExportJobs } from './publishing-exports.ts';
import { PublishingTransfer } from './publishing-transfer.ts';
import type { PublishingVideoFacts, PublishingVideos } from './publishing-videos.ts';

/**
 * The publishing service (design `docs/cuccut/m2-publishing.md` §4.1): one service behind every surface (RPC for the UI, agent tools, MCP and the
 * CLI). It owns the publishing store, derives details and calendar rows, enforces the actor rules (§4.2) and the scheduling, locking and payload rules
 * ported from agentcut (§5–§7), and publishes the `publishing` topic.
 *
 * - Every write names the revision the caller read; the store refuses a stale one (`PUBLICATION_CONFLICT`, `details.current`).
 * - Delivery is never automatic. Phase 1 has one route, "By hand" (`manual`): Send freezes each unsent destination's payload and puts it in `queued`
 *   ("Waiting for you"); the owner posts in the network's app and records what happened (`reconcile`). Any other route is refused
 *   (`PROVIDER_UNSUPPORTED`).
 * - An agent (or the command line) sends only a revision the owner authorized; any change of the publication voids that authorization.
 */

/** Who is calling (design §4.2). `human`: the desktop app; `web`: the browser (no authorize, send, reconcile, connections, transfer). */
export type PublishingActorKind = 'human' | 'web' | 'agent' | 'cli';

export interface PublishingActor {
  kind: PublishingActorKind;
  /** The principal's name, kept with approvals and recorded results. */
  name: string;
  /** Who jobs started for this call belong to (render-and-pin exports, copy proposals). */
  submitter: JobSubmitter;
}

export interface PublishingServiceOptions {
  store: PublishingStore;
  /** The publishing directory (`RuntimeHome.publishingDir`): pinned exports and import backups. */
  dir: string;
  exports: PublishingExports;
  jobs: PublishingJobSource & PublishingTextJobs;
  videos: PublishingVideos;
  log: Logger;
  now?: () => Date;
  /** How often by-hand deliveries are checked for being due (default 30 s). */
  dueIntervalMs?: number;
}

/** What `PublishingService.open` needs from the Runtime. */
export interface OpenPublishingOptions {
  /** The store file (`RuntimeHome.publishingFile`). */
  file: string;
  dir: string;
  jobs: PublishingJobSource & PublishingTextJobs & { artifacts: PublishingArtifacts & PublishingTextJobs['artifacts'] };
  exports: PublishingExportJobs;
  videos: PublishingVideos;
  log: Logger;
  now?: () => Date;
  dueIntervalMs?: number;
}

const DAY_MS = 86_400_000;

function forbidden(message: Localized, code = 'PUBLISHING_FORBIDDEN'): RpcError {
  return new RpcError('forbidden', message, { code });
}

function conflict(message: Localized, code: string, details: Record<string, unknown> = {}): RpcError {
  return new RpcError('conflict', message, { code, ...details });
}

function invalid(message: Localized, code: string, details: Record<string, unknown> = {}): RpcError {
  return new RpcError('invalid-request', message, { code, ...details });
}

function notFound(message: Localized, code: string): RpcError {
  return new RpcError('not-found', message, { code });
}

function issuesError(issues: PublicationIssue[]): RpcError {
  return invalid(RP.invalid(), 'PUBLICATION_INVALID', { issues });
}

/** The hash that identifies a frozen payload. */
export function payloadHash(payload: ResolvedPayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export class PublishingService {
  readonly store: PublishingStore;
  readonly files: PublishingExports;
  readonly videos: PublishingVideos;
  readonly jobs: JobWatch;
  /** Copy proposals (`publishing.copy.*`). */
  readonly copy: PublishingCopy;
  /** Calendar transfer (`publishing.transfer.*`). */
  readonly transfer: PublishingTransfer;
  readonly topic: TopicLog<PublishingSnapshot, PublishingEvent>;
  readonly #log: Logger;
  readonly #now: () => Date;
  readonly #dueIntervalMs: number;
  readonly #dueSent = new Set<string>();
  #dueTimer: ReturnType<typeof setInterval> | null = null;
  #unsubscribe: () => void;
  #closed = false;

  constructor(options: PublishingServiceOptions) {
    this.store = options.store;
    this.files = options.exports;
    this.videos = options.videos;
    this.#log = options.log;
    this.#now = options.now ?? (() => new Date());
    this.#dueIntervalMs = options.dueIntervalMs ?? 30_000;
    this.jobs = new JobWatch(options.jobs, options.log);
    this.copy = new PublishingCopy({ service: this, jobs: options.jobs, log: options.log.child('copy') });
    this.transfer = new PublishingTransfer({ service: this, dir: options.dir, log: options.log, now: this.#now });
    this.topic = new TopicLog<PublishingSnapshot, PublishingEvent>(() => this.snapshot(), '0');
    this.#unsubscribe = this.store.onCommit((commit) => this.#published(commit));
  }

  // ---- Lifecycle ----

  /** Opens the store (an unreadable file leaves publishing read-only or unavailable, with the reason in the snapshot) and builds the service. */
  static async open(options: OpenPublishingOptions): Promise<PublishingService> {
    const log = options.log;
    const store = await PublishingStore.open(options.file, { log, ...(options.now ? { now: options.now } : {}) });
    const exports = new PublishingExports({
      dir: options.dir,
      artifacts: options.jobs.artifacts,
      exports: options.exports,
      videos: options.videos,
      log,
      ...(options.now ? { now: options.now } : {}),
    });
    return new PublishingService({
      store,
      dir: options.dir,
      exports,
      jobs: options.jobs,
      videos: options.videos,
      log,
      ...(options.now ? { now: options.now } : {}),
      ...(options.dueIntervalMs ? { dueIntervalMs: options.dueIntervalMs } : {}),
    });
  }

  /** Starts the due check and resumes watching "Render and pin" exports that were running when the Runtime stopped. */
  start(): void {
    for (const p of this.store.publications()) {
      if (p.pinJob && !p.pinJob.error) this.#watchRender(p.id, p.pinJob.jobId);
    }
    this.#dueTimer = setInterval(() => this.dueTick(), this.#dueIntervalMs);
    this.#dueTimer.unref?.();
    this.dueTick();
  }

  /** Stops timers and job watches and waits for the store's pending writes. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#dueTimer) clearInterval(this.#dueTimer);
    this.#dueTimer = null;
    this.jobs.close();
    this.#unsubscribe();
    this.topic.clear();
    await this.store.flush();
  }

  // ---- Reads ----

  snapshot(): PublishingSnapshot {
    const cutoff = this.#now().getTime() - PUBLISHING_SNAPSHOT_ARCHIVED_DAYS * DAY_MS;
    return {
      settings: this.store.settings(),
      connections: this.store.connections(),
      accounts: this.store.accounts(),
      publications: this.store.publications().filter((p) => this.#inSnapshot(p, cutoff)).map((p) => this.row(p)),
      degraded: this.store.problem,
    };
  }

  #inSnapshot(p: Publication, cutoff = this.#now().getTime() - PUBLISHING_SNAPSHOT_ARCHIVED_DAYS * DAY_MS): boolean {
    return !p.archived || (p.archivedAt !== null && Date.parse(p.archivedAt) >= cutoff);
  }

  /** The calendar index entry of a publication. */
  row(p: Publication): PublicationRow {
    return {
      id: p.id,
      videoId: p.videoId,
      projectId: p.projectId,
      label: p.label,
      status: publicationStatus(p, publicationApproved(p)),
      archived: p.archived,
      revision: p.revision,
      scheduledAt: p.scheduledAt,
      timezone: p.timezone,
      priority: p.priority,
      expiresAt: p.expiresAt,
      destinations: p.destinations.map((d) => ({ id: d.id, accountId: d.accountId, format: d.format, state: d.state, at: calendarInstant(p, d) })),
    };
  }

  /** Validation issues of a publication as saved now: the shared rules plus unsettled deliveries of other releases of the same video. */
  issues(p: Publication): PublicationIssue[] {
    return this.store.read((doc) => {
      const pinned = p.exportId ? (doc.exports.find((e) => e.id === p.exportId) ?? null) : null;
      return [
        ...validatePublication(p, { accounts: doc.accounts, connections: doc.connections, pinned, now: this.#now().getTime() }),
        ...unsettledDeliveryIssues(p, doc.publications, doc.accounts),
      ];
    });
  }

  detail(p: Publication): PublicationDetail {
    const pinned = p.exportId ? this.store.pinnedExport(p.exportId) : null;
    const approved = publicationApproved(p);
    const currentVideoRevision = this.videos.revision(p.videoId);
    return {
      ...p,
      status: publicationStatus(p, approved),
      approved,
      videoAvailable: this.videos.available(p.videoId),
      currentVideoRevision,
      newerEdit: pinned !== null && currentVideoRevision !== null && pinned.videoRevision !== currentVideoRevision,
      export: pinned,
      issues: this.issues(p),
    };
  }

  #publication(id: Id): Publication {
    const p = this.store.publication(id);
    if (!p) throw notFound(SP.notFound(), 'PUBLICATION_NOT_FOUND');
    return p;
  }

  /** The saved publication at the revision the caller read (`PUBLICATION_CONFLICT` with `details.current` otherwise). */
  #at(id: Id, revision: number): Publication {
    const p = this.#publication(id);
    if (p.revision !== revision) throw conflict(SP.conflict(), 'PUBLICATION_CONFLICT', { current: p });
    return p;
  }

  /** The saved publication (a read). */
  publication(id: Id): Publication {
    return this.#publication(id);
  }

  get(id: Id): PublicationDetail {
    return this.detail(this.#publication(id));
  }

  validate(id: Id): PublicationIssue[] {
    return this.issues(this.#publication(id));
  }

  /** Calendar rows of civil days `from`..`to` in the workspace timezone; filters apply before pagination. */
  calendar(q: PublishingCalendarParams): PublishingCalendarResult {
    const rows = this.calendarRows(q);
    const offset = q.offset ?? 0;
    const limit = Math.min(q.limit ?? PUBLISHING_CALENDAR_MAX_LIMIT, PUBLISHING_CALENDAR_MAX_LIMIT);
    const page = rows.slice(offset, offset + limit);
    return { publications: page, total: rows.length, nextOffset: offset + page.length < rows.length ? offset + page.length : null };
  }

  /** Every calendar row matching the query, before pagination (the agent tools filter by video visibility first, then paginate). */
  calendarRows(q: Omit<PublishingCalendarParams, 'offset' | 'limit'>): PublicationRow[] {
    if (!isCivilDate(q.from) || !isCivilDate(q.to) || q.to < q.from || civilDaySpan(q.from, q.to) > PUBLISHING_CALENDAR_MAX_DAYS) {
      throw invalid(RP.calendarRange(), 'CALENDAR_RANGE');
    }
    const timezone = this.store.settings().timezone;
    const accounts = q.accountIds?.length ? new Set(q.accountIds) : null;
    const statuses = q.statuses?.length ? new Set(q.statuses) : null;
    const unscheduled = q.includeUnscheduled !== false;
    const rows = this.store
      .publications()
      .filter((p) => !p.archived)
      .filter((p) => q.projectId === undefined || p.projectId === q.projectId)
      .filter((p) => !accounts || p.destinations.some((d) => accounts.has(d.accountId)))
      .filter((p) => {
        const times = p.destinations.map((d) => calendarInstant(p, d));
        if (unscheduled && (times.length === 0 || times.some((at) => !at))) return true;
        return times.some((at) => {
          if (!at) return false;
          const day = dayInZone(at, timezone);
          return day >= q.from && day <= q.to;
        });
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)))
      .map((p) => this.row(p))
      .filter((row) => !statuses || statuses.has(row.status));
    return rows;
  }

  /** Finished MP4 exports of a video that can be pinned. */
  pinnable(videoId: Id): PinnableExport[] {
    return this.files.pinnable(videoId);
  }

  /** The pinned export file of a publication (for a read handle). */
  exportFile(id: Id): { pinned: PinnedExport; file: string } {
    const p = this.#publication(id);
    const pinned = p.exportId ? this.store.pinnedExport(p.exportId) : null;
    if (!pinned) throw notFound(RP.exportRequired(), 'EXPORT_REQUIRED');
    return { pinned, file: this.files.file(pinned) };
  }

  // ---- Prepare and edit ----

  /** One publication per video: the latest one that is not archived (unless `repeat`), else a new one seeded from the video and the default accounts. */
  async prepare(params: PublishingPrepareParams, _actor: PublishingActor): Promise<PublicationDetail[]> {
    const videoIds = [...new Set(params.videoIds)];
    const facts: Array<PublishingVideoFacts & { sequenceId: Id }> = [];
    for (const videoId of videoIds) {
      const found = await this.videos.facts(videoId);
      const sequenceId = params.sequenceId ?? found?.rootSequenceId ?? null;
      if (!found || !sequenceId) throw notFound(RP.videoNotFound(), 'VIDEO_NOT_FOUND');
      facts.push({ ...found, sequenceId });
    }
    const accounts = this.store.accounts();
    for (const accountId of params.accountIds ?? []) {
      if (!accounts.some((a) => a.id === accountId)) throw notFound(RP.accountNotFound(), 'ACCOUNT_NOT_FOUND');
    }
    const ids = await this.store.transact((tx) => {
      const settings = this.store.settings();
      const saved = this.store.publications();
      const chosen = (params.accountIds ?? settings.defaultAccountIds)
        .map((accountId) => accounts.find((a) => a.id === accountId))
        .filter((a): a is PublishingAccount => !!a && (params.accountIds !== undefined || !a.disabled));
      return facts.map((video) => {
        const existing = saved
          .filter((p) => p.videoId === video.videoId && p.sequenceId === video.sequenceId && !p.archived)
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
          .at(-1);
        if (existing && !params.repeat) return existing.id;
        const at = tx.now.toISOString();
        const p = publicationSchema.parse({
          id: newId('pub'),
          videoId: video.videoId,
          sequenceId: video.sequenceId,
          projectId: video.projectId,
          videoName: video.name,
          label: [...video.name].slice(0, 500).join('') || video.videoId,
          copy: { title: [...video.name].slice(0, 100).join(''), description: '', hashtags: [] },
          timezone: settings.timezone,
          revision: 0,
          createdAt: at,
          updatedAt: at,
          origin: params.origin ?? null,
          destinations: [...new Map(chosen.map((a) => [a.id, a])).values()].map((a) => newDestination(a)),
        });
        tx.insertPublication(p);
        return p.id;
      });
    });
    return ids.map((id) => this.detail(this.#publication(id)));
  }

  /** Changes text, times and destinations (agentcut `patch`). */
  async update(params: PublishingUpdateParams, _actor: PublishingActor, options: { clearProposal?: boolean } = {}): Promise<PublicationDetail> {
    const { patch, destinations } = params;
    if (patch.timezone !== undefined && !isValidTimezone(patch.timezone)) throw invalid(PI.timezoneInvalid(), 'TIMEZONE_INVALID');
    const accounts = this.store.accounts();
    const saved = await this.store.change(params.publicationId, params.revision, (p, tx) => {
      this.#assertActive(p);
      const submitted = p.destinations.some((d) => !isEditableDelivery(d.state));
      if (submitted && Object.entries(patch).some(([key, value]) => value !== undefined && !same(p[key as keyof Publication], value))) {
        throw conflict(RP.publicationLocked(), 'PUBLICATION_LOCKED');
      }
      for (const [key, value] of Object.entries(patch)) if (value !== undefined) (p as unknown as Record<string, unknown>)[key] = value;
      if (destinations) p.destinations = this.#destinations(p, destinations, accounts, tx);
      if (options.clearProposal) p.proposal = null;
      for (const d of p.destinations) if (isEditableDelivery(d.state)) clearPayload(tx, p, d);
      this.#checkReservations(p);
    });
    return this.detail(saved);
  }

  #destinations(p: Publication, inputs: DestinationInput[], accounts: PublishingAccount[], tx: PublishingTransaction): PublicationDestination[] {
    if (new Set(inputs.map((d) => d.accountId)).size !== inputs.length) throw invalid(RP.duplicateAccount(), 'DUPLICATE_ACCOUNT');
    for (const existing of p.destinations) {
      if (!isEditableDelivery(existing.state) && !inputs.some((d) => d.id === existing.id)) throw conflict(RP.destinationKept(), 'DESTINATION_LOCKED');
    }
    return inputs.map((input) => {
      if (!accounts.some((a) => a.id === input.accountId)) throw notFound(RP.accountNotFound(), 'ACCOUNT_NOT_FOUND');
      const existing = input.id ? p.destinations.find((d) => d.id === input.id) : undefined;
      if (input.id && !existing) throw notFound(RP.destinationNotFound(), 'DESTINATION_NOT_FOUND');
      if (existing && existing.accountId !== input.accountId) throw invalid(RP.destinationAccountFixed(), 'DESTINATION_ACCOUNT_FIXED');
      const base = existing ?? publicationDestinationSchema.parse({ id: 'new', accountId: input.accountId, format: input.format });
      const fields = {
        format: input.format,
        overrides: { ...base.overrides, ...input.overrides },
        options: { ...base.options, ...input.options },
        scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : base.scheduledAt,
      };
      if (existing && !isEditableDelivery(existing.state)) {
        if (Object.entries(fields).some(([key, value]) => !same(existing[key as keyof PublicationDestination], value))) {
          throw conflict(RP.destinationLocked(), 'DESTINATION_LOCKED');
        }
        return existing;
      }
      if (existing) clearPayload(tx, p, existing);
      return publicationDestinationSchema.parse({ id: existing?.id ?? newId('pdest'), accountId: input.accountId, ...fields });
    });
  }

  /** Moves destinations (atomic; destinations not yet sent only). `null` falls back to the publication's default time. */
  async reschedule(id: Id, revision: number, placements: CalendarPlacement[], _actor: PublishingActor): Promise<PublicationDetail> {
    if (new Set(placements.map((item) => item.destinationId)).size !== placements.length) throw invalid(RP.duplicatePlacement(), 'DUPLICATE_PLACEMENT');
    const saved = await this.store.change(id, revision, (p, tx) => {
      this.#assertActive(p);
      for (const { destinationId, at } of placements) {
        const d = p.destinations.find((item) => item.id === destinationId);
        if (!d) throw notFound(RP.destinationNotFound(), 'DESTINATION_NOT_FOUND');
        if (!isEditableDelivery(d.state)) throw conflict(RP.destinationLocked(), 'DESTINATION_LOCKED');
        const effective = at ?? p.scheduledAt;
        if (effective && p.expiresAt && Date.parse(effective) >= Date.parse(p.expiresAt)) throw invalid(RP.afterExpiry(), 'AFTER_EXPIRY');
        d.scheduledAt = at;
        clearPayload(tx, p, d);
      }
      this.#checkReservations(p);
    });
    return this.detail(saved);
  }

  /**
   * Plans free weekly slots (agentcut `slots`). Publications that already have a default time keep it; the others get the earliest free slot. With
   * `reserve`, the planned times are written in one change, each as the publication's default time (destination times are cleared).
   */
  async slots(params: PublishingSlotsParams, _actor: PublishingActor): Promise<PublishingSlotsResult> {
    const ids = [...new Set(params.publicationIds)];
    const settings = this.store.settings();
    const from = params.from ?? todayInZone(settings.timezone, this.#now().getTime());
    const days = Math.min(params.days ?? 30, SLOT_PLAN_MAX_DAYS);
    const plan = (read: (id: Id) => Publication) => {
      const publications = ids.map(read);
      for (const p of publications) {
        this.#assertActive(p);
        if (p.destinations.some((d) => !isEditableDelivery(d.state))) throw conflict(RP.publicationLocked(), 'PUBLICATION_LOCKED');
      }
      if (publications.some((p) => p.destinations.some((d) => d.scheduledAt))) throw conflict(RP.slotsHaveDestinationTimes(), 'DESTINATION_TIMES');
      const accounts = this.store.accounts();
      const occupancy = this.store.read((doc) => publicationOccupancy(doc.publications, doc.accounts));
      const preserved = publications.filter((p) => p.scheduledAt).map((p) => ({ publicationId: p.id, at: p.scheduledAt! }));
      const result = planSlots(
        publications
          .filter((p) => !p.scheduledAt)
          .map((p) => ({
            publicationId: p.id,
            priority: p.priority,
            expiresAt: p.expiresAt,
            accountIds: [...new Set(p.destinations.filter((d) => d.state !== 'cancelled').map((d) => publishingAccountIdentity(accounts, d.accountId)))],
          })),
        settings,
        occupancy,
        from,
        days,
        this.#now().getTime(),
      );
      return { publications, result: { ...result, placements: [...preserved, ...result.placements] }, planned: result.placements };
    };
    if (!params.reserve) {
      const { result } = plan((id) => this.#publication(id));
      return { ...result, publications: [] };
    }
    const revisions = params.revisions ?? {};
    const { result } = await this.store.transact((tx) => {
      const planned = plan((id) => {
        if (revisions[id] === undefined) throw invalid(RP.invalid(), 'REVISION_REQUIRED');
        return tx.publication(id, revisions[id]);
      });
      for (const { publicationId, at } of planned.planned) {
        const p = tx.publication(publicationId);
        p.scheduledAt = at;
        p.timezone = settings.timezone;
        for (const d of p.destinations) {
          d.scheduledAt = null;
          clearPayload(tx, p, d);
        }
      }
      // Publications that kept their time are not changed: only the planned ones are written.
      for (const p of planned.publications) if (!planned.planned.some((item) => item.publicationId === p.id)) tx.drafts.delete(p.id);
      return planned;
    });
    return { ...result, publications: result.placements.map((item) => this.detail(this.#publication(item.publicationId))) };
  }

  // ---- Pinned exports and approval ----

  /** Pins a finished export of the video, or starts "Render and pin" (the output is pinned when the export finishes). */
  async pin(id: Id, revision: number, source: PublishingPinSource, actor: PublishingActor): Promise<{ publication: PublicationDetail; jobId?: Id }> {
    const p = this.#at(id, revision);
    this.#assertActive(p);
    assertPinnable(p);
    if ('jobId' in source) {
      const pinned = await this.files.pinJob(source.jobId, { videoId: p.videoId, sequenceId: p.sequenceId, requireCurrent: true });
      const saved = await this.store.change(id, revision, (draft, tx) => {
        assertPinnable(draft);
        applyPin(tx, draft, pinned);
      });
      return { publication: this.detail(saved) };
    }
    const jobId = await this.files.render(p.videoId, p.sequenceId, actor.submitter);
    const saved = await this.store.change(id, revision, (draft, tx) => {
      draft.pinJob = { jobId, at: tx.now.toISOString(), error: null, errorRef: null };
    });
    this.#watchRender(id, jobId);
    return { publication: this.detail(saved), jobId };
  }

  #watchRender(id: Id, jobId: Id): void {
    this.jobs.watch(jobId, (job) => {
      void this.#renderDone(id, jobId, job).catch((error: unknown) =>
        this.#log.warn('Recording a finished render-and-pin failed', { publicationId: id, jobId, error: String(error) }),
      );
    });
  }

  async #renderDone(id: Id, jobId: Id, job: JobRecord | null): Promise<void> {
    if (this.#closed) return;
    const p = this.store.publication(id);
    if (!p || p.pinJob?.jobId !== jobId) return;
    let failure: { error: string; errorRef: MessageRef | null } | null = null;
    let pinned: PinnedExport | null = null;
    if (job?.state === 'completed') {
      try {
        pinned = await this.files.pinJob(jobId, { videoId: p.videoId, sequenceId: p.sequenceId, requireCurrent: false });
      } catch (error) {
        failure = error instanceof RpcError ? { error: error.message, errorRef: error.messageRef ?? null } : localized(RP.renderFailed());
      }
    } else if (job?.state === 'cancelled') {
      failure = localized(RP.renderCancelled());
    } else {
      failure = job?.error ? { error: job.error.message, errorRef: job.error.messageRef ?? null } : localized(RP.renderFailed());
    }
    if (this.#closed) return;
    await this.store.transact((tx) => {
      if (!this.store.publication(id) || this.store.publication(id)!.pinJob?.jobId !== jobId) return;
      const draft = tx.publication(id);
      if (pinned && draft.destinations.every((d) => isEditableDelivery(d.state))) {
        applyPin(tx, draft, pinned);
        return;
      }
      draft.pinJob = { jobId, at: draft.pinJob!.at, ...(failure ?? localized(RP.pinLocked())) };
    });
  }

  /** Approves the pinned export (by the owner, or by an agent: the approval names who did it). */
  async approve(id: Id, revision: number, actor: PublishingActor): Promise<PublicationDetail> {
    const saved = await this.store.change(id, revision, (p, tx) => {
      this.#assertActive(p);
      if (!p.exportId || !this.store.pinnedExport(p.exportId)) throw invalid(RP.exportRequired(), 'EXPORT_REQUIRED');
      p.approval = { exportId: p.exportId, by: actor.kind === 'human' || actor.kind === 'web' ? 'human' : 'agent', actor: actor.name, at: tx.now.toISOString() };
    });
    return this.detail(saved);
  }

  // ---- Delivery ----

  /** The owner authorizes this exact revision for an agent to send (desktop app only). */
  async authorize(id: Id, revision: number, actor: PublishingActor): Promise<PublicationDetail> {
    if (actor.kind !== 'human') throw forbidden(actor.kind === 'web' ? RP.desktopOnly() : RP.ownerOnly(), 'OWNER_REQUIRED');
    const saved = await this.store.change(id, revision, (p, tx) => {
      this.#assertActive(p);
      const issues = this.issues(p);
      if (issues.length) throw issuesError(issues);
      // The commit raises the revision by one: the authorization names the revision being saved.
      p.authorization = { revision: revision + 1, at: tx.now.toISOString() };
    });
    return this.detail(saved);
  }

  /** Freezes each unsent destination's payload and hands it over; by hand, it waits for the owner (`queued`). */
  async send(id: Id, revision: number, actor: PublishingActor): Promise<PublicationDetail> {
    if (actor.kind === 'web') throw forbidden(RP.desktopOnly(), 'OWNER_REQUIRED');
    const p = this.#at(id, revision);
    if (actor.kind !== 'human' && !publicationAuthorized(p)) throw forbidden(RP.authorizationRequired(), 'AUTHORIZATION_REQUIRED');
    this.#assertActive(p);
    const pinned = p.exportId ? this.store.pinnedExport(p.exportId) : null;
    if (!pinned) throw issuesError(this.issues(p));
    await this.files.verify(pinned);
    const saved = await this.store.change(id, revision, (draft, tx) => {
      if (actor.kind !== 'human' && !publicationAuthorized(draft)) throw forbidden(RP.authorizationRequired(), 'AUTHORIZATION_REQUIRED');
      const editable = draft.destinations.filter((d) => isEditableDelivery(d.state));
      if (!editable.length) throw conflict(RP.nothingToSend(), 'NOTHING_TO_SEND');
      const issues = this.issues(draft);
      if (issues.length) throw issuesError(issues);
      const accounts = this.store.accounts();
      const connections = this.store.connections();
      for (const d of editable) {
        const account = accounts.find((a) => a.id === d.accountId)!;
        const connection = connections.find((c) => c.id === account.connectionId)!;
        if (!SUPPORTED_PUBLISHING_PROVIDERS.includes(connection.provider)) {
          throw new RpcError('unsupported', RP.providerUnsupported(), { code: 'PROVIDER_UNSUPPORTED', provider: connection.provider });
        }
      }
      this.#checkReservations(draft);
      for (const d of editable) {
        const account = accounts.find((a) => a.id === d.accountId)!;
        const copy = resolveCopy(draft.copy, d);
        if (d.payload) tx.addHistory({ publicationId: draft.id, destinationId: d.id, payload: d.payload, replacedAt: tx.now.toISOString() });
        const payload: ResolvedPayload = {
          exportId: draft.exportId!,
          accountId: account.id,
          connectionId: account.connectionId,
          remoteAccountId: account.remoteId,
          network: account.network,
          format: d.format,
          title: copy.title,
          caption: composeCaption(copy),
          hashtags: [...new Set(copy.hashtags)],
          options: d.options,
          scheduledAt: intendedTime(draft, d),
          timezone: draft.timezone,
        };
        Object.assign(d, {
          payload,
          payloadHash: payloadHash(payload),
          state: 'queued' satisfies DeliveryState,
          remoteId: null,
          remoteUrl: null,
          confirmedAt: null,
          publishedAt: null,
          checkedAt: null,
          error: null,
          errorRef: null,
          evidence: [],
        });
      }
    });
    this.dueTick();
    return this.detail(saved);
  }

  /** Runs `authorize` or `send` for several publications; each item succeeds or fails on its own. */
  async batch(action: 'authorize' | 'send', items: { publicationId: Id; revision: number }[], actor: PublishingActor): Promise<PublishingBatchItemResult[]> {
    const results: PublishingBatchItemResult[] = [];
    for (const item of items) {
      try {
        const publication =
          action === 'authorize' ? await this.authorize(item.publicationId, item.revision, actor) : await this.send(item.publicationId, item.revision, actor);
        results.push({ publicationId: item.publicationId, ok: true, publication });
      } catch (error) {
        if (!(error instanceof RpcError)) throw error;
        const payload = error.toPayload();
        results.push({
          publicationId: item.publicationId,
          ok: false,
          error: {
            code: (payload.details as { code?: string } | undefined)?.code ?? payload.code,
            message: payload.message,
            ...(payload.messageRef ? { messageRef: payload.messageRef } : {}),
            ...(payload.details !== undefined ? { details: payload.details } : {}),
          },
        });
      }
    }
    return results;
  }

  /** Takes a destination waiting for the owner back to unsent (its payload goes to the history). */
  async withdraw(id: Id, revision: number, destinationId: Id, _actor: PublishingActor): Promise<PublicationDetail> {
    const saved = await this.store.change(id, revision, (p, tx) => {
      const d = destination(p, destinationId);
      if (d.state !== 'queued' || this.#provider(d.accountId) !== 'manual') throw conflict(RP.notWaiting(), 'NOT_WAITING');
      clearPayload(tx, p, d);
      d.state = 'not_sent';
      d.error = null;
      d.errorRef = null;
    });
    return this.detail(saved);
  }

  /** Cancels a destination that was not sent (phase 1: no remote cancellation). */
  async cancel(id: Id, revision: number, destinationId: Id, actor: PublishingActor): Promise<PublicationDetail> {
    if (actor.kind !== 'human') throw forbidden(actor.kind === 'web' ? RP.desktopOnly() : RP.ownerOnly(), 'OWNER_REQUIRED');
    const saved = await this.store.change(id, revision, (p, tx) => {
      const d = destination(p, destinationId);
      if (!isEditableDelivery(d.state)) throw conflict(RP.cancelNotAllowed(), 'CANCEL_NOT_ALLOWED');
      clearPayload(tx, p, d);
      d.state = 'cancelled';
    });
    return this.detail(saved);
  }

  /** Records what the owner checked in the network's app (desktop app only; an agent cannot observe the network in phase 1). */
  async reconcile(params: PublishingReconcileParams, actor: PublishingActor): Promise<PublicationDetail> {
    if (actor.kind !== 'human') throw forbidden(actor.kind === 'web' ? RP.desktopOnly() : RP.ownerOnly(), 'OWNER_REQUIRED');
    const now = this.#now().getTime();
    if (params.state === 'scheduled' && (!params.at || Date.parse(params.at) <= now)) throw invalid(RP.reconcileFutureTime(), 'RECONCILE_TIME');
    const saved = await this.store.change(params.publicationId, params.revision, (p, tx) => {
      const d = destination(p, params.destinationId);
      if (d.state === 'published' || d.state === 'cancelled') throw conflict(RP.reconcileFinal(), 'RECONCILE_FINAL');
      if (d.state === 'sending') throw conflict(RP.reconcileSending(), 'RECONCILE_SENDING');
      const at = tx.now.toISOString();
      d.state = params.state;
      d.remoteUrl = params.remoteUrl;
      d.checkedAt = at;
      d.error = null;
      d.errorRef = null;
      d.verification = { state: params.state, note: params.note.trim(), by: actor.name, at };
      if (params.state === 'scheduled') d.confirmedAt = params.at;
      if (params.state === 'published') d.publishedAt = params.at ?? at;
      if (params.state === 'not_sent') {
        clearPayload(tx, p, d);
        d.remoteId = null;
        d.remoteUrl = null;
        d.confirmedAt = null;
      }
    });
    return this.detail(saved);
  }

  // ---- Archive and cleanup ----

  async archive(id: Id, revision: number, _actor: PublishingActor): Promise<PublicationDetail> {
    const saved = await this.store.change(id, revision, (p, tx) => {
      if (p.destinations.some((d) => d.state === 'queued' || d.state === 'sending' || d.state === 'cancel_pending')) {
        throw conflict(RP.archiveInFlight(), 'ARCHIVE_IN_FLIGHT');
      }
      p.archived = true;
      p.archivedAt = tx.now.toISOString();
    });
    return this.detail(saved);
  }

  async unarchive(id: Id, revision: number, _actor: PublishingActor): Promise<PublicationDetail> {
    const saved = await this.store.change(id, revision, (p) => {
      p.archived = false;
      p.archivedAt = null;
    });
    return this.detail(saved);
  }

  /**
   * Deletes archived publications older than the retention setting, drops pinned export records nothing uses any more, and removes their files
   * (desktop app only).
   */
  async cleanup(actor: PublishingActor): Promise<PublishingCleanupResult> {
    if (actor.kind !== 'human') throw forbidden(actor.kind === 'web' ? RP.desktopOnly() : RP.ownerOnly(), 'OWNER_REQUIRED');
    const cutoff = this.#now().getTime() - this.store.settings().archivedRetentionDays * DAY_MS;
    const { removed, keep } = await this.store.transact((tx) => {
      const remaining: Publication[] = [];
      let count = 0;
      for (const p of this.store.publications()) {
        if (p.archived && p.archivedAt && Date.parse(p.archivedAt) < cutoff) {
          tx.deletePublication(p.id);
          count++;
        } else remaining.push(p);
      }
      const used = new Set(remaining.flatMap((p) => [p.exportId, ...p.destinations.map((d) => d.payload?.exportId ?? null)]).filter((e): e is Id => !!e));
      const exports = this.store.exports();
      if (exports.some((e) => !used.has(e.id))) {
        const list = tx.exports();
        list.splice(0, list.length, ...exports.filter((e) => used.has(e.id)));
      }
      return { removed: count, keep: new Set(exports.filter((e) => used.has(e.id)).map((e) => e.sha256)) };
    });
    const files = await this.files.cleanup(keep);
    return { publications: removed, files: files.files, bytes: files.bytes };
  }

  // ---- Settings, connections and accounts ----

  async saveSettings(input: PublishingSettings, actor: PublishingActor): Promise<PublishingSettings> {
    if (actor.kind !== 'human' && actor.kind !== 'web') throw forbidden(RP.settingsOwnerOnly(), 'OWNER_REQUIRED');
    if (!isValidTimezone(input.timezone)) throw invalid(PI.timezoneInvalid(), 'TIMEZONE_INVALID');
    const accounts = this.store.accounts();
    if (input.defaultAccountIds.some((id) => !accounts.some((a) => a.id === id))) throw invalid(RP.defaultAccountMissing(), 'ACCOUNT_NOT_FOUND');
    const { revision, ...fields } = input;
    return this.store.change('settings', revision, (draft) => {
      Object.assign(draft, fields, { defaultAccountIds: [...new Set(fields.defaultAccountIds)] });
    });
  }

  #assertOwner(actor: PublishingActor): void {
    if (actor.kind !== 'human') throw forbidden(actor.kind === 'web' ? RP.desktopOnly() : RP.ownerOnly(), 'OWNER_REQUIRED');
  }

  /** Adds or renames a connection. Phase 1 accepts only "By hand" (`manual`). Saving with the ID of a removed connection restores it (Undo). */
  async saveConnection(input: { id?: Id; provider: PublishingProvider; name: string }, actor: PublishingActor): Promise<PublishingConnection> {
    this.#assertOwner(actor);
    if (!SUPPORTED_PUBLISHING_PROVIDERS.includes(input.provider)) {
      throw new RpcError('unsupported', RP.providerUnsupported(), { code: 'PROVIDER_UNSUPPORTED', provider: input.provider });
    }
    return this.store.transact((tx) => {
      const list = tx.connections();
      const existing = input.id ? list.find((c) => c.id === input.id) : undefined;
      if (existing) {
        if (existing.provider !== input.provider) throw invalid(RP.connectionProviderFixed(), 'CONNECTION_PROVIDER_FIXED');
        existing.name = input.name.trim();
        return publishingConnectionSchema.parse(existing);
      }
      const connection = publishingConnectionSchema.parse({ id: input.id ?? newId('pconn'), provider: input.provider, name: input.name.trim(), configured: true });
      list.push(connection);
      return connection;
    });
  }

  /** Removes a connection and its accounts. Refused while one of its accounts has a delivery that is not settled. */
  async removeConnection(connectionId: Id, actor: PublishingActor): Promise<{ connection: PublishingConnection; accounts: PublishingAccount[] }> {
    this.#assertOwner(actor);
    return this.store.transact((tx) => {
      const list = tx.connections();
      const connection = list.find((c) => c.id === connectionId);
      if (!connection) throw notFound(RP.connectionNotFound(), 'CONNECTION_NOT_FOUND');
      const accounts = tx.accounts();
      const removed = accounts.filter((a) => a.connectionId === connectionId);
      for (const account of removed) this.#assertAccountFree(account);
      list.splice(list.indexOf(connection), 1);
      this.#dropAccounts(tx, removed.map((a) => a.id));
      return { connection, accounts: removed };
    });
  }

  /** Adds or changes an account (name, handle, disabled). Saving an account also marks it connected again. Saving a removed account's ID restores it. */
  async saveAccount(
    input: { id?: Id; connectionId: Id; network: PublishingNetwork; name: string; remoteId: string; disabled?: boolean },
    actor: PublishingActor,
  ): Promise<PublishingAccount> {
    this.#assertOwner(actor);
    return this.store.transact((tx) => {
      if (!this.store.connections().some((c) => c.id === input.connectionId)) throw notFound(RP.connectionNotFound(), 'CONNECTION_NOT_FOUND');
      const accounts = tx.accounts();
      const remoteId = input.remoteId.trim();
      if (accounts.some((a) => a.id !== input.id && a.connectionId === input.connectionId && a.network === input.network && a.remoteId === remoteId)) {
        throw conflict(RP.accountDuplicate(), 'ACCOUNT_DUPLICATE');
      }
      const existing = input.id ? accounts.find((a) => a.id === input.id) : undefined;
      if (existing) {
        if (existing.connectionId !== input.connectionId || existing.network !== input.network) throw invalid(RP.accountIdentityFixed(), 'ACCOUNT_IDENTITY_FIXED');
        Object.assign(existing, { name: input.name.trim(), remoteId, needsReconnect: false, ...(input.disabled !== undefined ? { disabled: input.disabled } : {}) });
        return publishingAccountSchema.parse(existing);
      }
      const account = publishingAccountSchema.parse({
        id: input.id ?? newId('pacct'),
        connectionId: input.connectionId,
        network: input.network,
        name: input.name.trim(),
        remoteId,
        disabled: input.disabled ?? false,
      });
      accounts.push(account);
      return account;
    });
  }

  async removeAccount(accountId: Id, actor: PublishingActor): Promise<PublishingAccount> {
    this.#assertOwner(actor);
    return this.store.transact((tx) => {
      const account = tx.accounts().find((a) => a.id === accountId);
      if (!account) throw notFound(RP.accountNotFound(), 'ACCOUNT_NOT_FOUND');
      this.#assertAccountFree(account);
      this.#dropAccounts(tx, [accountId]);
      return account;
    });
  }

  /** Links an account to the canonical account it is the same identity as (another route), or unlinks it (agentcut rules). */
  async linkAccount(accountId: Id, equivalentTo: Id | null, actor: PublishingActor): Promise<PublishingAccount> {
    this.#assertOwner(actor);
    return this.store.transact((tx) => {
      const accounts = tx.accounts();
      const account = accounts.find((a) => a.id === accountId);
      if (!account) throw notFound(RP.accountNotFound(), 'ACCOUNT_NOT_FOUND');
      if (equivalentTo) {
        const target = accounts.find((a) => a.id === equivalentTo);
        if (!target) throw notFound(RP.accountNotFound(), 'ACCOUNT_NOT_FOUND');
        if (target.id === account.id || target.network !== account.network || target.equivalentTo) throw invalid(RP.linkInvalid(), 'LINK_INVALID');
        if (accounts.some((a) => a.equivalentTo === account.id)) throw invalid(RP.linkCanonical(), 'LINK_CANONICAL');
      }
      account.equivalentTo = equivalentTo;
      return publishingAccountSchema.parse(account);
    });
  }

  #assertAccountFree(account: PublishingAccount): void {
    const busy = this.store.read((doc) =>
      doc.publications.some(
        (p) =>
          !p.archived &&
          p.destinations.some((d) => d.accountId === account.id && (d.state === 'scheduled' || UNSETTLED_DELIVERY_STATES.includes(d.state))),
      ),
    );
    if (busy) throw conflict(RP.accountInUse({ name: account.name }), 'ACCOUNT_IN_USE');
  }

  /** Removes accounts, unlinks routes linked to them and drops them from the default accounts. */
  #dropAccounts(tx: PublishingTransaction, ids: Id[]): void {
    if (!ids.length) return;
    const accounts = tx.accounts();
    for (let i = accounts.length - 1; i >= 0; i--) if (ids.includes(accounts[i]!.id)) accounts.splice(i, 1);
    for (const a of accounts) if (a.equivalentTo && ids.includes(a.equivalentTo)) a.equivalentTo = null;
    if (this.store.settings().defaultAccountIds.some((id) => ids.includes(id))) {
      const settings = tx.settings();
      settings.defaultAccountIds = settings.defaultAccountIds.filter((id) => !ids.includes(id));
    }
  }

  // ---- Due by-hand deliveries ----

  /**
   * Emits `due` once per destination and publication revision for by-hand destinations waiting for the owner whose time arrived (or that were sent
   * with no time).
   */
  dueTick(): void {
    if (this.#closed) return;
    const now = this.#now().getTime();
    const live = new Set<string>();
    const due: PublishingEvent[] = [];
    this.store.read((doc) => {
      for (const p of doc.publications) {
        if (p.archived) continue;
        for (const d of p.destinations) {
          if (d.state !== 'queued' || this.#provider(d.accountId) !== 'manual') continue;
          const key = `${p.id}:${d.id}@${p.revision}`;
          live.add(key);
          const at = d.payload?.scheduledAt ?? intendedTime(p, d);
          if (this.#dueSent.has(key) || (at && Date.parse(at) > now)) continue;
          this.#dueSent.add(key);
          due.push({ type: 'due', publicationId: p.id, destinationId: d.id, at: at ?? new Date(now).toISOString() });
        }
      }
    });
    for (const key of this.#dueSent) if (!live.has(key)) this.#dueSent.delete(key);
    for (const event of due) this.topic.publish(event);
  }

  // ---- Internal ----

  #provider(accountId: Id): PublishingProvider | null {
    return this.store.read((doc) => {
      const account = doc.accounts.find((a) => a.id === accountId);
      return doc.connections.find((c) => c.id === account?.connectionId)?.provider ?? null;
    });
  }

  #assertActive(p: Publication): void {
    if (p.archived) throw conflict(RP.publicationArchived(), 'PUBLICATION_ARCHIVED');
  }

  /** Refuses a time closer than the minimum spacing to another publication on the same real account (`SLOT_TAKEN`). */
  #checkReservations(p: Publication): void {
    const { accounts, occupancy } = this.store.read((doc) => ({ accounts: doc.accounts, occupancy: publicationOccupancy(doc.publications, doc.accounts, p.id) }));
    const found = findReservationConflict(p, accounts, occupancy, this.store.settings().minGapMinutes);
    if (found) {
      const name = accounts.find((a) => a.id === found.accountId)?.name ?? found.accountId;
      throw conflict(RP.slotTaken({ account: name }), 'SLOT_TAKEN', { destinationId: found.destinationId, accountId: found.accountId });
    }
  }

  #published(commit: PublishingCommit): void {
    if (this.#closed) return;
    for (const p of commit.publications) {
      this.topic.publish(this.#inSnapshot(p) ? { type: 'publication.upserted', row: this.row(p) } : { type: 'publication.removed', publicationId: p.id });
    }
    for (const publicationId of commit.removed) this.topic.publish({ type: 'publication.removed', publicationId });
    if (commit.settings) this.topic.publish({ type: 'settings.updated', settings: commit.settings });
    if (commit.connections || commit.accounts) {
      this.topic.publish({ type: 'connections.updated', connections: this.store.connections(), accounts: this.store.accounts() });
    }
  }
}

function localized(message: Localized): { error: string; errorRef: MessageRef } {
  return { error: message.text, errorRef: refOf(message) };
}

function newDestination(account: PublishingAccount): PublicationDestination {
  return publicationDestinationSchema.parse({ id: newId('pdest'), accountId: account.id, format: defaultPublishingFormat(account.network) });
}

function destination(p: Publication, destinationId: Id): PublicationDestination {
  const d = p.destinations.find((item) => item.id === destinationId);
  if (!d) throw notFound(RP.destinationNotFound(), 'DESTINATION_NOT_FOUND');
  return d;
}

/** Clears a destination's frozen payload, keeping the replaced one in the history. */
function clearPayload(tx: PublishingTransaction, p: Publication, d: PublicationDestination): void {
  if (d.payload) tx.addHistory({ publicationId: p.id, destinationId: d.id, payload: d.payload, replacedAt: tx.now.toISOString() });
  d.payload = null;
  d.payloadHash = null;
}

function assertPinnable(p: Publication): void {
  if (p.destinations.some((d) => !isEditableDelivery(d.state))) throw conflict(RP.pinLocked(), 'PUBLICATION_LOCKED');
}

/** Pins an export on a publication: records it, clears the render job and every unsent payload. Approval stays with the export it named. */
function applyPin(tx: PublishingTransaction, p: Publication, pinned: PinnedExport): void {
  const exports = tx.exports();
  if (!exports.some((e) => e.id === pinned.id)) exports.push(pinned);
  p.exportId = pinned.id;
  p.pinJob = null;
  for (const d of p.destinations) if (isEditableDelivery(d.state)) clearPayload(tx, p, d);
}


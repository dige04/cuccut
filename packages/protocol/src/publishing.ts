import type { Id } from './domain.ts';
import type { MessageRef } from './message-ref.ts';

/**
 * Publishing: planned releases of finished videos (design `docs/cuccut/m2-publishing.md` §3).
 *
 * One Publication is one release of one video (`videoId` + `sequenceId`) to N destinations, one per account. Publishing never edits the video; its
 * records live in the Runtime's publishing store (`store/publishing.json`). Delivery is never automatic: a human sends, or a human authorizes the exact
 * revision for an agent to send, and any revision change voids that authorization.
 *
 * This module holds the types and constants (browser-safe, no zod). The inbound zod schemas are in `publishing-schemas.ts` (exported through
 * `@cuccut/protocol/schemas`), and the pure logic shared by the UI and the Runtime is in `publishing/*.ts` (re-exported by the package index;
 * `publishing/transfer.ts` needs zod and is exported through `@cuccut/protocol/schemas` only).
 *
 * Timestamps are ISO 8601 strings. Scheduled times always carry their UTC offset; the publication's `timezone` is the IANA zone they were chosen in.
 */

/** Networks a publication can go to. Network icons in the UI are generic, never brand logos. */
export const PUBLISHING_NETWORKS = ['youtube', 'instagram', 'tiktok'] as const;
export type PublishingNetwork = (typeof PUBLISHING_NETWORKS)[number];

/**
 * Delivery routes. Phase 1 builds only `manual` ("By hand": the owner posts in the network's app and records the result). The others are designed and
 * accepted by the types so stored records stay readable, but the Runtime refuses them (`PROVIDER_UNSUPPORTED`) until their phase lands.
 */
export const PUBLISHING_PROVIDERS = ['manual', 'postbridge', 'postgun', 'iphone'] as const;
export type PublishingProvider = (typeof PUBLISHING_PROVIDERS)[number];
/** Routes this version can deliver through. */
export const SUPPORTED_PUBLISHING_PROVIDERS: readonly PublishingProvider[] = ['manual'];

export const PUBLISHING_FORMATS = ['youtube-video', 'youtube-short', 'instagram-reel', 'tiktok-video'] as const;
export type PublishingFormat = (typeof PUBLISHING_FORMATS)[number];

/** The network each format belongs to. */
export const FORMAT_NETWORK: Readonly<Record<PublishingFormat, PublishingNetwork>> = {
  'youtube-video': 'youtube',
  'youtube-short': 'youtube',
  'instagram-reel': 'instagram',
  'tiktok-video': 'tiktok',
};

/** The format a new destination starts with: the network's short-video format (a full YouTube video is chosen explicitly). */
export function defaultPublishingFormat(network: PublishingNetwork): PublishingFormat {
  switch (network) {
    case 'youtube':
      return 'youtube-short';
    case 'instagram':
      return 'instagram-reel';
    case 'tiktok':
      return 'tiktok-video';
  }
}

/**
 * Delivery state of one destination.
 *
 * - `not_sent`: editable; nothing was handed over. `failed`: a send ended without posting; editable again.
 * - `queued`: Send froze the payload. For by-hand destinations this reads "Waiting for you"; for API routes (phase 2) the runner picks it up.
 * - `sending`: an API call is in progress (phase 2). `scheduled` / `published`: confirmed by the provider or recorded by the owner.
 * - `unknown`: the result could not be confirmed; the owner records what happened before any retry. `cancel_pending` / `cancelled`: cancellation.
 */
export const DELIVERY_STATES = ['not_sent', 'queued', 'sending', 'scheduled', 'published', 'failed', 'unknown', 'cancel_pending', 'cancelled'] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

/** States whose destination may still change its content, account, format and time. */
export const EDITABLE_DELIVERY_STATES: readonly DeliveryState[] = ['not_sent', 'failed'];
/** States where a delivery is underway or its outcome is not settled: another release to the same account waits for them. */
export const UNSETTLED_DELIVERY_STATES: readonly DeliveryState[] = ['queued', 'sending', 'unknown', 'cancel_pending'];
/** States a calendar import turns into `unknown`: a transferred queue never starts a delivery. */
export const IN_FLIGHT_DELIVERY_STATES: readonly DeliveryState[] = ['queued', 'sending', 'cancel_pending'];

export function isEditableDelivery(state: DeliveryState): boolean {
  return EDITABLE_DELIVERY_STATES.includes(state);
}

/** Derived status of a whole publication (`publicationStatus`, in agentcut's order). */
export const PUBLICATION_STATUSES = ['draft', 'approved', 'pending', 'publishing', 'scheduled', 'published', 'partial', 'attention', 'cancelled'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Composed caption limits in code points, per network. */
export const CAPTION_LIMITS: Readonly<Record<PublishingNetwork, number>> = { youtube: 5000, instagram: 2200, tiktok: 2200 };
/** YouTube title length limit in code points. */
export const YOUTUBE_TITLE_LIMIT = 100;
/** YouTube metadata tags limit (characters, counted as YouTube does: separators, and quotes around tags with spaces). */
export const YOUTUBE_TAGS_LIMIT = 500;
/** YouTube classifies square or vertical uploads up to this length as Shorts, and Shorts may not be longer. */
export const SHORTS_MAX_SECONDS = 180;

/** Shared text of a publication. Hashtags are stored without the leading `#` and without spaces. */
export interface PublicationCopy {
  title: string;
  description: string;
  hashtags: string[];
}

/** Per-destination text. `null` inherits the shared text; an empty string or list clears it for this destination. */
export interface PublicationOverrides {
  title: string | null;
  description: string | null;
  hashtags: string[] | null;
}

export type PublicationPrivacy = 'public' | 'private' | 'unlisted';

/** Network options of one destination. Each route either applies a selection or reports it as an issue; nothing is silently dropped. */
export interface DestinationOptions {
  /** Accept the route's own configured audience and visibility (Postbridge on YouTube). */
  useProviderDefaults: boolean;
  privacy: PublicationPrivacy;
  /** YouTube audience. `null` = not chosen yet (required before sending to YouTube). */
  madeForKids: boolean | null;
  /** Disclose synthetic (AI-altered) media. */
  synthetic: boolean;
  /** Paid partnership / branded content. */
  branded: boolean;
  /** Promotes the owner's own brand. */
  ownBrand: boolean;
  comments: boolean;
  duet: boolean;
  stitch: boolean;
  /** YouTube metadata tags. */
  tags: string[];
}

/** The options of a new destination (the defaults `destinationOptionsSchema` fills in). */
export const DESTINATION_OPTION_DEFAULTS: Readonly<DestinationOptions> = Object.freeze({
  useProviderDefaults: false,
  privacy: 'public',
  madeForKids: null,
  synthetic: false,
  branded: false,
  ownBrand: false,
  comments: true,
  duet: false,
  stitch: false,
  tags: [],
});

/** A destination account: a channel or profile reached through one connection. */
export interface PublishingAccount {
  id: Id;
  connectionId: Id;
  /** Exact handle or channel ID on the network. */
  remoteId: string;
  network: PublishingNetwork;
  name: string;
  disabled: boolean;
  /** Imported from another computer or lost its credentials: must be connected again before sending. */
  needsReconnect: boolean;
  /**
   * Another account on the same network that is the same real identity reached through another route. Spacing and duplicate checks use the
   * canonical account (`equivalentTo ?? id`). The canonical account itself has `equivalentTo: null`.
   */
  equivalentTo: Id | null;
}

/** A delivery route. Never holds a key: credentials live in the credential store (phase 2, `publish:<connectionId>`). */
export interface PublishingConnection {
  id: Id;
  provider: PublishingProvider;
  name: string;
  /** API base URL (phase 2); empty for `manual`. */
  baseUrl: string;
  /** Ready to deliver (a `manual` connection always is). */
  configured: boolean;
  checkedAt: string | null;
  error: string | null;
  errorRef: MessageRef | null;
}

/**
 * An immutable copy of a finished MP4 export, kept under `publishing/exports/<sha256>.mp4`. `id` is `sha256:<hex>`. The facts come from the export
 * job (`ExportJobInfo`) and its validated output (`GeneratedOutput.media`).
 */
export interface PinnedExport {
  id: Id;
  videoId: Id;
  sequenceId: Id;
  /** The video revision the export was rendered from (`ExportJobInfo.videoRevision`). */
  videoRevision: string;
  /** The sequence's own revision, when the Runtime knows it. */
  sequenceRevision: string | null;
  jobId: Id;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number;
  /** Frame rate as `num/den` (`30/1`), when known. */
  fps: string | null;
  codec: string;
  createdAt: string;
}

/** The frozen content of one destination at Send. Its hash identifies what was authorized and delivered. */
export interface ResolvedPayload {
  exportId: Id;
  accountId: Id;
  connectionId: Id;
  remoteAccountId: string;
  network: PublishingNetwork;
  format: PublishingFormat;
  title: string;
  caption: string;
  hashtags: string[];
  options: DestinationOptions;
  scheduledAt: string | null;
  timezone: string;
}

/** One account a publication goes to. */
export interface PublicationDestination {
  id: Id;
  accountId: Id;
  format: PublishingFormat;
  overrides: PublicationOverrides;
  options: DestinationOptions;
  /** This destination's own time; `null` uses the publication's default time. */
  scheduledAt: string | null;
  state: DeliveryState;
  payload: ResolvedPayload | null;
  payloadHash: string | null;
  remoteId: string | null;
  remoteUrl: string | null;
  /** The time the network confirmed it will publish (scheduled in its app or by the provider). */
  confirmedAt: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  error: string | null;
  errorRef: MessageRef | null;
  /** Evidence identifiers (phase 3, attended phone route). */
  evidence: string[];
  /** The owner's last recorded observation of this destination (`publishing.reconcile`). */
  verification: DestinationVerification | null;
}

/** What the owner checked in the network's app and recorded. */
export interface DestinationVerification {
  state: DeliveryState;
  /** What the owner verified, in their words (at least 10 characters). */
  note: string;
  /** Who recorded it (the principal name). */
  by: string;
  at: string;
}

/** Results the owner can record after checking the network's app (`publishing.reconcile`). */
export const RECONCILE_STATES = ['published', 'scheduled', 'cancelled', 'not_sent'] as const;
export type ReconcileState = (typeof RECONCILE_STATES)[number];

/** Who approved which pinned export. A publication is approved only while `approval.exportId === exportId`. */
export interface PublicationApproval {
  exportId: Id;
  by: 'human' | 'agent';
  /** Who acted: the session or principal name, for the record. */
  actor: string;
  at: string;
}

/** The owner authorized this exact revision for an agent to send. Valid only while `revision` equals the publication's revision. */
export interface PublicationAuthorization {
  revision: number;
  at: string;
}

/** The export job a "Render and pin" started. `error` is set when the job failed or its output could not be pinned. */
export interface PublicationPinJob {
  jobId: Id;
  at: string;
  error: string | null;
  errorRef: MessageRef | null;
}

/** A text proposal waiting for the owner (from a text-model job or an agent). Never applied by itself. */
export interface PublicationProposal {
  /** The publication revision the proposal was written for. */
  revision: number;
  copy: PublicationCopy;
  reason: string;
  jobId: Id | null;
  at: string;
}

/** A "Propose text" request that finished without a usable answer. */
export interface PublicationProposalError {
  jobId: Id | null;
  error: string;
  errorRef: MessageRef | null;
  at: string;
}

export interface Publication {
  id: Id;
  videoId: Id;
  sequenceId: Id;
  /** The project the video belonged to at prepare time; null for videos outside projects. */
  projectId: Id | null;
  /** The video's name at prepare time (shown when the video is not on this computer). */
  videoName: string;
  label: string;
  copy: PublicationCopy;
  /** Default publication time for destinations without their own. */
  scheduledAt: string | null;
  timezone: string;
  /** Higher first when planning slots. */
  priority: number;
  /** The content must go out before this time. */
  expiresAt: string | null;
  /** The pinned export (`PinnedExport.id`), or null before one is pinned. */
  exportId: Id | null;
  approval: PublicationApproval | null;
  authorization: PublicationAuthorization | null;
  proposal: PublicationProposal | null;
  /** The last "Propose text" request whose answer could not be used (cleared by the next proposal). Like `proposal`, it does not raise the revision. */
  proposalError: PublicationProposalError | null;
  /** A "Render and pin" export in progress or the reason it failed; null when none was asked for. Cleared when an export is pinned. */
  pinJob: PublicationPinJob | null;
  destinations: PublicationDestination[];
  /** Increments on every change; every write names the revision it read. */
  revision: number;
  createdAt: string;
  updatedAt: string;
  /** Where the publication came from (for example a shorts batch), for the record. */
  origin: string | null;
  archived: boolean;
  archivedAt: string | null;
}

/** A weekly time for automatic slots. `weekday` 0 = Sunday … 6 = Saturday (as `Date#getUTCDay`); `time` is `HH:MM` in the workspace timezone. */
export interface PublishingSlot {
  weekday: number;
  time: string;
}

export interface PublishingSettings {
  /** Workspace timezone (IANA). The default is the Runtime's system zone at the first write. */
  timezone: string;
  slots: PublishingSlot[];
  /** Minimum distance between two posts to the same real account. */
  minGapMinutes: number;
  /** A slot must be at least this far in the future. */
  leadMinutes: number;
  defaultAccountIds: Id[];
  /** Writing guidance for proposed text. */
  writing: string;
  /** Prepare text and reserve times for generated clips. */
  autoPrepare: boolean;
  /** Archived publications (and their pinned exports) are kept this many days. */
  archivedRetentionDays: number;
  revision: number;
}

export const PUBLISHING_SETTINGS_DEFAULTS: Readonly<Omit<PublishingSettings, 'timezone'>> = {
  slots: [],
  minGapMinutes: 60,
  leadMinutes: 30,
  defaultAccountIds: [],
  writing: '',
  autoPrepare: false,
  archivedRetentionDays: 90,
  revision: 0,
};

/** One problem found by validation. `code` is the issue catalog key (`publishingIssues.<code>`); `message` renders it in the reader's language. */
export interface PublicationIssue {
  destinationId: Id | null;
  /** The field the problem is about (`approval`, `export`, `accounts`, `timezone`, `account`, `format`, `title`, `description`, `audience`, `options`, `tags`, `video`, `time`, `expiry`, `delivery`). */
  field: string;
  code: string;
  params?: Record<string, string | number>;
  message: MessageRef;
}

/** What the store and the UI read about a publication. */
export type PublicationDetail = Publication & {
  status: PublicationStatus;
  /** The pinned export is the approved one. */
  approved: boolean;
  /** The video is on this computer. */
  videoAvailable: boolean;
  currentVideoRevision: string | null;
  /** The video changed after the pinned export was rendered. */
  newerEdit: boolean;
  export: PinnedExport | null;
  issues: PublicationIssue[];
};

/** A destination as the calendar index shows it. `at` is its calendar instant (`calendarInstant`). */
export interface PublicationRowDestination {
  id: Id;
  accountId: Id;
  format: PublishingFormat;
  state: DeliveryState;
  /** The destination's own time (`null` uses the publication's default time); Undo of a calendar move restores it. */
  scheduledAt: string | null;
  at: string | null;
}

/** The calendar index entry of a publication (topic snapshot and `publishing.calendar`). */
export interface PublicationRow {
  id: Id;
  videoId: Id;
  projectId: Id | null;
  label: string;
  status: PublicationStatus;
  archived: boolean;
  revision: number;
  scheduledAt: string | null;
  timezone: string;
  priority: number;
  expiresAt: string | null;
  /** The pinned export (`PinnedExport.id`) the entry's thumbnail shows; absent before one is pinned. */
  exportPosterId?: Id;
  /** When the latest proposal (or proposal failure) was stored; such a write keeps the revision, so an open dialog refetches on this. */
  proposalAt?: string;
  destinations: PublicationRowDestination[];
}

/** A destination as the update method receives it. Omitted fields keep the existing destination's values (or the defaults for a new one). */
export interface DestinationInput {
  /** Existing destination; omitted for a new one. */
  id?: Id;
  accountId: Id;
  format: PublishingFormat;
  overrides?: Partial<PublicationOverrides>;
  options?: Partial<DestinationOptions>;
  scheduledAt?: string | null;
}

// ---- Scheduling ----

/** A time already taken on a (canonical) account. */
export interface SlotOccupancy {
  accountId: Id;
  at: string;
  publicationId: Id;
}

export interface SlotRequest {
  publicationId: Id;
  /** Canonical account IDs (`equivalentTo ?? id`). */
  accountIds: Id[];
  priority: number;
  expiresAt: string | null;
}

export interface SlotPlan {
  placements: Array<{ publicationId: Id; at: string }>;
  unavailable: Array<{ publicationId: Id; reason: MessageRef }>;
}

/** A destination's new time on the calendar; `null` clears it (the destination falls back to the default time). */
export interface CalendarPlacement {
  destinationId: Id;
  at: string | null;
}

export const CALENDAR_VIEWS = ['month', 'week', 'agenda'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** Drag-and-drop MIME type for calendar entries. */
export const CALENDAR_DRAG_TYPE = 'application/x-cuccut-publication';

// ---- Calendar transfer ----

export const CALENDAR_ARCHIVE_FORMAT = 'cuccut-calendar';

/** A calendar file. Carries records only: never credentials, delivery authorizations, payloads, pinned export IDs or local paths. */
export interface CalendarArchive {
  format: typeof CALENDAR_ARCHIVE_FORMAT;
  version: 1;
  exportedAt: string;
  timezone: string;
  publications: Publication[];
  accounts: Array<Pick<PublishingAccount, 'id' | 'connectionId' | 'remoteId' | 'network' | 'name' | 'equivalentTo'>>;
  connections: Array<Pick<PublishingConnection, 'id' | 'provider' | 'name'>>;
}

export interface CalendarImportPreview {
  total: number;
  added: number;
  skipped: number;
  /** Accounts that are new on this computer and must be connected before sending. */
  reconnect: number;
  /** Added publications whose video is not on this computer. */
  missingVideos: number;
  /** Added publications with deliveries that were in progress when exported (they become `unknown`). */
  uncertain: number;
  timezone: string;
  firstDay: string | null;
}

// ---- Store document ----

export interface PublishingHistoryEntry {
  publicationId: Id;
  destinationId: Id;
  payload: ResolvedPayload;
  replacedAt: string;
}

export interface PublishingImportRecord {
  id: Id;
  at: string;
  added: Id[];
  /** Backup file written before the import (relative to the publishing directory). */
  backup: string;
}

/** The publishing store document, `store/publishing.json`. */
export interface PublishingFileV1 {
  schemaVersion: 1;
  settings: PublishingSettings;
  connections: PublishingConnection[];
  accounts: PublishingAccount[];
  /** Archived ones included. */
  publications: Publication[];
  exports: PinnedExport[];
  /** Payloads replaced by a later send or edit, newest last (capped at `PUBLISHING_HISTORY_LIMIT`). */
  history: PublishingHistoryEntry[];
  imports: PublishingImportRecord[];
}

export const PUBLISHING_SCHEMA_VERSION = 1;
export const PUBLISHING_HISTORY_LIMIT = 2000;

// ---- Topic ----

export interface PublishingSnapshot {
  settings: PublishingSettings;
  connections: PublishingConnection[];
  accounts: PublishingAccount[];
  /** Non-archived publications, plus archived ones from the last 30 days. */
  publications: PublicationRow[];
  /** Why publishing is read-only or unavailable, or null. */
  degraded: MessageRef | null;
}

export type PublishingEvent =
  | { type: 'publication.upserted'; row: PublicationRow }
  | { type: 'publication.removed'; publicationId: Id }
  | { type: 'settings.updated'; settings: PublishingSettings }
  | { type: 'connections.updated'; connections: PublishingConnection[]; accounts: PublishingAccount[] }
  | { type: 'due'; publicationId: Id; destinationId: Id; at: string };

/** Archived publications stay in the topic snapshot this many days after archiving. */
export const PUBLISHING_SNAPSHOT_ARCHIVED_DAYS = 30;

// ---- RPC (`publishing.*`, design §4.3) ----

/** Most days one `publishing.calendar` query covers. */
export const PUBLISHING_CALENDAR_MAX_DAYS = 93;
/** Most rows one `publishing.calendar` page returns. */
export const PUBLISHING_CALENDAR_MAX_LIMIT = 200;
/** Most videos one `publishing.prepare` call prepares. */
export const PUBLISHING_PREPARE_MAX = 50;
/** Most items one `publishing.batch` call handles. */
export const PUBLISHING_BATCH_MAX = 50;

/** `publishing.calendar`: civil dates `from`..`to` (inclusive) in the workspace timezone. Filters apply before pagination. */
export interface PublishingCalendarParams {
  from: string;
  to: string;
  /** Only this project's publications (`null`: videos outside projects). */
  projectId?: Id | null;
  /** Only publications going to one of these accounts. */
  accountIds?: Id[];
  statuses?: PublicationStatus[];
  /** Also list publications with a destination that has no time (the Unscheduled inbox). Default true. */
  includeUnscheduled?: boolean;
  offset?: number;
  limit?: number;
}

export interface PublishingCalendarResult {
  publications: PublicationRow[];
  /** Total matching rows before pagination. */
  total: number;
  nextOffset: number | null;
}

export interface PublishingPrepareParams {
  videoIds: Id[];
  /** The sequence to publish; default each video's main sequence. */
  sequenceId?: Id;
  /** Accounts for new publications; default the settings' default accounts. */
  accountIds?: Id[];
  /** Prepare a new release even when the video already has one that is not archived. */
  repeat?: boolean;
  /** Where the request came from (for example `shorts`), kept on new publications for the record. */
  origin?: string;
}

export interface PublicationPatch {
  label?: string;
  copy?: PublicationCopy;
  scheduledAt?: string | null;
  timezone?: string;
  priority?: number;
  expiresAt?: string | null;
}

export interface PublishingUpdateParams {
  publicationId: Id;
  revision: number;
  patch: PublicationPatch;
  /** The full destination list; omitted keeps the destinations as they are. */
  destinations?: DestinationInput[];
}

export interface PublishingSlotsParams {
  publicationIds: Id[];
  /** First civil day to consider (workspace timezone); default today. */
  from?: string;
  /** Days to look ahead; default 30, at most `SLOT_PLAN_MAX_DAYS`. */
  days?: number;
  /** Write the planned times (each publication's default time). Needs `revisions`. */
  reserve?: boolean;
  /** The revision read for each publication (required to reserve). */
  revisions?: Record<Id, number>;
}

export interface PublishingSlotsResult extends SlotPlan {
  /** The reserved publications as saved (only when `reserve`). */
  publications: PublicationDetail[];
}

/** A finished MP4 export of a video that `publishing.pin` can pin. */
export interface PinnableExport {
  jobId: Id;
  videoId: Id;
  sequenceId: Id;
  videoRevision: string;
  /** Rendered from the video's current revision (false: the video changed since; null: the current revision is not known). */
  current: boolean | null;
  fileName: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number;
  fps: string | null;
  codec: string;
  createdAt: string;
}

export type PublishingPinSource = { jobId: Id } | { render: true };

export interface PublishingBatchItemResult {
  publicationId: Id;
  ok: boolean;
  publication?: PublicationDetail;
  error?: { code: string; message: string; messageRef?: MessageRef; details?: unknown };
}

export interface PublishingReconcileParams {
  publicationId: Id;
  revision: number;
  destinationId: Id;
  state: ReconcileState;
  remoteUrl: string | null;
  /** When it was published, or the time the network confirmed it will publish (required for `scheduled`). */
  at: string | null;
  /** What the owner verified (at least 10 characters). */
  note: string;
}

/** What `publishing.cleanup` removed (or, with `dryRun`, would remove). */
export interface PublishingCleanupResult {
  /** Archived publications older than the retention setting, deleted for good. */
  publications: number;
  /** Pinned export files no publication uses any more. */
  files: number;
  bytes: number;
}

/**
 * What removing a connection or an account changed besides the accounts themselves, so Undo can put it back: the removed accounts' places in the
 * default accounts and the links of other accounts that pointed at them.
 */
export interface PublishingRemovedRefs {
  /** The default accounts as they were before the removal (empty when none of the removed accounts was a default). */
  defaultAccountIds: Id[];
  /** Other accounts that were linked to a removed account, with the account they pointed at. */
  links: Array<{ accountId: Id; equivalentTo: Id }>;
}

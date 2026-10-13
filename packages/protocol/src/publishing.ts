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
}

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

/** A text proposal waiting for the owner (from a text-model job or an agent). Never applied by itself. */
export interface PublicationProposal {
  /** The publication revision the proposal was written for. */
  revision: number;
  copy: PublicationCopy;
  reason: string;
  jobId: Id | null;
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
  exportPosterId?: Id;
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

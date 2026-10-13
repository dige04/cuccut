import { refOf, type Localized } from '../message-ref.ts';
import { PublishingIssues as PI } from '../messages/protocol/publishing-issues.ts';
import {
  CALENDAR_ARCHIVE_FORMAT,
  IN_FLIGHT_DELIVERY_STATES,
  type CalendarArchive,
  type CalendarImportPreview,
  type Publication,
  type PublishingAccount,
  type PublishingConnection,
} from '../publishing.ts';
import { calendarArchiveSchema, publishingAccountSchema, publishingConnectionSchema } from '../publishing-schemas.ts';
import { RpcError } from '../wire.ts';
import { calendarInstant, dayInZone, isValidTimezone } from './resolve.ts';
import { isOffsetTimestamp } from './time-field.ts';

/**
 * Calendar transfer (`cuccut-calendar` v1; port of agentcut `lib/calendar-transfer.ts` and the checks of `server/calendar-transfer.ts`). Pure: the
 * Runtime supplies the local state, writes the backup and applies the result.
 *
 * A calendar file carries records only. Export strips payloads, payload hashes, evidence, pinned export IDs, approvals, agent authorizations and
 * proposals; import is append-only (existing publication IDs are skipped), new accounts must be connected again, and deliveries that were in progress
 * become `unknown` so a transferred queue never starts a delivery.
 *
 * Every refusal is `RpcError('invalid-request')` with `details.code` `CALENDAR_INVALID` and a `publishingIssues` message.
 */

function refuse(message: Localized): never {
  throw new RpcError('invalid-request', message, { code: 'CALENDAR_INVALID' });
}

/** A publication as it travels in a calendar file. */
export function portableCalendarPublication(p: Publication): Publication {
  return {
    ...structuredClone(p),
    exportId: null,
    approval: null,
    authorization: null,
    proposal: null,
    proposalError: null,
    pinJob: null,
    destinations: p.destinations.map((d) => ({ ...structuredClone(d), payload: null, payloadHash: null, evidence: [] })),
  };
}

export interface CalendarExportInput {
  timezone: string;
  publications: readonly Publication[];
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  now?: Date;
}

/** Builds the calendar file of the whole store (all projects, archived publications included). */
export function buildCalendarArchive(input: CalendarExportInput): CalendarArchive {
  return {
    format: CALENDAR_ARCHIVE_FORMAT,
    version: 1,
    exportedAt: (input.now ?? new Date()).toISOString(),
    timezone: input.timezone,
    publications: input.publications.map(portableCalendarPublication),
    accounts: input.accounts.map(({ id, connectionId, remoteId, network, name, equivalentTo }) => ({ id, connectionId, remoteId, network, name, equivalentTo })),
    connections: input.connections.map(({ id, provider, name }) => ({ id, provider, name })),
  };
}

/** `cuccut-calendar-2026-10-13.json`. */
export function calendarArchiveFileName(now: Date = new Date()): string {
  return `cuccut-calendar-${now.toISOString().slice(0, 10)}.json`;
}

function unique(ids: readonly string[], message: () => Localized): void {
  if (ids.some((value) => !value.trim()) || new Set(ids).size !== ids.length) refuse(message());
}

/** Parses and checks a calendar file: shape, unique IDs, known timezones, connections and accounts that exist, valid links and dates. */
export function parseCalendarArchive(raw: unknown): CalendarArchive {
  const parsed = calendarArchiveSchema.safeParse(raw);
  if (!parsed.success) refuse(PI.archiveInvalid());
  const archive = parsed.data;
  unique(
    archive.publications.map((p) => p.id),
    () => PI.archiveDuplicatePublications(),
  );
  unique(
    archive.accounts.map((a) => a.id),
    () => PI.archiveDuplicateAccounts(),
  );
  unique(
    archive.connections.map((c) => c.id),
    () => PI.archiveDuplicateConnections(),
  );
  if (!isValidTimezone(archive.timezone)) refuse(PI.archiveTimezone({ timezone: archive.timezone }));
  for (const a of archive.accounts) {
    if (!archive.connections.some((c) => c.id === a.connectionId)) refuse(PI.archiveMissingConnection({ name: a.name }));
    if (
      a.equivalentTo &&
      !archive.accounts.some((other) => other.id === a.equivalentTo && other.id !== a.id && other.network === a.network && !other.equivalentTo)
    ) {
      refuse(PI.archiveLinkedAccount({ name: a.name }));
    }
  }
  for (const p of archive.publications) {
    if (!isValidTimezone(p.timezone)) refuse(PI.archiveTimezone({ timezone: p.timezone }));
    unique(
      p.destinations.map((d) => d.id),
      () => PI.archiveDuplicateDestinations({ label: p.label }),
    );
    unique(
      p.destinations.map((d) => d.accountId),
      () => PI.archiveDuplicateDestinations({ label: p.label }),
    );
    for (const d of p.destinations) {
      if (!archive.accounts.some((a) => a.id === d.accountId)) refuse(PI.archiveMissingAccount({ label: p.label }));
      for (const at of [d.confirmedAt, d.publishedAt, d.scheduledAt]) if (at && !isOffsetTimestamp(at)) refuse(PI.archiveInvalidDate({ label: p.label }));
    }
  }
  return archive;
}

/** What this computer already has, for an import preview. */
export interface CalendarImportLocal {
  /** Workspace timezone: `firstDay` is the first civil day in it. */
  timezone: string;
  publicationIds: ReadonlySet<string>;
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  /** Whether a video is on this computer. */
  videoAvailable: (videoId: string) => boolean;
}

export interface CalendarImportPlan {
  archive: CalendarArchive;
  preview: CalendarImportPreview;
  /** Publications to append, already made portable and with in-flight deliveries turned `unknown`. */
  publications: Publication[];
  /** Connections and accounts new on this computer (accounts need reconnecting). */
  connections: PublishingConnection[];
  accounts: PublishingAccount[];
}

/** A publication as an import appends it: in-flight deliveries become `unknown` with the reason, so they are reviewed before any retry. */
export function importedCalendarPublication(p: Publication): Publication {
  const out = portableCalendarPublication(p);
  for (const d of out.destinations) {
    if (!IN_FLIGHT_DELIVERY_STATES.includes(d.state)) continue;
    const message = PI.importedInFlight();
    d.state = 'unknown';
    d.error = message.text;
    d.errorRef = refOf(message);
  }
  return out;
}

/**
 * Checks a calendar file against this computer and plans the append-only import. Refuses a connection or account whose ID exists here with a different
 * identity (provider; connection, network or handle).
 */
export function inspectCalendarImport(raw: unknown, local: CalendarImportLocal): CalendarImportPlan {
  const archive = parseCalendarArchive(raw);
  for (const c of archive.connections) {
    const existing = local.connections.find((item) => item.id === c.id);
    if (existing && existing.provider !== c.provider) refuse(PI.importConnectionConflict({ name: c.name }));
  }
  for (const a of archive.accounts) {
    const existing = local.accounts.find((item) => item.id === a.id);
    if (existing && (existing.connectionId !== a.connectionId || existing.network !== a.network || existing.remoteId !== a.remoteId)) {
      refuse(PI.importAccountConflict({ name: a.name }));
    }
  }
  const entries = archive.publications.filter((p) => !local.publicationIds.has(p.id));
  const days = entries
    .filter((p) => !p.archived)
    .flatMap((p) =>
      p.destinations.flatMap((d) => {
        const at = calendarInstant(p, d);
        return at ? [dayInZone(at, local.timezone)] : [];
      }),
    )
    .sort();
  const connections = archive.connections
    .filter((c) => !local.connections.some((existing) => existing.id === c.id))
    .map((c) => publishingConnectionSchema.parse({ ...c, baseUrl: '', configured: c.provider === 'manual' }));
  const accounts = archive.accounts
    .filter((a) => !local.accounts.some((existing) => existing.id === a.id))
    .map((a) => publishingAccountSchema.parse({ ...a, disabled: false, needsReconnect: true }));
  const preview: CalendarImportPreview = {
    total: archive.publications.length,
    added: entries.length,
    skipped: archive.publications.length - entries.length,
    reconnect: accounts.length,
    missingVideos: entries.filter((p) => !local.videoAvailable(p.videoId)).length,
    uncertain: entries.filter((p) => p.destinations.some((d) => IN_FLIGHT_DELIVERY_STATES.includes(d.state))).length,
    timezone: archive.timezone,
    firstDay: days[0] ?? null,
  };
  return { archive, preview, publications: entries.map(importedCalendarPublication), connections, accounts };
}

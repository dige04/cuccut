import {
  calendarDates,
  calendarPeriodLabel,
  calendarTime,
  dayInZone,
  FORMAT_NETWORK,
  formatCivilDate,
  isEditableDelivery,
  localInstant,
  PUBLISHING_CALENDAR_MAX_LIMIT,
  RpcError,
  todayInZone,
  type CalendarPlacement,
  type CalendarView,
  type Id,
  type PublicationRow,
  type PublicationRowDestination,
  type PublicationStatus,
  type PublishingAccount,
  type PublishingConnection,
} from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { destinationRoute, networkLabel } from './publishing-labels.ts';

/**
 * The calendar page's view-model (design `docs/cuccut/m2-publishing.md` §2.3, port of agentcut `calendar-view.tsx` and `hooks/calendar-move.ts`).
 * Pure: it reads the `publishing` mirror and returns what the grid, the aside and the move flow show. Days are civil dates in the workspace
 * timezone, weeks start on Monday, and filters apply before pagination (the same rules as `publishing.calendar`).
 */

export interface CalendarFilters {
  /** Only publications going to this account; its destinations are the only ones shown. `''` = all accounts. */
  accountId: Id | '';
  status: PublicationStatus | '';
  /** Only this project's publications (`null`: videos outside projects). Omitted = all projects. */
  projectId?: Id | null;
}

export const NO_FILTERS: CalendarFilters = { accountId: '', status: '' };

export function hasFilters(filters: CalendarFilters): boolean {
  return !!(filters.accountId || filters.status);
}

/** Rows that pass the filters (archived ones never show on the calendar). */
export function filterRows(rows: readonly PublicationRow[], filters: CalendarFilters): PublicationRow[] {
  return rows.filter(
    (row) =>
      !row.archived &&
      (filters.projectId === undefined || row.projectId === filters.projectId) &&
      (!filters.accountId || row.destinations.some((d) => d.accountId === filters.accountId)) &&
      (!filters.status || row.status === filters.status),
  );
}

/** The destinations of a row the filters show (all of them, or the filtered account's). */
export function shownDestinations(row: PublicationRow, accountId: Id | ''): PublicationRowDestination[] {
  return accountId ? row.destinations.filter((d) => d.accountId === accountId) : row.destinations;
}

/** One publication on one day: the destinations that fall on that day, earliest first. */
export interface CalendarEntry {
  row: PublicationRow;
  destinations: PublicationRowDestination[];
  /** `HH:MM` of the earliest destination on this day. */
  time: string;
}

export interface CalendarDay {
  date: string;
  entries: CalendarEntry[];
  today: boolean;
  /** Outside the anchor's month (month view pads whole weeks). */
  outside: boolean;
}

/** A by-hand destination waiting for the owner whose time arrived. */
export interface DueEntry {
  row: PublicationRow;
  destination: PublicationRowDestination;
  account: PublishingAccount | null;
}

export interface CalendarModelInput {
  rows: readonly PublicationRow[];
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  timezone: string;
  anchor: string;
  view: CalendarView;
  filters: CalendarFilters;
  offset?: number;
  limit?: number;
  now?: number;
  /** BCP 47 tag for weekday headers and the period label. */
  locale?: string;
}

export interface CalendarModel {
  from: string;
  to: string;
  today: string;
  periodLabel: string;
  /** Monday-first weekday headers (short and long names). */
  weekdays: { short: string; long: string }[];
  /** Every day of the period; the agenda view keeps only days with entries. */
  days: CalendarDay[];
  /** The rows of this page that fall in the period. */
  page: PublicationRow[];
  /** Matching rows in the period, before pagination. */
  total: number;
  offset: number;
  nextOffset: number | null;
  previousOffset: number | null;
  unscheduled: PublicationRow[];
  attention: PublicationRow[];
  due: DueEntry[];
  hasFilters: boolean;
}

function dayOf(d: PublicationRowDestination, timezone: string): string | null {
  return d.at ? dayInZone(d.at, timezone) : null;
}

/** The calendar of a period. */
export function calendarModel(input: CalendarModelInput): CalendarModel {
  const { timezone, anchor, view, filters } = input;
  const now = input.now ?? Date.now();
  const today = todayInZone(timezone, now);
  const dates = calendarDates(anchor, view);
  const from = dates[0] ?? anchor;
  const to = dates[dates.length - 1] ?? anchor;
  const filtered = filterRows(input.rows, filters);
  const inPeriod = filtered.filter((row) =>
    shownDestinations(row, filters.accountId).some((d) => {
      const day = dayOf(d, timezone);
      return !!day && day >= from && day <= to;
    }),
  );
  const limit = Math.max(1, Math.min(input.limit ?? PUBLISHING_CALENDAR_MAX_LIMIT, PUBLISHING_CALENDAR_MAX_LIMIT));
  const offset = Math.max(0, Math.min(input.offset ?? 0, Math.max(0, inPeriod.length - 1)));
  const page = inPeriod.slice(offset, offset + limit);

  const byDay = new Map<string, CalendarEntry[]>();
  for (const row of page) {
    const groups = new Map<string, PublicationRowDestination[]>();
    for (const d of shownDestinations(row, filters.accountId)) {
      const day = dayOf(d, timezone);
      if (!day || day < from || day > to) continue;
      groups.set(day, [...(groups.get(day) ?? []), d]);
    }
    for (const [day, destinations] of groups) {
      destinations.sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));
      byDay.set(day, [...(byDay.get(day) ?? []), { row, destinations, time: calendarTime(destinations[0]!.at!, timezone) }]);
    }
  }
  for (const entries of byDay.values()) entries.sort((a, b) => Date.parse(a.destinations[0]!.at!) - Date.parse(b.destinations[0]!.at!));

  const month = anchor.slice(0, 7);
  const allDays = dates.map((date) => ({
    date,
    entries: byDay.get(date) ?? [],
    today: date === today,
    outside: view === 'month' && date.slice(0, 7) !== month,
  }));

  return {
    from,
    to,
    today,
    periodLabel: calendarPeriodLabel(anchor, view, input.locale),
    weekdays: dates.slice(0, 7).map((date) => ({
      short: formatCivilDate(date, input.locale, { weekday: 'short' }),
      long: formatCivilDate(date, input.locale, { weekday: 'long' }),
    })),
    days: view === 'agenda' ? allDays.filter((day) => day.entries.length > 0) : allDays,
    page,
    total: inPeriod.length,
    offset,
    nextOffset: offset + page.length < inPeriod.length ? offset + page.length : null,
    previousOffset: offset > 0 ? Math.max(0, offset - limit) : null,
    unscheduled: unscheduledRows(filtered, filters.accountId),
    attention: filtered.filter((row) => row.status === 'attention' || row.status === 'partial'),
    due: dueEntries(filtered, input.accounts, input.connections, now, filters.accountId),
    hasFilters: hasFilters(filters),
  };
}

/** Rows with a shown destination that has no time, or with no destination at all (the Unscheduled inbox). */
export function unscheduledRows(rows: readonly PublicationRow[], accountId: Id | '' = ''): PublicationRow[] {
  return rows.filter((row) => !row.archived && (!row.destinations.length || shownDestinations(row, accountId).some((d) => !d.at)));
}

/** By-hand destinations waiting for the owner whose time arrived (or that have none), oldest first. */
export function dueEntries(
  rows: readonly PublicationRow[],
  accounts: readonly PublishingAccount[],
  connections: readonly PublishingConnection[],
  now: number,
  accountId: Id | '' = '',
): DueEntry[] {
  const due: DueEntry[] = [];
  for (const row of rows) {
    if (row.archived) continue;
    for (const destination of shownDestinations(row, accountId)) {
      if (destination.state !== 'queued') continue;
      const route = destinationRoute(destination.accountId, accounts, connections);
      if (!route?.byHand) continue;
      if (destination.at && Date.parse(destination.at) > now) continue;
      due.push({ row, destination, account: route.account });
    }
  }
  const time = (entry: DueEntry) => (entry.destination.at ? Date.parse(entry.destination.at) : 0);
  return due.sort((a, b) => time(a) - time(b));
}

/** The anchor that shows `day`: unchanged when the current period already shows it. */
export function revealAnchor(anchor: string, view: CalendarView, day: string): string {
  return calendarDates(anchor, view).includes(day) ? anchor : day;
}

// ---- Moving ----

/**
 * Why a destination cannot be moved on the calendar, or null when it can. Only destinations not yet sent (or failed) move; the others say why, so the
 * per-row Move button can stay visible and disabled with its reason (rule: a disabled control says why).
 */
export function moveBlock(
  row: PublicationRow,
  destination: PublicationRowDestination,
  accounts: readonly PublishingAccount[],
  connections: readonly PublishingConnection[],
): string | null {
  if (row.archived) return PC.move.archived;
  if (isEditableDelivery(destination.state)) return null;
  switch (destination.state) {
    case 'scheduled': {
      const route = destinationRoute(destination.accountId, accounts, connections);
      const network = networkLabel(route?.account.network ?? FORMAT_NETWORK[destination.format]);
      return route?.byHand === false ? PC.move.confirmedRemote(network) : PC.move.confirmedByHand(network);
    }
    case 'queued':
      return PC.move.waiting;
    case 'sending':
    case 'cancel_pending':
      return PC.move.inFlight;
    case 'published':
      return PC.move.published;
    case 'unknown':
      return PC.move.unknown;
    case 'cancelled':
      return PC.move.cancelled;
    default:
      return PC.move.inFlight;
  }
}

/** An entry drags as a group when every destination it shows can move. */
export function canDrag(
  entry: Pick<CalendarEntry, 'row' | 'destinations'>,
  accounts: readonly PublishingAccount[],
  connections: readonly PublishingConnection[],
): boolean {
  return entry.destinations.length > 0 && entry.destinations.every((d) => moveBlock(entry.row, d, accounts, connections) === null);
}

/** What Undo of a move puts back: each moved destination's own time before the move (`null` = it used the default time). */
export interface MoveUndo {
  publicationId: Id;
  label: string;
  /** The day the publication was on before the move, to show it again after Undo. */
  day: string | null;
  placements: CalendarPlacement[];
}

/** {@link MoveUndo} with the revision the move saved; Undo names it, so a later change refuses the Undo instead of overwriting it. */
export interface CalendarUndo extends MoveUndo {
  revision: number;
}

export type MovePlan =
  | { kind: 'move'; placements: CalendarPlacement[]; undo: MoveUndo }
  /** Nothing changes (the same day and times). */
  | { kind: 'noop' }
  /** A destination has no time and none was given: open the move dialog. */
  | { kind: 'dialog' }
  | { kind: 'blocked'; reason: string }
  /** The chosen local time does not exist or happens twice (`LOCAL_TIME_GAP`, `LOCAL_TIME_FOLD`, …). */
  | { kind: 'error'; code: string; message: string };

/**
 * Plans moving destinations of a row to `day`. Without `time`, each keeps its own wall-clock time on the new day (agentcut `calendarPlacements`);
 * with `time`, all get that time.
 */
export function planMove(
  row: PublicationRow,
  destinationIds: readonly Id[],
  day: string,
  timezone: string,
  context: { accounts: readonly PublishingAccount[]; connections: readonly PublishingConnection[]; time?: string },
): MovePlan {
  const destinations = destinationIds.map((id) => row.destinations.find((d) => d.id === id));
  if (!destinations.length || destinations.some((d) => !d)) return { kind: 'blocked', reason: PC.move.missing };
  for (const d of destinations) {
    const reason = moveBlock(row, d!, context.accounts, context.connections);
    if (reason) return { kind: 'blocked', reason };
  }
  if (!context.time && destinations.some((d) => !d!.at)) return { kind: 'dialog' };
  let placements: CalendarPlacement[];
  try {
    placements = destinations.map((d) => ({
      destinationId: d!.id,
      at: localInstant(day, context.time || calendarTime(d!.at!, timezone), timezone),
    }));
  } catch (error) {
    if (error instanceof RpcError) {
      const code = (error.details as { code?: string } | undefined)?.code ?? error.code;
      return { kind: 'error', code, message: error.message };
    }
    throw error;
  }
  if (destinations.every((d, i) => d!.at && Date.parse(d!.at) === Date.parse(placements[i]!.at!))) return { kind: 'noop' };
  const first = destinations[0]!;
  return {
    kind: 'move',
    placements,
    undo: {
      publicationId: row.id,
      label: row.label,
      day: first.at ? dayInZone(first.at, timezone) : null,
      placements: destinations.map((d) => ({ destinationId: d!.id, at: d!.scheduledAt })),
    },
  };
}

/** The move dialog's starting values: the shared `HH:MM` of the destinations (empty when they differ or one has none). */
export function moveDialogStart(
  row: PublicationRow,
  destinationIds: readonly Id[],
  day: string,
  timezone: string,
): { day: string; time: string; needsTime: boolean } {
  const destinations = row.destinations.filter((d) => destinationIds.includes(d.id));
  const needsTime = destinations.some((d) => !d.at);
  const times = new Set(destinations.filter((d) => d.at).map((d) => calendarTime(d.at!, timezone)));
  return { day, time: !needsTime && times.size === 1 ? [...times][0]! : '', needsTime };
}

/** The Undo record after a move saved `revision`. */
export function undoRecord(undo: MoveUndo, revision: number): CalendarUndo {
  return { ...undo, revision };
}

// ---- Page state ----

/** One publication's destinations on `day`, earliest first (the aside's "Selected day", which is not paginated). */
export function entriesOn(rows: readonly PublicationRow[], day: string, timezone: string, filters: CalendarFilters): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const row of filterRows(rows, filters)) {
    const destinations = shownDestinations(row, filters.accountId)
      .filter((d) => dayOf(d, timezone) === day)
      .sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));
    if (destinations.length) entries.push({ row, destinations, time: calendarTime(destinations[0]!.at!, timezone) });
  }
  return entries.sort((a, b) => Date.parse(a.destinations[0]!.at!) - Date.parse(b.destinations[0]!.at!));
}

/** The destinations of an Unscheduled entry: the shown ones without a time. */
export function untimedDestinations(row: PublicationRow, accountId: Id | ''): PublicationRowDestination[] {
  return shownDestinations(row, accountId).filter((d) => !d.at);
}

/** Where the calendar is scoped: every project, one project, a project not on this computer, or not known yet (the directory is loading). */
export type CalendarScope =
  | { kind: 'all' }
  | { kind: 'project'; projectId: Id; name: string }
  | { kind: 'missing'; projectId: Id }
  | { kind: 'loading'; projectId: Id };

export function calendarScope(
  projectId: Id | undefined,
  directory: { ready: boolean; projects: readonly { id: Id; name: string }[] },
): CalendarScope {
  if (!projectId) return { kind: 'all' };
  const project = directory.projects.find((p) => p.id === projectId);
  if (project) return { kind: 'project', projectId, name: project.name };
  return directory.ready ? { kind: 'missing', projectId } : { kind: 'loading', projectId };
}

/** The first day "Find publishing times" looks at: the shown period's first day, but never before today. */
export function slotSearchStart(anchor: string, today: string): string {
  return anchor > today ? anchor : today;
}

/** What a dragged calendar entry carries (`CALENDAR_DRAG_TYPE`). */
export interface CalendarDrag {
  publicationId: Id;
  revision: number;
  destinationIds: Id[];
}

export function encodeDrag(drag: CalendarDrag): string {
  return JSON.stringify(drag);
}

/** Reads a dragged entry; anything else (a file, text from another app, a malformed payload) is null. */
export function parseDrag(text: string): CalendarDrag | null {
  try {
    const value = JSON.parse(text) as Partial<CalendarDrag>;
    if (
      typeof value.publicationId === 'string' &&
      typeof value.revision === 'number' &&
      Array.isArray(value.destinationIds) &&
      value.destinationIds.length > 0 &&
      value.destinationIds.every((id) => typeof id === 'string')
    ) {
      return { publicationId: value.publicationId, revision: value.revision, destinationIds: value.destinationIds };
    }
  } catch {
    // Not a calendar entry.
  }
  return null;
}

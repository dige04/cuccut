import { PublishingIssues as PI } from '../messages/protocol/publishing-issues.ts';
import type { CalendarPlacement, CalendarView, Publication, PublicationDestination } from '../publishing.ts';
import { RpcError } from '../wire.ts';
import { calendarInstant, dayInZone, intendedTime } from './resolve.ts';
import { addCivilDays, dayStartInstant, isCivilDate, localInstant } from './schedule.ts';

/**
 * Calendar arithmetic (port of agentcut `lib/calendar.ts`). Pure and browser-safe.
 *
 * Periods are civil dates: weeks start on Monday, a month view covers whole weeks, and week and agenda views cover the Monday-first week containing the
 * anchor. Which civil day an instant falls on is decided in the workspace timezone the caller passes, never the machine's local zone (agentcut built
 * its weekday headers from local `Date`s; `formatCivilDate` formats a civil date as itself in every zone).
 */

const timeFormats = new Map<string, Intl.DateTimeFormat>();

/** `HH:MM` (24-hour) of an instant in a timezone. */
export function calendarTime(at: string, timezone: string): string {
  let format = timeFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    timeFormats.set(timezone, format);
  }
  return format.format(new Date(at));
}

/** Today's civil date in a timezone. */
export function todayInZone(timezone: string, now: number = Date.now()): string {
  return dayInZone(new Date(now).toISOString(), timezone);
}

/**
 * The destinations of a publication shown on `date` (civil date in `timezone`), or, with `date` null, those without any time (the Unscheduled inbox).
 * `accountId` narrows to one account.
 */
export function calendarDestinations(
  publication: Publication,
  date: string | null,
  timezone: string,
  accountId = '',
): PublicationDestination[] {
  return publication.destinations.filter((d) => {
    if (accountId && d.accountId !== accountId) return false;
    const at = calendarInstant(publication, d);
    return date ? !!at && dayInZone(at, timezone) === date : !at;
  });
}

/**
 * New times for moving destinations to another civil day. Without `time`, each destination keeps its own wall-clock time (its confirmed time, else its
 * intended time) on the new day; a destination without a time then needs one (`PLACEMENT_TIME_REQUIRED`, the UI opens the move dialog).
 */
export function calendarPlacements(
  publication: Publication,
  destinationIds: readonly string[],
  day: string,
  timezone: string,
  time?: string,
): CalendarPlacement[] {
  return destinationIds.map((destinationId) => {
    const d = publication.destinations.find((item) => item.id === destinationId);
    if (!d) throw new RpcError('invalid-request', PI.destinationMissing(), { code: 'DESTINATION_NOT_FOUND' });
    const before = d.confirmedAt ?? intendedTime(publication, d);
    if (!before && !time) throw new RpcError('invalid-request', PI.timeRequired(), { code: 'PLACEMENT_TIME_REQUIRED' });
    return { destinationId, at: localInstant(day, time || calendarTime(before!, timezone), timezone) };
  });
}

/** The Monday of the week containing a civil date. */
export function civilWeekStart(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addCivilDays(day, -((weekday + 6) % 7));
}

/** The civil dates a view shows around `anchor`: whole Monday-first weeks covering the month, or the Monday-first week. Empty for an invalid anchor. */
export function calendarDates(anchor: string, view: CalendarView): string[] {
  if (!isCivilDate(anchor)) return [];
  if (view === 'month') {
    const first = `${anchor.slice(0, 7)}-01`;
    const date = new Date(`${first}T12:00:00Z`);
    const monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
    const offset = (date.getUTCDay() + 6) % 7;
    const count = Math.ceil((offset + monthDays) / 7) * 7;
    const start = addCivilDays(first, -offset);
    return Array.from({ length: count }, (_, n) => addCivilDays(start, n));
  }
  const start = civilWeekStart(anchor);
  return Array.from({ length: 7 }, (_, n) => addCivilDays(start, n));
}

/** The anchor of the next (`step` 1) or previous (`step` -1) period: the first of the month for month views, the same weekday ±7 days otherwise. */
export function adjacentPeriod(anchor: string, view: CalendarView, step: number): string {
  const date = new Date(`${anchor}T12:00:00Z`);
  if (view === 'month') {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + step);
    return date.toISOString().slice(0, 10);
  }
  return addCivilDays(anchor, step * 7);
}

/** The first and last civil dates a view shows. */
export function calendarRange(anchor: string, view: CalendarView): { from: string; to: string } | null {
  const dates = calendarDates(anchor, view);
  return dates.length ? { from: dates[0]!, to: dates[dates.length - 1]! } : null;
}

/** The instants bounding civil days `from`..`to` (inclusive) in a timezone: `[start, end)`. */
export function civilRangeInstants(from: string, to: string, timezone: string): { start: string; end: string } {
  return { start: dayStartInstant(from, timezone), end: dayStartInstant(addCivilDays(to, 1), timezone) };
}

/** Days between two civil dates, inclusive (`from` = `to` is 1). */
export function civilDaySpan(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Formats a civil date as itself (weekday headers, day labels), independent of the machine's and the workspace's zones. */
export function formatCivilDate(day: string, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

/** The title of a period: "October 2026" for a month, a date range for a week (spanning months or years when the week does). */
export function calendarPeriodLabel(anchor: string, view: CalendarView, locale?: string): string {
  if (!isCivilDate(anchor)) return '';
  if (view === 'month') return formatCivilDate(anchor, locale, { month: 'long', year: 'numeric' });
  const dates = calendarDates(anchor, view);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatRange(
    new Date(`${dates[0]}T12:00:00Z`),
    new Date(`${dates[dates.length - 1]}T12:00:00Z`),
  );
}

import { refOf, type Localized } from '../message-ref.ts';
import { PublishingIssues as PI } from '../messages/protocol/publishing-issues.ts';
import type {
  Publication,
  PublishingAccount,
  PublishingSettings,
  SlotOccupancy,
  SlotPlan,
  SlotRequest,
} from '../publishing.ts';
import { RpcError } from '../wire.ts';
import { intendedTime, isValidTimezone } from './resolve.ts';

/**
 * Local time → instant, and slot planning (port of agentcut `lib/schedule.ts`). Pure and browser-safe.
 *
 * Errors are `RpcError('invalid-request')` with `details.code`: `TIME_INVALID`, `TIMEZONE_INVALID`, `LOCAL_TIME_GAP` (the wall-clock time does not exist
 * because the clocks jump forward) or `LOCAL_TIME_FOLD` (it happens twice because the clocks fall back). Neither case is ever silently shifted.
 */

export type LocalTimeErrorCode = 'TIME_INVALID' | 'TIMEZONE_INVALID' | 'LOCAL_TIME_GAP' | 'LOCAL_TIME_FOLD';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const wallFormats = new Map<string, Intl.DateTimeFormat>();

function wallFormat(timezone: string): Intl.DateTimeFormat {
  let format = wallFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    wallFormats.set(timezone, format);
  }
  return format;
}

/** The wall-clock reading `YYYY-MM-DDTHH:MM` of an instant in a timezone. */
export function zonedWallClock(epochMs: number, timezone: string): string {
  const parts = wallFormat(timezone).formatToParts(new Date(epochMs));
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

function invalid(code: LocalTimeErrorCode, message: Localized): RpcError {
  return new RpcError('invalid-request', message, { code });
}

/** Whether a string is a civil date `YYYY-MM-DD` that exists. */
export function isCivilDate(day: string): boolean {
  if (!DAY.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

/**
 * The instants at which the wall clock in `timezone` reads `day` `time` (`HH:MM`): none in a gap, two in a fold. Modern IANA offsets are multiples of
 * 15 minutes within ±14 hours, so every candidate offset is evaluated rather than assuming one.
 */
export function localInstants(day: string, time: string, timezone: string): string[] {
  if (!isCivilDate(day) || !TIME.test(time)) throw invalid('TIME_INVALID', PI.timeInvalid());
  if (!isValidTimezone(timezone)) throw invalid('TIMEZONE_INVALID', PI.timezoneInvalid());
  const wall = `${day}T${time}`;
  const guess = Date.parse(`${wall}:00Z`);
  const matches: string[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const at = guess + offset * 60_000;
    if (zonedWallClock(at, timezone) === wall) matches.push(new Date(at).toISOString());
  }
  return matches.sort();
}

/** The one instant at which the wall clock in `timezone` reads `day` `time`. Refuses gaps and folds (see the module comment). */
export function localInstant(day: string, time: string, timezone: string): string {
  const matches = localInstants(day, time, timezone);
  if (matches.length === 0) throw invalid('LOCAL_TIME_GAP', PI.timeGap({ timezone }));
  if (matches.length > 1) throw invalid('LOCAL_TIME_FOLD', PI.timeFold({ timezone }));
  return matches[0]!;
}

/** The first instant of a civil day in a timezone (midnight, or the first minute after a gap at midnight). */
export function dayStartInstant(day: string, timezone: string): string {
  if (!isCivilDate(day)) throw invalid('TIME_INVALID', PI.timeInvalid());
  if (!isValidTimezone(timezone)) throw invalid('TIMEZONE_INVALID', PI.timezoneInvalid());
  const midnight = localInstants(day, '00:00', timezone);
  if (midnight.length) return midnight[0]!;
  // Midnight falls in a gap: the day starts at the first quarter hour whose wall clock is on this day.
  const base = Date.parse(`${day}T00:00:00Z`);
  for (let offset = -14 * 60; offset <= 14 * 60 + 24 * 60; offset += 15) {
    const at = base + offset * 60_000;
    if (zonedWallClock(at, timezone).slice(0, 10) === day) return new Date(at).toISOString();
  }
  throw invalid('TIME_INVALID', PI.timeInvalid());
}

/** Adds days to a civil date. */
export function addCivilDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The canonical identity of an account: the account it is linked to, else itself. Unknown accounts are their own identity. */
export function publishingAccountIdentity(accounts: readonly PublishingAccount[], accountId: string): string {
  return accounts.find((a) => a.id === accountId)?.equivalentTo ?? accountId;
}

/**
 * Times taken on each real account by publications other than `exclude`: non-archived publications' destinations that are not cancelled, at their
 * confirmed time, else their intended time.
 */
export function publicationOccupancy(publications: readonly Publication[], accounts: readonly PublishingAccount[], exclude?: string): SlotOccupancy[] {
  const out: SlotOccupancy[] = [];
  for (const p of publications) {
    if (p.id === exclude || p.archived) continue;
    for (const d of p.destinations) {
      if (d.state === 'cancelled') continue;
      const at = d.confirmedAt ?? intendedTime(p, d);
      if (at) out.push({ accountId: publishingAccountIdentity(accounts, d.accountId), at, publicationId: p.id });
    }
  }
  return out;
}

/**
 * The first destination of `publication` whose time is closer than `minGapMinutes` to another publication's time on the same real account, or null.
 * Cancelled destinations and destinations without a time are skipped.
 */
export function findReservationConflict(
  publication: Publication,
  accounts: readonly PublishingAccount[],
  occupancy: readonly SlotOccupancy[],
  minGapMinutes: number,
): { destinationId: string; accountId: string } | null {
  const gap = minGapMinutes * 60_000;
  for (const d of publication.destinations) {
    const at = intendedTime(publication, d);
    if (!at || d.state === 'cancelled') continue;
    const t = Date.parse(at);
    const identity = publishingAccountIdentity(accounts, d.accountId);
    if (occupancy.some((o) => o.publicationId !== publication.id && o.accountId === identity && Math.abs(Date.parse(o.at) - t) < gap)) {
      return { destinationId: d.id, accountId: d.accountId };
    }
  }
  return null;
}

/** Most days `planSlots` looks ahead. */
export const SLOT_PLAN_MAX_DAYS = 90;

/**
 * Deterministic slot planning. Candidates are the weekly slots in the workspace timezone over `days` days from `from` (DST gaps and folds are skipped,
 * never shifted). Requests are served by priority (higher first), then earliest expiry, then publication ID; each takes the earliest candidate that is
 * at least `leadMinutes` ahead of `now`, before its expiry, and at least `minGapMinutes` from every time already taken on any of its accounts.
 * Placements made earlier in the same plan occupy their accounts too. Occupancy of the requested publications themselves is ignored.
 */
export function planSlots(
  requests: readonly SlotRequest[],
  settings: Pick<PublishingSettings, 'slots' | 'timezone' | 'leadMinutes' | 'minGapMinutes'>,
  occupancy: readonly SlotOccupancy[],
  from: string,
  days: number,
  now: number = Date.now(),
): SlotPlan {
  const placements: SlotPlan['placements'] = [];
  const unavailable: SlotPlan['unavailable'] = [];
  const taken = occupancy.filter((o) => !requests.some((r) => r.publicationId === o.publicationId));
  const candidates: string[] = [];
  const count = Math.max(0, Math.min(days, SLOT_PLAN_MAX_DAYS));
  for (let n = 0; n < count; n++) {
    const day = addCivilDays(from, n);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const slot of settings.slots) {
      if (slot.weekday !== weekday) continue;
      try {
        candidates.push(localInstant(day, slot.time, settings.timezone));
      } catch {
        // DST gaps and folds are never silently shifted.
      }
    }
  }
  candidates.sort();
  const sorted = [...requests].sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999') ||
      a.publicationId.localeCompare(b.publicationId),
  );
  const lead = now + settings.leadMinutes * 60_000;
  const gap = settings.minGapMinutes * 60_000;
  for (const request of sorted) {
    const at = candidates.find((iso) => {
      const t = Date.parse(iso);
      return (
        request.accountIds.length > 0 &&
        t >= lead &&
        (!request.expiresAt || t < Date.parse(request.expiresAt)) &&
        !taken.some((o) => request.accountIds.includes(o.accountId) && Math.abs(Date.parse(o.at) - t) < gap)
      );
    });
    if (!at) {
      unavailable.push({ publicationId: request.publicationId, reason: refOf(PI.noFreeSlot()) });
      continue;
    }
    placements.push({ publicationId: request.publicationId, at });
    for (const accountId of request.accountIds) taken.push({ accountId, at, publicationId: request.publicationId });
  }
  return { placements, unavailable };
}

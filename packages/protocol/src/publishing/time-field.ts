import { PublishingIssues as PI } from '../messages/protocol/publishing-issues.ts';
import { RpcError } from '../wire.ts';
import { calendarTime } from './calendar.ts';
import { dayInZone } from './resolve.ts';
import { isCivilDate, localInstant } from './schedule.ts';

/**
 * The publication time field (port of agentcut `lib/time-field.ts`): a date and an `HH:MM` time in a timezone, or an exact timestamp.
 */

const OFFSET_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-](0\d|1[0-4]):[0-5]\d)$/;

/** An ISO 8601 timestamp with seconds optional and an explicit UTC offset (`Z` or `±HH:MM`), on a date that exists. */
export function isOffsetTimestamp(value: string): boolean {
  const match = OFFSET_TIMESTAMP.exec(value);
  return !!match && isCivilDate(match[1]!) && Number.isFinite(Date.parse(value));
}

/**
 * The instant for a date and time chosen in the field. While the chosen day and time still read the same as `previous` in `timezone`, `previous` is
 * kept exactly (its seconds, and which side of a DST fold it is on); otherwise the wall-clock time is resolved, refusing gaps and folds.
 */
export function resolveTimeField(day: string, time: string, timezone: string, previous: string | null): string {
  if (!day || !time) throw new RpcError('invalid-request', PI.timeRequired(), { code: 'TIME_REQUIRED' });
  if (previous && isOffsetTimestamp(previous) && dayInZone(previous, timezone) === day && calendarTime(previous, timezone) === time) return previous;
  return localInstant(day, time, timezone);
}

/** An exact timestamp typed in the field. It must carry its UTC offset. */
export function resolveTimeFieldTimestamp(value: string): string {
  const trimmed = value.trim();
  if (!isOffsetTimestamp(trimmed)) throw new RpcError('invalid-request', PI.timestampInvalid(), { code: 'TIMESTAMP_INVALID' });
  return trimmed;
}

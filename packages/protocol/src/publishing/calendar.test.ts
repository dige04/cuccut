import { describe, expect, it } from 'vitest';
import { RpcError } from '../wire.ts';
import {
  adjacentPeriod,
  calendarDates,
  calendarDestinations,
  calendarPeriodLabel,
  calendarPlacements,
  calendarRange,
  calendarTime,
  civilDaySpan,
  civilRangeInstants,
  formatCivilDate,
  civilWeekStart,
  todayInZone,
} from './calendar.ts';
import { testDestination, testPublication } from './testing.ts';

describe('calendar periods', () => {
  it('a month view covers the whole civil month in Monday-first weeks', () => {
    const days = calendarDates('2026-08-31', 'month');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-07-27');
    expect(days).toContain('2026-08-01');
    expect(days).toContain('2026-08-31');
    expect(days.at(-1)).toBe('2026-09-06');
    // February 2027 starts on a Monday and fits four weeks.
    expect(calendarDates('2027-02-14', 'month')).toEqual(Array.from({ length: 28 }, (_, n) => `2027-02-${String(n + 1).padStart(2, '0')}`));
    for (const day of calendarDates('2026-10-13', 'month').filter((_, n) => n % 7 === 0)) {
      expect(new Date(`${day}T12:00:00Z`).getUTCDay()).toBe(1);
    }
  });

  it('week and agenda views cover the Monday-first week, across months and years', () => {
    expect(calendarDates('2026-12-31', 'week')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    expect(calendarDates('2026-12-28', 'agenda')).toEqual(calendarDates('2027-01-03', 'week'));
    expect(civilWeekStart('2026-10-18')).toBe('2026-10-12');
    expect(civilWeekStart('2026-10-12')).toBe('2026-10-12');
    expect(calendarDates('', 'week')).toEqual([]);
    expect(calendarDates('2026-02-30', 'month')).toEqual([]);
  });

  it('navigates without date overflow', () => {
    expect(adjacentPeriod('2026-01-31', 'month', 1)).toBe('2026-02-01');
    expect(adjacentPeriod('2026-12-15', 'month', 1)).toBe('2027-01-01');
    expect(adjacentPeriod('2026-01-15', 'month', -1)).toBe('2025-12-01');
    expect(adjacentPeriod('2026-12-30', 'week', 1)).toBe('2027-01-06');
    expect(adjacentPeriod('2026-03-02', 'agenda', -1)).toBe('2026-02-23');
  });

  it('ranges in a non-local timezone', () => {
    expect(calendarRange('2026-10-13', 'week')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(calendarRange('bad', 'week')).toBeNull();
    expect(civilRangeInstants('2026-10-12', '2026-10-18', 'Asia/Ho_Chi_Minh')).toEqual({
      start: '2026-10-11T17:00:00.000Z',
      end: '2026-10-18T17:00:00.000Z',
    });
    // The week the clocks go back in New York is 169 hours long.
    const { start, end } = civilRangeInstants('2026-10-26', '2026-11-01', 'America/New_York');
    expect((Date.parse(end) - Date.parse(start)) / 3_600_000).toBe(169);
    expect(civilDaySpan('2026-10-12', '2026-10-18')).toBe(7);
    expect(civilDaySpan('2026-03-01', '2026-05-31')).toBe(92);
    expect(todayInZone('Pacific/Kiritimati', Date.parse('2026-10-13T12:00:00Z'))).toBe('2026-10-14');
  });

  it('formats civil dates as themselves, whatever the zone', () => {
    expect(formatCivilDate('2026-10-12', 'en-US', { weekday: 'short' })).toBe('Mon');
    expect(formatCivilDate('2026-10-18', 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })).toBe('Sunday, October 18');
    expect(calendarPeriodLabel('2026-10-13', 'month', 'en-US')).toBe('October 2026');
    expect(calendarPeriodLabel('2026-12-31', 'week', 'en-US').replace(/\s/gu, ' ')).toBe('Dec 28, 2026 – Jan 3, 2027');
  });
});

describe('calendar entries', () => {
  const p = testPublication({
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-10-13T20:00:00Z',
    destinations: [
      testDestination({ id: 'default', accountId: 'a' }),
      testDestination({ id: 'own', accountId: 'b', scheduledAt: '2026-10-15T02:00:00Z' }),
      testDestination({ id: 'done', accountId: 'c', publishedAt: '2026-10-12T09:00:00Z' }),
    ],
  });

  it('places each destination on its civil day in the workspace timezone', () => {
    const tz = 'Asia/Ho_Chi_Minh';
    expect(calendarDestinations(p, '2026-10-14', tz).map((d) => d.id)).toEqual(['default']);
    expect(calendarDestinations(p, '2026-10-15', tz).map((d) => d.id)).toEqual(['own']);
    expect(calendarDestinations(p, '2026-10-12', tz).map((d) => d.id)).toEqual(['done']);
    expect(calendarDestinations(p, '2026-10-13', 'UTC').map((d) => d.id)).toEqual(['default']);
    expect(calendarDestinations(p, '2026-10-15', tz, 'a')).toEqual([]);
    expect(calendarDestinations(p, null, tz)).toEqual([]);
    const unscheduled = testPublication({ destinations: [testDestination({ id: 'none', accountId: 'a' })] });
    expect(calendarDestinations(unscheduled, null, tz).map((d) => d.id)).toEqual(['none']);
    expect(calendarTime('2026-10-13T20:00:00Z', tz)).toBe('03:00');
  });

  it('a move keeps each destination\'s wall-clock time, or takes the chosen time', () => {
    const tz = 'Asia/Ho_Chi_Minh';
    expect(calendarPlacements(p, ['default', 'own'], '2026-10-20', tz)).toEqual([
      { destinationId: 'default', at: '2026-10-19T20:00:00.000Z' },
      { destinationId: 'own', at: '2026-10-20T02:00:00.000Z' },
    ]);
    expect(calendarPlacements(p, ['own'], '2026-10-20', tz, '18:30')).toEqual([{ destinationId: 'own', at: '2026-10-20T11:30:00.000Z' }]);
    const unscheduled = testPublication({ destinations: [testDestination({ id: 'none', accountId: 'a' })] });
    const failure = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        expect(error).toBeInstanceOf(RpcError);
        return ((error as RpcError).details as { code: string }).code;
      }
      return null;
    };
    expect(failure(() => calendarPlacements(unscheduled, ['none'], '2026-10-20', tz))).toBe('PLACEMENT_TIME_REQUIRED');
    expect(failure(() => calendarPlacements(p, ['missing'], '2026-10-20', tz))).toBe('DESTINATION_NOT_FOUND');
    expect(failure(() => calendarPlacements(p, ['default'], '2026-03-08', 'America/New_York', '02:30'))).toBe('LOCAL_TIME_GAP');
  });
});

import { describe, expect, it } from 'vitest';
import { RpcError } from '../wire.ts';
import { PUBLISHING_SETTINGS_DEFAULTS, type PublishingSettings, type SlotRequest } from '../publishing.ts';
import {
  publishingAccountIdentity,
  addCivilDays,
  dayStartInstant,
  findReservationConflict,
  localInstant,
  localInstants,
  planSlots,
  publicationOccupancy,
  zonedWallClock,
} from './schedule.ts';
import { testAccount, testDestination, testPublication } from './testing.ts';

function code(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).code).toBe('invalid-request');
    return ((error as RpcError).details as { code: string }).code;
  }
  throw new Error('expected an error');
}

describe('localInstant', () => {
  it('resolves a wall-clock time in a timezone', () => {
    expect(localInstant('2026-09-28', '18:00', 'America/Mexico_City')).toBe('2026-09-29T00:00:00.000Z');
    expect(localInstant('2026-10-13', '09:15', 'Asia/Kolkata')).toBe('2026-10-13T03:45:00.000Z');
    expect(localInstant('2026-10-13', '09:00', 'UTC')).toBe('2026-10-13T09:00:00.000Z');
  });

  it('refuses a DST gap and a DST fold instead of shifting', () => {
    expect(code(() => localInstant('2026-03-08', '02:30', 'America/New_York'))).toBe('LOCAL_TIME_GAP');
    expect(code(() => localInstant('2026-11-01', '01:30', 'America/New_York'))).toBe('LOCAL_TIME_FOLD');
    expect(localInstants('2026-11-01', '01:30', 'America/New_York')).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
    expect(localInstants('2026-03-08', '02:30', 'America/New_York')).toEqual([]);
  });

  it('refuses invalid dates, times and zones', () => {
    expect(code(() => localInstant('2026-02-30', '10:00', 'UTC'))).toBe('TIME_INVALID');
    expect(code(() => localInstant('2026-02-10', '24:00', 'UTC'))).toBe('TIME_INVALID');
    expect(code(() => localInstant('2026-02-10', '10:00', 'Nowhere/City'))).toBe('TIMEZONE_INVALID');
  });

  it('wall clock and day start', () => {
    expect(zonedWallClock(Date.parse('2026-10-13T22:30:00Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-10-14T05:30');
    expect(dayStartInstant('2026-10-14', 'Asia/Ho_Chi_Minh')).toBe('2026-10-13T17:00:00.000Z');
    // Santiago skips midnight when DST starts (2026-09-06 00:00 → 01:00).
    expect(dayStartInstant('2026-09-06', 'America/Santiago')).toBe('2026-09-06T04:00:00.000Z');
    expect(addCivilDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCivilDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('planSlots', () => {
  const settings: PublishingSettings = {
    ...PUBLISHING_SETTINGS_DEFAULTS,
    timezone: 'UTC',
    slots: [
      { weekday: 1, time: '12:00' },
      { weekday: 1, time: '13:00' },
    ],
    minGapMinutes: 60,
    leadMinutes: 1,
  };
  const now = Date.parse('2030-01-06T00:00:00Z');
  const request = (publicationId: string, overrides: Partial<SlotRequest> = {}): SlotRequest => ({
    publicationId,
    accountIds: ['a'],
    priority: 0,
    expiresAt: null,
    ...overrides,
  });

  it('competes within a batch: placements occupy their accounts', () => {
    const result = planSlots(['one', 'two', 'three'].map((id) => request(id)), settings, [], '2030-01-07', 1, now);
    expect(result.placements).toEqual([
      { publicationId: 'one', at: '2030-01-07T12:00:00.000Z' },
      { publicationId: 'three', at: '2030-01-07T13:00:00.000Z' },
    ]);
    expect(result.unavailable).toEqual([{ publicationId: 'two', reason: { key: 'publishingIssues.noFreeSlot' } }]);
    const separate = planSlots([request('one', { accountIds: ['x'] }), request('two', { accountIds: ['y'] })], settings, [], '2030-01-07', 1, now);
    expect(separate.placements.map((p) => p.at)).toEqual(['2030-01-07T12:00:00.000Z', '2030-01-07T12:00:00.000Z']);
  });

  it('is deterministic by priority, then expiry, then ID', () => {
    const result = planSlots(
      [request('b'), request('a'), request('c', { priority: 5 }), request('d', { expiresAt: '2031-01-01T00:00:00Z' })],
      settings,
      [],
      '2030-01-07',
      14,
      now,
    );
    expect(result.placements.map((p) => p.publicationId)).toEqual(['c', 'd', 'a', 'b']);
    expect(result.placements.map((p) => p.at)).toEqual([
      '2030-01-07T12:00:00.000Z',
      '2030-01-07T13:00:00.000Z',
      '2030-01-14T12:00:00.000Z',
      '2030-01-14T13:00:00.000Z',
    ]);
    const reversed = planSlots([request('d', { expiresAt: '2031-01-01T00:00:00Z' }), request('c', { priority: 5 }), request('b'), request('a')], settings, [], '2030-01-07', 14, now);
    expect(reversed).toEqual(result);
  });

  it('respects lead time, expiry, existing occupancy and the gap', () => {
    expect(planSlots([request('p')], { ...settings, leadMinutes: 36 * 60 + 1 }, [], '2030-01-06', 2, now).placements[0]?.at).toBe('2030-01-07T13:00:00.000Z');
    expect(planSlots([request('p', { expiresAt: '2030-01-07T12:00:00Z' })], settings, [], '2030-01-07', 1, now).placements).toEqual([]);
    const taken = [{ accountId: 'a', at: '2030-01-07T12:30:00Z', publicationId: 'other' }];
    expect(planSlots([request('p')], settings, taken, '2030-01-07', 1, now).placements).toEqual([]);
    expect(planSlots([request('p')], { ...settings, minGapMinutes: 30 }, taken, '2030-01-07', 1, now).placements[0]?.at).toBe('2030-01-07T12:00:00.000Z');
    // The request's own earlier occupancy does not block it.
    expect(planSlots([request('p')], settings, [{ accountId: 'a', at: '2030-01-07T12:00:00Z', publicationId: 'p' }], '2030-01-07', 1, now).placements).toHaveLength(1);
    // No accounts, no slot.
    expect(planSlots([request('p', { accountIds: [] })], settings, [], '2030-01-07', 1, now).unavailable).toHaveLength(1);
  });

  it('weekly slots use the workspace timezone and skip DST gaps', () => {
    const ny: PublishingSettings = { ...settings, timezone: 'America/New_York', slots: [{ weekday: 0, time: '02:30' }, { weekday: 0, time: '18:00' }] };
    const plan = planSlots([request('p')], ny, [], '2026-03-08', 1, Date.parse('2026-03-01T00:00:00Z'));
    expect(plan.placements).toEqual([{ publicationId: 'p', at: '2026-03-08T22:00:00.000Z' }]);
  });
});

describe('reservations', () => {
  const accounts = [testAccount({ id: 'main' }), testAccount({ id: 'alias', equivalentTo: 'main', connectionId: 'conn_2' }), testAccount({ id: 'other' })];

  it('linked accounts share one identity', () => {
    expect(publishingAccountIdentity(accounts, 'alias')).toBe('main');
    expect(publishingAccountIdentity(accounts, 'main')).toBe('main');
    expect(publishingAccountIdentity(accounts, 'missing')).toBe('missing');
  });

  it('finds a conflict across equivalent routes within the gap', () => {
    const existing = testPublication({
      id: 'existing',
      scheduledAt: '2030-01-07T12:00:00Z',
      destinations: [testDestination({ id: 'e1', accountId: 'main' }), testDestination({ id: 'e2', accountId: 'other', state: 'cancelled' })],
    });
    const archived = testPublication({ id: 'archived', archived: true, scheduledAt: '2030-01-07T12:00:00Z', destinations: [testDestination({ id: 'x', accountId: 'other' })] });
    const occupancy = publicationOccupancy([existing, archived], accounts);
    expect(occupancy).toEqual([{ accountId: 'main', at: '2030-01-07T12:00:00Z', publicationId: 'existing' }]);
    const candidate = testPublication({ id: 'new', scheduledAt: '2030-01-07T12:30:00Z', destinations: [testDestination({ id: 'n1', accountId: 'alias' })] });
    expect(findReservationConflict(candidate, accounts, occupancy, 60)).toEqual({ destinationId: 'n1', accountId: 'alias' });
    expect(findReservationConflict(candidate, accounts, occupancy, 30)).toBeNull();
    const elsewhere = testPublication({ id: 'new', scheduledAt: '2030-01-07T12:00:00Z', destinations: [testDestination({ id: 'n1', accountId: 'other' })] });
    expect(findReservationConflict(elsewhere, accounts, occupancy, 60)).toBeNull();
    expect(publicationOccupancy([existing], accounts, 'existing')).toEqual([]);
  });
});

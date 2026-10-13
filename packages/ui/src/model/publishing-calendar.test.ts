import { describe, expect, it } from 'vitest';
import { PC } from '../components/publishing/publishing-copy.ts';
import {
  calendarModel,
  calendarScope,
  canDrag,
  encodeDrag,
  entriesOn,
  filterRows,
  moveBlock,
  moveDialogStart,
  NO_FILTERS,
  parseDrag,
  planMove,
  revealAnchor,
  slotSearchStart,
  undoRecord,
  untimedDestinations,
  type CalendarModelInput,
} from './publishing-calendar.ts';
import { account, connection, row, rowDestination } from './publishing-test-fixtures.ts';

const NY = 'America/New_York';
const accounts = [account({ id: 'acc_yt', name: 'Main channel' }), account({ id: 'acc_tt', network: 'tiktok', name: 'Clips' })];
const connections = [connection()];
const context = { accounts, connections };

function input(rows: CalendarModelInput['rows'], overrides: Partial<CalendarModelInput> = {}): CalendarModelInput {
  return {
    rows,
    accounts,
    connections,
    timezone: NY,
    anchor: '2026-10-14',
    view: 'month',
    filters: NO_FILTERS,
    now: Date.parse('2026-10-14T16:00:00.000Z'),
    locale: 'en',
    ...overrides,
  };
}

const at = (id: string, iso: string | null, extra: Partial<Parameters<typeof rowDestination>[0]> = {}) =>
  rowDestination({ id, at: iso, scheduledAt: iso, ...extra });

describe('calendar grid', () => {
  it('covers whole Monday-first weeks and places entries by their day in the workspace timezone', () => {
    // 03:30 UTC on the 15th is still the 14th in New York.
    const late = row({ id: 'late', destinations: [at('late_d', '2026-10-15T03:30:00.000Z')] });
    const m = calendarModel(input([late]));
    expect(m.from).toBe('2026-09-28');
    expect(m.to).toBe('2026-11-01');
    expect(m.days).toHaveLength(35);
    expect(m.weekdays[0]).toEqual({ short: 'Mon', long: 'Monday' });
    expect(m.weekdays[6]!.short).toBe('Sun');
    expect(m.today).toBe('2026-10-14');
    const day = m.days.find((d) => d.date === '2026-10-14')!;
    expect(day.today).toBe(true);
    expect(day.entries.map((e) => [e.row.id, e.time])).toEqual([['late', '23:30']]);
    expect(m.days[0]!.outside).toBe(true);
    expect(m.total).toBe(1);
  });

  it('week and agenda views cover the week; agenda keeps only days with entries', () => {
    const rows = [row({ id: 'a', destinations: [at('a_d', '2026-10-16T16:00:00.000Z')] })];
    expect(calendarModel(input(rows, { view: 'week' })).days.map((d) => d.date)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(calendarModel(input(rows, { view: 'agenda' })).days.map((d) => d.date)).toEqual(['2026-10-16']);
  });

  it('applies filters before pagination', () => {
    const scheduled = (id: string, status: 'draft' | 'approved') =>
      row({ id, status, destinations: [at(`${id}_d`, '2026-10-16T16:00:00.000Z')] });
    const rows = [scheduled('a', 'draft'), scheduled('b', 'approved'), scheduled('c', 'approved')];
    const first = calendarModel(input(rows, { filters: { accountId: '', status: 'approved' }, limit: 1 }));
    expect(first.page.map((r) => r.id)).toEqual(['b']);
    expect(first).toMatchObject({ total: 2, nextOffset: 1, previousOffset: null, hasFilters: true });
    const second = calendarModel(input(rows, { filters: { accountId: '', status: 'approved' }, limit: 1, offset: 1 }));
    expect(second.page.map((r) => r.id)).toEqual(['c']);
    expect(second).toMatchObject({ nextOffset: null, previousOffset: 0 });
  });

  it('an account filter keeps only that account’s destinations; archived and other projects never show', () => {
    const both = row({
      id: 'both',
      projectId: 'proj_1',
      destinations: [at('yt', '2026-10-16T16:00:00.000Z'), at('tt', '2026-10-17T16:00:00.000Z', { accountId: 'acc_tt', format: 'tiktok-video' })],
    });
    const archived = row({ id: 'old', archived: true, destinations: [at('old_d', '2026-10-16T16:00:00.000Z')] });
    const m = calendarModel(input([both, archived], { filters: { accountId: 'acc_tt', status: '', projectId: 'proj_1' } }));
    expect(m.days.filter((d) => d.entries.length).map((d) => [d.date, d.entries[0]!.destinations.map((x) => x.id)])).toEqual([['2026-10-17', ['tt']]]);
    expect(filterRows([both, archived], { accountId: '', status: '', projectId: 'proj_2' })).toEqual([]);
  });

  it('lists the Unscheduled inbox, publications needing attention and by-hand posts that are due', () => {
    const unscheduled = row({ id: 'u' });
    const failed = row({ id: 'f', status: 'attention', destinations: [at('f_d', '2026-10-16T16:00:00.000Z', { state: 'failed' })] });
    const due = row({ id: 'due', status: 'pending', destinations: [at('due_d', '2026-10-14T15:00:00.000Z', { state: 'queued' })] });
    const later = row({ id: 'later', status: 'pending', destinations: [at('later_d', '2026-10-14T17:00:00.000Z', { state: 'queued' })] });
    // Sent by hand with no time, or cancelled with no time: not waiting for a time, so never offered to "Find publishing times".
    const sentNow = row({ id: 'now', status: 'pending', destinations: [at('now_d', null, { state: 'queued' })] });
    const cancelled = row({ id: 'c', status: 'cancelled', destinations: [at('c_d', null, { state: 'cancelled' })] });
    const failedUntimed = row({ id: 'fu', status: 'attention', destinations: [at('fu_d', null, { state: 'failed' })] });
    const m = calendarModel(input([unscheduled, failed, due, later, sentNow, cancelled, failedUntimed]));
    expect(m.unscheduled.map((r) => r.id)).toEqual(['u', 'fu']);
    expect(m.attention.map((r) => r.id)).toEqual(['f', 'fu']);
    // The one sent with no time waits in "Post by hand" instead.
    expect(m.due.map((d) => [d.row.id, d.destination.id, d.account?.name])).toEqual([
      ['now', 'now_d', 'Main channel'],
      ['due', 'due_d', 'Main channel'],
    ]);
  });

  it('reveals a day by moving the anchor only when the period does not show it', () => {
    expect(revealAnchor('2026-10-14', 'month', '2026-10-30')).toBe('2026-10-14');
    expect(revealAnchor('2026-10-14', 'week', '2026-10-30')).toBe('2026-10-30');
  });
});

describe('moving on the calendar', () => {
  it('drags as a group only when every shown destination can move; the others say why', () => {
    const open = row({ id: 'o', destinations: [at('o1', '2026-10-16T16:00:00.000Z'), at('o2', '2026-10-16T17:00:00.000Z', { state: 'failed' })] });
    expect(canDrag({ row: open, destinations: open.destinations }, accounts, connections)).toBe(true);
    const waiting = at('w', '2026-10-16T16:00:00.000Z', { state: 'queued' });
    const mixed = row({ id: 'm', destinations: [at('m1', '2026-10-16T16:00:00.000Z'), waiting] });
    expect(canDrag({ row: mixed, destinations: mixed.destinations }, accounts, connections)).toBe(false);
    expect(moveBlock(mixed, waiting, accounts, connections)).toBe(PC.move.waiting);
    const confirmed = at('c', '2026-10-16T16:00:00.000Z', { state: 'scheduled' });
    expect(moveBlock(row({ id: 'c' }), confirmed, accounts, connections)).toBe(PC.move.confirmedByHand('YouTube'));
    expect(moveBlock(row({ id: 'a', archived: true }), at('x', null), accounts, connections)).toBe(PC.move.archived);
  });

  it('keeps each destination’s wall-clock time on the new day, across a DST change, and records its own time for Undo', () => {
    // 18:00 EDT on Oct 30 → 18:00 EST on Nov 2.
    const r = row({
      id: 'p',
      label: 'Launch',
      revision: 4,
      scheduledAt: '2026-10-30T22:00:00.000Z',
      destinations: [rowDestination({ id: 'd1', scheduledAt: null, at: '2026-10-30T22:00:00.000Z' })],
    });
    const plan = planMove(r, ['d1'], '2026-11-02', NY, context);
    expect(plan).toEqual({
      kind: 'move',
      placements: [{ destinationId: 'd1', at: '2026-11-02T23:00:00.000Z' }],
      undo: { publicationId: 'p', label: 'Launch', day: '2026-10-30', placements: [{ destinationId: 'd1', at: null }] },
    });
    if (plan.kind !== 'move') return;
    expect(undoRecord(plan.undo, 5)).toEqual({ ...plan.undo, revision: 5 });
  });

  it('opens the dialog for a destination without a time, does nothing for the same day, refuses local times that do not exist', () => {
    const r = row({ id: 'p', destinations: [at('t', '2026-10-16T16:00:00.000Z'), at('none', null)] });
    expect(planMove(r, ['t', 'none'], '2026-10-20', NY, context)).toEqual({ kind: 'dialog' });
    expect(moveDialogStart(r, ['t', 'none'], '2026-10-20', NY)).toEqual({ day: '2026-10-20', time: '', needsTime: true });
    expect(moveDialogStart(r, ['t'], '2026-10-20', NY)).toEqual({ day: '2026-10-20', time: '12:00', needsTime: false });
    const withTime = planMove(r, ['t', 'none'], '2026-10-20', NY, { ...context, time: '09:15' });
    expect(withTime.kind === 'move' && withTime.placements.map((p) => p.at)).toEqual(['2026-10-20T13:15:00.000Z', '2026-10-20T13:15:00.000Z']);
    expect(planMove(r, ['t'], '2026-10-16', NY, context)).toEqual({ kind: 'noop' });
    expect(planMove(r, ['t'], '2026-03-08', NY, { ...context, time: '02:30' })).toMatchObject({ kind: 'error', code: 'LOCAL_TIME_GAP' });
    expect(planMove(r, ['missing'], '2026-10-20', NY, context)).toEqual({ kind: 'blocked', reason: PC.move.missing });
  });
});

describe('calendar page state', () => {
  it('lists the selected day’s publications across pages, earliest first, with the filters applied', () => {
    const rows = [
      row({ id: 'b', destinations: [at('b_d', '2026-10-16T20:00:00.000Z')] }),
      row({ id: 'a', destinations: [at('a_d', '2026-10-16T14:00:00.000Z'), at('a_t', '2026-10-17T14:00:00.000Z', { accountId: 'acc_tt', format: 'tiktok-video' })] }),
      row({ id: 'gone', archived: true, destinations: [at('g_d', '2026-10-16T15:00:00.000Z')] }),
    ];
    expect(entriesOn(rows, '2026-10-16', NY, NO_FILTERS).map((e) => [e.row.id, e.time, e.destinations.map((d) => d.id)])).toEqual([
      ['a', '10:00', ['a_d']],
      ['b', '16:00', ['b_d']],
    ]);
    expect(entriesOn(rows, '2026-10-16', NY, { accountId: 'acc_tt', status: '' })).toEqual([]);
  });

  it('shows the destinations without a time in Unscheduled', () => {
    const r = row({ id: 'u', destinations: [at('timed', '2026-10-16T14:00:00.000Z'), at('open', null), at('tt', null, { accountId: 'acc_tt' })] });
    expect(untimedDestinations(r, '').map((d) => d.id)).toEqual(['open', 'tt']);
    expect(untimedDestinations(r, 'acc_tt').map((d) => d.id)).toEqual(['tt']);
  });

  it('scopes to a project once the directory knows it, and tells a missing project from one still loading', () => {
    const projects = [{ id: 'p1', name: 'Launch' }];
    expect(calendarScope(undefined, { ready: false, projects: [] })).toEqual({ kind: 'all' });
    expect(calendarScope('p1', { ready: true, projects })).toEqual({ kind: 'project', projectId: 'p1', name: 'Launch' });
    expect(calendarScope('p2', { ready: false, projects })).toEqual({ kind: 'loading', projectId: 'p2' });
    expect(calendarScope('p2', { ready: true, projects })).toEqual({ kind: 'missing', projectId: 'p2' });
  });

  it('never looks for slots before today', () => {
    expect(slotSearchStart('2026-09-28', '2026-10-14')).toBe('2026-10-14');
    expect(slotSearchStart('2026-11-30', '2026-10-14')).toBe('2026-11-30');
  });

  it('reads back only calendar drags', () => {
    const drag = { publicationId: 'p', revision: 3, destinationIds: ['d1', 'd2'] };
    expect(parseDrag(encodeDrag(drag))).toEqual(drag);
    expect(parseDrag('not json')).toBeNull();
    expect(parseDrag(JSON.stringify({ publicationId: 'p', revision: 3, destinationIds: [] }))).toBeNull();
    expect(parseDrag(JSON.stringify({ publicationId: 'p', revision: '3', destinationIds: ['d'] }))).toBeNull();
  });
});

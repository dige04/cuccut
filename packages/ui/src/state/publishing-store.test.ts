import { afterEach, describe, expect, it } from 'vitest';
import { PUBLISHING_SETTINGS_DEFAULTS, type PublishingSnapshot } from '@cuccut/protocol';
import { account, connection, row, rowDestination } from '../model/publishing-test-fixtures.ts';
import { usePublishing } from './publishing-store.ts';

const settings = { ...PUBLISHING_SETTINGS_DEFAULTS, timezone: 'UTC' };

function snapshot(overrides: Partial<PublishingSnapshot> = {}): PublishingSnapshot {
  return { settings, connections: [connection()], accounts: [account({ id: 'acc_yt' })], publications: [], degraded: null, ...overrides };
}

const queued = (id: string, revision = 1) =>
  row({ id, revision, destinations: [rowDestination({ id: `${id}_d`, state: 'queued', at: '2026-10-13T09:00:00.000Z' })] });

afterEach(() => usePublishing.getState().reset());

describe('publishing mirror', () => {
  it('replaces from the snapshot and applies upserts, removals, settings and connections', () => {
    const s = usePublishing.getState();
    expect(s.ready).toBe(false);
    s.replace(snapshot({ publications: [row({ id: 'a' }), row({ id: 'b' })] }));
    expect(usePublishing.getState()).toMatchObject({ ready: true, settings, degraded: null });

    usePublishing.getState().apply({ type: 'publication.upserted', row: row({ id: 'a', revision: 2, label: 'Renamed' }) });
    usePublishing.getState().apply({ type: 'publication.upserted', row: row({ id: 'c' }) });
    usePublishing.getState().apply({ type: 'publication.removed', publicationId: 'b' });
    expect(usePublishing.getState().publications.map((p) => [p.id, p.label])).toEqual([
      ['a', 'Renamed'],
      ['c', 'Clip c'],
    ]);

    usePublishing.getState().apply({ type: 'settings.updated', settings: { ...settings, timezone: 'Asia/Ho_Chi_Minh' } });
    usePublishing.getState().apply({ type: 'connections.updated', connections: [], accounts: [] });
    expect(usePublishing.getState()).toMatchObject({ settings: { timezone: 'Asia/Ho_Chi_Minh' }, connections: [], accounts: [] });
  });

  it('ignores an upsert older than the row it has (a write result can arrive before the topic event)', () => {
    usePublishing.getState().replace(snapshot({ publications: [row({ id: 'a', revision: 5, label: 'New' })] }));
    usePublishing.getState().apply({ type: 'publication.upserted', row: row({ id: 'a', revision: 4, label: 'Old' }) });
    expect(usePublishing.getState().publications[0]).toMatchObject({ revision: 5, label: 'New' });
  });

  it('queues each due reminder once and drops it when the destination stops waiting or is dismissed', () => {
    usePublishing.getState().replace(snapshot({ publications: [queued('a'), queued('b')] }));
    const due = (id: string) => ({ type: 'due' as const, publicationId: id, destinationId: `${id}_d`, at: '2026-10-13T09:00:00.000Z' });
    usePublishing.getState().apply(due('a'));
    usePublishing.getState().apply(due('a'));
    usePublishing.getState().apply(due('b'));
    expect(usePublishing.getState().due.map((d) => d.publicationId)).toEqual(['a', 'b']);

    // The owner recorded a result for a: it no longer waits.
    usePublishing.getState().apply({
      type: 'publication.upserted',
      row: row({ id: 'a', revision: 2, destinations: [rowDestination({ id: 'a_d', state: 'published' })] }),
    });
    expect(usePublishing.getState().due.map((d) => d.publicationId)).toEqual(['b']);

    usePublishing.getState().dismissDue('b', 'b_d');
    expect(usePublishing.getState().due).toEqual([]);
  });

  it('a new snapshot keeps only reminders that still wait', () => {
    usePublishing.getState().replace(snapshot({ publications: [queued('a')] }));
    usePublishing.getState().apply({ type: 'due', publicationId: 'a', destinationId: 'a_d', at: '2026-10-13T09:00:00.000Z' });
    usePublishing.getState().replace(snapshot({ publications: [queued('a', 2)] }));
    expect(usePublishing.getState().due).toHaveLength(1);
    usePublishing.getState().replace(snapshot({ publications: [] }));
    expect(usePublishing.getState().due).toEqual([]);
  });
});

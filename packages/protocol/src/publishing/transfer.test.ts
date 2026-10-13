import { describe, expect, it } from 'vitest';
import { RpcError } from '../wire.ts';
import type { CalendarArchive } from '../publishing.ts';
import {
  buildCalendarArchive,
  calendarArchiveFileName,
  importedCalendarPublication,
  inspectCalendarImport,
  parseCalendarArchive,
  portableCalendarPublication,
  type CalendarImportLocal,
} from './transfer.ts';
import { testAccount, testConnection, testDestination, testPublication, TEST_NOW } from './testing.ts';

const payload = {
  exportId: 'sha256:x',
  accountId: 'acc_yt',
  connectionId: 'conn_1',
  remoteAccountId: '@acc_yt',
  network: 'youtube' as const,
  format: 'youtube-short' as const,
  title: 'T',
  caption: 'C',
  hashtags: [],
  options: testDestination({ id: 'x', accountId: 'y' }).options,
  scheduledAt: null,
  timezone: 'UTC',
};

function source() {
  const accounts = [testAccount({ id: 'acc_yt' }), testAccount({ id: 'acc_ig', network: 'instagram' })];
  const connections = [testConnection()];
  const publications = [
    testPublication({
      id: 'pub_a',
      exportId: 'sha256:x',
      approval: { exportId: 'sha256:x', by: 'human', actor: 'desktop', at: TEST_NOW },
      authorization: { revision: 0, at: TEST_NOW },
      proposal: { revision: 0, copy: { title: 'a', description: 'b', hashtags: [] }, reason: 'r', jobId: 'job', at: TEST_NOW },
      scheduledAt: '2026-10-20T18:00:00Z',
      destinations: [
        testDestination({ id: 'd1', accountId: 'acc_yt', state: 'queued', payload, payloadHash: 'h', evidence: ['e'] }),
        testDestination({ id: 'd2', accountId: 'acc_ig', format: 'instagram-reel', state: 'published', publishedAt: '2026-10-19T08:00:00Z' }),
      ],
    }),
    testPublication({ id: 'pub_b', destinations: [testDestination({ id: 'd3', accountId: 'acc_yt' })] }),
  ];
  return { accounts, connections, publications };
}

function archive(): CalendarArchive {
  return buildCalendarArchive({ timezone: 'Europe/Berlin', ...source(), now: new Date(TEST_NOW) });
}

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).details).toEqual({ code: 'CALENDAR_INVALID' });
    return (error as RpcError).messageRef!.key.replace('publishingIssues.', '');
  }
  throw new Error('expected a refusal');
}

describe('calendar export', () => {
  it('strips payloads, evidence, export IDs, approvals, authorizations and proposals', () => {
    const file = archive();
    expect(file).toMatchObject({ format: 'cuccut-calendar', version: 1, exportedAt: TEST_NOW, timezone: 'Europe/Berlin' });
    const [a] = file.publications;
    expect(a).toMatchObject({ exportId: null, approval: null, authorization: null, proposal: null });
    expect(a!.destinations[0]).toMatchObject({ state: 'queued', payload: null, payloadHash: null, evidence: [] });
    expect(a!.destinations[1]).toMatchObject({ state: 'published', publishedAt: '2026-10-19T08:00:00Z' });
    expect(file.accounts[0]).toEqual({ id: 'acc_yt', connectionId: 'conn_1', remoteId: '@acc_yt', network: 'youtube', name: 'acc_yt', equivalentTo: null });
    expect(file.connections).toEqual([{ id: 'conn_1', provider: 'manual', name: 'By hand' }]);
    expect(JSON.stringify(file)).not.toContain('sha256:x');
    // The source records are not changed.
    const original = source().publications[0]!;
    expect(portableCalendarPublication(original)).not.toBe(original);
    expect(original.exportId).toBe('sha256:x');
    expect(calendarArchiveFileName(new Date(TEST_NOW))).toBe('cuccut-calendar-2026-10-13.json');
  });

  it('round-trips through JSON', () => {
    const file = archive();
    expect(parseCalendarArchive(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });
});

describe('calendar file checks', () => {
  it('rejects other formats and versions', () => {
    expect(refusal(() => parseCalendarArchive({ ...archive(), format: 'agentcut-calendar' }))).toBe('archiveInvalid');
    expect(refusal(() => parseCalendarArchive({ ...archive(), version: 2 }))).toBe('archiveInvalid');
    expect(refusal(() => parseCalendarArchive('nope'))).toBe('archiveInvalid');
  });

  it('rejects duplicates', () => {
    const file = archive();
    expect(refusal(() => parseCalendarArchive({ ...file, publications: [file.publications[0], file.publications[0]] }))).toBe('archiveDuplicatePublications');
    expect(refusal(() => parseCalendarArchive({ ...file, accounts: [...file.accounts, file.accounts[0]] }))).toBe('archiveDuplicateAccounts');
    expect(refusal(() => parseCalendarArchive({ ...file, connections: [...file.connections, file.connections[0]] }))).toBe('archiveDuplicateConnections');
    const twice = structuredClone(file);
    twice.publications[0]!.destinations[1]!.accountId = 'acc_yt';
    expect(refusal(() => parseCalendarArchive(twice))).toBe('archiveDuplicateDestinations');
  });

  it('rejects missing connections and accounts, bad links, timezones and dates', () => {
    const file = archive();
    expect(refusal(() => parseCalendarArchive({ ...file, connections: [] }))).toBe('archiveMissingConnection');
    expect(refusal(() => parseCalendarArchive({ ...file, accounts: [file.accounts[0]] }))).toBe('archiveMissingAccount');
    const linked = structuredClone(file);
    linked.accounts[1]!.equivalentTo = 'acc_yt';
    expect(refusal(() => parseCalendarArchive(linked))).toBe('archiveLinkedAccount');
    expect(refusal(() => parseCalendarArchive({ ...file, timezone: 'Mars/Base' }))).toBe('archiveTimezone');
    const zone = structuredClone(file);
    zone.publications[1]!.timezone = 'Nowhere/City';
    expect(refusal(() => parseCalendarArchive(zone))).toBe('archiveTimezone');
    const date = structuredClone(file) as unknown as { publications: Array<{ destinations: Array<{ publishedAt: string }> }> };
    date.publications[0]!.destinations[1]!.publishedAt = '2026-13-45T00:00:00Z';
    expect(refusal(() => parseCalendarArchive(date))).toBe('archiveInvalid');
  });
});

describe('calendar import', () => {
  const local = (overrides: Partial<CalendarImportLocal> = {}): CalendarImportLocal => ({
    timezone: 'UTC',
    publicationIds: new Set(),
    accounts: [],
    connections: [],
    videoAvailable: () => true,
    ...overrides,
  });

  it('plans an append-only import; in-flight deliveries become unknown; new accounts need reconnecting', () => {
    const plan = inspectCalendarImport(archive(), local({ publicationIds: new Set(['pub_b']), videoAvailable: (id) => id !== 'video_1' }));
    expect(plan.preview).toEqual({
      total: 2,
      added: 1,
      skipped: 1,
      reconnect: 2,
      missingVideos: 1,
      uncertain: 1,
      timezone: 'Europe/Berlin',
      firstDay: '2026-10-19',
    });
    expect(plan.publications.map((p) => p.id)).toEqual(['pub_a']);
    const d1 = plan.publications[0]!.destinations[0]!;
    expect(d1.state).toBe('unknown');
    expect(d1.errorRef).toEqual({ key: 'publishingIssues.importedInFlight' });
    expect(d1.error).toBeTruthy();
    expect(plan.publications[0]!.destinations[1]!.state).toBe('published');
    expect(plan.accounts.every((a) => a.needsReconnect && !a.disabled)).toBe(true);
    expect(plan.connections).toEqual([testConnection({ configured: true })]);
  });

  it('existing connections and accounts are kept; identity conflicts are refused', () => {
    const { accounts, connections } = source();
    const plan = inspectCalendarImport(archive(), local({ accounts, connections }));
    expect(plan.accounts).toEqual([]);
    expect(plan.connections).toEqual([]);
    expect(plan.preview.reconnect).toBe(0);
    expect(refusal(() => inspectCalendarImport(archive(), local({ connections: [testConnection({ provider: 'postgun' })] })))).toBe('importConnectionConflict');
    expect(refusal(() => inspectCalendarImport(archive(), local({ accounts: [testAccount({ id: 'acc_yt', remoteId: '@someone-else' })] })))).toBe(
      'importAccountConflict',
    );
  });

  it('an imported publication never keeps a queue', () => {
    const p = testPublication({ destinations: [testDestination({ id: 'x', accountId: 'a', state: 'sending' }), testDestination({ id: 'y', accountId: 'b', state: 'failed' })] });
    expect(importedCalendarPublication(p).destinations.map((d) => d.state)).toEqual(['unknown', 'failed']);
  });
});

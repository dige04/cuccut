import { afterEach, describe, expect, it } from 'vitest';
import { PUBLISHING_SETTINGS_DEFAULTS, RpcError } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { detail, publication, row } from '../model/publishing-test-fixtures.ts';
import { usePublishing } from '../state/publishing-store.ts';
import {
  approveExport,
  PublishingCommandError,
  removeAccount,
  reschedulePublication,
  resetPublishingCommands,
  restoreAccount,
  rowOf,
  updatePublication,
  usePublishingBusy,
} from './publishing-commands.ts';
import type { RuntimeSession } from './session.ts';

/** Fake session: answers by method name, records each call; `hold` keeps answers pending until released. */
function fakeSession(answer: (method: string, params: Record<string, unknown>) => unknown) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  let release: (() => void) | null = null;
  let gate: Promise<void> | null = null;
  const session = {
    client: {
      request: async (method: string, params: Record<string, unknown>) => {
        calls.push({ method, params });
        if (gate) await gate;
        return answer(method, params);
      },
    },
  } as unknown as Pick<RuntimeSession, 'client'>;
  return {
    session,
    calls,
    hold() {
      gate = new Promise<void>((resolve) => (release = resolve));
    },
    release() {
      gate = null;
      release?.();
    },
  };
}

afterEach(() => {
  resetPublishingCommands();
  usePublishing.getState().reset();
});

describe('publishing commands', () => {
  it('returns the saved publication and writes its row into the mirror', async () => {
    usePublishing.getState().replace({
      settings: { ...PUBLISHING_SETTINGS_DEFAULTS, timezone: 'UTC' },
      connections: [],
      accounts: [],
      publications: [row({ id: 'pub_1', revision: 1 })],
      degraded: null,
    });
    const saved = detail({ revision: 2, label: 'Renamed', scheduledAt: '2026-10-20T18:00:00.000Z' });
    const { session, calls } = fakeSession(() => saved);
    const result = await updatePublication(session, 'pub_1', 1, { label: 'Renamed' });
    expect(result.revision).toBe(2);
    expect(calls).toEqual([{ method: 'publishing.update', params: { publicationId: 'pub_1', revision: 1, patch: { label: 'Renamed' } } }]);
    expect(usePublishing.getState().publications[0]).toMatchObject({
      revision: 2,
      label: 'Renamed',
      destinations: [{ id: 'dest_yt', scheduledAt: null, at: '2026-10-20T18:00:00.000Z' }],
    });
  });

  it('single flight: the same call while one runs gets the running promise; another write on that publication is refused', async () => {
    const saved = detail({ revision: 2 });
    const fake = fakeSession(() => saved);
    fake.hold();
    const placements = [{ destinationId: 'dest_yt', at: '2026-10-20T18:00:00.000Z' }];
    const first = reschedulePublication(fake.session, 'pub_1', 1, placements);
    const again = reschedulePublication(fake.session, 'pub_1', 1, placements);
    expect(again).toBe(first);
    expect(usePublishingBusy.getState().busy).toEqual({ pub_1: 'reschedule' });
    await expect(approveExport(fake.session, 'pub_1', 1)).rejects.toMatchObject({ code: 'PUBLICATION_BUSY', message: PC.form.busy });
    // Another publication is not held up.
    const other = approveExport(fake.session, 'pub_2', 1);
    fake.release();
    await Promise.all([first, other]);
    expect(fake.calls.map((c) => c.method)).toEqual(['publishing.reschedule', 'publishing.approve']);
    expect(usePublishingBusy.getState().busy).toEqual({});
  });

  it('a revision conflict surfaces the saved publication; validation surfaces the issues', async () => {
    const current = publication({ revision: 3 });
    const issue = { destinationId: null, field: 'approval', code: 'notApproved', message: { key: 'publishingIssues.notApproved' } };
    const { session } = fakeSession((method) => {
      if (method === 'publishing.update') throw new RpcError('conflict', 'changed', { code: 'PUBLICATION_CONFLICT', current });
      throw new RpcError('invalid-request', 'invalid', { code: 'PUBLICATION_INVALID', issues: [issue] });
    });
    const conflict = await updatePublication(session, 'pub_1', 1, { label: 'x' }).catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(PublishingCommandError);
    expect(conflict).toMatchObject({ code: 'PUBLICATION_CONFLICT', conflict: true, message: 'changed' });
    expect((conflict as PublishingCommandError).current?.revision).toBe(3);
    const invalid = await approveExport(session, 'pub_1', 1).catch((e: unknown) => e);
    expect(invalid).toMatchObject({ code: 'PUBLICATION_INVALID', conflict: false, issues: [issue], current: null });
    // The flight ended with the failure, so the next call goes out.
    expect(usePublishingBusy.getState().busy).toEqual({});
  });

  it('account Undo saves the removed account again under its ID, then links it back', async () => {
    const removed = { id: 'acc_2', connectionId: 'conn_1', remoteId: '@b', network: 'youtube' as const, name: 'B', disabled: false, needsReconnect: false, equivalentTo: 'acc_1' };
    const { session, calls } = fakeSession((method) => (method === 'publishing.accounts.remove' ? { account: removed } : { account: removed }));
    const account = await removeAccount(session, 'acc_2');
    await restoreAccount(session, account);
    expect(calls.map((c) => [c.method, c.params])).toEqual([
      ['publishing.accounts.remove', { accountId: 'acc_2' }],
      ['publishing.accounts.save', { id: 'acc_2', connectionId: 'conn_1', network: 'youtube', name: 'B', remoteId: '@b', disabled: false }],
      ['publishing.accounts.link', { accountId: 'acc_2', equivalentTo: 'acc_1' }],
    ]);
  });

  it('rowOf builds the calendar row as the Runtime does', () => {
    const p = detail({
      scheduledAt: '2026-10-20T18:00:00.000Z',
      status: 'approved',
      destinations: [
        { ...publication().destinations[0]!, id: 'own', scheduledAt: '2026-10-21T08:00:00.000Z' },
        { ...publication().destinations[0]!, id: 'default', accountId: 'acc_tt', format: 'tiktok-video' },
      ],
    });
    expect(rowOf(p)).toMatchObject({
      id: 'pub_1',
      status: 'approved',
      destinations: [
        { id: 'own', scheduledAt: '2026-10-21T08:00:00.000Z', at: '2026-10-21T08:00:00.000Z' },
        { id: 'default', scheduledAt: null, at: '2026-10-20T18:00:00.000Z' },
      ],
    });
  });
});

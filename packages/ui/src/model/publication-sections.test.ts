import { describe, expect, it } from 'vitest';
import type { PublicationDestination, PublicationIssue } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { draftOf } from './publication-form.ts';
import {
  accountTimes,
  canWithdraw,
  EMPTY_RECORD,
  exportControls,
  formatsOf,
  handoverText,
  issueText,
  pinnedExportPath,
  proposalStale,
  recordable,
  recordBlock,
  recordParams,
  reserveBlock,
  withProposal,
} from './publication-sections.ts';
import { account, detail, publication } from './publishing-test-fixtures.ts';

const base = publication().destinations[0]!;
const dest = (overrides: Partial<PublicationDestination> = {}): PublicationDestination => ({ ...base, ...overrides });
const idle = { busy: false, dirty: false, readOnly: false };

describe('video column controls', () => {
  it('offers Render and pin, then Render and replace once an export is pinned', () => {
    expect(exportControls(detail(), idle).renderLabel).toBe(PC.form.renderPin);
    expect(exportControls(detail({ exportId: 'sha256:a' }), idle).renderLabel).toBe(PC.form.renderReplace);
  });

  it('says why pinning is unavailable, in the order the owner fixes it', () => {
    expect(exportControls(detail(), idle).pinBlock).toBeNull();
    expect(exportControls(detail({ videoAvailable: false }), idle).pinBlock).toBe(PC.form.videoUnavailable);
    expect(exportControls(detail({ destinations: [dest({ state: 'queued' })] }), idle).pinBlock).toBe(PC.form.locked);
    expect(exportControls(detail(), { ...idle, dirty: true }).pinBlock).toBe(PC.form.needsSave);
    expect(exportControls(detail(), { ...idle, busy: true }).pinBlock).toBe(PC.form.busy);
    const rendering = detail({ pinJob: { jobId: 'job_1', at: '2026-10-13T10:00:00.000Z', error: null, errorRef: null } });
    expect(exportControls(rendering, idle)).toMatchObject({ rendering: true, pinBlock: PC.form.rendering });
  });

  it('shows why a render did not pin, and lets it be tried again', () => {
    const failed = detail({ pinJob: { jobId: 'job_1', at: '2026-10-13T10:00:00.000Z', error: 'Disk full', errorRef: null } });
    expect(exportControls(failed, idle)).toMatchObject({ rendering: false, renderError: 'Disk full', pinBlock: null });
  });

  it('offers Approve export only for a pinned export that is not approved', () => {
    expect(exportControls(detail(), idle)).toMatchObject({ approveVisible: false, approveBlock: PC.form.approveNeedsExport });
    expect(exportControls(detail({ exportId: 'sha256:a' }), idle)).toMatchObject({ approveVisible: true, approveBlock: null });
    expect(exportControls(detail({ exportId: 'sha256:a', approved: true }), idle).approveVisible).toBe(false);
    expect(exportControls(detail({ exportId: 'sha256:a' }), { ...idle, dirty: true }).approveBlock).toBe(PC.form.needsSave);
  });
});

describe('text proposals', () => {
  it('is current right after it was stored, stale after a later change', () => {
    const proposal = { revision: 3, copy: { title: 'T', description: 'D', hashtags: ['x'] }, reason: 'r', jobId: null, at: '2026-10-13T10:00:00.000Z' };
    expect(proposalStale({ proposal, revision: 4 })).toBe(false);
    expect(proposalStale({ proposal, revision: 5 })).toBe(true);
    expect(proposalStale({ proposal: null, revision: 9 })).toBe(false);
  });

  it('uses one part or all of it', () => {
    const copy = { title: 'Old', description: 'Old text', hashtags: ['old'] };
    const proposed = { title: 'New', description: 'New text', hashtags: ['new'] };
    expect(withProposal(copy, proposed, 'title')).toEqual({ title: 'New', description: 'Old text', hashtags: ['old'] });
    expect(withProposal(copy, proposed, 'hashtags')).toEqual({ title: 'Old', description: 'Old text', hashtags: ['new'] });
    expect(withProposal(copy, proposed, 'all')).toEqual(proposed);
  });
});

describe('time card', () => {
  it('lists account times only when some account has its own time', () => {
    const accounts = [account({ id: 'acc_yt', name: 'Main channel' })];
    expect(accountTimes(draftOf(publication()), accounts)).toEqual([]);
    const own = draftOf(publication({ destinations: [{ ...base, scheduledAt: '2026-10-20T18:00:00.000Z' }] }));
    expect(accountTimes(own, accounts)).toEqual([{ accountId: 'acc_yt', name: 'Main channel', own: '2026-10-20T18:00:00.000Z' }]);
  });

  it('needs weekly times before it reserves a slot', () => {
    expect(reserveBlock({ ...idle, locked: false, slots: 0 })).toBe(PC.form.reserveNeedsSlots);
    expect(reserveBlock({ ...idle, locked: false, slots: 2 })).toBeNull();
    expect(reserveBlock({ ...idle, dirty: true, locked: false, slots: 2 })).toBe(PC.form.needsSave);
    expect(reserveBlock({ ...idle, locked: true, slots: 2 })).toBe(PC.form.locked);
  });
});

describe('delivery tab', () => {
  it('withdraws only a by-hand destination waiting for the owner', () => {
    expect(canWithdraw({ state: 'queued' }, true)).toBe(true);
    expect(canWithdraw({ state: 'queued' }, false)).toBe(false);
    expect(canWithdraw({ state: 'scheduled' }, true)).toBe(false);
  });

  it('records results only for handed-over destinations that are not settled', () => {
    expect(recordable({ state: 'queued' })).toBe(true);
    expect(recordable({ state: 'unknown' })).toBe(true);
    expect(recordable({ state: 'not_sent' })).toBe(false);
    expect(recordable({ state: 'published' })).toBe(false);
  });

  it('hands over the frozen payload text, or the composed text before sending', () => {
    const p = publication();
    expect(handoverText(p, dest())).toEqual({ title: 'Title', caption: 'Caption\n\n#one' });
    const frozen = dest({ payload: { ...({} as NonNullable<PublicationDestination['payload']>), title: 'Frozen', caption: 'Frozen caption' } });
    expect(handoverText(p, frozen)).toEqual({ title: 'Frozen', caption: 'Frozen caption' });
  });

  it('says what a recorded result still needs', () => {
    const ctx = { owner: true, busy: false, readOnly: false };
    expect(recordBlock(EMPTY_RECORD, { ...ctx, owner: false })).toBe(PC.settings.ownerOnly);
    expect(recordBlock(EMPTY_RECORD, ctx)).toBe(PC.handover.verifiedHint);
    expect(recordBlock({ ...EMPTY_RECORD, note: 'Saw it in the app' }, { ...ctx, dirty: true })).toBe(PC.form.needsSave);
    expect(recordBlock({ ...EMPTY_RECORD, state: 'scheduled', note: 'Saw it in the app' }, ctx)).toBe(PC.handover.needsTime);
    expect(recordBlock({ ...EMPTY_RECORD, url: 'not a link', note: 'Saw it in the app' }, ctx)).toBe(PC.handover.badLink);
    const ready = { ...EMPTY_RECORD, url: ' https://youtu.be/x ', note: ' Saw it on the channel page ' };
    expect(recordBlock(ready, ctx)).toBeNull();
    expect(recordParams({ id: 'pub_1', revision: 4 }, 'dest_yt', ready)).toEqual({
      publicationId: 'pub_1',
      revision: 4,
      destinationId: 'dest_yt',
      state: 'published',
      remoteUrl: 'https://youtu.be/x',
      at: null,
      note: 'Saw it on the channel page',
    });
  });
});

describe('helpers', () => {
  it('lists the formats of a network', () => {
    expect(formatsOf('youtube')).toEqual(['youtube-video', 'youtube-short']);
    expect(formatsOf('tiktok')).toEqual(['tiktok-video']);
  });

  it('finds the pinned export under the Runtime home on either platform', () => {
    expect(pinnedExportPath('/Users/me/.cuccut', 'abc')).toBe('/Users/me/.cuccut/publishing/exports/abc.mp4');
    expect(pinnedExportPath('C:\\Users\\me\\.cuccut\\', 'abc')).toBe('C:\\Users\\me\\.cuccut\\publishing\\exports\\abc.mp4');
  });

  it('renders an issue from its message reference, falling back to its code', () => {
    const issue: PublicationIssue = { destinationId: null, field: 'accounts', code: 'accountsRequired', message: { key: 'nope.missing', params: {} } };
    expect(issueText(issue)).toBe('accountsRequired');
  });
});

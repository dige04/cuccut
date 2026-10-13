import { describe, expect, it } from 'vitest';
import type { PublicationDestination } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import {
  captionPreview,
  EMPTY_FORM,
  formReducer,
  formTabs,
  isDirty,
  isReviewed,
  primaryAction,
  sendBlock,
  toUpdateParams,
  type FormAction,
  type FormState,
} from './publication-form.ts';
import { account, detail, publication } from './publishing-test-fixtures.ts';

const base = publication().destinations[0]!;
const dest = (overrides: Partial<PublicationDestination> & Pick<PublicationDestination, 'id' | 'accountId'>): PublicationDestination => ({
  ...base,
  ...overrides,
});

function run(state: FormState, ...actions: FormAction[]): FormState {
  return actions.reduce(formReducer, state);
}

const loaded = (overrides = {}) => run(EMPTY_FORM, { type: 'load', publication: detail(overrides) });

describe('publication draft', () => {
  it('is clean when loaded, dirty after an edit, clean again after Discard', () => {
    let s = loaded();
    expect(isDirty(s)).toBe(false);
    s = run(s, { type: 'edit', patch: { label: 'New name' } });
    expect(isDirty(s)).toBe(true);
    s = run(s, { type: 'discard' });
    expect(isDirty(s)).toBe(false);
    expect(s.draft!.label).toBe('Launch clip');
  });

  it('Undo of Discard brings the draft back, but not onto a newer saved version', () => {
    const edited = run(loaded(), { type: 'edit', patch: { label: 'New name' } });
    const discarded = run(edited, { type: 'discard' });
    const restored = run(discarded, { type: 'restore', draft: edited.draft!, revision: 1 });
    expect(restored.draft!.label).toBe('New name');
    expect(isDirty(restored)).toBe(true);
    const newer = run(discarded, { type: 'external', publication: detail({ revision: 2 }) });
    expect(run(newer, { type: 'restore', draft: edited.draft!, revision: 1 }).draft!.label).toBe('Launch clip');
  });

  it('saves only the changed fields and parses typed hashtags', () => {
    const s = run(loaded(), { type: 'edit', patch: { text: { hashtags: '#one  two #two' } } });
    expect(toUpdateParams(s)).toEqual({
      publicationId: 'pub_1',
      revision: 1,
      patch: { copy: { title: 'Title', description: 'Caption', hashtags: ['one', 'two'] } },
    });
    // The same tags typed differently are no change.
    expect(isDirty(run(loaded(), { type: 'edit', patch: { text: { hashtags: 'one' } } }))).toBe(false);
  });

  it('adds and removes accounts; sends destinations already handed over exactly as saved', () => {
    const sent = dest({ id: 'sent', accountId: 'acc_ig', format: 'instagram-reel', state: 'queued', overrides: { title: null, description: 'Own', hashtags: ['x'] } });
    let s = loaded({ destinations: [base, sent] });
    s = run(
      s,
      { type: 'toggleAccount', account: account({ id: 'acc_tt', network: 'tiktok' }), on: true },
      { type: 'toggleAccount', account: account({ id: 'acc_yt' }), on: false },
      // A handed-over destination cannot be removed or edited here.
      { type: 'toggleAccount', account: account({ id: 'acc_ig', network: 'instagram' }), on: false },
      { type: 'setDestination', accountId: 'acc_ig', patch: { overrides: { description: 'Changed' } } },
    );
    expect(s.draft!.destinations.map((d) => [d.accountId, d.format])).toEqual([
      ['acc_ig', 'instagram-reel'],
      ['acc_tt', 'tiktok-video'],
    ]);
    const params = toUpdateParams(s)!;
    expect(params.patch).toEqual({});
    expect(params.destinations).toEqual([
      { id: 'sent', accountId: 'acc_ig', format: 'instagram-reel', overrides: sent.overrides, options: sent.options, scheduledAt: null },
      expect.objectContaining({ accountId: 'acc_tt', format: 'tiktok-video', overrides: { title: null, description: null, hashtags: null } }),
    ]);
    expect(params.destinations![1]).not.toHaveProperty('id');
  });

  it('refuses shared edits once a destination was handed over', () => {
    const s = run(loaded({ destinations: [dest({ id: 'sent', accountId: 'acc_yt', state: 'queued' })] }), { type: 'edit', patch: { label: 'x' } });
    expect(isDirty(s)).toBe(false);
  });

  it('a change from elsewhere replaces a clean draft but becomes a conflict that keeps a dirty draft', () => {
    const newer = detail({ revision: 2, label: 'Renamed elsewhere' });
    expect(run(loaded(), { type: 'external', publication: newer }).draft!.label).toBe('Renamed elsewhere');
    const dirty = run(loaded(), { type: 'edit', patch: { label: 'Mine' } }, { type: 'external', publication: newer });
    expect(dirty.conflict?.revision).toBe(2);
    expect(dirty.draft!.label).toBe('Mine');
    expect(dirty.saved!.revision).toBe(1);
    // An older or equal revision changes nothing.
    expect(run(dirty, { type: 'external', publication: detail({ revision: 1 }) })).toBe(dirty);
    // Reload: the saved version replaces the draft and clears the conflict.
    const reloaded = run(dirty, { type: 'load', publication: newer });
    expect(reloaded).toMatchObject({ conflict: null, draft: { label: 'Renamed elsewhere' } });
  });

  it('the review checkbox holds only for the revision and pinned export it was ticked for', () => {
    let s = run(loaded({ exportId: 'sha256:a' }), { type: 'review', checked: true });
    expect(isReviewed(s)).toBe(true);
    s = run(s, { type: 'edit', patch: { label: 'x' } });
    expect(isReviewed(s)).toBe(false);
    s = run(s, { type: 'discard' });
    expect(isReviewed(s)).toBe(true);
    s = run(s, { type: 'saved', publication: detail({ revision: 2, exportId: 'sha256:a' }) });
    expect(s.reviewed).toBeNull();
    s = run(s, { type: 'review', checked: true }, { type: 'load', publication: detail({ revision: 2, exportId: 'sha256:b' }) });
    expect(isReviewed(s)).toBe(false);
  });
});

describe('derived values', () => {
  it('names the primary action from the times of the destinations still to send', () => {
    const timed = dest({ id: 'a', accountId: 'acc_yt', scheduledAt: '2026-10-20T18:00:00.000Z' });
    const untimed = dest({ id: 'b', accountId: 'acc_tt', format: 'tiktok-video' });
    const sent = dest({ id: 'c', accountId: 'acc_ig', format: 'instagram-reel', state: 'published' });
    expect(primaryAction(publication({ destinations: [timed, sent] }))).toBe('schedule');
    expect(primaryAction(publication({ destinations: [untimed, sent] }))).toBe('sendNow');
    expect(primaryAction(publication({ destinations: [timed, untimed] }))).toBe('send');
    // The default time counts for destinations without their own.
    expect(primaryAction(publication({ scheduledAt: '2026-10-20T18:00:00.000Z', destinations: [timed, untimed] }))).toBe('schedule');
  });

  it('says why sending is not available, in the order the owner fixes it', () => {
    const ready = { exportId: 'sha256:a', approved: true };
    expect(sendBlock(loaded({ ...ready }))).toBe(PC.form.needsReview);
    expect(sendBlock(run(loaded({ ...ready }), { type: 'review', checked: true }))).toBeNull();
    expect(sendBlock(run(loaded({ ...ready }), { type: 'review', checked: true }), { owner: false })).toBe(PC.form.webOnly);
    expect(sendBlock(loaded({ ...ready, issues: [{ destinationId: null, field: 'time', code: 'x', message: { key: 'k' } }] }))).toBe(PC.form.hasIssues);
    expect(sendBlock(loaded())).toBe(PC.form.needsExport);
    expect(sendBlock(loaded({ destinations: [] }))).toBe(PC.form.needsAccounts);
    expect(sendBlock(run(loaded(), { type: 'edit', patch: { label: 'x' } }))).toBe(PC.form.needsSave);
    expect(sendBlock(loaded({ ...ready, destinations: [dest({ id: 'p', accountId: 'acc_yt', state: 'published' })] }))).toBe(PC.form.allSent);
  });

  it('names destination tabs by network, or by account when two share a network', () => {
    const accounts = [account({ id: 'acc_yt', name: 'Main' }), account({ id: 'acc_yt2', name: 'Second' }), account({ id: 'acc_tt', network: 'tiktok', name: 'Clips' })];
    const one = loaded({ destinations: [base, dest({ id: 't', accountId: 'acc_tt', format: 'tiktok-video' })] });
    expect(formTabs(one.draft!, accounts).map((t) => t.label)).toEqual([PC.form.sharedText, 'YouTube', 'TikTok', PC.form.delivery]);
    const two = loaded({ destinations: [base, dest({ id: 'y2', accountId: 'acc_yt2', format: 'youtube-video' })] });
    expect(formTabs(two.draft!, accounts).map((t) => t.label)).toEqual([PC.form.sharedText, 'Main', 'Second', PC.form.delivery]);
  });

  it('previews the composed caption with its count and the network limit', () => {
    let s = loaded({ copy: { title: 'T'.repeat(101), description: 'Hello #one', hashtags: ['one', 'two'] } });
    expect(captionPreview(s.draft!, 'acc_yt')).toMatchObject({
      caption: 'Hello #one\n\n#two',
      count: 16,
      limit: 5000,
      over: false,
      titleCount: 101,
      titleLimit: 100,
      titleOver: true,
    });
    s = run(s, { type: 'setDestination', accountId: 'acc_yt', patch: { overrides: { hashtags: '' } } });
    expect(captionPreview(s.draft!, 'acc_yt')!.caption).toBe('Hello #one');
    s = run(s, { type: 'resetDestinationText', accountId: 'acc_yt' });
    expect(captionPreview(s.draft!, 'acc_yt')!.caption).toBe('Hello #one\n\n#two');
  });
});

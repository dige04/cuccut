import { describe, expect, it } from 'vitest';
import { PC } from '../components/publishing/publishing-copy.ts';
import {
  accountFieldsBlock,
  accountInUse,
  accountRowLabel,
  confirmAccountParams,
  connectionInUse,
  hasScheduleErrors,
  linkBlock,
  linkOptions,
  NEW_SLOT,
  parseWhole,
  publishingRailSummary,
  removeBlock,
  retentionSettings,
  scheduleDirty,
  scheduleDraftOf,
  scheduleErrors,
  scheduleReducer,
  scheduleSettings,
  scheduleSync,
  settingsTabOf,
  WEEKDAYS_MONDAY_FIRST,
  weekdayName,
} from './publishing-settings.ts';
import { account, connection, row, rowDestination, settings } from './publishing-test-fixtures.ts';

const accounts = [account({ id: 'acc_yt' }), account({ id: 'acc_ig', network: 'instagram' })];

describe('schedule draft', () => {
  it('lists weekdays Monday first and names them in the reader’s language', () => {
    expect(WEEKDAYS_MONDAY_FIRST).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayName(1, 'en')).toBe('Monday');
    expect(weekdayName(0, 'en')).toBe('Sunday');
  });

  it('adds Monday 18:00, edits and removes weekly times', () => {
    let draft = scheduleDraftOf(settings());
    draft = scheduleReducer(draft, { type: 'addSlot' });
    expect(draft.slots).toEqual([NEW_SLOT]);
    draft = scheduleReducer(draft, { type: 'editSlot', index: 0, patch: { weekday: 5, time: '09:30' } });
    expect(draft.slots).toEqual([{ weekday: 5, time: '09:30' }]);
    draft = scheduleReducer(draft, { type: 'removeSlot', index: 0 });
    expect(draft.slots).toEqual([]);
  });

  it('keeps half-typed numbers and says why they cannot be saved', () => {
    const saved = settings();
    const draft = scheduleReducer(scheduleDraftOf(saved), { type: 'edit', patch: { minGapMinutes: '', leadMinutes: '1.5' } });
    const errors = scheduleErrors(draft, accounts);
    expect(errors.minGapMinutes).toBe(PC.settings.minutesInvalid);
    expect(errors.leadMinutes).toBe(PC.settings.minutesInvalid);
    expect(scheduleSettings(draft, saved, accounts)).toBeNull();
    expect(parseWhole(' 45 ', { min: 1, max: 60 })).toBe(45);
    expect(parseWhole('0', { min: 1, max: 60 })).toBeNull();
    expect(parseWhole('61', { min: 1, max: 60 })).toBeNull();
  });

  it('refuses bad times, duplicates, an unknown timezone and missing default accounts', () => {
    const draft = {
      ...scheduleDraftOf(settings()),
      timezone: 'Mars/Base',
      slots: [
        { weekday: 1, time: '18:00' },
        { weekday: 1, time: '18:00' },
        { weekday: 2, time: '25:00' },
      ],
      defaultAccountIds: ['acc_gone'],
    };
    const errors = scheduleErrors(draft, accounts);
    expect(errors.timezone).toBe(PC.settings.timezoneInvalid);
    expect(errors.slots).toEqual([null, PC.settings.slotDuplicate, PC.settings.timeInvalid]);
    expect(errors.defaultAccountIds).toBe(PC.settings.defaultAccountMissing);
    expect(hasScheduleErrors(errors)).toBe(true);
  });

  it('saves the draft over the saved settings, keeping retention and the revision read', () => {
    const saved = settings({ archivedRetentionDays: 30, revision: 7 });
    let draft = scheduleDraftOf(saved);
    expect(scheduleDirty(draft, saved)).toBe(false);
    draft = scheduleReducer(draft, { type: 'toggleAccount', accountId: 'acc_ig', on: true });
    draft = scheduleReducer(draft, { type: 'edit', patch: { minGapMinutes: '90', autoPrepare: true, timezone: 'Asia/Bangkok' } });
    draft = scheduleReducer(draft, { type: 'addSlot' });
    expect(scheduleDirty(draft, saved)).toBe(true);
    expect(scheduleSettings(draft, saved, accounts)).toEqual({
      ...saved,
      timezone: 'Asia/Bangkok',
      minGapMinutes: 90,
      autoPrepare: true,
      defaultAccountIds: ['acc_ig'],
      slots: [{ weekday: 1, time: '18:00' }],
    });
    draft = scheduleReducer(draft, { type: 'toggleAccount', accountId: 'acc_ig', on: false });
    expect(draft.defaultAccountIds).toEqual([]);
    const reset = scheduleReducer(draft, { type: 'reset', settings: saved });
    expect(scheduleDirty(reset, saved)).toBe(false);
    expect(scheduleReducer(reset, { type: 'replace', draft })).toBe(draft);
  });

  it('follows newer saved settings while clean and reports a conflict while dirty', () => {
    expect(scheduleSync(3, settings({ revision: 3 }), true)).toBe('same');
    expect(scheduleSync(3, settings({ revision: 4 }), false)).toBe('follow');
    expect(scheduleSync(3, settings({ revision: 4 }), true)).toBe('conflict');
  });

  it('saves retention days only when they are whole days in range', () => {
    const saved = settings();
    expect(retentionSettings('30', saved)).toEqual({ ...saved, archivedRetentionDays: 30 });
    expect(retentionSettings('0', saved)).toBeNull();
    expect(retentionSettings('abc', saved)).toBeNull();
  });
});

describe('accounts and connections', () => {
  it('treats confirmed and unsettled deliveries on live publications as in use', () => {
    const rows = [
      row({ id: 'a', destinations: [rowDestination({ id: 'a1', accountId: 'acc_yt', state: 'queued' })] }),
      row({ id: 'b', archived: true, destinations: [rowDestination({ id: 'b1', accountId: 'acc_ig', state: 'queued' })] }),
      row({ id: 'c', destinations: [rowDestination({ id: 'c1', accountId: 'acc_ig', state: 'published' })] }),
    ];
    expect(accountInUse('acc_yt', rows)).toBe(true);
    expect(accountInUse('acc_ig', rows)).toBe(false);
    expect(connectionInUse('conn_hand', accounts, rows)).toBe(true);
    expect(connectionInUse('conn_other', accounts, rows)).toBe(false);
  });

  it('says why removing is not possible: browser, read-only, then in use', () => {
    expect(removeBlock({ owner: false, readOnly: false, inUse: false })).toBe(PC.settings.ownerOnly);
    expect(removeBlock({ owner: true, readOnly: true, inUse: false })).toBe(PC.form.readOnly);
    expect(removeBlock({ owner: true, readOnly: false, inUse: true })).toBe(PC.settings.inUse);
    expect(removeBlock({ owner: true, readOnly: false, inUse: false })).toBeNull();
  });

  it('asks for a name and the exact handle', () => {
    expect(accountFieldsBlock({ name: ' ', handle: '@me' })).toBe(PC.settings.nameNeeded);
    expect(accountFieldsBlock({ name: 'Me', handle: '' })).toBe(PC.settings.handleNeeded);
    expect(accountFieldsBlock({ name: 'Me', handle: '@me' })).toBeNull();
    expect(accountFieldsBlock({ name: 'By hand' })).toBeNull();
  });

  it('labels accounts with their network and state', () => {
    expect(accountRowLabel(account({ id: 'a', name: 'Studio' }))).toBe(PC.settings.accountRow('Studio', PC.network.youtube));
    expect(accountRowLabel(account({ id: 'a', name: 'Studio', disabled: true, needsReconnect: true }))).toBe(
      `${PC.settings.accountRow('Studio', PC.network.youtube)} ${PC.settings.needsReconnect} ${PC.settings.disabled}`,
    );
  });

  it('"Confirm account" saves an imported account again with its current name and handle, leaving its other settings alone', () => {
    const imported = account({ id: 'a', name: 'Studio', remoteId: '@studio', disabled: true, needsReconnect: true });
    const params = confirmAccountParams(imported);
    expect(params).toEqual({ id: 'a', connectionId: imported.connectionId, network: 'youtube', name: 'Studio', remoteId: '@studio' });
    expect(params).not.toHaveProperty('disabled');
  });

  it('links only to canonical accounts on the same network, and keeps a canonical account fixed', () => {
    const conns = [connection(), connection({ id: 'conn_2', name: 'Second route' })];
    const main = account({ id: 'main', name: 'Main' });
    const alias = account({ id: 'alias', name: 'Alias', connectionId: 'conn_2', equivalentTo: 'main' });
    const other = account({ id: 'ig', network: 'instagram' });
    const all = [main, alias, other];
    expect(linkOptions(alias, all, conns).map((o) => o.value)).toEqual(['', 'main']);
    expect(linkOptions(alias, all, conns)[1]!.label).toBe(PC.settings.sameAs(PC.form.accountTile('Main', 'By hand')));
    const idle = { owner: true, readOnly: false };
    expect(linkBlock(main, all, idle)).toBe(PC.settings.linkCanonical);
    expect(linkBlock(alias, all, idle)).toBeNull();
    expect(linkBlock(other, all, idle)).toBe(PC.settings.linkNone);
    expect(linkBlock(alias, all, { owner: false, readOnly: false })).toBe(PC.settings.ownerOnly);
  });

  it('summarizes the rail line', () => {
    expect(publishingRailSummary(false, [])).toBeNull();
    expect(publishingRailSummary(true, [])).toBe(PC.settings.railNotSet);
    expect(publishingRailSummary(true, accounts)).toBe(PC.settings.railAccounts(2));
  });

  it('reads the tab from ?tab=', () => {
    expect(settingsTabOf('?tab=schedule')).toBe('schedule');
    expect(settingsTabOf('?tab=nope')).toBe('accounts');
    expect(settingsTabOf('')).toBe('accounts');
  });
});

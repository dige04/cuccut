import {
  isValidTimezone,
  UNSETTLED_DELIVERY_STATES,
  type Id,
  type PublicationRow,
  type PublishingAccount,
  type PublishingConnection,
  type PublishingSettings,
  type PublishingSlot,
} from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { networkLabel, providerLabel } from './publishing-labels.ts';

/*
 * Settings → Publishing (design `docs/cuccut/m2-publishing.md` §2.5, port of agentcut `connections-view.tsx`): the pure rules behind the Accounts,
 * Schedule and Advanced tabs. Number fields are drafted as text, so a half-typed value is kept and the reason it cannot be saved is shown, never
 * replaced by a number the owner did not type.
 */

/** Weekdays in the order the schedule lists them (Monday first); values are `PublishingSlot.weekday` (0 = Sunday). */
export const WEEKDAYS_MONDAY_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** "Add weekly time" adds Monday 18:00 (agentcut). */
export const NEW_SLOT: Readonly<PublishingSlot> = Object.freeze({ weekday: 1, time: '18:00' });

/** Bounds of the minute and day fields (the settings schema's). */
export const MINUTES_RANGE = { min: 1, max: 10_080 } as const;
export const DAYS_RANGE = { min: 1, max: 3650 } as const;

/** The weekday's name in the reader's language (no hard-coded names). */
export function weekdayName(weekday: number, locale?: string): string {
  // 2024-01-07 is a Sunday.
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + weekday)));
}

/** A whole number within `range` typed as text, or null. */
export function parseWhole(text: string, range: { min: number; max: number }): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= range.min && value <= range.max ? value : null;
}

const SLOT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---- Schedule tab ----

export interface ScheduleDraft {
  timezone: string;
  slots: PublishingSlot[];
  minGapMinutes: string;
  leadMinutes: string;
  defaultAccountIds: Id[];
  writing: string;
  autoPrepare: boolean;
}

export function scheduleDraftOf(settings: PublishingSettings): ScheduleDraft {
  return {
    timezone: settings.timezone,
    slots: settings.slots.map((slot) => ({ ...slot })),
    minGapMinutes: String(settings.minGapMinutes),
    leadMinutes: String(settings.leadMinutes),
    defaultAccountIds: [...settings.defaultAccountIds],
    writing: settings.writing,
    autoPrepare: settings.autoPrepare,
  };
}

/** Why each field cannot be saved; `slots[i]` is the reason for the i-th weekly time. Empty when the draft can be saved. */
export interface ScheduleErrors {
  timezone?: string;
  slots: (string | null)[];
  minGapMinutes?: string;
  leadMinutes?: string;
  defaultAccountIds?: string;
}

export function scheduleErrors(draft: ScheduleDraft, accounts: readonly Pick<PublishingAccount, 'id'>[]): ScheduleErrors {
  const errors: ScheduleErrors = { slots: [] };
  if (!isValidTimezone(draft.timezone)) errors.timezone = PC.settings.timezoneInvalid;
  const seen = new Set<string>();
  errors.slots = draft.slots.map((slot) => {
    if (!SLOT_TIME.test(slot.time)) return PC.settings.timeInvalid;
    const key = `${slot.weekday}@${slot.time}`;
    if (seen.has(key)) return PC.settings.slotDuplicate;
    seen.add(key);
    return null;
  });
  if (parseWhole(draft.minGapMinutes, MINUTES_RANGE) === null) errors.minGapMinutes = PC.settings.minutesInvalid;
  if (parseWhole(draft.leadMinutes, MINUTES_RANGE) === null) errors.leadMinutes = PC.settings.minutesInvalid;
  if (draft.defaultAccountIds.some((id) => !accounts.some((a) => a.id === id))) errors.defaultAccountIds = PC.settings.defaultAccountMissing;
  return errors;
}

export function hasScheduleErrors(errors: ScheduleErrors): boolean {
  return !!(errors.timezone || errors.minGapMinutes || errors.leadMinutes || errors.defaultAccountIds || errors.slots.some(Boolean));
}

/** The settings the draft saves (everything else, such as retention, kept from `saved`), or null while a field is invalid. */
export function scheduleSettings(draft: ScheduleDraft, saved: PublishingSettings, accounts: readonly Pick<PublishingAccount, 'id'>[]): PublishingSettings | null {
  if (hasScheduleErrors(scheduleErrors(draft, accounts))) return null;
  return {
    ...saved,
    timezone: draft.timezone,
    slots: draft.slots.map((slot) => ({ weekday: slot.weekday, time: slot.time })),
    minGapMinutes: parseWhole(draft.minGapMinutes, MINUTES_RANGE)!,
    leadMinutes: parseWhole(draft.leadMinutes, MINUTES_RANGE)!,
    defaultAccountIds: [...new Set(draft.defaultAccountIds)],
    writing: draft.writing,
    autoPrepare: draft.autoPrepare,
  };
}

/** Whether the draft differs from the saved settings (text fields compared as typed, so "60 " and "60" differ only while invalid). */
export function scheduleDirty(draft: ScheduleDraft, saved: PublishingSettings): boolean {
  return JSON.stringify(draft) !== JSON.stringify(scheduleDraftOf(saved));
}

export type ScheduleAction =
  | { type: 'edit'; patch: Partial<Omit<ScheduleDraft, 'slots'>> }
  | { type: 'addSlot' }
  | { type: 'editSlot'; index: number; patch: Partial<PublishingSlot> }
  | { type: 'removeSlot'; index: number }
  | { type: 'toggleAccount'; accountId: Id; on: boolean }
  | { type: 'reset'; settings: PublishingSettings }
  /** Puts back a whole draft (Undo of Discard). */
  | { type: 'replace'; draft: ScheduleDraft };

export function scheduleReducer(draft: ScheduleDraft, action: ScheduleAction): ScheduleDraft {
  switch (action.type) {
    case 'edit':
      return { ...draft, ...action.patch };
    case 'addSlot':
      return { ...draft, slots: [...draft.slots, { ...NEW_SLOT }] };
    case 'editSlot':
      return { ...draft, slots: draft.slots.map((slot, i) => (i === action.index ? { ...slot, ...action.patch } : slot)) };
    case 'removeSlot':
      return { ...draft, slots: draft.slots.filter((_, i) => i !== action.index) };
    case 'toggleAccount': {
      const rest = draft.defaultAccountIds.filter((id) => id !== action.accountId);
      return { ...draft, defaultAccountIds: action.on ? [...rest, action.accountId] : rest };
    }
    case 'reset':
      return scheduleDraftOf(action.settings);
    case 'replace':
      return action.draft;
  }
}

/**
 * How the Schedule tab follows the saved settings: a clean draft takes a newer saved version at once; a dirty draft based on an older revision is
 * a conflict (the owner reloads, the server would refuse the save anyway).
 */
export function scheduleSync(base: number, saved: PublishingSettings, dirty: boolean): 'same' | 'follow' | 'conflict' {
  if (saved.revision === base) return 'same';
  return dirty ? 'conflict' : 'follow';
}

// ---- Advanced tab ----

/** The settings "Keep archived publications (days)" saves, or null while the field is invalid. */
export function retentionSettings(text: string, saved: PublishingSettings): PublishingSettings | null {
  const days = parseWhole(text, DAYS_RANGE);
  return days === null ? null : { ...saved, archivedRetentionDays: days };
}

// ---- Accounts tab ----

/** Whether an account has a delivery that is not settled (or a confirmed schedule) on a publication that is not archived: it cannot be removed. */
export function accountInUse(accountId: Id, rows: readonly PublicationRow[]): boolean {
  return rows.some(
    (row) => !row.archived && row.destinations.some((d) => d.accountId === accountId && (d.state === 'scheduled' || UNSETTLED_DELIVERY_STATES.includes(d.state))),
  );
}

export function connectionInUse(connectionId: Id, accounts: readonly PublishingAccount[], rows: readonly PublicationRow[]): boolean {
  return accounts.some((a) => a.connectionId === connectionId && accountInUse(a.id, rows));
}

/** Why the owner cannot change connections and accounts here, or null. */
export function ownerBlock(context: { owner: boolean; readOnly: boolean; busy?: boolean }): string | null {
  if (!context.owner) return PC.settings.ownerOnly;
  if (context.readOnly) return PC.form.readOnly;
  if (context.busy) return PC.form.busy;
  return null;
}

/** Why a connection or account cannot be removed now, or null. */
export function removeBlock(context: { owner: boolean; readOnly: boolean; busy?: boolean; inUse: boolean }): string | null {
  return ownerBlock(context) ?? (context.inUse ? PC.settings.inUse : null);
}

/** Why "Add account" (or "Add connection") cannot run with these fields, or null. */
export function accountFieldsBlock(fields: { name: string; handle?: string }): string | null {
  if (!fields.name.trim()) return PC.settings.nameNeeded;
  if (fields.handle !== undefined && !fields.handle.trim()) return PC.settings.handleNeeded;
  return null;
}

/** "name · connection" for an account in a list that spans connections. */
export function accountWithRoute(account: PublishingAccount, connections: readonly PublishingConnection[]): string {
  const connection = connections.find((c) => c.id === account.connectionId);
  const via = connection ? connection.name || providerLabel(connection.provider) : '';
  return via ? PC.form.accountTile(account.name, via) : account.name;
}

/** "name · Network", with "· reconnect needed" and "· disabled" when they apply. */
export function accountRowLabel(account: PublishingAccount): string {
  return [
    PC.settings.accountRow(account.name, networkLabel(account.network)),
    account.needsReconnect ? PC.settings.needsReconnect : '',
    account.disabled ? PC.settings.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The choices of "Link another publishing route": independent, or the canonical account of the same identity (same network, not itself linked). */
export function linkOptions(
  account: PublishingAccount,
  accounts: readonly PublishingAccount[],
  connections: readonly PublishingConnection[],
): { value: Id | ''; label: string }[] {
  return [
    { value: '', label: PC.settings.independent },
    ...accounts
      .filter((other) => other.id !== account.id && other.network === account.network && !other.equivalentTo)
      .map((other) => ({ value: other.id, label: PC.settings.sameAs(accountWithRoute(other, connections)) })),
  ];
}

/** Why the link of this account cannot change, or null. */
export function linkBlock(
  account: PublishingAccount,
  accounts: readonly PublishingAccount[],
  context: { owner: boolean; readOnly: boolean; busy?: boolean },
): string | null {
  const owner = ownerBlock(context);
  if (owner) return owner;
  if (accounts.some((a) => a.equivalentTo === account.id)) return PC.settings.linkCanonical;
  if (!account.equivalentTo && !accounts.some((o) => o.id !== account.id && o.network === account.network && !o.equivalentTo)) return PC.settings.linkNone;
  return null;
}

/** The rail line under "Publishing": "{n} accounts", "Not set up", or null while the mirror has not arrived. */
export function publishingRailSummary(ready: boolean, accounts: readonly unknown[]): string | null {
  if (!ready) return null;
  return accounts.length ? PC.settings.railAccounts(accounts.length) : PC.settings.railNotSet;
}

/** The three tabs; `?tab=` on the address picks one (local UI state, not part of the route). */
export const PUBLISHING_SETTINGS_TABS = ['accounts', 'schedule', 'advanced'] as const;
export type PublishingSettingsTab = (typeof PUBLISHING_SETTINGS_TABS)[number];

export function settingsTabOf(search: string): PublishingSettingsTab {
  const tab = new URLSearchParams(search).get('tab');
  return (PUBLISHING_SETTINGS_TABS as readonly string[]).includes(tab ?? '') ? (tab as PublishingSettingsTab) : 'accounts';
}

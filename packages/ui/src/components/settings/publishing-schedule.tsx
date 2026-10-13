'use client';

import { useEffect, useId, useReducer, useState } from 'react';
import { CalendarClock, Loader2, Plus, Sparkles, Undo2 } from 'lucide-react';
import { intlLocale, type PublishingAccount, type PublishingSettings } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button';
import { Checkbox } from '../../cc/ui/checkbox';
import { Disclosure } from '../../cc/ui/disclosure';
import { Input } from '../../cc/ui/input';
import { Textarea } from '../../cc/ui/textarea';
import { networkLabel } from '../../model/publishing-labels.ts';
import {
  hasScheduleErrors,
  scheduleDirty,
  scheduleDraftOf,
  scheduleErrors,
  scheduleReducer,
  scheduleSettings,
  scheduleSync,
  WEEKDAYS_MONDAY_FIRST,
  weekdayName,
  type ScheduleDraft,
} from '../../model/publishing-settings.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { publishingError, savePublishingSettings } from '../../runtime/publishing-commands.ts';
import { NetworkIcon } from '../publishing/network-icon.tsx';
import { PC } from '../publishing/publishing-copy.ts';
import { PublishingSelect } from '../publishing/publishing-select.tsx';
import { TimezoneSelect } from '../publishing/timezone-select.tsx';
import { Panel, PanelHeading } from './settings-ui.tsx';

type Notice = { tone: 'status' | 'error'; text: string; undo?: () => void } | null;

/**
 * Settings → Publishing → Schedule (design §2.5, agentcut `ScheduleSettings`): the workspace timezone (searchable select), weekly times (Monday
 * first; "Add weekly time" adds Monday 18:00), spacing and preparation time, the defaults for new clips (auto-prepare, default accounts, writing
 * guidance), and "Save publishing schedule". The draft follows newer saved settings while it is clean; a dirty draft based on an older revision
 * shows a conflict with Reload. Discard offers Undo.
 */
export function PublishingSchedule({
  settings,
  accounts,
  readOnly,
}: {
  settings: PublishingSettings;
  accounts: PublishingAccount[];
  readOnly: boolean;
}) {
  const id = useId();
  const runtime = useRuntime();
  const locale = intlLocale();
  const [base, setBase] = useState(settings);
  const [draft, dispatch] = useReducer(scheduleReducer, settings, scheduleDraftOf);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const dirty = scheduleDirty(draft, base);
  const sync = saving ? 'same' : scheduleSync(base.revision, settings, dirty);

  useEffect(() => {
    if (sync !== 'follow') return;
    setBase(settings);
    dispatch({ type: 'reset', settings });
  }, [sync, settings]);

  const errors = scheduleErrors(draft, accounts);
  const invalid = hasScheduleErrors(errors);
  const block = readOnly
    ? PC.form.readOnly
    : saving
      ? PC.form.busy
      : sync === 'conflict'
        ? PC.settings.conflict
        : !dirty
          ? PC.settings.noChanges
          : invalid
            ? PC.settings.fixErrors
            : null;

  const reload = () => {
    setBase(settings);
    dispatch({ type: 'reset', settings });
    setNotice(null);
  };
  const discard = () => {
    const previous: ScheduleDraft = draft;
    dispatch({ type: 'reset', settings: base });
    setNotice({
      tone: 'status',
      text: PC.form.discarded,
      undo: () => {
        dispatch({ type: 'replace', draft: previous });
        setNotice(null);
      },
    });
  };
  const save = async () => {
    const next = scheduleSettings(draft, base, accounts);
    if (!next) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await savePublishingSettings(runtime, next);
      setBase(saved);
      dispatch({ type: 'reset', settings: saved });
      setNotice({ tone: 'status', text: PC.settings.scheduleSaved });
    } catch (e) {
      setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setSaving(false);
    }
  };

  const field = 'space-y-1.5 text-sm';
  const fieldError = (text: string | undefined, key: string) =>
    text ? (
      <p id={`${id}-${key}-error`} className="text-xs text-destructive">
        {text}
      </p>
    ) : null;
  const disabled = readOnly || saving;

  return (
    <div className="flex flex-col gap-5">
      {sync === 'conflict' ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-primary/40">
          <p className="min-w-0 flex-1 text-sm text-foreground">{PC.settings.conflict}</p>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            {PC.settings.reload}
          </Button>
        </div>
      ) : null}

      <Panel label={PC.settings.scheduleTitle} className="flex flex-col gap-5">
        <PanelHeading title={PC.settings.scheduleTitle} hint={PC.settings.scheduleHint} icon={<CalendarClock />} />
        <div className={cn(field, 'max-w-md')}>
          <label htmlFor={`${id}-tz`} className="block">
            {PC.settings.timezone}
          </label>
          <TimezoneSelect
            id={`${id}-tz`}
            value={draft.timezone}
            disabled={disabled}
            invalid={!!errors.timezone}
            onChange={(timezone) => dispatch({ type: 'edit', patch: { timezone } })}
          />
          {fieldError(errors.timezone, 'tz')}
        </div>

        <fieldset className="min-w-0 space-y-3" disabled={disabled}>
          <legend className="mb-2 text-sm font-medium text-foreground">{PC.settings.weekly}</legend>
          {!draft.slots.length ? <p className="text-xs text-muted-foreground">{PC.settings.noTimes}</p> : null}
          <ul className="space-y-3">
            {draft.slots.map((slot, index) => (
              <li key={index} className="space-y-1">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-40 flex-1 space-y-1.5 text-xs text-muted-foreground">
                    <label htmlFor={`${id}-day-${index}`} className="block">
                      {PC.settings.weekday}
                    </label>
                    <PublishingSelect
                      id={`${id}-day-${index}`}
                      value={String(slot.weekday)}
                      disabled={disabled}
                      options={WEEKDAYS_MONDAY_FIRST.map((day) => ({ value: String(day), label: weekdayName(day, locale) }))}
                      onChange={(value) => dispatch({ type: 'editSlot', index, patch: { weekday: Number(value) } })}
                    />
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <label htmlFor={`${id}-time-${index}`} className="block">
                      {PC.settings.time}
                    </label>
                    <Input
                      id={`${id}-time-${index}`}
                      type="time"
                      className="w-32"
                      value={slot.time}
                      aria-invalid={!!errors.slots[index] || undefined}
                      aria-describedby={errors.slots[index] ? `${id}-slot-${index}-error` : undefined}
                      onChange={(e) => dispatch({ type: 'editSlot', index, patch: { time: e.target.value } })}
                    />
                  </div>
                  <Button type="button" variant="ghost" aria-label={PC.settings.removeTimeLabel(index + 1)} onClick={() => dispatch({ type: 'removeSlot', index })}>
                    {PC.settings.removeTime}
                  </Button>
                </div>
                {fieldError(errors.slots[index] ?? undefined, `slot-${index}`)}
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" variant="outline" onClick={() => dispatch({ type: 'addSlot' })}>
            <Plus aria-hidden />
            {PC.settings.addTime}
          </Button>
        </fieldset>

        <Disclosure variant="plain" summary={PC.settings.spacing} open={!!(errors.minGapMinutes || errors.leadMinutes) || undefined}>
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className={field}>
              <label htmlFor={`${id}-gap`} className="block">
                {PC.settings.gap}
              </label>
              <Input
                id={`${id}-gap`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={draft.minGapMinutes}
                disabled={disabled}
                aria-invalid={!!errors.minGapMinutes || undefined}
                aria-describedby={errors.minGapMinutes ? `${id}-gap-error` : undefined}
                onChange={(e) => dispatch({ type: 'edit', patch: { minGapMinutes: e.target.value } })}
              />
              {fieldError(errors.minGapMinutes, 'gap')}
            </div>
            <div className={field}>
              <label htmlFor={`${id}-lead`} className="block">
                {PC.settings.lead}
              </label>
              <Input
                id={`${id}-lead`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={draft.leadMinutes}
                disabled={disabled}
                aria-invalid={!!errors.leadMinutes || undefined}
                aria-describedby={errors.leadMinutes ? `${id}-lead-error` : undefined}
                onChange={(e) => dispatch({ type: 'edit', patch: { leadMinutes: e.target.value } })}
              />
              {fieldError(errors.leadMinutes, 'lead')}
            </div>
          </div>
        </Disclosure>
      </Panel>

      <Panel label={PC.settings.clips} className="flex flex-col gap-4">
        <PanelHeading title={PC.settings.clips} hint={PC.settings.clipsHint} icon={<Sparkles />} />
        <Checkbox checked={draft.autoPrepare} disabled={disabled} onCheckedChange={(autoPrepare) => dispatch({ type: 'edit', patch: { autoPrepare } })}>
          {PC.settings.autoPrepare}
        </Checkbox>
        <fieldset className="min-w-0" disabled={disabled}>
          <legend className="mb-2 text-sm font-medium text-foreground">{PC.settings.defaultAccounts}</legend>
          {!accounts.length ? <p className="text-xs text-muted-foreground">{PC.settings.noDefaultAccounts}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => (
              <Checkbox
                key={account.id}
                checked={draft.defaultAccountIds.includes(account.id)}
                disabled={disabled || (account.disabled && !draft.defaultAccountIds.includes(account.id))}
                onCheckedChange={(on) => dispatch({ type: 'toggleAccount', accountId: account.id, on })}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-foreground/5 px-3 py-2 has-[:checked]:ring-1 has-[:checked]:ring-primary/40"
              >
                <span className="block text-foreground">{account.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <NetworkIcon network={account.network} className="size-3" />
                  {networkLabel(account.network)}
                  {account.disabled ? ` ${PC.settings.disabled}` : ''}
                </span>
              </Checkbox>
            ))}
          </div>
          {fieldError(errors.defaultAccountIds, 'accounts')}
        </fieldset>
        <div className={field}>
          <label htmlFor={`${id}-writing`} className="block">
            {PC.settings.writing}
          </label>
          <Textarea
            id={`${id}-writing`}
            rows={3}
            value={draft.writing}
            disabled={disabled}
            aria-describedby={`${id}-writing-hint`}
            onChange={(e) => dispatch({ type: 'edit', patch: { writing: e.target.value } })}
          />
          <p id={`${id}-writing-hint`} className="text-xs text-muted-foreground">
            {PC.settings.writingHint}
          </p>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!!block} onClick={() => void save()}>
          {saving ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
          {saving ? PC.settings.saving : PC.settings.saveSchedule}
        </Button>
        {dirty ? (
          <Button type="button" variant="ghost" disabled={saving} onClick={discard}>
            {PC.settings.discard}
          </Button>
        ) : null}
        {block && block !== PC.form.busy ? <span className="text-xs text-muted-foreground">{block}</span> : null}
      </div>
      {notice ? (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} className="flex flex-wrap items-center gap-2 text-sm">
          <p className={cn('min-w-0 flex-1 whitespace-pre-wrap', notice.tone === 'error' ? 'text-destructive' : 'text-foreground')}>{notice.text}</p>
          {notice.undo ? (
            <Button type="button" size="sm" variant="outline" onClick={notice.undo}>
              <Undo2 aria-hidden />
              {PC.form.undoDiscard}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

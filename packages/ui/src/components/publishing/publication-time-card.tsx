'use client';

import { useId } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { formatRef, intlLocale, isValidTimezone, todayInZone } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Disclosure } from '../../cc/ui/disclosure';
import { Input } from '../../cc/ui/input';
import { accountTimes, formatInstant, reserveBlock } from '../../model/publication-sections.ts';
import { timezoneLabel } from '../../model/publishing-labels.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { publishingError, publishingSlots, usePublishingBusy } from '../../runtime/publishing-commands.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { PublicationTimeField } from './publication-time-field.tsx';
import { PC } from './publishing-copy.ts';
import { TimezoneSelect } from './timezone-select.tsx';

/** Days "Reserve next free slot" looks ahead. */
const RESERVE_DAYS = 30;

/**
 * "Publication time" (design §2.4): the publication's timezone (a searchable select of IANA zones, never free text), the default publication time,
 * account times, "Clear default reservation", "Reserve next free slot" (weekly slots, spacing, lead time), and priority and expiration.
 */
export function PublicationTimeCard({ form }: { form: PublicationFormApi }) {
  const id = useId();
  const runtime = useRuntime();
  const { draft, saved } = form;
  const reserving = usePublishingBusy((s) => s.busy[`slots:${saved.id}`] === 'slots');
  const editBlock = form.locked ? PC.form.locked : form.readOnly ? PC.form.readOnly : null;
  const disabled = !!editBlock;
  const times = accountTimes(draft, form.accounts);
  const locale = intlLocale();
  const zone = isValidTimezone(draft.timezone) ? draft.timezone : null;
  const reserveWhy = reserveBlock({ ...form, busy: form.busy || reserving, slots: form.settings?.slots.length ?? 0 });
  // The reason shown under the buttons; the default time field repeats it only when it is a different one.
  const shownWhy = reserveWhy && !reserving ? reserveWhy : null;

  const reserve = async () => {
    form.setNotice(null);
    try {
      const result = await publishingSlots(runtime, {
        publicationIds: [saved.id],
        reserve: true,
        revisions: { [saved.id]: saved.revision },
        from: todayInZone(form.settings?.timezone && isValidTimezone(form.settings.timezone) ? form.settings.timezone : 'UTC'),
        days: RESERVE_DAYS,
      });
      const updated = result.publications.find((p) => p.id === saved.id);
      if (updated) form.dispatch({ type: 'saved', publication: updated });
      const missing = result.unavailable.find((item) => item.publicationId === saved.id);
      form.setNotice(
        missing ? { tone: 'error', text: formatRef(missing.reason, '') } : { tone: 'status', text: PC.batch.reserved(result.placements.length) },
      );
    } catch (e) {
      form.setNotice({ tone: 'error', text: publishingError(e).message });
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 id={`${id}-heading`} className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarDays aria-hidden className="size-4" />
        {PC.form.timeCard}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-1 text-sm">
          <label htmlFor={`${id}-tz`}>{PC.form.timezone}</label>
          <TimezoneSelect id={`${id}-tz`} value={draft.timezone} disabled={disabled} onChange={(timezone) => form.dispatch({ type: 'edit', patch: { timezone } })} />
        </div>
        <PublicationTimeField
          label={PC.form.defaultTime}
          value={draft.scheduledAt}
          timezone={draft.timezone}
          disabled={disabled}
          disabledReason={editBlock && editBlock !== shownWhy ? editBlock : undefined}
          onChange={(scheduledAt) => form.dispatch({ type: 'edit', patch: { scheduledAt } })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {draft.scheduledAt && zone
          ? PC.form.defaultSummary(formatInstant(draft.scheduledAt, zone, locale), timezoneLabel(zone))
          : PC.form.noDefault}
      </p>
      {times.length ? (
        <div className="space-y-2 rounded-xl bg-foreground/5 p-3 text-xs">
          <p className="font-medium text-foreground">{PC.form.accountTimes}</p>
          <ul className="space-y-1 text-muted-foreground">
            {times.map((time) => (
              <li key={time.accountId}>
                {time.name}: {time.own ? formatInstant(time.own, zone ?? 'UTC', locale) : PC.form.usesDefault}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">{PC.form.accountTimesHint}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled || !draft.scheduledAt} onClick={() => form.dispatch({ type: 'edit', patch: { scheduledAt: null } })}>
          {PC.form.clearReservation}
        </Button>
        <Button type="button" variant="outline" disabled={!!reserveWhy} onClick={() => void reserve()}>
          {reserving ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
          {reserving ? PC.form.reserving : PC.form.reserveSlot}
        </Button>
      </div>
      {shownWhy ? <p className="text-xs text-muted-foreground">{shownWhy}</p> : null}
      <Disclosure summary={PC.form.priorityExpiry} variant="plain">
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <label htmlFor={`${id}-priority`}>{PC.form.priority}</label>
            <Input
              id={`${id}-priority`}
              type="number"
              step={1}
              value={draft.priority}
              disabled={disabled}
              aria-describedby={`${id}-priority-hint`}
              onChange={(e) => {
                const priority = Math.trunc(Number(e.target.value));
                if (Number.isFinite(priority)) form.dispatch({ type: 'edit', patch: { priority } });
              }}
            />
            <p id={`${id}-priority-hint`} className="text-xs text-muted-foreground">
              {PC.form.priorityHint}
            </p>
          </div>
          <PublicationTimeField
            label={PC.form.expiresAt}
            value={draft.expiresAt}
            timezone={draft.timezone}
            disabled={disabled}
            disabledReason={editBlock ?? undefined}
            onChange={(expiresAt) => form.dispatch({ type: 'edit', patch: { expiresAt } })}
          />
        </div>
      </Disclosure>
    </section>
  );
}

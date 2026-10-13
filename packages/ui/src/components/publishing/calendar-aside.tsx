'use client';

import type { ReactNode } from 'react';
import { CalendarDays, Hand, Inbox } from 'lucide-react';
import { calendarTime, formatCivilDate, intlLocale, type Id, type PublicationRow, type PublishingAccount, type PublishingConnection } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Checkbox } from '../../cc/ui/checkbox';
import { untimedDestinations, type CalendarDrag, type CalendarEntry as Entry, type DueEntry } from '../../model/publishing-calendar.ts';
import { CalendarEntry } from './calendar-entry.tsx';
import { PC } from './publishing-copy.ts';

interface EntryActions {
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  timezone: string;
  busy: Record<Id, string>;
  onOpen: (publicationId: Id) => void;
  onMove: (row: PublicationRow, destinationIds: Id[], day: string | null) => void;
  onDrag: (drag: CalendarDrag | null) => void;
}

/**
 * The calendar's aside (design §2.3): the selected day's publications (on narrow windows the grid shows counts only, so this is where they are), the
 * Unscheduled inbox with its selection and "Find publishing times", and by-hand posts that are due.
 */
export function CalendarAside({
  selectedDay,
  today,
  dayEntries,
  unscheduled,
  due,
  accountId,
  filtered,
  selection,
  finding,
  findStatus,
  startAction,
  onSelection,
  onFindTimes,
  onBatch,
  onClearFilters,
  ...actions
}: EntryActions & {
  selectedDay: string;
  today: string;
  dayEntries: Entry[];
  unscheduled: PublicationRow[];
  due: DueEntry[];
  accountId: Id | '';
  filtered: boolean;
  selection: Id[];
  finding: boolean;
  /** The result of the last "Find publishing times" (reserved count, or why some had no slot). */
  findStatus: ReactNode;
  /** The way forward when nothing is unscheduled (Open Library). */
  startAction: ReactNode;
  onSelection: (ids: Id[]) => void;
  onFindTimes: () => void;
  /** Opens the batch dialog on the selection (review each, reserve, send together). */
  onBatch: () => void;
  onClearFilters: () => void;
}) {
  const locale = intlLocale();
  const { accounts, connections, timezone, busy, onOpen, onMove, onDrag } = actions;
  const entry = (row: PublicationRow, destinations: Entry['destinations'], day: string | null) => (
    <CalendarEntry
      row={row}
      destinations={destinations}
      day={day}
      accounts={accounts}
      connections={connections}
      timezone={timezone}
      busy={!!busy[row.id]}
      onOpen={() => onOpen(row.id)}
      onMove={(ids) => onMove(row, ids, day)}
      onDrag={onDrag}
    />
  );
  return (
    <aside data-cc className="grid min-w-0 content-start gap-5 sm:grid-cols-2 lg:grid-cols-1">
      <section id="selected-day-publications" aria-labelledby="selected-day-heading" className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>{selectedDay === today ? PC.calendar.today : PC.calendar.selectedDay}</p>
          <CalendarDays aria-hidden className="size-4" />
        </div>
        <h3 id="selected-day-heading" aria-live="polite" className="mt-2 mb-5 text-lg font-medium tracking-tight text-foreground">
          {formatCivilDate(selectedDay, locale, { weekday: 'short', month: 'long', day: 'numeric' })}
        </h3>
        {dayEntries.length ? (
          <ul className="space-y-3">
            {dayEntries.map(({ row, destinations }) => (
              <li key={row.id}>{entry(row, destinations, selectedDay)}</li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl bg-foreground/[0.035] px-4 py-5">
            <p className="text-sm font-medium text-foreground">{PC.calendar.nothingScheduled}</p>
            <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">
              {unscheduled.length ? PC.calendar.nothingScheduledUnscheduled : PC.calendar.nothingScheduledBody}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="unscheduled-heading" className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 id="unscheduled-heading" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Inbox aria-hidden className="size-4" />
            {PC.calendar.unscheduled}
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">{unscheduled.length}</span>
        </div>
        {!unscheduled.length ? (
          <div>
            <p className="text-sm font-medium text-foreground">{filtered ? PC.calendar.noMatching : PC.calendar.startWithVideo}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{filtered ? PC.calendar.noMatchingBody : PC.calendar.startWithVideoBody}</p>
            <div className="mt-4">
              {filtered ? (
                <Button type="button" size="sm" variant="outline" onClick={onClearFilters}>
                  {PC.calendar.clearFilters}
                </Button>
              ) : (
                startAction
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {unscheduled.map((row) => (
              <li key={row.id} className="flex items-start gap-2">
                <Checkbox
                  aria-label={PC.calendar.select(row.label)}
                  checked={selection.includes(row.id)}
                  onCheckedChange={(checked) => onSelection(checked ? [...selection, row.id] : selection.filter((id) => id !== row.id))}
                />
                <div className="min-w-0 flex-1">{entry(row, untimedDestinations(row, accountId), null)}</div>
              </li>
            ))}
          </ul>
        )}
        {selection.length ? (
          <div className="mt-4 space-y-2 border-t border-foreground/10 pt-4">
            <p className="text-xs text-muted-foreground" role="status">
              {PC.calendar.selected(selection.length)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={finding} onClick={onFindTimes}>
                {finding ? PC.calendar.findingTimes : PC.calendar.findTimes}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={finding} onClick={onBatch}>
                {PC.batch.prepare(selection.length)}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={finding} onClick={() => onSelection([])}>
                {PC.calendar.clearSelection}
              </Button>
            </div>
          </div>
        ) : null}
        {findStatus}
      </section>

      {due.length ? (
        <section aria-labelledby="due-heading" className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="due-heading" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Hand aria-hidden className="size-4 text-primary" />
              {PC.calendar.dueByHand}
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">{due.length}</span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{PC.calendar.dueByHandBody}</p>
          <ul className="space-y-2">
            {due.map(({ row, destination, account }) => (
              <li key={destination.id}>
                <Button type="button" size="sm" variant="outline" className="max-w-full" onClick={() => onOpen(row.id)}>
                  <Hand aria-hidden />
                  <span className="truncate">
                    {account ? PC.calendar.dueToast(row.label, account.name) : row.label}
                    {destination.at ? ` · ${calendarTime(destination.at, timezone)}` : ''}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

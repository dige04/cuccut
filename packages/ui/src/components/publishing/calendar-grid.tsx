'use client';

import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { CALENDAR_DRAG_TYPE, formatCivilDate, intlLocale, type CalendarView, type Id, type PublicationRow, type PublishingAccount, type PublishingConnection } from '@cuccut/protocol';
import { cn } from 'cn';
import { parseDrag, type CalendarDay, type CalendarDrag } from '../../model/publishing-calendar.ts';
import { CalendarEntry } from './calendar-entry.tsx';
import { PC } from './publishing-copy.ts';

/**
 * The calendar body (design §2.3): Monday-first weekday headers in the workspace timezone, then one cell per day (month, week) or one row per day
 * with publications (agenda). A cell's number selects the day (today is the yellow circle, the selected day a tinted ring); entries drop onto
 * cells. Below `sm` the grid shows counts only and the selected day's entries appear in the aside.
 */
export function CalendarGrid({
  view,
  days,
  weekdays,
  selectedDay,
  headingId,
  accounts,
  connections,
  timezone,
  busy,
  drag,
  over,
  empty,
  onOver,
  onDrop,
  onSelectDay,
  onOpen,
  onMove,
  onDrag,
}: {
  view: CalendarView;
  days: CalendarDay[];
  weekdays: { short: string; long: string }[];
  selectedDay: string;
  headingId: string;
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  timezone: string;
  /** Publications with a write in progress. */
  busy: Record<Id, string>;
  drag: CalendarDrag | null;
  over: string | null;
  /** Shown in the agenda when no day has publications. */
  empty: ReactNode;
  onOver: (day: string | null) => void;
  onDrop: (drag: CalendarDrag, day: string) => void;
  onSelectDay: (day: string) => void;
  onOpen: (publicationId: Id) => void;
  onMove: (row: PublicationRow, destinationIds: Id[], day: string) => void;
  onDrag: (drag: CalendarDrag | null) => void;
}) {
  const locale = intlLocale();
  const agenda = view === 'agenda';
  return (
    <div data-cc className="overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10">
      {!agenda ? (
        <div className="grid grid-cols-7 border-b border-foreground/10 bg-foreground/[0.025]" aria-hidden>
          {weekdays.map((weekday) => (
            <span key={weekday.long} title={weekday.long} className="py-3 text-center text-xs font-medium text-muted-foreground">
              {weekday.short}
            </span>
          ))}
        </div>
      ) : null}
      <div
        role="list"
        aria-labelledby={headingId}
        className={cn(agenda ? 'divide-y divide-foreground/10' : 'grid grid-cols-7', view === 'month' && 'sm:min-h-[clamp(25rem,calc(100dvh-25rem),40rem)]')}
      >
        {days.map(({ date, entries, today, outside }) => {
          const selected = date === selectedDay;
          const dateLabel = formatCivilDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric' });
          return (
            <section
              key={date}
              role="listitem"
              aria-label={dateLabel}
              onDragOver={(event) => {
                if (!drag || !event.dataTransfer.types.includes(CALENDAR_DRAG_TYPE)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (over !== date) onOver(date);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onOver(null);
              }}
              onDrop={(event) => {
                const dropped = parseDrag(event.dataTransfer.getData(CALENDAR_DRAG_TYPE)) ?? drag;
                if (!dropped) return;
                event.preventDefault();
                onDrop(dropped, date);
              }}
              className={cn(
                'relative min-w-0',
                agenda && 'p-4 sm:flex sm:items-start sm:gap-5',
                !agenda && 'border-e border-b border-foreground/10 p-1 sm:p-2 [&:nth-child(7n)]:border-e-0',
                view === 'month' && 'min-h-16 sm:min-h-24',
                view === 'week' && 'min-h-32 sm:min-h-96',
                outside && !selected && 'bg-black/10',
                selected && 'bg-primary/[0.045] ring-1 ring-primary/40 ring-inset',
                over === date && 'bg-primary/10 outline-2 -outline-offset-2 outline-primary',
              )}
            >
              <button
                type="button"
                aria-label={PC.calendar.showDay(dateLabel)}
                aria-pressed={selected}
                aria-current={today ? 'date' : undefined}
                aria-controls="selected-day-publications"
                onClick={() => onSelectDay(date)}
                className={cn(
                  'mb-1 flex min-h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs tabular-nums transition-colors outline-none hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none sm:min-h-9 sm:min-w-9',
                  agenda && 'shrink-0 justify-start text-sm font-medium sm:w-44',
                  outside && 'text-muted-foreground',
                  today && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
                )}
              >
                {agenda ? formatCivilDate(date, locale, { weekday: 'long', month: 'short', day: 'numeric' }) : Number(date.slice(-2))}
              </button>
              <div className={cn('min-w-0 space-y-1.5', agenda ? 'flex-1' : 'hidden sm:block')}>
                {entries.map(({ row, destinations }) => (
                  <CalendarEntry
                    key={row.id}
                    row={row}
                    destinations={destinations}
                    day={date}
                    accounts={accounts}
                    connections={connections}
                    timezone={timezone}
                    compact={!agenda}
                    busy={!!busy[row.id]}
                    onOpen={() => onOpen(row.id)}
                    onMove={(ids) => onMove(row, ids, date)}
                    onDrag={onDrag}
                  />
                ))}
                {!entries.length && view === 'week' ? <p className="px-1 pt-4 text-xs text-muted-foreground">{PC.calendar.noneCell}</p> : null}
              </div>
              {entries.length && !agenda ? (
                <p className="text-center text-xs text-muted-foreground tabular-nums sm:hidden">
                  <span aria-hidden>{entries.length}</span>
                  <span className="sr-only">{PC.calendar.dayCount(entries.length)}</span>
                </p>
              ) : null}
            </section>
          );
        })}
        {agenda && !days.length ? empty : null}
      </div>
    </div>
  );
}

/** "No publications this week / match these filters" with its one way forward. */
export function CalendarEmpty({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-foreground/5">
        <CalendarDays aria-hidden strokeWidth={1.5} className="size-6 text-muted-foreground" />
      </span>
      <h4 className="text-base font-medium text-foreground">{title}</h4>
      <p className="mt-2 max-w-sm text-sm text-pretty text-muted-foreground">{body}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

'use client';

import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CALENDAR_VIEWS, PUBLICATION_STATUSES, type CalendarView, type Id, type PublicationStatus, type PublishingAccount } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../../cc/ui/tabs';
import { networkLabel, statusLabel } from '../../model/publishing-labels.ts';
import type { CalendarFilters } from '../../model/publishing-calendar.ts';
import { CivilDatePicker } from './civil-date-picker.tsx';
import { PC } from './publishing-copy.ts';
import { PublishingSelect } from './publishing-select.tsx';

/** The calendar's controls (design §2.3): period and its navigation, view, filters, Go to. Any change clears the Unscheduled selection. */
export function CalendarToolbar({
  periodLabel,
  view,
  selectedDay,
  today,
  filters,
  accounts,
  headingId,
  onStep,
  onToday,
  onView,
  onFilters,
  onGoTo,
}: {
  periodLabel: string;
  view: CalendarView;
  /** The selected day (Go to shows and changes it). */
  selectedDay: string;
  today: string;
  filters: CalendarFilters;
  accounts: readonly PublishingAccount[];
  /** The period heading's ID (the grid is labelled by it). */
  headingId: string;
  onStep: (step: -1 | 1) => void;
  onToday: () => void;
  onView: (view: CalendarView) => void;
  onFilters: (filters: CalendarFilters) => void;
  onGoTo: (day: string) => void;
}) {
  const id = useId();
  const viewLabel: Record<CalendarView, string> = { month: PC.calendar.month, week: PC.calendar.week, agenda: PC.calendar.agenda };
  const filtered = !!(filters.accountId || filters.status);
  return (
    <div data-cc className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={headingId} className="me-2 text-lg font-medium tracking-tight text-foreground tabular-nums sm:text-xl">
            {periodLabel}
          </h3>
          <Button type="button" variant="ghost" size="icon" aria-label={PC.calendar.previousPeriod} onClick={() => onStep(-1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={PC.calendar.nextPeriod} onClick={() => onStep(1)}>
            <ChevronRight aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onToday}>
            {PC.calendar.today}
          </Button>
        </div>
        <Tabs className="w-full sm:w-auto" value={view} onValueChange={(next) => onView(next as CalendarView)}>
          <TabsList aria-label={PC.calendar.viewLabel} className="w-full sm:w-fit">
            {CALENDAR_VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {viewLabel[v]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PublishingSelect<Id | ''>
          label={PC.calendar.filterAccount}
          className="w-[calc(50%-0.25rem)] sm:w-48"
          value={filters.accountId}
          options={[
            { value: '', label: PC.calendar.allAccounts },
            ...accounts.map((a) => ({ value: a.id, label: `${a.name} · ${networkLabel(a.network)}` })),
          ]}
          onChange={(accountId) => onFilters({ ...filters, accountId })}
        />
        <PublishingSelect<PublicationStatus | ''>
          label={PC.calendar.filterStatus}
          className="w-[calc(50%-0.25rem)] sm:w-48"
          value={filters.status}
          options={[{ value: '', label: PC.calendar.allStatuses }, ...PUBLICATION_STATUSES.map((s) => ({ value: s, label: statusLabel(s).label }))]}
          onChange={(status) => onFilters({ ...filters, status })}
        />
        {filtered ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onFilters({ ...filters, accountId: '', status: '' })}>
            {PC.calendar.clearFilters}
          </Button>
        ) : null}
        <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground sm:ms-auto sm:w-auto">
          <label htmlFor={`${id}-goto`}>{PC.calendar.goTo}</label>
          <CivilDatePicker id={`${id}-goto`} label={PC.calendar.goToDate} className="w-auto text-foreground" align="end" today={today} value={selectedDay} onChange={onGoTo} />
        </div>
      </div>
    </div>
  );
}

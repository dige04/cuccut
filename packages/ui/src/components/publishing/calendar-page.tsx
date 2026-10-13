'use client';

import { useId, useMemo, useState, type MouseEvent } from 'react';
import { ArrowUpRight, Clock3, Library, Settings2, Undo2, X } from 'lucide-react';
import {
  adjacentPeriod,
  dayInZone,
  formatRef,
  intlLocale,
  isValidTimezone,
  todayInZone,
  type CalendarView,
  type Id,
  type PublicationRow,
} from '@cuccut/protocol';
import { cn } from 'cn';
import { BackHeader, PageScroll, RouteLink, SectionHeader } from '../../cc/components/page-chrome.tsx';
import { CHROME_COPY } from '../../cc/components/chrome-copy.ts';
import { Button, buttonVariants } from '../../cc/ui/button';
import { Skeleton } from '../../cc/ui/skeleton';
import {
  calendarModel,
  calendarScope,
  entriesOn,
  revealAnchor,
  slotSearchStart,
  type CalendarFilters,
} from '../../model/publishing-calendar.ts';
import { timezoneCity, timezoneLabel } from '../../model/publishing-labels.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { publishingSlots, usePublishingBusy } from '../../runtime/publishing-commands.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { HOME, defaultRoute, useShell, type Route } from '../../state/shell-store.ts';
import { useNow } from '../use-now.ts';
import { CalendarAside } from './calendar-aside.tsx';
import { CalendarEmpty, CalendarGrid } from './calendar-grid.tsx';
import { CalendarMoveDialog } from './calendar-move-dialog.tsx';
import { CalendarToolbar } from './calendar-toolbar.tsx';
import { CalendarTransfer } from './calendar-transfer.tsx';
import { PublicationDialog } from './publication-dialog.tsx';
import { PC } from './publishing-copy.ts';
import { openBatchDialog } from './publishing-launch.ts';
import { useCalendarMove } from './use-calendar-move.ts';

type CalendarRoute = Extract<Route, { tab: 'calendar' }>;

/** Settings → Publishing. */
export const PUBLISHING_SETTINGS_HREF = '/settings/publishing';

/** Days "Find publishing times" looks ahead. */
const FIND_DAYS = 30;

/**
 * The publication calendar (`/calendar`, design §2.3, port of agentcut `calendar-view.tsx`): every publication of every project (or of one project)
 * on a Monday-first month, week or agenda in the workspace timezone, with the Unscheduled inbox, by-hand posts that are due, drag-and-drop moves
 * with Undo, and the publication dialog (`?publication=`). It reads the `publishing` mirror, so filters apply before pagination; the view, the
 * selected day and the open publication live in the route.
 */
export function CalendarPage({ route }: { route: CalendarRoute }) {
  const runtime = useRuntime();
  const headingId = useId();
  const go = useShell((s) => s.go);
  const ready = usePublishing((s) => s.ready);
  const settings = usePublishing((s) => s.settings);
  const rows = usePublishing((s) => s.publications);
  const accounts = usePublishing((s) => s.accounts);
  const connections = usePublishing((s) => s.connections);
  const degraded = usePublishing((s) => s.degraded);
  const busy = usePublishingBusy((s) => s.busy);
  const directoryReady = useDirectory((s) => s.ready);
  const projects = useDirectory((s) => s.projects);
  const now = useNow(30_000);

  const timezone = settings && isValidTimezone(settings.timezone) ? settings.timezone : 'UTC';
  const today = todayInZone(timezone, now);
  const view: CalendarView = route.view ?? 'month';
  const selectedDay = route.day ?? today;
  const [anchorState, setAnchor] = useState(selectedDay);
  const anchor = revealAnchor(anchorState, view, selectedDay);
  const [filters, setFiltersState] = useState<Pick<CalendarFilters, 'accountId' | 'status'>>({ accountId: '', status: '' });
  const [offset, setOffset] = useState(0);
  const [selection, setSelection] = useState<Id[]>([]);
  const [finding, setFinding] = useState(false);
  const [findResult, setFindResult] = useState<{ reserved: number; problems: string[]; error: string } | null>(null);

  const scope = calendarScope(route.projectId, { ready: directoryReady, projects });
  const scoped = useMemo<CalendarFilters>(() => ({ ...filters, ...(route.projectId ? { projectId: route.projectId } : {}) }), [filters, route.projectId]);

  /** Changes the calendar route in place (no history entry). Reads the current route, so a change after an await keeps what happened meanwhile. */
  const setRoute = (patch: Partial<Omit<CalendarRoute, 'tab'>>) => {
    const current = useShell.getState().route;
    if (current.tab !== 'calendar') return;
    const next: CalendarRoute = { ...current, ...patch };
    for (const key of Object.keys(next) as (keyof CalendarRoute)[]) if (next[key] === undefined) delete next[key];
    useShell.getState().replace(next);
  };
  /** Any period, view or filter change starts the pages and the selection over. */
  const reset = () => {
    setOffset(0);
    setSelection([]);
    setFindResult(null);
  };
  const reveal = (day: string) => {
    setAnchor((current) => revealAnchor(current, view, day));
    setRoute({ day });
  };
  const moving = useCalendarMove({ timezone, reveal });

  const model = useMemo(
    () => calendarModel({ rows, accounts, connections, timezone, anchor, view, filters: scoped, offset, now, locale: intlLocale() }),
    [rows, accounts, connections, timezone, anchor, view, scoped, offset, now],
  );
  const dayEntries = useMemo(() => entriesOn(rows, selectedDay, timezone, scoped), [rows, selectedDay, timezone, scoped]);
  const liveSelection = selection.filter((id) => model.unscheduled.some((row) => row.id === id));

  const step = (direction: -1 | 1) => {
    const next = adjacentPeriod(anchor, view, direction);
    setAnchor(next);
    setRoute({ day: next });
    reset();
  };
  const goTo = (day: string) => {
    setAnchor(day);
    setRoute({ day });
    reset();
  };
  const setFilters = (next: CalendarFilters) => {
    setFiltersState({ accountId: next.accountId, status: next.status });
    reset();
  };
  const clearFilters = () => setFilters({ accountId: '', status: '' });
  const open = (publicationId: Id) => setRoute({ publicationId });
  const startMove = (row: PublicationRow, ids: Id[], day: string | null) => moving.open(row, ids, day ?? selectedDay);

  const findTimes = async () => {
    const ids = liveSelection;
    if (!ids.length) return;
    setFinding(true);
    setFindResult(null);
    try {
      const revisions = Object.fromEntries(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, r.revision]));
      const result = await publishingSlots(runtime, {
        publicationIds: ids,
        from: slotSearchStart(model.from, today),
        days: FIND_DAYS,
        reserve: true,
        revisions,
      });
      const label = (id: Id) => rows.find((r) => r.id === id)?.label ?? id;
      setFindResult({
        reserved: result.placements.length,
        problems: result.unavailable.map((item) => PC.batch.unavailable(label(item.publicationId), formatRef(item.reason, ''))),
        error: '',
      });
      setSelection([]);
      const first = [...result.placements].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
      if (first) reveal(dayInZone(first.at, timezone));
    } catch (e) {
      setFindResult({ reserved: 0, problems: [], error: (e as Error).message });
    } finally {
      setFinding(false);
    }
  };

  const back = scope.kind === 'project' || scope.kind === 'missing' || scope.kind === 'loading' ? scope.projectId : null;
  const projectName = scope.kind === 'project' ? scope.name : null;
  const libraryLink = (
    <RouteLink route={defaultRoute('space')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
      {PC.calendar.openLibrary}
      <ArrowUpRight aria-hidden />
    </RouteLink>
  );

  return (
    <PageScroll width="max-w-[1600px]">
      <a
        href="#publication-calendar"
        className="sr-only rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
      >
        {PC.calendar.skip}
      </a>
      <BackHeader
        title={PC.calendar.nav}
        backLabel={projectName ? PC.calendar.backTo(projectName) : CHROME_COPY.backHome}
        onBack={() => go(back ? { tab: 'home', conversationId: null, projectId: back } : HOME)}
        actions={
          <>
            <RouteLink route={defaultRoute('space')} label={CHROME_COPY.library} className={cn(buttonVariants({ variant: 'ghost' }), 'max-sm:size-9 max-sm:px-0')}>
              <Library aria-hidden />
              <span className="max-sm:sr-only">{CHROME_COPY.library}</span>
            </RouteLink>
            <a
              href={PUBLISHING_SETTINGS_HREF}
              aria-label={PC.calendar.publishingSettings}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                useShell.getState().navigate(PUBLISHING_SETTINGS_HREF);
              }}
              className={cn(buttonVariants({ variant: 'ghost' }), 'max-sm:size-9 max-sm:px-0')}
            >
              <Settings2 aria-hidden />
              <span className="max-sm:sr-only">{PC.calendar.publishing}</span>
            </a>
          </>
        }
      />

      <SectionHeader
        title={PC.calendar.title}
        blurb={
          <>
            {projectName ? PC.calendar.subtitleProject(projectName) : PC.calendar.subtitle}
            {back ? (
              <>
                {' '}
                <button type="button" onClick={() => setRoute({ projectId: undefined })} className="inline-flex items-center gap-1 text-foreground underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-ring">
                  {PC.calendar.allProjects}
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </button>
              </>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-col items-end gap-2">
            <CalendarTransfer onImported={(day) => day && goTo(day)} />
            <span title={timezoneLabel(timezone)} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 aria-hidden className="size-3.5" />
              {PC.calendar.timezone(timezoneCity(timezone))}
            </span>
          </div>
        }
      />

      <div data-cc className="flex flex-col gap-3">
        {degraded ? (
          <p role="status" className="rounded-2xl bg-card p-3 text-sm text-foreground ring-1 ring-foreground/10">
            {formatRef(degraded, PC.form.readOnly)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{PC.calendar.hint}</p>
        <p role="status" className="sr-only">
          {moving.undo ? PC.calendar.movedStatus(moving.undo.label) : ''}
        </p>
        {moving.undo ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
            <p className="min-w-0 flex-1 text-sm break-words text-foreground">{PC.calendar.moved(moving.undo.label)}</p>
            <Button type="button" size="sm" variant="outline" disabled={moving.moving} onClick={() => void moving.undoMove()}>
              <Undo2 aria-hidden />
              {PC.calendar.undoMove}
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={PC.calendar.dismissUndo} onClick={moving.dismissUndo}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}
        {moving.error && !moving.move ? (
          <p role="alert" className="text-sm whitespace-pre-wrap text-destructive">
            {moving.error}
          </p>
        ) : null}
        {model.attention.length ? (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
            <span className="text-sm text-foreground">{PC.calendar.attention(model.attention.length)}</span>
            {model.attention.map((row) => (
              <Button key={row.id} type="button" size="sm" variant="outline" className="max-w-full" onClick={() => open(row.id)}>
                <span className="truncate">{row.label}</span>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {scope.kind === 'missing' ? (
        <div data-cc className="flex flex-col items-start gap-3 rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
          <h3 className="text-base font-medium text-foreground">{PC.calendar.projectMissing}</h3>
          <p className="max-w-prose text-sm text-muted-foreground">{PC.calendar.projectMissingBody}</p>
          <Button type="button" variant="outline" onClick={() => setRoute({ projectId: undefined })}>
            {PC.calendar.allProjects}
          </Button>
        </div>
      ) : !ready || scope.kind === 'loading' ? (
        <div data-cc role="status" aria-label={PC.calendar.loading} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_288px]">
          <Skeleton className="h-[28rem] rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_288px]">
          <section
            id="publication-calendar"
            aria-labelledby={headingId}
            tabIndex={-1}
            className="flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-3xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <CalendarToolbar
              periodLabel={model.periodLabel}
              view={view}
              selectedDay={selectedDay}
              today={today}
              filters={scoped}
              accounts={accounts}
              headingId={headingId}
              onStep={step}
              onToday={() => goTo(today)}
              onView={(next) => {
                setAnchor(selectedDay);
                setRoute({ view: next });
                reset();
              }}
              onFilters={setFilters}
              onGoTo={goTo}
            />
            <CalendarGrid
              view={view}
              days={model.days}
              weekdays={model.weekdays}
              selectedDay={selectedDay}
              headingId={headingId}
              accounts={accounts}
              connections={connections}
              timezone={timezone}
              busy={busy}
              drag={moving.drag}
              over={moving.over}
              empty={
                <CalendarEmpty
                  title={model.hasFilters ? PC.calendar.noneFiltered : PC.calendar.noneWeek}
                  body={model.hasFilters ? PC.calendar.noneFilteredBody : PC.calendar.noneBody}
                  action={
                    model.hasFilters ? (
                      <Button type="button" variant="outline" onClick={clearFilters}>
                        {PC.calendar.clearFilters}
                      </Button>
                    ) : (
                      libraryLink
                    )
                  }
                />
              }
              onOver={moving.setOver}
              onDrop={(drag, day) => void moving.drop(drag, day)}
              onSelectDay={(day) => setRoute({ day })}
              onOpen={open}
              onMove={startMove}
              onDrag={moving.setDrag}
            />
            {view !== 'agenda' && !model.total ? (
              <div data-cc className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {model.hasFilters ? PC.calendar.noneFiltered : view === 'week' ? PC.calendar.noneWeek : PC.calendar.noneMonth}
                  </p>
                  <p className="text-xs text-muted-foreground">{model.hasFilters ? PC.calendar.noneFilteredBody : PC.calendar.noneBody}</p>
                </div>
                {model.hasFilters ? (
                  <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                    {PC.calendar.clearFilters}
                  </Button>
                ) : (
                  libraryLink
                )}
              </div>
            ) : null}
            <div data-cc className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{PC.calendar.selectDay}</span>
              <span role="status">{PC.calendar.count(model.total)}</span>
            </div>
            {model.previousOffset !== null || model.nextOffset !== null ? (
              <div data-cc className="flex flex-wrap gap-2">
                {model.previousOffset !== null ? (
                  <Button type="button" variant="outline" onClick={() => (setOffset(model.previousOffset!), setSelection([]))}>
                    {PC.calendar.previousPage}
                  </Button>
                ) : null}
                {model.nextOffset !== null ? (
                  <Button type="button" variant="outline" onClick={() => (setOffset(model.nextOffset!), setSelection([]))}>
                    {PC.calendar.nextPage}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
          <CalendarAside
            selectedDay={selectedDay}
            today={today}
            dayEntries={dayEntries}
            unscheduled={model.unscheduled}
            due={model.due}
            accountId={filters.accountId}
            filtered={model.hasFilters}
            selection={liveSelection}
            finding={finding}
            findStatus={
              findResult ? (
                <div className="mt-3 space-y-1 text-xs" role={findResult.error ? 'alert' : 'status'}>
                  {findResult.error ? <p className="text-destructive">{findResult.error}</p> : null}
                  {findResult.reserved ? <p className="text-foreground">{PC.batch.reserved(findResult.reserved)}</p> : null}
                  {findResult.problems.map((problem) => (
                    <p key={problem} className="text-muted-foreground">
                      {problem}
                    </p>
                  ))}
                </div>
              ) : null
            }
            startAction={libraryLink}
            accounts={accounts}
            connections={connections}
            timezone={timezone}
            busy={busy}
            onSelection={setSelection}
            onFindTimes={() => void findTimes()}
            onBatch={() => {
              openBatchDialog({ kind: 'publications', publicationIds: liveSelection });
              setSelection([]);
            }}
            onClearFilters={clearFilters}
            onOpen={open}
            onMove={startMove}
            onDrag={moving.setDrag}
          />
        </div>
      )}

      <CalendarMoveDialog
        move={moving.move}
        row={moving.move ? rows.find((r) => r.id === moving.move!.publicationId) : undefined}
        accounts={accounts}
        connections={connections}
        timezone={timezone}
        today={today}
        busy={moving.moving}
        error={moving.error}
        onChange={moving.setMove}
        onSubmit={() => void moving.submit()}
        onClose={() => moving.setMove(null)}
      />
      <PublicationDialog
        publicationId={route.publicationId ?? null}
        onClose={() => setRoute({ publicationId: undefined })}
        onOpenPublication={open}
      />
    </PageScroll>
  );
}

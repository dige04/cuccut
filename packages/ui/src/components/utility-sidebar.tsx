import { useMemo, type ReactNode } from 'react';
import { Clock as ClockIcon, LayoutGrid, Loader2, Radio, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { live } from '@cuccut/protocol';
import { BackHeader, PageRail, RailPage, SectionHeader, type RailEntry, type RailGroup } from '../cc/components/page-chrome.tsx';
import { SERVICE_COPY, TASK_VIEW_COPY } from '../copy.ts';
import { agoLabel } from '../model/format.ts';
import { SERVICE_IDS, serviceBusy, servicesSummary, serviceStateLabel, serviceTone, type ServiceId } from '../model/services.ts';
import { taskGroups, type TaskRow } from '../model/task-list.ts';
import { TOOL_GROUPS } from '../model/tool-catalog.ts';
import { plannedReason } from '../model/tools-gallery.ts';
import { useShell, type Route } from '../state/shell-store.ts';
import { SERVICE_RAIL_ICON } from './services/service-icon.tsx';
import { useServiceStates } from './services/use-share-status.ts';
import { S } from './shell-copy.ts';
import { RAIL_COPY } from './tasks/rail-copy.ts';
import { TASK_KIND_RAIL_ICON } from './tasks/task-kind-icon.ts';
import { useTaskRows } from './tasks/use-task-rows.ts';
import { TOOL_RAIL_ICON } from './tools/tool-icon.tsx';
import { GALLERY_COPY } from './tools/tools-copy.ts';
import { useNow } from './use-now.ts';

export type UtilityKind = 'tasks' | 'tools' | 'services';

const TITLE = live((): Record<UtilityKind, string> => ({ tasks: S.common.tasks, tools: S.common.tools, services: S.common.services }));
const NOTE = live(
  (): Record<UtilityKind, string> => ({
    tasks: S.utilitySidebar.noteTasks,
    tools: S.utilitySidebar.noteTools,
    services: S.utilitySidebar.noteServices,
  }),
);

const HEADER_ICON: Record<UtilityKind, LucideIcon> = { tasks: ClockIcon, tools: Wrench, services: Radio };

/** How many finished tasks the rail lists; the rest are a click away in All tasks. */
const RAIL_FINISHED = 8;

function Spinner({ label }: { label: string }) {
  return <Loader2 role="img" aria-label={label} className="size-3.5 text-muted-foreground motion-safe:animate-spin" />;
}

/** A 8px status dot for rail rows: green running, orange error, grey off (services) or red failed (tasks). */
function RailDot({ tone, label }: { tone: 'on' | 'error' | 'off' | 'failed'; label?: string }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'size-2 rounded-full',
        tone === 'on' && 'bg-emerald-400',
        tone === 'error' && 'bg-orange-400',
        tone === 'failed' && 'bg-destructive',
        tone === 'off' && 'bg-muted-foreground/50',
      )}
    />
  );
}

const RAIL_CLASS = 'cc-scroll md:-mr-2 md:min-h-0 md:overflow-y-auto md:pr-2 md:[&>div]:static';

/** The Tasks rail: everything, then what is running (with a spinner) and the latest finished tasks. */
function TaskRail({ route }: { route: Route }) {
  const { rows } = useTaskRows();
  const [active, history] = useMemo(() => taskGroups(rows), [rows]);
  const now = useNow(active.items.length ? 5000 : 60_000);
  const current = route.tab === 'tasks' ? (route.taskId ?? null) : undefined;
  const entry = (row: TaskRow, summary: string, trailing?: ReactNode): RailEntry => ({
    key: row.id,
    label: row.title,
    summary,
    Icon: TASK_KIND_RAIL_ICON[row.kind],
    route: { tab: 'tasks', taskId: row.id },
    current: current === row.id,
    trailing,
  });
  const groups: RailGroup[] = [
    {
      key: 'overview',
      entries: [
        {
          key: 'overview',
          label: S.utilitySidebar.overviewTasks,
          summary:
            active.items.length || history.items.length
              ? [active.items.length ? RAIL_COPY.running(active.items.length) : null, history.items.length ? RAIL_COPY.finished(history.items.length) : null]
                  .filter(Boolean)
                  .join(' · ')
              : RAIL_COPY.nothingYet,
          Icon: LayoutGrid,
          route: { tab: 'tasks' },
          current: current === null,
        },
      ],
    },
  ];
  if (active.items.length) {
    groups.push({
      key: 'active',
      label: TASK_VIEW_COPY.activeSection,
      entries: active.items.map((row) =>
        entry(row, row.phase ?? row.label, row.live && !row.queued && !row.waiting ? <Spinner label={S.common.working} /> : undefined),
      ),
    });
  }
  if (history.items.length) {
    groups.push({
      key: 'history',
      label: TASK_VIEW_COPY.historySection,
      entries: history.items
        .slice(0, RAIL_FINISHED)
        .map((row) =>
          entry(row, [row.label, agoLabel(row.endedAt ?? row.startedAt, now)].join(' · '), row.tone === 'negative' ? <RailDot tone="failed" label={row.label} /> : undefined),
        ),
    });
  }
  const more = history.items.length - RAIL_FINISHED;
  return <PageRail label={S.utilitySidebar.nav(TITLE.tasks)} groups={groups} footer={more > 0 ? RAIL_COPY.moreFinished(more) : undefined} className={RAIL_CLASS} />;
}

/** The Tools rail: the gallery, then each group's tools ("Coming soon" under the planned ones). */
function ToolRail({ route }: { route: Route }) {
  const current = route.tab === 'tools' ? (route.tool ?? null) : undefined;
  const count = TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);
  const groups: RailGroup[] = [
    {
      key: 'overview',
      entries: [
        {
          key: 'overview',
          label: S.utilitySidebar.overviewTools,
          summary: RAIL_COPY.toolCount(count),
          Icon: LayoutGrid,
          route: { tab: 'tools' },
          current: current === null,
        },
      ],
    },
    ...TOOL_GROUPS.map(
      (group): RailGroup => ({
        key: group.key,
        label: group.label,
        entries: group.tools.map((tool) => ({
          key: tool.id,
          label: tool.name,
          summary: plannedReason(tool.id) ? GALLERY_COPY.planned : undefined,
          Icon: TOOL_RAIL_ICON[tool.icon],
          route: { tab: 'tools', tool: tool.id },
          current: current === tool.id,
        })),
      }),
    ),
  ];
  return <PageRail label={S.utilitySidebar.nav(TITLE.tools)} groups={groups} className={RAIL_CLASS} />;
}

/** The Services rail: the overview, then each service with its state (a dot, or a spinner while it changes). */
function ServiceRail({ route }: { route: Route }) {
  const states = useServiceStates();
  const summary = servicesSummary(states);
  const current = route.tab === 'services' ? (route.service ?? null) : undefined;
  const known = current === null || SERVICE_IDS.includes(current as ServiceId);
  const groups: RailGroup[] = [
    {
      key: 'overview',
      entries: [
        {
          key: 'overview',
          label: S.utilitySidebar.overviewServices,
          summary: summary.text,
          Icon: LayoutGrid,
          route: { tab: 'services' },
          // Unknown services fall back to the overview (see ServicesPage).
          current: current === null || (current !== undefined && !known),
        },
      ],
    },
    {
      key: 'local',
      label: S.utilitySidebar.localServices,
      entries: SERVICE_IDS.map((id) => {
        const state = states[id];
        const label = serviceStateLabel(id, state);
        return {
          key: id,
          label: SERVICE_COPY[id].name,
          summary: label,
          Icon: SERVICE_RAIL_ICON[id],
          route: { tab: 'services', service: id },
          current: current === id,
          trailing: serviceBusy(state) ? <Spinner label={label} /> : <RailDot tone={serviceTone(state)} />,
        };
      }),
    },
  ];
  return <PageRail label={S.utilitySidebar.nav(TITLE.services)} groups={groups} className={RAIL_CLASS} />;
}

/** The page rail of Tasks, Tools or Services; only the area's own rail runs (and subscribes to its data). */
export function UtilityRail({ kind }: { kind: UtilityKind }) {
  const route = useShell((s) => s.route);
  return kind === 'tasks' ? <TaskRail route={route} /> : kind === 'tools' ? <ToolRail route={route} /> : <ServiceRail route={route} />;
}

/**
 * The layout of every Tasks, Tools and Services page (agentcut workspace shell): a glass back header naming the area
 * with its one-line note, the area's rail beside, and the page under a section header (title, blurb, actions). The
 * page scrolls inside its column, so a sticky side panel (tool workbenches) sticks to the top of the column.
 */
export function UtilityShell({
  kind,
  title,
  blurb,
  actions,
  before,
  flow = false,
  children,
}: {
  kind: UtilityKind;
  title?: ReactNode;
  blurb?: ReactNode;
  actions?: ReactNode;
  /** A line above the section header, e.g. the way back from a detail page to its overview. */
  before?: ReactNode;
  /** The page spaces its own blocks (margins) instead of the column's 24px gap. */
  flow?: boolean;
  children: ReactNode;
}) {
  const Icon = HEADER_ICON[kind];
  return (
    <RailPage
      fill
      header={
        <BackHeader
          title={TITLE[kind]}
          aside={
            <>
              <Icon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{NOTE[kind]}</span>
            </>
          }
        />
      }
      rail={<UtilityRail kind={kind} />}>
      <div className="flex flex-col gap-6 px-1 pt-1 pb-16">
        {before || title || actions ? (
          <div className="flex flex-col gap-2">
            {before ? <div className="-ml-2 flex">{before}</div> : null}
            {title || actions ? <SectionHeader title={title} blurb={blurb} actions={actions} /> : null}
          </div>
        ) : null}
        {flow ? <div className="flex flex-col">{children}</div> : children}
      </div>
    </RailPage>
  );
}

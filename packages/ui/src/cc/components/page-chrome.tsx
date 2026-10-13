import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { ArrowLeft, CalendarDays, Clock, Library, Radio, Settings, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { S } from '../../components/shell-copy.ts';
import { useServicesAlert } from '../../components/services/use-share-status.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useLegacyImport } from '../../state/legacy-import-store.ts';
import { HOME, defaultRoute, hrefFor, railTabOf, useShell, type Route, type Tab } from '../../state/shell-store.ts';
import { isLive, useTasks } from '../../state/tasks-store.ts';
import { buttonVariants } from '../ui/button.tsx';
import { Glass } from '../ui/glass.tsx';
import { CHROME_COPY } from './chrome-copy.ts';
import { CucCutTile } from './cuccut-mark.tsx';

/*
 * Page chrome, after agentcut's layout: every page is a column of solid content under one glass header. The landing
 * page carries the navigation capsule (mark, name, the places you can go); every other page carries a back header
 * whose arrow leads home. Glass is the navigation layer only — what sits below stays solid.
 *
 * The chrome subtrees are marked `data-cc` so the scoped Tailwind preflight applies to them and nothing else; feature
 * content inside pages keeps its Spectrum styling.
 */

/** In-app link: a real href (open in a new tab works in the browser client) that routes in place on a plain click. */
export function RouteLink({ route, className, children, label, current }: {
  route: Route;
  className?: string;
  children: ReactNode;
  label?: string;
  current?: boolean;
}) {
  const go = useShell((s) => s.go);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(route);
  };
  return (
    <a href={hrefFor(route)} onClick={onClick} className={className} aria-label={label} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  );
}

/** Background tasks still running or queued: agent tasks, jobs, and a legacy import in progress. */
export function useRunningCount(): number {
  return (
    useTasks((s) => s.tasks.filter(isLive).length) +
    useJobs((s) => s.jobs.filter(isJobLive).length) +
    useLegacyImport((s) => (s.run && s.run.state !== 'finished' ? 1 : 0))
  );
}

interface NavItem {
  tab: Exclude<Tab, 'home' | 'models'>;
  label: () => string;
  Icon: LucideIcon;
}

const NAV: NavItem[] = [
  { tab: 'space', label: () => CHROME_COPY.library, Icon: Library },
  { tab: 'calendar', label: () => CHROME_COPY.calendar, Icon: CalendarDays },
  { tab: 'tools', label: () => S.common.tools, Icon: Wrench },
  { tab: 'tasks', label: () => S.common.tasks, Icon: Clock },
  { tab: 'services', label: () => S.common.services, Icon: Radio },
  { tab: 'settings', label: () => S.common.settings, Icon: Settings },
];

/** The places a person can go, as ghost pills. Narrow windows keep the icons and drop the words. */
export function NavLinks({ className }: { className?: string }) {
  const route = useShell((s) => s.route);
  const running = useRunningCount();
  const servicesAlert = useServicesAlert();
  const here = railTabOf(route);
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {NAV.map(({ tab, label, Icon }) => {
        const text = label();
        const name = tab === 'tasks' && running ? S.rail.running(text, running) : tab === 'services' && servicesAlert ? servicesAlert : text;
        return (
          <RouteLink
            key={tab}
            route={defaultRoute(tab)}
            label={name}
            current={here === tab}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'default' }),
              'relative px-3 max-md:size-9 max-md:px-0',
              here === tab ? 'bg-white/10 text-foreground' : 'text-foreground/85',
            )}>
            <Icon aria-hidden className={cn('size-4', here === tab && 'text-primary')} />
            <span className="max-md:sr-only">{text}</span>
            {tab === 'tasks' && running ? (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/85 px-1.5 text-[0.7rem] font-semibold tabular-nums text-primary-foreground max-md:absolute max-md:-top-1 max-md:-right-1 max-md:ml-0">
                {running}
              </span>
            ) : null}
            {tab === 'services' && servicesAlert ? (
              <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent" />
            ) : null}
          </RouteLink>
        );
      })}
    </div>
  );
}

/** The CucCut name with its tile; a link home everywhere except on the landing page itself. */
export function Brand({ asLink = true }: { asLink?: boolean }) {
  const body = (
    <>
      <CucCutTile className="size-7" />
      <span className="text-xl font-bold tracking-[-0.04em] text-foreground">CucCut</span>
    </>
  );
  return asLink ? (
    <RouteLink route={HOME} className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </RouteLink>
  ) : (
    <span className="flex items-center gap-2.5">{body}</span>
  );
}

/**
 * The landing page's navigation capsule (agentcut `projects-view` header): mark and name, the workspace it works in,
 * then the places to go. Thin glass — the landing page has nothing above it to compete with.
 */
export function NavBar({ className }: { className?: string }) {
  return (
    <header data-cc className={cn('cc-drag', className)}>
      <Glass shape="capsule" thickness="thin" className="px-3 py-2 sm:px-4">
        <nav aria-label={S.rail.nav} className="flex min-h-10 items-center gap-3">
          <Brand asLink={false} />
          <span className="hidden border-l border-border pl-3 text-xs text-muted-foreground sm:inline">{CHROME_COPY.workspace}</span>
          <NavLinks className="ml-auto" />
        </nav>
      </Glass>
    </header>
  );
}

/**
 * The header of every page that is not the landing page (agentcut workspace shell / project header): a back arrow
 * home, the page title with an optional line under or beside it, and actions on the right. Thick glass, sticky.
 */
export function BackHeader({
  title,
  subtitle,
  aside,
  actions,
  onBack,
  backLabel,
  sticky = true,
  className,
  children,
}: {
  title: ReactNode;
  /** A second line under the title (e.g. "1920 × 1080 · 2:14:05"). */
  subtitle?: ReactNode;
  /** A short note beside the title, after a hairline (e.g. "Everything here applies to every project"). */
  aside?: ReactNode;
  actions?: ReactNode;
  /** Where the arrow goes; home when omitted. */
  onBack?: () => void;
  backLabel?: string;
  sticky?: boolean;
  className?: string;
  /** Rendered under the capsule row, inside the header (e.g. a job progress bar). */
  children?: ReactNode;
}) {
  const go = useShell((s) => s.go);
  return (
    <header data-cc className={cn('cc-drag z-20', sticky && 'sticky top-4', className)}>
      <Glass shape="capsule" thickness="thick" className="flex min-h-14 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <button
          type="button"
          aria-label={backLabel ?? CHROME_COPY.backHome}
          onClick={onBack ?? (() => go(HOME))}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
          {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {aside ? (
          <span className="hidden min-w-0 items-center gap-1.5 truncate border-l border-white/10 pl-3 text-xs text-muted-foreground sm:inline-flex">
            {aside}
          </span>
        ) : null}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </Glass>
      {children}
    </header>
  );
}

/**
 * A page that scrolls as a whole under its sticky header, centred at agentcut's 6xl measure. Full-height working
 * views (the session editor) do not use it; they lay themselves out inside the frame.
 */
export function PageScroll({ children, className, width = 'max-w-6xl' }: { children: ReactNode; className?: string; width?: string }) {
  return (
    <div className="cc-scroll relative min-h-0 flex-1 overflow-y-auto">
      <div className={cn('mx-auto box-border flex w-full flex-col gap-6 px-4 pt-4 pb-14 sm:px-6', width, className)}>{children}</div>
    </div>
  );
}

/**
 * The strip along the top of the macOS window where the traffic lights sit; dragging it moves the window. Other
 * platforms (and the browser client) draw their own frame, so there it is absent.
 */
export function WindowStrip({ platform }: { platform: string }) {
  if (platform !== 'darwin') return null;
  return <div className="cc-drag h-8 shrink-0" aria-hidden="true" />;
}

/** One place in a page rail: its name, what it holds (wide windows only), and where it goes. */
export interface RailEntry {
  key: string;
  label: string;
  /** "3 rules", "34 files": answers "where did I put that" without opening anything. */
  summary?: string;
  Icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  route: Route;
  current: boolean;
  /** Trailing status: a count, a spinner, a coloured dot. */
  trailing?: ReactNode;
}

export interface RailGroup {
  key: string;
  /** Group heading; omitted for the first, unnamed group. */
  label?: string;
  entries: RailEntry[];
}

/**
 * A page's own navigation (agentcut workspace rail): beside the page on wide windows with a summary under each name;
 * on narrow ones it wraps into chips above the page — no scroller, so every label stays visible.
 */
export function PageRail({ label, groups, footer, className }: { label: string; groups: RailGroup[]; footer?: ReactNode; className?: string }) {
  return (
    <nav data-cc aria-label={label} className={cn('md:w-56 md:shrink-0', className)}>
      <div className="flex flex-wrap gap-1.5 md:sticky md:top-24 md:flex-col md:flex-nowrap md:gap-3">
        {groups.map((group) => (
          <div key={group.key} className="contents md:flex md:flex-col md:gap-0.5">
            {group.label ? (
              <div className="hidden px-2.5 pt-1 pb-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground/80 uppercase md:block">{group.label}</div>
            ) : null}
            <ul className="contents md:flex md:flex-col md:gap-0.5">
              {group.entries.map(({ key, label: name, summary, Icon, route, current, trailing }) => (
                <li key={key}>
                  <RouteLink
                    route={route}
                    current={current}
                    className={cn(
                      'flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition-colors motion-reduce:transition-none md:w-full md:rounded-xl md:px-2.5',
                      'hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      current ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground',
                    )}>
                    {Icon ? <Icon aria-hidden className={cn('size-4 shrink-0', current && 'text-primary')} /> : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn('truncate leading-tight', current && 'font-medium')}>{name}</span>
                      {summary ? (
                        <span title={summary} className="hidden truncate text-xs leading-tight text-muted-foreground/80 md:block">
                          {summary}
                        </span>
                      ) : null}
                    </span>
                    {trailing ? <span className="flex shrink-0 items-center">{trailing}</span> : null}
                  </RouteLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {footer ? <div className="hidden px-2.5 pt-2 text-xs leading-relaxed text-muted-foreground/80 md:block">{footer}</div> : null}
      </div>
    </nav>
  );
}

/**
 * The workspace page layout (agentcut `WorkspaceShell`): a back header above, a rail beside, the page in the middle.
 * `fill` pages (a task log, a file grid with its own scroller) take the window's height and scroll inside `main`;
 * the rest scroll as a whole under the sticky header.
 */
export function RailPage({ header, rail, children, fill = false }: {
  header: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
  fill?: boolean;
}) {
  if (fill) {
    return (
      <div className="mx-auto box-border flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-4 pb-4 sm:px-6">
        {header}
        <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row md:gap-10">
          {rail}
          <main className="cc-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto">{children}</main>
        </div>
      </div>
    );
  }
  return (
    <PageScroll>
      {header}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        {rail}
        <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>
    </PageScroll>
  );
}

/** A page section title with its one-line blurb and actions (agentcut settings `SectionHeader`). */
export function SectionHeader({ title, blurb, actions }: { title: ReactNode; blurb?: ReactNode; actions?: ReactNode }) {
  return (
    <div data-cc className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
        {blurb ? <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{blurb}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

import { useId, useMemo, useState } from 'react';
import type { Conversation, Project } from '@cuccut/protocol';
import { CircleAlert, CircleCheck, Clock, Folder, Loader2, MessageSquare, Pin, Search, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { untitled } from '../../copy.ts';
import { agoLabel } from '../../model/format.ts';
import { buildSidebar, conversationStatus, sessionStatus, type ProjectRow, type SessionStatus } from '../../model/sidebar.ts';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { Input } from '../../cc/ui/input.tsx';
import { useDirectory } from '../../state/directory-store.ts';
import type { Route } from '../../state/shell-store.ts';
import { useNow } from '../use-now.ts';
import { LANDING_COPY } from './landing-copy.ts';
import { LandingSection } from './landing-section.tsx';

/** How many rows show before "Show more". */
const FIRST_ROWS = 8;
/** The search field appears once the list is long enough to need it. */
const SEARCH_FROM = 6;
/** What needs you first, as in the sidebar's summaries. */
const STATUS_ORDER: readonly SessionStatus[] = ['waiting', 'failed', 'running', 'unread'];

interface RecentItem {
  key: string;
  title: string;
  at: string;
  pinned: boolean;
  route: Route;
  Icon: LucideIcon;
  /** What sits on the second line besides the time: "Project · 3 sessions". */
  meta: string | null;
  status: { tone: SessionStatus | 'stopping'; label: string } | null;
}

function projectItem(row: ProjectRow): RecentItem {
  const { project } = row;
  const top = STATUS_ORDER.find((status) => row.conversations.some((c) => sessionStatus(c) === status)) ?? null;
  const sessions = row.conversations.length;
  return {
    key: `project:${project.id}`,
    title: project.name,
    at: row.lastActiveAt,
    pinned: project.pinned,
    route: { tab: 'home', conversationId: null, projectId: project.id },
    Icon: Folder,
    meta: [LANDING_COPY.recent.project, sessions ? LANDING_COPY.recent.sessions(sessions) : null].filter(Boolean).join(' · '),
    status: top && row.summary ? { tone: top, label: row.summary } : null,
  };
}

function sessionItem(conversation: Conversation): RecentItem {
  const status = conversationStatus(conversation);
  const tone = conversation.activity === 'stopping' ? 'stopping' : sessionStatus(conversation);
  return {
    key: `session:${conversation.id}`,
    title: conversation.title || untitled(),
    at: conversation.updatedAt,
    pinned: conversation.pinned,
    route: { tab: 'home', conversationId: conversation.id, projectId: null },
    Icon: MessageSquare,
    meta: null,
    status: status && tone ? { tone, label: status.label } : null,
  };
}

/** Projects (with their sessions inside) and the sessions that belong to no project, newest first. */
export function recentItems(projects: readonly Project[], conversations: readonly Conversation[]): RecentItem[] {
  const tree = buildSidebar(projects, conversations, 'recent');
  return [...tree.projects.map(projectItem), ...tree.loose.map(sessionItem)].sort((a, b) => b.at.localeCompare(a.at));
}

const STATUS_ICON: Record<SessionStatus | 'stopping', LucideIcon> = {
  waiting: Clock,
  failed: CircleAlert,
  running: Loader2,
  stopping: Loader2,
  unread: CircleCheck,
};

/** The status chip at the end of a row (agentcut `ProjectStatus`): neutral when done, tinted while busy, red on failure. */
function StatusChip({ tone, label }: { tone: SessionStatus | 'stopping'; label: string }) {
  const Icon = STATUS_ICON[tone];
  const busy = tone === 'running' || tone === 'stopping';
  return (
    <span
      className={cn(
        'inline-flex max-w-48 shrink-0 items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-xs leading-4 font-medium text-foreground/80 ring-1 ring-foreground/10 ring-inset',
        busy && 'bg-primary/10 text-primary ring-primary/20',
        tone === 'waiting' && 'bg-accent/10 text-accent ring-accent/25',
        tone === 'failed' && 'bg-destructive/10 text-destructive ring-destructive/20',
      )}>
      <Icon aria-hidden strokeWidth={1.75} className={cn('size-3.5 shrink-0', busy && 'motion-safe:animate-spin')} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function RecentRow({ item, now }: { item: RecentItem; now: number }) {
  const { Icon } = item;
  const ago = agoLabel(item.at, now);
  return (
    <li>
      <RouteLink
        route={item.route}
        className="group flex items-center gap-3 rounded-2xl px-2 py-2 outline-none transition-colors duration-150 hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:gap-4">
        <span
          aria-hidden
          className="flex aspect-video w-16 shrink-0 items-center justify-center rounded-lg bg-muted/60 outline-1 -outline-offset-1 outline-white/10 sm:w-20">
          <Icon aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span title={item.title} className="truncate text-sm font-medium text-foreground">
              {item.title}
            </span>
            {item.pinned ? (
              <Pin aria-label={LANDING_COPY.recent.pinned} className="size-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-muted-foreground">
            {item.meta ? (
              <>
                <span className="truncate">{item.meta}</span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span>{ago}</span>
          </span>
        </span>
        {item.status ? <StatusChip tone={item.status.tone} label={item.status.label} /> : null}
      </RouteLink>
    </li>
  );
}

/**
 * "Recent" on the landing page (agentcut `ProjectList`): projects and the sessions outside any project as rows —
 * an icon tile, the name, what it is and when it was last active, and its status. Search appears once the list is
 * long; the first rows show and the rest open on request.
 */
export function RecentList() {
  const id = useId();
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const ready = useDirectory((s) => s.ready);
  const now = useNow(60_000);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

  const items = useMemo(() => recentItems(projects, conversations), [projects, conversations]);
  const term = query.trim().toLocaleLowerCase();
  const matches = term ? items.filter((item) => item.title.toLocaleLowerCase().includes(term)) : items;
  const shown = all || term ? matches : matches.slice(0, FIRST_ROWS);
  const hidden = matches.length - shown.length;

  if (!ready) return null;

  return (
    <LandingSection
      title={LANDING_COPY.recent.title}
      count={items.length}
      blurb={LANDING_COPY.recent.blurb}
      actions={
        items.length >= SEARCH_FROM ? (
          <div className="relative w-full sm:w-64">
            <label htmlFor={`${id}-search`} className="sr-only">
              {LANDING_COPY.recent.search}
            </label>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${id}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={LANDING_COPY.recent.search}
              className="pl-9"
            />
          </div>
        ) : null
      }>
      {shown.length ? (
        <ul aria-label={LANDING_COPY.recent.list} className="flex flex-col divide-y divide-border/50 border-y border-border/70 py-1">
          {shown.map((item) => (
            <RecentRow key={item.key} item={item} now={now} />
          ))}
        </ul>
      ) : null}
      {hidden > 0 || (all && !term && matches.length > FIRST_ROWS) ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
            {hidden > 0 ? LANDING_COPY.recent.more(hidden) : LANDING_COPY.recent.less}
          </Button>
        </div>
      ) : null}
      {items.length > 0 && term && !matches.length ? (
        <div className="flex flex-col items-center gap-2 border-y border-border/60 py-10 text-center">
          <p className="text-sm break-words text-muted-foreground">{LANDING_COPY.recent.noMatch(query.trim())}</p>
          <Button variant="ghost" onClick={() => setQuery('')}>
            {LANDING_COPY.recent.clear}
          </Button>
        </div>
      ) : null}
      {!items.length ? (
        <div className="flex items-center gap-4 border-y border-border/60 py-8">
          <MessageSquare aria-hidden strokeWidth={1.5} className="size-6 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{LANDING_COPY.recent.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{LANDING_COPY.recent.emptyBody}</p>
          </div>
        </div>
      ) : null}
      <p role="status" className="sr-only">
        {term ? LANDING_COPY.recent.found(matches.length) : ''}
      </p>
    </LandingSection>
  );
}

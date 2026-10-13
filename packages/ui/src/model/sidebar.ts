import { defineMessages, intlLocale, type Conversation, type Project } from '@cuccut/protocol';
import { zhHans } from './sidebar.zh-Hans.ts';
import { zhHant } from './sidebar.zh-Hant.ts';
import { ja } from './sidebar.ja.ts';
import { ko } from './sidebar.ko.ts';
import { es } from './sidebar.es.ts';
import { fr } from './sidebar.fr.ts';
import { de } from './sidebar.de.ts';
import { nl } from './sidebar.nl.ts';
import { ptBR } from './sidebar.pt-BR.ts';
import { it } from './sidebar.it.ts';
import { ru } from './sidebar.ru.ts';
import { pl } from './sidebar.pl.ts';
import { tr } from './sidebar.tr.ts';
import { vi } from './sidebar.vi.ts';

/**
 * The Home sidebar tree (product design §3.1). Three sections, top to bottom:
 * pinned (pinned projects and sessions; they also remain in their original place), projects (sorted by recent activity, with their sessions listed below), and
 * recent (sessions that belong to no project). When “in one list” is on, the projects section is replaced by a single table of all sessions (user revision).
 */

export type SessionStatus = 'waiting' | 'failed' | 'running' | 'unread';
export type StatusVariant = 'informative' | 'notice' | 'negative' | 'positive' | 'neutral';

/** Copy for the sidebar status lights and summaries (translations are in `sidebar.<locale>.ts`). */
const en = {
  status: { waiting: 'Waiting for approval', failed: 'Failed', running: 'Running', unread: 'Done, unread' },
  stopping: 'Stopping',
  /** One segment of the project row summary, e.g. “1 in progress”. */
  count: {
    waiting: (n: number) => `${n} waiting for approval`,
    failed: (n: number) => `${n} failed`,
    running: (n: number) => `${n} running`,
    unread: (n: number) => `${n} done, unread`,
  },
};
export type SidebarMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

const statusInfo = (key: SessionStatus, variant: StatusVariant) => ({
  get label() {
    return M.status[key];
  },
  variant,
});

const STATUS_INFO: Record<SessionStatus, { readonly label: string; variant: StatusVariant }> = {
  waiting: statusInfo('waiting', 'notice'),
  failed: statusInfo('failed', 'negative'),
  running: statusInfo('running', 'informative'),
  unread: statusInfo('unread', 'positive'),
};

/** Order within the summary: items that need your action come first. */
const STATUS_ORDER: SessionStatus[] = ['waiting', 'failed', 'running', 'unread'];

export function sessionStatus(conversation: Conversation): SessionStatus | null {
  switch (conversation.activity) {
    case 'awaiting-approval':
      return 'waiting';
    case 'running':
    case 'stopping':
      return 'running';
    case 'failed':
      return 'failed';
    case 'idle':
      return conversation.unread ? 'unread' : null;
  }
}

/** The status light on the second line of a session row; returns null when there is no status, and shows how long ago instead. */
export function conversationStatus(conversation: Conversation): { label: string; variant: StatusVariant } | null {
  if (conversation.activity === 'stopping') return { label: M.stopping, variant: 'neutral' };
  const status = sessionStatus(conversation);
  return status ? STATUS_INFO[status] : null;
}

export interface ProjectRow {
  project: Project;
  conversations: Conversation[];
  /** Summary of session statuses under a project, e.g. “1 in progress · 1 awaiting approval”. */
  summary: string | null;
  lastActiveAt: string;
}

export type PinnedRow = { kind: 'project'; row: ProjectRow } | { kind: 'conversation'; conversation: Conversation };

export interface SidebarTree {
  pinned: PinnedRow[];
  projects: ProjectRow[];
  /** Sessions that belong to no project (“Recent”). */
  loose: Conversation[];
  /** “In one list”: sessions under projects and sessions that belong to no project are placed together. */
  flat: Conversation[];
}

/** Session sort order: by recent activity or by name (sidebar “Session sort”). Projects are always sorted by recent activity. */
export type SidebarSort = 'recent' | 'name';

const byRecent = (a: { updatedAt: string }, b: { updatedAt: string }) => b.updatedAt.localeCompare(a.updatedAt);
const byName = (a: Conversation, b: Conversation) => a.title.localeCompare(b.title, intlLocale()) || byRecent(a, b);

export function buildSidebar(projects: readonly Project[], conversations: readonly Conversation[], sort: SidebarSort = 'recent'): SidebarTree {
  const visible = conversations.filter((c) => !c.archived);
  const order = (list: Conversation[]) => list.sort(sort === 'name' ? byName : byRecent);

  const rows: ProjectRow[] = projects
    .filter((project) => !project.archived)
    .map((project) => {
      const own = visible.filter((c) => c.projectId === project.id).sort(byRecent);
      const last = own[0]?.updatedAt ?? project.lastActiveAt;
      return {
        project,
        conversations: order([...own]),
        summary: summarize(own),
        lastActiveAt: last > project.lastActiveAt ? last : project.lastActiveAt,
      };
    })
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));

  const pinned: PinnedRow[] = [
    ...rows.filter((row) => row.project.pinned).map((row) => ({ kind: 'project' as const, row })),
    ...visible
      .filter((c) => c.pinned)
      .sort(byRecent)
      .map((conversation) => ({ kind: 'conversation' as const, conversation })),
  ];
  const listed = new Set(rows.map((row) => row.project.id));
  return {
    pinned,
    projects: rows,
    loose: order(visible.filter((c) => c.projectId === null)),
    flat: order(visible.filter((c) => c.projectId === null || listed.has(c.projectId))),
  };
}

function summarize(conversations: readonly Conversation[]): string | null {
  const parts = STATUS_ORDER.flatMap((status) => {
    const n = conversations.filter((c) => sessionStatus(c) === status).length;
    return n ? [M.count[status](n)] : [];
  });
  return parts.length ? parts.join(' · ') : null;
}

import { Bot, Check, ChevronRight, Loader2, MessageSquare, Terminal, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { Progress as ProgressRoot } from '@base-ui/react/progress';
import { ProgressIndicator, ProgressTrack } from '../../cc/ui/progress.tsx';
import { TASK_VIEW_COPY } from '../../copy.ts';
import { exportSpeedParts } from '../../model/export-job.ts';
import type { TaskRow, TaskTone } from '../../model/task-list.ts';
import { agoLabel } from '../../model/format.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useExportSpeed } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { LegacyImportCardNote } from '../legacy-import/legacy-import-task.tsx';
import { TASK_KIND_RAIL_ICON } from './task-kind-icon.ts';
import { TK } from './tasks-copy.ts';
import { actionLabel, useTaskAction } from './use-task-actions.ts';

/** 打开会话：会话还在目录里才给（智能体经工具提交的 Job 指回它的会话）。 */
export function useOpenConversation(row: Pick<TaskRow, 'conversationId'>): (() => void) | null {
  const go = useShell((s) => s.go);
  const exists = useDirectory((s) => !!row.conversationId && s.conversations.some((c) => c.id === row.conversationId));
  if (!row.conversationId || !exists) return null;
  const conversationId = row.conversationId;
  return () => go({ tab: 'home', conversationId, projectId: null });
}

/** Status pill colours: failures read as destructive, everything else stays neutral (status never wears the accent). */
const PILL: Record<TaskTone, string> = {
  accent: 'bg-white/8 text-foreground',
  info: 'bg-white/8 text-foreground',
  notice: 'bg-orange-400/12 text-orange-300',
  neutral: 'bg-white/6 text-muted-foreground',
  positive: 'bg-white/6 text-muted-foreground',
  negative: 'bg-destructive/15 text-destructive',
};

/** The status pill on a task row (agentcut `Badge`): a spinner while it runs, a check when done. */
export function TaskStatusPill({ row }: { row: Pick<TaskRow, 'label' | 'tone' | 'live' | 'queued' | 'waiting'> }) {
  const running = row.live && !row.queued && !row.waiting;
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap', PILL[row.tone])}>
      {running ? <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" /> : null}
      {row.tone === 'positive' ? <Check aria-hidden className="size-3" /> : null}
      {row.tone === 'negative' ? <TriangleAlert aria-hidden className="size-3" /> : null}
      {row.label}
    </span>
  );
}

/** Where the task came from: an agent (with its mark) or the command line. */
export function TaskSourcePill({ chip }: { chip: TaskRow['chip'] }) {
  if (!chip) return null;
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-xs text-muted-foreground">
      {chip === 'agent' ? <Bot aria-hidden className="size-3" /> : <Terminal aria-hidden className="size-3" />}
      {chip === 'agent' ? TASK_VIEW_COPY.chipAgent : TASK_VIEW_COPY.chipCli}
    </span>
  );
}

/** The kind tile at the start of a task row: a 40px rounded square, tinted red when the task failed. */
export function TaskKindTile({ row, className }: { row: Pick<TaskRow, 'kind' | 'tone'>; className?: string }) {
  const Icon = TASK_KIND_RAIL_ICON[row.kind];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-2xl',
        row.tone === 'negative' ? 'bg-destructive/12 text-destructive' : 'bg-white/6 text-foreground/80',
        className,
      )}>
      <Icon className="size-[18px]" />
    </span>
  );
}

/**
 * A task's progress (agentcut `Progress`, h-1.5): a determinate bar with its percentage, or a soft pulsing bar when the
 * runtime can't say how far along it is.
 */
export function TaskProgressBar({ row, className }: { row: Pick<TaskRow, 'title' | 'label' | 'progress'>; className?: string }) {
  if (row.progress === null) return null;
  const label = TK.progress(row.title, row.label);
  if (row.progress === 'indet') {
    return (
      <div role="progressbar" aria-label={label} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)}>
        <div className="h-full w-full rounded-full bg-white/30 motion-safe:animate-pulse" />
      </div>
    );
  }
  // Built from the Base UI root and cc's track/indicator because cc `Progress` always appends its own 4px track and
  // takes no track class; task bars are 6px (agentcut `h-1.5`).
  return (
    <ProgressRoot.Root value={row.progress} aria-label={label} className={cn('w-full', className)}>
      <ProgressTrack className="h-1.5 bg-white/8">
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot.Root>
  );
}

/**
 * One background task as a solid row card (agentcut project clip rows): kind tile, title with its status and source,
 * "where · when", a progress bar while it runs, then its actions. The title links to the task's details; the link
 * covers the whole card so the row is one target, and the buttons sit above it.
 */
export function TaskCard({ row, now }: { row: TaskRow; now: number }) {
  const act = useTaskAction();
  const openConversation = useOpenConversation(row);
  const speed = exportSpeedParts(useExportSpeed(row.origin === 'job' ? row.id : null));
  return (
    <li
      data-cc
      className="group/task relative flex items-center gap-4 rounded-3xl bg-card px-4 py-3.5 ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 hover:bg-secondary hover:ring-foreground/20 motion-reduce:transition-none">
      <TaskKindTile row={row} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <RouteLink
            route={{ tab: 'tasks', taskId: row.id }}
            label={`${row.title} · ${TASK_VIEW_COPY.details}`}
            className="truncate text-sm font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
            <span title={row.title}>{row.title}</span>
          </RouteLink>
          <TaskStatusPill row={row} />
          <TaskSourcePill chip={row.chip} />
        </div>
        <div className="truncate text-xs text-muted-foreground">{[row.where, agoLabel(row.startedAt, now), ...speed].filter(Boolean).join(' · ')}</div>
        {row.progress !== null ? <TaskProgressBar row={row} className="mt-1.5 max-w-md" /> : null}
        {/* Legacy import leftovers: why, what to do, retry all / skip all. */}
        {row.origin === 'legacy-import' ? (
          <div className="relative z-10">
            <LegacyImportCardNote />
          </div>
        ) : null}
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        {openConversation ? (
          <Button variant="ghost" size="sm" onClick={openConversation}>
            <MessageSquare aria-hidden />
            <span className="max-lg:sr-only">{TASK_VIEW_COPY.openConversation}</span>
          </Button>
        ) : null}
        {row.action ? (
          <Button variant="outline" size="sm" onClick={() => act(row.action!)}>
            {actionLabel(row.action)}
          </Button>
        ) : null}
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </div>
    </li>
  );
}

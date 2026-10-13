import type { ReactNode } from 'react';
import type { Id } from '@cuccut/protocol';
import { TASK_VIEW_COPY } from '../copy.ts';
import { taskGroups, type TaskGroup } from '../model/task-list.ts';
import { TaskCard } from './tasks/task-card.tsx';
import { TaskDetail } from './tasks/task-detail.tsx';
import { RAIL_COPY } from './tasks/rail-copy.ts';
import { useTaskRows } from './tasks/use-task-rows.ts';
import { useNow } from './use-now.ts';
import { UtilityShell } from './utility-sidebar.tsx';

/**
 * Background tasks (agentcut workspace page): agent tasks and the jobs behind transcription, dubbing, generation and
 * exports in one list, split into "In progress" and "Done"; pick one for its details. Tasks belong to a session or a
 * video; this page only gathers them.
 */
export function TasksPage({ taskId }: { taskId?: Id }) {
  return taskId ? <TaskDetail taskId={taskId} /> : <TaskList />;
}

function TaskList() {
  const { rows, ready } = useTaskRows();
  const [active, history] = taskGroups(rows);
  // Running tasks tick every second (elapsed time and progress); when all are done only "how long ago" moves.
  const now = useNow(active.items.length ? 1000 : 30_000);

  return (
    <UtilityShell kind="tasks" title={TASK_VIEW_COPY.pageTitle} blurb={RAIL_COPY.tasksBlurb}>
      <TaskSection group={active} now={now} empty={ready ? <Empty title={TASK_VIEW_COPY.emptyActive}>{TASK_VIEW_COPY.emptyActiveBody}</Empty> : null} />
      <TaskSection group={history} now={now} empty={ready ? <Empty title={TASK_VIEW_COPY.emptyHistory} /> : null} />
    </UtilityShell>
  );
}

function TaskSection({ group, now, empty }: { group: TaskGroup; now: number; empty: ReactNode }) {
  const heading = `tasks-${group.id}`;
  return (
    <section data-cc aria-labelledby={heading} className="flex flex-col gap-3">
      <h3 id={heading} className="flex items-baseline gap-2 px-1 text-sm font-medium text-foreground">
        {/* The same names as the rail ("In progress", "Done"). */}
        {group.id === 'active' ? TASK_VIEW_COPY.activeSection : TASK_VIEW_COPY.historySection}
        {group.items.length ? <span className="text-xs text-muted-foreground tabular-nums">{group.items.length}</span> : null}
      </h3>
      {group.items.length ? (
        <ul className="flex flex-col gap-2">
          {group.items.map((row) => (
            <TaskCard key={row.id} row={row} now={now} />
          ))}
        </ul>
      ) : (
        empty
      )}
    </section>
  );
}

/** A section with nothing in it yet (agentcut `Empty`): what this place is for. */
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-3xl bg-card px-5 py-6 ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children ? <p className="max-w-prose text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}

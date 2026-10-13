import { useCallback } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { TASK_VIEW_COPY } from '../../copy.ts';
import type { TaskAction, TaskKind } from '../../model/task-list.ts';
import { useRuntime } from '../../runtime/context.tsx';

/** Stopping an agent task goes through `tasks.stop`; cancelling a Job goes through `jobs.cancel`. On failure, show a message and do not change local state (wait for the topic event). */
export function useTaskAction(): (action: TaskAction) => void {
  const runtime = useRuntime();
  return useCallback(
    (action: TaskAction) => {
      if (action.type === 'stop') {
        runtime.stop(action.taskId).catch((e: Error) => ToastQueue.negative(TASK_VIEW_COPY.stopFailed(e.message), { timeout: 5000 }));
      } else {
        runtime.cancelJob(action.jobId).catch((e: Error) => ToastQueue.negative(TASK_VIEW_COPY.cancelFailed(e.message), { timeout: 5000 }));
      }
    },
    [runtime],
  );
}

/** The label on the button in the list and on the pill: for an agent task “Stop”, for a Job “Cancel”. */
export function actionLabel(action: TaskAction): string {
  return action.type === 'stop' ? TASK_VIEW_COPY.stop : TASK_VIEW_COPY.cancel;
}

/** The large button on the detail page (prototype page-tasks.jsx “Cancel task / Cancel export”). */
export function actionTitle(action: TaskAction, kind: TaskKind): string {
  if (action.type === 'stop') return TASK_VIEW_COPY.stopTask;
  return kind === 'export' ? TASK_VIEW_COPY.cancelExport : TASK_VIEW_COPY.cancelTask;
}

import { useCallback } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { barrierTasks, restartAsk, retryAction, type BarrierTask, type UpdateAction } from '../../model/app-update.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useAppUpdate } from '../../state/app-update-store.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useTasks } from '../../state/tasks-store.ts';
import { U, type UpdateStep } from './update-copy.ts';

/*
 * Update actions (design settings-update.jsx `act`): the About page, the update window opened from the rail button, and toasts all use the same set. Checking, downloading, canceling and installing are all done by the main process;
 * here they are only forwarded to the host's `updates` surface; “restart and update” goes through the stop barrier first (architecture design §2.6).
 */

const failed = (step: UpdateStep) => (error: unknown) =>
  ToastQueue.negative(U.failed(step, error instanceof Error ? error.message : String(error)), { timeout: 5000 });

/** Background tasks still running now (reads the current values of the two stores, without subscribing). */
export function liveBarrierTasks(): BarrierTask[] {
  return barrierTasks(useJobs.getState().jobs, useTasks.getState().tasks, isJobLive);
}

/** Hands off to the main process to install: verification, swapping the package and quitting all happen there; from here on it no longer waits for background tasks. */
export function installNow(runtime: RuntimeSession): void {
  const updates = runtime.host.updates;
  if (!updates) return;
  useAppUpdate.getState().setWaiting(false);
  void updates.install().catch(failed('install'));
}

/** “stop now and install”: first stop the running Agent tasks and cancel the Jobs, and install once both have responded; tasks that cannot be stopped do not block the install (the Runtime still stops them when it exits). */
export async function stopAllAndInstall(runtime: RuntimeSession): Promise<void> {
  const tasks = liveBarrierTasks();
  await Promise.allSettled(
    tasks.map((task) => {
      if (!task.action) return Promise.resolve();
      return task.action.type === 'stop' ? runtime.stop(task.action.taskId) : runtime.cancelJob(task.action.jobId);
    }),
  );
  installNow(runtime);
}

/**
 * “restart and update”: if background tasks are running, it opens the stop barrier; if not, it installs directly.
 *
 * The update window (a base-ui modal) and the barrier (a Spectrum alert, react-aria focus scope) are two modal systems
 * that must not stack: base-ui would read a click in the alert as an outside click and both would fight over focus.
 * So when the request comes from the open window, the window closes first (focus goes back to what opened it) and the
 * barrier opens on the next task, restoring focus there when it closes.
 */
export function requestRestart(runtime: RuntimeSession): void {
  if (!restartAsk(liveBarrierTasks())) {
    installNow(runtime);
    return;
  }
  const store = useAppUpdate.getState();
  if (!store.windowOpen) {
    store.openBarrier();
    return;
  }
  store.closeWindow();
  setTimeout(() => useAppUpdate.getState().openBarrier(), 0);
}

export function useUpdateActions(): (action: UpdateAction) => void {
  const runtime = useRuntime();
  return useCallback(
    (action: UpdateAction) => {
      const updates = runtime.host.updates;
      if (!updates) return;
      const store = useAppUpdate.getState();
      switch (action) {
        case 'check':
          void updates.check().catch(failed('check'));
          return;
        case 'download':
          void updates.download().catch(failed('download'));
          return;
        case 'cancel':
          void updates.cancel().catch(failed('cancel'));
          return;
        case 'restart':
          requestRestart(runtime);
          return;
        case 'retry': {
          const state = store.snapshot?.state;
          if (!state) return;
          const run = retryAction(state) === 'download' ? updates.download() : updates.check();
          void run.catch(failed('retry'));
          return;
        }
        case 'downloadPage':
          void updates.openDownloadPage().catch(failed('downloadPage'));
          return;
        case 'later':
          store.closeWindow();
          return;
        case 'stopWaiting':
          store.setWaiting(false);
          return;
        case 'install':
          return;
      }
    },
    [runtime],
  );
}

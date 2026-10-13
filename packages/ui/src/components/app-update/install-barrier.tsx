import { useRef } from 'react';
import { AlertDialog, DialogContainer } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { barrierTasks, restartAsk, type RestartAsk } from '../../model/app-update.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useAppUpdate } from '../../state/app-update-store.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useTasks } from '../../state/tasks-store.ts';
import { stopAllAndInstall } from './use-update-actions.ts';

/*
 * Stop barrier before install (architecture design §2.6; confirmation in the design's settings-update.jsx `restart`): when “重启并更新” (restart and update) is clicked while background tasks are still running,
 * it asks first — “现在停止并安装” (stop now and install) stops the Agent tasks and cancels the Jobs, then hands off to the main process to install; “等任务结束后安装” (install after tasks finish) records the wait and installs automatically once all tasks have finished;
 * “稍后” (later) does nothing. Tasks that may still run or keep billing on the remote after being stopped are listed in the body.
 */

const para = style({ marginBottom: 0, marginTop: { default: 0, ':nth-child(n+2)': 12 } });
const list = style({ marginTop: 8, marginBottom: 0, paddingStart: 20 });
const item = style({ marginTop: { default: 0, ':nth-child(n+2)': 4 } });
const where = style({ color: 'gray-600' });

export function InstallBarrier() {
  const runtime = useRuntime();
  const open = useAppUpdate((s) => s.barrierOpen);
  const closeBarrier = useAppUpdate((s) => s.closeBarrier);
  const setWaiting = useAppUpdate((s) => s.setWaiting);
  const jobs = useJobs((s) => s.jobs);
  const tasks = useTasks((s) => s.tasks);
  // The list changes live with the tasks; if all tasks happen to finish while it is open, the previous content is kept and the user chooses (we do not restart for them).
  const last = useRef<RestartAsk | null>(null);
  const live = open ? restartAsk(barrierTasks(jobs, tasks, isJobLive)) : null;
  if (live) last.current = live;
  const ask = open ? (live ?? last.current) : null;
  return (
    <DialogContainer onDismiss={closeBarrier}>
      {ask ? (
        <AlertDialog
          variant="warning"
          title={ask.title}
          primaryActionLabel={ask.stopLabel}
          secondaryActionLabel={ask.waitLabel}
          cancelLabel={ask.cancelLabel}
          autoFocusButton="secondary"
          onPrimaryAction={() => void stopAllAndInstall(runtime)}
          onSecondaryAction={() => setWaiting(true)}>
          <p className={para}>{ask.body}</p>
          {ask.remoteTitle ? (
            <>
              <p className={para}>{ask.remoteTitle}</p>
              <ul className={list}>
                {ask.remote.map((task) => (
                  <li key={task.id} className={item}>
                    {task.title}
                    {task.where ? <span className={where}> · {task.where}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </AlertDialog>
      ) : null}
    </DialogContainer>
  );
}

import { useAppUpdate } from '../../state/app-update-store.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { isLive, useTasks } from '../../state/tasks-store.ts';

/** When waiting to install after background tasks finish, how many are still running; null when not waiting. */
export function useWaitingCount(): number | null {
  const waiting = useAppUpdate((s) => s.waiting);
  const running = useTasks((s) => s.tasks.filter(isLive).length) + useJobs((s) => s.jobs.filter(isJobLive).length);
  return waiting ? running : null;
}

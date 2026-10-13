import { create } from 'zustand';
import { applyTasksEvent } from '@cuccut/client';
import type { ConversationActivity, PendingApproval, TaskSummary, TasksEvent, TasksSnapshot } from '@cuccut/protocol';
import { SC } from './state-copy.ts';

/**
 * Task mirror (the task center and the task pill in the title bar). Rewritten only by the Runtime's snapshots and events.
 * `approvals`: pending approvals, both conversation and external-service ones are here (architecture design §3.12); the service approval card takes its outbound grants (`grants`) from here.
 */
export interface TasksStore {
  ready: boolean;
  tasks: TaskSummary[];
  approvals: PendingApproval[];
  replace(snapshot: TasksSnapshot): void;
  apply(event: TasksEvent): void;
}

export const useTasks = create<TasksStore>()((set) => ({
  ready: false,
  tasks: [],
  approvals: [],
  replace: (snapshot) => set({ ready: true, tasks: snapshot.tasks, approvals: snapshot.approvals ?? [] }),
  apply: (event) =>
    set((s) => {
      const next = applyTasksEvent({ tasks: s.tasks, approvals: s.approvals }, event);
      return { tasks: next.tasks, approvals: next.approvals ?? s.approvals };
    }),
}));

export function isLive(task: TaskSummary): boolean {
  return task.status === 'running' || task.status === 'stopping';
}

/** How an in-progress task is labelled. While waiting for user approval, the task itself is still in progress; the waiting is recorded on the conversation's activity (product design §3.1). */
export function liveLabel(task: TaskSummary, activity: ConversationActivity | undefined): string {
  if (task.status === 'stopping') return SC.task.stopping;
  return activity === 'awaiting-approval' ? SC.task.awaitingApproval : SC.task.running;
}

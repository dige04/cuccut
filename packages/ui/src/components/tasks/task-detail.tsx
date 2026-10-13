import { useState, type ReactNode } from 'react';
import type { Id, JobReconcileDecision, JobRecord, TaskSummary } from '@cuccut/protocol';
import { ActionButton, Button, Text, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import ChevronLeft from '@react-spectrum/s2/icons/ChevronLeft';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { TASK_VIEW_COPY } from '../../copy.ts';
import { exportSpeedParts } from '../../model/export-job.ts';
import { agoLabel } from '../../model/format.ts';
import { isLinkImport } from '../../model/link-import.ts';
import { jobRemedy, taskFacts } from '../../model/task-facts.ts';
import type { TaskRow } from '../../model/task-list.ts';
import { chargesOnRetry, reconcileOptions } from '../../model/task-reconcile.ts';
import { rerunOf, toolOfTask } from '../../model/tool-rerun.ts';
import { toolRunOf } from '../../model/tool-runs.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useExportSpeed, useJobs } from '../../state/jobs-store.ts';
import { useLegacyImport } from '../../state/legacy-import-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useTasks } from '../../state/tasks-store.ts';
import { AgentIcon } from '../agent-icon.tsx';
import { LegacyImportDetail } from '../legacy-import/legacy-import-task.tsx';
import { useNow } from '../use-now.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { LinkImportDetail } from './link-import-detail.tsx';
import { TaskProgressBar, TaskSourcePill, TaskStatusPill, useOpenConversation } from './task-card.tsx';
import { TaskFacts, TaskImages, TaskOutputs, TaskSource } from './task-sections.tsx';
import { TK } from './tasks-copy.ts';
import { ToolRunPanel } from './tool-run-panel.tsx';
import { ToolTaskOutputs, ToolTaskRerun } from './tool-task-outputs.tsx';
import { useTaskRows } from './use-task-rows.ts';
import { actionTitle, useTaskAction } from './use-task-actions.ts';

const back = style({ alignSelf: 'start' });
const actionRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });
const hint = style({ font: 'ui-sm', color: 'gray-600' });
const noteHead = style({ display: 'flex', alignItems: 'center', gap: 8 });
const noteIcon = style({ display: 'flex', flexShrink: 0, color: { default: 'gray-700', isError: 'red-900' } });
const noteTitle = style({ font: 'title-sm', color: { default: 'gray-900', isError: 'negative' }, overflowWrap: 'anywhere', minWidth: 0 });
const noteBody = style({ font: 'ui-sm', color: 'gray-600', marginTop: '[6px]' });
const noteActions = style({ display: 'flex', gap: 8, marginTop: 12 });

/**
 * A solid panel in the page column (agentcut `Panel`); errors get a red hairline and a faint red wash. It holds Spectrum
 * buttons, so it is not `data-cc`: the box model and its paragraphs' margins are set here instead of by the preflight.
 */
function Panel({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <div className={`box-border flex flex-col gap-3 rounded-3xl px-5 py-4 ring-1 [&>p]:m-0 ${error ? 'bg-destructive/8 ring-destructive/30' : 'bg-card ring-foreground/10'}`}>
      {children}
    </div>
  );
}

/** Task detail (prototype page-tasks.jsx `TaskDetailPage`): agent tasks and Jobs share one page; looks up a task by ID first, then a Job. */
export function TaskDetail({ taskId }: { taskId: Id }) {
  const { rows, ready } = useTaskRows({ fold: false });
  const row = rows.find((r) => r.id === taskId);
  const job = useJobs((s) => s.jobs.find((j) => j.jobId === taskId));
  const task = useTasks((s) => s.tasks.find((t) => t.taskId === taskId));
  const legacyRun = useLegacyImport((s) => s.run);
  const go = useShell((s) => s.go);
  const backButton = (
    <ActionButton isQuiet size="S" styles={back} onPress={() => go({ tab: 'tasks' })}>
      <ChevronLeft />
      <Text>{TASK_VIEW_COPY.back}</Text>
    </ActionButton>
  );
  if (!row) {
    return (
      <UtilityShell kind="tasks" before={backButton} title={ready ? TASK_VIEW_COPY.notFound : undefined}>
        {ready ? (
          <Panel>
            <p className="text-sm text-muted-foreground">{TASK_VIEW_COPY.notFoundBody}</p>
          </Panel>
        ) : null}
      </UtilityShell>
    );
  }
  // Importing legacy projects has its own page (counts, reasons for items not imported and remedies, imported / skipped).
  if (row.origin === 'legacy-import' && legacyRun) return <LegacyImportDetail row={row} run={legacyRun} backButton={backButton} />;
  // Importing from a link has its own page (three steps, remedies, download tool).
  if (job && isLinkImport(job) && !toolRunOf(job)) return <LinkImportDetail row={row} job={job} backButton={backButton} />;
  return <TaskDetailBody row={row} job={job} task={task} backButton={backButton} />;
}

function TaskDetailBody({ row, job, task, backButton }: { row: TaskRow; job?: JobRecord; task?: TaskSummary; backButton: ReactNode }) {
  const go = useShell((s) => s.go);
  const act = useTaskAction();
  const openConversation = useOpenConversation(row);
  const now = useNow(1000, row.live);
  const speed = exportSpeedParts(useExportSpeed(job?.jobId));
  const remedy = job ? jobRemedy(job) : null;
  const failed = job ? job.state === 'failed' : task?.status === 'failed';
  // Video tool runs (transcription, subtitle translation, dubbing translation): steps, the explanation for a stop, and retries all live in ToolRunPanel; no separate failure message is written here.
  const toolRun = job ? toolRunOf(job) : null;
  // Direct tool-page tasks and file transcoding: the failure reason is written above “重试” (Retry), and “重试 / 再做一次” (Retry / Run again) returns to the tool page with its parameters already filled in (product design §2.7).
  const rerun = job ? rerunOf(job) : null;
  const refill = rerun?.mode === 'refill' ? rerun : null;
  const actionHint =
    row.action?.type === 'stop' ? TASK_VIEW_COPY.stopHint : row.kind === 'export' ? TASK_VIEW_COPY.cancelExportHint : null;

  return (
    <UtilityShell
      kind="tasks"
      before={backButton}
      title={row.title}
      blurb={[row.kindText, row.where, agoLabel(row.startedAt, now)].filter(Boolean).join(' · ')}
      actions={
        <span data-cc className="flex items-center gap-2">
          <TaskStatusPill row={row} />
          <TaskSourcePill chip={row.chip} />
        </span>
      }>
      {(row.live && !row.queued && row.progress !== null) || (row.live && row.phase) || row.action || openConversation ? (
        <Panel>
          {row.live && !row.queued && row.progress !== null ? <TaskProgressBar row={row} className="max-w-xl" /> : null}
          {row.live && row.phase ? <p className="text-sm text-muted-foreground">{[row.phase, ...speed].join(' · ')}</p> : null}
          {row.action ? (
            <div className={actionRow}>
              <Button variant="negative" fillStyle="outline" size="M" onPress={() => act(row.action!)}>
                {actionTitle(row.action, row.kind)}
              </Button>
              {actionHint ? <span className={hint}>{actionHint}</span> : null}
            </div>
          ) : null}
          {openConversation ? (
            <div className={actionRow}>
              <Button variant="secondary" size="S" onPress={openConversation}>
                <AgentIcon />
                <Text>{TASK_VIEW_COPY.openConversation}</Text>
              </Button>
              <span className={hint}>{row.origin === 'job' ? TASK_VIEW_COPY.conversationHint : TASK_VIEW_COPY.agentTaskHint}</span>
            </div>
          ) : null}
        </Panel>
      ) : null}
      {job && toolRun ? <ToolRunPanel job={job} tool={toolRun} /> : null}

      {job?.state === 'cancelled' || job?.state === 'interrupted' || job?.state === 'needs-reconciliation' ? (
        <Panel>
          <div className={noteHead}>
            <span className={noteIcon({})}>
              <InfoCircle />
            </span>
            <span className={noteTitle({})}>{row.label}</span>
          </div>
          <div className={noteBody}>
            {job.state === 'cancelled'
              ? TASK_VIEW_COPY.cancelledBody
              : job.state === 'interrupted'
                ? TASK_VIEW_COPY.interruptedBody
                : TASK_VIEW_COPY.needsReconciliationBody}
          </div>
        </Panel>
      ) : null}
      {failed && row.error && !toolRun && !refill ? (
        <Panel error>
          <div className={noteHead}>
            <span className={noteIcon({ isError: true })}>
              <AlertTriangle />
            </span>
            <span className={noteTitle({ isError: true })}>{row.error}</span>
          </div>
          {remedy ? (
            <>
              <div className={noteBody}>{remedy.hint}</div>
              <div className={noteActions}>
                <Button variant="accent" size="S" onPress={() => go(remedy.target)}>
                  {remedy.label}
                </Button>
              </div>
            </>
          ) : null}
        </Panel>
      ) : null}
      {job && refill ? <ToolTaskRerun job={job} rerun={refill} error={failed ? row.error : null} remedy={failed ? remedy : null} /> : null}
      {job ? <ReconcileActions job={job} /> : null}

      <TaskSource job={job} task={task} />
      {job ? <TaskImages job={job} now={now} /> : null}
      <TaskFacts rows={taskFacts(row, { job, task }, now)} />
      {job && toolOfTask(job) ? (
        <ToolTaskOutputs job={job} fallback={<TaskOutputs job={job} />} />
      ) : job ? (
        <TaskOutputs job={job} />
      ) : null}
    </UtilityShell>
  );
}

const RECONCILE_LABEL: Record<JobReconcileDecision, string> = {
  retry: TASK_VIEW_COPY.reconcileRetry,
  discard: TASK_VIEW_COPY.reconcileDiscard,
  apply: TASK_VIEW_COPY.reconcileApply,
};

/** The reconciliation decisions (`jobs.reconcile`, architecture design §7.5): one line each, with the consequence stated next to the button. Results come back through the `jobs` topic. */
function ReconcileActions({ job }: { job: JobRecord }) {
  const runtime = useRuntime();
  const [busy, setBusy] = useState(false);
  const options = reconcileOptions(job);
  if (options.length === 0) return null;
  const decide = (decision: JobReconcileDecision) => {
    setBusy(true);
    runtime
      .reconcileJob(job.jobId, decision)
      .catch((e: Error) => ToastQueue.negative(TASK_VIEW_COPY.reconcileFailed(e.message), { timeout: 5000 }))
      .finally(() => setBusy(false));
  };
  const hintOf = (decision: JobReconcileDecision) =>
    decision === 'retry'
      ? TASK_VIEW_COPY.reconcileRetryHint(chargesOnRetry(job))
      : decision === 'discard'
        ? TASK_VIEW_COPY.reconcileDiscardHint
        : TASK_VIEW_COPY.reconcileApplyHint;
  return (
    <Panel>
      {options.map((decision) => (
        <div key={decision} className={actionRow}>
          <Button variant="secondary" size="S" isPending={busy} onPress={() => decide(decision)}>
            {RECONCILE_LABEL[decision]}
          </Button>
          <span className={hint}>{hintOf(decision)}</span>
        </div>
      ))}
    </Panel>
  );
}

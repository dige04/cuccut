import { useMemo } from 'react';
import { pipelineStepLabel, type DocumentRecord, type Id, type JobRecord } from '@cuccut/protocol';
import { Button, Content, Heading, InlineAlert, ProgressBar } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { TASK_VIEW_COPY, VIDEO_CARD_COPY } from '../../copy.ts';
import { languageName } from '../../model/caption-tracks.ts';
import { langName } from '../../model/tools-models.ts';
import { isTranslateJob, refreshOf, sourceOf, targetOf, translateProgress, type TranslateProgress } from '../../model/translate-progress.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useOpenConversation } from '../tasks/task-card.tsx';
import { TRANSLATE_COPY as C } from './translate-copy.ts';
import {
  cancelTranslate,
  dismissReceipt,
  dismissTranslateProblem,
  retryTranslate,
  undoReceipt,
  useTranslateRun,
  type TranslateProblem,
  type TranslateReceipt,
  type TranslateRun,
} from './translate-run.ts';

/*
 * Running state, problems and receipt for subtitle translation (prototype panel-translate.jsx `TransRunHead`, `SelfRunHead`, `DoneView`, model-trans-run.js).
 * Progress is read only from what the Runtime reports: the parent task's steps, and the sentence count of the translation step's subtask. When there is no total, no percentage is shown.
 * When the agent translates inside the session itself (`agentTranslate`), there are no steps or percentage: an indeterminate progress bar, no total sentence count, an entry point to that session, and no cancel.
 */

const head = style({
  flexShrink: 0,
  paddingX: 12,
  paddingTop: 12,
  paddingBottom: '[14px]',
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const titleRow = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui', color: 'gray-900' });
const dot = style({ flexShrink: 0, width: 8, height: 8, borderRadius: 'full', backgroundColor: { default: 'blue-800', isQueued: 'gray-400' } });
const title = style({ flexGrow: 1, minWidth: 0, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const percent = style({ flexShrink: 0, font: 'ui-sm', color: 'gray-700' });
const bar = style({ width: 'full', marginTop: 8 });
const meta = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '[6px]', marginTop: '[6px]', font: 'ui-xs', color: 'gray-600' });
const sep = style({ color: 'gray-400' });
const ladder = style({ display: 'flex', gap: 8, marginTop: '[10px]' });
const step = style({ flexGrow: 1, flexBasis: 0, minWidth: 0 });
const stepBar = style({
  display: 'block',
  height: 4,
  borderRadius: 'full',
  backgroundColor: { default: 'gray-300', isDone: 'green-900', isCurrent: 'blue-900', isBad: 'red-900' },
});
const stepLabel = style({
  display: 'block',
  marginTop: 4,
  fontSize: '[10px]',
  color: { default: 'gray-500', isDone: 'green-1000', isCurrent: 'blue-1000', isBad: 'red-1000' },
  fontWeight: { default: 'normal', isCurrent: 'bold' },
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const actions = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 });
const note = style({ flexGrow: 1, minWidth: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const alertBox = style({ flexShrink: 0, paddingX: 12, paddingTop: 12 });
const alertActions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 });
const alertNote = style({ marginTop: 4, font: 'ui-xs', color: 'gray-700' });

export interface TranslateLive {
  /** The run submitted from here; null for runs started elsewhere. */
  run: TranslateRun | null;
  /** The parent task; null when just submitted and the receipt has not arrived yet. */
  job: JobRecord | null;
  target: string | null;
  source: Id | null;
  progress: TranslateProgress | null;
}

/** The translation running for this video: either the one submitted from here, or one started elsewhere (by an agent or the command line) that is still alive. */
export function useTranslateLive(videoId: Id | null): TranslateLive | null {
  const run = useTranslateRun((s) => (videoId ? (s.runs[videoId] ?? null) : null));
  const jobs = useJobs((s) => s.jobs);
  return useMemo(() => {
    if (!videoId) return null;
    const job = run
      ? run.jobId
        ? (jobs.find((j) => j.jobId === run.jobId) ?? null)
        : null
      : (jobs.find((j) => isTranslateJob(j, videoId) && isJobLive(j) && !refreshOf(j)) ?? null);
    if (!run && !job) return null;
    return {
      run,
      job,
      target: run?.targetLanguage ?? (job ? targetOf(job) : null),
      source: run?.speechDocumentId ?? (job ? sourceOf(job) : null),
      progress: job ? translateProgress(job, jobs) : null,
    };
  }, [videoId, run, jobs]);
}

/** A chip on the track bar for the language being translated: name, percentage (null when absent), and the step in progress. */
export function liveChip(live: TranslateLive | null): { label: string; percent: number | null; step: string } | null {
  if (!live?.target) return null;
  const label = languageName(live.target);
  if (!live.run || live.run.status === 'running') {
    const progress = live.progress;
    if (!progress) return { label, percent: null, step: C.submitting };
    if (progress.agent) return { label, percent: null, step: VIDEO_CARD_COPY.agentTranslating };
    return { label, percent: progress.queued ? null : progress.percent, step: progress.queued ? C.queued : (progress.step ?? C.queued) };
  }
  return { label, percent: null, step: C.submitting };
}

/** Running-state header (prototype `TransRunHead`): source → target, percentage, progress bar, sentence count and steps, step ladder, cancel. */
export function TranslateRunHead({ live, documents }: { live: TranslateLive; documents: Record<Id, DocumentRecord> }) {
  const { run, job, progress } = live;
  if (job && progress?.agent) return <AgentRunHead live={live} job={job} sentences={progress.agent.sentences} documents={documents} />;
  const submitting = run?.status === 'submitting' || !job;
  const queued = !!progress?.queued;
  const sourceLanguage = live.source ? documents[live.source]?.language : null;
  const from = sourceLanguage ? langName(sourceLanguage) : C.source;
  const to = live.target ? languageName(live.target) : C.unnamed;
  const heading = submitting ? C.submitting : queued ? C.queued : C.running(from, to);
  const pct = submitting || queued || !progress ? null : progress.percent;
  const steps = job?.pipeline?.steps ?? [];
  const current = steps.findIndex((s) => s.status === 'running');
  return (
    <div className={head} role="status" aria-live="polite">
      <div className={titleRow}>
        <span className={dot({ isQueued: queued })} aria-hidden />
        <span className={title}>{heading}</span>
        {pct === null ? null : <span className={`${percent} cc-tabular`}>{pct}%</span>}
      </div>
      <ProgressBar size="S" aria-label={heading} isIndeterminate={pct === null} {...(pct === null ? {} : { value: pct })} styles={bar} />
      {progress?.units || progress?.step ? (
        <div className={meta}>
          {progress.units ? <span className="cc-tabular">{C.stepUnits(progress.units.done, progress.units.total)}</span> : null}
          {progress.units && progress.step ? <span className={sep}>·</span> : null}
          {progress.step ? <span>{progress.step}</span> : null}
        </div>
      ) : null}
      {steps.length ? (
        <div className={ladder}>
          {steps.map((s, index) => {
            const isDone = s.status === 'completed' || s.status === 'skipped';
            const isCurrent = index === current;
            const isBad = s.status === 'failed' || s.status === 'interrupted';
            return (
              <div key={s.name} className={step}>
                <span className={stepBar({ isDone, isCurrent, isBad })} />
                <span className={stepLabel({ isDone, isCurrent, isBad })}>{pipelineStepLabel(s)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className={actions}>
        {job && isJobLive(job) ? (
          <Button size="S" variant="secondary" onPress={() => void cancelTranslate(job.jobId)}>
            {C.cancel}
          </Button>
        ) : null}
        <span className={note}>{run ? C.liveNote : C.foreign}</span>
      </div>
    </div>
  );
}

/**
 * Running-state header for agent self-translation (prototype `SelfRunHead`): source → target, indeterminate progress bar, total sentence count and method, and which session is translating.
 * No cancel: cancelling this record cannot stop the agent, since the translation is being written by that run. To stop it, stop that session, so a link to the session is given (while the session is still in the directory).
 */
function AgentRunHead({ live, job, sentences, documents }: { live: TranslateLive; job: JobRecord; sentences: number; documents: Record<Id, DocumentRecord> }) {
  const open = useOpenConversation({ conversationId: job.submitter.kind === 'agent' ? job.submitter.id : null });
  const sourceLanguage = live.source ? documents[live.source]?.language : null;
  const heading = C.running(sourceLanguage ? langName(sourceLanguage) : C.source, live.target ? languageName(live.target) : C.unnamed);
  return (
    <div className={head} role="status" aria-live="polite">
      <div className={titleRow}>
        <span className={dot({ isQueued: false })} aria-hidden />
        <span className={title}>{heading}</span>
      </div>
      <ProgressBar size="S" aria-label={heading} isIndeterminate styles={bar} />
      <div className={meta}>
        {sentences ? <span className="cc-tabular">{VIDEO_CARD_COPY.sentenceTotal(sentences)}</span> : null}
        {sentences ? <span className={sep}>·</span> : null}
        <span>{C.agentNote}</span>
      </div>
      <div className={actions}>
        <span className={note}>{C.agentSession}</span>
        {open ? (
          <Button size="S" variant="secondary" onPress={open}>
            {TASK_VIEW_COPY.openConversation}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const VARIANT = { 'not-configured': 'notice', failed: 'negative', empty: 'informative', pending: 'informative', decide: 'notice' } as const;

/** Translation failed: the reason, and where to go to fix it. Where a retry is possible, offer “Retry” and state clearly whether it will be billed again. */
export function TranslateProblemAlert({ videoId, problem }: { videoId: Id; problem: TranslateProblem }) {
  const go = useShell((s) => s.go);
  const busy = useTranslateRun((s) => !!s.runs[videoId]);
  return (
    <div className={alertBox}>
      <InlineAlert variant={VARIANT[problem.kind]}>
        <Heading>{problem.title}</Heading>
        <Content>
          {problem.message ? <div>{problem.message}</div> : null}
          {problem.retry?.note ? <div className={alertNote}>{problem.retry.note === 'charges' ? C.retryCharges : C.retryFree}</div> : null}
          <div className={alertActions}>
            {problem.retry ? (
              <Button size="S" variant="secondary" isDisabled={busy} onPress={() => void retryTranslate(videoId)}>
                {C.retry}
              </Button>
            ) : null}
            {problem.remedy ? (
              <Button size="S" variant="secondary" onPress={() => go(problem.remedy!.target)}>
                {problem.remedy.label}
              </Button>
            ) : null}
            <Button size="S" variant="secondary" fillStyle="outline" onPress={() => dismissTranslateProblem(videoId)}>
              {C.dismiss}
            </Button>
          </div>
        </Content>
      </InlineAlert>
    </div>
  );
}

/** Receipt (prototype `DoneView`): after the translation is put on screen, leave an “Undo” exit. After undoing, honestly state that the original text was not changed and the translation remains. */
export function TranslateReceiptCard({ videoId, receipt }: { videoId: Id; receipt: TranslateReceipt }) {
  return (
    <div className={alertBox}>
      <InlineAlert variant={receipt.undone ? 'neutral' : 'positive'}>
        <Heading>{receipt.undone ? C.undone(receipt.language) : C.applied(receipt.language, receipt.count)}</Heading>
        <Content>
          <div>{receipt.undone ? C.undoneNote : C.appliedNote(receipt.bilingual)}</div>
          <div className={alertActions}>
            {receipt.undone || !receipt.transactionId ? null : (
              <Button size="S" variant="secondary" onPress={() => void undoReceipt(videoId)}>
                {C.undo}
              </Button>
            )}
            <Button size="S" variant="secondary" fillStyle="outline" onPress={() => dismissReceipt(videoId)}>
              {C.done}
            </Button>
          </div>
        </Content>
      </InlineAlert>
    </div>
  );
}

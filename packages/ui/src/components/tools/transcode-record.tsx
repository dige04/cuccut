import type { JobRecord } from '@cuccut/protocol';
import {
  ActionButton,
  ActionMenu,
  Button,
  Disclosure,
  DisclosurePanel,
  DisclosureTitle,
  MenuItem,
  ProgressBar,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import Copy from '@react-spectrum/s2/icons/Copy';
import Delete from '@react-spectrum/s2/icons/Delete';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import FolderOpen from '@react-spectrum/s2/icons/FolderOpen';
import Layers from '@react-spectrum/s2/icons/Layers';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { aheadOf, didNotFinish, failureText, queuedDetail, recordStatus, stateLabel } from '../../model/tools-records.ts';
import {
  againTranscodeDraft,
  BLANK_COMPRESS,
  BLANK_EXTRACT,
  BLANK_MERGE,
  commandText,
  elapsedText,
  failureDetail,
  failureRemedy,
  mergeModeLine,
  retryParams,
  TRANSCODE_PIPELINE,
  transcodeAction,
  transcodeMeta,
  transcodeProgress,
  transcodeResults,
  transcodeStateWord,
  transcodeTitle,
  type TranscodeResultRow,
} from '../../model/tools-transcode.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useShell } from '../../state/shell-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { detail, detailGrow, RecordCard, recordHead, recordIcon, recordRow, recordText, recordTitle } from './tool-parts.tsx';
import { ToolOutputRow, useJobOutputs } from './tool-outputs.tsx';
import { RECORD_COPY, TRANSCODE_COPY } from './tools-copy.ts';
import { copyText, useCancelJob, useRecordRetry } from './use-tool-records.ts';

/*
 * Design mockup tool-video.jsx `JobCard`: a running job shows progress and a cancel button; a finished job lists its output file (spec, size before and after, “show in folder”), and says in one line whether the merge used stream copy or re-encoding, and why; a failed job gives the reason, the fix, and the raw ffmpeg output; a cancelled job can be queued again.
 * Local ffmpeg is not billed, and a cancelled job still keeps a card, as in the mockup.
 */

const progress = style({ width: 'full' });
const errorTitle = style({ margin: 0, font: 'ui-sm', fontWeight: 'bold', color: 'orange-1000', overflowWrap: 'anywhere' });
const outputs = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });
const output = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingY: 8,
  paddingX: 8,
  borderRadius: 'default',
  backgroundColor: 'gray-25',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  minWidth: 0,
});
const outputText = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const outputName = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' });
const truncate = style({ font: 'ui-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });
/** Status word and time on the right of the card header: no wrapping, the title yields. */
const stamp = style({ font: 'ui-xs', color: 'gray-600', flexShrink: 0, whiteSpace: 'nowrap' });
const modeLine = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  font: 'ui-xs',
  color: { default: 'gray-800', isCopy: 'positive-900' },
  minWidth: 0,
  overflowWrap: 'anywhere',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const modeIcon = style({ display: 'flex', flexShrink: 0 });
const raw = style({
  margin: 0,
  font: 'code-xs',
  color: 'gray-800',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  maxHeight: 160,
  overflow: 'auto',
  userSelect: 'text',
});

const ACTION_ICON = { compress: <Filmstrip />, merge: <Layers />, 'extract-audio': <AudioWave /> } as const;
/** The tool and draft this record belongs to (“bring back to the left and make another version”). */
const ACTION_TOOL = { compress: 'compress-video', merge: 'merge-video', 'extract-audio': 'extract-audio' } as const;

function ActionIcon({ job }: { job: JobRecord }) {
  return <span className={recordIcon} aria-hidden>{ACTION_ICON[transcodeAction(job)]}</span>;
}

/** Submits a new job with the frozen parameters (“retry” for failed jobs, “re-queue” for cancelled ones). */
function useTranscodeRetry(job: JobRecord, copy: { submitted: string }) {
  const runtime = useRuntime();
  return useRecordRetry(
    job,
    'pipeline',
    (j) => {
      const params = retryParams(j);
      return params ? runtime.startPipeline(TRANSCODE_PIPELINE, params as unknown as Record<string, unknown>) : null;
    },
    { submitted: copy.submitted, failed: TRANSCODE_COPY.submitFailed },
  );
}

/** One compress or merge record in the right column. */
export function TranscodeRecord({ job, all, now }: { job: JobRecord; all: readonly JobRecord[]; now: number }) {
  if (job.state === 'cancelled') return <CancelledCard job={job} />;
  const status = recordStatus(job);
  if (status === 'queued' || status === 'running') return <RunningCard job={job} all={all} />;
  if (didNotFinish(job)) return <ErrorCard job={job} />;
  return <DoneCard job={job} now={now} />;
}

function RunningCard({ job, all }: { job: JobRecord; all: readonly JobRecord[] }) {
  const cancel = useCancelJob();
  const title = transcodeTitle(job);
  const queued = job.state === 'queued';
  const line = queued ? { text: queuedDetail(job) ?? RECORD_COPY.ahead(aheadOf(all, job)), percent: null } : transcodeProgress(job, all);
  const merge = mergeModeLine(job);
  return (
    <RecordCard running={!queued} label={title}>
      <div className={recordHead}>
        <ActionIcon job={job} />
        <p className={recordTitle} title={title}>
          {title}
        </p>
        <span className={stamp}>{transcodeStateWord(job)}</span>
        <ActionButton isQuiet size="S" onPress={() => cancel(job.jobId)}>
          <Text>{RECORD_COPY.cancel}</Text>
        </ActionButton>
      </div>
      <span className={truncate} title={transcodeMeta(job)}>
        {transcodeMeta(job)}
      </span>
      {queued ? null : <ProgressBar size="S" styles={progress} aria-label={line.text} isIndeterminate={line.percent === null} value={line.percent ?? undefined} />}
      <span className={detail} role="status">
        {line.text}
      </span>
      {merge ? <span className={detail}>{merge.text}</span> : null}
    </RecordCard>
  );
}

function ErrorCard({ job }: { job: JobRecord }) {
  const go = useShell((s) => s.go);
  const hide = useTools((s) => s.hide);
  const again = useTranscodeRetry(job, { submitted: TRANSCODE_COPY.retried });
  const title = transcodeTitle(job);
  // Results of unknown state must be reconciled first (decide to retry or give up in the job details); here there is no retry and it cannot be hidden.
  if (job.state === 'needs-reconciliation') {
    return (
      <RecordCard failed label={title}>
        <p className={errorTitle}>{failureText(job)}</p>
        <p className={recordText({ isOff: true })}>{title}</p>
        <span className={detail}>{RECORD_COPY.reconcileNote}</span>
        <div className={recordRow}>
          <Button variant="secondary" size="S" onPress={() => go({ tab: 'tasks', taskId: job.jobId })}>
            <OpenIn />
            <Text>{RECORD_COPY.reconcile}</Text>
          </Button>
        </div>
      </RecordCard>
    );
  }
  const remedy = failureRemedy(job);
  const rawText = failureDetail(job);
  return (
    <RecordCard failed label={title}>
      <div className={recordHead}>
        <ActionIcon job={job} />
        <p className={recordTitle} title={title}>
          {title}
        </p>
      </div>
      <span className={truncate} title={transcodeMeta(job)}>
        {transcodeMeta(job)}
      </span>
      <p className={errorTitle}>{TRANSCODE_COPY.failed(failureText(job))}</p>
      {remedy ? <span className={detail}>{remedy}</span> : null}
      {rawText ? (
        <Disclosure isQuiet size="S">
          <DisclosureTitle>{TRANSCODE_COPY.raw}</DisclosureTitle>
          <DisclosurePanel>
            <pre className={raw}>{rawText}</pre>
          </DisclosurePanel>
        </Disclosure>
      ) : null}
      <div className={recordRow}>
        {again.done ? (
          <span className={detail}>{TRANSCODE_COPY.retried}</span>
        ) : (
          <Button variant="secondary" size="S" isPending={again.pending} onPress={again.retry}>
            <Refresh />
            <Text>{TRANSCODE_COPY.retry}</Text>
          </Button>
        )}
        <ActionButton isQuiet size="S" onPress={() => go({ tab: 'tasks', taskId: job.jobId })}>
          <OpenIn />
          <Text>{RECORD_COPY.task}</Text>
        </ActionButton>
        <ActionButton isQuiet size="S" onPress={() => hide(job.jobId)}>
          <Delete />
          <Text>{TRANSCODE_COPY.drop}</Text>
        </ActionButton>
      </div>
    </RecordCard>
  );
}

/** A cancelled record: local ffmpeg is not billed and there is no output file; it can be re-queued with the same settings, or hidden. */
function CancelledCard({ job }: { job: JobRecord }) {
  const hide = useTools((s) => s.hide);
  const again = useTranscodeRetry(job, { submitted: TRANSCODE_COPY.retried });
  const title = transcodeTitle(job);
  return (
    <RecordCard label={title}>
      <div className={recordHead}>
        <ActionIcon job={job} />
        <p className={recordTitle} title={title}>
          {title}
        </p>
      </div>
      <span className={truncate} title={transcodeMeta(job)}>
        {transcodeMeta(job)}
      </span>
      <span className={detail}>{TRANSCODE_COPY.cancelledLine}</span>
      <div className={recordRow}>
        {again.done ? (
          <span className={detail}>{TRANSCODE_COPY.retried}</span>
        ) : (
          <Button variant="secondary" size="S" isPending={again.pending} onPress={again.retry}>
            <Refresh />
            <Text>{TRANSCODE_COPY.requeue}</Text>
          </Button>
        )}
        <ActionButton isQuiet size="S" onPress={() => hide(job.jobId)}>
          <Delete />
          <Text>{TRANSCODE_COPY.drop}</Text>
        </ActionButton>
      </div>
    </RecordCard>
  );
}

function DoneCard({ job, now }: { job: JobRecord; now: number }) {
  const go = useShell((s) => s.go);
  const hide = useTools((s) => s.hide);
  const patchCompress = useTools((s) => s.patchCompress);
  const patchMerge = useTools((s) => s.patchMerge);
  const patchExtract = useTools((s) => s.patchExtract);
  const title = transcodeTitle(job);
  const results = transcodeResults(job);
  const entries = useJobOutputs([job.jobId]);
  const merge = mergeModeLine(job);
  const elapsed = elapsedText(job);
  const command = commandText(job);
  const again = () => {
    const action = transcodeAction(job);
    const draft = againTranscodeDraft(job, action === 'merge' ? BLANK_MERGE : action === 'extract-audio' ? BLANK_EXTRACT : BLANK_COMPRESS);
    if (!draft) return;
    (action === 'merge' ? patchMerge : action === 'extract-audio' ? patchExtract : patchCompress)(draft);
    go({ tab: 'tools', tool: ACTION_TOOL[action] });
    ToastQueue.neutral(TRANSCODE_COPY.againDone, { timeout: 3000 });
  };
  const act = (key: string) => {
    if (key === 'again') again();
    else if (key === 'command' && command) copyText(command);
    else if (key === 'task') go({ tab: 'tasks', taskId: job.jobId });
    else if (key === 'remove') {
      hide(job.jobId);
      ToastQueue.neutral(RECORD_COPY.removed(title), { timeout: 4000 });
    }
  };
  return (
    <RecordCard label={title}>
      <div className={recordHead}>
        <ActionIcon job={job} />
        <p className={recordTitle} title={title}>
          {title}
        </p>
        <span className={stamp}>{stateLabel(job, now)}</span>
        <ActionMenu aria-label={RECORD_COPY.more} isQuiet size="S" onAction={(key) => act(String(key))}>
          <MenuItem id="again" textValue={TRANSCODE_COPY.again}>
            <Refresh />
            <Text slot="label">{TRANSCODE_COPY.again}</Text>
          </MenuItem>
          {command ? (
            <MenuItem id="command" textValue={TRANSCODE_COPY.copyCommand}>
              <Copy />
              <Text slot="label">{TRANSCODE_COPY.copyCommand}</Text>
              <Text slot="description">{TRANSCODE_COPY.commandNote}</Text>
            </MenuItem>
          ) : null}
          <MenuItem id="task" textValue={RECORD_COPY.task}>
            <OpenIn />
            <Text slot="label">{RECORD_COPY.task}</Text>
          </MenuItem>
          <MenuItem id="remove" textValue={RECORD_COPY.remove}>
            <Delete />
            <Text slot="label">{RECORD_COPY.remove}</Text>
            <Text slot="description">{RECORD_COPY.removeNote}</Text>
          </MenuItem>
        </ActionMenu>
      </div>
      <span className={truncate} title={transcodeMeta(job)}>
        {transcodeMeta(job)}
      </span>
      {/* Once the outputs are in Space, use the output row (view in Space, hand to Agent, create a video from it); before they are in Space, list the files from the job result. */}
      {entries.length ? (
        <div className={outputs}>
          {entries.map((e) => (
            <ToolOutputRow key={e.id} entry={e} fromTool={ACTION_TOOL[transcodeAction(job)]} compact />
          ))}
        </div>
      ) : results.length ? (
        <div className={outputs}>
          {results.map((r) => (
            <OutputRow key={r.path} result={r} />
          ))}
        </div>
      ) : (
        <span className={detail}>{TRANSCODE_COPY.noOutput}</span>
      )}
      {merge ? (
        <span className={modeLine({ isCopy: merge.mode === 'stream-copy' })}>
          <span className={modeIcon} aria-hidden>
            {merge.mode === 'stream-copy' ? <CheckmarkCircle /> : <Refresh />}
          </span>
          <span>{merge.text}</span>
        </span>
      ) : null}
      {elapsed ? <span className={detailGrow}>{elapsed}</span> : null}
    </RecordCard>
  );
}

function OutputRow({ result }: { result: TranscodeResultRow }) {
  const runtime = useRuntime();
  const reveal = () => {
    runtime.host.revealPath(result.path).catch((e: Error) => ToastQueue.negative(TRANSCODE_COPY.revealFailed(e.message), { timeout: 6000 }));
  };
  return (
    <div className={output}>
      <span className={outputText}>
        <span className={outputName} title={result.path}>
          {result.name}
        </span>
        {result.meta ? <span className={truncate}>{result.meta}</span> : null}
        <span className={truncate}>{result.size}</span>
      </span>
      <Button variant="secondary" size="S" onPress={reveal}>
        <FolderOpen />
        <Text>{TRANSCODE_COPY.reveal}</Text>
      </Button>
    </div>
  );
}

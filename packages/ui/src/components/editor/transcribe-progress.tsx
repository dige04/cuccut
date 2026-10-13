import type { Id, JobPhase, JobRecord } from '@cuccut/protocol';
import { Button, Content, Heading, InlineAlert, ProgressBar } from '@react-spectrum/s2';
import Microphone from '@react-spectrum/s2/icons/Microphone';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { JOB_PHASE_LABEL } from '../../copy.ts';
import { formatClock } from '../../model/format.ts';
import { jobPercent } from '../../model/task-list.ts';
import { useShell } from '../../state/shell-store.ts';
import { SUBTITLE_COPY as C } from './subtitle-copy.ts';
import { cancelTranscribe, dismissProblem, type TranscribeProblem, type TranscribeRun } from './transcribe-run.ts';

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
const titleIcon = style({ display: 'flex', flexShrink: 0, '--iconPrimary': { type: 'fill', value: 'blue-900' } });
const title = style({ flexGrow: 1, minWidth: 0, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const percent = style({ flexShrink: 0, font: 'ui-sm', color: 'gray-700' });
const bar = style({ width: 'full', marginTop: 8 });
const meta = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '[6px]', marginTop: '[6px]', font: 'ui-xs', color: 'gray-600' });
const dot = style({ color: 'gray-400' });
const ladder = style({ display: 'flex', gap: 8, marginTop: '[10px]' });
const step = style({ flexGrow: 1, flexBasis: 0, minWidth: 0 });
const stepBar = style({
  display: 'block',
  height: 4,
  borderRadius: 'full',
  backgroundColor: { default: 'gray-300', isDone: 'green-900', isCurrent: 'blue-900' },
});
const stepLabel = style({
  display: 'block',
  marginTop: 4,
  fontSize: '[10px]',
  color: { default: 'gray-500', isDone: 'green-1000', isCurrent: 'blue-1000' },
  fontWeight: { default: 'normal', isCurrent: 'bold' },
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const actions = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 });
const note = style({ flexGrow: 1, minWidth: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const alertBox = style({ flexShrink: 0, paddingX: 12, paddingTop: 12 });
const alertActions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 });

/**
 * Task stage → four-step ladder (prototype model-transcript.js `LIVE_STAGES`: decode audio / recognize / word-level alignment / write to disk). It follows the real stages reported by the Runtime rather than guessing from the percentage. The stages of a generation task aren't used here, but they get a landing spot too.
 */
const STAGE_OF: Record<JobPhase, number> = {
  queued: 0,
  starting: 0,
  loading: 0,
  probing: 0,
  downloading: 0,
  moving: 0,
  decoding: 0,
  vad: 0,
  transcribing: 1,
  generating: 1,
  aligning: 2,
  diarizing: 2,
  validating: 3,
  finalizing: 3,
  encoding: 3,
  publishing: 3,
  applying: 3,
  done: 3,
};

/**
 * Header of a running transcription (prototype panel-shared.jsx `LiveHead`): title, percentage, progress bar, counter, four-step ladder, and cancel. `job` is the one whose progress is drawn (in the transcription flow, its transcribe step). `cancelJobId` is the one that gets cancelled (the flow's parent task); when not given, `job` is cancelled. `note` replaces the sentence next to the cancel button (the transcript panel's live state says that recognized parts appear paragraph by paragraph).
 */
export function TranscribeProgress({
  run,
  job,
  cancelJobId = null,
  assetName,
  note: noteText,
  heading: headingText,
}: {
  run: TranscribeRun | null;
  job: JobRecord | null;
  cancelJobId?: Id | null;
  assetName: string | null;
  note?: string;
  /** Replaces the title at the “Generate subtitles” level (live transcript: once recognition is done and the result is still being written into the video, a subtitle doesn't necessarily need to be created). */
  heading?: string;
}) {
  const writing = run?.status === 'writing';
  const submitting = run?.status === 'submitting' || (run?.status === 'running' && !job);
  const live = !writing && !submitting && job ? job : null;
  // When the total is unknown, no percentage is made (`progress.total` is null).
  const pct = live ? jobPercent(live) : null;
  const stage = writing ? 3 : live ? STAGE_OF[live.phase] : 0;
  const heading = writing ? (headingText ?? C.writing) : submitting ? C.submitting : C.liveTitle;
  const progress = live?.progress ?? null;
  const count =
    progress?.unit === 'seconds'
      ? C.transcribed(formatClock(progress.done), progress.total == null ? null : formatClock(progress.total))
      : progress?.unit === 'segments'
        ? C.segments(progress.done, progress.total)
        : null;
  const phase = writing ? null : live ? JOB_PHASE_LABEL[live.phase] : null;
  return (
    <div className={head} role="status" aria-live="polite">
      <div className={titleRow}>
        <span className={titleIcon}>
          <Microphone />
        </span>
        <span className={title}>{assetName ? `${heading} · ${assetName}` : heading}</span>
        {pct === null ? null : <span className={`${percent} cc-tabular`}>{pct}%</span>}
      </div>
      <ProgressBar
        size="S"
        aria-label={heading}
        isIndeterminate={pct === null}
        {...(pct === null ? {} : { value: pct })}
        styles={bar}
      />
      {count || phase ? (
        <div className={meta}>
          {count ? <span className="cc-tabular">{count}</span> : null}
          {count && phase ? <span className={dot}>·</span> : null}
          {phase ? <span>{phase}</span> : null}
        </div>
      ) : null}
      <div className={ladder}>
        {C.stages.map((label, index) => (
          <div key={label} className={step}>
            <span className={stepBar({ isDone: index < stage, isCurrent: index === stage })} />
            <span className={stepLabel({ isDone: index < stage, isCurrent: index === stage })}>{label}</span>
          </div>
        ))}
      </div>
      <div className={actions}>
        {live ? (
          <Button size="S" variant="secondary" onPress={() => void cancelTranscribe(cancelJobId ?? live.jobId)}>
            {C.cancel}
          </Button>
        ) : null}
        <span className={note}>{noteText ?? (run ? C.liveNote : C.foreignNote)}</span>
      </div>
    </div>
  );
}

const VARIANT = { 'not-configured': 'notice', failed: 'negative', empty: 'informative', pending: 'informative', decide: 'notice' } as const;

/**
 * Transcription failed. Missing configuration gives the reason, `remedy.hint`, and where to go. Failures, no speech, and no audio track are stated plainly. Cases that need the user to make a decision point to the background task.
 * `onDismiss` defaults to dismissing this issue; null means it can't be dismissed (a task started elsewhere, waiting to be handled).
 */
export function TranscribeProblemAlert({
  videoId,
  problem,
  onDismiss,
}: {
  videoId: Id;
  problem: TranscribeProblem;
  onDismiss?: (() => void) | null;
}) {
  const go = useShell((s) => s.go);
  return (
    <div className={alertBox}>
      <InlineAlert variant={VARIANT[problem.kind]}>
        <Heading>{problem.title}</Heading>
        <Content>
          {problem.message ? <div>{problem.message}</div> : null}
          <div className={alertActions}>
            {problem.remedy ? (
              <Button size="S" variant="secondary" onPress={() => go(problem.remedy!.target)}>
                {problem.remedy.label}
              </Button>
            ) : null}
            {onDismiss === null ? null : (
              <Button size="S" variant="secondary" fillStyle="outline" onPress={onDismiss ?? (() => dismissProblem(videoId))}>
                {C.dismiss}
              </Button>
            )}
          </div>
        </Content>
      </InlineAlert>
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { MusicModelInfo } from '@cuccut/protocol';
import { ActionButton, Button, ProgressBar, Text, ToggleButton } from '@react-spectrum/s2';
import PlayIcon from '@react-spectrum/s2/icons/Play';
import RefreshIcon from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { TRY_SUBJECT_MUSIC } from '../../model/model-check-copy.ts';
import { noticeAfterTry, tryFailureKind, tryFailureView, type TryAction, type TryFailureInput, type TryNoteView } from '../../model/model-check.ts';
import { probeFromJob } from '../../model/models-probe.ts';
import {
  etaText,
  modeDesc,
  modeLabel,
  modesOf,
  MUSIC_STYLES,
  QUICK,
  QUICK_DEFAULTS,
  quickKey,
  quickRequest,
  quickSteps,
  quickSummary,
  styleLabel,
  type MusicQuickPick,
} from '../../model/tools-music.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useMusicQuick, type MusicQuickDraft } from '../../state/music-quick-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useArtifactUrl, useCancelJob, useDownloadArtifact } from '../tools/use-tool-records.ts';
import { ModelTryNote } from './model-check-line.tsx';
import { MUSIC_LOCAL_COPY as COPY } from './music-local-copy.ts';

/* The same panel as the speech synthesis trial (tts-quick-test.tsx; design mock settings-local.css `.ttst`). */
const panel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  marginTop: 12,
  marginStart: { default: 0, sm: 32 },
  padding: 16,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-25',
  minWidth: 0,
});
const row = style({ display: 'flex', alignItems: 'start', gap: 8, minWidth: 0 });
const lab = style({ flexShrink: 0, width: 48, paddingTop: 4, font: 'ui-sm', color: 'gray-700' });
const chips = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexGrow: 1, minWidth: 0 });
const note = style({ margin: 0, marginStart: 56, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const detail = style({ margin: 0, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const grow = style({ flexGrow: 1, flexBasis: 0, minWidth: 160 });
const go = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 4 });
const busyBox = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, flexBasis: 0, minWidth: 160 });
const problem = style({ margin: 0, font: 'ui-xs', color: 'negative-900', overflowWrap: 'anywhere', userSelect: 'text' });
const failNote = style({ marginStart: { default: 0, sm: 56 }, minWidth: 0 });
const out = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 12,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const outHead = style({ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' });
const player = style({ width: 'full', height: 36, opacity: { default: 1, isStale: 0.6 } });

const FRESH: MusicQuickDraft = { pick: QUICK_DEFAULTS, run: null, last: null };

export interface MusicQuickTestProps {
  bundleId: string;
  name: string;
  model: MusicModelInfo;
  /** Reminder at the top of the panel when the last check did not pass (model/model-check.ts `tryNotice`). */
  notice?: TryNoteView | null;
  canCheck?: boolean;
  onCheck?: (k: 'repair' | 'recheck' | 'check') => void;
}

/**
 * The “Trial listen” on a music generation row (design mock settings-music.jsx `MusicQuickTest`): only style and form are picked, fixed at 10 seconds, with fewer steps and no arrangement. Submitting sends one real `models.generateMusic` (`provider: 'local'`, `model` is the model package ID). What is tested is whether “this model plus its engine” can produce sound, not a piece of work. Progress and results are read from the `jobs` topic. The selection and the latest result are kept per model (state/music-quick-store.ts).
 * Failures and the “last check did not pass” reminder use the check wording (`TRY_SUBJECT_MUSIC`), and no toast is shown.
 */
export function MusicQuickTest({ bundleId, name, model, notice = null, canCheck = false, onCheck }: MusicQuickTestProps) {
  const runtime = useRuntime();
  const saved = useMusicQuick((s) => s.drafts[bundleId]);
  const draft = saved ?? FRESH;
  const setDraft = useMusicQuick((s) => s.setDraft);
  const jobs = useJobs((s) => s.jobs);
  const goTo = useShell((s) => s.go);
  const cancelJob = useCancelJob();
  const download = useDownloadArtifact();
  const [submitting, setSubmitting] = useState(false);
  const [issue, setIssue] = useState<Omit<TryFailureInput, 'canCheck'> | null>(null);

  const { pick, run, last } = draft;
  const key = quickKey(pick, bundleId);
  const steps = quickSteps(model);
  const modes = useMemo(() => modesOf(model), [model]);

  const runJob = run ? jobs.find((j) => j.jobId === run.jobId) : undefined;
  const runState = run ? probeFromJob(run.jobId, runJob) : null;
  const busy = submitting || runState?.status === 'running';
  const shown = runState?.status === 'done' ? run : last;
  const shownJob = shown ? jobs.find((j) => j.jobId === shown.jobId) : undefined;
  const shownState = shown ? (shown === run ? runState : probeFromJob(shown.jobId, shownJob)) : null;
  const result = shown && shownState?.status === 'done' && shownState.output ? { run: shown, state: shownState, output: shownState.output } : null;
  const stale = !!result && result.run.key !== key;
  const shownNotice = noticeAfterTry(notice, shownJob?.endedAt ?? shownJob?.updatedAt);
  const jobFailed = runState?.status === 'failed' && runJob?.state !== 'cancelled' && run?.key === key;
  const failure: Omit<TryFailureInput, 'canCheck'> | null =
    issue ?? (jobFailed && run ? { kind: tryFailureKind(runJob?.error?.code ?? null, runJob?.error?.details), message: runState.message } : null);
  const failureView = failure && !busy ? tryFailureView({ ...failure, canCheck: canCheck && !!onCheck, subject: TRY_SUBJECT_MUSIC }) : null;

  const update = (next: MusicQuickPick) => {
    if (busy) return;
    setIssue(null);
    setDraft(bundleId, { ...draft, pick: next });
  };

  const submit = async () => {
    if (busy) return;
    setIssue(null);
    setSubmitting(true);
    try {
      const jobId = await runtime.generateMusic(quickRequest(pick, bundleId, model));
      const keep = run && runState?.status === 'done' ? run : last;
      setDraft(bundleId, { pick, run: { jobId, key, pick }, last: keep });
    } catch (error) {
      const details = (error as { details?: unknown } | null)?.details;
      const code = (details as { code?: unknown } | undefined)?.code;
      setIssue({ kind: tryFailureKind(typeof code === 'string' ? code : null, details), message: (error as Error).message, notStarted: true });
    } finally {
      setSubmitting(false);
    }
  };

  const onNote = (k: TryAction['k']) => {
    if (k === 'retry') void submit();
    else if (k === 'repair' || k === 'recheck' || k === 'check') onCheck?.(k);
  };

  const chip = (id: string, label: string, selected: boolean, onPress: () => void, title?: string) => (
    <ToggleButton key={id} size="S" isSelected={selected} onChange={onPress} aria-description={title}>
      <Text>{label}</Text>
    </ToggleButton>
  );

  return (
    <div className={panel} role="group" aria-label={`${COPY.generate} · ${name}`}>
      <ModelTryNote view={shownNotice} onAction={onNote} />
      <div className={row}>
        <span className={lab}>{COPY.style}</span>
        <div className={chips}>
          {MUSIC_STYLES.map((s) => chip(s.key, styleLabel(s.key), pick.style === s.key, () => update({ ...pick, style: s.key }), s.style))}
        </div>
      </div>
      {modes.length > 1 ? (
        <div className={row}>
          <span className={lab}>{COPY.mode}</span>
          <div className={chips}>{modes.map((m) => chip(m, modeLabel(m), pick.mode === m, () => update({ ...pick, mode: m }), modeDesc(m)))}</div>
        </div>
      ) : null}
      <p className={note}>
        {COPY.note(QUICK.seconds, steps, etaText(QUICK.seconds, { planning: 'off' }))} {pick.mode === 'song' ? `${COPY.songNote} ` : ''}
        {COPY.toolNote}
      </p>

      <div className={go}>
        {busy ? (
          <>
            <div className={busyBox}>
              <span className={detail}>{COPY.busy}</span>
              <ProgressBar
                size="S"
                aria-label={COPY.busy}
                isIndeterminate={!runJob?.progress?.total}
                value={runJob?.progress?.total ? (runJob.progress.done / runJob.progress.total) * 100 : undefined}
              />
            </div>
            {run && runState?.status === 'running' ? (
              <ActionButton size="S" isQuiet onPress={() => cancelJob(run.jobId)}>
                <Text>{COPY.cancel}</Text>
              </ActionButton>
            ) : null}
          </>
        ) : result && !stale ? (
          <Button variant="secondary" size="S" onPress={() => void submit()}>
            <RefreshIcon />
            <Text>{COPY.again}</Text>
          </Button>
        ) : (
          <Button variant="secondary" size="S" onPress={() => void submit()}>
            <PlayIcon />
            <Text>{COPY.generate}</Text>
          </Button>
        )}
        {!busy ? (
          <ActionButton size="S" isQuiet onPress={() => goTo({ tab: 'tools', tool: 'generate-music' })}>
            <Text>{COPY.openTool}</Text>
          </ActionButton>
        ) : null}
      </div>
      {failureView ? (
        <div className={failNote}>
          <ModelTryNote view={failureView} onAction={onNote} />
        </div>
      ) : null}

      {result ? (
        <QuickResult
          artifactId={result.output.artifactId}
          summary={quickSummary(result.run.pick, steps, result.state.status === 'done' ? (result.state.seconds ?? 0) : 0)}
          stale={stale}
          fileName={COPY.fileName(name)}
          onDownload={download}
        />
      ) : null}
    </div>
  );
}

function QuickResult({
  artifactId,
  summary,
  stale,
  fileName,
  onDownload,
}: {
  artifactId: string;
  summary: string;
  stale: boolean;
  fileName: string;
  onDownload: (artifactId: string, fileName: string) => Promise<void>;
}) {
  const media = useArtifactUrl(artifactId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const save = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await onDownload(artifactId, fileName);
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className={out}>
      <div className={outHead}>
        <span className={grow}>
          <span className={detail}>
            {stale ? COPY.stalePrefix : ''}
            {summary}
          </span>
        </span>
        <Button variant="secondary" size="S" isPending={downloading} onPress={() => void save()}>
          {COPY.download}
        </Button>
      </div>
      {media?.status === 'ready' ? (
        <audio className={player({ isStale: stale })} controls preload="metadata" src={media.url} aria-label={COPY.resultLabel} />
      ) : media?.status === 'failed' ? (
        <p className={problem}>{COPY.audioFailed(media.message)}</p>
      ) : (
        <p className={detail}>{COPY.loadingAudio}</p>
      )}
      {stale ? <p className={detail}>{COPY.stale}</p> : null}
      {downloadError ? <p className={problem}>{COPY.downloadFailed(downloadError)}</p> : null}
    </div>
  );
}

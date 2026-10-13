import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { FileTarget, GrantRequestItem, Id, JobRecord, SpaceEntry } from '@cuccut/protocol';
import {
  ActionButton,
  Button,
  Content,
  Heading,
  InlineAlert,
  Picker,
  PickerItem,
  ProgressBar,
  Radio,
  RadioGroup,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { ListBox, ListBoxItem } from 'react-aria-components';
import { linkIssue } from '../../model/link-import.ts';
import { DownloaderCard, useDownloaderTool } from '../start/downloader-card.tsx';
import { inputOptions, toolById, type ToolId, type ToolSourceKind, type VideoToolId } from '../../model/tool-catalog.ts';
import {
  ambiguousAssets,
  fallbackTitle,
  grantLines,
  opensMovie,
  pct,
  phase,
  providerLabels,
  resultLines,
  resultVideoId,
  runInput,
  runOpts,
  runsOf,
  runView,
  stepNote,
  toolOfJob,
  transcriptSwitchOf,
  withAsset,
  type RunMeta,
  type RunStep,
  type RunView,
} from '../../model/tool-runs.ts';
import { CHANGE_COPY } from '../../copy.ts';
import { videoTargetOf } from '../../model/space.ts';
import { outputsDir } from '../../model/tool-outputs.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { sameTarget } from '../../runtime/video-controller.ts';
import { useEditor } from '../../state/editor-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { setAiToolPage } from '../editor/ai-tools-nav.ts';
import { undoInBackground } from '../thread/change-undo.ts';
import { diarizeStepOf } from '../../model/transcribe-speakers.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { EmptyCard } from '../models/model-parts.tsx';
import { TOOL_ICON } from './tool-icon.tsx';
import { ToolOutputs, useJobOutputs } from './tool-outputs.tsx';
import { detail, SideHead, ToolPage, Workbench } from './tool-parts.tsx';
import { GRANT_COPY, LINK_TOOL_COPY, PROJECT_COPY, RECORD_COPY, RETRANSCRIBE_COPY, RUN_COPY, SOURCE_COPY } from './tools-copy.ts';
import { useCancelJob } from './use-tool-records.ts';
import { useRunRetry, useToolStart, useVideoTools } from './use-video-tools.ts';

/*
 * Blocks shared by the video tools (product design §2.7; design file tool-run-view.jsx and tools.css `.tsteps` `.tgrant` `.trun*` `.trec`):
 * step progress, the on-the-spot authorization card, source switching, project selection, the run and result page, this tool's run records, and the page skeleton that puts them together.
 * A run's steps, progress, and the step where a failure stopped are all read from the parent flow job in the `jobs` topic (model/tool-runs.ts).
 */

// ---- Steps ----

const steps = style({ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyleType: 'none' });
const stepRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 32,
  paddingX: 8,
  paddingY: 4,
  borderRadius: 'default',
  font: 'ui',
  color: { default: 'gray-600', isDone: 'gray-800', isRunning: 'gray-900', isFailed: 'red-1000' },
  backgroundColor: { default: 'transparent', isRunning: 'blue-100', isFailed: 'red-100' },
});
const stepMark = style({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: 24,
  height: 24,
  borderRadius: 'full',
  font: 'ui-xs',
  backgroundColor: { default: 'gray-100', isDone: 'green-100', isRunning: 'blue-900', isFailed: 'red-900' },
  color: { default: 'gray-700', isDone: 'green-1000', isRunning: 'gray-25', isFailed: 'gray-25' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const stepLabel = style({ flexGrow: 1, minWidth: 0 });
const stepState = style({ flexShrink: 0, font: 'ui-xs' });

/** Step table: finished steps get a check mark, running steps show a percentage, stopped steps are marked red, and steps not yet reached show only their number. Skipped steps are not listed (model/tool-runs.ts). */
export function ToolSteps({ list }: { list: readonly RunStep[] }) {
  return (
    <ol className={steps} aria-label={RUN_COPY.steps}>
      {list.map((s, i) => {
        const flags = { isDone: s.status === 'done', isRunning: s.status === 'running', isFailed: s.status === 'failed' };
        return (
          <li key={s.name} className={stepRow(flags)}>
            <span className={stepMark(flags)} aria-hidden>
              {s.status === 'done' ? <Checkmark /> : s.status === 'failed' ? <AlertTriangle /> : i + 1}
            </span>
            <span className={stepLabel}>{s.label}</span>
            <span className={stepState}>{stepNote(s)}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---- On-the-spot authorization ----

const grantBox = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const grantList = style({ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, marginBottom: 8, padding: 0, listStyleType: 'none' });
const grantItem = style({ display: 'flex', flexDirection: 'column', gap: 2 });
const grantActions = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });

/**
 * On-the-spot authorization (§2.7, “authorization is completed on the spot”): the pending approval items the Runtime gives when it refuses to start — what will be sent, to whom, and the estimated cost. “Agree and continue”
 * grants authorization item by item, then resubmits with the same submission. `hint`: where to go if the user does not want to send.
 */
export function GrantCard({
  items,
  onAgree,
  busy,
  hint = GRANT_COPY.hintLocal,
}: {
  items: readonly GrantRequestItem[];
  onAgree: () => void;
  busy: boolean;
  hint?: string;
}) {
  const view = useModels((s) => s.capabilities);
  const lines = useMemo(() => grantLines(items, providerLabels(view)), [items, view]);
  return (
    <div className={grantBox} role="group" aria-label={GRANT_COPY.label}>
      <InlineAlert variant="notice">
        <Heading>{GRANT_COPY.title}</Heading>
        <Content>
          <ul className={grantList}>
            {lines.map((l) => (
              <li key={l.key} className={grantItem}>
                <strong>{GRANT_COPY.to(l.recipient)}</strong>
                <span>{GRANT_COPY.what(l.what)}</span>
                <span>{GRANT_COPY.cost(l.cost)}</span>
              </li>
            ))}
          </ul>
          <span className={detail}>{GRANT_COPY.remember}</span>
        </Content>
      </InlineAlert>
      <div className={grantActions}>
        <Button variant="accent" isPending={busy} onPress={onAgree}>
          {GRANT_COPY.agree}
        </Button>
        <span className={detail}>{hint}</span>
      </div>
    </div>
  );
}

// ---- Source and project ----

/** Input source switch: the options come from the inputs declared in the tool catalog (model/tool-catalog.ts). */
export function ToolSourceSwitch<K extends ToolSourceKind>({ tool, value, onChange }: { tool: ToolId; value: K; onChange: (key: K) => void }) {
  const options = inputOptions(tool);
  return (
    <SegmentedControl aria-label={SOURCE_COPY.label} selectedKey={value} onSelectionChange={(key) => onChange(key as K)}>
      {options.map((o) => (
        <SegmentedControlItem key={o.key} id={o.key}>
          {o.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

const field = style({ width: 'full' });

/** The project the new video is placed in. When there is no project, it says to create one first. */
export function ProjectPicker({ value, onChange }: { value: Id | null; onChange: (projectId: Id) => void }) {
  const projects = useDirectory((s) => s.projects);
  if (!projects.length) return <span className={detail}>{PROJECT_COPY.noneBody}</span>;
  return (
    <Picker label={PROJECT_COPY.label} items={projects} selectedKey={value} styles={field} onSelectionChange={(key) => key !== null && onChange(String(key))}>
      {(p) => <PickerItem id={p.id}>{p.name}</PickerItem>}
    </Picker>
  );
}

// ---- Run page ----

/** Entries in the Space that refer to this video (used by “Open in editor” and “Continue”). */
export function entryOfVideo(entries: readonly SpaceEntry[], videoId: Id | null): SpaceEntry | null {
  if (!videoId) return null;
  return entries.find((e) => e.kind === 'video' && e.ref && 'videoId' in e.ref && e.ref.videoId === videoId && !e.user.trashedAt) ?? null;
}

/** The title and local record of one run: the local record is used when present, otherwise it is derived from the frozen parameters. */
export function useRunTitle(job: JobRecord): { title: string; meta: RunMeta | null; entry: SpaceEntry | null } {
  const meta = useVideoTools((s) => s.meta[job.jobId] ?? null);
  const entries = useSpace((s) => s.entries);
  const entry = entryOfVideo(entries, resultVideoId(job));
  const tool = toolOfJob(job);
  const title = meta?.title ?? fallbackTitle(job, (tool && toolById(tool)?.name) || RUN_COPY.run, entry?.name ?? null);
  return { title, meta, entry };
}

const runBox = style({ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 });
const runHead = style({ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, minWidth: 0 });
const runTitle = style({ flexGrow: 1, margin: 0, font: 'title', color: 'gray-900', minWidth: 0, overflowWrap: 'anywhere' });
const runPhase = style({ font: 'ui-sm', color: 'gray-700' });
const resultBox = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  paddingX: 20,
  paddingY: 16,
  borderRadius: '[24px]',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const lines = style({ display: 'flex', flexDirection: 'column', gap: '[6px]', margin: 0, padding: 0, listStyleType: 'none', font: 'ui', color: 'gray-900' });
const line = style({ display: 'flex', alignItems: 'start', gap: 8, overflowWrap: 'anywhere', minWidth: 0 });
const lineIcon = style({ display: 'flex', flexShrink: 0, marginTop: 2, color: 'green-1000', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const buttons = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });

/** The view of one run: when transcription uses “speaker diarization” to tell speakers apart, “Identify speakers” is listed as a separate step (model/transcribe-speakers.ts `diarizeStepOf`). */
export function useRunView(job: JobRecord): RunView | null {
  const jobs = useJobs((s) => s.jobs);
  const view = useModels((s) => s.capabilities);
  return runView(job, jobs, { diarizeStep: diarizeStepOf(job, jobs, view) });
}

/** Run and result page: progress, steps, and on failure a retry from that step; after completion, “Open in editor” and the tools that can continue the work. */
export function ToolRunView({ job, tool, onBack }: { job: JobRecord; tool: VideoToolId; onBack: () => void }) {
  const go = useShell((s) => s.go);
  const outputs = useJobOutputs([job.jobId]);
  const cancel = useCancelJob();
  const retry = useRunRetry(job.jobId);
  const { title, meta, entry } = useRunTitle(job);
  const downloader = useDownloaderTool(job.pipeline?.name === 'link-import');
  const downloadIssue = job.pipeline?.name === 'link-import' && job.error ? linkIssue(job.error) : null;
  const run = useRunView(job);
  if (!run) return null;
  const done = run.status === 'done';
  const stopped = run.status === 'failed' || run.status === 'cancelled';
  const input = meta?.input ?? runInput(job);
  const opts = meta?.target ? { target: meta.target, transcribe: meta.transcribe } : runOpts(job);
  const ownTool = (toolOfJob(job) ?? tool) as VideoToolId;
  const intoMovie = opensMovie(ownTool, input, opts);
  // A video transcribed together with its download gets next steps based on the transcription (translate subtitles, translate and dub).
  const fromTool = ownTool === 'link-import' && opts.transcribe ? 'transcribe' : ownTool;
  const assets = ambiguousAssets(job);
  const keepsVideo = run.steps.some((s) => s.name === 'create' && s.status === 'done');

  return (
    <section className={runBox} aria-label={title}>
      <div className={runHead}>
        <h2 className={runTitle}>{title}</h2>
        <span className={runPhase}>
          {phase(run)}
          {run.attempt > 1 ? RUN_COPY.attempt(run.attempt) : ''}
        </span>
      </div>
      <ProgressBar aria-label={RUN_COPY.progress(title)} size="S" value={pct(run)} isIndeterminate={run.status === 'queued'} />
      <ToolSteps list={run.steps} />
      {!done && !stopped ? (
        <div className={buttons}>
          <span className={detail}>{RUN_COPY.background}</span>
          <Button variant="secondary" size="S" onPress={() => cancel(job.jobId)}>
            {RUN_COPY.cancel}
          </Button>
        </div>
      ) : null}
      {stopped && assets ? <AmbiguousAssets job={job} ids={assets} title={title} /> : null}
      {stopped && !assets ? (
        <>
          <InlineAlert variant={run.status === 'failed' ? 'negative' : 'neutral'}>
            <Heading>{phase(run)}</Heading>
            <Content>{run.status === 'failed' ? RUN_COPY.failedBody(run.error ?? RUN_COPY.unknown, keepsVideo) : RUN_COPY.cancelledBody}</Content>
          </InlineAlert>
          {downloadIssue ? <>
            <InlineAlert variant="notice"><Heading>{downloadIssue.title}</Heading><Content>{downloadIssue.body}</Content></InlineAlert>
            <DownloaderCard view={downloader} />
            <ActionButton onPress={onBack}><Text>{LINK_TOOL_COPY.editLink}</Text></ActionButton>
          </> : null}
          {retry.asking ? <GrantCard items={retry.asking} onAgree={retry.agree} busy={retry.busy} /> : null}
          <div className={buttons}>
            {/* The grant card's Agree, or the downloader's fix, is the yellow while Retry cannot go yet. */}
            <Button
              variant={retry.asking || (downloadIssue && !downloader.ready) ? 'secondary' : 'accent'}
              isPending={retry.busy && !retry.asking}
              isDisabled={!!retry.asking}
              onPress={retry.retry}>
              {RUN_COPY.retry}
            </Button>
          </div>
        </>
      ) : null}
      {done ? (
        <div className={resultBox}>
          <ul className={lines}>
            {resultLines(job, meta, entry?.name ?? null).map((l) => (
              <li key={l} className={line}>
                <span className={lineIcon} aria-hidden>
                  <Checkmark />
                </span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
          <SwitchActions job={job} entry={entry} />
          {intoMovie && !entry ? <span className={detail}>{RUN_COPY.noVideo}</span> : null}
          <ToolOutputs entries={intoMovie && entry ? [entry, ...outputs] : outputs} fromTool={fromTool} saveDir={intoMovie ? null : outputsDir(outputs)} primaryOpen />
          {!intoMovie && !outputs.length ? <span className={detail}>{RUN_COPY.noOutputs}</span> : null}
        </div>
      ) : null}
      <div className={buttons}>
        <ActionButton isQuiet onPress={onBack}>
          <Text>{done || stopped ? RUN_COPY.again : RUN_COPY.backToForm}</Text>
        </ActionButton>
        <ActionButton isQuiet onPress={() => go({ tab: 'tasks', taskId: job.jobId })}>
          <Text>{RUN_COPY.inTasks}</Text>
        </ActionButton>
      </div>
    </section>
  );
}

/** The editor is holding this video right now (opening or already open): after a background undo finishes, it does not close the video on its behalf (same as change-card). */
function editorHolds(target: FileTarget, videoId: Id): boolean {
  const video = useVideo.getState().video;
  return video !== null && (video.videoId === videoId || sameTarget(video.target, target));
}

/**
 * After swapping in a transcript (product design §5.11, the action on the transcription result in design file tool-specs.jsx): “Refresh outdated translation” opens the video and the tool page in the editor;
 * “Undo” reverts that swap as one transaction (when the editor has this video open, it goes through the editor; otherwise it opens the video in the background, undoes, and closes it again, as in the change card).
 */
function SwitchActions({ job, entry }: { job: JobRecord; entry: SpaceEntry | null }) {
  const runtime = useRuntime();
  const ready = useVideo((s) => s.video?.status === 'ready' && s.video.videoId === job.pipeline?.summary?.videoId);
  const [busy, setBusy] = useState(false);
  const [undone, setUndone] = useState(false);
  const sw = transcriptSwitchOf(job);
  if (!sw || !entry || (!sw.stale && !sw.transactionId)) return null;
  const target = videoTargetOf(entry);

  const refresh = () => {
    const editor = useEditor.getState();
    editor.attach(sw.videoId);
    setAiToolPage(sw.videoId, { tool: 'stale', preset: null });
    editor.showPanel('aitools');
    useShell.getState().openVideo(target);
  };

  const undo = async (transaction: Id) => {
    setBusy(true);
    try {
      if (ready) {
        const receipt = await runtime.videos.undo({ transaction });
        if (!receipt) {
          ToastQueue.negative(CHANGE_COPY.undoFailed(useVideo.getState().video?.commandError?.message ?? RUN_COPY.unknown), {
            timeout: 5000,
          });
          return;
        }
        setUndone(true);
        ToastQueue.neutral(CHANGE_COPY.undoneToast, { timeout: 3000 });
        return;
      }
      const result = await undoInBackground({ request: runtime.client.request.bind(runtime.client), editorHolds }, target, transaction);
      setUndone(true);
      ToastQueue.neutral(result.kind === 'undone' ? CHANGE_COPY.undoneToast : CHANGE_COPY.alreadyUndone, { timeout: 3000 });
    } catch (error) {
      ToastQueue.negative(CHANGE_COPY.undoFailed(error instanceof Error ? error.message : String(error)), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={buttons}>
      {sw.stale && !undone ? (
        <Button variant="secondary" size="S" onPress={refresh}>
          {RETRANSCRIBE_COPY.refreshStale}
        </Button>
      ) : null}
      {sw.transactionId ? (
        <Button
          variant="secondary"
          size="S"
          isPending={busy}
          isDisabled={undone}
          onPress={() => sw.transactionId && void undo(sw.transactionId)}>
          {undone ? CHANGE_COPY.undone : RETRANSCRIBE_COPY.undo}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Transcription stops at “how many assets are on the video's main track” (`TRANSCRIBE_ASSET_AMBIGUOUS`): the user picks one, and it restarts with `assetId` (a new run).
 * The contract gives only the asset ID, with no name.
 */
function AmbiguousAssets({ job, ids, title }: { job: JobRecord; ids: readonly Id[]; title: string }) {
  const [pick, setPick] = useState<Id | null>(ids[0] ?? null);
  const meta = useVideoTools((s) => s.meta[job.jobId] ?? null);
  const key = `asset:${job.jobId}:${pick ?? ''}`;
  const starter = useToolStart('transcribe', key);
  const request = pick ? withAsset(job, pick) : null;
  const start = () => request && starter.start(request, meta ?? { tool: 'transcribe', input: runInput(job), title }, key);
  return (
    <>
      <InlineAlert variant="notice">
        <Heading>{RUN_COPY.ambiguousTitle}</Heading>
        <Content>{RUN_COPY.ambiguousBody}</Content>
      </InlineAlert>
      <RadioGroup aria-label={RUN_COPY.ambiguousTitle} size="S" value={pick ?? ''} onChange={(v) => setPick(v)}>
        {ids.map((id, i) => (
          <Radio key={id} value={id}>
            {RUN_COPY.asset(i + 1, id)}
          </Radio>
        ))}
      </RadioGroup>
      {starter.asking ? <GrantCard items={starter.asking} onAgree={starter.agree} busy={starter.busy} /> : null}
      <div className={buttons}>
        <Button
          variant={starter.asking ? 'secondary' : 'accent'}
          isDisabled={!request || !!starter.asking}
          isPending={starter.busy && !starter.asking}
          onPress={start}>
          {RUN_COPY.useAsset}
        </Button>
      </div>
    </>
  );
}

// ---- Run records ----

const recordItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  // The open run gets a neutral ring: a state never wears the accent (agentcut).
  borderColor: { default: 'gray-200', isHovered: 'gray-400', isCurrent: 'gray-600', isFailed: 'orange-400' },
  backgroundColor: { default: 'gray-50', isCurrent: 'gray-100' },
  cursor: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: 2,
  minWidth: 0,
});
const recordName = style({ font: 'title-sm', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });
const recordPhase = style({ font: 'ui-xs', color: { default: 'gray-600', isFailed: 'orange-1000' } });
const listBox = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });
const MAX_RUNS = 30;

function RunRecord({ job, current }: { job: JobRecord; current: boolean }) {
  const { title } = useRunTitle(job);
  const run = useRunView(job);
  const failed = run?.status === 'failed';
  return (
    <ListBoxItem id={job.jobId} textValue={title} className={(rp) => recordItem({ ...rp, isCurrent: current, isFailed: failed })}>
      <span className={recordName}>{title}</span>
      {run ? <span className={recordPhase({ isFailed: failed })}>{phase(run)}</span> : null}
      {run?.status === 'running' ? <ProgressBar aria-label={RUN_COPY.progress(title)} size="S" value={pct(run)} /> : null}
    </ListBoxItem>
  );
}

/** Right column: this tool's run records (newest first); click one to see its progress and result. */
export function ToolRunList({ tool, current, onOpen }: { tool: VideoToolId; current: Id | null; onOpen: (jobId: Id) => void }) {
  const ready = useJobs((s) => s.ready);
  const jobs = useJobs((s) => s.jobs);
  const runs = useMemo(() => runsOf(jobs, tool), [jobs, tool]);
  const live = runs.filter((j) => j.state === 'running' || j.state === 'queued').length;
  const info = toolById(tool);
  const Icon = TOOL_ICON[info?.icon ?? 'transcript'];
  return (
    <>
      <SideHead title={RUN_COPY.side} live={live ? RECORD_COPY.live(live) : null} count={RECORD_COPY.count(runs.length)} />
      {!ready ? (
        <span className={detail}>{RUN_COPY.loading}</span>
      ) : runs.length ? (
        <>
          <ListBox aria-label={RUN_COPY.side} className={listBox} onAction={(key) => onOpen(String(key))}>
            {runs.slice(0, MAX_RUNS).map((j) => (
              <RunRecord key={j.jobId} job={j} current={j.jobId === current} />
            ))}
          </ListBox>
          {runs.length > MAX_RUNS ? <span className={detail}>{RUN_COPY.olderInTasks(runs.length - MAX_RUNS)}</span> : null}
        </>
      ) : (
        <EmptyCard icon={<Icon />} title={RUN_COPY.empty} body={RUN_COPY.emptyBody} />
      )}
    </>
  );
}

// ---- Page skeleton ----

const waiting = style({ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 8 });

/** Skeleton of the video tool page: the form or run page on the left, run records on the right; while viewing the run page, the header has no submit button. */
export function ToolFrame({
  tool,
  title,
  bar,
  chip,
  onKeyDown,
  children,
}: {
  tool: VideoToolId;
  title: string;
  bar: ReactNode;
  chip?: ReactNode;
  onKeyDown?: (e: KeyboardEvent) => void;
  children: ReactNode;
}) {
  const viewing = useVideoTools((s) => s.views[tool] ?? null);
  const setView = useVideoTools((s) => s.setView);
  const job = useJobs((s) => (viewing ? s.jobs.find((j) => j.jobId === viewing) : undefined));
  const back = () => setView(tool, null);
  const main = !viewing ? (
    children
  ) : job ? (
    <ToolRunView job={job} tool={tool} onBack={back} />
  ) : (
    <div className={waiting}>
      <span className={detail} role="status">
        {RUN_COPY.waiting}
      </span>
      <ActionButton isQuiet onPress={back}>
        <Text>{RUN_COPY.backToForm}</Text>
      </ActionButton>
    </div>
  );
  return (
    <ToolPage title={title} bar={viewing ? undefined : bar} chip={viewing ? undefined : chip}>
      <Workbench
        main={main}
        side={<ToolRunList tool={tool} current={viewing} onOpen={(id) => setView(tool, id)} />}
        sideLabel={RUN_COPY.side}
        onKeyDown={viewing ? undefined : onKeyDown}
      />
    </ToolPage>
  );
}

import { create } from 'zustand';
import type { FileTarget, Id, JobRecord, ModelRef, TranscribeParams } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { ELEMENT_TILES } from '../../model/element-catalog.ts';
import { linkMeta, linkProvenance, linkSummary, type FollowUp } from '../../model/link-import.ts';
import {
  BG_COLOR,
  chainOf,
  fileNameOf,
  mediaKindOf,
  needsTranscribe,
  RATIO_SIZE,
  targetLanguage,
  type BgHue,
  type FlowKey,
  type Ratio,
} from '../../model/new-flow.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { awaitingDecision, bindTranscribe, startTranscribe, useSubtitleRun } from '../editor/transcribe-run.ts';
import { bindTranslate, startTranslate, useTranslateRun } from '../editor/translate-run.ts';
import { ST } from './start-copy.ts';
import { jobErrorText } from '../../model/localized-text.ts';

/**
 * Follow-up after a link import (this used to be the execution of the home page's fixed flow too; the home page's fixed flow has now been retired, and only the task detail's “Create video from downloaded file” starts a run, via `adoptDownload`):
 * creates the video, enters the editor, and (optionally) submits transcription (the subtitle panel's transcribe-run). Translation starts automatically after transcription completes
 * (the subtitle panel's translate-run). The link import creates the video from the downloaded file after the `link-import` flow finishes.
 *
 * State lives in a module-level store: after starting, the page may switch away (a link import goes to the task detail), and execution must not break because of that. It applies only to this run:
 * after an app restart, a completed download appears in the task detail as “Create video from downloaded file”; transcription and translation tasks continue in the background task list as usual.
 */

export interface FlowOptions {
  ratio: Ratio;
  bg: BgHue;
  wave: boolean;
  subs: boolean;
  /** Target language for translation (BCP 47). */
  target: string;
  /** Translated subtitles are shown together with the original. */
  bilingual: boolean;
  /** Text model used for translation (the one the page's gate card shows); null means the Runtime uses its default. */
  textModel: ModelRef | null;
  transcribe: Pick<TranscribeParams, 'provider' | 'model' | 'language' | 'hint'>;
}

export type RunStage = 'downloading' | 'creating' | 'transcribing' | 'translating' | 'done' | 'failed';

export interface FlowRun {
  /** For a link import this is the parent task ID; for a local file it is a generated key. */
  key: string;
  flow: FlowKey;
  projectId: Id;
  /** Video name (the filename without its extension, or the link's title). */
  name: string;
  options: FlowOptions;
  linkJobId: Id | null;
  stage: RunStage;
  target: FileTarget | null;
  videoId: Id | null;
  assetId: Id | null;
  transcribeJobId: Id | null;
  translateJobId: Id | null;
  /** Translation submission succeeded: afterwards, if translate-run has no such round, check the receipt or the issue card. */
  translateStarted: boolean;
  failedAt: 'video' | 'subs' | 'translate' | null;
  error: string | null;
}

interface FlowRunsState {
  runs: Record<string, FlowRun>;
}

export const useFlowRuns = create<FlowRunsState>()(() => ({ runs: {} }));

type ToastKind = 'positive' | 'neutral' | 'negative' | 'info';

export interface RunnerDeps {
  runtime: Pick<
    RuntimeSession,
    'createFlowVideo' | 'startPipeline' | 'createProject' | 'startTranslate' | 'retryPipeline' | 'readDocument' | 'cancelJob' | 'videos'
  >;
  toast(kind: ToastKind, message: string, action?: { label: string; run: () => void }): void;
}

let deps: RunnerDeps | null = null;
let unwatch: (() => void) | null = null;
let unwatchTranslate: (() => void) | null = null;

/** Bound when the task detail mounts (together with the transcription and translation runs); the first binding starts watching the `jobs` topic and the translation run status. */
export function bindFlowRunner(next: RunnerDeps): void {
  deps = next;
  const toast = (kind: 'positive' | 'neutral' | 'negative', message: string, undo?: () => void) =>
    next.toast(kind, message, undo ? { label: ST.flow.undo, run: undo } : undefined);
  bindTranscribe({ runtime: next.runtime, toast });
  bindTranslate({ runtime: next.runtime, toast });
  unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
  unwatchTranslate ??= useTranslateRun.subscribe(() => settle(useJobs.getState().jobs));
}

function put(run: FlowRun): void {
  useFlowRuns.setState((s) => ({ runs: { ...s.runs, [run.key]: run } }));
}

function patch(key: string, change: Partial<FlowRun>): FlowRun | null {
  const current = useFlowRuns.getState().runs[key];
  if (!current) return null;
  const next = { ...current, ...change };
  put(next);
  return next;
}

/** How far the link import's follow-up has got (used by the task detail's three steps); null when it was not started from the home page in this run. */
export function followOf(run: FlowRun | null | undefined): FollowUp | null {
  if (!run) return null;
  const video: FollowUp['video'] =
    run.failedAt === 'video' ? 'failed' : run.stage === 'downloading' ? 'pending' : run.stage === 'creating' ? 'running' : 'done';
  const subs: FollowUp['subs'] = !needsTranscribe(run.flow, run.options.subs)
    ? 'skipped'
    : run.failedAt === 'subs'
      ? 'failed'
      : run.stage === 'transcribing'
        ? 'running'
        : run.stage === 'translating' || run.stage === 'done' || run.failedAt === 'translate'
          ? run.transcribeJobId
            ? 'done'
            : 'skipped'
          : 'pending';
  return { video, subs };
}

export function runOfLink(jobId: Id): FlowRun | null {
  return useFlowRuns.getState().runs[jobId] ?? null;
}

/** Hint given on binding: a Spectrum toast; ones with buttons stay longer. */
export function flowToast(kind: ToastKind, message: string, action?: { label: string; run: () => void }): void {
  ToastQueue[kind](message, action ? { timeout: 6000, actionLabel: action.label, onAction: action.run, shouldCloseOnAction: true } : { timeout: 5000 });
}

const stem = (name: string) => name.replace(/\.[^.]+$/, '') || name;

interface StartInput {
  flow: FlowKey;
  projectId: Id;
  file: string | null;
  url: string | null;
  options: FlowOptions;
}

function blankRun(key: string, input: StartInput, projectId: Id, name: string, linkJobId: Id | null): FlowRun {
  return {
    key,
    flow: input.flow,
    projectId,
    name,
    options: input.options,
    linkJobId,
    stage: linkJobId ? 'downloading' : 'creating',
    target: null,
    videoId: null,
    assetId: null,
    transcribeJobId: null,
    translateJobId: null,
    translateStarted: false,
    failedAt: null,
    error: null,
  };
}

/** Create the video (adding a background and a waveform if needed), open it, then submit transcription. `link` is the media name and source of the file downloaded by the link import (the video details' “Source info”). */
async function createAndGo(
  key: string,
  path: string | null,
  how: { open: boolean; transcribe?: boolean; link?: { name: string | null; provenance: ReturnType<typeof linkProvenance> } },
): Promise<void> {
  const bound = deps;
  const run = useFlowRuns.getState().runs[key];
  if (!bound || !run) return;
  const { flow, options } = run;
  const kind = path ? (mediaKindOf(path) === 'audio' ? 'audio' : 'video') : null;
  const sized = flow === 'blank' || flow === 'a2v';
  const size = sized ? RATIO_SIZE[options.ratio] : null;
  const wave = flow === 'a2v' && options.wave && kind ? ELEMENT_TILES.find((t) => t.key === 'wave.bars')?.layer(size!) : undefined;
  let created;
  try {
    created = await bound.runtime.createFlowVideo(
      { projectId: run.projectId },
      {
        ...(run.name ? { name: run.name } : {}),
        ...(size ? { width: size.width, height: size.height } : {}),
        ...(path && kind
          ? {
              file: {
                path,
                kind,
                ...(how.link?.name ? { name: how.link.name } : {}),
                ...(how.link?.provenance ? { provenance: how.link.provenance } : {}),
              },
            }
          : {}),
        ...(flow === 'a2v' ? { background: BG_COLOR[options.bg] } : {}),
        ...(wave ? { wave } : {}),
      },
    );
  } catch (error) {
    patch(key, { stage: 'failed', failedAt: 'video', error: (error as Error).message });
    bound.toast('negative', ST.flow.createFailed((error as Error).message));
    return;
  }
  const { target, videoId, assetId, importError, waveError } = created;
  patch(key, { target, videoId, assetId });
  if (how.open || shouldOpen(run)) useShell.getState().openVideo(target, { conversationId: null, projectId: run.projectId });
  const open = { label: ST.flow.openVideo, run: () => useShell.getState().openVideo(target, { conversationId: null, projectId: run.projectId }) };
  if (importError) {
    patch(key, { stage: 'failed', failedAt: 'video', error: importError });
    bound.toast('negative', ST.flow.importFailed(importError), how.open ? undefined : open);
    return;
  }
  if (waveError) bound.toast('neutral', ST.flow.waveFailed(waveError));
  if (flow === 'blank' || !path || !assetId || how.transcribe === false || !needsTranscribe(flow, options.subs)) {
    patch(key, { stage: 'done' });
    const what = flow === 'blank' ? ST.flow.blankCreated : flow === 'a2v' ? ST.flow.a2vCreated(options.wave) : ST.flow.created;
    bound.toast('positive', what, how.open ? undefined : open);
    return;
  }
  patch(key, { stage: 'transcribing' });
  await startTranscribe(videoId, { id: assetId, name: fileNameOf(path) }, options.transcribe);
  const sub = useSubtitleRun.getState();
  const live = sub.runs[videoId];
  if (!live?.jobId) {
    const problem = sub.problems[videoId];
    const why = problem ? ST.flow.reason([problem.title, problem.message].filter(Boolean)) : ST.flow.notSubmitted;
    patch(key, { stage: 'failed', failedAt: 'subs', error: why });
    bound.toast('negative', ST.flow.transcribeNotStarted(why), how.open ? undefined : open);
    return;
  }
  patch(key, { transcribeJobId: live.jobId });
  const chain = chainOf(flow, targetLanguage(options.target));
  const tasks = { label: ST.flow.viewTask, run: () => useShell.getState().go({ tab: 'tasks', taskId: live.jobId! }) };
  bound.toast(
    'positive',
    chain
      ? ST.flow.chainQueued(chain.title)
      : flow === 'a2v'
        ? ST.flow.a2vTranscribing(options.wave)
        : ST.flow.transcribing,
    how.open ? tasks : open,
  );
  settle(useJobs.getState().jobs);
}

/**
 * Whether to open the video directly after the download completes: it opens if the user is still on this import's task detail or on the start page. If they are elsewhere (editing something else, viewing another page), it does not interrupt,
 * and the notice offers “Open video”.
 */
function shouldOpen(run: FlowRun): boolean {
  const { route } = useShell.getState();
  if (route.tab === 'tasks') return route.taskId === run.linkJobId;
  return route.tab === 'home' && route.conversationId === null && !route.pane;
}

/** Watches the tasks started in this run: when a link import completes, create the video; when transcription completes, continue to translation; when translation completes, report. Each step first updates state synchronously and is handled only once. */
function settle(jobs: readonly JobRecord[]): void {
  for (const run of Object.values(useFlowRuns.getState().runs)) {
    if (run.stage === 'downloading' && run.linkJobId) {
      const job = jobs.find((j) => j.jobId === run.linkJobId);
      if (!job || job.state !== 'completed') continue;
      const summary = linkSummary(job);
      if (!summary) {
        patch(run.key, { stage: 'failed', failedAt: 'video', error: ST.flow.noDownload });
        continue;
      }
      const title = linkMeta(job).title;
      const name = title ?? stem(fileNameOf(summary.files.media));
      patch(run.key, { stage: 'creating', name: name.slice(0, 80) });
      void createAndGo(run.key, summary.files.media, { open: false, link: { name: title, provenance: linkProvenance(job) } });
      continue;
    }
    if (run.stage === 'transcribing' && run.transcribeJobId) {
      const job = jobs.find((j) => j.jobId === run.transcribeJobId);
      if (!job || isJobLive(job) || awaitingDecision(job)) continue;
      if (job.state !== 'completed') {
        patch(run.key, { stage: 'failed', failedAt: 'subs', error: jobErrorText(job.error) ?? ST.flow.transcribeUnfinished });
        continue;
      }
      if (run.flow !== 'trans') {
        patch(run.key, { stage: 'done' });
        continue;
      }
      const documentId = job.result?.documentId ?? null;
      if (!documentId) {
        patch(run.key, { stage: 'failed', failedAt: 'subs', error: ST.flow.noSpeech });
        deps?.toast('neutral', ST.flow.noSpeechToast(run.name));
        continue;
      }
      patch(run.key, { stage: 'translating' });
      void translate(run.key, documentId);
      continue;
    }
    if (run.stage === 'translating' && run.translateStarted && run.videoId) {
      // Translation is wrapped up by translate-run (shown on screen, with a receipt or an issue card); report once its round has ended.
      const translating = useTranslateRun.getState();
      if (translating.runs[run.videoId]) continue;
      const target = run.target;
      const open = target
        ? { label: ST.flow.openVideo, run: () => useShell.getState().openVideo(target, { conversationId: null, projectId: run.projectId }) }
        : undefined;
      const receipt = translating.receipts[run.videoId];
      const problem = translating.problems[run.videoId];
      if (receipt) {
        patch(run.key, { stage: 'done' });
        deps?.toast('positive', chainOf('trans', targetLanguage(run.options.target))!.doneToast, open);
      } else if (problem) {
        const why = ST.flow.reason([problem.title, problem.message].filter(Boolean));
        patch(run.key, { stage: 'failed', failedAt: 'translate', error: why });
        // When the editor has another video open, translate-run has already suggested “Show it on screen in the comparison list”.
        const told = problem.kind === 'pending' && useVideo.getState().video?.videoId !== run.videoId;
        if (!told) deps?.toast('negative', ST.flow.translateNotPlaced(run.name || ST.flow.video, why), open);
      } else {
        // Cancelled (translate-run has already notified).
        patch(run.key, { stage: 'failed', failedAt: 'translate', error: ST.flow.translateCancelled });
      }
    }
  }
}

/**
 * Start translation (the subtitle panel's `startTranslate`): the `translate` flow requires the video to be open in the Runtime. If the user has closed it (the editor switched to another video), it is rejected,
 * and the notice offers “Open video and translate”. Reasons such as no text model being configured stay on the subtitle panel's issue card.
 */
async function translate(key: string, documentId: Id): Promise<void> {
  const bound = deps;
  const run = useFlowRuns.getState().runs[key];
  const videoId = run?.videoId;
  if (!bound || !run || !videoId) return;
  const started = await startTranslate({
    videoId,
    speechDocumentId: documentId,
    targetLanguage: run.options.target,
    style: '',
    model: run.options.textModel,
    bilingual: run.options.bilingual,
  });
  const state = useTranslateRun.getState();
  const jobId = state.runs[videoId]?.jobId ?? null;
  if (started) {
    // Look at the result only after submission succeeds (before that, translate-run has no such round yet); if wrap-up has already finished, report with the receipt or the issue card.
    patch(key, { translateJobId: jobId, translateStarted: true });
    settle(useJobs.getState().jobs);
    return;
  }
  const problem = state.problems[videoId];
  const message = problem ? ST.flow.reason([problem.title, problem.message].filter(Boolean)) : ST.flow.translateBusy;
  patch(key, { stage: 'failed', failedAt: 'translate', error: message });
  const target = run.target;
  bound.toast(
    'negative',
    ST.flow.translateFailed(message),
    target
      ? {
          label: ST.flow.openAndTranslate,
          run: () => {
            useShell.getState().openVideo(target, { conversationId: null, projectId: run.projectId });
            void waitForVideo(videoId).then((ready) => {
              if (!ready) return bound.toast('negative', ST.flow.notOpened);
              patch(key, { stage: 'translating', failedAt: null, error: null, translateJobId: null, translateStarted: false });
              void translate(key, documentId);
            });
          },
        }
      : undefined,
  );
}

function waitForVideo(videoId: Id, ms = 10_000): Promise<boolean> {
  const ready = () => {
    const video = useVideo.getState().video;
    return video?.videoId === videoId && !!video.state;
  };
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const stop = useVideo.subscribe(() => {
      if (!ready()) return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, ms);
  });
}

/**
 * After an app restart (or an import started elsewhere): the download has completed and this run has no follow-up. Create a video from the downloaded file and open it, without automatic transcription
 * (after entering the editor, click “Generate subtitles” in the subtitle panel). The project the download directory belongs to comes from the frozen parameters; if there is no project, the video cannot be created.
 */
export async function adoptDownload(job: JobRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  const bound = deps;
  const summary = linkSummary(job);
  const projectId = typeof job.pipeline?.params.projectId === 'string' ? job.pipeline.params.projectId : null;
  if (!bound || !summary) return { ok: false, error: ST.flow.noFile };
  if (!projectId) return { ok: false, error: ST.flow.noProject };
  const title = linkMeta(job).title;
  const name = (title ?? stem(fileNameOf(summary.files.media))).slice(0, 80);
  const input: StartInput = {
    flow: 'sub',
    projectId,
    file: summary.files.media,
    url: null,
    options: { ratio: '16:9', bg: 'gray', wave: false, subs: false, target: 'en', bilingual: true, textModel: null, transcribe: {} },
  };
  const key = job.jobId;
  put({ ...blankRun(key, input, projectId, name, job.jobId), stage: 'creating' });
  await createAndGo(key, summary.files.media, { open: true, transcribe: false, link: { name: title, provenance: linkProvenance(job) } });
  const after = useFlowRuns.getState().runs[key];
  return after?.failedAt ? { ok: false, error: after.error ?? ST.flow.createFailedShort } : { ok: true };
}

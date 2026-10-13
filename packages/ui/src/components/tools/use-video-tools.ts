import { useCallback, useRef, useState } from 'react';
import { create } from 'zustand';
import {
  grantCreateParamsFor,
  newId,
  type GrantRequestItem,
  type Id,
  type LinkCookieBrowser,
  type TranscribeDestination,
} from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import type { ToolId, ToolTargetKey, VideoToolId } from '../../model/tool-catalog.ts';
import {
  grantLoopText,
  grantAndRestart,
  grantKey,
  pendingGrantsOf,
  startTool,
  type OriginalAudio,
  type PipelineRequest,
  type RunMeta,
  type StartOutcome,
} from '../../model/tool-runs.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useSubmitFailed } from './use-tool-records.ts';
import { RUN_COPY } from './tools-copy.ts';

/**
 * Local state of the video tool pages (not persisted): which run each tool is viewing, the name recorded when this computer submitted it (the summary has only IDs), the video carried over by “接着做” (continue), and each page's half-filled form (kept when leaving and coming back). The speech model for transcription is stored in tools-store (persisted).
 */

/** Sources: local file, Space (a media entry or an editable video), link. */
export type TranscribeSource = 'file' | 'space' | 'link';
/** Sources: Space (a video with a transcript or a subtitle entry), local subtitle file. */
export type TranslateSource = 'space' | 'file';

export interface TranscribeDraft {
  source: TranscribeSource;
  path: string | null;
  url: string;
  entryId: Id | null;
  projectId: Id | null;
  /** When not writing into the video: only generate the transcript and subtitles (`none`, the default), or create a new video and put it in the project (`create`). */
  target: 'none' | 'create';
  /** When the video already has a transcript: the chosen destination and the new video's name (product design: re-transcribe); only valid for the video `entryId`; switching to another video returns it to the default. */
  dest: { entryId: Id; destination: TranscribeDestination; name: string } | null;
  /** The failed job from “重试转录…” (retry transcription…): while this video is still selected, shows why it failed last time. */
  retry: { entryId: Id; jobId: Id } | null;
}

export interface TranslateDraft {
  source: TranslateSource;
  entryId: Id | null;
  /** The chosen transcript; when none is chosen, the most recent one is used. */
  documentId: Id | null;
  /** Local path of the subtitle file. */
  file: string | null;
  lang: string | null;
  bilingual: boolean;
  /** Text model (`providerId/modelId`); when none is chosen, the effective default is used. */
  model: string | null;
}

export interface DubDraft {
  entryId: Id | null;
  /** Which existing translation to use; `new` means translate a new one first; with null, the default depends on whether translations exist. */
  translation: Id | 'new' | null;
  lang: string | null;
  original: OriginalAudio;
  /** Dubbing engine (speech synthesis model, `providerId/modelId`); when none is chosen, the effective default is used. */
  engine: string | null;
  /** The text model used when translating first. */
  textModel: string | null;
}

export interface LinkDraft {
  url: string;
  /** Browsers ticked for “网站登录” (website login); on submit they are sorted by detected order, which is the order tried; none ticked means anonymous download. */
  cookieBrowsers: LinkCookieBrowser[];
  target: ToolTargetKey;
  entryId: Id | null;
  projectId: Id | null;
  transcribe: boolean;
}

interface Drafts {
  transcribe: TranscribeDraft;
  'translate-subtitles': TranslateDraft;
  dub: DubDraft;
  'link-import': LinkDraft;
}

export interface ToolPreset {
  tool: ToolId;
  entryId: Id;
  retryJobId?: Id;
  /*
   * Editor AI tool “生成配乐” (generate score): which video to score, its duration in seconds, and the target duration pre-filled from it (clamped to the model's range; when the video is longer than a single run's limit, the limit is used, and after it is made it loops to fill the whole video; the tool page decides from `videoSec` and the selected model's limit whether the banner says it loops).
   */
  soundtrack?: { videoId: Id; videoName: string; videoSec: number; targetDurationSec: number };
}

interface VideoToolsState extends Drafts {
  /** The run each tool is viewing (parent job ID); null is the form. */
  views: Partial<Record<VideoToolId, Id | null>>;
  meta: Record<Id, RunMeta>;
  /** The Space entry pre-selected when moving to the next tool via “接着做” (continue) or “用工具处理…” (process with tool…); `retryJobId` is the failed job from “重试转录…” (retry transcription…). */
  preset: ToolPreset | null;
  /** “再做一次 / 重试” (do again / retry) from the Space viewer or background job details: when entering the tool page, fills the form with this job's parameters. */
  rerun: { tool: ToolId; jobId: Id } | null;
  /** The project the new video was last put into. */
  lastProject: Id | null;
  setView(tool: VideoToolId, jobId: Id | null): void;
  remember(jobId: Id, meta: RunMeta): void;
  setPreset(preset: ToolPreset | null): void;
  setRerun(rerun: { tool: ToolId; jobId: Id } | null): void;
  setLastProject(projectId: Id): void;
  patch<K extends keyof Drafts>(tool: K, patch: Partial<Drafts[K]>): void;
}

export const useVideoTools = create<VideoToolsState>()((set) => ({
  transcribe: { source: 'file', path: null, url: '', entryId: null, projectId: null, target: 'none', dest: null, retry: null },
  'translate-subtitles': { source: 'space', entryId: null, documentId: null, file: null, lang: null, bilingual: true, model: null },
  dub: { entryId: null, translation: null, lang: null, original: 'duck', engine: null, textModel: null },
  'link-import': { url: '', cookieBrowsers: [], target: 'none', entryId: null, projectId: null, transcribe: false },
  views: {},
  meta: {},
  preset: null,
  rerun: null,
  lastProject: null,
  setView: (tool, jobId) => set((s) => ({ views: { ...s.views, [tool]: jobId } })),
  remember: (jobId, meta) => set((s) => ({ meta: { ...s.meta, [jobId]: meta } })),
  setPreset: (preset) => set({ preset }),
  setRerun: (rerun) => set({ rerun }),
  setLastProject: (projectId) => set({ lastProject: projectId }),
  patch: (tool, patch) => set((s) => ({ [tool]: { ...s[tool], ...patch } }) as Partial<VideoToolsState>),
}));

/** Default project for a new video: the last one used if it still exists, otherwise the first. */
export function defaultProject(projects: readonly { id: Id }[], last: Id | null): Id | null {
  if (last && projects.some((p) => p.id === last)) return last;
  return projects[0]?.id ?? null;
}

interface Ask {
  /** What the form looked like at submit time: if the form changes, this authorization request is void. */
  key: string;
  request: PipelineRequest;
  commandId: string;
  items: GrantRequestItem[];
  meta: RunMeta;
  /** The items issued in this round (same commandId). */
  granted: Set<string>;
}

export interface ToolStart {
  /** The items refused on the spot by authorization and awaiting the user's consent; they are gone once the form changes. */
  asking: GrantRequestItem[] | null;
  busy: boolean;
  start(request: PipelineRequest, meta: RunMeta, key: string): void;
  /** Agree: issue each item, then resubmit with the same commandId. */
  agree(): void;
  /** A refused replacement of an edited transcript (`TRANSCRIPT_EDITED`), awaiting the user's confirmation; gone once the form changes. */
  edited: boolean;
  /** Replace anyway: resubmit with `acceptEdited: true`. */
  acceptEdited(): void;
}

/**
 * Submitting a video tool: each submit starts a new commandId; when authorization is refused on the spot, the pending items are handed to the page (grant card), and after the user agrees they are issued and resubmitted with the same commandId. On a successful start, switches to this run's page. `key` is the form's shape (different inputs, parameters); changing it voids this authorization request.
 */
export function useToolStart(tool: VideoToolId, key: string): ToolStart {
  const session = useRuntime();
  const setView = useVideoTools((s) => s.setView);
  const remember = useVideoTools((s) => s.remember);
  const failed = useSubmitFailed('pipeline', RUN_COPY.submitFailed);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [edited, setEdited] = useState<Omit<Ask, 'items'> | null>(null);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);

  const settle = useCallback(
    (outcome: StartOutcome, base: Omit<Ask, 'items'>) => {
      setEdited(null);
      if (outcome.kind === 'started') {
        setAsk(null);
        remember(outcome.jobId, base.meta);
        setView(tool, outcome.jobId);
        ToastQueue.positive(RUN_COPY.started, { timeout: 3000 });
      } else if (outcome.kind === 'grants') {
        setAsk({ ...base, items: outcome.items });
      } else if (outcome.kind === 'edited') {
        setAsk(null);
        setEdited(base);
      } else {
        setAsk(null);
        failed(outcome.error);
      }
    },
    [failed, remember, setView, tool],
  );

  const run = useCallback(
    (work: () => Promise<StartOutcome>, base: Omit<Ask, 'items'>) => {
      if (inflight.current) return;
      inflight.current = true;
      setBusy(true);
      void work()
        .then((outcome) => settle(outcome, base))
        .finally(() => {
          inflight.current = false;
          setBusy(false);
        });
    },
    [settle],
  );

  const start = useCallback(
    (request: PipelineRequest, meta: RunMeta, formKey: string) => {
      const base = { key: formKey, request, commandId: newId('cmd'), meta, granted: new Set<string>() };
      run(() => startTool(session, request, base.commandId), base);
    },
    [run, session],
  );

  const agree = useCallback(() => {
    if (!ask || ask.key !== key) return;
    const { items, ...base } = ask;
    run(() => grantAndRestart(session, base.request, base.commandId, items, base.granted), base);
  }, [ask, key, run, session]);

  const acceptEdited = useCallback(() => {
    if (!edited || edited.key !== key) return;
    const request = { ...edited.request, params: { ...edited.request.params, acceptEdited: true } };
    const base = { ...edited, request, commandId: newId('cmd'), granted: new Set<string>() };
    run(() => startTool(session, request, base.commandId), base);
  }, [edited, key, run, session]);

  return {
    asking: ask && ask.key === key ? ask.items : null,
    busy,
    start,
    agree,
    edited: edited !== null && edited.key === key,
    acceptEdited,
  };
}

export interface RunRetry {
  busy: boolean;
  /** The items refused on the spot during a retry, awaiting the user's consent. */
  asking: GrantRequestItem[] | null;
  retry(): void;
  agree(): void;
}

/**
 * Retries from the step where it stopped (`pipelines.retry`; the job ID is unchanged, completed steps are not redone). If refused on the spot, the pending items are handed back; after the user agrees, each is issued and the retry runs again; if it is still refused after issuing, it explains and does not loop.
 */
export function useRunRetry(jobId: Id): RunRetry {
  const session = useRuntime();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<GrantRequestItem[] | null>(null);
  const granted = useRef(new Set<string>());
  const attempt = useCallback(async () => {
    try {
      await session.retryPipeline(jobId);
      setAsking(null);
      ToastQueue.positive(RUN_COPY.retried, { timeout: 3000 });
    } catch (error) {
      const items = pendingGrantsOf(error);
      if (items && !items.every((item) => granted.current.has(grantKey(item)))) {
        setAsking(items);
        return;
      }
      setAsking(null);
      ToastQueue.negative(RUN_COPY.retryFailed(items ? grantLoopText() : error instanceof Error ? error.message : String(error)), { timeout: 6000 });
    }
  }, [jobId, session]);
  const guard = useCallback(
    (work: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      void work().finally(() => setBusy(false));
    },
    [busy],
  );
  const retry = useCallback(() => guard(attempt), [attempt, guard]);
  const agree = useCallback(() => {
    const items = asking;
    if (!items) return;
    guard(async () => {
      try {
        for (const item of items) {
          await session.createGrant(grantCreateParamsFor(item));
          granted.current.add(grantKey(item));
        }
      } catch (error) {
        setAsking(null);
        ToastQueue.negative(RUN_COPY.retryFailed(error instanceof Error ? error.message : String(error)), { timeout: 6000 });
        return;
      }
      await attempt();
    });
  }, [asking, attempt, guard, session]);
  return { busy, asking, retry, agree };
}

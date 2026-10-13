import type { Id, JobRecord } from '@cuccut/protocol';
import { jobLive } from './task-list.ts';
import { chargesOnRetry } from './task-reconcile.ts';

/**
 * Progress and result of the translation pipeline (`translate` in `pipelines.start`, architecture design §7.9) on the caption panel: the parent job (`kind: 'pipeline'`)
 * records four steps (read source → translate → assemble translation → write to video); the subtask for the translate step reports progress by sentence (`unit: 'units'`).
 * The prototype model-trans-run.js draws progress as a four-stage ladder with in-flight batches; here there are only the real numbers of the parent and subtask, and no batches are made up.
 *
 * A translation the agent does itself in the session (`kind: 'agentTranslate'`) also counts as this video's translation: it is only a progress record, with no steps and no percentage
 * (prototype model-trans-run.js `selfRun`), and its scope is recorded in `JobRecord.translation`.
 */

export const TRANSLATE_PIPELINE = 'translate';

/** Weight of each step in the total progress: almost all the time goes to calling the model batch by batch. An unrecognised step counts as 5. */
const STEP_WEIGHT: Record<string, number> = { 'freeze-source': 5, translate: 85, assemble: 5, write: 5 };
const weightOf = (name: string) => STEP_WEIGHT[name] ?? 5;

/** The progress record for the agent's own translation in the session (not a translation pipeline). */
export function isAgentTranslate(job: JobRecord): boolean {
  return job.kind === 'agentTranslate';
}

/** This video's translation: a translation pipeline (wherever it was started: caption panel, agent or command line), or the agent's own translation. */
export function isTranslateJob(job: JobRecord, videoId: Id | null): boolean {
  if (videoId === null || job.videoId !== videoId) return false;
  return (job.kind === 'pipeline' && job.pipeline?.name === TRANSLATE_PIPELINE) || isAgentTranslate(job);
}

/**
 * A translation pipeline that refreshes one existing translation in place (`translationId` is given; product design §5.10 “Sentence-by-sentence and stale translations”): it adds no translation and creates no caption layer,
 * and its progress is drawn on the stats bar of that translation's comparison list, taking up no track bar or running-state header.
 */
export function refreshOf(job: JobRecord): Id | null {
  if (job.kind !== 'pipeline' || job.pipeline?.name !== TRANSLATE_PIPELINE) return null;
  const id = job.pipeline.params.translationId;
  return typeof id === 'string' && id ? id : null;
}

/** The task currently refreshing this translation in place (wherever it was started); includes the sentence count when specific sentences were named. */
export function liveRefresh(jobs: readonly JobRecord[], translationId: Id): { job: JobRecord; count: number | null } | null {
  const job = jobs.find((j) => refreshOf(j) === translationId && jobLive(j));
  if (!job) return null;
  const sentences = job.pipeline?.params.sentences;
  return { job, count: Array.isArray(sentences) ? sentences.length : null };
}

/** Ones being translated (queued, running, or automatically re-run after a crash). */
export function liveTranslations(jobs: readonly JobRecord[], videoId: Id | null): JobRecord[] {
  return jobs.filter((job) => isTranslateJob(job, videoId) && jobLive(job));
}

/** Target language from the frozen parameters; for the agent's own translation, read `translation`. */
export function targetOf(job: JobRecord): string | null {
  const target = job.pipeline?.params.targetLanguage ?? job.translation?.targetLanguage;
  return typeof target === 'string' && target ? target : null;
}

/** Source text from the frozen parameters (`speech` document); for the agent's own translation, read `translation`. */
export function sourceOf(job: JobRecord): Id | null {
  const id = job.pipeline?.params.documentId ?? job.translation?.sourceDocumentId;
  return typeof id === 'string' && id ? id : null;
}

/** The `translation` document written into the video on completion: `result.documentId`; when absent, read `pipeline.summary`. */
export function translationOf(job: JobRecord): Id | null {
  const fromResult = job.result?.documentId;
  if (fromResult) return fromResult;
  const fromSummary = job.pipeline?.summary?.documentId;
  return typeof fromSummary === 'string' && fromSummary ? fromSummary : null;
}

export interface TranslateProgress {
  /** 0–100; 0 before it starts, at most 99 until it completes. The agent's own translation has no percentage: null while running. */
  percent: number | null;
  /** The step currently executing (step name given by the Runtime); null while queued or before any step exists. */
  step: string | null;
  /** Sentence count of the translate step; null until reported. */
  units: { done: number; total: number | null } | null;
  queued: boolean;
  /** The agent's own translation: number of sentences to translate (no per-sentence progress); null for a translation pipeline. */
  agent: { sentences: number } | null;
}

/**
 * Total progress: completed (or skipped) steps count in full, and the running step counts partly by the `done / total` its subtask reports. When the subtask is not in the mirror or has no total,
 * that step counts as 0 — better slow than guessed.
 */
export function translateProgress(parent: JobRecord, jobs: readonly JobRecord[]): TranslateProgress {
  if (isAgentTranslate(parent)) {
    const percent = parent.state === 'completed' ? 100 : null;
    return { percent, step: null, units: null, queued: false, agent: { sentences: parent.translation?.sentences ?? 0 } };
  }
  const steps = parent.pipeline?.steps ?? [];
  const total = steps.reduce((sum, step) => sum + weightOf(step.name), 0);
  let done = 0;
  let current: (typeof steps)[number] | null = null;
  let units: TranslateProgress['units'] = null;
  for (const step of steps) {
    const weight = weightOf(step.name);
    if (step.status === 'completed' || step.status === 'skipped') {
      done += weight;
      continue;
    }
    if (step.status !== 'running') continue;
    current = step;
    const child = step.jobId ? jobs.find((job) => job.jobId === step.jobId) : undefined;
    const progress = child?.progress ?? null;
    if (progress && progress.total) done += weight * Math.min(1, Math.max(0, progress.done / progress.total));
    if (step.name === 'translate' && progress?.unit === 'units') units = { done: progress.done, total: progress.total ?? null };
  }
  const finished = parent.state === 'completed';
  const percent = finished ? 100 : total ? Math.min(99, Math.floor((done / total) * 100)) : 0;
  return { percent, step: current?.label ?? null, units, queued: parent.state === 'queued', agent: null };
}

/**
 * Whether a retry costs money again: `pipelines.retry` resumes from the step where it stopped, reusing the output of the steps already completed.
 * - Stopped at “translate”: this step reruns entirely, and batches already translated call the online model again (`charges`; local and node runs are not charged, null).
 * - Stopped after “translate”: the translation is already in the output, and the model is not called again (`free`).
 * - Stopped before “translate”: the model has not been called yet, so there is no “again” to pay for (null).
 */
export function retryNote(job: JobRecord): 'charges' | 'free' | null {
  const steps = job.pipeline?.steps ?? [];
  const stoppedAt = job.pipeline?.stoppedAt ?? steps.find((s) => s.status === 'failed' || s.status === 'interrupted' || s.status === 'cancelled')?.name;
  if (!stoppedAt) return null;
  const stopped = steps.findIndex((s) => s.name === stoppedAt);
  const translate = steps.findIndex((s) => s.name === 'translate');
  if (stopped < 0 || translate < 0 || stopped < translate) return null;
  if (stopped === translate) return chargesOnRetry(job) ? 'charges' : null;
  return 'free';
}

import { defineMessages, live, localizeText, type DubFitStatus, type DubSummary, type Id, type JobKind, type JobRecord, type PipelineStepState } from '@cuccut/protocol';
import { zhHans } from './dub-progress.zh-Hans.ts';
import { zhHant } from './dub-progress.zh-Hant.ts';
import { ja } from './dub-progress.ja.ts';
import { ko } from './dub-progress.ko.ts';
import { es } from './dub-progress.es.ts';
import { fr } from './dub-progress.fr.ts';
import { de } from './dub-progress.de.ts';
import { nl } from './dub-progress.nl.ts';
import { ptBR } from './dub-progress.pt-BR.ts';
import { it } from './dub-progress.it.ts';
import { ru } from './dub-progress.ru.ts';
import { pl } from './dub-progress.pl.ts';
import { tr } from './dub-progress.tr.ts';
import { vi } from './dub-progress.vi.ts';
import { DUB_PIPELINE } from './dub-setup.ts';
import { jobRemedy, type Remedy } from './task-facts.ts';
import { jobLive } from './task-list.ts';
import { chargesOnRetry } from './task-reconcile.ts';

/**
 * Progress, failure and receipt for the translated dubbing flow (`dub` of `pipelines.start`, architecture design §7.9) on the tools page. The parent task records nine steps: read source → translate → assemble translation → write translation → verify translation → separate vocals and background → synthesize sentence by sentence → align timing → apply dub. The translation and synthesis steps report progress per sentence. The synthesis step opens a child task for each sentence (`第 N 句`). When a translation is given, the three translation steps are skipped. When separation is not requested or there is no separation executor, the separation step is skipped.
 * Progress is computed only from the real numbers the Runtime reports, without guessing batches (same as translate-progress.ts).
 */

/** The weight of each step in total progress: most of the time goes to per-batch translation and per-sentence synthesis. Unrecognized steps count as 3. */
const STEP_WEIGHT: Record<string, number> = {
  'freeze-source': 2,
  translate: 30,
  assemble: 2,
  write: 2,
  'check-translation': 2,
  separate: 10,
  synthesize: 50,
  align: 4,
  apply: 3,
};
const weightOf = (name: string) => STEP_WEIGHT[name] ?? 3;

/** The three steps that only run when translating first. */
export const TRANSLATING_STEPS = new Set(['translate', 'assemble', 'write']);
/** When the flow stops at these steps, the failure and remedy are based on the text model. Others are based on speech synthesis. */
const TEXT_STEPS = new Set(['freeze-source', 'translate', 'assemble', 'write']);

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** The translated dubbing flow for this video (wherever it was started: the tools page, the agent, or the command line). */
export function isDubJob(job: JobRecord, videoId: Id | null): boolean {
  return job.kind === 'pipeline' && job.pipeline?.name === DUB_PIPELINE && videoId !== null && job.videoId === videoId;
}

/** Being dubbed (queued, running, or rerun automatically after a crash). */
export function liveDubs(jobs: readonly JobRecord[], videoId: Id | null): JobRecord[] {
  return jobs.filter((job) => isDubJob(job, videoId) && jobLive(job));
}

/** The language dubbed into, from the frozen parameters. */
export function dubLanguageOf(job: JobRecord): string | null {
  return str(job.pipeline?.params.language) ?? str(job.pipeline?.summary?.language);
}

/** The speech synthesis and text model Providers in the frozen parameters (the parent task's `providerId` records only the speech synthesis one). */
export function dubProviders(job: JobRecord): { voice: string | null; text: string | null } {
  const params = job.pipeline?.params ?? {};
  const voice = isObject(params.voice) ? str(params.voice.providerId) : null;
  const translate = isObject(params.translate) ? str(params.translate.provider) : null;
  return { voice: voice ?? str(job.providerId), text: params.translationId ? null : translate };
}

/** The step that stops the flow: `pipeline.stoppedAt`. If absent, the first failed, interrupted or cancelled step. */
export function dubStoppedAt(job: JobRecord): string | null {
  const steps = job.pipeline?.steps ?? [];
  return job.pipeline?.stoppedAt ?? steps.find((s) => s.status === 'failed' || s.status === 'interrupted' || s.status === 'cancelled')?.name ?? null;
}

/** Whether this step is skipped: already marked `skipped`, or not reached yet but certainly skipped by the frozen parameters (the three translation steps when a translation is given; no separation executor). */
function skips(step: PipelineStepState, params: Json): boolean {
  if (step.status === 'skipped') return true;
  if (step.status !== 'pending') return false;
  if (TRANSLATING_STEPS.has(step.name)) return typeof params.translationId === 'string' && params.translationId !== '';
  if (step.name === 'separate') return !params.separatorId;
  return false;
}

/** Steps drawn on the progress ladder: the skipped ones and those the frozen parameters certainly skip are removed. Nine cells do not fit a narrow panel, and there is no reason to draw cells that stay grey forever. */
export function dubLadder(job: JobRecord): PipelineStepState[] {
  const params = job.pipeline?.params ?? {};
  return (job.pipeline?.steps ?? []).filter((step) => !skips(step, params));
}

export interface DubProgress {
  /** 0–100. 0 before starting, at most 99 before completion. */
  percent: number;
  /** The step now running: the step name from the Runtime and its name for people. null while queued or before any step. */
  step: { name: string; label: string } | null;
  /** The sentence count for the translation or synthesis step. null until reported. */
  units: { step: 'translate' | 'synthesize'; done: number; total: number | null } | null;
  /** For the synthesis step: the per-sentence child tasks now running. The number of sentences synthesizing and the number that failed. */
  sentences: { running: number; failed: number } | null;
  queued: boolean;
}

/**
 * Total progress: completed or skipped steps are not counted. Steps certain to be skipped are not counted either, so the bar does not jump ahead at the start. A running step counts partly, by the child task's `done / total`.
 * When a child task is not in the mirror or has no total, that step counts as 0. Better slow than guessing.
 */
export function dubProgress(parent: JobRecord, jobs: readonly JobRecord[]): DubProgress {
  const steps = dubLadder(parent);
  const total = steps.reduce((sum, step) => sum + weightOf(step.name), 0);
  let done = 0;
  let current: PipelineStepState | null = null;
  let units: DubProgress['units'] = null;
  let sentences: DubProgress['sentences'] = null;
  for (const step of steps) {
    const weight = weightOf(step.name);
    if (step.status === 'completed') {
      done += weight;
      continue;
    }
    if (step.status !== 'running') continue;
    current = step;
    const child = step.jobId ? jobs.find((job) => job.jobId === step.jobId) : undefined;
    const progress = child?.progress ?? null;
    if (progress && progress.total) done += weight * Math.min(1, Math.max(0, progress.done / progress.total));
    if ((step.name === 'translate' || step.name === 'synthesize') && progress?.unit === 'units') {
      units = { step: step.name, done: progress.done, total: progress.total ?? null };
    }
    if (step.name === 'synthesize') {
      const mine = jobs.filter(
        (job) => job.parentJobId === parent.jobId && job.step?.name === 'synthesize' && job.jobId !== step.jobId && job.attempt === step.attempts,
      );
      sentences = { running: mine.filter((job) => jobLive(job)).length, failed: mine.filter((job) => job.state === 'failed').length };
    }
  }
  const finished = parent.state === 'completed';
  const percent = finished ? 100 : total ? Math.min(99, Math.floor((done / total) * 100)) : 0;
  return {
    percent,
    step: current ? { name: current.name, label: current.label } : null,
    units,
    sentences,
    queued: parent.state === 'queued',
  };
}

/**
 * Whether a retry spends money again on work already done. `pipelines.retry` continues from the step where it stopped and reuses the outputs of earlier completed steps.
 * - Stopped at “翻译” (translation): this whole step reruns. Batches already translated call the online text model again (`charges`; local and node runs are not billed, so null).
 * - Stopped at “逐句合成” (sentence synthesis): sentences already synthesized are reused. Only the failed and not-yet-synthesized ones are synthesized (`partial`).
 * - Stopped after synthesis (align, apply): the model is not called again (`free`).
 * - Stopped between translation and synthesis: the translation is reused and synthesis has not started, so there is no “再” (again) cost (`free`). Stopped before translation: null.
 */
export function dubRetryNote(job: JobRecord): 'charges' | 'partial' | 'free' | null {
  const stoppedAt = dubStoppedAt(job);
  if (!stoppedAt || stoppedAt === 'freeze-source') return null;
  if (stoppedAt === 'translate') {
    const text = dubProviders(job).text;
    return text && chargesOnRetry({ providerId: text }) ? 'charges' : null;
  }
  if (stoppedAt === 'synthesize') return 'partial';
  return 'free';
}

/** On failure, the remedy depends on the step it stopped at. Translation steps use the text model (`generateText`). Others use speech synthesis (credential and config problems go to the model page). */
export function dubRemedy(job: JobRecord): Remedy | null {
  const stoppedAt = dubStoppedAt(job);
  const providers = dubProviders(job);
  const text = stoppedAt !== null && TEXT_STEPS.has(stoppedAt);
  const kind: JobKind = text ? 'generateText' : 'synthesizeSpeech';
  const providerId = (text ? providers.text : providers.voice) ?? job.providerId;
  return jobRemedy({ kind, providerId, error: job.error });
}

/** The summary on completion. null when there is none, or when it does not look like `DubSummary`. */
export function dubSummaryOf(job: JobRecord): DubSummary | null {
  const summary = job.pipeline?.summary;
  if (!isObject(summary) || !isObject(summary.units) || typeof summary.planDocumentId !== 'string' || typeof summary.groupId !== 'string') return null;
  const s = summary as unknown as DubSummary;
  return {
    ...s,
    staleUnits: Array.isArray(s.staleUnits) ? s.staleUnits : [],
    voiceUnavailableUnits: Array.isArray(s.voiceUnavailableUnits) ? s.voiceUnavailableUnits : [],
    speakers: Array.isArray(s.speakers) ? s.speakers : [],
    overlongUnits: Array.isArray(s.overlongUnits) ? s.overlongUnits : [],
  };
}

export type DubUnitKey = DubFitStatus | 'stale' | 'offTimeline' | 'voiceUnavailable';

export interface DubUnitRow {
  key: DubUnitKey;
  label: string;
  count: number;
  /** Placed (`placed`) or not placed (the user should take a look). */
  placed: boolean;
}

/** Copy for the dub progress and receipt (English is the source of keys and types; translations are in `dub-progress.zh-Hans.ts`). */
const en = {
  unit: {
    fit: 'Placed as is',
    tempo: 'Placed after speeding up',
    extended: 'Sped up to the limit, using the silence after it',
    overlong: 'Too long to fit, not placed',
    stale: 'Translation out of date, not synthesized',
    offTimeline: 'Original line no longer on the timeline, not placed',
    voiceUnavailable: 'Speaker’s voice unavailable, not synthesized',
  } as Record<DubUnitKey, string>,
  reasonStale: 'The clone has expired; clone it again in the voice library',
  reasonMissing: 'Not cloned with this provider yet',
  reasonNoConsent: 'No consent statement from the speaker, so it won’t be uploaded to the provider',
  reasonRemoved: 'This voice is no longer in the library',
  reasonServiceClient: 'External service callers can’t use voices from the library',
  codeCloneRequired: 'No valid clone with this provider',
  codeNotFound: 'Voice not found',
  warning: {
    DUB_SEPARATION_NOT_CONFIGURED: 'Background not separated',
    DUB_UNITS_STALE: 'Out-of-date translations not synthesized',
    DUB_UNITS_OVERLONG: 'Some lines are too long to fit',
    DUB_UNITS_OFF_TIMELINE: 'Some original lines are no longer on the timeline',
    DUB_MUTED_UNVOICED: 'Original audio was also muted for lines that weren’t synthesized',
    DUB_BACKGROUND_MUTED: 'Background audio was muted too',
    DUB_VOICE_UNAVAILABLE: 'Some speakers’ voices are unavailable',
  } as Record<string, string>,
  separated: 'Background separated',
  separationNotConfigured: 'Separation was requested but no separation capability is set up: skipped, original audio left as is',
  notSeparated: 'Background not separated',
  originalMuted: 'Original audio muted',
  originalKept: 'Original audio unchanged',
  originalDucked: (db: number | null) => (db ? `Original audio lowered by ${db} dB while the voice-over plays` : 'Original audio lowered while the voice-over plays'),
};
export type DubProgressMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

const UNIT_LABEL: Record<DubUnitKey, string> = live(() => M.unit);

/** Where each sentence ends up on the receipt, depending on whether it fits. Only the groups that have sentences are listed, with placed ones first. */
export function dubUnitRows(summary: Pick<DubSummary, 'units'>): DubUnitRow[] {
  const u = summary.units;
  const fit = Math.max(0, u.placed - u.tempo - u.extended);
  const rows: DubUnitRow[] = [
    { key: 'fit', label: UNIT_LABEL.fit, count: fit, placed: true },
    { key: 'tempo', label: UNIT_LABEL.tempo, count: u.tempo, placed: true },
    { key: 'extended', label: UNIT_LABEL.extended, count: u.extended, placed: true },
    { key: 'overlong', label: UNIT_LABEL.overlong, count: u.overlong, placed: false },
    { key: 'stale', label: UNIT_LABEL.stale, count: u.stale, placed: false },
    { key: 'offTimeline', label: UNIT_LABEL.offTimeline, count: u.offTimeline, placed: false },
    { key: 'voiceUnavailable', label: UNIT_LABEL.voiceUnavailable, count: u.voiceUnavailable, placed: false },
  ];
  return rows.filter((row) => row.count > 0);
}

/** Reasons a voice is unavailable (the Runtime's error codes and reasons such as `stale` and `missing`). */
export function voiceReasonText(code: string, reason: string): string {
  switch (reason) {
    case 'stale':
      return M.reasonStale;
    case 'missing':
      return M.reasonMissing;
    case 'no-consent':
      return M.reasonNoConsent;
    case 'removed':
      return M.reasonRemoved;
    case 'service-client':
      return M.reasonServiceClient;
  }
  switch (code) {
    case 'VOICE_CLONE_REQUIRED':
      return M.codeCloneRequired;
    case 'VOICE_CONSENT_REQUIRED':
      return M.reasonNoConsent;
    case 'VOICE_NOT_FOUND':
      return M.codeNotFound;
    default:
      return code;
  }
}

export interface VoiceFailure {
  speakerId: string;
  voice: string;
  code: string;
  reason: string;
  units: Id[];
}

type UnavailableUnit = DubSummary['voiceUnavailableUnits'][number];

/** Groups the sentences whose voice is unavailable by speaker (this speaker's sentences were not synthesized): one line per speaker, in order of first appearance. */
export function voiceFailures(units: readonly UnavailableUnit[]): VoiceFailure[] {
  const out = new Map<string, VoiceFailure>();
  for (const u of units) {
    const row = out.get(u.speakerId) ?? { speakerId: u.speakerId, voice: u.voice, code: u.code, reason: u.reason, units: [] };
    row.units.push(u.unitId);
    out.set(u.speakerId, row);
  }
  return [...out.values()];
}

export interface DubFailureFacts {
  /** All sentences' speaker voices are unavailable (the failed `details.unavailable`). */
  unavailable: VoiceFailure[];
  /** Sentences that failed synthesis (`details.failed` of `DUB_SYNTHESIS_FAILED`). */
  failed: Array<{ unitId: Id; code: string; message: string }>;
  /** The number of sentences still left after stopping, which were already synthesized. */
  synthesized: number | null;
  remaining: number | null;
}

/** The per-sentence facts the Runtime gives for a failed task: which sentences were not synthesized and why. Empty when there are none. */
export function dubFailureFacts(job: Pick<JobRecord, 'error'>): DubFailureFacts {
  const details = isObject(job.error?.details) ? job.error.details : {};
  const unavailable = Array.isArray(details.unavailable)
    ? details.unavailable.filter(
        (u): u is UnavailableUnit => isObject(u) && typeof u.unitId === 'string' && typeof u.speakerId === 'string' && typeof u.voice === 'string',
      )
    : [];
  const failed = Array.isArray(details.failed)
    ? details.failed
        .filter((f): f is Json => isObject(f) && typeof f.unitId === 'string')
        .map((f) => ({ unitId: f.unitId as Id, code: str(f.code) ?? 'INTERNAL', message: str(f.message) ?? '' }))
    : [];
  return {
    unavailable: voiceFailures(unavailable.map((u) => ({ ...u, code: str(u.code) ?? 'VOICE_UNAVAILABLE', reason: str(u.reason) ?? 'invalid' }))),
    failed,
    synthesized: typeof details.synthesized === 'number' ? details.synthesized : null,
    remaining: typeof details.remaining === 'number' ? details.remaining : null,
  };
}

const WARNING_TITLE: Record<string, string> = live(() => M.warning);

/** Warnings on the task (one per code): the title and the Runtime's original words. */
export function dubWarnings(job: Pick<JobRecord, 'warnings'>): Array<{ code: string; title: string; detail: string }> {
  const seen = new Set<string>();
  const out: Array<{ code: string; title: string; detail: string }> = [];
  for (const w of job.warnings) {
    if (seen.has(w.code)) continue;
    seen.add(w.code);
    out.push({ code: w.code, title: WARNING_TITLE[w.code] ?? w.code, detail: localizeText(w.detail, w.detailRef) ?? '' });
  }
  return out;
}

/** The result of separating vocals from background, reported as it is. */
export function separationText(separation: DubSummary['separation']): string {
  switch (separation) {
    case 'completed':
      return M.separated;
    case 'not-configured':
      return M.separationNotConfigured;
    default:
      return M.notSeparated;
  }
}

/** What was done with the original audio. */
export function originalAudioText(mode: DubSummary['originalAudio'], duckDb: number | null): string {
  if (mode === 'mute') return M.originalMuted;
  if (mode === 'keep') return M.originalKept;
  return M.originalDucked(duckDb);
}

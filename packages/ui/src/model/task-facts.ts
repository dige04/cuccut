import {
  defineMessages,
  type CapabilityNotConfiguredDetails,
  type GeneratedOutput,
  type JobCancellation,
  type JobKind,
  type JobRecord,
  type ModelServiceCapability,
  type TaskSummary,
} from '@cuccut/protocol';
import { TASK_VIEW_COPY } from '../copy.ts';
import type { ModelCategory, ModelPage } from './settings-nav.ts';
import { runsOnLabel, type TaskRow } from './task-list.ts';
import { agoLabel, formatClock } from './format.ts';
import { zhHans } from './task-facts.zh-Hans.ts';
import { zhHant } from './task-facts.zh-Hant.ts';
import { ja } from './task-facts.ja.ts';
import { ko } from './task-facts.ko.ts';
import { es } from './task-facts.es.ts';
import { fr } from './task-facts.fr.ts';
import { de } from './task-facts.de.ts';
import { nl } from './task-facts.nl.ts';
import { ptBR } from './task-facts.pt-BR.ts';
import { it } from './task-facts.it.ts';
import { ru } from './task-facts.ru.ts';
import { pl } from './task-facts.pl.ts';
import { tr } from './task-facts.tr.ts';
import { vi } from './task-facts.vi.ts';
import { remedyHintText } from './localized-text.ts';

/** Row names of the “详情” (Details) table, and the row for the image generation request (translations are in `task-facts.<语言>.ts`). */
const en = {
  fact: {
    kind: 'Type',
    submitter: 'Started by',
    status: 'Status',
    startedAt: 'Started',
    runsOn: 'Runs on',
    language: 'Language',
    phase: 'Phase',
    images: 'Images',
    took: 'Time taken',
    cost: 'Cost',
  },
  imageCount: (count: number) => `${count} ${count === 1 ? 'image' : 'images'}`,
};
export type TaskFactsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Task detail facts (prototype model-task-facts.js): the “详情” (Details) table, the remedy destinations for the error card, and the output rows.
 * Only rows with real data are produced; a missing value is not filled with a placeholder. Items that have no backend in the prototype (cost, call records, row count, frames and speed, estimated time remaining) are not produced.
 */

/** `42s` / `12m 40s` / `1h 5m` (prototype `took`). */
export function took(ms: number): string {
  const seconds = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** `612 MB` / `1.5 GB` / `500 KB`, carrying at 1024 (prototype `fmtSize`). */
export function fmtSize(bytes: number): string {
  const mb = (bytes || 0) / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`;
}

export type FactRow = [label: string, value: string];

/** `12 s`; from one minute on, the same as `took` (prototype `secs`). */
export function secs(ms: number): string {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return s < 60 ? `${s} s` : took(ms);
}

/**
 * Status cell of the “详情” (Details) table (prototype `statusLabel`): a running task shows “进行中” (“In progress”), with the stage and percentage shown in the progress bar and in the “阶段” (Stage) cell;
 * tasks waiting for approval, stopping, or already ended are shown as their chip shows them.
 */
function factStatus(row: TaskRow): string {
  if (row.queued) return TASK_VIEW_COPY.queued;
  if (row.waiting) return row.label;
  // Running tasks that can be stopped or cancelled; a task that is stopping has no action to take, so it shows “正在停止” (“Stopping”) as its chip does.
  if (row.live && row.action) return TASK_VIEW_COPY.running;
  return row.label;
}

function submitterLabel(job: JobRecord): string {
  switch (job.submitter.kind) {
    case 'agent':
      return TASK_VIEW_COPY.byAgent;
    case 'connection':
      return TASK_VIEW_COPY.byCli;
    case 'node':
      return TASK_VIEW_COPY.byNode;
    default:
      return TASK_VIEW_COPY.byApp;
  }
}

/**
 * “详情” (Details) row `[label, value]` (prototype `details`): type, initiator, status, started at, running on, language, stage, image, duration.
 * Duration: for ended tasks it is computed from the end time; for running tasks it is computed live from `now`; for tasks still queued it is not written.
 */
export function taskFacts(row: TaskRow, source: { job?: JobRecord; task?: TaskSummary }, now: number): FactRow[] {
  const rows: FactRow[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value != null && value !== '') rows.push([label, value]);
  };
  const job = source.job;
  const F = M.fact;
  add(F.kind, row.kindText);
  add(F.submitter, job ? submitterLabel(job) : TASK_VIEW_COPY.byAgent);
  add(F.status, factStatus(row));
  add(F.startedAt, agoLabel(row.startedAt, now));
  if (job) {
    add(F.runsOn, runsOnLabel(job.providerId));
    if (job.generation?.capability === 'synthesizeSpeech') add(F.language, job.generation.language);
    if (row.phase) add(F.phase, row.phase);
    if (job.generation?.capability === 'generateImage') {
      add(F.images, `${job.result?.outputs?.length ?? 0}/${job.generation.count}`);
    }
    if (job.startedAt) add(F.took, took((job.endedAt ? Date.parse(job.endedAt) : now) - Date.parse(job.startedAt)));
    if (job.cancellation) add(F.cost, cancellationCost(job.cancellation));
  } else {
    add(F.took, took((row.endedAt ? Date.parse(row.endedAt) : now) - Date.parse(row.startedAt)));
  }
  return rows;
}

/**
 * The honest note about cost after cancellation (architecture design §7.4): if the provider does not support cancellation, the request may still complete on the remote side. Nothing is written when nothing was sent out (null).
 */
export function cancellationCost(cancellation: Pick<JobCancellation, 'remote' | 'cost'>): string | null {
  if (cancellation.cost === 'none') return null;
  if (cancellation.cost === 'charged') return TASK_VIEW_COPY.costCharged;
  if (cancellation.remote === 'cancel-unsupported') return TASK_VIEW_COPY.costCancelUnsupported;
  if (cancellation.remote === 'unknown') return TASK_VIEW_COPY.costUnknown;
  return TASK_VIEW_COPY.costPossible;
}

/** Remedy destinations: same shape as the shell's routes (the `models` category and page, Settings › Agent, and services). */
export type RemedyTarget =
  | { tab: 'models'; category: ModelCategory; page?: ModelPage }
  | { tab: 'settings'; section: 'agent' }
  | { tab: 'services'; service: 'remote' }
  | { tab: 'tasks'; taskId: string };

export interface Remedy {
  label: string;
  target: RemedyTarget;
  /** A sentence stating that this is a configuration problem; for `CAPABILITY_NOT_CONFIGURED`, its own hint is used. */
  hint: string;
}

const CAPABILITY_CATEGORY: Record<ModelServiceCapability, ModelCategory> = {
  transcribe: 'asr',
  synthesizeSpeech: 'tts',
  generateImage: 'image',
  generateText: 'llm',
  separateAudio: 'sep',
  generateMusic: 'music',
};

/** The capability category a model task belongs to; export, fixed pipelines, installation and the like are not model tasks and have none. */
function jobCategory(kind: JobKind): ModelCategory | undefined {
  return (CAPABILITY_CATEGORY as Partial<Record<JobKind, ModelCategory>>)[kind];
}

function isCapabilityNotConfigured(details: unknown): details is CapabilityNotConfiguredDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { code?: unknown }).code === 'CAPABILITY_NOT_CONFIGURED' &&
    typeof (details as { remedy?: unknown }).remedy === 'object'
  );
}

/**
 * Where a failed Job is remedied: `CAPABILITY_NOT_CONFIGURED` follows `remedy.action` (by contract it is rejected at submission and no Job is created; it is read defensively here),
 * other errors follow the error code: credential problems go to cloud models, model package problems go to local models. Other errors have no definite destination, so no button is shown.
 */
export function jobRemedy(job: Pick<JobRecord, 'kind' | 'providerId' | 'error'>): Remedy | null {
  const error = job.error;
  if (!error) return null;
  const configHint = TASK_VIEW_COPY.configHint;
  if (isCapabilityNotConfigured(error.details)) {
    const { remedy } = error.details;
    const category = CAPABILITY_CATEGORY[remedy.capability] ?? jobCategory(job.kind);
    const hint = remedyHintText(remedy) || configHint;
    const providerId = remedy.providerId ?? error.details.providerId ?? '';
    switch (remedy.action) {
      case 'install-model':
        return { label: TASK_VIEW_COPY.remedyInstall, target: { tab: 'models', category, page: 'local' }, hint };
      case 'configure-provider':
      case 'enable-provider':
        if (providerId.startsWith('agent:')) return { label: TASK_VIEW_COPY.remedyAgent, target: { tab: 'settings', section: 'agent' }, hint };
        return { label: TASK_VIEW_COPY.remedyCloud, target: { tab: 'models', category, page: 'cloud' }, hint };
      case 'set-default':
        return { label: TASK_VIEW_COPY.remedyDefault, target: { tab: 'models', category }, hint };
      case 'pair-node':
        return { label: TASK_VIEW_COPY.remedyNode, target: { tab: 'services', service: 'remote' }, hint };
      case 'setup-agent':
        return { label: TASK_VIEW_COPY.remedyAgent, target: { tab: 'settings', section: 'agent' }, hint };
      default:
        return null;
    }
  }
  const category = jobCategory(job.kind);
  if (!category) return null;
  if (error.code === 'PROVIDER_AUTH_FAILED' || error.code === 'API_KEY_INVALID') {
    if (job.providerId.startsWith('agent:')) return { label: TASK_VIEW_COPY.remedyAgent, target: { tab: 'settings', section: 'agent' }, hint: configHint };
    return { label: TASK_VIEW_COPY.remedyCloud, target: { tab: 'models', category, page: 'cloud' }, hint: configHint };
  }
  if ((error.code === 'MODEL_LOAD_FAILED' || error.code === 'MODEL_NOT_READY') && job.providerId === 'local') {
    return { label: TASK_VIEW_COPY.remedyInstall, target: { tab: 'models', category, page: 'local' }, hint: configHint };
  }
  return null;
}

/**
 * Rejected at submission without a Job being created (`CAPABILITY_NOT_CONFIGURED` in the details of the RPC error): the destination is likewise given by `remedy.action`.
 * Other rejections have no definite destination (null).
 */
export function rejectionRemedy(kind: JobKind, error: unknown): Remedy | null {
  const details = (error as { details?: unknown } | null)?.details;
  if (!isCapabilityNotConfigured(details)) return null;
  const message = error instanceof Error ? error.message : String(error);
  return jobRemedy({ kind, providerId: details.providerId ?? '', error: { code: details.code, message, details } });
}

export interface OutputRow {
  key: string;
  kind: 'image' | 'audio' | 'document';
  name: string;
  /** `768×1344 · 1.2 MB`, `0:12 · 48 kHz · 1.2 MB`; a transcript is a single explanatory sentence. */
  meta: string;
  /** Outputs that can be opened via `artifacts.openHandle`; a transcript is written into the video and has no separate file to open. */
  artifactId: string | null;
  mediaType: string | null;
  /** The imported video becomes a media asset. */
  imported: boolean;
  /** Files written to disk (exports): the full path, used by “在文件夹中显示” (“Show in folder”); outputs that exist only in the artifact library have none. */
  path: string | null;
}

const basename = (file: string) => file.split(/[\\/]/).pop() || file;

function outputRow(output: GeneratedOutput, index: number): OutputRow {
  const size = fmtSize(output.byteLength);
  if (output.media.kind === 'image') {
    return {
      key: output.artifactId,
      kind: 'image',
      name: TASK_VIEW_COPY.imageName(index + 1),
      meta: [`${output.media.width}×${output.media.height}`, size].join(' · '),
      artifactId: output.artifactId,
      mediaType: output.mediaType,
      imported: output.assetId !== null,
      path: output.path ?? null,
    };
  }
  if (output.media.kind !== 'audio') {
    const media = output.media;
    const meta =
      media.kind === 'video'
        ? [`${media.width}×${media.height}`, formatClock(media.durationSec), size]
        : media.kind === 'text'
          ? [TASK_VIEW_COPY.entries(media.entries), size]
          : media.kind === 'package'
            ? [TASK_VIEW_COPY.packageFiles(media.files), size]
            : media.kind === 'project'
              ? [TASK_VIEW_COPY.projectClips(media.clips), formatClock(media.durationSec), size]
              : [size];
    return {
      key: output.artifactId,
      kind: 'document',
      // The file exported to disk uses its actual file name (including any index the Runtime added to avoid a name clash).
      name: output.path ? basename(output.path) : media.kind === 'video' ? TASK_VIEW_COPY.videoName(index + 1) : TASK_VIEW_COPY.fileName(index + 1),
      meta: meta.join(' · '),
      // Portable packages do not go into the artifact library (`artifactId` is only the digest of the package file); they cannot be opened, only shown in the folder.
      artifactId: media.kind === 'package' ? null : output.artifactId,
      mediaType: output.mediaType,
      imported: false,
      path: output.path ?? null,
    };
  }
  return {
    key: output.artifactId,
    kind: 'audio',
    name: output.path ? basename(output.path) : TASK_VIEW_COPY.audioName(index + 1),
    meta: [formatClock(output.media.durationSec), `${Math.round(output.media.sampleRate / 100) / 10} kHz`, size].join(' · '),
    artifactId: output.artifactId,
    mediaType: output.mediaType,
    imported: output.assetId !== null,
    path: output.path ?? null,
  };
}

/** Output rows: each output of a generation task; a transcript written into the video is described in one sentence, and the raw result (JSON) is not listed. */
export function jobOutputs(job: Pick<JobRecord, 'result'>): OutputRow[] {
  const result = job.result;
  if (!result) return [];
  if (result.outputs?.length) return result.outputs.map(outputRow);
  if (result.documentId) {
    return [
      {
        key: result.documentId,
        kind: 'document',
        name: TASK_VIEW_COPY.documentName,
        meta: TASK_VIEW_COPY.documentWritten,
        artifactId: null,
        mediaType: null,
        imported: true,
        path: null,
      },
    ];
  }
  return [];
}

/** The request row for an image generation task (prototype `imageMeta`): `model · aspect ratio · N images · duration`. null when there are no frozen parameters. */
export function imageRequest(job: JobRecord, now: number): { prompt: string; meta: string } | null {
  const g = job.generation;
  if (g?.capability !== 'generateImage') return null;
  const elapsed = job.startedAt && job.state !== 'queued' ? (job.endedAt ? Date.parse(job.endedAt) : now) - Date.parse(job.startedAt) : null;
  const meta = [job.modelId, g.aspectRatio ?? g.size, g.count > 0 ? M.imageCount(g.count) : null, elapsed != null ? secs(elapsed) : null]
    .filter(Boolean)
    .join(' · ');
  return { prompt: g.prompt, meta };
}

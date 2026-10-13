import {
  defineMessages,
  intlLocale,
  live,
  localizeText,
  type ExportKind,
  type ExportSettings,
  type GeneratedOutput,
  type Id,
  type JobRecord,
} from '@cuccut/protocol';
import { JOB_PHASE_LABEL } from '../copy.ts';
import { jobWaitText } from './localized-text.ts';
import type { ExportSpeed } from './export-speed.ts';
import { formatClock } from './format.ts';
import { fmtSize } from './task-facts.ts';
import { jobLive, jobPercent, jobRetrying } from './task-list.ts';
import { zhHans } from './export-job.zh-Hans.ts';
import { zhHant } from './export-job.zh-Hant.ts';
import { ja } from './export-job.ja.ts';
import { ko } from './export-job.ko.ts';
import { es } from './export-job.es.ts';
import { fr } from './export-job.fr.ts';
import { de } from './export-job.de.ts';
import { nl } from './export-job.nl.ts';
import { ptBR } from './export-job.pt-BR.ts';
import { it } from './export-job.it.ts';
import { ru } from './export-job.ru.ts';
import { pl } from './export-job.pl.ts';
import { tr } from './export-job.tr.ts';
import { vi } from './export-job.vi.ts';

/** Exports from internal checks keep a background job record but are not delivered as session output. Old records are still shown as usual. */
export function isPreviewExport(job: JobRecord): boolean {
  return job.kind === 'export' && job.export?.settings.purpose === 'preview';
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Export job copy (English is the source of keys and types; translations are in `export-job.zh-Hans.ts`). */
const en = {
  tabVideo: 'Video',
  tabAudio: 'Audio',
  tabSubtitles: 'Subtitles',
  tabTranscript: 'Transcript',
  tabProject: 'Project file',
  export: 'Export',
  queued: 'Export queued',
  exporting: 'Exporting…',
  exportingPct: (pct: number) => `Exporting · ${pct}%`,
  formats: { md: 'Markdown', txt: 'Plain text', xmeml: 'FCP7 XML' } as Record<string, string>,
  titleVideo: (format: string) => `Export video · ${format}`,
  titleAudio: (format: string) => `Export audio · ${format}`,
  titleSubtitles: (format: string) => `Export subtitles · ${format}`,
  titleTranscript: (format: string) => `Export transcript · ${format}`,
  titlePortable: 'Export portable package',
  titleProject: (format: string) => `Export project file · ${format}`,
  generating: {
    video: 'Encoding',
    audio: 'Mixing',
    subtitles: 'Writing files',
    transcript: 'Writing files',
    portable: 'Packaging',
    project: 'Writing project file',
  } as Record<ExportKind, string>,
  retrying: 'Retrying automatically after an error',
  saving: 'Saving files',
  framesOf: (done: string, total: string) => `Rendered ${done} / ${total} frames`,
  frames: (done: string) => `Rendered ${done} frames`,
  secondsOf: (done: string, total: string) => `Processed ${done} / ${total}`,
  seconds: (done: string) => `Processed ${done}`,
  outputsOf: (done: number, total: number) => `Wrote ${done} / ${total} ${total === 1 ? 'file' : 'files'}`,
  outputs: (done: number) => `Wrote ${plural(done, 'file', 'files')}`,
  bytesOf: (done: string, total: string) => `Packaged ${done} / ${total}`,
  bytes: (done: string) => `Packaged ${done}`,
  fps: (n: string) => `${n} fps`,
  timeLeft: (clock: string) => `${clock} left`,
  mono: 'Mono',
  stereo: 'Stereo',
  entries: (n: number) => plural(n, 'entry', 'entries'),
  files: (n: number) => plural(n, 'file', 'files'),
  assetRevisions: (n: number) => plural(n, 'asset version', 'asset versions'),
  missing: (n: number) => `${n} missing`,
  clips: (n: number) => plural(n, 'clip', 'clips'),
  omitted: (n: number) => `${plural(n, 'item', 'items')} not written to the project file`,
  doneMany: (n: number, total: string) => `${plural(n, 'file', 'files')} · ${total} total`,
  cancelledKept: (n: number) => `${n === 1 ? 'The saved file is' : `The ${n} saved files are`} kept · The video itself is unaffected`,
  cancelledRemoved: 'Unfinished files were deleted · The video itself is unaffected',
};
export type ExportJobMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * How an export job (a JobRecord with `kind: 'export'`) reads in the UI (the running / done / cancelled states in the design draft's export.jsx, architecture design §9.11):
 * the top-bar button, the popover and the background job all read the same record. Progress reads only the `progress` the Runtime reports; when there is no total, no percentage is read out;
 * speed (fps) and estimated time remaining are computed by the UI from the progress of the last few seconds (`export-speed.ts`), and are left out when they cannot be computed.
 */

export type ExportTab = 'video' | 'audio' | 'subtitles' | 'transcript' | 'project';

export const EXPORT_TABS: readonly { key: ExportTab; label: string }[] = [
  {
    key: 'video',
    get label() {
      return M.tabVideo;
    },
  },
  {
    key: 'audio',
    get label() {
      return M.tabAudio;
    },
  },
  {
    key: 'subtitles',
    get label() {
      return M.tabSubtitles;
    },
  },
  {
    key: 'transcript',
    get label() {
      return M.tabTranscript;
    },
  },
  {
    key: 'project',
    get label() {
      return M.tabProject;
    },
  },
];

/** Which page each export kind belongs to: portable packages and projects are both on the “Project” page. */
export function tabOfKind(kind: ExportKind): ExportTab {
  return kind === 'portable' || kind === 'project' ? 'project' : kind;
}

const newestFirst = (a: JobRecord, b: JobRecord) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.jobId.localeCompare(a.jobId);

/** Export jobs for this video; newer ones come first. */
export function videoExports(jobs: readonly JobRecord[], videoId: Id): JobRecord[] {
  return jobs.filter((j) => j.kind === 'export' && j.videoId === videoId).sort(newestFirst);
}

/** The most recent export for this video that has not yet finished (regardless of who submitted it: the app, an agent, or the command line). */
export function latestLiveExport(jobs: readonly JobRecord[], videoId: Id): JobRecord | null {
  return videoExports(jobs, videoId).find(jobLive) ?? null;
}

/** Top-bar button text: when not exporting it is “导出” (Export); while exporting, “导出中 · 31%” (Exporting · 31%); with no total, “导出中…” (Exporting…); when queued, “导出排队中” (Export queued). */
export function exportButtonLabel(job: JobRecord | null): string {
  if (!job) return M.export;
  if (job.state === 'queued') return M.queued;
  const pct = job.state === 'running' ? jobPercent(job) : null;
  return pct == null ? M.exporting : M.exportingPct(pct);
}

export type ExportView = 'run' | 'done' | 'cancelled' | 'failed' | 'interrupted';

export function exportView(job: JobRecord): ExportView {
  if (jobLive(job)) return 'run';
  switch (job.state) {
    case 'completed':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    case 'interrupted':
      return 'interrupted';
    default:
      return 'failed';
  }
}

const FORMAT_LABEL: Record<string, string> = live(() => M.formats);
const formatLabel = (format: string) => FORMAT_LABEL[format] ?? format.toUpperCase();

/** “导出视频 · MP4” (Export video · MP4), “导出字幕 · SRT” (Export subtitles · SRT), “导出便携包” (Export portable package). */
export function exportTitle(settings: ExportSettings): string {
  switch (settings.kind) {
    case 'video':
      return M.titleVideo(formatLabel(settings.format));
    case 'audio':
      return M.titleAudio(formatLabel(settings.format));
    case 'subtitles':
      return M.titleSubtitles(formatLabel(settings.format));
    case 'transcript':
      return M.titleTranscript(formatLabel(settings.format));
    case 'portable':
      return M.titlePortable;
    case 'project':
      return M.titleProject(formatLabel(settings.format));
  }
}

const GENERATING: Record<ExportKind, string> = live(() => M.generating);

/** Stages: the generation step is named by kind (encoding, mixing, packaging, ...); validation and saving use the common wording. */
export function exportPhaseLabel(job: Pick<JobRecord, 'state' | 'endedAt' | 'phase' | 'export' | 'wait'>): string {
  // While queued, say what it is waiting for as recorded by the Runtime (a concurrency slot or machine resources; architecture design §7.6).
  if (job.state === 'queued') return jobWaitText(job.wait) ?? JOB_PHASE_LABEL.queued;
  if (jobRetrying(job)) return M.retrying;
  if (job.phase === 'generating' && job.export) return GENERATING[job.export.settings.kind];
  if (job.phase === 'publishing') return M.saving;
  return JOB_PHASE_LABEL[job.phase];
}

/** Progress facts: 1,200 / 3,600 frames drawn; 0:40 / 3:00 processed (audio: mixing, including the master when loudness normalization is on); 1 / 3 files written; 120 MB / 1.2 GB packaged. */
export function exportProgressLine(job: Pick<JobRecord, 'progress' | 'state'>): string | null {
  const p = job.progress;
  if (!p || job.state !== 'running') return null;
  const number = new Intl.NumberFormat(intlLocale());
  const n = (v: number) => number.format(Math.floor(v));
  switch (p.unit) {
    case 'frames':
      return p.total != null ? M.framesOf(n(p.done), n(p.total)) : M.frames(n(p.done));
    case 'seconds':
      return p.total != null ? M.secondsOf(formatClock(p.done), formatClock(p.total)) : M.seconds(formatClock(p.done));
    case 'outputs':
      return p.total != null ? M.outputsOf(p.done, p.total) : M.outputs(p.done);
    case 'bytes':
      return p.total != null ? M.bytesOf(fmtSize(p.done), fmtSize(p.total)) : M.bytes(fmtSize(p.done));
    default:
      return null;
  }
}

/** Estimated time remaining: “剩余 1:23” (1:23 left), or “剩余 1:02:03” (1:02:03 left) when over an hour. null when it cannot be computed. */
export function exportTimeLeft(speed: ExportSpeed | null): string | null {
  return speed ? M.timeLeft(formatClock(Math.ceil(speed.secondsLeft))) : null;
}

/** Speed and estimated time remaining: “58 fps”, “剩余 1:23” (1:23 left); when the progress unit is not frames, only the remaining time is shown. Empty when it cannot be computed. */
export function exportSpeedParts(speed: ExportSpeed | null): string[] {
  if (!speed) return [];
  const parts: string[] = [];
  if (speed.fps != null) parts.push(M.fps(new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: speed.fps < 10 ? 1 : 0 }).format(speed.fps)));
  parts.push(exportTimeLeft(speed)!);
  return parts;
}

const basename = (file: string) => file.split(/[\\/]/).pop() || file;

/** The file being written: the name set at submission (if the name clashes at publish time a number is appended; the path after completion is authoritative). */
export function exportPlannedFiles(job: Pick<JobRecord, 'export'>): string[] {
  return job.export?.destination.files ?? [];
}

export interface ExportOutputFact {
  key: string;
  name: string;
  path: string | null;
  /** “1920×1080 · 3:26 · 84 MB”, “312 条 · 18 KB” (312 entries · 18 KB). */
  meta: string;
}

function outputMeta(output: GeneratedOutput): string {
  const size = fmtSize(output.byteLength);
  const m = output.media;
  switch (m.kind) {
    case 'video':
      return [`${m.width}×${m.height}`, formatClock(m.durationSec), size].join(' · ');
    case 'audio':
      return [formatClock(m.durationSec), `${Math.round(m.sampleRate / 100) / 10} kHz`, m.channels === 1 ? M.mono : M.stereo, size].join(' · ');
    case 'text':
      return [M.entries(m.entries), size].join(' · ');
    case 'package':
      return [M.files(m.files), M.assetRevisions(m.assets), ...(m.missingAssets ? [M.missing(m.missingAssets)] : []), size].join(' · ');
    case 'project':
      return [M.clips(m.clips), ...(m.omitted ? [M.omitted(m.omitted)] : []), size].join(' · ');
    default:
      return size;
  }
}

/** Files already published (completed, or failed but partly published): file names use the actual path, and any number appended to avoid a clash is included. */
export function exportOutputs(job: Pick<JobRecord, 'result'>): ExportOutputFact[] {
  return (job.result?.outputs ?? []).map((o, i) => ({
    key: `${o.artifactId}:${i}`,
    name: o.path ? basename(o.path) : o.artifactId,
    path: o.path ?? null,
    meta: outputMeta(o),
  }));
}

/** The directory the export is in (“在文件夹中显示” (Show in folder) opens the directory when there is no file). */
export function exportDir(job: Pick<JobRecord, 'export'>): string | null {
  return job.export?.destination.dir ?? null;
}

/** The one-line completed state: “访谈.mp4 · 84 MB”; for several files, “3 个文件 · 共 120 MB” (3 files · 120 MB total). */
export function exportDoneLine(job: Pick<JobRecord, 'result'>): string {
  const outputs = job.result?.outputs ?? [];
  if (!outputs.length) return '';
  const total = fmtSize(outputs.reduce((sum, o) => sum + o.byteLength, 0));
  return outputs.length === 1 ? `${basename(outputs[0]!.path ?? outputs[0]!.artifactId)} · ${total}` : M.doneMany(outputs.length, total);
}

/** Cancel result: cancellation takes effect only before file saving begins; any unfinished file is deleted along with it. */
export function cancelledLine(job: Pick<JobRecord, 'result'>): string {
  const saved = job.result?.outputs?.length ?? 0;
  return saved ? M.cancelledKept(saved) : M.cancelledRemoved;
}

/** Cancel has been clicked but has not yet stopped (once file saving has started, it no longer stops midway). */
export function cancelPending(job: Pick<JobRecord, 'cancellation' | 'state' | 'endedAt'>): boolean {
  return !!job.cancellation && jobLive(job);
}

/** Warnings: listed one by one (skipped content, objects not written into the project, loudness that cannot be measured, ...); identical code and message are kept only once. */
export function exportWarnings(job: Pick<JobRecord, 'warnings'>): string[] {
  return [...new Set(job.warnings.map((w) => localizeText(w.detail, w.detailRef) ?? w.code))];
}

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_LOUDNESS_TARGET,
  PACKAGE_EXTENSION,
  RpcError,
  SUPPORTED_EXPORT_KINDS,
  burnedCaptionLanguages,
  nowIso,
  refOf,
  transcriptStamp,
  type CaptionItem,
  type ExportCreateRequest,
  type ExportFontFace,
  type ExportRange,
  type ExportRenderTextRequest,
  type ExportRenderTextResult,
  type ExportSettings,
  type ExportSnapshot,
  type FontFaceQuery,
  type GeneratedOutput,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type JobWarning,
  type Localized,
  type MessageRef,
  type PackageManifest,
  type RenderedTextOutput,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { RcCommon, RcExport, RcPackage } from '@cuccut/protocol/messages/runtime-core';
import {
  TaskFailure,
  audioExportDemand,
  canonicalJson,
  sha256Hex,
  videoExportDemand,
  type ArtifactExtension,
  type JobManager,
  type TaskResources,
  type TaskRun,
} from '@cuccut/jobs';
import type { Logger } from '@cuccut/harness';
import { ffmpegMissingRemedy } from '@cuccut/process-host';
import { localizedOf, taskFailure } from '../localized.ts';
import type { VideoService } from '../videos/video-service.ts';
import {
  AudioValidationError,
  DEFAULT_BITRATE_KBPS,
  DEFAULT_CHANNELS,
  DEFAULT_SAMPLE_RATE,
  ToolFailure,
  missingAudioTools,
  renderAudio,
  type AudioOutputSettings,
  type ToolCommand,
} from './audio-export.ts';
import type { AudioPlanResult, PlannedAsset, PlannedDocument, TextPlan, TextPlanResult } from './export-plan.ts';
import {
  DestinationError,
  checkFixedName,
  hiddenTemp,
  prepareDirectory,
  publishFile,
  publishInPlace,
  safeFileStem,
  sourceRoot,
  withExtension,
} from './export-publish.ts';
import { checkText, renderText, type FrontMatter, type TextChapter, type TextExportOutput } from './text-export.ts';
import { sourceChapters, sourcePlan } from './text-source.ts';
import {
  DEFAULT_VIDEO_AUDIO_KBPS,
  WorkerFailure,
  checkVideo,
  masterRunner,
  probeVideo,
  runWorker,
  skippedWarning,
  workerInput,
  type UnsupportedItem,
  type VideoOutput,
  type VideoPlanResult,
  type WorkerEvent,
} from './video-export.ts';
import { audioItemSelection } from './audio-source.ts';
import { readPackage } from './package-reader.ts';
import {
  PackageAssetChanged,
  checkSpace,
  localRoots,
  planPortable,
  sha256OfFile,
  writePortable,
  type PackageFreeze,
} from './portable-export.ts';
import { renderXmeml } from './project-export.ts';
import { FALLBACK_FONT_FAMILY } from '../fonts/bundled-fonts.ts';
import { queryKey, type ExportFacePlan, type FontService } from '../fonts/font-service.ts';

/**
 * Export service (architecture design §9.11, §9.13): `exports.create` freezes and preflights before submission, and creates no task on failure; after passing, it saves the frozen snapshot as a JSON artifact and hands it to the JobManager for queuing. The task generates each output in staging and verifies it, and after the cancellation check, each output is published on its own (copied to the target directory, hard-linked to the final name, registered as an artifact). Partial failures are reported as they happened.
 *
 * Preflight errors go in `RpcError.details.code` (command and protocol spec §11.4): `EXPORT_KIND_UNSUPPORTED`, `EXPORT_RANGE_EMPTY`,
 * `EXPORT_SOURCE_NOT_FOUND`, `EXPORT_SOURCE_AMBIGUOUS`, `EXPORT_SOURCE_UNSUPPORTED`, `EXPORT_SOURCE_UNPLACED`,
 * `EXPORT_NOTHING_TO_EXPORT`, `EXPORT_DESTINATION_EXISTS`, `EXPORT_DESTINATION_UNWRITABLE`, `EXPORT_TOOL_MISSING`,
 * `ASSET_MISSING`, `ASSET_CHANGED`.
 */

export interface ExportServiceOptions {
  jobs: JobManager;
  videos: VideoService;
  ffmpeg: () => Promise<ToolCommand>;
  ffprobe: () => Promise<ToolCommand>;
  /** The executable for the Render Worker (`export-worker`); null when not found, in which case finished-video export is rejected with `EXPORT_TOOL_MISSING`. */
  exportWorker?: () => string | null;
  /** Fonts downloaded on demand (architecture design §9.1): when not given, only local fonts are used. */
  fonts?: FontService;
  log: Logger;
}

const SPEECH_SCHEMA = 'cuccut.speech/1';
const CAPTION_SCHEMA = 'cuccut.caption/1';
/** The remedy when ffmpeg / ffprobe is missing (fetched at the time of use, follows the current language). */
const toolRemedy = () => ffmpegMissingRemedy({ ffprobe: true });
/** The remedy when the Render Worker is missing (fetched at the time of use, follows the current language). */
const workerRemedy = () => RcExport.workerRemedy().text;

const MEDIA_TYPES: Record<string, string> = {
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  ass: 'text/x-ssa',
  json: 'application/json',
  md: 'text/markdown',
  txt: 'text/plain',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  cuccut: 'application/x-cuccut-package',
  xml: 'application/xml',
};

type TextSettings = Extract<ExportSettings, { kind: 'subtitles' | 'transcript' }>;
type AudioSettings = Extract<ExportSettings, { kind: 'audio' }>;
type VideoSettings = Extract<ExportSettings, { kind: 'video' }>;
type PortableSettings = Extract<ExportSettings, { kind: 'portable' }>;
type ProjectSettings = Extract<ExportSettings, { kind: 'project' }>;

interface FrozenOutput {
  range: ExportRange;
  fileName: string;
}

/** The file state of linked assets as seen at preflight: compared again before execution, and the digest is recomputed if it changed. */
interface LinkedCheck {
  asset: PlannedAsset;
  size: number;
  mtimeMs: number;
}

export class ExportService {
  readonly #jobs: JobManager;
  readonly #videos: VideoService;
  readonly #options: ExportServiceOptions;
  readonly #log: Logger;

  constructor(options: ExportServiceOptions) {
    this.#options = options;
    this.#jobs = options.jobs;
    this.#videos = options.videos;
    this.#log = options.log;
  }

  get(jobId: Id): JobRecord {
    const record = this.#jobs.inspect(jobId);
    if (record.kind !== 'export') throw new RpcError('not-found', RcExport.exportTaskNotFound());
    return record;
  }

  list(videoId?: Id): JobRecord[] {
    return this.#jobs.list(videoId).filter((job) => job.kind === 'export');
  }

  /** Freeze → preflight → save snapshot → queue. If preflight fails, throws `RpcError` and no task is created. */
  async create(request: ExportCreateRequest, submitter: JobSubmitter): Promise<{ jobId: Id }> {
    const { settings } = request;
    if (!(SUPPORTED_EXPORT_KINDS as readonly string[]).includes(settings.kind)) throw kindUnsupported(settings.kind);
    if (request.commandId) {
      const existing = this.#jobs.jobForCommand(request.commandId);
      if (existing) return { jobId: existing };
    }
    const ref = this.#videos.ref(request.videoId);
    const mirror = this.#videos.mirror(request.videoId);
    if (!ref || !mirror) throw new RpcError('not-found', RcExport.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
    const scoped = settings as TextSettings | AudioSettings | VideoSettings;
    const ranges = scoped.ranges ?? (scoped.range ? [scoped.range] : []);
    const destination = request.destination ?? {};
    if (destination.fileName !== undefined && ranges.length > 1) {
      throw new RpcError('invalid-request', RcExport.fileNameWithMultipleRanges());
    }

    const kind = settings.kind;
    if (kind === 'portable') return this.#createPortable(request, settings as PortableSettings, submitter);
    if (kind === 'project') return this.#createProject(request, settings as ProjectSettings, submitter);
    if (kind === 'audio') return this.#createAudio(request, settings as AudioSettings, ranges, submitter);
    if (kind === 'video') return this.#createVideo(request, settings as VideoSettings, ranges, submitter);
    return this.#createText(request, settings as TextSettings, ranges, mirror.video, submitter);
  }

  // ---- Subtitles and text ----

  /**
   * The body of a subtitle or text document, without writing a file or creating a task (`exports.renderText`). Freezing, preflight and formatting use the same code as `exports.create`
   * (`#planText`, `renderTextPart`), so the body is byte-identical to the exported file. It does not touch the target directory; the file name is the one expected under the default target.
   */
  async renderText(request: ExportRenderTextRequest): Promise<ExportRenderTextResult> {
    const settings = request.settings as ExportSettings;
    if (settings.kind !== 'subtitles' && settings.kind !== 'transcript') throw kindUnsupported(settings.kind);
    const ref = this.#videos.ref(request.videoId);
    const mirror = this.#videos.mirror(request.videoId);
    if (!ref || !mirror) throw new RpcError('not-found', RcExport.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
    const ranges = settings.ranges ?? (settings.range ? [settings.range] : []);
    const frozen = await this.#planText(request.videoId, settings, ranges, mirror.video);
    const warnings: JobWarning[] = [];
    const outputs = frozen.plan.parts.map((_, i): RenderedTextOutput => {
      const rendered = renderTextPart(frozen, settings, i);
      const fileName = defaultFileName(frozen.plan.videoName, frozen.suffix, settings.format, ranges.length > 1, i);
      for (const warning of rendered.warnings) warnings.push(frozen.plan.parts.length > 1 ? { ...warning, segmentId: fileName } : warning);
      return {
        fileName,
        format: settings.format,
        mediaType: MEDIA_TYPES[settings.format] ?? 'text/plain',
        content: rendered.content,
        entries: rendered.entries,
        durationSec: rendered.durationSec,
        words: rendered.words,
        cjkCharacters: rendered.cjkCharacters,
      };
    });
    return { outputs, warnings };
  }

  /** Selects the document, freezes the plan for all ranges in one engine request, and preflights (whether the document can be exported, whether the range contains any text). */
  async #planText(videoId: Id, settings: TextSettings, ranges: ExportRange[], video: VideoSnapshot): Promise<FrozenText> {
    const sequenceId = settings.sequenceId ?? video.rootSequenceId;
    const primaryId = settings.documentId ?? chooseDocument(video, sequenceId, settings);
    const documentIds = [primaryId];
    if (settings.bilingual) documentIds.push(chooseSecondary(video, primaryId, settings.bilingual));
    const plan = await this.#plan<TextPlanResult>(videoId, {
      kind: 'text',
      sequenceId,
      ranges,
      documentIds,
      scopeItemIds: settings.scopeItemIds ?? [],
    });
    const [primary, secondary] = plan.documents as [PlannedDocument, PlannedDocument | undefined];
    if (primary.schema !== SPEECH_SCHEMA && primary.schema !== CAPTION_SCHEMA) {
      throw new RpcError('invalid-request', RcExport.documentNotExportable({ kind: primary.kind }), {
        code: 'EXPORT_SOURCE_UNSUPPORTED',
        schema: primary.schema,
      });
    }
    for (const part of plan.parts) {
      const entries = (part.plans[0] as TextPlan).entries.length;
      if (entries === 0) {
        throw new RpcError('invalid-request', RcExport.nothingInRange(), {
          code: 'EXPORT_NOTHING_TO_EXPORT',
          range: { start: part.plans[0]!.range.startSeconds, end: part.plans[0]!.range.endSeconds },
        });
      }
    }
    // When not skipping the cut parts, entries come from the body: the transcript's body is in the plan, and subtitles are read separately.
    const bodies = new Map<Id, unknown>();
    if (settings.kind === 'transcript' && settings.skipCut === false) {
      for (const [i, document] of plan.documents.entries()) {
        if (plan.parts[0]?.plans[i] === null) continue;
        bodies.set(
          document.documentId,
          document.body ?? (await this.#videos.document(videoId, document.documentId, document.revision)).body,
        );
      }
    }
    const language = primary.language ?? null;
    const suffix =
      settings.kind === 'transcript'
        ? 'transcript'
        : language
          ? secondary?.language
            ? `${language}-${secondary.language}`
            : language
          : 'subtitles';
    return {
      plan,
      primary,
      secondary,
      suffix,
      bodies,
      chapters: chapterMarkers(video, plan),
      frontMatter: frontMatterOf(video, plan, primary, secondary),
    };
  }

  async #createText(
    request: ExportCreateRequest,
    settings: TextSettings,
    ranges: ExportRange[],
    video: VideoSnapshot,
    submitter: JobSubmitter,
  ): Promise<{ jobId: Id }> {
    const frozen = await this.#planText(request.videoId, settings, ranges, video);
    const { plan, suffix } = frozen;
    const extension = settings.format;
    const { dir, outputs } = await this.#destination(request, plan.videoName, suffix, extension, ranges, plan.parts.length, (i) => {
      const range = plan.parts[i]!.plans[0]!.range;
      return { start: range.startSeconds, end: range.endSeconds };
    });
    const snapshot: ExportSnapshot = {
      schema: 'cuccut.export-snapshot/1',
      videoId: plan.videoId,
      videoName: plan.videoName,
      videoRevision: plan.videoRevision,
      sequenceId: plan.sequenceId,
      sequenceRevision: plan.sequenceRevision,
      settings,
      assets: [],
      documents: plan.documents.map((d) => ({
        documentId: d.documentId,
        revision: d.revision,
        kind: d.kind,
        language: d.language ?? null,
        schema: d.schema,
      })),
      parts: outputs.map((o, i) => ({ ...o, plan: plan.parts[i] })),
      output: { dir, overwrite: request.destination?.overwrite === true },
      frozenAt: nowIso(),
    };
    const run = async (task: TaskRun) => {
      const staged: Staged[] = [];
      const failed: Failed[] = [];
      for (const [i, output] of outputs.entries()) {
        throwIfAborted(task.signal);
        task.phase('generating', { done: i, total: outputs.length, unit: 'outputs' });
        const rendered = renderTextPart(frozen, settings, i);
        for (const warning of rendered.warnings) task.warn(outputs.length > 1 ? { ...warning, segmentId: output.fileName } : warning);
        const file = path.join(task.staging, `${i + 1}.${extension}`);
        await fs.writeFile(file, rendered.content, 'utf8');
        task.phase('validating', { done: i, total: outputs.length, unit: 'outputs' });
        const check = checkText(settings.format, await fs.readFile(file, 'utf8'), {
          entries: rendered.entries,
          durationSec: rendered.rangeSec,
          headings: rendered.headings,
        });
        if (!check.ok) {
          failed.push({ fileName: output.fileName, code: 'EXPORT_VALIDATION_FAILED', problems: check.problems });
          continue;
        }
        staged.push({
          file,
          fileName: output.fileName,
          format: extension,
          media: { kind: 'text', entries: check.entries, durationSec: check.durationSec },
          validation: {
            checks: ['parsed', 'entry-count', 'monotonic-times', 'within-range'],
            expectedDurationSec: rendered.rangeSec,
            durationSec: check.durationSec,
            toleranceSec: 0.001,
            expectedEntries: rendered.entries,
            entries: check.entries,
          },
        });
      }
      return this.#publish(task, staged, failed, dir, request);
    };
    return this.#submit(request, settings, snapshot, outputs, dir, submitter, run);
  }

  // ---- Audio ----

  async #createAudio(
    request: ExportCreateRequest,
    settings: AudioSettings,
    ranges: ExportRange[],
    submitter: JobSubmitter,
  ): Promise<{ jobId: Id }> {
    const output: AudioOutputSettings = {
      format: settings.format,
      sampleRate: settings.sampleRate ?? DEFAULT_SAMPLE_RATE,
      channels: settings.channels ?? DEFAULT_CHANNELS,
      bitrateKbps: settings.bitrateKbps ?? DEFAULT_BITRATE_KBPS,
      loudness: settings.loudness ? { ...DEFAULT_LOUDNESS_TARGET, ...settings.loudness } : null,
    };
    const [ffmpeg, ffprobe] = await Promise.all([this.#options.ffmpeg(), this.#options.ffprobe()]);
    const missing = await missingAudioTools(ffmpeg, ffprobe, output);
    if (missing) {
      throw new RpcError('conflict', RcExport.audioExportNeeds({ missing }), {
        code: 'EXPORT_TOOL_MISSING',
        missing: String(missing),
        remedy: toolRemedy(),
      });
    }
    // Loudness normalization is done by the Render Worker's mastering.
    const workerCommand = output.loudness ? (this.#options.exportWorker?.() ?? null) : null;
    if (output.loudness && !workerCommand) {
      throw new RpcError('conflict', RcExport.loudnessNeedsWorker(), {
        code: 'EXPORT_TOOL_MISSING',
        missing: 'export-worker',
        remedy: workerRemedy(),
      });
    }
    const master = workerCommand ? masterRunner({ command: workerCommand, env: ffmpeg.env ?? process.env }) : undefined;
    const video = this.#videos.mirror(request.videoId)!.video;
    const audioItems = await audioItemSelection(video, settings.sequenceId ?? video.rootSequenceId, settings.source, async (documentId) => {
      return (await this.#videos.document(request.videoId, documentId)).body;
    });
    const plan = await this.#plan<AudioPlanResult>(request.videoId, {
      kind: 'audio',
      ...(settings.sequenceId ? { sequenceId: settings.sequenceId } : {}),
      ranges,
      ...(audioItems ? { audioItems } : {}),
    });
    const videoDir = this.#videos.ref(request.videoId)!.path;
    const assets = new Map<string, PlannedAsset>();
    const linked: LinkedCheck[] = [];
    for (const asset of plan.assets) {
      const absolute = { ...asset, path: path.isAbsolute(asset.path) ? asset.path : path.join(videoDir, asset.path) };
      assets.set(`${asset.assetId}@${asset.revision}`, absolute);
      if (absolute.storage === 'linked') linked.push(await verifyLinked(absolute));
    }
    const suffix = 'audio';
    const { dir, outputs } = await this.#destination(request, plan.videoName, suffix, settings.format, ranges, plan.parts.length, (i) => {
      const range = plan.parts[i]!.audio.range;
      return { start: range.startSeconds, end: range.endSeconds };
    });
    const snapshot: ExportSnapshot = {
      schema: 'cuccut.export-snapshot/1',
      videoId: plan.videoId,
      videoName: plan.videoName,
      videoRevision: plan.videoRevision,
      sequenceId: plan.sequenceId,
      sequenceRevision: plan.sequenceRevision,
      settings,
      assets: [...assets.values()].map((a) => ({
        assetId: a.assetId,
        revision: a.revision,
        name: a.name,
        storage: a.storage,
        path: a.path,
        contentHash: a.contentHash,
        byteLength: a.byteLength,
      })),
      documents: [],
      parts: outputs.map((o, i) => ({ ...o, plan: plan.parts[i] })),
      output: { dir, overwrite: request.destination?.overwrite === true },
      frozenAt: nowIso(),
    };
    const run = async (task: TaskRun) => {
      // Re-check linked assets before execution (files may have been replaced while queued).
      for (const check of linked) {
        throwIfAborted(task.signal);
        await recheckLinked(check);
      }
      const total = plan.parts.reduce((sum, p) => sum + p.audio.range.durationSeconds, 0);
      let done = 0;
      const warned = new Set<string>();
      const staged: Staged[] = [];
      const failed: Failed[] = [];
      for (const [i, out] of outputs.entries()) {
        throwIfAborted(task.signal);
        const audio = plan.parts[i]!.audio;
        for (const note of audio.notes) {
          const key = `${note.code}:${note.itemId}`;
          if (warned.has(key)) continue;
          warned.add(key);
          const detail = RcExport.audioNote({ itemId: note.itemId, note: audioNoteText(note.code) ?? note.code });
          task.warn({ code: note.code, detail: detail.text, detailRef: refOf(detail) });
        }
        for (const segment of audio.segments) {
          const key = `GAIN_ABOVE_PREVIEW:${segment.itemId}`;
          // Envelope breakpoints count too: if the highest point is above 1, it is also louder than the preview.
          const peak = Math.max(0, ...(segment.envelope ?? []).map(([, gain]) => gain));
          const peakDb = segment.gainDb + (peak > 1 ? 20 * Math.log10(peak) : 0);
          if (peakDb > 0 && !warned.has(key)) {
            warned.add(key);
            const detail = RcExport.gainAbovePreview({ itemId: segment.itemId, gainDb: Number(peakDb.toFixed(2)) });
            task.warn({ code: 'GAIN_ABOVE_PREVIEW', detail: detail.text, detailRef: refOf(detail) });
          }
        }
        task.phase('generating', { done, total, unit: 'seconds' });
        try {
          const rendered = await renderAudio({
            plan: audio,
            assets,
            settings: output,
            staging: task.staging,
            outName: `${i + 1}.${settings.format}`,
            ffmpeg,
            ffprobe,
            ...(master ? { master } : {}),
            signal: task.signal,
            progress: (seconds) => task.phase('generating', { done: Math.round((done + seconds) * 10) / 10, total, unit: 'seconds' }),
          });
          for (const warning of rendered.warnings) task.warn(outputs.length > 1 ? { ...warning, segmentId: out.fileName } : warning);
          staged.push({
            file: rendered.file,
            fileName: out.fileName,
            format: settings.format,
            media: rendered.media,
            validation: rendered.validation,
          });
        } catch (error) {
          if (task.signal.aborted) throw error;
          if (error instanceof AudioValidationError)
            failed.push({ fileName: out.fileName, code: 'EXPORT_VALIDATION_FAILED', problems: error.problems });
          else if (error instanceof ToolFailure && error.kind === 'missing') {
            throw toolMissing(error);
          } else if (error instanceof ToolFailure)
            failed.push({ fileName: out.fileName, code: 'EXPORT_RENDER_FAILED', problems: [error.message] });
          else if (error instanceof WorkerFailure) failed.push({ fileName: out.fileName, code: error.code, problems: [error.message] });
          else throw error;
        }
        done += audio.range.durationSeconds;
      }
      return this.#publish(task, staged, failed, dir, request);
    };
    // Peak requirement (§7.7): estimate staging from the total duration of all outputs.
    const resources: TaskResources = {
      demand: audioExportDemand({
        durationSec: plan.parts.reduce((sum, p) => sum + p.audio.range.durationSeconds, 0),
        sampleRate: output.sampleRate,
        channels: output.channels,
        loudness: output.loudness !== null,
      }),
    };
    return this.#submit(request, settings, snapshot, outputs, dir, submitter, run, resources);
  }

  // ---- Video ----

  async #createVideo(
    request: ExportCreateRequest,
    settings: VideoSettings,
    ranges: ExportRange[],
    submitter: JobSubmitter,
  ): Promise<{ jobId: Id }> {
    const audioOptions = settings.audio ?? {};
    const audioSettings: AudioOutputSettings = {
      format: 'wav',
      sampleRate: audioOptions.sampleRate ?? DEFAULT_SAMPLE_RATE,
      channels: audioOptions.channels ?? DEFAULT_CHANNELS,
      bitrateKbps: audioOptions.bitrateKbps ?? DEFAULT_VIDEO_AUDIO_KBPS[settings.format],
      loudness: audioOptions.loudness ? { ...DEFAULT_LOUDNESS_TARGET, ...audioOptions.loudness } : null,
    };
    const [ffmpeg, ffprobe] = await Promise.all([this.#options.ffmpeg(), this.#options.ffprobe()]);
    const missing = await missingAudioTools(ffmpeg, ffprobe, audioSettings);
    if (missing) {
      throw new RpcError('conflict', RcExport.videoExportNeeds({ missing }), {
        code: 'EXPORT_TOOL_MISSING',
        missing: String(missing),
        remedy: toolRemedy(),
      });
    }
    const workerCommand = this.#options.exportWorker?.() ?? null;
    if (!workerCommand) {
      throw new RpcError('conflict', RcExport.videoExportNeedsWorker(), {
        code: 'EXPORT_TOOL_MISSING',
        missing: 'export-worker',
        remedy: workerRemedy(),
      });
    }
    const worker: ToolCommand = { command: workerCommand, env: ffmpeg.env ?? process.env };
    // The sound source is the same as for audio export: only this export's sound plan is swapped; the picture and video are unchanged.
    const video = this.#videos.mirror(request.videoId)!.video;
    const audioItems = await audioItemSelection(video, settings.sequenceId ?? video.rootSequenceId, settings.source, async (documentId) => {
      return (await this.#videos.document(request.videoId, documentId)).body;
    });
    const plan = await this.#plan<VideoPlanResult>(request.videoId, {
      kind: 'video',
      ...(settings.sequenceId ? { sequenceId: settings.sequenceId } : {}),
      ranges,
      ...(audioItems ? { audioItems } : {}),
      // The engine decides the output size (when both width and height are given and the aspect ratio differs from the canvas, the picture is centered and the rest is black bars).
      ...(settings.width !== undefined || settings.height !== undefined
        ? {
            output: {
              ...(settings.width !== undefined ? { width: settings.width } : {}),
              ...(settings.height !== undefined ? { height: settings.height } : {}),
            },
          }
        : {}),
    });
    const size = plan.output;
    const output: VideoOutput = {
      format: settings.format,
      codec: settings.codec ?? (settings.format === 'webm' ? 'vp9' : 'h264'),
      width: size.width,
      height: size.height,
      picture: size.picture,
      fps: settings.fps ?? plan.fps,
      crf: settings.crf ?? null,
      bitrateKbps: settings.bitrateKbps ?? null,
      audioBitrateKbps: audioSettings.bitrateKbps,
    };
    const onUnsupported = settings.onUnsupported ?? 'fail';
    const burnCaptions = settings.burnCaptions ?? true;
    const videoDir = this.#videos.ref(request.videoId)!.path;
    const assets = new Map<string, PlannedAsset>();
    const linked: LinkedCheck[] = [];
    for (const asset of plan.assets) {
      const absolute = { ...asset, path: path.isAbsolute(asset.path) ? asset.path : path.join(videoDir, asset.path) };
      assets.set(`${asset.assetId}@${asset.revision}`, absolute);
      if (absolute.storage === 'linked') linked.push(await verifyLinked(absolute));
    }
    // Frozen local fonts: only known after preflight (they are not among the preflight inputs).
    let fonts: ExportFontFace[] = [];
    const inputOf = (part: number, outputPath: string, audioPath: string | null) =>
      workerInput({
        plan,
        part,
        assets,
        output,
        outputPath,
        audioPath,
        burnCaptions,
        onUnsupported,
        fonts,
        ffmpeg: ffmpeg.command,
        ffprobe: ffprobe.command,
      });

    // Preflight: for each range segment, whether anything cannot be drawn, whether the assets can decode a picture, and whether the encoders exist. If it fails, no task is created.
    const preflightDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-export-preflight-'));
    const frames: number[] = [];
    const preflightWarnings: JobWarning[] = [];
    const unsupported = new Map<string, UnsupportedItem>();
    const faces = new Map<string, FontFaceQuery>();
    try {
      for (const i of plan.parts.keys()) {
        const file = path.join(preflightDir, `${i + 1}.json`);
        await fs.writeFile(file, JSON.stringify(inputOf(i, path.join(preflightDir, 'out'), path.join(preflightDir, 'audio.wav'))));
        let report: Extract<WorkerEvent, { event: 'preflight' }>;
        try {
          report = (await runWorker(worker, 'preflight', file)) as typeof report;
        } catch (error) {
          throw workerRpcError(error);
        }
        if (report.missingEncoders.length > 0) {
          const encoders = report.missingEncoders.join(RcExport.listSeparator().text);
          throw new RpcError('conflict', RcExport.videoExportNeedsEncoders({ encoders }), {
            code: 'EXPORT_TOOL_MISSING',
            missing: report.missingEncoders.join(', '),
            remedy: toolRemedy(),
          });
        }
        frames.push(report.frames);
        for (const item of report.items) unsupported.set(itemKey(item), item);
        for (const face of report.faces ?? []) faces.set(`${face.family}\u0000${face.weight}\u0000${face.italic}`, face);
        for (const warning of report.warnings) {
          if (!preflightWarnings.some((w) => w.code === warning.code && w.detail === warning.detail)) preflightWarnings.push(warning);
        }
      }
    } finally {
      await fs.rm(preflightDir, { recursive: true, force: true });
    }
    const items = [...unsupported.values()];
    if (items.length > 0 && onUnsupported === 'fail') {
      const listed = items.map((i) => i.message).join(RcExport.clauseSeparator().text);
      throw new RpcError('invalid-request', RcExport.unsupportedContent({ count: items.length, items: listed }), {
        code: 'EXPORT_UNSUPPORTED_CONTENT',
        items,
        remedy: RcExport.unsupportedContentRemedy().text,
      });
    }
    const frozenFonts = await this.#freezeFonts([...faces.values()]);
    fonts = frozenFonts.fonts;

    // When subtitles are burned into the picture, the default file name includes their language ("video name.zh-Hans.mp4"), using the same format as the subtitle export suffix.
    const sequence = video.sequences[settings.sequenceId ?? video.rootSequenceId];
    const suffix = burnCaptions && sequence ? burnedCaptionLanguages(sequence, video.documents).join('-') : '';
    const { dir, outputs } = await this.#destination(request, plan.videoName, suffix, settings.format, ranges, plan.parts.length, (i) => {
      const range = plan.parts[i]!.video.range;
      return { start: range.startSeconds, end: range.endSeconds };
    });
    const snapshot: ExportSnapshot = {
      schema: 'cuccut.export-snapshot/1',
      videoId: plan.videoId,
      videoName: plan.videoName,
      videoRevision: plan.videoRevision,
      sequenceId: plan.sequenceId,
      sequenceRevision: plan.sequenceRevision,
      settings,
      assets: [...assets.values()].map((a) => ({
        assetId: a.assetId,
        revision: a.revision,
        name: a.name,
        storage: a.storage,
        path: a.path,
        contentHash: a.contentHash,
        byteLength: a.byteLength,
      })),
      fonts,
      documents: plan.documents
        .filter((d) => d.revision !== null && d.kind !== null && d.schema !== null)
        .map((d) => ({ documentId: d.documentId, revision: d.revision!, kind: d.kind!, language: null, schema: d.schema! })),
      parts: outputs.map((o, i) => ({ ...o, plan: plan.parts[i] })),
      render: { document: plan.document, documents: plan.documents },
      output: { dir, overwrite: request.destination?.overwrite === true },
      frozenAt: nowIso(),
    };
    const run = async (task: TaskRun) => {
      for (const check of linked) {
        throwIfAborted(task.signal);
        await recheckLinked(check);
      }
      // Fonts that are in the font directory but not yet downloaded: download them before drawing starts, and freeze the downloaded ones into this render; if they are not downloaded or the download fails, draw with fallback fonts.
      fonts = await this.#downloadFonts(task, fonts, frozenFonts.notes);
      if (size.adjusted) {
        const { width, height } = size;
        const detail =
          size.picture.width === width && size.picture.height === height
            ? RcExport.outputSizeAdjusted({ width, height, canvasWidth: plan.canvas.width, canvasHeight: plan.canvas.height })
            : RcExport.outputSizeLetterboxed({ width, height, pictureWidth: size.picture.width, pictureHeight: size.picture.height });
        task.warn({ code: 'EXPORT_SIZE_ADJUSTED', detail: detail.text, detailRef: refOf(detail) });
      }
      for (const warning of preflightWarnings) task.warn(warning);
      const total = frames.reduce((sum, n) => sum + n, 0);
      let done = 0;
      const warned = new Set<string>();
      const staged: Staged[] = [];
      const failed: Failed[] = [];
      for (const [i, out] of outputs.entries()) {
        throwIfAborted(task.signal);
        const part = plan.parts[i]!;
        task.phase('generating', { done, total, unit: 'frames' });
        try {
          // Sound: the same mix as audio export, written as WAV and handed to the Worker to package.
          const audio = await renderAudio({
            plan: part.audio,
            assets,
            settings: audioSettings,
            staging: task.staging,
            outName: `${i + 1}.audio.wav`,
            ffmpeg,
            ffprobe,
            master: masterRunner(worker),
            signal: task.signal,
          });
          for (const warning of audio.warnings) task.warn(outputs.length > 1 ? { ...warning, segmentId: out.fileName } : warning);
          const outFile = path.join(task.staging, `${i + 1}.${settings.format}`);
          const inputFile = path.join(task.staging, `${i + 1}.input.json`);
          await fs.writeFile(inputFile, JSON.stringify(inputOf(i, outFile, audio.file)));
          const result = (await runWorker(worker, 'render', inputFile, {
            signal: task.signal,
            onProgress: (frame) => task.phase('generating', { done: done + frame, total, unit: 'frames' }),
          })) as Extract<WorkerEvent, { event: 'done' }>;
          for (const item of result.skipped) {
            const key = itemKey(item);
            if (warned.has(key)) continue;
            warned.add(key);
            task.warn(skippedWarning(item));
          }
          // Warnings that only appear at composition time (font substitution, missing glyphs); those already reported at preflight are not repeated.
          for (const warning of result.warnings) {
            const key = `warning:${warning.code}|${warning.detail}`;
            if (warned.has(key) || preflightWarnings.some((w) => w.code === warning.code && w.detail === warning.detail)) continue;
            warned.add(key);
            task.warn(warning);
          }
          this.#log.info('Video export rendered', {
            jobId: task.jobId,
            frames: result.frames,
            renderSeconds: result.renderSeconds,
            decoderRestarts: result.decoderRestarts,
            ...(result.video
              ? {
                  videoDecoder: result.video.decoder,
                  videoEncoder: result.video.encoder,
                  videoFallbacks: result.video.fallbacks.map((f) => `${f.scope}:${f.reason}${f.assetId ? `@${f.assetId}` : ''}`),
                }
              : {}),
          });
          task.phase('validating', { done: done + result.frames, total, unit: 'frames' });
          const probed = await probeVideo(ffprobe, outFile, task.signal);
          const check = checkVideo(probed, { frames: frames[i]!, output, audio: true });
          if (check.problems.length > 0) {
            failed.push({ fileName: out.fileName, code: 'EXPORT_VALIDATION_FAILED', problems: check.problems });
          } else {
            staged.push({
              file: outFile,
              fileName: out.fileName,
              format: settings.format,
              media: check.media,
              validation: { ...check.validation, ...(audio.validation.loudness ? { loudness: audio.validation.loudness } : {}) },
            });
          }
          await fs.rm(audio.file, { force: true });
        } catch (error) {
          if (task.signal.aborted) throw error;
          if (error instanceof AudioValidationError)
            failed.push({ fileName: out.fileName, code: 'EXPORT_VALIDATION_FAILED', problems: error.problems });
          else if (error instanceof ToolFailure && error.kind === 'missing') {
            throw toolMissing(error);
          } else if (error instanceof ToolFailure)
            failed.push({ fileName: out.fileName, code: 'EXPORT_RENDER_FAILED', problems: [error.message] });
          else if (error instanceof WorkerFailure) {
            // If assets or fonts change after freezing, or the tool disappears, the whole task fails; an error partway through drawing fails only that one output.
            if (
              error.code === 'EXPORT_UNSUPPORTED_CONTENT' ||
              error.code === 'EXPORT_TOOL_MISSING' ||
              error.code === 'FONT_MISSING' ||
              error.code.startsWith('ASSET_')
            )
              throw taskFailureOf(error.code, error, error.details);
            failed.push({ fileName: out.fileName, code: error.code, problems: [error.message] });
          } else throw error;
        }
        done += frames[i]!;
      }
      return this.#publish(task, staged, failed, dir, request);
    };
    // Peak requirement (§7.7): output size, frame rate, and the total duration of all outputs; segments render one after another, memory is counted for one segment, and staging is counted for all of them (kept until publishing).
    const resources: TaskResources = {
      demand: videoExportDemand({
        width: output.width,
        height: output.height,
        fps: output.fps.num / output.fps.den,
        durationSec: plan.parts.reduce((sum, p) => sum + p.video.range.durationSeconds, 0),
        bitrateKbps: output.bitrateKbps,
        audioBitrateKbps: output.audioBitrateKbps,
        sampleRate: audioSettings.sampleRate,
        channels: audioSettings.channels,
        loudness: audioSettings.loudness !== null,
      }),
    };
    const submitted = await this.#submit(request, settings, snapshot, outputs, dir, submitter, run, resources);
    // Files in the frozen download cache, and faces waiting on download: do not let `fonts.remove` / `fonts.clear` delete them before the task ends.
    this.#options.fonts?.pin(submitted.jobId, {
      files: (snapshot.fonts ?? []).flatMap((f) => ('path' in f && f.source === 'downloaded' ? [f.path] : [])),
      faces: (snapshot.fonts ?? []).filter((f) => 'download' in f),
    });
    return submitted;
  }

  /**
   * Freezing local fonts for a finished video ("fonts" in architecture design §9.11): the faces reported at preflight (families not in the fonts bundled with the render kernel) are selected by the engine, recording the file each is in, its index within that file, and the digest and byte count of the whole file (same digest format as frozen assets; when several faces share one font collection, it is counted once). Faces not found are recorded as `fallback`, drawn with fallback fonts, with a note in the result; the export is not rejected.
   */
  async #freezeFonts(faces: FontFaceQuery[]): Promise<{ fonts: ExportFontFace[]; notes: Map<string, string> }> {
    const frozen: ExportFontFace[] = [];
    /** The reason each face was not downloaded (`FONT_NOT_DOWNLOADED` warning), keyed by `queryKey`. */
    const notes = new Map<string, string>();
    // The engine accepts only family names of 1–200 characters; anything else cannot be the name of a local font.
    const asked = faces.filter((face) => {
      const family = face.family.trim();
      const usable = family.length > 0 && family.length <= 200;
      if (!usable) frozen.push({ family: face.family, weight: face.weight, italic: face.italic, fallback: 'not-found' });
      return usable;
    });
    const plans = this.#options.fonts ? await this.#options.fonts.planExport(asked) : new Map<string, ExportFacePlan>();
    const toEngine: FontFaceQuery[] = [];
    for (const face of asked) {
      const plan = plans.get(queryKey(face));
      const query = { family: face.family.trim(), weight: face.weight, italic: face.italic };
      if (plan?.kind === 'download') frozen.push({ ...query, download: 'google-fonts' });
      else {
        if (plan?.kind === 'skip') notes.set(queryKey(query), plan.reason);
        toEngine.push(query);
      }
    }
    frozen.push(...(await this.#resolveFonts(toEngine, notes)));
    return { fonts: frozen, notes };
  }

  /** Selects faces through the engine, recording the file and digest (when several faces share one font collection, it is counted once). Faces not found that have a not-downloaded reason are recorded as `not-downloaded`. */
  async #resolveFonts(faces: FontFaceQuery[], notes: ReadonlyMap<string, string>): Promise<ExportFontFace[]> {
    const frozen: ExportFontFace[] = [];
    const digests = new Map<string, Promise<{ contentHash: string; byteLength: number } | null>>();
    const digest = (file: string) => {
      let found = digests.get(file);
      if (!found) {
        found = Promise.all([fs.stat(file), sha256File(file)]).then(
          ([stat, contentHash]) => ({ contentHash, byteLength: stat.size }),
          () => null,
        );
        digests.set(file, found);
      }
      return found;
    };
    for (let start = 0; start < faces.length; start += 32) {
      const resolved = await this.#videos.fontFaces(faces.slice(start, start + 32));
      for (const face of resolved.faces) {
        const query = { family: face.family, weight: face.weight, italic: face.italic };
        const file = await digest(face.path);
        frozen.push(
          file
            ? {
                ...query,
                path: face.path,
                faceIndex: face.faceIndex,
                ...file,
                ...(face.source === 'downloaded' ? { source: 'downloaded' as const } : {}),
              }
            : { ...query, fallback: 'not-found' },
        );
      }
      for (const missing of resolved.missing) {
        const query = { family: missing.family, weight: missing.weight, italic: missing.italic };
        const fallback = missing.reason === 'too-large' ? 'too-large' : notes.has(queryKey(query)) ? 'not-downloaded' : 'not-found';
        frozen.push({ ...query, fallback });
      }
    }
    return frozen;
  }

  /**
   * Before the export task starts drawing (§9.1): faces marked `download` at freeze time are downloaded here (progress by bytes; cancellation follows the task), and the downloaded ones are frozen in the same way (the file is pinned until the task ends).
   * Faces that cannot be downloaded (freezing did not download them because auto-download is off or it is strictly offline, and they are not present locally) record a `FONT_NOT_DOWNLOADED` warning that explains why (`font` carries the family, weight, fallback family and reason). They are drawn with fallback fonts. The export is not rejected, and the user is not asked to choose a substitute font first.
   */
  async #downloadFonts(task: TaskRun, fonts: ExportFontFace[], notes: ReadonlyMap<string, string>): Promise<ExportFontFace[]> {
    const service = this.#options.fonts;
    const warn = (face: FontFaceQuery, reason: string | Localized) => {
      const { family, weight, italic } = face;
      const detail = RcExport.fontNotDownloaded({ family, weight, italic, reason, fallback: FALLBACK_FONT_FAMILY });
      task.warn({
        code: 'FONT_NOT_DOWNLOADED',
        detail: detail.text,
        detailRef: refOf(detail),
        font: { family, weight, italic, fallback: FALLBACK_FONT_FAMILY, reason: String(reason) },
      });
    };
    for (const face of fonts) {
      if ('fallback' in face && face.fallback === 'not-downloaded') warn(face, notes.get(queryKey(face)) ?? RcExport.fontNotDownloadedReason());
    }
    const pending = fonts.filter((f) => 'download' in f).map(({ family, weight, italic }) => ({ family, weight, italic }));
    if (pending.length === 0) return fonts;
    const reasons = new Map<string, string>();
    if (service) {
      task.phase('downloading', { done: 0, total: null, unit: 'bytes' });
      const outcomes = await service.ensureForExport(pending, task.jobId, task.signal, (done, total) =>
        task.phase('downloading', { done, total, unit: 'bytes' }),
      );
      for (const [key, reason] of outcomes) if (reason) reasons.set(key, reason);
    }
    throwIfAborted(task.signal);
    const ready = pending.filter((face) => service && !reasons.has(queryKey(face)));
    const resolved = await this.#resolveFonts(ready, new Map(ready.map((face) => [queryKey(face), RcExport.fontStillMissingAfterDownload().text])));
    const byKey = new Map(resolved.map((face) => [queryKey(face), face]));
    if (service) service.pin(task.jobId, { files: resolved.flatMap((f) => ('path' in f ? [f.path] : [])) });
    return fonts.map((face) => {
      if (!('download' in face)) return face;
      const query = { family: face.family, weight: face.weight, italic: face.italic };
      const found = byKey.get(queryKey(query));
      if (found && 'path' in found) return found;
      warn(query, reasons.get(queryKey(query)) ?? (service ? RcExport.fontStillMissingAfterDownload() : RcExport.fontDownloadUnavailable()));
      return { ...query, fallback: 'not-downloaded' as const };
    });
  }

  // ---- Portable package ----

  /**
   * Portable package (architecture design §5.8): the engine freezes the snapshot, document body and asset locations once; assets unreadable at preflight, local paths, tar limits, the target and the space are all checked, and the job is queued only if they all pass. The task writes the package directly into a hidden temp file in the target directory; after writing, it reads the archive back, checks each file against the manifest,
   * and attaches the package to the final name only if every file matches. On cancellation or failure the temp file is deleted, so no half-finished package is left.
   */
  async #createPortable(request: ExportCreateRequest, settings: PortableSettings, submitter: JobSubmitter): Promise<{ jobId: Id }> {
    const ref = this.#videos.ref(request.videoId)!;
    const freeze = await this.#videos.freezePackage<PackageFreeze>(request.videoId);
    const roots = await localRoots(freeze, [sourceRoot(ref)]);
    const plan = await planPortable(freeze, roots, settings.missingAssets ?? 'fail');
    const video = freeze.snapshot;
    const { dir, outputs } = await this.#destination(request, video.name, '', PACKAGE_EXTENSION, [], 1, () => ({ start: 0, end: 0 }));
    await checkSpace(dir, plan.bytes);
    const output = outputs[0]!;
    const snapshot: ExportSnapshot = {
      schema: 'cuccut.export-snapshot/1',
      videoId: video.id,
      videoName: video.name,
      videoRevision: video.revision,
      sequenceId: video.rootSequenceId,
      sequenceRevision: video.sequences[video.rootSequenceId]?.revision ?? video.revision,
      settings,
      assets: frozenAssets(freeze),
      documents: freeze.documents.map((d) => ({
        documentId: d.documentId,
        revision: d.revision,
        kind: video.documents[d.documentId]?.kind ?? 'unknown',
        language: video.documents[d.documentId]?.language ?? null,
        schema: documentSchema(d.text),
      })),
      parts: [{ ...output, plan: { entries: plan.entries, bytes: plan.bytes } }],
      output: { dir, overwrite: request.destination?.overwrite === true },
      frozenAt: nowIso(),
    };
    const run = async (task: TaskRun) => {
      for (const warning of plan.warnings) task.warn(warning);
      const tmp = hiddenTemp(dir, output.fileName);
      try {
        task.phase('generating', { done: 0, total: plan.bytes, unit: 'bytes' });
        let manifest: PackageManifest;
        try {
          manifest = await writePortable(plan, tmp, nowIso(), task.signal, (done, total) =>
            task.phase('generating', { done, total, unit: 'bytes' }),
          );
        } catch (error) {
          throwIfAborted(task.signal);
          if (error instanceof PackageAssetChanged) {
            throw taskFailureOf('ASSET_CHANGED', error, { assetId: error.assetId, revision: error.revision });
          }
          if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
            throw taskFailure('EXPORT_INSUFFICIENT_SPACE', RcPackage.diskFullWhileWriting(), { dir });
          }
          throw error;
        }
        throwIfAborted(task.signal);
        task.phase('validating', { done: 0, total: manifest.files.length, unit: 'outputs' });
        let verified: Awaited<ReturnType<typeof readPackage>>;
        try {
          verified = await readPackage(tmp, {
            signal: task.signal,
            progress: (done, total) => task.phase('validating', { done, total, unit: 'outputs' }),
          });
        } catch (error) {
          throwIfAborted(task.signal);
          throw taskFailure('EXPORT_VALIDATION_FAILED', RcPackage.packageVerifyFailed({ error: localizedOf(error) }), {
            fileName: output.fileName,
          });
        }
        if (canonicalJson(verified.manifest) !== canonicalJson(manifest)) {
          throw taskFailure('EXPORT_VALIDATION_FAILED', RcPackage.manifestReadBackMismatch(), { fileName: output.fileName });
        }
        const artifactId = await sha256OfFile(tmp);
        const { size } = await fs.stat(tmp);
        throwIfAborted(task.signal);
        task.phase('publishing');
        let final: string;
        try {
          final = await publishInPlace(tmp, dir, output.fileName, {
            overwrite: request.destination?.overwrite === true,
            fixed: request.destination?.fileName !== undefined,
          });
        } catch (error) {
          if (error instanceof DestinationError) throw taskFailureOf(error.code, error, { path: error.path });
          throw taskFailureOf('EXPORT_PUBLISH_FAILED', error);
        }
        const result: GeneratedOutput = {
          // The package is not added to the artifact library (it is already a complete file, often large): `artifactId` is the digest of the package file.
          artifactId,
          mediaType: MEDIA_TYPES[PACKAGE_EXTENSION]!,
          byteLength: size,
          assetId: null,
          media: {
            kind: 'package',
            files: manifest.files.length,
            assets: manifest.entries.filter((e) => e.kind === 'asset' && e.inclusion === 'included').length,
            missingAssets: manifest.entries.filter((e) => e.inclusion === 'missing').length,
            documents: manifest.entries.filter((e) => e.kind === 'document').length,
          },
          path: final,
          format: PACKAGE_EXTENSION,
          validation: {
            checks: ['archive-readable', 'manifest-matches', 'file-digests', 'asset-digests'],
            expectedDurationSec: 0,
            durationSec: 0,
            toleranceSec: 0,
            package: { files: manifest.files.length, verifiedFiles: verified.files, bytes: verified.bytes },
          },
        };
        return { documentId: null, artifactId, outputs: [result] };
      } finally {
        await fs.rm(tmp, { force: true }).catch(() => {});
      }
    };
    return this.#submit(request, settings, snapshot, outputs, dir, submitter, run);
  }

  // ---- Project ----

  /**
   * Project export (architecture design §9.13): one sequence is written as xmeml, with assets written by reference (local paths); anything it cannot express is recorded item by item as a task warning.
   * Assets that cannot be read do not cause a rejection: they become offline clips in the project, and the warning names them.
   */
  async #createProject(request: ExportCreateRequest, settings: ProjectSettings, submitter: JobSubmitter): Promise<{ jobId: Id }> {
    const freeze = await this.#videos.freezePackage<PackageFreeze>(request.videoId);
    const video = freeze.snapshot;
    const sequenceId = settings.sequenceId ?? video.rootSequenceId;
    if (!video.sequences[sequenceId]) {
      throw new RpcError('invalid-request', RcExport.sequenceNotFound({ sequenceId }), { code: 'EXPORT_SOURCE_NOT_FOUND', sequenceId });
    }
    const locations = new Map(
      freeze.assets.map((a) => [
        `${a.assetId}@${a.revision}`,
        a.missing || !a.path ? { missing: { reason: a.missing?.reason ?? 'missing' } } : { path: a.path },
      ]),
    );
    const rendered = renderXmeml(video, sequenceId, locations);
    if (rendered.clips === 0) {
      throw new RpcError('invalid-request', RcExport.projectNothingToExport(), {
        code: 'EXPORT_NOTHING_TO_EXPORT',
        omitted: rendered.omitted.length,
      });
    }
    const { dir, outputs } = await this.#destination(request, video.name, 'xmeml', 'xml', [], 1, () => ({
      start: 0,
      end: rendered.durationSec,
    }));
    const output = outputs[0]!;
    const snapshot: ExportSnapshot = {
      schema: 'cuccut.export-snapshot/1',
      videoId: video.id,
      videoName: video.name,
      videoRevision: video.revision,
      sequenceId,
      sequenceRevision: video.sequences[sequenceId]!.revision,
      settings,
      assets: frozenAssets(freeze),
      documents: [],
      parts: [{ ...output, plan: { clips: rendered.clips, omitted: rendered.omitted } }],
      output: { dir, overwrite: request.destination?.overwrite === true },
      frozenAt: nowIso(),
    };
    const run = async (task: TaskRun) => {
      for (const o of rendered.omitted) task.warn({ code: 'PROJECT_ITEM_OMITTED', detail: o.what, ...(o.whatRef ? { detailRef: o.whatRef } : {}) });
      throwIfAborted(task.signal);
      task.phase('generating', { done: 0, total: 1, unit: 'outputs' });
      const file = path.join(task.staging, '1.xml');
      await fs.writeFile(file, rendered.xml, 'utf8');
      task.phase('validating', { done: 0, total: 1, unit: 'outputs' });
      const text = await fs.readFile(file, 'utf8');
      const clips = (text.match(/<clipitem /g) ?? []).length;
      if (!text.startsWith('<?xml') || !text.trimEnd().endsWith('</xmeml>') || clips !== rendered.clips) {
        const failed = [{ fileName: output.fileName, code: 'EXPORT_VALIDATION_FAILED', problems: [RcExport.xmlIncomplete().text] }];
        return this.#publish(task, [], failed, dir, request);
      }
      const staged: Staged = {
        file,
        fileName: output.fileName,
        format: 'xml',
        media: { kind: 'project', clips, omitted: rendered.omitted.length, durationSec: rendered.durationSec },
        validation: {
          checks: ['parsed', 'clip-count'],
          expectedDurationSec: rendered.durationSec,
          durationSec: rendered.durationSec,
          toleranceSec: 0,
          expectedEntries: rendered.clips,
          entries: clips,
        },
      };
      return this.#publish(task, [staged], [], dir, request);
    };
    return this.#submit(request, settings, snapshot, outputs, dir, submitter, run);
  }

  // ---- Font inventory (`fonts.usage`) ----

  /**
   * Fonts used by the video (architecture design §9.1 `fonts.usage`): the same frozen input as finished-video export (the whole root sequence, burned-in subtitles) is handed to the Render Worker's `census`, which lays out the text and returns all the named faces and the kernel's fallback families. It does not preflight assets or encoders, create tasks or download anything. Fonts only look at text and subtitles: assets are not frozen (`skipAssets`), so the inventory works whether there are no assets, the asset files are missing, or they have changed.
   */
  async fontCensus(params: { videoId: Id; sequenceId?: Id; burnCaptions?: boolean }): Promise<Extract<WorkerEvent, { event: 'census' }>> {
    if (!this.#videos.mirror(params.videoId)) throw new RpcError('not-found', RcExport.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
    const workerCommand = this.#options.exportWorker?.() ?? null;
    if (!workerCommand) {
      throw new RpcError('conflict', RcExport.fontCensusNeedsWorker(), {
        code: 'EXPORT_TOOL_MISSING',
        missing: 'export-worker',
        remedy: workerRemedy(),
      });
    }
    const [ffmpeg, ffprobe] = await Promise.all([this.#options.ffmpeg(), this.#options.ffprobe()]);
    const worker: ToolCommand = { command: workerCommand, env: ffmpeg.env ?? process.env };
    let plan: VideoPlanResult;
    try {
      plan = await this.#plan<VideoPlanResult>(params.videoId, {
        kind: 'video',
        ...(params.sequenceId ? { sequenceId: params.sequenceId } : {}),
        ranges: [],
        skipAssets: true,
      });
    } catch (error) {
      // Empty sequence: no text to lay out.
      if (error instanceof RpcError && (error.details as { code?: string } | undefined)?.code === 'EXPORT_RANGE_EMPTY') {
        return { event: 'census', faces: [], fallback: FALLBACK_FONT_FAMILY };
      }
      throw error;
    }
    const size = plan.output;
    const output: VideoOutput = {
      format: 'mp4',
      codec: 'h264',
      width: size.width,
      height: size.height,
      picture: size.picture,
      fps: plan.fps,
      crf: null,
      bitrateKbps: null,
      audioBitrateKbps: DEFAULT_VIDEO_AUDIO_KBPS.mp4,
    };
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-font-census-'));
    const faces = new Map<string, Extract<WorkerEvent, { event: 'census' }>['faces'][number]>();
    let fallback = FALLBACK_FONT_FAMILY;
    try {
      for (const i of plan.parts.keys()) {
        const file = path.join(dir, `${i + 1}.json`);
        const input = workerInput({
          plan,
          part: i,
          assets: new Map(),
          output,
          outputPath: path.join(dir, 'out'),
          audioPath: null,
          burnCaptions: params.burnCaptions ?? true,
          onUnsupported: 'skip',
          ffmpeg: ffmpeg.command,
          ffprobe: ffprobe.command,
        });
        await fs.writeFile(file, JSON.stringify(input));
        let report: Extract<WorkerEvent, { event: 'census' }>;
        try {
          report = await runWorker(worker, 'census', file);
        } catch (error) {
          throw workerRpcError(error);
        }
        fallback = report.fallback;
        for (const face of report.faces) faces.set(`${face.family}\u0000${face.weight}\u0000${face.italic}`, face);
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
    return { event: 'census', faces: [...faces.values()], fallback };
  }

  // ---- Shared ----

  /** The engine's freeze; the engine's error codes are converted to the protocol's (`EXPORT_*` is a problem with the request; a changed linked asset is `ASSET_CHANGED`). */
  async #plan<T>(videoId: Id, params: Record<string, unknown>): Promise<T> {
    try {
      return await this.#videos.exportPlan<T>(videoId, params);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      const details = (error.details ?? {}) as { code?: string; details?: { reason?: string } };
      if (details.code === 'ASSET_MISSING' && details.details?.reason === 'changed') {
        throw new RpcError('conflict', error.message, { ...details, code: 'ASSET_CHANGED' }, error.messageRef);
      }
      if (details.code === 'ASSET_MISSING') throw new RpcError('conflict', error.message, details, error.messageRef);
      if (details.code?.startsWith('EXPORT_') || details.code === 'ITEM_NOT_FOUND')
        throw new RpcError('invalid-request', error.message, details, error.messageRef);
      throw error;
    }
  }

  /**
   * The target directory and each output's file name. Preflight checks that the directory is writable and that the given file name does not exist (unless overwrite). With no directory given, it is `exports/` under the source directory;
   * the internal check (`purpose: 'preview'`) uses `.cuccut-out/exports/`: Space does not scan directories whose names start with a dot, so check files do not mix into the deliverables.
   */
  async #destination(
    request: ExportCreateRequest,
    videoName: string,
    suffix: string,
    extension: string,
    ranges: ExportRange[],
    parts: number,
    rangeOf: (i: number) => ExportRange,
  ): Promise<{ dir: string; outputs: FrozenOutput[] }> {
    const destination = request.destination ?? {};
    const ref = this.#videos.ref(request.videoId)!;
    try {
      const fallback = request.settings.purpose === 'preview' ? path.join('.cuccut-out', 'exports') : 'exports';
      const dir = await prepareDirectory(destination.dir ?? path.join(sourceRoot(ref), fallback), destination.dir === undefined);
      const outputs = Array.from({ length: parts }, (_, i) => ({
        range: rangeOf(i),
        fileName:
          destination.fileName !== undefined
            ? withExtension(destination.fileName, extension)
            : defaultFileName(videoName, suffix, extension, ranges.length > 1, i),
      }));
      if (destination.fileName !== undefined) await checkFixedName(dir, outputs[0]!.fileName, destination.overwrite === true);
      return { dir, outputs };
    } catch (error) {
      if (error instanceof DestinationError) throw error.toRpc();
      throw error;
    }
  }

  async #submit(
    request: ExportCreateRequest,
    settings: ExportSettings,
    snapshot: ExportSnapshot,
    outputs: FrozenOutput[],
    dir: string,
    submitter: JobSubmitter,
    run: (task: TaskRun) => Promise<NonNullable<JobRecord['result']>>,
    resources?: TaskResources,
  ): Promise<{ jobId: Id }> {
    // An export this machine can never fit creates no task (`RESOURCE_ADMISSION_UNSATISFIABLE`) and leaves no snapshot either.
    const exceeded = resources ? this.#jobs.resources.check({ owner: '', label: `export:${settings.kind}`, ...resources }) : null;
    if (exceeded) {
      const { messageRef } = exceeded as { messageRef?: MessageRef };
      throw new RpcError('conflict', exceeded.message, { code: exceeded.code, dimensions: exceeded.dimensions }, messageRef);
    }
    const { artifactId } = await this.#jobs.artifacts.put(Buffer.from(`${JSON.stringify(snapshot)}\n`), 'json');
    const { jobId } = this.#jobs.submitTask(
      {
        kind: 'export',
        spec: { task: 'export', snapshotArtifactId: artifactId },
        videoId: request.videoId,
        // The input is the frozen snapshot: the same snapshot gives the same output.
        contentHash: artifactId,
        inputHash: `sha256:${sha256Hex(canonicalJson({ task: 'export', snapshotArtifactId: artifactId }))}`,
        providerId: 'local',
        modelId: `export:${settings.kind}`,
        extra: {
          export: {
            settings,
            snapshotArtifactId: artifactId,
            videoRevision: snapshot.videoRevision,
            sequenceId: snapshot.sequenceId,
            destination: { dir, files: outputs.map((o) => o.fileName), overwrite: request.destination?.overwrite === true },
          },
        },
        ...(request.commandId ? { commandId: request.commandId } : {}),
        queue: { key: 'export', concurrency: 2 },
        ...(resources ? { resources } : {}),
        run,
      },
      submitter,
    );
    this.#log.info('Export queued', {
      jobId,
      videoId: request.videoId,
      kind: settings.kind,
      outputs: outputs.length,
      videoRevision: snapshot.videoRevision,
    });
    return { jobId };
  }

  /** The cancellation check happens before publishing; once publishing starts it does not stop partway (a published file is the result). Each file is published and registered on its own. */
  async #publish(
    task: TaskRun,
    staged: Staged[],
    failed: Failed[],
    dir: string,
    request: ExportCreateRequest,
  ): Promise<NonNullable<JobRecord['result']>> {
    throwIfAborted(task.signal);
    task.phase('publishing');
    const outputs: GeneratedOutput[] = [];
    for (const item of staged) {
      try {
        const final = await publishFile(item.file, dir, item.fileName, {
          overwrite: request.destination?.overwrite === true,
          fixed: request.destination?.fileName !== undefined,
        });
        const artifact = await this.#jobs.artifacts.putFile(item.file, item.format as ArtifactExtension);
        outputs.push({
          artifactId: artifact.artifactId,
          mediaType: MEDIA_TYPES[item.format] ?? 'application/octet-stream',
          byteLength: artifact.byteLength,
          assetId: null,
          media: item.media,
          path: final,
          format: item.format,
          validation: item.validation,
        });
      } catch (error) {
        const code = error instanceof DestinationError ? error.code : 'EXPORT_PUBLISH_FAILED';
        failed.push({ fileName: item.fileName, code, problems: [error instanceof Error ? error.message : String(error)] });
      }
    }
    const result = outputs.length > 0 ? { documentId: null, artifactId: outputs[0]!.artifactId, outputs } : null;
    if (failed.length === 0 && result) return result;
    if (!result) {
      const code =
        failed.length === 1
          ? failed[0]!.code
          : failed.every((f) => f.code === failed[0]!.code)
            ? failed[0]!.code
            : 'EXPORT_VALIDATION_FAILED';
      const message =
        failed.length === 1
          ? RcExport.fileNotExported({
              fileName: failed[0]!.fileName,
              problems: failed[0]!.problems.join(RcExport.clauseSeparator().text),
            })
          : RcExport.noFilesExported();
      throw taskFailure(code, message, { failed });
    }
    throw taskFailure(
      'EXPORT_PARTIALLY_PUBLISHED',
      RcExport.partiallyPublished({ failed: failed.length, published: outputs.length }),
      { failed },
      result,
    );
  }
}

/** The frozen plan and preflighted documents for subtitles and text (`#planText`). */
interface FrozenText {
  plan: TextPlanResult;
  primary: PlannedDocument;
  secondary: PlannedDocument | undefined;
  /** Kind suffix for default file names: `transcript`; for subtitles, the language (bilingual is "primary-secondary"); `subtitles` when there is no language. */
  suffix: string;
  /** For text documents when not skipping the cut parts: the body of documents with timing (the transcript's comes from the plan; the subtitles' is read separately). */
  bodies: Map<Id, unknown>;
  /** Chapters on the sequence (markers with `kind: 'chapter'`), in sequence time (seconds), sorted by start. */
  chapters: TextChapter[];
  /** Fields in the document head that do not depend on the range (duration is calculated separately for each segment). */
  frontMatter: Omit<FrontMatter, 'duration'> & { sourceDuration: number | null };
}

/** Chapter markers on the sequence: frames converted to seconds, sorted by start; those without a title are dropped. */
function chapterMarkers(video: VideoSnapshot, plan: TextPlanResult): TextChapter[] {
  const markers = video.sequences[plan.sequenceId]?.markers ?? [];
  return markers
    .filter((m) => m.kind === 'chapter' && m.label.trim())
    .map((m) => ({ title: m.label.trim(), start: (m.frame * plan.fps.den) / plan.fps.num }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Document head metadata (Markdown text, `frontmatter`): the title is the video name; the source, author, publish date and platform come from the source of the assets recorded in the main document
 * (the `provenance.source` recorded on import from a link, video format spec §4.5); the language is the language of the main document and the translation. The video has no description, so `description` is not written.
 */
function frontMatterOf(
  video: VideoSnapshot,
  plan: TextPlanResult,
  primary: PlannedDocument,
  secondary: PlannedDocument | undefined,
): FrozenText['frontMatter'] {
  const assetId =
    primary.sourceAssetId ?? (primary.sourceDocumentId ? video.documents[primary.sourceDocumentId]?.sourceAssetId : undefined);
  const asset = assetId ? video.assets[assetId] : undefined;
  const revision = asset?.revisions[asset.currentRevision];
  const source = (revision?.provenance.source ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const uploaded = text(source.uploadDate);
  return {
    title: plan.videoName,
    description: null,
    source: text(source.webpageUrl) ?? text(source.url),
    author: text(source.uploader),
    // The download tool's `YYYYMMDD` is written as `YYYY-MM-DD`; other formats are kept as they are.
    published: uploaded && /^\d{8}$/.test(uploaded) ? `${uploaded.slice(0, 4)}-${uploaded.slice(4, 6)}-${uploaded.slice(6)}` : uploaded,
    platform: text(source.platform),
    language: primary.language ?? null,
    translation: secondary?.language ?? null,
    sourceDuration: revision?.duration ? Number(revision.duration.ticks) / revision.duration.timescale : null,
  };
}

/** Produces the body of segment `index`: both the export task and `exports.renderText` go only through here. */
function renderTextPart(frozen: FrozenText, settings: TextSettings, index: number): TextExportOutput {
  const { plan, primary, secondary } = frozen;
  const part = plan.parts[index]!;
  const transcript = settings.kind === 'transcript';
  const range = part.plans[0]!.range;
  const unprojected = transcript && settings.skipCut === false;
  // When not skipping the cut parts: the main document (and the other timed one) is replaced with the original text, without projection, and chapters are moved to the original text's clock.
  const whole = !settings.range && !settings.ranges;
  const primaryPlan = unprojected ? sourcePlan(frozen.bodies.get(primary.documentId), part.plans[0]!, whole) : part.plans[0]!;
  const secondaryPlan = part.plans[1] ?? null;
  const inRange = frozen.chapters
    .map((c) => ({ title: c.title, start: c.start - range.startSeconds }))
    .filter((c) => c.start >= 0 && c.start < range.durationSeconds);
  const chapters =
    !transcript || settings.chapters !== true ? null : unprojected ? sourceChapters(inRange, part.plans[0]!, primaryPlan) : inRange;
  const rangeDuration = unprojected
    ? Math.max(primaryPlan.range.durationSeconds, frozen.frontMatter.sourceDuration ?? 0)
    : range.durationSeconds;
  const { sourceDuration: _, ...meta } = frozen.frontMatter;
  return renderText({
    kind: settings.kind,
    format: settings.format,
    primary: { document: primary, plan: primaryPlan },
    secondary: secondary
      ? {
          document: secondary,
          plan: secondaryPlan && unprojected ? sourcePlan(frozen.bodies.get(secondary.documentId), secondaryPlan, whole) : secondaryPlan,
        }
      : null,
    style: plan.style?.body ?? null,
    canvas: plan.canvas,
    meta: {
      videoId: plan.videoId,
      videoName: plan.videoName,
      videoRevision: plan.videoRevision,
      sequenceId: plan.sequenceId,
      sequenceRevision: plan.sequenceRevision,
    },
    rangeDuration,
    ...(settings.maxCharsPerLine !== undefined ? { maxCharsPerLine: settings.maxCharsPerLine } : {}),
    ...(transcript && settings.timestamps !== undefined ? { timestamps: settings.timestamps } : {}),
    ...(transcript && settings.speakers !== undefined ? { speakers: settings.speakers } : {}),
    chapters,
    frontMatter:
      transcript && settings.frontmatter === true && settings.format === 'md'
        ? { ...meta, duration: transcriptStamp(rangeDuration) }
        : null,
  });
}

/** The default file name: "video name.suffix.extension" (finished video has no suffix: "video name.mp4"); when several ranges each produce one, `.partN` is added. */
function defaultFileName(videoName: string, suffix: string, extension: string, multiple: boolean, index: number): string {
  const stem = suffix ? `${safeFileStem(videoName)}.${suffix}` : safeFileStem(videoName);
  return `${stem}${multiple ? `.part${index + 1}` : ''}.${extension}`;
}

function kindUnsupported(kind: string): RpcError {
  return new RpcError('invalid-request', RcExport.exportKindUnsupported({ kind }), {
    code: 'EXPORT_KIND_UNSUPPORTED',
    kind,
    supported: SUPPORTED_EXPORT_KINDS,
  });
}

interface Staged {
  file: string;
  fileName: string;
  format: string;
  media: GeneratedOutput['media'];
  validation: NonNullable<GeneratedOutput['validation']>;
}

interface Failed {
  fileName: string;
  code: string;
  problems: string[];
}

/** The text for a sound-plan explanation code; an unrecognized code returns null (the code itself is used). */
function audioNoteText(code: string): Localized | null {
  switch (code) {
    case 'DUCK_NO_SPEECH':
      return RcExport.noteDuckNoSpeech();
    case 'HOLD_IS_SILENT':
      return RcExport.noteHoldIsSilent();
    case 'ASSET_HAS_NO_AUDIO':
      return RcExport.noteAssetHasNoAudio();
    case 'CROSSFADE_HANDLE_SHORT':
      return RcExport.noteCrossfadeHandleShort();
    default:
      return null;
  }
}

/** Turns an existing error into a task failure: if the error carries a reference, that reference is included too; otherwise its text is used as is. */
function taskFailureOf(code: string, error: unknown, details?: unknown, result?: ConstructorParameters<typeof TaskFailure>[3]): TaskFailure {
  const message = localizedOf(error);
  return typeof message === 'string' ? new TaskFailure(code, message, details, result) : taskFailure(code, message, details, result);
}

function itemKey(item: UnsupportedItem): string {
  return [item.scope, item.itemId, item.effectId ?? '', item.transitionId ?? ''].join('|');
}

/** A tool fails to start during the task (deleted or moved after submission): the remedy depends on which tool it is; if the Render Worker is missing, the user is not asked to install ffmpeg. */
function toolMissing(error: ToolFailure): TaskFailure {
  if (error.tool === 'export-worker') {
    return taskFailure('EXPORT_TOOL_MISSING', RcExport.workerGone({ error: localizedOf(error) }), {
      missing: 'export-worker',
      remedy: workerRemedy(),
    });
  }
  return taskFailureOf('EXPORT_TOOL_MISSING', error, { ...(error.tool ? { missing: error.tool } : {}), remedy: toolRemedy() });
}

/** A Worker failure during preflight is converted to the error from submission (no task is created). */
function workerRpcError(error: unknown): unknown {
  if (error instanceof WorkerFailure) {
    const kind = error.code === 'EXPORT_TOOL_MISSING' || error.code.startsWith('ASSET_') ? 'conflict' : 'invalid-request';
    return new RpcError(
      kind,
      error.message,
      {
        ...error.details,
        code: error.code,
        ...(error.code === 'EXPORT_TOOL_MISSING' ? { remedy: toolRemedy() } : {}),
      },
      error.messageRef,
    );
  }
  if (error instanceof ToolFailure) {
    const details = { code: 'EXPORT_TOOL_MISSING', missing: 'export-worker', remedy: workerRemedy() };
    return new RpcError('conflict', error.message, details, error.messageRef);
  }
  return error;
}

/** The asset version at freeze time (the location recorded in the export snapshot; the path is empty when unreadable). */
function frozenAssets(freeze: PackageFreeze): ExportSnapshot['assets'] {
  return freeze.assets.map((a) => ({
    assetId: a.assetId,
    revision: a.revision,
    name: a.name,
    storage: a.storage,
    path: a.path ?? '',
    contentHash: a.contentHash,
    byteLength: a.byteLength,
  }));
}

/** The `schema` in the document body (empty string when unreadable). */
function documentSchema(text: string): string {
  try {
    const schema = (JSON.parse(text) as { schema?: unknown }).schema;
    return typeof schema === 'string' ? schema : '';
  } catch {
    return '';
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new Error(RcCommon.cancelled().text);
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return `sha256:${hash.digest('hex')}`;
}

function assetChanged(asset: PlannedAsset): RpcError {
  return new RpcError('conflict', RcExport.linkedAssetContentChanged({ name: asset.name }), {
    code: 'ASSET_CHANGED',
    assetId: asset.assetId,
    revision: asset.revision,
    path: asset.path,
  });
}

/** Preflight: the content digest of the linked asset matches the registered one (the engine checks only existence and length). */
async function verifyLinked(asset: PlannedAsset): Promise<LinkedCheck> {
  const stat = await fs.stat(asset.path).catch(() => null);
  if (!stat?.isFile()) {
    throw new RpcError('conflict', RcExport.linkedAssetMissing({ name: asset.name }), {
      code: 'ASSET_MISSING',
      assetId: asset.assetId,
      path: asset.path,
    });
  }
  if ((await sha256File(asset.path)) !== asset.contentHash) throw assetChanged(asset);
  return { asset, size: stat.size, mtimeMs: stat.mtimeMs };
}

/** Before execution: if the file's length and modification time are unchanged, the digest is not recomputed. */
async function recheckLinked(check: LinkedCheck): Promise<void> {
  const stat = await fs.stat(check.asset.path).catch(() => null);
  const { name } = check.asset;
  const fail = (code: string, message: Localized) => taskFailure(code, message, { assetId: check.asset.assetId, path: check.asset.path });
  if (!stat?.isFile()) throw fail('ASSET_MISSING', RcExport.linkedAssetGoneBeforeExport({ name }));
  if (stat.size === check.size && stat.mtimeMs === check.mtimeMs) return;
  if (stat.size !== check.asset.byteLength || (await sha256File(check.asset.path)) !== check.asset.contentHash) {
    throw fail('ASSET_CHANGED', RcExport.linkedAssetChangedBeforeExport({ name }));
  }
}

/** The default main document (see `TextExportOptions.documentId`). */
function chooseDocument(video: VideoSnapshot, sequenceId: Id, settings: TextSettings): Id {
  const docs = Object.values(video.documents);
  const languageOk = (language: string | undefined) =>
    settings.language === undefined ||
    (language !== undefined && (language === settings.language || language.startsWith(`${settings.language}-`)));
  const sequence = video.sequences[sequenceId];
  if (!sequence) throw new RpcError('not-found', RcExport.sequenceMissing(), { code: 'ENTITY_NOT_FOUND', sequenceId });
  const shown = [
    ...new Set(
      sequence.items
        .filter((item): item is CaptionItem => item.type === 'caption' && item.enabled)
        .map((item) => item.documentId)
        .filter((id) => video.documents[id] && languageOk(video.documents[id]!.language)),
    ),
  ];
  const speech = docs.filter((d) => d.kind === 'speech' && languageOk(d.language)).map((d) => d.id);
  const order = settings.kind === 'transcript' ? [speech, shown] : [shown, speech];
  for (const candidates of order) {
    if (candidates.length === 1) return candidates[0]!;
    // Candidates also list the other group (the transcript when exporting subtitles, and the subtitles shown when exporting text): these can likewise be selected with documentId.
    if (candidates.length > 1) throw ambiguous(video, [...new Set([...order[0]!, ...order[1]!])]);
  }
  const message = settings.language ? RcExport.noSourceForLanguage({ language: settings.language }) : RcExport.noSource();
  throw new RpcError('not-found', message, {
    code: 'EXPORT_SOURCE_NOT_FOUND',
  });
}

/** The other document for a bilingual merge. */
function chooseSecondary(video: VideoSnapshot, primaryId: Id, bilingual: NonNullable<TextSettings['bilingual']>): Id {
  const explicit = typeof bilingual === 'object' ? bilingual : {};
  if (explicit.documentId !== undefined) {
    if (!video.documents[explicit.documentId]) throw new RpcError('not-found', RcExport.bilingualDocumentNotFound(), { code: 'EXPORT_SOURCE_NOT_FOUND' });
    if (explicit.documentId === primaryId) throw new RpcError('invalid-request', RcExport.bilingualNeedsOtherDocument());
    return explicit.documentId;
  }
  const primary = video.documents[primaryId];
  const languageOk = (language: string | undefined) =>
    explicit.language === undefined ||
    (language !== undefined && (language === explicit.language || language.startsWith(`${explicit.language}-`)));
  const translations = Object.values(video.documents).filter(
    (d) => d.kind === 'translation' && d.sourceDocumentId === primaryId && languageOk(d.language),
  );
  if (translations.length === 1) return translations[0]!.id;
  if (translations.length > 1)
    throw ambiguous(
      video,
      translations.map((d) => d.id),
    );
  // When there is no translation: the subtitles or transcript of the same asset in another language.
  const others = Object.values(video.documents).filter(
    (d) =>
      d.id !== primaryId &&
      (d.kind === 'caption' || d.kind === 'speech') &&
      d.language !== undefined &&
      d.language !== primary?.language &&
      (explicit.language === undefined ? true : languageOk(d.language)) &&
      (primary?.sourceAssetId === undefined || d.sourceAssetId === primary.sourceAssetId),
  );
  if (others.length === 1) return others[0]!.id;
  if (others.length > 1)
    throw ambiguous(
      video,
      others.map((d) => d.id),
    );
  throw new RpcError('not-found', RcExport.noBilingualCounterpart(), { code: 'EXPORT_SOURCE_NOT_FOUND' });
}

function ambiguous(video: VideoSnapshot, ids: Id[]): RpcError {
  return new RpcError('invalid-request', RcExport.sourceAmbiguous(), {
    code: 'EXPORT_SOURCE_AMBIGUOUS',
    candidates: ids.map((id) => {
      const d = video.documents[id]!;
      return { documentId: id, kind: d.kind, name: d.name, language: d.language ?? null };
    }),
  });
}

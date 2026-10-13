import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  refOf,
  type ExportFontFace,
  type ExportValidation,
  type GeneratedOutput,
  type Id,
  type Localized,
  type MessageRef,
  type VideoExportCodec,
  type VideoExportFormat,
} from '@cuccut/protocol';
import { RcCommon, RcExport } from '@cuccut/protocol/messages/runtime-core';
import { executableName, findBundledBinary } from '@cuccut/process-host';
import { ToolFailure, runTool, type MasterRunner, type ToolCommand } from './audio-export.ts';
import type { AudioPlan, PlanRange, PlannedAsset } from './export-plan.ts';

/**
 * Video export (architecture design §9.13): the picture is computed frame by frame by the Render Worker (`crates/export-worker`, a separate process), composited, and handed to ffmpeg for encoding. The sound is first mixed to WAV by audio export, and the Worker packages it in together. This is the Runtime side: the Worker's location, the input files, starting and stopping the process and cancelling it, and verifying the output with ffprobe before publishing (streams, frame count, size, frame rate, duration).
 */

/** The `video` plan from the engine's `exports.plan`. `document` is the part of the video used for computing frames one by one (this sequence and the asset records it references). */
export interface VideoPlanResult {
  videoId: Id;
  videoName: string;
  videoRevision: string;
  sequenceId: Id;
  sequenceRevision: string;
  fps: { num: number; den: number };
  canvas: { width: number; height: number };
  document: unknown;
  documents: FrozenDocument[];
  assets: Array<PlannedAsset & { video?: unknown }>;
  parts: Array<{ video: VideoPlan; audio: AudioPlan }>;
  /** The output size that was decided, and the position of the picture within it (`render_graph::video_plan::output_geometry`). */
  output: OutputGeometry;
  /** When the sequence has waveforms with `speaker` set and the video has transcripts: the intervals (seconds) during which each speaker talks on the sequence. Passed through to the Worker as-is. */
  speakers?: Record<string, Array<[number, number]>>;
}

/** A block of the picture in the output (pixels). */
export interface PictureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The output size: when the picture and the output are the same size, the picture fills it. When the aspect ratio differs from the canvas, the picture is centred with black bars elsewhere. `adjusted` means it was adjusted to make the dimensions even. */
export interface OutputGeometry {
  width: number;
  height: number;
  picture: PictureRect;
  adjusted: boolean;
}

export interface FrozenDocument {
  documentId: Id;
  kind: string | null;
  revision: string | null;
  schema: string | null;
  lineKind: 'original' | 'translation';
  /** The `sourceDocumentId` in the document header (used for subtitle words). The transcript containing the subtitle's words is also in the frozen document. */
  sourceDocumentId?: Id | null;
  sourceAssetId?: Id | null;
  body: unknown;
}

/** An overview of the picture over the range (`video_plan` in `render-graph`). */
export interface VideoPlan {
  sequenceId: Id;
  range: PlanRange & { start: MediaTimeJson; end: MediaTimeJson };
  fps: { num: number; den: number };
  canvas: { width: number; height: number; background: string; backgroundAlpha: number };
  layers: unknown[];
  transitions: Array<{ id: Id; kind: string; unsupported?: string }>;
  assets: Array<{ id: Id; revision: string }>;
  documents: Id[];
}

export interface MediaTimeJson {
  ticks: string;
  timescale: number;
}

/** One item that can't be drawn (the Worker's `UnsupportedItem`). */
export interface UnsupportedItem {
  itemId: Id;
  scope: 'layer' | 'effect' | 'transition' | 'asset';
  layerKind: string;
  effectId?: string;
  transitionId?: string;
  kind?: string;
  reason: string;
  message: string;
}

export interface VideoOutput {
  format: VideoExportFormat;
  codec: VideoExportCodec;
  width: number;
  height: number;
  /** A block of the picture in the output. It fills the output when the sizes match. */
  picture: PictureRect;
  fps: { num: number; den: number };
  crf: number | null;
  bitrateKbps: number | null;
  audioBitrateKbps: number;
}

export const DEFAULT_VIDEO_AUDIO_KBPS: Record<VideoExportFormat, number> = { mp4: 192, webm: 128 };

/**
 * Where the Render Worker is: the `CUCCUT_EXPORT_WORKER` environment variable. Or the `export-worker` next to the engine host (the output of the same cargo build, or both in `<resources>/bin` once packaged). Or the native program directory shipped with the app. Or, from this module, searching upward for the cargo output directory (during development, built by `npm run build:engine`).
 */
export function resolveExportWorkerCommand(engineHost: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CUCCUT_EXPORT_WORKER) return env.CUCCUT_EXPORT_WORKER;
  if (engineHost && path.isAbsolute(engineHost)) {
    const sibling = path.join(path.dirname(engineHost), executableName('export-worker'));
    if (fs.existsSync(sibling)) return sibling;
  }
  return findBundledBinary('export-worker', path.dirname(fileURLToPath(import.meta.url)), env);
}

/** A failure reported by the Worker. `code` is the protocol's error code, and `details.items` are the items that can't be drawn. */
export class WorkerFailure extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly messageRef: MessageRef | undefined;
  constructor(code: string, message: string | Localized, details: Record<string, unknown> = {}) {
    super(String(message));
    this.code = code;
    this.details = details;
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }
}

/** One line of output from the Worker. */
export type WorkerEvent =
  | {
      event: 'preflight';
      frames: number;
      items: UnsupportedItem[];
      warnings: Array<{ code: string; detail: string }>;
      missingEncoders: string[];
      /** A local font face that is needed (a family not in the fonts bundled with the rendering core). The Runtime freezes fonts by it. */
      faces?: Array<{ family: string; weight: number; italic: boolean }>;
    }
  | {
      /** `census`: all faces the video uses (`bundled` marks families shipped with the rendering core), and the core's fallback families (`fonts.usage`). */
      event: 'census';
      faces: Array<{ family: string; weight: number; italic: boolean; bundled: boolean }>;
      fallback: string;
    }
  | { event: 'progress'; frame: number; total: number }
  | {
      event: 'done';
      frames: number;
      skipped: UnsupportedItem[];
      warnings: Array<{ code: string; detail: string }>;
      decoderRestarts: number;
      renderSeconds: number;
      /**
       * Which path the picture's encoding and decoding took (architecture design §9.11 “picture”): the backend name (`avfoundation`, `media-foundation`, or `ffmpeg`; `mixed` when decoding mixes backends, and `decoder` is `null` when there is no video asset), and the record of any native fallback to ffmpeg. Older Workers don't report it, so it is optional. */
      video?: WorkerVideoBackends;
    }
  | { event: 'mastered'; frames: number; inputLufs: number; lufs: number; truePeak: number; staticGainDb: number }
  | { event: 'cancelled'; frame: number; total: number }
  | { event: 'error'; code: string; message: string; details: Record<string, unknown> | null };

/** `done.video`: the encoding and decoding backends and the fallback record. `reason` is an English code (such as `codec`, `odd-size`, `open-failed`, `alpha-unsupported`). */
export interface WorkerVideoBackends {
  decoder: string | null;
  encoder: string;
  fallbacks: Array<{ scope: 'decoder' | 'encoder'; assetId?: string; reason: string; message: string }>;
}

/** After a cancel, how long to wait for the Worker to clean up on its own (killing ffmpeg and deleting an unfinished output) before a forced kill. */
const CANCEL_GRACE_MS = 5_000;

/** On POSIX, the Worker forms its own process group, and the ffmpeg processes it starts are in that group. Windows has no process groups, so only the Worker itself can be killed. */
const PROCESS_GROUPS = process.platform !== 'win32';

/** Kills the Worker's entire process group (when the Worker has already exited, only the ffmpeg processes it left behind). Does nothing if the group is already gone. */
function killGroup(pid: number | undefined): void {
  if (!PROCESS_GROUPS || pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // ESRCH: no processes left in the group
  }
}

/** After a forced kill, waits at most this long for the process group to disappear. SIGKILL cannot be ignored and normally finishes within milliseconds; this only keeps an abnormal case from hanging the job. */
const GROUP_EXIT_WAIT_MS = 5_000;
const GROUP_POLL_MS = 20;

/**
 * Waits until the processes in the group have really exited (`kill(-pid, 0)` returns ESRCH). Sending SIGKILL doesn't mean the resources have been returned (architecture design §7.7), and the job's lease is released only after this. It has a cap: past it, the wait ends anyway. On Windows, which has no process group, it counts as finished once the Worker itself has exited.
 */
async function groupGone(pid: number | undefined): Promise<void> {
  if (!PROCESS_GROUPS || pid === undefined) return;
  const deadline = performance.now() + GROUP_EXIT_WAIT_MS;
  for (;;) {
    try {
      process.kill(-pid, 0);
    } catch {
      return;
    }
    if (performance.now() >= deadline) return;
    await new Promise((resolve) => setTimeout(resolve, GROUP_POLL_MS));
  }
}

/** The last line of a Worker subcommand that ended normally. */
type FinalEvent<C extends WorkerCommand> = Extract<
  WorkerEvent,
  { event: { preflight: 'preflight'; census: 'census'; render: 'done'; master: 'mastered' }[C] }
>;
type WorkerCommand = 'preflight' | 'census' | 'render' | 'master';
const FINAL_EVENT: Record<WorkerCommand, WorkerEvent['event']> = {
  preflight: 'preflight',
  census: 'census',
  render: 'done',
  master: 'mastered',
};

/**
 * Runs the Worker once (`preflight`, the `census` font glyph survey, `render`, or the loudness `master`), and returns its last line (`preflight`, `census`, `done`, or `mastered`). On cancel, it writes `cancel` to stdin, closes it, and waits for the process to exit (forced kill on timeout). Only then does it end with `ToolFailure('aborted')`. The caller then deletes the staging area, and must not race the Worker for files.
 *
 * The Worker creates its own process group, with itself as the leader (`detached`), so the decoding and encoding ffmpeg processes are in the group. When the Worker doesn't end normally (it crashed, was force-killed, or the cancel timed out), the whole group is killed before this Promise ends. When the Worker is killed with SIGKILL it has no chance to stop its child processes, so this keeps ffmpeg from being left as an orphan and from writing into staging after it has been deleted.
 */
export function runWorker<C extends WorkerCommand>(
  worker: ToolCommand,
  command: C,
  inputFile: string,
  options: { signal?: AbortSignal; onProgress?: (frame: number, total: number) => void } = {},
): Promise<FinalEvent<C>> {
  const { signal } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ToolFailure('aborted', RcCommon.cancelled()));
    const child = spawn(worker.command, [command, inputFile], {
      env: worker.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: PROCESS_GROUPS,
    });
    let final: WorkerEvent | null = null;
    let buffer = '';
    let stderr = '';
    let killTimer: NodeJS.Timeout | null = null;
    const onAbort = () => {
      child.stdin.end('cancel\n');
      killTimer = setTimeout(() => {
        child.kill('SIGKILL');
        killGroup(child.pid);
      }, CANCEL_GRACE_MS);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdin.on('error', () => {});
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      buffer += chunk;
      for (let newline = buffer.indexOf('\n'); newline >= 0; newline = buffer.indexOf('\n')) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event: WorkerEvent;
        try {
          event = JSON.parse(line) as WorkerEvent;
        } catch {
          continue;
        }
        if (event.event === 'progress') options.onProgress?.(event.frame, event.total);
        else final = event;
      }
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-16_384);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      signal?.removeEventListener('abort', onAbort);
      if (killTimer) clearTimeout(killTimer);
      reject(new ToolFailure(error.code === 'ENOENT' ? 'missing' : 'failed', RcExport.toolStartFailed({ tool: 'export-worker', error: error.message }), 'export-worker'));
    });
    child.once('close', (code, sig) => {
      signal?.removeEventListener('abort', onAbort);
      if (killTimer) clearTimeout(killTimer);
      const event = final as WorkerEvent | null;
      const clean = code === 0 && event?.event === FINAL_EVENT[command];
      const settle = () => {
        if (signal?.aborted) return reject(new ToolFailure('aborted', RcCommon.cancelled()));
        if (clean) return resolve(event as FinalEvent<C>);
        if (event?.event === 'error') return reject(new WorkerFailure(event.code, event.message, event.details ?? {}));
        // Exited without explanation (a crash, or killed): compositing runs in a separate process, so the Runtime is unaffected, and this one output counts as failed.
        const tail = stderr.trim().split('\n').slice(-3).join('\n');
        reject(new WorkerFailure('EXPORT_RENDER_FAILED', RcExport.workerExitedUnexpectedly({ signal: sig ?? null, code: String(code), output: tail })));
      };
      // A Worker that ended normally has already waited for its ffmpeg. In every other case (including cancel), kill whatever processes may remain in the group, and wait for them to really exit before ending.
      if (clean) return settle();
      killGroup(child.pid);
      void groupGone(child.pid).then(settle);
    });
    child.stdin.write('');
  });
}

/** Loudness mastering (`master` of `renderAudio`): runs the `master` subcommand in the Worker. Cancellation and process-group handling are the same as for `render`. */
export function masterRunner(worker: ToolCommand): MasterRunner {
  return (inputFile, signal, onProgress) => runWorker(worker, 'master', inputFile, { signal, ...(onProgress ? { onProgress } : {}) });
}

/** The ffprobe readings of a finished video. */
export interface ProbedVideo {
  durationSec: number;
  frames: number;
  width: number;
  height: number;
  fps: string;
  codec: string;
  videoDurationSec: number;
  audio: { codec: string; durationSec: number } | null;
  colorSpace: string | null;
}

/** ffprobe reads the finished video: its streams, frame count (counts packets, no decoding), size, frame rate, and duration. */
export async function probeVideo(ffprobe: ToolCommand, file: string, signal: AbortSignal): Promise<ProbedVideo> {
  const { stdout } = await runTool(
    ffprobe,
    ['-v', 'error', '-count_packets', '-show_streams', '-show_format', '-of', 'json', `file:${file}`],
    signal,
  );
  const parsed = JSON.parse(stdout) as {
    streams?: Array<Record<string, unknown>>;
    format?: { duration?: string };
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!video) throw new Error(RcExport.noVideoStream().text);
  const number = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? Number(v) : Number.NaN);
  // WebM (Matroska) streams have no duration. The time is in the `DURATION` tag (`HH:MM:SS.nnnnnnnnn`).
  const streamDuration = (stream: Record<string, unknown>) => {
    const direct = number(stream.duration);
    if (Number.isFinite(direct)) return direct;
    const tag = (stream.tags as Record<string, unknown> | undefined)?.DURATION;
    const match = typeof tag === 'string' ? /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(tag) : null;
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : Number.NaN;
  };
  return {
    durationSec: number(parsed.format?.duration),
    frames: number(video.nb_read_packets),
    width: number(video.width),
    height: number(video.height),
    fps: String(video.r_frame_rate ?? ''),
    codec: String(video.codec_name ?? ''),
    videoDurationSec: streamDuration(video),
    audio: audio ? { codec: String(audio.codec_name ?? ''), durationSec: streamDuration(audio) } : null,
    colorSpace: typeof video.color_space === 'string' ? video.color_space : null,
  };
}

const CODEC_NAMES: Record<VideoExportCodec, string> = { h264: 'h264', hevc: 'hevc', vp9: 'vp9' };

/** Verification before publishing: both streams are present, the frame count and duration differ by no more than one frame, and the size and frame rate match the settings. */
export function checkVideo(
  probed: ProbedVideo,
  expected: { frames: number; output: VideoOutput; audio: boolean },
): { problems: string[]; media: Extract<GeneratedOutput['media'], { kind: 'video' }>; validation: ExportValidation } {
  const { output } = expected;
  const frameSec = output.fps.den / output.fps.num;
  const expectedDuration = expected.frames * frameSec;
  const problems: string[] = [];
  if (Math.abs(probed.frames - expected.frames) > 1) problems.push(RcExport.frameCountMismatch({ actual: probed.frames, expected: expected.frames }).text);
  if (probed.width !== output.width || probed.height !== output.height)
    problems.push(
      RcExport.sizeMismatch({ width: probed.width, height: probed.height, expectedWidth: output.width, expectedHeight: output.height }).text,
    );
  const [num, den] = probed.fps.split('/').map(Number);
  if (!num || !den || Math.abs(num / den - output.fps.num / output.fps.den) > 1e-6)
    problems.push(RcExport.fpsMismatch({ actual: probed.fps, expected: `${output.fps.num}/${output.fps.den}` }).text);
  if (probed.codec !== CODEC_NAMES[output.codec]) problems.push(RcExport.codecMismatch({ actual: probed.codec, expected: output.codec }).text);
  const duration = Number.isFinite(probed.videoDurationSec) ? probed.videoDurationSec : probed.durationSec;
  if (!(Math.abs(duration - expectedDuration) <= frameSec + 1e-3))
    problems.push(RcExport.videoDurationMismatch({ actual: duration, expected: expectedDuration }).text);
  // Audio is padded to the encoder's frames (AAC 1024 samples, Opus 20 ms). The tolerance is 50 ms more than that.
  if (expected.audio && !probed.audio) problems.push(RcExport.noAudioInOutput().text);
  if (probed.audio && !(Math.abs(probed.audio.durationSec - expectedDuration) <= frameSec + 0.05))
    problems.push(RcExport.audioDurationMismatch({ actual: probed.audio.durationSec, expected: expectedDuration }).text);
  const streams = ['video', ...(probed.audio ? ['audio'] : [])];
  return {
    problems,
    media: {
      kind: 'video',
      durationSec: probed.durationSec,
      width: probed.width,
      height: probed.height,
      frames: probed.frames,
      fps: probed.fps,
      videoCodec: probed.codec,
      audioCodec: probed.audio?.codec ?? null,
    },
    validation: {
      checks: ['streams', 'frame-count', 'dimensions', 'frame-rate', 'codec', 'duration', ...(expected.audio ? ['audio-duration'] : [])],
      expectedDurationSec: expectedDuration,
      durationSec: duration,
      toleranceSec: frameSec,
      video: {
        expectedFrames: expected.frames,
        frames: probed.frames,
        width: probed.width,
        height: probed.height,
        fps: probed.fps,
        streams,
      },
    },
  };
}

/** The Worker's input file (`crates/export-worker/src/input.rs`). */
export function workerInput(options: {
  plan: VideoPlanResult;
  part: number;
  assets: Map<string, PlannedAsset>;
  output: VideoOutput;
  outputPath: string;
  audioPath: string | null;
  burnCaptions: boolean;
  onUnsupported: 'fail' | 'skip';
  /** Frozen local fonts (only the ones found; at preflight, not yet present). */
  fonts?: readonly ExportFontFace[];
  ffmpeg: string;
  ffprobe: string;
}): unknown {
  const { plan, output } = options;
  const video = plan.parts[options.part]!.video;
  return {
    document: plan.document,
    sequenceId: plan.sequenceId,
    range: { start: video.range.start, end: video.range.end },
    documents: plan.documents,
    ...(plan.speakers ? { speakers: plan.speakers } : {}),
    assets: [...options.assets.values()].map((a) => ({ assetId: a.assetId, revision: a.revision, path: a.path, mediaType: a.mediaType })),
    fonts: (options.fonts ?? []).flatMap((f) =>
      'path' in f
        ? [
            {
              family: f.family,
              weight: f.weight,
              italic: f.italic,
              path: f.path,
              faceIndex: f.faceIndex,
              contentHash: f.contentHash,
              byteLength: f.byteLength,
            },
          ]
        : [],
    ),
    output: {
      path: options.outputPath,
      format: output.format,
      codec: output.codec,
      width: output.width,
      height: output.height,
      picture: output.picture,
      fps: output.fps,
      ...(output.crf !== null ? { crf: output.crf } : {}),
      ...(output.bitrateKbps !== null ? { bitrateKbps: output.bitrateKbps } : {}),
      audio: options.audioPath ? { path: options.audioPath, bitrateKbps: output.audioBitrateKbps } : null,
    },
    burnCaptions: options.burnCaptions,
    onUnsupported: options.onUnsupported,
    tools: { ffmpeg: options.ffmpeg, ffprobe: options.ffprobe },
  };
}

/** Writes an item that can't be drawn as a task warning. */
export function skippedWarning(item: UnsupportedItem): { code: string; detail: string; detailRef: MessageRef } {
  const { message } = item;
  const detail =
    item.scope === 'effect'
      ? RcExport.contentSkippedEffect({ itemId: item.itemId, effectId: String(item.effectId), kind: String(item.kind), message })
      : item.scope === 'transition'
        ? RcExport.contentSkippedTransition({ transitionId: String(item.transitionId), kind: String(item.kind), message })
        : RcExport.contentSkippedItem({ itemId: item.itemId, layerKind: item.layerKind, message });
  return { code: 'EXPORT_CONTENT_SKIPPED', detail: detail.text, detailRef: refOf(detail) };
}

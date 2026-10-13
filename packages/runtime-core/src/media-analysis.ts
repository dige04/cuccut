import { execFile, spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RpcError, mediaTimeToSeconds, type AssetRevision, type MediaPeaks, type MediaThumbnail } from '@cuccut/protocol';
import type { Logger } from '@cuccut/harness';
import { resolveInside } from './media.ts';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';

/**
 * Material analysis (the timeline's waveforms and filmstrips) and Space thumbnails. The Runtime runs ffmpeg to compute them, and caches the results in the Runtime Home. Materials are keyed by content digest, and Space files by real path, size and modification time. The UI does not decode anything itself, since materials are often hundreds of MB and some are several GB.
 *
 * Security follows the same rules as the media channel:
 * - Input can only be a material version in the video. The file location comes from the engine's material record, and linked materials pass under the media channel's rules (`VideoService.mediaSource`, `VideoService.assetFileAt`). Or it is a Space entry's file given by the Space directory (`SpaceCatalog.locateBytes`). In both cases the real path is resolved again to confirm it lies inside the source directory.
 * - Only audio, video and common images are analyzed. A material's media type must be in `DEMUXERS`, and a Space file's extension must be in `FILE_FRAMES`. ffmpeg may use only the matching demuxer and may read only local files. Playlists and concat lists with a changed extension cannot be read, and ffmpeg does not follow them to other files or to the network.
 * - ffmpeg is started without a shell. Each process has a time limit and an output cap, and the number of processes running at once is capped.
 * - The cache directory name is the hex of the content digest. A malformed digest is rejected. Paths are not written to logs.
 */

/** The demuxers allowed for each media type (the closed set from the engine's `media_type_of`). Types not in the table are not analyzed. */
const DEMUXERS: Record<string, string> = {
  'video/mp4': 'mov',
  'video/quicktime': 'mov',
  'video/webm': 'matroska',
  'video/x-matroska': 'matroska',
  // `.m4a` is an MP4 container, and `.aac` is a raw ADTS stream.
  'audio/mp4': 'mov,aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
};

/**
 * Space thumbnails take a frame from a file (`fileFrame`): extension → demuxer. The same set as video and material analysis, plus AVI. For images, only the demuxer that reads a single image is used, and it is specified with `-f`. Otherwise ffmpeg would pick `image2` from the extension, which reads `%d` in a filename as a sequence and reads other files. The output is PNG, which can carry transparency.
 * Not taken: SVG (ffmpeg cannot decode it). HEIC and AVIF are often stored in tiles, and the ffmpeg at hand decodes only the first tile, so the picture would be wrong. Better to draw nothing than a wrong picture.
 */
const FILE_FRAMES: Record<string, { demuxers: string; still?: true; alpha?: true }> = {
  mp4: { demuxers: 'mov' },
  m4v: { demuxers: 'mov' },
  mov: { demuxers: 'mov' },
  webm: { demuxers: 'matroska' },
  mkv: { demuxers: 'matroska' },
  avi: { demuxers: 'avi' },
  png: { demuxers: 'png_pipe', still: true, alpha: true },
  jpg: { demuxers: 'jpeg_pipe', still: true },
  jpeg: { demuxers: 'jpeg_pipe', still: true },
  webp: { demuxers: 'webp_pipe', still: true, alpha: true },
  gif: { demuxers: 'gif', still: true, alpha: true },
  bmp: { demuxers: 'bmp_pipe', still: true },
};

/** Default peak density: 50 bins per second (the same as the old BCW1). */
export const PEAKS_PER_SECOND = 50;
/** Peaks are capped at this many bins (about 700 KB after base64). For long materials, lower the density. */
export const MAX_PEAKS = 2 ** 19;
/** Decoded to mono 8 kHz before peaks are taken. Only used for drawing waveforms, which is enough for that. */
const PEAKS_SAMPLE_RATE = 8000;
/** Width of thumbnails in pixels. The height follows the picture's aspect ratio. */
export const THUMBNAIL_WIDTH = 160;
/** Thumbnail times are rounded to this granularity (milliseconds), so the cache is effective. */
export const THUMBNAIL_STEP_MS = 100;

/** Height limit when taking a frame from a file. A very tall image is scaled down proportionally to this height (its width narrows accordingly), so the output does not get too large. */
const FRAME_MAX_HEIGHT_RATIO = 3;
/** Thumbnails for Space files are cached in this directory under the media cache, so they never share a name with the 64-character hex material directories. */
const FILE_FRAMES_DIR = 'files';

const PEAKS_FILE = 'peaks-v1.json';
const THUMBNAIL_TIMEOUT_MS = 20_000;
const THUMBNAIL_MAX_BYTES = 1024 * 1024;
/** Limit for a whole frame given to the agent (`videoFrame`). A PNG with a 1920 long edge fits. */
const FRAME_MAX_BYTES = 16 * 1024 * 1024;
const PEAKS_RETRY_MS = 1000;
/** After an analysis failure, requests within this time return the same error without starting ffmpeg again. */
const FAILURE_TTL_MS = 60_000;
/** ffmpeg output cap for shot cuts (bytes). With a very low threshold there is one line per frame, so stop when it is exceeded. */
const SCENE_OUTPUT_MAX_BYTES = 8 * 1024 * 1024;
/** Probing WebM codec and duration (`media.playback`): time limit and output cap. */
const PROBE_TIMEOUT_MS = 20_000;
const PROBE_MAX_BYTES = 64 * 1024;
/** Remember probe results for this many files. When there are more, clear everything and start over. */
const PROBE_CACHE_SIZE = 256;
/** After a compatibility copy finishes encoding, it still has to be verified and published. Encoding progress is reported only up to here. */
const PLAYBACK_PROGRESS_CAP = 0.99;

/** Result of `media.playback`. `original` means the client can play the original file directly, with no compatibility copy. */
export type PlaybackPreparation =
  | { status: 'original' }
  | { status: 'pending'; retryAfterMs: number; progress?: number }
  | { status: 'ready'; root: string; file: string };

/** Codec of the WebM source's first video and audio streams (ffprobe `codec_name`; null when there is no such stream), and its duration in seconds. */
interface PlaybackSource {
  video: string | null;
  audio: string | null;
  durationSec: number | null;
}

export interface MediaSource {
  /** A source directory and a file in it (relative or absolute path), the same handle as the media channel. */
  root: string;
  file: string;
  /** Record of a material version: content digest, media type and probed streams. */
  record: AssetRevision;
}

/** The fields needed to take a frame from a material version. A Space video cover has only these from the content index, so the whole record need not be read. */
export interface FrameAsset {
  contentHash: string;
  mediaType: string;
  durationSec: number | null;
}

/** One scene cut: seconds on the source clock, and the scene score (0–1). */
export interface SceneCut {
  at: number;
  score: number;
}

/** One frame after scaling down: encoded bytes and the actual pixel size. */
export interface MediaFrame {
  mimeType: 'image/jpeg' | 'image/png';
  data: Buffer;
  width: number;
  height: number;
}

/** ffmpeg output: the scaling filter and the encoding. */
interface FrameOutput {
  filter: string;
  format: 'jpeg' | 'png';
  /** Byte limit after encoding. Defaults to `THUMBNAIL_MAX_BYTES`. */
  maxBytes?: number;
}

export interface MediaAnalysisOptions {
  /** Cache directory: `<home>/cache/media`. */
  cacheDir: string;
  log: Logger;
  /** The ffmpeg executable and its environment (PATH must be able to find it). */
  ffmpeg: () => Promise<{ command: string; env: NodeJS.ProcessEnv }>;
  /**
   * ffprobe (as above). It probes the WebM codec and duration to decide whether the original file can be played directly, and to compute the progress of a compatibility copy.
   * When it is absent, a compatibility copy is always made, and no progress is reported.
   */
  ffprobe?: () => Promise<{ command: string; env: NodeJS.ProcessEnv }>;
  /** When peaks are not finished, wait this long before returning `pending`, so short materials get a result in one go. */
  peaksWaitMs?: number;
  /** Concurrent ffmpeg runs: peaks decode the whole audio track, while thumbnails decode only one frame. */
  peakSlots?: number;
  thumbnailSlots?: number;
}

/** Choose the peak density from the material's duration, so the total number of bins does not exceed `MAX_PEAKS`. */
export function peaksRate(durationSeconds: number | null): number {
  if (!durationSeconds || !(durationSeconds > 0)) return PEAKS_PER_SECOND;
  return Math.max(1, Math.min(PEAKS_PER_SECOND, Math.floor(MAX_PEAKS / durationSeconds)));
}

/** The time a thumbnail's frame is actually taken: rounded to `THUMBNAIL_STEP` and kept within the material's duration (past the end there is no frame). Returns milliseconds. */
export function thumbnailMillis(at: number, durationSeconds: number | null): number {
  const steps = Math.round((Math.max(0, at) * 1000) / THUMBNAIL_STEP_MS);
  const last =
    durationSeconds && durationSeconds > 0 ? Math.max(0, Math.floor(((durationSeconds - 0.05) * 1000) / THUMBNAIL_STEP_MS)) : Infinity;
  return Math.min(steps, last) * THUMBNAIL_STEP_MS;
}

/** The time the frame for the agent is actually taken: rounded to milliseconds and kept within the material's duration (past the end there is no frame). Returns milliseconds. */
export function frameMillis(at: number, durationSeconds: number | null): number {
  const millis = Math.round(Math.max(0, at) * 1000);
  const last = durationSeconds && durationSeconds > 0 ? Math.max(0, Math.floor((durationSeconds - 0.05) * 1000)) : Infinity;
  return Math.min(millis, last);
}

/** Cache directory name: the hex of the content digest. The digest comes from the video's material record. A malformed digest is rejected, so no other path can be built from it. */
export function cacheKeyOf(contentHash: string): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(contentHash);
  if (!match) throw new RpcError('invalid-request', RcRuntime.assetHashInvalid());
  return match[1]!;
}

/**
 * Folds a mono f32le sample stream into peaks. Bin `i` is the maximum absolute amplitude within the source time `[i, i+1) / binsPerSecond`. 0–255 maps to 0 through full scale.
 * Samples may be fed in as chunks, cut at any byte boundary.
 */
export class PeakReducer {
  readonly #sampleRate: number;
  readonly #binsPerSecond: number;
  readonly #maxBins: number;
  #bins = new Uint8Array(1024);
  #count = 0;
  #samples = 0;
  #carry: Buffer = Buffer.alloc(0);

  constructor(sampleRate: number, binsPerSecond: number, maxBins = MAX_PEAKS * 2) {
    this.#sampleRate = sampleRate;
    this.#binsPerSecond = binsPerSecond;
    this.#maxBins = maxBins;
  }

  push(chunk: Buffer): void {
    const data = this.#carry.length ? Buffer.concat([this.#carry, chunk]) : chunk;
    const whole = data.length - (data.length % 4);
    for (let offset = 0; offset < whole; offset += 4) {
      const bin = Math.floor((this.#samples * this.#binsPerSecond) / this.#sampleRate);
      this.#samples++;
      if (bin >= this.#maxBins) continue;
      const level = Math.round(Math.min(1, Math.abs(data.readFloatLE(offset)) || 0) * 255);
      if (bin >= this.#count) this.#grow(bin + 1);
      if (level > this.#bins[bin]!) this.#bins[bin] = level;
    }
    this.#carry = whole < data.length ? Buffer.from(data.subarray(whole)) : Buffer.alloc(0);
  }

  finish(): Uint8Array {
    return this.#bins.slice(0, this.#count);
  }

  #grow(count: number): void {
    if (count > this.#bins.length) {
      const next = new Uint8Array(Math.max(count, this.#bins.length * 2));
      next.set(this.#bins.subarray(0, this.#count));
      this.#bins = next;
    }
    this.#count = count;
  }
}

/** ffmpeg exited with a non-zero status (distinct from timeouts, not installed, and output overflow). Externally it is still a general `internal` error. */
class FfmpegExit extends RpcError {}

/** At most this many tasks run at once. The rest queue. */
class Slots {
  readonly #limit: number;
  #running = 0;
  readonly #waiting: (() => void)[] = [];

  constructor(limit: number) {
    this.#limit = Math.max(1, limit);
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.#running >= this.#limit) await new Promise<void>((resolve) => this.#waiting.push(resolve));
    this.#running++;
    try {
      return await task();
    } finally {
      this.#running--;
      this.#waiting.shift()?.();
    }
  }
}

export class MediaAnalysis {
  readonly #options: MediaAnalysisOptions;
  readonly #log: Logger;
  readonly #peakSlots: Slots;
  readonly #thumbnailSlots: Slots;
  readonly #playbackSlots = new Slots(1);
  readonly #playbackJobs = new Map<string, Promise<void>>();
  /** Probe results remembered by source file identity (the same as the cache key for compatibility copies). A failed probe records null. */
  readonly #playbackSources = new Map<string, Promise<PlaybackSource | null>>();
  /** How far (0–1) a compatibility copy being encoded has got, keyed by the copy file. */
  readonly #playbackProgress = new Map<string, number>();
  readonly #peakJobs = new Map<string, Promise<MediaPeaks>>();
  readonly #thumbnailJobs = new Map<string, Promise<Buffer>>();
  readonly #sceneJobs = new Map<string, Promise<SceneCut[]>>();
  readonly #failures = new Map<string, { at: number; error: RpcError }>();
  readonly #children = new Set<ChildProcess>();
  #closed = false;

  constructor(options: MediaAnalysisOptions) {
    this.#options = options;
    this.#log = options.log.child('media-analysis');
    this.#peakSlots = new Slots(options.peakSlots ?? 2);
    this.#thumbnailSlots = new Slots(options.thumbnailSlots ?? 3);
  }

  /**
   * The playback URL for WebM (architecture design §4.5). When the codecs of the first video and audio streams are both in `playable` (codecs the client can decode natively), it returns `original`, and the original file is played directly. Otherwise it uses the Runtime's own H.264/AAC compatibility copy cache, returning `pending` and the progress while encoding. It writes neither the project nor the original file.
   */
  async playback(realPath: string, playable: readonly string[] = []): Promise<PlaybackPreparation> {
    if (this.#closed) throw new RpcError('internal', RcRuntime.runtimeStopping());
    const identity = async () => {
      const stat = await fs.stat(realPath, { bigint: true }).catch(() => { throw new RpcError('not-found', RcRuntime.fileNotFound()); });
      return crypto.createHash('sha256').update(JSON.stringify(['webm-h264-aac-v1', realPath, String(stat.size), String(stat.mtimeNs)])).digest('hex');
    };
    const key = await identity();
    if (playable.length > 0) {
      const source = await this.#playbackSource(realPath, key);
      if (source && (source.video !== null || source.audio !== null) && [source.video, source.audio].every((codec) => codec === null || playable.includes(codec))) {
        return { status: 'original' };
      }
    }
    const root = path.join(this.#options.cacheDir, 'playback');
    const file = path.join(root, `${key}.mp4`);
    if ((await fs.stat(file).catch(() => null))?.size) return { status: 'ready', root, file };
    this.#recentFailure(file);
    if (!this.#playbackJobs.has(file)) {
      const job = this.#playbackSlots.run(async () => {
        if (await identity() !== key) throw new RpcError('not-found', RcRuntime.fileNotFound());
        await fs.mkdir(root, { recursive: true });
        const temporary = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp.mp4`;
        // Progress is the output time reported by `-progress`, divided by the source duration. It is not reported when the duration cannot be probed.
        const total = (await this.#playbackSource(realPath, key))?.durationSec ?? null;
        let carry = '';
        try {
          await this.#ffmpeg({ realPath, demuxers: 'matroska,webm' }, [
            '-y', '-map', '0:v:0?', '-map', '0:a:0?', '-sn', '-dn',
            '-vf', "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-threads', '2', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
            '-progress', 'pipe:1', '-nostats', temporary,
          ], {
            timeoutMs: 2 * 60 * 60 * 1000,
            onData: (chunk) => {
              if (!total) return;
              const lines = (carry + chunk.toString('latin1')).split('\n');
              carry = lines.pop() ?? '';
              for (const line of lines) {
                // `out_time_ms` is misnamed: it is also in microseconds. Newer ffmpeg also has `out_time_us`.
                const micros = /^out_time_(?:us|ms)=(\d+)\s*$/.exec(line)?.[1];
                if (micros) this.#playbackProgress.set(file, Math.min(PLAYBACK_PROGRESS_CAP, Number(micros) / 1e6 / total));
              }
            },
          });
          // Decode the first samples of both optional streams before atomic publication.
          await this.#ffmpeg({ realPath: temporary, demuxers: 'mov,mp4,m4a,3gp,3g2,mj2' }, [
            '-map', '0:v:0?', '-map', '0:a:0?', '-t', '0.1', '-f', 'null', '-',
          ], { timeoutMs: 60_000, onData: () => {} });
          if (await identity() !== key) throw new RpcError('not-found', RcRuntime.fileNotFound());
          await fs.rename(temporary, file);
        } finally {
          this.#playbackProgress.delete(file);
          await fs.rm(temporary, { force: true });
        }
      }).catch((error: unknown) => {
        if (error instanceof RpcError) throw error;
        // Filesystem failures must not expose Runtime cache or linked-source paths.
        const reason = (error as NodeJS.ErrnoException)?.code ?? 'Error';
        throw new RpcError('internal', RcRuntime.ffmpegCannotRun({ reason }));
      });
      this.#remember(file, job, this.#playbackJobs);
    }
    const progress = this.#playbackProgress.get(file);
    return { status: 'pending', retryAfterMs: 250, ...(progress !== undefined ? { progress } : {}) };
  }

  /** The codec and duration of the source file, remembered by identity. Concurrent requests share one probe. null when there is no ffprobe, the probe fails, or the result is not recognized. */
  #playbackSource(realPath: string, key: string): Promise<PlaybackSource | null> {
    let probe = this.#playbackSources.get(key);
    if (!probe) {
      probe = this.#probeWebm(realPath).catch((error: unknown) => {
        // Paths are not written, since error messages may contain them.
        this.#log.warn('ffprobe failed', { error: (error as NodeJS.ErrnoException)?.code ?? (error as Error)?.name ?? 'Error' });
        return null;
      });
      if (this.#playbackSources.size >= PROBE_CACHE_SIZE) this.#playbackSources.clear();
      this.#playbackSources.set(key, probe);
    }
    return probe;
  }

  /** Runs one ffprobe: no shell, reads local files only, and uses only the Matroska / WebM demuxer. */
  async #probeWebm(realPath: string): Promise<PlaybackSource | null> {
    if (!this.#options.ffprobe || this.#closed) return null;
    const { command, env } = await this.#options.ffprobe();
    const args = [
      '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'matroska,webm',
      '-show_entries', 'stream=codec_type,codec_name:format=duration', '-of', 'json', `file:${realPath}`,
    ];
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(command, args, { env, timeout: PROBE_TIMEOUT_MS, maxBuffer: PROBE_MAX_BYTES, windowsHide: true }, (error, out) => {
        this.#children.delete(child);
        if (error) reject(error);
        else resolve(out);
      });
      this.#children.add(child);
    });
    const parsed = JSON.parse(stdout) as { streams?: { codec_type?: unknown; codec_name?: unknown }[]; format?: { duration?: unknown } };
    const first = (type: string) => {
      const name = parsed.streams?.find((stream) => stream.codec_type === type)?.codec_name;
      return typeof name === 'string' ? name : null;
    };
    const duration = Number(parsed.format?.duration);
    return { video: first('video'), audio: first('audio'), durationSec: Number.isFinite(duration) && duration > 0 ? duration : null };
  }

  /** Peaks of a material's audio. With no cache, starts the analysis and waits a short while. If it is not finished, returns `pending`. */
  async peaks(source: MediaSource): Promise<MediaPeaks> {
    const { record } = source;
    const demuxers = demuxersOf(record);
    const { realPath } = await resolveInside(source.root, source.file);
    if (!record.audio) return { status: 'no-audio' };
    const file = path.join(this.#options.cacheDir, cacheKeyOf(record.contentHash), PEAKS_FILE);
    const cached = await readPeaks(file);
    if (cached) return cached;
    this.#recentFailure(file);

    let job = this.#peakJobs.get(file);
    if (!job) {
      const started = this.#peakSlots.run(() => this.#computePeaks(realPath, demuxers, record, file));
      job = this.#remember(file, started, this.#peakJobs);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waited = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), this.#options.peaksWaitMs ?? 1500);
    });
    try {
      return (await Promise.race([job, waited])) ?? { status: 'pending', retryAfterMs: PEAKS_RETRY_MS };
    } finally {
      clearTimeout(timer);
    }
  }

  /** One frame of a video material at source time `at`, scaled down to a small JPEG. */
  async thumbnail(source: MediaSource, at: number): Promise<MediaThumbnail> {
    const { record } = source;
    const demuxers = demuxersOf(record);
    const { realPath } = await resolveInside(source.root, source.file);
    if (!record.video) throw new RpcError('invalid-request', RcRuntime.assetHasNoPicture());
    const millis = thumbnailMillis(at, record.duration ? mediaTimeToSeconds(record.duration) : null);
    const file = path.join(this.#options.cacheDir, cacheKeyOf(record.contentHash), `thumb-${millis}.jpg`);
    const cached = await fs.readFile(file).catch(() => null);
    if (cached) return { mimeType: 'image/jpeg', data: cached.toString('base64'), at: millis / 1000 };
    this.#recentFailure(file);
    let job = this.#thumbnailJobs.get(file);
    if (!job) {
      const output: FrameOutput = { filter: `scale=${THUMBNAIL_WIDTH}:-2`, format: 'jpeg' };
      const started = this.#thumbnailSlots.run(() => this.#computeFrame({ realPath, demuxers, seekMs: millis }, output, file));
      job = this.#remember(file, started, this.#thumbnailJobs);
    }
    return { mimeType: 'image/jpeg', data: (await job).toString('base64'), at: millis / 1000 };
  }

  /**
   * One frame of a video material at source time `at`, scaled to at most `width` wide (the Space video cover). Cached by content digest (`thumb-<ms>-w<width>.jpg`, kept apart from the filmstrip's). When the cache has it, `locate` is not called, so the file need not be found. Finding the file and running ffmpeg share the thumbnail concurrency slots.
   */
  async assetFrame(
    asset: FrameAsset,
    at: number,
    width: number,
    locate: () => Promise<{ root: string; file: string }>,
  ): Promise<MediaFrame> {
    const demuxers = DEMUXERS[asset.mediaType];
    if (!demuxers) throw new RpcError('forbidden', RcRuntime.onlyAudioVideoAnalyzable());
    const millis = thumbnailMillis(at, asset.durationSec);
    const file = path.join(this.#options.cacheDir, cacheKeyOf(asset.contentHash), `thumb-${millis}-w${width}.jpg`);
    const cached = await fs.readFile(file).catch(() => null);
    if (cached) return frameOf(cached);
    this.#recentFailure(file);
    let job = this.#thumbnailJobs.get(file);
    if (!job) {
      const started = this.#thumbnailSlots.run(async () => {
        const { root, file: target } = await locate();
        const { realPath } = await resolveInside(root, target);
        return this.#computeFrame({ realPath, demuxers, seekMs: millis }, boxedOutput(width, 'jpeg'), file);
      });
      job = this.#remember(file, started, this.#thumbnailJobs);
    }
    return frameOf(await job);
  }

  /**
   * One frame of a video material at source time `at`, for the agent to look at (`videos_frames`). It is scaled to at most `box.width` wide and `box.height` high (never enlarged), and encoded as PNG or JPEG. Time is in milliseconds (not the filmstrip's 100 ms granularity), kept within the material's duration. Cached by content digest (`frame-<ms>-<width>x<height>.<format>`, kept apart from thumbnails). When cached, `locate` is not called. The output cap is larger than for thumbnails, since a full PNG often exceeds 1 MB.
   */
  async videoFrame(
    asset: FrameAsset,
    at: number,
    box: { width: number; height: number; format: 'jpeg' | 'png' },
    locate: () => Promise<{ root: string; file: string }>,
  ): Promise<MediaFrame> {
    const demuxers = DEMUXERS[asset.mediaType];
    if (!demuxers) throw new RpcError('forbidden', RcRuntime.onlyAudioVideoAnalyzable());
    const millis = frameMillis(at, asset.durationSec);
    const ext = box.format === 'png' ? 'png' : 'jpg';
    const file = path.join(this.#options.cacheDir, cacheKeyOf(asset.contentHash), `frame-${millis}-${box.width}x${box.height}.${ext}`);
    const cached = await fs.readFile(file).catch(() => null);
    if (cached) return frameOf(cached);
    this.#recentFailure(file);
    let job = this.#thumbnailJobs.get(file);
    if (!job) {
      const output: FrameOutput = {
        filter: `scale=w='min(${box.width},iw)':h='min(${box.height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
        format: box.format,
        maxBytes: FRAME_MAX_BYTES,
      };
      const started = this.#thumbnailSlots.run(async () => {
        const { root, file: target } = await locate();
        const { realPath } = await resolveInside(root, target);
        return this.#computeFrame({ realPath, demuxers, seekMs: millis }, output, file);
      });
      job = this.#remember(file, started, this.#thumbnailJobs);
    }
    return frameOf(await job);
  }

  /**
   * Shot cuts (`videos_shots`) within `[fromSec, fromSec + durSec)` on the source clock of a video material. ffmpeg scales the picture to 160 wide and uses `select='gt(scene,T)'` to pick the frames whose scene score exceeds `threshold`. `metadata=print` writes the time and score to stdout. After the input-side `-ss`, pts starts from 0, so the returned `at` has `fromSec` added back (seconds on the source clock). Decoding the whole range shares concurrency slots with waveform peaks, and the timeout is extended with the duration. Results are cached by content digest, range and threshold. `select` and `scene` exist in early ffmpeg versions; `scdet`, which needs 4.4, is not used.
   */
  async sceneCuts(
    asset: FrameAsset,
    options: { fromSec: number; durSec: number; threshold: number },
    locate: () => Promise<{ root: string; file: string }>,
  ): Promise<SceneCut[]> {
    const demuxers = DEMUXERS[asset.mediaType];
    if (!demuxers) throw new RpcError('forbidden', RcRuntime.onlyAudioVideoAnalyzable());
    const from = Math.max(0, options.fromSec);
    const dur = Math.max(0, options.durSec);
    const key = `scenes-${from.toFixed(6)}-${dur.toFixed(6)}-${options.threshold.toFixed(4)}.json`;
    const file = path.join(this.#options.cacheDir, cacheKeyOf(asset.contentHash), key);
    const cached = await readSceneCuts(file);
    if (cached) return cached;
    this.#recentFailure(file);
    let job = this.#sceneJobs.get(file);
    if (!job) {
      const started = this.#peakSlots.run(async () => {
        const { root, file: target } = await locate();
        const { realPath } = await resolveInside(root, target);
        return this.#computeSceneCuts(realPath, demuxers, { from, dur, threshold: options.threshold }, file);
      });
      job = this.#remember(file, started, this.#sceneJobs);
    }
    return job;
  }

  /**
   * One frame of a video or image file in Space, scaled to at most `width` wide (never enlarged). A video takes the frame at `at` seconds. If that is unavailable (for example, the video is shorter), it falls back to the first frame. An image takes its first frame. The cache key is the real path, size, modification time, width and time, so the frame is taken again after the file is overwritten.
   */
  async fileFrame(target: { root: string; file: string }, options: { at: number; width: number }): Promise<MediaFrame> {
    const { realPath } = await resolveInside(target.root, target.file);
    const spec = FILE_FRAMES[path.extname(realPath).slice(1).toLowerCase()];
    if (!spec) throw new RpcError('forbidden', RcRuntime.noFramesForFileType());
    const stat = await fs.stat(realPath);
    const millis = spec.still ? null : thumbnailMillis(options.at, null);
    const format = spec.alpha ? 'png' : 'jpeg';
    const key = crypto
      .createHash('sha256')
      .update(JSON.stringify([realPath, stat.size, stat.mtimeMs, options.width, millis, format]))
      .digest('hex');
    const file = path.join(this.#options.cacheDir, FILE_FRAMES_DIR, `${key}.${format === 'png' ? 'png' : 'jpg'}`);
    const cached = await fs.readFile(file).catch(() => null);
    if (cached) return frameOf(cached);
    this.#recentFailure(file);
    let job = this.#thumbnailJobs.get(file);
    if (!job) {
      const output = boxedOutput(options.width, format);
      const input = { realPath, demuxers: spec.demuxers, ...(spec.still ? { force: true } : {}) };
      const started = this.#thumbnailSlots.run(async () => {
        try {
          return await this.#computeFrame({ ...input, seekMs: millis }, output, file);
        } catch (error) {
          // If the video is shorter than the requested time, fall back to the first frame. When seeking past the end, ffmpeg either writes nothing or exits because the encoder cannot open. No retry after a timeout.
          const pastEnd = error instanceof FfmpegExit || (error instanceof RpcError && error.code === 'not-found');
          if (!millis || !pastEnd) throw error;
          return this.#computeFrame({ ...input, seekMs: 0 }, output, file);
        }
      });
      job = this.#remember(file, started, this.#thumbnailJobs);
    }
    return frameOf(await job);
  }

  /** Runtime stop: ends the ffmpeg processes still running. */
  close(): void {
    this.#closed = true;
    for (const child of this.#children) child.kill('SIGKILL');
    this.#children.clear();
  }

  async #computePeaks(realPath: string, demuxers: string, record: AssetRevision, file: string): Promise<MediaPeaks> {
    const duration = record.duration ? mediaTimeToSeconds(record.duration) : null;
    const binsPerSecond = peaksRate(duration);
    const reducer = new PeakReducer(PEAKS_SAMPLE_RATE, binsPerSecond);
    const started = Date.now();
    await this.#ffmpeg(
      { realPath, demuxers },
      ['-map', '0:a:0', '-vn', '-sn', '-dn', '-ac', '1', '-ar', String(PEAKS_SAMPLE_RATE), '-f', 'f32le', 'pipe:1'],
      {
        // Audio decoding is usually more than 100 times faster than real time, so leave ample margin. Long materials get a longer time limit.
        timeoutMs: 120_000 + (duration ?? 0) * 200,
        onData: (chunk) => reducer.push(chunk),
      },
    );
    const bins = reducer.finish();
    const result: MediaPeaks = bins.length
      ? { status: 'ready', binsPerSecond, peaks: Buffer.from(bins).toString('base64') }
      : { status: 'no-audio' };
    await writeAtomic(file, JSON.stringify(result));
    this.#log.info('Computed waveform peaks', { bins: bins.length, binsPerSecond, ms: Date.now() - started });
    return result;
  }

  async #computeSceneCuts(
    realPath: string,
    demuxers: string,
    range: { from: number; dur: number; threshold: number },
    file: string,
  ): Promise<SceneCut[]> {
    const started = Date.now();
    const cuts: SceneCut[] = [];
    let pending: number | null = null;
    let rest = '';
    let size = 0;
    const line = (text: string) => {
      const pts = /pts_time:(-?[\d.]+(?:e[-+]?\d+)?)/.exec(text);
      if (pts) {
        pending = Number(pts[1]);
        return;
      }
      const score = /lavfi\.scene_score=([\d.]+(?:e[-+]?\d+)?)/.exec(text);
      if (score && pending !== null && Number.isFinite(pending)) {
        cuts.push({ at: range.from + pending, score: Number(score[1]) });
        pending = null;
      }
    };
    await this.#ffmpeg(
      // `-ss` and `-t` go before the input, so it seeks to a nearby keyframe through the index and decodes only that segment.
      { realPath, demuxers, before: ['-ss', range.from.toFixed(6), '-t', range.dur.toFixed(6)] },
      [
        ...['-map', '0:v:0', '-an', '-sn', '-dn'],
        ...['-vf', `scale=160:-2,select='gt(scene,${range.threshold})',metadata=mode=print:file=-`],
        ...['-f', 'null', '-'],
      ],
      {
        // Video decoding is much slower than audio, so the time limit is extended to 1 second per second of duration. After scaling down it is usually more than 10 times faster.
        timeoutMs: 60_000 + range.dur * 1000,
        onData: (chunk) => {
          size += chunk.length;
          if (size > SCENE_OUTPUT_MAX_BYTES) throw new RpcError('internal', RcRuntime.ffmpegCannotRead());
          const lines = (rest + chunk.toString('utf8')).split('\n');
          rest = lines.pop() ?? '';
          for (const text of lines) line(text);
        },
      },
    );
    if (rest) line(rest);
    await writeAtomic(file, JSON.stringify(cuts));
    this.#log.info('Detected scene changes', { cuts: cuts.length, seconds: range.dur, ms: Date.now() - started });
    return cuts;
  }

  /** Takes one frame, encodes it as JPEG or PNG, and writes it to the cache. When `seekMs` is null, there is no seek (images). */
  async #computeFrame(
    input: { realPath: string; demuxers: string; force?: boolean; seekMs: number | null },
    output: FrameOutput,
    file: string,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const before = [
      // `-ss` goes before the input, so it seeks to the nearby keyframe through the index and decodes up to that frame. Multi-GB files are not read from the start.
      ...(input.seekMs !== null ? ['-ss', (input.seekMs / 1000).toFixed(3)] : []),
      ...(input.force ? ['-f', input.demuxers] : []),
    ];
    const codec = output.format === 'png' ? ['-c:v', 'png'] : ['-q:v', '5', '-c:v', 'mjpeg'];
    await this.#ffmpeg(
      { realPath: input.realPath, demuxers: input.demuxers, before },
      ['-map', '0:v:0', '-frames:v', '1', '-vf', output.filter, '-f', 'image2pipe', ...codec, 'pipe:1'],
      {
        timeoutMs: THUMBNAIL_TIMEOUT_MS,
        onData: (chunk) => {
          size += chunk.length;
          if (size > (output.maxBytes ?? THUMBNAIL_MAX_BYTES)) throw new RpcError('internal', RcRuntime.thumbnailTooLarge());
          chunks.push(chunk);
        },
      },
    );
    const bytes = Buffer.concat(chunks);
    if (!imageSize(bytes)) throw new RpcError('not-found', RcRuntime.noFrameAtTime());
    await writeAtomic(file, bytes);
    return bytes;
  }

  /** Runs one ffmpeg: no shell, reads local files only, and uses only the given demuxer. Output goes to `onData`. If it throws, the process ends. */
  #ffmpeg(
    input: { realPath: string; demuxers: string; before?: string[] },
    output: string[],
    { timeoutMs, onData }: { timeoutMs: number; onData: (chunk: Buffer) => void },
  ): Promise<void> {
    if (this.#closed) return Promise.reject(new RpcError('internal', RcRuntime.runtimeStopping()));
    return this.#options.ffmpeg().then(
      ({ command, env }) =>
        new Promise<void>((resolve, reject) => {
          if (this.#closed) return reject(new RpcError('internal', RcRuntime.runtimeStopping()));
          const args = [
            '-nostdin',
            '-hide_banner',
            '-v',
            'error',
            '-protocol_whitelist',
            'file',
            '-format_whitelist',
            input.demuxers,
            ...(input.before ?? []),
            '-i',
            `file:${input.realPath}`,
            ...output,
          ];
          const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
          this.#children.add(child);
          let failure: RpcError | null = null;
          let stderr = '';
          const fail = (error: RpcError) => {
            failure ??= error;
            child.kill('SIGKILL');
          };
          const timer = setTimeout(() => fail(new RpcError('internal', RcRuntime.ffmpegTimeout())), timeoutMs);
          child.stdout.on('data', (chunk: Buffer) => {
            if (failure) return;
            try {
              onData(chunk);
            } catch (error) {
              fail(error instanceof RpcError ? error : new RpcError('internal', String(error)));
            }
          });
          child.stderr.on('data', (chunk: Buffer) => {
            if (stderr.length < 4096) stderr += chunk.toString('utf8');
          });
          child.on('error', (error: NodeJS.ErrnoException) => {
            clearTimeout(timer);
            this.#children.delete(child);
            reject(
              error.code === 'ENOENT'
                ? new RpcError('internal', RcRuntime.ffmpegMissing())
                : new RpcError('internal', RcRuntime.ffmpegCannotRun({ reason: error.message })),
            );
          });
          child.on('close', (code) => {
            clearTimeout(timer);
            this.#children.delete(child);
            if (failure) return reject(failure);
            if (code === 0) return resolve();
            // stderr contains the input file's path, so it is replaced in logs and errors.
            const detail = stderr.split(input.realPath).join('<asset>').trim().split('\n').at(-1) ?? '';
            this.#log.warn('ffmpeg failed', { code, detail });
            reject(new FfmpegExit('internal', RcRuntime.ffmpegCannotRead()));
          });
        }),
    );
  }

  /** Registers an in-progress task. It is removed from the table when done. Failures are remembered for a while. */
  #remember<T>(key: string, started: Promise<T>, jobs: Map<string, Promise<T>>): Promise<T> {
    const job = started.finally(() => jobs.delete(key));
    job.catch((error: unknown) => {
      const rpc = error instanceof RpcError ? error : new RpcError('internal', String(error));
      this.#failures.set(key, { at: Date.now(), error: rpc });
    });
    jobs.set(key, job);
    return job;
  }

  #recentFailure(key: string): void {
    const failed = this.#failures.get(key);
    if (!failed) return;
    if (Date.now() - failed.at < FAILURE_TTL_MS) throw failed.error;
    this.#failures.delete(key);
  }
}

/** Scales to at most `width` wide and `width * FRAME_MAX_HEIGHT_RATIO` high, keeping the proportions. No enlargement. Width and height are rounded to even numbers. */
function boxedOutput(width: number, format: FrameOutput['format']): FrameOutput {
  const height = width * FRAME_MAX_HEIGHT_RATIO;
  return {
    filter: `scale=w='min(${width},iw)':h='min(${height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
    format,
  };
}

function frameOf(bytes: Buffer): MediaFrame {
  const size = imageSize(bytes);
  if (!size) throw new RpcError('internal', RcRuntime.cachedThumbnailBroken());
  return { mimeType: size.mimeType, data: bytes, ...size.dims };
}

/** Pixel size of a PNG or JPEG (reads the file header, no decoding). null if it is not recognized. */
export function imageSize(bytes: Buffer): { mimeType: MediaFrame['mimeType']; dims: { width: number; height: number } } | null {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString('latin1', 12, 16) === 'IHDR') {
    return { mimeType: 'image/png', dims: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } };
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  // Searches for the frame header segment by segment (SOF0–SOF15, excluding DHT, JPG and DAC).
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset++;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { mimeType: 'image/jpeg', dims: { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) } };
    }
    offset += 2 + length;
  }
  return null;
}

function demuxersOf(record: AssetRevision): string {
  const demuxers = DEMUXERS[record.mediaType];
  if (!demuxers) throw new RpcError('forbidden', RcRuntime.onlyAudioVideoAnalyzable());
  return demuxers;
}

async function readSceneCuts(file: string): Promise<SceneCut[] | null> {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
    if (!Array.isArray(value)) return null;
    const ok = value.every(
      (c: SceneCut) => c && typeof c.at === 'number' && Number.isFinite(c.at) && typeof c.score === 'number' && Number.isFinite(c.score),
    );
    return ok ? (value as SceneCut[]) : null;
  } catch {
    return null;
  }
}

async function readPeaks(file: string): Promise<MediaPeaks | null> {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8')) as MediaPeaks;
    if (value.status === 'no-audio') return value;
    if (value.status === 'ready' && Number.isInteger(value.binsPerSecond) && value.binsPerSecond > 0 && typeof value.peaks === 'string')
      return value;
    return null;
  } catch {
    return null;
  }
}

/** Writes to a temporary file first, then renames it, so a reader sees either the complete file or none. */
async function writeAtomic(file: string, data: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, data);
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

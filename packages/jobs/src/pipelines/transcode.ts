import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RpcError, type GeneratedOutput, type TranscodeParams, type TranscodeSummary } from '@cuccut/protocol';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import { JobsTranscode } from '@cuccut/protocol/messages/jobs/transcode.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';
import { ffmpegVersion, probeMedia, runFfmpeg, type MediaToolResolver, type ProbedMedia } from './ffmpeg.ts';
import { fileInputSchema, rejectUnresolvedEntry } from './entry-input.ts';
import { ParamReader, invalid } from './params.ts';
import { PipelineStepError, type PipelineDefinition, type PipelineStepContext } from './pipeline.ts';
import { ensureSaveDirectory, ensureSaveDirectoryForStep } from './save-location.ts';
import { transcodeDemand } from '../resource-profiles.ts';

/**
 * File transcoding (architecture design §7.9): file to file; creates no video, does not go through the video render pipeline, and is run by the ffmpeg on PATH.
 *
 * Steps: read (ffprobe each input; when merging, decide between stream copy and re-encoding, and decide for each input when extracting audio) → encode (written to staging, reporting seconds via `-progress`)
 * → verify (ffprobe can read it, it has video, codec and height meet the requirements, duration is within tolerance; audio extraction checks only duration and the audio track)
 * → publish (moved to the output directory, existing files are not overwritten).
 * Output is recorded as a generation record with no video: each item in `result.outputs` carries `path` (the absolute path of the output file), and `artifactId` is a digest of the file content.
 */

export const TRANSCODE_PIPELINE = 'transcode';

export interface TranscodeDeps {
  ffmpeg: MediaToolResolver;
  ffprobe: MediaToolResolver;
  /**
   * When publishing, try a hard link first (atomic on the same filesystem, does not overwrite); when `false`, go straight to the cross-filesystem method: claim the target file name,
   * copy to a temporary file in the same directory, then rename it over the placeholder. For tests.
   */
  hardLink?: boolean;
  /**
   * The save location when `outDir` is not given (§7.9 “save location”; the Runtime decides from settings and the host); frozen into the parameters at submission. When not wired up (only in unit tests),
   * it is written next to the source file.
   */
  saveDirectory?: () => string;
}

/** Frozen parameters: defaults are already filled in. */
export interface FrozenTranscodeParams extends TranscodeParams {
  codec: 'h264' | 'hevc';
  audioBitrateKbps: number;
}

/** Codecs that can be stream-copied when merging: MP4 can hold them, and all segments match. */
const COPYABLE_VIDEO = new Set(['h264', 'hevc']);
const COPYABLE_AUDIO = new Set(['aac', 'mp3', 'alac']);
const DEFAULT_CRF = { h264: 23, hevc: 28 } as const;
const MERGE_SAMPLE_RATE = 48000;

/**
 * Audio codecs that can be copied unchanged when extracting audio (§7.9), and their containers; other codecs are re-encoded to AAC in `.m4a`.
 */
const AUDIO_CONTAINERS: Readonly<Record<string, { ext: string; mediaType: string }>> = {
  aac: { ext: '.m4a', mediaType: 'audio/mp4' },
  mp3: { ext: '.mp3', mediaType: 'audio/mpeg' },
  opus: { ext: '.ogg', mediaType: 'audio/ogg' },
  flac: { ext: '.flac', mediaType: 'audio/flac' },
};
const AAC_CONTAINER = AUDIO_CONTAINERS.aac!;

/** How one input's audio track is extracted: stream-copied into the matching container, or re-encoded to AAC (`reason` gives the cause). */
export interface AudioExtractDecision {
  copy: boolean;
  ext: string;
  mediaType: string;
  reason: string | null;
}

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    // i18n-ignore-start: parameter descriptions (JSON Schema for the agent)
    inputs: {
      type: 'array',
      items: fileInputSchema('Absolute path of the input file', 'Video file, export or audio Space entry'),
      minItems: 1,
      maxItems: 100,
    },
    action: {
      type: 'string',
      enum: ['compress', 'merge', 'extract-audio'],
      description: 'compress: compress each file; merge: merge the files in order into one file; extract-audio: extract the audio track from each file',
    },
    codec: { type: 'string', enum: ['h264', 'hevc'], default: 'h264' },
    maxHeight: { type: 'integer', minimum: 16, maximum: 8640, description: 'Maximum frame height (pixels)' },
    crf: { type: 'integer', minimum: 0, maximum: 51, description: 'Constant quality; choose either this or videoBitrateKbps' },
    videoBitrateKbps: { type: 'integer', minimum: 100, maximum: 200000 },
    audioBitrateKbps: { type: 'integer', minimum: 32, maximum: 1024, default: 128 },
    outDir: { type: 'string', description: 'Absolute path of the output directory (created if missing); if omitted, the save location is the downloads.directory setting (default: the host’s Downloads folder)' },
    // i18n-ignore-end
  },
  required: ['inputs', 'action'],
  additionalProperties: false,
};

interface ProbeOutput extends Record<string, unknown> {
  media: ProbedMedia[];
  /** Input file size and modification time: checked on retry; if they changed, the file is read again. */
  stats: Array<{ size: number; mtimeMs: number }>;
  mode: TranscodeSummary['mode'];
  reason: string | null;
  /** Audio extraction: the approach for each input, matching `media` one to one. */
  audio?: AudioExtractDecision[];
}

interface EncodeOutput extends Record<string, unknown> {
  /** Output files in staging, and the duration of each corresponding input (the total when merging). */
  files: Array<{ file: string; expectedSec: number; source: string }>;
  version: string;
  /** Command summary: inputs and the manifest keep only file names; outputs in staging keep the full path, and are replaced with the published file name on completion. */
  commands: string[][];
}

interface VerifyOutput extends Record<string, unknown> {
  media: Array<Extract<GeneratedOutput['media'], { kind: 'video' | 'audio' }>>;
}

interface PublishOutput extends Record<string, unknown> {
  outputs: GeneratedOutput[];
}

export function transcodePipeline(deps: TranscodeDeps): PipelineDefinition<FrozenTranscodeParams> {
  return {
    name: TRANSCODE_PIPELINE,
    label: () => JobsTranscode.label(),
    description: () => JobsTranscode.description(),
    paramsSchema: PARAMS_SCHEMA,
    parse: parseTranscodeParams,
    async prepare(params) {
      for (const file of params.inputs) {
        const stat = await fs.stat(file).catch(() => null);
        if (!stat?.isFile()) throw new RpcError('not-found', JobsTranscode.inputNotFound({ file }));
      }
      // Save location (§7.9): use it when given, otherwise the Runtime's save location; frozen at submission, created if it does not exist, rejected if not writable.
      const outDir = params.outDir ?? deps.saveDirectory?.();
      if (outDir !== undefined) await ensureSaveDirectory(outDir);
      let version: string;
      try {
        version = await ffmpegVersion(deps.ffmpeg);
      } catch (error) {
        if (error instanceof PipelineStepError) {
          const remedy = error.details?.remedy;
          throw new RpcError('conflict', error.message, { code: error.code, ...(typeof remedy === 'string' ? { remedy } : {}) });
        }
        throw error;
      }
      const stats = await Promise.all(params.inputs.map((f) => fs.stat(f)));
      const identity = params.inputs.map((file, i) => ({ file, size: stats[i]!.size, mtimeMs: stats[i]!.mtimeMs }));
      return {
        params: outDir !== undefined ? { ...params, outDir } : params,
        providerId: 'ffmpeg',
        modelId: version,
        videoId: null,
        contentHash: `sha256:${sha256Hex(canonicalJson(identity))}`,
      };
    },
    steps: [
      {
        name: 'probe',
        label: () => JobsTranscode.stepProbe(),
        run: async ({ params, signal, progress }) => {
          progress({ done: 0, total: params.inputs.length, unit: 'units' }, 'probing');
          const media: ProbedMedia[] = [];
          for (const file of params.inputs) {
            const probed = await probeMedia(deps.ffprobe, file, signal);
            if (params.action === 'extract-audio') {
              if (!probed.audio) throw new PipelineStepError('TRANSCODE_NO_AUDIO', JobsTranscode.noAudioTrack({ name: path.basename(file) }), { file });
            } else if (!probed.video) {
              throw new PipelineStepError('INPUT_UNREADABLE', JobsTranscode.noVideoTrack({ name: path.basename(file) }), { file });
            }
            media.push(probed);
            progress({ done: media.length, total: params.inputs.length, unit: 'units' });
          }
          const stats = await Promise.all(params.inputs.map(async (f) => fs.stat(f)));
          const audio = params.action === 'extract-audio' ? media.map((m) => extractAudioDecision(m.audio!)) : undefined;
          const decision =
            params.action === 'merge'
              ? mergeDecision(media)
              : audio
                ? extractAudioSummary(params.inputs, audio)
                : { mode: 're-encode' as const, reason: null };
          const output: ProbeOutput = {
            media,
            stats: stats.map((s) => ({ size: s.size, mtimeMs: s.mtimeMs })),
            mode: decision.mode,
            reason: decision.reason,
            ...(audio ? { audio } : {}),
          };
          return { output };
        },
        reusable: async (output, { params }) => {
          const recorded = (output as ProbeOutput).stats;
          for (const [i, file] of params.inputs.entries()) {
            const stat = await fs.stat(file).catch(() => null);
            if (!stat || stat.size !== recorded[i]?.size || stat.mtimeMs !== recorded[i]?.mtimeMs) return false;
          }
          return true;
        },
      },
      {
        name: 'encode',
        label: () => JobsTranscode.stepEncode(),
        // ffmpeg's peak requirement (§7.7): estimate staging from the total size of the inputs.
        resources: (_params, outputs) => ({
          demand: transcodeDemand((outputs.probe as ProbeOutput).stats.reduce((sum, s) => sum + s.size, 0)),
        }),
        run: (context) => encode(deps, context),
        reusable: async (output) => {
          for (const { file } of (output as EncodeOutput).files) if (!(await fs.stat(file).catch(() => null))) return false;
          return true;
        },
      },
      {
        name: 'verify',
        label: () => JobsTranscode.stepVerify(),
        run: async ({ params, outputs, signal, progress }) => {
          const encoded = outputs.encode as EncodeOutput;
          progress(null, 'validating');
          const media: VerifyOutput['media'] = [];
          for (const item of encoded.files) {
            const probed = await probeMedia(deps.ffprobe, item.file, signal).catch((error: unknown) => {
              if (error instanceof PipelineStepError && error.code === 'INPUT_UNREADABLE') return null;
              throw error;
            });
            const problems =
              params.action === 'extract-audio'
                ? audioVerifyProblems(probed, item.expectedSec)
                : verifyProblems(probed, item.expectedSec, params, (outputs.probe as ProbeOutput).mode);
            if (problems.length > 0) {
              throw new PipelineStepError('EXPORT_VALIDATION_FAILED', JobsTranscode.verifyFailed({ name: path.basename(item.source) }), { problems });
            }
            if (params.action === 'extract-audio') {
              const audio = probed!.audio!;
              media.push({ kind: 'audio', durationSec: probed!.durationSec, sampleRate: audio.sampleRate, channels: audio.channels });
              continue;
            }
            media.push({
              kind: 'video',
              durationSec: probed!.durationSec,
              width: probed!.video!.width,
              height: probed!.video!.height,
              videoCodec: probed!.video!.codec,
              audioCodec: probed!.audio?.codec ?? null,
            });
          }
          return { output: { media } satisfies VerifyOutput };
        },
      },
      {
        name: 'publish',
        label: () => JobsTranscode.stepPublish(),
        run: async ({ params, outputs, signal, progress, jobId }) => {
          const encoded = outputs.encode as EncodeOutput;
          const verified = outputs.verify as VerifyOutput;
          progress(null, 'publishing');
          const published: GeneratedOutput[] = [];
          const audio = (outputs.probe as ProbeOutput).audio;
          if (params.outDir !== undefined) await ensureSaveDirectoryForStep(params.outDir);
          for (const [index, item] of encoded.files.entries()) {
            signal.throwIfAborted();
            const dir = params.outDir ?? path.dirname(item.source);
            const stem = path.parse(item.source).name;
            const { name, ext, mediaType } = outputName(params.action, stem, audio?.[index]);
            const file = await publishFile(item.file, dir, name, ext, jobId, deps.hardLink ?? true);
            const { size, digest } = await digestFile(file);
            published.push({
              artifactId: `sha256:${digest}`,
              mediaType,
              byteLength: size,
              assetId: null,
              media: verified.media[index]!,
              path: file,
            });
          }
          const output: PublishOutput = { outputs: published };
          return { output, result: { documentId: null, artifactId: published[0]!.artifactId, outputs: published } };
        },
      },
    ],
    async complete({ params, outputs }) {
      const probed = outputs.probe as ProbeOutput;
      const encoded = outputs.encode as EncodeOutput;
      const published = (outputs.publish as PublishOutput).outputs;
      // The output in the summary uses the final file name (a number may have been added on publish to avoid a clash), not the temporary name in staging.
      const finalNames = new Map(encoded.files.map((f, i) => [f.file, path.basename(published[i]!.path!)]));
      const commands = encoded.commands.map((command) => command.map((arg) => finalNames.get(arg) ?? arg));
      const summary: TranscodeSummary = {
        action: params.action,
        mode: probed.mode,
        reason: probed.reason,
        executor: { tool: 'ffmpeg', version: encoded.version, commands },
        files: published.map((o) => o.path!),
      };
      return { summary: { ...summary }, result: { documentId: null, artifactId: published[0]!.artifactId, outputs: published } };
    },
  };
}

export function parseTranscodeParams(raw: Record<string, unknown>): FrozenTranscodeParams {
  const reader = new ParamReader(raw, ['inputs', 'action', 'codec', 'maxHeight', 'crf', 'videoBitrateKbps', 'audioBitrateKbps', 'outDir']);
  const inputs = reader.array('inputs', { min: 1, max: 100 })!;
  for (const input of inputs) {
    rejectUnresolvedEntry('inputs', input);
    if (typeof input !== 'string' || !path.isAbsolute(input)) throw invalid('inputs', JobsParams.itemsMustBeAbsolutePaths());
  }
  const action = reader.oneOf('action', ['compress', 'merge', 'extract-audio'] as const);
  if (!action) throw invalid('action', JobsTranscode.actionShape());
  if (action === 'merge' && inputs.length < 2) throw invalid('inputs', JobsTranscode.mergeNeedsTwo());
  const codec = reader.oneOf('codec', ['h264', 'hevc'] as const) ?? 'h264';
  const maxHeight = reader.int('maxHeight', 16, 8640);
  const crf = reader.int('crf', 0, 51);
  const videoBitrateKbps = reader.int('videoBitrateKbps', 100, 200000);
  if (crf !== undefined && videoBitrateKbps !== undefined) throw invalid('crf', JobsParams.onlyOneOf({ other: 'videoBitrateKbps' }));
  const audioBitrateKbps = reader.int('audioBitrateKbps', 32, 1024) ?? 128;
  const outDir = reader.string('outDir', { optional: true, max: 4096 });
  if (outDir !== undefined && !path.isAbsolute(outDir)) throw invalid('outDir', JobsParams.mustBeAbsolutePath());
  return {
    inputs: inputs as string[],
    action,
    codec,
    ...(maxHeight !== undefined ? { maxHeight } : {}),
    ...(videoBitrateKbps !== undefined ? { videoBitrateKbps } : { crf: crf ?? DEFAULT_CRF[codec] }),
    audioBitrateKbps,
    ...(outDir !== undefined ? { outDir } : {}),
  };
}

/**
 * Audio extraction (§7.9): AAC, MP3, Opus and FLAC are stream-copied into their matching containers; other codecs are re-encoded to AAC (`.m4a`), with the reason given
 * (recorded in the summary: text generated in the current language).
 */
export function extractAudioDecision(audio: NonNullable<ProbedMedia['audio']>): AudioExtractDecision {
  const container = AUDIO_CONTAINERS[audio.codec];
  if (container) return { copy: true, ...container, reason: null };
  return { copy: false, ...AAC_CONTAINER, reason: JobsTranscode.audioReencode({ codec: audio.codec }).text };
}

/** Overall approach to audio extraction: `stream-copy` when everything is stream-copied; where anything is re-encoded, `reason` states each case. */
function extractAudioSummary(inputs: string[], decisions: AudioExtractDecision[]): { mode: TranscodeSummary['mode']; reason: string | null } {
  const reasons = decisions.flatMap((d, i) =>
    d.copy ? [] : [JobsTranscode.fileReason({ name: path.basename(inputs[i]!), reason: d.reason ?? '' }).text],
  );
  return reasons.length === 0
    ? { mode: 'stream-copy', reason: null }
    : { mode: 're-encode', reason: reasons.join(JobsTranscode.reasonSeparator().text) };
}

/**
 * Output file name (without number), extension and media type: compression `<源文件名>-compressed.mp4`, merging `<第一个源文件名>-merged.mp4`,
 * audio extraction `<源文件名>` plus the extension of the chosen container.
 */
export function outputName(
  action: TranscodeParams['action'],
  stem: string,
  audio: AudioExtractDecision | undefined,
): { name: string; ext: string; mediaType: string } {
  if (action === 'extract-audio') {
    const container = audio ?? { ...AAC_CONTAINER };
    return { name: stem, ext: container.ext, mediaType: container.mediaType };
  }
  return { name: action === 'merge' ? `${stem}-merged` : `${stem}-compressed`, ext: '.mp4', mediaType: 'video/mp4' };
}

/** Whether merging can stream-copy: codec, resolution, frame rate, pixel format, sample rate and channels all match across segments, and the codec fits in MP4. `reason` is text generated in the current language. */
export function mergeDecision(media: ProbedMedia[]): { mode: TranscodeSummary['mode']; reason: string | null } {
  const first = media[0]!;
  const differences: string[] = [];
  const fields: Array<[string, (m: ProbedMedia) => unknown]> = [
    [JobsTranscode.fieldVideoCodec().text, (m) => m.video?.codec],
    [JobsTranscode.fieldResolution().text, (m) => (m.video ? `${m.video.width}x${m.video.height}` : null)],
    [JobsTranscode.fieldFrameRate().text, (m) => m.video?.frameRate],
    [JobsTranscode.fieldPixelFormat().text, (m) => m.video?.pixFmt],
    [JobsTranscode.fieldAudioTrack().text, (m) => (m.audio ? JobsTranscode.present().text : null)],
    [JobsTranscode.fieldAudioCodec().text, (m) => m.audio?.codec ?? null],
    [JobsTranscode.fieldSampleRate().text, (m) => m.audio?.sampleRate ?? null],
    [JobsTranscode.fieldChannels().text, (m) => m.audio?.channels ?? null],
  ];
  const absent = JobsTranscode.absent().text;
  for (const [field, get] of fields) {
    const values = media.map(get);
    if (values.some((v) => v !== values[0])) {
      differences.push(JobsTranscode.fieldMismatch({ field, values: values.map((v) => String(v ?? absent)).join(' / ') }).text);
    }
  }
  if (differences.length > 0) return { mode: 're-encode', reason: differences.join(JobsTranscode.reasonSeparator().text) };
  if (!COPYABLE_VIDEO.has(first.video!.codec)) return { mode: 're-encode', reason: JobsTranscode.videoNotMp4({ codec: first.video!.codec }).text };
  if (first.audio && !COPYABLE_AUDIO.has(first.audio.codec)) {
    return { mode: 're-encode', reason: JobsTranscode.audioNotMp4({ codec: first.audio.codec }).text };
  }
  return { mode: 'stream-copy', reason: null };
}

async function encode(deps: TranscodeDeps, context: PipelineStepContext<FrozenTranscodeParams>): Promise<{ output: EncodeOutput }> {
  const { params, outputs, signal, staging, progress } = context;
  const probed = outputs.probe as ProbeOutput;
  const version = await ffmpegVersion(deps.ffmpeg);
  const total = probed.media.reduce((sum, m) => sum + m.durationSec, 0);
  const files: EncodeOutput['files'] = [];
  const commands: string[][] = [];
  const paths = new Set<string>(params.inputs);
  let base = 0;
  const report = (seconds: number) => progress({ done: Math.min(total, base + seconds), total, unit: 'seconds' }, 'encoding');
  report(0);

  const run = async (args: string[], out: string) => {
    commands.push(summarize(args, paths));
    try {
      await runFfmpeg(deps.ffmpeg, args, { signal, onTime: report });
    } catch (error) {
      await fs.rm(out, { force: true });
      throw error;
    }
  };

  if (params.action === 'extract-audio') {
    for (const [index, input] of params.inputs.entries()) {
      const decision = probed.audio![index]!;
      const out = path.join(staging, `audio-${index + 1}${decision.ext}`);
      await run(extractAudioArgs(params, input, decision, out), out);
      files.push({ file: out, expectedSec: probed.media[index]!.durationSec, source: input });
      base += probed.media[index]!.durationSec;
    }
  } else if (params.action === 'compress') {
    for (const [index, input] of params.inputs.entries()) {
      const out = path.join(staging, `compressed-${index + 1}.mp4`);
      await run(compressArgs(params, input, out), out);
      files.push({ file: out, expectedSec: probed.media[index]!.durationSec, source: input });
      base += probed.media[index]!.durationSec;
    }
  } else {
    const out = path.join(staging, 'merged.mp4');
    if (probed.mode === 'stream-copy') {
      const list = path.join(staging, 'concat.txt');
      await fs.writeFile(list, params.inputs.map((f) => `file '${f.replace(/'/g, `'\\''`)}'\n`).join(''));
      paths.add(list);
      await run(
        [
          '-hide_banner',
          '-v',
          'error',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          list,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          ...TAIL,
          out,
        ],
        out,
      );
    } else {
      await run(mergeArgs(params, probed.media, out), out);
    }
    files.push({ file: out, expectedSec: total, source: params.inputs[0]! });
  }
  return { output: { files, version, commands } };
}

/** Progress is written to standard output, not as stats lines; outputs in staging may be overwritten (on retry). */
const TAIL = ['-progress', 'pipe:1', '-nostats', '-y'];

function videoCodecArgs(params: FrozenTranscodeParams): string[] {
  const codec = params.codec === 'hevc' ? ['-c:v', 'libx265', '-tag:v', 'hvc1', '-x265-params', 'log-level=error'] : ['-c:v', 'libx264'];
  const rate = params.videoBitrateKbps !== undefined ? ['-b:v', `${params.videoBitrateKbps}k`] : ['-crf', String(params.crf)];
  return [...codec, '-preset', 'medium', ...rate, '-pix_fmt', 'yuv420p'];
}

function audioCodecArgs(params: FrozenTranscodeParams): string[] {
  return ['-c:a', 'aac', '-b:a', `${params.audioBitrateKbps}k`];
}

function compressArgs(params: FrozenTranscodeParams, input: string, out: string): string[] {
  // Height is the smaller of the cap and the original height, rounded to an even number (4:2:0 requires it); width is scaled proportionally and rounded to an even number.
  const height = params.maxHeight !== undefined ? `trunc(min(ih\\,${params.maxHeight})/2)*2` : 'trunc(ih/2)*2';
  return [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    `file:${input}`,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale=-2:${height}`,
    ...videoCodecArgs(params),
    ...audioCodecArgs(params),
    '-movflags',
    '+faststart',
    ...TAIL,
    out,
  ];
}

/** Audio extraction: takes only the first audio track, dropping video, subtitle and data streams; stream-copied or re-encoded to AAC. */
function extractAudioArgs(params: FrozenTranscodeParams, input: string, decision: AudioExtractDecision, out: string): string[] {
  return [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    `file:${input}`,
    '-map',
    '0:a:0',
    '-vn',
    '-sn',
    '-dn',
    ...(decision.copy ? ['-c:a', 'copy'] : audioCodecArgs(params)),
    ...(decision.ext === '.m4a' ? ['-movflags', '+faststart'] : []),
    ...TAIL,
    out,
  ];
}

/** Merging with re-encoding: each segment is scaled and padded to the first segment's frame (not exceeding the height cap), frame rate, pixel format and audio are unified, then concatenated. */
function mergeArgs(params: FrozenTranscodeParams, media: ProbedMedia[], out: string): string[] {
  const first = media[0]!.video!;
  const height = even(Math.min(first.height, params.maxHeight ?? first.height));
  const width = even((first.width * height) / first.height);
  const fps = first.frameRate && first.frameRate !== '0/0' ? first.frameRate : '30';
  const withAudio = media.some((m) => m.audio);
  const filters: string[] = [];
  const inputs: string[] = [];
  let pads = '';
  media.forEach((m, i) => {
    inputs.push('-i', `file:${params.inputs[i]!}`);
    filters.push(
      `[${i}:v:0]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`,
    );
    if (withAudio) {
      filters.push(
        m.audio
          ? `[${i}:a:0]aresample=${MERGE_SAMPLE_RATE},aformat=channel_layouts=stereo[a${i}]`
          : `anullsrc=r=${MERGE_SAMPLE_RATE}:cl=stereo,atrim=0:${m.durationSec.toFixed(3)}[a${i}]`,
      );
    }
    pads += withAudio ? `[v${i}][a${i}]` : `[v${i}]`;
  });
  filters.push(`${pads}concat=n=${media.length}:v=1:a=${withAudio ? 1 : 0}[v]${withAudio ? '[a]' : ''}`);
  return [
    '-hide_banner',
    '-v',
    'error',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[v]',
    ...(withAudio ? ['-map', '[a]'] : []),
    ...videoCodecArgs(params),
    ...(withAudio ? audioCodecArgs(params) : []),
    '-movflags',
    '+faststart',
    ...TAIL,
    out,
  ];
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/** Parameter summary: input and manifest paths keep only file names (output paths are replaced with the published file name on completion). */
function summarize(args: string[], paths: Set<string>): string[] {
  return args.map((arg) => {
    const bare = arg.startsWith('file:') ? arg.slice(5) : arg;
    return paths.has(bare) ? path.basename(bare) : arg;
  });
}

/** Duration tolerance: 0.5 seconds or 2%, whichever is larger. */
export function durationTolerance(expectedSec: number): number {
  return Math.max(0.5, expectedSec * 0.02);
}

function verifyProblems(
  probed: ProbedMedia | null,
  expectedSec: number,
  params: FrozenTranscodeParams,
  mode: TranscodeSummary['mode'],
): string[] {
  if (!probed) return [JobsTranscode.probeOutputFailed().text];
  const problems: string[] = [];
  if (!probed.video) problems.push(JobsTranscode.outputNoVideo().text);
  if (Math.abs(probed.durationSec - expectedSec) > durationTolerance(expectedSec)) {
    problems.push(JobsTranscode.durationOff({ actual: probed.durationSec.toFixed(2), expected: expectedSec.toFixed(2) }).text);
  }
  if (probed.video && mode === 're-encode') {
    if (probed.video.codec !== params.codec) problems.push(JobsTranscode.codecMismatch({ actual: probed.video.codec, expected: params.codec }).text);
    if (params.maxHeight !== undefined && probed.video.height > params.maxHeight) {
      problems.push(JobsTranscode.heightOver({ height: probed.video.height, max: params.maxHeight }).text);
    }
  }
  return problems;
}

/** Verification for audio extraction (§7.9): checks only duration and the audio track. */
function audioVerifyProblems(probed: ProbedMedia | null, expectedSec: number): string[] {
  if (!probed) return [JobsTranscode.probeOutputFailed().text];
  const problems: string[] = [];
  if (!probed.audio) problems.push(JobsTranscode.outputNoAudio().text);
  if (Math.abs(probed.durationSec - expectedSec) > durationTolerance(expectedSec)) {
    problems.push(JobsTranscode.durationOff({ actual: probed.durationSec.toFixed(2), expected: expectedSec.toFixed(2) }).text);
  }
  return problems;
}

/**
 * Publishes the file from staging to the output directory without overwriting existing files: on a name clash, `-2`, `-3`... are added in turn.
 * On the same filesystem a hard link is used (atomic, fails if a file already exists); across filesystems, or when hard links are not supported, first claim the target name exclusively,
 * copy to a temporary file in the same directory, then rename it over the placeholder; on error, delete the temporary file and the placeholder.
 */
export async function publishFile(source: string, dir: string, stem: string, ext: string, tag: string, hardLink: boolean): Promise<string> {
  for (let n = 1; n < 10_000; n++) {
    const target = path.join(dir, `${stem}${n === 1 ? '' : `-${n}`}${ext}`);
    if (hardLink) {
      try {
        await fs.link(source, target);
        return target;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EEXIST') continue;
        if (code !== 'EXDEV' && code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EMLINK') throw error;
      }
    }
    let placeholder: fs.FileHandle;
    try {
      placeholder = await fs.open(target, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw error;
    }
    await placeholder.close();
    const temp = path.join(dir, `.${stem}.${tag}.partial`);
    try {
      await fs.copyFile(source, temp);
      await fs.rename(temp, target);
      return target;
    } catch (error) {
      await fs.rm(temp, { force: true });
      await fs.rm(target, { force: true });
      throw error;
    }
  }
  throw new PipelineStepError('TRANSCODE_FAILED', JobsTranscode.tooManySameName({ name: `${stem}${ext}` }));
}

async function digestFile(file: string): Promise<{ size: number; digest: string }> {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk as Buffer);
    size += (chunk as Buffer).length;
  }
  return { size, digest: hash.digest('hex') };
}

import { spawn } from 'node:child_process';
import path from 'node:path';
import { rm, writeFile } from 'node:fs/promises';
import {
  refOf,
  type AudioExportFormat,
  type ExportValidation,
  type JobWarning,
  type Localized,
  type LoudnessTarget,
  type MessageRef,
} from '@cuccut/protocol';
import { RcCommon, RcExport } from '@cuccut/protocol/messages/runtime-core';
import type { AudioPlan, AudioSegment, PlannedAsset } from './export-plan.ts';

/**
 * Audio export (architecture design §9.13): the engine gives an interval plan for the sound (which instances sound, which part of the source to take, where to place it, gain and fades;
 * `render-graph`'s `audio_plan`, using the same sounding rules as the preview). Here it is only translated into an ffmpeg filter graph:
 *
 * 1. Mixing: a silent base of exact length; each segment takes its source with `-ss/-t` → unify sample rate and channels → `atempo` (speed, with pitch kept as in the preview)
 *    → trim to a whole sample count → gain (dB) → a per-sample amplitude coefficient (linear fades; when a fade-in and fade-out overlap, take the smaller; a transition's sound cross-fades with equal power;
 *    duck attenuation is linearly interpolated between breakpoints; the three multiply, consistent with the plan's `gain_db_at`) → delay to position by sample count,
 *    `amix normalize=0` adds directly, written as a 32-bit float WAV in staging;
 * 2. Loudness normalization (when on): the Render Worker's `master` subcommand turns the mix into the target loudness (v2 mastering chain: three alternating rounds of BS.1770 integrated-loudness normalization and true-peak limiting, followed by a static true-peak fallback, bit-deterministic), written as 32-bit float raw PCM in staging; the measurement is written into the verification result;
 * 3. Encoding: WAV (16-bit), MP3 (libmp3lame), or M4A (AAC);
 * 4. Verification: ffprobe decodes the whole file; the duration is within tolerance, and the sample rate and channel count match the settings.
 */

export interface ToolCommand {
  command: string;
  env?: NodeJS.ProcessEnv;
}

export interface AudioOutputSettings {
  format: AudioExportFormat;
  sampleRate: number;
  channels: 1 | 2;
  bitrateKbps: number;
  loudness: Required<LoudnessTarget> | null;
}

export const DEFAULT_SAMPLE_RATE = 48_000;
export const DEFAULT_CHANNELS = 2;
export const DEFAULT_BITRATE_KBPS = 192;

const ENCODERS: Record<AudioExportFormat, { encoder: string; muxer: string; extra: string[] }> = {
  wav: { encoder: 'pcm_s16le', muxer: 'wav', extra: [] },
  mp3: { encoder: 'libmp3lame', muxer: 'mp3', extra: [] },
  m4a: { encoder: 'aac', muxer: 'ipod', extra: ['-movflags', '+faststart'] },
};

/** Duration tolerance: WAV is sample-exact; lossy formats have encoder padding at the start and end. */
const TOLERANCE_SEC: Record<AudioExportFormat, number> = { wav: 0.01, mp3: 0.1, m4a: 0.1 };

export class ToolFailure extends Error {
  readonly kind: 'missing' | 'failed' | 'aborted';
  /** Which tool failed (the executable name, such as `ffmpeg` or `export-worker`); absent when canceled. */
  readonly tool: string | null;
  readonly messageRef: MessageRef | undefined;
  constructor(kind: 'missing' | 'failed' | 'aborted', message: string | Localized, tool: string | null = null) {
    super(String(message));
    this.kind = kind;
    this.tool = tool;
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }
}

/** Runs an external tool: when the cancel signal arrives, kills the process. Only the last 64 KB of stderr is kept. */
export function runTool(
  tool: ToolCommand,
  args: string[],
  signal?: AbortSignal,
  onStdout?: (chunk: string) => void,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ToolFailure('aborted', RcCommon.cancelled()));
    const child = spawn(tool.command, args, { env: tool.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const abort = () => child.kill('SIGKILL');
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      if (onStdout) onStdout(chunk);
      else if (stdout.length < 4_000_000) stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-65_536);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      signal?.removeEventListener('abort', abort);
      const name = path.basename(tool.command);
      reject(new ToolFailure(error.code === 'ENOENT' ? 'missing' : 'failed', RcExport.toolStartFailed({ tool: name, error: error.message }), name));
    });
    child.once('close', (code) => {
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) return reject(new ToolFailure('aborted', RcCommon.cancelled()));
      if (code === 0) return resolve({ stdout, stderr });
      const tail = stderr.trim().split('\n').slice(-3).join(' / ');
      const name = path.basename(tool.command);
      reject(new ToolFailure('failed', RcExport.toolExited({ tool: name, code: String(code), output: tail }), name));
    });
  });
}

/**
 * Preflight: whether ffmpeg and ffprobe exist, and whether ffmpeg has the encoders and filters needed (`amix`'s `normalize` requires ffmpeg 4.4 or later).
 * Returns what is missing (an executable name, or text saying which encoder or filter is missing); null when everything is present.
 */
export async function missingAudioTools(
  ffmpeg: ToolCommand,
  ffprobe: ToolCommand,
  settings: Pick<AudioOutputSettings, 'format'>,
): Promise<string | Localized | null> {
  try {
    await runTool(ffprobe, ['-hide_banner', '-version']);
  } catch {
    return 'ffprobe';
  }
  let encoders: string;
  let amix: string;
  try {
    encoders = (await runTool(ffmpeg, ['-hide_banner', '-encoders'])).stdout;
    amix = (await runTool(ffmpeg, ['-hide_banner', '-h', 'filter=amix'])).stdout;
  } catch {
    return 'ffmpeg';
  }
  const encoder = ENCODERS[settings.format].encoder;
  if (!new RegExp(`^\\s*A\\S*\\s+${encoder}\\s`, 'm').test(encoders)) return RcExport.ffmpegEncoder({ encoder });
  if (!/\bnormalize\b/.test(amix)) return RcExport.ffmpegAmixNormalize();
  for (const filter of ['atempo', 'aeval', 'adelay', 'anullsrc']) {
    try {
      const help = await runTool(ffmpeg, ['-hide_banner', '-h', `filter=${filter}`]);
      if (/Unknown filter/i.test(help.stdout + help.stderr)) return RcExport.ffmpegFilter({ filter });
    } catch {
      return RcExport.ffmpegFilter({ filter });
    }
  }
  return null;
}

function fixed(value: number): string {
  return Number(value.toFixed(6)).toString();
}

/** `atempo` chain: older versions accept only 0.5–2 per stage, so values out of range are split across several stages. */
function tempoChain(rate: number): string[] {
  if (Math.abs(rate - 1) < 1e-9) return [];
  const chain: string[] = [];
  let rest = rate;
  while (rest > 2) {
    chain.push('atempo=2');
    rest /= 2;
  }
  while (rest < 0.5) {
    chain.push('atempo=0.5');
    rest /= 0.5;
  }
  if (Math.abs(rest - 1) > 1e-9) chain.push(`atempo=${fixed(rest)}`);
  return chain;
}

/** Per-sample gain for fades: `t` is seconds within this segment (starting from 0). */
function fadeExpression(segment: AudioSegment): string | null {
  const terms: string[] = [];
  if (segment.fadeIn) {
    const a = segment.fadeIn.start - segment.start;
    const b = segment.fadeIn.end - segment.start;
    if (b > a) terms.push(`clip((t-(${fixed(a)}))/${fixed(b - a)},0,1)`);
  }
  if (segment.fadeOut) {
    const c = segment.fadeOut.start - segment.start;
    const d = segment.fadeOut.end - segment.start;
    if (d > c) terms.push(`clip((${fixed(d)}-t)/${fixed(d - c)},0,1)`);
  }
  if (terms.length === 0) return null;
  return terms.length === 1 ? terms[0]! : `min(${terms[0]},${terms[1]})`;
}

/** Per-sample amplitude for transition cross-fades (equal power, same curve as the frame plan). */
function crossfadeExpression(segment: AudioSegment): string[] {
  return (segment.crossfades ?? [])
    .filter((fade) => fade.end > fade.start)
    .map((fade) => {
      const a = fade.start - segment.start;
      const p = `clip((t-(${fixed(a)}))/${fixed(fade.end - fade.start)},0,1)`;
      return `${fade.role === 'outgoing' ? 'cos' : 'sin'}(PI/2*${p})`;
    });
}

/**
 * A piecewise-linear function formed by breakpoints `[seconds, value]`, written as an ffmpeg expression: split into intervals by breakpoint, and select the interval with nested binary `if(lt(t,…))`,
 * so each sample compares only log₂(number of intervals) times. Before the first breakpoint, take `before`; after the last, hold the last value. When two breakpoints share a time, at that moment take the later one;
 * intervals with equal values have no interpolation term. `t` is seconds within this segment, and the breakpoints have already been converted to this clock.
 */
function piecewiseExpression(knots: ReadonlyArray<readonly [number, number]>, before: number): string {
  // pieces[j] covers [bounds[j-1], bounds[j]).
  const bounds: number[] = [knots[0]![0]];
  const pieces: string[] = [fixed(before)];
  for (let i = 0; i + 1 < knots.length; i++) {
    const [t0, v0] = knots[i]!;
    const [t1, v1] = knots[i + 1]!;
    if (!(t1 > t0)) continue;
    pieces.push(v0 === v1 ? fixed(v0) : `(${fixed(v0)}+(${fixed(v1 - v0)})*(t-(${fixed(t0)}))/${fixed(t1 - t0)})`);
    bounds.push(t1);
  }
  pieces.push(fixed(knots[knots.length - 1]![1]));
  const pick = (lo: number, hi: number): string => {
    if (lo === hi) return pieces[lo]!;
    const mid = (lo + hi + 1) >> 1;
    return `if(lt(t,${fixed(bounds[mid - 1]!)}),${pick(lo, mid - 1)},${pick(mid, hi)})`;
  };
  return pick(0, pieces.length - 1);
}

/**
 * Expression for duck attenuation (dB) as a function of `t`: 0 before the first breakpoint. Same semantics as `knots_at` in `render-graph`. null when there is no attenuation.
 */
export function duckingExpression(segment: Pick<AudioSegment, 'start' | 'ducking'>): string | null {
  const knots = (segment.ducking ?? []).map(([at, db]) => [at - segment.start, db] as const);
  if (knots.length === 0 || knots.every(([, db]) => db === 0)) return null;
  return piecewiseExpression(knots, 0);
}

/**
 * Expression for the volume envelope (linear multiplier) as a function of `t`: holds the first and last breakpoint values at the ends; same semantics as `envelope_at` in `render-graph`
 * (`GainEnvelope::at`, used by the preview). With only one value it is a constant; null when there is no envelope or it is 1 everywhere.
 */
export function envelopeExpression(segment: Pick<AudioSegment, 'start' | 'envelope'>): string | null {
  const knots = (segment.envelope ?? []).map(([at, gain]) => [at - segment.start, gain] as const);
  if (knots.length === 0 || knots.every(([, gain]) => gain === 1)) return null;
  if (knots.every(([, gain]) => gain === knots[0]![1])) return fixed(knots[0]![1]);
  return piecewiseExpression(knots, knots[0]![1]);
}

/** The per-sample amplitude coefficient for this segment: envelope × fade × cross-fade × duck; null if none apply. The instance's fixed gain is separately given by `volume`. */
export function gainExpression(segment: AudioSegment): string | null {
  const factors: string[] = [];
  const envelope = envelopeExpression(segment);
  if (envelope) factors.push(envelope);
  const fade = fadeExpression(segment);
  if (fade) factors.push(fade);
  factors.push(...crossfadeExpression(segment));
  const ducking = duckingExpression(segment);
  if (ducking) factors.push(`pow(10,-(${ducking})/20)`);
  return factors.length === 0 ? null : factors.join('*');
}

/**
 * The ffmpeg option for reading a filter graph from a file: since 7.0 it is `-/filter_complex <file>` (`-filter_complex_script` is deprecated); earlier versions only accept
 * `-filter_complex_script <file>`.
 */
export type FilterScriptOption = '-/filter_complex' | '-filter_complex_script';

/** Choose per the description in `ffmpeg -h long`: if it mentions `-/filter_complex` (the deprecation note for the old option), use the new form; otherwise use the old option. */
export function filterScriptOption(help: string): FilterScriptOption {
  return /-\/filter_complex\b/.test(help) ? '-/filter_complex' : '-filter_complex_script';
}

const scriptOptions = new Map<string, Promise<FilterScriptOption>>();

/** Which form this ffmpeg accepts (cached per command; if it cannot be determined, the old option is used and nothing is cached). */
export function detectFilterScriptOption(ffmpeg: ToolCommand): Promise<FilterScriptOption> {
  const known = scriptOptions.get(ffmpeg.command);
  if (known) return known;
  const asked = runTool(ffmpeg, ['-hide_banner', '-h', 'long']).then(
    ({ stdout }) => filterScriptOption(stdout),
    () => {
      scriptOptions.delete(ffmpeg.command);
      return '-filter_complex_script' as const;
    },
  );
  scriptOptions.set(ffmpeg.command, asked);
  return asked;
}

/**
 * The ffmpeg arguments for mixing (pure function, for testing): the output is `outFile` (32-bit float WAV), and its length is the range's sample count.
 * `assets` are keyed by `<assetId>@<revision>`.
 *
 * The filter graph is not put on the command line: a densely baked volume envelope and ducking can grow it to hundreds of KB or more, past the limit for a single argument (Linux 128 KiB) or for the whole command line
 * (macOS 1 MiB, Windows 32K characters). The caller writes `graph` into `script.file`, so the arguments hold only the option that reads it and the file name.
 */
export function mixArgs(
  plan: AudioPlan,
  assets: Map<string, PlannedAsset>,
  sampleRate: number,
  channels: 1 | 2,
  outFile: string,
  script: { option: FilterScriptOption; file: string },
): { args: string[]; graph: string } {
  const layout = channels === 2 ? 'stereo' : 'mono';
  const total = Math.round(plan.range.durationSeconds * sampleRate);
  const args = ['-hide_banner', '-nostdin', '-y', '-v', 'error', '-progress', 'pipe:1', '-nostats'];
  args.push('-f', 'lavfi', '-t', fixed(plan.range.durationSeconds + 0.1), '-i', `anullsrc=r=${sampleRate}:cl=${layout}`);
  const filters: string[] = [];
  const labels: string[] = ['[0:a]'];
  plan.segments.forEach((segment, i) => {
    const asset = assets.get(`${segment.asset.id}@${segment.asset.revision}`);
    if (!asset) throw new Error(RcExport.planAssetNotFrozen({ assetId: segment.asset.id }).text);
    const length = segment.end - segment.start;
    // Take a little extra source; trimming to the exact sample count is done by atrim.
    args.push('-ss', fixed(segment.sourceStart), '-t', fixed(length * segment.sourceRate + 0.1), '-i', `file:${asset.path}`);
    const chain: string[] = [];
    const sourceChannels = asset.audio?.channels ?? 2;
    // The browser places mono on both channels (no attenuation), and downmixes stereo to mono by averaging; ffmpeg's default downmix differs, so it is written out explicitly.
    if (channels === 2 && sourceChannels === 1) chain.push('pan=stereo|c0=c0|c1=c0');
    else if (channels === 1 && sourceChannels === 2) chain.push('pan=mono|c0=0.5*c0+0.5*c1');
    chain.push(`aresample=${sampleRate}`, `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${layout}`);
    chain.push(...tempoChain(segment.sourceRate));
    chain.push(`atrim=end_sample=${Math.max(1, Math.round(length * sampleRate))}`, 'asetpts=PTS-STARTPTS');
    if (segment.gainDb !== 0) chain.push(`volume=${fixed(segment.gainDb)}dB`);
    const gain = gainExpression(segment);
    if (gain) chain.push(`aeval='val(ch)*${gain}':c=same`);
    const delay = Math.round(segment.start * sampleRate);
    if (delay > 0) chain.push(`adelay=delays=${delay}S:all=1`);
    filters.push(`[${i + 1}:a:0]${chain.join(',')}[s${i}]`);
    labels.push(`[s${i}]`);
  });
  if (plan.segments.length === 0) filters.push(`[0:a]atrim=end_sample=${total}[out]`);
  else {
    filters.push(
      `${labels.join('')}amix=inputs=${labels.length}:duration=first:dropout_transition=0:normalize=0,atrim=end_sample=${total},asetpts=PTS-STARTPTS[out]`,
    );
  }
  args.push(script.option, script.file, '-map', '[out]', '-c:a', 'pcm_f32le', '-f', 'wav', `file:${outFile}`);
  return { args, graph: filters.join(';') };
}

/** The ffmpeg arguments for encoding: the input is the mixed WAV, or the raw PCM written by mastering (`f32le`, interleaved, with sample rate and channels the same as the output). */
function encodeArgs(input: string, output: string, settings: AudioOutputSettings, raw: boolean): string[] {
  const { encoder, muxer, extra } = ENCODERS[settings.format];
  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-v',
    'error',
    ...(raw ? ['-f', 'f32le', '-ar', String(settings.sampleRate), '-ac', String(settings.channels)] : []),
    '-i',
    `file:${input}`,
    '-ar',
    String(settings.sampleRate),
    '-ac',
    String(settings.channels),
    '-c:a',
    encoder,
    ...(settings.format === 'wav' ? [] : ['-b:a', `${settings.bitrateKbps}k`]),
    ...extra,
    '-f',
    muxer,
    `file:${output}`,
  ];
}

/** The request for mastering (input to the Render Worker's `master`, `cuccut` internal format; the Worker rejects fields it does not recognize). */
export interface MasterRequest {
  /** Mix: 32-bit float WAV. */
  input: string;
  /** Written raw PCM (`f32le`, interleaved). */
  output: string;
  /** Intermediate files go here. */
  staging: string;
  sampleRate: number;
  channels: 1 | 2;
  lufs: number;
  truePeak: number;
}

/** Mastering measurement (the Worker's `mastered` line): when loudness cannot be measured, `inputLufs` is −200; in that case no loudness normalization is done, only true-peak limiting and the fallback. */
export interface MasterMeasure {
  inputLufs: number;
  lufs: number;
  truePeak: number;
  staticGainDb: number;
}

/** Runs mastering once: after the input file is written, calls the Worker (`runWorker(worker, 'master', …)`). `onProgress` is the processed amount and total reported by the Worker. */
export type MasterRunner = (
  inputFile: string,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
) => Promise<MasterMeasure>;

/**
 * When loudness normalization is on, the share of an output's progress bar taken by mixing; the rest goes to mastering. This is an allocation on the progress bar, not a measured time ratio:
 * both steps advance by their own completion ratios, so while mastering runs the progress bar does not stop at the end of mixing.
 */
export const MIX_PROGRESS_SHARE = 0.5;

/** An integrated loudness below this counts as unmeasurable (`SILENCE_LUFS` in `audio-dsp` is −200). */
const UNMEASURABLE_LUFS = -199;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export interface AudioRenderResult {
  file: string;
  media: { kind: 'audio'; durationSec: number; sampleRate: number; channels: number };
  validation: ExportValidation;
  warnings: JobWarning[];
}

/** Mix → (measure loudness) → encode → ffprobe verification. Throws `AudioValidationError` if verification fails. */
export async function renderAudio(options: {
  plan: AudioPlan;
  assets: Map<string, PlannedAsset>;
  settings: AudioOutputSettings;
  staging: string;
  /** Output file name in staging (with extension). */
  outName: string;
  ffmpeg: ToolCommand;
  ffprobe: ToolCommand;
  /** Required when loudness normalization is on. */
  master?: MasterRunner;
  signal: AbortSignal;
  /**
   * How far this output has progressed, in output seconds (0 to duration). When loudness normalization is on, mixing goes up to `MIX_PROGRESS_SHARE`, and mastering covers the rest according to the completion ratio it reports.
   */
  progress?: (doneSeconds: number) => void;
}): Promise<AudioRenderResult> {
  const { plan, settings, staging, ffmpeg, signal } = options;
  const duration = plan.range.durationSeconds;
  const mixShare = settings.loudness ? MIX_PROGRESS_SHARE : 1;
  const warnings: JobWarning[] = [];
  const mixFile = path.join(staging, `${path.parse(options.outName).name}.mix.wav`);
  const graphFile = path.join(staging, `${path.parse(options.outName).name}.mix.graph`);
  const outFile = path.join(staging, options.outName);
  const script = { option: await detectFilterScriptOption(ffmpeg), file: graphFile };
  const mix = mixArgs(plan, options.assets, settings.sampleRate, settings.channels, mixFile, script);
  await writeFile(graphFile, mix.graph);
  await runTool(ffmpeg, mix.args, signal, (chunk) => {
    const match = /out_time_us=(\d+)/g;
    let last: RegExpExecArray | null = null;
    for (let m = match.exec(chunk); m; m = match.exec(chunk)) last = m;
    if (last) options.progress?.(Math.min(duration, Number(last[1]) / 1e6) * mixShare);
  });

  let loudness: ExportValidation['loudness'];
  let encodeInput = mixFile;
  if (settings.loudness) {
    if (!options.master) throw new ToolFailure('missing', RcExport.masterNeedsWorker(), 'export-worker');
    const target = settings.loudness;
    const stem = path.parse(options.outName).name;
    const request: MasterRequest = {
      input: mixFile,
      output: path.join(staging, `${stem}.master.f32`),
      staging,
      sampleRate: settings.sampleRate,
      channels: settings.channels,
      lufs: target.integratedLufs,
      truePeak: target.truePeakDb,
    };
    const requestFile = path.join(staging, `${stem}.master.json`);
    await writeFile(requestFile, JSON.stringify(request));
    const masterProgress = (fraction: number) =>
      options.progress?.(duration * (mixShare + (1 - mixShare) * Math.min(1, Math.max(0, fraction))));
    masterProgress(0);
    const measure = await options.master(requestFile, signal, (done, total) => masterProgress(total > 0 ? done / total : 0));
    masterProgress(1);
    encodeInput = request.output;
    if (!(measure.inputLufs > UNMEASURABLE_LUFS)) {
      const detail = RcExport.loudnessNotMeasurable();
      warnings.push({ code: 'LOUDNESS_NOT_MEASURABLE', detail: detail.text, detailRef: refOf(detail) });
    } else {
      loudness = {
        target,
        measured: { inputLufs: round2(measure.inputLufs), integratedLufs: round2(measure.lufs), truePeakDb: round2(measure.truePeak) },
        gainDb: round2(measure.staticGainDb),
      };
    }
  }
  await runTool(ffmpeg, encodeArgs(encodeInput, outFile, settings, encodeInput !== mixFile), signal);
  // Intermediate files are deleted once used: when several ranges are exported in turn, staging keeps only the encoded outputs.
  await Promise.all([graphFile, mixFile, encodeInput].map((file) => rm(file, { force: true })));

  const probed = await probeAudio(options.ffprobe, outFile, settings.format, signal);
  const expected = plan.range.durationSeconds;
  const tolerance = TOLERANCE_SEC[settings.format];
  const problems = [...probed.problems];
  if (probed.ok) {
    if (Math.abs(probed.durationSec - expected) > tolerance)
      problems.push(RcExport.durationMismatch({ actual: probed.durationSec, expected, tolerance }).text);
    if (probed.sampleRate !== settings.sampleRate) problems.push(RcExport.sampleRateMismatch({ actual: probed.sampleRate, expected: settings.sampleRate }).text);
    if (probed.channels !== settings.channels) problems.push(RcExport.channelsMismatch({ actual: probed.channels, expected: settings.channels }).text);
  }
  if (problems.length > 0) throw new AudioValidationError(problems);
  return {
    file: outFile,
    media: { kind: 'audio', durationSec: probed.durationSec, sampleRate: probed.sampleRate, channels: probed.channels },
    validation: {
      checks: ['decoded', 'duration', 'sample-rate', 'channels', ...(loudness ? ['loudness-measured'] : [])],
      expectedDurationSec: expected,
      durationSec: probed.durationSec,
      toleranceSec: tolerance,
      ...(loudness ? { loudness } : {}),
    },
    warnings,
  };
}

export class AudioValidationError extends Error {
  readonly problems: string[];
  readonly messageRef: MessageRef;
  constructor(problems: string[]) {
    const message = RcExport.validationFailed({ problems: problems.join(RcExport.clauseSeparator().text) });
    super(message.text);
    this.problems = problems;
    this.messageRef = refOf(message);
  }
}

const DEMUXERS: Record<AudioExportFormat, string> = { wav: 'wav', mp3: 'mp3', m4a: 'mov,mp4,m4a,3gp,3g2,mj2' };

/** ffprobe decodes the whole file: checks that there are audio frames, and reads the duration, sample rate and channels. */
async function probeAudio(
  ffprobe: ToolCommand,
  file: string,
  format: AudioExportFormat,
  signal: AbortSignal,
): Promise<{ ok: boolean; problems: string[]; durationSec: number; sampleRate: number; channels: number }> {
  const failed = (problem: string) => ({ ok: false, problems: [problem], durationSec: 0, sampleRate: 0, channels: 0 });
  let stdout: string;
  try {
    ({ stdout } = await runTool(
      ffprobe,
      [
        '-v',
        'error',
        '-f',
        DEMUXERS[format].split(',')[0]!,
        '-count_frames',
        '-show_entries',
        'stream=codec_type,sample_rate,channels,nb_read_frames:format=duration',
        '-of',
        'json',
        `file:${file}`,
      ],
      signal,
    ));
  } catch (error) {
    if (error instanceof ToolFailure && error.kind === 'aborted') throw error;
    return failed(RcExport.probeFailed({ error: error instanceof Error ? error.message : String(error) }).text);
  }
  let parsed: { streams?: Array<Record<string, unknown>>; format?: Record<string, unknown> };
  try {
    parsed = JSON.parse(stdout) as typeof parsed;
  } catch {
    return failed(RcExport.probeNotJson().text);
  }
  const stream = (parsed.streams ?? []).find((s) => s.codec_type === 'audio');
  if (!stream) return failed(RcExport.noAudioStream().text);
  if (!(Number(stream.nb_read_frames) > 0)) return failed(RcExport.noDecodableFrame().text);
  return {
    ok: true,
    problems: [],
    durationSec: Number(parsed.format?.duration),
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
  };
}

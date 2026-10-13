import { intlLocale, localizeToolStatus, pipelineStepLabel, type ExternalToolStatus, type GeneratedOutput, type Id, type JobRecord, type TranscodeParams, type TranscodeStartParams, type TranscodeSummary } from '@cuccut/protocol';
import { JOB_PHASE_LABEL } from '../copy.ts';
import { formatClock, formatDuration } from './format.ts';
import { kindOfFileName } from './space.ts';
import { jobLive } from './task-list.ts';
import { M } from './tools-transcode-copy.ts';
import { jobWaitText, remedyText } from './localized-text.ts';

/**
 * Compress video and merge video (design mockup tool-video.jsx, tool-video-merge.jsx, model-video.js): both pages submit the Runtime's fixed `transcode` pipeline (`pipelines.start`, parent job `kind: 'pipeline'`, four steps: read input → encode → verify output → publish), file to file,
 * run by ffmpeg on this computer, with no upload. This file holds the pure functions for the form, request, record and result; the components only draw.
 *
 * Not possible in the design mockup: compressing to a target size (the UI cannot read the source duration), a frame-rate cap, hardware encoding, removing the audio track, the compatibility banner before submit (the UI has no way to probe an arbitrary file), and choosing “fast / re-encode” when merging (the Runtime decides itself, and stream-copies only when the parameters match). None of these are drawn; see the notes where they occur.
 */

export const TRANSCODE_PIPELINE = 'transcode';

export type TranscodeAction = TranscodeParams['action'];
export type TranscodeCodec = NonNullable<TranscodeParams['codec']>;
/** Quality preset (design mockup `QUALITIES`): mapped to constant-quality CRF. */
export type TranscodeQuality = 'smaller' | 'balanced' | 'high';
/** Target size: by quality (CRF), or by a given video bitrate. The mockup's “by size” needs the source duration, which the UI cannot read, so it uses a bitrate instead. */
export type TranscodeRate = 'quality' | 'bitrate';

/** Form draft for the tool page. File paths are kept only for this run (see tools-store); everything else is remembered with the draft. */
export interface TranscodeDraft {
  inputs: string[];
  codec: TranscodeCodec;
  /** Maximum frame height; null means no scaling. */
  maxHeight: number | null;
  rate: TranscodeRate;
  quality: TranscodeQuality;
  videoKbps: number;
  audioKbps: number;
  /** Output directory; null means write next to the (first) source file. */
  outDir: string | null;
}

export const BLANK_COMPRESS: TranscodeDraft = {
  inputs: [],
  codec: 'h264',
  maxHeight: null,
  rate: 'quality',
  quality: 'balanced',
  videoKbps: 4000,
  audioKbps: 128,
  outDir: null,
};

/** Merge defaults to high quality, because after joining, clips often get trimmed again (design mockup tool-video-merge.jsx). */
export const BLANK_MERGE: TranscodeDraft = { ...BLANK_COMPRESS, quality: 'high' };

/** Extract audio: uses only the file and output directory (the audio bitrate carries over when re-encoding); video settings do not apply. */
export const BLANK_EXTRACT: TranscodeDraft = { ...BLANK_COMPRESS };

export const QUALITIES: ReadonlyArray<{ key: TranscodeQuality; name: string; sub: string }> = (['smaller', 'balanced', 'high'] as const).map((key) => ({
  key,
  get name() {
    return M.quality[key].name;
  },
  get sub() {
    return M.quality[key].sub;
  },
}));

const CRF: Record<TranscodeQuality, number> = { smaller: 30, balanced: 26, high: 22 };

/** CRF for this preset under this codec (the H.265 scale runs 5 higher overall, design mockup `crfOf`). */
export function crfOf(quality: TranscodeQuality, codec: TranscodeCodec): number {
  return CRF[quality] + (codec === 'hevc' ? 5 : 0);
}

/** Frame height cap (the Runtime's `maxHeight` caps by height, scaling down only). */
export const HEIGHT_CAPS: ReadonlyArray<{ key: string; name: string; height: number | null }> = [
  {
    key: 'original',
    get name() {
      return M.heightOriginal;
    },
    height: null,
  },
  { key: '1080', name: '1080p', height: 1080 },
  { key: '720', name: '720p', height: 720 },
  { key: '480', name: '480p', height: 480 },
];

export const CODECS: ReadonlyArray<{ key: TranscodeCodec; name: string; sub: string }> = [
  {
    key: 'h264',
    name: 'H.264',
    get sub() {
      return M.codecSub.h264;
    },
  },
  {
    key: 'hevc',
    name: 'H.265',
    get sub() {
      return M.codecSub.hevc;
    },
  },
];

export const AUDIO_RATES: readonly number[] = [96, 128, 192, 256];

/** Parameter ranges of the Runtime (`parseTranscodeParams` in packages/jobs). */
export const LIMITS = { inputs: 100, videoKbps: [100, 200_000], audioKbps: [32, 1024] } as const;

export function heightKey(maxHeight: number | null): string {
  return maxHeight === null ? 'original' : String(maxHeight);
}

export function codecName(codec: string): string {
  return CODECS.find((c) => c.key === codec)?.name ?? codec.toUpperCase();
}

// ---- Choose files ----

/**
 * Each list item is either the absolute path of a local file, or a Space entry (architecture design §7.9 “Space 条目作输入”, Space entries as input). In the form, an entry is stored as `space:<entryId>`, so sorting, de-duplication and dragging all treat it as one kind of string; on submit it becomes `{ entryId }`, which the Runtime turns into a file path. The list in the draft is not written to disk.
 */
const SPACE_INPUT = 'space:';

export function spaceInput(entryId: Id): string {
  return `${SPACE_INPUT}${entryId}`;
}

/** The entry ID when the list item is a Space entry, otherwise null. */
export function entryIdOfInput(input: string): Id | null {
  return input.startsWith(SPACE_INPUT) ? input.slice(SPACE_INPUT.length) : null;
}

/** Appends Space entries to the end of the list. Entries already in the list are not added again; at most 100. */
export function addEntryInput(current: readonly string[], entryId: Id): string[] {
  const input = spaceInput(entryId);
  if (current.includes(input) || current.length >= LIMITS.inputs) return [...current];
  return [...current, input];
}

/** The last segment of the path. */
export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** Absolute path: `/…` on macOS / Linux, `C:\…` or `\\server\…` on Windows. */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

/**
 * A path typed in by hand: trims surrounding whitespace and matched quotes, turns a `file://` URL into a path, and restores the `\ ` left by a path dragged into the terminal back to a space.
 * Returns null if empty.
 */
export function parsePathInput(text: string): string | null {
  let value = text.trim();
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1).trim();
  if (value.startsWith('file://')) {
    try {
      value = decodeURIComponent(new URL(value).pathname);
    } catch {
      return null;
    }
  } else if (value.startsWith('/')) {
    value = value.replace(/\\(.)/g, '$1');
  }
  return value || null;
}

/**
 * Whether a file is accepted: videos in the Space category are accepted; audio, images, subtitles, transcripts and other files that are clearly not video are rejected; files whose extension is not recognized pass, and the Runtime's ffprobe decides (if no video track can be read, that item fails and the reason is stated). Audio extraction accepts audio files separately (`withAudio`).
 */
export function isVideoCandidate(path: string, withAudio = false): boolean {
  const kind = kindOfFileName(fileName(path));
  return kind === null || kind === 'video-file' || (withAudio && kind === 'audio');
}

export interface AddResult {
  inputs: string[];
  /** Recognized as not a video. */
  rejected: string[];
  /** Already in the list. */
  duplicates: string[];
  /** Not an absolute path. */
  relative: string[];
  /** Not added because it exceeds the limit. */
  overflow: number;
}

/** Appends a batch of paths to the end of the list: de-duplicates (the same file is not added twice), skips files that are not video (audio extraction accepts audio separately) and relative paths, and holds at most 100. */
export function addInputs(current: readonly string[], paths: readonly string[], withAudio = false): AddResult {
  const inputs = [...current];
  const result: AddResult = { inputs, rejected: [], duplicates: [], relative: [], overflow: 0 };
  for (const path of paths) {
    if (!isAbsolutePath(path)) result.relative.push(path);
    else if (!isVideoCandidate(path, withAudio)) result.rejected.push(path);
    else if (inputs.includes(path)) result.duplicates.push(path);
    else if (inputs.length >= LIMITS.inputs) result.overflow += 1;
    else inputs.push(path);
  }
  return result;
}

/** The one-line notice to show after adding files; null when everything was accepted. */
export function addNotice(result: AddResult): string | null {
  const bits: string[] = [];
  if (result.rejected.length) bits.push(M.notVideoFiles(result.rejected.map(fileName)));
  if (result.relative.length) bits.push(M.notAbsolute(result.relative));
  if (result.duplicates.length) bits.push(M.alreadyListed(result.duplicates.map(fileName)));
  if (result.overflow) bits.push(M.overflow(LIMITS.inputs, result.overflow));
  return bits.length ? M.joinNotices(bits) : null;
}

/** Moves one position up or down (design mockup `reorder`); returns unchanged when out of bounds. */
export function moveInput(inputs: readonly string[], index: number, delta: number): string[] {
  const to = index + delta;
  if (index < 0 || index >= inputs.length || to < 0 || to >= inputs.length) return [...inputs];
  const next = [...inputs];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Moves a group of files before or after a given file (drag to reorder). Returns unchanged if the target is inside the group being moved. */
export function moveInputs(inputs: readonly string[], moving: readonly string[], target: string, position: 'before' | 'after'): string[] {
  if (moving.includes(target)) return [...inputs];
  const set = new Set(moving);
  const kept = inputs.filter((p) => !set.has(p));
  const block = inputs.filter((p) => set.has(p));
  const at = kept.indexOf(target);
  if (at < 0) return [...inputs];
  kept.splice(position === 'before' ? at : at + 1, 0, ...block);
  return kept;
}

export function removeInput(inputs: readonly string[], index: number): string[] {
  return inputs.filter((_, i) => i !== index);
}

/** Sorts by file name, with numbers compared by value (clip2 before clip10). Space entries are sorted by the name given by `nameOf` (by entry ID when none is given). */
export function sortByName(inputs: readonly string[], nameOf: (input: string) => string = fileName): string[] {
  const collator = new Intl.Collator(intlLocale(), { numeric: true, sensitivity: 'base' });
  return [...inputs].sort((a, b) => collator.compare(nameOf(a), nameOf(b)));
}

// ---- Submit ----

/** Problems to check before submitting (the ones in design mockup `compressProblems` / `mergeProblems` that the Runtime would also reject); an empty array when there are none. */
export function transcodeProblems(draft: TranscodeDraft, action: TranscodeAction): string[] {
  const problems: string[] = [];
  if (!draft.inputs.length) problems.push(action === 'merge' ? M.needTwoVideos : action === 'extract-audio' ? M.needMediaFile : M.needVideoFile);
  else if (action === 'merge' && draft.inputs.length < 2) problems.push(M.needOneMore);
  if (draft.inputs.length > LIMITS.inputs) problems.push(M.tooManyFiles(LIMITS.inputs));
  const relative = draft.inputs.filter((p) => !entryIdOfInput(p) && !isAbsolutePath(p));
  if (relative.length) problems.push(M.notAbsolute(relative));
  if (draft.rate === 'bitrate') {
    const [min, max] = LIMITS.videoKbps;
    if (!Number.isInteger(draft.videoKbps) || draft.videoKbps < min || draft.videoKbps > max) {
      problems.push(M.videoKbpsRange(min, max));
    }
  }
  const [amin, amax] = LIMITS.audioKbps;
  if (!Number.isInteger(draft.audioKbps) || draft.audioKbps < amin || draft.audioKbps > amax) problems.push(M.audioKbpsRange(amin, amax));
  if (draft.outDir !== null && draft.outDir.trim() && !isAbsolutePath(draft.outDir.trim())) problems.push(M.outDirAbsolute);
  return problems;
}

/**
 * Form → `transcode` parameters: give either CRF or the video bitrate, not both; audio extraction gets no video settings. `dir` is the save location for this run (chosen with “Change…”, or given by `tools.list`); when neither is present, `outDir` is not sent, and the Runtime writes to its own save location.
 */
export function transcodeRequest(draft: TranscodeDraft, action: TranscodeAction, dir?: string): TranscodeStartParams {
  const outDir = (dir ?? draft.outDir)?.trim();
  const inputs = draft.inputs.map((input) => {
    const entryId = entryIdOfInput(input);
    return entryId ? { entryId } : input;
  });
  if (action === 'extract-audio') return { inputs, action, audioBitrateKbps: draft.audioKbps, ...(outDir ? { outDir } : {}) };
  return {
    inputs,
    action,
    codec: draft.codec,
    ...(draft.maxHeight !== null ? { maxHeight: draft.maxHeight } : {}),
    ...(draft.rate === 'bitrate' ? { videoBitrateKbps: draft.videoKbps } : { crf: crfOf(draft.quality, draft.codec) }),
    audioBitrateKbps: draft.audioKbps,
    ...(outDir ? { outDir } : {}),
  };
}

/** The one-line message when submit is rejected: names ffmpeg when it is unavailable (`MEDIA_TOOL_UNAVAILABLE`); for a missing file or directory, uses the Runtime's wording as is. */
export function rejectionText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { details?: { code?: unknown } } | null)?.details?.code;
  if (code === 'MEDIA_TOOL_UNAVAILABLE') return M.ffmpegUnusable(message);
  return message;
}

/** One-line summary of the settings: “original · H.264 · balanced · audio 128 kbps”. */
export function settingsLine(draft: TranscodeDraft): string {
  const cap = HEIGHT_CAPS.find((h) => h.height === draft.maxHeight);
  const height = cap?.key === 'original' ? M.heightOriginalLong : (cap?.name ?? `${draft.maxHeight}p`);
  const rate = draft.rate === 'bitrate' ? `${draft.videoKbps} kbps` : (QUALITIES.find((q) => q.key === draft.quality)?.name ?? '');
  return [height, codecName(draft.codec), rate, M.audioKbps(draft.audioKbps)].join(' · ');
}

// ---- ffmpeg ----

export interface FfmpegLine {
  /** Whether it can be submitted: false when it is not installed, cannot run, or is too old. */
  ready: boolean;
  text: string;
  /** How to fix it when it cannot be used (the sentence the Runtime provides). */
  remedy: string | null;
}

/** Current state of ffmpeg (the ffmpeg entry of `externalTools.detect`, design mockup `ffmpegStatus`). */
export function ffmpegLine(probed: ExternalToolStatus | null): FfmpegLine {
  const status = probed && localizeToolStatus(probed);
  // Without a detection result, no platform-specific command can be given (the Runtime may be on another machine), so only say what to install.
  if (!status) return { ready: false, text: M.ffmpegNeeded, remedy: M.ffmpegInstallHint };
  const version = status.version ? ` ${status.version}` : '';
  switch (status.state) {
    case 'installed':
      return { ready: true, text: M.ffmpegReady(version), remedy: null };
    case 'outdated':
      return { ready: false, text: M.ffmpegOutdated(version), remedy: status.remedy ?? status.reason };
    case 'unavailable':
      return { ready: false, text: M.ffmpegCannotRun, remedy: status.remedy ?? status.reason };
    case 'missing':
      return { ready: false, text: M.ffmpegNeeded, remedy: status.remedy ?? status.reason };
  }
}

// ---- Records ----

/** Frozen parameters (the parent job's `pipeline.params`). */
export function transcodeParams(job: Pick<JobRecord, 'pipeline'>): TranscodeParams | null {
  const params = job.pipeline?.name === TRANSCODE_PIPELINE ? job.pipeline.params : null;
  if (!params || !Array.isArray(params.inputs) || !['compress', 'merge', 'extract-audio'].includes(params.action as string)) return null;
  return params as unknown as TranscodeParams;
}

/**
 * Records in the right column: the `transcode` parent jobs submitted from this computer's UI, newest first; jobs hidden on this machine are left out. Compress and merge are listed together
 * (design mockup: both pages share one queue and show the same list).
 */
export function transcodeJobs(jobs: readonly JobRecord[], hidden: readonly Id[]): JobRecord[] {
  const skip = new Set(hidden);
  return jobs
    .filter(
      (job) =>
        job.kind === 'pipeline' &&
        job.pipeline?.name === TRANSCODE_PIPELINE &&
        job.videoId === null &&
        job.submitter.kind === 'connection' &&
        !skip.has(job.jobId),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function transcodeAction(job: Pick<JobRecord, 'pipeline'>): TranscodeAction {
  return transcodeParams(job)?.action ?? 'compress';
}

/** Record card title: the output file name once done; before that, the input (「a.mp4」 “a.mp4 etc., 3 files” “a.mp4 + 2 segments”). */
export function transcodeTitle(job: Pick<JobRecord, 'pipeline' | 'result'>): string {
  const outputs = transcodeOutputs(job);
  if (outputs.length === 1) return fileName(outputs[0]!.path!);
  if (outputs.length > 1) return M.filesTitle(fileName(outputs[0]!.path!), outputs.length);
  const params = transcodeParams(job);
  const inputs = params?.inputs ?? [];
  if (!inputs.length) return M.defaultTitle;
  const first = fileName(inputs[0]!);
  if (inputs.length === 1) return first;
  return params?.action === 'merge' ? M.mergeTitle(first, inputs.length - 1) : M.filesTitle(first, inputs.length);
}

function qualityName(crf: number, codec: TranscodeCodec): string {
  const preset = QUALITIES.find((q) => crfOf(q.key, codec) === crf);
  return preset ? M.qualityWithCrf(preset.name, crf) : `CRF ${crf}`;
}

/**
 * The settings line under the record card title (design mockup `jobMeta`): “压缩 · ≤720p · H.264 · 均衡（CRF 26）” (compress · ≤720p · H.264 · balanced (CRF 26)), “合并 3 段 · H.264 · 高画质（CRF 22）” (merge 3 segments · H.264 · high quality (CRF 22)).
 * When a merge has been decided as stream copy, resolution, codec and quality do not apply, and only “merge 3 segments · stream copy” is written.
 */
export function transcodeMeta(job: Pick<JobRecord, 'pipeline'>): string {
  const params = transcodeParams(job);
  if (!params) return '';
  if (params.action === 'merge' && mergeMode(job)?.mode === 'stream-copy') return M.mergeStreamCopy(params.inputs.length);
  if (params.action === 'extract-audio') return params.inputs.length > 1 ? M.extractAudioMany(params.inputs.length) : M.extractAudio;
  const codec = params.codec ?? 'h264';
  const bits = [params.action === 'merge' ? M.mergeClips(params.inputs.length) : params.inputs.length > 1 ? M.compressMany(params.inputs.length) : M.compress];
  if (params.maxHeight !== undefined) bits.push(`≤${params.maxHeight}p`);
  bits.push(codecName(codec));
  if (params.videoBitrateKbps !== undefined) bits.push(`${params.videoBitrateKbps} kbps`);
  else if (params.crf !== undefined) bits.push(qualityName(params.crf, codec));
  return bits.join(' · ');
}

/** The step's sub-job (`pipeline.steps[].jobId`): delivered together with the parent job on the `jobs` topic. */
function stepJob(job: Pick<JobRecord, 'pipeline'>, all: readonly JobRecord[], name: string): JobRecord | null {
  const id = job.pipeline?.steps.find((s) => s.name === name)?.jobId;
  return id ? (all.find((j) => j.jobId === id) ?? null) : null;
}

export interface TranscodeProgress {
  text: string;
  /** Percentage for the encode step; null when the other steps and the total are unknown (indeterminate progress bar). */
  percent: number | null;
}

/**
 * The running line (design mockup `progressLine`): while encoding, it reads the sub-job's progress in seconds, “encoding 0:12 / 0:42 · 28%”; for other steps, it writes the step name and its number
 * “reading input · step 1/4”. The parent job's progress only counts the steps completed and does not fake a percentage.
 */
export function transcodeProgress(job: Pick<JobRecord, 'pipeline' | 'phase' | 'progress'>, all: readonly JobRecord[]): TranscodeProgress {
  const steps = job.pipeline?.steps ?? [];
  const index = job.pipeline?.current ?? null;
  const step = index !== null ? steps[index] : undefined;
  const child = step ? stepJob(job, all, step.name) : null;
  // This step's sub-job is still queued (for example, the ffmpeg concurrency slot is taken by another job): write what it is waiting for, using the reason the Runtime recorded.
  if (step && child?.state === 'queued') return { text: M.stepQueued(pipelineStepLabel(step), jobWaitText(child.wait)), percent: null };
  if (step?.name === 'encode') {
    const p = child?.progress;
    if (p && p.unit === 'seconds' && p.total && p.total > 0) {
      const percent = Math.max(0, Math.min(100, Math.floor((p.done / p.total) * 100)));
      return { text: `${JOB_PHASE_LABEL.encoding} ${formatClock(p.done)} / ${formatClock(p.total)} · ${percent}%`, percent };
    }
    return { text: JOB_PHASE_LABEL.encoding, percent: null };
  }
  if (step && index !== null) return { text: M.stepOf(pipelineStepLabel(step), index + 1, steps.length), percent: null };
  return { text: JOB_PHASE_LABEL[job.phase], percent: null };
}

/** Outputs published to the user's folder (videos in `result.outputs` that have a `path`). */
export function transcodeOutputs(job: Pick<JobRecord, 'result'>): GeneratedOutput[] {
  return (job.result?.outputs ?? []).filter((o) => typeof o.path === 'string' && o.path.length > 0);
}

/** Summary on completion (`pipeline.summary`). */
export function transcodeSummary(job: Pick<JobRecord, 'pipeline'>): TranscodeSummary | null {
  const summary = job.pipeline?.name === TRANSCODE_PIPELINE ? job.pipeline.summary : null;
  if (!summary || (summary.mode !== 'stream-copy' && summary.mode !== 're-encode')) return null;
  return summary as unknown as TranscodeSummary;
}

/**
 * The source file size recorded by the read-input step (step output `stats[].size`). This is the step's own shape, not a public contract: null when it cannot be read, and the result line then writes only the output size.
 */
export function inputSizes(job: Pick<JobRecord, 'pipeline'>): number[] | null {
  const output = job.pipeline?.steps.find((s) => s.name === 'probe')?.output;
  const stats = output?.stats;
  if (!Array.isArray(stats)) return null;
  const sizes = stats.map((s) => (s && typeof (s as { size?: unknown }).size === 'number' ? (s as { size: number }).size : NaN));
  return sizes.every((n) => Number.isFinite(n)) ? sizes : null;
}

/** Byte count (design mockup `humanBytes`, base 1024): 「68.4 MB」 「512 KB」. */
export function humanBytes(bytes: number): string {
  const v = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`;
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  if (v >= 1024) return `${Math.round(v / 1024)} KB`;
  return `${Math.round(v)} B`;
}

/** How much was saved; null when the source was already smaller (design mockup `savedPercent`). */
export function savedPercent(before: number, after: number): number | null {
  return before > 0 && after < before ? Math.round(((before - after) / before) * 100) : null;
}

export interface TranscodeResultRow {
  path: string;
  name: string;
  /** 「1920×1080 · 0:42 · H.264 / AAC」 */
  meta: string;
  /** “68.4 MB → 21.8 MB, 68% smaller”; when the source size cannot be read, only the output size is written. */
  size: string;
}

/** One line per finished output file. When compressing, output i corresponds to input i; when merging, the comparison is against the total of the source files. */
export function transcodeResults(job: Pick<JobRecord, 'pipeline' | 'result'>): TranscodeResultRow[] {
  const outputs = transcodeOutputs(job);
  const sizes = inputSizes(job);
  const action = transcodeAction(job);
  const merge = action === 'merge';
  return outputs.map((output, i) => {
    const media = output.media;
    // Audio extraction: the output is an audio track, so its size is not compared with the source file.
    if (action === 'extract-audio') {
      const meta = media.kind === 'audio' ? `${formatClock(media.durationSec)} · ${media.sampleRate / 1000} kHz` : '';
      return { path: output.path!, name: fileName(output.path!), meta, size: humanBytes(output.byteLength) };
    }
    const meta =
      media.kind === 'video'
        ? [
            `${media.width}×${media.height}`,
            formatClock(media.durationSec),
            [codecName(media.videoCodec), media.audioCodec ? media.audioCodec.toUpperCase() : M.noAudioTrack].join(' / '),
          ].join(' · ')
        : '';
    const before = sizes ? (merge ? sizes.reduce((sum, n) => sum + n, 0) : (sizes[i] ?? null)) : null;
    const after = humanBytes(output.byteLength);
    let size = after;
    // Merging is not meant to make the file smaller: write the total size of the source files, and do not compute how much was saved.
    if (before !== null && merge) size = M.mergedSize(after, humanBytes(before));
    else if (before !== null) {
      const saved = savedPercent(before, output.byteLength);
      size = M.savedSize(humanBytes(before), after, saved);
    }
    return { path: output.path!, name: fileName(output.path!), meta, size };
  });
}

/** How the merge decision is picked up: after completion, read the summary; before completion, read the output of the read-input step (the step's own shape). Null for compress and when not yet decided. */
function mergeMode(job: Pick<JobRecord, 'pipeline'>): { mode: TranscodeSummary['mode']; reason: string | null } | null {
  if (transcodeAction(job) !== 'merge') return null;
  const summary = transcodeSummary(job);
  if (summary) return { mode: summary.mode, reason: summary.reason };
  const probe = job.pipeline?.steps.find((s) => s.name === 'probe')?.output;
  if (probe?.mode !== 'stream-copy' && probe?.mode !== 're-encode') return null;
  return { mode: probe.mode, reason: typeof probe.reason === 'string' ? probe.reason : null };
}

/**
 * One sentence on how the merge was joined: stream copy (no re-encode), or re-encode and the reason (the Runtime's `reason`, for example “分辨率不一致（1920x1080 / 1280x720）” (resolutions differ (1920x1080 / 1280x720))). Not written for compress. If the read-input step has already decided before completion, that is written out too.
 */
export function mergeModeLine(job: Pick<JobRecord, 'pipeline'>): { mode: TranscodeSummary['mode']; text: string } | null {
  const decided = mergeMode(job);
  if (!decided) return null;
  const { mode, reason } = decided;
  if (mode === 'stream-copy') return { mode, text: M.streamCopyLine };
  return { mode, text: M.reencodeLine(reason) };
}

/** How long it took (start to end). */
export function elapsedText(job: Pick<JobRecord, 'startedAt' | 'endedAt'>): string | null {
  if (!job.startedAt || !job.endedAt) return null;
  const ms = Date.parse(job.endedAt) - Date.parse(job.startedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? M.underASecond : M.took(formatDuration(ms));
}

/** How a parameter is written in the shell: left as is if it contains only safe characters, otherwise wrapped in single quotes. */
function shellQuote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** “Copy this ffmpeg command”: the command summary the Runtime recorded (paths reduced to file names); one command per line when there are several. */
export function commandText(job: Pick<JobRecord, 'pipeline'>): string | null {
  const commands = transcodeSummary(job)?.executor.commands;
  if (!commands?.length) return null;
  return commands.map((args) => ['ffmpeg', ...args].map(shellQuote).join(' ')).join('\n');
}

/** Status word: while running, write “processing”, not “generating”; the rest is the same as other tools. */
export function transcodeStateWord(job: Pick<JobRecord, 'state' | 'endedAt'>): string | null {
  if (jobLive(job)) return job.state === 'queued' ? M.stateQueued : M.stateProcessing;
  return null;
}

// ---- Failed ----

/** Fixes for failures (the entries in design mockup `CAUSES` / `FIXES` for which the Runtime gives a reason code). */
export function failureRemedy(job: Pick<JobRecord, 'state' | 'error'>): string | null {
  if (job.state !== 'failed') return null;
  switch (job.error?.code) {
    case 'MEDIA_TOOL_UNAVAILABLE': {
      // The Runtime gives the install command for the platform it runs on; for older jobs that lack one, only say what to install.
      return M.remedyThenRetry(remedyText(job.error.details) ?? M.ffmpegInstallHint);
    }
    case 'INPUT_UNREADABLE':
      return M.inputUnreadable;
    case 'TRANSCODE_FAILED':
      return M.transcodeFailed;
    case 'EXPORT_VALIDATION_FAILED':
      return M.validationFailed;
    default:
      return null;
  }
}

/** The raw failure text: the end of ffmpeg's stderr, or the checks that failed. Null when there is none. */
export function failureDetail(job: Pick<JobRecord, 'error'>): string | null {
  const details = job.error?.details as { stderr?: unknown; problems?: unknown } | undefined;
  if (!details) return null;
  if (Array.isArray(details.problems) && details.problems.length) return details.problems.map(String).join('\n');
  if (typeof details.stderr === 'string' && details.stderr.trim()) return details.stderr.trim();
  return null;
}

// ---- Try again ----

/** The quality preset closest to this CRF. */
function nearestQuality(crf: number, codec: TranscodeCodec): TranscodeQuality {
  let best: TranscodeQuality = 'balanced';
  for (const q of QUALITIES) if (Math.abs(crfOf(q.key, codec) - crf) < Math.abs(crfOf(best, codec) - crf)) best = q.key;
  return best;
}

/** “Bring back to the left and try again”: frozen parameters → form. When the CRF is not a preset, the closest preset is used. */
export function againTranscodeDraft(job: Pick<JobRecord, 'pipeline'>, blank: TranscodeDraft): TranscodeDraft | null {
  const params = transcodeParams(job);
  if (!params) return null;
  const codec: TranscodeCodec = params.codec === 'hevc' ? 'hevc' : 'h264';
  return {
    ...blank,
    inputs: params.inputs.filter((p): p is string => typeof p === 'string'),
    codec,
    maxHeight: typeof params.maxHeight === 'number' ? params.maxHeight : null,
    rate: typeof params.videoBitrateKbps === 'number' ? 'bitrate' : 'quality',
    quality: typeof params.crf === 'number' ? nearestQuality(params.crf, codec) : blank.quality,
    videoKbps: typeof params.videoBitrateKbps === 'number' ? params.videoBitrateKbps : blank.videoKbps,
    audioKbps: typeof params.audioBitrateKbps === 'number' ? params.audioBitrateKbps : blank.audioKbps,
    outDir: typeof params.outDir === 'string' ? params.outDir : null,
  };
}

/** Submits again with the frozen parameters unchanged (retry, re-queue). Null when the parameters cannot be read. */
export function retryParams(job: Pick<JobRecord, 'pipeline'>): TranscodeParams | null {
  const params = transcodeParams(job);
  return params ? { ...params, inputs: [...params.inputs] } : null;
}

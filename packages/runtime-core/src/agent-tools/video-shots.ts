import {
  RpcError,
  sequenceDurationFrames,
  type Id,
  type Rate,
  type VideoShotCut,
  type VideoShotsParams,
  type VideoShotsResult,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { RcAgentTools, RcCommon } from '@cuccut/protocol/messages/runtime-core';
import type { VideoService } from '../videos/video-service.ts';
import type { MediaAnalysis } from '../media-analysis.ts';
import { ToolError } from './tool-catalog.ts';
import { frameSourceAtFrame, type FrameSource } from './video-frames.ts';

/**
 * Shot cuts (`videos_shots` and `videos.shots`, architecture design §3.5 "Shot cuts"): where the picture cuts within a
 * range of the edited timeline.
 *
 * 1. Split the range into segments by the same rule frame grabbing uses (`frameSourceAtFrame`: the topmost enabled video
 *    clip on a visible track); each segment is a piece of one clip. Where two adjacent segments change clip and the source
 *    picture does not continue (a different asset, or a jump in source time within the same asset) there is an `edit`.
 * 2. Each segment's linear, positive-rate source range goes to ffmpeg's scene score (`MediaAnalysis.sceneCuts`); frames
 *    above the threshold are mapped back to the timeline through the segment's time map and snapped to frames: `scene`.
 *    Freeze-frame and reversed clips are not analyzed.
 * 3. A shot shorter than `minShot` merges into the previous one (the first merges into the next): the cut before it (after
 *    it, for the first) is removed.
 */

/** Longest range analyzed at once (seconds): the whole picture has to be decoded. */
export const MAX_SHOTS_RANGE_SECONDS = 20 * 60;
export const DEFAULT_SCENE_THRESHOLD = 0.3;
export const DEFAULT_MIN_SHOT = 0.8;

export const SHOTS_NOTE =
  'Cuts are detected only from abrupt picture changes (ffmpeg scene score), not from people: dissolves and zooms may be missed, flashes and fast motion may add false cuts. kind "edit" is where the timeline changes clip and the source picture does not continue. To verify, use videos_frames to grab frames before and after a cut.';

export type ShotsErrorCode = 'SHOTS_RANGE_EMPTY' | 'SHOTS_RANGE_TOO_LONG';

/** A shot-detection rejection: callers turn it into an RPC error or a tool error by `code`. */
export class ShotsError extends Error {
  readonly code: ShotsErrorCode;
  readonly details: Record<string, unknown>;
  constructor(code: ShotsErrorCode, details: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

/** Tool-surface error: `ShotsError` becomes `INVALID_ARGUMENTS` (with an explanation for the model); anything else is rethrown as is. */
export function shotsToolError(error: unknown): unknown {
  if (!(error instanceof ShotsError)) return error;
  return error.code === 'SHOTS_RANGE_TOO_LONG'
    ? new ToolError('INVALID_ARGUMENTS', `The range is longer than ${MAX_SHOTS_RANGE_SECONDS / 60} minutes: split it into several ranges and detect each`, { code: error.code, ...error.details })
    : new ToolError('INVALID_ARGUMENTS', 'The range is empty once snapped to frames: end must be greater than start, and start must be within the timeline', { code: error.code, ...error.details });
}

export interface ShotsOptions {
  /** Seconds on the edited timeline; default to 0 and the duration. */
  start?: number | undefined;
  end?: number | undefined;
  threshold?: number | undefined;
  minShot?: number | undefined;
}

/** One segment of the range: frames `[from, to)` and the clip on screen (null when there is none). */
export interface ShotSegment {
  from: number;
  to: number;
  source: FrameSource | null;
}

/** The range snapped to frames: start rounds down, end rounds up, clamped to the duration. */
export function shotsRange(video: VideoSnapshot, options: Pick<ShotsOptions, 'start' | 'end'>): { from: number; to: number; fps: Rate } {
  const sequence = video.sequences[video.rootSequenceId];
  if (!sequence) throw new ShotsError('SHOTS_RANGE_EMPTY');
  const { fps } = sequence;
  const duration = sequenceDurationFrames(sequence);
  const toFrames = (seconds: number) => (seconds * fps.num) / fps.den;
  const from = Math.max(0, Math.floor(toFrames(options.start ?? 0) + 1e-9));
  const to = Math.min(duration, options.end === undefined ? duration : Math.ceil(toFrames(options.end) - 1e-9));
  if (!(to > from)) throw new ShotsError('SHOTS_RANGE_EMPTY', { start: options.start ?? 0, end: options.end ?? null });
  const seconds = ((to - from) * fps.den) / fps.num;
  if (seconds > MAX_SHOTS_RANGE_SECONDS + 1e-9) {
    throw new ShotsError('SHOTS_RANGE_TOO_LONG', { seconds, maxSeconds: MAX_SHOTS_RANGE_SECONDS });
  }
  return { from, to, fps };
}

/**
 * Splits the frame range `[from, to)` by the clip on screen: boundaries are the range ends and the start/end frames of
 * every video clip inside it; each piece asks for the topmost clip at its start, and adjacent pieces with the same clip
 * (or both with no clip) merge into one segment.
 */
export function shotSegments(video: VideoSnapshot, from: number, to: number): ShotSegment[] {
  const sequence = video.sequences[video.rootSequenceId];
  if (!sequence) return [];
  const bounds = new Set([from, to]);
  for (const item of sequence.items) {
    if (item.type !== 'video') continue;
    for (const f of [item.span.fromFrame, item.span.fromFrame + item.span.durationFrames]) if (f > from && f < to) bounds.add(f);
  }
  const sorted = [...bounds].sort((a, b) => a - b);
  const out: ShotSegment[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const source = frameSourceAtFrame(video, sorted[i]!);
    const last = out[out.length - 1];
    if (last && (last.source?.item.id ?? null) === (source?.item.id ?? null)) last.to = sorted[i + 1]!;
    else out.push({ from: sorted[i]!, to: sorted[i + 1]!, source });
  }
  return out;
}

/** Linear, positive-rate source clock: the clip's source time (seconds) and rate at frame `frame`; null for freeze-frame or reversed clips. */
function linearAt(source: FrameSource, frame: number, fps: Rate): { at: number; rate: number } | null {
  const map = source.item.timeMap;
  if (map.kind !== 'linear' || map.rate.num <= 0) return null;
  const rate = map.rate.num / map.rate.den;
  const local = ((frame - source.item.span.fromFrame) * fps.den) / fps.num;
  return { at: Number(map.sourceIn.ticks) / map.sourceIn.timescale + local * rate, rate };
}

/** Whether the picture continues where two segments meet: same asset revision, same rate, and the source time after the left segment's last frame is within half a frame of the right segment's first frame. */
function continuous(left: ShotSegment, right: ShotSegment, fps: Rate): boolean {
  if (!left.source || !right.source) return false;
  if (left.source.assetId !== right.source.assetId || left.source.revision !== right.source.revision) return false;
  const a = linearAt(left.source, left.to, fps);
  const b = linearAt(right.source, right.from, fps);
  if (!a || !b || Math.abs(a.rate - b.rate) > 1e-9) return false;
  return Math.abs(a.at - b.at) < (0.5 * fps.den * a.rate) / fps.num;
}

/** A frame number as seconds (6 decimal places). */
function secondsOf(frame: number, fps: Rate): number {
  return Math.round(((frame * fps.den) / fps.num) * 1e6) / 1e6;
}

/** The time used to grab a frame: the middle of the frame (decimal seconds string), so converting back to a frame number never falls to the previous frame through truncation. */
function sampleText(frame: number, fps: Rate): string {
  const value = ((frame + 0.5) * fps.den) / fps.num;
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export interface ShotsDeps {
  analysis: MediaAnalysis;
  /** The file of an asset revision (resolved the same way as `videos_frames`). */
  assetFile: (assetId: Id, revision: string) => Promise<{ root: string; file: string }>;
}

/** Detects shot cuts (see the module comment). */
export async function detectShots(deps: ShotsDeps, video: VideoSnapshot, options: ShotsOptions): Promise<Omit<VideoShotsResult, 'videoId'>> {
  const threshold = options.threshold ?? DEFAULT_SCENE_THRESHOLD;
  const minShot = options.minShot ?? DEFAULT_MIN_SHOT;
  const { from, to, fps } = shotsRange(video, options);
  const segments = shotSegments(video, from, to);

  const cuts = new Map<number, { score: number | null; kind: VideoShotCut['kind'] }>();
  for (let i = 1; i < segments.length; i++) {
    if (!continuous(segments[i - 1]!, segments[i]!, fps)) cuts.set(segments[i]!.from, { score: null, kind: 'edit' });
  }
  for (const segment of segments) {
    const source = segment.source;
    const start = source ? linearAt(source, segment.from, fps) : null;
    if (!source || !start) continue;
    const durSec = (((segment.to - segment.from) * fps.den) / fps.num) * start.rate;
    const found = await deps.analysis.sceneCuts(source.asset, { fromSec: start.at, durSec, threshold }, () =>
      deps.assetFile(source.assetId, source.revision),
    );
    for (const cut of found) {
      const frame = segment.from + Math.round((((cut.at - start.at) / start.rate) * fps.num) / fps.den);
      if (frame <= segment.from || frame >= segment.to) continue;
      const existing = cuts.get(frame);
      if (!existing || (existing.kind === 'scene' && (existing.score ?? 0) < cut.score)) cuts.set(frame, { score: cut.score, kind: 'scene' });
    }
  }

  // A shot shorter than minShot merges into the previous one (the first merges into the next).
  const frames = [...cuts.keys()].sort((a, b) => a - b);
  const minFrames = (minShot * fps.num) / fps.den;
  for (;;) {
    const edges = [from, ...frames, to];
    const short = edges.findIndex((edge, i) => i + 1 < edges.length && edges[i + 1]! - edge < minFrames - 1e-9);
    if (short < 0 || frames.length === 0) break;
    frames.splice(short === 0 ? 0 : short - 1, 1);
  }

  const edges = [from, ...frames, to];
  return {
    revision: video.revision,
    range: { start: secondsOf(from, fps), end: secondsOf(to, fps) },
    cuts: frames.map((frame) => ({ at: secondsOf(frame, fps), ...cuts.get(frame)! })),
    shots: edges.slice(0, -1).map((start, i) => {
      const end = edges[i + 1]!;
      const at = (p: number) => sampleText(Math.min(end - 1, start + Math.floor((end - start) * p)), fps);
      return { start: secondsOf(start, fps), end: secondsOf(end, fps), sampleAt: [at(0.2), at(0.5), at(0.8)] };
    }),
    threshold,
    minShot,
    detector: 'ffmpeg-scene',
  };
}

/** `videos.shots` (gateway method): the same implementation as the `videos_shots` tool; the video must already be open. */
export async function videoShots(deps: { analysis: MediaAnalysis; videos: VideoService }, params: VideoShotsParams): Promise<VideoShotsResult> {
  const video = deps.videos.mirror(params.videoId)?.video;
  if (!video) throw new RpcError('not-found', RcCommon.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
  try {
    const result = await detectShots(
      { analysis: deps.analysis, assetFile: (assetId, revision) => deps.videos.assetFile(params.videoId, assetId, revision) },
      video,
      params,
    );
    return { videoId: params.videoId, ...result };
  } catch (error) {
    if (!(error instanceof ShotsError)) throw error;
    const message =
      error.code === 'SHOTS_RANGE_TOO_LONG'
        ? RcAgentTools.shotsRangeTooLong({ minutes: MAX_SHOTS_RANGE_SECONDS / 60 })
        : RcAgentTools.shotsRangeEmpty();
    throw new RpcError('invalid-request', message, { code: error.code, ...error.details });
  }
}

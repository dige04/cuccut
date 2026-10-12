// i18n-ignore-file: 给模型的工具说明与说明文字
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
 * 镜头切换（`videos_shots` 与 `videos.shots`，架构设计 §3.5「镜头切换」）：剪辑后时间线上一段区间里画面在哪里切换。
 *
 * 1. 按取帧的同一条规则（`frameSourceAtFrame`：最上层、启用、轨道可见的视频片段）把区间切成若干段，每段是一个片段的一截；
 *    相邻两段换了片段、源画面又不接续（不同素材，或同一素材的源时间跳了）的地方是一处 `edit`。
 * 2. 每段线性正速率的源区间交给 ffmpeg 的场景分数（`MediaAnalysis.sceneCuts`），超过阈值的帧按这段的时间映射换回时间线，
 *    对到帧，是 `scene`。静帧、倒放的片段不检测。
 * 3. 短于 `minShot` 的镜头并进前一个（第一个并进后一个）：去掉它前面（第一个时是后面）的那处切换。
 */

/** 一次最多检测这么长的区间（秒）：要解码整段画面。 */
export const MAX_SHOTS_RANGE_SECONDS = 20 * 60;
export const DEFAULT_SCENE_THRESHOLD = 0.3;
export const DEFAULT_MIN_SHOT = 0.8;

export const SHOTS_NOTE =
  '切换点只看画面突变（ffmpeg 场景分数），不认人：叠化、推拉会漏报，闪光、快速运动可能多报。kind "edit" 是时间线上换了片段、源画面接不上的地方。要核对时用 videos_frames 取切换点前后的帧。';

export type ShotsErrorCode = 'SHOTS_RANGE_EMPTY' | 'SHOTS_RANGE_TOO_LONG';

/** 镜头检测的拒绝：调用方按 `code` 换成 RPC 错误或工具错误。 */
export class ShotsError extends Error {
  readonly code: ShotsErrorCode;
  readonly details: Record<string, unknown>;
  constructor(code: ShotsErrorCode, details: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

/** 工具面的错误：`ShotsError` 换成 `INVALID_ARGUMENTS`（给模型看的说明），别的原样抛。 */
export function shotsToolError(error: unknown): unknown {
  if (!(error instanceof ShotsError)) return error;
  return error.code === 'SHOTS_RANGE_TOO_LONG'
    ? new ToolError('INVALID_ARGUMENTS', `区间超过 ${MAX_SHOTS_RANGE_SECONDS / 60} 分钟：分成几段分别检测`, { code: error.code, ...error.details })
    : new ToolError('INVALID_ARGUMENTS', '区间对到帧之后是空的：终点要大于起点，起点要在时间线里', { code: error.code, ...error.details });
}

export interface ShotsOptions {
  /** 剪辑后时间线上的秒；缺省 0 与时长。 */
  start?: number | undefined;
  end?: number | undefined;
  threshold?: number | undefined;
  minShot?: number | undefined;
}

/** 区间里的一段：帧号 `[from, to)` 与画面上的片段（没有片段时 null）。 */
export interface ShotSegment {
  from: number;
  to: number;
  source: FrameSource | null;
}

/** 对到帧之后的区间：起点向下、终点向上取整，截到时长。 */
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
 * 把帧区间 `[from, to)` 按画面上的片段切段：边界是区间两端与其中各视频片段的起止帧；每个小段在起点问一次最上层的片段，
 * 相邻的同一片段（或都没有片段）合成一段。
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

/** 线性正速率的源时钟：片段在帧 `frame` 处的源时间（秒）与速率；静帧、倒放的为 null。 */
function linearAt(source: FrameSource, frame: number, fps: Rate): { at: number; rate: number } | null {
  const map = source.item.timeMap;
  if (map.kind !== 'linear' || map.rate.num <= 0) return null;
  const rate = map.rate.num / map.rate.den;
  const local = ((frame - source.item.span.fromFrame) * fps.den) / fps.num;
  return { at: Number(map.sourceIn.ticks) / map.sourceIn.timescale + local * rate, rate };
}

/** 两段相接处的画面接不接得上：同一素材版本、同一速率，左段末帧之后的源时间与右段首帧相差不到半帧。 */
function continuous(left: ShotSegment, right: ShotSegment, fps: Rate): boolean {
  if (!left.source || !right.source) return false;
  if (left.source.assetId !== right.source.assetId || left.source.revision !== right.source.revision) return false;
  const a = linearAt(left.source, left.to, fps);
  const b = linearAt(right.source, right.from, fps);
  if (!a || !b || Math.abs(a.rate - b.rate) > 1e-9) return false;
  return Math.abs(a.at - b.at) < (0.5 * fps.den * a.rate) / fps.num;
}

/** 帧号写成秒（6 位小数）。 */
function secondsOf(frame: number, fps: Rate): number {
  return Math.round(((frame * fps.den) / fps.num) * 1e6) / 1e6;
}

/** 取帧用的时刻：帧的正中（十进制秒字符串），换回帧号时不会因为小数截断落到前一帧。 */
function sampleText(frame: number, fps: Rate): string {
  const value = ((frame + 0.5) * fps.den) / fps.num;
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export interface ShotsDeps {
  analysis: MediaAnalysis;
  /** 素材版本的文件（同 `videos_frames` 的取法）。 */
  assetFile: (assetId: Id, revision: string) => Promise<{ root: string; file: string }>;
}

/** 检测镜头切换（见模块说明）。 */
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

  // 短于 minShot 的镜头并进前一个（第一个并进后一个）。
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

/** `videos.shots`（网关方法）：与工具 `videos_shots` 同一个实现；视频要已经打开。 */
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

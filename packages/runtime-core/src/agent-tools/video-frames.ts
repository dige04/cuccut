import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mediaTimeToSeconds, type Id, type VideoItem, type VideoSnapshot } from '@cuccut/protocol';
import type { DetectedFace, FaceDetector } from '../face-detection.ts';
import type { MediaAnalysis, FrameAsset } from '../media-analysis.ts';
import { inside, refuseVideoDirectory } from './artifact-save.ts';
import { ToolError } from './tool-catalog.ts';

/**
 * Frame grabbing for `videos_frames` (agent surface design §4.3): a time on the timeline -> the topmost video clip on
 * screen -> asset time -> one frame of the asset.
 * Nothing is composited: captions, text, stickers and overlaid elements are not in the frame, and picture-in-picture
 * position and effects are not applied; it is only that clip's asset picture.
 */

/** Maximum frames per call. */
export const MAX_FRAMES = 24;
/** Long-edge limit of a frame (pixels) when `maxWidth` is not given. */
export const DEFAULT_FRAME_EDGE = 1280;
/** How many frames `range` grabs when `count` is not given. */
export const DEFAULT_RANGE_COUNT = 6;

/** Frames are written here under the output directory, split by videoId. */
export const FRAMES_DIR = path.join('.cuccut-out', 'frames');

export const FRAMES_NOTE =
  'A frame is the asset picture of the topmost video clip on the timeline, not the composited picture: captions, text, stickers and overlaid elements are not in it, and picture-in-picture position, crop and effects are not applied (composited: false). At times with no video clip, file is null. faces are the face boxes detected in this frame (x, y, w, h normalized to 0-1 by the frame width and height; score is the confidence), with coordinates in the asset picture; when detector is null no face detection ran, so empty faces does not mean there are no faces.';

/** The source found at one time on the timeline: clip, asset revision and asset time. */
export interface FrameSource {
  item: VideoItem;
  asset: FrameAsset;
  assetId: Id;
  revision: string;
  sourceSeconds: number;
}

/** The times to grab (decimal seconds strings): `at` as given; `range` takes `count` evenly spaced times in [start, end), the first at start. */
export function frameTimes(args: { at?: string[] | undefined; range?: string | undefined; count?: number | undefined }): string[] {
  if ((args.at === undefined) === (args.range === undefined)) {
    throw new ToolError('INVALID_ARGUMENTS', 'Give exactly one of at and range: at is a list of times, range is "start:end"');
  }
  if (args.at !== undefined) {
    if (args.count !== undefined) throw new ToolError('INVALID_ARGUMENTS', 'count is only used with range');
    return args.at;
  }
  const [from, to] = args.range!.split(':').map(Number) as [number, number];
  if (!(to > from)) throw new ToolError('INVALID_ARGUMENTS', 'The end of range must be greater than its start');
  const count = args.count ?? DEFAULT_RANGE_COUNT;
  return Array.from({ length: count }, (_, i) => decimal(from + ((to - from) * i) / count));
}

/**
 * The source at `seconds` on the timeline: among the enabled video clips on the root sequence that cover this frame
 * (`floor(seconds x fps)`), sit on a visible track and whose asset has a picture, the topmost one (a higher visual-track
 * `order` is higher; within one track by `paintOrder`), converted to asset time through its time map. null when none.
 */
export function frameSourceAt(video: VideoSnapshot, seconds: number): FrameSource | null {
  const sequence = video.sequences[video.rootSequenceId];
  if (!sequence) return null;
  const { fps } = sequence;
  return frameSourceAtFrame(video, Math.floor((seconds * fps.num) / fps.den + 1e-9));
}

/** Like `frameSourceAt`, by root-sequence frame number. */
export function frameSourceAtFrame(video: VideoSnapshot, frame: number): FrameSource | null {
  const sequence = video.sequences[video.rootSequenceId];
  if (!sequence) return null;
  const { fps } = sequence;
  const tracks = new Map(sequence.tracks.filter((t) => t.kind === 'visual' && t.visible).map((t) => [t.id, t.order]));
  let best: { item: VideoItem; order: number } | null = null;
  for (const item of sequence.items) {
    if (item.type !== 'video' || !item.enabled) continue;
    const order = tracks.get(item.trackId);
    if (order === undefined) continue;
    if (frame < item.span.fromFrame || frame >= item.span.fromFrame + item.span.durationFrames) continue;
    if (!video.assets[item.assetRef.id]?.revisions[item.assetRef.revision]?.video) continue;
    if (best && (best.order > order || (best.order === order && best.item.paintOrder >= item.paintOrder))) continue;
    best = { item, order };
  }
  if (!best) return null;
  const { item } = best;
  const record = video.assets[item.assetRef.id]!.revisions[item.assetRef.revision]!;
  const local = ((frame - item.span.fromFrame) * fps.den) / fps.num;
  const sourceSeconds =
    item.timeMap.kind === 'hold'
      ? mediaTimeToSeconds(item.timeMap.sourceAt)
      : mediaTimeToSeconds(item.timeMap.sourceIn) + (local * item.timeMap.rate.num) / item.timeMap.rate.den;
  return {
    item,
    asset: {
      contentHash: record.contentHash,
      mediaType: record.mediaType,
      durationSec: record.duration ? mediaTimeToSeconds(record.duration) : null,
    },
    assetId: item.assetRef.id,
    revision: item.assetRef.revision,
    sourceSeconds,
  };
}

/**
 * The frame output directory `<root>/.cuccut-out/frames/<videoId>`: created when missing; by real path it must not leave
 * `root` (nor `confine` when given), and must not be inside a video directory or `.ccut`. Returns the real path.
 */
export async function framesDirectory(root: string, videoId: Id, confine: string | null): Promise<string> {
  const refuse = () =>
    new ToolError('PATH_OUTSIDE_WORKSPACE', `The frame output directory ${FRAMES_DIR} points outside the output directory (it must not go through a symlink pointing elsewhere)`);
  await fs.mkdir(root, { recursive: true });
  const rootReal = await fs.realpath(root);
  if (confine !== null && !inside(rootReal, await fs.realpath(confine))) throw refuse();
  await refuseVideoDirectory(path.parse(rootReal).root, rootReal, []);
  const dir = path.join(rootReal, FRAMES_DIR, videoId);
  await fs.mkdir(dir, { recursive: true });
  const real = await fs.realpath(dir);
  if (!inside(real, rootReal)) throw refuse();
  return real;
}

/** Grabs one frame and writes it as `at-<milliseconds>ms.<png|jpg>` (grabbing the same time again overwrites it). Returns the file's absolute path and pixel size. */
export async function writeFrame(
  analysis: MediaAnalysis,
  source: FrameSource,
  locate: () => Promise<{ root: string; file: string }>,
  options: { dir: string; at: string; format: 'png' | 'jpeg'; maxWidth: number | undefined },
): Promise<{ file: string; width: number; height: number }> {
  const box = options.maxWidth
    ? { width: options.maxWidth, height: options.maxWidth * 3 }
    : { width: DEFAULT_FRAME_EDGE, height: DEFAULT_FRAME_EDGE };
  const frame = await analysis.videoFrame(source.asset, source.sourceSeconds, { ...box, format: options.format }, locate);
  const millis = Math.round(Number(options.at) * 1000);
  const file = path.join(options.dir, `at-${millis}ms.${options.format === 'png' ? 'png' : 'jpg'}`);
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, frame.data);
  await fs.rename(tmp, file).catch(async (error: unknown) => {
    await fs.rm(tmp, { force: true });
    throw error;
  });
  return { file, width: frame.width, height: frame.height };
}

/** A grabbed frame (`file` is null when there is no video clip at that time). */
export interface TakenFrame {
  at: string;
  file: string | null;
}

/**
 * Tags grabbed frames with faces: frames with a file get `faces` (an empty array when the detector is unavailable),
 * frames without a file get none; `detector` is the detector's id, null when there is no detector or detection failed
 * this time (no error; the frames are returned as usual).
 */
export async function withFaces<T extends TakenFrame>(
  detector: FaceDetector | undefined,
  frames: T[],
): Promise<{ detector: 'yunet' | null; frames: Array<T | (T & { faces: DetectedFace[] })> }> {
  const files = frames.flatMap((frame) => (frame.file === null ? [] : [frame.file]));
  const found = detector && files.length > 0 ? await detector.detect(files) : null;
  let next = 0;
  return {
    detector: found?.detector ?? null,
    frames: frames.map((frame) => (frame.file === null ? frame : { ...frame, faces: found?.faces[next++] ?? [] })),
  };
}

function decimal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

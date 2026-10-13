import {
  framesToSeconds,
  itemAssetRef,
  itemRangeSeconds,
  itemTimeMap,
  mediaTimeToSeconds,
  type Id,
  type Rate,
  type Sequence,
} from '@cuccut/protocol';

/**
 * Time projection for `chapters_adopt` (architecture design §7.9): snapped source chapters are in asset (source) time,
 * while chapters are pinned to times on the timeline, so they are converted to timeline seconds through this asset's
 * clips on the timeline. The opposite direction from frame grabbing (`frameSourceAt`, timeline -> source).
 *
 * - Only enabled clips with a linear map (`timeMap.kind` is `linear`) count; a freeze frame (`hold`) has no invertible time.
 * - When one source time falls in several clips (the same asset placed several times, or one video and one audio clip),
 *   the earliest on the timeline wins.
 * - When the source time falls in a cut-away part (inside no clip), `offTimeline: true`: it lands on the start of the
 *   nearest clip after it in source time (the topic resumes after the cut); when there is no clip after it, it lands on
 *   the start of the nearest clip before it.
 */

/** One piece of an asset on the timeline: the source range `[sourceStart, sourceEnd)` maps to the timeline from `timelineStart`. */
export interface AssetSegment {
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  /** For every 1 second of source, the timeline advances `rate.den / rate.num` seconds. */
  rate: Rate;
}

/** The asset's linear clips on the sequence, sorted by timeline start. Empty when it is not on the timeline. */
export function assetSegments(sequence: Sequence, assetId: Id): AssetSegment[] {
  const segments: AssetSegment[] = [];
  for (const item of sequence.items) {
    if (!item.enabled || itemAssetRef(item)?.id !== assetId) continue;
    const map = itemTimeMap(item);
    if (map?.kind !== 'linear' || map.rate.num <= 0 || map.rate.den <= 0) continue;
    const range = itemRangeSeconds(item, sequence.fps);
    const length = range.end - range.start;
    if (!(length > 0)) continue;
    const sourceStart = mediaTimeToSeconds(map.sourceIn);
    segments.push({
      sourceStart,
      sourceEnd: sourceStart + (length * map.rate.num) / map.rate.den,
      timelineStart: range.start,
      rate: map.rate,
    });
  }
  return segments.sort((a, b) => a.timelineStart - b.timelineStart || a.sourceStart - b.sourceStart);
}

/** Where a source time lands on the timeline; `segments` must not be empty. */
export function projectSourceTime(segments: readonly AssetSegment[], sourceSeconds: number): { at: number; offTimeline: boolean } {
  let best: number | null = null;
  for (const segment of segments) {
    if (sourceSeconds < segment.sourceStart || sourceSeconds >= segment.sourceEnd) continue;
    const at = segment.timelineStart + ((sourceSeconds - segment.sourceStart) * segment.rate.den) / segment.rate.num;
    if (best === null || at < best) best = at;
  }
  if (best !== null) return { at: best, offTimeline: false };
  const after = segments
    .filter((segment) => segment.sourceStart > sourceSeconds)
    .sort((a, b) => a.sourceStart - b.sourceStart || a.timelineStart - b.timelineStart)[0];
  if (after) return { at: after.timelineStart, offTimeline: true };
  const before = [...segments].sort((a, b) => b.sourceEnd - a.sourceEnd || a.timelineStart - b.timelineStart)[0]!;
  return { at: before.timelineStart, offTimeline: true };
}

/** A chapter before and after projection: `sourceAt` is the snapped source time, `at` is timeline seconds (snapped to a frame). */
export interface ProjectedChapter<T> {
  title: string;
  sourceAt: number;
  at: number;
  offTimeline: boolean;
  row: T;
}

/**
 * Projects cleaned chapters (source time, ascending start) onto the timeline and tidies them into what `setChapters`
 * accepts: snapped to the sequence's frames, sorted by timeline, the first chapter clamped to 0, and any chapter on the
 * same frame as or earlier than the previous one dropped (`dropped`, e.g. several chapters landing on the same start
 * after a cut).
 */
export function projectChapters<T>(
  rows: ReadonlyArray<{ title: string; start: number; row: T }>,
  segments: readonly AssetSegment[],
  fps: Rate,
): { kept: ProjectedChapter<T>[]; dropped: ProjectedChapter<T>[] } {
  const projected = rows
    .map((row) => {
      const { at, offTimeline } = projectSourceTime(segments, row.start);
      return { title: row.title, sourceAt: row.start, frame: Math.max(0, Math.round((at * fps.num) / fps.den)), offTimeline, row: row.row };
    })
    .sort((a, b) => a.frame - b.frame || a.sourceAt - b.sourceAt);
  const kept: ProjectedChapter<T>[] = [];
  const dropped: ProjectedChapter<T>[] = [];
  let last = -1;
  for (const [index, chapter] of projected.entries()) {
    const frame = index === 0 ? 0 : chapter.frame;
    const entry = {
      title: chapter.title,
      sourceAt: chapter.sourceAt,
      at: framesToSeconds(frame, fps),
      offTimeline: chapter.offTimeline,
      row: chapter.row,
    };
    if (frame <= last) {
      dropped.push(entry);
      continue;
    }
    kept.push(entry);
    last = frame;
  }
  return { kept, dropped };
}

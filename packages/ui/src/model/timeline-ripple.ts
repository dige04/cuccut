import type { CaptionItem, EditOperation, Id, Sequence } from '@cuccut/protocol';
import { removeChapterOperation, sequenceChapters } from './chapters.ts';
import { itemFrames } from './editor.ts';
import { dubStemOf } from './timeline-dub.ts';

/**
 * The “delete and close up” (ripple delete) on the timeline (prototype model-ripple.js `BC_RIPPLE`). Both entry points share this one:
 *
 * - Delete the selection (Delete key, the transport’s delete button, inspector, context menu, canvas toolbar): after deleting, the parts of the deleted segments where **all tracks are empty** are closed up, the content after them moves forward and the total length gets shorter. Where another track still occupies the time (for example a text clip, or an audio clip you placed yourself), a gap is left. For what counts as occupied, see `gapsAfterDelete`.
 * - Delete a segment from all tracks (context menu, ⇧Delete): the time covered by the selected clip is removed from every track; clips straddling the edge are trimmed, the part falling inside the segment is cut off, and the content after it moves forward.
 *
 * Both compile to the engine’s `removeRange` (command protocol spec §4.2, ripple delete), run from right to left, so the frames of an earlier segment are not affected by a later one. Chapter markers are not handled by `removeRange` (video format spec §3.13); as with “cut a chapter” (`cutChapterOperations` in chapters.ts), they are written separately with `upsertChapter` so that later chapters move forward. A chapter that lands inside a removed segment goes back to the segment’s start; a chapter entirely inside the segment is deleted. All times are whole frames.
 */

/** A segment on the sequence (frames, left-closed and right-open). */
export interface FrameSpan {
  start: number;
  end: number;
}

/** Audio start and end can have fractional frames: this tolerates that much error when quantized. */
const EPS = 1e-6;

/** The union of a set of intervals: sorted by start; touching or overlapping ones are merged into one; empty ones are removed. */
export function mergeSpans(spans: readonly FrameSpan[]): FrameSpan[] {
  const list = spans
    .filter((span) => span.end > span.start)
    .map((span) => ({ start: span.start, end: span.end }))
    .sort((a, b) => a.start - b.start);
  const out: FrameSpan[] = [];
  for (const span of list) {
    const last = out.at(-1);
    if (last && span.start <= last.end + EPS) last.end = Math.max(last.end, span.end);
    else out.push(span);
  }
  return out;
}

/** The parts of `spans` not covered by `cover`. */
export function uncoveredSpans(spans: readonly FrameSpan[], cover: readonly FrameSpan[]): FrameSpan[] {
  const holes = mergeSpans(cover);
  const out: FrameSpan[] = [];
  for (const span of mergeSpans(spans)) {
    let at = span.start;
    for (const hole of holes) {
      if (hole.end <= at + EPS || hole.start >= span.end - EPS) continue;
      if (hole.start > at + EPS) out.push({ start: at, end: hole.start });
      at = Math.max(at, hole.end);
    }
    if (span.end > at + EPS) out.push({ start: at, end: span.end });
  }
  return out;
}

/** Where a moment (in frames, may be fractional) lands after `spans` are removed: moments after a segment shift forward; moments inside a segment go back to the segment’s start. */
export function shiftFrame(frame: number, spans: readonly FrameSpan[]): number {
  return mergeSpans(spans)
    .reverse()
    .reduce((at, span) => (at >= span.end ? at - (span.end - span.start) : at > span.start ? span.start : at), frame);
}

/** A rounded -0 is written as 0. */
const whole = (frame: number) => frame + 0;

/** Whole-frame conversion that shrinks inward (start rounds up, end rounds down); anything less than a frame is dropped. */
function inward(spans: readonly FrameSpan[]): FrameSpan[] {
  return spans
    .map((span) => ({ start: whole(Math.ceil(span.start - EPS)), end: whole(Math.floor(span.end + EPS)) }))
    .filter((span) => span.end > span.start);
}

/** Whole-frame conversion that expands outward (start rounds down, end rounds up), so it covers every frame of the clip. */
function outward(spans: readonly FrameSpan[]): FrameSpan[] {
  return mergeSpans(spans.map((span) => ({ start: whole(Math.floor(span.start + EPS)), end: whole(Math.ceil(span.end - EPS)) })));
}

/**
 * The gaps to close up after deleting these items (whole frames): within the deleted segments, the parts that the remaining clips no longer cover on any track (prototype editor-keys.jsx `cover`).
 *
 * - A caption instance only counts as occupying the time where its sentences can still be shown (same idea as the prototype, which counts per sentence, and where the pauses between sentences also count as occupied). When there are scope instances (`scopeItemIds`), sentences are placed only under the remaining scope instances (`placeCues` in caption-cues.ts); if a scope instance is deleted, the captions in that stretch go with it. Without scope instances, the caption’s own interval counts.
 * - Background sound and vocals separated from the dub (the prototype’s “background” and “original” rows) do not count as occupied: they follow the picture, and are removed for the same segment as the video when closing up. Dub blocks count as occupied.
 * - Instances whose end follows the sequence end (`untilSequenceEnd`) do not count as occupied, since they already stretch with the total length.
 *
 * A sub-frame gap left by audio’s fractional frames at butt-joins does not count.
 */
export function gapsAfterDelete(sequence: Sequence, deletedIds: readonly Id[]): FrameSpan[] {
  const gone = new Set(deletedIds);
  const deleted: FrameSpan[] = [];
  const cover: FrameSpan[] = [];
  for (const item of sequence.items) {
    if (gone.has(item.id)) deleted.push(itemFrames(item, sequence.fps));
    else if (item.type === 'caption') cover.push(...captionCover(sequence, item, gone));
    else if (!item.untilSequenceEnd && !dubStemOf(item)) cover.push(itemFrames(item, sequence.fps));
  }
  return inward(uncoveredSpans(deleted, cover));
}

/** After `gone` is deleted, the time the caption instance still occupies: the interval left by the scope instance (clipped to the caption instance’s own interval); without a scope instance, its own interval. */
function captionCover(sequence: Sequence, item: CaptionItem, gone: ReadonlySet<Id>): FrameSpan[] {
  const own = itemFrames(item, sequence.fps);
  const scope = item.scopeItemIds ?? [];
  if (scope.length === 0) return item.untilSequenceEnd ? [] : [own];
  const byId = new Map(sequence.items.map((other) => [other.id, other]));
  return scope.flatMap((id) => {
    const scoped = byId.get(id);
    if (!scoped || gone.has(id)) return [];
    const range = itemFrames(scoped, sequence.fps);
    const span = { start: Math.max(range.start, own.start), end: Math.min(range.end, own.end) };
    return span.end > span.start ? [span] : [];
  });
}

/**
 * The segments removed by “delete this segment from all tracks” (whole frames): the time covered by the selected clips, merged into several segments. Caption instances do not count. A caption instance usually spans the whole caption track, so using its interval would delete the whole video; caption sentences follow the video (`scopeItemIds`).
 */
export function selectionSpans(sequence: Sequence, itemIds: readonly Id[]): FrameSpan[] {
  const ids = new Set(itemIds);
  return outward(
    sequence.items.filter((item) => ids.has(item.id) && item.type !== 'caption').map((item) => itemFrames(item, sequence.fps)),
  );
}

export interface RipplePlan {
  /** `removeRange` (from right to left), then chapter deletion and shifting. Empty when there are no segments to remove. */
  operations: EditOperation[];
  /** The segments actually removed (frames, in order). */
  spans: FrameSpan[];
  /** Total number of frames removed. */
  frames: number;
  /** Locked tracks or clips lie after the segments and are not being removed: the engine rejects the whole transaction (`TARGET_LOCKED`), so nothing is committed; the caller explains why. */
  locked: FrameSpan[];
}

/**
 * Removes these segments from the timeline. Each segment declares the tracks that still have clips after the segment’s start (in track order). Tracks not listed are left alone; empty tracks and tracks that end before the segment are not listed, so a locked empty track cannot block the whole transaction. A segment with nothing after it (empty space at the end) does not need to be removed: the total length is derived from the clips, so it shortens by itself.
 * `removedIds` are the clips deleted earlier in the same transaction (when closing up after a delete); they are no longer counted on the tracks.
 */
export function rippleOperations(sequence: Sequence, spans: readonly FrameSpan[], removedIds: readonly Id[] = []): RipplePlan {
  const gone = new Set(removedIds);
  const remaining = sequence.items.filter((item) => !gone.has(item.id));
  const tracks = new Map(sequence.tracks.map((track) => [track.id, track]));
  const applied: FrameSpan[] = [];
  const locked: FrameSpan[] = [];
  const ranges: EditOperation[] = [];
  for (const span of [...mergeSpans(spans)].reverse()) {
    const after = remaining.filter((item) => itemFrames(item, sequence.fps).end > span.start + EPS);
    if (!after.length) continue;
    const trackIds = [...new Set(after.map((item) => item.trackId))].sort(
      (a, b) => (tracks.get(a)?.order ?? 0) - (tracks.get(b)?.order ?? 0),
    );
    if (after.some((item) => item.locked) || trackIds.some((id) => tracks.get(id)?.locked)) {
      locked.unshift(span);
      continue;
    }
    applied.unshift(span);
    ranges.push({
      type: 'removeRange',
      sequenceId: sequence.id,
      from: { unit: 'frames', value: span.start },
      to: { unit: 'frames', value: span.end },
      trackIds,
      alignment: 'exact-frame',
    });
  }
  return {
    operations: ranges.length ? [...ranges, ...chapterOperations(sequence, applied)] : [],
    spans: applied,
    frames: applied.reduce((sum, span) => sum + span.end - span.start, 0),
    locked,
  };
}

/**
 * Chapters move forward with the content: each chapter’s start is converted with `shiftFrame`. When several chapters land on the same frame (all inside the removed segment, or one chapter sits at the segment’s start and the next one is inside the segment), only the chapter with the latest start is kept, since its content is still there while the earlier chapters are removed entirely; their markers are deleted, because the engine does not allow two chapters on the same frame.
 * Deletions are written first, and shifts are written in ascending order of their original start, so each step lands on a frame that has already been cleared (same reasoning as `cutChapterOperations`).
 */
function chapterOperations(sequence: Sequence, spans: readonly FrameSpan[]): EditOperation[] {
  const chapters = sequenceChapters(sequence).map((chapter) => ({ chapter, to: Math.round(shiftFrame(chapter.startFrame, spans)) }));
  const removed: EditOperation[] = [];
  const moved: EditOperation[] = [];
  chapters.forEach(({ chapter, to }, index) => {
    if (chapters[index + 1]?.to === to) {
      removed.push(removeChapterOperation(sequence.id, chapter));
      return;
    }
    if (to === chapter.startFrame) return;
    moved.push({
      type: 'upsertChapter',
      sequenceId: sequence.id,
      chapterId: chapter.id,
      at: { unit: 'frames', value: to },
      alignment: 'exact-frame',
    });
  });
  return [...removed, ...moved];
}


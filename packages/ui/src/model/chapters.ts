import { defineMessages, framesToSeconds, sequenceDurationFrames, type EditOperation, type Id, type Sequence } from '@cuccut/protocol';
import { zhHans } from './chapters.zh-Hans.ts';
import { zhHant } from './chapters.zh-Hant.ts';
import { ja } from './chapters.ja.ts';
import { ko } from './chapters.ko.ts';
import { es } from './chapters.es.ts';
import { fr } from './chapters.fr.ts';
import { de } from './chapters.de.ts';
import { nl } from './chapters.nl.ts';
import { ptBR } from './chapters.pt-BR.ts';
import { it } from './chapters.it.ts';
import { ru } from './chapters.ru.ts';
import { pl } from './chapters.pl.ts';
import { tr } from './chapters.tr.ts';
import { vi } from './chapters.vi.ts';

/** Copy for chapters (the English is the source of keys and types; the translations live in `chapters.zh-Hans.ts`). */
const en = {
  chapterN: (n: number) => `Chapter ${n}`,
};
export type ChaptersMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Chapters (video format spec §3.13): markers with `kind: 'chapter'` on the sequence, fixed to sequence frames and not moving with instances (when cuts are applied or restored, the engine moves them with the content,
 * §6.7). A chapter runs from its start to the next chapter's start, and the last one runs to the end of the sequence (when the marker carries its own duration, it runs for that duration; same rule as `chapterPieces` on the export page).
 *
 * This is the pure model of chapters in the editor: the segmentation of the timeline chapter strip (design draft model-timeline.js `playbackSpans`), which chapter the playhead is in, previous / next chapter
 * (`prevChapterStart` / `nextChapterStart`, 0.05 s tolerance), the frame range for dragging a start, grouping the transcript by chapter (model-chapters.js `chapterOfPara`,
 * which uses the segment midpoint), and the edit operations for adding, renaming, moving a start and deleting (`upsertChapter` / `removeChapter`, committed by frame, `exact-frame`).
 */

/** Maximum chapter title length the engine accepts (`MAX_TITLE_CHARS` in chapters.rs). */
export const CHAPTER_TITLE_MAX = 200;

/** Tolerance in seconds for previous / next chapter: within this distance of a chapter's start, the playhead counts as already on that start (design draft §12.3). */
const NEAR = 0.05;

export interface ChapterSpan {
  id: Id;
  /** Order by start time (0-based). */
  index: number;
  /** The raw name on the marker (may be blank). */
  label: string;
  /** For display: the raw name trimmed; an empty name shows “chapter N”. */
  title: string;
  startFrame: number;
  endFrame: number;
  /** Seconds. */
  start: number;
  end: number;
}

/** Chapters on the sequence, sorted by start. Chapters starting at or after the tail end of the sequence are included too, with length 0 (they cannot be drawn on the strip, but they remain on the sequence). */
export function sequenceChapters(sequence: Sequence): ChapterSpan[] {
  const total = sequenceDurationFrames(sequence);
  const markers = sequence.markers.filter((m) => m.kind === 'chapter').sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id));
  return markers.map((marker, index) => {
    const next = markers[index + 1];
    const own = marker.durationFrames ? marker.frame + marker.durationFrames : null;
    const endFrame = Math.max(marker.frame, Math.min(total, own ?? next?.frame ?? total));
    return {
      id: marker.id,
      index,
      label: marker.label,
      title: marker.label.trim() || M.chapterN(index + 1),
      startFrame: marker.frame,
      endFrame,
      start: framesToSeconds(marker.frame, sequence.fps),
      end: framesToSeconds(endFrame, sequence.fps),
    };
  });
}

/** Chapters with a length (the ones that can be drawn on the strip). */
export function visibleChapters(chapters: readonly ChapterSpan[]): ChapterSpan[] {
  return chapters.filter((c) => c.endFrame > c.startFrame);
}

/** Which chapter the playhead is in (index into `chapters`); -1 when it is in no chapter. The last chapter includes the tail-end moment. */
export function chapterAt(chapters: readonly ChapterSpan[], seconds: number): number {
  let last = -1;
  for (let i = 0; i < chapters.length; i++) if (chapters[i]!.endFrame > chapters[i]!.startFrame) last = i;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]!;
    if (c.endFrame <= c.startFrame) continue;
    if (seconds >= c.start && (seconds < c.end || (i === last && seconds <= c.end))) return i;
  }
  return -1;
}

/** Previous chapter: the nearest chapter start before the playhead (if it is less than 0.05 s from the current chapter's start, go one chapter further back); returns 0 when there is no chapter before it. */
export function prevChapterStart(chapters: readonly ChapterSpan[], seconds: number): number {
  let best = 0;
  for (const c of visibleChapters(chapters)) if (c.start < seconds - NEAR) best = c.start;
  return best;
}

/** Next chapter: the nearest chapter start after the playhead; when there is no chapter after it, goes to the end of the last chapter (the tail end). With no chapters, stays where it is. */
export function nextChapterStart(chapters: readonly ChapterSpan[], seconds: number): number {
  const shown = visibleChapters(chapters);
  for (const c of shown) if (c.start > seconds + NEAR) return c.start;
  return shown.length ? shown[shown.length - 1]!.end : seconds;
}

/** A segment on the chapter strip: either a chapter, or a gap with no chapter between chapters (before the first chapter); with no chapters, it is the whole playback progress. */
export interface BandSegment {
  key: string;
  chapter: ChapterSpan | null;
  start: number;
  end: number;
}

/** The chapter strip covers [0, duration] by time: gaps between chapters are filled in as segments without a chapter (click one to seek to that position). */
export function bandSegments(chapters: readonly ChapterSpan[], duration: number): BandSegment[] {
  if (!(duration > 0)) return [];
  const out: BandSegment[] = [];
  let at = 0;
  for (const c of visibleChapters(chapters)) {
    if (c.start > at + 1e-6) out.push({ key: `gap-${at}`, chapter: null, start: at, end: c.start });
    out.push({ key: c.id, chapter: c, start: c.start, end: Math.min(duration, c.end) });
    at = c.end;
  }
  if (duration > at + 1e-6) out.push({ key: `gap-${at}`, chapter: null, start: at, end: duration });
  return out;
}

/**
 * Which frames a chapter's start can be dragged to: later than the previous chapter's start and earlier than the next chapter's start (the engine only rejects the same frame, not jumping past a neighbour; keeping the order is done here),
 * and not past the tail end. The first chapter can go back as far as 0.
 */
export function startBounds(chapters: readonly ChapterSpan[], index: number, totalFrames: number): { min: number; max: number } {
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const min = prev ? prev.startFrame + 1 : 0;
  const max = Math.min(next ? next.startFrame - 1 : Infinity, totalFrames - 1);
  return { min, max: Math.max(min, max) };
}

/** Name pre-filled when adding a chapter: it is called “chapter N” for whatever chapter position it lands in. */
export function defaultChapterTitle(chapters: readonly ChapterSpan[], frame: number): string {
  return M.chapterN(chapters.filter((c) => c.startFrame < frame).length + 1);
}

export type AddChapterRefusal = 'exists' | 'beyond' | 'blank';

/** Whether a chapter can be added at a given frame (no name yet; only the position is checked): not allowed at or after the tail end (length 0), or where a chapter already exists at that frame; null when it can be added. */
export function addChapterRefusal(sequence: Sequence, chapters: readonly ChapterSpan[], frame: number): Exclude<AddChapterRefusal, 'blank'> | null {
  const at = Math.max(0, Math.round(frame));
  if (at >= sequenceDurationFrames(sequence)) return 'beyond';
  if (chapters.some((c) => c.startFrame === at)) return 'exists';
  return null;
}

/** Adds a chapter at a given frame. Does not apply when the name is blank or the position is refused (`addChapterRefusal`). */
export function addChapterOperation(
  sequence: Sequence,
  chapters: readonly ChapterSpan[],
  frame: number,
  title: string,
): { ok: true; operation: EditOperation } | { ok: false; reason: AddChapterRefusal } {
  const at = Math.max(0, Math.round(frame));
  const name = title.trim();
  if (!name) return { ok: false, reason: 'blank' };
  const refusal = addChapterRefusal(sequence, chapters, at);
  if (refusal) return { ok: false, reason: refusal };
  return {
    ok: true,
    operation: {
      type: 'upsertChapter',
      sequenceId: sequence.id,
      at: { unit: 'frames', value: at },
      alignment: 'exact-frame',
      title: name.slice(0, CHAPTER_TITLE_MAX),
    },
  };
}

/** Rename: trims leading and trailing whitespace; writes nothing (null) when the result is blank or the same as the current name. */
export function renameChapterOperation(sequenceId: Id, chapter: ChapterSpan, title: string): EditOperation | null {
  const name = title.trim().slice(0, CHAPTER_TITLE_MAX);
  if (!name || name === chapter.label.trim()) return null;
  return { type: 'upsertChapter', sequenceId, chapterId: chapter.id, title: name };
}

/** Moves the start to a given frame (the caller has already clamped it with `startBounds`); writes nothing (null) when it has not moved. */
export function moveChapterOperation(sequenceId: Id, chapter: ChapterSpan, frame: number): EditOperation | null {
  const at = Math.max(0, Math.round(frame));
  if (at === chapter.startFrame) return null;
  return { type: 'upsertChapter', sequenceId, chapterId: chapter.id, at: { unit: 'frames', value: at }, alignment: 'exact-frame' };
}

export function removeChapterOperation(sequenceId: Id, chapter: ChapterSpan): EditOperation {
  return { type: 'removeChapter', sequenceId, chapterId: chapter.id };
}

/** The range on the sequence (seconds) of a segment in the transcript; null when the whole segment has been cut. */
export type ParagraphSpan = { start: number; end: number } | null;

/** The range of a segment: from the start of the first word still on the timeline to the end of the last one (when a word is placed in several spots, each takes its first spot, same basis as the segment header time). */
export function paragraphSpan(words: readonly { placements: readonly { start: number; end: number }[] }[]): ParagraphSpan {
  let first: { start: number; end: number } | undefined;
  let last: { start: number; end: number } | undefined;
  for (const w of words) {
    const at = w.placements[0];
    if (!at) continue;
    first ??= at;
    last = at;
  }
  return first && last ? { start: first.start, end: Math.max(first.start, last.end) } : null;
}

/** A row after grouping the transcript by chapter: either a chapter header row (followed by `count` segments), or segment number `index`. A header row with `chapter` null is “before chapter one”. */
export type ChapterRow = { kind: 'chapter'; chapter: ChapterSpan | null; count: number } | { kind: 'paragraph'; index: number };

/** Which chapter a segment belongs to: uses the segment midpoint (a segment may cross a boundary, so the midpoint avoids counting it for both sides); -1 when it falls before the first chapter. */
function chapterOfSpan(chapters: readonly ChapterSpan[], span: { start: number; end: number }): number {
  const mid = (span.start + span.end) / 2;
  let hit = -1;
  for (let i = 0; i < chapters.length; i++) if (mid >= chapters[i]!.start) hit = i;
  return hit;
}

/**
 * Groups the transcript by chapter (design draft panels.jsx `.tsec` / `.chead`): paragraphs are walked in transcript order, and a chapter header row is inserted whenever the owning chapter changes.
 * A fully cut segment follows the previous segment (leading ones follow the next). With `withEmpty`, chapters that were skipped, or that have no paragraphs before the start or after the end, are listed too
 * (design draft: empty chapters still get a header row). This is done only when there is one transcript; when several transcripts are grouped separately, empty chapters would repeat, so they are not listed. No header rows are inserted when there are no chapters.
 */
export function chapterRows(chapters: readonly ChapterSpan[], paragraphs: readonly ParagraphSpan[], withEmpty: boolean): ChapterRow[] {
  const shown = visibleChapters(chapters);
  if (!shown.length) return paragraphs.map((_, index) => ({ kind: 'paragraph', index }));
  const own = paragraphs.map((span) => (span ? chapterOfSpan(shown, span) : null));
  // Fully cut segments follow the previous segment; the leading ones follow the next one.
  let last: number | null = null;
  const filled = own.map((c) => (c === null ? last : (last = c)));
  const first = filled.find((c) => c !== null) ?? null;
  const of = filled.map((c) => c ?? first ?? -1);

  const rows: ChapterRow[] = [];
  const used = new Set(of);
  let current: number | null = null;
  // The last chapter reached: empty chapters are filled in from it, and not filled in twice when a clip has been moved and the chapter number jumps back.
  let reached = -1;
  let head: { kind: 'chapter'; chapter: ChapterSpan | null; count: number } | null = null;
  const empty = (to: number) => {
    if (withEmpty) for (let i = reached + 1; i < to; i++) if (!used.has(i)) rows.push({ kind: 'chapter', chapter: shown[i]!, count: 0 });
    reached = Math.max(reached, to);
  };
  of.forEach((c, index) => {
    if (c !== current) {
      if (c > reached) empty(c);
      // Leading segments before chapter one get no header row; a “before chapter one” header is inserted only when the sequence later goes back before chapter one (a clip was moved).
      if (c >= 0 || current !== null) {
        head = { kind: 'chapter', chapter: c >= 0 ? shown[c]! : null, count: 0 };
        rows.push(head);
      }
      current = c;
    }
    if (head) head.count += 1;
    rows.push({ kind: 'paragraph', index });
  });
  empty(shown.length);
  return rows;
}

// ---- Per-chapter and per-segment operations in the transcript (design draft model-chapters.js `movePlan`; the ↑ ↓ on paragraph rows in panels.jsx and “this chapter…” on chapter headers) ----

/** How a segment moves to an adjacent chapter: which chapter's start moves, to which frame, and how many segments move along with it. */
export interface ParagraphMove {
  /** The chapter this segment is currently in. */
  from: ChapterSpan;
  /** The chapter moved to. */
  to: ChapterSpan;
  frame: number;
  operation: EditOperation;
  /** Number of segments that change chapter along with it (including this one). */
  moved: number;
}

/**
 * Moves segment `index` to the previous chapter (-1) or the next chapter (+1). Chapters are contiguous time ranges, so only the one boundary being crossed moves, and neighbours on the same side move along with it:
 * when moving earlier, this chapter's start moves to the start of the next segment in the same chapter; when moving later, the next chapter's start moves to the start of this segment (rounded down to a frame).
 * This chapter must keep at least one segment (emptying it would only leave a zero-length chapter, which the design draft also does not allow). Not valid (null) for segments before chapter one, fully cut segments,
 * or moves that would jump past the neighbouring chapter's start or past the tail end. Segments are assigned to chapters by midpoint, the same basis as `chapterRows`.
 */
export function moveParagraphPlan(
  sequence: Sequence,
  chapters: readonly ChapterSpan[],
  spans: readonly ParagraphSpan[],
  index: number,
  dir: -1 | 1,
): ParagraphMove | null {
  const shown = visibleChapters(chapters);
  const own = spans[index];
  if (!own || shown.length < 2) return null;
  const c = chapterOfSpan(shown, own);
  const from = shown[c];
  const to = shown[c + dir];
  if (!from || !to) return null;
  const mine = spans
    .map((span, n) => ({ span, n }))
    .filter((p): p is { span: { start: number; end: number }; n: number } => p.span !== null && chapterOfSpan(shown, p.span) === c)
    .sort((a, b) => a.span.start - b.span.start || a.n - b.n);
  const at = mine.findIndex((p) => p.n === index);
  if (at < 0) return null;
  const perSecond = sequence.fps.num / sequence.fps.den;
  const mid = (span: { start: number; end: number }) => (span.start + span.end) / 2;
  const total = sequenceDurationFrames(sequence);
  if (dir < 0) {
    const rest = mine[at + 1];
    if (!rest) return null;
    const frame = Math.floor(rest.span.start * perSecond + 1e-6);
    const bounds = startBounds(chapters, from.index, total);
    if (frame < bounds.min || frame > bounds.max || frame / perSecond <= mid(own) || frame / perSecond > mid(rest.span)) return null;
    const operation = moveChapterOperation(sequence.id, from, frame);
    return operation ? { from, to, frame, operation, moved: at + 1 } : null;
  }
  const prev = mine[at - 1];
  if (!prev) return null;
  const frame = Math.floor(own.start * perSecond + 1e-6);
  const bounds = startBounds(chapters, to.index, total);
  if (frame < bounds.min || frame > bounds.max || frame / perSecond > mid(own) || frame / perSecond <= mid(prev.span)) return null;
  const operation = moveChapterOperation(sequence.id, to, frame);
  return operation ? { from, to, frame, operation, moved: mine.length - at } : null;
}

/** Reasons removing a chapter is not valid: the chapter has no length, it is the whole video, or there are no tracks to cut. */
export type ChapterCutRefusal = 'empty' | 'whole' | 'no-tracks';

/**
 * Cuts out a chapter (one transaction): `removeRange` deletes the chapter's range (the declared tracks come from the caller, same as cutting a segment in the transcript), deletes the chapter's marker,
 * and moves the starts of later chapters earlier by this chapter's length in ascending order. The engine's `removeRange` only moves instances, not markers, so without moving them the later chapters would be out of place.
 * Chapters are moved one by one in ascending order; each target frame is empty at that step (the previous chapter has already been moved or deleted), so no two collide on the same frame.
 */
export function cutChapterOperations(
  sequence: Sequence,
  chapters: readonly ChapterSpan[],
  chapter: ChapterSpan,
  trackIds: readonly Id[],
): { ok: true; operations: EditOperation[]; frames: number } | { ok: false; reason: ChapterCutRefusal } {
  const length = chapter.endFrame - chapter.startFrame;
  if (length <= 0) return { ok: false, reason: 'empty' };
  if (chapter.startFrame <= 0 && chapter.endFrame >= sequenceDurationFrames(sequence)) return { ok: false, reason: 'whole' };
  if (!trackIds.length) return { ok: false, reason: 'no-tracks' };
  const operations: EditOperation[] = [
    {
      type: 'removeRange',
      sequenceId: sequence.id,
      from: { unit: 'frames', value: chapter.startFrame },
      to: { unit: 'frames', value: chapter.endFrame },
      trackIds: [...trackIds],
      alignment: 'exact-frame',
    },
    removeChapterOperation(sequence.id, chapter),
  ];
  for (const later of [...chapters].filter((c) => c.startFrame > chapter.startFrame).sort((a, b) => a.startFrame - b.startFrame)) {
    operations.push({
      type: 'upsertChapter',
      sequenceId: sequence.id,
      chapterId: later.id,
      at: { unit: 'frames', value: Math.max(chapter.startFrame, later.startFrame - length) },
      alignment: 'exact-frame',
    });
  }
  return { ok: true, operations, frames: length };
}

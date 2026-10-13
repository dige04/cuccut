import { defineMessages, framesToSeconds, type AssetRecord, type DocumentRecord, type ExportRange, type ExportScope, type Id, type Sequence, type VideoItem } from '@cuccut/protocol';
import { durationSeconds, itemLabel, parseSecondsInput } from './editor.ts';
import { formatClock } from './format.ts';
import { zhHans } from './export-range.zh-Hans.ts';
import { zhHant } from './export-range.zh-Hant.ts';
import { ja } from './export-range.ja.ts';
import { ko } from './export-range.ko.ts';
import { es } from './export-range.es.ts';
import { fr } from './export-range.fr.ts';
import { de } from './export-range.de.ts';
import { nl } from './export-range.nl.ts';
import { ptBR } from './export-range.pt-BR.ts';
import { it } from './export-range.it.ts';
import { ru } from './export-range.ru.ts';
import { pl } from './export-range.pl.ts';
import { tr } from './export-range.tr.ts';
import { vi } from './export-range.vi.ts';

/** Export range copy (English is the source of keys and types; translations are in `export-range.zh-Hans.ts`). */
const en = {
  modeAll: 'Whole video',
  modeChapters: 'By chapter',
  modeClips: 'By clip',
  modeCustom: 'Custom',
  chapterN: (n: number) => `Chapter ${n}`,
  clipN: (n: number) => `Clip ${n}`,
  whole: (clock: string) => `Whole video ${clock}`,
  joined: (n: number, chapters: boolean, clock: string) =>
    `${n} ${chapters ? 'chapters' : 'segments'} joined into one · ${clock}`,
  separate: (n: number, clock: string) => `${n} segments · ${clock} total`,
};
export type ExportRangeMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Export range (design draft export-range.jsx, and `spanOf` / `clampCustom` / `fmtT` in model-export.js): whole film / by chapter / by clip / custom,
 * which becomes the `range` or `ranges` of `ExportScope` (architecture design §9.13).
 *
 * - Chapters are `kind: 'chapter'` markers on the sequence (video format spec §3.13), running until the next chapter (or the marker's own duration, or the end).
 * - Clips are the enabled video instances on the timeline (the design draft's “clip = video element on the timeline”), sorted by start; disabled ones, and ones on hidden tracks, are not counted.
 * - Adjacent segments among the checked ones are joined into one; if several segments remain after joining, each is exported as its own file (`ranges`). The Runtime cannot join non-adjacent segments into one file,
 *   so the design draft's “combine into one” is greyed out in that case, with the reason stated.
 * - All times are seconds of sequence time; cut-out parts are not on the sequence to begin with, so they are not handled here.
 */

export type RangeMode = 'all' | 'chapters' | 'clips' | 'custom';

export const RANGE_MODES: readonly { key: RangeMode; label: string }[] = [
  {
    key: 'all',
    get label() {
      return M.modeAll;
    },
  },
  {
    key: 'chapters',
    get label() {
      return M.modeChapters;
    },
  },
  {
    key: 'clips',
    get label() {
      return M.modeClips;
    },
  },
  {
    key: 'custom',
    get label() {
      return M.modeCustom;
    },
  },
];

/** Minimum length in seconds for a custom range (design draft `clampCustom`). */
export const MIN_CUSTOM_SECONDS = 0.5;

/** A segment that can be checked: a chapter, or a video instance. */
export interface RangePiece {
  id: Id;
  /** The name in the list: the chapter name, or “Clip N”. */
  label: string;
  /** The clip's asset name (second line of the list); chapters have none. */
  name: string | null;
  start: number;
  end: number;
}

export interface RangeState {
  mode: RangeMode;
  chapterIds: Id[];
  clipIds: Id[];
  custom: ExportRange;
}

/** The range this export actually covers. */
export interface RangePlan {
  /** Whole film: no `range` / `ranges`. */
  whole: boolean;
  /** The joined segments (for the whole film, one segment covering the whole sequence). */
  segments: ExportRange[];
  /** Chapters or clips are selected, but no segment is checked. */
  empty: boolean;
  /** Total seconds. */
  seconds: number;
  /** A line in the summary: “whole film 3:26”, “chapter 2 · 0:45”, “3 segments · 1:10 total”, “0:45.0–1:18.0”. */
  label: string;
}

const EPS = 1e-3;

/** Chapters on the sequence: sorted by frame, running until the next chapter (or its own duration, or the end); those beyond the end are not counted. */
export function chapterPieces(sequence: Sequence): RangePiece[] {
  const total = durationSeconds(sequence);
  const markers = sequence.markers.filter((m) => m.kind === 'chapter').sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id));
  const out: RangePiece[] = [];
  markers.forEach((marker, i) => {
    const start = framesToSeconds(marker.frame, sequence.fps);
    const next = markers[i + 1];
    const own = marker.durationFrames ? framesToSeconds(marker.frame + marker.durationFrames, sequence.fps) : null;
    const end = Math.min(total, own ?? (next ? framesToSeconds(next.frame, sequence.fps) : total));
    if (end - start > EPS) out.push({ id: marker.id, label: marker.label.trim() || M.chapterN(i + 1), name: null, start, end });
  });
  return out;
}

/** Video clips on the timeline: enabled video instances whose track is not hidden; sorted by start; the name is “Clip N” plus the asset name. */
export function clipPieces(sequence: Sequence, assets: Record<Id, AssetRecord>, documents: Record<Id, DocumentRecord>): RangePiece[] {
  const hidden = new Set(sequence.tracks.filter((t) => !t.visible).map((t) => t.id));
  return sequence.items
    .filter((item): item is VideoItem => item.type === 'video' && item.enabled && !hidden.has(item.trackId))
    .map((item) => ({
      id: item.id,
      name: itemLabel(item, assets, documents),
      start: framesToSeconds(item.span.fromFrame, sequence.fps),
      end: framesToSeconds(item.span.fromFrame + item.span.durationFrames, sequence.fps),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((p, i) => ({ ...p, label: M.clipN(i + 1) }));
}

/** Start and end are clamped to `[0, total length]`, at least `MIN_CUSTOM_SECONDS` long (if the film itself is shorter, it is the whole film). */
export function clampCustom(start: number, end: number, duration: number): ExportRange {
  const total = Math.max(0, duration);
  if (total <= MIN_CUSTOM_SECONDS) return { start: 0, end: total };
  const s = Math.min(Math.max(0, Number.isFinite(start) ? start : 0), total - MIN_CUSTOM_SECONDS);
  const e = Math.max(Math.min(total, Number.isFinite(end) ? end : total), s + MIN_CUSTOM_SECONDS);
  return { start: s, end: e };
}

/** The checked segments are sorted by start; adjacent (or overlapping) ones are joined into one. */
export function mergeSegments(pieces: readonly ExportRange[]): ExportRange[] {
  const sorted = [...pieces].sort((a, b) => a.start - b.start);
  const out: ExportRange[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p.start <= last.end + EPS) last.end = Math.max(last.end, p.end);
    else out.push({ start: p.start, end: p.end });
  }
  return out;
}

/** Times in the list and the trim bar: “1:05.3” (design draft `fmtT`, truncated down to 0.1 seconds). */
export function formatRangeTime(seconds: number): string {
  return formatClock(seconds, { tenths: true });
}

/** Parses timecode input: “65”, “65.3”, “1:05.3”; null when invalid. */
export function parseRangeTime(text: string): number | null {
  const parsed = parseSecondsInput(text);
  if (parsed === null) return null;
  const value = Number(parsed);
  return Number.isFinite(value) ? value : null;
}

const total = (segments: readonly ExportRange[]) => segments.reduce((sum, s) => sum + (s.end - s.start), 0);

/** Current selection → the range for this export. */
export function rangePlan(state: RangeState, chapters: readonly RangePiece[], clips: readonly RangePiece[], duration: number): RangePlan {
  if (state.mode === 'all') {
    return { whole: true, segments: [{ start: 0, end: duration }], empty: duration <= 0, seconds: duration, label: M.whole(formatClock(duration)) };
  }
  if (state.mode === 'custom') {
    const c = clampCustom(state.custom.start, state.custom.end, duration);
    return {
      whole: false,
      segments: [c],
      empty: c.end - c.start <= 0,
      seconds: c.end - c.start,
      label: `${formatRangeTime(c.start)}–${formatRangeTime(c.end)}`,
    };
  }
  const pieces = state.mode === 'chapters' ? chapters : clips;
  const ids = new Set(state.mode === 'chapters' ? state.chapterIds : state.clipIds);
  const picked = pieces.filter((p) => ids.has(p.id));
  const segments = mergeSegments(picked);
  const seconds = total(segments);
  if (!segments.length) return { whole: false, segments: [], empty: true, seconds: 0, label: '' };
  const label =
    picked.length === 1
      ? `${picked[0]!.label} · ${formatClock(seconds)}`
      : segments.length === 1
        ? M.joined(picked.length, state.mode === 'chapters', formatClock(seconds))
        : M.separate(segments.length, formatClock(seconds));
  return { whole: false, segments, empty: false, seconds, label };
}

/** Range → `ExportScope`: the whole film has none; one segment is `range`; several segments are `ranges` (each exported as its own file). */
export function rangeScope(plan: RangePlan): Pick<ExportScope, 'range' | 'ranges'> {
  if (plan.whole || plan.empty) return {};
  if (plan.segments.length === 1) return { range: { ...plan.segments[0]! } };
  return { ranges: plan.segments.map((s) => ({ ...s })) };
}

/** The segment the playhead is in (chapters default to checking the current chapter; clips default to checking the selected one, or the one under the playhead if none is selected). */
export function pieceAt(pieces: readonly RangePiece[], seconds: number): RangePiece | null {
  return pieces.find((p) => seconds >= p.start - EPS && seconds < p.end - EPS) ?? null;
}

/** The range when the popover opens: the whole film; for chapters and clips, the segment under the playhead (or the selected one) is pre-checked; custom starts from the whole film. */
export function initialRange(chapters: readonly RangePiece[], clips: readonly RangePiece[], playhead: number, selection: readonly Id[], duration: number): RangeState {
  const chapter = pieceAt(chapters, playhead);
  const selected = clips.find((c) => selection.includes(c.id)) ?? pieceAt(clips, playhead);
  return {
    mode: 'all',
    chapterIds: chapter ? [chapter.id] : [],
    clipIds: selected ? [selected.id] : [],
    custom: clampCustom(0, duration, duration),
  };
}

/** Check / uncheck a segment. */
export function toggleId(ids: readonly Id[], id: Id): Id[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

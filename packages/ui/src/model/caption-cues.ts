import type { CaptionItem, Sequence, SequenceItem } from '@cuccut/protocol';
import type { CaptionTrack } from '../render/captions.ts';
import { itemFrames } from './editor.ts';

/** A subtitle line projected onto the sequence (seconds). When the same line appears twice through two applying instances, `key` differs and `cueId` is the same. */
export interface PlacedCue {
  key: string;
  cueId: string;
  start: number;
  end: number;
  text: string;
}

/** The part of `interval` left after subtracting the ranges in `taken` (in order). */
function subtract(interval: [number, number], taken: ReadonlyArray<[number, number]>): Array<[number, number]> {
  let parts = [interval];
  for (const [a, b] of taken) {
    const next: Array<[number, number]> = [];
    for (const [x, y] of parts) {
      if (b <= x || a >= y) {
        next.push([x, y]);
        continue;
      }
      if (a > x) next.push([x, a]);
      if (b < y) next.push([b, y]);
    }
    parts = next;
  }
  return parts;
}

/**
 * Where a caption instance's sentences sit on the sequence (for the timeline). When there are applying instances, they appear only in the ranges those instances cover (consistent with render-graph):
 * when the document is on the source-asset clock, it is projected through the instance's time mapping and shows under whichever instance's source range it falls in; cut-away parts do not appear;
 * when no applying instance is found at all (all deleted), nothing appears. Without applying instances, document time is sequence time.
 * Applying instances each take the ranges no other instance has taken, in the order listed (`caption-items` in text_plan.rs), so linked audio and video do not produce two copies.
 * Results are sorted by start time and trimmed to the caption instance's own range.
 */
export function placeCues(item: CaptionItem, sequence: Sequence, track: CaptionTrack): PlacedCue[] {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const spanStart = item.span.fromFrame / perSecond;
  const spanEnd = (item.span.fromFrame + item.span.durationFrames) / perSecond;
  const cues = [...track.cues].filter((cue) => cue.text.trim() !== '').sort((a, b) => a.start - b.start);
  const placed: PlacedCue[] = [];
  const seen = new Map<string, number>();
  const push = (prefix: string, cueId: string, start: number, end: number, text: string, from: number, to: number) => {
    const a = Math.max(start, from);
    const b = Math.min(end, to);
    if (!(b > a)) return;
    const base = `${prefix}${cueId}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    placed.push({ key: n === 1 ? base : `${base}#${n}`, cueId, start: a, end: b, text });
  };

  const byId = new Map(sequence.items.map((other) => [other.id, other]));
  const scopeIds = item.scopeItemIds ?? [];
  if (scopeIds.length === 0) {
    for (const cue of cues) push('', cue.id, cue.start, cue.end, cue.text, spanStart, spanEnd);
    return placed;
  }
  const taken: Array<[number, number]> = [];
  for (const id of scopeIds) {
    const scope = byId.get(id);
    if (!scope || (scope.type !== 'video' && scope.type !== 'audio' && scope.type !== 'composition')) continue;
    if (scope.timeMap.kind !== 'linear') continue;
    const range = itemFrames(scope, sequence.fps);
    const seqStart = range.start / perSecond;
    const seqEnd = range.end / perSecond;
    const sourceIn = Number(scope.timeMap.sourceIn.ticks) / scope.timeMap.sourceIn.timescale;
    const rate = scope.timeMap.rate.num / scope.timeMap.rate.den;
    if (!(rate > 0)) continue;
    const from = Math.max(seqStart, spanStart);
    const to = Math.min(seqEnd, spanEnd);
    if (!(to > from)) continue;
    const windows = subtract([from, to], taken);
    taken.push([from, to]);
    for (const [a, b] of windows) {
      for (const cue of cues) {
        if (track.clock === 'sequence') push(`${scope.id}:`, cue.id, cue.start, cue.end, cue.text, a, b);
        else push(`${scope.id}:`, cue.id, seqStart + (cue.start - sourceIn) / rate, seqStart + (cue.end - sourceIn) / rate, cue.text, a, b);
      }
    }
  }
  return placed.sort((a, b) => a.start - b.start);
}

const placedCache = new WeakMap<CaptionTrack, WeakMap<Sequence, WeakMap<CaptionItem, readonly PlacedCue[]>>>();

/**
 * The cached version of `placeCues`: keyed by the caption document (`readCaptions` caches by body, so the same version is the same object), the sequence version and the instances, kept outside the component,
 * so that the caption panel and the timeline share it, and remounting the panel when switching no longer re-places everything. All three are immutable snapshots; if any one changes, it is a new result.
 */
export function placedCues(item: CaptionItem, sequence: Sequence, track: CaptionTrack): readonly PlacedCue[] {
  let bySequence = placedCache.get(track);
  if (!bySequence) placedCache.set(track, (bySequence = new WeakMap()));
  let byItem = bySequence.get(sequence);
  if (!byItem) bySequence.set(sequence, (byItem = new WeakMap()));
  let placed = byItem.get(item);
  if (!placed) byItem.set(item, (placed = placeCues(item, sequence, track)));
  return placed;
}

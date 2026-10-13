import type { Id, Sequence } from '@cuccut/protocol';
import { itemFrames } from './editor.ts';
import { rectsCross, type Rect } from './stage-pose.ts';

/**
 * Marquee selection on the timeline (design mockup timeline.jsx `beginMarquee`, product design §7): dragging a rectangle over empty space in the track area selects every instance it touches, across tracks.
 * The hit test is the same as the stage's (`rectsCross`: intersecting counts, touching edges do not), but the box is not measured from the DOM; it is computed from time span × row. An instance's box on the timeline is its time span and its row (the full row height, as in the design mockup). Locked tracks and locked instances are not selected.
 * Subtitle instances are not selected: a subtitle instance usually fills the whole subtitle track, so a box clipping one corner would select the whole layer and Delete would remove the whole layer; the design mockup boxes individual subtitle lines and never selects the whole subtitle track.
 * Subtitles that follow the video (`scopeItemIds`) are deleted and closed up together with it (timeline-ripple.ts). To select a whole layer, click its subtitle row.
 *
 * Coordinates are all in the timeline's content coordinate system (the layer that scrolls: the left side includes the row-header column, and the top includes the ruler), so they do not drift when scrolling or zooming.
 */

/** Vertical position of a row in the content coordinate system. */
export interface MarqueeLane {
  trackId: Id;
  top: number;
  height: number;
}

/** Horizontal conversion: content coordinate x = `head + pad + seconds × pxPerSecond`. */
export interface MarqueeLayout {
  head: number;
  pad: number;
  pxPerSecond: number;
  lanes: readonly MarqueeLane[];
}

/** An instance's box in the content coordinate system; null when its track is not drawn. */
export function itemBox(sequence: Sequence, itemId: Id, layout: MarqueeLayout): Rect | null {
  const item = sequence.items.find((candidate) => candidate.id === itemId);
  const lane = item ? layout.lanes.find((l) => l.trackId === item.trackId) : undefined;
  if (!item || !lane) return null;
  const perSecond = sequence.fps.num / sequence.fps.den;
  const range = itemFrames(item, sequence.fps);
  const x0 = layout.head + layout.pad + (range.start / perSecond) * layout.pxPerSecond;
  const x1 = layout.head + layout.pad + (range.end / perSecond) * layout.pxPerSecond;
  return { x: x0, y: lane.top, w: Math.max(0, x1 - x0), h: lane.height };
}

/** Instances caught by the marquee (in sequence order): locked tracks, locked instances and subtitle instances are skipped. */
export function marqueeItems(sequence: Sequence, layout: MarqueeLayout, rect: Rect): Id[] {
  const locked = new Set(sequence.tracks.filter((t) => t.locked).map((t) => t.id));
  const hits: Id[] = [];
  for (const item of sequence.items) {
    if (item.locked || locked.has(item.trackId) || item.type === 'caption') continue;
    const box = itemBox(sequence, item.id, layout);
    if (box && box.w > 0 && rectsCross(box, rect)) hits.push(item.id);
  }
  return hits;
}

/** The selection after release: holding ⇧ / ⌘ merges into the existing selection (deduplicated, not toggled); otherwise it is replaced by what was caught. */
export function marqueeSelection(current: readonly Id[], hits: readonly Id[], additive: boolean): Id[] {
  return additive ? [...new Set([...current, ...hits])] : [...hits];
}

import type { Id, Sequence, SequenceItem } from '@cuccut/protocol';
import type { CaptionHit } from '../render/render-planner.ts';
import type { VisualLayer } from '../render/frame-plan.ts';
import { poseContains, rectsCross, type Point, type Pose, type Rect } from './stage-pose.ts';

/**
 * Stage hit testing (prototype stage-marquee.jsx, legacy stage-hit.logic): which item a point lands on, and which items a marquee selection encloses.
 *
 * Point picking is computed from the frame plan: each layer's `matrix` maps the unit square to canvas pixels, and inverting it tells whether the point is inside that layer. From top to bottom in composition order, the first item covering the point wins. Subtitles use line boxes from the same source as the rasterizer, and the whole canvas cannot be used as the hit area. Invisible things cannot be clicked, so only layers in this frame's plan are considered.
 */

type Matrix = VisualLayer['matrix'];

/** Maps a canvas point back to the layer's unit square; null when the matrix is degenerate (collapsed to a line). */
export function unitPoint(matrix: Matrix, p: Point): Point | null {
  const [a, b, c, d, e, f] = matrix;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const x = p.x - e;
  const y = p.y - f;
  return { x: (d * x - c * y) / det, y: (-b * x + a * y) / det };
}

/** Whether this layer covers the point (points on the edge of the unit square count). */
export function layerContains(layer: VisualLayer, p: Point): boolean {
  const u = unitPoint(layer.matrix, p);
  return !!u && u.x >= 0 && u.x <= 1 && u.y >= 0 && u.y <= 1;
}

export interface HitOptions {
  /** This item does not take part in point picking (for example, an unselected main video). */
  skip?: (itemId: Id) => boolean;
  captionHits?: readonly CaptionHit[];
  /**
   * Layout box of the selected items: the whole selection box counts as it (for a “Fit” video, the picture only fills part of the box, and the black bars inside the box should also be draggable).
   */
  boxes?: ReadonlyMap<Id, Pose>;
  /** Whether the point is inside the layout box. */
  contains?: (pose: Pose, p: Point) => boolean;
}

/** Point picking: from top to bottom in composition order, finds the first instance covering the point; subtitles only count rendered line boxes. */
export function hitAt(layers: readonly VisualLayer[], p: Point, options: HitOptions = {}): Id | null {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!;
    if (layer.kind === 'caption') {
      const hit = captionHitAt(options.captionHits ?? [], p, layer.itemId, options.skip);
      if (hit) return hit.itemId;
      continue;
    }
    if (options.skip?.(layer.itemId)) continue;
    if (layerContains(layer, p)) return layer.itemId;
    const box = options.boxes?.get(layer.itemId);
    if (box && options.contains?.(box, p)) return layer.itemId;
  }
  return null;
}

/** Within the same subtitle group, searches from the last drawn line backwards; without real geometry, it does not take priority over the video underneath. */
export function captionHitAt(hits: readonly CaptionHit[], p: Point, layerId?: Id, skip?: (id: Id) => boolean): CaptionHit | null {
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i]!;
    if (layerId && hit.layerId !== layerId) continue;
    if (!skip?.(hit.itemId) && hit.w > 0 && hit.h > 0 && poseContains(hit, p)) return hit;
  }
  return null;
}

/** Instances on this frame (excluding subtitles), from bottom to top, without duplicates. */
export function visibleItems(layers: readonly VisualLayer[]): Id[] {
  const out: Id[] = [];
  for (const layer of layers) if (layer.kind !== 'caption' && !out.includes(layer.itemId)) out.push(layer.itemId);
  return out;
}

/**
 * Main video: the video instance on the bottom picture track, or a video whose role is marked `a-roll`. It fills the whole frame, so any box or any click on empty space would hit it; therefore it does not take part in point picking, marquee selection or snapping (prototype stage-marquee.jsx §6).
 */
export function isMainVideo(item: SequenceItem, sequence: Sequence): boolean {
  if (item.type !== 'video') return false;
  if (item.role === 'a-roll') return true;
  let bottom: { id: Id; order: number } | null = null;
  for (const track of sequence.tracks) {
    if (track.kind === 'visual' && (!bottom || track.order < bottom.order)) bottom = track;
  }
  return !!bottom && item.trackId === bottom.id;
}

/** Marquee hit: the bounding box intersects the marquee (edges that only touch do not count); IDs are returned in the order passed in. */
export function marqueeHits(candidates: readonly { id: Id; rect: Rect }[], marquee: Rect): Id[] {
  return candidates.filter((c) => rectsCross(c.rect, marquee)).map((c) => c.id);
}

/**
 * Marquee result: when appending, the original selection plus what this marquee hit. When both subtitles and picture elements are inside, only the elements are kept: it is common to box a sticker and also catch the subtitles underneath, while someone boxing subtitles only boxes subtitles (`marqueePick` in the prototype model-select.js). When only subtitles are boxed, both bilingual lines under the same style are selected, so dragging moves them as a group.
 */
export function marqueeSelection(base: readonly Id[], hits: readonly Id[], isCaption: (id: Id) => boolean): Id[] {
  const all = [...new Set([...base, ...hits])];
  return all.some((id) => !isCaption(id)) ? all.filter((id) => !isCaption(id)) : all;
}

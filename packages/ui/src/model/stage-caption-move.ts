import { clamp, isObject, num, type Json, type LineKind } from '../render/text-style.ts';
import type { CaptionHit } from '../render/render-planner.ts';
import { LINE_STYLE_KEY } from './caption-lines.ts';
import { round1 } from './geometry-panel.ts';
import type { Modifiers, StageEnv } from './stage-gesture.ts';
import { GUIDE_TOL, LIMITS, SNAP_PX, aabbOf, boundsOf, boxRect, dragMove, guidesFor, type Guide, type Limits, type Point, type Pose, type Rect } from './stage-pose.ts';

/**
 * Dragging subtitles on the frame (the subtitle SelectionBox in the prototype stage.jsx): can be dragged in all four directions. What is written is the horizontal center `x` and the anchor line `y` on the root of the subtitle style (percentages of the frame width and height). Subtitles sharing the same style move together. These are the same pair of values as “Horizontal position” and “Top” under “Position” in the properties panel.
 *
 * With bilingual captions (both the original and the translation lines under one style), only one line is selected and dragged: its line override in `origStyle` / `transStyle` gets `x` and `y` written, so it leaves the stack of the two lines and is positioned on its own, while the other line stays in the stack and moves as little as possible (`movedLineStyle`, `restackedRootY`). Only when both lines are selected do they move as a group.
 *
 * Snapping is computed from the real line boxes measured by the renderer (`CaptionHit`), not from the anchor: the anchor line may be the top edge, the midline or the bottom edge of the block (`verticalAlign`), and treating it as the center would be off by half to a full block height. The box is translated by the same amount as `x` and `y`, so the displacement is folded directly into the increments of both. Center snapping, 6px multi-line snapping, and ⌥ to turn off snapping work the same as for element moves (`dragMove`). The left and right limits are computed from the rendered text: the edges of the box do not leave the frame (the prototype only clamps the center, so an 80%-wide caption box dragged to the edge would be partly cropped).
 */

/** Allowed range of the anchor line (percentage of frame height; the y of `TEXT_LIMITS` in the prototype). */
export const CAPTION_Y_LIMITS = LIMITS.y;
/** Horizontal center and anchor line used when the root style does not set `x` / `y` (same values as the renderer). */
export const CAPTION_X = 50;
export const CAPTION_Y = 86;

/** One subtitle drag: the bounding boxes of the dragged lines as rendered at the start (canvas pixels), the horizontal center and anchor line at the start (the root style's for a whole group, that line's own for a single line), and the pointer-down point. */
export interface CaptionMove {
  box: Rect;
  x0: number;
  y0: number;
  p0: Point;
}

export interface CaptionMoveFrame {
  /** New horizontal center and anchor line (one decimal place). */
  x: number;
  y: number;
  /** How many canvas pixels the box has moved since the start (computed from the rounded `x` and `y`, used to draw the selection box). */
  dx: number;
  dy: number;
  guides: Guide[];
}

/** Bounding box of these lines; null when there are no lines. */
export function captionBox(hits: readonly CaptionHit[]): Rect | null {
  return boundsOf(hits.map((hit) => aabbOf(hit)));
}

/** One decimal place, never beyond [lo, hi]: when at an edge, rounding goes inward, so the text does not move half a pixel out of frame because of rounding. */
function within(value: number, lo: number, hi: number): number {
  const r = round1(value);
  return r > hi ? Math.floor(hi * 10) / 10 : r < lo ? Math.ceil(lo * 10) / 10 : r;
}

/** Pointer is at `p` (canvas pixels): computes the horizontal center and anchor line for this moment from the start state. ⌥ turns off snapping. */
export function stepCaptionMove(move: CaptionMove, p: Point, mods: Modifiers, env: StageEnv): CaptionMoveFrame {
  const { canvas, others, pxScale } = env;
  const { box, x0, y0 } = move;
  const { width: W, height: H } = canvas;
  if (!(W > 0) || !(H > 0)) return { x: x0, y: y0, dx: 0, dy: 0, guides: [] };
  const start: Pose = { cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: box.w, h: box.h, rotation: 0 };
  const toPct = (px: number, total: number) => (px * 100) / total;
  const toPx = (pct: number, total: number) => (pct * total) / 100;
  const [lo, hi] = CAPTION_Y_LIMITS;
  // Horizontal: the box's edges are clamped inside the canvas; if the box is wider than the canvas, it is pinned at the start position. Vertical: the anchor line is clamped to 4–96%.
  // If it is already outside the limits at the start, the limits are widened to contain the start position, so it does not jump on the first move (same as moveLimits).
  const half = box.w / 2;
  const limits: Limits = {
    x: box.w >= W ? [start.cx, start.cx] : [Math.min(half, start.cx), Math.max(W - half, start.cx)],
    y: [start.cy + Math.min(0, toPx(lo - y0, H)), start.cy + Math.max(0, toPx(hi - y0, H))],
  };
  const snap = mods.alt ? null : { canvas, others, threshold: SNAP_PX * pxScale };
  const moved = dragMove(start, p.x - move.p0.x, p.y - move.p0.y, limits, snap);
  // Multi-line snapping is applied after the limit clamping. Horizontally, the result is converted to percentages according to the limits and clamped once more, so edges of other objects cannot pull it out of frame. An axis that did not move is left as it is, without rounding it along the way.
  const x =
    moved.cx === start.cx
      ? x0
      : within(x0 + toPct(moved.cx - start.cx, W), x0 + toPct(limits.x[0] - start.cx, W), x0 + toPct(limits.x[1] - start.cx, W));
  const y = moved.cy === start.cy ? y0 : round1(clamp(y0 + toPct(moved.cy - start.cy, H), 0, 100));
  const dx = toPx(x - x0, W);
  const dy = toPx(y - y0, H);
  const guides = guidesFor(boxRect({ ...start, cx: start.cx + dx, cy: start.cy + dy }), canvas, others, GUIDE_TOL * pxScale);
  return { x, y, dx, dy, guides };
}

/**
 * The root style gets the new horizontal center and anchor line (unchanged values are not written, so defaults do not get saved into the document). In bilingual captions, a line that has its own position (both `x` and `y` in its override, so the renderer treats it as having left the stack and positions it separately) is translated by the same amount, so the whole group moves together.
 */
export function movedCaptionStyle(root: Json, to: { x: number; y: number }): Json {
  const sx = to.x - num(root.x, CAPTION_X);
  const sy = to.y - num(root.y, CAPTION_Y);
  const next: Json = { ...root };
  if (sx) next.x = to.x;
  if (sy) next.y = to.y;
  const shift = (value: number, by: number) => (by ? round1(clamp(value + by, 0, 100)) : value);
  for (const key of Object.values(LINE_STYLE_KEY)) {
    const line = root[key];
    if (isObject(line) && Number.isFinite(line.x) && Number.isFinite(line.y))
      next[key] = { ...line, x: shift(line.x as number, sx), y: shift(line.y as number, sy) };
  }
  return next;
}

/**
 * Starting point for dragging a single line in bilingual captions. A line already positioned on its own (both `x` and `y` in its override) starts from the override's values; a line still in the stack is measured from its rendered box: `x` is the box's horizontal center (the root style's `x` is not read, since the renderer ignores it under centered caption styling), and `y` is the box's vertical center. Paired with `verticalAlign: 'center'`, which is written when the line leaves the stack, this puts it back in exactly the same place (a padded box wraps the glyphs symmetrically top and bottom, so the center does not change with padding).
 */
export function lineMoveStart(root: Json, kind: LineKind, box: Rect, canvas: { width: number; height: number }): { x0: number; y0: number; detached: boolean } {
  const line = root[LINE_STYLE_KEY[kind]];
  if (isObject(line) && Number.isFinite(line.x) && Number.isFinite(line.y)) return { x0: line.x as number, y0: line.y as number, detached: true };
  return {
    x0: round1(((box.x + box.w / 2) * 100) / canvas.width),
    y0: round1(((box.y + box.h / 2) * 100) / canvas.height),
    detached: false,
  };
}

/**
 * When a single line is dragged in bilingual captions and that line leaves the stack for the first time, the other line that stays in the stack must not jump: when only it remains, the renderer re-lays it out from the root style's anchor (`place_lines`). When the block anchor is center (or unset), its glyph center sits exactly on the anchor line, so replacing the root style's `y` with its current center keeps it where it is. `rest` is the other line's currently rendered box: if it was not rendered, if there is more than one item, or if it is already positioned on its own, it does not need to move (returns null). When the block anchor is top / bottom, converting back requires the padding, which is not in the sidecar, so this also returns null and the other line is re-laid out by the renderer's rules.
 */
export function restackedRootY(root: Json, kind: LineKind, rest: readonly CaptionHit[], canvas: { width: number; height: number }): number | null {
  if (root.verticalAlign === 'top' || root.verticalAlign === 'bottom') return null;
  const other = root[LINE_STYLE_KEY[kind === 'original' ? 'translation' : 'original']];
  if (isObject(other) && Number.isFinite(other.x) && Number.isFinite(other.y)) return null;
  const box = captionBox(rest);
  if (!box || new Set(rest.map((hit) => hit.itemId)).size !== 1 || !(canvas.height > 0)) return null;
  return round1(((box.y + box.h / 2) * 100) / canvas.height);
}

/**
 * Root style after dragging a single line in bilingual captions: that line's override gets the new `x` and `y` (the renderer, see `line_position_override`, only takes the line out of the stack when both are present). The first time the line leaves the stack, `verticalAlign: 'center'` is also written: `y` is measured from the box's center, and the original top/bottom alignment would need the padding to convert back, which the sidecar does not have. A line that is already positioned on its own keeps its own alignment. The other line stays in the stack and is re-laid out from the root style's anchor (since it is now the only one). `anchorY` is the root anchor line given by `restackedRootY` (the other line stays where it is); null leaves the root style unchanged. If “return to stack” is implemented later, `verticalAlign` must be removed together with `x` and `y`, otherwise the leftover center would override the stack's seam alignment.
 */
export function movedLineStyle(root: Json, kind: LineKind, to: { x: number; y: number }, detached: boolean, anchorY: number | null = null): Json {
  const key = LINE_STYLE_KEY[kind];
  const line = isObject(root[key]) ? root[key] : {};
  const next: Json = { ...root, [key]: { ...line, x: to.x, y: to.y, ...(detached ? {} : { verticalAlign: 'center' }) } };
  if (anchorY !== null && anchorY !== num(root.y, CAPTION_Y)) next.y = anchorY;
  return next;
}

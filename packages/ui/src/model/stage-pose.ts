import { stageBox, stagePlace, type StageAsset, type StageItem } from '@cuccut/editor-wasm';
import { isVisualItem, type AssetRecord, type Crop, type Id, type Place, type SequenceItem, type VideoItem, type VisualItem } from '@cuccut/protocol';
import { round1, wrapRotation } from './geometry-panel.ts';

/**
 * Geometry for placing instances on the stage (following the prototype model-pose.js and model-select.js): the capability table and handle sets, move / edge resize / scale / rotate, snapping and guide lines, multi-select group translate and scale, and arrow-key nudging.
 *
 * All coordinates are sequence canvas pixels, with the origin at top-left. Boxes are represented by their center (`Pose`). What is saved to disk is the element model's `place` (frame percentages: box center and box width; height is derived from the kind, and `scaleY` multiplies the height once more). Converting between box and `place` happens only in `poseOf` / `placeFields`, and both call the single copy of the Rust frame plan (`item_box` / `place_from_box` in `render-graph`, via `editor-wasm`). What remains here is only the gesture itself: handles, snapping, limits, multi-select, and keyboard. The prototype's thresholds are measured in frame pixels (6px snapping, 2px dead zone, ...); the caller converts them to canvas pixels using the display scale before passing them in.
 */

export interface Point {
  x: number;
  y: number;
}
/** Axis-aligned box in top-left coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** An instance's box: center, unrotated width and height, and angle around the center (degrees, clockwise). */
export interface Pose {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
}
export interface CanvasSize {
  width: number;
  height: number;
}
/** Asset table for videos: a media instance's box height is derived from the source's display aspect ratio, so it must be looked up. */
export type Assets = Readonly<Record<Id, AssetRecord>>;

/** Snapping threshold (frame pixels). */
export const SNAP_PX = 6;
/** Center snapping radius: percentage of canvas width / height. */
export const CENTER_SNAP = 1.5;
/** Rotation grid (degrees). */
export const ROT_STEP = 15;
/** Start dead zone (frame pixels): movement within this still counts as a click. */
export const DEAD_ZONE = 2;
/** Criterion for a guide line coinciding (frame pixels). */
export const GUIDE_TOL = 1;
/** Scale factor range for one scale gesture. */
export const SCALE_MIN = 0.1;
export const SCALE_MAX = 5;
/** Minimum box width: 2% of canvas width and at least 10 pixels; maximum 400% of the canvas (filling the canvas must be possible to extend beyond the frame). */
export const MIN_W = 2;
export const MIN_PX = 10;
export const MAX_SIZE = 400;
/** Criterion for degrading the handles (frame pixels): if any side is less than 24, switch to the set with fewer handles. */
export const SMALL_SET = 24;
/** Criterion for the smaller handle style (frame pixels, measured differently from the one above). */
export const SMALL_STYLE_W = 50;
export const SMALL_STYLE_H = 40;
/** Videos may be mostly outside the frame, keeping only a visible strip of min(box side, 10%). */
export const KEEP_VISIBLE = 10;
/** Center limits for non-video items (canvas percentages). */
export const LIMITS = { x: [3, 97], y: [4, 96] } as const;
/** Drag-start threshold for marquee selection (frame pixels). */
export const MARQUEE_MIN = 4;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rad = (deg: number) => (deg * Math.PI) / 180;

// ---- Capability table and handles ----

export type Handle = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
/**
 * Three resize tiers (`resize` in the prototype CAPS):
 * - `free`: eight handles, free aspect ratio (corners still lock the ratio by default; ⇧ unlocks): videos, compositions, and generated elements whose box height is set by the frame;
 * - `text`: left and right change the box width (font size unchanged, text re-wraps), plus the corners scale uniformly together with the font size: text;
 * - `corner`: only four corners, always ratio-locked: images, shapes, stickers, whiteboards.
 */
export type ResizeKind = 'free' | 'text' | 'corner';

/** Instances that can be placed on the stage: frame instances that have a `place`. */
export type PlacedItem = VisualItem;

export function isPlaced(item: SequenceItem): item is PlacedItem {
  return isVisualItem(item);
}

export function resizeKindOf(item: PlacedItem): ResizeKind {
  if (item.type === 'text') return 'text';
  if (item.type === 'image' || item.type === 'shape' || item.type === 'sticker' || item.type === 'whiteboard') return 'corner';
  return 'free';
}

const HANDLE_SETS: Record<ResizeKind, { big: Handle[]; small: Handle[] }> = {
  free: { big: ['n', 'w', 's', 'e', 'nw', 'ne', 'sw', 'se'], small: ['nw', 's', 'e'] },
  text: { big: ['w', 'e', 'nw', 'ne', 'sw', 'se'], small: ['se', 'e'] },
  corner: { big: ['nw', 'ne', 'sw', 'se'], small: ['nw'] },
};

/** Which handles this tier shows right now; `w` / `h` are the unrotated box size (frame pixels); if either side is < 24, it degrades. */
export function handlesFor(kind: ResizeKind, w: number, h: number): Handle[] {
  const set = HANDLE_SETS[kind];
  return w < SMALL_SET || h < SMALL_SET ? set.small : set.big;
}

export const smallHandles = (w: number, h: number) => w < SMALL_STYLE_W || h < SMALL_STYLE_H;
export const isCorner = (handle: Handle) => handle.length === 2;

/** Whether the corners scale uniformly (text with its font size, images and shapes) or change width and height (the free tier). */
export function cornerScales(kind: ResizeKind, handle: Handle): boolean {
  return isCorner(handle) && kind !== 'free';
}

const CURSOR_ORDER: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const CURSOR_STEP = [0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 0];

/** The cursor rotates with the rotation angle: looked up in 30° steps (`resizeCursor` in the prototype; angles near 45° fall into the same step). */
export function resizeCursor(handle: Handle, rotation: number): string {
  const a = wrapRotation(rotation);
  const n = a < 0 ? a + 360 : a;
  const step = CURSOR_STEP[Math.floor(n / 30)] ?? 0;
  return `${CURSOR_ORDER[(CURSOR_ORDER.indexOf(handle) + step) % 8]}-resize`;
}

// ---- place ↔ box ----

/** The fields needed for pushing boxes (`editor-wasm` only reads these): kind, `place`, `mode`, shape and sticker properties, and crop. */
function stageItem(item: PlacedItem): StageItem {
  const out: StageItem = { type: item.type, place: item.place };
  if ('mode' in item && item.mode !== undefined) out.mode = item.mode;
  if (item.type === 'shape') out.shape = item.shape;
  if (item.type === 'sticker') out.sticker = item.sticker;
  if ((item.type === 'video' || item.type === 'image') && item.crop) out.crop = item.crop;
  return out;
}

/** The part of the referenced asset that box pushing needs (compositions are pre-rendered): the kind and the video info of the referenced version; omitted when the asset table does not have it. */
function stageAsset(item: PlacedItem, assets: Assets | undefined): StageAsset | undefined {
  const ref = item.type === 'composition' ? item.prerender : 'assetRef' in item ? item.assetRef : undefined;
  const record = ref ? assets?.[ref.id] : undefined;
  if (!ref || !record) return undefined;
  const video = record.revisions[ref.revision]?.video;
  return video ? { kind: record.kind, video } : { kind: record.kind };
}

const sizeOf = (canvas: CanvasSize): CanvasSize => ({ width: canvas.width, height: canvas.height });

/**
 * `place` → box: the same box the frame plan uses for layers (`item_box` in `render-graph`, called synchronously via `editor-wasm`). A media box's height follows the source's display aspect ratio in `assets` (including crop); when not found, the canvas ratio is used. Stickers and placeholder boxes whose asset is an image or video are placed as media.
 */
export function poseOf(item: PlacedItem, canvas: CanvasSize, assets?: Assets): Pose {
  const { cx, cy, w, h, rotation } = stageBox(stageItem(item), sizeOf(canvas), stageAsset(item, assets));
  return { cx, cy, w, h, rotation };
}

/** Whether position and size can be changed: a full-canvas instance's box ignores `place`, so it can only be rotated. */
export function posable(item: PlacedItem, canvas: CanvasSize, assets?: Assets): boolean {
  return !stageBox(stageItem(item), sizeOf(canvas), stageAsset(item, assets)).fullscreen;
}

/** The fields that `setTransform` writes into `place`. */
export type PlaceFields = Partial<Pick<Place, 'x' | 'y' | 'w' | 'scaleY' | 'rot'>>;

/**
 * Box → `place` (the inverse of `poseOf`, also in `render-graph`): only gives the fields that differ from the current values after rounding (no change gives an empty object). `scale` is left alone; the box width is folded into `w`; the box height is written to `scaleY` (height ÷ the natural height derived from the saved width). Percentages and angles keep one decimal place, `scaleY` keeps three; full-canvas items only write the angle.
 */
export function placeFields(item: PlacedItem, pose: Pose, canvas: CanvasSize, assets?: Assets): PlaceFields {
  const { cx, cy, w, h, rotation } = pose;
  if (![cx, cy, w, h, rotation].every(Number.isFinite)) return {};
  return stagePlace(stageItem(item), { cx, cy, w, h, rotation }, sizeOf(canvas), stageAsset(item, assets));
}

/** Rotation pivot: the box center (the element model rotates around the center). */
export function pivotOf(item: PlacedItem, canvas: CanvasSize, assets?: Assets): Point {
  const pose = poseOf(item, canvas, assets);
  return { x: pose.cx, y: pose.cy };
}

/** Local point of the box (relative to the center, unrotated) → canvas point. */
function toCanvas(pose: Pose, lx: number, ly: number): Point {
  const cos = Math.cos(rad(pose.rotation));
  const sin = Math.sin(rad(pose.rotation));
  return { x: pose.cx + lx * cos - ly * sin, y: pose.cy + lx * sin + ly * cos };
}

/** The four corners: top-left, top-right, bottom-right, bottom-left (after rotation). */
export function cornersOf(pose: Pose): [Point, Point, Point, Point] {
  const hw = pose.w / 2;
  const hh = pose.h / 2;
  return [toCanvas(pose, -hw, -hh), toCanvas(pose, hw, -hh), toCanvas(pose, hw, hh), toCanvas(pose, -hw, hh)];
}

/** Whether the point is inside the rotated box (edges count). */
export function poseContains(pose: Pose, p: Point): boolean {
  const cos = Math.cos(rad(-pose.rotation));
  const sin = Math.sin(rad(-pose.rotation));
  const dx = p.x - pose.cx;
  const dy = p.y - pose.cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= pose.w / 2 + 1e-9 && Math.abs(ly) <= pose.h / 2 + 1e-9;
}

/** Bounding box after rotation. */
export function aabbOf(pose: Pose): Rect {
  const c = Math.abs(Math.cos(rad(pose.rotation)));
  const s = Math.abs(Math.sin(rad(pose.rotation)));
  const w = pose.w * c + pose.h * s;
  const h = pose.w * s + pose.h * c;
  return { x: pose.cx - w / 2, y: pose.cy - h / 2, w, h };
}

/** Unrotated box (snapping uses this, on the same basis as `frameBox` in the prototype). */
export function boxRect(pose: Pose): Rect {
  return { x: pose.cx - pose.w / 2, y: pose.cy - pose.h / 2, w: pose.w, h: pose.h };
}

// ---- Pan framing ----

/** Full-frame, `cover`, or cropped videos (sub-videos cut into short videos that are framed shot by shot work like this): dragging it on the canvas pans the crop window. */
export type PannableVideo = VideoItem & { crop: Crop };

export function isPannable(item: SequenceItem): item is PannableVideo {
  return item.type === 'video' && item.mode === 'fullscreen' && (item.fit ?? 'cover') === 'cover' && !!item.crop;
}

/** Display size of the source (width and height swapped for rotation, multiplied by the pixel aspect ratio; same basis as `display_size` in `render-graph`); null when not in the asset table. */
export function sourceSize(item: VideoItem, assets: Assets | undefined): { width: number; height: number } | null {
  const video = assets?.[item.assetRef.id]?.revisions[item.assetRef.revision]?.video;
  if (!video) return null;
  const { num, den } = video.pixelAspectRatio;
  const width = den > 0 ? (video.displayWidth * num) / den : 0;
  const height = video.displayHeight;
  return width > 0 && height > 0 ? { width, height } : null;
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/**
 * Pan crop window (pointer displacement in canvas pixels → new crop): the window size stays the same (the sum of left and right, and the sum of top and bottom, are unchanged); only its position moves, clamped within the source frame. Dragging right makes the picture move right, so the window moves left (`left` gets smaller). How many source-frame pixels one canvas pixel covers is computed from the `cover` scaling (the window fills the canvas along its longer side). When the source size is unknown, it is computed as if the window exactly fills the canvas. When the sum of top and bottom is 0 (the window is as tall as the source), the vertical direction does not move. Four decimal places; if nothing moved, the same object is returned as is.
 */
export function panCrop(crop: Crop, dx: number, dy: number, canvas: CanvasSize, source: { width: number; height: number } | null): Crop {
  const sumX = crop.left + crop.right;
  const sumY = crop.top + crop.bottom;
  const cw = 1 - sumX;
  const ch = 1 - sumY;
  if (!(cw > 0) || !(ch > 0) || !(canvas.width > 0) || !(canvas.height > 0)) return crop;
  // Each canvas pixel is a fraction of the source frame's width / height.
  let fx = cw / canvas.width;
  let fy = ch / canvas.height;
  if (source) {
    const scale = Math.max(canvas.width / (cw * source.width), canvas.height / (ch * source.height));
    fx = 1 / (scale * source.width);
    fy = 1 / (scale * source.height);
  }
  const left = sumX > 0 ? round4(clamp(crop.left - dx * fx, 0, sumX)) : crop.left;
  const top = sumY > 0 ? round4(clamp(crop.top - dy * fy, 0, sumY)) : crop.top;
  if (left === crop.left && top === crop.top) return crop;
  return { left, top, right: round4(Math.max(0, sumX - left)), bottom: round4(Math.max(0, sumY - top)) };
}

// ---- Move ----

/** Allowed range of the center (canvas pixels). */
export interface Limits {
  x: [number, number];
  y: [number, number];
}

/**
 * Move limits: videos are relaxed according to the box (only a visible strip of min(box side, 10%) is kept; `mediaLimits` in the prototype), and the centers of other items are clamped to 3–97% / 4–96%. If an item is already outside the limits at the start, the limits are widened to contain the start position, so it does not jump when touched.
 */
export function moveLimits(item: PlacedItem, pose: Pose, canvas: CanvasSize): Limits {
  const media = (size: number, total: number): [number, number] => {
    const keep = Math.min(size, (total * KEEP_VISIBLE) / 100);
    return [keep - size / 2, total - keep + size / 2];
  };
  const fixed = (range: readonly number[], total: number): [number, number] => [(range[0]! * total) / 100, (range[1]! * total) / 100];
  const base =
    item.type === 'video'
      ? { x: media(pose.w, canvas.width), y: media(pose.h, canvas.height) }
      : { x: fixed(LIMITS.x, canvas.width), y: fixed(LIMITS.y, canvas.height) };
  return {
    x: [Math.min(base.x[0], pose.cx), Math.max(base.x[1], pose.cx)],
    y: [Math.min(base.y[0], pose.cy), Math.max(base.y[1], pose.cy)],
  };
}

/** Guide line: `axis: 'x'` is a vertical line (drawn at x = at), `'y'` is a horizontal line. */
export interface Guide {
  axis: 'x' | 'y';
  at: number;
}

/** Snapping context: the canvas, the boxes of other objects (unrotated), and the threshold (canvas pixels). `null` means no snapping (⌥ held). */
export interface SnapContext {
  canvas: CanvasSize;
  others: Rect[];
  threshold: number;
}

const edgesX = (b: Rect) => [b.x, b.x + b.w / 2, b.x + b.w];
const edgesY = (b: Rect) => [b.y, b.y + b.h / 2, b.y + b.h];

/** Candidate lines on one axis: the canvas's start edge, midline and end edge come first (the canvas wins when distributing evenly), followed by the edges and midlines of other objects. */
function axisLines(extent: number, others: Rect[], pick: (b: Rect) => number[]): number[] {
  return [0, extent / 2, extent, ...others.flatMap(pick)];
}

function snapAxis(moving: number[], lines: number[], threshold: number): { delta: number; lines: number[] } | null {
  let best: number | null = null;
  for (const edge of moving) {
    for (const line of lines) {
      const d = line - edge;
      if (Math.abs(d) > threshold) continue;
      if (best === null || Math.abs(d) < Math.abs(best) || (Math.abs(d) === Math.abs(best) && d < best)) best = d;
    }
  }
  if (best === null) return null;
  const hit: number[] = [];
  for (const edge of moving) {
    const line = lines.find((l) => Math.abs(l - (edge + best)) <= 1e-6);
    if (line !== undefined && !hit.some((h) => Math.abs(h - line) <= 1e-6)) hit.push(line);
  }
  return { delta: best, lines: hit };
}

/** Multi-line snapping: each of the box's three edges is tried against all candidate lines, and the nearest displacement is taken; returns the extra displacement still to add and the lines that matched. */
export function snapMove(box: Rect, snap: SnapContext): { dx: number; dy: number; guides: Guide[] } {
  const { canvas, others, threshold } = snap;
  const out = { dx: 0, dy: 0, guides: [] as Guide[] };
  if (!(canvas.width > 0) || !(canvas.height > 0)) return out;
  const sx = snapAxis(edgesX(box), axisLines(canvas.width, others, edgesX), threshold);
  if (sx) {
    out.dx = sx.delta;
    for (const at of sx.lines) out.guides.push({ axis: 'x', at });
  }
  const sy = snapAxis(edgesY(box), axisLines(canvas.height, others, edgesY), threshold);
  if (sy) {
    out.dy = sy.delta;
    for (const at of sy.lines) out.guides.push({ axis: 'y', at });
  }
  return out;
}

/** Which lines this box is touching right now (guide lines for rendering, not a solver): with ⌥ held it does not snap, but lines it sits on are still drawn. */
export function guidesFor(box: Rect, canvas: CanvasSize, others: Rect[], tolerance: number): Guide[] {
  if (!(canvas.width > 0) || !(canvas.height > 0)) return [];
  const out: Guide[] = [];
  const axes: [number[], number[], Guide['axis']][] = [
    [edgesX(box), axisLines(canvas.width, others, edgesX), 'x'],
    [edgesY(box), axisLines(canvas.height, others, edgesY), 'y'],
  ];
  for (const [edges, lines, axis] of axes) {
    for (const edge of edges) {
      const line = lines.find((l) => Math.abs(l - edge) <= tolerance);
      if (line === undefined) continue;
      if (!out.some((g) => g.axis === axis && Math.abs(g.at - line) <= 1e-6)) out.push({ axis, at: line });
    }
  }
  return out;
}

/**
 * Move: first snaps the center to the canvas midline (±1.5%) and clamps it into the limits, then applies multi-line snapping (the prototype's `dragPos` followed by `snapMove`).
 * When `snap` is null (⌥), neither snapping step applies; only the limits are clamped.
 */
export function dragMove(start: Pose, dx: number, dy: number, limits: Limits, snap: SnapContext | null): Pose {
  let cx = start.cx + dx;
  let cy = start.cy + dy;
  if (snap) {
    const { width: W, height: H } = snap.canvas;
    if (Math.abs(cx - W / 2) < (W * CENTER_SNAP) / 100) cx = W / 2;
    if (Math.abs(cy - H / 2) < (H * CENTER_SNAP) / 100) cy = H / 2;
  }
  cx = clamp(cx, limits.x[0], limits.x[1]);
  cy = clamp(cy, limits.y[0], limits.y[1]);
  if (snap) {
    const s = snapMove(boxRect({ ...start, cx, cy }), snap);
    cx += s.dx;
    cy += s.dy;
  }
  return { ...start, cx, cy };
}

// ---- Edge and corner resize ----

/** Box size range (canvas pixels): width not narrower than 2% of the canvas or 10 pixels, height not shorter than 10 pixels, and none exceeding 400% of the canvas. */
export function sizeRange(canvas: CanvasSize): { min: { w: number; h: number }; max: { w: number; h: number } } {
  return {
    min: { w: Math.max((canvas.width * MIN_W) / 100, MIN_PX), h: MIN_PX },
    max: { w: (canvas.width * MAX_SIZE) / 100, h: (canvas.height * MAX_SIZE) / 100 },
  };
}

export interface EdgeResize {
  handle: Handle;
  /** Total pointer displacement (canvas pixels). */
  dx: number;
  dy: number;
  start: Pose;
  /** ⌥: anchored at the center, the displacement is counted twice. */
  alt: boolean;
  /** ⇧: unlocks the aspect ratio for the corners in the free tier. */
  shift: boolean;
  /** Locked aspect ratio (width / height); null means free. */
  ratio: number | null;
  range: { min: { w: number; h: number }; max: { w: number; h: number } };
}

/**
 * Edge resize (`edgeResize` in the prototype, closed-form solution): the displacement is projected onto the box's own rotated axes, with the left / top sides negated; at the corners, when `⌥ || !⇧ || ratio locked`, both axes are made into one common ratio; the anchor is at the midpoint of the opposite edge or the opposite corner (at the center with ⌥); new center = old center + R(θ)·((1−sx)·ax, (1−sy)·ay).
 */
export function edgeResize(o: EdgeResize): Pose {
  const { handle, start } = o;
  const w0 = Math.max(start.w, 1e-6);
  const h0 = Math.max(start.h, 1e-6);
  const cos = Math.cos(rad(start.rotation));
  const sin = Math.sin(rad(start.rotation));
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');
  let dw = o.dx * cos + o.dy * sin;
  let dh = o.dy * cos - o.dx * sin;
  if (west) dw = -dw;
  if (north) dh = -dh;
  if (isCorner(handle) && (o.alt || !o.shift || o.ratio !== null)) {
    const g = o.ratio ?? w0 / h0;
    const r = (dh + dw) / (1 + g);
    dh = r;
    dw = r * g;
  }
  const sx = west || east ? clamp(w0 + (o.alt ? dw * 2 : dw), o.range.min.w, o.range.max.w) / w0 : 1;
  const sy = north || south ? clamp(h0 + (o.alt ? dh * 2 : dh), o.range.min.h, o.range.max.h) / h0 : 1;
  const ax = o.alt ? 0 : east ? -w0 / 2 : west ? w0 / 2 : 0;
  const ay = o.alt ? 0 : south ? -h0 / 2 : north ? h0 / 2 : 0;
  const ux = (1 - sx) * ax;
  const uy = (1 - sy) * ay;
  return { ...start, w: w0 * sx, h: h0 * sy, cx: start.cx + ux * cos - uy * sin, cy: start.cy + ux * sin + uy * cos };
}

/** The diagonally opposite corner point (after rotation): it stays fixed during scaling. */
export function oppositeCorner(pose: Pose, handle: Handle): Point {
  const sx = handle.includes('w') ? 1 : -1;
  const sy = handle.includes('n') ? 1 : -1;
  return toCanvas(pose, (sx * pose.w) / 2, (sy * pose.h) / 2);
}

/** Scale factor for one uniform scale: the ratio of the pointer's distance to the anchor, clamped to 0.1–5, and the short side is not reduced below 10 pixels (if it is already smaller, it is not reduced further). */
export function scaleFactor(anchor: Point, p0: Point, p: Point, shortSide: number): number {
  const d0 = Math.hypot(p0.x - anchor.x, p0.y - anchor.y);
  const d = Math.hypot(p.x - anchor.x, p.y - anchor.y);
  const lo = Math.min(1, Math.max(SCALE_MIN, MIN_PX / Math.max(shortSide, 1e-6)));
  return clamp(d / Math.max(d0, 1), lo, SCALE_MAX);
}

/** Box scales uniformly around a point: the center moves to `anchor + (c0 − anchor) × f`, so the anchor point stays put. */
export function scaleAbout(pose: Pose, anchor: Point, f: number): Pose {
  return {
    ...pose,
    w: pose.w * f,
    h: pose.h * f,
    cx: anchor.x + (pose.cx - anchor.x) * f,
    cy: anchor.y + (pose.cy - anchor.y) * f,
  };
}

/** Uniform corner scaling (`cornerScaleAbout` in the prototype): anchored at the opposite corner; with ⌥ anchored at the center. */
export function cornerScale(start: Pose, handle: Handle, p0: Point, p: Point, alt: boolean): { pose: Pose; factor: number } {
  const anchor = alt ? { x: start.cx, y: start.cy } : oppositeCorner(start, handle);
  const factor = scaleFactor(anchor, p0, p, Math.min(start.w, start.h));
  return { pose: scaleAbout(start, anchor, factor), factor };
}

// ---- Rotate ----

/** Snaps to a 15° grid by default; with `free` (⇧ / ⌥) it is unconstrained, keeping one decimal place. */
export function snapRotation(degrees: number, free: boolean): number {
  const w = wrapRotation(degrees);
  if (free) return round1(w);
  const s = Math.round(w / ROT_STEP) * ROT_STEP;
  return s === -180 ? 180 : s === 0 ? 0 : s;
}

/** Pointer angle relative to the pivot (degrees; 12 o'clock is 0, clockwise). */
export function pointerAngle(pivot: Point, p: Point): number {
  return (Math.atan2(p.y - pivot.y, p.x - pivot.x) * 180) / Math.PI + 90;
}

/** Rotate gesture: the starting angle plus the angle the pointer has swept around the pivot. */
export function dragRotation(start: number, pivot: Point, p0: Point, p: Point, free: boolean): number {
  return snapRotation(start + pointerAngle(pivot, p) - pointerAngle(pivot, p0), free);
}

// ---- Multi-select ----

/** Group translate: first clamp the displacement so it is valid for the whole group, then add the same displacement to each item (clamping each item separately would distort the group when dragged). */
export function groupShift(starts: Pose[], limits: Limits[], dx: number, dy: number): Point {
  if (!starts.length) return { x: 0, y: 0 };
  let lo = -Infinity;
  let hi = Infinity;
  let lo2 = -Infinity;
  let hi2 = Infinity;
  starts.forEach((p, i) => {
    const l = limits[i];
    if (!l) return;
    lo = Math.max(lo, l.x[0] - p.cx);
    hi = Math.min(hi, l.x[1] - p.cx);
    lo2 = Math.max(lo2, l.y[0] - p.cy);
    hi2 = Math.min(hi2, l.y[1] - p.cy);
  });
  return { x: clamp(dx, Math.min(lo, 0), Math.max(hi, 0)), y: clamp(dy, Math.min(lo2, 0), Math.max(hi2, 0)) };
}

/** Bounding box of a group of boxes (the union of each box's rotated bounding box); null for an empty set. */
export function boundsOf(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Group uniform scale (`groupScale` in the prototype): scales around the center of the unified box; each item's center and size are multiplied by the same factor. The factor is the ratio of the pointer's distance to the center (so the handle follows the pointer), clamped to 0.1–5, and the short side of the smallest item in the group is not reduced below 10 pixels.
 */
export function groupScale(starts: Pose[], bounds: Rect, p0: Point, p: Point): { poses: Pose[]; factor: number } {
  const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  const shortest = Math.min(...starts.map((s) => Math.min(s.w, s.h)));
  const factor = scaleFactor(center, p0, p, shortest);
  return { poses: starts.map((s) => scaleAbout(s, center, factor)), factor };
}

// ---- Keyboard ----

/**
 * Arrow-key nudge (prototype editor-keys: 1%, ⇧ 5%, ⌥↑/↓ 0.1%): in percentages of the canvas width / height. ⌥←/→ is left to the time nudge, and returns null.
 */
export function nudgeDelta(key: string, shift: boolean, alt: boolean, canvas: CanvasSize): Point | null {
  const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
  const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  if (!dx && !dy) return null;
  if (alt && dx) return null;
  const step = alt ? 0.1 : shift ? 5 : 1;
  return { x: (dx * step * canvas.width) / 100, y: (dy * step * canvas.height) / 100 };
}

// ---- Marquee selection ----

/** Rectangle from the start to now; `on` means it has moved past 4px (within that it still counts as a click). When the threshold is in frame pixels, the points passed in must also be in frame pixels. */
export function marqueeRect(p0: Point, p1: Point, min = MARQUEE_MIN): Rect & { on: boolean } {
  const r = normRect({ x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y });
  return { ...r, on: Math.max(r.w, r.h) >= min };
}

export function normRect(r: Rect): Rect {
  return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) };
}

/** Two boxes intersect (edges that only touch do not count). */
export function rectsCross(a: Rect, b: Rect): boolean {
  const m = normRect(a);
  const n = normRect(b);
  return n.x < m.x + m.w && m.x < n.x + n.w && n.y < m.y + m.h && m.y < n.y + n.h;
}

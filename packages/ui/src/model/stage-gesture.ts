import type { Crop, EditOperation, Id } from '@cuccut/protocol';
import { asObject, num } from '../render/text-style.ts';
import type { ItemPatch } from './item-draft.ts';
import { editableTextStyle, patchTextStyle } from './property-values.ts';
import { round1 } from './geometry-panel.ts';
import {
  GUIDE_TOL,
  SNAP_PX,
  boxRect,
  cornerScale,
  dragMove,
  dragRotation,
  edgeResize,
  groupScale,
  groupShift,
  guidesFor,
  moveLimits,
  panCrop,
  placeFields,
  poseOf,
  sizeRange,
  sourceSize,
  type Assets,
  type CanvasSize,
  type Guide,
  type Handle,
  type Limits,
  type PannableVideo,
  type PlacedItem,
  type Point,
  type Pose,
  type Rect,
} from './stage-pose.ts';

/**
 * A single gesture on the stage (`gesture` in the prototype stage-objects.jsx and MultiBox in stage-marquee.jsx): at the start, each item's box is frozen; each pointer move computes that moment's box from the same starting state (so errors do not accumulate); on release the boxes are converted back to `place`, producing one transaction of operations. Everything is in sequence canvas pixels; the on-screen thresholds are given by the caller as “how many canvas pixels make up one screen pixel” (`pxScale`).
 */

/** One item taking part in the gesture: the instance, its box at the start, the move limits, and the asset table used to push boxes (a media box's height follows the source's aspect ratio). */
export interface Member {
  item: PlacedItem;
  start: Pose;
  limits: Limits;
  assets?: Assets;
}

export type Gesture =
  | { kind: 'move'; member: Member; p0: Point }
  | { kind: 'edge'; member: Member; handle: Handle; p0: Point }
  | { kind: 'corner'; member: Member; handle: Handle; p0: Point }
  | { kind: 'rotate'; member: Member; pivot: Point; p0: Point }
  /** Pan framing: for full-frame, `cover`, or cropped videos, dragging only moves the crop window (`source` is the source's display size; null when unknown). */
  | { kind: 'pan'; member: Member & { item: PannableVideo }; source: { width: number; height: number } | null; p0: Point }
  | { kind: 'group-move'; members: Member[]; p0: Point }
  | { kind: 'group-scale'; members: Member[]; bounds: Rect; p0: Point };

export interface Modifiers {
  shift: boolean;
  alt: boolean;
}

/** The canvas the gesture happens on: its size, the other objects that take part in snapping (unrotated boxes), and how many canvas pixels make up one screen pixel. */
export interface StageEnv {
  canvas: CanvasSize;
  others: Rect[];
  pxScale: number;
}

/** The result for this moment: each item's box (in the same order as the members), the uniform scale factor (used to scale text font size along with it), and the guide lines; for pan framing, there is a new crop instead (the box does not move). */
export interface GestureFrame {
  poses: Pose[];
  factor: number;
  guides: Guide[];
  crop?: Crop;
}

export function memberOf(item: PlacedItem, canvas: CanvasSize, assets?: Assets): Member {
  const start = poseOf(item, canvas, assets);
  return { item, start, limits: moveLimits(item, start, canvas), ...(assets ? { assets } : {}) };
}

export function membersOf(gesture: Gesture): Member[] {
  return 'members' in gesture ? gesture.members : [gesture.member];
}

/** Pointer is at `p` (canvas pixels): computes this moment from the start state. ⌥ turns off snapping; when rotating, ⇧ / ⌥ make the angle free. */
export function stepGesture(gesture: Gesture, p: Point, mods: Modifiers, env: StageEnv): GestureFrame {
  const { canvas, others, pxScale } = env;
  const dx = p.x - gesture.p0.x;
  const dy = p.y - gesture.p0.y;
  const guidesOf = (pose: Pose) => guidesFor(boxRect(pose), canvas, others, GUIDE_TOL * pxScale);
  switch (gesture.kind) {
    case 'move': {
      const { start, limits } = gesture.member;
      const snap = mods.alt ? null : { canvas, others, threshold: SNAP_PX * pxScale };
      const pose = dragMove(start, dx, dy, limits, snap);
      return { poses: [pose], factor: 1, guides: guidesOf(pose) };
    }
    case 'edge': {
      const pose = edgeResize({
        handle: gesture.handle,
        dx,
        dy,
        start: gesture.member.start,
        alt: mods.alt,
        shift: mods.shift,
        ratio: null,
        range: sizeRange(canvas),
      });
      return { poses: [pose], factor: 1, guides: guidesOf(pose) };
    }
    case 'corner': {
      const { pose, factor } = cornerScale(gesture.member.start, gesture.handle, gesture.p0, p, mods.alt);
      return { poses: [pose], factor, guides: guidesOf(pose) };
    }
    case 'rotate': {
      const { start } = gesture.member;
      const rotation = dragRotation(start.rotation, gesture.pivot, gesture.p0, p, mods.shift || mods.alt);
      // The element model rotates around the box center: the center and size stay put, only the angle changes.
      return { poses: [{ ...start, rotation }], factor: 1, guides: [] };
    }
    case 'pan': {
      const { item, start } = gesture.member;
      return { poses: [start], factor: 1, guides: [], crop: panCrop(item.crop, dx, dy, canvas, gesture.source) };
    }
    case 'group-move': {
      const starts = gesture.members.map((m) => m.start);
      const d = groupShift(
        starts,
        gesture.members.map((m) => m.limits),
        dx,
        dy,
      );
      return { poses: starts.map((s) => ({ ...s, cx: s.cx + d.x, cy: s.cy + d.y })), factor: 1, guides: [] };
    }
    case 'group-scale': {
      const { poses, factor } = groupScale(
        gesture.members.map((m) => m.start),
        gesture.bounds,
        gesture.p0,
        p,
      );
      return { poses, factor, guides: [] };
    }
  }
}

/** When scaling uniformly, text font size is multiplied by the same factor (clamped to 1–400, one decimal place); styles that are not the legacy text style are left alone. */
export function scaledFontSize(item: PlacedItem, factor: number): number | null {
  if (item.type !== 'text' || factor === 1 || !editableTextStyle(item.style)) return null;
  const size = num(asObject(item.style).fontSize, 30);
  return Math.min(400, Math.max(1, round1(size * factor)));
}

/** Draft layered on top for the preview and the properties panel during the drag; pan framing only layers the crop. */
export function gesturePatch(item: PlacedItem, pose: Pose, factor: number, canvas: CanvasSize, assets?: Assets, crop?: Crop): ItemPatch {
  if (crop) return { crop };
  const fontSize = scaledFontSize(item, factor);
  return {
    place: placeFields(item, pose, canvas, assets),
    ...(fontSize !== null && item.type === 'text' ? { style: patchTextStyle(item.style, { fontSize }) } : {}),
  };
}

/** On release: each item writes only the `place` fields that changed, and text font size is changed as well when scaled uniformly; if nothing changed, the result is an empty table (nothing is committed). */
export function gestureOperations(
  sequenceId: Id,
  members: readonly Member[],
  poses: readonly Pose[],
  factor: number,
  canvas: CanvasSize,
): EditOperation[] {
  const operations: EditOperation[] = [];
  members.forEach(({ item, assets }, i) => {
    const pose = poses[i];
    if (!pose) return;
    const changed = placeFields(item, pose, canvas, assets);
    if (Object.keys(changed).length) operations.push({ type: 'setTransform', sequenceId, itemId: item.id, ...changed });
    const fontSize = scaledFontSize(item, factor);
    if (fontSize !== null && item.type === 'text') {
      operations.push({ type: 'setStyle', sequenceId, itemId: item.id, style: patchTextStyle(item.style, { fontSize }) });
    }
  });
  return operations;
}

const sameCrop = (a: Crop | undefined, b: Crop) =>
  !!a && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;

/** On release of pan framing (or “Apply to whole clip”): writes the crop into one video item; an empty table (nothing committed) if it is unchanged. */
export function cropOperations(sequenceId: Id, item: PlacedItem, crop: Crop): EditOperation[] {
  if (item.type !== 'video' || sameCrop(item.crop, crop)) return [];
  return [{ type: 'setStyle', sequenceId, itemId: item.id, crop: { ...crop } }];
}

/** Arrow-key nudge: a group of instances moves by the same displacement (limits are clamped for the whole group); clamping only, no snapping. */
export function nudgeOperations(
  sequenceId: Id,
  items: readonly PlacedItem[],
  delta: Point,
  canvas: CanvasSize,
  assets?: Assets,
): EditOperation[] {
  const members = items.map((item) => memberOf(item, canvas, assets));
  const d = groupShift(
    members.map((m) => m.start),
    members.map((m) => m.limits),
    delta.x,
    delta.y,
  );
  const poses = members.map(({ start }) => ({ ...start, cx: start.cx + d.x, cy: start.cy + d.y }));
  return gestureOperations(sequenceId, members, poses, 1, canvas);
}

/** Double-clicking the rotation handle resets it to zero: only the angle changes (around the center). Items already at 0° are not committed. */
export function resetRotation(sequenceId: Id, item: PlacedItem): EditOperation[] {
  return item.place.rot ? [{ type: 'setTransform', sequenceId, itemId: item.id, rot: 0 }] : [];
}

/** Pressing on a video item that supports pan framing starts a pan (the source size is taken from the asset table). */
export function panGesture(item: PannableVideo, p0: Point, canvas: CanvasSize, assets?: Assets): Extract<Gesture, { kind: 'pan' }> {
  return { kind: 'pan', member: { ...memberOf(item, canvas, assets), item }, source: sourceSize(item, assets), p0 };
}

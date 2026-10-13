import { defineMessages, live } from '@cuccut/protocol';
import type { Pose } from './stage-pose.ts';
import { zhHans } from './geometry-panel.zh-Hans.ts';
import { zhHant } from './geometry-panel.zh-Hant.ts';
import { ja } from './geometry-panel.ja.ts';
import { ko } from './geometry-panel.ko.ts';
import { es } from './geometry-panel.es.ts';
import { fr } from './geometry-panel.fr.ts';
import { de } from './geometry-panel.de.ts';
import { nl } from './geometry-panel.nl.ts';
import { ptBR } from './geometry-panel.pt-BR.ts';
import { it } from './geometry-panel.it.ts';
import { ru } from './geometry-panel.ru.ts';
import { pl } from './geometry-panel.pl.ts';
import { tr } from './geometry-panel.tr.ts';
import { vi } from './geometry-panel.vi.ts';

/** Copy for the geometry section (the English is the source of keys and types; translations are in `geometry-panel.zh-Hans.ts`). */
const en = {
  x: { left: 'From left', center: 'Horizontal offset', right: 'From right' } as Record<PinX, string>,
  y: { top: 'From top', middle: 'Vertical offset', bottom: 'From bottom' } as Record<PinY, string>,
  pins: {
    'left top': 'Top-left corner',
    'center top': 'Top edge center',
    'right top': 'Top-right corner',
    'left middle': 'Left edge center',
    'center middle': 'Center',
    'right middle': 'Right edge center',
    'left bottom': 'Bottom-left corner',
    'center bottom': 'Bottom edge center',
    'right bottom': 'Bottom-right corner',
  } as Record<`${PinX} ${PinY}`, string>,
};
export type GeometryPanelMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The geometry section of the property page: position · size · nine-point pin (following the prototype model-geometry.js and cuccut-app's geometry_panel).
 *
 * The panel reads the instance's box (`poseOf` in `stage-pose`: the center and pixel width/height derived from the kind by `place`), first converts it to a canvas-percentage
 * box `{l, t, w, h}` with the origin at the top left, then projects it to the four numbers X / Y / W / H according to the pin:
 *
 *   X = l               pin left    X = (l + w/2) − 50   pin center (0 = centered)    X = 100 − (l + w)   pin right
 *   Y = t               pin top     Y = (t + h/2) − 50   pin center                   Y = 100 − (t + h)   pin bottom
 *
 * Back-projection happens only when a field is submitted; axes that were not changed keep their unrounded original value, so opening the panel or switching pins does not make values drift. The pin is not saved to disk.
 */

export type PinX = 'left' | 'center' | 'right';
export type PinY = 'top' | 'middle' | 'bottom';
export interface Pin {
  x: PinX;
  y: PinY;
}
/** Canvas percentages, origin at the top left. */
export interface CanvasBox {
  l: number;
  t: number;
  w: number;
  h: number;
}
/** The four numbers on the panel (canvas percentages). */
export interface PanelValues {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Canvas = { width: number; height: number };
/** Box center and size (canvas pixels); when saved, converted to `place` via `placeFields`. */
export type BoxFields = Pick<Pose, 'cx' | 'cy' | 'w' | 'h'>;
export type QuickAction = 'snapToPin' | 'fullWidth' | 'fullHeight';

export const PIN_X: readonly PinX[] = ['left', 'center', 'right'];
export const PIN_Y: readonly PinY[] = ['top', 'middle', 'bottom'];
export const X_LABEL: Record<PinX, string> = live(() => M.x);
export const Y_LABEL: Record<PinY, string> = live(() => M.y);
export const PIN_NAMES: Record<`${PinX} ${PinY}`, string> = live(() => M.pins);

const EPS = 1e-9;
/** Minimum box width: 2% of the canvas width, and no less than 10 pixels; minimum height 0.1%. */
const MIN_W = 2;
const MIN_PX = 10;
const MIN_H = 0.1;

/** Rounds half away from zero to 1/k (consistent with Rust's f64::round; JS's Math.round would be off by one step for negative halves). */
function roundTo(value: number, k: number): number {
  const r = (Math.sign(value) * Math.round(Math.abs(value) * k)) / k;
  return r === 0 ? 0 : r;
}
export const round1 = (value: number) => roundTo(value, 10);

const sideX = (pin: PinX) => (pin === 'left' ? -1 : pin === 'right' ? 1 : 0);
const sideY = (pin: PinY) => (pin === 'top' ? -1 : pin === 'bottom' ? 1 : 0);

function axisProject(start: number, size: number, side: number): number {
  if (side < 0) return start;
  if (side > 0) return 100 - (start + size);
  return start + size / 2 - 50;
}
function axisUnproject(value: number, size: number, side: number): number {
  if (side < 0) return value;
  if (side > 0) return 100 - size - value;
  return value + 50 - size / 2;
}

/** Box (unrotated) → canvas box. */
export function boxOf(pose: Pose, canvas: Canvas): CanvasBox {
  const { width: W, height: H } = canvas;
  return { l: ((pose.cx - pose.w / 2) / W) * 100, t: ((pose.cy - pose.h / 2) / H) * 100, w: (pose.w / W) * 100, h: (pose.h / H) * 100 };
}

/** Canvas box → box center and size (canvas pixels). */
export function fieldsOf(box: CanvasBox, canvas: Canvas): BoxFields {
  const { width: W, height: H } = canvas;
  const w = (box.w / 100) * W;
  const h = (box.h / 100) * H;
  return { cx: (box.l / 100) * W + w / 2, cy: (box.t / 100) * H + h / 2, w, h };
}

export function projectRaw(box: CanvasBox, pin: Pin): PanelValues {
  return { x: axisProject(box.l, box.w, sideX(pin.x)), y: axisProject(box.t, box.h, sideY(pin.y)), w: box.w, h: box.h };
}

/** The four numbers shown on the panel (one decimal place). */
export function project(box: CanvasBox, pin: Pin): PanelValues {
  const v = projectRaw(box, pin);
  return { x: round1(v.x), y: round1(v.y), w: round1(v.w), h: round1(v.h) };
}

/** Which line (start edge / center line / end edge) is closest; on a tie, the earlier one (left / top) is taken. */
function nearest(start: number, size: number): number {
  const d = [Math.abs(start), Math.abs(start + size / 2 - 50), Math.abs(100 - start - size)];
  let best = 0;
  for (let i = 1; i < 3; i += 1) if (d[i]! < d[best]! - EPS) best = i;
  return best;
}

/** The initial pin on first open: for each axis, the closest line is chosen. */
export function defaultPin(box: CanvasBox): Pin {
  return { x: PIN_X[nearest(box.l, box.w)]!, y: PIN_Y[nearest(box.t, box.h)]! };
}

const changed = (target: number, shown: number) => Math.abs(target - shown) > EPS;

/**
 * Values submitted from the panel: only a field that differs from its displayed value counts as changed. With the aspect ratio locked, changing only the width (or height) carries the other side along proportionally.
 * When the size changes but the position does not, the position keeps the number measured from the pin (a box pinned on the right grows to the left as it widens).
 */
export function applyPanel(pose: Pose, canvas: Canvas, pin: Pin, target: PanelValues, lockRatio: boolean): BoxFields {
  const cur = boxOf(pose, canvas);
  const shown = project(cur, pin);
  const raw = projectRaw(cur, pin);
  const dx = changed(target.x, shown.x);
  const dy = changed(target.y, shown.y);
  const dw = changed(target.w, shown.w);
  const dh = changed(target.h, shown.h);
  const minW = Math.max(MIN_W, (MIN_PX / Math.max(canvas.width, EPS)) * 100);
  let w = dw ? target.w : cur.w;
  let h = dh ? target.h : cur.h;
  if (lockRatio && cur.w > 0 && cur.h > 0) {
    if (dw && !dh) h = (cur.h * w) / cur.w;
    else if (dh && !dw) w = (cur.w * h) / cur.h;
  }
  w = Math.max(w, minW);
  h = Math.max(h, MIN_H);
  const l = dx || changed(w, cur.w) ? axisUnproject(dx ? target.x : raw.x, w, sideX(pin.x)) : cur.l;
  const t = dy || changed(h, cur.h) ? axisUnproject(dy ? target.y : raw.y, h, sideY(pin.y)) : cur.t;
  const next = fieldsOf({ l, t, w, h }, canvas);
  // An unchanged dimension is kept as is, so that round-trip conversions do not add floating-point drift.
  return {
    cx: dx || changed(w, cur.w) ? next.cx : pose.cx,
    cy: dy || changed(h, cur.h) ? next.cy : pose.cy,
    w: changed(w, cur.w) ? next.w : pose.w,
    h: changed(h, cur.h) ? next.h : pose.h,
  };
}

/** Quick actions → new pin and target panel values: snap to pin (position reset to zero), full width (pin left, width 100), full height (pin top, height 100). */
export function quick(pin: Pin, values: PanelValues, action: QuickAction): { pin: Pin; values: PanelValues } {
  if (action === 'fullWidth') return { pin: { x: 'left', y: pin.y }, values: { ...values, x: 0, w: 100 } };
  if (action === 'fullHeight') return { pin: { x: pin.x, y: 'top' }, values: { ...values, y: 0, h: 100 } };
  return { pin, values: { ...values, x: 0, y: 0 } };
}

/**
 * Fit to canvas / fill canvas (cuccut-app element toolbar): scales proportionally so it fits exactly inside the canvas (or exactly covers it), and centers it again.
 */
export function fitCanvas(pose: Pose, canvas: Canvas, fill: boolean): BoxFields {
  const sx = canvas.width / pose.w;
  const sy = canvas.height / pose.h;
  const k = fill ? Math.max(sx, sy) : Math.min(sx, sy);
  return { cx: canvas.width / 2, cy: canvas.height / 2, w: pose.w * k, h: pose.h * k };
}

/** Wraps the rotation angle into (−180, 180]. */
export function wrapRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const r = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

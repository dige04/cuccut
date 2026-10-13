import type { CSSProperties, ReactNode } from 'react';
import type { Id } from '@cuccut/protocol';
import RotateCW from '@react-spectrum/s2/icons/RotateCW';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_COPY } from '../../copy.ts';
import {
  cornerScales,
  handlesFor,
  isCorner,
  resizeCursor,
  smallHandles,
  type Guide,
  type Handle,
  type Pose,
  type Rect,
  type ResizeKind,
} from '../../model/stage-pose.ts';
import './editor.css';

/**
 * How the stage overlay is drawn (prototype ui.css .selbox / .hnd / .rot / .angchip / .selthin / .multichip / .marquee / .gline):
 * selection boxes, handles, the rotate knob, the angle bubble, the unified box for multi-select and its corner badge, the marquee rectangle, and guide lines. Drawing only; the pointer is handled uniformly by the overlay root:
 * handles carry `data-handle`, the rotate knob carries `data-rotate`, and the unified box carries `data-group`.
 */

/** Sequence canvas pixels → stage display pixels. */
export interface View {
  kx: number;
  ky: number;
}

const itemBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  outlineStyle: { default: 'solid', isVideo: 'none' },
  outlineWidth: '[1.5px]',
  outlineColor: 'blue-800',
  outlineOffset: 0,
  cursor: { default: 'pointer', isMovable: 'move', isDragging: 'grabbing' },
});
const thinBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  outlineStyle: 'solid',
  outlineWidth: 1,
  outlineColor: 'blue-600',
  pointerEvents: 'none',
});
const groupBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  outlineStyle: 'dashed',
  outlineWidth: '[1.5px]',
  outlineColor: 'blue-800',
  cursor: { default: 'pointer', isMovable: 'move', isDragging: 'grabbing' },
});
const handle = style({
  position: 'absolute',
  boxSizing: 'border-box',
  backgroundColor: 'gray-25',
  borderRadius: 'full',
  outlineStyle: 'solid',
  outlineWidth: '[1.5px]',
  outlineColor: 'blue-800',
  boxShadow: 'elevated',
  zIndex: 2,
});
const knob = style({
  position: 'absolute',
  left: '[calc(50% - 10px)]',
  bottom: '[calc(100% + 10px)]',
  size: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'full',
  backgroundColor: 'gray-25',
  color: 'gray-700',
  boxShadow: 'elevated',
  cursor: 'grab',
  zIndex: 2,
});
const knobIcon = iconStyle({ size: 'XS' });
const angleChip = style({
  position: 'absolute',
  left: '50%',
  bottom: '[calc(100% + 36px)]',
  paddingX: 8,
  paddingY: 2,
  borderRadius: 'sm',
  font: 'code-xs',
  whiteSpace: 'nowrap',
  backgroundColor: 'transparent-black-800',
  color: 'white',
  pointerEvents: 'none',
});
const chip = style({
  position: 'absolute',
  left: '50%',
  top: '[calc(100% + 8px)]',
  paddingX: 8,
  paddingY: 2,
  borderRadius: 'sm',
  font: 'ui-xs',
  whiteSpace: 'nowrap',
  backgroundColor: 'blue-800',
  color: 'gray-25',
  pointerEvents: 'none',
});
const marqueeBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: 'blue-800',
  backgroundColor: 'blue-400',
  borderRadius: 'sm',
  opacity: 0.22,
  pointerEvents: 'none',
});
const guideLine = style({ position: 'absolute', backgroundColor: 'blue-800', pointerEvents: 'none' });

/** The box's position on the stage (unrotated; rotation is left to CSS, which rotates around the center, consistent with the box's coordinates). */
export function displayRect(pose: Pose, view: View): CSSProperties {
  return {
    left: (pose.cx - pose.w / 2) * view.kx,
    top: (pose.cy - pose.h / 2) * view.ky,
    width: pose.w * view.kx,
    height: pose.h * view.ky,
  };
}

/** Handle placement (copied from the prototype: the 12px corner dots sit 7px outside the box corners, and the 4×20 edge bars have their outer edge flush with the stroke; small boxes use one size step smaller, 8px). */
function handlePlace(h: Handle, small: boolean): CSSProperties {
  if (isCorner(h)) {
    const size = small ? 8 : 12;
    const off = small ? -4 : -7;
    return { width: size, height: size, [h.includes('n') ? 'top' : 'bottom']: off, [h.includes('w') ? 'left' : 'right']: off };
  }
  const long = small ? 8 : 20;
  if (h === 'w' || h === 'e') return { width: 4, height: long, top: '50%', marginTop: -long / 2, [h === 'w' ? 'left' : 'right']: h === 'w' ? -4 : -3 };
  return { width: long, height: 4, left: '50%', marginLeft: -long / 2, [h === 'n' ? 'top' : 'bottom']: h === 'n' ? -4 : -3 };
}

function handleTip(kind: ResizeKind, h: Handle): string {
  if (isCorner(h)) return cornerScales(kind, h) ? STAGE_COPY.cornerScaleTip : STAGE_COPY.cornerFreeTip;
  return h === 'n' || h === 's' ? STAGE_COPY.edgeHeightTip : STAGE_COPY.edgeWidthTip;
}

/** Selection box for a single item: when editable, it has handles and a rotate knob. An angle bubble appears while rotating (counter-rotated to cancel the box's rotation, so the reading stays upright). */
export function ItemBox({
  id,
  pose,
  view,
  kind,
  video,
  controls,
  movable,
  dragging,
  angle,
  children,
}: {
  id: Id;
  pose: Pose;
  view: View;
  kind: ResizeKind;
  /** Videos are not outlined (prototype .selbox--video); only handles are shown. */
  video: boolean;
  /** Shows handles and the rotate knob (editable and not playing). */
  controls: boolean;
  movable: boolean;
  dragging: boolean;
  angle: number | null;
  children?: ReactNode;
}) {
  const w = pose.w * view.kx;
  const h = pose.h * view.ky;
  const small = smallHandles(w, h);
  return (
    <div
      className={itemBox({ isVideo: video, isMovable: movable, isDragging: dragging })}
      style={{ ...displayRect(pose, view), transform: `rotate(${pose.rotation}deg)` }}
      data-box={id}
    >
      {children}
      {controls
        ? handlesFor(kind, w, h).map((hd) => (
            <div
              key={hd}
              className={`${handle} cc-stage-handle`}
              style={{ ...handlePlace(hd, small), cursor: resizeCursor(hd, pose.rotation) }}
              title={handleTip(kind, hd)}
              data-handle={hd}
            />
          ))
        : null}
      {controls ? (
        <div className={`${knob} cc-stage-rotate`} title={STAGE_COPY.rotateTip} data-rotate={id}>
          <RotateCW styles={knobIcon} data-cc-icons="own" />
        </div>
      ) : null}
      {angle !== null ? (
        <div className={angleChip} style={{ transform: `translateX(-50%) rotate(${-pose.rotation}deg)` }}>
          {STAGE_COPY.degrees(angle)}
        </div>
      ) : null}
    </div>
  );
}

/** When multi-selecting, each item keeps only a thin outline (prototype .selthin). */
export function ThinBox({ pose, view }: { pose: Pose; view: View }) {
  return <div className={thinBox} style={{ ...displayRect(pose, view), transform: `rotate(${pose.rotation}deg)` }} />;
}

const GROUP_CORNERS: Handle[] = ['nw', 'ne', 'sw', 'se'];

/** Unified multi-select box (prototype MultiBox): a dashed outer frame. Drag it as a whole; the corners scale the whole group proportionally; no rotate knob. A corner badge below reads “N selected”. */
export function GroupBox({
  bounds,
  view,
  count,
  controls,
  dragging,
}: {
  bounds: Rect;
  view: View;
  count: number;
  controls: boolean;
  dragging: boolean;
}) {
  return (
    <div
      className={groupBox({ isMovable: controls, isDragging: dragging })}
      style={{ left: bounds.x * view.kx, top: bounds.y * view.ky, width: bounds.w * view.kx, height: bounds.h * view.ky }}
      data-group
    >
      {controls
        ? GROUP_CORNERS.map((hd) => (
            <div
              key={hd}
              className={`${handle} cc-stage-handle`}
              style={{ ...handlePlace(hd, false), cursor: resizeCursor(hd, 0) }}
              title={STAGE_COPY.groupCornerTip}
              data-handle={hd}
            />
          ))
        : null}
      <div className={chip} style={{ transform: 'translateX(-50%)' }}>
        {STAGE_COPY.picked(count)}
      </div>
    </div>
  );
}

/** Marquee rectangle (stage display pixels). */
export function Marquee({ rect }: { rect: Rect }) {
  return <div className={marqueeBox} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />;
}

/** Alignment guide line: 1px, spanning the picture. Computed live during a gesture; disappears on release. */
export function Guides({ guides, view }: { guides: Guide[]; view: View }) {
  return (
    <>
      {guides.map((g) => (
        <i
          key={`${g.axis}:${g.at}`}
          className={guideLine}
          style={g.axis === 'x' ? { left: g.at * view.kx, top: 0, bottom: 0, width: 1 } : { top: g.at * view.ky, left: 0, right: 0, height: 1 }}
        />
      ))}
    </>
  );
}

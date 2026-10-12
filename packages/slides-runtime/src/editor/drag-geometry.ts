/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** Axis-aligned box in slide coordinates. */
export interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A point on or in a rectangle a line end can attach to, with the rectangle it belongs to. */
export interface RectangleAttachmentPoint {
  x: number;
  y: number;
  box: DragRect;
}
export interface DragSize {
  w: number;
  h: number;
}
/** A box being resized together with a selection, with optional per-axis size limits. */
export interface ResizeLimitRect {
  w: number;
  h: number;
  min?: Partial<DragSize>;
  max?: Partial<DragSize>;
}
/** The smallest and largest size a multi-selection may be resized to. */
export interface SelectionResizeScaleLimits {
  min: DragSize;
  max: DragSize;
}
/** The part of a pointer event that decides whether a drag may start on its target. */
export interface CanvasDragStartEvent {
  button: number;
  target: EventTarget | null;
  preventDefault(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactfl: ReactNamespace;
    rectangleAttachmentPoints: (
      rectangles: readonly DragRect[],
    ) => RectangleAttachmentPoint[];
    nearestAttachmentPoint: <P extends { x: number; y: number }>(
      points: readonly P[],
      x: number,
      y: number,
      maxDistance: number,
    ) => P | null;
    startCanvasDrag: (event: CanvasDragStartEvent) => boolean;
    unionSelectionRectangles: (
      rectangles: readonly DragRect[],
    ) => DragRect | null;
    selectionResizeScaleLimits: (
      selection: DragSize & Partial<DragRect>,
      rectangles: readonly ResizeLimitRect[],
    ) => SelectionResizeScaleLimits;
  }
}

export function installEditorDragGeometry(
  runtime: RuntimeBindings,
): () => void {
  var reactfl: ReactNamespace;
  function rectangleAttachmentPoints(
    rectangles: readonly DragRect[],
  ): RectangleAttachmentPoint[] {
    let items: RectangleAttachmentPoint[] = [];
    for (let value of rectangles)
      for (let value2 of [0, 0.5, 1])
        for (let value3 of [0, 0.5, 1]) {
          if (value2 === 0.5 && value3 === 0.5) {
            continue;
          }
          items.push({
            x: value.x + value.w * value2,
            y: value.y + value.h * value3,
            box: value,
          });
        }
    return items;
  }
  function nearestAttachmentPoint<P extends { x: number; y: number }>(
    points: readonly P[],
    x: number,
    y: number,
    maxDistance: number,
  ): P | null {
    let value: P | null = null,
      value2 = maxDistance;
    for (let value3 of points) {
      let value4 = Math.hypot(value3.x - x, value3.y - y);
      if (value4 < value2) {
        value = value3;
        value2 = value4;
      }
    }
    return value;
  }
  function startCanvasDrag(event: CanvasDragStartEvent): boolean {
    if (event.button !== 0) {
      return false;
    }
    let target = event.target as Element | null,
      value =
        target && typeof target.closest === "function"
          ? target.closest("button, a, input, select, textarea")
          : null;
    if (value !== null && !value.hasAttribute("data-drag-surface")) {
      return false;
    }
    event.preventDefault();
    let activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && activeElement !== document.body) {
      activeElement.blur?.();
    }
    return true;
  }
  function unionSelectionRectangles(
    rectangles: readonly DragRect[],
  ): DragRect | null {
    if (rectangles.length === 0) {
      return null;
    }
    let [items, items2, items3, items4] = [1 / 0, 1 / 0, -1 / 0, -1 / 0];
    for (let value of rectangles)
      [items, items2, items3, items4] = [
        Math.min(items, value.x),
        Math.min(items2, value.y),
        Math.max(items3, value.x + value.w),
        Math.max(items4, value.y + value.h),
      ];
    return {
      x: items,
      y: items2,
      w: items3 - items,
      h: items4 - items2,
    };
  }
  function selectionResizeScaleLimits(
    selection: DragSize & Partial<DragRect>,
    rectangles: readonly ResizeLimitRect[],
  ): SelectionResizeScaleLimits {
    let [items, items2, items3, items4] = [0, 0, 1 / 0, 1 / 0];
    for (let value of rectangles) {
      if (value.w > 0 && value.min?.w !== undefined && value.w >= value.min.w) {
        items = Math.max(items, value.min.w / value.w);
      }
      if (value.h > 0 && value.min?.h !== undefined && value.h >= value.min.h) {
        items2 = Math.max(items2, value.min.h / value.h);
      }
      if (value.w > 0 && value.max?.w !== undefined && value.w <= value.max.w) {
        items3 = Math.min(items3, value.max.w / value.w);
      }
      if (value.h > 0 && value.max?.h !== undefined && value.h <= value.max.h) {
        items4 = Math.min(items4, value.max.h / value.h);
      }
    }
    let callback = (input: number, options: number): number =>
      options === 1 / 0 ? 1 / 0 : input * options;
    return {
      min: {
        w: selection.w * items,
        h: selection.h * items2,
      },
      max: {
        w: callback(selection.w, items3),
        h: callback(selection.h, items4),
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "rectangleAttachmentPoints",
    () => rectangleAttachmentPoints,
  );
  bindRuntimeValue(
    runtime,
    "nearestAttachmentPoint",
    () => nearestAttachmentPoint,
  );
  bindRuntimeValue(
    runtime,
    "reactfl",
    () => reactfl,
    (value) => {
      reactfl = value;
    },
  );
  bindRuntimeValue(runtime, "startCanvasDrag", () => startCanvasDrag);
  bindRuntimeValue(
    runtime,
    "unionSelectionRectangles",
    () => unionSelectionRectangles,
  );
  bindRuntimeValue(
    runtime,
    "selectionResizeScaleLimits",
    () => selectionResizeScaleLimits,
  );
  return () => {
    reactfl = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
  };
}

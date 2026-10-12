import type {
  Point,
  Size,
  Rectangle,
  ResizeHandle,
  ResizeMember,
  SizeLimits,
} from "../../contracts/geometry";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorGeometryResize(
  runtime: RuntimeBindings,
): () => void {
  var reactGeometryResize: Dynamic;
  function resizeRect(
    rect: Rectangle,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    min: Size,
    max: Size,
  ): Rectangle {
    let { x: value2, y: value3, w: value4, h: value5 } = rect;
    handle.x !== null &&
      ((value4 = Math.max(
        min.w,
        Math.min(rect.w + (handle.x === "right" ? dx : -dx), max.w),
      )),
      handle.x === "left" && (value2 = rect.x + (rect.w - value4)));
    handle.y !== null &&
      ((value5 = Math.max(
        min.h,
        Math.min(rect.h + (handle.y === "bottom" ? dy : -dy), max.h),
      )),
      handle.y === "top" && (value3 = rect.y + (rect.h - value5)));
    return {
      x: value2,
      y: value3,
      w: value4,
      h: value5,
    };
  }
  function resizeRectKeepingAspect(
    rect: Rectangle,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    min: Size,
    max: Size,
  ): Rectangle {
    let value2 = resizeRect(
        rect,
        handle,
        dx,
        dy,
        {
          w: 0,
          h: 0,
        },
        {
          w: 1 / 0,
          h: 1 / 0,
        },
      ),
      [items, items2] = [value2.w / rect.w, value2.h / rect.h],
      value3 = Math.abs(items - 1) >= Math.abs(items2 - 1) ? items : items2;
    value3 = Math.min(value3, max.w / rect.w, max.h / rect.h);
    value3 = Math.max(value3, min.w / rect.w, min.h / rect.h);
    let [items3, items4] = [rect.w * value3, rect.h * value3];
    return {
      x: handle.x === "left" ? rect.x + rect.w - items3 : rect.x,
      y: handle.y === "top" ? rect.y + rect.h - items4 : rect.y,
      w: items3,
      h: items4,
    };
  }
  function canStartCanvasDrag(event?: Dynamic): Dynamic {
    if (event.button !== 0) return false;
    let target: Dynamic = event.target,
      value: Dynamic =
        target && typeof target.closest == "function"
          ? target.closest("button, a, input, select, textarea")
          : null;
    if (value !== null && !value.hasAttribute("data-drag-surface"))
      return false;
    event.preventDefault();
    let activeElement: Dynamic = (document as Dynamic).activeElement;
    activeElement &&
      activeElement !== (document as Dynamic).body &&
      activeElement.blur?.();
    return true;
  }
  function unionRects(rects: readonly Rectangle[]): Rectangle | null {
    if (rects.length === 0) return null;
    let [items2, items3, items4, items5] = [1 / 0, 1 / 0, -1 / 0, -1 / 0];
    for (let value of rects)
      [items2, items3, items4, items5] = [
        Math.min(items2, value.x),
        Math.min(items3, value.y),
        Math.max(items4, value.x + value.w),
        Math.max(items5, value.y + value.h),
      ];
    return {
      x: items2,
      y: items3,
      w: items4 - items2,
      h: items5 - items3,
    };
  }
  function transformPointBetweenRects(
    point: Point,
    from: Rectangle,
    to: Rectangle,
  ): Point {
    let [items, items2] = [
      from.w > 0 ? to.w / from.w : 1,
      from.h > 0 ? to.h / from.h : 1,
    ];
    return {
      x: to.x + (point.x - from.x) * items,
      y: to.y + (point.y - from.y) * items2,
    };
  }
  function transformRectBetweenRects(
    rect: Rectangle,
    from: Rectangle,
    to: Rectangle,
  ): Rectangle {
    let [items, items2] = [
      from.w > 0 ? to.w / from.w : 1,
      from.h > 0 ? to.h / from.h : 1,
    ];
    return {
      x: to.x + (rect.x - from.x) * items,
      y: to.y + (rect.y - from.y) * items2,
      w: rect.w * items,
      h: rect.h * items2,
    };
  }
  function selectionResizeLimits(
    size: Size,
    members: readonly ResizeMember[],
  ): SizeLimits {
    let [items, items2, items3, items4] = [0, 0, 1 / 0, 1 / 0];
    for (let value of members) {
      value.w > 0 &&
        value.min?.w !== undefined &&
        value.w >= value.min.w &&
        (items = Math.max(items, value.min.w / value.w));
      value.h > 0 &&
        value.min?.h !== undefined &&
        value.h >= value.min.h &&
        (items2 = Math.max(items2, value.min.h / value.h));
      value.w > 0 &&
        value.max?.w !== undefined &&
        value.w <= value.max.w &&
        (items3 = Math.min(items3, value.max.w / value.w));
      value.h > 0 &&
        value.max?.h !== undefined &&
        value.h <= value.max.h &&
        (items4 = Math.min(items4, value.max.h / value.h));
    }
    let callback: (dimension: number, scale: number) => number = (
      input2,
      options2,
    ) => (options2 === 1 / 0 ? 1 / 0 : input2 * options2);
    return {
      min: {
        w: size.w * items,
        h: size.h * items2,
      },
      max: {
        w: callback(size.w, items3),
        h: callback(size.h, items4),
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "reactGeometryResize",
    () => reactGeometryResize,
    (value) => {
      reactGeometryResize = value;
    },
  );
  bindRuntimeValue(runtime, "resizeRect", () => resizeRect);
  bindRuntimeValue(
    runtime,
    "resizeRectKeepingAspect",
    () => resizeRectKeepingAspect,
  );
  bindRuntimeValue(runtime, "canStartCanvasDrag", () => canStartCanvasDrag);
  bindRuntimeValue(runtime, "unionRects", () => unionRects);
  bindRuntimeValue(
    runtime,
    "transformPointBetweenRects",
    () => transformPointBetweenRects,
  );
  bindRuntimeValue(
    runtime,
    "transformRectBetweenRects",
    () => transformRectBetweenRects,
  );
  bindRuntimeValue(
    runtime,
    "selectionResizeLimits",
    () => selectionResizeLimits,
  );
  return () => {
    reactGeometryResize = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}

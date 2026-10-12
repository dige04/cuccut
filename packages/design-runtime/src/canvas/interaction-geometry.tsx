/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasInteractionGeometry(
  runtime: RuntimeBindings,
): () => void {
  var jsx_Nn: Dynamic;
  var freehandSimplifyTolerance: Dynamic;
  var bothTransformAxes: Dynamic;
  var isPrimaryModifierEvent: Dynamic;
  var minimumArtboardSize: Dynamic;
  var maximumArtboardSize: Dynamic;
  var canvasDragActivationDelayMs: Dynamic;
  var canvasTouchDragActivationDelayMs: Dynamic;
  var canvasLongPressDelayMs: Dynamic;
  var canvasDragThresholdPixels: Dynamic;
  var canvasTouchDragThresholdPixels: Dynamic;
  function freehandDrawingAnnotation(
    points?: Dynamic,
    color?: Dynamic,
    closed: Dynamic = true,
  ): Dynamic {
    let [items, items2]: Dynamic = [1 / 0, 1 / 0];
    for (let value5 of points as Dynamic)
      [items, items2] = [
        Math.min(items, Math.floor(value5.x)),
        Math.min(items2, Math.floor(value5.y)),
      ];
    let value: Dynamic = points.map(
        (input?: Dynamic): Dynamic => [input.x - items, input.y - items2],
      ),
      count: Dynamic = 1;
    for (let [value5, value6] of value as Dynamic)
      count = Math.max(count, value5, value6);
    let value2: Dynamic = Math.min(
        1,
        runtime.PlatformFileContentLimit_6 / count,
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic => ({
        x: Math.round((items + input.x) * 10) / 10,
        y: Math.round((items2 + input.y) * 10) / 10,
        w: Math.max(runtime.PlatformFileContentConstant_19, input.w),
        h: Math.max(runtime.PlatformFileContentConstant_19, input.h),
        d: input.d,
      });
    for (
      let value5: Dynamic = color;
      value5 > 0 && Number.isFinite(value5) && value5 <= 16 * color;
      value5 *= 2
    ) {
      let value6: Dynamic = (0, runtime.fitPenCurve)(
        value.map(
          ([input, input2]: Dynamic): Dynamic => [
            input * value2,
            input2 * value2,
          ],
        ),
        value5 * value2,
      );
      if (
        !value6 ||
        value6.length <= 4 ||
        (!closed && value6.length * 2 > runtime.PlatformFileContentLimit_7)
      )
        break;
      let value7: Dynamic = (0, runtime.flattenCubicPath)(value6);
      if (value7.length * 2 > runtime.PlatformFileContentLimit_7) continue;
      let value8: Dynamic = (0, runtime.penPathBounds)(value7, 1);
      if (!closed) {
        if (value8.d.length > runtime.PlatformFileContentLimit_7) break;
        return callback(value8);
      }
      let value9: Dynamic =
        Math.max(value8.w, value8.h) /
        (runtime.PlatformFileContentLimit_6 - 0.5);
      value9 > 1 &&
        (value8 = (0, runtime.penPathBounds)(
          value7.map((input?: Dynamic): Dynamic => input / value9),
          1,
        ));
      if ((0, runtime.PlatformFileContentTrim_2)(value8.d) !== null)
        return callback(value8);
    }
    let value3: Dynamic = Math.max(1, Math.ceil(points.length / 1500)),
      value4: Dynamic = value.filter(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          options % value3 === 0 || options === value.length - 1,
      ),
      [items3, items4, items5]: Dynamic = [
        runtime.PlatformFileContentConstant_19,
        runtime.PlatformFileContentConstant_19,
        "",
      ];
    value4.forEach(([input, input2]: Dynamic, options?: Dynamic): Dynamic => {
      let [items6, items7]: Dynamic = [
        Math.round(input * value2),
        Math.round(input2 * value2),
      ];
      [items3, items4] = [Math.max(items3, items6), Math.max(items4, items7)];
      items5 +=
        (options === 0 ? "M" : " L") + String(items6) + " " + String(items7);
    });
    return {
      x: items,
      y: items2,
      w: items3,
      h: items4,
      d: items5,
    };
  }
  function placementGhostAnnotation(placement?: Dynamic): Dynamic {
    return placement.tool === "arrow" || placement.tool === "line"
      ? {
          id: "place-ghost",
          kind: placement.tool,
          x: placement.dirX === 1 ? placement.x : placement.x + placement.w,
          y: placement.dirY === 1 ? placement.y : placement.y + placement.h,
          x2: placement.dirX === 1 ? placement.x + placement.w : placement.x,
          y2: placement.dirY === 1 ? placement.y + placement.h : placement.y,
        }
      : {
          id: "place-ghost",
          kind: placement.tool === "oval" ? "oval" : "rect",
          x: placement.x,
          y: placement.y,
          w: Math.max(placement.w, 1),
          h: Math.max(placement.h, 1),
        };
  }
  function isCanvasReservedShortcut(event?: Dynamic): Dynamic {
    return event.key === "Shift" ||
      event.key === "Control" ||
      event.key === "Alt" ||
      event.key === "Meta" ||
      event.key === "CapsLock" ||
      /^F\d{1,2}$/.test(event.key) ||
      event.key === " "
      ? true
      : (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          ["z", "y", "=", "+", "-", "0", "\\"].includes(
            event.key.toLowerCase(),
          );
  }
  bindRuntimeValue(
    runtime,
    "jsx_Nn",
    () => jsx_Nn,
    (value) => {
      jsx_Nn = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "freehandSimplifyTolerance",
    () => freehandSimplifyTolerance,
    (value) => {
      freehandSimplifyTolerance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "freehandDrawingAnnotation",
    () => freehandDrawingAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "placementGhostAnnotation",
    () => placementGhostAnnotation,
  );
  bindRuntimeValue(
    runtime,
    "bothTransformAxes",
    () => bothTransformAxes,
    (value) => {
      bothTransformAxes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPrimaryModifierEvent",
    () => isPrimaryModifierEvent,
    (value) => {
      isPrimaryModifierEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minimumArtboardSize",
    () => minimumArtboardSize,
    (value) => {
      minimumArtboardSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maximumArtboardSize",
    () => maximumArtboardSize,
    (value) => {
      maximumArtboardSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasDragActivationDelayMs",
    () => canvasDragActivationDelayMs,
    (value) => {
      canvasDragActivationDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasTouchDragActivationDelayMs",
    () => canvasTouchDragActivationDelayMs,
    (value) => {
      canvasTouchDragActivationDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasLongPressDelayMs",
    () => canvasLongPressDelayMs,
    (value) => {
      canvasLongPressDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasDragThresholdPixels",
    () => canvasDragThresholdPixels,
    (value) => {
      canvasDragThresholdPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasTouchDragThresholdPixels",
    () => canvasTouchDragThresholdPixels,
    (value) => {
      canvasTouchDragThresholdPixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isCanvasReservedShortcut",
    () => isCanvasReservedShortcut,
  );
  return () => {
    jsx_Nn = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    freehandSimplifyTolerance = 1.25;
    bothTransformAxes = {
      x: true,
      y: true,
    };
    isPrimaryModifierEvent = (input?: Dynamic): Dynamic =>
      runtime.InspectorColorPickResolvedValue_2 ? input.metaKey : input.ctrlKey;
    minimumArtboardSize = {
      w: runtime.PlatformFileContentConstant_16,
      h: runtime.PlatformFileContentConstant_16,
    };
    maximumArtboardSize = {
      w: runtime.PlatformFileContentLimit_6,
      h: runtime.PlatformFileContentLimit_6,
    };
    canvasDragActivationDelayMs = 200;
    canvasTouchDragActivationDelayMs = 600;
    canvasLongPressDelayMs = 2e3;
    canvasDragThresholdPixels = 4;
    canvasTouchDragThresholdPixels = 8;
  };
}

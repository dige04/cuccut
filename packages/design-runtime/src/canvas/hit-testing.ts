/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasHitTesting(runtime: RuntimeBindings): () => void {
  var canvasContextMenuTargetFromElement: Dynamic;
  var artboardOverlayIdPrefixes: Dynamic;
  var inclusiveRectIntersects: Dynamic;
  var expandHitTestRect: Dynamic;
  var penHitTestPointsCache: Dynamic;
  function selectionPointerDownDecision(
    selection?: Dynamic,
    target?: Dynamic,
    additive?: Dynamic,
  ): Dynamic {
    return (0, runtime.hasBoardSelection)(selection, target) &&
      (additive || (0, runtime.boardSelectionCount)(selection) > 1)
      ? {
          selectNow: false,
          carry: selection,
          click: additive ? "toggle" : "collapse",
        }
      : {
          selectNow: true,
          carry: additive
            ? (0, runtime.toggleBoardSelection)(selection, target)
            : (0, runtime.boardSelectionItems)(target),
          click: null,
        };
  }
  function canvasFacePointerAction(hit2?: Dynamic): Dynamic {
    return hit2.faceOverlay && hit2.pointerType === "touch"
      ? "leave"
      : hit2.editing &&
          (hit2.tool == null ||
            hit2.tool === "select" ||
            hit2.tool === "vector") &&
          !hit2.fullscreen
        ? "pick"
        : "artboard";
  }
  function shouldBeginCanvasMarquee(hit2?: Dynamic): Dynamic {
    return (
      hit2.bare &&
      hit2.pointerType === "mouse" &&
      hit2.button === 0 &&
      ((hit2.tool ?? "select") === "select" || hit2.tool === "vector")
    );
  }
  function isCanvasContextMenuPointer(hit2?: Dynamic): Dynamic {
    return hit2.button !== 2 || hit2.pointerType === "touch"
      ? false
      : hit2.chrome == null ||
          hit2.chrome === "set-box-pad" ||
          hit2.chrome === "focus-overlay" ||
          hit2.chrome === "face-overlay" ||
          hit2.chrome === "set-overlay" ||
          hit2.chrome === "comments";
  }
  function canvasContextMenuTarget(hit2?: Dynamic): Dynamic {
    return hit2.blanket === true
      ? null
      : hit2.object != null
        ? {
            kind: "object",
            id: hit2.object,
          }
        : hit2.chrome == null || hit2.chrome === "set-box-pad"
          ? hit2.file != null
            ? {
                kind: "artboard",
                file: hit2.file,
              }
            : {
                kind: "canvas",
              }
          : hit2.file != null &&
              [
                "title",
                "focus-overlay",
                "face-overlay",
                "set-overlay",
              ].includes(hit2.chrome)
            ? {
                kind: "artboard",
                file: hit2.file,
              }
            : null;
  }
  function shouldPassFileDropThroughOverlay(hit2?: Dynamic): Dynamic {
    return (
      hit2.filesDrag &&
      (hit2.chrome === "face-overlay" || hit2.chrome === "set-overlay")
    );
  }
  function applyElementRectStyle(element?: Dynamic, rect?: Dynamic): Dynamic {
    !element ||
      !rect ||
      ((element.style.left = String(rect.x) + "px"),
      (element.style.top = String(rect.y) + "px"),
      (element.style.width = String(rect.w) + "px"),
      (element.style.height = String(rect.h) + "px"));
  }
  function objectsWithinCanvasMarquee(
    manifest?: Dynamic,
    rect?: Dynamic,
    selection?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(selection.files);
    for (let value of manifest.artboards as Dynamic)
      inclusiveRectIntersects(rect, value) && values.add(value.file);
    let values2: Dynamic = new Set(selection.notes);
    for (let value of manifest.annotations as Dynamic) {
      let value2: Dynamic,
        value3: Dynamic = (0, runtime.annotationRotation)(value);
      if (
        value.kind === "line" ||
        value.kind === "arrow" ||
        value.kind === "pen"
      ) {
        let value4: Dynamic = expandHitTestRect(
          rect,
          (0, runtime.getAnnotationStrokeWidth)(value) / 2,
        );
        value2 =
          value.kind === "pen"
            ? inclusiveRectIntersects(
                value4,
                (0, runtime.rotatedAnnotationBounds)(
                  value,
                  manifest.annBox(value),
                ),
              ) && penIntersectsMarquee(value, value4)
            : lineIntersectsMarquee(value, value4);
      } else
        value2 = value3
          ? (0, runtime.rotatedRectCorner)(manifest.annBox(value), value3, rect)
          : inclusiveRectIntersects(rect, manifest.annBox(value));
      value2 && values2.add(value.id);
    }
    return {
      files: values,
      notes: values2,
    };
  }
  function penIntersectsMarquee(annotation?: Dynamic, rect?: Dynamic): Dynamic {
    let entry: Dynamic = penHitTestPointsCache.get(annotation);
    if (!entry) {
      let [items, items2]: Dynamic = [
          (0, runtime.annotationPathViewBox)(annotation.d),
          (0, runtime.annotationRotation)(annotation),
        ],
        state: Dynamic = {
          x: annotation.x + annotation.w / 2,
          y: annotation.y + annotation.h / 2,
        };
      entry = (0, runtime.parsePenPath)(annotation.d).map(
        (input?: Dynamic): Dynamic => {
          let state2: Dynamic = {
            x: annotation.x + (input.x * annotation.w) / items.w,
            y: annotation.y + (input.y * annotation.h) / items.h,
          };
          return {
            move: input.move,
            ...(items2
              ? (0, runtime.rotatePoint)(state2, state, items2)
              : state2),
          };
        },
      );
      penHitTestPointsCache.set(annotation, entry);
    }
    let value: Dynamic = null;
    for (let value2 of entry as Dynamic) {
      let value3: Dynamic = value2.move || !value ? value2 : value;
      if (
        lineIntersectsMarquee(
          {
            x: value3.x,
            y: value3.y,
            x2: value2.x,
            y2: value2.y,
          },
          rect,
        )
      )
        return true;
      value = value2;
    }
    return false;
  }
  function lineIntersectsMarquee(line?: Dynamic, rect?: Dynamic): Dynamic {
    let value: Dynamic = line.x2 - line.x,
      value2: Dynamic = line.y2 - line.y,
      index: Dynamic = 0,
      count: Dynamic = 1;
    for (let [value3, value4] of [
      [-value, line.x - rect.x],
      [value, rect.x + rect.w - line.x],
      [-value2, line.y - rect.y],
      [value2, rect.y + rect.h - line.y],
    ] as Dynamic) {
      if (value3 === 0) {
        if (value4 < 0) return false;
        continue;
      }
      value3 < 0
        ? (index = Math.max(index, value4 / value3))
        : (count = Math.min(count, value4 / value3));
      if (index > count) return false;
    }
    return true;
  }
  bindRuntimeValue(
    runtime,
    "selectionPointerDownDecision",
    () => selectionPointerDownDecision,
  );
  bindRuntimeValue(
    runtime,
    "canvasFacePointerAction",
    () => canvasFacePointerAction,
  );
  bindRuntimeValue(
    runtime,
    "shouldBeginCanvasMarquee",
    () => shouldBeginCanvasMarquee,
  );
  bindRuntimeValue(
    runtime,
    "isCanvasContextMenuPointer",
    () => isCanvasContextMenuPointer,
  );
  bindRuntimeValue(
    runtime,
    "canvasContextMenuTarget",
    () => canvasContextMenuTarget,
  );
  bindRuntimeValue(
    runtime,
    "canvasContextMenuTargetFromElement",
    () => canvasContextMenuTargetFromElement,
    (value) => {
      canvasContextMenuTargetFromElement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "shouldPassFileDropThroughOverlay",
    () => shouldPassFileDropThroughOverlay,
  );
  bindRuntimeValue(
    runtime,
    "artboardOverlayIdPrefixes",
    () => artboardOverlayIdPrefixes,
    (value) => {
      artboardOverlayIdPrefixes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "applyElementRectStyle",
    () => applyElementRectStyle,
  );
  bindRuntimeValue(
    runtime,
    "inclusiveRectIntersects",
    () => inclusiveRectIntersects,
    (value) => {
      inclusiveRectIntersects = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "expandHitTestRect",
    () => expandHitTestRect,
    (value) => {
      expandHitTestRect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "objectsWithinCanvasMarquee",
    () => objectsWithinCanvasMarquee,
  );
  bindRuntimeValue(
    runtime,
    "penHitTestPointsCache",
    () => penHitTestPointsCache,
    (value) => {
      penHitTestPointsCache = value;
    },
  );
  bindRuntimeValue(runtime, "penIntersectsMarquee", () => penIntersectsMarquee);
  bindRuntimeValue(
    runtime,
    "lineIntersectsMarquee",
    () => lineIntersectsMarquee,
  );
  return () => {
    canvasContextMenuTargetFromElement = (input?: Dynamic): Dynamic => {
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input instanceof Element
          ? input.closest("[" + input2 + "]")?.getAttribute(input2)
          : null;
      return canvasContextMenuTarget({
        object: callback("data-mega-annotation"),
        chrome: callback("data-mega-chrome"),
        file: callback("data-mega-artboard"),
        blanket: callback("data-mega-pan-blanket") != null,
      });
    };
    artboardOverlayIdPrefixes = {
      "face-overlay": "mega-artboard-face-",
      "set-overlay": "mega-artboard-set-",
      "focus-overlay": "mega-artboard-overlay-",
    };
    inclusiveRectIntersects = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input.x <= options.x + options.w &&
      options.x <= input.x + input.w &&
      input.y <= options.y + options.h &&
      options.y <= input.y + input.h;
    expandHitTestRect = (input?: Dynamic, options?: Dynamic): Dynamic => ({
      x: input.x - options,
      y: input.y - options,
      w: input.w + 2 * options,
      h: input.h + 2 * options,
    });
    penHitTestPointsCache = new WeakMap();
  };
}

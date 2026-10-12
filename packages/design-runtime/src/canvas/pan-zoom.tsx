/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPanZoom(runtime: RuntimeBindings): () => void {
  var CanvasPanZoomLimit: Dynamic;
  var CanvasPanZoomLimit_2: Dynamic;
  var CanvasPanZoomGesturestartGesturechangeGestureendValues: Dynamic;
  var CanvasPanZoomTouchstartTouchendTouchcancelValues: Dynamic;
  var CanvasPanZoomCache: Dynamic;
  var CanvasPanZoomResolvedValue: Dynamic;
  var canvasGestureActive: Dynamic;
  var CanvasPanZoomTouches: Dynamic;
  var CanvasPanZoomKeys: Dynamic;
  var CanvasPanZoomCtrlKey: Dynamic;
  var CanvasPanZoomDefaultPrevented: Dynamic;
  var CanvasPanZoomSet: Dynamic;
  var reactCanvasPanZoom: Dynamic;
  var CanvasPanZoomRound: Dynamic;
  var CanvasPanZoomScrollTop: Dynamic;
  function zoomViewportAtPoint(
    viewport?: Dynamic,
    anchorX?: Dynamic,
    anchorY?: Dynamic,
    factor?: Dynamic,
    limits?: Dynamic,
  ): Dynamic {
    let scale: Dynamic = Math.min(
      limits?.maxScale ?? 40,
      Math.max(limits?.minScale ?? 0.05, viewport.scale * factor),
    );
    if (scale === viewport.scale) return viewport;
    let worldX: Dynamic = viewport.x + anchorX / viewport.scale,
      worldY: Dynamic = viewport.y + anchorY / viewport.scale;
    return {
      x: worldX - anchorX / scale,
      y: worldY - anchorY / scale,
      scale: scale,
    };
  }
  function panViewport(
    viewport?: Dynamic,
    deltaX?: Dynamic,
    deltaY?: Dynamic,
  ): Dynamic {
    return deltaX === 0 && deltaY === 0
      ? viewport
      : {
          x: viewport.x - deltaX / viewport.scale,
          y: viewport.y - deltaY / viewport.scale,
          scale: viewport.scale,
        };
  }
  function wheelZoomFactor(input?: Dynamic): Dynamic {
    return Math.min(1.25, Math.max(0.8, Math.exp(-input * 0.01)));
  }
  function createWheelGestureDecider(input: Dynamic = 200): Dynamic {
    let value: Dynamic,
      value2: Dynamic = -1 / 0;
    return {
      decide(
        input2: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value3: Dynamic,
      ): Dynamic {
        if (options) {
          value = undefined;
          value2 = input2;
          return "zoom";
        }
        input2 - value2 > input && (value = undefined);
        value2 = input2;
        if (value === undefined) {
          if (!context) return "consume";
          value = value3() ? "native" : "pan";
        }
        return value;
      },
    };
  }
  function installCanvasPanZoom(input?: Dynamic): Dynamic {
    let element: Dynamic = input.element,
      touchAction: Dynamic = element.style.touchAction;
    element.style.touchAction = "none";
    let callback: Dynamic = (): Dynamic => {
      element.scrollLeft !== 0 && (element.scrollLeft = 0);
      element.scrollTop !== 0 && (element.scrollTop = 0);
    };
    callback();
    element.addEventListener("scroll", callback, {
      passive: true,
    });
    let entries: Dynamic = new Map(),
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        let value7: Dynamic = input2 ?? null,
          value8: Dynamic = element;
        for (; value7 && value7 !== value8; ) {
          let tagName: Dynamic = value7.tagName;
          if (
            tagName === "INPUT" ||
            tagName === "SELECT" ||
            tagName === "TEXTAREA" ||
            value7.isContentEditable === true
          )
            return true;
          if (tagName !== undefined) {
            let value9: Dynamic;
            try {
              value9 = (window as Dynamic).getComputedStyle(value7);
            } catch {
              value9 = undefined;
            }
            if (value9) {
              let value10: Dynamic =
                  (value9.overflowY === "auto" ||
                    value9.overflowY === "scroll") &&
                  (value7.scrollHeight ?? 0) > (value7.clientHeight ?? 0),
                value11: Dynamic =
                  (value9.overflowX === "auto" ||
                    value9.overflowX === "scroll") &&
                  (value7.scrollWidth ?? 0) > (value7.clientWidth ?? 0);
              if (value10 || value11) return true;
            }
          }
          value7 = value7.parentElement ?? null;
        }
        return false;
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let changedTouches: Dynamic = input2.changedTouches;
        for (
          let index2: Dynamic = 0;
          index2 < (changedTouches?.length ?? 0);
          index2++
        ) {
          let value7: Dynamic = changedTouches[index2];
          value7 && entries.set(value7.identifier, !callback2(value7.target));
        }
      },
      callback4: Dynamic = (event?: Dynamic): Dynamic => {
        if (!event.cancelable) return;
        let changedTouches: Dynamic = event.changedTouches,
          value7: Dynamic = changedTouches?.length ?? 0;
        if (value7 !== 0) {
          for (let index2: Dynamic = 0; index2 < value7; index2++) {
            let value8: Dynamic = changedTouches[index2];
            if (!value8 || entries.get(value8.identifier) !== true) return;
          }
          event.preventDefault();
        }
      },
      callback5: Dynamic = (input2?: Dynamic): Dynamic => {
        let changedTouches: Dynamic = input2.changedTouches;
        for (
          let index2: Dynamic = 0;
          index2 < (changedTouches?.length ?? 0);
          index2++
        ) {
          let value7: Dynamic = changedTouches[index2];
          value7 && entries.delete(value7.identifier);
        }
      },
      value: Dynamic = createWheelGestureDecider(),
      entries2: Dynamic = new Map(),
      value2: Dynamic,
      entries3: Dynamic = new Map(),
      value3: Dynamic,
      value4: Dynamic,
      callback6: Dynamic = (): Dynamic => {
        if (value3 !== undefined) return;
        let style: Dynamic = element.style;
        style &&
          ((value3 = style.userSelect ?? ""),
          (value4 = style.webkitUserSelect ?? ""),
          (style.webkitUserSelect = "none"),
          (style.userSelect = "none"));
      },
      callback7: Dynamic = (): Dynamic => {
        if (value3 === undefined) return;
        let style: Dynamic = element.style;
        style &&
          ((style.userSelect = value3),
          (style.webkitUserSelect = value4 ?? ""));
        value3 = undefined;
        value4 = undefined;
      },
      flag: Dynamic = false,
      index: Dynamic = 0,
      count: Dynamic = 1,
      entries4: Dynamic = new Map(),
      callback8: Dynamic = (input2?: Dynamic): Dynamic => {
        for (let [value7, value8] of entries4 as Dynamic)
          input2 - value8 > CanvasPanZoomLimit && entries4.delete(value7);
      },
      callback9: Dynamic = (): Dynamic => {
        let index2: Dynamic = 0;
        for (let value7 of entries2.values() as Dynamic)
          value7.type === "touch" && (index2 += 1);
        return index2 >= 2;
      },
      callback10: Dynamic = (input2?: Dynamic): Dynamic => {
        let index2: Dynamic = 0,
          index3: Dynamic = 0;
        for (let value7 of entries2.values() as Dynamic)
          value7.type === "touch" &&
            ((index2 += 1),
            input2 - value7.lastSeen <= CanvasPanZoomLimit && (index3 += 1));
        return index2 >= 2 && index3 >= 1;
      },
      value5: Dynamic,
      count2: Dynamic = 1,
      flag2: Dynamic = false,
      callback11: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        let bounds: Dynamic = element.getBoundingClientRect();
        return {
          sx: input2 - bounds.left,
          sy: options - bounds.top,
        };
      },
      callback12: Dynamic = (event?: Dynamic): Dynamic => {
        let value7: Dynamic = event.ctrlKey || event.metaKey;
        if (flag && event.timeStamp - index <= CanvasPanZoomLimit_2) {
          event.preventDefault();
          return;
        }
        let value8: Dynamic = value.decide(
          event.timeStamp,
          value7,
          event.deltaX !== 0 || event.deltaY !== 0,
          (): Dynamic => input.allowNativeScroll?.(event) ?? false,
        );
        if (
          value8 === "native" ||
          (event.preventDefault(), value8 === "consume")
        )
          return;
        let value9: Dynamic =
            event.deltaMode === 1
              ? 16
              : event.deltaMode === 2
                ? (window as Dynamic).innerHeight
                : 1,
          value10: Dynamic =
            event.deltaMode === 1
              ? 16
              : event.deltaMode === 2
                ? (window as Dynamic).innerWidth
                : 1;
        if (value8 === "zoom") {
          let { sx: value11, sy: value12 }: Dynamic = callback11(
            event.clientX,
            event.clientY,
          );
          input.setView(
            zoomViewportAtPoint(
              input.getView(),
              value11,
              value12,
              wheelZoomFactor(event.deltaY * value9),
              input.limits,
            ),
          );
        } else
          input.setView(
            panViewport(
              input.getView(),
              -event.deltaX * value10,
              -event.deltaY * value9,
            ),
          );
      },
      callback13: Dynamic = (): Dynamic => {
        flag2 &&
          entries2.size === 0 &&
          ((flag2 = false), callback7(), input.onGestureEnd?.());
      },
      callback14: Dynamic = (event?: Dynamic): Dynamic => {
        if (input.shouldPan) return input.shouldPan(event);
        let target: Dynamic = event.target;
        for (; target; ) {
          let tagName: Dynamic = target.tagName;
          if (
            tagName === "BUTTON" ||
            tagName === "A" ||
            tagName === "INPUT" ||
            tagName === "SELECT" ||
            tagName === "TEXTAREA" ||
            target.getAttribute?.("role") === "slider" ||
            target.hasAttribute?.("data-no-pan")
          )
            return false;
          target = target.parentElement;
        }
        return true;
      },
      callback15: Dynamic = (input2?: Dynamic): Dynamic => {
        value2 = undefined;
        if (entries2.size === 1) {
          let value7: Dynamic = entries2.values().next().value?.type,
            flag3: Dynamic = false;
          for (let [value8, value9] of entries3 as Dynamic)
            if (
              value9.type === value7 &&
              (entries3.delete(value8),
              !(input2 - value9.lastSeen > CanvasPanZoomLimit))
            ) {
              entries2.set(value8, value9);
              value5 = undefined;
              flag3 = true;
              break;
            }
          flag3 || (value5 = [...entries2.keys()][0]);
        }
        callback13();
      },
      callback16: Dynamic = (input2?: Dynamic): Dynamic => {
        entries3.delete(input2.pointerId);
        entries4.delete(input2.pointerId);
        let value7: Dynamic = entries2.delete(input2.pointerId);
        value7 && value5 === input2.pointerId && (value5 = undefined);
        let flag3: Dynamic = false;
        if (input2.isPrimary && input2.button === 0) {
          for (let [value8, value9] of entries2 as Dynamic)
            value9.type === input2.pointerType &&
              (entries2.delete(value8), (flag3 = true));
          for (let [value8, value9] of entries3 as Dynamic)
            value9.type === input2.pointerType && entries3.delete(value8);
          input2.pointerType === "touch" && entries4.clear();
          value5 !== undefined && !entries2.has(value5) && (value5 = undefined);
        }
        (value7 || flag3) && callback15(input2.timeStamp);
      },
      callback17: Dynamic = (input2?: Dynamic): Dynamic => {
        for (
          let value7: Dynamic = input2;
          value7 && value7 !== element;
          value7 = value7.parentElement ?? null
        )
          if (
            value7.tagName === "INPUT" ||
            value7.tagName === "TEXTAREA" ||
            value7.tagName === "SELECT" ||
            value7.isContentEditable === true
          )
            return true;
        return false;
      },
      callback18: Dynamic = (event?: Dynamic): Dynamic => {
        if (
          !(
            event.button !== 0 &&
            event.button !== 1 &&
            !(event.button === 2 && input.panSecondaryButton)
          ) &&
          !(event.button === 1 && callback17(event.target))
        ) {
          if (entries2.size > 0) {
            let values: Dynamic = new Set();
            for (let value8 of entries2.values() as Dynamic)
              values.add(value8.type);
            for (let value8 of values as Dynamic) {
              let flag3: Dynamic = true;
              for (let value9 of entries2.values() as Dynamic)
                if (
                  value9.type === value8 &&
                  event.timeStamp - value9.lastSeen <= CanvasPanZoomLimit
                ) {
                  flag3 = false;
                  break;
                }
              if (flag3) {
                for (let value9 of entries3.values() as Dynamic)
                  if (
                    value9.type === value8 &&
                    event.timeStamp - value9.lastSeen <= CanvasPanZoomLimit
                  ) {
                    flag3 = false;
                    break;
                  }
              }
              if (flag3 && value8 !== event.pointerType) {
                for (let [value9, value10] of entries2 as Dynamic)
                  value10.type === value8 &&
                    (entries2.delete(value9),
                    value5 === value9 && (value5 = undefined));
                for (let [value9, value10] of entries3 as Dynamic)
                  value10.type === value8 && entries3.delete(value9);
              }
            }
            callback9() || (value2 = undefined);
            callback13();
            let value7: Dynamic = entries2.values().next().value?.type;
            if (value7 !== undefined && value7 !== event.pointerType) return;
          }
          if (entries2.size === 0) {
            if (!callback14(event)) {
              event.pointerType === "touch" &&
                input.shouldPan &&
                entries4.set(event.pointerId, event.timeStamp);
              return;
            }
            value5 = event.pointerId;
            count2 = event.button === 1 ? 4 : event.button === 2 ? 2 : 1;
            event.button === 1 && event.preventDefault();
            callback6();
          } else {
            if (event.pointerType !== "touch") return;
            if (!callback14(event)) {
              input.shouldPan && entries4.set(event.pointerId, event.timeStamp);
              return;
            }
            if (entries2.size >= 2) {
              entries3.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
                type: event.pointerType,
                lastSeen: event.timeStamp,
              });
              return;
            }
            value5 = undefined;
          }
          entries2.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
            type: event.pointerType,
            lastSeen: event.timeStamp,
          });
          flag2 = true;
          try {
            element.setPointerCapture(event.pointerId);
          } catch {}
        }
      },
      callback19: Dynamic = (input2?: Dynamic): Dynamic => {
        entries4.has(input2.pointerId) &&
          entries4.set(input2.pointerId, input2.timeStamp);
        let entry: Dynamic = entries3.get(input2.pointerId);
        if (entry) {
          entries3.set(input2.pointerId, {
            x: input2.clientX,
            y: input2.clientY,
            type: entry.type,
            lastSeen: input2.timeStamp,
          });
          return;
        }
        let entry2: Dynamic = entries2.get(input2.pointerId);
        if (entry2) {
          if (
            input2.pointerType !== "touch" &&
            (input2.buttons & count2) === 0
          ) {
            callback20(input2);
            return;
          }
          if (entries2.size === 2) {
            let value7: Dynamic = [...entries2.entries()].find(
              ([input3]: Dynamic): Dynamic => input3 !== input2.pointerId,
            );
            if (value7) {
              let [, value8]: Dynamic = value7,
                value9: Dynamic = Math.hypot(
                  input2.clientX - value8.x,
                  input2.clientY - value8.y,
                ),
                state: Dynamic = {
                  x: (entry2.x + value8.x) / 2,
                  y: (entry2.y + value8.y) / 2,
                },
                state2: Dynamic = {
                  x: (input2.clientX + value8.x) / 2,
                  y: (input2.clientY + value8.y) / 2,
                };
              (!value2 || value2.dist <= 0) &&
                (value2 = {
                  dist: Math.hypot(entry2.x - value8.x, entry2.y - value8.y),
                  scale: input.getView().scale,
                });
              let value10: Dynamic = panViewport(
                input.getView(),
                state2.x - state.x,
                state2.y - state.y,
              );
              if (value2.dist > 0 && value9 > 0) {
                let value11: Dynamic = value2.scale * (value9 / value2.dist);
                if (value11 !== value10.scale) {
                  let { sx: value12, sy: value13 }: Dynamic = callback11(
                    state2.x,
                    state2.y,
                  );
                  value10 = zoomViewportAtPoint(
                    value10,
                    value12,
                    value13,
                    value11 / value10.scale,
                    input.limits,
                  );
                }
              }
              input.setView(value10);
            }
          } else
            input2.pointerId === value5 &&
              input.setView(
                panViewport(
                  input.getView(),
                  input2.clientX - entry2.x,
                  input2.clientY - entry2.y,
                ),
              );
          entries2.set(input2.pointerId, {
            x: input2.clientX,
            y: input2.clientY,
            type: entry2.type,
            lastSeen: input2.timeStamp,
          });
        }
      },
      callback20: Dynamic = (input2?: Dynamic): Dynamic => {
        entries4.delete(input2.pointerId);
        entries3.delete(input2.pointerId);
        entries2.has(input2.pointerId) &&
          (entries2.delete(input2.pointerId),
          input2.pointerId === value5 && (value5 = undefined),
          callback15(input2.timeStamp));
      },
      callback21: Dynamic = (event?: Dynamic): Dynamic => {
        event.preventDefault();
        flag = true;
        index = typeof event.timeStamp == "number" ? event.timeStamp : 0;
        count = input.getView().scale;
        value.decide(
          typeof event.timeStamp == "number" ? event.timeStamp : 0,
          true,
          true,
          (): Dynamic => false,
        );
      },
      callback22: Dynamic = (event?: Dynamic): Dynamic => {
        event.preventDefault();
        if (!flag || !event.scale) return;
        index = typeof event.timeStamp == "number" ? event.timeStamp : 0;
        callback8(index);
        if (callback10(index) || entries4.size > 0) {
          count = input.getView().scale / event.scale;
          return;
        }
        let value7: Dynamic = input.getView(),
          value8: Dynamic = count * event.scale;
        if (value8 === value7.scale) return;
        let { sx: value9, sy: value10 }: Dynamic = callback11(
          event.clientX ?? 0,
          event.clientY ?? 0,
        );
        input.setView(
          zoomViewportAtPoint(
            value7,
            value9,
            value10,
            value8 / value7.scale,
            input.limits,
          ),
        );
      },
      callback23: Dynamic = (event?: Dynamic): Dynamic => {
        event.preventDefault();
        flag = false;
      },
      callback24: Dynamic = (event?: Dynamic): Dynamic => {
        (value5 !== undefined || entries2.size > 0) && event.preventDefault();
      },
      callback25: Dynamic = (event?: Dynamic): Dynamic => {
        event.button === 1 &&
          value5 !== undefined &&
          count2 === 4 &&
          event.preventDefault();
      };
    element.addEventListener("dragstart", callback24);
    element.addEventListener("mousedown", callback25);
    element.addEventListener("touchstart", callback3, {
      passive: true,
    });
    element.addEventListener("touchmove", callback4, {
      passive: false,
    });
    element.addEventListener("touchend", callback5, {
      passive: true,
    });
    element.addEventListener("touchcancel", callback5, {
      passive: true,
    });
    element.addEventListener("wheel", callback12, {
      passive: false,
    });
    (window as Dynamic).addEventListener("pointerdown", callback16, true);
    element.addEventListener("pointerdown", callback18);
    element.addEventListener("gesturestart", callback21, {
      passive: false,
    });
    element.addEventListener("gesturechange", callback22, {
      passive: false,
    });
    element.addEventListener("gestureend", callback23, {
      passive: false,
    });
    (window as Dynamic).addEventListener("pointermove", callback19);
    (window as Dynamic).addEventListener("pointerup", callback20);
    (window as Dynamic).addEventListener("pointercancel", callback20);
    let value6: Dynamic = CanvasPanZoomSet(element, {
      gesturestart: callback21,
      gesturechange: callback22,
      gestureend: callback23,
    });
    return {
      release(input2: Dynamic): Dynamic {
        let entry: Dynamic = entries2.get(input2);
        if (entry === undefined || entries2.size !== 1 || entries3.size > 0)
          return false;
        entries2.delete(input2);
        input2 === value5 && (value5 = undefined);
        try {
          element.releasePointerCapture(input2);
        } catch {}
        callback15(entry.lastSeen);
        return true;
      },
      destroy(): Dynamic {
        value6();
        element.removeEventListener("scroll", callback);
        element.removeEventListener("dragstart", callback24);
        element.removeEventListener("mousedown", callback25);
        element.removeEventListener("touchstart", callback3);
        element.removeEventListener("touchmove", callback4);
        element.removeEventListener("touchend", callback5);
        element.removeEventListener("touchcancel", callback5);
        element.removeEventListener("wheel", callback12);
        (window as Dynamic).removeEventListener(
          "pointerdown",
          callback16,
          true,
        );
        element.removeEventListener("pointerdown", callback18);
        element.removeEventListener("gesturestart", callback21);
        element.removeEventListener("gesturechange", callback22);
        element.removeEventListener("gestureend", callback23);
        (window as Dynamic).removeEventListener("pointermove", callback19);
        (window as Dynamic).removeEventListener("pointerup", callback20);
        (window as Dynamic).removeEventListener("pointercancel", callback20);
        entries4.clear();
        entries3.clear();
        entries.clear();
        callback7();
        element.style.touchAction = touchAction;
      },
    };
  }
  bindRuntimeValue(runtime, "zoomViewportAtPoint", () => zoomViewportAtPoint);
  bindRuntimeValue(runtime, "panViewport", () => panViewport);
  bindRuntimeValue(runtime, "wheelZoomFactor", () => wheelZoomFactor);
  bindRuntimeValue(
    runtime,
    "createWheelGestureDecider",
    () => createWheelGestureDecider,
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomLimit",
    () => CanvasPanZoomLimit,
    (value) => {
      CanvasPanZoomLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomLimit_2",
    () => CanvasPanZoomLimit_2,
    (value) => {
      CanvasPanZoomLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomGesturestartGesturechangeGestureendValues",
    () => CanvasPanZoomGesturestartGesturechangeGestureendValues,
    (value) => {
      CanvasPanZoomGesturestartGesturechangeGestureendValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomTouchstartTouchendTouchcancelValues",
    () => CanvasPanZoomTouchstartTouchendTouchcancelValues,
    (value) => {
      CanvasPanZoomTouchstartTouchendTouchcancelValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomCache",
    () => CanvasPanZoomCache,
    (value) => {
      CanvasPanZoomCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomResolvedValue",
    () => CanvasPanZoomResolvedValue,
    (value) => {
      CanvasPanZoomResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasGestureActive",
    () => canvasGestureActive,
    (value) => {
      canvasGestureActive = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomTouches",
    () => CanvasPanZoomTouches,
    (value) => {
      CanvasPanZoomTouches = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomKeys",
    () => CanvasPanZoomKeys,
    (value) => {
      CanvasPanZoomKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomCtrlKey",
    () => CanvasPanZoomCtrlKey,
    (value) => {
      CanvasPanZoomCtrlKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomDefaultPrevented",
    () => CanvasPanZoomDefaultPrevented,
    (value) => {
      CanvasPanZoomDefaultPrevented = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomSet",
    () => CanvasPanZoomSet,
    (value) => {
      CanvasPanZoomSet = value;
    },
  );
  bindRuntimeValue(runtime, "installCanvasPanZoom", () => installCanvasPanZoom);
  bindRuntimeValue(
    runtime,
    "reactCanvasPanZoom",
    () => reactCanvasPanZoom,
    (value) => {
      reactCanvasPanZoom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomRound",
    () => CanvasPanZoomRound,
    (value) => {
      CanvasPanZoomRound = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPanZoomScrollTop",
    () => CanvasPanZoomScrollTop,
    (value) => {
      CanvasPanZoomScrollTop = value;
    },
  );
  return () => {
    CanvasPanZoomLimit = 1e4;
    CanvasPanZoomLimit_2 = 1e3;
    CanvasPanZoomGesturestartGesturechangeGestureendValues = [
      "gesturestart",
      "gesturechange",
      "gestureend",
    ];
    CanvasPanZoomTouchstartTouchendTouchcancelValues = [
      "touchstart",
      "touchend",
      "touchcancel",
    ];
    CanvasPanZoomCache = new Map();
    CanvasPanZoomResolvedValue = 0;
    canvasGestureActive = false;
    CanvasPanZoomTouches = (input?: Dynamic): Dynamic => {
      CanvasPanZoomResolvedValue = input.touches?.length ?? 0;
    };
    CanvasPanZoomKeys = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let value: Dynamic;
      if (input === undefined || options === undefined) return value;
      for (let value2 of CanvasPanZoomCache.keys() as Dynamic) {
        if (value2.closest("[inert]") || value2.checkVisibility?.() === false)
          continue;
        let bounds: Dynamic = value2.getBoundingClientRect();
        input >= bounds.left &&
          input < bounds.right &&
          options >= bounds.top &&
          options < bounds.bottom &&
          (value = value2);
      }
      return value;
    };
    CanvasPanZoomCtrlKey = (event?: Dynamic): Dynamic => {
      if (
        !event.ctrlKey ||
        !event.cancelable ||
        event.defaultPrevented ||
        canvasGestureActive
      )
        return;
      let value: Dynamic = CanvasPanZoomKeys(event.clientX, event.clientY);
      if (!value) return;
      event.preventDefault();
      let value2: Dynamic = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
      canvasGestureActive = true;
      try {
        value.dispatchEvent(value2);
      } finally {
        canvasGestureActive = false;
      }
    };
    CanvasPanZoomDefaultPrevented = (event?: Dynamic): Dynamic => {
      if (event.defaultPrevented || CanvasPanZoomResolvedValue > 0) return;
      let value: Dynamic = event,
        value2: Dynamic = CanvasPanZoomKeys(value.clientX, value.clientY);
      value2 &&
        (event.preventDefault(),
        CanvasPanZoomCache.get(value2)?.[event.type](value));
    };
    CanvasPanZoomSet = (input?: Dynamic, options?: Dynamic): Dynamic => {
      CanvasPanZoomCache.set(input, options);
      (window as Dynamic).addEventListener("wheel", CanvasPanZoomCtrlKey, {
        passive: false,
      });
      for (let value of CanvasPanZoomGesturestartGesturechangeGestureendValues as Dynamic)
        (window as Dynamic).addEventListener(
          value,
          CanvasPanZoomDefaultPrevented,
          {
            passive: false,
          },
        );
      for (let value of CanvasPanZoomTouchstartTouchendTouchcancelValues as Dynamic)
        (window as Dynamic).addEventListener(value, CanvasPanZoomTouches, {
          capture: true,
          passive: true,
        });
      return (): Dynamic => {
        CanvasPanZoomCache.get(input) === options &&
          CanvasPanZoomCache.delete(input);
        if (!(CanvasPanZoomCache.size > 0)) {
          (window as Dynamic).removeEventListener(
            "wheel",
            CanvasPanZoomCtrlKey,
          );
          for (let value of CanvasPanZoomGesturestartGesturechangeGestureendValues as Dynamic)
            (window as Dynamic).removeEventListener(
              value,
              CanvasPanZoomDefaultPrevented,
            );
          for (let value of CanvasPanZoomTouchstartTouchendTouchcancelValues as Dynamic)
            (window as Dynamic).removeEventListener(
              value,
              CanvasPanZoomTouches,
              true,
            );
        }
      };
    };
    reactCanvasPanZoom = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    CanvasPanZoomRound = (input?: Dynamic): Dynamic =>
      Math.round(input * (0, runtime.PlatformFileContentMin)(input).lh * 1.25);
    CanvasPanZoomScrollTop = (input?: Dynamic): Dynamic => ({
      above: input.scrollTop > 1,
      below: input.scrollTop + input.clientHeight < input.scrollHeight - 1,
    });
    (0, runtime.initializeCdsIndex)();
  };
}

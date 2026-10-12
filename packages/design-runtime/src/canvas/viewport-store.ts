/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasViewportStore(
  runtime: RuntimeBindings,
): () => void {
  var CanvasViewportStoreConstant: Dynamic;
  var CanvasViewportStoreMatches: Dynamic;
  var animateViewportZoom: Dynamic;
  var createViewportStoreValue: Dynamic;
  var ViewportContext: Dynamic;
  function previewZoomDuration(input?: Dynamic): Dynamic {
    return Math.round(Math.min(900, Math.max(300, 18 * Math.sqrt(input))));
  }
  function isArtboardInViewport(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let { w: value, top: value2 }: Dynamic = context,
      value3: Dynamic = context.h - value2,
      value4: Dynamic = input.y + value2 / input.scale,
      value5: Dynamic = options.x + options.w / 2,
      value6: Dynamic = options.y + options.h / 2;
    return (
      options.w <= value / input.scale && options.h <= value3 / input.scale
        ? options.x >= input.x &&
          options.x + options.w <= input.x + value / input.scale &&
          options.y >= value4 &&
          options.y + options.h <= value4 + value3 / input.scale
        : value5 >= input.x &&
          value5 <= input.x + value / input.scale &&
          value6 >= value4 &&
          value6 <= value4 + value3 / input.scale
    )
      ? input
      : {
          ...input,
          x: value5 - value / input.scale / 2,
          y: value6 - value2 / input.scale - value3 / input.scale / 2,
        };
  }
  function viewportTransformCss(input?: Dynamic): Dynamic {
    return (
      "translate(" +
      String(-input.x * input.scale) +
      "px, " +
      String(-input.y * input.scale) +
      "px) scale(" +
      String(input.scale) +
      ")"
    );
  }
  function sameViewport(left?: Dynamic, right?: Dynamic): Dynamic {
    return (
      left === right ||
      (left.x === right.x && left.y === right.y && left.scale === right.scale)
    );
  }
  function viewportAnimationEasing(input?: Dynamic): Dynamic {
    if (input <= 0 || input >= 1) return Math.min(1, Math.max(0, input));
    let index: Dynamic = 0,
      count: Dynamic = 1,
      value: Dynamic = input;
    for (let index2: Dynamic = 0; index2 < 12; index2++) {
      value = (index + count) / 2;
      3 * value * (1 - value) * 0.25 + value ** 3 < input
        ? (index = value)
        : (count = value);
    }
    return 3 * value * (1 - value) * ((1 - value) * 0.1 + value) + value ** 3;
  }
  function interpolateViewport(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.scale + (options.scale - input.scale) * context,
      value2: Dynamic =
        input.x * input.scale +
        (options.x * options.scale - input.x * input.scale) * context,
      value3: Dynamic =
        input.y * input.scale +
        (options.y * options.scale - input.y * input.scale) * context;
    return {
      x: value2 / value,
      y: value3 / value,
      scale: value,
    };
  }
  function createViewportStore(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = CanvasViewportStoreConstant,
    value: Dynamic = animateViewportZoom,
    extra: Dynamic = previewZoomDuration,
  ): Dynamic {
    let value2: Dynamic = input,
      value3: Dynamic = input,
      value4: Dynamic = input,
      value5: Dynamic = null,
      value6: Dynamic,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      value7: Dynamic = null,
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        input2.style.setProperty("--mega-scale", String(value2.scale));
        input2.style.setProperty("--mega-inv-scale", String(1 / value2.scale));
      },
      callback2: Dynamic = (): Dynamic => {
        let value8: Dynamic = value3;
        if (!sameViewport(value2, value8)) {
          value3 = value2;
          value5 && (value5.style.transform = viewportTransformCss(value2));
          if (value2.scale !== value8.scale)
            for (let value9 of values2 as Dynamic) callback(value9);
          for (let value9 of values as Dynamic) value9(value2, value8);
        }
      },
      callback3: Dynamic = (): Dynamic => {
        index = 0;
        callback2();
      },
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        clearTimeout(value6);
        value6 = undefined;
        value5 && (value5.style.willChange = "");
        !sameViewport(value4, value2) &&
          ((value4 = value2), options(value2, input2));
      },
      callback5: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value8: Dynamic = value2,
          value9: Dynamic =
            typeof input2 == "function" ? input2(value8) : input2;
        sameViewport(value9, value8) || (value2 = value9);
        if (options2) {
          let value10: Dynamic = !sameViewport(value4, value2);
          callback4(true);
          value10 || callback2();
          return;
        }
        (sameViewport(value2, value4) && sameViewport(value2, value3)) ||
          (value &&
            value5 &&
            value6 === undefined &&
            (value5.style.willChange = "transform"),
          index || (callback2(), (index = requestAnimationFrame(callback3))),
          clearTimeout(value6),
          (value6 = setTimeout((): Dynamic => {
            callback2();
            callback4(false);
          }, context)));
      },
      callback6: Dynamic = (): Dynamic => {
        index2 && cancelAnimationFrame(index2);
        index2 = 0;
        value7 = null;
      };
    return {
      get: (): Dynamic => value2,
      rest: (): Dynamic => value7 ?? value2,
      set(input2: Dynamic, options2: Dynamic = false): Dynamic {
        callback6();
        callback5(input2, options2);
      },
      glide(input2: Dynamic): Dynamic {
        callback6();
        let value8: Dynamic = value2,
          value9: Dynamic =
            typeof input2 == "function" ? input2(value8) : input2,
          value10: Dynamic = Math.hypot(
            value9.x * value9.scale - value8.x * value8.scale,
            value9.y * value9.scale - value8.y * value8.scale,
          ),
          value11: Dynamic = CanvasViewportStoreMatches() ? 0 : extra(value10);
        if (value11 <= 0 || sameViewport(value9, value8)) {
          callback5(value9, true);
          return;
        }
        value7 = value9;
        let value12: Dynamic,
          callback7: Dynamic = (input3?: Dynamic): Dynamic => {
            value12 ??= input3;
            let value13: Dynamic = Math.min(
              1,
              Math.max(0, (input3 - value12) / value11),
            );
            index2 = value13 < 1 ? requestAnimationFrame(callback7) : 0;
            value13 >= 1 && (value7 = null);
            callback5(
              value13 < 1
                ? interpolateViewport(
                    value8,
                    value9,
                    viewportAnimationEasing(value13),
                  )
                : value9,
              value13 >= 1,
            );
          };
        index2 = requestAnimationFrame(callback7);
      },
      settle(): Dynamic {
        value6 !== undefined && (callback2(), callback4(true));
      },
      halt(): Dynamic {
        let value8: Dynamic = index2 !== 0;
        callback6();
        !(!value8 && value6 === undefined) && (callback2(), callback4(true));
      },
      subscribe(input2: Dynamic): Dynamic {
        values.add(input2);
        return (): Dynamic => {
          values.delete(input2);
        };
      },
      attach(input2: Dynamic): Dynamic {
        value5 = input2;
        if (value5) {
          value5.style.transform = viewportTransformCss(value2);
          value3 = value2;
          return;
        }
        callback6();
        clearTimeout(value6);
        value6 = undefined;
        index && cancelAnimationFrame(index);
        index = 0;
      },
      stamp(input2: Dynamic): Dynamic {
        if (input2) {
          values2.add(input2);
          callback(input2);
          return (): Dynamic => {
            values2.delete(input2);
          };
        }
      },
      paint: callback2,
    };
  }
  function useViewportStore(): Dynamic {
    return (
      (0, runtime.reactCanvasPreviewMounting.useContext)(ViewportContext) ??
      createViewportStoreValue
    );
  }
  function useViewport(input: Dynamic = true, options?: Dynamic): Dynamic {
    let value: Dynamic = useViewportStore(),
      value2: Dynamic = options ?? value,
      value3: Dynamic = (0, runtime.reactCanvasPreviewMounting.useRef)(null),
      callback: Dynamic = (): Dynamic => (
        (input || value3.current === null) && (value3.current = value2.get()),
        value3.current
      );
    return (0, runtime.reactCanvasPreviewMounting.useSyncExternalStore)(
      value2.subscribe,
      callback,
      callback,
    );
  }
  function useViewportScale(input: Dynamic = true): Dynamic {
    let value: Dynamic = useViewportStore(),
      value2: Dynamic = (0, runtime.reactCanvasPreviewMounting.useRef)(null),
      callback: Dynamic = (): Dynamic => (
        (input || value2.current === null) &&
          (value2.current = value.get().scale),
        value2.current
      );
    return (0, runtime.reactCanvasPreviewMounting.useSyncExternalStore)(
      value.subscribe,
      callback,
      callback,
    );
  }
  function useViewportMinScale(input?: Dynamic): Dynamic {
    let value: Dynamic = useViewportStore(),
      callback: Dynamic = (): Dynamic => value.get().scale >= input;
    return (0, runtime.reactCanvasPreviewMounting.useSyncExternalStore)(
      value.subscribe,
      callback,
      callback,
    );
  }
  function ViewportScale({ children: children }: Dynamic): Dynamic {
    return children(useViewportScale());
  }
  function ViewportScaleThreshold({
    min: min2,
    children: children,
  }: Dynamic): Dynamic {
    return children(useViewportMinScale(min2));
  }
  bindRuntimeValue(
    runtime,
    "CanvasViewportStoreConstant",
    () => CanvasViewportStoreConstant,
    (value) => {
      CanvasViewportStoreConstant = value;
    },
  );
  bindRuntimeValue(runtime, "previewZoomDuration", () => previewZoomDuration);
  bindRuntimeValue(
    runtime,
    "CanvasViewportStoreMatches",
    () => CanvasViewportStoreMatches,
    (value) => {
      CanvasViewportStoreMatches = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animateViewportZoom",
    () => animateViewportZoom,
    (value) => {
      animateViewportZoom = value;
    },
  );
  bindRuntimeValue(runtime, "isArtboardInViewport", () => isArtboardInViewport);
  bindRuntimeValue(runtime, "viewportTransformCss", () => viewportTransformCss);
  bindRuntimeValue(runtime, "sameViewport", () => sameViewport);
  bindRuntimeValue(
    runtime,
    "viewportAnimationEasing",
    () => viewportAnimationEasing,
  );
  bindRuntimeValue(runtime, "interpolateViewport", () => interpolateViewport);
  bindRuntimeValue(runtime, "createViewportStore", () => createViewportStore);
  bindRuntimeValue(
    runtime,
    "createViewportStoreValue",
    () => createViewportStoreValue,
    (value) => {
      createViewportStoreValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ViewportContext",
    () => ViewportContext,
    (value) => {
      ViewportContext = value;
    },
  );
  bindRuntimeValue(runtime, "useViewportStore", () => useViewportStore);
  bindRuntimeValue(runtime, "useViewport", () => useViewport);
  bindRuntimeValue(runtime, "useViewportScale", () => useViewportScale);
  bindRuntimeValue(runtime, "useViewportMinScale", () => useViewportMinScale);
  bindRuntimeValue(runtime, "ViewportScale", () => ViewportScale);
  bindRuntimeValue(
    runtime,
    "ViewportScaleThreshold",
    () => ViewportScaleThreshold,
  );
  return () => {
    CanvasViewportStoreConstant = 120;
    CanvasViewportStoreMatches = (): Dynamic =>
      typeof matchMedia == "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    animateViewportZoom = !(0, runtime.getDevicePreviewCapabilities)()
      .coarsePointer;
    createViewportStoreValue = createViewportStore(
      {
        x: 0,
        y: 0,
        scale: 1,
      },
      (): Dynamic => {},
    );
    ViewportContext = (0, runtime.reactCanvasPreviewMounting.createContext)(
      null,
    );
  };
}

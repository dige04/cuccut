/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPreviewMounting(
  runtime: RuntimeBindings,
): () => void {
  var reactCanvasPreviewMounting: Dynamic;
  var CanvasPreviewMountingConstant: Dynamic;
  var CanvasPreviewMountingConstant_2: Dynamic;
  function getDevicePreviewCapabilities(): Dynamic {
    if (typeof window === "undefined")
      return {
        coarsePointer: false,
        shortSide: 1 / 0,
        ios: false,
      };
    let value: Dynamic =
        (window as Dynamic).matchMedia?.("(pointer: coarse)")?.matches === true,
      screen: Dynamic = (window as Dynamic).screen,
      value2: Dynamic =
        screen && screen.width > 0 && screen.height > 0
          ? Math.min(screen.width, screen.height)
          : 1 / 0,
      value3: Dynamic = typeof navigator !== "undefined" ? navigator : null,
      value4: Dynamic =
        value3 != null &&
        (/iPad|iPhone|iPod/.test(value3.userAgent) ||
          (value3.platform === "MacIntel" && (value3.maxTouchPoints ?? 0) > 1));
    return {
      coarsePointer: value,
      shortSide: value2,
      ios: value4,
    };
  }
  function isSmallTouchDevice(
    input: Dynamic = getDevicePreviewCapabilities(),
  ): Dynamic {
    return input.coarsePointer && input.shortSide < 768;
  }
  function maxInteractivePreviews(
    input: Dynamic = getDevicePreviewCapabilities(),
  ): Dynamic {
    return input.coarsePointer ? (isSmallTouchDevice(input) ? 3 : 6) : 10;
  }
  function maxMountedPreviews(
    input: Dynamic = getDevicePreviewCapabilities(),
  ): Dynamic {
    return input.coarsePointer || input.ios === true
      ? maxInteractivePreviews(input)
      : 40;
  }
  function distanceBetweenRects(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = Math.max(
        0,
        input.x - (options.x + options.w),
        options.x - (input.x + input.w),
      ),
      value2: Dynamic = Math.max(
        0,
        input.y - (options.y + options.h),
        options.y - (input.y + input.h),
      );
    return Math.hypot(value, value2);
  }
  function distanceBetweenRectCenters(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return Math.hypot(
      input.x + input.w / 2 - (options.x + options.w / 2),
      input.y + input.h / 2 - (options.y + options.h / 2),
    );
  }
  function chooseMountedPreviews(input?: Dynamic): Dynamic {
    let value: Dynamic = Math.max(0, Math.floor(input.cap ?? 10)),
      value2: Dynamic = Math.max(
        value,
        Math.floor(input.ceiling ?? value) || 0,
      ),
      value3: Dynamic = value2 > value,
      viewport: Dynamic = input.viewport,
      entries: Dynamic = new Map();
    for (let value8 of input.artboards as Dynamic)
      entries.set(value8.file, value8);
    let values: Dynamic = new Set(),
      areaBudget: Dynamic = input.areaBudget;
    if (entries.size <= value && areaBudget == null) {
      for (let value8 of entries.keys() as Dynamic) values.add(value8);
      return values;
    }
    let values2: Dynamic = new Set();
    for (let value8 of (input.required ?? []) as Dynamic)
      value8 != null && entries.has(value8) && values2.add(value8);
    for (let value8 of input.artboards as Dynamic)
      distanceBetweenRects(value8, viewport) === 0 && values2.add(value8.file);
    let value4: Dynamic = Math.min(value2, Math.max(value, values2.size)),
      value5: Dynamic = input.now ?? 0,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input.current?.has(input2) === true &&
        (input.lastOnScreen == null ||
          value5 - (input.lastOnScreen.get(input2) ?? -1 / 0) < 18e4),
      index: Dynamic = 0,
      callback2: Dynamic = (
        input2?: Dynamic,
        options: Dynamic = false,
      ): Dynamic => {
        let value8: Dynamic = input2 == null ? undefined : entries.get(input2);
        input2 == null ||
          value8 === undefined ||
          values.has(input2) ||
          (!options &&
            areaBudget != null &&
            index + value8.w * value8.h > areaBudget) ||
          ((values.size < value4 ||
            (values.size < value2 && callback(input2))) &&
            (values.add(input2), (index += value8.w * value8.h)));
      };
    for (let value8 of (input.required ?? []) as Dynamic)
      callback2(value8, true);
    for (let value8 of (input.recent ?? []) as Dynamic) {
      let entry: Dynamic = entries.get(value8);
      entry && distanceBetweenRects(entry, viewport) === 0 && callback2(value8);
    }
    let value6: Dynamic =
        CanvasPreviewMountingConstant_2 * Math.min(viewport.w, viewport.h),
      callback3: Dynamic = (input2?: Dynamic): Dynamic =>
        value3
          ? input.zoomed === true
            ? input2
            : Math.max(0, input2 - value6)
          : input2 * CanvasPreviewMountingConstant,
      value7: Dynamic = input.artboards
        .filter((input2?: Dynamic): Dynamic => !values.has(input2.file))
        .map((input2?: Dynamic): Dynamic => {
          let value8: Dynamic = distanceBetweenRects(input2, viewport),
            value9: Dynamic =
              value8 === 0 && input.current?.has(input2.file) === true;
          return {
            file: input2.file,
            gap: value8,
            centre: value9
              ? callback3(distanceBetweenRectCenters(input2, viewport))
              : distanceBetweenRectCenters(input2, viewport),
          };
        })
        .sort(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            input2.gap - options.gap || input2.centre - options.centre,
        );
    for (let value8 of value7 as Dynamic)
      (areaBudget == null ||
        value8.gap === 0 ||
        (value8.gap <= value6 && input.current?.has(value8.file) === true)) &&
        callback2(value8.file);
    return values;
  }
  function shouldDelayPreviewMount(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return !options.editing || options.runsNothing || input.w * input.h > 15e5;
  }
  function limitMountedPreviewPixels(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = context.find(
          (input3?: Dynamic): Dynamic => input3.file === input2,
        );
        return value4 && value4.w * value4.h;
      },
      value2: Dynamic = input.filter(
        (input2?: Dynamic): Dynamic => callback(input2) !== undefined,
      ),
      value3: Dynamic = value2.reduce(
        (input2?: Dynamic, options2?: Dynamic): Dynamic =>
          input2 + callback(options2),
        0,
      );
    for (let value4 of options as Dynamic) {
      let value5: Dynamic =
        value4 == null || value2.includes(value4)
          ? undefined
          : callback(value4);
      value5 === undefined ||
        value3 + value5 > value ||
        (value2.push(value4), (value3 += value5));
    }
    return value2;
  }
  function isPreviewHighlighted(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return input === options || (context?.has(input) ?? false);
  }
  function previewScaleChanged(input?: Dynamic, options?: Dynamic): Dynamic {
    return input != null && Math.abs(options / input - 1) > 0.05;
  }
  function recordVisiblePreviewTimes(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    for (let value2 of options as Dynamic)
      (distanceBetweenRects(value2, context) === 0 ||
        (value != null && distanceBetweenRects(value2, value) === 0)) &&
        input.set(value2.file, extra);
  }
  function nextPreviewExpiry(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = null;
    for (let value3 of options as Dynamic) {
      let entry: Dynamic = value.get(value3.file);
      !input.has(value3.file) ||
        entry == null ||
        entry + 18e4 <= extra ||
        distanceBetweenRects(value3, context) === 0 ||
        ((value2 == null || entry + 18e4 < value2) && (value2 = entry + 18e4));
    }
    return value2;
  }
  function previewMountPriority(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = distanceBetweenRects(input, options);
    return value === 0
      ? distanceBetweenRectCenters(input, options)
      : 1e9 + value;
  }
  function samePreviewFiles(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input.size !== options.size) return false;
    for (let value of input as Dynamic) if (!options.has(value)) return false;
    return true;
  }
  bindRuntimeValue(
    runtime,
    "reactCanvasPreviewMounting",
    () => reactCanvasPreviewMounting,
    (value) => {
      reactCanvasPreviewMounting = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getDevicePreviewCapabilities",
    () => getDevicePreviewCapabilities,
  );
  bindRuntimeValue(runtime, "isSmallTouchDevice", () => isSmallTouchDevice);
  bindRuntimeValue(
    runtime,
    "maxInteractivePreviews",
    () => maxInteractivePreviews,
  );
  bindRuntimeValue(runtime, "maxMountedPreviews", () => maxMountedPreviews);
  bindRuntimeValue(
    runtime,
    "CanvasPreviewMountingConstant",
    () => CanvasPreviewMountingConstant,
    (value) => {
      CanvasPreviewMountingConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasPreviewMountingConstant_2",
    () => CanvasPreviewMountingConstant_2,
    (value) => {
      CanvasPreviewMountingConstant_2 = value;
    },
  );
  bindRuntimeValue(runtime, "distanceBetweenRects", () => distanceBetweenRects);
  bindRuntimeValue(
    runtime,
    "distanceBetweenRectCenters",
    () => distanceBetweenRectCenters,
  );
  bindRuntimeValue(
    runtime,
    "chooseMountedPreviews",
    () => chooseMountedPreviews,
  );
  bindRuntimeValue(
    runtime,
    "shouldDelayPreviewMount",
    () => shouldDelayPreviewMount,
  );
  bindRuntimeValue(
    runtime,
    "limitMountedPreviewPixels",
    () => limitMountedPreviewPixels,
  );
  bindRuntimeValue(runtime, "isPreviewHighlighted", () => isPreviewHighlighted);
  bindRuntimeValue(runtime, "previewScaleChanged", () => previewScaleChanged);
  bindRuntimeValue(
    runtime,
    "recordVisiblePreviewTimes",
    () => recordVisiblePreviewTimes,
  );
  bindRuntimeValue(runtime, "nextPreviewExpiry", () => nextPreviewExpiry);
  bindRuntimeValue(runtime, "previewMountPriority", () => previewMountPriority);
  bindRuntimeValue(runtime, "samePreviewFiles", () => samePreviewFiles);
  return () => {
    reactCanvasPreviewMounting = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    CanvasPreviewMountingConstant = 0.7;
    CanvasPreviewMountingConstant_2 = 0.15;
  };
}

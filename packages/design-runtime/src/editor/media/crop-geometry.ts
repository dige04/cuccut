/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorMediaCropGeometry(
  runtime: RuntimeBindings,
): () => void {
  var defaultImageCrop: Dynamic;
  var MediaCropGeometryConstant: Dynamic;
  var MediaCropGeometryMin: Dynamic;
  var MediaCropGeometryHandler: Dynamic;
  var MediaCropGeometryLimit: Dynamic;
  var sameImageCrop: Dynamic;
  var cropCoverScale: Dynamic;
  var imageCropZoomLimit: Dynamic;
  function normalizeImageCrop(input?: Dynamic): Dynamic {
    if (input === null || typeof input != "object") return;
    let value: Dynamic = input,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof value[input2] == "number" && Number.isFinite(value[input2])
          ? value[input2]
          : null,
      [items, items2, items3]: Dynamic = [
        callback("zoom"),
        callback("x"),
        callback("y"),
      ];
    if (items === null || items2 === null || items3 === null) return;
    let state: Dynamic = {
      zoom: MediaCropGeometryHandler(
        MediaCropGeometryMin(items, 1, MediaCropGeometryConstant),
        4,
      ),
      x: MediaCropGeometryHandler(MediaCropGeometryMin(items2, 0, 1), 5),
      y: MediaCropGeometryHandler(MediaCropGeometryMin(items3, 0, 1), 5),
    };
    return sameImageCrop(state, defaultImageCrop) ? undefined : state;
  }
  function imageCropRect(
    frame?: Dynamic,
    natural?: Dynamic,
    crop?: Dynamic,
  ): Dynamic {
    let scale: Dynamic = cropCoverScale(frame, natural) * crop.zoom,
      [items, items2]: Dynamic = [natural.w * scale, natural.h * scale];
    return {
      x: (frame.w - items) * crop.x + 0,
      y: (frame.h - items2) * crop.y + 0,
      w: items,
      h: items2,
    };
  }
  function cropFromImageRect(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = imageCropZoomLimit(value),
  ): Dynamic {
    let value2: Dynamic = MediaCropGeometryMin(
        context.w / (options.w * cropCoverScale(input, options)),
        1,
        extra,
      ),
      value3: Dynamic = cropCoverScale(input, options) * value2,
      [items, items2]: Dynamic = [
        options.w * value3 - input.w,
        options.h * value3 - input.h,
      ];
    return {
      zoom: value2,
      x:
        items > MediaCropGeometryLimit
          ? MediaCropGeometryMin(-context.x / items, 0, 1)
          : value.x,
      y:
        items2 > MediaCropGeometryLimit
          ? MediaCropGeometryMin(-context.y / items2, 0, 1)
          : value.y,
    };
  }
  function translateImageCrop(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = imageCropRect(input, options, context);
    return cropFromImageRect(
      input,
      options,
      {
        ...value2,
        x: value2.x + value,
        y: value2.y + extra,
      },
      context,
    );
  }
  function resizeImageCropCorner(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = imageCropRect(input, options, context),
      [items, items2]: Dynamic = [
        value === "ne" || value === "se" ? 1 : -1,
        value === "sw" || value === "se" ? 1 : -1,
      ],
      state: Dynamic = {
        x: items > 0 ? value2.x : value2.x + value2.w,
        y: items2 > 0 ? value2.y : value2.y + value2.h,
      },
      value3: Dynamic = Math.hypot(value2.w, value2.h),
      value4: Dynamic =
        ((items * value2.w + extra) * items * value2.w +
          (items2 * value2.h + detail) * items2 * value2.h) /
        value3,
      value5: Dynamic = options.w * cropCoverScale(input, options),
      value6: Dynamic = items > 0 ? input.w - state.x : state.x,
      value7: Dynamic = items2 > 0 ? input.h - state.y : state.y,
      value8: Dynamic = Math.max(
        value5,
        value6,
        (value7 * value2.w) / value2.h,
      ),
      value9: Dynamic = MediaCropGeometryMin(
        (value2.w * value4) / value3,
        value8,
        Math.max(value8, value5 * imageCropZoomLimit(context)),
      ),
      value10: Dynamic = (value9 * value2.h) / value2.w;
    return cropFromImageRect(
      input,
      options,
      {
        x: items > 0 ? state.x : state.x - value9,
        y: items2 > 0 ? state.y : state.y - value10,
        w: value9,
        h: value10,
      },
      context,
    );
  }
  function resizeImageCropFrame(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
    argument: Dynamic = 1,
  ): Dynamic {
    let value2: Dynamic = imageCropRect(input, options, context),
      value3: Dynamic = Math.max(MediaCropGeometryConstant, context.zoom),
      [items, items2]: Dynamic = [
        Math.min(input.w, Math.max(argument, value2.w / value3)),
        Math.min(input.h, Math.max(argument, value2.h / value3)),
      ],
      [items3, items4, items5, items6]: Dynamic = [0, 0, input.w, input.h];
    value.includes("w") &&
      (items3 = MediaCropGeometryMin(extra, value2.x, items5 - items));
    value.includes("e") &&
      (items5 = MediaCropGeometryMin(
        input.w + extra,
        items3 + items,
        value2.x + value2.w,
      ));
    value.includes("n") &&
      (items4 = MediaCropGeometryMin(detail, value2.y, items6 - items2));
    value.includes("s") &&
      (items6 = MediaCropGeometryMin(
        input.h + detail,
        items4 + items2,
        value2.y + value2.h,
      ));
    let state: Dynamic = {
      x: items3 + 0,
      y: items4 + 0,
      w: items5 - items3,
      h: items6 - items4,
    };
    return {
      frame: state,
      crop: cropIntoFrame(input, options, context, state),
    };
  }
  function cropIntoFrame(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = imageCropRect(input, options, context);
    return cropFromImageRect(
      value,
      options,
      {
        x: value2.x - value.x,
        y: value2.y - value.y,
        w: value2.w,
        h: value2.h,
      },
      context,
      Math.max(MediaCropGeometryConstant, context.zoom),
    );
  }
  function rotatedCropFrame(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let [items, items2]: Dynamic = [
        context.x + context.w / 2 - input.w / 2,
        context.y + context.h / 2 - input.h / 2,
      ],
      [items3, items4]: Dynamic = [Math.cos(options), Math.sin(options)],
      [items5, items6]: Dynamic = [
        input.x + input.w / 2 + items * items3 - items2 * items4,
        input.y + input.h / 2 + items * items4 + items2 * items3,
      ];
    return {
      x: items5 - context.w / 2,
      y: items6 - context.h / 2,
      w: context.w,
      h: context.h,
    };
  }
  function zoomImageCrop(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = imageCropRect(input, options, context),
      value3: Dynamic = options.w * cropCoverScale(input, options),
      value4: Dynamic =
        MediaCropGeometryMin(
          value2.w * value,
          value3,
          value3 * imageCropZoomLimit(context),
        ) / value2.w,
      [items, items2]: Dynamic = [
        extra?.x ?? input.w / 2,
        extra?.y ?? input.h / 2,
      ];
    return cropFromImageRect(
      input,
      options,
      {
        x: items + (value2.x - items) * value4,
        y: items2 + (value2.y - items2) * value4,
        w: value2.w * value4,
        h: value2.h * value4,
      },
      context,
    );
  }
  function normalizeCenteredImageCrop(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = imageCropRect(input, options, context);
    return normalizeImageCrop({
      zoom: context.zoom,
      x: value.w - input.w < 0.5 ? 0.5 : context.x,
      y: value.h - input.h < 0.5 ? 0.5 : context.y,
    });
  }
  function imageCropVisibleRect(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = imageCropRect(input, options, context);
    return {
      x: -value.x / value.w,
      y: -value.y / value.h,
      w: input.w / value.w,
      h: input.h / value.h,
    };
  }
  function imageCropCss(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      String(MediaCropGeometryHandler(input2 * 100, 4)) + "%";
    return {
      position: "absolute",
      width: callback(input.zoom),
      height: callback(input.zoom),
      left: callback(-(input.zoom - 1) * input.x),
      top: callback(-(input.zoom - 1) * input.y),
      maxWidth: "none",
      maxHeight: "none",
      objectFit: "cover",
      objectPosition: callback(input.x) + " " + callback(input.y),
    };
  }
  function mediaNaturalDimensions(input?: Dynamic): Dynamic {
    let value: Dynamic = input,
      value2: Dynamic = value?.tagName?.toLowerCase(),
      [value3, value4]: Dynamic =
        value2 === "video"
          ? [value?.videoWidth ?? 0, value?.videoHeight ?? 0]
          : value2 === "img"
            ? [value?.naturalWidth ?? 0, value?.naturalHeight ?? 0]
            : [0, 0];
    return value3 > 0 && value4 > 0
      ? {
          w: value3,
          h: value4,
        }
      : null;
  }
  bindRuntimeValue(
    runtime,
    "defaultImageCrop",
    () => defaultImageCrop,
    (value) => {
      defaultImageCrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaCropGeometryConstant",
    () => MediaCropGeometryConstant,
    (value) => {
      MediaCropGeometryConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaCropGeometryMin",
    () => MediaCropGeometryMin,
    (value) => {
      MediaCropGeometryMin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaCropGeometryHandler",
    () => MediaCropGeometryHandler,
    (value) => {
      MediaCropGeometryHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaCropGeometryLimit",
    () => MediaCropGeometryLimit,
    (value) => {
      MediaCropGeometryLimit = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeImageCrop", () => normalizeImageCrop);
  bindRuntimeValue(
    runtime,
    "sameImageCrop",
    () => sameImageCrop,
    (value) => {
      sameImageCrop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cropCoverScale",
    () => cropCoverScale,
    (value) => {
      cropCoverScale = value;
    },
  );
  bindRuntimeValue(runtime, "imageCropRect", () => imageCropRect);
  bindRuntimeValue(
    runtime,
    "imageCropZoomLimit",
    () => imageCropZoomLimit,
    (value) => {
      imageCropZoomLimit = value;
    },
  );
  bindRuntimeValue(runtime, "cropFromImageRect", () => cropFromImageRect);
  bindRuntimeValue(runtime, "translateImageCrop", () => translateImageCrop);
  bindRuntimeValue(
    runtime,
    "resizeImageCropCorner",
    () => resizeImageCropCorner,
  );
  bindRuntimeValue(runtime, "resizeImageCropFrame", () => resizeImageCropFrame);
  bindRuntimeValue(runtime, "cropIntoFrame", () => cropIntoFrame);
  bindRuntimeValue(runtime, "rotatedCropFrame", () => rotatedCropFrame);
  bindRuntimeValue(runtime, "zoomImageCrop", () => zoomImageCrop);
  bindRuntimeValue(
    runtime,
    "normalizeCenteredImageCrop",
    () => normalizeCenteredImageCrop,
  );
  bindRuntimeValue(runtime, "imageCropVisibleRect", () => imageCropVisibleRect);
  bindRuntimeValue(runtime, "imageCropCss", () => imageCropCss);
  bindRuntimeValue(
    runtime,
    "mediaNaturalDimensions",
    () => mediaNaturalDimensions,
  );
  return () => {
    defaultImageCrop = {
      zoom: 1,
      x: 0.5,
      y: 0.5,
    };
    MediaCropGeometryConstant = 50;
    MediaCropGeometryMin = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => Math.min(context, Math.max(options, input));
    MediaCropGeometryHandler = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Math.round(input * 10 ** options) / 10 ** options;
    MediaCropGeometryLimit = 1e-6;
    sameImageCrop = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let [items, items2]: Dynamic = [
        input ?? defaultImageCrop,
        options ?? defaultImageCrop,
      ];
      return (
        items.zoom === items2.zoom &&
        items.x === items2.x &&
        items.y === items2.y
      );
    };
    cropCoverScale = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Math.max(input.w / options.w, input.h / options.h);
    imageCropZoomLimit = (input?: Dynamic): Dynamic =>
      Math.max(MediaCropGeometryConstant, input.zoom);
  };
}

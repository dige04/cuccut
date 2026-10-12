/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorMediaObjectCrop(
  runtime: RuntimeBindings,
): () => void {
  var MediaObjectCropSupports: Dynamic;
  var ThisBrowserCanTZoomAPictureMessage: Dynamic;
  var YouCanTCropAnyFurtherAtMessage: Dynamic;
  var ThePageLayoutPlacesTheTopMessage: Dynamic;
  var MediaObjectCropPattern: Dynamic;
  var MediaObjectCropInsetPattern: Dynamic;
  var MediaObjectCropMin: Dynamic;
  var MediaObjectCropAbs: Dynamic;
  var MediaObjectCropTest: Dynamic;
  var MediaObjectCropConstant: Dynamic;
  var MediaObjectCropMax: Dynamic;
  var MediaObjectCropZoom: Dynamic;
  var MediaObjectCropEvery: Dynamic;
  var MediaObjectCropHandler: Dynamic;
  function isEditableComponentName(items?: Dynamic): Dynamic {
    return (
      typeof items == "string" &&
      items.length > 0 &&
      items.length <= 128 &&
      !items.includes("/") &&
      (0, runtime.isSafeProjectPath)(items + ".dc.html")
    );
  }
  function parseObjectPosition(input?: Dynamic): Dynamic {
    let value: Dynamic = input
      .trim()
      .split(/\s+/)
      .map((input2?: Dynamic): Dynamic => MediaObjectCropPattern.exec(input2));
    if (value.length !== 2 || !value[0] || !value[1]) return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic => ({
      v: parseFloat(input2[1]),
      unit: input2[2],
    });
    return [callback(value[0]), callback(value[1])];
  }
  function parseObjectClipPath(input?: Dynamic): Dynamic {
    if (input === "" || input === "none") return null;
    let value: Dynamic = MediaObjectCropInsetPattern.exec(input.trim());
    if (!value) return;
    let value2: Dynamic = value[1]
        .trim()
        .split(" ")
        .map((input2?: Dynamic): Dynamic => parseFloat(input2) / 100),
      [items, items2, items3, items4]: Dynamic = [
        value2[0],
        value2[1] ?? value2[0],
        value2[2] ?? value2[0],
        value2[3] ?? value2[1] ?? value2[0],
      ];
    return items + items3 < 1 && items4 + items2 < 1
      ? [items, items2, items3, items4]
      : undefined;
  }
  function cropFromObjectStyles(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Math.max(input.w / options.w, input.h / options.h),
      [value2, value3, value4, value5]: Dynamic = context.box
        ? [
            context.box[3] * options.w,
            context.box[0] * options.h,
            options.w * (1 - context.box[3] - context.box[1]),
            options.h * (1 - context.box[0] - context.box[2]),
          ]
        : [0, 0, options.w, options.h],
      value6: Dynamic = Math.max(input.w / value4, input.h / value5),
      value7: Dynamic =
        value2 +
        (value4 - input.w / value6) *
          MediaObjectCropAbs(context.pos?.[0], input.w - value4 * value6),
      value8: Dynamic =
        value3 +
        (value5 - input.h / value6) *
          MediaObjectCropAbs(context.pos?.[1], input.h - value5 * value6),
      value9: Dynamic = Math.max(1, value6 / value),
      [items, items2]: Dynamic = [
        options.w * value * value9 - input.w,
        options.h * value * value9 - input.h,
      ];
    return {
      zoom: value9,
      x:
        items > 1e-6
          ? MediaObjectCropMin((value7 * value * value9) / items)
          : 0.5,
      y:
        items2 > 1e-6
          ? MediaObjectCropMin((value8 * value * value9) / items2)
          : 0.5,
    };
  }
  function imageCropStyleEdits(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = MediaObjectCropSupports(),
  ): Dynamic {
    let value2: Dynamic = (0, runtime.imageCropVisibleRect)(
        input,
        options,
        context,
      ),
      value3: Dynamic =
        context.zoom > 1
          ? "inset(" +
            [
              value2.y,
              1 - value2.x - value2.w,
              1 - value2.y - value2.h,
              value2.x,
            ]
              .map(MediaObjectCropHandler)
              .join(" ") +
            ")"
          : null;
    return [
      ["object-fit", "cover"],
      [
        "object-position",
        MediaObjectCropHandler(context.x) +
          " " +
          MediaObjectCropHandler(context.y),
      ],
      ...(value ? [["object-view-box", value3]] : []),
    ];
  }
  bindRuntimeValue(
    runtime,
    "isEditableComponentName",
    () => isEditableComponentName,
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropSupports",
    () => MediaObjectCropSupports,
    (value) => {
      MediaObjectCropSupports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisBrowserCanTZoomAPictureMessage",
    () => ThisBrowserCanTZoomAPictureMessage,
    (value) => {
      ThisBrowserCanTZoomAPictureMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "YouCanTCropAnyFurtherAtMessage",
    () => YouCanTCropAnyFurtherAtMessage,
    (value) => {
      YouCanTCropAnyFurtherAtMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThePageLayoutPlacesTheTopMessage",
    () => ThePageLayoutPlacesTheTopMessage,
    (value) => {
      ThePageLayoutPlacesTheTopMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropPattern",
    () => MediaObjectCropPattern,
    (value) => {
      MediaObjectCropPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropInsetPattern",
    () => MediaObjectCropInsetPattern,
    (value) => {
      MediaObjectCropInsetPattern = value;
    },
  );
  bindRuntimeValue(runtime, "parseObjectPosition", () => parseObjectPosition);
  bindRuntimeValue(runtime, "parseObjectClipPath", () => parseObjectClipPath);
  bindRuntimeValue(
    runtime,
    "MediaObjectCropMin",
    () => MediaObjectCropMin,
    (value) => {
      MediaObjectCropMin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropAbs",
    () => MediaObjectCropAbs,
    (value) => {
      MediaObjectCropAbs = value;
    },
  );
  bindRuntimeValue(runtime, "cropFromObjectStyles", () => cropFromObjectStyles);
  bindRuntimeValue(
    runtime,
    "MediaObjectCropTest",
    () => MediaObjectCropTest,
    (value) => {
      MediaObjectCropTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropConstant",
    () => MediaObjectCropConstant,
    (value) => {
      MediaObjectCropConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropMax",
    () => MediaObjectCropMax,
    (value) => {
      MediaObjectCropMax = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropZoom",
    () => MediaObjectCropZoom,
    (value) => {
      MediaObjectCropZoom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropEvery",
    () => MediaObjectCropEvery,
    (value) => {
      MediaObjectCropEvery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaObjectCropHandler",
    () => MediaObjectCropHandler,
    (value) => {
      MediaObjectCropHandler = value;
    },
  );
  bindRuntimeValue(runtime, "imageCropStyleEdits", () => imageCropStyleEdits);
  return () => {
    MediaObjectCropSupports = (): Dynamic =>
      typeof CSS !== "undefined" &&
      typeof CSS.supports == "function" &&
      CSS.supports("object-view-box", "inset(0%)");
    ThisBrowserCanTZoomAPictureMessage =
      "This browser can't zoom a picture inside an artboard, so you can crop in one direction only. Use Chrome or Edge.";
    YouCanTCropAnyFurtherAtMessage =
      "You can't crop any further: at least 1% of the picture's width and height has to stay in view.";
    ThePageLayoutPlacesTheTopMessage =
      "The page layout places the top and left edges here, so they cannot be cropped. Crop from the right or the bottom.";
    MediaObjectCropPattern = /^(-?\d+(?:\.\d+)?)(%|px)$/;
    MediaObjectCropInsetPattern = /^inset\(((?:\d+(?:\.\d+)?% ?){1,4})\)$/;
    MediaObjectCropMin = (input?: Dynamic): Dynamic =>
      Math.min(1, Math.max(0, input));
    MediaObjectCropAbs = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input === undefined || Math.abs(options) < 1e-6
        ? 0.5
        : MediaObjectCropMin(
            input.unit === "%" ? input.v / 100 : input.v / options,
          );
    MediaObjectCropTest = (input?: Dynamic): Dynamic =>
      input("object-fit") === "cover" &&
      (!!input("object-view-box") ||
        /^\d{1,3}(\.\d{1,4})?% \d{1,3}(\.\d{1,4})?%$/.test(
          (input("object-position") ?? "").trim(),
        ));
    MediaObjectCropConstant = 0.01;
    MediaObjectCropMax = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let value: Dynamic = Math.max(input.w / options.w, input.h / options.h);
      return Math.max(
        1,
        Math.min(input.w / (options.w * value), input.h / (options.h * value)) /
          MediaObjectCropConstant,
      );
    };
    MediaObjectCropZoom = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      context.zoom > MediaObjectCropMax(input, options) * (1 + 1e-9);
    MediaObjectCropEvery = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      [context.zoom, context.x, context.y].every(Number.isFinite)
        ? MediaObjectCropZoom(input, options, context)
          ? {
              ...context,
              zoom: MediaObjectCropMax(input, options),
            }
          : context
        : {
            zoom: 1,
            x: 0.5,
            y: 0.5,
          };
    MediaObjectCropHandler = (input?: Dynamic): Dynamic =>
      String(Math.round(MediaObjectCropMin(input) * 1e6) / 1e4) + "%";
  };
}

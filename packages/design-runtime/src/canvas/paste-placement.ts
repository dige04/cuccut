/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPastePlacement(
  runtime: RuntimeBindings,
): () => void {
  var pasteCascadePixels: Dynamic;
  var maxPlacedImageWidth: Dynamic;
  var hasMalformedUnicode: Dynamic;
  function pastedObjectsOrigin(objects?: Dynamic, point?: Dynamic): Dynamic {
    let value: Dynamic = Math.max(
        0,
        ...objects.map((input?: Dynamic): Dynamic => input.dx + input.w),
      ),
      value2: Dynamic = Math.max(
        0,
        ...objects.map((input?: Dynamic): Dynamic => input.dy + input.h),
      );
    return {
      x: point.x - value / 2,
      y: point.y - value2 / 2,
    };
  }
  function pointerCoordinates(pointer2?: Dynamic): Dynamic {
    return pointer2
      ? {
          x: pointer2.x,
          y: pointer2.y,
        }
      : null;
  }
  function resolveInsertionPointer(
    pointer2?: Dynamic,
    cachedPointer?: Dynamic,
    file?: Dynamic,
    allowCanvas?: Dynamic,
  ): Dynamic {
    return !pointer2 ||
      pointer2.stale ||
      file == null ||
      !(pointer2.inFrame ? pointer2.frameFile === file : allowCanvas)
      ? null
      : cachedPointer?.file === file
        ? cachedPointer
        : pointer2;
  }
  function insertionPointerMatchesContent(
    kind?: Dynamic,
    file?: Dynamic,
    currentFile?: Dynamic,
    enteredFile?: Dynamic,
  ): Dynamic {
    return kind === "content" && (file === currentFile || file === enteredFile);
  }
  function clampPointToRect(point?: Dynamic, box?: Dynamic): Dynamic {
    return {
      x: Math.min(box.x + box.w, Math.max(box.x, point.x)),
      y: Math.min(box.y + box.h, Math.max(box.y, point.y)),
    };
  }
  function pasteCascadeStep(scale?: Dynamic): Dynamic {
    return scale > 0 && Number.isFinite(scale)
      ? Math.max(pasteCascadePixels, Math.round(pasteCascadePixels / scale))
      : pasteCascadePixels;
  }
  function avoidPastedObjectCollisions(
    origin?: Dynamic,
    objects?: Dynamic,
    existingPositions?: Dynamic,
    step: Dynamic = pasteCascadePixels,
  ): Dynamic {
    let value: Dynamic = step / 2,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        objects.some(
          (input2?: Dynamic): Dynamic =>
            existingPositions.some(
              (input3?: Dynamic): Dynamic =>
                Math.abs(input3.x - (input.x + input2.dx)) < value &&
                Math.abs(input3.y - (input.y + input2.dy)) < value,
            ),
        ),
      value2: Dynamic = origin;
    for (let index: Dynamic = 0; index < 40 && callback(value2); index++)
      value2 = {
        x: value2.x + step,
        y: value2.y + step,
      };
    return value2;
  }
  function pastedObjectsBounds(objects?: Dynamic): Dynamic {
    let [minX, minY]: Dynamic = [
      Math.min(...objects.map((input?: Dynamic): Dynamic => input.x)),
      Math.min(...objects.map((input?: Dynamic): Dynamic => input.y)),
    ];
    return {
      x: minX,
      y: minY,
      w:
        Math.max(
          ...objects.map((input?: Dynamic): Dynamic => input.x + input.w),
        ) - minX,
      h:
        Math.max(
          ...objects.map((input?: Dynamic): Dynamic => input.y + input.h),
        ) - minY,
    };
  }
  function insertBlankArtboardMarkup(
    source?: Dynamic,
    markup?: Dynamic,
  ): Dynamic {
    let value: Dynamic = source.indexOf("></section>");
    if (value < 0) throw new Error("blank artboard source has no empty stage");
    return (
      source.slice(0, value + 1) +
      `
` +
      markup +
      `
` +
      source.slice(value + 1)
    );
  }
  function visibleArtboardCenter(
    artboard?: Dynamic,
    camera?: Dynamic,
  ): Dynamic {
    if (camera) {
      let value: Dynamic = Math.max(artboard.x, camera.x),
        value2: Dynamic = Math.min(
          artboard.x + artboard.w,
          camera.x + camera.width / camera.scale,
        ),
        value3: Dynamic = Math.max(artboard.y, camera.y),
        value4: Dynamic = Math.min(
          artboard.y + artboard.h,
          camera.y + camera.height / camera.scale,
        );
      if (value2 > value && value4 > value3)
        return {
          x: (value + value2) / 2,
          y: (value3 + value4) / 2,
        };
    }
    return {
      x: artboard.x + artboard.w / 2,
      y: artboard.y + artboard.h / 2,
    };
  }
  function defaultPlacedImageSize(
    naturalSize?: Dynamic,
    pixelDensity?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
        naturalSize && naturalSize.width > 0 && naturalSize.height > 0
          ? naturalSize
          : {
              width: 320,
              height: 240,
            },
      value2: Dynamic =
        pixelDensity != null && pixelDensity >= 5600
          ? Math.min(3, Math.round(pixelDensity / 2835))
          : 1,
      value3: Dynamic = Math.max(
        48,
        Math.min(maxPlacedImageWidth, Math.round(value.width / value2)),
      );
    return {
      w: value3,
      h: Math.max(48, Math.ceil((value3 * value.height) / value.width)),
    };
  }
  function droppedImagePlacement(
    point?: Dynamic,
    artboard?: Dynamic,
    naturalSize?: Dynamic,
    index?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Math.round(
        Math.min(naturalSize.width, Math.max(48, artboard.w * 0.6)),
      ),
      value2: Dynamic = Math.round(
        (value * naturalSize.height) / naturalSize.width,
      );
    return {
      x:
        Math.max(
          0,
          Math.min(
            Math.round(point.x - artboard.x - value / 2),
            artboard.w - value,
          ),
        ) +
        index * 24,
      y:
        Math.max(
          0,
          Math.min(
            Math.round(point.y - artboard.y - value2 / 2),
            artboard.h - value2,
          ),
        ) +
        index * 24,
      w: value,
      h: value2,
    };
  }
  function safeDroppedImageAltText(
    name?: Dynamic,
    fallback?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.PlatformFileContentSlice)(name);
    return value === undefined ||
      /[{}<]/.test(value) ||
      hasMalformedUnicode(value) ||
      runtime.ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(value)
      ? fallback
      : value;
  }
  function droppedImageMarkup(image?: Dynamic): Dynamic {
    let value: Dynamic = `position: absolute; left: ${String(image.left)}px; top: ${String(image.top)}px; width: ${String(image.w)}px; height: auto`;
    return `<img src="${(0, runtime.escapeHtmlAttributeValue)(image.src)}" alt="${(0, runtime.escapeHtmlAttributeValue)(image.alt)}" data-dc-drop="${image.mark}" width="${String(image.natural.width)}" height="${String(image.natural.height)}" style="${value}">`;
  }
  function droppedImageLabel(file?: Dynamic, origin?: Dynamic): Dynamic {
    let value: Dynamic = file.name.replace(/\.[^.]*$/, "").trim();
    return value && value.toLowerCase() !== "image"
      ? (0, runtime.truncateUtf16Safely)(value, 60)
      : origin === "pasted"
        ? "Pasted image"
        : "Dropped image";
  }
  bindRuntimeValue(runtime, "pastedObjectsOrigin", () => pastedObjectsOrigin);
  bindRuntimeValue(runtime, "pointerCoordinates", () => pointerCoordinates);
  bindRuntimeValue(
    runtime,
    "resolveInsertionPointer",
    () => resolveInsertionPointer,
  );
  bindRuntimeValue(
    runtime,
    "insertionPointerMatchesContent",
    () => insertionPointerMatchesContent,
  );
  bindRuntimeValue(runtime, "clampPointToRect", () => clampPointToRect);
  bindRuntimeValue(
    runtime,
    "pasteCascadePixels",
    () => pasteCascadePixels,
    (value) => {
      pasteCascadePixels = value;
    },
  );
  bindRuntimeValue(runtime, "pasteCascadeStep", () => pasteCascadeStep);
  bindRuntimeValue(
    runtime,
    "avoidPastedObjectCollisions",
    () => avoidPastedObjectCollisions,
  );
  bindRuntimeValue(runtime, "pastedObjectsBounds", () => pastedObjectsBounds);
  bindRuntimeValue(
    runtime,
    "insertBlankArtboardMarkup",
    () => insertBlankArtboardMarkup,
  );
  bindRuntimeValue(
    runtime,
    "visibleArtboardCenter",
    () => visibleArtboardCenter,
  );
  bindRuntimeValue(
    runtime,
    "maxPlacedImageWidth",
    () => maxPlacedImageWidth,
    (value) => {
      maxPlacedImageWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultPlacedImageSize",
    () => defaultPlacedImageSize,
  );
  bindRuntimeValue(
    runtime,
    "droppedImagePlacement",
    () => droppedImagePlacement,
  );
  bindRuntimeValue(
    runtime,
    "hasMalformedUnicode",
    () => hasMalformedUnicode,
    (value) => {
      hasMalformedUnicode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "safeDroppedImageAltText",
    () => safeDroppedImageAltText,
  );
  bindRuntimeValue(runtime, "droppedImageMarkup", () => droppedImageMarkup);
  bindRuntimeValue(runtime, "droppedImageLabel", () => droppedImageLabel);
  return () => {
    pasteCascadePixels = 24;
    maxPlacedImageWidth = 1200;
    hasMalformedUnicode = (input?: Dynamic): Dynamic =>
      /\p{Cs}/u.test(input) ||
      [...input].some(
        (input2?: Dynamic): Dynamic => input2.codePointAt(0) === 65533,
      );
  };
}

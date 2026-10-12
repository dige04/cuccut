/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties } from "react";
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { ImageCrop } from "../deck-contracts";
import type { CropCornerHandle, CropHandle } from "../editor/media-crop-overlay";
import type { CropBox, CropSize } from "../editor/media-crop-session";

/** A point in the crop viewport, in px. */
interface CropAnchor {
  x: number;
  y: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Centered, unzoomed crop; a crop equal to it is stored as "no crop". */
    defaultImageCrop: ImageCrop;
    clampCropValue: (value: number, min: number, max: number) => number;
    roundCropValue: (value: number, digits: number) => number;
    imageCropsEqual: (
      a: ImageCrop | null | undefined,
      b: ImageCrop | null | undefined,
    ) => boolean;
    /** Scale at which the image just covers the viewport. */
    coverImageScale: (viewport: CropSize, image: CropSize) => number;
    maxImageCropZoom: (crop: ImageCrop) => number;
    initializeImageCrop: () => void;
    /** A validated, rounded crop; undefined when the input is not a crop or equals the default. */
    normalizeImageCrop: (crop: unknown) => ImageCrop | undefined;
    /** Where the image lies inside the viewport for this crop. */
    imageCropRect: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
    ) => CropBox;
    /** The crop that puts the image at `imageRect` inside the viewport. */
    cropFromImageRect: (
      viewport: CropSize,
      image: CropSize,
      imageRect: CropBox,
      previousCrop: ImageCrop,
      maxZoom?: number,
    ) => ImageCrop;
    panImageCrop: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
      deltaX: number,
      deltaY: number,
    ) => ImageCrop;
    resizeImageCropFromCorner: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
      corner: CropCornerHandle,
      deltaX: number,
      deltaY: number,
    ) => ImageCrop;
    /** Drags a crop-frame edge: the new frame (relative to the viewport) and the crop that keeps the image still. */
    resizeCropViewport: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
      edge: CropHandle,
      deltaX: number,
      deltaY: number,
      minimumSize?: number,
    ) => { frame: CropBox; crop: ImageCrop };
    cropImageToRect: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
      rect: CropBox,
    ) => ImageCrop;
    zoomImageCrop: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
      zoomFactor: number,
      anchor?: CropAnchor,
    ) => ImageCrop;
    centerUncroppedImageAxes: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
    ) => ImageCrop | undefined;
    /** The visible window as fractions of the image. */
    imageCropNormalizedViewport: (
      viewport: CropSize,
      image: CropSize,
      crop: ImageCrop,
    ) => CropBox;
    imageCropCss: (crop: ImageCrop) => CSSProperties;
  }
}

export function installMediaImageCrop(runtime: RuntimeBindings): () => void {
  var defaultImageCrop: RuntimeBindings["defaultImageCrop"];
  var clampCropValue: RuntimeBindings["clampCropValue"];
  var roundCropValue: RuntimeBindings["roundCropValue"];
  var imageCropsEqual: RuntimeBindings["imageCropsEqual"];
  var coverImageScale: RuntimeBindings["coverImageScale"];
  var maxImageCropZoom: RuntimeBindings["maxImageCropZoom"];
  var initializeImageCrop: RuntimeBindings["initializeImageCrop"];
  function normalizeImageCrop(crop: unknown): ImageCrop | undefined {
    if (crop === null || typeof crop !== "object") {
      return;
    }
    let rawCrop: Partial<Record<keyof ImageCrop, unknown>> = crop,
      finiteField = (input: keyof ImageCrop): number | null =>
        typeof rawCrop[input] === "number" && Number.isFinite(rawCrop[input])
          ? rawCrop[input]
          : null,
      [zoom, x, y]: [number | null, number | null, number | null] = [
        finiteField("zoom"),
        finiteField("x"),
        finiteField("y"),
      ];
    if (zoom === null || x === null || y === null) {
      return;
    }
    let state: ImageCrop = {
      zoom: roundCropValue(clampCropValue(zoom, 1, 50), 4),
      x: roundCropValue(clampCropValue(x, 0, 1), 5),
      y: roundCropValue(clampCropValue(y, 0, 1), 5),
    };
    if (imageCropsEqual(state, defaultImageCrop)) {
      return undefined;
    } else {
      return state;
    }
  }
  function imageCropRect(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
  ): CropBox {
    let scale: number = coverImageScale(viewport, image) * crop.zoom,
      [width, height]: [number, number] = [image.w * scale, image.h * scale];
    return {
      x: (viewport.w - width) * crop.x + 0,
      y: (viewport.h - height) * crop.y + 0,
      w: width,
      h: height,
    };
  }
  function cropFromImageRect(
    viewport: CropSize,
    image: CropSize,
    imageRect: CropBox,
    previousCrop: ImageCrop,
    maxZoom: number = maxImageCropZoom(previousCrop),
  ): ImageCrop {
    let zoom: number = clampCropValue(
        imageRect.w / (image.w * coverImageScale(viewport, image)),
        1,
        maxZoom,
      ),
      scale: number = coverImageScale(viewport, image) * zoom,
      [overflowWidth, overflowHeight]: [number, number] = [
        image.w * scale - viewport.w,
        image.h * scale - viewport.h,
      ];
    return {
      zoom: zoom,
      x:
        overflowWidth > 0.000001
          ? clampCropValue(-imageRect.x / overflowWidth, 0, 1)
          : previousCrop.x,
      y:
        overflowHeight > 0.000001
          ? clampCropValue(-imageRect.y / overflowHeight, 0, 1)
          : previousCrop.y,
    };
  }
  function panImageCrop(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
    deltaX: number,
    deltaY: number,
  ): ImageCrop {
    let imageRect: CropBox = imageCropRect(viewport, image, crop);
    return cropFromImageRect(
      viewport,
      image,
      {
        ...imageRect,
        x: imageRect.x + deltaX,
        y: imageRect.y + deltaY,
      },
      crop,
    );
  }
  function resizeImageCropFromCorner(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
    corner: CropCornerHandle,
    deltaX: number,
    deltaY: number,
  ): ImageCrop {
    let value: CropBox = imageCropRect(viewport, image, crop),
      [items, items2]: [number, number] = [
        corner === "ne" || corner === "se" ? 1 : -1,
        corner === "sw" || corner === "se" ? 1 : -1,
      ],
      state: CropAnchor = {
        x: items > 0 ? value.x : value.x + value.w,
        y: items2 > 0 ? value.y : value.y + value.h,
      },
      value2: number = Math.hypot(value.w, value.h),
      value3: number =
        ((items * value.w + deltaX) * items * value.w +
          (items2 * value.h + deltaY) * items2 * value.h) /
        value2,
      value4: number = image.w * coverImageScale(viewport, image),
      value5: number = items > 0 ? viewport.w - state.x : state.x,
      value6: number = items2 > 0 ? viewport.h - state.y : state.y,
      value7: number = Math.max(value4, value5, (value6 * value.w) / value.h),
      value8: number = clampCropValue(
        (value.w * value3) / value2,
        value7,
        Math.max(value7, value4 * maxImageCropZoom(crop)),
      ),
      value9: number = (value8 * value.h) / value.w;
    return cropFromImageRect(
      viewport,
      image,
      {
        x: items > 0 ? state.x : state.x - value8,
        y: items2 > 0 ? state.y : state.y - value9,
        w: value8,
        h: value9,
      },
      crop,
    );
  }
  function resizeCropViewport(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
    edge: CropHandle,
    deltaX: number,
    deltaY: number,
    minimumSize: number = 1,
  ): { frame: CropBox; crop: ImageCrop } {
    let value: CropBox = imageCropRect(viewport, image, crop),
      value2: number = Math.max(50, crop.zoom),
      [items, items2]: [number, number] = [
        Math.min(viewport.w, Math.max(minimumSize, value.w / value2)),
        Math.min(viewport.h, Math.max(minimumSize, value.h / value2)),
      ],
      [items3, items4, items5, items6]: [number, number, number, number] = [
        0,
        0,
        viewport.w,
        viewport.h,
      ];
    if (edge.includes("w")) {
      items3 = clampCropValue(deltaX, value.x, items5 - items);
    }
    if (edge.includes("e")) {
      items5 = clampCropValue(
        viewport.w + deltaX,
        items3 + items,
        value.x + value.w,
      );
    }
    if (edge.includes("n")) {
      items4 = clampCropValue(deltaY, value.y, items6 - items2);
    }
    if (edge.includes("s")) {
      items6 = clampCropValue(
        viewport.h + deltaY,
        items4 + items2,
        value.y + value.h,
      );
    }
    let state: CropBox = {
      x: items3 + 0,
      y: items4 + 0,
      w: items5 - items3,
      h: items6 - items4,
    };
    return {
      frame: state,
      crop: cropImageToRect(viewport, image, crop, state),
    };
  }
  function cropImageToRect(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
    rect: CropBox,
  ): ImageCrop {
    let value: CropBox = imageCropRect(viewport, image, crop);
    return cropFromImageRect(
      rect,
      image,
      {
        x: value.x - rect.x,
        y: value.y - rect.y,
        w: value.w,
        h: value.h,
      },
      crop,
      Math.max(50, crop.zoom),
    );
  }
  function zoomImageCrop(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
    zoomFactor: number,
    anchor?: CropAnchor,
  ): ImageCrop {
    let value: CropBox = imageCropRect(viewport, image, crop),
      value2: number = image.w * coverImageScale(viewport, image),
      value3: number =
        clampCropValue(
          value.w * zoomFactor,
          value2,
          value2 * maxImageCropZoom(crop),
        ) / value.w,
      [items, items2]: [number, number] = [
        anchor?.x ?? viewport.w / 2,
        anchor?.y ?? viewport.h / 2,
      ];
    return cropFromImageRect(
      viewport,
      image,
      {
        x: items + (value.x - items) * value3,
        y: items2 + (value.y - items2) * value3,
        w: value.w * value3,
        h: value.h * value3,
      },
      crop,
    );
  }
  function centerUncroppedImageAxes(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
  ): ImageCrop | undefined {
    let imageRect: CropBox = imageCropRect(viewport, image, crop);
    return normalizeImageCrop({
      zoom: crop.zoom,
      x: imageRect.w - viewport.w < 0.5 ? 0.5 : crop.x,
      y: imageRect.h - viewport.h < 0.5 ? 0.5 : crop.y,
    });
  }
  function imageCropNormalizedViewport(
    viewport: CropSize,
    image: CropSize,
    crop: ImageCrop,
  ): CropBox {
    let imageRect: CropBox = imageCropRect(viewport, image, crop);
    return {
      x: -imageRect.x / imageRect.w,
      y: -imageRect.y / imageRect.h,
      w: viewport.w / imageRect.w,
      h: viewport.h / imageRect.h,
    };
  }
  function imageCropCss(crop: ImageCrop): CSSProperties {
    let percent = (input: number): string =>
      String(roundCropValue(input * 100, 4)) + "%";
    return {
      position: "absolute",
      width: percent(crop.zoom),
      height: percent(crop.zoom),
      left: percent(-(crop.zoom - 1) * crop.x),
      top: percent(-(crop.zoom - 1) * crop.y),
      maxWidth: "none",
      maxHeight: "none",
      objectFit: "cover",
      objectPosition: percent(crop.x) + " " + percent(crop.y),
    };
  }
  bindRuntimeValue(runtime, "normalizeImageCrop", () => normalizeImageCrop);
  bindRuntimeValue(runtime, "imageCropRect", () => imageCropRect);
  bindRuntimeValue(runtime, "cropFromImageRect", () => cropFromImageRect);
  bindRuntimeValue(runtime, "panImageCrop", () => panImageCrop);
  bindRuntimeValue(
    runtime,
    "resizeImageCropFromCorner",
    () => resizeImageCropFromCorner,
  );
  bindRuntimeValue(runtime, "resizeCropViewport", () => resizeCropViewport);
  bindRuntimeValue(runtime, "cropImageToRect", () => cropImageToRect);
  bindRuntimeValue(runtime, "zoomImageCrop", () => zoomImageCrop);
  bindRuntimeValue(
    runtime,
    "centerUncroppedImageAxes",
    () => centerUncroppedImageAxes,
  );
  bindRuntimeValue(
    runtime,
    "imageCropNormalizedViewport",
    () => imageCropNormalizedViewport,
  );
  bindRuntimeValue(runtime, "imageCropCss", () => imageCropCss);
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
    "clampCropValue",
    () => clampCropValue,
    (value) => {
      clampCropValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roundCropValue",
    () => roundCropValue,
    (value) => {
      roundCropValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageCropsEqual",
    () => imageCropsEqual,
    (value) => {
      imageCropsEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "coverImageScale",
    () => coverImageScale,
    (value) => {
      coverImageScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxImageCropZoom",
    () => maxImageCropZoom,
    (value) => {
      maxImageCropZoom = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeImageCrop",
    () => initializeImageCrop,
    (value) => {
      initializeImageCrop = value;
    },
  );
  return () => {
    clampCropValue = (input: number, options: number, context: number): number =>
      Math.min(context, Math.max(options, input));
    roundCropValue = (input: number, options: number): number =>
      Math.round(input * 10 ** options) / 10 ** options;
    imageCropsEqual = (
      input: ImageCrop | null | undefined,
      options: ImageCrop | null | undefined,
    ): boolean => {
      let [items, items2]: [ImageCrop, ImageCrop] = [
        input ?? defaultImageCrop,
        options ?? defaultImageCrop,
      ];
      return (
        items.zoom === items2.zoom &&
        items.x === items2.x &&
        items.y === items2.y
      );
    };
    coverImageScale = (input: CropSize, options: CropSize): number =>
      Math.max(input.w / options.w, input.h / options.h);
    maxImageCropZoom = (input: ImageCrop): number => Math.max(50, input.zoom);
    initializeImageCrop = (0, runtime.initializeOnce)((): void => {
      defaultImageCrop = {
        zoom: 1,
        x: 0.5,
        y: 0.5,
      };
    });
  };
}

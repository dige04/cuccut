/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide } from "../deck-contracts";

/** A slide background rasterised to a PNG. */
export interface BackgroundPicture {
  dataUri: string;
  /** Size of the PNG in bytes. */
  bytes: number;
  /** Average colour of the picture, as `#rrggbb`. */
  ground: string;
}
/** The raster chosen for one slide, with the frames it paints. */
export interface SlideBackgroundPicture {
  dataUri: string;
  ground: string;
  frameIds: Set<string>;
}
export interface DeckBackgroundCapture {
  /** Pictures keyed by slide index. */
  pictures: Map<number, SlideBackgroundPicture>;
  /** Export notes about backgrounds that were shrunk or not saved. */
  notes: string[];
}
/** A box in slide pixels. */
export interface SlideBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
type BackgroundCapturer = (
  surface: HTMLElement,
  frameIds: ReadonlySet<string>,
  scale: number,
) => Promise<BackgroundPicture | undefined>;

declare module "../bindings" {
  interface RuntimeBindings {
    /** Style keys a frame may carry and still count as pure background paint. */
    backgroundCaptureStyleKeys: Set<string>;
    /** Total PNG bytes allowed for all slide background pictures. */
    BACKGROUND_PICTURE_BUDGET: number;
    /** Scales tried in turn until the pictures fit the budget. */
    BACKGROUND_CAPTURE_SCALES: [number, ...number[]];
    BACKGROUND_CAPTURE_TIMEOUT_MS: number;
    initializeBackgroundCapture: () => void;
    averagePixelColor: (pixels: ArrayLike<number>) => string;
    captureBackgroundPicture: BackgroundCapturer;
    /** Rasterises gradient backgrounds that cannot be written natively. */
    captureDeckBackgrounds: (
      slides: readonly Slide[],
      getSurface: (index: number) => HTMLElement | null,
      measureRectangle: (element: Element, bounds: DOMRect) => SlideBox,
      capture?: BackgroundCapturer,
    ) => Promise<DeckBackgroundCapture>;
  }
}

/** A slide whose background needs rasterising, with the surface to draw it from. */
interface BackgroundTarget {
  index: number;
  /** Same key, same picture: slides with identical background paint share one capture. */
  key: string;
  surface: HTMLElement;
  frameIds: Set<string>;
}

export function installExportBackgroundPicturesTail(
  runtime: RuntimeBindings,
): () => void {
  var backgroundCaptureStyleKeys: RuntimeBindings["backgroundCaptureStyleKeys"];
  var BACKGROUND_PICTURE_BUDGET: RuntimeBindings["BACKGROUND_PICTURE_BUDGET"];
  var BACKGROUND_CAPTURE_SCALES: RuntimeBindings["BACKGROUND_CAPTURE_SCALES"];
  var BACKGROUND_CAPTURE_TIMEOUT_MS: RuntimeBindings["BACKGROUND_CAPTURE_TIMEOUT_MS"];
  var initializeBackgroundCapture: RuntimeBindings["initializeBackgroundCapture"];
  function averagePixelColor(pixels: ArrayLike<number>): string {
    let items = [0, 0, 0];
    for (let index = 0; index < pixels.length; index += 4)
      for (let index2 = 0; index2 < 3; index2++)
        items[index2]! += pixels[index + index2]!;
    return (
      "#" +
      items
        .map((input) =>
          Math.round(input / (pixels.length / 4))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  async function captureBackgroundPicture(
    surface: HTMLElement,
    frameIds: ReadonlySet<string>,
    scale: number,
  ): Promise<BackgroundPicture | undefined> {
    try {
      let value = document.createElement("canvas");
      value.width = Math.round(runtime.SLIDE_WIDTH * scale);
      value.height = Math.round(runtime.SLIDE_HEIGHT * scale);
      let value2 = value.getContext("2d");
      if (value2 === null) {
        return;
      }
      let value3 = surface.cloneNode(true) as HTMLElement;
      for (let value10 of Array.from(
        value3.querySelectorAll("[data-frame-id]"),
      ))
        if (!frameIds.has(value10.getAttribute("data-frame-id") ?? "")) {
          value10.remove();
        }
      let value4 = new Image();
      await new Promise<void>((input, options): void => {
        let value10 = setTimeout(
          (): void => options(Error("timed out")),
          BACKGROUND_CAPTURE_TIMEOUT_MS,
        );
        value4.onload = (): void => {
          clearTimeout(value10);
          input();
        };
        value4.onerror = (): void => {
          clearTimeout(value10);
          options(Error("not drawn"));
        };
        value4.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            (0, runtime.slideForeignObjectSvg)(value3, "", "sans-serif"),
          );
      });
      value2.fillStyle = "#fff";
      value2.fillRect(0, 0, value.width, value.height);
      value2.drawImage(value4, 0, 0, value.width, value.height);
      let { data: value5 } = value2.getImageData(
        0,
        0,
        value.width,
        value.height,
      );
      if ((0, runtime.imagePixelsAreWhite)(value5)) {
        return;
      }
      let value6 = averagePixelColor(value5),
        value7 = await (0, runtime.rgbPixelsToPngDataUrl)(
          value5,
          value.width,
          value.height,
        ).catch((): undefined => {
          return;
        });
      if (value7 !== undefined) {
        return {
          dataUri: (0, runtime.pngBytesToDataUrl)(value7),
          bytes: value7.length,
          ground: value6,
        };
      }
      let value8 = value.toDataURL("image/png"),
        value9 = value8.indexOf(";base64,");
      if (value8.startsWith("data:image/png") && value9 > 0) {
        return {
          dataUri: value8,
          bytes: Math.ceil(((value8.length - value9 - 8) * 3) / 4),
          ground: value6,
        };
      } else {
        return undefined;
      }
    } catch {
      return;
    }
  }
  async function captureDeckBackgrounds(
    slides: readonly Slide[],
    getSurface: (index: number) => HTMLElement | null,
    measureRectangle: (element: Element, bounds: DOMRect) => SlideBox,
    capture: BackgroundCapturer = captureBackgroundPicture,
  ): Promise<DeckBackgroundCapture> {
    let items: BackgroundTarget[] = [];
    slides.forEach((input, options): void => {
      let value2 = getSurface(options),
        value3 = value2?.getBoundingClientRect();
      if (
        value2 === null ||
        value3 === undefined ||
        value3.width <= 0 ||
        value3.height <= 0
      ) {
        return;
      }
      let entries3 = new Map<string, SlideBox>(),
        value4 = (0, runtime.slideBackgroundPaintFrames)(
          input,
          (input2): boolean => {
            let element = value2.querySelector(
              '[data-frame-id="' + input2.id + '"] [data-node-path=""]',
            );
            if (element === null) {
              return false;
            }
            let value6 = measureRectangle(element, value3);
            entries3.set(input2.id, value6);
            return (
              value6.x <= 0.5 &&
              value6.y <= 0.5 &&
              value6.x + value6.w >= value3.width - 0.5 &&
              value6.y + value6.h >= value3.height - 0.5
            );
          },
        );
      if (!(0, runtime.backgroundNeedsGradientRaster)(value4)) {
        return;
      }
      let value5 = (0, runtime.stableJsonStringify)([
        input.bg,
        value4.map((input2) => [entries3.get(input2.id), input2.node.style]),
      ]);
      items.push({
        index: options,
        key: value5,
        surface: value2,
        frameIds: new Set(value4.map((input2) => input2.id)),
      });
    });
    let entries = new Map<string, BackgroundPicture | undefined>(),
      value = BACKGROUND_CAPTURE_SCALES[0];
    for (let value2 of BACKGROUND_CAPTURE_SCALES) {
      value = value2;
      let entries3 = new Map<string, BackgroundPicture | undefined>();
      for (let value3 of items) {
        if (entries3.has(value3.key)) {
          continue;
        }
        entries3.set(
          value3.key,
          entries.has(value3.key) && entries.get(value3.key) === undefined
            ? undefined
            : await capture(value3.surface, value3.frameIds, value2),
        );
      }
      entries = entries3;
      let index = 0;
      for (let value3 of entries.values()) index += value3?.bytes ?? 0;
      if (index <= BACKGROUND_PICTURE_BUDGET) {
        break;
      }
    }
    let items2: string[] = [];
    if (
      value < 1 &&
      [...entries.values()].some((input) => input !== undefined)
    ) {
      items2.push(
        "slide backgrounds saved at " +
          (value === 0.5 ? "half" : "quarter") +
          " resolution to keep the file small",
      );
    }
    let entries2 = new Map<number, SlideBackgroundPicture>(),
      items3: number[] = [];
    for (let value2 of items) {
      let entry = entries.get(value2.key);
      if (entry !== undefined) {
        entries2.set(value2.index, {
          dataUri: entry.dataUri,
          ground: entry.ground,
          frameIds: value2.frameIds,
        });
      } else {
        items3.push(value2.index + 1);
      }
    }
    if (items3.length > 0) {
      let value2 = items3.length > 1,
        value3 =
          items3.slice(0, 3).join(", ") +
          (items3.length > 3
            ? " and " + String(items3.length - 3) + " more"
            : "");
      items2.push(
        "the gradient background" +
          (value2 ? "s on slides " : " on slide ") +
          value3 +
          (value2
            ? " were not saved as pictures, so they"
            : " was not saved as a picture, so it") +
          " may look different in the file",
      );
    }
    return {
      pictures: entries2,
      notes: items2,
    };
  }
  bindRuntimeValue(runtime, "averagePixelColor", () => averagePixelColor);
  bindRuntimeValue(
    runtime,
    "captureBackgroundPicture",
    () => captureBackgroundPicture,
  );
  bindRuntimeValue(
    runtime,
    "captureDeckBackgrounds",
    () => captureDeckBackgrounds,
  );
  bindRuntimeValue(
    runtime,
    "backgroundCaptureStyleKeys",
    () => backgroundCaptureStyleKeys,
    (value) => {
      backgroundCaptureStyleKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BACKGROUND_PICTURE_BUDGET",
    () => BACKGROUND_PICTURE_BUDGET,
    (value) => {
      BACKGROUND_PICTURE_BUDGET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BACKGROUND_CAPTURE_SCALES",
    () => BACKGROUND_CAPTURE_SCALES,
    (value) => {
      BACKGROUND_CAPTURE_SCALES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BACKGROUND_CAPTURE_TIMEOUT_MS",
    () => BACKGROUND_CAPTURE_TIMEOUT_MS,
    (value) => {
      BACKGROUND_CAPTURE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeBackgroundCapture",
    () => initializeBackgroundCapture,
    (value) => {
      initializeBackgroundCapture = value;
    },
  );
  return () => {
    BACKGROUND_PICTURE_BUDGET = 8388608;
    BACKGROUND_CAPTURE_TIMEOUT_MS = 5000;
    initializeBackgroundCapture = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializePdfCapture)();
      (0, runtime.initializePngEncoding)();
      backgroundCaptureStyleKeys = new Set([
        "backgroundGradient",
        "backgroundColor",
        "opacity",
      ]);
      BACKGROUND_CAPTURE_SCALES = [1, 0.5, 0.25];
    });
  };
}

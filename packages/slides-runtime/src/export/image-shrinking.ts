/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** An image already decoded for drawing, with its natural pixel size. */
export interface DecodedExportImage {
  source: HTMLImageElement;
  w: number;
  h: number;
}

/** The largest size an inline image is drawn at across the exported pages (CSS px). */
export interface ExportImageDrawnSize {
  drawnW: number;
  drawnH: number;
}

/** An inline data-URI image found in the exported pages. */
export interface ExportImage extends ExportImageDrawnSize {
  url: string;
  naturalW: number;
  naturalH: number;
  source: HTMLImageElement;
}

/** Re-encodes an image at the given size, MIME type and quality; undefined when the encoder cannot produce that MIME type. */
export type ImageEncoder = (
  image: ExportImage,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
) => string | undefined;

/** Rasterized HTML-embed frames per slide index: frame id to PNG data URI. */
export type RasterizedEmbedFrames = ReadonlyMap<
  number,
  ReadonlyMap<string, string>
>;

/** One re-encoding pass: scale factor relative to the drawn size, and encoder quality. */
export interface ImageEncodingTier {
  scale: number;
  quality: number;
}

export interface ShrinkExportImagesOptions {
  /** Bytes that must be saved for the export to fit. */
  mustSave: number;
  /** Bytes it would be nice to save (e.g. leaving room for packed fonts); defaults to mustSave. */
  wantSave?: number | undefined;
  encode?: ImageEncoder | undefined;
  opaque?: ((image: ExportImage) => boolean) | undefined;
  tiers?: ImageEncodingTier[] | undefined;
  /** Hard deadline (epoch ms). */
  deadline?: number | undefined;
  /** Soft deadline (epoch ms), honoured once mustSave has been reached. */
  wantDeadline?: number | undefined;
}

export interface ShrinkExportImagesResult {
  pages: string[];
  fits: boolean;
  reduced: number;
  saved: number;
}

/** A page image being re-encoded, with the best (smallest) data URI found so far. */
interface ShrinkCandidate {
  img: ExportImage;
  uses: number;
  current: string;
  mimes: string[] | undefined;
  tried: Set<string>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    createImageEncoder: () => ImageEncoder;
    collectExportImages: (
      pages: HTMLElement[],
      decodedImages: RasterizedEmbedFrames,
      references: number,
      decodeImage?: (dataUri: string) => Promise<DecodedExportImage | undefined>,
    ) => Promise<ExportImage[]>;
    isAnimatedImage: (dataUri: string) => boolean;
    imageEncodingMimeTypes: (
      dataUri: string,
      isOpaque: () => boolean,
    ) => string[];
    yieldToBrowser: () => Promise<void>;
    shrinkExportImages: (
      pages: string[],
      images: ExportImage[],
      options: ShrinkExportImagesOptions,
    ) => Promise<ShrinkExportImagesResult>;
    INLINE_IMAGE_PATTERN: RegExp;
    INLINE_IMAGE_PREFIX_PATTERN: RegExp;
    IMAGE_ENCODING_ATTEMPTS: ImageEncodingTier[];
    decodeExportImage: (dataUri: string) => Promise<DecodedExportImage | undefined>;
    opaqueImageProbeCanvas: HTMLCanvasElement | undefined;
    imageHasOpaquePixels: (image: ExportImage) => boolean;
    initializeImageShrinking: () => void;
  }
}

export function installExportImageShrinking(
  runtime: RuntimeBindings,
): () => void {
  var INLINE_IMAGE_PATTERN: RuntimeBindings["INLINE_IMAGE_PATTERN"];
  var INLINE_IMAGE_PREFIX_PATTERN: RuntimeBindings["INLINE_IMAGE_PREFIX_PATTERN"];
  var IMAGE_ENCODING_ATTEMPTS: RuntimeBindings["IMAGE_ENCODING_ATTEMPTS"];
  var decodeExportImage: RuntimeBindings["decodeExportImage"];
  var opaqueImageProbeCanvas: RuntimeBindings["opaqueImageProbeCanvas"];
  var imageHasOpaquePixels: RuntimeBindings["imageHasOpaquePixels"];
  var initializeImageShrinking: RuntimeBindings["initializeImageShrinking"];
  function createImageEncoder(): ImageEncoder {
    let value: HTMLCanvasElement | undefined,
      values = new Set<string>();
    return (
      dataset: ExportImage,
      options: number,
      context: number,
      value2: string,
      extra: number,
    ): string | undefined => {
      if (values.has(value2)) {
        return;
      }
      value ??= document.createElement("canvas");
      value.width = options;
      value.height = context;
      let value3 = value.getContext("2d");
      if (value3 === null) {
        return;
      }
      try {
        value3.clearRect(0, 0, options, context);
        value3.imageSmoothingQuality = "high";
        value3.drawImage(dataset.source, 0, 0, options, context);
        let value4 = value.toDataURL(value2, extra);
        if (value4.startsWith("data:" + value2)) {
          return value4;
        }
        if (value4.startsWith("data:image/")) {
          values.add(value2);
        }
        return;
      } catch {
        return;
      }
    };
  }
  async function collectExportImages(
    pages: HTMLElement[],
    decodedImages: RasterizedEmbedFrames,
    references: number,
    decodeImage: (
      dataUri: string,
    ) => Promise<DecodedExportImage | undefined> = decodeExportImage,
  ): Promise<ExportImage[]> {
    let entries = new Map<string, ExportImage>(),
      entries2 = new Map<string, ExportImageDrawnSize>(),
      callback = (
        input: string,
        options: number,
        context: number,
        dataset?: DecodedExportImage,
      ): void => {
        let entry = entries.get(input);
        if (entry !== undefined) {
          entry.drawnW = Math.max(entry.drawnW, options);
          entry.drawnH = Math.max(entry.drawnH, context);
          return;
        }
        let entry2 = entries2.get(input),
          state: ExportImageDrawnSize = {
            drawnW: Math.max(entry2?.drawnW ?? 0, options),
            drawnH: Math.max(entry2?.drawnH ?? 0, context),
          };
        if (dataset !== undefined) {
          entries.set(input, {
            url: input,
            naturalW: dataset.w,
            naturalH: dataset.h,
            ...state,
            source: dataset.source,
          });
          entries2.delete(input);
        } else {
          entries2.set(input, state);
        }
      };
    pages.forEach((element: HTMLElement, options: number): void => {
      let bounds = element.getBoundingClientRect(),
        value = bounds.width > 0 ? references / bounds.width : 1,
        callback2 = (input: Element): [number, number] => {
          let bounds2 = input.getBoundingClientRect();
          return [bounds2.width * value, bounds2.height * value];
        };
      for (let value2 of Array.from(element.querySelectorAll("img"))) {
        let value3 = value2.getAttribute("src") ?? "";
        if (!INLINE_IMAGE_PREFIX_PATTERN.test(value3)) {
          continue;
        }
        let value4: DecodedExportImage | undefined =
          value2.naturalWidth > 0 && value2.naturalHeight > 0
            ? {
                source: value2,
                w: value2.naturalWidth,
                h: value2.naturalHeight,
              }
            : undefined;
        callback(value3, ...callback2(value2), value4);
      }
      for (let value2 of Array.from(
        element.querySelectorAll('[style*="data:image/"]'),
      ))
        for (let value3 of (value2.getAttribute("style") ?? "").matchAll(
          INLINE_IMAGE_PATTERN,
        ))
          callback(value3[0], ...callback2(value2));
      for (let [value2, value3] of decodedImages.get(options) ?? []) {
        if (!INLINE_IMAGE_PREFIX_PATTERN.test(value3)) {
          continue;
        }
        let element2 = element.querySelector(
          '[data-frame-id="' + value2 + '"] [data-node-path=""]',
        );
        callback(
          value3,
          ...(element2 === null ? ([0, 0] as [number, number]) : callback2(element2)),
        );
      }
    });
    for (let [value, value2] of entries2) {
      let value3 = await decodeImage(value);
      if (value3 !== undefined) {
        entries.set(value, {
          url: value,
          naturalW: value3.w,
          naturalH: value3.h,
          ...value2,
          source: value3.source,
        });
      }
    }
    return [...entries.values()];
  }
  function isAnimatedImage(dataUri: string): boolean {
    let value = dataUri.indexOf(","),
      text = "";
    try {
      text = atob(dataUri.slice(value + 1, value + 1 + 65536));
    } catch {
      return false;
    }
    if (dataUri.startsWith("data:image/webp")) {
      return text.slice(12, 16) === "VP8X" && (text.charCodeAt(20) & 2) !== 0;
    }
    if (!dataUri.startsWith("data:image/png")) {
      return false;
    }
    let callback = (input: number): number =>
      ((text.charCodeAt(input) << 24) |
        (text.charCodeAt(input + 1) << 16) |
        (text.charCodeAt(input + 2) << 8) |
        text.charCodeAt(input + 3)) >>>
      0;
    for (
      let count = 8;
      count + 8 <= text.length;
      count += 12 + callback(count)
    ) {
      let value2 = text.slice(count + 4, count + 8);
      if (value2 === "acTL") {
        return true;
      }
      if (value2 === "IDAT") {
        return false;
      }
    }
    return false;
  }
  function imageEncodingMimeTypes(
    dataUri: string,
    isOpaque: () => boolean,
  ): string[] {
    if (dataUri.startsWith("data:image/jpeg")) {
      return ["image/jpeg"];
    }
    if (isOpaque()) {
      return ["image/webp", "image/jpeg"];
    } else {
      return ["image/webp", "image/png"];
    }
  }
  function yieldToBrowser(): Promise<void> {
    if (typeof MessageChannel !== "function") {
      return new Promise((input) => setTimeout(input, 0));
    }
    return new Promise((input) => {
      let value = new MessageChannel();
      value.port1.onmessage = (): void => input();
      value.port2.postMessage(null);
    });
  }
  async function shrinkExportImages(
    pages: string[],
    images: ExportImage[],
    options: ShrinkExportImagesOptions,
  ): Promise<ShrinkExportImagesResult> {
    let state: ShrinkExportImagesResult = {
      pages: [...pages],
      fits: options.mustSave <= 0,
      reduced: 0,
      saved: 0,
    };
    if (options.mustSave <= 0) {
      return state;
    }
    let value = Math.max(
        options.mustSave,
        options.wantSave ?? options.mustSave,
      ),
      value2 = options.encode ?? createImageEncoder(),
      value3 = options.opaque ?? imageHasOpaquePixels,
      value4 = options.tiers ?? IMAGE_ENCODING_ATTEMPTS,
      entries = new Map<string, number>();
    for (let value7 of pages)
      for (let value8 of value7.matchAll(INLINE_IMAGE_PATTERN))
        entries.set(value8[0], (entries.get(value8[0]) ?? 0) + 1);
    let value5 = images
        .filter(
          (input: ExportImage): boolean =>
            input.url.length >= 131072 &&
            (entries.get(input.url) ?? 0) > 0 &&
            input.naturalW > 0 &&
            input.naturalH > 0 &&
            !isAnimatedImage(input.url),
        )
        .map(
          (input: ExportImage): ShrinkCandidate => ({
            img: input,
            uses: entries.get(input.url)!,
            current: input.url,
            mimes: undefined,
            tried: new Set<string>(),
          }),
        ),
      index = 0,
      value6 = Date.now();
    $: for (let value7 of value4) {
      value5.sort(
        (input: ShrinkCandidate, options2: ShrinkCandidate): number =>
          options2.current.length * options2.uses -
          input.current.length * input.uses,
      );
      for (let value8 of value5) {
        if (index >= value) {
          break $;
        }
        if (options.deadline !== undefined && Date.now() >= options.deadline) {
          break $;
        }
        if (
          index >= options.mustSave &&
          options.wantDeadline !== undefined &&
          Date.now() >= options.wantDeadline
        ) {
          break $;
        }
        let { img: value9 } = value8,
          value10 =
            value9.drawnW > 0 && value9.drawnH > 0
              ? Math.max(
                  value9.drawnW / value9.naturalW,
                  value9.drawnH / value9.naturalH,
                )
              : 1,
          value11 = Math.min(1, value7.scale * value10),
          value12 = Math.max(1, Math.round(value9.naturalW * value11)),
          value13 = Math.max(1, Math.round(value9.naturalH * value11));
        value8.mimes ??= imageEncodingMimeTypes(
          value9.url,
          (): boolean => value3(value9),
        );
        let value14: string | undefined;
        for (let value15 of value8.mimes) {
          let value16 =
            String(value12) +
            "x" +
            String(value13) +
            value15 +
            (value15 === "image/png" ? "" : String(value7.quality));
          if (value8.tried.has(value16)) {
            continue;
          }
          value8.tried.add(value16);
          value14 = value2(value9, value12, value13, value15, value7.quality);
          if (value14 !== undefined) {
            break;
          }
        }
        if (value14 !== undefined && value14.length < value8.current.length) {
          index += (value8.current.length - value14.length) * value8.uses;
          value8.current = value14;
        }
        if (Date.now() - value6 > 50) {
          await yieldToBrowser();
          value6 = Date.now();
        }
      }
      if (index >= options.mustSave) {
        break;
      }
    }
    if (index < options.mustSave) {
      return state;
    }
    let entries2 = new Map<string, string>(
      value5
        .filter((input: ShrinkCandidate): boolean => input.current !== input.img.url)
        .map((input: ShrinkCandidate): [string, string] => [input.img.url, input.current]),
    );
    return {
      pages: pages.map(
        (input: string): string =>
          input.replace(
            INLINE_IMAGE_PATTERN,
            (input2: string): string => entries2.get(input2) ?? input2,
          ),
      ),
      fits: true,
      reduced: entries2.size,
      saved: index,
    };
  }
  bindRuntimeValue(runtime, "createImageEncoder", () => createImageEncoder);
  bindRuntimeValue(runtime, "collectExportImages", () => collectExportImages);
  bindRuntimeValue(runtime, "isAnimatedImage", () => isAnimatedImage);
  bindRuntimeValue(
    runtime,
    "imageEncodingMimeTypes",
    () => imageEncodingMimeTypes,
  );
  bindRuntimeValue(runtime, "yieldToBrowser", () => yieldToBrowser);
  bindRuntimeValue(runtime, "shrinkExportImages", () => shrinkExportImages);
  bindRuntimeValue(
    runtime,
    "INLINE_IMAGE_PATTERN",
    () => INLINE_IMAGE_PATTERN,
    (value) => {
      INLINE_IMAGE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INLINE_IMAGE_PREFIX_PATTERN",
    () => INLINE_IMAGE_PREFIX_PATTERN,
    (value) => {
      INLINE_IMAGE_PREFIX_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IMAGE_ENCODING_ATTEMPTS",
    () => IMAGE_ENCODING_ATTEMPTS,
    (value) => {
      IMAGE_ENCODING_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeExportImage",
    () => decodeExportImage,
    (value) => {
      decodeExportImage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "opaqueImageProbeCanvas",
    () => opaqueImageProbeCanvas,
    (value) => {
      opaqueImageProbeCanvas = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageHasOpaquePixels",
    () => imageHasOpaquePixels,
    (value) => {
      imageHasOpaquePixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeImageShrinking",
    () => initializeImageShrinking,
    (value) => {
      initializeImageShrinking = value;
    },
  );
  return () => {
    decodeExportImage = async (
      dataUri: string,
    ): Promise<DecodedExportImage | undefined> => {
      try {
        let value = new Image();
        value.src = dataUri;
        await value.decode();
        if (value.naturalWidth > 0 && value.naturalHeight > 0) {
          return {
            source: value,
            w: value.naturalWidth,
            h: value.naturalHeight,
          };
        } else {
          return undefined;
        }
      } catch {
        return;
      }
    };
    imageHasOpaquePixels = (image: ExportImage): boolean => {
      try {
        let value = (opaqueImageProbeCanvas ??=
          document.createElement("canvas"));
        value.width = 256;
        value.height = 256;
        let value2 = value.getContext("2d");
        if (value2 === null) {
          return false;
        }
        value2.clearRect(0, 0, 256, 256);
        value2.imageSmoothingQuality = "high";
        value2.drawImage(image.source, 0, 0, 256, 256);
        let data = value2.getImageData(0, 0, 256, 256).data;
        for (let count = 3; count < data.length; count += 4)
          if (data[count] !== 255) {
            return false;
          }
        return true;
      } catch {
        return false;
      }
    };
    initializeImageShrinking = (0, runtime.initializeOnce)((): void => {
      INLINE_IMAGE_PATTERN =
        /data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+/g;
      INLINE_IMAGE_PREFIX_PATTERN =
        /^data:image\/(?:png|jpeg|webp|avif);base64,/;
      IMAGE_ENCODING_ATTEMPTS = [
        {
          scale: 2,
          quality: 0.85,
        },
        {
          scale: 1.5,
          quality: 0.8,
        },
        {
          scale: 1,
          quality: 0.72,
        },
      ];
    });
  };
}

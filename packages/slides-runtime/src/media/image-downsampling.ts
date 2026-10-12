/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Limits for shrinking an image; each falls back to the function's own default. */
export interface ImageDownsampleOptions {
  /** Largest allowed byte size of the result. */
  maxBytes?: number;
  /** Largest allowed width or height of the result. */
  maxEdge?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    isSvgMimeType: (mimeType: string) => boolean;
    /** Rasterizes an SVG blob so its longest edge is `maxEdge`; rejects when it cannot be decoded safely. */
    decodeSvgImage: (blob: Blob, maxEdge: number) => Promise<ImageBitmap>;
    decodeImageBitmap: (blob: Blob, maxSvgEdge: number) => Promise<ImageBitmap>;
    /** Scaled copy as a data URL, or undefined when the host cannot encode `mimeType`. */
    encodeImageDataUrl: (
      image: ImageBitmap,
      maxEdge: number,
      quality: number,
      mimeType: string,
    ) => string | undefined;
    downsampleImageToDataUrl: (
      blob: Blob,
      options?: ImageDownsampleOptions,
    ) => Promise<string>;
    /** Scaled copy as a blob, or undefined when the host cannot encode `mimeType`. */
    encodeImageBlob: (
      image: ImageBitmap,
      maxEdge: number,
      quality: number,
      mimeType: string,
    ) => Promise<Blob | undefined>;
    downsampleImageToBlob: (
      blob: Blob,
      options?: ImageDownsampleOptions,
    ) => Promise<Blob>;
    isImageFile: (file: File) => boolean;
    imageDataUrlQualities: number[];
    imageBlobQualities: number[];
    initializeImageDownsampling: () => void;
  }
}

export function installMediaImageDownsampling(
  runtime: RuntimeBindings,
): () => void {
  var imageDataUrlQualities: RuntimeBindings["imageDataUrlQualities"];
  var imageBlobQualities: RuntimeBindings["imageBlobQualities"];
  var initializeImageDownsampling: RuntimeBindings["initializeImageDownsampling"];
  function isSvgMimeType(mimeType: string): boolean {
    return (
      (mimeType.split(";")[0] ?? "").trim().toLowerCase() === "image/svg+xml"
    );
  }
  async function decodeSvgImage(
    blob: Blob,
    maxEdge: number,
  ): Promise<ImageBitmap> {
    let value: string = URL.createObjectURL(blob);
    try {
      let value2: HTMLImageElement = new Image();
      await new Promise<void>(
        (input: () => void, options: (reason: Error) => void): void => {
          let value11: ReturnType<typeof setTimeout> = setTimeout(
            (): void => options(Error("timed out reading the SVG")),
            20000,
          );
          value2.onload = (): void => {
            clearTimeout(value11);
            input();
          };
          value2.onerror = (): void => {
            clearTimeout(value11);
            options(Error("the SVG could not be decoded as an image"));
          };
          value2.src = value;
        },
      );
      let value3: boolean = value2.naturalWidth > 0 && value2.naturalHeight > 0,
        value4: number = value3 ? value2.naturalWidth : maxEdge,
        value5: number = value3 ? value2.naturalHeight : maxEdge,
        value6: number = maxEdge / Math.max(value4, value5),
        value7: number = Math.max(1, Math.round(value4 * value6)),
        value8: number = Math.max(1, Math.round(value5 * value6)),
        value9: HTMLCanvasElement = document.createElement("canvas");
      value9.width = value7;
      value9.height = value8;
      let value10: CanvasRenderingContext2D | null = value9.getContext("2d");
      if (value10 === null) {
        throw Error("no 2d canvas in this host");
      }
      value10.drawImage(value2, 0, 0, value7, value8);
      try {
        value10.getImageData(0, 0, 1, 1);
      } catch {
        throw Error(
          "this SVG uses features that can't be imported (embedded web content)",
        );
      }
      return createImageBitmap(value9);
    } finally {
      URL.revokeObjectURL(value);
    }
  }
  async function decodeImageBitmap(
    blob: Blob,
    maxSvgEdge: number,
  ): Promise<ImageBitmap> {
    if (isSvgMimeType(blob.type)) {
      return decodeSvgImage(blob, maxSvgEdge);
    } else {
      return createImageBitmap(blob);
    }
  }
  // The parameter names are swapped in the restored source: `mimeType` carries the numeric quality and
  // `quality` carries the MIME type string.
  function encodeImageDataUrl(
    image: ImageBitmap,
    maxEdge: number,
    mimeType: number,
    quality: string,
  ): string | undefined {
    let scale: number = Math.min(
        1,
        maxEdge / Math.max(image.width, image.height),
      ),
      width: number = Math.max(1, Math.round(image.width * scale)),
      height: number = Math.max(1, Math.round(image.height * scale)),
      canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    let context: CanvasRenderingContext2D | null = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.drawImage(image, 0, 0, width, height);
    let value: string = canvas.toDataURL(quality, mimeType);
    if (value.startsWith("data:" + quality)) {
      return value;
    } else {
      return undefined;
    }
  }
  async function downsampleImageToDataUrl(
    blob: Blob,
    options: ImageDownsampleOptions = {},
  ): Promise<string> {
    let maxBytes: number = options.maxBytes ?? 71680,
      maxEdge: number = options.maxEdge ?? 1280,
      image: ImageBitmap = await decodeImageBitmap(blob, Math.max(64, maxEdge));
    try {
      let value: number = Math.max(
          64,
          Math.min(maxEdge, Math.max(image.width, image.height)),
        ),
        value2: string | undefined;
      while (value >= 64) {
        for (let value3 of imageDataUrlQualities) {
          let value4: string | undefined =
            encodeImageDataUrl(image, value, value3, "image/webp") ??
            encodeImageDataUrl(image, value, value3, "image/jpeg");
          if (value4 && value4.length <= maxBytes) {
            return value4;
          }
          if (value4 && (!value2 || value4.length < value2.length)) {
            value2 = value4;
          }
        }
        value = Math.floor(value * 0.7);
      }
      throw Error(
        "could not fit the image into " +
          String(maxBytes) +
          " bytes" +
          (value2 ? " (smallest attempt: " + String(value2.length) + ")" : ""),
      );
    } finally {
      image.close();
    }
  }
  // Same swapped parameter names as `encodeImageDataUrl`: `mimeType` is the numeric quality, `quality` the MIME type.
  async function encodeImageBlob(
    image: ImageBitmap,
    maxEdge: number,
    mimeType: number,
    quality: string,
  ): Promise<Blob | undefined> {
    let scale: number = Math.min(
        1,
        maxEdge / Math.max(image.width, image.height),
      ),
      width: number = Math.max(1, Math.round(image.width * scale)),
      height: number = Math.max(1, Math.round(image.height * scale)),
      canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    let context: CanvasRenderingContext2D | null = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.drawImage(image, 0, 0, width, height);
    let value: Blob | null = await new Promise<Blob | null>(
      (input: BlobCallback): void => canvas.toBlob(input, quality, mimeType),
    );
    if (value !== null && value.type === quality) {
      return value;
    } else {
      return undefined;
    }
  }
  async function downsampleImageToBlob(
    blob: Blob,
    options: ImageDownsampleOptions = {},
  ): Promise<Blob> {
    let maxEdge: number = options.maxEdge ?? 2560,
      maxBytes: number = options.maxBytes ?? 1572864,
      image: ImageBitmap = await decodeImageBitmap(blob, maxEdge);
    try {
      let value: number = Math.max(
        64,
        Math.min(maxEdge, Math.max(image.width, image.height)),
      );
      while (value >= 64) {
        for (let value2 of imageBlobQualities) {
          let value3: Blob | undefined =
            (await encodeImageBlob(image, value, value2, "image/webp")) ??
            (await encodeImageBlob(image, value, value2, "image/jpeg"));
          if (value3 && value3.size <= maxBytes) {
            return value3;
          }
        }
        value = Math.floor(value * 0.7);
      }
      throw Error(
        "could not fit the image into " + String(maxBytes) + " bytes",
      );
    } finally {
      image.close();
    }
  }
  function isImageFile(file: File): boolean {
    return file.type.startsWith("image/");
  }
  bindRuntimeValue(runtime, "isSvgMimeType", () => isSvgMimeType);
  bindRuntimeValue(runtime, "decodeSvgImage", () => decodeSvgImage);
  bindRuntimeValue(runtime, "decodeImageBitmap", () => decodeImageBitmap);
  bindRuntimeValue(runtime, "encodeImageDataUrl", () => encodeImageDataUrl);
  bindRuntimeValue(
    runtime,
    "downsampleImageToDataUrl",
    () => downsampleImageToDataUrl,
  );
  bindRuntimeValue(runtime, "encodeImageBlob", () => encodeImageBlob);
  bindRuntimeValue(
    runtime,
    "downsampleImageToBlob",
    () => downsampleImageToBlob,
  );
  bindRuntimeValue(runtime, "isImageFile", () => isImageFile);
  bindRuntimeValue(
    runtime,
    "imageDataUrlQualities",
    () => imageDataUrlQualities,
    (value) => {
      imageDataUrlQualities = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageBlobQualities",
    () => imageBlobQualities,
    (value) => {
      imageBlobQualities = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeImageDownsampling",
    () => initializeImageDownsampling,
    (value) => {
      initializeImageDownsampling = value;
    },
  );
  return () => {
    initializeImageDownsampling = (0, runtime.initializeOnce)((): void => {
      imageDataUrlQualities = [0.8, 0.65, 0.5, 0.35, 0.25];
      imageBlobQualities = [0.85, 0.75, 0.65, 0.5];
    });
  };
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  HostAssetsCapability,
  SlidesHost,
} from "../../../slides/src/editor/slides-host";
import type { ImageDownsampleOptions } from "./image-downsampling";

/** An uploaded asset in the form the runtime stores: its `_blob/<id>` reference and size. */
export interface StoredBlobAsset {
  id: string;
  src: string;
  bytes: number;
}
/** What `storeImageAsset` produced: a blob uploaded to the host, or a downsampled copy inlined as a data URL. */
export type StoredImageAsset =
  | ({ kind: "blob" } & StoredBlobAsset)
  | {
      kind: "data";
      src: string;
      /** Why the image was inlined instead of uploaded, e.g. `unsupported_type` or `unavailable`. */
      reason: string;
    };
/** Overrides for `storeImageAsset`; each step falls back to the built-in behavior. */
export interface StoreImageAssetOptions {
  /** Produces the inline data URL used when the image cannot be uploaded. */
  downsample?: (
    blob: Blob,
    options: ImageDownsampleOptions,
  ) => Promise<string>;
  maxDataBytes?: number;
  /** Re-encodes formats the host cannot store as-is (AVIF, BMP, SVG). */
  transcode?: (blob: Blob) => Promise<Blob>;
  /** Shrinks an uploadable image that is too large. */
  downsize?: (blob: Blob) => Promise<Blob>;
}
/** An upload result whose fields are not yet validated. */
interface UploadedAssetCandidate {
  id?: unknown;
  url?: unknown;
  sizeBytes?: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** The host's asset upload capability, or null when this host cannot store blobs. */
    getAssetsCapability: () => Promise<HostAssetsCapability | null>;
    isEmulatorBlobUrl: (url: string) => boolean;
    isStoredBlobReference: (url: string) => boolean;
    normalizeUploadedAsset: (uploaded: unknown) => StoredBlobAsset | undefined;
    imageMaxDimension: (blob: Blob) => Promise<number>;
    prepareImageUpload: (blob: Blob) => Promise<Blob>;
    storeImageAsset: (
      blob: Blob,
      options?: StoreImageAssetOptions,
    ) => Promise<StoredImageAsset>;
    accountBlobCacheEntry: (url: string, byteLength: number) => void;
    fetchStoredBlob: (
      url: string,
      timeoutMs?: number,
      options?: { ignoreRecentFailure?: boolean },
    ) => Promise<string>;
    storedBlobPattern: RegExp;
    allowedImageMimeTypes: string[];
    maxImageUploadBytes: number;
    maxStoredImageBytes: number;
    maxStoredImageEdge: number;
    downsampleStoredImage: (blob: Blob) => Promise<Blob>;
    /** Stored blob URL -> its in-flight or settled fetch as a data URL. */
    blobFetchPromises: Map<string, Promise<string>>;
    /** Stored blob URL -> the data URL fetched for it. */
    blobObjectUrls: Map<string, string>;
    blobCacheByteSizes: Map<string, number>;
    blobCacheBytes: number;
    maxBlobCacheBytes: number;
    /** Stored blob URL -> when its last fetch failed (ms since epoch). */
    recentBlobFetchFailures: Map<string, number>;
    blobFailureCooldownMs: number;
    initializeAssetStorage: () => void;
  }
}

export function installMediaAssets(runtime: RuntimeBindings): () => void {
  var storedBlobPattern: RuntimeBindings["storedBlobPattern"];
  var allowedImageMimeTypes: RuntimeBindings["allowedImageMimeTypes"];
  var maxImageUploadBytes: RuntimeBindings["maxImageUploadBytes"];
  var maxStoredImageBytes: RuntimeBindings["maxStoredImageBytes"];
  var maxStoredImageEdge: RuntimeBindings["maxStoredImageEdge"];
  var downsampleStoredImage: RuntimeBindings["downsampleStoredImage"];
  var blobFetchPromises: RuntimeBindings["blobFetchPromises"];
  var blobObjectUrls: RuntimeBindings["blobObjectUrls"];
  var blobCacheByteSizes: RuntimeBindings["blobCacheByteSizes"];
  var blobCacheBytes: RuntimeBindings["blobCacheBytes"];
  var maxBlobCacheBytes: RuntimeBindings["maxBlobCacheBytes"];
  var recentBlobFetchFailures: RuntimeBindings["recentBlobFetchFailures"];
  var blobFailureCooldownMs: RuntimeBindings["blobFailureCooldownMs"];
  var initializeAssetStorage: RuntimeBindings["initializeAssetStorage"];
  async function getAssetsCapability(): Promise<HostAssetsCapability | null> {
    let slidesHost: SlidesHost | undefined = globalThis.slidesHost;
    if (typeof slidesHost?.use === "function") {
      return (0, runtime.loadHostCapabilityWithTimeout)(
        "assets",
        (0, runtime.capabilityHasMethod)<HostAssetsCapability>("upload"),
      );
    }
    if (typeof slidesHost?.assets?.upload === "function") {
      return slidesHost.assets;
    } else {
      return null;
    }
  }
  function isEmulatorBlobUrl(url: string): boolean {
    return url.startsWith("blob:") && (0, runtime.isEmulatorPage)();
  }
  function isStoredBlobReference(url: string): boolean {
    return storedBlobPattern.test(url) || isEmulatorBlobUrl(url);
  }
  function normalizeUploadedAsset(
    uploaded: unknown,
  ): StoredBlobAsset | undefined {
    if (typeof uploaded !== "object" || uploaded === null) {
      return;
    }
    let value: UploadedAssetCandidate = uploaded,
      value2: string = typeof value.id === "string" ? value.id : "",
      value3: string = typeof value.url === "string" ? value.url : "",
      value4: string =
        storedBlobPattern.test(value3) || isEmulatorBlobUrl(value3)
          ? value3
          : /^[0-9a-f]{32}$/.test(value2)
            ? "_blob/" + value2
            : "";
    if (value4 === "") {
      return;
    }
    return {
      id: value2 || value4.slice(-32),
      src: value4,
      bytes: typeof value.sizeBytes === "number" ? value.sizeBytes : 0,
    };
  }
  async function imageMaxDimension(blob: Blob): Promise<number> {
    try {
      let value: ImageBitmap = await createImageBitmap(blob),
        value2: number = Math.max(value.width, value.height);
      value.close();
      return value2;
    } catch {
      return 0;
    }
  }
  async function prepareImageUpload(blob: Blob): Promise<Blob> {
    if (
      blob.size <= maxStoredImageBytes &&
      (await imageMaxDimension(blob)) <= maxStoredImageEdge
    ) {
      return blob;
    }
    return downsampleStoredImage(blob);
  }
  async function storeImageAsset(
    blob: Blob,
    options: StoreImageAssetOptions = {},
  ): Promise<StoredImageAsset> {
    let value = options.downsample ?? runtime.downsampleImageToDataUrl,
      callback = async (input: string): Promise<StoredImageAsset> => ({
        kind: "data",
        src: await value(blob, {
          maxBytes: options.maxDataBytes ?? 71680,
        }),
        reason: input,
      }),
      type: string = blob.type,
      value2: boolean = allowedImageMimeTypes.includes(type),
      value3: boolean =
        type === "image/avif" ||
        type === "image/bmp" ||
        type === "image/svg+xml";
    if (!value2 && !value3) {
      return callback("unsupported_type");
    }
    let value4: boolean = type === "image/gif";
    if (value4 && blob.size > maxImageUploadBytes) {
      return callback("too_large");
    }
    let value5: HostAssetsCapability | null = await getAssetsCapability();
    if (value5 === null || typeof value5.upload !== "function") {
      return callback("unavailable");
    }
    let value6: Blob = blob;
    if (!value4) {
      try {
        value6 = value3
          ? await (options.transcode ?? downsampleStoredImage)(blob)
          : await (options.downsize ?? prepareImageUpload)(blob);
      } catch {
        return callback("downsize_failed");
      }
    }
    try {
      let value7: StoredBlobAsset | undefined = normalizeUploadedAsset(
        await value5.upload.call(value5, value6, {
          type: value6.type || type,
        }),
      );
      if (value7 === undefined) {
        return callback("bad_result");
      }
      return {
        kind: "blob",
        ...value7,
      };
    } catch (value7: unknown) {
      let value8: string =
        typeof value7 === "object" && value7 !== null
          ? String((value7 as { code?: unknown }).code ?? "")
          : "";
      return callback(value8 || "upload_failed");
    }
  }
  function accountBlobCacheEntry(url: string, byteLength: number): void {
    blobCacheByteSizes.set(url, byteLength);
    blobCacheBytes += byteLength;
    for (let [value, value2] of blobCacheByteSizes) {
      if (blobCacheBytes <= maxBlobCacheBytes) {
        break;
      }
      if (value === url) {
        continue;
      }
      blobCacheByteSizes.delete(value);
      blobFetchPromises.delete(value);
      blobObjectUrls.delete(value);
      blobCacheBytes -= value2;
    }
  }
  function fetchStoredBlob(
    url: string,
    timeoutMs: number = 8000,
    options: { ignoreRecentFailure?: boolean } = {},
  ): Promise<string> {
    let entry: Promise<string> | undefined = blobFetchPromises.get(url);
    if (entry !== undefined) {
      return entry;
    }
    let entry2: number | undefined = recentBlobFetchFailures.get(url);
    if (
      entry2 !== undefined &&
      options.ignoreRecentFailure !== true &&
      Date.now() - entry2 < blobFailureCooldownMs
    ) {
      return Promise.reject(Error("blob fetch failed recently"));
    }
    let value: Promise<string> = (async (): Promise<string> => {
      if (!isStoredBlobReference(url)) {
        throw Error("not a blob ref");
      }
      let value2: AbortController | undefined =
          typeof AbortController === "function"
            ? new AbortController()
            : undefined,
        value3: ReturnType<typeof setTimeout> = setTimeout(
          (): void => value2?.abort(),
          timeoutMs,
        );
      try {
        let value4: Response = await fetch(url, {
          credentials: "same-origin",
          signal: value2?.signal,
        });
        if (!value4.ok) {
          throw Object.assign(Error("blob fetch " + String(value4.status)), {
            status: value4.status,
          });
        }
        let value5: Blob = await value4.blob();
        return await new Promise<string>(
          (
            input: (value: string) => void,
            options2: (reason: Error) => void,
          ): void => {
            let value6: FileReader = new FileReader();
            value6.onload = (): void => input(String(value6.result));
            value6.onerror = (): void => options2(Error("blob read failed"));
            value6.readAsDataURL(value5);
          },
        );
      } finally {
        clearTimeout(value3);
      }
    })();
    blobFetchPromises.set(url, value);
    value.then(
      (items: string): void => {
        blobObjectUrls.set(url, items);
        accountBlobCacheEntry(url, items.length);
      },
      (): void => {
        blobFetchPromises.delete(url);
        recentBlobFetchFailures.set(url, Date.now());
      },
    );
    return value;
  }
  bindRuntimeValue(runtime, "getAssetsCapability", () => getAssetsCapability);
  bindRuntimeValue(runtime, "isEmulatorBlobUrl", () => isEmulatorBlobUrl);
  bindRuntimeValue(
    runtime,
    "isStoredBlobReference",
    () => isStoredBlobReference,
  );
  bindRuntimeValue(
    runtime,
    "normalizeUploadedAsset",
    () => normalizeUploadedAsset,
  );
  bindRuntimeValue(runtime, "imageMaxDimension", () => imageMaxDimension);
  bindRuntimeValue(runtime, "prepareImageUpload", () => prepareImageUpload);
  bindRuntimeValue(runtime, "storeImageAsset", () => storeImageAsset);
  bindRuntimeValue(
    runtime,
    "accountBlobCacheEntry",
    () => accountBlobCacheEntry,
  );
  bindRuntimeValue(runtime, "fetchStoredBlob", () => fetchStoredBlob);
  bindRuntimeValue(
    runtime,
    "storedBlobPattern",
    () => storedBlobPattern,
    (value) => {
      storedBlobPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "allowedImageMimeTypes",
    () => allowedImageMimeTypes,
    (value) => {
      allowedImageMimeTypes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxImageUploadBytes",
    () => maxImageUploadBytes,
    (value) => {
      maxImageUploadBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxStoredImageBytes",
    () => maxStoredImageBytes,
    (value) => {
      maxStoredImageBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxStoredImageEdge",
    () => maxStoredImageEdge,
    (value) => {
      maxStoredImageEdge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "downsampleStoredImage",
    () => downsampleStoredImage,
    (value) => {
      downsampleStoredImage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobFetchPromises",
    () => blobFetchPromises,
    (value) => {
      blobFetchPromises = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobObjectUrls",
    () => blobObjectUrls,
    (value) => {
      blobObjectUrls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobCacheByteSizes",
    () => blobCacheByteSizes,
    (value) => {
      blobCacheByteSizes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobCacheBytes",
    () => blobCacheBytes,
    (value) => {
      blobCacheBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxBlobCacheBytes",
    () => maxBlobCacheBytes,
    (value) => {
      maxBlobCacheBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recentBlobFetchFailures",
    () => recentBlobFetchFailures,
    (value) => {
      recentBlobFetchFailures = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobFailureCooldownMs",
    () => blobFailureCooldownMs,
    (value) => {
      blobFailureCooldownMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeAssetStorage",
    () => initializeAssetStorage,
    (value) => {
      initializeAssetStorage = value;
    },
  );
  return () => {
    maxImageUploadBytes = 2097152;
    maxStoredImageBytes = 1572864;
    maxStoredImageEdge = 2560;
    downsampleStoredImage = (input: Blob): Promise<Blob> =>
      (0, runtime.downsampleImageToBlob)(input, {
        maxEdge: maxStoredImageEdge,
        maxBytes: maxStoredImageBytes,
      });
    blobCacheBytes = 0;
    maxBlobCacheBytes = 50331648;
    blobFailureCooldownMs = 30000;
    initializeAssetStorage = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeEmulatorDetection)();
      (0, runtime.initializeImageDownsampling)();
      storedBlobPattern = /^\/?_blob\/[0-9a-f]{32}$/;
      allowedImageMimeTypes = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      blobFetchPromises = new Map();
      blobObjectUrls = new Map();
      blobCacheByteSizes = new Map();
      recentBlobFetchFailures = new Map();
    });
  };
}

import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetResources(
  runtime: RuntimeBindings,
): () => void {
  var reactBlobResource: typeof import("react");
  var MAX_INLINE_ASSET_BYTES: number;
  var MAX_INLINE_FONT_BYTES: number;
  var MAX_INLINE_VIDEO_BYTES: number;
  var FONT_FILE_EXTENSIONS: string[];
  var VIDEO_FILE_EXTENSIONS: string[];
  var ASSET_MIME_EXTENSIONS: Record<string, string>;
  var ASSET_EXTENSION_ALIASES: Record<string, string>;
  var FONT_FILE_ACCEPT: string;
  var ASSET_EXTENSION_MIME_TYPES: Record<string, string>;
  var MAX_BLOB_READ_BYTES: number;
  var MAX_BLOB_READ_ATTEMPTS: number;
  var BLOB_READ_RETRY_DELAY_MS: number;
  var blobDataUrlCache: Map<string, string>;
  var blobReadFailureCounts: Map<string, number>;
  var reportedBlobReadFailures: Set<string>;
  var blobReadPromises: Map<string, Promise<string | null>>;
  var blobResourceSubscribers: Set<() => void>;
  var blobResourceGeneration: number;
  function assetFileExtension(
    fileName: string,
    mimeType: string,
  ): string | null {
    let mimeExtension =
      ASSET_MIME_EXTENSIONS[mimeType.split(";")[0]?.trim().toLowerCase() ?? ""];
    if (mimeExtension !== undefined) {
      return mimeExtension;
    }
    let value = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
    return ASSET_EXTENSION_ALIASES[value] ?? null;
  }
  function isFontFile(fileName: string, mimeType: string): boolean {
    let extension = assetFileExtension(fileName, mimeType);
    return extension !== null && FONT_FILE_EXTENSIONS.includes(extension);
  }
  function assetUploadDestination(
    fileName: string,
    mimeType: string,
    relativePath: string = "",
  ): Editor.UploadDestination {
    if (isFontFile(fileName, mimeType)) {
      return {
        to: "fonts",
      };
    }
    let parentGroups = relativePath
      .split("/")
      .slice(0, -1)
      .map((input) => input.trim())
      .filter((input) => input !== "" && input !== "." && input !== "..");
    if (parentGroups.length > 0) {
      return {
        to: "assets",
        group: parentGroups[0],
        subpath: parentGroups.slice(1).join("/"),
      };
    }
    return {
      to: "assets",
      group: "",
      subpath: "",
    };
  }
  function formatFileSize(bytes: number): string {
    if (bytes >= 1048576) {
      return (
        (bytes / 1048576)
          .toFixed(bytes >= 10485760 ? 0 : 1)
          .replace(/\.0$/, "") + " MB"
      );
    } else {
      return String(Math.ceil(bytes / 1024)) + " KB";
    }
  }
  function classifyAssetUpload(
    fileName: string,
    extension: string | null,
    bytes: number,
  ): Editor.UploadClassification {
    if (extension !== null && FONT_FILE_EXTENSIONS.includes(extension)) {
      if (bytes > MAX_INLINE_FONT_BYTES) {
        return {
          mode: "reject",
          reason:
            "Fonts store up to " +
            formatFileSize(MAX_INLINE_FONT_BYTES) +
            " — this one is " +
            formatFileSize(bytes) +
            ". Subset it, or convert to woff2.",
        };
      }
      if (extension === "woff2") {
        return {
          mode: "original",
        };
      } else {
        return {
          mode: "original",
          warning:
            "Stored as " +
            extension +
            " — woff2 is preferred (smaller, same fidelity).",
        };
      }
    }
    if (extension !== null && VIDEO_FILE_EXTENSIONS.includes(extension)) {
      if (bytes <= MAX_INLINE_VIDEO_BYTES) {
        return {
          mode: "original",
        };
      } else {
        return {
          mode: "reject",
          reason:
            "Video stores up to " +
            formatFileSize(MAX_INLINE_VIDEO_BYTES) +
            " — this one is " +
            formatFileSize(bytes) +
            ". Trim or compress it.",
        };
      }
    }
    if (bytes <= MAX_INLINE_ASSET_BYTES) {
      return {
        mode: "original",
      };
    }
    return {
      mode: "reject",
      reason:
        (extension === "svg"
          ? "SVG assets store as text up to "
          : "Files store as given up to ") +
        formatFileSize(MAX_INLINE_ASSET_BYTES) +
        " — this one is " +
        formatFileSize(bytes) +
        ".",
    };
  }
  function bytesToFileDataUrl(mimeType: string, bytes: Uint8Array): string {
    let binaryString = "",
      chunkSize: number = 32768;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binaryString += String.fromCharCode(
        ...bytes.subarray(index, index + chunkSize),
      );
    }
    return "data:" + mimeType + ";base64," + btoa(binaryString);
  }
  function assetNameFromFileName(fileName: string): string {
    let name = fileName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (name === "") {
      return "Untitled asset";
    } else {
      return name;
    }
  }
  function cachedBlobDataUrl(url: string): string | undefined {
    return blobDataUrlCache.get(url);
  }
  function subscribeBlobResources(listener: () => void): () => void {
    blobResourceSubscribers.add(listener);
    return () => blobResourceSubscribers.delete(listener);
  }
  function notifyBlobResources(): void {
    blobResourceGeneration++;
    for (let value of blobResourceSubscribers) {
      value();
    }
  }
  function reportBlobReadFailure(url: string, bytes: number): void {
    if (reportedBlobReadFailures.has(url)) {
      return;
    }
    reportedBlobReadFailures.add(url);
    if (typeof console !== "undefined") {
      console.info(
        "[design-system] " +
          url +
          " is " +
          String(Math.round(bytes / 1048576)) +
          " MB — the type specimens use a fallback face above " +
          String(MAX_BLOB_READ_BYTES / 1048576) +
          " MB",
      );
    }
  }
  function readBlobDataUrl(
    url: string,
    mimeType: string,
    fetcher?: Editor.BlobFetcher,
    expectedBytes: number = 0,
  ): Promise<string | null> {
    let cached = blobDataUrlCache.get(url);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    if (expectedBytes > MAX_BLOB_READ_BYTES) {
      reportBlobReadFailure(url, expectedBytes);
    }
    if (
      reportedBlobReadFailures.has(url) ||
      (blobReadFailureCounts.get(url) ?? 0) >= MAX_BLOB_READ_ATTEMPTS
    ) {
      return Promise.resolve(null);
    }
    let inFlight = blobReadPromises.get(url);
    if (inFlight !== undefined) {
      return inFlight;
    }
    let fetchBlob =
      fetcher ??
      (typeof fetch === "function"
        ? (input: string) =>
            fetch(input, {
              credentials: "same-origin",
            })
        : undefined);
    if (fetchBlob === undefined) {
      blobReadFailureCounts.set(url, MAX_BLOB_READ_ATTEMPTS);
      return Promise.resolve(null);
    }
    let fetchUrl = url.startsWith("_blob/") ? "/" + url : url,
      promise = (async (): Promise<string | null> => {
        try {
          let value = await fetchBlob(fetchUrl);
          if (!value.ok) {
            throw Error("not ok");
          }
          let value2 = new Uint8Array(await value.arrayBuffer());
          if (value2.length > MAX_BLOB_READ_BYTES) {
            reportBlobReadFailure(url, value2.length);
            return null;
          }
          let value3 =
              mimeType !== ""
                ? mimeType
                : (value.headers?.get("content-type") ?? "")
                    .split(";")[0]
                    ?.trim() || "application/octet-stream",
            value4 = bytesToFileDataUrl(value3, value2);
          blobDataUrlCache.set(url, value4);
          notifyBlobResources();
          return value4;
        } catch {
          let value = (blobReadFailureCounts.get(url) ?? 0) + 1;
          blobReadFailureCounts.set(url, value);
          if (value < MAX_BLOB_READ_ATTEMPTS && fetcher === undefined) {
            setTimeout(
              () =>
                void readBlobDataUrl(url, mimeType, undefined, expectedBytes),
              BLOB_READ_RETRY_DELAY_MS,
            );
          }
          return null;
        } finally {
          blobReadPromises.delete(url);
        }
      })();
    blobReadPromises.set(url, promise);
    return promise;
  }
  function useBlobDataUrls(resources: Editor.BlobResource[]): number {
    let [value, value2] = reactBlobResource.useState(blobResourceGeneration);
    reactBlobResource.useEffect(
      () => subscribeBlobResources(() => value2(blobResourceGeneration)),
      [],
    );
    let value3 = resources.map((input) => input.src).join(`
`);
    reactBlobResource.useEffect((): void => {
      for (let value4 of resources) {
        if (value4.src !== "" && !/^data:/i.test(value4.src)) {
          readBlobDataUrl(
            value4.src,
            value4.type,
            undefined,
            value4.bytes ?? 0,
          );
        }
      }
    }, [value3, value]);
    return value;
  }
  bindRuntimeValue(
    runtime,
    "reactBlobResource",
    () => reactBlobResource,
    (value) => {
      reactBlobResource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_ASSET_BYTES",
    () => MAX_INLINE_ASSET_BYTES,
    (value) => {
      MAX_INLINE_ASSET_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_FONT_BYTES",
    () => MAX_INLINE_FONT_BYTES,
    (value) => {
      MAX_INLINE_FONT_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_VIDEO_BYTES",
    () => MAX_INLINE_VIDEO_BYTES,
    (value) => {
      MAX_INLINE_VIDEO_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_FILE_EXTENSIONS",
    () => FONT_FILE_EXTENSIONS,
    (value) => {
      FONT_FILE_EXTENSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VIDEO_FILE_EXTENSIONS",
    () => VIDEO_FILE_EXTENSIONS,
    (value) => {
      VIDEO_FILE_EXTENSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_MIME_EXTENSIONS",
    () => ASSET_MIME_EXTENSIONS,
    (value) => {
      ASSET_MIME_EXTENSIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_EXTENSION_ALIASES",
    () => ASSET_EXTENSION_ALIASES,
    (value) => {
      ASSET_EXTENSION_ALIASES = value;
    },
  );
  bindRuntimeValue(runtime, "assetFileExtension", () => assetFileExtension);
  bindRuntimeValue(
    runtime,
    "FONT_FILE_ACCEPT",
    () => FONT_FILE_ACCEPT,
    (value) => {
      FONT_FILE_ACCEPT = value;
    },
  );
  bindRuntimeValue(runtime, "isFontFile", () => isFontFile);
  bindRuntimeValue(
    runtime,
    "assetUploadDestination",
    () => assetUploadDestination,
  );
  bindRuntimeValue(runtime, "formatFileSize", () => formatFileSize);
  bindRuntimeValue(runtime, "classifyAssetUpload", () => classifyAssetUpload);
  bindRuntimeValue(runtime, "bytesToFileDataUrl", () => bytesToFileDataUrl);
  bindRuntimeValue(
    runtime,
    "ASSET_EXTENSION_MIME_TYPES",
    () => ASSET_EXTENSION_MIME_TYPES,
    (value) => {
      ASSET_EXTENSION_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetNameFromFileName",
    () => assetNameFromFileName,
  );
  bindRuntimeValue(
    runtime,
    "MAX_BLOB_READ_BYTES",
    () => MAX_BLOB_READ_BYTES,
    (value) => {
      MAX_BLOB_READ_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_BLOB_READ_ATTEMPTS",
    () => MAX_BLOB_READ_ATTEMPTS,
    (value) => {
      MAX_BLOB_READ_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOB_READ_RETRY_DELAY_MS",
    () => BLOB_READ_RETRY_DELAY_MS,
    (value) => {
      BLOB_READ_RETRY_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobDataUrlCache",
    () => blobDataUrlCache,
    (value) => {
      blobDataUrlCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobReadFailureCounts",
    () => blobReadFailureCounts,
    (value) => {
      blobReadFailureCounts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportedBlobReadFailures",
    () => reportedBlobReadFailures,
    (value) => {
      reportedBlobReadFailures = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobReadPromises",
    () => blobReadPromises,
    (value) => {
      blobReadPromises = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobResourceSubscribers",
    () => blobResourceSubscribers,
    (value) => {
      blobResourceSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobResourceGeneration",
    () => blobResourceGeneration,
    (value) => {
      blobResourceGeneration = value;
    },
  );
  bindRuntimeValue(runtime, "cachedBlobDataUrl", () => cachedBlobDataUrl);
  bindRuntimeValue(
    runtime,
    "subscribeBlobResources",
    () => subscribeBlobResources,
  );
  bindRuntimeValue(runtime, "notifyBlobResources", () => notifyBlobResources);
  bindRuntimeValue(
    runtime,
    "reportBlobReadFailure",
    () => reportBlobReadFailure,
  );
  bindRuntimeValue(runtime, "readBlobDataUrl", () => readBlobDataUrl);
  bindRuntimeValue(runtime, "useBlobDataUrls", () => useBlobDataUrls);
  return () => {
    reactBlobResource = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    MAX_INLINE_ASSET_BYTES =
      Math.floor((runtime.DESIGN_SYSTEM_INLINE_LIMITS.asset * 3) / 4) - 1024;
    MAX_INLINE_FONT_BYTES =
      Math.floor((runtime.DESIGN_SYSTEM_INLINE_LIMITS.font * 3) / 4) - 1024;
    MAX_INLINE_VIDEO_BYTES = MAX_INLINE_ASSET_BYTES;
    FONT_FILE_EXTENSIONS = ["woff2", "woff", "ttf", "otf"];
    VIDEO_FILE_EXTENSIONS = ["mp4", "webm"];
    ASSET_MIME_EXTENSIONS = {
      "image/png": "png",
      "image/jpeg": "jpeg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "font/woff2": "woff2",
      "font/woff": "woff",
      "application/font-woff": "woff",
      "font/ttf": "ttf",
      "font/otf": "otf",
    };
    ASSET_EXTENSION_ALIASES = {
      png: "png",
      jpg: "jpeg",
      jpeg: "jpeg",
      webp: "webp",
      gif: "gif",
      svg: "svg",
      mp4: "mp4",
      webm: "webm",
      woff2: "woff2",
      woff: "woff",
      ttf: "ttf",
      otf: "otf",
    };
    FONT_FILE_ACCEPT = FONT_FILE_EXTENSIONS.map(
      (input): string => "." + input,
    ).join(",");
    ASSET_EXTENSION_MIME_TYPES = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      woff2: "font/woff2",
      woff: "font/woff",
      ttf: "font/ttf",
      otf: "font/otf",
    };
    MAX_BLOB_READ_BYTES = 4194304;
    MAX_BLOB_READ_ATTEMPTS = 2;
    BLOB_READ_RETRY_DELAY_MS = 5000;
    blobDataUrlCache = new Map();
    blobReadFailureCounts = new Map();
    reportedBlobReadFailures = new Set();
    blobReadPromises = new Map();
    blobResourceSubscribers = new Set();
    blobResourceGeneration = 0;
  };
}

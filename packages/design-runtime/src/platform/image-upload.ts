/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformImageUpload(
  runtime: RuntimeBindings,
): () => void {
  var blobAssetPathPattern: Dynamic;
  var uploadImageMimeTypes: Dynamic;
  var maxImageUploadBytes: Dynamic;
  var maxDownsampledImageBytes: Dynamic;
  var maxImageUploadEdge: Dynamic;
  var downsampleUploadImage: Dynamic;
  var expectedUploadFailureReasons: Dynamic;
  var uploadFailureCodeMap: Dynamic;
  async function getAssetsCapability(): Promise<Dynamic> {
    // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
    let claude: Dynamic = (globalThis as Dynamic).designHost;
    return typeof claude?.use == "function"
      ? (0, runtime.awaitHostCapability)(
          "assets",
          (0, runtime.hasCapabilityMethod)("upload"),
        )
      : typeof claude?.assets?.upload == "function"
        ? claude.assets
        : null;
  }
  function isEmulatorBlobUrl(input?: Dynamic): Dynamic {
    return input.startsWith("blob:") && (0, runtime.isEmulator)();
  }
  function isBlobAssetUrl(input?: Dynamic): Dynamic {
    return blobAssetPathPattern.test(input) || isEmulatorBlobUrl(input);
  }
  function normalizeUploadedAsset(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return;
    let value: Dynamic = input,
      value2: Dynamic = typeof value.id == "string" ? value.id : "",
      value3: Dynamic = typeof value.url == "string" ? value.url : "",
      value4: Dynamic =
        blobAssetPathPattern.test(value3) || isEmulatorBlobUrl(value3)
          ? value3
          : /^[0-9a-f]{32}$/.test(value2)
            ? "_blob/" + value2
            : "";
    if (value4 !== "")
      return {
        id: value2 || value4.slice(-32),
        src: value4,
        bytes: typeof value.sizeBytes == "number" ? value.sizeBytes : 0,
      };
  }
  async function readImageMaxEdge(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = await createImageBitmap(input),
        value2: Dynamic = Math.max(value.width, value.height);
      value.close();
      return value2;
    } catch {
      return 0;
    }
  }
  async function prepareImageUpload(input?: Dynamic): Promise<Dynamic> {
    return input.size <= maxDownsampledImageBytes &&
      (await readImageMaxEdge(input)) <= maxImageUploadEdge
      ? input
      : downsampleUploadImage(input);
  }
  async function uploadImageWithFallback(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = options.downsample ?? runtime.downsampleImageToDataUrl,
      callback: Dynamic = async (input2?: Dynamic): Promise<Dynamic> => ({
        kind: "data",
        src: await value(input, {
          maxBytes: options.maxDataBytes ?? 70 * 1024,
        }),
        reason: input2,
      }),
      type: Dynamic = input.type,
      value2: Dynamic = uploadImageMimeTypes.includes(type),
      value3: Dynamic =
        type === "image/avif" ||
        type === "image/bmp" ||
        type === "image/svg+xml";
    if (!value2 && !value3) return callback("unsupported_type");
    let value4: Dynamic = type === "image/gif";
    if (value4 && input.size > maxImageUploadBytes)
      return callback("too_large");
    let value5: Dynamic = await getAssetsCapability();
    if (value5 === null || typeof value5.upload != "function")
      return callback("unavailable");
    let value6: Dynamic = input;
    if (!value4)
      try {
        value6 = value3
          ? await (options.transcode ?? downsampleUploadImage)(input)
          : await (options.downsize ?? prepareImageUpload)(input);
      } catch {
        return callback("downsize_failed");
      }
    try {
      let value7: Dynamic = normalizeUploadedAsset(
        await value5.upload.call(value5, value6, {
          type: value6.type || type,
        }),
      );
      return value7 === undefined
        ? callback("bad_result")
        : {
            kind: "blob",
            ...value7,
          };
    } catch (value7: Dynamic) {
      let value8: Dynamic =
        typeof value7 == "object" && value7 !== null
          ? String(value7.code ?? "")
          : "";
      return callback(value8 || "upload_failed");
    }
  }
  function classifyUploadResult(source?: Dynamic): Dynamic {
    return source.kind === "blob"
      ? ["upload", "success"]
      : expectedUploadFailureReasons.has(source.reason)
        ? null
        : [
            "upload",
            "failure",
            (Object.hasOwn(uploadFailureCodeMap, source.reason)
              ? uploadFailureCodeMap[source.reason]
              : undefined) ?? "capability_error",
          ];
  }
  bindRuntimeValue(
    runtime,
    "blobAssetPathPattern",
    () => blobAssetPathPattern,
    (value) => {
      blobAssetPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "uploadImageMimeTypes",
    () => uploadImageMimeTypes,
    (value) => {
      uploadImageMimeTypes = value;
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
    "maxDownsampledImageBytes",
    () => maxDownsampledImageBytes,
    (value) => {
      maxDownsampledImageBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxImageUploadEdge",
    () => maxImageUploadEdge,
    (value) => {
      maxImageUploadEdge = value;
    },
  );
  bindRuntimeValue(runtime, "getAssetsCapability", () => getAssetsCapability);
  bindRuntimeValue(runtime, "isEmulatorBlobUrl", () => isEmulatorBlobUrl);
  bindRuntimeValue(runtime, "isBlobAssetUrl", () => isBlobAssetUrl);
  bindRuntimeValue(
    runtime,
    "normalizeUploadedAsset",
    () => normalizeUploadedAsset,
  );
  bindRuntimeValue(runtime, "readImageMaxEdge", () => readImageMaxEdge);
  bindRuntimeValue(
    runtime,
    "downsampleUploadImage",
    () => downsampleUploadImage,
    (value) => {
      downsampleUploadImage = value;
    },
  );
  bindRuntimeValue(runtime, "prepareImageUpload", () => prepareImageUpload);
  bindRuntimeValue(
    runtime,
    "uploadImageWithFallback",
    () => uploadImageWithFallback,
  );
  bindRuntimeValue(
    runtime,
    "expectedUploadFailureReasons",
    () => expectedUploadFailureReasons,
    (value) => {
      expectedUploadFailureReasons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "uploadFailureCodeMap",
    () => uploadFailureCodeMap,
    (value) => {
      uploadFailureCodeMap = value;
    },
  );
  bindRuntimeValue(runtime, "classifyUploadResult", () => classifyUploadResult);
  return () => {
    blobAssetPathPattern = /^\/?_blob\/[0-9a-f]{32}$/;
    uploadImageMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    maxImageUploadBytes = 2 * 1024 * 1024;
    maxDownsampledImageBytes = 1.5 * 1024 * 1024;
    maxImageUploadEdge = 2560;
    downsampleUploadImage = (input?: Dynamic): Dynamic =>
      (0, runtime.downsampleImageBlob)(input, {
        maxEdge: maxImageUploadEdge,
        maxBytes: maxDownsampledImageBytes,
      });
    expectedUploadFailureReasons = new Set([
      "unavailable",
      "unsupported_type",
      "old_quicktime",
      "unplayable",
      "too_large",
      "not_granted",
      "capability_disabled",
      "capability_removed",
    ]);
    uploadFailureCodeMap = {
      downsize_failed: "invalid_content",
      bad_result: "capability_error",
      upload_failed: "unknown",
      probe_timeout: "transient",
      invalid_request: "internal",
      quota_or_state: "too_large",
      rate_limited: "backpressure",
      store_unavailable: "transient",
      upstream_auth: "capability_error",
      upstream_error: "capability_error",
      transform_error: "capability_error",
    };
  };
}

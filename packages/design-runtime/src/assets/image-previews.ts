/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installAssetsImagePreviews(
  runtime: RuntimeBindings,
): () => void {
  var imagePreviewMaxBytes: Dynamic;
  var imageMimeByExtension: Dynamic;
  var imagePreviewCache: Dynamic;
  var inlineImagePreview: Dynamic;
  function resolveImagePreviewUrl(source?: Dynamic, files?: Dynamic): Dynamic {
    let value: Dynamic = inlineImagePreview(source);
    if (value !== null) return value;
    if (!source.startsWith("./")) return null;
    let value2: Dynamic = source.slice(2),
      value3: Dynamic = files[value2];
    if (typeof value3 != "string" || value3.length > imagePreviewMaxBytes)
      return null;
    let entry: Dynamic = imagePreviewCache.get(value2);
    if (entry !== undefined && entry.b64 === value3) return entry.url;
    let entry2: Dynamic = imageMimeByExtension.get(
      value2.slice(value2.lastIndexOf(".") + 1).toLowerCase(),
    );
    if (entry2 === undefined) return null;
    let value4: Dynamic = "data:" + entry2 + ";base64," + value3;
    imagePreviewCache.set(value2, {
      b64: value3,
      url: value4,
    });
    imagePreviewCache.size > 64 &&
      imagePreviewCache.delete(imagePreviewCache.keys().next().value);
    return value4;
  }
  bindRuntimeValue(
    runtime,
    "imagePreviewMaxBytes",
    () => imagePreviewMaxBytes,
    (value) => {
      imagePreviewMaxBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageMimeByExtension",
    () => imageMimeByExtension,
    (value) => {
      imageMimeByExtension = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imagePreviewCache",
    () => imagePreviewCache,
    (value) => {
      imagePreviewCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inlineImagePreview",
    () => inlineImagePreview,
    (value) => {
      inlineImagePreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveImagePreviewUrl",
    () => resolveImagePreviewUrl,
  );
  return () => {
    imagePreviewMaxBytes = 256 * 1024;
    imageMimeByExtension = new Map([
      ["png", "image/png"],
      ["jpg", "image/jpeg"],
      ["jpeg", "image/jpeg"],
      ["gif", "image/gif"],
      ["webp", "image/webp"],
      ["svg", "image/svg+xml"],
      ["avif", "image/avif"],
    ]);
    imagePreviewCache = new Map();
    inlineImagePreview = (input?: Dynamic): Dynamic =>
      (0, runtime.isBlobAssetUrl)(input)
        ? input.startsWith("_blob/")
          ? "/" + input
          : input
        : null;
  };
}

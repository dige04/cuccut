/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewBlobPaths(runtime: RuntimeBindings): () => void {
  var PreviewBlobPathsResolvedValue: Dynamic;
  var PreviewBlobPathsBlobPattern: Dynamic;
  function normalizeBlobAssetPaths(input?: Dynamic): Dynamic {
    return input.includes("_blob/")
      ? input.replace(
          PreviewBlobPathsBlobPattern,
          (input2?: Dynamic, options?: Dynamic, context?: Dynamic): Dynamic =>
            options + "/_blob/" + context,
        )
      : input;
  }
  function normalizeProjectBlobPaths(input?: Dynamic): Dynamic {
    let value: Dynamic = null;
    for (let [value2, value3] of Object.entries(input) as Dynamic) {
      if (!(0, runtime.isProjectSourcePath)(value2)) continue;
      let value4: Dynamic = normalizeBlobAssetPaths(value3);
      value4 !== value3 &&
        ((value ??= {
          ...input,
        })[value2] = value4);
    }
    return value ?? input;
  }
  bindRuntimeValue(
    runtime,
    "PreviewBlobPathsResolvedValue",
    () => PreviewBlobPathsResolvedValue,
    (value) => {
      PreviewBlobPathsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewBlobPathsBlobPattern",
    () => PreviewBlobPathsBlobPattern,
    (value) => {
      PreviewBlobPathsBlobPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeBlobAssetPaths",
    () => normalizeBlobAssetPaths,
  );
  bindRuntimeValue(
    runtime,
    "normalizeProjectBlobPaths",
    () => normalizeProjectBlobPaths,
  );
  return () => {
    PreviewBlobPathsResolvedValue =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" fill="#e8e6e1"/><path d="M56 78l16-20 12 14 8-9 12 15H56z" fill="#c9c6bf"/><circle cx="98" cy="48" r="6" fill="#c9c6bf"/></svg>',
      );
    PreviewBlobPathsBlobPattern =
      /(^|[^\w/.:-])(?:\.?\/)?_blob\/([0-9a-f]{32})(?![0-9a-f])/g;
  };
}

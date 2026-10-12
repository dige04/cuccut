/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewProjectRoot(
  runtime: RuntimeBindings,
): () => void {
  var PreviewProjectRootElementCache: Dynamic;
  function setPreviewProjectRoot(input?: Dynamic, options?: Dynamic): Dynamic {
    input != null &&
      (options === undefined
        ? PreviewProjectRootElementCache.delete(input)
        : PreviewProjectRootElementCache.set(input, options));
  }
  function stripPreviewProjectRoot(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
      options == null ? undefined : PreviewProjectRootElementCache.get(options);
    if (value === undefined) return input;
    let value2: Dynamic = value.replace(/^\//, "");
    return input.startsWith(value2) ? input.slice(value2.length) : input;
  }
  bindRuntimeValue(
    runtime,
    "PreviewProjectRootElementCache",
    () => PreviewProjectRootElementCache,
    (value) => {
      PreviewProjectRootElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setPreviewProjectRoot",
    () => setPreviewProjectRoot,
  );
  bindRuntimeValue(
    runtime,
    "stripPreviewProjectRoot",
    () => stripPreviewProjectRoot,
  );
  return () => {
    PreviewProjectRootElementCache = new WeakMap();
  };
}

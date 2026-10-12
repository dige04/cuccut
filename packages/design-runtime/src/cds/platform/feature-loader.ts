/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installCdsPlatformFeatureLoader(
  runtime: RuntimeBindings,
): () => void {
  var featureLoaderOverride: Dynamic;
  var initializePlatformFeatureLoader: Dynamic;
  function loadApplicationFeature(input?: Dynamic, options?: Dynamic): Dynamic {
    try {
      return featureLoaderOverride
        ? Promise.resolve(featureLoaderOverride(input, options))
        : options();
    } catch (value: Dynamic) {
      return Promise.reject(
        value instanceof Error ? value : new Error(String(value)),
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "loadApplicationFeature",
    () => loadApplicationFeature,
  );
  bindRuntimeValue(
    runtime,
    "featureLoaderOverride",
    () => featureLoaderOverride,
    (value) => {
      featureLoaderOverride = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePlatformFeatureLoader",
    () => initializePlatformFeatureLoader,
    (value) => {
      initializePlatformFeatureLoader = value;
    },
  );
  return () => {
    initializePlatformFeatureLoader = (0, runtime.initializeOnce)(
      (): Dynamic => {},
    );
  };
}

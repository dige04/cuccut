/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformBlobCache(runtime: RuntimeBindings): () => void {
  var blobFetchPromises: Dynamic;
  var blobObjectUrls: Dynamic;
  var blobCacheSizes: Dynamic;
  var blobCacheBytes: Dynamic;
  var maxBlobCacheBytes: Dynamic;
  var blobFetchFailures: Dynamic;
  var blobFailureCooldownMs: Dynamic;
  function recordBlobCacheSize(input?: Dynamic, options?: Dynamic): Dynamic {
    blobCacheSizes.set(input, options);
    blobCacheBytes += options;
    for (let [value, value2] of blobCacheSizes as Dynamic) {
      if (blobCacheBytes <= maxBlobCacheBytes) break;
      value !== input &&
        (blobCacheSizes.delete(value),
        blobFetchPromises.delete(value),
        blobObjectUrls.delete(value),
        (blobCacheBytes -= value2));
    }
  }
  function fetchBlobAsset(
    input?: Dynamic,
    options: Dynamic = 8e3,
    context: Dynamic = {},
  ): Dynamic {
    let entry: Dynamic = blobFetchPromises.get(input);
    if (entry !== undefined) return entry;
    let entry2: Dynamic = blobFetchFailures.get(input);
    if (
      entry2 !== undefined &&
      context.ignoreRecentFailure !== true &&
      Date.now() - entry2 < blobFailureCooldownMs
    )
      return Promise.reject(new Error("blob fetch failed recently"));
    let value: Dynamic = (async (): Promise<Dynamic> => {
      if (!(0, runtime.isBlobAssetUrl)(input))
        throw new Error("not a blob ref");
      let value2: Dynamic =
          typeof AbortController == "function"
            ? new AbortController()
            : undefined,
        value3: Dynamic = setTimeout((): Dynamic => value2?.abort(), options);
      try {
        let value4: Dynamic = await fetch(input, {
          credentials: "same-origin",
          signal: value2?.signal,
        });
        if (!value4.ok)
          throw Object.assign(
            new Error("blob fetch " + String(value4.status)),
            {
              status: value4.status,
            },
          );
        let value5: Dynamic = await value4.blob();
        return await new Promise(
          (input2?: Dynamic, options2?: Dynamic): Dynamic => {
            let value6: Dynamic = new FileReader();
            value6.onload = (): Dynamic => input2(String(value6.result));
            value6.onerror = (): Dynamic =>
              options2(new Error("blob read failed"));
            value6.readAsDataURL(value5);
          },
        );
      } finally {
        clearTimeout(value3);
      }
    })();
    blobFetchPromises.set(input, value);
    value.then(
      (items?: Dynamic): Dynamic => {
        blobObjectUrls.set(input, items);
        recordBlobCacheSize(input, items.length);
      },
      (): Dynamic => {
        blobFetchPromises.delete(input);
        blobFetchFailures.set(input, Date.now());
      },
    );
    return value;
  }
  function getCachedBlobObjectUrl(input?: Dynamic): Dynamic {
    return blobObjectUrls.get(input);
  }
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
    "blobCacheSizes",
    () => blobCacheSizes,
    (value) => {
      blobCacheSizes = value;
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
    "blobFetchFailures",
    () => blobFetchFailures,
    (value) => {
      blobFetchFailures = value;
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
  bindRuntimeValue(runtime, "recordBlobCacheSize", () => recordBlobCacheSize);
  bindRuntimeValue(runtime, "fetchBlobAsset", () => fetchBlobAsset);
  bindRuntimeValue(
    runtime,
    "getCachedBlobObjectUrl",
    () => getCachedBlobObjectUrl,
  );
  return () => {
    blobFetchPromises = new Map();
    blobObjectUrls = new Map();
    blobCacheSizes = new Map();
    blobCacheBytes = 0;
    maxBlobCacheBytes = 48 * 1024 * 1024;
    blobFetchFailures = new Map();
    blobFailureCooldownMs = 3e4;
  };
}

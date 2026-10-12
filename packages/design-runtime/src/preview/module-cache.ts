/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewModuleCache(
  runtime: RuntimeBindings,
): () => void {
  var PreviewModuleCacheResolvedValue: Dynamic;
  var PreviewModuleCacheDelayMs: Dynamic;
  var PreviewModuleCacheFilePattern: Dynamic;
  var PreviewModuleCacheCache: Dynamic;
  var PreviewModuleCacheLengthValue: Dynamic;
  var PreviewModuleCacheResolvedValue_2: Dynamic;
  var PreviewModuleCacheResolvedValue_3: Dynamic;
  var PreviewModuleCacheCache_2: Dynamic;
  var PreviewModuleCacheLengthValue_2: Dynamic;
  function revokeRuntimeModuleUrl(input?: Dynamic): Dynamic {
    let url: Dynamic = input.url;
    url !== undefined &&
      setTimeout(
        (): Dynamic => URL.revokeObjectURL(url),
        PreviewModuleCacheDelayMs,
      );
  }
  function populateRuntimeModuleCache(input?: Dynamic): Dynamic {
    for (let [value, value2] of Object.entries(input) as Dynamic) {
      let entry: Dynamic = PreviewModuleCacheCache.get(value);
      (entry === undefined || entry.text !== value2) &&
        (entry !== undefined &&
          ((PreviewModuleCacheLengthValue -= entry.text.length),
          revokeRuntimeModuleUrl(entry)),
        (entry = {
          text: value2,
          blob: new Blob([value2], {
            type: PreviewModuleCacheFilePattern.test(value)
              ? "text/javascript"
              : "text/plain",
          }),
        }),
        (PreviewModuleCacheLengthValue += value2.length));
      PreviewModuleCacheCache.delete(value);
      PreviewModuleCacheCache.set(value, entry);
    }
    for (let [value, value2] of PreviewModuleCacheCache as Dynamic) {
      if (PreviewModuleCacheLengthValue <= PreviewModuleCacheResolvedValue)
        break;
      value in input ||
        (PreviewModuleCacheCache.delete(value),
        (PreviewModuleCacheLengthValue -= value2.text.length));
    }
  }
  function runtimeModuleBlobs(input?: Dynamic): Dynamic {
    populateRuntimeModuleCache(input);
    let state: Dynamic = {};
    for (let value of Object.keys(input) as Dynamic)
      state[value] = PreviewModuleCacheCache.get(value).blob;
    return state;
  }
  function runtimeModuleUrls(
    input?: Dynamic,
    options: Dynamic = (0, runtime.supportsBlobScripts)(),
  ): Dynamic {
    let state: Dynamic = {};
    if (!options) return state;
    populateRuntimeModuleCache(input);
    for (let value of Object.keys(input) as Dynamic) {
      let value2: Dynamic = PreviewModuleCacheFilePattern.exec(value);
      if (value2 === null) continue;
      let entry: Dynamic = PreviewModuleCacheCache.get(value);
      entry.url ??= URL.createObjectURL(
        new Blob(
          [
            entry.blob,
            `
//# sourceURL=/appifact/` + encodeURI(value2[1]),
          ],
          {
            type: "text/javascript",
          },
        ),
      );
      state[value2[1]] = entry.url;
    }
    return state;
  }
  function createLinkedFileScript(
    input?: Dynamic,
    items?: Dynamic,
    context: Dynamic = (0, runtime.supportsBlobScripts)(),
  ): Dynamic {
    if (!context || items.length < PreviewModuleCacheResolvedValue_3) return;
    let value: Dynamic = input + "\0" + items,
      entry: Dynamic = PreviewModuleCacheCache_2.get(value);
    entry === undefined
      ? ((entry = URL.createObjectURL(
          new Blob(
            [
              "(window.__dcFiles=window.__dcFiles||{})[",
              JSON.stringify(input),
              "]=",
              JSON.stringify(items),
              ";",
            ],
            {
              type: "text/javascript;charset=utf-8",
            },
          ),
        )),
        (PreviewModuleCacheLengthValue_2 += value.length))
      : PreviewModuleCacheCache_2.delete(value);
    PreviewModuleCacheCache_2.set(value, entry);
    for (let value2 of PreviewModuleCacheCache_2.keys() as Dynamic) {
      if (
        PreviewModuleCacheLengthValue_2 <= PreviewModuleCacheResolvedValue_2 ||
        value2 === value
      )
        break;
      PreviewModuleCacheCache_2.delete(value2);
      PreviewModuleCacheLengthValue_2 -= value2.length;
    }
    return entry;
  }
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheResolvedValue",
    () => PreviewModuleCacheResolvedValue,
    (value) => {
      PreviewModuleCacheResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheDelayMs",
    () => PreviewModuleCacheDelayMs,
    (value) => {
      PreviewModuleCacheDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheFilePattern",
    () => PreviewModuleCacheFilePattern,
    (value) => {
      PreviewModuleCacheFilePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheCache",
    () => PreviewModuleCacheCache,
    (value) => {
      PreviewModuleCacheCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheLengthValue",
    () => PreviewModuleCacheLengthValue,
    (value) => {
      PreviewModuleCacheLengthValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "revokeRuntimeModuleUrl",
    () => revokeRuntimeModuleUrl,
  );
  bindRuntimeValue(
    runtime,
    "populateRuntimeModuleCache",
    () => populateRuntimeModuleCache,
  );
  bindRuntimeValue(runtime, "runtimeModuleBlobs", () => runtimeModuleBlobs);
  bindRuntimeValue(runtime, "runtimeModuleUrls", () => runtimeModuleUrls);
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheResolvedValue_2",
    () => PreviewModuleCacheResolvedValue_2,
    (value) => {
      PreviewModuleCacheResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheResolvedValue_3",
    () => PreviewModuleCacheResolvedValue_3,
    (value) => {
      PreviewModuleCacheResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheCache_2",
    () => PreviewModuleCacheCache_2,
    (value) => {
      PreviewModuleCacheCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewModuleCacheLengthValue_2",
    () => PreviewModuleCacheLengthValue_2,
    (value) => {
      PreviewModuleCacheLengthValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createLinkedFileScript",
    () => createLinkedFileScript,
  );
  return () => {
    PreviewModuleCacheResolvedValue = 96 * 1024 * 1024;
    PreviewModuleCacheDelayMs = 6e4;
    PreviewModuleCacheFilePattern = /^file:(.*\.m?js)$/i;
    PreviewModuleCacheCache = new Map();
    PreviewModuleCacheLengthValue = 0;
    PreviewModuleCacheResolvedValue_2 = 32 * 1024 * 1024;
    PreviewModuleCacheResolvedValue_3 = 4 * 1024;
    PreviewModuleCacheCache_2 = new Map();
    PreviewModuleCacheLengthValue_2 = 0;
  };
}

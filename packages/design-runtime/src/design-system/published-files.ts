/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemPublishedFiles(
  runtime: RuntimeBindings,
): () => void {
  var DesignSystemPublishedFilesFromEntriesValue: Dynamic;
  var DesignSystemPublishedFilesCache: Dynamic;
  var DesignSystemPublishedFilesAlias: Dynamic;
  var DesignSystemPublishedFilesSubscribers: Dynamic;
  var DesignSystemPublishedFilesPattern: Dynamic;
  var DesignSystemPublishedFilesItems: Dynamic;
  var DesignSystemPublishedFilesResolvedValue: Dynamic;
  var DesignSystemPublishedFilesConstant: Dynamic;
  var DesignSystemPublishedFilesCache_2: Dynamic;
  var DesignSystemPublishedFilesSubscribers_2: Dynamic;
  var DesignSystemPublishedFilesResolvedValue_2: Dynamic;
  var DesignSystemPublishedFilesSubscribers_3: Dynamic;
  var getPublishedProjectRootValue: Dynamic;
  var DesignSystemPublishedFilesItems_2: Dynamic;
  var DesignSystemPublishedFilesLimit: Dynamic;
  var versionedProjectRootPattern: Dynamic;
  var DesignSystemPublishedFilesConstant_2: Dynamic;
  function getDesignSystemFiles(): Dynamic {
    return DesignSystemPublishedFilesFromEntriesValue;
  }
  function getDesignSystemFileUrl(input?: Dynamic): Dynamic {
    let entry: Dynamic = DesignSystemPublishedFilesCache.get(input);
    if (!(entry === undefined || typeof document === "undefined"))
      try {
        return new URL(
          entry.split("/").map(encodeURIComponent).join("/"),
          (document as Dynamic).baseURI,
        ).href;
      } catch {
        return;
      }
  }
  function designSystemNamespaceFromUrl(input?: Dynamic): Dynamic {
    try {
      let href: Dynamic = new URL(
          runtime.ProjectValue + "ds/",
          (document as Dynamic).baseURI,
        ).href,
        value: Dynamic = input.startsWith(href)
          ? input.slice(href.length).split("/")[0]
          : undefined;
      return value === undefined ||
        value === "" ||
        !input.startsWith(href + value + "/")
        ? undefined
        : href + value + "/";
    } catch {
      return;
    }
  }
  function invalidateDesignSystemUrl(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (typeof options != "string" || !input.has(options)) return;
    input.clear();
    let value: Dynamic = designSystemNamespaceFromUrl(options);
    return value === undefined ||
      DesignSystemPublishedFilesSubscribers_2.has(value)
      ? "again"
      : (DesignSystemPublishedFilesSubscribers_2.add(value),
        (DesignSystemPublishedFilesConstant += 1),
        "first");
  }
  function resetPublishedFileIndex(input?: Dynamic): Dynamic {
    DesignSystemPublishedFilesConstant += 1;
    DesignSystemPublishedFilesConstant_2 += 1;
    DesignSystemPublishedFilesSubscribers_2.clear();
    DesignSystemPublishedFilesSubscribers_3.clear();
    DesignSystemPublishedFilesResolvedValue =
      input === undefined ? undefined : new Map();
    DesignSystemPublishedFilesResolvedValue_2 =
      input === undefined ? undefined : new Set(Object.keys(input));
    getPublishedProjectRootValue =
      input === undefined ? undefined : getPublishedProjectRoot();
    DesignSystemPublishedFilesItems_2.length = 0;
    for (let [value, value2] of Object.entries(input ?? {}) as Dynamic) {
      let { sha256: value3, contentType: value4 }: Dynamic = value2 ?? {};
      typeof value3 == "string" &&
        DesignSystemPublishedFilesResolvedValue.set(value, {
          sha256: value3,
          ...(typeof value4 == "string"
            ? {
                contentType: value4,
              }
            : {}),
        });
    }
  }
  function removePublishedFiles(input?: Dynamic): Dynamic {
    for (let value of input as Dynamic)
      DesignSystemPublishedFilesResolvedValue?.delete(value) === true &&
        ((DesignSystemPublishedFilesConstant_2 += 1),
        value.startsWith(runtime.ProjectValue + "ds/") &&
          (DesignSystemPublishedFilesConstant += 1));
  }
  function updatePublishedFileIndex(input?: Dynamic): Dynamic {
    DesignSystemPublishedFilesConstant += 1;
    DesignSystemPublishedFilesConstant_2 += 1;
    DesignSystemPublishedFilesResolvedValue !== undefined &&
      (getPublishedProjectRootValue = getPublishedProjectRoot());
    DesignSystemPublishedFilesItems_2.length = 0;
    for (let value of input as Dynamic)
      value.sha256 === null
        ? (DesignSystemPublishedFilesResolvedValue?.delete(value.path),
          DesignSystemPublishedFilesResolvedValue_2?.delete(value.path))
        : (DesignSystemPublishedFilesResolvedValue?.set(value.path, {
            sha256: value.sha256,
          }),
          DesignSystemPublishedFilesResolvedValue_2?.add(value.path));
  }
  function resolvePublishedDesignSystemFile(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (
      !DesignSystemPublishedFilesPattern.test(input) ||
      typeof document === "undefined" ||
      typeof location === "undefined" ||
      input
        .split("/")
        .some(
          (input2?: Dynamic): Dynamic =>
            input2 === "" || input2 === "." || input2 === "..",
        )
    )
      return;
    let value: Dynamic = DesignSystemPublishedFilesResolvedValue?.get(
      runtime.ProjectValue + input,
    );
    if (
      value === undefined ||
      (value.contentType !== undefined &&
        !DesignSystemPublishedFilesItems.some(
          ([input2, input3]: Dynamic): Dynamic =>
            input2.test(input) && input3.test(value.contentType),
        ))
    )
      return;
    let origin: Dynamic = (globalThis as Dynamic).origin;
    if (origin === undefined || origin === "null") return;
    let entry: Dynamic = DesignSystemPublishedFilesCache_2.get(input);
    entry?.text !== options &&
      DesignSystemPublishedFilesCache_2.set(
        input,
        (entry = {
          text: options,
          sha256: (0, runtime.sha256Fallback)(options),
        }),
      );
    if (entry.sha256 === value.sha256)
      try {
        let value2: Dynamic = new URL(
          runtime.ProjectValue +
            input.split("/").map(encodeURIComponent).join("/"),
          (document as Dynamic).baseURI,
        );
        return value2.origin === location.origin &&
          !DesignSystemPublishedFilesSubscribers_2.has(
            designSystemNamespaceFromUrl(value2.href) ?? "",
          )
          ? value2.href
          : undefined;
      } catch {
        return;
      }
  }
  function decodePublishedImage(input?: Dynamic, options?: Dynamic): Dynamic {
    if (!runtime.PlatformFileContentWebpAvifPattern.test(input)) return options;
    try {
      let value: Dynamic = atob(options),
        value2: Dynamic = new Uint8Array(value.length);
      for (let index: Dynamic = 0; index < value.length; index += 1)
        value2[index] = value.charCodeAt(index);
      return value2;
    } catch {
      return;
    }
  }
  function getPublishedProjectRoot(): Dynamic {
    if (typeof document === "undefined" || typeof location === "undefined")
      return;
    let origin: Dynamic = (globalThis as Dynamic).origin;
    if (!(origin === undefined || origin === "null"))
      try {
        let value: Dynamic = new URL(
          runtime.ProjectValue,
          (document as Dynamic).baseURI,
        );
        return value.origin === location.origin ? value.href : undefined;
      } catch {
        return;
      }
  }
  function recordPublishedVersion(input?: Dynamic): Dynamic {
    !input.ok ||
      input.own !== true ||
      input.version === undefined ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(input.version) ||
      getPublishedProjectRootValue === undefined ||
      (DesignSystemPublishedFilesItems_2.push(input.version),
      DesignSystemPublishedFilesItems_2.length >
        DesignSystemPublishedFilesLimit &&
        DesignSystemPublishedFilesItems_2.shift());
  }
  function isKnownPublishedVersion(input?: Dynamic): Dynamic {
    let value: Dynamic = versionedProjectRootPattern.exec(input),
      value2: Dynamic =
        getPublishedProjectRootValue === undefined
          ? null
          : versionedProjectRootPattern.exec(getPublishedProjectRootValue);
    return (
      value !== null &&
      value2 !== null &&
      value[1] === value2[1] &&
      DesignSystemPublishedFilesItems_2.includes(value[2])
    );
  }
  function describesPublishedRoot(input?: Dynamic): Dynamic {
    return DesignSystemPublishedFilesSubscribers_3.has(input)
      ? false
      : input === getPublishedProjectRootValue
        ? DesignSystemPublishedFilesItems_2.length <
          DesignSystemPublishedFilesLimit
        : isKnownPublishedVersion(input);
  }
  function getCurrentPublishedProjectRoot(): Dynamic {
    if (DesignSystemPublishedFilesResolvedValue === undefined) return;
    let value: Dynamic = getPublishedProjectRoot();
    return value !== undefined &&
      !DesignSystemPublishedFilesSubscribers_3.has(value) &&
      (value === getPublishedProjectRootValue || isKnownPublishedVersion(value))
      ? value
      : undefined;
  }
  function isFilePublishedWithMimeType(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (
      input
        .split("/")
        .some(
          (input2?: Dynamic): Dynamic =>
            input2 === "" || input2 === "." || input2 === "..",
        )
    )
      return false;
    let value: Dynamic = DesignSystemPublishedFilesResolvedValue?.get(
      runtime.ProjectValue + input,
    );
    if (value === undefined) return false;
    let value2: Dynamic = DesignSystemPublishedFilesItems.find(
      ([input2]: Dynamic): Dynamic => input2.test(input),
    );
    if (
      value2 !== undefined &&
      value.contentType !== undefined &&
      !value2[1].test(value.contentType)
    )
      return false;
    let entry: Dynamic = DesignSystemPublishedFilesCache_2.get(input);
    if (entry?.text !== options) {
      let value3: Dynamic = decodePublishedImage(input, options);
      if (value3 === undefined) return false;
      DesignSystemPublishedFilesCache_2.set(
        input,
        (entry = {
          text: options,
          sha256: (0, runtime.sha256Fallback)(value3),
        }),
      );
    }
    return entry.sha256 === value.sha256;
  }
  function isFilePublishedAtAddress(input?: Dynamic): Dynamic {
    return (
      DesignSystemPublishedFilesResolvedValue_2?.has(
        runtime.ProjectValue + input,
      ) === true
    );
  }
  function lookupPublishedUrl(items?: Dynamic, options?: Dynamic): Dynamic {
    if (
      !(
        items === undefined ||
        typeof options != "string" ||
        !options.startsWith(items)
      )
    )
      try {
        let value: Dynamic = decodeURIComponent(
          options.slice(items.length).split(/[?#]/)[0]!,
        );
        return (isKnownPublishedVersion(items)
          ? DesignSystemPublishedFilesResolvedValue?.has(
              runtime.ProjectValue + value,
            ) === true
          : isFilePublishedAtAddress(value)) && !/\.dc\.html$/i.test(value)
          ? value
          : undefined;
      } catch {
        return;
      }
  }
  function invalidatePublishedRoot(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (
      !(input === undefined || lookupPublishedUrl(input, options) === undefined)
    )
      return DesignSystemPublishedFilesSubscribers_3.has(input)
        ? "again"
        : (DesignSystemPublishedFilesSubscribers_3.add(input),
          (DesignSystemPublishedFilesConstant_2 += 1),
          "first");
  }
  function publishedProjectCacheKey(): Dynamic {
    return (
      (getCurrentPublishedProjectRoot() ?? "") +
      "#" +
      String(DesignSystemPublishedFilesConstant_2)
    );
  }
  function designSystemCacheKey(): Dynamic {
    try {
      return DesignSystemPublishedFilesResolvedValue !== undefined &&
        typeof document !== "undefined"
        ? new URL(runtime.ProjectValue, (document as Dynamic).baseURI).href +
            "#" +
            String(DesignSystemPublishedFilesConstant)
        : "";
    } catch {
      return "";
    }
  }
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesFromEntriesValue",
    () => DesignSystemPublishedFilesFromEntriesValue,
    (value) => {
      DesignSystemPublishedFilesFromEntriesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesCache",
    () => DesignSystemPublishedFilesCache,
    (value) => {
      DesignSystemPublishedFilesCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesAlias",
    () => DesignSystemPublishedFilesAlias,
    (value) => {
      DesignSystemPublishedFilesAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesSubscribers",
    () => DesignSystemPublishedFilesSubscribers,
    (value) => {
      DesignSystemPublishedFilesSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "getDesignSystemFiles", () => getDesignSystemFiles);
  bindRuntimeValue(
    runtime,
    "getDesignSystemFileUrl",
    () => getDesignSystemFileUrl,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesPattern",
    () => DesignSystemPublishedFilesPattern,
    (value) => {
      DesignSystemPublishedFilesPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesItems",
    () => DesignSystemPublishedFilesItems,
    (value) => {
      DesignSystemPublishedFilesItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesResolvedValue",
    () => DesignSystemPublishedFilesResolvedValue,
    (value) => {
      DesignSystemPublishedFilesResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesConstant",
    () => DesignSystemPublishedFilesConstant,
    (value) => {
      DesignSystemPublishedFilesConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesCache_2",
    () => DesignSystemPublishedFilesCache_2,
    (value) => {
      DesignSystemPublishedFilesCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesSubscribers_2",
    () => DesignSystemPublishedFilesSubscribers_2,
    (value) => {
      DesignSystemPublishedFilesSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesResolvedValue_2",
    () => DesignSystemPublishedFilesResolvedValue_2,
    (value) => {
      DesignSystemPublishedFilesResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesSubscribers_3",
    () => DesignSystemPublishedFilesSubscribers_3,
    (value) => {
      DesignSystemPublishedFilesSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getPublishedProjectRootValue",
    () => getPublishedProjectRootValue,
    (value) => {
      getPublishedProjectRootValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesItems_2",
    () => DesignSystemPublishedFilesItems_2,
    (value) => {
      DesignSystemPublishedFilesItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesLimit",
    () => DesignSystemPublishedFilesLimit,
    (value) => {
      DesignSystemPublishedFilesLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "versionedProjectRootPattern",
    () => versionedProjectRootPattern,
    (value) => {
      versionedProjectRootPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPublishedFilesConstant_2",
    () => DesignSystemPublishedFilesConstant_2,
    (value) => {
      DesignSystemPublishedFilesConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemNamespaceFromUrl",
    () => designSystemNamespaceFromUrl,
  );
  bindRuntimeValue(
    runtime,
    "invalidateDesignSystemUrl",
    () => invalidateDesignSystemUrl,
  );
  bindRuntimeValue(
    runtime,
    "resetPublishedFileIndex",
    () => resetPublishedFileIndex,
  );
  bindRuntimeValue(runtime, "removePublishedFiles", () => removePublishedFiles);
  bindRuntimeValue(
    runtime,
    "updatePublishedFileIndex",
    () => updatePublishedFileIndex,
  );
  bindRuntimeValue(
    runtime,
    "resolvePublishedDesignSystemFile",
    () => resolvePublishedDesignSystemFile,
  );
  bindRuntimeValue(runtime, "decodePublishedImage", () => decodePublishedImage);
  bindRuntimeValue(
    runtime,
    "getPublishedProjectRoot",
    () => getPublishedProjectRoot,
  );
  bindRuntimeValue(
    runtime,
    "recordPublishedVersion",
    () => recordPublishedVersion,
  );
  bindRuntimeValue(
    runtime,
    "isKnownPublishedVersion",
    () => isKnownPublishedVersion,
  );
  bindRuntimeValue(
    runtime,
    "describesPublishedRoot",
    () => describesPublishedRoot,
  );
  bindRuntimeValue(
    runtime,
    "getCurrentPublishedProjectRoot",
    () => getCurrentPublishedProjectRoot,
  );
  bindRuntimeValue(
    runtime,
    "isFilePublishedWithMimeType",
    () => isFilePublishedWithMimeType,
  );
  bindRuntimeValue(
    runtime,
    "isFilePublishedAtAddress",
    () => isFilePublishedAtAddress,
  );
  bindRuntimeValue(runtime, "lookupPublishedUrl", () => lookupPublishedUrl);
  bindRuntimeValue(
    runtime,
    "invalidatePublishedRoot",
    () => invalidatePublishedRoot,
  );
  bindRuntimeValue(
    runtime,
    "publishedProjectCacheKey",
    () => publishedProjectCacheKey,
  );
  bindRuntimeValue(runtime, "designSystemCacheKey", () => designSystemCacheKey);
  return () => {
    DesignSystemPublishedFilesFromEntriesValue = {};
    DesignSystemPublishedFilesCache = new Map();
    DesignSystemPublishedFilesAlias = "[[],0]";
    DesignSystemPublishedFilesSubscribers = new Set();
    DesignSystemPublishedFilesPattern = /^ds\/[^/]+\/[^/]/;
    DesignSystemPublishedFilesItems = [
      [/\.css$/i, /^text\/css\b/i],
      [/\.m?js$/i, /^(?:text|application)\/javascript\b/i],
    ];
    DesignSystemPublishedFilesConstant = 0;
    DesignSystemPublishedFilesCache_2 = new Map();
    DesignSystemPublishedFilesSubscribers_2 = new Set();
    DesignSystemPublishedFilesSubscribers_3 = new Set();
    DesignSystemPublishedFilesItems_2 = [];
    DesignSystemPublishedFilesLimit = 16;
    versionedProjectRootPattern = new RegExp(
      "^(.*/_f/)([^/]+)/" + runtime.ProjectValue + "$",
    );
    DesignSystemPublishedFilesConstant_2 = 0;
  };
}

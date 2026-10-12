/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasCompilationCache(
  runtime: RuntimeBindings,
): () => void {
  var jsx_ip: Dynamic;
  var equivalentDesignImportTags: Dynamic;
  var pageFilesCache: Dynamic;
  var maxArtboardCompileCacheEntries: Dynamic;
  var artboardCompileCache: Dynamic;
  var projectFileNamesCache: Dynamic;
  var lastDesignEditAt: Dynamic;
  var designEditQuietPeriodMs: Dynamic;
  var navigationProbeAttempts: Dynamic;
  var navigationProbeAttemptsAfterEdit: Dynamic;
  function selectPageFiles(files?: Dynamic): Dynamic {
    pageFilesCache?.all !== files &&
      (pageFilesCache = {
        all: files,
        pages: Object.fromEntries(
          Object.entries(files).filter(
            ([input]: Dynamic): Dynamic =>
              (0, runtime.PreviewAddressedArtboardsTest)(input),
          ),
        ),
      });
    return pageFilesCache.pages;
  }
  function createProjectAssetReadinessProbe(files?: Dynamic): Dynamic {
    let origin: Dynamic = (globalThis as Dynamic).origin;
    if (
      origin === undefined ||
      origin === "null" ||
      typeof location === "undefined"
    )
      return;
    let value: Dynamic = (0, runtime.getDesignSystemFiles)();
    return (input?: Dynamic): Dynamic => {
      if (
        files[input] !== value[input] ||
        !(0, runtime.isStandaloneStylesheet)(input, files, value)
      )
        return;
      let value2: Dynamic = (0, runtime.getDesignSystemFileUrl)(input);
      if (value2 !== undefined)
        try {
          return new URL(value2).origin === location.origin
            ? value2
            : undefined;
        } catch {
          return;
        }
    };
  }
  function getCachedArtboardCompilation(
    file?: Dynamic,
    files?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = artboardCompileCache.get(file);
    if (entry === undefined || entry.opts !== options) return null;
    for (let value in entry.closure)
      if (files[value] !== entry.closure[value]) return null;
    return entry.names !== projectFileNamesKey(files)
      ? null
      : (artboardCompileCache.delete(file),
        artboardCompileCache.set(file, entry),
        entry);
  }
  function cacheArtboardCompilation(
    file?: Dynamic,
    compilation?: Dynamic,
  ): Dynamic {
    for (
      artboardCompileCache.delete(file),
        artboardCompileCache.set(file, compilation);
      artboardCompileCache.size > maxArtboardCompileCacheEntries;

    )
      artboardCompileCache.delete(artboardCompileCache.keys().next().value);
  }
  function projectFileNamesKey(files?: Dynamic): Dynamic {
    if (projectFileNamesCache?.files === files)
      return projectFileNamesCache.key;
    let value: Dynamic = Object.keys(files).sort().join(`
`);
    projectFileNamesCache = {
      files: files,
      key: value,
    };
    return value;
  }
  function effectiveDesignPartMinScale(): Dynamic {
    let __designPartMin: Dynamic = (globalThis as Dynamic).__designPartMin;
    return typeof __designPartMin == "number" && __designPartMin >= 0
      ? __designPartMin
      : runtime.PreviewBuildDocumentResolvedValue;
  }
  function recordDesignEditActivity(): Dynamic {
    lastDesignEditAt = performance.now();
  }
  bindRuntimeValue(
    runtime,
    "jsx_ip",
    () => jsx_ip,
    (value) => {
      jsx_ip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "equivalentDesignImportTags",
    () => equivalentDesignImportTags,
    (value) => {
      equivalentDesignImportTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pageFilesCache",
    () => pageFilesCache,
    (value) => {
      pageFilesCache = value;
    },
  );
  bindRuntimeValue(runtime, "selectPageFiles", () => selectPageFiles);
  bindRuntimeValue(
    runtime,
    "createProjectAssetReadinessProbe",
    () => createProjectAssetReadinessProbe,
  );
  bindRuntimeValue(
    runtime,
    "maxArtboardCompileCacheEntries",
    () => maxArtboardCompileCacheEntries,
    (value) => {
      maxArtboardCompileCacheEntries = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardCompileCache",
    () => artboardCompileCache,
    (value) => {
      artboardCompileCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getCachedArtboardCompilation",
    () => getCachedArtboardCompilation,
  );
  bindRuntimeValue(
    runtime,
    "cacheArtboardCompilation",
    () => cacheArtboardCompilation,
  );
  bindRuntimeValue(
    runtime,
    "projectFileNamesCache",
    () => projectFileNamesCache,
    (value) => {
      projectFileNamesCache = value;
    },
  );
  bindRuntimeValue(runtime, "projectFileNamesKey", () => projectFileNamesKey);
  bindRuntimeValue(
    runtime,
    "effectiveDesignPartMinScale",
    () => effectiveDesignPartMinScale,
  );
  bindRuntimeValue(
    runtime,
    "lastDesignEditAt",
    () => lastDesignEditAt,
    (value) => {
      lastDesignEditAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designEditQuietPeriodMs",
    () => designEditQuietPeriodMs,
    (value) => {
      designEditQuietPeriodMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recordDesignEditActivity",
    () => recordDesignEditActivity,
  );
  bindRuntimeValue(
    runtime,
    "navigationProbeAttempts",
    () => navigationProbeAttempts,
    (value) => {
      navigationProbeAttempts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "navigationProbeAttemptsAfterEdit",
    () => navigationProbeAttemptsAfterEdit,
    (value) => {
      navigationProbeAttemptsAfterEdit = value;
    },
  );
  return () => {
    jsx_ip = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    equivalentDesignImportTags = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      input === options ||
      ((options === "dc-import" || options === "x-import") &&
        (input === "x-import" || input === "dc-import"));
    pageFilesCache = null;
    maxArtboardCompileCacheEntries = 64;
    artboardCompileCache = new Map();
    projectFileNamesCache = null;
    lastDesignEditAt = -1 / 0;
    designEditQuietPeriodMs = 3e3;
    navigationProbeAttempts = 3;
    navigationProbeAttemptsAfterEdit = 6;
  };
}

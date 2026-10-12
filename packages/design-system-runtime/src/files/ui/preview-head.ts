import type * as React from "react";
import type * as Preview from "../../contracts/preview";
import type * as Model from "../../contracts";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";

export function installFilesUiPreviewHead(
  runtime: RuntimeBindings,
): () => void {
  var preferLivePreviewUrls: boolean;
  var previewHeadCache: Preview.PreviewHeadCache;
  var supportsLivePreviewUrls: () => boolean;
  function blobRelativeUrl(id: string): string {
    return "/_blob/" + id;
  }
  function previewFontIdentity(
    system: Preview.PreviewSystem,
    path: string,
  ): string {
    let file = system.files[path];
    if (file === undefined) {
      return "missing:" + path;
    }
    let reference = (0, runtime.storagePointerForFile)(path, file);
    if (reference !== null) {
      return (
        reference.store +
        ":" +
        path +
        ":" +
        (reference.store === "blob"
          ? reference.id
          : reference.rel || ((0, runtime.resolveFileVersion)(path) ?? ""))
      );
    } else {
      return (
        "held:" +
        path +
        ":" +
        String((0, runtime.estimateDataUriBytes)(file)) +
        ":" +
        hashPreviewContent(file)
      );
    }
  }
  function hashPreviewContent(text: string): string {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  function previewFontSource(
    system: Preview.PreviewSystem,
    path: string,
    preferUrl: boolean = true,
  ): string | null {
    let file = system.files[path];
    if (file === undefined) {
      return null;
    }
    let reference = (0, runtime.storagePointerForFile)(path, file);
    if (reference !== null) {
      if (reference.store !== "blob") {
        let value = (0, runtime.isHeldFilePointer)(path, file)
          ? ((0, runtime.addressedProjectFileUrl)(path) ??
            system.fonts.find((input) => input.path === path)?.src ??
            "")
          : "";
        try {
          if (value === "") {
            return null;
          } else {
            return new URL(value, document.baseURI).pathname;
          }
        } catch {
          return null;
        }
      }
      if ((0, runtime.isClaudeEmulator)()) {
        let value =
          system.fonts.find((input) => input.path === path)?.src ?? "";
        if (value === "") {
          return null;
        } else {
          return value;
        }
      }
      return blobRelativeUrl(reference.id);
    }
    if ((0, runtime.parseDataUriHeader)(file) === null) {
      return null;
    }
    if (!preferUrl) {
      return file;
    }
    if (preferLivePreviewUrls && supportsLivePreviewUrls()) {
      return (0, runtime.publishedPreviewUrl)(path, file, "font")?.url ?? file;
    }
    if (
      (0, runtime.cachedFileAvailability)(
        path,
        (0, runtime.estimateDataUriBytes)(file),
      ) === true
    ) {
      return (0, runtime.fileAvailabilityUrlPath)(path);
    } else {
      return file;
    }
  }
  function previewColorSchemeCss(
    mode: Preview.PreviewMode,
    hasDarkTheme: boolean,
    transparent: boolean = true,
  ): string {
    if (mode === "dark" && !hasDarkTheme) {
      return `
html{color-scheme:light}`;
    }
    return (
      `
html{color-scheme:` +
      mode +
      "}" +
      (transparent ? "html,body{background:transparent!important}" : "")
    );
  }
  function darkThemeId(system: Preview.PreviewSystem): string | undefined {
    return system.tokens.color.themes.find(
      (input) => /dark/i.test(input.id) || /dark/i.test(input.name),
    )?.id;
  }
  function defaultPreviewThemeId(
    system: Preview.PreviewSystem,
    mode: Preview.PreviewMode,
  ): string | undefined {
    return (
      (mode === "dark" ? darkThemeId(system) : undefined) ??
      system.tokens.color.themes[0]?.id
    );
  }
  function previewLibraries(
    system: Preview.PreviewSystem,
  ): Preview.PreviewLibraryResult {
    let addReact =
        (0, runtime.previewStaticNoticeSnapshot)() &&
        system.bundle.js !== null &&
        !system.bundle.declared.some((input) =>
          runtime.REACT_LIBRARY_CATALOG.some(
            (input2: { name: string }) => input2.name === input.name,
          ),
        ),
      declared = addReact
        ? [
            ...runtime.REACT_LIBRARY_CATALOG.map(
              (input: { name: string; version: string }) => ({
                name: input.name,
                version: input.version,
              }),
            ),
            ...system.bundle.declared,
          ]
        : system.bundle.declared,
      hasLibraryFile = (input: string) =>
        system.bundle.libraries.load.some((input2) => input2.file === input) ||
        (addReact &&
          runtime.REACT_LIBRARY_CATALOG.some(
            (input2: { packedFile: string }) => input2.packedFile === input,
          ) &&
          Object.hasOwn(system.files, input));
    return {
      addReact: addReact,
      libraries:
        system.bundle.js === null
          ? system.bundle.libraries
          : (0, runtime.resolvePreviewLibraries)(
              declared,
              hasLibraryFile,
              undefined,
              true,
            ),
    };
  }
  function previewStaticStatus(
    system: Preview.PreviewSystem,
    libraries: Model.ResolvedLibraries = previewLibraries(system).libraries,
  ): Preview.PreviewStaticStatus {
    if (system.bundle.js !== null && libraries.missing.length > 0) {
      let { missing: value, missingFiles: value2 } = libraries,
        value3 = Object.freeze(
          value2.length === value.length
            ? [...value2]
            : value.map((input) => "components/lib/… for " + input),
        );
      return {
        staticReason:
          "Previews can’t run: " +
          (value3.length === 1
            ? "1 file is missing."
            : String(value3.length) + " files are missing."),
        staticMissing: value3,
      };
    }
    return {
      staticReason:
        system.components.length > 0 &&
        system.bundle.js === null &&
        (0, runtime.hasBundleMetadata)(system.bundle)
          ? "Previews can’t run: components/bundle.js is missing."
          : "",
      staticMissing: Object.freeze([]),
    };
  }
  function createPreviewHead(
    system: Preview.PreviewSystem,
    mode: Preview.PreviewMode = "light",
    themeId?: string,
    transparent: boolean = true,
    ground?: string,
    preferUrl: boolean = true,
  ): Preview.PreviewHeadResult {
    let cache = previewHeadCache.get(system.files);
    if (cache === undefined) {
      previewHeadCache.set(system.files, (cache = new Map()));
    }
    let selectedTheme =
        themeId !== undefined &&
        system.tokens.color.themes.some((input) => input.id === themeId)
          ? themeId
          : defaultPreviewThemeId(system, mode),
      { addReact: addReact, libraries: libraries } = previewLibraries(system),
      useLiveUrls =
        preferUrl && preferLivePreviewUrls && supportsLivePreviewUrls(),
      heldUrl = (
        input: string,
        options: "style" | "script" | "font",
      ): Preview.PreviewHeldUrl | undefined => {
        let value = useLiveUrls ? system.files[input] : undefined,
          value2 =
            value === undefined || value === ""
              ? undefined
              : (0, runtime.publishedPreviewUrl)(input, value, options);
        if (value2 === undefined) {
          return undefined;
        } else {
          return Object.freeze({
            ...value2,
            file: input,
          });
        }
      },
      bundleCssUrl = heldUrl(runtime.DESIGN_SYSTEM_PATHS.bundleCss, "style"),
      libraryScriptUrls: (Preview.PreviewHeldUrl | undefined)[] =
        libraries.load.map((input) => heldUrl(input.file, "script")),
      bundleJsUrl = heldUrl(runtime.DESIGN_SYSTEM_PATHS.bundleJs, "script"),
      fontUrls: Preview.PreviewFontUrl[] = !useLiveUrls
        ? []
        : system.tokens.type.fonts.flatMap((input) => {
            let value = system.files[input.file],
              value2 =
                value === undefined ||
                (0, runtime.parseDataUriHeader)(value) === null
                  ? undefined
                  : (0, runtime.publishedPreviewUrl)(input.file, value, "font");
            if (value2 === undefined) {
              return [];
            } else {
              return [
                Object.freeze({
                  url: value2.url,
                  file: input.file,
                  face: Object.freeze({
                    family: input.family,
                    weight: String(input.weight),
                    style: String(input.style),
                  }),
                }),
              ];
            }
          }),
      urlFingerprint =
        "|u:" +
        (!preferUrl
          ? "off"
          : !useLiveUrls
            ? "g" + String((0, runtime.getFileAvailabilityRevision)())
            : [bundleCssUrl, ...libraryScriptUrls, bundleJsUrl, ...fontUrls]
                .map((input) => input?.url ?? "")
                .join(",")),
      baseCacheKey =
        mode +
        ":" +
        (selectedTheme ?? "") +
        ":" +
        (transparent ? "flush" : "ground") +
        ":" +
        (ground ?? "") +
        (addReact ? ":react" : ""),
      cacheKey = baseCacheKey + urlFingerprint,
      cached = cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    let previous: Preview.PreviewHeadResult | undefined;
    for (let value of [...cache.keys()]) {
      if (!value.startsWith(baseCacheKey + "|u:")) {
        continue;
      }
      previous = cache.get(value);
      cache.delete(value);
    }
    let hasDarkTheme = darkThemeId(system) !== undefined,
      tokensCss =
        (0, runtime.generateTokensCss)(system.tokens, {
          fontFaces: false,
        }) +
        previewColorSchemeCss(mode, hasDarkTheme, transparent) +
        (ground !== undefined && (0, runtime.isColorLiteral)(ground)
          ? "html{background:" + ground + "!important}"
          : ""),
      fontsCss = (0, runtime.generateFontFacesCss)(
        system.tokens,
        (input: string) => previewFontSource(system, input, preferUrl),
      ),
      fontsKey = (0, runtime.generateFontFacesCss)(
        system.tokens,
        (input: string) => previewFontIdentity(system, input),
      ),
      { staticReason: staticReason, staticMissing: staticMissing } =
        previewStaticStatus(system, libraries),
      runnable = staticReason === "",
      hasUrls =
        fontUrls.length > 0 ||
        (runnable &&
          [bundleCssUrl, bundleJsUrl, ...libraryScriptUrls].some(
            (input) => input !== undefined,
          )),
      result: Preview.PreviewHeadResult = Object.freeze({
        head: Object.freeze({
          tokensCss: tokensCss,
          fontsCss: fontsCss,
          fontsKey: fontsKey,
          bundleCss: system.bundle.css ?? "",
          runtimeScripts: Object.freeze(
            staticReason === ""
              ? (0, runtime.previewLibraryScripts)(libraries, system.files)
              : [],
          ),
          runtimeTags: Object.freeze(
            staticReason === ""
              ? libraries.fetch.map((input) =>
                  Object.freeze({
                    src: input.url,
                    integrity: input.integrity,
                  }),
                )
              : [],
          ),
          bundleJs: system.bundle.js ?? "",
          ...(fontUrls.length > 0
            ? {
                fontsCssHeld: (0, runtime.generateFontFacesCss)(
                  system.tokens,
                  (input: string) => previewFontSource(system, input, false),
                ),
              }
            : {}),
          ...(hasUrls
            ? {
                urls: Object.freeze({
                  ...(runnable && bundleCssUrl !== undefined
                    ? {
                        bundleCss: bundleCssUrl,
                      }
                    : {}),
                  runtimeScripts: Object.freeze(
                    runnable ? libraryScriptUrls : [],
                  ),
                  ...(runnable && bundleJsUrl !== undefined
                    ? {
                        bundleJs: bundleJsUrl,
                      }
                    : {}),
                  fonts: Object.freeze(fontUrls),
                }),
              }
            : {}),
          ...(selectedTheme !== undefined
            ? {
                themeId: selectedTheme,
              }
            : {}),
          mode: mode,
          colorScheme: mode === "dark" && !hasDarkTheme ? "light" : mode,
        }),
        staticReason: staticReason,
        staticMissing: staticMissing,
      });
    if (previous !== undefined) {
      (0, runtime.swatchHeadsEqual)(previous.head, result.head);
    }
    cache.set(cacheKey, result);
    return result;
  }
  bindRuntimeValue(
    runtime,
    "preferLivePreviewUrls",
    () => preferLivePreviewUrls,
    (value) => {
      preferLivePreviewUrls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewHeadCache",
    () => previewHeadCache,
    (value) => {
      previewHeadCache = value;
    },
  );
  bindRuntimeValue(runtime, "blobRelativeUrl", () => blobRelativeUrl);
  bindRuntimeValue(runtime, "previewFontIdentity", () => previewFontIdentity);
  bindRuntimeValue(runtime, "hashPreviewContent", () => hashPreviewContent);
  bindRuntimeValue(
    runtime,
    "supportsLivePreviewUrls",
    () => supportsLivePreviewUrls,
    (value) => {
      supportsLivePreviewUrls = value;
    },
  );
  bindRuntimeValue(runtime, "previewFontSource", () => previewFontSource);
  bindRuntimeValue(
    runtime,
    "previewColorSchemeCss",
    () => previewColorSchemeCss,
  );
  bindRuntimeValue(runtime, "darkThemeId", () => darkThemeId);
  bindRuntimeValue(
    runtime,
    "defaultPreviewThemeId",
    () => defaultPreviewThemeId,
  );
  bindRuntimeValue(runtime, "previewLibraries", () => previewLibraries);
  bindRuntimeValue(runtime, "previewStaticStatus", () => previewStaticStatus);
  bindRuntimeValue(runtime, "createPreviewHead", () => createPreviewHead);
  return () => {
    preferLivePreviewUrls = true;
    previewHeadCache = new WeakMap();
    supportsLivePreviewUrls = () =>
      (0, runtime.isPreviewRunnerEnabled)(globalThis);
  };
}

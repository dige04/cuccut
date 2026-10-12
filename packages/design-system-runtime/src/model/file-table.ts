/** Restored application module; prepare first, initialize in original order. */
import type * as Core from "../contracts/model-core";
import type * as Model from "../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  FileBudgetUsage,
  FileKind,
  FileTable,
  ParseReport,
} from "../contracts";
export function installModelFileTable(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var fileBudgetEncoder: TextEncoder;
  var ARTIFACT_FILE_LIMITS: {
    files: number;
    total: number;
    file: number;
    call: number;
    callBytes: number;
  };
  var ARTIFACT_FILE_CAPACITY: { files: number; bytes: number };
  var MIRROR_MIME_TYPES: Record<string, string>;
  var HELD_BINARY_MIME_TYPES: Record<string, string>;
  var embeddedStringSizeCache: Map<string, number>;
  var embeddedStringCacheCharacters: number;
  var MAX_EMBEDDED_STRING_CACHE_CHARACTERS: number;
  var MIN_CACHED_STRING_LENGTH: number;
  var JSON_STRING_ESCAPE_PATTERN: RegExp;
  var KIBIBYTE: number;
  var MEBIBYTE: number;
  var MAX_PRETTY_MANIFEST_BYTES: number;
  var DESIGN_SYSTEM_INLINE_LIMITS: Core.InlineLimits;
  var MAX_DISPLAYED_DOCUMENTS: number;
  var DESIGN_SYSTEM_MANIFEST_VERSION: number;
  var isFileTableObject: (input: unknown) => input is Record<string, unknown>;
  var unboundedFileParsing: boolean;
  function mirrorMimeTypeForPath(path: string) {
    let extension = (0, runtime.fileExtension)(path);
    if (Object.hasOwn(MIRROR_MIME_TYPES, extension)) {
      return MIRROR_MIME_TYPES[extension];
    } else {
      return null;
    }
  }
  function isPublishableFilePathModelFileTable(path: string): boolean {
    if (
      !(0, runtime.isValidDesignSystemPath)(path) ||
      fileBudgetEncoder.encode(path).length > 512
    ) {
      return false;
    }
    if (
      /[%;:?#\\\u0000-\u001f\u007f]/.test(path) ||
      path.startsWith("_") ||
      path.endsWith(".cmekshadow")
    ) {
      return false;
    }
    return true;
  }
  function isMirrorEligiblePath(path: string) {
    if (
      path.toLowerCase() === "index.html" ||
      path.startsWith("components/src/")
    ) {
      return false;
    }
    if (
      path.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir) &&
      path.endsWith("/" + runtime.COMPONENT_FILENAMES.preview)
    ) {
      return false;
    }
    if (
      !(0, runtime.isTextFilePath)(path) &&
      !path.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir)
    ) {
      return false;
    }
    if (
      path.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir) &&
      (0, runtime.canUseStoragePointer)(path)
    ) {
      return false;
    }
    return (
      isPublishableFilePathModelFileTable(path) &&
      mirrorMimeTypeForPath(path) !== null
    );
  }
  function isMirrorEligibleFile(path: string, content: string): boolean {
    if (
      !isMirrorEligiblePath(path) ||
      (0, runtime.storagePointerForFile)(path, content) !== null
    ) {
      return false;
    }
    if ((0, runtime.isTextFilePath)(path)) {
      return !content.includes(String.fromCharCode(65533));
    } else {
      return (0, runtime.parseDataUriHeader)(content)?.base64 === true;
    }
  }
  function estimateEmbeddedStringBytes(value: string) {
    if (value.length >= MIN_CACHED_STRING_LENGTH) {
      let entry = embeddedStringSizeCache.get(value);
      if (entry !== undefined) {
        embeddedStringSizeCache.delete(value);
        embeddedStringSizeCache.set(value, entry);
        return entry;
      }
    }
    let bytes: number;
    if (typeof value === "string" && !JSON_STRING_ESCAPE_PATTERN.test(value)) {
      bytes = value.length + 2;
    } else {
      let index: number = 0;
      for (let index2: number = 0; index2 < value.length; index2++) {
        if (value.charCodeAt(index2) === 60) {
          index++;
        }
      }
      bytes =
        fileBudgetEncoder.encode(JSON.stringify(value)).length + 5 * index;
    }
    if (value.length >= MIN_CACHED_STRING_LENGTH) {
      embeddedStringSizeCache.set(value, bytes);
      embeddedStringCacheCharacters += value.length;
      for (let [value2] of embeddedStringSizeCache) {
        if (
          embeddedStringCacheCharacters <= MAX_EMBEDDED_STRING_CACHE_CHARACTERS
        ) {
          break;
        }
        embeddedStringSizeCache.delete(value2);
        embeddedStringCacheCharacters -= value2.length;
      }
    }
    return bytes;
  }
  function isAdditionalMarkdownPath(path: string) {
    return (
      path !== runtime.DESIGN_SYSTEM_PATHS.readme &&
      !path.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir) &&
      !path.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir) &&
      !path.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir) &&
      !path.startsWith(runtime.DESIGN_SYSTEM_PATHS.archivedDir) &&
      /\.(?:mdx?|markdown)$/i.test(path)
    );
  }
  function classifyDesignSystemFile(path: string): FileKind {
    if (path === runtime.DESIGN_SYSTEM_PATHS.readme) {
      return "readme";
    }
    if (path === runtime.DESIGN_SYSTEM_PATHS.tokens) {
      return "tokens";
    }
    if (isAdditionalMarkdownPath(path)) {
      return "doc";
    }
    if (path === runtime.DESIGN_SYSTEM_PATHS.manifest) {
      return "manifest";
    }
    if (path === runtime.DESIGN_SYSTEM_PATHS.bundleJs) {
      return "bundleJs";
    }
    if (path === runtime.DESIGN_SYSTEM_PATHS.bundleCss) {
      return "bundleCss";
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir)) {
      if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.libDir)) {
        return "componentLib";
      }
      if ((0, runtime.fileExtension)(path) === "d.ts") {
        return "dts";
      }
      let value = path
        .slice(runtime.DESIGN_SYSTEM_PATHS.componentsDir.length)
        .split("/");
      if (
        value.length === 2 &&
        value[1] === runtime.COMPONENT_FILENAMES.preview
      ) {
        return "preview";
      }
      if (
        value.length === 2 &&
        value[1] === runtime.COMPONENT_FILENAMES.readme
      ) {
        return "componentReadme";
      }
      if (value[0] === "src" && value.length >= 2) {
        return "componentSource";
      }
      return "componentOther";
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir)) {
      return "font";
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
      return "asset";
    }
    if ((0, runtime.fileExtension)(path) === "d.ts") {
      return "dts";
    }
    return "other";
  }
  function inlineLimitForFileKind(fileKind: FileKind) {
    switch (fileKind) {
      case "readme":
        return DESIGN_SYSTEM_INLINE_LIMITS.readme;
      case "doc":
        return DESIGN_SYSTEM_INLINE_LIMITS.other;
      case "tokens":
        return DESIGN_SYSTEM_INLINE_LIMITS.tokens;
      case "manifest":
        return DESIGN_SYSTEM_INLINE_LIMITS.manifest;
      case "bundleJs":
        return DESIGN_SYSTEM_INLINE_LIMITS.bundleJs;
      case "bundleCss":
        return DESIGN_SYSTEM_INLINE_LIMITS.bundleCss;
      case "dts":
        return DESIGN_SYSTEM_INLINE_LIMITS.dtsTotal;
      case "preview":
        return DESIGN_SYSTEM_INLINE_LIMITS.preview;
      case "componentReadme":
        return DESIGN_SYSTEM_INLINE_LIMITS.componentReadme;
      case "componentSource":
        return DESIGN_SYSTEM_INLINE_LIMITS.other;
      case "componentLib":
        return DESIGN_SYSTEM_INLINE_LIMITS.componentLib;
      case "componentOther":
        return DESIGN_SYSTEM_INLINE_LIMITS.other;
      case "font":
        return DESIGN_SYSTEM_INLINE_LIMITS.font;
      case "asset":
        return DESIGN_SYSTEM_INLINE_LIMITS.asset;
      case "other":
        return DESIGN_SYSTEM_INLINE_LIMITS.other;
    }
  }
  function inlineLimitForPath(
    path: string,
    fileKind: FileKind = classifyDesignSystemFile(path),
  ) {
    if ((0, runtime.isImageSlotStatePath)(path)) {
      return DESIGN_SYSTEM_INLINE_LIMITS.imageSlotState;
    } else {
      return inlineLimitForFileKind(fileKind);
    }
  }
  function inlineLimitLabelForPath(
    path: string,
    fileKind: FileKind = classifyDesignSystemFile(path),
  ) {
    if ((0, runtime.isImageSlotStatePath)(path)) {
      return "image-slot state";
    } else {
      return fileKind;
    }
  }
  function parseLegacyComponentPath(path: string) {
    if (!path.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir)) {
      return null;
    }
    let segments = path
      .slice(runtime.DESIGN_SYSTEM_PATHS.componentsDir.length)
      .split("/");
    if (segments.length !== 3) {
      return null;
    }
    let [group, name, filename] = segments;
    if (group === "src" || !runtime.COMPONENT_NAME_PATTERN.test(name)) {
      return null;
    }
    let lowerFilename = filename.toLowerCase(),
      lowerName = name.toLowerCase();
    for (let value of ["html", "prompt.md", "d.ts", "jsx"]) {
      if (lowerFilename === lowerName + "." + value) {
        return {
          group: group,
          name: name,
          ext: value,
        };
      }
    }
    return null;
  }
  function normalizeDesignSystemPath(path: string) {
    let lowerPath = path.toLowerCase();
    if (lowerPath === "readme.md" || lowerPath === "readme.markdown") {
      return runtime.DESIGN_SYSTEM_PATHS.readme;
    }
    if (lowerPath === "tokens.json") {
      return runtime.DESIGN_SYSTEM_PATHS.tokens;
    }
    if (lowerPath === "manifest.json" || lowerPath === "_ds_manifest.json") {
      return runtime.DESIGN_SYSTEM_PATHS.manifest;
    }
    if (
      lowerPath === "_ds_bundle.js" ||
      lowerPath === "bundle.js" ||
      lowerPath === "components/_ds_bundle.js" ||
      lowerPath === "components/bundle.js"
    ) {
      return runtime.DESIGN_SYSTEM_PATHS.bundleJs;
    }
    if (
      lowerPath === "_ds_bundle.css" ||
      lowerPath === "bundle.css" ||
      lowerPath === "styles.css" ||
      lowerPath === "components/_ds_bundle.css" ||
      lowerPath === "components/bundle.css" ||
      lowerPath === "components/styles.css"
    ) {
      return runtime.DESIGN_SYSTEM_PATHS.bundleCss;
    }
    if (
      lowerPath === "index.d.ts" ||
      lowerPath === "components.d.ts" ||
      lowerPath === "components/components.d.ts"
    ) {
      return runtime.DESIGN_SYSTEM_PATHS.indexDts;
    }
    if (path.startsWith(runtime.DESIGN_SYSTEM_PATHS.componentsDir)) {
      let value = path
        .slice(runtime.DESIGN_SYSTEM_PATHS.componentsDir.length)
        .split("/");
      if (value.length === 1) {
        let value2 = value[0],
          value3 = /^([A-Za-z_$][A-Za-z0-9_$]*)\.html?$/.exec(value2);
        if (value3 !== null) {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value3[1] +
            "/" +
            runtime.COMPONENT_FILENAMES.preview
          );
        }
        value3 = /^([A-Za-z_$][A-Za-z0-9_$]*)\.(?:prompt\.)?md$/.exec(value2);
        if (value3 !== null && value2.toLowerCase() !== "readme.md") {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value3[1] +
            "/" +
            runtime.COMPONENT_FILENAMES.readme
          );
        }
      } else if (value.length === 2) {
        let [value2, value3] = value,
          value4 = value3.toLowerCase();
        if (
          value4 === "readme.md" ||
          value4 === value2.toLowerCase() + ".prompt.md" ||
          value4 === "prompt.md" ||
          value4 === "usage.md"
        ) {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value2 +
            "/" +
            runtime.COMPONENT_FILENAMES.readme
          );
        }
        if (
          value4 === "preview.html" ||
          value4 === "index.html" ||
          value4 === value2.toLowerCase() + ".html"
        ) {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value2 +
            "/" +
            runtime.COMPONENT_FILENAMES.preview
          );
        }
      } else {
        let value2 = parseLegacyComponentPath(path);
        if (value2 !== null && value2.ext === "html") {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value2.name +
            "/" +
            runtime.COMPONENT_FILENAMES.preview
          );
        }
        if (value2 !== null && value2.ext === "prompt.md") {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value2.name +
            "/" +
            runtime.COMPONENT_FILENAMES.readme
          );
        }
        if (value2 !== null && value2.ext === "d.ts") {
          return (
            runtime.DESIGN_SYSTEM_PATHS.componentsDir +
            value2.name +
            "/" +
            value2.name +
            ".d.ts"
          );
        }
      }
    }
    return path;
  }
  function parseManifest(
    input: unknown,
    report: ParseReport = { dropped: [], warnings: [] },
  ) {
    let parsed: unknown = input;
    if (typeof parsed === "string") {
      if (parsed.trim() === "") {
        return {};
      }
      try {
        parsed = JSON.parse(parsed);
      } catch (value) {
        let value2: string =
          "manifest.json: " + String((value as Error).message).slice(0, 120);
        if (!report.dropped.includes(value2)) {
          report.dropped.push(value2);
        }
        return {};
      }
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      if (
        !report.warnings.some((input2) =>
          input2.startsWith("manifest.json: not a JSON object"),
        )
      ) {
        report.warnings.push(
          "manifest.json: not a JSON object — ignored and regenerated",
        );
      }
      return {};
    }
    let manifest = parsed as Core.ManifestObject;
    if (manifest.manifestVersion !== DESIGN_SYSTEM_MANIFEST_VERSION) {
      if (
        Object.keys(manifest).length > 0 &&
        !report.warnings.some((input2) =>
          input2.startsWith("manifest.json: not manifestVersion"),
        )
      ) {
        report.warnings.push(
          "manifest.json: not manifestVersion " +
            String(DESIGN_SYSTEM_MANIFEST_VERSION) +
            " — ignored and regenerated (its asset notes and lastChange are not carried)",
        );
      }
      return {};
    }
    return manifest;
  }
  function createParseReport() {
    return {
      dropped: [],
      warnings: [],
    };
  }
  function setUnboundedFileParsing(enabled: boolean): void {
    unboundedFileParsing = enabled;
  }
  function isUnboundedFileParsing() {
    return unboundedFileParsing;
  }
  function parseFileTable(
    input: unknown,
    report: ParseReport = createParseReport(),
    options: {
      unbounded?: boolean;
    } = {},
  ): FileTable {
    let sourceFiles: Record<string, unknown> = isFileTableObject(input)
        ? input
        : {},
      acceptedFiles = new Map<string, { from: string; value: string }>(),
      bounded: boolean = !(options.unbounded ?? unboundedFileParsing),
      totalBytes = 0,
      declarationBytes = 0,
      fileCount: number = 0;
    for (let value in sourceFiles) {
      if (!Object.hasOwn(sourceFiles, value)) {
        continue;
      }
      let value2 =
        typeof value === "string"
          ? (0, runtime.explainToolConfigurationPath)(value)
          : null;
      if (value2 !== null) {
        report.dropped.push(
          "file " + JSON.stringify(value.slice(0, 80)) + ": " + value2,
        );
        continue;
      }
      if (!(0, runtime.isValidDesignSystemPath)(value)) {
        report.dropped.push(
          "file " +
            JSON.stringify(String(value).slice(0, 80)) +
            ": invalid path",
        );
        continue;
      }
      let value3 = sourceFiles[value];
      if (typeof value3 !== "string") {
        report.dropped.push("file " + value + ": not a string");
        continue;
      }
      let value4 = normalizeDesignSystemPath(value);
      if (
        (0, runtime.isGeneratedSystemPath)(value4) &&
        !(0, runtime.hasGeneratedSystemHeader)(value4, value3)
      ) {
        let value10 = (0, runtime.carriedDocumentPath)(value4),
          callback = (input2: string) =>
            acceptedFiles.has(input2) || Object.hasOwn(sourceFiles, input2),
          value11 =
            value10.lastIndexOf(".") > value10.lastIndexOf("/")
              ? value10.lastIndexOf(".")
              : value10.length,
          value12 = value10;
        for (let count: number = 2; count < 10 && callback(value12); count++) {
          value12 =
            value10.slice(0, value11) +
            "-" +
            String(count) +
            value10.slice(value11);
        }
        if (callback(value12)) {
          report.dropped.push(
            "file " +
              value4 +
              ": " +
              value10 +
              " and its numbered names are taken — rename the file",
          );
          continue;
        }
        report.warnings.push(
          "file " +
            value4 +
            ": carried as " +
            value12 +
            " — that name is generated beside the page on every save",
        );
        value4 = value12;
      }
      if (value4 !== value && !(0, runtime.isValidDesignSystemPath)(value4)) {
        report.dropped.push("file " + value + ": invalid after normalization");
        continue;
      }
      let value5 =
        (0, runtime.explainGeneratedOrRetiredPath)(value4) ??
        (0, runtime.explainReservedSystemPath)(value4);
      if (value5 !== null) {
        report.dropped.push("file " + value4 + ": " + value5);
        continue;
      }
      let entry = acceptedFiles.get(value4);
      if (entry !== undefined) {
        if (entry.from === value4 || value !== value4) {
          report.warnings.push(
            "file " +
              value +
              ": duplicate of " +
              entry.from +
              " after normalization — ignored",
          );
          continue;
        }
      } else if (bounded && fileCount >= runtime.MAX_DESIGN_SYSTEM_FILES) {
        report.dropped.push(
          "file " +
            value +
            ": over the " +
            String(runtime.MAX_DESIGN_SYSTEM_FILES) +
            "-file cap",
        );
        continue;
      }
      let value6 = classifyDesignSystemFile(value4);
      if (
        !(0, runtime.isTextFilePath)(value4) &&
        (0, runtime.parseDataUriHeader)(value3) === null &&
        (0, runtime.parseStoragePointer)(value3) === null
      ) {
        report.dropped.push(
          "file " +
            value4 +
            ": binary file must be a data: URI or a blob:/file: pointer",
        );
        continue;
      }
      let value7 =
          entry !== undefined ? estimateEmbeddedStringBytes(entry.value) : 0,
        value8 = entry !== undefined && value6 === "dts" ? value7 : 0,
        value9 = estimateEmbeddedStringBytes(value3);
      if (bounded) {
        if (value6 === "dts") {
          if (
            declarationBytes - value8 + value9 >
            DESIGN_SYSTEM_INLINE_LIMITS.dtsTotal
          ) {
            report.dropped.push(
              "file " +
                value4 +
                ": .d.ts total would exceed " +
                formatInlineBudgetBytes(DESIGN_SYSTEM_INLINE_LIMITS.dtsTotal),
            );
            continue;
          }
        } else if (value9 > inlineLimitForPath(value4, value6)) {
          report.dropped.push(
            "file " +
              value4 +
              ": " +
              formatInlineBudgetBytes(value9) +
              " exceeds the " +
              inlineLimitLabelForPath(value4, value6) +
              " cap of " +
              formatInlineBudgetBytes(inlineLimitForPath(value4, value6)),
          );
          continue;
        }
        if (totalBytes - value7 + value9 > DESIGN_SYSTEM_INLINE_LIMITS.total) {
          report.dropped.push(
            "file " +
              value4 +
              ": document total would exceed " +
              formatInlineBudgetBytes(DESIGN_SYSTEM_INLINE_LIMITS.total),
          );
          continue;
        }
      }
      if (entry !== undefined) {
        report.warnings.push(
          "file " + entry.from + ": superseded by canonically-named " + value,
        );
        totalBytes -= value7;
        declarationBytes -= value8;
        fileCount--;
      }
      if (value6 === "dts") {
        declarationBytes += value9;
      }
      totalBytes += value9;
      fileCount++;
      acceptedFiles.set(value4, {
        from: value,
        value: value3,
      });
    }
    let sortedEntries = [...acceptedFiles.entries()]
      .sort((input2, options2): number =>
        input2[0] < options2[0] ? -1 : input2[0] > options2[0] ? 1 : 0,
      )
      .map(([input2, input3]) => [input2, input3.value]);
    return Object.freeze(Object.fromEntries(sortedEntries));
  }
  function formatInlineBudgetBytes(bytes: number): string {
    if (bytes >= MEBIBYTE) {
      return (bytes / MEBIBYTE).toFixed(bytes >= 10 * MEBIBYTE ? 0 : 1) + " MB";
    }
    if (bytes >= KIBIBYTE) {
      return Math.round(bytes / KIBIBYTE).toString() + " KB";
    }
    return String(bytes) + " B";
  }
  function computeFileBudgetUsage(
    files: FileTable,
    storedBytesForPath: (path: string) => number = (): number => 0,
    inlineBytesForPath?: (path: string) => number | undefined,
  ): FileBudgetUsage {
    let usage = {} as FileBudgetUsage,
      usageKinds: (keyof FileBudgetUsage)[] = [
        "readme",
        "doc",
        "tokens",
        "manifest",
        "bundleJs",
        "bundleCss",
        "dts",
        "preview",
        "componentReadme",
        "componentSource",
        "componentLib",
        "componentOther",
        "font",
        "asset",
        "other",
        "total",
        "blob",
        "beside",
      ];
    for (let value of usageKinds) {
      usage[value] = {
        files: 0,
        bytes: 0,
      };
    }
    for (let value in files) {
      let value2 = files[value],
        value3 =
          inlineBytesForPath?.(value) ?? estimateEmbeddedStringBytes(value2),
        value4 = classifyDesignSystemFile(value);
      usage[value4].files++;
      usage[value4].bytes += value3;
      usage.total.files++;
      usage.total.bytes += value3;
      let value5 = (0, runtime.storageKindForFile)(value, value2);
      if (value5 === "blob") {
        usage.blob.files++;
        usage.blob.bytes += storedBytesForPath(value);
      } else if (value5 === "file") {
        usage.beside.files++;
        usage.beside.bytes += storedBytesForPath(value);
      }
    }
    return usage;
  }
  bindRuntimeValue(
    runtime,
    "fileBudgetEncoder",
    () => fileBudgetEncoder,
    (value) => {
      fileBudgetEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_FILE_LIMITS",
    () => ARTIFACT_FILE_LIMITS,
    (value) => {
      ARTIFACT_FILE_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_FILE_CAPACITY",
    () => ARTIFACT_FILE_CAPACITY,
    (value) => {
      ARTIFACT_FILE_CAPACITY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIRROR_MIME_TYPES",
    () => MIRROR_MIME_TYPES,
    (value) => {
      MIRROR_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HELD_BINARY_MIME_TYPES",
    () => HELD_BINARY_MIME_TYPES,
    (value) => {
      HELD_BINARY_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mirrorMimeTypeForPath",
    () => mirrorMimeTypeForPath,
  );
  bindRuntimeValue(
    runtime,
    "isPublishableFilePathModelFileTable",
    () => isPublishableFilePathModelFileTable,
  );
  bindRuntimeValue(runtime, "isMirrorEligiblePath", () => isMirrorEligiblePath);
  bindRuntimeValue(runtime, "isMirrorEligibleFile", () => isMirrorEligibleFile);
  bindRuntimeValue(
    runtime,
    "embeddedStringSizeCache",
    () => embeddedStringSizeCache,
    (value) => {
      embeddedStringSizeCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedStringCacheCharacters",
    () => embeddedStringCacheCharacters,
    (value) => {
      embeddedStringCacheCharacters = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_EMBEDDED_STRING_CACHE_CHARACTERS",
    () => MAX_EMBEDDED_STRING_CACHE_CHARACTERS,
    (value) => {
      MAX_EMBEDDED_STRING_CACHE_CHARACTERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_CACHED_STRING_LENGTH",
    () => MIN_CACHED_STRING_LENGTH,
    (value) => {
      MIN_CACHED_STRING_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JSON_STRING_ESCAPE_PATTERN",
    () => JSON_STRING_ESCAPE_PATTERN,
    (value) => {
      JSON_STRING_ESCAPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "estimateEmbeddedStringBytes",
    () => estimateEmbeddedStringBytes,
  );
  bindRuntimeValue(
    runtime,
    "KIBIBYTE",
    () => KIBIBYTE,
    (value) => {
      KIBIBYTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MEBIBYTE",
    () => MEBIBYTE,
    (value) => {
      MEBIBYTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRETTY_MANIFEST_BYTES",
    () => MAX_PRETTY_MANIFEST_BYTES,
    (value) => {
      MAX_PRETTY_MANIFEST_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_INLINE_LIMITS",
    () => DESIGN_SYSTEM_INLINE_LIMITS,
    (value) => {
      DESIGN_SYSTEM_INLINE_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isAdditionalMarkdownPath",
    () => isAdditionalMarkdownPath,
  );
  bindRuntimeValue(
    runtime,
    "MAX_DISPLAYED_DOCUMENTS",
    () => MAX_DISPLAYED_DOCUMENTS,
    (value) => {
      MAX_DISPLAYED_DOCUMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyDesignSystemFile",
    () => classifyDesignSystemFile,
  );
  bindRuntimeValue(
    runtime,
    "inlineLimitForFileKind",
    () => inlineLimitForFileKind,
  );
  bindRuntimeValue(runtime, "inlineLimitForPath", () => inlineLimitForPath);
  bindRuntimeValue(
    runtime,
    "inlineLimitLabelForPath",
    () => inlineLimitLabelForPath,
  );
  bindRuntimeValue(
    runtime,
    "parseLegacyComponentPath",
    () => parseLegacyComponentPath,
  );
  bindRuntimeValue(
    runtime,
    "normalizeDesignSystemPath",
    () => normalizeDesignSystemPath,
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_MANIFEST_VERSION",
    () => DESIGN_SYSTEM_MANIFEST_VERSION,
    (value) => {
      DESIGN_SYSTEM_MANIFEST_VERSION = value;
    },
  );
  bindRuntimeValue(runtime, "parseManifest", () => parseManifest);
  bindRuntimeValue(runtime, "createParseReport", () => createParseReport);
  bindRuntimeValue(
    runtime,
    "isFileTableObject",
    () => isFileTableObject,
    (value) => {
      isFileTableObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unboundedFileParsing",
    () => unboundedFileParsing,
    (value) => {
      unboundedFileParsing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setUnboundedFileParsing",
    () => setUnboundedFileParsing,
  );
  bindRuntimeValue(
    runtime,
    "isUnboundedFileParsing",
    () => isUnboundedFileParsing,
  );
  bindRuntimeValue(runtime, "parseFileTable", () => parseFileTable);
  bindRuntimeValue(
    runtime,
    "formatInlineBudgetBytes",
    () => formatInlineBudgetBytes,
  );
  bindRuntimeValue(
    runtime,
    "computeFileBudgetUsage",
    () => computeFileBudgetUsage,
  );
  return () => {
    fileBudgetEncoder = new TextEncoder();
    ARTIFACT_FILE_LIMITS = {
      files: 1024,
      total: 268435456,
      file: 15728640,
      call: 256,
      callBytes: 67108864,
    };
    ARTIFACT_FILE_CAPACITY = {
      files: ARTIFACT_FILE_LIMITS.files,
      bytes: ARTIFACT_FILE_LIMITS.total,
    };
    MIRROR_MIME_TYPES = {
      md: "text/markdown",
      mdx: "text/markdown",
      markdown: "text/markdown",
      json: "application/json",
      lottie: "application/json",
      css: "text/css",
      svg: "text/plain",
      html: "text/plain",
      htm: "text/plain",
      xml: "text/plain",
      js: "text/plain",
      mjs: "text/plain",
      cjs: "text/plain",
      txt: "text/plain",
      jsx: "text/plain",
      ts: "text/plain",
      tsx: "text/plain",
      "d.ts": "text/plain",
      csv: "text/plain",
      yml: "text/plain",
      yaml: "text/plain",
      toml: "text/plain",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      ico: "image/x-icon",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      woff2: "font/woff2",
      woff: "font/woff",
      ttf: "font/ttf",
      otf: "font/otf",
      pdf: "application/pdf",
    };
    HELD_BINARY_MIME_TYPES = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
      fig: "application/x-figma",
    };
    embeddedStringSizeCache = new Map();
    embeddedStringCacheCharacters = 0;
    MAX_EMBEDDED_STRING_CACHE_CHARACTERS = 50331648;
    MIN_CACHED_STRING_LENGTH = 2048;
    JSON_STRING_ESCAPE_PATTERN = /[^\x20\x21\x23-\x3b\x3d-\x5b\x5d-\x7e]/;
    KIBIBYTE = 1024;
    MEBIBYTE = 1048576;
    MAX_PRETTY_MANIFEST_BYTES = 512 * KIBIBYTE;
    DESIGN_SYSTEM_INLINE_LIMITS = {
      readme: 200 * KIBIBYTE,
      tokens: 512 * KIBIBYTE,
      manifest: 6 * MEBIBYTE,
      bundleJs: 6 * MEBIBYTE,
      bundleCss: 2 * MEBIBYTE,
      dtsTotal: 1.5 * MEBIBYTE,
      preview: 256 * KIBIBYTE,
      componentReadme: 64 * KIBIBYTE,
      componentLib: 2 * MEBIBYTE,
      font: 1 * MEBIBYTE,
      asset: 12 * MEBIBYTE,
      other: 512 * KIBIBYTE,
      imageSlotState: 12 * MEBIBYTE,
      total: 14 * MEBIBYTE,
    };
    MAX_DISPLAYED_DOCUMENTS = 24;
    DESIGN_SYSTEM_MANIFEST_VERSION = 3;
    isFileTableObject = (input: unknown): input is Record<string, unknown> =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    unboundedFileParsing = false;
  };
}

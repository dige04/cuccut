/** Restored application module; prepare first, initialize in original order. */
import type * as Core from "../contracts/model-core";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type { StoragePointer } from "../contracts";
export function installModelFilePolicy(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var EMPTY_EMBEDDED_PAGE_PARTS: {
    title: string;
    readme: string;
    readmeMeta: string;
    css: string;
    js: string;
    emulator: boolean;
  };
  var DESIGN_SYSTEM_PATHS: Core.DesignSystemPaths;
  var DESIGN_SYSTEM_ENVELOPE_PATH: string;
  var DESIGN_SYSTEM_DEMO_PATH: string;
  var TYPE_RESERVED_FILE_BUDGET: { files: number; bytes: number };
  var COMPONENT_FILENAMES: { preview: string; readme: string };
  var COVER_COMPONENT_NAME: string;
  var COMPONENT_NAME_PATTERN: RegExp;
  var WINDOW_NAMESPACE_PATTERN: RegExp;
  var MAX_DESIGN_SYSTEM_PATH_LENGTH: number;
  var MAX_DESIGN_SYSTEM_FILES: number;
  var UNSAFE_PATH_CHARACTER_PATTERN: RegExp;
  var RESERVED_PROTOTYPE_NAMES: Set<string>;
  var REFUSED_TOOL_DIRECTORIES: Set<string>;
  var REFUSED_TOOL_FILENAMES: Set<string>;
  var INVISIBLE_PATH_CHARACTER_PATTERN: RegExp;
  var WINDOWS_SHORT_NAME_PATTERN: RegExp;
  var IMAGE_SLOT_STATE_FILENAME: string;
  var GENERATED_TOKENS_CSS_PATH: string;
  var GENERATED_API_DIRECTORY: string;
  var GENERATED_API_PATH_PATTERN: RegExp;
  var GENERATED_API_FILE_HEADER: string;
  var CARRIED_DOCUMENTS_DIRECTORY: string;
  var TEXT_FILE_EXTENSIONS: Set<string>;
  var FILE_MIME_TYPES: Record<string, string>;
  var DATA_URI_HEADER_PATTERN: RegExp;
  var BLOB_ID_PATTERN: RegExp;
  var BLOB_POINTER_PREFIX: string;
  var FILE_POINTER_PREFIX: string;
  var allowAllBinaryFilePointers: boolean;
  var isExpensiveHeldImagePath: (path: string) => boolean;
  function constantReadOnlyReasonSlot<Reason>(reason: Reason) {
    return {
      read: () => reason,
      write: (): boolean => false,
      clear(): void {},
    };
  }
  function explainUnsafeMirrorPath(path: string) {
    return (
      explainReservedSystemPath(path) ??
      (normalizePathForComparison(path).startsWith("_")
        ? 'starts with "_" (Frame reserves those)'
        : null)
    );
  }
  function parseDesignSystemEnvelope(text: string) {
    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return "not JSON";
    }
    let content =
      typeof envelope === "object" &&
      envelope !== null &&
      !Array.isArray(envelope)
        ? (envelope as Record<string, unknown>).content
        : undefined;
    if (
      typeof content !== "object" ||
      content === null ||
      Array.isArray(content)
    ) {
      return "not a design-system.json envelope";
    }
    return {
      envelope: envelope as Core.DesignSystemEnvelopeObject,
    };
  }
  function isValidDesignSystemPath(path: string): boolean {
    if (typeof path !== "string") {
      return false;
    }
    if (path.length === 0 || path.length > MAX_DESIGN_SYSTEM_PATH_LENGTH) {
      return false;
    }
    if (path.startsWith("/") || path.includes("\\")) {
      return false;
    }
    if (UNSAFE_PATH_CHARACTER_PATTERN.test(path)) {
      return false;
    }
    for (let value of path.split("/")) {
      if (
        value === "" ||
        value === "." ||
        value === ".." ||
        RESERVED_PROTOTYPE_NAMES.has(value)
      ) {
        return false;
      }
    }
    return !isToolConfigurationPath(path);
  }
  function normalizePathSegmentForComparison(segment: string): string {
    let normalized = segment.replace(INVISIBLE_PATH_CHARACTER_PATTERN, ""),
      colonOffset = normalized.indexOf(":");
    if (colonOffset >= 0) {
      normalized = normalized.slice(0, colonOffset);
    }
    return normalized
      .normalize("NFC")
      .toUpperCase()
      .toLowerCase()
      .replace(/[. ]+$/, "");
  }
  function normalizePathForComparison(path: string): string {
    return path.split("/").map(normalizePathSegmentForComparison).join("/");
  }
  function isImageSlotStatePath(path: string) {
    let segments = path.split("/");
    return (
      segments[segments.length - 1] === IMAGE_SLOT_STATE_FILENAME &&
      !segments
        .slice(0, -1)
        .some((input) =>
          normalizePathSegmentForComparison(input).startsWith("."),
        )
    );
  }
  function explainToolConfigurationPath(path: string): string | null {
    let segments = path.split("/").map(normalizePathSegmentForComparison);
    if (
      segments.some((input) => input.startsWith(".")) &&
      !isImageSlotStatePath(path)
    ) {
      return "dot-file / dot-directory (tool, editor, VCS or agent configuration) — never part of a design system, refused";
    }
    if (
      REFUSED_TOOL_FILENAMES.has(segments[segments.length - 1] ?? "") ||
      segments.some((input) => REFUSED_TOOL_DIRECTORIES.has(input))
    ) {
      return "package-manager / toolchain / agent-instruction file that tools auto-load from a working directory — never part of a design system, refused";
    }
    if (segments.some((input) => WINDOWS_SHORT_NAME_PATTERN.test(input))) {
      return 'a path segment is shaped like a Windows 8.3 short name (NAME~1), whose real target cannot be known — refused; rename it without the "~digit"';
    }
    return null;
  }
  function isToolConfigurationPath(path: string): boolean {
    return explainToolConfigurationPath(path) !== null;
  }
  function explainReservedSystemPath(path: string): string | null {
    let normalized = normalizePathForComparison(path),
      isPathOrDescendant = (input: string) =>
        normalized === input || normalized.startsWith(input + "/");
    if (isPathOrDescendant("design-system.json")) {
      return (
        "reserved — " +
        "design-system.json" +
        " is the name a type-made system’s envelope takes beside the page; rename the file"
      );
    }
    if (isPathOrDescendant("index.html")) {
      return "reserved — index.html is the page itself beside the files; rename the file";
    }
    if (isPathOrDescendant("skill.md") || isPathOrDescendant("artifact-type")) {
      return "reserved — SKILL.md and artifact-type/ are the shared Design System type’s own files beside a system’s; rename the file";
    }
    return null;
  }
  function isGeneratedApiPath(path: string) {
    return GENERATED_API_PATH_PATTERN.test(normalizePathForComparison(path));
  }
  function isGeneratedSystemPath(path: string) {
    return (
      normalizePathForComparison(path) === GENERATED_TOKENS_CSS_PATH ||
      isGeneratedApiPath(path)
    );
  }
  function hasGeneratedSystemHeader(path: string, content: string) {
    if (normalizePathForComparison(path) === GENERATED_TOKENS_CSS_PATH) {
      return /^\uFEFF?\s*\/\*(?:(?!\*\/)[\s\S])*\bgenerated from tokens\.json \*\//i.test(
        content.slice(0, 4096),
      );
    } else {
      return (
        isGeneratedApiPath(path) &&
        /^\uFEFF?\s*<\!--\s*@generated\b/i.test(content)
      );
    }
  }
  function carriedDocumentPath(path: string): string {
    return CARRIED_DOCUMENTS_DIRECTORY + path;
  }
  function explainGeneratedOrRetiredPath(path: string): string | null {
    if (normalizePathForComparison(path) === GENERATED_TOKENS_CSS_PATH) {
      return "generated — tokens.css is compiled from tokens.json and published beside the page on every save or build; delete the file";
    }
    if (isGeneratedApiPath(path)) {
      return "generated — the api/ cards are written from tokens.json, manifest.json and components/index.d.ts beside the page on every save or build; delete the file";
    }
    if (path === "assets/meta.json") {
      return "retired — group order and tile size live in manifest.json assetGroups, notes on usage in assets/<Group>/README.md; move them there and delete the file";
    }
    if (path === "components/meta.json") {
      return "retired — the namespace comes from the bundle's @ds-bundle header (or make.ts --namespace) and libraries from manifest.json; delete the file";
    }
    return null;
  }
  function pathBasename(path: string): string {
    let separatorOffset = path.lastIndexOf("/");
    if (separatorOffset < 0) {
      return path;
    } else {
      return path.slice(separatorOffset + 1);
    }
  }
  function pathDirname(path: string): string {
    let separatorOffset = path.lastIndexOf("/");
    if (separatorOffset < 0) {
      return "";
    } else {
      return path.slice(0, separatorOffset);
    }
  }
  function fileExtension(path: string): string {
    let basename = pathBasename(path).toLowerCase();
    if (basename.endsWith(".d.ts")) {
      return "d.ts";
    }
    let dotOffset = basename.lastIndexOf(".");
    if (dotOffset <= 0) {
      return "";
    } else {
      return basename.slice(dotOffset + 1);
    }
  }
  function isTextFilePath(path: string) {
    return TEXT_FILE_EXTENSIONS.has(fileExtension(path));
  }
  function mimeTypeForPath(path: string): string {
    return FILE_MIME_TYPES[fileExtension(path)] ?? "application/octet-stream";
  }
  function assetKindForPath(
    path: string,
  ): "svg" | "image" | "video" | "font" | "audio" | "other" {
    let extension = fileExtension(path);
    if (extension === "svg") {
      return "svg";
    }
    let mime = FILE_MIME_TYPES[extension] ?? "";
    if (mime.startsWith("image/")) {
      return "image";
    }
    if (mime.startsWith("video/")) {
      return "video";
    }
    if (mime.startsWith("font/")) {
      return "font";
    }
    if (mime.startsWith("audio/")) {
      return "audio";
    }
    return "other";
  }
  function parseDataUriHeader(content: string): {
    mime: string;
    base64: boolean;
    payloadOffset: number;
  } | null {
    let header = DATA_URI_HEADER_PATTERN.exec(content);
    if (header === null) {
      return null;
    }
    return {
      mime: (header[1] ?? "").toLowerCase(),
      base64: header[3] !== undefined,
      payloadOffset: header[0].length,
    };
  }
  function estimateDataUriBytes(content: string) {
    let header = parseDataUriHeader(content);
    if (header === null) {
      return 0;
    }
    let payloadLength = content.length - header.payloadOffset;
    if (header.base64) {
      let index: number = 0;
      if (content.endsWith("==")) {
        index = 2;
      } else if (content.endsWith("=")) {
        index = 1;
      }
      return Math.max(0, Math.floor((payloadLength * 3) / 4) - index);
    }
    return payloadLength;
  }
  function canUseStoragePointer(path: string) {
    return !isTextFilePath(path) || fileExtension(path) === "svg";
  }
  function parseStoragePointer(value: string): StoragePointer | null {
    if (value.startsWith(BLOB_POINTER_PREFIX)) {
      let value2 = value.slice(BLOB_POINTER_PREFIX.length);
      if (BLOB_ID_PATTERN.test(value2)) {
        return {
          store: "blob",
          id: value2,
        };
      } else {
        return null;
      }
    }
    if (value.startsWith(FILE_POINTER_PREFIX)) {
      let value2 = value.slice(FILE_POINTER_PREFIX.length);
      if (value2 === "" || isValidDesignSystemPath(value2)) {
        return {
          store: "file",
          rel: value2,
        };
      } else {
        return null;
      }
    }
    return null;
  }
  function blobPointer(blobId: string): string {
    return BLOB_POINTER_PREFIX + blobId;
  }
  function filePointer(relativePath: string = ""): string {
    return FILE_POINTER_PREFIX + relativePath;
  }
  function storageKindForFile(path: string, content: string) {
    if (!canUseStoragePointer(path)) {
      return "inline";
    }
    return parseStoragePointer(content)?.store ?? "inline";
  }
  function storagePointerForFile(path: string, content: string) {
    if (canUseStoragePointer(path)) {
      return parseStoragePointer(content);
    } else {
      return null;
    }
  }
  function setAllowAllBinaryFilePointers(enabled: boolean): void {
    allowAllBinaryFilePointers = enabled;
  }
  function canUseHeldFilePointer(path: string) {
    if (allowAllBinaryFilePointers) {
      return (
        canUseStoragePointer(path) &&
        (0, runtime.isPublishableFilePathModelFileTable)(path)
      );
    }
    let mime = (0, runtime.mirrorMimeTypeForPath)(path),
      supported =
        mime !== null
          ? !mime.startsWith("font/")
          : Object.hasOwn(runtime.HELD_BINARY_MIME_TYPES, fileExtension(path));
    return (
      !isTextFilePath(path) &&
      fileExtension(path) !== "lottie" &&
      supported &&
      !path.startsWith(DESIGN_SYSTEM_PATHS.fontsDir) &&
      (0, runtime.isPublishableFilePathModelFileTable)(path)
    );
  }
  function isHeldFilePointer(path: string, content: string) {
    return content === FILE_POINTER_PREFIX && canUseHeldFilePointer(path);
  }
  function blobRelativeUrlModelFilePolicy(blobId: string): string {
    return "_blob/" + blobId;
  }
  function encodeRelativeUrlPath(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
  }
  bindRuntimeValue(
    runtime,
    "constantReadOnlyReasonSlot",
    () => constantReadOnlyReasonSlot,
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_EMBEDDED_PAGE_PARTS",
    () => EMPTY_EMBEDDED_PAGE_PARTS,
    (value) => {
      EMPTY_EMBEDDED_PAGE_PARTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_PATHS",
    () => DESIGN_SYSTEM_PATHS,
    (value) => {
      DESIGN_SYSTEM_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_ENVELOPE_PATH",
    () => DESIGN_SYSTEM_ENVELOPE_PATH,
    (value) => {
      DESIGN_SYSTEM_ENVELOPE_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_DEMO_PATH",
    () => DESIGN_SYSTEM_DEMO_PATH,
    (value) => {
      DESIGN_SYSTEM_DEMO_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TYPE_RESERVED_FILE_BUDGET",
    () => TYPE_RESERVED_FILE_BUDGET,
    (value) => {
      TYPE_RESERVED_FILE_BUDGET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "explainUnsafeMirrorPath",
    () => explainUnsafeMirrorPath,
  );
  bindRuntimeValue(
    runtime,
    "parseDesignSystemEnvelope",
    () => parseDesignSystemEnvelope,
  );
  bindRuntimeValue(
    runtime,
    "COMPONENT_FILENAMES",
    () => COMPONENT_FILENAMES,
    (value) => {
      COMPONENT_FILENAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_COMPONENT_NAME",
    () => COVER_COMPONENT_NAME,
    (value) => {
      COVER_COMPONENT_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPONENT_NAME_PATTERN",
    () => COMPONENT_NAME_PATTERN,
    (value) => {
      COMPONENT_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WINDOW_NAMESPACE_PATTERN",
    () => WINDOW_NAMESPACE_PATTERN,
    (value) => {
      WINDOW_NAMESPACE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_DESIGN_SYSTEM_PATH_LENGTH",
    () => MAX_DESIGN_SYSTEM_PATH_LENGTH,
    (value) => {
      MAX_DESIGN_SYSTEM_PATH_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_DESIGN_SYSTEM_FILES",
    () => MAX_DESIGN_SYSTEM_FILES,
    (value) => {
      MAX_DESIGN_SYSTEM_FILES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNSAFE_PATH_CHARACTER_PATTERN",
    () => UNSAFE_PATH_CHARACTER_PATTERN,
    (value) => {
      UNSAFE_PATH_CHARACTER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_PROTOTYPE_NAMES",
    () => RESERVED_PROTOTYPE_NAMES,
    (value) => {
      RESERVED_PROTOTYPE_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidDesignSystemPath",
    () => isValidDesignSystemPath,
  );
  bindRuntimeValue(
    runtime,
    "REFUSED_TOOL_DIRECTORIES",
    () => REFUSED_TOOL_DIRECTORIES,
    (value) => {
      REFUSED_TOOL_DIRECTORIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REFUSED_TOOL_FILENAMES",
    () => REFUSED_TOOL_FILENAMES,
    (value) => {
      REFUSED_TOOL_FILENAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INVISIBLE_PATH_CHARACTER_PATTERN",
    () => INVISIBLE_PATH_CHARACTER_PATTERN,
    (value) => {
      INVISIBLE_PATH_CHARACTER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "WINDOWS_SHORT_NAME_PATTERN",
    () => WINDOWS_SHORT_NAME_PATTERN,
    (value) => {
      WINDOWS_SHORT_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePathSegmentForComparison",
    () => normalizePathSegmentForComparison,
  );
  bindRuntimeValue(
    runtime,
    "normalizePathForComparison",
    () => normalizePathForComparison,
  );
  bindRuntimeValue(
    runtime,
    "IMAGE_SLOT_STATE_FILENAME",
    () => IMAGE_SLOT_STATE_FILENAME,
    (value) => {
      IMAGE_SLOT_STATE_FILENAME = value;
    },
  );
  bindRuntimeValue(runtime, "isImageSlotStatePath", () => isImageSlotStatePath);
  bindRuntimeValue(
    runtime,
    "explainToolConfigurationPath",
    () => explainToolConfigurationPath,
  );
  bindRuntimeValue(
    runtime,
    "isToolConfigurationPath",
    () => isToolConfigurationPath,
  );
  bindRuntimeValue(
    runtime,
    "explainReservedSystemPath",
    () => explainReservedSystemPath,
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_TOKENS_CSS_PATH",
    () => GENERATED_TOKENS_CSS_PATH,
    (value) => {
      GENERATED_TOKENS_CSS_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_API_DIRECTORY",
    () => GENERATED_API_DIRECTORY,
    (value) => {
      GENERATED_API_DIRECTORY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GENERATED_API_PATH_PATTERN",
    () => GENERATED_API_PATH_PATTERN,
    (value) => {
      GENERATED_API_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "isGeneratedApiPath", () => isGeneratedApiPath);
  bindRuntimeValue(
    runtime,
    "GENERATED_API_FILE_HEADER",
    () => GENERATED_API_FILE_HEADER,
    (value) => {
      GENERATED_API_FILE_HEADER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isGeneratedSystemPath",
    () => isGeneratedSystemPath,
  );
  bindRuntimeValue(
    runtime,
    "hasGeneratedSystemHeader",
    () => hasGeneratedSystemHeader,
  );
  bindRuntimeValue(
    runtime,
    "CARRIED_DOCUMENTS_DIRECTORY",
    () => CARRIED_DOCUMENTS_DIRECTORY,
    (value) => {
      CARRIED_DOCUMENTS_DIRECTORY = value;
    },
  );
  bindRuntimeValue(runtime, "carriedDocumentPath", () => carriedDocumentPath);
  bindRuntimeValue(
    runtime,
    "explainGeneratedOrRetiredPath",
    () => explainGeneratedOrRetiredPath,
  );
  bindRuntimeValue(runtime, "pathBasename", () => pathBasename);
  bindRuntimeValue(runtime, "pathDirname", () => pathDirname);
  bindRuntimeValue(runtime, "fileExtension", () => fileExtension);
  bindRuntimeValue(
    runtime,
    "TEXT_FILE_EXTENSIONS",
    () => TEXT_FILE_EXTENSIONS,
    (value) => {
      TEXT_FILE_EXTENSIONS = value;
    },
  );
  bindRuntimeValue(runtime, "isTextFilePath", () => isTextFilePath);
  bindRuntimeValue(
    runtime,
    "FILE_MIME_TYPES",
    () => FILE_MIME_TYPES,
    (value) => {
      FILE_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(runtime, "mimeTypeForPath", () => mimeTypeForPath);
  bindRuntimeValue(runtime, "assetKindForPath", () => assetKindForPath);
  bindRuntimeValue(
    runtime,
    "DATA_URI_HEADER_PATTERN",
    () => DATA_URI_HEADER_PATTERN,
    (value) => {
      DATA_URI_HEADER_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "parseDataUriHeader", () => parseDataUriHeader);
  bindRuntimeValue(runtime, "estimateDataUriBytes", () => estimateDataUriBytes);
  bindRuntimeValue(runtime, "canUseStoragePointer", () => canUseStoragePointer);
  bindRuntimeValue(
    runtime,
    "BLOB_ID_PATTERN",
    () => BLOB_ID_PATTERN,
    (value) => {
      BLOB_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOB_POINTER_PREFIX",
    () => BLOB_POINTER_PREFIX,
    (value) => {
      BLOB_POINTER_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_POINTER_PREFIX",
    () => FILE_POINTER_PREFIX,
    (value) => {
      FILE_POINTER_PREFIX = value;
    },
  );
  bindRuntimeValue(runtime, "parseStoragePointer", () => parseStoragePointer);
  bindRuntimeValue(runtime, "blobPointer", () => blobPointer);
  bindRuntimeValue(runtime, "filePointer", () => filePointer);
  bindRuntimeValue(runtime, "storageKindForFile", () => storageKindForFile);
  bindRuntimeValue(
    runtime,
    "storagePointerForFile",
    () => storagePointerForFile,
  );
  bindRuntimeValue(
    runtime,
    "allowAllBinaryFilePointers",
    () => allowAllBinaryFilePointers,
    (value) => {
      allowAllBinaryFilePointers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setAllowAllBinaryFilePointers",
    () => setAllowAllBinaryFilePointers,
  );
  bindRuntimeValue(
    runtime,
    "canUseHeldFilePointer",
    () => canUseHeldFilePointer,
  );
  bindRuntimeValue(runtime, "isHeldFilePointer", () => isHeldFilePointer);
  bindRuntimeValue(
    runtime,
    "isExpensiveHeldImagePath",
    () => isExpensiveHeldImagePath,
    (value) => {
      isExpensiveHeldImagePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "blobRelativeUrlModelFilePolicy",
    () => blobRelativeUrlModelFilePolicy,
  );
  bindRuntimeValue(
    runtime,
    "encodeRelativeUrlPath",
    () => encodeRelativeUrlPath,
  );
  return () => {
    EMPTY_EMBEDDED_PAGE_PARTS = {
      title: "",
      readme: "",
      readmeMeta: "",
      css: "",
      js: "",
      emulator: false,
    };
    DESIGN_SYSTEM_PATHS = {
      readme: "README.md",
      tokens: "tokens.json",
      manifest: "manifest.json",
      componentsDir: "components/",
      libDir: "components/lib/",
      bundleJs: "components/bundle.js",
      bundleCss: "components/bundle.css",
      indexDts: "components/index.d.ts",
      fontsDir: "fonts/",
      assetsDir: "assets/",
      archivedDir: "archived/",
    };
    DESIGN_SYSTEM_ENVELOPE_PATH = "design-system.json";
    DESIGN_SYSTEM_DEMO_PATH = "artifact-type/demo.json";
    TYPE_RESERVED_FILE_BUDGET = {
      files: 16,
      bytes: 4194304,
    };
    COMPONENT_FILENAMES = {
      preview: "preview.html",
      readme: "README.md",
    };
    COVER_COMPONENT_NAME = "Cover";
    COMPONENT_NAME_PATTERN =
      /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
    WINDOW_NAMESPACE_PATTERN = COMPONENT_NAME_PATTERN;
    MAX_DESIGN_SYSTEM_PATH_LENGTH = 300;
    MAX_DESIGN_SYSTEM_FILES = 1200;
    UNSAFE_PATH_CHARACTER_PATTERN =
      /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2028\u2029\u2060-\u206f\u2215\u2044\ufeff\uff0f]/;
    RESERVED_PROTOTYPE_NAMES = new Set([
      "__proto__",
      "constructor",
      "prototype",
    ]);
    REFUSED_TOOL_DIRECTORIES = new Set(["node_modules"]);
    REFUSED_TOOL_FILENAMES = new Set([
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lock",
      "bun.lockb",
      "bunfig.toml",
      "tsconfig.json",
      "jsconfig.json",
      "deno.json",
      "deno.jsonc",
      "claude.md",
      "claude.local.md",
      "agents.md",
    ]);
    INVISIBLE_PATH_CHARACTER_PATTERN =
      /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
    WINDOWS_SHORT_NAME_PATTERN = /~\d/;
    IMAGE_SLOT_STATE_FILENAME = ".image-slots.state.json";
    GENERATED_TOKENS_CSS_PATH = "tokens.css";
    GENERATED_API_DIRECTORY = "api/";
    GENERATED_API_PATH_PATTERN =
      /^api\/(?:icons\.md|tokens\.md|(?:tokens|components|assets)\/[^/]+\.md)$/;
    GENERATED_API_FILE_HEADER =
      "<\!-- @generated by the Design System type on every save and build — do not edit -->";
    CARRIED_DOCUMENTS_DIRECTORY = "docs/";
    TEXT_FILE_EXTENSIONS = new Set([
      "md",
      "mdx",
      "markdown",
      "txt",
      "json",
      "js",
      "mjs",
      "cjs",
      "jsx",
      "ts",
      "tsx",
      "d.ts",
      "css",
      "html",
      "htm",
      "svg",
      "xml",
      "csv",
      "yml",
      "yaml",
      "toml",
    ]);
    FILE_MIME_TYPES = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      woff2: "font/woff2",
      woff: "font/woff",
      ttf: "font/ttf",
      otf: "font/otf",
      pdf: "application/pdf",
      zip: "application/zip",
      json: "application/json",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      lottie: "application/json",
    };
    DATA_URI_HEADER_PATTERN =
      /^data:([a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*)?((?:;[a-z0-9-]+=[a-z0-9._-]+)*)(;base64)?,/i;
    BLOB_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
    BLOB_POINTER_PREFIX = "blob:";
    FILE_POINTER_PREFIX = "file:";
    allowAllBinaryFilePointers = false;
    isExpensiveHeldImagePath = (input) =>
      /\.(?:png|jpe?g|gif|webp|avif|ico|pdf)$/i.test(input);
  };
}

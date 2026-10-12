/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type { UnsendableFileCause } from "../documents/artifact-document";

/** A file with an explicit content type, as accepted by publish. */
export interface FilePublishWrapper {
  content: string | Blob;
  contentType?: string;
}

/** What publish accepts for one path: text, a blob, a wrapper naming the media type, or `null` to delete the file. */
export type FilePublishInput = string | Blob | FilePublishWrapper | null;

/** The files of one publish call, keyed by path. */
export type FilePublishEntries = Record<string, FilePublishInput>;

/** A publish input with its media type resolved and checked. */
export interface NormalizedFilePublishInput {
  content: string | Blob;
  contentType: string;
}

/** Why one file cannot be sent, in words for the person, plus a coarse cause for the UI. */
export interface FilePublishRejection {
  why: string;
  cause: UnsendableFileCause;
}

/** A whole publish batch that is refused up front. */
export interface FilePublishBatchRejection {
  ok: false;
  code: "invalid_content" | "too_large";
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Whether the host trimmed the listing to what this person may read (the listing's own flag wins over the port's). */
    fileListingIsNarrowed: (
      listing: { readonly narrowed?: boolean },
      port: { readonly narrowed?: boolean },
    ) => boolean;
    /** Identity hook: gives ports with a legacy shape a chance to be adapted. */
    normalizeFilesPort: <Port>(port: Port) => Port;
    MAX_FILE_BATCH_ENTRIES: number;
    MAX_FILE_PATH_UTF8_BYTES: number;
    MAX_FILE_PUBLISH_ENCODED_BYTES: number;
    MAX_FILE_BATCH_ENCODED_BYTES: number;
    FILE_MIME_TYPES_BY_EXTENSION: Map<string, string>;
    FILE_ALLOWED_MIME_TYPES: Set<string>;
    FILE_BINARY_MIME_TYPES: Set<string>;
    /** A reason the path cannot be saved, or undefined when it is fine. */
    validateFilePath: (path: string) => string | undefined;
    TEXT_FILE_MIME_TYPES: Set<string>;
    UNICODE_REPLACEMENT_CHARACTER: string;
    FILE_UNPAIRED_SURROGATE_PATTERN: RegExp;
    textContainsInvalidUnicode: (input: string) => boolean;
    isTextFileWithInvalidUnicode: (
      path: string,
      input: FilePublishInput,
    ) => boolean;
    filePublishRejection: (
      path: string,
      input: FilePublishInput,
    ) => FilePublishRejection | undefined;
    fileMimeTypeFromPath: (path: string) => string | undefined;
    isHtmlFilePath: (path: string) => boolean;
    FRAME_RUNTIME_BLOCK_START: string;
    FRAME_RUNTIME_BLOCK_END: string;
    stripFrameRuntimeBlock: (input: string) => string;
    /** The resolved input, `null` for a deletion, or an error message when the input cannot be published. */
    normalizeFilePublishInput: (
      path: string,
      input: FilePublishInput,
    ) => NormalizedFilePublishInput | string | null;
    filePublishContent: (
      input: Exclude<FilePublishInput, null>,
    ) => string | Blob;
    filePublishEncodedBytes: (input: FilePublishInput) => number;
    filePublishRawBytes: (input: FilePublishInput) => number;
    filePublishSizeRejection: (input: FilePublishInput) => string | undefined;
    fileContentBytes: (input: string | Blob) => Promise<Uint8Array>;
    /** SHA-256 of every file that is not a deletion, by path. */
    hashFilePublishEntries: (
      entries: FilePublishEntries,
    ) => Promise<Record<string, string>>;
    validateFilePublishBatch: (
      entries: FilePublishEntries,
    ) => FilePublishBatchRejection | undefined;
    splitFilePublishBatches: (
      entries: FilePublishEntries,
      isIndexPath?: (path: string) => boolean,
      maxBytes?: number,
      maxEntries?: number,
    ) => FilePublishEntries[];
    fileContentContainsRuntimeMarkers: (input: FilePublishInput) => boolean;
    encodeFileUrlPath: (path: string) => string;
  }
}

export function installFilesPublishInputs(
  runtime: RuntimeBindings,
): () => void {
  var MAX_FILE_BATCH_ENTRIES: RuntimeBindings["MAX_FILE_BATCH_ENTRIES"];
  var MAX_FILE_PATH_UTF8_BYTES: RuntimeBindings["MAX_FILE_PATH_UTF8_BYTES"];
  var MAX_FILE_PUBLISH_ENCODED_BYTES: RuntimeBindings["MAX_FILE_PUBLISH_ENCODED_BYTES"];
  var MAX_FILE_BATCH_ENCODED_BYTES: RuntimeBindings["MAX_FILE_BATCH_ENCODED_BYTES"];
  var FILE_MIME_TYPES_BY_EXTENSION: RuntimeBindings["FILE_MIME_TYPES_BY_EXTENSION"];
  var FILE_ALLOWED_MIME_TYPES: RuntimeBindings["FILE_ALLOWED_MIME_TYPES"];
  var FILE_BINARY_MIME_TYPES: RuntimeBindings["FILE_BINARY_MIME_TYPES"];
  var TEXT_FILE_MIME_TYPES: RuntimeBindings["TEXT_FILE_MIME_TYPES"];
  var UNICODE_REPLACEMENT_CHARACTER: RuntimeBindings["UNICODE_REPLACEMENT_CHARACTER"];
  var FILE_UNPAIRED_SURROGATE_PATTERN: RuntimeBindings["FILE_UNPAIRED_SURROGATE_PATTERN"];
  var textContainsInvalidUnicode: RuntimeBindings["textContainsInvalidUnicode"];
  var isHtmlFilePath: RuntimeBindings["isHtmlFilePath"];
  var FRAME_RUNTIME_BLOCK_START: RuntimeBindings["FRAME_RUNTIME_BLOCK_START"];
  var FRAME_RUNTIME_BLOCK_END: RuntimeBindings["FRAME_RUNTIME_BLOCK_END"];
  var filePublishContent: RuntimeBindings["filePublishContent"];
  var encodeFileUrlPath: RuntimeBindings["encodeFileUrlPath"];
  function fileListingIsNarrowed(
    listing: { readonly narrowed?: boolean },
    port: { readonly narrowed?: boolean },
  ): boolean {
    return listing.narrowed ?? port.narrowed === true;
  }
  function normalizeFilesPort<Port>(input: Port): Port {
    return input;
  }
  function validateFilePath(path: string): string | undefined {
    if (
      path === "" ||
      (0, runtime.encodeFileUtf8)(path).length > MAX_FILE_PATH_UTF8_BYTES
    ) {
      return "its name is empty or too long. Rename it";
    }
    if (/[\u0000-\u001f\u007f%;:\\]/.test(path)) {
      return "its name has a character that cannot be saved (% ; : \\ or a control character). Rename it";
    }
    if (path.endsWith(".cmekshadow")) {
      return "its name ends in .cmekshadow, which is reserved. Rename it";
    }
    let segments = path.split("/");
    if (
      path.startsWith("/") ||
      segments.some((input) => input === "" || input === "." || input === "..")
    ) {
      return "its path has an empty part, or a part that is only dots. Rename it";
    }
    if (segments[0]!.startsWith("_")) {
      return "its top-level name starts with an underscore, which is reserved. Rename it";
    }
    return;
  }
  function isTextFileWithInvalidUnicode(
    input: string,
    options: FilePublishInput,
  ): boolean {
    if (options === null) {
      return false;
    }
    let value = normalizeFilePublishInput(input, options);
    return (
      value !== null &&
      typeof value !== "string" &&
      typeof value.content === "string" &&
      TEXT_FILE_MIME_TYPES.has(value.contentType) &&
      textContainsInvalidUnicode(value.content)
    );
  }
  function filePublishRejection(
    input: string,
    options: FilePublishInput,
  ): FilePublishRejection | undefined {
    let value = validateFilePath(input);
    if (value !== undefined) {
      return {
        why: value,
        cause: "name",
      };
    }
    if (options === null) {
      return;
    }
    let value2 = normalizeFilePublishInput(input, options);
    if (typeof value2 === "string") {
      if (value2.includes("files of this kind")) {
        return {
          why: value2.slice(value2.indexOf(": ") + 2),
          cause: "kind",
        };
      }
      if (value2.includes("cannot infer a content type")) {
        return {
          why: "files of this kind cannot be saved here (nothing is known for a name like this). Use another format",
          cause: "kind",
        };
      }
      return {
        why: "it is in a form that cannot be saved here",
        cause: "unreadable",
      };
    }
    if (isTextFileWithInvalidUnicode(input, options)) {
      return {
        why:
          "it holds a character that did not decode (it shows as " +
          UNICODE_REPLACEMENT_CHARACTER +
          "). Find it and type it again",
        cause: "damaged_text",
      };
    } else {
      return undefined;
    }
  }
  function fileMimeTypeFromPath(path: string): string | undefined {
    let slashIndex = path.lastIndexOf("/"),
      dotIndex = path.lastIndexOf(".");
    if (dotIndex <= slashIndex + 1) {
      return;
    }
    return FILE_MIME_TYPES_BY_EXTENSION.get(
      path.slice(dotIndex + 1).toLowerCase(),
    );
  }
  function stripFrameRuntimeBlock(input: string): string {
    let value = input.indexOf(FRAME_RUNTIME_BLOCK_START);
    if (value < 0) {
      return input;
    }
    let value2 = input.indexOf(
      FRAME_RUNTIME_BLOCK_END,
      value + FRAME_RUNTIME_BLOCK_START.length,
    );
    if (value2 < 0) {
      return input;
    } else {
      return (
        input.slice(0, value) +
        input.slice(value2 + FRAME_RUNTIME_BLOCK_END.length)
      );
    }
  }
  function normalizeFilePublishInput(
    path: string,
    input: FilePublishInput,
  ): NormalizedFilePublishInput | string | null {
    if (input === null) {
      return null;
    }
    let content: unknown = input,
      contentType: string | undefined;
    if (
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
    ) {
      content = (input as FilePublishWrapper).content;
      contentType = (input as FilePublishWrapper).contentType;
    }
    let isBlob = typeof Blob !== "undefined" && content instanceof Blob;
    if (typeof content !== "string" && !isBlob) {
      return path + ": content must be a string or a Blob";
    }
    let value = isBlob ? (content as Blob).type.split(";")[0]!.trim() : "",
      value2 =
        contentType ??
        (FILE_ALLOWED_MIME_TYPES.has(value) ? value : undefined) ??
        fileMimeTypeFromPath(path) ??
        (value !== "" ? value : undefined);
    if (value2 === undefined) {
      return (
        path +
        ": cannot infer a content type from the name; pass {content, contentType}"
      );
    }
    if (value2 === "" || value2.includes(";")) {
      return path + ": contentType must be a bare media type";
    }
    if (
      !FILE_ALLOWED_MIME_TYPES.has(value2) &&
      !(contentType !== undefined && FILE_BINARY_MIME_TYPES.has(value2))
    ) {
      return (
        path +
        ": files of this kind (" +
        value2 +
        ") cannot be saved here. Use another format"
      );
    }
    return {
      content: content as string | Blob,
      contentType: value2,
    };
  }
  function filePublishEncodedBytes(input: FilePublishInput): number {
    if (input === null) {
      return 0;
    }
    let value = filePublishContent(input);
    if (typeof value === "string") {
      return (0, runtime.encodeFileUtf8)(value).length;
    } else {
      return Math.ceil(value.size / 3) * 4;
    }
  }
  function filePublishRawBytes(input: FilePublishInput): number {
    if (input === null) {
      return 0;
    }
    let value = filePublishContent(input);
    if (typeof value === "string") {
      return (0, runtime.encodeFileUtf8)(value).length;
    } else {
      return value.size;
    }
  }
  function filePublishSizeRejection(input: FilePublishInput): string | undefined {
    if (
      input === null ||
      filePublishEncodedBytes(input) <= MAX_FILE_PUBLISH_ENCODED_BYTES
    ) {
      return;
    }
    let isText = typeof filePublishContent(input) === "string",
      limitMegabytes =
        (isText
          ? MAX_FILE_PUBLISH_ENCODED_BYTES
          : (MAX_FILE_PUBLISH_ENCODED_BYTES / 4) * 3) / 1048576;
    return (
      "it is over the " +
      String(limitMegabytes) +
      " MB limit for one file. Make it smaller" +
      (isText ? " (an image or a font pasted into it is the usual cause)" : "")
    );
  }
  async function fileContentBytes(input: string | Blob): Promise<Uint8Array> {
    if (typeof input === "string") {
      return (0, runtime.encodeFileUtf8)(input);
    } else {
      return new Uint8Array(await input.arrayBuffer());
    }
  }
  async function hashFilePublishEntries(
    entries: FilePublishEntries,
  ): Promise<Record<string, string>> {
    let hashes: Record<string, string> = {};
    for (let [value, value2] of Object.entries(entries)) {
      let value3 = normalizeFilePublishInput(value, value2);
      if (value3 === null || typeof value3 === "string") {
        continue;
      }
      hashes[value] = await (0, runtime.sha256)(
        await fileContentBytes(value3.content),
      );
    }
    return hashes;
  }
  function validateFilePublishBatch(
    entries: FilePublishEntries,
  ): FilePublishBatchRejection | undefined {
    let paths = Object.keys(entries);
    if (paths.length === 0 || paths.length > MAX_FILE_BATCH_ENTRIES) {
      return {
        ok: false,
        code: "invalid_content",
      };
    }
    let encodedBytes = 0;
    for (let value of paths) {
      if (validateFilePath(value) !== undefined) {
        return {
          ok: false,
          code: "invalid_content",
        };
      }
      if (
        typeof normalizeFilePublishInput(value, entries[value]!) === "string"
      ) {
        return {
          ok: false,
          code: "invalid_content",
        };
      }
      encodedBytes += filePublishEncodedBytes(entries[value]!);
    }
    if (encodedBytes > MAX_FILE_PUBLISH_ENCODED_BYTES) {
      return {
        ok: false,
        code: "too_large",
      };
    } else {
      return undefined;
    }
  }
  function splitFilePublishBatches(
    entries: FilePublishEntries,
    isIndexPath: (path: string) => boolean = runtime.isProjectIndexFilePath,
    maxBytes: number = MAX_FILE_BATCH_ENCODED_BYTES,
    maxEntries: number = MAX_FILE_BATCH_ENTRIES,
  ): FilePublishEntries[] {
    let allEntries = Object.entries(entries),
      contentEntries = allEntries.filter(([input]) => !isIndexPath(input)),
      indexEntries = allEntries.filter(([input]) => isIndexPath(input)),
      batches: FilePublishEntries[] = [],
      batch: FilePublishEntries = {},
      batchBytes = 0,
      batchCount = 0,
      appendEntry = (input: string, options: FilePublishInput) => {
        let value = filePublishEncodedBytes(options);
        if (
          batchCount > 0 &&
          (batchBytes + value > maxBytes || batchCount + 1 > maxEntries)
        ) {
          batches.push(batch);
          batch = {};
          batchBytes = 0;
          batchCount = 0;
        }
        batch[input] = options;
        batchBytes += value;
        batchCount += 1;
      };
    for (let [value, value2] of contentEntries) appendEntry(value, value2);
    for (let [value, value2] of indexEntries) appendEntry(value, value2);
    if (batchCount > 0) {
      batches.push(batch);
    }
    return batches;
  }
  function fileContentContainsRuntimeMarkers(input: FilePublishInput): boolean {
    if (input === null) {
      return false;
    }
    let value: unknown =
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? (input as FilePublishWrapper).content
        : input;
    return (
      typeof value === "string" &&
      (value.includes("/_cas/") ||
        value.includes(FRAME_RUNTIME_BLOCK_START) ||
        value.includes("__frame_comments__"))
    );
  }
  bindRuntimeValue(
    runtime,
    "fileListingIsNarrowed",
    () => fileListingIsNarrowed,
  );
  bindRuntimeValue(runtime, "normalizeFilesPort", () => normalizeFilesPort);
  bindRuntimeValue(
    runtime,
    "MAX_FILE_BATCH_ENTRIES",
    () => MAX_FILE_BATCH_ENTRIES,
    (value) => {
      MAX_FILE_BATCH_ENTRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILE_PATH_UTF8_BYTES",
    () => MAX_FILE_PATH_UTF8_BYTES,
    (value) => {
      MAX_FILE_PATH_UTF8_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILE_PUBLISH_ENCODED_BYTES",
    () => MAX_FILE_PUBLISH_ENCODED_BYTES,
    (value) => {
      MAX_FILE_PUBLISH_ENCODED_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILE_BATCH_ENCODED_BYTES",
    () => MAX_FILE_BATCH_ENCODED_BYTES,
    (value) => {
      MAX_FILE_BATCH_ENCODED_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_MIME_TYPES_BY_EXTENSION",
    () => FILE_MIME_TYPES_BY_EXTENSION,
    (value) => {
      FILE_MIME_TYPES_BY_EXTENSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_ALLOWED_MIME_TYPES",
    () => FILE_ALLOWED_MIME_TYPES,
    (value) => {
      FILE_ALLOWED_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BINARY_MIME_TYPES",
    () => FILE_BINARY_MIME_TYPES,
    (value) => {
      FILE_BINARY_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(runtime, "validateFilePath", () => validateFilePath);
  bindRuntimeValue(
    runtime,
    "TEXT_FILE_MIME_TYPES",
    () => TEXT_FILE_MIME_TYPES,
    (value) => {
      TEXT_FILE_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNICODE_REPLACEMENT_CHARACTER",
    () => UNICODE_REPLACEMENT_CHARACTER,
    (value) => {
      UNICODE_REPLACEMENT_CHARACTER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_UNPAIRED_SURROGATE_PATTERN",
    () => FILE_UNPAIRED_SURROGATE_PATTERN,
    (value) => {
      FILE_UNPAIRED_SURROGATE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textContainsInvalidUnicode",
    () => textContainsInvalidUnicode,
    (value) => {
      textContainsInvalidUnicode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isTextFileWithInvalidUnicode",
    () => isTextFileWithInvalidUnicode,
  );
  bindRuntimeValue(runtime, "filePublishRejection", () => filePublishRejection);
  bindRuntimeValue(runtime, "fileMimeTypeFromPath", () => fileMimeTypeFromPath);
  bindRuntimeValue(
    runtime,
    "isHtmlFilePath",
    () => isHtmlFilePath,
    (value) => {
      isHtmlFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FRAME_RUNTIME_BLOCK_START",
    () => FRAME_RUNTIME_BLOCK_START,
    (value) => {
      FRAME_RUNTIME_BLOCK_START = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FRAME_RUNTIME_BLOCK_END",
    () => FRAME_RUNTIME_BLOCK_END,
    (value) => {
      FRAME_RUNTIME_BLOCK_END = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stripFrameRuntimeBlock",
    () => stripFrameRuntimeBlock,
  );
  bindRuntimeValue(
    runtime,
    "normalizeFilePublishInput",
    () => normalizeFilePublishInput,
  );
  bindRuntimeValue(
    runtime,
    "filePublishContent",
    () => filePublishContent,
    (value) => {
      filePublishContent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filePublishEncodedBytes",
    () => filePublishEncodedBytes,
  );
  bindRuntimeValue(runtime, "filePublishRawBytes", () => filePublishRawBytes);
  bindRuntimeValue(
    runtime,
    "filePublishSizeRejection",
    () => filePublishSizeRejection,
  );
  bindRuntimeValue(runtime, "fileContentBytes", () => fileContentBytes);
  bindRuntimeValue(
    runtime,
    "hashFilePublishEntries",
    () => hashFilePublishEntries,
  );
  bindRuntimeValue(
    runtime,
    "validateFilePublishBatch",
    () => validateFilePublishBatch,
  );
  bindRuntimeValue(
    runtime,
    "splitFilePublishBatches",
    () => splitFilePublishBatches,
  );
  bindRuntimeValue(
    runtime,
    "fileContentContainsRuntimeMarkers",
    () => fileContentContainsRuntimeMarkers,
  );
  bindRuntimeValue(
    runtime,
    "encodeFileUrlPath",
    () => encodeFileUrlPath,
    (value) => {
      encodeFileUrlPath = value;
    },
  );
  return () => {
    MAX_FILE_BATCH_ENTRIES = 256;
    MAX_FILE_PATH_UTF8_BYTES = 512;
    MAX_FILE_PUBLISH_ENCODED_BYTES = 16777216;
    MAX_FILE_BATCH_ENCODED_BYTES = 15728640;
    FILE_MIME_TYPES_BY_EXTENSION = new Map([
      ["html", "text/html"],
      ["htm", "text/html"],
      ["css", "text/css"],
      ["js", "text/javascript"],
      ["mjs", "text/javascript"],
      ["json", "application/json"],
      ["webmanifest", "application/manifest+json"],
      ["txt", "text/plain"],
      ["md", "text/markdown"],
      ["xml", "application/xml"],
      ["svg", "image/svg+xml"],
      ["png", "image/png"],
      ["jpg", "image/jpeg"],
      ["jpeg", "image/jpeg"],
      ["gif", "image/gif"],
      ["webp", "image/webp"],
      ["avif", "image/avif"],
      ["ico", "image/x-icon"],
      ["woff", "font/woff"],
      ["woff2", "font/woff2"],
      ["ttf", "font/ttf"],
      ["otf", "font/otf"],
      ["mp3", "audio/mpeg"],
      ["wav", "audio/wav"],
      ["mp4", "video/mp4"],
      ["webm", "video/webm"],
      ["pdf", "application/pdf"],
      ["wasm", "application/wasm"],
    ]);
    FILE_ALLOWED_MIME_TYPES = new Set([
      "text/html",
      "text/css",
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/javascript",
      "application/javascript",
      "application/json",
      "application/manifest+json",
      "application/xml",
      "text/xml",
      "application/wasm",
      "image/svg+xml",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/avif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
      "font/woff",
      "font/woff2",
      "font/ttf",
      "font/otf",
      "application/font-woff",
      "application/font-woff2",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "application/pdf",
      "application/zip+dotlottie",
    ]);
    FILE_BINARY_MIME_TYPES = new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/x-figma",
    ]);
    TEXT_FILE_MIME_TYPES = new Set([
      "text/html",
      "text/ldx",
      "text/css",
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/javascript",
      "application/javascript",
      "application/json",
      "application/manifest+json",
      "application/xml",
      "text/xml",
      "image/svg+xml",
    ]);
    UNICODE_REPLACEMENT_CHARACTER = String.fromCharCode(65533);
    FILE_UNPAIRED_SURROGATE_PATTERN =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    textContainsInvalidUnicode = (input) =>
      input.includes(UNICODE_REPLACEMENT_CHARACTER) ||
      FILE_UNPAIRED_SURROGATE_PATTERN.test(input);
    isHtmlFilePath = (input) => /\.html?$/i.test(input);
    FRAME_RUNTIME_BLOCK_START = "<\!-- frame-runtime -->";
    FRAME_RUNTIME_BLOCK_END = "<\!-- /frame-runtime -->";
    filePublishContent = (input) =>
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? (input as FilePublishWrapper).content
        : input;
    encodeFileUrlPath = (input) =>
      input.split("/").map(encodeURIComponent).join("/");
  };
}

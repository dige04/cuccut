/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  NormalizedFilePublishInput,
  FilePublishRejection,
  FileVersionCaps,
  FileRetryError,
  FileArtifactType,
  PathCheckException,
  PathCheckErrorConstructor,
  JsonFileState,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesPaths(runtime: RuntimeBindings): () => void {
  var PROJECT_INDEX_PATHS: Record<"design" | "slides" | "designSystem", string>;
  var LEGACY_PROJECT_INDEX_PATHS: { designSystem: string };
  var PROJECT_FILE_PREFIX: string;
  var MIGRATION_MANIFEST_PATH: string;
  var RESERVED_PROJECT_FILES_BY_TYPE: Record<FileArtifactType, string[]>;
  var PUBLIC_PROJECT_FILES_BY_TYPE: Partial<Record<FileArtifactType, string[]>>;
  var isReservedProjectFile: (type: FileArtifactType, path: string) => boolean;
  var isPrivateProjectFile: (type: FileArtifactType, path: string) => boolean;
  var isRuntimeInternalFilePath: (path: string) => boolean;
  var isProjectIndexFilePath: (path: string) => boolean;
  var MAX_FILE_BATCH_ENTRIES: number;
  var MAX_FILE_PATH_UTF8_BYTES: number;
  var MAX_FILE_PUBLISH_ENCODED_BYTES: number;
  var DEFAULT_FILE_VERSION_CAPS: FileVersionCaps;
  var MAX_FILE_BATCH_ENCODED_BYTES: number;
  var FILE_MIME_TYPES_BY_EXTENSION: Map<string, string>;
  var FILE_ALLOWED_MIME_TYPES: Set<string>;
  var FILE_BINARY_MIME_TYPES: Set<string>;
  var TEXT_FILE_MIME_TYPES: Set<string>;
  var UNICODE_REPLACEMENT_CHARACTER: string;
  var FILE_UNPAIRED_SURROGATE_PATTERN: RegExp;
  var textContainsInvalidUnicode: (text: string) => boolean;
  var filePublishRejectionReason: (
    path: string,
    input: Files.FilePublishInput,
  ) => string | undefined;
  var isHtmlFilePath: (path: string) => boolean;
  var FRAME_RUNTIME_BLOCK_START: string;
  var FRAME_RUNTIME_BLOCK_END: string;
  var filePublishContent: (
    input: Exclude<Files.FilePublishInput, null>,
  ) => Files.FileContents;
  var encodeFileUrlPath: (path: string) => string;
  var PathCheckError: PathCheckErrorConstructor;
  var PATH_CONTROL_CHARACTER_PATTERN: RegExp;
  var PATH_RESERVED_CHARACTER_PATTERN: RegExp;
  var FILE_FETCH_RETRY_DELAYS_MS: number[];
  function fileListingIsNarrowed(
    listing: Files.FileListing,
    port: Files.BrowserFilesPort,
  ) {
    return listing.narrowed ?? port.narrowed === true;
  }
  function filesPortExtensions<Port extends Files.BrowserFilesPort>(
    port: Port,
  ): Port {
    return port;
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
    let parts = path.split("/");
    if (
      path.startsWith("/") ||
      parts.some(
        (input: string) => input === "" || input === "." || input === "..",
      )
    ) {
      return "its path has an empty part, or a part that is only dots. Rename it";
    }
    if (parts[0].startsWith("_")) {
      return "its top-level name starts with an underscore, which is reserved. Rename it";
    }
    return;
  }
  function isTextFileWithInvalidUnicode(
    path: string,
    input: Files.FilePublishInput,
  ) {
    if (input === null) {
      return false;
    }
    let normalized = normalizeFilePublishInput(path, input);
    return (
      normalized !== null &&
      typeof normalized !== "string" &&
      typeof normalized.content === "string" &&
      TEXT_FILE_MIME_TYPES.has(normalized.contentType) &&
      textContainsInvalidUnicode(normalized.content)
    );
  }
  function restrictedFileNameReason(path: string) {
    if (
      /[\u0000-\u001f\u007f%;:\\]/.test(path) ||
      path.endsWith(".cmekshadow")
    ) {
      return validateFilePath(path);
    } else {
      return undefined;
    }
  }
  function filePublishRejection(
    path: string,
    input: Files.FilePublishInput,
  ): FilePublishRejection | undefined {
    let nameProblem = validateFilePath(path);
    if (nameProblem !== undefined) {
      return {
        why: nameProblem,
        cause: "name",
      };
    }
    if (input === null) {
      return;
    }
    let normalized = normalizeFilePublishInput(path, input);
    if (typeof normalized === "string") {
      if (normalized.includes("files of this kind")) {
        return {
          why: normalized.slice(normalized.indexOf(": ") + 2),
          cause: "kind",
        };
      }
      if (normalized.includes("cannot infer a content type")) {
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
    if (isTextFileWithInvalidUnicode(path, input)) {
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
  function fileMimeTypeFromPath(path: string) {
    let lastSlash = path.lastIndexOf("/"),
      lastDot = path.lastIndexOf(".");
    if (lastDot <= lastSlash + 1) {
      return;
    }
    return FILE_MIME_TYPES_BY_EXTENSION.get(
      path.slice(lastDot + 1).toLowerCase(),
    );
  }
  function stripFrameRuntimeBlock(html: string) {
    let start = html.indexOf(FRAME_RUNTIME_BLOCK_START);
    if (start < 0) {
      return html;
    }
    let end = html.indexOf(
      FRAME_RUNTIME_BLOCK_END,
      start + FRAME_RUNTIME_BLOCK_START.length,
    );
    if (end < 0) {
      return html;
    } else {
      return (
        html.slice(0, start) + html.slice(end + FRAME_RUNTIME_BLOCK_END.length)
      );
    }
  }
  function normalizeFilePublishInput(
    path: string,
    input: Files.FilePublishInput,
  ): NormalizedFilePublishInput | string | null {
    if (input === null) {
      return null;
    }
    let content: Files.FileContents | Exclude<Files.FilePublishInput, null> =
        input,
      contentType: string | undefined;
    if (
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
    ) {
      content = (input as NormalizedFilePublishInput).content;
      contentType = (input as NormalizedFilePublishInput).contentType;
    }
    let isBlob = typeof Blob !== "undefined" && content instanceof Blob;
    if (typeof content !== "string" && !isBlob) {
      return path + ": content must be a string or a Blob";
    }
    let blobMime = isBlob ? (content as Blob).type.split(";")[0].trim() : "",
      resolvedMime =
        contentType ??
        (FILE_ALLOWED_MIME_TYPES.has(blobMime) ? blobMime : undefined) ??
        fileMimeTypeFromPath(path) ??
        (blobMime !== "" ? blobMime : undefined);
    if (resolvedMime === undefined) {
      return (
        path +
        ": cannot infer a content type from the name; pass {content, contentType}"
      );
    }
    if (resolvedMime === "" || resolvedMime.includes(";")) {
      return path + ": contentType must be a bare media type";
    }
    if (
      !FILE_ALLOWED_MIME_TYPES.has(resolvedMime) &&
      !(contentType !== undefined && FILE_BINARY_MIME_TYPES.has(resolvedMime))
    ) {
      return (
        path +
        ": files of this kind (" +
        resolvedMime +
        ") cannot be saved here. Use another format"
      );
    }
    return {
      content: content as Files.FileContents,
      contentType: resolvedMime,
    };
  }
  function filePublishEncodedBytes(input: Files.FilePublishInput) {
    if (input === null) {
      return 0;
    }
    let content = filePublishContent(input);
    if (typeof content === "string") {
      return (0, runtime.encodeFileUtf8)(content).length;
    } else {
      return Math.ceil(content.size / 3) * 4;
    }
  }
  function filePublishRawBytes(input: Files.FilePublishInput) {
    if (input === null) {
      return 0;
    }
    let content = filePublishContent(input);
    if (typeof content === "string") {
      return (0, runtime.encodeFileUtf8)(content).length;
    } else {
      return content.size;
    }
  }
  function filePublishSizeRejection(
    input: Files.FilePublishInput,
  ): undefined | string {
    if (
      input === null ||
      filePublishEncodedBytes(input) <= MAX_FILE_PUBLISH_ENCODED_BYTES
    ) {
      return;
    }
    let isText: boolean = typeof filePublishContent(input) === "string",
      limitMb: number =
        (isText
          ? MAX_FILE_PUBLISH_ENCODED_BYTES
          : (MAX_FILE_PUBLISH_ENCODED_BYTES / 4) * 3) / 1048576;
    return (
      "it is over the " +
      String(limitMb) +
      " MB limit for one file. Make it smaller" +
      (isText ? " (an image or a font pasted into it is the usual cause)" : "")
    );
  }
  async function fileContentBytes(
    content: Files.FileContents,
  ): Promise<Uint8Array<ArrayBuffer>> {
    if (typeof content === "string") {
      return (0, runtime.encodeFileUtf8)(content);
    } else {
      return new Uint8Array(await content.arrayBuffer());
    }
  }
  async function hashFilePublishEntries(
    entries: Files.FilePublishEntries,
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
    entries: Files.FilePublishEntries,
  ): Files.FilePublishFailure | undefined {
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
        typeof normalizeFilePublishInput(value, entries[value]) === "string"
      ) {
        return {
          ok: false,
          code: "invalid_content",
        };
      }
      encodedBytes += filePublishEncodedBytes(entries[value]);
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
    entries: Files.FilePublishEntries,
    isIndexPath: (path: string) => boolean = isProjectIndexFilePath,
    maxBytes: number = MAX_FILE_BATCH_ENCODED_BYTES,
    maxEntries: number = MAX_FILE_BATCH_ENTRIES,
  ) {
    let allEntries = Object.entries(entries),
      contentEntries = allEntries.filter(
        ([input]: [string, Files.FilePublishInput]): boolean =>
          !isIndexPath(input),
      ),
      indexEntries = allEntries.filter(
        ([input]: [string, Files.FilePublishInput]) => isIndexPath(input),
      ),
      batches: Files.FilePublishEntries[] = [],
      batch: Files.FilePublishEntries = {},
      bytes = 0,
      count = 0,
      append = (input: string, options: Files.FilePublishInput): void => {
        let value = filePublishEncodedBytes(options);
        if (count > 0 && (bytes + value > maxBytes || count + 1 > maxEntries)) {
          batches.push(batch);
          batch = {};
          bytes = 0;
          count = 0;
        }
        batch[input] = options;
        bytes += value;
        count += 1;
      };
    for (let [value, value2] of contentEntries) {
      append(value, value2);
    }
    for (let [value, value2] of indexEntries) {
      append(value, value2);
    }
    if (count > 0) {
      batches.push(batch);
    }
    return batches;
  }
  function fileContentContainsRuntimeMarkers(input: Files.FilePublishInput) {
    if (input === null) {
      return false;
    }
    let content =
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? (input as NormalizedFilePublishInput).content
        : input;
    return (
      typeof content === "string" &&
      (content.includes("/_cas/") ||
        content.includes(FRAME_RUNTIME_BLOCK_START) ||
        content.includes("__frame_comments__"))
    );
  }
  function normalizeDecodedFilePath(path: string) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      throw new PathCheckError("bad_path", path);
    }
    if (PATH_CONTROL_CHARACTER_PATTERN.test(decoded)) {
      throw new PathCheckError("bad_path", path);
    }
    let parts: string[] = [];
    for (let value of decoded.replace(/\\/g, "/").split("/")) {
      if (value === "" || value === ".") {
        continue;
      }
      if (value === "..") {
        if (parts.length === 0) {
          return null;
        }
        parts.pop();
        continue;
      }
      parts.push(value);
    }
    return parts.join("/");
  }
  function validateProjectFilePrefix(prefix: string) {
    if (
      typeof prefix !== "string" ||
      !prefix.endsWith("/") ||
      prefix.startsWith("/")
    ) {
      throw new PathCheckError("bad_prefix", String(prefix));
    }
    if (normalizeDecodedFilePath(prefix) + "/" !== prefix) {
      throw new PathCheckError("bad_prefix", prefix);
    }
    return prefix;
  }
  function requireFileWithinPrefix(
    prefix: string,
    normalized: string | null,
    original: string,
  ) {
    if (
      normalized === null ||
      !normalized.startsWith(prefix) ||
      normalized.length === prefix.length
    ) {
      throw new PathCheckError("escapes_prefix", original);
    }
    if (
      PATH_RESERVED_CHARACTER_PATTERN.test(normalized) ||
      normalized.endsWith(".cmekshadow") ||
      new TextEncoder().encode(normalized).length > 512
    ) {
      throw new PathCheckError("bad_path", original);
    }
    return normalized;
  }
  function canonicalFilePathWithinPrefix(prefix: string, path: string) {
    validateProjectFilePrefix(prefix);
    if (typeof path !== "string" || path === "") {
      throw new PathCheckError("bad_path", String(path));
    }
    return requireFileWithinPrefix(
      prefix,
      normalizeDecodedFilePath(path),
      path,
    );
  }
  function isRetryableFileReadAccessError(error: unknown) {
    let status: unknown = (error as FileRetryError | null)?.status;
    return status === 401 || status === 403 || status === 404;
  }
  async function listWritableFiles(
    port: Files.BrowserFilesPort,
  ): Promise<Files.FileListing> {
    if (
      port.mayWrite === true &&
      typeof port.listUnlessNarrowed === "function"
    ) {
      return await port.listUnlessNarrowed();
    }
    let listing = await port.list();
    if (port.mayWrite === true && fileListingIsNarrowed(listing, port)) {
      throw {
        code: "http",
        status: 403,
        narrowed: true,
        message: "_files.json: marked as narrowed",
      };
    }
    return listing;
  }
  async function retryFileRead<Result>(
    read: () => Result | Promise<Result>,
    timers?: Pick<Files.FilesTimers, "setTimeout">,
    onRetry?: (attempt: number, error: unknown) => void,
    delays: readonly number[] = FILE_FETCH_RETRY_DELAYS_MS,
  ): Promise<Result> {
    let clock = timers ?? {
      setTimeout: (input: () => void, options: number) =>
        setTimeout(input, options),
    };
    for (let index: number = 0; ; index++) {
      try {
        return await read();
      } catch (value: unknown) {
        if (index >= delays.length || !isRetryableFileReadAccessError(value)) {
          throw value;
        }
        onRetry?.(index + 1, value);
        await new Promise<void>(
          (input: () => void) => void clock.setTimeout(input, delays[index]),
        );
      }
    }
  }
  async function readJsonFileState(
    files: Files.BrowserFilesPort,
    path: string,
    timers?: Pick<Files.FilesTimers, "setTimeout">,
  ): Promise<JsonFileState> {
    let listed: boolean;
    try {
      listed = (
        await retryFileRead(() => listWritableFiles(files), timers)
      ).some((input: Files.FileListingRow): boolean => input.path === path);
    } catch (value: unknown) {
      return {
        state: "unreadable",
        ...((value as { narrowed?: unknown } | null)?.narrowed === true
          ? {
              narrowed: true,
            }
          : {}),
      };
    }
    if (!listed) {
      return {
        state: "absent",
      };
    }
    try {
      let value = await retryFileRead(() => files.readText(path), timers),
        value2: unknown = null;
      try {
        value2 = JSON.parse(value.text);
      } catch {
        value2 = null;
      }
      return {
        state: "read",
        value: value2,
        text: value.text,
        sha256: value.sha256,
      };
    } catch {
      return {
        state: "unreadable",
      };
    }
  }
  function damagedTextFiles(tree: {
    files: Map<string, Files.FilePublishInput>;
  }) {
    return [...tree.files]
      .filter(([input, input2]: [string, Files.FilePublishInput]) =>
        isTextFileWithInvalidUnicode(input, input2),
      )
      .map(([input, input2]: [string, Files.FilePublishInput]) => ({
        path: input,
        why:
          filePublishRejectionReason(input, input2) ??
          "its text cannot be saved",
      }));
  }
  function removeUnpublishableMigrationFiles(
    files: Map<string, Files.FilePublishInput>,
    type?: FileArtifactType,
  ) {
    let leftOut = [];
    for (let [value, value2] of [...files]) {
      let value3 =
        restrictedFileNameReason(value) ??
        (type !== undefined && isPrivateProjectFile(type, value)
          ? "this name is used by the page itself; rename this one to bring it over"
          : undefined) ??
        ((0, runtime.isPublishableFilePath)(value)
          ? filePublishRejectionReason(value, value2)
          : undefined);
      if (value3 === undefined) {
        continue;
      }
      files.delete(value);
      leftOut.push({
        path: value,
        why: value3,
      });
    }
    return leftOut;
  }
  bindRuntimeValue(
    runtime,
    "PROJECT_INDEX_PATHS",
    () => PROJECT_INDEX_PATHS,
    (value) => {
      PROJECT_INDEX_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_PROJECT_INDEX_PATHS",
    () => LEGACY_PROJECT_INDEX_PATHS,
    (value) => {
      LEGACY_PROJECT_INDEX_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROJECT_FILE_PREFIX",
    () => PROJECT_FILE_PREFIX,
    (value) => {
      PROJECT_FILE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_MANIFEST_PATH",
    () => MIGRATION_MANIFEST_PATH,
    (value) => {
      MIGRATION_MANIFEST_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_PROJECT_FILES_BY_TYPE",
    () => RESERVED_PROJECT_FILES_BY_TYPE,
    (value) => {
      RESERVED_PROJECT_FILES_BY_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PUBLIC_PROJECT_FILES_BY_TYPE",
    () => PUBLIC_PROJECT_FILES_BY_TYPE,
    (value) => {
      PUBLIC_PROJECT_FILES_BY_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isReservedProjectFile",
    () => isReservedProjectFile,
    (value) => {
      isReservedProjectFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPrivateProjectFile",
    () => isPrivateProjectFile,
    (value) => {
      isPrivateProjectFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRuntimeInternalFilePath",
    () => isRuntimeInternalFilePath,
    (value) => {
      isRuntimeInternalFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isProjectIndexFilePath",
    () => isProjectIndexFilePath,
    (value) => {
      isProjectIndexFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileListingIsNarrowed",
    () => fileListingIsNarrowed,
  );
  bindRuntimeValue(runtime, "filesPortExtensions", () => filesPortExtensions);
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
    "DEFAULT_FILE_VERSION_CAPS",
    () => DEFAULT_FILE_VERSION_CAPS,
    (value) => {
      DEFAULT_FILE_VERSION_CAPS = value;
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
  bindRuntimeValue(
    runtime,
    "restrictedFileNameReason",
    () => restrictedFileNameReason,
  );
  bindRuntimeValue(runtime, "filePublishRejection", () => filePublishRejection);
  bindRuntimeValue(
    runtime,
    "filePublishRejectionReason",
    () => filePublishRejectionReason,
    (value) => {
      filePublishRejectionReason = value;
    },
  );
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
  bindRuntimeValue(
    runtime,
    "PathCheckError",
    () => PathCheckError,
    (value) => {
      PathCheckError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PATH_CONTROL_CHARACTER_PATTERN",
    () => PATH_CONTROL_CHARACTER_PATTERN,
    (value) => {
      PATH_CONTROL_CHARACTER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PATH_RESERVED_CHARACTER_PATTERN",
    () => PATH_RESERVED_CHARACTER_PATTERN,
    (value) => {
      PATH_RESERVED_CHARACTER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDecodedFilePath",
    () => normalizeDecodedFilePath,
  );
  bindRuntimeValue(
    runtime,
    "validateProjectFilePrefix",
    () => validateProjectFilePrefix,
  );
  bindRuntimeValue(
    runtime,
    "requireFileWithinPrefix",
    () => requireFileWithinPrefix,
  );
  bindRuntimeValue(
    runtime,
    "canonicalFilePathWithinPrefix",
    () => canonicalFilePathWithinPrefix,
  );
  bindRuntimeValue(
    runtime,
    "FILE_FETCH_RETRY_DELAYS_MS",
    () => FILE_FETCH_RETRY_DELAYS_MS,
    (value) => {
      FILE_FETCH_RETRY_DELAYS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRetryableFileReadAccessError",
    () => isRetryableFileReadAccessError,
  );
  bindRuntimeValue(runtime, "listWritableFiles", () => listWritableFiles);
  bindRuntimeValue(runtime, "retryFileRead", () => retryFileRead);
  bindRuntimeValue(runtime, "readJsonFileState", () => readJsonFileState);
  bindRuntimeValue(runtime, "damagedTextFiles", () => damagedTextFiles);
  bindRuntimeValue(
    runtime,
    "removeUnpublishableMigrationFiles",
    () => removeUnpublishableMigrationFiles,
  );
  return () => {
    PROJECT_INDEX_PATHS = {
      design: "project/canvas.json",
      slides: "project/deck.json",
      designSystem: "project/design-system.json",
    };
    LEGACY_PROJECT_INDEX_PATHS = {
      designSystem: "design-system.json",
    };
    PROJECT_FILE_PREFIX = "project/";
    MIGRATION_MANIFEST_PATH = "project/migration.json";
    RESERVED_PROJECT_FILES_BY_TYPE = {
      design: ["canvas.json", "migration.json"],
      slides: ["deck.json", "migration.json", "store-meta.json"],
      design_system: [
        "design-system.json",
        "migration.json",
        "design-system.before-files.json",
        "publish-progress.json",
        "migration-map.json",
      ],
      migrated_design: ["compat.json", "publish-progress.json"],
    };
    PUBLIC_PROJECT_FILES_BY_TYPE = {
      slides: ["store-meta.json"],
    };
    isReservedProjectFile = (input: FileArtifactType, options: string) =>
      options.startsWith("project/") &&
      RESERVED_PROJECT_FILES_BY_TYPE[input].includes(options.slice(8));
    isPrivateProjectFile = (input: FileArtifactType, options: string) =>
      isReservedProjectFile(input, options) &&
      !(PUBLIC_PROJECT_FILES_BY_TYPE[input] ?? []).includes(options.slice(8));
    isRuntimeInternalFilePath = (input: string) =>
      input === "index.html" ||
      input === "SKILL.md" ||
      input.startsWith("artifact-type/");
    isProjectIndexFilePath = (input: string) =>
      input === PROJECT_INDEX_PATHS.design ||
      input === PROJECT_INDEX_PATHS.slides ||
      input === PROJECT_INDEX_PATHS.designSystem ||
      input === LEGACY_PROJECT_INDEX_PATHS.designSystem;
    MAX_FILE_BATCH_ENTRIES = 256;
    MAX_FILE_PATH_UTF8_BYTES = 512;
    MAX_FILE_PUBLISH_ENCODED_BYTES = 16777216;
    DEFAULT_FILE_VERSION_CAPS = {
      files: 512,
      bytes: 268435456,
    };
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
    textContainsInvalidUnicode = (input: string) =>
      input.includes(UNICODE_REPLACEMENT_CHARACTER) ||
      FILE_UNPAIRED_SURROGATE_PATTERN.test(input);
    filePublishRejectionReason = (
      input: string,
      options: Files.FilePublishInput,
    ) => filePublishRejection(input, options)?.why;
    isHtmlFilePath = (input: string) => /\.html?$/i.test(input);
    FRAME_RUNTIME_BLOCK_START = "<\!-- frame-runtime -->";
    FRAME_RUNTIME_BLOCK_END = "<\!-- /frame-runtime -->";
    filePublishContent = (input: Exclude<Files.FilePublishInput, null>) =>
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? (input as NormalizedFilePublishInput).content
        : input;
    encodeFileUrlPath = (input: string) =>
      input.split("/").map(encodeURIComponent).join("/");
    PathCheckError = class PathCheckError extends Error {
      declare name: string;
      code: PathCheckException["code"];
      subject: string;
      constructor(input: PathCheckException["code"], options: string) {
        super(input + ": " + JSON.stringify(options));
        this.code = input;
        this.subject = options;
        this.name = "PathCheckError";
      }
    };
    PATH_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
    PATH_RESERVED_CHARACTER_PATTERN = /[%;:]/;
    FILE_FETCH_RETRY_DELAYS_MS = [50, 100, 200, 400, 800];
  };
}

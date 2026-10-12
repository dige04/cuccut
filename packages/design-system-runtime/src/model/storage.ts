import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type { ParseReport, StorageCatalog } from "../contracts";
export function installModelStorage(runtime: RuntimeBindings): () => void {
  var SVG_MIME_TYPE: string;
  var BLOB_STORAGE_LIMITS: Storage.StorageLimits;
  var BLOB_STORAGE_MIME_TYPES: Record<string, string>;
  var BLOB_STORAGE_ACCEPTED_MIME_TYPES: Set<string>;
  var MAX_INLINE_FONT_BYTESModelStorage: number;
  var MAX_INLINE_ASSET_BYTESModelStorage: number;
  var FIGMA_FILE_REFUSAL_MESSAGE: string;
  var INLINE_NO_ROOM_MESSAGE: string;
  var BLOB_STORE_UNAVAILABLE_MESSAGE: string;
  var EMPTY_STORAGE_CATALOG: Model.StorageCatalog;
  var STORAGE_SHA256_PATTERN: RegExp;
  var STORAGE_MIME_TYPE_PATTERN: RegExp;
  var STORAGE_BLOB_URL_PATTERN: RegExp;
  var isStorageCatalogObject: (
    input: unknown,
  ) => input is Storage.DatabaseRecord;
  function storedFileByteLimit(mime: string | null): number {
    if (mime === SVG_MIME_TYPE) {
      return BLOB_STORAGE_LIMITS.svgFile;
    } else {
      return BLOB_STORAGE_LIMITS.file;
    }
  }
  function isFigmaFile(name: string): boolean {
    return /\.fig$/i.test(name);
  }
  function formatUploadBytes(bytes: number): string {
    if (bytes >= runtime.MEBIBYTE) {
      return (
        (bytes / runtime.MEBIBYTE)
          .toFixed(bytes >= 10 * runtime.MEBIBYTE ? 0 : 1)
          .replace(/\.0$/, "") + " MB"
      );
    } else {
      return String(Math.max(1, Math.ceil(bytes / runtime.KIBIBYTE))) + " KB";
    }
  }
  function explainUploadSize(
    bytes: number,
    limit: number,
    limitLabel: string = "the limit",
  ): string {
    if (formatUploadBytes(bytes) === formatUploadBytes(limit)) {
      return "it’s just over " + limitLabel + " of " + formatUploadBytes(limit);
    } else {
      return (
        "it’s " +
        formatUploadBytes(bytes) +
        " and " +
        limitLabel +
        " is " +
        formatUploadBytes(limit)
      );
    }
  }
  function estimateBase64StringBytes(bytes: number): number {
    return Math.ceil(bytes / 3) * 4 + 48;
  }
  function chooseFileStorageRoute(
    file: Storage.UploadCandidate,
    budget: Storage.UploadBudget,
  ): Storage.UploadRoute {
    if (isFigmaFile(file.name)) {
      return {
        to: "refuse",
        reason: FIGMA_FILE_REFUSAL_MESSAGE,
        handOff: "figma",
      };
    }
    let mime = storedMimeTypeForPath(file.name, file.type);
    if ((0, runtime.isTextFilePath)(file.name) && mime === null) {
      if (file.size > MAX_INLINE_ASSET_BYTESModelStorage) {
        return {
          to: "refuse",
          reason:
            "text files can be at most " +
            formatUploadBytes(MAX_INLINE_ASSET_BYTESModelStorage) +
            " here",
          handOff: "too-large",
        };
      }
      if (file.size + 64 <= budget.room) {
        return {
          to: "inline",
        };
      } else {
        return {
          to: "refuse",
          reason: INLINE_NO_ROOM_MESSAGE,
        };
      }
    }
    let inlineBytes = (0, runtime.isTextFilePath)(file.name)
        ? file.size + 64
        : estimateBase64StringBytes(file.size),
      inlineLimit: number = file.font
        ? MAX_INLINE_FONT_BYTESModelStorage
        : MAX_INLINE_ASSET_BYTESModelStorage,
      fitsInline = file.size <= inlineLimit && inlineBytes <= budget.room;
    if (mime === null) {
      if (fitsInline) {
        return {
          to: "inline",
        };
      }
      if (file.size > inlineLimit) {
        return {
          to: "refuse",
          reason:
            (file.font ? "fonts" : "files like this") +
            " can be at most " +
            formatUploadBytes(inlineLimit) +
            " here",
          handOff: "too-large",
        };
      }
      return {
        to: "refuse",
        reason: INLINE_NO_ROOM_MESSAGE,
      };
    }
    if (budget.tier === "off") {
      if (fitsInline) {
        return {
          to: "inline",
        };
      }
      if (file.size > inlineLimit) {
        return {
          to: "refuse",
          reason:
            explainUploadSize(
              file.size,
              inlineLimit,
              file.font ? "the limit for fonts here" : "the limit here",
            ) +
            " (" +
            BLOB_STORE_UNAVAILABLE_MESSAGE +
            ")",
          handOff: "too-large",
        };
      }
      return {
        to: "refuse",
        reason:
          INLINE_NO_ROOM_MESSAGE + " (" + BLOB_STORE_UNAVAILABLE_MESSAGE + ")",
      };
    }
    let blobLimit = storedFileByteLimit(mime);
    if (file.size > blobLimit) {
      if (fitsInline) {
        return {
          to: "inline",
        };
      }
      return {
        to: "refuse",
        reason: explainUploadSize(
          file.size,
          blobLimit,
          mime === SVG_MIME_TYPE ? "the limit for SVG" : "the limit",
        ),
        handOff: "too-large",
      };
    }
    let blobMaxBytes = budget.blobMaxBytes ?? BLOB_STORAGE_LIMITS.total;
    if (
      budget.blobUsed + file.size > blobMaxBytes ||
      budget.blobCount >= (budget.blobMaxFiles ?? BLOB_STORAGE_LIMITS.files)
    ) {
      if (fitsInline) {
        return {
          to: "inline",
        };
      }
      return {
        to: "refuse",
        reason:
          "this design system’s file storage is full (" +
          formatUploadBytes(budget.blobUsed) +
          " of " +
          formatUploadBytes(blobMaxBytes) +
          ", " +
          String(budget.blobCount) +
          // CucCut: user-facing copy calls the agent "the agent", not Claude.
          " files) — free space under Assets, or ask the agent to start a fresh system.",
      };
    }
    return {
      to: "blob",
      type: mime,
    };
  }
  function storedMimeTypeForPath(
    path: string,
    providedMime: string = "",
  ): string | null {
    if (!(0, runtime.canUseStoragePointer)(path)) {
      return null;
    }
    let mime =
      BLOB_STORAGE_MIME_TYPES[(0, runtime.fileExtension)(path)] ?? null;
    if (mime !== null) {
      return mime;
    }
    let normalizedMime = providedMime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (BLOB_STORAGE_ACCEPTED_MIME_TYPES.has(normalizedMime)) {
      return normalizedMime;
    } else {
      return null;
    }
  }
  function boundedStorageText(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (typeof value !== "string") {
      return;
    }
    let trimmed = value.trim();
    if (
      trimmed === "" ||
      trimmed.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(trimmed)
    ) {
      return;
    }
    return trimmed;
  }
  function boundedStorageBytes(
    value: unknown,
    maxBytes: number = 4398046511104,
  ): number {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.min(Math.floor(value), maxBytes);
    } else {
      return 0;
    }
  }
  function parseStorageRecord(
    path: string,
    input: unknown,
    report: Model.ParseReport,
  ): Model.StorageRecord | null {
    if (!isStorageCatalogObject(input)) {
      return null;
    }
    let store: Model.StorageKind | null =
      input.store === "blob" ||
      input.store === "file" ||
      input.store === "inline"
        ? input.store
        : null;
    if (store === null) {
      report.dropped.push(
        "manifest.json storage " +
          JSON.stringify(path.slice(0, 60)) +
          ": unknown store",
      );
      return null;
    }
    let id = boundedStorageText(input.id, 64);
    if (
      store === "blob" &&
      (id === undefined || !runtime.BLOB_ID_PATTERN.test(id))
    ) {
      report.dropped.push(
        "manifest.json storage " +
          JSON.stringify(path.slice(0, 60)) +
          ": blob record without a usable id",
      );
      return null;
    }
    let mime = boundedStorageText(input.type, 100)?.toLowerCase(),
      record: Model.StorageRecord = {
        store: store,
        bytes: boundedStorageBytes(
          input.bytes,
          store === "blob" ? BLOB_STORAGE_LIMITS.file : undefined,
        ),
        type:
          mime !== undefined && STORAGE_MIME_TYPE_PATTERN.test(mime)
            ? mime
            : (0, runtime.mimeTypeForPath)(path),
      };
    if (store === "blob") {
      record.id = id;
    }
    let url = boundedStorageText(input.url, 2048);
    if (url !== undefined && STORAGE_BLOB_URL_PATTERN.test(url)) {
      record.url = url;
    }
    let sha2562 = boundedStorageText(input.sha256, 64)?.toLowerCase();
    if (sha2562 !== undefined && STORAGE_SHA256_PATTERN.test(sha2562)) {
      record.sha256 = sha2562;
    }
    let storedSha256 = boundedStorageText(
      input.storedSha256,
      64,
    )?.toLowerCase();
    if (
      storedSha256 !== undefined &&
      STORAGE_SHA256_PATTERN.test(storedSha256) &&
      storedSha256 !== record.sha256
    ) {
      record.storedSha256 = storedSha256;
    }
    let name = boundedStorageText(input.name, 200);
    if (name !== undefined) {
      record.name = name;
    }
    let addedAt = boundedStorageText(input.addedAt, 40);
    if (addedAt !== undefined) {
      record.addedAt = addedAt;
    }
    let via = boundedStorageText(input.via, 120);
    if (via !== undefined) {
      record.via = via;
    }
    let thumb = boundedStorageText(input.thumb, 300);
    if (thumb !== undefined && (0, runtime.isValidDesignSystemPath)(thumb)) {
      record.thumb = thumb;
    }
    let supersedes = boundedStorageText(input.supersedes, 64);
    if (supersedes !== undefined && runtime.BLOB_ID_PATTERN.test(supersedes)) {
      record.supersedes = supersedes;
    }
    return record;
  }
  function storageCatalogFromManifest(
    manifestInput: unknown,
    report: ParseReport = {
      dropped: [],
      warnings: [],
    },
  ): StorageCatalog {
    let manifest = (0, runtime.parseManifest)(manifestInput, report);
    if (!Object.hasOwn(manifest, "storage")) {
      return {
        files: {},
      };
    }
    let storage = manifest.storage;
    if (!isStorageCatalogObject(storage)) {
      report.dropped.push(
        "manifest.json storage: not an object — the storage catalogue was ignored",
      );
      return {
        files: {},
      };
    }
    let files: Record<string, Model.StorageRecord> = {},
      count: number = 0;
    if (
      Object.hasOwn(storage, "files") &&
      !isStorageCatalogObject(storage.files)
    ) {
      report.dropped.push(
        "manifest.json storage.files: not an object — ignored",
      );
    }
    if (isStorageCatalogObject(storage.files)) {
      for (let value in storage.files) {
        if (!Object.hasOwn(storage.files, value)) {
          continue;
        }
        if (count >= runtime.MAX_DESIGN_SYSTEM_FILES) {
          break;
        }
        if (
          !(0, runtime.isValidDesignSystemPath)(value) ||
          !(0, runtime.canUseStoragePointer)(value)
        ) {
          report.dropped.push(
            "manifest.json storage " +
              JSON.stringify(String(value).slice(0, 60)) +
              ": not a binary table path",
          );
          continue;
        }
        let value2 = parseStorageRecord(value, storage.files[value], report);
        if (value2 === null) {
          continue;
        }
        files[value] = value2;
        count++;
      }
    }
    return {
      files: files,
    };
  }
  function reconcileStorageCatalog(
    files: Model.FileTable,
    catalog: Model.StorageCatalog,
  ): Model.StorageCatalog {
    let reconciled: Record<string, Model.StorageRecord> = {},
      pointers: [string, Model.StoragePointer][] = [];
    for (let value of Object.keys(files).sort()) {
      let value2 = (0, runtime.storagePointerForFile)(value, files[value]);
      if (
        value2 !== null &&
        !(0, runtime.isHeldFilePointer)(value, files[value])
      ) {
        pointers.push([value, value2]);
      }
    }
    let recordsById = new Map<string, Model.StorageRecord>();
    for (let value of Object.keys(catalog.files)) {
      let value2 = catalog.files[value];
      if (
        value2.store === "blob" &&
        value2.id !== undefined &&
        !recordsById.has(value2.id)
      ) {
        recordsById.set(value2.id, value2);
      }
    }
    for (let [value, value2] of pointers) {
      let value3 = catalog.files[value];
      if (value2.store === "blob") {
        if (
          value3 !== undefined &&
          value3.store === "blob" &&
          value3.id === value2.id
        ) {
          reconciled[value] = value3;
          continue;
        }
        let entry = recordsById.get(value2.id);
        reconciled[value] =
          entry !== undefined
            ? {
                ...entry,
              }
            : {
                store: "blob",
                id: value2.id,
                bytes: 0,
                type:
                  storedMimeTypeForPath(value) ??
                  (0, runtime.mimeTypeForPath)(value),
              };
      } else {
        reconciled[value] =
          value3 !== undefined && value3.store === "file"
            ? value3
            : {
                store: "file",
                bytes: 0,
                type: (0, runtime.mimeTypeForPath)(value),
              };
      }
    }
    return {
      files: reconciled,
    };
  }
  function referencedBlobIds(files: Model.FileTable): Set<string> {
    let ids = new Set<string>();
    for (let value of Object.keys(files)) {
      let value2 = (0, runtime.storagePointerForFile)(value, files[value]);
      if (value2 !== null && value2.store === "blob") {
        ids.add(value2.id);
      }
    }
    return ids;
  }
  function uniqueStoredBlobBytes(catalog: Model.StorageCatalog): number {
    let bytes = 0,
      seenIds = new Set();
    for (let value of Object.keys(catalog.files)) {
      let value2 = catalog.files[value];
      if (
        value2.store !== "blob" ||
        value2.id === undefined ||
        seenIds.has(value2.id)
      ) {
        continue;
      }
      seenIds.add(value2.id);
      bytes += value2.bytes;
    }
    return bytes;
  }
  function uniqueStoredBlobCount(catalog: Model.StorageCatalog): number {
    let ids = new Set<string>();
    for (let value of Object.keys(catalog.files)) {
      let value2 = catalog.files[value];
      if (value2.store === "blob" && value2.id !== undefined) {
        ids.add(value2.id);
      }
    }
    return ids.size;
  }
  function findStoredBlobByDigest(
    catalog: Model.StorageCatalog,
    digest: string,
    knownIds: ReadonlySet<string> | null | undefined,
  ): Storage.KnownStoredBlob | null {
    for (let value of Object.keys(catalog.files).sort()) {
      let value2 = catalog.files[value];
      if (
        value2.store !== "blob" ||
        value2.id === undefined ||
        (value2.sha256 !== digest &&
          !(value2.storedSha256 === digest && /\.svg$/i.test(value)))
      ) {
        continue;
      }
      if (
        knownIds !== undefined &&
        knownIds !== null &&
        !knownIds.has(value2.id)
      ) {
        continue;
      }
      return {
        id: value2.id,
        bytes: value2.bytes,
        type: value2.type,
        ...(value2.url !== undefined
          ? {
              url: value2.url,
            }
          : {}),
      };
    }
    return null;
  }
  function storageRecordForFile(
    files: Model.FileTable,
    catalog: Model.StorageCatalog,
    path: string,
  ): Model.StorageRecord | null {
    let content = files[path];
    if (content === undefined) {
      return null;
    }
    let pointer = (0, runtime.storagePointerForFile)(path, content);
    if (pointer === null) {
      return null;
    }
    let record = catalog.files[path];
    if (
      record !== undefined &&
      record.store === pointer.store &&
      (pointer.store !== "blob" || record.id === pointer.id)
    ) {
      return record;
    }
    if (pointer.store === "blob") {
      return {
        store: "blob",
        id: pointer.id,
        bytes: 0,
        type: storedMimeTypeForPath(path) ?? (0, runtime.mimeTypeForPath)(path),
      };
    } else {
      return {
        store: "file",
        bytes: 0,
        type: (0, runtime.mimeTypeForPath)(path),
      };
    }
  }
  function compareReferencedAndStoredBlobs(
    files: Model.FileTable,
    storedIds: ReadonlySet<string>,
  ): Storage.StorageComparison {
    let referencedIds = referencedBlobIds(files),
      missingPaths: string[] = [];
    for (let value of Object.keys(files).sort()) {
      let value2 = (0, runtime.storagePointerForFile)(value, files[value]);
      if (
        value2 !== null &&
        value2.store === "blob" &&
        !storedIds.has(value2.id)
      ) {
        missingPaths.push(value);
      }
    }
    return {
      missing: missingPaths,
      missingIds: [...referencedIds]
        .filter((input: string): boolean => !storedIds.has(input))
        .sort(),
      unreferenced: [...storedIds]
        .filter((input: string): boolean => !referencedIds.has(input))
        .sort(),
    };
  }
  function dropMissingBlobDigests(
    catalog: Model.StorageCatalog,
    missingIds: ReadonlySet<string>,
  ): Model.StorageCatalog {
    if (missingIds.size === 0) {
      return catalog;
    }
    let changed: boolean = false,
      files: Record<string, Model.StorageRecord> = {};
    for (let value of Object.keys(catalog.files)) {
      let value2 = catalog.files[value];
      if (
        value2.store === "blob" &&
        value2.id !== undefined &&
        missingIds.has(value2.id) &&
        (value2.sha256 !== undefined || value2.storedSha256 !== undefined)
      ) {
        let { sha256: value3, storedSha256: value4, ...value5 } = value2;
        files[value] = value5;
        changed = true;
      } else {
        files[value] = value2;
      }
    }
    if (changed) {
      return {
        files: files,
      };
    } else {
      return catalog;
    }
  }
  function serializeStorageCatalog(
    catalog: Model.StorageCatalog,
  ): Storage.SerializedStorageCatalog | undefined {
    let paths = Object.keys(catalog.files).sort();
    if (paths.length === 0) {
      return;
    }
    let files: Record<string, Model.StorageRecord> = {};
    for (let value of paths) {
      let value2 = catalog.files[value];
      files[value] = {
        store: value2.store,
        ...(value2.id !== undefined
          ? {
              id: value2.id,
            }
          : {}),
        ...(value2.url !== undefined
          ? {
              url: value2.url,
            }
          : {}),
        ...(value2.sha256 !== undefined
          ? {
              sha256: value2.sha256,
            }
          : {}),
        ...(value2.storedSha256 !== undefined
          ? {
              storedSha256: value2.storedSha256,
            }
          : {}),
        bytes: value2.bytes,
        type: value2.type,
        ...(value2.name !== undefined
          ? {
              name: value2.name,
            }
          : {}),
        ...(value2.addedAt !== undefined
          ? {
              addedAt: value2.addedAt,
            }
          : {}),
        ...(value2.via !== undefined
          ? {
              via: value2.via,
            }
          : {}),
        ...(value2.thumb !== undefined
          ? {
              thumb: value2.thumb,
            }
          : {}),
        ...(value2.supersedes !== undefined
          ? {
              supersedes: value2.supersedes,
            }
          : {}),
      };
    }
    return {
      files: files,
      blobBytesUsed: uniqueStoredBlobBytes(catalog),
    };
  }
  bindRuntimeValue(
    runtime,
    "SVG_MIME_TYPE",
    () => SVG_MIME_TYPE,
    (value) => {
      SVG_MIME_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOB_STORAGE_LIMITS",
    () => BLOB_STORAGE_LIMITS,
    (value) => {
      BLOB_STORAGE_LIMITS = value;
    },
  );
  bindRuntimeValue(runtime, "storedFileByteLimit", () => storedFileByteLimit);
  bindRuntimeValue(
    runtime,
    "BLOB_STORAGE_MIME_TYPES",
    () => BLOB_STORAGE_MIME_TYPES,
    (value) => {
      BLOB_STORAGE_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOB_STORAGE_ACCEPTED_MIME_TYPES",
    () => BLOB_STORAGE_ACCEPTED_MIME_TYPES,
    (value) => {
      BLOB_STORAGE_ACCEPTED_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_FONT_BYTESModelStorage",
    () => MAX_INLINE_FONT_BYTESModelStorage,
    (value) => {
      MAX_INLINE_FONT_BYTESModelStorage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_ASSET_BYTESModelStorage",
    () => MAX_INLINE_ASSET_BYTESModelStorage,
    (value) => {
      MAX_INLINE_ASSET_BYTESModelStorage = value;
    },
  );
  bindRuntimeValue(runtime, "isFigmaFile", () => isFigmaFile);
  bindRuntimeValue(
    runtime,
    "FIGMA_FILE_REFUSAL_MESSAGE",
    () => FIGMA_FILE_REFUSAL_MESSAGE,
    (value) => {
      FIGMA_FILE_REFUSAL_MESSAGE = value;
    },
  );
  bindRuntimeValue(runtime, "formatUploadBytes", () => formatUploadBytes);
  bindRuntimeValue(runtime, "explainUploadSize", () => explainUploadSize);
  bindRuntimeValue(
    runtime,
    "estimateBase64StringBytes",
    () => estimateBase64StringBytes,
  );
  bindRuntimeValue(
    runtime,
    "INLINE_NO_ROOM_MESSAGE",
    () => INLINE_NO_ROOM_MESSAGE,
    (value) => {
      INLINE_NO_ROOM_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BLOB_STORE_UNAVAILABLE_MESSAGE",
    () => BLOB_STORE_UNAVAILABLE_MESSAGE,
    (value) => {
      BLOB_STORE_UNAVAILABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chooseFileStorageRoute",
    () => chooseFileStorageRoute,
  );
  bindRuntimeValue(
    runtime,
    "storedMimeTypeForPath",
    () => storedMimeTypeForPath,
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_STORAGE_CATALOG",
    () => EMPTY_STORAGE_CATALOG,
    (value) => {
      EMPTY_STORAGE_CATALOG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORAGE_SHA256_PATTERN",
    () => STORAGE_SHA256_PATTERN,
    (value) => {
      STORAGE_SHA256_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORAGE_MIME_TYPE_PATTERN",
    () => STORAGE_MIME_TYPE_PATTERN,
    (value) => {
      STORAGE_MIME_TYPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORAGE_BLOB_URL_PATTERN",
    () => STORAGE_BLOB_URL_PATTERN,
    (value) => {
      STORAGE_BLOB_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isStorageCatalogObject",
    () => isStorageCatalogObject,
    (value) => {
      isStorageCatalogObject = value;
    },
  );
  bindRuntimeValue(runtime, "boundedStorageText", () => boundedStorageText);
  bindRuntimeValue(runtime, "boundedStorageBytes", () => boundedStorageBytes);
  bindRuntimeValue(runtime, "parseStorageRecord", () => parseStorageRecord);
  bindRuntimeValue(
    runtime,
    "storageCatalogFromManifest",
    () => storageCatalogFromManifest,
  );
  bindRuntimeValue(
    runtime,
    "reconcileStorageCatalog",
    () => reconcileStorageCatalog,
  );
  bindRuntimeValue(runtime, "referencedBlobIds", () => referencedBlobIds);
  bindRuntimeValue(
    runtime,
    "uniqueStoredBlobBytes",
    () => uniqueStoredBlobBytes,
  );
  bindRuntimeValue(
    runtime,
    "uniqueStoredBlobCount",
    () => uniqueStoredBlobCount,
  );
  bindRuntimeValue(
    runtime,
    "findStoredBlobByDigest",
    () => findStoredBlobByDigest,
  );
  bindRuntimeValue(runtime, "storageRecordForFile", () => storageRecordForFile);
  bindRuntimeValue(
    runtime,
    "compareReferencedAndStoredBlobs",
    () => compareReferencedAndStoredBlobs,
  );
  bindRuntimeValue(
    runtime,
    "dropMissingBlobDigests",
    () => dropMissingBlobDigests,
  );
  bindRuntimeValue(
    runtime,
    "serializeStorageCatalog",
    () => serializeStorageCatalog,
  );
  return () => {
    SVG_MIME_TYPE = "image/svg+xml";
    BLOB_STORAGE_LIMITS = {
      file: 20 * runtime.MEBIBYTE,
      svgFile: 2 * runtime.MEBIBYTE,
      total: 1024 * runtime.MEBIBYTE,
      files: 5000,
    };
    BLOB_STORAGE_MIME_TYPES = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: SVG_MIME_TYPE,
      mp4: "video/mp4",
      webm: "video/webm",
      pdf: "application/pdf",
      woff2: "font/woff2",
      woff: "font/woff",
      ttf: "font/ttf",
      otf: "font/otf",
    };
    BLOB_STORAGE_ACCEPTED_MIME_TYPES = new Set(
      Object.values(BLOB_STORAGE_MIME_TYPES),
    );
    MAX_INLINE_FONT_BYTESModelStorage =
      Math.floor((runtime.DESIGN_SYSTEM_INLINE_LIMITS.font * 3) / 4) - 1024;
    MAX_INLINE_ASSET_BYTESModelStorage =
      Math.floor((runtime.DESIGN_SYSTEM_INLINE_LIMITS.asset * 3) / 4) - 1024;
    FIGMA_FILE_REFUSAL_MESSAGE = ".fig files can’t be used here directly";
    INLINE_NO_ROOM_MESSAGE =
      "no room: the page holds " +
      formatUploadBytes(runtime.DESIGN_SYSTEM_INLINE_LIMITS.total) +
      " in all — remove something first";
    BLOB_STORE_UNAVAILABLE_MESSAGE =
      "large-file storage isn’t available in this view";
    EMPTY_STORAGE_CATALOG = {
      files: {},
    };
    STORAGE_SHA256_PATTERN = /^[0-9a-f]{64}$/;
    STORAGE_MIME_TYPE_PATTERN =
      /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
    STORAGE_BLOB_URL_PATTERN = /^blob:[^\s"'<>\\]{1,2040}$/;
    isStorageCatalogObject = (
      input: unknown,
    ): input is Storage.DatabaseRecord =>
      typeof input === "object" && input !== null && !Array.isArray(input);
  };
}

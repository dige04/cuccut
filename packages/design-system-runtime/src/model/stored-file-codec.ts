import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelStoredFileCodec(
  runtime: RuntimeBindings,
): () => void {
  var SYSTEM_COLLECTION: string;
  var META_DOCUMENT_ID: string;
  var TOKENS_DOCUMENT_ID: string;
  var SOURCE_DOCUMENT_ID: string;
  var UPGRADED_DOCUMENT_ID: string;
  var SYSTEM_META_DOCUMENT_PATH: string;
  var SYSTEM_TOKENS_DOCUMENT_PATH: string;
  var SYSTEM_SOURCE_DOCUMENT_PATH: string;
  var SYSTEM_UPGRADED_DOCUMENT_PATH: string;
  var RAW_TOKENS_DOCUMENT_PATH: string;
  var FILES_COLLECTION: string;
  var API_COLLECTION: string;
  var COMPONENTS_COLLECTION: string;
  var PREVIEWS_COLLECTION: string;
  var ASSETS_COLLECTION: string;
  var FONTS_COLLECTION: string;
  var DESIGN_SYSTEM_COLLECTIONS: string[];
  var MAX_SYNC_DOCUMENT_BYTES: number;
  var MAX_SYNC_DOCUMENT_DEPTH: number;
  var MAX_FILES_PER_COLLECTION: number;
  var MAX_SYNC_COLLECTION_BYTES: number;
  var MAX_INLINE_DATA_URI_BUDGET_FRACTION: number;
  var STORED_CODE_MIME_TYPES: Record<string, string>;
  var STORED_TEXT_MIME_TYPES: Record<string, string>;
  var MAX_CARRIED_FILES_METADATA: number;
  var CARRIED_FILE_FORMS: Storage.CarriedForm[];
  var storedFileEncoder: TextEncoder;
  var SAFE_DOCUMENT_ID_CHARACTER_PATTERN: RegExp;
  var DIRECT_PATH_COLLECTIONS: string[];
  var formatStoredFileKilobytes: (bytes: number) => string;
  var fileKindDescription: (path: string) => string;
  var BASE64_ALPHABETModelStoredFileCodec: string;
  var storedPathBasename: (path: string) => string;
  var rawDocumentPathForFile: (path: string) => string;
  var isPendingBlobId: (id: string) => boolean;
  var FAILED_CONVERSION_UPLOAD_MESSAGE: string;
  function hashDocumentId(key: string): string {
    let hash = 0x6c62272e07bb014262b821756295c58dn,
      prime: bigint = 0x0000000001000000000000000000013bn,
      mask: bigint = (1n << 128n) - 1n;
    for (let value of storedFileEncoder.encode(key)) {
      hash = ((hash ^ BigInt(value)) * prime) & mask;
    }
    return hash.toString(16).padStart(32, "0");
  }
  function encodeDocumentId(key: string): string {
    let encoded = "";
    for (let value of storedFileEncoder.encode(key)) {
      let value2 = String.fromCharCode(value);
      encoded +=
        value < 128 && SAFE_DOCUMENT_ID_CHARACTER_PATTERN.test(value2)
          ? value2
          : "~" + value.toString(16).padStart(2, "0");
    }
    if (encoded === "." || encoded === "..") {
      encoded = encoded.replaceAll(".", "~2e");
    }
    if (encoded.length > 150) {
      return "h~" + hashDocumentId(key);
    } else {
      return encoded;
    }
  }
  function collectionAndIdForFilePath(path: string): {
    collection: string;
    id: string;
  } {
    if (path === runtime.DESIGN_SYSTEM_PATHS.tokens) {
      return {
        collection: SYSTEM_COLLECTION,
        id: TOKENS_DOCUMENT_ID,
      };
    }
    if ((0, runtime.classifyDesignSystemFile)(path) === "preview") {
      return {
        collection: PREVIEWS_COLLECTION,
        id: encodeDocumentId(path.split("/")[1]),
      };
    }
    for (let value of DIRECT_PATH_COLLECTIONS) {
      if (
        path.startsWith(value + "/") &&
        (value !== API_COLLECTION || (0, runtime.isGeneratedApiPath)(path))
      ) {
        return {
          collection: value,
          id: encodeDocumentId(path.slice(value.length + 1)),
        };
      }
    }
    return {
      collection: FILES_COLLECTION,
      id: encodeDocumentId(path),
    };
  }
  function documentPathForFile(path: string): string {
    let location2 = collectionAndIdForFilePath(path);
    return location2.collection + "/" + location2.id;
  }
  function validatedFilePathForDocument(
    documentPath: string,
    record: Storage.DatabaseRecord,
  ): string | null {
    if (documentPath === SYSTEM_TOKENS_DOCUMENT_PATH) {
      return runtime.DESIGN_SYSTEM_PATHS.tokens;
    }
    let path = record.path;
    if (
      typeof path !== "string" ||
      !(0, runtime.isValidDesignSystemPath)(path) ||
      (0, runtime.normalizeDesignSystemPath)(path) !== path ||
      path === runtime.DESIGN_SYSTEM_PATHS.manifest ||
      (0, runtime.explainUnsafeMirrorPath)(path) !== null
    ) {
      return null;
    }
    if (path === runtime.DESIGN_SYSTEM_PATHS.tokens) {
      if (documentPath === RAW_TOKENS_DOCUMENT_PATH) {
        return path;
      } else {
        return null;
      }
    }
    if (documentPathForFile(path) === documentPath) {
      return path;
    } else {
      return null;
    }
  }
  function storedFileKind(path: string): Storage.StoredFileKind {
    let extension = (0, runtime.fileExtension)(path);
    if (
      Object.hasOwn(STORED_CODE_MIME_TYPES, extension) ||
      (0, runtime.classifyDesignSystemFile)(path) === "preview" ||
      path === runtime.GENERATED_TOKENS_CSS_PATH
    ) {
      return "code";
    }
    let mime = runtime.FILE_MIME_TYPES[extension] ?? "";
    if (mime.startsWith("font/")) {
      return "font";
    }
    if (mime.startsWith("image/")) {
      return "image";
    }
    if ((0, runtime.isTextFilePath)(path)) {
      return "text";
    } else {
      return "binary";
    }
  }
  function storedContentType(
    path: string,
    providedMime: string = "",
  ): string | null {
    let extension = (0, runtime.fileExtension)(path),
      mime =
        runtime.BLOB_STORAGE_MIME_TYPES[extension] ??
        STORED_CODE_MIME_TYPES[extension] ??
        STORED_TEXT_MIME_TYPES[extension];
    if (mime !== undefined) {
      return mime;
    }
    if ((0, runtime.isTextFilePath)(path)) {
      return "text/plain";
    }
    let normalizedMime = providedMime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (
      Object.values(runtime.BLOB_STORAGE_MIME_TYPES).includes(normalizedMime)
    ) {
      return normalizedMime;
    } else {
      return null;
    }
  }
  function blobAbsoluteUrl(id: string): string {
    return "/_blob/" + id;
  }
  function blobIdFromReference(reference: string): string | null {
    let match = /^(?:\/?_blob\/|blob:)?([A-Za-z0-9_-]+)$/.exec(reference);
    if (match !== null && runtime.BLOB_ID_PATTERN.test(match[1])) {
      return match[1];
    } else {
      return null;
    }
  }
  function chooseStoredConversionRoute(
    path: string,
    content: string,
    bytes: number = storedContentByteLength(content, path),
  ): Storage.StoredConversionRoute {
    let pointer = (0, runtime.storagePointerForFile)(path, content),
      mime = storedContentType(
        path,
        (0, runtime.parseDataUriHeader)(content)?.mime ?? "",
      );
    if (pointer?.store === "file") {
      return {
        to: "omit",
        carried:
          "it points at a file beside the page, which a store-backed system does not keep, so it was left out",
      };
    }
    if (pointer !== null) {
      return {
        to: "blob",
        contentType: mime ?? (0, runtime.mimeTypeForPath)(path),
      };
    }
    let tooLarge = (input: string | null): Storage.StoredConversionRoute => ({
      to: "omit",
      carried:
        formatStoredFileKilobytes(bytes) +
        " is more than the " +
        formatStoredFileKilobytes((0, runtime.storedFileByteLimit)(input)) +
        " a stored file can be, so it was left out",
    });
    if (
      storedFileKind(path) === "code" &&
      (0, runtime.classifyDesignSystemFile)(path) !== "preview" &&
      path !== runtime.GENERATED_TOKENS_CSS_PATH
    ) {
      if (bytes > (0, runtime.storedFileByteLimit)(mime)) {
        return tooLarge(mime);
      } else {
        return {
          to: "blob",
          contentType: mime!,
        };
      }
    }
    let fitsDocument: boolean =
      (0, runtime.estimateEmbeddedJsonBytes)(
        path === runtime.DESIGN_SYSTEM_PATHS.tokens
          ? (parseJsonObjectOrNull(content) ?? {
              path: path,
              kind: "text",
              data: content,
            })
          : {
              path: path,
              kind: storedFileKind(path),
              data: content,
            },
      ) <= MAX_SYNC_DOCUMENT_BYTES;
    if (!(0, runtime.isTextFilePath)(path) && mime !== null) {
      if (bytes > (0, runtime.storedFileByteLimit)(mime)) {
        return tooLarge(mime);
      } else {
        return {
          to: "blob",
          contentType: mime!,
        };
      }
    }
    if (!(0, runtime.isTextFilePath)(path)) {
      let value = sniffDataUriKind(content, path);
      if (value === "json") {
        if (bytes > (0, runtime.storedFileByteLimit)("application/json")) {
          return tooLarge("application/json");
        } else {
          return {
            to: "blob",
            contentType: "application/json",
          };
        }
      }
      if (value === "zip" && (0, runtime.fileExtension)(path) === "lottie") {
        return {
          to: "omit",
          carried:
            "it is a zipped .lottie (dotLottie), which the store cannot hold, so it was left out",
        };
      }
    }
    if (fitsDocument) {
      if ((0, runtime.isTextFilePath)(path)) {
        return {
          to: "inline",
        };
      } else {
        return {
          to: "data-uri",
          carried:
            "the store takes no " +
            fileKindDescription(path) +
            ", so it is kept inline",
        };
      }
    }
    if (mime === null) {
      return {
        to: "omit",
        carried:
          "the store takes no " +
          fileKindDescription(path) +
          " and " +
          formatStoredFileKilobytes(bytes) +
          " is too much to keep inline, so it was left out",
      };
    }
    if (bytes > (0, runtime.storedFileByteLimit)(mime)) {
      return tooLarge(mime);
    }
    return {
      to: "blob",
      contentType: mime!,
      carried:
        formatStoredFileKilobytes(bytes) +
        " of text is more than a document holds, so it is stored as a file (" +
        mime +
        ")",
    };
  }
  function sniffDataUriKind(content: string, path: string): null | string {
    let header = binaryDataUriHeader(content, path);
    if (header === null) {
      return null;
    }
    let sample = content.slice(header.payloadOffset, header.payloadOffset + 96),
      bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = header.base64
        ? decodeBase64Bytes(sample)
        : storedFileEncoder.encode(
            decodeURIComponent(sample.replace(/%[0-9a-f]?$/i, "")),
          );
    } catch {
      bytes = storedFileEncoder.encode(sample);
    }
    let offset: number = 0;
    while (
      offset < bytes.length &&
      (bytes[offset] === 32 ||
        bytes[offset] === 9 ||
        bytes[offset] === 10 ||
        bytes[offset] === 13)
    ) {
      offset++;
    }
    if (
      offset < bytes.length &&
      (bytes[offset] === 123 || bytes[offset] === 91)
    ) {
      return "json";
    }
    if (bytes.length >= 2 && bytes[0] === 80 && bytes[1] === 75) {
      return "zip";
    }
    return null;
  }
  function parseJsonObjectOrNull(text: unknown): Storage.DatabaseRecord | null {
    try {
      let value: unknown = JSON.parse(text as string);
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return value as Storage.DatabaseRecord;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function binaryDataUriHeader(
    content: string,
    path: string,
  ): Storage.BinaryHeader | null {
    if ((0, runtime.isTextFilePath)(path)) {
      return null;
    } else {
      return (0, runtime.parseDataUriHeader)(content);
    }
  }
  function storedContentByteLength(content: string, path: string): number {
    let header = binaryDataUriHeader(content, path);
    if (header === null) {
      return storedFileEncoder.encode(content).length;
    }
    let payloadLength = content.length - header.payloadOffset;
    if (header.base64) {
      return Math.max(
        0,
        Math.floor((payloadLength * 3) / 4) -
          (content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0),
      );
    } else {
      return payloadLength;
    }
  }
  function decodeBase64Bytes(base64: string): Uint8Array<ArrayBuffer> {
    let characters = base64.replace(/[^A-Za-z0-9+/]/g, ""),
      bytes = new Uint8Array(Math.floor((characters.length * 3) / 4)),
      outputOffset: number = 0;
    for (let index = 0; index < characters.length; index += 4) {
      let value: number =
        (BASE64_ALPHABETModelStoredFileCodec.indexOf(characters[index]) << 18) |
        (BASE64_ALPHABETModelStoredFileCodec.indexOf(
          characters[index + 1] ?? "A",
        ) <<
          12) |
        (BASE64_ALPHABETModelStoredFileCodec.indexOf(
          characters[index + 2] ?? "A",
        ) <<
          6) |
        BASE64_ALPHABETModelStoredFileCodec.indexOf(
          characters[index + 3] ?? "A",
        );
      bytes[outputOffset++] = (value >> 16) & 255;
      if (index + 2 < characters.length) {
        bytes[outputOffset++] = (value >> 8) & 255;
      }
      if (index + 3 < characters.length) {
        bytes[outputOffset++] = value & 255;
      }
    }
    return bytes.subarray(0, outputOffset);
  }
  function fileContentBytesModelStoredFileCodec(
    content: string,
    path: string,
  ): Uint8Array<ArrayBuffer> {
    let header = binaryDataUriHeader(content, path);
    if (header === null) {
      return storedFileEncoder.encode(content);
    }
    let payload = content.slice(header.payloadOffset);
    if (header.base64) {
      return decodeBase64Bytes(payload);
    }
    try {
      return storedFileEncoder.encode(decodeURIComponent(payload));
    } catch {
      return storedFileEncoder.encode(payload);
    }
  }
  function makeRemoteFileRecord(
    path: string,
    dataRef: string,
    metadata: Storage.RemoteFileMetadata,
  ): Storage.RemoteFileRecord {
    let record: Storage.RemoteFileRecord = {
      path: path,
      kind: storedFileKind(path),
      dataRef: dataRef,
      dataBytes: metadata.bytes ?? 0,
    };
    if (metadata.contentType !== undefined) {
      record.contentType = metadata.contentType;
    }
    if (metadata.sha256 !== undefined) {
      record.sha256 = metadata.sha256;
    }
    if (
      metadata.storedSha256 !== undefined &&
      metadata.storedSha256 !== metadata.sha256
    ) {
      record.storedSha256 = metadata.storedSha256;
    }
    if (metadata.name !== undefined) {
      record.name = metadata.name;
    }
    if (metadata.addedAt !== undefined) {
      record.addedAt = metadata.addedAt;
    }
    if (metadata.via !== undefined) {
      record.via = metadata.via;
    }
    return record;
  }
  function normalizeKnownUpload(
    known: Storage.KnownUploadInput,
  ): Storage.KnownUpload | null {
    let id =
      typeof known === "string"
        ? blobIdFromReference(known)
        : runtime.BLOB_ID_PATTERN.test(known.id)
          ? known.id
          : null;
    if (id === null || isPendingBlobId(id)) {
      return null;
    }
    if (typeof known === "string") {
      return {
        id: id,
      };
    } else {
      return {
        ...known,
        id: id,
      };
    }
  }
  function addConversionUpload(
    uploads: Storage.ConversionUpload[],
    path: string,
    mime: string,
    bytes: Uint8Array<ArrayBuffer>,
    sha2562?: string,
  ): void {
    let existing =
      sha2562 === undefined
        ? undefined
        : uploads.find(
            (input: Storage.ConversionUpload) =>
              input.sha256 === sha2562 && input.contentType === mime,
          );
    if (existing !== undefined) {
      if (!existing.paths.includes(path)) {
        existing.paths.push(path);
      }
      return;
    }
    uploads.push({
      path: path,
      docPath: rawDocumentPathForFile(path),
      paths: [path],
      kind: storedFileKind(path),
      contentType: mime!,
      bytes: bytes,
      byteLength: bytes.length,
      ...(sha2562 !== undefined
        ? {
            sha256: sha2562,
          }
        : {}),
    });
  }
  function makeStoredSystemMetadata(
    title: string,
    files: Model.FileTable,
    options: Pick<
      Storage.StoredSystemMetadata,
      "convertedFrom" | "snapshot"
    > = {},
  ): Storage.StoredSystemMetadata {
    let manifest = (0, runtime.parseManifest)(
        files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
      ),
      metadata: Storage.StoredSystemMetadata = {
        v: 1,
        title: title,
      },
      bundleMetadata = (0, runtime.parseManifestBundleMetadata)(manifest);
    if (bundleMetadata.namespace !== null) {
      metadata.namespace = bundleMetadata.namespace;
    }
    if (bundleMetadata.libraries !== null) {
      metadata.libraries = bundleMetadata.libraries;
    }
    let assetGroups = (0, runtime.serializeAssetGroupMetadata)(
      (0, runtime.parseAssetGroupMetadata)(manifest),
    );
    if (assetGroups.length > 0) {
      metadata.assetGroups = assetGroups;
    }
    let sections = (0, runtime.serializeSectionTitles)(
      (0, runtime.sectionTitlesFromManifest)(manifest),
    );
    if (sections !== undefined) {
      metadata.sections = sections;
    }
    let lastChange = (0, runtime.serializeLastChange)(
      (0, runtime.lastChangeFromManifest)(manifest),
    );
    if (lastChange !== undefined) {
      metadata.lastChange = lastChange;
    }
    if (options.convertedFrom !== undefined) {
      metadata.convertedFrom = options.convertedFrom;
    }
    if (options.snapshot !== undefined) {
      metadata.snapshot = options.snapshot;
    }
    return metadata;
  }
  function generatedReadmeTail(readme: string): string {
    let offset = (0, runtime.generatedReadmeTailOffset)(readme);
    if (offset < 0) {
      return "";
    } else {
      return readme.slice(
        offset === 0 ? 0 : offset + runtime.GENERATED_README_SEPARATOR.length,
      );
    }
  }
  function mergeReadmeWithGeneratedTail(
    readme: string,
    generatedTail: string,
  ): string {
    let authorReadme = (0, runtime.stripGeneratedReadmeTail)(readme);
    if (authorReadme === "") {
      return generatedTail;
    } else {
      if (generatedTail === "") {
        return authorReadme;
      } else {
        return (
          authorReadme + runtime.GENERATED_README_SEPARATOR + generatedTail
        );
      }
    }
  }
  bindRuntimeValue(
    runtime,
    "SYSTEM_COLLECTION",
    () => SYSTEM_COLLECTION,
    (value) => {
      SYSTEM_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "META_DOCUMENT_ID",
    () => META_DOCUMENT_ID,
    (value) => {
      META_DOCUMENT_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOKENS_DOCUMENT_ID",
    () => TOKENS_DOCUMENT_ID,
    (value) => {
      TOKENS_DOCUMENT_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SOURCE_DOCUMENT_ID",
    () => SOURCE_DOCUMENT_ID,
    (value) => {
      SOURCE_DOCUMENT_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UPGRADED_DOCUMENT_ID",
    () => UPGRADED_DOCUMENT_ID,
    (value) => {
      UPGRADED_DOCUMENT_ID = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYSTEM_META_DOCUMENT_PATH",
    () => SYSTEM_META_DOCUMENT_PATH,
    (value) => {
      SYSTEM_META_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYSTEM_TOKENS_DOCUMENT_PATH",
    () => SYSTEM_TOKENS_DOCUMENT_PATH,
    (value) => {
      SYSTEM_TOKENS_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYSTEM_SOURCE_DOCUMENT_PATH",
    () => SYSTEM_SOURCE_DOCUMENT_PATH,
    (value) => {
      SYSTEM_SOURCE_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYSTEM_UPGRADED_DOCUMENT_PATH",
    () => SYSTEM_UPGRADED_DOCUMENT_PATH,
    (value) => {
      SYSTEM_UPGRADED_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAW_TOKENS_DOCUMENT_PATH",
    () => RAW_TOKENS_DOCUMENT_PATH,
    (value) => {
      RAW_TOKENS_DOCUMENT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_COLLECTION",
    () => FILES_COLLECTION,
    (value) => {
      FILES_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "API_COLLECTION",
    () => API_COLLECTION,
    (value) => {
      API_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMPONENTS_COLLECTION",
    () => COMPONENTS_COLLECTION,
    (value) => {
      COMPONENTS_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEWS_COLLECTION",
    () => PREVIEWS_COLLECTION,
    (value) => {
      PREVIEWS_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSETS_COLLECTION",
    () => ASSETS_COLLECTION,
    (value) => {
      ASSETS_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONTS_COLLECTION",
    () => FONTS_COLLECTION,
    (value) => {
      FONTS_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_COLLECTIONS",
    () => DESIGN_SYSTEM_COLLECTIONS,
    (value) => {
      DESIGN_SYSTEM_COLLECTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SYNC_DOCUMENT_BYTES",
    () => MAX_SYNC_DOCUMENT_BYTES,
    (value) => {
      MAX_SYNC_DOCUMENT_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SYNC_DOCUMENT_DEPTH",
    () => MAX_SYNC_DOCUMENT_DEPTH,
    (value) => {
      MAX_SYNC_DOCUMENT_DEPTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILES_PER_COLLECTION",
    () => MAX_FILES_PER_COLLECTION,
    (value) => {
      MAX_FILES_PER_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SYNC_COLLECTION_BYTES",
    () => MAX_SYNC_COLLECTION_BYTES,
    (value) => {
      MAX_SYNC_COLLECTION_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_INLINE_DATA_URI_BUDGET_FRACTION",
    () => MAX_INLINE_DATA_URI_BUDGET_FRACTION,
    (value) => {
      MAX_INLINE_DATA_URI_BUDGET_FRACTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORED_CODE_MIME_TYPES",
    () => STORED_CODE_MIME_TYPES,
    (value) => {
      STORED_CODE_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STORED_TEXT_MIME_TYPES",
    () => STORED_TEXT_MIME_TYPES,
    (value) => {
      STORED_TEXT_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_CARRIED_FILES_METADATA",
    () => MAX_CARRIED_FILES_METADATA,
    (value) => {
      MAX_CARRIED_FILES_METADATA = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CARRIED_FILE_FORMS",
    () => CARRIED_FILE_FORMS,
    (value) => {
      CARRIED_FILE_FORMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "storedFileEncoder",
    () => storedFileEncoder,
    (value) => {
      storedFileEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SAFE_DOCUMENT_ID_CHARACTER_PATTERN",
    () => SAFE_DOCUMENT_ID_CHARACTER_PATTERN,
    (value) => {
      SAFE_DOCUMENT_ID_CHARACTER_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "hashDocumentId", () => hashDocumentId);
  bindRuntimeValue(runtime, "encodeDocumentId", () => encodeDocumentId);
  bindRuntimeValue(
    runtime,
    "DIRECT_PATH_COLLECTIONS",
    () => DIRECT_PATH_COLLECTIONS,
    (value) => {
      DIRECT_PATH_COLLECTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectionAndIdForFilePath",
    () => collectionAndIdForFilePath,
  );
  bindRuntimeValue(runtime, "documentPathForFile", () => documentPathForFile);
  bindRuntimeValue(
    runtime,
    "validatedFilePathForDocument",
    () => validatedFilePathForDocument,
  );
  bindRuntimeValue(runtime, "storedFileKind", () => storedFileKind);
  bindRuntimeValue(runtime, "storedContentType", () => storedContentType);
  bindRuntimeValue(runtime, "blobAbsoluteUrl", () => blobAbsoluteUrl);
  bindRuntimeValue(runtime, "blobIdFromReference", () => blobIdFromReference);
  bindRuntimeValue(
    runtime,
    "formatStoredFileKilobytes",
    () => formatStoredFileKilobytes,
    (value) => {
      formatStoredFileKilobytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "chooseStoredConversionRoute",
    () => chooseStoredConversionRoute,
  );
  bindRuntimeValue(
    runtime,
    "fileKindDescription",
    () => fileKindDescription,
    (value) => {
      fileKindDescription = value;
    },
  );
  bindRuntimeValue(runtime, "sniffDataUriKind", () => sniffDataUriKind);
  bindRuntimeValue(
    runtime,
    "parseJsonObjectOrNull",
    () => parseJsonObjectOrNull,
  );
  bindRuntimeValue(runtime, "binaryDataUriHeader", () => binaryDataUriHeader);
  bindRuntimeValue(
    runtime,
    "storedContentByteLength",
    () => storedContentByteLength,
  );
  bindRuntimeValue(
    runtime,
    "BASE64_ALPHABETModelStoredFileCodec",
    () => BASE64_ALPHABETModelStoredFileCodec,
    (value) => {
      BASE64_ALPHABETModelStoredFileCodec = value;
    },
  );
  bindRuntimeValue(runtime, "decodeBase64Bytes", () => decodeBase64Bytes);
  bindRuntimeValue(
    runtime,
    "fileContentBytesModelStoredFileCodec",
    () => fileContentBytesModelStoredFileCodec,
  );
  bindRuntimeValue(runtime, "makeRemoteFileRecord", () => makeRemoteFileRecord);
  bindRuntimeValue(runtime, "normalizeKnownUpload", () => normalizeKnownUpload);
  bindRuntimeValue(
    runtime,
    "storedPathBasename",
    () => storedPathBasename,
    (value) => {
      storedPathBasename = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rawDocumentPathForFile",
    () => rawDocumentPathForFile,
    (value) => {
      rawDocumentPathForFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPendingBlobId",
    () => isPendingBlobId,
    (value) => {
      isPendingBlobId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAILED_CONVERSION_UPLOAD_MESSAGE",
    () => FAILED_CONVERSION_UPLOAD_MESSAGE,
    (value) => {
      FAILED_CONVERSION_UPLOAD_MESSAGE = value;
    },
  );
  bindRuntimeValue(runtime, "addConversionUpload", () => addConversionUpload);
  bindRuntimeValue(
    runtime,
    "makeStoredSystemMetadata",
    () => makeStoredSystemMetadata,
  );
  bindRuntimeValue(runtime, "generatedReadmeTail", () => generatedReadmeTail);
  bindRuntimeValue(
    runtime,
    "mergeReadmeWithGeneratedTail",
    () => mergeReadmeWithGeneratedTail,
  );
  return () => {
    SYSTEM_COLLECTION = "ds";
    META_DOCUMENT_ID = "meta";
    TOKENS_DOCUMENT_ID = "tokens";
    SOURCE_DOCUMENT_ID = "source";
    UPGRADED_DOCUMENT_ID = "upgraded";
    SYSTEM_META_DOCUMENT_PATH = SYSTEM_COLLECTION + "/" + META_DOCUMENT_ID;
    SYSTEM_TOKENS_DOCUMENT_PATH = SYSTEM_COLLECTION + "/" + TOKENS_DOCUMENT_ID;
    SYSTEM_SOURCE_DOCUMENT_PATH = SYSTEM_COLLECTION + "/" + SOURCE_DOCUMENT_ID;
    SYSTEM_UPGRADED_DOCUMENT_PATH =
      SYSTEM_COLLECTION + "/" + UPGRADED_DOCUMENT_ID;
    RAW_TOKENS_DOCUMENT_PATH = "files/tokens.json";
    FILES_COLLECTION = "files";
    API_COLLECTION = "api";
    COMPONENTS_COLLECTION = "components";
    PREVIEWS_COLLECTION = "previews";
    ASSETS_COLLECTION = "assets";
    FONTS_COLLECTION = "fonts";
    DESIGN_SYSTEM_COLLECTIONS = [
      SYSTEM_COLLECTION,
      FONTS_COLLECTION,
      FILES_COLLECTION,
      ASSETS_COLLECTION,
      COMPONENTS_COLLECTION,
      PREVIEWS_COLLECTION,
      API_COLLECTION,
    ];
    MAX_SYNC_DOCUMENT_BYTES = 245760;
    MAX_SYNC_DOCUMENT_DEPTH = 30;
    MAX_FILES_PER_COLLECTION = 1000;
    MAX_SYNC_COLLECTION_BYTES = 2097152;
    MAX_INLINE_DATA_URI_BUDGET_FRACTION = 0.25;
    STORED_CODE_MIME_TYPES = {
      js: "text/javascript",
      mjs: "text/javascript",
      cjs: "text/javascript",
      css: "text/css",
      jsx: "text/plain",
      ts: "text/plain",
      tsx: "text/plain",
      "d.ts": "text/plain",
    };
    STORED_TEXT_MIME_TYPES = {
      md: "text/markdown",
      mdx: "text/markdown",
      markdown: "text/markdown",
      json: "application/json",
      csv: "text/csv",
    };
    MAX_CARRIED_FILES_METADATA = 200;
    CARRIED_FILE_FORMS = [
      "text-doc",
      "blob",
      "data-uri",
      "omitted",
      "not-in-snapshot",
    ];
    storedFileEncoder = new TextEncoder();
    SAFE_DOCUMENT_ID_CHARACTER_PATTERN = /[A-Za-z0-9_.-]/;
    DIRECT_PATH_COLLECTIONS = [
      COMPONENTS_COLLECTION,
      ASSETS_COLLECTION,
      FONTS_COLLECTION,
      API_COLLECTION,
    ];
    formatStoredFileKilobytes = (input: number): string =>
      String(Math.round(input / 1024)) + " KB";
    fileKindDescription = (input: string): string =>
      (0, runtime.fileExtension)(input) === ""
        ? "files of this kind"
        : "." + (0, runtime.fileExtension)(input) + " files";
    BASE64_ALPHABETModelStoredFileCodec =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    storedPathBasename = (input: string) =>
      input.slice(input.lastIndexOf("/") + 1);
    rawDocumentPathForFile = (input: string) =>
      input === runtime.DESIGN_SYSTEM_PATHS.tokens
        ? RAW_TOKENS_DOCUMENT_PATH
        : documentPathForFile(input);
    isPendingBlobId = (input: string) => input.startsWith("pending-");
    FAILED_CONVERSION_UPLOAD_MESSAGE =
      "the store did not accept its upload, so it was left out";
  };
}

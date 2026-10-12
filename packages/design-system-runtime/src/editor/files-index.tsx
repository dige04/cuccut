/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  FileStoragePolicy,
  MergeSchema,
  DataUrlSignature,
  FilePublishRejection,
  StoredIndexMetadata,
  RestoredIndexedFiles,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installEditorFilesIndex(runtime: RuntimeBindings): () => void {
  var reactFontFaces: typeof import("react");
  var FILES_INDEX_PROJECT_PATH: string;
  var FILES_INDEX_NAME: string;
  var FILES_INDEX_PATH: string;
  var RESERVED_MIGRATION_FILE_NAMES: string[];
  var PROJECT_FILE_PREFIXEditorFilesIndex: string;
  var FILES_INDEX_VERSION: number;
  var projectFilePath: (path: string) => string;
  var relativeProjectFilePath: (path: string) => string | undefined;
  var DEFAULT_FILE_STORAGE_POLICY: FileStoragePolicy;
  var fileIndexEncoder: TextEncoder;
  var fileIndexDecoder: TextDecoder;
  var FILE_INDEX_KEY_SAFE_CHARACTER: RegExp;
  var isSafeFileIndexKey: (key: string) => boolean;
  var CONVERTED_FROM_FIELD: string;
  var CREATED_ON_FILES_FIELD: string;
  var createEmptyFilesIndex: () => Files.FilesIndex;
  var FILES_INDEX_MERGE_SCHEMA: MergeSchema;
  var isFilesIndexObject: (value: unknown) => value is Record<string, unknown>;
  var TREE_INDEX_FIELD: string;
  var PUBLISHABLE_MIME_TYPES: Set<string>;
  var TEXT_MIME_TYPES: Set<string>;
  var isTextMimeType: (mime: string) => boolean;
  var SVG_XML_DECLARATION_PATTERN: RegExp;
  var SVG_DOCTYPE_PATTERN: RegExp;
  var SVG_ATTRIBUTE_PATTERN: RegExp;
  var RESERVED_XML_NAMESPACES: string[];
  var isXmlWhitespace: (character: string | undefined) => boolean;
  var asciiCharacterCodes: (text: string) => number[];
  var bytesMatchAt: (
    bytes: Uint8Array<ArrayBufferLike>,
    offset: number,
    signature: readonly number[],
  ) => boolean;
  var unpublishableFileReason: (
    path: string,
    contents: string | undefined,
  ) => string | null;
  function classifyFileStorage(
    path: string,
    contents: string,
    policy: FileStoragePolicy = DEFAULT_FILE_STORAGE_POLICY,
  ): Files.FileStorageClassification {
    if (path === runtime.DESIGN_SYSTEM_PATHS.manifest) {
      return {
        to: "derived",
      };
    }
    let record = (0, runtime.storagePointerForFile)(path, contents),
      desiredStorage =
        (0, runtime.isTextFilePath)(path) &&
        (0, runtime.classifyDesignSystemFile)(path) === "asset" &&
        record === null
          ? "file"
          : policy[(0, runtime.classifyDesignSystemFile)(path)];
    if (record !== null && record.store === "blob") {
      return {
        to: "record",
        id: record.id,
        owed: desiredStorage === "file",
      };
    }
    if (record !== null) {
      return {
        to: "derived",
      };
    }
    return {
      to: "file",
      owed: desiredStorage === "blob",
    };
  }
  function blobFilesOwedToFileStorage(
    files: Files.FileTable,
    policy: FileStoragePolicy = DEFAULT_FILE_STORAGE_POLICY,
  ) {
    let owedFiles: {
      path: string;
      id: string;
    }[] = [];
    for (let value of Object.keys(files).sort()) {
      let value2 = classifyFileStorage(value, files[value], policy);
      if (value2.to === "record" && value2.owed) {
        owedFiles.push({
          path: value,
          id: value2.id,
        });
      }
    }
    return owedFiles;
  }
  function encodeFileIndexKey(key: string): string {
    let encodedKey = "";
    for (let value of fileIndexEncoder.encode(key)) {
      let value2 = String.fromCharCode(value);
      encodedKey +=
        value < 128 && FILE_INDEX_KEY_SAFE_CHARACTER.test(value2)
          ? value2
          : "~" + value.toString(16).padStart(2, "0");
    }
    return encodedKey;
  }
  function decodeFileIndexKey(key: string): string {
    let bytes: number[] = [];
    for (let index = 0; index < key.length; index++) {
      let value =
        key[index] === "~"
          ? /^[0-9a-f]{2}/.exec(key.slice(index + 1, index + 3))
          : null;
      if (value !== null) {
        bytes.push(parseInt(value[0], 16));
        index += 2;
      } else {
        for (let value2 of fileIndexEncoder.encode(key[index])) {
          bytes.push(value2);
        }
      }
    }
    return fileIndexDecoder.decode(new Uint8Array(bytes));
  }
  function isFilesIndex(value: unknown): value is Files.FilesIndex {
    return (
      isFilesIndexObject(value) &&
      !isFilesIndexObject(value.content) &&
      (hasFilesMigrationMarker(value) ||
        (typeof value.v === "number" &&
          value.v >= FILES_INDEX_VERSION &&
          value.layout === "files"))
    );
  }
  function hasFilesMigrationMarker(value: unknown) {
    return (
      isFilesIndexObject(value) &&
      (isFilesIndexObject(value[CONVERTED_FROM_FIELD]) ||
        isFilesIndexObject(value[CREATED_ON_FILES_FIELD]))
    );
  }
  function parseFilesIndex(text: string): Files.FilesIndex | null {
    try {
      let value: unknown = JSON.parse(text);
      if (isFilesIndex(value)) {
        return value;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function readTreeIndex(
    value: Record<string, unknown>,
  ): Files.FilesIndex | undefined {
    let index = value[TREE_INDEX_FIELD];
    if (isFilesIndex(index)) {
      return index;
    } else {
      return undefined;
    }
  }
  function hasValidSvgRoot(text: string, offset: number) {
    if (!text.startsWith("<svg", offset)) {
      return false;
    }
    let attributes: Set<string> = new Set(),
      namespacePrefixes: Set<string> = new Set(),
      namespaceUris: Set<string> = new Set(),
      usedPrefixes: string[] = [];
    for (let value = offset + 4; value - offset < 60000; ) {
      let value2 = isXmlWhitespace(text[value]);
      while (isXmlWhitespace(text[value])) {
        value++;
      }
      if (
        text[value] === ">" ||
        (text[value] === "/" && text[value + 1] === ">")
      ) {
        return usedPrefixes.every((input) => namespacePrefixes.has(input));
      }
      SVG_ATTRIBUTE_PATTERN.lastIndex = value;
      let value3 = value2 ? SVG_ATTRIBUTE_PATTERN.exec(text) : null;
      if (value3 === null) {
        return false;
      }
      let value4 = value3[1] ?? "",
        value5 = value3[2],
        value6 = value3[3] ?? value3[4] ?? "",
        value7 = value5 === undefined ? value4 : value4 + ":" + value5;
      if (attributes.has(value7)) {
        return false;
      }
      attributes.add(value7);
      if (value4 === "xmlns") {
        if (
          /[ \t\r\n]/.test(value6) ||
          RESERVED_XML_NAMESPACES.includes(value6) ||
          (value6 !== "" && !/[:/]/.test(value6))
        ) {
          return false;
        }
        if (
          value5 !== undefined &&
          (value6 === "" ||
            value5 === "xml" ||
            value5 === "xmlns" ||
            namespaceUris.has(value6))
        ) {
          return false;
        }
        if (value5 !== undefined) {
          namespacePrefixes.add(value5);
          namespaceUris.add(value6);
        }
      } else if (value5 !== undefined && value4 !== "xml") {
        usedPrefixes.push(value4);
      }
      value += value3[0].length;
    }
    return false;
  }
  function isPublishableSvgText(text: string): boolean {
    if (
      text === "" ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd-\uffff]/.test(text) ||
      /\p{Cs}/u.test(text)
    ) {
      return false;
    }
    let offset = text.startsWith("\uFEFF") ? 1 : 0;
    if (text.startsWith("ftyp", 4) || text.startsWith("ftyp", offset + 4)) {
      return false;
    }
    if (text.startsWith("<?xml", offset)) {
      SVG_XML_DECLARATION_PATTERN.lastIndex = offset;
      let value = SVG_XML_DECLARATION_PATTERN.exec(text);
      if (value === null) {
        return false;
      }
      offset += value[0].length;
    }
    for (let flag: boolean = false; ; ) {
      while (isXmlWhitespace(text[offset])) {
        offset++;
      }
      if (offset >= 200000) {
        return false;
      }
      if (text.startsWith("<\!--", offset)) {
        let value = text.indexOf("-->", offset + 4),
          value2 =
            value < 0 || value > 200000 ? "--" : text.slice(offset + 4, value);
        if (
          value2.includes("--") ||
          value2.endsWith("-") ||
          value2.includes("<![")
        ) {
          return false;
        }
        offset = value + 3;
      } else if (text.startsWith("<!DOCTYPE", offset)) {
        SVG_DOCTYPE_PATTERN.lastIndex = offset;
        let value = SVG_DOCTYPE_PATTERN.exec(text);
        if (flag || value === null || value[0].includes("ENTITY")) {
          return false;
        }
        flag = true;
        offset += value[0].length;
      } else {
        return hasValidSvgRoot(text, offset);
      }
    }
  }
  function detectNonCodeText(text: string): undefined | string {
    if (text === "") {
      return;
    }
    let hasBom: boolean = text.charCodeAt(0) === 65279,
      offset: number = hasBom ? 1 : 0;
    if (text.startsWith("\x00<\x00?", offset)) {
      return "markup";
    }
    while (
      offset < text.length &&
      ` 	
\f\r`.includes(text[offset])
    ) {
      offset++;
    }
    if (text[offset] === "<") {
      return "markup";
    }
    let prefixBytes = fileIndexEncoder
        .encode(text.slice(0, 512))
        .subarray(0, 512),
      prefixText = String.fromCharCode(...prefixBytes.subarray(0, 16));
    if (/^[\s\S]{4}ftyp[\s\S]{4}/.test(prefixText)) {
      return "signature";
    }
    if (hasBom) {
      return;
    }
    if (
      /^(?:%PDF-|%!PS-Adobe-|BM|GIF8[79]a|ID3|OTTO|ttcf|wOFF|wOF2|FORM[\s\S]{4}AIFF|RIFF[\s\S]{4}(?:AVI |WAVE|WEBP))/.test(
        prefixText,
      ) ||
      (prefixBytes.length >= 36 &&
        prefixBytes[34] === 76 &&
        prefixBytes[35] === 80)
    ) {
      return "signature";
    }
    if (
      prefixBytes.some(
        (input) =>
          input <= 8 ||
          input === 11 ||
          (input >= 14 && input <= 26) ||
          (input >= 28 && input <= 31),
      )
    ) {
      return "binary";
    } else {
      return undefined;
    }
  }
  function publishableFileMimeType(
    path: string,
    contents?: string,
  ): string | null {
    let extension = (0, runtime.fileExtension)(path);
    if (extension === "lottie") {
      if (contents === undefined) {
        return null;
      } else {
        return lottieDataUrlMimeType(contents);
      }
    }
    let archiveMimeType =
      contents !== undefined &&
      Object.hasOwn(runtime.HELD_BINARY_MIME_TYPES, extension)
        ? archiveFileMimeType(path, contents)
        : null;
    if (archiveMimeType !== null) {
      return archiveMimeType;
    }
    let mimeType =
      extension === "svg" &&
      contents !== undefined &&
      isPublishableSvgText(contents)
        ? "image/svg+xml"
        : extension === "js" || extension === "mjs"
          ? "text/javascript"
          : ((0, runtime.mirrorMimeTypeForPath)(path) ??
            ((0, runtime.isTextFilePath)(path)
              ? "text/plain"
              : (0, runtime.mimeTypeForPath)(path)));
    if (
      (mimeType === "text/css" || mimeType === "text/javascript") &&
      contents !== undefined &&
      detectNonCodeText(contents) !== undefined
    ) {
      return "text/plain";
    }
    if (typeof mimeType === "string" && PUBLISHABLE_MIME_TYPES.has(mimeType)) {
      return mimeType;
    }
    if (contents !== undefined && isCleanUtf8DataUrl(contents)) {
      return "text/plain";
    } else {
      return null;
    }
  }
  function decodeFileDataUrl(dataUrl: string): Uint8Array<ArrayBuffer> | null {
    let metadata = (0, runtime.parseDataUriHeader)(dataUrl);
    if (metadata === null) {
      return null;
    }
    try {
      let value = dataUrl.slice(metadata.payloadOffset);
      if (!metadata.base64) {
        return new TextEncoder().encode(decodeURIComponent(value));
      }
      let value2 = atob(value),
        value3 = new Uint8Array(value2.length);
      for (let index: number = 0; index < value2.length; index++) {
        value3[index] = value2.charCodeAt(index);
      }
      return value3;
    } catch {
      return null;
    }
  }
  function decodeCleanUtf8(bytes: Uint8Array<ArrayBufferLike>): string | null {
    try {
      let value = new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes);
      if (
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
        hasDamagedUnicode(value)
      ) {
        return null;
      } else {
        return value;
      }
    } catch {
      return null;
    }
  }
  function isCleanUtf8DataUrl(dataUrl: string) {
    let bytes = decodeFileDataUrl(dataUrl);
    return bytes !== null && decodeCleanUtf8(bytes) !== null;
  }
  function lottieDataUrlMimeType(dataUrl: string): null | string {
    let bytes = decodeFileDataUrl(dataUrl);
    if (bytes === null) {
      return null;
    }
    if (
      bytes.length >= 4 &&
      bytes[0] === 80 &&
      bytes[1] === 75 &&
      bytes[2] === 3 &&
      bytes[3] === 4
    ) {
      return "application/zip+dotlottie";
    }
    if (decodeCleanUtf8(bytes)?.trimStart().startsWith("{") === true) {
      return "application/json";
    } else {
      return null;
    }
  }
  function archiveFileMimeType(path: string, dataUrl: string) {
    let signature = readDataUrlSignature(dataUrl);
    if (signature === null) {
      return null;
    }
    if (
      !bytesMatchAt(signature.head, 0, [80, 75, 3, 4]) &&
      !(
        (0, runtime.fileExtension)(path) === "fig" &&
        bytesMatchAt(signature.head, 0, asciiCharacterCodes("fig-"))
      )
    ) {
      return null;
    }
    if (
      signature.length >= 12 &&
      bytesMatchAt(signature.head, 4, asciiCharacterCodes("ftyp"))
    ) {
      return null;
    }
    let isVirtualDiskFooter = (input: number) =>
      bytesMatchAt(signature.tail, input, asciiCharacterCodes("conectix")) &&
      bytesMatchAt(signature.tail, input + 12, [0, 1, 0, 0]);
    if (
      signature.length >= 512 &&
      (bytesMatchAt(signature.tail, 0, [
        ...asciiCharacterCodes("koly"),
        0,
        0,
        0,
        4,
        0,
        0,
        2,
        0,
      ]) ||
        isVirtualDiskFooter(0) ||
        isVirtualDiskFooter(1))
    ) {
      return null;
    }
    return runtime.HELD_BINARY_MIME_TYPES[(0, runtime.fileExtension)(path)];
  }
  function readDataUrlSignature(dataUrl: string): DataUrlSignature | null {
    let metadata = (0, runtime.parseDataUriHeader)(dataUrl),
      payload = metadata === null ? "" : dataUrl.slice(metadata.payloadOffset),
      readFullSignature = () => {
        let value = decodeFileDataUrl(dataUrl);
        if (value === null) {
          return null;
        } else {
          return {
            head: value.subarray(0, 12),
            tail: value.subarray(Math.max(0, value.length - 512)),
            length: value.length,
          };
        }
      };
    if (
      metadata === null ||
      !metadata.base64 ||
      payload.length < 720 ||
      payload.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)
    ) {
      return readFullSignature();
    }
    let decodeBase64Bytes2 = (input: string) =>
        Uint8Array.from(atob(input), (input2) => input2.charCodeAt(0)),
      decodedTail = decodeBase64Bytes2(payload.slice(-688));
    return {
      head: decodeBase64Bytes2(payload.slice(0, 16)),
      tail: decodedTail.subarray(decodedTail.length - 512),
      length:
        (payload.length / 4) * 3 -
        (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0),
    };
  }
  function hasDamagedUnicode(text: string) {
    return (
      text.includes(String.fromCharCode(65533)) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
        text,
      )
    );
  }
  function explainUnpublishableFile(
    path: string,
    contents: string | undefined,
  ): FilePublishRejection | null {
    if (hasDamagedUnicode(path)) {
      return {
        why: "this name contains a damaged character; rename the file",
        cause: "name",
      };
    }
    if (publishableFileMimeType(path, contents) === null) {
      if (
        contents === undefined ||
        !Object.hasOwn(
          runtime.HELD_BINARY_MIME_TYPES,
          (0, runtime.fileExtension)(path),
        )
      ) {
        return {
          why: "this kind of file cannot be published with the design system; it was left out (convert it, or keep it elsewhere)",
          cause: "kind",
        };
      }
      if (decodeFileDataUrl(contents) === null) {
        return {
          why: "its contents could not be read; add the file again",
          cause: "unreadable",
        };
      }
      return {
        why:
          "it does not look like a ." +
          (0, runtime.fileExtension)(path) +
          " file inside (it may be damaged, password-protected or another format renamed). Replace it with a fresh copy, or remove it",
        cause: "kind",
      };
    }
    if (
      contents !== undefined &&
      (0, runtime.isTextFilePath)(path) &&
      hasDamagedUnicode(contents)
    ) {
      return {
        why: "it contains a damaged character (one that was not valid text when the file was saved); fix the text and try again",
        cause: "damaged_text",
      };
    }
    if (
      !(0, runtime.isPublishableFilePathModelFileTable)(projectFilePath(path))
    ) {
      return {
        why: "this name cannot be published: it contains one of % ; : ? # or a backslash, ends in .cmekshadow, or is too long; rename the file",
        cause: "name",
      };
    }
    return null;
  }
  function isProjectContentPath(path: string) {
    let relativePath = relativeProjectFilePath(path);
    if (
      relativePath === undefined ||
      !(0, runtime.isValidDesignSystemPath)(relativePath) ||
      (0, runtime.normalizeDesignSystemPath)(relativePath) !== relativePath
    ) {
      return false;
    }
    if (
      relativePath === runtime.DESIGN_SYSTEM_PATHS.manifest ||
      (0, runtime.isGeneratedSystemPath)(relativePath) ||
      RESERVED_MIGRATION_FILE_NAMES.includes(relativePath)
    ) {
      return false;
    }
    return (
      (0, runtime.explainReservedSystemPath)(relativePath) === null &&
      (0, runtime.explainGeneratedOrRetiredPath)(relativePath) === null
    );
  }
  function isDerivedProjectPath(path: string) {
    let relativePath = relativeProjectFilePath(path);
    return (
      relativePath !== undefined &&
      (0, runtime.isValidDesignSystemPath)(relativePath) &&
      (0, runtime.normalizeDesignSystemPath)(relativePath) === relativePath &&
      (relativePath === runtime.DESIGN_SYSTEM_PATHS.manifest ||
        (0, runtime.isGeneratedSystemPath)(relativePath))
    );
  }
  function validDerivedProjectFiles(files: Files.FileTable) {
    let derived = derivedProjectFiles(files);
    for (let [value, value2] of derived) {
      if (hasDamagedUnicode(value2)) {
        derived.delete(value);
      }
    }
    return derived;
  }
  function damagedDerivedProjectPaths(files: Files.FileTable) {
    let damagedPaths = [...derivedProjectFiles(files)]
      .filter(([, input]: [string, string]) => hasDamagedUnicode(input))
      .map(([input]: [string, string]) => input);
    if (
      Object.hasOwn(files, runtime.DESIGN_SYSTEM_PATHS.tokens) &&
      (0, runtime.generatedTokensCssForFiles)(files) === null
    ) {
      damagedPaths.push(projectFilePath(runtime.GENERATED_TOKENS_CSS_PATH));
    }
    return damagedPaths;
  }
  function projectFilesForSave(files: Files.FileTable) {
    let projectFiles = publishableProjectFiles(files);
    for (let value of Object.keys(files)) {
      let value2 = files[value];
      if (
        (isRepairableDamagedText(value, value2) ||
          isUnsupportedBinaryFile(value, value2)) &&
        classifyFileStorage(value, value2).to === "file" &&
        isProjectContentPath(projectFilePath(value))
      ) {
        projectFiles.set(projectFilePath(value), value2);
      } else if (
        (0, runtime.isHeldFilePointer)(value, value2) &&
        isProjectContentPath(projectFilePath(value)) &&
        !hasDamagedUnicode(value) &&
        (0, runtime.isPublishableFilePathModelFileTable)(projectFilePath(value))
      ) {
        projectFiles.set(projectFilePath(value), value2);
      }
    }
    return projectFiles;
  }
  function isUnsupportedBinaryFile(path: string, contents: string) {
    return (
      !(0, runtime.isTextFilePath)(path) &&
      !hasDamagedUnicode(path) &&
      (0, runtime.isPublishableFilePathModelFileTable)(projectFilePath(path)) &&
      publishableFileMimeType(path, contents) === null &&
      decodeFileDataUrl(contents) !== null
    );
  }
  function isRepairableDamagedText(path: string, contents: string) {
    return (
      (0, runtime.isTextFilePath)(path) &&
      hasDamagedUnicode(contents) &&
      unpublishableFileReason(
        path,
        contents
          .split(String.fromCharCode(65533))
          .join("")
          .replace(
            /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
            "",
          ),
      ) === null
    );
  }
  function derivedProjectFiles(files: Files.FileTable) {
    let projectFiles: Map<string, string> = new Map(),
      tokensCss =
        (0, runtime.generatedTokensCssForFiles)(files)?.replaceAll(
          'url("' + (0, runtime.blobRelativeUrlModelFilePolicy)(""),
          'url("../' + (0, runtime.blobRelativeUrlModelFilePolicy)(""),
        ) ?? null;
    if (tokensCss !== null) {
      projectFiles.set(
        projectFilePath(runtime.GENERATED_TOKENS_CSS_PATH),
        tokensCss,
      );
    }
    for (let [value, value2] of (0, runtime.consumptionDocumentationForFiles)(
      files,
      PROJECT_FILE_PREFIXEditorFilesIndex,
    ).files) {
      if (isDerivedProjectPath(projectFilePath(value))) {
        projectFiles.set(projectFilePath(value), value2);
      }
    }
    let manifest = files[runtime.DESIGN_SYSTEM_PATHS.manifest];
    if (typeof manifest === "string" && manifest !== "") {
      projectFiles.set(
        projectFilePath(runtime.DESIGN_SYSTEM_PATHS.manifest),
        manifest,
      );
    }
    return projectFiles;
  }
  function blobRecordForIndex(name: string, record: Files.StorageRecord) {
    if (record.store !== "blob" || record.id === undefined) {
      return null;
    }
    return {
      name: name,
      blob: record.id,
      size: record.bytes,
      type: record.type,
      ...(record.sha256 !== undefined
        ? {
            sha256: record.sha256,
          }
        : {}),
      ...(record.storedSha256 !== undefined
        ? {
            storedSha256: record.storedSha256,
          }
        : {}),
    };
  }
  function assetPathGroup(path: string) {
    if (!path.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)) {
      return null;
    }
    let relativePath = path.slice(runtime.DESIGN_SYSTEM_PATHS.assetsDir.length),
      separator = relativePath.indexOf("/");
    if (separator <= 0) {
      return null;
    }
    let group = relativePath.slice(0, separator);
    if ((0, runtime.isAssetGroupName)(group)) {
      return {
        group: group,
        rel: relativePath.slice(separator + 1),
      };
    } else {
      return null;
    }
  }
  function assetFileIndexAddress(path: string) {
    let address = assetPathGroup(path),
      key = encodeFileIndexKey(address !== null ? address.rel : path);
    if (!isSafeFileIndexKey(key)) {
      return null;
    }
    if (address === null) {
      return {
        group: null,
        key: key,
      };
    }
    let groupKey = encodeFileIndexKey(address.group);
    if (isSafeFileIndexKey(groupKey)) {
      return {
        group: groupKey,
        key: key,
      };
    } else {
      return null;
    }
  }
  function buildFilesIndex(
    title: string,
    files: Files.FileTable,
    previousIndex: Files.FilesIndex = createEmptyFilesIndex(),
  ) {
    let manifest: StoredIndexMetadata = (0, runtime.makeStoredSystemMetadata)(
        title,
        files,
      ) as unknown as StoredIndexMetadata,
      storage = (0, runtime.reconcileStorageCatalog)(
        files,
        (0, runtime.storageCatalogFromManifest)(
          files[runtime.DESIGN_SYSTEM_PATHS.manifest] ?? "",
        ),
      ),
      assetGroups: Record<string, Files.FilesIndexAssetGroup> = {},
      groupOrder: string[] = [],
      ensureGroup = (input: string) => {
        let value = encodeFileIndexKey(input);
        if (!isSafeFileIndexKey(value)) {
          return null;
        }
        if (!Object.hasOwn(assetGroups, value)) {
          assetGroups[value] = {
            name: input,
            order: [],
            files: {},
          };
        }
        return assetGroups[value];
      };
    for (let value of manifest.assetGroups ?? []) {
      let value2 = ensureGroup(value.name);
      if (value2 === null) {
        continue;
      }
      if (!groupOrder.includes(encodeFileIndexKey(value.name))) {
        groupOrder.push(encodeFileIndexKey(value.name));
      }
      if (
        value.tile !== undefined &&
        (0, runtime.isAssetTileSize)(value.tile)
      ) {
        value2.tile = value.tile as Files.AssetTileSize;
      }
      if (value.order !== undefined) {
        value2.order = [...value.order];
      }
    }
    let blobs: Record<string, Files.IndexBlobRecord> = {};
    for (let value of Object.keys(storage.files).sort()) {
      if (classifyFileStorage(value, files[value] ?? "").to !== "record") {
        continue;
      }
      let value2 = assetPathGroup(value),
        value3 = blobRecordForIndex(
          value2 !== null ? value2.rel : value,
          storage.files[value],
        );
      if (value3 === null) {
        continue;
      }
      let value4 = value2 !== null ? ensureGroup(value2.group) : null,
        value5 = encodeFileIndexKey(value3.name);
      if (!isSafeFileIndexKey(value5)) {
        continue;
      }
      if (value4 !== null) {
        value4.files[value5] = value3;
      } else {
        blobs[value5] = value3;
      }
    }
    let sections: Record<string, string> = {};
    for (let [value, value2] of Object.entries(manifest.sections ?? {})) {
      if (isSafeFileIndexKey(encodeFileIndexKey(value))) {
        sections[encodeFileIndexKey(value)] = value2;
      }
    }
    let docs = Object.keys(files)
        .filter(
          (input) =>
            (0, runtime.isAdditionalMarkdownPath)(input) &&
            classifyFileStorage(input, files[input]).to === "file" &&
            isProjectContentPath(projectFilePath(input)) &&
            unpublishableFileReason(input, files[input]) === null,
        )
        .sort(),
      index: Files.FilesIndex = {
        ...previousIndex,
        v: FILES_INDEX_VERSION,
        layout: "files",
        title: title,
        libraries: manifest.libraries ?? [],
        sections: sections,
        groups: groupOrder,
        assetGroups: assetGroups,
        blobs: blobs,
        docs: {
          ...(Object.hasOwn(files, runtime.DESIGN_SYSTEM_PATHS.readme) &&
          unpublishableFileReason(
            runtime.DESIGN_SYSTEM_PATHS.readme,
            files[runtime.DESIGN_SYSTEM_PATHS.readme],
          ) === null
            ? {
                readme: projectFilePath(runtime.DESIGN_SYSTEM_PATHS.readme),
              }
            : {}),
          sections: docs.map(projectFilePath),
        },
      };
    if (manifest.namespace !== undefined) {
      index.namespace = manifest.namespace;
    } else {
      delete index.namespace;
    }
    return index;
  }
  function publishableProjectFiles(files: Files.FileTable) {
    let projectFiles: Map<string, string> = new Map();
    for (let value of Object.keys(files)) {
      let value2 = files[value];
      if (
        classifyFileStorage(value, value2).to !== "file" ||
        !isProjectContentPath(projectFilePath(value)) ||
        unpublishableFileReason(value, value2) !== null
      ) {
        continue;
      }
      if (
        !(0, runtime.isTextFilePath)(value) &&
        decodeFileDataUrl(value2) === null
      ) {
        continue;
      }
      projectFiles.set(projectFilePath(value), value2);
    }
    return projectFiles;
  }
  function filesLeftOutOfMigration(files: Files.FileTable) {
    let leftOut = [];
    for (let value of Object.keys(files).sort()) {
      let value2 = files[value],
        value3 = classifyFileStorage(value, value2);
      if (
        value3.to === "derived" &&
        value !== runtime.DESIGN_SYSTEM_PATHS.manifest
      ) {
        leftOut.push({
          path: value,
          reason:
            "it only points at a file kept somewhere else, and that file is not here; add the file itself",
        });
        continue;
      }
      if (
        value3.to === "file" &&
        RESERVED_MIGRATION_FILE_NAMES.includes(value)
      ) {
        leftOut.push({
          path: value,
          reason:
            "this name is used by the page itself; rename this one to bring it over",
        });
        continue;
      }
      if (
        value3.to !== "file" ||
        !isProjectContentPath(projectFilePath(value))
      ) {
        continue;
      }
      let value4 =
        unpublishableFileReason(value, value2) ??
        (!(0, runtime.isTextFilePath)(value) &&
        decodeFileDataUrl(value2) === null
          ? "its contents could not be read; add the file again"
          : null);
      if (value4 !== null) {
        leftOut.push({
          path: value,
          reason: value4,
        });
      }
    }
    return leftOut;
  }
  function parseIndexBlobRecord(value: unknown) {
    if (
      !isFilesIndexObject(value) ||
      typeof value.name !== "string" ||
      typeof value.blob !== "string" ||
      value.blob === ""
    ) {
      return null;
    }
    let record: Files.StorageRecord & {
      store: "blob";
      id: string;
    } = {
      store: "blob",
      id: value.blob,
      bytes:
        typeof value.size === "number" && value.size >= 0
          ? Math.floor(value.size)
          : 0,
      type: typeof value.type === "string" ? value.type : "",
    };
    if (typeof value.sha256 === "string") {
      record.sha256 = value.sha256;
    }
    if (typeof value.storedSha256 === "string") {
      record.storedSha256 = value.storedSha256;
    }
    return {
      name: value.name,
      rec: record,
    };
  }
  function restoreFilesFromIndex(
    index: Files.FilesIndex,
    projectFiles: ReadonlyMap<string, string>,
  ): RestoredIndexedFiles {
    let files: Record<string, string> = {};
    for (let [value, value2] of projectFiles) {
      if (!isProjectContentPath(value)) {
        continue;
      }
      files[relativeProjectFilePath(value)!] = value2;
    }
    let storageRecords: Record<string, Files.StorageRecord> = {},
      appendBlobFile = (input: string, options: Files.StorageRecord): void => {
        if (
          !(0, runtime.isValidDesignSystemPath)(input) ||
          Object.hasOwn(files, input)
        ) {
          return;
        }
        if (options.type === "") {
          options.type = (0, runtime.mimeTypeForPath)(input);
        }
        let value = (0, runtime.blobPointer)(options.id!);
        if ((0, runtime.storagePointerForFile)(input, value) === null) {
          return;
        }
        files[input] = value;
        storageRecords[input] = options;
      },
      assetGroups: {
        name: string;
        tile?: Files.AssetTileSize;
        order?: string[];
      }[] = [],
      indexAssetGroups: Record<string, Files.FilesIndexAssetGroup> =
        isFilesIndexObject(index.assetGroups) ? index.assetGroups : {},
      groupOrder = [
        ...(Array.isArray(index.groups)
          ? index.groups.filter((input): boolean => typeof input === "string")
          : []),
        ...Object.keys(indexAssetGroups).sort(),
      ],
      seenGroups: Set<string> = new Set();
    for (let value of groupOrder) {
      let value2 = indexAssetGroups[value];
      if (seenGroups.has(value) || !isFilesIndexObject(value2)) {
        continue;
      }
      seenGroups.add(value);
      let value3 =
        typeof value2.name === "string"
          ? value2.name
          : decodeFileIndexKey(value);
      if (!(0, runtime.isAssetGroupName)(value3)) {
        continue;
      }
      let value4 = Array.isArray(value2.order)
        ? value2.order.filter((input): boolean => typeof input === "string")
        : [];
      assetGroups.push({
        name: value3,
        ...((0, runtime.isAssetTileSize)(value2.tile)
          ? {
              tile: value2.tile,
            }
          : {}),
        ...(value4.length > 0
          ? {
              order: value4,
            }
          : {}),
      });
      for (let value5 of Object.values(
        isFilesIndexObject(value2.files) ? value2.files : {},
      )) {
        let value6 = parseIndexBlobRecord(value5);
        if (value6 !== null) {
          appendBlobFile(
            runtime.DESIGN_SYSTEM_PATHS.assetsDir + value3 + "/" + value6.name,
            value6.rec,
          );
        }
      }
    }
    for (let value of Object.values(
      isFilesIndexObject(index.blobs) ? index.blobs : {},
    )) {
      let value2 = parseIndexBlobRecord(value);
      if (value2 !== null) {
        appendBlobFile(value2.name, value2.rec);
      }
    }
    let sections: Record<string, string> = {};
    for (let [value, value2] of Object.entries(
      isFilesIndexObject(index.sections) ? index.sections : {},
    )) {
      if (typeof value2 === "string") {
        sections[decodeFileIndexKey(value)] = value2;
      }
    }
    let title = typeof index.title === "string" ? index.title : "",
      storage = (0, runtime.serializeStorageCatalog)({
        files: storageRecords,
      });
    files[runtime.DESIGN_SYSTEM_PATHS.manifest] = (0,
    runtime.stringifyManifestWithinBudget)({
      manifestVersion: 3,
      name: title,
      namespace: typeof index.namespace === "string" ? index.namespace : null,
      ...(Array.isArray(index.libraries) && index.libraries.length > 0
        ? {
            libraries: index.libraries,
          }
        : {}),
      assetGroups: assetGroups,
      ...(storage !== undefined
        ? {
            storage: storage,
          }
        : {}),
      ...(Object.keys(sections).length > 0
        ? {
            sections: sections,
          }
        : {}),
    });
    files[runtime.DESIGN_SYSTEM_PATHS.manifest] = (0,
    runtime.stringifyManifestWithinBudget)(
      (0, runtime.buildDesignSystemManifest)(
        (0, runtime.parsedDesignSystem)({
          v: 2,
          files: {
            ...files,
          },
        }),
        title,
      ),
    );
    let sortedFiles = Object.fromEntries(
      Object.keys(files)
        .sort()
        .map((input) => [input, files[input]]),
    );
    return {
      title: title,
      content: {
        v: 2,
        files: Object.freeze(sortedFiles),
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "reactFontFaces",
    () => reactFontFaces,
    (value) => {
      reactFontFaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_INDEX_PROJECT_PATH",
    () => FILES_INDEX_PROJECT_PATH,
    (value) => {
      FILES_INDEX_PROJECT_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_INDEX_NAME",
    () => FILES_INDEX_NAME,
    (value) => {
      FILES_INDEX_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_INDEX_PATH",
    () => FILES_INDEX_PATH,
    (value) => {
      FILES_INDEX_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_MIGRATION_FILE_NAMES",
    () => RESERVED_MIGRATION_FILE_NAMES,
    (value) => {
      RESERVED_MIGRATION_FILE_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROJECT_FILE_PREFIXEditorFilesIndex",
    () => PROJECT_FILE_PREFIXEditorFilesIndex,
    (value) => {
      PROJECT_FILE_PREFIXEditorFilesIndex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_INDEX_VERSION",
    () => FILES_INDEX_VERSION,
    (value) => {
      FILES_INDEX_VERSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "projectFilePath",
    () => projectFilePath,
    (value) => {
      projectFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "relativeProjectFilePath",
    () => relativeProjectFilePath,
    (value) => {
      relativeProjectFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_FILE_STORAGE_POLICY",
    () => DEFAULT_FILE_STORAGE_POLICY,
    (value) => {
      DEFAULT_FILE_STORAGE_POLICY = value;
    },
  );
  bindRuntimeValue(runtime, "classifyFileStorage", () => classifyFileStorage);
  bindRuntimeValue(
    runtime,
    "blobFilesOwedToFileStorage",
    () => blobFilesOwedToFileStorage,
  );
  bindRuntimeValue(
    runtime,
    "fileIndexEncoder",
    () => fileIndexEncoder,
    (value) => {
      fileIndexEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileIndexDecoder",
    () => fileIndexDecoder,
    (value) => {
      fileIndexDecoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_INDEX_KEY_SAFE_CHARACTER",
    () => FILE_INDEX_KEY_SAFE_CHARACTER,
    (value) => {
      FILE_INDEX_KEY_SAFE_CHARACTER = value;
    },
  );
  bindRuntimeValue(runtime, "encodeFileIndexKey", () => encodeFileIndexKey);
  bindRuntimeValue(runtime, "decodeFileIndexKey", () => decodeFileIndexKey);
  bindRuntimeValue(
    runtime,
    "isSafeFileIndexKey",
    () => isSafeFileIndexKey,
    (value) => {
      isSafeFileIndexKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONVERTED_FROM_FIELD",
    () => CONVERTED_FROM_FIELD,
    (value) => {
      CONVERTED_FROM_FIELD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CREATED_ON_FILES_FIELD",
    () => CREATED_ON_FILES_FIELD,
    (value) => {
      CREATED_ON_FILES_FIELD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createEmptyFilesIndex",
    () => createEmptyFilesIndex,
    (value) => {
      createEmptyFilesIndex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_INDEX_MERGE_SCHEMA",
    () => FILES_INDEX_MERGE_SCHEMA,
    (value) => {
      FILES_INDEX_MERGE_SCHEMA = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFilesIndexObject",
    () => isFilesIndexObject,
    (value) => {
      isFilesIndexObject = value;
    },
  );
  bindRuntimeValue(runtime, "isFilesIndex", () => isFilesIndex);
  bindRuntimeValue(
    runtime,
    "hasFilesMigrationMarker",
    () => hasFilesMigrationMarker,
  );
  bindRuntimeValue(
    runtime,
    "TREE_INDEX_FIELD",
    () => TREE_INDEX_FIELD,
    (value) => {
      TREE_INDEX_FIELD = value;
    },
  );
  bindRuntimeValue(runtime, "parseFilesIndex", () => parseFilesIndex);
  bindRuntimeValue(runtime, "readTreeIndex", () => readTreeIndex);
  bindRuntimeValue(
    runtime,
    "PUBLISHABLE_MIME_TYPES",
    () => PUBLISHABLE_MIME_TYPES,
    (value) => {
      PUBLISHABLE_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_MIME_TYPES",
    () => TEXT_MIME_TYPES,
    (value) => {
      TEXT_MIME_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isTextMimeType",
    () => isTextMimeType,
    (value) => {
      isTextMimeType = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SVG_XML_DECLARATION_PATTERN",
    () => SVG_XML_DECLARATION_PATTERN,
    (value) => {
      SVG_XML_DECLARATION_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SVG_DOCTYPE_PATTERN",
    () => SVG_DOCTYPE_PATTERN,
    (value) => {
      SVG_DOCTYPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SVG_ATTRIBUTE_PATTERN",
    () => SVG_ATTRIBUTE_PATTERN,
    (value) => {
      SVG_ATTRIBUTE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESERVED_XML_NAMESPACES",
    () => RESERVED_XML_NAMESPACES,
    (value) => {
      RESERVED_XML_NAMESPACES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isXmlWhitespace",
    () => isXmlWhitespace,
    (value) => {
      isXmlWhitespace = value;
    },
  );
  bindRuntimeValue(runtime, "hasValidSvgRoot", () => hasValidSvgRoot);
  bindRuntimeValue(runtime, "isPublishableSvgText", () => isPublishableSvgText);
  bindRuntimeValue(runtime, "detectNonCodeText", () => detectNonCodeText);
  bindRuntimeValue(
    runtime,
    "publishableFileMimeType",
    () => publishableFileMimeType,
  );
  bindRuntimeValue(runtime, "decodeFileDataUrl", () => decodeFileDataUrl);
  bindRuntimeValue(runtime, "decodeCleanUtf8", () => decodeCleanUtf8);
  bindRuntimeValue(runtime, "isCleanUtf8DataUrl", () => isCleanUtf8DataUrl);
  bindRuntimeValue(
    runtime,
    "lottieDataUrlMimeType",
    () => lottieDataUrlMimeType,
  );
  bindRuntimeValue(
    runtime,
    "asciiCharacterCodes",
    () => asciiCharacterCodes,
    (value) => {
      asciiCharacterCodes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "bytesMatchAt",
    () => bytesMatchAt,
    (value) => {
      bytesMatchAt = value;
    },
  );
  bindRuntimeValue(runtime, "archiveFileMimeType", () => archiveFileMimeType);
  bindRuntimeValue(runtime, "readDataUrlSignature", () => readDataUrlSignature);
  bindRuntimeValue(runtime, "hasDamagedUnicode", () => hasDamagedUnicode);
  bindRuntimeValue(
    runtime,
    "explainUnpublishableFile",
    () => explainUnpublishableFile,
  );
  bindRuntimeValue(
    runtime,
    "unpublishableFileReason",
    () => unpublishableFileReason,
    (value) => {
      unpublishableFileReason = value;
    },
  );
  bindRuntimeValue(runtime, "isProjectContentPath", () => isProjectContentPath);
  bindRuntimeValue(runtime, "isDerivedProjectPath", () => isDerivedProjectPath);
  bindRuntimeValue(
    runtime,
    "validDerivedProjectFiles",
    () => validDerivedProjectFiles,
  );
  bindRuntimeValue(
    runtime,
    "damagedDerivedProjectPaths",
    () => damagedDerivedProjectPaths,
  );
  bindRuntimeValue(runtime, "projectFilesForSave", () => projectFilesForSave);
  bindRuntimeValue(
    runtime,
    "isUnsupportedBinaryFile",
    () => isUnsupportedBinaryFile,
  );
  bindRuntimeValue(
    runtime,
    "isRepairableDamagedText",
    () => isRepairableDamagedText,
  );
  bindRuntimeValue(runtime, "derivedProjectFiles", () => derivedProjectFiles);
  bindRuntimeValue(runtime, "blobRecordForIndex", () => blobRecordForIndex);
  bindRuntimeValue(runtime, "assetPathGroup", () => assetPathGroup);
  bindRuntimeValue(
    runtime,
    "assetFileIndexAddress",
    () => assetFileIndexAddress,
  );
  bindRuntimeValue(runtime, "buildFilesIndex", () => buildFilesIndex);
  bindRuntimeValue(
    runtime,
    "publishableProjectFiles",
    () => publishableProjectFiles,
  );
  bindRuntimeValue(
    runtime,
    "filesLeftOutOfMigration",
    () => filesLeftOutOfMigration,
  );
  bindRuntimeValue(runtime, "parseIndexBlobRecord", () => parseIndexBlobRecord);
  bindRuntimeValue(
    runtime,
    "restoreFilesFromIndex",
    () => restoreFilesFromIndex,
  );
  return () => {
    reactFontFaces = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    FILES_INDEX_PROJECT_PATH = "project/design-system.json";
    FILES_INDEX_NAME = "design-system.json";
    FILES_INDEX_PATH = FILES_INDEX_PROJECT_PATH;
    RESERVED_MIGRATION_FILE_NAMES = [
      "migration.json",
      "design-system.before-files.json",
      "publish-progress.json",
      "migration-map.json",
    ];
    PROJECT_FILE_PREFIXEditorFilesIndex = "project/";
    FILES_INDEX_VERSION = 3;
    projectFilePath = (path: string): string =>
      PROJECT_FILE_PREFIXEditorFilesIndex + path;
    relativeProjectFilePath = (path: string) => {
      if (!path.startsWith(PROJECT_FILE_PREFIXEditorFilesIndex)) {
        return;
      }
      let value = path.slice(PROJECT_FILE_PREFIXEditorFilesIndex.length);
      if (
        path === FILES_INDEX_PROJECT_PATH ||
        RESERVED_MIGRATION_FILE_NAMES.includes(value)
      ) {
        return undefined;
      } else {
        return value;
      }
    };
    DEFAULT_FILE_STORAGE_POLICY = {
      readme: "file",
      doc: "file",
      tokens: "file",
      manifest: "file",
      bundleJs: "file",
      bundleCss: "file",
      dts: "file",
      preview: "file",
      componentReadme: "file",
      componentSource: "file",
      componentLib: "file",
      componentOther: "file",
      other: "file",
      font: "file",
      asset: "blob",
    };
    fileIndexEncoder = new TextEncoder();
    fileIndexDecoder = new TextDecoder();
    FILE_INDEX_KEY_SAFE_CHARACTER = /[A-Za-z0-9_.\/-]/;
    isSafeFileIndexKey = (key: string) =>
      key !== "" && !runtime.RESERVED_PROTOTYPE_NAMES.has(key);
    CONVERTED_FROM_FIELD = "convertedFrom";
    CREATED_ON_FILES_FIELD = "createdOnFiles";
    createEmptyFilesIndex = () => ({
      v: FILES_INDEX_VERSION,
      layout: "files",
      title: "",
      libraries: [],
      sections: {},
      groups: [],
      assetGroups: {},
      blobs: {},
      docs: {
        sections: [],
      },
    });
    FILES_INDEX_MERGE_SCHEMA = {
      kind: "map",
      keys: {
        libraries: {
          kind: "leaf",
        },
        sections: {
          kind: "map",
          of: {
            kind: "leaf",
          },
        },
        groups: {
          kind: "list",
          membersOf: "assetGroups",
        },
        assetGroups: {
          kind: "map",
          of: {
            kind: "map",
            keys: {
              order: {
                kind: "list",
              },
              files: {
                kind: "map",
                of: {
                  kind: "map",
                  of: {
                    kind: "leaf",
                  },
                },
              },
            },
          },
        },
        blobs: {
          kind: "map",
          of: {
            kind: "map",
            of: {
              kind: "leaf",
            },
          },
        },
        docs: {
          kind: "map",
          keys: {
            sections: {
              kind: "list",
            },
          },
        },
        source: {
          kind: "leaf",
        },
        upgraded: {
          kind: "leaf",
        },
        convertedFrom: {
          kind: "leaf",
        },
        createdOnFiles: {
          kind: "leaf",
        },
      },
    };
    isFilesIndexObject = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    TREE_INDEX_FIELD = "treeIndex";
    PUBLISHABLE_MIME_TYPES = new Set([
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
    TEXT_MIME_TYPES = new Set([
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
      "image/svg+xml",
    ]);
    isTextMimeType = (mimeType: string) => TEXT_MIME_TYPES.has(mimeType);
    SVG_XML_DECLARATION_PATTERN =
      /<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(?:"1\.0"|'1\.0')(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(?:"[Uu][Tt][Ff]-8"|'[Uu][Tt][Ff]-8'))?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(?:"yes"|'yes'|"no"|'no'))?[ \t\r\n]*\?>/y;
    SVG_DOCTYPE_PATTERN =
      /<!DOCTYPE[ \t\r\n]+svg(?:[ \t\r\n]+(?:SYSTEM[ \t\r\n]+(?:"[^"<>[]*"|'[^'<>[]*')|PUBLIC[ \t\r\n]+(?:"[ \r\na-zA-Z0-9'()+,./:=?;!*#@$_%-]*"|'[ \r\na-zA-Z0-9()+,./:=?;!*#@$_%-]*')[ \t\r\n]+(?:"[^"<>[]*"|'[^'<>[]*')))?[ \t\r\n]*>/y;
    SVG_ATTRIBUTE_PATTERN =
      /([A-Za-z_][-A-Za-z0-9_.]*)(?::([A-Za-z_][-A-Za-z0-9_.]*))?[ \t\r\n]*=[ \t\r\n]*(?:"([^"<&]*)"|'([^'<&]*)')/y;
    RESERVED_XML_NAMESPACES = [
      "http://www.w3.org/XML/1998/namespace",
      "http://www.w3.org/2000/xmlns/",
    ];
    isXmlWhitespace = (character: string | undefined) =>
      character === " " ||
      character === "\t" ||
      character === "\r" ||
      character ===
        `
`;
    asciiCharacterCodes = (text: string) =>
      [...text].map((input) => input.charCodeAt(0));
    bytesMatchAt = (
      bytes: Uint8Array<ArrayBufferLike>,
      offset: number,
      signature: readonly number[],
    ) =>
      offset >= 0 &&
      offset + signature.length <= bytes.length &&
      signature.every(
        (input, options): boolean => bytes[offset + options] === input,
      );
    unpublishableFileReason = (path: string, contents: string | undefined) =>
      explainUnpublishableFile(path, contents)?.why ?? null;
  };
}

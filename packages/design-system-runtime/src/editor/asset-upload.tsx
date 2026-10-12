import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetUpload(runtime: RuntimeBindings): () => void {
  var reactAssetUpload: typeof import("react");
  var zipCrc32Table: Uint32Array;
  var fetchDownloadFileBytes: Editor.DownloadBytesFetcher;
  var addressedDownloadFileUrl: (
    files: Model.FileTable,
    path: string,
  ) => string | undefined;
  var FONT_FILE_WEIGHT_PATTERNS: [RegExp, string][];
  var fileRelativePathOverrides: WeakMap<File, string>;
  var MAX_DROPPED_FILES: number;
  var IGNORED_UPLOAD_FILE_NAME_PATTERN: RegExp;
  function downloadZipBaseName(name: string): string {
    let baseName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (baseName !== "") {
      return baseName.slice(0, 60);
    } else {
      return "design-system";
    }
  }
  function zipCrc32(bytes: Uint8Array): number {
    let crc: number = 4294967295;
    for (let index: number = 0; index < bytes.length; index++) {
      crc = zipCrc32Table[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
    }
    return (crc ^ 4294967295) >>> 0;
  }
  function createStoredZip(entries: Application.ZipEntry[]): Uint8Array {
    let encoder = new TextEncoder(),
      localEntries: Uint8Array[] = [],
      centralDirectory: Uint8Array[] = [],
      offset = 0;
    for (let value4 of entries) {
      let value5 = encoder.encode(value4.name),
        value6 =
          typeof value4.data === "string"
            ? encoder.encode(value4.data)
            : value4.data,
        value7 = zipCrc32(value6),
        value8 = new DataView(new ArrayBuffer(30));
      value8.setUint32(0, 67324752, true);
      value8.setUint16(4, 20, true);
      value8.setUint16(6, 2048, true);
      value8.setUint16(8, 0, true);
      value8.setUint16(10, 0, true);
      value8.setUint16(12, 33, true);
      value8.setUint32(14, value7, true);
      value8.setUint32(18, value6.length, true);
      value8.setUint32(22, value6.length, true);
      value8.setUint16(26, value5.length, true);
      value8.setUint16(28, 0, true);
      localEntries.push(new Uint8Array(value8.buffer), value5, value6);
      let value9 = new DataView(new ArrayBuffer(46));
      value9.setUint32(0, 33639248, true);
      value9.setUint16(4, 20, true);
      value9.setUint16(6, 20, true);
      value9.setUint16(8, 2048, true);
      value9.setUint16(10, 0, true);
      value9.setUint16(12, 0, true);
      value9.setUint16(14, 33, true);
      value9.setUint32(16, value7, true);
      value9.setUint32(20, value6.length, true);
      value9.setUint32(24, value6.length, true);
      value9.setUint16(28, value5.length, true);
      value9.setUint16(30, 0, true);
      value9.setUint16(32, 0, true);
      value9.setUint16(34, 0, true);
      value9.setUint16(36, 0, true);
      value9.setUint32(38, 0, true);
      value9.setUint32(42, offset, true);
      centralDirectory.push(new Uint8Array(value9.buffer), value5);
      offset += 30 + value5.length + value6.length;
    }
    let value = centralDirectory.reduce(
        (input, items2) => input + items2.length,
        0,
      ),
      value2 = new DataView(new ArrayBuffer(22));
    value2.setUint32(0, 101010256, true);
    value2.setUint16(8, entries.length, true);
    value2.setUint16(10, entries.length, true);
    value2.setUint32(12, value, true);
    value2.setUint32(16, offset, true);
    let items = [
        ...localEntries,
        ...centralDirectory,
        new Uint8Array(value2.buffer),
      ],
      value3 = new Uint8Array(
        items.reduce((input, items2) => input + items2.length, 0),
      ),
      index = 0;
    for (let value4 of items) {
      value3.set(value4, index);
      index += value4.length;
    }
    return value3;
  }
  function downloadDataUrlBytes(dataUrl: string): Uint8Array | null {
    let metadata = (0, runtime.parseDataUriHeader)(dataUrl);
    if (metadata === null) {
      return null;
    }
    let payload = dataUrl.slice(metadata.payloadOffset);
    if (metadata.base64) {
      try {
        let value = atob(payload),
          value2 = new Uint8Array(value.length);
        for (let index: number = 0; index < value.length; index++) {
          value2[index] = value.charCodeAt(index);
        }
        return value2;
      } catch {
        return null;
      }
    }
    try {
      return new TextEncoder().encode(decodeURIComponent(payload));
    } catch {
      return null;
    }
  }
  async function collectDownloadFiles(
    files: Model.FileTable,
    paths: Model.NormalizedTokens,
    storage: string,
    prefix: Model.StorageCatalog,
    fetchBytes: Editor.DownloadBytesFetcher = fetchDownloadFileBytes,
  ): Promise<{
    entries: Application.ZipEntry[];
    skipped: string[];
  }> {
    let entries: Application.ZipEntry[] = [],
      missing: string[] = [],
      usedNames = new Set();
    for (let value of Object.keys(files).sort()) {
      let value2 = files[value],
        value3 = (0, runtime.storagePointerForFile)(value, value2);
      if (value3 === null && (0, runtime.isTextFilePath)(value)) {
        entries.push({
          name: value,
          data: value2,
        });
        usedNames.add(value);
        continue;
      }
      if (value3 === null) {
        let value5 = downloadDataUrlBytes(value2);
        if (value5 === null) {
          missing.push(value);
        } else {
          entries.push({
            name: value,
            data: value5,
          });
          usedNames.add(value);
        }
        continue;
      }
      let value4 = await preflightDownloadFiles(
        [
          addressedDownloadFileUrl(files, value),
          (0, runtime.filePreviewUrl)(files, value, prefix),
        ],
        fetchBytes,
      );
      if (value4 === null) {
        missing.push(value);
      } else {
        entries.push({
          name: value,
          data: value4,
        });
        usedNames.add(value);
      }
    }
    if (!usedNames.has(runtime.DESIGN_SYSTEM_PATHS.readme)) {
      entries.push({
        name: runtime.DESIGN_SYSTEM_PATHS.readme,
        data: "",
      });
    }
    entries.push({
      name: runtime.GENERATED_TOKENS_CSS_PATH,
      data: (0, runtime.generateNamedTokensCss)(paths, storage),
    });
    try {
      for (let [value, value2] of (0, runtime.consumptionDocumentationForFiles)(
        files,
      ).files) {
        if (!usedNames.has(value)) {
          entries.push({
            name: value,
            data: value2,
          });
        }
      }
    } catch {}
    return {
      entries: entries,
      skipped: missing,
    };
  }
  async function saveDownloadFile(
    name: string,
    contents: string | Uint8Array,
    mimeType: string,
  ): Promise<Application.ArtifactDownloadOutcome> {
    let bytes =
        typeof contents === "string"
          ? new TextEncoder().encode(contents)
          : contents,
      permission = await (0, runtime.saveThroughShell)(bytes, name),
      callback = (
        input: Application.ArtifactDownloadOutcome["outcome"],
      ): Application.ArtifactDownloadOutcome => ({
        outcome: input,
        shell: permission,
      });
    if (
      permission.outcome === "saved" ||
      permission.outcome === "declined" ||
      permission.outcome === "withheld"
    ) {
      return callback(permission.outcome);
    }
    if ((0, runtime.hasDownloadCapability)()) {
      return callback("refused");
    }
    try {
      if (
        typeof document === "undefined" ||
        typeof URL === "undefined" ||
        typeof URL.createObjectURL !== "function"
      ) {
        return callback("failed");
      }
      let value = new Blob([bytes as BlobPart], {
          type: mimeType,
        }),
        value2 = document.createElement("a");
      value2.href = URL.createObjectURL(value);
      value2.download = name;
      value2.rel = "noopener";
      document.body.appendChild(value2);
      value2.click();
      setTimeout((): void => {
        URL.revokeObjectURL(value2.href);
        value2.remove();
      }, 800);
      return callback("downloaded");
    } catch {
      return callback("failed");
    }
  }
  function unsupportedDownloadMessage(
    path: string,
    shellError: string,
  ): string {
    let extension = (0, runtime.fileExtension)(path),
      fileKind: string =
        extension === ""
          ? "files with no extension"
          : "." + extension + " files";
    switch (shellError) {
      case "rejected_extension":
        return "This host can’t save " + fileKind;
      case "extension_not_enabled":
        return "This host can’t save " + fileKind + " yet";
      case "too_large":
        return "This host wouldn’t save a file the size of " + path;
      case "rate_limited":
        return "The save didn’t go through (another prompt may be open). Try Download again";
      case "unavailable":
        return "The save didn’t go through. Try Download again";
      default:
        return "Could not download " + path + " here";
    }
  }
  async function preflightDownloadFiles(
    paths: (string | null | undefined)[],
    files: Editor.DownloadBytesFetcher,
  ): Promise<Uint8Array | null> {
    for (let value of new Set(paths)) {
      if (value === null || value === undefined) {
        continue;
      }
      let value2 = /^data:/i.test(value)
        ? downloadDataUrlBytes(value)
        : await files(value);
      if (value2 !== null) {
        return value2;
      }
    }
    return null;
  }
  async function readDownloadFileBytes(
    files: Model.FileTable,
    path: string,
    storage: Model.StorageCatalog,
    fetchBytes: Editor.DownloadBytesFetcher = fetchDownloadFileBytes,
  ): Promise<Uint8Array | null> {
    let value = files[path];
    if (value === undefined) {
      return null;
    }
    let value2 = (0, runtime.storagePointerForFile)(path, value);
    if (value2 === null && (0, runtime.isTextFilePath)(path)) {
      return new TextEncoder().encode(value);
    }
    if (value2 === null) {
      return downloadDataUrlBytes(value);
    }
    return preflightDownloadFiles(
      [
        addressedDownloadFileUrl(files, path),
        (0, runtime.filePreviewUrl)(files, path, storage),
      ],
      fetchBytes,
    );
  }
  function inferFontMetadata(fileName: string): Editor.InferredFontMetadata {
    let baseName = fileName.replace(/\.[a-z0-9]+$/i, ""),
      style: Editor.InferredFontMetadata["style"] = /italic/i.test(baseName)
        ? "italic"
        : /oblique/i.test(baseName)
          ? "oblique"
          : "normal",
      weight = "400";
    if (/variable|\bVF\b|var\b/i.test(baseName)) {
      weight = "100 900";
    } else {
      for (let [value, value2] of FONT_FILE_WEIGHT_PATTERNS) {
        if (value.test(baseName)) {
          weight = value2;
          break;
        }
      }
    }
    return {
      family: (
        baseName
          .replace(
            /[-_ ](thin|hairline|extra-?light|ultra-?light|light|regular|roman|romans|book|normal|text|medium|semi-?bold|demi-?bold|extra-?bold|ultra-?bold|heavy|bold|black|italic|italics|oblique|variable|var|vf|web|webfont|\d+x\d+|\d{3})(?=[-_ .]|$)/gi,
            "",
          )
          .replace(/[-_]+/g, " ")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .trim() || baseName
      ).slice(0, 80),
      weight: weight,
      style: style,
    };
  }
  function uploadedFileRelativePath(file: File): string {
    return (
      fileRelativePathOverrides.get(file) ??
      file.webkitRelativePath ??
      ""
    ).replace(/^\/+/, "");
  }
  function withUploadedFileRelativePath(
    file: File,
    relativePath: string,
  ): File {
    fileRelativePathOverrides.set(file, relativePath);
    return file;
  }
  function isIgnoredUploadFileName(name: string): boolean {
    return IGNORED_UPLOAD_FILE_NAME_PATTERN.test(name);
  }
  function isIgnoredUploadFile(file: File): boolean {
    return (
      isIgnoredUploadFileName(file.name) ||
      uploadedFileRelativePath(file).split("/").some(isIgnoredUploadFileName)
    );
  }
  function extractDroppedFiles(
    dataTransfer: DataTransfer,
  ): Promise<Editor.DroppedFiles> {
    let entries: Editor.DroppedEntry[] = [],
      files: File[] = [],
      items = dataTransfer.items;
    if (
      items !== undefined &&
      items.length > 0 &&
      typeof items[0].webkitGetAsEntry === "function"
    ) {
      for (let value of Array.from(items)) {
        if (value.kind !== "file") {
          continue;
        }
        let value2 = value.webkitGetAsEntry();
        if (value2 !== null) {
          entries.push(value2);
        } else {
          let value3 = value.getAsFile();
          if (value3 !== null) {
            files.push(value3);
          }
        }
      }
    } else {
      files.push(...Array.from(dataTransfer.files));
    }
    return collectDroppedDirectories(entries, files);
  }
  async function collectDroppedDirectories(
    entries: Editor.DroppedEntry[],
    files: File[] = [],
  ): Promise<Editor.DroppedFiles> {
    let result: Editor.DroppedFiles = {
        files: [],
        leftOut: 0,
      },
      appendFile = (input: File): void => {
        if (result.files.length < MAX_DROPPED_FILES) {
          result.files.push(input);
        } else {
          result.leftOut++;
        }
      };
    for (let value of files) {
      if (!isIgnoredUploadFileName(value.name)) {
        appendFile(value);
      }
    }
    let callback = async (
      input: Editor.DroppedEntry,
      options: string,
    ): Promise<void> => {
      if (isIgnoredUploadFileName(input.name)) {
        return;
      }
      if (input.isFile && input.file !== undefined) {
        let value = await new Promise<File | null>((input2) =>
          input.file?.(
            (input3) => input2(input3),
            () => input2(null),
          ),
        );
        if (value !== null) {
          appendFile(
            options === ""
              ? value
              : withUploadedFileRelativePath(value, options + value.name),
          );
        }
        return;
      }
      if (input.isDirectory && input.createReader !== undefined) {
        let value = input.createReader();
        for (;;) {
          let value2 = await new Promise<Editor.DroppedEntry[]>((input2) =>
            value.readEntries(
              (input3) => input2(input3),
              () => input2([]),
            ),
          );
          if (value2.length === 0) {
            break;
          }
          for (let value3 of value2) {
            if (result.files.length >= MAX_DROPPED_FILES && value3.isFile) {
              result.leftOut++;
              continue;
            }
            await callback(value3, options + input.name + "/");
          }
        }
      }
    };
    for (let value of entries) {
      await callback(value, "");
    }
    return result;
  }
  bindRuntimeValue(
    runtime,
    "reactAssetUpload",
    () => reactAssetUpload,
    (value) => {
      reactAssetUpload = value;
    },
  );
  bindRuntimeValue(runtime, "downloadZipBaseName", () => downloadZipBaseName);
  bindRuntimeValue(
    runtime,
    "zipCrc32Table",
    () => zipCrc32Table,
    (value) => {
      zipCrc32Table = value;
    },
  );
  bindRuntimeValue(runtime, "zipCrc32", () => zipCrc32);
  bindRuntimeValue(runtime, "createStoredZip", () => createStoredZip);
  bindRuntimeValue(runtime, "downloadDataUrlBytes", () => downloadDataUrlBytes);
  bindRuntimeValue(
    runtime,
    "fetchDownloadFileBytes",
    () => fetchDownloadFileBytes,
    (value) => {
      fetchDownloadFileBytes = value;
    },
  );
  bindRuntimeValue(runtime, "collectDownloadFiles", () => collectDownloadFiles);
  bindRuntimeValue(runtime, "saveDownloadFile", () => saveDownloadFile);
  bindRuntimeValue(
    runtime,
    "unsupportedDownloadMessage",
    () => unsupportedDownloadMessage,
  );
  bindRuntimeValue(
    runtime,
    "addressedDownloadFileUrl",
    () => addressedDownloadFileUrl,
    (value) => {
      addressedDownloadFileUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preflightDownloadFiles",
    () => preflightDownloadFiles,
  );
  bindRuntimeValue(
    runtime,
    "readDownloadFileBytes",
    () => readDownloadFileBytes,
  );
  bindRuntimeValue(
    runtime,
    "FONT_FILE_WEIGHT_PATTERNS",
    () => FONT_FILE_WEIGHT_PATTERNS,
    (value) => {
      FONT_FILE_WEIGHT_PATTERNS = value;
    },
  );
  bindRuntimeValue(runtime, "inferFontMetadata", () => inferFontMetadata);
  bindRuntimeValue(
    runtime,
    "fileRelativePathOverrides",
    () => fileRelativePathOverrides,
    (value) => {
      fileRelativePathOverrides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "uploadedFileRelativePath",
    () => uploadedFileRelativePath,
  );
  bindRuntimeValue(
    runtime,
    "withUploadedFileRelativePath",
    () => withUploadedFileRelativePath,
  );
  bindRuntimeValue(
    runtime,
    "MAX_DROPPED_FILES",
    () => MAX_DROPPED_FILES,
    (value) => {
      MAX_DROPPED_FILES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "IGNORED_UPLOAD_FILE_NAME_PATTERN",
    () => IGNORED_UPLOAD_FILE_NAME_PATTERN,
    (value) => {
      IGNORED_UPLOAD_FILE_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isIgnoredUploadFileName",
    () => isIgnoredUploadFileName,
  );
  bindRuntimeValue(runtime, "isIgnoredUploadFile", () => isIgnoredUploadFile);
  bindRuntimeValue(runtime, "extractDroppedFiles", () => extractDroppedFiles);
  bindRuntimeValue(
    runtime,
    "collectDroppedDirectories",
    () => collectDroppedDirectories,
  );
  return () => {
    reactAssetUpload = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    zipCrc32Table = (() => {
      let value = new Uint32Array(256);
      for (let index: number = 0; index < 256; index++) {
        let value2: number = index;
        for (let index2: number = 0; index2 < 8; index2++) {
          value2 = value2 & 1 ? 3988292384 ^ (value2 >>> 1) : value2 >>> 1;
        }
        value[index] = value2 >>> 0;
      }
      return value;
    })();
    fetchDownloadFileBytes = async (
      url: string,
    ): Promise<Uint8Array | null> => {
      try {
        let value = await fetch(url, {
          credentials: "same-origin",
        });
        if (!value.ok) {
          return null;
        }
        return new Uint8Array(await value.arrayBuffer());
      } catch {
        return null;
      }
    };
    addressedDownloadFileUrl = (files: Model.FileTable, path: string) =>
      (0, runtime.isHeldFilePointer)(path, files[path] ?? "")
        ? (0, runtime.addressedProjectFileUrl)(path)
        : undefined;
    FONT_FILE_WEIGHT_PATTERNS = [
      [/thin|hairline/i, "100"],
      [/extra-?light|ultra-?light/i, "200"],
      [/light/i, "300"],
      [/regular|roman|book|normal|text/i, "400"],
      [/medium/i, "500"],
      [/semi-?bold|demi-?bold/i, "600"],
      [/extra-?bold|ultra-?bold|heavy/i, "800"],
      [/bold/i, "700"],
      [/black/i, "900"],
    ];
    fileRelativePathOverrides = new WeakMap();
    MAX_DROPPED_FILES = 500;
    IGNORED_UPLOAD_FILE_NAME_PATTERN =
      /^(?:\.|__MACOSX$|Thumbs\.db$|desktop\.ini$)/i;
  };
}

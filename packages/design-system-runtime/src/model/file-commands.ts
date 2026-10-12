/** Restored application module; prepare first, initialize in original order. */
import type * as Model from "../contracts";
import type * as Core from "../contracts/model-core";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelFileCommands(
  runtime: RuntimeBindings & Core.ModelCoreRuntime,
): () => void {
  var fileTableBytesCache: WeakMap<Model.FileTable, number>;
  var protectedFilePathPredicate: (path: string) => boolean;
  function freezeSortedFileTable(files: Model.FileTable) {
    let sorted: Record<string, string> = {};
    for (let value of Object.keys(files).sort()) {
      sorted[value] = files[value];
    }
    return Object.freeze(sorted);
  }
  function contentWithFiles(
    previousContent: Model.DesignSystemContent,
    files: Model.FileTable,
  ): Model.DesignSystemContent {
    return {
      v: 2,
      files: freezeSortedFileTable(files),
    };
  }
  function fileTableInlineBytes(files: Model.FileTable) {
    let cached = fileTableBytesCache.get(files);
    if (cached !== undefined) {
      return cached;
    }
    let bytes = 0;
    for (let value in files) {
      bytes += (0, runtime.estimateEmbeddedStringBytes)(files[value]);
    }
    fileTableBytesCache.set(files, bytes);
    return bytes;
  }
  function fileFitsInlineBudgets(
    content: Model.DesignSystemContent,
    path: string,
    value: string,
  ): boolean {
    if ((0, runtime.isUnboundedFileParsing)()) {
      return true;
    }
    let kind = (0, runtime.classifyDesignSystemFile)(path),
      bytes = (0, runtime.estimateEmbeddedStringBytes)(value);
    if (kind === "dts") {
      let value2 = bytes;
      for (let value3 in content.files) {
        if (
          value3 !== path &&
          (0, runtime.classifyDesignSystemFile)(value3) === "dts"
        ) {
          value2 += (0, runtime.estimateEmbeddedStringBytes)(
            content.files[value3],
          );
        }
      }
      if (value2 > runtime.DESIGN_SYSTEM_INLINE_LIMITS.dtsTotal) {
        return false;
      }
    } else if (bytes > (0, runtime.inlineLimitForPath)(path, kind)) {
      return false;
    }
    let previousValue = content.files[path];
    if (
      previousValue === undefined &&
      Object.keys(content.files).length >= runtime.MAX_DESIGN_SYSTEM_FILES
    ) {
      return false;
    }
    return (
      fileTableInlineBytes(content.files) -
        (previousValue !== undefined
          ? (0, runtime.estimateEmbeddedStringBytes)(previousValue)
          : 0) +
        bytes <=
      runtime.DESIGN_SYSTEM_INLINE_LIMITS.total
    );
  }
  function setDesignSystemFile(
    content: Model.DesignSystemContent,
    path: string,
    value: string,
  ) {
    if (!(0, runtime.isValidDesignSystemPath)(path)) {
      return content;
    }
    let canonicalPath = (0, runtime.normalizeDesignSystemPath)(path);
    if (
      !(0, runtime.isValidDesignSystemPath)(canonicalPath) ||
      (0, runtime.explainGeneratedOrRetiredPath)(canonicalPath) !== null ||
      (0, runtime.explainReservedSystemPath)(canonicalPath) !== null
    ) {
      return content;
    }
    if (
      !(0, runtime.isTextFilePath)(canonicalPath) &&
      (0, runtime.parseDataUriHeader)(value) === null &&
      (0, runtime.parseStoragePointer)(value) === null
    ) {
      return content;
    }
    if (content.files[canonicalPath] === value) {
      return content;
    }
    if (!fileFitsInlineBudgets(content, canonicalPath, value)) {
      return content;
    }
    return contentWithFiles(content, {
      ...content.files,
      [canonicalPath]: value,
    });
  }
  function setProtectedFilePathPredicate(
    predicate: ((path: string) => boolean) | undefined,
  ): void {
    protectedFilePathPredicate = predicate ?? ((): boolean => false);
  }
  function deleteDesignSystemFiles(
    content: Model.DesignSystemContent,
    paths: string[],
  ) {
    let removable = paths.filter(
      (input) =>
        Object.hasOwn(content.files, input) &&
        !protectedFilePathPredicate(input),
    );
    if (removable.length === 0) {
      return content;
    }
    let files = {
      ...content.files,
    };
    for (let value of removable) {
      delete files[value];
    }
    return contentWithFiles(content, files);
  }
  function renameDesignSystemFile(
    content: Model.DesignSystemContent,
    oldPath: string,
    newPath: string,
  ) {
    if (
      !Object.hasOwn(content.files, oldPath) ||
      oldPath === newPath ||
      protectedFilePathPredicate(oldPath)
    ) {
      return content;
    }
    if (
      !(0, runtime.isValidDesignSystemPath)(newPath) ||
      (0, runtime.normalizeDesignSystemPath)(newPath) !== newPath ||
      (0, runtime.explainGeneratedOrRetiredPath)(newPath) !== null ||
      (0, runtime.explainReservedSystemPath)(newPath) !== null
    ) {
      return content;
    }
    if (Object.hasOwn(content.files, newPath)) {
      return content;
    }
    if (
      (0, runtime.isTextFilePath)(oldPath) !==
      (0, runtime.isTextFilePath)(newPath)
    ) {
      return content;
    }
    if (
      (0, runtime.storagePointerForFile)(oldPath, content.files[oldPath]) !==
        null &&
      !(0, runtime.canUseStoragePointer)(newPath)
    ) {
      return content;
    }
    let files = {
      ...content.files,
    };
    files[newPath] = files[oldPath];
    delete files[oldPath];
    return contentWithFiles(content, files);
  }
  function unusedFileName(
    files: Model.FileTable,
    directory: string,
    filename: string,
  ) {
    let prefix: string = directory === "" ? "" : directory + "/";
    if (!Object.hasOwn(files, prefix + filename)) {
      return filename;
    }
    let dotOffset = filename.lastIndexOf("."),
      stem = dotOffset > 0 ? filename.slice(0, dotOffset) : filename,
      extension = dotOffset > 0 ? filename.slice(dotOffset) : "";
    for (let count: number = 2; count < 1000; count++) {
      let value: string = stem + " (" + String(count) + ")" + extension;
      if (!Object.hasOwn(files, prefix + value)) {
        return value;
      }
    }
    return stem + " (" + Date.now().toString(36) + ")" + extension;
  }
  function sanitizeUploadFileName(filename: string) {
    filename = filename.replace(
      /[\u0080-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\u2028\u2029\u2215\u2044\ufeff\uff0f$`":*?[]/g,
      "-",
    );
    let safeName = filename.replace(/[/\\\u0000-\u001f\u007f]+/g, "-").trim();
    safeName = safeName.replace(/^[.\s~-]+/, "");
    let extension = (0, runtime.fileExtension)(filename);
    if (safeName === "" || safeName.toLowerCase() === extension) {
      safeName = "file" + (extension !== "" ? "." + extension : "");
    }
    return safeName.slice(0, 120);
  }
  function setDesignSystemReadme(
    content: Model.DesignSystemContent,
    markdown: string,
  ) {
    if (
      (content.files[runtime.DESIGN_SYSTEM_PATHS.readme] ?? "") === markdown
    ) {
      return content;
    }
    if (markdown === "") {
      return deleteDesignSystemFiles(content, [
        runtime.DESIGN_SYSTEM_PATHS.readme,
      ]);
    }
    return setDesignSystemFile(
      content,
      runtime.DESIGN_SYSTEM_PATHS.readme,
      markdown,
    );
  }
  function setAdditionalDocument(
    content: Model.DesignSystemContent,
    path: string,
    markdown: string,
  ) {
    if ((0, runtime.classifyDesignSystemFile)(path) !== "doc") {
      return content;
    }
    if (
      Object.hasOwn(content.files, path) &&
      content.files[path] === markdown
    ) {
      return content;
    }
    return setDesignSystemFile(content, path, markdown);
  }
  bindRuntimeValue(
    runtime,
    "freezeSortedFileTable",
    () => freezeSortedFileTable,
  );
  bindRuntimeValue(runtime, "contentWithFiles", () => contentWithFiles);
  bindRuntimeValue(
    runtime,
    "fileTableBytesCache",
    () => fileTableBytesCache,
    (value) => {
      fileTableBytesCache = value;
    },
  );
  bindRuntimeValue(runtime, "fileTableInlineBytes", () => fileTableInlineBytes);
  bindRuntimeValue(
    runtime,
    "fileFitsInlineBudgets",
    () => fileFitsInlineBudgets,
  );
  bindRuntimeValue(runtime, "setDesignSystemFile", () => setDesignSystemFile);
  bindRuntimeValue(
    runtime,
    "protectedFilePathPredicate",
    () => protectedFilePathPredicate,
    (value) => {
      protectedFilePathPredicate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setProtectedFilePathPredicate",
    () => setProtectedFilePathPredicate,
  );
  bindRuntimeValue(
    runtime,
    "deleteDesignSystemFiles",
    () => deleteDesignSystemFiles,
  );
  bindRuntimeValue(
    runtime,
    "renameDesignSystemFile",
    () => renameDesignSystemFile,
  );
  bindRuntimeValue(runtime, "unusedFileName", () => unusedFileName);
  bindRuntimeValue(
    runtime,
    "sanitizeUploadFileName",
    () => sanitizeUploadFileName,
  );
  bindRuntimeValue(
    runtime,
    "setDesignSystemReadme",
    () => setDesignSystemReadme,
  );
  bindRuntimeValue(
    runtime,
    "setAdditionalDocument",
    () => setAdditionalDocument,
  );
  return () => {
    fileTableBytesCache = new WeakMap();
    protectedFilePathPredicate = (): boolean => false;
  };
}

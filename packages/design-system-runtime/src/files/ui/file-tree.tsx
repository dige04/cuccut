/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
import type * as React from "react";
import type { FileArtifactType } from "../../contracts/files-core";
import type {
  BrowserFileType,
  BrowserEntryType,
  BrowserSection,
  BrowserListingEntry,
  BrowserFolder,
  BrowserFile,
  BrowserEntry,
  BrowserRow,
  BrowserFileMetadata,
  VirtualFileStack,
  BrowserPreviewOptions,
} from "../../contracts/file-browser";
export function installFilesUiFileTree(runtime: RuntimeBindings): () => void {
  var reactDesignSystemFiles: typeof import("react");
  var reactDomDesignSystemFiles: typeof import("react-dom");
  var reactFilesBrowser: typeof import("react");
  var reactDomFilesBrowser: typeof import("react-dom");
  var FILE_BROWSER_SECTION_ORDER: BrowserSection[];
  var FILE_BROWSER_SECTION_BY_TYPE: Record<BrowserEntryType, BrowserSection>;
  var FILE_BROWSER_KIND_LABELS: Record<BrowserEntryType, string>;
  var fileBrowserSize: (value: unknown) => number | undefined;
  var fileBrowserContentType: (value: unknown) => string | undefined;
  var visibleFileName: (value: string) => string;
  var sanitizedFileName: (value: string) => string;
  var fileNameCollator: Intl.Collator;
  var compareFileNames: (first: string, second: string) => number;
  var MAX_FILE_BROWSER_TEXT_BYTES: number;
  var folderFileCountCache: WeakMap<BrowserFolder, number>;
  var DOWNLOAD_MIME_TYPES_BY_EXTENSION: Record<string, string>;
  function fileBrowserTypeFromName(name: string): BrowserFileType {
    let extension = name.includes(".")
      ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
      : "";
    if (extension === "html" || extension === "htm") {
      return "html";
    }
    if (extension === "jsx" || extension === "tsx") {
      return "jsx";
    }
    if (extension === "css" || extension === "scss" || extension === "less") {
      return "css";
    }
    if (extension === "js" || extension === "mjs" || extension === "ts") {
      return "js";
    }
    if (/^(png|jpe?g|gif|svg|webp|ico|bmp|avif)$/.test(extension)) {
      return "image";
    }
    if (extension === "md" || extension === "txt") {
      return "md";
    }
    if (
      extension === "json" ||
      extension === "yaml" ||
      extension === "yml" ||
      extension === "toml"
    ) {
      return "json";
    }
    return "other";
  }
  function fileBrowserFolderLabel(folder: string) {
    if (folder === "_ds") {
      return "Design system files";
    } else {
      if (folder === "_fig") {
        return "Figma files";
      } else {
        return folder;
      }
    }
  }
  function isHiddenBrowserPath(path: string) {
    let parts = path.split("/");
    return (
      parts.some((input: string) => input.startsWith(".") || input === "") ||
      parts[parts.length - 1] === "project-data.json"
    );
  }
  function projectListingFiles(
    files: Record<string, unknown>,
    type: FileArtifactType,
  ) {
    let rows: BrowserListingEntry[] = [];
    for (let [value, value2] of Object.entries(files)) {
      if (
        !value.startsWith(runtime.PROJECT_FILE_PREFIX) ||
        (0, runtime.isReservedProjectFile)(type, value)
      ) {
        continue;
      }
      let value3 = value.slice(runtime.PROJECT_FILE_PREFIX.length);
      if (
        value3 === "" ||
        value3.endsWith("/") ||
        isHiddenBrowserPath(value3)
      ) {
        continue;
      }
      let value4 =
          value2 !== null && typeof value2 === "object"
            ? (value2 as BrowserFileMetadata)
            : {},
        value5 = fileBrowserSize(value4.size),
        value6 = fileBrowserContentType(value4.contentType);
      rows.push({
        path: value3,
        ...(value5 !== undefined
          ? {
              size: value5,
            }
          : {}),
        ...(value6 !== undefined
          ? {
              contentType: value6,
            }
          : {}),
      });
    }
    return rows.sort(
      (input: BrowserListingEntry, options: BrowserListingEntry) =>
        compareFileNames(input.path, options.path),
    );
  }
  function buildFileBrowserTree(
    listing: readonly BrowserListingEntry[],
  ): BrowserFolder {
    let root: BrowserFolder = {
        kind: "folder",
        name: "",
        path: "",
        folders: [],
        files: [],
      },
      folders = new Map([["", root]]),
      seen = new Set<string>();
    for (let value of listing) {
      if (isHiddenBrowserPath(value.path)) {
        continue;
      }
      let value2 = value.path.split("/"),
        value3 = root;
      for (let index = 0; index < value2.length - 1; index += 1) {
        let value5 = value2[index],
          value6 = value3.path === "" ? value5 : value3.path + "/" + value5,
          entry = folders.get(value6);
        if (!entry) {
          entry = {
            kind: "folder",
            name: value5,
            path: value6,
            folders: [],
            files: [],
          };
          folders.set(value6, entry);
          value3.folders.push(entry);
        }
        value3 = entry;
      }
      let value4 = value2[value2.length - 1];
      if (seen.has(value.path)) {
        continue;
      }
      seen.add(value.path);
      value3.files.push({
        kind: "file",
        name: value4,
        path: value.path,
        type:
          value.attachment !== undefined || value.notCarried === true
            ? "other"
            : fileBrowserTypeFromName(value4),
        ...(value.size !== undefined
          ? {
              size: value.size,
            }
          : {}),
        ...(value.contentType !== undefined
          ? {
              contentType: value.contentType,
            }
          : {}),
        ...(value.attachment !== undefined
          ? {
              attachment: value.attachment,
            }
          : value.notCarried === true
            ? {
                notCarried: true,
              }
            : {}),
      });
    }
    let sortFolder = (input: BrowserFolder) => {
      input.folders.sort(
        (
          input2: {
            name: string;
          },
          options: {
            name: string;
          },
        ) => compareFileNames(input2.name, options.name),
      );
      input.files.sort(
        (
          input2: {
            name: string;
          },
          options: {
            name: string;
          },
        ) => compareFileNames(input2.name, options.name),
      );
      input.folders.forEach(sortFolder);
    };
    sortFolder(root);
    return root;
  }
  function fileBrowserFolder(
    tree: BrowserFolder,
    path: string,
  ): BrowserFolder | null {
    if (path === "") {
      return tree;
    }
    let folder: BrowserFolder | undefined = tree;
    for (let value of path.split("/")) {
      if (
        ((folder = folder!.folders.find(
          (input: BrowserFolder) => input.name === value,
        )),
        !folder)
      ) {
        return null;
      }
    }
    return folder;
  }
  function fileBrowserFolderSections(folder: BrowserFolder) {
    let sections = new Map<BrowserSection, BrowserEntry[]>(),
      append = (input: BrowserSection, options: BrowserEntry) => {
        let entry = sections.get(input);
        if (entry) {
          entry.push(options);
        } else {
          sections.set(input, [options]);
        }
      };
    for (let value of folder.folders) {
      append("Folders", value);
    }
    for (let value of folder.files) {
      append(FILE_BROWSER_SECTION_BY_TYPE[value.type], value);
    }
    return FILE_BROWSER_SECTION_ORDER.filter((input: BrowserSection) =>
      sections.has(input),
    ).map((input: BrowserSection) => ({
      label: input,
      entries: sections.get(input)!,
    }));
  }
  function formatFileBrowserBytes(bytes: number | undefined) {
    if (bytes === undefined) {
      return "";
    }
    let megabyte = 1048576;
    if (bytes >= megabyte) {
      return (bytes / megabyte).toFixed(1) + " MB";
    }
    if (bytes >= 1024) {
      return String(Math.round(bytes / 1024)) + " KB";
    }
    return String(bytes) + " B";
  }
  function fileBrowserMetadataText(entry: BrowserEntry) {
    if (entry.kind === "folder") {
      return "";
    }
    let name = visibleFileName(entry.name),
      extension = name.includes(".")
        ? name.slice(name.lastIndexOf(".") + 1).toUpperCase()
        : "";
    return [formatFileBrowserBytes(entry.size), extension]
      .filter((input: string) => input !== "")
      .join(" · ");
  }
  function flattenFileBrowserTree(
    folder: BrowserFolder,
    expanded: ReadonlySet<string>,
  ) {
    let rows: BrowserRow[] = [],
      visit = (input: BrowserFolder, options: number) => {
        let value = input.folders.length + input.files.length,
          index = 0;
        fileBrowserFolderSections(input).forEach(
          (
            input2: {
              label: BrowserSection;
              entries: BrowserEntry[];
            },
            options2: number,
          ) => {
            input2.entries.forEach((source: BrowserEntry, options3: number) => {
              index += 1;
              rows.push({
                entry: source,
                depth: options,
                pos: index,
                of: value,
                ...(options === 0 && options3 === 0
                  ? {
                      section: input2.label,
                      first: options2 === 0,
                    }
                  : {}),
              });
              if (source.kind === "folder" && expanded.has(source.path)) {
                visit(source, options + 1);
              }
            });
          },
        );
      };
    visit(folder, 0);
    return rows;
  }
  function fileBrowserPreviewKind(
    entry: BrowserFile,
    options: BrowserPreviewOptions = {},
  ) {
    if (entry.attachment !== undefined || entry.notCarried === true) {
      return "none";
    }
    let mime = entry.contentType?.split(";")[0]?.trim().toLowerCase();
    if (
      mime === undefined ? entry.type === "image" : mime.startsWith("image/")
    ) {
      return "image";
    }
    if (
      (entry.type === "html"
        ? options.htmlAsText === true
        : entry.type === "jsx" ||
          entry.type === "css" ||
          entry.type === "js" ||
          entry.type === "md" ||
          entry.type === "json" ||
          mime?.startsWith("text/") === true) &&
      entry.size !== undefined &&
      entry.size <= MAX_FILE_BROWSER_TEXT_BYTES
    ) {
      return "text";
    } else {
      return "none";
    }
  }
  function fileBrowserNoPreviewReason(
    entry: BrowserFile,
    options: BrowserPreviewOptions = {},
  ) {
    let probe = {
      ...entry,
      size: 0,
    };
    if (fileBrowserPreviewKind(probe, options) !== "text") {
      return "Preview isn’t available for this file type";
    }
    if (entry.size === undefined) {
      return "This file’s size isn’t known, so it isn’t previewed";
    } else {
      return "This file is too large to preview";
    }
  }
  function folderFileCount(folder: BrowserFolder): number {
    let count = folderFileCountCache.get(folder);
    if (count === undefined) {
      count =
        folder.files.length +
        folder.folders.reduce(
          (input: number, options: BrowserFolder) =>
            input + folderFileCount(options),
          0,
        );
      folderFileCountCache.set(folder, count);
    }
    return count;
  }
  function downloadMimeTypeFromName(name: string) {
    let cleanName = sanitizedFileName(name),
      dot = cleanName.lastIndexOf("."),
      extension = dot < 0 ? "" : cleanName.slice(dot + 1).toLowerCase();
    if (Object.hasOwn(DOWNLOAD_MIME_TYPES_BY_EXTENSION, extension)) {
      return DOWNLOAD_MIME_TYPES_BY_EXTENSION[extension];
    } else {
      return undefined;
    }
  }
  function stackVirtualFileRows(heights: readonly number[]) {
    let tops: number[] = [],
      total = 0;
    for (let value of heights) {
      tops.push(total);
      total += value;
    }
    return {
      tops: tops,
      total: total,
    };
  }
  function virtualFileRowAtOffset(tops: readonly number[], offset: number) {
    let low = 0,
      high = tops.length - 1;
    while (low < high) {
      let value = (low + high + 1) >> 1;
      if (tops[value] <= offset) {
        low = value;
      } else {
        high = value - 1;
      }
    }
    return low;
  }
  function visibleVirtualFileRows(
    stack: VirtualFileStack,
    scrollTop: number,
    viewportHeight: number,
    overscan: number,
  ): [number, number] {
    if (stack.tops.length === 0) {
      return [0, 0];
    }
    return [
      virtualFileRowAtOffset(stack.tops, scrollTop - overscan),
      virtualFileRowAtOffset(
        stack.tops,
        scrollTop + viewportHeight + overscan,
      ) + 1,
    ];
  }
  function virtualFileRowScrollTop(
    stack: VirtualFileStack,
    heights: readonly number[],
    row: number,
    scrollTop: number,
    viewportHeight: number,
    stickyHeight: number,
  ) {
    let value = stack.tops[row];
    if (value === undefined) {
      return scrollTop;
    }
    if (value - stickyHeight < scrollTop) {
      return Math.max(0, value - stickyHeight);
    }
    let value2 = value + heights[row];
    if (value2 > scrollTop + viewportHeight) {
      return value2 - viewportHeight;
    } else {
      return scrollTop;
    }
  }
  bindRuntimeValue(
    runtime,
    "reactDesignSystemFiles",
    () => reactDesignSystemFiles,
    (value) => {
      reactDesignSystemFiles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomDesignSystemFiles",
    () => reactDomDesignSystemFiles,
    (value) => {
      reactDomDesignSystemFiles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFilesBrowser",
    () => reactFilesBrowser,
    (value) => {
      reactFilesBrowser = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomFilesBrowser",
    () => reactDomFilesBrowser,
    (value) => {
      reactDomFilesBrowser = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_SECTION_ORDER",
    () => FILE_BROWSER_SECTION_ORDER,
    (value) => {
      FILE_BROWSER_SECTION_ORDER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_SECTION_BY_TYPE",
    () => FILE_BROWSER_SECTION_BY_TYPE,
    (value) => {
      FILE_BROWSER_SECTION_BY_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_KIND_LABELS",
    () => FILE_BROWSER_KIND_LABELS,
    (value) => {
      FILE_BROWSER_KIND_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserTypeFromName",
    () => fileBrowserTypeFromName,
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserFolderLabel",
    () => fileBrowserFolderLabel,
  );
  bindRuntimeValue(runtime, "isHiddenBrowserPath", () => isHiddenBrowserPath);
  bindRuntimeValue(
    runtime,
    "fileBrowserSize",
    () => fileBrowserSize,
    (value) => {
      fileBrowserSize = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserContentType",
    () => fileBrowserContentType,
    (value) => {
      fileBrowserContentType = value;
    },
  );
  bindRuntimeValue(runtime, "projectListingFiles", () => projectListingFiles);
  bindRuntimeValue(
    runtime,
    "visibleFileName",
    () => visibleFileName,
    (value) => {
      visibleFileName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizedFileName",
    () => sanitizedFileName,
    (value) => {
      sanitizedFileName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileNameCollator",
    () => fileNameCollator,
    (value) => {
      fileNameCollator = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compareFileNames",
    () => compareFileNames,
    (value) => {
      compareFileNames = value;
    },
  );
  bindRuntimeValue(runtime, "buildFileBrowserTree", () => buildFileBrowserTree);
  bindRuntimeValue(runtime, "fileBrowserFolder", () => fileBrowserFolder);
  bindRuntimeValue(
    runtime,
    "fileBrowserFolderSections",
    () => fileBrowserFolderSections,
  );
  bindRuntimeValue(
    runtime,
    "formatFileBrowserBytes",
    () => formatFileBrowserBytes,
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserMetadataText",
    () => fileBrowserMetadataText,
  );
  bindRuntimeValue(
    runtime,
    "flattenFileBrowserTree",
    () => flattenFileBrowserTree,
  );
  bindRuntimeValue(
    runtime,
    "MAX_FILE_BROWSER_TEXT_BYTES",
    () => MAX_FILE_BROWSER_TEXT_BYTES,
    (value) => {
      MAX_FILE_BROWSER_TEXT_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserPreviewKind",
    () => fileBrowserPreviewKind,
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserNoPreviewReason",
    () => fileBrowserNoPreviewReason,
  );
  bindRuntimeValue(
    runtime,
    "folderFileCountCache",
    () => folderFileCountCache,
    (value) => {
      folderFileCountCache = value;
    },
  );
  bindRuntimeValue(runtime, "folderFileCount", () => folderFileCount);
  bindRuntimeValue(
    runtime,
    "DOWNLOAD_MIME_TYPES_BY_EXTENSION",
    () => DOWNLOAD_MIME_TYPES_BY_EXTENSION,
    (value) => {
      DOWNLOAD_MIME_TYPES_BY_EXTENSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "downloadMimeTypeFromName",
    () => downloadMimeTypeFromName,
  );
  bindRuntimeValue(runtime, "stackVirtualFileRows", () => stackVirtualFileRows);
  bindRuntimeValue(
    runtime,
    "virtualFileRowAtOffset",
    () => virtualFileRowAtOffset,
  );
  bindRuntimeValue(
    runtime,
    "visibleVirtualFileRows",
    () => visibleVirtualFileRows,
  );
  bindRuntimeValue(
    runtime,
    "virtualFileRowScrollTop",
    () => virtualFileRowScrollTop,
  );
  return () => {
    reactDesignSystemFiles = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomDesignSystemFiles = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    reactFilesBrowser = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomFilesBrowser = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    FILE_BROWSER_SECTION_ORDER = [
      "Folders",
      "Pages",
      "Components",
      "Stylesheets",
      "Scripts",
      "Images",
      "Documents",
      "Data",
      "Other",
    ];
    FILE_BROWSER_SECTION_BY_TYPE = {
      folder: "Folders",
      html: "Pages",
      deck: "Pages",
      jsx: "Components",
      css: "Stylesheets",
      js: "Scripts",
      image: "Images",
      md: "Documents",
      json: "Data",
      other: "Other",
    };
    FILE_BROWSER_KIND_LABELS = {
      folder: "Folder",
      html: "HTML page",
      deck: "Slide deck",
      jsx: "Component",
      css: "Stylesheet",
      js: "Script",
      image: "Image",
      md: "Document",
      json: "Data file",
      other: "File",
    };
    fileBrowserSize = (input: unknown) =>
      typeof input === "number" && Number.isFinite(input) && input >= 0
        ? input
        : undefined;
    fileBrowserContentType = (items: unknown) =>
      typeof items === "string" && items.length > 0 ? items : undefined;
    visibleFileName = (input: string) =>
      input.replace(
        runtime.DOWNLOAD_NAME_IGNORABLE_PATTERN,
        (input2: string) => (input2 === "‌" || input2 === "‍" ? input2 : ""),
      );
    sanitizedFileName = (input: string) =>
      input
        .replace(runtime.DOWNLOAD_NAME_IGNORABLE_PATTERN, "")
        .replace(/(^|[\s.])\p{M}+/gu, "$1")
        .replace(/[\s.]+$/, "");
    fileNameCollator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    compareFileNames = (input: string, options: string) =>
      fileNameCollator.compare(input, options) ||
      (input < options ? -1 : input > options ? 1 : 0);
    MAX_FILE_BROWSER_TEXT_BYTES = 524288;
    folderFileCountCache = new WeakMap();
    DOWNLOAD_MIME_TYPES_BY_EXTENSION = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
      fig: "application/x-figma",
    };
  };
}

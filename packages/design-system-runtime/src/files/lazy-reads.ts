/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type { LazyReadState } from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesLazyReads(runtime: RuntimeBindings): () => void {
  var LAZY_READ_SKIPPED_CONTENT_KINDS: Set<Files.FileKind>;
  var listingRowIsSvg: (row: Files.FileListingRow | undefined) => boolean;
  function lazyReadLastDocumentPath(listing: Files.FileListingRow[]) {
    let documents = listing
        .flatMap((input: Files.FileListingRow) => {
          let value = (0, runtime.relativeProjectFilePath)(input.path);
          if (
            value !== undefined &&
            (0, runtime.isProjectContentPath)(input.path) &&
            (0, runtime.classifyDesignSystemFile)(value) === "doc"
          ) {
            return [
              {
                p: value,
                size: input.size,
              },
            ];
          } else {
            return [];
          }
        })
        .sort(
          (
            input: { p: string; size: number },
            options: { p: string; size: number },
          ): number => (input.p < options.p ? -1 : 1),
        ),
      count: number = 0;
    for (let value of documents) {
      if (
        value.size * 6 + 2 <= runtime.DESIGN_SYSTEM_INLINE_LIMITS.readme &&
        ++count >= runtime.MAX_DISPLAYED_DOCUMENTS
      ) {
        return value.p;
      }
    }
    return;
  }
  function updateLazyReadListing(
    lazy: LazyReadState,
    listing: Files.FileListingRow[],
  ): void {
    lazy.rows = new Map(
      listing.map((input: Files.FileListingRow) => [input.path, input]),
    );
    let lastDoc = lazyReadLastDocumentPath(listing);
    if (lastDoc === undefined) {
      delete lazy.lastDoc;
    } else {
      lazy.lastDoc = lastDoc;
    }
  }
  function lazyFileReadMode(
    lazy: LazyReadState,
    path: string,
  ): "read" | "held" | "skipped" {
    let relative = (0, runtime.relativeProjectFilePath)(path);
    if (relative === undefined || !(0, runtime.isProjectContentPath)(path)) {
      return "read";
    }
    let row = lazy.rows.get(path);
    if ((0, runtime.isTextFilePath)(relative)) {
      let value = (0, runtime.classifyDesignSystemFile)(relative);
      if (
        value === "doc"
          ? (lazy.lastDoc !== undefined && relative > lazy.lastDoc) ||
            (row?.size ?? 0) > runtime.DESIGN_SYSTEM_INLINE_LIMITS.readme
          : LAZY_READ_SKIPPED_CONTENT_KINDS.has(value) ||
            relative.startsWith(runtime.DESIGN_SYSTEM_PATHS.archivedDir)
      ) {
        return "skipped";
      }
      if (!listingRowIsSvg(row)) {
        return "read";
      }
    }
    if (
      (0, runtime.assetKindForPath)(relative) === "video" ||
      !(0, runtime.canUseStoragePointer)(relative) ||
      !(0, runtime.isPublishableFilePathModelFileTable)(relative)
    ) {
      return "read";
    } else {
      return "held";
    }
  }
  bindRuntimeValue(
    runtime,
    "LAZY_READ_SKIPPED_CONTENT_KINDS",
    () => LAZY_READ_SKIPPED_CONTENT_KINDS,
    (value) => {
      LAZY_READ_SKIPPED_CONTENT_KINDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lazyReadLastDocumentPath",
    () => lazyReadLastDocumentPath,
  );
  bindRuntimeValue(
    runtime,
    "updateLazyReadListing",
    () => updateLazyReadListing,
  );
  bindRuntimeValue(
    runtime,
    "listingRowIsSvg",
    () => listingRowIsSvg,
    (value) => {
      listingRowIsSvg = value;
    },
  );
  bindRuntimeValue(runtime, "lazyFileReadMode", () => lazyFileReadMode);
  return () => {
    LAZY_READ_SKIPPED_CONTENT_KINDS = new Set([
      "other",
      "componentOther",
      "componentSource",
    ]);
    listingRowIsSvg = (input: Files.FileListingRow | undefined): boolean =>
      (input?.contentType.split(";")[0] ?? "").trim().toLowerCase() ===
      "image/svg+xml";
  };
}

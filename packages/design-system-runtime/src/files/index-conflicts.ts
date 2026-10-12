/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  IndexMergeNotice,
  IndexPresentationPatch,
  IndexPresentationDelta,
  FileIndexDelta,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesIndexConflicts(
  runtime: RuntimeBindings,
): () => void {
  var HOT_CARRY_PROTOCOL_FIELD: string;
  var describeIndexConflicts: (
    paths: readonly string[],
    index: Files.FilesIndex,
  ) => string[];
  var isGeneratedIndexField: (path: string) => boolean;
  var indexPresentationField: (
    index: Files.FilesIndex,
    path: string,
  ) => string | undefined;
  function indexWithoutTitleAndDocs(index: Files.FilesIndex) {
    let { title: title, docs: docs, ...contentIndex } = index;
    return contentIndex;
  }
  function describeIndexConflictPath(
    path: string,
    index: Files.FilesIndex,
  ): string {
    let parts = path.split("/");
    if (parts[0] === "sections") {
      return (
        "the card title “" +
        (typeof index.sections?.[parts[1] ?? ""] === "string"
          ? index.sections[parts[1]]
          : (0, runtime.decodeFileIndexKey)(parts[1] ?? "")) +
        "”"
      );
    }
    if (parts[0] === "assetGroups" && parts[2] === "order") {
      return (
        "the order of " +
        (index.assetGroups?.[parts[1] ?? ""]?.name ??
          (0, runtime.decodeFileIndexKey)(parts[1] ?? ""))
      );
    }
    if (parts[0] === "assetGroups" && parts[2] === "tile") {
      return (
        "the tile size of " +
        (index.assetGroups?.[parts[1] ?? ""]?.name ??
          (0, runtime.decodeFileIndexKey)(parts[1] ?? ""))
      );
    }
    if (parts[0] === "assetGroups" && parts[2] === "files") {
      return (
        (0, runtime.decodeFileIndexKey)(parts[3] ?? "") +
        " in " +
        (index.assetGroups?.[parts[1] ?? ""]?.name ??
          (0, runtime.decodeFileIndexKey)(parts[1] ?? ""))
      );
    }
    if (parts[0] === "groups") {
      return "the order of the asset groups";
    }
    if (parts[0] === "title") {
      return "the name of the system";
    }
    if (parts[0] === "libraries") {
      return "the runtime libraries";
    }
    return "this design system’s list of its files";
  }
  function invalidAssetGroupOrders(
    index: Files.FilesIndex,
    knownGroupFiles: (name: string) => ReadonlySet<string> = () => new Set(),
  ) {
    let fixedOrders: Record<string, string[]> = {};
    for (let [value, value2] of Object.entries(index.assetGroups ?? {})) {
      if (typeof value2 !== "object" || value2 === null) {
        continue;
      }
      let value3 = Array.isArray(value2.order) ? value2.order : [];
      if (value3.length === 0) {
        continue;
      }
      let values = new Set([
          ...Object.values(value2.files ?? {})
            .map((input: Files.IndexBlobRecord) => input?.name)
            .filter((input: string): boolean => typeof input === "string"),
          ...knownGroupFiles(value2.name),
        ]),
        values2 = new Set(),
        value4 = value3.filter(
          (input: string) =>
            typeof input === "string" &&
            values.has(input) &&
            !values2.has(input) &&
            (values2.add(input), true),
        );
      if (!(0, runtime.mergeValuesEqual)(value4, value3)) {
        fixedOrders[value] = value4;
      }
    }
    return fixedOrders;
  }
  function indexAuthoredFieldsEqual(
    left: import("../contracts/files-core").CarriedFilesIndex,
    right: import("../contracts/files-core").CarriedFilesIndex,
  ) {
    let authoredFields = (
      input: import("../contracts/files-core").CarriedFilesIndex,
    ) =>
      Object.fromEntries(
        Object.entries(input).filter(
          ([input2]: [string, unknown]): boolean =>
            !isGeneratedIndexField(input2),
        ),
      );
    return (0, runtime.mergeValuesEqual)(
      authoredFields(left),
      authoredFields(right),
    );
  }
  function authoredIndexMergeConflicts(merge: IndexMergeNotice) {
    let conflicts = new Set(
      merge.conflicts.filter(
        (input: string) =>
          !input.startsWith("docs") && !isGeneratedIndexField(input),
      ),
    );
    if (
      !(0, runtime.mergeValuesEqual)(merge.mine.groups, merge.base.groups) &&
      !(0, runtime.isOrderSubsequence)(merge.mine.groups, merge.merged.groups)
    ) {
      conflicts.add("groups");
    }
    for (let [value, value2] of Object.entries(merge.mine.assetGroups ?? {})) {
      let value3 = merge.base.assetGroups?.[value]?.order,
        value4 = merge.merged.assetGroups?.[value]?.order;
      if (
        value3 !== undefined &&
        value4 !== undefined &&
        !(0, runtime.mergeValuesEqual)(value2.order, value3) &&
        !(0, runtime.isOrderSubsequence)(value2.order, value4)
      ) {
        conflicts.add("assetGroups/" + value + "/order");
      }
    }
    return [...conflicts];
  }
  function indexUndoForeignChanges(
    changes: FileIndexDelta[],
    conflicts: Iterable<string>,
    index: Files.FilesIndex,
  ) {
    let from: IndexPresentationPatch = {},
      to2: IndexPresentationPatch = {};
    for (let value of conflicts) {
      let value2 = /^assetGroups\/([^/]+)\/tile$/.exec(value)?.[1],
        value3 = value.startsWith("sections/") ? value.slice(9) : undefined,
        value4 = [...changes]
          .reverse()
          .find((input: FileIndexDelta) =>
            value3 !== undefined
              ? (input.from.sections !== undefined ||
                  input.to.sections !== undefined) &&
                input.from.sections?.[value3] !== input.to.sections?.[value3]
              : value2 !== undefined &&
                (input.from.assetGroups !== undefined ||
                  input.to.assetGroups !== undefined) &&
                input.from.assetGroups?.[value2]?.tile !==
                  input.to.assetGroups?.[value2]?.tile,
          );
      if (value4 === undefined) {
        continue;
      }
      if (value3 !== undefined) {
        (from.sections ??= {})[value3] = index.sections?.[value3];
        (to2.sections ??= {})[value3] = value4.to.sections?.[value3];
      } else if (value2 !== undefined) {
        (from.assetGroups ??= {})[value2] = {
          tile: index.assetGroups?.[value2]?.tile,
        };
        (to2.assetGroups ??= {})[value2] = {
          tile: value4.to.assetGroups?.[value2]?.tile,
        };
      }
    }
    return {
      from: from,
      to: to2,
    };
  }
  bindRuntimeValue(
    runtime,
    "indexWithoutTitleAndDocs",
    () => indexWithoutTitleAndDocs,
  );
  bindRuntimeValue(
    runtime,
    "HOT_CARRY_PROTOCOL_FIELD",
    () => HOT_CARRY_PROTOCOL_FIELD,
    (value) => {
      HOT_CARRY_PROTOCOL_FIELD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeIndexConflictPath",
    () => describeIndexConflictPath,
  );
  bindRuntimeValue(
    runtime,
    "describeIndexConflicts",
    () => describeIndexConflicts,
    (value) => {
      describeIndexConflicts = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "invalidAssetGroupOrders",
    () => invalidAssetGroupOrders,
  );
  bindRuntimeValue(
    runtime,
    "isGeneratedIndexField",
    () => isGeneratedIndexField,
    (value) => {
      isGeneratedIndexField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "indexAuthoredFieldsEqual",
    () => indexAuthoredFieldsEqual,
  );
  bindRuntimeValue(
    runtime,
    "authoredIndexMergeConflicts",
    () => authoredIndexMergeConflicts,
  );
  bindRuntimeValue(
    runtime,
    "indexUndoForeignChanges",
    () => indexUndoForeignChanges,
  );
  bindRuntimeValue(
    runtime,
    "indexPresentationField",
    () => indexPresentationField,
    (value) => {
      indexPresentationField = value;
    },
  );
  return () => {
    HOT_CARRY_PROTOCOL_FIELD = "books";
    describeIndexConflicts = (
      input: readonly string[],
      options: Files.FilesIndex,
    ) => [
      ...new Set(
        input.map((input2: string) =>
          describeIndexConflictPath(input2, options),
        ),
      ),
    ];
    isGeneratedIndexField = (input: string) =>
      runtime.FILE_MIGRATION_MARKER_FIELDS.includes(input.split("/")[0]);
    indexPresentationField = (input: Files.FilesIndex, options: string) => {
      if (options.startsWith("sections/")) {
        return input.sections?.[options.slice(9)];
      }
      let value = /^assetGroups\/([^/]+)\/tile$/.exec(options);
      if (value !== null) {
        return input.assetGroups?.[value[1]]?.tile;
      } else {
        return undefined;
      }
    };
  };
}

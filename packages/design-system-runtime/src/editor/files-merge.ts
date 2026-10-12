/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  JsonMergeValue,
  JsonRecord,
  MergeSchema,
  FileMergeOptions,
  FileMergeResult,
  FileMutation,
  FileMutationBatch,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installEditorFilesMerge(runtime: RuntimeBindings): () => void {
  var relativeProjectFilesForMerge: (
    files: Files.FileTable,
  ) => Map<string, string>;
  var isFilesMergeObject: (value: unknown) => value is JsonRecord;
  var isFilesMergeStringArray: (value: unknown) => value is string[];
  var supportsDroppedPaths: (document: { dropPaths?: unknown }) => boolean;
  function isOrderSubsequence(
    order: readonly string[],
    subset: readonly string[],
  ) {
    let values = new Set(subset),
      values2 = new Set(order);
    return (0, runtime.mergeValuesEqual)(
      order.filter((input: string) => values.has(input)),
      subset.filter((input: string) => values2.has(input)),
    );
  }
  function resolveFilesMergeSchema(
    schema: MergeSchema | undefined,
    key: string,
    ...context: JsonMergeValue[]
  ): MergeSchema {
    if (schema?.kind === "map") {
      let value2 =
        schema.keys !== undefined && Object.hasOwn(schema.keys, key)
          ? schema.keys[key]
          : undefined;
      if (value2 !== undefined) {
        return value2;
      }
      if (schema.of !== undefined) {
        return schema.of;
      }
    }
    let value = context.filter(
      (input: JsonMergeValue): boolean => input !== undefined,
    );
    if (value.length > 0 && value.every(isFilesMergeObject)) {
      return {
        kind: "map",
      };
    }
    if (value.length > 0 && value.every(isFilesMergeStringArray)) {
      return {
        kind: "list",
      };
    }
    return {
      kind: "leaf",
    };
  }
  function mergeFilesIndexKeepingLocal(
    base: JsonMergeValue,
    ours: JsonMergeValue,
    theirs: JsonMergeValue,
    schema: MergeSchema,
    path: string,
    kept: string[],
  ): JsonMergeValue {
    if (
      (0, runtime.mergeValuesEqual)(ours, base) ||
      (0, runtime.mergeValuesEqual)(theirs, ours)
    ) {
      return theirs;
    }
    if ((0, runtime.mergeValuesEqual)(theirs, base)) {
      return (0, runtime.cloneMergeValue)(ours);
    }
    if (
      schema.kind === "map" &&
      isFilesMergeObject(theirs) &&
      (isFilesMergeObject(base) || base === undefined) &&
      (isFilesMergeObject(ours) || ours === undefined) &&
      (isFilesMergeObject(base) || isFilesMergeObject(ours))
    ) {
      let value = base ?? {},
        value2 = ours ?? {},
        state: JsonRecord = {},
        callback = (input: JsonRecord, options: string) =>
          Object.hasOwn(input, options) ? input[options] : undefined;
      for (let value3 of new Set([
        ...Object.keys(theirs),
        ...Object.keys(value2),
        ...Object.keys(value),
      ])) {
        let value4 = mergeFilesIndexKeepingLocal(
          callback(value, value3),
          callback(value2, value3),
          callback(theirs, value3),
          resolveFilesMergeSchema(
            schema,
            value3,
            callback(value, value3),
            callback(value2, value3),
            callback(theirs, value3),
          ),
          path === "" ? value3 : path + "/" + value3,
          kept,
        );
        if (value4 !== undefined) {
          state[value3] = value4;
        }
      }
      return state;
    }
    if (
      schema.kind === "list" &&
      isFilesMergeStringArray(base) &&
      isFilesMergeStringArray(ours) &&
      isFilesMergeStringArray(theirs)
    ) {
      let value = (0, runtime.mergeOrderedStringList)(base, ours, theirs);
      if (!isOrderSubsequence(ours, value)) {
        kept.push(path);
      }
      return value;
    }
    kept.push(path);
    return theirs;
  }
  function mergeFilesIndex(
    base:
      | Partial<Files.FilesIndex>
      | import("../contracts/files-core").IndexPresentationPatch,
    ours:
      | Partial<Files.FilesIndex>
      | import("../contracts/files-core").IndexPresentationPatch,
    theirs: Files.FilesIndex,
  ) {
    let kept: string[] = [];
    return {
      index: mergeFilesIndexKeepingLocal(
        base as unknown as JsonRecord,
        ours as unknown as JsonRecord,
        theirs as unknown as JsonRecord,
        runtime.FILES_INDEX_MERGE_SCHEMA,
        "",
        kept,
      ) as unknown as Files.FilesIndex,
      kept: kept,
    };
  }
  function mergeDesignSystemFiles(
    currentFiles: Files.FileTable,
    title: string,
    beforeFiles: Files.FileTable,
    afterFiles: Files.FileTable,
    options: FileMergeOptions = {},
  ) {
    let beforeProjectFiles = relativeProjectFilesForMerge(beforeFiles),
      afterProjectFiles = relativeProjectFilesForMerge(afterFiles),
      currentProjectFiles = relativeProjectFilesForMerge(currentFiles),
      appliedPaths: string[] = [],
      localOnlyPaths: string[] = [],
      skippedPaths: string[] = [],
      nextProjectFiles = new Map(currentProjectFiles);
    for (let value of new Set([
      ...beforeProjectFiles.keys(),
      ...afterProjectFiles.keys(),
    ])) {
      let entry = beforeProjectFiles.get(value),
        entry2 = afterProjectFiles.get(value);
      if (entry === entry2 || options.excluded?.has(value) === true) {
        continue;
      }
      let entry3 = currentProjectFiles.get(value);
      if (entry3 === entry2) {
        continue;
      }
      let callback = (): void => {
          if (entry2 === undefined) {
            nextProjectFiles.delete(value);
          } else {
            nextProjectFiles.set(value, entry2);
          }
        },
        value2: boolean = options.stale?.(value) === true;
      if (value2 || entry3 !== entry) {
        let value3 =
          entry !== undefined && entry2 !== undefined && entry3 !== undefined
            ? (options.merge?.(value, entry, entry2, entry3) ?? null)
            : null;
        if (value3 !== null) {
          if (value3 === entry3) {
            continue;
          }
          appliedPaths.push(value);
          nextProjectFiles.set(value, value3);
          continue;
        }
        if (value2) {
          localOnlyPaths.push(value);
          callback();
          continue;
        }
        skippedPaths.push(value);
        continue;
      }
      appliedPaths.push(value);
      callback();
    }
    let rebaseIndex = (input: Files.FilesIndex) =>
        (options.theirIndex ?? []).reduce(
          (
            input2: Files.FilesIndex,
            options2:
              | import("../contracts/files-core").FileIndexDelta
              | import("../contracts/files-core").IndexPresentationDelta,
          ) => mergeFilesIndex(options2.from, options2.to, input2).index,
          input,
        ),
      removeExcludedIndexEntries = (input: Files.FilesIndex) => {
        if (options.excluded === undefined || options.excluded.size === 0) {
          return input;
        }
        let value = (0, runtime.cloneMergeValue)(input);
        for (let value2 of options.excluded) {
          let value3 = (0, runtime.assetFileIndexAddress)(value2);
          if (value3 === null) {
            continue;
          }
          let value4 =
            value3.group === null
              ? value.blobs
              : Object.hasOwn(value.assetGroups, value3.group)
                ? value.assetGroups[value3.group]?.files
                : undefined;
          if (value4 !== undefined) {
            delete value4[value3.key];
          }
        }
        return value;
      },
      beforeIndex = removeExcludedIndexEntries(
        options.earlierSide === "from"
          ? rebaseIndex((0, runtime.buildFilesIndex)(title, beforeFiles))
          : (0, runtime.buildFilesIndex)(title, beforeFiles),
      ),
      afterIndex = removeExcludedIndexEntries(
        options.earlierSide === "to"
          ? rebaseIndex((0, runtime.buildFilesIndex)(title, afterFiles))
          : (0, runtime.buildFilesIndex)(title, afterFiles),
      ),
      indexChanged: boolean = false,
      keptIndexPaths: string[] = [],
      nextFiles: Files.FileTable;
    if (
      !(0, runtime.mergeValuesEqual)(
        filesIndexWithoutDocumentMetadata(beforeIndex),
        filesIndexWithoutDocumentMetadata(afterIndex),
      )
    ) {
      let value = (0, runtime.buildFilesIndex)(title, currentFiles),
        { index: value2, kept: value3 } = mergeFilesIndex(
          beforeIndex,
          afterIndex,
          value,
        );
      keptIndexPaths = value3.filter(
        (input: string) => !input.startsWith("docs") && input !== "title",
      );
      indexChanged = !(0, runtime.mergeValuesEqual)(
        filesIndexWithoutDocumentMetadata(value2),
        filesIndexWithoutDocumentMetadata(value),
      );
      let entries = new Map<string, string>();
      for (let [value4, value5] of nextProjectFiles) {
        entries.set((0, runtime.projectFilePath)(value4), value5);
      }
      nextFiles = indexChanged
        ? {
            ...(0, runtime.restoreFilesFromIndex)(value2, entries).content
              .files,
          }
        : removeDroppedFiles(
            currentFiles,
            currentProjectFiles,
            nextProjectFiles,
          );
      return {
        next: nextFiles,
        viaIndex: indexChanged,
        files: appliedPaths.sort(),
        localOnly: localOnlyPaths.sort(),
        skipped: skippedPaths.sort(),
        index: indexChanged,
        indexKept: keptIndexPaths,
        empty:
          appliedPaths.length + localOnlyPaths.length === 0 && !indexChanged,
      };
    }
    nextFiles = removeDroppedFiles(
      currentFiles,
      currentProjectFiles,
      nextProjectFiles,
    );
    return {
      next: nextFiles,
      viaIndex: false,
      files: appliedPaths.sort(),
      localOnly: localOnlyPaths.sort(),
      skipped: skippedPaths.sort(),
      index: false,
      indexKept: keptIndexPaths,
      empty: appliedPaths.length + localOnlyPaths.length === 0,
    };
  }
  function filesIndexWithoutDocumentMetadata(index: Files.FilesIndex) {
    let { docs: docs, title: title, ...rest } = index;
    return rest;
  }
  function removeDroppedFiles(
    files: Files.FileTable,
    previousFiles: ReadonlyMap<string, string>,
    nextFiles: ReadonlyMap<string, string>,
  ) {
    let result = {
      ...files,
    };
    for (let value of previousFiles.keys()) {
      if (!nextFiles.has(value)) {
        delete result[value];
      }
    }
    for (let [value, value2] of nextFiles) {
      result[value] = value2;
    }
    return result;
  }
  function changedProjectFilePaths(
    before: Files.FileTable,
    after: Files.FileTable,
    context: string,
  ) {
    let beforeFiles = relativeProjectFilesForMerge(before),
      afterFiles = relativeProjectFilesForMerge(after),
      changed = [];
    for (let value of new Set([...beforeFiles.keys(), ...afterFiles.keys()])) {
      if (beforeFiles.get(value) !== afterFiles.get(value)) {
        changed.push(value);
      }
    }
    return {
      files: changed.sort(),
      index: !(0, runtime.mergeValuesEqual)(
        filesIndexWithoutDocumentMetadata(
          (0, runtime.buildFilesIndex)(context, before),
        ),
        filesIndexWithoutDocumentMetadata(
          (0, runtime.buildFilesIndex)(context, after),
        ),
      ),
    };
  }
  function createFileMutationBatch<Mutation extends FileMutation>(
    delay: number = 200,
  ): FileMutationBatch<Mutation> {
    let items: Mutation[] = [],
      items2: Mutation[] = [],
      values = new Set<() => void>(),
      callback = (): void => {
        for (let value of [...values]) {
          value();
        }
      };
    return {
      exec(input: Mutation): void {
        if (input.canDo?.() === false) {
          return;
        }
        input.do();
        items.push(input);
        if (items.length > delay) {
          items.shift();
        }
        items2.length = 0;
        callback();
      },
      seed(input: Mutation): void {
        items.push(input);
        if (items.length > delay) {
          items.shift();
        }
        items2.length = 0;
        callback();
      },
      undo(): void {
        let value = items[items.length - 1];
        if (!value || value.canUndo?.() === false) {
          return;
        }
        items.pop();
        value.undo();
        items2.push(value);
        callback();
      },
      redo(): void {
        let value = items2[items2.length - 1];
        if (!value || value.canDo?.() === false) {
          return;
        }
        items2.pop();
        value.do();
        items.push(value);
        callback();
      },
      canUndo: (): boolean => items.length > 0,
      canRedo: (): boolean => items2.length > 0,
      redoDepth: () => items2.length,
      clear(): void {
        if (items.length === 0 && items2.length === 0) {
          return;
        }
        items.length = 0;
        items2.length = 0;
        callback();
      },
      subscribe(input: () => void) {
        values.add(input);
        return () => void values.delete(input);
      },
      prune(input: (mutation: Mutation) => boolean): number {
        let index: number = 0;
        for (let value of [items, items2]) {
          for (let value2: number = value.length - 1; value2 >= 0; value2--) {
            if (input(value[value2])) {
              value.splice(value2, 1);
              index++;
            }
          }
        }
        if (index > 0) {
          callback();
        }
        return index;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "relativeProjectFilesForMerge",
    () => relativeProjectFilesForMerge,
    (value) => {
      relativeProjectFilesForMerge = value;
    },
  );
  bindRuntimeValue(runtime, "isOrderSubsequence", () => isOrderSubsequence);
  bindRuntimeValue(
    runtime,
    "isFilesMergeObject",
    () => isFilesMergeObject,
    (value) => {
      isFilesMergeObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFilesMergeStringArray",
    () => isFilesMergeStringArray,
    (value) => {
      isFilesMergeStringArray = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveFilesMergeSchema",
    () => resolveFilesMergeSchema,
  );
  bindRuntimeValue(
    runtime,
    "mergeFilesIndexKeepingLocal",
    () => mergeFilesIndexKeepingLocal,
  );
  bindRuntimeValue(runtime, "mergeFilesIndex", () => mergeFilesIndex);
  bindRuntimeValue(
    runtime,
    "mergeDesignSystemFiles",
    () => mergeDesignSystemFiles,
  );
  bindRuntimeValue(
    runtime,
    "filesIndexWithoutDocumentMetadata",
    () => filesIndexWithoutDocumentMetadata,
  );
  bindRuntimeValue(runtime, "removeDroppedFiles", () => removeDroppedFiles);
  bindRuntimeValue(
    runtime,
    "changedProjectFilePaths",
    () => changedProjectFilePaths,
  );
  bindRuntimeValue(
    runtime,
    "supportsDroppedPaths",
    () => supportsDroppedPaths,
    (value) => {
      supportsDroppedPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFileMutationBatch",
    () => createFileMutationBatch,
  );
  return () => {
    relativeProjectFilesForMerge = (files: Files.FileTable) => {
      let entries = new Map<string, string>();
      for (let [value, value2] of (0, runtime.projectFilesForSave)(files)) {
        entries.set((0, runtime.relativeProjectFilePath)(value)!, value2);
      }
      return entries;
    };
    isFilesMergeObject = (value: unknown): value is JsonRecord =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    isFilesMergeStringArray = (value: unknown): value is string[] =>
      Array.isArray(value) &&
      value.every((input: unknown): boolean => typeof input === "string");
    supportsDroppedPaths = (document2: { dropPaths?: unknown }): boolean =>
      typeof document2.dropPaths === "function";
  };
}

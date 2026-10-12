/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type { FileSha } from "../deck-contracts";
import type {
  MergeMapSchema,
  MergeObject,
  MergeSchema,
} from "./document-merge";

/** Every index document: a numeric format version next to arbitrary entries. */
export type IndexDocument = MergeObject & { v: number };

/** The deck index as first created, before metadata normalisation adds the title. */
export type EmptyDeckIndex = {
  v: number;
  order: string[];
  sections: MergeObject;
  faces: MergeObject;
  designSystems: MergeObject[];
  attachments: MergeObject;
};

/** Why an index file could not be used. */
export type IndexFileErrorCode = "unreadable" | "newer_version" | "not_found";

/** Error raised when the index file is missing, damaged or written by a newer editor. */
export interface IndexFileErrorInstance extends Error {
  code: IndexFileErrorCode;
}
export interface IndexFileErrorConstructor {
  new (code: IndexFileErrorCode, message: string): IndexFileErrorInstance;
  readonly prototype: IndexFileErrorInstance;
}

/** What the index store needs from a files port: reading one file as text. */
export interface IndexTextPort {
  readText(path: string): Promise<{ text: string; sha256: string }>;
}

export interface IndexFileStoreOptions<T extends IndexDocument> {
  port: IndexTextPort;
  path: string;
  schema: MergeSchema;
  /** A fresh document, used for a missing file and to fill sections the stored file lacks. */
  empty(): T;
  /** Highest format version this editor can read (defaults to the version of `empty()`). */
  maxVersion?: number;
  externalMembers?: (path: string) => Iterable<string> | undefined;
}

/** Called whenever the store becomes dirty, with a serializer for the pending text and the base sha it applies to. */
export type IndexDirtyListener = (
  path: string,
  serialize: () => string,
  baseSha: FileSha,
) => void;

/** One index file held in memory: the live document, the last saved base to merge against, and the dirty flag. */
export interface IndexFileStore<T extends IndexDocument> {
  path: string;
  parse(text: string): T;
  load(): Promise<T>;
  loadText(text: string, sha: FileSha): T;
  init(initial?: T): T;
  get(): T;
  base(): T;
  baseSha(): FileSha;
  dirty(): boolean;
  lastConflicts(): string[];
  update(mutate: (index: T) => void): void;
  /** Three-way merges a newer remote document into the live one. */
  mergeFrom(theirs: T): T;
  serialize(): string;
  bind(listener: IndexDirtyListener | undefined): void;
  markSaved(text: string, sha: FileSha): void;
  /** Re-reads the file and merges it; resolves to the paths that conflicted. */
  reloadAndMerge(): Promise<string[]>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    DECK_INDEX_MERGE_SCHEMA: MergeMapSchema;
    emptyDeckIndex: () => EmptyDeckIndex;
    /** Copy of a JSON document with keys sorted for stable file text. */
    sortIndexDocumentKeys: (value: unknown, versionFirst?: boolean) => unknown;
    serializeIndexDocument: (index: unknown) => string;
    IndexFileError: IndexFileErrorConstructor;
    createIndexFileStore: <T extends IndexDocument>(
      options: IndexFileStoreOptions<T>,
    ) => IndexFileStore<T>;
  }
}

export function installFilesIndexStore(runtime: RuntimeBindings): () => void {
  var DECK_INDEX_MERGE_SCHEMA: RuntimeBindings["DECK_INDEX_MERGE_SCHEMA"];
  var emptyDeckIndex: RuntimeBindings["emptyDeckIndex"];
  var IndexFileError: RuntimeBindings["IndexFileError"];
  function sortIndexDocumentKeys(
    value: unknown,
    versionFirst?: boolean,
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((input) => sortIndexDocumentKeys(input, false));
    }
    if (!(0, runtime.isMergeObject)(value)) {
      return value;
    }
    let keys = Object.keys(value)
      .filter((input) => value[input] !== undefined)
      .sort();
    if (versionFirst) {
      let value2 = keys.indexOf("v");
      if (value2 > 0) {
        keys.splice(value2, 1);
        keys.unshift("v");
      }
    }
    let sorted: MergeObject = {};
    for (let value2 of keys)
      (0, runtime.setMergePropertySafely)(
        sorted,
        value2,
        sortIndexDocumentKeys(value[value2], false),
      );
    return sorted;
  }
  function serializeIndexDocument(index: unknown): string {
    return (
      JSON.stringify(sortIndexDocumentKeys(index, true), null, 2) +
      `
`
    );
  }
  function createIndexFileStore<T extends IndexDocument>(
    input: IndexFileStoreOptions<T>,
  ): IndexFileStore<T> {
    let value = input.empty(),
      value2 = (0, runtime.cloneMergeValue)(value),
      value3: FileSha = null,
      value4: IndexDirtyListener | undefined,
      items: string[] = [],
      flag = false;
    function value5(input2: string): T {
      let value6: unknown;
      try {
        value6 = JSON.parse(input2);
      } catch {
        throw new IndexFileError("unreadable", input.path + " is not JSON");
      }
      if (!(0, runtime.isMergeObject)(value6) || typeof value6.v !== "number") {
        throw new IndexFileError(
          "unreadable",
          input.path + " has no numeric v",
        );
      }
      let value7 = input.empty();
      if (value6.v > (input.maxVersion ?? value7.v)) {
        throw new IndexFileError(
          "newer_version",
          input.path +
            " was written by a newer editor (v " +
            String(value6.v) +
            ")",
        );
      }
      for (let [value8, value9] of Object.entries<unknown>(value7)) {
        if (value8 === "v") {
          continue;
        }
        let value10 = Array.isArray(value9)
          ? "array"
          : (0, runtime.isMergeObject)(value9)
            ? "object"
            : undefined;
        if (value10 === undefined) {
          continue;
        }
        let value11 = value6[value8],
          value12 =
            input.schema.kind === "map"
              ? input.schema.keys?.[value8]
              : undefined;
        if (
          value12?.kind === "records" &&
          value10 === "array" &&
          (0, runtime.isMergeObject)(value11)
        ) {
          let value13 = (0, runtime.keyedListToMergeObject)(
            value11,
            value12.by,
          );
          value6[value8] = Object.keys(value13).map((input3) => value13[input3]);
          continue;
        }
        if (
          (value10 === "array" && !Array.isArray(value11)) ||
          (value10 === "object" && !(0, runtime.isMergeObject)(value11))
        ) {
          value6[value8] = value9;
        }
      }
      return value6 as T;
    }
    let callback = () => {
        flag = true;
        value4?.(input.path, () => state.serialize(), value3);
      },
      state: IndexFileStore<T> = {
        path: input.path,
        parse: value5,
        async load(): Promise<T> {
          let value6: { text: string; sha256: string };
          try {
            value6 = await input.port.readText(input.path);
          } catch (value7: unknown) {
            throw new IndexFileError(
              "not_found",
              input.path +
                ": " +
                (value7 instanceof Error
                  ? value7.message
                  : String(
                      (value7 as { message?: unknown } | null | undefined)
                        ?.message ?? value7,
                    )),
            );
          }
          value = value5(value6.text);
          value2 = (0, runtime.cloneMergeValue)(value);
          value3 = value6.sha256;
          flag = false;
          return value;
        },
        loadText(input2, options) {
          value = value5(input2);
          value2 = (0, runtime.cloneMergeValue)(value);
          value3 = options;
          flag = false;
          return value;
        },
        init(input2) {
          value = input2 ?? input.empty();
          value2 = input.empty();
          value3 = null;
          callback();
          return value;
        },
        get: () => value,
        base: () => value2,
        baseSha: () => value3,
        dirty: () => flag,
        lastConflicts: () => [...items],
        update(input2) {
          input2(value);
          callback();
        },
        mergeFrom(input2) {
          items = [];
          value = (0, runtime.preserveFileMigrationMarkers)(
            (0, runtime.mergeDocumentValues)(
              value2,
              value,
              input2,
              input.schema,
              {
                conflicts: items,
                externalMembers: input.externalMembers,
              },
            ),
            input2,
            value2,
          ) as T;
          value2 = (0, runtime.cloneMergeValue)(input2);
          return value;
        },
        serialize: () =>
          serializeIndexDocument(
            (0, runtime.preserveFileMigrationMarkers)(value, value2),
          ),
        bind(input2) {
          value4 = input2;
        },
        markSaved(input2, options) {
          try {
            value2 = JSON.parse(input2);
          } catch {
            value2 = (0, runtime.cloneMergeValue)(value);
          }
          value3 = options;
          flag = !(0, runtime.mergeValuesEqual)(value2, value);
        },
        async reloadAndMerge(): Promise<string[]> {
          let value6 = await input.port.readText(input.path);
          if (value6.sha256 === value3) {
            return [];
          }
          state.mergeFrom(value5(value6.text));
          value3 = value6.sha256;
          flag = !(0, runtime.mergeValuesEqual)(value2, value);
          if (flag) {
            value4?.(input.path, () => state.serialize(), value3);
          }
          return [...items];
        },
      };
    return state;
  }
  bindRuntimeValue(
    runtime,
    "DECK_INDEX_MERGE_SCHEMA",
    () => DECK_INDEX_MERGE_SCHEMA,
    (value) => {
      DECK_INDEX_MERGE_SCHEMA = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyDeckIndex",
    () => emptyDeckIndex,
    (value) => {
      emptyDeckIndex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sortIndexDocumentKeys",
    () => sortIndexDocumentKeys,
  );
  bindRuntimeValue(
    runtime,
    "serializeIndexDocument",
    () => serializeIndexDocument,
  );
  bindRuntimeValue(
    runtime,
    "IndexFileError",
    () => IndexFileError,
    (value) => {
      IndexFileError = value;
    },
  );
  bindRuntimeValue(runtime, "createIndexFileStore", () => createIndexFileStore);
  return () => {
    DECK_INDEX_MERGE_SCHEMA = {
      kind: "map",
      keys: {
        order: {
          kind: "list",
        },
        sections: {
          kind: "map",
          of: {
            kind: "map",
            of: {
              kind: "leaf",
            },
          },
        },
        faces: {
          kind: "map",
          of: {
            kind: "map",
            of: {
              kind: "leaf",
            },
          },
        },
        designSystems: {
          kind: "records",
          by: "namespace",
        },
        attachments: {
          kind: "map",
          of: {
            kind: "map",
            of: {
              kind: "leaf",
            },
          },
        },
      },
    };
    emptyDeckIndex = () => ({
      v: 4,
      order: [],
      sections: {},
      faces: {},
      designSystems: [],
      attachments: {},
    });
    IndexFileError = class IndexFileError extends Error {
      declare name: string;
      code: IndexFileErrorCode;
      constructor(input: IndexFileErrorCode, options: string) {
        super(options);
        this.code = input;
        this.name = "IndexFileError";
      }
    };
  };
}

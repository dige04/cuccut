/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type { FilePublishInput } from "./publish-inputs";

/** A plain JSON object as seen by the document merge (arrays and null are excluded). */
export type MergeObject = Record<string, unknown>;

/** Schema node: values are compared and replaced as a whole. */
export interface MergeLeafSchema {
  kind: "leaf";
}
/** Schema node: an ordered list of strings merged by position; `membersOf` names the sibling map whose keys bound the list. */
export interface MergeListSchema {
  kind: "list";
  membersOf?: string;
}
/** Schema node: an object merged key by key, with per-key schemas in `keys` and a default in `of`. */
export interface MergeMapSchema {
  kind: "map";
  keys?: Record<string, MergeSchema>;
  of?: MergeSchema;
}
/** Schema node: a list of records identified by the field `by`, merged as a map keyed on that field. */
export interface MergeRecordsSchema {
  kind: "records";
  by: string;
}
/** Describes how each node of a merged document is combined. */
export type MergeSchema =
  | MergeLeafSchema
  | MergeListSchema
  | MergeMapSchema
  | MergeRecordsSchema;

/** Callbacks and sinks of one merge run. */
export interface MergeOptions {
  /** Receives the path of every leaf both sides changed differently. */
  conflicts?: string[];
  /** Members that still exist outside the document for the list at `path`; others are dropped. */
  externalMembers?: (path: string) => Iterable<string> | undefined;
}

/** A file body as handed to the files port; `undefined` stands for a body that was never provided. */
export type FileInput = FilePublishInput | undefined;

declare module "../bindings" {
  interface RuntimeBindings {
    /** Text of a file input, `null` for a deletion, `undefined` for a non-text body. */
    fileInputText: (input: FileInput) => string | null | undefined;
    /** Index fields that record a file-format conversion and must survive merges. */
    FILE_MIGRATION_MARKER_FIELDS: string[];
    /** Copies the migration markers missing from `index` over from the first source that has them. */
    preserveFileMigrationMarkers: (
      index: unknown,
      ...sources: unknown[]
    ) => unknown;
    isMergeObject: (value: unknown) => value is MergeObject;
    isStringArray: (value: unknown) => value is string[];
    ownMergeProperty: (object: MergeObject | undefined, key: string) => unknown;
    /** Assigns a property without triggering the `__proto__` setter. */
    setMergePropertySafely: (
      object: MergeObject,
      key: string,
      value: unknown,
    ) => void;
    /** Deep structural equality over JSON values (undefined properties are ignored). */
    mergeValuesEqual: (left: unknown, right: unknown) => boolean;
    cloneMergeValue: <T>(value: T) => T;
    LEAF_MERGE_SCHEMA: MergeLeafSchema;
    resolveChildMergeSchema: (
      schema: MergeSchema | undefined,
      key: string,
      ...values: unknown[]
    ) => MergeSchema;
    mergeLeafValue: (
      base: unknown,
      mine: unknown,
      theirs: unknown,
      path: string,
      options: MergeOptions,
    ) => unknown;
    uniqueMergeList: <T>(items: readonly T[]) => T[];
    mergeOrderedStringList: (
      base: readonly string[],
      mine: readonly string[],
      theirs: readonly string[],
      externalMembers?: Iterable<string>,
    ) => string[];
    MAX_MERGE_KEYED_LIST_ITEMS: number;
    keyedListToMergeObject: (
      value: unknown,
      idKey: string,
    ) => Record<string, MergeObject>;
    mergeObjectValues: (
      base: MergeObject | undefined,
      mine: MergeObject,
      theirs: MergeObject,
      schema: MergeSchema,
      path: string,
      options: MergeOptions,
    ) => MergeObject;
    mergeDocumentValues: (
      base: unknown,
      mine: unknown,
      theirs: unknown,
      schema: MergeSchema,
      options?: MergeOptions,
    ) => unknown;
  }
}

export function installFilesDocumentMerge(
  runtime: RuntimeBindings,
): () => void {
  var FILE_MIGRATION_MARKER_FIELDS: RuntimeBindings["FILE_MIGRATION_MARKER_FIELDS"];
  var isMergeObject: RuntimeBindings["isMergeObject"];
  var isStringArray: RuntimeBindings["isStringArray"];
  var ownMergeProperty: RuntimeBindings["ownMergeProperty"];
  var cloneMergeValue: RuntimeBindings["cloneMergeValue"];
  var LEAF_MERGE_SCHEMA: RuntimeBindings["LEAF_MERGE_SCHEMA"];
  var MAX_MERGE_KEYED_LIST_ITEMS: RuntimeBindings["MAX_MERGE_KEYED_LIST_ITEMS"];
  function fileInputText(input: FileInput): string | null | undefined {
    if (input === null) {
      return null;
    }
    let content: unknown =
      typeof input === "object" &&
      !(typeof Blob !== "undefined" && input instanceof Blob)
        ? (input as { content?: unknown }).content
        : input;
    if (typeof content === "string") {
      return content;
    } else {
      return undefined;
    }
  }
  function preserveFileMigrationMarkers(
    index: unknown,
    ...sources: unknown[]
  ): unknown {
    if (!isMergeObject(index)) {
      return index;
    }
    let updatedIndex: MergeObject = index;
    for (let value of FILE_MIGRATION_MARKER_FIELDS) {
      if (isMergeObject(updatedIndex[value])) {
        continue;
      }
      let value2 = sources.find(
        (input): input is MergeObject =>
          isMergeObject(input) && isMergeObject(input[value]),
      );
      if (value2 !== undefined) {
        updatedIndex = {
          ...updatedIndex,
          [value]: cloneMergeValue(value2[value]),
        };
      }
    }
    return updatedIndex;
  }
  function setMergePropertySafely(
    object: MergeObject,
    key: string,
    value: unknown,
  ): void {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        value: value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      object[key] = value;
    }
  }
  function mergeValuesEqual(left: unknown, right: unknown): boolean {
    if (left === right) {
      return true;
    }
    if (Array.isArray(left)) {
      return (
        Array.isArray(right) &&
        left.length === right.length &&
        left.every((input, options) => mergeValuesEqual(input, right[options]))
      );
    }
    if (isMergeObject(left)) {
      if (!isMergeObject(right)) {
        return false;
      }
      let value = Object.keys(left).filter((input) => left[input] !== undefined),
        value2 = Object.keys(right).filter(
          (input) => right[input] !== undefined,
        );
      return (
        value.length === value2.length &&
        value.every(
          (input) =>
            Object.hasOwn(right, input) &&
            mergeValuesEqual(left[input], right[input]),
        )
      );
    }
    return false;
  }
  function resolveChildMergeSchema(
    schema: MergeSchema | undefined,
    key: string,
    ...values: unknown[]
  ): MergeSchema {
    if (schema?.kind === "map") {
      let value =
        schema.keys !== undefined && Object.hasOwn(schema.keys, key)
          ? schema.keys[key]
          : undefined;
      if (value) {
        return value;
      }
      if (schema.of) {
        return schema.of;
      }
    }
    let presentValues = values.filter((input) => input !== undefined);
    if (presentValues.length > 0 && presentValues.every(isMergeObject)) {
      return {
        kind: "map",
      };
    }
    if (presentValues.length > 0 && presentValues.every(isStringArray)) {
      return {
        kind: "list",
      };
    }
    return LEAF_MERGE_SCHEMA;
  }
  function mergeLeafValue(
    base: unknown,
    mine: unknown,
    theirs: unknown,
    path: string,
    options: MergeOptions,
  ): unknown {
    if (mergeValuesEqual(mine, base)) {
      return theirs;
    }
    if (mergeValuesEqual(theirs, base) || mergeValuesEqual(mine, theirs)) {
      return mine;
    }
    options.conflicts?.push(path);
    return theirs;
  }
  function uniqueMergeList<T>(items: readonly T[]): T[] {
    let seen = new Set<T>();
    return items.filter((input) =>
      seen.has(input) ? false : (seen.add(input), true),
    );
  }
  function mergeOrderedStringList(
    base: readonly string[],
    mine: readonly string[],
    theirs: readonly string[],
    externalMembers?: Iterable<string>,
  ): string[] {
    let baseOrder = uniqueMergeList(base),
      mineOrder = uniqueMergeList(mine),
      theirOrder = uniqueMergeList(theirs),
      mergedOrder: string[];
    if (mergeValuesEqual(theirOrder, baseOrder)) {
      mergedOrder = [...mineOrder];
    } else if (mergeValuesEqual(mineOrder, baseOrder)) {
      mergedOrder = [...theirOrder];
    } else {
      let values = new Set(baseOrder),
        values2 = new Set(theirOrder),
        values3 = new Set(mineOrder),
        value = mergeValuesEqual(
          theirOrder.filter((input) => values.has(input)),
          baseOrder.filter((input) => values2.has(input)),
        ),
        value2 = mergeValuesEqual(
          mineOrder.filter((input) => values.has(input)),
          baseOrder.filter((input) => values3.has(input)),
        ),
        value3 = value && !value2,
        [value4, value5]: [string[], string[]] = value3
          ? [mineOrder, theirOrder]
          : [theirOrder, mineOrder],
        values4 = new Set(value5),
        values5 = new Set(value4);
      mergedOrder = value4.filter(
        (input) => !(values.has(input) && !values4.has(input)),
      );
      value5.forEach((input, options) => {
        if (values.has(input) || values5.has(input)) {
          return;
        }
        let value6 =
            (value3 || !value) &&
            value5
              .slice(options + 1)
              .every((input2) => !values.has(input2)),
          value7 = value6 ? mergedOrder.length : 0;
        for (let value8 = options - 1; !value6 && value8 >= 0; value8--) {
          let value9 = mergedOrder.indexOf(value5[value8]!);
          if (value9 >= 0) {
            value7 = value9 + 1;
            break;
          }
        }
        mergedOrder.splice(value7, 0, input);
      });
    }
    if (externalMembers !== undefined) {
      let value =
        externalMembers instanceof Set
          ? (externalMembers as Set<string>)
          : new Set(externalMembers);
      mergedOrder = mergedOrder.filter((input) => value.has(input));
      let values = new Set(mergedOrder);
      for (let value2 of value)
        if (!values.has(value2)) {
          mergedOrder.push(value2);
        }
    }
    return mergedOrder;
  }
  function keyedListToMergeObject(
    value: unknown,
    idKey: string,
  ): Record<string, MergeObject> {
    let items: unknown[] = Array.isArray(value)
        ? value
        : isMergeObject(value)
          ? Object.keys(value)
              .filter((input) => Object.hasOwn(value, input))
              .map((input) => value[input])
          : [],
      byId: Record<string, MergeObject> = Object.create(null);
    for (let value2 of items)
      if (
        isMergeObject(value2) &&
        typeof value2[idKey] === "string" &&
        value2[idKey] !== "" &&
        Object.keys(byId).length < MAX_MERGE_KEYED_LIST_ITEMS
      ) {
        byId[value2[idKey] as string] = value2;
      }
    return byId;
  }
  function mergeObjectValues(
    base: MergeObject | undefined,
    mine: MergeObject,
    theirs: MergeObject,
    schema: MergeSchema,
    path: string,
    options: MergeOptions,
  ): MergeObject {
    let merged: MergeObject = {},
      keys = uniqueMergeList([...Object.keys(theirs), ...Object.keys(mine)]),
      deletedPaths: { key: string; schema: MergeListSchema }[] = [];
    for (let value of keys) {
      let [items, items2, items3]: [unknown, unknown, unknown] = [
          ownMergeProperty(base, value),
          ownMergeProperty(mine, value),
          ownMergeProperty(theirs, value),
        ],
        value2 = items !== undefined,
        value3 = items2 !== undefined,
        value4 = items3 !== undefined;
      if (value2 && (!value3 || !value4)) {
        continue;
      }
      if (!value3) {
        setMergePropertySafely(merged, value, cloneMergeValue(items3));
        continue;
      }
      if (!value4) {
        setMergePropertySafely(merged, value, cloneMergeValue(items2));
        continue;
      }
      let value5 = resolveChildMergeSchema(
          schema,
          value,
          items,
          items2,
          items3,
        ),
        value6 = path === "" ? value : path + "/" + value;
      if (
        value5.kind === "map" &&
        isMergeObject(items2) &&
        isMergeObject(items3)
      ) {
        setMergePropertySafely(
          merged,
          value,
          mergeObjectValues(
            isMergeObject(items) ? items : undefined,
            items2,
            items3,
            value5,
            value6,
            options,
          ),
        );
      } else if (value5.kind === "records") {
        let value7 = mergeObjectValues(
          keyedListToMergeObject(items, value5.by),
          keyedListToMergeObject(items2, value5.by),
          keyedListToMergeObject(items3, value5.by),
          {
            kind: "map",
            of: LEAF_MERGE_SCHEMA,
          },
          value6,
          options,
        );
        setMergePropertySafely(
          merged,
          value,
          Object.keys(value7)
            .slice(0, MAX_MERGE_KEYED_LIST_ITEMS)
            .map((input) => value7[input]),
        );
      } else if (
        value5.kind === "list" &&
        isStringArray(items2) &&
        isStringArray(items3)
      ) {
        setMergePropertySafely(
          merged,
          value,
          mergeOrderedStringList(
            isStringArray(items) ? items : [],
            items2,
            items3,
          ),
        );
        deletedPaths.push({
          key: value,
          schema: value5,
        });
      } else {
        setMergePropertySafely(
          merged,
          value,
          cloneMergeValue(
            mergeLeafValue(items, items2, items3, value6, options),
          ),
        );
      }
    }
    for (let { key: value, schema: value2 } of deletedPaths) {
      let value3 = path === "" ? value : path + "/" + value,
        value4 =
          value2.membersOf !== undefined
            ? ownMergeProperty(merged, value2.membersOf)
            : undefined,
        value5 = isMergeObject(value4)
          ? new Set(Object.keys(value4))
          : options.externalMembers?.(value3),
        value6 = ownMergeProperty(merged, value) as string[];
      if (value5 !== undefined) {
        setMergePropertySafely(
          merged,
          value,
          mergeOrderedStringList(value6, value6, value6, value5),
        );
      }
    }
    return merged;
  }
  function mergeDocumentValues(
    base: unknown,
    mine: unknown,
    theirs: unknown,
    schema: MergeSchema,
    options: MergeOptions = {},
  ): unknown {
    if (schema.kind === "map" && isMergeObject(mine) && isMergeObject(theirs)) {
      return mergeObjectValues(
        isMergeObject(base) ? base : undefined,
        mine,
        theirs,
        schema,
        "",
        options,
      );
    }
    if (
      schema.kind === "list" &&
      isStringArray(mine) &&
      isStringArray(theirs)
    ) {
      return mergeOrderedStringList(
        isStringArray(base) ? base : [],
        mine,
        theirs,
        options.externalMembers?.(""),
      );
    }
    return cloneMergeValue(mergeLeafValue(base, mine, theirs, "", options));
  }
  bindRuntimeValue(runtime, "fileInputText", () => fileInputText);
  bindRuntimeValue(
    runtime,
    "FILE_MIGRATION_MARKER_FIELDS",
    () => FILE_MIGRATION_MARKER_FIELDS,
    (value) => {
      FILE_MIGRATION_MARKER_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveFileMigrationMarkers",
    () => preserveFileMigrationMarkers,
  );
  bindRuntimeValue(
    runtime,
    "isMergeObject",
    () => isMergeObject,
    (value) => {
      isMergeObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isStringArray",
    () => isStringArray,
    (value) => {
      isStringArray = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ownMergeProperty",
    () => ownMergeProperty,
    (value) => {
      ownMergeProperty = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setMergePropertySafely",
    () => setMergePropertySafely,
  );
  bindRuntimeValue(runtime, "mergeValuesEqual", () => mergeValuesEqual);
  bindRuntimeValue(
    runtime,
    "cloneMergeValue",
    () => cloneMergeValue,
    (value) => {
      cloneMergeValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEAF_MERGE_SCHEMA",
    () => LEAF_MERGE_SCHEMA,
    (value) => {
      LEAF_MERGE_SCHEMA = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveChildMergeSchema",
    () => resolveChildMergeSchema,
  );
  bindRuntimeValue(runtime, "mergeLeafValue", () => mergeLeafValue);
  bindRuntimeValue(runtime, "uniqueMergeList", () => uniqueMergeList);
  bindRuntimeValue(
    runtime,
    "mergeOrderedStringList",
    () => mergeOrderedStringList,
  );
  bindRuntimeValue(
    runtime,
    "MAX_MERGE_KEYED_LIST_ITEMS",
    () => MAX_MERGE_KEYED_LIST_ITEMS,
    (value) => {
      MAX_MERGE_KEYED_LIST_ITEMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "keyedListToMergeObject",
    () => keyedListToMergeObject,
  );
  bindRuntimeValue(runtime, "mergeObjectValues", () => mergeObjectValues);
  bindRuntimeValue(runtime, "mergeDocumentValues", () => mergeDocumentValues);
  return () => {
    FILE_MIGRATION_MARKER_FIELDS = ["convertedFrom", "createdOnFiles"];
    isMergeObject = (value): value is MergeObject =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    isStringArray = (value): value is string[] =>
      Array.isArray(value) &&
      value.every((input) => typeof input === "string");
    ownMergeProperty = (object, key) =>
      object !== undefined && Object.hasOwn(object, key)
        ? object[key]
        : undefined;
    cloneMergeValue = (value) =>
      value === undefined ? value : JSON.parse(JSON.stringify(value));
    LEAF_MERGE_SCHEMA = {
      kind: "leaf",
    };
    MAX_MERGE_KEYED_LIST_ITEMS = 64;
  };
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  JsonMergeValue,
  JsonValue,
  JsonRecord,
  MergeSchema,
  MergeDocumentOptions,
  IndexFileStoreOptions,
  IndexFileStore,
  IndexFileErrorConstructor,
  IndexFileErrorCode,
  IndexStoreBinder,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installEditorIndexFileStore(
  runtime: RuntimeBindings,
): () => void {
  var SHA256_ROUND_CONSTANTS: Uint32Array;
  var sha256TextEncoder: TextEncoder;
  var encodeFileUtf8: (text: string) => Uint8Array<ArrayBuffer>;
  var FILE_MIGRATION_MARKER_FIELDS: string[];
  var isMergeObject: (value: unknown) => value is JsonRecord;
  var isStringArray: (value: unknown) => value is string[];
  var ownMergeProperty: (
    object: JsonRecord | undefined,
    key: string,
  ) => JsonMergeValue;
  var cloneMergeValue: <T>(value: T) => T;
  var LEAF_MERGE_SCHEMA: MergeSchema;
  var MAX_KEYED_MERGE_LIST_ITEMS: number;
  var IndexFileError: IndexFileErrorConstructor;
  function sha256Sync(input: string | Uint8Array<ArrayBufferLike>) {
    let bytes = typeof input === "string" ? encodeFileUtf8(input) : input,
      byteLength = bytes.length,
      paddedLength: number = ((byteLength + 9 + 63) >> 6) << 6,
      paddedBytes = new Uint8Array(paddedLength);
    paddedBytes.set(bytes);
    paddedBytes[byteLength] = 128;
    let view = new DataView(paddedBytes.buffer);
    view.setUint32(paddedLength - 8, Math.floor(byteLength / 536870912), false);
    view.setUint32(paddedLength - 4, (byteLength << 3) >>> 0, false);
    let state = new Uint32Array([
        1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
        528734635, 1541459225,
      ]),
      words = new Uint32Array(64);
    for (let index = 0; index < paddedLength; index += 64) {
      for (let index2: number = 0; index2 < 16; index2++) {
        words[index2] = view.getUint32(index + index2 * 4, false);
      }
      for (let count: number = 16; count < 64; count++) {
        let value9 = words[count - 15],
          value10 = words[count - 2],
          value11: number =
            ((value9 >>> 7) | (value9 << 25)) ^
            ((value9 >>> 18) | (value9 << 14)) ^
            (value9 >>> 3),
          value12: number =
            ((value10 >>> 17) | (value10 << 15)) ^
            ((value10 >>> 19) | (value10 << 13)) ^
            (value10 >>> 10);
        words[count] =
          (words[count - 16] + value11 + words[count - 7] + value12) | 0;
      }
      let value = state[0],
        value2 = state[1],
        value3 = state[2],
        value4 = state[3],
        value5 = state[4],
        value6 = state[5],
        value7 = state[6],
        value8 = state[7];
      for (let index2: number = 0; index2 < 64; index2++) {
        let value9: number =
            ((value5 >>> 6) | (value5 << 26)) ^
            ((value5 >>> 11) | (value5 << 21)) ^
            ((value5 >>> 25) | (value5 << 7)),
          value10 = (value5 & value6) ^ (~value5 & value7),
          value11: number =
            (value8 +
              value9 +
              value10 +
              SHA256_ROUND_CONSTANTS[index2] +
              words[index2]) |
            0,
          value12: number =
            ((value >>> 2) | (value << 30)) ^
            ((value >>> 13) | (value << 19)) ^
            ((value >>> 22) | (value << 10)),
          value13 = (value & value2) ^ (value & value3) ^ (value2 & value3),
          value14: number = (value12 + value13) | 0;
        value8 = value7;
        value7 = value6;
        value6 = value5;
        value5 = (value4 + value11) | 0;
        value4 = value3;
        value3 = value2;
        value2 = value;
        value = (value11 + value14) | 0;
      }
      state[0] = (state[0] + value) | 0;
      state[1] = (state[1] + value2) | 0;
      state[2] = (state[2] + value3) | 0;
      state[3] = (state[3] + value4) | 0;
      state[4] = (state[4] + value5) | 0;
      state[5] = (state[5] + value6) | 0;
      state[6] = (state[6] + value7) | 0;
      state[7] = (state[7] + value8) | 0;
    }
    let hexDigest = "";
    for (let index: number = 0; index < 8; index++) {
      hexDigest += (state[index] >>> 0).toString(16).padStart(8, "0");
    }
    return hexDigest;
  }
  async function sha256(
    input: string | Uint8Array<ArrayBufferLike>,
  ): Promise<string> {
    let bytes = typeof input === "string" ? encodeFileUtf8(input) : input,
      subtleCrypto = globalThis.crypto?.subtle;
    if (typeof subtleCrypto?.digest === "function" && bytes.length > 4096) {
      try {
        let value = new Uint8Array(
            await subtleCrypto.digest(
              "SHA-256",
              bytes as Uint8Array<ArrayBuffer>,
            ),
          ),
          text = "";
        for (let value2 of value) {
          text += value2.toString(16).padStart(2, "0");
        }
        return text;
      } catch {}
    }
    return sha256Sync(bytes);
  }
  function preserveFileMigrationMarkers<Value>(
    value: Value,
    ...options: unknown[]
  ): Value {
    if (!isMergeObject(value)) {
      return value;
    }
    let result: JsonRecord = value;
    for (let value2 of FILE_MIGRATION_MARKER_FIELDS) {
      if (isMergeObject(result[value2])) {
        continue;
      }
      let value3 = options.find(
        (input: unknown): input is JsonRecord =>
          isMergeObject(input) && isMergeObject(input[value2]),
      );
      if (value3 !== undefined) {
        result = {
          ...result,
          [value2]: cloneMergeValue(value3[value2]),
        };
      }
    }
    return result as unknown as Value;
  }
  function setMergePropertySafely(
    object: JsonRecord,
    key: string,
    value: JsonMergeValue,
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
  function removeMissingMergeProperties(
    object: JsonRecord,
    source: JsonRecord,
  ): void {
    for (let value of Object.keys(object)) {
      if (
        !Object.hasOwn(source, value) &&
        !FILE_MIGRATION_MARKER_FIELDS.includes(value)
      ) {
        delete object[value];
      }
    }
    for (let value of Object.keys(source)) {
      setMergePropertySafely(object, value, source[value]);
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
        left.every((input: unknown, options: number) =>
          mergeValuesEqual(input, right[options]),
        )
      );
    }
    if (isMergeObject(left)) {
      if (!isMergeObject(right)) {
        return false;
      }
      let value = Object.keys(left).filter(
          (input: string): boolean => left[input] !== undefined,
        ),
        value2 = Object.keys(right).filter(
          (input: string): boolean => right[input] !== undefined,
        );
      return (
        value.length === value2.length &&
        value.every(
          (input: string) =>
            Object.hasOwn(right, input) &&
            mergeValuesEqual(left[input], right[input]),
        )
      );
    }
    return false;
  }
  function resolveChildMergeSchema(
    schema: MergeSchema,
    key: string,
    ...context: JsonMergeValue[]
  ): MergeSchema {
    if (schema?.kind === "map") {
      let value2 =
        schema.keys !== undefined && Object.hasOwn(schema.keys, key)
          ? schema.keys[key]
          : undefined;
      if (value2) {
        return value2;
      }
      if (schema.of) {
        return schema.of;
      }
    }
    let value = context.filter(
      (input: JsonMergeValue): boolean => input !== undefined,
    );
    if (value.length > 0 && value.every(isMergeObject)) {
      return {
        kind: "map",
      };
    }
    if (value.length > 0 && value.every(isStringArray)) {
      return {
        kind: "list",
      };
    }
    return LEAF_MERGE_SCHEMA;
  }
  function mergeLeafValue(
    base: JsonMergeValue,
    ours: JsonMergeValue,
    theirs: JsonMergeValue,
    path: string,
    conflicts: MergeDocumentOptions,
  ) {
    if (mergeValuesEqual(ours, base)) {
      return theirs;
    }
    if (mergeValuesEqual(theirs, base) || mergeValuesEqual(ours, theirs)) {
      return ours;
    }
    conflicts.conflicts?.push(path);
    return theirs;
  }
  function uniqueMergeList(items: readonly string[]) {
    let seen = new Set();
    return items.filter((input: string) =>
      seen.has(input) ? false : (seen.add(input), true),
    );
  }
  function mergeOrderedStringList(
    base: readonly string[],
    ours: readonly string[],
    theirs: readonly string[],
    allowedMembers?: ReadonlySet<string> | readonly string[],
  ) {
    let value = uniqueMergeList(base),
      value2 = uniqueMergeList(ours),
      value3 = uniqueMergeList(theirs),
      value4: string[];
    if (mergeValuesEqual(value3, value)) {
      value4 = [...value2];
    } else if (mergeValuesEqual(value2, value)) {
      value4 = [...value3];
    } else {
      let values = new Set(value),
        values2 = new Set(value3),
        values3 = new Set(value2),
        value5 = mergeValuesEqual(
          value3.filter((input: string) => values.has(input)),
          value.filter((input: string) => values2.has(input)),
        ),
        value6 = mergeValuesEqual(
          value2.filter((input: string) => values.has(input)),
          value.filter((input: string) => values3.has(input)),
        ),
        value7 = value5 && !value6,
        [value8, value9] = value7 ? [value2, value3] : [value3, value2],
        values4 = new Set(value9),
        values5 = new Set(value8);
      value4 = value8.filter(
        (input: string): boolean => !(values.has(input) && !values4.has(input)),
      );
      value9.forEach((input: string, options: number): void => {
        if (values.has(input) || values5.has(input)) {
          return;
        }
        let value10 =
            (value7 || !value5) &&
            value9
              .slice(options + 1)
              .every((input2: string): boolean => !values.has(input2)),
          value11 = value10 ? value4.length : 0;
        for (
          let value12: number = options - 1;
          !value10 && value12 >= 0;
          value12--
        ) {
          let value13 = value4.indexOf(value9[value12]);
          if (value13 >= 0) {
            value11 = value13 + 1;
            break;
          }
        }
        value4.splice(value11, 0, input);
      });
    }
    if (allowedMembers !== undefined) {
      let value5: ReadonlySet<string> =
        allowedMembers instanceof Set
          ? allowedMembers
          : new Set(allowedMembers);
      value4 = value4.filter((input: string) => value5.has(input));
      let values = new Set(value4);
      for (let value6 of value5) {
        if (!values.has(value6)) {
          value4.push(value6);
        }
      }
    }
    return value4;
  }
  function keyedListToMergeObject(value: JsonMergeValue, keyField: string) {
    let items = Array.isArray(value)
        ? value
        : isMergeObject(value)
          ? Object.keys(value)
              .filter((input: string) => Object.hasOwn(value, input))
              .map((input: string) => value[input])
          : [],
      keyedItems: Record<string, JsonRecord> = Object.create(null);
    for (let value2 of items) {
      if (
        isMergeObject(value2) &&
        typeof value2[keyField] === "string" &&
        value2[keyField] !== "" &&
        Object.keys(keyedItems).length < MAX_KEYED_MERGE_LIST_ITEMS
      ) {
        keyedItems[value2[keyField]] = value2;
      }
    }
    return keyedItems;
  }
  function mergeObjectValues(
    base: JsonRecord | undefined,
    ours: JsonRecord,
    theirs: JsonRecord,
    schema: MergeSchema,
    path: string,
    conflicts: MergeDocumentOptions,
  ) {
    let state: JsonRecord = {},
      value = uniqueMergeList([...Object.keys(theirs), ...Object.keys(ours)]),
      items: { key: string; schema: Extract<MergeSchema, { kind: "list" }> }[] =
        [];
    for (let value2 of value) {
      let [items2, items3, items4] = [
          ownMergeProperty(base, value2),
          ownMergeProperty(ours, value2),
          ownMergeProperty(theirs, value2),
        ],
        value3: boolean = items2 !== undefined,
        value4: boolean = items3 !== undefined,
        value5: boolean = items4 !== undefined;
      if (value3 && (!value4 || !value5)) {
        continue;
      }
      if (!value4) {
        setMergePropertySafely(state, value2, cloneMergeValue(items4));
        continue;
      }
      if (!value5) {
        setMergePropertySafely(state, value2, cloneMergeValue(items3));
        continue;
      }
      let value6 = resolveChildMergeSchema(
          schema,
          value2,
          items2,
          items3,
          items4,
        ),
        value7 = path === "" ? value2 : path + "/" + value2;
      if (
        value6.kind === "map" &&
        isMergeObject(items3) &&
        isMergeObject(items4)
      ) {
        setMergePropertySafely(
          state,
          value2,
          mergeObjectValues(
            isMergeObject(items2) ? items2 : undefined,
            items3,
            items4,
            value6,
            value7,
            conflicts,
          ),
        );
      } else if (value6.kind === "records") {
        let value8 = mergeObjectValues(
          keyedListToMergeObject(items2, value6.by),
          keyedListToMergeObject(items3, value6.by),
          keyedListToMergeObject(items4, value6.by),
          {
            kind: "map",
            of: LEAF_MERGE_SCHEMA,
          },
          value7,
          conflicts,
        );
        setMergePropertySafely(
          state,
          value2,
          Object.keys(value8)
            .slice(0, MAX_KEYED_MERGE_LIST_ITEMS)
            .map((input: string) => value8[input]),
        );
      } else if (
        value6.kind === "list" &&
        isStringArray(items3) &&
        isStringArray(items4)
      ) {
        setMergePropertySafely(
          state,
          value2,
          mergeOrderedStringList(
            isStringArray(items2) ? items2 : [],
            items3,
            items4,
          ),
        );
        items.push({
          key: value2,
          schema: value6,
        });
      } else {
        setMergePropertySafely(
          state,
          value2,
          cloneMergeValue(
            mergeLeafValue(items2, items3, items4, value7, conflicts),
          ),
        );
      }
    }
    for (let { key: value2, schema: value3 } of items) {
      let value4 = path === "" ? value2 : path + "/" + value2,
        value5 =
          value3.membersOf !== undefined
            ? ownMergeProperty(state, value3.membersOf)
            : undefined,
        value6 = isMergeObject(value5)
          ? new Set(Object.keys(value5))
          : conflicts.externalMembers?.(value4),
        value7 = ownMergeProperty(state, value2);
      if (value6 !== undefined) {
        setMergePropertySafely(
          state,
          value2,
          mergeOrderedStringList(
            value7 as string[],
            value7 as string[],
            value7 as string[],
            value6,
          ),
        );
      }
    }
    return state;
  }
  function mergeDocumentValues<Value>(
    base: Value,
    ours: Value,
    theirs: Value,
    schema: MergeSchema,
    options: MergeDocumentOptions = {},
  ): Value {
    if (schema.kind === "map" && isMergeObject(ours) && isMergeObject(theirs)) {
      return mergeObjectValues(
        isMergeObject(base) ? base : undefined,
        ours,
        theirs,
        schema,
        "",
        options,
      ) as unknown as Value;
    }
    if (
      schema.kind === "list" &&
      isStringArray(ours) &&
      isStringArray(theirs)
    ) {
      return mergeOrderedStringList(
        isStringArray(base) ? base : [],
        ours,
        theirs,
        options.externalMembers?.(""),
      ) as unknown as Value;
    }
    return cloneMergeValue(
      mergeLeafValue(
        base as unknown as JsonMergeValue,
        ours as unknown as JsonMergeValue,
        theirs as unknown as JsonMergeValue,
        "",
        options,
      ),
    ) as Value;
  }
  function sortIndexDocumentKeys(
    value: JsonMergeValue,
    root: boolean,
  ): JsonMergeValue;
  function sortIndexDocumentKeys(value: unknown, root: boolean): unknown;
  function sortIndexDocumentKeys(value: unknown, root: boolean): unknown {
    if (Array.isArray(value)) {
      return value.map((input: unknown) => sortIndexDocumentKeys(input, false));
    }
    if (!isMergeObject(value)) {
      return value;
    }
    let result = Object.keys(value)
      .filter((input: string): boolean => value[input] !== undefined)
      .sort();
    if (root) {
      let value2 = result.indexOf("v");
      if (value2 > 0) {
        result.splice(value2, 1);
        result.unshift("v");
      }
    }
    let state: JsonRecord = {};
    for (let value2 of result) {
      setMergePropertySafely(
        state,
        value2,
        sortIndexDocumentKeys(value[value2], false),
      );
    }
    return state;
  }
  function serializeIndexDocument(index: unknown): string {
    return (
      JSON.stringify(sortIndexDocumentKeys(index, true), null, 2) +
      `
`
    );
  }
  function createIndexFileStore<Index extends { v: number }>(
    options: IndexFileStoreOptions<Index>,
  ): IndexFileStore<Index> {
    let value = options.empty(),
      value2 = cloneMergeValue(value),
      value3: string | null = null,
      value4: IndexStoreBinder | undefined,
      items: string[] = [],
      flag: boolean = false;
    function value5(input: string): Index {
      let value6: JsonMergeValue;
      try {
        value6 = JSON.parse(input);
      } catch {
        throw new IndexFileError("unreadable", options.path + " is not JSON");
      }
      if (!isMergeObject(value6) || typeof value6.v !== "number") {
        throw new IndexFileError(
          "unreadable",
          options.path + " has no numeric v",
        );
      }
      let value7 = options.empty();
      if (value6.v > (options.maxVersion ?? value7.v)) {
        throw new IndexFileError(
          "newer_version",
          options.path +
            " was written by a newer editor (v " +
            String(value6.v) +
            ")",
        );
      }
      for (let [value8, value9] of Object.entries(value7)) {
        if (value8 === "v") {
          continue;
        }
        let value10: string | string | undefined = Array.isArray(value9)
          ? "array"
          : isMergeObject(value9)
            ? "object"
            : undefined;
        if (value10 === undefined) {
          continue;
        }
        let value11 = value6[value8],
          value12 =
            options.schema.kind === "map"
              ? options.schema.keys?.[value8]
              : undefined;
        if (
          value12?.kind === "records" &&
          value10 === "array" &&
          isMergeObject(value11)
        ) {
          let value13 = keyedListToMergeObject(value11, value12.by);
          value6[value8] = Object.keys(value13).map(
            (input2: string) => value13[input2],
          );
          continue;
        }
        if (
          (value10 === "array" && !Array.isArray(value11)) ||
          (value10 === "object" && !isMergeObject(value11))
        ) {
          value6[value8] = value9;
        }
      }
      return value6 as unknown as Index;
    }
    let callback = (): void => {
        flag = true;
        value4?.(options.path, () => state.serialize(), value3);
      },
      state: IndexFileStore<Index> = {
        path: options.path,
        parse: value5,
        async load(): Promise<Index> {
          let value6: Files.FileTextRead;
          try {
            value6 = await options.port.readText(options.path);
          } catch (value7: unknown) {
            throw new IndexFileError(
              "not_found",
              options.path +
                ": " +
                (value7 instanceof Error
                  ? value7.message
                  : String(
                      (value7 as { message?: unknown } | null)?.message ??
                        value7,
                    )),
            );
          }
          value = value5(value6.text);
          value2 = cloneMergeValue(value);
          value3 = value6.sha256;
          flag = false;
          return value;
        },
        loadText(input: string, options2: string | null) {
          value = value5(input);
          value2 = cloneMergeValue(value);
          value3 = options2;
          flag = false;
          return value;
        },
        init(input?: Index) {
          value = input ?? options.empty();
          value2 = options.empty();
          value3 = null;
          callback();
          return value;
        },
        get: () => value,
        base: () => value2,
        baseSha: () => value3,
        dirty: (): boolean => flag,
        lastConflicts: () => [...items],
        update(input: (value: Index) => void): void {
          input(value);
          callback();
        },
        mergeFrom(input: Index) {
          items = [];
          value = preserveFileMigrationMarkers(
            mergeDocumentValues(value2, value, input, options.schema, {
              conflicts: items,
              externalMembers: options.externalMembers,
            }),
            input,
            value2,
          ) as Index;
          value2 = cloneMergeValue(input);
          return value;
        },
        serialize: () =>
          serializeIndexDocument(preserveFileMigrationMarkers(value, value2)),
        bind(input: IndexStoreBinder): void {
          value4 = input;
        },
        markSaved(input: string, options2: string): void {
          try {
            value2 = JSON.parse(input);
          } catch {
            value2 = cloneMergeValue(value);
          }
          value3 = options2;
          flag = !mergeValuesEqual(value2, value);
        },
        async reloadAndMerge(): Promise<string[]> {
          let value6 = await options.port.readText(options.path);
          if (value6.sha256 === value3) {
            return [];
          }
          state.mergeFrom(value5(value6.text));
          value3 = value6.sha256;
          flag = !mergeValuesEqual(value2, value);
          if (flag) {
            value4?.(options.path, () => state.serialize(), value3);
          }
          return [...items];
        },
      };
    return state;
  }
  bindRuntimeValue(
    runtime,
    "SHA256_ROUND_CONSTANTS",
    () => SHA256_ROUND_CONSTANTS,
    (value) => {
      SHA256_ROUND_CONSTANTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sha256TextEncoder",
    () => sha256TextEncoder,
    (value) => {
      sha256TextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeFileUtf8",
    () => encodeFileUtf8,
    (value) => {
      encodeFileUtf8 = value;
    },
  );
  bindRuntimeValue(runtime, "sha256Sync", () => sha256Sync);
  bindRuntimeValue(runtime, "sha256", () => sha256);
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
  bindRuntimeValue(
    runtime,
    "removeMissingMergeProperties",
    () => removeMissingMergeProperties,
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
    "MAX_KEYED_MERGE_LIST_ITEMS",
    () => MAX_KEYED_MERGE_LIST_ITEMS,
    (value) => {
      MAX_KEYED_MERGE_LIST_ITEMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "keyedListToMergeObject",
    () => keyedListToMergeObject,
  );
  bindRuntimeValue(runtime, "mergeObjectValues", () => mergeObjectValues);
  bindRuntimeValue(runtime, "mergeDocumentValues", () => mergeDocumentValues);
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
    SHA256_ROUND_CONSTANTS = new Uint32Array([
      1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
      2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
      1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
      264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
      2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
      113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
      1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
      3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
      430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
      1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424,
      2428436474, 2756734187, 3204031479, 3329325298,
    ]);
    sha256TextEncoder = new TextEncoder();
    encodeFileUtf8 = (text: string) => sha256TextEncoder.encode(text);
    FILE_MIGRATION_MARKER_FIELDS = ["convertedFrom", "createdOnFiles"];
    isMergeObject = (value: unknown): value is JsonRecord =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    isStringArray = (value: unknown): value is string[] =>
      Array.isArray(value) &&
      value.every((input: unknown): boolean => typeof input === "string");
    ownMergeProperty = (object: JsonRecord | undefined, key: string) =>
      object !== undefined && Object.hasOwn(object, key)
        ? object[key]
        : undefined;
    cloneMergeValue = <T>(value: T): T =>
      value === undefined ? value : JSON.parse(JSON.stringify(value));
    LEAF_MERGE_SCHEMA = {
      kind: "leaf",
    };
    MAX_KEYED_MERGE_LIST_ITEMS = 64;
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

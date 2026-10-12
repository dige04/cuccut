import type { JsonValue, DataRecord } from "../contracts/storage";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installPlatformDocumentValues(
  runtime: RuntimeBindings,
): () => void {
  var PlatformDocumentValuesPattern: RegExp;
  var PlatformDocumentValuesPattern_2: RegExp;
  var DELETE_DOCUMENT: symbol;
  var PlatformDocumentValuesElementCache: WeakMap<object, string>;
  var ProtoValue: string;
  function serializedDocumentBytes(input: JsonValue): number {
    let value: string = JSON.stringify(input)!,
      value2 =
        5 * (value.match(PlatformDocumentValuesPattern)?.length ?? 0) +
        3 * (value.match(PlatformDocumentValuesPattern_2)?.length ?? 0);
    return new TextEncoder().encode(value).length + value2;
  }
  function isPlainRecord(input: unknown): input is DataRecord {
    return typeof input == "object" && input !== null && !Array.isArray(input);
  }
  function sortJsonObjectKeys(key: string, value: unknown): unknown {
    if (!isPlainRecord(value)) return value;
    let state: DataRecord = {};
    for (let _localvalue of Object.keys(value).sort())
      state[_localvalue] = value[_localvalue];
    return state;
  }
  function stableStringify(value: object): string {
    let cachedJson = PlatformDocumentValuesElementCache.get(value);
    if (cachedJson !== undefined) return cachedJson;
    let json = JSON.stringify(value, sortJsonObjectKeys) ?? "undefined";
    PlatformDocumentValuesElementCache.set(value, json);
    return json;
  }
  function structurallyEqual(left: unknown, right: unknown): boolean {
    return left === right
      ? true
      : typeof left != "object" ||
          typeof right != "object" ||
          left === null ||
          right === null
        ? false
        : stableStringify(left) === stableStringify(right);
  }
  function deepMerge(base: DataRecord, patch: DataRecord): DataRecord {
    let merged = {
      ...base,
    };
    for (let value of Object.keys(patch)) {
      let value2 = patch[value];
      if (value2 === undefined || value === ProtoValue) continue;
      let value3 = merged[value];
      merged[value] =
        isPlainRecord(value3) && isPlainRecord(value2)
          ? deepMerge(value3, value2)
          : value2;
    }
    return merged;
  }
  function mergeCompatibleRecords(
    base: DataRecord,
    patch: DataRecord,
  ): DataRecord | null {
    let state = {
      ...base,
    };
    for (let value of Object.keys(patch)) {
      let value2 = patch[value];
      if (value2 === undefined || value === ProtoValue) continue;
      let value3 = state[value];
      if (isPlainRecord(value2) && value3 !== undefined) {
        if (!isPlainRecord(value3)) return null;
        let value4 = mergeCompatibleRecords(value3, value2);
        if (value4 === null) return null;
        state[value] = value4;
      } else state[value] = value2;
    }
    return state;
  }
  function diffRecord(
    before: DataRecord | undefined,
    after: DataRecord,
  ): DataRecord | null {
    if (before === after) return null;
    if (before === undefined) return after;
    let patch: DataRecord | null = null;
    for (let value of Object.keys(after)) {
      if (value === ProtoValue) continue;
      let value2 = after[value],
        value3 = before[value];
      if (value2 === undefined) {
        value3 !== undefined && ((patch ??= {})[value] = null);
        continue;
      }
      if (value3 !== value2)
        if (isPlainRecord(value3) && isPlainRecord(value2)) {
          let value4 = diffRecord(value3, value2);
          value4 !== null && ((patch ??= {})[value] = value4);
        } else
          (value3 === undefined || !structurallyEqual(value3, value2)) &&
            ((patch ??= {})[value] = value2);
    }
    for (let value of Object.keys(before))
      before[value] !== undefined &&
        after[value] === undefined &&
        ((patch ??= {})[value] = null);
    return patch;
  }
  function removeNullValues(input: DataRecord): DataRecord {
    let value: DataRecord | undefined;
    for (let value2 of Object.keys(input)) {
      let value3 = input[value2],
        value4 = value3;
      value3 == null || value2 === ProtoValue
        ? (value4 = undefined)
        : isPlainRecord(value3) && (value4 = removeNullValues(value3));
      value4 !== value3 &&
        ((value ??= {
          ...input,
        }),
        value4 === undefined ? delete value[value2] : (value[value2] = value4));
    }
    return value ?? input;
  }
  function countRecordNulls(input: DataRecord): number {
    let index = 0;
    for (let value of Object.values(input))
      value === null
        ? (index += 1)
        : isPlainRecord(value) && (index += countRecordNulls(value));
    return index;
  }
  function recordDepth(value: unknown, depthLimit: number = 64): number {
    if (typeof value != "object" || value === null) return 0;
    let maxChildDepth = 0;
    for (let value2 of Array.isArray(value) ? value : Object.values(value))
      if (
        ((maxChildDepth = Math.max(
          maxChildDepth,
          recordDepth(value2, depthLimit - 1),
        )),
        maxChildDepth >= depthLimit)
      )
        break;
    return maxChildDepth + 1;
  }
  function dirname(path: string): string {
    let slash = path.lastIndexOf("/");
    return slash < 0 ? "" : path.slice(0, slash);
  }
  function basename(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1);
  }
  bindRuntimeValue(
    runtime,
    "PlatformDocumentValuesPattern",
    () => PlatformDocumentValuesPattern,
    (value) => {
      PlatformDocumentValuesPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformDocumentValuesPattern_2",
    () => PlatformDocumentValuesPattern_2,
    (value) => {
      PlatformDocumentValuesPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializedDocumentBytes",
    () => serializedDocumentBytes,
  );
  bindRuntimeValue(
    runtime,
    "DELETE_DOCUMENT",
    () => DELETE_DOCUMENT,
    (value) => {
      DELETE_DOCUMENT = value;
    },
  );
  bindRuntimeValue(runtime, "isPlainRecord", () => isPlainRecord);
  bindRuntimeValue(
    runtime,
    "PlatformDocumentValuesElementCache",
    () => PlatformDocumentValuesElementCache,
    (value) => {
      PlatformDocumentValuesElementCache = value;
    },
  );
  bindRuntimeValue(runtime, "sortJsonObjectKeys", () => sortJsonObjectKeys);
  bindRuntimeValue(runtime, "stableStringify", () => stableStringify);
  bindRuntimeValue(runtime, "structurallyEqual", () => structurallyEqual);
  bindRuntimeValue(
    runtime,
    "ProtoValue",
    () => ProtoValue,
    (value) => {
      ProtoValue = value;
    },
  );
  bindRuntimeValue(runtime, "deepMerge", () => deepMerge);
  bindRuntimeValue(
    runtime,
    "mergeCompatibleRecords",
    () => mergeCompatibleRecords,
  );
  bindRuntimeValue(runtime, "diffRecord", () => diffRecord);
  bindRuntimeValue(runtime, "removeNullValues", () => removeNullValues);
  bindRuntimeValue(runtime, "countRecordNulls", () => countRecordNulls);
  bindRuntimeValue(runtime, "recordDepth", () => recordDepth);
  bindRuntimeValue(runtime, "dirname", () => dirname);
  bindRuntimeValue(runtime, "basename", () => basename);
  return () => {
    PlatformDocumentValuesPattern = /[<>&]/g;
    PlatformDocumentValuesPattern_2 = /[\u2028\u2029]/g;
    DELETE_DOCUMENT = Symbol("DELETE_DOC");
    PlatformDocumentValuesElementCache = new WeakMap();
    ProtoValue = "__proto__";
  };
}

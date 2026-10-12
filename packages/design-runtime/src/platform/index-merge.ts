import type {
  DataRecord,
  MergePolicy,
  ListMergePolicy,
  MergeContext,
} from "../contracts/storage";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installPlatformIndexMerge(
  runtime: RuntimeBindings,
): () => void {
  var INDEX_PRESERVED_METADATA_KEYS: readonly string[];
  var isPlainMergeObject: (input: unknown) => input is DataRecord;
  var isStringList: (input: unknown) => input is string[];
  var getOwnMergeValue: (input: DataRecord | undefined, key: string) => unknown;
  var cloneIndexValue: (input: unknown) => unknown;
  var LEAF_MERGE_POLICY: MergePolicy;
  var MAX_MERGED_OBJECT_KEYS: number;
  function preserveIndexProvenance<Value>(
    value: Value,
    ...sources: unknown[]
  ): Value {
    if (!isPlainMergeObject(value)) return value;
    let result = value;
    for (let value2 of INDEX_PRESERVED_METADATA_KEYS) {
      if (isPlainMergeObject(result[value2])) continue;
      let value3 = sources.find(
        (input): input is DataRecord =>
          isPlainMergeObject(input) && isPlainMergeObject(input[value2]),
      );
      value3 !== undefined &&
        (result = {
          ...result,
          [value2]: cloneIndexValue(value3[value2]),
        });
    }
    return result;
  }
  function setSafeObjectKey(
    object: DataRecord,
    key: string,
    value: unknown,
  ): void {
    key === "__proto__"
      ? Object.defineProperty(object, key, {
          value: value,
          enumerable: true,
          writable: true,
          configurable: true,
        })
      : (object[key] = value);
  }
  function replaceIndexObjectProperties(
    target: DataRecord,
    source: DataRecord,
  ): void {
    for (let value of Object.keys(target))
      !Object.hasOwn(source, value) &&
        !INDEX_PRESERVED_METADATA_KEYS.includes(value) &&
        delete target[value];
    for (let value of Object.keys(source))
      setSafeObjectKey(target, value, source[value]);
  }
  function equalIndexValue(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (Array.isArray(left))
      return (
        Array.isArray(right) &&
        left.length === right.length &&
        left.every((input, options) => equalIndexValue(input, right[options]))
      );
    if (isPlainMergeObject(left)) {
      if (!isPlainMergeObject(right)) return false;
      let value = Object.keys(left).filter(
          (input) => left[input] !== undefined,
        ),
        value2 = Object.keys(right).filter(
          (input) => right[input] !== undefined,
        );
      return (
        value.length === value2.length &&
        value.every(
          (input) =>
            Object.hasOwn(right, input) &&
            equalIndexValue(left[input], right[input]),
        )
      );
    }
    return false;
  }
  function getChildMergePolicy(
    policy: MergePolicy | undefined,
    key: string,
    ...values: unknown[]
  ): MergePolicy {
    if (policy?.kind === "map") {
      let value2 =
        policy.keys !== undefined && Object.hasOwn(policy.keys, key)
          ? policy.keys[key]
          : undefined;
      if (value2) return value2;
      if (policy.of) return policy.of;
    }
    let value = values.filter((input) => input !== undefined);
    return value.length > 0 && value.every(isPlainMergeObject)
      ? {
          kind: "map",
        }
      : value.length > 0 && value.every(isStringList)
        ? {
            kind: "list",
          }
        : LEAF_MERGE_POLICY;
  }
  function mergeLeafValue(
    base: unknown,
    local: unknown,
    remote: unknown,
    path: string,
    context: MergeContext,
  ): unknown {
    return equalIndexValue(local, base)
      ? remote
      : equalIndexValue(remote, base) || equalIndexValue(local, remote)
        ? local
        : (context.conflicts?.push(path), remote);
  }
  function uniqueMergeKeys(keys: readonly string[]): string[] {
    let seen = new Set();
    return keys.filter((input) =>
      seen.has(input) ? false : (seen.add(input), true),
    );
  }
  function mergeOrderedStringList(
    base: readonly string[],
    local: readonly string[],
    remote: readonly string[],
    allowedKeys?: ReadonlySet<string> | readonly string[],
  ): string[] {
    let baseKeys = uniqueMergeKeys(base),
      localKeys = uniqueMergeKeys(local),
      remoteKeys = uniqueMergeKeys(remote),
      merged: string[];
    if (equalIndexValue(remoteKeys, baseKeys)) merged = [...localKeys];
    else if (equalIndexValue(localKeys, baseKeys)) merged = [...remoteKeys];
    else {
      let values = new Set(baseKeys),
        values2 = new Set(remoteKeys),
        values3 = new Set(localKeys),
        value = equalIndexValue(
          remoteKeys.filter((input) => values.has(input)),
          baseKeys.filter((input) => values2.has(input)),
        ),
        value2 = equalIndexValue(
          localKeys.filter((input) => values.has(input)),
          baseKeys.filter((input) => values3.has(input)),
        ),
        value3 = value && !value2,
        [value4, value5] = value3
          ? [localKeys, remoteKeys]
          : [remoteKeys, localKeys],
        values4 = new Set(value5),
        values5 = new Set(value4);
      merged = value4.filter(
        (input) => !(values.has(input) && !values4.has(input)),
      );
      value5.forEach((input, options) => {
        if (values.has(input) || values5.has(input)) return;
        let value6 =
            (value3 || !value) &&
            value5.slice(options + 1).every((input2) => !values.has(input2)),
          value7 = value6 ? merged.length : 0;
        for (let value8 = options - 1; !value6 && value8 >= 0; value8--) {
          let value9 = merged.indexOf(value5[value8]!);
          if (value9 >= 0) {
            value7 = value9 + 1;
            break;
          }
        }
        merged.splice(value7, 0, input);
      });
    }
    if (allowedKeys !== undefined) {
      let value =
        allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
      merged = merged.filter((input) => value.has(input));
      let values = new Set(merged);
      for (let value2 of value) values.has(value2) || merged.push(value2);
    }
    return merged;
  }
  function normalizeMergeMap(
    value: unknown,
    idProperty: string,
  ): Record<string, DataRecord> {
    let records = Array.isArray(value)
        ? value
        : isPlainMergeObject(value)
          ? Object.keys(value)
              .filter((input) => Object.hasOwn(value, input))
              .map((input) => value[input])
          : [],
      result: Record<string, DataRecord> = Object.create(null);
    for (let value2 of records)
      isPlainMergeObject(value2) &&
        typeof value2[idProperty] == "string" &&
        value2[idProperty] !== "" &&
        Object.keys(result).length < MAX_MERGED_OBJECT_KEYS &&
        (result[value2[idProperty]] = value2);
    return result;
  }
  function mergeMapValues(
    base: DataRecord | undefined,
    local: DataRecord,
    remote: DataRecord,
    policy: MergePolicy,
    path: string,
    context: MergeContext,
  ): DataRecord {
    let result: DataRecord = {},
      keys = uniqueMergeKeys([...Object.keys(remote), ...Object.keys(local)]),
      deferredLists: {
        key: string;
        schema: ListMergePolicy;
      }[] = [];
    for (let value of keys) {
      let [items, items2, items3] = [
          getOwnMergeValue(base, value),
          getOwnMergeValue(local, value),
          getOwnMergeValue(remote, value),
        ],
        value2 = items !== undefined,
        value3 = items2 !== undefined,
        value4 = items3 !== undefined;
      if (value2 && (!value3 || !value4)) continue;
      if (!value3) {
        setSafeObjectKey(result, value, cloneIndexValue(items3));
        continue;
      }
      if (!value4) {
        setSafeObjectKey(result, value, cloneIndexValue(items2));
        continue;
      }
      let value5 = getChildMergePolicy(policy, value, items, items2, items3),
        value6 = path === "" ? value : path + "/" + value;
      if (
        value5.kind === "map" &&
        isPlainMergeObject(items2) &&
        isPlainMergeObject(items3)
      )
        setSafeObjectKey(
          result,
          value,
          mergeMapValues(
            isPlainMergeObject(items) ? items : undefined,
            items2,
            items3,
            value5,
            value6,
            context,
          ),
        );
      else if (value5.kind === "records") {
        let value7 = mergeMapValues(
          normalizeMergeMap(items, value5.by),
          normalizeMergeMap(items2, value5.by),
          normalizeMergeMap(items3, value5.by),
          {
            kind: "map",
            of: LEAF_MERGE_POLICY,
          },
          value6,
          context,
        );
        setSafeObjectKey(
          result,
          value,
          Object.keys(value7)
            .slice(0, MAX_MERGED_OBJECT_KEYS)
            .map((input) => value7[input]),
        );
      } else
        value5.kind === "list" && isStringList(items2) && isStringList(items3)
          ? (setSafeObjectKey(
              result,
              value,
              mergeOrderedStringList(
                isStringList(items) ? items : [],
                items2,
                items3,
              ),
            ),
            deferredLists.push({
              key: value,
              schema: value5,
            }))
          : setSafeObjectKey(
              result,
              value,
              cloneIndexValue(
                mergeLeafValue(items, items2, items3, value6, context),
              ),
            );
    }
    for (let { key: value, schema: value2 } of deferredLists) {
      let value3 = path === "" ? value : path + "/" + value,
        value4 =
          value2.membersOf !== undefined
            ? getOwnMergeValue(result, value2.membersOf)
            : undefined,
        value5 = isPlainMergeObject(value4)
          ? new Set(Object.keys(value4))
          : context.externalMembers?.(value3),
        value6 = getOwnMergeValue(result, value) as string[];
      value5 !== undefined &&
        setSafeObjectKey(
          result,
          value,
          mergeOrderedStringList(value6, value6, value6, value5),
        );
    }
    return result;
  }
  function mergeIndexValues(
    base: unknown,
    local: unknown,
    remote: unknown,
    policy: MergePolicy,
    context: MergeContext = {},
  ): unknown {
    return policy.kind === "map" &&
      isPlainMergeObject(local) &&
      isPlainMergeObject(remote)
      ? mergeMapValues(
          isPlainMergeObject(base) ? base : undefined,
          local,
          remote,
          policy,
          "",
          context,
        )
      : policy.kind === "list" && isStringList(local) && isStringList(remote)
        ? mergeOrderedStringList(
            isStringList(base) ? base : [],
            local,
            remote,
            context.externalMembers?.(""),
          )
        : cloneIndexValue(mergeLeafValue(base, local, remote, "", context));
  }
  bindRuntimeValue(
    runtime,
    "INDEX_PRESERVED_METADATA_KEYS",
    () => INDEX_PRESERVED_METADATA_KEYS,
    (value) => {
      INDEX_PRESERVED_METADATA_KEYS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveIndexProvenance",
    () => preserveIndexProvenance,
  );
  bindRuntimeValue(
    runtime,
    "isPlainMergeObject",
    () => isPlainMergeObject,
    (value) => {
      isPlainMergeObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isStringList",
    () => isStringList,
    (value) => {
      isStringList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getOwnMergeValue",
    () => getOwnMergeValue,
    (value) => {
      getOwnMergeValue = value;
    },
  );
  bindRuntimeValue(runtime, "setSafeObjectKey", () => setSafeObjectKey);
  bindRuntimeValue(
    runtime,
    "replaceIndexObjectProperties",
    () => replaceIndexObjectProperties,
  );
  bindRuntimeValue(runtime, "equalIndexValue", () => equalIndexValue);
  bindRuntimeValue(
    runtime,
    "cloneIndexValue",
    () => cloneIndexValue,
    (value) => {
      cloneIndexValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEAF_MERGE_POLICY",
    () => LEAF_MERGE_POLICY,
    (value) => {
      LEAF_MERGE_POLICY = value;
    },
  );
  bindRuntimeValue(runtime, "getChildMergePolicy", () => getChildMergePolicy);
  bindRuntimeValue(runtime, "mergeLeafValue", () => mergeLeafValue);
  bindRuntimeValue(runtime, "uniqueMergeKeys", () => uniqueMergeKeys);
  bindRuntimeValue(
    runtime,
    "mergeOrderedStringList",
    () => mergeOrderedStringList,
  );
  bindRuntimeValue(
    runtime,
    "MAX_MERGED_OBJECT_KEYS",
    () => MAX_MERGED_OBJECT_KEYS,
    (value) => {
      MAX_MERGED_OBJECT_KEYS = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeMergeMap", () => normalizeMergeMap);
  bindRuntimeValue(runtime, "mergeMapValues", () => mergeMapValues);
  bindRuntimeValue(runtime, "mergeIndexValues", () => mergeIndexValues);
  return () => {
    INDEX_PRESERVED_METADATA_KEYS = ["convertedFrom", "createdOnFiles"];
    isPlainMergeObject = (input: unknown): input is DataRecord =>
      typeof input == "object" && input !== null && !Array.isArray(input);
    isStringList = (input: unknown): input is string[] =>
      Array.isArray(input) &&
      input.every((input2) => typeof input2 == "string");
    getOwnMergeValue = (input: DataRecord | undefined, key: string): unknown =>
      input !== undefined && Object.hasOwn(input, key) ? input[key] : undefined;
    cloneIndexValue = (input: unknown): unknown =>
      input === undefined ? input : JSON.parse(JSON.stringify(input));
    LEAF_MERGE_POLICY = {
      kind: "leaf",
    };
    MAX_MERGED_OBJECT_KEYS = 64;
  };
}

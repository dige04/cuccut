/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  JsonMergeValue,
  JsonValue,
  JsonRecord,
  MergeChoice,
  JsonMergeResult,
  TokenMergeResult,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesTokenMerge(runtime: RuntimeBindings): () => void {
  var isPlainMergeRecord: (value: unknown) => value is JsonRecord;
  var serializedValuesEqual: (
    first: JsonMergeValue,
    second: JsonMergeValue,
  ) => boolean;
  var cloneJsonValue: <T extends JsonMergeValue>(value: T) => T;
  var MERGE_ARRAY_ID_FIELDS: string[];
  var isTokenFilePath: (path: string) => boolean;
  function mergeArrayIdentityField(...arrays: JsonMergeValue[]) {
    let presentArrays = arrays.filter(
      (input: JsonMergeValue): input is JsonValue[] => Array.isArray(input),
    );
    if (
      presentArrays.length === 0 ||
      presentArrays.every((items: JsonValue[]): boolean => items.length === 0)
    ) {
      return null;
    }
    for (let value of MERGE_ARRAY_ID_FIELDS) {
      if (
        presentArrays.every((input: JsonValue[]): boolean => {
          let values = new Set<string>();
          for (let value2 of input) {
            if (
              !isPlainMergeRecord(value2) ||
              typeof value2[value] !== "string" ||
              values.has(value2[value])
            ) {
              return false;
            }
            values.add(value2[value]);
          }
          return true;
        })
      ) {
        return value;
      }
    }
    return null;
  }
  function mergeJsonValueThreeWays(
    base: JsonMergeValue,
    mine: JsonMergeValue,
    theirs: JsonMergeValue,
    path: string,
    conflicts: string[],
    choice: MergeChoice,
  ): JsonMergeValue {
    if (serializedValuesEqual(mine, theirs)) {
      return mine;
    }
    if (serializedValuesEqual(base, mine)) {
      return cloneJsonValue(theirs);
    }
    if (serializedValuesEqual(base, theirs)) {
      return mine;
    }
    if (
      isPlainMergeRecord(mine) &&
      isPlainMergeRecord(theirs) &&
      (isPlainMergeRecord(base) || base === undefined)
    ) {
      let value = base ?? {},
        state: JsonRecord = {};
      for (let value2 of new Set([
        ...Object.keys(mine),
        ...Object.keys(theirs),
      ])) {
        let value3 = Object.hasOwn(mine, value2),
          value4 = Object.hasOwn(theirs, value2),
          value5 = mergeJsonValueThreeWays(
            Object.hasOwn(value, value2) ? value[value2] : undefined,
            value3 ? mine[value2] : undefined,
            value4 ? theirs[value2] : undefined,
            path === "" ? value2 : path + "/" + value2,
            conflicts,
            choice,
          );
        if (value5 !== undefined) {
          Object.defineProperty(state, value2, {
            value: value5,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
      }
      return state;
    }
    if (
      Array.isArray(mine) &&
      Array.isArray(theirs) &&
      (Array.isArray(base) || base === undefined)
    ) {
      let value = mergeArrayIdentityField(base, mine, theirs);
      if (value !== null) {
        return mergeIdentifiedArrayThreeWays(
          (base ?? []) as JsonRecord[],
          mine as JsonRecord[],
          theirs as JsonRecord[],
          value,
          path,
          conflicts,
          choice,
        );
      }
    }
    conflicts.push(path);
    if (choice === "theirs") {
      return cloneJsonValue(theirs);
    } else {
      return mine;
    }
  }
  function mergeIdentifiedArrayThreeWays(
    base: JsonRecord[],
    mine: JsonRecord[],
    theirs: JsonRecord[],
    identityField: string,
    path: string,
    conflicts: string[],
    choice: MergeChoice,
  ) {
    let indexByIdentity = (input: JsonRecord[]) =>
        new Map(
          input.map((input2: JsonRecord) => [
            input2[identityField] as string,
            input2,
          ]),
        ),
      baseById = indexByIdentity(base),
      mineById = indexByIdentity(mine),
      theirsById = indexByIdentity(theirs),
      mergedById = new Map<string, JsonMergeValue>();
    for (let value of new Set([...mineById.keys(), ...theirsById.keys()])) {
      let entry = baseById.get(value),
        entry2 = mineById.get(value),
        entry3 = theirsById.get(value),
        value2: string = path + "/" + value;
      if (entry2 !== undefined && entry3 !== undefined) {
        if (
          serializedValuesEqual(entry2, entry3) ||
          serializedValuesEqual(entry, entry3)
        ) {
          mergedById.set(value, entry2);
        } else if (serializedValuesEqual(entry, entry2)) {
          mergedById.set(value, cloneJsonValue(entry3));
        } else {
          conflicts.push(value2);
          mergedById.set(
            value,
            choice === "theirs" ? cloneJsonValue(entry3) : entry2,
          );
        }
        continue;
      }
      let value3 = entry2 ?? entry3;
      if (entry === undefined) {
        mergedById.set(
          value,
          entry2 !== undefined ? value3 : cloneJsonValue(value3),
        );
        continue;
      }
      if (serializedValuesEqual(entry, value3)) {
        continue;
      }
      conflicts.push(value2);
      if (entry2 !== undefined ? choice === "mine" : choice === "theirs") {
        mergedById.set(
          value,
          entry2 !== undefined ? value3 : cloneJsonValue(value3),
        );
      }
    }
    let ids = (input: JsonRecord[]) =>
        input.map((input2: JsonRecord) => input2[identityField] as string),
      order = (0, runtime.mergeOrderedStringList)(
        ids(base),
        ids(mine),
        ids(theirs),
      ).filter((input: string) => mergedById.has(input));
    for (let value of mergedById.keys()) {
      if (!order.includes(value)) {
        order.push(value);
      }
    }
    return order.map((input: string) => mergedById.get(input));
  }
  function mergeJsonThreeWays(
    base: JsonMergeValue,
    mine: JsonMergeValue,
    theirs: JsonMergeValue,
    choice: MergeChoice = "mine",
  ) {
    let conflicts: string[] = [];
    return {
      value: mergeJsonValueThreeWays(base, mine, theirs, "", conflicts, choice),
      conflicts: conflicts,
    };
  }
  function parseMergeableTokens(
    text: string,
    strict: boolean,
  ): JsonMergeValue | null {
    let report = {
        dropped: [],
        warnings: [],
      },
      parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    if (!isPlainMergeRecord(parsed)) {
      return null;
    }
    let tokens = (0, runtime.parseTokens)(parsed, report);
    if (strict && report.dropped.length > 0) {
      return null;
    }
    try {
      return JSON.parse((0, runtime.serializeTokens)(tokens));
    } catch {
      return null;
    }
  }
  function mergeTokenFileThreeWays(
    baseText: string,
    mineText: string,
    theirsText: string,
    choice: MergeChoice = "mine",
  ): TokenMergeResult {
    if (mineText === theirsText) {
      return {
        ok: true,
        text: mineText,
        kept: [],
      };
    }
    let base = parseMergeableTokens(baseText, false),
      mine = parseMergeableTokens(mineText, true),
      theirs = parseMergeableTokens(theirsText, true);
    if (base === null || mine === null || theirs === null) {
      return {
        ok: false,
        why: "unreadable",
        conflicts: [],
      };
    }
    let merged = mergeJsonThreeWays(base, mine, theirs, choice);
    if (merged.conflicts.length > 0 && choice === "mine") {
      return {
        ok: false,
        why: "conflict",
        conflicts: merged.conflicts,
      };
    }
    let report = {
        dropped: [],
        warnings: [],
      },
      normalized = (0, runtime.parseTokens)(merged.value, report);
    if (report.dropped.length > 0) {
      return {
        ok: false,
        why: "unreadable",
        conflicts: [],
      };
    }
    return {
      ok: true,
      text: (0, runtime.serializeTokens)(normalized),
      kept: choice === "theirs" ? merged.conflicts : [],
    };
  }
  function mergeSupportedFileThreeWays(
    path: string,
    base: string,
    mine: string,
    theirs: string,
    choice: MergeChoice = "mine",
  ): TokenMergeResult | null {
    if (isTokenFilePath(path)) {
      return mergeTokenFileThreeWays(base, mine, theirs, choice);
    } else {
      return null;
    }
  }
  function fileContentsSemanticallyEqual(
    path: string,
    left: string,
    right: string,
  ) {
    if (left === right) {
      return true;
    }
    if (!isTokenFilePath(path)) {
      return false;
    }
    let leftTokens = parseMergeableTokens(left, false),
      rightTokens = parseMergeableTokens(right, false);
    return (
      leftTokens !== null &&
      rightTokens !== null &&
      serializedValuesEqual(leftTokens, rightTokens)
    );
  }
  function summarizeConflictNames(paths: readonly string[]) {
    let names = [
      ...new Set(
        paths
          .map((input: string) => input.slice(input.lastIndexOf("/") + 1))
          .filter((input: string): boolean => input !== ""),
      ),
    ];
    if (names.length <= 3) {
      return names.join(", ");
    } else {
      return (
        names.slice(0, 3).join(", ") +
        " and " +
        String(names.length - 3) +
        " more"
      );
    }
  }
  function remoteTextLostLocalLines(
    base: string,
    mine: string,
    theirs: string,
  ): boolean {
    if (theirs === mine || mine === base) {
      return false;
    }
    if (theirs === base) {
      return true;
    }
    let lineCounts = (input: string) => {
        let entries = new Map<string, number>();
        for (let value of input.split(`
`)) {
          entries.set(value, (entries.get(value) ?? 0) + 1);
        }
        return entries;
      },
      baseLines = lineCounts(base),
      mineLines = lineCounts(mine),
      theirsLines = lineCounts(theirs),
      localAdditionsKept = 0;
    for (let [value, value2] of mineLines) {
      let value3 = value2 - (baseLines.get(value) ?? 0);
      if (value3 > 0) {
        localAdditionsKept += Math.min(
          value3,
          Math.max(
            0,
            (theirsLines.get(value) ?? 0) - (baseLines.get(value) ?? 0),
          ),
        );
      }
    }
    if (localAdditionsKept > 0) {
      return false;
    }
    let localRemovalsLost = 0;
    for (let [value, value2] of baseLines) {
      let value3 = value2 - (mineLines.get(value) ?? 0);
      if (value3 > 0) {
        localRemovalsLost += Math.min(
          value3,
          Math.max(
            0,
            (theirsLines.get(value) ?? 0) - (mineLines.get(value) ?? 0),
          ),
        );
      }
    }
    if (localRemovalsLost > 0) {
      return true;
    }
    for (let [value, value2] of baseLines) {
      if ((theirsLines.get(value) ?? 0) < value2) {
        return false;
      }
    }
    return true;
  }
  function availableConflictCopyName(
    path: string,
    available: (path: string) => boolean,
  ): string | null {
    let slash = path.lastIndexOf("/"),
      folder = path.slice(0, slash + 1),
      name = path.slice(slash + 1),
      extension = /\.d\.ts$/i.test(name)
        ? name.slice(-5)
        : name.lastIndexOf(".") > 0
          ? name.slice(name.lastIndexOf("."))
          : "",
      stem = name.slice(0, name.length - extension.length);
    for (let count: number = 1; count <= 20; count++) {
      let value: string =
        folder +
        stem +
        (count === 1 ? "-copy" : "-copy-" + String(count)) +
        extension;
      if (available(value)) {
        return value;
      }
    }
    return null;
  }
  bindRuntimeValue(
    runtime,
    "isPlainMergeRecord",
    () => isPlainMergeRecord,
    (value) => {
      isPlainMergeRecord = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializedValuesEqual",
    () => serializedValuesEqual,
    (value) => {
      serializedValuesEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cloneJsonValue",
    () => cloneJsonValue,
    (value) => {
      cloneJsonValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MERGE_ARRAY_ID_FIELDS",
    () => MERGE_ARRAY_ID_FIELDS,
    (value) => {
      MERGE_ARRAY_ID_FIELDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mergeArrayIdentityField",
    () => mergeArrayIdentityField,
  );
  bindRuntimeValue(
    runtime,
    "mergeJsonValueThreeWays",
    () => mergeJsonValueThreeWays,
  );
  bindRuntimeValue(
    runtime,
    "mergeIdentifiedArrayThreeWays",
    () => mergeIdentifiedArrayThreeWays,
  );
  bindRuntimeValue(runtime, "mergeJsonThreeWays", () => mergeJsonThreeWays);
  bindRuntimeValue(runtime, "parseMergeableTokens", () => parseMergeableTokens);
  bindRuntimeValue(
    runtime,
    "mergeTokenFileThreeWays",
    () => mergeTokenFileThreeWays,
  );
  bindRuntimeValue(
    runtime,
    "isTokenFilePath",
    () => isTokenFilePath,
    (value) => {
      isTokenFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mergeSupportedFileThreeWays",
    () => mergeSupportedFileThreeWays,
  );
  bindRuntimeValue(
    runtime,
    "fileContentsSemanticallyEqual",
    () => fileContentsSemanticallyEqual,
  );
  bindRuntimeValue(
    runtime,
    "summarizeConflictNames",
    () => summarizeConflictNames,
  );
  bindRuntimeValue(
    runtime,
    "remoteTextLostLocalLines",
    () => remoteTextLostLocalLines,
  );
  bindRuntimeValue(
    runtime,
    "availableConflictCopyName",
    () => availableConflictCopyName,
  );
  return () => {
    isPlainMergeRecord = (input: unknown): input is JsonRecord =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    serializedValuesEqual = (
      input: JsonMergeValue,
      options: JsonMergeValue,
    ): boolean => JSON.stringify(input) === JSON.stringify(options);
    cloneJsonValue = <T extends JsonMergeValue>(input: T): T =>
      input === undefined ? input : JSON.parse(JSON.stringify(input));
    MERGE_ARRAY_ID_FIELDS = ["id", "name", "key", "file"];
    isTokenFilePath = (input: string): boolean =>
      input === runtime.DESIGN_SYSTEM_PATHS.tokens;
  };
}

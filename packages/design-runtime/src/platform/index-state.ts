import type {
  DataRecord,
  MergePolicy,
  VersionedIndex,
  IndexStateOptions,
  IndexFileState,
  IndexWriteListener,
  IndexFileErrorConstructor,
  IndexFileErrorCode,
  ValidatedIndexStateOptions,
} from "../contracts/storage";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installPlatformIndexState(
  runtime: RuntimeBindings,
): () => void {
  var DESIGN_INDEX_MERGE_POLICY: MergePolicy;
  var IndexFileError: IndexFileErrorConstructor;
  function canonicalizeIndexValue(value: unknown, topLevel?: boolean): unknown {
    if (Array.isArray(value))
      return value.map((input) => canonicalizeIndexValue(input, false));
    if (!(0, runtime.isPlainMergeObject)(value)) return value;
    let keys = Object.keys(value)
      .filter((input) => value[input] !== undefined)
      .sort();
    if (topLevel) {
      let value2 = keys.indexOf("v");
      value2 > 0 && (keys.splice(value2, 1), keys.unshift("v"));
    }
    let state: DataRecord = {};
    for (let value2 of keys)
      (0, runtime.setSafeObjectKey)(
        state,
        value2,
        canonicalizeIndexValue(value[value2], false),
      );
    return state;
  }
  function stringifyCanonicalIndex(value: unknown): string {
    return (
      JSON.stringify(canonicalizeIndexValue(value, true), null, 2) +
      `
`
    );
  }
  function createIndexFileState<Index extends VersionedIndex>(
    options: IndexStateOptions<Index>,
  ): IndexFileState<Index> {
    let value = options.empty(),
      base: Index = (0, runtime.cloneIndexValue)(value) as Index,
      baseSha: string | null = null,
      raw: IndexWriteListener | undefined,
      conflicts: string[] = [],
      initialized = false;
    function parseIndex(input: string): Index {
      let value2: unknown;
      try {
        value2 = JSON.parse(input);
      } catch {
        throw new IndexFileError("unreadable", options.path + " is not JSON");
      }
      if (
        !(0, runtime.isPlainMergeObject)(value2) ||
        typeof value2.v != "number"
      )
        throw new IndexFileError(
          "unreadable",
          options.path + " has no numeric v",
        );
      let value3 = options.empty();
      if (value2.v > (options.maxVersion ?? value3.v))
        throw new IndexFileError(
          "newer_version",
          options.path +
            " was written by a newer editor (v " +
            String(value2.v) +
            ")",
        );
      for (let [value4, value5] of Object.entries(value3)) {
        if (value4 === "v") continue;
        let value6 = Array.isArray(value5)
          ? "array"
          : (0, runtime.isPlainMergeObject)(value5)
            ? "object"
            : undefined;
        if (value6 === undefined) continue;
        let value7 = value2[value4],
          value8 =
            options.schema.kind === "map"
              ? options.schema.keys?.[value4]
              : undefined;
        if (
          value8?.kind === "records" &&
          value6 === "array" &&
          (0, runtime.isPlainMergeObject)(value7)
        ) {
          let value9 = (0, runtime.normalizeMergeMap)(value7, value8.by);
          value2[value4] = Object.keys(value9).map((input2) => value9[input2]);
          continue;
        }
        ((value6 === "array" && !Array.isArray(value7)) ||
          (value6 === "object" && !(0, runtime.isPlainMergeObject)(value7))) &&
          (value2[value4] = value5);
      }
      if (options.validate && !options.validate(value2 as VersionedIndex)) {
        throw new IndexFileError(
          "unreadable",
          options.path + " does not match its document schema",
        );
      }
      return value2 as Index;
    }
    let callback = () => {
        initialized = true;
        raw?.(options.path, () => state.serialize(), baseSha);
      },
      state: IndexFileState<Index> = {
        path: options.path,
        parse: parseIndex,
        async load() {
          let value2;
          try {
            value2 = await options.port.readText(options.path);
          } catch (value3: unknown) {
            throw new IndexFileError(
              "not_found",
              options.path +
                ": " +
                (value3 instanceof Error
                  ? value3.message
                  : String(
                      (
                        value3 as
                          | {
                              message?: unknown;
                            }
                          | null
                          | undefined
                      )?.message ?? value3,
                    )),
            );
          }
          value = parseIndex(value2.text);
          base = (0, runtime.cloneIndexValue)(value) as Index;
          baseSha = value2.sha256;
          initialized = false;
          return value;
        },
        loadText(input, options2) {
          value = parseIndex(input);
          base = (0, runtime.cloneIndexValue)(value) as Index;
          baseSha = options2;
          initialized = false;
          return value;
        },
        init(input) {
          value = input ?? options.empty();
          base = options.empty();
          baseSha = null;
          callback();
          return value;
        },
        get: () => value,
        base: () => base,
        baseSha: () => baseSha,
        dirty: () => initialized,
        lastConflicts: () => [...conflicts],
        update(input) {
          input(value);
          callback();
        },
        mergeFrom(input) {
          conflicts = [];
          value = (0, runtime.preserveIndexProvenance)(
            (0, runtime.mergeIndexValues)(base, value, input, options.schema, {
              conflicts: conflicts,
              externalMembers: options.externalMembers,
            }),
            input,
            base,
          ) as Index;
          base = (0, runtime.cloneIndexValue)(input) as Index;
          return value;
        },
        serialize: () =>
          stringifyCanonicalIndex(
            (0, runtime.preserveIndexProvenance)(value, base),
          ),
        bind(input) {
          raw = input;
        },
        markSaved(input, options2) {
          try {
            base = JSON.parse(input);
          } catch {
            base = (0, runtime.cloneIndexValue)(value) as Index;
          }
          baseSha = options2;
          initialized = !(0, runtime.equalIndexValue)(base, value);
        },
        async reloadAndMerge() {
          let value2 = await options.port.readText(options.path);
          return value2.sha256 === baseSha
            ? []
            : (state.mergeFrom(parseIndex(value2.text)),
              (baseSha = value2.sha256),
              (initialized = !(0, runtime.equalIndexValue)(base, value)),
              initialized &&
                raw?.(options.path, () => state.serialize(), baseSha),
              [...conflicts]);
        },
      };
    return state;
  }
  bindRuntimeValue(
    runtime,
    "DESIGN_INDEX_MERGE_POLICY",
    () => DESIGN_INDEX_MERGE_POLICY,
    (value) => {
      DESIGN_INDEX_MERGE_POLICY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canonicalizeIndexValue",
    () => canonicalizeIndexValue,
  );
  bindRuntimeValue(
    runtime,
    "stringifyCanonicalIndex",
    () => stringifyCanonicalIndex,
  );
  bindRuntimeValue(
    runtime,
    "IndexFileError",
    () => IndexFileError,
    (value) => {
      IndexFileError = value;
    },
  );
  bindRuntimeValue(runtime, "createIndexFileState", () => createIndexFileState);
  return () => {
    DESIGN_INDEX_MERGE_POLICY = {
      kind: "map",
      keys: {
        launch: {
          kind: "map",
        },
        pages: {
          kind: "leaf",
        },
        boards: {
          kind: "map",
          of: {
            kind: "map",
            of: {
              kind: "leaf",
            },
          },
        },
        order: {
          kind: "list",
          membersOf: "boards",
        },
        notes: {
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
    IndexFileError = class extends Error {
      declare name: string;
      constructor(input: IndexFileErrorCode, options: string) {
        super(options);
        this.code = input;
        this.name = "IndexFileError";
      }
      code: IndexFileErrorCode;
    };
  };
}

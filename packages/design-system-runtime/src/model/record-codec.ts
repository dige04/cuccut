import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelRecordCodec(runtime: RuntimeBindings): () => void {
  var JSON_HTML_ESCAPE_PATTERN: RegExp;
  var JSON_LINE_SEPARATOR_ESCAPE_PATTERN: RegExp;
  var DELETE_DOCUMENT_RECORD: symbol;
  var canonicalJsonCache: WeakMap<object, string>;
  var COMMENT_DOCUMENT_PREFIX: string;
  var MAX_COLLECTION_DOCUMENTS: number;
  var DB_ERROR_CODES: string[];
  function estimateEmbeddedJsonBytes(value: unknown): number {
    let json = JSON.stringify(value)!,
      escapeBytes =
        5 * (json.match(JSON_HTML_ESCAPE_PATTERN)?.length ?? 0) +
        3 * (json.match(JSON_LINE_SEPARATOR_ESCAPE_PATTERN)?.length ?? 0);
    return new TextEncoder().encode(json).length + escapeBytes;
  }
  function isCanonicalJsonObject(
    input: unknown,
  ): input is Storage.DatabaseRecord {
    return typeof input === "object" && input !== null && !Array.isArray(input);
  }
  function sortJsonObjectKeys(key: string, value: unknown): unknown {
    if (!isCanonicalJsonObject(value)) {
      return value;
    }
    let sorted: Storage.DatabaseRecord = {};
    for (let value2 of Object.keys(value).sort()) {
      sorted[value2] = value[value2];
    }
    return sorted;
  }
  function canonicalJsonString(value: object): string {
    let cached = canonicalJsonCache.get(value);
    if (cached !== undefined) {
      return cached;
    }
    let canonical = JSON.stringify(value, sortJsonObjectKeys) ?? "undefined";
    canonicalJsonCache.set(value, canonical);
    return canonical;
  }
  function documentRecordsEqual(left: unknown, right: unknown): boolean {
    if (left === right) {
      return true;
    }
    if (
      typeof left !== "object" ||
      typeof right !== "object" ||
      left === null ||
      right === null
    ) {
      return false;
    }
    return canonicalJsonString(left) === canonicalJsonString(right);
  }
  function jsonValueDepth(value: unknown, maxDepth: number = 64): number {
    if (typeof value !== "object" || value === null) {
      return 0;
    }
    let depth: number = 0;
    for (let value2 of Array.isArray(value)
      ? (value as readonly unknown[])
      : Object.values<unknown>(value as Storage.DatabaseRecord)) {
      if (
        ((depth = Math.max(depth, jsonValueDepth(value2, maxDepth - 1))),
        depth >= maxDepth)
      ) {
        break;
      }
    }
    return depth + 1;
  }
  function decomposeCommentDocuments(
    comments: readonly Host.ArtifactComment[],
    previous: ReadonlyMap<string, Storage.DatabaseRecord> | undefined,
    documents: Storage.DocumentRecords,
  ): void {
    for (let value of comments) {
      let value2: string = COMMENT_DOCUMENT_PREFIX + "/" + value.id,
        state: Storage.DatabaseRecord = {};
      for (let [value4, value5] of Object.entries(value) as [
        string,
        unknown,
      ][]) {
        if (value5 !== undefined) {
          state[value4] = value5;
        }
      }
      let value3 = previous?.get(value2);
      documents.set(
        value2,
        value3 !== undefined && documentRecordsEqual(value3, state)
          ? value3
          : state,
      );
    }
  }
  function composeCommentDocuments(
    documents: ReadonlyMap<string, Storage.DatabaseRecord>,
  ): Host.ArtifactComment[] {
    let comments: Storage.RawComment[] = [],
      prefix: string = COMMENT_DOCUMENT_PREFIX + "/";
    for (let [value, value2] of documents) {
      if (!value.startsWith(prefix) || value.indexOf("/", prefix.length) >= 0) {
        continue;
      }
      comments.push({
        ...value2,
        id: value.slice(prefix.length),
      });
    }
    return (0, runtime.normalizeComments)(comments);
  }
  function normalizeDatabaseError(error: unknown): Storage.DatabaseError {
    let object: Storage.DatabaseRecord =
        typeof error === "object" && error !== null
          ? (error as Storage.DatabaseRecord)
          : {},
      isDbTypeError =
        object.name === "TypeError" &&
        typeof object.message === "string" &&
        object.message.startsWith("db "),
      code =
        typeof object.code === "string" && DB_ERROR_CODES.includes(object.code)
          ? object.code
          : isDbTypeError
            ? "invalid_argument"
            : "unavailable",
      message =
        typeof object.message === "string"
          ? object.message
          : error instanceof Error
            ? error.message
            : String(code);
    return {
      code: code,
      message: message,
    };
  }
  function createDatabaseAdapter(
    database: Storage.NativeDatabase,
  ): Storage.DatabasePort {
    return {
      subscribe(
        input: string,
        options: (
          changes: Storage.DatabaseChange[],
          info: Storage.DatabaseSnapshotInfo,
        ) => void,
        context: (error: Storage.DatabaseError) => void,
      ): () => void {
        let flag: boolean = true,
          value: (() => void) | undefined;
        try {
          value = database
            .collection(input)
            .limit(MAX_COLLECTION_DOCUMENTS)
            .onSnapshot(
              (input2: Storage.DatabaseQuerySnapshot): void => {
                let items: Storage.DatabaseChange[] = [];
                for (let value3 of input2.docChanges()) {
                  let value4: string = input + "/" + value3.doc.id;
                  if (value3.type === "removed") {
                    items.push({
                      type: "removed",
                      path: value4,
                    });
                  } else {
                    items.push({
                      type: value3.type,
                      path: value4,
                      data: value3.doc.data() ?? {},
                    });
                  }
                }
                let value2: boolean = flag;
                flag = false;
                options(items, {
                  initial: value2,
                  fromCache: input2.metadata?.fromCache === true,
                  hasPendingWrites: input2.metadata?.hasPendingWrites === true,
                });
              },
              (input2: unknown) => context(normalizeDatabaseError(input2)),
            );
        } catch (value2: unknown) {
          queueMicrotask(() => context(normalizeDatabaseError(value2)));
        }
        return (): void => {
          try {
            value?.();
          } catch {}
        };
      },
      async set(input: string, options: Storage.DatabaseRecord): Promise<void> {
        try {
          await database.doc(input).set({
            ...options,
          });
        } catch (value: unknown) {
          throw normalizeDatabaseError(value);
        }
      },
      async update(
        input: string,
        options: Storage.DatabaseRecord,
      ): Promise<void> {
        try {
          await database.doc(input).update({
            ...options,
          });
        } catch (value: unknown) {
          throw normalizeDatabaseError(value);
        }
      },
      async del(input: string): Promise<void> {
        try {
          await database.doc(input).delete();
        } catch (value: unknown) {
          throw normalizeDatabaseError(value);
        }
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "JSON_HTML_ESCAPE_PATTERN",
    () => JSON_HTML_ESCAPE_PATTERN,
    (value) => {
      JSON_HTML_ESCAPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "JSON_LINE_SEPARATOR_ESCAPE_PATTERN",
    () => JSON_LINE_SEPARATOR_ESCAPE_PATTERN,
    (value) => {
      JSON_LINE_SEPARATOR_ESCAPE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "estimateEmbeddedJsonBytes",
    () => estimateEmbeddedJsonBytes,
  );
  bindRuntimeValue(
    runtime,
    "DELETE_DOCUMENT_RECORD",
    () => DELETE_DOCUMENT_RECORD,
    (value) => {
      DELETE_DOCUMENT_RECORD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isCanonicalJsonObject",
    () => isCanonicalJsonObject,
  );
  bindRuntimeValue(
    runtime,
    "canonicalJsonCache",
    () => canonicalJsonCache,
    (value) => {
      canonicalJsonCache = value;
    },
  );
  bindRuntimeValue(runtime, "sortJsonObjectKeys", () => sortJsonObjectKeys);
  bindRuntimeValue(runtime, "canonicalJsonString", () => canonicalJsonString);
  bindRuntimeValue(runtime, "documentRecordsEqual", () => documentRecordsEqual);
  bindRuntimeValue(runtime, "jsonValueDepth", () => jsonValueDepth);
  bindRuntimeValue(
    runtime,
    "COMMENT_DOCUMENT_PREFIX",
    () => COMMENT_DOCUMENT_PREFIX,
    (value) => {
      COMMENT_DOCUMENT_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decomposeCommentDocuments",
    () => decomposeCommentDocuments,
  );
  bindRuntimeValue(
    runtime,
    "composeCommentDocuments",
    () => composeCommentDocuments,
  );
  bindRuntimeValue(
    runtime,
    "MAX_COLLECTION_DOCUMENTS",
    () => MAX_COLLECTION_DOCUMENTS,
    (value) => {
      MAX_COLLECTION_DOCUMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DB_ERROR_CODES",
    () => DB_ERROR_CODES,
    (value) => {
      DB_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDatabaseError",
    () => normalizeDatabaseError,
  );
  bindRuntimeValue(
    runtime,
    "createDatabaseAdapter",
    () => createDatabaseAdapter,
  );
  return () => {
    JSON_HTML_ESCAPE_PATTERN = /[<>&]/g;
    JSON_LINE_SEPARATOR_ESCAPE_PATTERN = /[\u2028\u2029]/g;
    DELETE_DOCUMENT_RECORD = Symbol("DELETE_DOC");
    canonicalJsonCache = new WeakMap();
    COMMENT_DOCUMENT_PREFIX = "comments";
    MAX_COLLECTION_DOCUMENTS = 1000;
    DB_ERROR_CODES = [
      "invalid_argument",
      "resource_exhausted",
      "quota_exceeded",
      "unavailable",
      "revoked",
      "not_granted",
      "capability_disabled",
      "capability_removed",
      "transform_error",
    ];
  };
}

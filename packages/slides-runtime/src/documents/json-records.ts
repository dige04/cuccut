/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** A stored document record: a JSON object (slide, typeface, deck metadata or comment). */
export type DocumentRecord = Record<string, unknown>;
/** The records of a synced document set, keyed by path (`collection/key`). */
export type DocumentRecords = Map<string, DocumentRecord>;

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSpeakerNotesPanel: ReactNamespace;
    JSON_HTML_ESCAPE_PATTERN: RegExp;
    JSON_LINE_SEPARATOR_ESCAPE_PATTERN: RegExp;
    estimateEmbeddedJsonBytes: (value: unknown) => number;
    DELETE_DOCUMENT_RECORD: symbol;
    isCanonicalJsonObject: (input: unknown) => input is Record<string, unknown>;
    canonicalJsonCache: WeakMap<object, string>;
    sortJsonObjectKeys: (key: string, value: unknown) => unknown;
    canonicalJsonString: (value: object) => string;
    documentRecordsEqual: (left: unknown, right: unknown) => boolean;
    basenameDocumentPath: (input: string) => string;
  }
}

export function installDocumentsJsonRecords(
  runtime: RuntimeBindings,
): () => void {
  var ReactSpeakerNotesPanel: ReactNamespace;
  var JSON_HTML_ESCAPE_PATTERN: RegExp;
  var JSON_LINE_SEPARATOR_ESCAPE_PATTERN: RegExp;
  var DELETE_DOCUMENT_RECORD: symbol;
  var canonicalJsonCache: WeakMap<object, string>;
  function estimateEmbeddedJsonBytes(value: unknown): number {
    let json = JSON.stringify(value),
      escapedBytes =
        5 * (json.match(JSON_HTML_ESCAPE_PATTERN)?.length ?? 0) +
        3 * (json.match(JSON_LINE_SEPARATOR_ESCAPE_PATTERN)?.length ?? 0);
    return new TextEncoder().encode(json).length + escapedBytes;
  }
  function isCanonicalJsonObject(
    input: unknown,
  ): input is Record<string, unknown> {
    return typeof input === "object" && input !== null && !Array.isArray(input);
  }
  function sortJsonObjectKeys(key: string, value: unknown): unknown {
    if (!isCanonicalJsonObject(value)) {
      return value;
    }
    let sortedObject: Record<string, unknown> = {};
    for (let value2 of Object.keys(value).sort())
      sortedObject[value2] = value[value2];
    return sortedObject;
  }
  function canonicalJsonString(value: object): string {
    let cached = canonicalJsonCache.get(value);
    if (cached !== undefined) {
      return cached;
    }
    let canonical =
      JSON.stringify(value, sortJsonObjectKeys) ?? "undefined";
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
  function basenameDocumentPath(input: string): string {
    return input.slice(input.lastIndexOf("/") + 1);
  }
  bindRuntimeValue(
    runtime,
    "ReactSpeakerNotesPanel",
    () => ReactSpeakerNotesPanel,
    (value) => {
      ReactSpeakerNotesPanel = value;
    },
  );
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
  bindRuntimeValue(runtime, "basenameDocumentPath", () => basenameDocumentPath);
  return () => {
    (0, runtime.initializeSlideModel)();
    ReactSpeakerNotesPanel = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeSlideModel)();
    JSON_HTML_ESCAPE_PATTERN = /[<>&]/g;
    JSON_LINE_SEPARATOR_ESCAPE_PATTERN = /[\u2028\u2029]/g;
    DELETE_DOCUMENT_RECORD = Symbol("DELETE_DOC");
    canonicalJsonCache = new WeakMap();
  };
}

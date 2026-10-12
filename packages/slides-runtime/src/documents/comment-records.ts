/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { ArtifactComment } from "./artifact-document";
import type { DocumentRecord, DocumentRecords } from "./json-records";

declare module "../bindings" {
  interface RuntimeBindings {
    COMMENT_DOCUMENT_PREFIX: string;
    decomposeCommentDocuments: (
      comments: ArtifactComment[],
      previousRecords: ReadonlyMap<string, DocumentRecord> | undefined,
      records: DocumentRecords,
    ) => void;
    composeCommentDocuments: (
      records: Iterable<[string, DocumentRecord]>,
    ) => ArtifactComment[];
  }
}

export function installDocumentsCommentRecords(
  runtime: RuntimeBindings,
): () => void {
  var COMMENT_DOCUMENT_PREFIX: string;
  function decomposeCommentDocuments(
    comments: ArtifactComment[],
    previousRecords: ReadonlyMap<string, DocumentRecord> | undefined,
    records: DocumentRecords,
  ): void {
    for (let value of comments) {
      let value2 = COMMENT_DOCUMENT_PREFIX + "/" + value.id,
        state: Record<string, unknown> = {};
      for (let [value4, value5] of Object.entries(value) as [
        string,
        unknown,
      ][])
        if (value5 !== undefined) {
          state[value4] = value5;
        }
      let value3 = previousRecords?.get(value2);
      records.set(
        value2,
        value3 !== undefined && (0, runtime.documentRecordsEqual)(value3, state)
          ? value3
          : state,
      );
    }
  }
  function composeCommentDocuments(
    records: Iterable<[string, DocumentRecord]>,
  ): ArtifactComment[] {
    let comments: Record<string, unknown>[] = [],
      prefix = COMMENT_DOCUMENT_PREFIX + "/";
    for (let [value, value2] of records) {
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
  return () => {
    COMMENT_DOCUMENT_PREFIX = "comments";
  };
}

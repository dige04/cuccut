/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** A comment on the artifact, as normalised from stored or incoming data. */
export interface ArtifactComment {
  id: string;
  text: string;
  /** Creation time in milliseconds since the epoch. */
  at: number;
  author: string;
  userId?: string;
  /** Key of the slide element the comment is attached to. */
  elementKey?: string;
  elementLabel?: string;
  /** Image sources: blob paths or small data URLs. */
  images?: string[];
}
/** A change to the comment list: add a comment or remove one by id. */
export type CommentOperation =
  | { op: "add"; comment: ArtifactComment }
  | { op: "remove"; id: string };
type IsValidCommentImage = (source: string) => boolean;
type CommentObjectProperty = (value: unknown, key: string) => unknown;
type NormalizeComments = (comments: unknown) => ArtifactComment[];
type ApplyCommentOperations = (
  comments: ArtifactComment[],
  operations: CommentOperation[],
) => ArtifactComment[];
type ApplicableCommentOperations = (
  comments: ArtifactComment[],
  operations: CommentOperation[],
) => CommentOperation[];
type NormalizeCommentOperations = (operations: unknown) => CommentOperation[];

declare module "../bindings" {
  interface RuntimeBindings {
    MAX_ARTIFACT_COMMENTS: number;
    MAX_COMMENT_TEXT_LENGTH: number;
    MAX_COMMENT_IMAGES: number;
    isValidCommentImage: IsValidCommentImage;
    commentObjectProperty: CommentObjectProperty;
    normalizeComments: NormalizeComments;
    applyCommentOperations: ApplyCommentOperations;
    applicableCommentOperations: ApplicableCommentOperations;
    normalizeCommentOperations: NormalizeCommentOperations;
  }
}

export function installModelComments(runtime: RuntimeBindings): () => void {
  var MAX_ARTIFACT_COMMENTS: number;
  var MAX_COMMENT_TEXT_LENGTH: number;
  var MAX_COMMENT_IMAGES: number;
  function isValidCommentImage(source: string): boolean {
    if (/^\/?_blob\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(source)) {
      return true;
    }
    return (
      source.length <= 200000 &&
      /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(source)
    );
  }
  function commentObjectProperty(value: unknown, key: string): unknown {
    if (typeof value === "object" && value !== null) {
      return (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  function normalizeComments(comments: unknown): ArtifactComment[] {
    if (!Array.isArray(comments)) {
      return [];
    }
    let items: ArtifactComment[] = [],
      values = new Set<string>();
    for (let value of comments as unknown[]) {
      let value2 = commentObjectProperty(value, "id"),
        value3 = commentObjectProperty(value, "text"),
        value4 = commentObjectProperty(value, "at");
      if (
        typeof value2 !== "string" ||
        value2.length === 0 ||
        value2.length > 64 ||
        values.has(value2) ||
        typeof value3 !== "string" ||
        typeof value4 !== "number" ||
        !Number.isFinite(value4)
      ) {
        continue;
      }
      values.add(value2);
      let value5 = commentObjectProperty(value, "author"),
        value6 = commentObjectProperty(value, "userId"),
        value7 = commentObjectProperty(value, "elementKey"),
        value8 = commentObjectProperty(value, "elementLabel"),
        value9 = commentObjectProperty(value, "images"),
        value10: string[] = Array.isArray(value9)
          ? value9
              .filter(
                (input: unknown): input is string =>
                  typeof input === "string" && isValidCommentImage(input),
              )
              .slice(0, MAX_COMMENT_IMAGES)
          : [];
      items.push({
        id: value2,
        text: (0, runtime.truncateUtf16Safely)(value3, MAX_COMMENT_TEXT_LENGTH),
        at: value4,
        author:
          typeof value5 === "string" && value5.length > 0
            ? (0, runtime.truncateUtf16Safely)(value5, 80)
            : "viewer",
        userId:
          typeof value6 === "string" && value6.length > 0
            ? (0, runtime.truncateUtf16Safely)(value6, 128)
            : undefined,
        elementKey:
          typeof value7 === "string" && value7.length > 0
            ? (0, runtime.truncateUtf16Safely)(value7, 400)
            : undefined,
        elementLabel:
          typeof value8 === "string"
            ? (0, runtime.truncateUtf16Safely)(value8, 160)
            : undefined,
        ...(value10.length > 0
          ? {
              images: value10,
            }
          : {}),
      });
    }
    items.sort((input, options) => input.at - options.at);
    return items.slice(-MAX_ARTIFACT_COMMENTS);
  }
  function applyCommentOperations(
    comments: ArtifactComment[],
    operations: CommentOperation[],
  ): ArtifactComment[] {
    let value = comments;
    for (let value2 of operations)
      if (value2.op === "add") {
        if (value.some((input) => input.id === value2.comment.id)) {
          continue;
        }
        if (value.length >= MAX_ARTIFACT_COMMENTS) {
          continue;
        }
        value = [...value, value2.comment].sort(
          (input, options) => input.at - options.at,
        );
      } else {
        value = value.filter((input) => input.id !== value2.id);
      }
    return value;
  }
  function applicableCommentOperations(
    comments: ArtifactComment[],
    operations: CommentOperation[],
  ): CommentOperation[] {
    let values = new Set(comments.map((input) => input.id));
    return operations.filter((input) =>
      input.op === "add"
        ? !values.has(input.comment.id)
        : values.has(input.id),
    );
  }
  function normalizeCommentOperations(operations: unknown): CommentOperation[] {
    if (!Array.isArray(operations)) {
      return [];
    }
    let items: CommentOperation[] = [];
    for (let value of operations as unknown[]) {
      let value2 = commentObjectProperty(value, "op");
      if (value2 === "add") {
        let value3 = normalizeComments([
          commentObjectProperty(value, "comment"),
        ])[0];
        if (value3) {
          items.push({
            op: "add",
            comment: value3,
          });
        }
      } else if (value2 === "remove") {
        let value3 = commentObjectProperty(value, "id");
        if (
          typeof value3 === "string" &&
          value3.length > 0 &&
          value3.length <= 64
        ) {
          items.push({
            op: "remove",
            id: value3,
          });
        }
      }
    }
    return items;
  }
  bindRuntimeValue(
    runtime,
    "MAX_ARTIFACT_COMMENTS",
    () => MAX_ARTIFACT_COMMENTS,
    (value) => {
      MAX_ARTIFACT_COMMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COMMENT_TEXT_LENGTH",
    () => MAX_COMMENT_TEXT_LENGTH,
    (value) => {
      MAX_COMMENT_TEXT_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COMMENT_IMAGES",
    () => MAX_COMMENT_IMAGES,
    (value) => {
      MAX_COMMENT_IMAGES = value;
    },
  );
  bindRuntimeValue(runtime, "isValidCommentImage", () => isValidCommentImage);
  bindRuntimeValue(
    runtime,
    "commentObjectProperty",
    () => commentObjectProperty,
  );
  bindRuntimeValue(runtime, "normalizeComments", () => normalizeComments);
  bindRuntimeValue(
    runtime,
    "applyCommentOperations",
    () => applyCommentOperations,
  );
  bindRuntimeValue(
    runtime,
    "applicableCommentOperations",
    () => applicableCommentOperations,
  );
  bindRuntimeValue(
    runtime,
    "normalizeCommentOperations",
    () => normalizeCommentOperations,
  );
  return () => {
    MAX_ARTIFACT_COMMENTS = 200;
    MAX_COMMENT_TEXT_LENGTH = 4000;
    MAX_COMMENT_IMAGES = 4;
  };
}

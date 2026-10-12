import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorCommentAnchors(
  runtime: RuntimeBindings,
): () => void {
  var COMMENT_TARGET_PROPS: { "data-comment-target": string };
  var UNCOMMENTABLE_PROPS: { "data-uncommentable": string };
  function commentAnchorHash(text: string): string {
    let hash = 2166136261;
    for (let index: number = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36).padStart(7, "0").slice(-7);
  }
  function commentTargetId(prefix: string, name: string): string {
    let availableLength: number = 64 - prefix.length - 1,
      safeName = name.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (safeName === name && name !== "" && name.length <= availableLength) {
      return prefix + "-" + name;
    }
    let truncatedName = safeName
      .slice(0, availableLength - 7 - 1)
      .replace(/-+$/, "");
    return (
      prefix +
      "-" +
      (truncatedName === "" ? "" : truncatedName + "-") +
      commentAnchorHash(name)
    );
  }
  function commentTargetProps(prefix: string, name: string) {
    return {
      "data-id": commentTargetId(prefix, name),
      "data-comment-target": "",
      // CucCut: 另带原名，宿主的标注层（packages/design-system/src/editor/comment-targets.ts）写位置标签用；
      // 名字不干净或太长时 data-id 是截短加哈希，认不回原名
      "data-comment-name": name,
    };
  }
  bindRuntimeValue(runtime, "commentAnchorHash", () => commentAnchorHash);
  bindRuntimeValue(runtime, "commentTargetId", () => commentTargetId);
  bindRuntimeValue(runtime, "commentTargetProps", () => commentTargetProps);
  bindRuntimeValue(
    runtime,
    "COMMENT_TARGET_PROPS",
    () => COMMENT_TARGET_PROPS,
    (value) => {
      COMMENT_TARGET_PROPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNCOMMENTABLE_PROPS",
    () => UNCOMMENTABLE_PROPS,
    (value) => {
      UNCOMMENTABLE_PROPS = value;
    },
  );
  return () => {
    COMMENT_TARGET_PROPS = {
      "data-comment-target": "",
    };
    UNCOMMENTABLE_PROPS = {
      "data-uncommentable": "",
    };
  };
}

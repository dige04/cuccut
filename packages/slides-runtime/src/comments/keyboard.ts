/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** A box in pixels; DOMRect and the absolutely positioned highlight boxes both satisfy it. */
export interface CommentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a comment lands: pixel position plus the fractions (0..1) inside the box it was measured against. */
export interface CommentPoint {
  x: number;
  y: number;
  fx: number;
  fy: number;
}

/** What a keyboard-focusable comment target stands for (picks the instructions text). */
export type CommentTargetKind = "canvas-slide" | "slide" | "element";

declare module "../bindings" {
  interface RuntimeBindings {
    SCROLLED_OUT_COMMENT_TARGET_MESSAGE: string;
    defaultCommentPoint: (rect: CommentBox, inset?: number) => CommentPoint;
    formatCommentTargetLabel: (label: string) => string;
    commentKeyboardInstructions: (
      targetKind: CommentTargetKind,
      multipleSlides?: boolean,
    ) => string;
    isCommentKeyboardTarget: (event: { target: EventTarget | null }) => boolean;
  }
}

export function installCommentsKeyboard(runtime: RuntimeBindings): () => void {
  var SCROLLED_OUT_COMMENT_TARGET_MESSAGE: string;
  function defaultCommentPoint(
    rect: CommentBox,
    inset = 16,
  ): CommentPoint {
    let value = Math.max(0, rect.width),
      value2 = Math.max(0, rect.height),
      value3 = Math.min(inset, value / 4, value2 / 4),
      value4 = rect.left + value - value3,
      value5 = rect.top + value3;
    return {
      x: value4,
      y: value5,
      fx: value > 0 ? (value4 - rect.left) / value : 0.5,
      fy: value2 > 0 ? (value5 - rect.top) / value2 : 0.5,
    };
  }
  function formatCommentTargetLabel(label: string): string {
    return "Comment on " + label;
  }
  function commentKeyboardInstructions(
    targetKind: CommentTargetKind,
    multipleSlides = false,
  ): string {
    if (targetKind === "canvas-slide") {
      return (
        "Enter or Space comments on this slide;" +
        (multipleSlides ? " Tab moves to the next slide;" : "") +
        " Escape leaves comment mode"
      );
    }
    if (targetKind === "slide") {
      return (
        "Enter or Space comments on this slide;" +
        (multipleSlides ? " Tab moves to the things on it;" : "") +
        " Escape leaves comment mode"
      );
    } else {
      return "Enter or Space comments on this; Escape leaves comment mode";
    }
  }
  function isCommentKeyboardTarget(event: {
    target: EventTarget | null;
  }): boolean {
    return (
      event.target instanceof Element &&
      event.target.hasAttribute("data-slides-comment-target")
    );
  }
  bindRuntimeValue(runtime, "defaultCommentPoint", () => defaultCommentPoint);
  bindRuntimeValue(
    runtime,
    "formatCommentTargetLabel",
    () => formatCommentTargetLabel,
  );
  bindRuntimeValue(
    runtime,
    "commentKeyboardInstructions",
    () => commentKeyboardInstructions,
  );
  bindRuntimeValue(
    runtime,
    "isCommentKeyboardTarget",
    () => isCommentKeyboardTarget,
  );
  bindRuntimeValue(
    runtime,
    "SCROLLED_OUT_COMMENT_TARGET_MESSAGE",
    () => SCROLLED_OUT_COMMENT_TARGET_MESSAGE,
    (value) => {
      SCROLLED_OUT_COMMENT_TARGET_MESSAGE = value;
    },
  );
  return () => {
    SCROLLED_OUT_COMMENT_TARGET_MESSAGE =
      "This slide is scrolled out of view; zoom out or scroll back to comment on it; Escape leaves comment mode";
  };
}

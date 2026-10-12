/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

/** Where a comment pin's hotspot sits: pixels, or any CSS length string. */
export interface CommentPinPosition {
  x: number | string;
  y: number | string;
}

export interface CommentPinProps {
  at: CommentPinPosition;
  className?: string;
  "data-testid"?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CommentPinJsx: JsxNamespace;
    offsetCommentPinCoordinate: (
      coordinate: number | string,
      offset: number,
    ) => number | string;
    CommentPin: (props: CommentPinProps) => ReactElement;
  }
}

export function installCommentsPin(runtime: RuntimeBindings): () => void {
  var CommentPinJsx: JsxNamespace;
  var offsetCommentPinCoordinate: RuntimeBindings["offsetCommentPinCoordinate"];
  function CommentPin({
    at: at,
    className: className,
    "data-testid": dataTestid,
  }: CommentPinProps): ReactElement {
    return CommentPinJsx.jsx("svg", {
      "aria-hidden": true,
      "data-testid": dataTestid,
      className: (0, runtime.joinClassNames)(
        "pointer-events-none absolute",
        className,
      ),
      width: runtime.COMMENT_PIN_SIZE,
      height: runtime.COMMENT_PIN_SIZE,
      viewBox: `0 0 ${runtime.COMMENT_PIN_SIZE} ${runtime.COMMENT_PIN_SIZE}`,
      style: {
        left: offsetCommentPinCoordinate(at.x, runtime.COMMENT_PIN_HOTSPOT.x),
        top: offsetCommentPinCoordinate(at.y, runtime.COMMENT_PIN_HOTSPOT.y),
      },
      children: CommentPinJsx.jsx("path", {
        d: runtime.COMMENT_PIN_PATH,
        fill: runtime.COMMENT_PIN_FILL,
        stroke: runtime.COMMENT_PIN_STROKE,
        strokeWidth: runtime.COMMENT_PIN_STROKE_WIDTH,
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "CommentPinJsx",
    () => CommentPinJsx,
    (value) => {
      CommentPinJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "offsetCommentPinCoordinate",
    () => offsetCommentPinCoordinate,
    (value) => {
      offsetCommentPinCoordinate = value;
    },
  );
  bindRuntimeValue(runtime, "CommentPin", () => CommentPin);
  return () => {
    CommentPinJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    offsetCommentPinCoordinate = (coordinate, offset) =>
      typeof coordinate === "number"
        ? coordinate - offset
        : `calc(${coordinate} - ${offset}px)`;
  };
}

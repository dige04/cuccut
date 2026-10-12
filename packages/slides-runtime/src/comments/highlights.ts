/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties, ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { CommentPinPosition } from "./pin";

/** Props of the outline components: `rect` is the absolutely positioned box (left/top/width/height) to outline. */
export interface CommentHighlightProps {
  rect: CSSProperties;
}

export interface CommentKeyPinProps {
  at: CommentPinPosition;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CommentHighlightsJsx: JsxNamespace;
    CommentTargetHighlight: (props: CommentHighlightProps) => ReactElement;
    CommentKeyHighlight: (props: CommentHighlightProps) => ReactElement;
    CommentKeyPin: (props: CommentKeyPinProps) => ReactElement;
  }
}

export function installCommentsHighlights(
  runtime: RuntimeBindings,
): () => void {
  var CommentHighlightsJsx: JsxNamespace;
  function CommentTargetHighlight({
    rect: rect,
  }: CommentHighlightProps): ReactElement {
    return CommentHighlightsJsx.jsx("div", {
      "aria-hidden": true,
      className:
        "pointer-events-none absolute rounded-sm border-[1.5px] border-editor-comment-target",
      style: rect,
    });
  }
  function CommentKeyHighlight({
    rect: rect,
  }: CommentHighlightProps): ReactElement {
    return CommentHighlightsJsx.jsx("div", {
      "aria-hidden": true,
      "data-testid": "comment-key-ring",
      className:
        "pointer-events-none absolute rounded-sm border-2 border-editor-comment-target",
      style: {
        ...rect,
        boxShadow: "0 0 0 2px #fff",
      },
    });
  }
  function CommentKeyPin({ at: at }: CommentKeyPinProps): ReactElement {
    return CommentHighlightsJsx.jsx(runtime.CommentPin, {
      "data-testid": "comment-key-pin",
      at: at,
    });
  }
  bindRuntimeValue(
    runtime,
    "CommentHighlightsJsx",
    () => CommentHighlightsJsx,
    (value) => {
      CommentHighlightsJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CommentTargetHighlight",
    () => CommentTargetHighlight,
  );
  bindRuntimeValue(runtime, "CommentKeyHighlight", () => CommentKeyHighlight);
  bindRuntimeValue(runtime, "CommentKeyPin", () => CommentKeyPin);
  return () => {
    CommentHighlightsJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  AnchorDescription,
  EditorPoint,
} from "../../../slides/src/editor-messages";
import type { CommentAnchorController } from "../../../slides/src/editor/slides-host";

/** An element (frame) comment target before it is encoded into an anchor string; `path` walks into container children. */
export interface FrameCommentTarget {
  kind: "frame";
  slideId: string;
  frameId: string;
  path: number[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    lastCommentCompositionAt: number;
    elapsedSinceCommentComposition: () => number;
    commentAnchorController: CommentAnchorController | null;
    setCommentAnchorController: (
      controller: CommentAnchorController | null,
    ) => void;
    getCommentAnchorController: () => CommentAnchorController | null;
    composeFrameComment: (
      anchor: FrameCommentTarget,
      element: Element,
      label: EditorPoint,
      detail: (state: FrameCommentTarget) => AnchorDescription,
    ) => void;
  }
}

export function installCommentsComposer(runtime: RuntimeBindings): () => void {
  var lastCommentCompositionAt: number;
  var elapsedSinceCommentComposition: () => number;
  var commentAnchorController: CommentAnchorController | null;
  function setCommentAnchorController(
    controller: CommentAnchorController | null,
  ): void {
    commentAnchorController = controller;
  }
  function getCommentAnchorController(): CommentAnchorController | null {
    return commentAnchorController;
  }
  function composeFrameComment(
    anchor: FrameCommentTarget,
    element: Element,
    label: EditorPoint,
    detail: (state: FrameCommentTarget) => AnchorDescription,
  ): void {
    let controller = commentAnchorController;
    if (!controller || !element.isConnected) {
      return;
    }
    let value =
        (0, runtime.encodeSlideCommentAnchor)({
          ...anchor,
          fx: 0,
          fy: 0,
        }) === null,
      bounds = (
        value ? (element.closest("[data-frame-id]") ?? element) : element
      ).getBoundingClientRect(),
      value2 = Math.min(8, bounds.width / 2),
      value3 = Math.min(8, bounds.height / 2),
      value4 = Math.min(
        bounds.right - value2,
        Math.max(bounds.left + value2, label.x),
      ),
      value5 = Math.min(
        bounds.bottom - value3,
        Math.max(bounds.top + value3, label.y),
      ),
      state = {
        ...anchor,
        path: value ? [] : anchor.path,
      },
      value6 = (0, runtime.encodeSlideCommentAnchor)({
        ...state,
        fx: (value4 - bounds.left) / (bounds.width || 1),
        fy: (value5 - bounds.top) / (bounds.height || 1),
      });
    if (value6 === null) {
      return;
    }
    lastCommentCompositionAt = performance.now();
    controller
      .compose(
        value6,
        {
          x: value4 + window.scrollX,
          y: value5 + window.scrollY,
        },
        detail(state),
      )
      .catch((): void => {
        return;
      });
  }
  bindRuntimeValue(
    runtime,
    "lastCommentCompositionAt",
    () => lastCommentCompositionAt,
    (value) => {
      lastCommentCompositionAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "elapsedSinceCommentComposition",
    () => elapsedSinceCommentComposition,
    (value) => {
      elapsedSinceCommentComposition = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAnchorController",
    () => commentAnchorController,
    (value) => {
      commentAnchorController = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setCommentAnchorController",
    () => setCommentAnchorController,
  );
  bindRuntimeValue(
    runtime,
    "getCommentAnchorController",
    () => getCommentAnchorController,
  );
  bindRuntimeValue(runtime, "composeFrameComment", () => composeFrameComment);
  return () => {
    lastCommentCompositionAt = Number.NEGATIVE_INFINITY;
    elapsedSinceCommentComposition = () =>
      performance.now() - lastCommentCompositionAt;
    commentAnchorController = null;
  };
}

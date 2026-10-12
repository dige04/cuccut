/** Restored application module; prepare first, initialize in original order. */
import type { PointerEventHandler, ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { CommentUnitPoint } from "./area-geometry";
import type { CommentBox } from "./keyboard";

/** Props of the dashed outline that shows the area being drawn, held or resized. */
export interface CommentAreaSelectionOutlineProps {
  /** The outline's box in pixels, relative to the layer. */
  rect: CommentBox;
  /** The corner the area was started from (pixels, relative to the layer); no corner marker when null. */
  origin?: CommentUnitPoint | null;
  /** Show a resize handle on the origin corner. */
  handle?: boolean;
  onHandlePointerDown?: PointerEventHandler<HTMLDivElement>;
  /** What the outline stands for; ends up in `data-kind`. */
  kind: "marquee" | "thread" | "drawn";
}

/** The marquee while the pointer is down: the fixed corner (`pin`) and the moving one (`x1`, `y1`), as fractions of the stage. */
export interface CommentAreaMarquee {
  pin: CommentUnitPoint;
  x1: number;
  y1: number;
  /** An existing area is being resized rather than a new one drawn. */
  resizing: boolean;
}
/** What the area drag reports when a marquee is released. */
export interface CommentAreaDrop {
  /** The fixed corner of the area, as fractions of the stage. */
  c0: CommentUnitPoint;
  /** The corner where the pointer was released, as fractions of the stage. */
  c1: CommentUnitPoint;
  /** Where the composer should open (client pixels). */
  at: CommentUnitPoint;
  resizing: boolean;
}
/** What `useCommentAreaDrag` needs from the layer that hosts the drag. */
export interface CommentAreaDragInput {
  /** Client coordinates to fractions of the stage; null while the stage is not measurable. */
  toLocal: (clientX: number, clientY: number) => CommentUnitPoint | null;
  /** Fractions of the stage to client coordinates; null while the stage is not measurable. */
  toClient: (point: CommentUnitPoint) => CommentUnitPoint | null;
  /** The element the area is drawn over. */
  stage: () => Element | null;
  /** Pointer travel (pixels) that turns a click into a drag. */
  slopPx: number;
  /** The pointer was released without dragging (ignored while resizing). */
  onClick: (event: PointerEvent) => void;
  /** The gesture ended without producing an area. */
  onNothing: () => void;
  /** The drag has started (not called while resizing). */
  onLive?: () => void;
  onArea: (drop: CommentAreaDrop) => void;
}
/** The controller returned by `useCommentAreaDrag`. */
export interface CommentAreaDrag {
  marquee: CommentAreaMarquee | null;
  /** True while a drag gesture is in progress. */
  drawing: () => boolean;
  /**
   * Begin a drag from a pointer-down. `context` is the fixed corner when an existing area is being resized.
   * Returns false when the gesture cannot start.
   */
  start: (
    event: PointerEvent,
    target: Element,
    context?: CommentUnitPoint,
  ) => boolean;
  cancel: () => void;
}
/** An area that is drawn on the stage: a rectangle in fractions of the stage plus the corner (`ox`, `oy`) it was started from. */
export interface CommentDrawnArea {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** The slide the area belongs to; only the slide grid, which draws one canvas for many slides, sets it. */
  id?: string;
}
/** The controller returned by `useCommentMoveKeyHighlight`. */
export interface CommentMoveKeyHighlight<T> {
  /** The area to draw: the one held for the open composer, if it belongs to this scope. */
  drawn: T | null;
  /** Draw `rect` now (null removes it). */
  show: (rect: T | null) => void;
  /** Remember `rect` for `scope` and draw it while the composer is open. */
  hold: (rect: T, scope: string) => void;
  /** Draw the held area again (if the composer is open and the scope matches). */
  restore: () => void;
  /** Forget the held area and stop drawing it. */
  clear: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSlideComments: ReactNamespace;
    CommentAreaJsx: JsxNamespace;
    ReactCommentSelection: ReactNamespace;
    CommentAreaSelectionOutline: (
      props: CommentAreaSelectionOutlineProps,
    ) => ReactElement;
    COMMENT_AREA_RESIZE_MIN_PX: number;
    useCommentAreaDrag: (input: CommentAreaDragInput) => CommentAreaDrag;
    useCommentMoveKeyHighlight: <T extends CommentDrawnArea = CommentDrawnArea>(
      composing: boolean,
      scope: string,
    ) => CommentMoveKeyHighlight<T>;
  }
}

export function installCommentsAreaSelection(
  runtime: RuntimeBindings,
): () => void {
  var ReactSlideComments: ReactNamespace;
  var CommentAreaJsx: JsxNamespace;
  var ReactCommentSelection: ReactNamespace;
  var COMMENT_AREA_RESIZE_MIN_PX: number;
  function CommentAreaSelectionOutline({
    rect: rect,
    origin: origin,
    handle: handle,
    onHandlePointerDown: onHandlePointerDown,
    kind: kind,
  }: CommentAreaSelectionOutlineProps): ReactElement {
    return CommentAreaJsx.jsxs(CommentAreaJsx.Fragment, {
      children: [
        CommentAreaJsx.jsx("div", {
          "aria-hidden": true,
          "data-testid": "comment-area-outline",
          "data-kind": kind,
          className:
            "pointer-events-none absolute border border-dashed border-editor-comment-target",
          style: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
        }),
        origin
          ? CommentAreaJsx.jsx("div", {
              "aria-hidden": true,
              "data-testid": "comment-area-origin",
              className:
                "pointer-events-none absolute rounded-full ring-6 ring-inset ring-editor-comment-target",
              style: {
                left: origin.x - 5,
                top: origin.y - 5,
                width: 10,
                height: 10,
                outline: "2px solid transparent",
                outlineOffset: -2,
              },
            })
          : null,
        origin && handle
          ? CommentAreaJsx.jsx("div", {
              "data-area-handle": "",
              className: "absolute rounded-full",
              style: {
                left: origin.x - 9,
                top: origin.y - 9,
                width: 18,
                height: 18,
                cursor: "nwse-resize",
              },
              onPointerDown: onHandlePointerDown,
            })
          : null,
      ],
    });
  }
  function useCommentAreaDrag(input: CommentAreaDragInput): CommentAreaDrag {
    let [value, value2] =
        ReactCommentSelection.useState<CommentAreaMarquee | null>(null),
      ref = ReactCommentSelection.useRef(input);
    ref.current = input;
    let ref2 = ReactCommentSelection.useRef<{
        id: number;
        cleanup: () => void;
      } | null>(null),
      callback = (): void => {
        ref2.current?.cleanup();
        ref2.current = null;
        value2(null);
      };
    ReactCommentSelection.useEffect(
      (): (() => void) => (): void => ref2.current?.cleanup(),
      [],
    );
    return {
      marquee: value,
      drawing: (): boolean => ref2.current !== null,
      start: (
        input2: PointerEvent,
        options: Element,
        context?: CommentUnitPoint,
      ): boolean => {
        let current = ref.current,
          value3 = current.stage(),
          value4 =
            context ?? current.toLocal(input2.clientX, input2.clientY);
        if (!value3 || value4 == null) {
          return false;
        }
        callback();
        let pointerId = input2.pointerId;
        try {
          options.setPointerCapture(pointerId);
        } catch {}
        let callback2 = (): void => {
            callback();
            ref.current.onNothing();
          },
          callback3 = (input3: PointerEvent): boolean =>
            Math.hypot(
              input3.clientX - input2.clientX,
              input3.clientY - input2.clientY,
            ) > ref.current.slopPx,
          flag = false,
          callback4 = (input3: PointerEvent): void => {
            if (input3.pointerId !== pointerId) {
              return;
            }
            if ((input3.buttons & 1) === 0) {
              return callback2();
            }
            if (!flag && !callback3(input3)) {
              return;
            }
            if (!flag && !context) {
              ref.current.onLive?.();
            }
            flag = true;
            let bounds = value3.getBoundingClientRect();
            value2({
              pin: value4,
              x1: input3.clientX - bounds.left,
              y1: input3.clientY - bounds.top,
              resizing: context !== undefined,
            });
          },
          callback5 = (input3: PointerEvent): void => {
            if (input3.pointerId !== pointerId) {
              return;
            }
            callback();
            let current2 = ref.current;
            if (input3.button !== 0) {
              return current2.onNothing();
            }
            if (!callback3(input3)) {
              if (!context) {
                current2.onClick(input3);
              }
              return current2.onNothing();
            }
            let value5 = current2.toLocal(input3.clientX, input3.clientY),
              value6 = current2.toClient(value4);
            if (
              value5 == null ||
              !value6 ||
              Math.abs(input3.clientX - value6.x) <
                COMMENT_AREA_RESIZE_MIN_PX ||
              Math.abs(input3.clientY - value6.y) < COMMENT_AREA_RESIZE_MIN_PX
            ) {
              return current2.onNothing();
            }
            current2.onArea({
              c0: value4,
              c1: value5,
              at: context
                ? value6
                : {
                    x: input3.clientX,
                    y: input3.clientY,
                  },
              resizing: context !== undefined,
            });
          },
          callback6 = (event: KeyboardEvent): void => {
            if (event.key !== "Escape" || !ref2.current) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            callback2();
          },
          callback7 = (input3: PointerEvent): void => {
            if (input3.pointerId === pointerId) {
              callback2();
            }
          };
        window.addEventListener("pointermove", callback4, true);
        window.addEventListener("pointerup", callback5, true);
        window.addEventListener("pointercancel", callback7, true);
        window.addEventListener("keydown", callback6, true);
        window.addEventListener("blur", callback2);
        ref2.current = {
          id: pointerId,
          cleanup: (): void => {
            window.removeEventListener("pointermove", callback4, true);
            window.removeEventListener("pointerup", callback5, true);
            window.removeEventListener("pointercancel", callback7, true);
            window.removeEventListener("keydown", callback6, true);
            window.removeEventListener("blur", callback2);
            try {
              if (options.hasPointerCapture(pointerId)) {
                options.releasePointerCapture(pointerId);
              }
            } catch {}
          },
        };
        return true;
      },
      cancel: callback,
    };
  }
  function useCommentMoveKeyHighlight<
    T extends CommentDrawnArea = CommentDrawnArea,
  >(input: boolean, options: string): CommentMoveKeyHighlight<T> {
    let [value, value2] = ReactCommentSelection.useState<T | null>(null),
      ref = ReactCommentSelection.useRef<{ rect: T; scope: string } | null>(
        null,
      ),
      ref2 = ReactCommentSelection.useRef({
        composing: input,
        scope: options,
      });
    ref2.current = {
      composing: input,
      scope: options,
    };
    let callback = (): void => {
        let current = ref.current;
        value2(
          ref2.current.composing && current?.scope === ref2.current.scope
            ? current.rect
            : null,
        );
      },
      callback2 = (): void => {
        ref.current = null;
        value2(null);
      };
    ReactCommentSelection.useEffect((): void => {
      if (!input) {
        callback2();
      }
    }, [input]);
    ReactCommentSelection.useEffect(callback, [options]);
    return {
      drawn: value,
      show: value2,
      hold: (input2: T, options2: string): void => {
        ref.current = {
          rect: input2,
          scope: options2,
        };
      },
      restore: callback,
      clear: callback2,
    };
  }
  bindRuntimeValue(
    runtime,
    "ReactSlideComments",
    () => ReactSlideComments,
    (value) => {
      ReactSlideComments = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CommentAreaJsx",
    () => CommentAreaJsx,
    (value) => {
      CommentAreaJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CommentAreaSelectionOutline",
    () => CommentAreaSelectionOutline,
  );
  bindRuntimeValue(
    runtime,
    "ReactCommentSelection",
    () => ReactCommentSelection,
    (value) => {
      ReactCommentSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_AREA_RESIZE_MIN_PX",
    () => COMMENT_AREA_RESIZE_MIN_PX,
    (value) => {
      COMMENT_AREA_RESIZE_MIN_PX = value;
    },
  );
  bindRuntimeValue(runtime, "useCommentAreaDrag", () => useCommentAreaDrag);
  bindRuntimeValue(
    runtime,
    "useCommentMoveKeyHighlight",
    () => useCommentMoveKeyHighlight,
  );
  return () => {
    (0, runtime.initializeCaptureFallback)();
    (0, runtime.initializeSlideRenderer)();
    ReactSlideComments = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    CommentAreaJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ReactCommentSelection = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    COMMENT_AREA_RESIZE_MIN_PX = 12;
  };
}

/** Restored application module; prepare first, initialize in original order. */
import type {
  FocusEvent as ReactFocusEvent,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { Slide } from "../deck-contracts";
import type { TypographyStyle } from "../model/typography";
import type {
  AnchorDescription,
  EditorPoint,
} from "../../../slides/src/editor-messages";
import type {
  CommentAnchorController,
  CommentAnchorHandlers,
} from "../../../slides/src/editor/slides-host";
import type { FrameCommentTarget } from "./composer";
import type { CommentBox, CommentPoint } from "./keyboard";
import type { ParsedCommentAnchor, ParsedCommentAreaAnchor } from "./anchors";
import type {
  CommentAreaHostMatch,
  CommentOperation,
  CommentOperationToken,
  CommentUnitPoint,
  CommentUnitRect,
} from "./area-geometry";
import type {
  CommentAreaTargets,
  CommentHit,
  DescribedCommentAnchor,
} from "./hit-testing";
import type {
  CommentAreaDrop,
  CommentDrawnArea,
} from "./area-selection";
import type { CommentNodeRef } from "./labels";

/** A pixel box that may also mark the origin corner of an area outline. */
export interface SlideCommentOutlineRect extends CommentBox {
  ox?: number;
  oy?: number;
}
/** Size of the comment layer's container in pixels. */
export interface SlideCommentSize {
  w: number;
  h: number;
}
/** One thread the host asks the runtime to mark on the slide. */
export type SlideCommentThread = Parameters<
  CommentAnchorHandlers["threads"]
>[0][number];
/** What a keyboard-composed comment targets: the slide itself or one node (by frame and path). */
export type SlideCommentTargetAnchor =
  | { kind: "slide"; slideId: string }
  | FrameCommentTarget;
/** Where a pointer went down on the layer, to tell a tap from a drag when it lifts. */
export interface SlideCommentTapStart extends CommentUnitPoint {
  id: number;
  touch: boolean;
}
/** A thread together with its decoded anchor (the anchor is null when it does not parse). */
export interface SlideCommentPlacedThread {
  id: string;
  active: boolean;
  a: ParsedCommentAnchor | null;
}
/** A thread whose anchor decoded. */
export interface SlideCommentMarker extends SlideCommentPlacedThread {
  a: ParsedCommentAnchor;
}
/** A keyboard-focusable comment target: the slide itself or one element (by key). */
export type SlideCommentTarget = "slide" | { key: string };
/** An element of the slide that can be commented on, with its box in the layer. */
export interface SlideCommentElementTarget {
  key: string;
  ref: CommentNodeRef;
  rect: CommentBox;
}
/** Where the host may drag a thread's marker to: the new anchor, its description and the marker's new position. */
export interface SlideCommentMoveResult extends AnchorDescription {
  anchor: string;
  at: EditorPoint;
}
export type SlideCommentMoveHandler = (
  threadId: string,
  at: EditorPoint,
) => Promise<SlideCommentMoveResult | null>;
export interface SlideCommentControllerOptions {
  onMode(on: boolean): void;
  onReveal(anchor: ParsedCommentAnchor): void;
}
/** What `useSlideCommentController` hands to the comment layer. */
export interface SlideCommentController {
  ctl: CommentAnchorController | null;
  on: boolean;
  threads: SlideCommentThread[];
  composing: boolean;
  moveRef: RefObject<SlideCommentMoveHandler | null>;
}
export interface SlideCommentLayerProps extends SlideCommentController {
  slide: Slide;
  slides: Slide[];
  typeStyles: TypographyStyle[];
  containerRef: RefObject<HTMLElement | null>;
  hidden?: boolean;
  keepsMode?: (target: Element) => boolean;
  topInset?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SlideCommentLayerJsx: JsxNamespace;
    COMMENT_AREA_TAP_TIMEOUT_MS: number;
    COMMENT_POINTER_MOVE_THRESHOLD_PX: number;
    COMMENT_TOUCH_MOVE_THRESHOLD_PX: number;
    COMMENT_AREA_MIN_SIZE_PX: number;
    SLIDE_COMMENT_UNIT_RECT: CommentUnitRect;
    clampSlideCommentFraction: (fraction: number) => number;
    slideCommentTargetsEqual: (
      left: SlideCommentTarget | null,
      right: SlideCommentTarget | null,
    ) => boolean;
    slideCommentTargetsSameElement: (
      left: SlideCommentElementTarget[],
      right: SlideCommentElementTarget[],
    ) => boolean;
    useSlideCommentController: (
      options: SlideCommentControllerOptions,
    ) => SlideCommentController;
    SlideCommentLayer: (props: SlideCommentLayerProps) => ReactElement | null;
  }
}

export function installCommentsSlideLayer(
  runtime: RuntimeBindings,
): () => void {
  var SlideCommentLayerJsx: JsxNamespace;
  var COMMENT_AREA_TAP_TIMEOUT_MS: number;
  var COMMENT_POINTER_MOVE_THRESHOLD_PX: number;
  var COMMENT_TOUCH_MOVE_THRESHOLD_PX: number;
  var COMMENT_AREA_MIN_SIZE_PX: number;
  var SLIDE_COMMENT_UNIT_RECT: CommentUnitRect;
  var clampSlideCommentFraction: (fraction: number) => number;
  var slideCommentTargetsEqual: RuntimeBindings["slideCommentTargetsEqual"];
  var slideCommentTargetsSameElement: RuntimeBindings["slideCommentTargetsSameElement"];
  function useSlideCommentController(
    options: SlideCommentControllerOptions,
  ): SlideCommentController {
    let [value, value2] = runtime.ReactSlideComments.useState<CommentAnchorController | null>(null),
      ref = runtime.ReactSlideComments.useRef<CommentAnchorController | null>(null),
      [value3, value4] = runtime.ReactSlideComments.useState(false),
      [value5, value6] = runtime.ReactSlideComments.useState<SlideCommentThread[]>([]),
      [value7, value8] = runtime.ReactSlideComments.useState(false),
      ref2 = runtime.ReactSlideComments.useRef(value5);
    ref2.current = value5;
    let ref3 = runtime.ReactSlideComments.useRef(options);
    ref3.current = options;
    let ref4 = runtime.ReactSlideComments.useRef<SlideCommentMoveHandler | null>(null);
    runtime.ReactSlideComments.useEffect(() => {
      let flag = false;
      (0, runtime.getCustomCommentAnchors)({
        mode: (input: boolean) => {
          value4(input);
          if (!input) {
            value6([]);
          }
          ref3.current.onMode(input);
        },
        threads: value6,
        composing: value8,
        move: (input: string, options2: EditorPoint) =>
          ref4.current?.(input, options2) ?? Promise.resolve(null),
        hotkey: true,
        reveal: (input: string) => {
          let value9 = ref2.current.find(
              (input2) => input2.id === input,
            ),
            value10 = value9
              ? (0, runtime.parseSlideCommentAnchor)(value9.anchor)
              : null;
          if (value10) {
            ref3.current.onReveal(value10);
          }
        },
      }).then((input) => {
        if (flag) {
          input?.release();
          return;
        }
        ref.current = input;
        value2(input);
        (0, runtime.setCommentAnchorController)(input);
      });
      return () => {
        flag = true;
        ref.current?.release();
        ref.current = null;
        (0, runtime.setCommentAnchorController)(null);
      };
    }, []);
    return {
      ctl: value,
      on: value3,
      threads: value5,
      composing: value7,
      moveRef: ref4,
    };
  }
  function SlideCommentLayer({
    ctl: ctl,
    on: on2,
    threads: threads,
    composing: composing,
    moveRef: moveRef,
    slide: slide,
    slides: slides,
    typeStyles: typeStyles,
    containerRef: containerRef,
    hidden: hidden,
    keepsMode: keepsMode,
    topInset = 0,
  }: SlideCommentLayerProps): ReactElement | null {
    let ref = runtime.ReactSlideComments.useRef(topInset);
    ref.current = topInset;
    let [value, value2] = runtime.ReactSlideComments.useState<CommentBox | null>(null),
      callback = (input: CommentBox | null): void =>
        value2(
          (input2: CommentBox | null): CommentBox | null =>
            (0, runtime.parseCommentCell)(input2, input) ? input2 : input,
        ),
      [value3, value4] = runtime.ReactSlideComments.useState<CommentBox | null>(null),
      callback2 = (input: CommentBox | null): void =>
        value4(
          (input2: CommentBox | null): CommentBox | null =>
            (0, runtime.parseCommentCell)(input2, input) ? input2 : input,
        ),
      [value5, value6] = runtime.ReactSlideComments.useState<SlideCommentSize | null>(null),
      callback3 = (input: SlideCommentSize | null): void =>
        value6(
          (input2: SlideCommentSize | null): SlideCommentSize | null =>
            input2 === input ||
            (!!input2 &&
              !!input &&
              input2.w === input.w &&
              input2.h === input.h)
              ? input2
              : input,
        ),
      [value7, value8] = runtime.ReactSlideComments.useState<CommentBox | null>(null),
      callback4 = (input: CommentBox | null): void =>
        value8(
          (input2: CommentBox | null): CommentBox | null =>
            (0, runtime.parseCommentCell)(input2, input) ? input2 : input,
        ),
      ref2 = runtime.ReactSlideComments.useRef<CommentUnitPoint | null>(null),
      ref3 = runtime.ReactSlideComments.useRef<CommentBox | null>(null),
      ref4 = runtime.ReactSlideComments.useRef(false),
      ref5 = runtime.ReactSlideComments.useRef<SlideCommentTapStart | null>(null),
      ref6 = runtime.ReactSlideComments.useRef(""),
      ref7 = runtime.ReactSlideComments.useRef({
        slide: slide,
        slides: slides,
        typeStyles: typeStyles,
        hidden: hidden === true,
        on: on2,
      });
    ref7.current = {
      slide: slide,
      slides: slides,
      typeStyles: typeStyles,
      hidden: hidden === true,
      on: on2,
    };
    let ref8 = runtime.ReactSlideComments.useRef<HTMLDivElement | null>(null),
      ref9 = runtime.ReactSlideComments.useRef<HTMLDivElement | null>(null),
      [value9, value10] = runtime.ReactSlideComments.useState<SlideCommentElementTarget[]>([]),
      callback5 = (input: SlideCommentElementTarget[]): void =>
        value10(
          (input2: SlideCommentElementTarget[]): SlideCommentElementTarget[] =>
            slideCommentTargetsSameElement(input2, input) ? input2 : input,
        ),
      ref10 = runtime.ReactSlideComments.useRef(value9);
    ref10.current = value9;
    let [value11, value12] = runtime.ReactSlideComments.useState<SlideCommentTarget | null>(null),
      ref11 = runtime.ReactSlideComments.useRef<SlideCommentTarget | null>(null);
    ref11.current = value11;
    let ref12 = runtime.ReactSlideComments.useRef<SlideCommentTarget | null>(null),
      [value13, value14] = runtime.ReactSlideComments.useState(true),
      ref13 = runtime.ReactSlideComments.useRef(true),
      ref14 = runtime.ReactSlideComments.useRef<CommentUnitPoint | null>(null),
      callback6 = (input: boolean): void => {
        if (ref13.current === input) {
          return;
        }
        ref13.current = input;
        if (input) {
          ref14.current = null;
        }
        value14(input);
      },
      [value15, value16] = runtime.ReactSlideComments.useState(false),
      ref15 = runtime.ReactSlideComments.useRef(false),
      callback7 = (input: HTMLElement | null): void => {
        if (!input) {
          return;
        }
        let value27 =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(hover: none)").matches;
        ref15.current = true;
        input.focus({
          preventScroll: true,
        });
        ref15.current = false;
        value16(value27);
      },
      value17 = runtime.ReactSlideComments.useId(),
      value18 = runtime.ReactSlideComments.useId(),
      callback8 = (): boolean => {
        let activeElement = document.activeElement;
        return (
          document.hasFocus() &&
          (activeElement === null ||
            activeElement === document.body ||
            activeElement === document.documentElement ||
            ref8.current?.contains(activeElement) === true ||
            (activeElement.matches('[data-slide-surface][tabindex="-1"]') &&
              containerRef.current?.contains(activeElement) === true))
        );
      },
      memo = runtime.ReactSlideComments.useMemo(
        () =>
          threads
            .map(
              (input: SlideCommentThread): SlideCommentPlacedThread => ({
                id: input.id,
                active: input.active,
                a: (0, runtime.parseSlideCommentAnchor)(input.anchor),
              }),
            )
            .filter((input): input is SlideCommentMarker => input.a !== null),
        [threads],
      ),
      callback9 = (input: number, options: number): CommentHit | null => {
        let current = containerRef.current;
        if (!current) {
          return null;
        }
        for (let value27 of document.elementsFromPoint(input, options)) {
          if (value27.closest("[data-slides-comments]")) {
            continue;
          }
          if (
            !current.contains(value27) ||
            value27.closest("[data-uncommentable]")
          ) {
            return null;
          }
          let value28 = (0, runtime.hitTestFrameCommentAnchor)(
            ref7.current.slide.id,
            current,
            value27,
            input,
            options,
          );
          if (value28) {
            return value28;
          }
          let ancestor = value27.closest("[data-slide-surface]");
          if (ancestor) {
            return (0, runtime.hitTestSlideCommentAnchor)(
              ref7.current.slide.id,
              ancestor,
              input,
              options,
            );
          } else {
            return null;
          }
        }
        return null;
      },
      callback10 = (): HTMLElement | null =>
        containerRef.current?.querySelector<HTMLElement>("[data-slide-surface]") ?? null,
      callback11 = (input: number, options: number): CommentUnitPoint | null => {
        let value27 = callback10()?.getBoundingClientRect();
        if (value27) {
          return {
            x: (input - value27.left) / (value27.width || 1),
            y: (options - value27.top) / (value27.height || 1),
          };
        } else {
          return null;
        }
      },
      callback12 = (input: CommentUnitPoint): CommentUnitPoint | null => {
        let value27 = callback10()?.getBoundingClientRect();
        if (value27) {
          return {
            x: value27.left + input.x * value27.width,
            y: value27.top + input.y * value27.height,
          };
        } else {
          return null;
        }
      },
      callback13 = (source: ParsedCommentAnchor): Element | null => {
        let {
            slide: current,
            slides: current2,
            hidden: current3,
          } = ref7.current,
          current4 = containerRef.current;
        if (
          current3 ||
          !current4 ||
          (0, runtime.hashScopedSlideId)(current.id) !== source.slideHash
        ) {
          return null;
        }
        if (
          source.kind === "slide" ||
          (source.kind === "area" && source.frameHash === null)
        ) {
          return current4.querySelector("[data-slide-surface]");
        }
        return (0, runtime.resolveCommentAnchorElement)(
          source,
          (0, runtime.resolveCommentSlide)(source, current2),
          current4,
          null,
        );
      },
      callback14 = (input: ParsedCommentAnchor): CommentUnitPoint | null => {
        let value27 = callback13(input);
        if (value27) {
          return (0, runtime.commentAnchorPoint)(value27, input);
        } else {
          return null;
        }
      },
      callback15 = (input: ParsedCommentAreaAnchor): CommentBox | null => {
        let current = containerRef.current,
          value27 = callback13(input);
        if (current && value27) {
          return (0, runtime.commentAnchorAreaRect)(
            value27,
            input,
            current.getBoundingClientRect(),
          );
        } else {
          return null;
        }
      },
      ref16 = runtime.ReactSlideComments.useRef(memo);
    ref16.current = memo;
    runtime.ReactSlideComments.useEffect(() => {
      ref6.current = "";
    }, [memo]);
    runtime.ReactSlideComments.useEffect(() => {
      if (!ctl || !on2) {
        return;
      }
      let index = 0,
        callback30 = (): void => {
          index = requestAnimationFrame(callback30);
          let current = containerRef.current;
          if (!current) {
            return;
          }
          let bounds = current.getBoundingClientRect(),
            state: Record<string, CommentUnitPoint> = {};
          for (let { id: value31, a: value32 } of ref16.current) {
            let value33 = callback14(value32);
            if (!value33) {
              continue;
            }
            let { x: value34, y: value35 } = value33;
            if (value34 < bounds.left) {
              value34 -= window.innerWidth;
            } else if (value34 > bounds.right) {
              value34 += window.innerWidth;
            }
            if (value35 < bounds.top + ref.current) {
              value35 -= window.innerHeight;
            } else if (value35 > bounds.bottom) {
              value35 += window.innerHeight;
            }
            state[value31] = {
              x: Math.round(value34 + window.scrollX),
              y: Math.round(value35 + window.scrollY),
            };
          }
          let value27 = JSON.stringify(state);
          if (value27 !== ref6.current) {
            ref6.current = value27;
            ctl.placed(state);
          }
          let value28 = callback10(),
            value29 = value28
              ? (0, runtime.getCommentElementRect)(value28, bounds)
              : null;
          callback2(value29);
          callback3({
            w: bounds.width,
            h: bounds.height,
          });
          let value30 = ctl.areas
            ? ref16.current.find((input) => input.active)
            : undefined;
          callback4(
            value30 && value30.a.kind === "area" ? callback15(value30.a) : null,
          );
          let current2 = ref2.current;
          if (current2 && !ref7.current.hidden && !value20.drawing()) {
            let value31 = callback9(current2.x, current2.y);
            callback(
              value31
                ? (0, runtime.getCommentElementRect)(value31.el, bounds)
                : null,
            );
          }
          if (!(0, runtime.parseCommentCell)(value29, ref3.current)) {
            ref4.current = true;
          } else if (ref4.current) {
            ref4.current = false;
            ref20.current();
          } else {
            let current3 = ref11.current,
              value31 =
                current3 !== null && current3 !== "slide"
                  ? ref10.current.find(
                      (input) => input.key === current3.key,
                    )
                  : undefined,
              value32 = value31 ? ref23.current(value31.ref) : null;
            if (value31 && value32) {
              let bounds2 = value32.getBoundingClientRect(),
                value33 = (0, runtime.collectCommentableNodeElements)(
                  {
                    left: bounds2.left - bounds.left,
                    top: bounds2.top - bounds.top,
                    width: bounds2.width,
                    height: bounds2.height,
                  },
                  bounds.width,
                  bounds.height,
                  ref.current,
                );
              if (!(0, runtime.parseCommentCell)(value33, value31.rect)) {
                ref20.current();
              }
            }
          }
          ref3.current = value29;
        };
      callback30();
      return () => {
        cancelAnimationFrame(index);
        ref6.current = "";
        ref2.current = null;
        ref3.current = null;
        ref4.current = false;
        callback(null);
        callback2(null);
        callback3(null);
        callback4(null);
        callback5([]);
        ctl.placed({});
      };
    }, [ctl, on2]);
    runtime.ReactSlideComments.useEffect(() => {
      if (!ctl || !on2 || typeof ctl.exitMode !== "function") {
        return;
      }
      let callback30 = (event: PointerEvent): void => {
        if (event.button !== 0) {
          return;
        }
        let value27 =
          event.target instanceof Element ? event.target : null;
        if (!value27) {
          return;
        }
        if (containerRef.current?.contains(value27) || keepsMode?.(value27)) {
          return;
        }
        ctl.exitMode?.();
      };
      document.addEventListener("pointerdown", callback30, true);
      return () =>
        document.removeEventListener(
          "pointerdown",
          callback30,
          true,
        );
    }, [ctl, on2, keepsMode]);
    let ref17 = runtime.ReactSlideComments.useRef(
        (0, runtime.createCommentOperationToken)(),
      ),
      value19 = (0, runtime.useCommentMoveKeyHighlight)(
        composing,
        slide.id,
      ),
      { drawn: drawn } = value19,
      ref18 = runtime.ReactSlideComments.useRef(drawn);
    ref18.current = drawn;
    let value20 = (0, runtime.useCommentAreaDrag)({
        toLocal: callback11,
        toClient: callback12,
        stage: (): HTMLElement | null => containerRef.current,
        slopPx: COMMENT_TOUCH_MOVE_THRESHOLD_PX,
        onClick: (input: PointerEvent): void =>
          ref19.current(input.clientX, input.clientY),
        onNothing: (): void => value19.restore(),
        onLive: (): void => value19.show(null),
        onArea: ({
          c0: c0,
          c1: c1,
          at: at,
          resizing: resizing,
        }: CommentAreaDrop): void => {
          let [value27] = (0, runtime.rankCommentAreaHosts)(
            {
              x: Math.min(c0.x, c1.x),
              y: Math.min(c0.y, c1.y),
              w: Math.abs(c1.x - c0.x),
              h: Math.abs(c1.y - c0.y),
            },
            [
              {
                board: SLIDE_COMMENT_UNIT_RECT,
                frame: SLIDE_COMMENT_UNIT_RECT,
              },
            ],
          );
          if (!value27) {
            return value19.restore();
          }
          let value28 = resizing ? c1 : c0,
            state: CommentDrawnArea = {
              ...value27.inter,
              ox: clampSlideCommentFraction(value28.x),
              oy: clampSlideCommentFraction(value28.y),
            };
          value19.show(state);
          ref24.current(
            state,
            {
              x: at.x + window.scrollX,
              y: at.y + window.scrollY,
            },
            (0, runtime.nearestCommentBoxCorner)(
              value27.inter,
              resizing ? c0 : c1,
            ),
            ref17.current.begin(),
          );
        },
      }),
      callback16 = (): number =>
        ref7.current.slides.findIndex(
          (input) => input.id === ref7.current.slide.id,
        ) + 1,
      callback17 = (input: number, options: number): DescribedCommentAnchor | null => {
        let value27 = callback9(input, options);
        if (value27) {
          return (0, runtime.createCommentAnchorDescription)(
            value27,
            callback16(),
            ref7.current.slide,
            ref7.current.typeStyles,
          );
        } else {
          return null;
        }
      },
      callback18 = (input: number, options: number): void => {
        ref17.current.cancel();
        if (!ctl) {
          return;
        }
        let value27 = callback17(input, options);
        if (!value27) {
          return;
        }
        ctl
          .compose(
            value27.anchor,
            {
              x: input + window.scrollX,
              y: options + window.scrollY,
            },
            {
              label: value27.label,
              ...(value27.detail
                ? {
                    detail: value27.detail,
                  }
                : {}),
            },
          )
          .then(
            (input2) => {
              if (input2.opened) {
                value19.clear();
              }
            },
            () => {
              return;
            },
          );
      },
      ref19 = runtime.ReactSlideComments.useRef(callback18);
    ref19.current = callback18;
    runtime.ReactSlideComments.useEffect(() => {
      value20.cancel();
      value19.clear();
      ref17.current.cancel();
    }, [ctl, on2, hidden]);
    runtime.ReactSlideComments.useEffect(() => {
      value20.cancel();
      ref17.current.cancel();
    }, [slide.id]);
    runtime.ReactSlideComments.useEffect(() => {
      if (threads.some((input) => input.active)) {
        value19.show(null);
      }
    }, [threads]);
    let callback19 = (): CommentAreaTargets | null => {
        let current = containerRef.current,
          value27 = callback10();
        if (current && value27) {
          return (0, runtime.collectSlideCommentAreaTargets)(
            ref7.current.slide,
            current,
            value27,
            "[data-uncommentable], [data-slides-comments]",
          );
        } else {
          return null;
        }
      },
      callback20 = (): void => {
        let current = containerRef.current,
          slide2 = ref7.current.slide,
          value27 = ref7.current.hidden ? null : callback19();
        if (!current || !value27) {
          return callback5([]);
        }
        let bounds = current.getBoundingClientRect(),
          items: SlideCommentElementTarget[] = [];
        for (let value28 of value27.els) {
          let value29 = (0, runtime.frameById)(
            slide2,
            value28.ref.frameId,
          );
          if (
            value29 &&
            (0, runtime.nodeAtPath)(value29.node, value28.ref.path)?.kind ===
              "spacer"
          ) {
            continue;
          }
          let client = value28.client,
            value30 = (0, runtime.collectCommentableNodeElements)(
              {
                left: client.left - bounds.left,
                top: client.top - bounds.top,
                width: client.width,
                height: client.height,
              },
              bounds.width,
              bounds.height,
              ref.current,
            );
          if (value30) {
            items.push({
              key: value28.ref.frameId + ":" + value28.ref.path.join("."),
              ref: value28.ref,
              rect: value30,
            });
          }
        }
        callback5(items);
      },
      ref20 = runtime.ReactSlideComments.useRef(callback20);
    ref20.current = callback20;
    runtime.ReactSlideComments.useEffect(() => {
      if (!ctl || !on2 || hidden) {
        return;
      }
      callback20();
    }, [ctl, on2, hidden, slide, value5, topInset]);
    let ref21 = runtime.ReactSlideComments.useRef(on2);
    runtime.ReactSlideComments.useEffect(() => {
      if (ctl === null) {
        return;
      }
      let value27 = on2 && !ref21.current;
      ref21.current = on2;
      if (
        !value27 ||
        hidden ||
        (0, runtime.elapsedSinceCommentComposition)() <
          COMMENT_AREA_TAP_TIMEOUT_MS
      ) {
        return;
      }
      if (callback8()) {
        callback7(ref9.current);
      }
    }, [on2, ctl, hidden]);
    let ref22 = runtime.ReactSlideComments.useRef(false);
    runtime.ReactSlideComments.useEffect(() => {
      let value27 = ctl !== null && on2 && !hidden,
        value28 = ref22.current && !value27 && !on2;
      ref22.current = value27;
      if (value27) {
        return;
      }
      let value29 = (ref11.current ?? ref12.current) !== null;
      value12(null);
      if (!value28 || !value29 || !document.hasFocus()) {
        return;
      }
      let activeElement = document.activeElement;
      if (
        !(
          activeElement === null ||
          activeElement === document.body ||
          activeElement === document.documentElement
        )
      ) {
        return;
      }
      containerRef.current
        ?.querySelector<HTMLElement>('[data-slide-surface][tabindex="0"]')
        ?.focus({
          preventScroll: true,
        });
    }, [ctl, on2, hidden]);
    runtime.ReactSlideComments.useEffect(() => {
      if (!ctl || !on2 || hidden) {
        return;
      }
      let callback30 = (input: PointerEvent): void => {
          let current = ref14.current;
          if (current === null) {
            ref14.current = {
              x: input.clientX,
              y: input.clientY,
            };
          } else if (
            Math.abs(input.clientX - current.x) +
              Math.abs(input.clientY - current.y) >
            COMMENT_POINTER_MOVE_THRESHOLD_PX
          ) {
            callback6(false);
          }
        },
        callback31 = (input: PointerEvent): void => {
          if (!(0, runtime.isCommentKeyboardTarget)(input)) {
            callback6(false);
          }
        };
      document.addEventListener("pointermove", callback30, {
        capture: true,
        passive: true,
      });
      document.addEventListener("pointerdown", callback31, true);
      return () => {
        document.removeEventListener(
          "pointermove",
          callback30,
          true,
        );
        document.removeEventListener(
          "pointerdown",
          callback31,
          true,
        );
      };
    }, [ctl, on2, hidden]);
    runtime.ReactSlideComments.useEffect(() => {
      if (!ctl || !on2 || hidden) {
        ref12.current = null;
        return;
      }
      let value27: ReturnType<typeof setTimeout> | undefined,
        callback30 = (): void => {
          let current = ref12.current,
            activeElement = document.activeElement;
          if (
            current === null ||
            !document.hasFocus() ||
            !(
              activeElement === null ||
              activeElement === document.body ||
              activeElement === document.documentElement
            )
          ) {
            return;
          }
          (
            (current === "slide"
              ? null
              : ref8.current?.querySelector<HTMLElement>(
                  '[data-slides-comment-target][data-key="' +
                    CSS.escape(current.key) +
                    '"]',
                )) ?? ref9.current
          )?.focus({
            preventScroll: true,
          });
        },
        callback31 = (): void => {
          clearTimeout(value27);
          value27 = setTimeout(callback30, 0);
        },
        callback32 = (input: PointerEvent): void => {
          if (!(0, runtime.isCommentKeyboardTarget)(input)) {
            ref12.current = null;
          }
        };
      window.addEventListener("focus", callback31);
      document.addEventListener("pointerdown", callback32, true);
      return () => {
        clearTimeout(value27);
        window.removeEventListener("focus", callback31);
        document.removeEventListener(
          "pointerdown",
          callback32,
          true,
        );
      };
    }, [ctl, on2, hidden]);
    runtime.ReactSlideComments.useEffect(() => {
      let value27 = ref11.current ?? ref12.current;
      if (
        value27 === null ||
        value27 === "slide" ||
        value9.some((input) => input.key === value27.key)
      ) {
        return;
      }
      if (callback8()) {
        ref9.current?.focus({
          preventScroll: true,
        });
      } else {
        value12(null);
      }
    }, [value9]);
    let callback21 = (input: CommentNodeRef): Element | null => {
        let value27 =
          containerRef.current?.querySelector(
            '[data-frame-id="' + CSS.escape(input.frameId) + '"]',
          ) ?? null;
        if (!value27 || input.path.length === 0) {
          return value27;
        }
        return value27.querySelector(
          '[data-node-path="' + input.path.join(".") + '"]',
        );
      },
      ref23 = runtime.ReactSlideComments.useRef(callback21);
    ref23.current = callback21;
    let callback22 = (input: Element): CommentPoint | null => {
        let current = containerRef.current;
        if (!current) {
          return null;
        }
        let bounds = input.getBoundingClientRect(),
          bounds2 = current.getBoundingClientRect(),
          value27 = (0, runtime.collectCommentableNodeElements)(
            {
              left: bounds.left - bounds2.left,
              top: bounds.top - bounds2.top,
              width: bounds.width,
              height: bounds.height,
            },
            bounds2.width,
            bounds2.height,
            ref.current,
          );
        if (!value27) {
          return null;
        }
        let value28 = (0, runtime.defaultCommentPoint)({
          left: bounds2.left + value27.left,
          top: bounds2.top + value27.top,
          width: value27.width,
          height: value27.height,
        });
        return {
          x: value28.x,
          y: value28.y,
          fx: (0, runtime.normalizeCommentPoint)(
            value28.x,
            bounds.left,
            bounds.width,
          ),
          fy: (0, runtime.normalizeCommentPoint)(
            value28.y,
            bounds.top,
            bounds.height,
          ),
        };
      },
      callback23 = (input: SlideCommentTarget | null): void => {
        ref17.current.cancel();
        if (!ctl || input === null) {
          return;
        }
        let { slide: current, typeStyles: current2 } = ref7.current,
          value27: Element | null,
          value28: SlideCommentTargetAnchor;
        if (input === "slide") {
          value27 = callback10();
          value28 = {
            kind: "slide",
            slideId: current.id,
          };
        } else {
          let value31 = value9.find(
            (input2) => input2.key === input.key,
          )?.ref;
          value27 = value31 ? callback21(value31) : null;
          if (!value31) {
            return;
          }
          value28 = {
            kind: "frame",
            slideId: current.id,
            frameId: value31.frameId,
            path: value31.path,
          };
          if (
            (0, runtime.encodeSlideCommentAnchor)({
              ...value28,
              fx: 0,
              fy: 0,
            }) === null
          ) {
            value28 = {
              ...value28,
              path: [],
            };
            value27 = callback21(value28);
          }
        }
        let value29 = value27 ? callback22(value27) : null;
        if (!value29) {
          return;
        }
        let value30 = (0, runtime.encodeSlideCommentAnchor)({
          ...value28,
          fx: value29.fx,
          fy: value29.fy,
        });
        if (value30 === null) {
          return;
        }
        ctl
          .compose(
            value30,
            {
              x: value29.x + window.scrollX,
              y: value29.y + window.scrollY,
            },
            (0, runtime.describeFrameCommentAnchor)(
              callback16(),
              current,
              value28,
              current2,
            ),
          )
          .then(
            (input2) => {
              if (input2.opened) {
                value19.clear();
              }
            },
            () => {
              return;
            },
          );
      },
      callback24 = (event: ReactKeyboardEvent<HTMLDivElement>, options: SlideCommentTarget): void => {
        let current = ref13.current;
        callback6(true);
        value16(false);
        if (
          event.target !== event.currentTarget ||
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.nativeEvent.isComposing
        ) {
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        if (current && !event.repeat) {
          callback23(options);
        }
      },
      callback25 = (
        input: CommentDrawnArea,
        options: CommentUnitPoint,
        context: number | undefined,
        value27: CommentOperation,
      ): void => {
        let value28 = ctl;
        if (!value28 || !on2) {
          return;
        }
        let callback30 = (): void => {
            if (value27.live) {
              value19.restore();
            }
          },
          value29 = callback26(input, context);
        if (!value29 || !ref7.current.on || !value27.live) {
          return callback30();
        }
        let id = ref7.current.slide.id;
        value28
          .compose(value29.anchor, options, {
            label: value29.label,
            ...(value29.detail
              ? {
                  detail: value29.detail,
                }
              : {}),
            area: true,
          })
          .then((input2) => {
            if (!input2.opened) {
              return callback30();
            }
            if (value27.live) {
              value19.hold(input, id);
            }
          }, callback30);
      },
      callback26 = (input: CommentUnitRect, options: number | undefined): DescribedCommentAnchor | null => {
        let value27 = callback19();
        if (value27) {
          return (0, runtime.describeSlideCommentArea)(
            input,
            options,
            value27.els,
            callback16(),
            ref7.current.slide,
            ref7.current.typeStyles,
          );
        } else {
          return null;
        }
      },
      ref24 = runtime.ReactSlideComments.useRef(callback25);
    ref24.current = callback25;
    let callback27 = async (
        input: string,
        options: EditorPoint,
      ): Promise<SlideCommentMoveResult | null> => {
        if (!ctl || !on2 || ref7.current.hidden) {
          return null;
        }
        let value27 = threads.find(
            (input2) => input2.id === input,
          ),
          value28 = value27
            ? (0, runtime.parseSlideCommentAnchor)(value27.anchor)
            : null;
        if (!value28) {
          return null;
        }
        let state: CommentUnitPoint = {
          x: options.x - window.scrollX,
          y: options.y - window.scrollY,
        };
        if (!callback9(state.x, state.y)) {
          return null;
        }
        let value29: DescribedCommentAnchor | null;
        if (value28.kind === "area") {
          let current = containerRef.current,
            value33 = callback15(value28),
            value34 = callback10()?.getBoundingClientRect(),
            value35 = callback11(state.x, state.y);
          if (!current || !value33 || !value34 || !value35) {
            return null;
          }
          let bounds = current.getBoundingClientRect(),
            state2: CommentUnitRect = {
              x:
                (bounds.left + value33.left - value34.left) /
                (value34.width || 1),
              y:
                (bounds.top + value33.top - value34.top) /
                (value34.height || 1),
              w: value33.width / (value34.width || 1),
              h: value33.height / (value34.height || 1),
            },
            value36 = (0, runtime.commentBoxCornerPoint)(
              state2,
              value28.box.corner,
            ),
            value37 =
              state2.w / ((value28.box.x1 - value28.box.x0) * 1000),
            value38 =
              state2.h / ((value28.box.y1 - value28.box.y0) * 1000),
            value39 =
              Math.round((value35.x - value36.x) / value37) * value37,
            value40 =
              Math.round((value35.y - value36.y) / value38) * value38,
            [value41] = (0, runtime.rankCommentAreaHosts)(
              {
                x: state2.x + value39,
                y: state2.y + value40,
                w: state2.w,
                h: state2.h,
              },
              [
                {
                  board: SLIDE_COMMENT_UNIT_RECT,
                  frame: SLIDE_COMMENT_UNIT_RECT,
                },
              ],
            );
          value29 = value41
            ? callback26(value41.inter, value28.box.corner)
            : null;
        } else {
          value29 = callback17(state.x, state.y);
        }
        if (!value29 || !ref7.current.on) {
          return null;
        }
        let value30 = (0, runtime.parseSlideCommentAnchor)(
            value29.anchor,
          ),
          value31 = value30 ? callback14(value30) : null,
          value32: EditorPoint = value31
            ? {
                x: Math.round(value31.x + window.scrollX),
                y: Math.round(value31.y + window.scrollY),
              }
            : options;
        return {
          anchor: value29.anchor,
          at: value32,
          label: value29.label,
          ...(value29.detail
            ? {
                detail: value29.detail,
              }
            : {}),
          ...(value29.area
            ? {
                area: true,
              }
            : {}),
        };
      },
      ref25 = runtime.ReactSlideComments.useRef(callback27);
    ref25.current = callback27;
    runtime.ReactSlideComments.useEffect(() => {
      if (!moveRef) {
        return;
      }
      let callback30: SlideCommentMoveHandler = (input, options) =>
        ref25.current(input, options);
      moveRef.current = callback30;
      return () => {
        if (moveRef.current === callback30) {
          moveRef.current = null;
        }
      };
    }, [moveRef]);
    let callback28 = (
        input: PointerEvent,
        options: HTMLElement,
        context: CommentUnitPoint | undefined,
      ): boolean => {
        if (
          !ctl?.areas ||
          input.button !== 0 ||
          input.pointerType !== "mouse"
        ) {
          return false;
        }
        callback(null);
        return value20.start(input, options, context);
      },
      ref26 = runtime.ReactSlideComments.useRef(callback28);
    ref26.current = callback28;
    runtime.ReactSlideComments.useEffect(() => {
      let current = ref8.current;
      if (!current) {
        return;
      }
      let callback30 = (event: PointerEvent): void => {
          if (event.button !== 0) {
            return;
          }
          if (event.pointerType !== "touch") {
            event.stopPropagation();
          }
          if ((0, runtime.isCommentKeyboardTarget)(event)) {
            ref5.current = null;
            return;
          }
          let value27 =
              event.target instanceof Element &&
              event.target.closest("[data-area-handle]")
                ? ref18.current
                : null,
            value28: CommentUnitPoint | undefined = value27
              ? {
                  x:
                    value27.ox <= value27.x + value27.w / 2
                      ? value27.x + value27.w
                      : value27.x,
                  y:
                    value27.oy <= value27.y + value27.h / 2
                      ? value27.y + value27.h
                      : value27.y,
                }
              : undefined;
          if (ref26.current(event, current, value28)) {
            return;
          }
          ref5.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            touch: event.pointerType === "touch",
          };
        },
        callback31 = (input: PointerEvent): void => {
          let current2 = ref5.current;
          if (!current2 || current2.id !== input.pointerId) {
            return;
          }
          ref5.current = null;
          if (
            Math.hypot(input.clientX - current2.x, input.clientY - current2.y) >
            (current2.touch
              ? COMMENT_AREA_MIN_SIZE_PX
              : COMMENT_TOUCH_MOVE_THRESHOLD_PX)
          ) {
            return;
          }
          ref19.current(input.clientX, input.clientY);
        },
        callback32 = (input: PointerEvent): void => {
          if (ref5.current?.id === input.pointerId) {
            ref5.current = null;
          }
        };
      current.addEventListener("pointerdown", callback30);
      window.addEventListener("pointerup", callback31, true);
      window.addEventListener("pointercancel", callback32, true);
      return () => {
        current.removeEventListener("pointerdown", callback30);
        window.removeEventListener("pointerup", callback31, true);
        window.removeEventListener(
          "pointercancel",
          callback32,
          true,
        );
      };
    }, [ctl, on2, hidden]);
    if (!ctl || !on2 || hidden) {
      return null;
    }
    let { marquee: marquee } = value20,
      value21 = ((): SlideCommentOutlineRect | null => {
        if (!value3) {
          return null;
        }
        let callback30 = (input: number): number =>
            value3.left + input * value3.width,
          callback31 = (input: number): number =>
            value3.top + input * value3.height;
        if (marquee) {
          let value27 = callback30(marquee.pin.x),
            value28 = callback31(marquee.pin.y),
            { x1: value29, y1: value30 } = marquee;
          return {
            left: Math.min(value27, value29),
            top: Math.min(value28, value30),
            width: Math.abs(value29 - value27),
            height: Math.abs(value30 - value28),
            ox: marquee.resizing ? value29 : value27,
            oy: marquee.resizing ? value30 : value28,
          };
        }
        if (value7) {
          return value7;
        }
        if (drawn) {
          return {
            left: callback30(drawn.x),
            top: callback31(drawn.y),
            width: drawn.w * value3.width,
            height: drawn.h * value3.height,
            ox: callback30(drawn.ox),
            oy: callback31(drawn.oy),
          };
        }
        return null;
      })(),
      value22 = callback16(),
      value23: CommentBox | null = value5
        ? {
            left: 0,
            top: 0,
            width: value5.w,
            height: value5.h,
          }
        : null,
      value24: CommentBox | null =
        value3 && value5
          ? (0, runtime.collectCommentableNodeElements)(
              value3,
              value5.w,
              value5.h,
              topInset,
            )
          : null,
      value25: CommentBox | null =
        value11 === null || value15
          ? null
          : value11 === "slide"
            ? (value24 ?? value23)
            : (value9.find(
                (input) => input.key === value11.key,
              )?.rect ?? null),
      value26: CommentPoint | null =
        value25 && value13 && !(value11 === "slide" && !value24)
          ? (0, runtime.defaultCommentPoint)(value25)
          : null,
      callback29 = (input: SlideCommentTarget): HTMLAttributes<HTMLDivElement> => ({
        role: "button",
        tabIndex: 0,
        className: "pointer-events-none absolute focus-visible:outline-hidden",
        onKeyDown: (input2: ReactKeyboardEvent<HTMLDivElement>): void => callback24(input2, input),
        onClick: (event: ReactMouseEvent<HTMLDivElement>): void => {
          if (event.target !== event.currentTarget) {
            return;
          }
          event.currentTarget.focus({
            preventScroll: true,
          });
          callback23(input);
        },
        onFocus: (): void => {
          ref12.current = input;
          callback6(true);
          if (!ref15.current) {
            value16(false);
          }
          callback20();
          value12(input);
        },
        onBlur: (input2: ReactFocusEvent<HTMLDivElement>): void => {
          if (
            input2.relatedTarget !== null &&
            slideCommentTargetsEqual(ref12.current, input)
          ) {
            ref12.current = null;
          }
          value12(
            (input3: SlideCommentTarget | null): SlideCommentTarget | null =>
              slideCommentTargetsEqual(input3, input) ? null : input3,
          );
        },
      });
    return SlideCommentLayerJsx.jsxs("div", {
      ref: ref8,
      "data-slides-comments": "",
      className: "absolute inset-0 z-[5] touch-none",
      style: {
        cursor: runtime.COMMENT_MODE_CURSOR,
      },
      onPointerMove: (input: ReactPointerEvent<HTMLDivElement>): void => {
        ref2.current = {
          x: input.clientX,
          y: input.clientY,
        };
        if (value20.drawing()) {
          return;
        }
        let current = containerRef.current,
          value27 = callback9(input.clientX, input.clientY);
        callback(
          value27 && current
            ? (0, runtime.getCommentElementRect)(
                value27.el,
                current.getBoundingClientRect(),
              )
            : null,
        );
      },
      onPointerLeave: (): void => {
        ref2.current = null;
        callback(null);
      },
      children: [
        value21
          ? SlideCommentLayerJsx.jsx(runtime.CommentAreaSelectionOutline, {
              rect: value21,
              origin:
                value21.ox != null && value21.oy != null
                  ? {
                      x: value21.ox,
                      y: value21.oy,
                    }
                  : null,
              handle: !!drawn && !marquee && !value7,
              kind: marquee ? "marquee" : value7 ? "thread" : "drawn",
            })
          : null,
        value && !marquee
          ? SlideCommentLayerJsx.jsx(runtime.CommentTargetHighlight, {
              rect: value,
            })
          : null,
        SlideCommentLayerJsx.jsx("div", {
          ref: ref9,
          "data-slides-comment-target": "slide",
          "aria-label": (0, runtime.formatCommentTargetLabel)(
            (0, runtime.formatFrameCommentLabel)(
              value22,
              slide,
              {
                kind: "slide",
              },
              typeStyles,
            ),
          ),
          "aria-describedby": value17,
          "aria-disabled": value3 && !value24 ? true : undefined,
          style: value24 ?? {
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
          },
          ...callback29("slide"),
        }),
        value9.map(
          (input: SlideCommentElementTarget) =>
            SlideCommentLayerJsx.jsx(
              "div",
              {
                "data-slides-comment-target": "element",
                "data-key": input.key,
                "aria-label": (0, runtime.formatCommentTargetLabel)(
                  (0, runtime.formatFrameCommentLabel)(
                    value22,
                    slide,
                    {
                      kind: "frame",
                      frameId: input.ref.frameId,
                      path: input.ref.path,
                    },
                    typeStyles,
                  ),
                ),
                "aria-describedby": value18,
                style: input.rect,
                ...callback29({
                  key: input.key,
                }),
              },
              input.key,
            ),
        ),
        SlideCommentLayerJsx.jsx("span", {
          id: value17,
          hidden: true,
          children:
            value3 && !value24
              ? runtime.SCROLLED_OUT_COMMENT_TARGET_MESSAGE
              : (0, runtime.commentKeyboardInstructions)(
                  "slide",
                  value9.length > 0,
                ),
        }),
        SlideCommentLayerJsx.jsx("span", {
          id: value18,
          hidden: true,
          children: (0, runtime.commentKeyboardInstructions)("element"),
        }),
        value25 && !marquee
          ? SlideCommentLayerJsx.jsx(runtime.CommentKeyHighlight, {
              rect: value25,
            })
          : null,
        value26 && !marquee
          ? SlideCommentLayerJsx.jsx(runtime.CommentKeyPin, {
              at: value26,
            })
          : null,
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "SlideCommentLayerJsx",
    () => SlideCommentLayerJsx,
    (value) => {
      SlideCommentLayerJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useSlideCommentController",
    () => useSlideCommentController,
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_AREA_TAP_TIMEOUT_MS",
    () => COMMENT_AREA_TAP_TIMEOUT_MS,
    (value) => {
      COMMENT_AREA_TAP_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_POINTER_MOVE_THRESHOLD_PX",
    () => COMMENT_POINTER_MOVE_THRESHOLD_PX,
    (value) => {
      COMMENT_POINTER_MOVE_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_TOUCH_MOVE_THRESHOLD_PX",
    () => COMMENT_TOUCH_MOVE_THRESHOLD_PX,
    (value) => {
      COMMENT_TOUCH_MOVE_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_AREA_MIN_SIZE_PX",
    () => COMMENT_AREA_MIN_SIZE_PX,
    (value) => {
      COMMENT_AREA_MIN_SIZE_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_COMMENT_UNIT_RECT",
    () => SLIDE_COMMENT_UNIT_RECT,
    (value) => {
      SLIDE_COMMENT_UNIT_RECT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampSlideCommentFraction",
    () => clampSlideCommentFraction,
    (value) => {
      clampSlideCommentFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideCommentTargetsEqual",
    () => slideCommentTargetsEqual,
    (value) => {
      slideCommentTargetsEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideCommentTargetsSameElement",
    () => slideCommentTargetsSameElement,
    (value) => {
      slideCommentTargetsSameElement = value;
    },
  );
  bindRuntimeValue(runtime, "SlideCommentLayer", () => SlideCommentLayer);
  return () => {
    SlideCommentLayerJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COMMENT_AREA_TAP_TIMEOUT_MS = 1500;
    COMMENT_POINTER_MOVE_THRESHOLD_PX = 4;
    COMMENT_TOUCH_MOVE_THRESHOLD_PX = 5;
    COMMENT_AREA_MIN_SIZE_PX = 16;
    SLIDE_COMMENT_UNIT_RECT = {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };
    clampSlideCommentFraction = (fraction: number): number =>
      Math.min(1, Math.max(0, fraction));
    slideCommentTargetsEqual = (
      left: SlideCommentTarget | null,
      right: SlideCommentTarget | null,
    ): boolean =>
      left === right ||
      (left !== null &&
        right !== null &&
        left !== "slide" &&
        right !== "slide" &&
        left.key === right.key);
    slideCommentTargetsSameElement = (
      left: SlideCommentElementTarget[],
      right: SlideCommentElementTarget[],
    ): boolean =>
      left === right ||
      (left.length === right.length &&
        left.every(
          (input, options) =>
            input.key === right[options]!.key &&
            (0, runtime.parseCommentCell)(input.rect, right[options]!.rect),
        ));
  };
}

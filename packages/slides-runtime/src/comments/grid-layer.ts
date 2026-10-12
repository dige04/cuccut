/** Restored application module; prepare first, initialize in original order. */
import type {
  FocusEvent as ReactFocusEvent,
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
  type ReactNamespace,
} from "../bindings";
import type { Slide } from "../deck-contracts";
import type { TypographyStyle } from "../model/typography";
import type { EditorPoint } from "../../../slides/src/editor-messages";
import type { CommentAnchorController } from "../../../slides/src/editor/slides-host";
import type { ParsedCommentAnchor } from "./anchors";
import type {
  CommentOperation,
  CommentUnitPoint,
  CommentUnitRect,
} from "./area-geometry";
import type { CommentAreaDrop, CommentDrawnArea } from "./area-selection";
import type { DescribedCommentAnchor } from "./hit-testing";
import type { CommentBox } from "./keyboard";

/** A comment thread the host asks the grid layer to mark (the host's `threads` callback). */
export interface GridCommentThread {
  id: string;
  anchor: string;
  active: boolean;
}

/** A slide of the deck together with its 1-based number. */
export interface GridDeckEntry {
  slide: Slide;
  n: number;
}

/** Slide lookups rebuilt whenever the slides or type styles change. */
export interface GridCommentDeck {
  byId: Map<string, GridDeckEntry>;
  /** Keyed by the hash that anchors use for a slide id. */
  byHash: Map<string, Slide>;
  /** Accessible names ("Comment on Slide 3 ...") keyed by slide id. */
  names: Map<string, string>;
}

/** A keyboard-focusable stand-in for one grid slide; `rect` is relative to the layer, `parked` when the slide is scrolled out of view. */
export interface GridCommentPin {
  id: string;
  rect: CommentBox;
  parked: boolean;
}

/** Outline of a marquee or thread area; `ox`/`oy` mark the corner the area was started from. */
export interface GridOutlineRect extends CommentBox {
  ox?: number;
  oy?: number;
}

/** Scrolls/zooms the grid so the slide is visible; false while the grid is still settling or the slide is unknown. */
export type GridShowSlide = (slideId: string, point?: EditorPoint) => boolean;

/** Props mirrored into a ref so long-lived listeners never read stale values. */
interface GridCommentLiveInputs {
  slides: Slide[];
  deck: GridCommentDeck;
  typeStyles: TypographyStyle[];
  currentId: string | null;
  topInset: number;
  showSlide: GridShowSlide;
  settling: () => boolean;
  live: boolean;
  reveal: ParsedCommentAnchor | null;
  onRevealed: (() => void) | undefined;
}

/** A pointer that went down on the layer and may still turn into a tap. */
interface GridPendingTap {
  id: number;
  x: number;
  y: number;
  touch: boolean;
}

/** A thread whose anchor parsed; `slide` is null when the anchor's slide or frame no longer exists. */
interface GridThreadEntry {
  id: string;
  active: boolean;
  a: ParsedCommentAnchor;
  slide: Slide | null;
}

/** Corner of an area's box that is anchored (bit 0: right, bit 1: bottom). */
export type GridBoxCorner = number;

/** A marquee area that is drawn or held on the grid: always owned by a slide (`id`). */
export interface GridDrawnArea extends CommentDrawnArea {
  id: string;
}

/** Moves a thread's pin: where `id` would land if dropped at `position` (client coordinates plus scroll), or null when it cannot. */
export type GridCommentMoveHandler = (
  id: string,
  position: EditorPoint,
) => Promise<GridCommentMoveResult | null>;

export interface GridCommentMoveResult {
  anchor: string;
  at: EditorPoint;
  label: string;
  detail?: string;
  area?: true;
}

export interface SlideGridCommentLayerProps {
  ctl: CommentAnchorController | null;
  /** Comment mode is on. */
  on: boolean;
  threads: GridCommentThread[];
  /** The host's composer is open. */
  composing: boolean;
  moveRef?: RefObject<GridCommentMoveHandler | null>;
  slides: Slide[];
  typeStyles: TypographyStyle[];
  containerRef: RefObject<HTMLElement | null>;
  currentId: string | null;
  /** True for targets that must not end comment mode when pressed. */
  keepsMode?: (target: Element) => boolean;
  topInset?: number;
  showSlide: GridShowSlide;
  settling: () => boolean;
  /** An anchor to scroll into view, or null. */
  reveal: ParsedCommentAnchor | null;
  onRevealed?: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactGridComments: ReactNamespace;
    GridCommentsJsx: JsxNamespace;
    GRID_COMMENT_TAP_TIMEOUT_MS: number;
    GRID_COMMENT_POINTER_THRESHOLD_PX: number;
    GRID_COMMENT_TOUCH_THRESHOLD_PX: number;
    GRID_COMMENT_AREA_MIN_SIZE_PX: number;
    GRID_COMMENT_UNIT_RECT: CommentUnitRect;
    clampGridCommentFraction: (fraction: number) => number;
    gridCommentPinsEqual: (
      left: GridCommentPin[],
      right: GridCommentPin[],
    ) => boolean;
    SlideGridCommentLayer: (
      props: SlideGridCommentLayerProps,
    ) => ReactElement | null;
  }
}

export function installCommentsGridLayer(runtime: RuntimeBindings): () => void {
  var ReactGridComments: ReactNamespace;
  var GridCommentsJsx: JsxNamespace;
  var GRID_COMMENT_TAP_TIMEOUT_MS: number;
  var GRID_COMMENT_POINTER_THRESHOLD_PX: number;
  var GRID_COMMENT_TOUCH_THRESHOLD_PX: number;
  var GRID_COMMENT_AREA_MIN_SIZE_PX: number;
  var GRID_COMMENT_UNIT_RECT: CommentUnitRect;
  var clampGridCommentFraction: RuntimeBindings["clampGridCommentFraction"];
  var gridCommentPinsEqual: RuntimeBindings["gridCommentPinsEqual"];
  function SlideGridCommentLayer({
    ctl: ctl,
    on: on2,
    threads: threads,
    composing: composing,
    moveRef: moveRef,
    slides: slides,
    typeStyles: typeStyles,
    containerRef: containerRef,
    currentId: currentId,
    keepsMode: keepsMode,
    topInset = 0,
    showSlide: showSlide,
    settling: settling,
    reveal: reveal,
    onRevealed: onRevealed,
  }: SlideGridCommentLayerProps): ReactElement | null {
    let value = ctl !== null && on2,
      memo = ReactGridComments.useMemo((): GridCommentDeck => {
        let entries = new Map(
            slides.map((input, options): [string, GridDeckEntry] => [
              input.id,
              {
                slide: input,
                n: options + 1,
              },
            ]),
          ),
          entries2 = new Map(
            slides.map((input): [string, Slide] => [
              (0, runtime.hashScopedSlideId)(input.id),
              input,
            ]),
          ),
          entries3 = new Map(
            slides.map((input, options): [string, string] => [
                input.id,
                (0, runtime.formatCommentTargetLabel)(
                  (0, runtime.formatFrameCommentLabel)(
                    options + 1,
                    input,
                    {
                      kind: "slide",
                    },
                    typeStyles,
                  ),
                ),
              ]),
          );
        return {
          byId: entries,
          byHash: entries2,
          names: entries3,
        };
      }, [slides, typeStyles]),
      ref = ReactGridComments.useRef<GridCommentLiveInputs>({
        slides: slides,
        deck: memo,
        typeStyles: typeStyles,
        currentId: currentId,
        topInset: topInset,
        showSlide: showSlide,
        settling: settling,
        live: value,
        reveal: reveal,
        onRevealed: onRevealed,
      });
    ref.current = {
      slides: slides,
      deck: memo,
      typeStyles: typeStyles,
      currentId: currentId,
      topInset: topInset,
      showSlide: showSlide,
      settling: settling,
      live: value,
      reveal: reveal,
      onRevealed: onRevealed,
    };
    let [value2, value3] = ReactGridComments.useState<CommentBox | null>(null),
      callback = (input: CommentBox | null): void =>
        value3((input2) =>
          (0, runtime.parseCommentCell)(input2, input) ? input2 : input,
        ),
      [value4, value5] = ReactGridComments.useState<CommentBox | null>(null),
      callback2 = (input: CommentBox | null): void =>
        value5((input2) =>
          (0, runtime.parseCommentCell)(input2, input) ? input2 : input,
        ),
      [value6, value7] = ReactGridComments.useState<CommentBox | null>(null),
      callback3 = (input: CommentBox | null): void =>
        value7((input2) =>
          (0, runtime.parseCommentCell)(input2, input) ? input2 : input,
        ),
      [value8, value9] = ReactGridComments.useState<GridCommentPin[]>([]),
      ref2 = ReactGridComments.useRef(value8);
    ref2.current = value8;
    let ref3 = ReactGridComments.useRef<EditorPoint | null>(null),
      ref4 = ReactGridComments.useRef<GridPendingTap | null>(null),
      ref5 = ReactGridComments.useRef(""),
      ref6 = ReactGridComments.useRef<HTMLDivElement | null>(null),
      ref7 = ReactGridComments.useRef<string | null>(null),
      memo2 = ReactGridComments.useMemo(
        (): GridThreadEntry[] =>
          threads.flatMap((input): GridThreadEntry[] => {
            let value26 = (0, runtime.parseSlideCommentAnchor)(input.anchor);
            if (!value26) {
              return [];
            }
            let value27 = memo.byHash.get(value26.slideHash) ?? null,
              value28 =
                value27 !== null &&
                value26.kind !== "slide" &&
                value26.frameHash !== null &&
                (0, runtime.resolvePromotedCommentFrame)(value26, value27) ===
                  null;
            return [
              {
                id: input.id,
                active: input.active,
                a: value26,
                slide: value28 ? null : value27,
              },
            ];
          }),
        [threads, memo],
      ),
      ref8 = ReactGridComments.useRef(memo2);
    ref8.current = memo2;
    let ref9 = ReactGridComments.useRef(new Map<string, Element>()),
      ref10 = ReactGridComments.useRef(new Map<string, Element | null>());
    ReactGridComments.useEffect(() => {
      ref9.current.clear();
      ref10.current.clear();
      ref5.current = "";
    }, [slides, memo2]);
    let callback4 = (input: string): Element | null => {
        let entry = ref9.current.get(input);
        if (entry?.isConnected) {
          return entry;
        }
        let value26 =
          containerRef.current?.querySelector(
            '[data-grid-tile="' + CSS.escape(input) + '"] [data-grid-surface]',
          ) ?? null;
        if (value26) {
          ref9.current.set(input, value26);
        } else {
          ref9.current.delete(input);
        }
        return value26;
      },
      callback5 = (
        input: ParsedCommentAnchor,
        options: Slide,
        context?: string,
      ): Element | null => {
        let value26 =
          context !== undefined ? ref10.current.get(context) : undefined;
        if (value26 === null || value26?.isConnected) {
          return value26;
        }
        let value27 = callback4(options.id);
        if (!value27) {
          return null;
        }
        let value28 = (0, runtime.resolveCommentAnchorElement)(
          input,
          options,
          value27,
          value27,
        );
        if (context !== undefined) {
          ref10.current.set(context, value28);
        }
        return value28;
      },
      callback6 = (
        input: number,
        options: number,
      ): { slide: Slide; surface: Element } | null => {
        for (let value26 of ref.current.slides) {
          let value27 = callback4(value26.id),
            value28 = value27?.getBoundingClientRect();
          if (
            value27 &&
            value28 &&
            input >= value28.left &&
            input <= value28.right &&
            options >= value28.top &&
            options <= value28.bottom
          ) {
            return {
              slide: value26,
              surface: value27,
            };
          }
        }
        return null;
      },
      callback7 = (input: number, options: number) => {
        let current = containerRef.current;
        if (!current) {
          return null;
        }
        for (let value26 of document.elementsFromPoint(
          input,
          options,
        )) {
          if (value26.closest("[data-slides-comments]")) {
            continue;
          }
          if (!current.contains(value26)) {
            return null;
          }
          let ancestor = value26.closest("[data-grid-surface]"),
            value27 =
              value26
                .closest("[data-grid-tile]")
                ?.getAttribute("data-grid-tile") ?? null;
          if (value27 === null) {
            return null;
          }
          if (!ancestor) {
            continue;
          }
          if (ref.current.deck.byId.has(value27)) {
            return (
              (0, runtime.hitTestFrameCommentAnchor)(
                value27,
                ancestor,
                value26,
                input,
                options,
              ) ??
              (0, runtime.hitTestSlideCommentAnchor)(
                value27,
                ancestor,
                input,
                options,
              )
            );
          } else {
            return null;
          }
        }
        return null;
      };
    ReactGridComments.useEffect(() => {
      if (!ctl || !on2) {
        return;
      }
      let index = 0,
        text = "",
        flag = true,
        callback24 = () => {
          index = requestAnimationFrame(callback24);
          let current = containerRef.current;
          if (!current) {
            return;
          }
          let bounds = current.getBoundingClientRect(),
            state: Record<string, EditorPoint> = {};
          for (let {
            id: value36,
            a: value37,
            slide: value38,
          } of ref8.current) {
            let value39 = value38
                ? callback5(value37, value38, value36)
                : null,
              value40 = value39
                ? (0, runtime.commentAnchorPoint)(value39, value37)
                : null;
            if (!value40) {
              continue;
            }
            let { x: value41, y: value42 } = value40;
            if (value41 < bounds.left) {
              value41 -= window.innerWidth;
            } else if (value41 > bounds.right) {
              value41 += window.innerWidth;
            }
            if (value42 < bounds.top + ref.current.topInset) {
              value42 -= window.innerHeight;
            } else if (value42 > bounds.bottom) {
              value42 += window.innerHeight;
            }
            state[value36] = {
              x: Math.round(value41 + window.scrollX),
              y: Math.round(value42 + window.scrollY),
            };
          }
          let value26 = JSON.stringify(state);
          if (value26 !== ref5.current) {
            ref5.current = value26;
            ctl.placed(state);
          }
          callback8();
          let value27 =
              (ref15.current ? ref7.current : null) ??
              ref13.current?.id ??
              null,
            value28 = value27 !== null ? callback4(value27) : null;
          callback2(
            value28
              ? (0, runtime.getCommentElementRect)(value28, bounds)
              : null,
          );
          let value29 = ctl.areas
              ? ref8.current.find((input) => input.active)
              : undefined,
            value30 =
              value29 && value29.slide && value29.a.kind === "area"
                ? callback5(value29.a, value29.slide, value29.id)
                : null;
          callback3(
            value29 && value29.a.kind === "area" && value30
              ? (0, runtime.commentAnchorAreaRect)(value30, value29.a, bounds)
              : null,
          );
          let current2 = ref3.current;
          if (current2 && !value11.drawing()) {
            let value36 = callback7(current2.x, current2.y);
            callback(
              value36
                ? (0, runtime.getCommentElementRect)(value36.el, bounds)
                : null,
            );
          }
          let slides2 = ref.current.slides,
            value31 = slides2[0]
              ? callback4(slides2[0].id)?.getBoundingClientRect()
              : undefined,
            value32 =
              slides2.length > 1
                ? callback4(
                    slides2[slides2.length - 1]!.id,
                  )?.getBoundingClientRect()
                : undefined,
            value33 = [
              value31?.left,
              value31?.top,
              value31?.width,
              value32?.left,
              value32?.top,
              bounds.width,
              bounds.height,
            ].join(",");
          if (value33 !== text) {
            flag = true;
          } else if (flag) {
            flag = false;
            ref23.current(bounds);
          }
          text = value33;
          let current3 = ref18.current,
            value34 =
              current3 !== null
                ? ref2.current.find(
                    (input) => input.id === current3,
                  )
                : undefined,
            value35 = value34 ? callback20(value34.id, bounds) : null;
          if (
            value34 &&
            value35 &&
            (value35.parked !== value34.parked ||
              !(0, runtime.parseCommentCell)(value35.rect, value34.rect))
          ) {
            value9(
              (input) =>
                input.map(
                  (input2) =>
                    input2.id === value34.id
                      ? {
                          id: input2.id,
                          ...value35,
                        }
                      : input2,
                ),
            );
          }
          if (value34 && value35 && !value35.parked) {
            value19(value34.id);
          }
          if (ref27.current !== null && !ref.current.settling()) {
            if (ref27.current === ref18.current) {
              ref.current.showSlide(ref27.current);
            }
            ref27.current = null;
          }
          let current4 = ref28.current;
          if (
            current4 !== null &&
            (Date.now() > current4.until || ref26.current(current4.id))
          ) {
            ref28.current = null;
          }
          if (
            ref25.current &&
            ref2.current.length > 0 &&
            !ref.current.settling()
          ) {
            ref25.current = false;
            if (callback19()) {
              callback18();
            }
          }
        };
      callback24();
      return () => {
        cancelAnimationFrame(index);
        ref5.current = "";
        ref3.current = null;
        callback(null);
        callback2(null);
        callback3(null);
        value9([]);
        ctl.placed({});
      };
    }, [ctl, on2]);
    let ref11 = ReactGridComments.useRef<ParsedCommentAnchor | null>(null),
      callback8 = (): void => {
        let value26 = ref.current.reveal ?? null;
        if (value26 === null || value26 === ref11.current) {
          if (value26 === null) {
            ref11.current = null;
          }
          return;
        }
        let value27 =
            ref.current.deck.byHash.get(value26.slideHash) ?? null,
          value28 = value27 ? callback4(value27.id) : null;
        if (value27 && !value28) {
          return;
        }
        if (value27 && value28) {
          let value29 = callback5(value26, value27),
            bounds = value28.getBoundingClientRect();
          if (
            !ref.current.showSlide(
              value27.id,
              (value29
                ? (0, runtime.commentAnchorPoint)(value29, value26)
                : null) ?? {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
              },
            )
          ) {
            return;
          }
        }
        ref11.current = value26;
        ref.current.onRevealed?.();
      };
    ReactGridComments.useEffect(() => {
      if (!ctl || !value || typeof ctl.exitMode !== "function") {
        return;
      }
      let callback24 = (event: PointerEvent) => {
        if (event.button !== 0) {
          return;
        }
        let value26 =
          event.target instanceof Element ? event.target : null;
        if (
          !value26 ||
          containerRef.current?.contains(value26) ||
          keepsMode?.(value26)
        ) {
          return;
        }
        ctl.exitMode?.();
      };
      document.addEventListener("pointerdown", callback24, true);
      return () =>
        document.removeEventListener(
          "pointerdown",
          callback24,
          true,
        );
    }, [ctl, value, keepsMode]);
    let callback9 = (input: number, options: number) => {
        let value26 = callback7(input, options),
          value27 = value26
            ? ref.current.deck.byId.get(value26.anchor.slideId)
            : undefined;
        if (value26 && value27) {
          return (0, runtime.createCommentAnchorDescription)(
            value26,
            value27.n,
            value27.slide,
            ref.current.typeStyles,
          );
        } else {
          return null;
        }
      },
      ref12 = ReactGridComments.useRef(
        (0, runtime.createCommentOperationToken)(),
      ),
      value10 = (0, runtime.useCommentMoveKeyHighlight)<GridDrawnArea>(
        composing,
        "canvas",
      ),
      { drawn: drawn } = value10,
      ref13 = ReactGridComments.useRef(drawn);
    ref13.current = drawn;
    let callback10 = (input: number, options: number): void => {
        ref12.current.cancel();
        if (!ctl) {
          return;
        }
        let value26 = callback9(input, options);
        if (!value26) {
          return;
        }
        ctl
          .compose(
            value26.anchor,
            {
              x: input + window.scrollX,
              y: options + window.scrollY,
            },
            {
              label: value26.label,
              ...(value26.detail
                ? {
                    detail: value26.detail,
                  }
                : {}),
            },
          )
          .then(
            (input2) => {
              if (input2.opened) {
                value10.clear();
              }
            },
            () => {
              return;
            },
          );
      },
      ref14 = ReactGridComments.useRef(callback10);
    ref14.current = callback10;
    let callback11 = (): DOMRect | null =>
        ref7.current !== null
          ? (callback4(ref7.current)?.getBoundingClientRect() ?? null)
          : null,
      value11 = (0, runtime.useCommentAreaDrag)({
        toLocal: (input: number, options: number) => {
          let value26 = callback11();
          if (value26) {
            return {
              x: (input - value26.left) / (value26.width || 1),
              y: (options - value26.top) / (value26.height || 1),
            };
          } else {
            return null;
          }
        },
        toClient: (input: CommentUnitPoint) => {
          let value26 = callback11();
          if (value26) {
            return {
              x: value26.left + input.x * value26.width,
              y: value26.top + input.y * value26.height,
            };
          } else {
            return null;
          }
        },
        stage: () => containerRef.current,
        slopPx: GRID_COMMENT_TOUCH_THRESHOLD_PX,
        onClick: (input: PointerEvent) =>
          ref14.current(input.clientX, input.clientY),
        onNothing: () => {
          ref7.current = null;
          value10.restore();
        },
        onLive: () => {
          value10.show(null);
          let value26 =
              ref7.current !== null ? callback4(ref7.current) : null,
            value27 = containerRef.current?.getBoundingClientRect();
          if (value26 && value27) {
            callback2((0, runtime.getCommentElementRect)(value26, value27));
          }
        },
        onArea: ({
          c0: c0,
          c1: c1,
          at: at,
          resizing: resizing,
        }: CommentAreaDrop) => {
          let current = ref7.current;
          ref7.current = null;
          let [value26] = (0, runtime.rankCommentAreaHosts)(
            {
              x: Math.min(c0.x, c1.x),
              y: Math.min(c0.y, c1.y),
              w: Math.abs(c1.x - c0.x),
              h: Math.abs(c1.y - c0.y),
            },
            [
              {
                board: GRID_COMMENT_UNIT_RECT,
                frame: GRID_COMMENT_UNIT_RECT,
              },
            ],
          );
          if (!value26 || current === null) {
            return value10.restore();
          }
          let value27 = resizing ? c1 : c0,
            state = {
              ...value26.inter,
              id: current,
              ox: clampGridCommentFraction(value27.x),
              oy: clampGridCommentFraction(value27.y),
            };
          value10.show(state);
          ref16.current(
            state,
            {
              x: at.x + window.scrollX,
              y: at.y + window.scrollY,
            },
            (0, runtime.nearestCommentBoxCorner)(
              value26.inter,
              resizing ? c0 : c1,
            ),
            ref12.current.begin(),
          );
        },
      }),
      ref15 = ReactGridComments.useRef(false);
    ref15.current = value11.marquee !== null;
    ReactGridComments.useEffect(() => {
      value11.cancel();
      value10.clear();
      ref12.current.cancel();
      ref7.current = null;
    }, [ctl, value]);
    ReactGridComments.useEffect(() => {
      if (threads.some((input) => input.active)) {
        value10.show(null);
      }
    }, [threads]);
    let callback12 = (
        input: string,
        options: CommentUnitRect,
        context?: GridBoxCorner,
      ) => {
        let entry = ref.current.deck.byId.get(input),
          value26 = callback4(input);
        if (!entry || !value26) {
          return null;
        }
        return (0, runtime.describeSlideCommentArea)(
          options,
          context,
          (0, runtime.collectSlideCommentAreaTargets)(
            entry.slide,
            value26,
            value26,
            "[data-slides-comments]",
          ).els,
          entry.n,
          entry.slide,
          ref.current.typeStyles,
        );
      },
      callback13 = (
        input: GridDrawnArea,
        options: EditorPoint,
        context: GridBoxCorner | undefined,
        value26: CommentOperation,
      ): void => {
        let value27 = ctl;
        if (!value27 || !value) {
          return;
        }
        let callback24 = () => {
            if (value26.live) {
              value10.restore();
            }
          },
          value28 = callback12(input.id, input, context);
        if (!value28 || !ref.current.live || !value26.live) {
          return callback24();
        }
        value27
          .compose(value28.anchor, options, {
            label: value28.label,
            ...(value28.detail
              ? {
                  detail: value28.detail,
                }
              : {}),
            area: true,
          })
          .then((input2) => {
            if (!input2.opened) {
              return callback24();
            }
            if (value26.live) {
              value10.hold(input, "canvas");
            }
          }, callback24);
      },
      ref16 = ReactGridComments.useRef(callback13);
    ref16.current = callback13;
    let callback14 = async (
        input: string,
        options: EditorPoint,
      ): Promise<GridCommentMoveResult | null> => {
        if (!ctl || !ref.current.live) {
          return null;
        }
        let value26 = ref8.current.find(
          (input2) => input2.id === input,
        );
        if (!value26) {
          return null;
        }
        let state = {
            x: options.x - window.scrollX,
            y: options.y - window.scrollY,
          },
          value27 = callback7(state.x, state.y),
          value28 = value27 ? callback6(state.x, state.y) : null;
        if (
          !value27 ||
          !value28 ||
          value28.slide.id !== value27.anchor.slideId
        ) {
          return null;
        }
        let value29 =
            ref.current.deck.byId.get(value28.slide.id)?.n ?? 0,
          value30: DescribedCommentAnchor | null;
        if (value26.a.kind === "area") {
          let value35 = value26.slide
              ? callback4(value26.slide.id)?.getBoundingClientRect()
              : null,
            value36 = value26.slide
              ? callback5(value26.a, value26.slide, input)
              : null,
            value37 =
              value36 && value35
                ? (0, runtime.commentAnchorAreaRect)(
                    value36,
                    value26.a,
                    value35,
                  )
                : null,
            bounds = value28.surface.getBoundingClientRect();
          if (!value37 || !value35) {
            return null;
          }
          let state2 = {
              x: value37.left / (value35.width || 1),
              y: value37.top / (value35.height || 1),
              w: value37.width / (value35.width || 1),
              h: value37.height / (value35.height || 1),
            },
            value38 = (0, runtime.commentBoxCornerPoint)(
              state2,
              value26.a.box.corner,
            ),
            state3 = {
              x: (state.x - bounds.left) / (bounds.width || 1),
              y: (state.y - bounds.top) / (bounds.height || 1),
            },
            value39 =
              state2.w / ((value26.a.box.x1 - value26.a.box.x0) * 1000),
            value40 =
              state2.h / ((value26.a.box.y1 - value26.a.box.y0) * 1000),
            value41 =
              Math.round((state3.x - value38.x) / value39) * value39,
            value42 =
              Math.round((state3.y - value38.y) / value40) * value40,
            [value43] = (0, runtime.rankCommentAreaHosts)(
              {
                x: state2.x + value41,
                y: state2.y + value42,
                w: state2.w,
                h: state2.h,
              },
              [
                {
                  board: GRID_COMMENT_UNIT_RECT,
                  frame: GRID_COMMENT_UNIT_RECT,
                },
              ],
            );
          value30 = value43
            ? callback12(value28.slide.id, value43.inter, value26.a.box.corner)
            : null;
        } else {
          value30 = (0, runtime.createCommentAnchorDescription)(
            value27,
            value29,
            value28.slide,
            ref.current.typeStyles,
          );
        }
        if (!value30 || !ref.current.live) {
          return null;
        }
        let value31 = (0, runtime.parseSlideCommentAnchor)(
            value30.anchor,
          ),
          value32 = value31 ? callback5(value31, value28.slide) : null,
          value33 =
            value31 && value32
              ? (0, runtime.commentAnchorPoint)(value32, value31)
              : null,
          value34 = value33
            ? {
                x: Math.round(value33.x + window.scrollX),
                y: Math.round(value33.y + window.scrollY),
              }
            : options;
        return {
          anchor: value30.anchor,
          at: value34,
          label: value30.label,
          ...(value30.detail
            ? {
                detail: value30.detail,
              }
            : {}),
          ...(value30.area
            ? {
                area: true,
              }
            : {}),
        };
      },
      ref17 = ReactGridComments.useRef(callback14);
    ref17.current = callback14;
    ReactGridComments.useEffect(() => {
      if (!moveRef || !value) {
        return;
      }
      let callback24: GridCommentMoveHandler = (input, options) =>
        ref17.current(input, options);
      moveRef.current = callback24;
      return () => {
        if (moveRef.current === callback24) {
          moveRef.current = null;
        }
      };
    }, [moveRef, value]);
    let [value12, value13] = ReactGridComments.useState<string | null>(null),
      ref18 = ReactGridComments.useRef<string | null>(null);
    ref18.current = value12;
    let ref19 = ReactGridComments.useRef<string | null>(null),
      [value14, value15] = ReactGridComments.useState(true),
      ref20 = ReactGridComments.useRef(true),
      ref21 = ReactGridComments.useRef<EditorPoint | null>(null),
      callback15 = (input: boolean): void => {
        if (ref20.current === input) {
          return;
        }
        ref20.current = input;
        if (input) {
          ref21.current = null;
        }
        value15(input);
      },
      [value16, value17] = ReactGridComments.useState(false),
      [value18, value19] = ReactGridComments.useState<string | null>(null),
      ref22 = ReactGridComments.useRef(false),
      callback16 = (input: string | null): HTMLElement | null =>
        input === null
          ? null
          : (ref6.current?.querySelector(
              '[data-slides-comment-target][data-key="' +
                CSS.escape(input) +
                '"]',
            ) ?? null),
      callback17 = (input: HTMLElement | null): void => {
        if (!input) {
          return;
        }
        ref22.current = true;
        input.focus({
          preventScroll: true,
        });
        ref22.current = false;
      },
      callback18 = (): void => {
        let current = ref2.current,
          value26 =
            current.find(
              (input) =>
                input.id === ref.current.currentId && !input.parked,
            ) ??
            current.find((input) => !input.parked) ??
            current.find(
              (input) => input.id === ref.current.currentId,
            ) ??
            current[0];
        callback17(callback16(value26?.id ?? null));
        value17(
          typeof window.matchMedia === "function" &&
            window.matchMedia("(hover: none)").matches,
        );
      },
      callback19 = (): boolean => {
        let activeElement = document.activeElement;
        return (
          document.hasFocus() &&
          (activeElement === null ||
            activeElement === document.body ||
            activeElement === document.documentElement ||
            activeElement === containerRef.current ||
            ref6.current?.contains(activeElement) === true)
        );
      },
      callback20 = (
        input: string,
        options: DOMRect,
      ): { rect: CommentBox; parked: boolean } | null => {
        let value26 = callback4(input)?.getBoundingClientRect();
        if (!value26) {
          return null;
        }
        let state = {
            left: value26.left - options.left,
            top: value26.top - options.top,
            width: value26.width,
            height: value26.height,
          },
          value27 = (0, runtime.collectCommentableNodeElements)(
            state,
            options.width,
            options.height,
            ref.current.topInset,
          );
        if (value27) {
          return {
            rect: value27,
            parked: false,
          };
        } else {
          return {
            rect: {
              left: Math.min(Math.max(state.left, 0), options.width - 1),
              top: Math.min(
                Math.max(state.top, ref.current.topInset),
                options.height - 1,
              ),
              width: 1,
              height: 1,
            },
            parked: true,
          };
        }
      },
      callback21 = (input: DOMRect): void => {
        let value26 = ref.current.slides.flatMap(
          (input2) => {
            let value27 = callback20(input2.id, input);
            if (value27) {
              return [
                {
                  id: input2.id,
                  ...value27,
                },
              ];
            } else {
              return [];
            }
          },
        );
        if (!gridCommentPinsEqual(ref2.current, value26)) {
          value9(value26);
        }
      },
      ref23 = ReactGridComments.useRef(callback21);
    ref23.current = callback21;
    ReactGridComments.useEffect(() => {
      let value26 = containerRef.current?.getBoundingClientRect();
      if (value && value26) {
        callback21(value26);
      }
    }, [value, slides, topInset]);
    let ref24 = ReactGridComments.useRef(false),
      ref25 = ReactGridComments.useRef(false);
    ReactGridComments.useEffect(() => {
      ref25.current =
        value &&
        !ref24.current &&
        (0, runtime.elapsedSinceCommentComposition)() >=
          GRID_COMMENT_TAP_TIMEOUT_MS &&
        callback19();
      ref24.current = value;
    }, [value]);
    ReactGridComments.useLayoutEffect(
      () => () => {
        if (ref6.current?.contains(document.activeElement)) {
          containerRef.current?.focus({
            preventScroll: true,
          });
        }
      },
      [],
    );
    ReactGridComments.useEffect(() => {
      if (!value) {
        return;
      }
      let callback24 = (input: PointerEvent) => {
          let current = ref21.current;
          if (current === null) {
            ref21.current = {
              x: input.clientX,
              y: input.clientY,
            };
          } else if (
            Math.abs(input.clientX - current.x) +
              Math.abs(input.clientY - current.y) >
            GRID_COMMENT_POINTER_THRESHOLD_PX
          ) {
            callback15(false);
          }
        },
        callback25 = (input: PointerEvent) => {
          if ((0, runtime.isCommentKeyboardTarget)(input)) {
            return;
          }
          callback15(false);
          ref19.current = null;
        },
        value26: ReturnType<typeof setTimeout> | undefined,
        callback26 = () => {
          let activeElement = document.activeElement;
          if (
            ref19.current === null ||
            !document.hasFocus() ||
            !(
              activeElement === null ||
              activeElement === document.body ||
              activeElement === document.documentElement
            )
          ) {
            return;
          }
          callback17(
            callback16(ref19.current) ??
              ref6.current?.querySelector("[data-slides-comment-target]") ??
              null,
          );
        },
        callback27 = () => {
          clearTimeout(value26);
          value26 = setTimeout(callback26, 0);
        };
      document.addEventListener("pointermove", callback24, {
        capture: true,
        passive: true,
      });
      document.addEventListener("pointerdown", callback25, true);
      window.addEventListener("focus", callback27);
      return () => {
        clearTimeout(value26);
        document.removeEventListener(
          "pointermove",
          callback24,
          true,
        );
        document.removeEventListener(
          "pointerdown",
          callback25,
          true,
        );
        window.removeEventListener("focus", callback27);
      };
    }, [value]);
    ReactGridComments.useEffect(() => {
      let value26 = ref18.current ?? ref19.current;
      if (
        value26 === null ||
        value8.some((input) => input.id === value26)
      ) {
        return;
      }
      if (callback19()) {
        callback18();
      } else {
        value13(null);
      }
    }, [value8]);
    let callback22 = (input: string): boolean => {
        if (ref.current.settling()) {
          return false;
        }
        let entry = ref.current.deck.byId.get(input),
          value26 = callback4(input)?.getBoundingClientRect(),
          value27 = containerRef.current?.getBoundingClientRect();
        if (!ctl || !entry || !value26 || !value27) {
          return false;
        }
        let value28 = (0, runtime.collectCommentableNodeElements)(
          {
            left: value26.left - value27.left,
            top: value26.top - value27.top,
            width: value26.width,
            height: value26.height,
          },
          value27.width,
          value27.height,
          ref.current.topInset,
        );
        if (!value28) {
          return false;
        }
        ref12.current.cancel();
        let value29 = (0, runtime.defaultCommentPoint)({
            left: value27.left + value28.left,
            top: value27.top + value28.top,
            width: value28.width,
            height: value28.height,
          }),
          value30 = (0, runtime.encodeSlideCommentAnchor)({
            kind: "slide",
            slideId: input,
            fx: clampGridCommentFraction(
              (value29.x - value26.left) / (value26.width || 1),
            ),
            fy: clampGridCommentFraction(
              (value29.y - value26.top) / (value26.height || 1),
            ),
          });
        if (value30 === null) {
          return true;
        }
        ctl
          .compose(
            value30,
            {
              x: value29.x + window.scrollX,
              y: value29.y + window.scrollY,
            },
            (0, runtime.describeFrameCommentAnchor)(
              entry.n,
              entry.slide,
              {
                kind: "slide",
              },
              ref.current.typeStyles,
            ),
          )
          .then(
            (input2) => {
              if (input2.opened) {
                value10.clear();
              }
            },
            () => {
              return;
            },
          );
        return true;
      },
      ref26 = ReactGridComments.useRef(callback22);
    ref26.current = callback22;
    let ref27 = ReactGridComments.useRef<string | null>(null),
      ref28 = ReactGridComments.useRef<{ id: string; until: number } | null>(
        null,
      ),
      callback23 = (
        input: PointerEvent,
        options: HTMLElement,
        context?: CommentUnitPoint,
      ): boolean => {
        if (
          !ctl?.areas ||
          input.button !== 0 ||
          input.pointerType !== "mouse"
        ) {
          return false;
        }
        let value26 = context
          ? (ref13.current?.id ?? null)
          : (callback6(input.clientX, input.clientY)?.slide.id ?? null);
        if (value26 === null) {
          return false;
        }
        ref7.current = value26;
        callback(null);
        if (value11.start(input, options, context)) {
          return true;
        }
        ref7.current = null;
        return false;
      },
      ref29 = ReactGridComments.useRef(callback23);
    ref29.current = callback23;
    ReactGridComments.useEffect(() => {
      let current = ref6.current;
      if (!current) {
        return;
      }
      let values = new Set<number>(),
        callback24 = (event: PointerEvent) => {
          if (event.button !== 0) {
            return;
          }
          if (event.pointerType === "mouse") {
            event.stopPropagation();
          }
          if ((0, runtime.isCommentKeyboardTarget)(event)) {
            ref4.current = null;
            return;
          }
          if (event.pointerType === "touch") {
            values.add(event.pointerId);
          }
          if (values.size > 1 || ref.current.settling()) {
            ref4.current = null;
            return;
          }
          let value26 =
              event.target instanceof Element &&
              event.target.closest("[data-area-handle]")
                ? ref13.current
                : null,
            value27 = value26
              ? {
                  x:
                    value26.ox <= value26.x + value26.w / 2
                      ? value26.x + value26.w
                      : value26.x,
                  y:
                    value26.oy <= value26.y + value26.h / 2
                      ? value26.y + value26.h
                      : value26.y,
                }
              : undefined;
          if (ref29.current(event, current, value27)) {
            return;
          }
          ref4.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            touch: event.pointerType === "touch",
          };
        },
        callback25 = (input: PointerEvent) => {
          values.delete(input.pointerId);
          let current2 = ref4.current;
          if (!current2 || current2.id !== input.pointerId) {
            return;
          }
          ref4.current = null;
          if (
            Math.hypot(input.clientX - current2.x, input.clientY - current2.y) >
            (current2.touch
              ? GRID_COMMENT_AREA_MIN_SIZE_PX
              : GRID_COMMENT_TOUCH_THRESHOLD_PX)
          ) {
            return;
          }
          ref14.current(input.clientX, input.clientY);
        },
        callback26 = (input: PointerEvent) => {
          values.delete(input.pointerId);
          if (ref4.current?.id === input.pointerId) {
            ref4.current = null;
          }
        };
      current.addEventListener("pointerdown", callback24);
      window.addEventListener("pointerup", callback25, true);
      window.addEventListener("pointercancel", callback26, true);
      return () => {
        current.removeEventListener("pointerdown", callback24);
        window.removeEventListener("pointerup", callback25, true);
        window.removeEventListener(
          "pointercancel",
          callback26,
          true,
        );
      };
    }, [value]);
    let value20 = ReactGridComments.useId(),
      value21 = ReactGridComments.useId(),
      value22 = ReactGridComments.useId();
    if (!value) {
      return null;
    }
    let { marquee: marquee } = value11,
      value23 = ((): GridOutlineRect | null => {
        if (value6 && !marquee) {
          return value6;
        }
        if (!value4) {
          return null;
        }
        let callback24 = (input: number) =>
            value4.left + input * value4.width,
          callback25 = (input: number) =>
            value4.top + input * value4.height;
        if (marquee) {
          let value26 = callback24(marquee.pin.x),
            value27 = callback25(marquee.pin.y),
            { x1: value28, y1: value29 } = marquee;
          return {
            left: Math.min(value26, value28),
            top: Math.min(value27, value29),
            width: Math.abs(value28 - value26),
            height: Math.abs(value29 - value27),
            ox: marquee.resizing ? value28 : value26,
            oy: marquee.resizing ? value29 : value27,
          };
        }
        if (drawn) {
          return {
            left: callback24(drawn.x),
            top: callback25(drawn.y),
            width: drawn.w * value4.width,
            height: drawn.h * value4.height,
            ox: callback24(drawn.ox),
            oy: callback25(drawn.oy),
          };
        } else {
          return null;
        }
      })(),
      value24 =
        value12 === null || value16
          ? undefined
          : value8.find((input) => input.id === value12),
      value25 =
        value24 && value14 && !value24.parked
          ? (0, runtime.defaultCommentPoint)(value24.rect)
          : null;
    return GridCommentsJsx.jsxs("div", {
      ref: ref6,
      "data-slides-comments": "",
      className: "absolute inset-0 z-[45] touch-none",
      style: {
        cursor: runtime.COMMENT_MODE_CURSOR,
      },
      onPointerMove: (input: ReactPointerEvent<HTMLDivElement>) => {
        ref3.current = {
          x: input.clientX,
          y: input.clientY,
        };
        if (value11.drawing()) {
          return;
        }
        let current = containerRef.current,
          value26 = callback7(input.clientX, input.clientY);
        callback(
          value26 && current
            ? (0, runtime.getCommentElementRect)(
                value26.el,
                current.getBoundingClientRect(),
              )
            : null,
        );
      },
      onPointerLeave: () => {
        ref3.current = null;
        callback(null);
      },
      children: [
        value23
          ? GridCommentsJsx.jsx(runtime.CommentAreaSelectionOutline, {
              rect: value23,
              origin:
                value23.ox != null && value23.oy != null
                  ? {
                      x: value23.ox,
                      y: value23.oy,
                    }
                  : null,
              handle: !!drawn && !marquee && !value6,
              kind: marquee ? "marquee" : value6 ? "thread" : "drawn",
            })
          : null,
        value2 && !marquee
          ? GridCommentsJsx.jsx(runtime.CommentTargetHighlight, {
              rect: value2,
            })
          : null,
        value8.map((input, options) => {
          let value26 =
            input.parked && value12 === input.id && value18 === input.id;
          return GridCommentsJsx.jsx(
            "div",
            {
              "data-slides-comment-target": "slide",
              "data-key": input.id,
              "data-parked": input.parked ? "" : undefined,
              role: "button",
              tabIndex: 0,
              "aria-label": memo.names.get(input.id),
              "aria-describedby": value26
                ? value22
                : options < value8.length - 1
                  ? value20
                  : value21,
              "aria-disabled": value26 ? true : undefined,
              className:
                "pointer-events-none absolute focus-visible:outline-hidden",
              style: input.rect,
              onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
                let current = ref20.current;
                callback15(true);
                value17(false);
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
                  callback22(input.id);
                }
              },
              onClick: (event: ReactMouseEvent<HTMLDivElement>) => {
                if (event.target !== event.currentTarget) {
                  return;
                }
                event.currentTarget.focus({
                  preventScroll: true,
                });
                if (!callback22(input.id)) {
                  ref28.current = {
                    id: input.id,
                    until: Date.now() + 1000,
                  };
                }
              },
              onFocus: () => {
                let value27 =
                  !ref22.current && ref19.current !== input.id;
                ref19.current = input.id;
                callback15(true);
                value13(input.id);
                if (containerRef.current) {
                  containerRef.current.scrollTop =
                    containerRef.current.scrollLeft = 0;
                }
                if (!value27) {
                  return;
                }
                value17(false);
                value19(null);
                if (settling()) {
                  ref27.current = input.id;
                } else {
                  showSlide(input.id);
                }
              },
              onBlur: (input2: ReactFocusEvent<HTMLDivElement>) => {
                if (
                  input2.relatedTarget !== null &&
                  ref19.current === input.id
                ) {
                  ref19.current = null;
                }
                value13(
                  (input3) =>
                    input3 === input.id ? null : input3,
                );
              },
            },
            input.id,
          );
        }),
        GridCommentsJsx.jsx("span", {
          id: value20,
          hidden: true,
          children: (0, runtime.commentKeyboardInstructions)(
            "canvas-slide",
            true,
          ),
        }),
        GridCommentsJsx.jsx("span", {
          id: value21,
          hidden: true,
          children: (0, runtime.commentKeyboardInstructions)("canvas-slide"),
        }),
        GridCommentsJsx.jsx("span", {
          id: value22,
          hidden: true,
          children: runtime.SCROLLED_OUT_COMMENT_TARGET_MESSAGE,
        }),
        value24 && !marquee
          ? GridCommentsJsx.jsx(runtime.CommentKeyHighlight, {
              rect: value24.rect,
            })
          : null,
        value25 && !marquee
          ? GridCommentsJsx.jsx(runtime.CommentKeyPin, {
              at: value25,
            })
          : null,
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactGridComments",
    () => ReactGridComments,
    (value) => {
      ReactGridComments = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GridCommentsJsx",
    () => GridCommentsJsx,
    (value) => {
      GridCommentsJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COMMENT_TAP_TIMEOUT_MS",
    () => GRID_COMMENT_TAP_TIMEOUT_MS,
    (value) => {
      GRID_COMMENT_TAP_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COMMENT_POINTER_THRESHOLD_PX",
    () => GRID_COMMENT_POINTER_THRESHOLD_PX,
    (value) => {
      GRID_COMMENT_POINTER_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COMMENT_TOUCH_THRESHOLD_PX",
    () => GRID_COMMENT_TOUCH_THRESHOLD_PX,
    (value) => {
      GRID_COMMENT_TOUCH_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COMMENT_AREA_MIN_SIZE_PX",
    () => GRID_COMMENT_AREA_MIN_SIZE_PX,
    (value) => {
      GRID_COMMENT_AREA_MIN_SIZE_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_COMMENT_UNIT_RECT",
    () => GRID_COMMENT_UNIT_RECT,
    (value) => {
      GRID_COMMENT_UNIT_RECT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampGridCommentFraction",
    () => clampGridCommentFraction,
    (value) => {
      clampGridCommentFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gridCommentPinsEqual",
    () => gridCommentPinsEqual,
    (value) => {
      gridCommentPinsEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideGridCommentLayer",
    () => SlideGridCommentLayer,
  );
  return () => {
    ReactGridComments = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    GridCommentsJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    GRID_COMMENT_TAP_TIMEOUT_MS = 1500;
    GRID_COMMENT_POINTER_THRESHOLD_PX = 4;
    GRID_COMMENT_TOUCH_THRESHOLD_PX = 5;
    GRID_COMMENT_AREA_MIN_SIZE_PX = 16;
    GRID_COMMENT_UNIT_RECT = {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };
    clampGridCommentFraction = (fraction) =>
      Math.min(1, Math.max(0, fraction));
    gridCommentPinsEqual = (left, right) =>
      left === right ||
      (left.length === right.length &&
        left.every(
          (input, options) =>
            input.id === right[options]!.id &&
            input.parked === right[options]!.parked &&
            (0, runtime.parseCommentCell)(input.rect, right[options]!.rect),
        ));
  };
}

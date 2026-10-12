/** Restored application module; prepare first, initialize in original order. */
import type {
  CSSProperties,
  MemoExoticComponent,
  ReactElement,
  RefObject,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { CreationPresentationState, CreationTimerHandle } from "./controller";

/** A point in the overlay layer's own coordinate space, in pixels. */
export interface CreationPoint {
  left: number;
  top: number;
}
/** A rectangle in the overlay layer's own coordinate space, in pixels. */
export interface CreationRect extends CreationPoint {
  width: number;
  height: number;
}
/** What the overlay last measured: the stage slide, where the cursor points and the first slide's ground colour. */
interface CreationOverlayLayout {
  slide: CreationRect | null;
  at: CreationPoint | null;
  ground: string | undefined;
  overSlide: boolean;
}
/** When the cursor glide and fade end, remembered between renders. */
interface CreationCursorMotion {
  key: string;
  until: number;
  hidden: boolean;
  fadeUntil: number;
}
/** The part of the editor viewport fit this overlay reads: offset and scale of the slide on the stage. */
interface CreationStageFit {
  x: number;
  y: number;
  scale: number;
}
/** Props of the overlay drawn above the editor stage and the slide rail while the agent creates slides. */
export interface SlideCreationOverlayProps {
  view: CreationPresentationState;
  /** The editor stage the slide sits in. */
  stage: RefObject<HTMLElement | null>;
  /** The slide rail the placeholder cells sit in. */
  rail: RefObject<HTMLElement | null>;
  insetTop: number;
  insetBottom: number;
  insetSide: number;
  hidden: boolean;
  /** Reports the scale the empty stage is fitted at. */
  onFit?: (scale: number) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactCreationOverlay: ReactNamespace;
    ReactCreationTips: ReactNamespace;
    CREATION_TIPS: string[];
    getCreationTip: (index: number) => string;
    creationTipIndexAtElapsed: (elapsedMs: number) => number;
    useCreationTipIndex: (enabled: boolean) => number;
    CreationOverlayJsx: JsxNamespace;
    escapeCreationSelector: (input: string) => string;
    creationCoordinatesApproximatelyEqual: (
      left: number | undefined,
      right: number | undefined,
    ) => boolean;
    creationRectsApproximatelyEqual: (
      left: CreationRect | null,
      right: CreationRect | null,
    ) => boolean;
    SlideCreationOverlay: MemoExoticComponent<
      (props: SlideCreationOverlayProps) => ReactElement
    >;
  }
}

export function installCreationOverlay(runtime: RuntimeBindings): () => void {
  var ReactCreationOverlay: ReactNamespace;
  var ReactCreationTips: ReactNamespace;
  var CREATION_TIPS: RuntimeBindings["CREATION_TIPS"];
  var CreationOverlayJsx: JsxNamespace;
  var escapeCreationSelector: RuntimeBindings["escapeCreationSelector"];
  var creationCoordinatesApproximatelyEqual: RuntimeBindings["creationCoordinatesApproximatelyEqual"];
  var creationRectsApproximatelyEqual: RuntimeBindings["creationRectsApproximatelyEqual"];
  var SlideCreationOverlay: RuntimeBindings["SlideCreationOverlay"];
  function getCreationTip(index: number): string {
    if (index < 0) {
      return runtime.CLAUDE_WORKING_LABEL;
    } else {
      return (
        CREATION_TIPS[index % CREATION_TIPS.length] ??
        runtime.CLAUDE_WORKING_LABEL
      );
    }
  }
  function creationTipIndexAtElapsed(elapsedMs: number): number {
    if (elapsedMs < runtime.CREATION_TIP_INITIAL_DELAY_MS) {
      return -1;
    } else {
      return Math.floor(
        (elapsedMs - runtime.CREATION_TIP_INITIAL_DELAY_MS) /
          runtime.CREATION_TIP_ROTATION_MS,
      );
    }
  }
  function useCreationTipIndex(enabled: boolean): number {
    let [index, setIndex] = ReactCreationTips.useState(-1);
    ReactCreationTips.useEffect((): (() => void) | void => {
      if (!enabled) {
        return;
      }
      let value: number = Date.now();
      setIndex(-1);
      let value2: CreationTimerHandle,
        callback = (): void => {
          let value3: number = Date.now() - value;
          setIndex(creationTipIndexAtElapsed(value3));
          let value4: number =
            value3 < runtime.CREATION_TIP_INITIAL_DELAY_MS
              ? runtime.CREATION_TIP_INITIAL_DELAY_MS - value3
              : runtime.CREATION_TIP_ROTATION_MS -
                ((value3 - runtime.CREATION_TIP_INITIAL_DELAY_MS) %
                  runtime.CREATION_TIP_ROTATION_MS);
          value2 = setTimeout(callback, value4);
        };
      value2 = setTimeout(callback, runtime.CREATION_TIP_INITIAL_DELAY_MS);
      return (): void => clearTimeout(value2);
    }, [enabled]);
    return index;
  }
  bindRuntimeValue(
    runtime,
    "ReactCreationOverlay",
    () => ReactCreationOverlay,
    (value) => {
      ReactCreationOverlay = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ReactCreationTips",
    () => ReactCreationTips,
    (value) => {
      ReactCreationTips = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CREATION_TIPS",
    () => CREATION_TIPS,
    (value) => {
      CREATION_TIPS = value;
    },
  );
  bindRuntimeValue(runtime, "getCreationTip", () => getCreationTip);
  bindRuntimeValue(
    runtime,
    "creationTipIndexAtElapsed",
    () => creationTipIndexAtElapsed,
  );
  bindRuntimeValue(runtime, "useCreationTipIndex", () => useCreationTipIndex);
  bindRuntimeValue(
    runtime,
    "CreationOverlayJsx",
    () => CreationOverlayJsx,
    (value) => {
      CreationOverlayJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "escapeCreationSelector",
    () => escapeCreationSelector,
    (value) => {
      escapeCreationSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationCoordinatesApproximatelyEqual",
    () => creationCoordinatesApproximatelyEqual,
    (value) => {
      creationCoordinatesApproximatelyEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "creationRectsApproximatelyEqual",
    () => creationRectsApproximatelyEqual,
    (value) => {
      creationRectsApproximatelyEqual = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideCreationOverlay",
    () => SlideCreationOverlay,
    (value) => {
      SlideCreationOverlay = value;
    },
  );
  return () => {
    ReactCreationOverlay = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ReactCreationTips = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    CREATION_TIPS = [
      "Double-click any text to edit it.",
      "Comment on any slide, and the agent can revise it.",
      "Invite people to view, comment, or edit.",
      "Use @ in a comment to mention someone.",
      "Drag an image from your computer onto a slide.",
      "Every edit saves automatically.",
      "People you share with see your changes live.",
      "Drag a slide thumbnail to change the order.",
      "Select anything on a slide to comment on it.",
    ];
    (0, runtime.initializeSlideModel)();
    CreationOverlayJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    escapeCreationSelector = (input: string): string =>
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(input)
        : input.replace(/["\\]/g, "\\$&");
    creationCoordinatesApproximatelyEqual = (
      left: number | undefined,
      right: number | undefined,
    ): boolean =>
      left === right ||
      (left !== undefined &&
        right !== undefined &&
        Math.abs(left - right) < 0.25);
    creationRectsApproximatelyEqual = (
      left: CreationRect | null,
      right: CreationRect | null,
    ): boolean =>
      left === right ||
      (left !== null &&
        right !== null &&
        creationCoordinatesApproximatelyEqual(left.left, right.left) &&
        creationCoordinatesApproximatelyEqual(left.top, right.top) &&
        creationCoordinatesApproximatelyEqual(left.width, right.width) &&
        creationCoordinatesApproximatelyEqual(left.height, right.height));
    SlideCreationOverlay = ReactCreationOverlay.memo(function ({
      view: view,
      stage: stage,
      insetTop: insetTop,
      insetBottom: insetBottom,
      insetSide: insetSide,
      rail: rail,
      hidden: hidden,
      onFit: onFit,
    }: SlideCreationOverlayProps): ReactElement {
      let ref = ReactCreationOverlay.useRef<HTMLDivElement>(null),
        ref2 = ReactCreationOverlay.useRef<HTMLParagraphElement>(null),
        ref3 = ReactCreationOverlay.useRef<HTMLElement>(null),
        [value, value2] = ReactCreationOverlay.useState<CreationOverlayLayout>({
          slide: null,
          at: null,
          ground: undefined,
          overSlide: false,
        }),
        [value3, value4] = ReactCreationOverlay.useState(0),
        value5: boolean = view.tag === "tips",
        value6: boolean = (0, runtime.useHostDrawsAgentTips)(),
        value7: number = useCreationTipIndex(value5),
        ref4 = ReactCreationOverlay.useRef<CreationPoint | null>(null),
        ref5 = ReactCreationOverlay.useRef<number | null>(null);
      ReactCreationOverlay.useEffect((): (() => void) => {
        let callback = (): void =>
            value4((input: number): number => input + 1),
          value16: ResizeObserver | null =
            typeof ResizeObserver === "function"
              ? new ResizeObserver(callback)
              : null,
          value17: Element | null =
            ref3.current?.closest(".mc-claude-cursor") ?? null;
        for (let value18 of [
          ref.current,
          stage.current,
          rail.current,
          value17,
        ])
          if (value18) {
            value16?.observe(value18);
          }
        let current: HTMLElement | null = rail.current;
        current?.addEventListener("scroll", callback, {
          capture: true,
          passive: true,
        });
        return (): void => {
          value16?.disconnect();
          current?.removeEventListener("scroll", callback, {
            capture: true,
          });
        };
      }, [
        stage,
        rail,
        view.phase,
        view.place === null,
        value.at === null,
        view.cells === null,
      ]);
      let place = view.place,
        value8: boolean =
          place?.on === "slide" &&
          !value5 &&
          (view.sheet === "none" ||
            (view.landing !== null && view.cells === null));
      ReactCreationOverlay.useLayoutEffect((): void => {
        let value16: DOMRect | undefined = ref.current?.getBoundingClientRect(),
          current: HTMLElement | null = stage.current;
        if (!value16 || !current) {
          return;
        }
        let callback = (input: DOMRect): CreationRect => ({
            left: input.left - value16.left,
            top: input.top - value16.top,
            width: input.width,
            height: input.height,
          }),
          bounds: DOMRect = current.getBoundingClientRect(),
          value17: CreationStageFit = (0, runtime.fitSlideEditorViewport)({
            w: bounds.width,
            h: Math.max(0, bounds.height - insetTop - insetBottom),
            top: insetTop,
            sidePad: insetSide > 0 ? insetSide : undefined,
          }),
          state: CreationRect = {
            left: bounds.left - value16.left - value17.x * value17.scale,
            top: bounds.top - value16.top - value17.y * value17.scale,
            width: runtime.SLIDE_WIDTH * value17.scale,
            height: runtime.SLIDE_HEIGHT * value17.scale,
          };
        if (value5 && ref3.current) {
          let bounds2: DOMRect = ref3.current.getBoundingClientRect();
          ref4.current = {
            left: bounds2.left - value16.left,
            top: bounds2.top - value16.top,
          };
        }
        let value18: CreationPoint | null = null;
        if (place?.on === "slide") {
          let state2: CreationPoint = {
            left: state.left + 12,
            top: state.top + 12,
          };
          value18 = value5
            ? {
                left: state.left + state.width / 2,
                top: state.top + state.height / 2 - 24,
              }
            : value8
              ? state2
              : (ref4.current ?? state2);
        } else if (place?.on === "title") {
          let value21: CreationRect | null = ref2.current
            ? callback(ref2.current.getBoundingClientRect())
            : null;
          value18 = value21
            ? {
                left: value21.left - 4,
                top: value21.top - 40,
              }
            : null;
        } else if (place?.on === "cell") {
          let value21: Element | null | undefined = rail.current?.querySelector(
              '[data-creation-cell="' + escapeCreationSelector(place.id) + '"]',
            ),
            value22: CreationRect | null = value21
              ? callback(value21.getBoundingClientRect())
              : null;
          value18 = value22
            ? {
                left: value22.left + 12,
                top: value22.top + 12,
              }
            : null;
        }
        let value19: string | undefined =
          view.landing === null ? undefined : value.ground;
        if (view.landing !== null && value19 === undefined) {
          let element: Element | null = current.querySelector(
            "[data-slide-surface]",
          );
          for (
            let index: number = 0;
            element !== null && index < 5;
            index++, element = element.firstElementChild
          ) {
            let backgroundColor: string =
              getComputedStyle(element).backgroundColor;
            if (
              backgroundColor !== "" &&
              backgroundColor !== "transparent" &&
              !/^rgba\(.+,\s*0\)$/.test(backgroundColor)
            ) {
              value19 = backgroundColor;
              break;
            }
          }
        }
        let value20: boolean =
          current.querySelector("[data-slide-surface]") !== null;
        if (value20 || !onFit) {
          ref5.current = null;
        } else if (ref5.current !== value17.scale) {
          ref5.current = value17.scale;
          onFit(value17.scale);
        }
        if (
          !creationRectsApproximatelyEqual(value.slide, state) ||
          !creationCoordinatesApproximatelyEqual(
            value.at?.left,
            value18?.left,
          ) ||
          !creationCoordinatesApproximatelyEqual(value.at?.top, value18?.top) ||
          (value.at === null) !== (value18 === null) ||
          value.ground !== value19 ||
          value.overSlide !== value20
        ) {
          value2({
            slide: state,
            at: value18,
            ground: value19,
            overSlide: value20,
          });
        }
      });
      let value9: string =
          place === null
            ? ""
            : place.on === "cell"
              ? "cell:" + place.id
              : value8
                ? "slide:corner"
                : place.on,
        ref6 = ReactCreationOverlay.useRef<CreationCursorMotion>({
          key: value9,
          until: 0,
          hidden: view.cursorHidden,
          fadeUntil: 0,
        }),
        value10: number =
          typeof performance !== "undefined" ? performance.now() : 0;
      if (ref6.current.key !== value9) {
        let value16: number =
          ref6.current.key === ""
            ? 0
            : value9 === "slide:corner"
              ? runtime.CREATION_CURSOR_CORNER_GLIDE_MS
              : view.glideMs;
        ref6.current = {
          ...ref6.current,
          key: value9,
          until: value10 + value16,
        };
      }
      if (ref6.current.hidden !== view.cursorHidden) {
        ref6.current = {
          ...ref6.current,
          hidden: view.cursorHidden,
          fadeUntil: value10 + runtime.CREATION_CURSOR_FADE_MS,
        };
      }
      let value11: number = Math.max(
        0,
        Math.round(
          Math.max(ref6.current.until, ref6.current.fadeUntil) - value10,
        ),
      );
      ReactCreationOverlay.useEffect((): (() => void) | void => {
        if (value11 <= 0) {
          return;
        }
        let value16: CreationTimerHandle = setTimeout(
          (): void => value4((input: number): number => input + 1),
          value11 + 20,
        );
        return (): void => clearTimeout(value16);
      }, [value11, value3]);
      let slide: CreationRect | null = value.slide,
        value12: boolean =
          (view.sheet === "ground" || view.sheet === "lifting") &&
          value.ground !== undefined,
        value13: number = value.overSlide ? 1 : 0,
        value14: CSSProperties | undefined = slide
          ? {
              left: slide.left - value13,
              top: slide.top - value13,
              width: slide.width + 2 * value13,
              height: slide.height + 2 * value13,
              ...(value12
                ? {
                    backgroundColor: value.ground,
                  }
                : {}),
              transitionDuration:
                String(
                  view.toEmptyDeck
                    ? runtime.CREATION_EMPTY_DECK_FADE_MS
                    : view.sheet === "ground"
                      ? runtime.CREATION_SHEET_GROUND_MS
                      : runtime.CREATION_SHEET_LIFT_MS,
                ) + "ms",
            }
          : undefined,
        value15: boolean =
          view.title !== "" &&
          (view.phase === "outline" || view.landing !== null);
      return CreationOverlayJsx.jsxs(CreationOverlayJsx.Fragment, {
        children: [
          view.cursor
            ? CreationOverlayJsx.jsx("span", {
                className: "sr-only",
                children: runtime.CLAUDE_WORKING_LABEL,
              })
            : null,
          CreationOverlayJsx.jsxs("div", {
            ref: ref,
            "aria-hidden": "true",
            className: (0, runtime.joinClassNames)(
              "sl-creation-layer pointer-events-none absolute inset-0 z-20 overflow-hidden",
              hidden && "invisible",
              view.sheetIn && "sl-creation-arrive",
            ),
            children: [
              view.sheet !== "none" && slide && !value.overSlide
                ? CreationOverlayJsx.jsx("div", {
                    className: (0, runtime.joinClassNames)(
                      "sl-creation-shadow absolute shadow-lg",
                      view.toEmptyDeck && "opacity-0",
                    ),
                    style: {
                      left: slide.left,
                      top: slide.top,
                      width: slide.width,
                      height: slide.height,
                      transitionDuration:
                        String(runtime.CREATION_EMPTY_DECK_FADE_MS) + "ms",
                    },
                  })
                : null,
              view.sheet !== "none" && value14
                ? CreationOverlayJsx.jsxs("div", {
                    className: (0, runtime.joinClassNames)(
                      "sl-creation-sheet absolute bg-editor-canvas",
                      (view.sheet === "lifting" || view.toEmptyDeck) &&
                        "opacity-0",
                    ),
                    style: value14,
                    "data-sheet": view.sheet,
                    children: [
                      CreationOverlayJsx.jsx("div", {
                        className: (0, runtime.joinClassNames)(
                          "mc-claude-box absolute inset-0",
                          value12 && "opacity-0",
                        ),
                      }),
                      value15
                        ? CreationOverlayJsx.jsx("p", {
                            ref: ref2,
                            dir: "auto",
                            className: (0, runtime.joinClassNames)(
                              "sl-creation-title mc-tip-shimmer absolute line-clamp-2 font-sans-display",
                              view.titleOn ? "opacity-100" : "opacity-0",
                            ),
                            style: {
                              left: "8%",
                              right: "20%",
                              bottom: "14%",
                              fontSize: slide ? slide.width * 0.058 : undefined,
                              transitionDuration:
                                String(
                                  view.titleOn
                                    ? runtime.CREATION_TITLE_FADE_IN_MS
                                    : runtime.CREATION_TITLE_FADE_OUT_MS,
                                ) + "ms",
                            },
                            children: view.title,
                          })
                        : null,
                    ],
                  })
                : null,
              value.at !== null && place !== null
                ? CreationOverlayJsx.jsx(runtime.AgentCursor, {
                    tint: "yellow",
                    at: value.at,
                    align: value5 ? "centre" : "arrow",
                    glideMs: value11,
                    hidden: view.cursorHidden,
                    arrowRef: ref3,
                    label:
                      value5 && !value6
                        ? {
                            kind: "words",
                            text: getCreationTip(value7),
                            index: value7,
                            shimmer: true,
                            outMs: runtime.CREATION_TIP_FADE_OUT_MS,
                            inMs: runtime.CREATION_TIP_FADE_IN_MS,
                          }
                        : {
                            kind: "name",
                            text: "Agent",
                          },
                  })
                : null,
            ],
          }),
        ],
      });
    });
  };
}

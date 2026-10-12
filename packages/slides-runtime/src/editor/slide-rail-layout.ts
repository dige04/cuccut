/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** A mutable React ref holding a value that may be absent. */
interface LayoutRef<T> {
  current: T | null;
}
/** The vertical space the slide rail can grow into. */
export interface RailMeasure {
  /** Height the rail and the stage above it share. */
  room: number;
  /** Rail height that does not scale with the thumbnails. */
  chrome: number;
  /** Widest thumbnail that still fits the rail horizontally. */
  fitW: number;
  /** The preferred thumbnail width. */
  pref: number;
}
/** The rail's horizontal scroll position expressed in thumbnail cells. */
export interface RailScrollAnchor {
  /** Viewport x of the anchor point. */
  at: number;
  /** Anchor point in cells. */
  t: number;
  pad: number;
  gap: number;
  view: number;
  /** True when a thumbnail is visible and must be kept in view. */
  held: boolean;
  /** True when that thumbnail is entirely visible. */
  whole: boolean;
  /** The viewport centre in cells. */
  mid: number;
}
/** Rail scroll metrics measured before the thumbnail width changes. */
export interface RailAnchorLayout {
  scrollLeft: number;
  view: number;
  pad: number;
  pitch: number;
  /** Current thumbnail width. */
  w: number;
  /** The anchor thumbnail's position relative to the rail's left edge. */
  anchor?: { left: number; width: number } | undefined;
}
/** A scroll anchor held across automatic thumbnail width changes. */
export interface RailAnchorHold extends RailScrollAnchor {
  onMount: boolean;
  /** Number of thumbnails when the hold was taken. */
  count: number;
  anchor: Element | null | undefined;
}
/** The scroll anchor and width bounds a rail resize gesture started from. */
interface RailGestureStart extends RailScrollAnchor {
  w: number;
  max: number;
}
/** The panel resize handle's gesture callbacks. */
export interface RailResizeGesture {
  onResizeStart(source?: string): void;
  onResize(delta: number, source?: string): void;
  /** `cancelled` is truthy when the gesture was interrupted. */
  onResizeEnd(moved: boolean, source?: string, cancelled?: unknown): void;
}
export interface SlideRailLayoutOptions {
  /** The editor canvas next to the rail. */
  canvas?: LayoutRef<Element>;
  /** The preferred thumbnail width. */
  thumbW?: number;
  onThumbW?: (width: number) => void;
  /** Receives a function that measures the current space. */
  geometry?: LayoutRef<() => RailMeasure | null>;
  /** Height of the speaker notes pane. */
  paneH?: number;
}
export interface SlideRailLayout {
  thumbW: number;
  maxW: number;
  gesture: RailResizeGesture;
  setThumbW: (width: number) => void;
  takeAutoHold: (width: number) => RailAnchorHold | null;
  forgetAutoHold: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSlideRailLayout: ReactNamespace;
    MIN_RAIL_THUMB_WIDTH: number;
    MIN_STAGE_HEIGHT_AFTER_RAIL: number;
    MAX_RAIL_HEIGHT_FRACTION: number;
    RAIL_RESIZE_VIEWPORT_MINIMUM: { w: number; h: number };
    RAIL_THUMB_WIDTH_CSS_VARIABLE: string;
    SLIDE_THUMB_ASPECT_RATIO: number;
    RAIL_THUMB_WIDTH_STORAGE_KEY: string;
    RAIL_THUMB_RESIZE_SETTLE_MS: number;
    calculateMaxRailThumbWidth: (
      availableHeight: number,
      chromeHeight: number,
      maxWidth?: number,
    ) => number;
    canResizeSlideRail: (width: number, height: number) => boolean;
    clampRailThumbWidth: (width: number, maxWidth: number) => number;
    calculateRailHeight: (
      layout: RailMeasure,
      stageHeightDelta: number,
    ) => number;
    clampStageRailResizeDelta: (
      delta: number,
      layout: RailMeasure | null,
      minimum: number,
      maximum: number,
    ) => number;
    resizeRailThumbWidth: (
      preferredWidth: number,
      heightDelta: number,
      maxWidth: number,
    ) => number;
    readRailThumbWidthPreference: () => number;
    writeRailThumbWidthPreference: (width: number) => void;
    captureRailScrollAnchor: (layout: RailAnchorLayout) => RailScrollAnchor;
    calculateAnchoredRailScroll: (
      anchor: RailScrollAnchor,
      width: number,
      centerPartial?: boolean,
    ) => number;
    useSlideRailLayout: (
      enabled: LayoutRef<HTMLElement>,
      options: SlideRailLayoutOptions | undefined,
      layoutChanged: LayoutRef<HTMLElement>,
      anchor: () => Element | null | undefined,
    ) => SlideRailLayout;
  }
}

export function installEditorSlideRailLayout(
  runtime: RuntimeBindings,
): () => void {
  var ReactSlideRailLayout: ReactNamespace;
  var MIN_RAIL_THUMB_WIDTH: RuntimeBindings["MIN_RAIL_THUMB_WIDTH"];
  var MIN_STAGE_HEIGHT_AFTER_RAIL: RuntimeBindings["MIN_STAGE_HEIGHT_AFTER_RAIL"];
  var MAX_RAIL_HEIGHT_FRACTION: RuntimeBindings["MAX_RAIL_HEIGHT_FRACTION"];
  var RAIL_RESIZE_VIEWPORT_MINIMUM: RuntimeBindings["RAIL_RESIZE_VIEWPORT_MINIMUM"];
  var RAIL_THUMB_WIDTH_CSS_VARIABLE: RuntimeBindings["RAIL_THUMB_WIDTH_CSS_VARIABLE"];
  var SLIDE_THUMB_ASPECT_RATIO: RuntimeBindings["SLIDE_THUMB_ASPECT_RATIO"];
  var RAIL_THUMB_WIDTH_STORAGE_KEY: RuntimeBindings["RAIL_THUMB_WIDTH_STORAGE_KEY"];
  var RAIL_THUMB_RESIZE_SETTLE_MS: RuntimeBindings["RAIL_THUMB_RESIZE_SETTLE_MS"];
  function calculateMaxRailThumbWidth(
    availableHeight: number,
    chromeHeight: number,
    maxWidth: number = 1 / 0,
  ): number {
    let maxRailHeight = Math.min(
      availableHeight * MAX_RAIL_HEIGHT_FRACTION,
      availableHeight - MIN_STAGE_HEIGHT_AFTER_RAIL,
    );
    return Math.max(
      MIN_RAIL_THUMB_WIDTH,
      Math.floor(
        Math.min(
          (maxRailHeight - chromeHeight) * SLIDE_THUMB_ASPECT_RATIO,
          maxWidth,
        ),
      ),
    );
  }
  function canResizeSlideRail(width: number, height: number): boolean {
    return (
      width >= RAIL_RESIZE_VIEWPORT_MINIMUM.w &&
      height >= RAIL_RESIZE_VIEWPORT_MINIMUM.h
    );
  }
  function clampRailThumbWidth(width: number, maxWidth: number): number {
    return Math.max(
      MIN_RAIL_THUMB_WIDTH,
      Math.min(maxWidth, Math.round(width)),
    );
  }
  function calculateRailHeight(
    layout: RailMeasure,
    stageHeightDelta: number,
  ): number {
    return (
      layout.chrome +
      clampRailThumbWidth(
        layout.pref,
        calculateMaxRailThumbWidth(
          layout.room - stageHeightDelta,
          layout.chrome,
          layout.fitW,
        ),
      ) /
        SLIDE_THUMB_ASPECT_RATIO
    );
  }
  function clampStageRailResizeDelta(
    delta: number,
    layout: RailMeasure | null,
    minimum: number,
    maximum: number,
  ): number {
    if (
      !Number.isFinite(delta + minimum + maximum) ||
      (layout !== null &&
        !Number.isFinite(layout.room + layout.chrome + layout.pref))
    ) {
      if (Number.isFinite(minimum + maximum)) {
        return Math.max(minimum, Math.min(maximum, 0));
      } else {
        return 0;
      }
    }
    if (maximum <= minimum) {
      return minimum;
    }
    if (!layout) {
      return Math.max(minimum, Math.min(maximum, delta));
    }
    let value = calculateRailHeight(layout, 0),
      callback = (input: number): number =>
        input + calculateRailHeight(layout, input) - value;
    if (callback(minimum) >= delta) {
      return minimum;
    }
    if (callback(maximum) < delta) {
      return maximum;
    }
    let [items, items2] = [minimum, maximum];
    for (let index = 0; index < 24; index++) {
      let value2 = (items + items2) / 2;
      if (callback(value2) >= delta) {
        items2 = value2;
      } else {
        items = value2;
      }
    }
    return items2;
  }
  function resizeRailThumbWidth(
    preferredWidth: number,
    heightDelta: number,
    maxWidth: number,
  ): number {
    return clampRailThumbWidth(
      preferredWidth - heightDelta * SLIDE_THUMB_ASPECT_RATIO,
      maxWidth,
    );
  }
  function readRailThumbWidthPreference(): number {
    try {
      let value: unknown = JSON.parse(
        localStorage.getItem(RAIL_THUMB_WIDTH_STORAGE_KEY) ?? "null",
      );
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(MIN_RAIL_THUMB_WIDTH, Math.round(value));
      }
    } catch {}
    return MIN_RAIL_THUMB_WIDTH;
  }
  function writeRailThumbWidthPreference(width: number): void {
    try {
      localStorage.setItem(RAIL_THUMB_WIDTH_STORAGE_KEY, JSON.stringify(width));
    } catch {}
  }
  function captureRailScrollAnchor(layout: RailAnchorLayout): RailScrollAnchor {
    let anchorVisible =
        layout.anchor !== undefined &&
        layout.anchor.left + layout.anchor.width > 0 &&
        layout.anchor.left < layout.view,
      anchorWhole =
        anchorVisible &&
        layout.anchor !== undefined &&
        layout.anchor.left >= 0 &&
        layout.anchor.left + layout.anchor.width <= layout.view,
      anchorLeft =
        anchorVisible && layout.anchor
          ? layout.anchor.left + layout.anchor.width / 2
          : layout.view / 2,
      callback = (input: number): number =>
        layout.pitch > 0
          ? (layout.scrollLeft + input - layout.pad) / layout.pitch
          : 0;
    return {
      at: anchorLeft,
      t: callback(anchorLeft),
      pad: layout.pad,
      gap: layout.pitch - layout.w,
      view: layout.view,
      held: anchorVisible,
      whole: anchorWhole,
      mid: callback(layout.view / 2),
    };
  }
  function calculateAnchoredRailScroll(
    anchor: RailScrollAnchor,
    width: number,
    centerPartial: boolean = false,
  ): number {
    let cellSpan = width + anchor.gap;
    if (centerPartial && !anchor.whole) {
      return anchor.pad + anchor.mid * cellSpan - anchor.view / 2;
    }
    let value = anchor.pad + anchor.t * cellSpan - anchor.at;
    if (!anchor.held) {
      return value;
    }
    let value2 = anchor.pad + Math.floor(anchor.t) * cellSpan;
    return Math.min(
      Math.max(value, value2 + cellSpan + anchor.pad - anchor.view),
      value2 - anchor.pad,
    );
  }
  function useSlideRailLayout(
    enabled: LayoutRef<HTMLElement>,
    options: SlideRailLayoutOptions | undefined,
    layoutChanged: LayoutRef<HTMLElement>,
    anchor: () => Element | null | undefined,
  ): SlideRailLayout {
    let value = options?.canvas,
      value2 = options?.thumbW ?? MIN_RAIL_THUMB_WIDTH,
      [value3, value4] = ReactSlideRailLayout.useState(MIN_RAIL_THUMB_WIDTH),
      value5 = clampRailThumbWidth(value2, value3),
      ref = ReactSlideRailLayout.useRef(value5),
      ref2 = ReactSlideRailLayout.useRef(value3),
      ref3 = ReactSlideRailLayout.useRef(false),
      ref4 = ReactSlideRailLayout.useRef({
        anchor: anchor,
        pref: value2,
        maxW: value3,
        onThumbW: options?.onThumbW,
      });
    ReactSlideRailLayout.useLayoutEffect((): void => {
      if (!ref3.current) {
        ref.current = value5;
      }
      ref4.current = {
        anchor: anchor,
        pref: value2,
        maxW: value3,
        onThumbW: options?.onThumbW,
      };
    });
    let callback = ReactSlideRailLayout.useCallback((): RailScrollAnchor => {
        let current = layoutChanged.current,
          value8 = current?.firstElementChild;
        if (!current || !value8) {
          return captureRailScrollAnchor({
            scrollLeft: 0,
            view: 0,
            pad: 0,
            pitch: 0,
            w: ref.current,
          });
        }
        let bounds = current.getBoundingClientRect(),
          bounds2 = value8.getBoundingClientRect(),
          value9 = ref4.current.anchor()?.getBoundingClientRect();
        return captureRailScrollAnchor({
          scrollLeft: current.scrollLeft,
          view: bounds.width,
          pad: bounds2.left - bounds.left + current.scrollLeft,
          pitch: bounds2.width,
          w: ref.current,
          anchor: value9 && {
            left: value9.left - bounds.left,
            width: value9.width,
          },
        });
      }, [layoutChanged]),
      ref5 = ReactSlideRailLayout.useRef<{
        hold: RailAnchorHold;
        to: number;
      } | null>(null),
      ref6 = ReactSlideRailLayout.useRef(false),
      ref7 = ReactSlideRailLayout.useRef<RailAnchorHold | null>(null),
      callback2 = ReactSlideRailLayout.useCallback((): void => {
        ref7.current = null;
      }, []),
      callback3 = ReactSlideRailLayout.useCallback(
        (input: number): RailAnchorHold | null => {
          let current = ref5.current;
          if (!current || current.to !== input) {
            return null;
          }
          ref5.current = null;
          if (current.hold.onMount) {
            ref7.current = null;
          }
          return current.hold;
        },
        [],
      ),
      ref8 = ReactSlideRailLayout.useRef<ReturnType<typeof setTimeout> | 0>(0);
    ReactSlideRailLayout.useLayoutEffect(
      (): (() => void) => (): void => clearTimeout(ref8.current),
      [],
    );
    let callback4 = ReactSlideRailLayout.useCallback((): RailMeasure | null => {
        let current = enabled.current,
          value8 = value?.current;
        if (!current || !value8) {
          return null;
        }
        let height = current.getBoundingClientRect().height;
        if (height === 0) {
          return null;
        }
        let current2 = layoutChanged.current,
          value9 = current2?.firstElementChild,
          value10 = 1 / 0;
        if (current2 && value9 && current2.clientWidth > 0) {
          let value11 =
            value9.getBoundingClientRect().left -
            current2.getBoundingClientRect().left +
            current2.scrollLeft;
          value10 =
            current2.clientWidth -
            2 * value11 -
            (value9.getBoundingClientRect().width - ref.current);
        }
        return {
          room: Math.round(height + value8.getBoundingClientRect().height),
          chrome: height - ref.current / SLIDE_THUMB_ASPECT_RATIO,
          fitW: value10,
          pref: ref4.current.pref,
        };
      }, [enabled, value, layoutChanged]),
      value6 = options?.geometry;
    ReactSlideRailLayout.useLayoutEffect((): (() => void) | undefined => {
      if (!value6) {
        return;
      }
      value6.current = callback4;
      return (): void => {
        value6.current = null;
      };
    }, [value6, callback4]);
    let callback5 = ReactSlideRailLayout.useCallback(
        (input: boolean = false): void => {
          let value8 = ref3.current ? null : callback4();
          if (!value8) {
            return;
          }
          let value9 = calculateMaxRailThumbWidth(
            value8.room,
            value8.chrome,
            value8.fitW,
          );
          ref2.current = value9;
          clearTimeout(ref8.current);
          let current = ref4.current,
            value10 =
              clampRailThumbWidth(current.pref, value9) !==
              clampRailThumbWidth(current.pref, current.maxW);
          if (value10) {
            let value11 = callback(),
              value12 = layoutChanged.current?.childElementCount ?? 0,
              value13 = ref4.current.anchor(),
              current2 = ref7.current,
              value14: RailAnchorHold =
                current2 === null ||
                Math.abs(current2.view - value11.view) > 0.5 ||
                current2.count !== value12 ||
                current2.anchor !== value13
                  ? {
                      ...value11,
                      onMount: !ref6.current,
                      count: value12,
                      anchor: value13,
                    }
                  : current2;
            ref7.current = value14;
            ref5.current = {
              hold: value14,
              to: clampRailThumbWidth(current.pref, value9),
            };
          }
          ref6.current = true;
          if (
            input ||
            value10 ||
            value9 <= MIN_RAIL_THUMB_WIDTH !==
              current.maxW <= MIN_RAIL_THUMB_WIDTH
          ) {
            value4(value9);
          } else if (value9 !== current.maxW) {
            ref8.current = setTimeout(
              (): void => value4(value9),
              RAIL_THUMB_RESIZE_SETTLE_MS,
            );
          }
        },
        [callback4, callback, layoutChanged],
      ),
      value7 = options?.paneH ?? 0;
    ReactSlideRailLayout.useLayoutEffect((): void => {
      callback5();
    }, [value7, callback5]);
    ReactSlideRailLayout.useLayoutEffect((): (() => void) | undefined => {
      let current = enabled.current,
        value8 = value?.current;
      if (!current || !value8 || typeof ResizeObserver === "undefined") {
        return;
      }
      callback5(true);
      let observer = new ResizeObserver((): void => callback5());
      observer.observe(current);
      observer.observe(value8);
      return (): void => observer.disconnect();
    }, [enabled, value, callback5]);
    let ref9 = ReactSlideRailLayout.useRef<RailGestureStart>({
        w: MIN_RAIL_THUMB_WIDTH,
        max: MIN_RAIL_THUMB_WIDTH,
        at: 0,
        t: 0,
        pad: 0,
        gap: 0,
        view: 0,
        held: false,
        whole: false,
        mid: 0,
      }),
      ref10 = ReactSlideRailLayout.useRef<Element | null>(null),
      callback6 = ReactSlideRailLayout.useCallback(
        (input: number): void => {
          ref.current = input;
          enabled.current?.style.setProperty(
            RAIL_THUMB_WIDTH_CSS_VARIABLE,
            String(input),
          );
          ref10.current?.setAttribute("aria-valuenow", String(input));
          if (layoutChanged.current) {
            layoutChanged.current.scrollLeft = calculateAnchoredRailScroll(
              ref9.current,
              input,
            );
          }
        },
        [enabled, layoutChanged],
      ),
      callback7 = ReactSlideRailLayout.useCallback((): void => {
        ref7.current = null;
        callback5(true);
        ref3.current = true;
        ref9.current = {
          ...callback(),
          w: ref.current,
          max: ref2.current,
        };
        ref10.current =
          Array.from<Element>(enabled.current?.children ?? []).find(
            (element: Element): boolean =>
              element.getAttribute("role") === "separator",
          ) ?? null;
      }, [callback5, callback, enabled]),
      callback8 = ReactSlideRailLayout.useCallback(
        (input?: unknown): void => {
          ref3.current = false;
          ref5.current = null;
          if (input) {
            callback6(ref9.current.w);
          } else if (ref.current !== ref9.current.w) {
            ref4.current.onThumbW?.(ref.current);
            writeRailThumbWidthPreference(ref.current);
          }
          callback5();
          let value8 = clampRailThumbWidth(ref.current, ref2.current);
          if (!input && value8 !== ref.current) {
            callback6(value8);
            value4(ref2.current);
          }
        },
        [callback6, callback5],
      ),
      memo = ReactSlideRailLayout.useMemo(
        (): RailResizeGesture => ({
          onResizeStart: callback7,
          onResize: (input: number): void =>
            callback6(
              resizeRailThumbWidth(ref9.current.w, input, ref9.current.max),
            ),
          onResizeEnd: (
            input: boolean,
            options2?: string,
            context?: unknown,
          ): void => callback8(context),
        }),
        [callback7, callback6, callback8],
      ),
      callback9 = ReactSlideRailLayout.useCallback(
        (input: number): void => {
          callback7();
          callback6(clampRailThumbWidth(input, ref9.current.max));
          callback8();
        },
        [callback7, callback6, callback8],
      );
    return {
      thumbW: value5,
      maxW: value3,
      gesture: memo,
      setThumbW: callback9,
      takeAutoHold: callback3,
      forgetAutoHold: callback2,
    };
  }
  bindRuntimeValue(
    runtime,
    "ReactSlideRailLayout",
    () => ReactSlideRailLayout,
    (value) => {
      ReactSlideRailLayout = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_RAIL_THUMB_WIDTH",
    () => MIN_RAIL_THUMB_WIDTH,
    (value) => {
      MIN_RAIL_THUMB_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_STAGE_HEIGHT_AFTER_RAIL",
    () => MIN_STAGE_HEIGHT_AFTER_RAIL,
    (value) => {
      MIN_STAGE_HEIGHT_AFTER_RAIL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_RAIL_HEIGHT_FRACTION",
    () => MAX_RAIL_HEIGHT_FRACTION,
    (value) => {
      MAX_RAIL_HEIGHT_FRACTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_RESIZE_VIEWPORT_MINIMUM",
    () => RAIL_RESIZE_VIEWPORT_MINIMUM,
    (value) => {
      RAIL_RESIZE_VIEWPORT_MINIMUM = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_THUMB_WIDTH_CSS_VARIABLE",
    () => RAIL_THUMB_WIDTH_CSS_VARIABLE,
    (value) => {
      RAIL_THUMB_WIDTH_CSS_VARIABLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_THUMB_ASPECT_RATIO",
    () => SLIDE_THUMB_ASPECT_RATIO,
    (value) => {
      SLIDE_THUMB_ASPECT_RATIO = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RAIL_THUMB_WIDTH_STORAGE_KEY",
    () => RAIL_THUMB_WIDTH_STORAGE_KEY,
    (value) => {
      RAIL_THUMB_WIDTH_STORAGE_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calculateMaxRailThumbWidth",
    () => calculateMaxRailThumbWidth,
  );
  bindRuntimeValue(runtime, "canResizeSlideRail", () => canResizeSlideRail);
  bindRuntimeValue(runtime, "clampRailThumbWidth", () => clampRailThumbWidth);
  bindRuntimeValue(runtime, "calculateRailHeight", () => calculateRailHeight);
  bindRuntimeValue(
    runtime,
    "clampStageRailResizeDelta",
    () => clampStageRailResizeDelta,
  );
  bindRuntimeValue(runtime, "resizeRailThumbWidth", () => resizeRailThumbWidth);
  bindRuntimeValue(
    runtime,
    "readRailThumbWidthPreference",
    () => readRailThumbWidthPreference,
  );
  bindRuntimeValue(
    runtime,
    "writeRailThumbWidthPreference",
    () => writeRailThumbWidthPreference,
  );
  bindRuntimeValue(
    runtime,
    "captureRailScrollAnchor",
    () => captureRailScrollAnchor,
  );
  bindRuntimeValue(
    runtime,
    "calculateAnchoredRailScroll",
    () => calculateAnchoredRailScroll,
  );
  bindRuntimeValue(
    runtime,
    "RAIL_THUMB_RESIZE_SETTLE_MS",
    () => RAIL_THUMB_RESIZE_SETTLE_MS,
    (value) => {
      RAIL_THUMB_RESIZE_SETTLE_MS = value;
    },
  );
  bindRuntimeValue(runtime, "useSlideRailLayout", () => useSlideRailLayout);
  return () => {
    (0, runtime.initializeSlideModel)();
    ReactSlideRailLayout = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    MIN_RAIL_THUMB_WIDTH = 124;
    MIN_STAGE_HEIGHT_AFTER_RAIL = 200;
    MAX_RAIL_HEIGHT_FRACTION = 0.4;
    RAIL_RESIZE_VIEWPORT_MINIMUM = {
      w: 640,
      h: 460,
    };
    RAIL_THUMB_WIDTH_CSS_VARIABLE = "--sl-thumb-w";
    try {
      if (typeof CSS !== "undefined" && "registerProperty" in CSS) {
        CSS.registerProperty({
          name: RAIL_THUMB_WIDTH_CSS_VARIABLE,
          syntax: "<number>",
          inherits: false,
          initialValue: String(MIN_RAIL_THUMB_WIDTH),
        });
      }
    } catch {}
    SLIDE_THUMB_ASPECT_RATIO = runtime.SLIDE_WIDTH / runtime.SLIDE_HEIGHT;
    RAIL_THUMB_WIDTH_STORAGE_KEY = "mc-slides/strip-thumb-w";
    RAIL_THUMB_RESIZE_SETTLE_MS = 200;
  };
}

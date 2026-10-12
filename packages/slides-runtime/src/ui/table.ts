/** Restored application module; prepare first, initialize in original order. */
import type { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import type {
  FocusEvent as ReactFocusEvent,
  FocusEventHandler,
  ForwardRefExoticComponent,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  RefAttributes,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { TooltipSide } from "./avatars";
import type { SegmentBounds } from "./dialog-2";
import type {
  DataAttributeProps,
  SelectionFrame,
  SelectionHandle,
  SelectionMetrics,
  SelectionState,
  SelectionVariant,
  SelectionHandleSet,
} from "./editor-selection";
import type { CdsControlSize } from "./overlays";

/** One choice of a `SegmentedControl`. */
export interface SegmentedControlSegment {
  value: string;
  label?: ReactNode;
  /** Icon name shown instead of a label. */
  icon?: string;
  tooltip?: ReactNode;
  tooltipDetail?: ReactNode;
  tooltipHoverable?: boolean;
  /** Shortcut in `Shortcut` key syntax, shown in the tooltip and exposed as `aria-keyshortcuts`. */
  shortcut?: string;
  /** Badge drawn over the icon corner. */
  indicator?: ReactNode;
  disabled?: boolean;
  disabledReason?: ReactNode;
}
export type SegmentedControlVariant = "contained" | "ghost";
/** An externally driven thumb position: a fraction of the way between segments, or `null` when idle. */
export interface SegmentThumbPosition {
  get: () => number | null;
  on: (event: "change", callback: (position: number | null) => void) => () => void;
}
/** Props of `SegmentedControl`. */
export interface SegmentedControlProps {
  segments: SegmentedControlSegment[];
  value?: string;
  onChange: (value: string) => void;
  variant?: SegmentedControlVariant;
  size?: CdsControlSize;
  fullWidth?: boolean;
  disabled?: boolean;
  tooltipSide?: TooltipSide;
  tooltipClassName?: string;
  "aria-label"?: string;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  thumbPosition?: SegmentThumbPosition;
  className?: string;
}
/** Re-measures a segmented control; measurements that must wait for the next frame are pushed to `pending`. */
export type SegmentMeasure = (settled: boolean, pending: Array<() => void>) => void;
/** The resize observer shared by every segmented control of one window. */
export interface SegmentResizeObserverEntry {
  Observer: typeof ResizeObserver;
  observer: ResizeObserver;
  measures: Map<Element, SegmentMeasure>;
}
/** Rendered width of an element and whether a CSS transform scaled it. */
export interface ScaledElementWidth {
  width: number;
  scaled: boolean;
}
/** Polling state used to wait until a scaled segmented control stops resizing. */
interface SegmentIndicatorPoll {
  cancel: () => void;
  width: number;
  still: number;
  frames: number;
}
interface SegmentIndicatorState {
  live: boolean;
  poll: SegmentIndicatorPoll | null;
}
/** Pixel sizes of selection points on top of the shared selection metrics. */
export interface SelectionPointMetrics extends SelectionMetrics {
  point: number;
  pointStroke: number;
  gripHit: number;
  gripHitTouch: number;
  edgeHit: number;
  rotateReach: number;
}
/** A point in slide coordinates. */
export interface SelectionPointPosition {
  x: number;
  y: number;
}
/** Props of `SelectionPoints`. */
export interface SelectionPointsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children">,
    DataAttributeProps {
  points: SelectionPointPosition[];
  scale?: number;
  /** A polyline drawn through these points. */
  shaft?: SelectionPointPosition[];
  shape?: "round" | "square";
  onPointDragStart?: (index: number, event: ReactPointerEvent<HTMLDivElement>) => void;
  cursor?: string;
}
/** Corner of a selection that shows a rotate cursor. */
export type GrabCursorCorner = "nw" | "ne" | "se" | "sw";
/** Content of the tooltip shown over a selection handle. */
export interface SelectionHandleTooltip {
  content?: ReactNode;
  /** The content explains why the handle is disabled. */
  reason?: boolean;
  followPointer?: boolean;
}
/** Props of `SelectionRing`. */
export interface SelectionRingProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children">,
    DataAttributeProps {
  frame: SelectionFrame;
  scale?: number;
  /** Rotation in radians. */
  rotation?: number;
  state?: SelectionState;
  variant?: SelectionVariant;
  grips?: SelectionHandleSet;
  angleLabel?: ReactNode;
  /** Palette slot of the collaborator that owns this selection. */
  collaborator?: number;
  onResizeStart?: (grip: SelectionHandle, event: ReactPointerEvent<HTMLDivElement>) => void;
  edgeStrips?: boolean;
  onGripDoubleClick?: (grip: SelectionHandle) => void;
  onRotateStart?: (corner: GrabCursorCorner, event: ReactPointerEvent<HTMLDivElement>) => void;
  resizeDisabledReason?: ReactNode;
  rotateDisabledReason?: ReactNode;
  gripLabel?: ReactNode;
}
/** Where a currency symbol sits relative to the number. */
export type CurrencySymbolSide = "start" | "end";
export interface CurrencyDisplayParts {
  symbol: string;
  side: CurrencySymbolSide;
}
/** Props of `NumberInput`. */
export interface NumberInputProps
  extends Omit<BaseNumberField.Root.Props, "className" | "ref" | "render" | "onBlur"> {
  className?: string;
  size?: CdsControlSize;
  fullWidth?: boolean;
  /** ISO currency code that renders a symbol slot next to the input. */
  currency?: string;
  slotStart?: ReactNode;
  slotEnd?: ReactNode;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactd4: ReactNamespace;
    jsxy1: JsxNamespace;
    observeSegmentedControlSize: (
      element: HTMLElement,
      ResizeObserverConstructor: typeof ResizeObserver,
      measure: SegmentMeasure,
    ) => () => void;
    SegmentedControl: (props: SegmentedControlProps) => ReactElement;
    getRelativeSegmentBounds: (segment: HTMLElement, control: HTMLElement) => SegmentBounds;
    measureScaledElementWidth: (element: HTMLElement) => ScaledElementWidth;
    scheduleElementAnimationFrame: (
      element: Element | undefined,
      callback: FrameRequestCallback,
    ) => (() => void) | null;
    getUnscaledBorderBoxWidth: (element: Element) => number;
    segmentedControlSegmentClasses: string;
    segmentedControlTextPaddingClasses: string;
    segmentedControlIconAspectClasses: string;
    segmentedControlVisualLayerClasses: string;
    segmentedControlFlexibleItemClasses: string;
    segmentedControlFullWidthItemClasses: string;
    segmentedControlTextClasses: string;
    ghostSegmentHoverClasses: string;
    segmentedControlThumbClasses: string;
    containedSegmentThumbClasses: string;
    ghostSegmentThumbClasses: string;
    SEGMENT_INDICATOR_SETTLE_MS: number;
    SEGMENT_INDICATOR_SETTLE_FRAMES: number;
    SEGMENT_TOOLTIP_DELAY_MS: number;
    segmentedControlResizeObservers: WeakMap<Window, SegmentResizeObserverEntry>;
    initializeUiTable: () => void;
    selectionGripHitSize: (frame: SelectionFrame, scale: number, touch: boolean) => number;
    SELECTION_POINT_METRICS: SelectionPointMetrics;
    initializeUiTable2: () => void;
    SelectionPointGrip: () => ReactElement;
    SelectionPoints: ForwardRefExoticComponent<
      SelectionPointsProps & RefAttributes<HTMLDivElement>
    >;
    initializeUiTable3: () => void;
    rotatedResizeCursor: (point: SelectionHandle, rotation?: number) => string;
    rotatedGrabCursor: (corner: GrabCursorCorner, rotation?: number) => string;
    GRAB_CURSOR_CORNERS: GrabCursorCorner[];
    RESIZE_CURSOR_CYCLE: string[];
    GRAB_CURSOR_ANGLES: Record<GrabCursorCorner, number>;
    GRAB_CURSOR_MIME: string;
    GRAB_CURSOR_SVG_PREFIX: string;
    GRAB_CURSOR_SVG_PATH: string;
    GRAB_CURSOR_SVG_SUFFIX: string;
    initializeUiTable4: () => void;
    stopSelectionRingEvent: (event: Pick<Event, "preventDefault" | "stopPropagation">) => void;
    SelectionHandleWithTooltip: (
      index: string,
      tooltip: SelectionHandleTooltip,
      element: ReactElement,
    ) => ReactElement;
    pointInsideSelectionGripHitArea: (
      event: ReactMouseEvent<Element>,
      point: number,
      scale: number,
      touch: number,
    ) => boolean;
    selectionHandleKey: (point: SelectionHandle) => string;
    SelectionRing: ForwardRefExoticComponent<
      SelectionRingProps & RefAttributes<HTMLDivElement>
    >;
    initializeUiTable5: () => void;
    currencyDisplayParts: (currency: string, locale: Intl.LocalesArgument) => CurrencyDisplayParts;
    DISAMBIGUATED_CURRENCY_CODES: Set<string>;
    CURRENCY_NUMBER_PART_TYPES: Set<string>;
    initializeUiTable6: () => void;
    useClientHydrated: () => boolean;
    hydrationNoop: () => void;
    subscribeHydration: (onStoreChange: () => void) => () => void;
    NumberInput: ForwardRefExoticComponent<NumberInputProps & RefAttributes<HTMLInputElement>>;
    initializeUiTable7: () => void;
    reactForUiTable: ReactNamespace;
    jsxForUiTable: JsxNamespace;
    reactForUiTable2: ReactNamespace;
    jsxForUiTable2: JsxNamespace;
    reactForUiTable3: ReactNamespace;
    jsxForUiTable3: JsxNamespace;
  }
}

export function installUiTable(runtime: RuntimeBindings): () => void {
  var reactd4: ReactNamespace;
  var jsxy1: JsxNamespace;
  var segmentedControlSegmentClasses: RuntimeBindings["segmentedControlSegmentClasses"];
  var segmentedControlTextPaddingClasses: RuntimeBindings["segmentedControlTextPaddingClasses"];
  var segmentedControlIconAspectClasses: RuntimeBindings["segmentedControlIconAspectClasses"];
  var segmentedControlVisualLayerClasses: RuntimeBindings["segmentedControlVisualLayerClasses"];
  var segmentedControlFlexibleItemClasses: RuntimeBindings["segmentedControlFlexibleItemClasses"];
  var segmentedControlFullWidthItemClasses: RuntimeBindings["segmentedControlFullWidthItemClasses"];
  var segmentedControlTextClasses: RuntimeBindings["segmentedControlTextClasses"];
  var ghostSegmentHoverClasses: RuntimeBindings["ghostSegmentHoverClasses"];
  var segmentedControlThumbClasses: RuntimeBindings["segmentedControlThumbClasses"];
  var containedSegmentThumbClasses: RuntimeBindings["containedSegmentThumbClasses"];
  var ghostSegmentThumbClasses: RuntimeBindings["ghostSegmentThumbClasses"];
  var SEGMENT_INDICATOR_SETTLE_MS: RuntimeBindings["SEGMENT_INDICATOR_SETTLE_MS"];
  var SEGMENT_INDICATOR_SETTLE_FRAMES: RuntimeBindings["SEGMENT_INDICATOR_SETTLE_FRAMES"];
  var SEGMENT_TOOLTIP_DELAY_MS: RuntimeBindings["SEGMENT_TOOLTIP_DELAY_MS"];
  var segmentedControlResizeObservers: RuntimeBindings["segmentedControlResizeObservers"];
  var initializeUiTable: RuntimeBindings["initializeUiTable"];
  var SELECTION_POINT_METRICS: RuntimeBindings["SELECTION_POINT_METRICS"];
  var initializeUiTable2: RuntimeBindings["initializeUiTable2"];
  var reactForUiTable: ReactNamespace;
  var jsxForUiTable: JsxNamespace;
  var SelectionPoints: RuntimeBindings["SelectionPoints"];
  var initializeUiTable3: RuntimeBindings["initializeUiTable3"];
  var GRAB_CURSOR_CORNERS: RuntimeBindings["GRAB_CURSOR_CORNERS"];
  var RESIZE_CURSOR_CYCLE: RuntimeBindings["RESIZE_CURSOR_CYCLE"];
  var GRAB_CURSOR_ANGLES: RuntimeBindings["GRAB_CURSOR_ANGLES"];
  var GRAB_CURSOR_MIME: RuntimeBindings["GRAB_CURSOR_MIME"];
  var GRAB_CURSOR_SVG_PREFIX: RuntimeBindings["GRAB_CURSOR_SVG_PREFIX"];
  var GRAB_CURSOR_SVG_PATH: RuntimeBindings["GRAB_CURSOR_SVG_PATH"];
  var GRAB_CURSOR_SVG_SUFFIX: RuntimeBindings["GRAB_CURSOR_SVG_SUFFIX"];
  var initializeUiTable4: RuntimeBindings["initializeUiTable4"];
  var reactForUiTable2: ReactNamespace;
  var jsxForUiTable2: JsxNamespace;
  var SelectionRing: RuntimeBindings["SelectionRing"];
  var initializeUiTable5: RuntimeBindings["initializeUiTable5"];
  var DISAMBIGUATED_CURRENCY_CODES: RuntimeBindings["DISAMBIGUATED_CURRENCY_CODES"];
  var CURRENCY_NUMBER_PART_TYPES: RuntimeBindings["CURRENCY_NUMBER_PART_TYPES"];
  var initializeUiTable6: RuntimeBindings["initializeUiTable6"];
  var reactForUiTable3: ReactNamespace;
  var jsxForUiTable3: JsxNamespace;
  var hydrationNoop: RuntimeBindings["hydrationNoop"];
  var subscribeHydration: RuntimeBindings["subscribeHydration"];
  var NumberInput: RuntimeBindings["NumberInput"];
  var initializeUiTable7: RuntimeBindings["initializeUiTable7"];
  function observeSegmentedControlSize(
    input: HTMLElement,
    options: typeof ResizeObserver,
    context: SegmentMeasure,
  ): () => void {
    let value = (0, runtime.getElementWindow)(input) ?? window,
      entry = segmentedControlResizeObservers.get(value);
    if (entry?.Observer !== options) {
      let entries = new Map<Element, SegmentMeasure>();
      entry = {
        Observer: options,
        observer: new options((input2: ResizeObserverEntry[]) => {
          let items: Array<() => void> = [];
          for (let value4 of input2) {
            let entry2 = entries.get(value4.target);
            if (entry2) {
              (0, runtime.invokeAndReportError)(
                () => entry2(false, items),
              );
            }
          }
          for (let value4 of items)
            (0, runtime.invokeAndReportError)(value4);
        }),
        measures: entries,
      };
      segmentedControlResizeObservers.set(value, entry);
    }
    let { observer: value2, measures: value3 } = entry;
    value3.set(input, context);
    value2.observe(input);
    return () => {
      value2.unobserve(input);
      value3.delete(input);
    };
  }
  function SegmentedControl({
    segments: segments,
    value: value,
    onChange: onChange,
    variant = "contained",
    size: size,
    fullWidth = false,
    disabled: disabled,
    tooltipSide: tooltipSide,
    tooltipClassName: tooltipClassName,
    "aria-label": ariaLabel,
    "aria-required": ariaRequired,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedby,
    thumbPosition: thumbPosition,
    className: className,
  }: SegmentedControlProps): ReactElement {
    let ref = reactd4.useRef<HTMLDivElement>(null);
    (0, runtime.useCompactableControlDebug)(ref, "SegmentedControl");
    let ref2 = reactd4.useRef<HTMLDivElement>(null),
      value2 = (0, runtime.useHasFieldContext)(),
      value3 = (0, runtime.useAppleKeyboard)(),
      ref3 = reactd4.useRef<SegmentIndicatorState>({
        live: false,
        poll: null,
      }),
      callback = reactd4.useCallback(function value8(
        input = false,
        options?: Array<() => void>,
      ): void {
        let current = ref.current,
          current2 = ref2.current;
        if (!current || !current2) {
          return;
        }
        let element = current.querySelector<HTMLElement>("[data-checked]"),
          value9 = element ? measureScaledElementWidth(current) : null,
          value10: (() => void) | null = null;
        if (
          !input ||
          !(value9?.scaled || (0, runtime.isImmediateFlipMarker)(current2))
        ) {
          let value11 = element
            ? getRelativeSegmentBounds(element, current)
            : null;
          value10 = (0, runtime.animateSegmentedControlThumb)(
            current2,
            current,
            value11,
            {
              correction: input,
            },
          );
        }
        let callback3 = () => {
          value10?.();
          if (!ref3.current.live) {
            return;
          }
          let poll = ref3.current.poll;
          poll?.cancel();
          ref3.current.poll = null;
          if (!value9 || (!input && !poll && !value9.scaled)) {
            return;
          }
          let {
            width: value11,
            still: value12,
            frames: value13,
          } = poll ?? {
            width: value9.width,
            still: 0,
            frames: 0,
          };
          if (input) {
            value12 = value11 === value9.width ? value12 + 1 : 0;
            value11 = value9.width;
            value13 += 1;
            if (
              value12 >=
                (value9.scaled
                  ? SEGMENT_INDICATOR_SETTLE_MS
                  : SEGMENT_INDICATOR_SETTLE_FRAMES) ||
              value13 >= SEGMENT_TOOLTIP_DELAY_MS
            ) {
              return;
            }
          }
          let value14 = scheduleElementAnimationFrame(
            current,
            () => value8(true),
          );
          if (value14) {
            ref3.current.poll = {
              cancel: value14,
              width: value11,
              still: value12,
              frames: value13,
            };
          }
        };
        if (options) {
          options.push(callback3);
        } else {
          callback3();
        }
      }, []),
      value4 = segments
        .map((input) => input.value)
        .join("\x00");
    reactd4.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current,
        value8 = (0, runtime.getResizeObserverConstructor)(current),
        value9 = current !== null && value8 !== undefined,
        current3 = ref3.current;
      current3.live = true;
      if (
        !value9 ||
        (current2 !== null && (0, runtime.hasFlipAnimationMarker)(current2))
      ) {
        callback();
      }
      let value10 = value9
        ? observeSegmentedControlSize(current!, value8!, callback)
        : null;
      return () => {
        value10?.();
        current3.live = false;
        current3.poll?.cancel();
      };
    }, [value, variant, fullWidth, value4, callback]);
    reactd4.useLayoutEffect(() => {
      if (!thumbPosition) {
        return;
      }
      let callback3 = (input: number | null): void => {
        let current = ref.current,
          current2 = ref2.current;
        if (!current || !current2) {
          return;
        }
        if (input === null) {
          if ((0, runtime.isImmediateFlipMarker)(current2)) {
            callback();
          }
          return;
        }
        (0, runtime.pauseFlipAnimationAtProgress)(
          current2,
          input,
          () =>
            Array.from<HTMLElement, SegmentBounds>(
              current.querySelectorAll<HTMLElement>('[role="radio"]'),
              (input2) =>
                getRelativeSegmentBounds(input2, current),
            ),
        );
      };
      callback3(thumbPosition.get());
      let value8 = thumbPosition.on("change", callback3);
      return () => {
        value8();
        callback3(null);
      };
    }, [thumbPosition, callback]);
    let callback2 = reactd4.useCallback(
        (input: string) => {
          onChange(input);
        },
        [onChange],
      ),
      value5 = variant === "contained",
      value6 = (0, runtime.useHasTooltipProvider)(),
      value7 = jsxy1.jsxs(runtime.baseRadioGroup, {
        ref: ref,
        "data-cds": "SegmentedControl",
        "aria-label": ariaLabel,
        "aria-required": ariaRequired,
        "aria-invalid": ariaInvalid,
        "aria-describedby": ariaDescribedby,
        value: value,
        onValueChange: callback2,
        disabled: disabled,
        ...(0, runtime.getControlSizeAttributes)(size),
        className: (0, runtime.cn)(
          "relative inline-flex",
          fullWidth ? "w-full" : "w-fit",
          "shrink-0 items-stretch h-control font-sans",
          value5
            ? "rounded bg-[var(--cds-segmented-control-track)] p-px"
            : "gap-[1px]",
          className,
        ),
        children: [
          jsxy1.jsx("div", {
            "aria-hidden": true,
            className: `pointer-events-none absolute inset-0 overflow-clip ${value5 ? "rounded" : ""}`,
            children: jsxy1.jsx("div", {
              ref: ref2,
              className: `${segmentedControlThumbClasses} ${value5 ? containedSegmentThumbClasses : ghostSegmentThumbClasses}`,
            }),
          }),
          segments.map((input) => {
            let value8 = input.icon && input.label === undefined,
              value9 = value8
                ? (input.tooltip ?? String(input.value))
                : input.tooltip,
              value10 =
                typeof input.tooltip === "string"
                  ? input.tooltip
                  : String(input.value),
              value11 = input.icon
                ? jsxy1.jsx(runtime.Icon, {
                    name: input.icon,
                    size: "auto",
                  })
                : null,
              value12 = jsxy1.jsxs(runtime.baseRadio.Root, {
                value: input.value,
                disabled: input.disabled,
                "aria-label": value8 ? value10 : undefined,
                "aria-keyshortcuts": input.shortcut
                  ? (0, runtime.shortcutToAriaKeyShortcuts)(
                      input.shortcut,
                      value3,
                    )
                  : undefined,
                onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
                  undefined,
                ),
                className: `${segmentedControlSegmentClasses} ${value5 ? segmentedControlTextClasses : ghostSegmentHoverClasses} ${value8 ? segmentedControlIconAspectClasses : segmentedControlTextPaddingClasses}${fullWidth ? " flex-1" : ""}`,
                children: [
                  value11 && input.indicator
                    ? jsxy1.jsxs("span", {
                        className: "grid",
                        children: [
                          jsxy1.jsx("span", {
                            className:
                              "col-start-1 row-start-1 [--seg-dot-r:calc(0.1875rem*var(--cds-rem-scale,1))] [--seg-dot-x:calc(100%_-_var(--seg-dot-r)_+_1px)] [&:dir(rtl)]:[--seg-dot-x:calc(var(--seg-dot-r)_-_1px)] not-forced-colors:has-[~[data-cds-part=indicator]>*]:[mask-image:radial-gradient(circle_at_var(--seg-dot-x)_calc(var(--seg-dot-r)_-_1px),transparent_calc(var(--seg-dot-r)_+_2px),black_calc(var(--seg-dot-r)_+_2.5px))]",
                            children: value11,
                          }),
                          jsxy1.jsx("span", {
                            "aria-hidden": true,
                            "data-cds-part": "indicator",
                            className:
                              "relative col-start-1 row-start-1 -me-px -mt-px self-start justify-self-end has-[>[data-cds=Pulse]]:[--cds-page-bg:transparent]",
                            children: input.indicator,
                          }),
                        ],
                      })
                    : value11,
                  input.label,
                ],
              }),
              value13 =
                input.disabled && !!input.disabledReason
                  ? jsxy1.jsx(runtime.DisabledReasonTooltip, {
                      reason: input.disabledReason,
                      side: tooltipSide,
                      hoverable: false,
                      wrapperClassName: fullWidth
                        ? `${segmentedControlVisualLayerClasses} ${value8 ? segmentedControlFullWidthItemClasses : segmentedControlFlexibleItemClasses}`
                        : segmentedControlVisualLayerClasses,
                      children: value12,
                    })
                  : value9 !== undefined
                    ? jsxy1.jsx(runtime.Tooltip, {
                        content: value9,
                        detail: input.tooltipDetail,
                        shortcut: input.shortcut,
                        side: tooltipSide,
                        hoverable: input.tooltipHoverable ?? false,
                        className: tooltipClassName,
                        children: value12,
                      })
                    : value12;
            if (value2) {
              return jsxy1.jsx(
                runtime.baseLabelableProvider,
                {
                  children: value13,
                },
                input.value,
              );
            } else {
              return jsxy1.jsx(
                reactd4.Fragment,
                {
                  children: value13,
                },
                input.value,
              );
            }
          }),
        ],
      });
    if (value6) {
      return value7;
    } else {
      return jsxy1.jsx(runtime.TooltipProvider, {
        children: value7,
      });
    }
  }
  function getRelativeSegmentBounds(
    input: HTMLElement,
    options: HTMLElement,
  ): SegmentBounds {
    let bounds = options.getBoundingClientRect(),
      value = getUnscaledBorderBoxWidth(options),
      value2 =
        Math.abs(bounds.width - value) < 0.01 ? 1 : bounds.width / value;
    if (!(value2 > 0) || !Number.isFinite(value2)) {
      return {
        left: input.offsetLeft,
        width: input.offsetWidth,
      };
    }
    let bounds2 = input.getBoundingClientRect(),
      value3 =
        (0, runtime.getElementWindow)(options)?.devicePixelRatio || 1,
      callback = (input2: number): number =>
        Math.round(input2 * value3) / value3;
    return {
      left: (callback(bounds2.left) - callback(bounds.left)) / value2,
      width: (callback(bounds2.right) - callback(bounds2.left)) / value2,
    };
  }
  function measureScaledElementWidth(input: HTMLElement): ScaledElementWidth {
    let width = input.getBoundingClientRect().width;
    return {
      width: width,
      scaled:
        input.offsetWidth > 0 &&
        Math.abs(width - getUnscaledBorderBoxWidth(input)) >= 0.01,
    };
  }
  function scheduleElementAnimationFrame(
    input: Element | undefined,
    options: FrameRequestCallback,
  ): (() => void) | null {
    let value = (0, runtime.getConnectedElementWindow)(input);
    if (!value || typeof value.requestAnimationFrame !== "function") {
      return null;
    }
    let value2 = value.requestAnimationFrame(options);
    return () => {
      try {
        value.cancelAnimationFrame(value2);
      } catch {}
    };
  }
  function getUnscaledBorderBoxWidth(input: Element): number {
    let style = (
        (0, runtime.getElementWindow)(input) ?? window
      ).getComputedStyle(input),
      value = parseFloat(style.width);
    if (style.boxSizing === "border-box") {
      return value;
    } else {
      return (
        value +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth)
      );
    }
  }
  function selectionGripHitSize(
    frame: SelectionFrame,
    scale: number,
    touch: boolean,
  ): number {
    if (touch) {
      return SELECTION_POINT_METRICS.gripHitTouch;
    }
    let value = Math.min(frame.w, frame.h) * scale;
    return Math.max(
      SELECTION_POINT_METRICS.grip,
      Math.min(SELECTION_POINT_METRICS.gripHit, value / 2),
    );
  }
  function SelectionPointGrip(): ReactElement {
    let point = SELECTION_POINT_METRICS.point,
      pointStroke = SELECTION_POINT_METRICS.pointStroke;
    return jsxForUiTable.jsx("span", {
      "data-selection-grip": "",
      className: (0, runtime.cn)(
        "absolute top-1/2 left-1/2 box-border block -translate-x-1/2 -translate-y-1/2 rounded-full",
        runtime.SELECTION_OUTLINE_CLASS,
      ),
      style: {
        width: point,
        height: point,
        backgroundColor: runtime.designTokens.on.accent.cssVar,
        outlineStyle: "solid",
        outlineWidth: pointStroke,
        outlineOffset: -pointStroke,
        pointerEvents: "none",
      },
    });
  }
  function rotatedResizeCursor(
    point: SelectionHandle,
    rotation = 0,
  ): string {
    let value = point.x === "left" ? -1 : point.x === "right" ? 1 : 0,
      value2 = point.y === "top" ? -1 : point.y === "bottom" ? 1 : 0;
    return (
      RESIZE_CURSOR_CYCLE[
        ((Math.round((Math.atan2(value2, value) + rotation) / (Math.PI / 4)) %
          4) +
          4) %
          4
      ] ?? "ew-resize"
    );
  }
  function rotatedGrabCursor(corner: GrabCursorCorner, rotation = 0): string {
    let value = Math.round(
      GRAB_CURSOR_ANGLES[corner] + (rotation * 180) / Math.PI,
    );
    return `url("data:${GRAB_CURSOR_MIME},${GRAB_CURSOR_SVG_PREFIX}${String(value)}${GRAB_CURSOR_SVG_SUFFIX}") 12 12, grab`;
  }
  function stopSelectionRingEvent(
    event: Pick<Event, "preventDefault" | "stopPropagation">,
  ): void {
    event.preventDefault();
    event.stopPropagation();
  }
  function SelectionHandleWithTooltip(
    index: string,
    tooltip: SelectionHandleTooltip,
    element: ReactElement,
  ): ReactElement {
    if (!(0, runtime.hasDisabledReason)(tooltip.content)) {
      return reactForUiTable2.cloneElement(element, {
        key: index,
      });
    }
    return jsxForUiTable2.jsx(
      runtime.Tooltip,
      {
        lazy: true,
        content: tooltip.content,
        multiline: tooltip.reason,
        hoverable: false,
        closeOnClick: tooltip.reason ? false : undefined,
        trackCursorAxis: tooltip.followPointer ? "both" : undefined,
        children: element,
      },
      index,
    );
  }
  function pointInsideSelectionGripHitArea(
    event: ReactMouseEvent<Element>,
    point: number,
    scale: number,
    touch: number,
  ): boolean {
    let value =
      event.currentTarget.parentElement?.getBoundingClientRect();
    if (value === undefined) {
      return false;
    }
    let value2 = event.clientX - (value.left + value.width / 2),
      value3 = event.clientY - (value.top + value.height / 2),
      value4 = value2 * Math.cos(touch) + value3 * Math.sin(touch),
      value5 = value3 * Math.cos(touch) - value2 * Math.sin(touch);
    return Math.abs(value4) <= point && Math.abs(value5) <= scale;
  }
  function selectionHandleKey(point: SelectionHandle): string {
    return `${point.x ?? "mid"}-${point.y ?? "mid"}`;
  }
  function currencyDisplayParts(
    currency: string,
    locale: Intl.LocalesArgument,
  ): CurrencyDisplayParts {
    let value = currency.toUpperCase();
    try {
      let value2 = new Intl.NumberFormat(locale, {
          style: "currency",
          currency: value,
          currencyDisplay: DISAMBIGUATED_CURRENCY_CODES.has(value)
            ? "code"
            : "symbol",
        }).formatToParts(1),
        value3 = value2.findIndex(
          (input) => input.type === "currency",
        ),
        value4 = value2[value3];
      if (value4 === undefined) {
        return {
          symbol: value,
          side: "start",
        };
      }
      let value5: CurrencySymbolSide = value2
        .slice(0, value3)
        .some(
          (input) =>
            CURRENCY_NUMBER_PART_TYPES.has(input.type),
        )
        ? "end"
        : "start";
      return {
        symbol: value4.value,
        side: value5,
      };
    } catch {
      return {
        symbol: value,
        side: "start",
      };
    }
  }
  function useClientHydrated(): boolean {
    return reactForUiTable3.useSyncExternalStore(
      subscribeHydration,
      () => true,
      () => false,
    );
  }
  bindRuntimeValue(
    runtime,
    "observeSegmentedControlSize",
    () => observeSegmentedControlSize,
  );
  bindRuntimeValue(runtime, "SegmentedControl", () => SegmentedControl);
  bindRuntimeValue(
    runtime,
    "getRelativeSegmentBounds",
    () => getRelativeSegmentBounds,
  );
  bindRuntimeValue(
    runtime,
    "measureScaledElementWidth",
    () => measureScaledElementWidth,
  );
  bindRuntimeValue(
    runtime,
    "scheduleElementAnimationFrame",
    () => scheduleElementAnimationFrame,
  );
  bindRuntimeValue(
    runtime,
    "getUnscaledBorderBoxWidth",
    () => getUnscaledBorderBoxWidth,
  );
  bindRuntimeValue(
    runtime,
    "reactd4",
    () => reactd4,
    (value) => {
      reactd4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxy1",
    () => jsxy1,
    (value) => {
      jsxy1 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlSegmentClasses",
    () => segmentedControlSegmentClasses,
    (value) => {
      segmentedControlSegmentClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlTextPaddingClasses",
    () => segmentedControlTextPaddingClasses,
    (value) => {
      segmentedControlTextPaddingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlIconAspectClasses",
    () => segmentedControlIconAspectClasses,
    (value) => {
      segmentedControlIconAspectClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlVisualLayerClasses",
    () => segmentedControlVisualLayerClasses,
    (value) => {
      segmentedControlVisualLayerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlFlexibleItemClasses",
    () => segmentedControlFlexibleItemClasses,
    (value) => {
      segmentedControlFlexibleItemClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlFullWidthItemClasses",
    () => segmentedControlFullWidthItemClasses,
    (value) => {
      segmentedControlFullWidthItemClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlTextClasses",
    () => segmentedControlTextClasses,
    (value) => {
      segmentedControlTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ghostSegmentHoverClasses",
    () => ghostSegmentHoverClasses,
    (value) => {
      ghostSegmentHoverClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlThumbClasses",
    () => segmentedControlThumbClasses,
    (value) => {
      segmentedControlThumbClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "containedSegmentThumbClasses",
    () => containedSegmentThumbClasses,
    (value) => {
      containedSegmentThumbClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ghostSegmentThumbClasses",
    () => ghostSegmentThumbClasses,
    (value) => {
      ghostSegmentThumbClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SEGMENT_INDICATOR_SETTLE_MS",
    () => SEGMENT_INDICATOR_SETTLE_MS,
    (value) => {
      SEGMENT_INDICATOR_SETTLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SEGMENT_INDICATOR_SETTLE_FRAMES",
    () => SEGMENT_INDICATOR_SETTLE_FRAMES,
    (value) => {
      SEGMENT_INDICATOR_SETTLE_FRAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SEGMENT_TOOLTIP_DELAY_MS",
    () => SEGMENT_TOOLTIP_DELAY_MS,
    (value) => {
      SEGMENT_TOOLTIP_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "segmentedControlResizeObservers",
    () => segmentedControlResizeObservers,
    (value) => {
      segmentedControlResizeObservers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable",
    () => initializeUiTable,
    (value) => {
      initializeUiTable = value;
    },
  );
  bindRuntimeValue(runtime, "selectionGripHitSize", () => selectionGripHitSize);
  bindRuntimeValue(
    runtime,
    "SELECTION_POINT_METRICS",
    () => SELECTION_POINT_METRICS,
    (value) => {
      SELECTION_POINT_METRICS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable2",
    () => initializeUiTable2,
    (value) => {
      initializeUiTable2 = value;
    },
  );
  bindRuntimeValue(runtime, "SelectionPointGrip", () => SelectionPointGrip);
  bindRuntimeValue(
    runtime,
    "reactForUiTable",
    () => reactForUiTable,
    (value) => {
      reactForUiTable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTable",
    () => jsxForUiTable,
    (value) => {
      jsxForUiTable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionPoints",
    () => SelectionPoints,
    (value) => {
      SelectionPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable3",
    () => initializeUiTable3,
    (value) => {
      initializeUiTable3 = value;
    },
  );
  bindRuntimeValue(runtime, "rotatedResizeCursor", () => rotatedResizeCursor);
  bindRuntimeValue(runtime, "rotatedGrabCursor", () => rotatedGrabCursor);
  bindRuntimeValue(
    runtime,
    "GRAB_CURSOR_CORNERS",
    () => GRAB_CURSOR_CORNERS,
    (value) => {
      GRAB_CURSOR_CORNERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_CURSOR_CYCLE",
    () => RESIZE_CURSOR_CYCLE,
    (value) => {
      RESIZE_CURSOR_CYCLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRAB_CURSOR_ANGLES",
    () => GRAB_CURSOR_ANGLES,
    (value) => {
      GRAB_CURSOR_ANGLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRAB_CURSOR_MIME",
    () => GRAB_CURSOR_MIME,
    (value) => {
      GRAB_CURSOR_MIME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRAB_CURSOR_SVG_PREFIX",
    () => GRAB_CURSOR_SVG_PREFIX,
    (value) => {
      GRAB_CURSOR_SVG_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRAB_CURSOR_SVG_PATH",
    () => GRAB_CURSOR_SVG_PATH,
    (value) => {
      GRAB_CURSOR_SVG_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRAB_CURSOR_SVG_SUFFIX",
    () => GRAB_CURSOR_SVG_SUFFIX,
    (value) => {
      GRAB_CURSOR_SVG_SUFFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable4",
    () => initializeUiTable4,
    (value) => {
      initializeUiTable4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stopSelectionRingEvent",
    () => stopSelectionRingEvent,
  );
  bindRuntimeValue(
    runtime,
    "SelectionHandleWithTooltip",
    () => SelectionHandleWithTooltip,
  );
  bindRuntimeValue(
    runtime,
    "pointInsideSelectionGripHitArea",
    () => pointInsideSelectionGripHitArea,
  );
  bindRuntimeValue(runtime, "selectionHandleKey", () => selectionHandleKey);
  bindRuntimeValue(
    runtime,
    "reactForUiTable2",
    () => reactForUiTable2,
    (value) => {
      reactForUiTable2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTable2",
    () => jsxForUiTable2,
    (value) => {
      jsxForUiTable2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionRing",
    () => SelectionRing,
    (value) => {
      SelectionRing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable5",
    () => initializeUiTable5,
    (value) => {
      initializeUiTable5 = value;
    },
  );
  bindRuntimeValue(runtime, "currencyDisplayParts", () => currencyDisplayParts);
  bindRuntimeValue(
    runtime,
    "DISAMBIGUATED_CURRENCY_CODES",
    () => DISAMBIGUATED_CURRENCY_CODES,
    (value) => {
      DISAMBIGUATED_CURRENCY_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CURRENCY_NUMBER_PART_TYPES",
    () => CURRENCY_NUMBER_PART_TYPES,
    (value) => {
      CURRENCY_NUMBER_PART_TYPES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable6",
    () => initializeUiTable6,
    (value) => {
      initializeUiTable6 = value;
    },
  );
  bindRuntimeValue(runtime, "useClientHydrated", () => useClientHydrated);
  bindRuntimeValue(
    runtime,
    "reactForUiTable3",
    () => reactForUiTable3,
    (value) => {
      reactForUiTable3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTable3",
    () => jsxForUiTable3,
    (value) => {
      jsxForUiTable3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hydrationNoop",
    () => hydrationNoop,
    (value) => {
      hydrationNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeHydration",
    () => subscribeHydration,
    (value) => {
      subscribeHydration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NumberInput",
    () => NumberInput,
    (value) => {
      NumberInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTable7",
    () => initializeUiTable7,
    (value) => {
      initializeUiTable7 = value;
    },
  );
  return () => {
    segmentedControlSegmentClasses =
      "cds-reset relative z-[1] inline-flex h-full items-center justify-center gap-1.5 select-none border-0 bg-transparent outline-none focus-visible:outline-hidden rounded-[calc(var(--cds-radius)-2px)] text-body font-normal [&:not([data-disabled])]:hover:text-primary data-[checked]:text-primary data-[disabled]:opacity-disabled transition-shadow duration-fast focus-visible:shadow-focus";
    segmentedControlTextPaddingClasses = "px-md";
    segmentedControlIconAspectClasses = "aspect-square";
    segmentedControlVisualLayerClasses =
      "h-full relative z-[1] rounded-[calc(var(--cds-radius)-2px)]";
    segmentedControlFlexibleItemClasses =
      "grow basis-[calc(var(--cds-pad-md)*2)]";
    segmentedControlFullWidthItemClasses = "flex-1";
    segmentedControlTextClasses = "text-secondary";
    ghostSegmentHoverClasses =
      "text-secondary [&:not([data-checked]):not([data-disabled])]:hover:bg-fill-ghost-hover";
    segmentedControlThumbClasses =
      "invisible absolute left-0 origin-left rounded-[calc(var(--cds-radius)-1px)] bg-[var(--cds-segmented-control-thumb)]";
    containedSegmentThumbClasses =
      "top-px bottom-px [box-shadow:inset_0_0_0_1px_var(--cds-border),0_1px_2px_0_rgb(0_0_0/0.05)]";
    ghostSegmentThumbClasses =
      "inset-y-0 [box-shadow:inset_0_0_0_1px_var(--cds-border)]";
    SEGMENT_INDICATOR_SETTLE_MS = 30;
    SEGMENT_INDICATOR_SETTLE_FRAMES = 2;
    SEGMENT_TOOLTIP_DELAY_MS = 600;
    initializeUiTable = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeErrorReporting)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeResizeObserverAccess)();
      (0, runtime.initializeUiDisclosure)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeShortcuts)();
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeUiDisclosure7)();
      (0, runtime.initializeUiMenu)();
      (0, runtime.initializeUiDialog22)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactd4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxy1 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      segmentedControlResizeObservers = new WeakMap();
    });
    initializeUiTable2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiEditorSelection)();
      SELECTION_POINT_METRICS = {
        ...runtime.SELECTION_METRICS,
        point: 10,
        pointStroke: 1.5,
        gripHit: 24,
        gripHitTouch: 40,
        edgeHit: 8,
        rotateReach: 16,
      };
    });
    initializeUiTable3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeUiEditorTokens)();
      (0, runtime.initializeModalReleasePlatform)();
      (0, runtime.initializeUiEditorSelection)();
      initializeUiTable2();
      reactForUiTable = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTable = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      SelectionPoints = reactForUiTable.forwardRef<
        HTMLDivElement,
        SelectionPointsProps
      >(function (
        {
          points: points,
          scale = 1,
          shaft: shaft,
          shape = "round",
          onPointDragStart: onPointDragStart,
          cursor = "move",
          className: className,
          ...props
        },
        options,
      ): ReactElement {
        let value = reactForUiTable.useSyncExternalStore(
            runtime.subscribeDeviceMediaQueries,
            runtime.useCoarseOrHoverlessPointer,
            () => false,
          ),
          value2 = (0, runtime.validSelectionScale)(scale),
          index = 0;
        for (let value5 of points)
          for (let value6 of points)
            index = Math.max(
              index,
              Math.abs(value5.x - value6.x),
              Math.abs(value5.y - value6.y),
            );
        let value3 = value
            ? SELECTION_POINT_METRICS.gripHitTouch
            : Math.max(
                SELECTION_POINT_METRICS.grip,
                Math.min(SELECTION_POINT_METRICS.gripHit, (index * value2) / 2),
              ),
          value4 = onPointDragStart !== undefined;
        return jsxForUiTable.jsxs("div", {
          ...props,
          ref: options,
          "data-cds": "SelectionPoints",
          "aria-hidden": "true",
          className: (0, runtime.cn)(
            "pointer-events-none absolute top-0 left-0",
            className,
          ),
          children: [
            shaft !== undefined && shaft.length > 1
              ? jsxForUiTable.jsx("svg", {
                  "data-selection-shaft": "",
                  className:
                    "pointer-events-none absolute top-0 left-0 overflow-visible",
                  width: 1,
                  height: 1,
                  children: jsxForUiTable.jsx("polyline", {
                    points: shaft
                      .map(
                        (input) => `${input.x},${input.y}`,
                      )
                      .join(" "),
                    fill: "none",
                    stroke: runtime.designTokens.fill.accent.cssVar,
                    strokeWidth: 1 / value2,
                  }),
                })
              : null,
            points.map(
              (input, options2) =>
                jsxForUiTable.jsx(
                  "div",
                  {
                    className: "absolute top-0 left-0 size-0",
                    style: {
                      transform: `translate(${input.x}px, ${input.y}px) scale(${1 / value2})`,
                    },
                    children: jsxForUiTable.jsx("div", {
                      "data-resize-handle": value4 ? "" : undefined,
                      "data-point-handle": options2,
                      className: "absolute touch-none",
                      style: {
                        left: -value3 / 2,
                        top: -value3 / 2,
                        width: value3,
                        height: value3,
                        cursor: value4 ? cursor : undefined,
                        pointerEvents: value4 ? "auto" : "none",
                      },
                      onPointerDown: value4
                        ? (input2: ReactPointerEvent<HTMLDivElement>) =>
                            onPointDragStart!(options2, input2)
                        : undefined,
                      children:
                        shape === "square"
                          ? jsxForUiTable.jsx(runtime.SelectionGrip, {})
                          : jsxForUiTable.jsx(SelectionPointGrip, {}),
                    }),
                  },
                  options2,
                ),
            ),
          ],
        });
      });
      SelectionPoints.displayName = "SelectionPoints";
    });
    GRAB_CURSOR_MIME = "image/svg+xml";
    GRAB_CURSOR_SVG_PREFIX =
      "%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2724%27%20height=%2724%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20transform=%27rotate%28";
    GRAB_CURSOR_SVG_PATH =
      "%20d=%27M%204.5%2010.7%20L%205.4%2010.4%20A%206.5%206.5%200%200%201%2013.6%2018.6%20L%2013.3%2019.5%20M%206.3%207.8%20L%204.5%2010.7%20L%207.7%2012.0%20M%2012.0%2016.3%20L%2013.3%2019.5%20L%2016.2%2017.7%27";
    initializeUiTable4 = (0, runtime.initializeOnce)(() => {
      GRAB_CURSOR_CORNERS = ["nw", "ne", "se", "sw"];
      RESIZE_CURSOR_CYCLE = [
        "ew-resize",
        "nwse-resize",
        "ns-resize",
        "nesw-resize",
      ];
      GRAB_CURSOR_ANGLES = {
        ne: 0,
        se: 90,
        sw: 180,
        nw: 270,
      };
      GRAB_CURSOR_SVG_SUFFIX =
        "%2012%2012%29%27%20fill=%27none%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E" +
        ("%3Cpath" +
          GRAB_CURSOR_SVG_PATH +
          "%20stroke=%27white%27%20stroke-width=%273.5%27/%3E") +
        ("%3Cpath" +
          GRAB_CURSOR_SVG_PATH +
          "%20stroke=%27black%27%20stroke-width=%271.5%27/%3E") +
        "%3C/g%3E%3C/svg%3E";
    });
    initializeUiTable5 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeModalReleasePlatform)();
      (0, runtime.initializeUiEditorSelection)();
      (0, runtime.initializeDisabledReason)();
      (0, runtime.initializeTooltip)();
      initializeUiTable2();
      initializeUiTable4();
      reactForUiTable2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTable2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      SelectionRing = reactForUiTable2.forwardRef<
        HTMLDivElement,
        SelectionRingProps
      >(function (
        {
          frame: frame,
          scale = 1,
          rotation: rotation,
          state = "selected",
          variant = "object",
          grips: grips,
          angleLabel: angleLabel,
          collaborator: collaborator,
          onResizeStart: onResizeStart,
          edgeStrips = true,
          onGripDoubleClick: onGripDoubleClick,
          onRotateStart: onRotateStart,
          resizeDisabledReason: resizeDisabledReason,
          rotateDisabledReason: rotateDisabledReason,
          gripLabel: gripLabel,
          className: className,
          style: style,
          ...props
        },
        options,
      ): ReactElement | null {
        let value = reactForUiTable2.useSyncExternalStore(
            runtime.subscribeDeviceMediaQueries,
            runtime.useCoarseOrHoverlessPointer,
            () => false,
          ),
          value2 = (0, runtime.validSelectionScale)(scale),
          value3 = (0, runtime.collaboratorSelectionIndex)(
            collaborator,
          );
        if (collaborator !== undefined && value3 === undefined) {
          return null;
        }
        let value4 = (0, runtime.selectionRingWidth)(state, value3),
          value5 = (0, runtime.selectionHandlePositions)(
            grips,
            state,
            value3,
          ),
          value6 = (0, runtime.finiteSelectionRotation)(rotation),
          value7 = (0, runtime.hasDisabledReason)(
            resizeDisabledReason,
          ),
          value8 = (0, runtime.hasDisabledReason)(
            rotateDisabledReason,
          ),
          value9 = value3 === undefined && state === "selected",
          value10 =
            value9 && (value7 ? !value : onResizeStart !== undefined),
          value11 = frame.w * value2,
          value12 = frame.h * value2,
          value13 = selectionGripHitSize(frame, value2, value),
          edgeHit = SELECTION_POINT_METRICS.edgeHit,
          value14 =
            typeof grips === "object"
              ? runtime.EDGE_SELECTION_HANDLES.filter(
                  (input) =>
                    grips.some(
                      (input2) =>
                        (0, runtime.equalSelectionPoint)(input2, input),
                    ),
                )
              : [],
          value15 =
            !value10 || value || value7 || !edgeStrips || value5.length === 0
              ? []
              : value14.length > 0
                ? value14
                : runtime.EDGE_SELECTION_HANDLES,
          callback = (input: number): boolean =>
            input >= 3 * SELECTION_POINT_METRICS.edgeHit,
          value16 = value15.filter(
            (input) =>
              input.x === null
                ? input.y !== null && callback(value12)
                : input.y === null && callback(value11),
          ),
          value17 =
            !value9 || value || (onRotateStart === undefined && !value8)
              ? []
              : GRAB_CURSOR_CORNERS,
          value18 = value13 / 2 + SELECTION_POINT_METRICS.rotateReach,
          value19 = value7
            ? {
                content: resizeDisabledReason,
                reason: true,
              }
            : {
                content: gripLabel,
                reason: false,
              };
        return jsxForUiTable2.jsxs("div", {
          ...props,
          ref: options,
          "data-cds": "SelectionRing",
          "data-state": value3 === undefined ? state : undefined,
          "data-variant": value3 === undefined ? variant : undefined,
          "data-collaborator": value3,
          "aria-hidden": "true",
          className: (0, runtime.cn)(
            runtime.SELECTION_OUTLINE_CLASS,
            className,
          ),
          style: {
            ...style,
            ...(0, runtime.SelectionOutline)({
              frame: frame,
              scale: value2,
              rotation: rotation,
              stroke: value4,
              collaborator: value3,
              variant: variant,
            }),
          },
          children: [
            jsxForUiTable2.jsxs(runtime.TooltipProvider, {
              children: [
                value17.map((input) => {
                  let state2 = {
                    position: "absolute",
                    left: input === "nw" || input === "sw" ? -value18 : value11,
                    top: input === "nw" || input === "ne" ? -value18 : value12,
                    width: value18,
                    height: value18,
                    pointerEvents: "auto",
                    cursor: value8
                      ? "default"
                      : rotatedGrabCursor(input, value6),
                  };
                  return SelectionHandleWithTooltip(
                    `rotate-${input}`,
                    {
                      content: rotateDisabledReason,
                      reason: true,
                    },
                    jsxForUiTable2.jsx("div", {
                      "data-resize-handle": "",
                      "data-rotate-handle": input,
                      className: "touch-none",
                      "data-disabled": value8 ? "" : undefined,
                      style: state2,
                      onPointerDown: value8
                        ? stopSelectionRingEvent
                        : (input2: ReactPointerEvent<HTMLDivElement>) =>
                            onRotateStart?.(input, input2),
                    }),
                  );
                }),
                value16.map((input) => {
                  let value20 = input.x === null,
                    callback2 = (
                      input2: SelectionHandle["x"],
                      options2: SelectionHandle["y"],
                    ): number =>
                      value5.some(
                        (input3) =>
                          input3.x === input2 && input3.y === options2,
                      )
                        ? value13 / 2
                        : 0,
                    value21 = value20
                      ? callback2("left", input.y)
                      : callback2(input.x, "top"),
                    value22 = value20
                      ? callback2("right", input.y)
                      : callback2(input.x, "bottom"),
                    state2 = {
                      position: "absolute",
                      pointerEvents: "auto",
                      cursor: rotatedResizeCursor(input, value6),
                      ...(value20
                        ? {
                            left: value21,
                            width: Math.max(0, value11 - value21 - value22),
                            top:
                              (input.y === "top" ? 0 : value12) - edgeHit / 2,
                            height: edgeHit,
                          }
                        : {
                            top: value21,
                            height: Math.max(0, value12 - value21 - value22),
                            left:
                              (input.x === "left" ? 0 : value11) - edgeHit / 2,
                            width: edgeHit,
                          }),
                    };
                  return SelectionHandleWithTooltip(
                    `strip-${selectionHandleKey(input)}`,
                    {
                      content: gripLabel,
                      reason: false,
                      followPointer: true,
                    },
                    jsxForUiTable2.jsx("div", {
                      "data-resize-handle": "",
                      "data-resize-strip": "",
                      className: "touch-none",
                      style: state2,
                      onPointerDown: (
                        input2: ReactPointerEvent<HTMLDivElement>,
                      ) => onResizeStart?.(input, input2),
                      onDoubleClick:
                        onGripDoubleClick === undefined
                          ? undefined
                          : (input2: ReactMouseEvent<HTMLDivElement>) => {
                              input2.stopPropagation();
                              onGripDoubleClick(input);
                            },
                    }),
                  );
                }),
                value5.map((input) => {
                  let value20 = (0,
                  runtime.selectionHandleCssPosition)(input);
                  if (!value10) {
                    return jsxForUiTable2.jsx(
                      "span",
                      {
                        className: "absolute block size-0",
                        style: value20,
                        children: jsxForUiTable2.jsx(runtime.SelectionGrip, {
                          stroke: value4,
                          disabled: value9 && value7,
                          variant: variant,
                        }),
                      },
                      selectionHandleKey(input),
                    );
                  }
                  let state2 = {
                    position: "absolute",
                    left: `calc(${value20.left} - ${value13 / 2}px)`,
                    top: `calc(${value20.top} - ${value13 / 2}px)`,
                    width: value13,
                    height: value13,
                    pointerEvents: "auto",
                    cursor: value7
                      ? "default"
                      : rotatedResizeCursor(input, value6),
                  };
                  return SelectionHandleWithTooltip(
                    selectionHandleKey(input),
                    value19,
                    jsxForUiTable2.jsx("div", {
                      "data-resize-handle": "",
                      "data-disabled": value7 ? "" : undefined,
                      className: "touch-none",
                      style: state2,
                      onPointerDown: value7
                        ? stopSelectionRingEvent
                        : (input2: ReactPointerEvent<HTMLDivElement>) =>
                            onResizeStart?.(input, input2),
                      onDoubleClick:
                        onGripDoubleClick === undefined || value7
                          ? undefined
                          : (input2: ReactMouseEvent<HTMLDivElement>) => {
                              if (
                                value &&
                                pointInsideSelectionGripHitArea(
                                  input2,
                                  value11 / 2,
                                  value12 / 2,
                                  value6,
                                )
                              ) {
                                return;
                              }
                              input2.stopPropagation();
                              onGripDoubleClick(input);
                            },
                      children: jsxForUiTable2.jsx(runtime.SelectionGrip, {
                        stroke: value4,
                        disabled: value7,
                        variant: variant,
                      }),
                    }),
                  );
                }),
              ],
            }),
            angleLabel !== undefined && value3 === undefined
              ? jsxForUiTable2.jsx(runtime.SelectionLabel, {
                  "data-selection-angle": "",
                  scale: 1,
                  rotation: rotation,
                  anchor: "center",
                  at: runtime.ROTATION_HANDLE_POSITION,
                  variant: variant,
                  children: angleLabel,
                })
              : null,
          ],
        });
      });
      SelectionRing.displayName = "SelectionRing";
    });
    initializeUiTable6 = (0, runtime.initializeOnce)(() => {
      DISAMBIGUATED_CURRENCY_CODES = new Set(["SGD", "AUD", "NZD"]);
      CURRENCY_NUMBER_PART_TYPES = new Set([
        "integer",
        "group",
        "decimal",
        "fraction",
        "minusSign",
        "plusSign",
        "nan",
        "infinity",
      ]);
    });
    hydrationNoop = () => {
      return;
    };
    subscribeHydration = () => hydrationNoop;
    initializeUiTable7 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeClickToFocus)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializeUiDisclosure12)();
      (0, runtime.initializeUiMenu)();
      initializeUiTable6();
      (0, runtime.initializeNpmDependency)();
      reactForUiTable3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTable3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      NumberInput = reactForUiTable3.forwardRef<
        HTMLInputElement,
        NumberInputProps
      >(
        (
          {
            className: className,
            size: size,
            fullWidth = true,
            currency: currency,
            slotStart: slotStart,
            slotEnd: slotEnd,
            value: value,
            defaultValue: defaultValue,
            onValueChange: onValueChange,
            onValueCommitted: onValueCommitted,
            format: format,
            locale: locale,
            min: min,
            max: max,
            step: step,
            smallStep: smallStep,
            largeStep: largeStep,
            snapOnStep: snapOnStep,
            allowOutOfRange: allowOutOfRange,
            required: required,
            disabled: disabled,
            readOnly: readOnly,
            name: name,
            form: form,
            ...props
          },
          options,
        ): ReactElement => {
          let { id: value2, ...value3 } = props,
            value4 = (0, runtime.useCdsConfig)(),
            value5 = locale ?? value4,
            value6 = useClientHydrated(),
            value7 = value5 ?? (value6 ? undefined : "en-US"),
            memo = reactForUiTable3.useMemo(
              () =>
                currency !== undefined &&
                slotStart === undefined &&
                slotEnd === undefined
                  ? currencyDisplayParts(currency, value7)
                  : null,
              [currency, value7, slotStart, slotEnd],
            ),
            value8 =
              slotStart ?? (memo?.side === "start" ? memo.symbol : null),
            value9 =
              slotEnd ?? (memo?.side === "end" ? memo.symbol : null),
            value10 = memo !== null || undefined,
            value11 = (0, runtime.useFieldInvalid)(),
            value12 = (0, runtime.useFieldDisabled)(),
            value13 = fullWidth ? "w-full min-w-0" : "",
            ref = reactForUiTable3.useRef<HTMLInputElement>(null),
            { clickToFocusProps: value14 } = (0,
            runtime.useClickToFocus)(() => ref.current?.focus(), {
              disabled: disabled || value12,
              readOnly: readOnly,
            }),
            [, value15] = reactForUiTable3.useReducer(
              (input) => input + 1,
              0,
            ),
            callback = (input: ReactFocusEvent<HTMLInputElement>): void => {
              value3.onBlur?.(input);
              value15();
            },
            value16 = (0, runtime.useMergedRefs)(ref, options);
          return jsxForUiTable3.jsxs(runtime.baseNumberField.Root, {
            "data-cds": "NumberInput",
            ...(0, runtime.getControlSizeAttributes)(size),
            "data-invalid": value11 || undefined,
            id: value2,
            value: value,
            defaultValue: defaultValue,
            onValueChange: onValueChange,
            onValueCommitted: onValueCommitted,
            format: format,
            locale: value5,
            min: min,
            max: max,
            step: step,
            smallStep: smallStep,
            largeStep: largeStep,
            snapOnStep: snapOnStep,
            allowOutOfRange: allowOutOfRange,
            required: required,
            disabled: disabled,
            readOnly: readOnly,
            name: name,
            form: form,
            onMouseDown: value14.onMouseDown,
            className: (0, runtime.cn)(
              runtime.TEXT_INPUT_CLASS,
              "pr-md",
              "inline-flex",
              value13,
              "cursor-text items-center gap-[var(--cds-pad-sm,6px)] has-[:focus-visible]:shadow-focus",
              "data-[disabled]:opacity-disabled",
              !disabled &&
                "[&:hover:not(:focus-visible):not(:has(:focus-visible)):not([data-invalid]):not([data-disabled])]:shadow-field-hover",
              className,
            ),
            children: [
              value8
                ? jsxForUiTable3.jsx("span", {
                    "aria-hidden": value10,
                    className: "flex shrink-0 items-center text-muted",
                    children: value8,
                  })
                : null,
              jsxForUiTable3.jsx(runtime.baseNumberField.Input, {
                ref: value16,
                "aria-invalid":
                  value3["aria-invalid"] ?? (value11 || undefined),
                ...value3,
                onBlur: callback,
                className: (0, runtime.cn)(
                  runtime.TEXT_INPUT_REQUIRED_CLASS,
                  "disabled:opacity-100",
                ),
              }),
              value9
                ? jsxForUiTable3.jsx("span", {
                    "aria-hidden": value10,
                    className: "flex shrink-0 items-center text-muted",
                    children: value9,
                  })
                : null,
            ],
          });
        },
      );
      NumberInput.displayName = "NumberInput";
    });
  };
}

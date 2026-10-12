/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiSegmentedControl(
  runtime: RuntimeBindings,
): () => void {
  var reactForUiSegmentedControl: typeof React;
  var jsxX_: typeof import("react/jsx-runtime");
  var RESIZE_DRAG_THRESHOLD_PX: number;
  var RESIZE_KEYBOARD_STEP_PX: number;
  var RESIZE_KEYBOARD_LARGE_STEP_PX: number;
  var resizeHandleSideClasses: Record<
    NonNullable<C.ResizeHandleProps["side"]>,
    string
  >;
  var ResizeHandle: C.ForwardComponent<HTMLDivElement, C.ResizeHandleProps>;
  var noopFlipCleanup: () => void;
  var FLIP_HELD_MARKER: string;
  var FLIP_PAUSE_DURATION_MS: number;
  var pausedFlipAnimations: WeakMap<HTMLElement, Animation>;
  var reactForUiSegmentedControl2: typeof React;
  var jsxForUiSegmentedControl: typeof import("react/jsx-runtime");
  var segmentedControlSegmentClasses: string;
  var segmentedControlTextPaddingClasses: string;
  var segmentedControlIconAspectClasses: string;
  var segmentedControlVisualLayerClasses: string;
  var segmentedControlFlexibleItemClasses: string;
  var segmentedControlFullWidthItemClasses: string;
  var segmentedControlTextClasses: string;
  var ghostSegmentHoverClasses: string;
  var segmentedControlThumbClasses: string;
  var containedSegmentThumbClasses: string;
  var ghostSegmentThumbClasses: string;
  var SEGMENT_INDICATOR_SETTLE_MS: number;
  var SEGMENT_INDICATOR_SETTLE_FRAMES: number;
  var SEGMENT_TOOLTIP_DELAY_MS: number;
  var segmentedControlResizeObservers: WeakMap<Window, C.SegmentObserverEntry>;
  var DISAMBIGUATED_CURRENCY_CODES: Set<string>;
  var CURRENCY_NUMBER_PART_TYPES: Set<Intl.NumberFormatPartTypes>;
  function animateSegmentedControlThumb(
    input: HTMLElement,
    options: HTMLElement,
    context: C.SegmentBounds | null,
    {
      correction: value = false,
    }: {
      correction?: boolean;
    } = {},
  ) {
    if (context === null || context.width <= 0) {
      let value9 = getElementAnimations(input);
      return () => {
        cancelAnimations(value9);
        input.style.visibility = "";
        input.style.willChange = "";
        delete input.dataset.flipAt;
      };
    }
    let value2 = `${context.left},${context.width}`,
      flipAt = input.dataset.flipAt;
    if (flipAt === value2) {
      return noopFlipCleanup;
    }
    let bounds = input.getBoundingClientRect(),
      left = options.getBoundingClientRect().left,
      value3 = getComputedStyle(input),
      value4 = readCssDuration(value3, "--cds-dur-base"),
      value5 = value3.getPropertyValue("--cds-ease-snap").trim() || "linear",
      value6 = usesAlphaBackground(value3),
      value7 = value && !hasRunningAnimations(input),
      value8 = getElementAnimations(input);
    return () => {
      cancelAnimations(value8);
      input.dataset.flipAt = value2;
      input.style.width = `${context.width}px`;
      input.style.transform = `translateX(${context.left}px)`;
      input.style.visibility = "inherit";
      if (!value6) {
        input.style.willChange = "";
      }
      if (
        flipAt === undefined ||
        !supportsElementAnimations(input) ||
        (0, runtime.isReducedMotion)()
      ) {
        return;
      }
      if (value7) {
        return;
      }
      try {
        input.animate(
          {
            transform: [
              `translateX(${bounds.left - left}px) scaleX(${bounds.width / context.width})`,
              `translateX(${context.left}px) scaleX(1)`,
            ],
          },
          {
            duration: value4,
            easing: value5,
          },
        );
        if (value4 > 0) {
          setTransformWillChange(input, value6);
        }
      } catch {}
    };
  }
  function readCssDuration(
    input: CSSStyleDeclaration,
    options: string,
  ): number {
    let value = input.getPropertyValue(options).trim(),
      value2 = value.endsWith("ms") ? 1 : value.endsWith("s") ? 1000 : 0;
    return Math.max(0, parseFloat(value) * value2) || 0;
  }
  function supportsElementAnimations(input: Element): boolean {
    return (
      typeof input.animate === "function" &&
      typeof input.getAnimations === "function"
    );
  }
  function usesAlphaBackground(input: CSSStyleDeclaration): boolean {
    return /^rgba\(|\//.test(input.backgroundColor);
  }
  function setTransformWillChange(input: HTMLElement, options: boolean): void {
    input.style.willChange = options ? "transform" : "";
  }
  function hasRunningAnimations(input: Element): boolean {
    return (
      supportsElementAnimations(input) &&
      input
        .getAnimations()
        .some((input2: Animation) => input2.playState === "running")
    );
  }
  function getElementAnimations(input: Element): Animation[] {
    if (supportsElementAnimations(input)) {
      return input.getAnimations();
    } else {
      return [];
    }
  }
  function cancelAnimations(input: readonly Animation[]): void {
    for (let value of input) {
      value.cancel();
    }
  }
  function hasFlipAnimationMarker(input: HTMLElement): boolean {
    return input.dataset.flipAt !== undefined;
  }
  function pauseFlipAnimationAtProgress(
    input: HTMLElement,
    options: number,
    context: () => C.SegmentBounds[],
  ) {
    if (
      !Number.isFinite(options) ||
      !hasFlipAnimationMarker(input) ||
      !supportsElementAnimations(input)
    ) {
      return;
    }
    let entry = pausedFlipAnimations.get(input);
    if (entry?.playState !== "paused") {
      let value = context();
      if (
        value.length < 2 ||
        value.some((input2: C.SegmentBounds) => input2.width <= 0)
      ) {
        return;
      }
      let value2 = parseFloat(input.style.width),
        value3 = usesAlphaBackground(getComputedStyle(input));
      entry = input.animate(
        value.map((input2: C.SegmentBounds) => ({
          transform: `translateX(${input2.left}px) scaleX(${input2.width / value2})`,
        })),
        {
          duration: (value.length - 1) * FLIP_PAUSE_DURATION_MS,
          fill: "both",
        },
      );
      entry.pause();
      setTransformWillChange(input, value3);
      pausedFlipAnimations.set(input, entry);
      input.dataset.flipAt = FLIP_HELD_MARKER;
    }
    entry.currentTime = options * FLIP_PAUSE_DURATION_MS;
  }
  function isImmediateFlipMarker(input: HTMLElement): boolean {
    return input.dataset.flipAt === FLIP_HELD_MARKER;
  }
  function observeSegmentedControlSize(
    input: HTMLElement,
    options: typeof ResizeObserver,
    context: C.SegmentMeasure,
  ) {
    let value: Window = (0, runtime.getElementWindow)(input) ?? window,
      entry = segmentedControlResizeObservers.get(value);
    if (entry?.Observer !== options) {
      let entries = new Map<Element, C.SegmentMeasure>();
      entry = {
        Observer: options,
        observer: new options((input2: ResizeObserverEntry[]) => {
          let items: (() => void)[] = [];
          for (let value4 of input2) {
            let entry2 = entries.get(value4.target);
            if (entry2) {
              (0, runtime.invokeAndReportError)(() => entry2(false, items));
            }
          }
          for (let value4 of items) {
            (0, runtime.invokeAndReportError)(value4);
          }
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
  }: C.SegmentedControlProps) {
    let ref = reactForUiSegmentedControl2.useRef<HTMLDivElement>(null);
    (0, runtime.useCompactableControlDebug)(ref, "SegmentedControl");
    let ref2 = reactForUiSegmentedControl2.useRef<HTMLDivElement>(null),
      value2: boolean = (0, runtime.useHasFieldContext)(),
      value3: boolean = (0, runtime.useAppleKeyboard)(),
      ref3 = reactForUiSegmentedControl2.useRef<C.SegmentLayoutState>({
        live: false,
        poll: null,
      }),
      callback = reactForUiSegmentedControl2.useCallback(function value8(
        input = false,
        options?: (() => void)[],
      ) {
        let current = ref.current,
          current2 = ref2.current;
        if (!current || !current2) {
          return;
        }
        let element = current.querySelector<HTMLElement>("[data-checked]"),
          value9 = element ? measureScaledElementWidth(current) : null,
          value10: (() => void) | null = null;
        if (!input || !(value9?.scaled || isImmediateFlipMarker(current2))) {
          let value11 = element
            ? getRelativeSegmentBounds(element, current)
            : null;
          value10 = animateSegmentedControlThumb(current2, current, value11, {
            correction: input,
          });
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
          let value14 = scheduleElementAnimationFrame(current, () =>
            value8(true),
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
        .map((input: C.SegmentOption) => input.value)
        .join("\x00");
    reactForUiSegmentedControl2.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current,
        value8: typeof ResizeObserver | undefined = (0,
        runtime.getResizeObserverConstructor)(current),
        value9 = current !== null && value8 !== undefined,
        current3 = ref3.current;
      current3.live = true;
      if (!value9 || (current2 !== null && hasFlipAnimationMarker(current2))) {
        callback();
      }
      let value10 = value9
        ? observeSegmentedControlSize(
            current as HTMLElement,
            value8 as typeof ResizeObserver,
            callback,
          )
        : null;
      return () => {
        value10?.();
        current3.live = false;
        current3.poll?.cancel();
      };
    }, [value, variant, fullWidth, value4, callback]);
    reactForUiSegmentedControl2.useLayoutEffect(() => {
      if (!thumbPosition) {
        return;
      }
      let callback3 = (input: number | null) => {
        let current = ref.current,
          current2 = ref2.current;
        if (!current || !current2) {
          return;
        }
        if (input === null) {
          if (isImmediateFlipMarker(current2)) {
            callback();
          }
          return;
        }
        pauseFlipAnimationAtProgress(current2, input, () =>
          Array.from<HTMLElement, C.SegmentBounds>(
            current.querySelectorAll<HTMLElement>('[role="radio"]'),
            (input2: HTMLElement) => getRelativeSegmentBounds(input2, current),
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
    let callback2 = reactForUiSegmentedControl2.useCallback(
        (input: string) => {
          onChange(input);
        },
        [onChange],
      ),
      value5 = variant === "contained",
      value6: boolean = (0, runtime.useHasTooltipProvider)(),
      value7 = (
        <runtime.baseRadioGroup
          ref={ref}
          data-cds={"SegmentedControl"}
          aria-label={ariaLabel}
          aria-required={ariaRequired}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          value={value}
          onValueChange={callback2}
          disabled={disabled}
          {...(0, runtime.getControlSizeAttributes)(size)}
          className={(0, runtime.cn)(
            "relative inline-flex",
            fullWidth ? "w-full" : "w-fit",
            "shrink-0 items-stretch h-control font-sans",
            value5
              ? "rounded bg-[var(--cds-segmented-control-track)] p-px"
              : "gap-[1px]",
            className,
          )}
        >
          {[
            <div
              aria-hidden={true}
              className={`pointer-events-none absolute inset-0 overflow-clip ${value5 ? "rounded" : ""}`}
            >
              <div
                ref={ref2}
                className={`${segmentedControlThumbClasses} ${value5 ? containedSegmentThumbClasses : ghostSegmentThumbClasses}`}
              />
            </div>,
            segments.map((input: C.SegmentOption) => {
              let value8 = input.icon && input.label === undefined,
                value9 = value8
                  ? (input.tooltip ?? String(input.value))
                  : input.tooltip,
                value10 =
                  typeof input.tooltip === "string"
                    ? input.tooltip
                    : String(input.value),
                value11 = input.icon ? (
                  <runtime.Icon name={input.icon} size={"auto"} />
                ) : null,
                value12 = (
                  <runtime.baseRadio.Root
                    value={input.value}
                    disabled={input.disabled}
                    aria-label={value8 ? value10 : undefined}
                    aria-keyshortcuts={
                      input.shortcut
                        ? (0, runtime.shortcutToAriaKeyShortcuts)(
                            input.shortcut,
                            value3,
                          )
                        : undefined
                    }
                    onMouseDown={(0,
                    runtime.withRepeatedClickSelectionPrevention)(undefined)}
                    className={`${segmentedControlSegmentClasses} ${value5 ? segmentedControlTextClasses : ghostSegmentHoverClasses} ${value8 ? segmentedControlIconAspectClasses : segmentedControlTextPaddingClasses}${fullWidth ? " flex-1" : ""}`}
                  >
                    {[
                      value11 && input.indicator ? (
                        <span className={"grid"}>
                          {[
                            <span
                              className={
                                "col-start-1 row-start-1 [--seg-dot-r:calc(0.1875rem*var(--cds-rem-scale,1))] [--seg-dot-x:calc(100%_-_var(--seg-dot-r)_+_1px)] [&:dir(rtl)]:[--seg-dot-x:calc(var(--seg-dot-r)_-_1px)] not-forced-colors:has-[~[data-cds-part=indicator]>*]:[mask-image:radial-gradient(circle_at_var(--seg-dot-x)_calc(var(--seg-dot-r)_-_1px),transparent_calc(var(--seg-dot-r)_+_2px),black_calc(var(--seg-dot-r)_+_2.5px))]"
                              }
                            >
                              {value11}
                            </span>,
                            <span
                              aria-hidden={true}
                              data-cds-part={"indicator"}
                              className={
                                "relative col-start-1 row-start-1 -me-px -mt-px self-start justify-self-end has-[>[data-cds=Pulse]]:[--cds-page-bg:transparent]"
                              }
                            >
                              {input.indicator}
                            </span>,
                          ]}
                        </span>
                      ) : (
                        value11
                      ),
                      input.label,
                    ]}
                  </runtime.baseRadio.Root>
                ),
                value13 =
                  input.disabled && !!input.disabledReason ? (
                    <runtime.DisabledReasonTooltip
                      reason={input.disabledReason}
                      side={tooltipSide}
                      hoverable={false}
                      wrapperClassName={
                        fullWidth
                          ? `${segmentedControlVisualLayerClasses} ${value8 ? segmentedControlFullWidthItemClasses : segmentedControlFlexibleItemClasses}`
                          : segmentedControlVisualLayerClasses
                      }
                    >
                      {value12}
                    </runtime.DisabledReasonTooltip>
                  ) : value9 !== undefined ? (
                    <runtime.Tooltip
                      content={value9}
                      detail={input.tooltipDetail}
                      shortcut={input.shortcut}
                      side={tooltipSide}
                      hoverable={input.tooltipHoverable ?? false}
                      className={tooltipClassName}
                    >
                      {value12}
                    </runtime.Tooltip>
                  ) : (
                    value12
                  );
              if (value2) {
                return (() => {
                  const _Element = runtime.baseLabelableProvider;
                  const _elementProps = {
                    children: value13,
                  };
                  const _elementKey = input.value;
                  return <_Element key={_elementKey} {..._elementProps} />;
                })();
              } else {
                return (() => {
                  const _Element2 = reactForUiSegmentedControl2.Fragment;
                  const _elementProps2 = {
                    children: value13,
                  };
                  const _elementKey2 = input.value;
                  return <_Element2 key={_elementKey2} {..._elementProps2} />;
                })();
              }
            }),
          ]}
        </runtime.baseRadioGroup>
      );
    if (value6) {
      return value7;
    } else {
      return <runtime.TooltipProvider>{value7}</runtime.TooltipProvider>;
    }
  }
  function getRelativeSegmentBounds(input: HTMLElement, options: HTMLElement) {
    let bounds = options.getBoundingClientRect(),
      value = getUnscaledBorderBoxWidth(options),
      value2 = Math.abs(bounds.width - value) < 0.01 ? 1 : bounds.width / value;
    if (!(value2 > 0) || !Number.isFinite(value2)) {
      return {
        left: input.offsetLeft,
        width: input.offsetWidth,
      };
    }
    let bounds2 = input.getBoundingClientRect(),
      value3: number =
        (0, runtime.getElementWindow)(options)?.devicePixelRatio || 1,
      callback = (input2: number) => Math.round(input2 * value3) / value3;
    return {
      left: (callback(bounds2.left) - callback(bounds.left)) / value2,
      width: (callback(bounds2.right) - callback(bounds2.left)) / value2,
    };
  }
  function measureScaledElementWidth(input: HTMLElement): C.SegmentWidth {
    let width = input.getBoundingClientRect().width;
    return {
      width: width,
      scaled:
        input.offsetWidth > 0 &&
        Math.abs(width - getUnscaledBorderBoxWidth(input)) >= 0.01,
    };
  }
  function scheduleElementAnimationFrame(
    input: HTMLElement,
    options: FrameRequestCallback,
  ) {
    let value: Window | undefined = (0, runtime.getConnectedElementWindow)(
      input,
    );
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
  function getUnscaledBorderBoxWidth(input: HTMLElement): number {
    let style: CSSStyleDeclaration = (
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
  function currencyDisplayParts(
    currency: string,
    locale?: Intl.LocalesArgument,
  ): C.CurrencyDisplayParts {
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
          (input: Intl.NumberFormatPart) => input.type === "currency",
        ),
        value4 = value2[value3];
      if (value4 === undefined) {
        return {
          symbol: value,
          side: "start",
        };
      }
      let value5: "start" | "end" = value2
        .slice(0, value3)
        .some((input: Intl.NumberFormatPart) =>
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
  bindRuntimeValue(
    runtime,
    "reactForUiSegmentedControl",
    () => reactForUiSegmentedControl,
    (value) => {
      reactForUiSegmentedControl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxX_",
    () => jsxX_,
    (value) => {
      jsxX_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_DRAG_THRESHOLD_PX",
    () => RESIZE_DRAG_THRESHOLD_PX,
    (value) => {
      RESIZE_DRAG_THRESHOLD_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_KEYBOARD_STEP_PX",
    () => RESIZE_KEYBOARD_STEP_PX,
    (value) => {
      RESIZE_KEYBOARD_STEP_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_KEYBOARD_LARGE_STEP_PX",
    () => RESIZE_KEYBOARD_LARGE_STEP_PX,
    (value) => {
      RESIZE_KEYBOARD_LARGE_STEP_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resizeHandleSideClasses",
    () => resizeHandleSideClasses,
    (value) => {
      resizeHandleSideClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ResizeHandle",
    () => ResizeHandle,
    (value) => {
      ResizeHandle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noopFlipCleanup",
    () => noopFlipCleanup,
    (value) => {
      noopFlipCleanup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animateSegmentedControlThumb",
    () => animateSegmentedControlThumb,
  );
  bindRuntimeValue(runtime, "readCssDuration", () => readCssDuration);
  bindRuntimeValue(
    runtime,
    "supportsElementAnimations",
    () => supportsElementAnimations,
  );
  bindRuntimeValue(runtime, "usesAlphaBackground", () => usesAlphaBackground);
  bindRuntimeValue(
    runtime,
    "setTransformWillChange",
    () => setTransformWillChange,
  );
  bindRuntimeValue(runtime, "hasRunningAnimations", () => hasRunningAnimations);
  bindRuntimeValue(runtime, "getElementAnimations", () => getElementAnimations);
  bindRuntimeValue(runtime, "cancelAnimations", () => cancelAnimations);
  bindRuntimeValue(
    runtime,
    "hasFlipAnimationMarker",
    () => hasFlipAnimationMarker,
  );
  bindRuntimeValue(
    runtime,
    "FLIP_HELD_MARKER",
    () => FLIP_HELD_MARKER,
    (value) => {
      FLIP_HELD_MARKER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FLIP_PAUSE_DURATION_MS",
    () => FLIP_PAUSE_DURATION_MS,
    (value) => {
      FLIP_PAUSE_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pausedFlipAnimations",
    () => pausedFlipAnimations,
    (value) => {
      pausedFlipAnimations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pauseFlipAnimationAtProgress",
    () => pauseFlipAnimationAtProgress,
  );
  bindRuntimeValue(
    runtime,
    "isImmediateFlipMarker",
    () => isImmediateFlipMarker,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiSegmentedControl2",
    () => reactForUiSegmentedControl2,
    (value) => {
      reactForUiSegmentedControl2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiSegmentedControl",
    () => jsxForUiSegmentedControl,
    (value) => {
      jsxForUiSegmentedControl = value;
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
  bindRuntimeValue(runtime, "currencyDisplayParts", () => currencyDisplayParts);
  return () => {
    (0, runtime.initializeIsomorphicLayoutEffect)();
    (0, runtime.initializeClassNames)();
    reactForUiSegmentedControl = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxX_ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    RESIZE_DRAG_THRESHOLD_PX = 3;
    RESIZE_KEYBOARD_STEP_PX = 8;
    RESIZE_KEYBOARD_LARGE_STEP_PX = 32;
    resizeHandleSideClasses = {
      "inline-start":
        "inset-y-0 start-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
      "inline-end":
        "inset-y-0 end-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
      top: "inset-x-0 top-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
      bottom:
        "inset-x-0 bottom-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
    };
    ResizeHandle = reactForUiSegmentedControl.forwardRef(function (
      {
        orientation = "vertical",
        side: side,
        onResize: onResize,
        onResizeStart: onResizeStart,
        onResizeEnd: onResizeEnd,
        onMouseDown: onMouseDown,
        onKeyDown: onKeyDown,
        className: className,
        ...props
      }: C.ResizeHandleProps,
      options: React.ForwardedRef<HTMLDivElement>,
    ) {
      let value =
          side === undefined
            ? orientation === "vertical"
            : side === "inline-start" || side === "inline-end",
        [value2, value3] = reactForUiSegmentedControl.useState(false),
        ref = reactForUiSegmentedControl.useRef<Document>(null),
        ref2 = reactForUiSegmentedControl.useRef(onResize),
        ref3 = reactForUiSegmentedControl.useRef(onResizeStart),
        ref4 = reactForUiSegmentedControl.useRef(onResizeEnd);
      (0, runtime.useIsomorphicLayoutEffect)(() => {
        ref2.current = onResize;
        ref3.current = onResizeStart;
        ref4.current = onResizeEnd;
      }, [onResize, onResizeStart, onResizeEnd]);
      let ref5 = reactForUiSegmentedControl.useRef(0),
        ref6 = reactForUiSegmentedControl.useRef(false),
        ref7 = reactForUiSegmentedControl.useRef(true),
        callback = reactForUiSegmentedControl.useCallback(() => {
          if (ref7.current) {
            return;
          }
          ref7.current = true;
          value3(false);
          ref4.current?.(ref6.current);
        }, []);
      reactForUiSegmentedControl.useEffect(() => {
        let current = ref.current;
        if (!value2 || current === null) {
          return;
        }
        let callback4 = (input: MouseEvent) => {
            let value4 = (value ? input.clientX : input.clientY) - ref5.current;
            if (Math.abs(value4) > RESIZE_DRAG_THRESHOLD_PX) {
              ref6.current = true;
            }
            ref2.current(value4);
          },
          style = current.body.style;
        style.cursor = value ? "col-resize" : "row-resize";
        style.userSelect = "none";
        current.addEventListener("mousemove", callback4);
        current.addEventListener("mouseup", callback);
        return () => {
          current.removeEventListener("mousemove", callback4);
          current.removeEventListener("mouseup", callback);
          style.cursor = "";
          style.userSelect = "";
        };
      }, [value2, value, callback]);
      reactForUiSegmentedControl.useEffect(() => callback, [callback]);
      let callback2 = (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.button === 0) {
            event.preventDefault();
            ref5.current = value ? event.clientX : event.clientY;
            ref6.current = false;
            ref7.current = false;
            ref.current = event.currentTarget.ownerDocument;
            value3(true);
            ref3.current?.();
          }
          onMouseDown?.(event);
        },
        callback3 = (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.metaKey || event.ctrlKey || event.altKey || !ref7.current) {
            return;
          }
          if ((event.key === "Enter" || event.key === " ") && !event.shiftKey) {
            event.preventDefault();
            if (event.repeat) {
              return;
            }
            ref3.current?.();
            ref4.current?.(false);
            return;
          }
          let value4 = event.shiftKey
              ? RESIZE_KEYBOARD_LARGE_STEP_PX
              : RESIZE_KEYBOARD_STEP_PX,
            [value5, value6] = value
              ? ["ArrowLeft", "ArrowRight"]
              : ["ArrowUp", "ArrowDown"],
            value7 =
              event.key === value5
                ? -value4
                : event.key === value6
                  ? value4
                  : 0;
          if (value7 === 0) {
            return;
          }
          event.preventDefault();
          ref3.current?.();
          ref2.current(value7);
          ref4.current?.(true);
        };
      return (
        <div
          {...props}
          ref={options}
          data-cds={"ResizeHandle"}
          role={"separator"}
          aria-orientation={value ? "vertical" : "horizontal"}
          tabIndex={0}
          data-dragging={value2 ? "" : undefined}
          onMouseDown={callback2}
          onKeyDown={(input: React.KeyboardEvent<HTMLDivElement>) => {
            callback3(input);
            onKeyDown?.(input);
          }}
          className={(0, runtime.cn)(
            "cds-reset group/resize outline-none focus-visible:outline-hidden",
            value ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize",
            side === undefined
              ? ["relative", value ? "h-full" : "w-full"]
              : ["absolute", resizeHandleSideClasses[side]],
            className,
          )}
        >
          {[
            <div
              aria-hidden={true}
              className={(0, runtime.clsx)(
                "absolute rounded-full transition-shadow duration-fast group-focus-visible/resize:shadow-focus",
                value
                  ? "inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize"
                  : "inset-x-0 top-1/2 h-3 -translate-y-1/2 cursor-row-resize",
              )}
            />,
            <div
              aria-hidden={true}
              data-cds-part={"resize-pill"}
              className={(0, runtime.clsx)(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-[opacity,color,background-color]",
                value
                  ? "h-full max-h-12 w-[3px] group-focus-visible/resize:max-h-none"
                  : "h-[3px] w-full max-w-12 group-focus-visible/resize:max-w-none",
                value2
                  ? "text-secondary opacity-100 duration-snap"
                  : "text-muted opacity-[var(--cds-resize-pill-force,0)] delay-200 duration-base group-hover/resize:opacity-100",
                "group-focus-visible/resize:bg-fill-accent group-focus-visible/resize:opacity-100 group-focus-visible/resize:delay-0",
              )}
            />,
          ]}
        </div>
      );
    });
    (0, runtime.initializeErrorReporting)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeElementWindow)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeIconSupport)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeShortcuts)();
    (0, runtime.initializeTooltip)();
    (0, runtime.initializeReducedMotion)();
    noopFlipCleanup = () => {
      return;
    };
    FLIP_HELD_MARKER = "held";
    FLIP_PAUSE_DURATION_MS = 1000;
    pausedFlipAnimations = new WeakMap();
    reactForUiSegmentedControl2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiSegmentedControl = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
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
    segmentedControlResizeObservers = new WeakMap();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeClickToFocus)();
    (0, runtime.initializeMergedRefs)();
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
  };
}

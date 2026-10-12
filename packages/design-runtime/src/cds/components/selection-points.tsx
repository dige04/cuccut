/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsSelectionPoints(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsSelectionPoints: Dynamic;
  var jsxComponentsSelectionPoints: Dynamic;
  var ComponentsSelectionPointsLimit: Dynamic;
  var ComponentsSelectionPointsConstant: Dynamic;
  var ComponentsSelectionPointsConstant_2: Dynamic;
  var ComponentsSelectionPointsInlineStartInlineEndTopConfig: Dynamic;
  var ComponentsSelectionPointsComponent: Dynamic;
  var initializeComponentsSelectionPoints: Dynamic;
  function SegmentedControl({
    segments: segments,
    value: value,
    onChange: onChange,
    variant = "contained",
    size: size,
    fullWidth = false,
    disabled: disabled2,
    tooltipSide: tooltipSide,
    tooltipClassName: tooltipClassName,
    "aria-label": ariaLabel,
    "aria-required": ariaRequired,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedby,
    thumbPosition: thumbPosition,
    className: className,
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.reactComponentsSelectionRing.useRef)(
      null,
    );
    (0, runtime.useButtonAnimation)(value2, "SegmentedControl");
    let value3: Dynamic = (0, runtime.reactComponentsSelectionRing.useRef)(
        null,
      ),
      value4: Dynamic = (0, runtime.isInsideField)(),
      value5: Dynamic = (0, runtime.reactComponentsSelectionRing.useRef)({
        live: false,
        poll: null,
      }),
      value6: Dynamic = (0, runtime.reactComponentsSelectionRing.useCallback)(
        function value12(input: Dynamic = false): Dynamic {
          let current: Dynamic = value2.current,
            current2: Dynamic = value3.current;
          if (!current || !current2) return;
          let element: Dynamic = current.querySelector("[data-checked]"),
            value13: Dynamic = element ? scaledContainerWidth(current) : null;
          if (
            !input ||
            !(value13?.scaled || (0, runtime.isFlipIndicatorEntering)(current2))
          ) {
            let value18: Dynamic = element
              ? relativeIndicatorBounds(element, current)
              : null;
            (0, runtime.animateFlipIndicator)(current2, current, value18, {
              correction: input,
            });
          }
          if (!value5.current.live) return;
          let poll: Dynamic = value5.current.poll;
          poll?.cancel();
          value5.current.poll = null;
          if (!value13 || (!input && !poll && !value13.scaled)) return;
          let {
            width: value14,
            still: value15,
            frames: value16,
          }: Dynamic = poll ?? {
            width: value13.width,
            still: 0,
            frames: 0,
          };
          if (
            input &&
            ((value15 = value14 === value13.width ? value15 + 1 : 0),
            (value14 = value13.width),
            (value16 += 1),
            value15 >=
              (value13.scaled
                ? runtime.ComponentsSelectionRingConstant
                : runtime.ComponentsSelectionRingConstant_2) ||
              value16 >= runtime.ComponentsSelectionRingLimit)
          )
            return;
          let value17: Dynamic = requestElementAnimationFrame(
            current,
            (): Dynamic => value12(true),
          );
          value17 &&
            (value5.current.poll = {
              cancel: value17,
              width: value14,
              still: value15,
              frames: value16,
            });
        },
        [],
      ),
      value7: Dynamic = segments
        .map((input?: Dynamic): Dynamic => input.value)
        .join("\0");
    (0, runtime.reactComponentsSelectionRing.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = value2.current,
        current2: Dynamic = value3.current,
        value12: Dynamic = (0, runtime.getResizeObserver)(current),
        value13: Dynamic = current !== null && value12 !== undefined,
        current3: Dynamic = value5.current;
      current3.live = true;
      (!value13 ||
        (current2 !== null && (0, runtime.hasFlipAnimation)(current2))) &&
        value6();
      let value14: Dynamic = null;
      value13 &&
        ((value14 = new value12((): Dynamic => value6())),
        value14.observe(current));
      return (): Dynamic => {
        value14?.disconnect();
        current3.live = false;
        current3.poll?.cancel();
      };
    }, [value, variant, fullWidth, value7, value6]);
    (0, runtime.reactComponentsSelectionRing.useLayoutEffect)((): Dynamic => {
      if (!thumbPosition) return;
      let callback: Dynamic = (input?: Dynamic): Dynamic => {
        let current: Dynamic = value2.current,
          current2: Dynamic = value3.current;
        if (!(!current || !current2)) {
          if (input === null) {
            (0, runtime.isFlipIndicatorEntering)(current2) && value6();
            return;
          }
          (0, runtime.seekFlipAnimation)(
            current2,
            input,
            (): Dynamic =>
              Array.from(
                current.querySelectorAll('[role="radio"]'),
                (input2?: Dynamic): Dynamic =>
                  relativeIndicatorBounds(input2, current),
              ),
          );
        }
      };
      callback(thumbPosition.get());
      let value12: Dynamic = thumbPosition.on("change", callback);
      return (): Dynamic => {
        value12();
        callback(null);
      };
    }, [thumbPosition, value6]);
    let value8: Dynamic = (0, runtime.reactComponentsSelectionRing.useCallback)(
        (input?: Dynamic): Dynamic => {
          onChange(input);
        },
        [onChange],
      ),
      value9: Dynamic = variant === "contained",
      value10: Dynamic = (0, runtime.useTooltipGroup)(),
      value11: Dynamic = (
        <runtime.npm_RadioGroup_uF
          ref={value2}
          data-cds={"SegmentedControl"}
          aria-label={ariaLabel}
          aria-required={ariaRequired}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          value={value}
          onValueChange={value8}
          disabled={disabled2}
          {...(0, runtime.getSizeAttribute)(size)}
          className={(0, runtime.cn)(
            "relative inline-flex",
            fullWidth ? "w-full" : "w-fit",
            "shrink-0 items-stretch h-control font-sans",
            value9
              ? "rounded bg-[var(--cds-segmented-control-track)] p-px"
              : "gap-[1px]",
            className,
          )}
        >
          <div
            aria-hidden={true}
            className={`pointer-events-none absolute inset-0 overflow-clip ${value9 ? "rounded" : ""}`}
          >
            <div
              ref={value3}
              className={`${runtime.ComponentsSelectionRingClassNames_5} ${value9 ? runtime.ComponentsSelectionRingLabel_2 : runtime.ComponentsSelectionRingClassNames_6}`}
            />
          </div>
          {segments.map((input?: Dynamic): Dynamic => {
            let value12: Dynamic = input.icon && input.label === undefined,
              value13: Dynamic = value12
                ? (input.tooltip ?? String(input.value))
                : input.tooltip,
              value14: Dynamic =
                typeof input.tooltip == "string"
                  ? input.tooltip
                  : String(input.value),
              value15: Dynamic = input.icon ? (
                <runtime.Icon name={input.icon} size={"auto"} />
              ) : null,
              value16: Dynamic = (
                <runtime.npm_Radio_iP.Root
                  value={input.value}
                  disabled={input.disabled}
                  aria-label={value12 ? value14 : undefined}
                  onMouseDown={(0, runtime.withSelectionPrevention)(undefined)}
                  className={`${runtime.selectionRingClasses} ${value9 ? runtime.ComponentsSelectionRingClassNames_3 : runtime.ComponentsSelectionRingClassNames_4} ${value12 ? runtime.AspectSquareValue : runtime.ComponentsSelectionRingClassNames}${fullWidth ? " flex-1" : ""}`}
                >
                  {value15 && input.indicator ? (
                    <span className={"grid"}>
                      <span
                        className={
                          "col-start-1 row-start-1 [--seg-dot-r:calc(0.1875rem*var(--cds-rem-scale,1))] [--seg-dot-x:calc(100%_-_var(--seg-dot-r)_+_1px)] [&:dir(rtl)]:[--seg-dot-x:calc(var(--seg-dot-r)_-_1px)] not-forced-colors:has-[~[data-cds-part=indicator]>*]:[mask-image:radial-gradient(circle_at_var(--seg-dot-x)_calc(var(--seg-dot-r)_-_1px),transparent_calc(var(--seg-dot-r)_+_2px),black_calc(var(--seg-dot-r)_+_2.5px))]"
                        }
                      >
                        {value15}
                      </span>
                      <span
                        aria-hidden={true}
                        data-cds-part={"indicator"}
                        className={
                          "relative col-start-1 row-start-1 -me-px -mt-px self-start justify-self-end has-[>[data-cds=Pulse]]:[--cds-page-bg:transparent]"
                        }
                      >
                        {input.indicator}
                      </span>
                    </span>
                  ) : (
                    value15
                  )}
                  {input.label}
                </runtime.npm_Radio_iP.Root>
              ),
              value17: Dynamic =
                input.disabled && input.disabledReason ? (
                  <runtime.DisabledReasonTooltip
                    reason={input.disabledReason}
                    side={tooltipSide}
                    hoverable={false}
                    wrapperClassName={
                      fullWidth
                        ? `${runtime.HFullValue} ${value12 ? runtime.ComponentsSelectionRingClassNames_2 : runtime.ComponentsSelectionRingLabel}`
                        : runtime.HFullValue
                    }
                  >
                    {value16}
                  </runtime.DisabledReasonTooltip>
                ) : value13 !== undefined ? (
                  <runtime.Tooltip
                    content={value13}
                    detail={input.tooltipDetail}
                    shortcut={input.shortcut}
                    side={tooltipSide}
                    hoverable={input.tooltipHoverable ?? false}
                    className={tooltipClassName}
                  >
                    {value16}
                  </runtime.Tooltip>
                ) : (
                  value16
                );
            return value4
              ? (() => {
                  const _Component = runtime.npm_LabelableProvider_NR;
                  const _props = {
                    children: value17,
                  } as const;
                  const _key = input.value;
                  return <_Component key={_key} {..._props} />;
                })()
              : (() => {
                  const _Component2 =
                    runtime.reactComponentsSelectionRing.Fragment;
                  const _props2 = {
                    children: value17,
                  } as const;
                  const _key2 = input.value;
                  return <_Component2 key={_key2} {..._props2} />;
                })();
          })}
        </runtime.npm_RadioGroup_uF>
      );
    return value10 ? (
      value11
    ) : (
      <runtime.TooltipGroup>{value11}</runtime.TooltipGroup>
    );
  }
  function relativeIndicatorBounds(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let bounds: Dynamic = options.getBoundingClientRect(),
      value: Dynamic = elementBorderBoxWidth(options),
      value2: Dynamic =
        Math.abs(bounds.width - value) < 0.01 ? 1 : bounds.width / value;
    if (!(value2 > 0) || !Number.isFinite(value2))
      return {
        left: input.offsetLeft,
        width: input.offsetWidth,
      };
    let bounds2: Dynamic = input.getBoundingClientRect(),
      value3: Dynamic =
        (0, runtime.getOwnerWindow)(options)?.devicePixelRatio || 1,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round(input2 * value3) / value3;
    return {
      left: (callback(bounds2.left) - callback(bounds.left)) / value2,
      width: (callback(bounds2.right) - callback(bounds2.left)) / value2,
    };
  }
  function scaledContainerWidth(input?: Dynamic): Dynamic {
    let width: Dynamic = input.getBoundingClientRect().width;
    return {
      width: width,
      scaled:
        input.offsetWidth > 0 &&
        Math.abs(width - elementBorderBoxWidth(input)) >= 0.01,
    };
  }
  function requestElementAnimationFrame(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.getConnectedOwnerWindow)(input);
    if (!value || typeof value.requestAnimationFrame != "function") return null;
    let value2: Dynamic = value.requestAnimationFrame(options);
    return (): Dynamic => {
      try {
        value.cancelAnimationFrame(value2);
      } catch {}
    };
  }
  function elementBorderBoxWidth(input?: Dynamic): Dynamic {
    let style: Dynamic = (
        (0, runtime.getOwnerWindow)(input) ?? window
      ).getComputedStyle(input),
      value: Dynamic = parseFloat(style.width);
    return style.boxSizing === "border-box"
      ? value
      : value +
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.borderRightWidth);
  }
  bindRuntimeValue(
    runtime,
    "reactComponentsSelectionPoints",
    () => reactComponentsSelectionPoints,
    (value) => {
      reactComponentsSelectionPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsSelectionPoints",
    () => jsxComponentsSelectionPoints,
    (value) => {
      jsxComponentsSelectionPoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionPointsLimit",
    () => ComponentsSelectionPointsLimit,
    (value) => {
      ComponentsSelectionPointsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionPointsConstant",
    () => ComponentsSelectionPointsConstant,
    (value) => {
      ComponentsSelectionPointsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionPointsConstant_2",
    () => ComponentsSelectionPointsConstant_2,
    (value) => {
      ComponentsSelectionPointsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionPointsInlineStartInlineEndTopConfig",
    () => ComponentsSelectionPointsInlineStartInlineEndTopConfig,
    (value) => {
      ComponentsSelectionPointsInlineStartInlineEndTopConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsSelectionPointsComponent",
    () => ComponentsSelectionPointsComponent,
    (value) => {
      ComponentsSelectionPointsComponent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsSelectionPoints",
    () => initializeComponentsSelectionPoints,
    (value) => {
      initializeComponentsSelectionPoints = value;
    },
  );
  bindRuntimeValue(runtime, "SegmentedControl", () => SegmentedControl);
  bindRuntimeValue(
    runtime,
    "relativeIndicatorBounds",
    () => relativeIndicatorBounds,
  );
  bindRuntimeValue(runtime, "scaledContainerWidth", () => scaledContainerWidth);
  bindRuntimeValue(
    runtime,
    "requestElementAnimationFrame",
    () => requestElementAnimationFrame,
  );
  bindRuntimeValue(
    runtime,
    "elementBorderBoxWidth",
    () => elementBorderBoxWidth,
  );
  return () => {
    initializeComponentsSelectionPoints = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeHooksLayoutEffect)();
        (0, runtime.initializeClassNames)();
        reactComponentsSelectionPoints = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        (0, runtime.initializeNpm_clsx_xh)();
        jsxComponentsSelectionPoints = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        ComponentsSelectionPointsLimit = 3;
        ComponentsSelectionPointsConstant = 8;
        ComponentsSelectionPointsConstant_2 = 32;
        ComponentsSelectionPointsInlineStartInlineEndTopConfig = {
          "inline-start":
            "inset-y-0 start-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
          "inline-end":
            "inset-y-0 end-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
          top: "inset-x-0 top-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
          bottom:
            "inset-x-0 bottom-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
        };
        ComponentsSelectionPointsComponent = (0,
        reactComponentsSelectionPoints.forwardRef)(function (
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
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic {
          let value: Dynamic =
              side === undefined
                ? orientation === "vertical"
                : side === "inline-start" || side === "inline-end",
            [value2, value3]: Dynamic = (0,
            reactComponentsSelectionPoints.useState)(false),
            value4: Dynamic = (0, reactComponentsSelectionPoints.useRef)(
              onResize,
            ),
            value5: Dynamic = (0, reactComponentsSelectionPoints.useRef)(
              onResizeStart,
            ),
            value6: Dynamic = (0, reactComponentsSelectionPoints.useRef)(
              onResizeEnd,
            );
          (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
            value4.current = onResize;
            value5.current = onResizeStart;
            value6.current = onResizeEnd;
          }, [onResize, onResizeStart, onResizeEnd]);
          let value7: Dynamic = (0, reactComponentsSelectionPoints.useRef)(0),
            value8: Dynamic = (0, reactComponentsSelectionPoints.useRef)(false),
            value9: Dynamic = (0, reactComponentsSelectionPoints.useRef)(true),
            value10: Dynamic = (0,
            reactComponentsSelectionPoints.useCallback)((): Dynamic => {
              value9.current ||
                ((value9.current = true),
                value3(false),
                value6.current?.(value8.current));
            }, []);
          (0, reactComponentsSelectionPoints.useEffect)((): Dynamic => {
            if (!value2) return;
            let callback3: Dynamic = (input?: Dynamic): Dynamic => {
                let value11: Dynamic =
                  (value ? input.clientX : input.clientY) - value7.current;
                Math.abs(value11) > ComponentsSelectionPointsLimit &&
                  (value8.current = true);
                value4.current(value11);
              },
              style: Dynamic = (document as Dynamic).body.style;
            style.cursor = value ? "col-resize" : "row-resize";
            style.userSelect = "none";
            (document as Dynamic).addEventListener("mousemove", callback3);
            (document as Dynamic).addEventListener("mouseup", value10);
            return (): Dynamic => {
              (document as Dynamic).removeEventListener("mousemove", callback3);
              (document as Dynamic).removeEventListener("mouseup", value10);
              style.cursor = "";
              style.userSelect = "";
            };
          }, [value2, value, value10]);
          (0, reactComponentsSelectionPoints.useEffect)(
            (): Dynamic => value10,
            [value10],
          );
          let callback: Dynamic = (event?: Dynamic): Dynamic => {
              event.button === 0 &&
                (event.preventDefault(),
                (value7.current = value ? event.clientX : event.clientY),
                (value8.current = false),
                (value9.current = false),
                value3(true),
                value5.current?.());
              onMouseDown?.(event);
            },
            callback2: Dynamic = (event?: Dynamic): Dynamic => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                !value9.current
              )
                return;
              if (
                (event.key === "Enter" || event.key === " ") &&
                !event.shiftKey
              ) {
                event.preventDefault();
                if (event.repeat) return;
                value5.current?.();
                value6.current?.(false);
                return;
              }
              let value11: Dynamic = event.shiftKey
                  ? ComponentsSelectionPointsConstant_2
                  : ComponentsSelectionPointsConstant,
                [value12, value13]: Dynamic = value
                  ? ["ArrowLeft", "ArrowRight"]
                  : ["ArrowUp", "ArrowDown"],
                value14: Dynamic =
                  event.key === value12
                    ? -value11
                    : event.key === value13
                      ? value11
                      : 0;
              value14 !== 0 &&
                (event.preventDefault(),
                value5.current?.(),
                value4.current(value14),
                value6.current?.(true));
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
              onMouseDown={callback}
              onKeyDown={(input?: Dynamic): Dynamic => {
                callback2(input);
                onKeyDown?.(input);
              }}
              className={(0, runtime.cn)(
                "cds-reset group/resize outline-none focus-visible:outline-hidden",
                value ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize",
                side === undefined
                  ? ["relative", value ? "h-full" : "w-full"]
                  : [
                      "absolute",
                      ComponentsSelectionPointsInlineStartInlineEndTopConfig[
                        side
                      ],
                    ],
                className,
              )}
            >
              <div
                aria-hidden={true}
                className={(0, runtime.npm_clsx_Ea)(
                  "absolute rounded-full transition-shadow duration-fast group-focus-visible/resize:shadow-focus",
                  value
                    ? "inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize"
                    : "inset-x-0 top-1/2 h-3 -translate-y-1/2 cursor-row-resize",
                )}
              />
              <div
                aria-hidden={true}
                data-cds-part={"resize-pill"}
                className={(0, runtime.npm_clsx_Ea)(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-[opacity,color,background-color]",
                  value
                    ? "h-full max-h-12 w-[3px] group-focus-visible/resize:max-h-none"
                    : "h-[3px] w-full max-w-12 group-focus-visible/resize:max-w-none",
                  value2
                    ? "text-secondary opacity-100 duration-snap"
                    : "text-muted opacity-[var(--cds-resize-pill-force,0)] delay-200 duration-base group-hover/resize:opacity-100",
                  "group-focus-visible/resize:bg-fill-accent group-focus-visible/resize:opacity-100 group-focus-visible/resize:delay-0",
                )}
              />
            </div>
          );
        });
      },
    );
  };
}

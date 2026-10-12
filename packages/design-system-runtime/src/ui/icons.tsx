/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiIcons(runtime: RuntimeBindings): () => void {
  var reactForUiIcons: typeof React;
  var REACT_MEMO_SYMBOL: symbol;
  var REACT_FORWARD_REF_SYMBOL: symbol;
  var pictogramCardRadiusClass: string;
  var leadingIconInsetClasses: Record<"glyph" | "text", string>;
  var leadingIconOutsetClasses: Record<"glyph" | "text", string>;
  var leadingGlyphOutsetClass: string;
  var trailingIconOutsetClasses: Record<"glyph" | "text", string>;
  var trailingGlyphOutsetClass: string;
  var leadingIconSpacingClasses: Record<"glyph" | "text", string>;
  var leadingGlyphSpacingClass: string;
  var reactZQ: typeof React;
  var jsxForUiIcons: typeof import("react/jsx-runtime");
  var calloutSizeByDensity: Record<C.Density, C.ControlSize>;
  var CALLOUT_PICTOGRAM_SIZE: number;
  var calloutVariantClasses: Record<"neutral" | "warning" | "danger", string>;
  var calloutTextClasses: Record<"neutral" | "warning" | "danger", string>;
  var calloutDefaultIcons: Record<"neutral" | "warning" | "danger", string>;
  var reactForUiIcons2: typeof React;
  var jsxGP: typeof import("react/jsx-runtime");
  function isPictogramElement(input: React.ReactNode): boolean {
    if (
      !reactForUiIcons.isValidElement(input) ||
      typeof input.type === "string"
    ) {
      return false;
    }
    return isPictogramComponent(input.type as C.PictogramComponent);
  }
  function isPictogramComponent(
    input: C.PictogramComponent | null | undefined,
  ): boolean {
    let value = input;
    for (
      let index = 0;
      index < 4 && value !== null && value !== undefined;
      index++
    ) {
      if (value.isCdsPictogram === true) {
        return true;
      }
      let value2 = value;
      if (value2.$$typeof === REACT_MEMO_SYMBOL) {
        value = value2.type;
      } else if (value2.$$typeof === REACT_FORWARD_REF_SYMBOL) {
        value = value2.render;
      } else {
        return false;
      }
    }
    return false;
  }
  function Callout({
    variant: variant,
    icon: icon,
    action: action,
    actionAlign = "first-line",
    details: details,
    defaultDetailsOpen = false,
    detailsOpen: detailsOpen,
    onDetailsOpenChange: onDetailsOpenChange,
    onDismiss: onDismiss,
    dismissLabel: dismissLabel,
    role: role,
    composerCalibration: composerCalibration,
    className: className,
    "data-testid": dataTestid,
    children: children,
  }: C.CalloutProps) {
    let value: string = (0, runtime.useTranslation)("dismiss", "Dismiss"),
      value2 = dismissLabel ?? value,
      value3: C.Density = (0, runtime.useDensity)(),
      state = {
        "data-step": (0, runtime.getDensitySizeIndex)(
          value3,
          calloutSizeByDensity[value3],
        ),
      },
      value4 = variant ?? "neutral",
      value5 =
        composerCalibration === true
          ? "glyph"
          : composerCalibration === false
            ? undefined
            : composerCalibration,
      value6 = value5 !== undefined,
      value7 = icon !== null && icon !== undefined && typeof icon !== "boolean",
      value8 = isPictogramElement(icon),
      value9 =
        details !== null &&
        details !== undefined &&
        typeof details !== "boolean",
      value10 = role ?? (value9 ? "none" : "status"),
      [value11, value12] = reactZQ.useState(defaultDetailsOpen),
      [value13, value14] = reactZQ.useState(false),
      ref = reactZQ.useRef<HTMLDivElement>(null),
      ref2 = reactZQ.useRef<HTMLDivElement>(null),
      ref3 = reactZQ.useRef<HTMLElement>(null),
      ref4 = reactZQ.useRef(0),
      value15 =
        action !== null && action !== undefined && typeof action !== "boolean",
      value16 = !value9 && (value8 || (actionAlign === "center" && !value6)),
      value17 = value16,
      value18 = !value9 && value15,
      value19 = value18 && value13,
      value20 = value6 && value19 && !value16;
    reactZQ.useLayoutEffect(() => {
      if (!value6 || !value18 || value17) {
        ref4.current = 0;
      }
      if (!value18) {
        return;
      }
      let current = ref.current,
        value24: typeof ResizeObserver | undefined = (0,
        runtime.getResizeObserverConstructor)(current);
      if (current === null || value24 === undefined) {
        return;
      }
      let callback2 = () => {
        if (value20) {
          if (current.offsetWidth > ref4.current + CALLOUT_PICTOGRAM_SIZE) {
            value14(false);
          }
          return;
        }
        let current3 = ref2.current,
          current4 = ref3.current;
        if (current3 === null || current4 === null) {
          return;
        }
        let value26 = Number.parseFloat(getComputedStyle(current3).lineHeight);
        if (!Number.isFinite(value26) || value26 <= 0) {
          return;
        }
        let top = current4.getBoundingClientRect().top,
          bounds = current3.getBoundingClientRect();
        if (value17 && bounds.height === 0) {
          return;
        }
        let value27 = value17
          ? top >= bounds.bottom - 1
          : top - bounds.top > value26 / 2;
        if (value27 && value6 && !value17) {
          ref4.current = current.offsetWidth;
        }
        value14(value27);
      };
      callback2();
      let value25 = new value24(callback2);
      value25.observe(current);
      let current2 = ref2.current;
      if (value17 && current2 !== null) {
        value25.observe(current2);
      }
      return () => value25.disconnect();
    }, [value18, value6, value20, value17]);
    let value21 = detailsOpen ?? value11,
      callback = (input: boolean) => {
        value12(input);
        onDetailsOpenChange?.(input);
      },
      value22 = value9 || !value8,
      value23 = action ? (
        <span
          ref={ref3}
          {...state}
          className={(0, runtime.cn)(
            "flex shrink-0 items-center gap-xs",
            !value19 && "h-[1lh]",
            value20 && "basis-full",
            !value19 && "-ms-[2px]",
            value20 && value5 && leadingIconOutsetClasses[value5],
            value5 !== undefined &&
              !onDismiss &&
              leadingIconSpacingClasses[value5],
            !value6 && !onDismiss && "-me-[calc(var(--cds-pad-md)-2px)]",
          )}
        >
          {action}
        </span>
      ) : null;
    return (
      <div
        data-cds={"Banner"}
        data-icon-layout={value22 ? "first-line" : "centered"}
        data-cta-layout={value20 ? "stacked" : value19 ? "wrapped" : "inline"}
        data-action-align={value16 ? "center" : "first-line"}
        data-composer-keyline={value5}
        data-testid={dataTestid}
        role={value10 === "none" ? undefined : value10}
        ref={ref}
        className={(0, runtime.cn)(
          "flex",
          value22 ? "items-start" : "items-center",
          "gap-xs py-md font-sans text-body font-normal",
          value6 ? "px-md" : "px-lg",
          value19 && !value20 && "pb-lg",
          value6 ? pictogramCardRadiusClass : "rounded-card",
          calloutVariantClasses[value4],
          className,
        )}
      >
        {[
          icon !== null && !value20 && (
            <span
              className={(0, runtime.cn)(
                value22 ? "flex min-h-[1lh] shrink-0 items-center" : "shrink-0",
                calloutTextClasses[value4],
                value6 && "ms-[4px] -me-[4px]",
              )}
            >
              {value7 ? (
                icon
              ) : (
                <runtime.Icon
                  name={calloutDefaultIcons[value4]}
                  size={"auto"}
                />
              )}
            </span>
          ),
          value9 ? (
            <div
              className={(0, runtime.cn)(
                "flex min-w-0 flex-1 flex-col",
                value5 && leadingIconInsetClasses[value5],
              )}
            >
              <runtime.Collapsible.Root
                className={"contents"}
                open={value21}
                onOpenChange={callback}
              >
                {[
                  <div
                    className={
                      "flex min-w-0 flex-wrap items-start gap-y-sm gap-x-md"
                    }
                  >
                    {[
                      <runtime.Collapsible.Trigger
                        render={
                          <button
                            type={"button"}
                            className={
                              "cds-reset flex min-w-0 grow select-none items-center gap-x-[2px] border-0 text-start outline-none focus-visible:shadow-focus focus-visible:outline-hidden rounded transition-shadow duration-fast"
                            }
                          >
                            {[
                              <div className={"min-w-0"}>{children}</div>,
                              <runtime.Icon
                                name={"CaretDown"}
                                size={"sm"}
                                className={`shrink-0 text-secondary transition-transform ${value21 ? "rotate-0" : "-rotate-90 rtl:rotate-90"}`}
                              />,
                            ]}
                          </button>
                        }
                      />,
                      value23,
                    ]}
                  </div>,
                  <runtime.Collapsible.Panel
                    className={"w-full text-secondary"}
                  >
                    <div className={"pt-[var(--cds-gap-sm)]"}>{details}</div>
                  </runtime.Collapsible.Panel>,
                ]}
              </runtime.Collapsible.Root>
            </div>
          ) : (
            <div
              className={(0, runtime.cn)(
                "flex min-w-0 flex-wrap",
                value16 ? "items-center" : "items-start",
                "gap-y-sm gap-x-md flex-1",
                value20 && "gap-y-xs",
                value5 && leadingIconInsetClasses[value5],
              )}
            >
              {[
                <div
                  ref={ref2}
                  className={
                    !value16
                      ? "max-w-full min-w-0 flex-auto"
                      : value6 && value8
                        ? "min-w-[min(40ch,100%)] flex-1"
                        : "min-w-[min(20ch,100%)] flex-1"
                  }
                >
                  {children}
                </div>,
                value23,
              ]}
            </div>
          ),
          onDismiss && (
            <span
              {...state}
              className={`${value5 !== undefined ? trailingIconOutsetClasses[value5] : "-me-[calc(var(--cds-pad-md)-2px)]"} flex h-[1lh] shrink-0 items-center`}
            >
              <runtime.Button
                variant={"ghost"}
                iconOnly={true}
                icon={"X"}
                aria-label={value2}
                tooltip={false}
                onClick={onDismiss}
              />
            </span>
          ),
        ]}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiIcons",
    () => reactForUiIcons,
    (value) => {
      reactForUiIcons = value;
    },
  );
  bindRuntimeValue(runtime, "isPictogramElement", () => isPictogramElement);
  bindRuntimeValue(
    runtime,
    "REACT_MEMO_SYMBOL",
    () => REACT_MEMO_SYMBOL,
    (value) => {
      REACT_MEMO_SYMBOL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REACT_FORWARD_REF_SYMBOL",
    () => REACT_FORWARD_REF_SYMBOL,
    (value) => {
      REACT_FORWARD_REF_SYMBOL = value;
    },
  );
  bindRuntimeValue(runtime, "isPictogramComponent", () => isPictogramComponent);
  bindRuntimeValue(
    runtime,
    "pictogramCardRadiusClass",
    () => pictogramCardRadiusClass,
    (value) => {
      pictogramCardRadiusClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingIconInsetClasses",
    () => leadingIconInsetClasses,
    (value) => {
      leadingIconInsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingIconOutsetClasses",
    () => leadingIconOutsetClasses,
    (value) => {
      leadingIconOutsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingGlyphOutsetClass",
    () => leadingGlyphOutsetClass,
    (value) => {
      leadingGlyphOutsetClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trailingIconOutsetClasses",
    () => trailingIconOutsetClasses,
    (value) => {
      trailingIconOutsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trailingGlyphOutsetClass",
    () => trailingGlyphOutsetClass,
    (value) => {
      trailingGlyphOutsetClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingIconSpacingClasses",
    () => leadingIconSpacingClasses,
    (value) => {
      leadingIconSpacingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingGlyphSpacingClass",
    () => leadingGlyphSpacingClass,
    (value) => {
      leadingGlyphSpacingClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactZQ",
    () => reactZQ,
    (value) => {
      reactZQ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiIcons",
    () => jsxForUiIcons,
    (value) => {
      jsxForUiIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutSizeByDensity",
    () => calloutSizeByDensity,
    (value) => {
      calloutSizeByDensity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CALLOUT_PICTOGRAM_SIZE",
    () => CALLOUT_PICTOGRAM_SIZE,
    (value) => {
      CALLOUT_PICTOGRAM_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutVariantClasses",
    () => calloutVariantClasses,
    (value) => {
      calloutVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutTextClasses",
    () => calloutTextClasses,
    (value) => {
      calloutTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutDefaultIcons",
    () => calloutDefaultIcons,
    (value) => {
      calloutDefaultIcons = value;
    },
  );
  bindRuntimeValue(runtime, "Callout", () => Callout);
  bindRuntimeValue(
    runtime,
    "reactForUiIcons2",
    () => reactForUiIcons2,
    (value) => {
      reactForUiIcons2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxGP",
    () => jsxGP,
    (value) => {
      jsxGP = value;
    },
  );
  return () => {
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeTranslations)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeIconSupport)();
    (0, runtime.initializeIcons)();
    reactForUiIcons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    REACT_MEMO_SYMBOL = Symbol.for("react.memo");
    REACT_FORWARD_REF_SYMBOL = Symbol.for("react.forward_ref");
    pictogramCardRadiusClass = "rounded-composer";
    leadingIconInsetClasses = {
      glyph: "ml-[6px] compact:ml-[6px] comfortable:ml-[4px]",
      text: "ml-[4px] compact:ml-[4px] comfortable:ml-[2px]",
    };
    leadingIconOutsetClasses = {
      glyph: "-ml-[6px] compact:-ml-[6px] comfortable:-ml-[4px]",
      text: "-ml-[4px] compact:-ml-[4px] comfortable:-ml-[2px]",
    };
    leadingGlyphOutsetClass = leadingIconInsetClasses.glyph;
    trailingIconOutsetClasses = {
      glyph: "-mr-[4px]",
      text: "-mr-[2px] compact:-mr-[2px] comfortable:-mr-[4px]",
    };
    trailingGlyphOutsetClass = trailingIconOutsetClasses.glyph;
    leadingIconSpacingClasses = {
      glyph:
        "me-[calc(8px-var(--cds-pad-md))] compact:me-[calc(8px-var(--cds-pad-md))] comfortable:me-[calc(4px-var(--cds-pad-md))]",
      text: "me-[calc(6px-var(--cds-pad-md))] compact:me-[calc(6px-var(--cds-pad-md))] comfortable:me-[calc(5px-var(--cds-pad-md))]",
    };
    leadingGlyphSpacingClass = leadingIconSpacingClasses.glyph;
    reactZQ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiIcons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    calloutSizeByDensity = {
      comfortable: "sm",
      compact: "base",
    };
    CALLOUT_PICTOGRAM_SIZE = 64;
    calloutVariantClasses = {
      neutral:
        "bg-surface-1 text-primary shadow-card-ring [--cds-prose-code-color:var(--cds-text-danger)] [--cds-prose-marker-color:var(--cds-text-secondary)]",
      warning:
        "bg-warning text-warning shadow-ring-warning [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",
      danger:
        "bg-danger text-danger shadow-ring-danger [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",
    };
    calloutTextClasses = {
      neutral: "text-secondary",
      warning: "",
      danger: "",
    };
    calloutDefaultIcons = {
      neutral: "Info",
      warning: "Warning",
      danger: "Warning",
    };
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeHrefWhitespace)();
    (0, runtime.initializeLinkTargets)();
    (0, runtime.initializeCdsLink)();
    (0, runtime.initializePointerDismissal)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeCdsLink)();
    reactForUiIcons2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxGP = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}

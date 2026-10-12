/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsCounter(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsCounter: Dynamic;
  var ComponentsCounterForValue: Dynamic;
  var ComponentsCounterForValue_2: Dynamic;
  var initializeComponentsCounter: Dynamic;
  var ComponentsCounterClassNames: Dynamic;
  var initializeComponentsCounter_2: Dynamic;
  var reactComponentsCounter_2: Dynamic;
  var jsxComponentsCounter: Dynamic;
  var ComponentsCounterNeutralAccentSuccessConfig: Dynamic;
  var ComponentsCounterNeutralAccentSuccessConfig_2: Dynamic;
  var Counter: Dynamic;
  var initializeComponentsCounter_3: Dynamic;
  var ComponentsCounterGlyphTextConfig: Dynamic;
  var ComponentsCounterGlyphTextConfig_2: Dynamic;
  var ComponentsCounterGlyphValue: Dynamic;
  var ComponentsCounterGlyphTextConfig_3: Dynamic;
  var ComponentsCounterGlyphValue_2: Dynamic;
  var ComponentsCounterGlyphTextConfig_4: Dynamic;
  var ComponentsCounterGlyphValue_3: Dynamic;
  var initializeComponentsCounter_4: Dynamic;
  var reactComponentsCounter_3: Dynamic;
  var jsxComponentsCounter_2: Dynamic;
  var ComponentsCounterComfortableCompactConfig: Dynamic;
  var ComponentsCounterConstant: Dynamic;
  var ComponentsCounterNeutralWarningDangerConfig: Dynamic;
  var ComponentsCounterNeutralWarningDangerConfig_2: Dynamic;
  var ComponentsCounterNeutralWarningDangerConfig_3: Dynamic;
  var initializeComponentsCounter_5: Dynamic;
  var reactComponentsCounter_4: Dynamic;
  var jsxComponentsCounter_3: Dynamic;
  var ComponentsCounterHrefRouterOptionsTargetValues: Dynamic;
  var initializeComponentsCounter_6: Dynamic;
  function isPictogramElement(input?: Dynamic): Dynamic {
    return !(0, reactComponentsCounter.isValidElement)(input) ||
      typeof input.type == "string"
      ? false
      : isCdsPictogram(input.type);
  }
  function isCdsPictogram(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    for (
      let index: Dynamic = 0;
      index < 4 && value !== null && value !== undefined;
      index++
    ) {
      if (value.isCdsPictogram === true) return true;
      let value2: Dynamic = value;
      if (value2.$$typeof === ComponentsCounterForValue) value = value2.type;
      else if (value2.$$typeof === ComponentsCounterForValue_2)
        value = value2.render;
      else return false;
    }
    return false;
  }
  function Alert({
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
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useLabel)("dismiss", "Dismiss"),
      value2: Dynamic = dismissLabel ?? value,
      value3: Dynamic = (0, runtime.useDensity)(),
      state: Dynamic = {
        "data-step": (0, runtime.getControlSizeRank)(
          value3,
          ComponentsCounterComfortableCompactConfig[value3],
        ),
      },
      value4: Dynamic = variant ?? "neutral",
      value5: Dynamic =
        composerCalibration === true
          ? "glyph"
          : composerCalibration === false
            ? undefined
            : composerCalibration,
      value6: Dynamic = value5 !== undefined,
      value7: Dynamic = icon != null && typeof icon != "boolean",
      value8: Dynamic = isPictogramElement(icon),
      value9: Dynamic = details != null && typeof details != "boolean",
      value10: Dynamic = role ?? (value9 ? "none" : "status"),
      [value11, value12]: Dynamic = (0, reactComponentsCounter_3.useState)(
        defaultDetailsOpen,
      ),
      [value13, value14]: Dynamic = (0, reactComponentsCounter_3.useState)(
        false,
      ),
      value15: Dynamic = (0, reactComponentsCounter_3.useRef)(null),
      value16: Dynamic = (0, reactComponentsCounter_3.useRef)(null),
      value17: Dynamic = (0, reactComponentsCounter_3.useRef)(null),
      value18: Dynamic = (0, reactComponentsCounter_3.useRef)(0),
      value19: Dynamic = action != null && typeof action != "boolean",
      value20: Dynamic =
        !value9 && (value8 || (actionAlign === "center" && !value6)),
      value21: Dynamic = !value9 && !value20 && value19,
      value22: Dynamic = value21 && value13,
      value23: Dynamic = value6 && value22;
    (0, reactComponentsCounter_3.useLayoutEffect)((): Dynamic => {
      (!value6 || !value21) && (value18.current = 0);
      if (!value21) return;
      let current: Dynamic = value15.current,
        value27: Dynamic = (0, runtime.getResizeObserver)(current);
      if (current === null || value27 === undefined) return;
      let callback2: Dynamic = (): Dynamic => {
        if (value23) {
          current.offsetWidth > value18.current + ComponentsCounterConstant &&
            value14(false);
          return;
        }
        let current2: Dynamic = value16.current,
          current3: Dynamic = value17.current;
        if (current2 === null || current3 === null) return;
        let value29: Dynamic = Number.parseFloat(
          getComputedStyle(current2).lineHeight,
        );
        if (!Number.isFinite(value29) || value29 <= 0) return;
        let value30: Dynamic =
          current3.getBoundingClientRect().top -
            current2.getBoundingClientRect().top >
          value29 / 2;
        value30 && value6 && (value18.current = current.offsetWidth);
        value14(value30);
      };
      callback2();
      let value28: Dynamic = new value27(callback2);
      value28.observe(current);
      return (): Dynamic => value28.disconnect();
    }, [value21, value6, value23]);
    let value24: Dynamic = detailsOpen ?? value11,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        value12(input);
        onDetailsOpenChange?.(input);
      },
      value25: Dynamic = value9 || !value8,
      value26: Dynamic = action ? (
        <span
          ref={value17}
          {...state}
          className={(0, runtime.cn)(
            "flex shrink-0 items-center gap-xs",
            !value22 && "h-[1lh]",
            value23 && "basis-full",
            !value22 && "-ms-[2px]",
            value23 && value5 && ComponentsCounterGlyphTextConfig_2[value5],
            value5 !== undefined &&
              !onDismiss &&
              ComponentsCounterGlyphTextConfig_4[value5],
            !value6 && !onDismiss && "-me-[calc(var(--cds-pad-md)-2px)]",
          )}
        >
          {action}
        </span>
      ) : null;
    return (
      <div
        data-cds={"Banner"}
        data-icon-layout={value25 ? "first-line" : "centered"}
        data-cta-layout={value23 ? "stacked" : value22 ? "wrapped" : "inline"}
        data-action-align={value20 ? "center" : "first-line"}
        data-composer-keyline={value5}
        data-testid={dataTestid}
        role={value10 === "none" ? undefined : value10}
        ref={value15}
        className={(0, runtime.cn)(
          "flex",
          value25 ? "items-start" : "items-center",
          "gap-xs py-md font-sans text-body font-normal",
          value6 ? "px-md" : "px-lg",
          value22 && !value23 && "pb-lg",
          value6 ? ComponentsCounterClassNames : "rounded-card",
          ComponentsCounterNeutralWarningDangerConfig[value4],
          className,
        )}
      >
        {icon !== null && !value23 && (
          <span
            className={(0, runtime.cn)(
              value25 ? "flex min-h-[1lh] shrink-0 items-center" : "shrink-0",
              ComponentsCounterNeutralWarningDangerConfig_2[value4],
              value6 && "ms-[4px] -me-[4px]",
            )}
          >
            {value7 ? (
              icon
            ) : (
              <runtime.Icon
                name={ComponentsCounterNeutralWarningDangerConfig_3[value4]}
                size={"auto"}
              />
            )}
          </span>
        )}
        {value9 ? (
          <div
            className={(0, runtime.cn)(
              "flex min-w-0 flex-1 flex-col",
              value5 && ComponentsCounterGlyphTextConfig[value5],
            )}
          >
            <runtime.ComponentsCollapsibleRootTriggerPanelConfig.Root
              className={"contents"}
              open={value24}
              onOpenChange={callback}
            >
              <div
                className={
                  "flex min-w-0 flex-wrap items-start gap-y-sm gap-x-md"
                }
              >
                <runtime.ComponentsCollapsibleRootTriggerPanelConfig.Trigger
                  render={
                    <button
                      type={"button"}
                      className={
                        "cds-reset flex min-w-0 grow select-none items-center gap-x-[2px] border-0 text-start outline-none focus-visible:shadow-focus focus-visible:outline-hidden rounded transition-shadow duration-fast"
                      }
                    >
                      <div className={"min-w-0"}>{children}</div>
                      <runtime.Icon
                        name={"CaretDown"}
                        size={"sm"}
                        className={`shrink-0 text-secondary transition-transform ${value24 ? "rotate-0" : "-rotate-90"}`}
                      />
                    </button>
                  }
                />
                {value26}
              </div>
              <runtime.ComponentsCollapsibleRootTriggerPanelConfig.Panel
                className={"w-full text-secondary"}
              >
                <div className={"pt-[var(--cds-gap-sm)]"}>{details}</div>
              </runtime.ComponentsCollapsibleRootTriggerPanelConfig.Panel>
            </runtime.ComponentsCollapsibleRootTriggerPanelConfig.Root>
          </div>
        ) : (
          <div
            className={(0, runtime.cn)(
              "flex min-w-0 flex-wrap",
              value20 ? "items-center" : "items-start",
              "gap-y-sm gap-x-md flex-1",
              value23 && "gap-y-xs",
              value5 && ComponentsCounterGlyphTextConfig[value5],
            )}
          >
            <div
              ref={value16}
              className={
                value20
                  ? "min-w-[min(20ch,100%)] flex-1"
                  : "max-w-full min-w-0 flex-auto"
              }
            >
              {children}
            </div>
            {value26}
          </div>
        )}
        {onDismiss && (
          <span
            {...state}
            className={`${value5 !== undefined ? ComponentsCounterGlyphTextConfig_3[value5] : "-me-[calc(var(--cds-pad-md)-2px)]"} flex h-[1lh] shrink-0 items-center`}
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
        )}
      </div>
    );
  }
  function omitProperties(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input,
      state: Dynamic = {};
    for (let value2 of Object.keys(value) as Dynamic)
      options.includes(value2) || (state[value2] = value[value2]);
    return state;
  }
  function LinkElement({
    stamp: stamp,
    forwardedRef: forwardedRef,
    linkInput: linkInput,
    render: render,
    body: body,
    className: className,
    actionClassName: actionClassName,
    actionDisabled: actionDisabled,
    rest: rest,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactComponentsCounter_4.isValidElement)(render),
      value2: Dynamic = (0, runtime.useLinkProps)({
        ...linkInput,
        ...(0, runtime.pickRouterOptions)(rest),
        href: value ? undefined : linkInput.href,
      }),
      value3: Dynamic = omitProperties(rest, [
        ...ComponentsCounterHrefRouterOptionsTargetValues,
        "disabled",
      ]),
      value4: Dynamic = (0, runtime.npm_useRender_LL)({
        enabled: value,
        render: render,
        ref: forwardedRef,
        props: {
          ...value3,
          ...stamp,
          className: className,
          children: body,
        },
      });
    if (value) return value4;
    if (linkInput.href !== undefined) {
      let value6: Dynamic = omitProperties(rest, [
        ...ComponentsCounterHrefRouterOptionsTargetValues,
        ...runtime.routerOptionKeys,
      ]);
      return (
        <a
          ref={forwardedRef}
          {...stamp}
          {...value6}
          {...value2}
          className={className}
        >
          {body}
        </a>
      );
    }
    let value5: Dynamic = omitProperties(rest, ["href", "disabled"]);
    return (
      <runtime.npm_Button_Dye
        render={<span {...stamp} />}
        nativeButton={false}
        {...(actionDisabled !== undefined
          ? {
              disabled: actionDisabled,
            }
          : {})}
        ref={forwardedRef}
        {...value5}
        className={actionClassName}
      >
        {body}
      </runtime.npm_Button_Dye>
    );
  }
  function TextLinkIcon(input?: Dynamic): Dynamic {
    return (0, runtime.isIconName)(input) ? (
      <runtime.Icon
        name={input}
        size={"sm"}
        className={"self-center"}
        style={{
          fontSize: "1lh",
        }}
      />
    ) : (
      <span className={"self-center"}>{input}</span>
    );
  }
  bindRuntimeValue(runtime, "isPictogramElement", () => isPictogramElement);
  bindRuntimeValue(runtime, "isCdsPictogram", () => isCdsPictogram);
  bindRuntimeValue(
    runtime,
    "reactComponentsCounter",
    () => reactComponentsCounter,
    (value) => {
      reactComponentsCounter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterForValue",
    () => ComponentsCounterForValue,
    (value) => {
      ComponentsCounterForValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterForValue_2",
    () => ComponentsCounterForValue_2,
    (value) => {
      ComponentsCounterForValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCounter",
    () => initializeComponentsCounter,
    (value) => {
      initializeComponentsCounter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterClassNames",
    () => ComponentsCounterClassNames,
    (value) => {
      ComponentsCounterClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCounter_2",
    () => initializeComponentsCounter_2,
    (value) => {
      initializeComponentsCounter_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactComponentsCounter_2",
    () => reactComponentsCounter_2,
    (value) => {
      reactComponentsCounter_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsCounter",
    () => jsxComponentsCounter,
    (value) => {
      jsxComponentsCounter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterNeutralAccentSuccessConfig",
    () => ComponentsCounterNeutralAccentSuccessConfig,
    (value) => {
      ComponentsCounterNeutralAccentSuccessConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterNeutralAccentSuccessConfig_2",
    () => ComponentsCounterNeutralAccentSuccessConfig_2,
    (value) => {
      ComponentsCounterNeutralAccentSuccessConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Counter",
    () => Counter,
    (value) => {
      Counter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCounter_3",
    () => initializeComponentsCounter_3,
    (value) => {
      initializeComponentsCounter_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphTextConfig",
    () => ComponentsCounterGlyphTextConfig,
    (value) => {
      ComponentsCounterGlyphTextConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphTextConfig_2",
    () => ComponentsCounterGlyphTextConfig_2,
    (value) => {
      ComponentsCounterGlyphTextConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphValue",
    () => ComponentsCounterGlyphValue,
    (value) => {
      ComponentsCounterGlyphValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphTextConfig_3",
    () => ComponentsCounterGlyphTextConfig_3,
    (value) => {
      ComponentsCounterGlyphTextConfig_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphValue_2",
    () => ComponentsCounterGlyphValue_2,
    (value) => {
      ComponentsCounterGlyphValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphTextConfig_4",
    () => ComponentsCounterGlyphTextConfig_4,
    (value) => {
      ComponentsCounterGlyphTextConfig_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterGlyphValue_3",
    () => ComponentsCounterGlyphValue_3,
    (value) => {
      ComponentsCounterGlyphValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCounter_4",
    () => initializeComponentsCounter_4,
    (value) => {
      initializeComponentsCounter_4 = value;
    },
  );
  bindRuntimeValue(runtime, "Alert", () => Alert);
  bindRuntimeValue(
    runtime,
    "reactComponentsCounter_3",
    () => reactComponentsCounter_3,
    (value) => {
      reactComponentsCounter_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsCounter_2",
    () => jsxComponentsCounter_2,
    (value) => {
      jsxComponentsCounter_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterComfortableCompactConfig",
    () => ComponentsCounterComfortableCompactConfig,
    (value) => {
      ComponentsCounterComfortableCompactConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterConstant",
    () => ComponentsCounterConstant,
    (value) => {
      ComponentsCounterConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterNeutralWarningDangerConfig",
    () => ComponentsCounterNeutralWarningDangerConfig,
    (value) => {
      ComponentsCounterNeutralWarningDangerConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterNeutralWarningDangerConfig_2",
    () => ComponentsCounterNeutralWarningDangerConfig_2,
    (value) => {
      ComponentsCounterNeutralWarningDangerConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterNeutralWarningDangerConfig_3",
    () => ComponentsCounterNeutralWarningDangerConfig_3,
    (value) => {
      ComponentsCounterNeutralWarningDangerConfig_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCounter_5",
    () => initializeComponentsCounter_5,
    (value) => {
      initializeComponentsCounter_5 = value;
    },
  );
  bindRuntimeValue(runtime, "omitProperties", () => omitProperties);
  bindRuntimeValue(runtime, "LinkElement", () => LinkElement);
  bindRuntimeValue(
    runtime,
    "reactComponentsCounter_4",
    () => reactComponentsCounter_4,
    (value) => {
      reactComponentsCounter_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsCounter_3",
    () => jsxComponentsCounter_3,
    (value) => {
      jsxComponentsCounter_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsCounterHrefRouterOptionsTargetValues",
    () => ComponentsCounterHrefRouterOptionsTargetValues,
    (value) => {
      ComponentsCounterHrefRouterOptionsTargetValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsCounter_6",
    () => initializeComponentsCounter_6,
    (value) => {
      initializeComponentsCounter_6 = value;
    },
  );
  bindRuntimeValue(runtime, "TextLinkIcon", () => TextLinkIcon);
  return () => {
    initializeComponentsCounter = (0, runtime.initializeOnce)((): Dynamic => {
      reactComponentsCounter = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      ComponentsCounterForValue = Symbol.for("react.memo");
      ComponentsCounterForValue_2 = Symbol.for("react.forward_ref");
    });
    initializeComponentsCounter_2 = (0, runtime.initializeOnce)((): Dynamic => {
      ComponentsCounterClassNames = "rounded-composer";
    });
    initializeComponentsCounter_3 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      reactComponentsCounter_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsCounter = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsCounterNeutralAccentSuccessConfig = {
        neutral: "bg-neutral text-secondary",
        accent: "bg-fill-accent text-on-accent",
        success: "bg-green-500 text-gray-0",
        warning: "bg-fill-warning text-yellow-750",
        danger: "bg-fill-danger text-on-danger",
      };
      ComponentsCounterNeutralAccentSuccessConfig_2 = {
        neutral: "bg-fill-control",
        accent: "bg-fill-accent",
        success: "bg-green-500",
        warning: "bg-fill-warning",
        danger: "bg-fill-danger",
      };
      Counter = (0, reactComponentsCounter_2.forwardRef)(
        (
          {
            value: value,
            max = 99,
            showZero = false,
            dot: dot2 = false,
            variant = "danger",
            size: size,
            className: className,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => {
          if (dot2)
            return (
              <span
                ref={options}
                data-cds={"Counter"}
                aria-hidden={"true"}
                {...props}
                className={(0, runtime.cn)(
                  "inline-block size-2 shrink-0 rounded-full align-middle",
                  ComponentsCounterNeutralAccentSuccessConfig_2[variant],
                  className,
                )}
              />
            );
          if (!Number.isFinite(value)) return null;
          let value2: Dynamic = Math.max(0, Math.floor(value));
          if (value2 === 0 && !showZero) return null;
          let value3: Dynamic = value2 > max ? `${max}+` : `${value2}`;
          return (
            <span
              ref={options}
              data-cds={"Counter"}
              {...(0, runtime.getSizeAttribute)(size)}
              {...props}
              className={(0, runtime.cn)(
                "inline-flex shrink-0 items-center justify-center align-middle",
                "h-control-nested min-w-[var(--cds-h-control-nested)] rounded-full",
                value3.length === 1
                  ? "px-0"
                  : "px-[calc(var(--cds-h-control-nested)*0.3)]",
                "font-sans text-caption font-medium proportional-nums",
                ComponentsCounterNeutralAccentSuccessConfig[variant],
                className,
              )}
            >
              {value3}
            </span>
          );
        },
      );
      Counter.displayName = "Counter";
    });
    initializeComponentsCounter_4 = (0, runtime.initializeOnce)((): Dynamic => {
      ComponentsCounterGlyphTextConfig = {
        glyph: "ml-[6px] compact:ml-[6px] comfortable:ml-[4px]",
        text: "ml-[4px] compact:ml-[4px] comfortable:ml-[2px]",
      };
      ComponentsCounterGlyphTextConfig_2 = {
        glyph: "-ml-[6px] compact:-ml-[6px] comfortable:-ml-[4px]",
        text: "-ml-[4px] compact:-ml-[4px] comfortable:-ml-[2px]",
      };
      ComponentsCounterGlyphValue = ComponentsCounterGlyphTextConfig.glyph;
      ComponentsCounterGlyphTextConfig_3 = {
        glyph: "-mr-[4px]",
        text: "-mr-[2px] compact:-mr-[2px] comfortable:-mr-[4px]",
      };
      ComponentsCounterGlyphValue_2 = ComponentsCounterGlyphTextConfig_3.glyph;
      ComponentsCounterGlyphTextConfig_4 = {
        glyph:
          "me-[calc(8px-var(--cds-pad-md))] compact:me-[calc(8px-var(--cds-pad-md))] comfortable:me-[calc(4px-var(--cds-pad-md))]",
        text: "me-[calc(6px-var(--cds-pad-md))] compact:me-[calc(6px-var(--cds-pad-md))] comfortable:me-[calc(5px-var(--cds-pad-md))]",
      };
      ComponentsCounterGlyphValue_3 = ComponentsCounterGlyphTextConfig_4.glyph;
    });
    initializeComponentsCounter_5 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeTooltipTrigger_2)();
      (0, runtime.initializeComponentsCollapsible)();
      (0, runtime.initializeButtonButton)();
      initializeComponentsCounter();
      initializeComponentsCounter_2();
      initializeComponentsCounter_4();
      reactComponentsCounter_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsCounter_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      ComponentsCounterComfortableCompactConfig = {
        comfortable: "sm",
        compact: "base",
      };
      ComponentsCounterConstant = 64;
      ComponentsCounterNeutralWarningDangerConfig = {
        neutral:
          "bg-surface-1 text-primary shadow-card-ring [--cds-prose-code-color:var(--cds-text-danger)] [--cds-prose-marker-color:var(--cds-text-secondary)]",
        warning:
          "bg-warning text-warning shadow-ring-warning [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",
        danger:
          "bg-danger text-danger shadow-ring-danger [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",
      };
      ComponentsCounterNeutralWarningDangerConfig_2 = {
        neutral: "text-secondary",
        warning: "",
        danger: "",
      };
      ComponentsCounterNeutralWarningDangerConfig_3 = {
        neutral: "Info",
        warning: "Warning",
        danger: "Warning",
      };
    });
    initializeComponentsCounter_6 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeLinkRouter)();
      (0, runtime.initializeNpm__base_ui_react_SY)();
      reactComponentsCounter_4 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsCounter_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_R9e)();
      ComponentsCounterHrefRouterOptionsTargetValues = [
        "href",
        "routerOptions",
        "target",
        "rel",
        "download",
      ];
    });
  };
}

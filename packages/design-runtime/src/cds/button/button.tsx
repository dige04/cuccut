import type { ControlSize } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsButtonButton(runtime: RuntimeBindings): () => void {
  var reactButtonButton: Dynamic;
  var jsxButtonButton: Dynamic;
  var ButtonButtonPreventDefault: Dynamic;
  var ButtonButtonClassNames: Dynamic;
  var MeCalcVarCdsHControl1em6px2VarCdsPadMdValue: Dynamic;
  var buttonContentClassNames: Dynamic;
  var buttonStyleVariants: Dynamic;
  var buttonIconOnlyVariants: Dynamic;
  var ButtonGroupOptionsContext: Dynamic;
  var ButtonButtonStartEndMiddleConfig: Dynamic;
  var ButtonButtonStartEndBothConfig: Dynamic;
  var ButtonButtonCdsOutsetXConfig: Dynamic;
  var ButtonIconSizeContext: Dynamic;
  var Button: Dynamic;
  var initializeButtonButton: Dynamic;
  var ButtonButtonClassNames_2: Dynamic;
  var ButtonButtonClassNames_3: Dynamic;
  var ButtonButtonCss: Dynamic;
  var ButtonButtonClassNames_4: Dynamic;
  var ButtonButtonCss_2: Dynamic;
  var ButtonButtonCss_3: Dynamic;
  var initializeButtonButton_2: Dynamic;
  function isButtonActivationKey(
    input: Pick<React.KeyboardEvent, "key">,
  ): boolean {
    return input.key === "Enter" || input.key === " ";
  }
  function isUnmodifiedButtonActivationKey(
    input: Pick<
      React.KeyboardEvent,
      "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
    >,
  ): boolean {
    return (
      isButtonActivationKey(input) &&
      !input.ctrlKey &&
      !input.metaKey &&
      !input.altKey &&
      !input.shiftKey
    );
  }
  function useButtonGroupOptions(): Dynamic {
    return (0, reactButtonButton.useContext)(ButtonGroupOptionsContext);
  }
  function buttonSizeToIconSize(
    input?: ControlSize,
  ): "auto-sm" | "md" | "auto" {
    return input === "xs" || input === "xxs"
      ? "auto-sm"
      : input === "lg"
        ? "md"
        : "auto";
  }
  function useButtonIconSize(input?: Dynamic): Dynamic {
    let value: Dynamic = useButtonGroupOptions(),
      value2: Dynamic = (0, reactButtonButton.useContext)(
        ButtonIconSizeContext,
      );
    return (0, runtime.useIconSize)(
      input !== undefined
        ? buttonSizeToIconSize(input)
        : (value2 ??
            (value?.size !== undefined
              ? buttonSizeToIconSize(value.size)
              : "auto")),
    );
  }
  function buttonIconPadding(input?: Dynamic): Dynamic {
    return `calc((var(--cds-h-control) - ${(0, runtime.scaleCssPixels)(runtime.iconSizeMetrics[input].px)}) / 2)`;
  }
  bindRuntimeValue(
    runtime,
    "isButtonActivationKey",
    () => isButtonActivationKey,
  );
  bindRuntimeValue(
    runtime,
    "isUnmodifiedButtonActivationKey",
    () => isUnmodifiedButtonActivationKey,
  );
  bindRuntimeValue(
    runtime,
    "useButtonGroupOptions",
    () => useButtonGroupOptions,
  );
  bindRuntimeValue(runtime, "buttonSizeToIconSize", () => buttonSizeToIconSize);
  bindRuntimeValue(runtime, "useButtonIconSize", () => useButtonIconSize);
  bindRuntimeValue(runtime, "buttonIconPadding", () => buttonIconPadding);
  bindRuntimeValue(
    runtime,
    "reactButtonButton",
    () => reactButtonButton,
    (value) => {
      reactButtonButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxButtonButton",
    () => jsxButtonButton,
    (value) => {
      jsxButtonButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonPreventDefault",
    () => ButtonButtonPreventDefault,
    (value) => {
      ButtonButtonPreventDefault = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonClassNames",
    () => ButtonButtonClassNames,
    (value) => {
      ButtonButtonClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MeCalcVarCdsHControl1em6px2VarCdsPadMdValue",
    () => MeCalcVarCdsHControl1em6px2VarCdsPadMdValue,
    (value) => {
      MeCalcVarCdsHControl1em6px2VarCdsPadMdValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonContentClassNames",
    () => buttonContentClassNames,
    (value) => {
      buttonContentClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonStyleVariants",
    () => buttonStyleVariants,
    (value) => {
      buttonStyleVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonIconOnlyVariants",
    () => buttonIconOnlyVariants,
    (value) => {
      buttonIconOnlyVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupOptionsContext",
    () => ButtonGroupOptionsContext,
    (value) => {
      ButtonGroupOptionsContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonStartEndMiddleConfig",
    () => ButtonButtonStartEndMiddleConfig,
    (value) => {
      ButtonButtonStartEndMiddleConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonStartEndBothConfig",
    () => ButtonButtonStartEndBothConfig,
    (value) => {
      ButtonButtonStartEndBothConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonCdsOutsetXConfig",
    () => ButtonButtonCdsOutsetXConfig,
    (value) => {
      ButtonButtonCdsOutsetXConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonIconSizeContext",
    () => ButtonIconSizeContext,
    (value) => {
      ButtonIconSizeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Button",
    () => Button,
    (value) => {
      Button = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonButton",
    () => initializeButtonButton,
    (value) => {
      initializeButtonButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonClassNames_2",
    () => ButtonButtonClassNames_2,
    (value) => {
      ButtonButtonClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonClassNames_3",
    () => ButtonButtonClassNames_3,
    (value) => {
      ButtonButtonClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonCss",
    () => ButtonButtonCss,
    (value) => {
      ButtonButtonCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonClassNames_4",
    () => ButtonButtonClassNames_4,
    (value) => {
      ButtonButtonClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonCss_2",
    () => ButtonButtonCss_2,
    (value) => {
      ButtonButtonCss_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonCss_3",
    () => ButtonButtonCss_3,
    (value) => {
      ButtonButtonCss_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonButton_2",
    () => initializeButtonButton_2,
    (value) => {
      initializeButtonButton_2 = value;
    },
  );
  return () => {
    initializeButtonButton = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeLinkRouter)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeDomSelectionPrevention)();
      (0, runtime.initializePlatformRootFontSize_3)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeComponentsShortcut)();
      (0, runtime.initializeTooltipTrigger)();
      (0, runtime.initializeButtonContext)();
      (0, runtime.initializeButtonContext_2)();
      (0, runtime.initializeComponentsSpinner)();
      (0, runtime.initializeTooltipDeferredProvider)();
      (0, runtime.initializeButtonContext_3)();
      (0, runtime.initializeNpm__base_ui_react_SY)();
      reactButtonButton = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxButtonButton = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm_class_variance_authority_Zhe)();
      ButtonButtonPreventDefault = (event?: Dynamic): Dynamic => {
        event.preventDefault();
        event.stopPropagation();
      };
      ButtonButtonClassNames =
        "text-primary font-medium focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.7)] [&[data-initial-focus]:focus]:shadow-[0_0_0_2px_rgb(255_255_255/0.7)]";
      MeCalcVarCdsHControl1em6px2VarCdsPadMdValue =
        "me-[calc((var(--cds-h-control)-1em-6px)/2-var(--cds-pad-md))]";
      buttonContentClassNames = (0, runtime.npm_cva_Kj)(
        "cds-reset group/btn relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none cursor-[var(--cds-cursor-interactive)] aria-disabled:cursor-default data-[disabled]:cursor-default border-0 outline-none focus-visible:outline-hidden [&[data-initial-focus]:focus]:outline-hidden rounded h-control font-sans text-body [&:disabled:not([aria-busy])]:opacity-disabled disabled:pointer-events-none transition-shadow duration-fast",
        {
          variants: {
            variant: {
              primary: `text-on-primary font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.ButtonContextClassNames_2}`,
              secondary: `text-primary font-normal aria-pressed:text-accent ${runtime.ButtonContextClassNames_2}`,
              ghost: `text-primary font-normal aria-pressed:text-accent ${runtime.ButtonContextClassNames_2}`,
              danger: `text-on-danger font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.ButtonContextClassNames_3}`,
              brand: `text-on-brand font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.ButtonContextClassNames_2}`,
              onContent: ButtonButtonClassNames,
              onAccent: ButtonButtonClassNames,
            },
            iconOnly: {
              true: "aspect-square w-control px-0",
              false: "px-md",
            },
          },
          defaultVariants: {
            variant: "secondary",
            iconOnly: false,
          },
        },
      );
      buttonStyleVariants =
        "bg-[var(--cds-button-on-content)] backdrop-blur-md shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-focus-visible/btn:!shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-[[data-initial-focus]:focus]/btn:!shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-hover/btn:bg-[var(--cds-button-on-content-hover)] group-[[aria-haspopup][aria-expanded=true]]/btn:bg-[var(--cds-button-on-content-hover)]";
      buttonIconOnlyVariants = (0, runtime.npm_cva_Kj)(
        runtime.ButtonContextClassNames_4,
        {
          variants: {
            variant: {
              primary:
                "bg-fill-primary group-hover/btn:bg-fill-primary-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-primary-hover",
              secondary: runtime.ButtonContextClassNames_7,
              ghost:
                "bg-transparent group-hover/btn:bg-fill-ghost-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-ghost-hover",
              danger:
                "bg-fill-danger group-hover/btn:bg-fill-danger-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-danger-hover",
              brand:
                "bg-fill-brand group-hover/btn:bg-fill-brand-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-brand-hover",
              onContent: buttonStyleVariants,
              onAccent: buttonStyleVariants,
            },
          },
          defaultVariants: {
            variant: "secondary",
          },
        },
      );
      ButtonGroupOptionsContext = (0, reactButtonButton.createContext)(null);
      ButtonButtonStartEndMiddleConfig = {
        start: "rounded-e-none",
        end: "rounded-s-none",
        middle: "rounded-none",
      };
      ButtonButtonStartEndBothConfig = {
        start: "ms-outset",
        end: "me-outset",
        both: "mx-outset",
      };
      ButtonButtonCdsOutsetXConfig = {
        "--cds-outset-x": "var(--cds-pad-md)",
      };
      ButtonIconSizeContext = (0, reactButtonButton.createContext)(undefined);
      Button = (0, reactButtonButton.forwardRef)(
        (
          {
            variant: variant,
            size: size,
            icon: icon,
            iconOnly = false,
            iconPosition = "start",
            tooltip: tooltip,
            tooltipSide: tooltipSide,
            indicator: indicator,
            shortcut: shortcut,
            busy = false,
            busyLabel: busyLabel,
            pressed: pressed,
            flush = false,
            style: style,
            disabled: disabled2,
            disabledReason: disabledReason,
            disabledReasonSide: disabledReasonSide,
            type: type,
            href: href,
            routerOptions: routerOptions,
            target: target,
            rel: rel,
            download: download,
            render: render,
            className: className,
            children: children,
            "aria-label": ariaLabel,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => {
          let value: Dynamic = useButtonGroupOptions(),
            value2: Dynamic = value?.joined;
          value &&
            ((size = size ?? value.size),
            value.enforceVariant
              ? (variant = value.buttonVariant)
              : (variant = variant ?? value.buttonVariant));
          let value3: Dynamic = variant ?? "secondary",
            value4: Dynamic = (0, runtime.useButtonGroup)(),
            value5: Dynamic = iconOnly === true ? undefined : value4.icon,
            value6: Dynamic = value5 !== undefined && value4.compact,
            value7: Dynamic = iconOnly === true || value6,
            value8: Dynamic = value6 ? value5 : icon,
            value9: Dynamic = value6 ? (
              <span data-cds-part={"compact-name"} className={"contents"}>
                {children}
              </span>
            ) : null,
            value10: Dynamic =
              flush === true ? "start" : flush === false ? undefined : flush,
            value11: Dynamic =
              value10 !== undefined &&
              Object.hasOwn(ButtonButtonStartEndBothConfig, value10)
                ? value10
                : undefined,
            value12: Dynamic =
              value11 !== undefined && !value2 && value3 === "ghost"
                ? value11
                : undefined,
            value13: Dynamic = (0, runtime.useAppleKeyboard)(),
            value14: Dynamic = (0, reactButtonButton.useRef)(null);
          (0, runtime.useButtonAnimation)(value14, "Button");
          let value15: Dynamic = useButtonIconSize(size),
            value16: Dynamic =
              value7 && value8 ? (
                (0, runtime.isIconName)(value8) ? (
                  <runtime.Icon name={value8} size={value15} />
                ) : (
                  value8
                )
              ) : null,
            value17: Dynamic = (0, runtime.useTooltipTrigger)(),
            value18: Dynamic =
              (value7 && ariaLabel && tooltip !== false) ||
              value5 !== undefined,
            value19: Dynamic =
              value5 !== undefined
                ? value6
                  ? value9
                  : undefined
                : typeof tooltip == "string"
                  ? tooltip
                  : ariaLabel,
            value20: Dynamic =
              href === undefined && !!disabled2 && !!disabledReason,
            value21: Dynamic = href === undefined && render === undefined,
            value22: Dynamic = busy && value21,
            callback: Dynamic = (event?: Dynamic): Dynamic => {
              if (isButtonActivationKey(event)) {
                if (value22 && isUnmodifiedButtonActivationKey(event)) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                event.repeat && value21 && event.preventDefault();
              }
              props.onKeyDown?.(event);
            },
            callback2: Dynamic = (event?: Dynamic): Dynamic => {
              if (value22 && isUnmodifiedButtonActivationKey(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              props.onKeyUp?.(event);
            },
            value23: Dynamic =
              value12 === undefined
                ? undefined
                : value7
                  ? {
                      "--cds-outset-x": buttonIconPadding(value15),
                    }
                  : ButtonButtonCdsOutsetXConfig,
            value24: Dynamic = (0, runtime.cn)(
              buttonContentClassNames({
                variant: variant,
                iconOnly: value7,
              }),
              value22 ? "pointer-events-none" : "",
              value12 ? ButtonButtonStartEndBothConfig[value12] : "",
              value2 && value3 !== "ghost"
                ? ButtonButtonStartEndMiddleConfig[value2]
                : "",
              className,
            ),
            value25: Dynamic = (
              <jsxButtonButton.Fragment>
                <span
                  aria-hidden={true}
                  className={(0, runtime.buttonBackgroundClassName)({
                    joined: !!value2,
                    solid:
                      value3 === "primary" ||
                      value3 === "danger" ||
                      value3 === "brand",
                  })}
                >
                  <span
                    ref={value14}
                    data-cds-part={"paint"}
                    className={`${buttonIconOnlyVariants({
                      variant: value3,
                    })} ${runtime.ButtonContextClassNames_6} ${value3 === "secondary" && !value2 ? runtime.ButtonContextClassNames_5 : ""}`}
                  />
                </span>
                <span
                  className={`inline-flex min-w-0 items-center gap-1 ${busy ? "opacity-0" : ""}`}
                >
                  <ButtonIconSizeContext.Provider value={value15}>
                    {value16 ? (
                      indicator ? (
                        <span className={"grid"}>
                          <span
                            className={
                              "col-start-1 row-start-1 [--btn-dot-r:calc(0.1875rem*var(--cds-rem-scale,1))] [--btn-dot-x:calc(100%_-_var(--btn-dot-r)_+_1px)] [&:dir(rtl)]:[--btn-dot-x:calc(var(--btn-dot-r)_-_1px)] not-forced-colors:has-[~[data-cds-part=indicator]>[data-cds=Pulse]]:[mask-image:radial-gradient(circle_at_var(--btn-dot-x)_calc(var(--btn-dot-r)_-_1px),transparent_calc(var(--btn-dot-r)_+_2px),black_calc(var(--btn-dot-r)_+_2.5px))]"
                            }
                          >
                            {value16}
                          </span>
                          <span
                            aria-hidden={true}
                            data-cds-part={"indicator"}
                            className={
                              "relative col-start-1 row-start-1 -me-px -mt-px self-start justify-self-end has-[>[data-cds=Pulse]]:[--cds-page-bg:transparent]"
                            }
                          >
                            {indicator}
                          </span>
                        </span>
                      ) : value6 ? (
                        <jsxButtonButton.Fragment>
                          {value16}
                          <span className={"sr-only"}>{value9}</span>
                        </jsxButtonButton.Fragment>
                      ) : (
                        value16
                      )
                    ) : (
                      <jsxButtonButton.Fragment>
                        {value8 &&
                          iconPosition === "start" &&
                          ((0, runtime.isIconName)(value8) ? (
                            <runtime.Icon
                              name={value8}
                              size={value15}
                              className={"-ms-1"}
                            />
                          ) : (
                            <span className={"-ms-1 inline-flex"}>
                              {value8}
                            </span>
                          ))}
                        {children}
                        {value8 &&
                          iconPosition === "end" &&
                          ((0, runtime.isIconName)(value8) ? (
                            <runtime.Icon
                              name={value8}
                              size={value15}
                              className={"-me-1"}
                            />
                          ) : (
                            <span className={"-me-1 inline-flex"}>
                              {value8}
                            </span>
                          ))}
                        {shortcut && (
                          <runtime.Shortcut
                            keys={shortcut}
                            aria-hidden={true}
                            className={(0, runtime.npm_clsx_Ea)(
                              "pointer-coarse:hidden ms-1",
                              (!value2 || value2 === "end") &&
                                MeCalcVarCdsHControl1em6px2VarCdsPadMdValue,
                            )}
                          />
                        )}
                      </jsxButtonButton.Fragment>
                    )}
                  </ButtonIconSizeContext.Provider>
                </span>
                {busy && (
                  <span
                    className={
                      "absolute inset-0 grid place-items-center leading-[0]"
                    }
                  >
                    <runtime.Spinner
                      size={"sm"}
                      inheritColor={true}
                      label={busyLabel}
                    />
                  </span>
                )}
              </jsxButtonButton.Fragment>
            ),
            value26: Dynamic = (0, runtime.useLinkProps)({
              href: href,
              routerOptions: routerOptions,
              target: target,
              rel: rel,
              download: download,
              ...(0, runtime.pickRouterOptions)(props),
            }),
            value27: Dynamic = (0, runtime.npm_useRender_LL)({
              render:
                render ??
                (href !== undefined ? (
                  <a />
                ) : (
                  <button type={type ?? "button"} disabled={disabled2} />
                )),
              ref: options,
              props: {
                "data-cds": "Button",
                ...(value7
                  ? {
                      "data-cds-icon-only": "",
                    }
                  : undefined),
                ...(value5 !== undefined
                  ? {
                      [runtime.CdsCompactableAttribute]: "",
                    }
                  : undefined),
                ...(value3 === "ghost"
                  ? {
                      "data-cds-ghost": "",
                    }
                  : undefined),
                ...(size === "xxs"
                  ? {
                      "data-step": "1",
                    }
                  : (0, runtime.getSizeAttribute)(size)),
                className: value24,
                style: value23
                  ? {
                      ...value23,
                      ...style,
                    }
                  : style,
                "aria-busy": busy || undefined,
                "aria-pressed": href === undefined ? pressed : undefined,
                "aria-disabled": value22 || undefined,
                "aria-label": ariaLabel,
                "aria-keyshortcuts": shortcut
                  ? (0, runtime.parseSingleShortcut)(shortcut, value13)
                  : undefined,
                children: value25,
                ...props,
                onMouseDown: (0, runtime.withSelectionPrevention)(
                  props.onMouseDown,
                ),
                onClick: value22 ? ButtonButtonPreventDefault : props.onClick,
                onKeyDown: callback,
                onKeyUp: callback2,
                ...(href !== undefined ? value26 : undefined),
              },
            }),
            value28: Dynamic = value18 ? (
              <runtime.DeferredTooltip
                side={tooltipSide}
                hoverable={false}
                content={value17 || value20 ? undefined : value19}
                shortcut={shortcut}
              >
                {value27}
              </runtime.DeferredTooltip>
            ) : (
              value27
            );
          return disabledReason === undefined || href !== undefined ? (
            value28
          ) : (
            <runtime.DeferredDisabledReasonTooltip
              side={disabledReasonSide}
              reason={value20 ? disabledReason : undefined}
            >
              {value28}
            </runtime.DeferredDisabledReasonTooltip>
          );
        },
      );
      Button.displayName = "Button";
    });
    initializeButtonButton_2 = (0, runtime.initializeOnce)((): Dynamic => {
      ButtonButtonClassNames_2 =
        "bg-fill-field shadow-field-ring data-[invalid]:shadow-field-invalid";
      ButtonButtonClassNames_3 =
        "[&:hover:not(:focus-visible):not(:has(:focus-visible)):not([data-invalid]):not([data-disabled])]:shadow-field-hover";
      ButtonButtonCss = `h-control pl-md rounded ${ButtonButtonClassNames_2} font-sans text-body font-normal text-primary transition duration-fast`;
      ButtonButtonClassNames_4 =
        "cds-input cds-reset min-w-0 flex-1 h-full bg-transparent border-0 p-0 outline-none focus-visible:outline-hidden text-body font-normal text-primary focus-visible:shadow-none placeholder:text-muted disabled:opacity-disabled";
      ButtonButtonCss_2 = `rounded ${ButtonButtonClassNames_2} px-md py-sm transition duration-fast`;
      ButtonButtonCss_3 = `${ButtonButtonCss_2} [&:hover:not(:focus-within):not([data-invalid]):not([data-disabled])]:shadow-field-hover focus-within:shadow-focus font-sans text-body text-primary`;
    });
  };
}

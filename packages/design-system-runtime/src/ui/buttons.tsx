/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiButtons(runtime: RuntimeBindings): () => void {
  var reacttJ: typeof React;
  var jsxForUiButtons: typeof import("react/jsx-runtime");
  var preventAndStopEvent: (event: React.SyntheticEvent) => void;
  var onContentButtonTextClasses: string;
  var buttonIndicatorMarginClass: string;
  var buttonVariants: C.VariantClasses<{
    variant?: C.ButtonVariant;
    iconOnly?: boolean;
  }>;
  var onContentButtonBackgroundClasses: string;
  var buttonBackgroundVariants: C.VariantClasses<{
    variant?: C.ButtonVariant;
  }>;
  var buttonGroupContext: React.Context<C.ButtonGroupState | null>;
  var joinedButtonRadiusClasses: Record<"start" | "middle" | "end", string>;
  var buttonOutsetClasses: Record<"start" | "end" | "both", string>;
  var buttonOutsetStyle: C.DesignStyle;
  var buttonIconSizeContext: React.Context<C.ResolvedIconSize | undefined>;
  var Button: C.ForwardComponent<C.ButtonElement, C.ButtonProps>;
  function isButtonActivationKey(
    input: Pick<C.ButtonKeyEvent, "key">,
  ): boolean {
    return input.key === "Enter" || input.key === " ";
  }
  function isUnmodifiedButtonActivation(input: C.ButtonKeyEvent): boolean {
    return (
      isButtonActivationKey(input) &&
      !input.ctrlKey &&
      !input.metaKey &&
      !input.altKey &&
      !input.shiftKey
    );
  }
  function useButtonGroup() {
    return reacttJ.useContext(buttonGroupContext);
  }
  function getButtonIconSize(input?: C.ControlSize): C.IconSize {
    if (input === "xs" || input === "xxs") {
      return "auto-sm";
    }
    if (input === "lg") {
      return "md";
    } else {
      return "auto";
    }
  }
  function useButtonIconSize(input?: C.ControlSize): C.ResolvedIconSize {
    let value = useButtonGroup(),
      value2 = reacttJ.useContext(buttonIconSizeContext);
    return (0, runtime.useIconSize)(
      input !== undefined
        ? getButtonIconSize(input)
        : (value2 ??
            (value?.size !== undefined
              ? getButtonIconSize(value.size)
              : "auto")),
    );
  }
  function getButtonIconVerticalPadding(input: C.ResolvedIconSize): string {
    return `calc((var(--cds-h-control) - ${(0, runtime.pixelsToScaledRem)(runtime.iconSizeMetrics[input].px)}) / 2)`;
  }
  bindRuntimeValue(
    runtime,
    "reacttJ",
    () => reacttJ,
    (value) => {
      reacttJ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiButtons",
    () => jsxForUiButtons,
    (value) => {
      jsxForUiButtons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventAndStopEvent",
    () => preventAndStopEvent,
    (value) => {
      preventAndStopEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isButtonActivationKey",
    () => isButtonActivationKey,
  );
  bindRuntimeValue(
    runtime,
    "isUnmodifiedButtonActivation",
    () => isUnmodifiedButtonActivation,
  );
  bindRuntimeValue(
    runtime,
    "onContentButtonTextClasses",
    () => onContentButtonTextClasses,
    (value) => {
      onContentButtonTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonIndicatorMarginClass",
    () => buttonIndicatorMarginClass,
    (value) => {
      buttonIndicatorMarginClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonVariants",
    () => buttonVariants,
    (value) => {
      buttonVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "onContentButtonBackgroundClasses",
    () => onContentButtonBackgroundClasses,
    (value) => {
      onContentButtonBackgroundClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonBackgroundVariants",
    () => buttonBackgroundVariants,
    (value) => {
      buttonBackgroundVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonGroupContext",
    () => buttonGroupContext,
    (value) => {
      buttonGroupContext = value;
    },
  );
  bindRuntimeValue(runtime, "useButtonGroup", () => useButtonGroup);
  bindRuntimeValue(
    runtime,
    "joinedButtonRadiusClasses",
    () => joinedButtonRadiusClasses,
    (value) => {
      joinedButtonRadiusClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonOutsetClasses",
    () => buttonOutsetClasses,
    (value) => {
      buttonOutsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonOutsetStyle",
    () => buttonOutsetStyle,
    (value) => {
      buttonOutsetStyle = value;
    },
  );
  bindRuntimeValue(runtime, "getButtonIconSize", () => getButtonIconSize);
  bindRuntimeValue(
    runtime,
    "buttonIconSizeContext",
    () => buttonIconSizeContext,
    (value) => {
      buttonIconSizeContext = value;
    },
  );
  bindRuntimeValue(runtime, "useButtonIconSize", () => useButtonIconSize);
  bindRuntimeValue(
    runtime,
    "getButtonIconVerticalPadding",
    () => getButtonIconVerticalPadding,
  );
  bindRuntimeValue(
    runtime,
    "Button",
    () => Button,
    (value) => {
      Button = value;
    },
  );
  return () => {
    reacttJ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiButtons = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    preventAndStopEvent = (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    onContentButtonTextClasses =
      "text-primary font-medium focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.7)] [&[data-initial-focus]:focus]:shadow-[0_0_0_2px_rgb(255_255_255/0.7)]";
    buttonIndicatorMarginClass =
      "me-[calc((var(--cds-h-control)-1em-6px)/2-var(--cds-pad-md))]";
    buttonVariants = (0, runtime.cva)(
      "cds-reset group/btn relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none cursor-[var(--cds-cursor-interactive)] aria-disabled:cursor-default data-[disabled]:cursor-default border-0 outline-none focus-visible:outline-hidden [&[data-initial-focus]:focus]:outline-hidden rounded h-control font-sans text-body [&:disabled:not([aria-busy])]:opacity-disabled disabled:pointer-events-none transition-shadow duration-fast",
      {
        variants: {
          variant: {
            primary: `text-on-primary font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.buttonFocusClasses}`,
            secondary: `text-primary font-normal aria-pressed:text-accent ${runtime.buttonFocusClasses}`,
            ghost: `text-primary font-normal aria-pressed:text-accent ${runtime.buttonFocusClasses}`,
            danger: `text-on-danger font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.dangerButtonFocusClasses}`,
            brand: `text-on-brand font-medium [--cds-shortcut-cap-ink:currentColor] ${runtime.buttonFocusClasses}`,
            onContent: onContentButtonTextClasses,
            onAccent: onContentButtonTextClasses,
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
    onContentButtonBackgroundClasses =
      "bg-[var(--cds-button-on-content)] backdrop-blur-md shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-focus-visible/btn:!shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-[[data-initial-focus]:focus]/btn:!shadow-[inset_0_0_0_1px_var(--cds-button-on-content-ring)] group-hover/btn:bg-[var(--cds-button-on-content-hover)] group-[[aria-haspopup][aria-expanded=true]]/btn:bg-[var(--cds-button-on-content-hover)]";
    buttonBackgroundVariants = (0, runtime.cva)(
      runtime.buttonFillLayerClasses,
      {
        variants: {
          variant: {
            primary:
              "bg-fill-primary group-hover/btn:bg-fill-primary-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-primary-hover",
            secondary: runtime.secondaryButtonFillClasses,
            ghost:
              "bg-transparent group-hover/btn:bg-fill-ghost-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-ghost-hover",
            danger:
              "bg-fill-danger group-hover/btn:bg-fill-danger-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-danger-hover",
            brand:
              "bg-fill-brand group-hover/btn:bg-fill-brand-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-brand-hover",
            onContent: onContentButtonBackgroundClasses,
            onAccent: onContentButtonBackgroundClasses,
          },
        },
        defaultVariants: {
          variant: "secondary",
        },
      },
    );
    buttonGroupContext = reacttJ.createContext<C.ButtonGroupState | null>(null);
    joinedButtonRadiusClasses = {
      start: "rounded-e-none",
      end: "rounded-s-none",
      middle: "rounded-none",
    };
    buttonOutsetClasses = {
      start: "ms-outset",
      end: "me-outset",
      both: "mx-outset",
    };
    buttonOutsetStyle = {
      "--cds-outset-x": "var(--cds-pad-md)",
    };
    buttonIconSizeContext = reacttJ.createContext<
      C.ResolvedIconSize | undefined
    >(undefined);
    Button = reacttJ.forwardRef(
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
          disabled: disabled,
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
        }: C.ButtonProps,
        options: React.ForwardedRef<C.ButtonElement>,
      ) => {
        let value = useButtonGroup(),
          value2 = value?.joined;
        if (value) {
          if (((size = size ?? value.size), value.enforceVariant)) {
            variant = value.buttonVariant;
          } else {
            variant = variant ?? value.buttonVariant;
          }
        }
        let value3 = variant ?? "secondary",
          value4: {
            icon?: React.ReactNode;
            compact: boolean;
          } = (0, runtime.useCompactableControl)(),
          value5 = iconOnly === true ? undefined : value4.icon,
          value6 = value5 !== undefined && value4.compact,
          value7 = iconOnly === true || value6,
          value8 = value6 ? value5 : icon,
          value9 = value6 ? (
            <span data-cds-part={"compact-name"} className={"contents"}>
              {children}
            </span>
          ) : null,
          value10 =
            flush === true ? "start" : flush === false ? undefined : flush,
          value11 =
            value10 !== undefined && Object.hasOwn(buttonOutsetClasses, value10)
              ? value10
              : undefined,
          value12 =
            value11 !== undefined && !value2 && value3 === "ghost"
              ? value11
              : undefined,
          value13: boolean = (0, runtime.useAppleKeyboard)(),
          ref = reacttJ.useRef<HTMLSpanElement>(null);
        (0, runtime.useCompactableControlDebug)(ref, "Button");
        let value14 = useButtonIconSize(size),
          value15 =
            value7 && value8 ? (
              (0, runtime.isIconName)(value8) ? (
                <runtime.Icon name={value8} size={value14} />
              ) : (
                value8
              )
            ) : null,
          value16: boolean = (0, runtime.useTooltipsDisabled)(),
          value17 =
            (value7 && ariaLabel && tooltip !== false) || value5 !== undefined,
          value18 =
            value5 !== undefined
              ? value6
                ? value9
                : undefined
              : typeof tooltip === "string"
                ? tooltip
                : ariaLabel,
          value19 = href === undefined && !!disabled && !!disabledReason,
          value20 = href === undefined && render === undefined,
          value21 = busy && value20,
          callback = (event: React.KeyboardEvent<C.ButtonElement>) => {
            if (isButtonActivationKey(event)) {
              if (value21 && isUnmodifiedButtonActivation(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              if (event.repeat && value20) {
                event.preventDefault();
              }
            }
            props.onKeyDown?.(event);
          },
          callback2 = (event: React.KeyboardEvent<C.ButtonElement>) => {
            if (value21 && isUnmodifiedButtonActivation(event)) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            props.onKeyUp?.(event);
          },
          value22 =
            value12 === undefined
              ? undefined
              : value7
                ? {
                    "--cds-outset-x": getButtonIconVerticalPadding(value14),
                  }
                : buttonOutsetStyle,
          value23: string = (0, runtime.cn)(
            buttonVariants({
              variant: variant,
              iconOnly: value7,
            }),
            value21 ? "pointer-events-none" : "",
            value12 ? buttonOutsetClasses[value12] : "",
            value2 && value3 !== "ghost"
              ? joinedButtonRadiusClasses[value2]
              : "",
            className,
          ),
          value24 = (
            <jsxForUiButtons.Fragment>
              {[
                <span
                  aria-hidden={true}
                  className={(0, runtime.getButtonBackgroundLayerClasses)({
                    joined: !!value2,
                    solid:
                      value3 === "primary" ||
                      value3 === "danger" ||
                      value3 === "brand",
                  })}
                >
                  <span
                    ref={ref}
                    data-cds-part={"paint"}
                    className={`${buttonBackgroundVariants({
                      variant: value3,
                    })} ${runtime.buttonPressedFillClasses} ${value3 === "secondary" && !value2 ? runtime.buttonJoinedFillClasses : ""}`}
                  />
                </span>,
                <span
                  className={`inline-flex min-w-0 items-center gap-1 ${busy ? "opacity-0" : ""}`}
                >
                  <buttonIconSizeContext.Provider value={value14}>
                    {value15 ? (
                      indicator ? (
                        <span className={"grid"}>
                          {[
                            <span
                              className={
                                "col-start-1 row-start-1 [--btn-dot-r:calc(0.1875rem*var(--cds-rem-scale,1))] [--btn-dot-x:calc(100%_-_var(--btn-dot-r)_+_1px)] [&:dir(rtl)]:[--btn-dot-x:calc(var(--btn-dot-r)_-_1px)] not-forced-colors:has-[~[data-cds-part=indicator]>[data-cds=Pulse]]:[mask-image:radial-gradient(circle_at_var(--btn-dot-x)_calc(var(--btn-dot-r)_-_1px),transparent_calc(var(--btn-dot-r)_+_2px),black_calc(var(--btn-dot-r)_+_2.5px))]"
                              }
                            >
                              {value15}
                            </span>,
                            <span
                              aria-hidden={true}
                              data-cds-part={"indicator"}
                              className={
                                "relative col-start-1 row-start-1 -me-px -mt-px self-start justify-self-end has-[>[data-cds=Pulse]]:[--cds-page-bg:transparent]"
                              }
                            >
                              {indicator}
                            </span>,
                          ]}
                        </span>
                      ) : value6 ? (
                        <jsxForUiButtons.Fragment>
                          {[
                            value15,
                            <span className={"sr-only"}>{value9}</span>,
                          ]}
                        </jsxForUiButtons.Fragment>
                      ) : (
                        value15
                      )
                    ) : (
                      <jsxForUiButtons.Fragment>
                        {[
                          value8 &&
                            iconPosition === "start" &&
                            ((0, runtime.isIconName)(value8) ? (
                              <runtime.Icon
                                name={value8}
                                size={value14}
                                className={"-ms-1"}
                              />
                            ) : (
                              <span className={"-ms-1 inline-flex"}>
                                {value8}
                              </span>
                            )),
                          children,
                          value8 &&
                            iconPosition === "end" &&
                            ((0, runtime.isIconName)(value8) ? (
                              <runtime.Icon
                                name={value8}
                                size={value14}
                                className={"-me-1"}
                              />
                            ) : (
                              <span className={"-me-1 inline-flex"}>
                                {value8}
                              </span>
                            )),
                          shortcut && (
                            <runtime.Shortcut
                              keys={shortcut}
                              aria-hidden={true}
                              className={(0, runtime.clsx)(
                                "pointer-coarse:hidden ms-1",
                                (!value2 || value2 === "end") &&
                                  buttonIndicatorMarginClass,
                              )}
                            />
                          ),
                        ]}
                      </jsxForUiButtons.Fragment>
                    )}
                  </buttonIconSizeContext.Provider>
                </span>,
                busy && (
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
                ),
              ]}
            </jsxForUiButtons.Fragment>
          ),
          value25: React.AnchorHTMLAttributes<HTMLAnchorElement> = (0,
          runtime.useCdsLink)({
            href: href,
            routerOptions: routerOptions,
            target: target,
            rel: rel,
            download: download,
            ...(0, runtime.pickLinkEventProps)(props),
          }),
          value26 = (0, runtime.baseUseRender)({
            render:
              render ??
              (href !== undefined ? (
                <a />
              ) : (
                <button type={type ?? "button"} disabled={disabled} />
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
                    [runtime.COMPACTABLE_ATTRIBUTE]: "",
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
                : (0, runtime.getControlSizeAttributes)(size)),
              className: value23,
              style: value22
                ? {
                    ...value22,
                    ...style,
                  }
                : style,
              "aria-busy": busy || undefined,
              "aria-pressed": href === undefined ? pressed : undefined,
              "aria-disabled": value21 || undefined,
              "aria-label": ariaLabel,
              "aria-keyshortcuts": shortcut
                ? (0, runtime.shortcutToAriaKeyShortcuts)(shortcut, value13)
                : undefined,
              children: value24,
              ...props,
              onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
                props.onMouseDown,
              ),
              onClick: value21 ? preventAndStopEvent : props.onClick,
              onKeyDown: callback,
              onKeyUp: callback2,
              ...(href !== undefined ? value25 : undefined),
            },
          }),
          value27 = value17 ? (
            <runtime.DeferredTooltip
              side={tooltipSide}
              hoverable={false}
              content={value16 || value19 ? undefined : value18}
              shortcut={shortcut}
            >
              {value26}
            </runtime.DeferredTooltip>
          ) : (
            value26
          );
        if (disabledReason === undefined || href !== undefined) {
          return value27;
        }
        return (
          <runtime.DeferredDisabledReasonTooltip
            side={disabledReasonSide}
            reason={value19 ? disabledReason : undefined}
          >
            {value27}
          </runtime.DeferredDisabledReasonTooltip>
        );
      },
    );
    Button.displayName = "Button";
    (0, runtime.initializeErrorReporting)();
    (0, runtime.initializeSafeObservers)();
  };
}

import type {
  CollisionPadding,
  DisabledTooltipProps,
  EmptyTooltipContent,
  ForwardComponent,
  OverflowTooltipProps,
  PolymorphicTooltipTrigger,
  TooltipBodyState,
  TooltipBodyUpdate,
  TooltipImplementation,
  TooltipInstantActions,
  TooltipProps,
  TooltipTriggerProps,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsTooltipTooltip(runtime: RuntimeBindings): () => void {
  var reactTooltipTooltip: typeof React;
  var jsxTooltipTooltip: typeof import("react/jsx-runtime");
  var TooltipTooltipCurrentState: React.RefObject<TooltipInstantActions> | null;
  var emptyTooltipContent: EmptyTooltipContent;
  var TooltipTooltipOpenBodyConfig: TooltipBodyState;
  var TooltipTooltipOpen: TooltipBodyUpdate;
  var TooltipTooltipOpen_2: TooltipBodyUpdate;
  var TooltipTooltipBody: TooltipBodyUpdate;
  var TooltipTooltipOpen_3: (input: React.ReactNode) => TooltipBodyUpdate;
  var TooltipTooltipIs: (input: React.ReactNode) => TooltipBodyUpdate;
  var TooltipTooltipOpen_4: TooltipBodyUpdate;
  var TooltipStylesCssAlias: string;
  var TooltipTooltipClassNames: string;
  var TooltipTooltipAlias: string;
  var TooltipTooltipClassNames_2: string;
  var SelfStartValue: string;
  var TooltipTooltipCss: string;
  var OverflowTooltip: ForwardComponent<HTMLSpanElement, OverflowTooltipProps>;
  var TooltipTooltipTooltipDisabledReasonTooltipConfig: Pick<
    TooltipImplementation,
    "Tooltip" | "DisabledReasonTooltip"
  >;
  var TooltipTooltipContext: React.Context<boolean>;
  var initializeTooltipTooltip: () => void;
  function cancelRestoredTooltipFocus(
    input: boolean,
    options: import("@base-ui/react/tooltip").Tooltip.Root.ChangeEventDetails,
  ): boolean {
    return input &&
      options.reason === "trigger-focus" &&
      (0, runtime.isRestoredFocus)(options.event)
      ? (options.cancel(), true)
      : false;
  }
  function activateTooltip(
    input: React.RefObject<TooltipInstantActions>,
  ): void {
    TooltipTooltipCurrentState !== null &&
      TooltipTooltipCurrentState !== input &&
      TooltipTooltipCurrentState.current?.closeInstant();
    TooltipTooltipCurrentState = input;
  }
  function isEmptyTooltipContent(input: React.ReactNode): boolean {
    return (
      input == null ||
      input === "" ||
      typeof input == "boolean" ||
      (Array.isArray(input) && input.every(isEmptyTooltipContent))
    );
  }
  function resolveTooltipContent(
    input: () => React.ReactNode,
  ): React.ReactNode | EmptyTooltipContent {
    let value = input();
    return isEmptyTooltipContent(value as React.ReactNode)
      ? emptyTooltipContent
      : value;
  }
  function TooltipShortcut({
    keys: keys,
    className: className,
  }: {
    keys?: string | readonly string[];
    className?: string;
  }): React.ReactElement {
    return (
      <runtime.Shortcut
        keys={keys}
        variant={"text"}
        className={(0, runtime.cn)(
          "text-[calc(0.75rem*var(--cds-rem-scale,1))] [--cds-shortcut-cap-ink:var(--cds-text-muted)]",
          className,
        )}
      />
    );
  }
  function Tooltip({
    content: content,
    detail: detail,
    secondaryHint: secondaryHint,
    multiline: multiline,
    shortcut: shortcut,
    side = "top",
    align: align,
    sideOffset = 4,
    collisionPadding: collisionPadding,
    trackCursorAxis: trackCursorAxis,
    delay = 300,
    open: open,
    onOpenChange: onOpenChange,
    closeDelay: closeDelay,
    hoverable = true,
    closeOnClick: closeOnClick,
    lazy = false,
    openOnHandedBackFocus = false,
    triggerRef: triggerRef,
    container: container,
    className: className,
    children: children,
  }: TooltipProps): React.ReactElement {
    let value = (0, runtime.useOverlayRoot)(),
      value2 = (0, runtime.useShrinkWrap)({
        immediate: true,
      }),
      value3 = (0, reactTooltipTooltip.useId)(),
      value4 = (0, reactTooltipTooltip.useRef)<
        import("@base-ui/react/tooltip").Tooltip.Root.Actions | null
      >(null),
      [value5, value6] = (0, reactTooltipTooltip.useState)(false),
      value7: React.RefObject<TooltipInstantActions> = (0,
      reactTooltipTooltip.useRef)({
        closeInstant: () => {
          value6(true);
          value4.current?.close();
        },
      }),
      [value8, value9] = (0, reactTooltipTooltip.useState)<Element | null>(
        null,
      ),
      [value10, value11] = (0, reactTooltipTooltip.useState)(
        TooltipTooltipOpenBodyConfig,
      );
    open === false && value10.open && value11(TooltipTooltipOpen_2);
    let value12 = typeof content == "function",
      value13 = value12 || !isEmptyTooltipContent(content as React.ReactNode),
      value14: React.ReactNode = (
        !value12 && value13 ? content : value10.body
      ) as React.ReactNode,
      value15 = !isEmptyTooltipContent(value14 as React.ReactNode),
      value16 = (open ?? value10.open) && (!value12 || value15);
    !value12 &&
      value13 &&
      value16 &&
      !Object.is(value10.body, content) &&
      value11(TooltipTooltipIs(content as React.ReactNode));
    let value17 = (0, reactTooltipTooltip.useCallback)(
        (
          input: boolean,
          options: import("@base-ui/react/tooltip").Tooltip.Root.ChangeEventDetails,
        ): boolean => {
          if (
            !openOnHandedBackFocus &&
            cancelRestoredTooltipFocus(input, options)
          )
            return false;
          if (input) {
            if (typeof content != "function")
              value11(TooltipTooltipOpen_3(content));
            else if (value16) value11(TooltipTooltipOpen);
            else {
              let value38 = resolveTooltipContent(content);
              if (value38 === emptyTooltipContent) {
                options.cancel();
                return false;
              }
              value11(TooltipTooltipOpen_3(value38));
            }
            value6(false);
            activateTooltip(value7);
          } else {
            value11(value16 ? TooltipTooltipOpen_2 : TooltipTooltipOpen_4);
            TooltipTooltipCurrentState === value7 &&
              (TooltipTooltipCurrentState = null);
          }
          value9(
            input && options.reason === "trigger-hover"
              ? (options.trigger ?? null)
              : null,
          );
          onOpenChange?.(input);
          return true;
        },
        [onOpenChange, openOnHandedBackFocus, content, value16],
      ),
      value18 = open !== undefined,
      open2 = value10.open;
    (0, reactTooltipTooltip.useEffect)(() => {
      if (!(!value18 || !value13 || !value15)) {
        open
          ? activateTooltip(value7)
          : TooltipTooltipCurrentState === value7 &&
            (TooltipTooltipCurrentState = null);
        return () => {
          !open2 &&
            TooltipTooltipCurrentState === value7 &&
            (TooltipTooltipCurrentState = null);
        };
      }
    }, [value18, open, value13, value15, open2, value12]);
    let value19 = (0, reactTooltipTooltip.useCallback)(
      (input: boolean): void => {
        input || (value6(false), value9(null), value11(TooltipTooltipBody));
      },
      [],
    );
    (0, reactTooltipTooltip.useEffect)(() => {
      if (!value8) return;
      let ownerDocument = value8.ownerDocument,
        callback = (event: Event): void => {
          let target = event.target;
          target &&
            target !== value8 &&
            (target as Node).contains(value8) &&
            value7.current.closeInstant();
        };
      ownerDocument.addEventListener("scroll", callback, {
        capture: true,
        passive: true,
      });
      return () => {
        ownerDocument.removeEventListener("scroll", callback, {
          capture: true,
        });
      };
    }, [value8]);
    (0, reactTooltipTooltip.useEffect)(
      () => () => {
        TooltipTooltipCurrentState === value7 &&
          (TooltipTooltipCurrentState = null);
      },
      [],
    );
    let value20 = (0, runtime.useDefaultLayer)("tooltip"),
      [value21] = (0, reactTooltipTooltip.useState)(() =>
        lazy && open === undefined
          ? runtime.npm_Tooltip_Ax.createHandle()
          : null,
      ),
      [value22, value23] = (0, reactTooltipTooltip.useState)(false),
      value24 = value22 || value21 === null,
      value25 = (0, reactTooltipTooltip.useRef)(false),
      value26 = (0, reactTooltipTooltip.useCallback)(() => {
        value25.current = true;
        value23(true);
      }, []),
      value27 = (0, runtime.useTooltipDelay)(),
      value28 = (0, reactTooltipTooltip.useRef)<HTMLElement | null>(null),
      value29 = (0, reactTooltipTooltip.useRef)(false);
    (0, reactTooltipTooltip.useEffect)(() => {
      open === false && (value29.current = false);
    }, [open]);
    let value30 = (0, runtime.useOptionalStableCallback)(() => {
        if (value25.current || value24 || !value13 || open !== undefined)
          return;
        let value38: React.ReactNode;
        if (typeof content == "function") {
          let value39 = resolveTooltipContent(content);
          if (value39 === emptyTooltipContent) return;
          value38 = value39;
        } else value38 = content;
        value26();
        value6(false);
        activateTooltip(value7);
        value9(value28.current);
        value11(TooltipTooltipOpen_3(value38));
        value29.current = true;
        onOpenChange?.(true);
      }),
      value31: (event: React.PointerEvent<HTMLElement>) => void = (0,
      runtime.useOptionalStableCallback)((input) => {
        value24 ||
          input.pointerType === "touch" ||
          (value13 &&
            ((value28.current = input.currentTarget),
            value27.start(delay, value30)));
      }),
      value32 = (0, runtime.useOptionalStableCallback)(() => {
        closeOnClick !== false && value27.cancel();
      }),
      value33: (event: React.FocusEvent<HTMLElement>) => void = (0,
      runtime.useOptionalStableCallback)((event) => {
        value24 ||
          ((event.target as Element).matches(":focus-visible") &&
            ((!openOnHandedBackFocus &&
              (0, runtime.isRestoredFocus)(event.nativeEvent)) ||
              ((value28.current = null), value27.cancel(), value30())));
      });
    value21 !== null && open === true && !value22 && value23(true);
    let value34 = (0, reactTooltipTooltip.useCallback)(
        (
          input: boolean,
          options: import("@base-ui/react/tooltip").Tooltip.Root.ChangeEventDetails,
        ): void => {
          if (
            !(
              !openOnHandedBackFocus &&
              cancelRestoredTooltipFocus(input, options)
            )
          ) {
            if (input && value29.current && value16) {
              value11(TooltipTooltipOpen);
              return;
            }
            value17(input, options) && (value29.current = input);
          }
        },
        [value17, openOnHandedBackFocus, value16],
      ),
      value35: import("@base-ui/react/tooltip").Tooltip.Trigger.Props<void>["render"] =
        (0, reactTooltipTooltip.isValidElement)(children) &&
        children.type !== reactTooltipTooltip.Fragment
          ? children
          : (input: TooltipTriggerProps): React.ReactElement => (
              <span {...input} className={"inline-flex"}>
                {children}
              </span>
            ),
      value36 = (() => {
        const _Component = runtime.npm_Tooltip_Ax
          .Trigger as PolymorphicTooltipTrigger;
        return (
          <_Component
            ref={triggerRef}
            id={value3}
            delay={delay}
            closeDelay={closeDelay}
            closeOnClick={closeOnClick}
            handle={value21 ?? undefined}
            disabled={value21 !== null && !value24 ? !value13 : undefined}
            onPointerEnter={value21 ? value31 : undefined}
            onPointerLeave={value21 ? value27.cancel : undefined}
            onPointerDown={value21 ? value32 : undefined}
            onFocus={value21 ? value33 : undefined}
            render={value35}
          />
        );
      })(),
      value37 =
        value24 && value15 ? (
          <runtime.npm_Tooltip_Ax.Portal container={container ?? value}>
            <runtime.PopupSurface>
              <runtime.CollisionPaddingProvider
                override={collisionPadding}
                container={container ?? value}
              >
                {(input: CollisionPadding) => (
                  <runtime.LayerBaseContext.Provider value={value20.base}>
                    <runtime.npm_Tooltip_Ax.Positioner
                      data-cds={"Tooltip"}
                      className={"data-[anchor-hidden]:invisible"}
                      style={value20.style}
                      side={side}
                      align={align}
                      sideOffset={sideOffset}
                      collisionPadding={input}
                    >
                      <runtime.npm_Tooltip_Ax.Popup
                        ref={value2}
                        role={"tooltip"}
                        style={
                          value5
                            ? {
                                transitionDuration: "0s",
                              }
                            : undefined
                        }
                        className={(0, runtime.cn)(
                          TooltipStylesCssAlias,
                          TooltipTooltipAlias,
                          multiline || detail || secondaryHint
                            ? TooltipTooltipCss
                            : TooltipTooltipClassNames_2,
                          !shortcut && TooltipTooltipClassNames,
                          className,
                        )}
                      >
                        <runtime.DarkScope>
                          {multiline || detail || secondaryHint ? (
                            <jsxTooltipTooltip.Fragment>
                              <span
                                className={
                                  "inline-flex min-w-0 items-center gap-2"
                                }
                              >
                                <span className={runtime.TooltipStylesLabel_2}>
                                  {value14}
                                </span>
                                {shortcut && (
                                  <TooltipShortcut keys={shortcut} />
                                )}
                              </span>
                              {secondaryHint && (
                                <span
                                  className={
                                    "inline-flex min-w-0 items-center gap-2"
                                  }
                                >
                                  <span className={"min-w-0 break-words"}>
                                    {secondaryHint.label}
                                  </span>
                                  <TooltipShortcut
                                    keys={secondaryHint.shortcut}
                                  />
                                </span>
                              )}
                              {detail && (
                                <span
                                  className={
                                    "break-words text-[calc(0.6875rem*var(--cds-rem-scale,1))]/[calc(0.875rem*var(--cds-rem-scale,1))] text-secondary"
                                  }
                                >
                                  {detail}
                                </span>
                              )}
                            </jsxTooltipTooltip.Fragment>
                          ) : (
                            <jsxTooltipTooltip.Fragment>
                              <span className={runtime.TooltipStylesLabel_2}>
                                {value14}
                              </span>
                              {shortcut && (
                                <TooltipShortcut
                                  keys={shortcut}
                                  className={SelfStartValue}
                                />
                              )}
                            </jsxTooltipTooltip.Fragment>
                          )}
                        </runtime.DarkScope>
                      </runtime.npm_Tooltip_Ax.Popup>
                    </runtime.npm_Tooltip_Ax.Positioner>
                  </runtime.LayerBaseContext.Provider>
                )}
              </runtime.CollisionPaddingProvider>
            </runtime.PopupSurface>
          </runtime.npm_Tooltip_Ax.Portal>
        ) : null;
    return value21 ? (
      <jsxTooltipTooltip.Fragment>
        <runtime.TooltipImplementationContext.Provider
          value={TooltipTooltipTooltipDisabledReasonTooltipConfig}
        >
          <runtime.TooltipTriggerContext.Provider value={value13}>
            {value36}
          </runtime.TooltipTriggerContext.Provider>
        </runtime.TooltipImplementationContext.Provider>
        {value24 && (
          <runtime.npm_Tooltip_Ax.Root
            handle={value21}
            open={value16}
            disableHoverablePopup={!hoverable}
            trackCursorAxis={trackCursorAxis}
            disabled={!value13}
            actionsRef={value4}
            onOpenChange={value34}
            onOpenChangeComplete={value19}
            triggerId={value3}
          >
            {value37}
          </runtime.npm_Tooltip_Ax.Root>
        )}
      </jsxTooltipTooltip.Fragment>
    ) : (
      <runtime.npm_Tooltip_Ax.Root
        open={value16}
        disableHoverablePopup={!hoverable}
        trackCursorAxis={trackCursorAxis}
        disabled={!value13}
        actionsRef={value4}
        onOpenChange={value17}
        onOpenChangeComplete={value19}
        triggerId={value3}
      >
        <runtime.TooltipImplementationContext.Provider
          value={TooltipTooltipTooltipDisabledReasonTooltipConfig}
        >
          <runtime.TooltipTriggerContext.Provider value={value13}>
            {value36}
          </runtime.TooltipTriggerContext.Provider>
        </runtime.TooltipImplementationContext.Provider>
        {value37}
      </runtime.npm_Tooltip_Ax.Root>
    );
  }
  function DisabledReasonTooltip({
    reason: reason,
    side: side,
    align: align,
    sideOffset: sideOffset,
    multiline = true,
    delay: delay,
    collisionPadding: collisionPadding,
    hoverable: hoverable,
    className: className,
    wrapperClassName: wrapperClassName,
    children: children,
  }: DisabledTooltipProps): React.ReactElement {
    let value = (0, reactTooltipTooltip.useId)();
    return (
      <Tooltip
        content={(0, runtime.hasDisabledReason)(reason) ? reason : undefined}
        side={side}
        align={align}
        sideOffset={sideOffset}
        multiline={multiline}
        delay={delay}
        collisionPadding={collisionPadding}
        hoverable={hoverable}
        className={className}
        closeOnClick={false}
        openOnHandedBackFocus={true}
      >
        <span
          {...(0, runtime.disabledReasonWrapperProps)(
            reason,
            value,
            wrapperClassName,
          )}
        >
          {children}
          <runtime.DisabledReasonDescription id={value} reason={reason} />
        </span>
      </Tooltip>
    );
  }
  function TooltipImplProvider({
    children: children,
  }: React.PropsWithChildren): React.ReactElement {
    return (
      <runtime.TooltipImplementationContext.Provider
        value={TooltipTooltipTooltipDisabledReasonTooltipConfig}
      >
        {children}
      </runtime.TooltipImplementationContext.Provider>
    );
  }
  function useTooltipGroup(): boolean {
    return (0, reactTooltipTooltip.useContext)(TooltipTooltipContext);
  }
  function TooltipGroup({
    delay = 600,
    closeDelay = 200,
    children: children,
  }: React.PropsWithChildren<{
    delay?: number;
    closeDelay?: number;
  }>): React.ReactElement {
    return (
      <TooltipTooltipContext.Provider value={true}>
        <runtime.npm_Tooltip_Ax.Provider delay={delay} closeDelay={closeDelay}>
          {children}
        </runtime.npm_Tooltip_Ax.Provider>
      </TooltipTooltipContext.Provider>
    );
  }
  bindRuntimeValue(
    runtime,
    "cancelRestoredTooltipFocus",
    () => cancelRestoredTooltipFocus,
  );
  bindRuntimeValue(runtime, "activateTooltip", () => activateTooltip);
  bindRuntimeValue(
    runtime,
    "isEmptyTooltipContent",
    () => isEmptyTooltipContent,
  );
  bindRuntimeValue(
    runtime,
    "resolveTooltipContent",
    () => resolveTooltipContent,
  );
  bindRuntimeValue(runtime, "TooltipShortcut", () => TooltipShortcut);
  bindRuntimeValue(runtime, "Tooltip", () => Tooltip);
  bindRuntimeValue(
    runtime,
    "DisabledReasonTooltip",
    () => DisabledReasonTooltip,
  );
  bindRuntimeValue(runtime, "TooltipImplProvider", () => TooltipImplProvider);
  bindRuntimeValue(runtime, "useTooltipGroup", () => useTooltipGroup);
  bindRuntimeValue(runtime, "TooltipGroup", () => TooltipGroup);
  bindRuntimeValue(
    runtime,
    "reactTooltipTooltip",
    () => reactTooltipTooltip,
    (value) => {
      reactTooltipTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxTooltipTooltip",
    () => jsxTooltipTooltip,
    (value) => {
      jsxTooltipTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipCurrentState",
    () => TooltipTooltipCurrentState,
    (value) => {
      TooltipTooltipCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyTooltipContent",
    (): EmptyTooltipContent => emptyTooltipContent,
    (value) => {
      emptyTooltipContent = value as EmptyTooltipContent;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipOpenBodyConfig",
    () => TooltipTooltipOpenBodyConfig,
    (value) => {
      TooltipTooltipOpenBodyConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipOpen",
    () => TooltipTooltipOpen,
    (value) => {
      TooltipTooltipOpen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipOpen_2",
    () => TooltipTooltipOpen_2,
    (value) => {
      TooltipTooltipOpen_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipBody",
    () => TooltipTooltipBody,
    (value) => {
      TooltipTooltipBody = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipOpen_3",
    () => TooltipTooltipOpen_3,
    (value) => {
      TooltipTooltipOpen_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipIs",
    () => TooltipTooltipIs,
    (value) => {
      TooltipTooltipIs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipOpen_4",
    () => TooltipTooltipOpen_4,
    (value) => {
      TooltipTooltipOpen_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipStylesCssAlias",
    () => TooltipStylesCssAlias,
    (value) => {
      TooltipStylesCssAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipClassNames",
    () => TooltipTooltipClassNames,
    (value) => {
      TooltipTooltipClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipAlias",
    () => TooltipTooltipAlias,
    (value) => {
      TooltipTooltipAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipClassNames_2",
    () => TooltipTooltipClassNames_2,
    (value) => {
      TooltipTooltipClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelfStartValue",
    () => SelfStartValue,
    (value) => {
      SelfStartValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipCss",
    () => TooltipTooltipCss,
    (value) => {
      TooltipTooltipCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OverflowTooltip",
    () => OverflowTooltip,
    (value) => {
      OverflowTooltip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipTooltipDisabledReasonTooltipConfig",
    () => TooltipTooltipTooltipDisabledReasonTooltipConfig,
    (value) => {
      TooltipTooltipTooltipDisabledReasonTooltipConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTooltipContext",
    () => TooltipTooltipContext,
    (value) => {
      TooltipTooltipContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipTooltip",
    () => initializeTooltipTooltip,
    (value) => {
      initializeTooltipTooltip = value;
    },
  );
  return () => {
    (0, runtime.defineLiveExports)(runtime.tooltipImplementationExports, {
      DisabledReasonTooltip: () => DisabledReasonTooltip,
      OverflowTooltip: () => OverflowTooltip,
      Tooltip: () => Tooltip,
      TooltipGroup: () => TooltipGroup,
      TooltipImplProvider: () => TooltipImplProvider,
      useTooltipGroup: () => useTooltipGroup,
      useTooltipTrigger: () => runtime.useTooltipTrigger,
    });
    initializeTooltipTooltip = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeDomInputObservation)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializeHooksStableCallback_2)();
      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializeComponentsIcon_3)();
      (0, runtime.initializeTooltipTrigger_3)();
      (0, runtime.initializeTooltipTrigger_4)();
      (0, runtime.initializeComponentsShortcut)();
      (0, runtime.initializeComponentsShrinkWrap_2)();
      (0, runtime.initializeTooltipDisabledReason)();
      (0, runtime.initializeTooltipStyles)();
      (0, runtime.initializeTooltipTrigger)();
      reactTooltipTooltip = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxTooltipTooltip = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_V8e)();
      TooltipTooltipCurrentState = null;
      emptyTooltipContent = Symbol("cds.Tooltip.noShow") as EmptyTooltipContent;
      TooltipTooltipOpenBodyConfig = {
        open: false,
        body: undefined,
      };
      TooltipTooltipOpen = (input: TooltipBodyState): TooltipBodyState =>
        input.open
          ? input
          : {
              ...input,
              open: true,
            };
      TooltipTooltipOpen_2 = (input: TooltipBodyState): TooltipBodyState =>
        input.open
          ? {
              ...input,
              open: false,
            }
          : input;
      TooltipTooltipBody = (input: TooltipBodyState): TooltipBodyState =>
        input.body === undefined
          ? input
          : {
              ...input,
              body: undefined,
            };
      TooltipTooltipOpen_3 =
        (input: React.ReactNode): TooltipBodyUpdate =>
        (input2) =>
          input2.open && Object.is(input2.body, input)
            ? input2
            : {
                open: true,
                body: input,
              };
      TooltipTooltipIs =
        (input: React.ReactNode): TooltipBodyUpdate =>
        (input2) =>
          Object.is(input2.body, input)
            ? input2
            : {
                ...input2,
                body: input,
              };
      TooltipTooltipOpen_4 = (input: TooltipBodyState): TooltipBodyState =>
        input.open || input.body !== undefined
          ? TooltipTooltipOpenBodyConfig
          : input;
      TooltipStylesCssAlias = runtime.TooltipStylesCss;
      TooltipTooltipClassNames = "text-balance";
      TooltipTooltipAlias = runtime.tooltipPopupClasses;
      TooltipTooltipClassNames_2 =
        "inline-flex items-center gap-2 min-h-[calc(1.5rem*var(--cds-rem-scale,1))] max-w-[240px] py-[calc(0.1875rem*var(--cds-rem-scale,1))]";
      SelfStartValue = "self-start";
      TooltipTooltipCss = `flex flex-col gap-0.5 ${runtime.TooltipStylesCss_2}`;
      OverflowTooltip = (0, reactTooltipTooltip.forwardRef)<
        HTMLSpanElement,
        OverflowTooltipProps
      >(function (
        {
          className: className,
          side: side,
          align: align,
          sideOffset: sideOffset,
          delay: delay,
          collisionPadding: collisionPadding,
          hoverable: hoverable,
          lazy: lazy,
          children: children,
          ...props
        }: OverflowTooltipProps,
        options: React.ForwardedRef<HTMLSpanElement>,
      ): React.ReactElement {
        let value = (0, reactTooltipTooltip.useRef)<HTMLSpanElement | null>(
            null,
          ),
          value2 = (0, runtime.useMergedRefs)(value, options),
          value3 = (0, runtime.useTooltipTrigger)();
        return (
          <Tooltip
            content={
              value3
                ? undefined
                : () => {
                    let current = value.current;
                    if (current !== null)
                      return current.scrollWidth > current.clientWidth ||
                        (0, runtime.measureContentRect)(current)
                        ? children
                        : undefined;
                  }
            }
            side={side}
            align={align}
            sideOffset={sideOffset}
            delay={delay}
            collisionPadding={collisionPadding}
            hoverable={hoverable}
            lazy={lazy}
          >
            <span
              {...props}
              ref={value2}
              data-cds={"OverflowTooltip"}
              className={(0, runtime.cn)(
                "block min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap",
                className,
              )}
            >
              {children}
            </span>
          </Tooltip>
        );
      });
      OverflowTooltip.displayName = "OverflowTooltip";
      TooltipTooltipTooltipDisabledReasonTooltipConfig = {
        Tooltip: Tooltip,
        DisabledReasonTooltip: DisabledReasonTooltip,
      };
      TooltipTooltipContext = (0, reactTooltipTooltip.createContext)<boolean>(
        false,
      );
    });
  };
}

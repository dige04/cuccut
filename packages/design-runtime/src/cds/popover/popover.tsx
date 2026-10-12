import type {
  ForwardComponent,
  InnerOverlayStack,
  MobileSheetParts,
  OverlayActions,
  OverlayKind,
  PopoverAnchorState,
  PopoverAnchorStore,
  PopoverPopupInnerProps,
  PopoverPopupProps,
  PopoverPopupViewProps,
  PopoverRootProps,
  SheetRenderState,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsPopoverPopover(runtime: RuntimeBindings): () => void {
  var jsxPopoverPopover: typeof import("react/jsx-runtime");
  var initializePopoverPopover: () => void;
  var reactPopoverPopover: typeof React;
  var jsxPopoverPopover_2: typeof import("react/jsx-runtime");
  var PopoverPopoverCss: string;
  var popoverPopupClassNames: string;
  var PopoverPopoverNoneXsSmConfig: {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
  var PopoverPopoverXysetrblOverflowPattern: RegExp;
  var PopoverPopoverPaddingOverflowPattern: RegExp;
  var PopoverPopupInner: ForwardComponent<
    HTMLDivElement,
    PopoverPopupInnerProps
  >;
  var PopoverPopup: ForwardComponent<HTMLDivElement, PopoverPopupProps>;
  var PopoverSheetCapablePopup: ForwardComponent<
    HTMLDivElement,
    PopoverPopupProps
  >;
  var PopoverPopupView: ForwardComponent<HTMLDivElement, PopoverPopupViewProps>;
  var PopoverPopoverContext: React.Context<PopoverAnchorStore | null>;
  var PopoverPopoverContext_2: React.Context<InnerOverlayStack | null>;
  var PopoverTrigger: ForwardComponent<
    HTMLButtonElement,
    import("@base-ui/react/popover").Popover.Trigger.Props<void>
  >;
  var PopoverTriggerAlias: typeof PopoverTrigger;
  var PopoverPopoverRootTriggerPopupConfig: {
    Root: typeof PopoverRoot;
    Trigger: typeof PopoverTrigger;
    Popup: typeof PopoverPopup;
    Title: typeof import("@base-ui/react/popover").Popover.Title;
    Description: typeof import("@base-ui/react/popover").Popover.Description;
    Close: typeof import("@base-ui/react/popover").Popover.Close;
    Arrow: typeof import("@base-ui/react/popover").Popover.Arrow;
    createHandle: typeof import("@base-ui/react/popover").Popover.createHandle;
  };
  var initializePopoverPopover_2: () => void;
  function SheetCapablePopup({
    kind: kind,
    children: children,
  }: {
    kind: OverlayKind;
    children: (
      state: SheetRenderState,
      parts: MobileSheetParts | null,
    ) => React.ReactNode;
  }): React.ReactElement {
    let value = (0, runtime.useAvailableSheetParts)(),
      { pending: value2 } = (0, runtime.useSheetState)();
    return value !== null ? (
      <value.SheetPopupHost>
        {(input: SheetRenderState) => children(input, value)}
      </value.SheetPopupHost>
    ) : (
      <jsxPopoverPopover.Fragment>
        {children(
          value2
            ? runtime.SheetsPopupStackConcealedConfig
            : runtime.SheetsPopupStackSheetConcealedChromeConfig,
          null,
        )}
        {value2 ? <runtime.OverlayBackdrop kind={kind} /> : null}
      </jsxPopoverPopover.Fragment>
    );
  }
  function usePopoverAnimation(
    input: string | undefined,
    options: import("@base-ui/react/popover").Popover.Popup.Props["style"],
  ): void {
    let value = (0, reactPopoverPopover.useRef)(false);
    (0, reactPopoverPopover.useEffect)(() => {}, [input, options]);
  }
  function isPopoverArrow(input: React.ReactNode): boolean {
    return (
      (0, reactPopoverPopover.isValidElement)(input) &&
      input.type === runtime.npm_Popover_$f.Arrow
    );
  }
  function usePopoverInnerOverlays(
    input: import("@base-ui/react/popover").Popover.Root.Props<void>["onOpenChange"],
  ): {
    innerOverlays: InnerOverlayStack;
    onOpenChange: NonNullable<
      import("@base-ui/react/popover").Popover.Root.Props<void>["onOpenChange"]
    >;
  } {
    let [value] = (0, reactPopoverPopover.useState)<InnerOverlayStack>(
      runtime.createInnerOverlayStack,
    );
    return {
      innerOverlays: value,
      onOpenChange: (0, reactPopoverPopover.useCallback)(
        (input2, options) => {
          (0, runtime.closeInnerOverlayOnEscape)(value, input2, options) ||
            input?.(input2, options);
        },
        [value, input],
      ),
    };
  }
  function resolvePopoverAnchor(
    input: PopoverAnchorState,
  ): Element | null | "virtual" {
    let anchor = input.anchor;
    if (anchor == null) return input.triggerEl;
    if (anchor instanceof Element) return anchor;
    if (typeof anchor == "object" && "current" in anchor) {
      let current = anchor.current;
      return current instanceof Element ? current : null;
    }
    return "virtual";
  }
  function hasPopoverInputAnchor(input: PopoverAnchorState): boolean {
    if (!input.popupMounted || !input.declinesFocus) return false;
    let value = resolvePopoverAnchor(input);
    return value === "virtual"
      ? true
      : value === null
        ? false
        : (0, runtime.isTextInputElement)(value) ||
          value.querySelector(
            'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
          ) !== null ||
          value.closest(
            'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
          ) !== null;
  }
  function PopoverRoot<Payload = void>({
    onOpenChange: onOpenChange,
    actionsRef: actionsRef,
    ...props
  }: PopoverRootProps<Payload>): React.ReactElement {
    let value = usePopoverInnerOverlays(onOpenChange),
      value2 = (0, runtime.useSheetInteractionMode)(),
      value3 = (0, reactPopoverPopover.useRef)<OverlayActions | null>(null);
    (0, runtime.useOverlayImperativeHandle)(value3, actionsRef);
    return (
      <PopoverPopoverContext_2.Provider value={value.innerOverlays}>
        <runtime.ActivityBoundary actionsRef={value3}>
          {value2 ? (
            (() => {
              const _Component = usePopoverRoot;
              return (
                <_Component
                  {...props}
                  actionsRef={value3}
                  onOpenChange={value.onOpenChange}
                  consumerHandlesOpenChange={onOpenChange !== undefined}
                />
              );
            })()
          ) : (
            <runtime.npm_Popover_$f.Root
              {...props}
              actionsRef={value3}
              onOpenChange={value.onOpenChange}
            />
          )}
        </runtime.ActivityBoundary>
      </PopoverPopoverContext_2.Provider>
    );
  }
  function usePopoverRoot<Payload = void>({
    consumerHandlesOpenChange: consumerHandlesOpenChange,
    ...props
  }: PopoverRootProps<Payload> & {
    consumerHandlesOpenChange: boolean;
  }): React.ReactElement {
    let value = (0, runtime.useOverlayOpenState)(props),
      value2: React.RefObject<PopoverAnchorState> = (0,
      reactPopoverPopover.useRef)({
        popupMounted: false,
        declinesFocus: false,
        anchor: undefined,
        triggerEl: null,
      }),
      value3: PopoverAnchorStore = (0, reactPopoverPopover.useMemo)(
        () => ({
          update: (input) => {
            Object.assign(value2.current, input);
          },
          read: () => value2.current,
        }),
        [],
      ),
      value4 = (0, runtime.useOpenSnapshot)(
        value.open,
        () => {
          let value6 = value3.read();
          return !value6.popupMounted || hasPopoverInputAnchor(value6);
        },
        false,
      ),
      value5 = (0, runtime.useSheetPopup)({
        open: value.open,
        actionsRef: props.actionsRef,
        onOpenChange: value.onOpenChange,
        onOpenChangeComplete: props.onOpenChangeComplete,
        structurallyAnchored: value4,
        closable: !(props.open !== undefined && !consumerHandlesOpenChange),
      });
    return (
      <PopoverPopoverContext.Provider value={value3}>
        <runtime.SheetPopupProvider value={value5}>
          <runtime.npm_Popover_$f.Root
            {...props}
            modal={value5.modal ?? props.modal}
            actionsRef={value5.actionsRef}
            onOpenChange={value5.onOpenChange}
            onOpenChangeComplete={value5.onOpenChangeComplete}
          />
        </runtime.SheetPopupProvider>
      </PopoverPopoverContext.Provider>
    );
  }
  bindRuntimeValue(runtime, "SheetCapablePopup", () => SheetCapablePopup);
  bindRuntimeValue(
    runtime,
    "jsxPopoverPopover",
    () => jsxPopoverPopover,
    (value) => {
      jsxPopoverPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePopoverPopover",
    () => initializePopoverPopover,
    (value) => {
      initializePopoverPopover = value;
    },
  );
  bindRuntimeValue(runtime, "usePopoverAnimation", () => usePopoverAnimation);
  bindRuntimeValue(runtime, "isPopoverArrow", () => isPopoverArrow);
  bindRuntimeValue(
    runtime,
    "usePopoverInnerOverlays",
    () => usePopoverInnerOverlays,
  );
  bindRuntimeValue(runtime, "resolvePopoverAnchor", () => resolvePopoverAnchor);
  bindRuntimeValue(
    runtime,
    "hasPopoverInputAnchor",
    () => hasPopoverInputAnchor,
  );
  bindRuntimeValue(runtime, "PopoverRoot", () => PopoverRoot);
  bindRuntimeValue(runtime, "usePopoverRoot", () => usePopoverRoot);
  bindRuntimeValue(
    runtime,
    "reactPopoverPopover",
    () => reactPopoverPopover,
    (value) => {
      reactPopoverPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPopoverPopover_2",
    () => jsxPopoverPopover_2,
    (value) => {
      jsxPopoverPopover_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverCss",
    () => PopoverPopoverCss,
    (value) => {
      PopoverPopoverCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverPopupClassNames",
    () => popoverPopupClassNames,
    (value) => {
      popoverPopupClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverNoneXsSmConfig",
    () => PopoverPopoverNoneXsSmConfig,
    (value) => {
      PopoverPopoverNoneXsSmConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverXysetrblOverflowPattern",
    () => PopoverPopoverXysetrblOverflowPattern,
    (value) => {
      PopoverPopoverXysetrblOverflowPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverPaddingOverflowPattern",
    () => PopoverPopoverPaddingOverflowPattern,
    (value) => {
      PopoverPopoverPaddingOverflowPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopupInner",
    () => PopoverPopupInner,
    (value) => {
      PopoverPopupInner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopup",
    () => PopoverPopup,
    (value) => {
      PopoverPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverSheetCapablePopup",
    () => PopoverSheetCapablePopup,
    (value) => {
      PopoverSheetCapablePopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopupView",
    () => PopoverPopupView,
    (value) => {
      PopoverPopupView = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverContext",
    () => PopoverPopoverContext,
    (value) => {
      PopoverPopoverContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverContext_2",
    () => PopoverPopoverContext_2,
    (value) => {
      PopoverPopoverContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverTrigger",
    () => PopoverTrigger,
    (value) => {
      PopoverTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverTriggerAlias",
    () => PopoverTriggerAlias,
    (value) => {
      PopoverTriggerAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverPopoverRootTriggerPopupConfig",
    () => PopoverPopoverRootTriggerPopupConfig,
    (value) => {
      PopoverPopoverRootTriggerPopupConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePopoverPopover_2",
    () => initializePopoverPopover_2,
    (value) => {
      initializePopoverPopover_2 = value;
    },
  );
  return () => {
    initializePopoverPopover = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializeOverlaysBackdrop)();
      jsxPopoverPopover = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
    });
    initializePopoverPopover_2 = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeHooksStableCallback)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializeOverlayAttributes)();
      (0, runtime.initializeDomRefComposition_3)();
      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializeThemeSurfaces)();
      (0, runtime.initializeOverlaysImperativeHandle)();
      (0, runtime.initializeSheetsKeyboardViewport)();
      (0, runtime.initializeSheetsLayout)();
      (0, runtime.initializeSheetsPresentation)();
      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializePlatformReducedMotion_2)();
      (0, runtime.initializeOverlaysBackdrop)();
      initializePopoverPopover();
      (0, runtime.initializeSheetsScrollArea_6)();
      (0, runtime.initializeSheetsScrollArea_7)();
      (0, runtime.initializeMenuPopup_3)();
      reactPopoverPopover = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxPopoverPopover_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_pge)();
      PopoverPopoverCss = `draggable-none max-w-[320px] max-h-[var(--available-height)] ${(0, runtime.popupSurfaceClassName)("popover")} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      popoverPopupClassNames =
        "[display:inherit] [flex-direction:inherit] [flex-wrap:inherit] [align-items:inherit] [justify-content:inherit] [justify-items:inherit] [gap:inherit] [grid-template-columns:inherit] [grid-template-rows:inherit] [grid-auto-flow:inherit] [grid-auto-columns:inherit] [grid-auto-rows:inherit] col-span-full row-span-full self-stretch justify-self-stretch max-h-[inherit] min-h-0 min-w-0 flex-auto overflow-y-auto rounded-[inherit] outline-none focus-visible:outline-hidden";
      PopoverPopoverNoneXsSmConfig = {
        none: "p-0",
        xs: "p-xs",
        sm: "p-sm",
        md: "p-md",
        lg: "p-lg",
      };
      PopoverPopoverXysetrblOverflowPattern =
        /(?:^|\s)!?(?:-?p[xysetrbl]?-[^\s:]+|overflow-[^\s:]+)!?(?=\s|$)/;
      PopoverPopoverPaddingOverflowPattern = /^(?:padding|overflow[XY]?$)/;
      PopoverPopupInner = (0, reactPopoverPopover.forwardRef)<
        HTMLDivElement,
        PopoverPopupInnerProps
      >(
        (
          {
            anchored: anchored,
            finalFocus: finalFocus,
            className: className,
            children: children,
            ...props
          }: PopoverPopupInnerProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value =
              (0, reactPopoverPopover.useContext)(runtime.SheetPopupContext)
                ?.open ?? true,
            value2 = anchored && finalFocus === undefined,
            value3 = (0, runtime.useOpenerReturn)({
              skipRestoreOnOutsideFocus: true,
              open: value,
              registerOpenerReturn: value2,
            }),
            value4 = (0, runtime.useMergedRefs)(options, value3.popupRef);
          return (
            <runtime.npm_Popover_$f.Popup
              data-cds={"Popover"}
              {...{
                [runtime.overlayAttribute]: "",
              }}
              ref={value4}
              finalFocus={value2 ? value3.finalFocus : finalFocus}
              {...props}
              className={className}
            >
              {children}
            </runtime.npm_Popover_$f.Popup>
          );
        },
      );
      PopoverPopupInner.displayName = "Popover.PopupInner";
      PopoverPopup = (0, reactPopoverPopover.forwardRef)<
        HTMLDivElement,
        PopoverPopupProps
      >(
        (
          {
            side = "bottom",
            align = "center",
            sideOffset = 6,
            padding = "lg",
            scrollFade = true,
            ...props
          }: PopoverPopupProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let state = {
            side: side,
            align: align,
            sideOffset: sideOffset,
            padding: padding,
            scrollFade: scrollFade,
            ...props,
          };
          return (0, runtime.isInsideSheetPopup)() ? (
            <PopoverSheetCapablePopup {...state} ref={options} />
          ) : (
            <PopoverPopupView
              {...state}
              ref={options}
              sheetPopup={runtime.SheetsPopupStackSheetConcealedChromeConfig}
              sheetParts={null}
            />
          );
        },
      );
      PopoverPopup.displayName = "Popover.Popup";
      PopoverSheetCapablePopup = (0, reactPopoverPopover.forwardRef)<
        HTMLDivElement,
        PopoverPopupProps
      >(
        (
          input: PopoverPopupProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => (
          <SheetCapablePopup kind={"popover"}>
            {(input2: SheetRenderState, options2: MobileSheetParts | null) => (
              <PopoverPopupView
                {...input}
                ref={options}
                sheetPopup={input2}
                sheetParts={options2}
              />
            )}
          </SheetCapablePopup>
        ),
      );
      PopoverSheetCapablePopup.displayName = "PopoverSheetCapablePopup";
      PopoverPopupView = (0, reactPopoverPopover.forwardRef)<
        HTMLDivElement,
        PopoverPopupViewProps
      >(function (
        {
          sheetPopup: sheetPopup,
          sheetParts: sheetParts,
          ...props
        }: PopoverPopupViewProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement {
        let {
            side: value12 = "bottom",
            align: value13 = "center",
            sideOffset: value14 = 6,
            alignOffset: value,
            anchor: value2,
            collisionPadding: value3,
            padding: value15 = "lg",
            scrollFade: value16 = true,
            layerOffset: value4,
            closeLabel: value5,
            sheetHeight: value6,
            className: value7,
            children: value8,
            onFocus: value9,
            onMouseDown: value10,
            keepFocus: value17 = false,
            ...value11
          } = props,
          value18 = (0, reactPopoverPopover.useRef)<HTMLDivElement | null>(
            null,
          ),
          sheet = sheetPopup.sheet,
          value19 = (0, reactPopoverPopover.useContext)(
            runtime.SheetPopupContext,
          ),
          value20 = (value19?.open ?? false) && value19?.height !== undefined,
          value21 = value19?.setDetent;
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          let current = value18.current;
          sheet &&
            value20 &&
            value6 === "tall" &&
            current !== null &&
            current.querySelector(
              'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
            ) !== null &&
            value21?.("tall");
        }, [sheet, value20, value6, value21]);
        let value22 =
            sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
          value23 = (0, reactPopoverPopover.useContext)(PopoverPopoverContext),
          value24 = value11.initialFocus === false,
          callback: React.MouseEventHandler<HTMLDivElement> = (event) => {
            let value32 = (0, runtime.asElement)(event.target);
            !value17 ||
              value32 === null ||
              !event.currentTarget.contains(value32) ||
              (0, runtime.isInteractivePressTarget)(event, {
                draggable: true,
              }) ||
              event.preventDefault();
          },
          value25 = (0, reactPopoverPopover.useContext)(
            PopoverPopoverContext_2,
          );
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          if (value23 !== null) {
            value23.update({
              popupMounted: true,
              declinesFocus: value24,
              anchor: value2,
            });
            return () => {
              value23.update({
                popupMounted: false,
              });
            };
          }
        }, [value23, value24, value2]);
        let value26 = (0, runtime.useRestoreFocusOnClose)(
            sheetPopup.concealed && !value24,
          ),
          value27 = (0, runtime.useMergedRefs)(
            options,
            sheetPopup.ref,
            value26,
          ),
          value28 = (0, runtime.useLayer)("popover", value4);
        usePopoverAnimation(
          value7,
          (
            value11 as {
              style: (
                state: import("@base-ui/react/popover").Popover.Popup.State,
              ) => React.CSSProperties;
            }
          ).style,
        );
        let value29 = reactPopoverPopover.Children.toArray(value8),
          value30 = value29.filter(isPopoverArrow),
          value31 = (
            <runtime.InnerOverlaysContext.Provider value={value25}>
              {value29.filter((input) => !isPopoverArrow(input))}
            </runtime.InnerOverlaysContext.Provider>
          );
        return (
          <runtime.npm_Popover_$f.Portal
            container={(0, runtime.useOverlayRoot)()}
          >
            <runtime.PopupSurface
              {...value28.portalProps}
              style={
                sheetPopup.concealed
                  ? {
                      ...value28.portalProps.style,
                      ...runtime.OverlaysBackdropVisibilityOpacityConfig,
                    }
                  : value28.portalProps.style
              }
              surface={runtime.surfaceBackgroundTokens.popover}
              density={sheet ? runtime.ComfortableValue : undefined}
              companionModalCatcher={!sheet}
              closeOnActivityHide={true}
            >
              {value22 !== null && sheetPopup.sheet && (
                <value22.PopoverSheetBackdrop sheetPopup={sheetPopup} />
              )}
              <runtime.LayerBaseContext.Provider value={value28.base}>
                <runtime.npm_Popover_$f.Positioner
                  style={
                    sheetPopup.positionerStyle !== undefined
                      ? {
                          ...value28.style,
                          ...sheetPopup.positionerStyle,
                        }
                      : value28.style
                  }
                  side={value12}
                  align={value13}
                  sideOffset={value14}
                  alignOffset={value}
                  anchor={value2}
                  collisionPadding={value3}
                  {...(sheet
                    ? runtime.SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig
                    : {})}
                  className={
                    sheet &&
                    (
                      sheetPopup.state as {
                        depth: number;
                      }
                    ).depth === 0
                      ? runtime.PlatformReducedMotionClassNames_3
                      : undefined
                  }
                >
                  <PopoverPopupInner
                    anchored={value2 != null}
                    ref={value27}
                    {...sheetPopup.attrs}
                    {...value11}
                    {...(sheet
                      ? {
                          initialFocus: undefined,
                        }
                      : {})}
                    onMouseDown={
                      sheet
                        ? value10
                        : (
                            input: Parameters<
                              NonNullable<
                                import("@base-ui/react/popover").Popover.Popup.Props["onMouseDown"]
                              >
                            >[0],
                          ) => {
                            value10?.(input);
                            callback(input);
                          }
                    }
                    style={
                      sheetPopup.style === undefined
                        ? (
                            value11 as {
                              style: (
                                state: import("@base-ui/react/popover").Popover.Popup.State,
                              ) => React.CSSProperties;
                            }
                          ).style
                        : typeof (
                              value11 as {
                                style: (
                                  state: import("@base-ui/react/popover").Popover.Popup.State,
                                ) => React.CSSProperties;
                              }
                            ).style == "function"
                          ? (
                              input: import("@base-ui/react/popover").Popover.Popup.State,
                            ) => ({
                              ...(
                                value11 as {
                                  style: (
                                    state: import("@base-ui/react/popover").Popover.Popup.State,
                                  ) => React.CSSProperties;
                                }
                              ).style(input),
                              ...sheetPopup.style,
                            })
                          : {
                              ...(
                                value11 as {
                                  style: (
                                    state: import("@base-ui/react/popover").Popover.Popup.State,
                                  ) => React.CSSProperties;
                                }
                              ).style,
                              ...sheetPopup.style,
                            }
                    }
                    onFocus={(
                      event: Parameters<
                        NonNullable<
                          import("@base-ui/react/popover").Popover.Popup.Props["onFocus"]
                        >
                      >[0],
                    ) => {
                      value9?.(event);
                      let currentTarget = event.currentTarget;
                      event.target === currentTarget &&
                        currentTarget.ownerDocument.activeElement ===
                          currentTarget &&
                        value18.current?.focus({
                          preventScroll: true,
                        });
                    }}
                    className={(0, runtime.cn)(
                      PopoverPopoverCss,
                      sheet && runtime.PlatformReducedMotionCss_2,
                      sheet &&
                        "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                      sheet &&
                        "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                      sheet && "flex flex-col",
                      !sheet && value7,
                    )}
                  >
                    {value22 !== null && sheetPopup.sheet ? (
                      <value22.PopoverSheetContent
                        sheetPopup={sheetPopup}
                        className={value7}
                        bodyRef={value18}
                        bodyClassName={(0, runtime.cn)(
                          popoverPopupClassNames,
                          value16 && "scroll-fade-y",
                          PopoverPopoverNoneXsSmConfig[value15],
                        )}
                        closeLabel={value5}
                      >
                        {value31}
                      </value22.PopoverSheetContent>
                    ) : (
                      <jsxPopoverPopover_2.Fragment>
                        <div
                          ref={value18}
                          tabIndex={-1}
                          data-cds-popover-body={""}
                          {...{
                            [runtime.sheetScrollAttribute]: "",
                          }}
                          className={(0, runtime.cn)(
                            popoverPopupClassNames,
                            value16 && "scroll-fade-y",
                            PopoverPopoverNoneXsSmConfig[value15],
                          )}
                        >
                          {value31}
                        </div>
                        {value30}
                      </jsxPopoverPopover_2.Fragment>
                    )}
                  </PopoverPopupInner>
                </runtime.npm_Popover_$f.Positioner>
              </runtime.LayerBaseContext.Provider>
            </runtime.PopupSurface>
          </runtime.npm_Popover_$f.Portal>
        );
      });
      PopoverPopupView.displayName = "PopoverPopupView";
      PopoverPopoverContext = (0,
      reactPopoverPopover.createContext)<PopoverAnchorStore | null>(null);
      PopoverPopoverContext_2 = (0,
      reactPopoverPopover.createContext)<InnerOverlayStack | null>(null);
      (PopoverRoot as React.FC<PopoverRootProps>).displayName = "Popover.Root";
      PopoverTrigger = (0, reactPopoverPopover.forwardRef)<
        HTMLButtonElement,
        import("@base-ui/react/popover").Popover.Trigger.Props<void>
      >(function (
        input: import("@base-ui/react/popover").Popover.Trigger.Props<void>,
        options: React.ForwardedRef<HTMLButtonElement>,
      ): React.ReactElement {
        let value = (0, reactPopoverPopover.useContext)(PopoverPopoverContext),
          value2 = (0, reactPopoverPopover.useCallback)(
            (input2: HTMLElement | null): void => {
              value?.update({
                triggerEl: input2,
              });
            },
            [value],
          ),
          value3 = (0, runtime.useMergedRefs)(options, value2);
        return <runtime.npm_Popover_$f.Trigger {...input} ref={value3} />;
      });
      PopoverTrigger.displayName = "Popover.Trigger";
      PopoverTriggerAlias = PopoverTrigger;
      PopoverPopoverRootTriggerPopupConfig = {
        Root: PopoverRoot,
        Trigger: PopoverTriggerAlias,
        Popup: PopoverPopup,
        Title: runtime.npm_Popover_$f.Title,
        Description: runtime.npm_Popover_$f.Description,
        Close: runtime.npm_Popover_$f.Close,
        Arrow: runtime.npm_Popover_$f.Arrow,
        createHandle: runtime.npm_Popover_$f.createHandle,
      };
    });
  };
}

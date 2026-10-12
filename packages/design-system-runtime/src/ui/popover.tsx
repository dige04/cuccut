import type * as React from "react";
import type {
  ForwardComponent,
  InnerOverlayStack,
  OverlayActions,
  PopoverAnchorState,
  PopoverAnchorStore,
  PopoverPopupInnerProps,
  PopoverPopupProps,
  PopoverPopupViewProps,
  PopoverRootProps,
  SheetRenderState,
  MobileSheetParts,
  SheetFrameContext,
  LayerValue,
  OpenerReturnState,
  SheetPopupResult,
} from "../contracts/overlays";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiPopover(runtime: RuntimeBindings): () => void {
  var reactForUiPopover: typeof React;
  var jsxForUiPopover: typeof import("react/jsx-runtime");
  var popoverPopupClasses: string;
  var popoverScrollBodyClasses: string;
  var popoverPaddingClasses: Record<
    NonNullable<PopoverPopupProps["padding"]>,
    string
  >;
  var popoverPaddingClassPattern: RegExp;
  var popoverPaddingStylePattern: RegExp;
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
  var popoverStateContext: React.Context<PopoverAnchorStore | null>;
  var popoverControlledStateContext: React.Context<InnerOverlayStack | null>;
  var PopoverTrigger: ForwardComponent<
    HTMLButtonElement,
    import("@base-ui/react/popover").Popover.Trigger.Props<void>
  >;
  var PopoverTriggerAlias: typeof PopoverTrigger;
  var PopoverComponents: {
    Root: typeof PopoverRoot;
    Trigger: typeof PopoverTrigger;
    Popup: typeof PopoverPopup;
    Title: typeof import("@base-ui/react/popover").Popover.Title;
    Description: typeof import("@base-ui/react/popover").Popover.Description;
    Close: typeof import("@base-ui/react/popover").Popover.Close;
    Arrow: typeof import("@base-ui/react/popover").Popover.Arrow;
    createHandle: typeof import("@base-ui/react/popover").Popover.createHandle;
  };
  function usePopoverStyleDebug(
    input: string | undefined,
    options: PopoverPopupProps["style"],
  ): void {
    let ref = reactForUiPopover.useRef(false);
    reactForUiPopover.useEffect(() => {
      return;
    }, [input, options]);
  }
  function isPopoverArrow(input: React.ReactNode): boolean {
    return (
      reactForUiPopover.isValidElement(input) &&
      input.type === runtime.basePopover.Arrow
    );
  }
  function usePopoverOverlayStack(input: PopoverRootProps["onOpenChange"]): {
    innerOverlays: InnerOverlayStack;
    onOpenChange: NonNullable<PopoverRootProps["onOpenChange"]>;
  } {
    let [value] = reactForUiPopover.useState<InnerOverlayStack>(
      runtime.createOverlayStack,
    );
    return {
      innerOverlays: value,
      onOpenChange: reactForUiPopover.useCallback(
        (
          input2: boolean,
          options: import("@base-ui/react/popover").Popover.Root.ChangeEventDetails,
        ): void => {
          if (
            (0, runtime.interceptEscapeForInnerOverlay)(value, input2, options)
          ) {
            return;
          }
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
    if (anchor === undefined || anchor === null) {
      return input.triggerEl;
    }
    if (anchor instanceof Element) {
      return anchor;
    }
    if (typeof anchor === "object" && "current" in anchor) {
      let current = anchor.current;
      if (current instanceof Element) {
        return current;
      } else {
        return null;
      }
    }
    return "virtual";
  }
  function popoverRefusesFocusOut(input: PopoverAnchorState): boolean {
    if (!input.popupMounted || !input.declinesFocus) {
      return false;
    }
    let value = resolvePopoverAnchor(input);
    if (value === "virtual") {
      return true;
    }
    if (value === null) {
      return false;
    }
    return (
      (0, runtime.isEditableElement)(value) ||
      value.querySelector(
        'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
      ) !== null ||
      value.closest(
        'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
      ) !== null
    );
  }
  function PopoverRoot<Payload = void>({
    onOpenChange: onOpenChange,
    actionsRef: actionsRef,
    ...props
  }: PopoverRootProps<Payload>): React.ReactElement {
    let value = usePopoverOverlayStack(onOpenChange),
      value2 = (0, runtime.useSheetCapablePresentation)(),
      ref = reactForUiPopover.useRef<OverlayActions | null>(null);
    (0, runtime.useForwardedOverlayActions)(ref, actionsRef);
    return (
      <popoverControlledStateContext.Provider value={value.innerOverlays}>
        <runtime.CloseOnActivityHideProvider actionsRef={ref}>
          {value2 ? (
            <ControlledPopoverRoot
              {...props}
              actionsRef={ref}
              onOpenChange={value.onOpenChange}
              consumerHandlesOpenChange={onOpenChange !== undefined}
            />
          ) : (
            <runtime.basePopover.Root
              {...props}
              actionsRef={ref}
              onOpenChange={value.onOpenChange}
            />
          )}
        </runtime.CloseOnActivityHideProvider>
      </popoverControlledStateContext.Provider>
    );
  }
  function ControlledPopoverRoot<Payload = void>({
    consumerHandlesOpenChange: consumerHandlesOpenChange,
    ...props
  }: PopoverRootProps<Payload> & {
    consumerHandlesOpenChange: boolean;
  }): React.ReactElement {
    let value = (0, runtime.useControllableOpen)(props),
      ref = reactForUiPopover.useRef<PopoverAnchorState>({
        popupMounted: false,
        declinesFocus: false,
        anchor: undefined,
        triggerEl: null,
      }),
      memo = reactForUiPopover.useMemo<PopoverAnchorStore>(
        () => ({
          update: (input: Partial<PopoverAnchorState>): void => {
            Object.assign(ref.current, input);
          },
          read: (): PopoverAnchorState => ref.current,
        }),
        [],
      ),
      value2 = (0, runtime.useValueCapturedOnOpen)(
        value.open,
        () => {
          let value4 = memo.read();
          return !value4.popupMounted || popoverRefusesFocusOut(value4);
        },
        false,
      ),
      value3 = (0, runtime.useAdaptiveSheet)({
        open: value.open,
        actionsRef: props.actionsRef,
        onOpenChange: value.onOpenChange,
        onOpenChangeComplete: props.onOpenChangeComplete,
        structurallyAnchored: value2,
        closable: !(props.open !== undefined && !consumerHandlesOpenChange),
      });
    return (
      <popoverStateContext.Provider value={memo}>
        <runtime.SheetContextProvider value={value3}>
          <runtime.basePopover.Root
            {...props}
            modal={value3.modal ?? props.modal}
            actionsRef={value3.actionsRef}
            onOpenChange={value3.onOpenChange}
            onOpenChangeComplete={value3.onOpenChangeComplete}
          />
        </runtime.SheetContextProvider>
      </popoverStateContext.Provider>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiPopover",
    () => reactForUiPopover,
    (value) => {
      reactForUiPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiPopover",
    () => jsxForUiPopover,
    (value) => {
      jsxForUiPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverPopupClasses",
    () => popoverPopupClasses,
    (value) => {
      popoverPopupClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverScrollBodyClasses",
    () => popoverScrollBodyClasses,
    (value) => {
      popoverScrollBodyClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverPaddingClasses",
    () => popoverPaddingClasses,
    (value) => {
      popoverPaddingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverPaddingClassPattern",
    () => popoverPaddingClassPattern,
    (value) => {
      popoverPaddingClassPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverPaddingStylePattern",
    () => popoverPaddingStylePattern,
    (value) => {
      popoverPaddingStylePattern = value;
    },
  );
  bindRuntimeValue(runtime, "usePopoverStyleDebug", () => usePopoverStyleDebug);
  bindRuntimeValue(runtime, "isPopoverArrow", () => isPopoverArrow);
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
    "popoverStateContext",
    () => popoverStateContext,
    (value) => {
      popoverStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popoverControlledStateContext",
    () => popoverControlledStateContext,
    (value) => {
      popoverControlledStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "usePopoverOverlayStack",
    () => usePopoverOverlayStack,
  );
  bindRuntimeValue(runtime, "resolvePopoverAnchor", () => resolvePopoverAnchor);
  bindRuntimeValue(
    runtime,
    "popoverRefusesFocusOut",
    () => popoverRefusesFocusOut,
  );
  bindRuntimeValue(runtime, "PopoverRoot", () => PopoverRoot);
  bindRuntimeValue(
    runtime,
    "ControlledPopoverRoot",
    () => ControlledPopoverRoot,
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
    "PopoverComponents",
    () => PopoverComponents,
    (value) => {
      PopoverComponents = value;
    },
  );
  return () => {
    reactForUiPopover = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxForUiPopover = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    popoverPopupClasses = `draggable-none max-w-[320px] max-h-[var(--available-height)] ${(0, runtime.getSurfaceClasses)("popover")} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
    popoverScrollBodyClasses =
      "[display:inherit] [flex-direction:inherit] [flex-wrap:inherit] [align-items:inherit] [justify-content:inherit] [justify-items:inherit] [gap:inherit] [grid-template-columns:inherit] [grid-template-rows:inherit] [grid-auto-flow:inherit] [grid-auto-columns:inherit] [grid-auto-rows:inherit] col-span-full row-span-full self-stretch justify-self-stretch max-h-[inherit] min-h-0 min-w-0 flex-auto overflow-y-auto rounded-[inherit] outline-none focus-visible:outline-hidden";
    popoverPaddingClasses = {
      none: "p-0",
      xs: "p-xs",
      sm: "p-sm",
      md: "p-md",
      lg: "p-lg",
    };
    popoverPaddingClassPattern =
      /(?:^|\s)!?(?:-?p[xysetrbl]?-[^\s:]+|overflow-[^\s:]+)!?(?=\s|$)/;
    popoverPaddingStylePattern = /^(?:padding|overflow[XY]?$)/;
    PopoverPopupInner = reactForUiPopover.forwardRef(
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
            reactForUiPopover.useContext<SheetFrameContext | null>(
              runtime.sheetFrameContext,
            )?.open ?? true,
          value2 = anchored && finalFocus === undefined,
          value3 = (0, runtime.useOverlayFocusReturn)({
            skipRestoreOnOutsideFocus: true,
            open: value,
            registerOpenerReturn: value2,
          }),
          value4 = (0, runtime.useMergedRefs)(options, value3.popupRef);
        return (
          <runtime.basePopover.Popup
            data-cds={"Popover"}
            {...{
              [runtime.OVERLAY_ATTRIBUTE]: "",
            }}
            ref={value4}
            finalFocus={(value2 ? value3.finalFocus : finalFocus) as import("../contracts/overlays").BaseUIPopupFocus}
            {...props}
            className={className}
          >
            {children}
          </runtime.basePopover.Popup>
        );
      },
    );
    PopoverPopupInner.displayName = "Popover.PopupInner";
    PopoverPopup = reactForUiPopover.forwardRef(
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
        if ((0, runtime.useHasSheetFrame)()) {
          return <PopoverSheetCapablePopup {...state} ref={options} />;
        } else {
          return (
            <PopoverPopupView
              {...state}
              ref={options}
              sheetPopup={runtime.defaultSheetHost}
              sheetParts={null}
            />
          );
        }
      },
    );
    PopoverPopup.displayName = "Popover.Popup";
    PopoverSheetCapablePopup = reactForUiPopover.forwardRef(
      (
        input: PopoverPopupProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => (
        <runtime.AdaptiveSheetPopupHost kind={"popover"}>
          {(
            input2: SheetRenderState,
            options2: MobileSheetParts | null,
          ): React.ReactElement => (
            <PopoverPopupView
              {...input}
              ref={options}
              sheetPopup={input2}
              sheetParts={options2}
            />
          )}
        </runtime.AdaptiveSheetPopupHost>
      ),
    );
    PopoverSheetCapablePopup.displayName = "PopoverSheetCapablePopup";
    PopoverPopupView = reactForUiPopover.forwardRef(function (
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
        ref = reactForUiPopover.useRef<HTMLDivElement | null>(null),
        sheet = sheetPopup.sheet,
        value18 = reactForUiPopover.useContext<SheetFrameContext | null>(
          runtime.sheetFrameContext,
        ),
        value19 = (value18?.open ?? false) && value18?.height !== undefined,
        value20 = value18?.setDetent;
      (0, runtime.useIsomorphicLayoutEffect)(() => {
        let current = ref.current;
        if (
          sheet &&
          value19 &&
          value6 === "tall" &&
          current !== null &&
          current.querySelector(
            'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
          ) !== null
        ) {
          value20?.("tall");
        }
      }, [sheet, value19, value6, value20]);
      let value21 = sheetPopup.sheet && sheetParts !== null ? sheetParts : null,
        value22 = reactForUiPopover.useContext(popoverStateContext),
        value23 = value11.initialFocus === false,
        callback: React.MouseEventHandler<HTMLDivElement> = (event) => {
          let value31 = (0, runtime.asElement)(event.target);
          if (
            !value17 ||
            value31 === null ||
            !event.currentTarget.contains(value31)
          ) {
            return;
          }
          if (
            !(0, runtime.shouldAllowPopupPointerFocus)(event, {
              draggable: true,
            })
          ) {
            event.preventDefault();
          }
        },
        value24 = reactForUiPopover.useContext(popoverControlledStateContext);
      (0, runtime.useIsomorphicLayoutEffect)(() => {
        if (value22 === null) {
          return;
        }
        value22.update({
          popupMounted: true,
          declinesFocus: value23,
          anchor: value2,
        });
        return () => {
          value22.update({
            popupMounted: false,
          });
        };
      }, [value22, value23, value2]);
      let value25 = (0, runtime.useRefocusAfterPendingSheet)(
          sheetPopup.concealed && !value23,
        ),
        value26 = (0, runtime.useMergedRefs)(options, sheetPopup.ref, value25),
        value27 = (0, runtime.useOverlayLayer)("popover", value4);
      usePopoverStyleDebug(value7, value11.style);
      let value28 = reactForUiPopover.Children.toArray(value8),
        value29 = value28.filter(isPopoverArrow),
        value30 = (
          <runtime.overlayStackContext.Provider value={value24}>
            {value28.filter(
              (input: React.ReactNode): boolean => !isPopoverArrow(input),
            )}
          </runtime.overlayStackContext.Provider>
        );
      return (
        <runtime.basePopover.Portal
          container={((0, runtime.usePortalContainer)()) as import("../contracts/overlays").BaseUIPortalContainer}
        >
          <runtime.PortalRoot
            {...value27.portalProps}
            style={
              sheetPopup.concealed
                ? {
                    ...value27.portalProps.style,
                    ...runtime.concealedPopupStyle,
                  }
                : value27.portalProps.style
            }
            surface={runtime.elevationSurfaceNames.popover}
            density={sheet ? runtime.SHEET_DENSITY : undefined}
            companionModalCatcher={!sheet}
            closeOnActivityHide={true}
          >
            {[
              value21 !== null && sheetPopup.sheet && (
                <value21.PopoverSheetBackdrop sheetPopup={sheetPopup} />
              ),
              <runtime.layerBaseContext.Provider value={value27.base}>
                <runtime.basePopover.Positioner
                  style={
                    sheetPopup.positionerStyle !== undefined
                      ? {
                          ...value27.style,
                          ...sheetPopup.positionerStyle,
                        }
                      : value27.style
                  }
                  side={value12}
                  align={value13}
                  sideOffset={value14}
                  alignOffset={value}
                  anchor={value2}
                  collisionPadding={value3}
                  {...(sheet ? runtime.sheetPositioningOverrides : {})}
                  className={
                    sheet && sheetPopup.state.depth === 0
                      ? runtime.sheetOverflowBackgroundClasses
                      : undefined
                  }
                >
                  <PopoverPopupInner
                    anchored={value2 !== undefined && value2 !== null}
                    ref={value26}
                    {...(sheetPopup.attrs as React.HTMLAttributes<HTMLDivElement>)}
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
                              NonNullable<PopoverPopupInnerProps["onMouseDown"]>
                            >[0],
                          ): void => {
                            value10?.(input);
                            callback(input);
                          }
                    }
                    style={
                      sheetPopup.style === undefined
                        ? value11.style
                        : typeof value11.style === "function"
                          ? (
                              input: import("@base-ui/react/popover").Popover.Popup.State,
                            ): React.CSSProperties => ({
                              ...(
                                value11.style as (
                                  state: import("@base-ui/react/popover").Popover.Popup.State,
                                ) => React.CSSProperties
                              )(input),
                              ...sheetPopup.style,
                            })
                          : {
                              ...value11.style,
                              ...sheetPopup.style,
                            }
                    }
                    onFocus={(
                      event: Parameters<
                        NonNullable<PopoverPopupInnerProps["onFocus"]>
                      >[0],
                    ): void => {
                      value9?.(event);
                      let currentTarget = event.currentTarget;
                      if (
                        event.target === currentTarget &&
                        currentTarget.ownerDocument.activeElement ===
                          currentTarget
                      ) {
                        ref.current?.focus({
                          preventScroll: true,
                        });
                      }
                    }}
                    className={(0, runtime.cn)(
                      popoverPopupClasses,
                      sheet && runtime.sheetPopupClasses,
                      sheet &&
                        "data-[starting-style]:translate-y-[calc(100%+1.5rem)] data-[ending-style]:translate-y-[calc(100%+1.5rem)]",
                      sheet &&
                        "origin-top [&[data-cds-sheet-covered]:not([data-starting-style]):not([data-ending-style])]:-translate-y-3 data-[cds-sheet-covered]:scale-[0.94] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:transition-opacity after:duration-sheet motion-reduce:after:transition-none data-[cds-sheet-covered]:after:opacity-100",
                      sheet && "flex flex-col",
                      !sheet && value7,
                    )}
                  >
                    {value21 !== null && sheetPopup.sheet ? (
                      <value21.PopoverSheetContent
                        sheetPopup={sheetPopup as SheetRenderState & {chrome: NonNullable<SheetRenderState["chrome"]>}}
                        className={value7}
                        bodyRef={ref}
                        bodyClassName={(0, runtime.cn)(
                          popoverScrollBodyClasses,
                          value16 && "scroll-fade-y",
                          popoverPaddingClasses[value15],
                        )}
                        closeLabel={value5}
                      >
                        {value30}
                      </value21.PopoverSheetContent>
                    ) : (
                      <jsxForUiPopover.Fragment>
                        {[
                          <div
                            ref={ref}
                            tabIndex={-1}
                            data-cds-popover-body={""}
                            {...{
                              [runtime.SHEET_SCROLL_ATTRIBUTE]: "",
                            }}
                            className={(0, runtime.cn)(
                              popoverScrollBodyClasses,
                              value16 && "scroll-fade-y",
                              popoverPaddingClasses[value15],
                            )}
                          >
                            {value30}
                          </div>,
                          value29,
                        ]}
                      </jsxForUiPopover.Fragment>
                    )}
                  </PopoverPopupInner>
                </runtime.basePopover.Positioner>
              </runtime.layerBaseContext.Provider>,
            ]}
          </runtime.PortalRoot>
        </runtime.basePopover.Portal>
      );
    });
    PopoverPopupView.displayName = "PopoverPopupView";
    popoverStateContext =
      reactForUiPopover.createContext<PopoverAnchorStore | null>(null);
    popoverControlledStateContext =
      reactForUiPopover.createContext<InnerOverlayStack | null>(null);
    (PopoverRoot as React.FC<PopoverRootProps>).displayName = "Popover.Root";
    PopoverTrigger = reactForUiPopover.forwardRef(function (
      input: import("@base-ui/react/popover").Popover.Trigger.Props<void>,
      options: React.ForwardedRef<HTMLButtonElement>,
    ): React.ReactElement {
      let value = reactForUiPopover.useContext(popoverStateContext),
        callback = reactForUiPopover.useCallback(
          (input2: HTMLElement | null): void => {
            value?.update({
              triggerEl: input2,
            });
          },
          [value],
        ),
        value2 = (0, runtime.useMergedRefs)(options, callback);
      return <runtime.basePopover.Trigger {...input} ref={value2} />;
    });
    PopoverTrigger.displayName = "Popover.Trigger";
    PopoverTriggerAlias = PopoverTrigger;
    PopoverComponents = {
      Root: PopoverRoot,
      Trigger: PopoverTriggerAlias,
      Popup: PopoverPopup,
      Title: runtime.basePopover.Title,
      Description: runtime.basePopover.Description,
      Close: runtime.basePopover.Close,
      Arrow: runtime.basePopover.Arrow,
      createHandle: runtime.basePopover.createHandle,
    };
  };
}

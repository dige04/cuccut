import type {
  AlertDialogRootProps,
  BrowserWindow,
  ConfirmationDialogProps,
  ConfirmationFocus,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogPopupInnerProps,
  DialogPopupProps,
  DialogRootProps,
  DialogTitleProps,
  FocusOptionsWithVisibility,
  ForwardComponent,
  OverlayActions,
} from "../contracts/overlays";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiDialog(runtime: RuntimeBindings): () => void {
  var dialogSurfaceClasses: string;
  var dialogMaximumHeightClasses: string;
  var dialogFullHeightClasses: string;
  var dialogPopupPositionClasses: string;
  var dialogPopupTransitionClasses: string;
  var dialogBackdropClasses: string;
  var dialogStartingOpacityClass: string;
  var claudeActivityBridge: AbortController | null;
  var desktopWindowDragStripStyle: React.CSSProperties & {
    WebkitAppRegion: string;
  };
  var nestedDialogOverlayClasses: string;
  var nestedDialogBlurClasses: string;
  var dialogSizeClasses: Record<
    "sm" | "md" | "lg" | "xl" | "2xl" | "3xl",
    string
  >;
  var dialogZIndexClassPattern: RegExp;
  var dialogStateContext: React.Context<boolean | "trap-focus" | undefined>;
  var confirmationDialogContext: React.Context<boolean>;
  var dialogTitleClasses: string;
  var largeDialogTitleClasses: string;
  var dialogDescriptionSmallSpacing: string;
  var dialogDescriptionLargeSpacing: string;
  var dialogDescriptionClasses: string;
  var dialogTriggerRefContext: React.Context<
    React.RefObject<HTMLButtonElement | null> | undefined
  >;
  var dialogInitialFocusContext: React.Context<boolean>;
  var DialogTrigger: ForwardComponent<
    HTMLButtonElement,
    import("@base-ui/react/dialog").Dialog.Trigger.Props<void>
  >;
  var DIALOG_AUTOFILL_WAIT_MS: number;
  var DIALOG_HIDDEN_SELECTOR: string;
  var DialogPopupInner: ForwardComponent<HTMLDivElement, DialogPopupInnerProps>;
  var ConfirmationDialogPopupInner: ForwardComponent<
    HTMLDivElement,
    import("@base-ui/react/alert-dialog").AlertDialog.Popup.Props
  >;
  var DialogPopup: ForwardComponent<HTMLDivElement, DialogPopupProps>;
  var DialogTitle: ForwardComponent<HTMLHeadingElement, DialogTitleProps>;
  var dialogCloseButtonOutsetClasses: string;
  var DialogDescription: ForwardComponent<
    HTMLParagraphElement,
    DialogDescriptionProps
  >;
  var dialogFooterAlignmentClasses: Record<
    "start" | "center" | "end" | "between",
    string
  >;
  var Dialog: {
    Root: typeof DialogRoot;
    Trigger: typeof DialogTrigger;
    Popup: typeof DialogPopup;
    Backdrop: typeof import("@base-ui/react/dialog").Dialog.Backdrop;
    Header: typeof DialogHeader;
    Title: typeof DialogTitle;
    Description: typeof DialogDescription;
    Footer: typeof DialogFooter;
    Close: typeof import("@base-ui/react/dialog").Dialog.Close;
    CloseButton: typeof DialogCloseButton;
  };
  var AlertDialog: {
    Root: typeof AlertDialogRoot;
    Trigger: typeof import("@base-ui/react/alert-dialog").AlertDialog.Trigger;
    Popup: typeof DialogPopup;
    Backdrop: typeof import("@base-ui/react/alert-dialog").AlertDialog.Backdrop;
    Header: typeof DialogHeader;
    Title: typeof DialogTitle;
    Description: typeof DialogDescription;
    Footer: typeof DialogFooter;
    Close: typeof import("@base-ui/react/alert-dialog").AlertDialog.Close;
    CloseButton: typeof DialogCloseButton;
    createHandle: typeof import("@base-ui/react/dialog").Dialog.createHandle;
  };
  function preventDialogBackdropDefault(
    event: React.MouseEvent<HTMLDivElement>,
  ): void {
    event.preventDefault();
  }
  function preserveDialogBackdropFocus(
    event: React.MouseEvent<HTMLDivElement>,
  ): void {
    if (event.button !== 0) {
      event.preventDefault();
      return;
    }
    let currentTarget = event.currentTarget,
      parentElement = currentTarget.parentElement,
      ownerDocument = currentTarget.ownerDocument,
      value = (0, runtime.asElement)(ownerDocument.activeElement) as
        | HTMLElement
        | SVGElement
        | null;
    if (
      parentElement === null ||
      value === null ||
      !parentElement.contains(value)
    ) {
      return;
    }
    claudeActivityBridge?.abort();
    let value2 = new (ownerDocument.defaultView?.AbortController ??
      AbortController)();
    claudeActivityBridge = value2;
    let { signal: value3 } = value2;
    value3.addEventListener(
      "abort",
      () => {
        if (claudeActivityBridge === value2) {
          claudeActivityBridge = null;
        }
      },
      {
        once: true,
      },
    );
    ownerDocument.addEventListener("mousedown", () => value2.abort(), {
      capture: true,
      once: true,
      signal: value3,
    });
    ownerDocument.addEventListener(
      "mouseup",
      (event2: MouseEvent) => {
        value2.abort();
        if (
          event2.target !== currentTarget &&
          ownerDocument.activeElement === ownerDocument.body &&
          value.isConnected
        ) {
          value.focus({
            preventScroll: true,
          });
        }
      },
      {
        capture: true,
        once: true,
        signal: value3,
      },
    );
  }
  function DesktopWindowDragStrip(): React.ReactElement {
    return (
      <div
        aria-hidden={true}
        data-cds-window-drag-strip={""}
        className={"fixed inset-x-0 top-0"}
        style={desktopWindowDragStripStyle}
      />
    );
  }
  function useDialogStyleDebug(input?: string): void {
    runtime.reactForUiTooltips2.useEffect(() => {
      return;
    }, [input]);
  }
  function useDialogInitialFocus(
    input: React.RefObject<HTMLElement | null>,
    options: boolean,
    context: React.RefObject<HTMLElement | null>,
    value: React.RefObject<boolean>,
    extra: React.RefObject<boolean>,
    detail: () => HTMLElement | null,
  ): () => HTMLElement | null {
    let ref = runtime.reactForUiTooltips2.useRef<(() => void) | null>(null);
    runtime.reactForUiTooltips2.useEffect(() => () => ref.current?.(), []);
    return runtime.reactForUiTooltips2.useCallback(() => {
      let current = input.current,
        value2 = current?.ownerDocument,
        value3: BrowserWindow | null | undefined = value2?.defaultView;
      if (current && value2 && value3) {
        value3.requestAnimationFrame(() => {
          if (!value.current || !current.isConnected) {
            return;
          }
          let current2 = context.current,
            activeElement = value2.activeElement;
          if (
            current2 &&
            activeElement &&
            activeElement !== current &&
            current2.contains(activeElement)
          ) {
            return;
          }
          current.focus({
            preventScroll: true,
            focusVisible: options,
          } as FocusOptionsWithVisibility);
        });
        let index = 0,
          flag = false,
          callback = (event: FocusEvent) => {
            let current2 = context.current,
              target = event.target;
            if (
              flag ||
              !value.current ||
              extra.current ||
              index >= 3 ||
              !current2 ||
              !(target instanceof value3.Element) ||
              current2.contains(target)
            ) {
              return;
            }
            if (!target.closest(DIALOG_HIDDEN_SELECTOR)) {
              flag = true;
              return;
            }
            index += 1;
            value3.requestAnimationFrame(() => {
              let value5 = detail();
              if (
                !value.current ||
                extra.current ||
                !value5?.isConnected ||
                (value5 instanceof value3.HTMLButtonElement && value5.disabled)
              ) {
                return;
              }
              value5.focus({
                preventScroll: true,
                focusVisible: value5 !== context.current,
              } as FocusOptionsWithVisibility);
            });
          };
        ref.current?.();
        value2.addEventListener("focusin", callback, true);
        let value4 = value3.setTimeout(() => ref.current?.(), 1000);
        ref.current = () => {
          value3.clearTimeout(value4);
          value2.removeEventListener("focusin", callback, true);
          ref.current = null;
        };
      }
      return current;
    }, [input, options, context, value, extra, detail]);
  }
  function DialogCloseButton({
    "aria-label": ariaLabel,
    className: className,
    flush = false,
  }: {
    "aria-label"?: string;
    className?: string;
    flush?: boolean;
  }): React.ReactElement {
    let value = (0, runtime.useTranslation)("close", "Close");
    return (
      <runtime.baseAlertDialog.Close
        render={
          <runtime.Button
            variant={"ghost"}
            iconOnly={true}
            icon={"X"}
            aria-label={ariaLabel ?? value}
            tooltip={false}
            className={(0, runtime.cn)(
              flush && dialogCloseButtonOutsetClasses,
              className,
            )}
          />
        }
      />
    );
  }
  function DialogHeader({
    actions: actions,
    description: description,
    showClose = true,
    closeLabel: closeLabel,
    className: className,
    children: children,
  }: DialogHeaderProps): React.ReactElement {
    let value = runtime.reactForUiTooltips2.useContext(
      confirmationDialogContext,
    );
    return (
      <div
        className={(0, runtime.cn)(
          "mb-pad-md flex items-start gap-2",
          className,
        )}
      >
        {[
          <div
            className={(0, runtime.clsx)(
              value
                ? dialogDescriptionSmallSpacing
                : dialogDescriptionLargeSpacing,
              "flex min-w-0 flex-1 flex-col gap-1",
            )}
          >
            {[
              <DialogTitle>{children}</DialogTitle>,
              description && (
                <runtime.baseAlertDialog.Description
                  className={"text-body font-normal text-secondary break-words"}
                >
                  {description}
                </runtime.baseAlertDialog.Description>
              ),
            ]}
          </div>,
          actions && <div className={"-mt-pad-sm"}>{actions}</div>,
          showClose && (
            <DialogCloseButton aria-label={closeLabel} flush={true} />
          ),
        ]}
      </div>
    );
  }
  function DialogFooter({
    align = "end",
    className: className,
    children: children,
  }: DialogFooterProps): React.ReactElement {
    return (
      <div
        className={(0, runtime.cn)(
          "mt-pad-lg flex flex-col-reverse gap-2 sm:flex-row",
          "max-sm:[&>[data-cds-disabled-reason-wrapper]]:flex-col",
          dialogFooterAlignmentClasses[align],
          className,
        )}
      >
        {children}
      </div>
    );
  }
  function DialogRoot<Payload = void>({
    dismissible: dismissible,
    disablePointerDismissal: disablePointerDismissal,
    actionsRef: actionsRef,
    ...props
  }: DialogRootProps<Payload>): React.ReactElement {
    let ref = runtime.reactForUiTooltips2.useRef<HTMLButtonElement | null>(
        null,
      ),
      ref2 = runtime.reactForUiTooltips2.useRef<OverlayActions | null>(null);
    (0, runtime.useForwardedOverlayActions)(ref2, actionsRef);
    let value =
      disablePointerDismissal ?? (dismissible === false ? true : undefined);
    return (
      <confirmationDialogContext.Provider value={false}>
        <dialogStateContext.Provider value={props.modal}>
          <dialogTriggerRefContext.Provider value={ref}>
            <dialogInitialFocusContext.Provider value={!value}>
              <runtime.CloseOnActivityHideProvider actionsRef={ref2}>
                <runtime.baseAlertDialog.Root
                  disablePointerDismissal={value}
                  actionsRef={ref2}
                  {...(props as import("@base-ui/react/alert-dialog").AlertDialog.Root.Props<Payload>)}
                />
              </runtime.CloseOnActivityHideProvider>
            </dialogInitialFocusContext.Provider>
          </dialogTriggerRefContext.Provider>
        </dialogStateContext.Provider>
      </confirmationDialogContext.Provider>
    );
  }
  function AlertDialogRoot<Payload = void>({
    actionsRef: actionsRef,
    ...props
  }: AlertDialogRootProps<Payload>): React.ReactElement {
    let ref = runtime.reactForUiTooltips2.useRef<OverlayActions | null>(null);
    (0, runtime.useForwardedOverlayActions)(ref, actionsRef);
    return (
      <confirmationDialogContext.Provider value={true}>
        <dialogStateContext.Provider value={true}>
          <dialogInitialFocusContext.Provider value={false}>
            <runtime.CloseOnActivityHideProvider actionsRef={ref}>
              <runtime.baseDialog.Root {...props} actionsRef={ref} />
            </runtime.CloseOnActivityHideProvider>
          </dialogInitialFocusContext.Provider>
        </dialogStateContext.Provider>
      </confirmationDialogContext.Provider>
    );
  }
  function ConfirmationDialog({
    open: open,
    onOpenChange: onOpenChange,
    title: title,
    description: description,
    confirmLabel: confirmLabel,
    cancelLabel: cancelLabel,
    confirmVariant = "primary",
    initialFocus = "confirm",
    disabled = false,
    confirmDisabledReason: confirmDisabledReason,
    size = "sm",
    className: className,
    portalClassName: portalClassName,
    onConfirm: onConfirm,
    closeOnConfirm = false,
    children: children,
  }: ConfirmationDialogProps): React.ReactElement {
    let value = (0, runtime.useTranslation)("confirm", "Confirm"),
      value2 = (0, runtime.useTranslation)("cancel", "Cancel"),
      value3 = confirmLabel ?? value,
      value4 = cancelLabel ?? value2,
      [value5, value6] = runtime.reactForUiTooltips2.useState(false),
      ref = runtime.reactForUiTooltips2.useRef<HTMLButtonElement | null>(null),
      ref2 = runtime.reactForUiTooltips2.useRef<HTMLButtonElement | null>(null),
      { finalFocus: value7, popupRef: value8 } = (0,
      runtime.useOverlayFinalFocus)(open),
      callback = (): ConfirmationFocus =>
        initialFocus === "cancel" ? "cancel" : disabled ? "pending" : "confirm",
      [value9, value10] = runtime.reactForUiTooltips2.useState(callback),
      ref3 = runtime.reactForUiTooltips2.useRef(value9);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      ref3.current = value9;
    }, [value9]);
    let callback2 = runtime.reactForUiTooltips2.useCallback(() => {
        switch (ref3.current) {
          case "confirm":
            return ref2.current;
          case "cancel":
            return ref.current;
          default:
            return value8.current;
        }
      }, [value8]),
      ref4 = runtime.reactForUiTooltips2.useRef(false),
      callback3 = runtime.reactForUiTooltips2.useCallback(() => {
        ref4.current = true;
      }, []);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (open) {
        ref4.current = false;
        value10(callback());
      }
    }, [open]);
    let callback4 = runtime.reactForUiTooltips2.useCallback(
      (input: ConfirmationFocus): void => {
        value10(input);
        let value15 = input === "confirm" ? ref2.current : ref.current,
          current = value8.current;
        if (!value15 || !current) {
          return;
        }
        let activeElement = value15.ownerDocument.activeElement,
          value16 =
            !activeElement ||
            activeElement === current ||
            activeElement === value15.ownerDocument.body ||
            (!current.contains(activeElement) &&
              activeElement.closest(DIALOG_HIDDEN_SELECTOR) !== null),
          value17 =
            activeElement === ref.current || activeElement === ref2.current;
        if (value16 || (value17 && !ref4.current)) {
          value15.focus({
            preventScroll: true,
            focusVisible: true,
          } as FocusOptionsWithVisibility);
        }
      },
      [value8],
    );
    runtime.reactForUiTooltips2.useEffect(() => {
      if (!open || value9 !== "pending") {
        return;
      }
      if (!disabled) {
        let value16 = requestAnimationFrame(() => callback4("confirm"));
        return () => cancelAnimationFrame(value16);
      }
      let value15 = setTimeout(
        () => callback4("cancel"),
        DIALOG_AUTOFILL_WAIT_MS,
      );
      return () => clearTimeout(value15);
    }, [disabled, value9, callback4, open]);
    let ref5 = runtime.reactForUiTooltips2.useRef(open);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      ref5.current = open;
    }, [open]);
    let value11 = useDialogInitialFocus(
        value9 === "confirm" ? ref2 : value9 === "cancel" ? ref : value8,
        value9 !== "pending",
        value8,
        ref5,
        ref4,
        callback2,
      ),
      callback5 = runtime.reactForUiTooltips2.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>): void => {
          if (event.repeat && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
          }
        },
        [],
      ),
      ref6 = runtime.reactForUiTooltips2.useRef(false);
    runtime.reactForUiTooltips2.useEffect(() => {
      if (open) {
        ref6.current = false;
      }
    }, [open]);
    let value12 = (0, runtime.usePortalContainer)(),
      callback6 = runtime.reactForUiTooltips2.useCallback(() => {
        if (value5 || disabled || !open || ref6.current) {
          return;
        }
        if (closeOnConfirm) {
          ref6.current = true;
        } else {
          value6(true);
        }
        let value15: Promise<void>;
        try {
          value15 = Promise.resolve(onConfirm());
        } catch (value16: unknown) {
          value15 = Promise.reject(value16);
        }
        if (closeOnConfirm) {
          onOpenChange(false, {
            reason: "confirm",
          });
        }
        value15.finally(() => {
          if (!closeOnConfirm) {
            value6(false);
          }
        });
      }, [value5, closeOnConfirm, disabled, onConfirm, onOpenChange, open]),
      callback7 = runtime.reactForUiTooltips2.useCallback(
        (input: boolean): void => {
          if (value5 || !open) {
            return;
          }
          onOpenChange(input, {
            reason: "dismiss",
          });
        },
        [value5, onOpenChange, open],
      ),
      value13 = (0, runtime.useDefaultOverlayLayer)("modal");
    useDialogStyleDebug(portalClassName);
    let ref7 = runtime.reactForUiTooltips2.useRef<OverlayActions | null>(null),
      value14 = (
        <runtime.Button
          ref={ref2}
          variant={confirmVariant}
          busy={value5}
          disabled={disabled}
          disabledReason={confirmDisabledReason}
          data-initial-focus={value9 === "confirm" ? "" : undefined}
          onClick={callback6}
          onKeyDown={callback5}
        >
          {value3}
        </runtime.Button>
      );
    return (
      <runtime.CloseOnActivityHideProvider actionsRef={ref7}>
        <runtime.baseDialog.Root
          open={open}
          onOpenChange={callback7}
          actionsRef={ref7}
        >
          <runtime.baseDialog.Portal container={(value12) as import("../contracts/overlays").BaseUIPortalContainer}>
            <runtime.PortalRoot
              className={(0, runtime.cn)("relative", portalClassName)}
              style={value13.style}
              surface={runtime.elevationSurfaceNames.popover}
              closeOnActivityHide={true}
            >
              <runtime.layerBaseContext.Provider value={value13.base}>
                {[
                  <runtime.baseDialog.Backdrop
                    forceRender={true}
                    onMouseDown={preventDialogBackdropDefault}
                    className={(0, runtime.clsx)(
                      dialogBackdropClasses,
                      dialogStartingOpacityClass,
                    )}
                  />,
                  <DesktopWindowDragStrip />,
                  <ConfirmationDialogPopupInner
                    data-cds={"ConfirmationDialog"}
                    ref={value8 as React.Ref<HTMLDivElement>}
                    onKeyDownCapture={callback3}
                    onPointerDownCapture={callback3}
                    initialFocus={value11}
                    finalFocus={value7 as import("../contracts/overlays").BaseUIPopupFocus}
                    className={(0, runtime.cn)(
                      "draggable-none",
                      nestedDialogOverlayClasses,
                      dialogFullHeightClasses,
                      dialogPopupTransitionClasses,
                      nestedDialogBlurClasses,
                      dialogSizeClasses[size],
                      className,
                    )}
                  >
                    <div className={dialogPopupPositionClasses}>
                      {[
                        <runtime.baseDialog.Title
                          className={(0, runtime.clsx)(
                            dialogDescriptionSmallSpacing,
                            dialogTitleClasses,
                            "text-primary",
                          )}
                        >
                          {title}
                        </runtime.baseDialog.Title>,
                        description && (
                          <runtime.baseDialog.Description
                            className={dialogDescriptionClasses}
                          >
                            {description}
                          </runtime.baseDialog.Description>
                        ),
                        children,
                        <DialogFooter>
                          {[
                            <runtime.baseDialog.Close
                              render={
                                <runtime.Button
                                  ref={ref}
                                  variant={"secondary"}
                                  disabled={value5}
                                  data-initial-focus={
                                    value9 === "cancel" ? "" : undefined
                                  }
                                >
                                  {value4}
                                </runtime.Button>
                              }
                            />,
                            value14,
                          ]}
                        </DialogFooter>,
                      ]}
                    </div>
                  </ConfirmationDialogPopupInner>,
                ]}
              </runtime.layerBaseContext.Provider>
            </runtime.PortalRoot>
          </runtime.baseDialog.Portal>
        </runtime.baseDialog.Root>
      </runtime.CloseOnActivityHideProvider>
    );
  }
  bindRuntimeValue(
    runtime,
    "dialogSurfaceClasses",
    () => dialogSurfaceClasses,
    (value) => {
      dialogSurfaceClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogMaximumHeightClasses",
    () => dialogMaximumHeightClasses,
    (value) => {
      dialogMaximumHeightClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogFullHeightClasses",
    () => dialogFullHeightClasses,
    (value) => {
      dialogFullHeightClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogPopupPositionClasses",
    () => dialogPopupPositionClasses,
    (value) => {
      dialogPopupPositionClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogPopupTransitionClasses",
    () => dialogPopupTransitionClasses,
    (value) => {
      dialogPopupTransitionClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogBackdropClasses",
    () => dialogBackdropClasses,
    (value) => {
      dialogBackdropClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogStartingOpacityClass",
    () => dialogStartingOpacityClass,
    (value) => {
      dialogStartingOpacityClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventDialogBackdropDefault",
    () => preventDialogBackdropDefault,
  );
  bindRuntimeValue(
    runtime,
    "claudeActivityBridge",
    () => claudeActivityBridge,
    (value) => {
      claudeActivityBridge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveDialogBackdropFocus",
    () => preserveDialogBackdropFocus,
  );
  bindRuntimeValue(
    runtime,
    "desktopWindowDragStripStyle",
    () => desktopWindowDragStripStyle,
    (value) => {
      desktopWindowDragStripStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesktopWindowDragStrip",
    () => DesktopWindowDragStrip,
  );
  bindRuntimeValue(
    runtime,
    "nestedDialogOverlayClasses",
    () => nestedDialogOverlayClasses,
    (value) => {
      nestedDialogOverlayClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "nestedDialogBlurClasses",
    () => nestedDialogBlurClasses,
    (value) => {
      nestedDialogBlurClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogSizeClasses",
    () => dialogSizeClasses,
    (value) => {
      dialogSizeClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogZIndexClassPattern",
    () => dialogZIndexClassPattern,
    (value) => {
      dialogZIndexClassPattern = value;
    },
  );
  bindRuntimeValue(runtime, "useDialogStyleDebug", () => useDialogStyleDebug);
  bindRuntimeValue(
    runtime,
    "dialogStateContext",
    () => dialogStateContext,
    (value) => {
      dialogStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "confirmationDialogContext",
    () => confirmationDialogContext,
    (value) => {
      confirmationDialogContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogTitleClasses",
    () => dialogTitleClasses,
    (value) => {
      dialogTitleClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "largeDialogTitleClasses",
    () => largeDialogTitleClasses,
    (value) => {
      largeDialogTitleClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogDescriptionSmallSpacing",
    () => dialogDescriptionSmallSpacing,
    (value) => {
      dialogDescriptionSmallSpacing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogDescriptionLargeSpacing",
    () => dialogDescriptionLargeSpacing,
    (value) => {
      dialogDescriptionLargeSpacing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogDescriptionClasses",
    () => dialogDescriptionClasses,
    (value) => {
      dialogDescriptionClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogTriggerRefContext",
    () => dialogTriggerRefContext,
    (value) => {
      dialogTriggerRefContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogInitialFocusContext",
    () => dialogInitialFocusContext,
    (value) => {
      dialogInitialFocusContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogTrigger",
    () => DialogTrigger,
    (value) => {
      DialogTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIALOG_AUTOFILL_WAIT_MS",
    () => DIALOG_AUTOFILL_WAIT_MS,
    (value) => {
      DIALOG_AUTOFILL_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIALOG_HIDDEN_SELECTOR",
    () => DIALOG_HIDDEN_SELECTOR,
    (value) => {
      DIALOG_HIDDEN_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useDialogInitialFocus",
    () => useDialogInitialFocus,
  );
  bindRuntimeValue(
    runtime,
    "DialogPopupInner",
    () => DialogPopupInner,
    (value) => {
      DialogPopupInner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ConfirmationDialogPopupInner",
    () => ConfirmationDialogPopupInner,
    (value) => {
      ConfirmationDialogPopupInner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogPopup",
    () => DialogPopup,
    (value) => {
      DialogPopup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogTitle",
    () => DialogTitle,
    (value) => {
      DialogTitle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogCloseButtonOutsetClasses",
    () => dialogCloseButtonOutsetClasses,
    (value) => {
      dialogCloseButtonOutsetClasses = value;
    },
  );
  bindRuntimeValue(runtime, "DialogCloseButton", () => DialogCloseButton);
  bindRuntimeValue(runtime, "DialogHeader", () => DialogHeader);
  bindRuntimeValue(
    runtime,
    "DialogDescription",
    () => DialogDescription,
    (value) => {
      DialogDescription = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogFooterAlignmentClasses",
    () => dialogFooterAlignmentClasses,
    (value) => {
      dialogFooterAlignmentClasses = value;
    },
  );
  bindRuntimeValue(runtime, "DialogFooter", () => DialogFooter);
  bindRuntimeValue(runtime, "DialogRoot", () => DialogRoot);
  bindRuntimeValue(
    runtime,
    "Dialog",
    () => Dialog,
    (value) => {
      Dialog = value;
    },
  );
  bindRuntimeValue(runtime, "AlertDialogRoot", () => AlertDialogRoot);
  bindRuntimeValue(
    runtime,
    "AlertDialog",
    () => AlertDialog,
    (value) => {
      AlertDialog = value;
    },
  );
  bindRuntimeValue(runtime, "ConfirmationDialog", () => ConfirmationDialog);
  return () => {
    dialogSurfaceClasses = `${(0, runtime.getSurfaceClasses)("popover")} shadow-panel-lg`;
    dialogMaximumHeightClasses =
      "max-h-[calc(100dvh_-_max(2rem,2*var(--desktop-titlebar-inset,0px))_-_2*max(env(safe-area-inset-top,0px),env(safe-area-inset-bottom,0px)))]";
    dialogFullHeightClasses = `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-[calc(100vw-2rem)] ${dialogMaximumHeightClasses} ${dialogSurfaceClasses} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
    dialogPopupPositionClasses =
      "isolate flex min-h-0 flex-1 flex-col overflow-y-auto scroll-fade-y rounded-[inherit] p-xl";
    dialogPopupTransitionClasses =
      "transition-[opacity,scale,filter] duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.98] starting:opacity-0 starting:scale-[0.98] motion-reduce:data-[starting-style]:scale-100 data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98]";
    dialogBackdropClasses =
      "draggable-none fixed inset-0 bg-backdrop transition-opacity duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 has-[~[data-nested]]:bg-transparent has-[~[data-nested]]:backdrop-blur-none";
    dialogStartingOpacityClass = "starting:opacity-0";
    claudeActivityBridge = null;
    desktopWindowDragStripStyle = {
      height: "var(--desktop-titlebar-inset, 0px)",
      WebkitAppRegion: "drag",
    };
    nestedDialogOverlayClasses =
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:z-50 after:transition-opacity after:duration-base after:ease-out data-[nested-dialog-open]:after:opacity-100";
    nestedDialogBlurClasses = "data-[nested-dialog-open]:blur-[2px]";
    dialogSizeClasses = {
      sm: "max-w-[400px]",
      md: "max-w-[520px]",
      lg: "max-w-[720px]",
      xl: "max-w-[880px]",
      "2xl": "max-w-[1024px]",
      "3xl": "max-w-[1152px]",
    };
    dialogZIndexClassPattern = /(^|\s)!?-?z-/;
    dialogStateContext = runtime.reactForUiTooltips2.createContext<
      boolean | "trap-focus" | undefined
    >(undefined);
    confirmationDialogContext =
      runtime.reactForUiTooltips2.createContext(false);
    dialogTitleClasses = "text-heading font-medium break-words";
    largeDialogTitleClasses = "text-title font-semibold break-words";
    dialogDescriptionSmallSpacing = "-mt-0.5";
    dialogDescriptionLargeSpacing = "-mt-1";
    dialogDescriptionClasses =
      "mt-1 text-body font-normal text-secondary break-words";
    dialogTriggerRefContext = runtime.reactForUiTooltips2.createContext<
      React.RefObject<HTMLButtonElement | null> | undefined
    >(undefined);
    dialogInitialFocusContext =
      runtime.reactForUiTooltips2.createContext(false);
    DialogTrigger = runtime.reactForUiTooltips2.forwardRef(
      (
        input: import("@base-ui/react/dialog").Dialog.Trigger.Props<void>,
        options: React.ForwardedRef<HTMLButtonElement>,
      ): React.ReactElement => {
        let value = runtime.reactForUiTooltips2.useContext(
            dialogTriggerRefContext,
          ),
          value2 = input.handle ? null : (value ?? null),
          value3 = (0, runtime.useMergedRefs)(options, value2);
        return <runtime.baseAlertDialog.Trigger ref={value3} {...(input as import("@base-ui/react/alert-dialog").AlertDialog.Trigger.Props<void>)} />;
      },
    );
    DialogTrigger.displayName = "Dialog.Trigger";
    DIALOG_AUTOFILL_WAIT_MS = 250;
    DIALOG_HIDDEN_SELECTOR = '[aria-hidden="true"], [inert]';
    DialogPopupInner = runtime.reactForUiTooltips2.forwardRef(
      (
        {
          finalFocus: finalFocus,
          fitVisualViewport: fitVisualViewport,
          children: children,
          ...props
        }: DialogPopupInnerProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = runtime.reactForUiTooltips2.useContext(dialogStateContext),
          value2 = runtime.reactForUiTooltips2.useContext(
            dialogTriggerRefContext,
          ),
          { finalFocus: value3, popupRef: value4 } = (0,
          runtime.useOverlayFinalFocus)(true, value !== false, value2),
          value5 = (0, runtime.useDialogVisualKeyboard)(fitVisualViewport),
          value6 = (0, runtime.useMergedRefs)(options, value4, value5);
        return (
          <runtime.baseAlertDialog.Popup
            {...{
              [runtime.OVERLAY_ATTRIBUTE]: "",
            }}
            ref={value6}
            finalFocus={(finalFocus ?? value3) as import("../contracts/overlays").BaseUIPopupFocus}
            aria-modal={value === false ? "false" : undefined}
            {...props}
          >
            {children}
          </runtime.baseAlertDialog.Popup>
        );
      },
    );
    DialogPopupInner.displayName = "Dialog.PopupInner";
    ConfirmationDialogPopupInner = runtime.reactForUiTooltips2.forwardRef(
      (
        {
          children: children,
          ...props
        }: import("@base-ui/react/alert-dialog").AlertDialog.Popup.Props,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = (0, runtime.useDialogVisualKeyboard)(true),
          value2 = (0, runtime.useMergedRefs)(options, value);
        return (
          <runtime.baseDialog.Popup
            {...{
              [runtime.OVERLAY_ATTRIBUTE]: "",
            }}
            ref={value2}
            {...props}
          >
            {children}
          </runtime.baseDialog.Popup>
        );
      },
    );
    ConfirmationDialogPopupInner.displayName = "ConfirmationDialog.PopupInner";
    DialogPopup = runtime.reactForUiTooltips2.forwardRef(
      (
        {
          size = "md",
          fullHeight = false,
          unstyled = false,
          surface: surface,
          backdropClassName: backdropClassName,
          backdropStyle: backdropStyle,
          portalClassName: portalClassName,
          className: className,
          children: children,
          ...props
        }: DialogPopupProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ): React.ReactElement => {
        let value = unstyled
            ? ""
            : `${dialogFullHeightClasses} ${dialogPopupTransitionClasses} ${nestedDialogBlurClasses} ${dialogSizeClasses[size]} ${fullHeight ? "h-dvh" : ""}`,
          value2 = (0, runtime.useDefaultOverlayLayer)("modal");
        useDialogStyleDebug(portalClassName);
        let value3 = runtime.reactForUiTooltips2.useContext(dialogStateContext),
          value4 = runtime.reactForUiTooltips2.useContext(
            dialogInitialFocusContext,
          ),
          value5 = value3 === undefined || value3 === true;
        return (
          <runtime.baseAlertDialog.Portal
            container={((0, runtime.usePortalContainer)()) as import("../contracts/overlays").BaseUIPortalContainer}
          >
            <runtime.PortalRoot
              className={(0, runtime.cn)("relative", portalClassName)}
              style={value2.style}
              surface={
                surface ??
                (unstyled ? undefined : runtime.elevationSurfaceNames.popover)
              }
              closeOnActivityHide={true}
            >
              <runtime.layerBaseContext.Provider value={value2.base}>
                {[
                  <runtime.baseAlertDialog.Backdrop
                    forceRender={value5}
                    onMouseDown={
                      value4
                        ? preserveDialogBackdropFocus
                        : preventDialogBackdropDefault
                    }
                    className={(0, runtime.cn)(
                      dialogBackdropClasses,
                      !unstyled && dialogStartingOpacityClass,
                      value3 === false && "pointer-events-none opacity-0",
                      backdropClassName,
                    )}
                    style={backdropStyle}
                  />,
                  <DesktopWindowDragStrip />,
                  <DialogPopupInner
                    data-cds={"Dialog"}
                    ref={options}
                    {...props}
                    fitVisualViewport={!unstyled}
                    className={(0, runtime.cn)(
                      "draggable-none",
                      nestedDialogOverlayClasses,
                      value,
                      className,
                    )}
                  >
                    {unstyled ? (
                      children
                    ) : (
                      <div className={dialogPopupPositionClasses}>
                        {children}
                      </div>
                    )}
                  </DialogPopupInner>,
                ]}
              </runtime.layerBaseContext.Provider>
            </runtime.PortalRoot>
          </runtime.baseAlertDialog.Portal>
        );
      },
    );
    DialogPopup.displayName = "Dialog.Popup";
    DialogTitle = runtime.reactForUiTooltips2.forwardRef(
      (
        { className: className, ...props }: DialogTitleProps,
        options: React.ForwardedRef<HTMLHeadingElement>,
      ): React.ReactElement => {
        let value = runtime.reactForUiTooltips2.useContext(
          confirmationDialogContext,
        );
        return (
          <runtime.baseAlertDialog.Title
            ref={options}
            {...props}
            className={(0, runtime.cn)(
              "text-primary",
              value ? dialogTitleClasses : largeDialogTitleClasses,
              className,
            )}
          />
        );
      },
    );
    DialogTitle.displayName = "Dialog.Title";
    dialogCloseButtonOutsetClasses = "-me-pad-sm -mt-pad-sm";
    (
      DialogCloseButton as typeof DialogCloseButton & {
        displayName?: string;
      }
    ).displayName = "Dialog.CloseButton";
    (
      DialogHeader as typeof DialogHeader & {
        displayName?: string;
      }
    ).displayName = "Dialog.Header";
    DialogDescription = runtime.reactForUiTooltips2.forwardRef(
      (
        { className: className, ...props }: DialogDescriptionProps,
        options: React.ForwardedRef<HTMLParagraphElement>,
      ): React.ReactElement => (
        <runtime.baseAlertDialog.Description
          ref={options}
          {...props}
          className={(0, runtime.cn)(dialogDescriptionClasses, className)}
        />
      ),
    );
    DialogDescription.displayName = "Dialog.Description";
    dialogFooterAlignmentClasses = {
      start: "sm:justify-start",
      center: "sm:justify-center",
      end: "sm:justify-end",
      between: "sm:justify-between",
    };
    (
      DialogFooter as typeof DialogFooter & {
        displayName?: string;
      }
    ).displayName = "Dialog.Footer";
    (
      DialogRoot as typeof DialogRoot & {
        displayName?: string;
      }
    ).displayName = "Dialog.Root";
    Dialog = {
      Root: DialogRoot,
      Trigger: DialogTrigger,
      Popup: DialogPopup,
      Backdrop: runtime.baseAlertDialog.Backdrop,
      Header: DialogHeader,
      Title: DialogTitle,
      Description: DialogDescription,
      Footer: DialogFooter,
      Close: runtime.baseAlertDialog.Close,
      CloseButton: DialogCloseButton,
    };
    (
      AlertDialogRoot as typeof AlertDialogRoot & {
        displayName?: string;
      }
    ).displayName = "AlertDialog.Root";
    AlertDialog = {
      Root: AlertDialogRoot,
      Trigger: runtime.baseDialog.Trigger,
      Popup: DialogPopup,
      Backdrop: runtime.baseDialog.Backdrop,
      Header: DialogHeader,
      Title: DialogTitle,
      Description: DialogDescription,
      Footer: DialogFooter,
      Close: runtime.baseDialog.Close,
      CloseButton: DialogCloseButton,
      createHandle: runtime.baseDialog.createHandle,
    };
  };
}

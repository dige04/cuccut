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
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsDialogDialog(runtime: RuntimeBindings): () => void {
  var reactDialogDialog: typeof React;
  var jsxDialogDialog: typeof import("react/jsx-runtime");
  var DialogDialogCss: string;
  var DialogDialogClassNames: string;
  var DialogDialogCss_2: string;
  var DialogDialogClassNames_2: string;
  var dialogBackdropClasses: string;
  var DialogDialogClassNames_3: string;
  var StartingOpacity0Value: string;
  var DialogDialogCurrentState: AbortController | null;
  var DialogDialogHeightWebkitAppRegionConfig: React.CSSProperties & {
    WebkitAppRegion: string;
  };
  var DialogDialogClassNames_4: string;
  var DataNestedDialogOpenBlur2pxValue: string;
  var DialogDialogSmMdLgConfig: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
  var DialogDialogPattern: RegExp;
  var DialogDialogContext: React.Context<boolean | "trap-focus" | undefined>;
  var DialogDialogContext_2: React.Context<boolean>;
  var DialogDialogClassNames_5: string;
  var DialogDialogClassNames_6: string;
  var Mt05Value: string;
  var Mt1Value: string;
  var DialogDialogClassNames_7: string;
  var DialogDialogContext_3: React.Context<
    React.RefObject<HTMLButtonElement | null> | undefined
  >;
  var DialogDialogContext_4: React.Context<boolean>;
  var DialogTrigger: ForwardComponent<
    HTMLButtonElement,
    import("@base-ui/react/dialog").Dialog.Trigger.Props<void>
  >;
  var DialogDialogDelayMs: number;
  var DialogDialogLabel: string;
  var DialogPopupInner: ForwardComponent<HTMLDivElement, DialogPopupInnerProps>;
  var ConfirmationDialogPopupInner: ForwardComponent<
    HTMLDivElement,
    import("@base-ui/react/alert-dialog").AlertDialog.Popup.Props
  >;
  var DialogPopup: ForwardComponent<HTMLDivElement, DialogPopupProps>;
  var DialogTitle: ForwardComponent<HTMLHeadingElement, DialogTitleProps>;
  var DialogDialogLabel_2: string;
  var DialogDescription: ForwardComponent<
    HTMLParagraphElement,
    DialogDescriptionProps
  >;
  var DialogDialogStartCenterEndConfig: {
    start: string;
    center: string;
    end: string;
    between: string;
  };
  var DialogDialogRootTriggerPopupConfig: {
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
  var DialogDialogRootTriggerPopupConfig_2: {
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
    createHandle: typeof import("@base-ui/react/alert-dialog").AlertDialog.createHandle;
  };
  var initializeDialogDialog: () => void;
  function WindowDragStrip(): React.ReactElement {
    return (
      <div
        aria-hidden={true}
        data-cds-window-drag-strip={""}
        className={"fixed inset-x-0 top-0"}
        style={DialogDialogHeightWebkitAppRegionConfig}
      />
    );
  }
  function useDialogPresence(input?: string): void {
    (0, reactDialogDialog.useEffect)(() => {}, [input]);
  }
  function useDialogOpenAutofocus(
    input: React.RefObject<HTMLElement | null>,
    options: boolean,
    context: React.RefObject<HTMLElement | null>,
    value: React.RefObject<boolean>,
    extra: React.RefObject<boolean>,
    detail: () => HTMLElement | null,
  ): () => HTMLElement | null {
    return (0, reactDialogDialog.useCallback)(() => {
      let current = input.current,
        value2 = current?.ownerDocument,
        value3: BrowserWindow | null | undefined = value2?.defaultView as
          | BrowserWindow
          | null
          | undefined;
      if (current && value2 && value3) {
        value3.requestAnimationFrame(() => {
          if (!value.current || !current.isConnected) return;
          let current2 = context.current,
            activeElement = value2.activeElement;
          (current2 &&
            activeElement &&
            activeElement !== current &&
            current2.contains(activeElement)) ||
            current.focus({
              preventScroll: true,
              focusVisible: options,
            } as FocusOptionsWithVisibility);
        });
        let index = 0,
          flag = false,
          callback = (event: FocusEvent): void => {
            let current2 = context.current,
              target = event.target;
            if (
              !(
                flag ||
                !value.current ||
                extra.current ||
                index >= 3 ||
                !current2 ||
                !(target instanceof value3.Element) ||
                current2.contains(target)
              )
            ) {
              if (!(target as Element).closest(DialogDialogLabel)) {
                flag = true;
                return;
              }
              index += 1;
              value3.requestAnimationFrame(() => {
                let value4 = detail();
                !value.current ||
                  extra.current ||
                  !value4?.isConnected ||
                  (value4 instanceof value3.HTMLButtonElement &&
                    value4.disabled) ||
                  value4.focus({
                    preventScroll: true,
                    focusVisible: value4 !== context.current,
                  } as FocusOptionsWithVisibility);
              });
            }
          };
        value2.addEventListener("focusin", callback, true);
        value3.setTimeout(() => {
          value2.removeEventListener("focusin", callback, true);
        }, 1e3);
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
    let value = (0, runtime.useLabel)("close", "Close");
    return (
      <runtime.npm_Dialog_Xg.Close
        render={
          <runtime.Button
            variant={"ghost"}
            iconOnly={true}
            icon={"X"}
            aria-label={ariaLabel ?? value}
            tooltip={false}
            className={(0, runtime.cn)(flush && DialogDialogLabel_2, className)}
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
    let value = (0, reactDialogDialog.useContext)(DialogDialogContext_2);
    return (
      <div
        className={(0, runtime.cn)(
          "mb-pad-md flex items-start gap-2",
          className,
        )}
      >
        <div
          className={(0, runtime.npm_clsx_Ea)(
            value ? Mt05Value : Mt1Value,
            "flex min-w-0 flex-1 flex-col gap-1",
          )}
        >
          <DialogTitle className={"break-words"}>{children}</DialogTitle>
          {description && (
            <runtime.npm_Dialog_Xg.Description
              className={"text-body font-normal text-secondary"}
            >
              {description}
            </runtime.npm_Dialog_Xg.Description>
          )}
        </div>
        {actions && <div className={"-mt-pad-sm"}>{actions}</div>}
        {showClose && (
          <DialogCloseButton aria-label={closeLabel} flush={true} />
        )}
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
          DialogDialogStartCenterEndConfig[align],
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
    let value = (0, reactDialogDialog.useRef)<HTMLButtonElement | null>(null),
      value2 = (0, reactDialogDialog.useRef)<OverlayActions | null>(null);
    (0, runtime.useOverlayImperativeHandle)(value2, actionsRef);
    let value3 =
      disablePointerDismissal ?? (dismissible === false ? true : undefined);
    return (
      <DialogDialogContext_2.Provider value={false}>
        <DialogDialogContext.Provider value={props.modal}>
          <DialogDialogContext_3.Provider value={value}>
            <DialogDialogContext_4.Provider value={!value3}>
              <runtime.ActivityBoundary actionsRef={value2}>
                <runtime.npm_Dialog_Xg.Root
                  disablePointerDismissal={value3}
                  actionsRef={value2}
                  {...props}
                />
              </runtime.ActivityBoundary>
            </DialogDialogContext_4.Provider>
          </DialogDialogContext_3.Provider>
        </DialogDialogContext.Provider>
      </DialogDialogContext_2.Provider>
    );
  }
  function AlertDialogRoot<Payload = void>({
    actionsRef: actionsRef,
    ...props
  }: AlertDialogRootProps<Payload>): React.ReactElement {
    let value = (0, reactDialogDialog.useRef)<OverlayActions | null>(null);
    (0, runtime.useOverlayImperativeHandle)(value, actionsRef);
    return (
      <DialogDialogContext_2.Provider value={true}>
        <DialogDialogContext.Provider value={true}>
          <DialogDialogContext_4.Provider value={false}>
            <runtime.ActivityBoundary actionsRef={value}>
              <runtime.npm_AlertDialog_Dh.Root {...props} actionsRef={value} />
            </runtime.ActivityBoundary>
          </DialogDialogContext_4.Provider>
        </DialogDialogContext.Provider>
      </DialogDialogContext_2.Provider>
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
    disabled: disabled2 = false,
    confirmDisabledReason: confirmDisabledReason,
    size = "sm",
    className: className,
    portalClassName: portalClassName,
    onConfirm: onConfirm,
    closeOnConfirm = false,
    children: children,
  }: ConfirmationDialogProps): React.ReactElement {
    let value = (0, runtime.useLabel)("confirm", "Confirm"),
      value2 = (0, runtime.useLabel)("cancel", "Cancel"),
      value3 = confirmLabel ?? value,
      value4 = cancelLabel ?? value2,
      [value5, value6] = (0, reactDialogDialog.useState)(false),
      value7 = (0, reactDialogDialog.useRef)<HTMLButtonElement | null>(null),
      value8 = (0, reactDialogDialog.useRef)<HTMLButtonElement | null>(null),
      { finalFocus: value9, popupRef: value10 } = (0, runtime.useFinalFocus)(
        open,
      ),
      callback = (): ConfirmationFocus =>
        initialFocus === "cancel"
          ? "cancel"
          : disabled2
            ? "pending"
            : "confirm",
      [value11, value12] = (0, reactDialogDialog.useState)(callback),
      value13 = (0, reactDialogDialog.useRef)(value11);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value13.current = value11;
    }, [value11]);
    let value14 = (0, reactDialogDialog.useCallback)(() => {
        switch (value13.current) {
          case "confirm":
            return value8.current;
          case "cancel":
            return value7.current;
          default:
            return value10.current;
        }
      }, [value10]),
      value15 = (0, reactDialogDialog.useRef)(false),
      value16 = (0, reactDialogDialog.useCallback)(() => {
        value15.current = true;
      }, []);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      open && ((value15.current = false), value12(callback()));
    }, [open]);
    let value17 = (0, reactDialogDialog.useCallback)(
      (input: ConfirmationFocus): void => {
        value12(input);
        let value28 = input === "confirm" ? value8.current : value7.current,
          current = value10.current;
        if (!value28 || !current) return;
        let activeElement = value28.ownerDocument.activeElement,
          value29 =
            !activeElement ||
            activeElement === current ||
            activeElement === value28.ownerDocument.body ||
            (!current.contains(activeElement) &&
              activeElement.closest(DialogDialogLabel) !== null),
          value30 =
            activeElement === value7.current ||
            activeElement === value8.current;
        (value29 || (value30 && !value15.current)) &&
          value28.focus({
            preventScroll: true,
            focusVisible: true,
          } as FocusOptionsWithVisibility);
      },
      [value10],
    );
    (0, reactDialogDialog.useEffect)(() => {
      if (!open || value11 !== "pending") return;
      if (!disabled2) {
        let value29 = requestAnimationFrame(() => value17("confirm"));
        return () => cancelAnimationFrame(value29);
      }
      let value28: ReturnType<typeof setTimeout> = setTimeout(
        () => value17("cancel"),
        DialogDialogDelayMs,
      );
      return () => clearTimeout(value28);
    }, [disabled2, value11, value17, open]);
    let value18 = (0, reactDialogDialog.useRef)(open);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value18.current = open;
    }, [open]);
    let value19 = useDialogOpenAutofocus(
        value11 === "confirm"
          ? value8
          : value11 === "cancel"
            ? value7
            : value10,
        value11 !== "pending",
        value10,
        value18,
        value15,
        value14,
      ),
      value20 = (0, reactDialogDialog.useCallback)(
        (event: React.KeyboardEvent<HTMLButtonElement>): void => {
          event.repeat &&
            (event.key === "Enter" || event.key === " ") &&
            event.preventDefault();
        },
        [],
      ),
      value21 = (0, reactDialogDialog.useRef)(false);
    (0, reactDialogDialog.useEffect)(() => {
      open && (value21.current = false);
    }, [open]);
    let value22 = (0, runtime.useOverlayRoot)(),
      value23 = (0, reactDialogDialog.useCallback)(() => {
        if (value5 || disabled2 || !open || value21.current) return;
        closeOnConfirm ? (value21.current = true) : value6(true);
        let value28: Promise<void>;
        try {
          value28 = Promise.resolve(onConfirm());
        } catch (value29) {
          value28 = Promise.reject(value29);
        }
        closeOnConfirm &&
          onOpenChange(false, {
            reason: "confirm",
          });
        value28.finally(() => {
          closeOnConfirm || value6(false);
        });
      }, [value5, closeOnConfirm, disabled2, onConfirm, onOpenChange, open]),
      value24 = (0, reactDialogDialog.useCallback)(
        (input: boolean): void => {
          value5 ||
            !open ||
            onOpenChange(input, {
              reason: "dismiss",
            });
        },
        [value5, onOpenChange, open],
      ),
      value25 = (0, runtime.useDefaultLayer)("modal");
    useDialogPresence(portalClassName);
    let value26 = (0, reactDialogDialog.useRef)<OverlayActions | null>(null),
      value27 = (
        <runtime.Button
          ref={value8}
          variant={confirmVariant}
          busy={value5}
          disabled={disabled2}
          data-initial-focus={value11 === "confirm" ? "" : undefined}
          onClick={value23}
          onKeyDown={value20}
        >
          {value3}
        </runtime.Button>
      );
    return (
      <runtime.ActivityBoundary actionsRef={value26}>
        <runtime.npm_AlertDialog_Dh.Root
          open={open}
          onOpenChange={value24}
          actionsRef={value26}
        >
          <runtime.npm_AlertDialog_Dh.Portal container={value22}>
            <runtime.PopupSurface
              className={(0, runtime.cn)("relative", portalClassName)}
              style={value25.style}
              surface={runtime.surfaceBackgroundTokens.popover}
              closeOnActivityHide={true}
            >
              <runtime.LayerBaseContext.Provider value={value25.base}>
                <runtime.npm_AlertDialog_Dh.Backdrop
                  forceRender={true}
                  onMouseDown={runtime.preventDialogMouseSelection}
                  className={(0, runtime.npm_clsx_Ea)(
                    DialogDialogClassNames_3,
                    StartingOpacity0Value,
                  )}
                />
                <WindowDragStrip />
                <ConfirmationDialogPopupInner
                  data-cds={"ConfirmationDialog"}
                  ref={value10}
                  onKeyDownCapture={value16}
                  onPointerDownCapture={value16}
                  initialFocus={value19}
                  finalFocus={value9}
                  className={(0, runtime.cn)(
                    "draggable-none",
                    DialogDialogClassNames_4,
                    DialogDialogCss_2,
                    dialogBackdropClasses,
                    DataNestedDialogOpenBlur2pxValue,
                    DialogDialogSmMdLgConfig[size],
                    className,
                  )}
                >
                  <div className={DialogDialogClassNames_2}>
                    <runtime.npm_AlertDialog_Dh.Title
                      className={(0, runtime.npm_clsx_Ea)(
                        Mt05Value,
                        DialogDialogClassNames_5,
                        "text-primary",
                      )}
                    >
                      {title}
                    </runtime.npm_AlertDialog_Dh.Title>
                    {description && (
                      <runtime.npm_AlertDialog_Dh.Description
                        className={DialogDialogClassNames_7}
                      >
                        {description}
                      </runtime.npm_AlertDialog_Dh.Description>
                    )}
                    {children}
                    <DialogFooter>
                      <runtime.npm_AlertDialog_Dh.Close
                        render={
                          <runtime.Button
                            ref={value7}
                            variant={"secondary"}
                            disabled={value5}
                            data-initial-focus={
                              value11 === "cancel" ? "" : undefined
                            }
                          >
                            {value4}
                          </runtime.Button>
                        }
                      />
                      {confirmDisabledReason === undefined ? (
                        value27
                      ) : (
                        <runtime.DeferredDisabledReasonTooltip
                          reason={disabled2 ? confirmDisabledReason : undefined}
                          wrapperClassName={"flex-col"}
                        >
                          {value27}
                        </runtime.DeferredDisabledReasonTooltip>
                      )}
                    </DialogFooter>
                  </div>
                </ConfirmationDialogPopupInner>
              </runtime.LayerBaseContext.Provider>
            </runtime.PopupSurface>
          </runtime.npm_AlertDialog_Dh.Portal>
        </runtime.npm_AlertDialog_Dh.Root>
      </runtime.ActivityBoundary>
    );
  }
  bindRuntimeValue(runtime, "WindowDragStrip", () => WindowDragStrip);
  bindRuntimeValue(runtime, "useDialogPresence", () => useDialogPresence);
  bindRuntimeValue(
    runtime,
    "useDialogOpenAutofocus",
    () => useDialogOpenAutofocus,
  );
  bindRuntimeValue(runtime, "DialogCloseButton", () => DialogCloseButton);
  bindRuntimeValue(runtime, "DialogHeader", () => DialogHeader);
  bindRuntimeValue(runtime, "DialogFooter", () => DialogFooter);
  bindRuntimeValue(runtime, "DialogRoot", () => DialogRoot);
  bindRuntimeValue(runtime, "AlertDialogRoot", () => AlertDialogRoot);
  bindRuntimeValue(runtime, "ConfirmationDialog", () => ConfirmationDialog);
  bindRuntimeValue(
    runtime,
    "reactDialogDialog",
    () => reactDialogDialog,
    (value) => {
      reactDialogDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxDialogDialog",
    () => jsxDialogDialog,
    (value) => {
      jsxDialogDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogCss",
    () => DialogDialogCss,
    (value) => {
      DialogDialogCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogClassNames",
    () => DialogDialogClassNames,
    (value) => {
      DialogDialogClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogCss_2",
    () => DialogDialogCss_2,
    (value) => {
      DialogDialogCss_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogClassNames_2",
    () => DialogDialogClassNames_2,
    (value) => {
      DialogDialogClassNames_2 = value;
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
    "DialogDialogClassNames_3",
    () => DialogDialogClassNames_3,
    (value) => {
      DialogDialogClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StartingOpacity0Value",
    () => StartingOpacity0Value,
    (value) => {
      StartingOpacity0Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogCurrentState",
    () => DialogDialogCurrentState,
    (value) => {
      DialogDialogCurrentState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogHeightWebkitAppRegionConfig",
    () => DialogDialogHeightWebkitAppRegionConfig,
    (value) => {
      DialogDialogHeightWebkitAppRegionConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogClassNames_4",
    () => DialogDialogClassNames_4,
    (value) => {
      DialogDialogClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DataNestedDialogOpenBlur2pxValue",
    () => DataNestedDialogOpenBlur2pxValue,
    (value) => {
      DataNestedDialogOpenBlur2pxValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogSmMdLgConfig",
    () => DialogDialogSmMdLgConfig,
    (value) => {
      DialogDialogSmMdLgConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogPattern",
    () => DialogDialogPattern,
    (value) => {
      DialogDialogPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogContext",
    () => DialogDialogContext,
    (value) => {
      DialogDialogContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogContext_2",
    () => DialogDialogContext_2,
    (value) => {
      DialogDialogContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogClassNames_5",
    () => DialogDialogClassNames_5,
    (value) => {
      DialogDialogClassNames_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogClassNames_6",
    () => DialogDialogClassNames_6,
    (value) => {
      DialogDialogClassNames_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Mt05Value",
    () => Mt05Value,
    (value) => {
      Mt05Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Mt1Value",
    () => Mt1Value,
    (value) => {
      Mt1Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogClassNames_7",
    () => DialogDialogClassNames_7,
    (value) => {
      DialogDialogClassNames_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogContext_3",
    () => DialogDialogContext_3,
    (value) => {
      DialogDialogContext_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogContext_4",
    () => DialogDialogContext_4,
    (value) => {
      DialogDialogContext_4 = value;
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
    "DialogDialogDelayMs",
    () => DialogDialogDelayMs,
    (value) => {
      DialogDialogDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogLabel",
    () => DialogDialogLabel,
    (value) => {
      DialogDialogLabel = value;
    },
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
    "DialogDialogLabel_2",
    () => DialogDialogLabel_2,
    (value) => {
      DialogDialogLabel_2 = value;
    },
  );
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
    "DialogDialogStartCenterEndConfig",
    () => DialogDialogStartCenterEndConfig,
    (value) => {
      DialogDialogStartCenterEndConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogRootTriggerPopupConfig",
    () => DialogDialogRootTriggerPopupConfig,
    (value) => {
      DialogDialogRootTriggerPopupConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DialogDialogRootTriggerPopupConfig_2",
    () => DialogDialogRootTriggerPopupConfig_2,
    (value) => {
      DialogDialogRootTriggerPopupConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDialogDialog",
    () => initializeDialogDialog,
    (value) => {
      initializeDialogDialog = value;
    },
  );
  return () => {
    initializeDialogDialog = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeHooksStableCallback)();
      (0, runtime.initializeOverlaysLayers)();
      (0, runtime.initializeOverlayAttributes)();
      (0, runtime.initializeDomRefComposition_3)();
      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializePlatformRootFontSize_2)();
      (0, runtime.initializeTooltipDeferredProvider)();
      (0, runtime.initializeButtonButton)();
      (0, runtime.initializeThemeSurfaces)();
      (0, runtime.initializeOverlaysImperativeHandle)();
      (0, runtime.initializeSheetsScrollArea_6)();
      (0, runtime.initializeComponentsTextLink_2)();
      reactDialogDialog = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxDialogDialog = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_sYe)();
      (0, runtime.initializeNpm__base_ui_react_uYe)();
      DialogDialogCss = `${(0, runtime.popupSurfaceClassName)("popover")} shadow-panel-lg`;
      DialogDialogClassNames =
        "max-h-[calc(100dvh_-_max(2rem,2*var(--desktop-titlebar-inset,0px))_-_2*max(env(safe-area-inset-top,0px),env(safe-area-inset-bottom,0px)))]";
      DialogDialogCss_2 = `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-[calc(100vw-2rem)] ${DialogDialogClassNames} ${DialogDialogCss} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      DialogDialogClassNames_2 =
        "isolate flex min-h-0 flex-1 flex-col overflow-y-auto scroll-fade-y rounded-[inherit] p-xl";
      dialogBackdropClasses =
        "transition-[opacity,scale,filter] duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.98] starting:opacity-0 starting:scale-[0.98] motion-reduce:data-[starting-style]:scale-100 data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98]";
      DialogDialogClassNames_3 =
        "draggable-none fixed inset-0 bg-backdrop backdrop-blur-[2px] transition-opacity duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 has-[~[data-nested]]:bg-transparent has-[~[data-nested]]:backdrop-blur-none";
      StartingOpacity0Value = "starting:opacity-0";
      DialogDialogCurrentState = null;
      DialogDialogHeightWebkitAppRegionConfig = {
        height: "var(--desktop-titlebar-inset, 0px)",
        WebkitAppRegion: "drag",
      };
      DialogDialogClassNames_4 =
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:z-50 after:transition-opacity after:duration-base after:ease-out data-[nested-dialog-open]:after:opacity-100";
      DataNestedDialogOpenBlur2pxValue = "data-[nested-dialog-open]:blur-[2px]";
      DialogDialogSmMdLgConfig = {
        sm: "max-w-[400px]",
        md: "max-w-[520px]",
        lg: "max-w-[720px]",
        xl: "max-w-[880px]",
        "2xl": "max-w-[1024px]",
        "3xl": "max-w-[1152px]",
      };
      DialogDialogPattern = /(^|\s)!?-?z-/;
      DialogDialogContext = (0, reactDialogDialog.createContext)<
        boolean | "trap-focus" | undefined
      >(undefined);
      DialogDialogContext_2 = (0, reactDialogDialog.createContext)(false);
      DialogDialogClassNames_5 = "text-heading font-medium";
      DialogDialogClassNames_6 = "text-title font-semibold";
      Mt05Value = "-mt-0.5";
      Mt1Value = "-mt-1";
      DialogDialogClassNames_7 = "mt-1 text-body font-normal text-secondary";
      DialogDialogContext_3 = (0, reactDialogDialog.createContext)<
        React.RefObject<HTMLButtonElement | null> | undefined
      >(undefined);
      DialogDialogContext_4 = (0, reactDialogDialog.createContext)(false);
      DialogTrigger = (0, reactDialogDialog.forwardRef)<
        HTMLButtonElement,
        import("@base-ui/react/dialog").Dialog.Trigger.Props<void>
      >(
        (
          input: import("@base-ui/react/dialog").Dialog.Trigger.Props<void>,
          options: React.ForwardedRef<HTMLButtonElement>,
        ): React.ReactElement => {
          let value = (0, reactDialogDialog.useContext)(DialogDialogContext_3),
            value2 = input.handle ? null : (value ?? null),
            value3 = (0, runtime.useMergedRefs)(options, value2);
          return <runtime.npm_Dialog_Xg.Trigger ref={value3} {...input} />;
        },
      );
      DialogTrigger.displayName = "Dialog.Trigger";
      DialogDialogDelayMs = 250;
      DialogDialogLabel = '[aria-hidden="true"], [inert]';
      DialogPopupInner = (0, reactDialogDialog.forwardRef)<
        HTMLDivElement,
        DialogPopupInnerProps
      >(
        (
          {
            finalFocus: finalFocus,
            fitVisualViewport: fitVisualViewport,
            children: children,
            ...props
          }: DialogPopupInnerProps,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = (0, reactDialogDialog.useContext)(DialogDialogContext),
            value2 = (0, reactDialogDialog.useContext)(DialogDialogContext_3),
            { finalFocus: value3, popupRef: value4 } = (0,
            runtime.useFinalFocus)(true, value !== false, value2),
            value5 = (0, runtime.useDialogKeyboardViewport)(fitVisualViewport),
            value6 = (0, runtime.useMergedRefs)(options, value4, value5);
          return (
            <runtime.npm_Dialog_Xg.Popup
              {...{
                [runtime.overlayAttribute]: "",
              }}
              ref={value6}
              finalFocus={finalFocus ?? value3}
              aria-modal={value === false ? "false" : undefined}
              {...props}
            >
              {children}
            </runtime.npm_Dialog_Xg.Popup>
          );
        },
      );
      DialogPopupInner.displayName = "Dialog.PopupInner";
      ConfirmationDialogPopupInner = (0, reactDialogDialog.forwardRef)<
        HTMLDivElement,
        import("@base-ui/react/alert-dialog").AlertDialog.Popup.Props
      >(
        (
          {
            children: children,
            ...props
          }: import("@base-ui/react/alert-dialog").AlertDialog.Popup.Props,
          options: React.ForwardedRef<HTMLDivElement>,
        ): React.ReactElement => {
          let value = (0, runtime.useDialogKeyboardViewport)(true),
            value2 = (0, runtime.useMergedRefs)(options, value);
          return (
            <runtime.npm_AlertDialog_Dh.Popup
              {...{
                [runtime.overlayAttribute]: "",
              }}
              ref={value2}
              {...props}
            >
              {children}
            </runtime.npm_AlertDialog_Dh.Popup>
          );
        },
      );
      ConfirmationDialogPopupInner.displayName =
        "ConfirmationDialog.PopupInner";
      DialogPopup = (0, reactDialogDialog.forwardRef)<
        HTMLDivElement,
        DialogPopupProps
      >(
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
              : `${DialogDialogCss_2} ${dialogBackdropClasses} ${DataNestedDialogOpenBlur2pxValue} ${DialogDialogSmMdLgConfig[size]} ${fullHeight ? "h-dvh" : ""}`,
            value2 = (0, runtime.useDefaultLayer)("modal");
          useDialogPresence(portalClassName);
          let value3 = (0, reactDialogDialog.useContext)(DialogDialogContext),
            value4 = (0, reactDialogDialog.useContext)(DialogDialogContext_4),
            value5 = value3 === undefined || value3 === true;
          return (
            <runtime.npm_Dialog_Xg.Portal
              container={(0, runtime.useOverlayRoot)()}
            >
              <runtime.PopupSurface
                className={(0, runtime.cn)("relative", portalClassName)}
                style={value2.style}
                surface={
                  surface ??
                  (unstyled
                    ? undefined
                    : runtime.surfaceBackgroundTokens.popover)
                }
                closeOnActivityHide={true}
              >
                <runtime.LayerBaseContext.Provider value={value2.base}>
                  <runtime.npm_Dialog_Xg.Backdrop
                    forceRender={value5}
                    onMouseDown={
                      value4
                        ? runtime.preserveDialogFocus
                        : runtime.preventDialogMouseSelection
                    }
                    className={(0, runtime.cn)(
                      DialogDialogClassNames_3,
                      !unstyled && StartingOpacity0Value,
                      value3 === false && "pointer-events-none opacity-0",
                      backdropClassName,
                    )}
                    style={backdropStyle}
                  />
                  <WindowDragStrip />
                  <DialogPopupInner
                    data-cds={"Dialog"}
                    ref={options}
                    {...props}
                    fitVisualViewport={!unstyled}
                    className={(0, runtime.cn)(
                      "draggable-none",
                      DialogDialogClassNames_4,
                      value,
                      className,
                    )}
                  >
                    {unstyled ? (
                      children
                    ) : (
                      <div className={DialogDialogClassNames_2}>{children}</div>
                    )}
                  </DialogPopupInner>
                </runtime.LayerBaseContext.Provider>
              </runtime.PopupSurface>
            </runtime.npm_Dialog_Xg.Portal>
          );
        },
      );
      DialogPopup.displayName = "Dialog.Popup";
      DialogTitle = (0, reactDialogDialog.forwardRef)<
        HTMLHeadingElement,
        DialogTitleProps
      >(
        (
          { className: className, ...props }: DialogTitleProps,
          options: React.ForwardedRef<HTMLHeadingElement>,
        ): React.ReactElement => {
          let value = (0, reactDialogDialog.useContext)(DialogDialogContext_2);
          return (
            <runtime.npm_Dialog_Xg.Title
              ref={options}
              {...props}
              className={(0, runtime.cn)(
                "text-primary",
                value ? DialogDialogClassNames_5 : DialogDialogClassNames_6,
                className,
              )}
            />
          );
        },
      );
      DialogTitle.displayName = "Dialog.Title";
      DialogDialogLabel_2 = "-me-pad-sm -mt-pad-sm";
      (
        DialogCloseButton as React.FC<{
          "aria-label"?: string;
          className?: string;
          flush?: boolean;
        }>
      ).displayName = "Dialog.CloseButton";
      (DialogHeader as React.FC<DialogHeaderProps>).displayName =
        "Dialog.Header";
      DialogDescription = (0, reactDialogDialog.forwardRef)<
        HTMLParagraphElement,
        DialogDescriptionProps
      >(
        (
          { className: className, ...props }: DialogDescriptionProps,
          options: React.ForwardedRef<HTMLParagraphElement>,
        ): React.ReactElement => (
          <runtime.npm_Dialog_Xg.Description
            ref={options}
            {...props}
            className={(0, runtime.cn)(DialogDialogClassNames_7, className)}
          />
        ),
      );
      DialogDescription.displayName = "Dialog.Description";
      DialogDialogStartCenterEndConfig = {
        start: "sm:justify-start",
        center: "sm:justify-center",
        end: "sm:justify-end",
        between: "sm:justify-between",
      };
      (DialogFooter as React.FC<DialogFooterProps>).displayName =
        "Dialog.Footer";
      (DialogRoot as React.FC<DialogRootProps>).displayName = "Dialog.Root";
      DialogDialogRootTriggerPopupConfig = {
        Root: DialogRoot,
        Trigger: DialogTrigger,
        Popup: DialogPopup,
        Backdrop: runtime.npm_Dialog_Xg.Backdrop,
        Header: DialogHeader,
        Title: DialogTitle,
        Description: DialogDescription,
        Footer: DialogFooter,
        Close: runtime.npm_Dialog_Xg.Close,
        CloseButton: DialogCloseButton,
      };
      (AlertDialogRoot as React.FC<AlertDialogRootProps>).displayName =
        "AlertDialog.Root";
      DialogDialogRootTriggerPopupConfig_2 = {
        Root: AlertDialogRoot,
        Trigger: runtime.npm_AlertDialog_Dh.Trigger,
        Popup: DialogPopup,
        Backdrop: runtime.npm_AlertDialog_Dh.Backdrop,
        Header: DialogHeader,
        Title: DialogTitle,
        Description: DialogDescription,
        Footer: DialogFooter,
        Close: runtime.npm_AlertDialog_Dh.Close,
        CloseButton: DialogCloseButton,
        createHandle: runtime.npm_AlertDialog_Dh.createHandle,
      };
    });
  };
}

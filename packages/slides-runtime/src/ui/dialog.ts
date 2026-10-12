/** Restored application module; prepare first, initialize in original order. */
import type {
  Context,
  CSSProperties,
  ForwardRefExoticComponent,
  FunctionComponent,
  Key,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefAttributes,
  RefObject,
} from "react";
import type { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import type { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  ButtonGroupContextValue,
  ButtonProps,
  ButtonVariant,
} from "./disclosure";
import type { OverlayActions } from "./foundation";
import type { MenuEntry, SimpleMenuProps } from "./menu";
import type { ButtonGroupProps } from "./tabs";

/** Width presets of a dialog popup. */
export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
/** Alignment of the buttons in a dialog footer. */
export type DialogFooterAlign = "start" | "center" | "end" | "between";
/** The dialog `modal` setting; `undefined` when the root did not set one. */
export type DialogModal = boolean | "trap-focus";
/** Which button of a confirmation dialog takes the initial focus; `pending` waits for autofill. */
export type ConfirmationFocus = "confirm" | "cancel" | "pending";
/** A ref to the element that currently holds, or will receive, focus. */
type FocusTargetRef = RefObject<HTMLElement | null>;
/** Style of the strip that lets the desktop window be dragged by a dialog backdrop. */
export interface WindowDragRegionStyle extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}
/** Props of `Dialog.CloseButton`. */
export interface DialogCloseButtonProps {
  "aria-label"?: string;
  className?: string;
  /** Pulls the button into the corner of the dialog padding. */
  flush?: boolean;
}
/** Props of `Dialog.Header`. */
export interface DialogHeaderProps {
  actions?: ReactNode;
  description?: ReactNode;
  showClose?: boolean;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}
/** Props of `Dialog.Footer`. */
export interface DialogFooterProps {
  align?: DialogFooterAlign;
  className?: string;
  children?: ReactNode;
}
/** Props of `Dialog.Root`. */
export interface DialogRootProps
  extends Omit<
    BaseAlertDialog.Root.Props,
    "actionsRef" | "disablePointerDismissal"
  > {
  /** `false` keeps the dialog open on outside presses. */
  dismissible?: boolean;
  disablePointerDismissal?: boolean;
  modal?: DialogModal;
  actionsRef?: Ref<OverlayActions>;
}
/** Props of `AlertDialog.Root`. */
export interface AlertDialogRootProps
  extends Omit<BaseDialog.Root.Props, "actionsRef"> {
  actionsRef?: Ref<OverlayActions>;
}
/** Props of `Dialog.Trigger`. */
export type DialogTriggerProps = BaseAlertDialog.Trigger.Props;
/** Props of the popup element that fits itself to the visual viewport. */
export interface DialogPopupInnerProps extends BaseAlertDialog.Popup.Props {
  fitVisualViewport?: boolean;
}
/** Props of `Dialog.Popup`. */
export interface DialogPopupProps
  extends Omit<BaseAlertDialog.Popup.Props, "className" | "children"> {
  size?: DialogSize;
  fullHeight?: boolean;
  /** Skips the default dialog look; the caller styles the popup. */
  unstyled?: boolean;
  surface?: string;
  backdropClassName?: string;
  backdropStyle?: CSSProperties;
  portalClassName?: string;
  className?: string;
  children?: ReactNode;
}
/** Props of `Dialog.Title`. */
export interface DialogTitleProps
  extends Omit<BaseAlertDialog.Title.Props, "className"> {
  className?: string;
}
/** Props of `Dialog.Description`. */
export interface DialogDescriptionProps
  extends Omit<BaseAlertDialog.Description.Props, "className"> {
  className?: string;
}
/** Details passed to `ConfirmationDialog`'s `onOpenChange`. */
export interface ConfirmationDialogChangeDetails {
  reason: "confirm" | "dismiss";
}
/** Props of `ConfirmationDialog`. */
export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (
    open: boolean,
    details: ConfirmationDialogChangeDetails,
  ) => void;
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  confirmVariant?: ButtonVariant;
  initialFocus?: "confirm" | "cancel";
  disabled?: boolean;
  confirmDisabledReason?: ReactNode;
  size?: DialogSize;
  className?: string;
  portalClassName?: string;
  /** Runs on confirm; the dialog shows a busy state while a returned promise settles. */
  onConfirm: () => unknown;
  /** Closes right away on confirm instead of waiting for `onConfirm`. */
  closeOnConfirm?: boolean;
  children?: ReactNode;
}
/** Props of the popup element of a confirmation dialog. */
export type ConfirmationDialogPopupInnerProps = BaseDialog.Popup.Props;
/** Colors of the seam between two joined buttons. */
export interface ButtonGroupVariantColors {
  seam: string;
  line: string;
}
/** Props of the seam between two joined buttons. */
export interface ButtonGroupSeamProps {
  variant: ButtonVariant;
}
/** What each position of a button group publishes to its buttons. */
export interface ButtonGroupSegmentContexts {
  start: ButtonGroupContextValue;
  middle: ButtonGroupContextValue;
  end: ButtonGroupContextValue;
}
/** Props of `SplitButton`: a primary action next to a menu caret. */
export interface SplitButtonProps
  extends Pick<
      ButtonProps,
      | "variant"
      | "size"
      | "icon"
      | "shortcut"
      | "tooltip"
      | "tooltipSide"
      | "indicator"
      | "aria-label"
      | "aria-expanded"
      | "aria-haspopup"
      | "aria-controls"
      | "aria-keyshortcuts"
      | "aria-disabled"
      | "aria-describedby"
      | "pressed"
      | "disabled"
      | "busy"
      | "className"
    >,
    Pick<SimpleMenuProps, "side" | "align" | "collisionPadding" | "open"> {
  label?: ReactNode;
  onPrimaryClick?: ButtonProps["onClick"];
  onPrimaryPointerDown?: ButtonProps["onPointerDown"];
  onPrimaryMouseDown?: ButtonProps["onMouseDown"];
  primaryRef?: Ref<HTMLElement>;
  groupLabel?: string;
  menuLabel?: string;
  menuTooltip?: boolean | string;
  items?: MenuEntry[];
  /** Content shown between the label and the caret. */
  status?: ReactNode;
  caretSize?: "sm" | "xs";
  onOpenChange?: (open: boolean) => void;
}
export type DialogTriggerComponent = ForwardRefExoticComponent<
  DialogTriggerProps & RefAttributes<HTMLElement>
>;
export type DialogPopupInnerComponent = ForwardRefExoticComponent<
  DialogPopupInnerProps & RefAttributes<HTMLElement>
>;
export type ConfirmationDialogPopupInnerComponent =
  ForwardRefExoticComponent<
    ConfirmationDialogPopupInnerProps & RefAttributes<HTMLElement>
  >;
export type DialogPopupComponent = ForwardRefExoticComponent<
  DialogPopupProps & RefAttributes<HTMLDivElement>
>;
export type DialogTitleComponent = ForwardRefExoticComponent<
  DialogTitleProps & RefAttributes<HTMLHeadingElement>
>;
export type DialogDescriptionComponent = ForwardRefExoticComponent<
  DialogDescriptionProps & RefAttributes<HTMLParagraphElement>
>;
/** The `Dialog` parts. */
export interface DialogNamespace {
  Root: (props: DialogRootProps) => ReactElement;
  Trigger: DialogTriggerComponent;
  Popup: DialogPopupComponent;
  Backdrop: typeof BaseAlertDialog.Backdrop;
  Header: (props: DialogHeaderProps) => ReactElement;
  Title: DialogTitleComponent;
  Description: DialogDescriptionComponent;
  Footer: (props: DialogFooterProps) => ReactElement;
  Close: typeof BaseAlertDialog.Close;
  CloseButton: (props: DialogCloseButtonProps) => ReactElement;
}
/** The `AlertDialog` parts. */
export interface AlertDialogNamespace {
  Root: (props: AlertDialogRootProps) => ReactElement;
  Trigger: typeof BaseDialog.Trigger;
  Popup: DialogPopupComponent;
  Backdrop: typeof BaseDialog.Backdrop;
  Header: (props: DialogHeaderProps) => ReactElement;
  Title: DialogTitleComponent;
  Description: DialogDescriptionComponent;
  Footer: (props: DialogFooterProps) => ReactElement;
  Close: typeof BaseDialog.Close;
  CloseButton: (props: DialogCloseButtonProps) => ReactElement;
  createHandle: typeof BaseDialog.createHandle;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactI5: ReactNamespace;
    jsxD5: JsxNamespace;
    reactForUiDialog: ReactNamespace;
    jsxForUiDialog: JsxNamespace;
    reactForUiDialog2: ReactNamespace;
    jsxForUiDialog2: JsxNamespace;
    preventDialogBackdropDefault: (
      event: ReactMouseEvent<HTMLElement>,
    ) => void;
    preserveDialogBackdropFocus: (
      event: ReactMouseEvent<HTMLElement>,
    ) => void;
    DesktopWindowDragStrip: () => ReactElement;
    useDialogStyleDebug: (portalClassName: string | undefined) => void;
    useDialogInitialFocus: (
      target: FocusTargetRef,
      focusVisible: boolean,
      popup: FocusTargetRef,
      openRef: RefObject<boolean>,
      userInteractedRef: RefObject<boolean>,
      fallback: () => HTMLElement | null,
    ) => () => HTMLElement | null;
    DialogCloseButton: (props: DialogCloseButtonProps) => ReactElement;
    DialogHeader: (props: DialogHeaderProps) => ReactElement;
    DialogFooter: (props: DialogFooterProps) => ReactElement;
    DialogRoot: (props: DialogRootProps) => ReactElement;
    AlertDialogRoot: (props: AlertDialogRootProps) => ReactElement;
    ConfirmationDialog: (props: ConfirmationDialogProps) => ReactElement;
    DIALOG_POPUP_CLASS: string;
    DIALOG_MAX_HEIGHT_CLASS: string;
    dialogFullHeightClasses: string;
    dialogPopupPositionClasses: string;
    dialogPopupTransitionClasses: string;
    dialogBackdropClasses: string;
    dialogStartingOpacityClass: string;
    dialogBackdropFocusAbortController: AbortController | null;
    desktopWindowDragStripStyle: WindowDragRegionStyle;
    nestedDialogOverlayClasses: string;
    nestedDialogBlurClasses: string;
    dialogSizeClasses: Record<DialogSize, string>;
    DIALOG_Z_INDEX_CLASS_PATTERN: RegExp;
    dialogStateContext: Context<DialogModal | undefined>;
    confirmationDialogContext: Context<boolean>;
    dialogTitleClasses: string;
    DIALOG_TITLE_CLASS: string;
    dialogDescriptionSmallSpacing: string;
    dialogDescriptionLargeSpacing: string;
    dialogDescriptionClasses: string;
    dialogTriggerRefContext: Context<FocusTargetRef | undefined>;
    dialogInitialFocusContext: Context<boolean>;
    DialogTrigger: DialogTriggerComponent;
    DIALOG_AUTOFILL_WAIT_MS: number;
    DIALOG_HIDDEN_SELECTOR: string;
    DialogPopupInner: DialogPopupInnerComponent;
    ConfirmationDialogPopupInner: ConfirmationDialogPopupInnerComponent;
    DialogPopup: DialogPopupComponent;
    DialogTitle: DialogTitleComponent;
    dialogCloseButtonOutsetClasses: string;
    DialogDescription: DialogDescriptionComponent;
    dialogFooterAlignmentClasses: Record<DialogFooterAlign, string>;
    DialogComponents: DialogNamespace;
    AlertDialogComponents: AlertDialogNamespace;
    initializeUiDialog: () => void;
    ButtonGroupSeam: (props: ButtonGroupSeamProps) => ReactElement;
    ButtonGroupRoot: (props: ButtonGroupProps) => ReactElement;
    BUTTON_GROUP_SEGMENT_RING_CLASS: string;
    BUTTON_GROUP_VARIANT_COLORS: Partial<
      Record<ButtonVariant, ButtonGroupVariantColors>
    >;
    BUTTON_GROUP_SEAM_HOVER_CLASS: string;
    BUTTON_GROUP_SEAM_DISABLED_CLASS: string;
    initializeUiDialog2: () => void;
    SplitButton: (props: SplitButtonProps) => ReactElement;
    SPLIT_CARET_STYLES: CSSProperties;
    SPLIT_CARET_AUTO_STYLES: CSSProperties;
    SPLIT_LABEL_STYLES: CSSProperties;
    SPLIT_LABEL_CLASS: string;
    SPLIT_LABEL_PAD_STYLES: CSSProperties;
    SPLIT_LABEL_HOVER_CLASSES: Partial<Record<ButtonVariant, string>>;
    SPLIT_BUTTON_TRANSITION_CLASS: string;
    SPLIT_BUTTON_DISABLED_CLASS: string;
    SPLIT_INLINE_CARET_STYLES: CSSProperties;
    SPLIT_CARET_HIT_CLASS: string;
    SPLIT_CARET_RECESSED_HIT_CLASS: string;
    SPLIT_CARET_OPEN_CLASS: string;
    SPLIT_LABEL_RADIUS_CLASS: string;
    SPLIT_CARET_RADIUS_CLASS: string;
    SPLIT_BUTTON_RING_CLASS: string;
    SPLIT_PAINT_EDGE_CLASS: string;
    initializeUiDialog3: () => void;
  }
}

export function installUiDialog(runtime: RuntimeBindings): () => void {
  var reactI5: ReactNamespace;
  var jsxD5: JsxNamespace;
  var DIALOG_POPUP_CLASS: RuntimeBindings["DIALOG_POPUP_CLASS"];
  var DIALOG_MAX_HEIGHT_CLASS: RuntimeBindings["DIALOG_MAX_HEIGHT_CLASS"];
  var dialogFullHeightClasses: RuntimeBindings["dialogFullHeightClasses"];
  var dialogPopupPositionClasses: RuntimeBindings["dialogPopupPositionClasses"];
  var dialogPopupTransitionClasses: RuntimeBindings["dialogPopupTransitionClasses"];
  var dialogBackdropClasses: RuntimeBindings["dialogBackdropClasses"];
  var dialogStartingOpacityClass: RuntimeBindings["dialogStartingOpacityClass"];
  var dialogBackdropFocusAbortController: RuntimeBindings["dialogBackdropFocusAbortController"];
  var desktopWindowDragStripStyle: RuntimeBindings["desktopWindowDragStripStyle"];
  var nestedDialogOverlayClasses: RuntimeBindings["nestedDialogOverlayClasses"];
  var nestedDialogBlurClasses: RuntimeBindings["nestedDialogBlurClasses"];
  var dialogSizeClasses: RuntimeBindings["dialogSizeClasses"];
  var DIALOG_Z_INDEX_CLASS_PATTERN: RuntimeBindings["DIALOG_Z_INDEX_CLASS_PATTERN"];
  var dialogStateContext: RuntimeBindings["dialogStateContext"];
  var confirmationDialogContext: RuntimeBindings["confirmationDialogContext"];
  var dialogTitleClasses: RuntimeBindings["dialogTitleClasses"];
  var DIALOG_TITLE_CLASS: RuntimeBindings["DIALOG_TITLE_CLASS"];
  var dialogDescriptionSmallSpacing: RuntimeBindings["dialogDescriptionSmallSpacing"];
  var dialogDescriptionLargeSpacing: RuntimeBindings["dialogDescriptionLargeSpacing"];
  var dialogDescriptionClasses: RuntimeBindings["dialogDescriptionClasses"];
  var dialogTriggerRefContext: RuntimeBindings["dialogTriggerRefContext"];
  var dialogInitialFocusContext: RuntimeBindings["dialogInitialFocusContext"];
  var DialogTrigger: RuntimeBindings["DialogTrigger"];
  var DIALOG_AUTOFILL_WAIT_MS: RuntimeBindings["DIALOG_AUTOFILL_WAIT_MS"];
  var DIALOG_HIDDEN_SELECTOR: RuntimeBindings["DIALOG_HIDDEN_SELECTOR"];
  var DialogPopupInner: RuntimeBindings["DialogPopupInner"];
  var ConfirmationDialogPopupInner: RuntimeBindings["ConfirmationDialogPopupInner"];
  var DialogPopup: RuntimeBindings["DialogPopup"];
  var DialogTitle: RuntimeBindings["DialogTitle"];
  var dialogCloseButtonOutsetClasses: RuntimeBindings["dialogCloseButtonOutsetClasses"];
  var DialogDescription: RuntimeBindings["DialogDescription"];
  var dialogFooterAlignmentClasses: RuntimeBindings["dialogFooterAlignmentClasses"];
  var DialogComponents: RuntimeBindings["DialogComponents"];
  var AlertDialogComponents: RuntimeBindings["AlertDialogComponents"];
  var initializeUiDialog: RuntimeBindings["initializeUiDialog"];
  var reactForUiDialog: ReactNamespace;
  var jsxForUiDialog: JsxNamespace;
  var BUTTON_GROUP_SEGMENT_RING_CLASS: RuntimeBindings["BUTTON_GROUP_SEGMENT_RING_CLASS"];
  var BUTTON_GROUP_VARIANT_COLORS: RuntimeBindings["BUTTON_GROUP_VARIANT_COLORS"];
  var BUTTON_GROUP_SEAM_HOVER_CLASS: RuntimeBindings["BUTTON_GROUP_SEAM_HOVER_CLASS"];
  var BUTTON_GROUP_SEAM_DISABLED_CLASS: RuntimeBindings["BUTTON_GROUP_SEAM_DISABLED_CLASS"];
  var initializeUiDialog2: RuntimeBindings["initializeUiDialog2"];
  var reactForUiDialog2: ReactNamespace;
  var jsxForUiDialog2: JsxNamespace;
  var SPLIT_CARET_STYLES: RuntimeBindings["SPLIT_CARET_STYLES"];
  var SPLIT_CARET_AUTO_STYLES: RuntimeBindings["SPLIT_CARET_AUTO_STYLES"];
  var SPLIT_LABEL_STYLES: RuntimeBindings["SPLIT_LABEL_STYLES"];
  var SPLIT_LABEL_CLASS: RuntimeBindings["SPLIT_LABEL_CLASS"];
  var SPLIT_LABEL_PAD_STYLES: RuntimeBindings["SPLIT_LABEL_PAD_STYLES"];
  var SPLIT_LABEL_HOVER_CLASSES: RuntimeBindings["SPLIT_LABEL_HOVER_CLASSES"];
  var SPLIT_BUTTON_TRANSITION_CLASS: RuntimeBindings["SPLIT_BUTTON_TRANSITION_CLASS"];
  var SPLIT_BUTTON_DISABLED_CLASS: RuntimeBindings["SPLIT_BUTTON_DISABLED_CLASS"];
  var SPLIT_INLINE_CARET_STYLES: RuntimeBindings["SPLIT_INLINE_CARET_STYLES"];
  var SPLIT_CARET_HIT_CLASS: RuntimeBindings["SPLIT_CARET_HIT_CLASS"];
  var SPLIT_CARET_RECESSED_HIT_CLASS: RuntimeBindings["SPLIT_CARET_RECESSED_HIT_CLASS"];
  var SPLIT_CARET_OPEN_CLASS: RuntimeBindings["SPLIT_CARET_OPEN_CLASS"];
  var SPLIT_LABEL_RADIUS_CLASS: RuntimeBindings["SPLIT_LABEL_RADIUS_CLASS"];
  var SPLIT_CARET_RADIUS_CLASS: RuntimeBindings["SPLIT_CARET_RADIUS_CLASS"];
  var SPLIT_BUTTON_RING_CLASS: RuntimeBindings["SPLIT_BUTTON_RING_CLASS"];
  var SPLIT_PAINT_EDGE_CLASS: RuntimeBindings["SPLIT_PAINT_EDGE_CLASS"];
  var initializeUiDialog3: RuntimeBindings["initializeUiDialog3"];
  function preventDialogBackdropDefault(
    event: ReactMouseEvent<HTMLElement>,
  ): void {
    event.preventDefault();
  }
  function preserveDialogBackdropFocus(
    event: ReactMouseEvent<HTMLElement>,
  ): void {
    if (event.button !== 0) {
      event.preventDefault();
      return;
    }
    let currentTarget = event.currentTarget,
      parentElement = currentTarget.parentElement,
      ownerDocument = currentTarget.ownerDocument,
      value = (0, runtime.asElement)(ownerDocument.activeElement);
    if (
      parentElement === null ||
      value === null ||
      !parentElement.contains(value)
    ) {
      return;
    }
    dialogBackdropFocusAbortController?.abort();
    let value2 = new (ownerDocument.defaultView?.AbortController ??
      AbortController)();
    dialogBackdropFocusAbortController = value2;
    let { signal: value3 } = value2;
    value3.addEventListener(
      "abort",
      () => {
        if (dialogBackdropFocusAbortController === value2) {
          dialogBackdropFocusAbortController = null;
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
  function DesktopWindowDragStrip(): ReactElement {
    return jsxD5.jsx("div", {
      "aria-hidden": true,
      "data-cds-window-drag-strip": "",
      className: "fixed inset-x-0 top-0",
      style: desktopWindowDragStripStyle,
    });
  }
  function useDialogStyleDebug(input: string | undefined): void {
    reactI5.useEffect(() => {
      return;
    }, [input]);
  }
  function useDialogInitialFocus(
    input: FocusTargetRef,
    options: boolean,
    context: FocusTargetRef,
    value: RefObject<boolean>,
    extra: RefObject<boolean>,
    detail: () => HTMLElement | null,
  ): () => HTMLElement | null {
    let ref = reactI5.useRef<() => void>(null);
    reactI5.useEffect(() => () => ref.current?.(), []);
    return reactI5.useCallback(() => {
      let current = input.current,
        value2 = current?.ownerDocument,
        value3 = value2?.defaultView;
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
          });
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
              });
            });
          };
        ref.current?.();
        value2.addEventListener("focusin", callback, true);
        let value4 = value3.setTimeout(
          () => ref.current?.(),
          1000,
        );
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
  }: DialogCloseButtonProps): ReactElement {
    let value = (0, runtime.useTranslation)("close", "Close");
    return jsxD5.jsx(runtime.baseAlertDialog.Close, {
      render: jsxD5.jsx(runtime.Button, {
        variant: "ghost",
        iconOnly: true,
        icon: "X",
        "aria-label": ariaLabel ?? value,
        tooltip: false,
        className: (0, runtime.cn)(
          flush && dialogCloseButtonOutsetClasses,
          className,
        ),
      }),
    });
  }
  function DialogHeader({
    actions: actions,
    description: description,
    showClose = true,
    closeLabel: closeLabel,
    className: className,
    children: children,
  }: DialogHeaderProps): ReactElement {
    let value = reactI5.useContext(confirmationDialogContext);
    return jsxD5.jsxs("div", {
      className: (0, runtime.cn)("mb-pad-md flex items-start gap-2", className),
      children: [
        jsxD5.jsxs("div", {
          className: (0, runtime.clsx)(
            value
              ? dialogDescriptionSmallSpacing
              : dialogDescriptionLargeSpacing,
            "flex min-w-0 flex-1 flex-col gap-1",
          ),
          children: [
            jsxD5.jsx(DialogTitle, {
              children: children,
            }),
            description &&
              jsxD5.jsx(runtime.baseAlertDialog.Description, {
                className: "text-body font-normal text-secondary break-words",
                children: description,
              }),
          ],
        }),
        actions &&
          jsxD5.jsx("div", {
            className: "-mt-pad-sm",
            children: actions,
          }),
        showClose &&
          jsxD5.jsx(DialogCloseButton, {
            "aria-label": closeLabel,
            flush: true,
          }),
      ],
    });
  }
  function DialogFooter({
    align = "end",
    className: className,
    children: children,
  }: DialogFooterProps): ReactElement {
    return jsxD5.jsx("div", {
      className: (0, runtime.cn)(
        "mt-pad-lg flex flex-col-reverse gap-2 sm:flex-row",
        "max-sm:[&>[data-cds-disabled-reason-wrapper]]:flex-col",
        dialogFooterAlignmentClasses[align],
        className,
      ),
      children: children,
    });
  }
  function DialogRoot({
    dismissible: dismissible,
    disablePointerDismissal: disablePointerDismissal,
    actionsRef: actionsRef,
    ...props
  }: DialogRootProps): ReactElement {
    let ref = reactI5.useRef<HTMLElement>(null),
      ref2 = reactI5.useRef<OverlayActions>(null);
    (0, runtime.useForwardedOverlayActions)(ref2, actionsRef);
    let value =
      disablePointerDismissal ?? (dismissible === false ? true : undefined);
    return jsxD5.jsx(confirmationDialogContext.Provider, {
      value: false,
      children: jsxD5.jsx(dialogStateContext.Provider, {
        value: props.modal,
        children: jsxD5.jsx(dialogTriggerRefContext.Provider, {
          value: ref,
          children: jsxD5.jsx(dialogInitialFocusContext.Provider, {
            value: !value,
            children: jsxD5.jsx(runtime.CloseOnActivityHideProvider, {
              actionsRef: ref2,
              children: jsxD5.jsx(runtime.baseAlertDialog.Root, {
                disablePointerDismissal: value,
                actionsRef: ref2,
                ...props,
              }),
            }),
          }),
        }),
      }),
    });
  }
  function AlertDialogRoot({
    actionsRef: actionsRef,
    ...props
  }: AlertDialogRootProps): ReactElement {
    let ref = reactI5.useRef<OverlayActions>(null);
    (0, runtime.useForwardedOverlayActions)(ref, actionsRef);
    return jsxD5.jsx(confirmationDialogContext.Provider, {
      value: true,
      children: jsxD5.jsx(dialogStateContext.Provider, {
        value: true,
        children: jsxD5.jsx(dialogInitialFocusContext.Provider, {
          value: false,
          children: jsxD5.jsx(runtime.CloseOnActivityHideProvider, {
            actionsRef: ref,
            children: jsxD5.jsx(runtime.baseDialog.Root, {
              ...props,
              actionsRef: ref,
            }),
          }),
        }),
      }),
    });
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
  }: ConfirmationDialogProps): ReactElement {
    let value = (0, runtime.useTranslation)("confirm", "Confirm"),
      value2 = (0, runtime.useTranslation)("cancel", "Cancel"),
      value3 = confirmLabel ?? value,
      value4 = cancelLabel ?? value2,
      [value5, value6] = reactI5.useState(false),
      ref = reactI5.useRef<HTMLElement>(null),
      ref2 = reactI5.useRef<HTMLElement>(null),
      { finalFocus: value7, popupRef: value8 } = (0,
      runtime.useOverlayFinalFocus)(open),
      callback = (): ConfirmationFocus =>
        initialFocus === "cancel" ? "cancel" : disabled ? "pending" : "confirm",
      [value9, value10] = reactI5.useState<ConfirmationFocus>(callback),
      ref3 = reactI5.useRef(value9);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      ref3.current = value9;
    }, [value9]);
    let callback2 = reactI5.useCallback(() => {
        switch (ref3.current) {
          case "confirm":
            return ref2.current;
          case "cancel":
            return ref.current;
          default:
            return value8.current;
        }
      }, [value8]),
      ref4 = reactI5.useRef(false),
      callback3 = reactI5.useCallback(() => {
        ref4.current = true;
      }, []);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (open) {
        ref4.current = false;
        value10(callback());
      }
    }, [open]);
    let callback4 = reactI5.useCallback(
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
          });
        }
      },
      [value8],
    );
    reactI5.useEffect(() => {
      if (!open || value9 !== "pending") {
        return;
      }
      if (!disabled) {
        let value16 = requestAnimationFrame(
          () => callback4("confirm"),
        );
        return () => cancelAnimationFrame(value16);
      }
      let value15 = setTimeout(
        () => callback4("cancel"),
        DIALOG_AUTOFILL_WAIT_MS,
      );
      return () => clearTimeout(value15);
    }, [disabled, value9, callback4, open]);
    let ref5 = reactI5.useRef(open);
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
      callback5 = reactI5.useCallback((event: ReactKeyboardEvent<HTMLElement>): void => {
        if (event.repeat && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
        }
      }, []),
      ref6 = reactI5.useRef(false);
    reactI5.useEffect(() => {
      if (open) {
        ref6.current = false;
      }
    }, [open]);
    let value12 = (0, runtime.usePortalContainer)(),
      callback6 = reactI5.useCallback(() => {
        if (value5 || disabled || !open || ref6.current) {
          return;
        }
        if (closeOnConfirm) {
          ref6.current = true;
        } else {
          value6(true);
        }
        let value15: Promise<unknown>;
        try {
          value15 = Promise.resolve(onConfirm());
        } catch (value16) {
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
      callback7 = reactI5.useCallback(
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
    let ref7 = reactI5.useRef<OverlayActions>(null),
      value14 = jsxD5.jsx(runtime.Button, {
        ref: ref2,
        variant: confirmVariant,
        busy: value5,
        disabled: disabled,
        disabledReason: confirmDisabledReason,
        "data-initial-focus": value9 === "confirm" ? "" : undefined,
        onClick: callback6,
        onKeyDown: callback5,
        children: value3,
      });
    return jsxD5.jsx(runtime.CloseOnActivityHideProvider, {
      actionsRef: ref7,
      children: jsxD5.jsx(runtime.baseDialog.Root, {
        open: open,
        onOpenChange: callback7,
        actionsRef: ref7,
        children: jsxD5.jsx(runtime.baseDialog.Portal, {
          container: value12,
          children: jsxD5.jsx(runtime.PortalRoot, {
            className: (0, runtime.cn)("relative", portalClassName),
            style: value13.style,
            surface: runtime.elevationSurfaceNames.popover,
            closeOnActivityHide: true,
            children: jsxD5.jsxs(runtime.layerBaseContext.Provider, {
              value: value13.base,
              children: [
                jsxD5.jsx(runtime.baseDialog.Backdrop, {
                  forceRender: true,
                  onMouseDown: preventDialogBackdropDefault,
                  className: (0, runtime.clsx)(
                    dialogBackdropClasses,
                    dialogStartingOpacityClass,
                  ),
                }),
                jsxD5.jsx(DesktopWindowDragStrip, {}),
                jsxD5.jsx(ConfirmationDialogPopupInner, {
                  "data-cds": "ConfirmationDialog",
                  ref: value8,
                  onKeyDownCapture: callback3,
                  onPointerDownCapture: callback3,
                  initialFocus: value11,
                  finalFocus: value7,
                  className: (0, runtime.cn)(
                    "draggable-none",
                    nestedDialogOverlayClasses,
                    dialogFullHeightClasses,
                    dialogPopupTransitionClasses,
                    nestedDialogBlurClasses,
                    dialogSizeClasses[size],
                    className,
                  ),
                  children: jsxD5.jsxs("div", {
                    className: dialogPopupPositionClasses,
                    children: [
                      jsxD5.jsx(runtime.baseDialog.Title, {
                        className: (0, runtime.clsx)(
                          dialogDescriptionSmallSpacing,
                          dialogTitleClasses,
                          "text-primary",
                        ),
                        children: title,
                      }),
                      description &&
                        jsxD5.jsx(runtime.baseDialog.Description, {
                          className: dialogDescriptionClasses,
                          children: description,
                        }),
                      children,
                      jsxD5.jsxs(DialogFooter, {
                        children: [
                          jsxD5.jsx(runtime.baseDialog.Close, {
                            render: jsxD5.jsx(runtime.Button, {
                              ref: ref,
                              variant: "secondary",
                              disabled: value5,
                              "data-initial-focus":
                                value9 === "cancel" ? "" : undefined,
                              children: value4,
                            }),
                          }),
                          value14,
                        ],
                      }),
                    ],
                  }),
                }),
              ],
            }),
          }),
        }),
      }),
    });
  }
  function ButtonGroupSeam({
    variant: variant,
  }: ButtonGroupSeamProps): ReactElement {
    let value = BUTTON_GROUP_VARIANT_COLORS[variant];
    if (!value) {
      return jsxForUiDialog.jsx("span", {
        "aria-hidden": true,
        className: "w-px shrink-0 self-stretch",
      });
    }
    let value2 =
      variant === "secondary" ? "" : BUTTON_GROUP_SEAM_DISABLED_CLASS;
    return jsxForUiDialog.jsx("span", {
      "aria-hidden": true,
      className: `relative w-px shrink-0 self-stretch ${value.seam} ${BUTTON_GROUP_SEAM_HOVER_CLASS} ${value2}`,
      children: jsxForUiDialog.jsx("span", {
        "data-cds-seam-line": "",
        className: `absolute inset-x-0 inset-y-[4px] ${value.line}`,
      }),
    });
  }
  function ButtonGroupRoot({
    "aria-label": ariaLabel,
    variant = "spaced",
    orientation = "horizontal",
    size: size,
    buttonVariant = "secondary",
    className: className,
    children: children,
    ...remainingProps
  }: ButtonGroupProps): ReactElement {
    let value = variant === "joined",
      value2 = reactForUiDialog.Children.toArray(children),
      value3 = value2.length - 1,
      value4 = value && value3 > 0,
      memo = reactForUiDialog.useMemo((): ButtonGroupSegmentContexts => {
        let state = {
          size: size,
          buttonVariant: buttonVariant,
          enforceVariant: value,
        };
        return {
          start: {
            ...state,
            joined: value4 ? "start" : undefined,
          },
          middle: {
            ...state,
            joined: value4 ? "middle" : undefined,
          },
          end: {
            ...state,
            joined: value4 ? "end" : undefined,
          },
        };
      }, [size, buttonVariant, value, value4]);
    return jsxForUiDialog.jsx("div", {
      "data-cds": "ButtonGroup",
      ...remainingProps,
      role: "group",
      "aria-label": ariaLabel,
      ...(0, runtime.getControlSizeAttributes)(size),
      className: (0, runtime.cn)(
        "relative inline-flex w-fit shrink-0",
        orientation === "vertical" ? "flex-col items-stretch" : "items-stretch",
        value4
          ? `rounded ${buttonVariant === "secondary" ? `shadow-field-drop ${BUTTON_GROUP_SEGMENT_RING_CLASS}` : ""}`
          : value
            ? ""
            : "gap-xs",
        className,
      ),
      children: jsxForUiDialog.jsx(runtime.TooltipProvider, {
        children: value2.map((input, options: number) => {
          let value5: keyof ButtonGroupSegmentContexts =
            options === 0 ? "start" : options === value3 ? "end" : "middle";
          return jsxForUiDialog.jsxs(
            reactForUiDialog.Fragment,
            {
              children: [
                value4 &&
                  options > 0 &&
                  jsxForUiDialog.jsx(ButtonGroupSeam, {
                    variant: buttonVariant,
                  }),
                jsxForUiDialog.jsx(runtime.buttonGroupContext.Provider, {
                  value: memo[value5],
                  children: jsxForUiDialog.jsx("div", {
                    "data-cds-segment": "",
                    className: "contents",
                    children: input,
                  }),
                }),
              ],
            },
            reactForUiDialog.isValidElement(input)
              ? (input.key as Key | undefined)
              : options,
          );
        }),
      }),
    });
  }
  function SplitButton({
    variant = "secondary",
    size: size,
    label: label,
    icon: icon,
    shortcut: shortcut,
    tooltip = false,
    tooltipSide: tooltipSide,
    indicator: indicator,
    "aria-label": ariaLabel,
    "aria-expanded": ariaExpanded,
    "aria-haspopup": ariaHaspopup,
    "aria-controls": ariaControls,
    "aria-keyshortcuts": ariaKeyshortcuts,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedby,
    onPrimaryClick: onPrimaryClick,
    onPrimaryPointerDown: onPrimaryPointerDown,
    onPrimaryMouseDown: onPrimaryMouseDown,
    pressed: pressed,
    primaryRef: primaryRef,
    groupLabel: groupLabel,
    menuLabel: menuLabel,
    menuTooltip = false,
    items: items,
    disabled: disabled,
    busy: busy,
    status: status,
    caretSize: caretSize,
    side: side,
    align = "end",
    collisionPadding: collisionPadding,
    open: open,
    onOpenChange: onOpenChange,
    className: className,
  }: SplitButtonProps): ReactElement {
    let value = (0, runtime.useTranslation)(
        "moreOptions",
        "More options",
      ),
      value2 = menuLabel ?? value,
      value3 = (0, runtime.useDensity)(),
      value4 =
        caretSize ?? (0, runtime.getMenuCaretSize)(value3, size),
      value5 =
        !disabled && (variant === "secondary" || variant === "ghost"),
      [value6, value7] = reactForUiDialog2.useState(false),
      value8 = open ?? value6,
      callback = (input: boolean): void => {
        value7(input);
        onOpenChange?.(input);
      },
      value9 =
        status !== undefined && status !== null && status !== false,
      value10 = variant === "ghost" && label !== undefined && !value9,
      value11 = variant === "ghost" && label === undefined && !value9,
      value12 = variant === "ghost" && value9,
      value13 = value10 || value11,
      value14 = (0, runtime.getButtonIconVerticalPadding)(
        (0, runtime.useButtonIconSize)(size),
      ),
      value15 =
        variant !== "ghost"
          ? SPLIT_CARET_STYLES
          : value10
            ? SPLIT_INLINE_CARET_STYLES
            : value11
              ? {
                  ...SPLIT_CARET_AUTO_STYLES,
                  "--cds-split-caret-tuck": value14,
                  marginInlineStart: `calc(-1 * ${value14})`,
                }
              : SPLIT_CARET_AUTO_STYLES,
      state = {
        ...(ariaKeyshortcuts !== undefined
          ? {
              "aria-keyshortcuts": ariaKeyshortcuts,
            }
          : undefined),
        ...(ariaDisabled !== undefined && !busy
          ? {
              "aria-disabled": ariaDisabled,
            }
          : undefined),
        ...(ariaDescribedby !== undefined
          ? {
              "aria-describedby": ariaDescribedby,
            }
          : undefined),
      },
      value16 = jsxForUiDialog2.jsxs("div", {
        className: "contents",
        children: [
          label === undefined
            ? jsxForUiDialog2.jsx(runtime.Button, {
                ref: primaryRef,
                busy: busy,
                disabled: disabled,
                pressed: pressed,
                onClick: onPrimaryClick,
                onPointerDown: onPrimaryPointerDown,
                onMouseDown: onPrimaryMouseDown,
                icon: icon,
                iconOnly: true,
                "aria-label": ariaLabel ?? "",
                "aria-expanded": ariaExpanded,
                "aria-haspopup": ariaHaspopup,
                "aria-controls": ariaControls,
                ...state,
                tooltip: tooltip,
                tooltipSide: tooltipSide,
                indicator: indicator,
                className: (0, runtime.clsx)(
                  value9 && "peer/slot",
                  value12 && SPLIT_LABEL_RADIUS_CLASS,
                  value11 && SPLIT_CARET_OPEN_CLASS,
                ),
              })
            : jsxForUiDialog2.jsx(runtime.Button, {
                ref: primaryRef,
                busy: busy,
                disabled: disabled,
                pressed: pressed,
                onClick: onPrimaryClick,
                onPointerDown: onPrimaryPointerDown,
                onMouseDown: onPrimaryMouseDown,
                "aria-expanded": ariaExpanded,
                "aria-haspopup": ariaHaspopup,
                "aria-controls": ariaControls,
                ...state,
                icon: icon,
                shortcut: shortcut,
                className: (0, runtime.clsx)(
                  SPLIT_LABEL_CLASS,
                  value9 && "peer/slot",
                  value12 && SPLIT_LABEL_RADIUS_CLASS,
                ),
                style: value10
                  ? SPLIT_LABEL_STYLES
                  : value9
                    ? SPLIT_LABEL_PAD_STYLES
                    : undefined,
                children: label,
              }),
          value9 &&
            jsxForUiDialog2.jsx("span", {
              className: (0, runtime.cn)(
                "flex shrink-0 items-center self-stretch pe-md",
                value12 && SPLIT_CARET_RADIUS_CLASS,
                BUTTON_GROUP_VARIANT_COLORS[variant]?.seam,
                SPLIT_LABEL_HOVER_CLASSES[variant],
                SPLIT_BUTTON_TRANSITION_CLASS,
                SPLIT_BUTTON_DISABLED_CLASS,
              ),
              children: status,
            }),
        ],
      });
    return jsxForUiDialog2.jsxs(ButtonGroupRoot, {
      "data-cds": "SplitDropdownButton",
      "aria-label":
        groupLabel ??
        (typeof label === "string" ? label : (ariaLabel ?? value2)),
      variant: "joined",
      buttonVariant: variant,
      size: size,
      className: (0, runtime.cn)(
        "group/split",
        value13 && SPLIT_BUTTON_RING_CLASS,
        value10 && SPLIT_PAINT_EDGE_CLASS,
        className,
      ),
      "data-popup-open": value8 ? "" : undefined,
      "data-disabled": disabled || undefined,
      style: value13
        ? {
            "--cds-split-inset": `min(calc(${value14} / 2), 3px)`,
          }
        : undefined,
      children: [
        value16,
        jsxForUiDialog2.jsx(runtime.Menu, {
          iconOnly: true,
          icon: jsxForUiDialog2.jsx(runtime.Icon, {
            name: "CaretDown",
            size: value4,
            className: value5 ? "text-muted" : undefined,
          }),
          "aria-label": value2,
          tooltip: menuTooltip,
          disabled: disabled,
          className:
            variant === "ghost"
              ? (0, runtime.cn)(
                  SPLIT_CARET_HIT_CLASS,
                  value11 && SPLIT_CARET_RECESSED_HIT_CLASS,
                )
              : undefined,
          items: items,
          side: side,
          align: align,
          collisionPadding: collisionPadding,
          open: open,
          onOpenChange: callback,
          style: value15,
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "preventDialogBackdropDefault",
    () => preventDialogBackdropDefault,
  );
  bindRuntimeValue(
    runtime,
    "preserveDialogBackdropFocus",
    () => preserveDialogBackdropFocus,
  );
  bindRuntimeValue(
    runtime,
    "DesktopWindowDragStrip",
    () => DesktopWindowDragStrip,
  );
  bindRuntimeValue(runtime, "useDialogStyleDebug", () => useDialogStyleDebug);
  bindRuntimeValue(
    runtime,
    "useDialogInitialFocus",
    () => useDialogInitialFocus,
  );
  bindRuntimeValue(runtime, "DialogCloseButton", () => DialogCloseButton);
  bindRuntimeValue(runtime, "DialogHeader", () => DialogHeader);
  bindRuntimeValue(runtime, "DialogFooter", () => DialogFooter);
  bindRuntimeValue(runtime, "DialogRoot", () => DialogRoot);
  bindRuntimeValue(runtime, "AlertDialogRoot", () => AlertDialogRoot);
  bindRuntimeValue(runtime, "ConfirmationDialog", () => ConfirmationDialog);
  bindRuntimeValue(
    runtime,
    "reactI5",
    () => reactI5,
    (value) => {
      reactI5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxD5",
    () => jsxD5,
    (value) => {
      jsxD5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIALOG_POPUP_CLASS",
    () => DIALOG_POPUP_CLASS,
    (value) => {
      DIALOG_POPUP_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIALOG_MAX_HEIGHT_CLASS",
    () => DIALOG_MAX_HEIGHT_CLASS,
    (value) => {
      DIALOG_MAX_HEIGHT_CLASS = value;
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
    "dialogBackdropFocusAbortController",
    () => dialogBackdropFocusAbortController,
    (value) => {
      dialogBackdropFocusAbortController = value;
    },
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
    "DIALOG_Z_INDEX_CLASS_PATTERN",
    () => DIALOG_Z_INDEX_CLASS_PATTERN,
    (value) => {
      DIALOG_Z_INDEX_CLASS_PATTERN = value;
    },
  );
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
    "DIALOG_TITLE_CLASS",
    () => DIALOG_TITLE_CLASS,
    (value) => {
      DIALOG_TITLE_CLASS = value;
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
  bindRuntimeValue(
    runtime,
    "DialogComponents",
    () => DialogComponents,
    (value) => {
      DialogComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AlertDialogComponents",
    () => AlertDialogComponents,
    (value) => {
      AlertDialogComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDialog",
    () => initializeUiDialog,
    (value) => {
      initializeUiDialog = value;
    },
  );
  bindRuntimeValue(runtime, "ButtonGroupSeam", () => ButtonGroupSeam);
  bindRuntimeValue(runtime, "ButtonGroupRoot", () => ButtonGroupRoot);
  bindRuntimeValue(
    runtime,
    "reactForUiDialog",
    () => reactForUiDialog,
    (value) => {
      reactForUiDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiDialog",
    () => jsxForUiDialog,
    (value) => {
      jsxForUiDialog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_GROUP_SEGMENT_RING_CLASS",
    () => BUTTON_GROUP_SEGMENT_RING_CLASS,
    (value) => {
      BUTTON_GROUP_SEGMENT_RING_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_GROUP_VARIANT_COLORS",
    () => BUTTON_GROUP_VARIANT_COLORS,
    (value) => {
      BUTTON_GROUP_VARIANT_COLORS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_GROUP_SEAM_HOVER_CLASS",
    () => BUTTON_GROUP_SEAM_HOVER_CLASS,
    (value) => {
      BUTTON_GROUP_SEAM_HOVER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUTTON_GROUP_SEAM_DISABLED_CLASS",
    () => BUTTON_GROUP_SEAM_DISABLED_CLASS,
    (value) => {
      BUTTON_GROUP_SEAM_DISABLED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDialog2",
    () => initializeUiDialog2,
    (value) => {
      initializeUiDialog2 = value;
    },
  );
  bindRuntimeValue(runtime, "SplitButton", () => SplitButton);
  bindRuntimeValue(
    runtime,
    "reactForUiDialog2",
    () => reactForUiDialog2,
    (value) => {
      reactForUiDialog2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiDialog2",
    () => jsxForUiDialog2,
    (value) => {
      jsxForUiDialog2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_CARET_STYLES",
    () => SPLIT_CARET_STYLES,
    (value) => {
      SPLIT_CARET_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_CARET_AUTO_STYLES",
    () => SPLIT_CARET_AUTO_STYLES,
    (value) => {
      SPLIT_CARET_AUTO_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_LABEL_STYLES",
    () => SPLIT_LABEL_STYLES,
    (value) => {
      SPLIT_LABEL_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_LABEL_CLASS",
    () => SPLIT_LABEL_CLASS,
    (value) => {
      SPLIT_LABEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_LABEL_PAD_STYLES",
    () => SPLIT_LABEL_PAD_STYLES,
    (value) => {
      SPLIT_LABEL_PAD_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_LABEL_HOVER_CLASSES",
    () => SPLIT_LABEL_HOVER_CLASSES,
    (value) => {
      SPLIT_LABEL_HOVER_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_BUTTON_TRANSITION_CLASS",
    () => SPLIT_BUTTON_TRANSITION_CLASS,
    (value) => {
      SPLIT_BUTTON_TRANSITION_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_BUTTON_DISABLED_CLASS",
    () => SPLIT_BUTTON_DISABLED_CLASS,
    (value) => {
      SPLIT_BUTTON_DISABLED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_INLINE_CARET_STYLES",
    () => SPLIT_INLINE_CARET_STYLES,
    (value) => {
      SPLIT_INLINE_CARET_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_CARET_HIT_CLASS",
    () => SPLIT_CARET_HIT_CLASS,
    (value) => {
      SPLIT_CARET_HIT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_CARET_RECESSED_HIT_CLASS",
    () => SPLIT_CARET_RECESSED_HIT_CLASS,
    (value) => {
      SPLIT_CARET_RECESSED_HIT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_CARET_OPEN_CLASS",
    () => SPLIT_CARET_OPEN_CLASS,
    (value) => {
      SPLIT_CARET_OPEN_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_LABEL_RADIUS_CLASS",
    () => SPLIT_LABEL_RADIUS_CLASS,
    (value) => {
      SPLIT_LABEL_RADIUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_CARET_RADIUS_CLASS",
    () => SPLIT_CARET_RADIUS_CLASS,
    (value) => {
      SPLIT_CARET_RADIUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_BUTTON_RING_CLASS",
    () => SPLIT_BUTTON_RING_CLASS,
    (value) => {
      SPLIT_BUTTON_RING_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_PAINT_EDGE_CLASS",
    () => SPLIT_PAINT_EDGE_CLASS,
    (value) => {
      SPLIT_PAINT_EDGE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDialog3",
    () => initializeUiDialog3,
    (value) => {
      initializeUiDialog3 = value;
    },
  );
  return () => {
    DIALOG_MAX_HEIGHT_CLASS =
      "max-h-[calc(100dvh_-_max(2rem,2*var(--desktop-titlebar-inset,0px))_-_2*max(env(safe-area-inset-top,0px),env(safe-area-inset-bottom,0px)))]";
    dialogPopupPositionClasses =
      "isolate flex min-h-0 flex-1 flex-col overflow-y-auto scroll-fade-y rounded-[inherit] p-xl";
    dialogPopupTransitionClasses =
      "transition-[opacity,scale,filter] duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.98] starting:opacity-0 starting:scale-[0.98] motion-reduce:data-[starting-style]:scale-100 data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98]";
    dialogBackdropClasses =
      "draggable-none fixed inset-0 bg-backdrop transition-opacity duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 has-[~[data-nested]]:bg-transparent has-[~[data-nested]]:backdrop-blur-none";
    dialogStartingOpacityClass = "starting:opacity-0";
    dialogBackdropFocusAbortController = null;
    nestedDialogOverlayClasses =
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-backdrop after:opacity-0 after:z-50 after:transition-opacity after:duration-base after:ease-out data-[nested-dialog-open]:after:opacity-100";
    nestedDialogBlurClasses = "data-[nested-dialog-open]:blur-[2px]";
    dialogTitleClasses = "text-heading font-medium break-words";
    DIALOG_TITLE_CLASS = "text-title font-semibold break-words";
    dialogDescriptionSmallSpacing = "-mt-0.5";
    dialogDescriptionLargeSpacing = "-mt-1";
    dialogDescriptionClasses =
      "mt-1 text-body font-normal text-secondary break-words";
    DIALOG_AUTOFILL_WAIT_MS = 250;
    DIALOG_HIDDEN_SELECTOR = '[aria-hidden="true"], [inert]';
    dialogCloseButtonOutsetClasses = "-me-pad-sm -mt-pad-sm";
    initializeUiDialog = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeElementAccess)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializeOverlaySelector)();
      (0, runtime.initializeCloseOnActivityHide)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeUiDisclosure9)();
      (0, runtime.initializeSurfaces)();
      (0, runtime.initializeOverlayActions)();
      (0, runtime.initializeOverlayFocus)();
      (0, runtime.initializeUiInputs10)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactI5 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxD5 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      DIALOG_POPUP_CLASS = `${(0, runtime.getSurfaceClasses)("popover")} shadow-panel-lg`;
      dialogFullHeightClasses = `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-[calc(100vw-2rem)] ${DIALOG_MAX_HEIGHT_CLASS} ${DIALOG_POPUP_CLASS} cds-reset text-body font-normal text-primary outline-none focus-visible:outline-hidden`;
      desktopWindowDragStripStyle = {
        height: "var(--desktop-titlebar-inset, 0px)",
        WebkitAppRegion: "drag",
      };
      dialogSizeClasses = {
        sm: "max-w-[400px]",
        md: "max-w-[520px]",
        lg: "max-w-[720px]",
        xl: "max-w-[880px]",
        "2xl": "max-w-[1024px]",
        "3xl": "max-w-[1152px]",
      };
      DIALOG_Z_INDEX_CLASS_PATTERN = /(^|\s)!?-?z-/;
      dialogStateContext = reactI5.createContext<DialogModal | undefined>(
        undefined,
      );
      confirmationDialogContext = reactI5.createContext(false);
      dialogTriggerRefContext = reactI5.createContext<
        FocusTargetRef | undefined
      >(undefined);
      dialogInitialFocusContext = reactI5.createContext(false);
      DialogTrigger = reactI5.forwardRef<HTMLElement, DialogTriggerProps>(
        (input, options) => {
          let value = reactI5.useContext(dialogTriggerRefContext),
            value2 = input.handle ? null : (value ?? null),
            value3 = (0, runtime.useMergedRefs)(options, value2);
          return jsxD5.jsx(runtime.baseAlertDialog.Trigger, {
            ref: value3,
            ...input,
          });
        },
      );
      DialogTrigger.displayName = "Dialog.Trigger";
      DialogPopupInner = reactI5.forwardRef<
        HTMLElement,
        DialogPopupInnerProps
      >(
        (
          {
            finalFocus: finalFocus,
            fitVisualViewport: fitVisualViewport,
            children: children,
            ...props
          },
          options,
        ) => {
          let value = reactI5.useContext(dialogStateContext),
            value2 = reactI5.useContext(dialogTriggerRefContext),
            { finalFocus: value3, popupRef: value4 } = (0,
            runtime.useOverlayFinalFocus)(true, value !== false, value2),
            value5 = (0, runtime.useDialogVisualKeyboard)(
              fitVisualViewport,
            ),
            value6 = (0, runtime.useMergedRefs)(
              options,
              value4,
              value5,
            );
          return jsxD5.jsx(runtime.baseAlertDialog.Popup, {
            [runtime.OVERLAY_ATTRIBUTE]: "",
            ref: value6,
            finalFocus: finalFocus ?? value3,
            "aria-modal": value === false ? "false" : undefined,
            ...props,
            children: children,
          });
        },
      );
      DialogPopupInner.displayName = "Dialog.PopupInner";
      ConfirmationDialogPopupInner = reactI5.forwardRef<
        HTMLElement,
        ConfirmationDialogPopupInnerProps
      >(
        (
          { children: children, ...props },
          options,
        ) => {
          let value = (0, runtime.useDialogVisualKeyboard)(true),
            value2 = (0, runtime.useMergedRefs)(options, value);
          return jsxD5.jsx(runtime.baseDialog.Popup, {
            [runtime.OVERLAY_ATTRIBUTE]: "",
            ref: value2,
            ...props,
            children: children,
          });
        },
      );
      ConfirmationDialogPopupInner.displayName =
        "ConfirmationDialog.PopupInner";
      DialogPopup = reactI5.forwardRef<HTMLDivElement, DialogPopupProps>(
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
          },
          options,
        ) => {
          let value = unstyled
              ? ""
              : `${dialogFullHeightClasses} ${dialogPopupTransitionClasses} ${nestedDialogBlurClasses} ${dialogSizeClasses[size]} ${fullHeight ? "h-dvh" : ""}`,
            value2 = (0, runtime.useDefaultOverlayLayer)("modal");
          useDialogStyleDebug(portalClassName);
          let value3 = reactI5.useContext(dialogStateContext),
            value4 = reactI5.useContext(dialogInitialFocusContext),
            value5 = value3 === undefined || value3 === true;
          return jsxD5.jsx(runtime.baseAlertDialog.Portal, {
            container: (0, runtime.usePortalContainer)(),
            children: jsxD5.jsx(runtime.PortalRoot, {
              className: (0, runtime.cn)("relative", portalClassName),
              style: value2.style,
              surface:
                surface ??
                (unstyled ? undefined : runtime.elevationSurfaceNames.popover),
              closeOnActivityHide: true,
              children: jsxD5.jsxs(runtime.layerBaseContext.Provider, {
                value: value2.base,
                children: [
                  jsxD5.jsx(runtime.baseAlertDialog.Backdrop, {
                    forceRender: value5,
                    onMouseDown: value4
                      ? preserveDialogBackdropFocus
                      : preventDialogBackdropDefault,
                    className: (0, runtime.cn)(
                      dialogBackdropClasses,
                      !unstyled && dialogStartingOpacityClass,
                      value3 === false && "pointer-events-none opacity-0",
                      backdropClassName,
                    ),
                    style: backdropStyle,
                  }),
                  jsxD5.jsx(DesktopWindowDragStrip, {}),
                  jsxD5.jsx(DialogPopupInner, {
                    "data-cds": "Dialog",
                    ref: options,
                    ...props,
                    fitVisualViewport: !unstyled,
                    className: (0, runtime.cn)(
                      "draggable-none",
                      nestedDialogOverlayClasses,
                      value,
                      className,
                    ),
                    children: unstyled
                      ? children
                      : jsxD5.jsx("div", {
                          className: dialogPopupPositionClasses,
                          children: children,
                        }),
                  }),
                ],
              }),
            }),
          });
        },
      );
      DialogPopup.displayName = "Dialog.Popup";
      DialogTitle = reactI5.forwardRef<HTMLHeadingElement, DialogTitleProps>(
        (
          { className: className, ...props },
          options,
        ) => {
          let value = reactI5.useContext(confirmationDialogContext);
          return jsxD5.jsx(runtime.baseAlertDialog.Title, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(
              "text-primary",
              value ? dialogTitleClasses : DIALOG_TITLE_CLASS,
              className,
            ),
          });
        },
      );
      DialogTitle.displayName = "Dialog.Title";
      (DialogCloseButton as FunctionComponent<DialogCloseButtonProps>).displayName = "Dialog.CloseButton";
      (DialogHeader as FunctionComponent<DialogHeaderProps>).displayName = "Dialog.Header";
      DialogDescription = reactI5.forwardRef<
        HTMLParagraphElement,
        DialogDescriptionProps
      >(
        (
          { className: className, ...props },
          options,
        ) =>
          jsxD5.jsx(runtime.baseAlertDialog.Description, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(dialogDescriptionClasses, className),
          }),
      );
      DialogDescription.displayName = "Dialog.Description";
      dialogFooterAlignmentClasses = {
        start: "sm:justify-start",
        center: "sm:justify-center",
        end: "sm:justify-end",
        between: "sm:justify-between",
      };
      (DialogFooter as FunctionComponent<DialogFooterProps>).displayName = "Dialog.Footer";
      (DialogRoot as FunctionComponent<DialogRootProps>).displayName = "Dialog.Root";
      DialogComponents = {
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
      (AlertDialogRoot as FunctionComponent<AlertDialogRootProps>).displayName = "AlertDialog.Root";
      AlertDialogComponents = {
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
    });
    BUTTON_GROUP_SEGMENT_RING_CLASS =
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:[box-shadow:inset_0_0_0_1px_var(--cds-fill-secondary-ring)]";
    BUTTON_GROUP_SEAM_HOVER_CLASS =
      "[[data-cds-segment]:hover+&>[data-cds-seam-line]]:opacity-0 [&:has(+[data-cds-segment]:hover)>[data-cds-seam-line]]:opacity-0 [[data-cds-segment]:has([aria-haspopup][aria-expanded=true])+&>[data-cds-seam-line]]:opacity-0 [&:has(+[data-cds-segment]_[aria-haspopup][aria-expanded=true])>[data-cds-seam-line]]:opacity-0 [[data-cds-segment]:has([aria-pressed=true])+&>[data-cds-seam-line]]:opacity-0 [&:has(+[data-cds-segment]_[aria-pressed=true])>[data-cds-seam-line]]:opacity-0";
    BUTTON_GROUP_SEAM_DISABLED_CLASS =
      "[[data-cds-segment]:has(:disabled:not([aria-busy]))+&:has(+[data-cds-segment]_:disabled:not([aria-busy]))]:opacity-disabled";
    initializeUiDialog2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeUiDisclosure9)();
      reactForUiDialog = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiDialog = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      BUTTON_GROUP_VARIANT_COLORS = {
        secondary: {
          seam: "bg-fill-secondary",
          line: "bg-border",
        },
        primary: {
          seam: "bg-fill-primary",
          line: "bg-[var(--cds-on-primary)] opacity-25",
        },
        danger: {
          seam: "bg-fill-danger",
          line: "bg-[var(--cds-on-danger)] opacity-25",
        },
        brand: {
          seam: "bg-fill-brand",
          line: "bg-[var(--cds-on-brand)] opacity-25",
        },
      };
    });
    SPLIT_LABEL_CLASS = "min-w-0 shrink";
    SPLIT_BUTTON_TRANSITION_CLASS = "transition-colors duration-fast ease-out";
    SPLIT_BUTTON_DISABLED_CLASS =
      "peer-[:disabled:not([aria-busy])]/slot:opacity-disabled";
    SPLIT_CARET_HIT_CLASS =
      "after:absolute after:inset-y-0 after:start-0 after:-end-2 after:content-['']";
    SPLIT_CARET_RECESSED_HIT_CLASS =
      "pointer-events-none after:pointer-events-auto after:start-[calc(var(--cds-split-caret-tuck)-1px)] after:-end-[calc(3px+var(--cds-split-caret-tuck))]";
    SPLIT_CARET_OPEN_CLASS =
      "group-data-[popup-open]/split:pointer-events-none";
    SPLIT_LABEL_RADIUS_CLASS = "rounded-e-none";
    SPLIT_CARET_RADIUS_CLASS = "rounded-e";
    SPLIT_PAINT_EDGE_CLASS =
      "[&>[data-cds-segment]:first-child_[data-cds-part=paint]]:pe-0 [&>[data-cds-segment]:last-child_[data-cds-part=paint]]:ps-0";
    initializeUiDialog3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeUiDisclosure9)();
      (0, runtime.initializeUiMenu9)();
      initializeUiDialog2();
      (0, runtime.initializeNpmDependency)();
      reactForUiDialog2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiDialog2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      SPLIT_CARET_STYLES = {
        aspectRatio: "auto",
        paddingInline: 4,
        minWidth: 0,
      };
      SPLIT_CARET_AUTO_STYLES = {
        ...SPLIT_CARET_STYLES,
        width: "auto",
      };
      SPLIT_LABEL_STYLES = {
        paddingInlineEnd: 5,
      };
      SPLIT_LABEL_PAD_STYLES = {
        paddingInlineEnd: 4,
      };
      SPLIT_LABEL_HOVER_CLASSES = {
        primary: "peer-hover/slot:bg-fill-primary-hover",
        secondary: "peer-hover/slot:bg-fill-secondary-hover",
        ghost: "peer-hover/slot:bg-fill-ghost-hover",
        danger: "peer-hover/slot:bg-fill-danger-hover",
        brand: "peer-hover/slot:bg-fill-brand-hover",
      };
      SPLIT_INLINE_CARET_STYLES = {
        ...SPLIT_CARET_AUTO_STYLES,
        paddingInlineStart: 0,
      };
      SPLIT_BUTTON_RING_CLASS = [
        "shadow-[inset_0_0_0_1px_var(--cds-split-ring,transparent)] transition-[box-shadow] duration-fast ease-out",
        "[&:not([data-disabled])]:hover:[--cds-split-ring:var(--cds-border)]",
        "data-[popup-open]:[--cds-split-ring:var(--cds-border)]",
        "[&:not([data-disabled])]:has-[[aria-pressed=true]]:[--cds-split-ring:var(--cds-border)]",
        "[&_[data-cds-part=paint]]:p-(--cds-split-inset) [&_[data-cds-part=paint]]:bg-clip-content",
      ].join(" ");
    });
  };
}

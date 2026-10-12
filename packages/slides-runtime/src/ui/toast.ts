/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { Field as BaseField } from "@base-ui/react/field";
import type { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import type { ToastManagerAddOptions, ToastObject } from "@base-ui/react/toast";
import type { BaseUIEvent, HTMLProps } from "@base-ui/react/types";
import type {
  Context,
  ForwardRefExoticComponent,
  ForwardedRef,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  RefAttributes,
  RefObject,
  TextareaHTMLAttributes,
} from "react";
import type { ButtonSize } from "./disclosure";
import type { FieldStateContextValue, TextInputProps } from "./menu";

/** Visual style of a toast. */
export type ToastVariant = "neutral" | "warning" | "danger";

type ToastSwipeDirection = "up" | "down" | "left" | "right";

/** Custom data the notification layer keeps on each Base UI toast. */
export interface ToastData {
  variant?: ToastVariant;
  /** A custom icon node; `null` hides the icon and a boolean keeps the default one. */
  icon?: ReactNode;
  /** The title when it is not plain text. */
  titleNode?: ReactNode;
  /** The title when it is plain text; the repeat count is appended to it. */
  baseTitle?: string;
  count?: number;
  action?: ReactNode;
  dedupeKey?: string;
  /** Epoch milliseconds at which the toast auto-dismisses. */
  expiresAt?: number;
}

/** A toast as Base UI reports it. */
export type LiveToast = ToastObject<ToastData>;

/** The toast kept on screen until it is dismissed. */
export interface PinnedToastData {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: ToastVariant;
  dismissible?: boolean;
  dismissLabel?: string;
  onClose?: () => void;
}

/** Bookkeeping that keeps a deduplicated toast from firing its close handler while it is re-added. */
export interface ToastMovementState {
  allocId: () => string;
  movingIds: Set<string>;
  userDismissAt: Map<string, number>;
}

export interface PinnedToastContextValue extends ToastMovementState {
  pinned: PinnedToastData | null;
  setPinned: (toast: PinnedToastData | null) => void;
  slotRef: RefObject<HTMLDivElement | null>;
  focusWasInsideRef: RefObject<boolean>;
  liveToasts: RefObject<LiveToast[]>;
  syncLiveToasts: (toasts: LiveToast[]) => void;
  defaultTimeout: number | undefined;
}

/** Options of `useToastNotifications().add`. */
export interface ToastAddOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  icon?: ReactNode;
  action?: ReactNode;
  timeout?: number;
  onClose?: (info: { byUser: boolean }) => void;
  /** Merge into an existing toast with the same key instead of adding another one. */
  dedupe?: boolean;
  dedupeKey?: string;
}

export interface ToastNotifications {
  add: (options: ToastAddOptions) => string;
  close: (toastId?: string) => void;
  setPinned: (toast: PinnedToastData | null) => void;
}

export interface ToastProviderProps {
  children?: ReactNode;
  timeout?: number;
  limit?: number;
  viewportClassName?: string;
}

interface ToastViewProps {
  toast: LiveToast;
  front: boolean;
  frontHeight?: number;
  zIndex: number;
}

interface PinnedToastViewProps {
  pinned: PinnedToastData;
  onDismiss: () => void;
}

interface PinnedToastSlotProps {
  ctx: PinnedToastContextValue;
}

interface ToastViewportProps {
  className?: string;
}

/** Label, hint and error chrome shared by the field wrappers. */
export interface FieldChromeProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
  required?: boolean;
}

export interface FieldWrapperProps extends Omit<FieldChromeProps, "required"> {
  children?: ReactNode;
}

export type FieldRootProps = Omit<BaseField.Root.Props, "className" | "ref"> & {
  className?: string;
};
export type FieldLabelProps = Omit<BaseField.Label.Props, "className" | "ref"> & {
  className?: string;
};
export type FieldDescriptionProps = Omit<
  BaseField.Description.Props,
  "className" | "ref"
> & { className?: string };
export type FieldErrorProps = Omit<BaseField.Error.Props, "className" | "ref"> & {
  className?: string;
};

export interface FieldTextInputProps extends FieldChromeProps, TextInputProps {}

export interface FieldTextAreaProps
  extends FieldChromeProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  className?: string;
  resize?: "none" | "y";
  autosize?: boolean;
  bare?: boolean;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export interface FieldNumberInputProps
  extends FieldChromeProps,
    Omit<BaseNumberField.Root.Props, "className" | "ref" | "render"> {
  className?: string;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** ISO currency code that renders a symbol slot next to the input. */
  currency?: string;
  slotStart?: ReactNode;
  slotEnd?: ReactNode;
}

type BooleanKey = "false" | "true";

/** Field state published to the text inputs, keyed by `disabled` then by `invalid`. */
type FieldLabelLayoutClasses = Record<
  BooleanKey,
  Record<BooleanKey, FieldStateContextValue>
>;

declare module "../bindings" {
  interface RuntimeBindings {
    reactg6: ReactNamespace;
    jsxt5: JsxNamespace;
    reactForUiToast: ReactNamespace;
    jsxForUiToast: JsxNamespace;
    reactForUiToast2: ReactNamespace;
    jsxForUiToast2: JsxNamespace;
    reactForUiToast3: ReactNamespace;
    jsxForUiToast3: JsxNamespace;
    reactForUiToast4: ReactNamespace;
    jsxForUiToast4: JsxNamespace;
    DEFAULT_TOAST_TIMEOUT_MS: number;
    TOAST_TRANSITION_TIMEOUT_MS: number;
    toastSurfaceClasses: string;
    toastVariantClasses: Record<ToastVariant, string>;
    toastVariantTextClasses: Record<ToastVariant, string>;
    toastDefaultIconNames: Record<ToastVariant, string>;
    toastSecondaryTextClasses: Record<ToastVariant, string>;
    toastStackTransformClasses: string;
    toastContentClasses: string;
    toastBodyClasses: string;
    toastDismissButtonClasses: string;
    emptyToastList: ToastSwipeDirection[];
    pinnedToastContext: Context<PinnedToastContextValue | null>;
    noopToastPinSetter: () => void;
    initializeUiToast: () => void;
    initializeUiToast2: () => void;
    initializeUiToast3: () => void;
    initializeUiToast4: () => void;
    initializeUiToast5: () => void;
    FIELD_LABEL_LAYOUT_CLASSES: FieldLabelLayoutClasses;
    FieldRoot: ForwardRefExoticComponent<FieldRootProps & RefAttributes<HTMLDivElement>>;
    FieldLabel: ForwardRefExoticComponent<FieldLabelProps & RefAttributes<HTMLElement>>;
    FieldDescription: ForwardRefExoticComponent<FieldDescriptionProps & RefAttributes<HTMLParagraphElement>>;
    FieldError: ForwardRefExoticComponent<FieldErrorProps & RefAttributes<HTMLDivElement>>;
    FieldWrapper: (props: FieldWrapperProps) => ReactElement;
    FieldRootWithLabel: RuntimeBindings["baseField"]["Control"];
    FieldRow: RuntimeBindings["baseField"]["Validity"];
    FieldTextInput: ForwardRefExoticComponent<FieldTextInputProps & RefAttributes<HTMLInputElement>>;
    FieldTextArea: ForwardRefExoticComponent<FieldTextAreaProps & RefAttributes<HTMLTextAreaElement>>;
    FieldNumberInput: ForwardRefExoticComponent<FieldNumberInputProps & RefAttributes<HTMLInputElement>>;
    normalizeToastTimeout: (timeout?: number) => number | undefined;
    ToastView: (props: ToastViewProps) => ReactElement;
    PinnedToastView: (props: PinnedToastViewProps) => ReactElement;
    containsVisibleFocus: (input?: HTMLElement | null) => boolean;
    PinnedToastSlot: (props: PinnedToastSlotProps) => ReactElement;
    ToastViewport: (props: ToastViewportProps) => ReactElement;
    createToastMovementState: () => ToastMovementState;
    ToastProvider: (props: ToastProviderProps) => ReactElement;
    useToastNotifications: () => ToastNotifications;
  }
}

export function installUiToast(runtime: RuntimeBindings): () => void {
  var reactg6: ReactNamespace;
  var jsxt5: JsxNamespace;
  var DEFAULT_TOAST_TIMEOUT_MS: number;
  var TOAST_TRANSITION_TIMEOUT_MS: number;
  var toastSurfaceClasses: string;
  var toastVariantClasses: Record<ToastVariant, string>;
  var toastVariantTextClasses: Record<ToastVariant, string>;
  var toastDefaultIconNames: Record<ToastVariant, string>;
  var toastSecondaryTextClasses: Record<ToastVariant, string>;
  var toastStackTransformClasses: string;
  var toastContentClasses: string;
  var toastBodyClasses: string;
  var toastDismissButtonClasses: string;
  var emptyToastList: ToastSwipeDirection[];
  var pinnedToastContext: Context<PinnedToastContextValue | null>;
  var noopToastPinSetter: () => void;
  var initializeUiToast: () => void;
  var reactForUiToast: ReactNamespace;
  var jsxForUiToast: JsxNamespace;
  var FIELD_LABEL_LAYOUT_CLASSES: FieldLabelLayoutClasses;
  var FieldRoot: ForwardRefExoticComponent<FieldRootProps & RefAttributes<HTMLDivElement>>;
  var FieldLabel: ForwardRefExoticComponent<FieldLabelProps & RefAttributes<HTMLElement>>;
  var FieldDescription: ForwardRefExoticComponent<FieldDescriptionProps & RefAttributes<HTMLParagraphElement>>;
  var FieldError: ForwardRefExoticComponent<FieldErrorProps & RefAttributes<HTMLDivElement>>;
  var FieldWrapper: (props: FieldWrapperProps) => ReactElement;
  var FieldRootWithLabel: RuntimeBindings["baseField"]["Control"];
  var FieldRow: RuntimeBindings["baseField"]["Validity"];
  var initializeUiToast2: () => void;
  var reactForUiToast2: ReactNamespace;
  var jsxForUiToast2: JsxNamespace;
  var FieldTextInput: ForwardRefExoticComponent<FieldTextInputProps & RefAttributes<HTMLInputElement>>;
  var initializeUiToast3: () => void;
  var reactForUiToast3: ReactNamespace;
  var jsxForUiToast3: JsxNamespace;
  var FieldTextArea: ForwardRefExoticComponent<FieldTextAreaProps & RefAttributes<HTMLTextAreaElement>>;
  var initializeUiToast4: () => void;
  var reactForUiToast4: ReactNamespace;
  var jsxForUiToast4: JsxNamespace;
  var FieldNumberInput: ForwardRefExoticComponent<FieldNumberInputProps & RefAttributes<HTMLInputElement>>;
  var initializeUiToast5: () => void;
  function normalizeToastTimeout(timeout?: number): number | undefined {
    if (timeout === undefined || timeout <= 0) {
      return timeout;
    }
    if (!Number.isFinite(timeout)) {
      return 0;
    }
    if (timeout < 6000) {
      return DEFAULT_TOAST_TIMEOUT_MS;
    }
    return timeout;
  }
  function ToastView({
    toast: toast,
    front: front,
    frontHeight: frontHeight,
    zIndex: zIndex,
  }: ToastViewProps): ReactElement {
    let value =
        toast.data?.variant ?? (toast.type as ToastVariant | undefined) ?? "neutral",
      value2 = toast.data?.icon,
      value3 =
        value2 !== null && value2 !== undefined && typeof value2 !== "boolean",
      value4 = !front,
      value5 = value4 && frontHeight ? frontHeight : undefined,
      value6 = (0, runtime.useTranslation)("dismiss", "Dismiss"),
      { update: value7 } = runtime.baseToast.useToastManager<ToastData>(),
      value8 = reactg6.useContext(pinnedToastContext),
      ref = reactg6.useRef<HTMLSpanElement | null>(null),
      ref2 = reactg6.useRef(""),
      value9 = toast.data?.titleNode,
      value10 = toast.data?.count ?? 1,
      id = toast.id,
      callback = () => {
        let value16 = value8?.userDismissAt,
          value17 = Date.now();
        for (let [value18, value19] of (value16 ?? []))
          if (value17 - value19 > TOAST_TRANSITION_TIMEOUT_MS) {
            value16?.delete(value18);
          }
        value16?.set(id, value17);
      };
    reactg6.useLayoutEffect(() => {
      let current = ref.current;
      if (value9 === undefined || !current) {
        return;
      }
      let callback2 = () => {
        let value16 = current.textContent ?? "";
        if (value16 !== ref2.current) {
          ref2.current = value16;
          value7(id, {
            title: value16,
          });
        }
      };
      callback2();
      let observer = new MutationObserver(callback2);
      observer.observe(current, {
        characterData: true,
        childList: true,
        subtree: true,
      });
      return () => observer.disconnect();
    }, [value9, id, value7]);
    let value11 = toast.transitionStatus === "ending",
      [value12, value13] = reactg6.useState({
        behind: value4,
        lockedHeight: value5,
      });
    if (
      !value11 &&
      (value12.behind !== value4 || value12.lockedHeight !== value5)
    ) {
      value13({
        behind: value4,
        lockedHeight: value5,
      });
    }
    let value14 = value11 ? value12.behind : value4,
      value15 = value11 ? value12.lockedHeight : value5;
    return jsxt5.jsx(runtime.baseToast.Root, {
      toast: toast,
      swipeDirection: emptyToastList,
      className: toastStackTransformClasses,
      style: {
        zIndex: zIndex,
      },
      onKeyDown: (input: BaseUIEvent<KeyboardEvent<HTMLDivElement>>): void => {
        if (
          input.key === "Escape" &&
          input.currentTarget.contains(
            input.currentTarget.ownerDocument.activeElement,
          )
        ) {
          callback();
        }
      },
      children: jsxt5.jsx("div", {
        className: `${toastSurfaceClasses} ${toastVariantClasses[value]} ${toastVariantTextClasses[value]}`,
        children: jsxt5.jsxs("div", {
          className: toastContentClasses,
          "data-behind": value14 ? "" : undefined,
          style:
            value15 !== undefined
              ? {
                  height: value15,
                }
              : undefined,
          children: [
            value2 !== null &&
              jsxt5.jsx("span", {
                className: `shrink-0 ${toastSecondaryTextClasses[value]}`,
                children: value3
                  ? value2
                  : jsxt5.jsx(runtime.Icon, {
                      name: toastDefaultIconNames[value],
                      size: "md",
                    }),
              }),
            jsxt5.jsxs("div", {
              className: toastBodyClasses,
              children: [
                jsxt5.jsxs(runtime.baseToast.Title, {
                  className: "font-medium",
                  "aria-atomic": "true",
                  children: [
                    jsxt5.jsx("span", {
                      ref: ref,
                      children: value9 ?? toast.data?.baseTitle,
                    }),
                    value10 > 1 &&
                      jsxt5.jsx("span", {
                        "aria-live": value10 > 2 ? "off" : undefined,
                        "data-cds-toast-count": "",
                        children: ` (×${value10})`,
                      }),
                  ],
                }),
                jsxt5.jsx(runtime.baseToast.Description, {}),
                toast.data?.action &&
                  jsxt5.jsx("div", {
                    className: "mt-pad-md empty:hidden",
                    children: toast.data.action,
                  }),
              ],
            }),
            jsxt5.jsx(runtime.baseToast.Close, {
              "aria-label": value6,
              className: toastDismissButtonClasses,
              onClick: callback,
              children: jsxt5.jsx(runtime.Icon, {
                name: "X",
                size: "sm",
              }),
            }),
          ],
        }),
      }),
    });
  }
  function PinnedToastView({
    pinned: pinned,
    onDismiss: onDismiss,
  }: PinnedToastViewProps): ReactElement {
    let value = pinned.variant ?? "neutral",
      value2 = (0, runtime.useTranslation)("dismiss", "Dismiss");
    return jsxt5.jsx("div", {
      "data-pinned": "",
      className: `pointer-events-auto relative w-full ${toastSurfaceClasses} ${toastVariantClasses[value]} ${toastVariantTextClasses[value]}`,
      children: jsxt5.jsxs("div", {
        className: toastContentClasses,
        children: [
          jsxt5.jsx("span", {
            className: `shrink-0 ${toastSecondaryTextClasses[value]}`,
            children: jsxt5.jsx(runtime.Icon, {
              name: toastDefaultIconNames[value],
              size: "md",
            }),
          }),
          jsxt5.jsxs("div", {
            className: toastBodyClasses,
            children: [
              jsxt5.jsx("div", {
                className: "font-medium",
                children: pinned.title,
              }),
              pinned.description &&
                jsxt5.jsx("div", {
                  children: pinned.description,
                }),
              pinned.action &&
                jsxt5.jsx("div", {
                  className: "mt-pad-md empty:hidden",
                  children: pinned.action,
                }),
            ],
          }),
          pinned.dismissible &&
            jsxt5.jsx("button", {
              type: "button",
              "aria-label": pinned.dismissLabel ?? value2,
              onClick: onDismiss,
              className: toastDismissButtonClasses,
              children: jsxt5.jsx(runtime.Icon, {
                name: "X",
                size: "sm",
              }),
            }),
        ],
      }),
    });
  }
  function containsVisibleFocus(input?: HTMLElement | null): boolean {
    let value = input?.ownerDocument.activeElement;
    if (!input || !value || !input.contains(value)) {
      return false;
    }
    try {
      return value.matches(":focus-visible");
    } catch {
      return true;
    }
  }
  function PinnedToastSlot({ ctx: ctx }: PinnedToastSlotProps): ReactElement {
    let {
        pinned: value,
        setPinned: value2,
        slotRef: value3,
        focusWasInsideRef: value4,
      } = ctx,
      ref = reactg6.useRef<HTMLElement | null>(null);
    reactg6.useEffect(() => {
      let current = value3.current;
      if (!current) {
        return;
      }
      let ownerDocument = current.ownerDocument,
        callback = (event: FocusEvent): void => {
          let target = event.target as HTMLElement | null;
          if (
            target &&
            typeof target.focus === "function" &&
            !current.contains(target)
          ) {
            ref.current = target;
          }
        };
      ownerDocument.addEventListener("focusin", callback);
      return () =>
        ownerDocument.removeEventListener("focusin", callback);
    }, [value3]);
    reactg6.useLayoutEffect(() => {
      let current = value3.current;
      if (!current || !value4.current) {
        return;
      }
      value4.current = false;
      if (current.contains(current.ownerDocument.activeElement)) {
        return;
      }
      let current2 = ref.current;
      if (current2?.isConnected) {
        current2.focus({
          preventScroll: true,
        });
      }
    }, [value, value3, value4]);
    return jsxt5.jsx("div", {
      ref: (input: HTMLDivElement | null): void => {
        value3.current = input;
      },
      role: "status",
      className: value ? "w-full" : "sr-only",
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>): void => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          !event.nativeEvent.isComposing &&
          value?.dismissible &&
          event.currentTarget.contains(
            event.currentTarget.ownerDocument.activeElement,
          )
        ) {
          value2(null);
        }
      },
      children:
        value &&
        jsxt5.jsx(PinnedToastView, {
          pinned: value,
          onDismiss: () => value2(null),
        }),
    });
  }
  function ToastViewport({ className: className }: ToastViewportProps): ReactElement {
    let { toasts: value } = runtime.baseToast.useToastManager<ToastData>(),
      value2 = reactg6.useContext(pinnedToastContext);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      value2?.syncLiveToasts(value);
    }, [value, value2]);
    let value3 = value.find(
      (input) => input.transitionStatus !== "ending",
    );
    return jsxt5.jsx(runtime.baseToast.Portal, {
      children: jsxt5.jsx(runtime.PortalRoot, {
        surface: runtime.elevationSurfaceNames.popover,
        children: jsxt5.jsxs(runtime.CdsLayer, {
          base: runtime.TOAST_LAYER_BASE,
          render: jsxt5.jsx("div", {
            "data-cds": "Toast",
            className: (0, runtime.cn)(
              "cds-reset pointer-events-none fixed right-4 bottom-4 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col-reverse gap-md",
              className,
            ),
          }),
          children: [
            value2 &&
              jsxt5.jsx(PinnedToastSlot, {
                ctx: value2,
              }),
            jsxt5.jsx(runtime.baseToast.Viewport, {
              className:
                "pointer-events-auto relative outline-none focus-visible:outline-hidden",
              style: {
                height: value3?.height,
              },
              children: value.map(
                (input, options) =>
                  jsxt5.jsx(
                    ToastView,
                    {
                      toast: input,
                      front: input === value3,
                      frontHeight: value3?.height,
                      zIndex: value.length - options,
                    },
                    input.id,
                  ),
              ),
            }),
          ],
        }),
      }),
    });
  }
  function createToastMovementState(): ToastMovementState {
    let nextId = 0;
    return {
      allocId: () => `cds-toast-${++nextId}`,
      movingIds: new Set(),
      userDismissAt: new Map(),
    };
  }
  function ToastProvider({
    children: children,
    timeout = DEFAULT_TOAST_TIMEOUT_MS,
    limit: limit,
    viewportClassName: viewportClassName,
  }: ToastProviderProps): ReactElement {
    let [value, value2] = reactg6.useState<PinnedToastData | null>(null),
      ref = reactg6.useRef(value),
      ref2 = reactg6.useRef<HTMLDivElement | null>(null),
      ref3 = reactg6.useRef(false),
      callback = reactg6.useCallback((input: PinnedToastData | null): void => {
        let current = ref.current;
        ref.current = input;
        if (current !== input && !ref3.current) {
          ref3.current = containsVisibleFocus(ref2.current);
        }
        value2(input);
        if (current && current !== input) {
          current.onClose?.();
        }
      }, []),
      ref4 = reactg6.useRef<LiveToast[]>([]),
      callback2 = reactg6.useCallback((input: LiveToast[]): void => {
        ref4.current = input;
      }, []),
      [value3] = reactg6.useState(createToastMovementState),
      memo = reactg6.useMemo(
        () => normalizeToastTimeout(timeout),
        [timeout],
      ),
      memo2 = reactg6.useMemo<PinnedToastContextValue>(
        () => ({
          pinned: value,
          setPinned: callback,
          slotRef: ref2,
          focusWasInsideRef: ref3,
          liveToasts: ref4,
          syncLiveToasts: callback2,
          defaultTimeout: memo,
          ...value3,
        }),
        [value, callback, callback2, memo, value3],
      );
    return jsxt5.jsx(runtime.baseToast.Provider, {
      timeout: memo,
      limit: limit,
      children: jsxt5.jsxs(pinnedToastContext.Provider, {
        value: memo2,
        children: [
          children,
          jsxt5.jsx(ToastViewport, {
            className: viewportClassName,
          }),
        ],
      }),
    });
  }
  function useToastNotifications(): ToastNotifications {
    let value = runtime.baseToast.useToastManager<ToastData>(),
      value2 = reactg6.useContext(pinnedToastContext);
    return {
      add: reactg6.useCallback(
        ({
          title: title,
          description: description,
          variant: variant,
          icon: icon,
          action: action,
          timeout: timeout,
          onClose: onClose,
          dedupe = false,
          dedupeKey: dedupeKey,
        }: ToastAddOptions): string => {
          let value3 = variant ?? "neutral",
            value4 = typeof title === "string",
            value5 = dedupeKey ?? (value4 ? (title as string) : undefined),
            state: ToastData = {
              titleNode: value4 ? undefined : title,
              baseTitle: value4 ? (title as string) : undefined,
            },
            value6 = Date.now(),
            callback = (input?: number): number | undefined => {
              let value11 = input ?? value2?.defaultTimeout;
              if (value11 !== undefined && value11 > 0) {
                return value6 + value11;
              } else {
                return undefined;
              }
            };
          if (dedupe && value5 !== undefined) {
            let value11 = value2?.liveToasts.current ?? value.toasts,
              value12 = value11.find(
                (input: LiveToast): boolean =>
                  input.data?.dedupeKey === value5 &&
                  input.transitionStatus !== "ending",
              );
            if (value12) {
              let value13 = (value12.data?.count ?? 1) + 1,
                value14 = action ?? value12.data?.action,
                value15 =
                  Boolean(value12.data?.action) ||
                  (value12.timeout ?? value2?.defaultTimeout) === 0,
                value16 =
                  timeout === undefined
                    ? undefined
                    : normalizeToastTimeout(timeout),
                value17 = value14 ? 0 : value15 ? undefined : value16,
                state4: ToastData = {
                  ...value12.data,
                  ...state,
                  variant: variant ?? value12.data?.variant,
                  ...(icon !== undefined && {
                    icon: icon,
                  }),
                  action: value14,
                  count: value13,
                  ...(value17 !== undefined && {
                    expiresAt: callback(value17),
                  }),
                },
                value18 = value4 ? title : value12.title,
                value19 =
                  value13 === 2 && typeof value18 === "string"
                    ? `${value18} (×2)`
                    : value4 && title !== value12.data?.baseTitle
                      ? title
                      : undefined,
                value20 = value11.find(
                  (input: LiveToast): boolean =>
                    input.transitionStatus !== "ending",
                ),
                value21 =
                  typeof document !== "undefined" &&
                  Boolean(
                    document.activeElement?.closest(
                      '[data-cds="Toast"]',
                    ),
                  );
              if (
                !value2 ||
                value21 ||
                (value20?.id === value12.id && !value12.limited)
              ) {
                value.update(value12.id, {
                  ...(value19 !== undefined && {
                    title: value19,
                  }),
                  description: description,
                  ...(value17 !== undefined && {
                    timeout: value17,
                  }),
                  data: state4,
                });
                value2?.syncLiveToasts(
                  value11.map(
                    (input: LiveToast): LiveToast =>
                      input.id === value12.id
                        ? {
                            ...input,
                            data: state4,
                            timeout: value17 ?? input.timeout,
                          }
                        : input,
                  ),
                );
                return value12.id;
              }
              let value22 =
                  state4.expiresAt === undefined
                    ? 0
                    : Math.max(state4.expiresAt - value6, 1),
                value23 =
                  value17 ?? (value15 ? 0 : Math.max(value22, 6000)),
                state5: LiveToast = {
                  ...value12,
                  title: value19 ?? value12.title,
                  description: description,
                  timeout: value23,
                  limited: false,
                  data: {
                    ...state4,
                    expiresAt: callback(value23),
                  },
                };
              value2.movingIds.add(value12.id);
              value.close(value12.id);
              value2.movingIds.delete(value12.id);
              value.add({
                id: state5.id,
                title: state5.title,
                description: description,
                type: state5.type,
                priority: state5.priority,
                timeout: value23,
                onClose: state5.onClose,
                data: state5.data,
              });
              value2.syncLiveToasts([
                state5,
                ...value2.liveToasts.current.filter(
                  (input: LiveToast): boolean => input.id !== value12.id,
                ),
              ]);
              return value12.id;
            }
          }
          let value7 = Boolean(action),
            value8 = value2?.allocId(),
            value9 = value7 ? 0 : normalizeToastTimeout(timeout),
            state2: ToastData = {
              variant: value3,
              icon: icon,
              action: action,
              ...state,
              dedupeKey: value5,
              count: 1,
              expiresAt: callback(value9),
            },
            state3: ToastManagerAddOptions<ToastData> = {
              id: value8,
              title: value4 ? title : undefined,
              description: description,
              type: value3,
              timeout: value9,
              onClose: (): void => {
                if (value8 === undefined || !value2) {
                  onClose?.({
                    byUser: false,
                  });
                  return;
                }
                if (value2.movingIds.has(value8)) {
                  return;
                }
                value2.syncLiveToasts(
                  value2.liveToasts.current.map(
                    (input: LiveToast): LiveToast =>
                      input.id === value8
                        ? {
                            ...input,
                            transitionStatus: "ending",
                          }
                        : input,
                  ),
                );
                let entry = value2.userDismissAt.get(value8);
                value2.userDismissAt.delete(value8);
                onClose?.({
                  byUser:
                    entry !== undefined &&
                    Date.now() - entry < TOAST_TRANSITION_TIMEOUT_MS,
                });
              },
              priority: value3 === "danger" ? "high" : "low",
              data: state2,
            },
            value10 = value.add(state3);
          value2?.syncLiveToasts([
            {
              ...state3,
              id: value10,
            },
            ...value2.liveToasts.current,
          ]);
          return value10;
        },
        [value, value2],
      ),
      close: value.close,
      setPinned: value2?.setPinned ?? noopToastPinSetter,
    };
  }
  bindRuntimeValue(
    runtime,
    "normalizeToastTimeout",
    () => normalizeToastTimeout,
  );
  bindRuntimeValue(runtime, "ToastView", () => ToastView);
  bindRuntimeValue(runtime, "PinnedToastView", () => PinnedToastView);
  bindRuntimeValue(runtime, "containsVisibleFocus", () => containsVisibleFocus);
  bindRuntimeValue(runtime, "PinnedToastSlot", () => PinnedToastSlot);
  bindRuntimeValue(runtime, "ToastViewport", () => ToastViewport);
  bindRuntimeValue(
    runtime,
    "createToastMovementState",
    () => createToastMovementState,
  );
  bindRuntimeValue(runtime, "ToastProvider", () => ToastProvider);
  bindRuntimeValue(
    runtime,
    "useToastNotifications",
    () => useToastNotifications,
  );
  bindRuntimeValue(
    runtime,
    "reactg6",
    () => reactg6,
    (value) => {
      reactg6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxt5",
    () => jsxt5,
    (value) => {
      jsxt5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_TOAST_TIMEOUT_MS",
    () => DEFAULT_TOAST_TIMEOUT_MS,
    (value) => {
      DEFAULT_TOAST_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TOAST_TRANSITION_TIMEOUT_MS",
    () => TOAST_TRANSITION_TIMEOUT_MS,
    (value) => {
      TOAST_TRANSITION_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastSurfaceClasses",
    () => toastSurfaceClasses,
    (value) => {
      toastSurfaceClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastVariantClasses",
    () => toastVariantClasses,
    (value) => {
      toastVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastVariantTextClasses",
    () => toastVariantTextClasses,
    (value) => {
      toastVariantTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastDefaultIconNames",
    () => toastDefaultIconNames,
    (value) => {
      toastDefaultIconNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastSecondaryTextClasses",
    () => toastSecondaryTextClasses,
    (value) => {
      toastSecondaryTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastStackTransformClasses",
    () => toastStackTransformClasses,
    (value) => {
      toastStackTransformClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastContentClasses",
    () => toastContentClasses,
    (value) => {
      toastContentClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastBodyClasses",
    () => toastBodyClasses,
    (value) => {
      toastBodyClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toastDismissButtonClasses",
    () => toastDismissButtonClasses,
    (value) => {
      toastDismissButtonClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyToastList",
    () => emptyToastList,
    (value) => {
      emptyToastList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pinnedToastContext",
    () => pinnedToastContext,
    (value) => {
      pinnedToastContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noopToastPinSetter",
    () => noopToastPinSetter,
    (value) => {
      noopToastPinSetter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiToast",
    () => initializeUiToast,
    (value) => {
      initializeUiToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiToast",
    () => reactForUiToast,
    (value) => {
      reactForUiToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiToast",
    () => jsxForUiToast,
    (value) => {
      jsxForUiToast = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIELD_LABEL_LAYOUT_CLASSES",
    () => FIELD_LABEL_LAYOUT_CLASSES,
    (value) => {
      FIELD_LABEL_LAYOUT_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldRoot",
    () => FieldRoot,
    (value) => {
      FieldRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldLabel",
    () => FieldLabel,
    (value) => {
      FieldLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldDescription",
    () => FieldDescription,
    (value) => {
      FieldDescription = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldError",
    () => FieldError,
    (value) => {
      FieldError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldWrapper",
    () => FieldWrapper,
    (value) => {
      FieldWrapper = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldRootWithLabel",
    () => FieldRootWithLabel,
    (value) => {
      FieldRootWithLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldRow",
    () => FieldRow,
    (value) => {
      FieldRow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiToast2",
    () => initializeUiToast2,
    (value) => {
      initializeUiToast2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiToast2",
    () => reactForUiToast2,
    (value) => {
      reactForUiToast2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiToast2",
    () => jsxForUiToast2,
    (value) => {
      jsxForUiToast2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldTextInput",
    () => FieldTextInput,
    (value) => {
      FieldTextInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiToast3",
    () => initializeUiToast3,
    (value) => {
      initializeUiToast3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiToast3",
    () => reactForUiToast3,
    (value) => {
      reactForUiToast3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiToast3",
    () => jsxForUiToast3,
    (value) => {
      jsxForUiToast3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldTextArea",
    () => FieldTextArea,
    (value) => {
      FieldTextArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiToast4",
    () => initializeUiToast4,
    (value) => {
      initializeUiToast4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiToast4",
    () => reactForUiToast4,
    (value) => {
      reactForUiToast4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiToast4",
    () => jsxForUiToast4,
    (value) => {
      jsxForUiToast4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldNumberInput",
    () => FieldNumberInput,
    (value) => {
      FieldNumberInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiToast5",
    () => initializeUiToast5,
    (value) => {
      initializeUiToast5 = value;
    },
  );
  return () => {
    DEFAULT_TOAST_TIMEOUT_MS = 6000;
    TOAST_TRANSITION_TIMEOUT_MS = 1000;
    toastStackTransformClasses =
      "absolute w-full bottom-0 right-0 origin-bottom [--ty:calc(var(--toast-index)_*_-14px)] [--ts:calc(1_-_var(--toast-index)_*_0.04)] [transform:translateY(var(--ty))_scale(var(--ts))] transition-[transform,opacity] duration-base ease-out motion-reduce:transition-none data-[starting-style]:opacity-0 data-[starting-style]:[--ty:100%] data-[ending-style]:opacity-0 data-[ending-style]:[--ts:0.85] data-[limited]:opacity-0";
    toastContentClasses =
      "flex items-start gap-sm px-lg py-md overflow-hidden rounded-[inherit] text-body font-normal transition-[opacity,visibility] duration-base ease-out motion-reduce:transition-none data-[behind]:invisible data-[behind]:opacity-0";
    toastBodyClasses = "min-w-0 flex-1 text-pretty break-words";
    toastDismissButtonClasses =
      "cds-reset -mx-1 -mb-1 -mt-0.5 shrink-0 rounded p-1 outline-none focus-visible:outline-hidden transition duration-fast hover:bg-fill-ghost-hover focus-visible:shadow-focus";
    noopToastPinSetter = (): void => {
      return;
    };
    initializeUiToast = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeLayers)();
      (0, runtime.initializePortalRoot)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeSurfaces)();
      (0, runtime.initializeNpmDependency)();
      reactg6 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxt5 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      toastSurfaceClasses = (0, runtime.getSurfaceClasses)("popover");
      toastVariantClasses = {
        neutral: "shadow-panel-md",
        warning:
          "shadow-ring-warning [background-image:linear-gradient(0deg,var(--cds-bg-warning),var(--cds-bg-warning))]",
        danger:
          "shadow-ring-danger [background-image:linear-gradient(0deg,var(--cds-bg-danger),var(--cds-bg-danger))]",
      };
      toastVariantTextClasses = {
        neutral: "text-primary",
        warning: "text-warning",
        danger: "text-danger",
      };
      toastDefaultIconNames = {
        neutral: "Info",
        warning: "Warning",
        danger: "WarningCircle",
      };
      toastSecondaryTextClasses = {
        neutral: "text-secondary",
        warning: "",
        danger: "",
      };
      emptyToastList = [];
      pinnedToastContext = reactg6.createContext<PinnedToastContextValue | null>(
        null,
      );
    });
    FieldWrapper = ({
      label: label,
      hint: hint,
      error: error,
      fieldClassName: fieldClassName,
      children: children,
    }: FieldWrapperProps): ReactElement =>
      jsxForUiToast.jsxs(FieldRoot, {
        invalid: Boolean(error) || undefined,
        className: fieldClassName,
        children: [
          label !== undefined &&
            label !== null &&
            jsxForUiToast.jsx(FieldLabel, {
              children: label,
            }),
          children,
          hint !== undefined &&
            hint !== null &&
            jsxForUiToast.jsx(FieldDescription, {
              children: hint,
            }),
          Boolean(error) &&
            jsxForUiToast.jsx(FieldError, {
              match: true,
              children: error,
            }),
        ],
      });
    initializeUiToast2 = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeUiMenu)();
      (0, runtime.initializeNpmDependency)();
      reactForUiToast = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiToast = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      FIELD_LABEL_LAYOUT_CLASSES = {
        false: {
          false: {
            invalid: false,
            disabled: false,
          },
          true: {
            invalid: true,
            disabled: false,
          },
        },
        true: {
          false: {
            invalid: false,
            disabled: true,
          },
          true: {
            invalid: true,
            disabled: true,
          },
        },
      };
      FieldRoot = reactForUiToast.forwardRef<HTMLDivElement, FieldRootProps>(
        (
          {
            className: className,
            validationMode = "onBlur",
            ...props
          },
          options: ForwardedRef<HTMLDivElement>,
        ): ReactElement =>
          jsxForUiToast.jsx(runtime.baseField.Root, {
            ref: options,
            "data-cds": "Field",
            validationMode: validationMode,
            ...props,
            className: (0, runtime.cn)(
              "flex flex-col gap-xs font-sans",
              className,
            ),
            render: (
              input: HTMLProps<HTMLDivElement>,
              options2: BaseField.Root.State,
            ): ReactElement =>
              jsxForUiToast.jsx(runtime.textFieldStateContext.Provider, {
                value:
                  FIELD_LABEL_LAYOUT_CLASSES[`${options2.disabled}` as const][
                    `${options2.valid === false}` as const
                  ],
                children: jsxForUiToast.jsx("div", {
                  ...input,
                }),
              }),
          }),
      );
      FieldRoot.displayName = "Field.Root";
      FieldLabel = reactForUiToast.forwardRef<HTMLElement, FieldLabelProps>(
        (
          { className: className, id: id, ...props },
          options: ForwardedRef<HTMLElement>,
        ): ReactElement => {
          let value = (0, runtime.useFieldLabelId)();
          return jsxForUiToast.jsx(runtime.baseField.Label, {
            ref: options,
            id: id ?? value,
            ...props,
            className: (0, runtime.cn)(
              "text-body font-medium leading-none text-primary",
              className,
            ),
          });
        },
      );
      FieldLabel.displayName = "Field.Label";
      FieldDescription = reactForUiToast.forwardRef<
        HTMLParagraphElement,
        FieldDescriptionProps
      >(
        (
          { className: className, ...props },
          options: ForwardedRef<HTMLParagraphElement>,
        ): ReactElement =>
          jsxForUiToast.jsx(runtime.baseField.Description, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(
              "text-footnote font-normal leading-snug text-muted",
              className,
            ),
          }),
      );
      FieldDescription.displayName = "Field.Description";
      FieldError = reactForUiToast.forwardRef<HTMLDivElement, FieldErrorProps>(
        (
          { className: className, children: children, ...props },
          options: ForwardedRef<HTMLDivElement>,
        ): ReactElement =>
          jsxForUiToast.jsx(runtime.baseField.Error, {
            ref: options,
            ...props,
            className: (0, runtime.cn)(
              "flex items-start gap-1 text-footnote font-normal leading-snug text-danger",
              className,
            ),
            render: (input: HTMLProps<HTMLDivElement>): ReactElement =>
              jsxForUiToast.jsxs("div", {
                ...input,
                children: [
                  jsxForUiToast.jsx(runtime.Icon, {
                    name: "WarningCircle",
                    size: "sm",
                    className: "mt-px shrink-0",
                  }),
                  jsxForUiToast.jsx("span", {
                    children: children ?? input.children,
                  }),
                ],
              }),
          }),
      );
      FieldError.displayName = "Field.Error";
      FieldRootWithLabel = runtime.baseField.Control;
      FieldRow = runtime.baseField.Validity;
    });
    initializeUiToast3 = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeUiMenu2)();
      initializeUiToast2();
      reactForUiToast2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiToast2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      FieldTextInput = reactForUiToast2.forwardRef<
        HTMLInputElement,
        FieldTextInputProps
      >(
        (
          {
            label: label,
            hint: hint,
            error: error,
            required: required,
            fieldClassName: fieldClassName,
            ...props
          },
          options: ForwardedRef<HTMLInputElement>,
        ): ReactElement =>
          jsxForUiToast2.jsx(FieldWrapper, {
            label: label,
            hint: hint,
            error: error,
            fieldClassName: fieldClassName,
            children: jsxForUiToast2.jsx(runtime.TextInput, {
              ref: options,
              required: required,
              ...props,
            }),
          }),
      );
      FieldTextInput.displayName = "Field.TextInput";
    });
    initializeUiToast4 = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeUiInputs2)();
      initializeUiToast2();
      reactForUiToast3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiToast3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      FieldTextArea = reactForUiToast3.forwardRef<
        HTMLTextAreaElement,
        FieldTextAreaProps
      >(
        (
          {
            label: label,
            hint: hint,
            error: error,
            required: required,
            fieldClassName: fieldClassName,
            ...props
          },
          options: ForwardedRef<HTMLTextAreaElement>,
        ): ReactElement =>
          jsxForUiToast3.jsx(FieldWrapper, {
            label: label,
            hint: hint,
            error: error,
            fieldClassName: fieldClassName,
            children: jsxForUiToast3.jsx(runtime.TextArea, {
              ref: options,
              required: required,
              ...props,
            }),
          }),
      );
      FieldTextArea.displayName = "Field.TextArea";
    });
    initializeUiToast5 = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeUiTable7)();
      initializeUiToast2();
      reactForUiToast4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiToast4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      FieldNumberInput = reactForUiToast4.forwardRef<
        HTMLInputElement,
        FieldNumberInputProps
      >(
        (
          {
            label: label,
            hint: hint,
            error: error,
            required: required,
            fieldClassName: fieldClassName,
            ...props
          },
          options: ForwardedRef<HTMLInputElement>,
        ): ReactElement =>
          jsxForUiToast4.jsx(FieldWrapper, {
            label: label,
            hint: hint,
            error: error,
            fieldClassName: fieldClassName,
            children: jsxForUiToast4.jsx(runtime.NumberInput, {
              ref: options,
              required: required,
              ...props,
            }),
          }),
      );
      FieldNumberInput.displayName = "Field.NumberInput";
    });
  };
}

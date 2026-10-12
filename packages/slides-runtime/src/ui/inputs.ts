/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { UseRenderRenderProp } from "@base-ui/react/use-render";
import type {
  AnchorHTMLAttributes,
  AriaRole,
  Dispatch,
  ForwardedRef,
  ForwardRefExoticComponent,
  HTMLAttributes,
  MouseEventHandler,
  ReactElement,
  ReactNode,
  RefAttributes,
  RefObject,
  SetStateAction,
  TextareaHTMLAttributes,
} from "react";
import type { VisualKeyboardMetrics } from "./foundation";
import type {
  CdsControlSize,
  CdsDensity,
  CdsLinkOptions,
  LinkEventHandlers,
  LinkEventPropName,
} from "./overlays";

/** Options of `useTextAreaAutosize`. */
export interface TextAreaAutosizeOptions {
  autosize?: boolean;
  value?: TextareaHTMLAttributes<HTMLTextAreaElement>["value"];
  defaultValue?: TextareaHTMLAttributes<HTMLTextAreaElement>["defaultValue"];
}
export interface TextAreaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "rows"
  > {
  className?: string;
  rows?: number;
  /** "y" lets the user resize vertically; the default is not resizable. */
  resize?: "none" | "y";
  /** Grows with its content. */
  autosize?: boolean;
  /** Drops the field chrome. */
  bare?: boolean;
  size?: CdsControlSize;
  fullWidth?: boolean;
}
export type CounterVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";
export interface CounterProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children"> {
  value: number;
  /** Largest number shown; above it the badge reads "max+". */
  max?: number;
  showZero?: boolean;
  /** Renders a plain dot instead of the number. */
  dot?: boolean;
  variant?: CounterVariant;
  size?: CdsControlSize;
  className?: string;
}
/** A component type that may be a pictogram or wrap one (memo or forwardRef). */
export interface PictogramComponentLike {
  isCdsPictogram?: boolean;
  $$typeof?: symbol;
  type?: PictogramComponentLike | null;
  render?: PictogramComponentLike | null;
}
/** How a card-style (composer) callout aligns its keyline: with the glyph or the text. */
export type CalloutCalibration = "glyph" | "text";
export type CalloutVariant = "neutral" | "warning" | "danger";
export interface CalloutProps {
  variant?: CalloutVariant;
  /** An icon name or node; `null` hides the icon. */
  icon?: ReactNode;
  action?: ReactNode;
  actionAlign?: "first-line" | "center";
  /** Expandable content below the message. */
  details?: ReactNode;
  defaultDetailsOpen?: boolean;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  onDismiss?: MouseEventHandler<HTMLElement>;
  dismissLabel?: string;
  role?: AriaRole;
  composerCalibration?: boolean | CalloutCalibration;
  className?: string;
  "data-testid"?: string;
  children?: ReactNode;
}
/** Props of a link that are forwarded to the rendered element untouched. */
export interface InteractiveLinkRest extends LinkEventHandlers {
  [name: string]: unknown;
}
export interface InteractiveLinkElementProps {
  /** Attributes stamped on the element, such as `data-cds`. */
  stamp: Record<string, string>;
  forwardedRef: ForwardedRef<HTMLElement>;
  linkInput: CdsLinkOptions;
  render?: UseRenderRenderProp;
  body: ReactNode;
  className: string;
  actionClassName: string;
  actionDisabled?: boolean;
  rest: InteractiveLinkRest;
}
export interface TextLinkProps
  extends Omit<
      AnchorHTMLAttributes<HTMLElement>,
      | "className"
      | "children"
      | "href"
      | "target"
      | "rel"
      | "download"
      | LinkEventPropName
    >,
    LinkEventHandlers {
  href?: string;
  routerOptions?: unknown;
  target?: string;
  rel?: string;
  download?: boolean | string;
  /** Renders as a button-like element rather than a link. */
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  /** An icon name or node shown beside the text. */
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  /** Opens in a new tab; "with-icon" also adds the arrow icon. */
  external?: boolean | "with-icon";
  /** Takes the colour of the surrounding text. */
  inheritColor?: boolean;
  render?: UseRenderRenderProp;
}
export type TextAreaComponent = ForwardRefExoticComponent<
  TextAreaProps & RefAttributes<HTMLTextAreaElement>
>;
export type CounterComponent = ForwardRefExoticComponent<
  CounterProps & RefAttributes<HTMLSpanElement>
>;
export type TextLinkComponent = ForwardRefExoticComponent<
  TextLinkProps & RefAttributes<HTMLElement>
>;
/** An inline style property value and its priority. */
export interface InlineStyleValue {
  value: string;
  priority: string;
}
/** Inline style properties a keyboard-aware dialog overrides. */
export type DialogOverrideProperty = "top" | "max-height" | "min-height";
/** Inline styles a dialog took over while the soft keyboard is open. */
export interface DialogStyleOverride {
  node: HTMLElement;
  /** What to restore. */
  baseline: Record<DialogOverrideProperty, InlineStyleValue>;
  /** Values we intended to write. */
  intended: Partial<Record<DialogOverrideProperty, string>>;
  /** Values as read back after writing. */
  written: Partial<Record<DialogOverrideProperty, string>>;
  /** Last max-height applied. */
  cap: string;
}
/** Position and size a dialog takes to stay above the soft keyboard. */
export interface KeyboardAdjustedDialogStyle {
  top: string;
  maxHeight: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    resizeTextAreaToContent: (
      textarea: HTMLTextAreaElement,
      appliedHeight: RefObject<string>,
    ) => void;
    observeTextAreaValue: (
      textarea: HTMLTextAreaElement,
      onChange: () => void,
    ) => (() => void) | undefined;
    useTextAreaAutosize: (
      options: TextAreaAutosizeOptions,
    ) => RefObject<HTMLTextAreaElement | null>;
    supportsNativeFieldSizing: boolean;
    initializeUiInputs: () => void;
    TextArea: TextAreaComponent;
    initializeUiInputs2: () => void;
    COUNTER_VARIANT_CLASSES: Record<CounterVariant, string>;
    COUNTER_SIZE_CLASSES: Record<CounterVariant, string>;
    Counter: CounterComponent;
    initializeUiInputs3: () => void;
    isPictogramElement: (node: ReactNode) => boolean;
    isPictogramComponent: (component: unknown) => boolean;
    REACT_MEMO_SYMBOL: symbol;
    REACT_FORWARD_REF_SYMBOL: symbol;
    initializeUiInputs4: () => void;
    pictogramCardRadiusClass: string;
    initializeSplitButtonNoop: () => void;
    leadingIconInsetClasses: Record<CalloutCalibration, string>;
    leadingIconOutsetClasses: Record<CalloutCalibration, string>;
    SPLIT_BUTTON_LABEL_CLASS: string;
    trailingIconOutsetClasses: Record<CalloutCalibration, string>;
    SPLIT_BUTTON_ICON_CLASS: string;
    leadingIconSpacingClasses: Record<CalloutCalibration, string>;
    SPLIT_BUTTON_STYLE_DEFAULTS: string;
    initializeUiInputs5: () => void;
    Callout: (props: CalloutProps) => ReactElement;
    calloutSizeByDensity: Record<CdsDensity, CdsControlSize>;
    CALLOUT_PICTOGRAM_SIZE: number;
    calloutVariantClasses: Record<CalloutVariant, string>;
    calloutTextClasses: Record<CalloutVariant, string>;
    calloutDefaultIcons: Record<CalloutVariant, string>;
    initializeUiInputs6: () => void;
    omitProps: (
      props: object,
      omitted: readonly string[],
    ) => Record<string, unknown>;
    InteractiveLinkElement: (props: InteractiveLinkElementProps) => ReactNode;
    interactiveLinkReservedProps: string[];
    initializeUiInputs7: () => void;
    NewTabAnnouncement: (props: { id: string }) => ReactElement;
    TextLinkIcon: (icon: ReactNode) => ReactElement;
    initializeUiInputs8: () => void;
    TEXT_LINK_CLASS: string;
    TEXT_LINK_UNDERLINE_CLASS: string;
    textLinkVariants: string;
    TEXT_LINK_COLOR_CLASS: string;
    TEXT_LINK_FOCUS_CLASS: string;
    TEXT_LINK_DISABLED_CLASS: string;
    TEXT_LINK_EXTERNAL_ICON_CLASS: string;
    TextLink: TextLinkComponent;
    initializeUiInputs9: () => void;
    readInlineStyleProperty: (
      style: CSSStyleDeclaration,
      property: string,
    ) => InlineStyleValue;
    isOwnedImportantStyle: (
      style: CSSStyleDeclaration,
      property: string,
      writtenValue: string | undefined,
    ) => boolean;
    restoreDialogStyleOverride: (override: DialogStyleOverride) => void;
    useDialogVisualKeyboard: (
      enabled: boolean | undefined,
    ) => Dispatch<SetStateAction<HTMLElement | null>>;
    getKeyboardAdjustedDialogStyle: (
      keyboard: VisualKeyboardMetrics | null,
    ) => KeyboardAdjustedDialogStyle | undefined;
    scrollDialogInputIntoView: (
      dialog: HTMLElement,
      input: HTMLElement,
    ) => void;
    DIALOG_KEYBOARD_MARGIN_PX: number;
    DIALOG_KEYBOARD_MARGIN_CSS: string;
    MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT: number;
    dialogOverrideStyleProperties: DialogOverrideProperty[];
    dialogKeyboardExcludedStyleProperties: string[];
    dialogKeyboardPositionProperties: string[];
    initializeUiInputs10: () => void;
    reactHu: ReactNamespace;
    reactForUiInputs: ReactNamespace;
    jsxForUiInputs: JsxNamespace;
    reactForUiInputs2: ReactNamespace;
    jsxForUiInputs2: JsxNamespace;
    reactfK0: ReactNamespace;
    reactZQ: ReactNamespace;
    jsxd8: JsxNamespace;
    reactpK0: ReactNamespace;
    jsxGP: JsxNamespace;
    jsxdK0: JsxNamespace;
    reactForUiInputs3: ReactNamespace;
    jsxp4: JsxNamespace;
    reactc4: ReactNamespace;
  }
}

export function installUiInputs(runtime: RuntimeBindings): () => void {
  var reactHu: ReactNamespace;
  var supportsNativeFieldSizing: boolean;
  var initializeUiInputs: () => void;
  var reactForUiInputs: ReactNamespace;
  var jsxForUiInputs: JsxNamespace;
  var TextArea: TextAreaComponent;
  var initializeUiInputs2: () => void;
  var reactForUiInputs2: ReactNamespace;
  var jsxForUiInputs2: JsxNamespace;
  var COUNTER_VARIANT_CLASSES: Record<CounterVariant, string>;
  var COUNTER_SIZE_CLASSES: Record<CounterVariant, string>;
  var Counter: CounterComponent;
  var initializeUiInputs3: () => void;
  var reactfK0: ReactNamespace;
  var REACT_MEMO_SYMBOL: symbol;
  var REACT_FORWARD_REF_SYMBOL: symbol;
  var initializeUiInputs4: () => void;
  var pictogramCardRadiusClass: string;
  var initializeSplitButtonNoop: () => void;
  var leadingIconInsetClasses: Record<CalloutCalibration, string>;
  var leadingIconOutsetClasses: Record<CalloutCalibration, string>;
  var SPLIT_BUTTON_LABEL_CLASS: string;
  var trailingIconOutsetClasses: Record<CalloutCalibration, string>;
  var SPLIT_BUTTON_ICON_CLASS: string;
  var leadingIconSpacingClasses: Record<CalloutCalibration, string>;
  var SPLIT_BUTTON_STYLE_DEFAULTS: string;
  var initializeUiInputs5: () => void;
  var reactZQ: ReactNamespace;
  var jsxd8: JsxNamespace;
  var calloutSizeByDensity: Record<CdsDensity, CdsControlSize>;
  var CALLOUT_PICTOGRAM_SIZE: number;
  var calloutVariantClasses: Record<CalloutVariant, string>;
  var calloutTextClasses: Record<CalloutVariant, string>;
  var calloutDefaultIcons: Record<CalloutVariant, string>;
  var initializeUiInputs6: () => void;
  var reactpK0: ReactNamespace;
  var jsxGP: JsxNamespace;
  var interactiveLinkReservedProps: string[];
  var initializeUiInputs7: () => void;
  var jsxdK0: JsxNamespace;
  var initializeUiInputs8: () => void;
  var reactForUiInputs3: ReactNamespace;
  var jsxp4: JsxNamespace;
  var TEXT_LINK_CLASS: string;
  var TEXT_LINK_UNDERLINE_CLASS: string;
  var textLinkVariants: string;
  var TEXT_LINK_COLOR_CLASS: string;
  var TEXT_LINK_FOCUS_CLASS: string;
  var TEXT_LINK_DISABLED_CLASS: string;
  var TEXT_LINK_EXTERNAL_ICON_CLASS: string;
  var TextLink: TextLinkComponent;
  var initializeUiInputs9: () => void;
  var reactc4: ReactNamespace;
  var DIALOG_KEYBOARD_MARGIN_PX: number;
  var DIALOG_KEYBOARD_MARGIN_CSS: string;
  var MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT: number;
  var dialogOverrideStyleProperties: DialogOverrideProperty[];
  var dialogKeyboardExcludedStyleProperties: string[];
  var dialogKeyboardPositionProperties: string[];
  var initializeUiInputs10: () => void;
  function resizeTextAreaToContent(
    input: HTMLTextAreaElement,
    options: RefObject<string>,
  ): void {
    if (
      input.clientWidth === 0 ||
      (input.style.height !== options.current && input.style.height !== "")
    ) {
      return;
    }
    let offsetHeight = input.offsetHeight,
      value = offsetHeight - input.clientHeight,
      { overflowY: style, marginBottom: style2 } = input.style;
    input.style.height = "0px";
    input.style.marginBottom = `${offsetHeight}px`;
    input.style.overflowY = "hidden";
    options.current = `${input.scrollHeight + value}px`;
    input.style.height = options.current;
    input.style.marginBottom = style2;
    input.style.overflowY = style;
  }
  function observeTextAreaValue(
    input: HTMLTextAreaElement,
    options: () => void,
  ): (() => void) | undefined {
    let value = Object.getOwnPropertyDescriptor(input, "value"),
      value2 =
        value ??
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    if (!value2?.set || !value2.configurable) {
      return;
    }
    let flag = true,
      callback = (input2: string): void => {
        value2.set?.call(input, input2);
        if (flag) {
          options();
        }
      };
    Object.defineProperty(input, "value", {
      ...value2,
      set: callback,
    });
    return () => {
      flag = false;
      if (Object.getOwnPropertyDescriptor(input, "value")?.set !== callback) {
        return;
      }
      if (value) {
        Object.defineProperty(input, "value", value);
      } else {
        Reflect.deleteProperty(input, "value");
      }
    };
  }
  function useTextAreaAutosize({
    autosize: autosize,
    value: value,
    defaultValue: defaultValue,
  }: TextAreaAutosizeOptions): RefObject<HTMLTextAreaElement | null> {
    let value2 = autosize && !supportsNativeFieldSizing,
      value3 = value !== undefined,
      ref = reactHu.useRef<HTMLTextAreaElement>(null),
      ref2 = reactHu.useRef("");
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = ref.current,
        value4 = current?.ownerDocument.defaultView;
      if (!value2 || !current || !value4) {
        return;
      }
      let callback = () =>
          resizeTextAreaToContent(current, ref2),
        index = 0,
        callback2 = () => {
          value4.cancelAnimationFrame(index);
          index = value4.requestAnimationFrame(callback);
        },
        value5 = new value4.ResizeObserver(callback2);
      value5.observe(current);
      value4.document.fonts.addEventListener("loadingdone", callback);
      let callback3 = (event: Event): void => {
          if (event.target === current.form) {
            callback2();
          }
        },
        value6 = current.getRootNode(),
        value7 =
          value6 instanceof value4.ShadowRoot ? value6 : value4.document,
        value8: (() => void) | undefined;
      if (!value3) {
        value8 = observeTextAreaValue(current, callback);
        current.addEventListener("input", callback);
        value7.addEventListener("reset", callback3, true);
      }
      return () => {
        value8?.();
        value7.removeEventListener("reset", callback3, true);
        value5.disconnect();
        value4.cancelAnimationFrame(index);
        value4.document.fonts.removeEventListener("loadingdone", callback);
        current.removeEventListener("input", callback);
        if (current.style.height === ref2.current) {
          current.style.height = "";
        }
      };
    }, [value2, value3]);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (value2 && ref.current) {
        resizeTextAreaToContent(ref.current, ref2);
      }
    }, [value2, value2 ? value : null, value2 ? defaultValue : null]);
    return ref;
  }
  function isPictogramElement(input: ReactNode): boolean {
    if (!reactfK0.isValidElement(input) || typeof input.type === "string") {
      return false;
    }
    return isPictogramComponent(input.type);
  }
  function isPictogramComponent(input: unknown): boolean {
    let value = input as PictogramComponentLike | null | undefined;
    for (
      let index = 0;
      index < 4 && value !== null && value !== undefined;
      index++
    ) {
      if (value.isCdsPictogram === true) {
        return true;
      }
      let value2 = value;
      if (value2.$$typeof === REACT_MEMO_SYMBOL) {
        value = value2.type;
      } else if (value2.$$typeof === REACT_FORWARD_REF_SYMBOL) {
        value = value2.render;
      } else {
        return false;
      }
    }
    return false;
  }
  function Callout({
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
  }: CalloutProps): ReactElement {
    let value = (0, runtime.useTranslation)("dismiss", "Dismiss"),
      value2 = dismissLabel ?? value,
      value3 = (0, runtime.useDensity)(),
      state = {
        "data-step": (0, runtime.getDensitySizeIndex)(
          value3,
          calloutSizeByDensity[value3],
        ),
      },
      value4 = variant ?? "neutral",
      value5 =
        composerCalibration === true
          ? "glyph"
          : composerCalibration === false
            ? undefined
            : composerCalibration,
      value6 = value5 !== undefined,
      value7 =
        icon !== null && icon !== undefined && typeof icon !== "boolean",
      value8 = isPictogramElement(icon),
      value9 =
        details !== null &&
        details !== undefined &&
        typeof details !== "boolean",
      value10 = role ?? (value9 ? "none" : "status"),
      [value11, value12] = reactZQ.useState(defaultDetailsOpen),
      [value13, value14] = reactZQ.useState(false),
      ref = reactZQ.useRef<HTMLDivElement>(null),
      ref2 = reactZQ.useRef<HTMLDivElement>(null),
      ref3 = reactZQ.useRef<HTMLSpanElement>(null),
      ref4 = reactZQ.useRef(0),
      value15 =
        action !== null && action !== undefined && typeof action !== "boolean",
      value16 =
        !value9 && (value8 || (actionAlign === "center" && !value6)),
      value17 = value16,
      value18 = !value9 && value15,
      value19 = value18 && value13,
      value20 = value6 && value19 && !value16;
    reactZQ.useLayoutEffect(() => {
      if (!value6 || !value18 || value17) {
        ref4.current = 0;
      }
      if (!value18) {
        return;
      }
      let current = ref.current,
        value24 = (0, runtime.getResizeObserverConstructor)(current);
      if (current === null || value24 === undefined) {
        return;
      }
      let callback2 = () => {
        if (value20) {
          if (current.offsetWidth > ref4.current + CALLOUT_PICTOGRAM_SIZE) {
            value14(false);
          }
          return;
        }
        let current3 = ref2.current,
          current4 = ref3.current;
        if (current3 === null || current4 === null) {
          return;
        }
        let value26 = Number.parseFloat(
          getComputedStyle(current3).lineHeight,
        );
        if (!Number.isFinite(value26) || value26 <= 0) {
          return;
        }
        let top = current4.getBoundingClientRect().top,
          bounds = current3.getBoundingClientRect();
        if (value17 && bounds.height === 0) {
          return;
        }
        let value27 = value17
          ? top >= bounds.bottom - 1
          : top - bounds.top > value26 / 2;
        if (value27 && value6 && !value17) {
          ref4.current = current.offsetWidth;
        }
        value14(value27);
      };
      callback2();
      let value25 = new value24(callback2);
      value25.observe(current);
      let current2 = ref2.current;
      if (value17 && current2 !== null) {
        value25.observe(current2);
      }
      return () => value25.disconnect();
    }, [value18, value6, value20, value17]);
    let value21 = detailsOpen ?? value11,
      callback = (input: boolean): void => {
        value12(input);
        onDetailsOpenChange?.(input);
      },
      value22 = value9 || !value8,
      value23 = action
        ? jsxd8.jsx("span", {
            ref: ref3,
            ...state,
            className: (0, runtime.cn)(
              "flex shrink-0 items-center gap-xs",
              !value19 && "h-[1lh]",
              value20 && "basis-full",
              !value19 && "-ms-[2px]",
              value20 && value5 && leadingIconOutsetClasses[value5],
              value5 !== undefined &&
                !onDismiss &&
                leadingIconSpacingClasses[value5],
              !value6 && !onDismiss && "-me-[calc(var(--cds-pad-md)-2px)]",
            ),
            children: action,
          })
        : null;
    return jsxd8.jsxs("div", {
      "data-cds": "Banner",
      "data-icon-layout": value22 ? "first-line" : "centered",
      "data-cta-layout": value20 ? "stacked" : value19 ? "wrapped" : "inline",
      "data-action-align": value16 ? "center" : "first-line",
      "data-composer-keyline": value5,
      "data-testid": dataTestid,
      role: value10 === "none" ? undefined : value10,
      ref: ref,
      className: (0, runtime.cn)(
        "flex",
        value22 ? "items-start" : "items-center",
        "gap-xs py-md font-sans text-body font-normal",
        value6 ? "px-md" : "px-lg",
        value19 && !value20 && "pb-lg",
        value6 ? pictogramCardRadiusClass : "rounded-card",
        calloutVariantClasses[value4],
        className,
      ),
      children: [
        icon !== null &&
          !value20 &&
          jsxd8.jsx("span", {
            className: (0, runtime.cn)(
              value22 ? "flex min-h-[1lh] shrink-0 items-center" : "shrink-0",
              calloutTextClasses[value4],
              value6 && "ms-[4px] -me-[4px]",
            ),
            children: value7
              ? icon
              : jsxd8.jsx(runtime.Icon, {
                  name: calloutDefaultIcons[value4],
                  size: "auto",
                }),
          }),
        value9
          ? jsxd8.jsx("div", {
              className: (0, runtime.cn)(
                "flex min-w-0 flex-1 flex-col",
                value5 && leadingIconInsetClasses[value5],
              ),
              children: jsxd8.jsxs(runtime.Collapsible.Root, {
                className: "contents",
                open: value21,
                onOpenChange: callback,
                children: [
                  jsxd8.jsxs("div", {
                    className:
                      "flex min-w-0 flex-wrap items-start gap-y-sm gap-x-md",
                    children: [
                      jsxd8.jsx(runtime.Collapsible.Trigger, {
                        render: jsxd8.jsxs("button", {
                          type: "button",
                          className:
                            "cds-reset flex min-w-0 grow select-none items-center gap-x-[2px] border-0 text-start outline-none focus-visible:shadow-focus focus-visible:outline-hidden rounded transition-shadow duration-fast",
                          children: [
                            jsxd8.jsx("div", {
                              className: "min-w-0",
                              children: children,
                            }),
                            jsxd8.jsx(runtime.Icon, {
                              name: "CaretDown",
                              size: "sm",
                              className: `shrink-0 text-secondary transition-transform ${value21 ? "rotate-0" : "-rotate-90 rtl:rotate-90"}`,
                            }),
                          ],
                        }),
                      }),
                      value23,
                    ],
                  }),
                  jsxd8.jsx(runtime.Collapsible.Panel, {
                    className: "w-full text-secondary",
                    children: jsxd8.jsx("div", {
                      className: "pt-[var(--cds-gap-sm)]",
                      children: details,
                    }),
                  }),
                ],
              }),
            })
          : jsxd8.jsxs("div", {
              className: (0, runtime.cn)(
                "flex min-w-0 flex-wrap",
                value16 ? "items-center" : "items-start",
                "gap-y-sm gap-x-md flex-1",
                value20 && "gap-y-xs",
                value5 && leadingIconInsetClasses[value5],
              ),
              children: [
                jsxd8.jsx("div", {
                  ref: ref2,
                  className: !value16
                    ? "max-w-full min-w-0 flex-auto"
                    : value6 && value8
                      ? "min-w-[min(40ch,100%)] flex-1"
                      : "min-w-[min(20ch,100%)] flex-1",
                  children: children,
                }),
                value23,
              ],
            }),
        onDismiss &&
          jsxd8.jsx("span", {
            ...state,
            className: `${value5 !== undefined ? trailingIconOutsetClasses[value5] : "-me-[calc(var(--cds-pad-md)-2px)]"} flex h-[1lh] shrink-0 items-center`,
            children: jsxd8.jsx(runtime.Button, {
              variant: "ghost",
              iconOnly: true,
              icon: "X",
              "aria-label": value2,
              tooltip: false,
              onClick: onDismiss,
            }),
          }),
      ],
    });
  }
  function omitProps(
    input: object,
    options: readonly string[],
  ): Record<string, unknown> {
    let value = input as Record<string, unknown>,
      state: Record<string, unknown> = {};
    for (let value2 of Object.keys(value))
      if (!options.includes(value2)) {
        state[value2] = value[value2];
      }
    return state;
  }
  function InteractiveLinkElement({
    stamp: stamp,
    forwardedRef: forwardedRef,
    linkInput: linkInput,
    render: render,
    body: body,
    className: className,
    actionClassName: actionClassName,
    actionDisabled: actionDisabled,
    rest: rest,
  }: InteractiveLinkElementProps): ReactNode {
    let value = reactpK0.isValidElement(render),
      value2 = (0, runtime.useCdsLink)({
        ...linkInput,
        ...(0, runtime.pickLinkEventProps)(rest),
        href: value ? undefined : linkInput.href,
      }),
      value3 = omitProps(rest, [
        ...interactiveLinkReservedProps,
        "disabled",
      ]),
      value4 = (0, runtime.baseUseRender)({
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
    if (value) {
      return value4;
    }
    if (linkInput.href !== undefined) {
      let value6 = omitProps(rest, [
        ...interactiveLinkReservedProps,
        ...runtime.linkEventPropNames,
      ]);
      return jsxGP.jsx("a", {
        ref: forwardedRef,
        ...stamp,
        ...value6,
        ...value2,
        className: className,
        children: body,
      });
    }
    let value5 = omitProps(rest, ["href", "disabled"]);
    return jsxGP.jsx(runtime.baseButton, {
      render: jsxGP.jsx("span", {
        ...stamp,
      }),
      nativeButton: false,
      ...(actionDisabled !== undefined
        ? {
            disabled: actionDisabled,
          }
        : {}),
      ref: forwardedRef,
      ...value5,
      className: actionClassName,
      children: body,
    });
  }
  function NewTabAnnouncement({ id: id }: { id: string }): ReactElement {
    return jsxdK0.jsx("span", {
      id: id,
      hidden: true,
      className: "sr-only",
      children: (0, runtime.useTranslation)(
        "opensInNewTab",
        "(opens in new tab)",
      ),
    });
  }
  function TextLinkIcon(input: ReactNode): ReactElement {
    if ((0, runtime.isIconName)(input)) {
      return jsxp4.jsx(runtime.Icon, {
        name: input,
        size: "sm",
        className: "self-center",
        style: {
          fontSize: "1lh",
        },
      });
    } else {
      return jsxp4.jsx("span", {
        className: "self-center",
        children: input,
      });
    }
  }
  function readInlineStyleProperty(
    input: CSSStyleDeclaration,
    options: string,
  ): InlineStyleValue {
    return {
      value: input.getPropertyValue(options),
      priority: input.getPropertyPriority(options),
    };
  }
  function isOwnedImportantStyle(
    input: CSSStyleDeclaration,
    options: string,
    context: string | undefined,
  ): boolean {
    return (
      context !== undefined &&
      input.getPropertyPriority(options) === "important" &&
      input.getPropertyValue(options) === context
    );
  }
  function restoreDialogStyleOverride(input: DialogStyleOverride): void {
    let style = input.node.style;
    for (let value of dialogOverrideStyleProperties)
      if (isOwnedImportantStyle(style, value, input.written[value])) {
        let { value: value2, priority: value3 } =
          input.baseline[value];
        style.setProperty(value, value2, value3);
      }
  }
  function useDialogVisualKeyboard(
    input: boolean | undefined,
  ): Dispatch<SetStateAction<HTMLElement | null>> {
    let [value, value2] = reactc4.useState<HTMLElement | null>(null),
      [value3, value4] = reactc4.useState<VisualKeyboardMetrics | null>(null),
      callback = reactc4.useCallback(
        (input2: () => void): (() => void) => {
          if (!input || value === null) {
            return () => {
              return;
            };
          }
          value.addEventListener("focusin", input2);
          value.addEventListener("focusout", input2);
          return () => {
            value.removeEventListener("focusin", input2);
            value.removeEventListener("focusout", input2);
          };
        },
        [input, value],
      ),
      callback2 = reactc4.useCallback((): boolean => {
        if (!input || value === null) {
          return false;
        }
        let activeElement = value.ownerDocument.activeElement;
        return (
          value.contains(activeElement) &&
          (0, runtime.isEditableElement)(activeElement)
        );
      }, [input, value]),
      value5 = reactc4.useSyncExternalStore(
        callback,
        callback2,
        () => false,
      );
    (0, runtime.useVisualKeyboard)(
      (input && (value5 || value3 !== null)) as boolean,
      value4,
    );
    let memo = reactc4.useMemo(
        () => getKeyboardAdjustedDialogStyle(value3),
        [value3],
      ),
      ref = reactc4.useRef<DialogStyleOverride | null>(null);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      let current = ref.current;
      if (current !== null && (current.node !== value || memo === undefined)) {
        restoreDialogStyleOverride(current);
        ref.current = null;
      }
      if (value === null || memo === undefined) {
        return;
      }
      let style = value.style,
        state: Record<DialogOverrideProperty, string> = {
          top: memo.top,
          "max-height": memo.maxHeight,
          "min-height": "0px",
        },
        current2 = ref.current;
      if (current2 === null) {
        if (
          dialogKeyboardPositionProperties.some(
            (input2: string) =>
              style.getPropertyValue(input2) !== "",
          )
        ) {
          return;
        }
        current2 = {
          node: value,
          baseline: {
            top: readInlineStyleProperty(style, "top"),
            "max-height": readInlineStyleProperty(style, "max-height"),
            "min-height": readInlineStyleProperty(style, "min-height"),
          },
          intended: {},
          written: {},
          cap: "",
        };
        ref.current = current2;
      } else {
        let value6 = dialogKeyboardExcludedStyleProperties.some(
          (input2: string) => style.getPropertyValue(input2) !== "",
        );
        for (let value7 of dialogOverrideStyleProperties)
          if (!isOwnedImportantStyle(style, value7, current2.written[value7])) {
            let value8 = readInlineStyleProperty(style, value7);
            current2.baseline[value7] = value8;
            if (value7 === "top" && value8.value !== "") {
              value6 = true;
            }
          }
        if (value6) {
          restoreDialogStyleOverride(current2);
          ref.current = null;
          return;
        }
      }
      for (let value6 of dialogOverrideStyleProperties)
        if (
          current2.intended[value6] !== state[value6] ||
          !isOwnedImportantStyle(style, value6, current2.written[value6])
        ) {
          style.setProperty(value6, state[value6], "important");
          current2.intended[value6] = state[value6];
          current2.written[value6] = style.getPropertyValue(value6);
        }
      if (current2.cap !== memo.maxHeight) {
        current2.cap = memo.maxHeight;
        let activeElement = value.ownerDocument.activeElement,
          defaultView = value.ownerDocument.defaultView;
        if (
          defaultView !== null &&
          activeElement instanceof defaultView.HTMLElement &&
          activeElement !== value &&
          value.contains(activeElement)
        ) {
          scrollDialogInputIntoView(value, activeElement);
        }
      }
    });
    (0, runtime.useIsomorphicLayoutEffect)(
      () => () => {
        if (ref.current !== null) {
          restoreDialogStyleOverride(ref.current);
          ref.current = null;
        }
      },
      [],
    );
    return value2;
  }
  function getKeyboardAdjustedDialogStyle(
    input: VisualKeyboardMetrics | null,
  ): KeyboardAdjustedDialogStyle | undefined {
    if (
      input === null ||
      input.visible < MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT
    ) {
      return;
    }
    return {
      top: `calc(${input.offset + (input.visible + DIALOG_KEYBOARD_MARGIN_PX) / 2}px - ${DIALOG_KEYBOARD_MARGIN_CSS} / 2)`,
      maxHeight: `calc(${input.visible - DIALOG_KEYBOARD_MARGIN_PX}px - ${DIALOG_KEYBOARD_MARGIN_CSS})`,
    };
  }
  function scrollDialogInputIntoView(
    element: HTMLElement,
    options: HTMLElement,
  ): void {
    let defaultView = element.ownerDocument.defaultView;
    if (defaultView === null) {
      return;
    }
    for (
      let parentElement = options.parentElement;
      parentElement !== null;
      parentElement =
        parentElement === element ? null : parentElement.parentElement
    ) {
      if (parentElement.scrollHeight <= parentElement.clientHeight) {
        continue;
      }
      let { overflowY: style } =
        defaultView.getComputedStyle(parentElement);
      if (style !== "auto" && style !== "scroll") {
        continue;
      }
      let bounds = parentElement.getBoundingClientRect(),
        bounds2 = options.getBoundingClientRect();
      if (bounds2.bottom > bounds.bottom) {
        parentElement.scrollTop +=
          bounds2.bottom - bounds.bottom + DIALOG_KEYBOARD_MARGIN_PX;
      } else if (bounds2.top < bounds.top) {
        parentElement.scrollTop -=
          bounds.top - bounds2.top + DIALOG_KEYBOARD_MARGIN_PX;
      }
    }
  }
  bindRuntimeValue(
    runtime,
    "resizeTextAreaToContent",
    () => resizeTextAreaToContent,
  );
  bindRuntimeValue(runtime, "observeTextAreaValue", () => observeTextAreaValue);
  bindRuntimeValue(runtime, "useTextAreaAutosize", () => useTextAreaAutosize);
  bindRuntimeValue(
    runtime,
    "reactHu",
    () => reactHu,
    (value) => {
      reactHu = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsNativeFieldSizing",
    () => supportsNativeFieldSizing,
    (value) => {
      supportsNativeFieldSizing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs",
    () => initializeUiInputs,
    (value) => {
      initializeUiInputs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs",
    () => reactForUiInputs,
    (value) => {
      reactForUiInputs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs",
    () => jsxForUiInputs,
    (value) => {
      jsxForUiInputs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextArea",
    () => TextArea,
    (value) => {
      TextArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs2",
    () => initializeUiInputs2,
    (value) => {
      initializeUiInputs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiInputs2",
    () => reactForUiInputs2,
    (value) => {
      reactForUiInputs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiInputs2",
    () => jsxForUiInputs2,
    (value) => {
      jsxForUiInputs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COUNTER_VARIANT_CLASSES",
    () => COUNTER_VARIANT_CLASSES,
    (value) => {
      COUNTER_VARIANT_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COUNTER_SIZE_CLASSES",
    () => COUNTER_SIZE_CLASSES,
    (value) => {
      COUNTER_SIZE_CLASSES = value;
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
    "initializeUiInputs3",
    () => initializeUiInputs3,
    (value) => {
      initializeUiInputs3 = value;
    },
  );
  bindRuntimeValue(runtime, "isPictogramElement", () => isPictogramElement);
  bindRuntimeValue(runtime, "isPictogramComponent", () => isPictogramComponent);
  bindRuntimeValue(
    runtime,
    "reactfK0",
    () => reactfK0,
    (value) => {
      reactfK0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REACT_MEMO_SYMBOL",
    () => REACT_MEMO_SYMBOL,
    (value) => {
      REACT_MEMO_SYMBOL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REACT_FORWARD_REF_SYMBOL",
    () => REACT_FORWARD_REF_SYMBOL,
    (value) => {
      REACT_FORWARD_REF_SYMBOL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs4",
    () => initializeUiInputs4,
    (value) => {
      initializeUiInputs4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pictogramCardRadiusClass",
    () => pictogramCardRadiusClass,
    (value) => {
      pictogramCardRadiusClass = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSplitButtonNoop",
    () => initializeSplitButtonNoop,
    (value) => {
      initializeSplitButtonNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingIconInsetClasses",
    () => leadingIconInsetClasses,
    (value) => {
      leadingIconInsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingIconOutsetClasses",
    () => leadingIconOutsetClasses,
    (value) => {
      leadingIconOutsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_BUTTON_LABEL_CLASS",
    () => SPLIT_BUTTON_LABEL_CLASS,
    (value) => {
      SPLIT_BUTTON_LABEL_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "trailingIconOutsetClasses",
    () => trailingIconOutsetClasses,
    (value) => {
      trailingIconOutsetClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_BUTTON_ICON_CLASS",
    () => SPLIT_BUTTON_ICON_CLASS,
    (value) => {
      SPLIT_BUTTON_ICON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "leadingIconSpacingClasses",
    () => leadingIconSpacingClasses,
    (value) => {
      leadingIconSpacingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SPLIT_BUTTON_STYLE_DEFAULTS",
    () => SPLIT_BUTTON_STYLE_DEFAULTS,
    (value) => {
      SPLIT_BUTTON_STYLE_DEFAULTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs5",
    () => initializeUiInputs5,
    (value) => {
      initializeUiInputs5 = value;
    },
  );
  bindRuntimeValue(runtime, "Callout", () => Callout);
  bindRuntimeValue(
    runtime,
    "reactZQ",
    () => reactZQ,
    (value) => {
      reactZQ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxd8",
    () => jsxd8,
    (value) => {
      jsxd8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutSizeByDensity",
    () => calloutSizeByDensity,
    (value) => {
      calloutSizeByDensity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CALLOUT_PICTOGRAM_SIZE",
    () => CALLOUT_PICTOGRAM_SIZE,
    (value) => {
      CALLOUT_PICTOGRAM_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutVariantClasses",
    () => calloutVariantClasses,
    (value) => {
      calloutVariantClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutTextClasses",
    () => calloutTextClasses,
    (value) => {
      calloutTextClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "calloutDefaultIcons",
    () => calloutDefaultIcons,
    (value) => {
      calloutDefaultIcons = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs6",
    () => initializeUiInputs6,
    (value) => {
      initializeUiInputs6 = value;
    },
  );
  bindRuntimeValue(runtime, "omitProps", () => omitProps);
  bindRuntimeValue(
    runtime,
    "InteractiveLinkElement",
    () => InteractiveLinkElement,
  );
  bindRuntimeValue(
    runtime,
    "reactpK0",
    () => reactpK0,
    (value) => {
      reactpK0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxGP",
    () => jsxGP,
    (value) => {
      jsxGP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interactiveLinkReservedProps",
    () => interactiveLinkReservedProps,
    (value) => {
      interactiveLinkReservedProps = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs7",
    () => initializeUiInputs7,
    (value) => {
      initializeUiInputs7 = value;
    },
  );
  bindRuntimeValue(runtime, "NewTabAnnouncement", () => NewTabAnnouncement);
  bindRuntimeValue(
    runtime,
    "jsxdK0",
    () => jsxdK0,
    (value) => {
      jsxdK0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs8",
    () => initializeUiInputs8,
    (value) => {
      initializeUiInputs8 = value;
    },
  );
  bindRuntimeValue(runtime, "TextLinkIcon", () => TextLinkIcon);
  bindRuntimeValue(
    runtime,
    "reactForUiInputs3",
    () => reactForUiInputs3,
    (value) => {
      reactForUiInputs3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxp4",
    () => jsxp4,
    (value) => {
      jsxp4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LINK_CLASS",
    () => TEXT_LINK_CLASS,
    (value) => {
      TEXT_LINK_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LINK_UNDERLINE_CLASS",
    () => TEXT_LINK_UNDERLINE_CLASS,
    (value) => {
      TEXT_LINK_UNDERLINE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textLinkVariants",
    () => textLinkVariants,
    (value) => {
      textLinkVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LINK_COLOR_CLASS",
    () => TEXT_LINK_COLOR_CLASS,
    (value) => {
      TEXT_LINK_COLOR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LINK_FOCUS_CLASS",
    () => TEXT_LINK_FOCUS_CLASS,
    (value) => {
      TEXT_LINK_FOCUS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LINK_DISABLED_CLASS",
    () => TEXT_LINK_DISABLED_CLASS,
    (value) => {
      TEXT_LINK_DISABLED_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_LINK_EXTERNAL_ICON_CLASS",
    () => TEXT_LINK_EXTERNAL_ICON_CLASS,
    (value) => {
      TEXT_LINK_EXTERNAL_ICON_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextLink",
    () => TextLink,
    (value) => {
      TextLink = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs9",
    () => initializeUiInputs9,
    (value) => {
      initializeUiInputs9 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readInlineStyleProperty",
    () => readInlineStyleProperty,
  );
  bindRuntimeValue(
    runtime,
    "isOwnedImportantStyle",
    () => isOwnedImportantStyle,
  );
  bindRuntimeValue(
    runtime,
    "restoreDialogStyleOverride",
    () => restoreDialogStyleOverride,
  );
  bindRuntimeValue(
    runtime,
    "useDialogVisualKeyboard",
    () => useDialogVisualKeyboard,
  );
  bindRuntimeValue(
    runtime,
    "getKeyboardAdjustedDialogStyle",
    () => getKeyboardAdjustedDialogStyle,
  );
  bindRuntimeValue(
    runtime,
    "scrollDialogInputIntoView",
    () => scrollDialogInputIntoView,
  );
  bindRuntimeValue(
    runtime,
    "reactc4",
    () => reactc4,
    (value) => {
      reactc4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIALOG_KEYBOARD_MARGIN_PX",
    () => DIALOG_KEYBOARD_MARGIN_PX,
    (value) => {
      DIALOG_KEYBOARD_MARGIN_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DIALOG_KEYBOARD_MARGIN_CSS",
    () => DIALOG_KEYBOARD_MARGIN_CSS,
    (value) => {
      DIALOG_KEYBOARD_MARGIN_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT",
    () => MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT,
    (value) => {
      MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogOverrideStyleProperties",
    () => dialogOverrideStyleProperties,
    (value) => {
      dialogOverrideStyleProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogKeyboardExcludedStyleProperties",
    () => dialogKeyboardExcludedStyleProperties,
    (value) => {
      dialogKeyboardExcludedStyleProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dialogKeyboardPositionProperties",
    () => dialogKeyboardPositionProperties,
    (value) => {
      dialogKeyboardPositionProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiInputs10",
    () => initializeUiInputs10,
    (value) => {
      initializeUiInputs10 = value;
    },
  );
  return () => {
    initializeUiInputs = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      reactHu = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      supportsNativeFieldSizing =
        typeof CSS === "undefined" ||
        typeof CSS.supports !== "function" ||
        CSS.supports("field-sizing", "content");
    });
    initializeUiInputs2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeMergedRefs)();
      (0, runtime.initializeUiDisclosure12)();
      (0, runtime.initializeUiMenu)();
      initializeUiInputs();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      TextArea = reactForUiInputs.forwardRef<
        HTMLTextAreaElement,
        TextAreaProps
      >(
        (
          {
            className: className,
            rows: rows,
            resize = "none",
            autosize = false,
            bare = false,
            size: size,
            fullWidth = true,
            id: id,
            "aria-describedby": ariaDescribedby,
            "aria-invalid": ariaInvalid,
            disabled: disabled,
            style: style,
            ...props
          },
          options,
        ) => {
          let value = (0, runtime.useFieldInvalid)(),
            value2 = rows ?? 3,
            value3 = autosize && rows !== undefined,
            value4 = resize === "y" ? "resize-y" : "resize-none",
            value5 = autosize ? "[field-sizing:content]" : "",
            value6 = useTextAreaAutosize({
              autosize: autosize,
              value: props.value,
              defaultValue: props.defaultValue,
            }),
            value7 = (0, runtime.useMergedRefs)(options, value6),
            value8 = value3
              ? bare
                ? "min-h-[calc(var(--cds-textarea-rows)*1lh)]"
                : "min-h-[calc(var(--cds-textarea-rows)*1lh+2*var(--cds-pad-sm))]"
              : "",
            value9 = value3
              ? {
                  ...style,
                  "--cds-textarea-rows": value2,
                }
              : style,
            value10 = fullWidth ? "w-full" : "";
          return jsxForUiInputs.jsx(runtime.baseField.Control, {
            id: id,
            "aria-describedby": ariaDescribedby,
            disabled: disabled,
            render: jsxForUiInputs.jsx("textarea", {
              ref: value7,
              "data-cds": "TextArea",
              rows: value2,
              style: value9,
              ...(0, runtime.getControlSizeAttributes)(size),
              "data-invalid": value || undefined,
              "aria-invalid": value || ariaInvalid,
              ...props,
              className: (0, runtime.cn)(
                "cds-reset",
                value10,
                bare
                  ? "block resize-none border-0 bg-transparent p-0 shadow-none"
                  : `cds-input font-normal ${runtime.TEXT_INPUT_PLACEHOLDER_CLASS} enabled:[&:hover:not(:focus):not([data-invalid])]:shadow-field-hover focus-visible:shadow-focus data-[invalid]:focus-visible:shadow-focus-danger ${value4}`,
                "font-sans text-body text-primary placeholder:text-muted outline-none focus-visible:outline-hidden disabled:opacity-disabled",
                value5,
                value8,
                className,
              ),
            }),
          });
        },
      );
      TextArea.displayName = "TextArea";
    });
    initializeUiInputs3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      reactForUiInputs2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiInputs2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      COUNTER_VARIANT_CLASSES = {
        neutral: "bg-neutral text-secondary",
        accent: "bg-fill-accent text-on-accent",
        success: "bg-green-500 text-gray-0",
        warning: "bg-fill-warning text-yellow-750",
        danger: "bg-fill-danger text-on-danger",
      };
      COUNTER_SIZE_CLASSES = {
        neutral: "bg-fill-control",
        accent: "bg-fill-accent",
        success: "bg-fill-success",
        warning: "bg-fill-warning",
        danger: "bg-fill-danger",
      };
      Counter = reactForUiInputs2.forwardRef<HTMLSpanElement, CounterProps>(
        (
          {
            value: value,
            max = 99,
            showZero = false,
            dot = false,
            variant = "danger",
            size: size,
            className: className,
            ...props
          },
          options,
        ) => {
          if (dot) {
            return jsxForUiInputs2.jsx("span", {
              ref: options,
              "data-cds": "Counter",
              "aria-hidden": "true",
              ...props,
              className: (0, runtime.cn)(
                "inline-block size-2 shrink-0 rounded-full align-middle",
                COUNTER_SIZE_CLASSES[variant],
                className,
              ),
            });
          }
          if (!Number.isFinite(value)) {
            return null;
          }
          let value2 = Math.max(0, Math.floor(value));
          if (value2 === 0 && !showZero) {
            return null;
          }
          let value3 = value2 > max ? `${max}+` : `${value2}`;
          return jsxForUiInputs2.jsx("span", {
            ref: options,
            "data-cds": "Counter",
            ...(0, runtime.getControlSizeAttributes)(size),
            ...props,
            className: (0, runtime.cn)(
              "inline-flex shrink-0 items-center justify-center align-middle",
              "h-control-nested min-w-[var(--cds-h-control-nested)] rounded-full",
              value3.length === 1
                ? "px-0"
                : "px-[calc(var(--cds-h-control-nested)*0.3)]",
              "font-sans text-caption font-medium proportional-nums",
              COUNTER_VARIANT_CLASSES[variant],
              className,
            ),
            children: value3,
          });
        },
      );
      Counter.displayName = "Counter";
    });
    initializeUiInputs4 = (0, runtime.initializeOnce)(() => {
      reactfK0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      REACT_MEMO_SYMBOL = Symbol.for("react.memo");
      REACT_FORWARD_REF_SYMBOL = Symbol.for("react.forward_ref");
    });
    pictogramCardRadiusClass = "rounded-composer";
    initializeSplitButtonNoop = () => {};
    initializeUiInputs5 = (0, runtime.initializeOnce)(() => {
      leadingIconInsetClasses = {
        glyph: "ml-[6px] compact:ml-[6px] comfortable:ml-[4px]",
        text: "ml-[4px] compact:ml-[4px] comfortable:ml-[2px]",
      };
      leadingIconOutsetClasses = {
        glyph: "-ml-[6px] compact:-ml-[6px] comfortable:-ml-[4px]",
        text: "-ml-[4px] compact:-ml-[4px] comfortable:-ml-[2px]",
      };
      SPLIT_BUTTON_LABEL_CLASS = leadingIconInsetClasses.glyph;
      trailingIconOutsetClasses = {
        glyph: "-mr-[4px]",
        text: "-mr-[2px] compact:-mr-[2px] comfortable:-mr-[4px]",
      };
      SPLIT_BUTTON_ICON_CLASS = trailingIconOutsetClasses.glyph;
      leadingIconSpacingClasses = {
        glyph:
          "me-[calc(8px-var(--cds-pad-md))] compact:me-[calc(8px-var(--cds-pad-md))] comfortable:me-[calc(4px-var(--cds-pad-md))]",
        text: "me-[calc(6px-var(--cds-pad-md))] compact:me-[calc(6px-var(--cds-pad-md))] comfortable:me-[calc(5px-var(--cds-pad-md))]",
      };
      SPLIT_BUTTON_STYLE_DEFAULTS = leadingIconSpacingClasses.glyph;
    });
    CALLOUT_PICTOGRAM_SIZE = 64;
    initializeUiInputs6 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeTranslations)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeResizeObserverAccess)();
      (0, runtime.initializeIcons)();
      (0, runtime.initializeUiDisclosure4)();
      (0, runtime.initializeUiDisclosure9)();
      initializeUiInputs4();
      initializeSplitButtonNoop();
      initializeUiInputs5();
      reactZQ = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxd8 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      calloutSizeByDensity = {
        comfortable: "sm",
        compact: "base",
      };
      calloutVariantClasses = {
        neutral:
          "bg-surface-1 text-primary shadow-card-ring [--cds-prose-code-color:var(--cds-text-danger)] [--cds-prose-marker-color:var(--cds-text-secondary)]",
        warning:
          "bg-warning text-warning shadow-ring-warning [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",
        danger:
          "bg-danger text-danger shadow-ring-danger [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",
      };
      calloutTextClasses = {
        neutral: "text-secondary",
        warning: "",
        danger: "",
      };
      calloutDefaultIcons = {
        neutral: "Info",
        warning: "Warning",
        danger: "Warning",
      };
    });
    initializeUiInputs7 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeCdsLink)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactpK0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxGP = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      interactiveLinkReservedProps = [
        "href",
        "routerOptions",
        "target",
        "rel",
        "download",
      ];
    });
    initializeUiInputs8 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeTranslations)();
      jsxdK0 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    TEXT_LINK_CLASS = "cds-reset cds-text-link";
    TEXT_LINK_UNDERLINE_CLASS = "cds-text-link-underline";
    TEXT_LINK_COLOR_CLASS =
      "text-inherit [transition-property:text-decoration-color,box-shadow]";
    TEXT_LINK_FOCUS_CLASS = "[transition-property:text-decoration-color]";
    initializeUiInputs9 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeHrefWhitespace)();
      (0, runtime.initializeLinkTargets)();
      (0, runtime.initializeCdsLink)();
      (0, runtime.initializePointerDismissal)();
      (0, runtime.initializeIcons)();
      initializeUiInputs7();
      initializeUiInputs8();
      (0, runtime.initializeNpmDependency)();
      reactForUiInputs3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxp4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      textLinkVariants = `${TEXT_LINK_CLASS} ${TEXT_LINK_UNDERLINE_CLASS} inline`;
      TEXT_LINK_DISABLED_CLASS = `${TEXT_LINK_CLASS} inline-flex items-baseline`;
      TEXT_LINK_EXTERNAL_ICON_CLASS = TEXT_LINK_UNDERLINE_CLASS;
      TextLink = reactForUiInputs3.forwardRef<HTMLElement, TextLinkProps>(
        (
          {
            className: className,
            children: children,
            icon: icon,
            iconPosition = "end",
            external: external,
            inheritColor: inheritColor,
            render: render,
            "aria-describedby": ariaDescribedby,
            ...props
          },
          options,
        ) => {
          let value = "href" in props && props.href !== undefined,
            value2 = reactForUiInputs3.useContext(
              runtime.pointerDismissalContext,
            ),
            value3 = inheritColor ?? value2,
            value4 =
              external &&
              !(
                value &&
                !reactForUiInputs3.isValidElement(render) &&
                (0, runtime.isSanitizedHrefFallback)(
                  props.href,
                  (0, runtime.sanitizeHref)(props.href),
                )
              )
                ? external
                : false,
            value5 = value
              ? (props.target ?? (value4 ? "_blank" : undefined))
              : undefined,
            value6 = value
              ? (props.rel ??
                (value4 &&
                value5 !== undefined &&
                !(0, runtime.opensInSeparateBrowsingContext)(value5)
                  ? (0, runtime.getAutomaticLinkRel)(props.href, value5)
                  : undefined))
              : undefined,
            value7 = reactForUiInputs3.useId(),
            value8 = jsxp4.jsx(NewTabAnnouncement, {
              id: value7,
            }),
            value9 =
              icon || (value4 === "with-icon" ? "ArrowUpRight" : undefined),
            value10 = !!value9,
            value11 = `${(0, runtime.cn)(value10 ? (0, runtime.clsx)(TEXT_LINK_DISABLED_CLASS, icon ? "gap-[0.25em]" : "gap-0") : textLinkVariants, value3 && TEXT_LINK_COLOR_CLASS)}`,
            value12 = value10
              ? jsxp4.jsxs(jsxp4.Fragment, {
                  children: [
                    iconPosition === "start" && TextLinkIcon(value9),
                    jsxp4.jsx("span", {
                      className: (0, runtime.clsx)(
                        TEXT_LINK_EXTERNAL_ICON_CLASS,
                        value3 && TEXT_LINK_FOCUS_CLASS,
                      ),
                      children: children,
                    }),
                    iconPosition === "end" && TextLinkIcon(value9),
                    value4 && value8,
                  ],
                })
              : value4
                ? jsxp4.jsxs(jsxp4.Fragment, {
                    children: [children, value8],
                  })
                : children,
            value13 = (0, runtime.cn)(
              value11,
              "cursor-pointer",
              className,
            ),
            value14 = props.disabled ?? false;
          return jsxp4.jsx(InteractiveLinkElement, {
            stamp: {
              "data-cds": "TextLink",
            },
            forwardedRef: options,
            linkInput: {
              href: value ? props.href : undefined,
              routerOptions: value ? props.routerOptions : undefined,
              target: value5,
              rel: value6,
              download: value ? props.download : undefined,
            },
            render: render,
            body: value12,
            className: value13,
            actionClassName: (0, runtime.cn)(
              value11,
              value14 ? "cursor-default opacity-disabled" : "cursor-pointer",
              className,
            ),
            actionDisabled: value14,
            rest: {
              ...props,
              ...(value3 && {
                "data-inherit-color": "",
              }),
              "aria-describedby":
                [ariaDescribedby, value4 ? value7 : undefined]
                  .filter(Boolean)
                  .join(" ") || undefined,
            },
          });
        },
      );
      TextLink.displayName = "TextLink";
    });
    DIALOG_KEYBOARD_MARGIN_PX = 8;
    MINIMUM_DIALOG_KEYBOARD_VISIBLE_HEIGHT = 240;
    initializeUiInputs10 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeVisualKeyboard)();
      reactc4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      DIALOG_KEYBOARD_MARGIN_CSS = `max(${DIALOG_KEYBOARD_MARGIN_PX}px, env(safe-area-inset-bottom, 0px))`;
      dialogOverrideStyleProperties = ["top", "max-height", "min-height"];
      dialogKeyboardExcludedStyleProperties = [
        "bottom",
        "inset",
        "translate",
        "transform",
      ];
      dialogKeyboardPositionProperties = [
        "top",
        ...dialogKeyboardExcludedStyleProperties,
      ];
    });
  };
}

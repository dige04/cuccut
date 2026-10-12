/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  ForwardRefExoticComponent,
  FormHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler,
  ReactElement,
  ReactNode,
  RefAttributes,
  SubmitEvent as ReactSubmitEvent,
  ComponentPropsWithoutRef,
} from "react";
import type { ButtonSize, ButtonVariant } from "./disclosure";
import type { CdsControlSize } from "./overlays";

/** Props of `ButtonGroup`; a group of too many buttons folds into a split button. */
export interface ButtonGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "className"> {
  /** "spaced" separates the buttons, "joined" fuses them. */
  variant?: "spaced" | "joined";
  orientation?: "horizontal" | "vertical";
  size?: ButtonSize;
  /** Variant the contained buttons take. */
  buttonVariant?: ButtonVariant;
  className?: string;
  children?: ReactNode;
}
/** What a button group reads from a child it may fold into an overflow menu. */
interface ButtonGroupChildProps {
  href?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  "aria-label"?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
  type?: string;
  pressed?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  shortcut?: string;
  /** Present on a button that renders as another element. */
  render?: unknown;
  /** Menu entries of a dropdown button. */
  items?: unknown;
  /** What the dropdown trigger shows: its label by default. */
  trigger?: string;
  label?: ReactNode;
}
/** The first button of a folded group, which stays visible. */
export interface ButtonGroupPrimary {
  label?: string;
  icon?: string;
  iconOnly: boolean;
  onClick: MouseEventHandler<HTMLElement>;
  pressed?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
}
/** A button of a folded group, as a menu entry. */
export interface ButtonGroupOverflowItem {
  icon?: ReactNode;
  label?: string;
  disabled?: boolean;
  onSelect?: MouseEventHandler<HTMLElement>;
  shortcut?: string;
  checked?: boolean;
  checkedRole?: "checkbox";
  keepOpen?: boolean;
  /** Entries of a folded dropdown button. */
  items?: unknown[];
}
export interface ButtonGroupModel {
  primary: ButtonGroupPrimary;
  overflow: ButtonGroupOverflowItem[];
}
/** The model of a foldable group; `null` when it can't fold, "unrecognised" when a child blocks it. */
export type ButtonGroupClassification =
  | ButtonGroupModel
  | "unrecognised"
  | null;
/** What a component exposes for matching: its display name. */
interface NamedComponent {
  displayName?: string;
}
/** Control sizes the form controls accept. */
export type FormSize = Exclude<ButtonSize, "xxs">;
export interface FormProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "className"> {
  className?: string;
  /** Submits on Cmd/Ctrl+Enter (default true). */
  submitOnModEnter?: boolean;
  disabled?: boolean;
  size?: FormSize;
}
export interface SwitchProps
  extends Omit<
    ComponentPropsWithoutRef<"button">,
    "className" | "children" | "onChange" | "value" | "type"
  > {
  className?: string;
  size?: CdsControlSize;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  name?: string;
  required?: boolean;
  readOnly?: boolean;
  /** Why the switch is disabled; shown as a tooltip. */
  disabledReason?: ReactNode;
  disabledReasonSide?: string;
}
export interface RadioMarkProps {
  /** Aligns the mark with the first line of a multi-line label. */
  topAlign?: boolean;
  focusRing?: boolean;
}
export interface RadioGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}
export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: readonly RadioGroupOption[];
  disabled?: boolean;
  size?: CdsControlSize;
  name?: string;
  className?: string;
}
export interface RadioGroupItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}
export interface RadioGroupCardProps extends RadioGroupItemProps {
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}
export interface RadioGroupRootProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "className" | "defaultValue" | "onChange"
  > {
  className?: string;
  size?: CdsControlSize;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}
/** `RadioGroup` with its parts attached. */
export type RadioGroupWithParts = ((props: RadioGroupProps) => ReactElement) & {
  Root: ForwardRefExoticComponent<
    RadioGroupRootProps & RefAttributes<HTMLDivElement>
  >;
  Item: ForwardRefExoticComponent<
    RadioGroupItemProps & RefAttributes<HTMLButtonElement>
  >;
  Card: ForwardRefExoticComponent<
    RadioGroupCardProps & RefAttributes<HTMLButtonElement>
  >;
};
/** Edge of a container a resize handle sits on. */
export type ResizeHandleSide = "inline-start" | "inline-end" | "top" | "bottom";
export interface ResizeHandleProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  orientation?: "vertical" | "horizontal";
  /** Positions the handle on an edge of its container instead of in flow. */
  side?: ResizeHandleSide;
  /** Called with the pixel distance from where the drag began. */
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  /** Called when the drag or keyboard step ends; `true` if it moved. */
  onResizeEnd?: (moved: boolean) => void;
  className?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    checkedTabFlexDocuments: WeakSet<Document>;
    initializeUiTabs: () => void;
    initializeUiTabs2: () => void;
    initializeUiTabs3: () => void;
    initializeUiTabs4: () => void;
    initializeUiTabs5: () => void;
    initializeUiTabs6: () => void;
    isUnwrappedHorizontalFlex: (element: Element) => boolean;
    getInnerElementWidth: (element: Element) => number;
    getTabOverflowWidth: (
      container: Element,
      skipped: Element,
      skippedWidth: number,
    ) => number;
    measureVisibleSiblingWidth: (
      container: Element,
      skipped: Element,
      gap: number,
    ) => number;
    applyTabFlexCorrection: (
      element: HTMLElement,
      styleAttribute: string | null,
      cssText: string,
    ) => void;
    parsePixelCssValue: (value: string) => number;
    measureTabStripContents: (strip: Element) => number;
    ButtonGroup: (props: ButtonGroupProps) => ReactElement;
    elementHasDisplayName: (
      element: ReactElement,
      displayName: string,
    ) => boolean;
    elementHasComponentType: (
      element: ReactElement,
      component: NamedComponent,
    ) => boolean;
    flattenButtonGroupChildren: (children: ReactNode) => ReactNode[];
    classifyButtonGroupChildren: (
      children: ReactNode,
    ) => ButtonGroupClassification;
    buttonGroupDiagnosticNoop: (code: string, message: string) => void;
    FORM_SIZE_GAP_CLASSES: Record<FormSize, string>;
    Form: ForwardRefExoticComponent<FormProps & RefAttributes<HTMLFormElement>>;
    preventRepeatedSwitchEnter: (event: {
      repeat: boolean;
      key: string;
      preventDefault(): void;
    }) => void;
    SWITCH_TRACK_CLASS: string;
    SWITCH_THUMB_CLASS: string;
    SWITCH_TRACK_SIZE_CLASS: string;
    SWITCH_THUMB_SIZE_CLASS: string;
    Switch: ForwardRefExoticComponent<
      SwitchProps & RefAttributes<HTMLButtonElement>
    >;
    RadioMark: (props: RadioMarkProps) => ReactElement;
    RadioGroup: (props: RadioGroupProps) => ReactElement;
    RADIO_MARK_CLASS: string;
    RadioGroupItem: ForwardRefExoticComponent<
      RadioGroupItemProps & RefAttributes<HTMLButtonElement>
    >;
    RADIO_ITEM_CLASS: string;
    RadioGroupCard: ForwardRefExoticComponent<
      RadioGroupCardProps & RefAttributes<HTMLButtonElement>
    >;
    RadioGroupRoot: ForwardRefExoticComponent<
      RadioGroupRootProps & RefAttributes<HTMLDivElement>
    >;
    /** `RadioGroup` with `Root`, `Item` and `Card` attached. */
    RADIO_CARD_CLASS: RadioGroupWithParts;
    RESIZE_HANDLE_DRAG_TOLERANCE: number;
    RESIZE_HANDLE_KEY_STEP: number;
    RESIZE_HANDLE_SHIFT_KEY_STEP: number;
    RESIZE_HANDLE_SIDE_CLASSES: Record<ResizeHandleSide, string>;
    ResizeHandle: ForwardRefExoticComponent<
      ResizeHandleProps & RefAttributes<HTMLDivElement>
    >;
    reactForUiTabs: ReactNamespace;
    jsxForUiTabs: JsxNamespace;
    reactForUiTabs2: ReactNamespace;
    jsxForUiTabs2: JsxNamespace;
    reactForUiTabs3: ReactNamespace;
    jsxForUiTabs3: JsxNamespace;
    reactForUiTabs4: ReactNamespace;
    jsxForUiTabs4: JsxNamespace;
    reactForUiTabs5: ReactNamespace;
    jsxForUiTabs5: JsxNamespace;
  }
}

export function installUiTabs(runtime: RuntimeBindings): () => void {
  var checkedTabFlexDocuments: WeakSet<Document>;
  var initializeUiTabs: () => void;
  var reactForUiTabs: ReactNamespace;
  var jsxForUiTabs: JsxNamespace;
  var initializeUiTabs2: () => void;
  var reactForUiTabs2: ReactNamespace;
  var jsxForUiTabs2: JsxNamespace;
  var FORM_SIZE_GAP_CLASSES: Record<FormSize, string>;
  var Form: RuntimeBindings["Form"];
  var initializeUiTabs3: () => void;
  var reactForUiTabs3: ReactNamespace;
  var jsxForUiTabs3: JsxNamespace;
  var SWITCH_TRACK_CLASS: string;
  var SWITCH_THUMB_CLASS: string;
  var SWITCH_TRACK_SIZE_CLASS: string;
  var SWITCH_THUMB_SIZE_CLASS: string;
  var Switch: RuntimeBindings["Switch"];
  var initializeUiTabs4: () => void;
  var reactForUiTabs4: ReactNamespace;
  var jsxForUiTabs4: JsxNamespace;
  var RADIO_MARK_CLASS: string;
  var RadioGroupItem: RuntimeBindings["RadioGroupItem"];
  var RADIO_ITEM_CLASS: string;
  var RadioGroupCard: RuntimeBindings["RadioGroupCard"];
  var RadioGroupRoot: RuntimeBindings["RadioGroupRoot"];
  var RADIO_CARD_CLASS: RadioGroupWithParts;
  var initializeUiTabs5: () => void;
  var reactForUiTabs5: ReactNamespace;
  var jsxForUiTabs5: JsxNamespace;
  var RESIZE_HANDLE_DRAG_TOLERANCE: number;
  var RESIZE_HANDLE_KEY_STEP: number;
  var RESIZE_HANDLE_SHIFT_KEY_STEP: number;
  var RESIZE_HANDLE_SIDE_CLASSES: Record<ResizeHandleSide, string>;
  var ResizeHandle: RuntimeBindings["ResizeHandle"];
  var initializeUiTabs6: () => void;
  function isUnwrappedHorizontalFlex(input: Element): boolean {
    let value = getComputedStyle(input);
    return (
      value.display.endsWith("flex") &&
      !value.flexDirection.startsWith("column") &&
      !value.flexWrap.startsWith("wrap")
    );
  }
  function getInnerElementWidth(input: Element): number {
    let value = getComputedStyle(input);
    return (
      input.getBoundingClientRect().width -
      (Number.parseFloat(value.paddingLeft) || 0) -
      (Number.parseFloat(value.paddingRight) || 0) -
      (Number.parseFloat(value.borderLeftWidth) || 0) -
      (Number.parseFloat(value.borderRightWidth) || 0)
    );
  }
  function getTabOverflowWidth(
    input: Element,
    options: Element,
    context: number,
  ): number {
    return (
      context +
      measureVisibleSiblingWidth(
        input,
        options,
        Number.parseFloat(getComputedStyle(input).columnGap) || 0,
      )
    );
  }
  function measureVisibleSiblingWidth(
    input: Element,
    options: Element,
    context: number,
  ): number {
    let index = 0;
    for (let value of Array.from(input.children)) {
      if (value === options || !(0, runtime.isHtmlElement)(value)) {
        continue;
      }
      let value2 = getComputedStyle(value);
      if (
        value2.position === "absolute" ||
        value2.position === "fixed" ||
        value2.display === "none"
      ) {
        continue;
      }
      if (value2.display === "contents") {
        index += measureVisibleSiblingWidth(value, options, context);
        continue;
      }
      if (value2.flexShrink === "0" && value2.flexGrow === "0") {
        index += value.getBoundingClientRect().width + context;
        continue;
      }
      let value3 = parsePixelCssValue(value2.flexBasis),
        attribute = value.getAttribute("style"),
        cssText = value.style.cssText;
      value.style.flex = "0 0 auto";
      value.style.width = "min-content";
      let width = value.getBoundingClientRect().width;
      applyTabFlexCorrection(value, attribute, cssText);
      index += Math.max(width, value3) + context;
    }
    return index;
  }
  function applyTabFlexCorrection(
    element: HTMLElement,
    options: string | null,
    context: string,
  ): void {
    if (options === null) {
      element.removeAttribute("style");
      return;
    }
    let cssText = element.style.cssText;
    if (!checkedTabFlexDocuments.has(element.ownerDocument)) {
      element.setAttribute("style", options);
      if (!(cssText !== context && element.style.cssText === cssText)) {
        return;
      }
      checkedTabFlexDocuments.add(element.ownerDocument);
    }
    element.style.cssText = context;
  }
  function parsePixelCssValue(input: string): number {
    if (/^\d*\.?\d+px$/.test(input)) {
      return Number.parseFloat(input);
    } else {
      return 0;
    }
  }
  function measureTabStripContents(input: Element): number {
    let { POSITIVE_INFINITY: value, NEGATIVE_INFINITY: value2 } =
      Number;
    for (let value4 of Array.from(input.children)) {
      if (
        !(0, runtime.isHtmlElement)(value4) &&
        !(0, runtime.isSvgElement)(value4)
      ) {
        continue;
      }
      let position = getComputedStyle(value4).position;
      if (position === "absolute" || position === "fixed") {
        continue;
      }
      let bounds = value4.getBoundingClientRect();
      if (bounds.width <= 0 && bounds.height <= 0) {
        continue;
      }
      value = Math.min(value, bounds.left);
      value2 = Math.max(value2, bounds.right);
    }
    if (value2 < value) {
      return 0;
    }
    let value3 = getComputedStyle(input);
    return (
      value2 -
      value +
      (Number.parseFloat(value3.paddingLeft) || 0) +
      (Number.parseFloat(value3.paddingRight) || 0)
    );
  }
  function ButtonGroup(input: ButtonGroupProps): ReactElement {
    let {
        variant = "spaced",
        orientation = "horizontal",
        children: children,
        size: size,
        buttonVariant = "secondary",
      } = input,
      value = variant === "spaced" && orientation === "horizontal",
      memo = reactForUiTabs.useMemo(
        () => (value ? classifyButtonGroupChildren(children) : null),
        [value, children],
      ),
      value2 = memo !== null && memo !== "unrecognised";
    if (memo === "unrecognised") {
      buttonGroupDiagnosticNoop(
        "ButtonGroup.introspect",
        "ButtonGroup: a child can't become a menu item (wrapped, link, non-string label, or DropdownButton with JSX items), so the group stays expanded.",
      );
    }
    let ref = reactForUiTabs.useRef<HTMLSpanElement>(null),
      [value3, value4] = reactForUiTabs.useState(false),
      ref2 = reactForUiTabs.useRef(0);
    (0, runtime.useIsomorphicLayoutEffect)(() => {
      if (!value2) {
        return;
      }
      let current = ref.current,
        value6 = current?.parentElement ?? null;
      if (current === null || value6 === null) {
        return;
      }
      let value7 = (0, runtime.getResizeObserverConstructor)(value6);
      if (value7 === undefined) {
        return;
      }
      let callback = (): void => {
        let value9 = getInnerElementWidth(value6);
        if (value9 <= 0) {
          return;
        }
        if (!isUnwrappedHorizontalFlex(value6)) {
          if (value3) {
            value4(false);
          }
          return;
        }
        if (value3) {
          if (value9 >= ref2.current + 64) {
            value4(false);
          }
          return;
        }
        let firstElementChild2 = current.firstElementChild;
        if (!(0, runtime.isHtmlElement)(firstElementChild2)) {
          return;
        }
        let value10 = getTabOverflowWidth(
          value6,
          current,
          firstElementChild2.getBoundingClientRect().width,
        );
        ref2.current = value10;
        if (value9 < value10) {
          value4(true);
        }
      };
      callback();
      let value8 = new value7(callback);
      value8.observe(value6);
      let firstElementChild = current.firstElementChild;
      if ((0, runtime.isHtmlElement)(firstElementChild)) {
        value8.observe(firstElementChild);
      }
      return () => value8.disconnect();
    }, [value2, value3]);
    if (!value) {
      return jsxForUiTabs.jsx(runtime.ButtonGroupRoot, {
        ...input,
      });
    }
    let value5 = value2 && value3;
    return jsxForUiTabs.jsx("span", {
      ref: ref,
      className: "contents",
      "data-cds-collapsing": value2 ? "" : undefined,
      "data-collapsed": value5 ? "" : undefined,
      children: value5
        ? jsxForUiTabs.jsx(runtime.SplitButton, {
            ...((memo as ButtonGroupModel).primary.iconOnly && (memo as ButtonGroupModel).primary.icon !== undefined
              ? {
                  icon: (memo as ButtonGroupModel).primary.icon,
                  "aria-label": (memo as ButtonGroupModel).primary.label,
                }
              : {
                  label: (memo as ButtonGroupModel).primary.label,
                }),
            variant: (memo as ButtonGroupModel).primary.variant ?? buttonVariant,
            size: size,
            pressed: (memo as ButtonGroupModel).primary.pressed,
            disabled: (memo as ButtonGroupModel).primary.disabled,
            onPrimaryClick: (memo as ButtonGroupModel).primary.onClick,
            items: (memo as ButtonGroupModel).overflow,
            className: input.className,
          })
        : jsxForUiTabs.jsx(runtime.ButtonGroupRoot, {
            ...input,
          }),
    });
  }
  function elementHasDisplayName(
    element: ReactElement,
    displayName: string,
  ): boolean {
    return (element.type as NamedComponent | undefined)?.displayName === displayName;
  }
  function elementHasComponentType(
    element: ReactElement,
    component: NamedComponent,
  ): boolean {
    let value = (element.type as NamedComponent | undefined)?.displayName;
    return (
      element.type === component || (!!value && value === component.displayName)
    );
  }
  function flattenButtonGroupChildren(children: ReactNode): ReactNode[] {
    return reactForUiTabs.Children.toArray(children).flatMap(
      (input) =>
        reactForUiTabs.isValidElement<{ children?: ReactNode }>(input) &&
        input.type === reactForUiTabs.Fragment
          ? reactForUiTabs.Children.toArray(input.props.children)
          : [input],
    );
  }
  function classifyButtonGroupChildren(
    children: ReactNode,
  ): ButtonGroupClassification {
    let value = flattenButtonGroupChildren(children);
    if (value.length < 2) {
      return null;
    }
    let items: ButtonGroupOverflowItem[] = [],
      value2: ButtonGroupPrimary | null = null;
    for (let value3 of value) {
      if (!reactForUiTabs.isValidElement<ButtonGroupChildProps>(value3)) {
        return "unrecognised";
      }
      if (elementHasComponentType(value3, runtime.Button)) {
        let props = value3.props;
        if ("href" in props && props.href !== undefined) {
          return "unrecognised";
        }
        let value4 =
            typeof props.icon === "string" ? props.icon : undefined,
          value5 =
            props.iconOnly === true
              ? props["aria-label"]
              : typeof props.children === "string"
                ? props.children
                : null;
        if (value5 === null) {
          return "unrecognised";
        }
        let onClick = props.onClick;
        if (
          onClick === undefined ||
          props.type === "submit" ||
          props.type === "reset" ||
          "render" in props
        ) {
          return null;
        }
        if (value2 === null) {
          value2 = {
            label: value5,
            icon: value4,
            iconOnly: props.iconOnly === true,
            onClick: onClick,
            pressed: props.pressed,
            disabled: props.disabled,
            variant: props.variant,
          };
        } else {
          items.push({
            icon: value4,
            label: value5,
            disabled: props.disabled,
            onSelect: onClick,
            shortcut: "shortcut" in props ? props.shortcut : undefined,
            ...(props.pressed !== undefined && {
              checked: props.pressed,
              checkedRole: "checkbox",
              keepOpen: true,
            }),
          });
        }
      } else if (elementHasDisplayName(value3, "DropdownButton")) {
        let props = value3.props;
        if (!Array.isArray(props.items)) {
          return "unrecognised";
        }
        let value4 =
          props.trigger === "label" || props.trigger === undefined
            ? typeof props.label === "string"
              ? props.label
              : null
            : props["aria-label"];
        if (value4 === null) {
          return "unrecognised";
        }
        items.push({
          icon: "icon" in props ? props.icon : undefined,
          label: value4,
          disabled: props.disabled,
          items: props.items,
        });
      } else {
        return "unrecognised";
      }
    }
    if (value2 === null) {
      return null;
    }
    if (
      value2.disabled === true &&
      items.some((input) => input.disabled !== true)
    ) {
      return null;
    }
    return {
      primary: value2,
      overflow: items,
    };
  }
  function buttonGroupDiagnosticNoop(
    children: string,
    configuration: string,
  ): void {}
  function preventRepeatedSwitchEnter(event: {
    repeat: boolean;
    key: string;
    preventDefault(): void;
  }): void {
    if (event.repeat && event.key === "Enter") {
      event.preventDefault();
    }
  }
  function RadioMark({
    topAlign = false,
    focusRing = false,
  }: RadioMarkProps): ReactElement {
    return jsxForUiTabs4.jsx("span", {
      className: (0, runtime.clsx)(
        RADIO_MARK_CLASS,
        focusRing && "group-focus-visible/rd:shadow-focus",
        topAlign && "mt-[calc((1lh_-_var(--cds-checkbox,1rem))_/_2)]",
      ),
      children: jsxForUiTabs4.jsx(runtime.baseRadio.Indicator, {
        className:
          "size-[calc(var(--cds-checkbox,1rem)-calc(0.625rem*var(--cds-rem-scale,1)))] rounded-full bg-[var(--cds-on-accent)] data-[unchecked]:hidden",
        keepMounted: true,
      }),
    });
  }
  function RadioGroup(props: RadioGroupProps): ReactElement {
    let {
      value: value,
      defaultValue: defaultValue,
      onChange: onChange,
      options: options,
      disabled: disabled,
      size: size,
      name: name,
      className: className,
    } = props;
    return jsxForUiTabs4.jsx(runtime.baseRadioGroup, {
      "data-cds": "RadioGroup",
      value: value,
      defaultValue: defaultValue,
      onValueChange: onChange
        ? (input: string) => onChange(input)
        : undefined,
      disabled: disabled,
      name: name,
      ...(0, runtime.getControlSizeAttributes)(size),
      className: (0, runtime.cn)("flex flex-col gap-2 font-sans", className),
      children: options.map(
        (input: RadioGroupOption) =>
          jsxForUiTabs4.jsx(
            RadioGroupItem,
            {
              value: input.value,
              label: input.label,
              description: input.description,
              disabled: input.disabled,
            },
            input.value,
          ),
      ),
    });
  }
  bindRuntimeValue(
    runtime,
    "isUnwrappedHorizontalFlex",
    () => isUnwrappedHorizontalFlex,
  );
  bindRuntimeValue(runtime, "getInnerElementWidth", () => getInnerElementWidth);
  bindRuntimeValue(runtime, "getTabOverflowWidth", () => getTabOverflowWidth);
  bindRuntimeValue(
    runtime,
    "measureVisibleSiblingWidth",
    () => measureVisibleSiblingWidth,
  );
  bindRuntimeValue(
    runtime,
    "applyTabFlexCorrection",
    () => applyTabFlexCorrection,
  );
  bindRuntimeValue(runtime, "parsePixelCssValue", () => parsePixelCssValue);
  bindRuntimeValue(
    runtime,
    "measureTabStripContents",
    () => measureTabStripContents,
  );
  bindRuntimeValue(
    runtime,
    "checkedTabFlexDocuments",
    () => checkedTabFlexDocuments,
    (value) => {
      checkedTabFlexDocuments = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs",
    () => initializeUiTabs,
    (value) => {
      initializeUiTabs = value;
    },
  );
  bindRuntimeValue(runtime, "ButtonGroup", () => ButtonGroup);
  bindRuntimeValue(
    runtime,
    "elementHasDisplayName",
    () => elementHasDisplayName,
  );
  bindRuntimeValue(
    runtime,
    "elementHasComponentType",
    () => elementHasComponentType,
  );
  bindRuntimeValue(
    runtime,
    "flattenButtonGroupChildren",
    () => flattenButtonGroupChildren,
  );
  bindRuntimeValue(
    runtime,
    "classifyButtonGroupChildren",
    () => classifyButtonGroupChildren,
  );
  bindRuntimeValue(
    runtime,
    "buttonGroupDiagnosticNoop",
    () => buttonGroupDiagnosticNoop,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiTabs",
    () => reactForUiTabs,
    (value) => {
      reactForUiTabs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs",
    () => jsxForUiTabs,
    (value) => {
      jsxForUiTabs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs2",
    () => initializeUiTabs2,
    (value) => {
      initializeUiTabs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiTabs2",
    () => reactForUiTabs2,
    (value) => {
      reactForUiTabs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs2",
    () => jsxForUiTabs2,
    (value) => {
      jsxForUiTabs2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FORM_SIZE_GAP_CLASSES",
    () => FORM_SIZE_GAP_CLASSES,
    (value) => {
      FORM_SIZE_GAP_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Form",
    () => Form,
    (value) => {
      Form = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs3",
    () => initializeUiTabs3,
    (value) => {
      initializeUiTabs3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventRepeatedSwitchEnter",
    () => preventRepeatedSwitchEnter,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiTabs3",
    () => reactForUiTabs3,
    (value) => {
      reactForUiTabs3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs3",
    () => jsxForUiTabs3,
    (value) => {
      jsxForUiTabs3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_TRACK_CLASS",
    () => SWITCH_TRACK_CLASS,
    (value) => {
      SWITCH_TRACK_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_THUMB_CLASS",
    () => SWITCH_THUMB_CLASS,
    (value) => {
      SWITCH_THUMB_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_TRACK_SIZE_CLASS",
    () => SWITCH_TRACK_SIZE_CLASS,
    (value) => {
      SWITCH_TRACK_SIZE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SWITCH_THUMB_SIZE_CLASS",
    () => SWITCH_THUMB_SIZE_CLASS,
    (value) => {
      SWITCH_THUMB_SIZE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Switch",
    () => Switch,
    (value) => {
      Switch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs4",
    () => initializeUiTabs4,
    (value) => {
      initializeUiTabs4 = value;
    },
  );
  bindRuntimeValue(runtime, "RadioMark", () => RadioMark);
  bindRuntimeValue(runtime, "RadioGroup", () => RadioGroup);
  bindRuntimeValue(
    runtime,
    "reactForUiTabs4",
    () => reactForUiTabs4,
    (value) => {
      reactForUiTabs4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs4",
    () => jsxForUiTabs4,
    (value) => {
      jsxForUiTabs4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RADIO_MARK_CLASS",
    () => RADIO_MARK_CLASS,
    (value) => {
      RADIO_MARK_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RadioGroupItem",
    () => RadioGroupItem,
    (value) => {
      RadioGroupItem = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RADIO_ITEM_CLASS",
    () => RADIO_ITEM_CLASS,
    (value) => {
      RADIO_ITEM_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RadioGroupCard",
    () => RadioGroupCard,
    (value) => {
      RadioGroupCard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RadioGroupRoot",
    () => RadioGroupRoot,
    (value) => {
      RadioGroupRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RADIO_CARD_CLASS",
    () => RADIO_CARD_CLASS,
    (value) => {
      RADIO_CARD_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs5",
    () => initializeUiTabs5,
    (value) => {
      initializeUiTabs5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactForUiTabs5",
    () => reactForUiTabs5,
    (value) => {
      reactForUiTabs5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiTabs5",
    () => jsxForUiTabs5,
    (value) => {
      jsxForUiTabs5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_DRAG_TOLERANCE",
    () => RESIZE_HANDLE_DRAG_TOLERANCE,
    (value) => {
      RESIZE_HANDLE_DRAG_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_KEY_STEP",
    () => RESIZE_HANDLE_KEY_STEP,
    (value) => {
      RESIZE_HANDLE_KEY_STEP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_SHIFT_KEY_STEP",
    () => RESIZE_HANDLE_SHIFT_KEY_STEP,
    (value) => {
      RESIZE_HANDLE_SHIFT_KEY_STEP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESIZE_HANDLE_SIDE_CLASSES",
    () => RESIZE_HANDLE_SIDE_CLASSES,
    (value) => {
      RESIZE_HANDLE_SIDE_CLASSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ResizeHandle",
    () => ResizeHandle,
    (value) => {
      ResizeHandle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiTabs6",
    () => initializeUiTabs6,
    (value) => {
      initializeUiTabs6 = value;
    },
  );
  return () => {
    initializeUiTabs = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeElementNamespaces)();
      checkedTabFlexDocuments = new WeakSet();
    });
    initializeUiTabs2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeResizeObserverAccess)();
      (0, runtime.initializeElementNamespaces)();
      (0, runtime.initializeUiDisclosure9)();
      initializeUiTabs();
      (0, runtime.initializeUiDialog2)();
      (0, runtime.initializeUiDialog3)();
      reactForUiTabs = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTabs = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      (ButtonGroup as typeof ButtonGroup & NamedComponent).displayName =
        "ButtonGroup";
    });
    initializeUiTabs3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeNpmDependency)();
      reactForUiTabs2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTabs2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      FORM_SIZE_GAP_CLASSES = {
        xs: "gap-sm",
        sm: "gap-sm",
        base: "gap-md",
        lg: "gap-lg",
      };
      Form = reactForUiTabs2.forwardRef<HTMLFormElement, FormProps>(
        (
          {
            className: className,
            submitOnModEnter = true,
            disabled: disabled,
            size: size,
            method: method,
            onSubmit: onSubmit,
            onKeyDown: onKeyDown,
            ...props
          },
          options,
        ) =>
          jsxForUiTabs2.jsx(runtime.baseFieldsetRoot, {
            ref: options,
            "data-cds": "Form",
            "data-disabled": disabled ? "" : undefined,
            ...(0, runtime.getControlSizeAttributes)(size),
            method: method,
            ...props,
            className: (0, runtime.cn)(
              "flex flex-col",
              FORM_SIZE_GAP_CLASSES[size ?? "base"],
              className,
            ),
            onSubmit: (event: ReactSubmitEvent<HTMLFormElement>): void => {
              if (!method) {
                event.preventDefault();
              }
              if (disabled) {
                event.preventDefault();
                return;
              }
              onSubmit?.(event);
            },
            onKeyDown: (event: ReactKeyboardEvent<HTMLFormElement>) => {
              onKeyDown?.(event);
              if (
                submitOnModEnter &&
                !event.defaultPrevented &&
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!disabled) {
                  event.currentTarget.requestSubmit();
                }
              }
            },
          }),
      );
      Form.displayName = "Form";
    });
    SWITCH_TRACK_CLASS =
      "cds-reset relative inline-flex shrink-0 rounded-full border-0 outline-none focus-visible:outline-hidden bg-[var(--cds-switch-track)] hover:bg-[var(--cds-switch-track-hover)] data-[checked]:bg-fill-accent data-[checked]:hover:bg-fill-accent-hover data-[disabled]:opacity-disabled data-[disabled]:hover:bg-[var(--cds-switch-track)] data-[checked]:data-[disabled]:hover:bg-fill-accent focus-visible:shadow-focus";
    SWITCH_THUMB_CLASS =
      "block rounded-full bg-[var(--cds-switch-knob)] shadow-sm transition-transform duration-snap ease-overshoot motion-reduce:transition-none";
    SWITCH_TRACK_SIZE_CLASS =
      "h-[var(--cds-switch-h)] w-[calc(var(--cds-switch-h,1.25rem)*1.8)] p-[2px]";
    SWITCH_THUMB_SIZE_CLASS =
      "size-[calc(var(--cds-switch-h,1.25rem)-4px)] data-[checked]:translate-x-[calc(var(--cds-switch-h,1.25rem)*0.8)]";
    initializeUiTabs4 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeUiDisclosure)();
      (0, runtime.initializeTooltip)();
      (0, runtime.initializeNpmDependency)();
      reactForUiTabs3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTabs3 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      Switch = reactForUiTabs3.forwardRef<HTMLButtonElement, SwitchProps>(
        (
          {
            className: className,
            size: size,
            disabledReason: disabledReason,
            disabledReasonSide: disabledReasonSide,
            onKeyDown: onKeyDown,
            onMouseDown: onMouseDown,
            ...props
          },
          options,
        ) => {
          let value = jsxForUiTabs3.jsx(runtime.baseSwitch.Root, {
            ref: options,
            "data-cds": "Switch",
            ...props,
            ...(0, runtime.getControlSizeAttributes)(size),
            onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
              onMouseDown,
            ),
            onKeyDown: (input: ReactKeyboardEvent<HTMLButtonElement>) => {
              preventRepeatedSwitchEnter(input);
              onKeyDown?.(input);
            },
            className: (0, runtime.cn)(
              SWITCH_TRACK_CLASS,
              SWITCH_TRACK_SIZE_CLASS,
              className,
            ),
            children: jsxForUiTabs3.jsx(runtime.baseSwitch.Thumb, {
              className: `${SWITCH_THUMB_CLASS} ${SWITCH_THUMB_SIZE_CLASS}`,
            }),
          });
          if (disabledReason === undefined) {
            return value;
          }
          return jsxForUiTabs3.jsx(runtime.DisabledReasonTooltip, {
            side: disabledReasonSide,
            reason: props.disabled ? disabledReason : undefined,
            children: value,
          });
        },
      );
      Switch.displayName = "Switch";
    });
    RADIO_MARK_CLASS =
      "flex shrink-0 size-[var(--cds-checkbox)] items-center justify-center rounded-full border border-strong bg-transparent group-hover/rd:border-stronger group-data-[checked]/rd:bg-fill-accent group-data-[checked]/rd:border-0 group-data-[checked]/rd:group-hover/rd:bg-fill-accent-hover group-data-[disabled]/rd:group-hover/rd:border-strong";
    RADIO_ITEM_CLASS =
      "cds-reset group/rd flex w-full items-start gap-md rounded-card border bg-surface-1 p-md text-start text-body font-normal text-primary outline-none focus-visible:outline-hidden hover:border-strong focus-visible:shadow-focus data-[checked]:border-accent data-[checked]:bg-[var(--cds-radio-group-card-selected)] data-[checked]:hover:border-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-disabled";
    initializeUiTabs5 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeUiDisclosure)();
      (0, runtime.initializeUiMenu)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      (0, runtime.initializeNpmDependency)();
      reactForUiTabs4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTabs4 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      RadioGroupItem = reactForUiTabs4.forwardRef<
        HTMLButtonElement,
        RadioGroupItemProps
      >(
        (
          {
            value: value,
            label: label,
            description: description,
            disabled: disabled,
            className: className,
          },
          options,
        ) => {
          let value2 = (0, runtime.useHasFieldContext)(),
            value3 = reactForUiTabs4.useId(),
            value4 = reactForUiTabs4.useId(),
            value5 = jsxForUiTabs4.jsxs(runtime.baseRadio.Root, {
              ref: options,
              value: value,
              disabled: disabled,
              "aria-labelledby": value3,
              "aria-describedby": description ? value4 : undefined,
              onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
                undefined,
              ),
              className: (0, runtime.cn)(
                "cds-reset group/rd inline-flex",
                description ? "items-start" : "items-center",
                "gap-2 border-0 outline-none focus-visible:outline-hidden text-start text-body font-normal text-primary data-[disabled]:opacity-disabled",
                className,
              ),
              children: [
                jsxForUiTabs4.jsx(RadioMark, {
                  focusRing: true,
                  topAlign: !!description,
                }),
                jsxForUiTabs4.jsxs("span", {
                  className: "flex min-w-0 flex-col",
                  children: [
                    jsxForUiTabs4.jsx("span", {
                      id: value3,
                      children: label,
                    }),
                    description &&
                      jsxForUiTabs4.jsx("span", {
                        id: value4,
                        className: "text-footnote leading-snug text-muted",
                        children: description,
                      }),
                  ],
                }),
              ],
            });
          if (value2) {
            return jsxForUiTabs4.jsx(runtime.baseLabelableProvider, {
              children: value5,
            });
          } else {
            return value5;
          }
        },
      );
      RadioGroupItem.displayName = "RadioGroup.Item";
      RadioGroupCard = reactForUiTabs4.forwardRef<
        HTMLButtonElement,
        RadioGroupCardProps
      >(
        (
          {
            value: value,
            label: label,
            description: description,
            leading: leading,
            trailing: trailing,
            children: children,
            disabled: disabled,
            className: className,
          },
          options,
        ) => {
          let value2 = (0, runtime.useHasFieldContext)(),
            value3 = reactForUiTabs4.useId(),
            value4 = reactForUiTabs4.useId(),
            value5 = jsxForUiTabs4.jsxs(runtime.baseRadio.Root, {
              ref: options,
              value: value,
              disabled: disabled,
              "aria-labelledby": value3,
              "aria-describedby": description ? value4 : undefined,
              onMouseDown: (0, runtime.withRepeatedClickSelectionPrevention)(
                undefined,
              ),
              className: (0, runtime.cn)(RADIO_ITEM_CLASS, className),
              children: [
                jsxForUiTabs4.jsx(RadioMark, {
                  topAlign: true,
                }),
                leading
                  ? jsxForUiTabs4.jsx("span", {
                      className: "shrink-0",
                      children: leading,
                    })
                  : null,
                jsxForUiTabs4.jsxs("span", {
                  className: "flex min-w-0 flex-1 flex-col gap-xs",
                  children: [
                    jsxForUiTabs4.jsxs("span", {
                      className: "flex min-w-0 flex-col",
                      children: [
                        jsxForUiTabs4.jsxs("span", {
                          className: "flex items-start justify-between gap-sm",
                          children: [
                            jsxForUiTabs4.jsx("span", {
                              id: value3,
                              className: "min-w-0 font-medium",
                              children: label,
                            }),
                            trailing
                              ? jsxForUiTabs4.jsx("span", {
                                  className: "shrink-0",
                                  children: trailing,
                                })
                              : null,
                          ],
                        }),
                        description &&
                          jsxForUiTabs4.jsx("span", {
                            id: value4,
                            className: "text-footnote leading-snug text-muted",
                            children: description,
                          }),
                      ],
                    }),
                    children,
                  ],
                }),
              ],
            });
          if (value2) {
            return jsxForUiTabs4.jsx(runtime.baseLabelableProvider, {
              children: value5,
            });
          } else {
            return value5;
          }
        },
      );
      RadioGroupCard.displayName = "RadioGroup.Card";
      (RadioGroup as typeof RadioGroup & NamedComponent).displayName =
        "RadioGroup";
      RadioGroupRoot = reactForUiTabs4.forwardRef<
        HTMLDivElement,
        RadioGroupRootProps
      >(
        (
          { className: className, size: size, ...props },
          options,
        ) =>
          jsxForUiTabs4.jsx(runtime.baseRadioGroup, {
            "data-cds": "RadioGroup",
            ref: options,
            ...props,
            ...(0, runtime.getControlSizeAttributes)(size),
            className: (0, runtime.cn)(
              "flex flex-col gap-2 font-sans",
              className,
            ),
          }),
      );
      RadioGroupRoot.displayName = "RadioGroup.Root";
      RADIO_CARD_CLASS = Object.assign(RadioGroup, {
        Root: RadioGroupRoot,
        Item: RadioGroupItem,
        Card: RadioGroupCard,
      });
    });
    RESIZE_HANDLE_DRAG_TOLERANCE = 3;
    RESIZE_HANDLE_KEY_STEP = 8;
    RESIZE_HANDLE_SHIFT_KEY_STEP = 32;
    initializeUiTabs6 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeIsomorphicLayoutEffect)();
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeNpmDependency)();
      reactForUiTabs5 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiTabs5 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      RESIZE_HANDLE_SIDE_CLASSES = {
        "inline-start":
          "inset-y-0 start-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
        "inline-end":
          "inset-y-0 end-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
        top: "inset-x-0 top-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
        bottom:
          "inset-x-0 bottom-[calc(-6px_-_(var(--cds-ring-outer,0px)_-_var(--cds-ring-inner,0px))_/_2)]",
      };
      ResizeHandle = reactForUiTabs5.forwardRef<
        HTMLDivElement,
        ResizeHandleProps
      >(function (
        {
          orientation = "vertical",
          side: side,
          onResize: onResize,
          onResizeStart: onResizeStart,
          onResizeEnd: onResizeEnd,
          onMouseDown: onMouseDown,
          onKeyDown: onKeyDown,
          className: className,
          ...props
        },
        options,
      ) {
        let value =
            side === undefined
              ? orientation === "vertical"
              : side === "inline-start" || side === "inline-end",
          [value2, value3] = reactForUiTabs5.useState(false),
          ref = reactForUiTabs5.useRef<Document | null>(null),
          ref2 = reactForUiTabs5.useRef(onResize),
          ref3 = reactForUiTabs5.useRef(onResizeStart),
          ref4 = reactForUiTabs5.useRef(onResizeEnd);
        (0, runtime.useIsomorphicLayoutEffect)(() => {
          ref2.current = onResize;
          ref3.current = onResizeStart;
          ref4.current = onResizeEnd;
        }, [onResize, onResizeStart, onResizeEnd]);
        let ref5 = reactForUiTabs5.useRef(0),
          ref6 = reactForUiTabs5.useRef(false),
          ref7 = reactForUiTabs5.useRef(true),
          callback = reactForUiTabs5.useCallback((): void => {
            if (ref7.current) {
              return;
            }
            ref7.current = true;
            value3(false);
            ref4.current?.(ref6.current);
          }, []);
        reactForUiTabs5.useEffect(() => {
          let current = ref.current;
          if (!value2 || current === null) {
            return;
          }
          let callback4 = (input: MouseEvent): void => {
              let value4 =
                (value ? input.clientX : input.clientY) - ref5.current;
              if (Math.abs(value4) > RESIZE_HANDLE_DRAG_TOLERANCE) {
                ref6.current = true;
              }
              ref2.current(value4);
            },
            style = current.body.style;
          style.cursor = value ? "col-resize" : "row-resize";
          style.userSelect = "none";
          current.addEventListener("mousemove", callback4);
          current.addEventListener("mouseup", callback);
          return () => {
            current.removeEventListener("mousemove", callback4);
            current.removeEventListener("mouseup", callback);
            style.cursor = "";
            style.userSelect = "";
          };
        }, [value2, value, callback]);
        reactForUiTabs5.useEffect(() => callback, [callback]);
        let callback2 = (event: ReactMouseEvent<HTMLDivElement>): void => {
            if (event.button === 0) {
              event.preventDefault();
              ref5.current = value ? event.clientX : event.clientY;
              ref6.current = false;
              ref7.current = false;
              ref.current = event.currentTarget.ownerDocument;
              value3(true);
              ref3.current?.();
            }
            onMouseDown?.(event);
          },
          callback3 = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              !ref7.current
            ) {
              return;
            }
            if (
              (event.key === "Enter" || event.key === " ") &&
              !event.shiftKey
            ) {
              event.preventDefault();
              if (event.repeat) {
                return;
              }
              ref3.current?.();
              ref4.current?.(false);
              return;
            }
            let value4 = event.shiftKey
                ? RESIZE_HANDLE_SHIFT_KEY_STEP
                : RESIZE_HANDLE_KEY_STEP,
              [value5, value6] = value
                ? ["ArrowLeft", "ArrowRight"]
                : ["ArrowUp", "ArrowDown"],
              value7 =
                event.key === value5
                  ? -value4
                  : event.key === value6
                    ? value4
                    : 0;
            if (value7 === 0) {
              return;
            }
            event.preventDefault();
            ref3.current?.();
            ref2.current(value7);
            ref4.current?.(true);
          };
        return jsxForUiTabs5.jsxs("div", {
          ...props,
          ref: options,
          "data-cds": "ResizeHandle",
          role: "separator",
          "aria-orientation": value ? "vertical" : "horizontal",
          tabIndex: 0,
          "data-dragging": value2 ? "" : undefined,
          onMouseDown: callback2,
          onKeyDown: (input: ReactKeyboardEvent<HTMLDivElement>) => {
            callback3(input);
            onKeyDown?.(input);
          },
          className: (0, runtime.cn)(
            "cds-reset group/resize outline-none focus-visible:outline-hidden",
            value ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize",
            side === undefined
              ? ["relative", value ? "h-full" : "w-full"]
              : ["absolute", RESIZE_HANDLE_SIDE_CLASSES[side]],
            className,
          ),
          children: [
            jsxForUiTabs5.jsx("div", {
              "aria-hidden": true,
              className: (0, runtime.clsx)(
                "absolute rounded-full transition-shadow duration-fast group-focus-visible/resize:shadow-focus",
                value
                  ? "inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize"
                  : "inset-x-0 top-1/2 h-3 -translate-y-1/2 cursor-row-resize",
              ),
            }),
            jsxForUiTabs5.jsx("div", {
              "aria-hidden": true,
              "data-cds-part": "resize-pill",
              className: (0, runtime.clsx)(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-[opacity,color,background-color]",
                value
                  ? "h-full max-h-12 w-[3px] group-focus-visible/resize:max-h-none"
                  : "h-[3px] w-full max-w-12 group-focus-visible/resize:max-w-none",
                value2
                  ? "text-secondary opacity-100 duration-snap"
                  : "text-muted opacity-[var(--cds-resize-pill-force,0)] delay-200 duration-base group-hover/resize:opacity-100",
                "group-focus-visible/resize:bg-fill-accent group-focus-visible/resize:opacity-100 group-focus-visible/resize:delay-0",
              ),
            }),
          ],
        });
      });
    });
  };
}

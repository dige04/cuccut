/** Restored application module; prepare first, initialize in original order. */
import type {
  ButtonHTMLAttributes,
  ForwardRefExoticComponent,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  RefAttributes,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** One entry of the "add" menu of a property section. */
export interface PropertySectionAddItem {
  label: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** Why the entry is unavailable; shown as a tooltip while it is disabled. */
  disabledReason?: string;
  description?: ReactNode;
}
export interface PropertySectionActionsProps {
  /** Section title the default "Add to ..." label is built from. */
  section?: string;
  "aria-label"?: string;
  items: PropertySectionAddItem[];
  align?: "start" | "center" | "end";
  disabled?: boolean;
  /** Controlled open state; omit to let the menu manage it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  "data-testid"?: string;
}
export interface PropertyColorPreviewProps
  extends HTMLAttributes<HTMLSpanElement> {
  /** CSS background of the swatch; shown over a checkerboard. */
  background?: string;
}
/** One entry of the "more actions" menu at the end of a property row. */
export interface PropertyRowAction {
  label: ReactNode;
  onSelect?: () => void;
  variant?: "danger";
  disabled?: boolean;
  separatorBefore?: boolean;
}
export interface PropertyRowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label?: ReactNode;
  children?: ReactNode;
  /** Shows a reset button next to the label. */
  onReset?: () => void;
  resetLabel?: string;
  /** Hidden description wired to the row's controls through aria-describedby. */
  description?: ReactNode;
  /** Called with the row when the label area or empty space is pressed. */
  onPress?: (row: HTMLElement) => void;
  disabled?: boolean;
  labelProps?: HTMLAttributes<HTMLSpanElement>;
  actions?: PropertyRowAction[];
  actionsLabel?: string;
  defaultActionsOpen?: boolean;
  trailing?: ReactNode;
}
export interface PropertySectionHeaderProps {
  title?: ReactNode;
  actions?: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  subsection?: boolean;
  className?: string;
}
export interface PropertySectionProps {
  title?: ReactNode;
  addItems?: PropertySectionAddItem[];
  addLabel?: string;
  defaultAddOpen?: boolean;
  actions?: ReactNode;
  action?: ReactNode;
  /** Controlled collapsed state; takes precedence over `collapsible`. */
  collapsed?: boolean;
  onToggle?: () => void;
  /** Uncontrolled collapsing through the title. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  subsection?: boolean;
  iconColumn?: boolean;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}
export interface FieldButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading chip (such as a swatch) that switches the field to the placeholder style. */
  chip?: ReactNode;
  caption?: ReactNode;
  muted?: boolean;
  trailing?: ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    propertyRowPressShouldIgnore: (row: Element, target: Element) => boolean;
    PROPERTY_ROW_INTERACTIVE_SELECTOR: string;
    initializeUiPropertyRow: () => void;
    PropertySectionActions: (
      props: PropertySectionActionsProps,
    ) => ReactElement | null;
    reactForUiPropertyRow: ReactNamespace;
    jsxForUiPropertyRow: JsxNamespace;
    initializeUiPropertyRow2: () => void;
    PropertyColorPreview: (props: PropertyColorPreviewProps) => ReactElement;
    PropertyRow: (props: PropertyRowProps) => ReactElement | null;
    PropertySectionHeader: (props: PropertySectionHeaderProps) => ReactElement;
    warnMixedSectionCollapseControl: () => void;
    warnUntitledCollapsibleSection: () => void;
    PropertySection: (props: PropertySectionProps) => ReactElement;
    reactForUiPropertyRow2: ReactNamespace;
    jsxForUiPropertyRow2: JsxNamespace;
    PROPERTY_INPUT_SURFACE_CLASS: string;
    PROPERTY_INPUT_CLASS: string;
    PROPERTY_PLACEHOLDER_CLASS: string;
    COLOR_SWATCH_CLASS: string;
    FieldButton: ForwardRefExoticComponent<
      FieldButtonProps & RefAttributes<HTMLButtonElement>
    >;
    PROPERTY_SECTION_GUTTER_CLASS: string;
    PROPERTY_ACTIONS_CLASS: string;
    mixedSectionCollapseWarningShown: boolean;
    untitledSectionCollapseWarningShown: boolean;
    initializeUiPropertyRow3: () => void;
  }
}

export function installUiPropertyRow(runtime: RuntimeBindings): () => void {
  var PROPERTY_ROW_INTERACTIVE_SELECTOR: string;
  var initializeUiPropertyRow: () => void;
  var reactForUiPropertyRow: ReactNamespace;
  var jsxForUiPropertyRow: JsxNamespace;
  var initializeUiPropertyRow2: () => void;
  var reactForUiPropertyRow2: ReactNamespace;
  var jsxForUiPropertyRow2: JsxNamespace;
  var PROPERTY_INPUT_SURFACE_CLASS: string;
  var PROPERTY_INPUT_CLASS: string;
  var PROPERTY_PLACEHOLDER_CLASS: string;
  var COLOR_SWATCH_CLASS: string;
  var FieldButton: RuntimeBindings["FieldButton"];
  var PROPERTY_SECTION_GUTTER_CLASS: string;
  var PROPERTY_ACTIONS_CLASS: string;
  var mixedSectionCollapseWarningShown: boolean;
  var untitledSectionCollapseWarningShown: boolean;
  var initializeUiPropertyRow3: () => void;
  function propertyRowPressShouldIgnore(
    row: Element,
    target: Element,
  ): boolean {
    if (target.closest(PROPERTY_ROW_INTERACTIVE_SELECTOR)) {
      return true;
    }
    if (target.closest('[data-kit="row-trailing"]')) {
      return true;
    }
    if (target.closest("[data-mc-scrim], [data-base-ui-inert]")) {
      return true;
    }
    let ancestor = target.closest(runtime.OPEN_OVERLAY_SELECTOR);
    return ancestor !== null && !ancestor.contains(row);
  }
  function PropertySectionActions({
    section: section,
    "aria-label": ariaLabel,
    items: items,
    align = "end",
    disabled: disabled,
    open: open,
    onOpenChange: onOpenChange,
    defaultOpen = false,
    "data-testid": dataTestid,
  }: PropertySectionActionsProps): ReactElement | null {
    let [value, value2] = reactForUiPropertyRow.useState(defaultOpen),
      value3 = open !== undefined;
    if (items.length === 0) {
      if (!value3 && value) {
        value2(false);
      }
      return null;
    }
    let value4 =
        ariaLabel ??
        (section !== undefined && section !== ""
          ? (0, runtime.addToSectionLabel)(section)
          : runtime.ADD_LABEL),
      value5 = jsxForUiPropertyRow.jsx(runtime.Menu, {
        iconOnly: true,
        icon: "Add",
        variant: "ghost",
        "aria-label": value4,
        tooltip: value4,
        disabled: disabled,
        align: align,
        open: value3 ? open : value,
        onOpenChange: (input: boolean) => {
          if (!value3) {
            value2(input);
          }
          onOpenChange?.(input);
        },
        items: items.map((input: PropertySectionAddItem) => {
          let value6 =
            input.disabledReason !== undefined && input.disabledReason !== "";
          return {
            label: input.label,
            onSelect: input.onSelect,
            disabled: input.disabled === true || value6,
            disabledReason: value6 ? input.disabledReason : undefined,
            description: input.description,
          };
        }),
      });
    if (dataTestid === undefined) {
      return value5;
    } else {
      return jsxForUiPropertyRow.jsx("span", {
        "data-testid": dataTestid,
        className: "inline-flex",
        children: value5,
      });
    }
  }
  function PropertyColorPreview({
    background: background,
    className: className,
    children: children,
    ...remainingProps
  }: PropertyColorPreviewProps): ReactElement {
    return jsxForUiPropertyRow2.jsxs("span", {
      "aria-hidden": "true",
      ...remainingProps,
      className: (0, runtime.joinClassNames)(COLOR_SWATCH_CLASS, className),
      children: [
        background !== undefined
          ? jsxForUiPropertyRow2.jsx("span", {
              className: "absolute inset-0",
              style: {
                background: background,
              },
            })
          : null,
        children,
      ],
    });
  }
  function PropertyRow({
    label: label,
    children: children,
    onReset: onReset,
    resetLabel: resetLabel,
    description: description,
    onPress: onPress,
    disabled: disabled,
    title: title,
    labelProps: labelProps,
    actions: actions,
    actionsLabel = runtime.MORE_ACTIONS_LABEL,
    defaultActionsOpen = false,
    trailing: trailing,
    className: className,
    ...remainingProps
  }: PropertyRowProps): ReactElement | null {
    let value = typeof label === "string" ? label : undefined,
      ref = reactForUiPropertyRow2.useRef<HTMLDivElement>(null),
      value2 = reactForUiPropertyRow2.useId(),
      ref2 = reactForUiPropertyRow2.useRef(false);
    reactForUiPropertyRow2.useLayoutEffect(() => {
      if (!description && !ref2.current) {
        return;
      }
      let current = ref.current;
      if (!current) {
        return;
      }
      let value6 = current.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, [role="combobox"], [role="radiogroup"], [role="switch"], button[aria-haspopup], button[aria-expanded]',
      );
      for (let value7 of value6) {
        let value8 = (value7.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter((input: string) => input && input !== value2);
        if (description) {
          value8.push(value2);
        }
        if (value8.length > 0) {
          value7.setAttribute("aria-describedby", value8.join(" "));
        } else {
          value7.removeAttribute("aria-describedby");
        }
      }
      ref2.current = !!description;
    });
    let [value3, value4] =
        reactForUiPropertyRow2.useState(defaultActionsOpen),
      value5 =
        actions !== undefined && actions.length > 0 ? actions : undefined;
    if (value5 === undefined && value3) {
      value4(false);
    }
    let ref3 = reactForUiPropertyRow2.useRef(false);
    return jsxForUiPropertyRow2.jsxs("div", {
      "data-property-row": "",
      ...remainingProps,
      title: title,
      onClick:
        onPress && !disabled
          ? (event: ReactMouseEvent<HTMLElement> & { target: Element }) => {
              if (
                propertyRowPressShouldIgnore(event.currentTarget, event.target)
              ) {
                return;
              }
              onPress(event.currentTarget);
            }
          : undefined,
      className: (0, runtime.joinClassNames)(
        "group/row grid min-w-0 shrink-0 items-center gap-x-sm py-px",
        PROPERTY_SECTION_GUTTER_CLASS,
        label !== undefined
          ? "grid-cols-[var(--pp-label-w,80px)_minmax(0,1fr)] pointer-coarse:grid-cols-[calc(var(--pp-label-w,80px)*13/12)_minmax(0,1fr)]"
          : "grid-cols-[minmax(0,1fr)]",
        "min-h-[var(--prop-row-h,32px)] pointer-coarse:min-h-[var(--prop-row-h,40px)]",
        disabled && "cursor-not-allowed",
        className,
      ),
      children: [
        label !== undefined &&
          jsxForUiPropertyRow2.jsxs("div", {
            className: (0, runtime.joinClassNames)(
              "flex min-w-0 items-center",
              disabled && "opacity-50",
            ),
            children: [
              jsxForUiPropertyRow2.jsx("span", {
                title: title === undefined ? value : undefined,
                ...labelProps,
                className: (0, runtime.joinClassNames)(
                  "min-w-0 truncate text-footnote text-muted select-none",
                  labelProps?.className,
                ),
                children: label,
              }),
              onReset &&
                !disabled &&
                jsxForUiPropertyRow2.jsx("span", {
                  className: (0, runtime.joinClassNames)(
                    "flex w-0 shrink-0 overflow-hidden",
                    "focus-within:w-auto focus-within:overflow-visible",
                    "group-hover/row:w-auto group-hover/row:overflow-visible",
                    "pointer-coarse:w-auto pointer-coarse:overflow-visible",
                  ),
                  children: jsxForUiPropertyRow2.jsx(runtime.Button, {
                    variant: "ghost",
                    size: "xs",
                    iconOnly: true,
                    icon: "ArrowCounterClockwise",
                    "aria-label":
                      resetLabel ??
                      (value
                        ? runtime.RESET_LABEL + " " + value
                        : runtime.RESET_LABEL),
                    tooltipSide: "left",
                    disabled: disabled,
                    onPointerDown: (input: PointerEvent) => {
                      ref3.current = input.pointerType === "touch";
                    },
                    onClick: (input: ReactMouseEvent<HTMLElement>) => {
                      let value6 = input.currentTarget
                          .closest("[data-property-row]")
                          ?.querySelector<HTMLElement>(
                            'input, button:not([data-kit="row-reset"]), [tabindex="0"]',
                          ),
                        current = ref3.current;
                      ref3.current = false;
                      let value7 =
                        value6?.matches("input, textarea, [contenteditable]") ??
                        false;
                      if (value6 && !(current && value7)) {
                        value6.focus();
                      }
                      onReset();
                    },
                    "data-kit": "row-reset",
                    className: "ml-xs shrink-0",
                  }),
                }),
            ],
          }),
        jsxForUiPropertyRow2.jsxs("div", {
          ref: ref,
          className: (0, runtime.joinClassNames)(
            "flex min-w-0 items-center gap-2",
            trailing === undefined &&
              "pr-[calc(var(--pp-iconcol,-4px)+4px)] pointer-coarse:pr-[calc(var(--pp-iconcol,-8px)+8px)]",
          ),
          children: [
            children,
            description
              ? jsxForUiPropertyRow2.jsx("span", {
                  id: value2,
                  hidden: true,
                  "data-kit": "row-description",
                  children: description,
                })
              : null,
            value5 !== undefined
              ? jsxForUiPropertyRow2.jsx(runtime.Menu, {
                  iconOnly: true,
                  icon: "DotsHorizontal",
                  variant: "ghost",
                  "aria-label": actionsLabel,
                  tooltip: actionsLabel,
                  align: "end",
                  disabled: disabled,
                  open: value3,
                  onOpenChange: value4,
                  items: value5.map(
                    (input: PropertyRowAction) => ({
                      label: input.label,
                      onSelect: input.onSelect,
                      variant: input.variant,
                      disabled: input.disabled,
                      separatorBefore: input.separatorBefore,
                    }),
                  ),
                  className: "-ml-1 pointer-coarse:ml-0 shrink-0",
                })
              : null,
            trailing !== undefined
              ? jsxForUiPropertyRow2.jsx("span", {
                  "data-kit": "row-trailing",
                  className: (0, runtime.joinClassNames)(
                    "-ml-1 pointer-coarse:ml-0 flex w-[var(--pp-iconcol,auto)] shrink-0 items-center justify-center",
                    PROPERTY_ACTIONS_CLASS,
                  ),
                  children: trailing,
                })
              : null,
          ],
        }),
      ],
    });
  }
  function PropertySectionHeader({
    title: title,
    actions: actions,
    collapsed: collapsed,
    onToggle: onToggle,
    subsection: subsection,
    className: className,
  }: PropertySectionHeaderProps): ReactElement {
    let value = onToggle !== undefined,
      value2 = (0, runtime.joinClassNames)(
        "flex min-w-0 shrink-0 items-center gap-xs select-none",
        PROPERTY_SECTION_GUTTER_CLASS,
        subsection
          ? "pt-2 pb-1 text-footnote font-semibold text-secondary"
          : "min-h-10 border-t border-alpha-2 py-2 text-body-semibold text-primary first:border-t-0",
        className,
      ),
      value3 = value
        ? jsxForUiPropertyRow2.jsx("span", {
            "aria-hidden": "true",
            className:
              "-my-1 flex size-control shrink-0 items-center justify-center",
            children: jsxForUiPropertyRow2.jsx(runtime.KitIcon, {
              name: "CaretRight",
              size: 16,
              className: (0, runtime.joinClassNames)(
                "text-secondary transition-transform duration-fast",
                !collapsed && "rotate-90",
              ),
            }),
          })
        : null;
    if (value && !actions) {
      return jsxForUiPropertyRow2.jsx("h3", {
        className: "contents",
        children: jsxForUiPropertyRow2.jsxs("button", {
          type: "button",
          "aria-expanded": !collapsed,
          onClick: onToggle,
          className: (0, runtime.joinClassNames)(
            value2,
            "w-full cursor-default text-left outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
          ),
          children: [
            jsxForUiPropertyRow2.jsx("span", {
              className: "min-w-0 flex-1 truncate",
              children: title,
            }),
            value3,
          ],
        }),
      });
    }
    return jsxForUiPropertyRow2.jsxs("div", {
      onClick: value
        ? (event: ReactMouseEvent<HTMLElement> & { target: Element }) => {
            if (
              propertyRowPressShouldIgnore(event.currentTarget, event.target)
            ) {
              return;
            }
            onToggle!();
          }
        : undefined,
      className: (0, runtime.joinClassNames)(value2, value && "cursor-default"),
      children: [
        jsxForUiPropertyRow2.jsx("h3", {
          className: "contents",
          children: value
            ? jsxForUiPropertyRow2.jsx("button", {
                type: "button",
                "aria-expanded": !collapsed,
                onClick: (input: ReactMouseEvent<HTMLElement>) => {
                  input.stopPropagation();
                  onToggle!();
                },
                className:
                  "-my-1 min-w-0 flex-1 cursor-default truncate rounded-sm py-1 text-left text-inherit outline-none focus-visible:outline-hidden focus-visible:shadow-focus",
                children: title,
              })
            : jsxForUiPropertyRow2.jsx("span", {
                className: "min-w-0 flex-1 truncate",
                children: title,
              }),
        }),
        actions
          ? jsxForUiPropertyRow2.jsx("span", {
              className: (0, runtime.joinClassNames)(
                "-my-1 flex shrink-0 items-center gap-0.5",
                PROPERTY_ACTIONS_CLASS,
              ),
              onClick: value
                ? (input: ReactMouseEvent<HTMLElement>) => input.stopPropagation()
                : undefined,
              children: actions,
            })
          : null,
        value3,
      ],
    });
  }
  function warnMixedSectionCollapseControl() {
    if (mixedSectionCollapseWarningShown) {
      return;
    }
    mixedSectionCollapseWarningShown = true;
    console.error(
      "PropertySection: pass either collapsed/onToggle (controlled) or collapsible/defaultOpen (uncontrolled), not both — collapsed wins.",
    );
  }
  function warnUntitledCollapsibleSection() {
    if (untitledSectionCollapseWarningShown) {
      return;
    }
    untitledSectionCollapseWarningShown = true;
    console.error(
      "PropertySection: collapsible needs a title (the header is the toggle) — ignored on a title-less section.",
    );
  }
  function PropertySection({
    title: title,
    addItems: addItems,
    addLabel: addLabel,
    defaultAddOpen: defaultAddOpen,
    actions: actions,
    action: action,
    collapsed: collapsed,
    onToggle: onToggle,
    collapsible = false,
    defaultOpen = false,
    subsection: subsection,
    iconColumn = false,
    children: children,
    className: className,
    "data-testid": dataTestid,
  }: PropertySectionProps): ReactElement {
    let value =
        reactForUiPropertyRow2.Children.toArray(children).length > 0,
      [value2, value3] = reactForUiPropertyRow2.useState(defaultOpen),
      value4 = collapsed !== undefined;
    if (value4 && collapsible) {
      warnMixedSectionCollapseControl();
    }
    if (collapsible && title === undefined) {
      warnUntitledCollapsibleSection();
    }
    let value5 = !value4 && !!collapsible && title !== undefined,
      value6 = value4 ? collapsed : value5 ? !value2 : undefined,
      value7 = value5
        ? () => {
            value3((input: boolean) => !input);
            onToggle?.();
          }
        : onToggle,
      value8 = value6 !== true,
      value9 = typeof title === "string" ? title : undefined,
      value10 = actions ?? action,
      value11 =
        value10 !== undefined && value10 !== null && value10 !== false,
      value12 =
        addItems !== undefined && addItems.length > 0
          ? jsxForUiPropertyRow2.jsx(PropertySectionActions, {
              section: value9,
              "aria-label": addLabel,
              items: addItems,
              defaultOpen: defaultAddOpen,
            })
          : null,
      value13 =
        value12 !== null || value11
          ? jsxForUiPropertyRow2.jsxs(jsxForUiPropertyRow2.Fragment, {
              children: [value12, value11 ? value10 : null],
            })
          : undefined,
      value14 = (0, runtime.joinClassNames)(
        "flex min-w-0 shrink-0 flex-col",
        !subsection && "border-alpha-2 [&:not(:first-child)]:border-t",
        title === undefined && !subsection && "[&:not(:first-child)]:pt-2",
        iconColumn && "[--pp-iconcol:var(--cds-h-control)]",
        className,
      ),
      value15 =
        title !== undefined
          ? jsxForUiPropertyRow2.jsx(PropertySectionHeader, {
              title: title,
              actions: value13,
              collapsed: value6,
              onToggle: value7,
              subsection: subsection,
            })
          : null,
      value16 = jsxForUiPropertyRow2.jsx("div", {
        className: "flex min-w-0 flex-col pb-2",
        children: children,
      });
    if (value6 !== undefined) {
      return jsxForUiPropertyRow2.jsxs(runtime.Collapsible.Root, {
        open: value8,
        "data-testid": dataTestid,
        className: value14,
        children: [
          value15,
          value
            ? jsxForUiPropertyRow2.jsx(runtime.Collapsible.Panel, {
                children: value16,
              })
            : null,
        ],
      });
    }
    return jsxForUiPropertyRow2.jsxs("div", {
      "data-testid": dataTestid,
      className: value14,
      children: [value15, value ? value16 : null],
    });
  }
  bindRuntimeValue(
    runtime,
    "propertyRowPressShouldIgnore",
    () => propertyRowPressShouldIgnore,
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_ROW_INTERACTIVE_SELECTOR",
    () => PROPERTY_ROW_INTERACTIVE_SELECTOR,
    (value) => {
      PROPERTY_ROW_INTERACTIVE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyRow",
    () => initializeUiPropertyRow,
    (value) => {
      initializeUiPropertyRow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertySectionActions",
    () => PropertySectionActions,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyRow",
    () => reactForUiPropertyRow,
    (value) => {
      reactForUiPropertyRow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertyRow",
    () => jsxForUiPropertyRow,
    (value) => {
      jsxForUiPropertyRow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyRow2",
    () => initializeUiPropertyRow2,
    (value) => {
      initializeUiPropertyRow2 = value;
    },
  );
  bindRuntimeValue(runtime, "PropertyColorPreview", () => PropertyColorPreview);
  bindRuntimeValue(runtime, "PropertyRow", () => PropertyRow);
  bindRuntimeValue(
    runtime,
    "PropertySectionHeader",
    () => PropertySectionHeader,
  );
  bindRuntimeValue(
    runtime,
    "warnMixedSectionCollapseControl",
    () => warnMixedSectionCollapseControl,
  );
  bindRuntimeValue(
    runtime,
    "warnUntitledCollapsibleSection",
    () => warnUntitledCollapsibleSection,
  );
  bindRuntimeValue(runtime, "PropertySection", () => PropertySection);
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyRow2",
    () => reactForUiPropertyRow2,
    (value) => {
      reactForUiPropertyRow2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertyRow2",
    () => jsxForUiPropertyRow2,
    (value) => {
      jsxForUiPropertyRow2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_INPUT_SURFACE_CLASS",
    () => PROPERTY_INPUT_SURFACE_CLASS,
    (value) => {
      PROPERTY_INPUT_SURFACE_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_INPUT_CLASS",
    () => PROPERTY_INPUT_CLASS,
    (value) => {
      PROPERTY_INPUT_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_PLACEHOLDER_CLASS",
    () => PROPERTY_PLACEHOLDER_CLASS,
    (value) => {
      PROPERTY_PLACEHOLDER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_SWATCH_CLASS",
    () => COLOR_SWATCH_CLASS,
    (value) => {
      COLOR_SWATCH_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldButton",
    () => FieldButton,
    (value) => {
      FieldButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_SECTION_GUTTER_CLASS",
    () => PROPERTY_SECTION_GUTTER_CLASS,
    (value) => {
      PROPERTY_SECTION_GUTTER_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_ACTIONS_CLASS",
    () => PROPERTY_ACTIONS_CLASS,
    (value) => {
      PROPERTY_ACTIONS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mixedSectionCollapseWarningShown",
    () => mixedSectionCollapseWarningShown,
    (value) => {
      mixedSectionCollapseWarningShown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "untitledSectionCollapseWarningShown",
    () => untitledSectionCollapseWarningShown,
    (value) => {
      untitledSectionCollapseWarningShown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyRow3",
    () => initializeUiPropertyRow3,
    (value) => {
      initializeUiPropertyRow3 = value;
    },
  );
  return () => {
    PROPERTY_ROW_INTERACTIVE_SELECTOR =
      'button,input,select,textarea,label,[role="slider"],[role="switch"],[role="radio"],[role="checkbox"],[role="menuitem"]';
    initializeUiPropertyRow = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiPropertyFocus)();
    });
    initializeUiPropertyRow2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiPropertyLabels)();
      reactForUiPropertyRow = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiPropertyRow = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    PROPERTY_INPUT_SURFACE_CLASS =
      "rounded bg-fill-field text-primary shadow-field-ring outline-none transition duration-fast placeholder:text-muted enabled:hover:shadow-field-hover focus-visible:outline-hidden focus-visible:shadow-focus aria-expanded:shadow-field-hover disabled:opacity-50";
    COLOR_SWATCH_CLASS =
      "relative inline-block h-4 w-4 shrink-0 overflow-hidden rounded-[4px] shadow-card-ring bg-[repeating-conic-gradient(var(--cds-alpha-2)_0_25%,transparent_0_50%)] bg-[length:8px_8px]";
    PROPERTY_SECTION_GUTTER_CLASS =
      "pl-[var(--pp-gutter-l,var(--cds-pad-lg))] pr-[var(--pp-gutter-r,var(--cds-pad-md))]";
    PROPERTY_ACTIONS_CLASS =
      "[&_[data-cds=Button][aria-label]:not([aria-pressed=true])]:text-secondary";
    mixedSectionCollapseWarningShown = false;
    untitledSectionCollapseWarningShown = false;
    initializeUiPropertyRow3 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiPropertyIcons)();
      initializeUiPropertyRow();
      initializeUiPropertyRow2();
      (0, runtime.initializeUiPropertyLabels)();
      reactForUiPropertyRow2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiPropertyRow2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      PROPERTY_INPUT_CLASS = (0, runtime.joinClassNames)(
        "h-control min-w-0 px-md text-body pointer-coarse:h-10",
        PROPERTY_INPUT_SURFACE_CLASS,
      );
      PROPERTY_PLACEHOLDER_CLASS = (0, runtime.joinClassNames)(
        "flex h-control min-w-0 items-center gap-sm pr-md pl-1 text-left text-body pointer-coarse:h-10",
        PROPERTY_INPUT_SURFACE_CLASS,
      );
      FieldButton = reactForUiPropertyRow2.forwardRef<
        HTMLButtonElement,
        FieldButtonProps
      >(function (
        {
          chip: chip,
          children: children,
          caption: caption,
          muted: muted,
          trailing: trailing,
          className: className,
          type = "button",
          ...props
        }: FieldButtonProps,
        options,
      ) {
        return jsxForUiPropertyRow2.jsxs("button", {
          ...props,
          ref: options,
          type: type,
          className: (0, runtime.joinClassNames)(
            chip != null
              ? PROPERTY_PLACEHOLDER_CLASS
              : (0, runtime.joinClassNames)(
                  PROPERTY_INPUT_CLASS,
                  "flex items-center gap-sm text-left",
                ),
            "flex-1",
            className,
          ),
          children: [
            chip,
            jsxForUiPropertyRow2.jsx("span", {
              className: (0, runtime.joinClassNames)(
                "min-w-0 flex-1 truncate",
                muted && "text-muted",
              ),
              children: children,
            }),
            caption !== undefined && caption !== null
              ? jsxForUiPropertyRow2.jsx("span", {
                  className: "text-caption text-muted",
                  children: caption,
                })
              : null,
            trailing,
          ],
        });
      });
    });
  };
}

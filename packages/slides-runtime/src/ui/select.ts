/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";
import type { DataAttributeProps } from "./editor-selection";
import type { ClassNameInput } from "./property-icons";

/** Value a select option carries. */
export type SelectValue = string | number;
/** Option row height. */
export type SelectRowSize = "md" | "lg";
/** One option of a `Select`. */
export interface SelectItem {
  value: SelectValue;
  label: string;
  /** Icon name shown before the label. */
  icon?: string;
  /** Muted text shown after the label. */
  hint?: string;
  disabled?: boolean;
  /** Tooltip; doubles as the reason when the option is disabled. */
  title?: string;
  /** Heading above the run of options that share it. */
  group?: string;
  subgroup?: string;
  separatorBefore?: boolean;
  /** Renders the label with its own styling (for example a font preview). */
  labelStyle?: React.CSSProperties;
}
export interface SelectProps {
  items: readonly SelectItem[];
  /** Selected value; `null` shows the placeholder. */
  value: SelectValue | null;
  onChange: (value: SelectValue) => void;
  "aria-label": string;
  placeholder?: string;
  /** Text shown when nothing else is. */
  hint?: string;
  /** Icon name shown when the selected option has none. */
  icon?: string;
  /** Narrow trigger for unit pickers. */
  compact?: boolean;
  disabled?: boolean;
  title?: string;
  align?: "start" | "center" | "end";
  popupAttrs?: DataAttributeProps;
  defaultOpen?: boolean;
  /** Adds a search box that filters the options by label. */
  searchable?: boolean;
  searchLabel?: string;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  "data-testid"?: string;
}
/** Consecutive options that share a group and subgroup. */
export type SelectItemRun = [SelectItem, ...SelectItem[]];
/** Props of a menu row, as forwarded to the base menu item. */
export interface SelectOptionRowProps {
  disabledReason?: string;
  /** A class name, or a function of the row state. */
  className?: ClassNameInput | ((state: unknown) => ClassNameInput);
  rowSize?: SelectRowSize;
  hint?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  checked?: boolean;
  checkedRole?: "radio" | "checkbox";
  label?: string;
  icon?: string;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}
/** Keyboard event on a menu popup; the base menu adds `preventBaseUIHandler`. */
type MenuKeyboardEvent = React.KeyboardEvent<HTMLElement> & {
  target: Element;
  preventBaseUIHandler: () => void;
};

declare module "../bindings" {
  interface RuntimeBindings {
    SelectReact: ReactNamespace;
    SelectJsx: JsxNamespace;
    SelectOptionRow: (props: SelectOptionRowProps) => React.ReactElement;
    Select: (props: SelectProps) => React.ReactElement;
    groupAdjacentSelectOptions: (options: readonly SelectItem[]) => SelectItemRun[];
    selectTriggerClasses: string;
    selectRowSizes: Record<SelectRowSize, string>;
    initializeSelect: () => void;
  }
}

export function installUiSelect(runtime: RuntimeBindings): () => void {
  var SelectReact: ReactNamespace;
  var SelectJsx: JsxNamespace;
  var selectTriggerClasses: string;
  var selectRowSizes: Record<SelectRowSize, string>;
  var initializeSelect: () => void;
  function SelectOptionRow({
    disabledReason: disabledReason,
    className: className,
    rowSize = "md",
    hint: hint,
    children: children,
    ...props
  }: SelectOptionRowProps): React.ReactElement {
    let value = selectRowSizes[rowSize],
      value2 =
        hint !== undefined && hint !== ""
          ? SelectJsx.jsxs("span", {
              className: "flex min-w-0 flex-1 items-center gap-1.5",
              children: [
                SelectJsx.jsx("span", {
                  className: "min-w-0 truncate",
                  children: children,
                }),
                SelectJsx.jsx("span", {
                  className: "shrink-0 text-footnote text-muted",
                  children: hint,
                }),
              ],
            })
          : children,
      value3 =
        typeof className === "function"
          ? (input: unknown) =>
              (0, runtime.joinClassNames)(value, className(input))
          : (0, runtime.joinClassNames)(value, className),
      value4 = disabledReason !== undefined && disabledReason !== "";
    return SelectJsx.jsx(runtime.Menu.Item, {
      ...props,
      className: value3,
      disabled: props.disabled === true || value4,
      disabledReason: value4 ? disabledReason : undefined,
      children: value2,
    });
  }
  function Select({
    items: items,
    value: value,
    onChange: onChange,
    "aria-label": ariaLabel,
    placeholder: placeholder,
    hint: hint,
    icon: icon,
    compact = false,
    disabled: disabled,
    title: title,
    align: align,
    popupAttrs: popupAttrs,
    defaultOpen: defaultOpen,
    searchable = false,
    searchLabel = "Search…",
    onOpenChange: onOpenChange,
    className: className,
    "data-testid": dataTestid,
  }: SelectProps): React.ReactElement {
    let value2 =
        value === null
          ? undefined
          : items.find((input) => input.value === value),
      value3 = value2?.icon ?? icon,
      value4 = items.some(
        (input) => input.icon != null,
      ),
      value5 =
        value2?.label ??
        placeholder ??
        (value !== null && value !== "" ? String(value) : undefined),
      value6 = value5 ?? hint ?? "",
      [value7, value8] = SelectReact.useState(""),
      ref = SelectReact.useRef<HTMLInputElement>(null),
      value9 = (0, runtime.useCoarsePointer)(),
      value10 = searchable ? value7.trim().toLowerCase() : "",
      value11 =
        value10 === ""
          ? items
          : items.filter(
              (input) =>
                input.label.toLowerCase().includes(value10),
            ),
      callback = (
        input: Element,
        options = false,
      ) =>
        Array.from<HTMLElement>(
          input
            .closest('[role="menu"]')
            ?.querySelectorAll<HTMLElement>(
              '[role^="menuitem"]' +
                (options ? "" : ':not([aria-disabled="true"])'),
            ) ?? [],
        ),
      callback2 = (event: MenuKeyboardEvent) => {
        let current = ref.current,
          value12 = event.getModifierState("AltGraph");
        if (
          !current ||
          event.target.closest("input") ||
          event.nativeEvent.isComposing ||
          event.keyCode === 229 ||
          event.key.length !== 1 ||
          event.key === " " ||
          ((event.ctrlKey || event.altKey) && !value12) ||
          event.metaKey
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.preventBaseUIHandler();
        current.focus({
          preventScroll: true,
        });
        value8(current.value + event.key);
      },
      callback3 = (event: React.MouseEvent<HTMLElement> & { target: HTMLElement }) => {
        let target = event.target;
        if (
          target instanceof
            (target.ownerDocument.defaultView ?? window).HTMLInputElement ||
          target === event.currentTarget
        ) {
          return;
        }
        if (
          target.classList.contains("overflow-y-auto") &&
          event.nativeEvent.offsetX >= target.clientWidth
        ) {
          return;
        }
        event.preventDefault();
      };
    return SelectJsx.jsxs(runtime.Menu.Root, {
      disabled: disabled,
      defaultOpen: defaultOpen,
      onOpenChange: (input: boolean) => {
        if (!input) {
          value8("");
        }
        onOpenChange?.(input);
      },
      children: [
        SelectJsx.jsx(runtime.Menu.Trigger, {
          disabled: disabled,
          render: SelectJsx.jsxs("button", {
            type: "button",
            "data-kit": "PropertySelect",
            "data-testid": dataTestid,
            "aria-label": value6 === "" ? ariaLabel : ariaLabel + ": " + value6,
            title: title,
            className: (0, runtime.joinClassNames)(
              selectTriggerClasses,
              compact ? "w-[4.5rem] shrink-0" : "w-full flex-1",
              className,
            ),
            children: [
              value3 != null
                ? SelectJsx.jsx(runtime.KitIcon, {
                    name: value3,
                    size: 13,
                    className:
                      value2?.icon != null ? "text-primary" : "text-muted",
                  })
                : null,
              SelectJsx.jsx("span", {
                className: (0, runtime.joinClassNames)(
                  "min-w-0 flex-1 truncate",
                  value5 === undefined && "text-muted",
                  value2 === undefined && value6 === "Mixed" && "text-muted",
                ),
                children: value6,
              }),
              SelectJsx.jsx(runtime.KitIcon, {
                name: "CaretDown",
                size: 16,
                className:
                  "mr-0.5 shrink-0 text-muted transition-colors group-enabled/select:group-hover/select:text-secondary",
              }),
            ],
          }),
        }),
        SelectJsx.jsxs(runtime.Menu.Popup, {
          ...popupAttrs,
          align: align ?? (value4 ? "end" : "start"),
          className: (0, runtime.joinClassNames)(
            value4
              ? "w-[calc(var(--anchor-width)+1.375rem)]"
              : "w-[var(--anchor-width)]",
            "max-w-none min-w-[12rem] [&_.scroll-fade-y]:[scrollbar-width:none]",
            searchable && "[&_.scroll-fade-y]:[--cds-scroll-fade-size:0px]",
          ),
          ...(searchable
            ? {
                stableWhileOpen: true,
                collisionAvoidance: {
                  side: "flip",
                  align: "shift",
                  fallbackAxisSide: "none",
                },
                maxVisibleItems: 10.5,
                onKeyDown: callback2,
                onMouseDown: callback3,
                header: SelectJsx.jsx("div", {
                  className: "m-1 mb-2",
                  children: SelectJsx.jsx(runtime.TextInput, {
                    ref: ref,
                    value: value7,
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      value8(event.target.value),
                    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                      if (event.nativeEvent.isComposing) {
                        event.stopPropagation();
                        return;
                      }
                      let value12 = callback(
                          event.currentTarget,
                          true,
                        ),
                        value13 =
                          event.key === "ArrowDown"
                            ? value12[0]
                            : event.key === "ArrowUp"
                              ? value12[value12.length - 1]
                              : undefined;
                      if (value13 !== undefined || event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        if (value13 !== undefined) {
                          value13.focus();
                        } else if (value10 !== "") {
                          callback(event.currentTarget)[
                            (0, runtime.optionTypeaheadMatch)(
                              value10,
                              value11
                                .filter(
                                  (input) =>
                                    input.disabled !== true,
                                )
                                .map((input) => input.label),
                            )
                          ]?.click();
                        }
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                      } else if (event.key !== "Tab") {
                        event.stopPropagation();
                      }
                    },
                    slotStart: SelectJsx.jsx(runtime.KitIcon, {
                      name: "Search",
                      size: 14,
                      className: "text-muted",
                    }),
                    placeholder: searchLabel,
                    "aria-label": searchLabel,
                    autoComplete: "off",
                    spellCheck: false,
                    clearable: true,
                    onClear: () => value8(""),
                    autoFocus: !value9,
                    tabIndex: value9 ? -1 : undefined,
                    "data-kit": "list-search",
                    className: "w-full",
                  }),
                }),
              }
            : {}),
          children: [
            groupAdjacentSelectOptions(value11).map(
              (
                input,
                options,
                context,
              ) => {
                let { group: value12, subgroup: value13 } = input[0];
                return SelectJsx.jsxs(
                  SelectReact.Fragment,
                  {
                    children: [
                      value12 !== undefined &&
                      value12 !== context[options - 1]?.[0]?.group
                        ? SelectJsx.jsxs(SelectJsx.Fragment, {
                            children: [
                              options > 0
                                ? SelectJsx.jsx(runtime.Menu.Separator, {})
                                : null,
                              SelectJsx.jsx(runtime.ColorPickerHeader, {
                                text: value12,
                                title: true,
                              }),
                            ],
                          })
                        : null,
                      SelectJsx.jsxs(runtime.Menu.Group, {
                        "aria-label":
                          value12 !== undefined && value13 !== undefined
                            ? value12 + " · " + value13
                            : value12,
                        children: [
                          value13 !== undefined
                            ? SelectJsx.jsx(runtime.ColorPickerHeader, {
                                text: value13,
                              })
                            : null,
                          input.map(
                            (input2) =>
                              SelectJsx.jsxs(
                                SelectJsx.Fragment,
                                {
                                  children: [
                                    input2.separatorBefore === true
                                      ? SelectJsx.jsx(
                                          runtime.Menu.Separator,
                                          {},
                                        )
                                      : null,
                                    SelectJsx.jsx(SelectOptionRow, {
                                      checked: input2.value === value,
                                      checkedRole: "radio",
                                      label: input2.label,
                                      icon: input2.icon,
                                      disabled: input2.disabled,
                                      title: input2.title,
                                      disabledReason:
                                        input2.disabled === true
                                          ? input2.title
                                          : undefined,
                                      hint: input2.hint,
                                      rowSize:
                                        input2.labelStyle !== undefined
                                          ? "lg"
                                          : "md",
                                      onClick: () => {
                                        if (input2.value !== value) {
                                          onChange(input2.value);
                                        }
                                      },
                                      children:
                                        input2.labelStyle !== undefined
                                          ? SelectJsx.jsx("span", {
                                              className:
                                                "truncate leading-tight [font-variation-settings:normal]",
                                              style: input2.labelStyle,
                                              children: input2.label,
                                            })
                                          : input2.label,
                                    }),
                                  ],
                                },
                                input2.value,
                              ),
                          ),
                        ],
                      }),
                    ],
                  },
                  (value12 ?? "") +
                    ":" +
                    (value13 ?? "") +
                    ":" +
                    input[0].value,
                );
              },
            ),
            searchable && value11.length === 0
              ? SelectJsx.jsx(runtime.Menu.Item, {
                  disabled: true,
                  children: "No matches",
                })
              : null,
          ],
        }),
      ],
    });
  }
  function groupAdjacentSelectOptions(options: readonly SelectItem[]): SelectItemRun[] {
    let items: SelectItemRun[] = [];
    for (let value of options) {
      let value2 = items[items.length - 1];
      if (
        value2 !== undefined &&
        value2[0].group === value.group &&
        value2[0].subgroup === value.subgroup
      ) {
        value2.push(value);
      } else {
        items.push([value]);
      }
    }
    return items;
  }
  bindRuntimeValue(runtime, "SelectOptionRow", () => SelectOptionRow);
  bindRuntimeValue(runtime, "Select", () => Select);
  bindRuntimeValue(
    runtime,
    "groupAdjacentSelectOptions",
    () => groupAdjacentSelectOptions,
  );
  bindRuntimeValue(
    runtime,
    "SelectReact",
    () => SelectReact,
    (value) => {
      SelectReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectJsx",
    () => SelectJsx,
    (value) => {
      SelectJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectTriggerClasses",
    () => selectTriggerClasses,
    (value) => {
      selectTriggerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectRowSizes",
    () => selectRowSizes,
    (value) => {
      selectRowSizes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSelect",
    () => initializeSelect,
    (value) => {
      initializeSelect = value;
    },
  );
  return () => {
    initializeSelect = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiPropertyIcons)();
      (0, runtime.initializeUiPropertyRow3)();
      (0, runtime.initializeUiColorPicker)();
      (0, runtime.initializeUiPropertySearch)();
      (0, runtime.initializeUiPointerMedia)();
      SelectReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      SelectJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      selectTriggerClasses = (0, runtime.joinClassNames)(
        "group/select flex h-control min-w-0 items-center gap-1.5 border-0 pl-md pr-sm text-left font-sans text-body enabled:cursor-default pointer-coarse:h-10",
        runtime.PROPERTY_INPUT_SURFACE_CLASS,
      );
      selectRowSizes = {
        md: "min-h-6",
        lg: "min-h-7",
      };
    });
  };
}

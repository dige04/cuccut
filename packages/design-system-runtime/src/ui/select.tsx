/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiSelect(runtime: RuntimeBindings): () => void {
  var reactAC: typeof React;
  var COARSE_POINTER_QUERY: string;
  var SelectJsx: typeof import("react/jsx-runtime");
  var selectTriggerClasses: string;
  var selectRowSizes: Record<"md" | "lg", string>;
  function useMediaQuery(input: string): boolean {
    let callback = reactAC.useCallback(
      (input2: () => void) => {
        if (typeof matchMedia !== "function") {
          return () => {
            return;
          };
        }
        let value = matchMedia(input);
        value.addEventListener("change", input2);
        return () => value.removeEventListener("change", input2);
      },
      [input],
    );
    return reactAC.useSyncExternalStore(
      callback,
      () => typeof matchMedia === "function" && matchMedia(input).matches,
      () => false,
    );
  }
  function useCoarsePointer() {
    return useMediaQuery(COARSE_POINTER_QUERY);
  }
  function SelectOptionRow({
    disabledReason: disabledReason,
    className: className,
    rowSize = "md",
    hint: hint,
    children: children,
    ...props
  }: C.SelectOptionRowProps) {
    let value = selectRowSizes[rowSize],
      value2 =
        hint !== undefined && hint !== "" ? (
          <span className={"flex min-w-0 flex-1 items-center gap-1.5"}>
            {[
              <span className={"min-w-0 truncate"}>{children}</span>,
              <span className={"shrink-0 text-footnote text-muted"}>
                {hint}
              </span>,
            ]}
          </span>
        ) : (
          children
        ),
      value3:
        | string
        | ((state: import("@base-ui/react/menu").Menu.Item.State) => string) =
        typeof className === "function"
          ? (input: import("@base-ui/react/menu").Menu.Item.State) =>
              (0, runtime.joinClassNames)(value, className(input))
          : (0, runtime.joinClassNames)(value, className),
      value4 = disabledReason !== undefined && disabledReason !== "";
    return (
      <runtime.Menu.Item
        {...props}
        className={value3}
        disabled={props.disabled === true || value4}
        disabledReason={value4 ? disabledReason : undefined}
      >
        {value2}
      </runtime.Menu.Item>
    );
  }
  function Select<Value extends string | number>({
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
  }: C.SelectProps<Value>) {
    let value2 =
        value === null
          ? undefined
          : items.find((input: C.SelectOption<Value>) => input.value === value),
      value3 = value2?.icon ?? icon,
      value4 = items.some((input: C.SelectOption<Value>) => input.icon != null),
      value5 =
        value2?.label ??
        placeholder ??
        (value !== null && value !== "" ? String(value) : undefined),
      value6 = value5 ?? hint ?? "",
      [value7, value8] = (runtime.SelectReact as typeof React).useState(""),
      ref = (runtime.SelectReact as typeof React).useRef<HTMLInputElement>(
        null,
      ),
      value9 = useCoarsePointer(),
      value10 = searchable ? value7.trim().toLowerCase() : "",
      value11 =
        value10 === ""
          ? items
          : items.filter((input: C.SelectOption<Value>) =>
              input.label.toLowerCase().includes(value10),
            ),
      callback = (input: HTMLElement, options = false) =>
        Array.from<HTMLElement>(
          input
            .closest('[role="menu"]')
            ?.querySelectorAll<HTMLElement>(
              '[role^="menuitem"]' +
                (options ? "" : ':not([aria-disabled="true"])'),
            ) ?? [],
        ),
      callback2 = (event: C.SelectKeyEvent) => {
        let current = ref.current,
          value12 = event.getModifierState("AltGraph");
        if (
          !current ||
          (event.target as HTMLElement).closest("input") ||
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
      callback3 = (event: C.SelectPointerEvent) => {
        let target = event.target as HTMLElement;
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
    return (
      <runtime.Menu.Root
        disabled={disabled}
        defaultOpen={defaultOpen}
        onOpenChange={(input: boolean) => {
          if (!input) {
            value8("");
          }
          onOpenChange?.(input);
        }}
      >
        {[
          <runtime.Menu.Trigger
            disabled={disabled}
            render={
              <button
                type={"button"}
                data-kit={"PropertySelect"}
                data-testid={dataTestid}
                aria-label={
                  value6 === "" ? ariaLabel : ariaLabel + ": " + value6
                }
                title={title}
                className={(0, runtime.joinClassNames)(
                  selectTriggerClasses,
                  compact ? "w-[4.5rem] shrink-0" : "w-full flex-1",
                  className,
                )}
              >
                {[
                  value3 != null ? (
                    <runtime.KitIcon
                      name={value3}
                      size={13}
                      className={
                        value2?.icon != null ? "text-primary" : "text-muted"
                      }
                    />
                  ) : null,
                  <span
                    className={(0, runtime.joinClassNames)(
                      "min-w-0 flex-1 truncate",
                      value5 === undefined && "text-muted",
                      value2 === undefined &&
                        value6 === "Mixed" &&
                        "text-muted",
                    )}
                  >
                    {value6}
                  </span>,
                  <runtime.KitIcon
                    name={"CaretDown"}
                    size={16}
                    className={
                      "mr-0.5 shrink-0 text-muted transition-colors group-enabled/select:group-hover/select:text-secondary"
                    }
                  />,
                ]}
              </button>
            }
          />,
          <runtime.Menu.Popup
            {...popupAttrs}
            align={align ?? (value4 ? "end" : "start")}
            className={(0, runtime.joinClassNames)(
              value4
                ? "w-[calc(var(--anchor-width)+1.375rem)]"
                : "w-[var(--anchor-width)]",
              "max-w-none min-w-[12rem] [&_.scroll-fade-y]:[scrollbar-width:none]",
              searchable && "[&_.scroll-fade-y]:[--cds-scroll-fade-size:0px]",
            )}
            {...(searchable
              ? {
                  stableWhileOpen: true,
                  collisionAvoidance: {
                    side: "flip" as const,
                    align: "shift" as const,
                    fallbackAxisSide: "none" as const,
                  },
                  maxVisibleItems: 10.5,
                  onKeyDown: callback2,
                  onMouseDown: callback3,
                  header: (
                    <div className={"m-1 mb-2"}>
                      <runtime.TextInput
                        ref={ref}
                        value={value7}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>,
                        ) => value8(event.target.value)}
                        onKeyDown={(
                          event: React.KeyboardEvent<HTMLInputElement>,
                        ) => {
                          if (event.nativeEvent.isComposing) {
                            event.stopPropagation();
                            return;
                          }
                          let value12 = callback(event.currentTarget, true),
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
                                      (input: C.SelectOption<Value>) =>
                                        input.disabled !== true,
                                    )
                                    .map(
                                      (input: C.SelectOption<Value>) =>
                                        input.label,
                                    ),
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
                        }}
                        slotStart={
                          <runtime.KitIcon
                            name={"Search"}
                            size={14}
                            className={"text-muted"}
                          />
                        }
                        placeholder={searchLabel}
                        aria-label={searchLabel}
                        autoComplete={"off"}
                        spellCheck={false}
                        clearable={true}
                        onClear={() => value8("")}
                        autoFocus={!value9}
                        tabIndex={value9 ? -1 : undefined}
                        data-kit={"list-search"}
                        className={"w-full"}
                      />
                    </div>
                  ),
                }
              : {})}
          >
            {[
              groupAdjacentSelectOptions(value11).map(
                (
                  input: C.SelectOption<Value>[],
                  options: number,
                  context: C.SelectOption<Value>[][],
                ) => {
                  let { group: value12, subgroup: value13 } = input[0];
                  return (() => {
                    const _Element2 = runtime.SelectReact.Fragment;
                    const _elementProps2 = {
                      children: [
                        value12 !== undefined &&
                        value12 !== context[options - 1]?.[0]?.group ? (
                          <SelectJsx.Fragment>
                            {[
                              options > 0 ? <runtime.Menu.Separator /> : null,
                              <runtime.ColorPickerHeader
                                text={value12}
                                title={true}
                              />,
                            ]}
                          </SelectJsx.Fragment>
                        ) : null,
                        <runtime.Menu.Group
                          aria-label={
                            value12 !== undefined && value13 !== undefined
                              ? value12 + " · " + value13
                              : value12
                          }
                        >
                          {[
                            value13 !== undefined ? (
                              <runtime.ColorPickerHeader text={value13} />
                            ) : null,
                            input.map((input2: C.SelectOption<Value>) =>
                              (() => {
                                const _Element = SelectJsx.Fragment;
                                const _elementProps = {
                                  children: [
                                    input2.separatorBefore === true ? (
                                      <runtime.Menu.Separator />
                                    ) : null,
                                    <SelectOptionRow
                                      checked={input2.value === value}
                                      checkedRole={"radio"}
                                      label={input2.label}
                                      icon={input2.icon}
                                      disabled={input2.disabled}
                                      title={input2.title}
                                      disabledReason={
                                        input2.disabled === true
                                          ? input2.title
                                          : undefined
                                      }
                                      hint={input2.hint}
                                      rowSize={
                                        input2.labelStyle !== undefined
                                          ? "lg"
                                          : "md"
                                      }
                                      onClick={() => {
                                        if (input2.value !== value) {
                                          onChange(input2.value);
                                        }
                                      }}
                                    >
                                      {input2.labelStyle !== undefined ? (
                                        <span
                                          className={
                                            "truncate leading-tight [font-variation-settings:normal]"
                                          }
                                          style={input2.labelStyle}
                                        >
                                          {input2.label}
                                        </span>
                                      ) : (
                                        input2.label
                                      )}
                                    </SelectOptionRow>,
                                  ],
                                };
                                const _elementKey = input2.value;
                                return (
                                  <_Element
                                    key={_elementKey}
                                    {..._elementProps}
                                  />
                                );
                              })(),
                            ),
                          ]}
                        </runtime.Menu.Group>,
                      ],
                    };
                    const _elementKey2 =
                      (value12 ?? "") +
                      ":" +
                      (value13 ?? "") +
                      ":" +
                      input[0].value;
                    return <_Element2 key={_elementKey2} {..._elementProps2} />;
                  })();
                },
              ),
              searchable && value11.length === 0 ? (
                <runtime.Menu.Item disabled={true}>
                  {"No matches"}
                </runtime.Menu.Item>
              ) : null,
            ]}
          </runtime.Menu.Popup>,
        ]}
      </runtime.Menu.Root>
    );
  }
  function groupAdjacentSelectOptions<Option extends C.SelectOption>(
    options: readonly Option[],
  ): Option[][] {
    let items: Option[][] = [];
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
  bindRuntimeValue(
    runtime,
    "reactAC",
    () => reactAC,
    (value) => {
      reactAC = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COARSE_POINTER_QUERY",
    () => COARSE_POINTER_QUERY,
    (value) => {
      COARSE_POINTER_QUERY = value;
    },
  );
  bindRuntimeValue(runtime, "useMediaQuery", () => useMediaQuery);
  bindRuntimeValue(runtime, "useCoarsePointer", () => useCoarsePointer);
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
  bindRuntimeValue(runtime, "SelectOptionRow", () => SelectOptionRow);
  bindRuntimeValue(runtime, "Select", () => Select);
  bindRuntimeValue(
    runtime,
    "groupAdjacentSelectOptions",
    () => groupAdjacentSelectOptions,
  );
  return () => {
    reactAC = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    COARSE_POINTER_QUERY = "(pointer: coarse)";
    SelectJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    selectTriggerClasses = (0, runtime.joinClassNames)(
      "group/select flex h-control min-w-0 items-center gap-1.5 border-0 pl-md pr-sm text-left font-sans text-body enabled:cursor-default pointer-coarse:h-10",
      runtime.FIELD_SURFACE_CLASS,
    );
    selectRowSizes = {
      md: "min-h-6",
      lg: "min-h-7",
    };
  };
}

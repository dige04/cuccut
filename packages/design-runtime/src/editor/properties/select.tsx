/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesSelect(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesSelect: Dynamic;
  var PropertiesSelectOnKeyDownCaptureConfig: Dynamic;
  var PropertiesSelectMin: Dynamic;
  function PropertyPickerRow({
    disabledReason: disabledReason,
    className: className,
    rowSize = "md",
    hint: hint,
    children: children,
    ...props
  }: Dynamic): Dynamic {
    let value: Dynamic = runtime.PropertiesPickerSearchMdLgConfig[rowSize],
      value2: Dynamic =
        hint !== undefined && hint !== "" ? (
          <span className={"flex min-w-0 flex-1 items-center gap-1.5"}>
            <span className={"min-w-0 truncate"}>{children}</span>
            <span className={"shrink-0 text-footnote text-muted"}>{hint}</span>
          </span>
        ) : (
          children
        ),
      value3: Dynamic =
        typeof className == "function"
          ? (input?: Dynamic): Dynamic =>
              (0, runtime.joinClassNames)(value, className(input))
          : (0, runtime.joinClassNames)(value, className),
      value4: Dynamic = disabledReason !== undefined && disabledReason !== "";
    return (
      <runtime.MenuMenuAssignValue.Item
        {...props}
        className={value3}
        disabled={props.disabled === true || value4}
        disabledReason={value4 ? disabledReason : undefined}
      >
        {value2}
      </runtime.MenuMenuAssignValue.Item>
    );
  }
  function PropertySelect({
    items: items,
    value: value,
    onChange: onChange,
    "aria-label": ariaLabel,
    placeholder: placeholder,
    hint: hint,
    icon: icon,
    compact = false,
    disabled: disabled2,
    title: title,
    align: align,
    popupAttrs: popupAttrs,
    defaultOpen: defaultOpen,
    searchable = false,
    searchLabel = "Search\u2026",
    onOpenChange: onOpenChange,
    className: className,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    let value2: Dynamic =
        value === null
          ? undefined
          : items.find((input?: Dynamic): Dynamic => input.value === value),
      value3: Dynamic = value2?.icon ?? icon,
      value4: Dynamic = items.some(
        (input?: Dynamic): Dynamic => input.icon != null,
      ),
      value5: Dynamic =
        value2?.label ??
        placeholder ??
        (value !== null && value !== "" ? String(value) : undefined),
      value6: Dynamic = value5 ?? hint ?? "",
      [value7, value8]: Dynamic = (0,
      runtime.reactPropertiesNumericInput.useState)(""),
      value9: Dynamic = (0, runtime.reactPropertiesNumericInput.useRef)(null),
      value10: Dynamic = (0, runtime.useTouchToolbar)(),
      value11: Dynamic = searchable ? value7.trim().toLowerCase() : "",
      value12: Dynamic =
        value11 === ""
          ? items
          : items.filter(
              (input?: Dynamic): Dynamic =>
                input.label.toLowerCase().includes(value11),
            ),
      callback: Dynamic = (
        input?: Dynamic,
        options: Dynamic = false,
      ): Dynamic =>
        Array.from(
          input
            .closest('[role="menu"]')
            ?.querySelectorAll(
              '[role^="menuitem"]' +
                (options ? "" : ':not([aria-disabled="true"])'),
            ) ?? [],
        ),
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        let current: Dynamic = value9.current,
          value13: Dynamic = event.getModifierState("AltGraph");
        !current ||
          event.target.closest("input") ||
          event.nativeEvent.isComposing ||
          event.keyCode === 229 ||
          event.key.length !== 1 ||
          event.key === " " ||
          ((event.ctrlKey || event.altKey) && !value13) ||
          event.metaKey ||
          (event.preventDefault(),
          event.stopPropagation(),
          event.preventBaseUIHandler(),
          current.focus({
            preventScroll: true,
          }),
          value8(current.value + event.key));
      },
      callback3: Dynamic = (event?: Dynamic): Dynamic => {
        let target: Dynamic = event.target;
        target instanceof
          (target.ownerDocument.defaultView ?? window).HTMLInputElement ||
          target === event.currentTarget ||
          (target.classList.contains("overflow-y-auto") &&
            event.nativeEvent.offsetX >= target.clientWidth) ||
          event.preventDefault();
      };
    return (
      <runtime.MenuMenuAssignValue.Root
        disabled={disabled2}
        defaultOpen={defaultOpen}
        onOpenChange={(input?: Dynamic): Dynamic => {
          input || value8("");
          onOpenChange?.(input);
        }}
      >
        <runtime.MenuMenuAssignValue.Trigger
          disabled={disabled2}
          render={
            <button
              type={"button"}
              data-kit={"PropertySelect"}
              data-testid={dataTestid}
              aria-label={value6 === "" ? ariaLabel : ariaLabel + ": " + value6}
              title={title}
              className={(0, runtime.joinClassNames)(
                runtime.joinClassNamesValue_3,
                compact ? "w-[4.5rem] shrink-0" : "w-full flex-1",
                className,
              )}
            >
              {value3 != null ? (
                <runtime.EditorIcon
                  name={value3}
                  size={13}
                  className={
                    value2?.icon != null ? "text-primary" : "text-muted"
                  }
                />
              ) : null}
              <span
                className={(0, runtime.joinClassNames)(
                  "min-w-0 flex-1 truncate",
                  value5 === undefined && "text-muted",
                  value2 === undefined && value6 === "Mixed" && "text-muted",
                )}
              >
                {value6}
              </span>
              <runtime.EditorIcon
                name={"CaretDown"}
                size={16}
                className={
                  "mr-0.5 shrink-0 text-muted transition-colors group-enabled/select:group-hover/select:text-secondary"
                }
              />
            </button>
          }
        />
        <runtime.MenuMenuAssignValue.Popup
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
                  side: "flip",
                  align: "shift",
                  fallbackAxisSide: "none",
                },
                maxVisibleItems: 10.5,
                onKeyDown: callback2,
                onMouseDown: callback3,
                header: (
                  <div className={"m-1 mb-2"}>
                    <runtime.TextInput
                      ref={value9}
                      value={value7}
                      onChange={(event?: Dynamic): Dynamic =>
                        value8(event.target.value)
                      }
                      onKeyDown={(event?: Dynamic): Dynamic => {
                        if (event.nativeEvent.isComposing) {
                          event.stopPropagation();
                          return;
                        }
                        let value13: Dynamic = callback(
                            event.currentTarget,
                            true,
                          ),
                          value14: Dynamic =
                            event.key === "ArrowDown"
                              ? value13[0]
                              : event.key === "ArrowUp"
                                ? value13[value13.length - 1]
                                : undefined;
                        if (value14 !== undefined || event.key === "Enter") {
                          event.preventDefault();
                          event.stopPropagation();
                          value14 !== undefined
                            ? value14.focus()
                            : value11 !== "" &&
                              callback(event.currentTarget)[
                                (0, runtime.pickerSearchInitialIndex)(
                                  value11,
                                  value12
                                    .filter(
                                      (input?: Dynamic): Dynamic =>
                                        input.disabled !== true,
                                    )
                                    .map(
                                      (input?: Dynamic): Dynamic => input.label,
                                    ),
                                )
                              ]?.click();
                          return;
                        }
                        event.key === "Escape"
                          ? event.preventDefault()
                          : event.key !== "Tab" && event.stopPropagation();
                      }}
                      slotStart={
                        <runtime.EditorIcon
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
                      onClear={(): Dynamic => value8("")}
                      autoFocus={!value10}
                      tabIndex={value10 ? -1 : undefined}
                      data-kit={"list-search"}
                      className={"w-full"}
                    />
                  </div>
                ),
              }
            : {})}
        >
          {groupPickerRows(value12).map(
            (
              input?: Dynamic,
              options?: Dynamic,
              context?: Dynamic,
            ): Dynamic => {
              let { group: value13, subgroup: value14 }: Dynamic = input[0];
              return (() => {
                const _Component2 =
                  runtime.reactPropertiesNumericInput.Fragment;
                const _props2 = {
                  children: [
                    value13 !== undefined &&
                    value13 !== context[options - 1]?.[0]?.group ? (
                      <runtime.jsxPropertiesPickerSearch.Fragment>
                        {options > 0 ? (
                          <runtime.MenuMenuAssignValue.Separator />
                        ) : null}
                        <runtime.PickerListHeader text={value13} title={true} />
                      </runtime.jsxPropertiesPickerSearch.Fragment>
                    ) : null,
                    <runtime.MenuMenuAssignValue.Group
                      aria-label={
                        value13 !== undefined && value14 !== undefined
                          ? value13 + " \xB7 " + value14
                          : value13
                      }
                    >
                      {value14 !== undefined ? (
                        <runtime.PickerListHeader text={value14} />
                      ) : null}
                      {input.map(
                        (input2?: Dynamic): Dynamic =>
                          (() => {
                            const _Component =
                              runtime.reactPropertiesNumericInput.Fragment;
                            const _props = {
                              children: [
                                input2.separatorBefore === true ? (
                                  <runtime.MenuMenuAssignValue.Separator />
                                ) : null,
                                <PropertyPickerRow
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
                                  onClick={(): Dynamic => {
                                    input2.value !== value &&
                                      onChange(input2.value);
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
                                </PropertyPickerRow>,
                              ],
                            } as const;
                            const _key = input2.value;
                            return <_Component key={_key} {..._props} />;
                          })(),
                      )}
                    </runtime.MenuMenuAssignValue.Group>,
                  ],
                } as const;
                const _key2 =
                  (value13 ?? "") +
                  ":" +
                  (value14 ?? "") +
                  ":" +
                  input[0].value;
                return <_Component2 key={_key2} {..._props2} />;
              })();
            },
          )}
          {searchable && value12.length === 0 ? (
            <runtime.MenuMenuAssignValue.Item disabled={true}>
              {"No matches"}
            </runtime.MenuMenuAssignValue.Item>
          ) : null}
        </runtime.MenuMenuAssignValue.Popup>
      </runtime.MenuMenuAssignValue.Root>
    );
  }
  function groupPickerRows(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of input as Dynamic) {
      let value2: Dynamic = items[items.length - 1];
      value2 !== undefined &&
      value2[0].group === value.group &&
      value2[0].subgroup === value.subgroup
        ? value2.push(value)
        : items.push([value]);
    }
    return items;
  }
  bindRuntimeValue(runtime, "PropertyPickerRow", () => PropertyPickerRow);
  bindRuntimeValue(runtime, "PropertySelect", () => PropertySelect);
  bindRuntimeValue(runtime, "groupPickerRows", () => groupPickerRows);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesSelect",
    () => jsxPropertiesSelect,
    (value) => {
      jsxPropertiesSelect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSelectOnKeyDownCaptureConfig",
    () => PropertiesSelectOnKeyDownCaptureConfig,
    (value) => {
      PropertiesSelectOnKeyDownCaptureConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesSelectMin",
    () => PropertiesSelectMin,
    (value) => {
      PropertiesSelectMin = value;
    },
  );
  return () => {
    jsxPropertiesSelect = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesSelectOnKeyDownCaptureConfig = {
      onKeyDownCapture: (event?: Dynamic): Dynamic => {
        let value: Dynamic =
          event.target instanceof HTMLElement
            ? event.target.closest('[role="radio"]')
            : null;
        if (value)
          if (
            event.key === "ArrowRight" ||
            event.key === "ArrowLeft" ||
            event.key === "ArrowDown" ||
            event.key === "ArrowUp"
          ) {
            event.preventDefault();
            event.stopPropagation();
            let items: Dynamic = [
                ...(value
                  .closest('[role="radiogroup"]')
                  ?.querySelectorAll('[role="radio"]') ?? []),
              ],
              value2: Dynamic =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : -1;
            items[
              (items.indexOf(value) + value2 + items.length) % items.length
            ]?.focus();
          } else
            event.key === "Enter" &&
              (event.preventDefault(), event.stopPropagation(), value.click());
      },
    };
    PropertiesSelectMin = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic => Math.min(context, Math.max(options, input));
  };
}

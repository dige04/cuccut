import type { ForwardComponent, TextInputProps } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsTextInput(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsTextInput: typeof React;
  var jsxComponentsTextInput: typeof import("react/jsx-runtime");
  var ButtonButtonCssAlias: string;
  var ButtonButtonClassNamesAlias: string;
  var ComponentsTextInputClassNames: string;
  var ComponentsTextInputClassNames_2: string;
  var TextInput: ForwardComponent<HTMLInputElement, TextInputProps>;
  var initializeComponentsTextInput: () => void;
  bindRuntimeValue(
    runtime,
    "reactComponentsTextInput",
    () => reactComponentsTextInput,
    (value) => {
      reactComponentsTextInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsTextInput",
    () => jsxComponentsTextInput,
    (value) => {
      jsxComponentsTextInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonCssAlias",
    () => ButtonButtonCssAlias,
    (value) => {
      ButtonButtonCssAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonButtonClassNamesAlias",
    () => ButtonButtonClassNamesAlias,
    (value) => {
      ButtonButtonClassNamesAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextInputClassNames",
    () => ComponentsTextInputClassNames,
    (value) => {
      ComponentsTextInputClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsTextInputClassNames_2",
    () => ComponentsTextInputClassNames_2,
    (value) => {
      ComponentsTextInputClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TextInput",
    () => TextInput,
    (value) => {
      TextInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsTextInput",
    () => initializeComponentsTextInput,
    (value) => {
      initializeComponentsTextInput = value;
    },
  );
  return () => {
    initializeComponentsTextInput = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeMenuPopup_2)();
      (0, runtime.initializeDomRefComposition)();
      (0, runtime.initializeButtonButton)();
      (0, runtime.initializeButtonButton_2)();
      (0, runtime.initializeFieldContext)();
      reactComponentsTextInput = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsTextInput = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_x7)();
      ButtonButtonCssAlias = runtime.ButtonButtonCss;
      ButtonButtonClassNamesAlias = runtime.ButtonButtonClassNames_4;
      ComponentsTextInputClassNames =
        "[&_[data-cds=Button]:not([data-cds-ghost])]:h-[var(--fhn)] [&_[data-cds=Button]:not([data-cds-ghost])]:rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)] [&_[data-cds=Button][data-cds-icon-only]:not([data-cds-ghost])]:w-[var(--fhn)]";
      ComponentsTextInputClassNames_2 =
        "has-[[data-cds-end-slot]_[data-cds=Button]:not([data-cds-ghost])]:pr-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]";
      TextInput = (0, reactComponentsTextInput.forwardRef)<
        HTMLInputElement,
        TextInputProps
      >(
        (
          {
            className: className,
            size: size,
            fullWidth = true,
            slotStart: slotStart,
            slotEnd: slotEnd,
            clearable = false,
            onClear: onClear,
            clearLabel: clearLabel,
            onChange: onChange,
            ...props
          }: TextInputProps,
          options: React.ForwardedRef<HTMLInputElement>,
        ): React.ReactElement => {
          let {
              id: value,
              "aria-describedby": value2,
              "aria-invalid": value3,
              disabled: value4,
              ...value5
            } = props,
            state = {
              id: value,
              "aria-describedby": value2,
              disabled: value4,
            },
            value6 = (0, runtime.useLabel)("clear", "Clear"),
            value7 = clearLabel ?? value6,
            value8 = (0, runtime.useFieldInvalid)(),
            value9 = value8 || value3,
            value10 = (0, runtime.useFieldDisabled)(),
            value11 = value4 || value10,
            value12 = fullWidth ? "w-full" : "",
            value13 = (0,
            reactComponentsTextInput.useRef)<HTMLInputElement | null>(null),
            { clickToFocusProps: value14 } = (0, runtime.useClickToFocus)(
              () => value13.current?.focus(),
              {
                disabled: value11,
                readOnly: value5.readOnly,
              },
            ),
            value15 = (0, runtime.useMergedRefs)(value13, options),
            value16 = value5.value !== undefined,
            [value17, value18] = (0, reactComponentsTextInput.useState)(
              () =>
                value5.defaultValue !== undefined &&
                String(value5.defaultValue).length > 0,
            ),
            value19 = value16
              ? value5.value !== undefined && String(value5.value).length > 0
              : value17,
            callback = (event: React.ChangeEvent<HTMLInputElement>): void => {
              clearable && !value16 && value18(event.target.value.length > 0);
              onChange?.(event);
            },
            value20 =
              (clearable === "always" || (clearable && value19)) && !value11 ? (
                <runtime.Button
                  iconOnly={true}
                  variant={"ghost"}
                  size={size === "sm" || size === "xs" ? "xs" : "sm"}
                  className={
                    "!size-[var(--fhn)] !rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)]"
                  }
                  icon={"X"}
                  aria-label={value7}
                  tooltip={false}
                  onMouseDown={(event: React.MouseEvent<HTMLElement>) =>
                    event.preventDefault()
                  }
                  onClick={() => {
                    let current = value13.current;
                    !value16 &&
                      current &&
                      (Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        "value",
                      )?.set?.call(current, ""),
                      current.dispatchEvent(
                        new Event("input", {
                          bubbles: true,
                        }),
                      ),
                      value18(false));
                    onClear?.();
                    current?.focus();
                  }}
                />
              ) : null;
          if (slotStart || slotEnd || clearable) {
            let value21 = value20 && !slotEnd,
              value22 = value21 ? "pr-0" : "pr-md",
              text =
                "[--fh:var(--cds-h-control)] [--fr:var(--cds-radius)] [--fhn:var(--cds-h-control-nested)]",
              value23 = value21
                ? `flex aspect-square h-control shrink-0 items-center justify-center ${text}`
                : `flex shrink-0 items-center gap-[var(--cds-pad-sm,6px)] text-muted ${text} ${ComponentsTextInputClassNames}`;
            return (
              <div
                data-cds={"TextInput"}
                {...(0, runtime.getSizeAttribute)(size)}
                data-invalid={value8 || undefined}
                onMouseDown={value14.onMouseDown}
                className={(0, runtime.cn)(
                  ButtonButtonCssAlias,
                  value22,
                  ComponentsTextInputClassNames_2,
                  "inline-flex",
                  value12,
                  value11 ? "cursor-default" : "cursor-text",
                  "items-center gap-[var(--cds-pad-sm,6px)] has-[:focus-visible]:shadow-focus",
                  "has-[input:disabled]:opacity-disabled",
                  value11 ? undefined : runtime.ButtonButtonClassNames_3,
                  className,
                )}
              >
                {slotStart ? (
                  <span className={"flex shrink-0 items-center text-muted"}>
                    {slotStart}
                  </span>
                ) : null}
                <runtime.npm_Field_qg.Control
                  {...state}
                  render={
                    <input
                      ref={value15}
                      aria-invalid={value9}
                      {...value5}
                      onChange={callback}
                      className={(0, runtime.cn)(
                        ButtonButtonClassNamesAlias,
                        "disabled:opacity-100",
                      )}
                    />
                  }
                />
                {value20 || slotEnd ? (
                  <span data-cds-end-slot={""} className={value23}>
                    {value20}
                    {slotEnd}
                  </span>
                ) : null}
              </div>
            );
          }
          return (
            <runtime.npm_Field_qg.Control
              ref={options}
              {...state}
              render={
                <input
                  data-cds={"TextInput"}
                  {...(0, runtime.getSizeAttribute)(size)}
                  data-invalid={value8 || undefined}
                  aria-invalid={value9}
                  {...value5}
                  onChange={callback}
                  className={(0, runtime.cn)(
                    "cds-input cds-reset",
                    ButtonButtonCssAlias,
                    "pr-md",
                    value12,
                    "placeholder:text-muted outline-none focus-visible:outline-hidden enabled:[&:hover:not(:focus):not([data-invalid])]:shadow-field-hover focus-visible:shadow-focus disabled:opacity-disabled",
                    className,
                  )}
                />
              }
            />
          );
        },
      );
      TextInput.displayName = "TextInput";
    });
  };
}

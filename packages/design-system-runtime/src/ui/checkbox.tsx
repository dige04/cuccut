/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiCheckbox(runtime: RuntimeBindings): () => void {
  var reactCheckbox: typeof React;
  var jsxCheckbox: typeof import("react/jsx-runtime");
  var CHECKBOX_INDICATOR_CLASS: string;
  var Checkbox: C.ForwardComponent<HTMLElement, C.CheckboxProps>;
  var reactFieldCheckbox: typeof React;
  var jsxFieldCheckbox: typeof import("react/jsx-runtime");
  var FieldCheckbox: C.ForwardComponent<HTMLElement, C.FieldCheckboxProps>;
  function preserveFieldCheckboxFocus(
    event: React.MouseEvent<HTMLLabelElement>,
  ) {
    if (
      (0, runtime.asElement)(event.target)
        ?.closest('label, [role="button"]')
        ?.matches('[role="button"]:not(a[href])')
    ) {
      event.preventDefault();
    }
  }
  bindRuntimeValue(
    runtime,
    "reactCheckbox",
    () => reactCheckbox,
    (value) => {
      reactCheckbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCheckbox",
    () => jsxCheckbox,
    (value) => {
      jsxCheckbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CHECKBOX_INDICATOR_CLASS",
    () => CHECKBOX_INDICATOR_CLASS,
    (value) => {
      CHECKBOX_INDICATOR_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "Checkbox",
    () => Checkbox,
    (value) => {
      Checkbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFieldCheckbox",
    () => reactFieldCheckbox,
    (value) => {
      reactFieldCheckbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldCheckbox",
    () => jsxFieldCheckbox,
    (value) => {
      jsxFieldCheckbox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preserveFieldCheckboxFocus",
    () => preserveFieldCheckboxFocus,
  );
  bindRuntimeValue(
    runtime,
    "FieldCheckbox",
    () => FieldCheckbox,
    (value) => {
      FieldCheckbox = value;
    },
  );
  return () => {
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeElementAccess)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeTooltip)();
    reactCheckbox = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxCheckbox = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    CHECKBOX_INDICATOR_CLASS = `${runtime.checkboxVisualClasses} transition-colors duration-fast ease-out motion-reduce:transition-none group-data-[unchecked]/cb:group-hover/cb:border-stronger group-data-[checked]/cb:bg-fill-accent group-data-[checked]/cb:border-transparent group-data-[indeterminate]/cb:bg-fill-accent group-data-[indeterminate]/cb:border-transparent group-data-[checked]/cb:group-hover/cb:bg-fill-accent-hover group-data-[indeterminate]/cb:group-hover/cb:bg-fill-accent-hover group-data-[disabled]/cb:group-data-[unchecked]/cb:group-hover/cb:border-strong group-focus-visible/cb:shadow-focus`;
    Checkbox = reactCheckbox.forwardRef(
      (
        {
          label: label,
          description: description,
          size: size,
          className: className,
          disabledReason: disabledReason,
          "aria-describedby": ariaDescribedby,
          "aria-labelledby": ariaLabelledby,
          onMouseDown: onMouseDown,
          ...props
        }: C.CheckboxProps,
        options: React.ForwardedRef<HTMLElement>,
      ) => {
        let value = reactCheckbox.useId(),
          value2 = reactCheckbox.useId(),
          value3 =
            label !== null &&
            label !== undefined &&
            typeof label !== "boolean" &&
            label !== "",
          value4 = value3 && !!description,
          [value5, value6] = reactCheckbox.useState(
            props.indeterminate ?? false,
          ),
          value7 =
            props.indeterminate === true || (props.checked === false && value5);
        if (value7 !== value5) {
          value6(value7);
        }
        let value8 = (
          <runtime.baseCheckbox.Root
            ref={options}
            data-cds={"Checkbox"}
            aria-labelledby={
              ariaLabelledby ||
              (value4 && !props["aria-label"] ? value : undefined)
            }
            aria-describedby={
              [ariaDescribedby, value4 ? value2 : undefined]
                .filter(Boolean)
                .join(" ") || undefined
            }
            {...props}
            {...(size === "xxs"
              ? {
                  "data-size": "xxs",
                }
              : (0, runtime.getControlSizeAttributes)(size))}
            onMouseDown={(0, runtime.withRepeatedClickSelectionPrevention)(
              onMouseDown,
            )}
            className={(0, runtime.cn)(
              "cds-reset group/cb border-0 outline-none focus-visible:outline-hidden data-[disabled]:opacity-disabled",
              runtime.CONTROL_LABEL_CLASS,
              value3 ? "items-start" : "items-center",
              size === "xxs" &&
                "[--cds-checkbox:var(--cds-checkbox-xxs)] [--cds-checkbox-radius:var(--cds-checkbox-xxs-radius)] [--cds-checkbox-glyph:var(--cds-checkbox-xxs-glyph)]",
              className,
            )}
          >
            {[
              <span
                className={(0, runtime.clsx)(
                  CHECKBOX_INDICATOR_CLASS,
                  value3 && "mt-[calc((1lh_-_var(--cds-checkbox,1rem))_/_2)]",
                )}
              >
                <span
                  className={
                    "text-on-accent [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-snap ease-out motion-reduce:transition-none group-data-[checked]/cb:[clip-path:inset(0)] group-data-[checked]/cb:duration-base group-data-[indeterminate]/cb:[clip-path:inset(0)] group-data-[indeterminate]/cb:duration-base"
                  }
                >
                  <runtime.CheckboxGlyph indeterminate={value7} />
                </span>
              </span>,
              value3 &&
                (value4 ? (
                  <span className={"flex min-w-0 flex-col"}>
                    {[
                      <span id={value}>{label}</span>,
                      <span
                        id={value2}
                        className={"text-footnote leading-snug text-muted"}
                      >
                        {description}
                      </span>,
                    ]}
                  </span>
                ) : (
                  <span>{label}</span>
                )),
            ]}
          </runtime.baseCheckbox.Root>
        );
        if (disabledReason === undefined) {
          return value8;
        }
        return (
          <runtime.DisabledReasonTooltip
            reason={props.disabled ? disabledReason : undefined}
          >
            {value8}
          </runtime.DisabledReasonTooltip>
        );
      },
    );
    Checkbox.displayName = "Checkbox";
    reactFieldCheckbox = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFieldCheckbox = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FieldCheckbox = reactFieldCheckbox.forwardRef(
      (
        {
          label: label,
          description: description,
          error: error,
          fieldClassName: fieldClassName,
          className: className,
          "aria-labelledby": ariaLabelledby,
          "aria-describedby": ariaDescribedby,
          ...props
        }: C.FieldCheckboxProps,
        options: React.ForwardedRef<HTMLElement>,
      ) => {
        let value = reactFieldCheckbox.useId(),
          value2 = reactFieldCheckbox.useId();
        return (
          <runtime.FieldWrapper error={error} fieldClassName={fieldClassName}>
            <label
              {...(0, runtime.getControlSizeAttributes)(props.size)}
              onMouseDown={runtime.preventRepeatedClickSelection}
              onClick={preserveFieldCheckboxFocus}
              className={(0, runtime.cn)(
                runtime.CONTROL_LABEL_CLASS,
                "group/cb items-start self-start",
                props.disabled ? "cursor-default" : "cursor-interactive",
                className,
              )}
            >
              {[
                <span
                  className={(0, runtime.clsx)(
                    "flex",
                    runtime.CHECKBOX_LABEL_ALIGNMENT_CLASS,
                  )}
                >
                  <Checkbox
                    ref={options}
                    aria-labelledby={ariaLabelledby || value}
                    aria-describedby={
                      [ariaDescribedby, description ? value2 : undefined]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    {...props}
                  />
                </span>,
                <span
                  className={(0, runtime.clsx)(
                    "flex min-w-0 flex-col",
                    props.disabled && "text-disabled",
                  )}
                >
                  {[
                    <span id={value}>{label}</span>,
                    !!description && (
                      <span
                        id={value2}
                        className={(0, runtime.cn)(
                          "text-footnote leading-snug text-muted",
                          props.disabled && "text-disabled",
                        )}
                      >
                        {description}
                      </span>
                    ),
                  ]}
                </span>,
              ]}
            </label>
          </runtime.FieldWrapper>
        );
      },
    );
    FieldCheckbox.displayName = "Field.Checkbox";
  };
}

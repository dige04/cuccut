import type { ForwardComponent, TextAreaProps } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsComponentsTextArea(
  runtime: RuntimeBindings,
): () => void {
  var reactComponentsTextArea: typeof React;
  var jsxComponentsTextArea: typeof import("react/jsx-runtime");
  var TextArea: ForwardComponent<HTMLTextAreaElement, TextAreaProps>;
  var initializeComponentsTextArea: () => void;
  bindRuntimeValue(
    runtime,
    "reactComponentsTextArea",
    () => reactComponentsTextArea,
    (value) => {
      reactComponentsTextArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsTextArea",
    () => jsxComponentsTextArea,
    (value) => {
      jsxComponentsTextArea = value;
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
    "initializeComponentsTextArea",
    () => initializeComponentsTextArea,
    (value) => {
      initializeComponentsTextArea = value;
    },
  );
  return () => {
    initializeComponentsTextArea = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeButtonButton_2)();
      (0, runtime.initializeFieldContext)();
      reactComponentsTextArea = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxComponentsTextArea = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_x7)();
      TextArea = (0, reactComponentsTextArea.forwardRef)<
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
            disabled: disabled2,
            style: style,
            ...props
          }: TextAreaProps,
          options: React.ForwardedRef<HTMLTextAreaElement>,
        ): React.ReactElement => {
          let value = (0, runtime.useFieldInvalid)(),
            value2 = rows ?? 3,
            value3 = autosize && rows !== undefined,
            value4 = resize === "y" ? "resize-y" : "resize-none",
            value5 = autosize ? "[field-sizing:content]" : "",
            value6 = value3
              ? bare
                ? "min-h-[calc(var(--cds-textarea-rows)*1lh)]"
                : "min-h-[calc(var(--cds-textarea-rows)*1lh+2*var(--cds-pad-sm))]"
              : "",
            value7 = value3
              ? {
                  ...style,
                  "--cds-textarea-rows": value2,
                }
              : style,
            value8 = fullWidth ? "w-full" : "";
          return (
            <runtime.npm_Field_qg.Control
              id={id}
              aria-describedby={ariaDescribedby}
              disabled={disabled2}
              render={
                <textarea
                  ref={options}
                  data-cds={"TextArea"}
                  rows={value2}
                  style={value7}
                  {...(0, runtime.getSizeAttribute)(size)}
                  data-invalid={value || undefined}
                  aria-invalid={value || ariaInvalid}
                  {...props}
                  className={(0, runtime.cn)(
                    "cds-reset",
                    value8,
                    bare
                      ? "block resize-none border-0 bg-transparent p-0 shadow-none"
                      : `cds-input font-normal ${runtime.ButtonButtonCss_2} enabled:[&:hover:not(:focus):not([data-invalid])]:shadow-field-hover focus-visible:shadow-focus ${value4}`,
                    "font-sans text-body text-primary placeholder:text-muted outline-none focus-visible:outline-hidden disabled:opacity-disabled",
                    value5,
                    value6,
                    className,
                  )}
                />
              }
            />
          );
        },
      );
      TextArea.displayName = "TextArea";
    });
  };
}

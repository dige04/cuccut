/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiField(runtime: RuntimeBindings): () => void {
  var FieldComponents: C.FieldComponents;
  var reactField: typeof React;
  var jsxField: typeof import("react/jsx-runtime");
  var FIELD_DISABLED_INVALID_STATES: Record<
    "true" | "false",
    Record<"true" | "false", C.FieldState>
  >;
  var FieldRoot: C.ForwardComponent<HTMLDivElement, C.FieldRootProps>;
  var FieldLabel: C.ForwardComponent<HTMLLabelElement, C.FieldLabelProps>;
  var FieldDescription: C.ForwardComponent<
    HTMLParagraphElement,
    C.FieldDescriptionProps
  >;
  var FieldError: C.ForwardComponent<HTMLDivElement, C.FieldErrorProps>;
  var FieldWrapper: React.FunctionComponent<C.FieldWrapperProps>;
  var FieldRootWithLabel: typeof import("@base-ui/react/field").Field.Control;
  var FieldRow: typeof import("@base-ui/react/field").Field.Validity;
  var reactFieldTextInput: typeof React;
  var jsxFieldTextInput: typeof import("react/jsx-runtime");
  var FieldTextInput: C.ForwardComponent<
    HTMLInputElement,
    C.FieldTextInputProps
  >;
  var reactFieldTextArea: typeof React;
  var jsxFieldTextArea: typeof import("react/jsx-runtime");
  var FieldTextArea: C.ForwardComponent<
    HTMLTextAreaElement,
    C.FieldTextAreaProps
  >;
  var reactFieldNumberInput: typeof React;
  var jsxFieldNumberInput: typeof import("react/jsx-runtime");
  var FieldNumberInput: C.ForwardComponent<
    HTMLInputElement,
    C.FieldNumberInputProps
  >;
  bindRuntimeValue(
    runtime,
    "FieldComponents",
    () => FieldComponents,
    (value) => {
      FieldComponents = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactField",
    () => reactField,
    (value) => {
      reactField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxField",
    () => jsxField,
    (value) => {
      jsxField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FIELD_DISABLED_INVALID_STATES",
    () => FIELD_DISABLED_INVALID_STATES,
    (value) => {
      FIELD_DISABLED_INVALID_STATES = value;
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
    "reactFieldTextInput",
    () => reactFieldTextInput,
    (value) => {
      reactFieldTextInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldTextInput",
    () => jsxFieldTextInput,
    (value) => {
      jsxFieldTextInput = value;
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
    "reactFieldTextArea",
    () => reactFieldTextArea,
    (value) => {
      reactFieldTextArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldTextArea",
    () => jsxFieldTextArea,
    (value) => {
      jsxFieldTextArea = value;
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
    "reactFieldNumberInput",
    () => reactFieldNumberInput,
    (value) => {
      reactFieldNumberInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldNumberInput",
    () => jsxFieldNumberInput,
    (value) => {
      jsxFieldNumberInput = value;
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
  return () => {
    FieldComponents = {} as C.FieldComponents;
    (0, runtime.defineLiveExports)(FieldComponents, {
      Validity: () => FieldRow,
      TextInput: () => FieldTextInput,
      TextArea: () => FieldTextArea,
      Root: () => FieldRoot,
      NumberInput: () => FieldNumberInput,
      Label: () => FieldLabel,
      Error: () => FieldError,
      Description: () => FieldDescription,
      Control: () => FieldRootWithLabel,
      Combobox: () => runtime.FieldCombobox,
      Checkbox: () => runtime.FieldCheckbox,
    });
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeIcons)();
    reactField = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxField = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FIELD_DISABLED_INVALID_STATES = {
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
    FieldRoot = reactField.forwardRef(
      (
        {
          className: className,
          validationMode = "onBlur",
          ...props
        }: C.FieldRootProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ) => (
        <runtime.baseField.Root
          ref={options}
          data-cds={"Field"}
          validationMode={validationMode}
          {...props}
          className={(0, runtime.cn)(
            "flex flex-col gap-xs font-sans",
            className,
          )}
          render={(
            input: React.HTMLAttributes<HTMLDivElement>,
            options2: import("@base-ui/react/field").Field.Root.State,
          ) => (
            <runtime.textFieldStateContext.Provider
              value={
                FIELD_DISABLED_INVALID_STATES[`${options2.disabled}`][
                  `${options2.valid === false}`
                ]
              }
            >
              <div {...input} />
            </runtime.textFieldStateContext.Provider>
          )}
        />
      ),
    );
    FieldRoot.displayName = "Field.Root";
    FieldLabel = reactField.forwardRef(
      (
        { className: className, id: id, ...props }: C.FieldLabelProps,
        options: React.ForwardedRef<HTMLLabelElement>,
      ) => {
        let value: string | undefined = (0, runtime.useFieldLabelId)();
        return (
          <runtime.baseField.Label
            ref={options}
            id={id ?? value}
            {...props}
            className={(0, runtime.cn)(
              "text-body font-medium leading-none text-primary",
              className,
            )}
          />
        );
      },
    );
    FieldLabel.displayName = "Field.Label";
    FieldDescription = reactField.forwardRef(
      (
        { className: className, ...props }: C.FieldDescriptionProps,
        options: React.ForwardedRef<HTMLParagraphElement>,
      ) => (
        <runtime.baseField.Description
          ref={options}
          {...props}
          className={(0, runtime.cn)(
            "text-footnote font-normal leading-snug text-muted",
            className,
          )}
        />
      ),
    );
    FieldDescription.displayName = "Field.Description";
    FieldError = reactField.forwardRef(
      (
        {
          className: className,
          children: children,
          ...props
        }: C.FieldErrorProps,
        options: React.ForwardedRef<HTMLDivElement>,
      ) => (
        <runtime.baseField.Error
          ref={options}
          {...props}
          className={(0, runtime.cn)(
            "flex items-start gap-1 text-footnote font-normal leading-snug text-danger",
            className,
          )}
          render={(input: React.HTMLAttributes<HTMLDivElement>) => (
            <div {...input}>
              {[
                <runtime.Icon
                  name={"WarningCircle"}
                  size={"sm"}
                  className={"mt-px shrink-0"}
                />,
                <span>{children ?? input.children}</span>,
              ]}
            </div>
          )}
        />
      ),
    );
    FieldError.displayName = "Field.Error";
    FieldWrapper = ({
      label: label,
      hint: hint,
      error: error,
      fieldClassName: fieldClassName,
      children: children,
    }: C.FieldWrapperProps) => (
      <FieldRoot
        invalid={Boolean(error) || undefined}
        className={fieldClassName}
      >
        {[
          label !== undefined && label !== null && (
            <FieldLabel>{label}</FieldLabel>
          ),
          children,
          hint !== undefined && hint !== null && (
            <FieldDescription>{hint}</FieldDescription>
          ),
          Boolean(error) && <FieldError match={true}>{error}</FieldError>,
        ]}
      </FieldRoot>
    );
    FieldRootWithLabel = runtime.baseField.Control;
    FieldRow = runtime.baseField.Validity;
    reactFieldTextInput = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFieldTextInput = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FieldTextInput = reactFieldTextInput.forwardRef(
      (
        {
          label: label,
          hint: hint,
          error: error,
          required: required,
          fieldClassName: fieldClassName,
          ...props
        }: C.FieldTextInputProps,
        options: React.ForwardedRef<HTMLInputElement>,
      ) => (
        <FieldWrapper
          label={label}
          hint={hint}
          error={error}
          fieldClassName={fieldClassName}
        >
          <runtime.TextInput ref={options} required={required} {...props} />
        </FieldWrapper>
      ),
    );
    FieldTextInput.displayName = "Field.TextInput";
    reactFieldTextArea = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFieldTextArea = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FieldTextArea = reactFieldTextArea.forwardRef(
      (
        {
          label: label,
          hint: hint,
          error: error,
          required: required,
          fieldClassName: fieldClassName,
          ...props
        }: C.FieldTextAreaProps,
        options: React.ForwardedRef<HTMLTextAreaElement>,
      ) => (
        <FieldWrapper
          label={label}
          hint={hint}
          error={error}
          fieldClassName={fieldClassName}
        >
          <runtime.TextArea ref={options} required={required} {...props} />
        </FieldWrapper>
      ),
    );
    FieldTextArea.displayName = "Field.TextArea";
    reactFieldNumberInput = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFieldNumberInput = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FieldNumberInput = reactFieldNumberInput.forwardRef(
      (
        {
          label: label,
          hint: hint,
          error: error,
          required: required,
          fieldClassName: fieldClassName,
          ...props
        }: C.FieldNumberInputProps,
        options: React.ForwardedRef<HTMLInputElement>,
      ) => (
        <FieldWrapper
          label={label}
          hint={hint}
          error={error}
          fieldClassName={fieldClassName}
        >
          <runtime.NumberInput ref={options} required={required} {...props} />
        </FieldWrapper>
      ),
    );
    FieldNumberInput.displayName = "Field.NumberInput";
  };
}

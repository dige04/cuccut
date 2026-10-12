/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsFieldField(runtime: RuntimeBindings): () => void {
  var reactFieldField: Dynamic;
  var jsxFieldField: Dynamic;
  var FieldFieldFalseTrueConfig: Dynamic;
  var FieldRoot: Dynamic;
  var FieldLabel: Dynamic;
  var FieldDescription: Dynamic;
  var FieldError: Dynamic;
  var Field: Dynamic;
  var FieldControl: Dynamic;
  var FieldValidity: Dynamic;
  var initializeFieldField: Dynamic;
  var reactFieldField_2: Dynamic;
  var jsxFieldField_2: Dynamic;
  var FieldTextInput: Dynamic;
  var initializeFieldField_2: Dynamic;
  var reactFieldField_3: Dynamic;
  var jsxFieldField_3: Dynamic;
  var FieldTextArea: Dynamic;
  var initializeFieldField_3: Dynamic;
  var reactFieldField_4: Dynamic;
  var jsxFieldField_4: Dynamic;
  var FieldNumberInput: Dynamic;
  var initializeFieldField_4: Dynamic;
  var jsxFieldField_5: Dynamic;
  var initializeFieldField_5: Dynamic;
  var FieldExports: Dynamic;
  var initializeFieldField_6: Dynamic;
  function FieldCombobox({
    label: label,
    hint: hint,
    error: error,
    required: required,
    fieldClassName: fieldClassName,
    ...props
  }: Dynamic): Dynamic {
    return label == null &&
      hint == null &&
      !error &&
      fieldClassName === undefined &&
      props.mode !== "input" &&
      props.triggerMode !== "chips" ? (
      <runtime.ComboboxComboboxAssignValue required={required} {...props} />
    ) : (
      <Field
        label={label}
        hint={hint}
        error={error}
        fieldClassName={fieldClassName}
      >
        <runtime.ComboboxComboboxAssignValue required={required} {...props} />
      </Field>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactFieldField",
    () => reactFieldField,
    (value) => {
      reactFieldField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldField",
    () => jsxFieldField,
    (value) => {
      jsxFieldField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldFieldFalseTrueConfig",
    () => FieldFieldFalseTrueConfig,
    (value) => {
      FieldFieldFalseTrueConfig = value;
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
    "Field",
    () => Field,
    (value) => {
      Field = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldControl",
    () => FieldControl,
    (value) => {
      FieldControl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldValidity",
    () => FieldValidity,
    (value) => {
      FieldValidity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFieldField",
    () => initializeFieldField,
    (value) => {
      initializeFieldField = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFieldField_2",
    () => reactFieldField_2,
    (value) => {
      reactFieldField_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldField_2",
    () => jsxFieldField_2,
    (value) => {
      jsxFieldField_2 = value;
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
    "initializeFieldField_2",
    () => initializeFieldField_2,
    (value) => {
      initializeFieldField_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFieldField_3",
    () => reactFieldField_3,
    (value) => {
      reactFieldField_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldField_3",
    () => jsxFieldField_3,
    (value) => {
      jsxFieldField_3 = value;
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
    "initializeFieldField_3",
    () => initializeFieldField_3,
    (value) => {
      initializeFieldField_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactFieldField_4",
    () => reactFieldField_4,
    (value) => {
      reactFieldField_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFieldField_4",
    () => jsxFieldField_4,
    (value) => {
      jsxFieldField_4 = value;
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
  bindRuntimeValue(
    runtime,
    "initializeFieldField_4",
    () => initializeFieldField_4,
    (value) => {
      initializeFieldField_4 = value;
    },
  );
  bindRuntimeValue(runtime, "FieldCombobox", () => FieldCombobox);
  bindRuntimeValue(
    runtime,
    "jsxFieldField_5",
    () => jsxFieldField_5,
    (value) => {
      jsxFieldField_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFieldField_5",
    () => initializeFieldField_5,
    (value) => {
      initializeFieldField_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FieldExports",
    () => FieldExports,
    (value) => {
      FieldExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFieldField_6",
    () => initializeFieldField_6,
    (value) => {
      initializeFieldField_6 = value;
    },
  );
  return () => {
    initializeFieldField = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeComponentsIcon_2)();
      (0, runtime.initializeFieldContext)();
      reactFieldField = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxFieldField = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (0, runtime.initializeNpm__base_ui_react_x7)();
      FieldFieldFalseTrueConfig = {
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
      FieldRoot = (0, reactFieldField.forwardRef)(
        (
          {
            className: className,
            validationMode = "onBlur",
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <runtime.npm_Field_qg.Root
            ref={options}
            data-cds={"Field"}
            validationMode={validationMode}
            {...props}
            className={(0, runtime.cn)(
              "flex flex-col gap-xs font-sans",
              className,
            )}
            render={(input?: Dynamic, options2?: Dynamic): Dynamic => (
              <runtime.FieldStateContext.Provider
                value={
                  FieldFieldFalseTrueConfig[`${options2.disabled}`][
                    `${options2.valid === false}`
                  ]
                }
              >
                <div {...input} />
              </runtime.FieldStateContext.Provider>
            )}
          />
        ),
      );
      FieldRoot.displayName = "Field.Root";
      FieldLabel = (0, reactFieldField.forwardRef)(
        (
          { className: className, ...props }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <runtime.npm_Field_qg.Label
            ref={options}
            {...props}
            className={(0, runtime.cn)(
              "text-body font-medium leading-none text-primary",
              className,
            )}
          />
        ),
      );
      FieldLabel.displayName = "Field.Label";
      FieldDescription = (0, reactFieldField.forwardRef)(
        (
          { className: className, ...props }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <runtime.npm_Field_qg.Description
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
      FieldError = (0, reactFieldField.forwardRef)(
        (
          { className: className, children: children, ...props }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <runtime.npm_Field_qg.Error
            ref={options}
            {...props}
            className={(0, runtime.cn)(
              "flex items-start gap-1 text-footnote font-normal leading-snug text-danger",
              className,
            )}
            render={(input?: Dynamic): Dynamic => (
              <div {...input}>
                <runtime.Icon
                  name={"WarningCircle"}
                  size={"sm"}
                  className={"mt-px shrink-0"}
                />
                <span>{children ?? input.children}</span>
              </div>
            )}
          />
        ),
      );
      FieldError.displayName = "Field.Error";
      Field = ({
        label: label,
        hint: hint,
        error: error,
        fieldClassName: fieldClassName,
        children: children,
      }: Dynamic): Dynamic => (
        <FieldRoot invalid={!!error || undefined} className={fieldClassName}>
          {label != null && <FieldLabel>{label}</FieldLabel>}
          {children}
          {hint != null && <FieldDescription>{hint}</FieldDescription>}
          {!!error && <FieldError match={true}>{error}</FieldError>}
        </FieldRoot>
      );
      FieldControl = runtime.npm_Field_qg.Control;
      FieldValidity = runtime.npm_Field_qg.Validity;
    });
    initializeFieldField_2 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeComponentsTextInput)();
      initializeFieldField();
      reactFieldField_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxFieldField_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      FieldTextInput = (0, reactFieldField_2.forwardRef)(
        (
          {
            label: label,
            hint: hint,
            error: error,
            required: required,
            fieldClassName: fieldClassName,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <Field
            label={label}
            hint={hint}
            error={error}
            fieldClassName={fieldClassName}
          >
            <runtime.TextInput ref={options} required={required} {...props} />
          </Field>
        ),
      );
      FieldTextInput.displayName = "Field.TextInput";
    });
    initializeFieldField_3 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeComponentsTextArea)();
      initializeFieldField();
      reactFieldField_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxFieldField_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      FieldTextArea = (0, reactFieldField_3.forwardRef)(
        (
          {
            label: label,
            hint: hint,
            error: error,
            required: required,
            fieldClassName: fieldClassName,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <Field
            label={label}
            hint={hint}
            error={error}
            fieldClassName={fieldClassName}
          >
            <runtime.TextArea ref={options} required={required} {...props} />
          </Field>
        ),
      );
      FieldTextArea.displayName = "Field.TextArea";
    });
    initializeFieldField_4 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeComponentsSelectionRing_7)();
      initializeFieldField();
      reactFieldField_4 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxFieldField_4 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      FieldNumberInput = (0, reactFieldField_4.forwardRef)(
        (
          {
            label: label,
            hint: hint,
            error: error,
            required: required,
            fieldClassName: fieldClassName,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic => (
          <Field
            label={label}
            hint={hint}
            error={error}
            fieldClassName={fieldClassName}
          >
            <runtime.NumberInput ref={options} required={required} {...props} />
          </Field>
        ),
      );
      FieldNumberInput.displayName = "Field.NumberInput";
    });
    initializeFieldField_5 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeComboboxCombobox_6)();
      initializeFieldField();
      jsxFieldField_5 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      (FieldCombobox as Dynamic).displayName = "Field.Combobox";
    });
    FieldExports = {};
    (0, runtime.defineLiveExports)(FieldExports, {
      Combobox: (): Dynamic => FieldCombobox,
      Control: (): Dynamic => FieldControl,
      Description: (): Dynamic => FieldDescription,
      Error: (): Dynamic => FieldError,
      Label: (): Dynamic => FieldLabel,
      NumberInput: (): Dynamic => FieldNumberInput,
      Root: (): Dynamic => FieldRoot,
      TextArea: (): Dynamic => FieldTextArea,
      TextInput: (): Dynamic => FieldTextInput,
      Validity: (): Dynamic => FieldValidity,
    });
    initializeFieldField_6 = (0, runtime.initializeOnce)((): Dynamic => {
      initializeFieldField();
      initializeFieldField_2();
      initializeFieldField_3();
      initializeFieldField_4();
      initializeFieldField_5();
    });
  };
}

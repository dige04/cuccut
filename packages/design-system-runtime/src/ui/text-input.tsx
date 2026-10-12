/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiTextInput(runtime: RuntimeBindings): () => void {
  var fieldRingClasses: string;
  var fieldHoverClasses: string;
  var inputContainerClasses: string;
  var inputElementClasses: string;
  var textAreaBaseClasses: string;
  var textAreaContainerClasses: string;
  var reactiK: typeof React;
  var textFieldStateContext: React.Context<C.FieldState | null>;
  var reactoK: typeof React;
  var jsxeJ: typeof import("react/jsx-runtime");
  var textInputContainerBaseClasses: string;
  var textInputElementBaseClasses: string;
  var textInputNestedControlClasses: string;
  var textInputTrailingControlPaddingClasses: string;
  var textInputTrailingPaddingClasses: string;
  var TextInput: C.ForwardComponent<HTMLInputElement, C.TextInputProps>;
  function useFieldInvalid() {
    return reactiK.useContext(textFieldStateContext)?.invalid ?? false;
  }
  function useFieldDisabled() {
    return reactiK.useContext(textFieldStateContext)?.disabled ?? false;
  }
  function useFieldLabelId() {
    let {
      labelId: labelId,
      controlId: controlId,
    }: {
      labelId?: string;
      controlId?: string | null;
    } = (0, runtime.baseUseLabelableContext)();
    return labelId ?? (controlId ? `${controlId}-label` : undefined);
  }
  function useHasFieldContext() {
    return reactiK.useContext(textFieldStateContext) !== null;
  }
  bindRuntimeValue(
    runtime,
    "fieldRingClasses",
    () => fieldRingClasses,
    (value) => {
      fieldRingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fieldHoverClasses",
    () => fieldHoverClasses,
    (value) => {
      fieldHoverClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inputContainerClasses",
    () => inputContainerClasses,
    (value) => {
      inputContainerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inputElementClasses",
    () => inputElementClasses,
    (value) => {
      inputElementClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textAreaBaseClasses",
    () => textAreaBaseClasses,
    (value) => {
      textAreaBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textAreaContainerClasses",
    () => textAreaContainerClasses,
    (value) => {
      textAreaContainerClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactiK",
    () => reactiK,
    (value) => {
      reactiK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFieldStateContext",
    () => textFieldStateContext,
    (value) => {
      textFieldStateContext = value;
    },
  );
  bindRuntimeValue(runtime, "useFieldInvalid", () => useFieldInvalid);
  bindRuntimeValue(runtime, "useFieldDisabled", () => useFieldDisabled);
  bindRuntimeValue(runtime, "useFieldLabelId", () => useFieldLabelId);
  bindRuntimeValue(runtime, "useHasFieldContext", () => useHasFieldContext);
  bindRuntimeValue(
    runtime,
    "reactoK",
    () => reactoK,
    (value) => {
      reactoK = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxeJ",
    () => jsxeJ,
    (value) => {
      jsxeJ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textInputContainerBaseClasses",
    () => textInputContainerBaseClasses,
    (value) => {
      textInputContainerBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textInputElementBaseClasses",
    () => textInputElementBaseClasses,
    (value) => {
      textInputElementBaseClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textInputNestedControlClasses",
    () => textInputNestedControlClasses,
    (value) => {
      textInputNestedControlClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textInputTrailingControlPaddingClasses",
    () => textInputTrailingControlPaddingClasses,
    (value) => {
      textInputTrailingControlPaddingClasses = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textInputTrailingPaddingClasses",
    () => textInputTrailingPaddingClasses,
    (value) => {
      textInputTrailingPaddingClasses = value;
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
  return () => {
    (0, runtime.initializeClickToFocus)();
    (0, runtime.initializeMergedRefs)();
    fieldRingClasses =
      "bg-fill-field shadow-field-ring data-[invalid]:shadow-field-invalid";
    fieldHoverClasses =
      "[&:hover:not(:focus-visible):not(:has(:focus-visible)):not([data-invalid]):not([data-disabled])]:shadow-field-hover";
    inputContainerClasses = `h-control pl-md rounded ${fieldRingClasses} font-sans text-body font-normal text-primary transition duration-fast`;
    inputElementClasses =
      "cds-input cds-reset min-w-0 flex-1 h-full bg-transparent border-0 p-0 outline-none focus-visible:outline-hidden text-body font-normal text-primary focus-visible:shadow-none placeholder:text-muted disabled:opacity-disabled";
    textAreaBaseClasses = `rounded ${fieldRingClasses} px-md py-sm transition duration-fast`;
    textAreaContainerClasses = `${textAreaBaseClasses} [&:hover:not(:focus-within):not([data-invalid]):not([data-disabled])]:shadow-field-hover focus-within:shadow-focus data-[invalid]:focus-within:shadow-focus-danger font-sans text-body text-primary`;
    reactiK = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    textFieldStateContext = reactiK.createContext<C.FieldState | null>(null);
    reactoK = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxeJ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    textInputContainerBaseClasses = inputContainerClasses;
    textInputElementBaseClasses = inputElementClasses;
    textInputNestedControlClasses =
      "[&_[data-cds=Button]:not([data-cds-ghost])]:h-[var(--fhn)] [&_[data-cds=Button]:not([data-cds-ghost])]:rounded-[calc(var(--fr)-(var(--fh)-var(--fhn))/2)] [&_[data-cds=Button][data-cds-icon-only]:not([data-cds-ghost])]:w-[var(--fhn)]";
    textInputTrailingControlPaddingClasses =
      "has-[[data-cds-end-slot]_[data-cds=Button]:not([data-cds-ghost])]:pr-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]";
    textInputTrailingPaddingClasses =
      "pr-[calc((var(--cds-h-control)-var(--cds-h-control-nested))/2)]";
    TextInput = reactoK.forwardRef(
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
          onKeyDown: onKeyDown,
          ...props
        }: C.TextInputProps,
        options: React.ForwardedRef<HTMLInputElement>,
      ) => {
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
          value6: string = (0, runtime.useTranslation)("clear", "Clear"),
          value7 = clearLabel ?? value6,
          value8 = useFieldInvalid(),
          value9 = value8 || value3,
          value10 = useFieldDisabled(),
          value11 = value4 || value10,
          value12 = fullWidth ? "w-full" : "",
          value13 = fullWidth ? "w-full min-w-0" : "",
          ref = reactoK.useRef<HTMLInputElement>(null),
          {
            clickToFocusProps: value14,
          }: {
            clickToFocusProps: React.HTMLAttributes<HTMLDivElement>;
          } = (0, runtime.useClickToFocus)(() => ref.current?.focus(), {
            disabled: value11,
            readOnly: value5.readOnly,
          }),
          value15: React.Ref<HTMLInputElement> = (0, runtime.useMergedRefs)(
            ref,
            options,
          ),
          value16 = value5.value !== undefined,
          [value17, value18] = reactoK.useState(
            () =>
              value5.defaultValue !== undefined &&
              String(value5.defaultValue).length > 0,
          ),
          value19 = value16
            ? value5.value !== undefined && String(value5.value).length > 0
            : value17,
          callback = (event: React.ChangeEvent<HTMLInputElement>) => {
            if (clearable && !value16) {
              value18(event.target.value.length > 0);
            }
            onChange?.(event);
          },
          callback2 = () => {
            let current = ref.current;
            if (!value16 && current) {
              Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value",
              )?.set?.call(current, "");
              current.dispatchEvent(
                new Event("input", {
                  bubbles: true,
                }),
              );
              value18(false);
            }
            onClear?.();
            current?.focus();
          },
          value20 =
            (clearable === "always" || (clearable && value19)) && !value11,
          value21 =
            value20 &&
            value19 &&
            (!value16 || onClear !== undefined) &&
            !value5.readOnly,
          value22 = value20 ? (
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
              tabIndex={value21 ? -1 : undefined}
              onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) =>
                event.preventDefault()
              }
              onClick={callback2}
            />
          ) : null,
          ref2 = reactoK.useRef(false),
          callback3 = (event: React.KeyboardEvent<HTMLInputElement>) => {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
          },
          callback4 = (event: React.KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(event);
            if (event.key === "Escape" && !event.repeat) {
              ref2.current = false;
            }
            if (
              !(
                event.key === "Escape" &&
                !(
                  event.metaKey ||
                  event.ctrlKey ||
                  event.altKey ||
                  event.shiftKey
                ) &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229 &&
                !event.defaultPrevented &&
                !event.isPropagationStopped()
              )
            ) {
              return;
            }
            if (event.repeat) {
              if (ref2.current) {
                callback3(event);
              }
              return;
            }
            ref2.current = value21 && event.currentTarget.value !== "";
            if (ref2.current) {
              callback3(event);
              callback2();
            }
          };
        if (slotStart || slotEnd || clearable) {
          let value23 = value22 ? textInputTrailingPaddingClasses : "pr-md",
            value24 = `flex shrink-0 items-center gap-[var(--cds-pad-sm,6px)] text-muted [--fh:var(--cds-h-control)] [--fr:var(--cds-radius)] [--fhn:var(--cds-h-control-nested)] ${textInputNestedControlClasses}`;
          return (
            <div
              data-cds={"TextInput"}
              {...(0, runtime.getControlSizeAttributes)(size)}
              data-invalid={value8 || undefined}
              onMouseDown={value14.onMouseDown}
              className={(0, runtime.cn)(
                textInputContainerBaseClasses,
                value23,
                textInputTrailingControlPaddingClasses,
                "inline-flex",
                value13,
                value11 ? "cursor-default" : "cursor-text",
                "items-center gap-[var(--cds-pad-sm,6px)] has-[:focus-visible]:shadow-focus",
                "has-[input:disabled]:opacity-disabled",
                value11 ? undefined : fieldHoverClasses,
                className,
              )}
            >
              {[
                slotStart ? (
                  <span className={"flex shrink-0 items-center text-muted"}>
                    {slotStart}
                  </span>
                ) : null,
                <runtime.baseField.Control
                  {...state}
                  render={
                    <input
                      ref={value15}
                      aria-invalid={value9}
                      {...value5}
                      onChange={callback}
                      onKeyDown={callback4}
                      className={(0, runtime.cn)(
                        textInputElementBaseClasses,
                        "disabled:opacity-100",
                      )}
                    />
                  }
                />,
                value22 || slotEnd ? (
                  <span data-cds-end-slot={""} className={value24}>
                    {[slotEnd, value22]}
                  </span>
                ) : null,
              ]}
            </div>
          );
        }
        return (
          <runtime.baseField.Control
            ref={options}
            {...state}
            render={
              <input
                data-cds={"TextInput"}
                {...(0, runtime.getControlSizeAttributes)(size)}
                data-invalid={value8 || undefined}
                aria-invalid={value9}
                {...value5}
                onChange={callback}
                onKeyDown={callback4}
                className={(0, runtime.cn)(
                  "cds-input cds-reset",
                  textInputContainerBaseClasses,
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
    (0, runtime.initializeMediaQueryStores)();
    (0, runtime.initializeIsomorphicLayoutEffect)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsLink)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeElementAccess)();
    (0, runtime.initializeLayers)();
    (0, runtime.initializeEventCallbacks)();
    (0, runtime.initializeClickToFocus)();
    (0, runtime.initializeElementNamespaces)();
    (0, runtime.initializeCloseOnActivityHide)();
    (0, runtime.initializeMergedRefs)();
    (0, runtime.initializePortalRoot)();
    (0, runtime.initializeIcons)();
    (0, runtime.initializeCollisionPadding)();
    (0, runtime.initializeShortcuts)();
    (0, runtime.initializeDisabledReason)();
    (0, runtime.initializeTooltip)();
    (0, runtime.initializeSurfaces)();
    (0, runtime.initializeOverlayActions)();
    (0, runtime.initializePresentationMode)();
    (0, runtime.initializeAdaptiveSheets)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeLayers)();
    (0, runtime.initializeAndroidCloseWatcher)();
    (0, runtime.initializePortalRoot)();
    (0, runtime.initializeAdaptiveSheets)();
    (0, runtime.initializeSheetClassNames)();
  };
}

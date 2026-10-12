/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as C from "../contracts/controls";
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiNumberInput(runtime: RuntimeBindings): () => void {
  var reactForUiTable3: typeof React;
  var jsxNumberInput: typeof import("react/jsx-runtime");
  var numberFieldHydrationNoop: () => void;
  var subscribeHydration: (listener: () => void) => () => void;
  var NumberInput: C.ForwardComponent<HTMLInputElement, C.NumberInputProps>;
  var findBarListenerWindows: WeakSet<Document>;
  function useClientHydrated() {
    return reactForUiTable3.useSyncExternalStore(
      subscribeHydration,
      () => true,
      () => false,
    );
  }
  function isUnwrappedHorizontalFlex(input: HTMLElement) {
    let value = getComputedStyle(input);
    return (
      value.display.endsWith("flex") &&
      !value.flexDirection.startsWith("column") &&
      !value.flexWrap.startsWith("wrap")
    );
  }
  function getInnerElementWidth(input: HTMLElement) {
    let value = getComputedStyle(input);
    return (
      input.getBoundingClientRect().width -
      (Number.parseFloat(value.paddingLeft) || 0) -
      (Number.parseFloat(value.paddingRight) || 0) -
      (Number.parseFloat(value.borderLeftWidth) || 0) -
      (Number.parseFloat(value.borderRightWidth) || 0)
    );
  }
  function getTabOverflowWidth(
    input: HTMLElement,
    options: HTMLElement,
    context: number,
  ) {
    return (
      context +
      measureVisibleSiblingWidth(
        input,
        options,
        Number.parseFloat(getComputedStyle(input).columnGap) || 0,
      )
    );
  }
  function measureVisibleSiblingWidth(
    input: HTMLElement,
    options: HTMLElement,
    context: number,
  ) {
    let index = 0;
    for (let value of Array.from<Element>(input.children)) {
      if (value === options || !(0, runtime.isHtmlElement)(value)) {
        continue;
      }
      let value2 = getComputedStyle(value);
      if (
        value2.position === "absolute" ||
        value2.position === "fixed" ||
        value2.display === "none"
      ) {
        continue;
      }
      if (value2.display === "contents") {
        index += measureVisibleSiblingWidth(
          value as HTMLElement,
          options,
          context,
        );
        continue;
      }
      if (value2.flexShrink === "0" && value2.flexGrow === "0") {
        index += value.getBoundingClientRect().width + context;
        continue;
      }
      let value3: number = (0, runtime.parsePixelCssValue)(value2.flexBasis),
        attribute = value.getAttribute("style"),
        cssText = (value as HTMLElement).style.cssText;
      (value as HTMLElement).style.flex = "0 0 auto";
      (value as HTMLElement).style.width = "min-content";
      let width = value.getBoundingClientRect().width;
      (0, runtime.applyTabFlexCorrection)(value, attribute, cssText);
      index += Math.max(width, value3) + context;
    }
    return index;
  }
  bindRuntimeValue(
    runtime,
    "reactForUiTable3",
    () => reactForUiTable3,
    (value) => {
      reactForUiTable3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxNumberInput",
    () => jsxNumberInput,
    (value) => {
      jsxNumberInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numberFieldHydrationNoop",
    () => numberFieldHydrationNoop,
    (value) => {
      numberFieldHydrationNoop = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeHydration",
    () => subscribeHydration,
    (value) => {
      subscribeHydration = value;
    },
  );
  bindRuntimeValue(runtime, "useClientHydrated", () => useClientHydrated);
  bindRuntimeValue(
    runtime,
    "NumberInput",
    () => NumberInput,
    (value) => {
      NumberInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isUnwrappedHorizontalFlex",
    () => isUnwrappedHorizontalFlex,
  );
  bindRuntimeValue(runtime, "getInnerElementWidth", () => getInnerElementWidth);
  bindRuntimeValue(runtime, "getTabOverflowWidth", () => getTabOverflowWidth);
  bindRuntimeValue(
    runtime,
    "measureVisibleSiblingWidth",
    () => measureVisibleSiblingWidth,
  );
  bindRuntimeValue(
    runtime,
    "findBarListenerWindows",
    () => findBarListenerWindows,
    (value) => {
      findBarListenerWindows = value;
    },
  );
  return () => {
    reactForUiTable3 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxNumberInput = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    numberFieldHydrationNoop = () => {
      return;
    };
    subscribeHydration = () => numberFieldHydrationNoop;
    NumberInput = reactForUiTable3.forwardRef(
      (
        {
          className: className,
          size: size,
          fullWidth = true,
          currency: currency,
          slotStart: slotStart,
          slotEnd: slotEnd,
          value: value,
          defaultValue: defaultValue,
          onValueChange: onValueChange,
          onValueCommitted: onValueCommitted,
          format: format,
          locale: locale,
          min: min,
          max: max,
          step: step,
          smallStep: smallStep,
          largeStep: largeStep,
          snapOnStep: snapOnStep,
          allowOutOfRange: allowOutOfRange,
          required: required,
          disabled: disabled,
          readOnly: readOnly,
          name: name,
          form: form,
          ...props
        }: C.NumberInputProps,
        options: React.ForwardedRef<HTMLInputElement>,
      ) => {
        let { id: value2, ...value3 } = props,
          value4: Intl.LocalesArgument | undefined = (0,
          runtime.useCdsLocale)(),
          value5 = locale ?? value4,
          value6 = useClientHydrated(),
          value7 = value5 ?? (value6 ? undefined : "en-US"),
          memo = reactForUiTable3.useMemo<C.CurrencyDisplayParts | null>(
            () =>
              currency !== undefined &&
              slotStart === undefined &&
              slotEnd === undefined
                ? (0, runtime.currencyDisplayParts)(currency, value7)
                : null,
            [currency, value7, slotStart, slotEnd],
          ),
          value8 = slotStart ?? (memo?.side === "start" ? memo.symbol : null),
          value9 = slotEnd ?? (memo?.side === "end" ? memo.symbol : null),
          value10 = memo !== null || undefined,
          value11: boolean = (0, runtime.useFieldInvalid)(),
          value12: boolean = (0, runtime.useFieldDisabled)(),
          value13 = fullWidth ? "w-full min-w-0" : "",
          ref = reactForUiTable3.useRef<HTMLInputElement>(null),
          {
            clickToFocusProps: value14,
          }: {
            clickToFocusProps: React.HTMLAttributes<HTMLDivElement>;
          } = (0, runtime.useClickToFocus)(() => ref.current?.focus(), {
            disabled: disabled || value12,
            readOnly: readOnly,
          }),
          [, value15] = reactForUiTable3.useReducer(
            (input: number) => input + 1,
            0,
          ),
          callback = (input: React.FocusEvent<HTMLInputElement>) => {
            value3.onBlur?.(input);
            value15();
          },
          value16: React.RefCallback<HTMLInputElement> = (0,
          runtime.useMergedRefs)(ref, options);
        return (
          <runtime.baseNumberField.Root
            data-cds={"NumberInput"}
            {...(0, runtime.getControlSizeAttributes)(size)}
            data-invalid={value11 || undefined}
            id={value2}
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange}
            onValueCommitted={onValueCommitted}
            format={format}
            locale={value5}
            min={min}
            max={max}
            step={step}
            smallStep={smallStep}
            largeStep={largeStep}
            snapOnStep={snapOnStep}
            allowOutOfRange={allowOutOfRange}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            name={name}
            form={form}
            onMouseDown={value14.onMouseDown}
            className={(0, runtime.cn)(
              runtime.inputContainerClasses,
              "pr-md",
              "inline-flex",
              value13,
              "cursor-text items-center gap-[var(--cds-pad-sm,6px)] has-[:focus-visible]:shadow-focus",
              "data-[disabled]:opacity-disabled",
              !disabled &&
                "[&:hover:not(:focus-visible):not(:has(:focus-visible)):not([data-invalid]):not([data-disabled])]:shadow-field-hover",
              className,
            )}
          >
            {[
              value8 ? (
                <span
                  aria-hidden={value10}
                  className={"flex shrink-0 items-center text-muted"}
                >
                  {value8}
                </span>
              ) : null,
              <runtime.baseNumberField.Input
                ref={value16}
                aria-invalid={value3["aria-invalid"] ?? (value11 || undefined)}
                {...value3}
                onBlur={callback}
                className={(0, runtime.cn)(
                  runtime.inputElementClasses,
                  "disabled:opacity-100",
                )}
              />,
              value9 ? (
                <span
                  aria-hidden={value10}
                  className={"flex shrink-0 items-center text-muted"}
                >
                  {value9}
                </span>
              ) : null,
            ]}
          </runtime.baseNumberField.Root>
        );
      },
    );
    NumberInput.displayName = "NumberInput";
    (0, runtime.initializeSafeObservers)();
    (0, runtime.initializeIsomorphicLayoutEffect)();
    (0, runtime.initializeClassNames)();
    (0, runtime.initializeCdsRoot)();
    (0, runtime.initializeIconSupport)();
    (0, runtime.initializeElementNamespaces)();
    (0, runtime.initializeMergedRefs)();
    (0, runtime.initializeDisabledReason)();
    (0, runtime.initializeTooltip)();
    (0, runtime.initializeInertProps)();
    (0, runtime.initializeElementNamespaces)();
    findBarListenerWindows = new WeakSet();
  };
}

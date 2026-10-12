/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesNumericInput(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesNumericInput: Dynamic;
  var jsxPropertiesNumericInput: Dynamic;
  var PropertiesNumericInputLimit: Dynamic;
  function NumericInput({
    value: value,
    onValue: onValue,
    onScrub: onScrub,
    onScrubEnd: onScrubEnd,
    prefix: prefix,
    unit: unit,
    unitScrubs = true,
    refuseLetters = false,
    ownUnit = typeof unit == "string" ? unit : undefined,
    min: min2,
    max: max,
    step: step,
    scrubOrigin: scrubOrigin,
    smallStep: smallStep,
    emptyStepFrom: emptyStepFrom,
    placeholder: placeholder,
    hint: hint,
    clearable: clearable,
    mixed = false,
    steppers = true,
    fullWidth = true,
    disabled: disabled2,
    title: title,
    "aria-label": ariaLabel,
    inputRef: inputRef,
    className: className,
  }: Dynamic): Dynamic {
    let value2: Dynamic = (0, runtime.reactPropertiesToolOptions.useRef)(null),
      value3: Dynamic = (0, runtime.reactPropertiesToolOptions.useCallback)(
        (input?: Dynamic): Dynamic => {
          value2.current = input;
          typeof inputRef == "function"
            ? inputRef(input)
            : inputRef && (inputRef.current = input);
        },
        [inputRef],
      ),
      value4: Dynamic = unit != null && unit !== false && unit !== "",
      value5: Dynamic =
        value === undefined &&
        !mixed &&
        emptyStepFrom !== null &&
        placeholder !== undefined &&
        /^-?\d+(\.\d+)?$/.test(placeholder)
          ? Number(placeholder)
          : undefined,
      value6: Dynamic = value ?? value5,
      value7: Dynamic = (0, runtime.reactPropertiesToolOptions.useRef)(false),
      value8: Dynamic = (0, runtime.reactPropertiesToolOptions.useRef)(false),
      value9: Dynamic = (0, runtime.reactPropertiesToolOptions.useRef)(false),
      value10: Dynamic = (0, runtime.reactPropertiesToolOptions.useRef)(""),
      value11: Dynamic = (0, runtime.reactPropertiesToolOptions.useRef)(false),
      callback: Dynamic = (): Dynamic => {
        let value21: Dynamic = value10.current.toLowerCase();
        value10.current = "";
        return !refuseLetters ||
          !value21 ||
          value21 === (ownUnit ?? "").toLowerCase()
          ? false
          : (value9.current && (value11.current = true), true);
      },
      value12: Dynamic = step ?? 1,
      value13: Dynamic = smallStep ?? Math.min(0.1, value12),
      value14: Dynamic =
        ariaLabel ||
        (typeof prefix == "string" && prefix !== "" ? prefix : undefined),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        if (!value7.current) {
          if (callback()) {
            (0, runtime.announce)(
              (0, runtime.invalidNumericValueMessage)(value14, ownUnit),
            );
            return;
          }
          if (input === null) {
            clearable &&
              !mixed &&
              value !== undefined &&
              !(value9.current && emptyStepFrom !== undefined) &&
              onValue(undefined);
            return;
          }
          value === undefined &&
            min2 !== undefined &&
            (input = Math.max(min2, input));
          value === undefined &&
            max !== undefined &&
            (input = Math.min(max, input));
          (mixed || input !== value) && onValue(input);
        }
      },
      callback3: Dynamic = (event?: Dynamic): Dynamic => {
        value8.current = false;
        value11.current = false;
        !event.metaKey &&
          !event.ctrlKey &&
          (/^[a-zA-Z%]$/.test(event.key)
            ? (value10.current += event.key)
            : /^[0-9.\-]$/.test(event.key) && (value10.current = ""));
        if (event.key === "Enter") {
          event.preventDefault();
          let current: Dynamic = value2.current;
          current?.blur();
          current?.focus();
          current?.select();
          value8.current = true;
          queueMicrotask((): Dynamic => {
            !value8.current ||
              !current ||
              ((value8.current = false),
              current.ownerDocument.activeElement === current &&
                current.select());
          });
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          value10.current = "";
          value7.current = true;
          value2.current?.blur();
          value7.current = false;
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          if (
            emptyStepFrom !== undefined &&
            (value2.current?.value ?? "").trim() === ""
          ) {
            let preventBaseUIHandler: Dynamic = event.preventBaseUIHandler;
            preventBaseUIHandler && preventBaseUIHandler.call(event);
            event.preventDefault();
            event.stopPropagation();
            callback6(event.key === "ArrowUp" ? 1 : -1, event);
          }
          let current: Dynamic = value2.current;
          value8.current = true;
          setTimeout((): Dynamic => {
            !value8.current ||
              !current ||
              ((value8.current = false),
              current.ownerDocument.activeElement === current &&
                current.select());
          }, 0);
          return;
        }
        if (event.key === "Home" || event.key === "End") {
          let preventBaseUIHandler: Dynamic = event.preventBaseUIHandler;
          preventBaseUIHandler
            ? preventBaseUIHandler.call(event)
            : event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
      },
      value15: Dynamic =
        value ??
        (typeof emptyStepFrom == "number" && Number.isFinite(emptyStepFrom)
          ? emptyStepFrom
          : onScrub
            ? value5
            : undefined),
      value16: Dynamic = !disabled2 && !mixed && value15 !== undefined,
      [value17, value18]: Dynamic = (0,
      runtime.reactPropertiesToolOptions.useState)(null),
      value19: Dynamic = (0, runtime.useNumericScrub)({
        value: value15 ?? NaN,
        step: step,
        min: min2,
        max: max,
        origin: scrubOrigin,
        disabled: !value16,
        onScrub: (input?: Dynamic): Dynamic => {
          value18(
            (input2?: Dynamic): Dynamic => ({
              from: input2 ? input2.from : value,
              v: input,
              hostMoved:
                !!input2 &&
                (input2.hostMoved || !Object.is(value, input2.from)),
            }),
          );
          (onScrub ?? onValue)(input);
        },
        onScrubEnd: (): Dynamic => {
          value18(null);
          onScrubEnd?.();
        },
      }),
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        value19(input);
        input.stopPropagation();
      },
      callback5: Dynamic = (): Dynamic => {
        let current: Dynamic = value2.current;
        if (current) {
          value11.current = false;
          if (current.ownerDocument.activeElement === current) {
            value9.current = true;
            try {
              current.blur();
            } finally {
              value9.current = false;
            }
          }
          current.focus({
            preventScroll: true,
          });
        }
      },
      callback6: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value21: Dynamic =
            value6 === undefined || mixed
              ? ""
              : runtime.numericInputFormatter.format(value6),
          callback7: Dynamic = (): Dynamic =>
            value11.current
              ? ((value11.current = false), (value10.current = ""), true)
              : false;
        if (callback7()) return;
        let current: Dynamic = value2.current;
        current &&
          current.ownerDocument.activeElement === current &&
          current.value !== value21 &&
          callback5();
        if (callback7()) return;
        value10.current = "";
        let value22: Dynamic = value2.current?.value ?? "",
          value23: Dynamic =
            value22 !== value21 ? Number.parseFloat(value22) : Number.NaN,
          value24: Dynamic = mixed || value22.trim() === "";
        if (value24 && !Number.isFinite(value23) && emptyStepFrom === null)
          return;
        let value25: Dynamic = Number.isFinite(value23)
            ? value23
            : value24
              ? (emptyStepFrom ?? min2 ?? 0)
              : (value6 ?? 0),
          value26: Dynamic = options.altKey
            ? value13
            : value12 * (options.shiftKey ? 10 : 1),
          value27: Dynamic = Math.min(
            20,
            Math.max(
              (0, runtime.numericInputDecimalPlaces)(value25),
              (0, runtime.numericInputDecimalPlaces)(value12),
              options.altKey
                ? (0, runtime.numericInputDecimalPlaces)(value13)
                : 0,
            ),
          ),
          value28: Dynamic = Number(
            (value25 + input * value26).toFixed(value27),
          );
        min2 !== undefined && (value28 = Math.max(min2, value28));
        max !== undefined && (value28 = Math.min(max, value28));
        (mixed || value28 !== value6) && onValue(value28);
      },
      state: Dynamic = {
        ref: value3,
        value: mixed
          ? null
          : ((value17 && !value17.hostMoved && Object.is(value17.from, value)
              ? value17.v
              : value6) ?? null),
        onValueCommitted: callback2,
        min: min2,
        max: max,
        step: value12,
        largeStep: value12 * 10,
        smallStep: value13,
        format: runtime.PropertiesNumericScrubberUseGroupingConfig,
        locale: "en-US",
        inputMode: "decimal",
        "aria-label": value14,
        disabled: disabled2,
        placeholder: mixed ? runtime.MixedValue : (placeholder ?? hint),
        onKeyDown: callback3,
        onFocus: (event?: Dynamic): Dynamic => {
          event.preventDefault();
          event.currentTarget.select();
          value10.current = "";
        },
      },
      value20: Dynamic = steppers;
    return (
      <runtime.NumberInput
        {...state}
        title={title}
        fullWidth={fullWidth}
        className={(0, runtime.joinClassNames)(
          "group/field min-w-12",
          !mixed &&
            value5 === undefined &&
            placeholder !== undefined &&
            placeholder !== runtime.MixedValue &&
            "[&_input]:placeholder:text-primary",
          className,
        )}
        slotStart={
          prefix !== undefined && prefix !== "" ? (
            <span
              data-scrub={""}
              onMouseDown={value16 ? callback4 : undefined}
              onPointerDown={
                value16 ? runtime.captureNumericPointer : undefined
              }
              className={(0, runtime.joinClassNames)(
                runtime.PropertiesNumericScrubberClassNames,
                "inline-flex items-center text-caption-medium",
                value16 && "cursor-ew-resize",
              )}
            >
              {prefix}
            </span>
          ) : undefined
        }
        slotEnd={
          value4 || value20 ? (
            <span className={"flex items-center gap-2"}>
              {value4 ? (
                <span
                  data-scrub={""}
                  onMouseDown={value16 && unitScrubs ? callback4 : undefined}
                  onPointerDown={
                    value16 && unitScrubs
                      ? runtime.captureNumericPointer
                      : undefined
                  }
                  className={(0, runtime.joinClassNames)(
                    runtime.PropertiesNumericScrubberResolvedValue,
                    value16 && unitScrubs && "cursor-ew-resize",
                  )}
                >
                  {unit}
                </span>
              ) : null}
              {value20 ? (
                <span
                  className={
                    "hidden flex-col group-focus-within/field:flex pointer-coarse:hidden!"
                  }
                >
                  <button
                    type={"button"}
                    tabIndex={-1}
                    aria-label={
                      value14
                        ? runtime.IncreaseValue + " " + value14
                        : runtime.IncreaseValue
                    }
                    className={runtime.PropertiesNumericScrubberClassNames_2}
                    disabled={disabled2}
                    onMouseDown={(event?: Dynamic): Dynamic => {
                      event.preventDefault();
                      event.button === 0 && callback5();
                    }}
                    onMouseLeave={(): Dynamic => (value11.current = false)}
                    onClick={(input?: Dynamic): Dynamic => callback6(1, input)}
                  >
                    <runtime.EditorIcon name={"CaretUp"} size={12} />
                  </button>
                  <button
                    type={"button"}
                    tabIndex={-1}
                    aria-label={
                      value14
                        ? runtime.DecreaseValue + " " + value14
                        : runtime.DecreaseValue
                    }
                    className={runtime.PropertiesNumericScrubberClassNames_2}
                    disabled={disabled2}
                    onMouseDown={(event?: Dynamic): Dynamic => {
                      event.preventDefault();
                      event.button === 0 && callback5();
                    }}
                    onMouseLeave={(): Dynamic => (value11.current = false)}
                    onClick={(input?: Dynamic): Dynamic => callback6(-1, input)}
                  >
                    <runtime.EditorIcon name={"CaretDown"} size={12} />
                  </button>
                </span>
              ) : null}
            </span>
          ) : undefined
        }
      />
    );
  }
  bindRuntimeValue(runtime, "NumericInput", () => NumericInput);
  bindRuntimeValue(
    runtime,
    "reactPropertiesNumericInput",
    () => reactPropertiesNumericInput,
    (value) => {
      reactPropertiesNumericInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesNumericInput",
    () => jsxPropertiesNumericInput,
    (value) => {
      jsxPropertiesNumericInput = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesNumericInputLimit",
    () => PropertiesNumericInputLimit,
    (value) => {
      PropertiesNumericInputLimit = value;
    },
  );
  return () => {
    reactPropertiesNumericInput = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializeCdsIndex)();
    jsxPropertiesNumericInput = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesNumericInputLimit = 12;
  };
}

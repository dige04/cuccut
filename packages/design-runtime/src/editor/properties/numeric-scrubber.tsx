/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPropertiesNumericScrubber(
  runtime: RuntimeBindings,
): () => void {
  var PropertiesNumericScrubberAlias: Dynamic;
  var jsxPropertiesNumericScrubber: Dynamic;
  var PropertiesNumericScrubberUseGroupingConfig: Dynamic;
  var numericInputFormatter: Dynamic;
  var PropertiesNumericScrubberClassNames: Dynamic;
  var PropertiesNumericScrubberResolvedValue: Dynamic;
  var PropertiesNumericScrubberClassNames_2: Dynamic;
  function decimalPlaces(input?: Dynamic): Dynamic {
    let value: Dynamic = String(input),
      value2: Dynamic = value.indexOf(".");
    return value2 === -1 || value.includes("e") ? 0 : value.length - value2 - 1;
  }
  function roundNumericStep(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = 10 ** numericStepPrecision(options);
    return Math.round(input * value) / value;
  }
  function numericStepPrecision(input?: Dynamic): Dynamic {
    return Math.max(
      2,
      decimalPlaces(input),
      Math.ceil(-Math.log10(Math.max(input, Number.EPSILON))),
    );
  }
  function snapNumericStep(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!(options > 0) || !Number.isFinite(options) || !Number.isFinite(input))
      return input + 0;
    let value: Dynamic =
        context == null && Number.isInteger(options) ? 1 : options,
      value2: Dynamic = context ?? 0,
      value3: Dynamic = (input - value2) / value,
      value4: Dynamic = Math.round(Number(value3.toPrecision(12))),
      value5: Dynamic =
        10 ** Math.max(numericStepPrecision(value), decimalPlaces(value2)),
      value6: Dynamic =
        Math.round((value4 * value + value2) * value5) / value5 + 0;
    if (Math.abs(value3) < 1e12 && Number.isFinite(value6)) return value6;
    let value7: Dynamic = roundNumericStep(input, options) + 0;
    return Number.isFinite(value7) ? value7 : input + 0;
  }
  function stepNumericValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = {},
  ): Dynamic {
    let value2: Dynamic = value.step ?? 1,
      value3: Dynamic = Math.min(0.1, value2),
      value4: Dynamic = context.altKey
        ? value3
        : value2 * (context.shiftKey ? 10 : 1),
      value5: Dynamic = roundNumericStep(input + options * value4, value2);
    value.min != null && (value5 = Math.max(value.min, value5));
    value.max != null && (value5 = Math.min(value.max, value5));
    return value5;
  }
  function createNumericScrubber(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options,
      value2: Dynamic = null,
      flag: Dynamic = false;
    return {
      move(input2: Dynamic, options2: Dynamic): Dynamic {
        let value3: Dynamic = input(),
          value4: Dynamic = input2 - value;
        value = input2;
        if (!flag) {
          if (value4 === 0) return;
          flag = true;
          value3.onScrubbing?.(true);
        }
        value2 == null &&
          (value2 = Number.isFinite(value3.value) ? value3.value : 0);
        let value5: Dynamic = value3.step ?? 1,
          callback: Dynamic = (input3?: Dynamic): Dynamic =>
            Math.min(
              value3.max ?? 1 / 0,
              Math.max(value3.min ?? -1 / 0, input3),
            );
        value2 = callback(value2 + value4 * value5 * (options2 ? 10 : 1));
        let value6: Dynamic =
          value2 === value3.min || value2 === value3.max
            ? value2
            : callback(snapNumericStep(value2, value5, value3.origin));
        value3.onScrub(value6 + 0);
      },
      up(): Dynamic {
        if (!flag) return;
        let value3: Dynamic = input();
        value3.onScrubbing?.(false);
        value3.onScrubEnd?.();
      },
      get live(): Dynamic {
        return flag;
      },
    };
  }
  function useNumericScrub(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactPropertiesToolOptions_2.useRef)(
      input,
    );
    value.current = input;
    let value2: Dynamic = (0, runtime.reactPropertiesToolOptions_2.useRef)(
      null,
    );
    (0, runtime.reactPropertiesToolOptions_2.useEffect)(
      (): Dynamic => (): Dynamic => {
        value2.current &&
          value2.current === PropertiesNumericScrubberAlias &&
          value2.current();
      },
      [],
    );
    return (event?: Dynamic): Dynamic => {
      if (value.current.disabled || event.button !== 0) return;
      event.preventDefault();
      let activeElement: Dynamic = (document as Dynamic).activeElement;
      activeElement &&
        activeElement !== event.currentTarget &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA") &&
        activeElement.blur?.();
      value2.current = installNumericScrubGesture(
        createNumericScrubber((): Dynamic => value.current, event.clientX),
      );
    };
  }
  function captureNumericPointer(input?: Dynamic): Dynamic {
    if (!(input.button !== 0 || input.pointerType === "touch"))
      try {
        input.currentTarget.setPointerCapture(input.pointerId);
      } catch {}
  }
  function installNumericScrubGesture(
    input?: Dynamic,
    options: Dynamic = window,
  ): Dynamic {
    PropertiesNumericScrubberAlias?.();
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value: Dynamic = input2;
        if (value.buttons === 0) {
          callback3();
          return;
        }
        input.move(value.clientX, value.shiftKey);
      },
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        event.key === "Escape" &&
          (input.live && event.preventDefault(), callback3());
      },
      callback3: Dynamic = (): Dynamic => {
        PropertiesNumericScrubberAlias === callback3 &&
          (PropertiesNumericScrubberAlias = null);
        options.removeEventListener("mousemove", callback);
        options.removeEventListener("mouseup", callback3);
        options.removeEventListener("blur", callback3);
        options.removeEventListener("keydown", callback2, true);
        input.up();
      };
    PropertiesNumericScrubberAlias = callback3;
    options.addEventListener("mousemove", callback);
    options.addEventListener("mouseup", callback3);
    options.addEventListener("blur", callback3);
    options.addEventListener("keydown", callback2, true);
    return callback3;
  }
  function numericInputDecimalPlaces(input?: Dynamic): Dynamic {
    let value: Dynamic = String(input),
      value2: Dynamic = value.indexOf(".");
    return value2 === -1 || value.includes("e") ? 0 : value.length - value2 - 1;
  }
  bindRuntimeValue(runtime, "decimalPlaces", () => decimalPlaces);
  bindRuntimeValue(runtime, "roundNumericStep", () => roundNumericStep);
  bindRuntimeValue(runtime, "numericStepPrecision", () => numericStepPrecision);
  bindRuntimeValue(runtime, "snapNumericStep", () => snapNumericStep);
  bindRuntimeValue(runtime, "stepNumericValue", () => stepNumericValue);
  bindRuntimeValue(
    runtime,
    "createNumericScrubber",
    () => createNumericScrubber,
  );
  bindRuntimeValue(runtime, "useNumericScrub", () => useNumericScrub);
  bindRuntimeValue(
    runtime,
    "captureNumericPointer",
    () => captureNumericPointer,
  );
  bindRuntimeValue(
    runtime,
    "PropertiesNumericScrubberAlias",
    () => PropertiesNumericScrubberAlias,
    (value) => {
      PropertiesNumericScrubberAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installNumericScrubGesture",
    () => installNumericScrubGesture,
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesNumericScrubber",
    () => jsxPropertiesNumericScrubber,
    (value) => {
      jsxPropertiesNumericScrubber = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesNumericScrubberUseGroupingConfig",
    () => PropertiesNumericScrubberUseGroupingConfig,
    (value) => {
      PropertiesNumericScrubberUseGroupingConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numericInputFormatter",
    () => numericInputFormatter,
    (value) => {
      numericInputFormatter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numericInputDecimalPlaces",
    () => numericInputDecimalPlaces,
  );
  bindRuntimeValue(
    runtime,
    "PropertiesNumericScrubberClassNames",
    () => PropertiesNumericScrubberClassNames,
    (value) => {
      PropertiesNumericScrubberClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesNumericScrubberResolvedValue",
    () => PropertiesNumericScrubberResolvedValue,
    (value) => {
      PropertiesNumericScrubberResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesNumericScrubberClassNames_2",
    () => PropertiesNumericScrubberClassNames_2,
    (value) => {
      PropertiesNumericScrubberClassNames_2 = value;
    },
  );
  return () => {
    PropertiesNumericScrubberAlias = null;
    jsxPropertiesNumericScrubber = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesNumericScrubberUseGroupingConfig = {
      useGrouping: false,
    };
    numericInputFormatter = new Intl.NumberFormat(
      "en-US",
      PropertiesNumericScrubberUseGroupingConfig,
    );
    PropertiesNumericScrubberClassNames = "select-none text-muted";
    PropertiesNumericScrubberResolvedValue =
      PropertiesNumericScrubberClassNames + " text-caption";
    PropertiesNumericScrubberClassNames_2 =
      "flex h-2.5 w-3 items-center justify-center rounded-sm text-muted outline-none hover:text-primary disabled:opacity-50";
  };
}

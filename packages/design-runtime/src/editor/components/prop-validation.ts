/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorComponentsPropValidation(
  runtime: RuntimeBindings,
): () => void {
  var ComponentsPropValidationLimit: Dynamic;
  var ComponentsPropValidationLimit_2: Dynamic;
  var ComponentsPropValidationLimitAlias: Dynamic;
  var ComponentsPropValidationLimit_3: Dynamic;
  var ComponentsPropValidationConstant: Dynamic;
  var ComponentsPropValidationConstant_2: Dynamic;
  var ComponentsPropValidationConstant_3: Dynamic;
  var ComponentsPropValidationConstant_4: Dynamic;
  var ComponentsPropValidationResolvedValue: Dynamic;
  var ComponentsPropValidationLimit_4: Dynamic;
  var ComponentsPropValidationMinMaxStepSet: Dynamic;
  var ComponentsPropValidationPrototypeValue: Dynamic;
  var ComponentsPropValidationBootedHasPropsLifecycleCallbacksConfig: Dynamic;
  function normalizePropString(items?: Dynamic): Dynamic {
    return typeof items == "string" &&
      items.length <= ComponentsPropValidationLimitAlias
      ? items
      : "";
  }
  function truncatePropText(items?: Dynamic, options?: Dynamic): Dynamic {
    return items.length > options
      ? [...items.slice(0, options)].join("")
      : items;
  }
  function finitePropNumber(input?: Dynamic): Dynamic {
    let value: Dynamic =
      typeof input == "number"
        ? input
        : typeof input == "string" && input.trim() !== ""
          ? Number(input)
          : NaN;
    return Number.isFinite(value) ? value : undefined;
  }
  function normalizePropOptionValue(input?: Dynamic): Dynamic {
    return typeof input == "string"
      ? truncatePropText(input, ComponentsPropValidationConstant_3)
      : input === null || typeof input == "number" || typeof input == "boolean"
        ? input
        : "";
  }
  function mapBoundedArray(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Math.min(items.length, options),
      items2: Dynamic = [];
    for (let index: Dynamic = 0; index < value; index++)
      items2.push(context(items[index]));
    return items2;
  }
  function normalizePropOption(input?: Dynamic): Dynamic {
    if (Array.isArray(input))
      return mapBoundedArray(
        input,
        ComponentsPropValidationConstant_2,
        normalizePropOptionValue,
      );
    if (input !== null && typeof input == "object" && "value" in input) {
      let value: Dynamic = input;
      return {
        value: normalizePropOptionValue(value.value),
        ...("label" in value
          ? {
              label: normalizePropOptionValue(value.label),
            }
          : {}),
      };
    }
    return normalizePropOptionValue(input);
  }
  function chargePropObjectBudget(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 0,
  ): Dynamic {
    if (options.left <= 0) return false;
    switch (typeof items) {
      case "string":
        options.left -= items.length + 2;
        break;
      case "number":
        options.left -= 8;
        break;
      case "boolean":
      case "undefined":
        options.left -= 4;
        break;
      case "object":
        if (items === null) {
          options.left -= 4;
          break;
        }
        if (value >= ComponentsPropValidationLimit_4 || context.has(items))
          return false;
        if (((options.left -= 2), Array.isArray(items))) {
          context.add(items);
          for (let value2 of items as Dynamic)
            if (
              ((options.left -= 1),
              !chargePropObjectBudget(value2, options, context, value + 1))
            )
              return false;
          for (let value2 in items)
            if (
              Object.hasOwn(items, value2) &&
              !isBoundedArrayIndex(value2, items.length)
            )
              return false;
        } else if (isPlainPropRecord(items)) {
          context.add(items);
          for (let value2 in items)
            if (
              Object.hasOwn(items, value2) &&
              ((options.left -= value2.length + 3),
              !chargePropObjectBudget(
                items[value2],
                options,
                context,
                value + 1,
              ))
            )
              return false;
        } else return false;
        break;
      default:
        return false;
    }
    return options.left > 0;
  }
  function isPlainPropRecord(input?: Dynamic): Dynamic {
    if (input === null || typeof input != "object" || Array.isArray(input))
      return false;
    let value: Dynamic = Object.getPrototypeOf(input);
    return value === Object.prototype || value === null;
  }
  function isBoundedArrayIndex(items?: Dynamic, options?: Dynamic): Dynamic {
    return items.length === 0 ||
      items.length > 10 ||
      !(items === "0" || /^[1-9][0-9]*$/.test(items))
      ? false
      : Number(items) < options;
  }
  function isPrimitiveProp(input?: Dynamic): Dynamic {
    let value: Dynamic = typeof input;
    return (
      input === null ||
      value === "string" ||
      value === "number" ||
      value === "boolean"
    );
  }
  function isUnsafePropKey(items?: Dynamic): Dynamic {
    return (
      items.length > ComponentsPropValidationLimit_2 ||
      items in ComponentsPropValidationPrototypeValue
    );
  }
  function normalizePropMetadata(input?: Dynamic, options?: Dynamic): Dynamic {
    let state: Dynamic = {},
      index: Dynamic = 0;
    for (let value in input) {
      if (!Object.hasOwn(input, value)) continue;
      if (index++ >= ComponentsPropValidationLimit_3) break;
      if (isUnsafePropKey(value)) continue;
      let value2: Dynamic = input[value];
      if (value === "default" || value === "options") state[value] = value2;
      else if (ComponentsPropValidationMinMaxStepSet.has(value)) {
        let value3: Dynamic = finitePropNumber(value2);
        value3 !== undefined &&
          (value !== "step" || value3 > 0) &&
          (state[value] = value3);
      } else
        typeof value2 == "string"
          ? (state[value] = truncatePropText(
              value2,
              ComponentsPropValidationConstant_4,
            ))
          : isPrimitiveProp(value2) && (state[value] = value2);
    }
    "options" in state &&
      (state.options = Array.isArray(state.options)
        ? mapBoundedArray(
            state.options,
            ComponentsPropValidationConstant,
            normalizePropOption,
          )
        : []);
    "default" in state &&
      (typeof state.default == "string"
        ? (state.default = truncatePropText(
            state.default,
            runtime.ComponentsPropsResolvedValue,
          ))
        : chargePropObjectBudget(
            state.default,
            {
              left: ComponentsPropValidationResolvedValue,
            },
            options,
          ) || delete state.default);
    return state;
  }
  function normalizePropValues(input?: Dynamic): Dynamic {
    let state: Dynamic = {},
      value: Dynamic = new WeakSet([input]);
    for (let [value2, value3] of Object.entries(input) as Dynamic)
      isUnsafePropKey(value2) ||
        (typeof value3 == "string"
          ? (state[value2] = truncatePropText(
              value3,
              runtime.ComponentsPropsResolvedValue,
            ))
          : chargePropObjectBudget(
              value3,
              {
                left: ComponentsPropValidationResolvedValue,
              },
              value,
            ) && (state[value2] = value3));
    return state;
  }
  function parsePropsMetadata(input?: Dynamic): Dynamic {
    if (!isPlainPropRecord(input)) return {};
    let state: Dynamic = {},
      value: Dynamic = new WeakSet([input]),
      index: Dynamic = 0;
    for (let value2 in input) {
      if (!Object.hasOwn(input, value2)) continue;
      if (index++ >= ComponentsPropValidationLimit) break;
      if (isUnsafePropKey(value2)) continue;
      let value3: Dynamic = input[value2];
      !isPlainPropRecord(value3) ||
        value.has(value3) ||
        (value.add(value3),
        (state[value2] = normalizePropMetadata(value3, value)));
    }
    return state;
  }
  function equalPropValues(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      input === options ||
      (typeof input == "object" &&
        typeof options == "object" &&
        JSON.stringify(input) === JSON.stringify(options))
    );
  }
  function getPropCurrentValue(input?: Dynamic, options?: Dynamic): Dynamic {
    return Object.hasOwn(input.values, options)
      ? input.values[options]
      : input.propsMeta[options]?.default;
  }
  function overridePropDefault(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return !input.isSaving() &&
      equalPropValues(context, input.currentDefault(options))
      ? undefined
      : context;
  }
  function omitUnchangedProps(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = null;
    for (let [value2, value3] of Object.entries(options) as Dynamic)
      Object.hasOwn(input, value2) &&
        equalPropValues(input[value2], value3) &&
        ((value ??= {
          ...input,
        }),
        delete value[value2]);
    return value ?? input;
  }
  function isEditablePropMetadata(input?: Dynamic): Dynamic {
    return (
      !!input &&
      (input.editor === "text" ||
        input.editor === "color" ||
        input.editor === "int" ||
        input.editor === "float" ||
        input.editor === "range" ||
        input.editor === "boolean" ||
        input.editor === "enum")
    );
  }
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationLimit",
    () => ComponentsPropValidationLimit,
    (value) => {
      ComponentsPropValidationLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationLimit_2",
    () => ComponentsPropValidationLimit_2,
    (value) => {
      ComponentsPropValidationLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationLimitAlias",
    () => ComponentsPropValidationLimitAlias,
    (value) => {
      ComponentsPropValidationLimitAlias = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePropString", () => normalizePropString);
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationLimit_3",
    () => ComponentsPropValidationLimit_3,
    (value) => {
      ComponentsPropValidationLimit_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationConstant",
    () => ComponentsPropValidationConstant,
    (value) => {
      ComponentsPropValidationConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationConstant_2",
    () => ComponentsPropValidationConstant_2,
    (value) => {
      ComponentsPropValidationConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationConstant_3",
    () => ComponentsPropValidationConstant_3,
    (value) => {
      ComponentsPropValidationConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationConstant_4",
    () => ComponentsPropValidationConstant_4,
    (value) => {
      ComponentsPropValidationConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationResolvedValue",
    () => ComponentsPropValidationResolvedValue,
    (value) => {
      ComponentsPropValidationResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationLimit_4",
    () => ComponentsPropValidationLimit_4,
    (value) => {
      ComponentsPropValidationLimit_4 = value;
    },
  );
  bindRuntimeValue(runtime, "truncatePropText", () => truncatePropText);
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationMinMaxStepSet",
    () => ComponentsPropValidationMinMaxStepSet,
    (value) => {
      ComponentsPropValidationMinMaxStepSet = value;
    },
  );
  bindRuntimeValue(runtime, "finitePropNumber", () => finitePropNumber);
  bindRuntimeValue(
    runtime,
    "normalizePropOptionValue",
    () => normalizePropOptionValue,
  );
  bindRuntimeValue(runtime, "mapBoundedArray", () => mapBoundedArray);
  bindRuntimeValue(runtime, "normalizePropOption", () => normalizePropOption);
  bindRuntimeValue(
    runtime,
    "chargePropObjectBudget",
    () => chargePropObjectBudget,
  );
  bindRuntimeValue(runtime, "isPlainPropRecord", () => isPlainPropRecord);
  bindRuntimeValue(runtime, "isBoundedArrayIndex", () => isBoundedArrayIndex);
  bindRuntimeValue(runtime, "isPrimitiveProp", () => isPrimitiveProp);
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationPrototypeValue",
    () => ComponentsPropValidationPrototypeValue,
    (value) => {
      ComponentsPropValidationPrototypeValue = value;
    },
  );
  bindRuntimeValue(runtime, "isUnsafePropKey", () => isUnsafePropKey);
  bindRuntimeValue(
    runtime,
    "normalizePropMetadata",
    () => normalizePropMetadata,
  );
  bindRuntimeValue(runtime, "normalizePropValues", () => normalizePropValues);
  bindRuntimeValue(runtime, "parsePropsMetadata", () => parsePropsMetadata);
  bindRuntimeValue(runtime, "equalPropValues", () => equalPropValues);
  bindRuntimeValue(runtime, "getPropCurrentValue", () => getPropCurrentValue);
  bindRuntimeValue(runtime, "overridePropDefault", () => overridePropDefault);
  bindRuntimeValue(runtime, "omitUnchangedProps", () => omitUnchangedProps);
  bindRuntimeValue(
    runtime,
    "isEditablePropMetadata",
    () => isEditablePropMetadata,
  );
  bindRuntimeValue(
    runtime,
    "ComponentsPropValidationBootedHasPropsLifecycleCallbacksConfig",
    () => ComponentsPropValidationBootedHasPropsLifecycleCallbacksConfig,
    (value) => {
      ComponentsPropValidationBootedHasPropsLifecycleCallbacksConfig = value;
    },
  );
  return () => {
    ComponentsPropValidationLimit = 128;
    ComponentsPropValidationLimit_2 = 256;
    ComponentsPropValidationLimitAlias = ComponentsPropValidationLimit_2;
    ComponentsPropValidationLimit_3 = 32;
    ComponentsPropValidationConstant = 64;
    ComponentsPropValidationConstant_2 = 5;
    ComponentsPropValidationConstant_3 = 256;
    ComponentsPropValidationConstant_4 = 4096;
    ComponentsPropValidationResolvedValue = 16 * 1024;
    ComponentsPropValidationLimit_4 = 64;
    ComponentsPropValidationMinMaxStepSet = new Set(["min", "max", "step"]);
    ComponentsPropValidationPrototypeValue = Object.prototype;
    ComponentsPropValidationBootedHasPropsLifecycleCallbacksConfig = {
      booted: false,
      hasProps: false,
      lifecycleCallbacks: {
        onDcBooted: (): Dynamic => {},
      },
      propsMeta: {},
      values: {},
      setProp: (): Dynamic => {},
      reset: (): Dynamic => {},
      dirty: false,
      saveAsDefaults: async (): Promise<Dynamic> => {},
      adoptSavedDefaults: (): Dynamic => {},
      saving: false,
      isSaving: (): Dynamic => false,
      currentDefault: (): Dynamic => {},
    };
  };
}

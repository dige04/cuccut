/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorStyleSchemaStructuredValues(
  runtime: RuntimeBindings,
): () => void {
  var StyleSchemaValuesHandlerValue_8: Dynamic;
  var StyleSchemaValuesHandlerValue_9: Dynamic;
  var StyleSchemaValuesHandlerValue_10: Dynamic;
  var StyleSchemaValuesHandlerValue_11: Dynamic;
  var StyleSchemaValuesHandlerValue_12: Dynamic;
  var StyleSchemaValuesHandlerValue_13: Dynamic;
  var StyleSchemaValuesHandlerValue_14: Dynamic;
  var StyleSchemaValuesHandlerValue_15: Dynamic;
  function validateStyleFields(input?: Dynamic, options?: Dynamic): Dynamic {
    if (!(0, runtime.isStyleObject)(options)) return;
    let value: Dynamic = Object.create(null),
      index: Dynamic = 0;
    for (let value2 of input as Dynamic) {
      if (!(0, runtime.StyleSchemaColorAndFontCall)(options, value2.field))
        continue;
      let value3: Dynamic = (0, runtime.validateStyleNumber)(
        value2.cls,
        options[value2.field],
      );
      if (value3 === undefined) return;
      value[value2.field] = value3;
      index += 1;
    }
    return index > 0 ? value : undefined;
  }
  function validateStyleLength(input?: Dynamic): Dynamic {
    if (!(0, runtime.isStyleObject)(input)) return;
    let value: Dynamic = (0, runtime.StyleSchemaColorAndFontCall)(input, "px"),
      value2: Dynamic = (0, runtime.StyleSchemaColorAndFontCall)(input, "pct");
    if (value === value2) return;
    if (value) {
      let value4: Dynamic = (0, runtime.validateStyleNumber)(
        StyleSchemaValuesHandlerValue_8,
        input.px,
      );
      return value4 === undefined
        ? undefined
        : {
            px: value4,
          };
    }
    let value3: Dynamic = (0, runtime.validateStyleNumber)(
      StyleSchemaValuesHandlerValue_9,
      input.pct,
    );
    return value3 === undefined
      ? undefined
      : {
          pct: value3,
        };
  }
  function validateStyleTransition(input?: Dynamic): Dynamic {
    if (!(0, runtime.isStyleObject)(input)) return;
    let value: Dynamic,
      properties: Dynamic = input.properties;
    if (properties === undefined || properties === "all")
      value = [...runtime.StyleSchemaValuesTransformOpacityColorValues];
    else {
      let value5: Dynamic = Array.isArray(properties)
        ? properties
        : [properties];
      if (
        value5.length === 0 ||
        value5.length >
          runtime.StyleSchemaValuesTransformOpacityColorValues.length
      )
        return;
      let items: Dynamic = [];
      for (let value6 of value5 as Dynamic) {
        let value7: Dynamic = (0, runtime.validateStyleEnum)(
          runtime.StyleSchemaValuesTransformOpacityColorValues,
          value6,
        );
        if (value7 === undefined) return;
        items.includes(value7) || items.push(value7);
      }
      value = items;
    }
    let value2: Dynamic = (0, runtime.validateOptionalStyleNumber)(
        StyleSchemaValuesHandlerValue_10,
        input.duration,
        200,
      ),
      value3: Dynamic = (0, runtime.validateOptionalStyleNumber)(
        StyleSchemaValuesHandlerValue_11,
        input.delay,
        0,
      ),
      value4: Dynamic =
        input.easing === undefined
          ? "ease"
          : (0, runtime.validateStyleEnum)(
              runtime.StyleSchemaNodeTypesLinearEaseEaseInValues,
              input.easing,
            );
    if (!(value2 === undefined || value3 === undefined || value4 === undefined))
      return {
        properties: value,
        duration: value2,
        delay: value3,
        easing: value4,
      };
  }
  function validateStyleValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.getPropertyValidationClass)(
      input,
      context,
    );
    switch (value.kind) {
      case "len":
      case "num":
      case "int":
        return (0, runtime.validateStyleNumber)(value, options);
      case "enum":
        return (0, runtime.validateStyleEnum)(value.values, options);
      case "color":
        return (0, runtime.validateStyleColor)(options);
      case "fontFamily":
        return (0, runtime.validateFontFamily)(options);
      case "shadow":
        return (0, runtime.validateStyleShadows)(
          options,
          value.spread,
          value.blur,
        );
      case "gradient":
        return (0, runtime.validateStyleGradient)(
          options,
          value.repeat === true,
        );
      case "filter":
        return validateStyleFields(runtime.StyleSchemaValuesItems, options);
      case "transform":
        return validateStyleFields(runtime.StyleSchemaValuesItems_2, options);
      case "size":
        return validateStyleLength(options);
      case "transition":
        return validateStyleTransition(options);
      case "animation":
        return;
    }
  }
  bindRuntimeValue(runtime, "validateStyleFields", () => validateStyleFields);
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_8",
    () => StyleSchemaValuesHandlerValue_8,
    (value) => {
      StyleSchemaValuesHandlerValue_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_9",
    () => StyleSchemaValuesHandlerValue_9,
    (value) => {
      StyleSchemaValuesHandlerValue_9 = value;
    },
  );
  bindRuntimeValue(runtime, "validateStyleLength", () => validateStyleLength);
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_10",
    () => StyleSchemaValuesHandlerValue_10,
    (value) => {
      StyleSchemaValuesHandlerValue_10 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_11",
    () => StyleSchemaValuesHandlerValue_11,
    (value) => {
      StyleSchemaValuesHandlerValue_11 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateStyleTransition",
    () => validateStyleTransition,
  );
  bindRuntimeValue(runtime, "validateStyleValue", () => validateStyleValue);
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_12",
    () => StyleSchemaValuesHandlerValue_12,
    (value) => {
      StyleSchemaValuesHandlerValue_12 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_13",
    () => StyleSchemaValuesHandlerValue_13,
    (value) => {
      StyleSchemaValuesHandlerValue_13 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_14",
    () => StyleSchemaValuesHandlerValue_14,
    (value) => {
      StyleSchemaValuesHandlerValue_14 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_15",
    () => StyleSchemaValuesHandlerValue_15,
    (value) => {
      StyleSchemaValuesHandlerValue_15 = value;
    },
  );
  return () => {
    StyleSchemaValuesHandlerValue_8 = (0, runtime.StyleSchemaValuesHandler)(
      0,
      4096,
    );
    StyleSchemaValuesHandlerValue_9 = (0, runtime.StyleSchemaValuesHandler_2)(
      1,
      100,
    );
    StyleSchemaValuesHandlerValue_10 = (0, runtime.StyleSchemaValuesHandler_2)(
      0,
      5e3,
    );
    StyleSchemaValuesHandlerValue_11 = (0, runtime.StyleSchemaValuesHandler_2)(
      0,
      5e3,
    );
    StyleSchemaValuesHandlerValue_12 = (0, runtime.StyleSchemaValuesHandler_2)(
      200,
      1e4,
    );
    StyleSchemaValuesHandlerValue_13 = (0, runtime.StyleSchemaValuesHandler_2)(
      0,
      5e3,
    );
    StyleSchemaValuesHandlerValue_14 = (0, runtime.StyleSchemaValuesHandler_3)(
      1,
      1e3,
      1,
    );
    StyleSchemaValuesHandlerValue_15 = (0, runtime.StyleSchemaValuesHandler_2)(
      0,
      100,
    );
  };
}

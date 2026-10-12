/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorStyleSchemaShadow(
  runtime: RuntimeBindings,
): () => void {
  var StyleSchemaShadowXYBlurConfig: Dynamic;
  var styleFieldBoundsValue: Dynamic;
  var styleFieldBoundsValue_2: Dynamic;
  function numericStyleBounds(input?: Dynamic): Dynamic {
    return {
      min: input.lo,
      max: input.hi,
    };
  }
  function styleFieldBounds(input?: Dynamic): Dynamic {
    let state: Dynamic = {};
    for (let value of input as Dynamic)
      state[value.field] = numericStyleBounds(value.cls);
    return state;
  }
  function shadowFieldBounds(input?: Dynamic): Dynamic {
    return input?.kind === "shadow" && input.blur !== undefined
      ? {
          ...StyleSchemaShadowXYBlurConfig,
          blur: numericStyleBounds(input.blur),
        }
      : StyleSchemaShadowXYBlurConfig;
  }
  function validateStyleShadows(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Array.isArray(input) ? input : [input];
    if (value.length === 0 || value.length > runtime.StyleSchemaValuesLimit)
      return;
    let items: Dynamic = [];
    for (let value2 of value as Dynamic) {
      let value3: Dynamic = validateStyleShadow(value2, options, context);
      if (value3 === undefined) return;
      items.push(value3);
    }
    return items;
  }
  function validateStyleShadow(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = runtime.StyleSchemaValuesHandlerValue_2,
  ): Dynamic {
    if (!(0, runtime.isStyleObject)(input)) return;
    let value: Dynamic = (0, runtime.validateOptionalStyleNumber)(
        runtime.StyleSchemaValuesHandlerValue,
        input.x,
        0,
      ),
      value2: Dynamic = (0, runtime.validateOptionalStyleNumber)(
        runtime.StyleSchemaValuesHandlerValue,
        input.y,
        0,
      ),
      value3: Dynamic = (0, runtime.validateOptionalStyleNumber)(
        context,
        input.blur,
        0,
      ),
      value4: Dynamic = (0, runtime.validateStyleColor)(input.color);
    if (
      value === undefined ||
      value2 === undefined ||
      value3 === undefined ||
      value4 === undefined
    )
      return;
    if (!options)
      return {
        x: value,
        y: value2,
        blur: value3,
        color: value4,
      };
    let value5: Dynamic = (0, runtime.validateOptionalStyleNumber)(
      runtime.StyleSchemaValuesHandlerValue_3,
      input.spread,
      0,
    );
    if (value5 !== undefined)
      return input.inset === true
        ? {
            x: value,
            y: value2,
            blur: value3,
            spread: value5,
            inset: true,
            color: value4,
          }
        : {
            x: value,
            y: value2,
            blur: value3,
            spread: value5,
            color: value4,
          };
  }
  bindRuntimeValue(runtime, "numericStyleBounds", () => numericStyleBounds);
  bindRuntimeValue(runtime, "styleFieldBounds", () => styleFieldBounds);
  bindRuntimeValue(
    runtime,
    "StyleSchemaShadowXYBlurConfig",
    () => StyleSchemaShadowXYBlurConfig,
    (value) => {
      StyleSchemaShadowXYBlurConfig = value;
    },
  );
  bindRuntimeValue(runtime, "shadowFieldBounds", () => shadowFieldBounds);
  bindRuntimeValue(
    runtime,
    "styleFieldBoundsValue",
    () => styleFieldBoundsValue,
    (value) => {
      styleFieldBoundsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "styleFieldBoundsValue_2",
    () => styleFieldBoundsValue_2,
    (value) => {
      styleFieldBoundsValue_2 = value;
    },
  );
  bindRuntimeValue(runtime, "validateStyleShadows", () => validateStyleShadows);
  bindRuntimeValue(runtime, "validateStyleShadow", () => validateStyleShadow);
  return () => {
    StyleSchemaShadowXYBlurConfig = {
      x: numericStyleBounds(runtime.StyleSchemaValuesHandlerValue),
      y: numericStyleBounds(runtime.StyleSchemaValuesHandlerValue),
      blur: numericStyleBounds(runtime.StyleSchemaValuesHandlerValue_2),
      spread: numericStyleBounds(runtime.StyleSchemaValuesHandlerValue_3),
    };
    styleFieldBoundsValue = styleFieldBounds(runtime.StyleSchemaValuesItems);
    styleFieldBoundsValue_2 = styleFieldBounds(
      runtime.StyleSchemaValuesItems_2,
    );
  };
}

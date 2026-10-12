/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorStyleSchemaColorAndFont(
  runtime: RuntimeBindings,
): () => void {
  var StyleSchemaColorAndFontTest: Dynamic;
  var StyleSchemaColorAndFontCall: Dynamic;
  var StyleSchemaValuesHandlerValue: Dynamic;
  var StyleSchemaValuesHandlerValue_2: Dynamic;
  var StyleSchemaValuesHandlerValue_3: Dynamic;
  function validateStyleColor(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.validateSimpleStyleString)(input);
    if (value === undefined) return;
    let value2: Dynamic = value.toLowerCase();
    if (
      !(
        runtime.StyleSchemaValidationSubscribers.has(value2) ||
        runtime.StyleSchemaValidationPattern.test(value2) ||
        runtime.rgbStyleColorPattern.test(value2) ||
        runtime.hslStyleColorPattern.test(value2) ||
        runtime.oklchStyleColorPattern.test(value2) ||
        runtime.labStyleColorPattern.test(value2)
      )
    )
      return;
    let CSS2: Dynamic = (globalThis as Dynamic).CSS;
    if (
      !(
        CSS2 !== undefined &&
        typeof CSS2.supports == "function" &&
        !CSS2.supports("color", value2)
      )
    )
      return value2;
  }
  function validateFontFamily(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.validateStyleEnum)(
      runtime.StyleSchemaNodeTypesSansSerifMonoValues,
      input,
    );
    if (value !== undefined) return value;
    if (!(0, runtime.isStyleObject)(input)) return;
    let { family: value2, webSafe: value3 }: Dynamic = input,
      value4: Dynamic = (0, runtime.validateStyleEnum)(
        runtime.StyleSchemaNodeTypesSansSerifMonoValues,
        input.fallback,
      );
    if (!(!StyleSchemaColorAndFontTest(value2) || value4 === undefined))
      return value3 === undefined
        ? {
            family: value2,
            fallback: value4,
          }
        : StyleSchemaColorAndFontTest(value3)
          ? {
              family: value2,
              fallback: value4,
              webSafe: value3,
            }
          : undefined;
  }
  bindRuntimeValue(runtime, "validateStyleColor", () => validateStyleColor);
  bindRuntimeValue(
    runtime,
    "StyleSchemaColorAndFontTest",
    () => StyleSchemaColorAndFontTest,
    (value) => {
      StyleSchemaColorAndFontTest = value;
    },
  );
  bindRuntimeValue(runtime, "validateFontFamily", () => validateFontFamily);
  bindRuntimeValue(
    runtime,
    "StyleSchemaColorAndFontCall",
    () => StyleSchemaColorAndFontCall,
    (value) => {
      StyleSchemaColorAndFontCall = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue",
    () => StyleSchemaValuesHandlerValue,
    (value) => {
      StyleSchemaValuesHandlerValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_2",
    () => StyleSchemaValuesHandlerValue_2,
    (value) => {
      StyleSchemaValuesHandlerValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_3",
    () => StyleSchemaValuesHandlerValue_3,
    (value) => {
      StyleSchemaValuesHandlerValue_3 = value;
    },
  );
  return () => {
    StyleSchemaColorAndFontTest = (input?: Dynamic): Dynamic =>
      typeof input == "string" &&
      runtime.StyleSchemaNodeTypesAZaZAZaZPattern.test(input) &&
      !runtime.StyleSchemaNodeTypesSubscribers.has(input.toLowerCase());
    StyleSchemaColorAndFontCall = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => Object.prototype.hasOwnProperty.call(input, options);
    StyleSchemaValuesHandlerValue = (0, runtime.StyleSchemaValuesHandler)(
      -64,
      64,
    );
    StyleSchemaValuesHandlerValue_2 = (0, runtime.StyleSchemaValuesHandler)(
      0,
      64,
    );
    StyleSchemaValuesHandlerValue_3 = (0, runtime.StyleSchemaValuesHandler)(
      -32,
      32,
    );
  };
}

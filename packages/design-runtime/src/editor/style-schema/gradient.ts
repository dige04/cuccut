/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorStyleSchemaGradient(
  runtime: RuntimeBindings,
): () => void {
  var StyleSchemaValuesHandlerValue_4: Dynamic;
  var StyleSchemaValuesHandlerValue_5: Dynamic;
  var StyleSchemaValuesHandlerValue_6: Dynamic;
  var StyleSchemaValuesHandlerValue_7: Dynamic;
  var StyleSchemaGradientLimit: Dynamic;
  var StyleSchemaGradientLimit_2: Dynamic;
  function validateStyleGradient(
    input?: Dynamic,
    options: Dynamic = false,
  ): Dynamic {
    if (!(0, runtime.isStyleObject)(input)) return;
    let value: Dynamic = (0, runtime.validateOptionalStyleNumber)(
      StyleSchemaValuesHandlerValue_4,
      input.angle,
      180,
    );
    if (value === undefined) return;
    let stops: Dynamic = input.stops;
    if (
      !Array.isArray(stops) ||
      stops.length < StyleSchemaGradientLimit ||
      stops.length > StyleSchemaGradientLimit_2
    )
      return;
    let length: Dynamic = stops.length,
      items: Dynamic = [];
    for (let index: Dynamic = 0; index < length; index += 1) {
      let value7: Dynamic = stops[index];
      if (!(0, runtime.isStyleObject)(value7)) return;
      let value8: Dynamic = (0, runtime.validateStyleColor)(value7.color),
        value9: Dynamic = (0, runtime.validateOptionalStyleNumber)(
          StyleSchemaValuesHandlerValue_5,
          value7.pos,
          (index / (length - 1)) * 100,
        );
      if (value8 === undefined || value9 === undefined) return;
      items.push({
        color: value8,
        pos: value9,
      });
    }
    items.sort(
      (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        input2.pos - options2.pos,
    );
    let value2: Dynamic = options && input.repeat !== undefined,
      value3: Dynamic = value2
        ? (0, runtime.validateStyleNumber)(
            StyleSchemaValuesHandlerValue_7,
            input.repeat,
          )
        : undefined;
    if (value2 && value3 === undefined) return;
    let value4: Dynamic = items[length - 1];
    value3 !== undefined &&
      input.radial !== true &&
      value4.pos < 100 &&
      (length < StyleSchemaGradientLimit_2
        ? items.push({
            color: value4.color,
            pos: 100,
          })
        : (items[length - 1] = {
            color: value4.color,
            pos: 100,
          }));
    let value5: Dynamic;
    if ((0, runtime.isStyleObject)(input.at)) {
      let value7: Dynamic = (0, runtime.validateStyleNumber)(
          StyleSchemaValuesHandlerValue_6,
          input.at.x,
        ),
        value8: Dynamic = (0, runtime.validateStyleNumber)(
          StyleSchemaValuesHandlerValue_6,
          input.at.y,
        );
      value7 !== undefined &&
        value8 !== undefined &&
        (value7 !== 50 || value8 !== 50) &&
        (value5 = {
          x: value7,
          y: value8,
        });
    }
    let value6: Dynamic =
      runtime.StyleSchemaValuesClosestSideClosestCornerFarthestSideValues.includes(
        input.extent,
      )
        ? input.extent
        : undefined;
    return {
      angle: value,
      ...(input.radial === true
        ? {
            radial: true,
          }
        : {}),
      ...(input.shape === "ellipse"
        ? {
            shape: "ellipse",
          }
        : {}),
      ...(value6 !== undefined
        ? {
            extent: value6,
          }
        : {}),
      ...(value5 !== undefined
        ? {
            at: value5,
          }
        : {}),
      ...(value3 !== undefined
        ? {
            repeat: value3,
          }
        : {}),
      stops: items,
    };
  }
  function radialGradientPrefix(input?: Dynamic): Dynamic {
    let value: Dynamic =
        runtime.StyleSchemaValuesClosestSideClosestCornerFarthestSideValues.find(
          (input2?: Dynamic): Dynamic => input2 === input.extent,
        ),
      at: Dynamic = input.at,
      value2: Dynamic =
        (0, runtime.isStyleObject)(at) &&
        typeof at.x == "number" &&
        typeof at.y == "number" &&
        Number.isFinite(at.x) &&
        Number.isFinite(at.y)
          ? `at ${at.x}% ${at.y}%`
          : undefined;
    return [input.shape === "ellipse" ? "ellipse" : "circle", value, value2]
      .filter((input2?: Dynamic): Dynamic => input2 !== undefined)
      .join(" ");
  }
  function radialGradientFunction(input?: Dynamic): Dynamic {
    let value: Dynamic = radialGradientPrefix(input);
    return value === "ellipse"
      ? "radial-gradient("
      : "radial-gradient(" + value + ", ";
  }
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_4",
    () => StyleSchemaValuesHandlerValue_4,
    (value) => {
      StyleSchemaValuesHandlerValue_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_5",
    () => StyleSchemaValuesHandlerValue_5,
    (value) => {
      StyleSchemaValuesHandlerValue_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_6",
    () => StyleSchemaValuesHandlerValue_6,
    (value) => {
      StyleSchemaValuesHandlerValue_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValuesHandlerValue_7",
    () => StyleSchemaValuesHandlerValue_7,
    (value) => {
      StyleSchemaValuesHandlerValue_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaGradientLimit",
    () => StyleSchemaGradientLimit,
    (value) => {
      StyleSchemaGradientLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaGradientLimit_2",
    () => StyleSchemaGradientLimit_2,
    (value) => {
      StyleSchemaGradientLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateStyleGradient",
    () => validateStyleGradient,
  );
  bindRuntimeValue(runtime, "radialGradientPrefix", () => radialGradientPrefix);
  bindRuntimeValue(
    runtime,
    "radialGradientFunction",
    () => radialGradientFunction,
  );
  return () => {
    StyleSchemaValuesHandlerValue_4 = (0, runtime.StyleSchemaValuesHandler_2)(
      0,
      360,
    );
    StyleSchemaValuesHandlerValue_5 = (0, runtime.StyleSchemaValuesHandler_2)(
      0,
      100,
    );
    StyleSchemaValuesHandlerValue_6 = (0, runtime.StyleSchemaValuesHandler_2)(
      -100,
      200,
    );
    StyleSchemaValuesHandlerValue_7 = (0, runtime.StyleSchemaValuesHandler)(
      2,
      2048,
    );
    StyleSchemaGradientLimit = 2;
    StyleSchemaGradientLimit_2 = 8;
  };
}

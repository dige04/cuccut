/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorStyleSchemaCss(
  runtime: RuntimeBindings,
): () => void {
  var pixelsCss: Dynamic;
  var StyleSchemaCssTransformOpacityColorConfig: Dynamic;
  var StyleSchemaCssPositionTopRightValues: Dynamic;
  var StyleSchemaCssSupportsValue: Dynamic;
  function serializeStyleShadows(input?: Dynamic, options?: Dynamic): Dynamic {
    return input
      .map(
        (input2?: Dynamic): Dynamic =>
          options
            ? `${input2.inset === true ? "inset " : ""}${pixelsCss(input2.x)} ${pixelsCss(input2.y)} ${pixelsCss(input2.blur)} ${pixelsCss(input2.spread ?? 0)} ${input2.color}`
            : `${pixelsCss(input2.x)} ${pixelsCss(input2.y)} ${pixelsCss(input2.blur)} ${input2.color}`,
      )
      .join(", ");
  }
  function serializeStyleGradient(input?: Dynamic): Dynamic {
    if (input.repeat !== undefined && input.radial !== true) {
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          `${Math.round((input2 / 100) * input.repeat * 100) / 100}px`,
        value2: Dynamic = input.stops
          .map(
            (input2?: Dynamic): Dynamic =>
              `${input2.color} ${callback(input2.pos)}`,
          )
          .join(", ");
      return `repeating-linear-gradient(${input.angle}deg, ${value2})`;
    }
    let value: Dynamic = input.stops
      .map((input2?: Dynamic): Dynamic => `${input2.color} ${input2.pos}%`)
      .join(", ");
    return input.radial === true
      ? `${(0, runtime.radialGradientFunction)(input)}${value})`
      : `linear-gradient(${input.angle}deg, ${value})`;
  }
  function serializeStyleFilter(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value of runtime.StyleSchemaValuesItems as Dynamic) {
      let value2: Dynamic = input[value.field];
      value2 !== undefined && items.push(`${value.fn}(${value2}${value.unit})`);
    }
    return items.length > 0 ? items.join(" ") : "none";
  }
  function serializeStyleTransform(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    (input.translateX !== undefined || input.translateY !== undefined) &&
      items.push(
        `translate(${pixelsCss(input.translateX ?? 0)}, ${pixelsCss(input.translateY ?? 0)})`,
      );
    input.rotate !== undefined && items.push(`rotate(${input.rotate}deg)`);
    input.scale !== undefined && items.push(`scale(${input.scale})`);
    (input.skewX !== undefined || input.skewY !== undefined) &&
      items.push(`skew(${input.skewX ?? 0}deg, ${input.skewY ?? 0}deg)`);
    return items.length > 0 ? items.join(" ") : "none";
  }
  function serializeStyleLength(input?: Dynamic): Dynamic {
    return "px" in input ? pixelsCss(input.px) : `${input.pct}%`;
  }
  function serializeStyleTransition(input?: Dynamic): Dynamic {
    return input.properties
      .map(
        (input2?: Dynamic): Dynamic =>
          `${StyleSchemaCssTransformOpacityColorConfig[input2]} ${input.duration}ms ${input.easing} ${input.delay}ms`,
      )
      .join(", ");
  }
  function serializeStyleValue(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    switch (options) {
      case "fontSize":
      case "letterSpacing":
      case "marginTop":
      case "marginRight":
      case "marginBottom":
      case "marginLeft":
      case "paddingTop":
      case "paddingRight":
      case "paddingBottom":
      case "paddingLeft":
      case "borderWidth":
      case "borderRadius":
      case "top":
      case "right":
      case "bottom":
      case "left":
        input[options] = pixelsCss(context);
        return;
      case "fontWeight":
      case "lineHeight":
      case "opacity":
      case "zIndex":
        input[options] = context;
        return;
      case "fontFamily": {
        let value: Dynamic = context;
        input.fontFamily =
          typeof value == "string"
            ? runtime.StyleSchemaValuesSansSerifMonoConfig[value]
            : '"' +
              value.family +
              '", ' +
              (value.webSafe !== undefined ? '"' + value.webSafe + '", ' : "") +
              runtime.StyleSchemaValuesSansSerifMonoConfig[value.fallback];
        return;
      }
      case "backgroundGradient":
        input.backgroundImage = serializeStyleGradient(context);
        return;
      case "boxShadow":
        input.boxShadow = serializeStyleShadows(context, true);
        return;
      case "textShadow":
        input.textShadow = serializeStyleShadows(context, false);
        return;
      case "filter":
        input.filter = serializeStyleFilter(context);
        return;
      case "backdropFilter": {
        let value: Dynamic = serializeStyleFilter(context);
        input.backdropFilter = value;
        input.WebkitBackdropFilter = value;
        return;
      }
      case "textStrokeWidth":
        input.WebkitTextStrokeWidth = pixelsCss(context);
        input.paintOrder = "stroke";
        return;
      case "textStrokeColor":
        input.WebkitTextStrokeColor = context;
        return;
      case "borderSides": {
        let value: Dynamic = input.borderWidth ?? "medium",
          value2: Dynamic = " " + context + " ";
        input.borderWidth = ["top", "right", "bottom", "left"]
          .map(
            (input2?: Dynamic): Dynamic =>
              value2.includes(" " + input2 + " ") ? value : "0",
          )
          .join(" ");
        return;
      }
      case "borderTopWidth":
      case "borderRightWidth":
      case "borderBottomWidth":
      case "borderLeftWidth": {
        let value: Dynamic = (
            input.borderWidth === undefined
              ? ["0"]
              : String(input.borderWidth).split(" ")
          ).map(
            (input2?: Dynamic): Dynamic => (input2 === "medium" ? "0" : input2),
          ),
          value2: Dynamic =
            value.length === 4
              ? value
              : [value[0], value[0], value[0], value[0]];
        value2[
          (
            {
              borderTopWidth: 0,
              borderRightWidth: 1,
              borderBottomWidth: 2,
              borderLeftWidth: 3,
            } as Dynamic
          )[options]
        ] = pixelsCss(context);
        input.borderWidth = value2.join(" ");
        return;
      }
      case "borderTopLeftRadius":
      case "borderTopRightRadius":
      case "borderBottomRightRadius":
      case "borderBottomLeftRadius": {
        let value: Dynamic =
            input.borderRadius === undefined
              ? ["0"]
              : String(input.borderRadius).split(" "),
          value2: Dynamic =
            value.length === 4
              ? value
              : [value[0], value[0], value[0], value[0]];
        value2[
          (
            {
              borderTopLeftRadius: 0,
              borderTopRightRadius: 1,
              borderBottomRightRadius: 2,
              borderBottomLeftRadius: 3,
            } as Dynamic
          )[options]
        ] = pixelsCss(context);
        input.borderRadius = value2.join(" ");
        return;
      }
      case "transform":
        input.transform = serializeStyleTransform(context);
        return;
      case "width":
      case "height":
      case "minWidth":
      case "minHeight":
      case "maxWidth":
      case "maxHeight":
        input[options] = serializeStyleLength(context);
        return;
      case "transition":
        input.transition = serializeStyleTransition(context);
        return;
      case "animation":
        return;
      default:
        input[options] = context;
        return;
    }
  }
  function supportsPaintContainment(): Dynamic {
    let CSS2: Dynamic = (globalThis as Dynamic).CSS;
    return CSS2 === undefined || typeof CSS2.supports != "function"
      ? true
      : ((StyleSchemaCssSupportsValue ??= CSS2.supports("contain", "paint")),
        StyleSchemaCssSupportsValue);
  }
  function styleObjectToCss(input?: Dynamic, options?: Dynamic): Dynamic {
    let state: Dynamic = {},
      value: Dynamic = input;
    for (let value2 of runtime.StyleSchemaValuesItems_3 as Dynamic) {
      if (
        value2 === "animation" ||
        !(0, runtime.StyleSchemaColorAndFontCall)(value, value2) ||
        !(0, runtime.propertyAppliesToNode)(value2, options) ||
        (StyleSchemaCssPositionTopRightValues.includes(value2) &&
          !supportsPaintContainment())
      )
        continue;
      let value3: Dynamic = (0, runtime.validateStyleValue)(
        value2,
        value[value2],
        options,
      );
      value3 !== undefined && serializeStyleValue(state, value2, value3);
    }
    return state;
  }
  bindRuntimeValue(
    runtime,
    "pixelsCss",
    () => pixelsCss,
    (value) => {
      pixelsCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeStyleShadows",
    () => serializeStyleShadows,
  );
  bindRuntimeValue(
    runtime,
    "serializeStyleGradient",
    () => serializeStyleGradient,
  );
  bindRuntimeValue(runtime, "serializeStyleFilter", () => serializeStyleFilter);
  bindRuntimeValue(
    runtime,
    "serializeStyleTransform",
    () => serializeStyleTransform,
  );
  bindRuntimeValue(runtime, "serializeStyleLength", () => serializeStyleLength);
  bindRuntimeValue(
    runtime,
    "StyleSchemaCssTransformOpacityColorConfig",
    () => StyleSchemaCssTransformOpacityColorConfig,
    (value) => {
      StyleSchemaCssTransformOpacityColorConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "serializeStyleTransition",
    () => serializeStyleTransition,
  );
  bindRuntimeValue(runtime, "serializeStyleValue", () => serializeStyleValue);
  bindRuntimeValue(
    runtime,
    "StyleSchemaCssPositionTopRightValues",
    () => StyleSchemaCssPositionTopRightValues,
    (value) => {
      StyleSchemaCssPositionTopRightValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaCssSupportsValue",
    () => StyleSchemaCssSupportsValue,
    (value) => {
      StyleSchemaCssSupportsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsPaintContainment",
    () => supportsPaintContainment,
  );
  bindRuntimeValue(runtime, "styleObjectToCss", () => styleObjectToCss);
  return () => {
    pixelsCss = (input?: Dynamic): Dynamic => `${input}px`;
    StyleSchemaCssTransformOpacityColorConfig = {
      transform: "transform",
      opacity: "opacity",
      color: "color",
      backgroundColor: "background-color",
      filter: "filter",
      boxShadow: "box-shadow",
    };
    StyleSchemaCssPositionTopRightValues = [
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "zIndex",
      "float",
    ];
  };
}

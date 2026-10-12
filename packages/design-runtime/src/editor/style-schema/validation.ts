/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorStyleSchemaValidation(
  runtime: RuntimeBindings,
): () => void {
  var styleSchema: Dynamic;
  var StyleSchemaValidationTableTableCellTableHeaderValues: Dynamic;
  var StyleSchemaValidationLimit: Dynamic;
  var StyleSchemaValidationExpressionImageSetPattern: Dynamic;
  var StyleSchemaValidationPattern: Dynamic;
  var StyleSchemaValidationSubscribers: Dynamic;
  var D16D16D16Value: Dynamic;
  var StyleSchemaValidationLabel: Dynamic;
  var StyleSchemaValidationLabel_2: Dynamic;
  var rgbStyleColorPattern: Dynamic;
  var hslStyleColorPattern: Dynamic;
  var oklchStyleColorPattern: Dynamic;
  var labStyleColorPattern: Dynamic;
  function buildStyleSchema(): Dynamic {
    let value: Dynamic = Object.create(null);
    for (let value2 of runtime.StyleSchemaValuesItems_3 as Dynamic) {
      let value3: Dynamic = runtime.StyleSchemaValuesRegistry[value2];
      value[value2] = {
        value: value3.v,
        slidesValue: value3.slides,
        shapeValue: value3.shape,
        applies: value3.on,
        routed: value3.routed ?? [],
        effect: runtime.StyleSchemaValuesSubscribers_2.has(value2),
        hover: runtime.StyleSchemaValuesSubscribers_4.has(value2),
        animatable: runtime.StyleSchemaValuesSubscribers_3.has(value2),
      };
    }
    return value;
  }
  function propertyAppliesToNode(input?: Dynamic, options?: Dynamic): Dynamic {
    return input === "transform" &&
      StyleSchemaValidationTableTableCellTableHeaderValues.includes(options)
      ? false
      : styleSchema[input].applies.includes(options);
  }
  function getPropertyValidationClass(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = styleSchema[input];
    return options === "slides-shape" && value.shapeValue !== undefined
      ? value.shapeValue
      : options !== undefined &&
          value.slidesValue !== undefined &&
          (0, runtime.StyleSchemaNodeTypesStartsWith)(options)
        ? value.slidesValue
        : value.value;
  }
  function validateSimpleStyleString(input?: Dynamic): Dynamic {
    if (typeof input != "string") return;
    let value: Dynamic = input.trim();
    if (
      !(value.length === 0 || value.length > StyleSchemaValidationLimit) &&
      !StyleSchemaValidationExpressionImageSetPattern.test(value)
    )
      return value;
  }
  function isStyleObject(input?: Dynamic): Dynamic {
    return typeof input == "object" && input !== null && !Array.isArray(input);
  }
  function validateStyleNumber(source?: Dynamic, options?: Dynamic): Dynamic {
    if (typeof options != "number" || !Number.isFinite(options)) return;
    if (source.kind === "int") {
      let value2: Dynamic = Math.round(options / source.step) * source.step;
      return Math.min(source.hi, Math.max(source.lo, value2));
    }
    let value: Dynamic = Math.min(source.hi, Math.max(source.lo, options));
    return source.kind === "len"
      ? Math.round(value * 10) / 10
      : Math.round(value * 1e4) / 1e4;
  }
  function validateOptionalStyleNumber(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return options === undefined
      ? context
      : validateStyleNumber(input, options);
  }
  function validateStyleEnum(input?: Dynamic, options?: Dynamic): Dynamic {
    if (typeof options != "string") return;
    let value: Dynamic = options.trim();
    if (!(value.length === 0 || value.length > StyleSchemaValidationLimit))
      return input.includes(value) ? value : undefined;
  }
  bindRuntimeValue(runtime, "buildStyleSchema", () => buildStyleSchema);
  bindRuntimeValue(
    runtime,
    "styleSchema",
    () => styleSchema,
    (value) => {
      styleSchema = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationTableTableCellTableHeaderValues",
    () => StyleSchemaValidationTableTableCellTableHeaderValues,
    (value) => {
      StyleSchemaValidationTableTableCellTableHeaderValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "propertyAppliesToNode",
    () => propertyAppliesToNode,
  );
  bindRuntimeValue(
    runtime,
    "getPropertyValidationClass",
    () => getPropertyValidationClass,
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationLimit",
    () => StyleSchemaValidationLimit,
    (value) => {
      StyleSchemaValidationLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationExpressionImageSetPattern",
    () => StyleSchemaValidationExpressionImageSetPattern,
    (value) => {
      StyleSchemaValidationExpressionImageSetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateSimpleStyleString",
    () => validateSimpleStyleString,
  );
  bindRuntimeValue(runtime, "isStyleObject", () => isStyleObject);
  bindRuntimeValue(runtime, "validateStyleNumber", () => validateStyleNumber);
  bindRuntimeValue(
    runtime,
    "validateOptionalStyleNumber",
    () => validateOptionalStyleNumber,
  );
  bindRuntimeValue(runtime, "validateStyleEnum", () => validateStyleEnum);
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationPattern",
    () => StyleSchemaValidationPattern,
    (value) => {
      StyleSchemaValidationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationSubscribers",
    () => StyleSchemaValidationSubscribers,
    (value) => {
      StyleSchemaValidationSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "D16D16D16Value",
    () => D16D16D16Value,
    (value) => {
      D16D16D16Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationLabel",
    () => StyleSchemaValidationLabel,
    (value) => {
      StyleSchemaValidationLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "StyleSchemaValidationLabel_2",
    () => StyleSchemaValidationLabel_2,
    (value) => {
      StyleSchemaValidationLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rgbStyleColorPattern",
    () => rgbStyleColorPattern,
    (value) => {
      rgbStyleColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hslStyleColorPattern",
    () => hslStyleColorPattern,
    (value) => {
      hslStyleColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "oklchStyleColorPattern",
    () => oklchStyleColorPattern,
    (value) => {
      oklchStyleColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "labStyleColorPattern",
    () => labStyleColorPattern,
    (value) => {
      labStyleColorPattern = value;
    },
  );
  return () => {
    styleSchema = buildStyleSchema();
    StyleSchemaValidationTableTableCellTableHeaderValues = [
      "table",
      "tableCell",
      "tableHeader",
    ];
    StyleSchemaValidationLimit = 64;
    StyleSchemaValidationExpressionImageSetPattern =
      /[;{}@<>"'\\\n\r\f\0]|\/\*|(?:url|expression|image-set|image|element|cross-fade|paint|var|env|attr|src|counters?)\s*\(/i;
    StyleSchemaValidationPattern =
      /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
    StyleSchemaValidationSubscribers = new Set([
      "transparent",
      "currentcolor",
      "aliceblue",
      "antiquewhite",
      "aqua",
      "aquamarine",
      "azure",
      "beige",
      "bisque",
      "black",
      "blanchedalmond",
      "blue",
      "blueviolet",
      "brown",
      "burlywood",
      "cadetblue",
      "chartreuse",
      "chocolate",
      "coral",
      "cornflowerblue",
      "cornsilk",
      "crimson",
      "cyan",
      "darkblue",
      "darkcyan",
      "darkgoldenrod",
      "darkgray",
      "darkgrey",
      "darkgreen",
      "darkkhaki",
      "darkmagenta",
      "darkolivegreen",
      "darkorange",
      "darkorchid",
      "darkred",
      "darksalmon",
      "darkseagreen",
      "darkslateblue",
      "darkslategray",
      "darkslategrey",
      "darkturquoise",
      "darkviolet",
      "deeppink",
      "deepskyblue",
      "dimgray",
      "dimgrey",
      "dodgerblue",
      "firebrick",
      "floralwhite",
      "forestgreen",
      "fuchsia",
      "gainsboro",
      "ghostwhite",
      "gold",
      "goldenrod",
      "gray",
      "grey",
      "green",
      "greenyellow",
      "honeydew",
      "hotpink",
      "indianred",
      "indigo",
      "ivory",
      "khaki",
      "lavender",
      "lavenderblush",
      "lawngreen",
      "lemonchiffon",
      "lightblue",
      "lightcoral",
      "lightcyan",
      "lightgoldenrodyellow",
      "lightgray",
      "lightgrey",
      "lightgreen",
      "lightpink",
      "lightsalmon",
      "lightseagreen",
      "lightskyblue",
      "lightslategray",
      "lightslategrey",
      "lightsteelblue",
      "lightyellow",
      "lime",
      "limegreen",
      "linen",
      "magenta",
      "maroon",
      "mediumaquamarine",
      "mediumblue",
      "mediumorchid",
      "mediumpurple",
      "mediumseagreen",
      "mediumslateblue",
      "mediumspringgreen",
      "mediumturquoise",
      "mediumvioletred",
      "midnightblue",
      "mintcream",
      "mistyrose",
      "moccasin",
      "navajowhite",
      "navy",
      "oldlace",
      "olive",
      "olivedrab",
      "orange",
      "orangered",
      "orchid",
      "palegoldenrod",
      "palegreen",
      "paleturquoise",
      "palevioletred",
      "papayawhip",
      "peachpuff",
      "peru",
      "pink",
      "plum",
      "powderblue",
      "purple",
      "rebeccapurple",
      "red",
      "rosybrown",
      "royalblue",
      "saddlebrown",
      "salmon",
      "sandybrown",
      "seagreen",
      "seashell",
      "sienna",
      "silver",
      "skyblue",
      "slateblue",
      "slategray",
      "slategrey",
      "snow",
      "springgreen",
      "steelblue",
      "tan",
      "teal",
      "thistle",
      "tomato",
      "turquoise",
      "violet",
      "wheat",
      "white",
      "whitesmoke",
      "yellow",
      "yellowgreen",
    ]);
    D16D16D16Value = "(?:\\d{1,6}(?:\\.\\d{1,6})?|\\.\\d{1,6})";
    StyleSchemaValidationLabel = "[ \\t\\n\\r\\f]*";
    StyleSchemaValidationLabel_2 = "[ \\t\\n\\r\\f]+";
    rgbStyleColorPattern = new RegExp(
      "^rgba?\\(" +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        "," +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        "," +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        "(?:," +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        ")?\\)$",
    );
    hslStyleColorPattern = new RegExp(
      "^rgba?\\(" +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel_2 +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel_2 +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        "(?:/" +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        ")?\\)$",
    );
    oklchStyleColorPattern = new RegExp(
      "^hsla?\\(" +
        StyleSchemaValidationLabel +
        "-?" +
        D16D16D16Value +
        "(?:deg)?" +
        StyleSchemaValidationLabel +
        "," +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%" +
        StyleSchemaValidationLabel +
        "," +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%" +
        StyleSchemaValidationLabel +
        "(?:," +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        ")?\\)$",
    );
    labStyleColorPattern = new RegExp(
      "^hsla?\\(" +
        StyleSchemaValidationLabel +
        "-?" +
        D16D16D16Value +
        "(?:deg)?" +
        StyleSchemaValidationLabel_2 +
        D16D16D16Value +
        "%" +
        StyleSchemaValidationLabel_2 +
        D16D16D16Value +
        "%" +
        StyleSchemaValidationLabel +
        "(?:/" +
        StyleSchemaValidationLabel +
        D16D16D16Value +
        "%?" +
        StyleSchemaValidationLabel +
        ")?\\)$",
    );
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorComputedData(
  runtime: RuntimeBindings,
): () => void {
  var InspectorComputedDataPattern: Dynamic;
  var D13D16Value: Dynamic;
  var rgbComputedValuePattern: Dynamic;
  var opaqueRgbComputedValuePattern: Dynamic;
  var InspectorComputedDataRectCircleEllipseSet: Dynamic;
  var InspectorComputedDataPathLinePolylineSet: Dynamic;
  var InspectorComputedDataItems: Dynamic;
  function normalizePixelValue(input?: Dynamic): Dynamic {
    return typeof input != "string"
      ? null
      : /^\d{1,4}(\.\d{1,6})?px$/.test(input)
        ? input
        : null;
  }
  function normalizeRgbValue(input?: Dynamic): Dynamic {
    return typeof input != "string"
      ? null
      : rgbComputedValuePattern.test(input)
        ? input
        : null;
  }
  function normalizeFontWeight(input?: Dynamic): Dynamic {
    return typeof input == "string" &&
      /^(1000|[1-9]\d{0,2}(\.\d{1,3})?)$/.test(input)
      ? input
      : null;
  }
  function normalizeContrastGround(input?: Dynamic): Dynamic {
    let value: Dynamic = input != null && typeof input == "object" ? input : {};
    if (value.instances !== 1) return null;
    let ground: Dynamic = value.ground;
    if (ground == null || typeof ground != "object") return null;
    let { behind: value2, ink: value3 }: Dynamic = ground;
    if (
      typeof value2 != "string" ||
      !opaqueRgbComputedValuePattern.test(value2)
    )
      return null;
    let value4: Dynamic = normalizeRgbValue(value3);
    return value4 === null
      ? null
      : {
          behind: value2,
          ink: value4,
        };
  }
  function normalizeInspectorComputedData(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = {},
  ): Dynamic {
    let value: Dynamic =
        options != null && typeof options == "object" ? options : {},
      value2: Dynamic =
        value.computed != null && typeof value.computed == "object"
          ? value.computed
          : {},
      value3: Dynamic = typeof value.tag == "string" ? value.tag : "",
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        normalizeRgbValue(value2[input2]),
      callback2: Dynamic = (input2?: Dynamic): Dynamic =>
        input2 != null && (0, runtime.parseHsvaColor)(input2).a > 0
          ? input2
          : null,
      value4: Dynamic =
        InspectorComputedDataRectCircleEllipseSet.has(value3) ||
        InspectorComputedDataPathLinePolylineSet.has(value3) ||
        value3 === "svg",
      callback3: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        typeof input2 == "string" && options2.test(input2) ? input2 : null,
      state: Dynamic = {};
    if (input !== "line" && !value4) {
      let callback4: Dynamic = (
          input2?: Dynamic,
          options2?: Dynamic,
        ): Dynamic => {
          options2 != null && options2 !== "0px" && (state[input2] = options2);
        },
        value5: Dynamic = ["Top", "Right", "Bottom", "Left"].map(
          (input2?: Dynamic): Dynamic => ({
            S: input2,
            w: normalizePixelValue(value2["border" + input2 + "Width"]),
            st: callback3(
              value2["border" + input2 + "Style"],
              /^(solid|dashed|dotted)$/,
            ),
          }),
        ),
        value6: Dynamic = value5.find(
          (input2?: Dynamic): Dynamic =>
            input2.st !== null && input2.w !== null && input2.w !== "0px",
        );
      if (value6) {
        callback4("border-style", value6.st);
        callback4("border-width", value6.w);
        callback4("border-color", callback("border" + value6.S + "Color"));
        for (let value7 of value5 as Dynamic)
          value7.w != null &&
            (state["border-" + value7.S.toLowerCase() + "-width"] =
              value7.st === null ? "0px" : value7.w);
      }
      let items: Dynamic = [
        normalizePixelValue(value2.borderTopLeftRadius),
        normalizePixelValue(value2.borderTopRightRadius),
        normalizePixelValue(value2.borderBottomRightRadius),
        normalizePixelValue(value2.borderBottomLeftRadius),
      ];
      items.every((input2?: Dynamic): Dynamic => input2 === items[0])
        ? callback4("border-radius", items[0])
        : [
            "border-top-left-radius",
            "border-top-right-radius",
            "border-bottom-right-radius",
            "border-bottom-left-radius",
          ].forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
            items[options2] != null && (state[input2] = items[options2]);
          });
      callback4("padding-top", normalizePixelValue(value2.paddingTop));
      callback4("padding-right", normalizePixelValue(value2.paddingRight));
      callback4("padding-bottom", normalizePixelValue(value2.paddingBottom));
      callback4("padding-left", normalizePixelValue(value2.paddingLeft));
    }
    return {
      box: state,
      fontWeight:
        input === "text" ? normalizeFontWeight(value2.fontWeight) : null,
      fontFamily:
        input === "text"
          ? callback3(value2.fontFamily, InspectorComputedDataPattern)
          : null,
      fontStyle:
        input === "text"
          ? callback3(value2.fontStyle, /^(normal|italic|oblique)$/)
          : null,
      textAlign:
        input === "text"
          ? callback3(
              value2.textAlign,
              /^(start|end|left|right|center|justify)$/,
            )
          : null,
      textDecoration:
        input === "text"
          ? callback3(
              value2.textDecorationLine,
              /^(none|underline|line-through|overline)( (underline|line-through|overline))*$/,
            )
          : null,
      fontSize: input === "text" ? normalizePixelValue(value2.fontSize) : null,
      lineHeight:
        input === "text"
          ? normalizeLineHeightRatio(
              normalizePixelValue(value2.lineHeight),
              normalizePixelValue(value2.fontSize),
            )
          : null,
      letterSpacing:
        input === "text"
          ? value2.letterSpacing === "normal"
            ? "0px"
            : callback3(value2.letterSpacing, /^-?\d{1,4}(\.\d{1,6})?px$/)
          : null,
      color: input === "text" ? callback("color") : null,
      textClip:
        input === "text" &&
        (value2.backgroundClip === "text" ||
          value2.webkitBackgroundClip === "text"),
      ground:
        input === "text" && context.ground === true
          ? normalizeContrastGround(options)
          : null,
      background:
        input === "line"
          ? null
          : (callback2(callback("backgroundColor")) ??
            (InspectorComputedDataRectCircleEllipseSet.has(value3)
              ? callback("fill")
              : null)),
      stroke:
        input === "text"
          ? null
          : callback(value4 ? "stroke" : "borderTopColor"),
    };
  }
  function normalizeLineHeightRatio(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input !== null ? parseFloat(input) : NaN,
      value2: Dynamic = options !== null ? parseFloat(options) : NaN;
    return value > 0 && value2 > 0
      ? String(Math.round((value / value2) * 100) / 100)
      : null;
  }
  bindRuntimeValue(
    runtime,
    "InspectorComputedDataPattern",
    () => InspectorComputedDataPattern,
    (value) => {
      InspectorComputedDataPattern = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePixelValue", () => normalizePixelValue);
  bindRuntimeValue(
    runtime,
    "D13D16Value",
    () => D13D16Value,
    (value) => {
      D13D16Value = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rgbComputedValuePattern",
    () => rgbComputedValuePattern,
    (value) => {
      rgbComputedValuePattern = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeRgbValue", () => normalizeRgbValue);
  bindRuntimeValue(runtime, "normalizeFontWeight", () => normalizeFontWeight);
  bindRuntimeValue(
    runtime,
    "opaqueRgbComputedValuePattern",
    () => opaqueRgbComputedValuePattern,
    (value) => {
      opaqueRgbComputedValuePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeContrastGround",
    () => normalizeContrastGround,
  );
  bindRuntimeValue(
    runtime,
    "InspectorComputedDataRectCircleEllipseSet",
    () => InspectorComputedDataRectCircleEllipseSet,
    (value) => {
      InspectorComputedDataRectCircleEllipseSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorComputedDataPathLinePolylineSet",
    () => InspectorComputedDataPathLinePolylineSet,
    (value) => {
      InspectorComputedDataPathLinePolylineSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeInspectorComputedData",
    () => normalizeInspectorComputedData,
  );
  bindRuntimeValue(
    runtime,
    "normalizeLineHeightRatio",
    () => normalizeLineHeightRatio,
  );
  bindRuntimeValue(
    runtime,
    "InspectorComputedDataItems",
    () => InspectorComputedDataItems,
    (value) => {
      InspectorComputedDataItems = value;
    },
  );
  return () => {
    InspectorComputedDataPattern = /^[\p{L}\p{N}_\s"',.-]{1,200}$/u;
    D13D16Value = "\\d{1,3}(?:\\.\\d{1,6})?";
    rgbComputedValuePattern = new RegExp(
      "^rgba?\\(" +
        D13D16Value +
        ", " +
        D13D16Value +
        ", " +
        D13D16Value +
        "(?:, " +
        D13D16Value +
        ")?\\)$",
    );
    opaqueRgbComputedValuePattern = new RegExp(
      "^rgb\\(" +
        D13D16Value +
        ", " +
        D13D16Value +
        ", " +
        D13D16Value +
        "\\)$",
    );
    InspectorComputedDataRectCircleEllipseSet = new Set([
      "rect",
      "circle",
      "ellipse",
      "polygon",
    ]);
    InspectorComputedDataPathLinePolylineSet = new Set([
      "path",
      "line",
      "polyline",
    ]);
    InspectorComputedDataItems = [
      "borderTopStyle",
      "borderRightStyle",
      "borderBottomStyle",
      "borderLeftStyle",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "fontWeight",
      "fontFamily",
      "fontStyle",
      "textAlign",
      "textDecorationLine",
      "fontSize",
      "lineHeight",
      "letterSpacing",
      "color",
      "backgroundColor",
      "backgroundClip",
      "webkitBackgroundClip",
      "fill",
      "stroke",
      "borderTopColor",
    ];
  };
}

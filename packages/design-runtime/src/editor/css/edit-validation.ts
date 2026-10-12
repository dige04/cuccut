/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssEditValidation(
  runtime: RuntimeBindings,
): () => void {
  var CssEditValidationPattern: Dynamic;
  var CssEditValidationPattern_2: Dynamic;
  var CssEditValidationRegistry: Dynamic;
  var CssEditValidationCenterCoverPattern: Dynamic;
  var CssEditValidationHttpsPattern: Dynamic;
  var CssEditValidationAZaZAZaZPattern: Dynamic;
  var CssEditValidationColorBackgroundColorFillConfig: Dynamic;
  var CssEditValidationSubscribers: Dynamic;
  var CssEditValidationBackgroundBackgroundColorSet: Dynamic;
  var CssEditValidationPattern_3: Dynamic;
  var CssEditValidationDataImagePattern: Dynamic;
  var CssEditValidationAttrExpressionPattern: Dynamic;
  var CssEditValidationFontSizeFontFamilyFontWeightValues: Dynamic;
  function isSafeBackgroundImage(input?: Dynamic, options?: Dynamic): Dynamic {
    if (input !== "background" && input !== "background-image") return false;
    let value: Dynamic = CssEditValidationCenterCoverPattern.exec(options);
    return value === null ||
      (input === "background-image" && value[2] !== undefined)
      ? false
      : (0, runtime.UndoElementsTest)(value[1]) ||
          CssEditValidationAZaZAZaZPattern.test(value[1]) ||
          CssEditValidationHttpsPattern.test(value[1]);
  }
  function hasBalancedStyleFunction(items?: Dynamic): Dynamic {
    let value: Dynamic = items.indexOf("("),
      index: Dynamic = 0;
    for (let value2: Dynamic = value; value2 < items.length; value2++)
      if (items[value2] === "(") index++;
      else if (items[value2] === ")" && --index === 0)
        return value2 === items.length - 1;
    return false;
  }
  function routeStyleEditsByElementKind(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let entries: Dynamic = new Map();
    for (let { tid: value, kind: value2 } of options as Dynamic) {
      let value3: Dynamic = input.filter(([input2]: Dynamic): Dynamic => {
        let value4: Dynamic =
          CssEditValidationColorBackgroundColorFillConfig[input2];
        return context
          ? value4 === undefined || value4.has(value2)
          : !(
              value2 === "line" &&
              (input2 === "fill" || input2 === "background-color")
            );
      });
      value3.length > 0 && entries.set(value, value3);
    }
    return entries;
  }
  function isBalancedBackgroundValue(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      value: Dynamic = null;
    for (let value2 of input as Dynamic)
      if (value) value2 === value && (value = null);
      else if (value2 === '"' || value2 === "'") value = value2;
      else {
        if (value2 === ";" || value2 === "{" || value2 === "}") return false;
        if (value2 === "(" || value2 === "[")
          items.push(value2 === "(" ? ")" : "]");
        else if ((value2 === ")" || value2 === "]") && items.pop() !== value2)
          return false;
      }
    return items.length === 0 && value === null;
  }
  function isSafeBackgroundStyle(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options.trim(),
      value2: Dynamic = CssEditValidationDataImagePattern.test(value)
        ? 15e5
        : 2048;
    return !CssEditValidationBackgroundBackgroundColorSet.has(input) ||
      value.length === 0 ||
      value.length > value2 ||
      CssEditValidationPattern_3.test(value) ||
      !isBalancedBackgroundValue(value) ||
      (typeof CSS !== "undefined" &&
        typeof CSS.supports == "function" &&
        !CSS.supports(input, value))
      ? null
      : value;
  }
  function normalizeStyleEdits(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let [value, value2] of input as Dynamic) {
      if (!CssEditValidationSubscribers.has(value)) continue;
      if (value2 === null) {
        items.push([value, null]);
        continue;
      }
      if (typeof value2 != "string") continue;
      let value3: Dynamic = value2.trim();
      if (isSafeBackgroundImage(value, value3)) {
        items.push([value, value3]);
        continue;
      }
      if (
        value3.length === 0 ||
        value3.length > 512 ||
        CssEditValidationAttrExpressionPattern.test(value3) ||
        !isBalancedBackgroundValue(value3)
      )
        continue;
      let value4: Dynamic = CssEditValidationRegistry[value];
      (value4 && !value4.test(value3)) ||
        ((value === "background" || value === "background-image") &&
          value3.toLowerCase() !== "none" &&
          !hasBalancedStyleFunction(value3)) ||
        (typeof CSS !== "undefined" &&
          typeof CSS.supports == "function" &&
          !CSS.supports(value, value3)) ||
        items.push([value, value3]);
    }
    return items;
  }
  function normalizeTextStyleSnapshot(input?: Dynamic): Dynamic {
    if (input === null || typeof input != "object") return [];
    let value: Dynamic = input,
      items: Dynamic = [];
    for (let value2 of CssEditValidationFontSizeFontFamilyFontWeightValues as Dynamic) {
      let value3: Dynamic = value[value2];
      if (typeof value3 == "string") {
        if (value2 === "line-height" && value3.trim() !== "normal") {
          let value4: Dynamic =
            parseFloat(value3) / parseFloat(String(value["font-size"]));
          /px$/.test(value3.trim()) &&
            value4 > 0 &&
            value4 < 100 &&
            items.push([value2, String(Math.round(value4 * 1e3) / 1e3)]);
          continue;
        }
        items.push([value2, value3]);
      }
    }
    return normalizeStyleEdits(items);
  }
  function frozenInheritedStyleEdits(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic =
        context !== null && typeof context == "object" ? context : {},
      items: Dynamic = [];
    for (let [value3, value4] of input as Dynamic) {
      let value5: Dynamic = options[value3],
        value6: Dynamic = value2[value3];
      typeof value5 != "string" ||
        typeof value6 != "string" ||
        (equivalentCssValues(value5, value6) &&
          equivalentCssValues(value(value3), value4) &&
          items.push(value3));
    }
    return items;
  }
  function equivalentCssValues(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      input2.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, " ").trim();
    return callback(input) === callback(options);
  }
  bindRuntimeValue(
    runtime,
    "CssEditValidationPattern",
    () => CssEditValidationPattern,
    (value) => {
      CssEditValidationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationPattern_2",
    () => CssEditValidationPattern_2,
    (value) => {
      CssEditValidationPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationRegistry",
    () => CssEditValidationRegistry,
    (value) => {
      CssEditValidationRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationCenterCoverPattern",
    () => CssEditValidationCenterCoverPattern,
    (value) => {
      CssEditValidationCenterCoverPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationHttpsPattern",
    () => CssEditValidationHttpsPattern,
    (value) => {
      CssEditValidationHttpsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationAZaZAZaZPattern",
    () => CssEditValidationAZaZAZaZPattern,
    (value) => {
      CssEditValidationAZaZAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSafeBackgroundImage",
    () => isSafeBackgroundImage,
  );
  bindRuntimeValue(
    runtime,
    "hasBalancedStyleFunction",
    () => hasBalancedStyleFunction,
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationColorBackgroundColorFillConfig",
    () => CssEditValidationColorBackgroundColorFillConfig,
    (value) => {
      CssEditValidationColorBackgroundColorFillConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "routeStyleEditsByElementKind",
    () => routeStyleEditsByElementKind,
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationSubscribers",
    () => CssEditValidationSubscribers,
    (value) => {
      CssEditValidationSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationBackgroundBackgroundColorSet",
    () => CssEditValidationBackgroundBackgroundColorSet,
    (value) => {
      CssEditValidationBackgroundBackgroundColorSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationPattern_3",
    () => CssEditValidationPattern_3,
    (value) => {
      CssEditValidationPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isBalancedBackgroundValue",
    () => isBalancedBackgroundValue,
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationDataImagePattern",
    () => CssEditValidationDataImagePattern,
    (value) => {
      CssEditValidationDataImagePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSafeBackgroundStyle",
    () => isSafeBackgroundStyle,
  );
  bindRuntimeValue(
    runtime,
    "CssEditValidationAttrExpressionPattern",
    () => CssEditValidationAttrExpressionPattern,
    (value) => {
      CssEditValidationAttrExpressionPattern = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeStyleEdits", () => normalizeStyleEdits);
  bindRuntimeValue(
    runtime,
    "CssEditValidationFontSizeFontFamilyFontWeightValues",
    () => CssEditValidationFontSizeFontFamilyFontWeightValues,
    (value) => {
      CssEditValidationFontSizeFontFamilyFontWeightValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeTextStyleSnapshot",
    () => normalizeTextStyleSnapshot,
  );
  bindRuntimeValue(
    runtime,
    "frozenInheritedStyleEdits",
    () => frozenInheritedStyleEdits,
  );
  bindRuntimeValue(runtime, "equivalentCssValues", () => equivalentCssValues);
  return () => {
    CssEditValidationPattern = /^-?\d{1,4}(\.\d{1,6})?px$/;
    CssEditValidationPattern_2 = /^\d{1,4}(\.\d{1,6})?px$/;
    CssEditValidationRegistry = {
      color: null,
      "background-color": null,
      fill: null,
      stroke: null,
      "border-color": null,
      "font-family": null,
      "font-size": CssEditValidationPattern_2,
      "font-weight": /^([1-9]\d{0,2}|1000|normal|bold)$/,
      "font-style": /^(normal|italic)$/,
      "text-decoration-line":
        /^(none|(underline|line-through|overline)( (underline|line-through|overline)){0,2})$/,
      "text-align": /^(start|center|end|justify|left|right)$/,
      "line-height": /^(normal|\d{1,2}(\.\d{1,3})?)$/,
      "letter-spacing": /^(normal|-?\d{1,3}(\.\d{1,6})?px)$/,
      "text-transform": /^(none|uppercase|lowercase|capitalize)$/,
      "white-space": /^(normal|nowrap|pre|pre-wrap|pre-line|break-spaces)$/,
      "list-style-type":
        /^(none|disc|circle|square|decimal|decimal-leading-zero|lower-alpha|upper-alpha|lower-latin|upper-latin|lower-roman|upper-roman|lower-greek)$/,
      "border-style": /^(none|solid|dashed|dotted)$/,
      "border-width": CssEditValidationPattern_2,
      "border-top-width": CssEditValidationPattern_2,
      "border-right-width": CssEditValidationPattern_2,
      "border-bottom-width": CssEditValidationPattern_2,
      "border-left-width": CssEditValidationPattern_2,
      "border-radius": /^\d{1,4}(\.\d{1,6})?(px|%)$/,
      "border-top-left-radius": CssEditValidationPattern_2,
      "border-top-right-radius": CssEditValidationPattern_2,
      "border-bottom-right-radius": CssEditValidationPattern_2,
      "border-bottom-left-radius": CssEditValidationPattern_2,
      "padding-top": CssEditValidationPattern_2,
      "padding-right": CssEditValidationPattern_2,
      "padding-bottom": CssEditValidationPattern_2,
      "padding-left": CssEditValidationPattern_2,
      "margin-top": CssEditValidationPattern,
      "margin-right": CssEditValidationPattern,
      "margin-bottom": CssEditValidationPattern,
      "margin-left": CssEditValidationPattern,
      "stroke-width": CssEditValidationPattern_2,
      "stroke-dasharray": /^(none|\d{1,3}( \d{1,3}){0,3})$/,
      "object-fit": /^(fill|contain|cover|none|scale-down)$/,
      "object-position": /^\d{1,3}(\.\d{1,4})?% \d{1,3}(\.\d{1,4})?%$/,
      "object-view-box":
        /^inset\(\d{1,2}(\.\d{1,4})?%( \d{1,2}(\.\d{1,4})?%){3}\)$/,
      background:
        /^(none|(repeating-)?(linear|radial)-gradient\([^;{}<>"'\\]{1,480}\))$/i,
      "background-image":
        /^(repeating-)?(linear|radial)-gradient\([^;{}<>"'\\]{1,480}\)$/i,
      "background-size":
        /^(cover|contain|auto|\d{1,4}(\.\d{1,3})?(px|%)( \d{1,4}(\.\d{1,3})?(px|%))?)$/,
      "background-position": /^center$/,
      "background-repeat": /^no-repeat$/,
      "background-clip": /^text$/,
      "-webkit-background-clip": /^text$/,
      "-webkit-text-fill-color": /^(transparent|currentcolor)$/i,
    };
    CssEditValidationCenterCoverPattern =
      /^url\("([^"\\\r\n]+)"\)( center \/ (cover|contain|auto|\d{1,4}(?:\.\d{1,3})?(?:px|%)(?: \d{1,4}(?:\.\d{1,3})?(?:px|%))?) no-repeat)?$/;
    CssEditValidationHttpsPattern =
      /^https?:\/\/[^\s"'()\\<>;{}\x00-\x1f\x7f]{1,290}$/i;
    CssEditValidationAZaZAZaZPattern =
      /^\.\/(?:[A-Za-z0-9_-][A-Za-z0-9_.%@+~-]{0,99}\/){0,8}[A-Za-z0-9_-][A-Za-z0-9_.%@+~-]{0,199}$/;
    CssEditValidationColorBackgroundColorFillConfig = {
      color: new Set(["text"]),
      "background-color": new Set(["box"]),
      fill: new Set(["shape"]),
      stroke: new Set(["line"]),
      "border-color": new Set(["line"]),
    };
    CssEditValidationSubscribers = new Set(
      Object.keys(CssEditValidationRegistry),
    );
    CssEditValidationBackgroundBackgroundColorSet = new Set([
      "background",
      "background-color",
    ]);
    CssEditValidationPattern_3 = /[<>\\]|\/\*|\*\/|[\r\n\f]|url\(\s*[^"'\s)]/i;
    CssEditValidationDataImagePattern =
      /^url\("data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]*"\)[^"']{0,200}$/;
    CssEditValidationAttrExpressionPattern =
      /[;{}\\@<>]|\/\*|url\s*\(|src\s*\(|attr\s*\(|expression\s*\(|image(-set)?\s*\(|element\s*\(|cross-fade\s*\(|paint\s*\(|[\r\n]/i;
    CssEditValidationFontSizeFontFamilyFontWeightValues = [
      "font-size",
      "font-family",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "color",
      "text-align",
      "text-transform",
      "white-space",
      "list-style-type",
    ];
  };
}

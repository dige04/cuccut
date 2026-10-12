/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssDeclarations(
  runtime: RuntimeBindings,
): () => void {
  var CssDeclarationsAZaZPattern: Dynamic;
  var CssDeclarationsBehaviorMozBindingPattern: Dynamic;
  function normalizeCssProperty(input?: Dynamic): Dynamic {
    return input.startsWith("--")
      ? input
      : CssDeclarationsAZaZPattern.test(input)
        ? (0, runtime.camelToKebabCss)(input).toLowerCase()
        : input.toLowerCase();
  }
  function isUnsafeCssProperty(input?: Dynamic): Dynamic {
    return (
      CssDeclarationsBehaviorMozBindingPattern.test(input) ||
      CssDeclarationsBehaviorMozBindingPattern.test(normalizeCssProperty(input))
    );
  }
  function splitCssTokens(items?: Dynamic, options?: Dynamic): Dynamic {
    let items2: Dynamic = [],
      index: Dynamic = 0,
      index2: Dynamic = 0,
      value: Dynamic = null,
      text: Dynamic = "";
    for (let index3: Dynamic = 0; index3 < items.length; index3++) {
      let value2: Dynamic = items[index3];
      if (value) {
        text += value2;
        value2 === value && items[index3 - 1] !== "\\" && (value = null);
        continue;
      }
      if (value2 === '"' || value2 === "'") {
        value = value2;
        text += value2;
        continue;
      }
      value2 === "("
        ? index++
        : value2 === ")"
          ? (index = Math.max(0, index - 1))
          : value2 === "{"
            ? index2++
            : value2 === "}" && (index2 = Math.max(0, index2 - 1));
      if (value2 === options && index === 0 && index2 === 0) {
        items2.push(text);
        text = "";
        continue;
      }
      text += value2;
    }
    items2.push(text);
    return items2;
  }
  function parseStyleDeclarations(style?: Dynamic): Dynamic {
    if (!style) return [];
    let items: Dynamic = [];
    for (let value of splitCssTokens(style, ";") as Dynamic) {
      let value2: Dynamic = value.trim();
      if (!value2) continue;
      let value3: Dynamic = value2.indexOf(":");
      if (value3 <= 0) continue;
      let value4: Dynamic = value2.slice(0, value3).trim(),
        value5: Dynamic = value2.slice(value3 + 1).trim();
      !value4 ||
        !value5 ||
        isUnsafeCssProperty(value4) ||
        items.push({
          prop: normalizeCssProperty(value4),
          value: value5,
        });
    }
    return items;
  }
  function serializeStyleDeclarations(declarations?: Dynamic): Dynamic {
    return declarations
      .map((input?: Dynamic): Dynamic => `${input.prop}: ${input.value}`)
      .join("; ");
  }
  function getStyleProperty(style?: Dynamic, property?: Dynamic): Dynamic {
    let declarations: Dynamic = parseStyleDeclarations(style),
      normalizedProperty: Dynamic = normalizeCssProperty(property);
    for (let value: Dynamic = declarations.length - 1; value >= 0; value--)
      if (declarations[value].prop === normalizedProperty)
        return declarations[value].value;
    return "";
  }
  bindRuntimeValue(runtime, "normalizeCssProperty", () => normalizeCssProperty);
  bindRuntimeValue(
    runtime,
    "CssDeclarationsAZaZPattern",
    () => CssDeclarationsAZaZPattern,
    (value) => {
      CssDeclarationsAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CssDeclarationsBehaviorMozBindingPattern",
    () => CssDeclarationsBehaviorMozBindingPattern,
    (value) => {
      CssDeclarationsBehaviorMozBindingPattern = value;
    },
  );
  bindRuntimeValue(runtime, "isUnsafeCssProperty", () => isUnsafeCssProperty);
  bindRuntimeValue(runtime, "splitCssTokens", () => splitCssTokens);
  bindRuntimeValue(
    runtime,
    "parseStyleDeclarations",
    () => parseStyleDeclarations,
  );
  bindRuntimeValue(
    runtime,
    "serializeStyleDeclarations",
    () => serializeStyleDeclarations,
  );
  bindRuntimeValue(runtime, "getStyleProperty", () => getStyleProperty);
  return () => {
    CssDeclarationsAZaZPattern = /^-?[A-Za-z_][\w-]*$/;
    CssDeclarationsBehaviorMozBindingPattern =
      /^(?:behavior|-moz-binding)$|<\/?script|data-dc-script|<\/?x-dc|<\!--/i;
  };
}

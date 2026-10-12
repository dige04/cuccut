/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssValues(runtime: RuntimeBindings): () => void {
  var CssValuesSubscribers: Dynamic;
  var CssValuesWhiteBlackRedConfig: Dynamic;
  function setStyleProperty(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if ((0, runtime.isUnsafeCssProperty)(options)) return input ?? "";
    let value: Dynamic = (0, runtime.parseStyleDeclarations)(input),
      value2: Dynamic = (0, runtime.normalizeCssProperty)(options);
    if (context == null || context === "")
      return (0, runtime.serializeStyleDeclarations)(
        value.filter((input2?: Dynamic): Dynamic => input2.prop !== value2),
      );
    let flag: Dynamic = false,
      items: Dynamic = [];
    for (let value3 of value as Dynamic)
      value3.prop !== value2
        ? items.push(value3)
        : flag ||
          (items.push({
            prop: value2,
            value: context,
          }),
          (flag = true));
    flag ||
      items.push({
        prop: value2,
        value: context,
      });
    return (0, runtime.serializeStyleDeclarations)(items);
  }
  function classifyStyleValue(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    return value
      ? value.includes("{{")
        ? {
            kind: "template",
            raw: value,
          }
        : /(^|[\s(])var\(/.test(value)
          ? {
              kind: "var",
              raw: value,
            }
          : {
              kind: "literal",
              raw: value,
            }
      : {
          kind: "unset",
          raw: "",
        };
  }
  function getCssVariableNames(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      value: Dynamic = /var\(\s*(--[\w-]+)/g,
      value2: Dynamic;
    for (; (value2 = value.exec(input ?? "")); )
      items.includes(value2[1]) || items.push(value2[1]);
    return items;
  }
  function replaceCssVariables(items?: Dynamic, options?: Dynamic): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0;
    for (; index < items.length; ) {
      let value: Dynamic = items.indexOf("var(", index);
      if (value === -1) {
        text += items.slice(index);
        break;
      }
      text += items.slice(index, value);
      let index2: Dynamic = 0,
        value2: Dynamic = -1,
        value3: Dynamic = -1;
      for (let value7: Dynamic = value + 3; value7 < items.length; value7++) {
        let value8: Dynamic = items[value7];
        if (value8 === "(") index2++;
        else if (value8 === ")") {
          index2--;
          if (index2 === 0) {
            value2 = value7;
            break;
          }
        } else
          value8 === "," && index2 === 1 && value3 === -1 && (value3 = value7);
      }
      if (value2 === -1) return null;
      let value4: Dynamic = items
          .slice(value + 4, value3 === -1 ? value2 : value3)
          .trim(),
        value5: Dynamic =
          value3 === -1 ? "" : items.slice(value3 + 1, value2).trim(),
        value6: Dynamic = (options[value4] ?? "").trim();
      if (value6) text += value6;
      else if (value5) {
        let value7: Dynamic = value5.includes("var(")
          ? replaceCssVariables(value5, options)
          : value5;
        if (value7 == null) return null;
        text += value7;
      } else return null;
      index = value2 + 1;
    }
    return text;
  }
  function parseCssNumber(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim(),
      match: Dynamic = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(value);
    if (!match) return null;
    let number: Dynamic = parseFloat(match[1]);
    return Number.isNaN(number)
      ? null
      : {
          value: number,
          unit: match[2] ?? "",
        };
  }
  function getFineUnitStep(input?: Dynamic, options?: Dynamic): Dynamic {
    return /^(em|rem|ch|ex|lh|cap|ic|s|turn)$/i.test(input) ? 0.01 : options;
  }
  function stepCssNumber(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = {},
  ): Dynamic {
    let value2: Dynamic = value.step ?? 1,
      value3: Dynamic = Math.min(
        getFineUnitStep(value.unit ?? "", undefined) ?? 0.1,
        value2,
      ),
      value4: Dynamic = context.altKey
        ? value3
        : value2 * (context.shiftKey ? 10 : 1),
      value5: Dynamic = Math.round((input + options * value4) * 100) / 100;
    value.min != null && (value5 = Math.max(value.min, value5));
    value.max != null && (value5 = Math.min(value.max, value5));
    return value5;
  }
  function formatCssNumber(value?: Dynamic, unit?: Dynamic): Dynamic {
    return `${Math.round(value * 100) / 100}${unit}`;
  }
  function normalizeCssUnit(input?: Dynamic): Dynamic {
    return input && CssValuesSubscribers.has(input.toLowerCase())
      ? input.toLowerCase()
      : "";
  }
  function roundCssNumber(input?: Dynamic, options?: Dynamic): Dynamic {
    return (options === "px" || options === "") && Math.abs(input) > 20
      ? Math.round(input)
      : Math.round(input * 100) / 100;
  }
  function describeColorValue(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim(),
      value2: Dynamic = CssValuesWhiteBlackRedConfig[value.toLowerCase()];
    if (value2) return value2;
    let value3: Dynamic = /^var\(\s*--([\w-]+)\s*\)$/i.exec(value);
    if (value3) return value3[1];
    let value4: Dynamic = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(
      value,
    );
    if (value4) {
      let value8: Dynamic = value4[1];
      return (
        "#" +
        (value8.length <= 4
          ? [...value8]
              .map((input2?: Dynamic): Dynamic => input2 + input2)
              .join("")
          : value8)
      ).toUpperCase();
    }
    let value5: Dynamic =
      /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(
        value,
      );
    if (!value5) return input;
    let value6: Dynamic = [value5[1], value5[2], value5[3]].map(
      (input2?: Dynamic): Dynamic => parseInt(input2, 10),
    );
    if (value6.some((input2?: Dynamic): Dynamic => input2 > 255)) return input;
    let value7: Dynamic = `#${value6.map((input2?: Dynamic): Dynamic => input2.toString(16).padStart(2, "0")).join("")}`;
    if (value5[4] != null) {
      let value8: Dynamic = value5[4].endsWith("%")
        ? parseFloat(value5[4]) / 100
        : parseFloat(value5[4]);
      if (!Number.isFinite(value8) || value8 < 0 || value8 > 1) return input;
      value8 < 1 &&
        (value7 += Math.round(value8 * 255)
          .toString(16)
          .padStart(2, "0"));
    }
    return value7.toUpperCase();
  }
  function splitColorAlpha(input?: Dynamic): Dynamic {
    let value: Dynamic = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(input.trim());
    if (!value)
      return {
        main: input,
      };
    let value2: Dynamic = parseInt(value[2], 16) / 255,
      value3: Dynamic = ("#" + value[1]).toUpperCase();
    return value2 >= 1
      ? {
          main: value3,
        }
      : {
          main: value3,
          alphaPct: Math.round(value2 * 100) + "%",
        };
  }
  function normalizeFontFamilyList(input?: Dynamic): Dynamic {
    return input
      .split(",")
      .map(
        (input2?: Dynamic): Dynamic =>
          input2.trim().replace(/^['"]|['"]$/g, ""),
      )
      .filter(Boolean)
      .join(", ");
  }
  bindRuntimeValue(runtime, "setStyleProperty", () => setStyleProperty);
  bindRuntimeValue(runtime, "classifyStyleValue", () => classifyStyleValue);
  bindRuntimeValue(runtime, "getCssVariableNames", () => getCssVariableNames);
  bindRuntimeValue(runtime, "replaceCssVariables", () => replaceCssVariables);
  bindRuntimeValue(runtime, "parseCssNumber", () => parseCssNumber);
  bindRuntimeValue(runtime, "getFineUnitStep", () => getFineUnitStep);
  bindRuntimeValue(runtime, "stepCssNumber", () => stepCssNumber);
  bindRuntimeValue(runtime, "formatCssNumber", () => formatCssNumber);
  bindRuntimeValue(
    runtime,
    "CssValuesSubscribers",
    () => CssValuesSubscribers,
    (value) => {
      CssValuesSubscribers = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeCssUnit", () => normalizeCssUnit);
  bindRuntimeValue(runtime, "roundCssNumber", () => roundCssNumber);
  bindRuntimeValue(
    runtime,
    "CssValuesWhiteBlackRedConfig",
    () => CssValuesWhiteBlackRedConfig,
    (value) => {
      CssValuesWhiteBlackRedConfig = value;
    },
  );
  bindRuntimeValue(runtime, "describeColorValue", () => describeColorValue);
  bindRuntimeValue(runtime, "splitColorAlpha", () => splitColorAlpha);
  bindRuntimeValue(
    runtime,
    "normalizeFontFamilyList",
    () => normalizeFontFamilyList,
  );
  return () => {
    CssValuesSubscribers = new Set([
      "px",
      "%",
      "em",
      "rem",
      "ch",
      "ex",
      "cap",
      "ic",
      "lh",
      "rlh",
      "vh",
      "vw",
      "vi",
      "vb",
      "vmin",
      "vmax",
      "svh",
      "svw",
      "svi",
      "svb",
      "svmin",
      "svmax",
      "lvh",
      "lvw",
      "lvi",
      "lvb",
      "lvmin",
      "lvmax",
      "dvh",
      "dvw",
      "dvi",
      "dvb",
      "dvmin",
      "dvmax",
      "cqw",
      "cqh",
      "cqi",
      "cqb",
      "cqmin",
      "cqmax",
      "cm",
      "mm",
      "in",
      "pt",
      "pc",
      "q",
      "deg",
      "rad",
      "grad",
      "turn",
      "s",
      "ms",
      "fr",
    ]);
    CssValuesWhiteBlackRedConfig = {
      white: "#FFFFFF",
      black: "#000000",
      red: "#FF0000",
      green: "#008000",
      blue: "#0000FF",
      yellow: "#FFFF00",
      orange: "#FFA500",
      purple: "#800080",
      gray: "#808080",
      grey: "#808080",
    };
  };
}

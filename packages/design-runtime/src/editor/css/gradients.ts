/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCssGradients(
  runtime: RuntimeBindings,
): () => void {
  var CssGradientsXYBlurConfig: Dynamic;
  var CssGradientsItems: Dynamic;
  function parseCssGradientStop(input?: Dynamic): Dynamic {
    let value: Dynamic = input.trim(),
      value2: Dynamic = /^(.*\S)\s+(-?\d*\.?\d+)%$/.exec(value),
      value3: Dynamic = value2 ? value2[1] : value;
    if (!runtime.PropertiesAssetPickerAZAZPattern.test(value3)) {
      let value5: Dynamic = /^(-?\d*\.?\d+)%$/.exec(value);
      if (value5)
        return {
          color: value,
          opaque: true,
          raw: value,
          pos: Math.min(100, Math.max(0, Number(value5[1]))),
        };
      let value6: Dynamic =
          value.match(/(?:[^\s(]+(?:\((?:[^()]|\([^()]*\))*\))?)+|\S+/g) ?? [],
        value7: Dynamic = [value6[0], value6[value6.length - 1]].find(
          (input2?: Dynamic): Dynamic =>
            input2 !== undefined &&
            runtime.PropertiesAssetPickerAZAZPattern.test(input2) &&
            !/^-?[\d.]/.test(input2),
        );
      return {
        color: value,
        opaque: true,
        raw: value,
        ...(value7
          ? {
              swatch: value7,
            }
          : {}),
      };
    }
    if (!value2)
      return {
        color: value3,
      };
    let value4: Dynamic = Number(value2[2]);
    return value4 < 0 || value4 > 100
      ? {
          color: value3,
          opaque: true,
          raw: value,
          pos: value4,
          swatch: value3,
        }
      : {
          color: value3,
          pos: value4,
        };
  }
  function serializeCssGradientStop(input?: Dynamic): Dynamic {
    return input.opaque
      ? (input.raw ?? input.color)
      : input.pos === undefined
        ? input.color
        : `${input.color} ${Math.round(input.pos * 100) / 100}%`;
  }
  function splitGradientArguments(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0,
      text: Dynamic = "";
    for (let value of input as Dynamic) {
      value === "("
        ? index++
        : value === ")" && (index = Math.max(0, index - 1));
      if (value === "," && index === 0) {
        items.push(text.trim());
        text = "";
        continue;
      }
      text += value;
    }
    text.trim() && items.push(text.trim());
    return items;
  }
  function parseCssGradient(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim(),
      value2: Dynamic = /^(linear|radial)-gradient\(\s*([\s\S]+)\)$/i.exec(
        value,
      );
    if (!value2) return null;
    let value3: Dynamic = value2[1].toLowerCase() === "radial",
      value4: Dynamic = splitGradientArguments(value2[2]);
    if (value4.length === 0) return null;
    let count: Dynamic = 180,
      value5: Dynamic,
      value6: Dynamic = /^(-?[\d.]+)(deg|grad|rad|turn)$/i.exec(value4[0]);
    if (value3) {
      let value7: Dynamic =
          value4[0]
            .trim()
            .match(/(?:[^\s(]+(?:\((?:[^()]|\([^()]*\))*\))?)+|\S+/g) ?? [],
        value8: Dynamic =
          /^(circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|at|center|top|bottom|left|right)$/i;
      value7.every(
        (input2?: Dynamic): Dynamic =>
          value8.test(input2) ||
          /^(-?[\d.]+[a-z%]*|(calc|min|max|clamp|var)\(.*\))$/i.test(input2),
      ) &&
        (value7.some((input2?: Dynamic): Dynamic => value8.test(input2)) ||
          !value7.some(
            (input2?: Dynamic): Dynamic => /^var\(/i.test(input2),
          )) &&
        (value5 = value4.shift());
    } else if (value6) {
      let value7: Dynamic = parseFloat(value6[1]),
        value8: Dynamic = value6[2].toLowerCase();
      count =
        Math.round(
          (value8 === "deg"
            ? value7
            : value8 === "grad"
              ? value7 * 0.9
              : value8 === "rad"
                ? (value7 * 180) / Math.PI
                : value7 * 360) * 100,
        ) / 100;
      value4.shift();
    } else if (
      /^(calc|min|max|clamp)\((?:[^()]|\([^()]*\))*\)$/i.test(value4[0].trim())
    )
      value4.shift();
    else if (/^-?[\d.]+deg$/i.test(value4[0])) {
      count = parseFloat(value4[0]);
      value4.shift();
    } else if (/^to\s/i.test(value4[0])) {
      let value7: Dynamic = value4.shift().toLowerCase();
      count = value7.includes("right")
        ? 90
        : value7.includes("left")
          ? 270
          : value7.includes("top")
            ? 0
            : 180;
    }
    return value4.length === 0
      ? null
      : value3
        ? {
            angle: count,
            stops: value4,
            radial: true,
            ...(value5 !== undefined
              ? {
                  shape: value5,
                }
              : {}),
          }
        : {
            angle: count,
            stops: value4,
          };
  }
  function serializeCssGradient(input?: Dynamic): Dynamic {
    return input.radial
      ? `radial-gradient(${input.shape !== undefined ? input.shape + ", " : ""}${input.stops.join(", ")})`
      : `linear-gradient(${input.angle}deg, ${input.stops.join(", ")})`;
  }
  function parseCssBoxShadow(input?: Dynamic): Dynamic {
    let value: Dynamic = (input ?? "").trim();
    if (
      !value ||
      value === "none" ||
      (0, runtime.classifyStyleValue)(value).kind !== "literal"
    )
      return null;
    let value2: Dynamic = splitGradientArguments(value)[0] ?? value,
      items: Dynamic = [],
      index: Dynamic = 0,
      text: Dynamic = "";
    for (let value3 of value2 as Dynamic) {
      value3 === "("
        ? index++
        : value3 === ")" && (index = Math.max(0, index - 1));
      if (/\s/.test(value3) && index === 0) {
        text && items.push(text);
        text = "";
        continue;
      }
      text += value3;
    }
    text && items.push(text);
    let items2: Dynamic = [],
      items3: Dynamic = [];
    for (let value3 of items as Dynamic) {
      if (value3 === "inset") continue;
      let value4: Dynamic = (0, runtime.parseCssNumber)(value3);
      value4 && items2.length < 4
        ? items2.push(value4.value)
        : items3.push(value3);
    }
    return items2.length < 2
      ? null
      : {
          x: items2[0],
          y: items2[1],
          blur: items2[2] ?? 0,
          spread: items2[3] ?? 0,
          color: items3.join(" ") || "rgba(0, 0, 0, 0.15)",
        };
  }
  function serializeCssBoxShadow(input?: Dynamic): Dynamic {
    return `${input.x}px ${input.y}px ${input.blur}px ${input.spread}px ${input.color}`;
  }
  function contrastingGradientSeed(input?: Dynamic): Dynamic {
    let text: Dynamic = "#c1672a",
      value: Dynamic = (0, runtime.hsvaToRgbHex)(
        (0, runtime.parseHsvaColor)(input),
      ).toLowerCase(),
      value2: Dynamic = value === text ? "#ffffff" : text,
      callback: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic =>
        parseInt(input2.slice(1 + options * 2, 3 + options * 2), 16);
    return (
      "#" +
      [0, 1, 2]
        .map(
          (input2?: Dynamic): Dynamic =>
            Math.round(
              callback(value, input2) +
                (callback(value2, input2) - callback(value, input2)) * 0.6,
            )
              .toString(16)
              .padStart(2, "0"),
        )
        .join("")
    );
  }
  bindRuntimeValue(runtime, "parseCssGradientStop", () => parseCssGradientStop);
  bindRuntimeValue(
    runtime,
    "serializeCssGradientStop",
    () => serializeCssGradientStop,
  );
  bindRuntimeValue(
    runtime,
    "splitGradientArguments",
    () => splitGradientArguments,
  );
  bindRuntimeValue(runtime, "parseCssGradient", () => parseCssGradient);
  bindRuntimeValue(runtime, "serializeCssGradient", () => serializeCssGradient);
  bindRuntimeValue(
    runtime,
    "CssGradientsXYBlurConfig",
    () => CssGradientsXYBlurConfig,
    (value) => {
      CssGradientsXYBlurConfig = value;
    },
  );
  bindRuntimeValue(runtime, "parseCssBoxShadow", () => parseCssBoxShadow);
  bindRuntimeValue(
    runtime,
    "serializeCssBoxShadow",
    () => serializeCssBoxShadow,
  );
  bindRuntimeValue(
    runtime,
    "contrastingGradientSeed",
    () => contrastingGradientSeed,
  );
  bindRuntimeValue(
    runtime,
    "CssGradientsItems",
    () => CssGradientsItems,
    (value) => {
      CssGradientsItems = value;
    },
  );
  return () => {
    CssGradientsXYBlurConfig = {
      x: 0,
      y: 4,
      blur: 12,
      spread: 0,
      color: "rgba(0, 0, 0, 0.15)",
    };
    CssGradientsItems = [
      {
        prop: "background",
        value: null,
      },
      {
        prop: "background-clip",
        value: "text",
      },
      {
        prop: "-webkit-background-clip",
        value: "text",
      },
      {
        prop: "-webkit-text-fill-color",
        value: "transparent",
      },
    ];
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorColorContrast(
  runtime: RuntimeBindings,
): () => void {
  var hexColorPattern: Dynamic;
  var rgbColorPattern: Dynamic;
  var clampColorChannel: Dynamic;
  var ColorContrastConstant: Dynamic;
  var contrastThresholds: Dynamic;
  var formatContrastNumber: Dynamic;
  function parseRgbaColor(cssColor?: Dynamic): Dynamic {
    let normalized: Dynamic = cssColor.trim(),
      hexDigits: Dynamic = hexColorPattern.exec(normalized)?.[1];
    if (hexDigits !== undefined) {
      let value6: Dynamic =
          hexDigits.length <= 4
            ? hexDigits.replace(
                /[0-9a-f]/gi,
                (input?: Dynamic): Dynamic => input + input,
              )
            : hexDigits,
        callback2: Dynamic = (input?: Dynamic): Dynamic =>
          parseInt(value6.slice(input * 2, input * 2 + 2), 16) / 255;
      return {
        r: callback2(0),
        g: callback2(1),
        b: callback2(2),
        a: value6.length === 8 ? callback2(3) : 1,
      };
    }
    let value: Dynamic = rgbColorPattern.exec(normalized);
    if (value === null) return;
    let callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        clampColorChannel(Number(input) / (options === "%" ? 100 : 255)),
      value2: Dynamic = callback(value[1], value[2]),
      value3: Dynamic = callback(value[3], value[4]),
      value4: Dynamic = callback(value[5], value[6]),
      value5: Dynamic =
        value[7] === undefined
          ? 1
          : clampColorChannel(Number(value[7]) / (value[8] === "%" ? 100 : 1));
    return [value2, value3, value4, value5].every(Number.isFinite)
      ? {
          r: value2,
          g: value3,
          b: value4,
          a: value5,
        }
      : undefined;
  }
  function relativeLuminance(color?: Dynamic): Dynamic {
    let linearize: Dynamic = (input?: Dynamic): Dynamic =>
      input <= 0.03928 ? input / 12.92 : ((input + 0.055) / 1.055) ** 2.4;
    return (
      0.2126 * linearize(color.r) +
      0.7152 * linearize(color.g) +
      0.0722 * linearize(color.b)
    );
  }
  function compositeRgbaColor(
    foreground?: Dynamic,
    background?: Dynamic,
  ): Dynamic {
    let blend: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
      foreground.a * input + (1 - foreground.a) * options;
    return {
      r: blend(foreground.r, background.r),
      g: blend(foreground.g, background.g),
      b: blend(foreground.b, background.b),
      a: 1,
    };
  }
  function contrastRatio(foreground?: Dynamic, background?: Dynamic): Dynamic {
    let foregroundLuminance: Dynamic = relativeLuminance(
        compositeRgbaColor(foreground, background),
      ),
      backgroundLuminance: Dynamic = relativeLuminance(background);
    return foregroundLuminance > backgroundLuminance
      ? (foregroundLuminance + 0.05) / (backgroundLuminance + 0.05)
      : (backgroundLuminance + 0.05) / (foregroundLuminance + 0.05);
  }
  function evaluateColorContrast(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      typeof input == "string" ? parseRgbaColor(input) : input;
    if (value === undefined) return;
    let value2: Dynamic = contrastThresholds[options.role ?? "text"],
      value3: Dynamic = Array.isArray(options.against)
        ? options.against
        : [options.against],
      items: Dynamic = [];
    for (let value4 of value3 as Dynamic) {
      let value5: Dynamic = parseRgbaColor(value4.css);
      if (value5 === undefined) continue;
      let value6: Dynamic = contrastRatio(value, {
        ...value5,
        a: 1,
      });
      items.push({
        ground: value4,
        ratio: value6,
        min: value2,
        passes: value6 + ColorContrastConstant >= value2,
      });
    }
    return items.length > 0 ? items : undefined;
  }
  function worstContrastResult(results?: Dynamic): Dynamic {
    let worst: Dynamic = results[0];
    for (let value of results as Dynamic)
      value.ratio < worst.ratio && (worst = value);
    return worst;
  }
  function formatContrastRatio(ratio?: Dynamic): Dynamic {
    return formatContrastNumber(ratio) + ":1";
  }
  function formatSpokenContrastRatio(ratio?: Dynamic): Dynamic {
    return formatContrastNumber(ratio) + " to 1";
  }
  function rgbaToHex(color?: Dynamic): Dynamic {
    let channelToHex: Dynamic = (input?: Dynamic): Dynamic =>
      Math.round(clampColorChannel(input) * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    return (
      "#" +
      channelToHex(color.r) +
      channelToHex(color.g) +
      channelToHex(color.b) +
      (color.a < 1 ? channelToHex(color.a) : "")
    );
  }
  bindRuntimeValue(
    runtime,
    "hexColorPattern",
    () => hexColorPattern,
    (value) => {
      hexColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rgbColorPattern",
    () => rgbColorPattern,
    (value) => {
      rgbColorPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampColorChannel",
    () => clampColorChannel,
    (value) => {
      clampColorChannel = value;
    },
  );
  bindRuntimeValue(runtime, "parseRgbaColor", () => parseRgbaColor);
  bindRuntimeValue(runtime, "relativeLuminance", () => relativeLuminance);
  bindRuntimeValue(runtime, "compositeRgbaColor", () => compositeRgbaColor);
  bindRuntimeValue(runtime, "contrastRatio", () => contrastRatio);
  bindRuntimeValue(
    runtime,
    "ColorContrastConstant",
    () => ColorContrastConstant,
    (value) => {
      ColorContrastConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "contrastThresholds",
    () => contrastThresholds,
    (value) => {
      contrastThresholds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "evaluateColorContrast",
    () => evaluateColorContrast,
  );
  bindRuntimeValue(runtime, "worstContrastResult", () => worstContrastResult);
  bindRuntimeValue(
    runtime,
    "formatContrastNumber",
    () => formatContrastNumber,
    (value) => {
      formatContrastNumber = value;
    },
  );
  bindRuntimeValue(runtime, "formatContrastRatio", () => formatContrastRatio);
  bindRuntimeValue(
    runtime,
    "formatSpokenContrastRatio",
    () => formatSpokenContrastRatio,
  );
  bindRuntimeValue(runtime, "rgbaToHex", () => rgbaToHex);
  return () => {
    hexColorPattern = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    rgbColorPattern =
      /^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i;
    clampColorChannel = (input?: Dynamic): Dynamic =>
      input < 0 ? 0 : input > 1 ? 1 : input;
    ColorContrastConstant = 1e-9;
    contrastThresholds = {
      text: 4.5,
      largeText: 3,
      graphic: 3,
    };
    formatContrastNumber = (input?: Dynamic): Dynamic => {
      let value: Dynamic =
        Math.floor((input + ColorContrastConstant) * 10) / 10;
      return value < 10 || !Number.isInteger(value)
        ? value.toFixed(1)
        : String(value);
    };
  };
}

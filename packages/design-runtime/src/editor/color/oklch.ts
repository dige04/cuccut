/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorColorOklch(runtime: RuntimeBindings): () => void {
  var srgbToLinear: Dynamic;
  var linearToSrgb: Dynamic;
  var ColorOklchResolvedValue: Dynamic;
  var isInRgbGamut: Dynamic;
  function rgbToOklch(color?: Dynamic): Dynamic {
    let linearRed: Dynamic = srgbToLinear(color.r),
      linearGreen: Dynamic = srgbToLinear(color.g),
      linearBlue: Dynamic = srgbToLinear(color.b),
      value: Dynamic = Math.cbrt(
        0.4122214708 * linearRed +
          0.5363325363 * linearGreen +
          0.0514459929 * linearBlue,
      ),
      value2: Dynamic = Math.cbrt(
        0.2119034982 * linearRed +
          0.6806995451 * linearGreen +
          0.1073969566 * linearBlue,
      ),
      value3: Dynamic = Math.cbrt(
        0.0883024619 * linearRed +
          0.2817188376 * linearGreen +
          0.6299787005 * linearBlue,
      ),
      value4: Dynamic =
        0.2104542553 * value + 0.793617785 * value2 - 0.0040720468 * value3,
      value5: Dynamic =
        1.9779984951 * value - 2.428592205 * value2 + 0.4505937099 * value3,
      value6: Dynamic =
        0.0259040371 * value + 0.7827717662 * value2 - 0.808675766 * value3;
    return {
      l: value4,
      c: Math.hypot(value5, value6),
      h: Math.atan2(value6, value5),
    };
  }
  function oklchToRgb(
    lightness?: Dynamic,
    chroma?: Dynamic,
    hue?: Dynamic,
  ): Dynamic {
    let value: Dynamic = chroma * Math.cos(hue),
      value2: Dynamic = chroma * Math.sin(hue),
      value3: Dynamic =
        (lightness + 0.3963377774 * value + 0.2158037573 * value2) ** 3,
      value4: Dynamic =
        (lightness - 0.1055613458 * value - 0.0638541728 * value2) ** 3,
      value5: Dynamic =
        (lightness - 0.0894841775 * value - 1.291485548 * value2) ** 3;
    return [
      linearToSrgb(
        4.0767416621 * value3 - 3.3077115913 * value4 + 0.2309699292 * value5,
      ),
      linearToSrgb(
        -1.2684380046 * value3 + 2.6097574011 * value4 - 0.3413193965 * value5,
      ),
      linearToSrgb(
        -0.0041960863 * value3 - 0.7034186147 * value4 + 1.707614701 * value5,
      ),
    ];
  }
  function oklchToGamutMappedRgba(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 1,
  ): Dynamic {
    let index: Dynamic = 0,
      value2: Dynamic = options;
    if (!isInRgbGamut(oklchToRgb(input, options, context))) {
      for (let index2: Dynamic = 0; index2 < 18; index2++) {
        let value6: Dynamic = (index + value2) / 2;
        isInRgbGamut(oklchToRgb(input, value6, context))
          ? (index = value6)
          : (value2 = value6);
      }
      value2 = index;
    }
    let [value3, value4, value5]: Dynamic = oklchToRgb(input, value2, context),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        Math.round((0, runtime.clampColorChannel)(input2) * 255) / 255;
    return {
      r: callback(value3),
      g: callback(value4),
      b: callback(value5),
      a: callback(value),
    };
  }
  function findReadableShade(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      typeof input == "string" ? (0, runtime.parseRgbaColor)(input) : input;
    if (value === undefined) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
      let value11: Dynamic = (0, runtime.evaluateColorContrast)(
        input2,
        options,
      );
      return value11 === undefined
        ? undefined
        : {
            passes: value11.every((input3?: Dynamic): Dynamic => input3.passes),
            worst: (0, runtime.worstContrastResult)(value11),
          };
    };
    if (callback(value)?.passes !== false) return;
    let { l: value2, c: value3, h: value4 }: Dynamic = rgbToOklch(value),
      value5: Dynamic = value3 < 1e-4 ? 0 : value3,
      value6: Dynamic = 1 / 256,
      value7: Dynamic =
        (Array.isArray(options.against) ? options.against.length : 1) === 1,
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        if (
          value7 &&
          callback(oklchToGamutMappedRgba(input2, value5, value4, value.a))
            ?.passes !== true
        )
          return;
        let value11: Dynamic = value2;
        for (let value12: Dynamic = value2; value12 !== input2; ) {
          value11 = value12;
          value12 =
            Math.abs(input2 - value12) <= value6
              ? input2
              : value12 + Math.sign(input2 - value2) * value6;
          let value13: Dynamic = oklchToGamutMappedRgba(
              value12,
              value5,
              value4,
              value.a,
            ),
            value14: Dynamic = callback(value13);
          if (value14?.passes === true) {
            for (let index: Dynamic = 0; index < 12; index++) {
              let value15: Dynamic = (value11 + value12) / 2,
                value16: Dynamic = oklchToGamutMappedRgba(
                  value15,
                  value5,
                  value4,
                  value.a,
                ),
                value17: Dynamic = callback(value16);
              value17?.passes === true
                ? ((value12 = value15),
                  (value13 = value16),
                  (value14 = value17))
                : (value11 = value15);
            }
            return {
              rgba: value13,
              worst: value14.worst,
              moved: Math.abs(rgbToOklch(value13).l - value2),
            };
          }
        }
      },
      value8: Dynamic = callback2(1),
      value9: Dynamic = callback2(0),
      value10: Dynamic =
        value8 === undefined
          ? value9
          : value9 === undefined
            ? value8
            : Math.abs(value8.moved - value9.moved) > 0.001
              ? value8.moved < value9.moved
                ? value8
                : value9
              : value8.worst.ratio >= value9.worst.ratio
                ? value8
                : value9;
    return value10 === undefined
      ? undefined
      : {
          rgba: value10.rgba,
          css: (0, runtime.rgbaToHex)(value10.rgba),
          ground: value10.worst.ground,
          ratio: value10.worst.ratio,
        };
  }
  bindRuntimeValue(
    runtime,
    "srgbToLinear",
    () => srgbToLinear,
    (value) => {
      srgbToLinear = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linearToSrgb",
    () => linearToSrgb,
    (value) => {
      linearToSrgb = value;
    },
  );
  bindRuntimeValue(runtime, "rgbToOklch", () => rgbToOklch);
  bindRuntimeValue(runtime, "oklchToRgb", () => oklchToRgb);
  bindRuntimeValue(
    runtime,
    "ColorOklchResolvedValue",
    () => ColorOklchResolvedValue,
    (value) => {
      ColorOklchResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isInRgbGamut",
    () => isInRgbGamut,
    (value) => {
      isInRgbGamut = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "oklchToGamutMappedRgba",
    () => oklchToGamutMappedRgba,
  );
  bindRuntimeValue(runtime, "findReadableShade", () => findReadableShade);
  return () => {
    srgbToLinear = (channel?: Dynamic): Dynamic =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    linearToSrgb = (channel?: Dynamic): Dynamic =>
      channel <= 0.0031308
        ? 12.92 * channel
        : 1.055 * channel ** (1 / 2.4) - 0.055;
    ColorOklchResolvedValue = 1 / 512;
    isInRgbGamut = (input?: Dynamic): Dynamic =>
      input.every(
        (input2?: Dynamic): Dynamic =>
          input2 >= -ColorOklchResolvedValue &&
          input2 <= 1 + ColorOklchResolvedValue,
      );
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type {
  ContrastCheck,
  ContrastForeground,
  ContrastGround,
  ContrastRgba,
} from "./contrast-controls";

/** WCAG content class that picks the minimum ratio. */
export type ContrastRole = "text" | "largeText" | "graphic";
/** What a color has to stand out against: one ground or several, and the content class. */
export interface ContrastRequirement {
  /** Defaults to "text". */
  role?: ContrastRole;
  against: ContrastGround | ContrastGround[];
}
/** The color channels (0..1) that matter for luminance. */
export type ContrastChannels = Pick<ContrastRgba, "r" | "g" | "b">;
/** A color in the OKLCH space; `h` is in radians. */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
}
/** A shade that satisfies a requirement, with the ground it came closest to failing. */
export interface ContrastColorFixResult {
  rgba: ContrastRgba;
  css: string;
  ground: ContrastGround;
  ratio: number;
}
/** A candidate of the fix search: the shade, its weakest check and how far it moved in lightness. */
interface ContrastFixCandidate {
  rgba: ContrastRgba;
  worst: ContrastCheck;
  moved: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    parseContrastColor: (text: string) => ContrastRgba | undefined;
    relativeLuminance: (color: ContrastChannels) => number;
    compositeContrastColor: (
      foreground: ContrastRgba,
      background: ContrastChannels,
    ) => ContrastRgba;
    contrastRatio: (
      foreground: ContrastRgba,
      background: ContrastRgba,
    ) => number;
    strongerContrastColor: (
      color: ContrastForeground,
      first: string,
      second: string,
    ) => string;
    colorContrastResults: (
      color: ContrastForeground,
      contrast: ContrastRequirement,
    ) => ContrastCheck[] | undefined;
    worstContrastResult: (results: readonly ContrastCheck[]) => ContrastCheck;
    contrastRatioReadout: (ratio: number) => string;
    contrastRatioSpoken: (ratio: number) => string;
    contrastColorHex: (color: ContrastRgba) => string;
    rgbToOklch: (color: ContrastChannels) => OklchColor;
    oklchToRgb: (
      lightness: number,
      chroma: number,
      hue: number,
    ) => [number, number, number];
    clippedOklchColor: (
      lightness: number,
      chroma: number,
      hue: number,
      alpha?: number,
    ) => ContrastRgba;
    contrastColorFix: (
      color: ContrastForeground,
      contrast: ContrastRequirement,
    ) => ContrastColorFixResult | undefined;
    CONTRAST_HEX_PATTERN: RegExp;
    CONTRAST_RGB_PATTERN: RegExp;
    clampColorChannel_di: (channel: number) => number;
    CONTRAST_RATIO_EPSILON: number;
    CONTRAST_MINIMUMS: Record<ContrastRole, number>;
    formatContrastRatio: (ratio: number) => string;
    srgbToLinearChannel: (channel: number) => number;
    linearToSrgbChannel: (channel: number) => number;
    oklchHueRadians: number;
    rgbIsInGamut: (color: readonly number[]) => boolean;
    initializeUiContrast: () => void;
  }
}

export function installUiContrast(runtime: RuntimeBindings): () => void {
  var CONTRAST_HEX_PATTERN: RegExp;
  var CONTRAST_RGB_PATTERN: RegExp;
  var clampColorChannel_di: RuntimeBindings["clampColorChannel_di"];
  var CONTRAST_RATIO_EPSILON: number;
  var CONTRAST_MINIMUMS: RuntimeBindings["CONTRAST_MINIMUMS"];
  var formatContrastRatio: RuntimeBindings["formatContrastRatio"];
  var srgbToLinearChannel: RuntimeBindings["srgbToLinearChannel"];
  var linearToSrgbChannel: RuntimeBindings["linearToSrgbChannel"];
  var oklchHueRadians: number;
  var rgbIsInGamut: RuntimeBindings["rgbIsInGamut"];
  var initializeUiContrast: () => void;
  function parseContrastColor(text: string): ContrastRgba | undefined {
    let value = text.trim(),
      value2 = CONTRAST_HEX_PATTERN.exec(value)?.[1];
    if (value2 !== undefined) {
      let value8 =
          value2.length <= 4
            ? value2.replace(
                /[0-9a-f]/gi,
                (input: string): string => input + input,
              )
            : value2,
        callback2 = (input: number): number =>
          parseInt(value8.slice(input * 2, input * 2 + 2), 16) / 255;
      return {
        r: callback2(0),
        g: callback2(1),
        b: callback2(2),
        a: value8.length === 8 ? callback2(3) : 1,
      };
    }
    let value3 = CONTRAST_RGB_PATTERN.exec(value);
    if (value3 === null) {
      return;
    }
    let callback = (input: string | undefined, options: string | undefined): number =>
        clampColorChannel_di(Number(input) / (options === "%" ? 100 : 255)),
      value4 = callback(value3[1], value3[2]),
      value5 = callback(value3[3], value3[4]),
      value6 = callback(value3[5], value3[6]),
      value7 =
        value3[7] === undefined
          ? 1
          : clampColorChannel_di(
              Number(value3[7]) / (value3[8] === "%" ? 100 : 1),
            );
    if ([value4, value5, value6, value7].every(Number.isFinite)) {
      return {
        r: value4,
        g: value5,
        b: value6,
        a: value7,
      };
    } else {
      return undefined;
    }
  }
  function relativeLuminance(color: ContrastChannels): number {
    let callback = (input: number): number =>
      input <= 0.03928 ? input / 12.92 : ((input + 0.055) / 1.055) ** 2.4;
    return (
      0.2126 * callback(color.r) +
      0.7152 * callback(color.g) +
      0.0722 * callback(color.b)
    );
  }
  function compositeContrastColor(
    foreground: ContrastRgba,
    background: ContrastChannels,
  ): ContrastRgba {
    let callback = (input: number, options: number): number =>
      foreground.a * input + (1 - foreground.a) * options;
    return {
      r: callback(foreground.r, background.r),
      g: callback(foreground.g, background.g),
      b: callback(foreground.b, background.b),
      a: 1,
    };
  }
  function contrastRatio(
    foreground: ContrastRgba,
    background: ContrastRgba,
  ): number {
    let value = relativeLuminance(
        compositeContrastColor(foreground, background),
      ),
      value2 = relativeLuminance(background);
    if (value > value2) {
      return (value + 0.05) / (value2 + 0.05);
    } else {
      return (value2 + 0.05) / (value + 0.05);
    }
  }
  function strongerContrastColor(
    color: ContrastForeground,
    first: string,
    second: string,
  ): string {
    let value =
        typeof color === "string" ? parseContrastColor(color) : color,
      value2 = parseContrastColor(first),
      value3 = parseContrastColor(second);
    if (value === undefined || value2 === undefined || value3 === undefined) {
      return second;
    }
    let state = {
      ...value,
      a: 1,
    };
    if (contrastRatio(value2, state) > contrastRatio(value3, state)) {
      return first;
    } else {
      return second;
    }
  }
  function colorContrastResults(
    color: ContrastForeground,
    contrast: ContrastRequirement,
  ): ContrastCheck[] | undefined {
    let value =
      typeof color === "string" ? parseContrastColor(color) : color;
    if (value === undefined) {
      return;
    }
    let value2 = CONTRAST_MINIMUMS[contrast.role ?? "text"],
      value3 = Array.isArray(contrast.against)
        ? contrast.against
        : [contrast.against],
      items: ContrastCheck[] = [];
    for (let value4 of value3) {
      let value5 = parseContrastColor(value4.css);
      if (value5 === undefined) {
        continue;
      }
      let value6 = contrastRatio(value, {
        ...value5,
        a: 1,
      });
      items.push({
        ground: value4,
        ratio: value6,
        min: value2,
        passes: value6 + CONTRAST_RATIO_EPSILON >= value2,
      });
    }
    if (items.length > 0) {
      return items;
    } else {
      return undefined;
    }
  }
  function worstContrastResult(
    results: readonly ContrastCheck[],
  ): ContrastCheck {
    let value = results[0]!;
    for (let value2 of results)
      if (value2.ratio < value.ratio) {
        value = value2;
      }
    return value;
  }
  function contrastRatioReadout(ratio: number): string {
    return formatContrastRatio(ratio) + ":1";
  }
  function contrastRatioSpoken(ratio: number): string {
    return formatContrastRatio(ratio) + " to 1";
  }
  function contrastColorHex(color: ContrastRgba): string {
    let callback = (input: number): string =>
      Math.round(clampColorChannel_di(input) * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    return (
      "#" +
      callback(color.r) +
      callback(color.g) +
      callback(color.b) +
      (color.a < 1 ? callback(color.a) : "")
    );
  }
  function rgbToOklch(color: ContrastChannels): OklchColor {
    let value = srgbToLinearChannel(color.r),
      value2 = srgbToLinearChannel(color.g),
      value3 = srgbToLinearChannel(color.b),
      value4 = Math.cbrt(
        0.4122214708 * value + 0.5363325363 * value2 + 0.0514459929 * value3,
      ),
      value5 = Math.cbrt(
        0.2119034982 * value + 0.6806995451 * value2 + 0.1073969566 * value3,
      ),
      value6 = Math.cbrt(
        0.0883024619 * value + 0.2817188376 * value2 + 0.6299787005 * value3,
      ),
      value7 =
        0.2104542553 * value4 + 0.793617785 * value5 - 0.0040720468 * value6,
      value8 =
        1.9779984951 * value4 - 2.428592205 * value5 + 0.4505937099 * value6,
      value9 =
        0.0259040371 * value4 + 0.7827717662 * value5 - 0.808675766 * value6;
    return {
      l: value7,
      c: Math.hypot(value8, value9),
      h: Math.atan2(value9, value8),
    };
  }
  function oklchToRgb(
    lightness: number,
    chroma: number,
    hue: number,
  ): [number, number, number] {
    let value = chroma * Math.cos(hue),
      value2 = chroma * Math.sin(hue),
      value3 =
        (lightness + 0.3963377774 * value + 0.2158037573 * value2) ** 3,
      value4 =
        (lightness - 0.1055613458 * value - 0.0638541728 * value2) ** 3,
      value5 =
        (lightness - 0.0894841775 * value - 1.291485548 * value2) ** 3;
    return [
      linearToSrgbChannel(
        4.0767416621 * value3 - 3.3077115913 * value4 + 0.2309699292 * value5,
      ),
      linearToSrgbChannel(
        -1.2684380046 * value3 + 2.6097574011 * value4 - 0.3413193965 * value5,
      ),
      linearToSrgbChannel(
        -0.0041960863 * value3 - 0.7034186147 * value4 + 1.707614701 * value5,
      ),
    ];
  }
  function clippedOklchColor(
    lightness: number,
    chroma: number,
    hue: number,
    alpha: number = 1,
  ): ContrastRgba {
    let index = 0,
      value = chroma;
    if (!rgbIsInGamut(oklchToRgb(lightness, chroma, hue))) {
      for (let index2 = 0; index2 < 18; index2++) {
        let value5 = (index + value) / 2;
        if (rgbIsInGamut(oklchToRgb(lightness, value5, hue))) {
          index = value5;
        } else {
          value = value5;
        }
      }
      value = index;
    }
    let [value2, value3, value4] = oklchToRgb(lightness, value, hue),
      callback = (input: number): number =>
        Math.round(clampColorChannel_di(input) * 255) / 255;
    return {
      r: callback(value2),
      g: callback(value3),
      b: callback(value4),
      a: callback(alpha),
    };
  }
  function contrastColorFix(
    color: ContrastForeground,
    contrast: ContrastRequirement,
  ): ContrastColorFixResult | undefined {
    let value =
      typeof color === "string" ? parseContrastColor(color) : color;
    if (value === undefined) {
      return;
    }
    let callback = (
      input: ContrastRgba,
    ): { passes: boolean; worst: ContrastCheck } | undefined => {
      let value7 = colorContrastResults(input, contrast);
      if (value7 === undefined) {
        return undefined;
      } else {
        return {
          passes: value7.every((input2) => input2.passes),
          worst: worstContrastResult(value7),
        };
      }
    };
    if (callback(value)?.passes !== false) {
      return;
    }
    let { l: l, c: c, h: h } = rgbToOklch(value),
      value2 = c < 0.0001 ? 0 : c,
      count = 0.00390625,
      value3 =
        (Array.isArray(contrast.against) ? contrast.against.length : 1) === 1,
      callback2 = (input: number): ContrastFixCandidate | undefined => {
        if (
          value3 &&
          callback(clippedOklchColor(input, value2, h, value.a))?.passes !==
            true
        ) {
          return;
        }
        let value7 = l;
        for (let value8 = l; value8 !== input; ) {
          value7 = value8;
          value8 =
            Math.abs(input - value8) <= count
              ? input
              : value8 + Math.sign(input - l) * count;
          let value9 = clippedOklchColor(value8, value2, h, value.a),
            value10 = callback(value9);
          if (value10?.passes !== true) {
            continue;
          }
          for (let index = 0; index < 12; index++) {
            let value11 = (value7 + value8) / 2,
              value12 = clippedOklchColor(value11, value2, h, value.a),
              value13 = callback(value12);
            if (value13?.passes === true) {
              value8 = value11;
              value9 = value12;
              value10 = value13;
            } else {
              value7 = value11;
            }
          }
          return {
            rgba: value9,
            worst: value10.worst,
            moved: Math.abs(rgbToOklch(value9).l - l),
          };
        }
        return;
      },
      value4 = callback2(1),
      value5 = callback2(0),
      value6 =
        value4 === undefined
          ? value5
          : value5 === undefined
            ? value4
            : Math.abs(value4.moved - value5.moved) > 0.001
              ? value4.moved < value5.moved
                ? value4
                : value5
              : value4.worst.ratio >= value5.worst.ratio
                ? value4
                : value5;
    if (value6 === undefined) {
      return undefined;
    } else {
      return {
        rgba: value6.rgba,
        css: contrastColorHex(value6.rgba),
        ground: value6.worst.ground,
        ratio: value6.worst.ratio,
      };
    }
  }
  bindRuntimeValue(runtime, "parseContrastColor", () => parseContrastColor);
  bindRuntimeValue(runtime, "relativeLuminance", () => relativeLuminance);
  bindRuntimeValue(
    runtime,
    "compositeContrastColor",
    () => compositeContrastColor,
  );
  bindRuntimeValue(runtime, "contrastRatio", () => contrastRatio);
  bindRuntimeValue(
    runtime,
    "strongerContrastColor",
    () => strongerContrastColor,
  );
  bindRuntimeValue(runtime, "colorContrastResults", () => colorContrastResults);
  bindRuntimeValue(runtime, "worstContrastResult", () => worstContrastResult);
  bindRuntimeValue(runtime, "contrastRatioReadout", () => contrastRatioReadout);
  bindRuntimeValue(runtime, "contrastRatioSpoken", () => contrastRatioSpoken);
  bindRuntimeValue(runtime, "contrastColorHex", () => contrastColorHex);
  bindRuntimeValue(runtime, "rgbToOklch", () => rgbToOklch);
  bindRuntimeValue(runtime, "oklchToRgb", () => oklchToRgb);
  bindRuntimeValue(runtime, "clippedOklchColor", () => clippedOklchColor);
  bindRuntimeValue(runtime, "contrastColorFix", () => contrastColorFix);
  bindRuntimeValue(
    runtime,
    "CONTRAST_HEX_PATTERN",
    () => CONTRAST_HEX_PATTERN,
    (value) => {
      CONTRAST_HEX_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_RGB_PATTERN",
    () => CONTRAST_RGB_PATTERN,
    (value) => {
      CONTRAST_RGB_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampColorChannel_di",
    () => clampColorChannel_di,
    (value) => {
      clampColorChannel_di = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_RATIO_EPSILON",
    () => CONTRAST_RATIO_EPSILON,
    (value) => {
      CONTRAST_RATIO_EPSILON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_MINIMUMS",
    () => CONTRAST_MINIMUMS,
    (value) => {
      CONTRAST_MINIMUMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatContrastRatio",
    () => formatContrastRatio,
    (value) => {
      formatContrastRatio = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "srgbToLinearChannel",
    () => srgbToLinearChannel,
    (value) => {
      srgbToLinearChannel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linearToSrgbChannel",
    () => linearToSrgbChannel,
    (value) => {
      linearToSrgbChannel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "oklchHueRadians",
    () => oklchHueRadians,
    (value) => {
      oklchHueRadians = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rgbIsInGamut",
    () => rgbIsInGamut,
    (value) => {
      rgbIsInGamut = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiContrast",
    () => initializeUiContrast,
    (value) => {
      initializeUiContrast = value;
    },
  );
  return () => {
    clampColorChannel_di = (channel: number): number =>
      channel < 0 ? 0 : channel > 1 ? 1 : channel;
    CONTRAST_RATIO_EPSILON = 0.000000001;
    formatContrastRatio = (ratio: number): string => {
      let value =
        Math.floor((ratio + CONTRAST_RATIO_EPSILON) * 10) / 10;
      if (value < 10 || !Number.isInteger(value)) {
        return value.toFixed(1);
      } else {
        return String(value);
      }
    };
    srgbToLinearChannel = (channel: number): number =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    linearToSrgbChannel = (channel: number): number =>
      channel <= 0.0031308
        ? 12.92 * channel
        : 1.055 * channel ** 0.4166666666666667 - 0.055;
    oklchHueRadians = 0.001953125;
    rgbIsInGamut = (color: readonly number[]): boolean =>
      color.every(
        (input: number): boolean =>
          input >= -oklchHueRadians && input <= 1 + oklchHueRadians,
      );
    initializeUiContrast = (0, runtime.initializeOnce)(() => {
      CONTRAST_HEX_PATTERN = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
      CONTRAST_RGB_PATTERN =
        /^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i;
      CONTRAST_MINIMUMS = {
        text: 4.5,
        largeText: 3,
        graphic: 3,
      };
    });
  };
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Inclusive range of code points `[first, last]`. */
export type FontUnicodeRange = [number, number];

/** Inclusive range of font weights `[lightest, heaviest]`. */
export type FontWeightRange = [number, number];

/** One `@font-face` rule read from a stylesheet. */
export interface FontFaceDeclaration {
  /** The whole rule text. */
  text: string;
  /** Lower-cased family name without quotes. */
  family: string;
  /** Lower-cased `font-style` value. */
  style: string;
  weight: FontWeightRange;
  ranges: FontUnicodeRange[];
  /** Font file URLs found in the rule. */
  files: string[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    parseFontUnicodeRanges: (unicodeRange?: string) => FontUnicodeRange[];
    parseFontWeightRange: (weight?: string) => FontWeightRange;
    parseFontFaceDeclarations: (css: string) => FontFaceDeclaration[];
    normalizeFontFaceFamily: (family: string) => string;
    fullUnicodeRange: FontUnicodeRange;
    fontFaceRulePattern: RegExp;
    /** Builds a pattern capturing the value of one CSS property. */
    fontFacePropertyPattern: (property: string) => RegExp;
    fontFamilyPropertyPattern: RegExp;
    fontStylePropertyPattern: RegExp;
    fontWeightPropertyPattern: RegExp;
    unicodeRangePropertyPattern: RegExp;
    initializeFontFaceParser: () => void;
  }
}

export function installFontsFaceParser(runtime: RuntimeBindings): () => void {
  var normalizeFontFaceFamily: RuntimeBindings["normalizeFontFaceFamily"];
  var fullUnicodeRange: RuntimeBindings["fullUnicodeRange"];
  var fontFaceRulePattern: RuntimeBindings["fontFaceRulePattern"];
  var fontFacePropertyPattern: RuntimeBindings["fontFacePropertyPattern"];
  var fontFamilyPropertyPattern: RuntimeBindings["fontFamilyPropertyPattern"];
  var fontStylePropertyPattern: RuntimeBindings["fontStylePropertyPattern"];
  var fontWeightPropertyPattern: RuntimeBindings["fontWeightPropertyPattern"];
  var unicodeRangePropertyPattern: RuntimeBindings["unicodeRangePropertyPattern"];
  var initializeFontFaceParser: RuntimeBindings["initializeFontFaceParser"];
  function parseFontUnicodeRanges(unicodeRange?: string): FontUnicodeRange[] {
    if (unicodeRange === undefined || unicodeRange.trim() === "") {
      return [fullUnicodeRange];
    }
    let items: FontUnicodeRange[] = [];
    for (let value of unicodeRange.split(",")) {
      let value2: RegExpExecArray | null =
        /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(value.trim());
      if (value2 === null) {
        return [fullUnicodeRange];
      }
      if (value2[2] !== undefined) {
        items.push([parseInt(value2[1]!, 16), parseInt(value2[2], 16)]);
      } else if (value2[1]!.includes("?")) {
        items.push([
          parseInt(value2[1]!.replaceAll("?", "0"), 16),
          parseInt(value2[1]!.replaceAll("?", "f"), 16),
        ]);
      } else {
        items.push([parseInt(value2[1]!, 16), parseInt(value2[1]!, 16)]);
      }
    }
    if (
      items.some(
        ([input, input2]: FontUnicodeRange): boolean =>
          Number.isNaN(input) || Number.isNaN(input2) || input > input2,
      )
    ) {
      return [fullUnicodeRange];
    }
    items.sort(
      (input: FontUnicodeRange, options: FontUnicodeRange): number =>
        input[0] - options[0],
    );
    let items2: FontUnicodeRange[] = [];
    for (let value of items) {
      let value2: FontUnicodeRange | undefined = items2[items2.length - 1];
      if (value2 !== undefined && value[0] <= value2[1] + 1) {
        value2[1] = Math.max(value2[1], value[1]);
      } else {
        items2.push([value[0], value[1]]);
      }
    }
    return items2;
  }
  function parseFontWeightRange(weight?: string): FontWeightRange {
    let value: string[] = (weight ?? "").trim().toLowerCase().split(/\s+/),
      callback = (input?: string): number =>
        input === "bold"
          ? 700
          : input === undefined || input === "" || input === "normal"
            ? 400
            : Number(input),
      value2: number = callback(value[0]),
      value3: number = value.length > 1 ? callback(value[1]) : value2;
    if (Number.isFinite(value2) && Number.isFinite(value3)) {
      return [Math.min(value2, value3), Math.max(value2, value3)];
    } else {
      return [1, 1000];
    }
  }
  function parseFontFaceDeclarations(css: string): FontFaceDeclaration[] {
    return (css.match(fontFaceRulePattern) ?? [])
      .filter(
        (input: string): boolean =>
          !/[{<]/.test(input.slice(input.indexOf("{") + 1)) &&
          !/[^\x00-\x7f]/.test(input),
      )
      .map(
        (input: string): FontFaceDeclaration => ({
          text: input,
          family: normalizeFontFaceFamily(
            fontFamilyPropertyPattern.exec(input)?.[1] ?? "",
          ),
          style: (fontStylePropertyPattern.exec(input)?.[1] ?? "normal")
            .trim()
            .toLowerCase(),
          weight: parseFontWeightRange(
            fontWeightPropertyPattern.exec(input)?.[1],
          ),
          ranges: parseFontUnicodeRanges(
            unicodeRangePropertyPattern.exec(input)?.[1],
          ),
          files: [...input.matchAll(runtime.googleFontFileUrlRegex)].map(
            (input2: RegExpMatchArray): string => input2[2]!,
          ),
        }),
      );
  }
  bindRuntimeValue(
    runtime,
    "parseFontUnicodeRanges",
    () => parseFontUnicodeRanges,
  );
  bindRuntimeValue(runtime, "parseFontWeightRange", () => parseFontWeightRange);
  bindRuntimeValue(
    runtime,
    "parseFontFaceDeclarations",
    () => parseFontFaceDeclarations,
  );
  bindRuntimeValue(
    runtime,
    "normalizeFontFaceFamily",
    () => normalizeFontFaceFamily,
    (value) => {
      normalizeFontFaceFamily = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fullUnicodeRange",
    () => fullUnicodeRange,
    (value) => {
      fullUnicodeRange = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFaceRulePattern",
    () => fontFaceRulePattern,
    (value) => {
      fontFaceRulePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFacePropertyPattern",
    () => fontFacePropertyPattern,
    (value) => {
      fontFacePropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyPropertyPattern",
    () => fontFamilyPropertyPattern,
    (value) => {
      fontFamilyPropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontStylePropertyPattern",
    () => fontStylePropertyPattern,
    (value) => {
      fontStylePropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontWeightPropertyPattern",
    () => fontWeightPropertyPattern,
    (value) => {
      fontWeightPropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeRangePropertyPattern",
    () => unicodeRangePropertyPattern,
    (value) => {
      unicodeRangePropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFontFaceParser",
    () => initializeFontFaceParser,
    (value) => {
      initializeFontFaceParser = value;
    },
  );
  return () => {
    normalizeFontFaceFamily = (input: string): string =>
      input
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim()
        .toLowerCase();
    fontFacePropertyPattern = (input: string): RegExp =>
      new RegExp("(?:^|[{;\\s])" + input + "\\s*:\\s*([^;}]+)", "i");
    initializeFontFaceParser = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeFontFetching)();
      fullUnicodeRange = [0, 1114111];
      fontFaceRulePattern = /@font-face\s*\{[^}]*\}/g;
      fontFamilyPropertyPattern = fontFacePropertyPattern("font-family");
      fontStylePropertyPattern = fontFacePropertyPattern("font-style");
      fontWeightPropertyPattern = fontFacePropertyPattern("font-weight");
      unicodeRangePropertyPattern = fontFacePropertyPattern("unicode-range");
    });
  };
}

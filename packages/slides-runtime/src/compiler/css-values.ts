/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  BorderStyleValue,
  CssSizeValue,
  FilterValue,
  GradientStop,
  GradientValue,
  GridTrack,
  RadialGradientExtent,
  ShadowValue,
  TransformValue,
} from "../deck-contracts";

/** One token of a tokenized CSS value, discriminated by `t`. */
export type CssToken =
  | { t: "comma"; raw: string }
  | { t: "slash"; raw: string }
  | { t: "bad"; raw: string }
  | { t: "str"; v: string; raw: string }
  | { t: "hash"; v: string; raw: string }
  | { t: "num"; n: number; unit: string; raw: string }
  | { t: "fn"; name: string; args: string; raw: string }
  | { t: "ident"; v: string; raw: string };
/** A number token with its (lowercased) unit; `unit` is `""` when unitless. */
export type CssNumberToken = Extract<CssToken, { t: "num" }>;
/** One `property: value` declaration of an inline style. */
export interface ParsedCssDeclaration {
  prop: string;
  value: string;
}
/** Red, green and blue as 0-255 channel values (not yet rounded). */
export type RgbTriple = [red: number, green: number, blue: number];
/** Size of the box a gradient is painted into, in pixels. */
export interface GradientBox {
  w: number;
  h: number;
}
/** A gradient centre as percentages of the box. */
export interface GradientPoint {
  x: number;
  y: number;
}
/** A gradient stop whose position has not been resolved yet. */
export interface GradientStopDraft {
  color: string;
  pos?: number;
}
/** What the parser remembers about a gradient it produced. */
export interface GradientMetadata {
  /** Colour of the first stop. */
  first: string;
  /** The gradient has stops that are not opaque. */
  seeThrough: boolean;
}
/** Colour stops only: all `gradientContainsAlpha` reads. */
export interface GradientColorStops {
  stops: ReadonlyArray<{ color: string }>;
}
/** The parts of a `border` shorthand that were written. */
export interface CssBorder {
  width?: number;
  style?: BorderStyleValue;
  color?: string;
}
/** A parsed `transform`; `centerX`/`centerY` mark a `-50%` translate. */
export interface ParsedCssTransform {
  centerX: boolean;
  centerY: boolean;
  value: TransformValue;
}
/** A parsed `flex` shorthand. */
export interface CssFlex {
  grow: number;
  shrink: number;
  basis: "auto" | number;
}
/** A parsed `font` shorthand. */
export interface CssFontShorthand {
  style?: "italic";
  weight?: number;
  lineHeight?: number;
  size: number;
  family: string[];
}
/** How one CSS filter function maps onto a `FilterValue` field. */
export interface CssFilterFunctionSpec {
  field: keyof FilterValue;
  kind: "px" | "frac" | "deg";
}
/** One entry of the supported-CSS table (prompt text for the format). */
export interface SupportedCssProperty {
  /** Accepted values. */
  v: string;
  /** Elements the property applies to. */
  on: string;
  /** Other property names covered by this entry. */
  alias?: string[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    forbiddenCssTokenPattern: RegExp;
    cssPropertyNamePattern: RegExp;
    cssUrlTokenPattern: RegExp;
    cssNumberTokenPattern: RegExp;
    cssIdentifierTokenPattern: RegExp;
    namedCssColorHex: Record<string, string>;
    cssColorHexPattern: RegExp;
    parsedGradientMetadata: WeakMap<GradientValue, GradientMetadata>;
    gradientSourceMetadata: (
      gradient: GradientValue,
    ) => GradientMetadata | undefined;
    horizontalPositionKeywords: Record<string, number>;
    verticalPositionKeywords: Record<string, number>;
    cssBorderStyleAliases: Record<string, BorderStyleValue>;
    borderWidthKeywords: Record<string, number>;
    cssFilterFunctionSpecs: Record<string, CssFilterFunctionSpec>;
    supportedHtmlCssProperties: Record<string, SupportedCssProperty>;
    acceptedNoOpCssPropertyPatterns: Record<string, RegExp>;
    unsupportedCssPropertyHints: Record<string, string>;
    cssCanonicalPropertyNames: Map<string, string> | undefined;
    gradientContainsAlpha: (gradient: GradientColorStops) => boolean;
    gradientHasCustomRadialGeometry: (gradient: GradientValue) => boolean;
    initializeCssValueParser: () => void;
    parseSingleCssName: (text: string) => string | undefined;
    parseCssDeclarations: (
      css: string,
      warn: (message: string) => void,
    ) => ParsedCssDeclaration[];
    compactDiagnosticValue: (text: string, maxLength?: number) => string;
    tokenizeCssValue: (css: string) => CssToken[];
    splitCssTokenGroups: (tokens: CssToken[]) => CssToken[][];
    cssTokenPixels: (token: CssToken | undefined) => number | undefined;
    cssTokenSize: (token: CssToken | undefined) => CssSizeValue | undefined;
    cssTokenRatio: (token: CssToken | undefined) => number | undefined;
    cssTokenDegrees: (token: CssToken | undefined) => number | undefined;
    clampColorByte: (value: number) => number;
    colorByteHex: (value: number) => string;
    hslToHex: (
      hue: number,
      saturation: number,
      lightness: number,
    ) => RgbTriple;
    normalizeCssColorHex: (color: string) => string | undefined;
    parseCssColorTokens: (tokens: CssToken[]) => string | undefined;
    parseCssPositionTokens: (tokens: CssToken[]) => GradientPoint | undefined;
    gradientLineLength: (box: GradientBox, angle: number) => number;
    radialGradientDimensions: (
      box: GradientBox,
      shape: string,
      extent?: RadialGradientExtent,
      center?: GradientPoint,
    ) => number;
    resolveCssGradientStopPositions: (
      stops: string[],
      positions: Array<number | undefined>,
    ) => GradientStop[];
    interpolateGradientColors: (
      fromColor: string,
      toColor: string,
      ratio: number,
    ) => string;
    clipGradientStopsToRange: (stops: GradientStop[]) => GradientStop[];
    diagonalGradientAngle: (angle: number, box: GradientBox) => number;
    parseCssGradient: (
      token: CssToken,
      box?: GradientBox,
    ) => GradientValue | undefined;
    parseCssShadow: (
      tokens: CssToken[],
      allowInset?: boolean,
    ) => ShadowValue | undefined;
    parseCssBorder: (tokens: CssToken[]) => CssBorder | undefined;
    normalizeSignedDegrees: (angle: number) => number;
    parseCssTransform: (tokens: CssToken[]) => ParsedCssTransform | undefined;
    parseCssFilter: (tokens: CssToken[]) => FilterValue | undefined;
    expandCssBoxValues: <T>(
      tokens: CssToken[],
      parse: (token: CssToken) => T | undefined,
    ) => [T, T, T, T] | undefined;
    parseCssFlex: (tokens: CssToken[]) => CssFlex | undefined;
    parseCssGridTracks: (tokens: CssToken[]) => GridTrack[] | undefined;
    parseCssFontFamilies: (tokens: CssToken[]) => string[] | undefined;
    parseCssFontShorthand: (
      tokens: CssToken[],
    ) => CssFontShorthand | undefined;
    parseCssFontWeight: (tokens: CssToken[]) => number | undefined;
    canonicalCssPropertyName: (property: string) => string | undefined;
    cssPropertyValueHint: (property: string) => string;
    formatCssNumber: (value: number) => string;
    formatCssPixels: (value: number) => string;
    serializeCssGradient: (gradient: GradientValue) => string;
    serializeCssShadow: (shadow: ShadowValue) => string;
    serializeCssTransform: (transform: TransformValue) => string;
    serializeCssFilter: (filter: FilterValue) => string;
  }
}

export function installCompilerCssValues(runtime: RuntimeBindings): () => void {
  var forbiddenCssTokenPattern: RuntimeBindings["forbiddenCssTokenPattern"];
  var cssPropertyNamePattern: RuntimeBindings["cssPropertyNamePattern"];
  var cssUrlTokenPattern: RuntimeBindings["cssUrlTokenPattern"];
  var cssNumberTokenPattern: RuntimeBindings["cssNumberTokenPattern"];
  var cssIdentifierTokenPattern: RuntimeBindings["cssIdentifierTokenPattern"];
  var namedCssColorHex: RuntimeBindings["namedCssColorHex"];
  var cssColorHexPattern: RuntimeBindings["cssColorHexPattern"];
  var parsedGradientMetadata: RuntimeBindings["parsedGradientMetadata"];
  var gradientSourceMetadata: RuntimeBindings["gradientSourceMetadata"];
  var horizontalPositionKeywords: RuntimeBindings["horizontalPositionKeywords"];
  var verticalPositionKeywords: RuntimeBindings["verticalPositionKeywords"];
  var cssBorderStyleAliases: RuntimeBindings["cssBorderStyleAliases"];
  var borderWidthKeywords: RuntimeBindings["borderWidthKeywords"];
  var cssFilterFunctionSpecs: RuntimeBindings["cssFilterFunctionSpecs"];
  var supportedHtmlCssProperties: RuntimeBindings["supportedHtmlCssProperties"];
  var acceptedNoOpCssPropertyPatterns: RuntimeBindings["acceptedNoOpCssPropertyPatterns"];
  var unsupportedCssPropertyHints: RuntimeBindings["unsupportedCssPropertyHints"];
  var cssCanonicalPropertyNames: RuntimeBindings["cssCanonicalPropertyNames"];
  var gradientContainsAlpha: RuntimeBindings["gradientContainsAlpha"];
  var gradientHasCustomRadialGeometry: RuntimeBindings["gradientHasCustomRadialGeometry"];
  var initializeCssValueParser: RuntimeBindings["initializeCssValueParser"];
  function parseSingleCssName(text: string): string | undefined {
    let value = /^\s*(?:"([^"]*)"|'([^']*)'|([^'"\s]+))\s*$/.exec(
        text,
      ),
      value2 = (value?.[1] ?? value?.[2] ?? value?.[3])?.trim();
    if (
      value2 !== undefined &&
      value2 !== "" &&
      !/[\s"'\\<>{}()]/.test(value2)
    ) {
      return value2;
    } else {
      return undefined;
    }
  }
  function parseCssDeclarations(css: string, warn: (message: string) => void): ParsedCssDeclaration[] {
    let declarations: string[] = [],
      start = 0,
      quote: string | undefined,
      depth = 0;
    for (let index = 0; index < css.length; index++) {
      let value = css[index];
      if (quote !== undefined) {
        if (value === quote) {
          quote = undefined;
        }
        continue;
      }
      if (value === '"' || value === "'") {
        quote = value;
      } else if (value === "(") {
        start++;
      } else if (value === ")") {
        start = Math.max(0, start - 1);
      } else if (value === ";" && start === 0) {
        declarations.push(css.slice(depth, index));
        depth = index + 1;
      }
    }
    declarations.push(css.slice(depth));
    if (quote !== undefined || start > 0) {
      warn(
        "unbalanced " +
          (quote !== undefined ? "quote" : "parenthesis") +
          " in style — the last declaration was dropped",
      );
      declarations.pop();
    }
    let entries: Map<string, string> = new Map();
    for (let value of declarations) {
      if (value.trim() === "") {
        continue;
      }
      let value2 = value.indexOf(":");
      if (value2 < 0) {
        warn(
          '"' +
            compactDiagnosticValue(value) +
            '" is not a property: value declaration',
        );
        continue;
      }
      let value3 = value.slice(0, value2).trim().toLowerCase(),
        value4 = value.slice(value2 + 1).trim();
      if (!cssPropertyNamePattern.test(value3)) {
        warn(
          '"' + compactDiagnosticValue(value3) + '" is not a CSS property name',
        );
        continue;
      }
      if (/!\s*important\s*$/i.test(value4)) {
        warn(
          value3 +
            ": !important is not in this format (inline styles already win) — dropped",
        );
        continue;
      }
      if (value4 === "") {
        warn(value3 + ": empty value");
        continue;
      }
      let value5 =
        value3 === "background" || value3 === "background-image"
          ? value4.replace(cssUrlTokenPattern, "IMG")
          : value4;
      if (forbiddenCssTokenPattern.test(value5) || value5.length > 2048) {
        warn(
          value3 +
            ": value uses syntax this format does not admit (url/var/calc-like references, braces, @, backslashes) — dropped",
        );
        continue;
      }
      entries.delete(value3);
      entries.set(value3, value4);
    }
    return [...entries].map(
      ([input, input2]) => ({
        prop: input,
        value: input2,
      }),
    );
  }
  function compactDiagnosticValue(
    text: string,
    maxLength = 40,
  ): string {
    let value = text.replace(/\s+/g, " ").trim();
    if (value.length > maxLength) {
      return value.slice(0, maxLength - 1) + "…";
    } else {
      return value;
    }
  }
  function tokenizeCssValue(css: string): CssToken[] {
    let tokens: CssToken[] = [],
      position = 0,
      source = css;
    while (position < source.length) {
      let value: string = source[position]!;
      if (/\s/.test(value)) {
        position++;
        continue;
      }
      if (value === ",") {
        tokens.push({
          t: "comma",
          raw: ",",
        });
        position++;
        continue;
      }
      if (value === "/") {
        tokens.push({
          t: "slash",
          raw: "/",
        });
        position++;
        continue;
      }
      if (value === '"' || value === "'") {
        let value4 = source.indexOf(value, position + 1);
        if (value4 < 0) {
          tokens.push({
            t: "bad",
            raw: source.slice(position),
          });
          break;
        }
        tokens.push({
          t: "str",
          v: source.slice(position + 1, value4),
          raw: source.slice(position, value4 + 1),
        });
        position = value4 + 1;
        continue;
      }
      if (value === "#") {
        let value4 = /^#[0-9a-fA-F]+/.exec(source.slice(position));
        if (value4) {
          tokens.push({
            t: "hash",
            v: value4[0].toLowerCase(),
            raw: value4[0],
          });
          position += value4[0].length;
          continue;
        }
      }
      let value2 = cssNumberTokenPattern.exec(source.slice(position));
      if (
        value2 &&
        (value !== "-" || /[\d.]/.test(source[position + 1] ?? ""))
      ) {
        let value4 = position + value2[0].length,
          value5 = /^(%|[a-zA-Z]+)/.exec(source.slice(value4)),
          value6 = value5 ? value5[0].toLowerCase() : "";
        if (value5) {
          value4 += value5[0].length;
        }
        let value7 = Number(value2[0]);
        tokens.push(
          Number.isFinite(value7)
            ? {
                t: "num",
                n: value7,
                unit: value6,
                raw: source.slice(position, value4),
              }
            : {
                t: "bad",
                raw: source.slice(position, value4),
              },
        );
        position = value4;
        continue;
      }
      let value3 = cssIdentifierTokenPattern.exec(
        source.slice(position),
      );
      if (value3) {
        let value4 = position + value3[0].length;
        if (source[value4] === "(") {
          let index = 0,
            value5 = value4;
          for (; value5 < source.length; value5++)
            if (source[value5] === "(") {
              index++;
            } else if (source[value5] === ")") {
              index--;
              if (index === 0) {
                break;
              }
            }
          if (value5 >= source.length) {
            tokens.push({
              t: "bad",
              raw: source.slice(position),
            });
            break;
          }
          tokens.push({
            t: "fn",
            name: value3[0].toLowerCase(),
            args: source.slice(value4 + 1, value5),
            raw: source.slice(position, value5 + 1),
          });
          position = value5 + 1;
          continue;
        }
        tokens.push({
          t: "ident",
          v: value3[0].toLowerCase(),
          raw: value3[0],
        });
        position = value4;
        continue;
      }
      tokens.push({
        t: "bad",
        raw: value,
      });
      position++;
    }
    return tokens;
  }
  function splitCssTokenGroups(tokens: CssToken[]): CssToken[][] {
    let groups: CssToken[][] = [[]];
    for (let value of tokens)
      if (value.t === "comma") {
        groups.push([]);
      } else {
        groups[groups.length - 1]!.push(value);
      }
    return groups;
  }
  function cssTokenPixels(token: CssToken | undefined): number | undefined {
    if (token === undefined || token.t !== "num" || !Number.isFinite(token.n)) {
      return;
    }
    if (token.unit === "px" || token.unit === "") {
      return token.n;
    }
    return;
  }
  function cssTokenSize(token: CssToken | undefined): CssSizeValue | undefined {
    if (token === undefined || token.t !== "num" || !Number.isFinite(token.n)) {
      return;
    }
    if (token.unit === "%") {
      return {
        pct: token.n,
      };
    }
    if (token.unit === "px" || token.unit === "") {
      return {
        px: token.n,
      };
    }
    return;
  }
  function cssTokenRatio(token: CssToken | undefined): number | undefined {
    if (token === undefined || token.t !== "num" || !Number.isFinite(token.n)) {
      return;
    }
    if (token.unit === "%") {
      return token.n / 100;
    }
    if (token.unit === "") {
      return token.n;
    }
    return;
  }
  function cssTokenDegrees(token: CssToken | undefined): number | undefined {
    if (token === undefined || token.t !== "num" || !Number.isFinite(token.n)) {
      return;
    }
    switch (token.unit) {
      case "deg":
        return token.n;
      case "turn":
        return token.n * 360;
      case "rad":
        return (token.n * 180) / Math.PI;
      case "grad":
        return token.n * 0.9;
      case "":
        if (token.n === 0) {
          return 0;
        } else {
          return undefined;
        }
      default:
        return;
    }
  }
  function clampColorByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
  }
  function colorByteHex(value: number): string {
    return clampColorByte(value).toString(16).padStart(2, "0");
  }
  function hslToHex(
    hue: number,
    saturation: number,
    lightness: number,
  ): RgbTriple {
    let value = (((hue % 360) + 360) % 360) / 360,
      value2 =
        lightness < 0.5
          ? lightness * (1 + saturation)
          : lightness + saturation - lightness * saturation,
      value3 = 2 * lightness - value2,
      callback = (input: number): number => {
        let value4 = input;
        if (value4 < 0) {
          value4 += 1;
        }
        if (value4 > 1) {
          value4 -= 1;
        }
        if (value4 < 0.16666666666666666) {
          return value3 + (value2 - value3) * 6 * value4;
        }
        if (value4 < 0.5) {
          return value2;
        }
        if (value4 < 0.6666666666666666) {
          return value3 + (value2 - value3) * (0.6666666666666666 - value4) * 6;
        }
        return value3;
      };
    return [
      callback(value + 0.3333333333333333) * 255,
      callback(value) * 255,
      callback(value - 0.3333333333333333) * 255,
    ];
  }
  function normalizeCssColorHex(color: string): string | undefined {
    let value = color.trim().toLowerCase();
    if (value === "") {
      return;
    }
    if (cssColorHexPattern.test(value)) {
      let value8 = value.slice(1);
      if (value8.length === 3 || value8.length === 4) {
        value8 = [...value8]
          .map((input) => input + input)
          .join("");
      }
      if (value8.length === 8 && value8.endsWith("ff")) {
        value8 = value8.slice(0, 6);
      }
      return "#" + value8;
    }
    if (Object.hasOwn(namedCssColorHex, value)) {
      return namedCssColorHex[value];
    }
    if ((0, runtime.normalizeCssColor)(value) === undefined) {
      return;
    }
    let value2 = tokenizeCssValue(value),
      value3 = value2[0];
    if (value2.length !== 1 || value3 === undefined || value3.t !== "fn") {
      return;
    }
    let value4 = tokenizeCssValue(value3.args).filter(
        (input) =>
          input.t !== "comma" && input.t !== "slash",
      ),
      callback = (input: CssToken | undefined, options: number): number | undefined => {
        if (input === undefined || input.t !== "num") {
          return;
        }
        if (input.unit === "%") {
          return (input.n / 100) * options;
        }
        if (input.unit === "") {
          return input.n;
        }
        return;
      },
      value5 = value4.length === 4 ? cssTokenRatio(value4[3]) : 1;
    if (value5 === undefined) {
      return;
    }
    let value6: RgbTriple;
    if (value3.name === "rgb" || value3.name === "rgba") {
      let value8 = callback(value4[0], 255),
        value9 = callback(value4[1], 255),
        value10 = callback(value4[2], 255);
      if (
        value8 === undefined ||
        value9 === undefined ||
        value10 === undefined
      ) {
        return;
      }
      value6 = [value8, value9, value10];
    } else if (value3.name === "hsl" || value3.name === "hsla") {
      let value8 =
          value4[0]?.t === "num"
            ? (cssTokenDegrees(value4[0]) ??
              (value4[0].unit === "" ? value4[0].n : undefined))
            : undefined,
        value9 = callback(value4[1], 1),
        value10 = callback(value4[2], 1);
      if (
        value8 === undefined ||
        value9 === undefined ||
        value10 === undefined
      ) {
        return;
      }
      value6 = hslToHex(
        value8,
        Math.max(0, Math.min(1, value9)),
        Math.max(0, Math.min(1, value10)),
      );
    } else {
      return;
    }
    let value7 = Math.max(0, Math.min(1, value5));
    return (
      "#" +
      colorByteHex(value6[0]) +
      colorByteHex(value6[1]) +
      colorByteHex(value6[2]) +
      (value7 < 1 ? colorByteHex(value7 * 255) : "")
    );
  }
  function parseCssColorTokens(tokens: CssToken[]): string | undefined {
    if (tokens.length !== 1) {
      return;
    }
    return normalizeCssColorHex(tokens[0]!.raw);
  }
  function parseCssPositionTokens(tokens: CssToken[]): GradientPoint | undefined {
    if (tokens.length < 1 || tokens.length > 2) {
      return;
    }
    let callback = (input: CssToken, options: Record<string, number>): number | undefined => {
        if (input.t === "ident") {
          if (Object.hasOwn(options, input.v)) {
            return options[input.v];
          } else {
            return undefined;
          }
        }
        if (
          input.t === "num" &&
          (input.unit === "%" || (input.n === 0 && input.unit === ""))
        ) {
          return input.n;
        } else {
          return undefined;
        }
      },
      [value, value2]: [CssToken, CssToken?] = tokens as [CssToken, CssToken?];
    if (value2 === undefined) {
      let value5 =
        value.t === "ident" && value.v !== "center"
          ? callback(value, verticalPositionKeywords)
          : undefined;
      if (value5 !== undefined) {
        return {
          x: 50,
          y: value5,
        };
      }
      let value6 = callback(value, horizontalPositionKeywords);
      if (value6 === undefined) {
        return undefined;
      } else {
        return {
          x: value6,
          y: 50,
        };
      }
    }
    if (
      value.t === "ident" &&
      value2.t === "ident" &&
      ((Object.hasOwn(verticalPositionKeywords, value.v) &&
        value.v !== "center") ||
        (Object.hasOwn(horizontalPositionKeywords, value2.v) &&
          value2.v !== "center"))
    ) {
      [value, value2] = [value2, value];
    }
    let value3 = callback(value, horizontalPositionKeywords),
      value4 = callback(value2, verticalPositionKeywords);
    if (value3 === undefined || value4 === undefined) {
      return undefined;
    } else {
      return {
        x: value3,
        y: value4,
      };
    }
  }
  function gradientLineLength(box: GradientBox, angle: number): number {
    let value = (angle * Math.PI) / 180;
    return (
      Math.abs(box.w * Math.sin(value)) + Math.abs(box.h * Math.cos(value))
    );
  }
  function radialGradientDimensions(
    box: GradientBox,
    shape: string,
    extent?: RadialGradientExtent,
    center?: GradientPoint,
  ): number {
    let callback = (input: number): number =>
        Math.max(-100, Math.min(200, input)),
      [items, items2]: [number, number] = [
        (callback(center?.x ?? 50) / 100) * box.w,
        (callback(center?.y ?? 50) / 100) * box.h,
      ],
      [items3, items4]: [number, number] = [
        Math.max(Math.abs(items), Math.abs(box.w - items)),
        Math.max(Math.abs(items2), Math.abs(box.h - items2)),
      ],
      [items5, items6]: [number, number] = [
        Math.min(Math.abs(items), Math.abs(box.w - items)),
        Math.min(Math.abs(items2), Math.abs(box.h - items2)),
      ];
    if (shape === "circle") {
      if (extent === "closest-side") {
        return Math.min(items5, items6);
      } else {
        if (extent === "farthest-side") {
          return Math.max(items3, items4);
        } else {
          if (extent === "closest-corner") {
            return Math.hypot(items5, items6);
          } else {
            return Math.hypot(items3, items4);
          }
        }
      }
    }
    if (extent === "closest-side") {
      return items5;
    } else {
      if (extent === "farthest-side") {
        return items3;
      } else {
        return (extent === "closest-corner" ? items5 : items3) * Math.SQRT2;
      }
    }
  }
  function resolveCssGradientStopPositions(
    stops: string[],
    positions: Array<number | undefined>,
  ): GradientStop[] {
    let items: Array<number | undefined> = [...positions],
      length = items.length;
    items[0] ??= 0;
    items[length - 1] ??= 100;
    let value = -1 / 0;
    for (let index = 0; index < length; index++)
      if (items[index] !== undefined) {
        value = items[index] = Math.max(items[index]!, value);
      }
    for (let count = 1, index = 0; count < length; count++) {
      if (items[count] === undefined) {
        continue;
      }
      for (let value2 = index + 1; value2 < count; value2++)
        items[value2] =
          items[index]! +
          ((items[count]! - items[index]!) * (value2 - index)) / (count - index);
      index = count;
    }
    return stops.map(
      (input, options) => ({
        color: input,
        pos: items[options]!,
      }),
    );
  }
  function interpolateGradientColors(
    fromColor: string,
    toColor: string,
    ratio: number,
  ): string {
    let callback = (items3: string): number[] =>
        [1, 3, 5, 7].map(
          (input) =>
            items3.length > input
              ? parseInt(items3.slice(input, input + 2), 16)
              : 255,
        ),
      [items, items2]: [number[], number[]] = [callback(fromColor), callback(toColor)],
      value = items[3]! + (items2[3]! - items[3]!) * ratio;
    return (
      "#" +
      [
        ...[0, 1, 2].map(
          (input) =>
            value === 0
              ? 0
              : Math.round(
                  (items[input]! * items[3]! +
                    (items2[input]! * items2[3]! - items[input]! * items[3]!) *
                      ratio) /
                    value,
                ),
        ),
        ...(Math.round(value) === 255 ? [] : [Math.round(value)]),
      ]
        .map((input) => input.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  function clipGradientStopsToRange(stops: GradientStop[]): GradientStop[] {
    let callback = (input: number): string => {
        let index = 0;
        while (index + 1 < stops.length && stops[index + 1]!.pos <= input)
          index++;
        let [items2, items3]: [GradientStop, GradientStop | undefined] = [stops[index]!, stops[index + 1]];
        if (items3 === undefined || input <= items2.pos) {
          return items2.color;
        } else {
          return interpolateGradientColors(
            items2.color,
            items3.color,
            (input - items2.pos) / (items3.pos - items2.pos),
          );
        }
      },
      value = stops
        .filter(
          (input) => input.pos >= 0 && input.pos <= 100,
        )
        .map(
          (input) => ({
            color: input.color,
            pos: Math.round(input.pos * 100) / 100,
          }),
        ),
      items: GradientStop[] = [
        ...(stops[0]!.pos < 0 && value[0]?.pos !== 0
          ? [
              {
                color: callback(0),
                pos: 0,
              },
            ]
          : []),
        ...value,
        ...(stops[stops.length - 1]!.pos > 100 &&
        value[value.length - 1]?.pos !== 100
          ? [
              {
                color: callback(100),
                pos: 100,
              },
            ]
          : []),
      ];
    if (items.length === 1) {
      return [
        {
          color: items[0]!.color,
          pos: 0,
        },
        {
          color: items[0]!.color,
          pos: 100,
        },
      ];
    } else {
      return items;
    }
  }
  function diagonalGradientAngle(angle: number, box: GradientBox): number {
    let value = (Math.atan(box.h / box.w) * 180) / Math.PI;
    return (
      (((Math.round(
        (angle === 45
          ? value
          : angle === 135
            ? 180 - value
            : angle === 225
              ? 180 + value
              : 360 - value) * 100,
      ) /
        100) %
        360) +
        360) %
      360
    );
  }
  function parseCssGradient(token: CssToken, box?: GradientBox): GradientValue | undefined {
    if (token.t !== "fn") {
      return;
    }
    let value = token.name === "radial-gradient",
      value2 = token.name === "repeating-linear-gradient";
    if (!value && !value2 && token.name !== "linear-gradient") {
      return;
    }
    let value3 = splitCssTokenGroups(tokenizeCssValue(token.args)),
      count = 180,
      value4 = value3[0] ?? [],
      index = 0,
      text: string = "ellipse",
      value5: RadialGradientExtent | undefined,
      value6: GradientPoint | undefined;
    if (value) {
      if (
        value4.length > 0 &&
        value4[0]!.t === "ident" &&
        !normalizeCssColorHex(value4[0]!.raw)
      ) {
        index = 1;
        let values: Set<string> = new Set();
        for (let index3 = 0; index3 < value4.length; index3++) {
          let value11: CssToken = value4[index3]!;
          if (value11.t !== "ident") {
            return;
          }
          let value12 =
            value11.v === "circle" || value11.v === "ellipse"
              ? "shape"
              : value11.v === "farthest-corner" ||
                  runtime.radialGradientExtentValues.includes(value11.v as RadialGradientExtent)
                ? "extent"
                : value11.v === "at"
                  ? "at"
                  : undefined;
          if (value12 === undefined || values.has(value12)) {
            return;
          }
          values.add(value12);
          if (value12 === "shape") {
            text = value11.v;
          } else if (value12 === "extent") {
            value5 = value11.v === "farthest-corner" ? undefined : (value11.v as RadialGradientExtent);
          } else {
            value6 = parseCssPositionTokens(value4.slice(index3 + 1));
            if (value6 === undefined) {
              return;
            }
            break;
          }
        }
      }
    } else if (value4.length > 0) {
      let value11: CssToken = value4[0]!;
      if (
        value11.t === "num" &&
        value4.length === 1 &&
        !normalizeCssColorHex(value11.raw)
      ) {
        let value12 = cssTokenDegrees(value11);
        if (value12 === undefined) {
          return;
        }
        count = ((value12 % 360) + 360) % 360;
        index = 1;
      } else if (value11.t === "ident" && value11.v === "to") {
        let value12 = value4
            .slice(1)
            .map(
              (input) =>
                input.t === "ident" ? input.v : "?",
            )
            .sort()
            .join(" "),
          value13 = (
            {
              top: 0,
              right: 90,
              bottom: 180,
              left: 270,
              "right top": 45,
              "bottom right": 135,
              "bottom left": 225,
              "left top": 315,
            } as Record<string, number>
          )[value12];
        if (value13 === undefined) {
          return;
        }
        count =
          box !== undefined && value13 % 90 !== 0
            ? diagonalGradientAngle(value13, box)
            : value13;
        index = 1;
      }
    }
    let items: GradientStopDraft[] = [],
      items2: Array<number | undefined> = [],
      index2 = 0,
      flag = false,
      callback = (input: CssNumberToken): number | undefined => {
        let value11 =
          input.unit === "%" || (input.n === 0 && input.unit === "");
        if (box === undefined) {
          if (value11) {
            return input.n;
          } else {
            return undefined;
          }
        }
        let value12 =
            value11 || input.unit !== "px"
              ? 0
              : value
                ? radialGradientDimensions(box, text, value5, value6)
                : gradientLineLength(box, count),
          value13 = value11
            ? input.n
            : value12 < 1
              ? NaN
              : Math.round((input.n / value12) * 1e4) / 100;
        if (Number.isNaN(value13)) {
          return;
        }
        flag ||= !value11;
        return Math.max(-1e6, Math.min(1e6, value13));
      },
      callback2 = (input: CssToken): number | undefined => {
        if (input.t !== "num") {
          return;
        }
        let value11 = value2 ? undefined : callback(input),
          value12 =
            input.n === 0 && input.unit === ""
              ? 0
              : value2
                ? input.unit === "px" && input.n >= 0
                  ? input.n
                  : undefined
                : value11 === undefined
                  ? undefined
                  : Math.max(0, Math.min(100, value11));
        if (value12 !== undefined) {
          index2 = Math.max(index2, value12);
        }
        if (value12 === undefined) {
          return undefined;
        } else {
          return index2;
        }
      };
    for (let value11 of value3.slice(index)) {
      if (value11.length === 0 || value11.length > 3) {
        return;
      }
      let value12 = normalizeCssColorHex(value11[0]!.raw);
      if (value12 === undefined) {
        return;
      }
      for (let value13 of (value11.length === 1
        ? [undefined]
        : value11.slice(1))) {
        let value14 =
          value13 === undefined ? undefined : callback2(value13);
        if (value13 !== undefined && value14 === undefined) {
          return;
        }
        items.push(
          value14 === undefined
            ? {
                color: value12,
              }
            : {
                color: value12,
                pos: value14,
              },
        );
        items2.push(
          value13?.t === "num" && !value2 ? callback(value13) : undefined,
        );
      }
    }
    if (items.length < 2 || items.length > 8) {
      return;
    }
    let length = items.length,
      value7: number | undefined;
    if (value2) {
      value7 = items[length - 1]!.pos;
      if (
        value7 === undefined ||
        value7 < runtime.gradientRepeatLengthSchema.lo ||
        value7 > runtime.gradientRepeatLengthSchema.hi
      ) {
        return;
      }
      for (let value11 of items)
        if (value11.pos !== undefined) {
          value11.pos = (value11.pos / value7) * 100;
        }
    }
    items[0]!.pos ??= 0;
    items[length - 1]!.pos ??= 100;
    for (
      let count2 = 1, index3 = 0;
      count2 < length;
      count2++
    ) {
      if (items[count2]!.pos === undefined) {
        continue;
      }
      for (let value11 = index3 + 1; value11 < count2; value11++)
        items[value11]!.pos =
          items[index3]!.pos! +
          ((items[count2]!.pos! - items[index3]!.pos!) * (value11 - index3)) /
            (count2 - index3);
      index3 = count2;
    }
    let value8: GradientStop[] =
        box !== undefined &&
        !value2 &&
        items2.some(
          (input) =>
            input !== undefined && (input < 0 || input > 100),
        ) &&
        value5 === undefined
          ? clipGradientStopsToRange(
              resolveCssGradientStopPositions(
                items.map((input) => input.color),
                items2,
              ),
            )
          : items.map(
              (input) => ({
                color: input.color,
                pos: flag ? Math.round(input.pos! * 100) / 100 : input.pos!,
              }),
            ),
      value9 =
        value6 === undefined || (value6.x === 50 && value6.y === 50),
      callback3 = (input: number): number =>
        Math.max(-100, Math.min(200, input)),
      value10: GradientValue = value
        ? {
            angle: 180,
            radial: true,
            ...(text === "ellipse"
              ? {
                  shape: text,
                }
              : {}),
            ...(value5 !== undefined
              ? {
                  extent: value5,
                }
              : {}),
            ...(value9
              ? {}
              : {
                  at: {
                    x: callback3(value6!.x),
                    y: callback3(value6!.y),
                  },
                }),
            stops: value8,
          }
        : value7 !== undefined
          ? {
              angle: count,
              repeat: value7,
              stops: value8,
            }
          : {
              angle: count,
              stops: value8,
            };
    if (box !== undefined && !flag) {
      parsedGradientMetadata.set(value10, {
        first: items[0]!.color,
        seeThrough: gradientContainsAlpha({
          stops: items,
        }),
      });
    }
    return value10;
  }
  function parseCssShadow(tokens: CssToken[], allowInset?: boolean): ShadowValue | undefined {
    let value = tokens;
    if (value.some((input) => input.t === "comma")) {
      return;
    }
    let flag = false,
      value2: string | undefined,
      items: number[] = [];
    for (let value7 of value) {
      if (value7.t === "ident" && value7.v === "inset") {
        flag = true;
        continue;
      }
      let value8 = cssTokenPixels(value7);
      if (value8 !== undefined) {
        items.push(value8);
        continue;
      }
      let value9 = normalizeCssColorHex(value7.raw);
      if (value9 !== undefined && value2 === undefined) {
        value2 = value9;
        continue;
      }
      return;
    }
    if (items.length < 2 || items.length > (allowInset ? 4 : 3)) {
      return;
    }
    if (value2 === undefined) {
      return;
    }
    if (flag && !allowInset) {
      return;
    }
    let [value3, value4, value5 = 0, value6 = 0]: [number, number, number?, number?] = items as [number, number, number?, number?];
    if (!allowInset) {
      return {
        x: value3,
        y: value4,
        blur: value5,
        color: value2,
      };
    }
    if (flag) {
      return {
        x: value3,
        y: value4,
        blur: value5,
        spread: value6,
        inset: true,
        color: value2,
      };
    } else {
      return {
        x: value3,
        y: value4,
        blur: value5,
        spread: value6,
        color: value2,
      };
    }
  }
  function parseCssBorder(tokens: CssToken[]): CssBorder | undefined {
    let state: CssBorder = {};
    for (let value of tokens) {
      let value2 = cssTokenPixels(value);
      if (value2 !== undefined && state.width === undefined) {
        state.width = value2;
        continue;
      }
      if (
        value.t === "ident" &&
        Object.hasOwn(borderWidthKeywords, value.v) &&
        state.width === undefined
      ) {
        state.width = borderWidthKeywords[value.v];
        continue;
      }
      if (
        value.t === "ident" &&
        Object.hasOwn(cssBorderStyleAliases, value.v) &&
        state.style === undefined
      ) {
        state.style = cssBorderStyleAliases[value.v];
        continue;
      }
      let value3 = normalizeCssColorHex(value.raw);
      if (value3 !== undefined && state.color === undefined) {
        state.color = value3;
        continue;
      }
      return;
    }
    return state;
  }
  function normalizeSignedDegrees(angle: number): number {
    let value = ((((angle + 180) % 360) + 360) % 360) - 180;
    if (value === -180) {
      return 180;
    } else {
      return value;
    }
  }
  function parseCssTransform(tokens: CssToken[]): ParsedCssTransform | undefined {
    let state: TransformValue = {},
      flag = false,
      flag2 = false;
    if (
      tokens.length === 1 &&
      tokens[0]!.t === "ident" &&
      tokens[0]!.v === "none"
    ) {
      return {
        centerX: flag,
        centerY: flag2,
        value: {},
      };
    }
    let flag3 = false,
      index = 0,
      callback = (input: keyof TransformValue, options: number): void => {
        if (Object.hasOwn(state, input)) {
          flag3 = true;
        }
        state[input] = options;
      };
    for (let value of tokens) {
      if (value.t !== "fn") {
        return;
      }
      let value2 = value.name.startsWith("translate")
        ? 0
        : value.name === "rotate"
          ? 1
          : value.name === "scale"
            ? 2
            : 3;
      if (value2 < index) {
        flag3 = true;
      }
      index = value2;
      let value3 = tokenizeCssValue(value.args).filter(
          (input) => input.t !== "comma",
        ),
        callback2 = (input: CssToken | undefined, options: "x" | "y"): number | undefined => {
          if (input === undefined) {
            return;
          }
          if (input.t === "num" && input.unit === "%") {
            if (input.n !== -50) {
              return;
            }
            if (options === "x") {
              flag = true;
            } else {
              flag2 = true;
            }
            return 0;
          }
          return cssTokenPixels(input);
        };
      switch (value.name) {
        case "translate": {
          let value4 = callback2(value3[0], "x"),
            value5 = value3.length > 1 ? callback2(value3[1], "y") : 0;
          if (value4 === undefined || value5 === undefined) {
            return;
          }
          if (value4 !== 0) {
            callback("translateX", value4);
          }
          if (value5 !== 0) {
            callback("translateY", value5);
          }
          break;
        }
        case "translatex": {
          let value4 = callback2(value3[0], "x");
          if (value4 === undefined || value3.length !== 1) {
            return;
          }
          if (value4 !== 0) {
            callback("translateX", value4);
          }
          break;
        }
        case "translatey": {
          let value4 = callback2(value3[0], "y");
          if (value4 === undefined || value3.length !== 1) {
            return;
          }
          if (value4 !== 0) {
            callback("translateY", value4);
          }
          break;
        }
        case "rotate": {
          let value4 = cssTokenDegrees(value3[0]);
          if (value4 === undefined || value3.length !== 1) {
            return;
          }
          callback("rotate", normalizeSignedDegrees(value4));
          break;
        }
        case "scale": {
          let value4 = cssTokenRatio(value3[0]);
          if (value4 === undefined || value3.length > 2) {
            return;
          }
          if (value3.length === 2 && cssTokenRatio(value3[1]) !== value4) {
            return;
          }
          callback("scale", value4);
          break;
        }
        case "skew": {
          let value4 = cssTokenDegrees(value3[0]);
          if (value4 === undefined || value3.length > 2) {
            return;
          }
          callback("skewX", value4);
          if (value3.length === 2) {
            let value5 = cssTokenDegrees(value3[1]);
            if (value5 === undefined) {
              return;
            }
            callback("skewY", value5);
          }
          break;
        }
        case "skewx":
        case "skewy": {
          let value4 = cssTokenDegrees(value3[0]);
          if (value4 === undefined || value3.length !== 1) {
            return;
          }
          callback(value.name === "skewx" ? "skewX" : "skewY", value4);
          break;
        }
        default:
          return;
      }
    }
    if (flag3) {
      return undefined;
    } else {
      return {
        centerX: flag,
        centerY: flag2,
        value: state,
      };
    }
  }
  function parseCssFilter(tokens: CssToken[]): FilterValue | undefined {
    let state: FilterValue = {};
    if (
      tokens.length === 1 &&
      tokens[0]!.t === "ident" &&
      tokens[0]!.v === "none"
    ) {
      return {};
    }
    for (let value of tokens) {
      if (value.t !== "fn") {
        return;
      }
      let value2 = cssFilterFunctionSpecs[value.name];
      if (value2 === undefined || Object.hasOwn(state, value2.field)) {
        return;
      }
      let value3 = tokenizeCssValue(value.args);
      if (value3.length !== 1) {
        return;
      }
      let value4 =
        value2.kind === "px"
          ? cssTokenPixels(value3[0])
          : value2.kind === "deg"
            ? cssTokenDegrees(value3[0])
            : cssTokenRatio(value3[0]);
      if (value4 === undefined) {
        return;
      }
      state[value2.field] =
        value2.kind === "deg" ? ((value4 % 360) + 360) % 360 : value4;
    }
    return state;
  }
  function expandCssBoxValues<T>(tokens: CssToken[], parse: (token: CssToken) => T | undefined): [T, T, T, T] | undefined {
    let value: Array<T | undefined> = tokens.map(parse);
    if (
      value.length < 1 ||
      value.length > 4 ||
      value.some((input) => input === undefined)
    ) {
      return;
    }
    let [value2, value3 = value2, value4 = value2, value5 = value3]: [T, T?, T?, T?] =
      value as [T, T?, T?, T?];
    return [value2, value3, value4, value5];
  }
  function parseCssFlex(tokens: CssToken[]): CssFlex | undefined {
    if (tokens.length === 1 && tokens[0]!.t === "ident") {
      if (tokens[0]!.v === "none") {
        return {
          grow: 0,
          shrink: 0,
          basis: "auto",
        };
      }
      if (tokens[0]!.v === "auto") {
        return {
          grow: 1,
          shrink: 1,
          basis: "auto",
        };
      }
      if (tokens[0]!.v === "initial") {
        return {
          grow: 0,
          shrink: 1,
          basis: "auto",
        };
      }
      return;
    }
    let callback = (input: CssToken): input is CssNumberToken =>
        input.t === "num" && input.unit === "",
      value = tokens[2],
      value2: CssToken[] =
        tokens.length === 3 &&
        tokens.every(callback) &&
        value?.t === "num" &&
        value.n === 0
          ? tokens.slice(0, 2)
          : tokens,
      value3 = value2.filter(callback),
      value4: CssToken[] = value2.filter(
        (input) => !callback(input),
      );
    if (value3.length < 1 || value3.length > 2 || value4.length > 1) {
      return;
    }
    let state: CssFlex = {
        grow: value3[0]!.n,
        shrink: value3.length === 2 ? value3[1]!.n : 1,
        basis: 0,
      },
      value5 = value4[0];
    if (value5 !== undefined) {
      if (value5.t === "ident" && value5.v === "auto") {
        state.basis = "auto";
      } else if (value5.t === "num" && value5.unit === "%" && value5.n === 0) {
        state.basis = 0;
      } else {
        let value6 = cssTokenPixels(value5);
        if (value6 === undefined) {
          return;
        }
        state.basis = value6;
      }
    }
    return state;
  }
  function parseCssGridTracks(tokens: CssToken[]): GridTrack[] | undefined {
    let items: GridTrack[] = [],
      callback = (input: CssToken): GridTrack | undefined => {
        if (input.t === "ident" && input.v === "auto") {
          return "auto";
        }
        if (input.t === "num" && input.unit === "fr") {
          return {
            fr: input.n,
          };
        }
        let value = cssTokenPixels(input);
        if (value !== undefined) {
          return {
            px: value,
          };
        }
        return;
      };
    for (let value of tokens) {
      if (value.t === "fn" && value.name === "repeat") {
        let value3 = splitCssTokenGroups(tokenizeCssValue(value.args)),
          value4 = value3[0]?.[0];
        if (
          value3.length !== 2 ||
          value3[0]!.length !== 1 ||
          value4 === undefined ||
          value4.t !== "num" ||
          value4.unit !== "" ||
          !Number.isInteger(value4.n) ||
          value4.n < 1 ||
          value4.n > 24
        ) {
          return;
        }
        let value5 = value3[1]!.map(callback);
        if (
          value5.some((input) => input === undefined) ||
          items.length + value4.n * value5.length > 24
        ) {
          return;
        }
        for (let index = 0; index < value4.n; index++)
          items.push(...(value5 as GridTrack[]));
        continue;
      }
      let value2 = callback(value);
      if (value2 === undefined || items.length >= 24) {
        return;
      }
      items.push(value2);
    }
    if (items.length === 0) {
      return undefined;
    } else {
      return items;
    }
  }
  function parseCssFontFamilies(tokens: CssToken[]): string[] | undefined {
    let items: string[] = [];
    for (let value of splitCssTokenGroups(tokens)) {
      if (value.length === 0) {
        return;
      }
      if (value.length === 1 && value[0]!.t === "str") {
        items.push(value[0]!.v.trim());
        continue;
      }
      if (
        value.every(
          (input) =>
            input.t === "ident" ||
            (input.t === "num" &&
              input.unit === "" &&
              Number.isInteger(input.n)),
        )
      ) {
        items.push(
          value.map((input) => input.raw).join(" "),
        );
        continue;
      }
      return;
    }
    if (items.length > 0) {
      return items;
    } else {
      return undefined;
    }
  }
  function parseCssFontShorthand(tokens: CssToken[]): CssFontShorthand | undefined {
    let index = 0,
      state: Partial<CssFontShorthand> = {};
    for (; index < tokens.length; index++) {
      let value3: CssToken = tokens[index]!;
      if (
        value3.t === "ident" &&
        (value3.v === "italic" || value3.v === "oblique")
      ) {
        state.style = "italic";
      } else if (value3.t === "ident" && value3.v === "normal") {
        continue;
      } else if (value3.t === "ident" && value3.v === "bold") {
        state.weight = 700;
      } else if (
        value3.t === "num" &&
        value3.unit === "" &&
        value3.n >= 100 &&
        value3.n <= 900 &&
        tokens[index + 1]?.t === "num"
      ) {
        state.weight = value3.n;
      } else {
        break;
      }
    }
    let value = cssTokenPixels(tokens[index]);
    if (value === undefined) {
      return;
    }
    index++;
    if (tokens[index]?.t === "slash") {
      let value3 = tokens[index + 1];
      if (value3 === undefined || value3.t !== "num" || value3.unit !== "") {
        return;
      }
      state.lineHeight = value3.n;
      index += 2;
    }
    let value2 = parseCssFontFamilies(tokens.slice(index));
    if (value2 === undefined) {
      return;
    }
    return {
      ...state,
      size: value,
      family: value2,
    };
  }
  function parseCssFontWeight(tokens: CssToken[]): number | undefined {
    let value = tokens[0];
    if (tokens.length !== 1 || value === undefined) {
      return;
    }
    if (
      value.t === "num" &&
      value.unit === "" &&
      value.n >= 100 &&
      value.n <= 900 &&
      value.n % 100 === 0
    ) {
      return value.n;
    }
    if (value.t === "ident" && value.v === "bold") {
      return 700;
    }
    if (value.t === "ident" && value.v === "normal") {
      return 400;
    }
    return;
  }
  function canonicalCssPropertyName(property: string): string | undefined {
    if (cssCanonicalPropertyNames === undefined) {
      cssCanonicalPropertyNames = new Map();
      for (let [value, value2] of Object.entries<SupportedCssProperty>(
        supportedHtmlCssProperties,
      )) {
        if (!value.includes(" ")) {
          cssCanonicalPropertyNames.set(value, value);
        }
        for (let value3 of (value2.alias ?? []))
          cssCanonicalPropertyNames.set(value3, value);
      }
    }
    return cssCanonicalPropertyNames.get(property);
  }
  function cssPropertyValueHint(property: string): string {
    let value = canonicalCssPropertyName(property);
    if (value === undefined) {
      return "";
    } else {
      return " — " + property + " is " + supportedHtmlCssProperties[value]!.v;
    }
  }
  function formatCssNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return "0";
    }
    let value2 = Math.round(value * 100) / 100;
    if (value2 === 0) {
      return "0";
    } else {
      return String(value2);
    }
  }
  function formatCssPixels(value: number): string {
    let value2 = formatCssNumber(value);
    if (value2 === "0") {
      return "0";
    } else {
      return value2 + "px";
    }
  }
  function serializeCssGradient(gradient: GradientValue): string {
    let value = gradient.radial !== true ? gradient.repeat : undefined,
      value2 = gradient.stops
        .map(
          (input) =>
            (normalizeCssColorHex(input.color) ?? input.color) +
            " " +
            (value !== undefined
              ? formatCssPixels((input.pos / 100) * value)
              : formatCssNumber(input.pos) + "%"),
        )
        .join(", ");
    if (value !== undefined) {
      return (
        "repeating-linear-gradient(" +
        formatCssNumber(gradient.angle) +
        "deg, " +
        value2 +
        ")"
      );
    }
    if (gradient.radial === true) {
      return (0, runtime.radialGradientPrefix)(gradient) + value2 + ")";
    } else {
      return (
        "linear-gradient(" +
        formatCssNumber(gradient.angle) +
        "deg, " +
        value2 +
        ")"
      );
    }
  }
  function serializeCssShadow(shadow: ShadowValue): string {
    let items: string[] = [
      formatCssPixels(shadow.x),
      formatCssPixels(shadow.y),
      formatCssPixels(shadow.blur),
    ];
    if (shadow.spread !== undefined && shadow.spread !== 0) {
      items.push(formatCssPixels(shadow.spread));
    }
    return (
      (shadow.inset === true ? "inset " : "") +
      items.join(" ") +
      " " +
      (normalizeCssColorHex(shadow.color) ?? shadow.color)
    );
  }
  function serializeCssTransform(transform: TransformValue): string {
    let items: string[] = [];
    if (
      transform.translateX !== undefined ||
      transform.translateY !== undefined
    ) {
      items.push(
        "translate(" +
          formatCssPixels(transform.translateX ?? 0) +
          ", " +
          formatCssPixels(transform.translateY ?? 0) +
          ")",
      );
    }
    if (transform.rotate !== undefined) {
      items.push("rotate(" + formatCssNumber(transform.rotate) + "deg)");
    }
    if (transform.scale !== undefined) {
      items.push("scale(" + formatCssNumber(transform.scale) + ")");
    }
    if (transform.skewX !== undefined || transform.skewY !== undefined) {
      items.push(
        "skew(" +
          formatCssNumber(transform.skewX ?? 0) +
          "deg, " +
          formatCssNumber(transform.skewY ?? 0) +
          "deg)",
      );
    }
    return items.join(" ");
  }
  function serializeCssFilter(filter: FilterValue): string {
    let items: string[] = [];
    if (filter.blur !== undefined) {
      items.push("blur(" + formatCssPixels(filter.blur) + ")");
    }
    if (filter.brightness !== undefined) {
      items.push("brightness(" + formatCssNumber(filter.brightness) + ")");
    }
    if (filter.contrast !== undefined) {
      items.push("contrast(" + formatCssNumber(filter.contrast) + ")");
    }
    if (filter.saturate !== undefined) {
      items.push("saturate(" + formatCssNumber(filter.saturate) + ")");
    }
    if (filter.grayscale !== undefined) {
      items.push("grayscale(" + formatCssNumber(filter.grayscale) + ")");
    }
    if (filter.sepia !== undefined) {
      items.push("sepia(" + formatCssNumber(filter.sepia) + ")");
    }
    if (filter.invert !== undefined) {
      items.push("invert(" + formatCssNumber(filter.invert) + ")");
    }
    if (filter.hueRotate !== undefined) {
      items.push("hue-rotate(" + formatCssNumber(filter.hueRotate) + "deg)");
    }
    return items.join(" ");
  }
  bindRuntimeValue(runtime, "parseSingleCssName", () => parseSingleCssName);
  bindRuntimeValue(runtime, "parseCssDeclarations", () => parseCssDeclarations);
  bindRuntimeValue(
    runtime,
    "compactDiagnosticValue",
    () => compactDiagnosticValue,
  );
  bindRuntimeValue(runtime, "tokenizeCssValue", () => tokenizeCssValue);
  bindRuntimeValue(runtime, "splitCssTokenGroups", () => splitCssTokenGroups);
  bindRuntimeValue(runtime, "cssTokenPixels", () => cssTokenPixels);
  bindRuntimeValue(runtime, "cssTokenSize", () => cssTokenSize);
  bindRuntimeValue(runtime, "cssTokenRatio", () => cssTokenRatio);
  bindRuntimeValue(runtime, "cssTokenDegrees", () => cssTokenDegrees);
  bindRuntimeValue(runtime, "clampColorByte", () => clampColorByte);
  bindRuntimeValue(runtime, "colorByteHex", () => colorByteHex);
  bindRuntimeValue(runtime, "hslToHex", () => hslToHex);
  bindRuntimeValue(runtime, "normalizeCssColorHex", () => normalizeCssColorHex);
  bindRuntimeValue(runtime, "parseCssColorTokens", () => parseCssColorTokens);
  bindRuntimeValue(
    runtime,
    "parseCssPositionTokens",
    () => parseCssPositionTokens,
  );
  bindRuntimeValue(runtime, "gradientLineLength", () => gradientLineLength);
  bindRuntimeValue(
    runtime,
    "radialGradientDimensions",
    () => radialGradientDimensions,
  );
  bindRuntimeValue(
    runtime,
    "resolveCssGradientStopPositions",
    () => resolveCssGradientStopPositions,
  );
  bindRuntimeValue(
    runtime,
    "interpolateGradientColors",
    () => interpolateGradientColors,
  );
  bindRuntimeValue(
    runtime,
    "clipGradientStopsToRange",
    () => clipGradientStopsToRange,
  );
  bindRuntimeValue(
    runtime,
    "diagonalGradientAngle",
    () => diagonalGradientAngle,
  );
  bindRuntimeValue(runtime, "parseCssGradient", () => parseCssGradient);
  bindRuntimeValue(runtime, "parseCssShadow", () => parseCssShadow);
  bindRuntimeValue(runtime, "parseCssBorder", () => parseCssBorder);
  bindRuntimeValue(
    runtime,
    "normalizeSignedDegrees",
    () => normalizeSignedDegrees,
  );
  bindRuntimeValue(runtime, "parseCssTransform", () => parseCssTransform);
  bindRuntimeValue(runtime, "parseCssFilter", () => parseCssFilter);
  bindRuntimeValue(runtime, "expandCssBoxValues", () => expandCssBoxValues);
  bindRuntimeValue(runtime, "parseCssFlex", () => parseCssFlex);
  bindRuntimeValue(runtime, "parseCssGridTracks", () => parseCssGridTracks);
  bindRuntimeValue(runtime, "parseCssFontFamilies", () => parseCssFontFamilies);
  bindRuntimeValue(
    runtime,
    "parseCssFontShorthand",
    () => parseCssFontShorthand,
  );
  bindRuntimeValue(runtime, "parseCssFontWeight", () => parseCssFontWeight);
  bindRuntimeValue(
    runtime,
    "canonicalCssPropertyName",
    () => canonicalCssPropertyName,
  );
  bindRuntimeValue(runtime, "cssPropertyValueHint", () => cssPropertyValueHint);
  bindRuntimeValue(runtime, "formatCssNumber", () => formatCssNumber);
  bindRuntimeValue(runtime, "formatCssPixels", () => formatCssPixels);
  bindRuntimeValue(runtime, "serializeCssGradient", () => serializeCssGradient);
  bindRuntimeValue(runtime, "serializeCssShadow", () => serializeCssShadow);
  bindRuntimeValue(
    runtime,
    "serializeCssTransform",
    () => serializeCssTransform,
  );
  bindRuntimeValue(runtime, "serializeCssFilter", () => serializeCssFilter);
  bindRuntimeValue(
    runtime,
    "forbiddenCssTokenPattern",
    () => forbiddenCssTokenPattern,
    (value) => {
      forbiddenCssTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssPropertyNamePattern",
    () => cssPropertyNamePattern,
    (value) => {
      cssPropertyNamePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssUrlTokenPattern",
    () => cssUrlTokenPattern,
    (value) => {
      cssUrlTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssNumberTokenPattern",
    () => cssNumberTokenPattern,
    (value) => {
      cssNumberTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssIdentifierTokenPattern",
    () => cssIdentifierTokenPattern,
    (value) => {
      cssIdentifierTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "namedCssColorHex",
    () => namedCssColorHex,
    (value) => {
      namedCssColorHex = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssColorHexPattern",
    () => cssColorHexPattern,
    (value) => {
      cssColorHexPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parsedGradientMetadata",
    () => parsedGradientMetadata,
    (value) => {
      parsedGradientMetadata = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientSourceMetadata",
    () => gradientSourceMetadata,
    (value) => {
      gradientSourceMetadata = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "horizontalPositionKeywords",
    () => horizontalPositionKeywords,
    (value) => {
      horizontalPositionKeywords = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "verticalPositionKeywords",
    () => verticalPositionKeywords,
    (value) => {
      verticalPositionKeywords = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssBorderStyleAliases",
    () => cssBorderStyleAliases,
    (value) => {
      cssBorderStyleAliases = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "borderWidthKeywords",
    () => borderWidthKeywords,
    (value) => {
      borderWidthKeywords = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssFilterFunctionSpecs",
    () => cssFilterFunctionSpecs,
    (value) => {
      cssFilterFunctionSpecs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportedHtmlCssProperties",
    () => supportedHtmlCssProperties,
    (value) => {
      supportedHtmlCssProperties = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "acceptedNoOpCssPropertyPatterns",
    () => acceptedNoOpCssPropertyPatterns,
    (value) => {
      acceptedNoOpCssPropertyPatterns = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsupportedCssPropertyHints",
    () => unsupportedCssPropertyHints,
    (value) => {
      unsupportedCssPropertyHints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssCanonicalPropertyNames",
    () => cssCanonicalPropertyNames,
    (value) => {
      cssCanonicalPropertyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientContainsAlpha",
    () => gradientContainsAlpha,
    (value) => {
      gradientContainsAlpha = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "gradientHasCustomRadialGeometry",
    () => gradientHasCustomRadialGeometry,
    (value) => {
      gradientHasCustomRadialGeometry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCssValueParser",
    () => initializeCssValueParser,
    (value) => {
      initializeCssValueParser = value;
    },
  );
  return () => {
    gradientSourceMetadata = (input) =>
      parsedGradientMetadata.get(input);
    gradientContainsAlpha = (input) =>
      input.stops.some((input2) => {
        let value = normalizeCssColorHex(input2.color);
        return (
          value === undefined || (value.length === 9 && !/ff$/i.test(value))
        );
      });
    gradientHasCustomRadialGeometry = (input) =>
      input.radial === true &&
      (input.shape !== undefined ||
        input.extent !== undefined ||
        input.at !== undefined);
    initializeCssValueParser = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeStyleSchema)();
      forbiddenCssTokenPattern =
        /[<>@{}\\\0]|\/\*|(?:url|var|attr|env|expression|image-set|image|element|src|counters?|cross-fade|paint|format|local)\s*\(/i;
      cssPropertyNamePattern = /^-?[a-z][a-z0-9-]*$/;
      cssUrlTokenPattern = /^url\(\s*(?:"[^"()]*"|'[^'()]*'|[^'"()\s]+)\s*\)/i;
      cssNumberTokenPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
      cssIdentifierTokenPattern = /^-?[a-zA-Z_][\w-]*/;
      namedCssColorHex = {
        aliceblue: "#f0f8ff",
        antiquewhite: "#faebd7",
        aqua: "#00ffff",
        aquamarine: "#7fffd4",
        azure: "#f0ffff",
        beige: "#f5f5dc",
        bisque: "#ffe4c4",
        black: "#000000",
        blanchedalmond: "#ffebcd",
        blue: "#0000ff",
        blueviolet: "#8a2be2",
        brown: "#a52a2a",
        burlywood: "#deb887",
        cadetblue: "#5f9ea0",
        chartreuse: "#7fff00",
        chocolate: "#d2691e",
        coral: "#ff7f50",
        cornflowerblue: "#6495ed",
        cornsilk: "#fff8dc",
        crimson: "#dc143c",
        cyan: "#00ffff",
        darkblue: "#00008b",
        darkcyan: "#008b8b",
        darkgoldenrod: "#b8860b",
        darkgray: "#a9a9a9",
        darkgreen: "#006400",
        darkgrey: "#a9a9a9",
        darkkhaki: "#bdb76b",
        darkmagenta: "#8b008b",
        darkolivegreen: "#556b2f",
        darkorange: "#ff8c00",
        darkorchid: "#9932cc",
        darkred: "#8b0000",
        darksalmon: "#e9967a",
        darkseagreen: "#8fbc8f",
        darkslateblue: "#483d8b",
        darkslategray: "#2f4f4f",
        darkslategrey: "#2f4f4f",
        darkturquoise: "#00ced1",
        darkviolet: "#9400d3",
        deeppink: "#ff1493",
        deepskyblue: "#00bfff",
        dimgray: "#696969",
        dimgrey: "#696969",
        dodgerblue: "#1e90ff",
        firebrick: "#b22222",
        floralwhite: "#fffaf0",
        forestgreen: "#228b22",
        fuchsia: "#ff00ff",
        gainsboro: "#dcdcdc",
        ghostwhite: "#f8f8ff",
        gold: "#ffd700",
        goldenrod: "#daa520",
        gray: "#808080",
        green: "#008000",
        greenyellow: "#adff2f",
        grey: "#808080",
        honeydew: "#f0fff0",
        hotpink: "#ff69b4",
        indianred: "#cd5c5c",
        indigo: "#4b0082",
        ivory: "#fffff0",
        khaki: "#f0e68c",
        lavender: "#e6e6fa",
        lavenderblush: "#fff0f5",
        lawngreen: "#7cfc00",
        lemonchiffon: "#fffacd",
        lightblue: "#add8e6",
        lightcoral: "#f08080",
        lightcyan: "#e0ffff",
        lightgoldenrodyellow: "#fafad2",
        lightgray: "#d3d3d3",
        lightgreen: "#90ee90",
        lightgrey: "#d3d3d3",
        lightpink: "#ffb6c1",
        lightsalmon: "#ffa07a",
        lightseagreen: "#20b2aa",
        lightskyblue: "#87cefa",
        lightslategray: "#778899",
        lightslategrey: "#778899",
        lightsteelblue: "#b0c4de",
        lightyellow: "#ffffe0",
        lime: "#00ff00",
        limegreen: "#32cd32",
        linen: "#faf0e6",
        magenta: "#ff00ff",
        maroon: "#800000",
        mediumaquamarine: "#66cdaa",
        mediumblue: "#0000cd",
        mediumorchid: "#ba55d3",
        mediumpurple: "#9370db",
        mediumseagreen: "#3cb371",
        mediumslateblue: "#7b68ee",
        mediumspringgreen: "#00fa9a",
        mediumturquoise: "#48d1cc",
        mediumvioletred: "#c71585",
        midnightblue: "#191970",
        mintcream: "#f5fffa",
        mistyrose: "#ffe4e1",
        moccasin: "#ffe4b5",
        navajowhite: "#ffdead",
        navy: "#000080",
        oldlace: "#fdf5e6",
        olive: "#808000",
        olivedrab: "#6b8e23",
        orange: "#ffa500",
        orangered: "#ff4500",
        orchid: "#da70d6",
        palegoldenrod: "#eee8aa",
        palegreen: "#98fb98",
        paleturquoise: "#afeeee",
        palevioletred: "#db7093",
        papayawhip: "#ffefd5",
        peachpuff: "#ffdab9",
        peru: "#cd853f",
        pink: "#ffc0cb",
        plum: "#dda0dd",
        powderblue: "#b0e0e6",
        purple: "#800080",
        rebeccapurple: "#663399",
        red: "#ff0000",
        rosybrown: "#bc8f8f",
        royalblue: "#4169e1",
        saddlebrown: "#8b4513",
        salmon: "#fa8072",
        sandybrown: "#f4a460",
        seagreen: "#2e8b57",
        seashell: "#fff5ee",
        sienna: "#a0522d",
        silver: "#c0c0c0",
        skyblue: "#87ceeb",
        slateblue: "#6a5acd",
        slategray: "#708090",
        slategrey: "#708090",
        snow: "#fffafa",
        springgreen: "#00ff7f",
        steelblue: "#4682b4",
        tan: "#d2b48c",
        teal: "#008080",
        thistle: "#d8bfd8",
        tomato: "#ff6347",
        transparent: "#00000000",
        turquoise: "#40e0d0",
        violet: "#ee82ee",
        wheat: "#f5deb3",
        white: "#ffffff",
        whitesmoke: "#f5f5f5",
        yellow: "#ffff00",
        yellowgreen: "#9acd32",
      };
      cssColorHexPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
      parsedGradientMetadata = new WeakMap();
      horizontalPositionKeywords = {
        left: 0,
        center: 50,
        right: 100,
      };
      verticalPositionKeywords = {
        top: 0,
        center: 50,
        bottom: 100,
      };
      cssBorderStyleAliases = {
        none: "none",
        hidden: "none",
        solid: "solid",
        dashed: "dashed",
        dotted: "dotted",
        double: "double",
      };
      borderWidthKeywords = {
        thin: 1,
        medium: 3,
        thick: 5,
      };
      cssFilterFunctionSpecs = {
        blur: {
          field: "blur",
          kind: "px",
        },
        brightness: {
          field: "brightness",
          kind: "frac",
        },
        contrast: {
          field: "contrast",
          kind: "frac",
        },
        saturate: {
          field: "saturate",
          kind: "frac",
        },
        grayscale: {
          field: "grayscale",
          kind: "frac",
        },
        sepia: {
          field: "sepia",
          kind: "frac",
        },
        invert: {
          field: "invert",
          kind: "frac",
        },
        "hue-rotate": {
          field: "hueRotate",
          kind: "deg",
        },
      };
      supportedHtmlCssProperties = {
        position: {
          v: "absolute | relative",
          on: "any; absolute pins to the slide or a position:relative div",
        },
        "left top right bottom": {
          v: "LEN | PCT | auto; left/top also calc(PCT ± LEN)",
          on: "pinned only (relative does not offset)",
          alias: ["left", "top", "right", "bottom", "inset"],
        },
        "width height": {
          v: "LEN | auto | PCT (pinned, td/th, or along a flex row/column = that share)",
          on: "any",
          alias: ["width", "height"],
        },
        "min-width": {
          v: "LEN | min-content | max-content",
          on: "div child",
        },
        "min-height max-width max-height": {
          v: "LEN",
          on: "div child",
          alias: ["min-height", "max-width", "max-height"],
        },
        display: {
          v: "flex | grid | none (no display = column)",
          on: "section div",
        },
        "flex-direction": {
          v: "row | column [-reverse]",
          on: "flex box",
          alias: ["flex-flow"],
        },
        "flex-wrap": {
          v: "wrap | nowrap",
          on: "row div",
        },
        gap: {
          v: "LEN 0–512, one value",
          on: "section div",
          alias: [
            "row-gap",
            "column-gap",
            "grid-gap",
            "grid-row-gap",
            "grid-column-gap",
          ],
        },
        "align-items": {
          v: "ALIGN",
          on: "section div",
          alias: ["place-items"],
        },
        "justify-content": {
          v: "start | center | end | space-between | space-around | space-evenly",
          on: "flex box, not grid",
        },
        "justify-items": {
          v: "ALIGN, no baseline",
          on: "grid box",
        },
        "align-self": {
          v: "ALIGN | auto",
          on: "div child",
          alias: ["place-self"],
        },
        "justify-self": {
          v: "ALIGN | auto, no baseline",
          on: "grid child",
        },
        flex: {
          v: "none | auto | N [N] [LEN | 0% | auto] (flex:1 = equal share; empty div + flex:1 = spacer)",
          on: "div child",
        },
        "flex-grow flex-shrink": {
          v: "N",
          on: "div child",
          alias: ["flex-grow", "flex-shrink"],
        },
        "flex-basis": {
          v: "LEN | auto",
          on: "div child",
        },
        "grid-template-columns grid-template-rows": {
          v: "(LEN | Nfr | auto | repeat(INT, …))+ ≤24 tracks — no minmax, auto-fill, names, areas",
          on: "grid box",
          alias: ["grid-template-columns", "grid-template-rows"],
        },
        "grid-column grid-row": {
          v: "span INT only (cells fill in source order)",
          on: "grid child",
          alias: ["grid-column", "grid-row", "grid-column-end", "grid-row-end"],
        },
        "aspect-ratio": {
          v: "N | N / N",
          on: "div child",
        },
        padding: {
          v: "LEN 0–256 ×1–4",
          on: "section div text table; td/th: one per table, ≤64",
          alias: [
            "padding-top",
            "padding-right",
            "padding-bottom",
            "padding-left",
            "padding-inline",
            "padding-block",
          ],
        },
        overflow: {
          v: "hidden | visible",
          on: "div",
          alias: ["overflow-x", "overflow-y"],
        },
        "font-family": {
          v: "FAMILY",
          on: "text table; on body/section/div it inherits",
        },
        "font-size": {
          v: "LEN 8–400 (Npt converts)",
          on: "text table; inherits into p/li, not h1–h3",
        },
        "font-weight": {
          v: "100–900 (whole hundreds) | normal | bold",
          on: "text th; span (≥600 = bold)",
        },
        "font-style": {
          v: "normal | italic",
          on: "text span",
        },
        font: {
          v: "[italic] [weight] LEN[/N] FAMILY",
          on: "text",
        },
        "line-height": {
          v: "N | PCT | LEN (0.5–4× the font-size)",
          on: "text",
        },
        "letter-spacing": {
          v: "LEN | Nem (−24–32px) | normal",
          on: "text",
        },
        "text-align": {
          v: "left | center | right | justify (not td)",
          on: "text td/th",
        },
        "text-transform": {
          v: "none | uppercase | lowercase | capitalize",
          on: "text",
        },
        "white-space": {
          v: "normal | nowrap",
          on: "text",
        },
        "text-decoration": {
          v: "none | underline | line-through [solid | double | dotted | dashed | wavy] [COLOR]",
          on: "text; span: underline only",
          alias: [
            "text-decoration-line",
            "text-decoration-style",
            "text-decoration-color",
          ],
        },
        "font-variant-numeric": {
          v: "normal | tabular-nums",
          on: "text",
        },
        "-webkit-text-stroke": {
          v: "LEN 0–8 COLOR",
          on: "text",
          alias: ["-webkit-text-stroke-width", "-webkit-text-stroke-color"],
        },
        color: {
          v: "COLOR",
          on: "text span td/th x-icon x-connector hr",
        },
        background: {
          v: "COLOR | [repeating-]linear-gradient(ANGLE | to SIDE, COLOR [PCT [PCT]], … 2–8 stops; repeating: px stops) | radial-gradient([circle|ellipse] [at X% Y%], …); one gradient[, COLOR under it]",
          on: "section div text img table x-icon; tr: COLOR; x-shape/hr = flat fill",
          alias: ["background-color", "background-image"],
        },
        "background-clip": {
          v: "text (+ -webkit-text-fill-color: transparent): glyphs take the gradient | url(IMG) [center / cover|contain]; color = fallback; span: -webkit-text-fill-color: currentcolor",
          on: "text",
          alias: [
            "-webkit-background-clip",
            "-webkit-text-fill-color",
            "background-size",
            "background-position",
            "background-repeat",
          ],
        },
        border: {
          v: "[LEN 0–16, else 1] solid | dashed | dotted | double | none [COLOR, else black] — one stroke; the style word is required",
          on: "div text img table x-icon; = the stroke on x-shape hr x-connector (≤32)",
          alias: ["border-width", "border-style", "border-color"],
        },
        "border-top -right -bottom -left": {
          v: "as border | none; one style+color, any widths",
          on: "div text img table x-icon",
          alias: ["border-top", "border-right", "border-bottom", "border-left"],
        },
        "border-radius": {
          v: "LEN | PCT ×1–4 (TL TR BR BL); 50%=pill",
          on: "div text img table; rect x-shape",
        },
        "box-shadow": {
          v: "[inset] LEN LEN [LEN [LEN]] COLOR, … ≤8 (x y ±64, blur ≤160, spread ±32)",
          on: "div text img table x-icon x-shape",
        },
        "text-shadow": {
          v: "LEN LEN [LEN] COLOR, … ≤8 (blur ≤64)",
          on: "text table",
        },
        opacity: {
          v: "N 0–1",
          on: "any",
        },
        transform: {
          v: "translate(LEN[, LEN]) | translateX|Y(LEN | -50%), rotate(ANGLE), scale(N 0.5–2), skew[X|Y](ANGLE ±60) — any subset in that order, each once",
          on: "any but x-connector; x-shape: rotate only",
          alias: ["rotate"],
        },
        "filter backdrop-filter": {
          v: "blur(LEN ≤20) brightness|contrast(N 0–2) saturate(N 0–3) grayscale|sepia|invert(N 0–1) hue-rotate(ANGLE) — any subset",
          on: "div text img x-shape",
          alias: ["filter", "backdrop-filter", "-webkit-backdrop-filter"],
        },
        "mix-blend-mode": {
          v: "normal | multiply | screen | overlay | darken | lighten",
          on: "div text img x-shape",
        },
        "object-fit": {
          v: "cover | contain",
          on: "img",
        },
      };
      acceptedNoOpCssPropertyPatterns = {
        margin: /^0(px)?(\s+0(px)?){0,3}$/i,
        "margin-top": /^0(px)?$/i,
        "margin-right": /^0(px)?$/i,
        "margin-bottom": /^0(px)?$/i,
        "margin-left": /^0(px)?$/i,
        "box-sizing": /^border-box$/i,
        "grid-template": /^none$/i,
      };
      unsupportedCssPropertyHints = {
        margin:
          "use the parent's gap or padding; margin auto = justify-content / align-self or a flex:1 spacer (margin:0 is accepted)",
        "z-index": "later children paint on top (source order)",
        float: "use display:flex on the parent",
        "align-content": "use align-items / justify-content",
        "place-content": "use align-items / justify-content",
        order: "reorder the children",
        "grid-area": "use grid-column: span N (cells place in source order)",
        "grid-template-areas":
          "use grid-template-columns and grid-column: span N",
        "grid-auto-flow": "row auto-flow only — reorder the children",
        "grid-auto-rows": "use grid-template-rows",
        "grid-auto-columns": "use grid-template-columns",
        "grid-column-start": "use grid-column: span N",
        "grid-row-start": "use grid-row: span N",
        "word-break": "size the box to its longest word",
        "overflow-wrap": "size the box to its longest word",
        hyphens: "size the box to its longest word",
        "text-overflow": "nothing clips — budget the height",
        "line-clamp": "nothing clips — shorten the text",
        "text-indent": "use padding-left",
        "text-wrap": "size the box (white-space:nowrap for one line)",
        "vertical-align": "use align-items on the parent",
        transition: "motion is data-build-in / data-build-out",
        animation: "motion is data-build-in / data-build-out",
        visibility: "remove the element, or hidden on the section",
        cursor: "nothing is interactive here",
        "pointer-events": "nothing is interactive here",
        "list-style": "ul = bullets, ol = numbers",
        "list-style-type": "ul = bullets, ol = numbers",
        outline: "use border",
        "outline-offset": "use border",
        "font-variant": "font-variant-numeric: tabular-nums only",
        "font-feature-settings": "font-variant-numeric: tabular-nums only",
        "font-variation-settings": "use font-weight",
        "font-stretch": "not available",
        "text-decoration-thickness": "not available",
        "text-underline-offset": "not available",
        "writing-mode": "rotate a pinned <p> with transform: rotate(-90deg)",
        direction: "not available",
        columns: "use display:flex",
        "column-count": "use display:flex",
        clip: "use overflow:hidden on a div",
        "clip-path": "use border-radius / overflow:hidden",
        mask: "not available",
        "object-position": "object-fit centers",
        "image-rendering": "not available",
        "table-layout": "column widths are width:N% on the first row's cells",
        "border-collapse": "tables draw hairlines",
        "border-spacing": "tables draw hairlines",
        content: "write the text",
        "border-top-width": "use border-top: LEN style COLOR",
        "border-right-width": "use border-right: …",
        "border-bottom-width": "use border-bottom: …",
        "border-left-width": "use border-left: …",
        "border-top-color": "use border-top: …",
        "border-top-style": "use border-top: …",
        "border-top-left-radius": "one border-radius for all corners",
        "border-top-right-radius": "one border-radius for all corners",
        "border-bottom-left-radius": "one border-radius for all corners",
        "border-bottom-right-radius": "one border-radius for all corners",
        "border-image": "not available",
        "box-decoration-break": "not available",
        "scroll-behavior": "nothing scrolls",
        "user-select": "not available",
        "will-change": "not needed",
        "backface-visibility": "not available",
        perspective: "2-D transforms only",
        "transform-origin": "transforms are about the centre",
        "accent-color": "no forms here",
        appearance: "no forms here",
        "inset-inline": "use left/right",
        "inset-block": "use top/bottom",
      };
    });
  };
}

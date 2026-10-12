/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  FontFaceDeclaration,
  FontUnicodeRange,
  FontWeightRange,
} from "./face-parser";
import type { GoogleFontImports } from "./fetch";

/** A font face the document reports, reduced to what packing compares. */
export interface DocumentFontFaceInfo {
  family: string;
  style: string;
  weight: string;
  unicodeRange: string;
}

/** What the document's faces of one family and style cover. */
export interface FontFaceCoverage {
  weight: FontWeightRange;
  ranges: FontUnicodeRange[];
}

/** Which document faces count as already provided: loaded ones, loaded or loading ones, all, or a given list. */
export type LoadedFontFaces =
  | "document"
  | "settled"
  | "all"
  | DocumentFontFaceInfo[];

/** Options of `inlineGoogleFontFaces`. */
export interface GoogleFontInliningOptions {
  /** Text the slides show; fonts are packed in the order of how much of it they cover. */
  text: string;
  /** Size limit of the packed CSS in characters. */
  budget?: number | undefined;
  /** Timestamp after which packing stops. */
  deadline?: number | undefined;
  loadedFaces?: LoadedFontFaces | undefined;
  /** Whether the slides use the (lower-cased) family. */
  familyNamed?: ((family: string) => boolean) | undefined;
  /** Concurrent fetch limit. */
  batch?: number | undefined;
  fetchText?: ((href: string) => Promise<string>) | undefined;
  fetchDataUrl?: ((url: string) => Promise<string>) | undefined;
  faceInUse?: ((href: string) => boolean) | undefined;
}

/** Outcome of packing the web fonts the slides use. */
export interface GoogleFontInliningResult {
  /** Stylesheet text with the font files embedded; empty when nothing could be packed. */
  css: string;
  /** Some fonts could not be fetched. */
  unavailable: boolean;
  /** Some fonts were left out to stay within the size budget. */
  overBudget: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** The document's loaded faces, or undefined when the document has no font set. */
    loadedDocumentFontFaces: (
      includeLoading?: boolean,
    ) => DocumentFontFaceInfo[] | undefined;
    fontUnicodeRangesEqual: (
      ranges: readonly FontUnicodeRange[],
      otherRanges: readonly FontUnicodeRange[],
    ) => boolean;
    fontUnicodeRangesOverlap: (
      ranges: readonly FontUnicodeRange[],
      otherRanges: readonly FontUnicodeRange[],
    ) => boolean;
    /** The weight range closest to `weight`, preferring the CSS font matching order. */
    nearestAvailableWeightRange: (
      weight: number,
      ranges: readonly FontWeightRange[],
    ) => FontWeightRange | undefined;
    documentFontCoverage: (
      fontFaces: Iterable<DocumentFontFaceInfo>,
    ) => Map<string, FontFaceCoverage[]>;
    unicodeRangeContainsSpace: (
      ranges: readonly FontUnicodeRange[],
    ) => boolean;
    /** Keeps the faces the document does not already cover. */
    reconcileFontFaceWeights: (
      faces: readonly FontFaceDeclaration[],
      coverage?: Map<string, FontFaceCoverage[]>,
    ) => FontFaceDeclaration[];
    googleFontUrlFamilies: (href: string) => string[];
    googleFontUrlFamiliesLowercase: (href: string) => string[];
    /** Lower-cased text of the theme variables and `extra`, searched for the families in use. */
    fontUsageHints: (css: string, extra: string) => string;
    /** Drops the `@font-face` rules whose family the hints text does not mention. */
    removeUnusedFontFaces: (css: string, usedFamilies: string) => string;
    removeRuntimeFontFaces: (css: string) => string;
    /** Fetches the Google Fonts the slides use and embeds the font files as data URLs. */
    inlineGoogleFontFaces: (
      css: string,
      options: GoogleFontInliningOptions,
    ) => Promise<GoogleFontInliningResult>;
    textCodePointsWithCaseVariants: (text: string) => number[];
    /** Counts the sorted code points within `[minimum, maximum]`. */
    countCodePointsInRange: (
      codePoints: readonly number[],
      minimum: number,
      maximum: number,
    ) => number;
    defaultFontInliningBudget: number;
    maxConcurrentFontFetches: number;
    fontInliningTimeoutMs: number;
    minimumFontInliningBudget: number;
    isFullUnicodeRange: (ranges: readonly FontUnicodeRange[]) => boolean;
    rangesIntersect: (
      range: readonly [number, number],
      otherRange: readonly [number, number],
    ) => boolean;
    unicodeRangesKey: (ranges: readonly FontUnicodeRange[]) => string;
    fontFamilyStyleKey: (family: string, style: string) => string;
    unicodeSpaceCodePoint: number;
    fontInliningFacePattern: RegExp;
    fontInliningFamilyPattern: RegExp;
    embeddedFontFilePattern: RegExp;
    initializeFontInlining: () => void;
  }
}

export function installFontsInlining(runtime: RuntimeBindings): () => void {
  var defaultFontInliningBudget: RuntimeBindings["defaultFontInliningBudget"];
  var maxConcurrentFontFetches: RuntimeBindings["maxConcurrentFontFetches"];
  var fontInliningTimeoutMs: RuntimeBindings["fontInliningTimeoutMs"];
  var minimumFontInliningBudget: RuntimeBindings["minimumFontInliningBudget"];
  var isFullUnicodeRange: RuntimeBindings["isFullUnicodeRange"];
  var rangesIntersect: RuntimeBindings["rangesIntersect"];
  var unicodeRangesKey: RuntimeBindings["unicodeRangesKey"];
  var fontFamilyStyleKey: RuntimeBindings["fontFamilyStyleKey"];
  var unicodeSpaceCodePoint: RuntimeBindings["unicodeSpaceCodePoint"];
  var fontInliningFacePattern: RuntimeBindings["fontInliningFacePattern"];
  var fontInliningFamilyPattern: RuntimeBindings["fontInliningFamilyPattern"];
  var embeddedFontFilePattern: RuntimeBindings["embeddedFontFilePattern"];
  var initializeFontInlining: RuntimeBindings["initializeFontInlining"];
  function loadedDocumentFontFaces(
    includeLoading: boolean = false,
  ): DocumentFontFaceInfo[] | undefined {
    if (typeof document === "undefined" || !("fonts" in document)) {
      return;
    }
    let items: DocumentFontFaceInfo[] = [];
    for (let value of (0, runtime.documentFontSet)()) {
      if (
        value.status !== "loaded" &&
        (includeLoading || value.status !== "loading")
      ) {
        continue;
      }
      items.push({
        family: value.family,
        style: value.style,
        weight: value.weight,
        unicodeRange: value.unicodeRange,
      });
    }
    return items;
  }
  function fontUnicodeRangesEqual(
    ranges: readonly FontUnicodeRange[],
    otherRanges: readonly FontUnicodeRange[],
  ): boolean {
    if (isFullUnicodeRange(ranges)) {
      return true;
    }
    return (
      ranges.length === otherRanges.length &&
      ranges.every(
        (input: FontUnicodeRange, options: number): boolean =>
          input[0] === otherRanges[options]![0] &&
          input[1] === otherRanges[options]![1],
      )
    );
  }
  function fontUnicodeRangesOverlap(
    ranges: readonly FontUnicodeRange[],
    otherRanges: readonly FontUnicodeRange[],
  ): boolean {
    let index: number = 0,
      index2: number = 0;
    while (index < ranges.length && index2 < otherRanges.length) {
      if (
        ranges[index]![0] <= otherRanges[index2]![1] &&
        otherRanges[index2]![0] <= ranges[index]![1]
      ) {
        return true;
      }
      if (ranges[index]![1] < otherRanges[index2]![1]) {
        index++;
      } else {
        index2++;
      }
    }
    return false;
  }
  function nearestAvailableWeightRange(
    weight: number,
    ranges: readonly FontWeightRange[],
  ): FontWeightRange | undefined {
    let value: FontWeightRange[] = ranges
        .filter((input: FontWeightRange): boolean => input[1] < weight)
        .sort(
          (input: FontWeightRange, options: FontWeightRange): number =>
            options[1] - input[1],
        ),
      value2: FontWeightRange[] = ranges
        .filter((input: FontWeightRange): boolean => input[0] > weight)
        .sort(
          (input: FontWeightRange, options: FontWeightRange): number =>
            input[0] - options[0],
        );
    if (weight > 500) {
      return value2[0] ?? value[0];
    }
    if (weight < 400) {
      return value[0] ?? value2[0];
    }
    return (
      value2.find((input: FontWeightRange): boolean => input[0] <= 500) ??
      value[0] ??
      value2[0]
    );
  }
  function documentFontCoverage(
    fontFaces: Iterable<DocumentFontFaceInfo>,
  ): Map<string, FontFaceCoverage[]> {
    let entries: Map<string, FontFaceCoverage[]> = new Map();
    for (let value of fontFaces) {
      let value2: string = fontFamilyStyleKey(value.family, value.style),
        value3: FontFaceCoverage[] = entries.get(value2) ?? [];
      value3.push({
        weight: (0, runtime.parseFontWeightRange)(value.weight),
        ranges: (0, runtime.parseFontUnicodeRanges)(value.unicodeRange),
      });
      entries.set(value2, value3);
    }
    return entries;
  }
  function unicodeRangeContainsSpace(
    ranges: readonly FontUnicodeRange[],
  ): boolean {
    return ranges.some(
      ([input, input2]: FontUnicodeRange): boolean =>
        input <= unicodeSpaceCodePoint && unicodeSpaceCodePoint <= input2,
    );
  }
  function reconcileFontFaceWeights(
    faces: readonly FontFaceDeclaration[],
    coverage?: Map<string, FontFaceCoverage[]>,
  ): FontFaceDeclaration[] {
    if (coverage === undefined) {
      return [...faces];
    }
    let entries: Map<string, FontWeightRange[]> = new Map();
    for (let value3 of faces) {
      let value4: string =
        fontFamilyStyleKey(value3.family, value3.style) +
        `
` +
        unicodeRangesKey(value3.ranges);
      entries.set(value4, [...(entries.get(value4) ?? []), value3.weight]);
    }
    let value: ("same" | "near" | "none")[] = faces.map(
        (input: FontFaceDeclaration): "same" | "near" | "none" => {
          let value3: FontFaceCoverage[] =
              coverage.get(fontFamilyStyleKey(input.family, input.style)) ?? [],
            value4: FontFaceCoverage[] = value3.filter(
              (input2: FontFaceCoverage): boolean =>
                fontUnicodeRangesEqual(input2.ranges, input.ranges),
            );
          if (
            value4.some(
              (input2: FontFaceCoverage): boolean =>
                rangesIntersect(input2.weight, input.weight),
            )
          ) {
            return "same";
          }
          let entry: FontWeightRange[] = entries.get(
              fontFamilyStyleKey(input.family, input.style) +
                `
` +
                unicodeRangesKey(input.ranges),
            )!,
            callback2 = (input2: FontFaceCoverage): boolean => {
              let value5: FontWeightRange | undefined =
                nearestAvailableWeightRange(input2.weight[0], entry);
              return (
                value5 !== undefined &&
                value5[0] === input.weight[0] &&
                value5[1] === input.weight[1]
              );
            };
          if (
            value4.some(
              (input2: FontFaceCoverage): boolean =>
                !entry.some(
                  (input3: FontWeightRange): boolean =>
                    rangesIntersect(input2.weight, input3),
                ) && callback2(input2),
            )
          ) {
            return "same";
          }
          if (
            value3.some(
              (input2: FontFaceCoverage): boolean =>
                rangesIntersect(input2.weight, input.weight) &&
                fontUnicodeRangesOverlap(input2.ranges, input.ranges),
            )
          ) {
            return "near";
          } else {
            return "none";
          }
        },
      ),
      values: Set<string> = new Set(
        faces
          .filter(
            (input: FontFaceDeclaration, options: number): boolean =>
              value[options] === "same",
          )
          .map((input: FontFaceDeclaration): string => input.family),
      ),
      value2: boolean[] = faces.map(
        (input: FontFaceDeclaration, options: number): boolean =>
          value[options] === "same" ||
          (value[options] === "near" && !values.has(input.family)),
      ),
      callback = (input: FontFaceDeclaration): string =>
        fontFamilyStyleKey(input.family, input.style) +
        `
` +
        String(input.weight[0]) +
        " " +
        String(input.weight[1]),
      values2: Set<string> = new Set(
        faces
          .filter(
            (input: FontFaceDeclaration, options: number): boolean =>
              value2[options]!,
          )
          .map(callback),
      );
    return faces.filter(
      (input: FontFaceDeclaration, options: number): boolean =>
        value2[options]! ||
        (values2.has(callback(input)) &&
          unicodeRangeContainsSpace(input.ranges)),
    );
  }
  function googleFontUrlFamilies(href: string): string[] {
    return [...href.matchAll(/[?&]family=([^:&]+)/g)].map(
      (input: RegExpMatchArray): string =>
        input[1]!.replace(/\+|%20/g, " "),
    );
  }
  function googleFontUrlFamiliesLowercase(href: string): string[] {
    return googleFontUrlFamilies(href).map(
      (input: string): string => input.toLowerCase(),
    );
  }
  function fontUsageHints(css: string, extra: string): string {
    return (
      extra + (css.match(/--deck-[\w-]+:[^;}]*/g) ?? []).join(" ")
    ).toLowerCase();
  }
  function removeUnusedFontFaces(css: string, usedFamilies: string): string {
    return css.replace(fontInliningFacePattern, (input: string): string => {
      let value: string | undefined = fontInliningFamilyPattern
        .exec(input)?.[2]
        ?.trim()
        .toLowerCase();
      if (value === undefined || usedFamilies.includes(value)) {
        return input;
      } else {
        return "";
      }
    });
  }
  function removeRuntimeFontFaces(css: string): string {
    return css.replace(
      fontInliningFacePattern,
      (input: string): string =>
        /url\(["']?[^"')]*\/_runtime\//.test(input) ? "" : input,
    );
  }
  async function inlineGoogleFontFaces(
    css: string,
    options: GoogleFontInliningOptions,
  ): Promise<GoogleFontInliningResult> {
    let { hrefs: hrefs, optional: optional }: GoogleFontImports = (0,
    runtime.googleFontImports)(css);
    if (hrefs.length === 0) {
      return {
        css: "",
        unavailable: false,
        overBudget: false,
      };
    }
    let budget: number = options.budget ?? defaultFontInliningBudget;
    if (budget < minimumFontInliningBudget) {
      return {
        css: "",
        unavailable: false,
        overBudget: true,
      };
    }
    let value: number = Math.min(
      Date.now() + fontInliningTimeoutMs,
      options.deadline ?? 1 / 0,
    );
    if (Date.now() >= value) {
      return {
        css: "",
        unavailable: true,
        overBudget: false,
      };
    }
    let value2: LoadedFontFaces = options.loadedFaces ?? "document",
      value3: DocumentFontFaceInfo[] | undefined =
        value2 === "document" || value2 === "settled"
          ? loadedDocumentFontFaces(value2 === "settled")
          : value2 === "all"
            ? undefined
            : value2,
      value4: (href: string) => Promise<string> =
        options.fetchText ?? runtime.fetchFontStylesheet,
      value5: (url: string) => Promise<string> =
        options.fetchDataUrl ?? runtime.fetchFontDataUrl,
      value6: (href: string) => boolean =
        options.faceInUse ??
        (value2 === "settled"
          ? (input: string): boolean =>
              (0, runtime.googleFontVariantAvailable)(input, true)
          : runtime.googleFontVariantAvailable),
      value7: (family: string) => boolean =
        options.familyNamed ?? ((): boolean => true),
      value8: Map<string, FontFaceCoverage[]> | undefined =
        value3 === undefined ? undefined : documentFontCoverage(value3),
      value9: Set<string> | undefined =
        value3 === undefined
          ? undefined
          : new Set(
              value3.map(
                (input: DocumentFontFaceInfo): string =>
                  (0, runtime.normalizeFontFaceFamily)(input.family),
              ),
            ),
      entries: Map<string, boolean> = new Map(),
      callback = (input: string): boolean => {
        let entry: boolean | undefined = entries.get(input);
        if (entry === undefined) {
          entries.set(
            input,
            (entry =
              (value9 === undefined || value9.has(input)) && value7(input)),
          );
        }
        return entry;
      },
      flag: boolean = false,
      value10: FontFaceDeclaration[][] = await Promise.all(
        hrefs.map(async (input: string): Promise<FontFaceDeclaration[]> => {
          if (
            (optional.has(input) && !value6(input)) ||
            !googleFontUrlFamiliesLowercase(input).some(callback)
          ) {
            return [];
          }
          try {
            return reconcileFontFaceWeights(
              (0, runtime.parseFontFaceDeclarations)(
                await value4(input),
              ).filter(
                (input2: FontFaceDeclaration): boolean =>
                  input2.files.length > 0 && callback(input2.family),
              ),
              value8,
            );
          } catch {
            flag = true;
            return [];
          }
        }),
      ),
      values: Set<string> = new Set(),
      value11: FontFaceDeclaration[] = value10
        .flat()
        .filter((input: FontFaceDeclaration): boolean =>
          values.has(input.text) ? false : (values.add(input.text), true),
        ),
      value12: number[] = textCodePointsWithCaseVariants(options.text),
      entries2: Map<FontFaceDeclaration, number> = new Map(
        value11.map((input: FontFaceDeclaration): [FontFaceDeclaration, number] => [
          input,
          input.ranges.reduce(
            (input2: number, [options2, options3]: FontUnicodeRange): number =>
              input2 + countCodePointsInRange(value12, options2, options3),
            0,
          ),
        ]),
      ),
      value13: FontFaceDeclaration[] = [...value11].sort(
        (input: FontFaceDeclaration, options2: FontFaceDeclaration): number =>
          Number(unicodeRangeContainsSpace(options2.ranges)) -
            Number(unicodeRangeContainsSpace(input.ranges)) ||
          entries2.get(options2)! - entries2.get(input)!,
      ),
      entries3: Map<string, string | null> = new Map(),
      entries4: Map<FontFaceDeclaration, string> = new Map(),
      index: number = 0,
      flag2: boolean = false,
      flag3: boolean = false,
      flag4: boolean = false,
      flag5: boolean = false,
      flag6: boolean = false,
      flag7: boolean = false,
      index2: number = 0,
      value14: number = Math.max(
        1,
        Math.floor(options.batch ?? maxConcurrentFontFetches),
      ),
      callback2 = (input: FontFaceDeclaration): boolean => {
        let value15: string =
          input.text.replace(
            runtime.googleFontFileUrlRegex,
            (input2: string, options2: string, context: string): string =>
              'url("' + entries3.get(context) + '")',
          ) +
          `
`;
        if (index + value15.length > budget) {
          flag2 = true;
          return false;
        }
        entries4.set(input, value15);
        index += value15.length;
        return true;
      };
    for (
      let index3: number = 0;
      index3 < value13.length && !flag4 && !flag6 && index < budget;
      index3 += value14
    ) {
      flag7 = Date.now() >= value;
      if (flag7) {
        break;
      }
      let value15: FontFaceDeclaration[] = value13.slice(
        index3,
        index3 + value14,
      );
      index2 = index3 + value15.length;
      let value16: string[] = [
        ...new Set(
          value15.flatMap((input: FontFaceDeclaration): string[] => input.files),
        ),
      ].filter((input: string): boolean => !entries3.has(input));
      await Promise.all(
        value16.map(async (input: string): Promise<void> => {
          try {
            let value18: string = await value5(input);
            entries3.set(
              input,
              embeddedFontFilePattern.test(value18) ? value18 : null,
            );
          } catch {
            entries3.set(input, null);
          }
        }),
      );
      let value17: boolean =
        value16.length > 0 &&
        value16.every(
          (input: string): boolean => entries3.get(input) === null,
        );
      flag4 = value17 && (value16.length > 1 || flag5);
      if (value16.length > 0) {
        flag5 = value17;
      }
      let index4: number = 0,
        index5: number = 0;
      for (let value18 of value15) {
        if (
          value18.files.some(
            (input: string): boolean => entries3.get(input) == null,
          )
        ) {
          flag3 = true;
          continue;
        }
        index5 += 1;
        if (callback2(value18)) {
          index4 += 1;
        }
      }
      flag6 = index5 > 0 && index4 === 0;
    }
    let flag8: boolean = false;
    for (let value15 of value13.slice(index2))
      if (
        value15.files.every(
          (input: string): boolean => entries3.get(input) != null,
        )
      ) {
        callback2(value15);
      } else if (
        value15.files.some((input: string): boolean => !entries3.has(input))
      ) {
        flag8 = true;
      }
    return {
      css: value11
        .flatMap(
          (input: FontFaceDeclaration): string | string[] =>
            entries4.get(input) ?? [],
        )
        .join(""),
      unavailable: flag || flag3 || (flag7 && flag8),
      overBudget: flag2 || (flag8 && !flag4 && !flag7),
    };
  }
  function textCodePointsWithCaseVariants(text: string): number[] {
    let codes: Set<number> = new Set();
    for (let value of [text, text.toUpperCase(), text.toLowerCase()])
      for (let value2 of value) codes.add(value2.codePointAt(0)!);
    return [...codes].sort((input: number, options: number): number => input - options);
  }
  function countCodePointsInRange(
    codePoints: readonly number[],
    minimum: number,
    maximum: number,
  ): number {
    let lowerBound = (input: number): number => {
      let index: number = 0,
        length: number = codePoints.length;
      while (index < length) {
        let value: number = (index + length) >> 1;
        if (codePoints[value]! < input) {
          index = value + 1;
        } else {
          length = value;
        }
      }
      return index;
    };
    return lowerBound(maximum + 1) - lowerBound(minimum);
  }
  bindRuntimeValue(
    runtime,
    "loadedDocumentFontFaces",
    () => loadedDocumentFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "fontUnicodeRangesEqual",
    () => fontUnicodeRangesEqual,
  );
  bindRuntimeValue(
    runtime,
    "fontUnicodeRangesOverlap",
    () => fontUnicodeRangesOverlap,
  );
  bindRuntimeValue(
    runtime,
    "nearestAvailableWeightRange",
    () => nearestAvailableWeightRange,
  );
  bindRuntimeValue(runtime, "documentFontCoverage", () => documentFontCoverage);
  bindRuntimeValue(
    runtime,
    "unicodeRangeContainsSpace",
    () => unicodeRangeContainsSpace,
  );
  bindRuntimeValue(
    runtime,
    "reconcileFontFaceWeights",
    () => reconcileFontFaceWeights,
  );
  bindRuntimeValue(
    runtime,
    "googleFontUrlFamilies",
    () => googleFontUrlFamilies,
  );
  bindRuntimeValue(
    runtime,
    "googleFontUrlFamiliesLowercase",
    () => googleFontUrlFamiliesLowercase,
  );
  bindRuntimeValue(runtime, "fontUsageHints", () => fontUsageHints);
  bindRuntimeValue(
    runtime,
    "removeUnusedFontFaces",
    () => removeUnusedFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "removeRuntimeFontFaces",
    () => removeRuntimeFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "inlineGoogleFontFaces",
    () => inlineGoogleFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "textCodePointsWithCaseVariants",
    () => textCodePointsWithCaseVariants,
  );
  bindRuntimeValue(
    runtime,
    "countCodePointsInRange",
    () => countCodePointsInRange,
  );
  bindRuntimeValue(
    runtime,
    "defaultFontInliningBudget",
    () => defaultFontInliningBudget,
    (value) => {
      defaultFontInliningBudget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxConcurrentFontFetches",
    () => maxConcurrentFontFetches,
    (value) => {
      maxConcurrentFontFetches = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontInliningTimeoutMs",
    () => fontInliningTimeoutMs,
    (value) => {
      fontInliningTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "minimumFontInliningBudget",
    () => minimumFontInliningBudget,
    (value) => {
      minimumFontInliningBudget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFullUnicodeRange",
    () => isFullUnicodeRange,
    (value) => {
      isFullUnicodeRange = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rangesIntersect",
    () => rangesIntersect,
    (value) => {
      rangesIntersect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeRangesKey",
    () => unicodeRangesKey,
    (value) => {
      unicodeRangesKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyStyleKey",
    () => fontFamilyStyleKey,
    (value) => {
      fontFamilyStyleKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeSpaceCodePoint",
    () => unicodeSpaceCodePoint,
    (value) => {
      unicodeSpaceCodePoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontInliningFacePattern",
    () => fontInliningFacePattern,
    (value) => {
      fontInliningFacePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontInliningFamilyPattern",
    () => fontInliningFamilyPattern,
    (value) => {
      fontInliningFamilyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "embeddedFontFilePattern",
    () => embeddedFontFilePattern,
    (value) => {
      embeddedFontFilePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFontInlining",
    () => initializeFontInlining,
    (value) => {
      initializeFontInlining = value;
    },
  );
  return () => {
    defaultFontInliningBudget = 4194304;
    maxConcurrentFontFetches = 8;
    fontInliningTimeoutMs = 20000;
    minimumFontInliningBudget = 16384;
    isFullUnicodeRange = (items: readonly FontUnicodeRange[]): boolean =>
      items.length === 1 && items[0]![0] <= 0 && items[0]![1] >= 1114111;
    rangesIntersect = (
      input: readonly [number, number],
      options: readonly [number, number],
    ): boolean => input[0] <= options[1] && options[0] <= input[1];
    unicodeRangesKey = (input: readonly FontUnicodeRange[]): string =>
      input
        .map(
          (input2: FontUnicodeRange): string =>
            String(input2[0]) + "-" + String(input2[1]),
        )
        .join(",");
    fontFamilyStyleKey = (input: string, options: string): string =>
      (0, runtime.normalizeFontFaceFamily)(input) +
      `
` +
      options.trim().toLowerCase();
    unicodeSpaceCodePoint = 32;
    initializeFontInlining = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeFontFetching)();
      (0, runtime.initializeFontFaceParser)();
      fontInliningFacePattern = /@font-face\s*\{[^}]*\}/g;
      fontInliningFamilyPattern = /font-family:\s*(["']?)([^;"'}]+)\1/;
      embeddedFontFilePattern =
        /^data:(?:font|application)\/[\w+.-]+(?:; ?[\w.+-]+=[\w.+-]+)*;base64,[A-Za-z0-9+/=]*$/;
    });
  };
}

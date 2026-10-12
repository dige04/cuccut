/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  GoogleFontEntry,
  GoogleFontWeightSpec,
  WebSafeFontEntry,
} from "./catalog";

/** One weight and slant a family offers. */
export interface FontVariant {
  weight: number;
  italic: boolean;
}

/** An entry of a font variant picker. */
export interface FontVariantChoice {
  /** Key from `fontVariantKey`. */
  value: string;
  label: string;
}

/** The part of a `FontFace` that decides which variants it provides. */
export type FontFaceVariantSource = Pick<
  FontFace,
  "family" | "weight" | "style" | "status"
>;

declare module "../bindings" {
  interface RuntimeBindings {
    /** Extra stylesheet URLs for the italic and bold variants a Google Fonts import leaves out. */
    optionalGoogleFontStylesheetUrls: (
      href: string | undefined,
      weights?: Record<string, GoogleFontWeightSpec>,
    ) => string[];
    normalizeFontWeight: (weight: number) => number;
    fontVariantLabel: (weight: number, italic: boolean) => string;
    fontVariantKey: (weight: number, italic: boolean) => string;
    parseFontVariantKey: (key: string) => FontVariant | undefined;
    firstFontFamily: (fontFamily: string) => string;
    /** The variants the document's faces provide for a family, or undefined when it has none. */
    availableFontVariants: (
      fontFaces: Iterable<FontFaceVariantSource>,
      family: string,
    ) => FontVariant[] | undefined;
    knownFontVariants: (family: string) => FontVariant[] | undefined;
    fontVariantsOrDefault: (
      family: string,
      fallbackVariants?: FontVariant[],
    ) => FontVariant[];
    fontVariantChoices: (
      variants: Iterable<FontVariant>,
      current?: FontVariant,
    ) => FontVariantChoice[];
    weightNames: Record<number, string>;
    fontWeightValues: number[];
    webSafeFontVariants: FontVariant[];
    defaultFontVariants: FontVariant[];
    webSafeFontFamilyNames: Set<string>;
    sortFontVariants: (variants: Iterable<FontVariant>) => FontVariant[];
    initializeFontVariants: () => void;
  }
}

export function installFontsVariants(runtime: RuntimeBindings): () => void {
  var weightNames: RuntimeBindings["weightNames"];
  var fontWeightValues: RuntimeBindings["fontWeightValues"];
  var webSafeFontVariants: RuntimeBindings["webSafeFontVariants"];
  var defaultFontVariants: RuntimeBindings["defaultFontVariants"];
  var webSafeFontFamilyNames: RuntimeBindings["webSafeFontFamilyNames"];
  var sortFontVariants: RuntimeBindings["sortFontVariants"];
  var initializeFontVariants: RuntimeBindings["initializeFontVariants"];
  function optionalGoogleFontStylesheetUrls(
    href: string | undefined,
    weights?: Record<string, GoogleFontWeightSpec>,
  ): string[] {
    if (
      typeof href !== "string" ||
      href.length > 1024 ||
      href.slice(0, 34) !== "https://fonts.googleapis.com/css2?"
    ) {
      return [];
    }
    let value: string[] = href.slice(34).split("&");
    if (value.some((input: string): boolean => input.slice(0, 5) === "text=")) {
      return [];
    }
    let items: string[] = [];
    for (let value2 of value) {
      if (value2.slice(0, 7) !== "family=") {
        continue;
      }
      let value3: number = items.length + 16,
        value4: string = value2.slice(7).replace(/%20| /g, "+"),
        value5: number = value4.indexOf(":"),
        value6: string = value5 < 0 ? value4 : value4.slice(0, value5);
      if (!/^[A-Za-z0-9][A-Za-z0-9+._-]{0,99}$/.test(value6)) {
        continue;
      }
      let items2: [string, string][] = [["0", "400"]];
      if (value5 >= 0) {
        let value10: number = value4.indexOf("@", value5),
          value11: string[] = value4
            .slice(value5 + 1, value10 < 0 ? value5 : value10)
            .split(","),
          value12: number = value11.indexOf("ital"),
          value13: number = value11.indexOf("wght");
        if (
          value10 < 0 ||
          value11.some(
            (input: string): boolean => input !== "ital" && input !== "wght",
          )
        ) {
          continue;
        }
        items2 = [];
        for (let value14 of value4.slice(value10 + 1).split(";")) {
          let value15: string[] = value14.split(","),
            items3: [string, string] = [
              value12 < 0 ? "0" : (value15[value12] ?? ""),
              value13 < 0 ? "400" : (value15[value13] ?? ""),
            ];
          if (
            value15.length !== value11.length ||
            !/^[01]$/.test(items3[0]) ||
            !/^[1-9]\d{0,3}(?:\.\.[1-9]\d{0,3})?$/.test(items3[1])
          ) {
            items2 = [];
            break;
          }
          items2.push(items3);
        }
        if (items2.length === 0) {
          continue;
        }
      }
      let value7: string[] = items2.map(
          (input: [string, string]): string => input[0] + "," + input[1],
        ),
        value8: GoogleFontWeightSpec | undefined =
          weights !== undefined &&
          Object.prototype.hasOwnProperty.call(
            weights,
            value6.replace(/\+/g, " ").toLowerCase(),
          )
            ? weights[value6.replace(/\+/g, " ").toLowerCase()]
            : undefined,
        value9: string[];
      if (value8 !== undefined) {
        let callback = (input: string, options: number): boolean =>
          items2.some(
            (input2: [string, string]): boolean =>
              input2[0] === input &&
              options >= Number(input2[1].split("..")[0]) &&
              options <= Number(input2[1].split("..").pop()),
          );
        value9 = [];
        for (let value10 of value8.italic ? ["0", "1"] : ["0"]) {
          if (value8.wght === undefined) {
            for (let value11 of value8.statics ?? [])
              if (!callback(value10, value11)) {
                value9.push(value10 + "," + String(value11));
              }
            continue;
          }
          let index: number = 0;
          for (
            let value11: number = value8.wght[0];
            value11 <= value8.wght[1] + 100;
            value11 += 100
          ) {
            let value12: boolean =
              value11 <= value8.wght[1] && !callback(value10, value11);
            if (value12 && index === 0) {
              index = value11;
            }
            if (!value12 && index !== 0) {
              value9.push(
                value10 +
                  "," +
                  String(index) +
                  (value11 - 100 > index ? ".." + String(value11 - 100) : ""),
              );
              index = 0;
            }
          }
        }
      } else {
        let callback = (input: [string, string]): boolean =>
            Number(input[1].split("..").pop()) >= 600,
          value10: [string, string][] = items2.filter(
            (input: [string, string]): boolean => input[0] === "0",
          );
        value9 = value10
          .map((input: [string, string]): string => "1," + input[1])
          .concat(
            value10.some(callback) ? [] : ["0,700"],
            items2.some(callback) ? [] : ["1,700"],
          );
      }
      for (let value10 of value9) {
        let value11: string =
          "https://fonts.googleapis.com/css2?family=" +
          value6 +
          ":ital,wght@" +
          value10 +
          "&display=swap";
        if (
          value7.indexOf(value10) < 0 &&
          items.indexOf(value11) < 0 &&
          items.length < value3
        ) {
          items.push(value11);
        }
      }
    }
    return items;
  }
  function normalizeFontWeight(weight: number): number {
    return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  }
  function fontVariantLabel(weight: number, italic: boolean): string {
    let value: string =
      weightNames[normalizeFontWeight(weight)] ?? String(weight);
    if (!italic) {
      return value;
    } else {
      if (normalizeFontWeight(weight) === 400) {
        return "Italic";
      } else {
        return value + " italic";
      }
    }
  }
  function fontVariantKey(weight: number, italic: boolean): string {
    return String(normalizeFontWeight(weight)) + (italic ? "i" : "");
  }
  function parseFontVariantKey(key: string): FontVariant | undefined {
    let value: RegExpExecArray | null = /^([1-9]00)(i?)$/.exec(key);
    if (value) {
      return {
        weight: Number(value[1]),
        italic: value[2] === "i",
      };
    } else {
      return undefined;
    }
  }
  function firstFontFamily(fontFamily: string): string {
    return (fontFamily.split(",")[0] ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
  }
  function availableFontVariants(
    fontFaces: Iterable<FontFaceVariantSource>,
    family: string,
  ): FontVariant[] | undefined {
    let familyName: string = firstFontFamily(family).toLowerCase(),
      variants: Map<string, FontVariant> = new Map();
    for (let value of fontFaces) {
      if (
        typeof value?.family !== "string" ||
        typeof value.weight !== "string" ||
        typeof value.style !== "string"
      ) {
        continue;
      }
      if (
        value.status === "error" ||
        firstFontFamily(value.family).toLowerCase() !== familyName
      ) {
        continue;
      }
      let value2: boolean = /^(?:italic|oblique)/.test(value.style.trim()),
        value3: string = value.weight.trim(),
        value4: RegExpExecArray | null =
          /^(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?$/.exec(value3),
        value5: number =
          value3 === "normal"
            ? 400
            : value3 === "bold"
              ? 700
              : value4
                ? Number(value4[1])
                : NaN;
      if (!Number.isFinite(value5)) {
        continue;
      }
      let value6: number =
          value4?.[2] !== undefined ? Number(value4[2]) : value5,
        value7: number[] = fontWeightValues.filter(
          (input: number): boolean =>
            input >= Math.min(value5, value6) &&
            input <= Math.max(value5, value6),
        );
      for (let value8 of value7.length > 0
        ? value7
        : [normalizeFontWeight(value5)])
        variants.set(fontVariantKey(value8, value2), {
          weight: value8,
          italic: value2,
        });
    }
    if (variants.size === 0) {
      return undefined;
    } else {
      return sortFontVariants(variants.values());
    }
  }
  function knownFontVariants(family: string): FontVariant[] | undefined {
    let value: string = firstFontFamily(family),
      value2: GoogleFontEntry | undefined = (0, runtime.knownFontFamily)(value);
    if (value2 !== undefined) {
      return (
        value2.wght !== undefined
          ? fontWeightValues.filter(
              (input: number): boolean =>
                input >= value2.wght![0] && input <= value2.wght![1],
            )
          : [...(value2.statics ?? [400])]
      ).flatMap(
        (input: number): FontVariant[] =>
          value2.italic
            ? [
                {
                  weight: input,
                  italic: false,
                },
                {
                  weight: input,
                  italic: true,
                },
              ]
            : [
                {
                  weight: input,
                  italic: false,
                },
              ],
      );
    }
    let value3: string = value.toLowerCase();
    if (
      webSafeFontFamilyNames.has(value3) ||
      value3 === "helvetica neue" ||
      runtime.webSafeFontFamilyPattern.test(value3) ||
      /^(?:-apple-system|blinkmacsystemfont)$/.test(value3)
    ) {
      return [...webSafeFontVariants];
    }
    return;
  }
  function fontVariantsOrDefault(
    family: string,
    fallbackVariants?: FontVariant[],
  ): FontVariant[] {
    return (
      knownFontVariants(family) ??
      (fallbackVariants !== undefined && fallbackVariants.length > 0
        ? fallbackVariants
        : defaultFontVariants)
    );
  }
  function fontVariantChoices(
    variants: Iterable<FontVariant>,
    current?: FontVariant,
  ): FontVariantChoice[] {
    let sortedVariants: FontVariant[] = sortFontVariants(variants);
    if (
      current !== undefined &&
      !sortedVariants.some(
        (input: FontVariant): boolean =>
          input.weight === normalizeFontWeight(current.weight) &&
          input.italic === current.italic,
      )
    ) {
      sortedVariants.unshift({
        weight: normalizeFontWeight(current.weight),
        italic: current.italic,
      });
    }
    return sortedVariants.map(
      (input: FontVariant): FontVariantChoice => ({
        value: fontVariantKey(input.weight, input.italic),
        label: fontVariantLabel(input.weight, input.italic),
      }),
    );
  }
  bindRuntimeValue(
    runtime,
    "optionalGoogleFontStylesheetUrls",
    () => optionalGoogleFontStylesheetUrls,
  );
  bindRuntimeValue(runtime, "normalizeFontWeight", () => normalizeFontWeight);
  bindRuntimeValue(runtime, "fontVariantLabel", () => fontVariantLabel);
  bindRuntimeValue(runtime, "fontVariantKey", () => fontVariantKey);
  bindRuntimeValue(runtime, "parseFontVariantKey", () => parseFontVariantKey);
  bindRuntimeValue(runtime, "firstFontFamily", () => firstFontFamily);
  bindRuntimeValue(
    runtime,
    "availableFontVariants",
    () => availableFontVariants,
  );
  bindRuntimeValue(runtime, "knownFontVariants", () => knownFontVariants);
  bindRuntimeValue(
    runtime,
    "fontVariantsOrDefault",
    () => fontVariantsOrDefault,
  );
  bindRuntimeValue(runtime, "fontVariantChoices", () => fontVariantChoices);
  bindRuntimeValue(
    runtime,
    "weightNames",
    () => weightNames,
    (value) => {
      weightNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontWeightValues",
    () => fontWeightValues,
    (value) => {
      fontWeightValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "webSafeFontVariants",
    () => webSafeFontVariants,
    (value) => {
      webSafeFontVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultFontVariants",
    () => defaultFontVariants,
    (value) => {
      defaultFontVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "webSafeFontFamilyNames",
    () => webSafeFontFamilyNames,
    (value) => {
      webSafeFontFamilyNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sortFontVariants",
    () => sortFontVariants,
    (value) => {
      sortFontVariants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFontVariants",
    () => initializeFontVariants,
    (value) => {
      initializeFontVariants = value;
    },
  );
  return () => {
    sortFontVariants = (input: Iterable<FontVariant>): FontVariant[] =>
      [...input].sort(
        (input2: FontVariant, options: FontVariant): number =>
          input2.weight - options.weight ||
          Number(input2.italic) - Number(options.italic),
      );
    initializeFontVariants = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeFontCatalog)();
      weightNames = {
        100: "Thin",
        200: "Extra light",
        300: "Light",
        400: "Regular",
        500: "Medium",
        600: "Semibold",
        700: "Bold",
        800: "Extra bold",
        900: "Black",
      };
      fontWeightValues = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      webSafeFontVariants = [
        {
          weight: 400,
          italic: false,
        },
        {
          weight: 400,
          italic: true,
        },
        {
          weight: 700,
          italic: false,
        },
        {
          weight: 700,
          italic: true,
        },
      ];
      defaultFontVariants = fontWeightValues.flatMap(
        (input: number): FontVariant[] => [
          {
            weight: input,
            italic: false,
          },
          {
            weight: input,
            italic: true,
          },
        ],
      );
      webSafeFontFamilyNames = new Set(
        runtime.webSafeFontCatalog.map(
          (input: WebSafeFontEntry): string => input.family.toLowerCase(),
        ),
      );
    });
  };
}

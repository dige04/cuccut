/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide, SlideNode } from "../deck-contracts";
import type { FontSwapReporter } from "../export/font-substitution";

/** A font the file replaced: the original family and the family written instead. */
export type FontSubstitution = [original: string, replacement: string];

/** Collects the fonts swapped while a file is written. */
export interface FontSubstitutionTracker {
  /** Records one swap; the first spelling of a family wins and repeats are ignored. */
  swapped: FontSwapReporter;
  swaps: () => FontSubstitution[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    isHelveticaFallbackFont: (family: string) => boolean;
    createFontSubstitutionTracker: () => FontSubstitutionTracker;
    /** One note per substitution, worded for the target program (`"google"` or a PowerPoint file). */
    formatFontSubstitutionNotes: (
      substitutions: readonly FontSubstitution[],
      destination: string,
    ) => string[];
    MAX_FORMATTED_FONT_NAMES: number;
    formatFontNameList: (families: readonly string[]) => string;
    collectCustomPresentationFontFamilies: (
      slides: readonly Slide[],
    ) => string[];
    presentationFontPortabilityWarning: (
      slides: readonly Slide[],
    ) => string | undefined;
  }
}

export function installDeliveryFontSubstitution(
  runtime: RuntimeBindings,
): () => void {
  var isHelveticaFallbackFont: RuntimeBindings["isHelveticaFallbackFont"];
  var MAX_FORMATTED_FONT_NAMES: RuntimeBindings["MAX_FORMATTED_FONT_NAMES"];
  var formatFontNameList: RuntimeBindings["formatFontNameList"];
  function createFontSubstitutionTracker(): FontSubstitutionTracker {
    let entries: Map<string, string> = new Map(),
      entries2: Map<string, FontSubstitution> = new Map();
    return {
      swapped: (input: string, options: string): void => {
        let value: string = input.toLowerCase();
        if (!entries.has(value)) {
          entries.set(value, input);
        }
        let value2: string =
          value +
          `
` +
          options;
        if (
          !entries2.has(value2) &&
          !(isHelveticaFallbackFont(input) && options === "Arial")
        ) {
          entries2.set(value2, [entries.get(value)!, options]);
        }
      },
      swaps: (): FontSubstitution[] => [...entries2.values()],
    };
  }
  function formatFontSubstitutionNotes(
    substitutions: readonly FontSubstitution[],
    destination: string,
  ): string[] {
    return substitutions.map(
      ([input, input2]: FontSubstitution): string =>
        destination === "google"
          ? "Google Slides does not have the font " +
            input +
            ", so it shows " +
            input2 +
            " instead"
          : input +
            " is not on every computer, so this file uses " +
            input2 +
            " instead",
    );
  }
  function collectCustomPresentationFontFamilies(
    slides: readonly Slide[],
  ): string[] {
    let families: Map<string, string> = new Map(),
      visit = (source: SlideNode): void => {
        for (let value2 of (0, runtime.nodeChildren)(source) ?? [])
          visit(value2);
        if (source.kind !== "text" && source.kind !== "table") {
          return;
        }
        let value = source.style?.fontFamily;
        if (
          typeof value === "object" &&
          !families.has(value.family.toLowerCase())
        ) {
          families.set(value.family.toLowerCase(), value.family);
        }
      };
    for (let value of slides)
      for (let value2 of value.frames) visit(value2.node);
    return [...families.values()];
  }
  function presentationFontPortabilityWarning(
    slides: readonly Slide[],
  ): string | undefined {
    let families: string[] = collectCustomPresentationFontFamilies(
      slides,
    ).filter(
      (input: string): boolean =>
        (0, runtime.resolveBasicFontFamily)(input) === undefined &&
        !isHelveticaFallbackFont(input),
    );
    if (families.length === 0) {
      return;
    }
    let single: boolean = families.length === 1;
    return (
      "not every computer has the font" +
      (single ? " " : "s ") +
      formatFontNameList(families) +
      ", so this file can look different on a computer without " +
      (single ? "it" : "them") +
      "; the basic-fonts PowerPoint and the PDF look the same everywhere"
    );
  }
  bindRuntimeValue(
    runtime,
    "isHelveticaFallbackFont",
    () => isHelveticaFallbackFont,
    (value) => {
      isHelveticaFallbackFont = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFontSubstitutionTracker",
    () => createFontSubstitutionTracker,
  );
  bindRuntimeValue(
    runtime,
    "formatFontSubstitutionNotes",
    () => formatFontSubstitutionNotes,
  );
  bindRuntimeValue(
    runtime,
    "MAX_FORMATTED_FONT_NAMES",
    () => MAX_FORMATTED_FONT_NAMES,
    (value) => {
      MAX_FORMATTED_FONT_NAMES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "formatFontNameList",
    () => formatFontNameList,
    (value) => {
      formatFontNameList = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectCustomPresentationFontFamilies",
    () => collectCustomPresentationFontFamilies,
  );
  bindRuntimeValue(
    runtime,
    "presentationFontPortabilityWarning",
    () => presentationFontPortabilityWarning,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeHtmlCompiler)();
    isHelveticaFallbackFont = (family: string): boolean =>
      (0, runtime.resolveFontFamilyAlias)(family)?.fallback === "helvetica";
    MAX_FORMATTED_FONT_NAMES = 4;
    formatFontNameList = (families: readonly string[]): string => {
      let listed: readonly string[] =
        families.length > MAX_FORMATTED_FONT_NAMES
          ? [
              ...families.slice(0, MAX_FORMATTED_FONT_NAMES - 1),
              String(families.length - MAX_FORMATTED_FONT_NAMES + 1) +
                " others",
            ]
          : families;
      if (listed.length === 1) {
        return String(listed[0]);
      } else {
        return (
          listed.slice(0, -1).join(", ") +
          " and " +
          String(listed[listed.length - 1])
        );
      }
    };
  };
}

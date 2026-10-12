/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { FontFamilyFallback } from "../deck-contracts";

/** Generic CSS family a catalog font falls back to. */
export type CatalogGenericFamily = Exclude<FontFamilyFallback, "helvetica">;

/** A font that every platform ships, so no stylesheet is needed. */
export interface WebSafeFontEntry {
  family: string;
  generic: CatalogGenericFamily;
}

/** A Google Fonts family; `wght` is a variable axis range, `statics` the static weights. */
export interface GoogleFontEntry extends WebSafeFontEntry {
  weights?: number[];
  wght?: [number, number];
  statics?: number[];
  italic: boolean;
}

/** Weights a Google Fonts family offers, keyed by lowercase family name. */
export interface GoogleFontWeightSpec {
  wght?: [number, number];
  statics?: number[];
  italic: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    webSafeFontCatalog: WebSafeFontEntry[];
    googleFontCatalog: GoogleFontEntry[];
    fontFamilyChoices: string[];
    knownFontFamilyMap: Map<string, GoogleFontEntry>;
    defaultGoogleFontWeights: Record<string, GoogleFontWeightSpec>;
    loadableFontFamilyPattern: RegExp;
    webSafeFontFamilyPattern: RegExp;
    initializeFontCatalog: () => void;
    knownFontFamily: (family: string) => GoogleFontEntry | undefined;
    googleFontStylesheetUrl_MG0: (family: string) => string;
    ensureGoogleFonts: (
      families: readonly string[],
      document2?: Document,
    ) => void;
  }
}

export function installFontsCatalog(runtime: RuntimeBindings): () => void {
  var webSafeFontCatalog: RuntimeBindings["webSafeFontCatalog"];
  var googleFontCatalog: RuntimeBindings["googleFontCatalog"];
  var fontFamilyChoices: RuntimeBindings["fontFamilyChoices"];
  var knownFontFamilyMap: RuntimeBindings["knownFontFamilyMap"];
  var defaultGoogleFontWeights: RuntimeBindings["defaultGoogleFontWeights"];
  var loadableFontFamilyPattern: RuntimeBindings["loadableFontFamilyPattern"];
  var webSafeFontFamilyPattern: RuntimeBindings["webSafeFontFamilyPattern"];
  var initializeFontCatalog: RuntimeBindings["initializeFontCatalog"];
  function knownFontFamily(family: string): GoogleFontEntry | undefined {
    return knownFontFamilyMap.get(family.trim().toLowerCase());
  }
  function googleFontStylesheetUrl_MG0(family: string): string {
    let font = knownFontFamily(family),
      weightQuery = font
        ? ":wght@" + (font.weights ?? [400, 500, 600, 700]).join(";")
        : "";
    return (
      "https://fonts.googleapis.com/css2?family=" +
      (font?.family ?? family.trim()).replace(/ +/g, "+") +
      weightQuery +
      "&display=swap"
    );
  }
  function ensureGoogleFonts(
    families: readonly string[],
    document2: Document = document,
  ): void {
    for (let value of families) {
      if (
        webSafeFontFamilyPattern.test(value) ||
        !loadableFontFamilyPattern.test(value)
      ) {
        continue;
      }
      let value2 = googleFontStylesheetUrl_MG0(value);
      if (document2.head.querySelector('link[href="' + value2 + '"]')) {
        continue;
      }
      let value3 = document2.createElement("link");
      value3.rel = "stylesheet";
      value3.href = value2;
      document2.head.appendChild(value3);
    }
  }
  bindRuntimeValue(runtime, "knownFontFamily", () => knownFontFamily);
  bindRuntimeValue(
    runtime,
    "googleFontStylesheetUrl_MG0",
    () => googleFontStylesheetUrl_MG0,
  );
  bindRuntimeValue(runtime, "ensureGoogleFonts", () => ensureGoogleFonts);
  bindRuntimeValue(
    runtime,
    "webSafeFontCatalog",
    () => webSafeFontCatalog,
    (value) => {
      webSafeFontCatalog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleFontCatalog",
    () => googleFontCatalog,
    (value) => {
      googleFontCatalog = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyChoices",
    () => fontFamilyChoices,
    (value) => {
      fontFamilyChoices = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "knownFontFamilyMap",
    () => knownFontFamilyMap,
    (value) => {
      knownFontFamilyMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultGoogleFontWeights",
    () => defaultGoogleFontWeights,
    (value) => {
      defaultGoogleFontWeights = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "loadableFontFamilyPattern",
    () => loadableFontFamilyPattern,
    (value) => {
      loadableFontFamilyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "webSafeFontFamilyPattern",
    () => webSafeFontFamilyPattern,
    (value) => {
      webSafeFontFamilyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFontCatalog",
    () => initializeFontCatalog,
    (value) => {
      initializeFontCatalog = value;
    },
  );
  return () => {
    initializeFontCatalog = (0, runtime.initializeOnce)((): void => {
      webSafeFontCatalog = [
        {
          family: "Arial",
          generic: "sans",
        },
        {
          family: "Helvetica",
          generic: "sans",
        },
        {
          family: "Georgia",
          generic: "serif",
        },
        {
          family: "Times New Roman",
          generic: "serif",
        },
        {
          family: "Garamond",
          generic: "serif",
        },
        {
          family: "Courier New",
          generic: "mono",
        },
        {
          family: "Verdana",
          generic: "sans",
        },
        {
          family: "Tahoma",
          generic: "sans",
        },
        {
          family: "Trebuchet MS",
          generic: "sans",
        },
      ];
      googleFontCatalog = [
        {
          family: "Inter",
          generic: "sans",
          wght: [100, 900],
          italic: true,
        },
        {
          family: "Roboto",
          generic: "sans",
          weights: [400, 500, 700],
          wght: [100, 900],
          italic: true,
        },
        {
          family: "Open Sans",
          generic: "sans",
          wght: [300, 800],
          italic: true,
        },
        {
          family: "Lato",
          generic: "sans",
          weights: [400, 700],
          statics: [100, 300, 400, 700, 900],
          italic: true,
        },
        {
          family: "Montserrat",
          generic: "sans",
          wght: [100, 900],
          italic: true,
        },
        {
          family: "Poppins",
          generic: "sans",
          statics: [100, 200, 300, 400, 500, 600, 700, 800, 900],
          italic: true,
        },
        {
          family: "Raleway",
          generic: "sans",
          wght: [100, 900],
          italic: true,
        },
        {
          family: "Nunito",
          generic: "sans",
          wght: [200, 1000],
          italic: true,
        },
        {
          family: "Playfair Display",
          generic: "serif",
          wght: [400, 900],
          italic: true,
        },
        {
          family: "Merriweather",
          generic: "serif",
          weights: [400, 700],
          wght: [300, 900],
          italic: true,
        },
        {
          family: "Work Sans",
          generic: "sans",
          wght: [100, 900],
          italic: true,
        },
        {
          family: "DM Sans",
          generic: "sans",
          wght: [100, 1000],
          italic: true,
        },
        {
          family: "Manrope",
          generic: "sans",
          wght: [200, 800],
          italic: false,
        },
        {
          family: "Space Grotesk",
          generic: "sans",
          wght: [300, 700],
          italic: false,
        },
        {
          family: "Lora",
          generic: "serif",
          wght: [400, 700],
          italic: true,
        },
        {
          family: "Bebas Neue",
          generic: "sans",
          weights: [400],
          statics: [400],
          italic: false,
        },
        {
          family: "Caveat",
          generic: "sans",
          wght: [400, 700],
          italic: false,
        },
      ];
      fontFamilyChoices = googleFontCatalog.map(
        (input: GoogleFontEntry): string => input.family,
      );
      knownFontFamilyMap = new Map(
        googleFontCatalog.map(
          (input: GoogleFontEntry): [string, GoogleFontEntry] => [
            input.family.toLowerCase(),
            input,
          ],
        ),
      );
      defaultGoogleFontWeights = Object.fromEntries(
        googleFontCatalog.map(
          (input: GoogleFontEntry): [string, GoogleFontWeightSpec] => [
            input.family.toLowerCase(),
            {
              ...(input.wght !== undefined
                ? {
                    wght: input.wght,
                  }
                : {
                    statics: input.statics ?? [400],
                  }),
              italic: input.italic,
            },
          ],
        ),
      );
      loadableFontFamilyPattern = /^[A-Za-z0-9][A-Za-z0-9 ]*$/;
      webSafeFontFamilyPattern =
        /^(?:ui-)?(?:serif|sans-serif|monospace|rounded|cursive|fantasy|system-ui|math|emoji|fangsong)$/;
    });
  };
}

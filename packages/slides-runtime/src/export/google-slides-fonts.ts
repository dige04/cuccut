/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  CustomFontFamilyValue,
  FontFace as DeckFontFace,
  FontFamilyValue,
  Slide,
  SlideNode,
  StyleBag,
  TableNode,
  TextNode,
  ThemeFonts,
} from "../deck-contracts";
import type { FontSwapReporter } from "./font-substitution";

/** One weight at one slant of a Google font. */
export interface GoogleSlidesFontStyle {
  weight: number;
  italic: boolean;
}
/** An inclusive range of code points, as `[first, last]`. */
export type CodepointRange = readonly [number, number];
/** The parts of a declared `@font-face` block that are read here. */
interface DeclaredFontFace {
  files: readonly (string | undefined)[];
  ranges: readonly CodepointRange[];
}
/** What the slides need from one custom font: its styles and every character set in it. */
export interface GoogleSlidesFontRequest {
  family: string;
  faces: GoogleSlidesFontStyle[];
  text: string;
  codePoints: Set<number>;
}
/** A page that may carry a document font set to add faces to. */
export interface GoogleSlidesFontPage {
  fonts?: FontFaceSet;
}
/** Fonts added to a page for a measurement: wait for `ready`, then call `remove`. */
export interface GoogleSlidesFontLoad {
  ready: Promise<void>;
  remove: () => void;
}
export interface GoogleSlidesMeasureOptions {
  /** Longest wait for the web fonts to arrive. */
  waitMs?: number;
  fontsReadyMs?: number;
  swapped?: FontSwapReporter;
}
/** Measures the slides that have been re-pointed at Google Slides fonts. */
export type GoogleSlidesAssetsMeasure<T> = (
  slides: Slide[],
  options: { fontsReadyMs: number },
) => Promise<T>;
export interface GoogleSlidesFontTestHooks {
  toGoogleSlidesWeights: RuntimeBindings["toGoogleSlidesWeights"];
}
export interface GoogleSlidesFontExports {
  toGoogleSlidesFonts: RuntimeBindings["toGoogleSlidesFonts"];
  measuredAsGoogleSlides: RuntimeBindings["measuredAsGoogleSlides"];
  _test: GoogleSlidesFontTestHooks;
}

declare module "../bindings" {
  interface RuntimeBindings {
    googleSlidesFontExports: GoogleSlidesFontExports;
    /** Lower-cased family name to the Google Slides family, for the fonts that are not carried by the deck. */
    googleSlidesFontFamilyMap: Map<string, string>;
    googleSlidesSystemFontFamilyMap: Map<string, string>;
    /** Google Slides only has regular and bold. */
    googleSlidesFontWeight: (weight: number) => 400 | 700;
    GOOGLE_SLIDES_FONT_STYLES: GoogleSlidesFontStyle[];
    equalFontStyle: (
      left: GoogleSlidesFontStyle,
      right: GoogleSlidesFontStyle,
    ) => boolean;
    googleFontStylesheetUrl: (
      family: string,
      style: GoogleSlidesFontStyle,
    ) => string;
    rangesContainCodepoints: (
      ranges: readonly CodepointRange[],
      codepoints: Iterable<number>,
    ) => boolean;
    unicodeRangeCss: (ranges: readonly CodepointRange[]) => string;
    GOOGLE_SLIDES_FONT_WAIT_MS: number;
    googleSlidesFontTestHooks: GoogleSlidesFontTestHooks;
    initializeGoogleSlidesFonts: () => void;
    /** The Google Slides family for a deck family, or undefined when Google Slides has none. */
    resolveGoogleSlidesFontFamily: (
      family: string,
      carriedFamilies: ReadonlyMap<string, string>,
    ) => string | undefined;
    googleSlidesBasicFont: (fallback: FontFamilyValue) => CustomFontFamilyValue;
    /** Lower-cased family to family for the fonts the deck carries with a web address. */
    carriedFontFamilyMap: (
      faces?: readonly DeckFontFace[],
      fonts?: ThemeFonts,
    ) => Map<string, string>;
    toGoogleSlidesFonts: (
      slides: readonly Slide[],
      faces?: readonly DeckFontFace[],
      fonts?: ThemeFonts,
      swapped?: FontSwapReporter,
    ) => Slide[];
    mapGoogleSlidesFontFaces: (
      slides: readonly Slide[],
      carriedFamilies: ReadonlyMap<string, string>,
      swapped?: FontSwapReporter,
    ) => Slide[];
    normalizeGoogleSlidesNodeTypography: (node: SlideNode) => SlideNode;
    toGoogleSlidesWeights: (slides: readonly Slide[]) => Slide[];
    collectGoogleSlidesFontRequests: (
      slides: readonly Slide[],
      carriedFamilies: ReadonlyMap<string, string>,
    ) => Map<string, GoogleSlidesFontRequest>;
    installGoogleSlidesFonts: (
      page: GoogleSlidesFontPage,
      fontRequests: ReadonlyMap<string, GoogleSlidesFontRequest>,
      timeoutMs: number,
    ) => GoogleSlidesFontLoad;
    measuredAsGoogleSlides: <T>(
      page: GoogleSlidesFontPage,
      slides: readonly Slide[],
      faces: readonly DeckFontFace[] | undefined,
      fonts: ThemeFonts | undefined,
      assets: GoogleSlidesAssetsMeasure<T>,
      options?: GoogleSlidesMeasureOptions,
    ) => Promise<T>;
  }
}

export function installExportGoogleSlidesFonts(
  runtime: RuntimeBindings,
): () => void {
  var googleSlidesFontExports: RuntimeBindings["googleSlidesFontExports"];
  var googleSlidesFontFamilyMap: RuntimeBindings["googleSlidesFontFamilyMap"];
  var googleSlidesSystemFontFamilyMap: RuntimeBindings["googleSlidesSystemFontFamilyMap"];
  var googleSlidesFontWeight: RuntimeBindings["googleSlidesFontWeight"];
  var GOOGLE_SLIDES_FONT_STYLES: RuntimeBindings["GOOGLE_SLIDES_FONT_STYLES"];
  var equalFontStyle: RuntimeBindings["equalFontStyle"];
  var googleFontStylesheetUrl: RuntimeBindings["googleFontStylesheetUrl"];
  var rangesContainCodepoints: RuntimeBindings["rangesContainCodepoints"];
  var unicodeRangeCss: RuntimeBindings["unicodeRangeCss"];
  var GOOGLE_SLIDES_FONT_WAIT_MS: RuntimeBindings["GOOGLE_SLIDES_FONT_WAIT_MS"];
  var googleSlidesFontTestHooks: RuntimeBindings["googleSlidesFontTestHooks"];
  var initializeGoogleSlidesFonts: RuntimeBindings["initializeGoogleSlidesFonts"];
  function resolveGoogleSlidesFontFamily(
    family: string,
    carriedFamilies: ReadonlyMap<string, string>,
  ): string | undefined {
    let value = family.toLowerCase();
    return (
      googleSlidesSystemFontFamilyMap.get(value) ??
      googleSlidesFontFamilyMap.get(value) ??
      carriedFamilies.get(value)
    );
  }
  function googleSlidesBasicFont(
    fallback: FontFamilyValue,
  ): CustomFontFamilyValue {
    let value: CustomFontFamilyValue = (0, runtime.webSafeFontFallback)(
      fallback,
    );
    if (value.family === "Tahoma") {
      return {
        family: "Verdana",
        fallback: value.fallback,
      };
    }
    if (value.family === "Brush Script MT") {
      return (0, runtime.webSafeFontFallback)(value.fallback);
    }
    return value;
  }
  function carriedFontFamilyMap(
    faces?: readonly DeckFontFace[],
    fonts?: ThemeFonts,
  ): Map<string, string> {
    let entries = new Map<string, string>();
    for (let value of [
      ...(faces ?? []),
      ...Object.values((fonts ?? {}) as Record<string, DeckFontFace | undefined>),
    ])
      if (
        value !== undefined &&
        "href" in value &&
        !entries.has(value.family.toLowerCase())
      ) {
        entries.set(value.family.toLowerCase(), value.family);
      }
    return entries;
  }
  function toGoogleSlidesFonts(
    slides: readonly Slide[],
    faces?: readonly DeckFontFace[],
    fonts?: ThemeFonts,
    swapped?: FontSwapReporter,
  ): Slide[] {
    return mapGoogleSlidesFontFaces(
      slides,
      carriedFontFamilyMap(faces, fonts),
      swapped,
    );
  }
  function mapGoogleSlidesFontFaces(
    slides: readonly Slide[],
    carriedFamilies: ReadonlyMap<string, string>,
    swapped?: FontSwapReporter,
  ): Slide[] {
    return (0, runtime.swapFaces)(
      slides,
      (input, options) => {
        if (typeof input === "string") {
          return googleSlidesBasicFont(options);
        }
        let value = resolveGoogleSlidesFontFamily(
          input.family,
          carriedFamilies,
        );
        if (value === undefined) {
          return googleSlidesBasicFont(options);
        }
        if (value === input.family) {
          return input;
        } else {
          return {
            ...input,
            family: value,
          };
        }
      },
      {
        swapped: swapped,
      },
    );
  }
  function normalizeGoogleSlidesNodeTypography(node: SlideNode): SlideNode {
    switch (node.kind) {
      case "text":
      case "table": {
        let { letterSpacing: value, ...value2 }: StyleBag = node.style ?? {},
          value3: number =
            node.kind === "text"
              ? (value2.fontWeight ??
                (0, runtime.renderingTypeScaleForRole)(node.role).fontWeight)
              : (0, runtime.renderingTypeScaleForRole)(node.role ?? "body")
                  .fontWeight,
          state: TextNode | TableNode = {
            ...node,
            style: {
              ...value2,
              fontWeight: googleSlidesFontWeight(value3),
            },
          };
        if (state.kind === "table" && state.header) {
          return {
            ...state,
            headerWeight: googleSlidesFontWeight(state.headerWeight ?? 600),
          };
        } else {
          return state;
        }
      }
      case "stack":
      case "grid":
        return {
          ...node,
          children: node.children.map(normalizeGoogleSlidesNodeTypography),
        };
      case "overlay":
        return {
          ...node,
          base: normalizeGoogleSlidesNodeTypography(node.base),
          layers: node.layers.map((input) => ({
            ...input,
            node: normalizeGoogleSlidesNodeTypography(input.node),
          })),
        };
      default:
        return node;
    }
  }
  function toGoogleSlidesWeights(slides: readonly Slide[]): Slide[] {
    return slides.map((input) => ({
      ...input,
      frames: input.frames.map((input2) => ({
        ...input2,
        node: normalizeGoogleSlidesNodeTypography(input2.node),
      })),
    }));
  }
  function collectGoogleSlidesFontRequests(
    slides: readonly Slide[],
    carriedFamilies: ReadonlyMap<string, string>,
  ): Map<string, GoogleSlidesFontRequest> {
    let entries = new Map<string, GoogleSlidesFontRequest>(),
      callback = (source: SlideNode): void => {
        for (let value5 of ((0, runtime.nodeChildren)(source) ??
          []) as SlideNode[])
          callback(value5);
        if (source.kind !== "text" && source.kind !== "table") {
          return;
        }
        let value = source.style?.fontFamily;
        if (
          typeof value !== "object" ||
          !carriedFamilies.has(value.family.toLowerCase()) ||
          !runtime.customFontFamilyPattern.test(value.family)
        ) {
          return;
        }
        let value2: GoogleSlidesFontRequest = entries.get(
            value.family.toLowerCase(),
          ) ?? {
            family: value.family,
            faces: [],
            text: "",
            codePoints: new Set([32]),
          },
          value3 = source.style?.fontStyle === "italic";
        for (let value5 of [
          source.style?.fontWeight ?? 400,
          ...(source.kind === "table" && source.header
            ? [source.headerWeight ?? 600]
            : []),
        ]) {
          let state: GoogleSlidesFontStyle = {
            weight: googleSlidesFontWeight(value5),
            italic: value3,
          };
          if (!value2.faces.some((input) => equalFontStyle(input, state))) {
            value2.faces.push(state);
          }
        }
        let value4: string =
          source.kind === "text" ? source.text : source.rows.flat().join("");
        value2.text += value4;
        for (let value5 of value4)
          value2.codePoints.add(value5.codePointAt(0)!);
        entries.set(value.family.toLowerCase(), value2);
      };
    for (let value of slides)
      for (let value2 of value.frames) callback(value2.node);
    return entries;
  }
  function installGoogleSlidesFonts(
    page: GoogleSlidesFontPage,
    fontRequests: ReadonlyMap<string, GoogleSlidesFontRequest>,
    timeoutMs: number,
  ): GoogleSlidesFontLoad {
    let value = "fonts" in page ? page.fonts : undefined,
      controller = new AbortController(),
      value2: ReturnType<typeof setTimeout> | undefined,
      items: FontFace[] = [],
      callback = (): void => {
        controller.abort();
        clearTimeout(value2);
        let value3 = items.splice(0);
        for (let value4 of value3) value?.delete(value4);
        if (value3.length > 0) {
          value?.dispatchEvent(new Event("loadingdone"));
        }
      };
    if (
      value === undefined ||
      typeof FontFace !== "function" ||
      typeof fetch !== "function" ||
      fontRequests.size === 0
    ) {
      return {
        ready: Promise.resolve(),
        remove: callback,
      };
    }
    let callback2 = async (input: string): Promise<Response> => {
        let value3 = await fetch(input, {
          signal: controller.signal,
          credentials: "omit",
        });
        if (!value3.ok) {
          throw Error("fetch " + String(value3.status));
        }
        return value3;
      },
      items2: Promise<void>[] = [];
    try {
      for (let value3 of fontRequests.values()) {
        let family = value3.family,
          value4: readonly GoogleSlidesFontStyle[] =
            (0, runtime.availableFontVariants)(value, family) ?? [],
          value5: readonly GoogleSlidesFontStyle[] | undefined = (
            0,
            runtime.knownFontVariants
          )(family);
        for (let value6 of GOOGLE_SLIDES_FONT_STYLES) {
          if (
            value5 !== undefined &&
            !value5.some((input) => equalFontStyle(input, value6))
          ) {
            continue;
          }
          let state = {
            weight: String(value6.weight),
            style: value6.italic ? "italic" : "normal",
          };
          if (value4.some((input) => equalFontStyle(input, value6))) {
            if (value3.faces.some((input) => equalFontStyle(input, value6))) {
              value
                .load(
                  (value6.italic ? "italic " : "") +
                    String(value6.weight) +
                    ' 16px "' +
                    family +
                    '"',
                  value3.text,
                )
                .catch((): FontFace[] => []);
            }
            continue;
          }
          items2.push(
            callback2(googleFontStylesheetUrl(family, value6))
              .then((input) => input.text())
              .then((input) =>
                Promise.all(
                  (0, runtime.parseFontFaceDeclarations)(input)
                    .filter(
                      (input2: DeclaredFontFace) =>
                        input2.files[0] !== undefined &&
                        rangesContainCodepoints(
                          input2.ranges,
                          value3.codePoints,
                        ),
                    )
                    .map(
                      async (input2: DeclaredFontFace): Promise<FontFace> =>
                        new FontFace(
                          family,
                          await (
                            await callback2(input2.files[0]!)
                          ).arrayBuffer(),
                          {
                            ...state,
                            unicodeRange: unicodeRangeCss(input2.ranges),
                          },
                        ).load(),
                    ),
                ),
              )
              .then((input): void => {
                if (controller.signal.aborted) {
                  return;
                }
                for (let value7 of input) value.add(value7);
                items.push(...input);
              })
              .catch((): void => {
                return;
              }),
          );
        }
      }
    } catch (value3: unknown) {
      throw (controller.abort(), value3);
    }
    let promise = new Promise<void>((input) => {
      value2 = setTimeout((): void => {
        controller.abort();
        input();
      }, timeoutMs);
    });
    return {
      ready: Promise.race([
        Promise.all(items2).then((): void => {
          return;
        }),
        promise,
      ]).finally((): void => clearTimeout(value2)),
      remove: callback,
    };
  }
  async function measuredAsGoogleSlides<T>(
    page: GoogleSlidesFontPage,
    slides: readonly Slide[],
    faces: readonly DeckFontFace[] | undefined,
    fonts: ThemeFonts | undefined,
    assets: GoogleSlidesAssetsMeasure<T>,
    {
      waitMs: options = GOOGLE_SLIDES_FONT_WAIT_MS,
      fontsReadyMs = runtime.fontReadyTimeoutMs,
      swapped: swapped,
    }: GoogleSlidesMeasureOptions = {},
  ): Promise<T> {
    let value = carriedFontFamilyMap(faces, fonts),
      value2 = toGoogleSlidesWeights(
        mapGoogleSlidesFontFaces(slides, value, swapped),
      ),
      { ready: ready, remove: remove } = installGoogleSlidesFonts(
        page,
        collectGoogleSlidesFontRequests(value2, value),
        options,
      );
    try {
      await ready;
      return await assets(value2, {
        fontsReadyMs: fontsReadyMs,
      });
    } finally {
      remove();
    }
  }
  bindRuntimeValue(
    runtime,
    "googleSlidesFontExports",
    () => googleSlidesFontExports,
    (value) => {
      googleSlidesFontExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveGoogleSlidesFontFamily",
    () => resolveGoogleSlidesFontFamily,
  );
  bindRuntimeValue(
    runtime,
    "googleSlidesBasicFont",
    () => googleSlidesBasicFont,
  );
  bindRuntimeValue(runtime, "carriedFontFamilyMap", () => carriedFontFamilyMap);
  bindRuntimeValue(runtime, "toGoogleSlidesFonts", () => toGoogleSlidesFonts);
  bindRuntimeValue(
    runtime,
    "mapGoogleSlidesFontFaces",
    () => mapGoogleSlidesFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "normalizeGoogleSlidesNodeTypography",
    () => normalizeGoogleSlidesNodeTypography,
  );
  bindRuntimeValue(
    runtime,
    "toGoogleSlidesWeights",
    () => toGoogleSlidesWeights,
  );
  bindRuntimeValue(
    runtime,
    "collectGoogleSlidesFontRequests",
    () => collectGoogleSlidesFontRequests,
  );
  bindRuntimeValue(
    runtime,
    "installGoogleSlidesFonts",
    () => installGoogleSlidesFonts,
  );
  bindRuntimeValue(
    runtime,
    "measuredAsGoogleSlides",
    () => measuredAsGoogleSlides,
  );
  bindRuntimeValue(
    runtime,
    "googleSlidesFontFamilyMap",
    () => googleSlidesFontFamilyMap,
    (value) => {
      googleSlidesFontFamilyMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleSlidesSystemFontFamilyMap",
    () => googleSlidesSystemFontFamilyMap,
    (value) => {
      googleSlidesSystemFontFamilyMap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleSlidesFontWeight",
    () => googleSlidesFontWeight,
    (value) => {
      googleSlidesFontWeight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GOOGLE_SLIDES_FONT_STYLES",
    () => GOOGLE_SLIDES_FONT_STYLES,
    (value) => {
      GOOGLE_SLIDES_FONT_STYLES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "equalFontStyle",
    () => equalFontStyle,
    (value) => {
      equalFontStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleFontStylesheetUrl",
    () => googleFontStylesheetUrl,
    (value) => {
      googleFontStylesheetUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rangesContainCodepoints",
    () => rangesContainCodepoints,
    (value) => {
      rangesContainCodepoints = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unicodeRangeCss",
    () => unicodeRangeCss,
    (value) => {
      unicodeRangeCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GOOGLE_SLIDES_FONT_WAIT_MS",
    () => GOOGLE_SLIDES_FONT_WAIT_MS,
    (value) => {
      GOOGLE_SLIDES_FONT_WAIT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "googleSlidesFontTestHooks",
    () => googleSlidesFontTestHooks,
    (value) => {
      googleSlidesFontTestHooks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeGoogleSlidesFonts",
    () => initializeGoogleSlidesFonts,
    (value) => {
      initializeGoogleSlidesFonts = value;
    },
  );
  return () => {
    googleSlidesFontExports = {} as GoogleSlidesFontExports;
    (0, runtime.defineLiveExports)(googleSlidesFontExports, {
      toGoogleSlidesFonts: () => toGoogleSlidesFonts,
      measuredAsGoogleSlides: () => measuredAsGoogleSlides,
      _test: () => googleSlidesFontTestHooks,
    });
    googleSlidesFontWeight = (weight) => (weight >= 600 ? 700 : 400);
    equalFontStyle = (left, right) =>
      left.weight === right.weight && left.italic === right.italic;
    googleFontStylesheetUrl = (family, style) =>
      "https://fonts.googleapis.com/css2?family=" +
      family.replace(/ /g, "+") +
      ":ital,wght@" +
      (style.italic ? "1" : "0") +
      "," +
      String(style.weight) +
      "&display=swap";
    rangesContainCodepoints = (ranges, codepoints) =>
      [...codepoints].some((input) =>
        ranges.some(([input2, input3]) => input >= input2 && input <= input3),
      );
    unicodeRangeCss = (ranges) =>
      ranges
        .map(
          ([input, input2]) =>
            "U+" +
            input.toString(16) +
            (input2 > input ? "-" + input2.toString(16) : ""),
        )
        .join(", ");
    GOOGLE_SLIDES_FONT_WAIT_MS = 4000;
    initializeGoogleSlidesFonts = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeStyleSchema)();
      (0, runtime.initializeFontVariants)();
      (0, runtime.initializeHtmlCompiler)();
      (0, runtime.initializeFontFaceParser)();
      (0, runtime.initializeRenderingTheme)();
      (0, runtime.initializeFontSubstitution)();
      (0, runtime.initializeGoogleFontFamilies)();
      (0, runtime.initializeCaptureFallback)();
      googleSlidesFontFamilyMap = new Map(
        runtime.GOOGLE_SLIDES_FONT_FAMILIES.map((input): [string, string] => [
          input.toLowerCase(),
          input,
        ]),
      );
      googleSlidesSystemFontFamilyMap = new Map(
        [
          "Arial",
          "Georgia",
          "Times New Roman",
          "Courier New",
          "Verdana",
          "Trebuchet MS",
          "Impact",
          "Comic Sans MS",
          "Calibri",
          "Cambria",
        ].map((input): [string, string] => [input.toLowerCase(), input]),
      );
      GOOGLE_SLIDES_FONT_STYLES = [
        {
          weight: 400,
          italic: false,
        },
        {
          weight: 700,
          italic: false,
        },
        {
          weight: 400,
          italic: true,
        },
        {
          weight: 700,
          italic: true,
        },
      ];
      googleSlidesFontTestHooks = {
        toGoogleSlidesWeights: toGoogleSlidesWeights,
      };
    });
  };
}

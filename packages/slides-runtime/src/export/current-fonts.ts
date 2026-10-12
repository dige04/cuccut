/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  FontFace as DeckFontFace,
  FontFamilyValue,
  Slide,
  SlideNode,
  TextRole,
  ThemeFonts,
} from "../deck-contracts";
import type { RoleFontFallback } from "./font-substitution";

/** What a slide deck asks of one custom font: the style it is used in and every character set in it. */
export interface CustomFontUsage {
  family: string;
  weight: number;
  italic: boolean;
  text: string;
}
/** Slides re-pointed at the fonts this page really has, with a note for each font that had to give way. */
export interface CurrentFonts {
  slides: Slide[];
  /** Families that did not load and were replaced. */
  moved: string[];
  notes: string[];
}
export interface CurrentFontTestHooks {
  namedFaces: RuntimeBindings["resolveCurrentFontFaces"];
  unloadedFamilies: RuntimeBindings["unloadedFontFamilies"];
  withoutFamilies: RuntimeBindings["withoutFontFamilies"];
  unloadedFontNote: RuntimeBindings["unloadedFontNote"];
}
export interface CurrentFontExports {
  toCurrentFonts: RuntimeBindings["toCurrentFonts"];
  pageFontSet: RuntimeBindings["pageFontSet"];
  _test: CurrentFontTestHooks;
}

declare module "../bindings" {
  interface RuntimeBindings {
    currentFontExports: CurrentFontExports;
    /** Lower-cased first family of a font-family list. */
    normalizeCurrentFontName: (family: string) => string;
    isFontFaceSet: (value: unknown) => value is FontFaceSet;
    CURRENT_FONT_PROBE_TIMEOUT_MS: number;
    /** "a", "a and b", "a, b and c". */
    joinFontNames: (names: readonly string[]) => string;
    currentFontTestHooks: CurrentFontTestHooks;
    initializeCurrentFonts: () => void;
    /** The family a text role gets when it names none: the theme's own font when it has one. */
    currentRoleFontFace: (fonts?: ThemeFonts) => RoleFontFallback;
    resolveCurrentFontFaces: (
      slides: readonly Slide[],
      fonts?: ThemeFonts,
    ) => Slide[];
    /** Custom fonts the slides use, by normalised family name. */
    collectCustomFontUsage: (
      slides: readonly Slide[],
    ) => Map<string, CustomFontUsage>;
    pageFontSet: (page: object) => FontFaceSet | undefined;
    /** Whether the browser draws the font: true or false when it can tell, else undefined. */
    canvasFontIsLoaded: (
      family: string,
      text: string,
      weight: number,
      italic: boolean,
    ) => boolean | undefined;
    /** The families the deck uses whose font files are not loaded on this page. */
    unloadedFontFamilies: (
      fontSet: FontFaceSet | undefined,
      slides: readonly Slide[],
      faces?: readonly DeckFontFace[],
      fonts?: ThemeFonts,
      timeoutMs?: number,
    ) => Promise<string[]>;
    withoutFontFamilies: (
      slides: readonly Slide[],
      missingFamilies: readonly string[],
    ) => { slides: Slide[]; standIns: Map<string, string[]> };
    unloadedFontNote: (standIns: ReadonlyMap<string, readonly string[]>) => string;
    toCurrentFonts: (
      fontSet: FontFaceSet | undefined,
      options: readonly Slide[],
      faces?: readonly DeckFontFace[],
      fonts?: ThemeFonts,
      timeoutMs?: number,
    ) => Promise<CurrentFonts>;
  }
}

export function installExportCurrentFonts(
  runtime: RuntimeBindings,
): () => void {
  var currentFontExports: RuntimeBindings["currentFontExports"];
  var normalizeCurrentFontName: RuntimeBindings["normalizeCurrentFontName"];
  var isFontFaceSet: RuntimeBindings["isFontFaceSet"];
  var CURRENT_FONT_PROBE_TIMEOUT_MS: RuntimeBindings["CURRENT_FONT_PROBE_TIMEOUT_MS"];
  var joinFontNames: RuntimeBindings["joinFontNames"];
  var currentFontTestHooks: RuntimeBindings["currentFontTestHooks"];
  var initializeCurrentFonts: RuntimeBindings["initializeCurrentFonts"];
  function currentRoleFontFace(fonts?: ThemeFonts): RoleFontFallback {
    let value = (0, runtime.getRenderingTheme)() !== "neutral";
    return (input: TextRole): FontFamilyValue => {
      let value2: "serif" | "sans" = (0, runtime.renderingTypeScaleForRole)(
          input,
        ).serifDisplay
          ? "serif"
          : "sans",
        value3 = value ? fonts?.[value2] : undefined;
      if (
        value3 !== undefined &&
        !(0, runtime.isGenericFontFamily)(value3.family.trim())
      ) {
        return {
          family: value3.family,
          fallback: value2,
        };
      } else {
        return (0, runtime.webSafeFontFallback)(value2);
      }
    };
  }
  function resolveCurrentFontFaces(
    slides: readonly Slide[],
    fonts?: ThemeFonts,
  ): Slide[] {
    return (0, runtime.swapFaces)(
      slides,
      (input) =>
        typeof input === "string"
          ? (0, runtime.webSafeFontFallback)(input)
          : input,
      {
        faceless: currentRoleFontFace(fonts),
      },
    );
  }
  function collectCustomFontUsage(
    slides: readonly Slide[],
  ): Map<string, CustomFontUsage> {
    let entries = new Map<string, CustomFontUsage>(),
      callback = (source: SlideNode): void => {
        for (let value4 of ((0, runtime.nodeChildren)(source) ??
          []) as SlideNode[])
          callback(value4);
        if (source.kind !== "text" && source.kind !== "table") {
          return;
        }
        let value = source.style?.fontFamily;
        if (
          typeof value !== "object" ||
          (0, runtime.resolveBasicFontFamily)(value.family) !== undefined
        ) {
          return;
        }
        let value2: number =
            (source.kind === "text" ? source.style?.fontWeight : undefined) ??
            (0, runtime.renderingTypeScaleForRole)(source.role ?? "body")
              .fontWeight,
          value3: CustomFontUsage = entries.get(
            normalizeCurrentFontName(value.family),
          ) ?? {
            family: value.family,
            weight: value2,
            italic: source.style?.fontStyle === "italic",
            text: "",
          };
        value3.text +=
          source.kind === "text" ? source.text : source.rows.flat().join("");
        entries.set(normalizeCurrentFontName(value.family), value3);
      };
    for (let value of slides)
      for (let value2 of value.frames) callback(value2.node);
    return entries;
  }
  function pageFontSet(page: object): FontFaceSet | undefined {
    let value = "fonts" in page ? page.fonts : undefined;
    if (isFontFaceSet(value)) {
      return value;
    } else {
      return undefined;
    }
  }
  /**
   * The parameter names are historical: callers pass (family, text, weight, italic), so `weight` is the
   * sample text, `italic` the numeric weight and `text` the italic flag.
   */
  function canvasFontIsLoaded(
    family: string,
    weight: string,
    italic: number,
    text: boolean,
  ): boolean | undefined {
    try {
      let value =
        typeof document === "undefined"
          ? undefined
          : document.createElement("canvas").getContext("2d");
      if (value === undefined || value === null) {
        return;
      }
      let items = ["monospace", "serif", "sans-serif"],
        callback = (input: string): boolean | undefined => {
          let callback2 = (input2: string): number => {
              value.font =
                (text ? "italic " : "") + String(italic) + " 32px " + input2;
              return value.measureText(input).width;
            },
            value3 = items.map(callback2);
          if (value3.every((input2) => input2 === value3[0])) {
            return;
          }
          let value4 = items.map((input2) =>
            callback2('"' + family + '", ' + input2),
          );
          return value4.every((input2) => input2 === value4[0]);
        },
        value2 = weight
          .replace(/[^\p{L}\p{N} ]+/gu, "")
          .trim()
          .slice(0, 40),
        items2 = [
          value2 === "" ? undefined : callback(value2),
          callback("Hamburgefonstiv 0123"),
        ];
      if (items2.includes(true)) {
        return true;
      } else {
        if (items2.includes(false)) {
          return false;
        } else {
          return undefined;
        }
      }
    } catch {
      return;
    }
  }
  async function unloadedFontFamilies(
    fontSet: FontFaceSet | undefined,
    slides: readonly Slide[],
    faces?: readonly DeckFontFace[],
    fonts?: ThemeFonts,
    timeoutMs: number = runtime.fontReadyTimeoutMs,
  ): Promise<string[]> {
    if (fontSet === undefined) {
      return [];
    }
    let values = new Set(
        [
          ...(faces ?? []),
          ...Object.values(
            (fonts ?? {}) as Record<string, DeckFontFace | undefined>,
          ),
        ].flatMap((input) =>
          input === undefined ? [] : [normalizeCurrentFontName(input.family)],
        ),
      ),
      value = [...collectCustomFontUsage(slides).entries()].filter(
        ([input]) => values.has(input),
      );
    if (value.length === 0) {
      return [];
    }
    let value2 = Date.now() + timeoutMs,
      callback = (): number => Math.max(0, value2 - Date.now()),
      callback2 = (): Map<string, Set<string>> => {
        let entries2 = new Map<string, Set<string>>();
        for (let value4 of fontSet) {
          if (typeof value4?.family !== "string") {
            continue;
          }
          entries2.set(
            normalizeCurrentFontName(value4.family),
            (
              entries2.get(normalizeCurrentFontName(value4.family)) ??
              new Set<string>()
            ).add(String(value4.status)),
          );
        }
        return entries2;
      },
      value3 = callback2(),
      entries = new Map<string, boolean>(),
      callback3 = (input: string, options: CustomFontUsage): boolean => {
        let entry = entries.get(input);
        if (entry !== undefined) {
          return entry;
        }
        let value4 =
          canvasFontIsLoaded(
            options.family,
            options.text,
            options.weight,
            options.italic,
          ) === true;
        entries.set(input, value4);
        return value4;
      };
    for (
      let value4 = Math.min(value2, Date.now() + CURRENT_FONT_PROBE_TIMEOUT_MS);
      value.some(
        ([input, input2]) => !value3.has(input) && !callback3(input, input2),
      ) && Date.now() < value4;
      value3 = callback2()
    )
      await new Promise<void>((input) =>
        setTimeout(input, Math.min(200, callback())),
      );
    let values2 = new Set(
        [...value3].flatMap(([input, input2]) =>
          input2.has("loaded") ? [input] : [],
        ),
      ),
      values3 = new Set<string>(),
      callback4 = ([input, input2]: [string, CustomFontUsage]): Promise<void> => {
        values3.add(input);
        return Promise.resolve()
          .then(() =>
              fontSet.load(
                (input2.italic ? "italic " : "") +
                  String(input2.weight) +
                  ' 16px "' +
                  input2.family +
                  '"',
                " " + input2.text,
              ),
          )
          .then(
            (items): void => {
              if (items.length > 0) {
                values2.add(input);
              }
            },
            (): void => {
              return;
            },
          );
      },
      callback5 = ([input]: [string, CustomFontUsage]): boolean =>
        !values3.has(input) && value3.get(input)?.has("loaded") === false;
    await (0, runtime.promiseWithTimeout)(
      Promise.all(value.filter(callback5).map(callback4)),
      callback(),
    );
    await (0, runtime.promiseWithTimeout)(
      Promise.resolve(fontSet.ready).catch((): void => {
        return;
      }),
      callback(),
    );
    value3 = callback2();
    await (0, runtime.promiseWithTimeout)(
      Promise.all(value.filter(callback5).map(callback4)),
      callback(),
    );
    value3 = callback2();
    entries.clear();
    return value
      .filter(
        ([input, input2]) =>
          !values2.has(input) &&
          value3.get(input)?.has("loaded") !== true &&
          (value3.get(input)?.has("loading") === true ||
            !callback3(input, input2)),
      )
      .map(([, input]) => input.family);
  }
  function withoutFontFamilies(
    slides: readonly Slide[],
    missingFamilies: readonly string[],
  ): { slides: Slide[]; standIns: Map<string, string[]> } {
    let entries = new Map(
        missingFamilies.map((input): [string, string] => [
          normalizeCurrentFontName(input),
          input,
        ]),
      ),
      entries2 = new Map<string, string[]>();
    return {
      slides: (0, runtime.swapFaces)(
        slides,
        (input, options) => {
          let value =
            typeof input === "object"
              ? entries.get(normalizeCurrentFontName(input.family))
              : undefined;
          if (value === undefined) {
            return input;
          }
          let value2 = (0, runtime.webSafeFontFallback)(options),
            value3 = entries2.get(value) ?? [];
          if (!value3.includes(value2.family)) {
            value3.push(value2.family);
          }
          entries2.set(value, value3);
          return value2;
        },
      ),
      standIns: entries2,
    };
  }
  function unloadedFontNote(
    standIns: ReadonlyMap<string, readonly string[]>,
  ): string {
    let items = [...standIns.keys()],
      items2 = [...new Set([...standIns.values()].flat())],
      value = [...standIns].map(
        ([input, input2]) => input + " with " + joinFontNames(input2),
      ),
      value2 =
        items.length === 1 || items2.length === 1
          ? "uses " + joinFontNames(items2) + " instead"
          : "replaces " +
            value.slice(0, -1).join(", ") +
            ", and " +
            String(value[value.length - 1]);
    return (
      (items.length === 1 ? "the font " : "the fonts ") +
      joinFontNames(items) +
      " did not load on this page, so this file " +
      value2 +
      "; to retry, export again in a moment or reload the page"
    );
  }
  async function toCurrentFonts(
    fontSet: FontFaceSet | undefined,
    options: readonly Slide[],
    faces?: readonly DeckFontFace[],
    fonts?: ThemeFonts,
    timeoutMs: number = runtime.fontReadyTimeoutMs,
  ): Promise<CurrentFonts> {
    let value = resolveCurrentFontFaces(options, fonts),
      value2 = await unloadedFontFamilies(
        fontSet,
        value,
        faces,
        fonts,
        timeoutMs,
      ).catch((): string[] => []);
    if (value2.length === 0) {
      return {
        slides: value,
        moved: [],
        notes: [],
      };
    }
    let { slides: slides, standIns: standIns } = withoutFontFamilies(
      value,
      value2,
    );
    return {
      slides: slides,
      moved: [...standIns.keys()],
      notes: standIns.size > 0 ? [unloadedFontNote(standIns)] : [],
    };
  }
  bindRuntimeValue(
    runtime,
    "currentFontExports",
    () => currentFontExports,
    (value) => {
      currentFontExports = value;
    },
  );
  bindRuntimeValue(runtime, "currentRoleFontFace", () => currentRoleFontFace);
  bindRuntimeValue(
    runtime,
    "resolveCurrentFontFaces",
    () => resolveCurrentFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "collectCustomFontUsage",
    () => collectCustomFontUsage,
  );
  bindRuntimeValue(runtime, "pageFontSet", () => pageFontSet);
  bindRuntimeValue(runtime, "canvasFontIsLoaded", () => canvasFontIsLoaded);
  bindRuntimeValue(runtime, "unloadedFontFamilies", () => unloadedFontFamilies);
  bindRuntimeValue(runtime, "withoutFontFamilies", () => withoutFontFamilies);
  bindRuntimeValue(runtime, "unloadedFontNote", () => unloadedFontNote);
  bindRuntimeValue(runtime, "toCurrentFonts", () => toCurrentFonts);
  bindRuntimeValue(
    runtime,
    "normalizeCurrentFontName",
    () => normalizeCurrentFontName,
    (value) => {
      normalizeCurrentFontName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFontFaceSet",
    () => isFontFaceSet,
    (value) => {
      isFontFaceSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CURRENT_FONT_PROBE_TIMEOUT_MS",
    () => CURRENT_FONT_PROBE_TIMEOUT_MS,
    (value) => {
      CURRENT_FONT_PROBE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "joinFontNames",
    () => joinFontNames,
    (value) => {
      joinFontNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "currentFontTestHooks",
    () => currentFontTestHooks,
    (value) => {
      currentFontTestHooks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeCurrentFonts",
    () => initializeCurrentFonts,
    (value) => {
      initializeCurrentFonts = value;
    },
  );
  return () => {
    currentFontExports = {} as CurrentFontExports;
    (0, runtime.defineLiveExports)(currentFontExports, {
      toCurrentFonts: () => toCurrentFonts,
      pageFontSet: () => pageFontSet,
      _test: () => currentFontTestHooks,
    });
    normalizeCurrentFontName = (family) =>
      (0, runtime.firstFontFamily)(family).toLowerCase();
    isFontFaceSet = (value): value is FontFaceSet =>
      value !== undefined &&
      value !== null &&
      typeof (value as Partial<FontFaceSet>).load === "function" &&
      typeof (value as Partial<FontFaceSet>)[Symbol.iterator] === "function" &&
      (value as Partial<FontFaceSet>).ready !== undefined;
    CURRENT_FONT_PROBE_TIMEOUT_MS = 2000;
    joinFontNames = (names) =>
      names.length <= 1
        ? names.join("")
        : names.slice(0, -1).join(", ") +
          " and " +
          String(names[names.length - 1]);
    initializeCurrentFonts = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeDesignTokenParser)();
      (0, runtime.initializeFontVariants)();
      (0, runtime.initializeHtmlCompiler)();
      (0, runtime.initializeCaptureFallback)();
      (0, runtime.initializeRenderingTheme)();
      (0, runtime.initializeFontSubstitution)();
      currentFontTestHooks = {
        namedFaces: resolveCurrentFontFaces,
        unloadedFamilies: unloadedFontFamilies,
        withoutFamilies: withoutFontFamilies,
        unloadedFontNote: unloadedFontNote,
      };
    });
  };
}

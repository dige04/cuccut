/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  FontFamilyValue,
  Slide,
  SlideNode,
  TextRole,
} from "../deck-contracts";

/** Chooses the family to write for a font: gets the family and the same family with its carried web-safe fallback. */
export type FontFaceSwap = (
  value: FontFamilyValue,
  withWebSafe: FontFamilyValue,
) => FontFamilyValue;
/** The family a text role uses when its node names none. */
export type RoleFontFallback = (role: TextRole) => FontFamilyValue;
/** Called with the original and the replacement family whenever a swap changes the family. */
export type FontSwapReporter = (from: string, to: string) => void;
export interface SwapFacesOptions {
  faceless?: RoleFontFallback;
  swapped?: FontSwapReporter;
}
export interface FontSubstitutionExports {
  toBasicFonts: (
    slides: readonly Slide[],
    swapped?: FontSwapReporter,
  ) => Slide[];
  swapFaces: (
    slides: readonly Slide[],
    swap: FontFaceSwap,
    options?: SwapFacesOptions,
  ) => Slide[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    fontSubstitutionExports: FontSubstitutionExports;
    /** The generic family a text role falls back to: serif for display roles, else sans. */
    defaultRoleFontFallback: RoleFontFallback;
    /** Lower-cased family name with web-safe aliases resolved. */
    normalizeFontFamily: (family: string) => string;
    initializeFontSubstitution: () => void;
    /** Web-safe fallback families by lower-cased custom family name. */
    collectWebSafeFontFallbacks: (
      slides: readonly Slide[],
    ) => Map<string, string>;
    mapNodeFontFaces: (
      node: SlideNode,
      carriedFamilies: ReadonlyMap<string, string>,
      swap: FontFaceSwap,
      faceless: RoleFontFallback,
      swapped?: FontSwapReporter,
    ) => SlideNode;
    swapFaces: FontSubstitutionExports["swapFaces"];
    toBasicFonts: FontSubstitutionExports["toBasicFonts"];
  }
}

export function installExportFontSubstitution(
  runtime: RuntimeBindings,
): () => void {
  var fontSubstitutionExports: RuntimeBindings["fontSubstitutionExports"];
  var defaultRoleFontFallback: RuntimeBindings["defaultRoleFontFallback"];
  var normalizeFontFamily: RuntimeBindings["normalizeFontFamily"];
  var initializeFontSubstitution: RuntimeBindings["initializeFontSubstitution"];
  function collectWebSafeFontFallbacks(
    slides: readonly Slide[],
  ): Map<string, string> {
    let entries = new Map<string, string>(),
      callback = (input: SlideNode): void => {
        let value = input.style?.fontFamily;
        if (
          typeof value === "object" &&
          value.webSafe !== undefined &&
          !entries.has(value.family.toLowerCase())
        ) {
          entries.set(value.family.toLowerCase(), value.webSafe);
        }
        for (let value2 of ((0, runtime.nodeChildren)(input) ??
          []) as SlideNode[])
          callback(value2);
      };
    for (let value of slides)
      for (let value2 of value.frames) callback(value2.node);
    return entries;
  }
  function mapNodeFontFaces(
    node: SlideNode,
    carriedFamilies: ReadonlyMap<string, string>,
    swap: FontFaceSwap,
    faceless: RoleFontFallback,
    swapped?: FontSwapReporter,
  ): SlideNode {
    switch (node.kind) {
      case "text":
      case "table": {
        let value: FontFamilyValue =
            node.style?.fontFamily ?? faceless(node.role ?? "body"),
          value2 =
            typeof value === "object" && value.webSafe === undefined
              ? carriedFamilies.get(value.family.toLowerCase())
              : undefined,
          value3: FontFamilyValue =
            typeof value === "object" && value2 !== undefined
              ? {
                  ...value,
                  webSafe: value2,
                }
              : value,
          value4 = swap(value, value3);
        if (
          typeof value === "object" &&
          typeof value4 === "object" &&
          normalizeFontFamily(value4.family) !==
            normalizeFontFamily(value.family)
        ) {
          swapped?.(value.family, value4.family);
        }
        return {
          ...node,
          style: {
            ...node.style,
            fontFamily: value4,
          },
        };
      }
      case "stack":
      case "grid":
        return {
          ...node,
          children: node.children.map((input) =>
            mapNodeFontFaces(input, carriedFamilies, swap, faceless, swapped),
          ),
        };
      case "overlay":
        return {
          ...node,
          base: mapNodeFontFaces(
            node.base,
            carriedFamilies,
            swap,
            faceless,
            swapped,
          ),
          layers: node.layers.map((input) => ({
            ...input,
            node: mapNodeFontFaces(
              input.node,
              carriedFamilies,
              swap,
              faceless,
              swapped,
            ),
          })),
        };
      default:
        return node;
    }
  }
  function swapFaces(
    slides: readonly Slide[],
    swap: FontFaceSwap,
    {
      faceless: options = defaultRoleFontFallback,
      swapped: swapped,
    }: SwapFacesOptions = {},
  ): Slide[] {
    let value = collectWebSafeFontFallbacks(slides);
    return slides.map((input) => ({
      ...input,
      frames: input.frames.map((input2) => ({
        ...input2,
        node: mapNodeFontFaces(input2.node, value, swap, options, swapped),
      })),
    }));
  }
  function toBasicFonts(
    slides: readonly Slide[],
    swapped?: FontSwapReporter,
  ): Slide[] {
    return swapFaces(
      slides,
      (input, options) => (0, runtime.webSafeFontFallback)(options),
      {
        swapped: swapped,
      },
    );
  }
  bindRuntimeValue(
    runtime,
    "fontSubstitutionExports",
    () => fontSubstitutionExports,
    (value) => {
      fontSubstitutionExports = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectWebSafeFontFallbacks",
    () => collectWebSafeFontFallbacks,
  );
  bindRuntimeValue(runtime, "mapNodeFontFaces", () => mapNodeFontFaces);
  bindRuntimeValue(runtime, "swapFaces", () => swapFaces);
  bindRuntimeValue(runtime, "toBasicFonts", () => toBasicFonts);
  bindRuntimeValue(
    runtime,
    "defaultRoleFontFallback",
    () => defaultRoleFontFallback,
    (value) => {
      defaultRoleFontFallback = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFontFamily",
    () => normalizeFontFamily,
    (value) => {
      normalizeFontFamily = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeFontSubstitution",
    () => initializeFontSubstitution,
    (value) => {
      initializeFontSubstitution = value;
    },
  );
  return () => {
    fontSubstitutionExports = {} as FontSubstitutionExports;
    (0, runtime.defineLiveExports)(fontSubstitutionExports, {
      toBasicFonts: () => toBasicFonts,
      swapFaces: () => swapFaces,
    });
    defaultRoleFontFallback = (role) =>
      (0, runtime.renderingTypeScaleForRole)(role).serifDisplay
        ? "serif"
        : "sans";
    normalizeFontFamily = (family) =>
      (
        (0, runtime.resolveFontFamilyAlias)(family)?.family ?? family
      ).toLowerCase();
    initializeFontSubstitution = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeHtmlCompiler)();
      (0, runtime.initializeRenderingTheme)();
    });
  };
}

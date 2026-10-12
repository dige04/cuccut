/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlideColorName, TextRole } from "../deck-contracts";

/** Typographic defaults of one text role (font size in slide px). */
export interface TypeScaleEntry {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  /** Set when the role uses the serif display face. */
  serifDisplay?: true;
  /** Callers also look entries up by a computed property name. */
  [property: string]: number | true | undefined;
}
/** Type scale of a theme: one entry per text role; other keys (unvalidated callers) may be absent. */
export interface TypeScale extends Record<TextRole, TypeScaleEntry> {
  [role: string]: TypeScaleEntry | undefined;
}
/** Hex colours of the named palette; other keys (unvalidated callers) may be absent. */
export interface NamedSlideColors extends Record<SlideColorName, string> {
  [name: string]: string | undefined;
}

declare module "../bindings" {
  interface RuntimeBindings {
    anthropicTypeScale: TypeScale;
    neutralTypeScale: TypeScale;
    namedSlideColors: NamedSlideColors;
    initializeSlideTypeScales: () => void;
  }
}

export function installModelTypeScales(runtime: RuntimeBindings): () => void {
  var anthropicTypeScale: RuntimeBindings["anthropicTypeScale"];
  var neutralTypeScale: RuntimeBindings["neutralTypeScale"];
  var namedSlideColors: RuntimeBindings["namedSlideColors"];
  var initializeSlideTypeScales: RuntimeBindings["initializeSlideTypeScales"];

  bindRuntimeValue(
    runtime,
    "anthropicTypeScale",
    () => anthropicTypeScale,
    (value) => {
      anthropicTypeScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "neutralTypeScale",
    () => neutralTypeScale,
    (value) => {
      neutralTypeScale = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "namedSlideColors",
    () => namedSlideColors,
    (value) => {
      namedSlideColors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSlideTypeScales",
    () => initializeSlideTypeScales,
    (value) => {
      initializeSlideTypeScales = value;
    },
  );
  return () => {
    initializeSlideTypeScales = (0, runtime.initializeOnce)((): void => {
      anthropicTypeScale = {
        display: {
          fontSize: 128,
          fontWeight: 300,
          lineHeight: 1.15,
          serifDisplay: true,
        },
        h1: {
          fontSize: 112,
          fontWeight: 300,
          lineHeight: 1.2,
          serifDisplay: true,
        },
        h2: {
          fontSize: 96,
          fontWeight: 300,
          lineHeight: 1.2,
          serifDisplay: true,
        },
        h3: {
          fontSize: 72,
          fontWeight: 300,
          lineHeight: 1.2,
          serifDisplay: true,
        },
        lead: {
          fontSize: 44,
          fontWeight: 430,
          lineHeight: 1.4,
        },
        eyebrow: {
          fontSize: 36,
          fontWeight: 500,
          lineHeight: 1.2,
        },
        body: {
          fontSize: 32,
          fontWeight: 430,
          lineHeight: 1.4,
        },
        caption: {
          fontSize: 24,
          fontWeight: 430,
          lineHeight: 1.4,
        },
      };
      neutralTypeScale = {
        display: {
          fontSize: 128,
          fontWeight: 600,
          lineHeight: 1.05,
        },
        h1: {
          fontSize: 96,
          fontWeight: 600,
          lineHeight: 1.1,
        },
        h2: {
          fontSize: 64,
          fontWeight: 600,
          lineHeight: 1.15,
        },
        h3: {
          fontSize: 44,
          fontWeight: 600,
          lineHeight: 1.2,
        },
        lead: {
          fontSize: 40,
          fontWeight: 400,
          lineHeight: 1.35,
        },
        eyebrow: {
          fontSize: 24,
          fontWeight: 600,
          lineHeight: 1.2,
        },
        body: {
          fontSize: 32,
          fontWeight: 400,
          lineHeight: 1.4,
        },
        caption: {
          fontSize: 24,
          fontWeight: 400,
          lineHeight: 1.4,
        },
      };
      namedSlideColors = {
        slate: "#141413",
        ivory: "#FAF9F5",
        "ivory-warm": "#F5F4ED",
        clay: "#D97757",
        oat: "#E3DACC",
        white: "#FFFFFF",
        "text-secondary": "#3D3D3A",
        "text-tertiary": "#73726C",
      };
    });
  };
}

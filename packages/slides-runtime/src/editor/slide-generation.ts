/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** A slide object stamped with the local revision it was built from (see `protectLocallyRevisedSlides`). */
interface GenerationStamped {
  [key: symbol]: number | undefined;
}

declare module "../bindings" {
  interface RuntimeBindings {
    SLIDE_GENERATION_SYMBOL: symbol;
    slideGeneration: (slide?: object | null) => number | undefined;
    isSlideGenerationStale: (
      generation: number | undefined,
      slide?: object | null,
    ) => boolean;
  }
}

export function installEditorSlideGeneration(
  runtime: RuntimeBindings,
): () => void {
  var SLIDE_GENERATION_SYMBOL: RuntimeBindings["SLIDE_GENERATION_SYMBOL"];
  var slideGeneration: RuntimeBindings["slideGeneration"];
  var isSlideGenerationStale: RuntimeBindings["isSlideGenerationStale"];

  bindRuntimeValue(
    runtime,
    "SLIDE_GENERATION_SYMBOL",
    () => SLIDE_GENERATION_SYMBOL,
    (value) => {
      SLIDE_GENERATION_SYMBOL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideGeneration",
    () => slideGeneration,
    (value) => {
      slideGeneration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSlideGenerationStale",
    () => isSlideGenerationStale,
    (value) => {
      isSlideGenerationStale = value;
    },
  );
  return () => {
    (0, runtime.initializeFontCatalog)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeModelEditing)();
    SLIDE_GENERATION_SYMBOL = Symbol.for("slides.gen");
    slideGeneration = (slide?: object | null): number | undefined =>
      (slide as GenerationStamped | null | undefined)?.[
        SLIDE_GENERATION_SYMBOL
      ];
    isSlideGenerationStale = (
      generation: number | undefined,
      slide?: object | null,
    ): boolean =>
      generation !== undefined &&
      slideGeneration(slide) !== undefined &&
      slideGeneration(slide) !== generation;
  };
}

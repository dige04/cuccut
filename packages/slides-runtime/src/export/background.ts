/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Frame, Slide } from "../deck-contracts";

declare module "../bindings" {
  interface RuntimeBindings {
    /** The leading empty full-slide frames that only paint the slide background. */
    slideBackgroundPaintFrames: (
      slide: Slide,
      matchesFrame: (frame: Frame) => boolean,
    ) => Frame[];
    /** True when a frame paints a gradient the PPTX writer cannot express natively. */
    backgroundNeedsGradientRaster: (frames: readonly Frame[]) => boolean;
    /** JSON with object keys sorted, so equal values give equal strings. */
    stableJsonStringify: (value: unknown) => string;
    imagePixelsAreWhite: (rgba: ArrayLike<number>) => boolean;
  }
}

export function installExportBackground(runtime: RuntimeBindings): () => void {
  function slideBackgroundPaintFrames(
    slide: Slide,
    matchesFrame: (frame: Frame) => boolean,
  ): Frame[] {
    let frames: Frame[] = [];
    for (let value of slide.frames) {
      if (
        !(
          value.node.kind === "stack" &&
          value.node.children.length === 0 &&
          Object.keys(value.node.style ?? {}).every((input) =>
            runtime.backgroundCaptureStyleKeys.has(input),
          )
        ) ||
        !matchesFrame(value)
      ) {
        break;
      }
      frames.push(value);
    }
    return frames;
  }
  function backgroundNeedsGradientRaster(frames: readonly Frame[]): boolean {
    return frames.some((input) => {
      let value = input.node.style?.backgroundGradient;
      return (
        value !== undefined &&
        (value.radial === true || value.repeat !== undefined)
      );
    });
  }
  function stableJsonStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return "[" + value.map(stableJsonStringify).join(",") + "]";
    }
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value) ?? "null";
    }
    return (
      "{" +
      Object.entries(value as Record<string, unknown>)
        .sort(([input], [options]) =>
          input < options ? -1 : input > options ? 1 : 0,
        )
        .map(
          ([input, input2]) =>
            JSON.stringify(input) + ":" + stableJsonStringify(input2),
        )
        .join(",") +
      "}"
    );
  }
  function imagePixelsAreWhite(rgba: ArrayLike<number>): boolean {
    for (let index = 0; index < rgba.length; index += 4)
      if (
        rgba[index] !== 255 ||
        rgba[index + 1] !== 255 ||
        rgba[index + 2] !== 255
      ) {
        return false;
      }
    return true;
  }
  bindRuntimeValue(
    runtime,
    "slideBackgroundPaintFrames",
    () => slideBackgroundPaintFrames,
  );
  bindRuntimeValue(
    runtime,
    "backgroundNeedsGradientRaster",
    () => backgroundNeedsGradientRaster,
  );
  bindRuntimeValue(runtime, "stableJsonStringify", () => stableJsonStringify);
  bindRuntimeValue(runtime, "imagePixelsAreWhite", () => imagePixelsAreWhite);
  return () => {};
}

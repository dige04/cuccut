/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  BuildEffectName,
  Frame,
  Slide,
  SlideTransition,
} from "../deck-contracts";

/** The part of a slide the build scheduling reads. */
export type BuildScheduledSlide = Pick<Slide, "frames">;
/** Whether a build step shows a frame or hides it. */
export type BuildDirection = "in" | "out";
/** One frame animation of a build step. */
export interface BuildStepEffect {
  frame: Frame;
  dir: BuildDirection;
  effect: BuildEffectName;
  /** The step plays on its own right after the previous one. */
  auto: boolean;
}
/** Where an entering frame starts from and how it eases in. */
export interface BuildEffectTransition {
  /** CSS transform the frame starts from (empty for none). */
  transform: string;
  easing: string;
}
/** Duration in milliseconds per slide transition kind; other kinds read as undefined. */
export interface SlideTransitionDurations
  extends Record<SlideTransition, number> {
  [kind: string]: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    slideBuildOrders: (slide: BuildScheduledSlide) => number[];
    slideBuildCount: (slide: BuildScheduledSlide) => number;
    hiddenBuildFrameIds: (
      slide: BuildScheduledSlide,
      buildStep: number,
    ) => Set<string>;
    slideBuildStepEffects: (
      slide: BuildScheduledSlide,
      buildStep: number,
    ) => BuildStepEffect[];
    slideBuildStepIsAutomatic: (
      slide: BuildScheduledSlide,
      buildStep: number,
    ) => boolean;
    /**
     * Effect names are stored as plain strings (`buildEffectValues`), so any name is accepted; every name in
     * `BuildEffectName` has a transition.
     */
    buildEffectTransition(effect: string): BuildEffectTransition;
    buildEffectDurationMs: number;
    buildExitEasing: string;
    buildEnterEasing: string;
    slideTransitionDurations: SlideTransitionDurations;
    slideTransitionEasing: string;
    initializeBuildEffects: () => void;
  }
}

export function installPresentationBuildEffects(
  runtime: RuntimeBindings,
): () => void {
  var buildEffectDurationMs: RuntimeBindings["buildEffectDurationMs"];
  var buildExitEasing: RuntimeBindings["buildExitEasing"];
  var buildEnterEasing: RuntimeBindings["buildEnterEasing"];
  var slideTransitionDurations: RuntimeBindings["slideTransitionDurations"];
  var slideTransitionEasing: RuntimeBindings["slideTransitionEasing"];
  var initializeBuildEffects: RuntimeBindings["initializeBuildEffects"];
  function slideBuildOrders(slide: BuildScheduledSlide): number[] {
    let orders = new Set<number>();
    for (let value of slide.frames) {
      if (value.build?.in !== undefined) {
        orders.add(value.build.in.order);
      }
      if (value.build?.out !== undefined) {
        orders.add(value.build.out.order);
      }
    }
    return [...orders].sort((input, options) => input - options);
  }
  function slideBuildCount(slide: BuildScheduledSlide): number {
    return slideBuildOrders(slide).length;
  }
  function hiddenBuildFrameIds(
    slide: BuildScheduledSlide,
    buildStep: number,
  ): Set<string> {
    let orders = slideBuildOrders(slide),
      hidden = new Set<string>();
    for (let value of slide.frames) {
      let build = value.build;
      if (build === undefined) {
        continue;
      }
      let value2 =
          build.in !== undefined ? orders.indexOf(build.in.order) + 1 : 0,
        value3 =
          build.out !== undefined ? orders.indexOf(build.out.order) + 1 : 1 / 0;
      if (buildStep < value2 || buildStep >= value3) {
        hidden.add(value.id);
      }
    }
    return hidden;
  }
  function slideBuildStepEffects(
    slide: BuildScheduledSlide,
    buildStep: number,
  ): BuildStepEffect[] {
    let order = slideBuildOrders(slide)[buildStep - 1];
    if (order === undefined) {
      return [];
    }
    let effects: BuildStepEffect[] = [];
    for (let value of slide.frames) {
      let build = value.build;
      if (build?.in !== undefined && build.in.order === order) {
        effects.push({
          frame: value,
          dir: "in",
          effect: build.in.effect,
          auto: build.in.auto === true,
        });
      }
      if (build?.out !== undefined && build.out.order === order) {
        effects.push({
          frame: value,
          dir: "out",
          effect: build.out.effect,
          auto: build.out.auto === true,
        });
      }
    }
    return effects;
  }
  function slideBuildStepIsAutomatic(
    slide: BuildScheduledSlide,
    buildStep: number,
  ): boolean {
    let effects = slideBuildStepEffects(slide, buildStep);
    return effects.length > 0 && effects.every((input) => input.auto);
  }
  function buildEffectTransition(
    effect: BuildEffectName,
  ): BuildEffectTransition {
    switch (effect) {
      case "fade":
        return {
          transform: "",
          easing: buildEnterEasing,
        };
      case "rise":
        return {
          transform: "translateY(48px)",
          easing: buildEnterEasing,
        };
      case "drop":
        return {
          transform: "translateY(-48px)",
          easing: buildEnterEasing,
        };
      case "left":
        return {
          transform: "translateX(-72px)",
          easing: buildEnterEasing,
        };
      case "right":
        return {
          transform: "translateX(72px)",
          easing: buildEnterEasing,
        };
      case "scale":
        return {
          transform: "scale(0.8)",
          easing: buildEnterEasing,
        };
      case "pop":
        return {
          transform: "scale(0.5)",
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        };
    }
  }
  bindRuntimeValue(runtime, "slideBuildOrders", () => slideBuildOrders);
  bindRuntimeValue(runtime, "slideBuildCount", () => slideBuildCount);
  bindRuntimeValue(runtime, "hiddenBuildFrameIds", () => hiddenBuildFrameIds);
  bindRuntimeValue(
    runtime,
    "slideBuildStepEffects",
    () => slideBuildStepEffects,
  );
  bindRuntimeValue(
    runtime,
    "slideBuildStepIsAutomatic",
    () => slideBuildStepIsAutomatic,
  );
  bindRuntimeValue(
    runtime,
    "buildEffectTransition",
    () => buildEffectTransition,
  );
  bindRuntimeValue(
    runtime,
    "buildEffectDurationMs",
    () => buildEffectDurationMs,
    (value) => {
      buildEffectDurationMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildExitEasing",
    () => buildExitEasing,
    (value) => {
      buildExitEasing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildEnterEasing",
    () => buildEnterEasing,
    (value) => {
      buildEnterEasing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideTransitionDurations",
    () => slideTransitionDurations,
    (value) => {
      slideTransitionDurations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideTransitionEasing",
    () => slideTransitionEasing,
    (value) => {
      slideTransitionEasing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeBuildEffects",
    () => initializeBuildEffects,
    (value) => {
      initializeBuildEffects = value;
    },
  );
  return () => {
    buildEffectDurationMs = 380;
    buildExitEasing = "cubic-bezier(0.45, 0, 0.85, 0.6)";
    buildEnterEasing = "cubic-bezier(0.2, 0.7, 0.2, 1)";
    slideTransitionEasing = "cubic-bezier(0.33, 0.01, 0.2, 1)";
    initializeBuildEffects = (0, runtime.initializeOnce)(() => {
      slideTransitionDurations = {
        fade: 320,
        push: 420,
        magic: 480,
      };
    });
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** Horizontal position of a segment inside its control, in pixels. */
export interface SegmentBounds {
  left: number;
  width: number;
}
export interface SegmentThumbOptions {
  /** A layout correction: snap to the new position without animating unless an animation is already running. */
  correction?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    /** Moves the thumb to `target`; returns the function that applies the move. */
    animateSegmentedControlThumb: (
      thumb: HTMLElement,
      control: HTMLElement,
      target: SegmentBounds | null,
      options?: SegmentThumbOptions,
    ) => () => void;
    readCssDuration: (style: CSSStyleDeclaration, property: string) => number;
    supportsElementAnimations: (element: Element) => boolean;
    usesAlphaBackground: (style: CSSStyleDeclaration) => boolean;
    setTransformWillChange: (element: HTMLElement, enabled: boolean) => void;
    hasRunningAnimations: (element: Element) => boolean;
    getElementAnimations: (element: Element) => Animation[];
    cancelAnimations: (animations: Iterable<Animation>) => void;
    hasFlipAnimationMarker: (element: HTMLElement) => boolean;
    pauseFlipAnimationAtProgress: (
      element: HTMLElement,
      progress: number,
      getSegmentBounds: () => SegmentBounds[],
    ) => void;
    isImmediateFlipMarker: (element: HTMLElement) => boolean;
    noopFlipCleanup: () => void;
    FLIP_HELD_MARKER: string;
    FLIP_PAUSE_DURATION_MS: number;
    pausedFlipAnimations: WeakMap<Element, Animation>;
    initializeUiDialog22: () => void;
  }
}

export function installUiDialog2(runtime: RuntimeBindings): () => void {
  var noopFlipCleanup: () => void;
  var FLIP_HELD_MARKER: string;
  var FLIP_PAUSE_DURATION_MS: number;
  var pausedFlipAnimations: WeakMap<Element, Animation>;
  var initializeUiDialog22: () => void;
  function animateSegmentedControlThumb(
    input: HTMLElement,
    options: HTMLElement,
    context: SegmentBounds | null,
    { correction: value = false }: SegmentThumbOptions = {},
  ): () => void {
    if (context === null || context.width <= 0) {
      let value9 = getElementAnimations(input);
      return () => {
        cancelAnimations(value9);
        input.style.visibility = "";
        input.style.willChange = "";
        delete input.dataset.flipAt;
      };
    }
    let value2 = `${context.left},${context.width}`,
      flipAt = input.dataset.flipAt;
    if (flipAt === value2) {
      return noopFlipCleanup;
    }
    let bounds = input.getBoundingClientRect(),
      left = options.getBoundingClientRect().left,
      value3 = getComputedStyle(input),
      value4 = readCssDuration(value3, "--cds-dur-base"),
      value5 =
        value3.getPropertyValue("--cds-ease-snap").trim() || "linear",
      value6 = usesAlphaBackground(value3),
      value7 = value && !hasRunningAnimations(input),
      value8 = getElementAnimations(input);
    return () => {
      cancelAnimations(value8);
      input.dataset.flipAt = value2;
      input.style.width = `${context.width}px`;
      input.style.transform = `translateX(${context.left}px)`;
      input.style.visibility = "inherit";
      if (!value6) {
        input.style.willChange = "";
      }
      if (
        flipAt === undefined ||
        !supportsElementAnimations(input) ||
        (0, runtime.isReducedMotion)()
      ) {
        return;
      }
      if (value7) {
        return;
      }
      try {
        input.animate(
          {
            transform: [
              `translateX(${bounds.left - left}px) scaleX(${bounds.width / context.width})`,
              `translateX(${context.left}px) scaleX(1)`,
            ],
          },
          {
            duration: value4,
            easing: value5,
          },
        );
        if (value4 > 0) {
          setTransformWillChange(input, value6);
        }
      } catch {}
    };
  }
  function readCssDuration(input: CSSStyleDeclaration, options: string): number {
    let value = input.getPropertyValue(options).trim(),
      value2 = value.endsWith("ms")
        ? 1
        : value.endsWith("s")
          ? 1000
          : 0;
    return Math.max(0, parseFloat(value) * value2) || 0;
  }
  function supportsElementAnimations(input: Element): boolean {
    return (
      typeof input.animate === "function" &&
      typeof input.getAnimations === "function"
    );
  }
  function usesAlphaBackground(input: CSSStyleDeclaration): boolean {
    return /^rgba\(|\//.test(input.backgroundColor);
  }
  function setTransformWillChange(input: HTMLElement, options: boolean): void {
    input.style.willChange = options ? "transform" : "";
  }
  function hasRunningAnimations(input: Element): boolean {
    return (
      supportsElementAnimations(input) &&
      input
        .getAnimations()
        .some((input2): boolean => input2.playState === "running")
    );
  }
  function getElementAnimations(input: Element): Animation[] {
    if (supportsElementAnimations(input)) {
      return input.getAnimations();
    } else {
      return [];
    }
  }
  function cancelAnimations(input: Iterable<Animation>): void {
    for (let value of input) value.cancel();
  }
  function hasFlipAnimationMarker(input: HTMLElement): boolean {
    return input.dataset.flipAt !== undefined;
  }
  function pauseFlipAnimationAtProgress(
    input: HTMLElement,
    options: number,
    context: () => SegmentBounds[],
  ): void {
    if (
      !Number.isFinite(options) ||
      !hasFlipAnimationMarker(input) ||
      !supportsElementAnimations(input)
    ) {
      return;
    }
    let entry = pausedFlipAnimations.get(input);
    if (entry?.playState !== "paused") {
      let value = context();
      if (
        value.length < 2 ||
        value.some((input2): boolean => input2.width <= 0)
      ) {
        return;
      }
      let value2 = parseFloat(input.style.width),
        value3 = usesAlphaBackground(getComputedStyle(input));
      entry = input.animate(
        value.map(
          (input2) => ({
            transform: `translateX(${input2.left}px) scaleX(${input2.width / value2})`,
          }),
        ),
        {
          duration: (value.length - 1) * FLIP_PAUSE_DURATION_MS,
          fill: "both",
        },
      );
      entry.pause();
      setTransformWillChange(input, value3);
      pausedFlipAnimations.set(input, entry);
      input.dataset.flipAt = FLIP_HELD_MARKER;
    }
    entry.currentTime = options * FLIP_PAUSE_DURATION_MS;
  }
  function isImmediateFlipMarker(input: HTMLElement): boolean {
    return input.dataset.flipAt === FLIP_HELD_MARKER;
  }
  bindRuntimeValue(
    runtime,
    "animateSegmentedControlThumb",
    () => animateSegmentedControlThumb,
  );
  bindRuntimeValue(runtime, "readCssDuration", () => readCssDuration);
  bindRuntimeValue(
    runtime,
    "supportsElementAnimations",
    () => supportsElementAnimations,
  );
  bindRuntimeValue(runtime, "usesAlphaBackground", () => usesAlphaBackground);
  bindRuntimeValue(
    runtime,
    "setTransformWillChange",
    () => setTransformWillChange,
  );
  bindRuntimeValue(runtime, "hasRunningAnimations", () => hasRunningAnimations);
  bindRuntimeValue(runtime, "getElementAnimations", () => getElementAnimations);
  bindRuntimeValue(runtime, "cancelAnimations", () => cancelAnimations);
  bindRuntimeValue(
    runtime,
    "hasFlipAnimationMarker",
    () => hasFlipAnimationMarker,
  );
  bindRuntimeValue(
    runtime,
    "pauseFlipAnimationAtProgress",
    () => pauseFlipAnimationAtProgress,
  );
  bindRuntimeValue(
    runtime,
    "isImmediateFlipMarker",
    () => isImmediateFlipMarker,
  );
  bindRuntimeValue(
    runtime,
    "noopFlipCleanup",
    () => noopFlipCleanup,
    (value) => {
      noopFlipCleanup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FLIP_HELD_MARKER",
    () => FLIP_HELD_MARKER,
    (value) => {
      FLIP_HELD_MARKER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FLIP_PAUSE_DURATION_MS",
    () => FLIP_PAUSE_DURATION_MS,
    (value) => {
      FLIP_PAUSE_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pausedFlipAnimations",
    () => pausedFlipAnimations,
    (value) => {
      pausedFlipAnimations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiDialog22",
    () => initializeUiDialog22,
    (value) => {
      initializeUiDialog22 = value;
    },
  );
  return () => {
    noopFlipCleanup = () => {
      return;
    };
    FLIP_HELD_MARKER = "held";
    FLIP_PAUSE_DURATION_MS = 1000;
    initializeUiDialog22 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeReducedMotion)();
      pausedFlipAnimations = new WeakMap();
    });
  };
}

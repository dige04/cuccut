import type { FlipGeometry, FlipIndicatorState } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsSwitchContext(runtime: RuntimeBindings): () => void {
  var HeldValue: string;
  var SwitchContextConstant: number;
  var SwitchContextElementCache: WeakMap<HTMLElement, Animation>;
  var initializeSwitchContext: () => void;
  var reactSwitchContext: typeof React;
  var FlipIndicatorContext: React.Context<FlipIndicatorState | null>;
  var CdsStashedAttribute: string;
  var TabsMenuTriggerValue: string;
  var TabsMenuLabelValue: string;
  var initializeSwitchContext_2: () => void;
  function animateFlipIndicator(
    input: HTMLElement,
    options: Element,
    context: FlipGeometry | null,
    {
      correction: value = false,
    }: {
      correction?: boolean;
    } = {},
  ): void {
    if (context === null || context.width <= 0) {
      cancelElementAnimations(input);
      input.style.visibility = "";
      input.style.willChange = "";
      delete input.dataset.flipAt;
      return;
    }
    let value2 = `${context.left},${context.width}`,
      flipAt = input.dataset.flipAt;
    if (flipAt === value2) return;
    let bounds = input.getBoundingClientRect(),
      left = options.getBoundingClientRect().left,
      value3 = getComputedStyle(input),
      value4 = cssTimeMilliseconds(value3, "--cds-dur-base"),
      value5 = value3.getPropertyValue("--cds-ease-snap").trim() || "linear",
      value6 = backgroundHasAlpha(value3),
      value7 = value && !hasRunningAnimations(input);
    cancelElementAnimations(input);
    input.dataset.flipAt = value2;
    input.style.width = `${context.width}px`;
    input.style.transform = `translateX(${context.left}px)`;
    input.style.visibility = "inherit";
    value6 || (input.style.willChange = "");
    if (
      !(
        flipAt === undefined ||
        !supportsElementAnimations(input) ||
        (0, runtime.prefersReducedMotion)()
      ) &&
      !value7
    )
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
        value4 > 0 && setTransformWillChange(input, value6);
      } catch {}
  }
  function cssTimeMilliseconds(
    input: CSSStyleDeclaration,
    options: string,
  ): number {
    let value = input.getPropertyValue(options).trim(),
      value2 = value.endsWith("ms") ? 1 : value.endsWith("s") ? 1e3 : 0;
    return Math.max(0, parseFloat(value) * value2) || 0;
  }
  function supportsElementAnimations(input: Element): boolean {
    return (
      typeof input.animate == "function" &&
      typeof input.getAnimations == "function"
    );
  }
  function backgroundHasAlpha(input: CSSStyleDeclaration): boolean {
    return /^rgba\(|\//.test(input.backgroundColor);
  }
  function setTransformWillChange(input: HTMLElement, options: boolean): void {
    input.style.willChange = options ? "transform" : "";
  }
  function hasRunningAnimations(input: Element): boolean {
    return (
      supportsElementAnimations(input) &&
      input.getAnimations().some((input2) => input2.playState === "running")
    );
  }
  function cancelElementAnimations(input: Element): void {
    if (supportsElementAnimations(input))
      for (let value of input.getAnimations()) value.cancel();
  }
  function hasFlipAnimation(input: HTMLElement): boolean {
    return input.dataset.flipAt !== undefined;
  }
  function seekFlipAnimation(
    input: HTMLElement,
    options: number,
    context: () => readonly FlipGeometry[],
  ): void {
    if (
      !Number.isFinite(options) ||
      !hasFlipAnimation(input) ||
      !supportsElementAnimations(input)
    )
      return;
    let entry = SwitchContextElementCache.get(input);
    if (entry?.playState !== "paused") {
      let value = context();
      if (value.length < 2 || value.some((input2) => input2.width <= 0)) return;
      let value2 = parseFloat(input.style.width),
        value3 = backgroundHasAlpha(getComputedStyle(input));
      entry = input.animate(
        value.map((input2) => ({
          transform: `translateX(${input2.left}px) scaleX(${input2.width / value2})`,
        })),
        {
          duration: (value.length - 1) * SwitchContextConstant,
          fill: "both",
        },
      );
      entry.pause();
      setTransformWillChange(input, value3);
      SwitchContextElementCache.set(input, entry);
      input.dataset.flipAt = HeldValue;
    }
    entry.currentTime = options * SwitchContextConstant;
  }
  function isFlipIndicatorEntering(input: HTMLElement): boolean {
    return input.dataset.flipAt === HeldValue;
  }
  function useFlipIndicatorContext(): FlipIndicatorState | null {
    return (0, reactSwitchContext.useContext)(FlipIndicatorContext);
  }
  function preventRepeatedEnter(
    event: Pick<React.KeyboardEvent, "repeat" | "key" | "preventDefault">,
  ): void {
    event.repeat && event.key === "Enter" && event.preventDefault();
  }
  bindRuntimeValue(runtime, "animateFlipIndicator", () => animateFlipIndicator);
  bindRuntimeValue(runtime, "cssTimeMilliseconds", () => cssTimeMilliseconds);
  bindRuntimeValue(
    runtime,
    "supportsElementAnimations",
    () => supportsElementAnimations,
  );
  bindRuntimeValue(runtime, "backgroundHasAlpha", () => backgroundHasAlpha);
  bindRuntimeValue(
    runtime,
    "setTransformWillChange",
    () => setTransformWillChange,
  );
  bindRuntimeValue(runtime, "hasRunningAnimations", () => hasRunningAnimations);
  bindRuntimeValue(
    runtime,
    "cancelElementAnimations",
    () => cancelElementAnimations,
  );
  bindRuntimeValue(runtime, "hasFlipAnimation", () => hasFlipAnimation);
  bindRuntimeValue(runtime, "seekFlipAnimation", () => seekFlipAnimation);
  bindRuntimeValue(
    runtime,
    "isFlipIndicatorEntering",
    () => isFlipIndicatorEntering,
  );
  bindRuntimeValue(
    runtime,
    "HeldValue",
    () => HeldValue,
    (value) => {
      HeldValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SwitchContextConstant",
    () => SwitchContextConstant,
    (value) => {
      SwitchContextConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SwitchContextElementCache",
    () => SwitchContextElementCache,
    (value) => {
      SwitchContextElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSwitchContext",
    () => initializeSwitchContext,
    (value) => {
      initializeSwitchContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useFlipIndicatorContext",
    () => useFlipIndicatorContext,
  );
  bindRuntimeValue(
    runtime,
    "reactSwitchContext",
    () => reactSwitchContext,
    (value) => {
      reactSwitchContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FlipIndicatorContext",
    () => FlipIndicatorContext,
    (value) => {
      FlipIndicatorContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsStashedAttribute",
    () => CdsStashedAttribute,
    (value) => {
      CdsStashedAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsMenuTriggerValue",
    () => TabsMenuTriggerValue,
    (value) => {
      TabsMenuTriggerValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TabsMenuLabelValue",
    () => TabsMenuLabelValue,
    (value) => {
      TabsMenuLabelValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSwitchContext_2",
    () => initializeSwitchContext_2,
    (value) => {
      initializeSwitchContext_2 = value;
    },
  );
  bindRuntimeValue(runtime, "preventRepeatedEnter", () => preventRepeatedEnter);
  return () => {
    initializeSwitchContext = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializePlatformReducedMotion)();
      HeldValue = "held";
      SwitchContextConstant = 1e3;
      SwitchContextElementCache = new WeakMap();
    });
    initializeSwitchContext_2 = (0, runtime.initializeOnce)(() => {
      "use client";

      reactSwitchContext = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      FlipIndicatorContext = (0,
      reactSwitchContext.createContext)<FlipIndicatorState | null>(null);
      CdsStashedAttribute = "data-cds-stashed";
      TabsMenuTriggerValue = "tabs-menu-trigger";
      TabsMenuLabelValue = "tabs-menu-label";
    });
  };
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { StyleBag } from "../deck-contracts";
import type {
  CssDeclarations,
  StyleAnimationKeyframes,
  StyleNodeKind,
} from "../model/style-schema";

/** An element that may carry an inline `style` (HTML and SVG elements do). */
export type InlineStyledElement = Element & Partial<ElementCSSInlineStyle>;
/** The style bag behind an animated element, with the node kind its properties are validated for. */
export interface ElementStyleSource {
  bag: StyleBag;
  kind: StyleNodeKind;
}
export interface SlideAnimationEngineOptions {
  /** Element whose subtree is animated. */
  root: Element;
  /** Finds the style source of an element that carries the dynamic-style attribute. */
  resolveBag(element: Element): ElementStyleSource | null | undefined;
}
export interface SlideAnimationEngine {
  /** Re-reads the styles of the subtree and restarts animations whose descriptor changed. */
  refresh: () => void;
  dispose: () => void;
}
/** A running web animation with the descriptor it was started from. */
interface ElementAnimation {
  key: string;
  spec: StyleAnimationKeyframes;
  anim: Animation | undefined;
}
/** The hover style currently applied to an element's inline style, and how to undo it. */
interface AppliedHoverStyle {
  el: Element;
  style: CSSStyleDeclaration;
  /** The element's `style` attribute before the hover style (null when it had none). */
  saved: string | null;
  /** Property values as they read right after the hover style was set. */
  applied: Map<string, string>;
  appliedText: string | null;
  cssKey: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    REDUCED_MOTION_MEDIA_QUERY: string;
    HOVER_CAPABILITY_MEDIA_QUERY: string;
    camelCaseToCssProperty: (name: string) => string;
    getElementInlineStyle: (
      element: InlineStyledElement,
    ) => CSSStyleDeclaration | undefined;
    collectAnimatedElements: (root: Element) => Element[];
    closestAnimatedElement: (
      target: EventTarget | null | undefined,
      root: Element,
    ) => Element | undefined;
    animationDescriptorKey: (descriptor: StyleAnimationKeyframes) => string;
    isRepeatingAnimation: (descriptor: StyleAnimationKeyframes) => boolean;
    cancelElementAnimation: (animation: Animation | undefined) => void;
    /** Inline-style values saved per element while a hover style is applied to it. */
    animationEnginesByRoot: WeakMap<Element, Record<string, string>>;
    createSlideAnimationEngine: (
      options: SlideAnimationEngineOptions,
    ) => SlideAnimationEngine;
  }
}

export function installPresentationAnimationEngine(
  runtime: RuntimeBindings,
): () => void {
  var REDUCED_MOTION_MEDIA_QUERY: RuntimeBindings["REDUCED_MOTION_MEDIA_QUERY"];
  var HOVER_CAPABILITY_MEDIA_QUERY: RuntimeBindings["HOVER_CAPABILITY_MEDIA_QUERY"];
  var animationEnginesByRoot: RuntimeBindings["animationEnginesByRoot"];
  function camelCaseToCssProperty(name: string): string {
    return name.replace(/[A-Z]/g, (input) => "-" + input.toLowerCase());
  }
  function getElementInlineStyle(
    element: InlineStyledElement,
  ): CSSStyleDeclaration | undefined {
    let style = element.style;
    if (!style || typeof style.setProperty !== "function") {
      return;
    }
    return style;
  }
  function collectAnimatedElements(root: Element): Element[] {
    let animated: Element[] = [],
      stack: Element[] = [root];
    while (stack.length > 0) {
      let value = stack.pop();
      if (!value) {
        break;
      }
      if (value.hasAttribute(runtime.dynamicStyleAttribute)) {
        animated.push(value);
      }
      for (let value2 = value.children.length - 1; value2 >= 0; value2--) {
        let value3 = value.children.item(value2);
        if (value3) {
          stack.push(value3);
        }
      }
    }
    return animated;
  }
  function closestAnimatedElement(
    target: EventTarget | null | undefined,
    root: Element,
  ): Element | undefined {
    let node = (target ?? null) as Node | null,
      element: Element | null = null;
    if (node) {
      element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    }
    for (; element; element = element.parentElement) {
      if (element.hasAttribute(runtime.dynamicStyleAttribute)) {
        return element;
      }
      if (element === root) {
        break;
      }
    }
    return;
  }
  function animationDescriptorKey(descriptor: StyleAnimationKeyframes): string {
    return JSON.stringify(descriptor);
  }
  function isRepeatingAnimation(descriptor: StyleAnimationKeyframes): boolean {
    return descriptor.options.iterations !== 1;
  }
  function cancelElementAnimation(animation: Animation | undefined): void {
    if (!animation) {
      return;
    }
    try {
      animation.cancel();
    } catch {}
  }
  function createSlideAnimationEngine(
    options: SlideAnimationEngineOptions,
  ): SlideAnimationEngine {
    let { root: root } = options,
      document2 = root.ownerDocument,
      window2 = document2.defaultView,
      animations = new Map<Element, ElementAnimation>(),
      value: AppliedHoverStyle | undefined,
      flag = false;
    function value2(input: string): MediaQueryList | undefined {
      if (!window2 || typeof window2.matchMedia !== "function") {
        return;
      }
      try {
        return window2.matchMedia(input);
      } catch {
        return;
      }
    }
    let value3 = value2(REDUCED_MOTION_MEDIA_QUERY),
      value4 = value2(HOVER_CAPABILITY_MEDIA_QUERY),
      value5 = value3?.matches ?? false;
    function value6(
      input: Element,
      options2: StyleAnimationKeyframes,
    ): Animation | undefined {
      if (value5 && isRepeatingAnimation(options2)) {
        return;
      }
      if (typeof input.animate !== "function") {
        return;
      }
      let items: Keyframe[] = [];
      for (let value16 of options2.keyframes)
        items.push(Object.fromEntries(Object.entries(value16)));
      let options3 = options2.options,
        state: KeyframeAnimationOptions = {
          duration: options3.duration,
          delay: options3.delay,
          iterations: options3.iterations,
          direction:
            options3.direction === "reverse" ||
            options3.direction === "alternate"
              ? options3.direction
              : "normal",
          easing: options3.easing,
        };
      try {
        return input.animate(items, state);
      } catch {
        return;
      }
    }
    function value7(): void {
      let values = new Set<Element>();
      for (let value16 of collectAnimatedElements(root)) {
        let value17 = options.resolveBag(value16);
        if (!value17) {
          continue;
        }
        let value18: StyleAnimationKeyframes | undefined;
        try {
          value18 = (0, runtime.styleAnimationToKeyframes)(
            value17.bag,
            value17.kind,
          );
        } catch {
          continue;
        }
        if (!value18) {
          continue;
        }
        values.add(value16);
        let value19 = animationDescriptorKey(value18),
          entry = animations.get(value16);
        if (entry && entry.key === value19) {
          continue;
        }
        cancelElementAnimation(entry?.anim);
        animations.set(value16, {
          key: value19,
          spec: value18,
          anim: value6(value16, value18),
        });
      }
      for (let [value16, value17] of animations) {
        if (values.has(value16)) {
          continue;
        }
        cancelElementAnimation(value17.anim);
        animations.delete(value16);
      }
    }
    function value8(): void {
      for (let [value16, value17] of animations) {
        let value18 = value5 && isRepeatingAnimation(value17.spec);
        if (value18 && value17.anim) {
          cancelElementAnimation(value17.anim);
          value17.anim = undefined;
        } else if (!value18 && !value17.anim) {
          value17.anim = value6(value16, value17.spec);
        }
      }
    }
    let callback = (): void => {
      value5 = value3?.matches ?? false;
      value8();
    };
    function value9(
      input: StyleBag,
      options2: StyleNodeKind | undefined,
    ): [string, string][] {
      let value16: CssDeclarations | undefined;
      try {
        value16 = (0, runtime.hoverStyleToCss)(input, options2);
      } catch {
        return [];
      }
      if (value16 === null || typeof value16 !== "object") {
        return [];
      }
      let items: [string, string][] = [];
      for (let [value17, value18] of Object.entries(value16))
        if (typeof value18 === "string" || typeof value18 === "number") {
          items.push([camelCaseToCssProperty(value17), String(value18)]);
        }
      return items;
    }
    function value10(input: [string, string][]): string {
      return input.map((input2) => input2[0] + ":" + input2[1]).join(";");
    }
    function value11(
      element: Element,
      options2: CSSStyleDeclaration,
      context: string | null,
      value16: [string, string][],
    ): void {
      let entries = new Map<string, string>(),
        state: Record<string, string> = {};
      for (let [value17, value18] of value16) {
        state[value17] = options2.getPropertyValue(value17);
        options2.setProperty(value17, value18);
        entries.set(value17, options2.getPropertyValue(value17));
      }
      animationEnginesByRoot.set(element, state);
      value = {
        el: element,
        style: options2,
        saved: context,
        applied: entries,
        appliedText: element.getAttribute("style"),
        cssKey: value10(value16),
      };
    }
    function value12(element: Element, source: ElementStyleSource): void {
      let value16 = getElementInlineStyle(element);
      if (!value16) {
        return;
      }
      let value17 = value9(source.bag, source.kind);
      if (value17.length === 0) {
        return;
      }
      value11(element, value16, element.getAttribute("style"), value17);
    }
    function value13(): void {
      let value16 = value;
      if (!value16) {
        return;
      }
      value = undefined;
      animationEnginesByRoot.delete(value16.el);
      if (value16.saved === null) {
        value16.el.removeAttribute("style");
      } else {
        value16.el.setAttribute("style", value16.saved);
      }
    }
    function value14(): void {
      let value16 = value;
      if (!value16) {
        return;
      }
      if (!value16.el.isConnected || !root.contains(value16.el)) {
        animationEnginesByRoot.delete(value16.el);
        value = undefined;
        return;
      }
      let value17 = value16.el.hasAttribute(runtime.dynamicStyleAttribute)
        ? options.resolveBag(value16.el)
        : undefined;
      if (!value17) {
        value13();
        return;
      }
      let value18 = value9(value17.bag, value17.kind),
        value19: string | null;
      if (value16.el.getAttribute("style") === value16.appliedText) {
        if (value10(value18) === value16.cssKey) {
          return;
        }
        if (value16.saved === null) {
          value16.el.removeAttribute("style");
        } else {
          value16.el.setAttribute("style", value16.saved);
        }
        value19 = value16.saved;
      } else {
        for (let [value20, value21] of value16.applied)
          if (value16.style.getPropertyValue(value20) === value21) {
            value16.style.removeProperty(value20);
          }
        value19 = value16.el.getAttribute("style");
      }
      value = undefined;
      if (value18.length === 0) {
        animationEnginesByRoot.delete(value16.el);
        return;
      }
      value11(value16.el, value16.style, value19, value18);
    }
    function value15(input: Event): boolean {
      let value16 = "pointerType" in input ? String(input.pointerType) : "";
      if (value16 === "mouse") {
        return true;
      }
      return value16 === "" && (value4?.matches ?? false);
    }
    let callback2 = (event: Event): void => {
        if (!value15(event)) {
          return;
        }
        let value16 = closestAnimatedElement(event.target, root);
        if (value) {
          if (value16 && value16 === value.el) {
            return;
          }
          value13();
        }
        if (!value16) {
          return;
        }
        let value17 = options.resolveBag(value16);
        if (value17) {
          value12(value16, value17);
        }
      },
      callback3 = (input: Event): void => {
        let value16 = value;
        if (!value16) {
          return;
        }
        let value17 = "relatedTarget" in input ? input.relatedTarget : null;
        if (value17 && value16.el.contains(value17 as Node)) {
          return;
        }
        value13();
      },
      callback4 = (): void => {
        value13();
      };
    root.addEventListener("pointerover", callback2);
    root.addEventListener("pointerout", callback3);
    root.addEventListener("pointercancel", callback4);
    document2.addEventListener("pointerleave", callback4);
    window2?.addEventListener("blur", callback4);
    if (value3 && typeof value3.addEventListener === "function") {
      value3.addEventListener("change", callback);
    }
    let callback5 = (): void => {
        if (flag) {
          return;
        }
        value7();
        value14();
      },
      callback6 = (): void => {
        if (flag) {
          return;
        }
        flag = true;
        for (let value16 of animations.values())
          cancelElementAnimation(value16.anim);
        animations.clear();
        value13();
        root.removeEventListener("pointerover", callback2);
        root.removeEventListener("pointerout", callback3);
        root.removeEventListener("pointercancel", callback4);
        document2.removeEventListener("pointerleave", callback4);
        window2?.removeEventListener("blur", callback4);
        if (value3 && typeof value3.removeEventListener === "function") {
          value3.removeEventListener("change", callback);
        }
      };
    callback5();
    return {
      refresh: callback5,
      dispose: callback6,
    };
  }
  bindRuntimeValue(
    runtime,
    "REDUCED_MOTION_MEDIA_QUERY",
    () => REDUCED_MOTION_MEDIA_QUERY,
    (value) => {
      REDUCED_MOTION_MEDIA_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOVER_CAPABILITY_MEDIA_QUERY",
    () => HOVER_CAPABILITY_MEDIA_QUERY,
    (value) => {
      HOVER_CAPABILITY_MEDIA_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "camelCaseToCssProperty",
    () => camelCaseToCssProperty,
  );
  bindRuntimeValue(
    runtime,
    "getElementInlineStyle",
    () => getElementInlineStyle,
  );
  bindRuntimeValue(
    runtime,
    "collectAnimatedElements",
    () => collectAnimatedElements,
  );
  bindRuntimeValue(
    runtime,
    "closestAnimatedElement",
    () => closestAnimatedElement,
  );
  bindRuntimeValue(
    runtime,
    "animationDescriptorKey",
    () => animationDescriptorKey,
  );
  bindRuntimeValue(runtime, "isRepeatingAnimation", () => isRepeatingAnimation);
  bindRuntimeValue(
    runtime,
    "cancelElementAnimation",
    () => cancelElementAnimation,
  );
  bindRuntimeValue(
    runtime,
    "animationEnginesByRoot",
    () => animationEnginesByRoot,
    (value) => {
      animationEnginesByRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSlideAnimationEngine",
    () => createSlideAnimationEngine,
  );
  return () => {
    (0, runtime.initializeStyleSchema)();
    REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
    HOVER_CAPABILITY_MEDIA_QUERY = "(hover: hover)";
    animationEnginesByRoot = new WeakMap();
  };
}

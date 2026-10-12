/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** A part of the editor that F6 moves keyboard focus into. */
export interface FocusRegion {
  /** The region's root element; null or undefined while the region is not showing. */
  el(): Element | null | undefined;
  /** The region F6 returns to when the focus is outside every region. */
  home?: boolean;
  /** Focuses the region itself; true when it took the focus. */
  enter?(): boolean;
  /** The element to focus when no earlier focus is remembered in the region. */
  fallback?(): Element | null | undefined;
  /** True when the region handles F6 itself, so the key must not reach others. */
  ownsKey?: boolean;
}
/** A region that is showing, with its root element. */
interface ActiveFocusRegion {
  region: FocusRegion;
  el: Element;
}
export interface RegionKeyboardNavigatorOptions {
  /** True while something else (a dialog, a menu) owns the keyboard. */
  blocked?: () => boolean;
  /** True when an element is visible enough to take focus. */
  rendered?: (element: Element) => boolean;
}
/** F6 navigation between focus regions. */
export interface RegionKeyboardNavigator {
  /** Moves focus to the next (1) or previous (-1) region; true when it moved. */
  move(direction: number): boolean;
  /** Removes the keyboard listeners. */
  dispose(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactFocusRegions: ReactNamespace;
    FOCUS_REGION_FOCUSABLE_SELECTOR: string;
    notificationsFocusRegion: () => FocusRegion;
    isFocusableInRegion: (
      element: Element,
      isRendered: (element: Element) => boolean,
    ) => boolean;
    createRegionKeyboardNavigator: (
      regions: () => FocusRegion[],
      options?: RegionKeyboardNavigatorOptions,
    ) => RegionKeyboardNavigator;
    useRegionKeyboardNavigation: (
      regions: FocusRegion[],
      blocked?: () => boolean,
    ) => void;
  }
}

export function installEditorFocusRegions(
  runtime: RuntimeBindings,
): () => void {
  var ReactFocusRegions: ReactNamespace;
  var FOCUS_REGION_FOCUSABLE_SELECTOR: RuntimeBindings["FOCUS_REGION_FOCUSABLE_SELECTOR"];
  function notificationsFocusRegion(): FocusRegion {
    return {
      el: (): Element | null => {
        let element = document.querySelector(
          '[role="region"][aria-label="Notifications"]',
        );
        if (element !== null && element.childElementCount > 0) {
          return element;
        } else {
          return null;
        }
      },
      ownsKey: true,
    };
  }
  function isFocusableInRegion(
    element: Element,
    isRendered: (element: Element) => boolean,
  ): boolean {
    return (
      element.isConnected &&
      element.matches(FOCUS_REGION_FOCUSABLE_SELECTOR) &&
      element.closest('[inert], [hidden], [aria-hidden="true"]') == null &&
      isRendered(element)
    );
  }
  function createRegionKeyboardNavigator(
    regions: () => FocusRegion[],
    {
      blocked = (): boolean => (0, runtime.hasOpenOverlay)(),
      rendered = (input: Element): boolean =>
        input.getClientRects().length > 0,
    }: RegionKeyboardNavigatorOptions = {},
  ): RegionKeyboardNavigator {
    let cache = new WeakMap<Element, Element | null>(),
      callback = (): ActiveFocusRegion[] =>
        regions().flatMap((input: FocusRegion): ActiveFocusRegion[] => {
          let value = input.el();
          if (value && value.isConnected) {
            return [
              {
                region: input,
                el: value,
              },
            ];
          } else {
            return [];
          }
        }),
      callback2 = (
        input: ActiveFocusRegion[],
        options: Element | null,
      ): number => {
        if (!(options instanceof HTMLElement)) {
          return -1;
        }
        let value = -1;
        input.forEach((input2: ActiveFocusRegion, options2: number): void => {
          if (
            input2.el.contains(options) &&
            (value === -1 || input[value]!.el.contains(input2.el))
          ) {
            value = options2;
          }
        });
        return value;
      },
      callback3 = (input: ActiveFocusRegion[]): number =>
        callback2(input, document.activeElement),
      callback4 = (
        input: ActiveFocusRegion[],
        options: ActiveFocusRegion,
      ): boolean => {
        if (options.region.enter?.() === true) {
          return true;
        }
        let value = input.filter(
            (input2: ActiveFocusRegion): boolean =>
              input2 !== options && options.el.contains(input2.el),
          ),
          entry = cache.get(options.el),
          items: (Element | null)[] = [
            entry && options.el.contains(entry) ? entry : null,
            options.region.fallback?.() ?? null,
            ...Array.from(
              options.el.querySelectorAll(FOCUS_REGION_FOCUSABLE_SELECTOR),
            ),
          ];
        for (let value2 of items) {
          if (
            !value2 ||
            value2 === options.el ||
            value.some((input2: ActiveFocusRegion): boolean =>
              input2.el.contains(value2),
            ) ||
            !isFocusableInRegion(value2, rendered)
          ) {
            continue;
          }
          (value2 as HTMLElement).focus();
          if (document.activeElement === value2) {
            return true;
          }
        }
        return false;
      },
      callback5 = (
        input: number,
        options: boolean,
      ): boolean | "owner" | "moved" => {
        if (blocked()) {
          return false;
        }
        let value = callback(),
          length = value.length;
        if (length === 0) {
          return false;
        }
        let value2 = callback3(value),
          value3 =
            value2 !== -1
              ? value2
              : value.findIndex(
                  (input2: ActiveFocusRegion): boolean | undefined =>
                    input2.region.home,
                );
        for (let count = 1; count <= length; count++) {
          let value4 = (((value3 + input * count) % length) + length) % length;
          if (value4 === value2) {
            continue;
          }
          let value5 = value[value4]!;
          if (value5.region.ownsKey === true) {
            if (!options) {
              continue;
            }
            return "owner";
          }
          if (callback4(value, value5)) {
            return "moved";
          }
        }
        return false;
      },
      callback6 = (input: number): boolean =>
        callback5(input, false) === "moved",
      callback7 = (event: FocusEvent): void => {
        let value = callback(),
          value2 = event.target instanceof Element ? event.target : null,
          value3 = callback2(value, value2);
        if (value3 !== -1 && value2 !== value[value3]!.el) {
          cache.set(value[value3]!.el, value2);
        }
      },
      callback8 = (event: KeyboardEvent): void => {
        if (
          event.key !== "F6" ||
          event.defaultPrevented ||
          event.isComposing ||
          event.altKey ||
          blocked()
        ) {
          return;
        }
        let value = event.repeat
          ? false
          : callback5(event.shiftKey ? -1 : 1, true);
        event.preventDefault();
        if (value === "owner") {
          return;
        }
        if (
          callback().some(
            (input: ActiveFocusRegion): boolean | undefined =>
              input.region.ownsKey,
          )
        ) {
          event.stopPropagation();
        }
      };
    document.addEventListener("focusin", callback7);
    window.addEventListener("keydown", callback8, true);
    return {
      move: callback6,
      dispose(): void {
        document.removeEventListener("focusin", callback7);
        window.removeEventListener("keydown", callback8, true);
      },
    };
  }
  function useRegionKeyboardNavigation(
    regions: FocusRegion[],
    blocked?: () => boolean,
  ): void {
    let ref = ReactFocusRegions.useRef(regions);
    ref.current = regions;
    let ref2 = ReactFocusRegions.useRef(blocked);
    ref2.current = blocked;
    ReactFocusRegions.useEffect(
      (): (() => void) =>
        createRegionKeyboardNavigator((): FocusRegion[] => ref.current, {
          blocked: (): boolean =>
            (0, runtime.hasOpenOverlay)() || (ref2.current?.() ?? false),
        }).dispose,
      [],
    );
  }
  bindRuntimeValue(
    runtime,
    "ReactFocusRegions",
    () => ReactFocusRegions,
    (value) => {
      ReactFocusRegions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FOCUS_REGION_FOCUSABLE_SELECTOR",
    () => FOCUS_REGION_FOCUSABLE_SELECTOR,
    (value) => {
      FOCUS_REGION_FOCUSABLE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notificationsFocusRegion",
    () => notificationsFocusRegion,
  );
  bindRuntimeValue(runtime, "isFocusableInRegion", () => isFocusableInRegion);
  bindRuntimeValue(
    runtime,
    "createRegionKeyboardNavigator",
    () => createRegionKeyboardNavigator,
  );
  bindRuntimeValue(
    runtime,
    "useRegionKeyboardNavigation",
    () => useRegionKeyboardNavigation,
  );
  return () => {
    ReactFocusRegions = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    FOCUS_REGION_FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"]):not(iframe)';
  };
}

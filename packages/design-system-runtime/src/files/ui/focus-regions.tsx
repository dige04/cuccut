/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type {
  FocusRegion,
  LiveFocusRegion,
  FocusRegionOptions,
  FocusRegionController,
} from "../../contracts/application";
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiFocusRegions(
  runtime: RuntimeBindings,
): () => void {
  var reactFocusRegions: typeof React;
  var FOCUS_REGION_FOCUSABLE_SELECTOR: string;
  var FOCUS_REGION_HINT_INTERVAL_MS: number;
  function focusRegionHint(
    name: string,
    shortcut: string = (0, runtime.formatCommandShortcut)("F6"),
  ) {
    return name + " page, press " + shortcut + " to focus it";
  }
  function notificationsFocusRegion(): FocusRegion {
    return {
      el: () => {
        let element = document.querySelector<HTMLElement>(
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
  function focusRegionElementIsVisible(
    element: HTMLElement,
    rendered: (element: HTMLElement) => boolean,
  ) {
    return (
      element.closest('[inert], [hidden], [aria-hidden="true"]') == null &&
      rendered(element)
    );
  }
  function isFocusableRegionElement(
    element: HTMLElement,
    rendered: (element: HTMLElement) => boolean,
  ) {
    return (
      element.matches(FOCUS_REGION_FOCUSABLE_SELECTOR) &&
      focusRegionElementIsVisible(element, rendered)
    );
  }
  function focusRegionSelf(element: HTMLElement): boolean {
    let oldTabIndex = element.getAttribute("tabindex");
    if (oldTabIndex === null) {
      element.setAttribute("tabindex", "-1");
    }
    element.focus();
    if (document.activeElement !== element) {
      if (oldTabIndex === null) {
        element.removeAttribute("tabindex");
      }
      return false;
    }
    if (oldTabIndex === null) {
      let callback = () => {
        if (document.activeElement === element) {
          return;
        }
        element.removeAttribute("tabindex");
        element.removeEventListener("blur", callback);
      };
      element.addEventListener("blur", callback);
    }
    return true;
  }
  function createFocusRegionController(
    regions: () => FocusRegion[],
    {
      blocked = () => (0, runtime.hasOpenOverlay)(),
      rendered = (input) => input.getClientRects().length > 0,
      say = runtime.announceLiveMessage,
      now = () => Date.now(),
    }: FocusRegionOptions = {},
  ): FocusRegionController {
    let lastFocusedByRegion = new WeakMap<HTMLElement, HTMLElement>(),
      liveRegions = (): LiveFocusRegion[] =>
        regions().flatMap((input) => {
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
      regionIndexContaining = (
        input: LiveFocusRegion[],
        options: Element | null,
      ) => {
        if (!(options instanceof HTMLElement)) {
          return -1;
        }
        let value = -1;
        input.forEach((input2, options2) => {
          if (
            input2.el.contains(options) &&
            (value === -1 || input[value].el.contains(input2.el))
          ) {
            value = options2;
          }
        });
        return value;
      },
      activeRegionIndex = (input: LiveFocusRegion[]) =>
        regionIndexContaining(input, document.activeElement),
      focusRegion = (input: LiveFocusRegion[], options: LiveFocusRegion) => {
        let value = input.filter(
            (input2) => input2 !== options && options.el.contains(input2.el),
          ),
          entry = lastFocusedByRegion.get(options.el),
          items = [
            entry && entry.isConnected && options.el.contains(entry)
              ? entry
              : null,
            options.region.fallback?.() ?? null,
            ...options.el.querySelectorAll<HTMLElement>(
              FOCUS_REGION_FOCUSABLE_SELECTOR,
            ),
          ];
        for (let value2 of items) {
          if (
            !value2 ||
            value2 === options.el ||
            value.some((input2) => input2.el.contains(value2)) ||
            !isFocusableRegionElement(value2, rendered)
          ) {
            continue;
          }
          value2.focus();
          if (document.activeElement === value2) {
            return true;
          }
        }
        return (
          options.region.landOnSelf === true &&
          focusRegionElementIsVisible(options.el, rendered) &&
          focusRegionSelf(options.el)
        );
      },
      hasMoved = false,
      lastHintAt = Number.NEGATIVE_INFINITY,
      moveAcrossRegions = (
        input: number,
        options: boolean,
      ): false | "owner" | "moved" => {
        if (blocked()) {
          return false;
        }
        let value = liveRegions(),
          length = value.length;
        if (length === 0) {
          return false;
        }
        let value2 = activeRegionIndex(value),
          value3 =
            value2 !== -1
              ? value2
              : value.findIndex((input2) => input2.region.home);
        for (let count = 1; count <= length; count++) {
          let value4 = (((value3 + input * count) % length) + length) % length;
          if (value4 === value2) {
            continue;
          }
          let value5 = value[value4];
          if (value5.region.ownsKey === true) {
            if (!options) {
              continue;
            }
            hasMoved = true;
            return "owner";
          }
          if (focusRegion(value, value5)) {
            hasMoved = true;
            return "moved";
          }
        }
        return false;
      },
      move = (input: number) => moveAcrossRegions(input, false) === "moved",
      hint = (input: string) => {
        if (hasMoved) {
          return;
        }
        let value = now();
        if (value - lastHintAt < FOCUS_REGION_HINT_INTERVAL_MS) {
          return;
        }
        lastHintAt = value;
        say(focusRegionHint(input));
      },
      rememberFocus = (event: FocusEvent) => {
        let value = liveRegions(),
          value2 = event.target instanceof Element ? event.target : null,
          value3 = regionIndexContaining(value, value2);
        if (value3 !== -1 && value2 !== value[value3].el) {
          lastFocusedByRegion.set(value[value3].el, value2 as HTMLElement);
        }
      },
      onKeyDown = (event: KeyboardEvent) => {
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
          : moveAcrossRegions(event.shiftKey ? -1 : 1, true);
        event.preventDefault();
        if (value === "owner") {
          return;
        }
        if (liveRegions().some((input) => input.region.ownsKey)) {
          event.stopPropagation();
        }
      };
    document.addEventListener("focusin", rememberFocus);
    window.addEventListener("keydown", onKeyDown, true);
    return {
      move: move,
      hint: hint,
      dispose() {
        document.removeEventListener("focusin", rememberFocus);
        window.removeEventListener("keydown", onKeyDown, true);
      },
    };
  }
  function useFocusRegions(regions: FocusRegion[]) {
    let regionsRef = reactFocusRegions.useRef(regions);
    regionsRef.current = regions;
    let controllerRef = reactFocusRegions.useRef<FocusRegionController | null>(
      null,
    );
    reactFocusRegions.useEffect(() => {
      let value = createFocusRegionController(() => regionsRef.current);
      controllerRef.current = value;
      return () => {
        value.dispose();
        controllerRef.current = null;
      };
    }, []);
    return reactFocusRegions.useMemo(
      () => ({
        hint: (input: string) => controllerRef.current?.hint(input),
      }),
      [],
    );
  }
  bindRuntimeValue(
    runtime,
    "reactFocusRegions",
    () => reactFocusRegions,
    (value) => {
      reactFocusRegions = value;
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
  bindRuntimeValue(runtime, "focusRegionHint", () => focusRegionHint);
  bindRuntimeValue(
    runtime,
    "FOCUS_REGION_HINT_INTERVAL_MS",
    () => FOCUS_REGION_HINT_INTERVAL_MS,
    (value) => {
      FOCUS_REGION_HINT_INTERVAL_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notificationsFocusRegion",
    () => notificationsFocusRegion,
  );
  bindRuntimeValue(
    runtime,
    "focusRegionElementIsVisible",
    () => focusRegionElementIsVisible,
  );
  bindRuntimeValue(
    runtime,
    "isFocusableRegionElement",
    () => isFocusableRegionElement,
  );
  bindRuntimeValue(runtime, "focusRegionSelf", () => focusRegionSelf);
  bindRuntimeValue(
    runtime,
    "createFocusRegionController",
    () => createFocusRegionController,
  );
  bindRuntimeValue(runtime, "useFocusRegions", () => useFocusRegions);
  return () => {
    reactFocusRegions = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    FOCUS_REGION_FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"]):not(iframe)';
    FOCUS_REGION_HINT_INTERVAL_MS = 120000;
  };
}

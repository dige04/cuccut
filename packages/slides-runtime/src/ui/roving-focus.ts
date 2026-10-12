/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/** How Tab moves through a roving group: one stop for the whole group, or each item in turn. */
export type RovingTabStops = "one" | "each";
export interface RovingKeyHandlerOptions {
  tabStops?: RovingTabStops;
}
/** Key event whose target is known to be an element of the roving group. */
type RovingKeyEvent = ReactKeyboardEvent<HTMLElement> & { target: HTMLElement };

declare module "../bindings" {
  interface RuntimeBindings {
    DEFAULT_ROVING_TAB_STOPS: RovingTabStops;
    ROVING_FOCUS_SELECTOR: string;
    ROVING_INPUT_TAG_PATTERN: RegExp;
    createRovingKeyHandler: (
      command: () => unknown,
      options?: RovingKeyHandlerOptions,
    ) => (event: ReactKeyboardEvent<HTMLElement>) => void;
    visibleRovingFocusElements: (container: ParentNode) => HTMLElement[];
  }
}

export function installUiRovingFocus(runtime: RuntimeBindings): () => void {
  var DEFAULT_ROVING_TAB_STOPS: RovingTabStops;
  var ROVING_FOCUS_SELECTOR: string;
  var ROVING_INPUT_TAG_PATTERN: RegExp;
  function createRovingKeyHandler(
    command: () => unknown,
    { tabStops: options = DEFAULT_ROVING_TAB_STOPS }: RovingKeyHandlerOptions = {},
  ): (event: ReactKeyboardEvent<HTMLElement>) => void {
    return (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }
      let { target: value, currentTarget: value2 } = event as RovingKeyEvent;
      if (!value2.contains(value) || (0, runtime.hasOpenOverlay)()) {
        return;
      }
      if (
        ROVING_INPUT_TAG_PATTERN.test(value.tagName) ||
        value.isContentEditable
      ) {
        return;
      }
      if (event.key === "Tab") {
        if (options === "each") {
          let value9 = visibleRovingFocusElements(value2),
            value10 = value9.findIndex(
              (input) =>
                input === value || input.contains(value),
            );
          if (
            !(event.shiftKey
              ? value10 <= 0
              : value10 === -1 || value10 >= value9.length - 1)
          ) {
            return;
          }
        }
        if (command()) {
          event.preventDefault();
        }
        return;
      }
      let value3 = event.key === "ArrowLeft",
        value4 = event.key === "ArrowRight";
      if (!value3 && !value4 && event.key !== "Home" && event.key !== "End") {
        return;
      }
      let value5 = visibleRovingFocusElements(value2);
      if (value5.length === 0) {
        return;
      }
      let value6 = value5.findIndex(
          (input) =>
            input === value || input.contains(value),
        ),
        value7 =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? value5.length - 1
              : value6 === -1
                ? 0
                : (value6 + (value4 ? 1 : -1) + value5.length) % value5.length;
      event.preventDefault();
      let value8 = value5[value7]!;
      value8.focus({
        preventScroll: true,
      });
      (0, runtime.scrollToolbarButtonIntoView)(value2, value8);
    };
  }
  function visibleRovingFocusElements(container: ParentNode): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(ROVING_FOCUS_SELECTOR),
    ).filter((input) => input.getClientRects().length > 0);
  }
  bindRuntimeValue(
    runtime,
    "DEFAULT_ROVING_TAB_STOPS",
    () => DEFAULT_ROVING_TAB_STOPS,
    (value) => {
      DEFAULT_ROVING_TAB_STOPS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROVING_FOCUS_SELECTOR",
    () => ROVING_FOCUS_SELECTOR,
    (value) => {
      ROVING_FOCUS_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ROVING_INPUT_TAG_PATTERN",
    () => ROVING_INPUT_TAG_PATTERN,
    (value) => {
      ROVING_INPUT_TAG_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createRovingKeyHandler",
    () => createRovingKeyHandler,
  );
  bindRuntimeValue(
    runtime,
    "visibleRovingFocusElements",
    () => visibleRovingFocusElements,
  );
  return () => {
    DEFAULT_ROVING_TAB_STOPS = "one";
    ROVING_FOCUS_SELECTOR =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    ROVING_INPUT_TAG_PATTERN = /^(INPUT|TEXTAREA|SELECT)$/;
  };
}

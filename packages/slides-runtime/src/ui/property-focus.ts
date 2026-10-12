/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";

/** Side of an anchor a popover or tooltip opens on. */
export type PopoverSide = "top" | "right" | "bottom" | "left";
/** Where a popover opens and how tall it may grow before it must scroll. */
export interface PopoverPlacement {
  side: PopoverSide;
  maxHeight: number | undefined;
}
/** Props that mark a popup as holding undo steps until the pointer is released. */
export interface HeldUndoPopupProps {
  onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => void;
  [attribute: string]: string | ((event: React.PointerEvent<HTMLElement>) => void);
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiPropertyFocus: ReactNamespace;
    anyMenuOrPopoverOpen: (page?: ParentNode) => boolean;
    hasOpenOverlay: (page?: ParentNode) => boolean;
    markHeldUndoPointer: (event: React.PointerEvent<HTMLElement>) => void;
    overlaysBlockUndo: (page?: ParentNode) => boolean;
    isOverlayClosed: (overlay: Element) => boolean;
    choosePopoverSide: (
      anchor: Element | null | undefined,
      expectedHeight: number,
      preferredSide?: PopoverSide,
      minimumHeight?: number,
    ) => PopoverPlacement;
    /** Selector matching every popover, menu, scrim and dialog. */
    OPEN_OVERLAY_SELECTOR: string;
    MENU_POPOVER_OPEN_SELECTORS: string;
    UNDO_STEPS_ATTRIBUTE: string;
    UNDO_STEPS_HELD_ATTRIBUTE: string;
    heldUndoPointerIds: WeakMap<Element, Set<number>>;
    pendingPopupFocusReturn: HeldUndoPopupProps;
    TEXT_EDITABLE_SELECTOR: string;
    popupPointerEvent: (event: React.KeyboardEvent) => void;
    ToolbarTooltipSideContext: React.Context<PopoverSide | undefined>;
    /** Milliseconds a popup waits before it hands focus back. */
    popupFocusReturnTimer: number;
    initializeUiPropertyFocus: () => void;
  }
}

export function installUiPropertyFocus(runtime: RuntimeBindings): () => void {
  var reactForUiPropertyFocus: ReactNamespace;
  var OPEN_OVERLAY_SELECTOR: string;
  var MENU_POPOVER_OPEN_SELECTORS: string;
  var UNDO_STEPS_ATTRIBUTE: string;
  var UNDO_STEPS_HELD_ATTRIBUTE: string;
  var heldUndoPointerIds: WeakMap<Element, Set<number>>;
  var pendingPopupFocusReturn: HeldUndoPopupProps;
  var TEXT_EDITABLE_SELECTOR: string;
  var popupPointerEvent: (event: React.KeyboardEvent) => void;
  var ToolbarTooltipSideContext: React.Context<PopoverSide | undefined>;
  var popupFocusReturnTimer: number;
  var initializeUiPropertyFocus: () => void;
  function anyMenuOrPopoverOpen(page: ParentNode = document): boolean {
    for (let value of page.querySelectorAll(
      MENU_POPOVER_OPEN_SELECTORS,
    ))
      if (value.hasAttribute("data-open")) {
        return true;
      }
    return false;
  }
  function hasOpenOverlay(input: ParentNode = document): boolean {
    for (let value of input.querySelectorAll(OPEN_OVERLAY_SELECTOR))
      if (!isOverlayClosed(value)) {
        return true;
      }
    return false;
  }
  function markHeldUndoPointer(input: React.PointerEvent<HTMLElement>): void {
    if (input.button !== 0) {
      return;
    }
    let currentTarget = input.currentTarget,
      ownerDocument = currentTarget.ownerDocument,
      pointerId = input.pointerId,
      value: Set<number> = heldUndoPointerIds.get(currentTarget) ?? new Set();
    heldUndoPointerIds.set(currentTarget, value);
    value.add(pointerId);
    currentTarget.setAttribute(UNDO_STEPS_HELD_ATTRIBUTE, "");
    let callback = (input2: PointerEvent): void => {
      if (input2.pointerId !== pointerId) {
        return;
      }
      value.delete(pointerId);
      if (value.size === 0) {
        currentTarget.removeAttribute(UNDO_STEPS_HELD_ATTRIBUTE);
      }
      ownerDocument.removeEventListener("pointerup", callback, true);
      ownerDocument.removeEventListener("pointercancel", callback, true);
    };
    ownerDocument.addEventListener("pointerup", callback, true);
    ownerDocument.addEventListener("pointercancel", callback, true);
  }
  function overlaysBlockUndo(input: ParentNode = document): boolean {
    for (let value of input.querySelectorAll(
      OPEN_OVERLAY_SELECTOR,
    )) {
      if (value.hasAttribute(UNDO_STEPS_HELD_ATTRIBUTE)) {
        return true;
      }
      if (value.hasAttribute("data-mc-scrim") || isOverlayClosed(value)) {
        continue;
      }
      if (!value.hasAttribute(UNDO_STEPS_ATTRIBUTE)) {
        return true;
      }
    }
    return false;
  }
  function isOverlayClosed(input: Element): boolean {
    return (input.closest("[data-open], [data-closed]") ?? input).hasAttribute(
      "data-closed",
    );
  }
  function choosePopoverSide(
    anchor: Element | null | undefined,
    expectedHeight: number,
    preferredSide: PopoverSide = "bottom",
    minimumHeight: number = expectedHeight,
  ): PopoverPlacement {
    if (!anchor) {
      return {
        side: preferredSide,
        maxHeight: undefined,
      };
    }
    let bounds = anchor.getBoundingClientRect(),
      value =
        (anchor.ownerDocument.defaultView?.innerHeight ?? bounds.bottom) -
        bounds.bottom -
        16,
      value2 = bounds.top - 16,
      [value3, value4] =
        preferredSide === "top" ? [value2, value] : [value, value2],
      value5 =
        value3 >= Math.min(expectedHeight, minimumHeight) || value3 >= value4
          ? preferredSide
          : preferredSide === "top"
            ? "bottom"
            : "top",
      value6 = value5 === "bottom" ? value : value2;
    return {
      side: value5,
      maxHeight: value6 < expectedHeight ? Math.max(value6, 120) : undefined,
    };
  }
  bindRuntimeValue(runtime, "anyMenuOrPopoverOpen", () => anyMenuOrPopoverOpen);
  bindRuntimeValue(runtime, "hasOpenOverlay", () => hasOpenOverlay);
  bindRuntimeValue(runtime, "markHeldUndoPointer", () => markHeldUndoPointer);
  bindRuntimeValue(runtime, "overlaysBlockUndo", () => overlaysBlockUndo);
  bindRuntimeValue(runtime, "isOverlayClosed", () => isOverlayClosed);
  bindRuntimeValue(runtime, "choosePopoverSide", () => choosePopoverSide);
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyFocus",
    () => reactForUiPropertyFocus,
    (value) => {
      reactForUiPropertyFocus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OPEN_OVERLAY_SELECTOR",
    () => OPEN_OVERLAY_SELECTOR,
    (value) => {
      OPEN_OVERLAY_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MENU_POPOVER_OPEN_SELECTORS",
    () => MENU_POPOVER_OPEN_SELECTORS,
    (value) => {
      MENU_POPOVER_OPEN_SELECTORS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNDO_STEPS_ATTRIBUTE",
    () => UNDO_STEPS_ATTRIBUTE,
    (value) => {
      UNDO_STEPS_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNDO_STEPS_HELD_ATTRIBUTE",
    () => UNDO_STEPS_HELD_ATTRIBUTE,
    (value) => {
      UNDO_STEPS_HELD_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "heldUndoPointerIds",
    () => heldUndoPointerIds,
    (value) => {
      heldUndoPointerIds = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingPopupFocusReturn",
    () => pendingPopupFocusReturn,
    (value) => {
      pendingPopupFocusReturn = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_EDITABLE_SELECTOR",
    () => TEXT_EDITABLE_SELECTOR,
    (value) => {
      TEXT_EDITABLE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popupPointerEvent",
    () => popupPointerEvent,
    (value) => {
      popupPointerEvent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ToolbarTooltipSideContext",
    () => ToolbarTooltipSideContext,
    (value) => {
      ToolbarTooltipSideContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popupFocusReturnTimer",
    () => popupFocusReturnTimer,
    (value) => {
      popupFocusReturnTimer = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyFocus",
    () => initializeUiPropertyFocus,
    (value) => {
      initializeUiPropertyFocus = value;
    },
  );
  return () => {
    UNDO_STEPS_ATTRIBUTE = "data-mc-undo-steps";
    UNDO_STEPS_HELD_ATTRIBUTE = "data-mc-undo-steps-held";
    TEXT_EDITABLE_SELECTOR =
      'input, select, textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]';
    popupPointerEvent = (event: React.KeyboardEvent): void => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
        event.preventDefault();
      }
    };
    popupFocusReturnTimer = 320;
    initializeUiPropertyFocus = (0, runtime.initializeOnce)(() => {
      reactForUiPropertyFocus = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      OPEN_OVERLAY_SELECTOR = [
        "[data-mc-popover]",
        "[data-mc-menu]",
        "[data-mc-scrim]",
        '[data-cds="Menu"]',
        '[data-cds="Popover"]',
        '[data-cds="Dialog"]',
        '[role="alertdialog"]:not([aria-modal="false"])',
        '[role="dialog"][aria-modal="true"]',
      ].join(", ");
      MENU_POPOVER_OPEN_SELECTORS = [
        '[data-cds="Menu"]',
        '[data-cds="ContextMenu"]',
        '[data-cds="DropdownButton"]',
        '[data-cds="SplitDropdownButton"]',
        '[data-cds="ModelSelector"]',
      ].join(", ");
      heldUndoPointerIds = new WeakMap();
      pendingPopupFocusReturn = {
        [UNDO_STEPS_ATTRIBUTE]: "",
        onPointerDownCapture: markHeldUndoPointer,
      };
      ToolbarTooltipSideContext =
        reactForUiPropertyFocus.createContext<PopoverSide | undefined>(undefined);
    });
  };
}

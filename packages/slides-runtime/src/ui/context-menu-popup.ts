/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";
import type { DataAttributeProps } from "./editor-selection";

/** Where the menu opens, in viewport coordinates. */
export interface ContextMenuPoint {
  x: number;
  y: number;
}
export interface ContextMenuPopupProps {
  /** Opening point; `null` closes the menu. */
  at: ContextMenuPoint | null;
  onClose: () => void;
  children?: React.ReactNode;
  title?: string;
  "aria-label"?: string;
  /** `tap` centers the menu under a touch target and offsets it; `point` opens at the pointer. */
  anchor?: "point" | "tap";
  className?: string;
  minWidth?: number | string;
  popupAttrs?: DataAttributeProps;
  /** Picks the element that regains focus on close; receives the one focused before opening. */
  returnFocus?: (previous: HTMLElement | null) => HTMLElement | null | undefined;
  /** Focus the first enabled item once the menu is open. */
  focusFirstItem?: boolean;
}
/** The menu content kept alive while the close animation runs. */
interface ContextMenuSnapshot {
  at: ContextMenuPoint;
  children: React.ReactNode;
  title: string | undefined;
  name: string | undefined;
  anchor: "point" | "tap";
}
/** What the base menu reports when it asks to open or close. */
interface ContextMenuChangeDetails {
  reason: string;
  event?: Event;
  cancel: () => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactN_: ReactNamespace;
    jsxo20: JsxNamespace;
    reactsQ: ReactNamespace;
    jsxwX: JsxNamespace;
    CONTEXT_MENU_MARGIN: number;
    ContextMenuPopup: (props: ContextMenuPopupProps) => React.ReactElement;
  }
}

export function installUiContextMenuPopup(
  runtime: RuntimeBindings,
): () => void {
  var reactN_: ReactNamespace;
  var jsxo20: JsxNamespace;
  var reactsQ: ReactNamespace;
  var jsxwX: JsxNamespace;
  var CONTEXT_MENU_MARGIN: number;
  function ContextMenuPopup({
    at: at,
    onClose: onClose,
    children: children,
    title: title,
    "aria-label": ariaLabel,
    anchor: anchor,
    className: className,
    minWidth: minWidth,
    popupAttrs: popupAttrs,
    returnFocus: returnFocus,
    focusFirstItem = false,
  }: ContextMenuPopupProps): React.ReactElement {
    let value = at !== null;
    (0, runtime.usePopupOpenFocus)(value && focusFirstItem);
    let ref = reactsQ.useRef<HTMLElement>(null),
      ref2 = reactsQ.useRef(onClose);
    ref2.current = onClose;
    let [value2, value3] = reactsQ.useState(false),
      ref3 = reactsQ.useRef<ContextMenuSnapshot | null>(null);
    reactsQ.useLayoutEffect(() => {
      if (at) {
        ref3.current = {
          at: at,
          children: children,
          title: title,
          name: title ?? ariaLabel,
          anchor: anchor ?? "point",
        };
        value3(true);
      }
    }, [at, children, title, ariaLabel, anchor]);
    let value4 = at
        ? {
            at: at,
            children: children,
            title: title,
            name: title ?? ariaLabel,
            anchor: anchor ?? "point",
          }
        : ref3.current,
      value5 = value4?.anchor === "tap",
      value6 = value4?.at.x,
      value7 = value4?.at.y,
      memo = reactsQ.useMemo(() => {
        if (value6 === undefined || value7 === undefined) {
          return;
        }
        let state = {
          x: value6,
          y: value7,
          left: value6,
          top: value7,
          right: value6,
          bottom: value7,
          width: 0,
          height: 0,
          toJSON: () => ({
            x: value6,
            y: value7,
            width: 0,
            height: 0,
          }),
        };
        return {
          getBoundingClientRect: () => state,
        };
      }, [value6, value7]),
      ref4 = reactsQ.useRef<HTMLElement | null>(null);
    reactsQ.useLayoutEffect(() => {
      if (!value) {
        return;
      }
      let activeElement = document.activeElement;
      if (
        value2 &&
        (activeElement === document.body ||
          (ref.current?.contains(activeElement) ?? false))
      ) {
        return;
      }
      ref4.current =
        activeElement instanceof HTMLElement &&
        activeElement !== document.body
          ? activeElement
          : null;
    }, [value, value2]);
    reactsQ.useEffect(() => {
      if (!value || !focusFirstItem) {
        return;
      }
      let value8 = requestAnimationFrame(() => {
        let current = ref.current;
        if (current === null) {
          return;
        }
        let activeElement = document.activeElement;
        if (
          activeElement !== null &&
          activeElement !== document.body &&
          activeElement !== current &&
          !current.contains(activeElement) &&
          activeElement !== ref4.current
        ) {
          return;
        }
        let element = current.querySelector<HTMLElement>(
          '[role^="menuitem"]:not([aria-disabled="true"]):not([data-disabled])',
        );
        if (element !== null) {
          element.focus();
        }
      });
      return () => cancelAnimationFrame(value8);
    }, [value, focusFirstItem]);
    return jsxwX.jsxs(jsxwX.Fragment, {
      children: [
        value
          ? jsxwX.jsx(runtime.PopupScrim, {
              onClose: () => ref2.current(),
            })
          : null,
        jsxwX.jsx(runtime.Menu.Root, {
          open: value,
          modal: false,
          onOpenChange: (input: boolean, options: ContextMenuChangeDetails): void => {
            if (input) {
              return;
            }
            if (options.reason === "outside-press") {
              let value8 = options.event?.target;
              if (
                value8 instanceof Element &&
                value8.hasAttribute("data-mc-scrim")
              ) {
                options.cancel();
                return;
              }
            }
            ref2.current();
          },
          onOpenChangeComplete: (input: boolean): void => {
            if (!input) {
              value3(false);
            }
          },
          children: jsxwX.jsxs(runtime.Menu.Popup, {
            ref: ref,
            anchor: memo,
            side: "bottom",
            align: value5 ? "center" : "start",
            sideOffset: value5 ? CONTEXT_MENU_MARGIN : 0,
            "aria-label": value4?.name,
            ...popupAttrs,
            "data-mc-chrome": "",
            "data-mc-menu": "",
            finalFocus: () => {
              let activeElement = document.activeElement;
              if (
                activeElement instanceof HTMLElement &&
                activeElement !== document.body &&
                !(ref.current?.contains(activeElement) ?? false)
              ) {
                return false;
              }
              let value8: HTMLElement | null =
                ref4.current?.isConnected === true ? ref4.current : null;
              (returnFocus !== undefined ? returnFocus(value8) : value8)?.focus(
                {
                  preventScroll: true,
                },
              );
              return false;
            },
            onContextMenu: (event: React.MouseEvent): void => {
              event.preventDefault();
              event.stopPropagation();
            },
            onKeyDown: (input: React.KeyboardEvent): void => {
              if (input.key !== "Tab" && !input.metaKey && !input.ctrlKey) {
                input.stopPropagation();
              }
            },
            className: className,
            style:
              minWidth !== undefined
                ? {
                    minWidth: minWidth,
                  }
                : undefined,
            children: [
              value4?.title !== undefined
                ? jsxwX.jsx(runtime.Menu.Header, {
                    className: "truncate",
                    children: value4.title,
                  })
                : null,
              value4?.children,
            ],
          }),
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "reactN_",
    () => reactN_,
    (value) => {
      reactN_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxo20",
    () => jsxo20,
    (value) => {
      jsxo20 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactsQ",
    () => reactsQ,
    (value) => {
      reactsQ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxwX",
    () => jsxwX,
    (value) => {
      jsxwX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTEXT_MENU_MARGIN",
    () => CONTEXT_MENU_MARGIN,
    (value) => {
      CONTEXT_MENU_MARGIN = value;
    },
  );
  bindRuntimeValue(runtime, "ContextMenuPopup", () => ContextMenuPopup);
  return () => {
    reactN_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxo20 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    (0, runtime.initializeUiPointerMedia)();
    (0, runtime.initializeUiInputs210)();
    (0, runtime.initializeUiPropertyPopover2)();
    (0, runtime.initializeUiPropertyPopover)();
    reactsQ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxwX = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    CONTEXT_MENU_MARGIN = 14;
  };
}

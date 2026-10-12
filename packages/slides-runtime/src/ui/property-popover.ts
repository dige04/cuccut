/** Restored application module; prepare first, initialize in original order. */
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  ReactPortal,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type { DataAttributeProps } from "./editor-selection";
import type { PopoverPlacement, PopoverSide } from "./property-focus";

/** What Base UI reports when a popover asks to open or close. */
export interface PopoverChangeDetails {
  reason: string;
  event: Event;
  trigger?: Element | null;
  /** Keeps the popover in its current state. */
  cancel(): void;
}
export interface PopupScrimProps {
  onClose: () => void;
}
export interface PropertyPopupProps {
  open: boolean;
  onClose: () => void;
  onOpen?: () => void;
  /** Element that opens the popup; without one the popup anchors to its parent. */
  trigger?: ReactElement;
  children?: ReactNode;
  align?: "left" | "right";
  side?: PopoverSide;
  /** Height the content needs, to pick the side with room. */
  planHeight?: number;
  /** Element the popup anchors to, when it is not the parent. */
  positionAnchor?: () => Element | null | undefined;
  /** Attributes for the content wrapper. */
  popupAttrs?: DataAttributeProps;
  /** Whether edits made inside are undo steps held until the pointer is released. */
  editsAreUndoSteps?: boolean;
  padding?: "default" | "none";
  className?: string;
  "aria-label"?: string;
  /** Moves focus into the popup when it opens. */
  focusOnOpen?: boolean;
  initialFocus?: () => HTMLElement | null;
  /** Keeps the editor's text selection when the popup is pressed. */
  keepFocus?: boolean;
}
export interface PropertyMenuItemProps {
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  /** Shows a check mark when true; nothing when false; no slot when absent. */
  checked?: boolean;
  hint?: ReactNode;
  /** An icon name, or an element. */
  icon?: ReactNode;
  "data-testid"?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactForUiPropertyPopover: ReactNamespace;
    reactDOMForUiPropertyPopover: ReactDomNamespace;
    jsxForUiPropertyPopover: JsxNamespace;
    reactForUiPropertyPopover2: ReactNamespace;
    jsxForUiPropertyPopover2: JsxNamespace;
    blurActivePopupEditor: () => void;
    PopupScrim: (props: PopupScrimProps) => ReactPortal;
    initializeUiPropertyPopover: () => void;
    suppressRepeatedEnterClicks: (held: boolean) => () => void;
    usePopupOpenFocus: (active: boolean) => void;
    suppressEnterClicksUntilRelease: () => void;
    PropertyPopup: (props: PropertyPopupProps) => ReactElement;
    PropertyMenuItem: (props: PropertyMenuItemProps) => ReactElement;
    collectFocusableDescendants: (root: ParentNode) => HTMLElement[];
    isBaseUiFocusGuardEvent: (details: PopoverChangeDetails) => boolean;
    popupCloseStack: symbol[];
    preventPopupMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
    preservePopupSelection: (event: ReactMouseEvent<HTMLElement>) => void;
    initializeUiPropertyPopover2: () => void;
  }
}

export function installUiPropertyPopover(runtime: RuntimeBindings): () => void {
  var reactForUiPropertyPopover: ReactNamespace;
  var reactDOMForUiPropertyPopover: ReactDomNamespace;
  var jsxForUiPropertyPopover: JsxNamespace;
  var initializeUiPropertyPopover: () => void;
  var reactForUiPropertyPopover2: ReactNamespace;
  var jsxForUiPropertyPopover2: JsxNamespace;
  var popupCloseStack: symbol[];
  var preventPopupMouseDown: RuntimeBindings["preventPopupMouseDown"];
  var preservePopupSelection: RuntimeBindings["preservePopupSelection"];
  var initializeUiPropertyPopover2: () => void;
  function blurActivePopupEditor(): void {
    let activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement?.closest("[data-mc-popover], [data-mc-menu]")) {
      return;
    }
    if (
      activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA" ||
      activeElement.isContentEditable
    ) {
      activeElement.blur();
    }
  }
  function PopupScrim({ onClose: onClose }: PopupScrimProps): ReactPortal {
    let ref = reactForUiPropertyPopover.useRef(onClose);
    ref.current = onClose;
    let ref2 = reactForUiPropertyPopover.useRef<HTMLDivElement>(null),
      ref3 = reactForUiPropertyPopover.useRef(false),
      [value, value2] = reactForUiPropertyPopover.useState(false),
      ref4 = reactForUiPropertyPopover.useRef(false);
    reactForUiPropertyPopover.useEffect(() => {
      let callback = () => {
          ref4.current = true;
          if (ref2.current) {
            ref2.current.style.pointerEvents = "none";
          }
          value2(true);
        },
        callback2 = () => {
          ref4.current = false;
          if (ref2.current) {
            ref2.current.style.pointerEvents = "";
          }
          value2(false);
        };
      document.addEventListener("dragstart", callback, true);
      document.addEventListener("dragend", callback2, true);
      document.addEventListener("drop", callback2, true);
      let current = ref2.current,
        callback3 = (event: WheelEvent) => {
          event.preventDefault();
          if (!current) {
            return;
          }
          current.style.pointerEvents = "none";
          blurActivePopupEditor();
          ref.current();
          let value3 = document.elementFromPoint?.(
            event.clientX,
            event.clientY,
          );
          if (value3 && value3 !== current) {
            value3.dispatchEvent(new WheelEvent("wheel", event));
          }
        },
        callback4 = (event: Event) => {
          event.preventDefault();
          if (current) {
            current.style.pointerEvents = "none";
          }
          blurActivePopupEditor();
          ref.current();
        };
      current?.addEventListener("wheel", callback3, {
        passive: false,
      });
      current?.addEventListener("gesturestart", callback4, {
        passive: false,
      });
      current?.addEventListener("gesturechange", callback4, {
        passive: false,
      });
      return () => {
        document.removeEventListener("dragstart", callback, true);
        document.removeEventListener("dragend", callback2, true);
        document.removeEventListener("drop", callback2, true);
        current?.removeEventListener("wheel", callback3);
        current?.removeEventListener("gesturestart", callback4);
        current?.removeEventListener("gesturechange", callback4);
      };
    }, []);
    return reactDOMForUiPropertyPopover.createPortal(
      jsxForUiPropertyPopover.jsx("div", {
        ref: ref2,
        "data-mc-scrim": "",
        "aria-hidden": "true",
        className: "fixed inset-0 z-scrim",
        style: {
          pointerEvents: value ? "none" : undefined,
        },
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          blurActivePopupEditor();
          if (event.button === 0) {
            ref3.current = true;
          } else {
            event.currentTarget.style.pointerEvents = "none";
            onClose();
          }
        },
        onPointerCancel: () => {
          if (!ref3.current) {
            return;
          }
          ref3.current = false;
          onClose();
        },
        onClick: (input: ReactMouseEvent<HTMLDivElement>) => {
          input.stopPropagation();
          if (!ref3.current) {
            return;
          }
          ref3.current = false;
          onClose();
        },
        onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          blurActivePopupEditor();
          onClose();
        },
        onDragEnter: () => {
          if (ref4.current) {
            return;
          }
          blurActivePopupEditor();
          onClose();
        },
      }),
      document.body,
    );
  }
  function suppressRepeatedEnterClicks(input: boolean): () => void {
    let value = input,
      flag = false,
      flag2 = false,
      callback = () => {
        window.removeEventListener("keydown", callback2, true);
        window.removeEventListener("keyup", callback2, true);
        window.removeEventListener("click", callback4, true);
        window.removeEventListener("blur", callback3);
      },
      callback2 = (input2: KeyboardEvent) => {
        if (input2.key !== "Enter") {
          return;
        }
        value = input2.type === "keydown";
        flag = value && input2.repeat;
        if (flag2 && !flag) {
          callback();
        }
      },
      callback3 = () => {
        value = flag = false;
        if (flag2) {
          callback();
        }
      },
      callback4 = (event: MouseEvent) => {
        if (!flag || event.detail !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      };
    window.addEventListener("keydown", callback2, true);
    window.addEventListener("keyup", callback2, true);
    window.addEventListener("click", callback4, true);
    window.addEventListener("blur", callback3);
    return () => {
      flag2 = true;
      if (!value) {
        callback();
      }
    };
  }
  function usePopupOpenFocus(input: boolean): void {
    reactForUiPropertyPopover2.useEffect(
      () => (input ? suppressRepeatedEnterClicks(false) : undefined),
      [input],
    );
  }
  function suppressEnterClicksUntilRelease(): void {
    suppressRepeatedEnterClicks(true)();
  }
  function PropertyPopup({
    open: open,
    onClose: onClose,
    trigger: trigger,
    onOpen: onOpen,
    children: children,
    align = "right",
    side: side,
    planHeight: planHeight,
    positionAnchor: positionAnchor,
    popupAttrs: popupAttrs,
    editsAreUndoSteps = false,
    padding = "default",
    className: className,
    "aria-label": ariaLabel,
    focusOnOpen = false,
    initialFocus: initialFocus,
    keepFocus = false,
  }: PropertyPopupProps): ReactElement {
    let ref = reactForUiPropertyPopover2.useRef<HTMLDivElement>(null);
    usePopupOpenFocus(open && focusOnOpen);
    let ref2 = reactForUiPropertyPopover2.useRef<HTMLSpanElement>(null),
      value = reactForUiPropertyPopover2.useContext(
        runtime.ToolbarTooltipSideContext,
      ),
      value2 = side === undefined ? value : undefined,
      value3 = side ?? value2 ?? "bottom",
      value4 = value3 === "bottom" || value3 === "top",
      [value5, value6] = reactForUiPropertyPopover2.useState<PopoverPlacement>({
        side: value4 ? value3 : "bottom",
        maxHeight: undefined,
      });
    reactForUiPropertyPopover2.useLayoutEffect(() => {
      if (!open) {
        return;
      }
      value6(
        value4 && planHeight !== undefined
          ? (0, runtime.choosePopoverSide)(
              positionAnchor?.() ?? ref2.current?.parentElement,
              planHeight,
              value3,
              value2 !== undefined ? runtime.popupFocusReturnTimer : undefined,
            )
          : {
              side: value4 ? value3 : "bottom",
              maxHeight: undefined,
            },
      );
    }, [open]);
    let value7 = value4 && planHeight !== undefined,
      value8 = value4 ? value5.side : value3,
      ref3 = reactForUiPropertyPopover2.useRef(onClose);
    ref3.current = onClose;
    let ref4 = reactForUiPropertyPopover2.useRef(onOpen);
    ref4.current = onOpen;
    let ref5 = reactForUiPropertyPopover2.useRef(false);
    reactForUiPropertyPopover2.useEffect(() => {
      if (!open) {
        return;
      }
      ref5.current = false;
      let value9 = Symbol("popover");
      popupCloseStack.push(value9);
      let callback = () =>
          popupCloseStack[popupCloseStack.length - 1] === value9,
        callback2 = (event: PointerEvent) => {
          if (!callback()) {
            return;
          }
          let target = event.target as Node | null;
          if (
            target instanceof Element &&
            target.hasAttribute("data-mc-scrim")
          ) {
            return;
          }
          if ((0, runtime.anyMenuOrPopoverOpen)()) {
            return;
          }
          if (
            target instanceof Element &&
            target.closest(runtime.MENU_POPOVER_OPEN_SELECTORS) !== null
          ) {
            return;
          }
          let value10 =
              ref2.current?.parentElement?.contains(target) ?? false,
            value11 = ref.current?.contains(target) ?? false;
          if (!value10 && !value11) {
            ref3.current();
          }
        },
        callback3 = (event: PointerEvent) => {
          let target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          if (target.closest("[data-mc-strip]") === null) {
            return;
          }
          callback2(event);
        },
        callback4 = (event: KeyboardEvent) => {
          if (event.defaultPrevented || !callback()) {
            return;
          }
          if ((0, runtime.anyMenuOrPopoverOpen)()) {
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            ref3.current();
          }
        },
        callback5 = (event: KeyboardEvent) => {
          if (
            event.key !== "Escape" ||
            event.defaultPrevented ||
            event.isComposing ||
            !callback()
          ) {
            return;
          }
          if ((0, runtime.anyMenuOrPopoverOpen)()) {
            return;
          }
          let target = event.target as HTMLElement | null;
          if (
            target &&
            (ref.current?.contains(target) ||
              target.closest("[data-mc-popover]") !== null) &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable)
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          ref3.current();
        };
      document.addEventListener("pointerdown", callback2);
      document.addEventListener("pointerdown", callback3, {
        capture: true,
      });
      window.addEventListener("keydown", callback4);
      window.addEventListener("keydown", callback5, {
        capture: true,
      });
      return () => {
        let value10 = popupCloseStack.indexOf(value9);
        if (value10 >= 0) {
          popupCloseStack.splice(value10, 1);
        }
        document.removeEventListener("pointerdown", callback2);
        document.removeEventListener("pointerdown", callback3, {
          capture: true,
        });
        window.removeEventListener("keydown", callback4);
        window.removeEventListener("keydown", callback5, {
          capture: true,
        });
      };
    }, [open]);
    return jsxForUiPropertyPopover2.jsxs(jsxForUiPropertyPopover2.Fragment, {
      children: [
        jsxForUiPropertyPopover2.jsx("span", {
          ref: ref2,
          className: "hidden",
          "aria-hidden": "true",
        }),
        open
          ? jsxForUiPropertyPopover2.jsx(PopupScrim, {
              onClose: () => ref3.current(),
            })
          : null,
        jsxForUiPropertyPopover2.jsxs(runtime.PopoverComponents.Root, {
          open: open,
          onOpenChange: (input: boolean, options: PopoverChangeDetails) => {
            if (input) {
              ref4.current?.();
              return;
            }
            if (options.reason === "escape-key") {
              if (!options.event.defaultPrevented) {
                options.event.preventDefault();
                if (!ref5.current) {
                  ref3.current();
                }
                ref5.current = true;
              }
              options.cancel();
              return;
            }
            if (
              options.reason === "trigger-press" ||
              options.reason === "imperative-action" ||
              options.reason === "close-press" ||
              (options.reason === "focus-out" &&
                isBaseUiFocusGuardEvent(options))
            ) {
              if (!ref5.current) {
                ref3.current();
              }
              ref5.current = true;
              return;
            }
            options.cancel();
          },
          children: [
            trigger !== undefined
              ? jsxForUiPropertyPopover2.jsx(
                  runtime.PopoverComponents.Trigger,
                  {
                    render: trigger,
                  },
                )
              : null,
            jsxForUiPropertyPopover2.jsx(runtime.PopoverComponents.Popup, {
              ref: ref,
              "aria-label": ariaLabel,
              anchor: () =>
                positionAnchor?.() ?? ref2.current?.parentElement ?? null,
              side: value8,
              align: !value4 || align === "left" ? "start" : "end",
              sideOffset: value3 === "right" ? 12 : value3 === "left" ? 8 : 4,
              style:
                value7 && value5.maxHeight !== undefined
                  ? {
                      maxHeight: `min(${value5.maxHeight}px, var(--available-height))`,
                    }
                  : undefined,
              padding: "none",
              initialFocus: focusOnOpen ? initialFocus : false,
              finalFocus: focusOnOpen
                ? trigger !== undefined
                  ? true
                  : undefined
                : false,
              onKeyDown:
                focusOnOpen && trigger === undefined
                  ? (event: ReactKeyboardEvent<HTMLDivElement>) => {
                      if (event.key !== "Tab") {
                        return;
                      }
                      let current = ref.current;
                      if (
                        !current ||
                        !current.contains(document.activeElement)
                      ) {
                        return;
                      }
                      let value9 =
                        collectFocusableDescendants(current);
                      if (value9.length === 0) {
                        return;
                      }
                      let value10 = value9[0],
                        value11 = value9[value9.length - 1];
                      if (
                        event.shiftKey &&
                        document.activeElement === value10
                      ) {
                        event.preventDefault();
                        value11?.focus();
                      } else if (
                        !event.shiftKey &&
                        document.activeElement === value11
                      ) {
                        event.preventDefault();
                        value10?.focus();
                      }
                    }
                  : undefined,
              "data-mc-popover": "",
              ...(editsAreUndoSteps ? runtime.pendingPopupFocusReturn : {}),
              children: jsxForUiPropertyPopover2.jsx("div", {
                ...popupAttrs,
                className: (0, runtime.joinClassNames)(
                  "min-w-48",
                  padding === "none" ? undefined : "p-1",
                  className,
                ),
                onMouseDown: keepFocus ? preservePopupSelection : undefined,
                children: jsxForUiPropertyPopover2.jsx(
                  runtime.ToolbarTooltipSideContext.Provider,
                  {
                    value: undefined,
                    children: children,
                  },
                ),
              }),
            }),
          ],
        }),
      ],
    });
  }
  function PropertyMenuItem({
    onClick: onClick,
    children: children,
    disabled: disabled,
    title: title,
    danger: danger,
    checked: checked,
    hint: hint,
    icon: icon,
    "data-testid": dataTestid,
  }: PropertyMenuItemProps): ReactElement {
    return jsxForUiPropertyPopover2.jsxs("button", {
      type: "button",
      "data-kit": "MenuItem",
      "data-testid": dataTestid,
      disabled: disabled,
      title: title,
      "aria-pressed": checked,
      onMouseDown: preventPopupMouseDown,
      onClick: onClick,
      className: (0, runtime.joinClassNames)(
        (0, runtime.menuItemVariants)({
          variant: danger ? "danger" : "default",
        }),
        "cursor-default text-left disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "enabled:hover:bg-fill-danger enabled:hover:text-on-danger focus-visible:bg-fill-danger focus-visible:text-on-danger"
          : "enabled:hover:bg-fill-ghost-hover focus-visible:bg-fill-ghost-hover",
      ),
      children: [
        icon !== undefined
          ? jsxForUiPropertyPopover2.jsx("span", {
              className: "flex size-icon shrink-0 items-center justify-center",
              children:
                typeof icon === "string"
                  ? jsxForUiPropertyPopover2.jsx(runtime.Icon, {
                      name: icon,
                      size: "auto",
                    })
                  : icon || null,
            })
          : null,
        typeof children === "string" || typeof children === "number"
          ? jsxForUiPropertyPopover2.jsx("span", {
              className: "min-w-0 flex-1 truncate",
              children: children,
            })
          : jsxForUiPropertyPopover2.jsx("span", {
              className: "flex min-w-0 flex-1 items-center gap-xs",
              children: children,
            }),
        checked !== undefined || hint
          ? jsxForUiPropertyPopover2.jsxs("span", {
              className: "ml-md flex shrink-0 items-center gap-xs",
              children: [
                hint
                  ? jsxForUiPropertyPopover2.jsx("span", {
                      className: (0, runtime.joinClassNames)(
                        "max-w-[160px] shrink-0 truncate py-[0.125em] -my-[0.125em] text-footnote tabular-nums text-muted",
                        danger &&
                          !disabled &&
                          "group-hover/menu-danger:text-on-danger group-focus-visible/menu-danger:text-on-danger",
                      ),
                      children: hint,
                    })
                  : null,
                checked !== undefined
                  ? jsxForUiPropertyPopover2.jsx("span", {
                      className:
                        "-mr-1 flex size-icon shrink-0 items-center justify-center",
                      style: {
                        color: "var(--cds-fill-accent)",
                      },
                      children: checked
                        ? jsxForUiPropertyPopover2.jsx(runtime.Icon, {
                            name: "Check",
                            size: "auto",
                            bold: true,
                          })
                        : null,
                    })
                  : null,
              ],
            })
          : null,
      ],
    });
  }
  function collectFocusableDescendants(input: ParentNode): HTMLElement[] {
    return Array.from(
      input.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (input2) =>
        input2.tabIndex >= 0 && input2.closest('[aria-hidden="true"]') === null,
    );
  }
  function isBaseUiFocusGuardEvent(details: PopoverChangeDetails): boolean {
    let value = details.trigger ?? details.event?.target;
    return (
      value instanceof Element && value.hasAttribute("data-base-ui-focus-guard")
    );
  }
  bindRuntimeValue(
    runtime,
    "blurActivePopupEditor",
    () => blurActivePopupEditor,
  );
  bindRuntimeValue(runtime, "PopupScrim", () => PopupScrim);
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyPopover",
    () => reactForUiPropertyPopover,
    (value) => {
      reactForUiPropertyPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMForUiPropertyPopover",
    () => reactDOMForUiPropertyPopover,
    (value) => {
      reactDOMForUiPropertyPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertyPopover",
    () => jsxForUiPropertyPopover,
    (value) => {
      jsxForUiPropertyPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyPopover",
    () => initializeUiPropertyPopover,
    (value) => {
      initializeUiPropertyPopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "suppressRepeatedEnterClicks",
    () => suppressRepeatedEnterClicks,
  );
  bindRuntimeValue(runtime, "usePopupOpenFocus", () => usePopupOpenFocus);
  bindRuntimeValue(
    runtime,
    "suppressEnterClicksUntilRelease",
    () => suppressEnterClicksUntilRelease,
  );
  bindRuntimeValue(runtime, "PropertyPopup", () => PropertyPopup);
  bindRuntimeValue(runtime, "PropertyMenuItem", () => PropertyMenuItem);
  bindRuntimeValue(
    runtime,
    "collectFocusableDescendants",
    () => collectFocusableDescendants,
  );
  bindRuntimeValue(
    runtime,
    "isBaseUiFocusGuardEvent",
    () => isBaseUiFocusGuardEvent,
  );
  bindRuntimeValue(
    runtime,
    "reactForUiPropertyPopover2",
    () => reactForUiPropertyPopover2,
    (value) => {
      reactForUiPropertyPopover2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxForUiPropertyPopover2",
    () => jsxForUiPropertyPopover2,
    (value) => {
      jsxForUiPropertyPopover2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "popupCloseStack",
    () => popupCloseStack,
    (value) => {
      popupCloseStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preventPopupMouseDown",
    () => preventPopupMouseDown,
    (value) => {
      preventPopupMouseDown = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preservePopupSelection",
    () => preservePopupSelection,
    (value) => {
      preservePopupSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyPopover2",
    () => initializeUiPropertyPopover2,
    (value) => {
      initializeUiPropertyPopover2 = value;
    },
  );
  return () => {
    initializeUiPropertyPopover = (0, runtime.initializeOnce)(() => {
      reactForUiPropertyPopover = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      reactDOMForUiPropertyPopover = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactDomNamespace)(),
        1,
      );
      jsxForUiPropertyPopover = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    preventPopupMouseDown = (event: ReactMouseEvent<HTMLElement>) =>
      event.preventDefault();
    preservePopupSelection = (event: ReactMouseEvent<HTMLElement>) => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest(runtime.TEXT_EDITABLE_SELECTOR) === null
      ) {
        event.preventDefault();
      }
    };
    initializeUiPropertyPopover2 = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiInputs210)();
      (0, runtime.initializeUiPropertyFocus)();
      initializeUiPropertyPopover();
      reactForUiPropertyPopover2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      jsxForUiPropertyPopover2 = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
      popupCloseStack = [];
    });
  };
}

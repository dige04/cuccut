/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  JsxNamespace,
  PropertyPopupProps,
  PropertyPopupChangeDetails,
  PopoverPlacement,
} from "../contracts/composition";
export function installUiPropertyPopover(runtime: RuntimeBindings): () => void {
  var reactForUiPropertyPopover2: ReactNamespace;
  var reactForUiPropertyPopover: ReactNamespace;
  var reactDOMForUiPropertyPopover: typeof import("react-dom");
  var jsxForUiPropertyPopover: JsxNamespace;
  var CanvasEditorJsx: JsxNamespace;
  var EMPTY_EDITOR_TOOL_OPTIONS: symbol[];
  var preservePopupSelection: React.MouseEventHandler<HTMLElement>;
  function blurActivePopupEditor() {
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
  function PopupScrim({ onClose: onClose }: { onClose(): void }) {
    let ref = reactForUiPropertyPopover.useRef(onClose);
    ref.current = onClose;
    let ref2 = reactForUiPropertyPopover.useRef<HTMLDivElement | null>(null),
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
      <div
        ref={ref2}
        data-mc-scrim={""}
        aria-hidden={"true"}
        className={"fixed inset-0 z-scrim"}
        style={{
          pointerEvents: value ? "none" : undefined,
        }}
        onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          blurActivePopupEditor();
          if (event.button === 0) {
            ref3.current = true;
          } else {
            event.currentTarget.style.pointerEvents = "none";
            onClose();
          }
        }}
        onPointerCancel={() => {
          if (!ref3.current) {
            return;
          }
          ref3.current = false;
          onClose();
        }}
        onClick={(input: React.MouseEvent<HTMLDivElement>) => {
          input.stopPropagation();
          if (!ref3.current) {
            return;
          }
          ref3.current = false;
          onClose();
        }}
        onContextMenu={(event: React.MouseEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          blurActivePopupEditor();
          onClose();
        }}
        onDragEnter={() => {
          if (ref4.current) {
            return;
          }
          blurActivePopupEditor();
          onClose();
        }}
      />,
      document.body,
    );
  }
  function suppressRepeatedEnterClicks(input: boolean) {
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
  function usePopupOpenFocus(input: boolean) {
    reactForUiPropertyPopover2.useEffect(
      () => (input ? suppressRepeatedEnterClicks(false) : undefined),
      [input],
    );
  }
  function suppressEnterClicksUntilRelease() {
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
  }: PropertyPopupProps) {
    let ref = reactForUiPropertyPopover2.useRef<HTMLDivElement | null>(null);
    usePopupOpenFocus(open && focusOnOpen);
    let ref2 = reactForUiPropertyPopover2.useRef<HTMLSpanElement | null>(null),
      value = reactForUiPropertyPopover2.useContext(
        runtime.ToolbarTooltipSideContext as React.Context<
          "top" | "bottom" | undefined
        >,
      ),
      value2 = side === undefined ? value : undefined,
      value3 = side ?? value2 ?? "bottom",
      value4 = value3 === "bottom" || value3 === "top",
      [value5, value6] = reactForUiPropertyPopover2.useState<PopoverPlacement>({
        side: value4 ? (value3 as "top" | "bottom") : "bottom",
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
              value3 as "top" | "bottom",
              value2 !== undefined ? runtime.popupFocusReturnTimer : undefined,
            )
          : {
              side: value4 ? (value3 as "top" | "bottom") : "bottom",
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
      EMPTY_EDITOR_TOOL_OPTIONS.push(value9);
      let callback = () =>
          EMPTY_EDITOR_TOOL_OPTIONS[EMPTY_EDITOR_TOOL_OPTIONS.length - 1] ===
          value9,
        callback2 = (event: PointerEvent) => {
          if (!callback()) {
            return;
          }
          let target = event.target as HTMLElement | null;
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
          let value10 = ref2.current?.parentElement?.contains(target) ?? false,
            value11 = ref.current?.contains(target) ?? false;
          if (!value10 && !value11) {
            ref3.current();
          }
        },
        callback3 = (event: PointerEvent) => {
          let target = event.target as HTMLElement | null;
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
        let value10 = EMPTY_EDITOR_TOOL_OPTIONS.indexOf(value9);
        if (value10 >= 0) {
          EMPTY_EDITOR_TOOL_OPTIONS.splice(value10, 1);
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
    return (
      <CanvasEditorJsx.Fragment>
        {[
          <span ref={ref2} className={"hidden"} aria-hidden={"true"} />,
          open ? <PopupScrim onClose={() => ref3.current()} /> : null,
          <runtime.PopoverComponents.Root
            open={open}
            onOpenChange={(
              input: boolean,
              options: PropertyPopupChangeDetails,
            ) => {
              if (input) {
                ref4.current?.();
                return;
              }
              if (options.reason === "escape-key") {
                if (!options.event!.defaultPrevented) {
                  options.event!.preventDefault();
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
            }}
          >
            {[
              trigger !== undefined ? (
                <runtime.PopoverComponents.Trigger render={trigger} />
              ) : null,
              <runtime.PopoverComponents.Popup
                ref={ref}
                aria-label={ariaLabel}
                anchor={() =>
                  positionAnchor?.() ?? ref2.current?.parentElement ?? null
                }
                side={value8}
                align={!value4 || align === "left" ? "start" : "end"}
                sideOffset={value3 === "right" ? 12 : value3 === "left" ? 8 : 4}
                style={
                  value7 && value5.maxHeight !== undefined
                    ? {
                        maxHeight: `min(${value5.maxHeight}px, var(--available-height))`,
                      }
                    : undefined
                }
                padding={"none"}
                initialFocus={(focusOnOpen ? initialFocus : false) as import("../contracts/overlays").BaseUIPopupFocus}
                finalFocus={
                  focusOnOpen
                    ? trigger !== undefined
                      ? true
                      : undefined
                    : false
                }
                onKeyDown={
                  focusOnOpen && trigger === undefined
                    ? (event: React.KeyboardEvent<HTMLElement>) => {
                        if (event.key !== "Tab") {
                          return;
                        }
                        let current = ref.current;
                        if (
                          !current ||
                          !current.contains(
                            document.activeElement as HTMLElement | null,
                          )
                        ) {
                          return;
                        }
                        let value9 = collectFocusableDescendants(current);
                        if (value9.length === 0) {
                          return;
                        }
                        let value10 = value9[0],
                          value11 = value9[value9.length - 1];
                        if (
                          event.shiftKey &&
                          (document.activeElement as HTMLElement | null) ===
                            value10
                        ) {
                          event.preventDefault();
                          value11?.focus();
                        } else if (
                          !event.shiftKey &&
                          (document.activeElement as HTMLElement | null) ===
                            value11
                        ) {
                          event.preventDefault();
                          value10?.focus();
                        }
                      }
                    : undefined
                }
                data-mc-popover={""}
                {...(editsAreUndoSteps ? runtime.pendingPopupFocusReturn : {})}
              >
                <div
                  {...popupAttrs}
                  className={(0, runtime.joinClassNames)(
                    "min-w-48",
                    padding === "none" ? undefined : "p-1",
                    className,
                  )}
                  onMouseDown={keepFocus ? preservePopupSelection : undefined}
                >
                  <runtime.ToolbarTooltipSideContext.Provider value={undefined}>
                    {children}
                  </runtime.ToolbarTooltipSideContext.Provider>
                </div>
              </runtime.PopoverComponents.Popup>,
            ]}
          </runtime.PopoverComponents.Root>,
        ]}
      </CanvasEditorJsx.Fragment>
    );
  }
  function collectFocusableDescendants(input: Element) {
    return Array.from<HTMLElement>(
      input.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (input2: HTMLElement) =>
        input2.tabIndex >= 0 && input2.closest('[aria-hidden="true"]') === null,
    );
  }
  function isBaseUiFocusGuardEvent(details: {
    trigger?: Element;
    event?: {
      target: EventTarget | null;
    };
  }) {
    let value = details.trigger ?? details.event?.target;
    return (
      value instanceof Element && value.hasAttribute("data-base-ui-focus-guard")
    );
  }
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
    "blurActivePopupEditor",
    () => blurActivePopupEditor,
  );
  bindRuntimeValue(runtime, "PopupScrim", () => PopupScrim);
  bindRuntimeValue(
    runtime,
    "CanvasEditorJsx",
    () => CanvasEditorJsx,
    (value) => {
      CanvasEditorJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_EDITOR_TOOL_OPTIONS",
    () => EMPTY_EDITOR_TOOL_OPTIONS,
    (value) => {
      EMPTY_EDITOR_TOOL_OPTIONS = value;
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
    "preservePopupSelection",
    () => preservePopupSelection,
    (value) => {
      preservePopupSelection = value;
    },
  );
  return () => {
    reactForUiPropertyPopover2 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
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
    CanvasEditorJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    EMPTY_EDITOR_TOOL_OPTIONS = [];
    preservePopupSelection = (event: React.MouseEvent<HTMLElement>) => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest(runtime.TEXT_EDITABLE_SELECTOR) === null
      ) {
        event.preventDefault();
      }
    };
  };
}

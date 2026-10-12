/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromePopover(
  runtime: RuntimeBindings,
): () => void {
  var jsxChromePopover: Dynamic;
  var ChromePopoverItems: Dynamic;
  function usePopoverDismissal({ onClose: onClose }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactChromeFocus.useRef)(onClose);
    value.current = onClose;
    let value2: Dynamic = (0, runtime.reactChromeFocus.useRef)(null),
      value3: Dynamic = (0, runtime.reactChromeFocus.useRef)(false),
      [value4, value5]: Dynamic = (0, runtime.reactChromeFocus.useState)(false),
      value6: Dynamic = (0, runtime.reactChromeFocus.useRef)(false);
    (0, runtime.reactChromeFocus.useEffect)((): Dynamic => {
      let callback: Dynamic = (): Dynamic => {
          value6.current = true;
          value2.current && (value2.current.style.pointerEvents = "none");
          value5(true);
        },
        callback2: Dynamic = (): Dynamic => {
          value6.current = false;
          value2.current && (value2.current.style.pointerEvents = "");
          value5(false);
        };
      (document as Dynamic).addEventListener("dragstart", callback, true);
      (document as Dynamic).addEventListener("dragend", callback2, true);
      (document as Dynamic).addEventListener("drop", callback2, true);
      let current: Dynamic = value2.current,
        callback3: Dynamic = (event?: Dynamic): Dynamic => {
          event.preventDefault();
          if (!current) return;
          current.style.pointerEvents = "none";
          (0, runtime.blurPopoverTextInput)();
          value.current();
          let value7: Dynamic = (document as Dynamic).elementFromPoint?.(
            event.clientX,
            event.clientY,
          );
          value7 &&
            value7 !== current &&
            value7.dispatchEvent(new WheelEvent("wheel", event));
        },
        callback4: Dynamic = (event?: Dynamic): Dynamic => {
          event.preventDefault();
          current && (current.style.pointerEvents = "none");
          (0, runtime.blurPopoverTextInput)();
          value.current();
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
      return (): Dynamic => {
        (document as Dynamic).removeEventListener("dragstart", callback, true);
        (document as Dynamic).removeEventListener("dragend", callback2, true);
        (document as Dynamic).removeEventListener("drop", callback2, true);
        current?.removeEventListener("wheel", callback3);
        current?.removeEventListener("gesturestart", callback4);
        current?.removeEventListener("gesturechange", callback4);
      };
    }, []);
    return (0, runtime.reactDomChromeFocus.createPortal)(
      <div
        ref={value2}
        data-mc-scrim={""}
        aria-hidden={"true"}
        className={"fixed inset-0 z-scrim"}
        style={{
          pointerEvents: value4 ? "none" : undefined,
        }}
        onPointerDown={(event?: Dynamic): Dynamic => {
          event.preventDefault();
          event.stopPropagation();
          (0, runtime.blurPopoverTextInput)();
          event.button === 0
            ? (value3.current = true)
            : ((event.currentTarget.style.pointerEvents = "none"), onClose());
        }}
        onPointerCancel={(): Dynamic => {
          value3.current && ((value3.current = false), onClose());
        }}
        onClick={(input?: Dynamic): Dynamic => {
          input.stopPropagation();
          value3.current && ((value3.current = false), onClose());
        }}
        onContextMenu={(event?: Dynamic): Dynamic => {
          event.preventDefault();
          event.stopPropagation();
          (0, runtime.blurPopoverTextInput)();
          onClose();
        }}
        onDragEnter={(): Dynamic => {
          value6.current || ((0, runtime.blurPopoverTextInput)(), onClose());
        }}
      />,
      (document as Dynamic).body,
    );
  }
  function suppressEscapeRelease(input?: Dynamic): Dynamic {
    let value: Dynamic = input,
      flag: Dynamic = false,
      flag2: Dynamic = false,
      callback: Dynamic = (): Dynamic => {
        (window as Dynamic).removeEventListener("keydown", callback2, true);
        (window as Dynamic).removeEventListener("keyup", callback2, true);
        (window as Dynamic).removeEventListener("click", callback4, true);
        (window as Dynamic).removeEventListener("blur", callback3);
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        input2.key === "Enter" &&
          ((value = input2.type === "keydown"),
          (flag = value && input2.repeat),
          flag2 && !flag && callback());
      },
      callback3: Dynamic = (): Dynamic => {
        value = flag = false;
        flag2 && callback();
      },
      callback4: Dynamic = (event?: Dynamic): Dynamic => {
        !flag ||
          event.detail !== 0 ||
          (event.preventDefault(), event.stopPropagation());
      };
    (window as Dynamic).addEventListener("keydown", callback2, true);
    (window as Dynamic).addEventListener("keyup", callback2, true);
    (window as Dynamic).addEventListener("click", callback4, true);
    (window as Dynamic).addEventListener("blur", callback3);
    return (): Dynamic => {
      flag2 = true;
      value || callback();
    };
  }
  function useEscapeReleaseSuppression(input?: Dynamic): Dynamic {
    (0, runtime.reactChromeTheme_3.useEffect)(
      (): Dynamic => (input ? suppressEscapeRelease(false) : undefined),
      [input],
    );
  }
  function clearEscapeReleaseSuppression(): Dynamic {
    suppressEscapeRelease(true)();
  }
  function EditorPopover({
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
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactChromeTheme_3.useRef)(null);
    useEscapeReleaseSuppression(open && focusOnOpen);
    let value2: Dynamic = (0, runtime.reactChromeTheme_3.useRef)(null),
      value3: Dynamic = (0, runtime.reactChromeTheme_3.useContext)(
        runtime.ChromeFocusContext,
      ),
      value4: Dynamic = side === undefined ? value3 : undefined,
      value5: Dynamic = side ?? value4 ?? "bottom",
      value6: Dynamic = value5 === "bottom" || value5 === "top",
      [value7, value8]: Dynamic = (0, runtime.reactChromeTheme_3.useState)({
        side: value6 ? value5 : "bottom",
        maxHeight: undefined,
      });
    (0, runtime.reactChromeTheme_3.useLayoutEffect)((): Dynamic => {
      open &&
        value8(
          value6 && planHeight !== undefined
            ? (0, runtime.choosePopoverPlacement)(
                positionAnchor?.() ?? value2.current?.parentElement,
                planHeight,
                value5,
                value4 !== undefined ? runtime.ChromeFocusConstant : undefined,
              )
            : {
                side: value6 ? value5 : "bottom",
                maxHeight: undefined,
              },
        );
    }, [open]);
    let value9: Dynamic = value6 && planHeight !== undefined,
      value10: Dynamic = value6 ? value7.side : value5,
      value11: Dynamic = (0, runtime.reactChromeTheme_3.useRef)(onClose);
    value11.current = onClose;
    let value12: Dynamic = (0, runtime.reactChromeTheme_3.useRef)(onOpen);
    value12.current = onOpen;
    let value13: Dynamic = (0, runtime.reactChromeTheme_3.useRef)(false);
    (0, runtime.reactChromeTheme_3.useEffect)((): Dynamic => {
      if (!open) return;
      value13.current = false;
      let value14: Dynamic = Symbol("popover");
      ChromePopoverItems.push(value14);
      let callback: Dynamic = (): Dynamic =>
          ChromePopoverItems[ChromePopoverItems.length - 1] === value14,
        callback2: Dynamic = (event?: Dynamic): Dynamic => {
          if (!callback()) return;
          let target: Dynamic = event.target;
          if (
            (target instanceof Element &&
              target.hasAttribute("data-mc-scrim")) ||
            (0, runtime.hasOpenCdsOverlay)() ||
            (target instanceof Element &&
              target.closest(runtime.openCdsOverlaySelector) !== null)
          )
            return;
          let value15: Dynamic =
              value2.current?.parentElement?.contains(target) ?? false,
            value16: Dynamic = value.current?.contains(target) ?? false;
          !value15 && !value16 && value11.current();
        },
        callback3: Dynamic = (event?: Dynamic): Dynamic => {
          let target: Dynamic = event.target;
          target instanceof Element &&
            target.closest("[data-mc-strip]") !== null &&
            callback2(event);
        },
        callback4: Dynamic = (event?: Dynamic): Dynamic => {
          event.defaultPrevented ||
            !callback() ||
            (0, runtime.hasOpenCdsOverlay)() ||
            (event.key === "Escape" &&
              (event.preventDefault(), value11.current()));
        },
        callback5: Dynamic = (event?: Dynamic): Dynamic => {
          if (
            event.key !== "Escape" ||
            event.defaultPrevented ||
            event.isComposing ||
            !callback() ||
            (0, runtime.hasOpenCdsOverlay)()
          )
            return;
          let target: Dynamic = event.target;
          (target &&
            (value.current?.contains(target) ||
              target.closest("[data-mc-popover]") !== null) &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable)) ||
            (event.preventDefault(),
            event.stopPropagation(),
            value11.current());
        };
      (document as Dynamic).addEventListener("pointerdown", callback2);
      (document as Dynamic).addEventListener("pointerdown", callback3, {
        capture: true,
      });
      (window as Dynamic).addEventListener("keydown", callback4);
      (window as Dynamic).addEventListener("keydown", callback5, {
        capture: true,
      });
      return (): Dynamic => {
        let value15: Dynamic = ChromePopoverItems.indexOf(value14);
        value15 >= 0 && ChromePopoverItems.splice(value15, 1);
        (document as Dynamic).removeEventListener("pointerdown", callback2);
        (document as Dynamic).removeEventListener("pointerdown", callback3, {
          capture: true,
        });
        (window as Dynamic).removeEventListener("keydown", callback4);
        (window as Dynamic).removeEventListener("keydown", callback5, {
          capture: true,
        });
      };
    }, [open]);
    return (
      <jsxChromePopover.Fragment>
        <span ref={value2} className={"hidden"} aria-hidden={"true"} />
        {open
          ? (() => {
              const _Component = usePopoverDismissal;
              return <_Component onClose={(): Dynamic => value11.current()} />;
            })()
          : null}
        <runtime.PopoverPopoverRootTriggerPopupConfig.Root
          open={open}
          onOpenChange={(input?: Dynamic, options?: Dynamic): Dynamic => {
            if (input) {
              value12.current?.();
              return;
            }
            if (options.reason === "escape-key") {
              options.event.defaultPrevented ||
                (options.event.preventDefault(),
                value13.current || value11.current(),
                (value13.current = true));
              options.cancel();
              return;
            }
            if (
              options.reason === "trigger-press" ||
              options.reason === "imperative-action" ||
              options.reason === "close-press" ||
              (options.reason === "focus-out" &&
                (0, runtime.isBaseUiFocusGuard)(options))
            ) {
              value13.current || value11.current();
              value13.current = true;
              return;
            }
            options.cancel();
          }}
        >
          {trigger !== undefined ? (
            <runtime.PopoverPopoverRootTriggerPopupConfig.Trigger
              render={trigger}
            />
          ) : null}
          <runtime.PopoverPopoverRootTriggerPopupConfig.Popup
            ref={value}
            aria-label={ariaLabel}
            anchor={(): Dynamic =>
              positionAnchor?.() ?? value2.current?.parentElement ?? null
            }
            side={value10}
            align={!value6 || align === "left" ? "start" : "end"}
            sideOffset={value5 === "right" ? 12 : value5 === "left" ? 8 : 4}
            style={
              value9 && value7.maxHeight !== undefined
                ? {
                    maxHeight: `min(${value7.maxHeight}px, var(--available-height))`,
                  }
                : undefined
            }
            padding={"none"}
            initialFocus={focusOnOpen ? initialFocus : false}
            finalFocus={
              focusOnOpen ? (trigger !== undefined ? true : undefined) : false
            }
            onKeyDown={
              focusOnOpen && trigger === undefined
                ? (event?: Dynamic): Dynamic => {
                    if (event.key !== "Tab") return;
                    let current: Dynamic = value.current;
                    if (
                      !current ||
                      !current.contains((document as Dynamic).activeElement)
                    )
                      return;
                    let value14: Dynamic = (0, runtime.getFocusableElements)(
                      current,
                    );
                    if (value14.length === 0) return;
                    let value15: Dynamic = value14[0],
                      value16: Dynamic = value14[value14.length - 1];
                    event.shiftKey &&
                    (document as Dynamic).activeElement === value15
                      ? (event.preventDefault(), value16?.focus())
                      : !event.shiftKey &&
                        (document as Dynamic).activeElement === value16 &&
                        (event.preventDefault(), value15?.focus());
                  }
                : undefined
            }
            data-mc-popover={""}
            {...(editsAreUndoSteps ? runtime.undoStepOverlayProps : {})}
          >
            <div
              {...popupAttrs}
              className={(0, runtime.joinClassNames)(
                "min-w-48",
                padding === "none" ? undefined : "p-1",
                className,
              )}
              onMouseDown={keepFocus ? runtime.ChromeMenuItemTarget : undefined}
            >
              <runtime.ChromeFocusContext.Provider value={undefined}>
                {children}
              </runtime.ChromeFocusContext.Provider>
            </div>
          </runtime.PopoverPopoverRootTriggerPopupConfig.Popup>
        </runtime.PopoverPopoverRootTriggerPopupConfig.Root>
      </jsxChromePopover.Fragment>
    );
  }
  bindRuntimeValue(runtime, "usePopoverDismissal", () => usePopoverDismissal);
  bindRuntimeValue(
    runtime,
    "jsxChromePopover",
    () => jsxChromePopover,
    (value) => {
      jsxChromePopover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ChromePopoverItems",
    () => ChromePopoverItems,
    (value) => {
      ChromePopoverItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "suppressEscapeRelease",
    () => suppressEscapeRelease,
  );
  bindRuntimeValue(
    runtime,
    "useEscapeReleaseSuppression",
    () => useEscapeReleaseSuppression,
  );
  bindRuntimeValue(
    runtime,
    "clearEscapeReleaseSuppression",
    () => clearEscapeReleaseSuppression,
  );
  bindRuntimeValue(runtime, "EditorPopover", () => EditorPopover);
  return () => {
    jsxChromePopover = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ChromePopoverItems = [];
  };
}

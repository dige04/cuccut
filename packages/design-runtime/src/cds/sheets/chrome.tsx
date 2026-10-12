/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsSheetsChrome(runtime: RuntimeBindings): () => void {
  var reactSheetsChrome: Dynamic;
  var jsxSheetsChrome: Dynamic;
  var SheetChromeButton: Dynamic;
  var SheetsChromeHandleTitleBarDismissButtonConfig: Dynamic;
  var initializeSheetsChrome: Dynamic;
  var reactSheetsChrome_2: Dynamic;
  var initializeSheetsChrome_2: Dynamic;
  var reactSheetsChrome_3: Dynamic;
  var initializeSheetsChrome_3: Dynamic;
  function SheetHandle({ drawPill = true }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useSheetState_2)();
    return (
      <div
        aria-hidden={true}
        data-cds-sheet-handle={""}
        {...value}
        className={
          "flex min-h-8 shrink-0 touch-none items-center justify-center select-none"
        }
      >
        <div
          className={(0, runtime.npm_clsx_Ea)(
            "h-1 w-9 rounded-full bg-border",
            !drawPill && "opacity-0",
          )}
        />
      </div>
    );
  }
  function SheetHeading({ leading: leading, title: title }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useSheetState_2)(),
      value2: Dynamic = leading != null && leading !== false;
    return !value2 &&
      !(title != null && title !== false && title !== "") ? null : (
      <div
        {...value}
        className={
          "order-first flex min-h-control shrink-0 touch-none items-center gap-xs px-1.5 pb-1 select-none"
        }
      >
        {value2 && <span className={"-me-2.5 shrink-0"}>{leading}</span>}
        <span
          aria-hidden={true}
          className={(0, runtime.npm_clsx_Ea)(
            "min-w-0 flex-1 truncate text-start text-heading font-semibold text-primary",
            !value2 && "ps-2.5",
          )}
        >
          {title}
        </span>
      </div>
    );
  }
  function SheetBody({
    className: className,
    children: children,
  }: Dynamic): Dynamic {
    return (
      <div
        className={(0, runtime.cn)(
          "flex min-h-0 flex-auto flex-col",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  function useSheetTextFocus(element?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options?.setDetent,
      value2: Dynamic = options?.holdTextEntryFocus;
    (0, reactSheetsChrome_2.useEffect)((): Dynamic => {
      if (element === null || value === undefined || value2 === undefined)
        return;
      let value3: Dynamic = null,
        callback: Dynamic = (): Dynamic => {
          value3 === null && (value3 = value2());
        },
        callback2: Dynamic = (): Dynamic => {
          value3?.();
          value3 = null;
        },
        index: Dynamic = 0,
        callback3: Dynamic = (input?: Dynamic): Dynamic => {
          if (!(input instanceof Element)) return false;
          if ((0, runtime.isTextInputElement)(input)) return true;
          let ancestor: Dynamic = input.closest(
            '[data-cds="TextInput"], label',
          );
          if (ancestor === null) return false;
          let value4: Dynamic =
            ancestor instanceof HTMLLabelElement ? ancestor.control : null;
          return (
            (0, runtime.isTextInputElement)(value4) ||
            ancestor.querySelector(
              'input:not([type=button],[type=checkbox],[type=radio],[type=range],[type=submit],[type=reset],[type=color],[type=file],[type=image],[type=hidden],[readonly]), textarea:not([readonly]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
            ) !== null
          );
        },
        callback4: Dynamic = (event?: Dynamic): Dynamic => {
          callback3(event.target) && (index = event.timeStamp || Date.now());
        },
        callback5: Dynamic = (event?: Dynamic): Dynamic => {
          (0, runtime.isTextInputElement)(event.target) &&
            (callback(),
            index > 0 &&
              (event.timeStamp || Date.now()) - index < 1e3 &&
              ((index = 0), value("tall")));
        },
        callback6: Dynamic = (event?: Dynamic): Dynamic => {
          index > 0 && callback3(event.target) && ((index = 0), value("tall"));
        },
        callback7: Dynamic = (event?: Dynamic): Dynamic => {
          (0, runtime.isTextInputElement)(event.target) && callback2();
        };
      element.addEventListener("pointerdown", callback4);
      element.addEventListener("focusin", callback5);
      element.addEventListener("focusout", callback7);
      element.addEventListener("click", callback6);
      element.contains(element.ownerDocument.activeElement) &&
        (0, runtime.isTextInputElement)(element.ownerDocument.activeElement) &&
        callback();
      return (): Dynamic => {
        element.removeEventListener("pointerdown", callback4);
        element.removeEventListener("focusin", callback5);
        element.removeEventListener("focusout", callback7);
        element.removeEventListener("click", callback6);
        callback2();
      };
    }, [element, value, value2]);
  }
  function useCoveredSheetState(element?: Dynamic): Dynamic {
    (0, reactSheetsChrome_2.useEffect)((): Dynamic => {
      if (element === null) return;
      let ownerDocument: Dynamic = element.ownerDocument,
        value: Dynamic = null,
        callback: Dynamic = (): Dynamic => {
          element.removeAttribute(runtime.CdsSheetPressedAttribute);
          value?.removeAttribute(runtime.CdsSheetControlHeldAttribute);
          value = null;
          ownerDocument.removeEventListener("click", callback, true);
          ownerDocument.removeEventListener("pointercancel", callback, true);
          ownerDocument.removeEventListener("keydown", callback, true);
        },
        callback2: Dynamic = (): Dynamic => {
          ownerDocument.addEventListener("click", callback, true);
          ownerDocument.addEventListener("pointercancel", callback, true);
          ownerDocument.addEventListener("keydown", callback, true);
          element.setAttribute(runtime.CdsSheetPressedAttribute, "");
          let element2: Dynamic = element.querySelector(
            "[data-cds-sheet-control]",
          );
          element2?.matches(":focus-visible, [data-highlighted]") &&
            ((value = element2),
            element2.setAttribute(runtime.CdsSheetControlHeldAttribute, ""));
        };
      element.addEventListener("pointerdown", callback2, true);
      return (): Dynamic => {
        element.removeEventListener("pointerdown", callback2, true);
        callback();
      };
    }, [element]);
  }
  function sheetMutationIsScrollOnly(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (!options) return false;
    let value: Dynamic = `[${runtime.sheetScrollAttribute}]`,
      index: Dynamic = 0,
      index2: Dynamic = 0;
    for (let value2 of input as Dynamic) {
      let target: Dynamic = value2.target,
        value3: Dynamic =
          target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
      if (value3 === null || value3.closest(value) === null) return false;
      index += value2.addedNodes.length;
      index2 += value2.removedNodes.length;
    }
    return index > 0 && index2 > 0 && index2 <= index;
  }
  function sheetNaturalHeight(element?: Dynamic): Dynamic {
    let height: Dynamic = element.getBoundingClientRect().height,
      value: Dynamic = Array.from(
        element.querySelectorAll(`[${runtime.sheetScrollAttribute}]`),
      );
    if (value.length === 0) return height;
    let value2: Dynamic = height;
    for (let value3 of value as Dynamic) {
      let firstElementChild: Dynamic = value3.firstElementChild;
      for (
        ;
        firstElementChild !== null &&
        firstElementChild.getClientRects().length === 0;

      )
        firstElementChild = firstElementChild.nextElementSibling;
      let lastElementChild: Dynamic = value3.lastElementChild;
      for (
        ;
        lastElementChild !== null &&
        lastElementChild.getClientRects().length === 0;

      )
        lastElementChild = lastElementChild.previousElementSibling;
      let value4: Dynamic =
          element.ownerDocument.defaultView?.getComputedStyle(value3),
        value5: Dynamic =
          parseFloat(value4?.paddingTop ?? "0") +
          parseFloat(value4?.paddingBottom ?? "0"),
        value6: Dynamic =
          firstElementChild !== null && lastElementChild !== null
            ? lastElementChild.getBoundingClientRect().bottom -
              firstElementChild.getBoundingClientRect().top +
              value5
            : value5;
      value2 += value6 - value3.clientHeight;
    }
    return Math.max(0, value2);
  }
  function sheetScrollMetrics(input?: Dynamic): Dynamic {
    let index: Dynamic = 0,
      index2: Dynamic = 0;
    for (let value of Array.from(
      input.querySelectorAll(`[${runtime.sheetScrollAttribute}]`),
    ) as Dynamic) {
      index += value.clientHeight;
      value.scrollHeight > value.clientHeight + 1 &&
        (index2 += value.scrollHeight);
    }
    return {
      visible: index,
      overflowContent: index2,
    };
  }
  function sheetFocusedElementBottom(
    element?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let defaultView: Dynamic = element.ownerDocument.defaultView;
    if (defaultView === null || options === null || !element.contains(options))
      return 0;
    let position: Dynamic = defaultView.getComputedStyle(options).position;
    if (position === "absolute" || position === "fixed") return 0;
    let index: Dynamic = 0;
    for (let value: Dynamic = options; value !== element; ) {
      let parentElement: Dynamic = value.parentElement;
      if (parentElement === null) break;
      let style: Dynamic = defaultView.getComputedStyle(parentElement),
        value2: Dynamic =
          parentElement.getBoundingClientRect().bottom -
          parseFloat(style.paddingBottom) -
          parseFloat(style.borderBottomWidth),
        value3: Dynamic = parseFloat(
          defaultView.getComputedStyle(value).marginBottom,
        );
      index += Math.max(
        0,
        value.getBoundingClientRect().bottom +
          Math.max(0, value3) -
          value2 +
          parentElement.scrollTop,
      );
      value = parentElement;
    }
    return index;
  }
  function useSheetDismissal(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, reactSheetsChrome_2.useRef)(context);
    (0, reactSheetsChrome_2.useEffect)((): Dynamic => {
      value.current = context;
    }, [context]);
    let value2: Dynamic = options?.open ?? false,
      value3: Dynamic = options?.dismiss,
      value4: Dynamic = options?.treeId;
    (0, reactSheetsChrome_2.useEffect)((): Dynamic => {
      if (
        element === null ||
        !value2 ||
        value3 === undefined ||
        value4 === undefined
      )
        return;
      let ownerDocument: Dynamic = element.ownerDocument,
        defaultView: Dynamic = ownerDocument.defaultView,
        index: Dynamic = 0,
        callback: Dynamic = (): Dynamic => {
          index !== 0 ||
            defaultView === null ||
            (index = defaultView.requestAnimationFrame((): Dynamic => {
              index = 0;
              let activeElement: Dynamic = ownerDocument.activeElement;
              value.current ||
                activeElement === null ||
                activeElement === ownerDocument.body ||
                element.contains(activeElement) ||
                activeElement.closest(
                  `[data-sheet-tree="${CSS.escape(value4)}"]`,
                ) !== null ||
                activeElement.closest(
                  '[aria-modal="true"], [data-cds="Dialog"]',
                ) === null ||
                value3();
            }));
        };
      element.addEventListener("focusout", callback);
      return (): Dynamic => {
        element.removeEventListener("focusout", callback);
        index !== 0 && defaultView?.cancelAnimationFrame(index);
      };
    }, [element, value2, value3, value4]);
  }
  function sheetMeasuredFrame(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = Math.round(options),
      value2: Dynamic = options - sheetScrollMetrics(input).visible;
    return {
      contentHeight: value,
      written: value,
      chromeAtPin: value2,
      chromeSettled: value2,
      grows: context,
    };
  }
  function useSheetPopupHost(): Dynamic {
    "use no memo";

    let value: Dynamic = (0, runtime.useSheetState)(),
      [value2, value3]: Dynamic = (0, reactSheetsChrome_3.useState)(false),
      value4: Dynamic = (0, reactSheetsChrome_3.useRef)(false),
      value5: Dynamic = (0, reactSheetsChrome_3.useRef)(null),
      value6: Dynamic = (0, reactSheetsChrome_3.useRef)(null),
      value7: Dynamic = (0, reactSheetsChrome_3.useCallback)(
        (input?: Dynamic): Dynamic => {
          value4.current = input;
          value3(input);
        },
        [],
      ),
      [value8, value9]: Dynamic = (0, reactSheetsChrome_3.useState)(null),
      { sheet: value10 }: Dynamic = value,
      value11: Dynamic = (0, reactSheetsChrome_3.useContext)(
        runtime.SheetPopupContext,
      ),
      value12: Dynamic = (0, reactSheetsChrome_3.useContext)(
        runtime.SheetStackContext,
      ),
      value13: Dynamic = (0, reactSheetsChrome_3.useRef)(null),
      value14: Dynamic = value11?.pinHeight,
      value15: Dynamic = (0, reactSheetsChrome_3.useCallback)(
        (input?: Dynamic): Dynamic => {
          value13.current = value10 ? input : null;
          value9(value10 ? input : null);
          (input === null || !value10) && value7(false);
          if (input !== null && value10) {
            let value27: Dynamic = (0, runtime.sheetContainsTextInput)(input);
            if (value27) {
              let value29: Dynamic = `min(${runtime.SheetsLayoutCss_3}, ${runtime.SheetsLayoutCss})`;
              input.style.minHeight = value29;
              input.style.maxHeight = value29;
            }
            value7(value27);
            let height: Dynamic = input.getBoundingClientRect().height,
              value28: Dynamic = (0, runtime.sheetNeedsScrolling)(input);
            value14?.(height, value28);
            value6.current !== input &&
              ((value6.current = input),
              (value5.current = sheetMeasuredFrame(input, height, value28)));
          }
        },
        [value10, value14, value7],
      ),
      value16: Dynamic = value11?.height;
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      let current: Dynamic = value13.current;
      if (!value10 || value16 !== undefined || current === null) return;
      (0, runtime.clearSheetTransition)(current);
      let height: Dynamic = current.getBoundingClientRect().height,
        value27: Dynamic = (0, runtime.sheetNeedsScrolling)(current);
      value14?.(height, value27);
      value6.current = current;
      value5.current = sheetMeasuredFrame(current, height, value27);
    }, [value10, value16, value14]);
    let value17: Dynamic = value11?.repinHeight,
      value18: Dynamic = value11?.drag,
      value19: Dynamic = value11?.open ?? false;
    (0, reactSheetsChrome_3.useEffect)((): Dynamic => {
      if (!value10 || !value19 || value8 === null || value17 === undefined)
        return;
      let defaultView: Dynamic = value8.ownerDocument.defaultView;
      if (
        defaultView === null ||
        typeof defaultView.MutationObserver === "undefined"
      )
        return;
      let index: Dynamic = 0,
        flag: Dynamic = false,
        flag2: Dynamic = false,
        value27: Dynamic = null,
        value28: Dynamic =
          typeof defaultView.ResizeObserver === "undefined"
            ? null
            : new defaultView.ResizeObserver((): Dynamic => {
                callback3();
              }),
        callback: Dynamic = (): Dynamic => {
          let element: Dynamic = value8.querySelector(
            "[data-cds-sheet-control]",
          );
          element === value27 ||
            value28 === null ||
            (value27 !== null && value28.unobserve(value27),
            (value27 = element),
            element !== null && value28.observe(element));
        },
        callback2: Dynamic = (): Dynamic => {
          index = 0;
          if (value18 !== undefined && value18.get() !== null) {
            index = defaultView.requestAnimationFrame(callback2);
            return;
          }
          callback();
          if ((0, runtime.sheetContainsTextInput)(value8)) {
            value4.current ||
              (value7(true),
              value17(
                defaultView.innerHeight * runtime.SheetsLayoutConstant_2,
                true,
              ));
            flag2 = false;
            return;
          }
          let value30: Dynamic = sheetFocusedElementBottom(value8, value27),
            value31: Dynamic = sheetScrollMetrics(value8),
            value32: Dynamic =
              value8.getBoundingClientRect().height + value30 - value31.visible,
            value33: Dynamic =
              defaultView.innerHeight * runtime.SheetsLayoutConstant;
          if (flag2) {
            flag2 = false;
            let value35: Dynamic = Math.round(
              Math.max(
                sheetNaturalHeight(value8) + value30,
                value31.overflowContent > 0
                  ? value32 + value31.overflowContent
                  : 0,
              ),
            );
            flag = value35 > value33;
            value5.current = {
              contentHeight: value35,
              written: Math.min(value35, value33),
              chromeAtPin: value32,
              chromeSettled: value32,
              grows: flag,
            };
            value17(Math.min(value35, value33), flag);
            return;
          }
          let current: Dynamic = value5.current;
          if (current === null || Math.abs(value32 - current.chromeSettled) < 1)
            return;
          current.chromeSettled = value32;
          if (Math.abs(value32 - current.chromeAtPin) < 1) {
            value17(current.written, current.grows);
            return;
          }
          let value34: Dynamic =
            current.contentHeight + value32 - current.chromeAtPin;
          value17(
            Math.min(value34, value33),
            value34 > value33 || current.grows,
          );
        },
        callback3: Dynamic = (): Dynamic => {
          index === 0 && (index = defaultView.requestAnimationFrame(callback2));
        };
      callback();
      let value29: Dynamic = new defaultView.MutationObserver(
        (input?: Dynamic): Dynamic => {
          (index !== 0 && flag2) ||
            sheetMutationIsScrollOnly(input, flag) ||
            ((flag2 = true), callback3());
        },
      );
      value29.observe(value8, {
        childList: true,
        subtree: true,
      });
      return (): Dynamic => {
        value29.disconnect();
        value28?.disconnect();
        index !== 0 && defaultView.cancelAnimationFrame(index);
        value6.current === value8 &&
          ((value5.current = null), (value6.current = null));
      };
    }, [value10, value19, value8, value17, value18, value7]);
    useSheetTextFocus(value8, value11);
    useCoveredSheetState(value8);
    useSheetDismissal(value8, value11, value.covered);
    (0, runtime.useAndroidCloseWatcher)(
      value10 && (value11?.open ?? false),
      value11?.dismiss,
    );
    let value20: Dynamic = (0, reactSheetsChrome_3.useContext)(
        runtime.SheetPopupBridgeContext,
      ),
      value21: Dynamic = (0, runtime.useCdsWindow)(),
      value22: Dynamic = (0, runtime.sheetFrameHeight)(value11, value21),
      value23: Dynamic = (0, reactSheetsChrome_3.useMemo)(
        (): Dynamic =>
          value10 && value20 !== null
            ? {
                depth: value.depth,
                frameHeight: value22,
                cover: value20,
              }
            : null,
        [value10, value20, value.depth, value22],
      ),
      value24: Dynamic = value10 && value.covered,
      value25: Dynamic = value10 && value.inert,
      value26: Dynamic = value10
        ? (0, runtime.getSheetFrameStyle)(value11, {
            floor: value2 ? "half" : "content",
            parentFrameHeight: value12?.frameHeight,
          })
        : undefined;
    return {
      sheet: value10,
      concealed: false,
      chrome: SheetsChromeHandleTitleBarDismissButtonConfig,
      ref: value15,
      style: value26,
      positionerStyle: value10
        ? (0, runtime.getSheetFixedPosition)(value11)
        : undefined,
      attrs: {
        ...(value10 ? (0, runtime.getSizeAttribute)("lg") : {}),
        "data-presentation": value10 ? "sheet" : undefined,
        "data-sheet-tree": value10 ? value11?.treeId : undefined,
        [runtime.coveredSheetAttribute]: value24 ? "" : undefined,
        "data-cds-sheet-depth": value10 ? String(value.depth) : undefined,
        "data-cds-sheet-detent": value10 ? value11?.detent : undefined,
        "aria-hidden": value25 ? "true" : undefined,
        ...(value25 ? runtime.getInertPropsValue : {}),
      },
      frame: value11,
      state: value,
      stack: value23,
    };
  }
  function MobileSheetsSheetPopupHost({
    children: children,
  }: Dynamic): Dynamic {
    return children(useSheetPopupHost());
  }
  bindRuntimeValue(runtime, "SheetHandle", () => SheetHandle);
  bindRuntimeValue(runtime, "SheetHeading", () => SheetHeading);
  bindRuntimeValue(runtime, "SheetBody", () => SheetBody);
  bindRuntimeValue(
    runtime,
    "reactSheetsChrome",
    () => reactSheetsChrome,
    (value) => {
      reactSheetsChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSheetsChrome",
    () => jsxSheetsChrome,
    (value) => {
      jsxSheetsChrome = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetChromeButton",
    () => SheetChromeButton,
    (value) => {
      SheetChromeButton = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsChromeHandleTitleBarDismissButtonConfig",
    () => SheetsChromeHandleTitleBarDismissButtonConfig,
    (value) => {
      SheetsChromeHandleTitleBarDismissButtonConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsChrome",
    () => initializeSheetsChrome,
    (value) => {
      initializeSheetsChrome = value;
    },
  );
  bindRuntimeValue(runtime, "useSheetTextFocus", () => useSheetTextFocus);
  bindRuntimeValue(runtime, "useCoveredSheetState", () => useCoveredSheetState);
  bindRuntimeValue(
    runtime,
    "sheetMutationIsScrollOnly",
    () => sheetMutationIsScrollOnly,
  );
  bindRuntimeValue(runtime, "sheetNaturalHeight", () => sheetNaturalHeight);
  bindRuntimeValue(runtime, "sheetScrollMetrics", () => sheetScrollMetrics);
  bindRuntimeValue(
    runtime,
    "sheetFocusedElementBottom",
    () => sheetFocusedElementBottom,
  );
  bindRuntimeValue(runtime, "useSheetDismissal", () => useSheetDismissal);
  bindRuntimeValue(
    runtime,
    "reactSheetsChrome_2",
    () => reactSheetsChrome_2,
    (value) => {
      reactSheetsChrome_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsChrome_2",
    () => initializeSheetsChrome_2,
    (value) => {
      initializeSheetsChrome_2 = value;
    },
  );
  bindRuntimeValue(runtime, "sheetMeasuredFrame", () => sheetMeasuredFrame);
  bindRuntimeValue(runtime, "useSheetPopupHost", () => useSheetPopupHost);
  bindRuntimeValue(
    runtime,
    "MobileSheetsSheetPopupHost",
    () => MobileSheetsSheetPopupHost,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetsChrome_3",
    () => reactSheetsChrome_3,
    (value) => {
      reactSheetsChrome_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsChrome_3",
    () => initializeSheetsChrome_3,
    (value) => {
      initializeSheetsChrome_3 = value;
    },
  );
  return () => {
    initializeSheetsChrome = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsStyles_2)();
      (0, runtime.initializeSheetsStyles)();
      reactSheetsChrome = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      (0, runtime.initializeNpm_clsx_xh)();
      jsxSheetsChrome = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      SheetChromeButton = (0, reactSheetsChrome.forwardRef)(function (
        {
          as = "button",
          onDismiss: onDismiss,
          label: label,
          className: className,
          ...props
        }: Dynamic,
        options?: Dynamic,
      ): Dynamic {
        let value: Dynamic = (0, runtime.useLabel)("close", "Close"),
          value2: Dynamic = label ?? value;
        return (() => {
          const _Component = as;
          return (
            <_Component
              ref={options}
              type={"button"}
              data-cds-sheet-control={""}
              onClick={onDismiss}
              {...props}
              className={(0, runtime.cn)(
                "cds-reset mx-1 mb-1 block shrink-0 rounded px-2 text-start text-body font-normal text-primary outline-none select-none focus-visible:bg-fill-ghost-hover focus-visible:outline-hidden [&:not(:focus-visible):not([data-cds-sheet-control-held])]:sr-only",
                "min-h-control",
                className,
              )}
            >
              {value2}
            </_Component>
          );
        })();
      });
      SheetsChromeHandleTitleBarDismissButtonConfig = {
        Handle: SheetHandle,
        TitleBar: SheetHeading,
        DismissButton: SheetChromeButton,
        Body: SheetBody,
      };
    });
    initializeSheetsChrome_2 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeSheetsKeyboardViewport)();
      (0, runtime.initializeSheetsPresentation)();
      reactSheetsChrome_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
    initializeSheetsChrome_3 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeOverlaysAndroidCloseWatcher)();
      (0, runtime.initializeSheetsLayout)();
      (0, runtime.initializeSheetsPresentation)();
      (0, runtime.initializeSheetsPopupStack)();
      (0, runtime.initializeSheetsStyles)();
      initializeSheetsChrome();
      initializeSheetsChrome_2();
      reactSheetsChrome_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
  };
}

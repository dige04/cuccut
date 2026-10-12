/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installCdsSheetsScrollArea(
  runtime: RuntimeBindings,
): () => void {
  var jsxSheetsScrollArea: Dynamic;
  var SheetsScrollAreaClassNames: Dynamic;
  var SheetsScrollAreaClassNames_2: Dynamic;
  var SheetsScrollAreaClassNames_3: Dynamic;
  var SheetsScrollAreaClassNames_4: Dynamic;
  var SheetsScrollAreaLabel: Dynamic;
  var initializeSheetsScrollArea: Dynamic;
  var reactSheetsScrollArea: Dynamic;
  var SheetsScrollAreaElementCache: Dynamic;
  var initializeSheetsScrollArea_2: Dynamic;
  var SheetsScrollAreaLabel_2: Dynamic;
  var initializeSheetsScrollArea_3: Dynamic;
  var initializeSheetsScrollArea_4: Dynamic;
  var SheetsScrollAreaElementCache_2: Dynamic;
  var SheetsScrollAreaLimit: Dynamic;
  var initializeSheetsScrollArea_5: Dynamic;
  var reactSheetsScrollArea_2: Dynamic;
  var initializeSheetsScrollArea_6: Dynamic;
  var overlayAttribute: Dynamic;
  var openOverlaySelector: Dynamic;
  var initializeOverlayAttributes: Dynamic;
  var reactSheetsScrollArea_3: Dynamic;
  var InnerOverlaysContext: Dynamic;
  var SheetsScrollAreaConstant: Dynamic;
  var initializeSheetsScrollArea_7: Dynamic;
  var reactSheetsScrollArea_4: Dynamic;
  var SheetsScrollAreaSAConfig: Dynamic;
  var initializeSheetsScrollArea_8: Dynamic;
  var SheetsScrollAreaRegistry: Dynamic;
  var SheetsScrollAreaRegistry_2: Dynamic;
  var SheetsScrollAreaRegistry_3: Dynamic;
  var SheetsScrollAreaRegistry_4: Dynamic;
  function isKeyboardContextMenu(input?: Dynamic): Dynamic {
    if (input === undefined || input.type !== "contextmenu") return false;
    let { button: value, pointerType: value2 }: Dynamic = input;
    return value === -1 && value2 !== "touch" && value2 !== "pen";
  }
  function recordKeyboardContextMenu(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    context.isCanceled ||
      (options && isKeyboardContextMenu(context.event)
        ? SheetsScrollAreaElementCache.set(input, true)
        : SheetsScrollAreaElementCache.delete(input));
  }
  function useKeyboardContextMenuFocus(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, reactSheetsScrollArea.useContext)(
      runtime.MenuTriggerContext,
    );
    (0, reactSheetsScrollArea.useEffect)((): Dynamic => {
      if (value === null || !SheetsScrollAreaElementCache.has(value)) return;
      let index: Dynamic = 0,
        count: Dynamic = 3,
        callback: Dynamic = (): Dynamic => {
          let current: Dynamic = input.current,
            value2: Dynamic = current?.ownerDocument.activeElement ?? null;
          if (
            current !== null &&
            value2 !== null &&
            !current.contains(value2) &&
            count > 0
          ) {
            count -= 1;
            index = requestAnimationFrame(callback);
            return;
          }
          SheetsScrollAreaElementCache.delete(value);
          current !== null &&
            value2 === current &&
            current
              .querySelector('[role^="menuitem"]:not([data-disabled])')
              ?.focus({
                preventScroll: true,
              });
        };
      index = requestAnimationFrame(callback);
      return (): Dynamic => {
        cancelAnimationFrame(index);
      };
    }, [value, input]);
  }
  function normalizeFocusRelatedTarget(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
      let relatedTarget: Dynamic = input2.relatedTarget;
      relatedTarget != null &&
        (0, runtime.asElement)(relatedTarget) === null &&
        Object.defineProperty(input2, "relatedTarget", {
          value: null,
          configurable: true,
        });
    };
    input.addEventListener("focusout", callback, true);
    try {
      input.blur();
    } finally {
      input.removeEventListener("focusout", callback, true);
    }
  }
  function registerOpenerReturn(input?: Dynamic, options?: Dynamic): Dynamic {
    SheetsScrollAreaElementCache_2.set(input, options);
  }
  function openerReturnChain(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      value: Dynamic = input;
    for (; value !== null && items.length < SheetsScrollAreaLimit; ) {
      let entry: Dynamic = SheetsScrollAreaElementCache_2.get(value);
      if (entry === undefined) {
        value = value.parentElement;
        continue;
      }
      let value2: Dynamic = entry();
      if (value2 === null || value2 === value || items.includes(value2)) break;
      items.push(value2);
      value = value2;
    }
    return items;
  }
  function useInitialFocusGuard(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = (0, runtime.useCdsRootElement)(),
      value3: Dynamic = (0, reactSheetsScrollArea_2.useRef)(false);
    (0, reactSheetsScrollArea_2.useInsertionEffect)((): Dynamic => {
      if (!input) {
        value3.current = false;
        return;
      }
      if (value3.current) return;
      value3.current = true;
      options.current = null;
      context.current = value2 ?? null;
      let value4: Dynamic = value2?.ownerDocument ?? document,
        activeElement: Dynamic = value4.activeElement,
        value5: Dynamic =
          activeElement && activeElement !== value4.body ? activeElement : null;
      options.current = value5;
      extra && (extra.current = openerReturnChain(value5));
      value?.();
    }, [input, value2, options, context, value, extra]);
  }
  function useOpenerReturn(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.skipRestoreOnOutsideFocus ?? false,
      value2: Dynamic = input?.registerOpenerReturn ?? true,
      value3: Dynamic = input?.triggerRef,
      value4: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null),
      value5: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null),
      value6: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null);
    useInitialFocusGuard(input?.open ?? true, value4, value6);
    let value7: Dynamic = (0, reactSheetsScrollArea_2.useRef)(value2);
    (0, reactSheetsScrollArea_2.useLayoutEffect)((): Dynamic => {
      value7.current = value2;
    }, [value2]);
    (0, reactSheetsScrollArea_2.useLayoutEffect)((): Dynamic => {
      value5.current &&
        registerOpenerReturn(
          value5.current,
          (): Dynamic =>
            value7.current
              ? (connectedRefElement(value3) ?? value4.current)
              : null,
        );
    }, [value3]);
    let value8: Dynamic = (0,
    reactSheetsScrollArea_2.useCallback)((): Dynamic => {
      if (value) {
        let current: Dynamic = value5.current,
          value9: Dynamic = value6.current?.ownerDocument ?? document,
          activeElement: Dynamic = value9.activeElement;
        if (
          activeElement &&
          activeElement !== value9.body &&
          !current?.contains(activeElement)
        )
          return false;
      }
      return connectedRefElement(value3) !== null
        ? null
        : restoreElementFocus(value4.current, value5.current);
    }, [value, value3]);
    return (0, reactSheetsScrollArea_2.useMemo)(
      (): Dynamic => ({
        finalFocus: value8,
        popupRef: value5,
      }),
      [value8],
    );
  }
  function connectedRefElement(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.current ?? null;
    return value?.isConnected ? value : null;
  }
  function useFinalFocus(
    input?: Dynamic,
    options: Dynamic = true,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.useCdsRootElement)(),
      value2: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null),
      value3: Dynamic = (0, reactSheetsScrollArea_2.useRef)(false),
      value4: Dynamic = (0,
      reactSheetsScrollArea_2.useCallback)((): Dynamic => {
        value2.current = null;
        value3.current = true;
      }, []),
      value5: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null),
      value6: Dynamic = (0, reactSheetsScrollArea_2.useRef)([]),
      value7: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null),
      value8: Dynamic = (0, reactSheetsScrollArea_2.useRef)(null);
    useInitialFocusGuard(input, value5, value8, value4, value6);
    (0, reactSheetsScrollArea_2.useLayoutEffect)((): Dynamic => {
      if (!value3.current || ((value3.current = false), !options && !context))
        return;
      let value11: Dynamic = value?.ownerDocument ?? document;
      if (!value5.current) {
        let value14: Dynamic = context?.current ?? null;
        value2.current =
          value14 !== null &&
          value14.isConnected &&
          !value7.current?.contains(value14)
            ? value14
            : null;
      }
      if (!options) return;
      let value12: Dynamic = (0, runtime.asElement)(value11.activeElement),
        value13: Dynamic = value12 && value12 !== value11.body ? value12 : null;
      !value13 ||
        value7.current?.contains(value13) ||
        normalizeFocusRelatedTarget(value13);
    }, [input, options, context, value]);
    let value9: Dynamic = !options,
      value10: Dynamic = (0,
      reactSheetsScrollArea_2.useCallback)((): Dynamic => {
        if (value9) {
          let current: Dynamic = value7.current,
            value11: Dynamic = value8.current?.ownerDocument ?? document,
            activeElement: Dynamic = value11.activeElement;
          if (
            activeElement &&
            activeElement !== value11.body &&
            !current?.contains(activeElement)
          )
            return false;
        }
        if (value5.current) {
          if (!value5.current.isConnected) {
            let value11: Dynamic = value6.current.find(
              (input2?: Dynamic): Dynamic => input2.isConnected,
            );
            if (value11) return restoreElementFocus(value11, value7.current);
          }
          return restoreElementFocus(value5.current, value7.current);
        }
        if (value2.current) {
          let current: Dynamic = value7.current,
            activeElement: Dynamic = (value8.current?.ownerDocument ?? document)
              .activeElement;
          return (activeElement &&
            isFocusableElement(activeElement) &&
            !current?.contains(activeElement)) ||
            !value2.current.isConnected
            ? false
            : null;
        }
        return false;
      }, [value9]);
    return (0, reactSheetsScrollArea_2.useMemo)(
      (): Dynamic => ({
        finalFocus: value10,
        popupRef: value7,
      }),
      [value10, value7],
    );
  }
  function restoreElementFocus(element?: Dynamic, options?: Dynamic): Dynamic {
    if (!element?.isConnected) return false;
    let activeElement: Dynamic = element.ownerDocument.activeElement;
    if (
      activeElement &&
      isFocusableElement(activeElement) &&
      !options?.contains(activeElement)
    )
      return false;
    let value: Dynamic = element;
    return value.tabIndex < 0
      ? (value.focus({
          preventScroll: true,
        }),
        false)
      : value;
  }
  function isFocusableElement(input?: Dynamic): Dynamic {
    return input.matches(SheetsScrollAreaLabel_2);
  }
  function createInnerOverlayStack(): Dynamic {
    let items: Dynamic = [];
    return {
      register: (input?: Dynamic): Dynamic => (
        items.push(input),
        (): Dynamic => {
          let value: Dynamic = items.lastIndexOf(input);
          value !== -1 && items.splice(value, 1);
        }
      ),
      topmostOpen: (): Dynamic => {
        for (let value: Dynamic = items.length - 1; value >= 0; value -= 1) {
          let value2: Dynamic = items[value];
          if (value2?.isOpen()) return value2;
        }
      },
    };
  }
  function useInnerOverlayRegistration(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, reactSheetsScrollArea_3.useContext)(
        InnerOverlaysContext,
      ),
      value2: Dynamic = (0, reactSheetsScrollArea_3.useRef)(input);
    (0, reactSheetsScrollArea_3.useEffect)((): Dynamic => {
      value2.current = input;
    }, [input]);
    (0, reactSheetsScrollArea_3.useEffect)((): Dynamic => {
      if (value !== null)
        return value.register({
          isOpen: (): Dynamic => value2.current.isOpen(),
          close: (): Dynamic => value2.current.close(),
        });
    }, [value]);
  }
  function closeInnerOverlayOnEscape(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = context;
    if (options || value.reason !== "escape-key") return false;
    let value2: Dynamic = input.topmostOpen();
    if (value2 === undefined) return false;
    value.cancel?.();
    let event: Dynamic = value.event;
    event?.currentTarget?.nodeType === SheetsScrollAreaConstant
      ? (event?.currentTarget?.defaultView ?? globalThis).setTimeout(
          (): Dynamic => {
            value2.isOpen() && value2.close();
          },
          0,
        )
      : (event?.preventDefault(), value2.close());
    return true;
  }
  function useMenuInnerOverlay(): Dynamic {
    let value: Dynamic = (0, reactSheetsScrollArea_4.useRef)(null),
      value2: Dynamic = (0, reactSheetsScrollArea_4.useContext)(
        runtime.MenuTriggerContext,
      );
    useInnerOverlayRegistration({
      isOpen: (): Dynamic =>
        value2 !== null && value.current?.hasAttribute("data-open") === true,
      close: (): Dynamic => value2?.current?.close?.(),
    });
    return {
      elementRef: value,
      overlayAttrs: SheetsScrollAreaSAConfig,
    };
  }
  bindRuntimeValue(
    runtime,
    "jsxSheetsScrollArea",
    () => jsxSheetsScrollArea,
    (value) => {
      jsxSheetsScrollArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaClassNames",
    () => SheetsScrollAreaClassNames,
    (value) => {
      SheetsScrollAreaClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaClassNames_2",
    () => SheetsScrollAreaClassNames_2,
    (value) => {
      SheetsScrollAreaClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaClassNames_3",
    () => SheetsScrollAreaClassNames_3,
    (value) => {
      SheetsScrollAreaClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaClassNames_4",
    () => SheetsScrollAreaClassNames_4,
    (value) => {
      SheetsScrollAreaClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaLabel",
    () => SheetsScrollAreaLabel,
    (value) => {
      SheetsScrollAreaLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea",
    () => initializeSheetsScrollArea,
    (value) => {
      initializeSheetsScrollArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isKeyboardContextMenu",
    () => isKeyboardContextMenu,
  );
  bindRuntimeValue(
    runtime,
    "recordKeyboardContextMenu",
    () => recordKeyboardContextMenu,
  );
  bindRuntimeValue(
    runtime,
    "useKeyboardContextMenuFocus",
    () => useKeyboardContextMenuFocus,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetsScrollArea",
    () => reactSheetsScrollArea,
    (value) => {
      reactSheetsScrollArea = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaElementCache",
    () => SheetsScrollAreaElementCache,
    (value) => {
      SheetsScrollAreaElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_2",
    () => initializeSheetsScrollArea_2,
    (value) => {
      initializeSheetsScrollArea_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaLabel_2",
    () => SheetsScrollAreaLabel_2,
    (value) => {
      SheetsScrollAreaLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_3",
    () => initializeSheetsScrollArea_3,
    (value) => {
      initializeSheetsScrollArea_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFocusRelatedTarget",
    () => normalizeFocusRelatedTarget,
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_4",
    () => initializeSheetsScrollArea_4,
    (value) => {
      initializeSheetsScrollArea_4 = value;
    },
  );
  bindRuntimeValue(runtime, "registerOpenerReturn", () => registerOpenerReturn);
  bindRuntimeValue(runtime, "openerReturnChain", () => openerReturnChain);
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaElementCache_2",
    () => SheetsScrollAreaElementCache_2,
    (value) => {
      SheetsScrollAreaElementCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaLimit",
    () => SheetsScrollAreaLimit,
    (value) => {
      SheetsScrollAreaLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_5",
    () => initializeSheetsScrollArea_5,
    (value) => {
      initializeSheetsScrollArea_5 = value;
    },
  );
  bindRuntimeValue(runtime, "useInitialFocusGuard", () => useInitialFocusGuard);
  bindRuntimeValue(runtime, "useOpenerReturn", () => useOpenerReturn);
  bindRuntimeValue(runtime, "connectedRefElement", () => connectedRefElement);
  bindRuntimeValue(runtime, "useFinalFocus", () => useFinalFocus);
  bindRuntimeValue(runtime, "restoreElementFocus", () => restoreElementFocus);
  bindRuntimeValue(runtime, "isFocusableElement", () => isFocusableElement);
  bindRuntimeValue(
    runtime,
    "reactSheetsScrollArea_2",
    () => reactSheetsScrollArea_2,
    (value) => {
      reactSheetsScrollArea_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_6",
    () => initializeSheetsScrollArea_6,
    (value) => {
      initializeSheetsScrollArea_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "overlayAttribute",
    () => overlayAttribute,
    (value) => {
      overlayAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "openOverlaySelector",
    () => openOverlaySelector,
    (value) => {
      openOverlaySelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlayAttributes",
    () => initializeOverlayAttributes,
    (value) => {
      initializeOverlayAttributes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createInnerOverlayStack",
    () => createInnerOverlayStack,
  );
  bindRuntimeValue(
    runtime,
    "useInnerOverlayRegistration",
    () => useInnerOverlayRegistration,
  );
  bindRuntimeValue(
    runtime,
    "closeInnerOverlayOnEscape",
    () => closeInnerOverlayOnEscape,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetsScrollArea_3",
    () => reactSheetsScrollArea_3,
    (value) => {
      reactSheetsScrollArea_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InnerOverlaysContext",
    () => InnerOverlaysContext,
    (value) => {
      InnerOverlaysContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaConstant",
    () => SheetsScrollAreaConstant,
    (value) => {
      SheetsScrollAreaConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_7",
    () => initializeSheetsScrollArea_7,
    (value) => {
      initializeSheetsScrollArea_7 = value;
    },
  );
  bindRuntimeValue(runtime, "useMenuInnerOverlay", () => useMenuInnerOverlay);
  bindRuntimeValue(
    runtime,
    "reactSheetsScrollArea_4",
    () => reactSheetsScrollArea_4,
    (value) => {
      reactSheetsScrollArea_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaSAConfig",
    () => SheetsScrollAreaSAConfig,
    (value) => {
      SheetsScrollAreaSAConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsScrollArea_8",
    () => initializeSheetsScrollArea_8,
    (value) => {
      initializeSheetsScrollArea_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaRegistry",
    () => SheetsScrollAreaRegistry,
    (value) => {
      SheetsScrollAreaRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaRegistry_2",
    () => SheetsScrollAreaRegistry_2,
    (value) => {
      SheetsScrollAreaRegistry_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaRegistry_3",
    () => SheetsScrollAreaRegistry_3,
    (value) => {
      SheetsScrollAreaRegistry_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsScrollAreaRegistry_4",
    () => SheetsScrollAreaRegistry_4,
    (value) => {
      SheetsScrollAreaRegistry_4 = value;
    },
  );
  return () => {
    initializeSheetsScrollArea = (0, runtime.initializeOnce)((): Dynamic => {
      (0, runtime.initializeClassNames)();
      (0, runtime.initializeSheetsPresentation)();
      (0, runtime.initializeNpm_clsx_xh)();
      jsxSheetsScrollArea = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      SheetsScrollAreaClassNames =
        "min-h-0 overflow-y-auto scroll-fade-y rounded-[inherit] border-b-[length:var(--cds-ring-inner)] border-transparent p-1";
      SheetsScrollAreaClassNames_2 =
        "min-h-0 flex-1 overflow-y-auto scroll-fade-y border-b-[length:var(--cds-ring-inner)] border-transparent p-1";
      SheetsScrollAreaClassNames_3 = "shrink-0 px-1 pt-1";
      SheetsScrollAreaClassNames_4 = "-mt-1 shrink-0 px-1 pb-1";
      SheetsScrollAreaLabel =
        "max(var(--cds-h-control), var(--cds-leading-body))";
    });
    initializeSheetsScrollArea_2 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeMenuConfiguration)();
      reactSheetsScrollArea = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      SheetsScrollAreaElementCache = new WeakMap();
    });
    initializeSheetsScrollArea_3 = (0, runtime.initializeOnce)((): Dynamic => {
      SheetsScrollAreaLabel_2 =
        "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])";
    });
    initializeSheetsScrollArea_4 = (0, runtime.initializeOnce)((): Dynamic => {
      (0, runtime.initializeHooksStableCallback)();
    });
    initializeSheetsScrollArea_5 = (0, runtime.initializeOnce)((): Dynamic => {
      SheetsScrollAreaElementCache_2 = new WeakMap();
      SheetsScrollAreaLimit = 8;
    });
    initializeSheetsScrollArea_6 = (0, runtime.initializeOnce)((): Dynamic => {
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeHooksStableCallback)();
      initializeSheetsScrollArea_3();
      initializeSheetsScrollArea_4();
      initializeSheetsScrollArea_5();
      reactSheetsScrollArea_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
    initializeOverlayAttributes = (0, runtime.initializeOnce)((): Dynamic => {
      overlayAttribute = "data-cds-overlay";
      openOverlaySelector = `[${overlayAttribute}][data-open]`;
    });
    initializeSheetsScrollArea_7 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      reactSheetsScrollArea_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      InnerOverlaysContext = (0, reactSheetsScrollArea_3.createContext)(null);
      SheetsScrollAreaConstant = 9;
    });
    initializeSheetsScrollArea_8 = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      initializeOverlayAttributes();
      (0, runtime.initializeMenuConfiguration)();
      initializeSheetsScrollArea_7();
      reactSheetsScrollArea_4 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      SheetsScrollAreaSAConfig = {
        [overlayAttribute]: "",
      };
    });
    SheetsScrollAreaRegistry = {};
    SheetsScrollAreaRegistry_2 = {};
    SheetsScrollAreaRegistry_3 = {};
    SheetsScrollAreaRegistry_4 = {};
  };
}

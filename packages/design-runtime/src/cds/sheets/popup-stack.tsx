/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsSheetsPopupStack(
  runtime: RuntimeBindings,
): () => void {
  var reactSheetsPopupStack: Dynamic;
  var jsxSheetsPopupStack: Dynamic;
  var SheetPopupContext: Dynamic;
  var SheetsPopupStackAt: Dynamic;
  var SheetStackContext: Dynamic;
  var SheetStateContext: Dynamic;
  var getInertPropsValue: Dynamic;
  var SheetsPopupStackDelayMs: Dynamic;
  var sheetActivityListenersInstalled: Dynamic;
  var SheetsPopupStackSubscribers: Dynamic;
  var SheetsPopupStackOutsidePressFocusOutEscapeKeySet: Dynamic;
  var SheetsPopupStackLimit: Dynamic;
  var SheetsPopupStackLabel: Dynamic;
  var SheetsPopupStackSheetPendingCoveredConfig: Dynamic;
  var SheetsPopupStackHandler: Dynamic;
  var SheetsPopupStackSheetConcealedChromeConfig: Dynamic;
  var SheetsPopupStackConcealedConfig: Dynamic;
  var SheetPopupBridgeContext: Dynamic;
  var initializeSheetsPopupStack: Dynamic;
  function useSheetStack(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = (0, reactSheetsPopupStack.useRef)(null);
    (0, runtime.useOverlayImperativeHandle)(value2, options);
    let value3: Dynamic = (0, reactSheetsPopupStack.useId)(),
      [value4, value5]: Dynamic = (0, reactSheetsPopupStack.useState)(),
      [value6, value7]: Dynamic = (0, reactSheetsPopupStack.useState)(true),
      value8: Dynamic = (0, reactSheetsPopupStack.useRef)([]),
      [value9, value10]: Dynamic = (0, reactSheetsPopupStack.useState)(
        "default",
      ),
      value11: Dynamic = (0, reactSheetsPopupStack.useRef)(new Set()),
      [value12, value13]: Dynamic = (0, reactSheetsPopupStack.useState)(false),
      [value14, value15]: Dynamic = (0, reactSheetsPopupStack.useState)(null),
      [value16, value17]: Dynamic = (0, reactSheetsPopupStack.useState)(input);
    input !== value16 &&
      (value17(input),
      input &&
        (value5(undefined), value7(true), value10("default"), value13(false)));
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      input || ((value8.current = []), (value11.current = new Set()));
    }, [input]);
    (0, runtime.useKeyboardViewport)(input && value12, value15, {
      unpan: true,
    });
    let { showing: value18, onOpenChangeComplete: value19 }: Dynamic = (0,
      runtime.useSheetPendingUnmount)(input),
      value20: Dynamic = (0, runtime.useOptionalStableCallback)(context),
      value21: Dynamic = (0, reactSheetsPopupStack.useRef)(null);
    (0, reactSheetsPopupStack.useEffect)((): Dynamic => {
      value21.current = null;
    }, [input]);
    let value22: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic): Dynamic => {
          value19(input2);
          value21.current !== input2 &&
            ((value21.current = input2), value20?.(input2));
        },
        [value19, value20],
      ),
      value23: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic, options2: Dynamic = true): Dynamic => {
          value8.current.length > 0 ||
            !(input2 > 0) ||
            ((value8.current = [
              {
                height: Math.round(input2),
                grows: options2,
              },
            ]),
            value5(Math.round(input2)),
            value7(options2));
        },
        [],
      ),
      value24: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic, options2?: Dynamic): Dynamic => {
          let current: Dynamic = value8.current,
            value30: Dynamic = current[0];
          value30 === undefined ||
            !(input2 > 0) ||
            ((value30.height = Math.round(input2)),
            options2 !== undefined && (value30.grows = options2),
            value5((0, runtime.sheetStackMaxHeight)(current)),
            value7(SheetsPopupStackAt(current)));
        },
        [],
      ),
      value25: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic, options2: Dynamic = true): Dynamic => {
          let state: Dynamic = {
              height: Math.round(input2),
              grows: options2,
            },
            current: Dynamic = value8.current;
          current.push(state);
          value5((0, runtime.sheetStackMaxHeight)(current));
          value7(SheetsPopupStackAt(current));
          let flag: Dynamic = false,
            callback: Dynamic = (): Dynamic =>
              !flag && current === value8.current;
          return {
            set: (input3?: Dynamic, options3?: Dynamic): Dynamic => {
              callback() &&
                ((state.height = Math.round(input3)),
                options3 !== undefined && (state.grows = options3),
                value5((0, runtime.sheetStackMaxHeight)(current)),
                value7(SheetsPopupStackAt(current)));
            },
            release: (): Dynamic => {
              if (flag) return;
              let value30: Dynamic = current.indexOf(state);
              flag = true;
              value30 >= 0 && current.splice(value30, 1);
              current === value8.current &&
                (value5((0, runtime.sheetStackMaxHeight)(current)),
                value7(SheetsPopupStackAt(current)));
            },
          };
        },
        [],
      ),
      value26: Dynamic = (0, reactSheetsPopupStack.useCallback)((): Dynamic => {
        let state: Dynamic = {},
          current: Dynamic = value11.current;
        current.add(state);
        value13(true);
        return (): Dynamic => {
          current.delete(state);
          current === value11.current && value13(current.size > 0);
        };
      }, []),
      value27: Dynamic = (0, runtime.useOptionalStableCallback)(value),
      value28: Dynamic = (0, reactSheetsPopupStack.useCallback)((): Dynamic => {
        value27 !== undefined ? value27() : value2.current?.close?.();
      }, [value27]),
      [value29]: Dynamic = (0, reactSheetsPopupStack.useState)(
        runtime.createSheetMutableCell,
      );
    return {
      showing: value18,
      frame: (0, reactSheetsPopupStack.useMemo)(
        (): Dynamic => ({
          treeId: value3,
          open: input,
          showing: value18,
          height: value4,
          pinHeight: value23,
          repinHeight: value24,
          pushLevelHeight: value25,
          canGrow: value6,
          detent: value9,
          setDetent: value10,
          holdTextEntryFocus: value26,
          keyboard: value14,
          dismiss: value28,
          drag: value29,
        }),
        [
          value3,
          input,
          value18,
          value4,
          value6,
          value23,
          value24,
          value25,
          value9,
          value26,
          value14,
          value28,
          value29,
        ],
      ),
      actionsRef: value2,
      onOpenChangeComplete: value22,
    };
  }
  function useIsSheet(): Dynamic {
    return (0, reactSheetsPopupStack.useContext)(SheetStateContext).sheet;
  }
  function useSheetState(): Dynamic {
    return (0, reactSheetsPopupStack.useContext)(SheetStateContext);
  }
  function isSheetAnnouncementTarget(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.target;
    return (
      value instanceof Element && value.closest(SheetsPopupStackLabel) !== null
    );
  }
  function useSheetPopup(input?: Dynamic): Dynamic {
    let {
        open: value,
        actionsRef: value2,
        close: value3,
        onOpenChange: value4,
        onOpenChangeComplete: value5,
        structurallyAnchored: value7 = false,
        closable: value8 = true,
        refuseClose: value6,
      }: Dynamic = input,
      value9: Dynamic = (0, reactSheetsPopupStack.useContext)(
        SheetStackContext,
      ),
      value10: Dynamic = (0, runtime.useOverlayPresentation)(),
      value11: Dynamic = (0, runtime.useMobileSheets)(),
      value12: Dynamic = useSheetStack(value, value2, value5, value3),
      value13: Dynamic = (0, runtime.useMobileSheetsLoaded)(),
      value14: Dynamic = (0, runtime.useMobileSheetsUnavailable)(),
      value15: Dynamic = (0, runtime.useTouchOverlay)();
    (0, reactSheetsPopupStack.useEffect)((): Dynamic => {
      value15 && !value13 && !value14 && (0, runtime.preloadMobileSheets)();
    }, [value15, value13, value14, value]);
    let value16: Dynamic = (0, runtime.useFrozenSheetMode)(
        (0, runtime.shouldUseSheet)(value10, false, value11) &&
          (value8 || value10 === "sheet"),
        value,
        value12.showing,
      ),
      [value17, value18]: Dynamic = (0, reactSheetsPopupStack.useState)(
        (): Dynamic => (sheetActivityListenersInstalled || value14) && !value13,
      ),
      [value19, value20]: Dynamic = (0, reactSheetsPopupStack.useState)(value);
    if (value !== value19) {
      value20(value);
      let value48: Dynamic =
        (sheetActivityListenersInstalled || value14) && !value13;
      value && value17 !== value48 && value18(value48);
    }
    value && value14 && !value13 && !value17 && value18(true);
    let value21: Dynamic = value16 && !value7 && !value13 && !value17;
    (0, reactSheetsPopupStack.useEffect)((): Dynamic => {
      if (!value21 || !value) return;
      let callback: Dynamic = (): Dynamic => {
        (0, runtime.areMobileSheetsLoaded)() ||
          ((sheetActivityListenersInstalled = true), value18(true));
      };
      SheetsPopupStackSubscribers.add(callback);
      let value48: Dynamic = setTimeout(callback, SheetsPopupStackDelayMs);
      return (): Dynamic => {
        SheetsPopupStackSubscribers.delete(callback);
        clearTimeout(value48);
      };
    }, [value21, value]);
    let value22: Dynamic = value16 && !value7 && !value17;
    (0, runtime.useAndroidCloseWatcher)(
      value && value16 && !value7 && value17,
      value12.frame.dismiss,
    );
    let value23: Dynamic = value22 && value12.showing && (!value13 || !value),
      value24: Dynamic = value22 && value9 !== null ? value9.depth + 1 : 0,
      value25: Dynamic = (0, reactSheetsPopupStack.useRef)(new Set()),
      value26: Dynamic = (0, reactSheetsPopupStack.useRef)(0),
      [value27, value28]: Dynamic = (0, reactSheetsPopupStack.useState)(false),
      value29: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic): Dynamic => (
          value25.current.add(input2),
          value28(true),
          (): Dynamic => {
            value25.current.delete(input2);
            value26.current = Date.now();
            value28(value25.current.size > 0);
          }
        ),
        [],
      ),
      [value30]: Dynamic = (0, reactSheetsPopupStack.useState)(
        (): Dynamic => ({}),
      );
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      if (!(!value22 || !value || value9 === null))
        return value9.cover(value30);
    }, [value22, value, value9, value30]);
    let value31: Dynamic = (0, runtime.useCdsWindow)(),
      treeId: Dynamic = value12.frame.treeId,
      [value32, value33]: Dynamic = (0, reactSheetsPopupStack.useState)(false);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      if (!value27 || value31 === undefined) return;
      let index: Dynamic = 0,
        callback: Dynamic = (): Dynamic => {
          let activeElement: Dynamic = value31.document.activeElement;
          if (
            activeElement !== null &&
            activeElement.closest(
              `[data-sheet-tree="${CSS.escape(treeId)}"]`,
            ) !== null
          ) {
            index = value31.requestAnimationFrame(callback);
            return;
          }
          value33(true);
        };
      index = value31.requestAnimationFrame(callback);
      return (): Dynamic => {
        value31.cancelAnimationFrame(index);
        value33(false);
      };
    }, [value27, treeId, value31]);
    let value34: Dynamic = value27 && value32,
      value35: Dynamic = (0, runtime.useOptionalStableCallback)(value4),
      value36: Dynamic = (0, runtime.useOptionalStableCallback)(value6),
      value37: Dynamic = (0, reactSheetsPopupStack.useRef)(value22);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      value37.current = value22;
    }, [value22]);
    let value38: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic): Dynamic =>
          input2.reason === undefined
            ? false
            : (value25.current.size > 0 ||
                  Date.now() - value26.current < SheetsPopupStackLimit) &&
                SheetsPopupStackOutsidePressFocusOutEscapeKeySet.has(
                  input2.reason,
                )
              ? true
              : value37.current &&
                input2.reason === "outside-press" &&
                isSheetAnnouncementTarget(input2.event),
        [],
      ),
      value39: Dynamic = (0, reactSheetsPopupStack.useRef)(null),
      value40: Dynamic = (0, reactSheetsPopupStack.useCallback)((): Dynamic => {
        let current: Dynamic = value39.current;
        value39.current = null;
        return current?.isCanceled === true ? null : current;
      }, []),
      value41: Dynamic = (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic, options?: Dynamic): Dynamic => {
          let value48: Dynamic = options;
          if (!input2 && value38(value48)) {
            value48.cancel?.();
            return;
          }
          if (
            !input2 &&
            value37.current &&
            value36?.(options, treeId) === true
          ) {
            value48.cancel?.();
            return;
          }
          value39.current = input2 ? null : value48;
          input2 ||
            value31?.requestAnimationFrame((): Dynamic => {
              value39.current === value48 && (value39.current = null);
            });
          input2 && value15 && (0, runtime.preloadMobileSheets)();
          value35?.(input2, options);
        },
        [value35, value36, value38, treeId, value15, value31],
      ),
      value42: Dynamic = (0, reactSheetsPopupStack.useMemo)(
        (): Dynamic => ({
          sheet: value22,
          pending: value23,
          covered: value27,
          inert: value34,
          depth: value24,
        }),
        [value22, value23, value27, value34, value24],
      ),
      value43: Dynamic = value9?.frameHeight,
      value44: Dynamic = (0, reactSheetsPopupStack.useMemo)((): Dynamic => {
        let value48: Dynamic =
          value12.frame.height !== undefined && value43 !== undefined
            ? Math.max(value12.frame.height, value43)
            : value12.frame.height;
        return value48 !== value12.frame.height
          ? {
              ...value12.frame,
              height: value48,
            }
          : value12.frame;
      }, [value12.frame, value43]),
      value45: Dynamic = (0, reactSheetsPopupStack.useMemo)(
        (): Dynamic => ({
          ...value44,
          refusesAmbientClose: value38,
          takeCloseRequest: value40,
        }),
        [value44, value38, value40],
      ),
      value46: Dynamic = (0, runtime.sheetFrameHeight)(value44, value31),
      value47: Dynamic = (0, reactSheetsPopupStack.useMemo)(
        (): Dynamic => ({
          depth: value24,
          frameHeight: value46,
          cover: value29,
        }),
        [value24, value46, value29],
      );
    return {
      sheet: value22,
      showing: value12.showing,
      frame: value45,
      actionsRef: value12.actionsRef,
      onOpenChange: value41,
      onOpenChangeComplete: value12.onOpenChangeComplete,
      modal: value22 ? true : undefined,
      state: value42,
      stack: value47,
    };
  }
  function ResetSheetContext({ children: children }: Dynamic): Dynamic {
    return (
      <SheetStateContext.Provider
        value={SheetsPopupStackSheetPendingCoveredConfig}
      >
        <SheetStackContext.Provider value={null}>
          <SheetPopupBridgeContext.Provider value={null}>
            <SheetPopupContext.Provider value={null}>
              {children}
            </SheetPopupContext.Provider>
          </SheetPopupBridgeContext.Provider>
        </SheetStackContext.Provider>
      </SheetStateContext.Provider>
    );
  }
  function SheetPopupRender(input?: Dynamic): Dynamic {
    let { children: value, ...value2 }: Dynamic = input,
      value3: Dynamic = useSheetPopup(value2);
    return (
      <SheetPopupProvider value={value3}>{value(value3)}</SheetPopupProvider>
    );
  }
  function SheetPopupProvider({
    value: value,
    children: children,
  }: Dynamic): Dynamic {
    return (
      <SheetStateContext.Provider value={value.state}>
        <SheetPopupBridgeContext.Provider value={value.stack.cover}>
          <SheetPopupContext.Provider value={value.frame}>
            {children}
          </SheetPopupContext.Provider>
        </SheetPopupBridgeContext.Provider>
      </SheetStateContext.Provider>
    );
  }
  function useOverlayOpenState(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactSheetsPopupStack.useState)(
        input.defaultOpen ?? false,
      ),
      value3: Dynamic = input.open ?? value,
      value4: Dynamic = (0, runtime.useOptionalStableCallback)(
        input.onOpenChange,
      );
    return {
      open: value3,
      onOpenChange: (0, reactSheetsPopupStack.useCallback)(
        (input2?: Dynamic, options?: Dynamic): Dynamic => {
          value4?.(input2, options);
          options.isCanceled || value2(input2);
        },
        [value4],
      ),
    };
  }
  function isInsideSheetPopup(): Dynamic {
    return (0, reactSheetsPopupStack.useContext)(SheetPopupContext) !== null;
  }
  function useSheetInteractionMode(): Dynamic {
    let value: Dynamic = (0, runtime.useTouchOverlay)(),
      value2: Dynamic =
        (0, reactSheetsPopupStack.useContext)(SheetPopupContext) !== null;
    return value || value2;
  }
  function useAvailableSheetParts(): Dynamic {
    let value: Dynamic = (0, runtime.useMobileSheetComponents)(),
      value2: Dynamic = (0, reactSheetsPopupStack.useContext)(
        SheetPopupContext,
      ),
      value3: Dynamic = value2?.showing ?? false,
      value4: Dynamic = value2?.open ?? false,
      { sheet: value5 }: Dynamic = useSheetState(),
      value6: Dynamic = !value3 || (value5 && value4),
      [value7, value8]: Dynamic = (0, reactSheetsPopupStack.useState)(
        (): Dynamic => (value !== null && value6 ? value : null),
      );
    return value7 === null && value !== null && value6
      ? (value8(value), value)
      : value7;
  }
  function prefersReducedMotion(): Dynamic {
    return typeof window === "undefined" || typeof document === "undefined"
      ? false
      : (typeof (window as Dynamic).matchMedia == "function" &&
          (window as Dynamic).matchMedia(runtime.reducedMotionMediaQuery)
            .matches) ||
          (document as Dynamic).documentElement.getAttribute(
            runtime.reducedMotionAttribute,
          ) === "true";
  }
  bindRuntimeValue(runtime, "useSheetStack", () => useSheetStack);
  bindRuntimeValue(runtime, "useIsSheet", () => useIsSheet);
  bindRuntimeValue(runtime, "useSheetState", () => useSheetState);
  bindRuntimeValue(
    runtime,
    "isSheetAnnouncementTarget",
    () => isSheetAnnouncementTarget,
  );
  bindRuntimeValue(runtime, "useSheetPopup", () => useSheetPopup);
  bindRuntimeValue(runtime, "ResetSheetContext", () => ResetSheetContext);
  bindRuntimeValue(runtime, "SheetPopupRender", () => SheetPopupRender);
  bindRuntimeValue(runtime, "SheetPopupProvider", () => SheetPopupProvider);
  bindRuntimeValue(runtime, "useOverlayOpenState", () => useOverlayOpenState);
  bindRuntimeValue(runtime, "isInsideSheetPopup", () => isInsideSheetPopup);
  bindRuntimeValue(
    runtime,
    "useSheetInteractionMode",
    () => useSheetInteractionMode,
  );
  bindRuntimeValue(
    runtime,
    "useAvailableSheetParts",
    () => useAvailableSheetParts,
  );
  bindRuntimeValue(
    runtime,
    "reactSheetsPopupStack",
    () => reactSheetsPopupStack,
    (value) => {
      reactSheetsPopupStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxSheetsPopupStack",
    () => jsxSheetsPopupStack,
    (value) => {
      jsxSheetsPopupStack = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetPopupContext",
    () => SheetPopupContext,
    (value) => {
      SheetPopupContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackAt",
    () => SheetsPopupStackAt,
    (value) => {
      SheetsPopupStackAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetStackContext",
    () => SheetStackContext,
    (value) => {
      SheetStackContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetStateContext",
    () => SheetStateContext,
    (value) => {
      SheetStateContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getInertPropsValue",
    () => getInertPropsValue,
    (value) => {
      getInertPropsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackDelayMs",
    () => SheetsPopupStackDelayMs,
    (value) => {
      SheetsPopupStackDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sheetActivityListenersInstalled",
    () => sheetActivityListenersInstalled,
    (value) => {
      sheetActivityListenersInstalled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackSubscribers",
    () => SheetsPopupStackSubscribers,
    (value) => {
      SheetsPopupStackSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackOutsidePressFocusOutEscapeKeySet",
    () => SheetsPopupStackOutsidePressFocusOutEscapeKeySet,
    (value) => {
      SheetsPopupStackOutsidePressFocusOutEscapeKeySet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackLimit",
    () => SheetsPopupStackLimit,
    (value) => {
      SheetsPopupStackLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackLabel",
    () => SheetsPopupStackLabel,
    (value) => {
      SheetsPopupStackLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackSheetPendingCoveredConfig",
    () => SheetsPopupStackSheetPendingCoveredConfig,
    (value) => {
      SheetsPopupStackSheetPendingCoveredConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackHandler",
    () => SheetsPopupStackHandler,
    (value) => {
      SheetsPopupStackHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackSheetConcealedChromeConfig",
    () => SheetsPopupStackSheetConcealedChromeConfig,
    (value) => {
      SheetsPopupStackSheetConcealedChromeConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsPopupStackConcealedConfig",
    () => SheetsPopupStackConcealedConfig,
    (value) => {
      SheetsPopupStackConcealedConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetPopupBridgeContext",
    () => SheetPopupBridgeContext,
    (value) => {
      SheetPopupBridgeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsPopupStack",
    () => initializeSheetsPopupStack,
    (value) => {
      initializeSheetsPopupStack = value;
    },
  );
  bindRuntimeValue(runtime, "prefersReducedMotion", () => prefersReducedMotion);
  return () => {
    initializeSheetsPopupStack = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeMobileSheetLoader)();
      (0, runtime.initializeHooksLayoutEffect)();
      (0, runtime.initializeCdsRoot)();
      (0, runtime.initializeOverlaysAndroidCloseWatcher)();
      (0, runtime.initializeHooksStableCallback_2)();
      (0, runtime.initializeOverlaysImperativeHandle)();
      (0, runtime.initializeDomInert)();
      (0, runtime.initializeSheetsKeyboardViewport)();
      (0, runtime.initializeSheetsLayout)();
      (0, runtime.initializeSheetsPresentation)();
      reactSheetsPopupStack = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      jsxSheetsPopupStack = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
      );
      SheetPopupContext = (0, reactSheetsPopupStack.createContext)(null);
      SheetsPopupStackAt = (input?: Dynamic): Dynamic =>
        input.at(-1)?.grows ?? true;
      SheetStackContext = (0, reactSheetsPopupStack.createContext)(null);
      SheetStateContext = (0, reactSheetsPopupStack.createContext)({
        sheet: false,
        pending: false,
        covered: false,
        inert: false,
        depth: 0,
      });
      getInertPropsValue = (0, runtime.getInertProps)(true);
      SheetsPopupStackDelayMs = 600;
      sheetActivityListenersInstalled = false;
      SheetsPopupStackSubscribers = new Set();
      SheetsPopupStackOutsidePressFocusOutEscapeKeySet = new Set([
        "outside-press",
        "focus-out",
        "escape-key",
      ]);
      SheetsPopupStackLimit = 120;
      SheetsPopupStackLabel =
        '[data-cds="Toast"], [aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]';
      SheetsPopupStackSheetPendingCoveredConfig = {
        sheet: false,
        pending: false,
        covered: false,
        inert: false,
        depth: 0,
      };
      SheetsPopupStackHandler = (): Dynamic => {};
      SheetsPopupStackSheetConcealedChromeConfig = {
        sheet: false,
        concealed: false,
        chrome: null,
        ref: SheetsPopupStackHandler,
        style: undefined,
        positionerStyle: undefined,
        attrs: {},
        frame: null,
        state: SheetsPopupStackSheetPendingCoveredConfig,
        stack: null,
      };
      SheetsPopupStackConcealedConfig = {
        ...SheetsPopupStackSheetConcealedChromeConfig,
        concealed: true,
      };
      SheetPopupBridgeContext = (0, reactSheetsPopupStack.createContext)(null);
    });
  };
}

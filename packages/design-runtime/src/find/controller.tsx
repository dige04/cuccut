/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFindController(runtime: RuntimeBindings): () => void {
  var react_Cl: Dynamic;
  var reactDOM_jCt: Dynamic;
  var emptyFindStatus: Dynamic;
  var blockingFindDialogSelector: Dynamic;
  function createFindController(
    adapter?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = options.debounceMs ?? 120,
      values: Dynamic = new Set(),
      value2: Dynamic = emptyFindStatus,
      items: Dynamic = [],
      value3: Dynamic = -1,
      value4: Dynamic,
      text: Dynamic = "",
      value5: Dynamic,
      value6: Dynamic,
      value7: Dynamic,
      flag: Dynamic = false,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        value2 = input;
        for (let value9 of [...values] as Dynamic) value9(value2);
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        input === undefined ? undefined : adapter.describe?.(input),
      callback3: Dynamic = (): Dynamic => {
        value4 !== undefined && clearTimeout(value4);
        value4 = undefined;
      },
      callback4: Dynamic = async (input: Dynamic = 1): Promise<Dynamic> => {
        value7?.abort();
        let controller: Dynamic = new AbortController();
        value7 = controller;
        let values2: Dynamic = new Set();
        for (; !controller.signal.aborted && !flag; ) {
          let value9: Dynamic = items[value3];
          if (value9 === undefined || values2.has(value9.key)) return;
          values2.add(value9.key);
          value5 = value9.key;
          let value10: Dynamic;
          try {
            value10 = await adapter.reveal(value9, controller.signal);
          } catch {
            return;
          }
          if (
            controller.signal.aborted ||
            flag ||
            items[value3]?.key !== value9.key
          )
            return;
          if (value10 !== false) {
            adapter.paint(items, value3);
            return;
          }
          items = items.filter(
            (input2?: Dynamic): Dynamic => input2.key !== value9.key,
          );
          value3 =
            items.length === 0
              ? -1
              : input === 1
                ? value3 % items.length
                : (value3 - 1 + items.length) % items.length;
          callback({
            ...value2,
            total: items.length,
            current: value3 + 1,
            place: callback2(items[value3]),
          });
          adapter.paint(items, value3);
        }
      },
      callback5: Dynamic = async (): Promise<Dynamic> => {
        callback3();
        value6?.abort();
        let controller: Dynamic = new AbortController();
        value6 = controller;
        let query: Dynamic = value2.query,
          value9: Dynamic;
        try {
          value9 = await adapter.search(query, controller.signal);
        } catch {
          value9 = [];
        }
        if (controller.signal.aborted || flag || query !== value2.query) return;
        let value10: Dynamic = query !== text,
          value11: Dynamic = value10 ? undefined : items[value3]?.key,
          value12: Dynamic = value9.length > 1e3;
        items = value12 ? value9.slice(0, 1e3) : value9;
        (value10 || items.length === 0) && (value5 = undefined);
        text = query;
        let value13: Dynamic =
          value11 === undefined
            ? -1
            : items.findIndex(
                (input?: Dynamic): Dynamic => input.key === value11,
              );
        value3 =
          items.length === 0
            ? -1
            : value13 !== -1
              ? value13
              : value10
                ? 0
                : Math.min(Math.max(value3, 0), items.length - 1);
        callback({
          query: query,
          total: items.length,
          current: value3 + 1,
          capped: value12,
          searching: false,
          place: callback2(items[value3]),
        });
        adapter.paint(items, value3);
        value10 && callback4();
      },
      callback6: Dynamic = (): Dynamic => {
        callback3();
        if (value <= 0) {
          callback5();
          return;
        }
        value4 = setTimeout((): Dynamic => {
          callback5();
        }, value);
      },
      callback7: Dynamic = (): Dynamic => {
        callback3();
        text = "";
        value6?.abort();
        value7?.abort();
        items = [];
        value3 = -1;
        adapter.clear();
      },
      value8: Dynamic = adapter.subscribe?.((): Dynamic => {
        !flag && value2.query !== "" && callback6();
      });
    return {
      setQuery(input: Dynamic): Dynamic {
        if (!(flag || input === value2.query)) {
          if (input === "") {
            callback7();
            callback(emptyFindStatus);
            return;
          }
          value6?.abort();
          value7?.abort();
          callback({
            ...value2,
            query: input,
            searching: true,
          });
          callback6();
        }
      },
      step(input: Dynamic): Dynamic {
        if (!(flag || value2.query === "")) {
          if (value2.query !== text) {
            value4 !== undefined && callback5();
            return;
          }
          items.length !== 0 &&
            (items[value3]?.key === value5 &&
              (value3 = (value3 + input + items.length) % items.length),
            callback({
              ...value2,
              current: value3 + 1,
              place: callback2(items[value3]),
            }),
            adapter.paint(items, value3),
            callback4(input));
        }
      },
      clear(): Dynamic {
        flag ||
          (callback7(),
          value2 !== emptyFindStatus && callback(emptyFindStatus));
      },
      status: (): Dynamic => value2,
      subscribe(input: Dynamic): Dynamic {
        values.add(input);
        return (): Dynamic => {
          values.delete(input);
        };
      },
      dispose(): Dynamic {
        flag || (callback7(), (flag = true), value8?.(), values.clear());
      },
    };
  }
  function isFindBlockedByDialog(document2?: Dynamic): Dynamic {
    return (
      !!document2.fullscreenElement ||
      [...document2.querySelectorAll(blockingFindDialogSelector)].some(
        (input?: Dynamic): Dynamic => !(0, runtime.isClosedOverlay)(input),
      )
    );
  }
  function isFindBlockedByLinkMode(document2?: Dynamic): Dynamic {
    return document2.activeElement?.closest("[data-link-mode]") != null;
  }
  function isApplicationRootInert(document2?: Dynamic): Dynamic {
    return document2.getElementById("root")?.hasAttribute("inert") === true;
  }
  function dispatchFindEscape(document2?: Dynamic): Dynamic {
    let value: Dynamic = document2.defaultView?.KeyboardEvent;
    if (value === undefined) return;
    let value2: Dynamic = new value("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
        cancelable: true,
      }),
      activeElement: Dynamic = document2.activeElement,
      value3: Dynamic =
        activeElement?.closest(runtime.blockingOverlaySelector) ?? null;
    activeElement !== null &&
      value3 !== null &&
      value3 !== activeElement &&
      (0, runtime.isTextEditableTarget)(activeElement) &&
      activeElement.blur();
    (value3 !== null && document2.activeElement !== activeElement
      ? value3
      : (activeElement ?? document2.body)
    ).dispatchEvent(value2);
    value2.preventDefault();
  }
  function useFindInPage({
    adapter: adapter,
    enabled: enabled,
    isOurs: isOurs,
    ownsStepChord: ownsStepChord,
    viewMoves: viewMoves,
    restoreFocus: restoreFocus,
    returnTo: returnTo,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, react_Cl.useState)(false),
      [value3, value4]: Dynamic = (0, react_Cl.useState)(false),
      value5: Dynamic = (0, react_Cl.useRef)(null),
      value6: Dynamic = (0, react_Cl.useRef)(null),
      value7: Dynamic = (0, react_Cl.useRef)(null),
      value8: Dynamic = (0, react_Cl.useRef)(0),
      value9: Dynamic = (0, react_Cl.useRef)(0),
      value10: Dynamic = (0, react_Cl.useRef)({
        adapter: adapter,
        isOpen: value,
        enabled: enabled,
        isOurs: isOurs,
        ownsStepChord: ownsStepChord,
        viewMoves: viewMoves,
        restoreFocus: restoreFocus,
        returnTo: returnTo,
      });
    (0, react_Cl.useEffect)((): Dynamic => {
      value10.current = {
        adapter: adapter,
        isOpen: value,
        enabled: enabled,
        isOurs: isOurs,
        ownsStepChord: ownsStepChord,
        viewMoves: viewMoves,
        restoreFocus: restoreFocus,
        returnTo: returnTo,
      };
    });
    let [{ controller: value11, changes: value12 }]: Dynamic = (0,
    react_Cl.useState)((): Dynamic => {
      (0, runtime.installFindKeyboardHandlers)(window);
      let state: Dynamic = {};
      return {
        controller: createFindController({
          search: (input?: Dynamic, options?: Dynamic): Dynamic =>
            value10.current.adapter.search(input, options),
          reveal: (input?: Dynamic, options?: Dynamic): Dynamic =>
            value10.current.adapter.reveal(input, options),
          paint: (input?: Dynamic, options?: Dynamic): Dynamic =>
            value10.current.adapter.paint(input, options),
          clear: (): Dynamic => value10.current.adapter.clear(),
          describe: (input?: Dynamic): Dynamic =>
            value10.current.adapter.describe?.(input),
          subscribe: (input?: Dynamic): Dynamic => (
            (state.notify = input),
            (): Dynamic => {
              state.notify = undefined;
            }
          ),
        }),
        changes: state,
      };
    });
    (0, react_Cl.useEffect)(
      (): Dynamic => adapter.subscribe?.((): Dynamic => value12.notify?.()),
      [adapter, value12],
    );
    (0, react_Cl.useEffect)(
      (): Dynamic => (): Dynamic => {
        value8.current++;
        value11.clear();
      },
      [value11],
    );
    let value13: Dynamic = (0, react_Cl.useCallback)((): Dynamic => {
        let current: Dynamic = value10.current,
          isOpen: Dynamic = current.isOpen,
          activeElement: Dynamic = (document as Dynamic).activeElement;
        try {
          (typeof activeElement?.closest == "function" &&
            activeElement.closest("[" + runtime.McFindAttribute + "]") !==
              null) ||
            ((value6.current =
              typeof activeElement?.focus == "function" ? activeElement : null),
            (value7.current =
              value6.current === null
                ? null
                : (current.returnTo?.(value6.current) ?? null)),
            (value9.current = current.viewMoves?.() ?? 0));
          isOpen || (0, reactDOM_jCt.flushSync)((): Dynamic => value2(true));
          let current2: Dynamic = value5.current;
          current2 !== null &&
            activeElement?.tagName === "IFRAME" &&
            (activeElement.blur(), (window as Dynamic).focus());
          current2?.focus();
          if (
            current2 !== null &&
            (document as Dynamic).activeElement === current2
          ) {
            current2.select();
            return true;
          }
        } catch {}
        isOpen || value2(false);
        return false;
      }, []),
      value14: Dynamic = (0, react_Cl.useCallback)(
        (): Dynamic =>
          value10.current.enabled && !isFindBlockedByDialog(document),
        [],
      ),
      value15: Dynamic = (0, react_Cl.useCallback)(
        (input?: Dynamic): Dynamic => {
          if (value10.current.isOurs?.(input) === false) return false;
          let value22: Dynamic = ++value8.current;
          if (!value14() || isFindBlockedByLinkMode(document)) return true;
          if ((0, runtime.hasBlockingOverlay)(document)) {
            let index: Dynamic = 0,
              callback: Dynamic = (): Dynamic => {
                if (value22 !== value8.current || !value14()) return;
                let flag: Dynamic = false;
                try {
                  (0, runtime.hasBlockingOverlay)(document)
                    ? index > 0 &&
                      index % 6 === 0 &&
                      index <= 18 &&
                      dispatchFindEscape(document)
                    : isApplicationRootInert(document) || (flag = value13());
                } catch {
                  flag = false;
                }
                !flag &&
                  ++index < 40 &&
                  (window as Dynamic).requestAnimationFrame(callback);
              };
            dispatchFindEscape(document);
            (window as Dynamic).requestAnimationFrame(callback);
            return true;
          }
          return isApplicationRootInert(document) ? true : value13();
        },
        [value13, value14],
      ),
      value16: Dynamic = (0, react_Cl.useCallback)(
        (input?: Dynamic): Dynamic => {
          !isFindBlockedByDialog(document) &&
            !isApplicationRootInert(document) &&
            !isFindBlockedByLinkMode(document) &&
            value11.step(input);
        },
        [value11],
      ),
      value17: Dynamic = (0, react_Cl.useCallback)(
        (event?: Dynamic): Dynamic => {
          let value22: Dynamic = event.defaultPrevented
            ? undefined
            : (0, runtime.findDirectionShortcut)(event);
          if (
            !(
              value22 === undefined ||
              value10.current.isOurs?.(event.target) === false
            ) &&
            !(
              event.key !== "F3" &&
              value10.current.ownsStepChord?.(event) === true
            )
          ) {
            if (!value10.current.isOpen) {
              value15(event.target) && event.preventDefault();
              return;
            }
            event.preventDefault();
            value16(value22);
          }
        },
        [value15, value16],
      ),
      value18: Dynamic = (0, react_Cl.useCallback)(
        (input?: Dynamic): Dynamic => {
          let current: Dynamic = value10.current;
          if (!current.isOpen) return;
          value11.clear();
          let current2: Dynamic = value6.current,
            current3: Dynamic = value7.current;
          value6.current = null;
          value7.current = null;
          let activeElement: Dynamic = (document as Dynamic).activeElement,
            value22: Dynamic =
              input &&
              (activeElement === null ||
                activeElement === (document as Dynamic).body ||
                activeElement.closest("[" + runtime.McFindAttribute + "]") !==
                  null),
            value23: Dynamic = value22 ? (current3?.() ?? null) : null,
            value24: Dynamic =
              value23 ?? (value22 && current3 === null ? current2 : null),
            value25: Dynamic = (current.viewMoves?.() ?? 0) !== value9.current,
            value26: Dynamic =
              value22 && value24?.isConnected === true && !value25
                ? value24
                : null;
          value26?.focus(
            value26 === value23
              ? {
                  preventScroll: true,
                }
              : undefined,
          );
          let activeElement2: Dynamic = (document as Dynamic).activeElement,
            value27: Dynamic =
              value26 !== null &&
              activeElement2 !== null &&
              activeElement2 !== (document as Dynamic).body &&
              activeElement2.closest("[" + runtime.McFindAttribute + "]") ===
                null;
          value2(false);
          value22 && !value27 && current.restoreFocus?.();
        },
        [value11],
      ),
      value19: Dynamic = (0, react_Cl.useCallback)(
        (): Dynamic => value18(true),
        [value18],
      ),
      value20: Dynamic = (0, react_Cl.useCallback)((): Dynamic => {
        value15(null);
      }, [value15]);
    (0, runtime.useFrameFind)(value3, value20);
    (0, react_Cl.useEffect)((): Dynamic => {
      enabled || value18(false);
    }, [enabled, value18]);
    (0, react_Cl.useEffect)((): Dynamic => {
      let callback: Dynamic = (event?: Dynamic): Dynamic => {
        try {
          if (event.isComposing) {
            ((0, runtime.isFindShortcut)(event) ||
              (0, runtime.findDirectionShortcut)(event) !== undefined) &&
              value10.current.isOurs?.(event.target) !== false &&
              event.preventDefault();
            return;
          }
          (0, runtime.isFindShortcut)(event)
            ? value15(event.target) && event.preventDefault()
            : value17(event);
        } catch {
          return;
        }
      };
      (window as Dynamic).addEventListener("keydown", callback, true);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("keydown", callback, true);
    }, [value15, value17]);
    let value21: Dynamic = (0, react_Cl.useCallback)(
      (
        input?: Dynamic,
        options?: Dynamic,
        context: Dynamic = (input2?: Dynamic): Dynamic => input2(),
      ): Dynamic => {
        let value22: Dynamic = (0, runtime.guardedNativeEventHandler)(
            {
              findKey: (): Dynamic => value15(null),
              isOpen: (): Dynamic => value10.current.isOpen,
              step: (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                context((): Dynamic => value16(input2), options2),
              ownsStepChord: (input2?: Dynamic): Dynamic =>
                value10.current.ownsStepChord?.(input2) === true,
            },
            undefined,
            options,
          ),
          items: Dynamic = [
            (0, runtime.addNativeEventListener)(
              input,
              "keydown",
              value22,
              true,
            ),
            (0, runtime.addNativeEventListener)(
              input,
              "keydown",
              value22,
              false,
            ),
          ];
        return (): Dynamic =>
          items.forEach((input2?: Dynamic): Dynamic => input2());
      },
      [value15, value16],
    );
    return (0, react_Cl.useMemo)(
      (): Dynamic => ({
        isOpen: value,
        open: value20,
        close: value19,
        step: value16,
        attach: value21,
        bar: {
          open: value,
          subscribe: value11.subscribe,
          getStatus: value11.status,
          fieldRef: value5,
          onQuery: value11.setQuery,
          onStep: value16,
          onClose: value19,
          onMounted: value4,
        },
      }),
      [value, value20, value19, value16, value21, value11],
    );
  }
  bindRuntimeValue(
    runtime,
    "react_Cl",
    () => react_Cl,
    (value) => {
      react_Cl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOM_jCt",
    () => reactDOM_jCt,
    (value) => {
      reactDOM_jCt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptyFindStatus",
    () => emptyFindStatus,
    (value) => {
      emptyFindStatus = value;
    },
  );
  bindRuntimeValue(runtime, "createFindController", () => createFindController);
  bindRuntimeValue(
    runtime,
    "blockingFindDialogSelector",
    () => blockingFindDialogSelector,
    (value) => {
      blockingFindDialogSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFindBlockedByDialog",
    () => isFindBlockedByDialog,
  );
  bindRuntimeValue(
    runtime,
    "isFindBlockedByLinkMode",
    () => isFindBlockedByLinkMode,
  );
  bindRuntimeValue(
    runtime,
    "isApplicationRootInert",
    () => isApplicationRootInert,
  );
  bindRuntimeValue(runtime, "dispatchFindEscape", () => dispatchFindEscape);
  bindRuntimeValue(runtime, "useFindInPage", () => useFindInPage);
  return () => {
    react_Cl = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    reactDOM_jCt = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom)(),
      1,
    );
    emptyFindStatus = {
      query: "",
      total: 0,
      current: 0,
      capped: false,
      searching: false,
    };
    blockingFindDialogSelector =
      '[data-cds="Dialog"], [role="alertdialog"]:not([aria-modal="false"]), [role="dialog"][aria-modal="true"]';
  };
}

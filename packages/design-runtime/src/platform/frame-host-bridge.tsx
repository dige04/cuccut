/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformFrameHostBridge(
  runtime: RuntimeBindings,
): () => void {
  var PlatformFrameHostBridgeItems: Dynamic;
  var allowedFrameHostOrigins: Dynamic;
  var createFrameHostBridgeValue: Dynamic;
  var PanelValue: Dynamic;
  var PopoverValue: Dynamic;
  var reactPlatformFrameHostBridge: Dynamic;
  function hostSaveStatus(input?: Dynamic): Dynamic {
    switch (input) {
      case "loading":
        return null;
      case "cached":
        return "reconnecting";
      case "ready":
      case "saved":
        return "saved";
      case "dirty":
      case "saving":
        return "saving";
      case "readonly":
        return "readonly";
      case "error":
        return "unsaved";
    }
  }
  function getHostOrigins(input?: Dynamic): Dynamic {
    let value: Dynamic = input.__FRAME_PREAMBLE?.origins;
    return Array.isArray(value)
      ? value.filter((input2?: Dynamic): Dynamic => typeof input2 == "string")
      : PlatformFrameHostBridgeItems;
  }
  function isAllowedHostOrigin(input?: Dynamic, options?: Dynamic): Dynamic {
    for (let value of options as Dynamic)
      if (value.endsWith(":*"))
        try {
          let value2: Dynamic = new URL(input);
          if (`${value2.protocol}//${value2.hostname}:*` === value) return true;
        } catch {}
      else if (input === value) return true;
    return false;
  }
  function normalizeHostExports(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      values: Dynamic = new Set();
    for (let value of input as Dynamic) {
      if (
        typeof value.format != "string" ||
        !runtime.CanvasMeasurementsPattern.test(value.format) ||
        values.has(value.format)
      )
        continue;
      values.add(value.format);
      let value2: Dynamic = value.handoff === true,
        state: Dynamic = {
          format: value.format,
          ...(value.disabled === true && {
            disabled: true,
          }),
          ...(!value2 &&
            value.interactive === true && {
              interactive: true,
            }),
          ...(!value2 &&
            value.bundle === true && {
              bundle: true,
            }),
          ...(value2 && {
            handoff: value2,
          }),
        },
        value3: Dynamic =
          !value2 && Array.isArray(value.variants)
            ? normalizeHostFindCommands(value.variants)
            : [];
      value3.length > 0 && (state.variants = value3);
      items.push(state);
      if (items.length === runtime.CanvasMeasurementsConstant) break;
    }
    return items;
  }
  function normalizeHostFindCommands(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      values: Dynamic = new Set();
    for (let value of input as Dynamic)
      if (
        !(
          typeof value?.id != "string" ||
          !runtime.CanvasMeasurementsPattern_2.test(value.id) ||
          values.has(value.id)
        ) &&
        (values.add(value.id),
        items.push(
          value.disabled === true
            ? {
                id: value.id,
                disabled: true,
              }
            : {
                id: value.id,
              },
        ),
        items.length === runtime.CanvasMeasurementsConstant_2)
      )
        break;
    return items;
  }
  function normalizeHostCanvasCommands(input?: Dynamic): Dynamic {
    let items: Dynamic = [],
      values: Dynamic = new Set();
    for (let value of input as Dynamic)
      if (
        !(
          typeof value.id != "string" ||
          !runtime.CanvasMeasurementsPattern_3.test(value.id) ||
          values.has(value.id)
        ) &&
        (values.add(value.id),
        items.push(
          value.disabled === true
            ? {
                id: value.id,
                disabled: true,
              }
            : {
                id: value.id,
              },
        ),
        items.length === runtime.CanvasMeasurementsConstant_3)
      )
        break;
    return items;
  }
  function normalizeHostSelectionPaths(items?: Dynamic): Dynamic {
    return Array.isArray(items) &&
      items.length <= 8 &&
      items.every((input?: Dynamic): Dynamic => typeof input == "string")
      ? items
      : [];
  }
  function createFrameHostBridge(input?: Dynamic): Dynamic {
    let parentWindow: Dynamic = input.parentWindow,
      // CucCut: trustParent (from __FRAME_PREAMBLE) trusts window.parent itself instead of an origin list.
      // The desktop parent page is file:// (opaque origin "null", which postMessage cannot target), so replies go to "*".
      trustParent: Dynamic = input.trustParent === true,
      value: Dynamic = null,
      flag: Dynamic = false,
      values: Dynamic = new Set(),
      flag2: Dynamic = false,
      value2: Dynamic = null,
      value3: Dynamic = null,
      value4: Dynamic = null,
      value5: Dynamic = null,
      value6: Dynamic = null,
      index: Dynamic = 0,
      value7: Dynamic = null,
      value8: Dynamic,
      value9: Dynamic = null,
      value10: Dynamic = null,
      value11: Dynamic = null,
      values2: Dynamic = new Set(),
      callback: Dynamic = (): Dynamic => flag && value7?.saved !== undefined,
      callback2: Dynamic = (): Dynamic =>
        flag && values.has("readonly") && value7?.saved === "readonly",
      callback3: Dynamic = (): Dynamic => flag && values.has("claude_tips"),
      callback4: Dynamic = (): Dynamic =>
        callback() &&
        value9 !== null &&
        value7?.actions?.some(
          (input2?: Dynamic): Dynamic => input2.id === runtime.SaveNowValue,
        ) === true,
      callback5: Dynamic = (): Dynamic =>
        String(callback()) +
        String(callback4()) +
        String(callback2()) +
        String(callback3()),
      value12: Dynamic = callback5(),
      callback6: Dynamic = (): Dynamic => {
        let value13: Dynamic = callback5();
        if (value13 !== value12) {
          value12 = value13;
          for (let value14 of values2 as Dynamic)
            try {
              value14();
            } catch {}
        }
      },
      callback7: Dynamic = (): Dynamic => {
        if (
          value3 === null &&
          value4 === null &&
          value5 === null &&
          value6 === null &&
          index === 0
        )
          return null;
        let state: Dynamic = {
          v: 1,
        };
        value3 !== null &&
          ((state.saved = value3.saved),
          (state.actions = value3.saveNow
            ? [
                {
                  id: runtime.SaveNowValue,
                },
              ]
            : []));
        index > 0 && (state.leaveLosesWork = true);
        let value13: Dynamic =
            value4?.filter(
              (input2?: Dynamic): Dynamic => input2.handoff !== true,
            ) ?? [],
          value14: Dynamic =
            value4
              ?.filter((input2?: Dynamic): Dynamic => input2.handoff === true)
              .map(
                ({ handoff: handoff, ...props }: Dynamic): Dynamic => props,
              ) ?? [];
        value13.length > 0 && (state.exports = value13);
        value14.length > 0 && (state.handoffs = value14);
        value5 !== null && (state.destinations = value5);
        value6?.footInset !== undefined && (state.footInset = value6.footInset);
        value6?.ground !== undefined && (state.ground = value6.ground);
        return state;
      },
      callback8: Dynamic = (): Dynamic => {
        let value13: Dynamic = callback7(),
          value14: Dynamic = value13 ?? {
            v: 1,
          },
          value15: Dynamic = flag2
            ? {
                ...value14,
                actions: [
                  ...(value14.actions ?? []),
                  {
                    id: runtime.OpenFindValue,
                  },
                ],
              }
            : value13,
          value16: Dynamic = JSON.stringify(value15);
        value16 !== value8 &&
          ((value7 = value15),
          (value8 = value16),
          value !== null && callback10(value15, value),
          callback6());
      },
      callback9: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        let value13: Dynamic = [
          ...(value7?.exports ?? []),
          ...(value7?.handoffs ?? []),
        ].find(
          (input3?: Dynamic): Dynamic =>
            input3.format === input2 && input3.disabled !== true,
        );
        return value13 === undefined
          ? false
          : options === undefined ||
              value13.variants?.some(
                (input3?: Dynamic): Dynamic =>
                  input3.id === options && input3.disabled !== true,
              ) === true;
      },
      callback10: Dynamic = (input2?: Dynamic, options?: Dynamic): Dynamic => {
        try {
          parentWindow?.postMessage(
            {
              __frame_chrome_report: true,
              snapshot: input2,
            },
            options,
          );
        } catch {}
      },
      callback11: Dynamic = (dataset?: Dynamic): Dynamic => {
        if (
          parentWindow === null ||
          dataset.source !== parentWindow ||
          (!trustParent && !isAllowedHostOrigin(dataset.origin, input.origins))
        )
          return;
        let data: Dynamic = dataset.data,
          value13: Dynamic = data?.__frame_chrome_poke === true,
          value14: Dynamic = data?.__frame_chrome_cmd === true;
        if (!(!value13 && !value14)) {
          value = trustParent ? "*" : dataset.origin;
          data?.rows !== false && (flag = true);
          value13 &&
            (values = new Set(normalizeHostSelectionPaths(data?.words)));
          value13 && value7 !== null && callback10(value7, value);
          callback6();
          if (
            value14 &&
            data?.cmd === "action" &&
            data.id === runtime.OpenFindValue &&
            value7?.actions?.some(
              (input2?: Dynamic): Dynamic =>
                input2.id === runtime.OpenFindValue,
            )
          )
            try {
              value2?.();
            } catch (value15: Dynamic) {
              typeof reportError == "function"
                ? reportError(value15)
                : console.error(value15);
            }
          if (
            value14 &&
            data?.cmd === "action" &&
            data.id === runtime.SaveNowValue &&
            value7?.actions?.some(
              (input2?: Dynamic): Dynamic => input2.id === runtime.SaveNowValue,
            )
          )
            try {
              value9?.();
            } catch (value15: Dynamic) {
              typeof reportError == "function"
                ? reportError(value15)
                : console.error(value15);
            }
          if (value14 && data?.cmd === "action" && typeof data.id == "string") {
            let value15: Dynamic = value7?.destinations?.find(
              (input2?: Dynamic): Dynamic => input2.id === data.id,
            );
            if (value15 !== undefined && value15.disabled !== true)
              try {
                value10?.(data.id);
              } catch (value16: Dynamic) {
                typeof reportError == "function"
                  ? reportError(value16)
                  : console.error(value16);
              }
          }
          if (value14 && data?.cmd === "export") {
            let {
              format: value15,
              request: value16,
              interactive: value17,
              variant: value18,
              bundle: value19,
              windowMs: value20,
              sender: value21,
            }: Dynamic = data;
            if (
              typeof value15 == "string" &&
              runtime.CanvasMeasurementsPattern.test(value15) &&
              (value18 === undefined ||
                (typeof value18 == "string" &&
                  runtime.CanvasMeasurementsPattern_2.test(value18))) &&
              callback9(value15, value18) &&
              typeof value16 == "string" &&
              runtime.CanvasMeasurementsAZaZPattern.test(value16)
            )
              try {
                value11?.(
                  value15,
                  value16,
                  value17 === true,
                  value18,
                  value17 === true && value19 === true,
                  (0, runtime.CanvasMeasurementsIsSafeInteger)(value20),
                  value17 !== true &&
                    (value21 === "viewer" || value21 === "claude")
                    ? value21
                    : undefined,
                );
              } catch (value22: Dynamic) {
                typeof reportError == "function"
                  ? reportError(value22)
                  : console.error(value22);
              }
          }
        }
      };
    if (parentWindow !== null) {
      input.ownWindow.addEventListener("message", callback11);
      for (let value13 of (trustParent ? ["*"] : input.origins) as Dynamic)
        if (!value13.endsWith(":*"))
          try {
            parentWindow.postMessage(
              {
                __frame_chrome_hello: true,
              },
              value13,
            );
          } catch {}
    }
    return {
      report(input2: Dynamic, options: Dynamic = false): Dynamic {
        parentWindow !== null &&
          ((value3 =
            input2 === null
              ? null
              : {
                  saved: input2,
                  saveNow: options,
                }),
          callback8());
      },
      setSaveNowHandler(input2: Dynamic): Dynamic {
        value9 = input2;
        callback6();
      },
      setDestinations(input2: Dynamic): Dynamic {
        if (parentWindow === null) return;
        let value13: Dynamic =
          input2 === null ? [] : normalizeHostCanvasCommands(input2);
        value5 = value13.length === 0 ? null : value13;
        callback8();
      },
      setDestinationHandler(input2: Dynamic): Dynamic {
        value10 = input2;
      },
      setFoot(input2: Dynamic): Dynamic {
        if (parentWindow === null) return;
        let state: Dynamic = {};
        input2 !== null &&
          typeof input2.inset == "number" &&
          Number.isFinite(input2.inset) &&
          (state.footInset = Math.min(
            Math.max(0, Math.round(input2.inset)),
            runtime.CanvasMeasurementsConstant_4,
          ));
        let value13: Dynamic =
          typeof input2?.ground == "string"
            ? input2.ground.toLowerCase()
            : null;
        value13 !== null &&
          runtime.CanvasMeasurementsPattern_4.test(value13) &&
          (state.ground = value13);
        value6 =
          state.footInset === undefined && state.ground === undefined
            ? null
            : state;
        callback8();
      },
      setExports(input2: Dynamic): Dynamic {
        if (parentWindow === null) return;
        let value13: Dynamic =
          input2 === null ? [] : normalizeHostExports(input2);
        value4 = value13.length === 0 ? null : value13;
        callback8();
      },
      setExportHandler(input2: Dynamic): Dynamic {
        value11 = input2;
      },
      setFind(input2: Dynamic, options: Dynamic): Dynamic {
        value2 = options;
        !(parentWindow === null || flag2 === input2) &&
          ((flag2 = input2), callback8());
      },
      declineExport(input2: Dynamic, options: Dynamic = false): Dynamic {
        if (
          !(
            parentWindow === null ||
            value === null ||
            !runtime.CanvasMeasurementsAZaZPattern.test(input2)
          )
        )
          try {
            parentWindow.postMessage(
              {
                __frame_chrome_decline: true,
                request: input2,
                ...(options && {
                  cancelled: options,
                }),
              },
              value,
            );
          } catch {}
      },
      holdLeaveLosesWork(): Dynamic {
        if (parentWindow === null) return (): Dynamic => {};
        let flag3: Dynamic = false;
        index += 1;
        callback8();
        return (): Dynamic => {
          flag3 || ((flag3 = true), (index -= 1), callback8());
        };
      },
      witnessed: (): Dynamic => flag,
      hostDrawsSave: callback,
      hostDrawsReadOnly: callback2,
      hostDrawsClaudeTips: callback3,
      hostTakesRetry: callback4,
      subscribeHostDrawsSave(input2: Dynamic): Dynamic {
        values2.add(input2);
        return (): Dynamic => {
          values2.delete(input2);
        };
      },
      dispose(): Dynamic {
        parentWindow !== null &&
          input.ownWindow.removeEventListener("message", callback11);
        values2.clear();
      },
    };
  }
  function isTrustedHostOrigin(input?: Dynamic): Dynamic {
    return isAllowedHostOrigin(input, allowedFrameHostOrigins);
  }
  function postToFrameHost(
    input?: Dynamic,
    options: Dynamic = window,
    context: Dynamic = allowedFrameHostOrigins,
  ): Dynamic {
    if (options.parent === options) return;
    let value: Dynamic = options.location.ancestorOrigins?.[0];
    for (let value2 of (value !== undefined &&
    isAllowedHostOrigin(value, context)
      ? [value]
      : context) as Dynamic)
      if (!value2.endsWith(":*"))
        try {
          options.parent.postMessage(input, value2);
        } catch {}
  }
  function getFrameHostBridge(): Dynamic {
    if (createFrameHostBridgeValue === null) {
      let value: Dynamic =
        typeof window == "object" && (window as Dynamic).parent !== window;
      createFrameHostBridgeValue = createFrameHostBridge({
        ownWindow: window,
        parentWindow: value ? (window as Dynamic).parent : null,
        origins: allowedFrameHostOrigins,
        // CucCut: set by packages/design/src/editor before the runtime starts (docs/design/canvas §5).
        trustParent: (window as Dynamic).__FRAME_PREAMBLE?.trustParent === true,
      });
    }
    return createFrameHostBridgeValue;
  }
  function reportFrameSaveState(input?: Dynamic, options?: Dynamic): Dynamic {
    getFrameHostBridge().report(input, options);
  }
  function setFrameExports(input?: Dynamic): Dynamic {
    getFrameHostBridge().setExports(input);
  }
  function setFrameExportHandler(input?: Dynamic): Dynamic {
    getFrameHostBridge().setExportHandler(input);
  }
  function declineFrameExport(input?: Dynamic, options?: Dynamic): Dynamic {
    getFrameHostBridge().declineExport(input, options);
  }
  function useFrameSaveState(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactCanvasMeasurements_2.useRef)(false),
      value2: Dynamic = input === "loading" && value.current;
    input !== "loading" && (value.current = input === "error");
    let value3: Dynamic =
        input === null ? null : value2 ? "saving" : hostSaveStatus(input),
      value4: Dynamic =
        options !== undefined && (input === "error" || input === "dirty"),
      value5: Dynamic = (0, runtime.reactCanvasMeasurements_2.useRef)(options);
    value5.current = options;
    (0, runtime.reactCanvasMeasurements_2.useEffect)((): Dynamic => {
      reportFrameSaveState(value3, value4);
    }, [value3, value4]);
    (0, runtime.reactCanvasMeasurements_2.useEffect)(
      (): Dynamic => (
        getFrameHostBridge().setSaveNowHandler(
          (): Dynamic => value5.current?.(),
        ),
        (): Dynamic => {
          getFrameHostBridge().setSaveNowHandler(null);
          reportFrameSaveState(null);
        }
      ),
      [],
    );
  }
  function useFrameFind(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactCanvasMeasurements_2.useRef)(options);
    value.current = options;
    (0, runtime.reactCanvasMeasurements_2.useEffect)(
      (): Dynamic => (
        getFrameHostBridge().setFind(input, (): Dynamic => value.current()),
        (): Dynamic => getFrameHostBridge().setFind(false, null)
      ),
      [input],
    );
  }
  function hostDrawsSave(): Dynamic {
    return getFrameHostBridge().hostDrawsSave();
  }
  function hostDrawsReadOnly(): Dynamic {
    return getFrameHostBridge().hostDrawsReadOnly();
  }
  function useHostDrawsClaudeTips(): Dynamic {
    return (0, runtime.reactCanvasMeasurements_2.useSyncExternalStore)(
      subscribeHostChrome,
      (): Dynamic => getFrameHostBridge().hostDrawsClaudeTips(),
      (): Dynamic => false,
    );
  }
  function hostHandlesRetry(): Dynamic {
    return getFrameHostBridge().hostTakesRetry();
  }
  function subscribeHostChrome(input?: Dynamic): Dynamic {
    return getFrameHostBridge().subscribeHostDrawsSave(input);
  }
  bindRuntimeValue(runtime, "hostSaveStatus", () => hostSaveStatus);
  bindRuntimeValue(
    runtime,
    "PlatformFrameHostBridgeItems",
    () => PlatformFrameHostBridgeItems,
    (value) => {
      PlatformFrameHostBridgeItems = value;
    },
  );
  bindRuntimeValue(runtime, "getHostOrigins", () => getHostOrigins);
  bindRuntimeValue(runtime, "isAllowedHostOrigin", () => isAllowedHostOrigin);
  bindRuntimeValue(runtime, "normalizeHostExports", () => normalizeHostExports);
  bindRuntimeValue(
    runtime,
    "normalizeHostFindCommands",
    () => normalizeHostFindCommands,
  );
  bindRuntimeValue(
    runtime,
    "normalizeHostCanvasCommands",
    () => normalizeHostCanvasCommands,
  );
  bindRuntimeValue(
    runtime,
    "normalizeHostSelectionPaths",
    () => normalizeHostSelectionPaths,
  );
  bindRuntimeValue(
    runtime,
    "createFrameHostBridge",
    () => createFrameHostBridge,
  );
  bindRuntimeValue(
    runtime,
    "allowedFrameHostOrigins",
    () => allowedFrameHostOrigins,
    (value) => {
      allowedFrameHostOrigins = value;
    },
  );
  bindRuntimeValue(runtime, "isTrustedHostOrigin", () => isTrustedHostOrigin);
  bindRuntimeValue(runtime, "postToFrameHost", () => postToFrameHost);
  bindRuntimeValue(
    runtime,
    "createFrameHostBridgeValue",
    () => createFrameHostBridgeValue,
    (value) => {
      createFrameHostBridgeValue = value;
    },
  );
  bindRuntimeValue(runtime, "getFrameHostBridge", () => getFrameHostBridge);
  bindRuntimeValue(runtime, "reportFrameSaveState", () => reportFrameSaveState);
  bindRuntimeValue(runtime, "setFrameExports", () => setFrameExports);
  bindRuntimeValue(
    runtime,
    "setFrameExportHandler",
    () => setFrameExportHandler,
  );
  bindRuntimeValue(runtime, "declineFrameExport", () => declineFrameExport);
  bindRuntimeValue(runtime, "useFrameSaveState", () => useFrameSaveState);
  bindRuntimeValue(runtime, "useFrameFind", () => useFrameFind);
  bindRuntimeValue(runtime, "hostDrawsSave", () => hostDrawsSave);
  bindRuntimeValue(runtime, "hostDrawsReadOnly", () => hostDrawsReadOnly);
  bindRuntimeValue(
    runtime,
    "useHostDrawsClaudeTips",
    () => useHostDrawsClaudeTips,
  );
  bindRuntimeValue(runtime, "hostHandlesRetry", () => hostHandlesRetry);
  bindRuntimeValue(runtime, "subscribeHostChrome", () => subscribeHostChrome);
  bindRuntimeValue(
    runtime,
    "PanelValue",
    () => PanelValue,
    (value) => {
      PanelValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PopoverValue",
    () => PopoverValue,
    (value) => {
      PopoverValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPlatformFrameHostBridge",
    () => reactPlatformFrameHostBridge,
    (value) => {
      reactPlatformFrameHostBridge = value;
    },
  );
  return () => {
    // CucCut: no host frame is trusted by default; the editor talks to CucCut through its own shim
    // (packages/design/src/editor). A page that needs this bridge declares origins in __FRAME_PREAMBLE,
    // or trustParent: the design editor does, so CucCut can drive whole-design export (createFrameHostBridge).
    PlatformFrameHostBridgeItems = [];
    allowedFrameHostOrigins = ((): Dynamic => {
      try {
        return typeof window == "object"
          ? getHostOrigins(window)
          : PlatformFrameHostBridgeItems;
      } catch {
        return PlatformFrameHostBridgeItems;
      }
    })();
    createFrameHostBridgeValue = null;
    PanelValue = "panel";
    PopoverValue = "popover";
    reactPlatformFrameHostBridge = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
  };
}

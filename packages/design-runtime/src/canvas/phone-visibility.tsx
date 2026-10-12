/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPhoneVisibility(
  runtime: RuntimeBindings,
): () => void {
  var react_uPt: Dynamic;
  var phoneCanvasShowingPrefix: Dynamic;
  var phoneCanvasKilledMarker: Dynamic;
  var phoneCanvasDocumentMarker: Dynamic;
  var phoneCanvasDocumentId: Dynamic;
  var getPhoneCanvasStorage: Dynamic;
  var phoneCanvasStorageKey: Dynamic;
  function isPhoneCanvasDocumentAlive(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let count: Dynamic = 2e3,
      callback: Dynamic = (items?: Dynamic, options2?: Dynamic): Dynamic => {
        if (count-- <= 0) return false;
        try {
          if (items[phoneCanvasDocumentMarker] === input) return true;
        } catch {}
        if (options2 === 5) return false;
        try {
          for (
            let index: Dynamic = 0,
              value: Dynamic = Math.min(items.length, 100);
            index < value;
            index++
          )
            if (callback(items[index], options2 + 1)) return true;
        } catch {}
        return false;
      };
    try {
      return callback(options ?? (window as Dynamic).top ?? window, 0);
    } catch {
      return false;
    }
  }
  function wasPhoneCanvasKilled(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = isPhoneCanvasDocumentAlive,
  ): Dynamic {
    try {
      let value: Dynamic = input?.getItem(options) ?? null;
      if (value === phoneCanvasKilledMarker) return true;
      if (value === null || !value.startsWith(phoneCanvasShowingPrefix))
        return false;
      let value2: Dynamic = value.slice(phoneCanvasShowingPrefix.length);
      return value2 === phoneCanvasDocumentId || context(value2)
        ? false
        : (input?.setItem(options, phoneCanvasKilledMarker), true);
    } catch {
      return false;
    }
  }
  function markPhoneCanvasVisibility(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    try {
      let value: Dynamic = input?.getItem(options) ?? null;
      if (input == null || value === phoneCanvasKilledMarker) return;
      context
        ? input.setItem(
            options,
            phoneCanvasShowingPrefix + phoneCanvasDocumentId,
          )
        : value === phoneCanvasShowingPrefix + phoneCanvasDocumentId &&
          input.removeItem(options);
    } catch {}
  }
  function usePhoneCanvasVisibility(input?: Dynamic): Dynamic {
    (0, react_uPt.useLayoutEffect)((): Dynamic => {
      if (!input) return;
      let value: Dynamic = getPhoneCanvasStorage(),
        value2: Dynamic = phoneCanvasStorageKey(),
        callback: Dynamic = (): Dynamic =>
          markPhoneCanvasVisibility(
            value,
            value2,
            (document as Dynamic).visibilityState !== "hidden",
          ),
        callback2: Dynamic = (): Dynamic =>
          markPhoneCanvasVisibility(value, value2, false),
        callback3: Dynamic = (input2?: Dynamic): Dynamic => {
          input2.key === value2 && input2.newValue === null && callback();
        };
      callback();
      (document as Dynamic).addEventListener("visibilitychange", callback);
      (window as Dynamic).addEventListener("pageshow", callback);
      (window as Dynamic).addEventListener("pagehide", callback2);
      (window as Dynamic).addEventListener("storage", callback3);
      return (): Dynamic => {
        (document as Dynamic).removeEventListener("visibilitychange", callback);
        (window as Dynamic).removeEventListener("pageshow", callback);
        (window as Dynamic).removeEventListener("pagehide", callback2);
        (window as Dynamic).removeEventListener("storage", callback3);
        callback2();
      };
    }, [input]);
  }
  bindRuntimeValue(
    runtime,
    "react_uPt",
    () => react_uPt,
    (value) => {
      react_uPt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "phoneCanvasShowingPrefix",
    () => phoneCanvasShowingPrefix,
    (value) => {
      phoneCanvasShowingPrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "phoneCanvasKilledMarker",
    () => phoneCanvasKilledMarker,
    (value) => {
      phoneCanvasKilledMarker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "phoneCanvasDocumentMarker",
    () => phoneCanvasDocumentMarker,
    (value) => {
      phoneCanvasDocumentMarker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "phoneCanvasDocumentId",
    () => phoneCanvasDocumentId,
    (value) => {
      phoneCanvasDocumentId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getPhoneCanvasStorage",
    () => getPhoneCanvasStorage,
    (value) => {
      getPhoneCanvasStorage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "phoneCanvasStorageKey",
    () => phoneCanvasStorageKey,
    (value) => {
      phoneCanvasStorageKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPhoneCanvasDocumentAlive",
    () => isPhoneCanvasDocumentAlive,
  );
  bindRuntimeValue(runtime, "wasPhoneCanvasKilled", () => wasPhoneCanvasKilled);
  bindRuntimeValue(
    runtime,
    "markPhoneCanvasVisibility",
    () => markPhoneCanvasVisibility,
  );
  bindRuntimeValue(
    runtime,
    "usePhoneCanvasVisibility",
    () => usePhoneCanvasVisibility,
  );
  return () => {
    (0, runtime.initializeNpm_usehooks_ts_p0)();
    react_uPt = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    phoneCanvasShowingPrefix = "showing ";
    phoneCanvasKilledMarker = "killed";
    phoneCanvasDocumentMarker = "__designPhoneCanvasDocument";
    phoneCanvasDocumentId =
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    typeof window !== "undefined" &&
      Object.assign(window, {
        [phoneCanvasDocumentMarker]: phoneCanvasDocumentId,
      });
    getPhoneCanvasStorage = (): Dynamic => {
      try {
        return (
          (typeof sessionStorage === "undefined"
            ? undefined
            : sessionStorage) ?? undefined
        );
      } catch {
        return;
      }
    };
    phoneCanvasStorageKey = (): Dynamic =>
      "design-phone-canvas/" + (0, runtime.getViewportMemoryScope)();
  };
}

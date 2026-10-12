import type { MediaQueryStore } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsHooksMediaQuery(
  runtime: RuntimeBindings,
): () => void {
  var reactHooksMediaQuery: typeof React;
  var mobileSheetMediaQuery: string;
  var mediaQueryStores: WeakMap<Window, Map<string, MediaQueryStore>>;
  var HooksMediaQueryHandler: MediaQueryStore["subscribe"];
  var HooksMediaQueryHandler_2: () => boolean;
  var coarsePointerMediaQuery: string;
  var initializeHooksMediaQuery: () => void;
  function getMediaQueryStore(
    input: Window,
    options: string,
  ): MediaQueryStore | null {
    if (typeof input.matchMedia != "function") return null;
    let entry = mediaQueryStores.get(input);
    entry === undefined &&
      ((entry = new Map()), mediaQueryStores.set(input, entry));
    let entry2 = entry.get(options);
    if (entry2 === undefined) {
      let value = input.matchMedia(options);
      entry2 = {
        subscribe: (input2) => (
          value.addEventListener("change", input2),
          () => value.removeEventListener("change", input2)
        ),
        getSnapshot: () => value.matches,
      };
      entry.set(options, entry2);
    }
    return entry2;
  }
  function useWindowMediaQuery(
    input: Window | null | undefined,
    options: string,
  ): boolean {
    let value = input == null ? null : getMediaQueryStore(input, options);
    return (0, reactHooksMediaQuery.useSyncExternalStore)(
      value === null ? HooksMediaQueryHandler : value.subscribe,
      value === null ? HooksMediaQueryHandler_2 : value.getSnapshot,
      HooksMediaQueryHandler_2,
    );
  }
  bindRuntimeValue(runtime, "getMediaQueryStore", () => getMediaQueryStore);
  bindRuntimeValue(runtime, "useWindowMediaQuery", () => useWindowMediaQuery);
  bindRuntimeValue(
    runtime,
    "reactHooksMediaQuery",
    () => reactHooksMediaQuery,
    (value) => {
      reactHooksMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mobileSheetMediaQuery",
    () => mobileSheetMediaQuery,
    (value) => {
      mobileSheetMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mediaQueryStores",
    () => mediaQueryStores,
    (value) => {
      mediaQueryStores = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksMediaQueryHandler",
    () => HooksMediaQueryHandler,
    (value) => {
      HooksMediaQueryHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksMediaQueryHandler_2",
    () => HooksMediaQueryHandler_2,
    (value) => {
      HooksMediaQueryHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "coarsePointerMediaQuery",
    () => coarsePointerMediaQuery,
    (value) => {
      coarsePointerMediaQuery = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeHooksMediaQuery",
    () => initializeHooksMediaQuery,
    (value) => {
      initializeHooksMediaQuery = value;
    },
  );
  return () => {
    initializeHooksMediaQuery = (0, runtime.initializeOnce)(() => {
      reactHooksMediaQuery = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      mobileSheetMediaQuery = "(pointer: coarse) and (max-width: 639.98px)";
      mediaQueryStores = new WeakMap();
      HooksMediaQueryHandler = () => () => {};
      HooksMediaQueryHandler_2 = () => false;
      coarsePointerMediaQuery = "(pointer: coarse)";
    });
  };
}

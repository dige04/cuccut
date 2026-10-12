/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    reactAC: ReactNamespace;
    useMediaQuery: (query: string) => boolean;
    useCoarsePointer: () => boolean;
    useSmallCoarsePointer: () => boolean;
    COARSE_POINTER_QUERY: string;
    SMALL_COARSE_POINTER_QUERY: string;
    initializeUiPointerMedia: () => void;
  }
}

export function installUiPointerMedia(runtime: RuntimeBindings): () => void {
  var reactAC: ReactNamespace;
  var COARSE_POINTER_QUERY: string;
  var SMALL_COARSE_POINTER_QUERY: string;
  var initializeUiPointerMedia: () => void;
  function useMediaQuery(input: string): boolean {
    let callback = reactAC.useCallback(
      (input2: () => void): (() => void) => {
        if (typeof matchMedia !== "function") {
          return (): void => {
            return;
          };
        }
        let value = matchMedia(input);
        value.addEventListener("change", input2);
        return (): void => value.removeEventListener("change", input2);
      },
      [input],
    );
    return reactAC.useSyncExternalStore(
      callback,
      (): boolean =>
        typeof matchMedia === "function" && matchMedia(input).matches,
      (): boolean => false,
    );
  }
  function useCoarsePointer(): boolean {
    return useMediaQuery(COARSE_POINTER_QUERY);
  }
  function useSmallCoarsePointer(): boolean {
    return useMediaQuery(SMALL_COARSE_POINTER_QUERY);
  }
  bindRuntimeValue(runtime, "useMediaQuery", () => useMediaQuery);
  bindRuntimeValue(runtime, "useCoarsePointer", () => useCoarsePointer);
  bindRuntimeValue(
    runtime,
    "useSmallCoarsePointer",
    () => useSmallCoarsePointer,
  );
  bindRuntimeValue(
    runtime,
    "reactAC",
    () => reactAC,
    (value) => {
      reactAC = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COARSE_POINTER_QUERY",
    () => COARSE_POINTER_QUERY,
    (value) => {
      COARSE_POINTER_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SMALL_COARSE_POINTER_QUERY",
    () => SMALL_COARSE_POINTER_QUERY,
    (value) => {
      SMALL_COARSE_POINTER_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPointerMedia",
    () => initializeUiPointerMedia,
    (value) => {
      initializeUiPointerMedia = value;
    },
  );
  return () => {
    COARSE_POINTER_QUERY = "(pointer: coarse)";
    SMALL_COARSE_POINTER_QUERY = "(pointer: coarse) and (max-width: 599px)";
    initializeUiPointerMedia = (0, runtime.initializeOnce)(() => {
      reactAC = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
    });
  };
}

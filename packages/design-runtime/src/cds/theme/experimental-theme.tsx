/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installCdsThemeExperimentalTheme(
  runtime: RuntimeBindings,
): () => void {
  var reactThemeExperimentalTheme: Dynamic;
  var resolveThemeSnapshot: Dynamic;
  var ExperimentalThemeContext: Dynamic;
  var defaultThemeStore: Dynamic;
  var reportedCdsWarnings: Dynamic;
  var initializeExperimentalTheme: Dynamic;
  function resolveExperimentalTheme(settings?: Dynamic): Dynamic {
    try {
      return settings.resolve?.(settings.theme);
    } catch (value: Dynamic) {
      warnCdsOnce(
        '<CdsRoot experimental.theme> could not resolve the theme "' +
          String(settings.theme.id) +
          '", so useTokenValue returns unthemed values. ' +
          (value instanceof Error ? value.message : String(value)),
      );
      return;
    }
  }
  function createThemeStore(settings?: Dynamic): Dynamic {
    let listeners: Dynamic = new Set(),
      snapshot: Dynamic = resolveThemeSnapshot(settings),
      serverSnapshot: Dynamic = snapshot,
      notify: Dynamic = (): Dynamic => {
        for (let value of listeners as Dynamic) value();
      };
    return {
      subscribe: (input?: Dynamic): Dynamic => (
        listeners.add(input),
        (): Dynamic => listeners.delete(input)
      ),
      getSnapshot: (): Dynamic => snapshot,
      getServerSnapshot: (): Dynamic => serverSnapshot,
      getId: (): Dynamic => snapshot?.theme.id,
      set: (input?: Dynamic): Dynamic => {
        let value: Dynamic = resolveThemeSnapshot(input, snapshot);
        value !== snapshot && ((snapshot = value), notify());
      },
    };
  }
  function useThemeId(): Dynamic {
    let value: Dynamic =
      (0, reactThemeExperimentalTheme.useContext)(ExperimentalThemeContext) ??
      defaultThemeStore;
    return (0, reactThemeExperimentalTheme.useSyncExternalStore)(
      value.subscribe,
      value.getId,
      (): Dynamic => value.getServerSnapshot()?.theme.id,
    );
  }
  function warnCdsOnce(message?: Dynamic): Dynamic {
    reportedCdsWarnings.has(message) ||
      (reportedCdsWarnings.add(message), console.error("cds: " + message));
  }
  function warnThemeApplyFailure(input?: Dynamic, options?: Dynamic): Dynamic {
    warnCdsOnce(
      '<CdsRoot experimental.theme> could not put the theme "' +
        input +
        '" on the page, so the page keeps what it had (no theme, or the previous one) while useTokenValue and useCdsTheme answer for "' +
        input +
        '". ' +
        (options instanceof Error ? options.message : String(options)),
    );
  }
  function cleanupAppliedTheme(cleanupRef?: Dynamic): Dynamic {
    let cleanup: Dynamic = cleanupRef.current;
    cleanupRef.current = undefined;
    try {
      cleanup?.();
    } catch {}
  }
  function useExperimentalTheme(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0, reactThemeExperimentalTheme.useContext)(
        ExperimentalThemeContext,
      ),
      [value2]: Dynamic = (0, reactThemeExperimentalTheme.useState)(
        (): Dynamic =>
          value === undefined ? createThemeStore(input) : defaultThemeStore,
      ),
      value3: Dynamic = value === undefined,
      value4: Dynamic = input?.theme ?? undefined,
      value5: Dynamic = input?.resolve,
      value6: Dynamic = input?.apply,
      value7: Dynamic = (0, reactThemeExperimentalTheme.useRef)(value6);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      value7.current = value6;
    }, [value6]);
    let value8: Dynamic = value6 !== undefined,
      value9: Dynamic = (0, reactThemeExperimentalTheme.useRef)(undefined);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      value3 &&
        value2.set(
          value4 === undefined
            ? undefined
            : {
                theme: value4,
                resolve: value5,
              },
        );
    }, [value3, value2, value4, value5]);
    (0, runtime.useIsomorphicLayoutEffect)((): Dynamic => {
      let current: Dynamic = options.current,
        current2: Dynamic = value7.current;
      if (
        value3 &&
        value4 !== undefined &&
        current2 !== undefined &&
        current !== null
      )
        try {
          value9.current = current2(value4, {
            target: current,
          });
        } catch (value10: Dynamic) {
          warnThemeApplyFailure(value4.id, value10);
        }
      else cleanupAppliedTheme(value9);
    }, [value3, value4, value8, options]);
    (0, runtime.useIsomorphicLayoutEffect)(
      (): Dynamic => (): Dynamic => cleanupAppliedTheme(value9),
      [],
    );
    (0, reactThemeExperimentalTheme.useEffect)((): Dynamic => {}, [
      input === null,
      value4,
      value8,
      value,
      options,
    ]);
    return value ?? value2;
  }
  bindRuntimeValue(
    runtime,
    "resolveExperimentalTheme",
    () => resolveExperimentalTheme,
  );
  bindRuntimeValue(runtime, "createThemeStore", () => createThemeStore);
  bindRuntimeValue(runtime, "useThemeId", () => useThemeId);
  bindRuntimeValue(runtime, "warnCdsOnce", () => warnCdsOnce);
  bindRuntimeValue(
    runtime,
    "warnThemeApplyFailure",
    () => warnThemeApplyFailure,
  );
  bindRuntimeValue(runtime, "cleanupAppliedTheme", () => cleanupAppliedTheme);
  bindRuntimeValue(runtime, "useExperimentalTheme", () => useExperimentalTheme);
  bindRuntimeValue(
    runtime,
    "reactThemeExperimentalTheme",
    () => reactThemeExperimentalTheme,
    (value) => {
      reactThemeExperimentalTheme = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveThemeSnapshot",
    () => resolveThemeSnapshot,
    (value) => {
      resolveThemeSnapshot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExperimentalThemeContext",
    () => ExperimentalThemeContext,
    (value) => {
      ExperimentalThemeContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultThemeStore",
    () => defaultThemeStore,
    (value) => {
      defaultThemeStore = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportedCdsWarnings",
    () => reportedCdsWarnings,
    (value) => {
      reportedCdsWarnings = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeExperimentalTheme",
    () => initializeExperimentalTheme,
    (value) => {
      initializeExperimentalTheme = value;
    },
  );
  return () => {
    initializeExperimentalTheme = (0, runtime.initializeOnce)((): Dynamic => {
      "use client";

      (0, runtime.initializeHooksLayoutEffect)();
      reactThemeExperimentalTheme = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      resolveThemeSnapshot = (input?: Dynamic, options?: Dynamic): Dynamic => {
        if (input == null || input.theme === undefined || input.theme === null)
          return;
        let value: Dynamic = resolveExperimentalTheme(input);
        return options !== undefined &&
          options.theme === input.theme &&
          options.resolved === value
          ? options
          : {
              theme: input.theme,
              resolved: value,
            };
      };
      ExperimentalThemeContext = (0, reactThemeExperimentalTheme.createContext)(
        undefined,
      );
      defaultThemeStore = createThemeStore(undefined);
      reportedCdsWarnings = new Set();
    });
  };
}

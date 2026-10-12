import type { BrowserWindow, CloseWatcherHandle } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsOverlaysAndroidCloseWatcher(
  runtime: RuntimeBindings,
): () => void {
  var reactOverlaysAndroidCloseWatcher: typeof React;
  var initializeOverlaysAndroidCloseWatcher: () => void;
  function isAndroidWindow(input: BrowserWindow): boolean {
    let navigator2 = input.navigator,
      value = navigator2.userAgentData?.platform ?? "";
    return (
      /android/i.test(value) || /android/i.test(navigator2.userAgent ?? "")
    );
  }
  function useAndroidCloseWatcher(input: boolean, options?: () => void): void {
    let value = (0, runtime.useCdsWindow)();
    (0, reactOverlaysAndroidCloseWatcher.useEffect)(() => {
      if (!input || value === undefined || options === undefined) return;
      let CloseWatcher = value.CloseWatcher;
      if (CloseWatcher === undefined || !isAndroidWindow(value)) return;
      let value2: CloseWatcherHandle | null = null,
        flag = false,
        callback = () => {
          try {
            value2 = new CloseWatcher();
          } catch {
            value2 = null;
            return;
          }
          value2.onclose = () => {
            options();
            value.addEventListener("pointerup", callback2, {
              capture: true,
              once: true,
            });
            value.addEventListener("keydown", callback2, {
              capture: true,
              once: true,
            });
          };
        },
        callback2 = () => {
          value.removeEventListener("pointerup", callback2, {
            capture: true,
          });
          value.removeEventListener("keydown", callback2, {
            capture: true,
          });
          flag || (value2?.destroy(), callback());
        };
      callback();
      return () => {
        flag = true;
        value.removeEventListener("pointerup", callback2, {
          capture: true,
        });
        value.removeEventListener("keydown", callback2, {
          capture: true,
        });
        value2?.destroy();
      };
    }, [input, value, options]);
  }
  bindRuntimeValue(runtime, "isAndroidWindow", () => isAndroidWindow);
  bindRuntimeValue(
    runtime,
    "useAndroidCloseWatcher",
    () => useAndroidCloseWatcher,
  );
  bindRuntimeValue(
    runtime,
    "reactOverlaysAndroidCloseWatcher",
    () => reactOverlaysAndroidCloseWatcher,
    (value) => {
      reactOverlaysAndroidCloseWatcher = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeOverlaysAndroidCloseWatcher",
    () => initializeOverlaysAndroidCloseWatcher,
    (value) => {
      initializeOverlaysAndroidCloseWatcher = value;
    },
  );
  return () => {
    initializeOverlaysAndroidCloseWatcher = (0, runtime.initializeOnce)(() => {
      "use client";

      (0, runtime.initializeCdsRoot)();
      reactOverlaysAndroidCloseWatcher = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
  };
}

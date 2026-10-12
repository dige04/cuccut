import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsDomOwnerWindow(runtime: RuntimeBindings): () => void {
  var initializeDomOwnerWindow: () => void;
  var accentColorNames: string[];
  var initializeDomOwnerWindow_2: () => void;
  function getOwnerWindow(element?: Element | null): Window | undefined {
    return element?.ownerDocument.defaultView ?? globalThis.window;
  }
  function isDetachedElement(element?: Element): boolean {
    return (
      element !== undefined &&
      (!element.isConnected || element.ownerDocument.defaultView === null)
    );
  }
  function getConnectedOwnerWindow(input?: Element): Window | undefined {
    if (!isDetachedElement(input)) return getOwnerWindow(input);
  }
  bindRuntimeValue(runtime, "getOwnerWindow", () => getOwnerWindow);
  bindRuntimeValue(runtime, "isDetachedElement", () => isDetachedElement);
  bindRuntimeValue(
    runtime,
    "getConnectedOwnerWindow",
    () => getConnectedOwnerWindow,
  );
  bindRuntimeValue(
    runtime,
    "initializeDomOwnerWindow",
    () => initializeDomOwnerWindow,
    (value) => {
      initializeDomOwnerWindow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "accentColorNames",
    () => accentColorNames,
    (value) => {
      accentColorNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomOwnerWindow_2",
    () => initializeDomOwnerWindow_2,
    (value) => {
      initializeDomOwnerWindow_2 = value;
    },
  );
  return () => {
    initializeDomOwnerWindow = (0, runtime.initializeOnce)(() => {});
    initializeDomOwnerWindow_2 = (0, runtime.initializeOnce)(() => {
      accentColorNames = [
        "red",
        "orange",
        "yellow",
        "green",
        "aqua",
        "blue",
        "violet",
        "magenta",
      ];
    });
  };
}

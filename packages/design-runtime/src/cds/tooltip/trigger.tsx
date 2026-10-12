import type {
  BrowserWindow,
  TooltipDelay,
  TooltipImplementation,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsTooltipTrigger(runtime: RuntimeBindings): () => void {
  var reactTooltipTrigger: typeof React;
  var TooltipTriggerContext: React.Context<boolean>;
  var TooltipImplementationContext: React.Context<TooltipImplementation | null>;
  var initializeTooltipTrigger: () => void;
  var initializeTooltipTrigger_2: () => void;
  var reactTooltipTrigger_2: typeof React;
  var TooltipTriggerElementCache: WeakMap<Document, Range>;
  var initializeTooltipTrigger_3: () => void;
  var reactTooltipTrigger_3: typeof React;
  var initializeTooltipTrigger_4: () => void;
  function useTooltipTrigger(): boolean {
    return (0, reactTooltipTrigger.useContext)(TooltipTriggerContext);
  }
  function getResizeObserver(
    input?: Element | null,
  ): typeof ResizeObserver | undefined {
    return (
      input?.ownerDocument.defaultView as BrowserWindow | null | undefined
    )?.ResizeObserver;
  }
  function measureContentRect(element: Element): boolean {
    let ownerDocument = element.ownerDocument,
      entry = TooltipTriggerElementCache.get(ownerDocument);
    entry === undefined &&
      ((entry = ownerDocument.createRange()),
      TooltipTriggerElementCache.set(ownerDocument, entry));
    entry.selectNodeContents(element);
    let value = entry.getBoundingClientRect?.();
    entry.setStart(ownerDocument, 0);
    entry.collapse(true);
    if (value === undefined || value.width === 0) return false;
    let bounds = element.getBoundingClientRect();
    return value.right - bounds.right > 0.1 || bounds.left - value.left > 0.1;
  }
  function useTooltipDelay(): TooltipDelay {
    let value: React.RefObject<number | undefined> = (0,
      reactTooltipTrigger_3.useRef)(undefined),
      value2 = (0, reactTooltipTrigger_3.useCallback)(() => {
        window.clearTimeout(value.current);
        value.current = undefined;
      }, []),
      value3 = (0, reactTooltipTrigger_3.useCallback)(
        (input: number, options: () => void): void => {
          value2();
          value.current = window.setTimeout(options, input);
        },
        [value2],
      );
    (0, reactTooltipTrigger_3.useEffect)(() => value2, [value2]);
    return (0, reactTooltipTrigger_3.useMemo)(
      () => ({
        start: value3,
        cancel: value2,
      }),
      [value3, value2],
    );
  }
  bindRuntimeValue(runtime, "useTooltipTrigger", () => useTooltipTrigger);
  bindRuntimeValue(
    runtime,
    "reactTooltipTrigger",
    () => reactTooltipTrigger,
    (value) => {
      reactTooltipTrigger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTriggerContext",
    () => TooltipTriggerContext,
    (value) => {
      TooltipTriggerContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipImplementationContext",
    () => TooltipImplementationContext,
    (value) => {
      TooltipImplementationContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipTrigger",
    () => initializeTooltipTrigger,
    (value) => {
      initializeTooltipTrigger = value;
    },
  );
  bindRuntimeValue(runtime, "getResizeObserver", () => getResizeObserver);
  bindRuntimeValue(
    runtime,
    "initializeTooltipTrigger_2",
    () => initializeTooltipTrigger_2,
    (value) => {
      initializeTooltipTrigger_2 = value;
    },
  );
  bindRuntimeValue(runtime, "measureContentRect", () => measureContentRect);
  bindRuntimeValue(
    runtime,
    "reactTooltipTrigger_2",
    () => reactTooltipTrigger_2,
    (value) => {
      reactTooltipTrigger_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TooltipTriggerElementCache",
    () => TooltipTriggerElementCache,
    (value) => {
      TooltipTriggerElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipTrigger_3",
    () => initializeTooltipTrigger_3,
    (value) => {
      initializeTooltipTrigger_3 = value;
    },
  );
  bindRuntimeValue(runtime, "useTooltipDelay", () => useTooltipDelay);
  bindRuntimeValue(
    runtime,
    "reactTooltipTrigger_3",
    () => reactTooltipTrigger_3,
    (value) => {
      reactTooltipTrigger_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeTooltipTrigger_4",
    () => initializeTooltipTrigger_4,
    (value) => {
      initializeTooltipTrigger_4 = value;
    },
  );
  return () => {
    initializeTooltipTrigger = (0, runtime.initializeOnce)(() => {
      "use client";

      reactTooltipTrigger = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      TooltipTriggerContext = (0, reactTooltipTrigger.createContext)(false);
      TooltipImplementationContext = (0,
      reactTooltipTrigger.createContext)<TooltipImplementation | null>(null);
    });
    initializeTooltipTrigger_2 = (0, runtime.initializeOnce)(() => {});
    initializeTooltipTrigger_3 = (0, runtime.initializeOnce)(() => {
      "use client";

      reactTooltipTrigger_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      TooltipTriggerElementCache = new WeakMap();
    });
    initializeTooltipTrigger_4 = (0, runtime.initializeOnce)(() => {
      reactTooltipTrigger_3 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
  };
}

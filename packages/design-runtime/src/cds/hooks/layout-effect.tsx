import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsHooksLayoutEffect(
  runtime: RuntimeBindings,
): () => void {
  var reactHooksLayoutEffect: typeof React;
  var useIsomorphicLayoutEffect: typeof React.useLayoutEffect;
  var initializeHooksLayoutEffect: () => void;
  bindRuntimeValue(
    runtime,
    "reactHooksLayoutEffect",
    () => reactHooksLayoutEffect,
    (value) => {
      reactHooksLayoutEffect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useIsomorphicLayoutEffect",
    () => useIsomorphicLayoutEffect,
    (value) => {
      useIsomorphicLayoutEffect = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeHooksLayoutEffect",
    () => initializeHooksLayoutEffect,
    (value) => {
      initializeHooksLayoutEffect = value;
    },
  );
  return () => {
    initializeHooksLayoutEffect = (0, runtime.initializeOnce)(() => {
      reactHooksLayoutEffect = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      useIsomorphicLayoutEffect =
        typeof window !== "undefined"
          ? reactHooksLayoutEffect.useLayoutEffect
          : reactHooksLayoutEffect.useEffect;
    });
  };
}

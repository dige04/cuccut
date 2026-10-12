/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPlatformCdsIsland(runtime: RuntimeBindings): () => void {
  var jsxPlatformCdsIsland: Dynamic;
  var cdsIslandClassName: Dynamic;
  var initializePlatformCdsIsland: Dynamic;
  function CdsIsland({ className: className, ...props }: Dynamic): Dynamic {
    let { resolved: value }: Dynamic = (0, runtime.useDocumentTheme)();
    return (
      <runtime.CdsRoot
        mode={value}
        className={
          className ? cdsIslandClassName + " " + className : cdsIslandClassName
        }
        {...props}
      />
    );
  }
  bindRuntimeValue(runtime, "CdsIsland", () => CdsIsland);
  bindRuntimeValue(
    runtime,
    "jsxPlatformCdsIsland",
    () => jsxPlatformCdsIsland,
    (value) => {
      jsxPlatformCdsIsland = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cdsIslandClassName",
    () => cdsIslandClassName,
    (value) => {
      cdsIslandClassName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePlatformCdsIsland",
    () => initializePlatformCdsIsland,
    (value) => {
      initializePlatformCdsIsland = value;
    },
  );
  return () => {
    initializePlatformCdsIsland = (0, runtime.initializeOnce)((): Dynamic => {
      "use strict";

      (0, runtime.initializeCdsIndex)();
      (0, runtime.initializePlatformTheme)();
      jsxPlatformCdsIsland = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react_jsx_runtime)(),
        1,
      );
      cdsIslandClassName = "cds-island";
    });
  };
}

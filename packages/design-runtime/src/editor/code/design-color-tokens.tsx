/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorCodeDesignColorTokens(
  runtime: RuntimeBindings,
): () => void {
  var reactCodeDesignColorTokens: Dynamic;
  var jsxCodeDesignColorTokens: Dynamic;
  function useDesignColorTokens(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useDesignSystems)();
    return (0, runtime.reactCodeScriptLiterals.useMemo)((): Dynamic => {
      let values: Dynamic = new Set(),
        items: Dynamic = [];
      for (let value2 of value as Dynamic)
        for (let value3 of value2.colors as Dynamic)
          values.has(value3.name) ||
            (values.add(value3.name),
            items.push({
              name: "--" + value3.name,
              value: value3.value,
              ...(0, runtime.colorTokenGroupLabels)(value2, value3),
            }));
      return {
        tokens: items,
        themes: [],
      };
    }, [value]);
  }
  bindRuntimeValue(runtime, "useDesignColorTokens", () => useDesignColorTokens);
  bindRuntimeValue(
    runtime,
    "reactCodeDesignColorTokens",
    () => reactCodeDesignColorTokens,
    (value) => {
      reactCodeDesignColorTokens = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCodeDesignColorTokens",
    () => jsxCodeDesignColorTokens,
    (value) => {
      jsxCodeDesignColorTokens = value;
    },
  );
  return () => {
    (0, runtime.initializeCdsIndex)();
    reactCodeDesignColorTokens = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializePlatformCdsIsland)();
    jsxCodeDesignColorTokens = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorContextPart2(
  runtime: RuntimeBindings,
): () => void {
  var reactInspectorContext_2: Dynamic;
  var InspectorContextDsColorTokensArtboardColorsDesignColorTokensConfig: Dynamic;
  var InspectorContext: Dynamic;
  var reactInspectorContext_3: Dynamic;
  var InspectorContextIconsValue: Dynamic;
  var InspectorContextLimit: Dynamic;
  var InspectorContextConstant: Dynamic;
  var reactInspectorContext_4: Dynamic;
  var jsxInspectorContext: Dynamic;
  function useInspectorContext(): Dynamic {
    return (0, reactInspectorContext_2.useContext)(InspectorContext);
  }
  function getSupportedTool(input?: Dynamic): Dynamic {
    return typeof input == "string" &&
      Object.hasOwn(InspectorContextIconsValue, input)
      ? input
      : undefined;
  }
  function isToolNameList(items?: Dynamic): Dynamic {
    if (items.length < InspectorContextLimit) return false;
    let index: Dynamic = 0;
    for (let value of items as Dynamic)
      getSupportedTool(value) !== undefined && index++;
    return index >= items.length * InspectorContextConstant;
  }
  bindRuntimeValue(
    runtime,
    "reactInspectorContext_2",
    () => reactInspectorContext_2,
    (value) => {
      reactInspectorContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorContextDsColorTokensArtboardColorsDesignColorTokensConfig",
    () => InspectorContextDsColorTokensArtboardColorsDesignColorTokensConfig,
    (value) => {
      InspectorContextDsColorTokensArtboardColorsDesignColorTokensConfig =
        value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorContext",
    () => InspectorContext,
    (value) => {
      InspectorContext = value;
    },
  );
  bindRuntimeValue(runtime, "useInspectorContext", () => useInspectorContext);
  bindRuntimeValue(
    runtime,
    "reactInspectorContext_3",
    () => reactInspectorContext_3,
    (value) => {
      reactInspectorContext_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorContextIconsValue",
    () => InspectorContextIconsValue,
    (value) => {
      InspectorContextIconsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorContextLimit",
    () => InspectorContextLimit,
    (value) => {
      InspectorContextLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorContextConstant",
    () => InspectorContextConstant,
    (value) => {
      InspectorContextConstant = value;
    },
  );
  bindRuntimeValue(runtime, "getSupportedTool", () => getSupportedTool);
  bindRuntimeValue(runtime, "isToolNameList", () => isToolNameList);
  bindRuntimeValue(
    runtime,
    "reactInspectorContext_4",
    () => reactInspectorContext_4,
    (value) => {
      reactInspectorContext_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxInspectorContext",
    () => jsxInspectorContext,
    (value) => {
      jsxInspectorContext = value;
    },
  );
  return () => {
    reactInspectorContext_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    InspectorContextDsColorTokensArtboardColorsDesignColorTokensConfig = {
      dsColorTokens: [],
      artboardColors: [],
      designColorTokens: [],
      setOverlayHidden: (): Dynamic => {},
      setScrubbing: (): Dynamic => {},
    };
    InspectorContext = (0, reactInspectorContext_2.createContext)(
      InspectorContextDsColorTokensArtboardColorsDesignColorTokensConfig,
    );
    reactInspectorContext_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformRootFontSize_4)();
    InspectorContextIconsValue = runtime.iconFontMetadata.icons;
    InspectorContextLimit = 8;
    InspectorContextConstant = 0.9;
    reactInspectorContext_4 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializeCdsIndex)();
    jsxInspectorContext = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}

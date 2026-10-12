/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type * as React from "react";

export interface AppDesignProviderProps {
  children?: React.ReactNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxgp0: JsxNamespace;
    reactAl: ReactNamespace;
    reactDOMvT_: ReactDomNamespace;
    jsxfp0: JsxNamespace;
    reactPl: ReactNamespace;
    jsxTl: JsxNamespace;
    ICON_SET_FLAG: string;
    DEFAULT_EXPERIMENTAL_PARTS: string[];
    ICON_EXPERIMENTAL_PARTS: string[];
    experimentalIconPartsAsync: () => Promise<string[]>;
    experimentalIconParts: () => string[];
    useExperimentalIconParts: () => string[];
    AppDesignProvider: (arg0: AppDesignProviderProps) => React.ReactElement;
  }
}

export function installUiDesignProvider(runtime: RuntimeBindings): () => void {
  var jsxgp0: JsxNamespace;
  var reactAl: ReactNamespace;
  var reactDOMvT_: ReactDomNamespace;
  var jsxfp0: JsxNamespace;
  var reactPl: ReactNamespace;
  var ICON_SET_FLAG: string;
  var DEFAULT_EXPERIMENTAL_PARTS: string[];
  var ICON_EXPERIMENTAL_PARTS: string[];
  var jsxTl: JsxNamespace;
  async function experimentalIconPartsAsync(): Promise<string[]> {
    if (await (0, runtime.getFeatureFlagAsync)(ICON_SET_FLAG, false)) {
      return ICON_EXPERIMENTAL_PARTS;
    } else {
      return DEFAULT_EXPERIMENTAL_PARTS;
    }
  }
  function experimentalIconParts(): string[] {
    if ((0, runtime.getFeatureFlag)(ICON_SET_FLAG, false)) {
      return ICON_EXPERIMENTAL_PARTS;
    } else {
      return DEFAULT_EXPERIMENTAL_PARTS;
    }
  }
  function useExperimentalIconParts(): string[] {
    let [value, value2] = reactPl.useState(experimentalIconParts);
    reactPl.useEffect(() => {
      let flag = true;
      experimentalIconPartsAsync().then((input) => {
        if (flag) {
          value2(input);
        }
      });
      return () => {
        flag = false;
      };
    }, []);
    return value;
  }
  function AppDesignProvider({ children: children }: AppDesignProviderProps): React.ReactElement {
    let value = useExperimentalIconParts();
    return jsxTl.jsx(runtime.CdsRoot, {
      density: runtime.defaultDensity,
      font: "anthropic",
      className: "contents",
      experimental: {
        fizzyLake: {
          parts: value,
        },
      },
      children: jsxTl.jsx(runtime.TooltipImplementationProvider, {
        children: jsxTl.jsx(runtime.ToastProvider, {
          children: children,
        }),
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "jsxgp0",
    () => jsxgp0,
    (value) => {
      jsxgp0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactAl",
    () => reactAl,
    (value) => {
      reactAl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMvT_",
    () => reactDOMvT_,
    (value) => {
      reactDOMvT_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxfp0",
    () => jsxfp0,
    (value) => {
      jsxfp0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPl",
    () => reactPl,
    (value) => {
      reactPl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ICON_SET_FLAG",
    () => ICON_SET_FLAG,
    (value) => {
      ICON_SET_FLAG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_EXPERIMENTAL_PARTS",
    () => DEFAULT_EXPERIMENTAL_PARTS,
    (value) => {
      DEFAULT_EXPERIMENTAL_PARTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ICON_EXPERIMENTAL_PARTS",
    () => ICON_EXPERIMENTAL_PARTS,
    (value) => {
      ICON_EXPERIMENTAL_PARTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "experimentalIconPartsAsync",
    () => experimentalIconPartsAsync,
  );
  bindRuntimeValue(
    runtime,
    "experimentalIconParts",
    () => experimentalIconParts,
  );
  bindRuntimeValue(
    runtime,
    "useExperimentalIconParts",
    () => useExperimentalIconParts,
  );
  bindRuntimeValue(
    runtime,
    "jsxTl",
    () => jsxTl,
    (value) => {
      jsxTl = value;
    },
  );
  bindRuntimeValue(runtime, "AppDesignProvider", () => AppDesignProvider);
  return () => {
    (0, runtime.initializeUiColorPicker)();
    (0, runtime.initializeUiContrast)();
    (0, runtime.initializeUiContrastControls)();
    (0, runtime.initializeColorSelect)();
    (0, runtime.initializeIconButton)();
    (0, runtime.initializeUiPropertySearch)();
    jsxgp0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    reactAl = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDOMvT_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    jsxfp0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    (0, runtime.initializeUiPropertyIcons)();
    (0, runtime.initializeUiInputs210)();
    reactPl = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ICON_SET_FLAG = "appifact_icon_set";
    DEFAULT_EXPERIMENTAL_PARTS = [];
    ICON_EXPERIMENTAL_PARTS = ["icons"];
    jsxTl = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}

/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    jsxfo0: JsxNamespace;
    findResultIcon: (name: string) => ReactElement;
    textFindResultIcon: ReactElement;
    frameFindResultIcon: ReactElement;
  }
}

export function installUiFindResultIcons(runtime: RuntimeBindings): () => void {
  var jsxfo0: JsxNamespace;
  var findResultIcon: (name: string) => ReactElement;
  var textFindResultIcon: ReactElement;
  var frameFindResultIcon: ReactElement;

  bindRuntimeValue(
    runtime,
    "jsxfo0",
    () => jsxfo0,
    (value) => {
      jsxfo0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findResultIcon",
    () => findResultIcon,
    (value) => {
      findResultIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "textFindResultIcon",
    () => textFindResultIcon,
    (value) => {
      textFindResultIcon = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "frameFindResultIcon",
    () => frameFindResultIcon,
    (value) => {
      frameFindResultIcon = value;
    },
  );
  return () => {
    (0, runtime.initializeUiInputs210)();
    jsxfo0 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    findResultIcon = (name: string): ReactElement =>
      jsxfo0.jsx(runtime.Icon, {
        name: name,
        size: "auto",
        className: "shrink-0",
      });
    textFindResultIcon = findResultIcon("TextT");
    frameFindResultIcon = findResultIcon("FrameHash");
  };
}

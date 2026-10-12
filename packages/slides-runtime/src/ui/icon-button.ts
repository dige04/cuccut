/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    IconButtonJsx: JsxNamespace;
    initializeIconButton: () => void;
  }
}

export function installUiIconButton(runtime: RuntimeBindings): () => void {
  var IconButtonJsx: JsxNamespace;
  var initializeIconButton: () => void;

  bindRuntimeValue(
    runtime,
    "IconButtonJsx",
    () => IconButtonJsx,
    (value) => {
      IconButtonJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeIconButton",
    () => initializeIconButton,
    (value) => {
      initializeIconButton = value;
    },
  );
  return () => {
    initializeIconButton = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeUiPropertyIcons)();
      (0, runtime.initializeTooltipWrapper)();
      IconButtonJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
  };
}

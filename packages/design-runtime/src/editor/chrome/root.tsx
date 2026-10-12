/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromeRoot(runtime: RuntimeBindings): () => void {
  var jsxChromeRoot: Dynamic;
  var jsxChromeRoot_2: Dynamic;
  var reactChromeRoot: Dynamic;
  var reactDomChromeRoot: Dynamic;
  var jsxChromeRoot_3: Dynamic;
  var jsxChromeRoot_4: Dynamic;
  var reactChromeRoot_2: Dynamic;
  var jsxChromeRoot_5: Dynamic;
  function EditorChromeRoot({ children: children }: Dynamic): Dynamic {
    return (
      <runtime.CdsRoot
        density={runtime.defaultDensity}
        font={"anthropic"}
        className={"contents"}
      >
        <runtime.TooltipImplProvider>
          <runtime.ToastProvider>{children}</runtime.ToastProvider>
        </runtime.TooltipImplProvider>
      </runtime.CdsRoot>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxChromeRoot",
    () => jsxChromeRoot,
    (value) => {
      jsxChromeRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeRoot_2",
    () => jsxChromeRoot_2,
    (value) => {
      jsxChromeRoot_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactChromeRoot",
    () => reactChromeRoot,
    (value) => {
      reactChromeRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomChromeRoot",
    () => reactDomChromeRoot,
    (value) => {
      reactDomChromeRoot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeRoot_3",
    () => jsxChromeRoot_3,
    (value) => {
      jsxChromeRoot_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeRoot_4",
    () => jsxChromeRoot_4,
    (value) => {
      jsxChromeRoot_4 = value;
    },
  );
  bindRuntimeValue(runtime, "EditorChromeRoot", () => EditorChromeRoot);
  bindRuntimeValue(
    runtime,
    "reactChromeRoot_2",
    () => reactChromeRoot_2,
    (value) => {
      reactChromeRoot_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeRoot_5",
    () => jsxChromeRoot_5,
    (value) => {
      jsxChromeRoot_5 = value;
    },
  );
  return () => {
    jsxChromeRoot = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    jsxChromeRoot_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactChromeRoot = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactDomChromeRoot = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom)(),
      1,
    );
    jsxChromeRoot_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxChromeRoot_4 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    reactChromeRoot_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxChromeRoot_5 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}

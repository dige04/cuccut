/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHooksLatestCallback(
  runtime: RuntimeBindings,
): () => void {
  var reactHooksLatestCallback: Dynamic;
  var reactHooksLatestCallback_2: Dynamic;
  var reactHooksLatestCallback_3: Dynamic;
  var reactHooksLatestCallback_4: Dynamic;
  var jsxHooksLatestCallback: Dynamic;
  function useLatestCallback(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, reactHooksLatestCallback.useRef)(input);
    (0, reactHooksLatestCallback.useInsertionEffect)((): Dynamic => {
      value.current = input;
    });
    return (0, reactHooksLatestCallback.useCallback)(
      (...input2: Dynamic[]): Dynamic => value.current(...input2),
      [],
    );
  }
  bindRuntimeValue(
    runtime,
    "reactHooksLatestCallback",
    () => reactHooksLatestCallback,
    (value) => {
      reactHooksLatestCallback = value;
    },
  );
  bindRuntimeValue(runtime, "useLatestCallback", () => useLatestCallback);
  bindRuntimeValue(
    runtime,
    "reactHooksLatestCallback_2",
    () => reactHooksLatestCallback_2,
    (value) => {
      reactHooksLatestCallback_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactHooksLatestCallback_3",
    () => reactHooksLatestCallback_3,
    (value) => {
      reactHooksLatestCallback_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactHooksLatestCallback_4",
    () => reactHooksLatestCallback_4,
    (value) => {
      reactHooksLatestCallback_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxHooksLatestCallback",
    () => jsxHooksLatestCallback,
    (value) => {
      jsxHooksLatestCallback = value;
    },
  );
  return () => {
    reactHooksLatestCallback = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactHooksLatestCallback_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactHooksLatestCallback_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactHooksLatestCallback_4 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    jsxHooksLatestCallback = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorVectorToolState(
  runtime: RuntimeBindings,
): () => void {
  var reactVectorToolState: Dynamic;
  var reactVectorToolState_2: Dynamic;
  var reactDomVectorToolState: Dynamic;
  function useVectorToolReset(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, reactVectorToolState.useRef)(null);
    (0, reactVectorToolState.useEffect)((): Dynamic => {
      input !== "vector"
        ? (value.current = null)
        : value.current == null
          ? (value.current = options)
          : value.current !== options &&
            context((input2?: Dynamic): Dynamic => input2 + 1);
    }, [input, options, context]);
  }
  bindRuntimeValue(
    runtime,
    "reactVectorToolState",
    () => reactVectorToolState,
    (value) => {
      reactVectorToolState = value;
    },
  );
  bindRuntimeValue(runtime, "useVectorToolReset", () => useVectorToolReset);
  bindRuntimeValue(
    runtime,
    "reactVectorToolState_2",
    () => reactVectorToolState_2,
    (value) => {
      reactVectorToolState_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomVectorToolState",
    () => reactDomVectorToolState,
    (value) => {
      reactDomVectorToolState = value;
    },
  );
  return () => {
    reactVectorToolState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactVectorToolState_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactDomVectorToolState = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom)(),
      1,
    );
    (0, runtime.initializeNpm_usehooks_ts_p0)();
  };
}

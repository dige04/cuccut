/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomClientNamespace,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    reactDOMClientOT0: ReactDomClientNamespace;
    reactd0: ReactNamespace;
    reactDOMN3_: ReactDomNamespace;
    reactd3: ReactNamespace;
  }
}

export function installUiEditorBootstrapImports(
  runtime: RuntimeBindings,
): () => void {
  var reactDOMClientOT0: ReactDomClientNamespace;
  var reactd0: ReactNamespace;
  var reactDOMN3_: ReactDomNamespace;
  var reactd3: ReactNamespace;

  bindRuntimeValue(
    runtime,
    "reactDOMClientOT0",
    () => reactDOMClientOT0,
    (value) => {
      reactDOMClientOT0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactd0",
    () => reactd0,
    (value) => {
      reactd0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMN3_",
    () => reactDOMN3_,
    (value) => {
      reactDOMN3_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactd3",
    () => reactd3,
    (value) => {
      reactd3 = value;
    },
  );
  return () => {
    reactDOMClientOT0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomClientNamespace)(),
      1,
    );
    (0, runtime.initializeUiInputs210)();
    reactd0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDOMN3_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    (0, runtime.initializeUiInputs210)();
    reactd3 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
  };
}

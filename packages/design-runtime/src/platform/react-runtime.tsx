/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformReactRuntime(
  runtime: RuntimeBindings,
): () => void {
  var reactDomClientPlatformReactRuntime: Dynamic;
  var runtimeEmbeddedReact: Dynamic;

  bindRuntimeValue(
    runtime,
    "reactDomClientPlatformReactRuntime",
    () => reactDomClientPlatformReactRuntime,
    (value) => {
      reactDomClientPlatformReactRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runtimeEmbeddedReact",
    () => runtimeEmbeddedReact,
    (value) => {
      runtimeEmbeddedReact = value;
    },
  );
  return () => {
    reactDomClientPlatformReactRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_dom_client)(),
      1,
    );
    runtimeEmbeddedReact = {
      reactUmd: runtime.react18UmdSource,
      reactDomUmd: runtime.reactDom18UmdSource,
      supportJs: runtime.dcSupportSource,
    };
  };
}

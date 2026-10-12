/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelReactRuntime(runtime: RuntimeBindings): () => void {
  var DesignSystemReactRuntime: typeof import("react");
  bindRuntimeValue(
    runtime,
    "DesignSystemReactRuntime",
    () => DesignSystemReactRuntime,
    (value) => {
      DesignSystemReactRuntime = value;
    },
  );
  return () => {
    DesignSystemReactRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
  };
}

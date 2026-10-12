/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportStandaloneBootstrap(
  runtime: RuntimeBindings,
): () => void {
  var standaloneExportBootstrapScript: Dynamic;

  bindRuntimeValue(
    runtime,
    "standaloneExportBootstrapScript",
    () => standaloneExportBootstrapScript,
    (value) => {
      standaloneExportBootstrapScript = value;
    },
  );
  return () => {
    standaloneExportBootstrapScript = runtime.injected_PTt;
  };
}

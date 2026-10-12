/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installApplicationMain(runtime: RuntimeBindings): () => void {
  return () => {
    (0, runtime.interceptSamplingCapability)();
    (0, runtime.initializeFastEdit)();
    (0, runtime.claimCustomAnchors)();
    (0, runtime.bootstrapArtifactApplication)({
      tree: runtime.loadDesignDocumentTree,
    });
  };
}

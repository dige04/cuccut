/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorEventsRuntime(
  runtime: RuntimeBindings,
): () => void {
  function getEditorEventRuntime(): Dynamic {
    return runtime.OutlineAnnotationsResolvedValue;
  }
  function emitEditorEvent(input?: Dynamic, options?: Dynamic): Dynamic {
    getEditorEventRuntime().emitOmEvent(input, options);
    return true;
  }
  bindRuntimeValue(
    runtime,
    "getEditorEventRuntime",
    () => getEditorEventRuntime,
  );
  bindRuntimeValue(runtime, "emitEditorEvent", () => emitEditorEvent);
  return () => {};
}

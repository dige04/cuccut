/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformTombstoneActions(
  runtime: RuntimeBindings,
): () => void {
  function getTombstoneAction(input?: Dynamic): Dynamic {
    return !input.tombstone || input.deadStore
      ? "nothing"
      : input.canWrite
        ? "reopen-read-only-and-tell"
        : "tell";
  }
  bindRuntimeValue(runtime, "getTombstoneAction", () => getTombstoneAction);
  return () => {};
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type { AnnounceHistory } from "../contracts/composition";

export function installUiAnnouncedHistory(
  runtime: RuntimeBindings,
): () => void {
  function createAnnouncedHistory<Command, Seed>(
    history2: AnnounceHistory<Command, Seed>,
    announce: (message: string) => void = runtime.announceLiveMessage,
  ) {
    return {
      exec: (input: Command) => history2.exec(input),
      seed: (input: Seed) => history2.seed(input),
      undo() {
        if (!history2.canUndo()) {
          announce(runtime.UNDO_UNAVAILABLE_LABEL);
          return;
        }
        let value = history2.redoDepth();
        history2.undo();
        if (history2.redoDepth() === value + 1) {
          announce(runtime.UNDO_COMPLETE_LABEL);
        }
      },
      redo() {
        if (!history2.canRedo()) {
          announce(runtime.REDO_UNAVAILABLE_LABEL);
          return;
        }
        let value = history2.redoDepth();
        history2.redo();
        if (history2.redoDepth() === value - 1) {
          announce(runtime.REDO_COMPLETE_LABEL);
        }
      },
      canUndo: () => history2.canUndo(),
      canRedo: () => history2.canRedo(),
      redoDepth: () => history2.redoDepth(),
      clear: () => history2.clear(),
      subscribe: (input: () => void) => history2.subscribe(input),
    };
  }
  bindRuntimeValue(
    runtime,
    "createAnnouncedHistory",
    () => createAnnouncedHistory,
  );
  return () => {};
}

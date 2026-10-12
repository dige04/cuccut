/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** One undoable step: `do` applies it, `undo` reverts it; `canDo` / `canUndo` can veto the run. */
export interface HistoryCommand {
  label?: string;
  do(): void;
  undo(): void;
  canDo?(): boolean;
  canUndo?(): boolean;
}
/** Linear undo / redo stack with change subscriptions. */
export interface CommandHistory {
  exec(command: HistoryCommand): void;
  /** Records a command that has already been applied. */
  seed(command: HistoryCommand): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  redoDepth(): number;
  clear(): void;
  subscribe(listener: () => void): () => boolean;
}
/** Receives artifact feedback events (history steps, refused undos, shrink failures, ...). */
export type ArtifactFeedbackHandler = (message: string, detail?: object) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    createCommandHistory: (maxEntries?: number) => CommandHistory;
    artifactFeedbackHandler: ArtifactFeedbackHandler | undefined;
    setArtifactFeedbackHandler: (
      handler: ArtifactFeedbackHandler | undefined,
    ) => void;
    reportArtifactFeedback: (message: string, detail?: object) => void;
  }
}

export function installEditorCommandHistory(
  runtime: RuntimeBindings,
): () => void {
  var artifactFeedbackHandler: RuntimeBindings["artifactFeedbackHandler"];
  function createCommandHistory(maxEntries = 200): CommandHistory {
    let items: HistoryCommand[] = [],
      items2: HistoryCommand[] = [],
      values = new Set<() => void>();
    function value(): void {
      for (let value2 of values) value2();
    }
    return {
      exec(input: HistoryCommand): void {
        if (input.canDo?.() === false) {
          return;
        }
        input.do();
        items.push(input);
        if (items.length > maxEntries) {
          items.shift();
        }
        items2.length = 0;
        value();
      },
      seed(input: HistoryCommand): void {
        items.push(input);
        if (items.length > maxEntries) {
          items.shift();
        }
        items2.length = 0;
        value();
      },
      undo(): void {
        let value2: HistoryCommand | undefined = items[items.length - 1];
        if (!value2) {
          return;
        }
        if (value2.canUndo?.() === false) {
          return;
        }
        items.pop();
        value2.undo();
        items2.push(value2);
        value();
      },
      redo(): void {
        let value2: HistoryCommand | undefined = items2[items2.length - 1];
        if (!value2) {
          return;
        }
        if (value2.canDo?.() === false) {
          return;
        }
        items2.pop();
        value2.do();
        items.push(value2);
        value();
      },
      canUndo: (): boolean => items.length > 0,
      canRedo: (): boolean => items2.length > 0,
      redoDepth: (): number => items2.length,
      clear(): void {
        if (items.length === 0 && items2.length === 0) {
          return;
        }
        items.length = 0;
        items2.length = 0;
        value();
      },
      subscribe(input: () => void): () => boolean {
        values.add(input);
        return (): boolean => values.delete(input);
      },
    };
  }
  function setArtifactFeedbackHandler(
    handler?: ArtifactFeedbackHandler,
  ): void {
    artifactFeedbackHandler = handler;
  }
  function reportArtifactFeedback(message: string, detail?: object): void {
    try {
      artifactFeedbackHandler?.(message, detail);
    } catch {}
  }
  bindRuntimeValue(runtime, "createCommandHistory", () => createCommandHistory);
  bindRuntimeValue(
    runtime,
    "artifactFeedbackHandler",
    () => artifactFeedbackHandler,
    (value) => {
      artifactFeedbackHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setArtifactFeedbackHandler",
    () => setArtifactFeedbackHandler,
  );
  bindRuntimeValue(
    runtime,
    "reportArtifactFeedback",
    () => reportArtifactFeedback,
  );
  return () => {
    (0, runtime.initializeVideoLinks)();
  };
}

/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Runs a `document.execCommand` rich-text command; returns whether the browser handled it. */
export type ExecuteRichTextCommand = (command: string, value?: string) => boolean;

declare module "../bindings" {
  interface RuntimeBindings {
    executeRichTextCommand: ExecuteRichTextCommand;
    executingRichTextCommand: boolean;
    isExecutingRichTextCommand: () => boolean;
  }
}

export function installModelRichTextCommands(
  runtime: RuntimeBindings,
): () => void {
  var executingRichTextCommand: RuntimeBindings["executingRichTextCommand"];
  var isExecutingRichTextCommand: RuntimeBindings["isExecutingRichTextCommand"];
  function executeRichTextCommand(command: string, value?: string): boolean {
    executingRichTextCommand = true;
    try {
      document.execCommand("styleWithCSS", false, "false");
      return document.execCommand(command, false, value);
    } finally {
      executingRichTextCommand = false;
    }
  }
  bindRuntimeValue(
    runtime,
    "executeRichTextCommand",
    () => executeRichTextCommand,
  );
  bindRuntimeValue(
    runtime,
    "executingRichTextCommand",
    () => executingRichTextCommand,
    (value) => {
      executingRichTextCommand = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isExecutingRichTextCommand",
    () => isExecutingRichTextCommand,
    (value) => {
      isExecutingRichTextCommand = value;
    },
  );
  return () => {
    executingRichTextCommand = false;
    isExecutingRichTextCommand = (): boolean => executingRichTextCommand;
  };
}

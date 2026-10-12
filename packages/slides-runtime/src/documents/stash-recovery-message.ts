/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** What the restore prompt needs to know about a stashed (unsaved) slide edit. */
export interface StashedSlideRestoreContext {
  /** Display name of the slide (for example "slide 3"). */
  slide: string;
  /** The slide no longer exists in the deck. */
  gone?: boolean;
  /** The slide changed since the edits were stashed. */
  moved?: boolean;
}

/** Wording of the toast offering to restore stashed edits. */
export interface StashedSlideRestoreConfirmation {
  message: string;
  discardLabel: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    stashedSlideRestoreConfirmation: (
      context: StashedSlideRestoreContext,
    ) => StashedSlideRestoreConfirmation;
  }
}

export function installDocumentsStashRecoveryMessage(
  runtime: RuntimeBindings,
): () => void {
  function stashedSlideRestoreConfirmation(
    context: StashedSlideRestoreContext,
  ): StashedSlideRestoreConfirmation {
    if (context.gone && context.moved) {
      return {
        message: "Restore a deleted slide with your unsaved edits?",
        discardLabel: "Discard",
      };
    }
    if (!context.moved) {
      return {
        message: "Restore your unsaved edits to " + context.slide + "?",
        discardLabel: "Discard",
      };
    }
    return {
      message:
        context.slide.charAt(0).toUpperCase() +
        context.slide.slice(1) +
        " has changed since your unsaved edits. Restoring them replaces the newer version.",
      discardLabel: "Keep newer version",
    };
  }
  bindRuntimeValue(
    runtime,
    "stashedSlideRestoreConfirmation",
    () => stashedSlideRestoreConfirmation,
  );
  return () => {};
}

import type { DocumentInputState, InputFocusEvent } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsDomInputObservation(
  runtime: RuntimeBindings,
): () => void {
  var documentInputStates: WeakMap<Document, DocumentInputState>;
  var dismissalKeys: Set<string>;
  var initializeDomInputObservation: () => void;
  function observeDocumentInput(input?: Document): void {
    if (input === undefined || documentInputStates.has(input)) return;
    let state = {
      observedInput: false,
      lastInputDismissing: false,
    };
    documentInputStates.set(input, state);
    let value: Pick<Document, "addEventListener"> = input.defaultView ?? input;
    value.addEventListener(
      "keydown",
      (input2) => {
        input2.isTrusted &&
          ((state.observedInput = true),
          (state.lastInputDismissing =
            !input2.isComposing && dismissalKeys.has(input2.key)));
      },
      true,
    );
    value.addEventListener(
      "pointerdown",
      (input2) => {
        input2.isTrusted &&
          ((state.observedInput = true), (state.lastInputDismissing = true));
      },
      true,
    );
    input.defaultView?.addEventListener("blur", () => {
      state.observedInput = false;
      state.lastInputDismissing = false;
    });
  }
  function ensureDocumentInputObserver(input?: Element | null): void {
    observeDocumentInput(input?.ownerDocument);
  }
  function isRestoredFocus(event: InputFocusEvent): boolean {
    if (event.relatedTarget !== null && event.relatedTarget !== undefined)
      return false;
    let value = (event.target as Element | null)?.ownerDocument ?? undefined,
      value2 = value == null ? undefined : documentInputStates.get(value);
    return value2 === undefined || !value2.observedInput
      ? false
      : value2.lastInputDismissing;
  }
  bindRuntimeValue(runtime, "observeDocumentInput", () => observeDocumentInput);
  bindRuntimeValue(
    runtime,
    "ensureDocumentInputObserver",
    () => ensureDocumentInputObserver,
  );
  bindRuntimeValue(runtime, "isRestoredFocus", () => isRestoredFocus);
  bindRuntimeValue(
    runtime,
    "documentInputStates",
    () => documentInputStates,
    (value) => {
      documentInputStates = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "dismissalKeys",
    () => dismissalKeys,
    (value) => {
      dismissalKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomInputObservation",
    () => initializeDomInputObservation,
    (value) => {
      initializeDomInputObservation = value;
    },
  );
  return () => {
    initializeDomInputObservation = (0, runtime.initializeOnce)(() => {
      documentInputStates = new WeakMap();
      dismissalKeys = new Set(["Escape", "Enter", " "]);
    });
  };
}

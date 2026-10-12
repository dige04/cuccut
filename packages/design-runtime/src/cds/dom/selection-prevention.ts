import type { SelectionMouseEvent } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsDomSelectionPrevention(
  runtime: RuntimeBindings,
): () => void {
  var DomSelectionPreventionFreezeValue: Readonly<{
    onMouseDown: (event: SelectionMouseEvent) => void;
  }>;
  var initializeDomSelectionPrevention: () => void;
  function preventMultipleClickSelection(event: SelectionMouseEvent): void {
    event.detail <= 1 ||
      event.button !== 0 ||
      (event.target as Element).closest?.(
        "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])",
      ) ||
      event.preventDefault();
  }
  function withSelectionPrevention<Event extends SelectionMouseEvent>(
    input?: (event: Event) => void,
  ): (event: Event) => void {
    return input
      ? (input2) => {
          input(input2);
          preventMultipleClickSelection(input2);
        }
      : preventMultipleClickSelection;
  }
  bindRuntimeValue(
    runtime,
    "preventMultipleClickSelection",
    () => preventMultipleClickSelection,
  );
  bindRuntimeValue(
    runtime,
    "withSelectionPrevention",
    () => withSelectionPrevention,
  );
  bindRuntimeValue(
    runtime,
    "DomSelectionPreventionFreezeValue",
    () => DomSelectionPreventionFreezeValue,
    (value) => {
      DomSelectionPreventionFreezeValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeDomSelectionPrevention",
    () => initializeDomSelectionPrevention,
    (value) => {
      initializeDomSelectionPrevention = value;
    },
  );
  return () => {
    initializeDomSelectionPrevention = (0, runtime.initializeOnce)(() => {
      "use client";

      DomSelectionPreventionFreezeValue = Object.freeze({
        onMouseDown: preventMultipleClickSelection,
      });
    });
  };
}

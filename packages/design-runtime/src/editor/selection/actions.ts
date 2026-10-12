/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSelectionActions(
  runtime: RuntimeBindings,
): () => void {
  var SelectionActionsReplace: Dynamic;
  var SelectionActionsHelmetScHelmetPattern: Dynamic;
  function selectionActionFailureMessage(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input === "delete" ? "press Delete" : "duplicate";
    if (!context)
      return (
        "Couldn\u2019t " +
        input +
        " the elements you selected: someone else\u2019s edit arrived first. Select them again and " +
        value +
        "."
      );
    let value2: Dynamic =
      options === 1 ? "one artboard" : options + " artboards";
    return (
      (input === "delete" ? "Deleted" : "Duplicated") +
      ", except in " +
      value2 +
      " that someone else just changed. Select the elements there again and " +
      value +
      (input === "delete" ? "." : " again.")
    );
  }
  bindRuntimeValue(
    runtime,
    "SelectionActionsReplace",
    () => SelectionActionsReplace,
    (value) => {
      SelectionActionsReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionActionsHelmetScHelmetPattern",
    () => SelectionActionsHelmetScHelmetPattern,
    (value) => {
      SelectionActionsHelmetScHelmetPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectionActionFailureMessage",
    () => selectionActionFailureMessage,
  );
  return () => {
    SelectionActionsReplace = (input?: Dynamic): Dynamic =>
      (input.split("/").pop() ?? input).replace(/\.dc\.html$/, "");
    SelectionActionsHelmetScHelmetPattern =
      /^(helmet|sc-helmet|script|style|link|noscript|template)$/i;
  };
}

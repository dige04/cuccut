import type * as React from "react";
import type * as Color from "../contracts/color-controls";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installUiPropertyLabels(runtime: RuntimeBindings): () => void {
  var reactForUiContrastControls: typeof import("react");
  var RESET_LABEL: string;
  var MORE_ACTIONS_LABEL: string;
  var DEFAULT_CLOSE_LABEL: string;
  var TYPE_LABEL: string;
  var MIXED_LABEL: string;
  var COLOR_LABEL: string;
  var COLOR_SEARCH_LABEL: string;
  var NO_COLOR_MATCHES_LABEL: string;
  var INCREASE_LABEL: string;
  var DECREASE_LABEL: string;
  var CONTRAST_GROUND_PREPOSITION: string;
  var CONTRAST_POOR_GROUND_PREPOSITION: string;
  var CONTRAST_PASSES_LABEL: string;
  var CONTRAST_FAILS_LABEL: string;
  var COLOR_FIX_LABEL: string;
  var UNDO_COMPLETE_LABEL: string;
  var REDO_COMPLETE_LABEL: string;
  var UNDO_UNAVAILABLE_LABEL: string;
  var REDO_UNAVAILABLE_LABEL: string;
  function numberChangeRefusalMessage(label?: string, unit?: string): string {
    return (
      "Nothing changed. " +
      (label ?? "This field") +
      " takes a number " +
      (unit ? "in " + unit : "only") +
      "."
    );
  }
  function additionalPassingGroundsMessage(count: number): string {
    if (count > 0) {
      return (
        "; " +
        String(count) +
        (count === 1 ? " more ground passes" : " more grounds pass")
      );
    } else {
      return "";
    }
  }
  function contrastResultSummary(result: Color.ContrastSentence): string {
    return (
      (result.passes ? CONTRAST_PASSES_LABEL : CONTRAST_FAILS_LABEL) +
      ", " +
      result.ratio +
      " " +
      CONTRAST_GROUND_PREPOSITION +
      " " +
      result.ground +
      (result.passes ? "" : ", below " + result.min)
    );
  }
  function contrastResultDetails(
    result: Color.ContrastDetailsSentence,
  ): string {
    let value = contrastResultSummary(result),
      value2 = result.alsoFailing ?? [];
    if (value2.length > 0) {
      value += "; also below " + result.min + " on " + value2.join(" and ");
    }
    return value + additionalPassingGroundsMessage(result.alsoPassing ?? 0);
  }
  function contrastResultCountSummary(
    result: Color.ContrastCountSentence,
  ): string {
    let value = result.alsoFailing ?? 0;
    return (
      contrastResultSummary(result) +
      (value > 0
        ? "; also too low on " +
          String(value) +
          (value === 1 ? " more ground" : " more grounds")
        : "") +
      additionalPassingGroundsMessage(result.alsoPassing ?? 0)
    );
  }
  function contrastFixDescription(fix: {
    hex: string;
    ratio: string;
    ground: string;
  }): string {
    return (
      "Changes the color to " +
      fix.hex +
      ", contrast " +
      fix.ratio +
      " on " +
      fix.ground
    );
  }
  bindRuntimeValue(
    runtime,
    "reactForUiContrastControls",
    () => reactForUiContrastControls,
    (value) => {
      reactForUiContrastControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RESET_LABEL",
    () => RESET_LABEL,
    (value) => {
      RESET_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MORE_ACTIONS_LABEL",
    () => MORE_ACTIONS_LABEL,
    (value) => {
      MORE_ACTIONS_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_CLOSE_LABEL",
    () => DEFAULT_CLOSE_LABEL,
    (value) => {
      DEFAULT_CLOSE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TYPE_LABEL",
    () => TYPE_LABEL,
    (value) => {
      TYPE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIXED_LABEL",
    () => MIXED_LABEL,
    (value) => {
      MIXED_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_LABEL",
    () => COLOR_LABEL,
    (value) => {
      COLOR_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COLOR_SEARCH_LABEL",
    () => COLOR_SEARCH_LABEL,
    (value) => {
      COLOR_SEARCH_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NO_COLOR_MATCHES_LABEL",
    () => NO_COLOR_MATCHES_LABEL,
    (value) => {
      NO_COLOR_MATCHES_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "INCREASE_LABEL",
    () => INCREASE_LABEL,
    (value) => {
      INCREASE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DECREASE_LABEL",
    () => DECREASE_LABEL,
    (value) => {
      DECREASE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "numberChangeRefusalMessage",
    () => numberChangeRefusalMessage,
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_GROUND_PREPOSITION",
    () => CONTRAST_GROUND_PREPOSITION,
    (value) => {
      CONTRAST_GROUND_PREPOSITION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_POOR_GROUND_PREPOSITION",
    () => CONTRAST_POOR_GROUND_PREPOSITION,
    (value) => {
      CONTRAST_POOR_GROUND_PREPOSITION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_PASSES_LABEL",
    () => CONTRAST_PASSES_LABEL,
    (value) => {
      CONTRAST_PASSES_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTRAST_FAILS_LABEL",
    () => CONTRAST_FAILS_LABEL,
    (value) => {
      CONTRAST_FAILS_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "additionalPassingGroundsMessage",
    () => additionalPassingGroundsMessage,
  );
  bindRuntimeValue(
    runtime,
    "contrastResultSummary",
    () => contrastResultSummary,
  );
  bindRuntimeValue(
    runtime,
    "contrastResultDetails",
    () => contrastResultDetails,
  );
  bindRuntimeValue(
    runtime,
    "contrastResultCountSummary",
    () => contrastResultCountSummary,
  );
  bindRuntimeValue(
    runtime,
    "COLOR_FIX_LABEL",
    () => COLOR_FIX_LABEL,
    (value) => {
      COLOR_FIX_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "contrastFixDescription",
    () => contrastFixDescription,
  );
  bindRuntimeValue(
    runtime,
    "UNDO_COMPLETE_LABEL",
    () => UNDO_COMPLETE_LABEL,
    (value) => {
      UNDO_COMPLETE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REDO_COMPLETE_LABEL",
    () => REDO_COMPLETE_LABEL,
    (value) => {
      REDO_COMPLETE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNDO_UNAVAILABLE_LABEL",
    () => UNDO_UNAVAILABLE_LABEL,
    (value) => {
      UNDO_UNAVAILABLE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REDO_UNAVAILABLE_LABEL",
    () => REDO_UNAVAILABLE_LABEL,
    (value) => {
      REDO_UNAVAILABLE_LABEL = value;
    },
  );
  return () => {
    reactForUiContrastControls = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    RESET_LABEL = "Reset";
    MORE_ACTIONS_LABEL = "More actions";
    DEFAULT_CLOSE_LABEL = "Close";
    TYPE_LABEL = "Type";
    MIXED_LABEL = "Mixed";
    COLOR_LABEL = "Color";
    COLOR_SEARCH_LABEL = "Search colors";
    NO_COLOR_MATCHES_LABEL = "No matches";
    INCREASE_LABEL = "Increase";
    DECREASE_LABEL = "Decrease";
    CONTRAST_GROUND_PREPOSITION = "on";
    CONTRAST_POOR_GROUND_PREPOSITION = "hard to read on";
    CONTRAST_PASSES_LABEL = "Good contrast";
    CONTRAST_FAILS_LABEL = "Poor contrast";
    COLOR_FIX_LABEL = "Use a readable shade";
    UNDO_COMPLETE_LABEL = "Undone";
    REDO_COMPLETE_LABEL = "Redone";
    UNDO_UNAVAILABLE_LABEL = "Nothing to undo";
    REDO_UNAVAILABLE_LABEL = "Nothing to redo";
  };
}

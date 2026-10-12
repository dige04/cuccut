/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Labels for the four parts of a box: sides (top, right, bottom, left) or corners clockwise from top left. */
export type FourPartLabels = readonly [string, string, string, string];

/** The spoken facts of one contrast check. */
export interface ContrastResultBase {
  passes: boolean;
  /** Spoken contrast ratio. */
  ratio: string | number;
  /** Label of the ground the color sits on. */
  ground: string;
  /** Spoken minimum ratio the check demands. */
  min: string | number;
  /** Number of further grounds that pass. */
  alsoPassing?: number;
}

/** A contrast result summarising how many other grounds fail. */
export interface ContrastCountResult extends ContrastResultBase {
  alsoFailing?: number;
}

/** A contrast result naming the other grounds that fail. */
export interface ContrastDetailResult extends ContrastResultBase {
  alsoFailing?: readonly string[];
}

/** A suggested readable replacement color. */
export interface ContrastFixInfo {
  hex: string;
  ratio: string | number;
  ground: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    RESET_LABEL: string;
    MORE_ACTIONS_LABEL: string;
    ADD_LABEL: string;
    DEFAULT_CLOSE_LABEL: string;
    TYPE_LABEL: string;
    MIXED_LABEL: string;
    COLOR_LABEL: string;
    COLOR_SEARCH_LABEL: string;
    NO_COLOR_MATCHES_LABEL: string;
    SLIDE_COLORS_LABEL: string;
    STYLE_SEARCH_LABEL: string;
    INCREASE_LABEL: string;
    DECREASE_LABEL: string;
    INHERITED_LABEL: string;
    PER_SIDE_LABEL: string;
    PER_CORNER_LABEL: string;
    EDIT_LABEL: string;
    HIDE_LABEL: string;
    UNIFIED_VALUES_DISABLED_REASON: string;
    CONTRAST_GROUND_PREPOSITION: string;
    CONTRAST_PASSES_LABEL: string;
    CONTRAST_FAILS_LABEL: string;
    COLOR_FIX_LABEL: string;
    addToSectionLabel: (label: string) => string;
    SIDE_LABELS: FourPartLabels;
    CORNER_LABELS_rc0: FourPartLabels;
    initializeUiPropertyLabels: () => void;
    numberChangeRefusalMessage: (
      label: string | undefined,
      unit?: string | null,
    ) => string;
    additionalPassingGroundsMessage: (count: number) => string;
    contrastResultSummary: (result: ContrastResultBase) => string;
    contrastResultDetails: (result: ContrastDetailResult) => string;
    contrastResultCountSummary: (result: ContrastCountResult) => string;
    contrastFixDescription: (fix: ContrastFixInfo) => string;
  }
}

export function installUiPropertyLabels(runtime: RuntimeBindings): () => void {
  var RESET_LABEL: string;
  var MORE_ACTIONS_LABEL: string;
  var addToSectionLabel: (label: string) => string;
  var ADD_LABEL: string;
  var DEFAULT_CLOSE_LABEL: string;
  var TYPE_LABEL: string;
  var MIXED_LABEL: string;
  var COLOR_LABEL: string;
  var COLOR_SEARCH_LABEL: string;
  var NO_COLOR_MATCHES_LABEL: string;
  var SLIDE_COLORS_LABEL: string;
  var STYLE_SEARCH_LABEL: string;
  var INCREASE_LABEL: string;
  var DECREASE_LABEL: string;
  var INHERITED_LABEL: string;
  var PER_SIDE_LABEL: string;
  var PER_CORNER_LABEL: string;
  var EDIT_LABEL: string;
  var HIDE_LABEL: string;
  var UNIFIED_VALUES_DISABLED_REASON: string;
  var SIDE_LABELS: FourPartLabels;
  var CORNER_LABELS_rc0: FourPartLabels;
  var CONTRAST_GROUND_PREPOSITION: string;
  var CONTRAST_PASSES_LABEL: string;
  var CONTRAST_FAILS_LABEL: string;
  var COLOR_FIX_LABEL: string;
  var initializeUiPropertyLabels: () => void;
  function numberChangeRefusalMessage(
    label: string | undefined,
    unit?: string | null,
  ): string {
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
  function contrastResultSummary(result: ContrastResultBase): string {
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
  function contrastResultDetails(result: ContrastDetailResult): string {
    let value = contrastResultSummary(result),
      value2 = result.alsoFailing ?? [];
    if (value2.length > 0) {
      value += "; also below " + result.min + " on " + value2.join(" and ");
    }
    return value + additionalPassingGroundsMessage(result.alsoPassing ?? 0);
  }
  function contrastResultCountSummary(result: ContrastCountResult): string {
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
  function contrastFixDescription(fix: ContrastFixInfo): string {
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
    "numberChangeRefusalMessage",
    () => numberChangeRefusalMessage,
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
    "contrastFixDescription",
    () => contrastFixDescription,
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
    "addToSectionLabel",
    () => addToSectionLabel,
    (value) => {
      addToSectionLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADD_LABEL",
    () => ADD_LABEL,
    (value) => {
      ADD_LABEL = value;
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
    "SLIDE_COLORS_LABEL",
    () => SLIDE_COLORS_LABEL,
    (value) => {
      SLIDE_COLORS_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STYLE_SEARCH_LABEL",
    () => STYLE_SEARCH_LABEL,
    (value) => {
      STYLE_SEARCH_LABEL = value;
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
    "INHERITED_LABEL",
    () => INHERITED_LABEL,
    (value) => {
      INHERITED_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PER_SIDE_LABEL",
    () => PER_SIDE_LABEL,
    (value) => {
      PER_SIDE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PER_CORNER_LABEL",
    () => PER_CORNER_LABEL,
    (value) => {
      PER_CORNER_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDIT_LABEL",
    () => EDIT_LABEL,
    (value) => {
      EDIT_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HIDE_LABEL",
    () => HIDE_LABEL,
    (value) => {
      HIDE_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNIFIED_VALUES_DISABLED_REASON",
    () => UNIFIED_VALUES_DISABLED_REASON,
    (value) => {
      UNIFIED_VALUES_DISABLED_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SIDE_LABELS",
    () => SIDE_LABELS,
    (value) => {
      SIDE_LABELS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CORNER_LABELS_rc0",
    () => CORNER_LABELS_rc0,
    (value) => {
      CORNER_LABELS_rc0 = value;
    },
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
    "COLOR_FIX_LABEL",
    () => COLOR_FIX_LABEL,
    (value) => {
      COLOR_FIX_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeUiPropertyLabels",
    () => initializeUiPropertyLabels,
    (value) => {
      initializeUiPropertyLabels = value;
    },
  );
  return () => {
    RESET_LABEL = "Reset";
    MORE_ACTIONS_LABEL = "More actions";
    addToSectionLabel = (label: string) => "Add to " + label;
    ADD_LABEL = "Add";
    DEFAULT_CLOSE_LABEL = "Close";
    TYPE_LABEL = "Type";
    MIXED_LABEL = "Mixed";
    COLOR_LABEL = "Color";
    COLOR_SEARCH_LABEL = "Search colors";
    NO_COLOR_MATCHES_LABEL = "No matches";
    SLIDE_COLORS_LABEL = "In this slide";
    STYLE_SEARCH_LABEL = "Search styles";
    INCREASE_LABEL = "Increase";
    DECREASE_LABEL = "Decrease";
    INHERITED_LABEL = "inherited";
    PER_SIDE_LABEL = "Per side";
    PER_CORNER_LABEL = "Per corner";
    EDIT_LABEL = "Edit";
    HIDE_LABEL = "Hide";
    UNIFIED_VALUES_DISABLED_REASON =
      "The values differ — make them equal to use one field";
    CONTRAST_GROUND_PREPOSITION = "on";
    CONTRAST_PASSES_LABEL = "Good contrast";
    CONTRAST_FAILS_LABEL = "Poor contrast";
    COLOR_FIX_LABEL = "Use a readable shade";
    initializeUiPropertyLabels = (0, runtime.initializeOnce)(() => {
      SIDE_LABELS = ["Top", "Right", "Bottom", "Left"];
      CORNER_LABELS_rc0 = [
        "Top left",
        "Top right",
        "Bottom right",
        "Bottom left",
      ];
    });
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportWarnings(runtime: RuntimeBindings): () => void {
  var getArtboardCaptureMode: Dynamic;
  var getArtboardCaptureOptions: Dynamic;
  var SomeTextInThisExportMayMessage: Dynamic;
  function normalizeExportWarnings(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return {};
    let callback: Dynamic = (input2?: Dynamic): Dynamic => {
        let value: Dynamic = input[input2];
        return typeof value == "number" &&
          Number.isInteger(value) &&
          value > 0 &&
          value <= 1e6
          ? value
          : 0;
      },
      state: Dynamic = {
        innerClipped: callback("ic"),
        scrollRegion: callback("sr"),
        collapsed: callback("cd"),
        unrevealed: callback("ur"),
      };
    return state.innerClipped ||
      state.scrollRegion ||
      state.collapsed ||
      state.unrevealed
      ? state
      : {};
  }
  function formatArtboardNames(items?: Dynamic): Dynamic {
    return items.length > 3
      ? String(items.length) + " artboards"
      : items.map((input?: Dynamic): Dynamic => '"' + input + '"').join(", ");
  }
  function clippedArtboardsMessage(
    items?: Dynamic,
    options: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = formatArtboardNames(items);
    return options
      ? value +
          (items.length === 1
            ? " runs past its frame, so the PNG stops at the frame."
            : " run past their frames, so each PNG stops at its frame.")
      : items.length === 1
        ? value +
          " runs past its frame, so the PNG stops at the frame \u2014 set Print mode to Flow to export its full length."
        : value +
          " run past their frames, so each PNG stops at its frame \u2014 set Print mode to Flow to export the full length.";
  }
  function fontSubstitutionWarnings(input?: Dynamic): Dynamic {
    return input !== undefined && input > 0
      ? [SomeTextInThisExportMayMessage]
      : [];
  }
  function emptyExportTailMessage(
    items?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = formatArtboardNames(items),
      value2: Dynamic =
        "about " + String(Math.round(options / 10) * 10) + " px",
      value3: Dynamic = items.length === 1,
      value4: Dynamic = value3
        ? value +
          "\u2019s frame is " +
          value2 +
          " taller than its content, so the file ends with that much blank space"
        : value +
          " have frames taller than their content (by up to " +
          value2 +
          "), so each ends with blank space in the file",
      value5: Dynamic =
        " To trim that space, choose Fit to content under Height in " +
        (value3 ? "the" : "each") +
        " artboard\u2019s settings.";
    return value4 + "." + (context ? value5 : "");
  }
  function selectionExportFileName(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return `${(0, runtime.exportFileName)(input, context)}-selection.${options}`;
  }
  bindRuntimeValue(
    runtime,
    "normalizeExportWarnings",
    () => normalizeExportWarnings,
  );
  bindRuntimeValue(
    runtime,
    "getArtboardCaptureMode",
    () => getArtboardCaptureMode,
    (value) => {
      getArtboardCaptureMode = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getArtboardCaptureOptions",
    () => getArtboardCaptureOptions,
    (value) => {
      getArtboardCaptureOptions = value;
    },
  );
  bindRuntimeValue(runtime, "formatArtboardNames", () => formatArtboardNames);
  bindRuntimeValue(
    runtime,
    "clippedArtboardsMessage",
    () => clippedArtboardsMessage,
  );
  bindRuntimeValue(
    runtime,
    "SomeTextInThisExportMayMessage",
    () => SomeTextInThisExportMayMessage,
    (value) => {
      SomeTextInThisExportMayMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontSubstitutionWarnings",
    () => fontSubstitutionWarnings,
  );
  bindRuntimeValue(
    runtime,
    "emptyExportTailMessage",
    () => emptyExportTailMessage,
  );
  bindRuntimeValue(
    runtime,
    "selectionExportFileName",
    () => selectionExportFileName,
  );
  return () => {
    getArtboardCaptureMode = (
      input?: Dynamic,
      options: Dynamic = {},
    ): Dynamic =>
      input?.frameless
        ? "box"
        : options.migrated
          ? "page"
          : input !== undefined && (0, runtime.isFlowExport)(input, options)
            ? "full"
            : "frame";
    getArtboardCaptureOptions = (
      input?: Dynamic,
      options: Dynamic = {},
    ): Dynamic => ({
      selectionRoot: "body",
      frame: {
        w: input.w,
        h: input.h,
      },
      clipToFrame: getArtboardCaptureMode(input, options) === "frame",
      fullLength: getArtboardCaptureMode(input, options) === "full",
      ...(options.settle
        ? {
            settle: true,
          }
        : {}),
    });
    SomeTextInThisExportMayMessage =
      "Some text in this export may be in a substitute font: one of the design\u2019s web fonts could not be used.";
  };
}

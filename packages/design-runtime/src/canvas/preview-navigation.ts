/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasPreviewNavigation(
  runtime: RuntimeBindings,
): () => void {
  var interactivePreviewSelector: Dynamic;
  function printableArtboards(input?: Dynamic): Dynamic {
    return input.filter(
      (input2?: Dynamic): Dynamic => input2.frameless !== true,
    );
  }
  function printableArtboardIndex(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = printableArtboards(input),
      value2: Dynamic = value.findIndex(
        (input2?: Dynamic): Dynamic => input2.file === options,
      );
    return value2 < 0
      ? null
      : {
          index: value2,
          count: value.length,
        };
  }
  function adjacentPrintableArtboard(
    items?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = items.findIndex(
      (input?: Dynamic): Dynamic => input.file === options,
    );
    if (value < 0) return null;
    for (
      let value2: Dynamic = value + context;
      value2 >= 0 && value2 < items.length;
      value2 += context
    ) {
      let value3: Dynamic = items[value2];
      if (value3.frameless === true) continue;
      let value4: Dynamic = printableArtboardIndex(items, value3.file);
      return {
        artboard: value3,
        ...value4,
      };
    }
    return null;
  }
  function isInteractivePreviewTarget(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    return value == null || typeof value.closest != "function"
      ? false
      : value.isContentEditable === true ||
          value.closest(interactivePreviewSelector) != null;
  }
  async function withClosedPreview(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = input.current();
    if (value === null) return options();
    input.leave();
    await input.laidOut();
    try {
      return await options();
    } finally {
      input.mayReopen(value) && (await input.reopen(value));
    }
  }
  bindRuntimeValue(runtime, "printableArtboards", () => printableArtboards);
  bindRuntimeValue(
    runtime,
    "printableArtboardIndex",
    () => printableArtboardIndex,
  );
  bindRuntimeValue(
    runtime,
    "adjacentPrintableArtboard",
    () => adjacentPrintableArtboard,
  );
  bindRuntimeValue(
    runtime,
    "interactivePreviewSelector",
    () => interactivePreviewSelector,
    (value) => {
      interactivePreviewSelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isInteractivePreviewTarget",
    () => isInteractivePreviewTarget,
  );
  bindRuntimeValue(runtime, "withClosedPreview", () => withClosedPreview);
  return () => {
    interactivePreviewSelector =
      "input,textarea,select,video,audio,canvas,[role=application],[role=scrollbar],[aria-roledescription=carousel],[aria-roledescription=slide],[role=textbox],[role=searchbox],[role=combobox],[role=spinbutton],[role=slider],[role=radiogroup],[role=radio],[role=tablist],[role=tab],[role=toolbar],[role=menu],[role=menubar],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=listbox],[role=option],[role=tree],[role=treegrid],[role=grid]";
  };
}

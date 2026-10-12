/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLayoutUngrouping(
  runtime: RuntimeBindings,
): () => void {
  var NothingToUngroupSelectAGroupMessage: Dynamic;
  var ThisComponentManagesItselfSoItMessage_2: Dynamic;
  var LayoutUngroupingLabel: Dynamic;
  var LayoutUngroupingLabel_2: Dynamic;
  var LayoutUngroupingLabel_3: Dynamic;
  var LayoutUngroupingLabel_4: Dynamic;
  function ungroupElementRefusal(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.element(options),
      value2: Dynamic = input.tagName(options) ?? "",
      value3: Dynamic = value?.hasAttribute("data-dc-group") === true;
    if (input.isUneditable(options))
      return ThisComponentManagesItselfSoItMessage_2;
    if (value2 === "dc-import" || value2 === "x-import")
      return LayoutUngroupingLabel;
    if (
      value2 === "sc-if" ||
      value2 === "sc-for" ||
      (input.isLoopDriven(options) && !value3)
    )
      return LayoutUngroupingLabel_3;
    let value4: Dynamic =
      value3 ||
      (!!value &&
        value.children.length > 0 &&
        [...value.children].every(
          (input2?: Dynamic): Dynamic => input2.localName === "section",
        ));
    if (
      input.targetParentLocked(options, "before") &&
      (value2 === "section" || !value4)
    )
      return LayoutUngroupingLabel_2;
    if (value?.closest("svg")) return LayoutUngroupingLabel_4;
    let value5: Dynamic = [...(value?.childNodes ?? [])].some(
      (input2?: Dynamic): Dynamic =>
        input2.nodeType === Node.TEXT_NODE &&
        (input2.nodeValue ?? "").trim() !== "",
    );
    if (!value || value5 || input.childTids(options).length === 0)
      return NothingToUngroupSelectAGroupMessage;
  }
  function selectionUngroupRefusal(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic;
    for (let value2 of (0, runtime.selectedRootElementIds)(input, [
      ...options,
    ]) as Dynamic) {
      let value3: Dynamic = ungroupElementRefusal(input, value2);
      if (value3 === undefined) return;
      value ??= value3;
    }
    return value;
  }
  function ungroupModelElement(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (!input.element(options)?.parentNode) return null;
    let value: Dynamic = /^(absolute|relative|fixed|sticky)$/.test(
      input.effectiveStyleValue(options, "position").trim(),
    )
      ? input.effectiveStyleValue(options, "z-index").trim()
      : "";
    for (let value2 of input.childTids(options) as Dynamic) {
      let value3: Dynamic = context?.get(value2);
      value3 &&
        (value3.position !== "flow" &&
          !value3.sameSpace &&
          !value3.transformed &&
          (0, runtime.restoreUngroupedLayout)(
            input,
            value2,
            value3,
            (0, runtime.ungroupedElementRect)(input, value2, value3),
            0,
            0,
          ),
        /^-?\d+$/.test(value) &&
          value3.positioned &&
          !input.hasAuthoredStyle(value2, "z-index") &&
          input.setStyleProperty(value2, "z-index", value));
    }
    return input.unwrapElement(options);
  }
  bindRuntimeValue(
    runtime,
    "NothingToUngroupSelectAGroupMessage",
    () => NothingToUngroupSelectAGroupMessage,
    (value) => {
      NothingToUngroupSelectAGroupMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisComponentManagesItselfSoItMessage_2",
    () => ThisComponentManagesItselfSoItMessage_2,
    (value) => {
      ThisComponentManagesItselfSoItMessage_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutUngroupingLabel",
    () => LayoutUngroupingLabel,
    (value) => {
      LayoutUngroupingLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutUngroupingLabel_2",
    () => LayoutUngroupingLabel_2,
    (value) => {
      LayoutUngroupingLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutUngroupingLabel_3",
    () => LayoutUngroupingLabel_3,
    (value) => {
      LayoutUngroupingLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutUngroupingLabel_4",
    () => LayoutUngroupingLabel_4,
    (value) => {
      LayoutUngroupingLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ungroupElementRefusal",
    () => ungroupElementRefusal,
  );
  bindRuntimeValue(
    runtime,
    "selectionUngroupRefusal",
    () => selectionUngroupRefusal,
  );
  bindRuntimeValue(runtime, "ungroupModelElement", () => ungroupModelElement);
  return () => {
    NothingToUngroupSelectAGroupMessage =
      "Nothing to ungroup. Select a group, or a layer that holds other layers.";
    ThisComponentManagesItselfSoItMessage_2 =
      "This component manages itself, so it can\u2019t be ungrouped";
    LayoutUngroupingLabel = "A component instance can\u2019t be ungrouped";
    LayoutUngroupingLabel_2 =
      "A slide can\u2019t be ungrouped. Ungroup what is inside it.";
    LayoutUngroupingLabel_3 =
      "A repeated or conditional layer follows the layout\u2019s data, so it can\u2019t be ungrouped";
    LayoutUngroupingLabel_4 = "Parts of a drawing can\u2019t be ungrouped";
  };
}

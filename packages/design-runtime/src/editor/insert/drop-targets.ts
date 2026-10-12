/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInsertDropTargets(
  runtime: RuntimeBindings,
): () => void {
  function fileDropPosition(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return {
      left:
        Math.max(
          0,
          Math.min(
            Math.round(input.x - context / 2) + options * 24,
            input.w - context,
          ),
        ) + input.sx,
      top:
        Math.max(
          0,
          Math.min(
            Math.round(input.y - value / 2) + options * 24,
            input.h - value,
          ),
        ) + input.sy,
    };
  }
  function isAbsolutelyPositionedModelElement(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = input.element(options);
    return (
      value != null &&
      (0, runtime.isUnconstrainedAbsoluteElement)(value, context)
    );
  }
  function isAbsolutelyPositionedHtml(
    input?: Dynamic,
    options: Dynamic = document,
  ): Dynamic {
    let value: Dynamic = singlePastedRootElement(input, options);
    return (
      value != null && (0, runtime.isUnconstrainedAbsoluteElement)(value, true)
    );
  }
  function parseHtmlFragment(input?: Dynamic, doc?: Dynamic): Dynamic {
    let value: Dynamic = doc.createElement("template");
    value.innerHTML = (0, runtime.toParserHtml)(input);
    return value.content;
  }
  function fragmentContentElements(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return [...parseHtmlFragment(input, options).children].filter(
      (input2?: Dynamic): Dynamic =>
        !runtime.SelectionActionsHelmetScHelmetPattern.test(input2.tagName),
    );
  }
  function wrapInlinePastedHtml(
    input?: Dynamic,
    options: Dynamic = document,
  ): Dynamic {
    let value: Dynamic = parseHtmlFragment(input, options);
    return value.children.length > 0 &&
      (0, runtime.isInlineTextContainer)(value) &&
      ![...value.children].some(
        (input2?: Dynamic): Dynamic =>
          (0, runtime.isUnconstrainedAbsoluteElement)(input2, false),
      )
      ? `<p style="margin: 0">${input}</p>`
      : input;
  }
  function pastedRootElementCount(
    input?: Dynamic,
    options: Dynamic = document,
  ): Dynamic {
    return fragmentContentElements(input, options).length;
  }
  function singlePastedRootElement(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = fragmentContentElements(input, options);
    return value.length === 1 ? value[0] : null;
  }
  function containsFlowPastedElements(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = document,
  ): Dynamic {
    return (
      !input &&
      fragmentContentElements(options, context).some(
        (input2?: Dynamic): Dynamic =>
          !(0, runtime.isUnconstrainedAbsoluteElement)(input2, true),
      )
    );
  }
  function pastedElementGeometry(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = document,
  ): Dynamic {
    let value: Dynamic = singlePastedRootElement(input, context);
    return value
      ? {
          tid: 0,
          tag: (0, runtime.readableTagName)(value.tagName.toLowerCase()),
          w: options.ew,
          h: options.eh,
          dx: options.ox - options.gx,
          dy: options.oy - options.gy,
        }
      : null;
  }
  function canFreezeSinglePaste(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = document,
  ): Dynamic {
    return (
      !input &&
      items.length === 1 &&
      !value &&
      singlePastedRootElement(context, extra) != null &&
      !isAbsolutelyPositionedHtml(context, extra)
    );
  }
  function pasteParentTarget(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = document,
  ): Dynamic {
    return options == null
      ? null
      : context != null ||
          (input === "root-end" && isAbsolutelyPositionedHtml(value, extra))
        ? options
        : null;
  }
  function rootDropContainer(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = context;
    for (
      let value3: Dynamic = input.parentTid(value);
      value3 != null && value3 !== options.page;
      value3 = input.parentTid(value)
    )
      value = value3;
    let value2: Dynamic = input.tagName(value) ?? "";
    return {
      top: value,
      takesFiles:
        value2 !== "svg" &&
        (0, runtime.canContainHtmlTag)(value2, "img") &&
        !input.isTextEditable(value),
    };
  }
  function emptyArtboardDropTarget(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    if (input.rootText().trim() !== "") return null;
    let value: Dynamic = input
      .childTids(null)
      .filter(
        (input2?: Dynamic): Dynamic =>
          !runtime.SelectionActionsHelmetScHelmetPattern.test(
            input.tagName(input2) ?? "",
          ) && !isAbsolutelyPositionedModelElement(input, input2, true),
      );
    if (value.length === 0)
      return {
        page: null,
        placement: {
          targetTid: null,
          position: "root-end",
        },
      };
    let value2: Dynamic = value[0],
      value3: Dynamic = value.length === 1 ? input.element(value2) : null;
    if (
      !value3 ||
      !/^(div|section|main|article)$/.test(input.tagName(value2) ?? "") ||
      input.isUneditable(value2)
    )
      return null;
    let value4: Dynamic = value3.cloneNode(true);
    for (let value6 of [...value4.children] as Dynamic) {
      let attribute: Dynamic = value6.getAttribute(runtime.DcTplAttribute);
      attribute != null &&
        isAbsolutelyPositionedModelElement(input, parseInt(attribute, 10)) &&
        value6.remove();
    }
    if (
      !(0, runtime.pickerElementSignature)(
        value4,
        (input2?: Dynamic): Dynamic =>
          (0, runtime.classifyElementStyleKind)(input2) === "text",
      )
    )
      return null;
    let callback: Dynamic = (input2?: Dynamic, options2?: Dynamic): Dynamic =>
        [options2, ""].includes(
          input.effectiveStyleValue(value2, input2).trim(),
        ),
      value5: Dynamic =
        callback("position", "static") &&
        ["transform", "filter", "contain"].every(
          (input2?: Dynamic): Dynamic => callback(input2, "none"),
        ) &&
        callback("will-change", "auto") &&
        (options == null ||
          input
            .topLevelTags(options)
            .every(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.canContainHtmlTag)(
                  input.tagName(value2) ?? "",
                  input2,
                ),
            ));
    return {
      page: value2,
      placement: value5
        ? {
            targetTid: value2,
            position: "into",
          }
        : {
            targetTid: null,
            position: "root-end",
          },
    };
  }
  bindRuntimeValue(runtime, "fileDropPosition", () => fileDropPosition);
  bindRuntimeValue(
    runtime,
    "isAbsolutelyPositionedModelElement",
    () => isAbsolutelyPositionedModelElement,
  );
  bindRuntimeValue(
    runtime,
    "isAbsolutelyPositionedHtml",
    () => isAbsolutelyPositionedHtml,
  );
  bindRuntimeValue(runtime, "parseHtmlFragment", () => parseHtmlFragment);
  bindRuntimeValue(
    runtime,
    "fragmentContentElements",
    () => fragmentContentElements,
  );
  bindRuntimeValue(runtime, "wrapInlinePastedHtml", () => wrapInlinePastedHtml);
  bindRuntimeValue(
    runtime,
    "pastedRootElementCount",
    () => pastedRootElementCount,
  );
  bindRuntimeValue(
    runtime,
    "singlePastedRootElement",
    () => singlePastedRootElement,
  );
  bindRuntimeValue(
    runtime,
    "containsFlowPastedElements",
    () => containsFlowPastedElements,
  );
  bindRuntimeValue(
    runtime,
    "pastedElementGeometry",
    () => pastedElementGeometry,
  );
  bindRuntimeValue(runtime, "canFreezeSinglePaste", () => canFreezeSinglePaste);
  bindRuntimeValue(runtime, "pasteParentTarget", () => pasteParentTarget);
  bindRuntimeValue(runtime, "rootDropContainer", () => rootDropContainer);
  bindRuntimeValue(
    runtime,
    "emptyArtboardDropTarget",
    () => emptyArtboardDropTarget,
  );
  return () => {};
}

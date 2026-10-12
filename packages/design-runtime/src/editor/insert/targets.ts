/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInsertTargets(
  runtime: RuntimeBindings,
): () => void {
  function sameInsertionPoint(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      input?.position === options?.position &&
      input?.targetTid === options?.targetTid
    );
  }
  function sameArrowHtml(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      input2
        .trim()
        .replace(
          runtime.SvgArrowsDcArrowHeadFilledPattern,
          (input3?: Dynamic, options2?: Dynamic): Dynamic =>
            (0, runtime.SvgArrowsHandler)(options2),
        );
    return callback(input) === callback(options ?? "");
  }
  function insertionPointForSelection(
    input?: Dynamic,
    items?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (items.length === 0)
      return input.findDeckStage()
        ? {
            targetTid: null,
            position: "root-end",
          }
        : defaultInsertionPoint(input, context);
    let items2: Dynamic = [
        ...new Set(
          items.map(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.promoteSvgShapeToRoot)(input, input2),
          ),
        ),
      ],
      value: Dynamic = Math.max(...items2),
      state: Dynamic = {
        targetTid: value,
        position: "after",
      },
      value2: Dynamic = items2.length === 1 ? input.element(value) : null;
    if (!value2) return state;
    let value3: Dynamic = input.tagName(value) ?? "";
    if (/^(x-import|dc-import|helmet|sc-for|sc-if)$/.test(value3)) return state;
    for (let value5: Dynamic = value2; value5; value5 = value5.parentElement)
      if (value5.tagName.toLowerCase() === "svg") return state;
    if (input.isUneditable(value) || input.isTextEditable(value)) return state;
    let value4: Dynamic = input.topLevelTags(context);
    return value4.length === 0 ||
      !value4.every(
        (input2?: Dynamic): Dynamic =>
          (0, runtime.canContainHtmlTag)(value3, input2),
      ) ||
      sameArrowHtml(context, input.subtreeHtml(value))
      ? state
      : {
          targetTid: value,
          position: "into",
        };
  }
  function defaultInsertionPoint(input?: Dynamic, options?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        input
          .childTids(input2)
          .filter(
            (input3?: Dynamic): Dynamic =>
              !runtime.ClipboardTemplateFlatteningHelmetScriptPattern.test(
                input.tagName(input3) ?? "",
              ),
          ),
      value: Dynamic = callback(null),
      value2: Dynamic = value.filter((input2?: Dynamic): Dynamic => {
        let value6: Dynamic = input.element(input2);
        return !(
          value6 && (0, runtime.isUnconstrainedAbsoluteElement)(value6, true)
        );
      }),
      value3: Dynamic = value2.length > 0 ? value2 : value,
      items: Dynamic = [];
    for (; value3.length === 1 && isDetachableImport(input, value3[0]); ) {
      items.push(value3[0]);
      value3 = callback(value3[0]);
    }
    let value4: Dynamic = items.some(
        (input2?: Dynamic): Dynamic =>
          sameArrowHtml(options, input.subtreeHtml(input2)),
      ),
      value5: Dynamic =
        value3.length === 1 && !value4
          ? insertionPointForSelection(input, value3, options)
          : null;
    return value5?.position === "into"
      ? value5
      : {
          targetTid: null,
          position: "root-end",
        };
  }
  function isDetachableImport(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.element(options);
    if (
      !value ||
      input.tagName(options) !== "x-import" ||
      input.isUneditable(options) ||
      input.findDeckStage(options)
    )
      return false;
    let value2: Dynamic = [...value.childNodes].filter(
      (input2?: Dynamic): Dynamic =>
        !(
          input2.nodeType === 1 &&
          runtime.ClipboardTemplateFlatteningHelmetScriptPattern.test(
            input2.tagName,
          )
        ),
    );
    return (
      value2.filter((input2?: Dynamic): Dynamic => input2.nodeType === 1)
        .length === 1 &&
      value2.every(
        (input2?: Dynamic): Dynamic =>
          input2.nodeType === 1 ||
          input2.nodeType === 8 ||
          (input2.textContent ?? "").trim() === "",
      )
    );
  }
  function textToParagraphHtml(
    input?: Dynamic,
    options: Dynamic = "margin: 0",
  ): Dynamic {
    return input.startsWith("<")
      ? input
      : `<p style="${options}">${(0, runtime.escapeHtml)(input)}</p>`;
  }
  function insertHtmlIntoModel(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = input.model.insertHtml(
      options,
      context.targetTid,
      context.position,
    );
    return !value || value.length === 0
      ? []
      : (input.model.restamp(),
        value
          .map(
            (element?: Dynamic): Dynamic =>
              parseInt(element.getAttribute("data-dc-tpl") ?? "-1", 10),
          )
          .filter((input2?: Dynamic): Dynamic => input2 >= 0));
  }
  function deleteModelElements(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = options.filter(
      (input2?: Dynamic): Dynamic => input.model.element(input2) != null,
    );
    if (
      value.some(
        (input2?: Dynamic): Dynamic => input.model.isLoopDriven(input2),
      )
    )
      return 0;
    let value2: Dynamic = value.filter(
      (input2?: Dynamic): Dynamic => !input.model.isUneditable(input2),
    );
    if (value2.length === 0) return 0;
    let value3: Dynamic = (0, runtime.selectedSvgElements)(input.model, [
      ...value2,
    ]);
    for (let value4 of value3 as Dynamic) input.model.removeElement(value4);
    input.model = input.model.rebuild(input.model.serialize());
    return value3.length;
  }
  function restoreGroupPosition(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (
      options.parentTid == null ||
      options.parentTid !== value ||
      !input.element(options.parentTid)
    )
      return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" &&
        Number.isFinite(input2) &&
        Math.abs(input2) < 1e5
          ? String(Math.round(input2)) + "px"
          : null,
      value2: Dynamic = Array.isArray(options.siblings)
        ? options.siblings.slice(0, 200)
        : [],
      entries: Dynamic = new Map();
    for (let value5 of value2 as Dynamic)
      value5 &&
        typeof value5.tid == "number" &&
        entries.set(value5.tid, (entries.get(value5.tid) ?? 0) + 1);
    for (let value5 of value2 as Dynamic) {
      if (
        !value5 ||
        typeof value5.tid != "number" ||
        (entries.get(value5.tid) ?? 0) > 1 ||
        value5.tid === context ||
        input.parentTid(value5.tid) !== options.parentTid
      )
        continue;
      let value6: Dynamic = callback(value5.left),
        value7: Dynamic = callback(value5.top),
        value8: Dynamic = callback(value5.w),
        value9: Dynamic = callback(value5.h);
      value6 == null ||
        value7 == null ||
        value8 == null ||
        value9 == null ||
        (input.setStyleProperty(value5.tid, "position", "absolute"),
        input.setStyleProperty(value5.tid, "left", value6),
        input.setStyleProperty(value5.tid, "top", value7),
        input.setStyleProperty(value5.tid, "width", value8),
        input.setStyleProperty(value5.tid, "height", value9),
        input.setStyleProperty(value5.tid, "box-sizing", "border-box"),
        input.setStyleProperty(value5.tid, "max-width", "none"),
        input.setStyleProperty(value5.tid, "max-height", "none"),
        input.setStyleProperty(value5.tid, "min-width", "0"),
        input.setStyleProperty(value5.tid, "min-height", "0"));
    }
    let value3: Dynamic = callback(options.w),
      value4: Dynamic = callback(options.h);
    value3 != null &&
      value4 != null &&
      (input.setStyleProperty(options.parentTid, "width", value3),
      input.setStyleProperty(options.parentTid, "height", value4),
      input.setStyleProperty(options.parentTid, "box-sizing", "border-box"),
      input.setStyleProperty(options.parentTid, "max-width", "none"),
      input.setStyleProperty(options.parentTid, "max-height", "none"),
      input.setStyleProperty(options.parentTid, "flex-grow", "0"),
      input.setStyleProperty(options.parentTid, "flex-shrink", "0"),
      input.setStyleProperty(options.parentTid, "flex-basis", "auto"),
      input.inlineStyleValue(options.parentTid, "position") ||
        input.setStyleProperty(options.parentTid, "position", "relative"));
  }
  bindRuntimeValue(runtime, "sameInsertionPoint", () => sameInsertionPoint);
  bindRuntimeValue(runtime, "sameArrowHtml", () => sameArrowHtml);
  bindRuntimeValue(
    runtime,
    "insertionPointForSelection",
    () => insertionPointForSelection,
  );
  bindRuntimeValue(
    runtime,
    "defaultInsertionPoint",
    () => defaultInsertionPoint,
  );
  bindRuntimeValue(runtime, "isDetachableImport", () => isDetachableImport);
  bindRuntimeValue(runtime, "textToParagraphHtml", () => textToParagraphHtml);
  bindRuntimeValue(runtime, "insertHtmlIntoModel", () => insertHtmlIntoModel);
  bindRuntimeValue(runtime, "deleteModelElements", () => deleteModelElements);
  bindRuntimeValue(runtime, "restoreGroupPosition", () => restoreGroupPosition);
  return () => {};
}

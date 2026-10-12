/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardTemplateFlattening(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardTemplateFlatteningAZaZPattern: Dynamic;
  var unsafeTemplateCodePattern: Dynamic;
  var ClipboardTemplateFlatteningMatch: Dynamic;
  var ClipboardTemplateFlatteningAZaZPattern_2: Dynamic;
  var ClipboardTemplateFlatteningScriptStyleIframeSet: Dynamic;
  var ClipboardTemplateFlatteningSubscribers: Dynamic;
  var ClipboardTemplateFlatteningLimit: Dynamic;
  var ClipboardTemplateFlatteningTrueFalseNullSet: Dynamic;
  var ClipboardTemplateFlatteningHelmetScriptPattern: Dynamic;
  function substituteTemplateValues(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    return input.replace(
      ClipboardTemplateFlatteningAZaZPattern,
      (input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value: Dynamic = options(options2);
        return typeof value == "boolean" || value === null
          ? "{{" + String(value) + "}}"
          : typeof value == "number"
            ? Number.isFinite(value)
              ? context && /^-?\d+(\.\d+)?$/.test(String(value))
                ? "{{" + String(value) + "}}"
                : String(value)
              : input2
            : typeof value != "string" ||
                /[{}]/.test(value) ||
                runtime.ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(
                  value,
                )
              ? input2
              : value;
      },
    );
  }
  function flattenTemplateValues(
    input?: Dynamic,
    options?: Dynamic,
    doc: Dynamic = document,
  ): Dynamic {
    if (!input.includes("{{")) return input;
    try {
      let value: Dynamic = (0, runtime.createNativeDomAccessors)(doc.body),
        value2: Dynamic = doc.createElement("template");
      value2.innerHTML = (0, runtime.toParserHtml)(input);
      let index: Dynamic = 0,
        index2: Dynamic = 0,
        callback: Dynamic = (items?: Dynamic, items2?: Dynamic): Dynamic => {
          index2 += items2.length - items.length;
          if (index2 > ClipboardTemplateFlatteningLimit)
            throw new RangeError("bake budget");
        },
        callback2: Dynamic = (
          input2?: Dynamic,
          options2?: Dynamic,
        ): Dynamic => {
          let value4: Dynamic = value.nodeType(input2);
          if (value4 === 3) {
            if (
              runtime.ClipboardLayoutSnapshotsScriptStyleXmpSet.has(options2) ||
              options2 === "textarea" ||
              options2 === "title"
            )
              return;
            let value8: Dynamic = input2.nodeValue ?? "",
              value9: Dynamic = substituteTemplateValues(value8, options);
            value9 !== value8 &&
              (callback(value8, value9), (input2.nodeValue = value9), index++);
            return;
          }
          if (value4 !== 1) return;
          let value5: Dynamic = input2,
            value6: Dynamic = value.tagName(value5).toLowerCase(),
            value7: Dynamic = value6.startsWith("sc-raw-")
              ? value6.slice(7)
              : value6;
          if (
            !(
              value7.includes(":") ||
              runtime.ClipboardHtmlSanitizationScriptDataDcScriptPattern.test(
                "<" + value7,
              )
            )
          ) {
            if (!ClipboardTemplateFlatteningScriptStyleIframeSet.has(value7))
              for (let value8 of Array.from(
                value.attributes(value5),
              ) as Dynamic) {
                let value9: Dynamic = value8.name.startsWith(
                    runtime.ScCamelValue,
                  )
                    ? value8.name.slice(runtime.ScCamelValue.length)
                    : value8.name,
                  value10: Dynamic = value9
                    .toLowerCase()
                    .replace(/[^a-z]/g, "");
                if (
                  !value8.value.includes("{{") ||
                  value10.startsWith("on") ||
                  value9.startsWith("sc-") ||
                  ["srcdoc", "formaction", "ping", "contenteditable"].includes(
                    value10,
                  ) ||
                  ((value7 === "x-import" || value7 === "dc-import") &&
                    ["from", "import", "src"].includes(value10))
                )
                  continue;
                let value11: Dynamic = value10.startsWith("style"),
                  value12: Dynamic = substituteTemplateValues(
                    value8.value,
                    options,
                    !value11 &&
                      ClipboardTemplateFlatteningAZaZPattern_2.test(
                        value8.value,
                      ),
                  );
                if (value12 !== value8.value) {
                  if (value11) {
                    if (!(0, runtime.isPastedStylePreserved)(value12)) continue;
                  } else if (
                    value10 === "srcset" ||
                    value10 === "imagesrcset"
                  ) {
                    if (!(0, runtime.isSafePastedSrcset)(value12)) continue;
                  } else if (
                    ClipboardTemplateFlatteningSubscribers.has(value10) &&
                    !(0, runtime.isSafePastedUrl)(
                      value12,
                      value10 === "src" ||
                        value10 === "poster" ||
                        value7 === "image" ||
                        value7 === "feimage",
                    )
                  )
                    continue;
                  callback(value8.value, value12);
                  value.setAttribute(value5, value8.name, value12);
                  index++;
                }
              }
            if (value7 !== "template")
              for (let value8 of Array.from(
                value.childNodes(value5),
              ) as Dynamic)
                callback2(value8, value7);
          }
        };
      for (let value4 of Array.from(value2.content.childNodes) as Dynamic)
        callback2(value4, "");
      if (index === 0) return input;
      let value3: Dynamic = (0, runtime.fromParserHtml)(value2.innerHTML);
      return ClipboardTemplateFlatteningMatch(value3) >
        ClipboardTemplateFlatteningMatch(input)
        ? input
        : value3;
    } catch {
      return input;
    }
  }
  function getLoopTemplateVariables(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set();
    if (!/<sc-for\b/i.test(input)) return values;
    let value: Dynamic = (document as Dynamic).createElement("template");
    value.innerHTML = input;
    for (let value2 of Array.from(
      value.content.querySelectorAll("sc-for"),
    ) as Dynamic)
      values.add((value2.getAttribute("as") ?? "").trim() || "item");
    return values;
  }
  function flattenSelectionTemplates(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.selectedRootElementIds)(input, [
        ...new Set(
          options.map(
            (input2?: Dynamic): Dynamic =>
              (0, runtime.promoteSvgShapeToRoot)(input, input2),
          ),
        ),
      ]).map((input2?: Dynamic): Dynamic => input.element(input2)),
      value2: Dynamic = context;
    for (
      let value3: Dynamic = value[0]?.parentElement ?? null;
      value3;
      value3 = value3.parentElement
    ) {
      if (
        value3.tagName.toLowerCase() !== "x-import" ||
        value3.hasAttribute("data-uneditable") ||
        !value.every(
          (input2?: Dynamic): Dynamic =>
            input2 != null && input2 !== value3 && value3.contains(input2),
        )
      )
        continue;
      let flag: Dynamic = true;
      for (
        let value7: Dynamic = value3;
        value7 && flag;
        value7 = value7.parentElement
      )
        flag = [...(value7.parentNode?.children ?? [])].every(
          (input2?: Dynamic): Dynamic =>
            input2 === value7 ||
            ClipboardTemplateFlatteningHelmetScriptPattern.test(input2.tagName),
        );
      if (!flag) continue;
      let value4: Dynamic = value3.cloneNode(false);
      value4.removeAttribute(runtime.DcTplAttribute);
      value4.removeAttribute("style");
      let value5: Dynamic = (document as Dynamic).createElement("template");
      value5.content.appendChild(value4);
      let value6: Dynamic = (0, runtime.fromParserHtml)(value5.innerHTML),
        text: Dynamic = "</x-import>";
      value2 =
        value6.slice(0, value6.length - text.length) +
        `
` +
        value2 +
        `
` +
        text;
    }
    return value2;
  }
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningAZaZPattern",
    () => ClipboardTemplateFlatteningAZaZPattern,
    (value) => {
      ClipboardTemplateFlatteningAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unsafeTemplateCodePattern",
    () => unsafeTemplateCodePattern,
    (value) => {
      unsafeTemplateCodePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningMatch",
    () => ClipboardTemplateFlatteningMatch,
    (value) => {
      ClipboardTemplateFlatteningMatch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningAZaZPattern_2",
    () => ClipboardTemplateFlatteningAZaZPattern_2,
    (value) => {
      ClipboardTemplateFlatteningAZaZPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "substituteTemplateValues",
    () => substituteTemplateValues,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningScriptStyleIframeSet",
    () => ClipboardTemplateFlatteningScriptStyleIframeSet,
    (value) => {
      ClipboardTemplateFlatteningScriptStyleIframeSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningSubscribers",
    () => ClipboardTemplateFlatteningSubscribers,
    (value) => {
      ClipboardTemplateFlatteningSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningLimit",
    () => ClipboardTemplateFlatteningLimit,
    (value) => {
      ClipboardTemplateFlatteningLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "flattenTemplateValues",
    () => flattenTemplateValues,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningTrueFalseNullSet",
    () => ClipboardTemplateFlatteningTrueFalseNullSet,
    (value) => {
      ClipboardTemplateFlatteningTrueFalseNullSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getLoopTemplateVariables",
    () => getLoopTemplateVariables,
  );
  bindRuntimeValue(
    runtime,
    "ClipboardTemplateFlatteningHelmetScriptPattern",
    () => ClipboardTemplateFlatteningHelmetScriptPattern,
    (value) => {
      ClipboardTemplateFlatteningHelmetScriptPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "flattenSelectionTemplates",
    () => flattenSelectionTemplates,
  );
  return () => {
    ClipboardTemplateFlatteningAZaZPattern =
      /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;
    unsafeTemplateCodePattern = new RegExp(
      runtime.ClipboardHtmlSanitizationScriptDataDcScriptPattern.source,
      "gi",
    );
    ClipboardTemplateFlatteningMatch = (input?: Dynamic): Dynamic =>
      input.match(unsafeTemplateCodePattern)?.length ?? 0;
    ClipboardTemplateFlatteningAZaZPattern_2 =
      /^\s*\{\{\s*[A-Za-z_$][\w$]*\s*\}\}\s*$/;
    ClipboardTemplateFlatteningScriptStyleIframeSet = new Set([
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "meta",
      "base",
      "link",
      ...runtime.ClipboardHtmlSanitizationAnimateSetAnimatemotionSet,
    ]);
    ClipboardTemplateFlatteningSubscribers = new Set(
      [...runtime.ClipboardHtmlSanitizationSubscribers_2].map(
        (input?: Dynamic): Dynamic => input.replace(/[^a-z]/g, ""),
      ),
    );
    ClipboardTemplateFlatteningLimit = 2e5;
    ClipboardTemplateFlatteningTrueFalseNullSet = new Set([
      "true",
      "false",
      "null",
      "undefined",
    ]);
    ClipboardTemplateFlatteningHelmetScriptPattern =
      /^((sc-)?helmet|script|style|template|link|meta|title)$/i;
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installFastEditStaticPreview(
  runtime: RuntimeBindings,
): () => void {
  var FAST_EDIT_ARTBOARD_SECTION_OPEN: Dynamic;
  var wrapFastEditTemplate: Dynamic;
  var CASE_SENSITIVE_SVG_ATTRIBUTES: Dynamic;
  var PLACEHOLDER_SIZE_PATTERN: Dynamic;
  var FAST_EDIT_STATIC_PREVIEW_CSS: Dynamic;
  function unwrapFastEditSection(sectionHtml?: Dynamic): Dynamic {
    let openingTag: Dynamic = /^<section\b[^>]*>/i.exec(sectionHtml);
    return openingTag === null || !/<\/section>\s*$/i.test(sectionHtml)
      ? null
      : sectionHtml.slice(
          openingTag[0].length,
          /<\/section>\s*$/i.exec(sectionHtml)!.index,
        );
  }
  function removeTemplateInterpolations(text?: Dynamic): Dynamic {
    let result: Dynamic = "",
      offset: Dynamic = 0;
    for (;;) {
      let value: Dynamic = text.indexOf("{{", offset);
      if (value < 0) break;
      let value2: Dynamic = text.indexOf("}}", value + 2);
      if (value2 < 0) break;
      result += text.slice(offset, value);
      offset = value2 + 2;
    }
    return result + text.slice(offset);
  }
  function parseStaticPreviewTemplate(html?: Dynamic): Dynamic {
    let template: Dynamic = (document as Dynamic).createElement("template");
    template.innerHTML = (0, runtime.toParserHtml)(html);
    return template;
  }
  function buildStaticFastEditPreview(
    html?: Dynamic,
    defaults?: Dynamic,
  ): Dynamic {
    let resolvedHtml: Dynamic = html;
    try {
      resolvedHtml = (0, runtime.flattenTemplateValues)(
        resolvedHtml,
        (input?: Dynamic): Dynamic =>
          Object.prototype.hasOwnProperty.call(defaults, input)
            ? defaults[input]
            : undefined,
      );
    } catch {}
    let template: Dynamic = parseStaticPreviewTemplate(resolvedHtml),
      placeholders: Dynamic = [],
      walk: Dynamic = (input?: Dynamic): Dynamic => {
        for (let value2 of Array.from(input.childNodes) as Dynamic) {
          if (value2.nodeType === 3) {
            let value5: Dynamic = value2.nodeValue ?? "";
            value5.includes("{{") &&
              (value2.nodeValue = removeTemplateInterpolations(value5));
            continue;
          }
          if (value2.nodeType !== 1) {
            value2.parentNode?.removeChild(value2);
            continue;
          }
          let value3: Dynamic = value2,
            localName: Dynamic = value3.localName;
          if (localName === "sc-helmet") {
            for (let value5 of Array.from(value3.children) as Dynamic)
              value5.localName === "style" &&
                placeholders.push(value5.outerHTML);
            value3.remove();
            continue;
          }
          if (
            localName === "script" ||
            localName === "noscript" ||
            localName === "template" ||
            localName === "meta" ||
            localName === "base" ||
            localName === "title" ||
            localName === "iframe" ||
            localName === "object" ||
            localName === "embed"
          ) {
            value3.remove();
            continue;
          }
          if (localName === "sc-if") {
            let value5: Dynamic = (
              value3.getAttribute("hint-placeholder-val") ?? ""
            ).replace(/[{}\s]/g, "");
            if (value5 === "false" || value5 === "0" || value5 === "null") {
              value3.remove();
              continue;
            }
            walk(value3);
            value3.replaceWith(...Array.from(value3.childNodes));
            continue;
          }
          if (localName === "sc-for") {
            let value5: Dynamic = Math.max(
              1,
              Math.min(
                6,
                parseInt(
                  value3.getAttribute("hint-placeholder-count") ?? "1",
                  10,
                ) || 1,
              ),
            );
            walk(value3);
            let items: Dynamic = [];
            for (let index: Dynamic = 0; index < value5; index++)
              for (let value6 of Array.from(value3.childNodes) as Dynamic)
                items.push(value6.cloneNode(true));
            value3.replaceWith(...items);
            continue;
          }
          if (localName === "dc-import" || localName === "x-import") {
            let value5: Dynamic = (document as Dynamic).createElement("div");
            value5.className = "ask-ph";
            let [value6, value7]: Dynamic = (
              value3.getAttribute("hint-size") ?? ""
            )
              .split(",")
              .map((input2?: Dynamic): Dynamic => input2.trim());
            value5.setAttribute(
              "style",
              removeTemplateInterpolations(value3.getAttribute("style") ?? "") +
                ";width:" +
                (value6 !== undefined && PLACEHOLDER_SIZE_PATTERN.test(value6)
                  ? value6
                  : "100%") +
                ";height:" +
                (value7 !== undefined && PLACEHOLDER_SIZE_PATTERN.test(value7)
                  ? value7
                  : "64px"),
            );
            value3.replaceWith(value5);
            continue;
          }
          let value4: Dynamic =
            value3.namespaceURI === "http://www.w3.org/2000/svg";
          for (let value5 of Array.from(value3.attributes) as Dynamic) {
            let value6: Dynamic = value5.name.startsWith(runtime.ScCamelValue)
                ? (0, runtime.kebabToCamelCase)(
                    value5.name.slice(runtime.ScCamelValue.length),
                  )
                : value5.name,
              value7: Dynamic = value6.toLowerCase();
            if (
              value7.startsWith("on") ||
              value7.startsWith("style-") ||
              value7.startsWith("hint-") ||
              value7.startsWith("sc-") ||
              value7 === "srcdoc" ||
              value7 === "contenteditable" ||
              value7 === "autofocus"
            ) {
              value3.removeAttribute(value5.name);
              continue;
            }
            let value8: Dynamic = value5.value;
            if (value8.includes("{{"))
              if (value7 === "style")
                value8 = value8
                  .split(";")
                  .filter((input2?: Dynamic): Dynamic => !input2.includes("{{"))
                  .join(";");
              else {
                value3.removeAttribute(value5.name);
                continue;
              }
            let value9: Dynamic =
              value5.name.startsWith(runtime.ScCamelValue) &&
              !(value4 && CASE_SENSITIVE_SVG_ATTRIBUTES.has(value6))
                ? value6 === "className"
                  ? "class"
                  : value6 === "htmlFor"
                    ? "for"
                    : value5.name.slice(runtime.ScCamelValue.length)
                : value5.name;
            if (value9 !== value5.name) {
              value3.removeAttribute(value5.name);
              try {
                value3.setAttribute(value9, value8);
              } catch {}
            } else
              value8 !== value5.value &&
                value3.setAttribute(value5.name, value8);
          }
          walk(value3);
        }
      };
    walk(template.content);
    let value: Dynamic = (0, runtime.fromParserHtml)(template.innerHTML);
    return (
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
      FAST_EDIT_STATIC_PREVIEW_CSS +
      "</style>" +
      placeholders.join("") +
      "</head><body>" +
      value +
      "</body></html>"
    );
  }
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_ARTBOARD_SECTION_OPEN",
    () => FAST_EDIT_ARTBOARD_SECTION_OPEN,
    (value) => {
      FAST_EDIT_ARTBOARD_SECTION_OPEN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "wrapFastEditTemplate",
    () => wrapFastEditTemplate,
    (value) => {
      wrapFastEditTemplate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unwrapFastEditSection",
    () => unwrapFastEditSection,
  );
  bindRuntimeValue(
    runtime,
    "CASE_SENSITIVE_SVG_ATTRIBUTES",
    () => CASE_SENSITIVE_SVG_ATTRIBUTES,
    (value) => {
      CASE_SENSITIVE_SVG_ATTRIBUTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "removeTemplateInterpolations",
    () => removeTemplateInterpolations,
  );
  bindRuntimeValue(
    runtime,
    "PLACEHOLDER_SIZE_PATTERN",
    () => PLACEHOLDER_SIZE_PATTERN,
    (value) => {
      PLACEHOLDER_SIZE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_STATIC_PREVIEW_CSS",
    () => FAST_EDIT_STATIC_PREVIEW_CSS,
    (value) => {
      FAST_EDIT_STATIC_PREVIEW_CSS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseStaticPreviewTemplate",
    () => parseStaticPreviewTemplate,
  );
  bindRuntimeValue(
    runtime,
    "buildStaticFastEditPreview",
    () => buildStaticFastEditPreview,
  );
  return () => {
    FAST_EDIT_ARTBOARD_SECTION_OPEN = '<section id="artboard">';
    wrapFastEditTemplate = (input?: Dynamic): Dynamic =>
      FAST_EDIT_ARTBOARD_SECTION_OPEN +
      (0, runtime.encodeCamelCaseAttributes)(input) +
      "</section>";
    CASE_SENSITIVE_SVG_ATTRIBUTES = new Set([
      "viewBox",
      "preserveAspectRatio",
      "gradientUnits",
      "gradientTransform",
      "patternUnits",
      "patternTransform",
      "patternContentUnits",
      "clipPathUnits",
      "maskUnits",
      "maskContentUnits",
      "markerWidth",
      "markerHeight",
      "markerUnits",
      "refX",
      "refY",
      "stdDeviation",
      "spreadMethod",
      "startOffset",
      "textLength",
      "lengthAdjust",
      "pathLength",
      "filterUnits",
      "primitiveUnits",
      "baseFrequency",
      "numOctaves",
      "tableValues",
      "kernelMatrix",
      "attributeName",
    ]);
    PLACEHOLDER_SIZE_PATTERN = /^\d{1,4}(?:\.\d{1,2})?(?:px|%)$/;
    FAST_EDIT_STATIC_PREVIEW_CSS =
      "html,body{margin:0}img,video{background:#e8e6e1}.ask-ph{box-sizing:border-box;display:inline-block;min-width:24px;min-height:24px;border-radius:8px;background:rgba(127,127,127,.14);outline:1px dashed rgba(127,127,127,.45);outline-offset:-1px}";
  };
}

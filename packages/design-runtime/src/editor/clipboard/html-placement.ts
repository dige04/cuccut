/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardHtmlPlacement(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardHtmlPlacementHtml: Dynamic;
  function positionPastedHtml(
    input?: Dynamic,
    options?: Dynamic,
    doc: Dynamic = document,
  ): Dynamic {
    let value: Dynamic =
        typeof options == "number"
          ? {
              ew: options,
              ox: 0,
              oy: 0,
            }
          : options,
      value2: Dynamic = Math.round(value.ox),
      value3: Dynamic = Math.round(value.oy),
      value4: Dynamic = doc.createElement("template");
    value4.innerHTML = (0, runtime.toParserHtml)(input);
    let value5: Dynamic =
        value.ew == null
          ? ""
          : " box-sizing: border-box; width: " +
            String(Math.ceil(value.ew)) +
            "px;",
      value6: Dynamic = Array.from(value4.content.children).filter(
        (input2?: Dynamic): Dynamic =>
          !/^(style|script|link|meta|title|template|noscript|sc-helmet)$/i.test(
            input2.tagName,
          ),
      );
    for (let value7 of value6 as Dynamic) {
      let value8: Dynamic = (value7.getAttribute("style") ?? "")
          .replace(/(^|;)\s*margin-(?:top|right|bottom|left)\s*:[^;]*/gi, "$1")
          .replace(/^[;\s]+/, "")
          .trim(),
        value9: Dynamic =
          "position: absolute; left: " +
          String(value2) +
          "px; top: " +
          String(value3) +
          "px; right: auto; bottom: auto; margin: 0px;" +
          value5;
      value7.setAttribute(
        "style",
        (value8 === "" ? "" : value8.replace(/;?$/, "; ")) + value9,
      );
    }
    return (0, runtime.fromParserHtml)(value4.innerHTML);
  }
  function unpositionPastedHtml(
    input?: Dynamic,
    doc: Dynamic = document,
  ): Dynamic {
    let value: Dynamic = doc.createElement("template");
    value.innerHTML = (0, runtime.toParserHtml)(input);
    let value2: Dynamic = Array.from(value.content.children).filter(
        (input2?: Dynamic): Dynamic =>
          !/^(style|script|link|meta|title|template|noscript|sc-helmet)$/i.test(
            input2.tagName,
          ),
      ),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        /^x-import$/i.test(input2.tagName) && input2.children.length === 1
          ? callback(input2.children[0])
          : input2;
    for (let value3 of value2.map(callback) as Dynamic) {
      let value4: Dynamic = (value3.getAttribute("style") ?? "")
        .split(";")
        .map((input2?: Dynamic): Dynamic => input2.trim())
        .filter((input2?: Dynamic): Dynamic => input2 !== "");
      if (
        !value4.some(
          (input2?: Dynamic): Dynamic =>
            /^position\s*:\s*absolute$/i.test(input2),
        )
      )
        continue;
      let callback2: Dynamic = (input2?: Dynamic): Dynamic =>
          /^(position\s*:\s*absolute|left\s*:\s*-?\d+(?:\.\d+)?px|top\s*:\s*-?\d+(?:\.\d+)?px|right\s*:\s*auto|bottom\s*:\s*auto|margin\s*:\s*0(?:px)?)$/i.exec(
            input2,
          )
            ? input2.split(":")[0].trim().toLowerCase()
            : null,
        values: Dynamic = new Set(),
        values2: Dynamic = new Set();
      for (let value9: Dynamic = value4.length - 1; value9 >= 0; value9--) {
        let value10: Dynamic = callback2(value4[value9]);
        value10 &&
          !values.has(value10) &&
          (values.add(value10), values2.add(value9));
      }
      let value5: Dynamic = value4
          .map((input2?: Dynamic, options?: Dynamic): Dynamic => options)
          .filter((input2?: Dynamic): Dynamic => !values2.has(input2)),
        value6: Dynamic = value4.findIndex(
          (input2?: Dynamic): Dynamic =>
            /^position\s*:\s*absolute$/i.test(input2),
        ),
        value7: Dynamic = -1;
      for (let value9: Dynamic = value5.length - 2; value9 >= 0; value9--) {
        let value10: Dynamic = value5[value9],
          value11: Dynamic = value5[value9 + 1];
        if (
          value10 > value6 &&
          /^box-sizing\s*:\s*border-box$/i.test(value4[value10]) &&
          /^width\s*:\s*\d+(\.\d+)?px$/i.test(value4[value11])
        ) {
          value7 = value9;
          break;
        }
      }
      let value8: Dynamic = value5
        .filter(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            value7 < 0 || (options !== value7 && options !== value7 + 1),
        )
        .map((input2?: Dynamic): Dynamic => value4[input2])
        .join("; ");
      value8 === ""
        ? value3.removeAttribute("style")
        : value3.setAttribute("style", value8);
    }
    return (0, runtime.fromParserHtml)(value.innerHTML);
  }
  function buildDcDocument(
    input?: Dynamic,
    options: Dynamic = "",
    context: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = (0, runtime.parseDcHtmlDocument)(options),
      value2: Dynamic = value ? options.slice(0, value.templateStart) : "",
      value3: Dynamic = /<script\b[^>]*support\.js/i.test(value2)
        ? value2
        : ClipboardHtmlPlacementHtml,
      items: Dynamic = [
        ...(value ? value.template : options).matchAll(
          /<helmet\b([^>]*)>([\s\S]*?)<\/helmet>/gi,
        ),
      ];
    return [
      value3.trimEnd(),
      "  <helmet" + (items[0]?.[1] ?? "") + ">",
      "    <style>",
      "      html, body { margin: 0; height: 100%; }",
      "    </style>",
      items
        .map((input2?: Dynamic): Dynamic => (input2[2] ?? "").trim())
        .filter((input2?: Dynamic): Dynamic => input2 !== "").join(`
`),
      "  </helmet>",
      input,
      "</x-dc>",
      ...(context.logic === false
        ? []
        : [stripPrivateDcProps(options)].filter(
            (input2?: Dynamic): Dynamic => input2 != null,
          )),
      "</body>",
      "</html>",
      "",
    ].join(`
`);
  }
  function stripPrivateDcProps(input?: Dynamic): Dynamic {
    let value: Dynamic = input,
      value2: Dynamic = (0, runtime.getDcPropsJson)(input);
    if (value2 != null) {
      let text: Dynamic = "";
      try {
        let value4: Dynamic = JSON.parse(value2),
          value5: Dynamic = Object.fromEntries(
            Object.entries(value4).filter(
              ([input2]: Dynamic): Dynamic => !input2.startsWith("$"),
            ),
          );
        text = Object.keys(value5).length > 0 ? JSON.stringify(value5) : "";
      } catch {
        text = "";
      }
      value = (0, runtime.setDcPropsJson)(input, text) ?? input;
    }
    let value3: Dynamic = (0, runtime.parseDcHtmlDocument)(value);
    return value3?.jsMatch && value3.jsMatch.index >= value3.templateEnd
      ? value3.jsMatch[0]
      : null;
  }
  bindRuntimeValue(runtime, "positionPastedHtml", () => positionPastedHtml);
  bindRuntimeValue(runtime, "unpositionPastedHtml", () => unpositionPastedHtml);
  bindRuntimeValue(
    runtime,
    "ClipboardHtmlPlacementHtml",
    () => ClipboardHtmlPlacementHtml,
    (value) => {
      ClipboardHtmlPlacementHtml = value;
    },
  );
  bindRuntimeValue(runtime, "buildDcDocument", () => buildDcDocument);
  bindRuntimeValue(runtime, "stripPrivateDcProps", () => stripPrivateDcProps);
  return () => {
    ClipboardHtmlPlacementHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"><script src="./support.js"><\/script></head>
<body>
<x-dc>`;
  };
}

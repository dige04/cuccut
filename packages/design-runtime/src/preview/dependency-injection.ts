/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewDependencyInjection(
  runtime: RuntimeBindings,
): () => void {
  var linkedStylesheetHydrationScript: Dynamic;
  var DcAddressRefusedValue: Dynamic;
  var PreviewDependencyInjectionResolvedValue: Dynamic;
  var PreviewDependencyInjectionResolvedValue_2: Dynamic;
  var PreviewDependencyInjectionTrim: Dynamic;
  var PreviewDependencyInjectionJoin: Dynamic;
  function findDocumentHeadInsertion(items?: Dynamic): Dynamic {
    let length: Dynamic = items.length;
    for (let value of ["<x-dc", "<helmet", "<template", "<body"] as Dynamic) {
      let value2: Dynamic = items.indexOf(value);
      value2 >= 0 && value2 < length && (length = value2);
    }
    return length;
  }
  function hydrateLinkedStylesheetScript(input?: Dynamic): Dynamic {
    let value: Dynamic = JSON.stringify(input).replace(/</g, "\\u003c");
    return (
      "<script>(function (s, p) { if (s && p && typeof p[" +
      value +
      "] === 'string') s.textContent = p[" +
      value +
      "]; })(document.currentScript && document.currentScript.previousElementSibling, window.__dcParts);<\/script>"
    );
  }
  function rewriteHtmlDependencies(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = {},
  ): Dynamic {
    if (!/<(?:link|script|style)\b/i.test(input)) return input;
    let callback: Dynamic = (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
      ): Dynamic => {
        let value3: Dynamic = (0, runtime.maskHtmlRawContent)(input2),
          value4: Dynamic = value3.replace(
            /[A-Z]+/g,
            (input3?: Dynamic): Dynamic => input3.toLowerCase(),
          ),
          text: Dynamic = "",
          index: Dynamic = 0;
        for (let [value5, value6] of (0, runtime.findHtmlTags)(
          value3,
          options2,
        ) as Dynamic) {
          if (value5 < index) continue;
          let value7: Dynamic = context2(
            input2.slice(value5, value6),
            value6,
            value3,
            value4,
          );
          value7 !== undefined &&
            ((text += input2.slice(index, value5) + value7[0]),
            (index = value7[1]));
        }
        return text + input2.slice(index);
      },
      value2: Dynamic = callback(
        input,
        "link",
        (
          items?: Dynamic,
          options2?: Dynamic,
          context2?: Dynamic,
          value3?: Dynamic,
        ): Dynamic => {
          let value4: Dynamic = (
            (0, runtime.getHtmlAttribute)(items, "rel") ?? ""
          )
            .toLowerCase()
            .split(/\s+/);
          if (!value4.includes("stylesheet") || value4.includes("alternate"))
            return;
          let value5: Dynamic = (0, runtime.resolveProjectAssetPath)(
            context,
            (0, runtime.getHtmlAttribute)(items, "href") ?? "",
          );
          if (
            value5 === null ||
            !/\.css$/i.test(value5) ||
            options[value5] == null
          )
            return;
          let value6: Dynamic = (0, runtime.parseHtmlAttributes)(items, [
              "href",
              "rel",
              "type",
              "as",
              "crossorigin",
              "integrity",
              "disabled",
              "media",
            ]),
            value7: Dynamic =
              (0, runtime.getHtmlAttribute)(items, "disabled") !== null
                ? "not all"
                : (0, runtime.getHtmlAttribute)(items, "media");
          value7 !== null && (value6.media = value7);
          value.covered?.has(value5) && (value6["data-dc-sheet"] = value5);
          let value8: Dynamic =
            "<style" +
            Object.entries(value6)
              .map(
                ([input2, input3]: Dynamic): Dynamic =>
                  " " +
                  input2 +
                  '="' +
                  input3
                    .replace(/&/g, "&amp;")
                    .replace(/"/g, "&quot;")
                    .replace(/</g, "&lt;") +
                  '"',
              )
              .join("") +
            ">";
          if (value.covered?.has(value5))
            return [value8 + "</style>", options2];
          let value9: Dynamic =
              options2 - items.length < findDocumentHeadInsertion(value3),
            value10: Dynamic = value.parts?.urlFor?.(value5);
          if (
            value10 !== undefined &&
            options[value5].length >= (value.parts?.min ?? 1 / 0) &&
            value9
          ) {
            value7 === null && value.inlined?.add(value5);
            value.parts?.urls && (value.parts.urls[value5] = value10);
            let state: Dynamic = {
              ...value6,
              rel: "stylesheet",
              href: value10,
              "data-dc-sheet": value5,
              onerror: linkedStylesheetHydrationScript,
            };
            return [
              "<link" +
                Object.entries(state)
                  .map(
                    ([input2, input3]: Dynamic): Dynamic =>
                      " " +
                      input2 +
                      '="' +
                      String(input3)
                        .replace(/&/g, "&amp;")
                        .replace(/"/g, "&quot;")
                        .replace(/</g, "&lt;") +
                      '"',
                  )
                  .join("") +
                ">",
              options2,
            ];
          }
          let values: Dynamic = new Set(value.covered ?? []),
            value11: Dynamic = (0, runtime.moveCssImportsFirst)(
              (0, runtime.inlineStylesheetImports)(value5, options, values),
            );
          if (value7 === null)
            for (let value14 of values as Dynamic) value.inlined?.add(value14);
          let value12: Dynamic =
            value9 &&
            [...values].every(
              (input2?: Dynamic): Dynamic =>
                !(0, runtime.PreviewCssRewritingTest)(options[input2] ?? "") &&
                value.installedUrlFor?.(input2, options[input2] ?? "") !==
                  undefined,
            )
              ? value.installedUrlFor?.(value5, options[value5])
              : undefined;
          if (value12 !== undefined) {
            value.byAddress && (value.byAddress[value5] = value12);
            let { onerror: value14, ...value15 }: Dynamic = (0,
            runtime.parseHtmlAttributes)(
              items,
              ["href", "type", "integrity", "crossorigin"],
              true,
            );
            return [
              PreviewDependencyInjectionJoin("link", {
                ...value15,
                href: value12,
                onerror: PreviewDependencyInjectionTrim(value14),
              }),
              options2,
            ];
          }
          if (value.parts && value11.length >= value.parts.min && value9) {
            let value14: Dynamic = "sheet:" + value5;
            value.parts.out[value14] = value11;
            return [
              value8.slice(0, -1) +
                ' data-dc-part="' +
                value14
                  .replace(/&/g, "&amp;")
                  .replace(/"/g, "&quot;")
                  .replace(/</g, "&lt;") +
                '"></style>' +
                hydrateLinkedStylesheetScript(value14),
              options2,
            ];
          }
          let value13: Dynamic = (0, runtime.PreviewCssRewritingReplace)(
            value11.replace(/<\/style/gi, "<\\/style"),
          );
          return [value8 + value13 + "</style>", options2];
        },
      );
    value2 = callback(
      value2,
      "style",
      (
        input2?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
        value3?: Dynamic,
      ): Dynamic => {
        let value4: Dynamic = value3.indexOf("</style", options2),
          value5: Dynamic = value2.slice(
            options2,
            value4 < 0 ? undefined : value4,
          );
        if (!/@import/i.test(value5)) return;
        let values: Dynamic = new Set(value.covered ?? []),
          flag: Dynamic = false,
          value6: Dynamic = (0, runtime.stripStylesheetComments)(value5),
          value7: Dynamic = (0, runtime.leadingStylesheetAtRuleEnd)(value6),
          value8: Dynamic = value6.replace(
            runtime.PreviewHtmlScannerImportPattern,
            (input3?: Dynamic, ...options3: Dynamic[]): Dynamic => {
              if (options3[6] >= value7) {
                flag = true;
                return "";
              }
              if (options3[5]) return input3;
              let value9: Dynamic = (0, runtime.resolveProjectAssetPath)(
                context,
                String(
                  options3[0] ??
                    options3[1] ??
                    options3[2] ??
                    options3[3] ??
                    options3[4] ??
                    "",
                ),
              );
              return value9 === null ||
                !/\.css$/i.test(value9) ||
                options[value9] == null
                ? input3
                : ((flag = true),
                  (0, runtime.inlineStylesheetImports)(
                    value9,
                    options,
                    values,
                  ) +
                    `
`);
            },
          );
        if (flag) {
          for (let value9 of values as Dynamic) value.inlined?.add(value9);
          return [
            input2 +
              (0, runtime.PreviewCssRewritingReplace)(
                (0, runtime.moveCssImportsFirst)(value8).replace(
                  /<\/style/gi,
                  "<\\/style",
                ),
              ),
            value4 < 0 ? value2.length : value4,
          ];
        }
      },
    );
    value2 = callback(
      value2,
      "script",
      (
        items?: Dynamic,
        options2?: Dynamic,
        context2?: Dynamic,
        value3?: Dynamic,
      ): Dynamic => {
        let value4: Dynamic = value3.indexOf("<\/script", options2),
          value5: Dynamic = value4 < 0 ? -1 : context2.indexOf(">", value4),
          value6: Dynamic = (0, runtime.getHtmlAttribute)(items, "src");
        if (
          value5 < 0 ||
          value6 === null ||
          (0, runtime.getHtmlAttribute)(items, "nomodule") !== null
        )
          return;
        let value7: Dynamic = value5 + 1,
          value8: Dynamic = ((0, runtime.getHtmlAttribute)(items, "type") ?? "")
            .trim()
            .toLowerCase(),
          value9: Dynamic = (0, runtime.resolveProjectAssetPath)(
            context,
            value6,
          );
        if (
          value9 === null ||
          !/\.m?js$/i.test(value9) ||
          /(^|\/)support\.js$/.test(value9) ||
          options[value9] == null
        )
          return;
        if (value8 === "module")
          return [
            '<script type="module">import ' +
              JSON.stringify(
                "/appifact/" +
                  value9.split("/").map(encodeURIComponent).join("/"),
              ) +
              ";<\/script>",
            value7,
          ];
        if (
          value8 !== "" &&
          value8 !== "text/javascript" &&
          value8 !== "application/javascript"
        )
          return;
        let value10: Dynamic =
          options2 - items.length < findDocumentHeadInsertion(value3)
            ? value.installedUrlFor?.(value9, options[value9])
            : undefined;
        if (value10 !== undefined) {
          value.byAddress && (value.byAddress[value9] = value10);
          let {
            async: value12,
            onerror: value13,
            ...value14
          }: Dynamic = (0, runtime.parseHtmlAttributes)(
            items,
            ["src", "integrity", "crossorigin"],
            true,
          );
          return [
            PreviewDependencyInjectionJoin("script", {
              ...value14,
              ...(value12 !== undefined
                ? {
                    defer: "",
                  }
                : {}),
              src: value10,
              onerror: PreviewDependencyInjectionTrim(value13),
            }) + "<\/script>",
            value7,
          ];
        }
        let value11: Dynamic = (0, runtime.parseHtmlAttributes)(items, [
          "src",
          "type",
          "nomodule",
        ]);
        return [
          "<script>" +
            ("__dcRun(" +
              (
                JSON.stringify(value9) +
                (Object.keys(value11).length
                  ? ", " + JSON.stringify(value11)
                  : "")
              ).replace(/</g, "\\u003c") +
              ")") +
            "<\/script>",
          value7,
        ];
      },
    );
    return value2;
  }
  function rewritePreviewAssets(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = (0, runtime.PreviewAssetRewritingSlice)(context);
    return rewriteHtmlDependencies(
      (0, runtime.rewriteProjectAssets)(input, options, value2),
      options,
      value2,
      value,
    );
  }
  bindRuntimeValue(
    runtime,
    "linkedStylesheetHydrationScript",
    () => linkedStylesheetHydrationScript,
    (value) => {
      linkedStylesheetHydrationScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findDocumentHeadInsertion",
    () => findDocumentHeadInsertion,
  );
  bindRuntimeValue(
    runtime,
    "hydrateLinkedStylesheetScript",
    () => hydrateLinkedStylesheetScript,
  );
  bindRuntimeValue(
    runtime,
    "DcAddressRefusedValue",
    () => DcAddressRefusedValue,
    (value) => {
      DcAddressRefusedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyInjectionResolvedValue",
    () => PreviewDependencyInjectionResolvedValue,
    (value) => {
      PreviewDependencyInjectionResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyInjectionResolvedValue_2",
    () => PreviewDependencyInjectionResolvedValue_2,
    (value) => {
      PreviewDependencyInjectionResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyInjectionTrim",
    () => PreviewDependencyInjectionTrim,
    (value) => {
      PreviewDependencyInjectionTrim = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewDependencyInjectionJoin",
    () => PreviewDependencyInjectionJoin,
    (value) => {
      PreviewDependencyInjectionJoin = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rewriteHtmlDependencies",
    () => rewriteHtmlDependencies,
  );
  bindRuntimeValue(runtime, "rewritePreviewAssets", () => rewritePreviewAssets);
  return () => {
    linkedStylesheetHydrationScript =
      "(function(l){var k=l.getAttribute('data-dc-sheet'),f=window.__dcFiles||{};if(!Object.prototype.hasOwnProperty.call(f,k))return;var s=document.createElement('style');s.setAttribute('data-dc-sheet',k);s.textContent=String(f[k]);l.replaceWith(s);})(this)";
    DcAddressRefusedValue = "__dc_address_refused";
    PreviewDependencyInjectionResolvedValue =
      "try{parent.postMessage({" +
      DcAddressRefusedValue +
      ":1,u:this.href||this.src},'*')}catch(e){}";
    PreviewDependencyInjectionResolvedValue_2 =
      String.raw`
(function () {
  var P = window.parent, root = window.__dcProjectRoot;
  if (!P || P === window || typeof root !== 'string') return;
  /* window.origin, not location.origin: in a srcdoc frame location.origin is 'null', and window.origin is the page's */
  var under = window.origin + root;
  window.addEventListener('error', function (ev) {
    var t = ev.target;
    if (!t || t === window || typeof t.getAttribute !== 'function') return;
    var a = t.getAttribute('src');
    if (a === null) a = t.getAttribute('href');
    /* an empty address is read by a browser as the page's own */
    if (a !== null && (a === '' || a.charAt(0) === '#')) return;
    var u = t.currentSrc || t.src || t.href;
    if (typeof u !== 'string' || u.indexOf(under) !== 0) return;
    try { P.postMessage({ ` +
      DcAddressRefusedValue +
      String.raw`: 1, u: u }, '*'); } catch (e) {}
  }, true);
})();
`;
    PreviewDependencyInjectionTrim = (input?: Dynamic): Dynamic =>
      input === undefined || input.trim() === ""
        ? PreviewDependencyInjectionResolvedValue
        : PreviewDependencyInjectionResolvedValue + ";" + input;
    PreviewDependencyInjectionJoin = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      "<" +
      input +
      Object.entries(options)
        .map(
          ([input2, input3]: Dynamic): Dynamic =>
            " " +
            input2 +
            (input3 === ""
              ? ""
              : '="' +
                input3
                  .replace(/&/g, "&amp;")
                  .replace(/"/g, "&quot;")
                  .replace(/</g, "&lt;") +
                '"'),
        )
        .join("") +
      ">";
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewBuildDocument(
  runtime: RuntimeBindings,
): () => void {
  var PreviewBuildDocumentTest: Dynamic;
  var PreviewBuildDocumentResolvedValue: Dynamic;
  var framelessPreviewChromeHtml: Dynamic;
  var PreviewBuildDocumentStringify: Dynamic;
  var TheArtboardRuntimeDidNotLoadMessage: Dynamic;
  var PreviewBuildDocumentResolvedValue_2: Dynamic;
  var PreviewBuildDocumentStringify_2: Dynamic;
  var previewCaptureScript: Dynamic;
  var previewEvaluationScript: Dynamic;
  var PreviewBuildDocumentResolvedValue_3: Dynamic;
  function componentRuntimeDependencies(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    let value2: Dynamic = Object.keys(input).filter(
      (input2?: Dynamic): Dynamic =>
        !context.has(input2) &&
        !runtime.PreviewAssetRewritingWebpAvifPattern.test(input2),
    );
    if (
      value2.length === 0 ||
      (0, runtime.getProjectFileDependencies)(value.content, value2).length ===
        0
    )
      return {};
    let value3: Dynamic = (0, runtime.resolveComponentFile)(input, {
        ...value,
        kind: "html",
      }),
      value4: Dynamic =
        value3 != null
          ? {
              ...input,
              [value3]: value.content,
            }
          : input,
      state: Dynamic = {};
    for (let [value5, value6] of Object.entries(
      (0, runtime.collectProjectDependencyFiles)(value4, options),
    ) as Dynamic)
      context.has(value5) ||
        runtime.PreviewAssetRewritingWebpAvifPattern.test(value5) ||
        (state[value5] = value5.endsWith(".dc.html")
          ? (0, runtime.rewritePreviewAssets)(
              value6,
              input,
              value5,
              value5 === options
                ? {}
                : {
                    covered: extra,
                  },
            )
          : value6);
    return state;
  }
  function prepareExportDcDocument(input?: Dynamic): Dynamic {
    return replaceRuntimeScriptTags(
      input,
      `<script src="./vendor/react.js"><\/script>
<script src="./vendor/react-dom.js"><\/script>
<script src="./support.js"><\/script>`,
    );
  }
  function replaceRuntimeScriptTags(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.maskHtmlRawContent)(input),
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        for (let [value4, value5] of (0, runtime.findHtmlTags)(
          value,
          "script",
        ) as Dynamic) {
          let value6: Dynamic = /^\s*<\/script\s*>/i.exec(
            value.slice(value5, value5 + 64),
          );
          if (
            value6 !== null &&
            input2(
              (0, runtime.getHtmlAttribute)(input.slice(value4, value5), "src"),
              value4,
            )
          )
            return [value4, value5 + value6[0].length];
        }
      },
      value2: Dynamic =
        callback(PreviewBuildDocumentTest) ??
        (context
          ? callback(
              (input2?: Dynamic, options2?: Dynamic): Dynamic =>
                input2 !== null && context(input2, options2),
            )
          : undefined),
      value3: Dynamic = value2
        ? undefined
        : (0, runtime.findHtmlTags)(value, "head")[0];
    return value2
      ? input.slice(0, value2[0]) + options + input.slice(value2[1])
      : value3
        ? input.slice(0, value3[1]) +
          `
` +
          options +
          input.slice(value3[1])
        : "<!doctype html><html><head>" +
          options +
          "</head><body>" +
          input +
          "</body></html>";
  }
  function buildPreviewDocument(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra: Dynamic = {},
  ): Dynamic {
    let value2: Dynamic =
      extra.atAddress !== undefined
        ? 1 / 0
        : (extra.partMin ?? PreviewBuildDocumentResolvedValue);
    if (input[options] == null)
      throw new Error(`no such file in the document: ${options}`);
    let state: Dynamic = {},
      value3: Dynamic =
        extra.atAddress !== undefined
          ? {
              ...input,
            }
          : (0, runtime.collectProjectDependencyFiles)(input, options),
      value4: Dynamic = value ?? new Set();
    value4.clear();
    let state2: Dynamic = {},
      state3: Dynamic = {};
    value3[options] = (0, runtime.rewritePreviewAssets)(
      value3[options],
      value3,
      options,
      {
        inlined: value4,
        parts: {
          min: value2,
          out: state,
          urlFor: extra.sheetUrlFor,
          urls: state2,
        },
        ...(extra.installedUrlFor
          ? {
              installedUrlFor: extra.installedUrlFor,
              byAddress: state3,
            }
          : {}),
      },
    );
    for (let [value13, value14] of Object.entries(value3) as Dynamic)
      !value13.endsWith(".dc.html") ||
        value13 === options ||
        (value3[value13] = (0, runtime.rewritePreviewAssets)(
          value14,
          value3,
          value13,
          {
            covered: value4,
          },
        ));
    let value5: Dynamic = value3[options];
    if (
      !Object.entries(value3).some(
        ([input2, input3]: Dynamic): Dynamic =>
          runtime.PreviewAssetRewritingPattern.test(input2) ||
          (input2.endsWith(".dc.html") &&
            /\bfetch\s*\(|\bXMLHttpRequest\b/.test(input3)),
      )
    )
      for (let value13 of Object.keys(value3) as Dynamic)
        runtime.PreviewAssetRewritingWebpAvifPattern.test(value13) &&
          delete value3[value13];
    let state4: Dynamic = {},
      state5: Dynamic = {};
    for (let [value13, value14] of Object.entries(value3) as Dynamic) {
      let value15: Dynamic =
        value14.length >= value2 ||
        value13 === options ||
        value13 === "__proto__"
          ? undefined
          : extra.fileUrlFor?.(value13, value14);
      value14.length >= value2
        ? (state["file:" + value13] = value14)
        : value15 !== undefined
          ? (state5[value13] = value15)
          : (state4[value13] = value14);
    }
    // CucCut: the artboard runtime loads Babel from this URL instead of the CDN the CSP blocks (getBabelFileUrl).
    let babelFile: Dynamic = (0, runtime.getBabelFileUrl)(),
      babelResources: Dynamic = babelFile
        ? ` window.__resources = ${JSON.stringify({ [runtime.exportBabelStandaloneUrl]: babelFile }).replace(/</g, "\\u003c")};`
        : "";
    let value6: Dynamic = Object.keys(state).length > 0,
      value7: Dynamic = (0, runtime.selectRuntimeUrl)(context),
      atAddress: Dynamic = extra.atAddress,
      value8: Dynamic =
        atAddress === undefined
          ? ""
          : "<script>window.__dcProjectRoot = " +
            JSON.stringify(atAddress.projectRoot).replace(/</g, "\\u003c") +
            ";<\/script>" +
            (0, runtime.inlineScriptHtml)(
              runtime.PreviewDependencyInjectionResolvedValue_2,
            ),
      value9: Dynamic =
        (atAddress === undefined
          ? ""
          : '<base href="' +
            atAddress.base
              .replace(/&/g, "&amp;")
              .replace(/"/g, "&quot;")
              .replace(/</g, "&lt;") +
            '">') +
        (0, runtime.inlineScriptHtml)(runtime.previewGuardRuntimeScript) +
        (0, runtime.inlineScriptHtml)(runtime.previewResizeRuntimeScript) +
        (0, runtime.inlineScriptHtml)(runtime.previewEvaluationRuntimeScript) +
        value8,
      value10: Dynamic = [
        ...(atAddress === undefined
          ? [
              `<base href="/appifact/${options.split("/").map(encodeURIComponent).join("/")}">`,
            ]
          : []),
        `<script>window.__dcFiles = ${JSON.stringify(state4).replace(/</g, "\\u003c")}; window.__dcRootPath = ${JSON.stringify(options).replace(/</g, "\\u003c")};${babelResources}${value6 ? previewCaptureScript : ""}<\/script>`,
        ...Object.values(state5).map(
          (input2?: Dynamic): Dynamic => `<script src="${input2}"><\/script>`,
        ),
        ...(Object.keys(state5).length > 0
          ? [
              (0, runtime.inlineScriptHtml)(
                PreviewBuildDocumentStringify_2(Object.keys(state5)),
              ),
            ]
          : []),
        (0, runtime.inlineScriptHtml)(
          runtime.previewBlobBridgeRuntimeScript +
            runtime.previewAssetLoaderRuntimeScript +
            runtime.previewViewportRuntimeScript +
            runtime.previewDocumentRuntimeScript,
        ),
        (0, runtime.inlineScriptHtml)(
          runtime.PreviewRuntimeLoadingResolvedValue,
        ),
        ...(value7 !== undefined
          ? [
              `<script src="${value7}"><\/script>`,
              (0, runtime.inlineScriptHtml)(
                PreviewBuildDocumentResolvedValue_2,
              ),
            ]
          : ["reactUmd", "reactDomUmd", "supportJs"].map(
              (input2?: Dynamic): Dynamic =>
                (0, runtime.inlineScriptHtml)(context[input2]),
            )),
        ...(extra.frameless ? [framelessPreviewChromeHtml] : []),
      ].join(`
`),
      value11: Dynamic = replaceRuntimeScriptTags(value5, value10),
      value12: Dynamic = /^\s*<!doctype[^>]*>/i.exec(value11);
    return {
      doc: value12
        ? value11.slice(0, value12[0].length) +
          `
` +
          value9 +
          value11.slice(value12[0].length)
        : value9 +
          `
` +
          value11,
      parts: state,
      sheetUrls: state2,
      byAddress: state3,
    };
  }
  bindRuntimeValue(
    runtime,
    "componentRuntimeDependencies",
    () => componentRuntimeDependencies,
  );
  bindRuntimeValue(
    runtime,
    "prepareExportDcDocument",
    () => prepareExportDcDocument,
  );
  bindRuntimeValue(
    runtime,
    "PreviewBuildDocumentTest",
    () => PreviewBuildDocumentTest,
    (value) => {
      PreviewBuildDocumentTest = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replaceRuntimeScriptTags",
    () => replaceRuntimeScriptTags,
  );
  bindRuntimeValue(
    runtime,
    "PreviewBuildDocumentResolvedValue",
    () => PreviewBuildDocumentResolvedValue,
    (value) => {
      PreviewBuildDocumentResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "framelessPreviewChromeHtml",
    () => framelessPreviewChromeHtml,
    (value) => {
      framelessPreviewChromeHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewBuildDocumentStringify",
    () => PreviewBuildDocumentStringify,
    (value) => {
      PreviewBuildDocumentStringify = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TheArtboardRuntimeDidNotLoadMessage",
    () => TheArtboardRuntimeDidNotLoadMessage,
    (value) => {
      TheArtboardRuntimeDidNotLoadMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewBuildDocumentResolvedValue_2",
    () => PreviewBuildDocumentResolvedValue_2,
    (value) => {
      PreviewBuildDocumentResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewBuildDocumentStringify_2",
    () => PreviewBuildDocumentStringify_2,
    (value) => {
      PreviewBuildDocumentStringify_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewCaptureScript",
    () => previewCaptureScript,
    (value) => {
      previewCaptureScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewEvaluationScript",
    () => previewEvaluationScript,
    (value) => {
      previewEvaluationScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewBuildDocumentResolvedValue_3",
    () => PreviewBuildDocumentResolvedValue_3,
    (value) => {
      PreviewBuildDocumentResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(runtime, "buildPreviewDocument", () => buildPreviewDocument);
  return () => {
    PreviewBuildDocumentTest = (input?: Dynamic): Dynamic =>
      input !== null &&
      /^(?:\.\/|\/)?support\.js$/.test(
        input
          .replace(/[\t\n\r]/g, "")
          .replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, ""),
      );
    PreviewBuildDocumentResolvedValue = 64 * 1024;
    framelessPreviewChromeHtml =
      "<style>html,body{background:transparent!important}html[data-dc-frameless] .sc-logic-error{top:2px;left:auto;right:2px;width:10px;height:10px;max-width:none;padding:0;border-radius:5px;font-size:0;overflow:hidden}</style><script>document.documentElement.setAttribute('data-dc-frameless','')<\/script>";
    PreviewBuildDocumentStringify = (input?: Dynamic): Dynamic =>
      JSON.stringify([
        input.partMin,
        input.frameless,
        (0, runtime.supportsBlobScripts)(),
        (0, runtime.selectRuntimeUrl)(input.assets) ?? null,
        input.installed,
        input.address ?? "",
      ]);
    TheArtboardRuntimeDidNotLoadMessage = "the artboard runtime did not load";
    PreviewBuildDocumentResolvedValue_2 =
      "(function (s) { if (!window.React || !window.ReactDOM || typeof window.__dcUpdate !== 'function') { try { s = s && s.previousElementSibling; window.parent.postMessage({ __dc_boot_failed: 1, e: '" +
      TheArtboardRuntimeDidNotLoadMessage +
      "', u: s && s.getAttribute('src') }, '*'); } catch (e) {} } })(document.currentScript);";
    PreviewBuildDocumentStringify_2 = (input?: Dynamic): Dynamic =>
      "(function (k, f) { for (var i = 0; i < k.length; i += 1) { if (!Object.prototype.hasOwnProperty.call(f, k[i])) { try { window.parent.postMessage({ __dc_boot_failed: 1, e: " +
      JSON.stringify(TheArtboardRuntimeDidNotLoadMessage) +
      " }, '*'); } catch (e) {} return; } } })(" +
      JSON.stringify(input).replace(/</g, "\\u003c") +
      ", window.__dcFiles || {});";
    previewCaptureScript =
      " (function (p) { for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k) && k.indexOf('file:') === 0) window.__dcFiles[k.slice(5)] = p[k]; } document.addEventListener('DOMContentLoaded', function () { try { delete window.__dcParts; delete window.__dcPartBlobs; } catch (e) {} }); })(window.__dcParts || {});";
    previewEvaluationScript = runtime.injected_wZt;
    PreviewBuildDocumentResolvedValue_3 =
      '<!doctype html><meta charset="utf-8">' +
      (0, runtime.inlineScriptHtml)(previewEvaluationScript);
  };
}

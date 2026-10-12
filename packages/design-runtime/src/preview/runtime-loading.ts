/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewRuntimeLoading(
  runtime: RuntimeBindings,
): () => void {
  var escapeInlineScript: Dynamic;
  var inlineScriptHtml: Dynamic;
  var DcRuntimeFileKey: Dynamic;
  var PreviewRuntimeLoadingAlias: Dynamic;
  var runtimeFileUrlBlocked: Dynamic;
  var runtimeBlobUrlBlocked: Dynamic;
  var previewGuardRuntimeScript: Dynamic;
  var previewBlobBridgeRuntimeScript: Dynamic;
  var previewAssetLoaderRuntimeScript: Dynamic;
  var previewEvaluationRuntimeScript: Dynamic;
  var previewResizeRuntimeScript: Dynamic;
  var previewViewportRuntimeScript: Dynamic;
  var previewDocumentRuntimeScript: Dynamic;
  var PreviewRuntimeLoadingResolvedValue: Dynamic;
  function combinePreviewRuntime(input?: Dynamic): Dynamic {
    return [
      input.reactUmd,
      `
;
`,
      input.reactDomUmd,
      `
;
`,
      input.supportJs,
    ];
  }
  function supportsBlobScripts(): Dynamic {
    return (
      canCreateBlobUrls() &&
      PreviewRuntimeLoadingAlias === true &&
      !runtimeBlobUrlBlocked
    );
  }
  function canCreateBlobUrls(): Dynamic {
    return (
      typeof Blob !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL == "function" &&
      (globalThis as Dynamic).origin !== undefined &&
      (globalThis as Dynamic).origin !== "null"
    );
  }
  function probeBlobScriptSupport(input: Dynamic = 1500): Dynamic {
    return PreviewRuntimeLoadingAlias !== null
      ? Promise.resolve(PreviewRuntimeLoadingAlias)
      : !canCreateBlobUrls() || typeof document === "undefined"
        ? Promise.resolve((PreviewRuntimeLoadingAlias = false))
        : new Promise((input2?: Dynamic): Dynamic => {
            let value: Dynamic = URL.createObjectURL(
                new Blob(['parent.postMessage({ __dcBlobProbe: 1 }, "*")'], {
                  type: "text/javascript",
                }),
              ),
              value2: Dynamic = (document as Dynamic).createElement("iframe"),
              callback: Dynamic = (input3?: Dynamic): Dynamic => {
                PreviewRuntimeLoadingAlias === null &&
                  ((PreviewRuntimeLoadingAlias = input3),
                  (window as Dynamic).removeEventListener("message", callback2),
                  value2.remove(),
                  URL.revokeObjectURL(value),
                  input2(input3));
              },
              callback2: Dynamic = (dataset?: Dynamic): Dynamic => {
                !value2.contentWindow ||
                  dataset.source !== value2.contentWindow ||
                  typeof dataset.data != "object" ||
                  dataset.data === null ||
                  !("__dcBlobProbe" in dataset.data) ||
                  callback(dataset.data.__dcBlobProbe === 1);
              };
            (window as Dynamic).addEventListener("message", callback2);
            setTimeout((): Dynamic => callback(false), input);
            value2.setAttribute("sandbox", "allow-scripts allow-same-origin");
            value2.setAttribute("aria-hidden", "true");
            value2.style.cssText =
              "position:absolute;width:0;height:0;border:0;visibility:hidden";
            value2.srcdoc =
              '<!doctype html><script src="' +
              value +
              '"><\/script><script>parent.postMessage({ __dcBlobProbe: 0 }, "*")<\/script>';
            (document as Dynamic).body.appendChild(value2);
          });
  }
  function markRuntimeUrlBlocked(input?: Dynamic): Dynamic {
    typeof input == "string" && !input.startsWith("blob:")
      ? (runtimeFileUrlBlocked = true)
      : (runtimeBlobUrlBlocked = true);
  }
  function selectRuntimeUrl(input?: Dynamic): Dynamic {
    if (!runtimeBlobUrlBlocked)
      return (
        (runtimeFileUrlBlocked ? undefined : input.urls?.file) ??
        input.urls?.blob
      );
  }
  function getRuntimeFileUrl(): Dynamic {
    if (typeof document === "undefined") return;
    let value: Dynamic = (document as Dynamic)
      .querySelector('meta[name="' + DcRuntimeFileKey + '"]')
      ?.getAttribute("content");
    if (value)
      try {
        return new URL(value, (document as Dynamic).baseURI).pathname;
      } catch {
        return;
      }
  }
  /**
   * CucCut: where the editor serves Babel standalone (`dc-babel-file`, beside dc-runtime.js). The artboard runtime loads it
   * only for a JSX x-import, from the CDN URL unless `window.__resources` maps it; the CSP blocks the CDN, so the preview
   * maps it here and the HTML export embeds this file (docs/design/canvas §3).
   */
  function getBabelFileUrl(): Dynamic {
    if (typeof document === "undefined") return;
    let value: Dynamic = (document as Dynamic)
      .querySelector('meta[name="dc-babel-file"]')
      ?.getAttribute("content");
    if (value)
      try {
        return new URL(value, (document as Dynamic).baseURI).pathname;
      } catch {
        return;
      }
  }
  function preparePreviewRuntime(
    input?: Dynamic,
    options: Dynamic = supportsBlobScripts(),
    context: Dynamic = getRuntimeFileUrl(),
  ): Dynamic {
    if (input.urls || (context === undefined && !options)) return input;
    let value: Dynamic = options
      ? URL.createObjectURL(
          new Blob(combinePreviewRuntime(input), {
            type: "text/javascript",
          }),
        )
      : undefined;
    return {
      ...input,
      urls: {
        file: context,
        blob: value,
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "escapeInlineScript",
    () => escapeInlineScript,
    (value) => {
      escapeInlineScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inlineScriptHtml",
    () => inlineScriptHtml,
    (value) => {
      inlineScriptHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcRuntimeFileKey",
    () => DcRuntimeFileKey,
    (value) => {
      DcRuntimeFileKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "combinePreviewRuntime",
    () => combinePreviewRuntime,
  );
  bindRuntimeValue(
    runtime,
    "PreviewRuntimeLoadingAlias",
    () => PreviewRuntimeLoadingAlias,
    (value) => {
      PreviewRuntimeLoadingAlias = value;
    },
  );
  bindRuntimeValue(runtime, "supportsBlobScripts", () => supportsBlobScripts);
  bindRuntimeValue(runtime, "canCreateBlobUrls", () => canCreateBlobUrls);
  bindRuntimeValue(
    runtime,
    "probeBlobScriptSupport",
    () => probeBlobScriptSupport,
  );
  bindRuntimeValue(
    runtime,
    "runtimeFileUrlBlocked",
    () => runtimeFileUrlBlocked,
    (value) => {
      runtimeFileUrlBlocked = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runtimeBlobUrlBlocked",
    () => runtimeBlobUrlBlocked,
    (value) => {
      runtimeBlobUrlBlocked = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markRuntimeUrlBlocked",
    () => markRuntimeUrlBlocked,
  );
  bindRuntimeValue(runtime, "selectRuntimeUrl", () => selectRuntimeUrl);
  bindRuntimeValue(runtime, "getRuntimeFileUrl", () => getRuntimeFileUrl);
  bindRuntimeValue(runtime, "getBabelFileUrl", () => getBabelFileUrl);
  bindRuntimeValue(
    runtime,
    "preparePreviewRuntime",
    () => preparePreviewRuntime,
  );
  bindRuntimeValue(
    runtime,
    "previewGuardRuntimeScript",
    () => previewGuardRuntimeScript,
    (value) => {
      previewGuardRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewBlobBridgeRuntimeScript",
    () => previewBlobBridgeRuntimeScript,
    (value) => {
      previewBlobBridgeRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewAssetLoaderRuntimeScript",
    () => previewAssetLoaderRuntimeScript,
    (value) => {
      previewAssetLoaderRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewEvaluationRuntimeScript",
    () => previewEvaluationRuntimeScript,
    (value) => {
      previewEvaluationRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewResizeRuntimeScript",
    () => previewResizeRuntimeScript,
    (value) => {
      previewResizeRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewViewportRuntimeScript",
    () => previewViewportRuntimeScript,
    (value) => {
      previewViewportRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewDocumentRuntimeScript",
    () => previewDocumentRuntimeScript,
    (value) => {
      previewDocumentRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewRuntimeLoadingResolvedValue",
    () => PreviewRuntimeLoadingResolvedValue,
    (value) => {
      PreviewRuntimeLoadingResolvedValue = value;
    },
  );
  return () => {
    escapeInlineScript = (input?: Dynamic): Dynamic =>
      input.replace(/<\/(script)/gi, "<\\/$1").replace(/<\!--/g, "<!-\\x2D");
    inlineScriptHtml = (input?: Dynamic): Dynamic =>
      `<script>${escapeInlineScript(input)}<\/script>`;
    DcRuntimeFileKey = "dc-runtime-file";
    PreviewRuntimeLoadingAlias = null;
    runtimeFileUrlBlocked = false;
    runtimeBlobUrlBlocked = false;
    previewGuardRuntimeScript = runtime.injected_K7t.replace(
      '"__ARROW_OWNER__"',
      JSON.stringify(runtime.interactivePreviewSelector),
    );
    previewBlobBridgeRuntimeScript = runtime.injected_$7t;
    previewAssetLoaderRuntimeScript = runtime.injected_q7t;
    previewEvaluationRuntimeScript = runtime.injected_X7t;
    previewResizeRuntimeScript = runtime.injected_Y7t;
    previewViewportRuntimeScript = runtime.injected_Z7t;
    previewDocumentRuntimeScript = String.raw`
(function () {
  var files = window.__dcFiles || {};
  var blobs = window.__dcPartBlobs || {}, urls = window.__dcPartUrls || {}; /* two-phase boot: a part keeps the page's URL (shared), else its Blob */
  var imports = {}, has = Object.prototype.hasOwnProperty;
  var n = 0;
  for (var k in files) {
    if (!has.call(files, k) || !/\.m?js$/i.test(k) || /(^|\/)support\.js$/.test(k)) continue;
    var url;
    if (has.call(urls, k)) url = urls[k];
    else { try { url = URL.createObjectURL(blobs[k] instanceof Blob ? blobs[k] : new Blob([String(files[k])], { type: 'text/javascript' })); } catch (e) { continue; } }
    imports['/appifact/' + k.split('/').map(encodeURIComponent).join('/')] = url;
    imports[k] = url;
    n += 1;
  }
  if (n === 0) return;
  var s = document.createElement('script');
  s.type = 'importmap';
  s.textContent = JSON.stringify({ imports: imports });
  (document.head || document.documentElement).appendChild(s);
})();
`;
    PreviewRuntimeLoadingResolvedValue =
      String.raw`
(function (variants) {
  var seen = Object.create(null);
  var add = function (href) {
    variants(href).forEach(function (v) {
      if (seen[v]) return;
      seen[v] = 1;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = v;
      l.setAttribute('data-font-variant', '');
      l.onerror = function () { l.remove(); };
      document.head.appendChild(l);
    });
  };
  /* a complete statement only: url(...) closed, or a whole quoted string - a helmet <style> streams in mid-URL */
  var IMPORT = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^"')\s]+))\s*\)|"([^"]*)"|'([^']*)')/g;
  var scan = function (n) {
    if (n.tagName === 'LINK' && !n.hasAttribute('data-font-variant') && /\bstylesheet\b/i.test(n.rel)) { seen[n.href] = 1; add(n.href); }
    else if (n.tagName === 'STYLE') { var css = (n.textContent || '').replace(/\/\*[\s\S]*?\*\//g, ''), m; while ((m = IMPORT.exec(css))) add((m[1] || m[2] || m[3] || m[4] || m[5] || '').trim()); }
  };
  var rescan = function () { Array.prototype.forEach.call(document.head.children, scan); };
  /* head children as they arrive, and a mounted <style> whose text is replaced in place (the helmet runtime streams it) */
  new MutationObserver(function (rs) { rs.forEach(function (r) { var t = r.target.nodeType === 3 ? r.target.parentNode : r.target; if (t && t.tagName === 'STYLE') scan(t); else if (t === document.head) r.addedNodes.forEach(scan); }); }).observe(document.head, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', rescan);
  rescan();
})` +
      "(function (h) { return (" +
      runtime.parseGoogleFontsRequest.toString() +
      ")(h, " +
      JSON.stringify(runtime.TypographyFontCatalogFromEntriesValue) +
      "); });";
  };
}

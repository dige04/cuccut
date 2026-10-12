/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportHtmlProducer(
  runtime: RuntimeBindings,
): () => void {
  var designExportRuntimeSource: Dynamic;
  var exportImageFilenamePattern: Dynamic;
  var exportBlobPathPattern: Dynamic;
  var ExportHtmlError: Dynamic;
  var exportedCanvasOverviewFilename: Dynamic;
  function selectHtmlExportArtboards(
    manifest?: Dynamic,
    pageId?: Dynamic,
    focusedFile?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
      focusedFile === null
        ? undefined
        : manifest.artboards.find(
            (input?: Dynamic): Dynamic => input.file === focusedFile,
          );
    return value !== undefined
      ? {
          artboards: [value],
          open: value.file,
        }
      : {
          artboards: manifest.artboards.filter(
            (input?: Dynamic): Dynamic =>
              (0, runtime.designPageId)(input, manifest.pages) === pageId &&
              !input.frameless,
          ),
        };
  }
  function exportedCanvasOverviewHtml(
    title?: Dynamic,
    manifest?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.artboardsInReadingOrder)(manifest).map(
      (input?: Dynamic): Dynamic => {
        let value2: Dynamic =
            input.title ?? (0, runtime.exportBaseFileName)(input.file),
          value3: Dynamic = Math.max(1, Math.round(input.w)),
          value4: Dynamic = Math.max(1, Math.round(input.h)),
          value5: Dynamic = (0, runtime.artboardRadiusCss)(input.radius);
        return (
          '<section class="board"><h2>' +
          (0, runtime.escapeHtml)(value2) +
          '</h2><iframe src="' +
          (0, runtime.escapeHtmlAttributeValue)(encodeURI(input.file)) +
          '" title="' +
          (0, runtime.escapeHtmlAttributeValue)(value2) +
          '" width="' +
          String(value3) +
          '" height="' +
          String(value4) +
          '" loading="eager" style="width:' +
          String(value3) +
          "px;height:" +
          String(value4) +
          "px" +
          (value5 === undefined ? "" : ";border-radius:" + value5) +
          '"></iframe></section>'
        );
      },
    ).join(`
`);
    return [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>" + (0, runtime.escapeHtml)(title) + "</title>",
      "<style>",
      'html{background:#f5f4ef;color:#1f1e1d;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}',
      "body{margin:0;padding:48px;display:flex;flex-direction:column;align-items:flex-start;gap:48px}",
      ".board h2{margin:0 0 12px;font-size:13px;font-weight:500;color:#6b6a68}",
      ".board iframe{display:block;border:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}",
      "</style>",
      "</head>",
      "<body>",
      value,
      "</body>",
      "</html>",
      "",
    ].join(`
`);
  }
  function standaloneExportFilename(
    title?: Dynamic,
    file?: Dynamic,
    artboardTitle?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
        (0, runtime.sanitizeExportFileName)(title) ||
        (0, runtime.exportBaseFileName)(file),
      value2: Dynamic =
        artboardTitle === undefined
          ? ""
          : (0, runtime.sanitizeExportFileName)(artboardTitle);
    return (
      [...(value2 === "" ? value : value + " \u2013 " + value2)]
        .slice(0, 120)
        .join("")
        .trimEnd()
        .replace(/ –$/, "") + ".html"
    );
  }
  function findUnremovedServeTokenWarning(warnings?: Dynamic): Dynamic {
    return warnings.find(
      (input?: Dynamic): Dynamic =>
        input.startsWith("serve token not removed:"),
    );
  }
  async function fetchExportProjectBlob(
    fetchBlob?: Dynamic,
    path?: Dynamic,
  ): Promise<Dynamic> {
    if (!fetchBlob) return null;
    try {
      let value: Dynamic = await fetchBlob(path);
      if (!value.ok) return null;
      let value2: Dynamic =
        value.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ||
        "application/octet-stream";
      return {
        data: new Uint8Array(await value.arrayBuffer()),
        mime: value2,
      };
    } catch {
      return null;
    }
  }
  function createDesignDocumentAssetReader(document2?: Dynamic): Dynamic {
    let values: Dynamic = new Set(document2.paths),
      value: Dynamic = new TextEncoder();
    return async (input?: Dynamic): Promise<Dynamic> => {
      let value2: Dynamic = exportBlobPathPattern.exec(input)?.[1];
      if (value2 !== undefined)
        return fetchExportProjectBlob(document2.fetchBlob, value2);
      if (!values.has(input)) return null;
      let value3: Dynamic = await document2.read(input);
      if (value3 === undefined) return null;
      let value4: Dynamic = (0, runtime.exportMimeForPath)(input);
      if (exportImageFilenamePattern.test(input))
        try {
          return {
            data: (0, runtime.decodeBinaryBase64)(
              value3.replace(/^data:[^,]*,/, ""),
            ),
            mime: value4,
          };
        } catch {
          return null;
        }
      return {
        data: value.encode(
          value4 === "text/html"
            ? (0, runtime.normalizeDcScriptType)(value3)
            : value3,
        ),
        mime: value4,
      };
    };
  }
  function explainSkippedGoogleFontAssets(
    warnings?: Dynamic,
    skippedFonts?: Dynamic,
  ): Dynamic {
    if (skippedFonts.length === 0) return warnings;
    let value: Dynamic = skippedFonts.map(
        (input?: Dynamic): Dynamic =>
          "asset not found: " +
          (0, runtime.redactProjectServeAccessToken)(input),
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        value.some(
          (input2?: Dynamic): Dynamic =>
            input === input2 ||
            input.startsWith(input2 + ' \u2014 inside embedded page "'),
        ),
      length: Dynamic = skippedFonts.length,
      value2: Dynamic =
        length === 1
          ? "1 Google Fonts file the artboards never loaded was left as a link on purpose, not inlined"
          : String(length) +
            " Google Fonts files the artboards never loaded were left as links on purpose, not inlined";
    return [
      ...warnings.filter((input?: Dynamic): Dynamic => !callback(input)),
      value2 +
        "; a browser opening the export online still fetches " +
        (length === 1 ? "it" : "them"),
    ];
  }
  async function produceStandaloneHtmlExport(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic,
      value2: Dynamic,
      value3: Dynamic,
      value4: Dynamic,
      value5: Dynamic;
    if (input.kind === "project")
      throw new ExportHtmlError("empty", "this page has no artboard to send");
    {
      if (input.artboards.length === 0)
        throw new ExportHtmlError("empty", "this page has no artboard to send");
      value4 = createDesignDocumentAssetReader(input);
      let value13: Dynamic =
        input.open === undefined
          ? undefined
          : input.artboards.find(
              (input2?: Dynamic): Dynamic => input2.file === input.open,
            );
      if (input.open !== undefined && value13 === undefined)
        throw new ExportHtmlError(
          "empty",
          input.open + " is not on this canvas",
        );
      if (value13 !== undefined || input.artboards.length === 1) {
        let value14: Dynamic = value13 ?? input.artboards[0],
          value15: Dynamic = await input.read(value14.file);
        if (value15 === undefined)
          throw new ExportHtmlError(
            "empty",
            value14.file + " could not be read",
          );
        value = (0, runtime.normalizeDcScriptType)(value15);
        value2 = value14.file;
        value13 !== undefined &&
          (value3 =
            value13.title ?? (0, runtime.exportBaseFileName)(value13.file));
        input.importerReady === true &&
          (value5 = {
            w: value14.w,
            h: value14.h,
            label:
              value14.title?.trim() ||
              (0, runtime.exportBaseFileName)(value14.file),
          });
      } else {
        for (let value14 of input.artboards as Dynamic)
          if ((await input.read(value14.file)) === undefined)
            throw new ExportHtmlError(
              "empty",
              value14.file + " could not be read",
            );
        value = exportedCanvasOverviewHtml(input.title, input.artboards);
        value2 = exportedCanvasOverviewFilename;
      }
    }
    let assets: Dynamic = input.assets,
      value6: Dynamic = (0, runtime.createExportAssetResolver)(
        value4,
        assets,
        options,
      ),
      value7: Dynamic =
        input.kind === "canvas" &&
        input.fontLoads !== undefined &&
        input.fontLoads.length > 0
          ? (0, runtime.createFontAwareExportResolver)(value6, input.fontLoads)
          : undefined,
      { html: value8, warnings: value9 }: Dynamic = await (0,
      runtime.bundleStandaloneDesignHtml)(
        value,
        value2,
        value7?.resolve ?? value6,
        {},
        value5 === undefined
          ? {}
          : {
              finalizeTemplate: (
                input2?: Dynamic,
                options2?: Dynamic,
              ): Dynamic =>
                (0, runtime.prepareStaticArtboardExport)(
                  input2,
                  value5,
                  options2,
                ),
            },
      ),
      value10: Dynamic = explainSkippedGoogleFontAssets(
        value9,
        value7?.leftOut() ?? [],
      );
    if (options.signal?.aborted)
      throw new ExportHtmlError("timeout", "preparing the file took too long");
    let value11: Dynamic = findUnremovedServeTokenWarning(value10);
    if (value11 !== undefined)
      throw (
        console.warn("[design/export] " + value11),
        new ExportHtmlError(
          "blocked",
          // CucCut: user-facing copy calls the agent "the agent", not Claude.
          "the design contains what looks like a live access link, which cannot be sent",
        )
      );
    let value12: Dynamic = new Blob([value8], {
      type: "text/html",
    });
    if (value12.size > designExportRuntimeSource)
      throw new ExportHtmlError(
        "too_large",
        "the single-file export is " +
          (value12.size / 1048576).toFixed(1) +
          // CucCut: the limit is no longer 16 MiB (export/downloads.tsx).
          " MiB; the most that can be sent is " +
          (designExportRuntimeSource >> 20) +
          " MiB",
      );
    return {
      filename: standaloneExportFilename(input.title, value2, value3),
      blob: value12,
      bytes: value12.size,
      warnings: value10,
    };
  }
  bindRuntimeValue(
    runtime,
    "designExportRuntimeSource",
    () => designExportRuntimeSource,
    (value) => {
      designExportRuntimeSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportImageFilenamePattern",
    () => exportImageFilenamePattern,
    (value) => {
      exportImageFilenamePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportBlobPathPattern",
    () => exportBlobPathPattern,
    (value) => {
      exportBlobPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportHtmlError",
    () => ExportHtmlError,
    (value) => {
      ExportHtmlError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectHtmlExportArtboards",
    () => selectHtmlExportArtboards,
  );
  bindRuntimeValue(
    runtime,
    "exportedCanvasOverviewFilename",
    () => exportedCanvasOverviewFilename,
    (value) => {
      exportedCanvasOverviewFilename = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportedCanvasOverviewHtml",
    () => exportedCanvasOverviewHtml,
  );
  bindRuntimeValue(
    runtime,
    "standaloneExportFilename",
    () => standaloneExportFilename,
  );
  bindRuntimeValue(
    runtime,
    "findUnremovedServeTokenWarning",
    () => findUnremovedServeTokenWarning,
  );
  bindRuntimeValue(
    runtime,
    "fetchExportProjectBlob",
    () => fetchExportProjectBlob,
  );
  bindRuntimeValue(
    runtime,
    "createDesignDocumentAssetReader",
    () => createDesignDocumentAssetReader,
  );
  bindRuntimeValue(
    runtime,
    "explainSkippedGoogleFontAssets",
    () => explainSkippedGoogleFontAssets,
  );
  bindRuntimeValue(
    runtime,
    "produceStandaloneHtmlExport",
    () => produceStandaloneHtmlExport,
  );
  return () => {
    designExportRuntimeSource = runtime.ExportDownloadsResolvedValue;
    exportImageFilenamePattern = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
    exportBlobPathPattern = /(?:^|\/)(_blob\/[0-9a-f]{32})$/;
    ExportHtmlError = class extends Error {
      declare name: Dynamic;
      constructor(input: Dynamic, options: Dynamic) {
        super(options);
        this.code = input;
        this.name = "ExportHtmlError";
      }
      code: Dynamic;
    };
    exportedCanvasOverviewFilename = "__design-canvas__.html";
  };
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDocumentCompilation(
  runtime: RuntimeBindings,
): () => void {
  var documentDataElementId: Dynamic;
  var documentAppElementId: Dynamic;
  var documentStyleElementId: Dynamic;
  var documentModeElementId: Dynamic;
  var emulatorShimMetaName: Dynamic;
  var capabilityMetaName: Dynamic;
  var defaultCapabilitiesJson: Dynamic;
  var maxCompiledDocumentBytes: Dynamic;
  var deferThumbnailAttribute: Dynamic;
  var DbValue: Dynamic;
  function emulatorBuildMetaName(): Dynamic {
    return ["appifact", "emulator", "build"].join("-");
  }
  function escapeHtmlAttribute(input?: Dynamic): Dynamic {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  }
  function escapeHtmlComment(input?: Dynamic): Dynamic {
    return input
      .replaceAll("-->", "--\u200B>")
      .replaceAll("--!>", "--\u200B!>");
  }
  function safeInlineJson(input?: Dynamic): Dynamic {
    return JSON.stringify(input).replaceAll("<", "\\u003c");
  }
  function buildDocumentHtmlAttributes(input?: Dynamic): Dynamic {
    return (
      'lang="en" ' +
      runtime.cdsRootAttributes +
      (hasDatabaseCapability(input) ? " " + deferThumbnailAttribute : "")
    );
  }
  function compileArtifactDocument(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return [
      "<!doctype html>",
      "<html " +
        buildDocumentHtmlAttributes(
          input.capabilities ?? defaultCapabilitiesJson,
        ) +
        ">",
      "<head>",
      '<meta charset="utf-8">',
      "<title>" + escapeHtmlAttribute(input.title) + "</title>",
      "<\!-- README",
      escapeHtmlComment(input.readme),
      "-->",
      '<meta name="README" content="' +
        escapeHtmlAttribute(input.readmeMeta) +
        '">',
      '<meta name="' +
        capabilityMetaName +
        '" content="' +
        escapeHtmlAttribute(input.capabilities ?? defaultCapabilitiesJson) +
        '">',
      ...(input.emulator
        ? [
            '<meta name="' +
              emulatorBuildMetaName() +
              '" content="unshippable">',
          ]
        : []),
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<script id="' +
        documentModeElementId +
        '">' +
        (0, runtime.buildColorModeScript)(input.colorMode) +
        "<\/script>",
      ...(input.emulator && input.emulatorShim !== undefined
        ? [
            '<script id="' + emulatorShimMetaName + '">',
            input.emulatorShim,
            "<\/script>",
          ]
        : []),
      '<style id="' + documentStyleElementId + '">',
      input.css,
      "</style>",
      "</head>",
      "<body>",
      '<div id="root"></div>',
      ...(options !== undefined
        ? [
            '<script type="application/json" id="' +
              documentDataElementId +
              '">',
            options,
            "<\/script>",
          ]
        : []),
      '<script id="' + documentAppElementId + '">',
      input.js,
      "<\/script>",
      "</body>",
      "</html>",
      "",
    ].join(`
`);
  }
  function readEmbeddedDocument(input?: Dynamic): Dynamic {
    let value: Dynamic = input.getElementById(documentDataElementId);
    if (value)
      try {
        return JSON.parse(value.textContent ?? "");
      } catch {
        return;
      }
  }
  function readCompiledPageParts(element?: Dynamic): Dynamic {
    let value: Dynamic = element.getElementById(documentAppElementId),
      value2: Dynamic = element.getElementById(documentStyleElementId);
    if (!value || !value2)
      throw new Error(
        "page anatomy missing (#" +
          documentAppElementId +
          " / #" +
          documentStyleElementId +
          ") \u2014 this page was not assembled by the appifact compile step, so it cannot safely re-render itself.",
      );
    let text: Dynamic = "";
    for (let value9 of Array.from(element.head.childNodes) as Dynamic)
      if (value9.nodeType === 8) {
        let data: Dynamic = value9.data;
        if (
          data.startsWith(` README
`) &&
          data.endsWith(`
`)
        ) {
          text = data.slice(8, -1);
          break;
        }
      }
    let value3: Dynamic =
        element.querySelector('meta[name="README"]')?.getAttribute("content") ??
        "",
      value4: Dynamic =
        element.querySelector(
          'meta[name="' + emulatorBuildMetaName() + '"]',
        ) !== null,
      value5: Dynamic = element.getElementById(emulatorShimMetaName),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value9: Dynamic = input ?? "";
        return value9.startsWith(`
`) &&
          value9.endsWith(`
`)
          ? value9.slice(1, -1)
          : value9;
      },
      value6: Dynamic =
        element
          .querySelector('meta[name="' + capabilityMetaName + '"]')
          ?.getAttribute("content") ?? defaultCapabilitiesJson,
      value7: Dynamic =
        element.getElementById(documentModeElementId)?.textContent ?? "",
      value8: Dynamic = ["light", "dark"].find(
        (input?: Dynamic): Dynamic =>
          value7 === (0, runtime.buildColorModeScript)(input),
      );
    return {
      title: element.querySelector("title")?.textContent ?? "",
      capabilities: value6,
      readme: text,
      readmeMeta: value3,
      css: callback(value2.textContent),
      js: callback(value.textContent),
      emulator: value4,
      emulatorShim: value4 && value5 ? callback(value5.textContent) : undefined,
      ...(value8 !== undefined
        ? {
            colorMode: value8,
          }
        : {}),
    };
  }
  function detectDocumentStorageMode(element?: Dynamic): Dynamic {
    let value: Dynamic =
      element
        .querySelector('meta[name="' + capabilityMetaName + '"]')
        ?.getAttribute("content") ?? "";
    return hasDatabaseCapability(value)
      ? "db"
      : element.getElementById(documentDataElementId) !== null
        ? "page"
        : "files";
  }
  function hasDatabaseCapability(input?: Dynamic): Dynamic {
    try {
      let value: Dynamic = JSON.parse(input);
      return (
        typeof value == "object" &&
        value !== null &&
        Object.hasOwn(value, DbValue)
      );
    } catch {
      return false;
    }
  }
  bindRuntimeValue(
    runtime,
    "documentDataElementId",
    () => documentDataElementId,
    (value) => {
      documentDataElementId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentAppElementId",
    () => documentAppElementId,
    (value) => {
      documentAppElementId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentStyleElementId",
    () => documentStyleElementId,
    (value) => {
      documentStyleElementId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "documentModeElementId",
    () => documentModeElementId,
    (value) => {
      documentModeElementId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emulatorShimMetaName",
    () => emulatorShimMetaName,
    (value) => {
      emulatorShimMetaName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "capabilityMetaName",
    () => capabilityMetaName,
    (value) => {
      capabilityMetaName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultCapabilitiesJson",
    () => defaultCapabilitiesJson,
    (value) => {
      defaultCapabilitiesJson = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCompiledDocumentBytes",
    () => maxCompiledDocumentBytes,
    (value) => {
      maxCompiledDocumentBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emulatorBuildMetaName",
    () => emulatorBuildMetaName,
  );
  bindRuntimeValue(runtime, "escapeHtmlAttribute", () => escapeHtmlAttribute);
  bindRuntimeValue(runtime, "escapeHtmlComment", () => escapeHtmlComment);
  bindRuntimeValue(runtime, "safeInlineJson", () => safeInlineJson);
  bindRuntimeValue(
    runtime,
    "deferThumbnailAttribute",
    () => deferThumbnailAttribute,
    (value) => {
      deferThumbnailAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buildDocumentHtmlAttributes",
    () => buildDocumentHtmlAttributes,
  );
  bindRuntimeValue(
    runtime,
    "compileArtifactDocument",
    () => compileArtifactDocument,
  );
  bindRuntimeValue(runtime, "readEmbeddedDocument", () => readEmbeddedDocument);
  bindRuntimeValue(
    runtime,
    "readCompiledPageParts",
    () => readCompiledPageParts,
  );
  bindRuntimeValue(
    runtime,
    "DbValue",
    () => DbValue,
    (value) => {
      DbValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "detectDocumentStorageMode",
    () => detectDocumentStorageMode,
  );
  bindRuntimeValue(
    runtime,
    "hasDatabaseCapability",
    () => hasDatabaseCapability,
  );
  return () => {
    documentDataElementId = "appifact-doc";
    documentAppElementId = "appifact-app";
    documentStyleElementId = "appifact-style";
    documentModeElementId = "appifact-mode";
    emulatorShimMetaName = ["appifact", "emulator", "shim"].join("-");
    capabilityMetaName = "appifact-capabilities";
    defaultCapabilitiesJson = '{"self":{}}';
    maxCompiledDocumentBytes = 16 * 1024 * 1024;
    deferThumbnailAttribute = "data-thumb-defer";
    DbValue = "db";
  };
}

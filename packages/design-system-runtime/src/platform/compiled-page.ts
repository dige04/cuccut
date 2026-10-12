import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installPlatformCompiledPage(
  runtime: RuntimeBindings,
): () => void {
  var compiledPageDocumentId: string;
  var compiledPageAppId: string;
  var compiledPageStyleId: string;
  var compiledPageModeId: string;
  var emulatorShimId: string;
  var compiledPageCapabilitiesMetaName: string;
  var defaultCompiledPageCapabilities: string;
  var compiledPageMaxBytes: number;
  var thumbnailDeferAttribute: string;
  var databaseCapabilityKey: string;
  function emulatorBuildMetaName(): string {
    return ["appifact", "emulator", "build"].join("-");
  }
  function escapePageHtmlAttribute(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  }
  function escapeHtmlComment(text: string): string {
    return text.replaceAll("-->", "--​>").replaceAll("--!>", "--​!>");
  }
  function stringifyInlineJson(value: unknown): string {
    return JSON.stringify(value).replaceAll("<", "\\u003c");
  }
  function compiledPageHtmlAttributes(capabilities: string): string {
    return (
      'lang="en" ' +
      runtime.rootHtmlAttributes +
      (capabilitiesUseDatabase(capabilities)
        ? " " + thumbnailDeferAttribute
        : "")
    );
  }
  function assembleCompiledPage(
    page: Host.CompiledPage,
    appScript?: string,
  ): string {
    return [
      "<!doctype html>",
      "<html " +
        compiledPageHtmlAttributes(
          page.capabilities ?? defaultCompiledPageCapabilities,
        ) +
        ">",
      "<head>",
      '<meta charset="utf-8">',
      "<title>" + escapePageHtmlAttribute(page.title) + "</title>",
      "<\!-- README",
      escapeHtmlComment(page.readme),
      "-->",
      '<meta name="README" content="' +
        escapePageHtmlAttribute(page.readmeMeta) +
        '">',
      '<meta name="' +
        compiledPageCapabilitiesMetaName +
        '" content="' +
        escapePageHtmlAttribute(
          page.capabilities ?? defaultCompiledPageCapabilities,
        ) +
        '">',
      ...(page.emulator
        ? [
            '<meta name="' +
              emulatorBuildMetaName() +
              '" content="unshippable">',
          ]
        : []),
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<script id="' +
        compiledPageModeId +
        '">' +
        (0, runtime.colorModeBootstrapScript)(page.colorMode) +
        "<\/script>",
      ...(page.emulator && page.emulatorShim !== undefined
        ? [
            '<script id="' + emulatorShimId + '">',
            page.emulatorShim,
            "<\/script>",
          ]
        : []),
      '<style id="' + compiledPageStyleId + '">',
      page.css,
      "</style>",
      "</head>",
      "<body>",
      '<div id="root"></div>',
      ...(appScript !== undefined
        ? [
            '<script type="application/json" id="' +
              compiledPageDocumentId +
              '">',
            appScript,
            "<\/script>",
          ]
        : []),
      '<script id="' + compiledPageAppId + '">',
      page.js,
      "<\/script>",
      "</body>",
      "</html>",
      "",
    ].join(`
`);
  }
  function readCompiledPageDocument(document2: Document): unknown {
    let value = document2.getElementById(compiledPageDocumentId);
    if (!value) {
      return;
    }
    try {
      return JSON.parse(value.textContent ?? "");
    } catch {
      return;
    }
  }
  function readCompiledPageAnatomy(document2: Document): Host.CompiledPage {
    let value = document2.getElementById(compiledPageAppId),
      value2 = document2.getElementById(compiledPageStyleId);
    if (!value || !value2) {
      throw Error(
        "page anatomy missing (#" +
          compiledPageAppId +
          " / #" +
          compiledPageStyleId +
          ") — this page was not assembled by the appifact compile step, " +
          "so it cannot safely re-render itself.",
      );
    }
    let text = "";
    for (let value9 of Array.from(document2.head.childNodes)) {
      if (value9.nodeType === 8) {
        let data = (value9 as Comment).data;
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
    }
    let value3 =
        document2
          .querySelector('meta[name="README"]')
          ?.getAttribute("content") ?? "",
      value4: boolean =
        document2.querySelector(
          'meta[name="' + emulatorBuildMetaName() + '"]',
        ) !== null,
      value5 = document2.getElementById(emulatorShimId),
      callback = (input: string | null) => {
        let value9 = input ?? "";
        if (
          value9.startsWith(`
`) &&
          value9.endsWith(`
`)
        ) {
          return value9.slice(1, -1);
        } else {
          return value9;
        }
      },
      value6 =
        document2
          .querySelector(
            'meta[name="' + compiledPageCapabilitiesMetaName + '"]',
          )
          ?.getAttribute("content") ?? defaultCompiledPageCapabilities,
      value7 = document2.getElementById(compiledPageModeId)?.textContent ?? "",
      value8 = (["light", "dark"] as const).find(
        (input): boolean =>
          value7 === (0, runtime.colorModeBootstrapScript)(input),
      );
    return {
      title: document2.querySelector("title")?.textContent ?? "",
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
  function detectCompiledPageStorageMode(
    document2: Document,
  ): "db" | "page" | "files" {
    let value =
      document2
        .querySelector('meta[name="' + compiledPageCapabilitiesMetaName + '"]')
        ?.getAttribute("content") ?? "";
    if (capabilitiesUseDatabase(value)) {
      return "db";
    }
    if (document2.getElementById(compiledPageDocumentId) !== null) {
      return "page";
    } else {
      return "files";
    }
  }
  function capabilitiesUseDatabase(capabilities: string): boolean {
    try {
      let value: unknown = JSON.parse(capabilities);
      return (
        typeof value === "object" &&
        value !== null &&
        Object.hasOwn(value, databaseCapabilityKey)
      );
    } catch {
      return false;
    }
  }
  function truncateUtf16Safely(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    let value = text.slice(0, maxLength),
      value2 = value.charCodeAt(value.length - 1);
    if (value2 >= 55296 && value2 <= 56319) {
      return value.slice(0, -1);
    } else {
      return value;
    }
  }
  bindRuntimeValue(
    runtime,
    "compiledPageDocumentId",
    () => compiledPageDocumentId,
    (value) => {
      compiledPageDocumentId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compiledPageAppId",
    () => compiledPageAppId,
    (value) => {
      compiledPageAppId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compiledPageStyleId",
    () => compiledPageStyleId,
    (value) => {
      compiledPageStyleId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compiledPageModeId",
    () => compiledPageModeId,
    (value) => {
      compiledPageModeId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emulatorShimId",
    () => emulatorShimId,
    (value) => {
      emulatorShimId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compiledPageCapabilitiesMetaName",
    () => compiledPageCapabilitiesMetaName,
    (value) => {
      compiledPageCapabilitiesMetaName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultCompiledPageCapabilities",
    () => defaultCompiledPageCapabilities,
    (value) => {
      defaultCompiledPageCapabilities = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compiledPageMaxBytes",
    () => compiledPageMaxBytes,
    (value) => {
      compiledPageMaxBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emulatorBuildMetaName",
    () => emulatorBuildMetaName,
  );
  bindRuntimeValue(
    runtime,
    "escapePageHtmlAttribute",
    () => escapePageHtmlAttribute,
  );
  bindRuntimeValue(runtime, "escapeHtmlComment", () => escapeHtmlComment);
  bindRuntimeValue(runtime, "stringifyInlineJson", () => stringifyInlineJson);
  bindRuntimeValue(
    runtime,
    "thumbnailDeferAttribute",
    () => thumbnailDeferAttribute,
    (value) => {
      thumbnailDeferAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "compiledPageHtmlAttributes",
    () => compiledPageHtmlAttributes,
  );
  bindRuntimeValue(runtime, "assembleCompiledPage", () => assembleCompiledPage);
  bindRuntimeValue(
    runtime,
    "readCompiledPageDocument",
    () => readCompiledPageDocument,
  );
  bindRuntimeValue(
    runtime,
    "readCompiledPageAnatomy",
    () => readCompiledPageAnatomy,
  );
  bindRuntimeValue(
    runtime,
    "databaseCapabilityKey",
    () => databaseCapabilityKey,
    (value) => {
      databaseCapabilityKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "detectCompiledPageStorageMode",
    () => detectCompiledPageStorageMode,
  );
  bindRuntimeValue(
    runtime,
    "capabilitiesUseDatabase",
    () => capabilitiesUseDatabase,
  );
  bindRuntimeValue(runtime, "truncateUtf16Safely", () => truncateUtf16Safely);
  return () => {
    compiledPageDocumentId = "appifact-doc";
    compiledPageAppId = "appifact-app";
    compiledPageStyleId = "appifact-style";
    compiledPageModeId = "appifact-mode";
    emulatorShimId = ["appifact", "emulator", "shim"].join("-");
    compiledPageCapabilitiesMetaName = "appifact-capabilities";
    defaultCompiledPageCapabilities = '{"self":{}}';
    compiledPageMaxBytes = 16777216;
    thumbnailDeferAttribute = "data-thumb-defer";
    databaseCapabilityKey = "db";
  };
}

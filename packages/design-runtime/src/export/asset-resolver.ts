/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportAssetResolver(
  runtime: RuntimeBindings,
): () => void {
  var exportUuidPattern: Dynamic;
  var exportUrlSchemePattern: Dynamic;
  var exportAssetTextEncoder: Dynamic;
  var exportMimeByExtension: Dynamic;
  function isDesignRuntimeSource(source?: Dynamic): Dynamic {
    return (
      source.startsWith("// GENERATED from dc-runtime/") ||
      source.includes("__dcUpdate")
    );
  }
  function exportMimeForPath(path?: Dynamic): Dynamic {
    let value: Dynamic = path.split("/").pop() ?? path,
      value2: Dynamic = value.lastIndexOf("."),
      value3: Dynamic = value2 < 0 ? "" : value.slice(value2 + 1).toLowerCase();
    return exportMimeByExtension[value3] ?? "application/octet-stream";
  }
  function normalizeLocalExportPath(path?: Dynamic): Dynamic {
    if (path.startsWith("//") || exportUrlSchemePattern.test(path)) return null;
    let value: Dynamic = path.split("#")[0].split("?")[0];
    value.startsWith("/appifact/") && (value = value.slice(10));
    let items: Dynamic = [];
    for (let value3 of value.split("/") as Dynamic) {
      let value4: Dynamic = value3;
      try {
        value4 = decodeURIComponent(value3);
      } catch {}
      if (value4.includes("/") || value4.includes("\\")) return null;
      value4 === "" ||
        value4 === "." ||
        (value4 === ".." ? items.pop() : items.push(value4));
    }
    if (items.length === 0) return null;
    let value2: Dynamic = items.join("/");
    return exportUrlSchemePattern.test(value2) ? null : value2;
  }
  function createExportAssetResolver(
    files?: Dynamic,
    libraries?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let entries: Dynamic = new Map([
        [runtime.exportReactUmdUrl, libraries.reactUmd],
        [runtime.exportReactDomUmdUrl, libraries.reactDomUmd],
      ]),
      value: Dynamic =
        options.fetchExternal ??
        ((input?: Dynamic, options2?: Dynamic): Dynamic =>
          fetch(input, options2)),
      value2: Dynamic = options.externalTimeoutMs ?? 15e3;
    return async (input?: Dynamic, options2?: Dynamic): Promise<Dynamic> => {
      if (exportUuidPattern.test(input)) return null;
      let entry: Dynamic = entries.get(input);
      if (entry !== undefined)
        return {
          data: exportAssetTextEncoder.encode(entry),
          mime: "text/javascript",
        };
      // CucCut: Babel (embedded only for a JSX x-import) comes from the editor's own copy, the same bytes as the CDN
      // file; the CSP blocks the CDN (getBabelFileUrl, docs/design/canvas §8.3).
      let babelFile: Dynamic =
        input === runtime.exportBabelStandaloneUrl
          ? (0, runtime.getBabelFileUrl)()
          : undefined;
      if (babelFile)
        try {
          let response: Dynamic = await fetch(babelFile, { signal: options.signal });
          return response.ok
            ? {
                data: new Uint8Array(await response.arrayBuffer()),
                mime: "text/javascript",
              }
            : null;
        } catch {
          return null;
        }
      if (/^(https?:)?\/\//i.test(input)) {
        let value5: Dynamic = input.startsWith("//") ? "https:" + input : input;
        if (!/^https:/i.test(value5)) {
          console.warn(
            "[design/export] not fetching insecure URL: " +
              (0, runtime.redactProjectServeAccessToken)(input),
          );
          return null;
        }
        if (options.signal?.aborted) return null;
        let controller: Dynamic = new AbortController(),
          value6: Dynamic = setTimeout(
            (): Dynamic => controller.abort(),
            value2,
          ),
          callback: Dynamic = (): Dynamic => controller.abort();
        options.signal?.addEventListener("abort", callback);
        try {
          let value7: Dynamic = await value(value5, {
            signal: controller.signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
            redirect: "follow",
          });
          if (!value7.ok) return null;
          let value8: Dynamic =
            value7.headers
              .get("content-type")
              ?.split(";")[0]
              .trim()
              .toLowerCase() || "application/octet-stream";
          return {
            data: new Uint8Array(await value7.arrayBuffer()),
            mime: value8,
          };
        } catch {
          return null;
        } finally {
          clearTimeout(value6);
          options.signal?.removeEventListener("abort", callback);
        }
      }
      let value3: Dynamic = normalizeLocalExportPath(input);
      if (value3 === null) return null;
      let value4: Dynamic = await files(value3);
      return value3.split("/").pop() === runtime.SupportJsValue &&
        (value4 === null ||
          isDesignRuntimeSource(new TextDecoder().decode(value4.data)))
        ? {
            data: exportAssetTextEncoder.encode(libraries.supportJs),
            mime: "text/javascript",
          }
        : (value4 === null &&
            !options2?.optional &&
            console.warn(
              "[design/export] unresolved: " +
                (0, runtime.redactProjectServeAccessToken)(input),
            ),
          value4);
    };
  }
  bindRuntimeValue(
    runtime,
    "exportUuidPattern",
    () => exportUuidPattern,
    (value) => {
      exportUuidPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportUrlSchemePattern",
    () => exportUrlSchemePattern,
    (value) => {
      exportUrlSchemePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportAssetTextEncoder",
    () => exportAssetTextEncoder,
    (value) => {
      exportAssetTextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDesignRuntimeSource",
    () => isDesignRuntimeSource,
  );
  bindRuntimeValue(
    runtime,
    "exportMimeByExtension",
    () => exportMimeByExtension,
    (value) => {
      exportMimeByExtension = value;
    },
  );
  bindRuntimeValue(runtime, "exportMimeForPath", () => exportMimeForPath);
  bindRuntimeValue(
    runtime,
    "normalizeLocalExportPath",
    () => normalizeLocalExportPath,
  );
  bindRuntimeValue(
    runtime,
    "createExportAssetResolver",
    () => createExportAssetResolver,
  );
  return () => {
    exportUuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    exportUrlSchemePattern = /^[a-z][a-z0-9+.-]*:/i;
    exportAssetTextEncoder = new TextEncoder();
    exportMimeByExtension = {
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "text/javascript",
      mjs: "text/javascript",
      jsx: "text/jsx",
      tsx: "text/tsx",
      json: "application/json",
      svg: "image/svg+xml",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      avif: "image/avif",
      bmp: "image/bmp",
      ico: "image/x-icon",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      otf: "font/otf",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      txt: "text/plain",
      md: "text/markdown",
    };
  };
}

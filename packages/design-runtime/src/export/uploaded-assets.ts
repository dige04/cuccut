/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportUploadedAssets(
  runtime: RuntimeBindings,
): () => void {
  var projectBlobReferencePattern: Dynamic;
  var emulatorBlobReferencePattern: Dynamic;
  var exportAssetExtensionsByMime: Dynamic;
  var ExportAssetFetchError: Dynamic;
  var exportAssetIdleTimeoutMs: Dynamic;
  var exportAssetAbsoluteTimeoutMs: Dynamic;
  var exportAssetFetchConcurrency: Dynamic;
  var parentDirectoryOfExportPath: Dynamic;
  async function fetchExportAsset(
    url?: Dynamic,
    timeoutMs: Dynamic = exportAssetIdleTimeoutMs,
  ): Promise<Dynamic> {
    let controller: Dynamic = new AbortController(),
      flag: Dynamic = false,
      callback: Dynamic = (): Dynamic => {
        flag = true;
        controller.abort();
      },
      value: Dynamic = setTimeout(callback, timeoutMs),
      callback2: Dynamic = (): Dynamic => {
        clearTimeout(value);
        value = setTimeout(callback, timeoutMs);
      },
      value2: Dynamic = setTimeout(callback, exportAssetAbsoluteTimeoutMs),
      value3: Dynamic,
      value4: Dynamic;
    try {
      value3 = await fetch(url, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      callback2();
      if (!value3.ok || value3.body === null)
        value4 = value3.ok
          ? new Uint8Array(await value3.arrayBuffer())
          : new Uint8Array(0);
      else {
        let items: Dynamic = [],
          index: Dynamic = 0;
        for (let value6: Dynamic = value3.body.getReader(); ; ) {
          let { done: value7, value: value8 }: Dynamic = await value6.read();
          if (value7) break;
          callback2();
          items.push(value8);
          index += value8.length;
        }
        value4 = new Uint8Array(index);
        let index2: Dynamic = 0;
        for (let value6 of items as Dynamic) {
          value4.set(value6, index2);
          index2 += value6.length;
        }
      }
    } catch {
      throw flag
        ? new ExportAssetFetchError("the download stalled")
        : new Error("the download failed");
    } finally {
      clearTimeout(value);
      clearTimeout(value2);
    }
    if (!value3.ok)
      throw new Error("the server answered " + String(value3.status));
    let value5: Dynamic =
      value3.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ??
      "";
    if (value4.length === 0 || value5 === "text/html")
      throw new Error("the server did not return the file");
    return {
      data: value4,
      type: value5,
    };
  }
  async function mapWithConcurrency(
    items?: Dynamic,
    concurrency?: Dynamic,
    mapper?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = new Array(items.length),
      index: Dynamic = 0,
      callback: Dynamic = async (): Promise<Dynamic> => {
        for (; index < items.length; ) {
          let value2: Dynamic = index++;
          value[value2] = await mapper(items[value2]);
        }
      };
    await Promise.all(
      Array.from(
        {
          length: Math.min(concurrency, items.length),
        },
        callback,
      ),
    );
    return value;
  }
  function findExportBlobReferences(
    source?: Dynamic,
    includeEmulatorBlobUrls?: Dynamic,
  ): Dynamic {
    let entries: Dynamic = new Map();
    if (source.includes("_blob/"))
      for (let value of source.matchAll(projectBlobReferencePattern) as Dynamic)
        entries.set("_blob/" + value[2], value[2]);
    if (includeEmulatorBlobUrls && source.includes("blob:"))
      for (let value of source.matchAll(
        emulatorBlobReferencePattern,
      ) as Dynamic)
        entries.set(value[0], value[1]);
    return entries;
  }
  async function collectExportUploadedAssets(
    files?: Dynamic,
    readBlob?: Dynamic,
    transform?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = options.emulatorBlobUrls === true,
      value2: Dynamic = options.maxBytes ?? 268435456,
      values: Dynamic = new Set(
        [...(options.taken ?? []), ...files.keys()].map(
          (input?: Dynamic): Dynamic => input.toLowerCase(),
        ),
      ),
      entries: Dynamic = new Map(),
      items: Dynamic = [],
      entries2: Dynamic = new Map(files),
      entries3: Dynamic = new Map(),
      items2: Dynamic = [],
      values2: Dynamic = new Set(),
      value3: Dynamic =
        "it would take the export past " +
        String(value2 >> 20) +
        " MB of uploaded files",
      text: Dynamic = "not downloaded, because an earlier download stalled",
      index: Dynamic = 0,
      index2: Dynamic = 0,
      flag: Dynamic = false,
      items3: Dynamic = [...files.values()];
    for (; items3.length > 0; ) {
      let entries6: Dynamic = new Map();
      for (let value8 of items3 as Dynamic)
        for (let [value9, value10] of findExportBlobReferences(
          value8,
          value,
        ) as Dynamic)
          values2.has(value9) || entries6.set(value9, value10);
      items3 = [];
      for (let value8 of entries6.keys() as Dynamic) values2.add(value8);
      let value7: Dynamic = await mapWithConcurrency(
        [...entries6.keys()],
        exportAssetFetchConcurrency,
        async (input?: Dynamic): Promise<Dynamic> => {
          if (flag) return text;
          if (index2 >= value2) return value3;
          try {
            let value8: Dynamic = await transform(
              input.startsWith("blob:") ? input : "/" + input,
            );
            index2 += value8.data.length;
            return value8;
          } catch (value8: Dynamic) {
            value8 instanceof ExportAssetFetchError && (flag = true);
            return value8 instanceof Error ? value8.message : String(value8);
          }
        },
      );
      [...entries6].forEach(
        ([input, input2]: Dynamic, options2?: Dynamic): Dynamic => {
          let value8: Dynamic = value7[options2];
          if (
            typeof value8 == "string" ||
            index + value8.data.length > value2
          ) {
            items2.push({
              ref: input,
              why: typeof value8 == "string" ? value8 : value3,
              usedIn: [],
            });
            return;
          }
          index += value8.data.length;
          let value9: Dynamic =
              exportAssetExtensionsByMime[value8.type] ?? "bin",
            value10: Dynamic = "assets/" + input2 + "." + value9;
          for (
            let count: Dynamic = 2;
            values.has(value10.toLowerCase());
            count++
          )
            value10 = "assets/" + input2 + "-" + String(count) + "." + value9;
          values.add(value10.toLowerCase());
          entries.set(input, value10);
          if (value8.type === "text/css" || value8.type === "text/javascript") {
            let value11: Dynamic = new TextDecoder().decode(value8.data);
            entries2.set(value10, value11);
            entries3.set(value10, value8.data);
            items3.push(value11);
          } else
            items.push({
              name: value10,
              data: value8.data,
            });
        },
      );
    }
    let value4: Dynamic = parentDirectoryOfExportPath(readBlob),
      entries4: Dynamic = new Map();
    for (let [value7, value8] of entries2 as Dynamic) {
      let value9: Dynamic = /\.css$/i.test(value7)
          ? parentDirectoryOfExportPath(value7)
          : value4,
        value10: Dynamic =
          value9 === "" ? "./" : "../".repeat(value9.split("/").length),
        value11: Dynamic = value8;
      value11.includes("_blob/") &&
        (value11 = value11.replace(
          projectBlobReferencePattern,
          (input?: Dynamic, options2?: Dynamic, context?: Dynamic): Dynamic => {
            let entry: Dynamic = entries.get("_blob/" + context);
            return entry === undefined ? input : options2 + value10 + entry;
          },
        ));
      value &&
        value11.includes("blob:") &&
        (value11 = value11.replace(
          emulatorBlobReferencePattern,
          (input?: Dynamic): Dynamic => {
            let entry: Dynamic = entries.get(input);
            return entry === undefined ? input : value10 + entry;
          },
        ));
      entries4.set(value7, value11);
    }
    let entries5: Dynamic = new Map(),
      value5: Dynamic = items;
    for (let [value7, value8] of entries4 as Dynamic)
      files.has(value7)
        ? entries5.set(value7, value8)
        : value5.push({
            name: value7,
            data:
              value8 === entries2.get(value7) ? entries3.get(value7) : value8,
          });
    for (let value7 of items2 as Dynamic)
      value7.usedIn = [...entries2]
        .filter(
          ([, input]: Dynamic): Dynamic =>
            findExportBlobReferences(input, value).has(value7.ref),
        )
        .map(([input]: Dynamic): Dynamic => input);
    let value6: Dynamic =
      values2.size > 0 ||
      [...files.values()].some(
        (input?: Dynamic): Dynamic => input.includes("_blob/"),
      );
    return {
      sources: entries5,
      entries: value5,
      missing: items2,
      mentionsUploads: value6,
    };
  }
  bindRuntimeValue(
    runtime,
    "projectBlobReferencePattern",
    () => projectBlobReferencePattern,
    (value) => {
      projectBlobReferencePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emulatorBlobReferencePattern",
    () => emulatorBlobReferencePattern,
    (value) => {
      emulatorBlobReferencePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportAssetExtensionsByMime",
    () => exportAssetExtensionsByMime,
    (value) => {
      exportAssetExtensionsByMime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportAssetFetchError",
    () => ExportAssetFetchError,
    (value) => {
      ExportAssetFetchError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportAssetIdleTimeoutMs",
    () => exportAssetIdleTimeoutMs,
    (value) => {
      exportAssetIdleTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportAssetAbsoluteTimeoutMs",
    () => exportAssetAbsoluteTimeoutMs,
    (value) => {
      exportAssetAbsoluteTimeoutMs = value;
    },
  );
  bindRuntimeValue(runtime, "fetchExportAsset", () => fetchExportAsset);
  bindRuntimeValue(
    runtime,
    "exportAssetFetchConcurrency",
    () => exportAssetFetchConcurrency,
    (value) => {
      exportAssetFetchConcurrency = value;
    },
  );
  bindRuntimeValue(runtime, "mapWithConcurrency", () => mapWithConcurrency);
  bindRuntimeValue(
    runtime,
    "parentDirectoryOfExportPath",
    () => parentDirectoryOfExportPath,
    (value) => {
      parentDirectoryOfExportPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findExportBlobReferences",
    () => findExportBlobReferences,
  );
  bindRuntimeValue(
    runtime,
    "collectExportUploadedAssets",
    () => collectExportUploadedAssets,
  );
  return () => {
    projectBlobReferencePattern =
      /(^|[^\w/.:-])(?:(?:\.{1,2}\/)+|\/)?_blob\/([0-9a-f]{32})(?![0-9a-f])/g;
    emulatorBlobReferencePattern =
      /blob:https?:\/\/[A-Za-z0-9.:-]{1,80}\/([0-9a-f-]{36})/g;
    exportAssetExtensionsByMime = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "application/pdf": "pdf",
      "font/woff2": "woff2",
      "font/woff": "woff",
      "font/ttf": "ttf",
      "font/otf": "otf",
      "text/csv": "csv",
      "text/markdown": "md",
      "application/json": "json",
      "text/plain": "txt",
      "text/css": "css",
      "text/javascript": "js",
    };
    ExportAssetFetchError = class extends Error {};
    exportAssetIdleTimeoutMs = 2e4;
    exportAssetAbsoluteTimeoutMs = 12e4;
    exportAssetFetchConcurrency = 4;
    parentDirectoryOfExportPath = (input?: Dynamic): Dynamic =>
      input.includes("/") ? input.slice(0, input.lastIndexOf("/")) : "";
  };
}

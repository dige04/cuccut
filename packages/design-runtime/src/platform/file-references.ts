/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformFileReferences(
  runtime: RuntimeBindings,
): () => void {
  var InstanceValue: Dynamic;
  var PlatformFileReferencesLimit: Dynamic;
  var PlatformFileReferencesResolvedValue: Dynamic;
  var PlatformFileReferencesResolvedValue_2: Dynamic;
  var PlatformFileReferencesLimit_2: Dynamic;
  var FilesJsonValue: Dynamic;
  function parseFileReferences(input?: Dynamic): Dynamic {
    let value: Dynamic = input?.files;
    if (!Array.isArray(value)) return [];
    let items: Dynamic = [],
      index: Dynamic = 0;
    for (let value2 of value as Dynamic) {
      let value3: Dynamic = value2;
      if (
        items.length >= PlatformFileReferencesLimit ||
        value3 === null ||
        typeof value3 != "object" ||
        !(0, runtime.isProjectTextFilePath)(value3.path) ||
        !(0, runtime.isFullProjectPath)(value3.file) ||
        (typeof value3.bytes == "number" &&
          value3.bytes > PlatformFileReferencesResolvedValue) ||
        items.some((input2?: Dynamic): Dynamic => input2.path === value3.path)
      ) {
        index++;
        continue;
      }
      items.push({
        path: value3.path,
        file: value3.file,
        ...(typeof value3.bytes == "number"
          ? {
              bytes: value3.bytes,
            }
          : {}),
      });
    }
    return Object.assign(
      items,
      index > 0
        ? {
            dropped: index,
          }
        : {},
    );
  }
  async function fetchPublishedFileIndex(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = await input(FilesJsonValue);
      if (!value.ok)
        return {
          files: value.status === 404 ? null : undefined,
          narrowed: false,
        };
      let value2: Dynamic = await value.json(),
        files: Dynamic = value2.files;
      return {
        files:
          files !== null && typeof files == "object" && !Array.isArray(files)
            ? files
            : undefined,
        narrowed: value2.narrowed === true,
      };
    } catch {
      return {
        files: undefined,
        narrowed: false,
      };
    }
  }
  async function loadReferencedFiles(
    items?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 0,
  ): Promise<Dynamic> {
    let state: Dynamic = {},
      entries: Dynamic = new Map(),
      items2: Dynamic = [],
      value: Dynamic = context,
      index: Dynamic = 0,
      index2: Dynamic = 0,
      callback: Dynamic = async (input?: Dynamic): Promise<Dynamic> => {
        let callback3: Dynamic = (): Dynamic =>
          PlatformFileReferencesResolvedValue_2 - value;
        if ((input.bytes ?? 0) > callback3()) return void index++;
        let entry: Dynamic = entries.get(input.file);
        entry === undefined &&
          ((entry = (async (): Promise<Dynamic> => {
            let value3: Dynamic = await options(
              input.file.startsWith("blob:")
                ? input.file
                : input.file.split("/").map(encodeURIComponent).join("/"),
            );
            if (!value3.ok) throw new Error("HTTP " + String(value3.status));
            let value4: Dynamic = Number(
              value3.headers?.get?.("content-length") ?? NaN,
            );
            if (
              value4 > PlatformFileReferencesResolvedValue ||
              value4 > callback3()
            )
              throw new Error("over the size budget");
            let value5: Dynamic = await value3.arrayBuffer();
            if (value5.byteLength > PlatformFileReferencesResolvedValue)
              throw new Error("over 20 MiB");
            return value5;
          })().catch((input2?: Dynamic): Dynamic => {
            console.warn(
              "design (instance files): skipping a listed file \u2014 " +
                (input2 instanceof Error ? input2.message : String(input2)),
            );
          })),
          entries.set(input.file, entry));
        let value2: Dynamic = await entry;
        if (value2 === undefined) return void items2.push(input);
        if (value2.byteLength > callback3()) return void index++;
        state[input.path] = new TextDecoder().decode(value2);
        value += value2.byteLength;
      },
      callback2: Dynamic = async (): Promise<Dynamic> => {
        for (; index2 < items.length; ) await callback(items[index2++]);
      };
    await Promise.all(
      Array.from(
        {
          length: Math.min(4, items.length),
        },
        callback2,
      ),
    );
    return {
      files: state,
      skipped: index + items2.length,
      failed: items2,
      bytes: value,
    };
  }
  bindRuntimeValue(
    runtime,
    "InstanceValue",
    () => InstanceValue,
    (value) => {
      InstanceValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileReferencesLimit",
    () => PlatformFileReferencesLimit,
    (value) => {
      PlatformFileReferencesLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileReferencesResolvedValue",
    () => PlatformFileReferencesResolvedValue,
    (value) => {
      PlatformFileReferencesResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileReferencesResolvedValue_2",
    () => PlatformFileReferencesResolvedValue_2,
    (value) => {
      PlatformFileReferencesResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformFileReferencesLimit_2",
    () => PlatformFileReferencesLimit_2,
    (value) => {
      PlatformFileReferencesLimit_2 = value;
    },
  );
  bindRuntimeValue(runtime, "parseFileReferences", () => parseFileReferences);
  bindRuntimeValue(
    runtime,
    "FilesJsonValue",
    () => FilesJsonValue,
    (value) => {
      FilesJsonValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchPublishedFileIndex",
    () => fetchPublishedFileIndex,
  );
  bindRuntimeValue(runtime, "loadReferencedFiles", () => loadReferencedFiles);
  return () => {
    InstanceValue = "instance";
    PlatformFileReferencesLimit = 1024;
    PlatformFileReferencesResolvedValue = 20 * 1024 * 1024;
    PlatformFileReferencesResolvedValue_2 = 256 * 1024 * 1024;
    PlatformFileReferencesLimit_2 = 8;
    FilesJsonValue = "_files.json";
  };
}

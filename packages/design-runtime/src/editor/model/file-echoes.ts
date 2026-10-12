/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelFileEchoes(
  runtime: RuntimeBindings,
): () => void {
  var ModelFileEchoesCache: Dynamic;
  var ModelFileEchoesConstant: Dynamic;
  var ModelFileEchoesRegistry: Dynamic;
  var ModelFileEchoesCache_2: Dynamic;
  var ModelFileEchoesResolvedValue: Dynamic;
  var ModelFileEchoesCache_3: Dynamic;
  function normalizeSmartPunctuation(input?: Dynamic): Dynamic {
    return input
      .replace(/[\u2018\u2019\u201A\u201B\u2039\u203A]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
      .replace(
        /[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\u00AD\uFEFF]/g,
        "",
      )
      .replace(/#/g, "");
  }
  function normalizeProjectFilePath(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    for (let value2 of input.split("/") as Dynamic)
      if (!(value2 === "" || value2 === ".")) {
        if (value2 === "..") {
          items.pop();
          continue;
        }
        items.push(value2);
      }
    let value: Dynamic = items.pop();
    return value === undefined
      ? ""
      : [...items, normalizeSmartPunctuation(value)].join("/");
  }
  function expectLocalFileEcho(input?: Dynamic, options: Dynamic = 1): Dynamic {
    let value: Dynamic = Date.now(),
      entry: Dynamic = ModelFileEchoesCache.get(input),
      value2: Dynamic = entry && entry.expires > value ? entry.n : 0;
    ModelFileEchoesCache.set(input, {
      n: value2 + options,
      expires: value + ModelFileEchoesConstant,
    });
  }
  function consumeLocalFileEcho(input?: Dynamic): Dynamic {
    let entry: Dynamic = ModelFileEchoesCache.get(input);
    entry && (entry.n--, entry.n <= 0 && ModelFileEchoesCache.delete(input));
  }
  function normalizeEchoPath(input?: Dynamic): Dynamic {
    return input
      .replace(/^(?:\.\/)+/, "")
      .replace(/\/(?:\.\/)+/g, "/")
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/, "");
  }
  function markExpectedFileChange(
    input?: Dynamic,
    ...items: Dynamic[]
  ): Dynamic {
    let entry: Dynamic = ModelFileEchoesCache_2.get(input);
    entry || ((entry = new Map()), ModelFileEchoesCache_2.set(input, entry));
    let value: Dynamic = Date.now(),
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        entry.set(input2, {
          t: value,
          landed: entry.get(input2)?.landed ?? false,
        });
    items.length === 0 && callback("");
    for (let value2 of items as Dynamic) value2 && callback(value2);
  }
  function markLandedFileChange(
    input?: Dynamic,
    ...options: Dynamic[]
  ): Dynamic {
    if (!options.some(Boolean)) return;
    let entry: Dynamic = ModelFileEchoesCache_3.get(input);
    entry || ((entry = new Map()), ModelFileEchoesCache_3.set(input, entry));
    let value: Dynamic = Date.now(),
      entry2: Dynamic = ModelFileEchoesCache_2.get(input);
    for (let value2 of options as Dynamic) {
      if (!value2) continue;
      let value3: Dynamic = entry2?.get(value2);
      value3 && (value3.landed = true);
      entry.set(normalizeEchoPath(value2), value);
    }
  }
  function markLocalFileChange(
    input?: Dynamic,
    ...options: Dynamic[]
  ): Dynamic {
    markExpectedFileChange(input, ...options);
    markLandedFileChange(input, ...options);
    if (!options.some(Boolean)) {
      let value: Dynamic = ModelFileEchoesCache_2.get(input)?.get("");
      value && (value.landed = true);
    }
  }
  bindRuntimeValue(
    runtime,
    "normalizeSmartPunctuation",
    () => normalizeSmartPunctuation,
  );
  bindRuntimeValue(
    runtime,
    "normalizeProjectFilePath",
    () => normalizeProjectFilePath,
  );
  bindRuntimeValue(
    runtime,
    "ModelFileEchoesCache",
    () => ModelFileEchoesCache,
    (value) => {
      ModelFileEchoesCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelFileEchoesConstant",
    () => ModelFileEchoesConstant,
    (value) => {
      ModelFileEchoesConstant = value;
    },
  );
  bindRuntimeValue(runtime, "expectLocalFileEcho", () => expectLocalFileEcho);
  bindRuntimeValue(runtime, "consumeLocalFileEcho", () => consumeLocalFileEcho);
  bindRuntimeValue(
    runtime,
    "ModelFileEchoesRegistry",
    () => ModelFileEchoesRegistry,
    (value) => {
      ModelFileEchoesRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelFileEchoesCache_2",
    () => ModelFileEchoesCache_2,
    (value) => {
      ModelFileEchoesCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelFileEchoesResolvedValue",
    () => ModelFileEchoesResolvedValue,
    (value) => {
      ModelFileEchoesResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelFileEchoesCache_3",
    () => ModelFileEchoesCache_3,
    (value) => {
      ModelFileEchoesCache_3 = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeEchoPath", () => normalizeEchoPath);
  bindRuntimeValue(
    runtime,
    "markExpectedFileChange",
    () => markExpectedFileChange,
  );
  bindRuntimeValue(runtime, "markLandedFileChange", () => markLandedFileChange);
  bindRuntimeValue(runtime, "markLocalFileChange", () => markLocalFileChange);
  return () => {
    ModelFileEchoesCache = new Map();
    ModelFileEchoesConstant = 5e3;
    ModelFileEchoesRegistry = {};
    ModelFileEchoesCache_2 = new Map();
    ModelFileEchoesResolvedValue = 10 * 6e4;
    ModelFileEchoesCache_3 = new Map();
    {
      let value: Dynamic = (0, runtime.getEditorEventRuntime)().onOmEvent(
        "files-changed",
        (input?: Dynamic): Dynamic => {
          let value2: Dynamic = input,
            value3: Dynamic = value2?.projectPath;
          value3 &&
            (value2?.source === "fanout" || value2?.source === "user-import") &&
            markLocalFileChange(value3);
        },
      );
      ModelFileEchoesRegistry.hot?.dispose(value);
    }
  };
}

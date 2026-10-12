/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemPaths(runtime: RuntimeBindings): () => void {
  var DesignSystemPathsPattern: Dynamic;
  var PathCheckError: Dynamic;
  var DesignSystemPathsResolvedValue: Dynamic;
  var DesignSystemPathsConstant: Dynamic;
  var DesignSystemPathsConstant_2: Dynamic;
  var DesignSystemPathsConstant_3: Dynamic;
  var DesignSystemPathsConstant_4: Dynamic;
  var DesignSystemPathsResolvedValue_2: Dynamic;
  var DesignSystemPathsLabel: Dynamic;
  var designSystemFilePathPattern: Dynamic;
  var DesignSystemPathsPattern_2: Dynamic;
  var DesignSystemPathsPattern_3: Dynamic;
  function isDesignSystemNamespace(input?: Dynamic): Dynamic {
    return typeof input == "string" && DesignSystemPathsPattern.test(input);
  }
  function designSystemProjectPrefix(input?: Dynamic): Dynamic {
    if (!isDesignSystemNamespace(input))
      throw new PathCheckError("bad_namespace", String(input));
    return "project/ds/" + input + "/";
  }
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsPattern",
    () => DesignSystemPathsPattern,
    (value) => {
      DesignSystemPathsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDesignSystemNamespace",
    () => isDesignSystemNamespace,
  );
  bindRuntimeValue(
    runtime,
    "PathCheckError",
    () => PathCheckError,
    (value) => {
      PathCheckError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemProjectPrefix",
    () => designSystemProjectPrefix,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsResolvedValue",
    () => DesignSystemPathsResolvedValue,
    (value) => {
      DesignSystemPathsResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsConstant",
    () => DesignSystemPathsConstant,
    (value) => {
      DesignSystemPathsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsConstant_2",
    () => DesignSystemPathsConstant_2,
    (value) => {
      DesignSystemPathsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsConstant_3",
    () => DesignSystemPathsConstant_3,
    (value) => {
      DesignSystemPathsConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsConstant_4",
    () => DesignSystemPathsConstant_4,
    (value) => {
      DesignSystemPathsConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsResolvedValue_2",
    () => DesignSystemPathsResolvedValue_2,
    (value) => {
      DesignSystemPathsResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsLabel",
    () => DesignSystemPathsLabel,
    (value) => {
      DesignSystemPathsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemFilePathPattern",
    () => designSystemFilePathPattern,
    (value) => {
      designSystemFilePathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsPattern_2",
    () => DesignSystemPathsPattern_2,
    (value) => {
      DesignSystemPathsPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathsPattern_3",
    () => DesignSystemPathsPattern_3,
    (value) => {
      DesignSystemPathsPattern_3 = value;
    },
  );
  return () => {
    DesignSystemPathsPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
    PathCheckError = class extends Error {
      declare name: Dynamic;
      constructor(input: Dynamic, options: Dynamic) {
        super(input + ": " + JSON.stringify(options));
        this.code = input;
        this.subject = options;
        this.name = "PathCheckError";
      }
      code: Dynamic;
      subject: Dynamic;
    };
    DesignSystemPathsResolvedValue = 256 * 1024 * 1024;
    DesignSystemPathsConstant = 4;
    DesignSystemPathsConstant_2 = 200;
    DesignSystemPathsConstant_3 = 2e3;
    DesignSystemPathsConstant_4 = 224;
    DesignSystemPathsResolvedValue_2 = 1024 * 1024;
    DesignSystemPathsLabel =
      "[A-Za-z0-9_](?:(?:[A-Za-z0-9._-]| (?=[A-Za-z0-9_]))*[A-Za-z0-9_-])?";
    designSystemFilePathPattern = new RegExp(
      "^" + DesignSystemPathsLabel + "(?:/" + DesignSystemPathsLabel + ")*$",
    );
    DesignSystemPathsPattern_2 =
      /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\u{e0000}-\u{e007f}]/u;
    DesignSystemPathsPattern_3 =
      /[\u0000-\u001f\u007f-\u009f\u061c\u2028\u2029\u202a-\u202e\u2066-\u2069\u{e0000}-\u{e007f}]/u;
  };
}

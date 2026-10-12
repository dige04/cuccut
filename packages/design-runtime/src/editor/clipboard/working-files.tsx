/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorClipboardWorkingFiles(
  runtime: RuntimeBindings,
): () => void {
  var ClipboardWorkingFilesHandler: Dynamic;
  var reactClipboardWorkingFiles: Dynamic;
  var AppifactExtraExportFormatsValue: Dynamic;
  var ClipboardWorkingFilesConstant: Dynamic;
  function createWorkingFileMap(input?: Dynamic): Dynamic {
    let values: Dynamic = new Set(
        (0, runtime.parseCanvasMetadata)(input[runtime.canvasMetadataFile], {
          ...input,
        }).artboards.map((input2?: Dynamic): Dynamic => input2.file),
      ),
      entries: Dynamic = new Map();
    for (let [value, value2] of Object.entries(input) as Dynamic)
      entries.set(values.has(value) ? value : runtime.Value_5 + value, value2);
    return entries;
  }
  function createCurrentWorkingGeneration(): Dynamic {
    let value: Dynamic = ++ClipboardWorkingFilesConstant;
    return (): Dynamic => value === ClipboardWorkingFilesConstant;
  }
  function useClipboardFeatureFlag(): Dynamic {
    let [value, value2]: Dynamic = (0, reactClipboardWorkingFiles.useState)(
      false,
    );
    (0, reactClipboardWorkingFiles.useEffect)((): Dynamic => {
      let flag: Dynamic = true;
      (0, runtime.awaitFeatureFlag)(
        AppifactExtraExportFormatsValue,
        false,
      ).then((input?: Dynamic): Dynamic => {
        flag && value2(input);
      });
      return (): Dynamic => {
        flag = false;
      };
    }, []);
    return value;
  }
  bindRuntimeValue(runtime, "createWorkingFileMap", () => createWorkingFileMap);
  bindRuntimeValue(
    runtime,
    "ClipboardWorkingFilesHandler",
    () => ClipboardWorkingFilesHandler,
    (value) => {
      ClipboardWorkingFilesHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactClipboardWorkingFiles",
    () => reactClipboardWorkingFiles,
    (value) => {
      reactClipboardWorkingFiles = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AppifactExtraExportFormatsValue",
    () => AppifactExtraExportFormatsValue,
    (value) => {
      AppifactExtraExportFormatsValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ClipboardWorkingFilesConstant",
    () => ClipboardWorkingFilesConstant,
    (value) => {
      ClipboardWorkingFilesConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createCurrentWorkingGeneration",
    () => createCurrentWorkingGeneration,
  );
  bindRuntimeValue(
    runtime,
    "useClipboardFeatureFlag",
    () => useClipboardFeatureFlag,
  );
  return () => {
    ClipboardWorkingFilesHandler = (input?: Dynamic): Dynamic =>
      // CucCut: user-facing copy calls the agent "the agent", not Claude.
      "The agent is adding " +
      (0, runtime.AccessibilityAnnouncementsHandler)(input);
    reactClipboardWorkingFiles = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    AppifactExtraExportFormatsValue = "appifact_extra_export_formats";
    ClipboardWorkingFilesConstant = 0;
  };
}

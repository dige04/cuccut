/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorContext(
  runtime: RuntimeBindings,
): () => void {
  var reactInspectorContext: Dynamic;
  var inspectorPanelId: Dynamic;
  var editorToolbarId: Dynamic;
  var inspectorToggleId: Dynamic;
  var linkPopoverAttribute: Dynamic;
  var inspectorOpenStorageKey: Dynamic;
  var DcEditorModeKey: Dynamic;
  var DcEditorGuidesVisibleKey: Dynamic;
  var defaultInspectorOpen: Dynamic;
  var InspectorOpenContext: Dynamic;
  var initializeInspectorContext: Dynamic;
  function getTweakSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    return input && options && context === "tweaks" ? value : null;
  }
  function useInspectorOpen(): Dynamic {
    let value: Dynamic = (0, runtime.npm_useLocalStorage_QP)(
      inspectorOpenStorageKey,
      defaultInspectorOpen,
    );
    return (
      (0, reactInspectorContext.useContext)(InspectorOpenContext) ?? [
        value[0],
        value[1],
      ]
    );
  }
  function hasInspectorOpenProvider(): Dynamic {
    return (0, reactInspectorContext.useContext)(InspectorOpenContext) != null;
  }
  bindRuntimeValue(runtime, "getTweakSelection", () => getTweakSelection);
  bindRuntimeValue(runtime, "useInspectorOpen", () => useInspectorOpen);
  bindRuntimeValue(
    runtime,
    "hasInspectorOpenProvider",
    () => hasInspectorOpenProvider,
  );
  bindRuntimeValue(
    runtime,
    "reactInspectorContext",
    () => reactInspectorContext,
    (value) => {
      reactInspectorContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectorPanelId",
    () => inspectorPanelId,
    (value) => {
      inspectorPanelId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorToolbarId",
    () => editorToolbarId,
    (value) => {
      editorToolbarId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectorToggleId",
    () => inspectorToggleId,
    (value) => {
      inspectorToggleId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "linkPopoverAttribute",
    () => linkPopoverAttribute,
    (value) => {
      linkPopoverAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectorOpenStorageKey",
    () => inspectorOpenStorageKey,
    (value) => {
      inspectorOpenStorageKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcEditorModeKey",
    () => DcEditorModeKey,
    (value) => {
      DcEditorModeKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DcEditorGuidesVisibleKey",
    () => DcEditorGuidesVisibleKey,
    (value) => {
      DcEditorGuidesVisibleKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "defaultInspectorOpen",
    () => defaultInspectorOpen,
    (value) => {
      defaultInspectorOpen = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorOpenContext",
    () => InspectorOpenContext,
    (value) => {
      InspectorOpenContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeInspectorContext",
    () => initializeInspectorContext,
    (value) => {
      initializeInspectorContext = value;
    },
  );
  return () => {
    initializeInspectorContext = (0, runtime.initializeOnce)((): Dynamic => {
      "use strict";

      reactInspectorContext = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
        1,
      );
      (0, runtime.initializeNpm_usehooks_ts_p0)();
      inspectorPanelId = "dc-panel-aside";
      editorToolbarId = "dc-toolbar-tools";
      inspectorToggleId = "dc-props-toggle";
      linkPopoverAttribute = "data-dc-link-popover";
      inspectorOpenStorageKey = "dc-editor-props-open-v2";
      DcEditorModeKey = "dc-editor-mode";
      DcEditorGuidesVisibleKey = "dc-editor-guides-visible";
      defaultInspectorOpen = false;
      InspectorOpenContext = (0, reactInspectorContext.createContext)(null);
    });
  };
}

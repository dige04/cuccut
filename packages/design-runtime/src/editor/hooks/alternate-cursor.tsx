/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHooksAlternateCursor(
  runtime: RuntimeBindings,
): () => void {
  var reactHooksAlternateCursor: Dynamic;
  var HooksAlternateCursorProgressCrosshairConfig: Dynamic;
  var HooksAlternateCursorRegistry: Dynamic;
  var HooksAlternateCursorProgressCrosshairConfig_2: Dynamic;
  var HooksAlternateCursorCrosshairProgressValues: Dynamic;
  var HooksAlternateCursorHandler: Dynamic;
  var HooksAlternateCursorSubscribers: Dynamic;
  var HooksAlternateCursorTest: Dynamic;
  function reservedShapeRenderHook(input?: Dynamic): Dynamic {
    return null;
  }
  function getAlternateCursorStyle(input?: Dynamic): Dynamic {
    let value: Dynamic = HooksAlternateCursorRegistry[input];
    value ||
      ((value = (document as Dynamic).createElement("style")),
      value.setAttribute("data-alt-cursor", input),
      (value.textContent =
        HooksAlternateCursorProgressCrosshairConfig_2[input]),
      (HooksAlternateCursorRegistry[input] = value));
    return value;
  }
  function refreshAlternateCursors(): Dynamic {
    for (let value of HooksAlternateCursorCrosshairProgressValues as Dynamic)
      HooksAlternateCursorRegistry[value]?.remove();
    for (let value of HooksAlternateCursorCrosshairProgressValues as Dynamic)
      HooksAlternateCursorProgressCrosshairConfig[value] > 0 &&
        (document as Dynamic).head.appendChild(getAlternateCursorStyle(value));
  }
  function useAlternateCursor(input?: Dynamic, options?: Dynamic): Dynamic {
    (0, reactHooksAlternateCursor.useEffect)((): Dynamic => {
      if (options) {
        HooksAlternateCursorProgressCrosshairConfig[input]++;
        refreshAlternateCursors();
        return (): Dynamic => {
          HooksAlternateCursorProgressCrosshairConfig[input]--;
          refreshAlternateCursors();
        };
      }
    }, [input, options]);
  }
  function useProgressCursor(input?: Dynamic): Dynamic {
    useAlternateCursor("progress", input);
  }
  bindRuntimeValue(
    runtime,
    "reservedShapeRenderHook",
    () => reservedShapeRenderHook,
  );
  bindRuntimeValue(
    runtime,
    "reactHooksAlternateCursor",
    () => reactHooksAlternateCursor,
    (value) => {
      reactHooksAlternateCursor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorProgressCrosshairConfig",
    () => HooksAlternateCursorProgressCrosshairConfig,
    (value) => {
      HooksAlternateCursorProgressCrosshairConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorRegistry",
    () => HooksAlternateCursorRegistry,
    (value) => {
      HooksAlternateCursorRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorProgressCrosshairConfig_2",
    () => HooksAlternateCursorProgressCrosshairConfig_2,
    (value) => {
      HooksAlternateCursorProgressCrosshairConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorCrosshairProgressValues",
    () => HooksAlternateCursorCrosshairProgressValues,
    (value) => {
      HooksAlternateCursorCrosshairProgressValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getAlternateCursorStyle",
    () => getAlternateCursorStyle,
  );
  bindRuntimeValue(
    runtime,
    "refreshAlternateCursors",
    () => refreshAlternateCursors,
  );
  bindRuntimeValue(runtime, "useAlternateCursor", () => useAlternateCursor);
  bindRuntimeValue(runtime, "useProgressCursor", () => useProgressCursor);
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorHandler",
    () => HooksAlternateCursorHandler,
    (value) => {
      HooksAlternateCursorHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorSubscribers",
    () => HooksAlternateCursorSubscribers,
    (value) => {
      HooksAlternateCursorSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksAlternateCursorTest",
    () => HooksAlternateCursorTest,
    (value) => {
      HooksAlternateCursorTest = value;
    },
  );
  return () => {
    reactHooksAlternateCursor = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    HooksAlternateCursorProgressCrosshairConfig = {
      progress: 0,
      crosshair: 0,
    };
    HooksAlternateCursorRegistry = {};
    HooksAlternateCursorProgressCrosshairConfig_2 = {
      progress: "* { cursor: progress !important; }",
      crosshair: "* { cursor: crosshair !important; }",
    };
    HooksAlternateCursorCrosshairProgressValues = ["crosshair", "progress"];
    HooksAlternateCursorHandler = (input?: Dynamic): Dynamic =>
      parseInt(input?.getAttribute(runtime.DcTplAttribute) ?? "-1", 10);
    HooksAlternateCursorSubscribers = new Set([
      "stroke",
      "stroke-width",
      "@stroke",
      "@stroke-width",
    ]);
    HooksAlternateCursorTest = (input?: Dynamic): Dynamic =>
      /^\d*\.?\d+(px)?$/.test((input ?? "").trim()) ? parseFloat(input) : null;
  };
}

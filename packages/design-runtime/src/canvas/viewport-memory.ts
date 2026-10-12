/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasViewportMemory(
  runtime: RuntimeBindings,
): () => void {
  var isFiniteNumber: Dynamic;
  var viewportScaleLimits: Dynamic;
  var createViewportMemoryValue: Dynamic;
  var recallCanvasView: Dynamic;
  var rememberCanvasView: Dynamic;
  function getArtifactMemoryScope(): Dynamic {
    let value: Dynamic =
      typeof location === "undefined" ? "/" : location.pathname;
    return (0, runtime.getDocumentStashKey)(value).slice(
      (0, runtime.getDocumentStashKey)("").length,
    );
  }
  function createViewportMemory(input?: Dynamic, options?: Dynamic): Dynamic {
    return {
      recall(input2: Dynamic): Dynamic {
        try {
          let value: Dynamic = sessionStorage.getItem(input());
          if (value === null) return;
          let value2: Dynamic = JSON.parse(value);
          if (
            typeof value2 != "object" ||
            value2 === null ||
            !(
              "page" in value2 &&
              "x" in value2 &&
              "y" in value2 &&
              "scale" in value2
            )
          )
            return;
          let {
            page: value3,
            x: value4,
            y: value5,
            scale: value6,
          }: Dynamic = value2;
          return value3 !== input2 ||
            !isFiniteNumber(value4) ||
            !isFiniteNumber(value5) ||
            !isFiniteNumber(value6) ||
            value6 < options.minScale ||
            value6 > options.maxScale
            ? undefined
            : {
                x: value4,
                y: value5,
                scale: value6,
              };
        } catch {
          return;
        }
      },
      remember(input2: Dynamic, options2: Dynamic): Dynamic {
        try {
          sessionStorage.setItem(
            input(),
            JSON.stringify({
              page: input2,
              x: options2.x,
              y: options2.y,
              scale: options2.scale,
            }),
          );
        } catch {}
      },
    };
  }
  function getViewportMemoryScope(): Dynamic {
    let value: Dynamic = (0, runtime.getEmbedContext)();
    return value !== null
      ? "embed/" + value.memoryScope
      : getArtifactMemoryScope();
  }
  bindRuntimeValue(
    runtime,
    "getArtifactMemoryScope",
    () => getArtifactMemoryScope,
  );
  bindRuntimeValue(
    runtime,
    "isFiniteNumber",
    () => isFiniteNumber,
    (value) => {
      isFiniteNumber = value;
    },
  );
  bindRuntimeValue(runtime, "createViewportMemory", () => createViewportMemory);
  bindRuntimeValue(
    runtime,
    "viewportScaleLimits",
    () => viewportScaleLimits,
    (value) => {
      viewportScaleLimits = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getViewportMemoryScope",
    () => getViewportMemoryScope,
  );
  bindRuntimeValue(
    runtime,
    "createViewportMemoryValue",
    () => createViewportMemoryValue,
    (value) => {
      createViewportMemoryValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "recallCanvasView",
    () => recallCanvasView,
    (value) => {
      recallCanvasView = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rememberCanvasView",
    () => rememberCanvasView,
    (value) => {
      rememberCanvasView = value;
    },
  );
  return () => {
    isFiniteNumber = (input?: Dynamic): Dynamic =>
      typeof input == "number" && Number.isFinite(input);
    viewportScaleLimits = {
      minScale: 0.05,
      maxScale: 8,
    };
    createViewportMemoryValue = createViewportMemory(
      (): Dynamic => "design-view/" + getViewportMemoryScope(),
      viewportScaleLimits,
    );
    recallCanvasView = createViewportMemoryValue.recall;
    rememberCanvasView = createViewportMemoryValue.remember;
  };
}

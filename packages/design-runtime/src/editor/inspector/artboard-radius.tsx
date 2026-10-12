/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorArtboardRadius(
  runtime: RuntimeBindings,
): () => void {
  var jsxInspectorArtboardRadius: Dynamic;
  var InspectorArtboardRadiusItems: Dynamic;
  var InspectorArtboardRadiusItems_2: Dynamic;
  var reactInspectorArtboardRadius: Dynamic;
  var reactInspectorArtboardRadius_2: Dynamic;
  function ArtboardRadiusRow({
    radius: radius,
    readOnly = false,
    onSetRadius: onSetRadius,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.artboardRadiusCorners)(radius),
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let items: Dynamic = [...value];
        for (let value2 of input as Dynamic)
          items[value2.side] = value2.value ?? 0;
        return items;
      };
    return (
      <runtime.PropertyCornersRow
        label={"Radius"}
        data-testid={"dc-artboard-radius"}
        title={readOnly ? runtime.ViewOnlyYouCanInspectThisMessage : undefined}
        values={radius === undefined ? InspectorArtboardRadiusItems : value}
        placeholders={InspectorArtboardRadiusItems_2}
        unit={"px"}
        min={0}
        max={runtime.PlatformFileContentResolvedValue_3}
        disabled={readOnly}
        onSides={(input?: Dynamic): Dynamic =>
          onSetRadius(callback(input), false)
        }
        onScrubSides={(input?: Dynamic): Dynamic =>
          onSetRadius(callback(input), true)
        }
        onScrubEnd={(input?: Dynamic): Dynamic =>
          onSetRadius(callback(input), false)
        }
        onReset={
          radius !== undefined && !readOnly
            ? (): Dynamic => onSetRadius(undefined, false)
            : undefined
        }
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxInspectorArtboardRadius",
    () => jsxInspectorArtboardRadius,
    (value) => {
      jsxInspectorArtboardRadius = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorArtboardRadiusItems",
    () => InspectorArtboardRadiusItems,
    (value) => {
      InspectorArtboardRadiusItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorArtboardRadiusItems_2",
    () => InspectorArtboardRadiusItems_2,
    (value) => {
      InspectorArtboardRadiusItems_2 = value;
    },
  );
  bindRuntimeValue(runtime, "ArtboardRadiusRow", () => ArtboardRadiusRow);
  bindRuntimeValue(
    runtime,
    "reactInspectorArtboardRadius",
    () => reactInspectorArtboardRadius,
    (value) => {
      reactInspectorArtboardRadius = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactInspectorArtboardRadius_2",
    () => reactInspectorArtboardRadius_2,
    (value) => {
      reactInspectorArtboardRadius_2 = value;
    },
  );
  return () => {
    jsxInspectorArtboardRadius = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    InspectorArtboardRadiusItems = [undefined, undefined, undefined, undefined];
    InspectorArtboardRadiusItems_2 = ["0", "0", "0", "0"];
    (0, runtime.initializeCdsIndex)();
    reactInspectorArtboardRadius = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactInspectorArtboardRadius_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
  };
}

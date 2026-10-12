/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorInspectorPopoverPosition(
  runtime: RuntimeBindings,
): () => void {
  var InspectorPopoverPositionGUseSet: Dynamic;
  var InspectorPopoverPositionPropConfig: Dynamic;
  function clampPopoverToCanvas(
    point?: Dynamic,
    canvasRect?: Dynamic,
    popupSize?: Dynamic,
  ): Dynamic {
    return {
      x: Math.max(
        canvasRect.left + 8,
        Math.min(canvasRect.right - popupSize.w, point.x),
      ),
      y: Math.max(
        canvasRect.top + 8,
        Math.min(canvasRect.bottom - popupSize.h, point.y),
      ),
    };
  }
  function clampPopoverAnchorTop(
    anchorY?: Dynamic,
    canvasRect?: Dynamic,
    titleHeight?: Dynamic,
  ): Dynamic {
    return Math.max(
      canvasRect.top + 12 + titleHeight,
      Math.min(canvasRect.bottom - 8, anchorY),
    );
  }
  bindRuntimeValue(runtime, "clampPopoverToCanvas", () => clampPopoverToCanvas);
  bindRuntimeValue(
    runtime,
    "clampPopoverAnchorTop",
    () => clampPopoverAnchorTop,
  );
  bindRuntimeValue(
    runtime,
    "InspectorPopoverPositionGUseSet",
    () => InspectorPopoverPositionGUseSet,
    (value) => {
      InspectorPopoverPositionGUseSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "InspectorPopoverPositionPropConfig",
    () => InspectorPopoverPositionPropConfig,
    (value) => {
      InspectorPopoverPositionPropConfig = value;
    },
  );
  return () => {
    InspectorPopoverPositionGUseSet = new Set([
      "g",
      "use",
      ...runtime.InspectorStyleMetadataTextTspanTextpathSet,
    ]);
    InspectorPopoverPositionPropConfig = {
      prop: "background-color",
    };
  };
}

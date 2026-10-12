import type { DesignStyle, SheetFrameState } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsSheetsLayout(runtime: RuntimeBindings): () => void {
  var SheetsLayoutPositionTopRightConfig: DesignStyle;
  var SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig: Pick<
    import("@base-ui/react/combobox").Combobox.Positioner.Props,
    "disableAnchorTracking" | "collisionAvoidance"
  >;
  var SheetsLayoutConstant: number;
  var SheetsLayoutCss: string;
  var SheetsLayoutCss_2: string;
  var ComfortableValue: string;
  var SheetsLayoutConstant_2: number;
  var SheetsLayoutCss_3: string;
  var initializeSheetsLayout: () => void;
  function getSheetFixedPosition(input?: SheetFrameState | null): DesignStyle {
    let value = input?.keyboard?.inset ?? 0;
    return value > 0
      ? {
          ...SheetsLayoutPositionTopRightConfig,
          bottom: value,
        }
      : SheetsLayoutPositionTopRightConfig;
  }
  function getSheetFrameStyle(
    input: SheetFrameState | null,
    {
      floor: floor,
      parentFrameHeight: parentFrameHeight,
    }: {
      floor?: "half" | "content";
      parentFrameHeight?: number;
    },
  ): DesignStyle {
    let value = input?.keyboard ?? null,
      value2 =
        floor === "half"
          ? `min(${SheetsLayoutCss_3}, ${SheetsLayoutCss})`
          : "0px";
    return {
      "--available-height": SheetsLayoutCss,
      width: "100%",
      maxWidth: "none",
      minWidth: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingBottom: value !== null ? "0.5rem" : undefined,
      minHeight:
        value !== null
          ? undefined
          : parentFrameHeight !== undefined
            ? `max(${value2}, ${parentFrameHeight}px)`
            : floor === "half"
              ? value2
              : undefined,
      maxHeight:
        value !== null
          ? `${Math.max(0, value.visible - 8)}px`
          : input?.height !== undefined
            ? SheetsLayoutCss_2
            : floor === "half"
              ? value2
              : SheetsLayoutCss,
      height:
        input?.detent === "tall"
          ? SheetsLayoutCss
          : input?.height !== undefined
            ? `${input.height}px`
            : undefined,
    };
  }
  bindRuntimeValue(
    runtime,
    "getSheetFixedPosition",
    () => getSheetFixedPosition,
  );
  bindRuntimeValue(runtime, "getSheetFrameStyle", () => getSheetFrameStyle);
  bindRuntimeValue(
    runtime,
    "SheetsLayoutPositionTopRightConfig",
    () => SheetsLayoutPositionTopRightConfig,
    (value) => {
      SheetsLayoutPositionTopRightConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig",
    () => SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig,
    (value) => {
      SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLayoutConstant",
    () => SheetsLayoutConstant,
    (value) => {
      SheetsLayoutConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLayoutCss",
    () => SheetsLayoutCss,
    (value) => {
      SheetsLayoutCss = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLayoutCss_2",
    () => SheetsLayoutCss_2,
    (value) => {
      SheetsLayoutCss_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComfortableValue",
    () => ComfortableValue,
    (value) => {
      ComfortableValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLayoutConstant_2",
    () => SheetsLayoutConstant_2,
    (value) => {
      SheetsLayoutConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SheetsLayoutCss_3",
    () => SheetsLayoutCss_3,
    (value) => {
      SheetsLayoutCss_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsLayout",
    () => initializeSheetsLayout,
    (value) => {
      initializeSheetsLayout = value;
    },
  );
  return () => {
    initializeSheetsLayout = (0, runtime.initializeOnce)(() => {
      (0, runtime.initializeSheetsGesturePhysics)();
      SheetsLayoutPositionTopRightConfig = {
        position: "fixed",
        top: "auto",
        right: 0,
        bottom: 0,
        left: 0,
        width: "auto",
        minWidth: 0,
        maxWidth: "none",
        transform: "none",
      };
      SheetsLayoutDisableAnchorTrackingCollisionAvoidanceConfig = {
        disableAnchorTracking: true,
        collisionAvoidance: {
          side: "none",
          align: "none",
        },
      };
      SheetsLayoutConstant = 0.9;
      SheetsLayoutCss = `${SheetsLayoutConstant * 100}dvh`;
      SheetsLayoutCss_2 = `${(SheetsLayoutConstant + 0.09999999999999998 * runtime.sheetGestureConstants.overshootRoom) * 100}dvh`;
      ComfortableValue = "comfortable";
      SheetsLayoutConstant_2 = 0.5;
      SheetsLayoutCss_3 = `${SheetsLayoutConstant_2 * 100}dvh`;
    });
  };
}

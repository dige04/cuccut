import type {
  SheetDetents,
  SheetGestureRelease,
  SheetGestureResult,
  SheetPosition,
} from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsSheetsGesturePhysics(
  runtime: RuntimeBindings,
): () => void {
  var sheetGestureConstants: {
    detentThreshold: number;
    dismissFraction: number;
    flingVelocity: number;
    rubberBand: number;
    overshootRoom: number;
  };
  var initializeSheetsGesturePhysics: () => void;
  function rubberBandDistance(distance: number, room: number): number {
    return distance <= 0 || room <= 0
      ? 0
      : (1 - 1 / ((distance * sheetGestureConstants.rubberBand) / room + 1)) *
          room;
  }
  function inverseRubberBandDistance(distance: number, room: number): number {
    return distance <= 0 || room <= 0
      ? 0
      : ((1 / (1 - Math.min(distance, room * 0.9) / room) - 1) * room) /
          sheetGestureConstants.rubberBand;
  }
  function calculateSheetDetents(
    restHeight: number,
    viewportHeight: number,
    tallFraction: number,
    allowTall: boolean = true,
  ): SheetDetents {
    let candidateTallHeight = Math.max(
        viewportHeight * tallFraction,
        restHeight,
      ),
      tallHeight =
        !allowTall ||
        candidateTallHeight - restHeight < sheetGestureConstants.detentThreshold
          ? restHeight
          : candidateTallHeight;
    return {
      rest: restHeight,
      tall: tallHeight,
      room: Math.max(
        0,
        (viewportHeight - tallHeight) * sheetGestureConstants.overshootRoom,
      ),
    };
  }
  function sheetHasTallDetent(input: SheetDetents): boolean {
    return input.tall > input.rest;
  }
  function calculateSheetPosition(
    detents: SheetDetents,
    rawHeight: number,
  ): SheetPosition {
    if (rawHeight > detents.tall)
      return {
        height:
          detents.tall +
          rubberBandDistance(rawHeight - detents.tall, detents.room),
        slide: 0,
        shown: 1,
      };
    if (rawHeight >= detents.rest)
      return {
        height: rawHeight,
        slide: 0,
        shown: 1,
      };
    let slide = detents.rest - rawHeight;
    return {
      height: detents.rest,
      slide: slide,
      shown: 1 - Math.min(1, slide / Math.max(1, detents.rest)),
    };
  }
  function sheetPositionToRawHeight(
    detents: SheetDetents,
    height: number,
    slide: number,
  ): number {
    return height > detents.tall
      ? detents.tall +
          inverseRubberBandDistance(height - detents.tall, detents.room)
      : Math.min(height, detents.tall) - Math.max(0, slide);
  }
  function settleSheetGesture(
    input: SheetDetents,
    options: SheetGestureRelease,
  ): SheetGestureResult {
    let { slide: value } = calculateSheetPosition(input, options.rawAtRelease),
      value2 =
        options.commit &&
        value > 0 &&
        (value - options.caughtSlide >
          input.rest * sheetGestureConstants.dismissFraction ||
          (options.detent === "default" &&
            options.velocity > sheetGestureConstants.flingVelocity));
    if (!options.commit || value2)
      return {
        dismiss: value2,
        detent: options.detent,
      };
    if (options.rawAtGrab > input.rest && options.rawAtGrab < input.tall) {
      let value3 = options.rawAtRelease - options.rawAtGrab;
      return value3 > sheetGestureConstants.detentThreshold &&
        sheetHasTallDetent(input)
        ? {
            dismiss: false,
            detent: "tall",
          }
        : value3 < -sheetGestureConstants.detentThreshold
          ? {
              dismiss: false,
              detent: "default",
            }
          : {
              dismiss: false,
              detent: options.detent,
            };
    }
    return options.detent === "default" &&
      sheetHasTallDetent(input) &&
      options.rawAtRelease > input.rest + sheetGestureConstants.detentThreshold
      ? {
          dismiss: false,
          detent: "tall",
        }
      : options.detent === "tall" &&
          options.rawAtRelease <
            input.tall - sheetGestureConstants.detentThreshold
        ? {
            dismiss: false,
            detent: "default",
          }
        : {
            dismiss: false,
            detent: options.detent,
          };
  }
  bindRuntimeValue(runtime, "rubberBandDistance", () => rubberBandDistance);
  bindRuntimeValue(
    runtime,
    "inverseRubberBandDistance",
    () => inverseRubberBandDistance,
  );
  bindRuntimeValue(
    runtime,
    "calculateSheetDetents",
    () => calculateSheetDetents,
  );
  bindRuntimeValue(runtime, "sheetHasTallDetent", () => sheetHasTallDetent);
  bindRuntimeValue(
    runtime,
    "calculateSheetPosition",
    () => calculateSheetPosition,
  );
  bindRuntimeValue(
    runtime,
    "sheetPositionToRawHeight",
    () => sheetPositionToRawHeight,
  );
  bindRuntimeValue(runtime, "settleSheetGesture", () => settleSheetGesture);
  bindRuntimeValue(
    runtime,
    "sheetGestureConstants",
    () => sheetGestureConstants,
    (value) => {
      sheetGestureConstants = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSheetsGesturePhysics",
    () => initializeSheetsGesturePhysics,
    (value) => {
      initializeSheetsGesturePhysics = value;
    },
  );
  return () => {
    initializeSheetsGesturePhysics = (0, runtime.initializeOnce)(() => {
      sheetGestureConstants = {
        detentThreshold: 40,
        dismissFraction: 0.25,
        flingVelocity: 0.8,
        rubberBand: 0.55,
        overshootRoom: 0.5,
      };
    });
  };
}

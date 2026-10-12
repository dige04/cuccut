/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** The fields of a pointer event that survive after the event object is recycled. */
export interface PointerSnapshot {
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}
/** A touch that may turn into a long press; callers extend it with their own fields. */
export interface TouchPressState {
  /** Where the finger went down. */
  press: Pick<PointerSnapshot, "clientX" | "clientY">;
  /** True once the hold timer fired. */
  popped?: boolean;
  /** True when the pressed object was already selected (a move then drags it). */
  selected?: boolean;
}
export type TouchLongPressEvent =
  | { kind: "move"; clientX: number; clientY: number }
  | { kind: "hold" }
  | { kind: "up" }
  | { kind: "cancel" };
export type TouchLongPressOutcome =
  | "none"
  | "drag"
  | "pan"
  | "pop"
  | "tap"
  | "cancel";
export interface TouchLongPressResult<S extends TouchPressState> {
  /** The press to keep tracking, or null once it is resolved. */
  press: S | null;
  outcome: TouchLongPressOutcome;
}
/** Where a touch landed, for deciding whether a tap enters editing. */
export interface TouchLongPressEditContext {
  pointerType: string;
  /** Only its truthiness counts: the element under the press, or whether there is one. */
  editTarget: Element | boolean | null | undefined;
  onHandle: boolean;
  textEdit: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    snapshotPointerEvent: (event: PointerSnapshot) => PointerSnapshot;
    TOUCH_LONG_PRESS_MS: number;
    canStartTouchLongPress: (
      event: Pick<PointerSnapshot, "pointerType" | "button" | "target">,
    ) => boolean;
    canEditAfterTouchLongPress: (
      context: TouchLongPressEditContext,
    ) => boolean | null | undefined;
    reduceTouchLongPress: <S extends TouchPressState>(
      state: S,
      event: TouchLongPressEvent,
      movementThreshold: number,
    ) => TouchLongPressResult<S>;
  }
}

export function installEditorTouchLongPress(
  runtime: RuntimeBindings,
): () => void {
  var TOUCH_LONG_PRESS_MS: RuntimeBindings["TOUCH_LONG_PRESS_MS"];
  function snapshotPointerEvent(event: PointerSnapshot): PointerSnapshot {
    return {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
    };
  }
  function canStartTouchLongPress(
    event: Pick<PointerSnapshot, "pointerType" | "button" | "target">,
  ): boolean {
    if (event.pointerType !== "touch" || event.button !== 0) {
      return false;
    }
    let target = event.target as Element | null;
    if (target && typeof target.closest === "function") {
      if (target.closest("[data-resize-handle]") !== null) {
        return false;
      }
      let ancestor = target.closest(
        "button, a, input, select, textarea",
      );
      if (ancestor !== null && !ancestor.hasAttribute("data-drag-surface")) {
        return false;
      }
    }
    return true;
  }
  function canEditAfterTouchLongPress(
    context: TouchLongPressEditContext,
  ): boolean | null | undefined {
    return (
      context.pointerType === "touch" &&
      context.editTarget &&
      !context.onHandle &&
      !context.textEdit
    );
  }
  function reduceTouchLongPress<S extends TouchPressState>(
    state: S,
    event: TouchLongPressEvent,
    movementThreshold: number,
  ): TouchLongPressResult<S> {
    switch (event.kind) {
      case "move": {
        if (state.popped) {
          return {
            press: state,
            outcome: "none",
          };
        }
        if (
          Math.abs(event.clientX - state.press.clientX) +
            Math.abs(event.clientY - state.press.clientY) <
          movementThreshold
        ) {
          return {
            press: state,
            outcome: "none",
          };
        }
        return {
          press: null,
          outcome: state.selected === true ? "drag" : "pan",
        };
      }
      case "hold":
        if (state.popped) {
          return {
            press: state,
            outcome: "none",
          };
        } else {
          return {
            press: {
              ...state,
              popped: true,
            },
            outcome: "pop",
          };
        }
      case "up":
        return {
          press: null,
          outcome: state.popped ? "none" : "tap",
        };
      case "cancel":
        return {
          press: null,
          outcome: "cancel",
        };
    }
  }
  bindRuntimeValue(runtime, "snapshotPointerEvent", () => snapshotPointerEvent);
  bindRuntimeValue(
    runtime,
    "TOUCH_LONG_PRESS_MS",
    () => TOUCH_LONG_PRESS_MS,
    (value) => {
      TOUCH_LONG_PRESS_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canStartTouchLongPress",
    () => canStartTouchLongPress,
  );
  bindRuntimeValue(
    runtime,
    "canEditAfterTouchLongPress",
    () => canEditAfterTouchLongPress,
  );
  bindRuntimeValue(runtime, "reduceTouchLongPress", () => reduceTouchLongPress);
  return () => {
    TOUCH_LONG_PRESS_MS = 450;
  };
}

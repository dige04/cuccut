/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installEditorPrimaryModifier(
  runtime: RuntimeBindings,
): () => void {
  var primaryModifierKey: Dynamic;
  var primaryModifierHeld: Dynamic;
  var primaryModifierSubscribers: Dynamic;
  var primaryModifierListenersInstalled: Dynamic;
  var pendingPrimaryModifierState: Dynamic;
  var primaryModifierAnimationFrame: Dynamic;
  function publishPrimaryModifierState(held?: Dynamic): Dynamic {
    primaryModifierHeld = held;
    pendingPrimaryModifierState = null;
    for (let value of primaryModifierSubscribers as Dynamic) value(held);
  }
  function installPrimaryModifierListeners(): Dynamic {
    if (primaryModifierListenersInstalled || typeof window === "undefined")
      return;
    primaryModifierListenersInstalled = true;
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
      input.key === primaryModifierKey &&
        !input.repeat &&
        publishPrimaryModifierState(input.type === "keydown");
    };
    (window as Dynamic).addEventListener("keydown", callback, true);
    (window as Dynamic).addEventListener("keyup", callback, true);
    (window as Dynamic).addEventListener("blur", (): Dynamic => {
      !(document as Dynamic).hasFocus() &&
        primaryModifierHeld &&
        publishPrimaryModifierState(false);
    });
  }
  function getPrimaryModifierHeld(): Dynamic {
    installPrimaryModifierListeners();
    return primaryModifierHeld;
  }
  function setPrimaryModifierHeld(held?: Dynamic): Dynamic {
    installPrimaryModifierListeners();
    pendingPrimaryModifierState = null;
    primaryModifierHeld !== held && publishPrimaryModifierState(held);
  }
  function schedulePrimaryModifierHeld(held?: Dynamic): Dynamic {
    installPrimaryModifierListeners();
    pendingPrimaryModifierState = held;
    !primaryModifierAnimationFrame &&
      (primaryModifierAnimationFrame = requestAnimationFrame((): Dynamic => {
        primaryModifierAnimationFrame = 0;
        if (pendingPrimaryModifierState == null) return;
        let value: Dynamic = pendingPrimaryModifierState;
        pendingPrimaryModifierState = null;
        primaryModifierHeld !== value && publishPrimaryModifierState(value);
      }));
  }
  function subscribePrimaryModifierHeld(listener?: Dynamic): Dynamic {
    installPrimaryModifierListeners();
    primaryModifierSubscribers.add(listener);
    return (): Dynamic => {
      primaryModifierSubscribers.delete(listener);
    };
  }
  bindRuntimeValue(
    runtime,
    "primaryModifierKey",
    () => primaryModifierKey,
    (value) => {
      primaryModifierKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "primaryModifierHeld",
    () => primaryModifierHeld,
    (value) => {
      primaryModifierHeld = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "primaryModifierSubscribers",
    () => primaryModifierSubscribers,
    (value) => {
      primaryModifierSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "primaryModifierListenersInstalled",
    () => primaryModifierListenersInstalled,
    (value) => {
      primaryModifierListenersInstalled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pendingPrimaryModifierState",
    () => pendingPrimaryModifierState,
    (value) => {
      pendingPrimaryModifierState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "primaryModifierAnimationFrame",
    () => primaryModifierAnimationFrame,
    (value) => {
      primaryModifierAnimationFrame = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "publishPrimaryModifierState",
    () => publishPrimaryModifierState,
  );
  bindRuntimeValue(
    runtime,
    "installPrimaryModifierListeners",
    () => installPrimaryModifierListeners,
  );
  bindRuntimeValue(
    runtime,
    "getPrimaryModifierHeld",
    () => getPrimaryModifierHeld,
  );
  bindRuntimeValue(
    runtime,
    "setPrimaryModifierHeld",
    () => setPrimaryModifierHeld,
  );
  bindRuntimeValue(
    runtime,
    "schedulePrimaryModifierHeld",
    () => schedulePrimaryModifierHeld,
  );
  bindRuntimeValue(
    runtime,
    "subscribePrimaryModifierHeld",
    () => subscribePrimaryModifierHeld,
  );
  return () => {
    primaryModifierKey = runtime.InspectorColorPickResolvedValue_2
      ? "Meta"
      : "Control";
    primaryModifierHeld = false;
    primaryModifierSubscribers = new Set();
    primaryModifierListenersInstalled = false;
    pendingPrimaryModifierState = null;
    primaryModifierAnimationFrame = 0;
  };
}

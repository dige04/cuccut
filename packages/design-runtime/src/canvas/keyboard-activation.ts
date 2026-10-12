/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasKeyboardActivation(
  runtime: RuntimeBindings,
): () => void {
  var spaceActivatedElements: Dynamic;
  function buttonKeyboardActivation(onActivate?: Dynamic): Dynamic {
    return {
      onKeyDown(event: Dynamic): Dynamic {
        (event.key !== "Enter" && event.key !== " ") ||
          event.altKey ||
          event.ctrlKey ||
          event.defaultPrevented ||
          (event.preventDefault(),
          !event.repeat &&
            (event.key === "Enter"
              ? onActivate(event)
              : spaceActivatedElements.add(event.currentTarget)));
      },
      onKeyUp(event: Dynamic): Dynamic {
        event.key !== " " ||
          !spaceActivatedElements.delete(event.currentTarget) ||
          event.altKey ||
          event.ctrlKey ||
          event.defaultPrevented ||
          (event.preventDefault(), onActivate(event));
      },
      onBlur(input: Dynamic): Dynamic {
        spaceActivatedElements.delete(input.currentTarget);
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "spaceActivatedElements",
    () => spaceActivatedElements,
    (value) => {
      spaceActivatedElements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonKeyboardActivation",
    () => buttonKeyboardActivation,
  );
  return () => {
    spaceActivatedElements = new WeakSet();
  };
}

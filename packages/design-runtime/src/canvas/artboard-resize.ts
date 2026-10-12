/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasArtboardResize(
  runtime: RuntimeBindings,
): () => void {
  function beginArtboardResize(event?: Dynamic, options?: Dynamic): Dynamic {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (0, runtime.focusCanvasDocument)();
    options.onGesture(options.src, true);
    options.armWindowGestureEnd(options.src);
    let [items, items2, items3]: Dynamic = [
        event.clientX,
        event.clientY,
        event.pointerId,
      ],
      value: Dynamic = null,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (
          input.pointerId === items3 &&
          !(
            value === null &&
            Math.hypot(input.clientX - items, input.clientY - items2) < 4
          )
        ) {
          if (options.sound && !options.sound()) return callback5();
          value = options.patchAt(
            (input.clientX - items) / options.scale,
            (input.clientY - items2) / options.scale,
            input,
          );
          options.onChange(value, false);
        }
      },
      callback2: Dynamic = (): Dynamic => {
        (window as Dynamic).removeEventListener("pointermove", callback);
        (window as Dynamic).removeEventListener("pointerup", callback4);
        (window as Dynamic).removeEventListener("pointercancel", callback5);
        (window as Dynamic).removeEventListener("keydown", callback6, true);
        options.onGesture(options.src, false);
        options.onEnd?.();
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic =>
        JSON.stringify(
          input,
          (input2?: Dynamic, options2?: Dynamic): Dynamic =>
            typeof options2 == "number" ? Math.round(options2) : options2,
        ),
      callback4: Dynamic = (input?: Dynamic): Dynamic => {
        if (input.pointerId !== items3) return;
        let value2: Dynamic = value;
        callback2();
        value2 !== null &&
          (callback3(value2) === callback3(options.restore) ||
          (options.sound && !options.sound())
            ? options.onChange(options.restore, false)
            : options.onChange(value2, true));
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        if (input && input.pointerId !== items3) return;
        let value2: Dynamic = value !== null;
        callback2();
        value2 && options.onChange(options.restore, false);
      },
      callback6: Dynamic = (event2?: Dynamic): Dynamic => {
        event2.key === "Escape" &&
          (event2.preventDefault(),
          event2.stopImmediatePropagation(),
          callback5());
      };
    (window as Dynamic).addEventListener("pointermove", callback);
    (window as Dynamic).addEventListener("pointerup", callback4);
    (window as Dynamic).addEventListener("pointercancel", callback5);
    (window as Dynamic).addEventListener("keydown", callback6, true);
  }
  bindRuntimeValue(runtime, "beginArtboardResize", () => beginArtboardResize);
  return () => {};
}

/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasImageDecodeScheduler(
  runtime: RuntimeBindings,
): () => void {
  var CanvasImageDecodeSchedulerSubscribers: Dynamic;
  var CanvasImageDecodeSchedulerCache: Dynamic;
  var isImageDecodeQueued: Dynamic;
  function scheduleImageDecode(input?: Dynamic, options?: Dynamic): Dynamic {
    CanvasImageDecodeSchedulerSubscribers.has(input) ||
    CanvasImageDecodeSchedulerSubscribers.size < 4
      ? (CanvasImageDecodeSchedulerSubscribers.add(input), options())
      : CanvasImageDecodeSchedulerCache.set(input, options);
    return (): Dynamic => {
      CanvasImageDecodeSchedulerCache.delete(input);
      if (!CanvasImageDecodeSchedulerSubscribers.delete(input)) return;
      let value: Dynamic = CanvasImageDecodeSchedulerCache.entries().next();
      if (value.done) return;
      let [value2, value3]: Dynamic = value.value;
      CanvasImageDecodeSchedulerCache.delete(value2);
      CanvasImageDecodeSchedulerSubscribers.add(value2);
      value3();
    };
  }
  function isTouchSelectionStart(input?: Dynamic, options?: Dynamic): Dynamic {
    return input === "touch" && !options;
  }
  function watchPointerRelease(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = window,
  ): Dynamic {
    if (input.isPrimary === false) return (): Dynamic => {};
    let { pointerId: value, clientX: value2, clientY: value3 }: Dynamic = input,
      callback: Dynamic = (): Dynamic => {
        context.removeEventListener("pointerup", callback2);
        context.removeEventListener("pointercancel", callback3);
        context.removeEventListener("pointerdown", callback4);
      },
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        input2.pointerId === value &&
          (callback(),
          !(input2.button != null && input2.button !== 0) &&
            Math.hypot(input2.clientX - value2, input2.clientY - value3) <=
              10 &&
            options(input2));
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        input2.pointerId === value && callback();
      },
      callback4: Dynamic = (input2?: Dynamic): Dynamic => {
        input2 !== input &&
          (input2.pointerType === "touch" || input2.pointerId === value) &&
          callback();
      };
    context.addEventListener("pointerup", callback2);
    context.addEventListener("pointercancel", callback3);
    context.addEventListener("pointerdown", callback4);
    return callback;
  }
  function preventTouchScroll(input?: Dynamic): Dynamic {
    if (!input) return (): Dynamic => {};
    let callback: Dynamic = (event?: Dynamic): Dynamic => {
      event.cancelable && event.preventDefault();
    };
    input.addEventListener("touchstart", callback, {
      passive: false,
    });
    return (): Dynamic => input.removeEventListener("touchstart", callback);
  }
  function prefersDragGesture(input?: Dynamic, options?: Dynamic): Dynamic {
    return input.pointerType !== "mouse" || input.shiftKey || !options;
  }
  bindRuntimeValue(
    runtime,
    "CanvasImageDecodeSchedulerSubscribers",
    () => CanvasImageDecodeSchedulerSubscribers,
    (value) => {
      CanvasImageDecodeSchedulerSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasImageDecodeSchedulerCache",
    () => CanvasImageDecodeSchedulerCache,
    (value) => {
      CanvasImageDecodeSchedulerCache = value;
    },
  );
  bindRuntimeValue(runtime, "scheduleImageDecode", () => scheduleImageDecode);
  bindRuntimeValue(
    runtime,
    "isImageDecodeQueued",
    () => isImageDecodeQueued,
    (value) => {
      isImageDecodeQueued = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isTouchSelectionStart",
    () => isTouchSelectionStart,
  );
  bindRuntimeValue(runtime, "watchPointerRelease", () => watchPointerRelease);
  bindRuntimeValue(runtime, "preventTouchScroll", () => preventTouchScroll);
  bindRuntimeValue(runtime, "prefersDragGesture", () => prefersDragGesture);
  return () => {
    CanvasImageDecodeSchedulerSubscribers = new Set();
    CanvasImageDecodeSchedulerCache = new Map();
    isImageDecodeQueued = (input?: Dynamic): Dynamic =>
      CanvasImageDecodeSchedulerCache.has(input);
  };
}

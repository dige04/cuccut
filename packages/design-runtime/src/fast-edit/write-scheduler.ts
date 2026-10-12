/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFastEditWriteScheduler(
  runtime: RuntimeBindings,
): () => void {
  var FAST_EDIT_WRITE_PACING: Dynamic;
  function createFastEditWriteScheduler(options?: Dynamic): Dynamic {
    let pendingWrites: Dynamic = new Map(),
      measuredDelay: Dynamic = 0,
      timer: Dynamic = null,
      closed: Dynamic = false,
      flushNext: Dynamic = (): Dynamic => {
        timer = null;
        let value: Dynamic = pendingWrites.entries().next();
        if (value.done === true) return;
        let [value2, value3]: Dynamic = value.value;
        pendingWrites.delete(value2);
        let value4: Dynamic = options.now(),
          index: Dynamic = 0;
        closed = true;
        try {
          index = value3();
        } catch {
        } finally {
          closed = false;
        }
        let value5: Dynamic = options.now();
        measuredDelay =
          value5 +
          Math.max(
            FAST_EDIT_WRITE_PACING.minMs,
            index / FAST_EDIT_WRITE_PACING.charsPerMs,
            FAST_EDIT_WRITE_PACING.timesMeasured * (value5 - value4),
          );
        pendingWrites.size > 0 &&
          (timer = options.schedule(flushNext, measuredDelay - value5));
      };
    return {
      ask(input: Dynamic, options2: Dynamic): Dynamic {
        pendingWrites.set(input, options2);
        if (timer !== null || closed) return;
        let value: Dynamic = measuredDelay - options.now();
        value <= 0 ? flushNext() : (timer = options.schedule(flushNext, value));
      },
      drop(input: Dynamic): Dynamic {
        pendingWrites.delete(input);
      },
      clear(): Dynamic {
        pendingWrites.clear();
        timer?.();
        timer = null;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "FAST_EDIT_WRITE_PACING",
    () => FAST_EDIT_WRITE_PACING,
    (value) => {
      FAST_EDIT_WRITE_PACING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFastEditWriteScheduler",
    () => createFastEditWriteScheduler,
  );
  return () => {
    FAST_EDIT_WRITE_PACING = {
      minMs: 140,
      charsPerMs: 100,
      timesMeasured: 5,
    };
  };
}

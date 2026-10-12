/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installPlatformIdleScheduler(
  runtime: RuntimeBindings,
): () => void {
  var PlatformIdleSchedulerRequestIdleCallbackCancelIdleCallbackImmediateConfig: Dynamic;
  var idleTaskScheduler: Dynamic;
  function scheduleMessageChannelTask(input?: Dynamic): Dynamic {
    let value: Dynamic = new MessageChannel(),
      flag: Dynamic = true;
    value.port1.onmessage = (): Dynamic => {
      value.port1.close();
      flag && input();
    };
    value.port2.postMessage(null);
    return (): Dynamic => {
      flag = false;
      value.port1.close();
    };
  }
  bindRuntimeValue(
    runtime,
    "scheduleMessageChannelTask",
    () => scheduleMessageChannelTask,
  );
  bindRuntimeValue(
    runtime,
    "PlatformIdleSchedulerRequestIdleCallbackCancelIdleCallbackImmediateConfig",
    () =>
      PlatformIdleSchedulerRequestIdleCallbackCancelIdleCallbackImmediateConfig,
    (value) => {
      PlatformIdleSchedulerRequestIdleCallbackCancelIdleCallbackImmediateConfig =
        value;
    },
  );
  bindRuntimeValue(
    runtime,
    "idleTaskScheduler",
    () => idleTaskScheduler,
    (value) => {
      idleTaskScheduler = value;
    },
  );
  return () => {
    PlatformIdleSchedulerRequestIdleCallbackCancelIdleCallbackImmediateConfig =
      {
        requestIdleCallback:
          typeof (globalThis as Dynamic).requestIdleCallback == "function"
            ? (input?: Dynamic, options?: Dynamic): Dynamic =>
                (globalThis as Dynamic).requestIdleCallback(input, options)
            : undefined,
        cancelIdleCallback: (input?: Dynamic): Dynamic =>
          (globalThis as Dynamic).cancelIdleCallback?.(input),
        immediate:
          typeof MessageChannel == "function"
            ? scheduleMessageChannelTask
            : undefined,
        setTimeout: (input?: Dynamic, options?: Dynamic): Dynamic =>
          (globalThis as Dynamic).setTimeout(input, options),
        clearTimeout: (input?: Dynamic): Dynamic =>
          (globalThis as Dynamic).clearTimeout(input),
      };
    idleTaskScheduler = class value {
      constructor(
        input: Dynamic,
        options: Dynamic = 1e3,
        context: Dynamic = PlatformIdleSchedulerRequestIdleCallbackCancelIdleCallbackImmediateConfig,
      ) {
        this.work = input;
        this.timeoutMs = options;
        this.timers = context;
      }
      work: Dynamic;
      timeoutMs: Dynamic;
      timers: Dynamic;
      items: Dynamic = [];
      cancel: Dynamic = null;
      get pending(): Dynamic {
        return this.items;
      }
      add(input: Dynamic, options: Dynamic): Dynamic {
        let items: Dynamic = [...new Set(input)];
        this.items = options?.front
          ? [
              ...items,
              ...this.items.filter(
                (input2?: Dynamic): Dynamic => !items.includes(input2),
              ),
            ]
          : [
              ...this.items,
              ...items.filter(
                (input2?: Dynamic): Dynamic => !this.items.includes(input2),
              ),
            ];
        (this.schedule as Dynamic)();
      }
      retain(input: Dynamic): Dynamic {
        this.items = this.items.filter(input);
      }
      dispose(): Dynamic {
        this.cancel?.();
        this.cancel = null;
        this.items = [];
      }
      static MIN_SLICE_MS: Dynamic = 10;
      schedule(input: Dynamic): Dynamic {
        if (this.cancel !== null || this.items.length === 0) return;
        let callback: Dynamic = (input2?: Dynamic): Dynamic =>
            input2.didTimeout || input2.timeRemaining() <= value.MIN_SLICE_MS,
          callback2: Dynamic = (
            input2?: Dynamic,
            options: Dynamic = false,
          ): Dynamic => {
            this.cancel = null;
            if (options && input2 !== undefined && callback(input2))
              return (this.schedule as Dynamic)();
            let value2: Dynamic = this.items.shift();
            try {
              value2 !== undefined && this.work(value2);
            } finally {
              this.schedule(input2);
            }
          },
          timers: Dynamic = this.timers;
        if (input !== undefined && !callback(input)) {
          if (timers.immediate !== undefined)
            this.cancel = timers.immediate(
              (): Dynamic => callback2(input, true),
            );
          else {
            let value2: Dynamic = timers.setTimeout(
              (): Dynamic => callback2(input, true),
              0,
            );
            this.cancel = (): Dynamic => timers.clearTimeout(value2);
          }
        } else if (typeof timers.requestIdleCallback == "function") {
          let value2: Dynamic = timers.requestIdleCallback(callback2, {
            timeout: this.timeoutMs,
          });
          this.cancel = (): Dynamic => timers.cancelIdleCallback?.(value2);
        } else {
          let value2: Dynamic = timers.setTimeout(
            (): Dynamic => callback2(),
            0,
          );
          this.cancel = (): Dynamic => timers.clearTimeout(value2);
        }
      }
    };
  };
}

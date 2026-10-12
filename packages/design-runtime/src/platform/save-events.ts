/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformSaveEvents(
  runtime: RuntimeBindings,
): () => void {
  var PlatformSaveEventsSubscribers: Dynamic;
  var PlatformSaveEventsHandler: Dynamic;
  var saveReporterActive: Dynamic;
  var PlatformSaveEventsHandler_2: Dynamic;
  function subscribeSaveEvents(input?: Dynamic): Dynamic {
    PlatformSaveEventsSubscribers.add(input);
    return (): Dynamic => {
      PlatformSaveEventsSubscribers.delete(input);
    };
  }
  function createSaveEventReporter(input?: Dynamic): Dynamic {
    let entries: Dynamic = new Map(),
      count: Dynamic = 1;
    saveReporterActive = true;
    return {
      saveStart(input2: Dynamic, options: Dynamic): Dynamic {
        let value: Dynamic = count++;
        entries.set(value, {
          n: input.saveStart(input2, options),
          paths: [...input2],
        });
        PlatformSaveEventsHandler({
          type: "started",
          n: value,
          paths: [...input2],
        });
        return value;
      },
      saveEnd(input2: Dynamic, options: Dynamic): Dynamic {
        let entry: Dynamic = entries.get(input2);
        entries.delete(input2);
        input.saveEnd(entry?.n ?? input2, options);
        PlatformSaveEventsHandler(
          options.ok
            ? {
                type: "landed",
                n: input2,
                paths: entry?.paths ?? [],
              }
            : {
                type: "refused",
                n: input2,
                paths: entry?.paths ?? [],
                ...(options.code !== undefined
                  ? {
                      code: options.code,
                    }
                  : {}),
              },
        );
      },
      event(input2: Dynamic, options: Dynamic): Dynamic {
        input.event(input2, options);
        PlatformSaveEventsHandler({
          type: "event",
          name: input2,
          data: options,
        });
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "PlatformSaveEventsSubscribers",
    () => PlatformSaveEventsSubscribers,
    (value) => {
      PlatformSaveEventsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformSaveEventsHandler",
    () => PlatformSaveEventsHandler,
    (value) => {
      PlatformSaveEventsHandler = value;
    },
  );
  bindRuntimeValue(runtime, "subscribeSaveEvents", () => subscribeSaveEvents);
  bindRuntimeValue(
    runtime,
    "saveReporterActive",
    () => saveReporterActive,
    (value) => {
      saveReporterActive = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformSaveEventsHandler_2",
    () => PlatformSaveEventsHandler_2,
    (value) => {
      PlatformSaveEventsHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSaveEventReporter",
    () => createSaveEventReporter,
  );
  return () => {
    PlatformSaveEventsSubscribers = new Set();
    PlatformSaveEventsHandler = (input?: Dynamic): Dynamic => {
      for (let value of [...PlatformSaveEventsSubscribers] as Dynamic)
        try {
          value(input);
        } catch {}
    };
    saveReporterActive = false;
    PlatformSaveEventsHandler_2 = (): Dynamic => saveReporterActive;
  };
}

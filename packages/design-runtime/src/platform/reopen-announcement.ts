/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformReopenAnnouncement(
  runtime: RuntimeBindings,
): () => void {
  var AppifactReopenedKey: Dynamic;
  function scheduleTypingAwareAnnouncement(input?: Dynamic): Dynamic {
    let timers: Dynamic = input.timers,
      value: Dynamic = input.leadMs ?? 2500,
      value2: Dynamic = value + (input.maxHoldMs ?? 15e3),
      value3: Dynamic = timers.now();
    try {
      input.say(input.message);
    } catch {}
    let callback: Dynamic = (): Dynamic => {
        try {
          return input.isTyping?.() === true;
        } catch {
          return false;
        }
      },
      callback2: Dynamic = (): Dynamic => {
        try {
          return input.hasUnsentEdits?.() === true;
        } catch {
          return false;
        }
      };
    return new Promise((input2?: Dynamic): Dynamic => {
      let callback3: Dynamic = (): Dynamic => {
          if (input.note !== undefined)
            try {
              input.note.store?.setItem(
                AppifactReopenedKey,
                JSON.stringify({
                  why: input.note.why,
                  at: timers.now(),
                  ...(input.note.focus !== undefined
                    ? {
                        focus: input.note.focus,
                      }
                    : {}),
                }),
              );
            } catch {}
          try {
            input.reopen();
          } finally {
            input2();
          }
        },
        callback4: Dynamic = (): Dynamic => {
          let value4: Dynamic = timers.now() - value3;
          if (
            value4 >= value &&
            !callback2() &&
            (!callback() || value4 >= value2)
          ) {
            callback3();
            return;
          }
          timers.setTimeout(
            callback4,
            value4 < value ? Math.min(value - value4, 250) : 250,
          );
        };
      callback4();
    });
  }
  function consumeReopenMessage(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = null;
    try {
      value = input?.getItem(AppifactReopenedKey) ?? null;
    } catch {
      return;
    }
    if (value !== null) {
      try {
        input?.removeItem(AppifactReopenedKey);
      } catch {}
      try {
        let value2: Dynamic = JSON.parse(value);
        return value2 === null ||
          typeof value2.why != "string" ||
          typeof value2.at != "number" ||
          options - value2.at > 6e4 ||
          options < value2.at - 1e3
          ? undefined
          : {
              why: value2.why,
              at: value2.at,
              ...(typeof value2.focus == "string"
                ? {
                    focus: value2.focus,
                  }
                : {}),
            };
      } catch {
        return;
      }
    }
  }
  function announceReopenedArtifact(input?: Dynamic): Dynamic {
    let value: Dynamic = consumeReopenMessage(input.store, input.now);
    if (value === undefined) return false;
    try {
      input.focus(value.focus);
    } catch {}
    try {
      input.say(input.message(value));
    } catch {}
    return true;
  }
  bindRuntimeValue(
    runtime,
    "AppifactReopenedKey",
    () => AppifactReopenedKey,
    (value) => {
      AppifactReopenedKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "scheduleTypingAwareAnnouncement",
    () => scheduleTypingAwareAnnouncement,
  );
  bindRuntimeValue(runtime, "consumeReopenMessage", () => consumeReopenMessage);
  bindRuntimeValue(
    runtime,
    "announceReopenedArtifact",
    () => announceReopenedArtifact,
  );
  return () => {
    AppifactReopenedKey = "appifact-reopened";
  };
}

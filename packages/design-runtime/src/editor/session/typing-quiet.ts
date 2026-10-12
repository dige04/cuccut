/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSessionTypingQuiet(
  runtime: RuntimeBindings,
): () => void {
  function createTypingQuietScheduler(input?: Dynamic): Dynamic {
    let value: Dynamic = null,
      flag: Dynamic = false,
      value2: Dynamic = null,
      value3: Dynamic,
      callback: Dynamic = (): Dynamic => {
        clearTimeout(value3);
        if (!value || value2 === null) return;
        let value4: Dynamic = value.beat + input.quietMs - Date.now();
        if (value4 > 0) {
          value3 = setTimeout(callback, value4);
          return;
        }
        if (
          value.asked === 0 &&
          value.beat > 0 &&
          input.theirsOnItsWay?.() &&
          Date.now() - (value.waits ||= Date.now()) < input.quietMs
        ) {
          value3 = setTimeout(callback, 100);
          return;
        }
        if (value.asked === 2) return callback4();
        value.asked++;
        value.beat = Date.now();
        input.closeBox().then(callback, callback);
      },
      callback2: Dynamic = (): Dynamic => {
        if (value || flag || value2 === null) return;
        let value4: Dynamic = value2;
        value2 = null;
        input.give(value4);
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        let value4: Dynamic = value2 === null;
        (value4 || input2 === "rebuild") && (value2 = input2);
        value4 && value && !input.caretInFrame() && (value.beat = 0);
        value4 && callback();
      },
      callback4: Dynamic = (): Dynamic => {
        clearTimeout(value3);
        value = null;
        callback2();
      };
    return {
      boxOpen(): Dynamic {
        value = {
          shown: value?.shown ?? null,
          newBox: value?.newBox ?? null,
          beat: Date.now(),
          asked: 0,
          waits: 0,
        };
      },
      beat(): Dynamic {
        value &&
          (value = {
            ...value,
            beat: Date.now(),
            asked: 0,
            waits: 0,
          });
      },
      boxClosed: callback4,
      dragLive(input2: Dynamic): Dynamic {
        flag = input2;
        callback2();
      },
      gone(): Dynamic {
        flag = false;
        callback4();
      },
      replaced(input2: Dynamic, options: Dynamic = null): Dynamic {
        !value ||
          !input2 ||
          (value.shown || (value.newBox = options),
          (value.shown ??= input2),
          callback3("push"));
      },
      shown: (): Dynamic => value?.shown ?? null,
      newBox: (): Dynamic => value?.newBox ?? null,
      holds(input2: Dynamic): Dynamic {
        return (input2 === "push" ? !value?.shown : !value && !flag)
          ? false
          : (callback3(input2), true);
      },
      owes: (): Dynamic => value2 !== null,
    };
  }
  bindRuntimeValue(
    runtime,
    "createTypingQuietScheduler",
    () => createTypingQuietScheduler,
  );
  return () => {};
}

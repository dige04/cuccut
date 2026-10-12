/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPropertiesLiveScrub(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesLiveScrub: Dynamic;
  function useLiveStyleScrub(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.reactPropertiesShadowEffects.useRef)(
      input,
    );
    value.current = input;
    let [value2, value3]: Dynamic = (0,
      runtime.reactPropertiesShadowEffects.useState)(null),
      { setOverlayHidden: value4, setScrubbing: value5 }: Dynamic = (0,
      runtime.useInspectorContext)(),
      value6: Dynamic = (0, runtime.reactPropertiesShadowEffects.useRef)(null);
    (0, runtime.reactPropertiesShadowEffects.useEffect)(
      (): Dynamic => (): Dynamic => value6.current?.(),
      [],
    );
    return {
      start: (event?: Dynamic): Dynamic => {
        if (value.current.disabled) return;
        event.preventDefault();
        let currentTarget: Dynamic = event.currentTarget,
          pointerId: Dynamic = event.pointerId;
        currentTarget.setPointerCapture(pointerId);
        let activeElement: Dynamic = (document as Dynamic).activeElement;
        activeElement instanceof HTMLElement &&
          activeElement !== event.currentTarget &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA") &&
          activeElement.blur();
        let clientX: Dynamic = event.clientX,
          value7: Dynamic = clientX,
          value8: Dynamic = null,
          value9: Dynamic = NaN,
          flag: Dynamic = false,
          flag2: Dynamic = false,
          flag3: Dynamic = false,
          index: Dynamic = 0,
          callback: Dynamic = (input2?: Dynamic): Dynamic => {
            let current: Dynamic = value.current;
            if (input2 === current.min || input2 === current.max) return input2;
            let value10: Dynamic = (0, runtime.snapNumericStep)(
              input2,
              current.step ?? 1,
            );
            current.min != null && (value10 = Math.max(current.min, value10));
            current.max != null && (value10 = Math.min(current.max, value10));
            return value10;
          },
          callback2: Dynamic = (): Dynamic => {
            index = 0;
            if (value8 == null || !flag2) return;
            let value10: Dynamic = callback(value8);
            flag3 && value3(value10);
            value.current.onScrub(value10);
          },
          callback3: Dynamic = (input2?: Dynamic): Dynamic => {
            if (input2.buttons === 0) return callback4();
            let current: Dynamic = value.current,
              value10: Dynamic = input2.clientX - value7;
            value10 !== 0 &&
              (value8 == null &&
                (value9 = value8 =
                  Number.isFinite(current.value) ? current.value : 0),
              (value7 = input2.clientX),
              flag3 || ((flag3 = true), value4(true), value5(true)),
              (value8 +=
                value10 * (current.step ?? 1) * (input2.shiftKey ? 10 : 1)),
              current.min != null && (value8 = Math.max(current.min, value8)),
              current.max != null && (value8 = Math.min(current.max, value8)),
              Math.abs(input2.clientX - clientX) > 0.5 && (flag = true),
              flag && callback(value8) !== value9 && (flag2 = true),
              index || (index = requestAnimationFrame(callback2)));
          },
          flag4: Dynamic = false,
          callback4: Dynamic = (input2?: Dynamic): Dynamic => {
            (input2 instanceof PointerEvent &&
              input2.pointerId !== pointerId) ||
              flag4 ||
              ((flag4 = true),
              (value6.current = null),
              currentTarget.removeEventListener("pointermove", callback3),
              currentTarget.removeEventListener("pointerup", callback4),
              currentTarget.removeEventListener("pointercancel", callback4),
              currentTarget.removeEventListener(
                "lostpointercapture",
                callback4,
              ),
              (window as Dynamic).removeEventListener(
                "pointerup",
                callback4,
                true,
              ),
              (window as Dynamic).removeEventListener(
                "pointercancel",
                callback4,
                true,
              ),
              (window as Dynamic).removeEventListener(
                "keydown",
                callback5,
                true,
              ),
              index && (cancelAnimationFrame(index), callback2()),
              flag3 && (value3(null), value5(false), value4(false)));
          };
        currentTarget.addEventListener("pointermove", callback3);
        currentTarget.addEventListener("pointerup", callback4);
        currentTarget.addEventListener("pointercancel", callback4);
        currentTarget.addEventListener("lostpointercapture", callback4);
        let callback5: Dynamic = (event2?: Dynamic): Dynamic => {
          event2.key === "Escape" &&
            (flag3 && event2.preventDefault(), callback4());
        };
        (window as Dynamic).addEventListener("pointerup", callback4, true);
        (window as Dynamic).addEventListener("pointercancel", callback4, true);
        (window as Dynamic).addEventListener("keydown", callback5, true);
        value6.current = callback4;
      },
      live: value2,
    };
  }
  function useStyleCommitScrub(input?: Dynamic): Dynamic {
    let { setOverlayHidden: value, setScrubbing: value2 }: Dynamic = (0,
      runtime.useInspectorContext)(),
      value3: Dynamic = (0, runtime.reactPropertiesShadowEffects.useRef)(false),
      value4: Dynamic = (0, runtime.reactPropertiesShadowEffects.useRef)(true),
      value5: Dynamic = (0, runtime.reactPropertiesShadowEffects.useRef)(input);
    value5.current = input;
    (0, runtime.reactPropertiesShadowEffects.useEffect)(
      (): Dynamic => (
        (value4.current = true),
        (): Dynamic => {
          value4.current = false;
          value3.current &&
            ((value3.current = false), value2(false), value(false));
        }
      ),
      [value, value2],
    );
    return {
      onScrub: (input2?: Dynamic): Dynamic => {
        value4.current &&
          (value3.current ||
            ((value3.current = true), value(true), value2(true)),
          value5.current(input2));
      },
      onScrubEnd: (input2?: Dynamic): Dynamic => {
        value3.current &&
          (typeof input2 == "function" && input2(),
          (value3.current = false),
          value2(false),
          value(false));
      },
    };
  }
  bindRuntimeValue(runtime, "useLiveStyleScrub", () => useLiveStyleScrub);
  bindRuntimeValue(runtime, "useStyleCommitScrub", () => useStyleCommitScrub);
  bindRuntimeValue(
    runtime,
    "jsxPropertiesLiveScrub",
    () => jsxPropertiesLiveScrub,
    (value) => {
      jsxPropertiesLiveScrub = value;
    },
  );
  return () => {
    jsxPropertiesLiveScrub = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}

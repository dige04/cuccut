/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportAnimationSnapshot(
  runtime: RuntimeBindings,
): () => void {
  function captureAnimationStates(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    if (input)
      try {
        let value: Dynamic = input.getAnimations ? input.getAnimations() : [];
        for (let value2 of value as Dynamic)
          try {
            let value3: Dynamic = value2.effect?.getComputedTiming
              ? value2.effect.getComputedTiming()
              : null;
            if (
              !value3 ||
              !isFinite(value3.endTime) ||
              (value2.timeline &&
                !(value2.timeline instanceof DocumentTimeline))
            )
              continue;
            let value4: Dynamic = value2.pending && value2.startTime === null,
              value5: Dynamic = input.hidden && value2.playState === "running";
            if (!value4 && !value5) continue;
            let state: Dynamic = {
              a: value2,
              ct: value2.currentTime,
              paused: false,
            };
            items.push(state);
            value4 || (value2.pause(), (state.paused = true));
            value2.currentTime = value3.endTime;
          } catch {}
      } catch {}
    return function (): Dynamic {
      for (let value: Dynamic = items.length - 1; value >= 0; value--) {
        let value2: Dynamic = items[value];
        try {
          value2.a.currentTime = value2.ct;
        } catch {}
        try {
          value2.paused && value2.a.play();
        } catch {}
      }
    };
  }
  function captureAnimationStyles(input?: Dynamic): Dynamic {
    let items: Dynamic = [];
    if (input)
      try {
        let value: Dynamic =
            input.defaultView && input.defaultView.getComputedStyle,
          items2: Dynamic = [],
          value2: Dynamic = input.getAnimations ? input.getAnimations() : [];
        for (let value3 of value2 as Dynamic)
          try {
            let value4: Dynamic = value3.effect?.getComputedTiming
              ? value3.effect.getComputedTiming()
              : null;
            if (
              !value4 ||
              isFinite(value4.endTime) ||
              (value3.timeline &&
                !(value3.timeline instanceof DocumentTimeline)) ||
              value3.playState !== "running"
            )
              continue;
            let state: Dynamic = {
              a: value3,
              ct: value3.currentTime,
            };
            items.push(state);
            let value5: Dynamic = value4.delay || 0,
              value6: Dynamic = value4.duration || 0,
              value7: Dynamic =
                value5 >= 0 || !value6
                  ? value5
                  : value5 + Math.ceil(-value5 / value6) * value6;
            value3.currentTime = value7;
            let effect: Dynamic = value3.effect,
              value8: Dynamic = effect && effect.target;
            value &&
              value8 &&
              value8.nodeType === 1 &&
              value6 &&
              items2.push({
                a: value3,
                ct: state.ct,
                start: value7,
                dur: value6,
                el: value8,
                pseudo: (effect && effect.pseudoElement) || null,
              });
          } catch {}
        for (let index: Dynamic = 0; index < items2.length; index++)
          try {
            let value3: Dynamic = items2[index],
              callback: Dynamic = (): Dynamic => {
                let value4: Dynamic = value(value3.el, value3.pseudo);
                if (
                  value4.opacity === "0" ||
                  value4.visibility === "hidden" ||
                  value4.display === "none"
                )
                  return true;
                let value5: Dynamic = value4.transform || "";
                if (value5.indexOf("matrix(") === 0) {
                  let value6: Dynamic = value5.slice(7, -1).split(",");
                  return (
                    Math.abs(
                      Number(value6[0]) * Number(value6[3]) -
                        Number(value6[1]) * Number(value6[2]),
                    ) < 1e-6
                  );
                }
                if (value5.indexOf("matrix3d(") === 0) {
                  let value6: Dynamic = value5.slice(9, -1).split(",");
                  return Number(value6[0]) === 0 || Number(value6[5]) === 0;
                }
                return false;
              };
            callback() &&
              ((value3.a.currentTime = value3.start + value3.dur / 2),
              callback() && (value3.a.currentTime = value3.ct));
          } catch {}
      } catch {}
    return function (): Dynamic {
      for (let value: Dynamic = items.length - 1; value >= 0; value--)
        try {
          items[value].a.currentTime = items[value].ct;
        } catch {}
    };
  }
  bindRuntimeValue(
    runtime,
    "captureAnimationStates",
    () => captureAnimationStates,
  );
  bindRuntimeValue(
    runtime,
    "captureAnimationStyles",
    () => captureAnimationStyles,
  );
  return () => {};
}
